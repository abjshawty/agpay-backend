import coddyger, { AxiosService, defines } from "coddyger";
import locale from "../data/locale";
import UserRepository from "../repository/users";
const userRepo = new UserRepository();

const axios = AxiosService.connect(process.env.KC_URI!);
const config: any = {
  realm: process.env.KC_REALM,
  clientId: process.env.KC_CLIENTID,
  admin: process.env.KC_ADMIN,
  adminUsername: process.env.KC_ADMIN_USERNAME,
  adminPassword: process.env.KC_ADMIN_PASSWORD,
  adminCli: process.env.KC_ADMIN_CLI,
  password: process.env.KC_ADMIN_PASSWORD,
  clientSecret: process.env.KC_CLIENT_SECRET,
  clientSub: process.env.KC_CLIENT_SUB,
};

export class KeycloakHelper {
  static buildTokenFrontend (username: string, password: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const form = new URLSearchParams();

        form.append("username", username);
        form.append("password", password);
        form.append("grant_type", "password");
        form.append("client_id", config.clientId);
        form.append("client_secret", config.clientSecret);

        const data: any = await axios.post(
          `realms/${config.realm}/protocol/openid-connect/token`,
          form,
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );
        console.log(data.data);
        resolve({
          statusCode: 200,
          message: "SUCCEED",
          data: data.data.access_token,
        });
      } catch (error: any) {
        console.log("error occured", error.message);
        let customError: any = new Error(error.message);
        customError.statusCode = error.response.status;
        reject(customError);
      }
    });
  }
  static createUser (payload: any) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await this.AdminToken();
        const response = await axios.post(
          `admin/realms/${config.realm}/users`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        let data: any = response.data;
        resolve(response.headers.location);
      } catch (error: any) {
        if (!error.hasOwnProperty("statusCode")) {
          console.clear();
          console.info("statusCode defini est ", error.response.status);
          error.statusCode = error.response.status;
        }
        error.message = error.response.data.errorMessage;
        if (error.response.status.toString() === "409") {
          // const user = await userRepo.getuserByEmailKc(payload.email);
          const user = await this.getUserIdByEmail(payload.email);
          console.warn("User already exists in this tonka", payload.email, user);
          resolve({ error, message: "User already exists in this tonka", id: user });
        };
        // reject(error);
      }
    });
  }
  static updateUser (userId: string, payload: any) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await this.AdminToken();
        console.log("Keycloak userId", userId);

        const response = await axios.put(
          `admin/realms/${config.realm}/users/${userId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        resolve(response.data);
      } catch (error: any) {
        if (!error.hasOwnProperty("statusCode")) {
          error.statusCode = 500;
        }
        error.message =
          error.response?.data?.errorMessage ||
          "An error occurred while updating the user";
        reject(error);
      }
    });
  }
  static executeUserAction (actionUrl: string, actions: string[]) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await this.AdminToken();

        const response = await axios.put(actionUrl, actions, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        resolve(response.data);
      } catch (error: any) {
        if (!error.hasOwnProperty("statusCode")) {
          error.statusCode = 500;
        }
        error.message =
          error.response?.data?.errorMessage ||
          "An error occurred while executing user action";
        reject(error);
      }
    });
  }
  static executeKCGetQuery (actionUrl: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await this.AdminToken();

        const response = await axios.get(actionUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        resolve(response.data);
      } catch (error: any) {
        if (!error.hasOwnProperty("statusCode")) {
          error.statusCode = 500;
        }
        error.message =
          error.response?.data?.errorMessage ||
          "An error occurred while executing user action";
        reject(error);
      }
    });
  }
  static AdminToken () {
    return new Promise(async (resolve, reject) => {
      const form = new URLSearchParams();

      form.append("username", config.adminUsername);
      form.append("password", config.adminPassword);
      console.log(config.adminUsername, config.adminPassword);
      form.append("grant_type", "password");
      form.append("client_id", config.adminCli);

      axios
        .post(`realms/${config.realm}/protocol/openid-connect/token`, form, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
        .then(async (response: any) => {
          let data: any = response.data;
          resolve(data.access_token);
        })
        .catch((error: any) => {
          if (!error.hasOwnProperty("statusCode")) {
            error.statusCode = 500;
          }
          console.log("erreur icii", error);
          reject(error);
        });
    });
  }
  static buildToken () {
    return new Promise(async (resolve, reject) => {
      const form = new URLSearchParams();

      form.append("username", config.admin);
      form.append("password", config.password);
      form.append("grant_type", "password");
      form.append("client_id", config.clientId);
      form.append("client_secret", config.clientSecret);

      axios
        .post(`realms/${config.realm}/protocol/openid-connect/token`, form, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
        .then(async (response: any) => {
          let data: any = response.data;

          resolve(data.access_token);
        })
        .catch((error: any) => {
          reject(error);
        });
    }).catch((error: any) => {
      return { error: true, data: error };
    });
  }

  static assignRole (payload: { id: string; roles: Array<any>; }) {
    return new Promise(async (resolve, reject) => {
      const token = await this.buildToken();

      axios
        .post(
          `admin/realms/${config.realm}/users/${payload.id}/role-mappings/${config.clientSub}`,
          payload.roles,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )
        .then(async (response: any) => {
          let data: any = response.data;

          resolve(data);
        })
        .catch((error: any) => {
          if (error.response.status === 409) {
            resolve({
              warning: true,
              message: error.response.data.errorMessage,
            });
          } else {
            reject(error.response);
          }
        });
    }).catch((error: any) => {
      return { error: true, data: error };
    });
  }

  static verify (req: any, res: any, done: any) {
    return new Promise(async (resolve, reject) => {
      let token: string = req.headers.authorization;

      axios
        .post(
          `realms/${process.env.KC_REALM}/protocol/openid-connect/userinfo`,
          {},
          {
            headers: {
              Authorization: token,
            },
          },
        )
        .then(async (response: any) => {
          let data: any = response.data;
          data.token = token.replace("Bearer ", "");
          const user = await userRepo.getuserByEmailKc(data.email);

          // Utilisateur non enregistré dans l'application
          if (!user) {
            reject({
              status: defines.status.authError,
              message: "Utilisateur non enregistré dans l'application",
              code: "USER_NOT_REGISTERED",
              data: null,
            });
            return;
          }

          // Compte utilisateur supprimé/désactivé
          if (user.status === "deleted") {
            reject({
              status: defines.status.authError,
              message: "Votre compte est désactivé",
              code: "USER_DELETED",
              data: null,
            });
            return;
          }

          const updatedUser = await userRepo.update(user.id as string, {
            firstname: data.family_name,
            lastname: data.given_name,
            keycloakId: data.sub,
          });
          req.user = { ...updatedUser, token: data.token };
          resolve({
            status: defines.status.requestOK,
            message: locale.user.connected,
            user,
          });

          done();
        })
        .catch((error: any) => {
          console.log(error);
          return coddyger.api(
            res,
            new Promise((resolve) => {
              resolve({
                status: defines.status.authError,
                message: "Votre session a expiré",
                data: null,
              });
            }),
          );
        });
    }).catch((err: any) => {
      return { error: true, data: err };
    });
  }

  static logout (req: any, res: any, next: any) {
    return new Promise(async (resolve, reject) => {
      let token: string = req.headers.authorization;

      const data = {
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
      };

      axios
        .post(`realms/${config.realm}/protocol/openid-connect/logout`, data, {
          headers: {
            Authorization: token,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
        .then(async (response: any) => {
          let data = response.data;

          resolve({ status: defines.status.requestOK, message: "Ok", data });
          req.user = data;

          next();
        })
        .catch((error: any) => {
          return coddyger.api(
            res,
            new Promise((resolve) => {
              resolve({
                status: error.status || defines.status.authError,
                message: defines.message.tryCatch,
                data: null,
              });
            }),
          );
        });
    }).catch((err: any) => {
      return { error: true, data: err };
    });
  }

  static roles () {
    return new Promise(async (resolve, reject) => {
      const token = await this.buildToken();

      axios
        .get(
          `admin/realms/${process.env.KC_REALM}/clients/${config.clientSub}/roles`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        .then(async (response: any) => {
          let data = response.data;

          resolve(data);
        })
        .catch((error: any) => {
          reject(error.response);
        });
    }).catch((err: any) => {
      return { error: true, data: err };
    });
  }

  static setUserPassword (payload: { id?: string; password: string; newUser: boolean; }) {
    console.log("User Password Setting: ", payload);
    if (!payload.id) {
      console.log("Payload that's missing ID: ", payload);
      const error: any = new Error("User ID is required");
      error.statusCode = 400;
      throw error;
    }
    return new Promise(async (resolve, reject) => {
      const token = await this.buildToken();

      axios
        .put(
          `admin/realms/${config.realm}/users/${payload.id}/reset-password`,
          JSON.stringify({
            type: "password",
            value: payload.password,
            temporary: payload.newUser,
          }),
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )
        .then(async (response: any) => {
          let data = response.data;
          console.log("password reset!");
          resolve(data);
        })
        .catch((error: any) => {
          reject(error.response);
        });
    }).catch((err: any) => {
      return { error: true, data: err };
    });
  }

  static async getUserIdByEmail (email: string): Promise<string> {
    const token = await this.AdminToken();
    const response = await fetch(`${process.env.KC_URI}/admin/realms/${process.env.KC_REALM}/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const users = await response.json();
    if (users.length > 0) {
      return users[0].id; // Return the first matching user's ID
    } else {
      throw new Error('User not found');
    }
  }

  static async disable (email: string): Promise<void> {
    const token = await this.AdminToken();
    const userId = this.getUserIdByEmail(email);
    try {
      console.log("Disabling...");
      const response = await fetch(`${process.env.KC_URI}/admin/realms/${process.env.KC_REALM}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: false
        })
      });
      console.log("Disabled.");

      if (response) {
        console.log(response);
        return;
      } else {
        throw new Error("Impossible to disable");
      }
    } catch (e) {
      console.error("damn", e);
    }
  }

}
