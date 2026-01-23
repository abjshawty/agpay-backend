import { Partner, Society, CodeSociety } from "@prisma/client";

export interface TransactionInterface {
  id: string;
  canal: string;
  referenceClient: string;
  referenceContrat: string;
  referenceTransaction?: string;
  facture: string;
  numeroRecu: string;
  operateur: Partner;
  statutOperations: string;
  details?: string;
  dateDePaiement: Date;
  montant: number;
  dateFlux: Date;
  source: string;
  society: Society;
  codeSociety: CodeSociety;
}
