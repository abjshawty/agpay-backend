// src/infrastructure/server.ts

import Fastify, {
  FastifyInstance,
  RouteShorthandOptions,
  FastifyError,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import dotenv from "dotenv";
import * as fastifyMultipart from "fastify-multipart";
import routes from "../api/routes";
import swagger from "@fastify/swagger"; // Importe le plugin Swagger
import swaggerUI from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { swaggerConfig, swaggerUiConfig } from "./utils/swagger";
import kafkaService from "../services/neo_kafka";
dotenv.config();

export class Server {
  private server: FastifyInstance;
  private;
  constructor () {
    console.log("Starting server real quick...");
    this.server = Fastify({ logger: true });
    this.server.addHook('onSend', (request, reply, payload, done) => {
      reply.header('x-powered-by', 'fastify');
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
      reply.header('x-content-type-options', 'nosniff');
      reply.header('x-frame-options', 'DENY');
      reply.header('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
      done();
    });
    this.config();
    this.routes();
    this.errorHandling();
    // kafkaService.consume().catch((err) => {
    //   console.log("Error during KAFKA connection", err);
    // });
    // kafkaService.produce().catch((err) => {
    //   console.log("Error during KAFKA connection", err);
    // });
  }

  private config (): void {
    //@ts-ignore
    this.server.register(jwt, {
      secret: process.env.JWT_SECRET! || "lelultpqsqgqdw4q9842",
    });
    this.server.register(fastifyMultipart, { addToBody: true });
    this.cors();
    this.server.register(swagger, swaggerConfig);
    this.hooks();

    // // Configuration optionnelle de Swagger UI si nécessaire
    this.server.register(swaggerUI, swaggerUiConfig);
  }

  private routes (): void {
    // Configure la route de base pour vérifier la version, par exemple
    const opts: RouteShorthandOptions = {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              version: { type: "string" },
            },
          },
        },
      },
    };

    this.server.get(
      `/api${process.env.API_PATH}/version`,
      opts,
      async (request, reply) => {
        try {
          const version = process.env.npm_package_version || "version inconnue";
          reply.status(200).send({ version });
        } catch (error: any) {
          request.log.error(`Erreur sur la route /version: ${error}`);
          const status = (error as any)?.statusCode ?? 500;
          reply.status(status).send({ error: (error as any)?.message });
        }
      },
    );
    this.server.get(`/close`, (request, response) => {
      response.send({ info: "Closing" });
      kafkaService.close();
      this.server.close().then(() => {
        console.log("Server closed");
        process.exit(0);
      }).catch((error) => {
        console.error(error);
        process.exit(1);
      });
    });

    // Enregistre les routes additionnelles
    this.server.register(routes, { prefix: `/api${process.env.API_PATH}` });
  }
  private cors (): void {
    this.server.register(cors, {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Content-Range", "X-Content-Range"],
      credentials: true,
    });
  }
  private errorHandling (): void {
    // Personnalise la gestion des erreurs ici
    this.server.setErrorHandler(
      (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        console.error("une erreur s'est produite \n", error);
        const status = (error as any)?.statusCode ?? 500;
        reply.status(status).send({ message: error.message });
      },
    );
  }
  private hooks (): void {
    this.server.addHook('onRequest', (request, reply, done) => {
      this.server.log.info(`Request URL: ${request.url}`);
      done();
    });
  }

  public async start (): Promise<void> {
    try {
      const port = parseInt(process.env.PORT || "8080", 10);
      await this.server.listen({ port, host: "0.0.0.0" });
      console.log(`Le serveur écoute sur le port ${port}`);
    } catch (error) {
      console.error("Erreur lors du démarrage du serveur:", error);
    }
  }
}
