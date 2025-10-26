import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { getConfig, CONFIG_KEYS } from "@/server/config";
import { qwenTranscribeFromUrl } from "@/clients/qwen-asr";
import { uploadToOssAndGetPublicUrl } from "@/server/storage";
import { recordASRUsage, resetDailyStats } from "@/server/monitoring";
import { setCachedAudio } from "@/server/audio-cache";
import os from "os";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { exec as execCb } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const exec = promisify(execCb);

const bodySchema = z.object({
  audioUrl: z.string().url(),
  segmentDuration: z.number().min(10).max(180).default(170),
  language: z.enum(["auto","zh","en"]).default("auto"),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const json = await req.json().catch(()=>null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError("Bad Request", 400);

  const { audioUrl, segmentDuration, language } = parsed.data;

  // concurrency from config or default 3 (降低并发数以减少API失败率)
  const maxConcurrent = parseInt(await getConfig(CONFIG_KEYS.AUDIO_MAX_CONCURRENT, "3") || "3"); // 降低并发数，提高稳定性

  // Helpers for local download & cutting
  function getFfmpegPath(): string {
    const p = process.env.FFMPEG_PATH;
    if (p && p.trim()) return p.trim();
    return "ffmpeg";
  }
  function getFfprobePath(): string {
    const ff = getFfmpegPath();
    return ff.endsWith("ffmpeg") ? ff.replace(/ffmpeg$/, "ffprobe") : "ffprobe";
  }
  async function ensureTmpDir(): Promise<string> {
    const dir = path.join(os.tmpdir(), "podroom");
    await fs.promises.mkdir(dir, { recursive: true }).catch(()=>{});
    return dir;
  }
  async function downloadWholeToTemp(sourceUrl: string): Promise<string> {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const proxyUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(sourceUrl)}`;
    const tmp = await ensureTmpDir();
    const tmpFile = path.join(tmp, `src-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`);
    const res = await fetch(proxyUrl);
    if (!res.ok || !res.body) throw new Error(`下载失败(${res.status})`);
    const fileStream = fs.createWriteStream(tmpFile);
    await pipeline(res.body as any, fileStream);
    return tmpFile;
  }
  async function getDurationSeconds(localFile: string): Promise<number> {
    try {
      const { stdout } = await exec(`${getFfprobePath()} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localFile}"`, { timeout: 20000 });
      const val = parseFloat((stdout || "").trim());
      if (Number.isFinite(val) && val > 0) return Math.floor(val);
    } catch (e) {}
    return 2640;
  }
  async function cutOne(localFile: string, start: number, duration: number): Promise<Buffer> {
    const tmp = await ensureTmpDir();
    const outFile = path.join(tmp, `seg-${start}-${duration}-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`);
    const cmd = `"${getFfmpegPath()}" -ss ${start} -t ${duration} -i "${localFile}" -vn -acodec aac -b:a 128k -movflags +faststart -hide_banner -loglevel error -y "${outFile}"`;
    
    try {
      await exec(cmd, { timeout: 120000 });
      
      // 验证切割后的文件
      const stat = await fs.promises.stat(outFile);
      if (stat.size === 0) {
        throw new Error(`切割后的音频文件为空: ${start}-${start + duration}秒`);
      }
      
      const buf = await fs.promises.readFile(outFile);
      // cleanup the segment temp file after read
      fs.promises.unlink(outFile).catch(()=>{});
      return buf;
    } catch (error: any) {
      // 清理临时文件
      fs.promises.unlink(outFile).catch(()=>{});
      throw new Error(`音频切割失败 (${start}-${start + duration}秒): ${error.message}`);
    }
  }

  // Step 1: download once
  let localFile = "";
  try {
    localFile = await downloadWholeToTemp(audioUrl);
  } catch (e: any) {
    return jsonError(e?.message || "音频下载失败", 500);
  }

  // Step 2: probe duration and plan segments
  const duration = await getDurationSeconds(localFile);
  const count = Math.ceil(duration / segmentDuration);
  const segments = Array.from({ length: count }).map((_, i) => {
    const start = i * segmentDuration;
    const end = Math.min((i + 1) * segmentDuration, duration);
    return { index: i, start, end, len: end - start };
  });

  // Step 3: cut locally and upload to OSS
  const uploaded: { index: number; url: string }[] = [];
  try {
    async function runPool<T>(items: any[], worker: (it: any) => Promise<T>, n: number) {
      const ret: T[] = new Array(items.length) as any;
      let p = 0;
      const running: Promise<void>[] = [];
      async function next() {
        const i = p++;
        if (i >= items.length) return;
        ret[i] = await worker(items[i]);
        return next();
      }
      for (let i=0;i<Math.min(n, items.length);i++) running.push(next() as any);
      await Promise.all(running);
      return ret;
    }
    const results = await runPool(segments, async (s) => {
      const buf = await cutOne(localFile, s.start, s.len);
      const key = `temp/${s.start}-${s.end}.m4a`;
      const url = await uploadToOssAndGetPublicUrl(key, buf, "audio/mp4");
      if (!url) throw new Error("OSS 上传失败");
      return { index: s.index, url };
    }, Math.max(1, maxConcurrent));
    uploaded.push(...results);
  } catch (e: any) {
    // cleanup local file then report
    fs.promises.unlink(localFile).catch(()=>{});
    return jsonError(e?.message || "分段上传失败", 500);
  }

  // Step 3: concurrent ASR calls
  async function runPool<T>(items: { index: number; url: string }[], worker: (it: { index: number; url: string }) => Promise<T>, n: number) {
    const ret: T[] = new Array(items.length) as any;
    let p = 0;
    const queue: Promise<void>[] = [];
    async function next() {
      const i = p++;
      if (i >= items.length) return;
      try { ret[i] = await worker(items[i]); } catch (e:any) { throw e; }
      return next();
    }
    for (let i=0;i<Math.min(n, items.length);i++) queue.push(next() as any);
    await Promise.all(queue);
    return ret;
  }

  let results;
  try {
    results = await runPool(uploaded, async (it) => {
      console.log("ASR request for:", it.url);
      
      // 重试机制：最多重试3次
      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const r = await qwenTranscribeFromUrl(it.url, language === "auto" ? undefined : language);
          
          // 验证转写结果
          if (!r.text || r.text.trim().length === 0) {
            throw new Error(`转写结果为空 (尝试 ${attempt}/3)`);
          }
          
          console.log(`ASR ok for index: ${it.index} (尝试 ${attempt}/3)`);
          return { index: it.index, text: r.text, language: r.language };
        } catch (error: any) {
          lastError = error;
          console.warn(`ASR 失败 (尝试 ${attempt}/3) for index ${it.index}:`, error.message);
          
          if (attempt < 3) {
            // 减少等待时间，提高处理速度
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      // 所有重试都失败了：如果明确提示无有效文本，则视为该分段为空，不中断整体流程
      const msg = (lastError?.message || '').toString();
      if (/ASR_RESPONSE_HAVE_NO_WORDS/i.test(msg) || /无语音|无有效文本/.test(msg)) {
        console.warn(`ASR 无有效文本，跳过分段 index=${it.index}`);
        return { index: it.index, text: "", language: undefined as any };
      }
      // 其他错误仍然中断
      throw new Error(`ASR 转写失败 (已重试3次): ${lastError?.message || '未知错误'}`);
    }, Math.max(1, maxConcurrent));
  } catch (e: any) {
    console.error("ASR error:", e?.message || e);
    // cleanup local file before returning
    fs.promises.unlink(localFile).catch(()=>{});
    return jsonError(`ASR 失败: ${e?.message || e}`, 500);
  }

  // 若所有分段均为空，则返回失败
  const nonEmpty = results.filter((r: any) => r && typeof r.text === 'string' && r.text.trim().length > 0);
  if (nonEmpty.length === 0) {
    fs.promises.unlink(localFile).catch(()=>{});
    return jsonError('ASR 失败: 所有分段均无有效文本', 500);
  }

  // 保持ASR片段数组，不进行拼接
  const asrSegments = nonEmpty
    .sort((a,b)=>a.index-b.index)
    .map(r=>r.text?.trim())
    .filter(Boolean);

  // 为了兼容性，也提供拼接版本
  const merged = asrSegments.join("\n\n");

  // cleanup local source file
  fs.promises.unlink(localFile).catch(()=>{});

  // 记录API使用情况
  const processingTime = Math.round((Date.now() - startTime) / 1000); // 转换为秒
  await recordASRUsage(processingTime);
  
  // 重置每日统计（如果需要）
  resetDailyStats();

  // 缓存转写结果
  await setCachedAudio(audioUrl, {
    transcript: merged,
    segments: asrSegments, // 新增：保存片段数组
    duration: Math.round(duration)
  });

  return Response.json({ 
    success: true, 
    transcript: merged, 
    segments: asrSegments, // 新增：返回片段数组
    language: language === "auto" ? (nonEmpty.find(r=>r.language)?.language ?? undefined) : language 
  });
}


