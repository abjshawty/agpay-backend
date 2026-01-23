import { RequestBody } from "../interfaces/users";
import Repository from "../repository/users";
import bcrypt from "bcrypt";
import { MsalHelper } from "../helpers/msal.helper";
import coddyger, { IErrorObject } from "coddyger";
import { KeycloakHelper } from "../helpers";
import { logV2 } from "../utils/audit";
import profileRepo from "../repository/profils";
import SocietyRepository from "../repository/society";
import sendMail from "../helpers/mailer";
import AuthService from "../services/auth";

class UserService {
  private repo = new Repository();
  private societyRepo = new SocietyRepository();
  async create (oldreq: RequestBody, internal: boolean, user: { id: string, iat: number; }) {
    try {
      let result;
      let userObj = await this.repo.getOne(user.id);
      let req = {
        ...oldreq,
        createdBy: userObj?.id
      };
      req.type = internal ? "INTERNAL" : "EXTERNAL";
      const checker = new profileRepo();
      const profileNature = await checker.getOne(req.profileId);
      console.log(`Profile nature: ${profileNature} || ${req.type}`);
      console.log(`Detailed profile nature: ${JSON.stringify(profileNature)}`);
      console.log(`Detailed userCreate.req: ${JSON.stringify(req)}`);
      if (!profileNature) {
        const error: any = new Error("Profile not found");
        error.statusCode = 400;
        throw error;
      }
      if (profileNature.type.toUpperCase() != req.type.toUpperCase()) {
        const error: any = new Error("Invalid profile type");
        error.statusCode = 400;
        throw error;
      }
      const realm = process.env.KC_REALM!;

      if (internal) {
        const verifyUrl = `${process.env.KC_URI}/admin/realms/${encodeURIComponent(realm)}/users?email=${req.email}`;
        const verify: any = await KeycloakHelper.executeKCGetQuery(verifyUrl);
        if (verify.length <= 0) {
          const error: any = new Error(
            "Cet email n'est pas connu dans l'active directory",
          );
          error.statusCode = 400;
          throw error;
        }
      }
      const newUser = await KeycloakHelper.createUser({
        email: req.email,
        emailVerified: true,
        username: req.username ? req.username : req.email,
        enabled: true,
        groups: req.groups,
        realmRoles: [req.role],
        firstName: req.firstname,
        lastName: req.lastname,
      });
      if (newUser && typeof newUser === "string") {
        const userId = newUser.split("/").pop();

        const actionUrl = `${process.env.KC_URI}/admin/realms/${encodeURIComponent(realm)}/users/${userId}/execute-actions-email`;
        await KeycloakHelper.setUserPassword({
          id: userId,
          password: process.env.DEFAULT_PASSWORD!,
          newUser: true
        });
        // Commented out password reset email code
        // try {
        //   await KeycloakHelper.executeUserAction(actionUrl, ['UPDATE_PASSWORD']);
        // } catch (actionError) {
        //   console.error('Failed to send password reset email:', actionError);
        //   let error = actionError as any
        //   error.statusCode = 500
        //   error.message = "Failed to send password reset email"
        //   throw error
        // }
        result = await this.repo.add({
          ...req,
          keycloakId: userId,
          username: req.username || req.email  // Ensure username is always set
        });

        // Log audit after successful user creation
        if (result && result.id) {
          if (!internal) await this.setPassword(result.id, process.env.DEFAULT_PASSWORD!);
          // await logV2("Création", "Utilisateurs", result.id, user.id, `Création de l'utilisateur n°${result.id}.`);
        } else {
          console.error(
            "User creation successful but result or result.id is undefined",
          );
        }
      }
      if (newUser && newUser.hasOwnProperty("error") && newUser.hasOwnProperty("id")) {
        if (!internal) {
          console.log("Setting password for user:", newUser);
          await KeycloakHelper.setUserPassword({
            id: (newUser as { error: any, id: string, message: string; }).id,
            password: process.env.DEFAULT_PASSWORD!,
            newUser: true
          });
          result = await this.repo.add({
            ...req,
            keycloakId: (newUser as { error: any, id: string, message: string; }).id,
            username: req.username || req.email  // Ensure username is always set
          });
          await this.setPassword(result.id, process.env.DEFAULT_PASSWORD!);
          // await logV2("Création", "Utilisateurs", result.id, user.id, `Création de l'utilisateur n°${result.id}.`);
        }
        if (internal) {
          const verifyUrl = `${process.env.KC_URI}/admin/realms/${encodeURIComponent(realm)}/users?email=${oldreq.email}`;
          const verifyArr: any = await KeycloakHelper.executeKCGetQuery(verifyUrl);
          const verify = verifyArr[0];
          console.log("UserData:", verify);
          result = await this.repo.add({
            keycloakId: verify.id,
            email: req.email,
            societyId: req.societyId,
            profileId: req.profileId,
            type: req.type,
            firstname: verify.firstName,
            lastname: verify.lastName,
            username: verify.username,
            createdBy: user.id
          });
          sendMail(oldreq.email, "Création de l'utilisateur", `L'utilisateur ${oldreq.email} a été créé. Vous pouvez vous connecter au ${process.env.FRONT_URL}`).catch(err => console.error(`Impossible d'envoyer le mail de création: \n ${err}`));

        }
        // console.log("Old User recreated", result);
        return newUser;
      }
      await logV2("Création", "Utilisateurs", result.id, user.id, `Création d'un nouvel utilisateur.`);
      const token = await AuthService.newToken(oldreq.email);
      sendMail(oldreq.email, "Création de l'utilisateur", `L'utilisateur ${oldreq.email} a été créé. Votre mot de passe est ${process.env.DEFAULT_PASSWORD}. \n Veuillez réinitialiser votre mot de passe: ${process.env.FRONT_URL}/reset-password/${token}`).catch(err => console.error(`Impossible d'envoyer le mail de création: \n ${err}`));
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
        throw error;
      }
      if (error.statusCode === 409) {
        const realm = process.env.KC_REALM!;
        const exists = await this.repo.getuserByEmail(oldreq.email);
        if (exists) {
          const error: any = new Error("Utilisateur existe déjà");
          error.statusCode = 400;
          throw error;
        }
        if (internal) {
          const verifyUrl = `${process.env.KC_URI}/admin/realms/${encodeURIComponent(realm)}/users?email=${oldreq.email}`;
          const verify: any = await KeycloakHelper.executeKCGetQuery(verifyUrl);
          const result = await this.repo.add({
            ...oldreq,
            keycloakId: verify.id,
            createdBy: user.id,
            username: oldreq.username || oldreq.email  // Ensure username is always set
          });
          return result;
        }
        if (!internal) {
          const result = await this.repo.add({
            ...oldreq,
            createdBy: user.id,
            username: oldreq.username || oldreq.email  // Ensure username is always set
          });
          return result;
        }
      }
      throw error;
    }
  }
  async getAll () {
    try {
      const result = await this.repo.getAll();
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAllPaginate (currentPage: number, type?: string, query?: string) {
    try {
      console.log("🔍 USER SERVICE getAllPaginate: page", currentPage, "type", type, "query", query);
      const result = await this.repo.getAllPaginate(currentPage, type, query);
      console.log("🔍 USER SERVICE: Repository returned", result.record.length, "users");

      console.log("🔍 USER SERVICE: Fetching creator info for each user...");
      const elements = await Promise.all(result.record.map(async (r, index) => {
        console.log(`🔍 USER SERVICE: [${index}] User ${r.email} createdBy:`, r.createdBy);
        const creator = await this.repo.getOneLite(r.createdBy as string);
        console.log(`🔍 USER SERVICE: [${index}] Creator fetched:`, creator?.email);
        return {
          ...r,
          user: creator,
        };
      }));

      console.log("🔍 USER SERVICE: Returning final result");
      return { ...result, record: elements };
    } catch (error: any) {
      console.error("🔴 ERROR in USER SERVICE getAllPaginate:", error.message);
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getwEmail (email: string) {
    try {
      const result = await this.repo.getEmailLite(email);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne (id: string) {
    try {
      const result = await this.repo.getOne(id);
      if (result) {
        const societies = await Promise.all(result.societyId.map((id: string) => this.societyRepo.getOne(id)));
        return { ...result, societies };
      }
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async update (user, info: any) {
    try {
      try {
        const keycloakUserData = {
          firstName: info.firstname,
          lastName: info.lastname,
          email: info.email,
          emailVerified: info.isEmailConfirmed,
          enabled: true,
          username: info.email,
        };
        let currentUser = await this.repo.getOne(user.id);
        if (currentUser && currentUser.keycloakId) {
          await KeycloakHelper.updateUser(
            currentUser.keycloakId,
            keycloakUserData,
          );
        }
      } catch (keycloakError: any) {
        console.error("Failed to update user in Keycloak:", keycloakError.code);
        const error = keycloakError as any;
        error.statusCode = 409;
        error.message = "Adresse e-mail non disponible";
        throw error;
      }
      const result = await this.repo.update(user.id, info);
      await logV2("Mise à jour", "Utilisateurs", user.id, user.id, `Mise à jour de l'utilisateur ${result.email}.`);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async delete (id: string, user: any, hard: boolean) {
    try {
      // const result = await this.repo.delete(id);
      const currentUser = await this.repo.getOne(id);
      if (!currentUser) {
        const err: any = new Error("User Not Found");
        err.statusCode = 404;
        throw err;
      }

      if (currentUser.status == "active" && hard) {
        const err: any = new Error("L'utilisateur ne peut être supprimé tant qu'il est actif.");
        err.statusCode = 412;
        throw err;
      }
      let newStatus: string = "deleted";
      if (currentUser.status == "active") newStatus = "sleeping";
      if (currentUser.status == "sleeping") newStatus = "deleted";
      if (hard) newStatus = "deleted";

      const result = await this.repo.update(id, { status: newStatus });
      // KeycloakHelper.disable(currentUser.email)
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async login ({ email, password }: { email: string; password: string; }) {
    const user = await this.repo.getuserByEmail(email);
    let error: any;
    let connected;
    if (!user) {
      error = new Error("Invalid credentials");
      error.statusCode = 400;
      throw error;
    }
    if (user.status != "active") {
      error = new Error("L'utilisateur a été désactivé sur AGPAY. Prière de contacter un administrateur");
      error.statusCode = 403;
      throw error;
    }
    const AD_ROUTES = process.env.AD_DOMAINS?.split(",");
    const internal = AD_ROUTES!.includes(email.split("@")[1]) ? true : false;
    if (user.type == "EXTERNAL" || !internal) {
      await this.loginExternal(user, password);
      return user;
    }

    await this.loginInternal(user, password);

    return user;
  }
  async loginInternal (user, password) {
    const azureconnect: any = await MsalHelper.auth(user.email, password);
    if (azureconnect == "invalid_grant") {
      let error: any = new Error();
      error.statusCode = 403;
      error.message = "Invalid credentials";
      throw error;
    }
    this.confirmEmail(user.id);
    user.isEmailConfirmed == true;
  }
  async loginExternal (user, password) {
    let error;
    let connected;
    const currentPassword = user.password.filter(
      (p) =>
        p.status === "active" && p.expireAt!.getTime() > new Date().getTime(),
    )[0];
    if (!currentPassword) {
      error = new Error("Password expired");
      error.statusCode = 403;
      throw error;
    }
    const match = await bcrypt.compare(password, currentPassword.password);
    if (!match) {
      error = new Error("Invalid credentials");
      throw error;
    }
    bcrypt.compare;
    connected = user;
    this.confirmEmail(user.id);
    user.isEmailConfirmed == true;
    return connected;
  }
  async createSession (id, token) {
    const now = new Date();
    const duration = new Date(now.setMonth(now.getHours() + 2));
    const payload = { token, userId: id, duration };
    return await this.repo.createSession(payload);
  }
  async logout (session) {
    console.log(session);
    return await this.repo.updateSession(session.id, { status: "expired" });
  }
  async confirmEmail (id: string) {
    return this.repo.update(id, { isEmailConfirmed: true });
  }
  kcConnect (payload: any) {
    return new Promise(async (resolve, reject) => {
      const sub = payload.sub;
      const email_verified: boolean = payload.email_verified;
      const preferred_username: string = payload.preferred_username;
      const email: string = payload.email;
      const token: string = payload.token;

      resolve(payload);
    }).catch((e: IErrorObject) => {
      return coddyger.catchReturn(e, "UserService", "kcConnect");
    });
  }
  setPassword (id: string, password: string) {
    return this.repo.setPassword(id, password);
  }
}
export default new UserService();
