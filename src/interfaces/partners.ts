export interface RequestBody {
  id?: string;
  name: string;
  code: {
    id?: string;
    code: string;
    idSociety: string;
    idPartner?: string;
  }[];
  logo: string;
  color: string;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string[];
  adress: {
    mail: string | null;
    phone: string | null;
  };
  status?: string;
  createdBy?: string;
}
export interface PartnerInterface {
  id: string;
  name: string;
  code: {
    id?: string;
    code: string;
    idSociety: string;
    idPartner?: string;
  }[];
  logo: string;
  color: string;
  userId?: string[];
  adress: {
    mail: string | null;
    phone: string | null;
  };
  status?: string;
}
