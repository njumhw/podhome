import { db } from "@/server/db";

// 系统配置键名常量
export const CONFIG_KEYS = {
	// 进度条文案池
	PROGRESS_MESSAGES: "progress_messages",
	
	// 免责声明
	DISCLAIMER: "disclaimer",
	
	// 打赏二维码
	DONATION_QR: "donation_qr",
	
	// 系统设置
	MAX_UPLOADS_PER_DAY: "max_uploads_per_day",
	MAX_UPLOADS_PER_DAY_ADMIN: "max_uploads_per_day_admin",
	
	// AI 配置
	QWEN_MODEL_NAME: "qwen_model_name",
	QWEN_EMBEDDING_MODEL: "qwen_embedding_model",
	
	// 其他
	MAINTENANCE_MODE: "maintenance_mode",
	ALLOW_GUEST_UPLOAD: "allow_guest_upload",

	// 音频处理
	AUDIO_SEGMENT_DURATION: "AUDIO_SEGMENT_DURATION",
	AUDIO_AUTO_SEGMENT: "AUDIO_AUTO_SEGMENT",
	AUDIO_MAX_CONCURRENT: "AUDIO_MAX_CONCURRENT",
} as const;

// 获取配置值
export async function getConfig(key: string, defaultValue?: string): Promise<string | null> {
	const config = await db.systemConfig.findUnique({
		where: { key },
		select: { value: true },
	});
	
	return config?.value ?? defaultValue ?? null;
}

// 获取多个配置
export async function getConfigs(keys: string[]): Promise<Record<string, string | null>> {
	const configs = await db.systemConfig.findMany({
		where: { key: { in: keys } },
		select: { key: true, value: true },
	});
	
	const result: Record<string, string | null> = {};
	for (const key of keys) {
		const config = configs.find(c => c.key === key);
		result[key] = config?.value ?? null;
	}
	
	return result;
}

// 设置配置值
export async function setConfig(key: string, value: string): Promise<void> {
	await db.systemConfig.upsert({
		where: { key },
		update: { value },
		create: { key, value },
	});
}

// 获取进度条文案池
export async function getProgressMessages(): Promise<string[]> {
	const messages = await getConfig(CONFIG_KEYS.PROGRESS_MESSAGES);
	if (!messages) return [];
	
	try {
		return JSON.parse(messages);
	} catch {
		return [];
	}
}

// 设置进度条文案池
export async function setProgressMessages(messages: string[]): Promise<void> {
	await setConfig(CONFIG_KEYS.PROGRESS_MESSAGES, JSON.stringify(messages));
}

// 获取免责声明
export async function getDisclaimer(): Promise<string> {
	return (await getConfig(CONFIG_KEYS.DISCLAIMER)) ?? "本平台仅提供播客内容转写服务，内容版权归原作者所有。";
}

// 获取打赏二维码
export async function getDonationQR(): Promise<string | null> {
	return await getConfig(CONFIG_KEYS.DONATION_QR);
}

// 初始化默认配置
export async function initDefaultConfigs(): Promise<void> {
	const defaultConfigs = [
		{
			key: CONFIG_KEYS.PROGRESS_MESSAGES,
			value: JSON.stringify([
				"正在解析播客链接...",
				"获取音频文件信息...",
				"开始转写处理...",
				"AI 正在努力工作...",
				"清洗文本内容...",
				"识别说话人身份...",
				"生成内容总结...",
				"切片处理中...",
				"向量化存储...",
				"即将完成...",
			]),
		},
		{
			key: CONFIG_KEYS.DISCLAIMER,
			value: "本平台仅提供播客内容转写服务，内容版权归原作者所有。",
		},
		{
			key: CONFIG_KEYS.MAX_UPLOADS_PER_DAY,
			value: "5",
		},
		{
			key: CONFIG_KEYS.MAX_UPLOADS_PER_DAY_ADMIN,
			value: "999",
		},
		{
			key: CONFIG_KEYS.QWEN_MODEL_NAME,
			value: "qwen-max",
		},
		{
			key: CONFIG_KEYS.QWEN_EMBEDDING_MODEL,
			value: "text-embedding-v1",
		},
		{
			key: CONFIG_KEYS.MAINTENANCE_MODE,
			value: "false",
		},
		{
			key: CONFIG_KEYS.ALLOW_GUEST_UPLOAD,
			value: "false",
		},
		// 音频处理默认配置
		{
			key: CONFIG_KEYS.AUDIO_SEGMENT_DURATION,
			value: "170",
		},
		{
			key: CONFIG_KEYS.AUDIO_AUTO_SEGMENT,
			value: "true",
		},
		{
			key: CONFIG_KEYS.AUDIO_MAX_CONCURRENT,
			value: "3",
		},
	];

	await db.$transaction(
		defaultConfigs.map(config =>
			db.systemConfig.upsert({
				where: { key: config.key },
				update: {},
				create: config,
			})
		)
	);
}
