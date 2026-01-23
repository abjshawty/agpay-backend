import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/files";
import { RequestBody } from "../../interfaces/profils";
import { checkAuth } from "../../helpers/auth";

const routes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.get("/", {
    schema: {
      tags: ["Files"],
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
    preHandler: checkAuth, // Ajout de la vérification d'authentification
    handler: async (request, reply) => {
      const result = await service.getAll();
      reply.status(200).send({ message: "Liste des fichiers", data: result });
    },
  });

  fastify.route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Files"],
      consumes: ["multipart/form-data"],
      body: {
        type: "object",
        properties: {
          file: {
            type: "array",
            items: {
              type: "object",
              properties: {
                filename: { type: "string" },
                encoding: { type: "string" },
                mimetype: { type: "string" },
                buffer: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
    },
    preHandler: (request: any, reply: FastifyReply, done) => {
      const file = request.body.file[0];
      const match = file.filename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
      const extension = match ? match[1].toLowerCase() : "";

      // Vérifier l'extension du fichier
      if (
        ["jpeg", "jpg", "png", "pdf", "doc", "docx", "xlsx"].includes(extension)
      ) {
        done();
      } else {
        reply
          .status(403)
          .send({ status: "error", message: "type de fichier non authorisé" });
      }
    },
    handler: async (request: any, reply: FastifyReply) => {
      const file = request.body.file[0];
      const result = await service.create(file);
      reply.status(200).send({ message: "Fichier créé", data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["Files"],
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string; }; }>,
      reply: FastifyReply,
    ) => {
      const file = request.params.id;
      const result = await service.getOne(file);
      reply.status(200).send(result);
    },
  });

  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Files"],
    },
    handler: async (
      request: FastifyRequest<{ Params: { page: number; }; }>,
      reply: FastifyReply,
    ) => {
      const result = await service.getAllPaginate(request.params.page);
      reply.status(200).send({
        message: `Liste des fichiers, page ${request.params.page}`,
        data: result,
      });
    },
  });

  done();
};

export default routes;
