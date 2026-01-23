import { PrismaClient } from "@prisma/client";
import { Account } from "@prisma/client";
import locale from "../data/locale";
import { User, UserBuild } from "../interfaces/users";
const prisma = new PrismaClient();

export default class AccountRepository {
  async add(account: any) {
    const error: any = new Error("Création impossible(la compte existe déja)");
    // const exist = await prisma.account.findFirst({
    //   where: { name: account.name },
    // });
    const exist = await prisma.account.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: account.name,
              mode: 'insensitive'
            },
            bankId: account.bankId
          }, 
          {
            rib: {
              equals: account.rib,
              mode: 'insensitive'
            }
          }
        ]
      }
    });

    if (exist) {
      if (exist.status === 'deleted') return await prisma.account.update({where: {id: exist.id}, data: {
        rib: account.rib,
        societyId: account.societyId,
        bankId: account.bankId,
        type: account.type,
        status: 'active'
      }})
      error.statusCode = 400;
      throw error;
    }

    return await prisma.account.create({ data: account });
  }
  async getMyExternal(userData: { id: string; iat: number; }) {
    const itemsPerPage = 10;
    const user = await prisma.user.findUnique({
      where: { id: userData.id },
    });
    console.log(userData.id);
    if (!user) {
      throw new Error("User not found");
    }
    let searchConditions: any = {
      type: "EXTERNAL",
      userId: userData.id,
      status: 'active'
    };
    return await prisma.account.findMany({
      where: searchConditions
    });
  }
  async getAllExternal(userData: { id: string; iat: number; }) {
    const itemsPerPage = 10;
    let searchConditions: any = {
      type: "EXTERNAL",
      status: 'active'
    };
    return await prisma.account.findMany({
      where: searchConditions
    });
  }
  async getAllInternal(userData: { id: string; iat: number; }, societe?: string) {
    const itemsPerPage = 10;
    let searchConditions: any = societe ? {
      type: "INTERNAL",
      society: { name: societe?.toUpperCase() },
      status: "active"
    } : {
      type: "INTERNAL",
      status: "active"
    };
    return await prisma.account.findMany({
      where: searchConditions
    });
  }
  async getAll() {
    return await prisma.account.findMany({
      include: {
        bank: true,
        partner: true,
        society: true,
      },
    });
  }
  async getAllPaginate(currentPage: number, query?: string, filters?: Partial<UserBuild>) {
    const itemsPerPage = 10;
    let searchConditions: any = {
      AND: [
        {OR: [{status: "active"}, {status: "sleeping"}] }, // Condition pour que le compte soit actif
        {
          OR: [
            {
              name: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              rib: query ? { contains: query, mode: "insensitive" } : undefined,
            },
            {
              bank: {
                name: query
                  ? { contains: query, mode: "insensitive" }
                  : undefined,
              },
            },
            {
              partner: {
                name: query
                  ? { contains: query, mode: "insensitive" }
                  : undefined,
              },
            },
          ].filter((condition) => condition !== undefined),
        },
        {
          partnerId: filters?.partnerId
            ? filters.partnerId
            : undefined,
        },
        // {
        //   societyId: filters?.societyId
        //     ? { in: filters.societyId }
        //     : undefined,
        // },
      ],
    };
    // if (!query) {
    //   searchConditions = { status: "active" };
    // }
    const count = await prisma.account.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);
    const record = await prisma.account.findMany({
      where: searchConditions,
      include: {
        bank: true,
        partner: true,
        society: { include: { user: true } },
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            type: true
          }
        }
      },
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
    });
    return { record, itemsPerPage, count, totalPages, currentPage };
  }
  async getOne(id: string) {
    const record = await prisma.account.findFirst({
      where: {
        id: id,
      },
      include: {
        bank: true,
        partner: true,
        society: {
          include: {
            user: true,
            linkedPartner: {
              include: {
                partner: true,
              },
            },
          },
        },
      },
    });
    if (record?.status == "deleted") return null;
    return record;
  }
  async update(id: string, req: any) {
    try {
      const exist = await prisma.account.findFirst({
        where: { name: req.name },
      });
      const ownName = await prisma.account.findFirst({
        where: { name: req.name, id },
      }) || false;
      console.log(exist, ownName)

      if (exist && !ownName) {
        console.log("Mise à jour impossible (une banque avec ce nom existe déja)")
        const error: any = new Error("Mise à jour impossible (une banque avec ce nom existe déjà)");
        error.statusCode = 409; // Conflict status code
        throw error;
      }

      return await prisma.account.update({
        where: {
          id,
        },
        data: req,
      });
    } catch (error: any) {
      if (!error.statusCode) {
        error.message = locale.notfound("Compte");
        error.statusCode = 500;
      error.message = "Internal server error";
      }
      throw error;
    }
  }
  async delete(id: string) {
    const exists = await prisma.account.findUnique({where: {id}, include: {DestRTO: true, SourcedRTO: true}})
    if (!exists) {
      const err:any = new Error("not found")
      err.statusCode = 404
      throw err
    }
    console.log("EXISTS", exists)
    if (exists.DestRTO.length > 0 || exists.SourcedRTO.length > 0) {
      console.log("Dest", exists.DestRTO)
      console.log("Sourced", exists.SourcedRTO)
      const err:any = new Error("Un compte déjà utilisé ne peut être supprimé.")
      err.statusCode = 400
      throw err
    }
    return await prisma.account.update({
      where: {
        id,
      },
      data: {
        status: "deleted",
      },
    });
  }
  async getRTJSource(data: string) {
    return await prisma.account.findFirst({
      where: {
        id: data,
      },
    });
  }
  async getRTJDestination(data: string) {
    return await prisma.account.findFirst({
      where: {
        id: data,
      },
    });
  }
}
