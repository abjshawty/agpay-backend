import { FileBody } from "../interfaces/files";
import Repository from "../repository/files";
class FilesService {
  private repo = new Repository();
  async create(file: any) {
    try {
      console.log(typeof file.data); // devrait imprimer 'object'
      console.log(Buffer.isBuffer(file.data)); // devrait imprimer 'true'
      console.log(file.data.length);
      const b64 = file.data.toString("base64");
      const new_element = await this.repo.add({ b64 });
      return new_element;
    } catch (error: any) {
      //@ts-ignore
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
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getOne(id: string) {
    try {
      const one = await this.repo.getOne(id);
      return one?.b64;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAllPaginate(currentPage: number) {
    try {
      const result = await this.repo.getAllPaginate(currentPage);
      return result;
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}
export default new FilesService();
