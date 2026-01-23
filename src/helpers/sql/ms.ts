import mssql from 'mssql';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import TransactionRepository from '../../repository/transactions';
const sqlConfig = {
  user: process.env.MS_USER || "",
  password: process.env.MS_PWD || "",
  database: process.env.MS_NAME || "",
  server: process.env.MS_SERVER || "",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: false // change to true for local dev / self-signed certs
  }
};

type Record = {
  gs2e_recap_transaction_prestataireId: string,
  gs2e_codeprestataire: string,
  gs2e_name: string,
  gs2e_message: string,
  gs2e_numerofacture: string,
  gs2e_numerorecu: string,
  gs2e_referencecontrat: string,
  gs2e_referencetransaction: string,
  gs2e_typemessage: string,
  gs2e_montant: number,
  gs2e_version: string,
  gs2e_datereglementprestataire: Date,
  gs2e_code_agregateur: string,
  gs2e_top_integration: string | null,
  gs2e_date_reception: Date,
  gs2e_periode_facturation: string,
  gs2e_statutremonte: Date | null,
  gs2e_dateremonte: Date | null,
  gs2e_date_integration: Date | null,
  CreatedOn: Date;
};
const prisma = new PrismaClient();
async function getCodeSocietyId (partnerCode: string): Promise<string> {
  const codeSociety = await prisma.codeSociety.findFirst({
    where: {
      code: partnerCode.toUpperCase(),
    }
  });
  if (!codeSociety) {
    throw new Error(`CodeSociety not found: ${partnerCode}`);
  }
  return codeSociety.id;
}
async function getOperateurId (operateurCode: string): Promise<string> {
  const codeSociety = await prisma.codeSociety.findFirst({
    where: {
      code: operateurCode.toUpperCase(),
    }
  });
  if (!codeSociety) {
    throw new Error(`Operateur not found: ${operateurCode}`);
  }
  return codeSociety.idPartner;
}
async function getSocietyId (societyCode: string): Promise<string> {
  const society = await prisma.society.findFirst({
    where: {
      codeSociety: societyCode.toUpperCase(),
    }
  });
  if (!society) throw new Error(`Society not found: ${societyCode}`);
  return society.id;
}

