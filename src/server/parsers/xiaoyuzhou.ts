import { HeadersInit } from "next/dist/server/web/spec-extension/adapters/headers";

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

export async function parseXiaoyuzhouEpisode(url: string): Promise<XiaoyuzhouEpisodeMeta> {
	const res = await fetch(url, { headers: DEFAULT_HEADERS as any });
	if (!res.ok) {
		return { audioUrl: null };
	}
	const html = await res.text();

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
}


