import { PrismaClient, TransactionStatus } from "@prisma/client";
import { ApprobationInterface } from "../interfaces/approbation";
import rtj from "./rtj";
const prisma = new PrismaClient();

export default class TransactionRepository {

  async getPartnerId (partnerId: string) {
    const partner = await prisma.codeSociety.findFirst({ where: { idPartner: partnerId } });
    return partner?.id;
  }
  async forExport (societe?: string, dateFrom?: string, dateTo?: string, operateurId?: string, query?: string, partenaire?: string, status?: string | string[]) {
    const searchConditions: any = {
      AND: [
        societe ? { NameSociety: societe.toUpperCase() } : {},
        // partenaire ? { codeSocietyId: await this.getPartnerId(partenaire) } : {},
        partenaire ? { operateurId: partenaire } : {},
        dateFrom ? { dateFlux: { gte: new Date(dateFrom) } } : {},
        dateTo ? { dateFlux: { lte: new Date(dateTo) } } : {},
        operateurId && !partenaire ? { operateurId } : {},
        status ? { status: typeof status !== "string" ? { in: status } : status } : {},
        // TODO: Query
        { statutOperations: "SUCCES" }
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    if (query) {
      searchConditions.OR = [
        { referenceClient: { contains: query, mode: "insensitive" } },
        { referenceContrat: { contains: query, mode: "insensitive" } },
        { numeroRecu: { contains: query, mode: "insensitive" } },
        { facture: { contains: query, mode: "insensitive" } },
      ];
    }
    console.log("Search Conditions for Transaction Export", searchConditions);

    const result = await prisma.transaction.findMany({
      where: searchConditions,
      orderBy: { dateDePaiement: "desc" },
      select: {
        referenceContrat: true,
        facture: true,
        // referenceTransaction: true,
        dateDePaiement: true,
        dateFlux: true,
        montant: true,
        numeroRecu: true,
        operateur: { select: { name: true } },
        source: true,
      }
    });
    const final_result = result.map((r: any) => ({
      referenceContrat: r.referenceContrat,
      facture: r.facture,
      referenceTransaction: r.referenceTransaction,
      dateDePaiement: r.dateDePaiement,
      dateFlux: r.dateFlux,
      montant: r.montant,
      numeroRecu: r.numeroRecu,
      operateur: r.operateur.name,
      source: r.source,
    }));
    return final_result;
  }

  async addBulkTransactions (transactions: any[], id: string) {
    const results: any[] = [];
    for (const transaction of transactions) {
      try {
        // Check if society exists, if not create it
        let society = await prisma.society.findFirst({
          where: { codeSociety: transaction.societe },
        });
        if (!society) {
          society = await prisma.society.create({
            data: {
              name: transaction.societe,
              codeSociety: transaction.societe,
              status: "active",
              userId: id,
            },
          });
        }

        // Check if partner exists for this society, if not create it
        let partner = await prisma.partner.findFirst({
          where: {
            code: {
              some: {
                code: transaction.CodeOperateur,
                society: { id: society.id },
              },
            },
          },
          include: {
            code: {
              include: {
                society: true,
              },
            },
          },
        });
        if (!partner) {
          partner = await prisma.partner.create({
            data: {
              name: transaction.Operateur,
              logo: "", // Set a default logo
              color: "", // Set a default color
              adress: { mail: "", phone: "" }, // Set default address
              status: "active",
              code: {
                create: {
                  code: transaction.CodeOperateur,
                  society: {
                    connect: { id: society.id },
                  },
                },
              },
            },
            include: {
              code: {
                include: {
                  society: true,
                },
              },
            },
          });
        }

        // Find the specific CodeSociety for this transaction
        const codeSociety = partner.code.find(
          (c) =>
            c.code === transaction.CodeOperateur && c.society.id === society.id,
        );

        if (!codeSociety) {
          throw new Error(
            `CodeSociety not found for operator ${transaction.CodeOperateur} and society ${society.id}`,
          );
        }

        // Create the transaction
        const newTransaction = await prisma.transaction.create({
          data: {
            canal: "Mobile",
            referenceClient: transaction.RefClient || "",
            referenceContrat: transaction.RefContrat,
            referenceTransaction: transaction.numeroRecu || `TR-${Date.now()}`,
            facture: transaction.RefFacture || "",
            numeroRecu: transaction.numeroRecu,
            operateur: { connect: { id: partner.id } },
            source: transaction.SOURCE.toUpperCase(),
            // origine_saphir: transaction.SOURCE || "TEST",
            statutOperations: "Completed",
            details: JSON.stringify(transaction),
            dateDePaiement: new Date(transaction.DateHeureRgl),
            dateFlux: new Date(transaction.DateHeureFlux),
            montant: transaction.MontantTransaction,
            society: { connect: { id: society.id } },
            codeSociety: { connect: { id: codeSociety.id } },
            status: "Analyzing",
            NameSociety: society.name,
            Code_Id: `${transaction.numeroRecu}_${codeSociety.code}`
          },
        });

        results.push(newTransaction);
      } catch (error) {
        console.error(
          `Error processing transaction: ${transaction.RefTransaction}`,
          error,
        );
        results.push({
          error: `Failed to process transaction: ${transaction.RefTransaction}`,
        });
      }
    }
    return results;
  }

  async getDFCAll () {
    return await prisma.dailyFinancialClosure.findMany();
  }

  async add (transaction: any) {
    const error: any = new Error(
      "Création impossible (la transaction existe déjà)",
    );
    const exist = await prisma.transaction.findFirst({
      where: { numeroRecu: transaction.numeroRecu, operateurId: transaction.operateurId },
    });

    if (exist) {
      console.warn("Attempted insertion: ", transaction);
      console.warn("Transaction already exists:", `Numéro de reçu: ${transaction.numeroRecu} Opérateur: ${transaction.operateurId}`, exist);
      error.statusCode = 400;
      throw error;
    }

    const result = await prisma.transaction.create({
      data: transaction,
      include: {
        operateur: true,
        society: true,
        codeSociety: true,
      },
    });

    const env = (globalThis as any)?.process?.env;
    if (result && env?.ENABLE_RTJ_ACTUALIZE === "true") {
      rtj.actualize(result.dateFlux).catch((err: unknown) => {
        console.error("RTJ actualize failed", err);
      });
    }

    return result;
  }

  async getAll (filters: any) {
    return await prisma.transaction.findMany(
      filters,
    );
  }

  async getAllPaginate (
    currentPage: number,
    filters: {
      query?: string;
      canal?: string;
      dateDePaiement?: string;
      operateurId?: string | string[];
      statutOperations?: string;
      dateFrom?: string;
      dateTo?: string;
      numeroRecu?: string;
      societyId?: string | string[];
      codeSocietyId?: string;
      partnerId?: string;
      societe?: string;
      // status?: TransactionStatus | TransactionStatus[]
      status?: string | string[];
    },
  ) {
    const itemsPerPage = 10;
    let searchConditions: any = {};

    if (filters.query) {
      searchConditions.OR = [
        { referenceClient: { contains: filters.query, mode: "insensitive" } },
        { referenceContrat: { contains: filters.query, mode: "insensitive" } },
        { numeroRecu: { contains: filters.query, mode: "insensitive" } },
        { facture: { contains: filters.query, mode: "insensitive" } },
      ];
    }

    if (filters.canal) searchConditions.canal = filters.canal;
    if (filters.numeroRecu) searchConditions.numeroRecu = filters.numeroRecu;
    if (filters.dateDePaiement)
      // searchConditions.dateDePaiement = filters.dateDePaiement;
      searchConditions.dateFlux = filters.dateDePaiement;

    if (filters.operateurId) {
      searchConditions.operateurId = Array.isArray(filters.operateurId)
        ? { in: filters.operateurId }
        : filters.operateurId;
    }
    if (filters.status) searchConditions.status = typeof filters.status != "string"
      ? { in: filters.status }
      : filters.status;

    if (filters.status) console.log("filters.status", filters.status, typeof "Familiar", Array.isArray(filters.operateurId));
    if (filters.statutOperations)
      searchConditions.statutOperations = filters.statutOperations;
    if (filters.dateFrom)
      searchConditions.dateFlux = { gte: new Date(filters.dateFrom) };
    if (filters.dateTo)
      searchConditions.dateFlux = {
        ...searchConditions.dateFlux,
        lte: new Date(filters.dateTo),
      };
    if (filters.societyId) {
      searchConditions.societyId = Array.isArray(filters.societyId)
        ? { in: filters.societyId }
        : filters.societyId;
    }
    // No else: if societyId is not provided, service layer must handle it
    if (filters.partnerId) searchConditions.operateurId = filters.partnerId;
    if (filters.codeSocietyId)
      searchConditions.codeSocietyId = filters.codeSocietyId;

    if (filters.societe) searchConditions.NameSociety = filters.societe.toUpperCase();
    console.log("SEARCH CONDITIONS", searchConditions);

    const count = await prisma.transaction.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);

    const record = await prisma.transaction.findMany({
      where: searchConditions,
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
      include: {
        operateur: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        society: true,
        codeSociety: true,
      },
      orderBy: { dateFlux: "desc" },
    });

    const filtered = record.map((rec) => {
      // const { facture, ...rest } = rec;
      // return rest;
      return rec;
    });

    // 🔍 LOGS DE DIAGNOSTIC
    console.log("🔍 REPOSITORY FIRST RECORD:", filtered[0]);
    if (filtered[0]) {
      console.log("🔍 REPO dateDePaiement:", typeof filtered[0].dateDePaiement, filtered[0].dateDePaiement);
      console.log("🔍 REPO dateFlux:", typeof filtered[0].dateFlux, filtered[0].dateFlux);
      console.log("🔍 REPO dateDePaiement instanceof Date:", filtered[0].dateDePaiement instanceof Date);
      console.log("🔍 REPO dateFlux instanceof Date:", filtered[0].dateFlux instanceof Date);
    }

    return { record: filtered, itemsPerPage, count, totalPages, currentPage };
  }

  async getOne (id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: {
        id: id,
      },
      include: {
        operateur: {
          include: {
            code: true,
          },
        },
        society: true,
        codeSociety: true,
      },
    });

