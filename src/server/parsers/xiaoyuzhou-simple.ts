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
 * 从HTML中提取作者信息（增强版，优先从 __NEXT_DATA__ 提取）
 */
function extractAuthor(html: string): string | null {
	// 策略1: 从 Next.js __NEXT_DATA__ 中提取（最可靠）
	try {
		const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
		if (nextDataMatch) {
			const nextData = JSON.parse(nextDataMatch[1]);
			// 在 Next.js 数据结构中查找作者
			const findAuthorInObject = (obj: any, depth = 0): string | null => {
				if (depth > 10) return null;
				if (!obj || typeof obj !== 'object') return null;
				
				// 直接检查常见字段
				if (typeof obj.author === 'string' && obj.author.trim()) {
					return obj.author.trim();
				}
				if (typeof obj.creator === 'string' && obj.creator.trim()) {
					return obj.creator.trim();
				}
				if (obj.author && typeof obj.author.name === 'string' && obj.author.name.trim()) {
					return obj.author.name.trim();
				}
				if (obj.podcast && typeof obj.podcast.name === 'string' && obj.podcast.name.trim()) {
					return obj.podcast.name.trim();
				}
				if (obj.episode && obj.episode.podcast && typeof obj.episode.podcast.name === 'string' && obj.episode.podcast.name.trim()) {
					return obj.episode.podcast.name.trim();
				}
				
				// 递归查找
				for (const key in obj) {
					if (obj.hasOwnProperty(key) && (key === 'author' || key === 'creator' || key === 'podcast')) {
						const result = findAuthorInObject(obj[key], depth + 1);
						if (result) return result;
					}
				}
				return null;
			};
			
			const author = findAuthorInObject(nextData);
			if (author) {
				console.log(`[解析器] 从 __NEXT_DATA__ 中提取到作者`);
				return author;
			}
		}
	} catch (e) {
		// JSON 解析失败，继续尝试其他方法
	}
	
	// 策略2: og:audio:artist meta标签
	let match = html.match(/<meta[^>]*property=["']og:audio:artist["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略3: author meta标签
	match = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略4: 从播客标题区域提取（podcast-title class）
	match = html.match(/<div[^>]*class=["'][^"']*podcast-title["'][^>]*>[\s\S]*?<a[^>]*class=["'][^"']*name["'][^>]*>([^<]+)<\/a>/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略5: 从author class的span中提取
	match = html.match(/<span[^>]*class=["'][^"']*author["'][^>]*>([^<]+)<\/span>/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略6: 从JSON-LD数据中提取
	match = html.match(/"author"\s*:\s*{\s*"@type"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/i);
	if (match) {
		const author = match[1].trim();
		if (author) return author;
	}
	
	// 策略7: 从页面中的播客名称区域提取
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
 * 从HTML中提取音频URL（增强版：在原有策略基础上增加 __NEXT_DATA__ 提取）
 * 参考浏览器插件实现：插件通过 document.querySelector('audio').src 直接获取
 */
function extractAudioUrl(html: string): string | null {
	// 策略0（新增，最高优先级）: 从 Next.js __NEXT_DATA__ 中提取
	// 浏览器插件可以直接访问 window.__NEXT_DATA__，我们通过解析 HTML 中的 script 标签实现
	try {
		const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
		if (nextDataMatch) {
			const nextData = JSON.parse(nextDataMatch[1]);
			// 在 Next.js 数据结构中查找音频 URL
			const findAudioInObject = (obj: any, depth = 0): string | null => {
				if (depth > 10) return null; // 防止无限递归
				if (!obj || typeof obj !== 'object') return null;
				
				// 直接检查常见字段
				if (typeof obj.audioUrl === 'string' && obj.audioUrl.startsWith('http')) {
					return obj.audioUrl;
				}
				if (typeof obj.audio === 'string' && obj.audio.startsWith('http')) {
					return obj.audio;
				}
				if (obj.enclosure && typeof obj.enclosure.url === 'string' && obj.enclosure.url.startsWith('http')) {
					return obj.enclosure.url;
				}
				
				// 递归查找
				for (const key in obj) {
					if (obj.hasOwnProperty(key)) {
						const result = findAudioInObject(obj[key], depth + 1);
						if (result) return result;
					}
				}
				return null;
			};
			
			const audioUrl = findAudioInObject(nextData);
			if (audioUrl) {
				console.log(`[解析器] 从 __NEXT_DATA__ 中提取到音频URL`);
				return audioUrl;
			}
		}
	} catch (e) {
		// JSON 解析失败，继续尝试其他方法（不影响原有逻辑）
		console.warn(`[解析器] 解析 __NEXT_DATA__ 失败，继续尝试其他策略:`, e instanceof Error ? e.message : String(e));
	}
	
	// 策略1（原有）: og:audio meta标签
	let match = html.match(/<meta[^>]*property=["']og:audio["'][^>]*content=["']([^"']+)["']/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 策略2（原有，对应插件实现）: audio标签的src属性
	// 这是浏览器插件使用的方式：document.querySelector('audio').src
	match = html.match(/<audio[^>]*src=["']([^"']+)["']/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 策略3（原有）: audioUrl JSON字段
	match = html.match(/audioUrl["\s]*:["\s]*["']([^"']+)["']/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 策略4（原有）: 从JSON-LD数据中提取
	match = html.match(/"audio"\s*:\s*{\s*"@type"\s*:\s*"[^"]*"\s*,\s*"contentUrl"\s*:\s*"([^"]+)"/i);
	if (match) {
		const url = match[1].trim();
		if (url && url.startsWith('http')) return url;
	}
	
	// 所有策略都失败
	return null;
}

/**
 * 从HTML中提取标题（增强版，优先从 __NEXT_DATA__ 提取）
 */
function extractTitle(html: string): string | null {
	let title: string | null = null;
	
	// 策略1: 从 Next.js __NEXT_DATA__ 中提取（最可靠）
	try {
		const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
		if (nextDataMatch) {
			const nextData = JSON.parse(nextDataMatch[1]);
			// 在 Next.js 数据结构中查找标题
			const findTitleInObject = (obj: any, depth = 0): string | null => {
				if (depth > 10) return null;
				if (!obj || typeof obj !== 'object') return null;
				
				// 直接检查常见字段
				if (typeof obj.title === 'string' && obj.title.trim()) {
					return obj.title.trim();
				}
				if (typeof obj.name === 'string' && obj.name.trim()) {
					return obj.name.trim();
				}
				if (obj.episode && typeof obj.episode.title === 'string' && obj.episode.title.trim()) {
					return obj.episode.title.trim();
				}
				
				// 递归查找
				for (const key in obj) {
					if (obj.hasOwnProperty(key) && (key === 'title' || key === 'name' || key === 'episode')) {
						const result = findTitleInObject(obj[key], depth + 1);
						if (result) return result;
					}
				}
				return null;
			};
			
			title = findTitleInObject(nextData);
			if (title) {
				console.log(`[解析器] 从 __NEXT_DATA__ 中提取到标题`);
			}
		}
	} catch (e) {
		// JSON 解析失败，继续尝试其他方法
	}
	
	// 策略2: title标签
	if (!title) {
		let match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
		if (match) {
			title = match[1].trim();
		}
	}
	
	// 策略3: og:title meta标签
	if (!title) {
		const match = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
		if (match) {
			title = match[1].trim();
		}
	}
	
	// 策略4: h1标签
	if (!title) {
		const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
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
			
			// 特殊处理 HTTP 429 (Too Many Requests)
			if (res.status === 429) {
				const retryAfter = res.headers.get('Retry-After');
				const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60; // 默认等待60秒
				console.warn(`[解析器] 遇到 HTTP 429 限流，需要等待 ${waitSeconds} 秒后重试`);
				throw new Error(`HTTP_429_RATE_LIMIT:${waitSeconds}`); // 特殊错误标记，包含等待时间
			}
			
			// 特殊处理 HTTP 403 (Forbidden)
			if (res.status === 403) {
				console.warn(`[解析器] 遇到 HTTP 403 禁止访问，可能是反爬虫机制`);
				throw new Error(`HTTP_403_FORBIDDEN`); // 特殊错误标记
			}
			
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
			
			// 特殊处理 HTTP 429 (Too Many Requests)
			if (res.status === 429) {
				const retryAfter = res.headers.get('Retry-After');
				const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
				console.warn(`[解析器] 代理遇到 HTTP 429 限流，需要等待 ${waitSeconds} 秒后重试`);
				throw new Error(`HTTP_429_RATE_LIMIT:${waitSeconds}`);
			}
			
			// 特殊处理 HTTP 403 (Forbidden)
			if (res.status === 403) {
				console.warn(`[解析器] 代理遇到 HTTP 403 禁止访问`);
				throw new Error(`HTTP_403_FORBIDDEN`);
			}
			
			if (!res.ok) {
				// 如果代理返回其他错误，记录详细错误信息
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
	let rateLimitWaitTime: number | null = null; // 记录 429 错误建议的等待时间
	
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
			
			// 检查是否是 429 限流错误
			if (errorMsg.startsWith('HTTP_429_RATE_LIMIT:')) {
				const waitSeconds = parseInt(errorMsg.split(':')[1], 10) || 60;
				rateLimitWaitTime = waitSeconds * 1000; // 转换为毫秒
				console.warn(`[解析器] 检测到限流，建议等待 ${waitSeconds} 秒`);
			}
			
			// 检查是否是 403 禁止访问
			if (errorMsg === 'HTTP_403_FORBIDDEN') {
				console.warn(`[解析器] 检测到 403 禁止访问，可能是反爬虫机制，将尝试代理或延长等待`);
			}
			
			lastError = error instanceof Error ? error : new Error(String(error));
			
			// 如果直接获取失败，尝试代理（但如果是 429，代理也可能失败，所以先等待）
			if (errorMsg !== 'HTTP_429_RATE_LIMIT:' && !errorMsg.startsWith('HTTP_429_RATE_LIMIT:')) {
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
		}
		
		// 如果不是最后一次尝试，等待后重试
		if (attempt < maxRetries) {
			let delay: number;
			
			// 如果遇到 429 限流，使用更长的等待时间
			if (rateLimitWaitTime !== null) {
				// 对于 429，等待建议的时间，但不超过 2 分钟（减少等待时间，避免任务卡住太久）
				delay = Math.min(rateLimitWaitTime, 120000); // 最多等待 2 分钟
				console.log(`[解析器] 等待 ${delay/1000} 秒后重试（429 限流恢复）...`);
				rateLimitWaitTime = null; // 重置，下次重试使用正常延迟
			} else {
				// 正常情况：指数退避策略
				// 第1次重试等待2秒，第2次等待4秒，第3次等待8秒，第4次等待16秒
				delay = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
				console.log(`[解析器] 等待 ${delay}ms 后重试（指数退避策略）...`);
			}
			
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	
	// 所有重试都失败
	const errorMessage = lastError instanceof Error ? lastError.message : '获取播客页面失败';
	const errorName = lastError instanceof Error ? lastError.name : 'UnknownError';
	
	// 特殊处理 429 和 403 错误
	let detailedErrorMessage = errorMessage;
	
	if (errorMessage.startsWith('HTTP_429_RATE_LIMIT:')) {
		const waitSeconds = parseInt(errorMessage.split(':')[1], 10) || 60;
		detailedErrorMessage = `请求过于频繁（HTTP 429）: 小宇宙服务器检测到请求频率过高，建议等待 ${waitSeconds} 秒后重试。已重试 ${maxRetries} 次。解决方案: 1) 等待一段时间后重新提交 2) 检查是否有其他进程在频繁请求该链接`;
	} else if (errorMessage === 'HTTP_403_FORBIDDEN') {
		detailedErrorMessage = `访问被禁止（HTTP 403）: 小宇宙服务器拒绝了请求，可能是反爬虫机制。已重试 ${maxRetries} 次。解决方案: 1) 检查链接是否有效 2) 等待一段时间后重试 3) 联系管理员检查服务器配置`;
	} else if (errorMessage === 'fetch failed' || errorMessage.toLowerCase().includes('fetch failed')) {
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
