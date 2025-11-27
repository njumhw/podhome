import { PrismaClient } from "@prisma/client";
import { db, handleDatabaseError } from "./db";

// 重试配置
const RETRY_CONFIG = {
	maxRetries: 3,
	baseDelay: 1000, // 1秒
	maxDelay: 10000, // 10秒
	backoffFactor: 2,
};

// 计算重试延迟时间（指数退避）
function calculateDelay(attempt: number): number {
	const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1);
	return Math.min(delay, RETRY_CONFIG.maxDelay);
}

// 重试装饰器
export function withRetry<T extends any[], R>(
	fn: (...args: T) => Promise<R>,
	operationName: string = '数据库操作'
) {
	return async (...args: T): Promise<R> => {
		let lastError: any;
		
		for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
			try {
				return await fn(...args);
			} catch (error: any) {
				lastError = error;
				
				// 检查是否是连接相关错误
				if (error.code === 'P1017' || error.code === 'P1001' || error.message?.includes('connection')) {
					if (attempt < RETRY_CONFIG.maxRetries) {
						const delay = calculateDelay(attempt);
						console.warn(`${operationName} 失败 (尝试 ${attempt}/${RETRY_CONFIG.maxRetries}): ${error.message}`);
						console.log(`等待 ${delay}ms 后重试...`);
						await new Promise(resolve => setTimeout(resolve, delay));
						continue;
					}
				}
				
				// 非连接错误或重试次数用完，直接抛出
				throw error;
			}
		}
		
		// 所有重试都失败了
		console.error(`${operationName} 在 ${RETRY_CONFIG.maxRetries} 次重试后仍然失败`);
		handleDatabaseError(lastError);
		throw lastError;
	};
}

// 数据库操作包装器
export class DatabaseWrapper {
	// 查询操作
	static async findFirst(model: any, args: any) {
		return withRetry(
			() => model.findFirst(args),
			`查询 ${model.name || '记录'}`
		)();
	}

	static async findMany(model: any, args: any) {
		return withRetry(
			() => model.findMany(args),
			`查询多个 ${model.name || '记录'}`
		)();
	}

	static async findUnique(model: any, args: any) {
		return withRetry(
			() => model.findUnique(args),
			`查询唯一 ${model.name || '记录'}`
		)();
	}

	// 创建操作
	static async create(model: any, args: any) {
		return withRetry(
			() => model.create(args),
			`创建 ${model.name || '记录'}`
		)();
	}

	// 更新操作
	static async update(model: any, args: any) {
		return withRetry(
			() => model.update(args),
			`更新 ${model.name || '记录'}`
		)();
	}

	// 删除操作
	static async delete(model: any, args: any) {
		return withRetry(
			() => model.delete(args),
			`删除 ${model.name || '记录'}`
		)();
	}

	// 计数操作
	static async count(model: any, args: any) {
		return withRetry(
			() => model.count(args),
			`计数 ${model.name || '记录'}`
		)();
	}

	// 原始查询
	static async queryRaw(query: TemplateStringsArray, ...values: any[]) {
		return withRetry(
			() => db.$queryRaw(query, ...values),
			'原始查询'
		)();
	}
}

// 导出常用的数据库操作
export const dbRetry = {
	// 任务队列操作
	taskQueue: {
		findFirst: (args: any) => DatabaseWrapper.findFirst(db.taskQueue, args),
		findMany: (args: any) => DatabaseWrapper.findMany(db.taskQueue, args),
		create: (args: any) => DatabaseWrapper.create(db.taskQueue, args),
		update: (args: any) => DatabaseWrapper.update(db.taskQueue, args),
		delete: (args: any) => DatabaseWrapper.delete(db.taskQueue, args),
		count: (args: any) => DatabaseWrapper.count(db.taskQueue, args),
	},
	
	// 播客操作
	podcast: {
		findFirst: (args: any) => DatabaseWrapper.findFirst(db.podcast, args),
		findMany: (args: any) => DatabaseWrapper.findMany(db.podcast, args),
		create: (args: any) => DatabaseWrapper.create(db.podcast, args),
		update: (args: any) => DatabaseWrapper.update(db.podcast, args),
		delete: (args: any) => DatabaseWrapper.delete(db.podcast, args),
		count: (args: any) => DatabaseWrapper.count(db.podcast, args),
	},
	
	// 用户操作
	user: {
		findFirst: (args: any) => DatabaseWrapper.findFirst(db.user, args),
		findMany: (args: any) => DatabaseWrapper.findMany(db.user, args),
		create: (args: any) => DatabaseWrapper.create(db.user, args),
		update: (args: any) => DatabaseWrapper.update(db.user, args),
		delete: (args: any) => DatabaseWrapper.delete(db.user, args),
		count: (args: any) => DatabaseWrapper.count(db.user, args),
	},
	
	// 原始查询
	queryRaw: (query: TemplateStringsArray, ...values: any[]) => DatabaseWrapper.queryRaw(query, ...values),
};



