import AccountRepository from "../repository/accounts";
import BankRepository from "../repository/banks";
class BankService {
  private repo = new BankRepository();
  private accountRepo = new AccountRepository();
  async create(req: any, userId: string) {
    try {
      const full = { ...req, createdBy: userId };
      const new_bank = await this.repo.add(full);
      return new_bank;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAll() {
    try {
      const banks = await this.repo.getAll();
      return banks;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAllPaginate(currentPage: number, query?: string) {
    try {
      const result = await this.repo.getAllPaginate(currentPage, query);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne(id: string) {
    try {
      const banks = await this.repo.getOne(id);
      return banks;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async update(
    id: string,
    query: { name?: string; code?: string; status?: string; },
  ) {
    try {
      const banks = await this.repo.update(id, query);
      return banks;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async delete(id: string) {
    try {
      const toDelete = await this.repo.getOne(id);
      const haveAccount = toDelete!.accounts.length > 0;
      if (haveAccount) {
        const error: any = new Error("Cette banque a des comptes associés");
        error.statusCode = 500;
        throw error;
      }
      const banks = await this.repo.delete(id);
      return banks;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}
export default new BankService();
