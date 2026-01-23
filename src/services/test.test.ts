import testService from "./test";
import { describe, it, expect, afterAll } from "vitest";

describe("TestService", () => {
  describe("create", () => {
    it("should create a new test", async () => {
      const lorem = "Lorem ipsum";

      const result = await testService.create(lorem);
      console.log(result);
      expect(result).toHaveProperty("id");
    });
  });

  describe("getAll", () => {
    it("should get all tests", async () => {
      const result = await testService.getAll();

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
