import fastify, {
    FastifyInstance,
    FastifyPluginCallback,
    FastifyReply,
    FastifyRequest,
} from "fastify";
import service from "../../services/auth";
import userService from "../../services/users";
import { checkAuth } from "../../helpers/auth";
import { logV2 } from "../../utils/audit";
import sendMail from "../../helpers/mailer";

const schemas = {
    resetPassword: {
        tags: ["Auth"],
        body: {
            type: "object",
            properties: {
                email: { type: "string" },
                token: { type: "string" },
                password: { type: "string" },
            },
            required: ["token", "password"],
        },
    },
    verifyToken: {
        tags: ["Auth"],
        querystring: {
            type: "object",
            properties: {
                token: { type: "string" },
            },
            required: ["token"],
        },
    },
    newToken: {
        tags: ["Auth"],
        body: {
            type: "object",
            properties: {
                email: { type: "string" },
            },
            required: ["email"],
        },
    }
};
const routes: FastifyPluginCallback = (fastify, options, done) => {
    // Verify token
    fastify.route({
        method: "GET",
        url: "/verify-token",
        schema: schemas.verifyToken,
        handler: async (request: FastifyRequest<{ Querystring: { token: string; }; }>, reply: FastifyReply) => {
            try {
                const result = await service.verifyToken(request.query.token);
                const admin = await userService.getwEmail("admin@super.com");
                await logV2("Authentification", "Utilisateurs", admin!.id, result.id, `Vérification de token pour inscription.`);
                reply.status(200).send({
                    data: {
                        message: "Token Valide",
                        isValid: true,
                        email: result.email
                    }
                });
            } catch (error: any) {
                if (!error.hasOwnProperty("statusCode")) {
                    error.statusCode = 500;
                }
                reply.status(error.statusCode).send({
                    data: {
                        message: error.message,
                        isValid: false,
                        email: null
                    }
                });
            }
        },
    });

    // Reset password
    fastify.route({
        method: "POST",
        url: "/reset-password",
        schema: schemas.resetPassword,
        handler: async (request: FastifyRequest<{ Body: { email?: string; token: string; password: string; }; }>, reply: FastifyReply) => {
            try {
                const result = await service.resetPassword(request.body.token, request.body.password, request.body.email);
                const admin = await userService.getwEmail("admin@super.com");
                await logV2("Mise à jour", "Utilisateurs", admin!.id, result.id, `Mise à jour du mot de passe de l'utilisateur n°${result.lastname + " " + result.firstname}.`);
                reply.status(200).send({ message: "Mot de passe réinitialisé", data: result });
            } catch (error: any) {
                if (!error.hasOwnProperty("statusCode")) {
                    error.statusCode = 500;
                }
                reply.status(error.statusCode).send({
                    message: error.message,
                    data: error
                });
            }
        },
    });

    // New token
    fastify.route({
        method: "POST",
        url: "/new-token",
        schema: schemas.newToken,
        handler: async (request: FastifyRequest<{ Body: { email: string; }; }>, reply: FastifyReply) => {
            try {
                const result = await service.newToken(request.body.email);
                const admin = await userService.getwEmail("admin@super.com");
                await logV2("Authentification", "Utilisateurs", admin!.id, result.id, `Génération d'un nouveau token pour un utilisateur.`);
                reply.status(200).send({ message: "Token généré", data: result });
            } catch (error: any) {
                if (!error.hasOwnProperty("statusCode")) {
                    error.statusCode = 500;
                }
                reply.status(error.statusCode).send({
                    message: error.message,
                    data: error
                });
            }
        },
    });

    // Test Mail
    fastify.route({
        method: "GET",
        url: "/test-mail",
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                await sendMail("kouadiobhegnino@gmail.com", "Test Mail", "Ceci est un test");
                reply.status(200).send({ message: "Mail envoyé" });
            } catch (error: any) {
                if (!error.hasOwnProperty("statusCode")) {
                    error.statusCode = 500;
                }
                console.error("Error while trying to send mail:", error);
                reply.status(error.statusCode).send({
                    message: error.message,
                    data: error
                });
            }
        },
    });
    done();
};
export default routes;
