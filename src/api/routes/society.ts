import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/society";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import authorization from "../../utils/authorization";

const createSocietySchema = {
  tags: ["Society"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      codeSociety: { type: "string" },
      userId: {
        type: "array",
        items: { type: "string" },
        minItems: 0,
      }, // Champ optionnel
      status: { type: "string" },
    },
    required: ["name", "codeSociety"],
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
};
const updateSocietySchema = {
  tags: ["Society"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      codeSociety: { type: "string" },
      userId: {
        type: "array",
        items: { type: "string" },
        minItems: 0,
      }, // Champ optionnel
      status: { type: "string" },
    },
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
};
const moduleName = "Sociétés";
const societyRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.route({
    method: "post",
    schema: createSocietySchema,
    url: "/",
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      // @ts-ignore
      const user: { id: string; iat: number; } = await request.jwtDecode();
      const record = await service.create(request.body, user.id);
      await logV2(
        "Création",
        moduleName,
        (request.user as any).id,
        record.id,
        `Création de la société ${record.name}`,
      );
      reply
        .status(201)
        .send({ message: "Société créée avec succès", data: user });
    },
  });
  fastify.route({
    method: "get",
    url: "/:id",
    schema: {
      tags: ["Society"],
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
      try {
        const record = await service.getOne(request.params.id);
        // console.log("record routes ", record);
        if (!record) {
          reply
            .status(404)
            .send({ message: "Société non trouvée", data: null });
        } else {
          await logV2(
            "Consultation",
            moduleName,
            (request.user as any).id,
            request.params.id,
            `Consultation de la société ${record.name}`,
          );
          reply
            .status(200)
            .send({ message: "Société récupérée", data: record });
        }
      } catch (error) {
        console.error("Erreur lors de la récupération de la société:", error);
        reply.status(500).send({ message: "Erreur serveur", data: null });
      }
    },
  });
  fastify.route({
    method: "get",
    url: "/lite/:id",
    schema: {
      tags: ["Society"],
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
      try {
        const record = await service.getOneLite(request.params.id);
        if (!record) {
          reply
            .status(404)
            .send({ message: "Société non trouvée", data: null });
        } else {
          await logV2(
            "Consultation",
            moduleName,
            (request.user as any).id,
            request.params.id,
            `Consultation de la société ${record.name}`,
          );
          reply
            .status(200)
            .send({ message: "Société récupérée", data: record });
        }
      } catch (error) {
        console.error("Erreur lors de la récupération de la société:", error);
        reply.status(500).send({ message: "Erreur serveur", data: null });
      }
    },
  });
  fastify.route({
    method: "put",
    schema: updateSocietySchema,
    url: "/:id",
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      // @ts-ignore
      const record = await service.update(request.params.id, request.body);
      await logV2(
        "Mise à jour",
        moduleName,
        (request.user as any).id,
        request.params.id,
        `Mise à jour de la société ${record.name}`,
      );
      reply.status(200).send({ message: "Société mis à jours", data: record });
    },
  });
  fastify.get("/", {
    schema: {
      tags: ["Society"],
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const record = await service.getAll();
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any).id,
        "all",
        `Consultation de la liste des sociétés`,
      );
      reply.status(200).send({ message: "Liste des Sociétés", data: record });
    },
  });
  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Society"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string", maxLength: 100 },
          itemsPerPage: { type: "integer", default: 10, minimum: 1, maximum: 100 },
        },
        additionalProperties: false
      },
      params: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
        required: ["page"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Params: { page: number; };
        Querystring: { query?: string; itemsPerPage?: number; };
      }>,
      reply: FastifyReply,
    ) => {
      // const auth = await authorization(request.user, moduleName, "list");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      try {
        const { page } = request.params;
        const result = await service.getAllPaginate(page, request.query.query, request.query.itemsPerPage);
        logV2(
          "Consultation",
          moduleName,
          (request.user as any).id,
          `page_${page}`,
          `Consultation de la liste des sociétés, page ${page}`,
        );
        reply.status(200).send({
          message: `Liste des sociétés, page ${page}`,
          data: result,
        });
      } catch (error: any) {
        console.error("Error fetching paginated societies:", error);
        reply.status(error.statusCode || 500).send({
          message:
            error.message ||
            "An error occurred while fetching paginated societies",
          error: error.statusCode ? error.message : "Internal Server Error",
        });
      }
    },
  });
  fastify.route({
    method: "delete",
    url: "/:id",
    schema: {
      tags: ["Society"],
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
      try {
        // @ts-ignore
        const record = await service.delete(request.params.id);
        await logV2(
          "Suppression",
          moduleName,
          (request.user as any).id,
          request.params.id,
          `Suppression de la société ${record.name}`,
        );
        reply.status(200).send({ message: "Société supprimée", data: record });
      } catch (error: any) {
        console.error("Error deleting society:", error);
        reply.status(error.statusCode || 500).send({
          message:
            error.message ||
            "An error occurred while deleting the society",
          error: error.statusCode ? error.message : "Internal Server Error",
        });
      }
    }
  });

  done();
};

export default societyRoutes;
