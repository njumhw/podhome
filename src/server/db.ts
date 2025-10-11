import { PrismaClient } from "@prisma/client";

declare global {
	// eslint-disable-next-line no-var
	var prismaGlobal: PrismaClient | undefined;
}

export const db: PrismaClient = global.prismaGlobal ?? new PrismaClient({
	log: ["warn", "error"],
});

if (process.env.NODE_ENV !== "production") global.prismaGlobal = db;
