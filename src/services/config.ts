import ConfigRepository from "../repository/config";

class ConfigService {
  private repo: ConfigRepository;

  constructor() {
    this.repo = new ConfigRepository();
  }

  async saveConfig(data: { inactivity?: number; accountDormancy?: number }) {
    try {
      return await this.repo.saveConfig(data);
    } catch (error: any) {
      console.error("Error in ConfigService.saveConfig:", error);
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async getConfig() {
    try {
      return await this.repo.getConfig();
    } catch (error: any) {
      console.error("Error in ConfigService.getConfig:", error);
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  async updateConfig(data: { inactivity?: number; accountDormancy?: number }) {
    try {
      return await this.repo.updateConfig(data);
    } catch (error: any) {
      console.error("Error in ConfigService.updateConfig:", error);
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}

export default new ConfigService();
