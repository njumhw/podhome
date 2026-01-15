/**
 * 分段ASR转写服务
 * 按120秒切割音频，分别转写每个片段，然后合并结果
 */

import { qwenTranscribeFromUrl } from "@/clients/qwen-asr";
import { uploadToOssAndGetPublicUrl } from "@/server/storage";
import { ASR_CONFIG } from "./asr-config";
import { detectAudioFormat, convertMp3ToM4a } from "@/server/audio-converter";
import os from "os";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { exec as execCb } from "child_process";
import { promisify } from "util";

const exec = promisify(execCb);

/**
 * 按120秒分段转写音频
 * 返回73个ASR片段（对于146分钟音频）
 */
export async function transcribeAudioWithSegmentation(
  audioUrl: string,
  language: string = "zh"
): Promise<{
  transcript: string; // 完整ASR文本（所有片段拼接）
  segments: string[]; // ASR片段数组（每个片段对应120秒音频）
  duration: number; // 音频总时长（秒）
  language?: string; // 检测到的语言（从ASR返回）
}> {
  const segmentDuration = ASR_CONFIG.maxDuration; // 120秒
  
  // Helper functions
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
    await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
    return dir;
  }
  
  // 获取服务器内部地址（用于生产环境的内部调用）
  function getServerBaseUrl(): string {
    // 优先级：
    // 1. 显式配置的 NEXT_PUBLIC_BASE_URL
    // 2. 生产环境：尝试使用 127.0.0.1（内部调用更快更可靠）
    // 3. 开发环境：使用 localhost:3000
    
    const explicitBase = process.env.NEXT_PUBLIC_BASE_URL;
    if (explicitBase) {
      return explicitBase;
    }
    
    const isProduction = process.env.NODE_ENV === 'production';
    const port = process.env.PORT || '3000';
    
    if (isProduction) {
      // 生产环境：优先使用 127.0.0.1（内部网络，更快更可靠）
      // 如果设置了 HOST，可以使用它；否则默认 127.0.0.1
      const host = process.env.HOST || '127.0.0.1';
      return `http://${host}:${port}`;
    }
    
    // 开发环境：使用 localhost
    return `http://localhost:${port}`;
  }
  
  async function downloadWholeToTemp(sourceUrl: string): Promise<string> {
    const tmp = await ensureTmpDir();
    
    // 检测音频格式
    const format = detectAudioFormat(sourceUrl);
    console.log(`[音频下载] 检测到音频格式: ${format}, URL: ${sourceUrl}`);
    
    // 根据格式确定临时文件扩展名
    const originalExt = format === 'mp3' ? '.mp3' : '.m4a';
    const tmpFile = path.join(tmp, `src-${Date.now()}-${Math.random().toString(36).slice(2)}${originalExt}`);
    
    console.log(`开始下载音频: ${sourceUrl} (格式: ${format})`);
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 策略选择：生产环境优先使用代理下载（更可靠），开发环境优先直接下载
    const downloadStrategies = [
      {
        name: isProduction ? '代理下载' : '直接下载',
        priority: isProduction ? 1 : 2,
        fetchFn: isProduction 
          ? async () => {
              // 生产环境：优先代理下载
              const base = getServerBaseUrl();
              const proxyUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(sourceUrl)}`;
              console.log(`尝试代理下载: ${proxyUrl}`);
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时
              
              const res = await fetch(proxyUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
              });
              
              clearTimeout(timeoutId);
              return res;
            }
          : async () => {
              // 开发环境：优先直接下载
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时
              
              const res = await fetch(sourceUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Referer': new URL(sourceUrl).origin,
                  'Origin': new URL(sourceUrl).origin,
                }
              });
              
              clearTimeout(timeoutId);
              return res;
            }
      },
      {
        name: isProduction ? '直接下载' : '代理下载',
        priority: isProduction ? 2 : 1,
        fetchFn: isProduction
          ? async () => {
              // 生产环境：备用直接下载
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时
              
              const res = await fetch(sourceUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Referer': new URL(sourceUrl).origin,
                  'Origin': new URL(sourceUrl).origin,
                }
              });
              
              clearTimeout(timeoutId);
              return res;
            }
          : async () => {
              // 开发环境：备用代理下载
              const base = getServerBaseUrl();
              const proxyUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(sourceUrl)}`;
              console.log(`尝试代理下载: ${proxyUrl}`);
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时
              
              const res = await fetch(proxyUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
              });
              
              clearTimeout(timeoutId);
              return res;
            }
      }
    ];
    
    // 按优先级排序
    downloadStrategies.sort((a, b) => a.priority - b.priority);
    
    // 对每种策略，最多重试3次
    let lastError: any = null;
    
    for (const strategy of downloadStrategies) {
      console.log(`[${isProduction ? '生产' : '开发'}环境] 尝试${strategy.name}...`);
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`${strategy.name}尝试 ${attempt}/3: ${sourceUrl}`);
          
          const res = await strategy.fetchFn();
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            const errorMsg = `音频下载失败: HTTP ${res.status} ${errorText.substring(0, 200)}`;
            console.error(`${strategy.name}失败 (尝试 ${attempt}/3):`, errorMsg);
            
            if (attempt < 3 && res.status >= 500) {
              // 服务器错误，重试
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
            throw new Error(errorMsg);
          }
          
          if (!res.body) {
            throw new Error('音频下载失败: 响应体为空');
          }
          
          const fileStream = fs.createWriteStream(tmpFile);
          await pipeline(res.body as any, fileStream);
          
          // 验证文件是否下载成功
          const stat = await fs.promises.stat(tmpFile).catch(() => null);
          if (!stat || stat.size === 0) {
            throw new Error('下载的文件大小为0');
          }
          
          console.log(`音频下载完成 (${strategy.name}): ${tmpFile} (${stat.size} 字节)`);
          
          // 如果是MP3格式，必须转换为M4A（因为后续处理需要M4A格式）
          if (format === 'mp3') {
            console.log(`[音频转换] 检测到MP3格式，开始转换为M4A...`);
            console.log(`[音频转换] 输入文件: ${tmpFile}, 大小: ${stat.size} 字节`);
            
            try {
              const convertedFile = await convertMp3ToM4a(tmpFile);
              
              // 验证转换后的文件
              const convertedStats = await fs.promises.stat(convertedFile).catch(() => null);
              if (!convertedStats || convertedStats.size === 0) {
                throw new Error(`转换后的文件无效: ${convertedFile}`);
              }
              
              console.log(`[音频转换] ✅ MP3已转换为M4A: ${convertedFile}, 大小: ${convertedStats.size} 字节`);
              
              // 删除原始MP3文件
              try {
                await fs.promises.unlink(tmpFile);
                console.log(`[音频转换] 已删除原始MP3文件: ${tmpFile}`);
              } catch (e) {
                console.warn(`[音频转换] 删除原始MP3文件失败: ${e}`);
              }
              
              return convertedFile;
            } catch (convertError) {
              const errorMsg = convertError instanceof Error ? convertError.message : String(convertError);
              console.error(`[音频转换] ❌ MP3转M4A失败:`, errorMsg);
              console.error(`[音频转换] 错误详情:`, convertError);
              
              // 清理可能创建的不完整转换文件
              try {
                const tmp = await ensureTmpDir();
                const files = await fs.promises.readdir(tmp);
                const convertedFiles = files.filter(f => f.includes('converted-') && f.endsWith('.m4a'));
                for (const f of convertedFiles) {
                  try {
                    await fs.promises.unlink(path.join(tmp, f));
                    console.log(`[音频转换] 已清理不完整的转换文件: ${f}`);
                  } catch (e) {
                    // 忽略清理错误
                  }
                }
              } catch (e) {
                // 忽略清理错误
              }
              
              // MP3转M4A失败是致命错误，不能继续使用MP3文件
              throw new Error(`MP3转M4A失败，无法继续处理: ${errorMsg}`);
            }
          }
          
          // 如果已经是M4A或未知格式，直接返回
          return tmpFile;
          
        } catch (error: any) {
          lastError = error;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`${strategy.name}尝试 ${attempt}/3 失败:`, errorMessage);
          
          // 清理临时文件
          if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
          }
          
          // 如果是网络错误且还有重试机会，等待后重试
          if (attempt < 3 && (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('CORS'))) {
            const delay = 2000 * attempt; // 递增延迟：2s, 4s
            console.log(`等待 ${delay}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // 最后一次尝试失败，尝试下一种策略
          if (attempt === 3) {
            console.warn(`${strategy.name}所有重试均失败，尝试下一种下载策略`);
            break; // 跳出内层循环，尝试下一种策略
          }
        }
      }
    }
    
    // 所有策略都失败
    throw new Error(`音频下载失败: 所有下载策略均失败 - ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
  
  async function getDurationSeconds(localFile: string): Promise<number> {
    try {
      const { stdout } = await exec(
        `${getFfprobePath()} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localFile}"`,
        { timeout: 20000 }
      );
      const val = parseFloat((stdout || "").trim());
      if (Number.isFinite(val) && val > 0) return Math.floor(val);
    } catch (e) {
      console.warn("获取音频时长失败，使用估算值:", e);
    }
    // 如果获取失败，尝试从URL获取或使用默认值
    return 2640; // 默认44分钟
  }
  
  async function cutOne(localFile: string, start: number, duration: number): Promise<Buffer> {
    const tmp = await ensureTmpDir();
    const outFile = path.join(tmp, `seg-${start}-${duration}-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`);
    
    // 检查输入文件是否存在且有效
    const inputStat = await fs.promises.stat(localFile).catch(() => null);
    if (!inputStat || inputStat.size === 0) {
      throw new Error(`输入音频文件无效或为空: ${localFile}`);
    }
    
    // 使用warning级别而不是error，这样可以看到更多信息，但不会太冗长
    const cmd = `"${getFfmpegPath()}" -ss ${start} -t ${duration} -i "${localFile}" -vn -acodec aac -b:a 128k -movflags +faststart -hide_banner -loglevel warning -y "${outFile}"`;
    
    try {
      const { stdout, stderr } = await exec(cmd, { timeout: 120000 });
      
      // 如果FFmpeg有警告或错误输出，记录它（可能包含重要信息）
      if (stderr && stderr.trim()) {
        // 过滤掉常见的非关键警告
        const importantWarnings = stderr.split('\n').filter((line: string) => {
          const lower = line.toLowerCase();
          return !lower.includes('deprecated') && 
                 !lower.includes('experimental') &&
                 !lower.includes('non-monotonous') &&
                 line.trim().length > 0;
        });
        if (importantWarnings.length > 0) {
          console.warn(`⚠️ FFmpeg警告 (片段 ${start}-${start + duration}秒):`, importantWarnings.join('; '));
        }
      }
      
      // 检查输出文件是否存在且有效
      const stat = await fs.promises.stat(outFile).catch(() => null);
      if (!stat) {
        throw new Error(`切割后的音频文件不存在: ${start}-${start + duration}秒`);
      }
      if (stat.size === 0) {
        throw new Error(`切割后的音频文件为空: ${start}-${start + duration}秒 (${stat.size} 字节)`);
      }
      
      // 验证文件头（M4A文件应该以 'ftyp' 开头，通常在偏移4字节处）
      const buf = await fs.promises.readFile(outFile);
      if (buf.length < 8) {
        throw new Error(`切割后的音频文件过小: ${start}-${start + duration}秒 (${buf.length} 字节)`);
      }
      
      // 检查是否是有效的M4A文件（ftyp box通常在偏移4字节处）
      const ftypIndex = buf.indexOf('ftyp', 4);
      if (ftypIndex === -1 || ftypIndex > 20) {
        // 不是严格的M4A格式，但可能仍然有效（某些编码器可能不同）
        console.warn(`⚠️ 片段 ${start}-${start + duration}秒 可能不是标准M4A格式，但继续处理 (大小: ${buf.length} 字节)`);
      }
      
      fs.promises.unlink(outFile).catch(() => {});
      return buf;
    } catch (error: any) {
      fs.promises.unlink(outFile).catch(() => {});
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      const errorSignal = (error as any)?.signal;
      const errorStderr = (error as any)?.stderr;
      const errorStdout = (error as any)?.stdout;
      
      // 记录完整的错误信息（用于调试）
      console.error(`═══════════════════════════════════════════════════════════`);
      console.error(`❌ 音频切割失败 (${start}-${start + duration}秒)`);
      console.error(`   输入文件: ${localFile}`);
      console.error(`   输出文件: ${outFile}`);
      console.error(`   命令: ${cmd}`);
      console.error(`   错误消息: ${errorMessage}`);
      if (errorCode) {
        console.error(`   错误代码: ${errorCode}`);
      }
      if (errorSignal) {
        console.error(`   信号: ${errorSignal}`);
      }
      if (errorStderr) {
        console.error(`   FFmpeg stderr:`, errorStderr);
      }
      if (errorStdout) {
        console.error(`   FFmpeg stdout:`, errorStdout);
      }
      console.error(`═══════════════════════════════════════════════════════════`);
      
      // 提供更详细的错误信息
      let detailedError = `音频切割失败 (${start}-${start + duration}秒): ${errorMessage}`;
      if (errorCode) {
        detailedError += ` (错误代码: ${errorCode})`;
      }
      if (errorSignal) {
        detailedError += ` (信号: ${errorSignal})`;
      }
      
      // 记录FFmpeg的详细错误输出
      if (errorStderr) {
        const stderrLines = errorStderr.split('\n').filter((line: string) => line.trim().length > 0);
        if (stderrLines.length > 0) {
          console.error(`   FFmpeg错误输出:`, stderrLines.join('; '));
          detailedError += ` (FFmpeg: ${stderrLines.slice(0, 3).join('; ')})`;
        }
      }
      
      // 检查是否是输入文件的问题
      if (errorMessage.includes('No such file') || errorMessage.includes('Invalid data')) {
        console.error(`   ⚠️ 可能是输入音频文件有问题: ${localFile}`);
      }
      
      // 检查是否是 ffmpeg 未找到
      if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT') || errorCode === 'ENOENT') {
        console.error(`   ⚠️ FFmpeg 未找到，请检查 FFMPEG_PATH 环境变量或安装 ffmpeg`);
        detailedError += ` (FFmpeg未找到，请检查安装和路径配置)`;
      }
      
      throw new Error(detailedError);
    }
  }
  
  // Step 1: 下载音频
  let localFile = "";
  try {
    console.log(`[ASR分段] 开始下载音频: ${audioUrl}`);
    const format = detectAudioFormat(audioUrl);
    console.log(`[ASR分段] 检测到音频格式: ${format}`);
    
    localFile = await downloadWholeToTemp(audioUrl);
    
    // 验证下载后的文件
    const fileStats = await fs.promises.stat(localFile).catch(() => null);
    if (!fileStats) {
      throw new Error(`下载后的文件不存在: ${localFile}`);
    }
    console.log(`[ASR分段] 音频下载完成: ${localFile}, 大小: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB`);
    
    // 验证文件格式（检查扩展名）
    const fileExt = path.extname(localFile).toLowerCase();
    if (fileExt !== '.m4a') {
      console.warn(`[ASR分段] ⚠️ 警告: 下载后的文件扩展名不是.m4a: ${fileExt}`);
    } else {
      console.log(`[ASR分段] ✅ 文件格式验证通过: ${fileExt}`);
    }
  } catch (e: any) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[ASR分段] ❌ 音频下载/转换失败 (${audioUrl}):`, errorMsg);
    // 保留完整的错误信息，包括堆栈
    const fullError = e instanceof Error ? `${errorMsg}\n${e.stack || ''}` : errorMsg;
    throw new Error(`音频下载/转换失败: ${fullError}`);
  }
  
  // Step 2: 获取时长并规划分段
  const duration = await getDurationSeconds(localFile);
  const count = Math.ceil(duration / segmentDuration);
  console.log(`音频时长: ${duration}秒，将切割成 ${count} 个${segmentDuration}秒片段`);
  
  const segments = Array.from({ length: count }).map((_, i) => {
    const start = i * segmentDuration;
    const end = Math.min((i + 1) * segmentDuration, duration);
    return { index: i, start, end, len: end - start };
  });
  
  // Step 3: 切割并上传到OSS
  const uploaded: { index: number; url: string }[] = [];
  // 并发数：下调到3，降低网络抖动或服务端限流导致的失败概率
  const maxConcurrent = 3;
  
  async function runPool<T>(items: any[], worker: (it: any) => Promise<T>, n: number): Promise<T[]> {
    const ret: T[] = new Array(items.length) as any;
    let p = 0;
    const running: Promise<void>[] = [];
    async function next() {
      const i = p++;
      if (i >= items.length) return;
      ret[i] = await worker(items[i]);
      return next();
    }
    for (let i = 0; i < Math.min(n, items.length); i++) running.push(next() as any);
    await Promise.all(running);
    return ret;
  }
  
  try {
    // 为每个分段添加超时保护，防止单个分段卡住整个流程
    const SEGMENT_TIMEOUT = 5 * 60 * 1000; // 每个分段最多5分钟（包括切分和上传）
    
    const results = await runPool(segments, async (s) => {
      // 使用Promise.race添加超时保护
      const segmentPromise = (async () => {
        try {
          console.log(`切割片段 ${s.index + 1}/${count}: ${s.start}-${s.end}秒`);
          const buf = await cutOne(localFile, s.start, s.len);
          
          // 验证切分后的Buffer
          if (!buf || buf.length === 0) {
            const errorMsg = `切分后的片段为空: ${s.start}-${s.end}秒`;
            console.error(`❌ ${errorMsg}`);
            return null;
          }
          
          console.log(`片段 ${s.index + 1}/${count} 切分成功，大小: ${buf.length} 字节`);
          
          const key = `temp/asr-${s.start}-${s.end}-${Date.now()}.m4a`;
          console.log(`[ASR分段] 准备上传片段 ${s.index + 1}/${count} 到OSS: ${key} (${buf.length} 字节)`);
          
          // 在上传前检查环境变量（用于调试）
          const envCheck = {
            hasAccessKeyId: !!process.env.ALIYUN_ACCESS_KEY_ID,
            hasAccessKeySecret: !!process.env.ALIYUN_ACCESS_KEY_SECRET,
            hasRegion: !!process.env.ALIYUN_OSS_REGION,
            hasBucket: !!process.env.ALIYUN_OSS_BUCKET,
            region: process.env.ALIYUN_OSS_REGION,
            bucket: process.env.ALIYUN_OSS_BUCKET,
          };
          console.log(`[ASR分段] 环境变量检查:`, envCheck);
          
          const url = await uploadToOssAndGetPublicUrl(key, buf, "audio/mp4");
          if (!url) {
            const errorMsg = `OSS上传失败，跳过分段 ${s.start}-${s.end}秒（片段大小: ${buf.length} 字节，请检查OSS配置和网络连接）`;
            console.error(`❌ [ASR分段] ${errorMsg}`);
            console.error(`   [ASR分段] 片段索引: ${s.index + 1}/${count}`);
            console.error(`   [ASR分段] 片段时间范围: ${s.start}-${s.end}秒`);
            console.error(`   [ASR分段] OSS路径: ${key}`);
            console.error(`   [ASR分段] OSS环境变量检查:`, envCheck);
            console.error(`   [ASR分段] 请查看 uploadToOssAndGetPublicUrl 函数的详细错误日志`);
            return null;
          }
          console.log(`✅ 片段 ${s.index + 1}/${count} 上传成功: ${url} (${buf.length} 字节)`);
          return { index: s.index, url };
        } catch (error: any) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(`❌ 分段处理失败 ${s.start}-${s.end}秒:`, errorMsg);
          if (errorStack) {
            console.error(`   错误堆栈: ${errorStack.substring(0, 500)}`);
          }
          // 如果是切分失败，记录更详细的信息
          if (errorMsg.includes('切割') || errorMsg.includes('cut')) {
            console.error(`   这可能是音频文件本身的问题，请检查原始音频文件是否完整`);
          }
          return null;
        }
      })();
      
      // 超时保护
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.error(`⏱️ 分段 ${s.index + 1}/${count} (${s.start}-${s.end}秒) 处理超时（超过${SEGMENT_TIMEOUT / 1000}秒），跳过`);
          resolve(null);
        }, SEGMENT_TIMEOUT);
      });
      
      // 使用Promise.race，如果超时就返回null，继续处理其他分段
      return await Promise.race([segmentPromise, timeoutPromise]);
    }, maxConcurrent);
    
    const validResults = results.filter((r): r is { index: number; url: string } => r !== null);
    uploaded.push(...validResults);
    const failedCount = count - uploaded.length;
    console.log(`成功上传 ${uploaded.length}/${count} 个片段到OSS`);
    
    // 如果所有片段都上传失败，抛出详细错误
    if (uploaded.length === 0) {
      const errorMsg = `所有 ${count} 个音频分段OSS上传均失败，请检查OSS配置和网络连接。可能原因：1) OSS配置错误 2) 网络连接问题 3) OSS权限问题 4) 音频文件格式问题`;
      console.error(`❌ ${errorMsg}`);
      console.error(`   建议：检查开发服务器日志中的详细OSS错误信息`);
      console.error(`   环境变量检查:`, {
        hasAccessKeyId: !!process.env.ALIYUN_ACCESS_KEY_ID,
        hasAccessKeySecret: !!process.env.ALIYUN_ACCESS_KEY_SECRET,
        hasRegion: !!process.env.ALIYUN_OSS_REGION,
        hasBucket: !!process.env.ALIYUN_OSS_BUCKET,
        region: process.env.ALIYUN_OSS_REGION,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      });
      throw new Error(errorMsg);
    }
    
    // 如果大部分分段失败，给出警告但继续处理
    if (failedCount > count * 0.5) {
      console.warn(`⚠️ 警告：${failedCount}/${count} 个分段上传失败（超过50%），但将继续处理已上传的 ${uploaded.length} 个分段`);
    } else if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount}/${count} 个分段上传失败，但将继续处理已上传的 ${uploaded.length} 个分段`);
    }
  } catch (e: any) {
    fs.promises.unlink(localFile).catch(() => {});
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`分段上传失败:`, errorMsg);
    throw new Error(`分段上传失败: ${errorMsg}`);
  }
  
  // 清理本地文件
  fs.promises.unlink(localFile).catch(() => {});
  
  // Step 4: 并发转写每个片段
  let results: Array<{ index: number; text: string; language?: string; error?: string }>;
  try {
    console.log(`开始并发转写 ${uploaded.length} 个音频片段...`);
    // 为每个ASR分段转写添加超时保护，防止单个分段卡住整个流程
    // 每个分段最多15分钟（包括轮询时间），如果超时就跳过该分段
    const ASR_SEGMENT_TIMEOUT = 15 * 60 * 1000; // 15分钟超时
    
    results = await runPool(uploaded, async (it) => {
      console.log(`转写片段 ${it.index + 1}/${uploaded.length}: ${it.url}`);
      
      // 包装 ASR 调用，添加超时保护
      const asrCallWithTimeout = async (): Promise<{ index: number; text: string; language?: string }> => {
        let lastError: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const r = await qwenTranscribeFromUrl(it.url, language === "auto" ? undefined : language);
            
            if (!r.text || r.text.trim().length === 0) {
              throw new Error(`转写结果为空 (尝试 ${attempt}/3)`);
            }
            
            console.log(`片段 ${it.index + 1}/${uploaded.length} 转写成功 (尝试 ${attempt}/3), 语言: ${r.language || '未检测'}`);
            return { index: it.index, text: r.text.trim(), language: r.language };
          } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || String(error);
            console.warn(`片段 ${it.index + 1}/${uploaded.length} 转写失败 (尝试 ${attempt}/3):`, errorMsg);
            
            // 检查是否是URL访问问题
            if (errorMsg.includes('url error') || errorMsg.includes('URL') || errorMsg.includes('403') || errorMsg.includes('404')) {
              console.error(`⚠️ 片段 ${it.index + 1} URL访问问题: ${it.url}`);
              console.error(`   错误详情: ${errorMsg}`);
            }
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        const finalErrorMsg = lastError?.message || String(lastError) || '未知错误';
        throw new Error(finalErrorMsg);
      };
      
      // 超时保护 Promise
      const timeoutPromise = new Promise<{ index: number; text: string; language?: string; error: string }>((resolve) => {
        setTimeout(() => {
          const timeoutMsg = `ASR转写超时（超过${ASR_SEGMENT_TIMEOUT / 1000 / 60}分钟）`;
          console.error(`⏱️ 片段 ${it.index + 1}/${uploaded.length} ${timeoutMsg}`);
          resolve({ index: it.index, text: "", error: timeoutMsg });
        }, ASR_SEGMENT_TIMEOUT);
      });
      
      // 使用 Promise.race，如果超时就返回错误，继续处理其他分段
      try {
        return await Promise.race([asrCallWithTimeout(), timeoutPromise]);
      } catch (error: any) {
        const errorMsg = error?.message || String(error) || '未知错误';
        console.warn(`片段 ${it.index + 1}/${uploaded.length} 转写最终失败，返回空文本。错误: ${errorMsg}`);
        return { index: it.index, text: "", error: errorMsg };
      }
    }, maxConcurrent);
  } catch (e: any) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`ASR转写失败:`, errorMsg);
    throw new Error(`ASR转写失败: ${errorMsg}`);
  }
  
  // Step 5: 合并结果
  const nonEmpty = results.filter((r) => r && r.text && r.text.trim().length > 0);
  if (nonEmpty.length === 0) {
    // 收集所有失败的原因，提供更详细的错误信息
    const failedCount = results.filter((r) => !r || !r.text || r.text.trim().length === 0).length;
    const totalCount = results.length;
    const errors = results
      .filter((r) => r && r.error)
      .map((r, idx) => `片段${idx + 1}: ${r.error}`)
      .slice(0, 5); // 只显示前5个错误，避免日志过长
    
    console.error(`ASR失败详情: 总共${totalCount}个分段，全部失败（${failedCount}个）`);
    if (errors.length > 0) {
      console.error(`前${Math.min(5, errors.length)}个分段的错误信息:`);
      errors.forEach(err => console.error(`  - ${err}`));
    }
    console.error(`可能原因：1) OSS URL无法访问 2) 音频文件格式问题 3) ASR API调用失败 4) 音频文件为空或损坏`);
    throw new Error(`ASR失败: 所有分段均无有效文本（${totalCount}个分段全部失败，请检查OSS URL可访问性和音频文件格式）`);
  }
  
  console.log(`成功转写 ${nonEmpty.length}/${uploaded.length} 个片段`);
  
  // 按索引排序并提取文本
  const asrSegments = nonEmpty
    .sort((a, b) => a.index - b.index)
    .map(r => r.text.trim());
  
  // 拼接完整文本
  const merged = asrSegments.join("\n\n");
  
  // 从第一个成功的片段获取语言信息（所有片段应该是同一种语言）
  const detectedLanguage = nonEmpty.find(r => r.language)?.language;
  if (detectedLanguage) {
    console.log(`ASR检测到语言: ${detectedLanguage}`);
  } else {
    console.warn(`ASR未返回语言信息，使用默认值: ${language}`);
  }
  
  console.log(`ASR转写完成: ${asrSegments.length} 个片段，总字符数 ${merged.length}`);
  
  return {
    transcript: merged,
    segments: asrSegments,
    duration: duration,
    language: detectedLanguage || (language !== "auto" ? language : undefined)
  };
}

