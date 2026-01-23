import { FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { all, getAuditLogsPaginate } from "../../services/audit";
import { exportAuditLogs } from "../../services/export";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import authorization from "../../utils/authorization";

const moduleName = 'Journal des actions';
const routes: FastifyPluginCallback = (fastify, options, done) => {
  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags: ["Audit"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string" },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
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
    handler: async (
      request: FastifyRequest<{
        Params: { page: number; };
        Querystring: {
          query?: string;
          dateFrom?: string;
          dateTo?: string;
        };
      }>,
      reply,
    ) => {
      // const auth = await authorization(request.user, moduleName, "list");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      try {
        const { page } = request.params;
        const { query, dateFrom, dateTo } = request.query;
        const result = await getAuditLogsPaginate(
          query,
          page,
          dateFrom,
          dateTo,
        );
        reply.status(200).send({ message: "Audit logs", data: result });
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        reply
          .status(500)
          .send({ error: "An error occurred while fetching audit logs." });
      }
    },
  });

  fastify.route({
    method: "GET",
    url: "/export/:format",
    schema: {
      tags: ["Audit"],
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
          query: { type: "string" },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
        },
      }
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest<{
      Params: {
        format: "csv" | "excel" | "pdf";
      },
      Querystring: {
        query: string;
        dateFrom: string;
        dateTo: string;
      };
    }>, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "print");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { format } = request.params;
      const { query, dateFrom, dateTo } = request.query;
      try {
        const result = await exportAuditLogs(
          format,
          reply,
          query,
          dateFrom,
          dateTo,
        );
        let contentType: string;
        let fileName: string;

        switch (format) {
          case "csv":
            contentType = "text/csv";
            fileName = "audit_logs.csv";
            break;
          case "excel":
            contentType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            fileName = "audit_logs.xlsx";
            break;
          case "pdf":
            contentType = "application/pdf";
            fileName = "audit_logs.pdf";
            break;
        }

        logV2(
          "Exportation",
          "Audits",
          (request.user as any).id,
          "all",
          `Export of audit logs in ${format.toUpperCase()}`,
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
        console.error("Error exporting audit logs:", error);
        return reply
          .status(500)
          .send({ error: "An error occurred while exporting audit logs." });
      }
    },
  });

  fastify.route({
    method: "GET",
    url: "/",
    handler: () => {
      return all();
    }
  });

  done();
};

export default routes;
