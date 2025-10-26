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
    
    // 递归搜索JSON结构
    const search = (obj: any, path: string[] = []): void => {
      if (!obj || typeof obj !== 'object') return;
      
      // 检查当前对象
      if (obj['@type'] === 'PodcastEpisode' || obj['@type'] === 'AudioObject') {
        if (obj.name && !result.title) result.title = obj.name;
        if (obj.description && !result.description) result.description = obj.description;
        if (obj.contentUrl && !result.audioUrl) result.audioUrl = obj.contentUrl;
        if (obj.datePublished && !result.publishedAt) result.publishedAt = obj.datePublished;
        
        // 处理partOfSeries
        if (obj.partOfSeries && typeof obj.partOfSeries === 'object') {
          if (obj.partOfSeries.name && !result.podcastTitle) {
            result.podcastTitle = obj.partOfSeries.name;
            if (!result.author) result.author = obj.partOfSeries.name;
          }
        }
      }
      
      if (obj['@type'] === 'PodcastSeries') {
        if (obj.name && !result.podcastTitle) {
          result.podcastTitle = obj.name;
          if (!result.author) result.author = obj.name;
        }
      }
      
      // 递归搜索子对象
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          search(value, [...path, key]);
        }
      }
    };
    
    search(json);
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
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
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
