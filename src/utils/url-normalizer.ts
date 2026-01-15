/**
 * URL标准化工具
 * 用于统一处理播客URL，确保相同内容的URL被视为同一个
 */

/**
 * 标准化小宇宙播客URL
 * 移除查询参数（如 ?s=...），因为这些参数不影响播客内容
 * 
 * @param url 原始URL
 * @returns 标准化后的URL
 */
export function normalizeXiaoyuzhouUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // 如果是小宇宙的episode链接，移除所有查询参数
    if (urlObj.hostname.includes('xiaoyuzhoufm.com') && urlObj.pathname.includes('/episode/')) {
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    }
    
    // 其他URL保持原样
    return url;
  } catch (error) {
    // 如果URL解析失败，返回原URL
    console.warn(`[normalizeXiaoyuzhouUrl] URL解析失败: ${url}`, error);
    return url;
  }
}

/**
 * 标准化播客URL（通用函数）
 * 根据不同的播客平台进行相应的标准化处理
 * 
 * @param url 原始URL
 * @returns 标准化后的URL
 */
export function normalizePodcastUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  // 去除首尾空格
  let normalized = url.trim();
  
  // 小宇宙URL标准化
  if (normalized.includes('xiaoyuzhoufm.com')) {
    normalized = normalizeXiaoyuzhouUrl(normalized);
  }
  
  // 可以在这里添加其他平台的标准化逻辑
  // 例如：Apple Podcasts、喜马拉雅等
  
  return normalized;
}
