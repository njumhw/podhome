// import { HeadersInit } from "next/dist/server/web/spec-extension/adapters/headers";

export type UniversalPodcastMeta = {
  audioUrl: string | null;
  title?: string | null;
  podcastTitle?: string | null;
  author?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  source: string; // 标识数据来源
  confidence: number; // 数据可信度 0-1
};

const DEFAULT_HEADERS: HeadersInit = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};

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

// 数据提取器接口
interface DataExtractor {
  name: string;
  extract(html: string, url: string): Partial<UniversalPodcastMeta>;
  confidence: number;
}

// 1. JSON-LD 结构化数据提取器（最高优先级）
class JsonLdExtractor implements DataExtractor {
  name = "JSON-LD";
  confidence = 0.9;

  extract(html: string, url: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    try {
      // 提取所有JSON-LD块
      const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      
      while ((match = ldRe.exec(html))) {
        try {
          const jsonData = JSON.parse(match[1]);
          const extracted = this.extractFromJson(jsonData);
          
          // 合并结果，优先使用更完整的数据
          Object.assign(result, extracted);
        } catch (e) {
          // 忽略解析错误，继续处理下一个块
        }
      }
    } catch (e) {
      console.warn('JSON-LD extraction failed:', e);
    }
    
    return result;
  }

  private extractFromJson(json: any): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    // 递归搜索JSON结构，支持更深层的嵌套（Apple 规范）
    const search = (obj: any, path: string[] = [], visited: Set<any> = new Set()): void => {
      // 防止循环引用
      if (!obj || typeof obj !== 'object') return;
      if (visited.has(obj)) return;
      visited.add(obj);
      
      try {
        // 检查当前对象是否为 PodcastEpisode 或 AudioObject
        const objType = obj['@type'];
        const isPodcastEpisode = objType === 'PodcastEpisode';
        const isAudioObject = objType === 'AudioObject';
        
        if (isPodcastEpisode || isAudioObject) {
          // 提取标题
          if (obj.name && typeof obj.name === 'string' && !result.title) {
            result.title = obj.name;
          }
          
          // 提取描述
          if (obj.description && typeof obj.description === 'string' && !result.description) {
            result.description = obj.description;
          }
          
          // 提取发布时间（支持多种字段名）
          if (!result.publishedAt) {
            const dateFields = ['datePublished', 'uploadDate', 'pubDate', 'publishedAt'];
            for (const field of dateFields) {
              if (obj[field]) {
                result.publishedAt = obj[field];
                break;
              }
            }
          }
          
          // 提取音频URL - 优先检查 associatedMedia.contentUrl（Apple 规范）
          if (!result.audioUrl) {
            // 1. 优先：associatedMedia.contentUrl
            if (obj.associatedMedia && typeof obj.associatedMedia === 'object') {
              if (obj.associatedMedia.contentUrl && typeof obj.associatedMedia.contentUrl === 'string') {
                result.audioUrl = obj.associatedMedia.contentUrl;
              }
              // 如果 associatedMedia 是数组，遍历查找
              else if (Array.isArray(obj.associatedMedia)) {
                for (const media of obj.associatedMedia) {
                  if (media && typeof media === 'object' && media.contentUrl) {
                    result.audioUrl = media.contentUrl;
                    break;
                  }
                }
              }
            }
            
            // 2. 其次：contentUrl（直接字段）
            if (!result.audioUrl && obj.contentUrl && typeof obj.contentUrl === 'string') {
              result.audioUrl = obj.contentUrl;
            }
            
            // 3. 再次：parts.contentUrl（嵌套结构）
            if (!result.audioUrl && obj.parts && Array.isArray(obj.parts)) {
              for (const part of obj.parts) {
                if (part && typeof part === 'object' && part.contentUrl) {
                  result.audioUrl = part.contentUrl;
                  break;
                }
              }
            }
          }
          
          // 提取播客系列信息 - partOfSeries.name（Apple 规范）
          if (obj.partOfSeries && typeof obj.partOfSeries === 'object') {
            // 处理对象形式
            if (obj.partOfSeries.name && typeof obj.partOfSeries.name === 'string' && !result.podcastTitle) {
              result.podcastTitle = obj.partOfSeries.name;
              if (!result.author) result.author = obj.partOfSeries.name;
            }
            // 处理数组形式
            else if (Array.isArray(obj.partOfSeries)) {
              for (const series of obj.partOfSeries) {
                if (series && typeof series === 'object' && series.name && !result.podcastTitle) {
                  result.podcastTitle = series.name;
                  if (!result.author) result.author = series.name;
                  break;
                }
              }
            }
          }
        }
        
        // 检查是否为 PodcastSeries
        if (objType === 'PodcastSeries') {
          if (obj.name && typeof obj.name === 'string' && !result.podcastTitle) {
            result.podcastTitle = obj.name;
            if (!result.author) result.author = obj.name;
          }
        }
        
        // 处理 @graph 数组（常见于 Apple 的 JSON-LD 结构）
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) {
            if (item && typeof item === 'object') {
              search(item, [...path, '@graph'], new Set(visited));
            }
          }
        }
        
