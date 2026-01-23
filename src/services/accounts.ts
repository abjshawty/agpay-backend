import { AccountCreate, AccountUpdate } from "../interfaces/accounts";
import { PrismaClient } from "@prisma/client";
import Repository from "../repository/accounts";
const prisma = new PrismaClient();
class AccountService {
  private repo = new Repository();
  async create(userData: { id: string; iat: number; }, data: AccountCreate) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }
      const userType = user.type;
      if (userType == "INTERNAL") {
        const result = this.repo.add({
          name: data.name,
          rib: data.rib,
          bankId: data.bankId,
          societyId: data.societyId,
          type: user.type,
          userId: user.id,
          createdBy: userData.id
        });
        return result;
      } else {
        const result = await this.repo.add({
          name: data.name,
          rib: data.rib,
          bankId: data.bankId,
          partnerId: user.partnerId,
          // societyId: data.societyId,
          type: user.type,
          userId: user.id,
          createdBy: userData.id
        });
        return result;
      }
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAll() {
    try {
      const result = await this.repo.getAll();
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async getAllInternal(userData: { id: string; iat: number; }, societe?: string) {
    try {
      const result = await this.repo.getAllInternal(userData, societe);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async getAllExternal(userData: { id: string; iat: number; }) {
    try {
      const result = await this.repo.getAllExternal(userData);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getMyExternal(userData: { id: string; iat: number; }) {
    try {
      const result = await this.repo.getMyExternal(userData);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAllPaginate(userData: { id: string; iat: number; }, currentPage: number, query?: string) {
    try {
      // Get the current user's type
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
      });
      if (!user) {
        throw new Error("User not found");
      }
      const userType = user.type;
      console.log(`user is ${userType}`);
      if (userType == "INTERNAL") {
        const result = await this.repo.getAllPaginate(currentPage, query, {});
        return result;
      }
      else {
        const result = await this.repo.getAllPaginate(currentPage, query, {
          partnerId: user.partnerId ? user.partnerId : undefined,
          // societyId: user.societyId ? user.societyId : undefined,
        });
        return result;
      }
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne(id: string) {
    try {
      const result = await this.repo.getOne(id);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async update(id: string, query: AccountUpdate) {
    try {
      const result = await this.repo.update(id, query);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      if (error.statusCode) throw error;
      throw error;
    }
  }
  async delete(id, hard: boolean = false) {
    try {
      let result
      let obj = await this.repo.getOne(id);
      if (hard) {
        if (obj?.status == "active") {
          const err: any = new Error("Le compte ne peut être supprimé tant qu'il est actif.")
          err.statusCode = 412
          throw err;
        }
        result = await this.repo.delete(id)
      } else result = await this.repo.update(id, { status: "sleeping" })
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}
export default new AccountService();
