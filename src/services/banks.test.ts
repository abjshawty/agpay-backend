import service from "./banks";
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

describe("BankService", () => {
  describe("create", () => {
    it("should create a new bank", async () => {
      const result = await service.create({
        name: "Bank 3",
        code: "Service Test 1",
      });

      console.log(result);
      expect(result).toHaveProperty("name");
    });
  });

  describe("getAll", () => {
    it("should get all banks", async () => {
      const result = await service.getAll();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
