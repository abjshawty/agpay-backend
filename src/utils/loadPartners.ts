import PartnerRepository from "../repository/partners";
import SocietyRepository from "../repository/society";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function loadPartners (
  societyName: string,
  partnerData: Array<[string, string]>,
) {
  const partnerRepo = new PartnerRepository();
  const societyRepo = new SocietyRepository();

  // First, check if the society exists
  let society: any = await societyRepo.getOne(societyName);
  if (!society) {
    try {
      society = await societyRepo.add({
        name: societyName,
        codeSociety: societyName,
        status: "active",
      });
      console.log(`${societyName} society created successfully.`);
    } catch (error) {
      console.error(`Error creating ${societyName} society:`, error);
      return; // Exit if we can't create the society
    }
  } else {
    console.log(`${societyName} society already exists.`);
  }

  for (const [code, name] of partnerData) {
    try {
      // Check if the partner already exists
      let existingPartner = await partnerRepo.getPartnerByName(name);

      if (existingPartner) {
        console.log(`Partner ${name} already exists. Checking for code...`);

        // Check if the code exists for this partner and society
        const existingCode = await prisma.codeSociety.findFirst({
          where: {
            code: code,
            idSociety: society.id,
            idPartner: existingPartner.id,
          },
        });

        if (existingCode) {
          console.log(
            `Code ${code} for partner ${name} and society ${societyName} already exists. Skipping.`,
          );
          continue;
        } else {
          // Check if the code exists for any partner in this society
          const codeExistsForSociety = await prisma.codeSociety.findFirst({
            where: {
              code: code,
              idSociety: society.id,
            },
          });

          if (codeExistsForSociety) {
            console.log(
              `Code ${code} already exists for society ${societyName} but with a different partner. Skipping.`,
            );
            continue;
          }

          // Add new code for existing partner
          await prisma.codeSociety.create({
            data: {
              code: code,
              idSociety: society.id,
              idPartner: existingPartner.id,
            },
          });
          console.log(
            `Added new code ${code} for existing partner ${name} and society ${societyName}`,
          );
        }
      } else {
        // Create the new partner
        existingPartner = await partnerRepo.add({
          name: name,
          code: [
            {
              code: code,
              idSociety: society.id,
            },
          ],
          logo: "",
          color: "",
          userId: [],
          adress: { mail: "", phone: "" },
          status: "active",
        });

        console.log(
          `Successfully added new partner: ${name} with code ${code} for society ${societyName}`,
        );
      }
    } catch (error) {
      console.error(`Error processing partner ${name}:`, error);
    }
  }
}

// Usage
const sodeci_file: Array<[string, string]> = [
  ["220", "BIAO-CI"],
  ["230", "ORANGE-CI"],
  ["250", "MTN-CI"],
  ["260", "MOOV-CI"],
  ["270", "BACI"],
  ["280", "ECOBANK-CI"],
  ["281", "BICICI"],
  ["282", "BNI"],
  ["283", "ORABANK"],
  ["284", "SGBCI"],
  ["285", "UBA-CI"],
  ["286", "WIZALL"],
  ["287", "BNI"],
  ["288", "BOA-CI"],
  ["289", "WEBLOGY-CI"],
  ["290", "ADF"],
  ["291", "DJOGANA"],
  ["292", "WAVE-CI"],
  ["293", "AFRILAND"],
  ["294", "CELPAID"],
  ["295", "INTOUCH-GROUP"],
  ["296", "GT-BANK"],
  ["297", "BSIC"],
  ["298", "DJAMO"],
];

const cie_file: Array<[string, string]> = [
  ["P01", "NSIA"],
  ["P02", "ORANGE-CI"],
  ["P03", "MOOV-CI"],
  ["P04", "MTN-CI"],
  ["P05", "BACI"],
  ["P06", "ECOBANK-CI"],
  ["P07", "BICICI"],
  ["P08", "BNI"],
  ["P09", "ORABANK"],
  ["P10", "SGBCI"],
  ["P11", "UBA-CI"],
  ["P12", "BNI"],
  ["P13", "BOA-CI"],
  ["P14", "WEBLOGY-CI"],
  ["P15", "AFRICA DIGITAL FINANCE"],
  ["P16", "DJOGANA"],
  ["P17", "WAVE-CI"],
  ["P18", "AFRILAND"],
  ["P19", "CELPAID"],
  ["P20", "INTOUCH-GROUP"],
  ["P21", "GT-BANK"],
  ["P22", "BSIC"],
  ["P23", "DJAMO"],
];

export async function load () {
  await Promise.all([
    loadPartners("SODECI", sodeci_file),
    loadPartners("CIE", cie_file),
  ]);
} 