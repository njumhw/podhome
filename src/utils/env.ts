import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.string().default("3000"),

	DATABASE_URL: z.string().url(),

	AUTH_SECRET: z.string().min(1),
	ADMIN_DASHBOARD_SECRET: z.string().min(1),

	INVITE_CODE_SALT: z.string().optional(),

	ALIYUN_ACCESS_KEY_ID: z.string().optional(),
	ALIYUN_ACCESS_KEY_SECRET: z.string().optional(),
	ALIYUN_ASR_APP_KEY: z.string().optional(),

	QWEN_API_KEY: z.string().optional(),
	QWEN_MODEL_NAME: z.string().default("qwen-max"),

	QWEN_EMBEDDING_API_KEY: z.string().optional(),
	QWEN_EMBEDDING_MODEL: z.string().default("text-embedding-v1"),

	ASSET_PROXY_BASE_URL: z.string().url().optional(),

	SENTRY_DSN: z.string().url().optional(),
	LOG_LEVEL: z.string().default("info"),

	NEXT_TELEMETRY_DISABLED: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
	if (cachedEnv) return cachedEnv;
	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		console.error("[env] Missing or invalid environment variables:", parsed.error.flatten().fieldErrors);
		throw new Error("Invalid environment variables");
	}
	cachedEnv = parsed.data;
	return cachedEnv;
}