class SQLHandler {
  private config;
  server;
  private name: "CIE" | "SODECI";
  private query = `
    SELECT * FROM gs2e_recap_transaction_prestataire 
    WHERE gs2e_typemessage = '0'
      AND CreatedOn > DATEADD(hour, -168, GETDATE())
      AND CreatedOn <= GETDATE()
    ORDER BY CreatedOn DESC
  `;
  //   private query= `select r.* from gs2e_recap_transaction_prestataire r WITH (NOLOCK)
  // where r.gs2e_typemessage='0'
  // and year(convert(date,r.gs2e_date_reception,103))='2025'`
  private repo: TransactionRepository;
  private connection: mssql.ConnectionPool | null = null;
  user: string;
  password: string;
  database_name: string;
  constructor (user: string, password: string, database_name: string, server: string, name: "CIE" | "SODECI") {
    this.config = {
      user,
      password,
      database: database_name,
      server,
      connectionTimeout: 120000, // 2 minutes for connection
      requestTimeout: 120000,    // 2 minutes for queries
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 120000
      },
      options: {
        encrypt: false, // for azure
        trustServerCertificate: true // change to true for local dev / self-signed certs
      }
    };
    this.user = user;
    this.password = password;
    this.database_name = database_name;
    this.server = server;
    this.name = name;
    this.repo = new TransactionRepository();
    this.init();
  }
  private init = async () => {
    await this.connect();
    const testResult = await this.listTransactions();
    console.log("Config", this.config, "Result", testResult);
  };
  private connect = async () => {
    try {
      // const url = `mssql://${this.user}:${this.password}@${this.server}:1433/${this.database_name}`
      // console.log("SQL connection URI", url)
      // this.connection = await mssql.connect(url)
      this.connection = await mssql.connect(this.config);
      console.log(`${this.name} connected to Microsoft SQL Server on ${this.server}`);
    } catch (err) {
      console.error(`Error occured during connection to Microsoft SQL Server: ${err}`);
    }
  };
  private listTransactions = async () => await this.connection?.query(this.query);

  async getTransactions () {
    const transactions = await this.listTransactions();
    if (!this.connection) return;
    const records: Record[] = transactions!.recordset;
    const existingTransactions = (await prisma.transaction.findMany({ select: { numeroRecu: true } })).map(transaction => transaction.numeroRecu);
    const transformedTransactions = await Promise.all(
      records.filter(
        transaction => !existingTransactions.includes(transaction.gs2e_numerorecu)
      ).map(async transaction => {
        return {
          canal: '0000',
          referenceClient: transaction.gs2e_name,
          referenceContrat: transaction.gs2e_referencecontrat,
          facture: transaction.gs2e_numerofacture,
          numeroRecu: transaction.gs2e_numerorecu,
          referenceTransaction: transaction.gs2e_referencetransaction,
          statutOperations: transaction.gs2e_message,
          details: "Remonté via Recap Transactions",
          dateDePaiement: transaction.gs2e_datereglementprestataire,
          montant: transaction.gs2e_montant,
          dateFlux: transaction.gs2e_date_reception,
          source: transaction.gs2e_version,
          codeSocietyId: await getCodeSocietyId(transaction.gs2e_codeprestataire),
          operateurId: await getOperateurId(transaction.gs2e_codeprestataire),
          societyId: await getSocietyId(transaction.gs2e_codeprestataire),
          status: TransactionStatus.Analyzing
        };
      }));
    transformedTransactions.forEach(async transaction => {
      await this.repo.add(transaction);
      await prisma.transaction.create({
        data: transaction
      });
      console.log(`Added Transaction n°${transaction.numeroRecu}`);
    });
  }

  async getFrom (searchDate: Date) {
    const nextDay = new Date(searchDate);
    nextDay.setDate(searchDate.getDate() + 1);
    const searchQuery = `
    SELECT * FROM gs2e_recap_transaction_prestataire 
    WHERE gs2e_typemessage = '0'
      AND CreatedOn >= ${searchDate.getFullYear()}-${searchDate.getMonth()}-${searchDate.getDate()}
      AND CreatedOn < ${nextDay.getFullYear()}-${nextDay.getMonth()}-${nextDay.getDate()}
    ORDER BY CreatedOn DESC
  `;
    const transactions = await this.connection?.query(searchQuery);
    if (!this.connection) return;
    if (!transactions) return;
    const records: Record[] = transactions!.recordset;
    const existingTransactions = (await prisma.transaction.findMany({ select: { numeroRecu: true } })).map(transaction => transaction.numeroRecu);
    const transformedTransactions = await Promise.all(
      records.filter(
        transaction => !existingTransactions.includes(transaction.gs2e_numerorecu) && transaction.CreatedOn >= searchDate && transaction.CreatedOn < nextDay
      ).map(async transaction => {
        return {
          canal: '0000',
          referenceClient: transaction.gs2e_name,
          referenceContrat: transaction.gs2e_referencecontrat,
          facture: transaction.gs2e_numerofacture,
          numeroRecu: transaction.gs2e_numerorecu,
          referenceTransaction: transaction.gs2e_referencetransaction,
          statutOperations: transaction.gs2e_message,
          details: "Remonté via Recap Transactions",
          dateDePaiement: transaction.gs2e_datereglementprestataire,
          montant: transaction.gs2e_montant,
          dateFlux: transaction.gs2e_date_reception,
          source: transaction.gs2e_version,
          codeSocietyId: await getCodeSocietyId(transaction.gs2e_codeprestataire),
          operateurId: await getOperateurId(transaction.gs2e_codeprestataire),
          societyId: await getSocietyId(transaction.gs2e_codeprestataire),
          status: TransactionStatus.Analyzing
        };
      }));
    transformedTransactions.forEach(async transaction => {
      await this.repo.add(transaction);
      await prisma.transaction.create({
        data: transaction
      });
      console.log(`Added Transaction n°${transaction.numeroRecu}`);
    });
  }
}

const sqlUser = process.env.MS_USER || "";
const sqlPassword = process.env.MS_PWD || "";
const sqlDbName = process.env.MS_NAME || "";
const sqlCIEServerName = process.env.MS_CIE_SERVER || "";
const sqlSODECIServerName = process.env.MS_SODECI_SERVER || "";

export const handleCIE = new SQLHandler(sqlUser, sqlPassword, sqlDbName, sqlCIEServerName, "CIE");
export const handleSODECI = new SQLHandler(sqlUser, sqlPassword, sqlDbName, sqlSODECIServerName, "SODECI");
