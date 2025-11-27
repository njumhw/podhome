/**
 * 音频格式转换工具
 * 支持将MP3等格式转换为M4A格式
 */

import { exec as execCb } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream/promises";

const exec = promisify(execCb);

/**
 * 检测音频URL的格式
 * @param audioUrl 音频URL
 * @returns 音频格式（'mp3' | 'm4a' | 'unknown'）
 */
export function detectAudioFormat(audioUrl: string): 'mp3' | 'm4a' | 'unknown' {
  // 从URL扩展名检测
  const urlLower = audioUrl.toLowerCase();
  if (urlLower.includes('.mp3') || urlLower.endsWith('.mp3')) {
    return 'mp3';
  }
  if (urlLower.includes('.m4a') || urlLower.endsWith('.m4a')) {
    return 'm4a';
  }
  
  // 从URL路径中提取扩展名
  try {
    const urlObj = new URL(audioUrl);
    const pathname = urlObj.pathname.toLowerCase();
    if (pathname.endsWith('.mp3')) return 'mp3';
    if (pathname.endsWith('.m4a')) return 'm4a';
  } catch (e) {
    // URL解析失败，继续
  }
  
  return 'unknown';
}

/**
 * 获取FFmpeg路径
 */
function getFfmpegPath(): string {
  const p = process.env.FFMPEG_PATH;
  if (p && p.trim()) return p.trim();
  return "ffmpeg";
}

/**
 * 确保临时目录存在
 */
async function ensureTmpDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), "podroom");
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
  return dir;
}

/**
 * 将MP3文件转换为M4A格式
 * @param inputFile 输入的MP3文件路径
 * @param outputFile 输出的M4A文件路径（可选，如果不提供则自动生成）
 * @returns 转换后的M4A文件路径
 */
