// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();
// export async function logAudit(
//   action: string,
//   entity: string,
//   entityId: string,
//   userId: string,
// ) {
// await prisma.audit.create({
//   data: {
//     action,
//     entity,
//     entityId,
//     userId: userId && userId !== "anonymous" ? userId : null,
//   },
// });

import NeoAuditRepository from "../repository/neo_audit";
const repo = new NeoAuditRepository();

export function logV2 (
  category: "Recherche" | "Exportation" | "Authentification" | "Consultation" | "Mise à jour" | "Création" | "Suppression" | "Désactivation",
  module: "Audits" | "Comptes" | "Utilisateurs" | "Profils" | "Paramètres" | "Banques" | "Sociétés" | "Partenaires" | "DFCs" | "Approbations" | "Transactions" | "Paramètres" | "Fichiers" | "Keycloak",
  userId: string,
  target?: string,
  message?: string,
) {
  void repo.create({
    category,
    module,
    userId,
    target,
    timestamp: new Date(),
    message: message
  }).catch(console.error);
}