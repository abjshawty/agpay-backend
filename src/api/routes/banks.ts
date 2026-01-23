import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import bankService from "../../services/banks";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import { RequestBody } from "../../interfaces/banks";
import authorization from "../../utils/authorization";
const createBankSchema = {
  tags: ["Banks"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      code: { type: "string" },
    },
    required: ["name", "code"],
    additionalProperties: false,
  },
};

const updateBankSchema = {
  tags: ["Banks"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      code: { type: "string" },
      status: { type: "string" },
    },
    additionalProperties: false,
  },
};
const moduleName = "Banques";
const bankRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.route({
    method: "POST",
    schema: createBankSchema,
    url: "/",
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: { name: string; code: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      // @ts-ignore
      const banks = await bankService.create({
        name: request.body.name,
        code: request.body.code,
      }, (request.user as any).id);
      await logV2(
        "Création",
        moduleName,
        (request.user as any).id,
        banks.id,
        `Création de la banque ${banks.name}`,
      );
      reply.status(200).send({ message: "Banque créée", data: banks });
    },
  });

  fastify.route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["Banks"],
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
      // @ts-ignore
      const banks = await bankService.getOne(request.params.id);
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any)?.id || "anonymous",
        banks!.id,
        `Consultation de la banque ${banks!.name}`,
      );
      reply.status(200).send({ message: "Banque récupérée", data: banks });
    },
  });

  fastify.route({
    method: "PUT",
    schema: updateBankSchema,
    url: "/:id",
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }, Body: RequestBody; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      // @ts-ignore
      const banks: any = await bankService.update(
        request.params.id,
        request.body,
      );
      if (banks.statusCode)
        return reply
          .status(banks.statusCode)
          .send({ message: banks.message, data: banks });
      await logV2(
        "Mise à jour",
        moduleName,
        (request.user as any)?.id || "anonymous",
        banks!.id,
        `Mise à jour de la banque ${banks!.name}`,
      );
      reply.status(200).send({ message: "Banque modifiée", data: banks });
    },
  });

  fastify.route({
    method: "DELETE",
    url: "/:id",
    schema: {
      tags: ["Banks"],
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
      try {
        const auth = await authorization(request.user, moduleName, "delete");
        if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
        // @ts-ignore
        const banks = await bankService.delete(request.params.id);
        await logV2(
          "Suppression",
          moduleName,
          (request.user as any)?.id || "anonymous",
          banks!.id,
          `Suppression de la banque ${banks!.name}`,
        );
        reply.status(200).send({ message: "Banque supprimée", data: banks });
      } catch (error: any) {
        if (!error.hasOwnProperty("statusCode")) {
          error.statusCode = 500;
        }
        reply.status(error.statusCode).send({ message: error.message, data: error });
      }
    }
  });

  fastify.get("/", {
    schema: {
      tags: ["Banks"],
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const banks = await bankService.getAll();
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any)?.id || "anonymous",
        "all",
        `Consultation de la liste des banques`,
      );
      reply.status(200).send({ message: "Liste des banques", data: banks });
    },
  });

  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Banks"],
    },
    preHandler: checkAuth,
    handler: async (request: any, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await bankService.getAllPaginate(
        request.params.page,
        request.query.query,
      );
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any)?.id || "anonymous",
        `page_${request.params.page}`,
        `Consultation de la liste des banques, page ${request.params.page}`,
      );
      reply.status(200).send({
        message: `Liste des banques, page ${request.params.page}`,
        data: result,
      });
    },
  });

  done();
};

export default bankRoutes;
