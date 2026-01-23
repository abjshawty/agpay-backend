export interface User {
  id: string;
  username?: string;
  email: string;
  lastname?: string | null;
  firstname?: string | null;
  matricule?: string | null;
  department?: string | null;
  college?: string | null;
  numeroFiche?: string | null;
  lastLoginDate?: Date | null;
  startDate?: Date | null;
  expireDate?: Date | null;
  expiredOnDate?: Date | null;
  type?: "INTERNAL" | "EXTERNAL";
}

export interface UserBuild {
  createdBy?: any;
  email: string;
  username?: string;
  lastname?: string | null;
  firstname?: string | null;
  matricule?: string | null;
  department?: string | null;
  college?: string | null;
  numeroFiche?: string | null;
  lastLoginDate?: Date | null;
  startDate?: Date | null;
  expireDate?: Date | null;
  keycloakId?: string | null;
  expiredOnDate?: Date | null;
  societyId: string[];
  partnerId?: string;
  type?: "INTERNAL" | "EXTERNAL";
  status?: string;
  role?: string;
  isEmailConfirmed?: boolean;
  profileId?: string;
  password?: Array<{ password: string; expireAt: Date }>;
}

export interface RequestBody {
  username?: string,
  email: string;
  lastname?: string | null;
  firstname?: string | null;
  matricule?: string | null;
  department?: string | null;
  college?: string | null;
  groups?: string[];
  numeroFiche?: string | null;
  lastLoginDate?: Date | null;
  startDate?: Date | null;
  expireDate?: Date | null;
  expiredOnDate?: Date | null;
  type?: "INTERNAL" | "EXTERNAL";
  status?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
  isEmailConfirmed?: boolean;
  profileId: string;
  societyId: [];
  partnerId?: string;
  password?: Array<{ password: string; expireAt: Date }>;
}
