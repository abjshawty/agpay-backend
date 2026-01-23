import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { KeycloakHelper } from "../helpers/keycloak.helper";
const prisma = new PrismaClient();
export default class AuthRepository {
    async verifyToken(token: string) {
        return jwt.verify(token, process.env.JWT_SECRET);
    };
    async resetPassword(id: string, keycloakId: string, password: string) {
        // Local Password
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();
        const expireIn = new Date(now.setMonth(now.getMonth() + 12));
        const passwords = await prisma.password.create({
            data: {
                expireAt: expireIn,
                password: hashedPassword,
                userId: id,
            },
        });
        await prisma.user.update({
            where: { id },
            data: { passwordIds: [passwords.id] },
        });

        // KeyCloak Password
        KeycloakHelper.setUserPassword({
            id: keycloakId,
            password,
            newUser: false
        });
    };
    async newToken(email: string) {
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h", });
        return token;
    };
    async decode(token: string) {
        return jwt.decode(token, process.env.JWT_SECRET);
    }
}