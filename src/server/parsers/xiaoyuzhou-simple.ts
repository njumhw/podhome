// 简化版小宇宙播客解析器 - 重新实现，确保可靠性和准确性

const DEFAULT_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Referer': 'https://www.xiaoyuzhoufm.com/',
	'Origin': 'https://www.xiaoyuzhoufm.com',
};

export interface XiaoyuzhouEpisodeMeta {
	audioUrl: string | null;
	title?: string | null;
	podcastTitle?: string | null;
	author?: string | null;
	description?: string | null;
	publishedAt?: string | null; // ISO string if available
}

function getServerBaseUrl(): string {
	if (typeof window !== 'undefined') {
		return window.location.origin;
	}
	
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (baseUrl) {
		return baseUrl;
	}
	
	return 'http://localhost:3000';
}

/**
 * 从HTML中提取作者信息（多种策略）
 */
function extractAuthor(html: string): string | null {
	// 策略1: og:audio:artist meta标签
	let match = html.match(/<meta[^>]*property=["']og:audio:artist["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略2: author meta标签
	match = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略3: 从播客标题区域提取（podcast-title class）
	match = html.match(/<div[^>]*class=["'][^"']*podcast-title["'][^>]*>[\s\S]*?<a[^>]*class=["'][^"']*name["'][^>]*>([^<]+)<\/a>/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略4: 从author class的span中提取
	match = html.match(/<span[^>]*class=["'][^"']*author["'][^>]*>([^<]+)<\/span>/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略5: 从JSON-LD数据中提取
	match = html.match(/"author"\s*:\s*{\s*"@type"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略6: 从页面中的播客名称区域提取
	match = html.match(/<div[^>]*class=["'][^"']*podcast-name["'][^>]*>([^<]+)<\/div>/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	return null;
}

/**
 * 从HTML中提取发布时间（多种策略）
 */
function extractPublishedAt(html: string): string | null {
	// 策略1: article:published_time meta标签
	let match = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const date = match[1].trim();
		if (date) return date;
	}
	
	// 策略2: time标签的dateTime属性
	match = html.match(/<time[^>]*dateTime=["']([^"']+)["'][^>]*>/i);
	if (match) {
		const date = match[1].trim();
		if (date) return date;
	}
	
	// 策略3: publishedAt JSON字段
	match = html.match(/publishedAt["\s]*:["\s]*["']([^"']+)["']/i);
	if (match) {
		const date = match[1].trim();
		if (date) return date;
	}
	
	// 策略4: 从JSON-LD数据中提取
	match = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
	if (match) {
		const date = match[1].trim();
		if (date) return date;
	}
	
	// 策略5: 从页面中的时间显示区域提取
	match = html.match(/<span[^>]*class=["'][^"']*time["'][^>]*>([^<]+)<\/span>/i);
	if (match) {
		const dateStr = match[1].trim();
		// 尝试解析常见的中文日期格式
		const date = new Date(dateStr);
		if (!isNaN(date.getTime())) {
			return date.toISOString();
		}
	}
	
	return null;
}

/**
 * 从HTML中提取音频URL
 */
function extractAudioUrl(html: string): string | null {
	// 策略1: og:audio meta标签
	let match = html.match(/<meta[^>]*property=["']og:audio["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 策略2: audio标签的src属性
	match = html.match(/<audio[^>]*src=["']([^"']+)["']/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 策略3: audioUrl JSON字段
	match = html.match(/audioUrl["\s]*:["\s]*["']([^"']+)["']/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 策略4: 从JSON-LD数据中提取
	match = html.match(/"audio"\s*:\s*{\s*"@type"\s*:\s*"[^"]*"\s*,\s*"contentUrl"\s*:\s*"([^"]+)"/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	return null;
}

/**
 * 从HTML中提取标题
 */
function extractTitle(html: string): string | null {
	let title: string | null = null;
	
	// 策略1: title标签
	let match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (match) {
		title = match[1].trim();
	}
	
	// 策略2: og:title meta标签
	if (!title) {
		match = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
		if (match) {
			title = match[1].trim();
		}
	}
	
	// 策略3: h1标签
	if (!title) {
		match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
		if (match) {
			title = match[1].trim();
		}
	}
	
	// 清理标题：移除 "| 小宇宙 - 听播客，上小宇宙" 或类似的后缀
	if (title) {
		// 移除各种可能的网站后缀
		title = title
			.replace(/\s*\|\s*小宇宙\s*-\s*听播客[，,]\s*上小宇宙\s*/gi, '')
			.replace(/\s*\|\s*小宇宙\s*-\s*听播客[，,]\s*上小宇宙\s*/gi, '')
			.replace(/\s*\|\s*小宇宙\s*/gi, '')
			.replace(/\s*-\s*小宇宙\s*/gi, '')
			.trim();
	}
	
	return title;
}

/**
 * 从HTML中提取描述
 */
function extractDescription(html: string): string | null {
	// 策略1: og:description meta标签
	let match = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const desc = match[1].trim();
		if (desc) return desc;
	}
	
	// 策略2: description meta标签
	match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const desc = match[1].trim();
		if (desc) return desc;
	}
	
	return null;
}

/**
 * 获取HTML内容（带重试和多种策略）
 */
async function fetchHtml(url: string): Promise<string> {
	const maxRetries = 5; // 增加到5次重试，提高成功率
	const timeout = 30000; // 30秒超时
	
	// 策略1: 直接获取
	const directFetch = async (): Promise<string> => {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		try {
			const res = await fetch(url, {
				headers: DEFAULT_HEADERS as any,
				signal: controller.signal,
				redirect: 'follow',
			});
			clearTimeout(timeoutId);
			
			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}
			
			const html = await res.text();
			if (!html || html.length < 100) {
				throw new Error(`页面内容过短 (${html?.length || 0}字符)`);
			}
			
			return html;
		} catch (e) {
			clearTimeout(timeoutId);
			// 增强错误信息，特别是 "fetch failed" 错误
			if (e instanceof Error) {
				const errorName = e.name;
				const errorMessage = e.message;
				// 如果错误信息是简化的 "fetch failed"，提供更详细的错误信息
				if (errorMessage === 'fetch failed' || errorName === 'TypeError') {
					// 检查是否是超时错误
					if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
						throw new Error(`网络请求超时: 无法在${timeout/1000}秒内连接到 ${url}。可能原因: 网络连接慢、目标服务器响应慢或防火墙限制。`);
					}
					// 检查是否是连接错误
					if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
						throw new Error(`网络连接失败: 无法连接到 ${url}。可能原因: DNS解析失败、目标服务器不可用或网络防火墙限制。`);
					}
					// 其他 fetch failed 错误
					throw new Error(`网络请求失败 (${errorName}): 无法获取 ${url}。可能原因: 网络连接问题、DNS解析失败、服务器防火墙限制或目标服务器暂时不可用。`);
				}
			}
			throw e;
		}
	};
	
	// 策略2: 通过内部代理获取
	const proxyFetch = async (): Promise<string> => {
		const base = getServerBaseUrl();
		const proxyUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(url)}`;
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		try {
			const res = await fetch(proxyUrl, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
				}
			});
			clearTimeout(timeoutId);
			
			if (!res.ok) {
				// 如果代理返回403或其他错误，记录详细错误信息
				const errorText = await res.text().catch(() => '无法读取错误响应');
				console.warn(`[解析器] 代理返回错误: ${res.status} ${res.statusText}, 响应内容: ${errorText.substring(0, 200)}`);
				throw new Error(`代理HTTP ${res.status} ${res.statusText}: ${errorText.substring(0, 100)}`);
			}
			
			const html = await res.text();
			if (!html || html.length < 100) {
				throw new Error(`代理页面内容过短 (${html?.length || 0}字符)`);
			}
			
			return html;
		} catch (e) {
			clearTimeout(timeoutId);
			// 增强错误信息
			if (e instanceof Error) {
				const errorName = e.name;
				const errorMessage = e.message;
				if (errorMessage === 'fetch failed' || errorName === 'TypeError') {
					throw new Error(`代理获取失败: ${errorName} - ${errorMessage}。可能原因: 代理服务不可用、网络连接问题或目标服务器拒绝连接。`);
				}
			}
			throw e;
		}
	};
	
	// 重试逻辑
	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		// 先尝试直接获取
		try {
			console.log(`[解析器] 尝试获取页面 (${attempt}/${maxRetries}, 策略: 直接获取): ${url}`);
			const html = await directFetch();
			console.log(`[解析器] ✅ 成功获取页面 (${html.length}字符)`);
			return html;
		} catch (error: any) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.warn(`[解析器] 直接获取失败 (${attempt}/${maxRetries}): ${errorMsg}`);
			lastError = error instanceof Error ? error : new Error(String(error));
			
			// 如果直接获取失败，尝试代理
			try {
				console.log(`[解析器] 尝试通过代理获取 (${attempt}/${maxRetries}): ${url}`);
				const html = await proxyFetch();
				console.log(`[解析器] ✅ 代理获取成功 (${html.length}字符)`);
				return html;
			} catch (proxyError: any) {
				const proxyErrorMsg = proxyError instanceof Error ? proxyError.message : String(proxyError);
				console.warn(`[解析器] 代理获取也失败 (${attempt}/${maxRetries}): ${proxyErrorMsg}`);
				lastError = proxyError instanceof Error ? proxyError : new Error(String(proxyError));
			}
		}
		
		// 如果不是最后一次尝试，等待后重试（指数退避策略）
		if (attempt < maxRetries) {
			// 指数退避：第1次重试等待2秒，第2次等待4秒，第3次等待8秒，第4次等待16秒
			const delay = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
			console.log(`[解析器] 等待 ${delay}ms 后重试（指数退避策略）...`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	
	// 所有重试都失败
	const errorMessage = lastError instanceof Error ? lastError.message : '获取播客页面失败';
	const errorName = lastError instanceof Error ? lastError.name : 'UnknownError';
	
	// 如果错误信息是简化的 "fetch failed"，提供更详细的错误信息
	let detailedErrorMessage = errorMessage;
	if (errorMessage === 'fetch failed' || errorMessage.toLowerCase().includes('fetch failed')) {
		detailedErrorMessage = `网络请求失败（已重试${maxRetries}次）: 无法连接到 ${url}。错误类型: ${errorName}。可能原因: 网络连接问题、DNS解析失败、服务器防火墙限制或目标服务器暂时不可用。`;
	} else {
		detailedErrorMessage = `网络请求失败（已重试${maxRetries}次）: ${errorMessage}`;
	}
	
	throw new Error(detailedErrorMessage);
}

/**
 * 解析小宇宙播客页面
 */
export async function parseXiaoyuzhouEpisode(url: string): Promise<XiaoyuzhouEpisodeMeta> {
	const startTime = Date.now();
	console.log(`[解析器] ========== 开始解析播客 ==========`);
	console.log(`[解析器] URL: ${url}`);
	console.log(`[解析器] 时间: ${new Date().toISOString()}`);
	
	try {
		// 1. 获取HTML
		const html = await fetchHtml(url);
		
		// 2. 提取各个字段
		console.log(`[解析器] 开始提取元数据...`);
		
		const audioUrl = extractAudioUrl(html);
		if (!audioUrl) {
			throw new Error('无法从页面中提取音频URL');
		}
		
		const title = extractTitle(html);
		const author = extractAuthor(html);
		const publishedAt = extractPublishedAt(html);
		const description = extractDescription(html);
		
		// 3. 输出结果（audioUrl 已经检查过不为 null）
		const result: XiaoyuzhouEpisodeMeta = {
			audioUrl: audioUrl, // 这里 audioUrl 已经确定不为 null
			title: title || null,
			author: author || null,
			description: description || null,
			publishedAt: publishedAt || null,
		};
		
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`[解析器] ✅ 解析成功 (耗时: ${elapsed}秒)`);
		console.log(`[解析器]   标题: ${result.title || '未命名'}`);
		console.log(`[解析器]   作者: ${result.author || '未知'}`);
		console.log(`[解析器]   发布时间: ${result.publishedAt || '未知'}`);
		console.log(`[解析器]   音频URL: ${audioUrl.substring(0, 80)}...`);
		console.log(`[解析器] ==========================================`);
		
		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		
		console.error(`[解析器] ========== ❌ 解析失败 ==========`);
		console.error(`[解析器] URL: ${url}`);
		console.error(`[解析器] 错误: ${errorMessage}`);
		console.error(`[解析器] 耗时: ${elapsed}秒`);
		if (errorStack) {
			console.error(`[解析器] 堆栈: ${errorStack.substring(0, 500)}`);
		}
		console.error(`[解析器] ==========================================`);
		
		throw error;
	}
}
