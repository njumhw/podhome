// import { HeadersInit } from "next/dist/server/web/spec-extension/adapters/headers";

export type XiaoyuzhouEpisodeMeta = {
	audioUrl: string | null;
	title?: string | null;
	podcastTitle?: string | null;
	author?: string | null;
	description?: string | null;
	publishedAt?: string | null; // ISO string if available
};

const DEFAULT_HEADERS: HeadersInit = {
	"user-agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
	"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};

function getMetaContent(html: string, property: string): string | null {
	const re = new RegExp(
		`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
		"i"
	);
	const m = html.match(re);
	return m ? decodeHtml(m[1]) : null;
}

function decodeHtml(s: string): string {
	return s
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function tryParseJsonBlocks(html: string): any[] {
	const blocks: any[] = [];
	// application/ld+json blocks
	const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = ldRe.exec(html))) {
		try {
			blocks.push(JSON.parse(m[1]));
		} catch {}
	}
    // __NEXT_DATA__ legacy inline assignment
    const nextRe = /<script[^>]*>\s*window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i;
    const n = html.match(nextRe);
    if (n) {
        try {
            blocks.push(JSON.parse(n[1]));
        } catch {}
    }
    // __NEXT_DATA__ modern JSON script tag
    const nextJsonRe = /<script[^>]+id=["']__NEXT_DATA__["'][^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;
    const nj = html.match(nextJsonRe);
    if (nj) {
        try {
            blocks.push(JSON.parse(nj[1]));
        } catch {}
    }
	return blocks;
}

function findPodcastSeriesNameFromJson(json: any): string | null {
    if (!json || typeof json !== "object") return null;
    // Direct object form
    if (typeof (json as any)["@type"] === "string" && (json as any)["@type"].toLowerCase() === "podcastseries") {
        const name = (json as any).name;
        if (typeof name === "string" && name.trim()) return name.trim();
    }
    // Check for partOfSeries structure (common in podcast JSON-LD)
    if ((json as any).partOfSeries && typeof (json as any).partOfSeries === "object") {
        const series = (json as any).partOfSeries;
        if (typeof series.name === "string" && series.name.trim()) {
            return series.name.trim();
        }
    }
    // @graph array or any array
    const arr = Array.isArray(json) ? json : (Array.isArray((json as any)["@graph"]) ? (json as any)["@graph"] : null);
    if (arr) {
        for (const item of arr) {
            const n = findPodcastSeriesNameFromJson(item);
            if (n) return n;
        }
    }
    // nested objects
    for (const key of Object.keys(json)) {
        const v = (json as any)[key];
        if (v && typeof v === "object") {
            const n = findPodcastSeriesNameFromJson(v);
            if (n) return n;
        }
    }
    return null;
}

function findAudioUrlFromJson(json: any): string | null {
	if (!json || typeof json !== "object") return null;
	
	// Common places: json.audio.url, json.mainEntityOfPage.audio, graph items, etc.
	if (json.audio && typeof json.audio === "object" && typeof json.audio.url === "string") {
		return json.audio.url;
	}
	
	// Check for associatedMedia.contentUrl (common in podcast JSON-LD)
	if (json.associatedMedia && typeof json.associatedMedia === "object" && typeof json.associatedMedia.contentUrl === "string") {
		return json.associatedMedia.contentUrl;
	}
	
	// Check for enclosure.url (RSS-style)
	if (json.enclosure && typeof json.enclosure === "object" && typeof json.enclosure.url === "string") {
		return json.enclosure.url;
	}
	
	if (Array.isArray(json)) {
		for (const item of json) {
			const u = findAudioUrlFromJson(item);
			if (u) return u;
		}
	}
	for (const key of Object.keys(json)) {
		const v = (json as any)[key];
		if (v && typeof v === "object") {
			const u = findAudioUrlFromJson(v);
			if (u) return u;
		}
	}
	return null;
}

function findPublishedAtFromJson(json: any): string | null {
	if (!json || typeof json !== "object") return null;
	const candidates = [
		"datePublished",
		"uploadDate",
		"pubDate",
        "publishedAt",
        "publishAt",
	];
	for (const k of candidates) {
        const v = (json as any)[k];
        if (typeof v === "string") return v;
        // Support numeric timestamps (ms or s)
        if (typeof v === "number") {
            const ms = v > 1e12 ? v : v * 1000;
            const d = new Date(ms);
            if (!isNaN(d.getTime())) return d.toISOString();
        }
	}
	if (Array.isArray(json)) {
		for (const item of json) {
			const v = findPublishedAtFromJson(item);
			if (v) return v;
		}
	}
	for (const key of Object.keys(json)) {
		const v = (json as any)[key];
		if (v && typeof v === "object") {
			const r = findPublishedAtFromJson(v);
			if (r) return r;
		}
	}
	return null;
}

function normalizeDateToYMD(input: string | null): string | null {
    if (!input) return null;
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
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
		const host = process.env.HOST || '127.0.0.1';
		return `http://${host}:${port}`;
	}
	
	// 开发环境：使用 localhost
	return `http://localhost:${port}`;
}

export async function parseXiaoyuzhouEpisode(url: string): Promise<XiaoyuzhouEpisodeMeta> {
	// 增强重试机制：增加重试次数和更长的超时时间
	const maxRetries = 5; // 增加到5次重试
	let html: string | null = null;
	let lastError: Error | null = null;
	
	const isProduction = process.env.NODE_ENV === 'production';
	
	// 定义多种获取策略（类似音频下载策略）
	const fetchStrategies = [
		{
			name: isProduction ? '直接获取' : '直接获取',
			priority: 1,
			fetchFn: async () => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 60000);
				
				try {
					const res = await fetch(url, { 
						headers: {
							...DEFAULT_HEADERS,
							'Accept-Encoding': 'gzip, deflate, br',
							'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
							'Cache-Control': 'no-cache',
							'Pragma': 'no-cache',
							'Referer': 'https://www.xiaoyuzhoufm.com/',
							'Origin': 'https://www.xiaoyuzhoufm.com',
						} as any,
						signal: controller.signal,
						redirect: 'follow',
					});
					clearTimeout(timeoutId);
					return res;
				} catch (e) {
					clearTimeout(timeoutId);
					throw e;
				}
			}
		},
		{
			name: '通过内部代理获取',
			priority: 2,
			fetchFn: async () => {
				// 如果直接获取失败，尝试通过内部API代理获取
				const base = getServerBaseUrl();
				const proxyUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(url)}`;
				console.log(`尝试通过代理获取: ${proxyUrl}`);
				
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 60000);
				
				try {
					const res = await fetch(proxyUrl, {
						signal: controller.signal,
						headers: {
							'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
						}
					});
					clearTimeout(timeoutId);
					return res;
				} catch (e) {
					clearTimeout(timeoutId);
					throw e;
				}
			}
		}
	];
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		// 每次尝试都尝试所有策略
		for (const strategy of fetchStrategies) {
			try {
				console.log(`尝试获取播客页面 (${attempt}/${maxRetries}, 策略: ${strategy.name}): ${url}`);
				
				const res = await strategy.fetchFn();
				
				if (!res.ok) {
					throw new Error(`Failed to fetch episode page: HTTP ${res.status} ${res.statusText}`);
				}
				
				html = await res.text();
				
				if (!html || html.length < 100) {
					throw new Error(`获取的页面内容过短 (${html?.length || 0}字符)，可能是错误页面`);
				}
				
				console.log(`✅ 成功获取播客页面 (${html.length}字符, 策略: ${strategy.name})`);
				
				// 成功获取，跳出所有循环
				lastError = null;
				break; // 跳出策略循环
			} catch (fetchError: any) {
				const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
				const fetchErrorName = fetchError instanceof Error ? fetchError.name : 'UnknownError';
				
				console.warn(`策略 ${strategy.name} 失败:`, fetchErrorMessage);
				
				// 如果是最后一个策略，继续到下一个attempt
				if (strategy === fetchStrategies[fetchStrategies.length - 1]) {
					// 这是最后一个策略，记录错误并继续到下一个attempt
					lastError = fetchError;
					
					// 提供更详细的错误信息
					if (fetchErrorName === 'AbortError' || fetchErrorMessage.includes('aborted')) {
						lastError = new Error(`请求超时（${attempt}/${maxRetries}）: 60秒内未获取到响应`);
					} else if (fetchErrorMessage.includes('ECONNREFUSED') || fetchErrorMessage.includes('ENOTFOUND')) {
						lastError = new Error(`网络连接失败（${attempt}/${maxRetries}）: 无法连接到服务器`);
					} else if (fetchErrorMessage.includes('ETIMEDOUT') || fetchErrorMessage.includes('timeout')) {
						lastError = new Error(`请求超时（${attempt}/${maxRetries}）: 连接超时`);
					}
				}
				// 如果不是最后一个策略，继续尝试下一个策略
				continue;
			}
		}
		
		// 如果成功获取了html，跳出重试循环
		if (html) {
			break;
		}
		
		// 如果所有策略都失败，等待后重试（递增延迟：2s, 4s, 6s, 8s）
		if (attempt < maxRetries) {
			const delay = 2000 * attempt;
			console.log(`所有策略都失败，等待 ${delay}ms 后重试...`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	
	// 如果所有重试都失败，抛出最后一个错误
	if (lastError || !html) {
		const errorMessage = lastError instanceof Error ? lastError.message : '获取播客页面失败';
		const errorName = lastError instanceof Error ? lastError.name : 'UnknownError';
		
		// 提供更详细的错误信息
		let detailedError: string;
		if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
			detailedError = `网络请求失败（已重试${maxRetries}次）: ${errorMessage}`;
		} else if (errorMessage.includes('HTTP')) {
			detailedError = `HTTP错误（已重试${maxRetries}次）: ${errorMessage}`;
		} else {
			detailedError = `获取播客页面失败（已重试${maxRetries}次）: ${errorMessage}`;
		}
		
		console.error(`❌ 所有重试都失败，最终错误: ${detailedError}`);
		console.error(`错误类型: ${errorName}`);
		throw new Error(detailedError);
	}
	
	// 使用成功获取的html继续处理
	try {

	// 1) Try og tags
    const ogAudio = getMetaContent(html, "og:audio") || getMetaContent(html, "og:audio:url");
    const title = getMetaContent(html, "og:title") || getMetaContent(html, "twitter:title") || null;
    const description = getMetaContent(html, "og:description") || getMetaContent(html, "description") || null;
    const podcastTitle = getMetaContent(html, "og:site_name") || null;
    let author =
        getMetaContent(html, "article:author") ||
        getMetaContent(html, "og:article:author") ||
        getMetaContent(html, "byl") || // byline
        getMetaContent(html, "author") ||
        null;
    // Try published time meta
    let publishedAtMeta =
        getMetaContent(html, "article:published_time") ||
        getMetaContent(html, "og:published_time") ||
        getMetaContent(html, "og:updated_time") ||
        null;

	// 2) Try JSON blocks
	const jsonBlocks = tryParseJsonBlocks(html);
	let audioUrl = ogAudio || null;
    let publishedAt: string | null = publishedAtMeta || null;
    let seriesName: string | null = null;
	for (const jb of jsonBlocks) {
		if (!audioUrl) audioUrl = findAudioUrlFromJson(jb);
        if (!publishedAt) publishedAt = findPublishedAtFromJson(jb);
        if (!seriesName) seriesName = findPodcastSeriesNameFromJson(jb);
		if (!author && typeof jb?.author === "string") author = jb.author;
		if (!author && typeof jb?.author?.name === "string") author = jb.author.name;
        if (!author && typeof jb?.creator === "string") author = jb.creator;
        if (!author && typeof jb?.creator?.name === "string") author = jb.creator.name;
	}

    // 3) Fallback: simple regex for common audio extensions in page (with optional query)
	if (!audioUrl) {
        const mm = html.match(/https?:\/\/[^\s"']+\.(m4a|mp3|aac)(\?[^\s"']*)?/i);
        audioUrl = mm ? mm[0] : null;
	}

    // 4) Fallbacks from DOM for published time and podcast title/author
    if (!publishedAt) {
        // <time datetime="...">
        const tm = html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i);
        if (tm) publishedAt = tm[1];
    }
    let podcastTitleFallback = podcastTitle || seriesName || null;
    if (!podcastTitleFallback) {
        // try page <h1> or breadcrumb-like anchor before the episode title
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1) {
            const text = decodeHtml(h1[1]).replace(/<[^>]+>/g, "").trim();
            if (text && title && text !== title) podcastTitleFallback = text;
        }
    }
    // 优先使用播客节目名作为作者（小宇宙常见：作者=节目名，如"42章经"）
    // 只有在没有播客节目名的情况下，才尝试从DOM中提取作者
    if (!author && (podcastTitleFallback || podcastTitle)) {
        author = (podcastTitleFallback || podcastTitle) as string;
    } else if (!author) {
        // 如果仍然没有作者，尝试从DOM中查找（但要避免提取到用户名等无关信息）
        // 只查找明确的作者标签，避免提取评论中的用户名
        const authorPatterns = [
            /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
            /<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]+)<\/span>/i,
            /<div[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]+)<\/div>/i
        ];
        
        for (const pattern of authorPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                const extractedAuthor = decodeHtml(match[1]).trim();
                // 过滤掉明显不是作者的信息（如用户名、评论等）
                if (extractedAuthor && 
                    !extractedAuthor.includes('评论') && 
                    !extractedAuthor.includes('用户') &&
                    extractedAuthor.length > 1 && 
                    extractedAuthor.length < 20) {
                    author = extractedAuthor;
                    break;
                }
            }
        }
    }

    return {
        audioUrl,
        title,
        podcastTitle: podcastTitleFallback || podcastTitle,
        author,
        description,
        publishedAt: normalizeDateToYMD(publishedAt),
    };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`解析小宇宙播客失败 (${url}):`, errorMessage);
		// 如果是fetch失败，抛出更明确的错误
		if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
			throw new Error(`获取播客页面失败: ${errorMessage}`);
		}
		throw new Error(`解析播客元数据失败: ${errorMessage}`);
	}
}


