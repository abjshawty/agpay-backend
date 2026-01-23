import testRoutes from "./test";
import bankRoutes from "./banks";
import societyRoutes from "./society";
import partnersRoutes from "./partners";
import profilsRoutes from "./profils";
import filesRoutes from "./files";
import userRoutes from "./users";
import accountRoutes from "./accounts";
import transactionsRoutes from "./transactions";
import configRoutes from "./config";
import auditRoutes from "./audit";
import rtjRoutes from "./rtj";
import authRoutes from "./auth";

export default async function (fastify: any, opts: any, done: any) {
  // Enregistrement des routes
  fastify.register(authRoutes, { prefix: "/auth" });
  fastify.register(auditRoutes, { prefix: "/audit" });
  fastify.register(testRoutes, { prefix: "/test" });
  fastify.register(filesRoutes, { prefix: "/file" });
  fastify.register(profilsRoutes, { prefix: "/profils" });
  fastify.register(societyRoutes, { prefix: "/societies" });
  fastify.register(bankRoutes, { prefix: "/banks" });
  fastify.register(partnersRoutes, { prefix: "/partners" });
  fastify.register(userRoutes, { prefix: "/users" });
  fastify.register(accountRoutes, { prefix: "/accounts" });
  fastify.register(configRoutes, { prefix: "/config" });
  fastify.register(transactionsRoutes, { prefix: "/transactions" });
  fastify.register(rtjRoutes, { prefix: "/rtj" });
  done();
}
