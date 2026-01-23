import { PrismaClient } from "@prisma/client";
import { TokenX } from "@prisma/client";
const prisma = new PrismaClient();

export default class TokenRepository {
    async add (token: TokenX) {
        return await prisma.tokenX.create({ data: token });
    }
    async getByToken (token: string) {
        return await prisma.tokenX.findFirst({ where: { token } });
    }
    async getAll () {
        return await prisma.tokenX.findMany();
    }
    async update (id: string, data: Partial<TokenX>) {
        return await prisma.tokenX.update({
            where: { id },
            data,
        });
    }
}
