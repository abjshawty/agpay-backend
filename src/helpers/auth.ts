import { FastifyReply, FastifyRequest } from "fastify";
import tokenXrepo from "../repository/tokenX";
import service from "../services/users";

export const checkAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done,
) => {
  try {
    const repo = new tokenXrepo();
    const token = request.headers.authorization?.split(" ")[1] || null;
    //@ts-ignore
    await request.jwtVerify();
    if (token) {
      const blocked = await repo.getByToken(token);
      if (blocked) {
        reply.status(401).send({
          message: "Unauthorized: token bloqué",
        });
      }
    }
  } catch (e: any) {
    //@ts-ignore
    reply.status(401);
    reply.send({
      message: "Unauthorized: authentification réquise, checkauth",
    });
  }
};
export const onlyadmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done,
) => {
  try {
    const verify: any = await request.jwtVerify();
    const user = await service.getOne(verify.id);
    //@ts-ignore
    const profilsAutorises = ["admin", "super-admin", "superadmin"];
    if (!profilsAutorises.includes(String(user?.profile?.name))) {
      console.log(profilsAutorises.includes(String(user?.profile?.name)));
      reply.status(401).send({
        message:
          "Unauthorized: un profil administrateur est réquis pour cette action",
      });
    }
    request.user = user as any; // Type assertion to avoid type error
  } catch (e: any) {
    console.log(e);
    reply
      .status(401)
      .send({ message: "Unauthorized: authentification requise" });
  }
};
