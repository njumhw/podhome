// import { HeadersInit } from "next/dist/server/web/spec-extension/adapters/headers";

export type StablePodcastMeta = {
  audioUrl: string | null;
  title?: string | null;
  podcastTitle?: string | null;
  author?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  confidence: number; // 数据可信度 0-1
  extractionMethod: string; // 提取方法
};

const DEFAULT_HEADERS: HeadersInit = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};

/**
 * 稳定的播客解析器 - 使用多重验证和缓存机制
 */
export class StablePodcastParser {
  private cache = new Map<string, { data: StablePodcastMeta; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

  async parsePodcast(url: string): Promise<StablePodcastMeta> {
    // 检查缓存
    const cached = this.getCachedResult(url);
    if (cached) {
      return { ...cached, extractionMethod: 'cache' };
    }

    try {
      // 多次尝试解析，提高稳定性
      const results = await this.multiAttemptParse(url);
      
      // 选择最佳结果
      const bestResult = this.selectBestResult(results);
      
      // 缓存结果
      this.cacheResult(url, bestResult);
      
      return bestResult;
      
    } catch (error) {
      console.error('Stable podcast parsing failed:', error);
      return {
        audioUrl: null,
        confidence: 0,
        extractionMethod: 'error',
      };
    }
  }

  private async multiAttemptParse(url: string): Promise<StablePodcastMeta[]> {
    const results: StablePodcastMeta[] = [];
    
    // 尝试3次解析
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`解析尝试 ${attempt}/3: ${url}`);
        
        const html = await this.fetchHtmlWithRetry(url, attempt);
        const result = this.extractFromHtml(html, url, attempt);
        
        if (result.confidence > 0) {
          results.push(result);
        }
        
        // 如果结果很好，可以提前结束
        if (result.confidence >= 0.8) {
          break;
        }
        
        // 间隔重试
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
        
      } catch (error) {
        console.warn(`解析尝试 ${attempt} 失败:`, error);
      }
    }
    
    return results;
  }

  private async fetchHtmlWithRetry(url: string, attempt: number): Promise<string> {
    const timeout = 5000 + (attempt * 2000); // 递增超时时间
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private extractFromHtml(html: string, url: string, attempt: number): StablePodcastMeta {
    const result: StablePodcastMeta = {
      audioUrl: null,
      confidence: 0,
      extractionMethod: `attempt-${attempt}`,
    };

    // 1. 优先使用JSON-LD结构化数据（最可靠）
    const jsonLdResult = this.extractFromJsonLd(html);
    if (jsonLdResult.confidence && jsonLdResult.confidence > 0) {
      Object.assign(result, jsonLdResult);
    }

    // 2. 使用Meta标签（中等可靠性）
    if (result.confidence < 0.8) {
      const metaResult = this.extractFromMetaTags(html);
      this.mergeResults(result, metaResult);
    }

    // 3. 使用DOM结构（较低可靠性）
    if (result.confidence < 0.6) {
      const domResult = this.extractFromDom(html);
      this.mergeResults(result, domResult);
    }

    // 4. 平台特定逻辑
    const platformResult = this.extractPlatformSpecific(html, url);
    this.mergeResults(result, platformResult);

    // 5. 如果还没有音频URL，尝试从页面内容中提取
    if (!result.audioUrl) {
      const audioUrlMatch = html.match(/https?:\/\/[^\s"']+\.(m4a|mp3|aac)(\?[^\s"']*)?/i);
      if (audioUrlMatch) {
        result.audioUrl = audioUrlMatch[0];
        // 降低可信度，因为这是从页面内容中提取的
        if (result.confidence > 0.8) {
          result.confidence = 0.8;
        }
      }
    }

    // 后处理
    this.postProcess(result);

    return result;
  }

  private extractFromJsonLd(html: string): Partial<StablePodcastMeta> {
    const result: Partial<StablePodcastMeta> = { confidence: 0 };
    
    try {
      const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      
      while ((match = ldRe.exec(html))) {
        try {
          const jsonData = JSON.parse(match[1]);
          const extracted = this.parseJsonLdObject(jsonData);
          
          if (extracted.confidence && result.confidence && extracted.confidence > result.confidence) {
            Object.assign(result, extracted);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    } catch (e) {
      console.warn('JSON-LD extraction failed:', e);
    }
    
    return result;
  }

  private parseJsonLdObject(obj: any): Partial<StablePodcastMeta> {
    const result: Partial<StablePodcastMeta> = { confidence: 0 };
    
    if (!obj || typeof obj !== 'object') return result;
    
    // 检查是否是播客相关对象
    const isPodcastRelated = obj['@type'] === 'PodcastEpisode' || 
                           obj['@type'] === 'AudioObject' ||
                           obj['@type'] === 'PodcastSeries';
    
    if (isPodcastRelated) {
      result.confidence = 0.9;
      
      if (obj.name && !result.title) result.title = obj.name;
      if (obj.description && !result.description) result.description = obj.description;
      if (obj.contentUrl && !result.audioUrl) result.audioUrl = obj.contentUrl;
      
      // 增强发布时间提取
      if (!result.publishedAt) {
        const dateFields = ['datePublished', 'uploadDate', 'pubDate', 'publishedAt', 'publishAt'];
        for (const field of dateFields) {
          if (obj[field]) {
            result.publishedAt = obj[field];
            break;
          }
        }
      }
      
      // 增强作者提取
      if (!result.author) {
        // 直接作者字段
        if (typeof obj.author === 'string') {
          result.author = obj.author;
        } else if (obj.author && typeof obj.author === 'object' && obj.author.name) {
          result.author = obj.author.name;
        }
        
        // 创建者字段
        if (!result.author && typeof obj.creator === 'string') {
          result.author = obj.creator;
        } else if (!result.author && obj.creator && typeof obj.creator === 'object' && obj.creator.name) {
          result.author = obj.creator.name;
        }
      }
      
      // 处理partOfSeries
      if (obj.partOfSeries && typeof obj.partOfSeries === 'object') {
        if (obj.partOfSeries.name) {
          result.podcastTitle = obj.partOfSeries.name;
          // 优先使用播客节目名作为作者
          if (!result.author) result.author = obj.partOfSeries.name;
        }
      }
    }
    
    // 递归搜索子对象
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        const childResult = this.parseJsonLdObject(value);
        if (childResult.confidence && result.confidence && childResult.confidence > result.confidence) {
          Object.assign(result, childResult);
        }
      }
    }
    
    return result;
  }

  private extractFromMetaTags(html: string): Partial<StablePodcastMeta> {
    const result: Partial<StablePodcastMeta> = { confidence: 0.7 };
    
    const metaPatterns = [
      { name: 'og:title', target: 'title' },
      { name: 'og:description', target: 'description' },
      { name: 'og:audio', target: 'audioUrl' },
      { name: 'article:published_time', target: 'publishedAt' },
      { name: 'og:published_time', target: 'publishedAt' },
      { name: 'og:updated_time', target: 'publishedAt' },
      { name: 'article:modified_time', target: 'publishedAt' },
      { name: 'author', target: 'author' },
      { name: 'article:author', target: 'author' },
      { name: 'og:article:author', target: 'author' },
      { name: 'byl', target: 'author' },
      { name: 'og:site_name', target: 'podcastTitle' },
    ];
    
    for (const pattern of metaPatterns) {
      const value = this.getMetaContent(html, pattern.name);
      if (value && !result[pattern.target as keyof StablePodcastMeta]) {
        (result as any)[pattern.target] = value;
      }
    }
    
    return result;
  }

  private extractFromDom(html: string): Partial<StablePodcastMeta> {
    const result: Partial<StablePodcastMeta> = { confidence: 0.5 };
    
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

  private extractPlatformSpecific(html: string, url: string): Partial<StablePodcastMeta> {
    const result: Partial<StablePodcastMeta> = { confidence: 0.6 };
    
    // 小宇宙特定逻辑
    if (url.includes('xiaoyuzhoufm.com')) {
      // 提取小宇宙特有的时间格式
      if (!result.publishedAt) {
        // 匹配 "1 天前" 格式
        const relativeTimeMatch = html.match(/(\d+)\s*(天|小时|分钟)前/);
        if (relativeTimeMatch) {
          const value = parseInt(relativeTimeMatch[1]);
          const unit = relativeTimeMatch[2];
          const now = new Date();
          
          if (unit === '天') {
            now.setDate(now.getDate() - value);
          } else if (unit === '小时') {
            now.setHours(now.getHours() - value);
          } else if (unit === '分钟') {
            now.setMinutes(now.getMinutes() - value);
          }
          
          result.publishedAt = now.toISOString();
        }
      }
      
      // 提取小宇宙特有的播客标题（从页面结构中）
      if (!result.podcastTitle) {
        const podcastTitleMatch = html.match(/<a[^>]*class=["'][^"']*podcast[^"']*["'][^>]*>([^<]+)<\/a>/i);
        if (podcastTitleMatch) {
          result.podcastTitle = this.cleanText(podcastTitleMatch[1]);
          if (!result.author) {
            result.author = result.podcastTitle;
          }
        }
      }
    }
    
    return result;
  }

  private mergeResults(target: StablePodcastMeta, source: Partial<StablePodcastMeta>): void {
    // 只合并更高质量的数据
    if ((source.confidence || 0) > target.confidence) {
      target.confidence = source.confidence || 0;
    }
    
    for (const [key, value] of Object.entries(source)) {
      if (value && !target[key as keyof StablePodcastMeta]) {
        (target as any)[key] = value;
      }
    }
  }

  private postProcess(result: StablePodcastMeta): void {
    // 标准化日期格式
    if (result.publishedAt) {
      result.publishedAt = this.normalizeDate(result.publishedAt);
    }
    
    // 如果没有作者，使用播客标题作为作者
    if (!result.author && result.podcastTitle) {
      result.author = result.podcastTitle;
    }
    
    // 验证音频URL
    if (result.audioUrl && !this.isValidAudioUrl(result.audioUrl)) {
      result.audioUrl = null;
    }
    
    // 数据完整性检查，调整可信度
    let completenessScore = 0;
    if (result.audioUrl) completenessScore += 0.3;
    if (result.title) completenessScore += 0.2;
    if (result.author) completenessScore += 0.2;
    if (result.publishedAt) completenessScore += 0.2;
    if (result.description) completenessScore += 0.1;
    
    // 如果数据不完整，降低可信度
    if (completenessScore < 0.5) {
      result.confidence = Math.max(0, result.confidence - 0.2);
    } else {
      result.confidence = Math.min(1, result.confidence + 0.2);
    }
    
    // 如果缺少关键信息，进一步降低可信度
    if (!result.audioUrl || !result.title) {
      result.confidence = Math.max(0, result.confidence - 0.5);
    }
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

  private getCachedResult(url: string): StablePodcastMeta | null {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private cacheResult(url: string, data: StablePodcastMeta): void {
    this.cache.set(url, {
      data,
      timestamp: Date.now(),
    });
  }

  private selectBestResult(results: StablePodcastMeta[]): StablePodcastMeta {
    if (results.length === 0) {
      return {
        audioUrl: null,
        confidence: 0,
        extractionMethod: 'no-results',
      };
    }
    
    // 选择可信度最高的结果
    const best = results.reduce((prev, current) => 
      current.confidence > prev.confidence ? current : prev
    );
    
    return best;
  }
}

// 导出便捷函数
export async function parseStablePodcast(url: string): Promise<StablePodcastMeta> {
  const parser = new StablePodcastParser();
  return await parser.parsePodcast(url);
}
