export interface ApprobationInterface {
  status: "En cours d'analyse" | "Approuvé" | "Non approuvé";
  date: string;
  commentaire?: string;
  iduser?: string;
  comptePartenaire?: string;
  file?: string;
  compteSociete?: string;
  detailId: string;
}
