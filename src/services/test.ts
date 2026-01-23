import TestRepository from "../repository/test";
class TestService {
  private testRepo = new TestRepository();
  async create(lorem: string) {
    const newTest = await this.testRepo.add({ lorem });
    return newTest;
  }
  async getAll() {
    const newTest = await this.testRepo.getAll();
    return newTest;
  }
}
export default new TestService();