export async function convertMp3ToM4a(
  inputFile: string,
  outputFile?: string
): Promise<string> {
  if (!outputFile) {
    const tmp = await ensureTmpDir();
    outputFile = path.join(
      tmp,
      `converted-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`
    );
  }

  const ffmpegPath = getFfmpegPath();
  
  // FFmpeg转换命令：将MP3转换为M4A（AAC编码）
  // -i: 输入文件
  // -vn: 禁用视频（只处理音频）
  // -acodec aac: 使用AAC编码
  // -b:a 128k: 音频比特率128kbps
  // -ar 44100: 采样率44.1kHz（标准音频采样率）
  // -ac 2: 立体声（2声道）
  // -movflags +faststart: 优化流媒体播放
  // -hide_banner: 隐藏FFmpeg横幅
  // -loglevel warning: 使用warning级别以便看到重要信息
  // -y: 覆盖输出文件
  const cmd = `"${ffmpegPath}" -i "${inputFile}" -vn -acodec aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart -hide_banner -loglevel warning -y "${outputFile}"`;
  
  console.log(`[音频转换] 开始转换MP3到M4A: ${inputFile} -> ${outputFile}`);
  const startTime = Date.now();
  
  try {
    // 首先验证输入文件是否存在且有效
    const inputStats = await fs.promises.stat(inputFile).catch(() => null);
    if (!inputStats) {
      throw new Error(`输入文件不存在: ${inputFile}`);
    }
    if (inputStats.size === 0) {
      throw new Error(`输入文件大小为0: ${inputFile}`);
    }
    console.log(`[音频转换] 输入文件大小: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB`);
    
    // 验证输入文件是否真的是音频文件（检查文件头）
    try {
      const fileBuffer = await fs.promises.readFile(inputFile);
      const fileHeader = fileBuffer.slice(0, 12);
      const headerHex = fileHeader.toString('hex');
      // MP3文件通常以ID3标签开头（"ID3"）或直接以帧同步字开头（FF FB或FF F3）
      const isMp3 = headerHex.startsWith('494433') || // "ID3"
                     headerHex.startsWith('fffb') || // MPEG-1 Layer 3
                     headerHex.startsWith('fff3'); // MPEG-1 Layer 3 (alternate)
      if (!isMp3) {
        console.warn(`[音频转换] ⚠️ 输入文件可能不是有效的MP3文件，文件头: ${headerHex.substring(0, 16)}`);
      } else {
        console.log(`[音频转换] ✅ 输入文件验证通过，确认为MP3格式`);
      }
    } catch (e) {
      console.warn(`[音频转换] ⚠️ 无法验证输入文件格式: ${e}`);
    }
    
    // 执行FFmpeg转换
    const { stdout, stderr } = await exec(cmd, { timeout: 300000 }); // 5分钟超时
    
    // 如果FFmpeg有警告输出，记录它
    if (stderr && stderr.trim()) {
      const stderrLines = stderr.split('\n').filter(line => line.trim().length > 0);
      if (stderrLines.length > 0) {
        console.warn(`[音频转换] FFmpeg警告:`, stderrLines.slice(0, 5).join('; '));
      }
    }
    
    // 验证输出文件是否存在且大小合理
    const stats = await fs.promises.stat(outputFile).catch(() => null);
    if (!stats) {
      throw new Error(`输出文件未创建: ${outputFile}`);
    }
    if (stats.size === 0) {
      throw new Error('转换后的文件大小为0');
    }
    
    // 验证输出文件大小是否合理（应该至少是输入文件的50%）
    if (stats.size < inputStats.size * 0.3) {
      console.warn(`[音频转换] ⚠️ 输出文件大小异常小: ${(stats.size / 1024 / 1024).toFixed(2)}MB (输入: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[音频转换] ✅ 转换成功，耗时: ${duration}秒，输出文件大小: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    
    return outputFile;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;
    const errorSignal = (error as any)?.signal;
    const errorStderr = (error as any)?.stderr;
    
    // 构建详细的错误信息
    let detailedError = `MP3转M4A失败: ${errorMsg}`;
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
        console.error(`[音频转换] FFmpeg错误输出:`, stderrLines.join('; '));
        detailedError += ` (FFmpeg: ${stderrLines.slice(0, 5).join('; ')})`;
      }
    }
    
    console.error(`[音频转换] ❌ 转换失败: ${detailedError}`);
    console.error(`[音频转换] 输入文件: ${inputFile}`);
    console.error(`[音频转换] 输出文件: ${outputFile}`);
    console.error(`[音频转换] FFmpeg路径: ${getFfmpegPath()}`);
    
    // 清理可能创建的不完整文件
    try {
      if (await fs.promises.access(outputFile).then(() => true).catch(() => false)) {
        await fs.promises.unlink(outputFile);
        console.log(`[音频转换] 已清理不完整的输出文件: ${outputFile}`);
      }
    } catch (e) {
      // 忽略清理错误
    }
    
    throw new Error(detailedError);
  }
}

/**
 * 下载音频文件并自动转换为M4A（如果需要）
 * @param audioUrl 音频URL
 * @param targetFormat 目标格式（'m4a' | 'original'），默认为'm4a'
 * @returns 本地文件路径（M4A格式）
 */
export async function downloadAndConvertToM4a(
  audioUrl: string,
  targetFormat: 'm4a' | 'original' = 'm4a'
): Promise<string> {
  const format = detectAudioFormat(audioUrl);
  const tmp = await ensureTmpDir();
  
  // 下载原始文件
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const proxyUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(audioUrl)}`;
  
  console.log(`[音频下载] 开始下载音频: ${audioUrl} (格式: ${format})`);
  
  const res = await fetch(proxyUrl);
  if (!res.ok || !res.body) {
    throw new Error(`音频下载失败(${res.status})`);
  }
  
  // 根据原始格式确定临时文件扩展名
  const originalExt = format === 'mp3' ? '.mp3' : '.m4a';
  const tempFile = path.join(
    tmp,
    `src-${Date.now()}-${Math.random().toString(36).slice(2)}${originalExt}`
  );
  
  // 下载到临时文件
  const fileStream = fs.createWriteStream(tempFile);
  await pipeline(res.body as any, fileStream);
  
  console.log(`[音频下载] ✅ 下载完成: ${tempFile}`);
  
  // 如果是MP3且需要转换为M4A，进行转换
  if (format === 'mp3' && targetFormat === 'm4a') {
    const convertedFile = await convertMp3ToM4a(tempFile);
    
    // 删除原始MP3文件
    try {
      await fs.promises.unlink(tempFile);
    } catch (e) {
      console.warn(`[音频转换] 删除原始MP3文件失败: ${e}`);
    }
    
    return convertedFile;
  }
  
  // 如果已经是M4A或不需要转换，直接返回
  return tempFile;
}

