import service from "./partners";
import { describe, it, expect } from "vitest";

describe("PartnerService", () => {
  describe("create", () => {
    it("should create a new partner", async () => {
      const element = {
        name: "Jean",
        code: [
          {
            code: "4840",
            idSociety: "65f85cb53a7b3e9334574301",
          },
        ],
        logo: "HUH?*",
        color: "#00f",
        adress: {
          mail: "chaos@gmail.com",
          phone: null,
        },
      };
      const result = await service.create(element);
      expect(result).toHaveProperty("id");
    });
  });

  describe("getAll", () => {
    it("should get all partners", async () => {
      const result = await service.getAll();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
