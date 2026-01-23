import {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/users";
import { RequestBody, User } from "../../interfaces/users";
import { checkAuth, onlyadmin } from "../../helpers/auth";
import { KeycloakHelper } from "../../helpers";
import { logV2 } from "../../utils/audit";
import society from "../../services/society";
import { Society } from "@prisma/client";
import TokenRepository from "../../repository/token";
import users from "../../services/users";
import authorization from "../../utils/authorization";

const tags: string[] = ["User"];

const moduleName = "Utilisateurs";

const routes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {

  fastify.route({
    method: "POST",
    url: "/password",
    schema: {
      tags: ["User"],
      body: {
        type: "object",
        properties: {
          id: { type: "string" },
          password: { type: "string" },
        },
        required: ["id", "password"],
      },
    },
    handler: async (request: FastifyRequest<{ Body: { id?: string; password: string; }; }>, reply: FastifyReply) => {
      const id = request.body.id ? request.body.id : (request.user as { id: string, iat: number; }).id;
      const password: string = request.body.password;
      const result: any = await service.setPassword(id, password);
      await logV2("Mise à jour", "Utilisateurs", id, id, `Mise à jour du mot de passe de l'utilisateur`);
      return reply.status(200).send({ message: "Mots de passe mis à jour", data: result });
    },
  });

  fastify.route({
    method: "POST",
    url: "/kc-token",
    schema: {
      tags: ["Keycloak"],
      body: {
        type: "object",
        properties: {
          username: { type: "string" },
          password: { type: "string" },
        },
        required: ["username", "password"],
      },
    },
    handler: async (request: any, reply: FastifyReply) => {
      try {
        const username: string = request.body.username;
        const password: string = request.body.password;
        request.log.info({ username }, "kc-token start");
        const result: any = await KeycloakHelper.buildTokenFrontend(
          username,
          password,
        );
        request.log.info({ username, statusCode: result?.statusCode }, "kc-token done");
        await logV2("Authentification", "Keycloak", username, username, `Authentification de l'utilisateur ${username}`);
        return reply.status(result.statusCode).send(result);
      } catch (error: any) {
        request.log.error({ err: error }, "kc-token error");
        const status = error?.statusCode ?? 500;
        return reply.status(status).send({ message: error?.message || "Erreur interne" });
      }
    },
  });

  fastify.route({
    method: "POST",
    url: "/kc-verify",
    schema: {
      tags: ["Keycloak"],
      headers: {
        type: "object",
        properties: {
          authorization: { type: "string" },
        },
        required: ["authorization"],
      },
    },
    preHandler: KeycloakHelper.verify,
    handler: async (request: any, reply: FastifyReply) => {
      try {
        const user = request.user;
        console.log("ANTOU", user);
        if (!user) {
          return reply.status(401).send({ message: "User not found" });
        }
        if (user.status != "active") {
          return reply.status(403).send({ message: "User is disabled" });
        }

        const Q: any = await service.kcConnect(user);
        request.log.info({ userId: Q?.id, email: Q?.email }, "kc-verify connected");
        const token = await fastify.jwt.sign(
          {
            id: Q.id,
            email: Q.email,
            roles: Q.roles,
          },
          {
            expiresIn: "1h",
          },
        );

        Q.token = token;
        const arrayOfSocieties = await Promise.all(
          Q.societyId.map((id: string) => society.getOneLite(id)),
        );
        Q.societies = arrayOfSocieties;
        const audit_user = await users.getOne(Q.id);
        await logV2("Authentification", "Keycloak", Q.id, Q.id, `Authentification de l'utilisateur ${audit_user ? (audit_user.firstname + " " + audit_user.lastname) : "anonymous"}`);

        // Session Management Here
        const decoded = fastify.jwt.decode(token) as { exp: number; };
        const tokenRepo = new TokenRepository();
        request.log.info({ email: Q.email, exp: decoded?.exp }, "token register start");
        await tokenRepo.registerNew({
          token: token,
          userEmail: Q.email,
          expiry: new Date(decoded.exp * 1000),
        });
        request.log.info({ email: Q.email }, "token register done");

        return reply.status(200).send({ message: "Données utilisateur", data: Q });
      } catch (error: any) {
        request.log.error({ err: error }, "kc-verify error");
        const status = error?.statusCode ?? 500;
        return reply.status(status).send({ message: error?.message || "Erreur interne" });
      }
    },
  });

  fastify.route({
    method: "GET",
    url: "/",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await service.getAll();
      await logV2(
        "Consultation",
        "Utilisateurs",
        (request.user as any)?.id || "anonymous",
        "all",
        `Consultation de tous les utilisateurs`,
      );
      return reply
        .status(200)
        .send({ message: "Liste des utilisateurs", data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/:id",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const result = await service.getOne(request.params.id);
      await logV2(
        "Consultation",
        "Utilisateurs",
        (request.user as any).id,
        request.params.id,
        `Consultation de l'utilisateur ${result?.firstname || "__error__" + result?.lastname || "__error__"}`,
      );
      return reply
        .status(200)
        .send({ message: "Liste des utilisateurs", data: result });
    },
  });

  fastify.route({
    method: "POST",
    url: "/",
    schema: {
      tags,
      body: {
        type: "object",
        properties: {
          email: { type: "string" },
          profile: { type: "string" },
          lastname: { type: "string" },
          firstname: { type: "string" },
          matricule: { type: "string" },
          department: { type: "string" },
          college: { type: "string" },
          numeroFiche: { type: "string" },
          role: { type: "string" },
          profileId: { type: "string" },
          societyId: { type: "array" },
          partnerId: { type: "string" },
        },
        required: ["email", "profileId"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: RequestBody; }>,
      reply: FastifyReply,
    ) => {
      const AD_ROUTES = process.env.AD_DOMAINS?.split(",");
      console.log(AD_ROUTES);
      const internal = !!AD_ROUTES!.includes(request.body.email.split("@")[1]);
      request.body.groups = internal ? ["INTERNAL"] : ["EXTERNAL"];
      const auth = await authorization(
        request.user,
        internal ? "Utilisateurs interne" : "Utilisateurs externe",
        "create",
      );
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      console.log(request.body);
      try {
        const result = await service.create(request.body, internal, request.user as { id: string, iat: number; });
        if (result.statusCode) {
          await logV2(
            "Création",
            "Utilisateurs",
            (request.user as any).id,
            request.body.email,
            `Création de l'utilisateur ${request.body.email}`,
          );
          return reply
            .status(result.statusCode)
            .send({ message: result.message, data: result });
        }
        return reply
          .status(200)
          .send({ message: "logging d'utilisateur", data: result });
      } catch (error: any) {
        await logV2(
          "Création",
          "Utilisateurs",
          (request.user as any).id,
          request.body.email,
          `Création de l'utilisateur ${request.body.email}`,
        );
        return reply
          .status(409)
          .send({ message: error.message, data: error });
      }
    },
  });

  // SECURITY: Route désactivée - authentification via SSO Keycloak uniquement
  // fastify.route({
  //   method: "POST",
  //   url: "/login",
  //   schema: {
  //     tags,
  //     body: {
  //       type: "object",
  //       properties: {
  //         email: { type: "string" },
  //         password: { type: "string" },
  //       },
  //       required: ["email", "password"],
  //     },
  //   },
  //   handler: async (request: any, reply: FastifyReply) => {
  //     try {
  //       const { email, password } = request.body;
  //       request.log.info({ email }, "password login start");
  //       const userExists = await service.getwEmail(email);
  //       if (!userExists) {
  //         return reply.status(400).send({ message: "User not found", data: null });
  //       }
  //       if (userExists.status != "active") {
  //         return reply.status(403).send({ message: "User is disabled" });
  //       }
  //       const result = await service.login({ email, password });
  //       const token = fastify.jwt.sign({ id: result.id }, { expiresIn: '24h' });
  //       const decoded = fastify.jwt.decode(token) as { exp: number; };
  //       const tokenRepo = new TokenRepository();
  //       request.log.info({ email: result.email, exp: decoded?.exp }, "token register start");
  //       await tokenRepo.registerNew({
  //         token: token,
  //         userEmail: result.email,
  //         expiry: new Date(decoded.exp * 1000),
  //       });
  //       request.log.info({ email: result.email }, "token register done");
  //       const session: any = await service.createSession(result.id, token);
  //
  //       if (session.statusCode) {
  //         return reply
  //           .status(session.statusCode)
  //           .send({ message: session.message, data: session });
  //       }
  //       await logV2("Authentification", "Utilisateurs", result.id, result.id, `Authentification de l'utilisateur ${result?.firstname || "__error__" + result?.lastname || "__error__"}`);
  //       return reply
  //         .status(200)
  //         .send({ message: "logging d'utilisateur", data: session });
  //     } catch (error: any) {
  //       request.log.error({ err: error }, "password login error");
  //       const status = error?.statusCode ?? 500;
  //       return reply.status(status).send({ message: error?.message || "Erreur interne" });
  //     }
  //   }
  // });

  fastify.route({
    method: "PUT",
    url: "/:id",
    schema: {
      tags,
      body: {
        type: "object",
        properties: {
          email: { type: "string" },
          profile: { type: "string" },
          lastname: { type: "string" },
          firstname: { type: "string" },
          matricule: { type: "string" },
          department: { type: "string" },
          college: { type: "string" },
          numeroFiche: { type: "string" },
          role: { type: "string" },
          profileId: { type: "string" },
          societyId: { type: "array" },
          partnerId: { type: "string" },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: RequestBody; Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const target = await service.getOne(request.params.id);
      if (!target) return reply.status(404).send({ message: "Utilisateur non trouvé" });
      const AD_ROUTES = process.env.AD_DOMAINS?.split(",");
      console.log(AD_ROUTES);
      const internal = !!AD_ROUTES!.includes(target.email.split("@")[1]);
      const auth = await authorization(
        request.user,
        internal ? "Utilisateurs interne" : "Utilisateurs externe",
        "update",
      );
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result: any = await service.update(
        { id: request.params.id },
        { ...request.body, status: "active" },
      );
      if (result.statusCode) {
        await logV2(
          "Mise à jour",
          "Utilisateurs",
          (request.user as any).id,
          request.params.id,
          `Mise à jour échouée de l'utilisateur ${result?.firstname || "__error__" + result?.lastname || "__error__"}`,
        );
        return reply
          .status(result.statusCode)
          .send({ message: result.message, data: result });
      }
      await logV2(
        "Mise à jour",
        "Utilisateurs",
        (request.user as any).id,
        request.params.id,
        `Mise à jour de l'utilisateur ${result?.firstname || "__error__" + result?.lastname || "__error__"}`,
      );
      return reply
        .status(200)
        .send({ message: "logging d'utilisateur", data: result });
    },
  });
  fastify.route({
    method: "get",
    url: "/logout",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: { email: string; password: string; }; }>,
      reply: FastifyReply,
    ) => {
      const logout = await service.logout(request.user);
      await logV2(
        "Authentification",
        "Utilisateurs",
        (request.user as any).id,
        (request.user as any).id,
        `Déconnexion de l'utilisateur ${(request.user as any).id}`,
      );
      return reply.status(200).send({ message: "Vous avez été deconnecté", logout });
    },
  });
  fastify.route({
    method: "DELETE",
    url: "/:id",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const target = await service.getOne(request.params.id);
      if (!target) return reply.status(404).send({ message: "Utilisateur non trouvé" });
      const AD_ROUTES = process.env.AD_DOMAINS?.split(",");
      console.log(AD_ROUTES);
      const internal = !!AD_ROUTES!.includes(target.email.split("@")[1]);
      const auth = await authorization(
        request.user,
        internal ? "Utilisateurs interne" : "Utilisateurs externe",
        "delete",
      );
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      // console.log("logg id", request.params.id);
      const logout = await service.delete(request.params.id, request.user, false);
      await logV2(
        "Désactivation",
        "Utilisateurs",
        (request.user as any).id,
        request.params.id,
        `Désactivation de l'utilisateur ${logout?.firstname || "__error__" + logout?.lastname || "__error__"}`,
      );
      return reply.status(200).send({ message: "Vous avez été désactivé!", logout });
    },
  });
  fastify.route({
    method: "DELETE",
    url: "/hard/:id",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const target = await service.getOne(request.params.id);
      if (!target) return reply.status(404).send({ message: "Utilisateur non trouvé" });
      const AD_ROUTES = process.env.AD_DOMAINS?.split(",");
      console.log(AD_ROUTES);
      const internal = !!AD_ROUTES!.includes(target.email.split("@")[1]);
      const auth = await authorization(
        request.user,
        internal ? "Utilisateurs interne" : "Utilisateurs externe",
        "delete",
      );
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      console.log("logg id", request.params.id);
      const logout = await service.delete(request.params.id, request.user, true);
      await logV2(
        "Suppression",
        "Utilisateurs",
        (request.user as any).id,
        request.params.id,
        `Suppression de l'utilisateur ${logout?.firstname || "__error__" + logout?.lastname || "__error__"}`,
      );
      return reply.status(200).send({ message: "Vous avez été supprimé", logout });
    },
  });

  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (request: any, reply: FastifyReply) => {
      // const auth = await authorization(request.user, moduleName, "list");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.getAllPaginate(
        request.params.page,
        request.query.query,
      );
      await logV2(
        "Consultation",
        "Utilisateurs",
        (request.user as any).id,
        `page_${request.params.page}`,
        `Consultation de la liste des utilisateurs, page ${request.params.page}`,
      );
      return reply.status(200).send({
        message: `Liste des utilisateurs, page ${request.params.page}`,
        data: result,
      });
    },
  });
  fastify.route({
    method: "GET",
    url: "/external/:page",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (request: any, reply: FastifyReply) => {
      const type = "EXTERNAL";
      const auth = await authorization(request.user, "Utilisateurs externe", "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.getAllPaginate(
        request.params.page,
        type,
        request.query.query,
      );
      await logV2(
        "Consultation",
        "Utilisateurs",
        (request.user as any).id,
        `page_${request.params.page}`,
        `Consultation de la liste des utilisateurs externes, page ${request.params.page}`,
      );
      return reply.status(200).send({
        message: `Liste des utilisateurs, page ${request.params.page}`,
        data: result,
      });
    },
  });
  fastify.route({
    method: "GET",
    url: "/internal/:page",
    schema: { tags },
    preHandler: checkAuth,
    handler: async (request: any, reply: FastifyReply) => {
      try {
        console.log("🔍 USER API: GET /internal/:page called", request.params.page);
        const type = "INTERNAL";
        const auth = await authorization(request.user, "Utilisateurs interne", "list");
        if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });

        console.log("🔍 USER API: Calling service.getAllPaginate...");
        const result = await service.getAllPaginate(
          request.params.page,
          type,
          request.query.query,
        );
        console.log("🔍 USER API: Service returned result with", result.record?.length, "users");

        await logV2(
          "Consultation",
          "Utilisateurs",
          (request.user as any).id,
          `page_${request.params.page}`,
          `Consultation de la liste des utilisateurs internes, page ${request.params.page}`,
        );

        console.log("🔍 USER API: Sending response...");
        return reply.status(200).send({
          message: `Liste des utilisateurs, page ${request.params.page}`,
          data: result,
        });
      } catch (error: any) {
        console.error("🔴 ERROR in USER API /internal/:page:", error.message);
        console.error("🔴 ERROR stack:", error.stack);
        return reply.status(500).send({
          message: "Erreur lors de la récupération des utilisateurs",
          error: error.message,
        });
      }
    },
  });

  done();
};

export default routes;
