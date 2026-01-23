import {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import transactionService from "../../services/transactions";
import { exportTransactions } from "../../services/export";
import { ApprobationInterface } from "../../interfaces/approbation";
import { logV2 } from "../../utils/audit";
import { checkAuth } from "../../helpers/auth";
// import kafkaService from "../../services/neo_kafka"; // KAFKA server not working
import users from "../../services/users";
import partners from "../../services/partners";
import authorization from "../../utils/authorization";
const tags = ["Transactions"];
const moduleName = "Transactions";

/**
 * Logs and returns the execution time of an action
 * @param start Minimum time at which the action started (In milliseconds)
 * @param end Maximum time at which the action ended (In milliseconds)
 * @param unit Unit of time to use for logging (ms, s, min, h); Default is ms
 */
const logTime = (start: number, end: number, unit: "ms" | "s" | "min" | "h" = "ms") => {
  console.log(`Execution time: ${end - start} ms`, `${(end - start) / 1000} s`, `${(end - start) / 1000 / 60} min`, `${(end - start) / 1000 / 60 / 60} h`);
  switch (unit) {
    case "ms":
      return end - start;
    case "s":
      return (end - start) / 1000;
    case "min":
      return (end - start) / 1000 / 60;
    case "h":
      return (end - start) / 1000 / 60 / 60;
  }
};
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
          canal: { type: "string" },
          referenceClient: { type: "string" },
          referenceContrat: { type: "string" },
          referenceTransaction: { type: "string" },
          facture: { type: "string" },
          numeroRecu: { type: "string" },
          statutOperations: { type: "string", enum: ["SUCCES"] },
          details: { type: "string" },
          dateDePaiement: { type: "string", format: "date-time" },
          montant: { type: "number" },
          dateFlux: { type: "string", format: "date-time" },
          source: { type: "string" },
          code: { type: "string" },
        },
        required: [
          "canal",
          "referenceClient",
          "referenceContrat",
          "facture",
          "numeroRecu",
          "statutOperations",
          "dateDePaiement",
          "montant",
          "dateFlux",
          "source",
          "code",
        ],
      },
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest<{
      Body: {
        canal: string,
        referenceClient: string,
        referenceContrat: string,
        referenceTransaction?: string,
        facture: string,
        numeroRecu: string,
        statutOperations: string,
        details?: string,
        dateDePaiement: string,
        montant: number,
        dateFlux: string,
        source: string,
        code: string,
      };
    }>, reply: FastifyReply) => {
      // const auth = await authorization(request.user, moduleName, "create");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      try {
        const result = await transactionService.create(request.body);
        // Add audit log
        await logV2(
          "Création",
          "Transactions",
          (request.user as any).id,
          result.id,
          `Création de la transaction n°${result.numeroRecu}`,
        );
        // kafkaService.send(result, `${result.society.name.toUpperCase()}-NMPF-REGLEMENTS`);
        reply
          .status(200)
          .send({ message: "Transaction créée avec succès", data: result });
      } catch (error: any) {
        return reply
          .status(error.statusCode || 500)
          .send({ message: error.message });
      }
    },
  });

  fastify.route({
    method: "PATCH",
    url: "/source-rev-2093",
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await transactionService.getSourceRev2093();
      reply.status(200).send({ message: "👍🏾", data: result });
    }
  });

  fastify.route({
    method: "GET",
    url: "/:id",
    schema: {
      tags,
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
      const result = await transactionService.getOne(request.params.id);
      // Add audit log
      await logV2(
        "Consultation",
        "Transactions",
        (request.user as any).id,
        request.params.id,
        `Consultation de la transaction n°${result?.numeroRecu || "__error__"}`,
      );
      reply
        .status(200)
        .send({ message: `Transaction n°${result?.numeroRecu || "__error__"}`, data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/export/:format",
    schema: {
      tags,
      querystring: {
        type: "object",
        properties: {
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
          societe: { type: "string" },
          operateurId: { type: "string" },
          query: { type: "string" }
        },
      },
      params: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["csv", "excel", "pdf"] },
        },
        required: ["format"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Params: { format: "csv" | "excel" | "pdf"; };
        Querystring: {
          dateFrom?: string;
          dateTo?: string;
          societe?: string;
          operateurId?: string;
          query?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "print");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { format } = request.params;
      const filters = request.query;

      try {
        // console.log(`Transaction export request: ${request.user}`, request.query, request.params);
        const userData = await users.getOne((request.user as { id: string; }).id);
        if (!userData) return reply.status(404).send({ message: "User Not Found" });
        const result = await exportTransactions(
          format,
          reply,
          filters,
          userData.partnerId ? userData.partnerId : undefined
        );

        let contentType: string;
        let fileName: string;

        switch (format) {
          case "csv":
            contentType = "text/csv";
            fileName = `transactions${filters.societe ? `_${filters.societe}` : ''}.csv`;
            break;
          case "excel":
            contentType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            fileName = `transactions${filters.societe ? `_${filters.societe}` : ''}.xlsx`;
            break;
          case "pdf":
            contentType = "application/pdf";
            fileName = `transactions${filters.societe ? `_${filters.societe}` : ''}.pdf`;
            break;
        }

        // Add audit log
        await logV2(
          "Exportation",
          "Transactions",
          (request.user as any).id,
          `export_transactions`,
          `Export des transactions`,
        );
        if (format === "pdf") {
          console.log("File already returned");
          return;
        }
        return reply
          .header("Content-Type", contentType)
          .header("Content-Disposition", `attachment; filename="${fileName}"`)
          .status(200)
          .send(result);
      } catch (error: any) {
        return reply
          .status(error.statusCode || 500)
          .send({ message: error.message });
      }
    },
  });

  fastify.route({
    method: "GET",
    url: "/paginate/:page",
    schema: {
      tags,
      querystring: {
        type: "object",
        properties: {
          query: { type: "string" },
          canal: { type: "string" },
          operateurId: { type: "string" },
          statutOperations: { type: "string" },
          dateDePaiement: { type: "string", format: "date-time" },
          numeroRecu: { type: "string" },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
          societyId: { type: "string" },
          codeSocietyId: { type: "string" },
          societe: { type: "string" },
          status: { type: "string" }
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
          canal?: string;
          operateurId?: string;
          statutOperations?: string;
          numeroRecu?: string;
          dateDePaiement?: string;
          dateFrom?: string;
          dateTo?: string;
          societyId?: string;
          codeSocietyId?: string;
          societe?: string;
          status?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      // const auth = await authorization(request.user, moduleName, "list");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const start = Date.now();
      const userData = request.user as any;
      const { page } = request.params;
      const filters = request.query;
      if (filters.societe && filters.societe.toUpperCase() != "CIE" && filters.societe.toUpperCase() != "SODECI") delete filters.societe;
      // Remove null or empty values from filters
      Object.keys(filters).forEach((key) => {
        if (!filters[key] || filters[key] === "") {
          delete filters[key];
        }
      });

      console.log("Transaction Paged Search Request Initiated");
      const result = filters
        ? await transactionService.getAllPaginate(userData, page, filters)
        : await transactionService.getAllPaginate(userData, page, {});
      console.log("Transaction Paged Search Result Obtained");

      // 🔍 LOGS DE DIAGNOSTIC
      console.log("🔍 API RESULT FIRST RECORD:", result.record?.[0]);
      if (result.record?.[0]) {
        console.log("🔍 API dateDePaiement:", typeof result.record[0].dateDePaiement, result.record[0].dateDePaiement);
        console.log("🔍 API dateFlux:", typeof result.record[0].dateFlux, result.record[0].dateFlux);
        console.log("🔍 API dateDePaiement instanceof Date:", result.record[0].dateDePaiement instanceof Date);
        console.log("🔍 API dateFlux instanceof Date:", result.record[0].dateFlux instanceof Date);
      }

      // Add audit log
      await logV2(
        "Consultation",
        "Transactions",
        (request.user as any).id,
        `page_${page}`,
        `Consultation de la liste des transactions, page ${page}`,
      );
      const end = Date.now();
      logTime(start, end);
      reply.status(200).send({
        message: `Liste des transactions, page ${page}`,
        data: result,
      });
    },
  });

  fastify.route({
    method: "POST",
    url: "/load-chunkdata",
    schema: {
      tags,
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "create");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const user: { id: string; iat: number; } = await request.jwtDecode();
      const result = await transactionService.loadAllDataFromChunkdata(user.id);
      // Add audit log
      await logV2(
        "Création",
        "Transactions",
        (request.user as any).id,
        "all",
        `Chargement des données de chunkdata`,
      );
      reply
        .status(200)
        .send({ message: "Données chargées avec succès", data: result });
    },
  });

  fastify.route({
    method: "GET",
    url: "/stats/percentage-by-operator",
    schema: {
      tags,
      querystring: {
        type: "object",
        properties: {
          societe: { type: "string" },
        },
        required: ["societe"],

      },
      // response: {
      //   200: {
      //     type: "object",
      //     properties: {
      //       message: { type: "string" },
      //       data: {
      //         type: "array",
      //         items: {
      //           type: "object",
      //           properties: {
      //             operator: { type: "string" },
      //             percentage: { type: "number" },
      //           },
      //         },
      //       },
      //     },
      //   },
      // },
    },
    preHandler: checkAuth,
    handler: async (request: FastifyRequest<{
      Querystring: {
        societe?: string;
      };
    }>, reply: FastifyReply) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result =
        await transactionService.getTransactionPercentageByOperator(request.user as any, request.query.societe?.toUpperCase());
      // Add audit log
      await logV2(
        "Consultation",
        "Transactions",
        (request.user as any).id,
        "percentage_by_operator",
        `Consultation des pourcentages des transactions par opérateur`,
      );
      reply
        .status(200)
        .send({ message: "Transaction percentages by operator", data: result.data, dateFrom: result.dateFrom, dateTo: result.dateTo });
    },
  });

  fastify.route({
    method: "GET",
    url: "/stats/count-and-amount-by-operator",
    schema: {
      tags,
      querystring: {
        type: "object",
        properties: {
          operatorId: { type: "string" },
          forToday: { type: "boolean", default: false },
          societe: { type: "string" },
        },
        required: ["societe"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Querystring: { operatorId?: string; forToday?: boolean; societe: string; };
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { operatorId, forToday, societe } = request.query;
      const initialResult =
        await transactionService.getTransactionCountAndAmountByOperator(
          request.user as any,
          societe.toUpperCase(),
          operatorId,
          forToday,
        );
      // Add audit log
      await logV2(
        "Consultation",
        "Transactions",
        (request.user as any).id,
        "count_and_amount_by_operator",
        `Consultation des comptes de transaction par opérateur`,
      );
      reply
        .status(200)
        .send({
          message: "Transaction count and amount by operator",
          data: initialResult.data,
          dateFrom: initialResult.dateFrom,
          dateTo: initialResult.dateTo
        });
    },
  });

  fastify.route({
    method: "GET",
    url: "/plages",
    schema: {
      tags,
      querystring: {
        type: "object",
        properties: {
          societe: { type: "string" },
        },
        required: ["societe"],
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Querystring: { societe: string; }; }>,
      reply: FastifyReply
    ) => {
      // const auth = await authorization(request.user, moduleName, "list");
      // if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      try {
        const result = await transactionService.getByAmountPlages(request.user as any, request.query.societe);

        // Add audit log
        // await logV2(
        //   "Consultation",
        //   "Transactions",
        //   (request.user as any)?.id || "anonymous",
        //   `operator_${operatorId}_days_${numberOfDays}`,
        //   audit_user ? `Consultation des transactions des derniers jours, operateur ${audit_user.name}, days ${numberOfDays}` : `Consultation des transactions des derniers jours, days ${numberOfDays}`,
        // );

        reply
          .status(200)
          .send({
            message: "Plages de montant",
            data: result
          });
      } catch (error) {
        console.error("Error in /plages route:", error);
        reply
          .status(500)
          .send({
            error:
              "An error occurred while fetching transactions by plages.",
          });
      }
    }
  });

  fastify.route({
    method: "GET",
    url: "/last-n-days",
    schema: {
      tags,
      querystring: {
        type: "object",
        properties: {
          numberOfDays: { type: "integer", default: 10 },
          societe: { type: "string" },
        },
        required: ["societe"],

      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  totalTransactions: { type: "number" },
                  totalAmount: { type: "number" },
                  amountGrowthRate: { type: "string" },
                  transactionGrowthRate: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Querystring: { operatorId?: string; numberOfDays?: number; societe?: string; };
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "list");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      try {
        const user = request.user as { id: string; iat: number; };
        const userData = await users.getOne(user.id);
        let operatorId: string | null = null;
        if (userData!.type !== "INTERNAL") {
          operatorId = userData!.partnerId;
        }
        const audit_user = operatorId ? await partners.getOne({ id: operatorId }) : null;
        const { numberOfDays, societe } = request.query;
        const result = await transactionService.getLastNDaysTransactions(
          request.user as any,
          operatorId ? operatorId : undefined,
          numberOfDays,
          societe?.toUpperCase(),
        );
        // Add audit log
        await logV2(
          "Consultation",
          "Transactions",
          (request.user as any)?.id || "anonymous",
          `operator_${operatorId}_days_${numberOfDays}`,
          audit_user ? `Consultation des transactions des derniers jours, operateur ${audit_user.name}, days ${numberOfDays}` : `Consultation des transactions des derniers jours, days ${numberOfDays}`,
        );
        console.log("Last n days", result);
        reply
          .status(200)
          .send({ message: "Last ten days transactions", data: result });
      } catch (error) {
        console.error("Error in /last-ten-days route:", error);
        reply
          .status(500)
          .send({
            error:
              "An error occurred while fetching last ten days transactions.",
          });
      }
    },
  });

  fastify.route({
    method: "POST",
    url: "/approve",
    schema: {
      tags,
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
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { dfcid, approval, compte_source, compte_destination, message } = request.body;
      if (!approval && !message) return reply.status(400).send({ message: "You must provide approval or message" });
      const result = await transactionService.approveDfc(dfcid, approval, {
        source: compte_source,
        destination: compte_destination,
        message: message
      });
      // Add audit log
      await logV2(
        "Mise à jour",
        "Transactions",
        (request.user as any)?.id || "anonymous",
        `dfcid_${dfcid}`,
        `Dfc approved, dfcid ${dfcid}`,
      );
      reply.status(200).send({ message: "Dfc approved", data: result });
    },
  });

  fastify.route({
    method: "POST",
    url: "/approbation",
    schema: {
      tags,
      body: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["En cours d'analyse", "Approuvé", "Non approuvé"],
          },
          date: { type: "string" },
          commentaire: { type: "string" },
          iduser: { type: "string" },
          comptePartenaire: { type: "string" },
          compteSociete: { type: "string" },
        },
        required: ["status"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                date: { type: "string" },
                commentaire: { type: "string" },
                iduser: { type: "string" },
                comptePartenaire: { type: "string" },
                file: { type: "string" },
                compteSociete: { type: "string" },
              },
            },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{ Body: ApprobationInterface; }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const result = await transactionService.createApprobation(request.body);
      // Add audit log
      await logV2(
        "Création",
        "Approbations",
        (request.user as any)?.id || "anonymous",
        result.id,
        (request.user as any)?.id || "anonymous",
      );
      reply.status(200).send({ message: "Approbation créée", data: result });
    },
  });

  fastify.route({
    method: "PUT",
    url: "/approbation/:id",
    schema: {
      tags,
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["En cours d'analyse", "Approuvé", "Non approuvé"],
          },
          date: { type: "string" },
          commentaire: { type: "string" },
          iduser: { type: "string" },
          comptePartenaire: { type: "string" },
          file: { type: "string" },
          compteSociete: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                date: { type: "string" },
                commentaire: { type: "string" },
                iduser: { type: "string" },
                comptePartenaire: { type: "string" },
                file: { type: "string" },
                compteSociete: { type: "string" },
              },
            },
          },
        },
      },
    },
    preHandler: checkAuth,
    handler: async (
      request: FastifyRequest<{
        Params: { id: string; };
        Body: Partial<ApprobationInterface>;
      }>,
      reply: FastifyReply,
    ) => {
      const auth = await authorization(request.user, moduleName, "update");
      if (!auth) return reply.status(403).send({ message: "Accès non autorisé" });
      const { id } = request.params;
      const updateData = request.body;

      // Vérifiez si l'utilisateur est externe
      if ((request.user as any).type !== "EXTERNAL") {
        reply
          .status(403)
          .send({
            message:
              "Seuls les utilisateurs externes peuvent modifier une approbation",
          });
        return;
      }

      const result = await transactionService.updateApprobation(id, updateData);
      // Add audit log
      await logV2("Mise à jour", "Approbations", (request.user as any)?.id, id, `Approbation mise à jour, jour ${result.date.toLocaleDateString()} id ${id}`);
      reply
        .status(200)
        .send({ message: "Approbation mise à jour", data: result });
    },
  });

  done();
};

export default routes;

//dateFrom: 2024-01-01T12:00:00Z
