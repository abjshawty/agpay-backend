import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/profils";
import { RequestBody } from "../../interfaces/profils";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import users from "../../services/users";
import authorization from "../../utils/authorization";

const createProfils = {
  tags: ["Profils"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      features: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            auth: {
              type: "object",
              properties: {
                cancreate: { type: "boolean" },
                canupdate: { type: "boolean" },
                canprint: { type: "boolean" },
                canlist: { type: "boolean" },
                candelete: { type: "boolean" },
              },
            },
            description: { type: "string" },
          },
          required: ["name", "auth"],
          additionalProperties: true,
        },
      },
      type: { type: "string" }
    },
    required: ["name", "features", "type"],
    additionalProperties: false,
  },
};

const updateProfils = {
  tags: ["Profils"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      features: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            auth: {
              type: "object",
              properties: {
                cancreate: { type: "boolean" },
                canupdate: { type: "boolean" },
                canprint: { type: "boolean" },
                canlist: { type: "boolean" },
                candelete: { type: "boolean" },
              },
            },
            description: { type: "string" },
          },
          required: ["name", "auth"],
          additionalProperties: true,
        },
      },
      type: { type: "string" }
    },
    required: ["features", "type"],
    additionalProperties: false,
  },
};

const moduleName = 'Profils';
const routes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.get("/", {
    schema: {
      tags: ["Profils"],
    },
    preHandler: checkAuth,
    handler: async (request, reply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.getAll();
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any).id,
        "all",
        `Consultation de la liste des profils`,
      );
      reply.status(200).send({ message: "Liste des profils", data: result });
    },
  });
  fastify.route({
    method: "POST",
    url: "/",
    schema: createProfils,
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: RequestBody; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const data: RequestBody = request.body;
      const user = (request.user as { id: string, iat: number; });
      const result = await service.create(data, user.id);
      await logV2(
        "Création",
        moduleName,
        (request.user as any).id,
        result.id,
        `Création du profil ${result.name}`,
      );
      reply.status(200).send({ message: "Profil créé", data: result });
    },
  });
  fastify.route({
    method: "PUT",
    url: "/:id",
    schema: updateProfils,
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: RequestBody; Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const data: RequestBody = request.body;
      const id = request.params.id;
      const user = await users.getOne((request.user as { id: string; }).id);
      if (user?.profileId == id) return reply.status(403).send({ message: "Vous ne pouvez pas modifier votre propre profil!" });
      const result = await service.update(id, data);
      await logV2(
        "Mise à jour",
        moduleName,
        (request.user as any).id,
        id,
        `Mise à jour du profil ${result?.name || "__error__"}`,
      );
      reply.status(200).send({ message: "Profil mis à jour", data: result });
    },
  });
  fastify.route({
    method: "DELETE",
    url: "/:id",
    schema: {
      tags: ["Profils"],
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
      const auth = await authorization(request.user, moduleName, "delete");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const id = request.params.id;
      console.log(id);
      const result = await service.delete(id);
      await logV2(
        "Suppression",
        moduleName,
        (request.user as any).id,
        id,
        `Suppression du profil ${result?.name || "__error__"}`,
      );
      reply.status(200).send({ message: "Profil supprimé", data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/type/:type",
    schema: {
      tags: ["Profils"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string" },
          itemsPerPage: { type: "integer", default: 10 },
        },
      },
      params: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
        },
        required: ["type"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Params: { type: string; };
        Querystring: { query?: string; itemsPerPage?: number; };
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const type = request.params.type.toUpperCase();
      if (type != "INTERNAL" && type != "EXTERNAL") {
        return reply.status(400).send({ message: "Type is required" });
      }
      const { query, itemsPerPage = 10 } = request.query;
      const result = await service.getType(type, query);
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any).id,
        `type_${type}`,
        `Consultation des profils, type: ${type}`,
      );
      reply.status(200).send({
        message: `Liste des profils, type: ${type}`,
        data: result,
      });
    },
  });

  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Profils"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string" },
          itemsPerPage: { type: "integer", default: 10 },
        },
      },
      params: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
        },
        required: ["page"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Params: { page: number; };
        Querystring: { query?: string; itemsPerPage?: number, type?: string; };
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { page } = request.params;
      const { query, itemsPerPage = 10, type } = request.query;
      const result = await service.getAllPaginate(page, query, type);
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any).id,
        `page_${page}`,
        `Consultation des profils, page ${page}`,
      );
      reply.status(200).send({
        message: `Liste des profils, page ${page}`,
        data: result,
      });
    },
  });
  fastify.get("/:id", {
    schema: {
      tags: ["Profils"],
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
        moduleName,
        (request.user as any).id,
        request.params.id,
        `Consultation du profil ${result?.name || "__error__"}`,
      );
      reply.status(200).send({ message: "Détails du profil", data: result });
    },
  });

  done();
};

export default routes;
