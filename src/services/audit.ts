import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getAuditLogsPaginate (
  query?: string,
  page: number = 1,
  dateFrom?: string,
  dateTo?: string,
) {
  const itemsPerPage = 10;
  const searchConditions: any = {
    AND: [
      dateFrom ? { timestamp: { gte: new Date(dateFrom) } } : {},
      dateTo ? { timestamp: { lte: new Date(dateTo) } } : {},
      query ? {
        // TODO: Search with combined fn & ln
        OR: [
          {
            category: { contains: query, mode: "insensitive" },
          },
          {
            module: { contains: query, mode: "insensitive" },
          },
          {
            message: { contains: query, mode: "insensitive" },
          },
          {
            user: {
              email: { contains: query, mode: "insensitive" },
            },
          },
          {
            user: {
              firstname: { contains: query, mode: "insensitive" },
            },
          },
          {
            user: {
              lastname: { contains: query, mode: "insensitive" },
            },
          },
        ],
      } : {},
    ].filter((condition) => Object.keys(condition).length > 0),
  };

  const count = await prisma.auditV2.count({ where: searchConditions });
  const totalPages = Math.ceil(count / itemsPerPage);
  const record = await prisma.auditV2.findMany({
    where: searchConditions,
    take: itemsPerPage,
    skip: itemsPerPage * (page - 1),
    orderBy: { timestamp: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
        },
      },
    },
  });

  return { record, itemsPerPage, count, totalPages, currentPage: page };
}

export async function logsForExport (
  query?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const searchConditions: any = {
    AND: [
      query ? {
        OR: [
          {
            category: { contains: query, mode: "insensitive" },
          },
          {
            module: { contains: query, mode: "insensitive" },
          },
          {
            message: { contains: query, mode: "insensitive" },
          },
          {
            user: {
              email: { contains: query, mode: "insensitive" },
            },
          },
          {
            user: {
              firstname: { contains: query, mode: "insensitive" },
            },
          },
          {
            user: {
              lastname: { contains: query, mode: "insensitive" },
            },
          },
        ]
      } : {},
      dateFrom ? { timestamp: { gte: new Date(dateFrom) } } : {},
      dateTo ? { timestamp: { lte: new Date(dateTo) } } : {},
    ].filter((condition) => Object.keys(condition).length > 0),
  };

  const record = await prisma.auditV2.findMany({
    where: searchConditions,
    orderBy: { timestamp: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
        },
      },
    },
  });

  return { record };
}

export async function all () {
  return await prisma.auditV2.findMany({
    include: {
      user: true,
    },
  });
}