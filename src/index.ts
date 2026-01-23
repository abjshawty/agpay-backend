import { Server } from "./externals/server";
import cronService from "./services/cronService";
import "./services/superadmin";

async function main () {
  const server = new Server();
  await server.start();
  cronService.initialize();
}

main().catch((err) => {
  console.error("Erreur lors du démarrage de l'application:", err);
});
