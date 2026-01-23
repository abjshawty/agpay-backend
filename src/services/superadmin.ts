import { $Enums, PrismaClient } from "@prisma/client";
const bcrypt = require("bcrypt");
import SocietyRepository from "../repository/society";
const societyRepo = new SocietyRepository();
const prisma = new PrismaClient();

async function createSuperAdminUser () {
  // Recherche d'un utilisateur existant avec le rôle superadmin
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: "superadmin", // Assure-toi que ce critère correspond à la manière dont tu identifies les super admins dans ta base de données
    },
  });

  // Si un super admin existe déjà, on ne crée pas de nouvel utilisateur
  if (existingSuperAdmin) {
    // console.log("Un super admin existe déjà. Aucune création nécessaire.");
    console.log("SuperAdmin is already created.");
    return;
  }

  // Si aucun super admin n'existe, on procède à la création
  const password = "P@ssword0"; // Remplace ceci par le mot de passe réel
  const hashedPassword = await bcrypt.hash(password, 10); // Hachage du mot de passe avec bcrypt
  const now = new Date();
  const expireIn = new Date(now.setMonth(now.getMonth() + 12));
  const profil = {
    id: "65fc5854157a39f30596b74e",
    type: "INTERNAL",
    name: "Master",
    features: [
      {
        id: 1,
        name: "Dashboard",
        auth: {
          canlist: true,
          cancreate: false,
          canupdate: false,
          candelete: false,
          canprint: true,
        },
      },
      {
        id: 2,
        name: "Profils",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 3,
        name: "Sociétés",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 4,
        name: "Partenaires",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 5,
        name: "Banques",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 6,
        name: "Comptes",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 7,
        name: "Utilisateurs interne",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 11,
        name: "Utilisateurs externe",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 9,
        name: "Transactions",
        auth: {
          canlist: true,
          cancreate: false,
          canupdate: false,
          candelete: false,
          canprint: true,
        },
      },
      {
        id: 8,
        name: "DFC",
        auth: {
          canlist: true,
          cancreate: false,
          canupdate: false,
          candelete: false,
          canprint: true,
        },
      },
      {
        id: 10,
        name: "Audit",
        auth: {
          canlist: true,
          cancreate: false,
          canupdate: false,
          candelete: false,
          canprint: true,
        },
      },
      {
        id: 12,
        name: "Session",
        auth: {
          canlist: true,
          cancreate: true,
          canupdate: true,
          candelete: true,
          canprint: true,
        },
      },
      {
        id: 13,
        name: "DFC Détails",
        auth: {
          canlist: true,
          cancreate: false,
          canupdate: false,
          candelete: false,
          canprint: true,
        },
      },
      {
        id: 13,
        name: "Journal des actions",
        auth: {
          canlist: true,
          cancreate: false,
          canupdate: false,
          candelete: false,
          canprint: true,
        },
      }
    ],
  };

  let profilAdmin = await prisma.profil.findFirst({
    where: {
      name: "superadmin", // Assure-toi que ce critère correspond à la manière dont tu identifies les super admins dans ta base de données
    },
  });

  // Si un super admin existe déjà, on ne crée pas de nouvel utilisateur
  if (!profilAdmin) {
    console.log("le profil admin n'existe pas. création nécessaire.");
    profilAdmin = await prisma.profil.create({
      data: {
        name: profil.name,
        type: profil.type === "INTERNAL" ? $Enums.ExtOrInt.INTERNAL : $Enums.ExtOrInt.EXTERNAL,
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
  const allSociety = await prisma.society.findMany();
  const user = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@super.com", // Remplace par l'email réel du super admin
      lastname: "John", // Remplace par le nom de famille
      firstname: "Doe", // Remplace par le prénom
      isEmailConfirmed: true, // Marque l'email comme confirmé si approprié
      role: "superadmin",
      expireDate: expireIn,
      profileId: profilAdmin.id,
      expiredOnDate: expireIn,

      societyId: allSociety.map((society) => society.id), // Ajoute toutes les sociétés créées à l'utilisateur superadmin
    },
  });
  const passwords = await prisma.password.create({
    data: {
      expireAt: expireIn,
      password: hashedPassword,
      userId: user.id,
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordIds: [passwords.id] },
  });
  const societies = ["CIE", "SODECI"];
  societies.map(async (societyName) => {
    let society: any = await societyRepo.getOne(societyName);
    if (!society) {
      try {
        society = await societyRepo.add({
          name: societyName,
          codeSociety: societyName,
          status: "active",
          userId: user.id,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { societyId: { push: society.id } },
        });
        console.log(`${societyName} society created successfully.`);
      } catch (error) {
        console.error(`Error creating ${societyName} society:`, error);
        return; // Exit if we can't create the society
      }
    } else {
      console.log(`${societyName} society already exists.`);
    }
  });
  console.log("Super Admin User Created:", user);
}

createSuperAdminUser()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