        // 递归搜索子对象和数组
        for (const [key, value] of Object.entries(obj)) {
          if (key === '@graph') continue; // 已处理
          
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object') {
                search(item, [...path, key], new Set(visited));
              }
            }
          } else if (value && typeof value === 'object') {
            search(value, [...path, key], new Set(visited));
          }
        }
      } catch (error) {
        // 优雅处理错误，继续搜索其他部分
        console.warn(`JSON-LD extraction error at path ${path.join('.')}:`, error);
      }
    };
    
    try {
      // 处理数组形式的 JSON-LD
      if (Array.isArray(json)) {
        for (const item of json) {
          if (item && typeof item === 'object') {
            search(item, [], new Set());
          }
        }
      } else {
        search(json, [], new Set());
      }
    } catch (error) {
      // 即使部分解析失败，也返回已找到的数据
      console.warn('JSON-LD extraction encountered an error, returning partial results:', error);
    }
    
    return result;
  }
}

// 2. Meta标签提取器
class MetaTagExtractor implements DataExtractor {
  name = "Meta Tags";
  confidence = 0.7;

  extract(html: string, url: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    // 提取meta标签
    const metaPatterns = [
      { name: 'og:title', target: 'title' },
      { name: 'og:description', target: 'description' },
      { name: 'og:audio', target: 'audioUrl' },
      { name: 'article:published_time', target: 'publishedAt' },
      { name: 'og:published_time', target: 'publishedAt' },
      { name: 'og:updated_time', target: 'publishedAt' },
      { name: 'author', target: 'author' },
      { name: 'og:site_name', target: 'podcastTitle' },
    ];
    
    for (const pattern of metaPatterns) {
      const value = this.getMetaContent(html, pattern.name);
      if (value && !result[pattern.target as keyof UniversalPodcastMeta]) {
        (result as any)[pattern.target] = value;
      }
    }
    
    return result;
  }

  private getMetaContent(html: string, property: string): string | null {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const match = html.match(re);
    return match ? this.decodeHtml(match[1]) : null;
  }

  private decodeHtml(s: string): string {
    return s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}

// 3. DOM结构提取器
class DomExtractor implements DataExtractor {
  name = "DOM Structure";
  confidence = 0.5;

  extract(html: string, url: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    // 提取标题
    if (!result.title) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
        result.title = this.cleanText(h1Match[1]);
      }
    }
    
