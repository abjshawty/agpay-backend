import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default class FileRepository {
  async add(file: any) {
    return await prisma.file.create({ data: file });
  }

  async getAll() {
    return await prisma.file.findMany();
  }

  async getOne(id: string) {
    return await prisma.file.findUnique({
      where: { id: id },
    });
  }

  async getAllPaginate(currentPage: number) {
    const itemsPerPage = 10;
    const count = await prisma.file.count();
    const totalPages = Math.ceil(count / itemsPerPage);

    const record = await prisma.file.findMany({
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
      select: {
        id: true,
        b64: true,
        createdAt: true,
        status: true,
      },
    });
    return { record, itemsPerPage, count, totalPages, currentPage };
  }
}
