import { PrismaClient } from "@prisma/client";

declare global {
	// eslint-disable-next-line no-var
	var prismaGlobal: PrismaClient | undefined;
}

// 数据库连接配置优化
const createPrismaClient = () => {
	return new PrismaClient({
		log: ["warn", "error"],
		datasources: {
			db: {
				url: process.env.DATABASE_URL,
			},
		},
	});
};

// 在开发环境中，每次重新生成 Prisma 客户端后需要清除缓存
// 通过检查 Prisma 客户端版本或强制重新创建来确保使用最新版本
export const db: PrismaClient = (() => {
	// 如果全局缓存存在，先断开连接
	if (global.prismaGlobal) {
		try {
			global.prismaGlobal.$disconnect().catch(() => {});
		} catch (e) {
			// 忽略断开连接错误
		}
	}
	// 创建新的 Prisma 客户端实例
	const client = createPrismaClient();
	if (process.env.NODE_ENV !== "production") {
		global.prismaGlobal = client;
	}
	return client;
})();

// 数据库连接健康检查
export async function checkDatabaseHealth(): Promise<boolean> {
	try {
		await db.$queryRaw`SELECT 1`;
		return true;
	} catch (error) {
		console.error('数据库健康检查失败:', error);
		return false;
	}
}

// 优雅关闭数据库连接
export async function closeDatabaseConnection(): Promise<void> {
	try {
		await db.$disconnect();
		console.log('数据库连接已关闭');
	} catch (error) {
		console.error('关闭数据库连接时出错:', error);
	}
}

// 处理数据库连接错误
export function handleDatabaseError(error: any): void {
	if (error.code === 'P1017') {
		console.warn('数据库连接已关闭，尝试重新连接...');
		// 这里可以添加重连逻辑
	} else if (error.code === 'P1001') {
		console.warn('无法连接到数据库服务器');
	} else {
		console.error('数据库错误:', error);
	}
}