    // 提取发布时间
    if (!result.publishedAt) {
      const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i);
      if (timeMatch) {
        result.publishedAt = timeMatch[1];
      }
    }
    
    // 提取音频链接
    if (!result.audioUrl) {
      const audioMatch = html.match(/https?:\/\/[^\s"']+\.(m4a|mp3|aac|wav)(\?[^\s"']*)?/i);
      if (audioMatch) {
        result.audioUrl = audioMatch[0];
      }
    }
    
    return result;
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}

// 4. 平台特定提取器
class PlatformSpecificExtractor implements DataExtractor {
  name = "Platform Specific";
  confidence = 0.8;

  extract(html: string, url: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    // Apple Podcasts 特定逻辑
    if (url.includes('podcasts.apple.com')) {
      return this.extractApplePodcasts(html);
    }

    // 小宇宙特定逻辑
    if (url.includes('xiaoyuzhoufm.com')) {
      return this.extractXiaoyuzhou(html);
    }
    
    // 喜马拉雅特定逻辑
    if (url.includes('ximalaya.com')) {
      return this.extractXimalaya(html);
    }
    
    // 其他平台可以在这里添加
    
    return result;
  }

  private extractApplePodcasts(html: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};

    // 1) 复用 JSON-LD 提取（以获取标题/描述/时间等）
    try {
      const jsonResult = new JsonLdExtractor().extract(html, 'podcasts.apple.com');
      Object.assign(result, jsonResult);
    } catch (e) {
      console.warn('Apple JSON-LD extract failed:', e);
    }

    // 2) 如果 JSON-LD 未抓到音频，使用正则兜底
    if (!result.audioUrl) {
      const appleAudioRegex = /https?:\/\/[^"'\\s]+?(?:itunes\.apple\.com|apple\.com\/podcast-download)[^"'\\s]+?\.(?:mp3|m4a)(\?[^\s"'<>]*)?/i;
      const match = html.match(appleAudioRegex);
      if (match && match[0]) {
        result.audioUrl = match[0];
      } else {
        // 更宽松的通用音频正则作为最后兜底
        const genericAudioRegex = /https?:\/\/[^"'\\s]+\.(?:mp3|m4a)(\?[^\s"'<>]*)?/i;
        const genericMatch = html.match(genericAudioRegex);
        if (genericMatch && genericMatch[0]) {
          result.audioUrl = genericMatch[0];
        }
      }
    }

    return result;
  }

  private extractXiaoyuzhou(html: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    // 小宇宙特定的数据提取逻辑
    // 这里可以添加小宇宙特有的解析规则
    
    return result;
  }

  private extractXimalaya(html: string): Partial<UniversalPodcastMeta> {
    const result: Partial<UniversalPodcastMeta> = {};
    
    // 喜马拉雅特定的数据提取逻辑
    
    return result;
  }
}

// 主解析器类
export class UniversalPodcastParser {
  private extractors: DataExtractor[] = [
    new JsonLdExtractor(),
    new MetaTagExtractor(),
    new PlatformSpecificExtractor(),
    new DomExtractor(),
  ];

