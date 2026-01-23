import { PrismaClient } from "@prisma/client";
import { Bank } from "@prisma/client";
import locale from "../data/locale";
const prisma = new PrismaClient();

export default class BankRepository {
  async add(bank: Bank) {
    const error: any = new Error("Création impossible(la banque existe déja)");
    // const exist = await prisma.bank.findFirst({ where: { name: bank.name } });
    const exist = await prisma.bank.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: bank.name,
              mode: 'insensitive'
            }
          }, 
          {
            code: {
              equals: bank.code,
              mode: 'insensitive'
            }
          }
        ]
      }
    });

    if (exist) {
      error.statusCode = 409;
      throw error;
    }

    return await prisma.bank.create({ data: bank });
  }
  async getAll() {
    return await prisma.bank.findMany({
      include: {
        accounts: true,
      },
    });
  }

  async getAllPaginate(currentPage: number, query?: string) {
    const itemsPerPage = 10;
    let searchConditions: any = {
      AND: [
        { status: "active" }, // Condition pour que le compte soit actif
        {
          OR: [
            {
              name: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              code: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
          ].filter((condition) => condition !== undefined),
        },
      ],
    };

    if (!query) {
      searchConditions = { status: "active" };
    }
    const count = await prisma.bank.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);

    const record = await prisma.bank.findMany({
      where: searchConditions,
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
      include: {
        accounts: true,
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            type: true
          }
        }
      },
    });
    return { record, itemsPerPage, count, totalPages, currentPage };
  }

  async getOne(id: string) {
    const record = await prisma.bank.findUnique({
      where: {
        id: id,
      },
      include: {
        accounts: true,
      },
    });
    if (record?.status == "deleted") return null;
    return record;
  }

  async update(
    id: string,
    req: { name?: string; code?: string; status?: string; },
  ) {
    try {
      const error: any = new Error(
        "Mise à jour impossible (une banque avec ce nom existe déja)",
      );
      console.log(req);
      const exists = await prisma.bank.findFirst({ where: { id } });
      const nameIsTaken = req.name
        ? await prisma.bank.findFirst({
          where: { name: req.name, id: { not: id } },
        })
        : false;
      // const ownName = await prisma.bank.findFirst({ where: { name: req.name, id } });
      if (!exists) {
        error.statusCode = 404;
        error.code = "P2025";
        throw error;
      }
      if (nameIsTaken) {
        error.statusCode = 400;
        throw error;
      }

      return await prisma.bank.update({
        where: {
          id,
        },
        data: req,
        include: { accounts: true },
      });
    } catch (error: any) {
      if (error.code == "P2025") {
        error.message = locale.notfound("Banque");
        error.statusCode = 404;
        throw error;
      }
      if (error.statusCode) throw error;
      error.statusCode = 500;
      error.message = "Internal server error";
      throw error;
    }
  }

  async delete(code: string) {
    return await prisma.bank.delete({
      where: {
        id: code,
      },
    });
  }
}
