import { PrismaClient } from "@prisma/client";

declare global {
	// eslint-disable-next-line no-var
	var prismaGlobal: PrismaClient | undefined;
}

export const db: PrismaClient = global.prismaGlobal ?? new PrismaClient({
	log: ["warn", "error"],
	datasources: {
		db: {
			url: process.env.DATABASE_URL,
		},
	},
});

if (process.env.NODE_ENV !== "production") global.prismaGlobal = db;
