import {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/partners";
import { PartnerInterface, RequestBody } from "../../interfaces/partners";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import { User } from "@prisma/client";
import authorization from "../../utils/authorization";

const schema = {
  tags: ["Partners"],
  body: {
    type: "object",
    properties: {
      accounts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            rib: { type: "string" },
          },
        },
      },
      id: { type: "string" },
      name: { type: "string" },
      code: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            idSociety: { type: "string" },
            idPartner: { type: "string" },
          },
        },
      },
      logo: { type: "string" },
      color: { type: "string" },
      userId: {
        type: "array",
        items: { type: "string" },
      },
      adress: {
        type: "object",
        properties: {
          mail: { type: "string" },
          phone: { type: "string" },
        },
      },
      status: { type: "string" },
    },
  },
};

const schemaNoId = {
  tags: ["Partners"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      code: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            idSociety: { type: "string" },
            idPartner: { type: "string" },
          },
        },
      },
      logo: { type: "string" },
      color: { type: "string" },
      userId: {
        type: "array",
        items: { type: "string" },
      },
      adress: {
        type: "object",
        // required: ["mail"],
        properties: {
          mail: { type: "string", },
          phone: { type: "string" },
        },
      },
      status: { type: "string" },
    },
    required: ["name", "code", "color", "adress"],
  },
};

const moduleName = "Partenaires";

const routes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.get("/", {
    schema: {
      tags: ["Partners"],
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
        `Consultation de la liste des partenaires`,
      );
      reply
        .status(200)
        .send({ message: "Liste des partenaires", data: result });
    },
  });

  fastify.route({
    method: "GET",
    schema: {
      tags: ["Partners"],
    },
    url: "/:id",
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await service.getOne({ id: request.params.id });
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any).id,
        request.params.id,
        `Consultation du partenaire ${result?.name || "__error__"}`,
      );
      reply
        .status(200)
        .send({ message: `Partenaire n°${request.params.id}`, data: result });
    },
  });

  fastify.route({
    method: "POST",
    url: "/",
    schema: schemaNoId,
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: RequestBody; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const listOfCodes: string[] = [];
      for (const codes of request.body.code) {
        if (listOfCodes.includes(codes.code) && codes.code !== "") {
          reply.status(400).send({ message: "Code dupliqué" });
          return;
        }
        listOfCodes.push(codes.code);
      }
      request.body.code = request.body.code.filter((code: any) => code.code !== "");
      const result = await service.create(request.body, (request.user as { id: string, iat: string; }).id);
      await logV2(
        "Création",
        moduleName,
        (request.user as any).id,
        result.id,
        `Création du partenaire ${result?.name || "__error__"}`,
      );
      reply.status(200).send({ message: "Partenaire créé", data: result });
    },
  });

  fastify.route({
    method: "PUT",
    url: "/:id",
    schema,
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Params: { id: string; };
        Body: PartnerInterface;
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const banks = await service.update(request.params.id, request.body);
      await logV2(
        "Mise à jour",
        moduleName,
        (request.user as any).id,
        request.params.id,
        banks.result ? `Mise à jour du partenaire ${banks.result.name || "__error__"}` : `Echec de mise à jour`,
      );
      reply.status(banks.statusCode).send({ message: banks.message, data: banks.result });
    },
  });

  fastify.route({
    method: "DELETE",
    url: "/:id",
    schema: {
      tags: ["Partners"],
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
      const result = await service.deleteOne(request.params.id);
      await logV2(
        "Suppression",
        moduleName,
        (request.user as any).id,
        request.params.id,
        `Suppression du partenaire ${result.name || "__error__"}`,
      );
      reply.status(200).send({ message: "Partenaire supprimé", data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Partners"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
          status: { type: "string" },
          createdFrom: { type: "string", format: "date-time" },
          createdTo: { type: "string", format: "date-time" },
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
        Querystring: {
          query?: string;
          name?: string;
          code?: string;
          status?: string;
          createdFrom?: string;
          createdTo?: string;
          itemsPerPage?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { page } = request.params;
      const { itemsPerPage = 10, ...filters } = request.query;
      const result = await service.getAllPaginate(
        Number(page),
        Number(itemsPerPage),
        filters,
      );
      await logV2(
        "Consultation",
        moduleName,
        (request.user as any).id,
        `page_${page}`,
        `Consultation de la liste des partenaires, page ${page}`,
      );
      reply.status(200).send({
        message: `Liste des partenaires, page ${page}`,
        data: result,
      });
    },
  });

  done();
};

export default routes;
