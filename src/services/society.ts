import BankRepository from "../repository/society";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
class SocietyService {
  private repo = new BankRepository();
  async create (req: any, id: string) {
    try {
      req.userId = id;
      const new_bank = await this.repo.add(req);
      return new_bank;
    } catch (error: any) {
      error.hasOwnProperty("statusCode") ? "" : (error.statusCode = 500);
      throw error;
    }
  }
  async getAll () {
    try {
      const banks = await this.repo.getAllLite();
      return banks;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAllPaginate (currentPage: number, query?: string, itemsPerPage?: number) {
    try {
      const result = await this.repo.getAllPaginate(currentPage, query, itemsPerPage);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne (id: string) {
    try {
      const society = await this.repo.getOne(id);
      return society;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async update (id: string, query: any) {
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
  async delete (id: string) {
    try {
      const exists = await this.repo.getOneLite(id);
      if (!exists) throw new Error("not found");
      const rattached = await prisma.codeSociety.findFirst({ where: { idSociety: id } });
      if (rattached) throw new Error("Impossible de supprimer: La société est toujours rattachée à un partenaire");
      const banks = await this.repo.delete(id);
      return banks;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOneLite (id: string) {
    try {
      const society = await this.repo.getOneLite(id);
      return society;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}
export default new SocietyService();
