import { PrismaClient } from "@prisma/client";
import UserRepository from "./users";
const prisma = new PrismaClient();

export default class ProfilRepository {
  async add (profil: any, userId: string) {
    const error: any = new Error("Création impossible(le profil existe déja)");
    const existProfil = await prisma.profil.findFirst({
      where: { name: profil.name },
    });
    if (existProfil) {
      if (existProfil.status === "deleted") {
        Promise.all(profil.features.map(async feature => {
          await prisma.feature.updateMany({
            where: { AND: [{ profileId: existProfil.id }, { name: feature.name }] }, data: {
              name: feature.name,
              auth: feature.auth,
              description: feature.description
            }
          });
        }));

        return await prisma.profil.update({
          where: { id: existProfil.id },
          data: {
            status: "active",
            type: profil.type
          },
        });
      } else {
        error.statusCode = 400;
        throw error;
      }
    }
    return await prisma.profil.create({
      data: {
        name: profil.name,
        type: profil.type,
        createdBy: userId,
        // Utilisez `create` pour les features pour indiquer la création de nouveaux enregistrements
        features: {
          create: profil.features.map((feature: any) => ({
            name: feature.name,
            auth: {
              cancreate: feature.auth.cancreate,
              canupdate: feature.auth.canupdate,
              canprint: feature.auth.canprint,
              canlist: feature.auth.canlist,
              candelete: feature.auth.candelete,
            },
            description: feature.description,
          })),
        },
      },
    });
  }
  async update (id: string, profil: any) {
    const existingName = await prisma.profil.findFirst({ where: { name: profil.name } });
    if (existingName && existingName.id != id) {
      const statusCode = 409;
      const error_message = "Un profil avec ce nom existe déjà!";
      const error: any = new Error(error_message);
      error.statusCode = statusCode;
      throw error;
    }
    // Mise à jour du profil sans toucher aux features
    const updatedProfile = await prisma.profil.update({
      where: { id },
      data: {
        name: profil.name,
        type: profil.type,
      },
    });

    // Séparation des features existantes et nouvelles
    const existingFeatures = profil.features.filter((f) => f.id);
    const newFeatures = profil.features.filter((f) => !f.id);

    // Mise à jour des features existantes
    await Promise.all(
      existingFeatures.map((feature) =>
        prisma.feature.update({
          where: { id: feature.id },
          data: {
            auth: feature.auth,
            description: feature.description,
          },
        }),
      ),
    );

    // Création des nouvelles features
    await Promise.all(
      newFeatures.map((feature) =>
        prisma.profil.update({
          where: { id },
          data: {
            features: {
              create: {
                name: feature.name,
                auth: feature.auth,
                description: feature.description,
              },
            },
          },
        }),
      ),
    );

    return await prisma.profil.findFirst({ where: { id: id }, include: { features: true, users: { select: { firstname: true, lastname: true, email: true } } } });
  }

  async getAll () {
    return await prisma.profil.findMany({
      include: { features: true, users: { select: { firstname: true, lastname: true, email: true } } },
    });
  }
  async delete (id: string) {
    const error: any = new Error("Le profil est utilisé par des utilisateurs");
    const profil = await prisma.profil.findUnique({
      where: { id },
      include: { users: { select: { firstname: true, lastname: true, email: true } } },
    });
    if (profil!.users.length > 0) {
      error.statusCode = 400;
      throw error;
    }
    return await prisma.profil.update({
      where: { id },
      data: {
        status: "deleted",
      },
    });
  }
  async getOne (id) {
    return await prisma.profil.findFirst({
      where: { id },
      include: { features: true, users: { select: { firstname: true, lastname: true, email: true } } },
    });

  }
  async getAllPaginate (currentPage: number, query?: string, type?: string) {
    const itemsPerPage = 10;
    console.log("Profile type (ProfileRepository.getAllPaginate):", type);

    const and: any[] = [{ status: "active" }];

    if (query?.trim()) {
      and.push({ name: { contains: query.trim(), mode: "insensitive" } });
    }

    if (type?.trim()) {
      and.push({ type: type.trim().toUpperCase() });
      // ou { type: { equals: type.trim().toUpperCase() } }
    }

    const searchConditions = { AND: and };

    // let searchConditions: any = {
    //   AND: [
    //     { status: "active" }, // Condition pour que le compte soit actif
    //     {
    //       name: query
    //         ? { contains: query, mode: "insensitive" }
    //         : { contains: "" }
    //     },
    //     {
    //       type: type
    //         ? type.toUpperCase()
    //         : { contains: "" },
    //     }
    //   ].filter((condition) => condition !== undefined),
    // };
    const count = await prisma.profil.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);

    const record = await prisma.profil.findMany({
      where: searchConditions,
      include: {
        features: true,
        users: { select: { firstname: true, lastname: true, email: true } },
      },
      take: itemsPerPage,
      skip: itemsPerPage * (currentPage - 1),
    });
    return { record, itemsPerPage, count, totalPages, currentPage };
  }

  async getType (type: string, query?: string) {
    const itemsPerPage = 10;
    let searchConditions: any = {
      AND: [
        { status: "active" }, // Condition pour que le compte soit actif
        { type: type },
        {
          name: query
            ? { contains: query, mode: "insensitive" }
            : undefined,
        },
      ],
    };

    if (!query) {
      searchConditions = { status: "active", type };
    }
    const count = await prisma.profil.count({ where: searchConditions });
    const totalPages = Math.ceil(count / itemsPerPage);
    console.log(searchConditions);
    const record = await prisma.profil.findMany({
      where: searchConditions,
      include: {
        features: true,
        users: { select: { firstname: true, lastname: true, email: true } },
      },
      take: itemsPerPage,
      // skip: itemsPerPage * (currentPage - 1),
    });
    return record;
  }

  async populate (userId: string) {
    const defaultProfiles = [
      {
        name: "Admin",
        features: [
          {
            name: "User Management",
            auth: {
              cancreate: true,
              canupdate: true,
              canprint: true,
              canlist: true,
              candelete: true,
            },
            description: "Manage users",
          },
          {
            name: "Profile Management",
            auth: {
              cancreate: true,
              canupdate: true,
              canprint: true,
              canlist: true,
              candelete: true,
            },
            description: "Manage profiles",
          },
        ],
      },
      {
        name: "User",
        features: [
          {
            name: "User Management",
            auth: {
              cancreate: false,
              canupdate: false,
              canprint: true,
              canlist: true,
              candelete: false,
            },
            description: "View users",
          },
        ],
      },
    ];

    for (const profile of defaultProfiles) {
      const existingProfile = await prisma.profil.findFirst({
        where: { name: profile.name },
      });
      if (!existingProfile) {
        await this.add(profile, userId);
      }
    }
  }
}
