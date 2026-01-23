import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import service from "../../services/rtj";
import { exportRTJs } from "../../services/export";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import users from "../../services/users";
import authorization from "../../utils/authorization";

const moduleName = "DFC";
const schema = {
  tags: ["RTJ"],
  body: {
    type: "object",
    properties: {
      date: { type: "string", format: "date-time" },
    },
    required: ["date"],
    additionalProperties: false,
  },
};

const routes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  options,
  done,
) => {

  fastify.route({
    method: "GET",
    url: "/export/:format",
    schema: {
      tags: ["RTJ"],
      params: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["csv", "excel", "pdf"] },
        },
        required: ["format"],
      },
      querystring: {
        type: "object",
        properties: {
          societe: { type: "string" },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
        },
        required: ["societe"],
      },
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest<{
      Params: {
        format: "csv" | "excel" | "pdf";
      },
      Querystring: {
        societe: string;
        dateFrom: string;
        dateTo: string;
      };
    }>, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "print");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const userData = await users.getOne((request.user as { id: string; }).id);
      if (!userData) return reply.status(404).send({ message: "User Not Found" });

      const { format } = request.params;
      const { societe, dateFrom, dateTo } = request.query;
      try {
        const result = await exportRTJs(
          format,
          reply,
          societe,
          dateFrom,
          dateTo,
          userData.partnerId ? userData.partnerId : undefined
        );
        let contentType: string;
        let fileName: string;

        switch (format) {
          case "csv":
            contentType = "text/csv";
            fileName = `dfc_${societe}.csv`;
            break;
          case "excel":
            contentType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            fileName = `dfc_${societe}tst.xlsx`;
            break;
          case "pdf":
            contentType = "application/pdf";
            fileName = `dfc_${societe}.pdf`;
            break;
        }
        await logV2(
          "Exportation",
          "DFCs",
          (request.user as any).id,
          "all",
          `Export of DFC in ${format.toUpperCase()}`,
        );
        if (format === "pdf") {
          console.warn("File already returned");
          return;
        }
        return reply
          .header("Content-Type", contentType)
          .header("Content-Disposition", `attachment; filename="${fileName}"`)
          .status(200)
          .send(result);
      } catch (error) {
        console.error("Error exporting RTJs:", error);
        return reply
          .status(500)
          .send({ error: "An error occurred while exporting RTJs." });
      }
    },
  });

  fastify.get("/paginate/:page", {
    schema: {
      tags: ["RTJ"],
      querystring: {
        properties: {
          query: { type: "string" },
          montant: { type: "number" },
          societe: { type: "string" },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
        },
        required: ["societe"],
      },
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest<{ Params: { page: number; }, Querystring: { societe: string, query: string, montant: number, dateFrom: string, dateTo: string; }; }>, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const userData = request.user as { id: string, iat: number; };
      const { societe, query, montant, dateFrom, dateTo } = request.query;
      const result = await service.getAll(userData, societe, request.params.page, query, montant, dateFrom, dateTo);
      await logV2(
        "Consultation",
        "DFCs",
        (request.user as any).id,
        "all",
        `Consultation des retours transactions journaliers, page ${request.params.page}`,
      );
      reply.status(200).send({ message: "Liste des Retours Transactions Journaliers", data: result });
    },
  });
  fastify.route({
    method: "POST",
    url: "/",
    schema: schema,
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: { date: string; }; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const data: { date: string; } = request.body;
      const result = await service.create(data);
      await logV2(
        "Création",
        "DFCs",
        (request.user as any).id,
        result.main.cie.id,
        `Création du DFC n°${result.main.cie.id}`,
      );
      reply.status(200).send({ message: "Retour Transactions Journalier créé", data: result });
    },
  });
  fastify.route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["RTJ"],
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
      const result = await service.getDetailed(request.user as { id: string, iat: number; }, request.params.id);
      await logV2(
        "Consultation",
        "DFCs",
        (request.user as any).id,
        request.params.id,
        `Consultation des détails du DFC du ${result.date.toLocaleDateString()}, société ${result.societe}`,
      );
      reply.status(200).send({ message: "Détails de Retour Transactions Journalier", data: result });
    },
  });
  fastify.route({
    method: "POST",
    url: "/approve",
    schema: {
      tags: ["RTJ"],
      body: {
        type: "object",
        properties: {
          dfcid: { type: "string" },
          approval: { type: "boolean" },
          compte_source: { type: "string" },
          compte_destination: { type: "string" },
          message: { type: "string" },
        },
        required: ["dfcid", "approval"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Body: {
          dfcid: string;
          approval: boolean;
          compte_source?: string;
          compte_destination?: string;
          message?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      // const auth = await authorization(request.user, moduleName, "update");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const userData = request.user as { id: string, iat: number; };
      const { dfcid, approval, compte_source, compte_destination, message } = request.body;
      if (!approval && !message) return reply.status(400).send({ message: "You must provide approval or message" });
      if ((approval && !compte_source) || (approval && !compte_destination)) return reply.status(400).send({ message: "Compte Source & Destination sont obligatoires !" });
      const result = await service.approveDfc(dfcid, approval, {
        source: compte_source,
        destination: compte_destination,
        message: message
      },
        userData);
      // Add audit log
      await logV2(
        "Mise à jour",
        "DFCs",
        (request.user as any).id,
        `dfcid_${dfcid}`,
        `Mise à jour du DFC du ${result.date.toLocaleDateString()}`,
      );
      reply.status(200).send({ message: "Dfc approved", data: result });
    },
  });

  done();
};

export default routes;
