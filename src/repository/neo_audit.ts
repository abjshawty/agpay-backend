import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type log = {
    id?: string;
    category: string;
    module: string;
    target?: string;
    userId: string;
    timestamp: Date;
    message?: string;
};

export default class NeoAuditRepository {
    async getPaginatedLogs (
        page: number,
        category?: string,
        module?: string,
        userId?: string,
        dateFrom?: Date,
        dateTo?: Date,
    ) {
        const itemsPerPage = 10;
        const searchConditions: any = {
            AND: [
                category ? { category: { contains: category, mode: "insensitive" } } : {},
                module ? { module: { contains: module, mode: "insensitive" } } : {},
                userId ? { userId: { contains: userId, mode: "insensitive" } } : {},
                dateFrom ? { timestamp: { gte: dateFrom } } : {},
                dateTo ? { timestamp: { lte: dateTo } } : {},
            ].filter((condition) => Object.keys(condition).length > 0),
        };

        const count = await prisma.auditV2.count({ where: searchConditions });
        const totalPages = Math.ceil(count / itemsPerPage);
        const records = await prisma.auditV2.findMany({
            where: searchConditions,
            take: itemsPerPage,
            skip: itemsPerPage * (page - 1),
            orderBy: { timestamp: "desc" },
            include: { user: true }, // Populate userId
        });

        return { records, itemsPerPage, count, totalPages, currentPage: page };
    }

    async getDetailedLog (id: string) {
        const log = await prisma.auditV2.findUnique({ where: { id } });
        return log;
    }

    async create (audit: log) {
        const result = await prisma.auditV2.create({ data: audit });
        return result;
    }
}