import { FastifyInstance, FastifyPluginCallback } from "fastify";
import testService from "../../services/test";

const testRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.get("/", {
    schema: {
      tags: ["Test"],
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
    handler: async (request, reply) => {
      const test = await testService.getAll();
      reply.status(200).send({ message: "Liste des utilisateurs", data: test });
    },
  });

  fastify.post("/", {
    schema: {
      tags: ["Test"],
      body: {
        type: "object",
        properties: {
          // Add properties here if needed
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
    handler: async (request, reply) => {
      const test = await testService.create("test");
      reply.status(200).send({ message: "Utilisateur créé", data: test });
    },
  });

  // Ajoute d'autres routes liées aux utilisateurs ici

  done();
};

export default testRoutes;
