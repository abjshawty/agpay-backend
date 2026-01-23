import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import Repository from "./partners";

describe("PartnerRepository", () => {
  const prisma = new PrismaClient();
  const repo = new Repository();
  afterAll(async () => {
    await prisma.$disconnect();
  });
  describe("add", () => {
    it("should create a new partner record", async () => {
      const new_element = {
        name: "Partner 1",
        code: [
          {
            code: "0000",
            idSociety: "65f85cb53a7b3e9334574301",
          },
        ],
        logo: "/path/test/logo.png",
        color: "#251224",
        adress: {
          mail: "kouadiobhegnino@gmail.com",
          phone: "+2250711115686",
        },
      };
      const created = await repo.add(new_element);
      expect(created.name).toEqual(new_element.name);
    });
  });

  describe("getAll", () => {
    it("should return all partner records", async () => {
      const new_element = {
        name: "Partner 2",
        code: [
          {
            code: "0001",
            idSociety: "65f85cb53a7b3e9334574301",
          },
        ],
        logo: "/path/test/logo.png",
        color: "#090503",
        adress: {
          mail: "mariechristelle@gmail.com",
          phone: "+33 123456789",
        },
      };
      await repo.add(new_element);
      const partners = await repo.getAll();
      expect(partners.length).toBeGreaterThanOrEqual(1);
    });
  });
});
