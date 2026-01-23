import { PrismaClient } from "@prisma/client";

export default new PrismaClient().$extends({
  result: {
    resumeTransactionsOperateur: {
      status: {
        needs: { date: true, operateurId: true },
        compute(res) {
          const followingDay = new Date(res.date);
          followingDay.setDate(res.date.getDate() + 1);
          // const transactions = defaultPrisma.transaction.findMany({
          //   where: {
          //     operateurId: res.operateurId,
          //     dateFlux: {
          //       gte: res.date,
          //       lt: followingDay
          //     }
          //   }
          // }).then((transactions) => transactions.map(t => t.status)).then((statuses) => {
          //   if (statuses.some(t => t === TransactionStatus.Analyzing)) return "EN_COURS";
          //   if (statuses.some(t => t === TransactionStatus.Rejected)) return "REFUSÉ";
          //   if (statuses.some(t => t === TransactionStatus.Approved)) return "SUCCES";
          //   return "EN_COURS";
          // });
          return "";
        },
      },
    },
    resumeTransactionsJour: {
      status: {
        needs: { date: true },
        async compute(res): Promise<string> {
          // const followingDay = new Date(res.date);
          // followingDay.setDate(res.date.getDate() + 1);
          // const transactions = await defaultPrisma.transaction.findMany({
          //   where: {
          //     // operateurId: res.operateurId,
          //     dateFlux: {
          //       gte: res.date,
          //       lt: followingDay
          //     }
          //   }
          // }).then((transactions) => transactions.map(t => t.status)).then((statuses) => {
          //   if (statuses.some(t => t === TransactionStatus.Analyzing)) return "EN_COURS";
          //   if (statuses.some(t => t === TransactionStatus.Rejected)) return "REFUSÉ";
          //   if (statuses.some(t => t === TransactionStatus.Approved)) return "SUCCES";
          //   return "EN_COURS";
          // });
          return "Error";
        },
      },
      nombreOperateurs: {
        compute(res) {
          return 0;
        },
      },
      tauxApprobation: {
        compute(res) {
          return "";
        }
      },
      analyseEnCours: {
        compute(res) {
          return "";
        }
      }
    },
  }
});
