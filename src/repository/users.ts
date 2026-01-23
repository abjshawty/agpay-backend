import { PrismaClient } from "@prisma/client";
import { UserBuild } from "../interfaces/users";
import locale from "../data/locale";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

export default class UserRepository {
  async add(userData: UserBuild) {
    try {
      const error: any = new Error(
        "Un compte avec cette adresse e-mail existe déjà",
      );
      const exist = await prisma.user.findFirst({
        where: { email: userData.email },
      });

      if (exist) {
        error.statusCode = 409;
        if (exist.status === "deleted") {
          return await prisma.user.update({
            where: { id: exist.id },
            data: {
              status: "active",
              lastname: userData.lastname,
              firstname: userData.firstname,
              matricule: userData.matricule,
              department: userData.department,
              college: userData.college,
              numeroFiche: userData.numeroFiche,
              lastLoginDate: userData.lastLoginDate,
              societyId: userData.societyId,
              keycloakId: userData.keycloakId!,
              partnerId: userData.partnerId,
              startDate: userData.startDate!,
              expireDate: userData.expireDate,
              expiredOnDate: userData.expiredOnDate,
              type: userData.type,
              isEmailConfirmed: userData.isEmailConfirmed,
              profileId: userData.profileId,
              username: userData.username,
              createdBy: userData.createdBy
            },
          });
        }
        throw error;
      }

      const now = new Date();
      const expireIn = new Date(now.setMonth(now.getMonth() + 3));
      const p = [];
      return await prisma.user.create({
        data: {
          email: userData.email,
          lastname: userData.lastname,
          firstname: userData.firstname,
          matricule: userData.matricule,
          department: userData.department,
          college: userData.college,
          numeroFiche: userData.numeroFiche,
          lastLoginDate: userData.lastLoginDate,
          societyId: userData.societyId,
          keycloakId: userData.keycloakId!,
          partnerId: userData.partnerId,
          startDate: userData.startDate!, // Ceci utilisera la valeur par défaut définie dans le modèle si non spécifié
          expireDate: expireIn,
          expiredOnDate: expireIn,
          type: userData.type || "INTERNAL",
          status: userData.status || "active",
          isEmailConfirmed: userData.isEmailConfirmed || false,
          profileId: userData.profileId,
          username: userData.username,
          createdBy: userData.createdBy
        },
        include: { societies: true, profile: true },
      });
    } catch (error: any) {
      //@ts-ignore
      console.log(error.message);
      error.statusCode = 500;
      throw error;
    }
  }
  async getAll() {
    return await prisma.user.findMany({
      include: { password: true, partner: true, societies: true },
      where: { status: "active" },
    });
  }
  async getuserByEmail(email: string) {
    const today = new Date();
    return await prisma.user.findFirst({
      where: {
        email,
      },
      include: {
        profile: { include: { features: true } },
        partner: true,
        societies: true,
        password: true,
        userSessions: true,
      },
    });
  }
  async getuserByEmailKc(email: string) {
    const today = new Date();
    return await prisma.user.findFirst({
      where: {
        email,
      },
      include: {
        profile: { include: { features: true } },
        partner: true,
        societies: true,
      },
    });
  }
  async getAllPaginate(currentPage: number, type?: string, query?: string) {
    const itemsPerPage = 10;
    let searchConditions: any = {
      AND: [
        { OR: [
          {
            status: "active",
            type
          },
          {
            status: "sleeping",
            type
          }
        ]}, // Condition pour que le compte soit actif
        {
          OR: [
            {
              email: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              lastname: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              firstname: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              matricule: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              department: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              college: query
                ? { contains: query, mode: "insensitive" }
                : undefined,
            },
            {
              societies: {
                some: {
                  name: query
                    ? { contains: query, mode: "insensitive" }
                    : undefined,
                },
              },
            },
            {
              partner: {
                name: query
                  ? { contains: query, mode: "insensitive" }
                  : undefined,
              },
            },
            {
              profile: {
                name: query
                  ? { contains: query, mode: "insensitive" }
                  : undefined,
              },
            },
          ].filter((condition) => condition !== undefined),
        },
      ],
    };

    if (!query) {
      searchConditions = { OR: [
          {
            status: "active",
            type
          },
          {
            status: "sleeping",
            type
          }
        ]};
    }
    const count = await prisma.user.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);

