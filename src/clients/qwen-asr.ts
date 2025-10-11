import { getEnv } from "@/utils/env";

export type QwenAsrResp = {
  text: string;
  language?: string;
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
  const env = getEnv();
  const apiKey = (env.QWEN_API_KEY as string) || ""; // user provided
  if (!apiKey) throw new Error("Missing QWEN_API_KEY in env");

  // DashScope fun-asr HTTP API with async header
  const submitEndpoint = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
  const payload: any = {
    model: "fun-asr",
    input: {
      file_urls: [audioUrl],
    },
    parameters: {},
  };
  if (language && language !== "auto") {
    payload.parameters.language = language;
  }

  // Step 1: Submit async task
  const submitRes = await fetch(submitEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(payload),
  });

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
  const maxAttempts = 30; // 30 attempts * 2s = 60s max wait
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between polls

    // Prefer generic task polling endpoint
    const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    });

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

      // Arrays of { text }
      const arrs = [out?.results, out?.result?.results, out?.transcriptions, out?.segments, out?.sentences, out?.data?.result?.transcripts];
      for (const a of arrs) {
        if (Array.isArray(a)) {
          const s = a.map((x: any) => (x?.text || x?.transcript || "")).join(" ").trim();
          if (s) candidates.push(s);
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
      return { text, language: languageDetected };
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


