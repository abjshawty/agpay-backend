import TransactionRepository from "../repository/transactions";
import chunkdata from "../data/chunkdata";
import { PrismaClient, TransactionStatus } from "@prisma/client";
import {
  FinancialClosure,
  OperatorDetail,
} from "../interfaces/financialClosure";
import { TransactionInterface } from "../interfaces/transaction";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ApprobationInterface } from "../interfaces/approbation";
import society from "./society";
const prisma = new PrismaClient();
type RequestBody = {
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
class TransactionService {
  private repo = new TransactionRepository();
  async getByAmountPlages (
    userData: { id: string, iat: number; },
    societyName: string
  ) {
    try {
      console.log("CVE", userData);
      // SECURITY: Load user and validate society access
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // Validate society access
      const society = await prisma.society.findFirst({
        where: { name: societyName.toUpperCase() }
      });
      if (!society) {
        const error: any = new Error("Société introuvable");
        error.statusCode = 404;
        throw error;
      }
      // Validate user has access to this society
      await this.validateSocietyAccess(user, society.id);

      const endDate = new Date();
      endDate.setHours(0, 0, 0, 0);
      const startDate = new Date(endDate.getTime() - 1 * 24 * 60 * 60 * 1000); // One day timespan
      const allTransactions = await this.repo.getAll({
        include: { operateur: true },
        where: {
          dateFlux: {
            gte: startDate,
            lte: endDate,
          },
          society: {
            name: societyName,
          }
        }
      });

      let range0_10k = 0;
      let range10k_50k = 0;
      let range50k_200k = 0;
      let range200k_500k = 0;
      let rangeBeyond = 0;

      allTransactions.forEach(transaction => {
        const currAmount = transaction.montant;
        if (currAmount < 10000) {
          range0_10k++;
        } else if (currAmount < 50000) {
          range10k_50k++;
        } else if (currAmount < 200000) {
          range50k_200k++;
        } else if (currAmount < 500000) {
          range200k_500k++;
        } else {
          rangeBeyond++;
        }
      });

      const totalNumber = allTransactions.length;

      // Gérer le cas où il n'y a aucune transaction (évite division par zéro)
      if (totalNumber === 0) {
        return {
          z1: 0,
          z2: 0,
          z3: 0,
          z4: 0,
          z5: 0,
          dateFrom: startDate,
          dateTo: endDate
        };
      }

      const percentages = {
        z1: Math.round((range0_10k / totalNumber) * 10000) / 100,
        z2: Math.round((range10k_50k / totalNumber) * 10000) / 100,
        z3: Math.round((range50k_200k / totalNumber) * 10000) / 100,
        z4: Math.round((range200k_500k / totalNumber) * 10000) / 100,
        z5: Math.round((rangeBeyond / totalNumber) * 10000) / 100,
        dateFrom: startDate,
        dateTo: endDate
      };
      return percentages;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getSourceRev2093 () {
    try {
      const sv2 = await prisma.transaction.updateMany({
        data: {
          source: "SV2",
        },
        where: {
          source: "sv2",
        },
      });
      const sv3 = await prisma.transaction.updateMany({
        data: {
          source: "SV3",
        },
        where: {
          source: "sv3"
        }
      });
      return {
        sv2,
        sv3,
      };
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async create (buildData: RequestBody) {
    try {
      console.log(buildData);
      const code = await prisma.codeSociety.findUnique({
        where: { code: buildData.code },
      });
      if (!code) {
        throw new Error("CodeSociety not found");
      }
      const operateur = await prisma.partner.findUnique({
        where: { id: code.idPartner },
      });
      if (!operateur) {
        throw new Error("Partner not found");
      }
      const society = await prisma.society.findUnique({
        where: { id: code.idSociety },
      });
      if (!society) {
        throw new Error("Society not found");
      }
      const data = {
        canal: buildData.canal,
        referenceClient: buildData.referenceClient,
        referenceContrat: buildData.referenceContrat,
        referenceTransaction: buildData.referenceTransaction || "",
        facture: buildData.facture,
        numeroRecu: buildData.numeroRecu,
        operateurId: operateur.id,
        societyId: society.id,
        statutOperations: buildData.statutOperations,
        details: buildData.details || "",
        dateDePaiement: new Date(buildData.dateDePaiement),
        montant: buildData.montant,
        dateFlux: new Date(buildData.dateFlux),
        source: buildData.source.toUpperCase(),
        codeSocietyId: code.id,
        status: TransactionStatus.Analyzing,
        NameSociety: society.name,
      };
      const result = await this.repo.add(data);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async loadAllDataFromChunkdata (id: string) {
    try {
      const result = await this.repo.addBulkTransactions(chunkdata, id);

      return {
        success: true,
        message: "All data loaded successfully",
        data: result,
      };
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAll (filters: {
    query?: string;
    canal?: string;
    operateurId?: string;
    statutOperations?: string;
    dateDePaiement?: string;
    dateFrom?: string;
    dateTo?: string;
    societyId?: string;
    codeSocietyId?: string;
  }) {
    try {
      const result = await this.repo.getAll({
        ...filters,
        include: { operateur: true },
      });
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  /**
   * Get all society IDs accessible by a partner via CodeSociety
   * @param partnerId - Partner ID from external user
   * @returns Array of society IDs that this partner has access to
   */
  private async getPartnerSocieties (partnerId: string): Promise<string[]> {
    const codeSocieties = await prisma.codeSociety.findMany({
      where: { idPartner: partnerId },
      select: { idSociety: true }
    });

    return codeSocieties.map(cs => cs.idSociety);
  }

  /**
   * Validate society access for a user (INTERNAL or EXTERNAL)
   * @param user - User object with societyId array
   * @param requestedSocietyId - Optional societyId(s) to validate
   * @returns Validated societyId(s) - either requested (if valid) or all user's societies
   * @throws 403 error if user has no society access or requested society is not allowed
   */
  private async validateSocietyAccess (
    user: any,
    requestedSocietyId?: string | string[]
  ): Promise<string | string[]> {
    let userSocieties: string[];

    // EXTERNAL users: Get societies via CodeSociety (Partner → CodeSociety → Society)
    if (user.type === "EXTERNAL" && user.partnerId) {
      userSocieties = await this.getPartnerSocieties(user.partnerId);

      // SECURITY: External user MUST have at least one society via CodeSociety
      if (userSocieties.length === 0) {
        const error: any = new Error("Partner has no society access via CodeSociety");
        error.statusCode = 403;
        throw error;
      }
    }
    // INTERNAL users: Use societyId directly
    else {
      // SECURITY: Internal user MUST have at least one society
      if (!user.societyId || user.societyId.length === 0) {
        const error: any = new Error("User has no society access");
        error.statusCode = 403;
        throw error;
      }
      userSocieties = user.societyId;
    }

    // If a specific society is requested, validate access
    if (requestedSocietyId) {
      const requestedSocieties = Array.isArray(requestedSocietyId)
        ? requestedSocietyId
        : [requestedSocietyId];

      // SECURITY: Verify ALL requested societies are in user's allowed societies
      const hasAccess = requestedSocieties.every(sid =>
        userSocieties.includes(sid)
      );

      if (!hasAccess) {
        const error: any = new Error("Accès refusé à cette société");
        error.statusCode = 403;
        throw error;
      }

      return requestedSocietyId;
    }

    // Return all user's accessible societies
    return userSocieties;
  }

  async getAllPaginate (
    userData: { id: string, iat: number; },
    currentPage: number,
    filters: {
      query?: string;
      canal?: string;
      operateurId?: string | string[];
      statutOperations?: string;
      numeroRecu?: string;
      dateDePaiement?: string;
      dateFrom?: string;
      dateTo?: string;
      societyId?: string | string[];
      codeSocietyId?: string;
      partnerId?: string;
      societe?: string;
      status?: string | string[];
    },
  ) {
    try {
      // Get the current user's type
      console.log("User Data", userData);
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }
      const userType = user.type;

      // SECURITY: Validate society access for ALL users (INTERNAL and EXTERNAL)
      filters.societyId = await this.validateSocietyAccess(user, filters.societyId);

      // Type-specific parsing and filters
      if (userType === "INTERNAL") {
        // Handle multiple operatorIds for INTERNAL users
        if (typeof filters.operateurId === "string" && filters.operateurId) {
          filters.operateurId = filters.operateurId.split("-");
        }
        if (typeof filters.status === "string" && filters.status.includes("-")) {
          filters.status = filters.status.split("-");
        }
      } else {
        // Force partnerId for EXTERNAL users
        filters.partnerId = user.partnerId ? user.partnerId : undefined;
      }

      const result = await this.repo.getAllPaginate(currentPage, filters);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getPaginateDFC (
    userData: { id: string; iat: number; },
    currentPage: number,
    query?: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // SECURITY: Validate society access for ALL users
      await this.validateSocietyAccess(user);

      const userType = user.type;
      if (userType == "INTERNAL") {
        // TODO: Add societyId filtering for INTERNAL users based on user.societyId
        const result = await this.repo.getAllDFCsPaginated(currentPage, query, dateFrom, dateTo);
        return result;
      } else {
        const result = await this.repo.getAllDFCsPaginated(currentPage, query, dateFrom, dateTo, {
          partnerId: user.partnerId ? user.partnerId : undefined,
          // TODO: Implement societyId filtering in repository for DFCs
        });
        return result;
      }
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async exportPaginatedData (
    userData: { id: string, iat: number; },
    currentPage: number,
    filters: {
      query?: string;
      canal?: string;
      operateurId?: string;
      statutOperations?: string;
      dateFrom?: string;
      dateTo?: string;
      societyId?: string;
      codeSocietyId?: string;
    },
    format: "csv" | "excel" | "pdf",
  ) {
    try {
      const paginatedData = await this.getAllPaginate(userData, currentPage, filters);
      const transactions = paginatedData.record;

      const formattedData = transactions.map((transaction) => ({
        ID: transaction.id,
        Canal: transaction.canal,
        ReferenceClient: transaction.referenceClient,
        ReferenceContrat: transaction.referenceContrat,
        // Facture: transaction.facture,
        NumeroRecu: transaction.numeroRecu,
        Operateur: transaction.operateur.name,
        StatutOperations: transaction.statutOperations,
        Montant: transaction.montant,
        DateDePaiement: transaction.dateDePaiement.toISOString(),
        DateFlux: transaction.dateFlux.toISOString(),
        Source: transaction.source,
        Societe: transaction.society?.name ?? 'N/A',
        CodeSociete: transaction.codeSociety.code,
      }));

      switch (format) {
        case "csv":
          return this.exportToCsv(formattedData);
        case "excel":
          return this.exportToExcel(formattedData);
        case "pdf":
          return this.exportToPdf(formattedData);
        default:
          throw new Error("Format non supporté");
      }
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne (id: string) {
    try {
      const result = await this.repo.getOne(id);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getTransactionPercentageByOperator (
    userData: { id: string, iat: number; },
    societe?: string
  ) {
    try {
      // SECURITY: Load user and validate society access
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // Validate society access if societe name is provided
      if (societe) {
        const society = await prisma.society.findFirst({
          where: { name: societe.toUpperCase() }
        });
        if (!society) {
          const error: any = new Error("Société introuvable");
          error.statusCode = 404;
          throw error;
        }
        // Validate user has access to this society
        await this.validateSocietyAccess(user, society.id);
      } else {
        // If no society specified, validate user has at least one society
        await this.validateSocietyAccess(user);
      }

      // Définir la plage de dates (dernières 24h)
      const dateTo = new Date();
      dateTo.setHours(0, 0, 0, 0);
      const dateFrom = new Date(dateTo.getTime() - 1 * 24 * 60 * 60 * 1000);

      // Utiliser groupBy pour agréger directement dans la base de données
      const stats = await prisma.transaction.groupBy({
        by: ['operateurId'],
        where: {
          dateFlux: {
            gte: dateFrom,
            lte: dateTo,
          },
          society: {
            name: societe,
          }
        },
        _count: { id: true }
      });

      // Calculer le total des transactions
      const totalTransactions = stats.reduce((sum, s) => sum + s._count.id, 0);

      // Gérer le cas où il n'y a pas de transactions
      if (totalTransactions === 0) {
        return {
          data: [],
          dateFrom,
          dateTo
        };
      }

      // Charger les noms des opérateurs en une seule requête
      const operatorIds = stats.map(s => s.operateurId);
      const operators = await prisma.partner.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, name: true }
      });
      const operatorMap = new Map(operators.map(o => [o.id, o.name]));

      // Calculer les pourcentages et trier
      const percentages = stats.map(s => ({
        operator: operatorMap.get(s.operateurId) || 'Inconnu',
        percentage: Math.floor(((s._count.id / totalTransactions) * 100) * 10) / 10,
      })).sort((a, b) => b.percentage - a.percentage);

      return {
        data: percentages.slice(0, 5),
        dateFrom,
        dateTo
      };
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getTransactionCountAndAmountByOperator (
    userData: { id: string, iat: number; },
    societe: string,
    operatorId?: string,
    forToday: boolean = false,
  ) {
    try {
      // SECURITY: Load user and validate society access
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // Validate society access
      const society = await prisma.society.findFirst({
        where: { name: societe.toUpperCase() }
      });
      if (!society) {
        const error: any = new Error("Société introuvable");
        error.statusCode = 404;
        throw error;
      }
      await this.validateSocietyAccess(user, society.id);

      // Initialize Date Range
      const mostRecentDate = new Date();
      mostRecentDate.setHours(0, 0, 0, 0);

      let dateFrom: Date;
      let dateTo: Date;

      if (forToday) {
        dateFrom = mostRecentDate;
        dateTo = new Date(mostRecentDate.getTime() + 25 * 60 * 60 * 1000);
      } else {
        dateFrom = new Date(mostRecentDate.getTime() - 1 * 24 * 60 * 60 * 1000);
        dateTo = mostRecentDate;
      }

      // Build where clause for groupBy
      const whereClause: any = {
        society: { name: societe },
        ...(forToday
          ? { dateDePaiement: { gte: dateFrom } }
          : { dateFlux: { gte: dateFrom, lte: dateTo } }
        ),
        ...(operatorId && { operateurId: operatorId })
      };

      // Use groupBy to aggregate directly in the database
      const stats = await prisma.transaction.groupBy({
        by: ['operateurId'],
        where: whereClause,
        _count: { id: true },
        _sum: { montant: true }
      });

      // If no transactions found, return empty result
      if (stats.length === 0) {
        return {
          data: [],
          dateFrom: dateFrom,
          dateTo: dateTo
        };
      }

      // Sort by amount descending and take top 5
      const sortedStats = stats
        .map(s => ({
          operateurId: s.operateurId,
          count: s._count.id,
          amount: s._sum.montant ? parseFloat(s._sum.montant.toString()) : 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Load operator info in a single query
      const operatorIds = sortedStats.map(s => s.operateurId);
      const operators = await prisma.partner.findMany({
        where: { id: { in: operatorIds } },
        select: {
          id: true,
          name: true,
          code: true,
          logo: true,
          color: true,
          adress: true,
          status: true
        }
      });
      const operatorMap = new Map(operators.map(o => [o.id, o]));

      // Build final result
      const result = sortedStats.map(stat => {
        const operator = operatorMap.get(stat.operateurId);
        return {
          operator: operator || {
            id: stat.operateurId,
            name: 'Unknown',
            code: '',
            logo: '',
            color: '',
            adress: '',
            status: ''
          },
          transactionCount: stat.count,
          totalAmount: Number(stat.amount.toFixed(2)),
        };
      });

      return {
        data: result,
        dateFrom: dateFrom,
        dateTo: dateTo,
      };
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getDailyFinancialClosuresAll () {
    try {
      const result = await this.repo.getDFCAll();
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getDailyFinancialClosures (
    currentPage: number = 1,
    itemsPerPage: number = 10,
    operatorId?: string,
    startDate?: Date,
    endDate?: Date,
    montant?: number | undefined,
  ) {
    try {
      const { uniqueDates, totalPages } =
        await this.getUniqueDatesAndTotalPages(
          currentPage,
          itemsPerPage,
          operatorId,
          startDate,
          endDate,
        );
      const paginatedDates = this.getPaginatedDates(
        uniqueDates,
        currentPage,
        itemsPerPage,
      );
      const record = await this.getFinancialClosuresForDates(
        paginatedDates.map((d) => d.dateFlux),
        operatorId,
        montant,
      );

      return {
        totalPages,
        itemsPerPage,
        currentPage,
        record,
      };
    } catch (error: any) {
      console.error("Error in getDailyFinancialClosures:", error);
      throw new Error("Failed to retrieve daily financial closures");
    }
  }
  async getLastNDaysTransactions (
    userData: { id: string, iat: number; },
    operatorId?: string,
    old_numberOfDays: number = 10,
    societe?: string,
  ): Promise<
    {
      date: string;
      totalTransactions: number;
      totalAmount: number;
      amountGrowthRate: string;
      transactionGrowthRate: string;
    }[]
  > {
    const numberOfDays = old_numberOfDays > 1 ? old_numberOfDays : 2;
    try {
      // SECURITY: Load user and validate society access
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // Validate society access if societe name is provided
      if (societe) {
        const society = await prisma.society.findFirst({
          where: { name: societe.toUpperCase() }
        });
        if (!society) {
          const error: any = new Error("Société introuvable");
          error.statusCode = 404;
          throw error;
        }
        // Validate user has access to this society
        await this.validateSocietyAccess(user, society.id);
      } else {
        // If no society specified, validate user has at least one society
        await this.validateSocietyAccess(user);
      }

      // Get the date of the last recorded transaction
      const lastTransaction = await prisma.transaction.findFirst({
        orderBy: {
          dateFlux: "desc",
        },
        select: {
          dateFlux: true,
        },
      });

      if (!lastTransaction) {
        throw new Error("No transactions found");
      }

      // const endDate = lastTransaction.dateFlux;
      const endDate = new Date();
      endDate.setHours(0, 0, 0, 0);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (numberOfDays - 1)); // Get the last N days
      const whereClause: any = {
        dateFlux: {
          gte: startDate,
          lte: endDate,
        },
        society: {
          name: societe,
        },
        operateurId: operatorId,
      };

      if (operatorId) {
        whereClause.operateurId = operatorId;
      }
      const transactions = await prisma.transaction.findMany({
        where: whereClause,
        select: {
          dateFlux: true,
          montant: true,
        },
        orderBy: {
          dateFlux: "desc",
        },
      });

      const dailyData: {
        [key: string]: { totalTransactions: number; totalAmount: number; };
      } = {};

      // Initialize dailyData with all dates in the range
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = d.toISOString().split("T")[0];
        dailyData[dateKey] = { totalTransactions: 0, totalAmount: 0 };
      }

      transactions.forEach((transaction) => {
        const date = transaction.dateFlux.toISOString().split("T")[0];
        const amount = parseFloat(transaction.montant.toString());

        dailyData[date].totalTransactions += 1;
        dailyData[date].totalAmount += amount;
      });

      let result = Object.entries(dailyData).map(
        ([date, data], index, array) => {
          let amountGrowthRate = "0%";
          let transactionGrowthRate = "0%";
          if (index > 0) {
            const prevDay = array[index - 1][1];
            if (prevDay.totalAmount !== 0) {
              const amountGrowthRateValue =
                ((data.totalAmount - prevDay.totalAmount) /
                  prevDay.totalAmount) *
                100;
              amountGrowthRate = `${amountGrowthRateValue.toFixed(2)}%`;
            }
            if (prevDay.totalTransactions !== 0) {
              const transactionGrowthRateValue =
                ((data.totalTransactions - prevDay.totalTransactions) /
                  prevDay.totalTransactions) *
                100;
              transactionGrowthRate = `${transactionGrowthRateValue.toFixed(2)}%`;
            }
          }

          return {
            date: this.formatDateWithYear(new Date(date)),
            totalTransactions: data.totalTransactions,
            totalAmount: Number(data.totalAmount.toFixed(2)),
            amountGrowthRate,
            transactionGrowthRate,
          };
        },
      );

      // Sort the result array to show most recent dates first
      result.sort((a, b) => {
        const dateA = new Date(a.date.split("/").reverse().join("-"));
        const dateB = new Date(b.date.split("/").reverse().join("-"));
        return dateB.getTime() - dateA.getTime();
      });

      return result.slice(0, old_numberOfDays);
    } catch (error: any) {
      console.error("Error in getLastNDaysTransactions:", error);
      throw new Error("Failed to retrieve last N days transactions");
    }
  }
  formatDateWithYear (date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  private formatDate (date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}`;
  }
  private async getUniqueDatesAndTotalPages (
    currentPage: number,
    itemsPerPage: number,
    operatorId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const whereClause: any = operatorId ? { operateurId: operatorId } : {};
    if (startDate && endDate) {
      whereClause.dateFlux = {
        gte: startDate,
        lte: endDate,
      };
    } else if (startDate) {
      whereClause.dateFlux = { gte: startDate };
    } else if (endDate) {
      whereClause.dateFlux = { lte: endDate };
    }
    const uniqueDates = await prisma.transaction.groupBy({
      by: ["dateFlux"],
      where: whereClause,
      orderBy: {
        dateFlux: "desc",
      },
    });

    const totalCount = uniqueDates.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    return { uniqueDates, totalPages };
  }
  private getPaginatedDates (
    uniqueDates: any[],
    currentPage: number,
    itemsPerPage: number,
  ) {
    const skip = (currentPage - 1) * itemsPerPage;
    return uniqueDates.slice(skip, skip + itemsPerPage);
  }
  private async getFinancialClosuresForDates (
    paginatedDates: Date[],
    operatorId?: string,
    montant?: number,
  ): Promise<FinancialClosure[]> {
    const closures: FinancialClosure[] = [];

    for (const date of paginatedDates) {
      const formattedDate =
        date instanceof Date
          ? date.toISOString().split("T")[0]
          : (date as any).toString();
      const transactions = await this.getTransactionsForDate(date, operatorId);
      const operatorDetails = this.calculateOperatorDetails(transactions);
      const details = await this.populateApprobations(
        operatorDetails,
        transactions,
      );

      const calculatedMontant = this.calculateTotalAmount(transactions);
      const closureData: Partial<FinancialClosure> = {
        date: formattedDate,
        nbreTransaction: transactions.length,
        details,
      };

      if (montant === undefined || calculatedMontant === montant) {
        closureData.montant = calculatedMontant;
        closures.push(closureData as FinancialClosure);
      }
    }

    return closures;
  }
  private async getTransactionsForDate (
    date: Date,
    operatorId?: string,
  ): Promise<TransactionInterface[]> {
    const whereClause: any = {
      dateFlux: date,
      NOT: { societyId: null } // Defensive filter
    };
    if (operatorId) {
      whereClause.operateurId = operatorId;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        operateur: true,
        society: true,
        codeSociety: true,
      },
    });

    return transactions.map((transaction) => ({
      ...transaction,
      operateur: {
        id: transaction.operateur.id,
        name: transaction.operateur.name,
        logo: transaction.operateur.logo,
        color: transaction.operateur.color,
        userId: transaction.operateur.userId,
        status: transaction.operateur.status,
        createdAt: transaction.operateur.createdAt,
        updatedAt: transaction.operateur.updatedAt,
        adress: {
          mail: transaction.operateur.adress?.mail ?? null,
          phone: transaction.operateur.adress?.phone ?? null,
        },
        createdBy: transaction.operateur.createdBy || "anonymous",
      },
      details: transaction.details ?? undefined,
    })) as TransactionInterface[];
  }
  private calculateOperatorDetails (
    transactions: TransactionInterface[],
  ): Record<string, OperatorDetail> {
    return transactions.reduce(
      (acc, t) => {
        if (!acc[t.operateur.name]) {
          acc[t.operateur.name] = {
            operateur: t.operateur.name,
            nbrTransaction: 0,
            montantRecolte: 0,
            approbation: null,
          };
        }
        acc[t.operateur.name].nbrTransaction++;
        acc[t.operateur.name].montantRecolte += t.montant;
        return acc;
      },
      {} as Record<string, OperatorDetail>,
    );
  }
  private async populateApprobations (
    operatorDetails: Record<string, OperatorDetail>,
    transactions: TransactionInterface[],
  ): Promise<OperatorDetail[]> {
    return Promise.all(
      Object.values(operatorDetails).map(async (detail) => {
        const transaction = transactions.find(
          (t) => t.operateur.name === detail.operateur,
        );
        if (transaction) {
          const approbation = await prisma.approbation.findFirst({
            where: {
              detail: {
                dfcId: transaction.id,
                operateur: detail.operateur,
              },
            },
          });

          if (approbation) {
            detail.approbation = {
              status: approbation.status,
              date: approbation.date,
              iduser: approbation.iduser || undefined,
              file: approbation.file || undefined,
              commentary: approbation.commentary || undefined,
            };
          } else {
            detail.approbation = null;
          }
        }
        return detail;
      }),
    );
  }
  private calculateTotalAmount (transactions: TransactionInterface[]): number {
    return transactions.reduce((sum, t) => sum + t.montant, 0);
  }
  private async exportTransactionsToPdf (transactions: TransactionInterface[]) {
    const doc = new PDFDocument();
    doc.fontSize(10).text("Transactions", { align: "center" });
    doc.moveDown();

    const headers = [
      "ID",
      "Canal",
      "Référence Client",
      "Référence Contrat",
      "Facture",
      "Numéro de Recu",
      "Opérateur",
      "Statut des Opérations",
      "Montant",
      "Date de Paiement",
      "Date de Flux",
      "Source",
      "ID de la Société",
      "ID du Code de la Société",
    ];
    const data = transactions.map((t) => [
      t.id,
      t.canal,
      t.referenceClient,
      t.referenceContrat,
      t.facture,
      t.numeroRecu,
      t.operateur.name,
      t.statutOperations,
      t.montant,
      t.dateDePaiement,
      t.dateFlux,
      t.source,
      t.society,
      t.codeSociety,
    ]);

    // Create a table manually since PDFDocument doesn't have a built-in table method
    const tableTop = 50;
    const cellPadding = 5;
    const cellWidth = doc.page.width / headers.length;
    const cellHeight = 20;

    // Draw headers
    headers.forEach((header, i) => {
      doc.rect(i * cellWidth, tableTop, cellWidth, cellHeight).stroke();
      doc.text(header, i * cellWidth + cellPadding, tableTop + cellPadding);
    });

    // Draw rows
    data.forEach((row, rowIndex) => {
      row.forEach((cell, cellIndex) => {
        const y = tableTop + (rowIndex + 1) * cellHeight;
        doc.rect(cellIndex * cellWidth, y, cellWidth, cellHeight).stroke();
        doc.text(
          cell.toString(),
          cellIndex * cellWidth + cellPadding,
          y + cellPadding,
        );
      });
    });

    doc.end();
    return doc;
  }
  async exportTransactionsToExcel (transactions: TransactionInterface[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    // Add headers
    const headers = [
      "ID",
      "Canal",
      "Référence Client",
      "Référence Contrat",
      "Facture",
      "Numéro de Recu",
      "Opérateur",
      "Statut des Opérations",
      "Montant",
      "Date de Paiement",
      "Date de Flux",
      "Source",
      "ID de la Société",
      "ID du Code de la Société",
    ];
    worksheet.columns = headers.map((header) => ({
      header,
      key: header.toLowerCase().replace(/ /g, ""),
    }));

    // Add data
    transactions.forEach((transaction) => {
      worksheet.addRow({
        id: transaction.id,
        canal: transaction.canal,
        referenceClient: transaction.referenceClient,
        referenceContrat: transaction.referenceContrat,
        facture: transaction.facture,
        numeroRecu: transaction.numeroRecu,
        operateur: transaction.operateur.name,
        statutOperations: transaction.statutOperations,
        montant: transaction.montant,
        dateDePaiement: transaction.dateDePaiement,
        dateFlux: transaction.dateFlux,
        source: transaction.source.toUpperCase(),
        societyId: transaction.society,
        codeSocietyId: transaction.codeSociety,
      });
    });

    // Save the workbook to a file
    const excelBuffer = await workbook.xlsx.writeBuffer();
    return excelBuffer;
  }
  private async exportTransactionsToCsv (transactions: TransactionInterface[]) {
    const csv = new Parser();
    const csvData = csv.parse(transactions);
    return csvData;
  }
  async exportDailyFinancialClosures (
    page: number,
    itemsPerPage: number,
    format: "csv" | "excel" | "pdf",
    operatorId?: string,
    filters?: {
      query?: string;
      canal?: string;
      statutOperations?: string;
      dateFrom?: string;
      dateTo?: string;
      montant?: number;
      societyId?: string;
      codeSocietyId?: string;
    },
  ) {
    try {
      const { dateFrom, dateTo } = filters || {};
      const startDate = dateFrom ? new Date(dateFrom) : undefined;
      const endDate = dateTo ? new Date(dateTo) : undefined;

      // Fetch the daily financial closures
      const closures = await this.getDailyFinancialClosures(
        page,
        itemsPerPage,
        operatorId,
        startDate,
        endDate,
        filters?.montant,
      );

      // Prepare the data for export
      const data = closures.record.map((closure) => ({
        Date: new Date(closure.date).toISOString().split("T")[0],
        Montant: closure.montant,
        NombreTransactions: closure.nbreTransaction,
        Operateur: closure.details[0]?.operateur || "N/A",
        Status: closure.details[0]?.approbation?.status || "N/A",
      }));

      // Export based on the requested format
      switch (format) {
        case "csv":
          return this.exportToCsv(data);
        case "excel":
          return this.exportToExcel(data);
        case "pdf":
          return this.exportToPdf(data);
        default:
          throw new Error("Format non supporté");
      }
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  private exportToCsv (data: any[]) {
    const csv = new Parser();
    return csv.parse(data);
  }
  private async exportToExcel (data: any[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Daily Financial Closures");

    // Add headers
    worksheet.columns = Object.keys(data[0]).map((key) => ({
      header: key,
      key: key,
    }));

    // Add data
    worksheet.addRows(data);

    // Return the Excel buffer
    return await workbook.xlsx.writeBuffer();
  }
  private exportToPdf (data: any[]) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        autoFirstPage: false,
        layout: "landscape",
      });
      const buffers: Buffer[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => { // @ts-ignore
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      doc.addPage();

      // Add title
      doc.fontSize(16).text("Daily Financial Closures", { align: "center" });
      doc.moveDown();

      // Add table
      const table = {
        headers: Object.keys(data[0]),
        rows: data.map(Object.values),
      };

      // Create table manually
      const startX = 50;
      let startY = doc.y + 20;
      const cellWidth = (doc.page.width - 2 * startX) / table.headers.length;
      const cellHeight = 20;

      // Draw headers
      doc.font("Helvetica-Bold").fontSize(8);
      table.headers.forEach((header, i) => {
        doc.text(header, startX + i * cellWidth, startY, {
          width: cellWidth,
          height: cellHeight,
          align: "center",
          lineBreak: false,
        });
      });

      // Draw rows
      startY += cellHeight;
      doc.font("Helvetica").fontSize(8);
      table.rows.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
          doc.text(
            cell.toString(),
            startX + cellIndex * cellWidth,
            startY + rowIndex * cellHeight,
            {
              width: cellWidth,
              height: cellHeight,
              align: "center",
              lineBreak: false,
            },
          );
        });
      });

      // Draw lines
      doc.lineWidth(1);
      // Vertical lines
      for (let i = 0; i <= table.headers.length; i++) {
        doc
          .moveTo(startX + i * cellWidth, startY - cellHeight)
          .lineTo(
            startX + i * cellWidth,
            startY + table.rows.length * cellHeight,
          )
          .stroke();
      }
      // Horizontal lines
      for (let i = 0; i <= table.rows.length + 1; i++) {
        doc
          .moveTo(startX, startY - cellHeight + i * cellHeight)
          .lineTo(
            startX + table.headers.length * cellWidth,
            startY - cellHeight + i * cellHeight,
          )
          .stroke();
      }

      doc.end();
    });
  }
  async createApprobation (approbationData: ApprobationInterface) {
    try {
      const result = await this.repo.createApprobation(approbationData);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async updateApprobation (
    id: string,
    updateData: Partial<ApprobationInterface>,
  ) {
    try {
      const result = await this.repo.updateApprobation(id, updateData);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getDFCById (id: string) {
    try {
      const result = await this.repo.getDFCById(id);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async approveDfc (id: string, approval: boolean, content: { source?: string, destination?: string, message?: string; }) {
    try {
      const result = await this.repo.approveDfc(id, approval, content);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  };
  async forExport (societe?: string, dateFrom?: string, dateTo?: string, operateurId?: string, query?: string, partenaire?: string, status?: string | string[]) {
    try {
      const result = await this.repo.forExport(societe, dateFrom, dateTo, operateurId, query, partenaire, status);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}

export default new TransactionService();
