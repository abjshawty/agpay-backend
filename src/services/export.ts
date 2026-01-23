import { logsForExport } from "./audit";
import json2csv, { Parser } from "json2csv";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import transactionService from "../services/transactions";
import rtjService from "../services/rtj";
import PdfPrinter from "pdfmake";
import { FastifyReply } from "fastify";
import { AuditV2, Transaction } from "@prisma/client";
const pdfTable = require("pdfkit-table");

export async function exportAuditLogs (
  format: "csv" | "excel" | "pdf",
  reply: FastifyReply,
  query?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const { record } = await logsForExport(
    query,
    dateFrom,
    dateTo,
  );
  switch (format) {
    case "csv":
      console.log("Exporting audit logs in CSV format");
      return exportAuditLogsCSV(record);
    case "excel":
      console.log("Exporting audit logs in Excel format");
      return exportAuditLogsXLSX(record);
    case "pdf":
      console.log("Exporting audit logs in PDF format");
      return exportAuditLogsPDF_(record, reply);
    default:
      throw new Error("Invalid format");
  }
}
export async function exportTransactions (
  format: "csv" | "excel" | "pdf",
  reply: FastifyReply,
  filters: { societe?: string, dateFrom?: string, dateTo?: string, operateurId?: string, query?: string, status?: string | string[]; },
  partenaire?: string
) {
  const record = await transactionService.forExport(
    filters.societe,
    filters.dateFrom,
    filters.dateTo,
    filters.operateurId,
    filters.query,
    partenaire,
    filters.status
  );
  console.log(`Records for export were: ${record.length}`);
  switch (format) {
    case "csv":
      return exportTransactionsCSV(record);
    case "excel":
      return exportTransactionsXLSX(record);
    case "pdf":
      return exportTransactionsPDF_(record, reply);
    default:
      throw new Error("Invalid format");
  }
}
export async function exportRTJs (
  format: "csv" | "excel" | "pdf",
  reply: FastifyReply,
  societe: string,
  dateFrom?: string,
  dateTo?: string,
  partenaire?: string
) {
  const { record } = await rtjService.forExport(
    societe,
    dateFrom,
    dateTo,
    partenaire
  );
  switch (format) {
    case "csv":
      return exportRTJtoCSV(record);
    case "excel":
      return exportRTJsXLSX(record);
    case "pdf":
      return exportRTJsPDF_(record, reply);
    default:
      throw new Error("Invalid format");
  }
}

