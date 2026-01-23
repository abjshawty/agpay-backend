import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default class ConfigRepository {
  async saveConfig(data: { inactivity?: number; accountDormancy?: number }) {
    try {
      if (!data.inactivity || !data.accountDormancy) {
        throw new Error(
          "Both inactivity and account dormancy data are required",
        );
      }

      const existingConfig = await prisma.config.findFirst();
      return existingConfig
        ? await prisma.config.update({
            where: { id: existingConfig.id },
            data: {
              inactivity: data.inactivity,
              accountDormancy: data.accountDormancy,
            },
          })
        : await prisma.config.create({
            data: {
              inactivity: data.inactivity,
              accountDormancy: data.accountDormancy,
            },
          });
    } catch (error) {
      console.error("Error saving config:", error);
      throw error;
    }
  }
  async getConfig() {
    try {
      return await prisma.config.findFirst();
    } catch (error) {
      console.error("Error fetching config:", error);
      throw error;
    }
  }

  async updateConfig(data: { inactivity?: number; accountDormancy?: number }) {
    try {
      const config = await prisma.config.findFirst();
      if (config) {
        return await prisma.config.update({
          where: { id: config.id },
          data: data,
        });
      }
      return await prisma.config.create({
        data: {
          inactivity: data.inactivity || 0,
          accountDormancy: data.accountDormancy || 0,
        },
      });
    } catch (error) {
      console.error("Error updating config:", error);
      throw error;
    }
  }
}
