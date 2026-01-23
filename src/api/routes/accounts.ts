import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/accounts";
import { AccountCreate, AccountUpdate } from "../../interfaces/accounts";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import authorization from "../../utils/authorization";

const moduleName = "Comptes";
const accountRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.route({
    method: "GET",
    url: "/internal/",
    schema: {
      tags: ["Accounts"],
      querystring: {
        type: "object",
        properties: {
          societe: { type: "string" },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Querystring: { societe?: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const userData = request.user as { id: string; iat: number; };
      const result = await service.getAllInternal(userData, request.query.societe);
      reply.status(200).send({ message: "Liste des comptes", data: result });
      await logV2("Recherche", moduleName, userData.id, request.query.societe, `Visionnage de la liste des comptes internes de ${request.query.societe || "toutes les sociétés"}.`);
    },
  });

  fastify.route({
    method: "GET",
    url: "/external/",
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const userData = request.user as { id: string, iat: number; };
      const result = await service.getMyExternal(userData);
      reply.status(200).send({ message: "Liste des comptes", data: result });
      await logV2("Recherche", moduleName, userData.id, "", "Visionnage de la liste des comptes externes.");
    },
  });

  fastify.route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Accounts"],
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          rib: { type: "string" },
          bankId: { type: "string" },
          partnerId: { type: "string" },
          societyId: { type: "string" },
        },
        required: ["name", "rib", "bankId", "societyId"],
        additionalProperties: false,
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: AccountCreate; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { name, rib, bankId, societyId, partnerId } = request.body;
      const userData = request.user as { id: string; iat: number; };
      const result = await service.create(userData, { name, rib, bankId, societyId, partnerId });
      await logV2("Création", moduleName, userData.id, result.id, `Compte ${name} | ${rib} créé.`);
      reply.status(200).send({ message: "Compte créé", data: result });
    },
  });
  fastify.route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Accounts"],
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.getAll();
      await logV2("Recherche", moduleName, (request.user as any).id, "all", "Visionnage de la liste des comptes.");
      reply.status(200).send({ message: "Liste des comptes", data: result });
    },
  });
  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Accounts"],
    },
    preHandler: checkAuth,
    handler: async (request: any, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const userData = request.user as any;
      const result = await service.getAllPaginate(
        userData,
        request.params.page,
        request.query.query,
      );
      await logV2(
        "Recherche",
        "Comptes",
        userData.id,
        "all",
        `Visionnage de la liste des comptes (page ${request.params.page}).`,
      );
      reply
        .status(200)
        .send({ message: "Liste paginée des comptes", data: result });
    },
  });
  fastify.route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["Accounts"],
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.getOne(request.params.id);
      await logV2(
        "Consultation",
        "Comptes",
        (request.user as any).id,
        request.params.id,
        `Visionnage du compte ${result?.name || "__error__"} | ${result?.rib || "__error__"}.`,
      );
      reply
        .status(200)
        .send({ message: `Compte n°${request.params.id}`, data: result });
    },
  });
  fastify.route({
    method: "PUT",
    url: "/:id",
    schema: {
      tags: ["Accounts"],
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          rib: { type: "string" },
          bankId: { type: "string" },
          partnerId: { type: "string" },
          societyid: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; Body: AccountUpdate; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.update(request.params.id, request.body);
      await logV2(
        "Mise à jour",
        "Comptes",
        (request.user as any).id,
        request.params.id,
        `Mise à jour du compte n°${result?.name || "__error__"} | ${result?.rib || "__error__"}.`,
      );
      reply.status(200).send({ message: "Compte mis à jour", data: result });
    },
  });
  fastify.route({
    method: "DELETE",
    url: "/:id",
    schema: {
      tags: ["Accounts"],
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "delete");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.delete(request.params.id);
      await logV2(
        "Désactivation",
        moduleName,
        (request.user as any).id,
        request.params.id,
        `Désactivation du compte ${result?.name || "__error__"} | ${result?.rib || "__error__"}.`,
      );
      reply.status(200).send({ message: "Compte désactivé.", data: result });
    },
  });
  fastify.route({
    method: "DELETE",
    url: "/hard/:id",
    schema: {
      tags: ["Accounts"],
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "delete");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.delete(request.params.id, true);
      await logV2(
        "Suppression",
        moduleName,
        (request.user as any).id,
        request.params.id,
        `Suppression du compte ${result?.name || "__error__"} | ${result?.rib || "__error__"}.`,
      );
      reply.status(200).send({ message: "Compte supprimé", data: result });
    },
  });
  done();
};
export default accountRoutes;