    // Filter out transactions with null societyId
    if (transaction && !transaction.societyId) {
      return null;
    }

    return transaction;
  }

  async createApprobation (approbationData: ApprobationInterface) {
    return await prisma.approbation.create({
      data: approbationData,
    });
  }

  async updateApprobation (
    id: string,
    updateData: Partial<ApprobationInterface>,
  ) {
    return await prisma.approbation.update({
      where: { id },
      data: updateData,
    });
  }

  async getAllByOperator (
    operatorId: string,
    p0: { include: { operateur: boolean; }; },
  ) {
    return await prisma.transaction.findMany({
      where: {
        operateurId: operatorId,
        NOT: { societyId: null }, // Defensive filter
      },
      include: {
        operateur: {
          include: {
            code: true,
          },
        },
        society: true,
        codeSociety: true,
      },
      orderBy: { dateFlux: "desc" },
    });
  }

  async getDFCById (id: string) {
    return await prisma.dailyFinancialClosure.findUnique({
      where: { id },
      include: {
        operator: true,
        details: true
      }
    });
  }

  async getAllDFCsPaginated (
    // societe: string,
    currentPage: number,
    query?: string,
    dateFrom?: string,
    dateTo?: string,
    filters?: {
      // societyId: string[] | undefined;
      partnerId: string | undefined;
    }) {
    const itemsPerPage = 10;
    let clause: any = {};
    let conditions: any[] = [];

    // Handle operator name search
    if (query) {
      conditions.push({
        operator: {
          name: { contains: query, mode: "insensitive" }
        }
      });
    }

    // if (filters?.societyId) {
    //   conditions.push({
    //     societyId: filters.societyId
    //   })
    // }
    if (filters?.partnerId) {
      conditions.push({
        operatorId: filters.partnerId
      });
    }

    // Handle date range filtering
    let dateCondition: any = {};
    if (dateFrom) {
      dateCondition.gte = new Date(dateFrom);
    }
    if (dateTo) {
      dateCondition.lte = new Date(dateTo);
    }

    if (Object.keys(dateCondition).length > 0) {
      conditions.push({
        date: dateCondition
      });
    }

    // Combine all conditions with AND
    if (conditions.length > 0) {
      clause = {
        AND: conditions
      };
    }

    const count = await prisma.dailyFinancialClosure.count({
      where: clause
    });

    const totalPages = Math.ceil(count / itemsPerPage);

    const records = await prisma.dailyFinancialClosure.findMany({
      where: clause,
      include: {
        operator: true
      },
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
      orderBy: { date: 'desc' }
    });

    return { records, itemsPerPage, count, totalPages, currentPage };
  }
  async approveDfc (id: string, approval: boolean, content: { source?: string, destination?: string, message?: string; }) {
    return await prisma.dailyFinancialClosure.update({
      where: { id },
      data: {
        status: approval ? 1 : 2,
        message: content.message ? content.message : null,
        source_account: content.source ? content.source : null,
        destination_account: content.destination ? content.destination : null
      }
    });
  };
}
