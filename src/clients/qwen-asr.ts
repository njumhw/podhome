import { getEnv } from "@/utils/env";

export type QwenAsrResp = {
  text: string;
  language?: string;
  segments?: Array<{ text: string; startTime?: number; endTime?: number }>; // 新增：分段信息
};

function collectTextsDeep(input: any, acc: string[] = []): string[] {
  if (!input) return acc;
  if (typeof input === "string") return acc;
  if (Array.isArray(input)) {
    for (const it of input) collectTextsDeep(it, acc);
    return acc;
  }
  if (typeof input === "object") {
    for (const [k, v] of Object.entries(input)) {
      if ((k === "text" || k === "transcript") && typeof v === "string" && v.trim()) {
        acc.push(v.trim());
      } else {
        collectTextsDeep(v, acc);
      }
    }
  }
  return acc;
}

// Calls DashScope compatible transcription API. Expects an audio URL.
export async function qwenTranscribeFromUrl(audioUrl: string, language?: string): Promise<QwenAsrResp> {
  console.log("qwenTranscribeFromUrl called with URL:", audioUrl);
  
  // Check audio file size first
  try {
    const headRes = await fetch(audioUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10秒超时
    });
    if (!headRes.ok) {
      console.warn(`Audio file HEAD request failed: HTTP ${headRes.status}`);
    } else {
      const contentLength = headRes.headers.get('content-length');
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        console.log(`Audio file size: ${sizeMB.toFixed(2)} MB`);
        if (sizeMB > 200) {
          console.warn(`Large audio file detected (${sizeMB.toFixed(2)} MB), ASR may take longer or fail`);
        }
        if (sizeMB > 500) {
          console.error(`Very large audio file detected (${sizeMB.toFixed(2)} MB), ASR may fail or return incomplete results`);
        }
        if (sizeMB > 1000) {
          console.error(`Extremely large audio file detected (${sizeMB.toFixed(2)} MB), ASR will likely fail or return corrupted results`);
        }
      }
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    // 如果是网络错误，不要阻止ASR处理，只记录警告
    if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
      console.warn("无法检查音频文件大小（可能是网络问题），继续ASR处理:", errorMsg);
    } else {
      console.warn("检查音频文件大小失败:", errorMsg);
    }
  }
  
  const env = getEnv();
  const apiKey = (env.QWEN_API_KEY as string) || ""; // user provided
  if (!apiKey) throw new Error("Missing QWEN_API_KEY in env");

  // DashScope ASR HTTP API with async header
  // 支持通过环境变量 QWEN_ASR_MODEL 选择模型，默认为 fun-asr
  const asrModel = process.env.QWEN_ASR_MODEL || "fun-asr";
  const submitEndpoint = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
  const payload: any = {
    model: asrModel,
    input: {
      file_urls: [audioUrl],
    },
    parameters: {
      timeout: 3600, // 1小时超时
    },
  };
  if (language && language !== "auto") {
    payload.parameters.language = language;
  }

  // Step 1: Submit async task
  let submitRes: Response;
  try {
    submitRes = await fetch(submitEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30秒超时
    });
  } catch (fetchError) {
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
      throw new Error(`ASR任务提交超时: ${errorMsg}`);
    }
    throw new Error(`ASR任务提交失败 (网络错误): ${errorMsg}`);
  }

  const submitText = await submitRes.text();
  let submitData: any = {};
  try { submitData = JSON.parse(submitText); } catch {}
  if (!submitRes.ok) {
    console.error("Qwen ASR submit error:", { endpoint: submitEndpoint, status: submitRes.status, body: submitText });
    throw new Error(submitData?.error?.message || submitData?.message || submitText || `ASR submit failed(${submitRes.status})`);
  }

  const taskId = submitData?.output?.task_id || submitData?.task_id;
  if (!taskId) {
    throw new Error("No task_id returned from ASR submit");
  }

  console.log("ASR task submitted, task_id:", taskId);

  // Step 2: Poll for results
  const maxAttempts = 1800; // 1800 attempts * 2s = 3600s max wait (1小时超时，支持超大音频)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between polls

    // Prefer generic task polling endpoint
    let statusRes: Response;
    try {
      statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(15000) // 15秒超时
      });
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      // 轮询时的网络错误，记录警告但不立即失败，继续重试
      console.warn(`ASR状态查询失败 (尝试 ${attempt}):`, errorMsg);
      continue; // 继续下一次轮询
    }

    const statusText = await statusRes.text();
    let statusData: any = {};
    try { statusData = JSON.parse(statusText); } catch {}
    
    if (!statusRes.ok) {
      console.error("Qwen ASR status error:", { taskId, status: statusRes.status, body: statusText });
      throw new Error(statusData?.error?.message || statusData?.message || `ASR status check failed(${statusRes.status})`);
    }

    const taskStatus = statusData?.output?.task_status || statusData?.task_status;
    console.log(`ASR task ${taskId} attempt ${attempt}: status = ${taskStatus}`);

    if (taskStatus === "SUCCEEDED") {
      // Try multiple shapes the service might return
      const out = statusData?.output ?? statusData;
      const candidates: string[] = [];
      const push = (v: any) => { if (typeof v === "string" && v.trim()) candidates.push(v.trim()); };

      // Common shapes
      push(out?.text);
      push(out?.result?.text);

      // Arrays of { text } - 保留分段信息
      let segmentsArray: Array<{ text: string; startTime?: number; endTime?: number }> | undefined = undefined;
      const arrs = [out?.results, out?.result?.results, out?.transcriptions, out?.segments, out?.sentences, out?.data?.result?.transcripts];
      for (const a of arrs) {
        if (Array.isArray(a) && a.length > 0) {
          const s = a.map((x: any) => (x?.text || x?.transcript || "")).join(" ").trim();
          if (s) candidates.push(s);
          
          // 如果这是segments数组，保留分段信息（优先使用out?.segments）
          if (a === out?.segments || (!segmentsArray && Array.isArray(out?.segments))) {
            segmentsArray = out.segments.map((x: any) => ({
              text: x?.text || x?.transcript || "",
              startTime: x?.startTime || x?.start || undefined,
              endTime: x?.endTime || x?.end || undefined
            })).filter((x: { text: string }) => x.text.trim());
          } else if (!segmentsArray && (a === out?.results || a === out?.result?.results)) {
            // 如果results数组包含分段信息，也使用
            segmentsArray = a.map((x: any) => ({
              text: x?.text || x?.transcript || "",
              startTime: x?.startTime || x?.start || undefined,
              endTime: x?.endTime || x?.end || undefined
            })).filter(x => x.text.trim());
          }
        }
      }

      // If service only returns a transcription_url, fetch it
      if (Array.isArray(out?.results)) {
        const urls = out.results.map((r: any) => r?.transcription_url).filter(Boolean);
        if (urls.length > 0) {
          try {
            const texts: string[] = [];
            for (const u of urls) {
              const r = await fetch(u);
              const raw = await r.text();
              let j: any = {};
              try { j = JSON.parse(raw); } catch {}
              console.log("Fetched transcription json snippet:", raw.slice(0, 1000));
              // Try typical fields inside result JSON
              const innerArrs = [j?.results, j?.segments, j?.sentences, j?.transcriptions, j?.data?.result?.transcripts];
              let innerCollected = "";
              for (const ia of innerArrs) {
                if (Array.isArray(ia)) {
                  const s = ia.map((x: any) => (x?.text || x?.transcript || "")).join(" ").trim();
                  if (s) { innerCollected = s; break; }
                }
              }
              if (!innerCollected) {
                push(j?.text);
                push(j?.result?.text);
                const deep = collectTextsDeep(j, []);
                innerCollected = (deep && deep.length ? deep.join(" ").trim() : "");
              }
              if (innerCollected) texts.push(innerCollected);
            }
            const joined = texts.join(" ").trim();
            if (joined) candidates.unshift(joined);
          } catch (e) {
            console.warn("Failed to fetch transcription_url:", e);
          }
        }
      }

      // Fallback join of any nested text fields
      let text = candidates.find(Boolean) || "";
      const languageDetected = out?.language || statusData?.language;

      if (!text) {
        console.warn("Qwen ASR SUCCEEDED but empty text. Raw output:", JSON.stringify(out).slice(0, 2000));
      }
      
      // 如果有分段信息，记录日志
      if (segmentsArray && segmentsArray.length > 1) {
        console.log(`DashScope ASR返回了 ${segmentsArray.length} 个分段`);
      }
      
      return { text, language: languageDetected, segments: segmentsArray };
    } else if (taskStatus === "FAILED") {
      throw new Error(`ASR task failed: ${statusData?.output?.message || statusData?.message || "Unknown error"}`);
    } else if (taskStatus === "RUNNING" || taskStatus === "PENDING") {
      continue; // Keep polling
    } else {
      throw new Error(`Unknown ASR task status: ${taskStatus}`);
    }
  }

  throw new Error("ASR task timeout - exceeded maximum polling attempts");
}


