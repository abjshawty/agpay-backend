import { PrismaClient, Transaction } from "@prisma/client";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

const prisma = new PrismaClient();

interface CSVRow {
  ref_client: string;
  reference_contrat: string;
  reference_fact: string;
  numero_recu: string;
  operateur: string;
  code_saphir_v3: string;
  statut_operateur: string;
  dates_flux: string;
  status_transaction: string;
  sources: string;
  dates: string;
  MONTANT: string;
  ref_societe: string;
}

async function importTransactions(directoryPath: string): Promise<void> {
  const files = await indexDirectory(directoryPath);
  console.log(path.join(directoryPath));
  for (const file of files) {
    console.log(`Processing file: ${file}`);
    await processFile(path.join(directoryPath, file));
  }

  console.log("All files processed");
  await prisma.$disconnect();
}

async function indexDirectory(directoryPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        reject(err);
      } else {
        const csvFiles = files.filter(
          (file) => path.extname(file).toLowerCase() === ".csv",
        );
        resolve(csvFiles);
      }
    });
  });
}

async function processFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const results: CSVRow[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data: CSVRow) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          try {
            const existingTransaction = await prisma.transaction.findFirst({
              where: { numeroRecu: row.numero_recu },
            });
            if (existingTransaction) {
              console.log(
                `Transaction already exists: ${row.numero_recu}. Skipping.`,
              );
              continue;
            }
            const transaction = await createTransactionFromRow(row);
            await prisma.transaction.create({
              data: transaction,
            });
            console.log(`Transaction importée: ${transaction.numeroRecu}`);
          } catch (error) {
            console.error(
              `Erreur lors de l'importation de la transaction: ${row.numero_recu}`,
              error,
            );
          }
        }
        resolve();
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function convertDateString(dateString: string): Date {
  if (dateString.length === 8) {
    // Handle dates_flux format (YYYYMMDD)
    const year = parseInt(dateString.slice(0, 4));
    const month = parseInt(dateString.slice(4, 6)) - 1; // Months are 0-indexed in JavaScript
    const day = parseInt(dateString.slice(6, 8));
    return new Date(year, month, day);
  } else {
    // Handle original format (YYYYMMDDHHmmss)
    const year = parseInt(dateString.slice(0, 4));
    const month = parseInt(dateString.slice(4, 6)) - 1; // Months are 0-indexed in JavaScript
    const day = parseInt(dateString.slice(6, 8));
    const hour = parseInt(dateString.slice(8, 10));
    const minute = parseInt(dateString.slice(10, 12));
    const second = parseInt(dateString.slice(12, 14));
    return new Date(year, month, day, hour, minute, second);
  }
}

async function createTransactionFromRow(
  row: CSVRow,
): Promise<Omit<Transaction, "id" | "createdAt" | "updatedAt">> {
  return {
    canal: "Mobile",
    referenceClient: row.ref_client || "",
    referenceContrat: row.reference_contrat,
    facture: row.reference_fact,
    numeroRecu: row.numero_recu,
    operateurId: await getOperateurId(row.code_saphir_v3),
    statutOperations: row.statut_operateur || row.status_transaction,
    details: "",
    source: row.sources,
    dateDePaiement: convertDateString(row.dates),
    dateFlux: convertDateString(row.dates_flux),
    montant: parseFloat(row.MONTANT),
    societyId: await getSocietyId(row.ref_societe == "1" ? "SODECI" : "CIE"),
    codeSocietyId: await getCodeSocietyId(
      row.ref_societe == "1" ? "SODECI" : "CIE",
      row.code_saphir_v3,
    ),
    referenceTransaction: row.reference_contrat,
  };
}

async function getOperateurId(operateurCode: string): Promise<string> {
  const codeSociety = await prisma.codeSociety.findFirst({
    where: { code: operateurCode },
    select: { idPartner: true },
  });
  if (!codeSociety) {
    throw new Error(`Operateur not found: ${operateurCode}`);
  }
  return codeSociety.idPartner;
}

async function getSocietyId(societyCode: string): Promise<string> {
  const society = await prisma.society.findFirst({
    where: { codeSociety: societyCode },
  });
  if (!society) throw new Error(`Society not found: ${societyCode}`);
  return society.id;
}

async function getCodeSocietyId(
  societyCode: string,
  partnerCode: string,
): Promise<string> {
  const codeSociety = await prisma.codeSociety.findFirst({
    where: {
      code: partnerCode,
      society: {
        codeSociety: societyCode,
      },
    },
    select: { id: true },
  });
  if (!codeSociety) {
    throw new Error(`CodeSociety not found: ${societyCode} - ${partnerCode}`);
  }
  return codeSociety.id;
}

const directoryPath = path.join(process.cwd(), "src", "data", "transactions");

importTransactions(directoryPath).catch(console.error);
