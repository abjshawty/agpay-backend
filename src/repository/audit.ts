import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default class AuditRepository {
  async getPaginatedLogs(
    page: number,
    action?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const itemsPerPage = 10;
    const searchConditions: any = {
      AND: [
        action ? { action: { contains: action, mode: "insensitive" } } : {},
        userId ? { userId: { contains: userId, mode: "insensitive" } } : {},
        startDate ? { timestamp: { gte: startDate } } : {},
        endDate ? { timestamp: { lte: endDate } } : {},
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    const count = await prisma.audit.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);
    const records = await prisma.audit.findMany({
      where: searchConditions,
      take: itemsPerPage,
      skip: itemsPerPage * (page - 1),
      orderBy: { timestamp: "desc" },
      include: { user: true }, // Populate userId
    });

    return { records, itemsPerPage, count, totalPages, currentPage: page };
  }

  async count(searchConditions: any) {
    return await prisma.audit.count({ where: searchConditions });
  }

  async findMany(params: any) {
    return await prisma.audit.findMany(params);
  }
}
