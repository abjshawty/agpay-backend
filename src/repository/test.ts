import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default class TestRepository {
  async add(test: { lorem: string }) {
    return await prisma.test.create({ data: test });
  }

  async getAll() {
    return await prisma.test.findMany();
  }
}