// RTJs
async function exportRTJtoCSV (record: any) {
  const json2csvParser = new Parser({
    fields: [
      "date",
      "montant",
      "nombreTransaction"
    ],
    excelStrings: true
  });
  try {
    const csv = json2csvParser.parse(record)
      .replace("date", "Date")
      .replace("montant", "Montant")
      .replace("nombreTransaction", "Nombre de transactions");
    return csv;
  } catch (error: any) {
    if (
      error.message.includes(
        'Data should not be empty or the "fields" option should be included',
      )
    ) {
      return ""; // Generate an empty CSV file
    } else {
      throw error;
    }
  }
}
async function exportRTJsPDF (record: any) {
  const fonts = {
    Inter: {
      normal: `${__dirname}/fonts/Inter/Inter-Regular.ttf`,
      bold: `${__dirname}/fonts/Inter/Inter-Bold.ttf`,
      italics: `${__dirname}/fonts/Inter/Inter-Italic.ttf`,
      bolditalics: `${__dirname}/fonts/Inter/Inter-BoldItalic.ttf`
    }
  };
  const printer = new PdfPrinter(fonts);
  const definition = {
    defaultStyle: {
      font: 'Inter'
    },
    content: [
      { text: "RTJs", fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
    ],
  };
  record.forEach((r: any) => {
    definition.content.push({
      text: `ID: ${r.id}, Date: ${r.dateDePaiement}, Montant: ${r.montant}, Nombre de transactions: ${r.nombreTransaction}`,
      fontSize: 10,
      bold: false,
      margin: [0, 0, 0, 10]
    });
  });
  const options = {};
  // @ts-ignore
  const pdfDoc = printer.createPdfKitDocument(definition, options);
  pdfDoc.end();
  return pdfDoc;
}
async function exportRTJsXLSX (record: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("RTJs");
  worksheet.columns = [
    // { header: "ID", key: "id", width: 30 },
    { header: "Date", key: "date", width: 30 },
    { header: "Montant", key: "montant", width: 30 },
    { header: "Nombre de transactions", key: "nombreTransaction", width: 30 },
    // { header: "Société", key: "society.name", width: 30 },
  ];
  if (record.length === 0) {
    worksheet.addRow({
      // id: "",
      date: "",
      montant: "",
      nombreTransaction: "",
      // society: "",
    });
  } else {
    record.forEach((r: any) => {
      worksheet.addRow(r);
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
async function exportRTJsPDF_ (record: any, reply: FastifyReply) {
  const doc = new pdfTable();
  doc.fontSize(10).text("DFC", { align: "center" });
  doc.moveDown();
  const table = {
    headers: ["Date", "Montant", "Nombre de transactions"],
    rows: record.map(rtj => [rtj.date.toLocaleDateString("fr-FR"), rtj.montant, rtj.nombreTransaction])
  };
  await doc.table(table, {
    divider: {
      header: { disabled: false, width: 1, opacity: 1 },
      horizontal: { disabled: false, width: 0.5, opacity: 0.5 },
    },
    // you can also tune padding / columnSpacing here if needed
  });
  doc.end();
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="audit_logs.pdf"`)
    .send(doc);
}

// Transactions
async function exportTransactionsCSV (record: any) {
  try {
    const json2csvParser = new Parser({
      fields: [
        "referenceContrat",
        "facture",
        // "referenceTransaction",
        "dateDePaiement",
        "dateFlux",
        "montant",
        "numeroRecu",
        "operateur",
        "source"
      ],
      excelStrings: true
    });
    const csv = json2csvParser.parse(record)
      .replace("referenceContrat", "Reference Contrat")
      .replace("facture", "Reference Facture")
      // .replace("referenceTransaction", "Reference Transaction")
      .replace("dateDePaiement", "Date De Paiement")
      .replace("dateFlux", "Date Flux")
      .replace("montant", "Montant")
      .replace("numeroRecu", "Numero de Reçu")
      .replace("operateur", "Operateur")
      .replace("source", "Source");
    // console.log('After', csv);
    return csv;
  } catch (error: any) {
    if (
      error.message.includes(
        'Data should not be empty or the "fields" option should be included',
      )
    ) {
      return ""; // Generate an empty CSV file
    } else {
      throw error;
    }
  }
}
async function exportTransactionsPDF (record: any) {
  const fonts = {
    Inter: {
      normal: `${__dirname}/fonts/Inter/Inter-Regular.ttf`,
      bold: `${__dirname}/fonts/Inter/Inter-Bold.ttf`,
      italics: `${__dirname}/fonts/Inter/Inter-Italic.ttf`,
      bolditalics: `${__dirname}/fonts/Inter/Inter-BoldItalic.ttf`
    }
  };
  const printer = new PdfPrinter(fonts);
  const definition = {
    defaultStyle: {
      font: 'Inter'
    },
    content: [
      { text: "Transactions", fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
    ],
  };
  record.forEach((r: any) => {
    definition.content.push({
      text: `ID: ${r.id}, Montant: ${r.montant}, Canal: ${r.canal}, Référence Client: ${r.referenceClient}, Référence Contrat: ${r.referenceContrat}, Numéro Contrat: ${r.numero}, Statut: ${r.statutOperations}, Date: ${r.dateDePaiement}`,
      fontSize: 10,
      bold: false,
      margin: [0, 0, 0, 10]
    });
  });
  const options = {};
  // @ts-ignore
  const pdfDoc = printer.createPdfKitDocument(definition, options);
  pdfDoc.end();
  return pdfDoc;
}
async function exportTransactionsXLSX (record: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");
  worksheet.columns = [
    { header: "Référence Contrat", key: "referenceContrat", width: 30 },
    { header: "Référence Facture", key: "facture", width: 30 },
    // { header: "Référence Transaction", key: "referenceTransaction", width: 30 },
    { header: "Date de paiement", key: "dateDePaiement", width: 30 },
    { header: "Date Flux", key: "dateFlux", width: 30 },
    { header: "Montant", key: "montant", width: 30 },
    { header: "Numéro de reçu", key: "numeroRecu", width: 30 },
    { header: "Operateur", key: "operateur", width: 30 },
    { header: "Source", key: "source", width: 30 },
  ];
  if (record.length === 0) {
    worksheet.addRow({
      id: "",
      montant: "",
      canal: "",
      referenceClient: "",
      referenceContrat: "",
      numero: "",
      statutOperations: "",
      dateDePaiement: "",
    });
  } else {
    record.forEach((r: any) => {
      worksheet.addRow(r);
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
async function exportTransactionsPDF_ (record: any[], reply: FastifyReply) {
  const doc = new pdfTable();
  doc.fontSize(10).text("Transactions", { align: "center" });
  doc.moveDown();
  console.log("Transactions (PDF Export)", record[0]);
  const table = {
    headers: ["Référence Contrat", "Référence Facture", "Date de paiement", "Date Flux", "Montant", "Numéro de reçu", "Operateur", "Source"],
    // headers: ["Référence Contrat", "Référence Facture", "Référence Transaction", "Date de paiement", "Date Flux", "Montant", "Numéro de reçu", "Operateur", "Source"],
    rows: record.map(audit => [audit.referenceContrat, audit.facture, audit.dateDePaiement.toLocaleDateString("fr-FR"), audit.dateFlux.toLocaleDateString("fr-FR"), audit.montant, audit.numeroRecu, audit.operateur, audit.source])
    // rows: record.map(audit => [audit.referenceContrat, audit.facture, audit.referenceTransaction, audit.dateDePaiement.toLocaleDateString("fr-FR"), audit.dateFlux.toLocaleDateString("fr-FR"), audit.montant, audit.numeroRecu, audit.operateur, audit.source])
  };
  await doc.table(table, {
    divider: {
      header: { disabled: false, width: 1, opacity: 1 },
      horizontal: { disabled: false, width: 1, opacity: 1 },
    },
    // you can also tune padding / columnSpacing here if needed
  });
  doc.end();
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="transactions.pdf"`)
    .send(doc);
}

// Audit Logs
async function exportAuditLogsCSV (record: any) {
  const formattedRecord = record.map((r: any) => ({
    Date: r.timestamp,
    "Nom & Prénom": `${r.user?.lastname || ''} ${r.user?.firstname || ''}`.trim() || 'N/A',
    Email: r.user?.email || 'N/A',
    Détails: r.message || '',
    Module: r.module,
    Catégorie: r.category,
  }));

  const json2csvParser = new Parser({
    fields: ["Date", "Nom & Prénom", "Email", "Détails", "Module", "Catégorie"],
    excelStrings: true
  });
  let csv;
  try {
    csv = json2csvParser.parse(formattedRecord);
  } catch (error: any) {
    if (
      error.message.includes(
        'Data should not be empty or the "fields" option should be included',
      )
    ) {
      csv = ""; // Generate an empty CSV file
    } else {
      throw error;
    }
  }
  return csv;
}
async function exportAuditLogsPDF (record: any) {
  const fonts = {
    Inter: {
      normal: `${__dirname}/fonts/Inter/Inter-Regular.ttf`,
      bold: `${__dirname}/fonts/Inter/Inter-Bold.ttf`,
      italics: `${__dirname}/fonts/Inter/Inter-Italic.ttf`,
      bolditalics: `${__dirname}/fonts/Inter/Inter-BoldItalic.ttf`
    }
  };
  const printer = new PdfPrinter(fonts);
  const definition = {
    defaultStyle: {
      font: 'Inter'
    },
    content: [
      { text: "Audit Logs", fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
    ],
  };
  record.forEach((r: any) => {
    definition.content.push({
      text: `Category: ${r.category}, Module: ${r.module}, Timestamp: ${r.timestamp}, Message: ${r.message}`,
      fontSize: 10,
      bold: false,
      margin: [0, 0, 0, 10]
    });
  });
  const options = {};
  // @ts-ignore
  const pdfDoc = printer.createPdfKitDocument(definition, options);
  pdfDoc.end();
  return pdfDoc;
}
async function exportAuditLogsXLSX (record: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Audit Logs");

  worksheet.columns = [
    { header: "Date", key: "timestamp", width: 25 },
    { header: "Nom & Prénom", key: "fullName", width: 30 },
    { header: "Email", key: "email", width: 35 },
    { header: "Détails", key: "message", width: 50 },
    { header: "Module", key: "module", width: 20 },
    { header: "Catégorie", key: "category", width: 20 },
  ];

  if (record.length === 0) {
    worksheet.addRow({
      timestamp: "",
      fullName: "",
      email: "",
      message: "",
      module: "",
      category: "",
    });
  } else {
    record.forEach((r: any) => {
      worksheet.addRow({
        timestamp: r.timestamp,
        fullName: `${r.user?.lastname || ''} ${r.user?.firstname || ''}`.trim() || 'N/A',
        email: r.user?.email || 'N/A',
        message: r.message || '',
        module: r.module,
        category: r.category,
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
async function exportAuditLogsPDF_ (record: AuditV2[], reply: FastifyReply) {
  const doc = new pdfTable();
  doc.fontSize(10).text("Audits", { align: "center" });
  doc.moveDown();
  const table = {
    headers: ["Name", "Email", "Category", "Module", "Timestamp", "Message"],
    // @ts-ignore
    rows: record.map(audit => [`${audit.user?.firstname || "..."} ${audit.user?.lastname || ""}`, audit.user?.email || "...", audit.category, audit.module, audit.timestamp.toLocaleDateString("fr-FR"), audit.message])
  };
  await doc.table(table, {
    divider: {
      header: { disabled: false, width: 1, opacity: 1 },
      horizontal: { disabled: false, width: 0.5, opacity: 0.5 },
    },
    // you can also tune padding / columnSpacing here if needed
  });
  doc.end();
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="audit_logs.pdf"`)
    .send(doc);
}
