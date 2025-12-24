import { PrismaClient } from "@prisma/client";

declare global {
	// eslint-disable-next-line no-var
	var prismaGlobal: PrismaClient | undefined;
}

// 数据库连接配置优化
const createPrismaClient = () => {
	// 从 DATABASE_URL 中提取连接池参数，或使用默认值
	const databaseUrl = process.env.DATABASE_URL || '';
	
	// 如果 DATABASE_URL 中没有连接池参数，添加它们
	let finalDatabaseUrl = databaseUrl;
	if (databaseUrl && !databaseUrl.includes('connection_limit')) {
		// 添加连接池参数
		// 增加连接池大小到20，增加超时时间到60秒，提高稳定性
		const separator = databaseUrl.includes('?') ? '&' : '?';
		finalDatabaseUrl = `${databaseUrl}${separator}connection_limit=20&pool_timeout=60`;
	}
	
	return new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ["query", "error", "warn"] : ["error"],
		datasources: {
			db: {
				url: finalDatabaseUrl,
			},
		},
	});
};

// 使用单例模式，避免创建多个 Prisma 客户端实例（导致连接池耗尽）
// 在生产环境和开发环境中都使用全局缓存
export const db: PrismaClient = (() => {
	// 如果全局缓存存在，直接使用（避免创建新连接）
	if (global.prismaGlobal) {
		return global.prismaGlobal;
	}
	
	// 创建新的 Prisma 客户端实例
	const client = createPrismaClient();
	global.prismaGlobal = client;
	
	// 在应用关闭时清理连接
	if (typeof process !== 'undefined') {
		process.on('beforeExit', async () => {
			await client.$disconnect().catch(() => {});
		});
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

// 强制重新连接数据库（用于解决连接池耗尽或连接异常问题）
export async function reconnectDatabase(): Promise<void> {
	try {
		console.log('[数据库] 尝试重新连接数据库...');
		// 断开现有连接
		if (global.prismaGlobal) {
			await global.prismaGlobal.$disconnect().catch(() => {});
		}
		// 清除全局缓存
		global.prismaGlobal = undefined;
		// 重新创建连接
		const newClient = createPrismaClient();
		global.prismaGlobal = newClient;
		// 测试连接
		await newClient.$queryRaw`SELECT 1`;
		console.log('[数据库] 重新连接成功');
	} catch (error) {
		console.error('[数据库] 重新连接失败:', error);
		throw error;
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
