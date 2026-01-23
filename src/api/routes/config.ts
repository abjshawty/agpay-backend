import {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginCallback,
} from "fastify";
import service from "../../services/config";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";

const tags: string[] = ["Config"];

const routes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.route({
    method: "POST",
    url: "/",
    schema: {
      tags,
      body: {
        type: "object",
        properties: {
          inactivity: { type: "number" },
          accountDormancy: { type: "number" },
        },
        required: ["inactivity", "accountDormancy"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Body: { inactivity: number; accountDormancy: number; };
      }>,
      reply: FastifyReply,
    ) => {
      const result = await service.saveConfig(request.body);
      await logV2(
        "Création",
        "Paramètres",
        (request.user as any).id,
        result.id,
        `Création/Mise à jour de la configuration`,
      );
      reply
        .status(200)
        .send({ message: "Configuration sauvegardée", data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/",
    schema: {
      tags,
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await service.getConfig();
      // await logV2(
      //   "Consultation",
      //   "Paramètres",
      //   (request.user as any).id,
      //   "all",
      //   `Consultation de la configuration`,
      // );
      reply
        .status(200)
        .send({ message: "Configuration récupérée", data: result });
    },
  });

  fastify.route({
    method: "PUT",
    url: "/",
    schema: {
      tags,
      body: {
        type: "object",
        properties: {
          inactivity: { type: "number" },
          accountDormancy: { type: "number" },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Body: { inactivity?: number; accountDormancy?: number; };
      }>,
      reply: FastifyReply,
    ) => {
      const result = await service.updateConfig(request.body);
      await logV2(
        "Mise à jour",
        "Paramètres",
        (request.user as any).id,
        result.id,
        `Création/Mise à jour de la configuration`,
      );
      reply
        .status(200)
        .send({ message: "Configuration mise à jour", data: result });
    },
  });
  done();
};

export default routes;