  async parsePodcast(url: string): Promise<UniversalPodcastMeta> {
    try {
      // 获取HTML内容
      const html = await this.fetchHtml(url);
      
      // 使用所有提取器提取数据
      const results: Partial<UniversalPodcastMeta>[] = [];
      
      for (const extractor of this.extractors) {
        try {
          const extracted = extractor.extract(html, url);
          if (Object.keys(extracted).length > 0) {
            results.push({
              ...extracted,
              source: extractor.name,
              confidence: extractor.confidence,
            });
          }
        } catch (e) {
          console.warn(`Extractor ${extractor.name} failed:`, e);
        }
      }
      
      // 合并结果，优先使用高可信度的数据
      const merged = this.mergeResults(results);
      
      // 后处理和验证
      return this.postProcess(merged, url);
      
    } catch (error) {
      console.error('Universal podcast parsing failed:', error);
      return {
        audioUrl: null,
        source: 'error',
        confidence: 0,
      };
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const maxRetries = 3;
    let html: string | null = null;
    let lastError: Error | null = null;
    
    const isApplePodcasts = url.includes('podcasts.apple.com');
    
    // 定义多种获取策略
    const fetchStrategies = [
      {
        name: '直接获取',
        priority: 1,
        fetchFn: async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          
          try {
            // 为 Apple Podcasts 设置特定的 Header
            const headers: HeadersInit = {
              ...DEFAULT_HEADERS,
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            };
            
            // Apple Podcasts 特定 Header
            if (isApplePodcasts) {
              headers['Referer'] = 'https://podcasts.apple.com/';
              headers['Origin'] = 'https://podcasts.apple.com';
              // 使用更现代的 Safari User-Agent
              headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
            }
            
            const res = await fetch(url, {
              headers,
              signal: controller.signal,
              redirect: 'follow',
            } as any);
            
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
          console.log(`[UniversalParser] 尝试通过代理获取: ${proxyUrl}`);
          
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
          console.log(`[UniversalParser] 尝试获取播客页面 (${attempt}/${maxRetries}, 策略: ${strategy.name}): ${url}`);
          
          const res = await strategy.fetchFn();
          
          if (!res.ok) {
            throw new Error(`Failed to fetch episode page: HTTP ${res.status} ${res.statusText}`);
          }
          
          html = await res.text();
          
          if (!html || html.length < 100) {
            throw new Error(`获取的页面内容过短 (${html?.length || 0}字符)，可能是错误页面`);
          }
          
          console.log(`[UniversalParser] ✅ 成功获取播客页面 (${html.length}字符, 策略: ${strategy.name})`);
          
          // 成功获取，跳出所有循环
          lastError = null;
          break; // 跳出策略循环
        } catch (fetchError: any) {
          const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
          const fetchErrorName = fetchError instanceof Error ? fetchError.name : 'UnknownError';
          
          console.warn(`[UniversalParser] 策略 ${strategy.name} 失败:`, fetchErrorMessage);
          
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
      
      // 如果所有策略都失败，等待后重试（递增延迟：2s, 4s）
      if (attempt < maxRetries) {
        const delay = 2000 * attempt;
        console.log(`[UniversalParser] 所有策略都失败，等待 ${delay}ms 后重试...`);
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
      
      console.error(`[UniversalParser] ❌ 所有重试都失败，最终错误: ${detailedError}`);
      console.error(`[UniversalParser] 错误类型: ${errorName}`);
      throw new Error(detailedError);
    }
    
    return html;
  }

  private mergeResults(results: Partial<UniversalPodcastMeta>[]): UniversalPodcastMeta {
    const merged: UniversalPodcastMeta = {
      audioUrl: null,
      source: 'merged',
      confidence: 0,
    };
    
    // 按可信度排序
    const sortedResults = results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // 合并数据，优先使用高可信度的值
    for (const result of sortedResults) {
      for (const [key, value] of Object.entries(result)) {
        if (value && !merged[key as keyof UniversalPodcastMeta]) {
          (merged as any)[key] = value;
        }
      }
    }
    
    // 计算整体可信度
    merged.confidence = this.calculateOverallConfidence(sortedResults);
    
    return merged;
  }

  private calculateOverallConfidence(results: Partial<UniversalPodcastMeta>[]): number {
    if (results.length === 0) return 0;
    
    const weights = results.map(r => r.confidence || 0);
    const sum = weights.reduce((a, b) => a + b, 0);
    return Math.min(1, sum / results.length);
  }

  private postProcess(meta: UniversalPodcastMeta, url: string): UniversalPodcastMeta {
    // 标准化日期格式
    if (meta.publishedAt) {
      meta.publishedAt = this.normalizeDate(meta.publishedAt);
    }
    
    // 如果没有作者，使用播客标题作为作者
    if (!meta.author && meta.podcastTitle) {
      meta.author = meta.podcastTitle;
    }
    
    // 验证音频URL
    if (meta.audioUrl && !this.isValidAudioUrl(meta.audioUrl)) {
      meta.audioUrl = null;
    }
    
    // 确保 source 信息正确（如果 source 是 'merged'，根据 URL 判断平台）
    if (meta.source === 'merged' || !meta.source) {
      if (url.includes('podcasts.apple.com')) {
        meta.source = 'Apple Podcasts';
      } else if (url.includes('xiaoyuzhoufm.com')) {
        meta.source = '小宇宙';
      } else if (url.includes('ximalaya.com')) {
        meta.source = '喜马拉雅';
      } else {
        meta.source = 'Universal Parser';
      }
    }
    
    return meta;
  }

  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toISOString();
    } catch {
      return dateStr;
    }
  }

  private isValidAudioUrl(url: string): boolean {
    const audioExtensions = ['.m4a', '.mp3', '.aac', '.wav', '.ogg'];
    return audioExtensions.some(ext => url.toLowerCase().includes(ext));
  }
}

// 导出便捷函数
export async function parseUniversalPodcast(url: string): Promise<UniversalPodcastMeta> {
  const parser = new UniversalPodcastParser();
  return await parser.parsePodcast(url);
}
