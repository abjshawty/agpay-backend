import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import TestRepository from "./test";

describe("TestRepository", () => {
  const prisma = new PrismaClient();
  const testRepo = new TestRepository();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("add", () => {
    it("should create a new test record", async () => {
      const newTest = { lorem: "ipsum" };
      const createdTest = await testRepo.add(newTest);
      expect(createdTest.lorem).toEqual(newTest.lorem);
    });
  });

  describe("getAll", () => {
    it("should return all test records", async () => {
      await testRepo.add({ lorem: "ipsum" });
      const tests = await testRepo.getAll();
      expect(tests.length).toBeGreaterThanOrEqual(1);
    });
  });
});
