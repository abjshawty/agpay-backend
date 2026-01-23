import { PrismaClient } from "@prisma/client";
import { Token } from "@prisma/client";
const prisma = new PrismaClient();

export default class TokenRepository {
    async registerNew (token: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>) {
        const exist = await this.getByEmail(token.userEmail);
        if (exist) {
            try {
                await prisma.tokenX.deleteMany({ where: { token: exist.token } });
                await prisma.tokenX.create({
                    data: {
                        token: exist.token,
                        expiry: exist.expiry,
                    }
                });
            } catch (e: any) {
                if (e?.code !== 'P2002') {
                    throw e;
                }
                // ignore duplicate archive entries
            }
            return await prisma.token.update({
                where: { id: exist.id },
                data: token
            });
        }
        return await prisma.token.create({ data: token });
    }
    async getByEmail (email: string) {
        return await prisma.token.findFirst({ where: { userEmail: email } });
    }
    async getAll () {
        return await prisma.token.findMany();
    }
    async update (id: string, data: Partial<Token>) {
        return await prisma.token.update({
            where: { id },
            data,
        });
    }
}
