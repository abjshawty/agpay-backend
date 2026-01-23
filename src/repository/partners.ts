import { CodeSociety, PrismaClient } from "@prisma/client";
import { RequestBody } from "../interfaces/partners";
import locale from "../data/locale";
const prisma = new PrismaClient();

export default class PartnerRepository {
  async add (partner: RequestBody) {
    return await prisma.partner.create({
      data: {
        name: partner.name,
        code: {
          create: partner.code.map((profileCode: any) => ({
            code: profileCode.code,
            society: {
              connect: { id: profileCode.idSociety },
            },
          })),
        },
        logo: partner.logo,
        color: partner.color,
        userId: partner.userId,
        adress: partner.adress,
        createdBy: partner.createdBy,
      },
      include: {
        code: {
          include: {
            society: true,
          },
        },
        // creator: true,
      },
    });
  }
  async getAll () {
    return await prisma.partner.findMany({
      include: {
        users: true,
        code: {
          include: {
            society: true,
          },
        },
        accounts: true,
        transactions: true,
      },
      where: { status: "active" },
    });
  }

  async getAllPaginate (
    currentPage: number,
    itemsPerPage: number,
    filters: {
      query?: string;
      name?: string;
      code?: string;
      status?: string;
      createdFrom?: string;
      createdTo?: string;
    },
  ) {
    let searchConditions: any = {
      AND: [
        { status: filters.status || "active" },
        filters.name
          ? { name: { contains: filters.name, mode: "insensitive" } }
          : {},
        filters.code
          ? {
            code: {
              some: { code: { contains: filters.code, mode: "insensitive" } },
            },
          }
          : {},
        filters.createdFrom
          ? { createdAt: { gte: new Date(filters.createdFrom) } }
          : {},
        filters.createdTo
          ? { createdAt: { lte: new Date(filters.createdTo) } }
          : {},
      ],
    };

    if (filters.query) {
      searchConditions.AND.push({
        OR: [
          { name: { contains: filters.query, mode: "insensitive" } },
          {
            code: {
              some: { code: { contains: filters.query, mode: "insensitive" } },
            },
          },
          {
            code: {
              some: {
                society: {
                  name: { contains: filters.query, mode: "insensitive" },
                },
              },
            },
          },
        ],
      });
    }

    const count = await prisma.partner.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);

    const record = await prisma.partner.findMany({
      where: searchConditions,
      include: {
        code: {
          include: {
            society: true,
          },
        },
        users: true,
        accounts: true,
      },
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
      orderBy: { createdAt: "desc" },
    });

    return { record, itemsPerPage, count, totalPages, currentPage };
  }

  async update (id: string, partnerData: any) {
    return await prisma.partner.update({
      where: { id },
      include: {
        code: true,
      },
      data: {
        ...partnerData,
        code: partnerData.hasOwnProperty("code")
          ? {
            upsert: partnerData.code.map((codeData: any) => ({
              where: {
                code_idPartner: {
                  code: codeData.code,
                  idPartner: id,
                },
              },
              update: {
                society: {
                  connect: codeData.societyId
                    ? { id: codeData.societyId }
                    : { codeSociety: codeData.society?.codeSociety },
                },
              },
              create: {
                code: codeData.code,
                society: {
                  connect: codeData.societyId
                    ? { id: codeData.societyId }
                    : { codeSociety: codeData.society?.codeSociety },
                },
              },
            })),
          }
          : {},
      },
    });
  }
  async deleteOne (id: string) {
    // return await prisma.partner.update({
    //   where: { id },
    //   data: { status: "deleted" },
    // });
    return await prisma.partner.delete({
      where: { id },
    });
  }
  async getOne (id: string) {
    const record = await prisma.partner.findUnique({
      where: {
        id: id,
        status: "active",
      },
      include: {
        code: {
          include: {
            society: true,
          },
        },
        users: true,
        accounts: true,
        transactions: true,
      },
    });
    if (record?.status == "deleted") return null;
    return record;
  }
  async getByCode (code: string) {
    const record = await prisma.partner.findFirst({
      where: {
        code: {
          some: {
            code: code,
            society: {
              codeSociety: {
                mode: "insensitive",
              },
            },
          },
        },
        status: "active",
      },
      include: {
        code: {
          include: {
            society: true,
          },
        },
        users: true,
        accounts: true,
        transactions: true,
      },
    });
    return record;
  }

  async getPartnerByName (name: string) {
    return await prisma.partner.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
  }

  async updateLite (id: string, data: any) {
    console.log("Sent Data: ", data);
    return await prisma.partner.update({
      where: { id },
      include: {
        code: true,
        // accounts: true
      },
      data: {
        name: data.name,
        logo: data.logo,
        color: data.color,
        updatedAt: new Date().toISOString(),
        adress: data.adress,
        code: {
          deleteMany: {
            idPartner: id,
          },
          createMany: {
            data: data.code!.filter((profileCode: any) => profileCode.code != "").map((profileCode: any) => ({
              code: profileCode.code,
              idSociety: profileCode.idSociety,
            })),
          },
        },
      },
    });
  }
}
