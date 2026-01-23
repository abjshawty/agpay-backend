export interface FinancialClosure {
  date: string;
  montant: number;
  nbreTransaction: number;
  details: OperatorDetail[];
}

export interface OperatorDetail {
  operateur: string;
  nbrTransaction: number;
  montantRecolte: number;
  approbation: Approbation | null;
}

export interface Approbation {
  status: string;
  date: Date;
  iduser?: string;
  file?: string;
  commentary?: string;
}