    console.log("🔍 USER getAllPaginate: Fetching users with conditions:", searchConditions);
    const record = await prisma.user.findMany({
      where: searchConditions,
      include: {
        profile: { include: { features: true } },
        partner: true,
        societies: true,
        password: true,
      },
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
    });
    console.log("🔍 USER getAllPaginate: Found", record.length, "users");

    for (const user of record) {
      console.log("🔍 USER Processing user:", user.email, "with societyIds:", user.societyId);
      // @ts-ignore
      user.societies = await Promise.all(user.societyId.map(async (id) => {
        console.log("🔍 USER Fetching society:", id);
        try {
          const society = await prisma.society.findUnique({
            where: { id },
          });
          console.log("🔍 USER Society fetched:", society?.name);
          return society;
        } catch (error: any) {
          console.error("🔴 ERROR fetching society:", id, error.message);
          throw error;
        }
      }));
    }
    console.log("🔍 USER getAllPaginate: Returning response");
    return { record, itemsPerPage, count, totalPages, currentPage };
  }
  async getEmailLite(email: string) {
    return await prisma.user.findFirst({
      where: {
        email
      },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        keycloakId: true,
        type: true,
        passwordIds: true,
        status: true
      }
    });
  }
  async getOne(id: string) {
    console.log(id);
    return await prisma.user.findFirst({
      where: { id },
      include: {
        profile: { include: { features: true } },
        partner: true,
        societies: true,
        password: true,
        userSessions: true,
      },
    });
  }
  async getOneLite(id: string) {
    console.log("🔍 USER getOneLite called with ID:", id);
    if (!id) {
      console.log("🔍 USER getOneLite: ID is null/undefined, returning null");
      return null;
    }

    // Vérifier si c'est un ObjectID MongoDB valide (24 caractères hexadécimaux)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) {
      console.warn(`⚠️ Invalid ObjectID format: "${id}" - returning null`);
      return null;
    }

    try {
      const result = await prisma.user.findFirst({
        where: { id },
        select: {
          email: true,
          firstname: true,
          lastname: true
        },
      });
      console.log("🔍 USER getOneLite result:", result);
      return result;
    } catch (error: any) {
      console.error("🔴 ERROR in getOneLite:", error.message);
      throw error;
    }
  }
  async setPassword(id: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const expireIn = new Date(now.setMonth(now.getMonth() + 12));

    const passwords = await prisma.password.create({
      data: {
        expireAt: expireIn,
        password: hashedPassword,
        userId: id,
      },
    });
    await prisma.user.update({
      where: { id },
      data: { passwordIds: [passwords.id] },
    });
  }
  async update(id: string, info: any) {
    try {
      const error: any = new Error(
        "Un compte avec cette adresse e-mail existe déjà",
      );
      const exist = await prisma.user.findFirst({
        where: { email: info.email },
      });
      const ownEmail = await prisma.user.findFirst({
        where: { email: info.email, id: id },
      });

      if (exist && !ownEmail) {
        error.statusCode = 409;
        throw error;
      }

      return await prisma.user.update({
        where: { id },
        data: info,
        include: {
          profile: { include: { features: true } },
          partner: { include: { code: { include: { society: true } } } },
          societies: true,
        },
      });
    } catch (error: any) {
      if (error.code == "P2025") {
        error.message = locale.notfound("Compte utilisateur");
        error.statusCode = 404;
        throw error;
      }
      if (error.statusCode) {
        throw error;
      }
      error.statusCode = 500;
      error.message = locale.system.errorTryCatchMessage;
      throw error;
    }
  }
  async updateSession(id: string, info: any) {
    try {
      return await prisma.userSession.updateMany({
        where: { userId: id, status: "active" },
        data: info,
      });
    } catch (error: any) {
      if (error.code == "P2025") {
        error.message = "session not found";
        error.statusCode = 404;
        throw error;
      }
      error.statusCode = 500;
      error.message = "Internal server error";
      throw error;
    }
  }
  async delete(id: string) {
    try {
      return await prisma.user.update({
        where: { id },
        data: { status: "deleted" },
      });
    } catch (error: any) {
      error.hasOwnProperty("statusCode") ? "" : (error.statusCode = 500);
      throw error;
    }
  }
  async createSession(payload: any) {
    return await prisma.userSession.create({
      data: payload,
      include: {
        user: {
          include: {
            societies: true,
            profile: { include: { features: true } },
            partner: true,
            password: true,
            userSessions: true,
          },
        },
      },
    });
  }
}
