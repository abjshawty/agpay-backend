export interface Auth {
  cancreate: boolean;
  canupdate: boolean;
  canprint: boolean;
  canlist: boolean;
  candelete: boolean;
}
export interface Feature {
  id?: string;
  name: string;
  auth: Auth;
  description?: string; // Le champ est optionnel
}

export interface RequestBody {
  name: string;
  type: string
  features: Feature[];
}
