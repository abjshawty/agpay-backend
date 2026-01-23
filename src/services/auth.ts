import AuthRepository from "../repository/auth";
import UserRepository from "../repository/users";
class AuthService {
    private repo = new AuthRepository();
    private user = new UserRepository();
    async verifyToken (token: string) {
        try {
            const result = await this.repo.verifyToken(token);
            return result;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }
    async decode (token: string) {
        return this.repo.decode(token);
    }
    async resetPassword (token: string, password: string, email?: string) {
        try {
            let user: any;
            if (email) {
                user = await this.user.getEmailLite(email);
                if (!user) {
                    const error: any = new Error("Utilisateur non trouvé");
                    error.statusCode = 404;
                    throw error;
                }
            } else {
                const box: { email: string, iat: number, exp: number; } = (await this.verifyToken(token)) as { email: string, iat: number, exp: number; };
                user = await this.user.getEmailLite(box.email);
                if (!user) {
                    const error: any = new Error("Utilisateur non trouvé");
                    error.statusCode = 404;
                    throw error;
                }
            }
            if (user.type.toUpperCase() !== "EXTERNAL") {
                const error: any = new Error("Utilisateur non trouvé");
                error.statusCode = 404;
                throw error;
            }
            const result = await this.repo.resetPassword(user.id, user.keycloakId, password);
            return user;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }
    async newToken (email: string) {
        try {
            // Verify User Existence
            const exists = await this.user.getEmailLite(email);
            if (!exists) {
                const error: any = new Error("Utilisateur non trouvé");
                error.statusCode = 404;
                throw error;
            }

            const result = await this.repo.newToken(email);
            return result;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }
};
export default new AuthService();