import cron from "node-cron";
import TransactionService from "./transactions";
import { PrismaClient } from "@prisma/client";
import rtjService from "./rtj";
import { load } from "../utils/loadPartners";
// import { handleCIE, handleSODECI } from "../helpers/sql/ms";

const prisma = new PrismaClient();
class CronService {
  private transactionService: typeof TransactionService;

  constructor () {
    this.transactionService = TransactionService;
  }

  async initialize () {
    console.log("Initializing CronService");
    const operators = await prisma.partner.findMany();
    console.log("Operators found.");
    if (operators.length < 23) {
      console.log("Missing operators from the database.");
      await load();
    }
    // await load();
    // await this.checkAndRegisterOldData();
    // this.startDailyDFCJob();
    // await this.checkAndRegisterRTJ();
    // this.startDailyRTJJob(); // Recent
    // this.bdFetchJob();
    // handleCIE.getTransactions()
  }

  private async checkAndRegisterOldData () {
    const operators = await prisma.partner.findMany();
    for (const operator of operators) {
      const existingDFCs = await prisma.dailyFinancialClosure.findMany({
        where: { operatorId: operator.id },
        orderBy: { date: "asc" },
        take: 1,
      });

      if (existingDFCs.length === 0) {
        console.log(
          `No DFCs found for operator ${operator.id}. Registering old data.`,
        );
        await this.registerOldData(operator.id);
      } else {
        console.log(
          `DFCs already exist for operator ${operator.id}. Skipping old data registration.`,
        );
      }
    }
  }

  private async checkAndRegisterRTJ () {
    const operators = await prisma.partner.findMany();

    const existingRTJs = await prisma.transaction.findMany({
      select: { dateFlux: true },
      orderBy: { dateFlux: "asc" },
    });
    for (const rtj of existingRTJs) {
      try {
        await rtjService.create({ date: rtj.dateFlux.toISOString() });
      } catch (error: any) {
        error.statusCode == 400 ? console.error("Skipped: Already Exists", error.message) :
          console.error("Error in RTJ creation:", error);
      }
    }

    rtjService.cleanup();
  }

  private async registerOldData (operatorId: string) {
    const { record } = await this.transactionService.getDailyFinancialClosures(
      1,
      100,
      operatorId,
    );
    for (const dfc of record) {
      await this.storeDFCInDatabase(dfc, operatorId);
    }
  }

  tokenCleanupJob () {
    cron.schedule("*/15 * * * *", async () => {
      console.log("Running token cleanup job");
      try {
        await prisma.tokenX.deleteMany({
          where: {
            expiry: { gte: new Date() }
          }
        });
      } catch (error) {
        console.error("Error in token cleanup job:", error);
      }
    });
  }

  // bdFetchJob () {
  //   cron.schedule("*/5 * * * *", async () => {
  //     return;
  //     // console.log("Fetching recent transactions from Recap Transactions");
  //     try {
  //       // await handleCIE.getTransactions();
  //       // await handleSODECI.getTransactions();
  //     } catch (error) {
  //       console.error("Error fetching from Recap Transactions", error);
  //     }
  //   });
  // }

  // startDailyDFCJob () {
  //   cron.schedule("59 23 * * *", async () => {
  //     console.log("Running daily DFC creation job");
  //     try {
  //       await this.createDailyDFCs();
  //     } catch (error) {
  //       console.error("Error in daily DFC creation job:", error);
  //     }
  //   });
  // }

  // startDailyRTJJob () {
  //   this.createDailyRTJs();
  //   cron.schedule("* */3 * * *", async () => {
  //     console.log("Running daily RTJ creation job");
  //     try {
  //       await this.createDailyRTJs();
  //     } catch (error) {
  //       console.error("Error in daily RTJ creation job:", error);
  //     }
  //   });
  // }

  private async createDailyDFCs () {
    const operators = await prisma.partner.findMany();

    for (const operator of operators) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { record } =
        await this.transactionService.getDailyFinancialClosures(
          1,
          1,
          operator.id,
          today,
        );

      if (record.length > 0) {
        const dfc = record[0];
        await this.storeDFCInDatabase(dfc, operator.id);
      }
    }
  }

  private async createDailyRTJs () {
    const operators = await prisma.partner.findMany();
    if (operators.length == 0) {
      console.log("No operators found in the database.");
      await load();
    }

    const transactions = await prisma.transaction.findMany({
      select: { dateFlux: true }
    });

    const dates = transactions.map((transaction) => {
      const date = new Date(transaction.dateFlux);
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    });
    const uniqueDates = Array.from(new Set(dates));

    for (const date of uniqueDates) {
      try {
        await rtjService.create({ date: date });
      } catch (error: any) {
        error.statusCode == 400 ? console.error("Skipped: Already Exists", error.message) :
          console.error("Error in RTJ creation:", error);
      }
    }
    rtjService.cleanup();
    // console.log("Transactions:", transactions)
  }

  private async storeDFCInDatabase (dfc: any, operatorId: string) {
    try {
      const dfcDate = this.parseFrenchDate(dfc.date);
      if (isNaN(dfcDate.getTime())) {
        throw new Error(`Invalid date: ${dfc.date}`);
      }

      // First, upsert the DailyFinancialClosure without details
      const upsertedDFC = await prisma.dailyFinancialClosure.upsert({
        where: {
          date_operatorId: {
            date: dfcDate,
            operatorId: operatorId,
          },
        },
        update: {
          montant: parseFloat(dfc.montant),
          nbreTransaction: dfc.nbreTransaction,
        },
        create: {
          // societyId: dfc.societyId,
          date: dfcDate,
          montant: parseFloat(dfc.montant),
          nbreTransaction: dfc.nbreTransaction,
          operatorId: operatorId,
        },
      });

      // Then, for each detail, create or update the Detail and Approbation
      for (const detailData of dfc.details) {
        const detail = await prisma.detail.upsert({
          where: {
            dfcId_operateur: {
              dfcId: upsertedDFC.id,
              operateur: detailData.operateur,
            },
          },
          update: {
            nbrTransaction: detailData.nbrTransaction,
            montantRecolte: detailData.montantRecolte,
          },
          create: {
            dfcId: upsertedDFC.id,
            operateur: detailData.operateur,
            nbrTransaction: detailData.nbrTransaction,
            montantRecolte: detailData.montantRecolte,
          },
        });

        const approbationData: any = {
          where: {
            detailId: detail.id,
          },
          update: {
            status: "En cours d'analyse",
            date: new Date(),
          },
          create: {
            detailId: detail.id,
            status: "En cours d'analyse",
            date: new Date(),
          },
        };

        if (detailData.approbation && detailData.approbation.iduser) {
          approbationData.update.iduser = detailData.approbation.iduser;
          approbationData.create.iduser = detailData.approbation.iduser;
        }

        await prisma.approbation.upsert(approbationData);
      }
    } catch (error) {
      console.error("Error in storeDFCInDatabase:", error);
      throw error;
    }
  }

  private parseFrenchDate (dateString: string): Date {
    // Check if the date is already in ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return new Date(dateString);
    }

    // If not, assume it's in French format (DD/MM/YYYY)
    const [day, month, year] = dateString.split("/").map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    return new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
  }
}

export default new CronService();
