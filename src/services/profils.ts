import { RequestBody } from "../interfaces/profils";
import Repository from "../repository/profils";
import UserRepository from "../repository/users";
class ProfilsService {
  private repo = new Repository();
  private userRepo = new UserRepository();
  async create (profil: RequestBody, userId: string) {
    try {
      if (!profil.type) {
        throw new Error("Le type est obligatoire");
      }
      if (profil.type.toUpperCase() !== "INTERNAL" && profil.type.toUpperCase() !== "EXTERNAL") {
        throw new Error("Le type est invalide");
      }
      const new_element = await this.repo.add(profil, userId);
      return new_element;
    } catch (error: any) {
      //@ts-ignore
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async update (id: string, profil: RequestBody) {
    try {
      const new_element = await this.repo.update(id, profil);
      return new_element;
    } catch (error: any) {
      //@ts-ignore
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async delete (id: string) {
    try {
      const new_element = await this.repo.delete(id);
      return new_element;
    } catch (error: any) {
      //@ts-ignore
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAll () {
    try {
      const elements = await this.repo.getAll();
      return elements;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne (id: string) {
    const result = await this.repo.getOne(id);
    if (result?.createdBy) {
      const creator = await this.userRepo.getOne(result.createdBy as string);
      const elements = { ...result, creator };
      return elements;
    } else if (result) {
      return result;
    }
    return null;
  }
  async getAllPaginate (currentPage: number, query?: string, type?: string) {
    try {
      type = type?.toUpperCase();
      if (type && (type !== "INTERNAL" && type !== "EXTERNAL")) {
        type = undefined;
      }
      const result = await this.repo.getAllPaginate(currentPage, query, type);
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

  async getType (type: string, query?: string) {
    try {
      const result = await this.repo.getType(type, query);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}
export default new ProfilsService();
