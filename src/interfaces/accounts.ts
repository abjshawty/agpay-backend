export interface Account {
  id?: string;
  name: string;
  bankId: string;
  bank: string;
  status?: string;
}
export interface AccountUpdate {
  name?: string;
  bankId?: string;
}
export interface AccountCreate {
  name: string;
  bankId: string;
  rib: string;
  societyId?: string;
  partnerId?: string;
  status?: string;
}
