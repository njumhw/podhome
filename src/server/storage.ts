import { createClient } from "@supabase/supabase-js";
import OSS from "ali-oss";

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Do not throw at import time in dev; callers should handle null
}

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function ensureBucket(bucket: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { data: list } = await sb.storage.listBuckets();
  const existing = (list || []).find((b) => b.name === bucket);
  if (!existing) {
    await sb.storage.createBucket(bucket, { public: true });
  } else if (!existing.public) {
    // Force set to public if previously created as private
    await sb.storage.updateBucket(bucket, { public: true });
  }
}

export async function uploadAndSign(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  await ensureBucket(bucket);
  await sb.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// Upload and return public URL (bucket must be public). Used when 3rd-party needs direct access.
export async function uploadAndGetPublicUrl(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  await ensureBucket(bucket);
  await sb.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}


// ---------- Aliyun OSS helpers ----------
const OSS_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID as string | undefined;
const OSS_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET as string | undefined;
const OSS_REGION = process.env.ALIYUN_OSS_REGION as string | undefined; // e.g. cn-hangzhou
const OSS_BUCKET = process.env.ALIYUN_OSS_BUCKET as string | undefined;

function getOssClient(): OSS | null {
  if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_REGION || !OSS_BUCKET) return null;
  const client = new OSS({
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    region: `oss-${OSS_REGION}`,
    bucket: OSS_BUCKET,
    timeout: 60000,
  });
  return client as unknown as OSS;
}

export async function uploadToOssAndGetPublicUrl(
  path: string,
  file: Buffer,
  contentType: string
): Promise<string | null> {
  const client = getOssClient();
  if (!client || !OSS_BUCKET || !OSS_REGION) return null;
  await client.put(path, file, { headers: { 'Content-Type': contentType } });
  // Public URL on OSS
  const url = `https://${OSS_BUCKET}.oss-${OSS_REGION}.aliyuncs.com/${encodeURI(path)}`;
  return url;
}




