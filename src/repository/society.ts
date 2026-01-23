import { PrismaClient } from "@prisma/client";
import { Society } from "@prisma/client";
import UserRepository from "./users";
const prisma = new PrismaClient();

export default class SocietyRepository {
  async add (society: any) {
    const error: any = new Error("Création impossible(la société existe déja)");
    // const exist = await prisma.society.findFirst({
    //   where: { name: society.name },
    // });

    const exist = await prisma.society.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: society.name,
              mode: 'insensitive'
            }
          },
          {
            codeSociety: {
              equals: society.codeSociety,
              mode: 'insensitive'
            }
          }
        ]
      }
    });

    if (exist) {
      error.statusCode = 409;
      if (exist.status === 'deleted') return await prisma.society.update({
        where: {
          id: exist.id
        },
        data: { ...society, status: "active" },
      });
      else throw error;
    }
    return await prisma.society.create({
      data: society,
      include: { user: true },
    });
  }
  async getAll () {
    return await prisma.society.findMany({
      include: { user: true, linkedPartner: true, accounts: true },
    });
  }

  async getAllLite () {
    try {
      const record = await prisma.society.findMany({
        where: {
          status: { not: "deleted" },
        },
        include: {
          user: {
            select: {
              email: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      });
      return record;
    } catch (error: any) {
      throw error;
    }
  }

  async getAllPaginate (currentPage: number, query?: string, itemsPerPage = 10) {
    try {
      const baseWhere: any = { status: "active" };
      const searchConditions = query
        ? {
          AND: [
            baseWhere,
            {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { codeSociety: { contains: query, mode: "insensitive" } },
              ],
            },
          ],
        }
        : baseWhere;
      // let searchConditions: any = {
      //   AND: [
      //     { status: "active" }, // Condition pour que le compte soit actif
      //     {
      //       OR: [
      //         {
      //           name: query
      //             ? { contains: query, mode: "insensitive" }
      //             : undefined,
      //         },
      //         {
      //           codeSociety: query
      //             ? { contains: query, mode: "insensitive" }
      //             : undefined,
      //         },
      //       ].filter((condition) => condition !== undefined),
      //     },
      //   ],
      // };

      // if (!query) {
      //   searchConditions = { status: "active" };
      // }
      const count = await prisma.society.count({ where: searchConditions });
      const totalPages = Math.ceil(count / itemsPerPage);

      const record = await prisma.society.findMany({
        where: searchConditions,
        include: {
          user: { select: { email: true, firstname: true, lastname: true } },
          // linkedPartner: true,
          // accounts: true,
          // transactions: true,
        },
        take: itemsPerPage,
        skip: itemsPerPage * (currentPage - 1),
      });
      return { record, itemsPerPage, count, totalPages, currentPage };
    } catch (error: any) {
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      if (!error.hasOwnProperty("message")) {
        error.message = "An error occurred while fetching paginated societies";
      }
      throw error;
    }
  }

  async getOne (idOrCodeSociety: string) {
    try {
      const record = await prisma.society.findFirst({
        where: {
          OR: [{ id: idOrCodeSociety }, { codeSociety: idOrCodeSociety }],
        },
        include: { user: true, linkedPartner: true, accounts: true },
      });

      if (record?.status === "deleted") return null;
      return record;
    } catch (error: any) {
      if (error.message.includes("Malformed ObjectID")) {
        // If the error is due to an invalid ObjectID, it's likely we're searching by codeSociety
        const record = await prisma.society.findFirst({
          where: { codeSociety: idOrCodeSociety },
          include: { user: true, linkedPartner: true, accounts: true },
        });

        if (record?.status === "deleted") return null;
        return record;
      }

      // For any other errors, rethrow
      throw error;
    }
  }

  async getOneLite (id: string) {
    try {
      const record = await prisma.society.findFirst({
        where: { id },
        select: {
          name: true,
          codeSociety: true,
          status: true,
        },
      });
      if (record?.status === "deleted") return null;
      return record;
    } catch (error: any) {
      throw error;
    }
  }

  async update (
    code: string,
    req: { name?: string; code?: string; status?: string; },
  ) {
    try {
      const error: any = new Error(
        "Mise à jour impossible (une société avec ce nom existe déja)",
      );
      const exist = await prisma.society.findFirst({
        where: { name: { equals: req.name, mode: 'insensitive' } },
      });
      const existCode = await prisma.society.findFirst({
        where: { codeSociety: { equals: req.code, mode: 'insensitive' } },
      });
      const ownName = await prisma.society.findFirst({
        where: { name: { equals: req.name, mode: 'insensitive' }, id: code },
      });
      const ownCode = await prisma.society.findFirst({
        where: { codeSociety: { equals: req.code, mode: 'insensitive' }, id: code },
      });

      if (exist && !ownName) {
        error.statusCode = 400;
        throw error;
      }
      if (existCode && !ownCode) {
        error.statusCode = 400;
        throw error;
      }
      return await prisma.society.update({
        where: {
          id: code,
        },
        data: req,
        include: {
          user: true,
          linkedPartner: true,
          accounts: true,
          transactions: true,
        },
      });
    } catch (error: any) {
      if (error.code == "P2025") {
        error.message = "society not found";
        error.statusCode = 404;
        throw error;
      }
      if (error.statusCode) throw error;
      error.statusCode = 500;
      error.message = "Internal server error";
      throw error;
    }
  }

  async delete (code: string) {
    return await prisma.society.update({
      where: {
        id: code,
      },
      data: {
        status: "deleted",
      },
    });
  }
  async checkPartnerCode (codeOperateur: string) {
    try {
      const society = await prisma.society.findFirst({
        where: {
          linkedPartner: {
            some: {
              code: codeOperateur,
            },
          },
        },
        include: {
          linkedPartner: {
            include: {
              partner: true,
            },
          },
        },
      });

      if (society) {
        const partner = society.linkedPartner.find(
          (lp) => lp.code === codeOperateur,
        )?.partner;
        return {
          isRegistered: true,
          partner: partner,
        };
      } else {
        return {
          isRegistered: false,
          partner: null,
        };
      }
    } catch (error: any) {
      console.error("Error checking partner code:", error);
      error.statusCode = 500;
      error.message = "Internal server error while checking partner code";
      throw error;
    }
  }
}
