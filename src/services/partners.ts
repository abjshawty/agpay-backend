import { PartnerInterface, RequestBody } from "../interfaces/partners";
import Repository from "../repository/partners";
import UserRepository from "../repository/users";
import { PrismaClient } from "@prisma/client";
class PartnerService {
  private prisma = new PrismaClient();
  private repo = new Repository();
  private userRepo = new UserRepository();

  async create(req: any, userId: string) {
    try {
      const full = { ...req, createdBy: userId };

      const error: any = new Error(
        "Création impossible(le partenaire existe déja)",
      );
      const existPartner = await this.prisma.partner.findFirst({
        where: { name: { equals: full.name, mode: 'insensitive' } },
      });
      if (existPartner) {
        error.statusCode = 400;
        throw error;
      }
      let existCode = false;
      for (const code of full.code) {
        const codeExist = await this.prisma.codeSociety.findFirst({
          where: { code: { equals: code.code, mode: 'insensitive' } },
        });
        if (codeExist) {
          existCode = true;
          break;
        }
      }
      if (existCode) {
        error.statusCode = 400;
        error.message = "Code dupliqué";
        throw error;
      }

      const new_element = await this.repo.add(full);
      return new_element;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async getAll() {
    try {
      const elements = await this.repo.getAll();
      return elements;
    } catch (error: any) {
      error.hasOwnProperty("statusCode") ? "" : (error.statusCode = 500);
      throw error;
    }
  }
  async getAllPaginate(
    currentPage: number,
    itemsPerPage: number,
    filters: {
      query?: string;
      name?: string;
      code?: string;
      status?: string;
      createdFrom?: string;
      createdTo?: string;
    },
  ) {
    try {
      const result = await this.repo.getAllPaginate(
        currentPage,
        itemsPerPage,
        filters,
      );
      const elements = await Promise.all(result.record.map(async (r) => ({
        ...r,
        user: await this.userRepo.getOneLite(r.createdBy as string),
      })));
      return { ...result, record: elements };
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async update(id: string, req: PartnerInterface) {
    try {
      let statusCode = 200;
      let message = "OK";
      let result: any = null;
      const partner = await this.getOne({ id });
      if (!partner) {
        message = "Partenaire non trouvé";
        statusCode = 404;
        result = null;
        return {
          message,
          statusCode,
          result
        }
      }
      const existName = await this.getPartnerByName(req.name);
      if (existName && existName.id !== id) {
        message = "Partenaire avec ce nom existe déja";
        statusCode = 409;
        result = null;
        return {
          message,
          statusCode,
          result
        }
      }
      const codes = req.code.map((code: any) => code.code).filter(t => t != '');
      const uniques = new Set(codes);
      try {
        if (uniques.size != codes.length) throw new Error();
        for (const code of codes) {
          const existCode = await this.getPartnerByCode(code);
          // console.log("The Son", existCode);
          console.log("Data received through http: ", req)
          if (existCode && existCode.id !== id) {
            // console.log("The Holy Spirit", existCode, id);
            throw new Error();
          }          
        }
      } catch {
        message = "Partenaire avec ce code existe déja";
        statusCode = 409;
        result = null;
        return {
          message,
          statusCode,
          result
        };
      }
      result = await this.repo.updateLite(id, req);
      return {
        statusCode,
        result,
        message
      }
    } catch (error: any) {
      error.hasOwnProperty("statusCode") ? "" : (error.statusCode = 500);
      throw error;
    }
  }
  async getPartnerByName(name: string) {
    return this.repo.getPartnerByName(name);
  }
  async getPartnerByCode(code: string) {
    return this.repo.getByCode(code);
  }

  async deleteOne(id: string) {
    try {
      const result = await this.repo.deleteOne(id);
      return result;
    } catch (error: any) {
      error.hasOwnProperty("statusCode") ? "" : (error.statusCode = 500);
      throw error;
    }
  }

  async getOne(req: { id: string; }) {
    try {
      const result = await this.repo.getOne(req.id);
      return result;
    } catch (error: any) {
      error.hasOwnProperty("statusCode") ? "" : (error.statusCode = 500);
      throw error;
    }
  }
}

export default new PartnerService();
