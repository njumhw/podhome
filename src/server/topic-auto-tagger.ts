/**
 * 基于规则的自动主题标注系统
 * 通过关键词匹配、URL模式、作者匹配等方式自动为播客分配主题
 */

import { db } from './db';

export interface AutoTagRule {
  topicName: string;
  priority: number; // 优先级，数字越大优先级越高
  rules: {
    // 关键词匹配（标题、描述、摘要）
    keywords?: {
      title?: string[];      // 标题关键词
      description?: string[]; // 描述关键词
      summary?: string[];     // 摘要关键词
      transcript?: string[];  // 转录稿关键词
      all?: string[];         // 任意字段关键词
    };
    // URL模式匹配
    urlPatterns?: RegExp[];
    // 作者匹配
    authors?: string[];
    // 来源平台匹配
    sources?: string[];
  };
}

/**
 * 预定义的自动标注规则
 * 优先级：数字越大优先级越高（100为最高）
 * 
 * 标签列表（9个）：
 * 1. 科技（AI + 科技合并，最高优先级）
 * 2. 管理
 * 3. 投资
 * 4. 商业
 * 5. 教育
 * 6. 文化
 * 7. 健康
 * 8. 生命
 * 9. 生活
 */
const AUTO_TAG_RULES: AutoTagRule[] = [
  {
    topicName: '科技',
    priority: 100, // 最高优先级
    rules: {
      keywords: {
        // 合并AI和科技的关键词
        all: [
          // AI相关
          'AI', '人工智能', '机器学习', '深度学习', 'GPT', 'LLM', '大模型', '算法', '神经网络', 'Transformer',
          // 科技相关
          '科技', '技术', '编程', '代码', '开发', '软件', '硬件', '互联网', '数字化', '区块链', '加密货币', 
          '元宇宙', 'VR', 'AR', '5G', '芯片', '半导体', '计算机', '数据科学', '云计算'
        ],
        title: ['AI', '人工智能', '机器学习', '科技', '技术', '编程', '开发', 'GPT', 'LLM'],
      },
      urlPatterns: [
        /xiaoyuzhou\.fm\/episode\/.*科技/i,
        /xiaoyuzhou\.fm\/episode\/.*技术/i,
        /xiaoyuzhou\.fm\/episode\/.*AI/i,
      ],
    },
  },
  {
    topicName: '管理',
    priority: 90,
    rules: {
      keywords: {
        all: ['管理', '领导力', '组织', '团队', 'CEO', '战略', '运营', '效率', '决策', '管理方法', '组织管理', '团队管理', '领导', '管理者'],
        title: ['管理', '领导力', '组织', '团队', 'CEO', '战略'],
      },
    },
  },
  {
    topicName: '投资',
    priority: 80,
    rules: {
      keywords: {
        all: ['投资', '理财', '股票', '基金', '债券', '期货', '资产配置', '财务自由', '财富管理', '投资策略', '价值投资', '量化投资', 'A股', '港股', '美股', '投资组合', '投资分析'],
        title: ['投资', '理财', '股票', '基金', '资产配置'],
      },
    },
  },
  {
    topicName: '商业',
    priority: 70,
    rules: {
      keywords: {
        all: ['商业', '创业', '商业模式', '市场', '营销', '品牌', '企业家', '公司', '企业', '商业分析', '商业案例', '创业公司', '融资', '商业策略', '市场分析'],
        title: ['商业', '创业', '商业模式', '营销', '品牌'],
      },
      authors: ['商业', '创业'],
    },
  },
  {
    topicName: '教育',
    priority: 50,
    rules: {
      keywords: {
        // 收紧关键词，移除过于通用的词
        all: ['教育', '学习', '课程', '培训', '在线教育', '教育理念', '学习方法', '教学', '教育方法'],
        title: ['教育', '学习', '课程', '培训'],
      },
    },
  },
  {
    topicName: '文化',
    priority: 40,
    rules: {
      keywords: {
        all: ['文化', '历史', '文学', '艺术', '哲学', '思想', '传统', '古典', '现代', '当代', '人文', '社会', '文明', '文化研究'],
        title: ['文化', '历史', '文学', '艺术', '哲学'],
      },
    },
  },
  {
    topicName: '健康',
    priority: 30,
    rules: {
      keywords: {
        all: ['健康', '医疗', '养生', '运动', '健身', '营养', '饮食', '心理', '心理健康', '疾病', '治疗', '医学', '健康管理', '运动健身'],
        title: ['健康', '医疗', '养生', '运动', '健身'],
      },
    },
  },
  {
    topicName: '生命',
    priority: 20,
    rules: {
      keywords: {
        all: ['生命', '生物', '生命科学', '生物学', '基因', '细胞', '进化', '科学', '医学研究', '生物技术', '生命研究'],
        title: ['生命', '生物', '生命科学', '基因', '细胞'],
      },
    },
  },
  {
    topicName: '生活',
    priority: 10,
    rules: {
      keywords: {
        all: ['生活', '生活方式', '日常', '习惯', '时间管理', '效率', '极简', '断舍离', '整理', '收纳', '生活哲学'],
        title: ['生活', '生活方式', '日常', '时间管理'],
      },
    },
  },
];

/**
 * 检查文本是否包含关键词
 */
function containsKeywords(text: string | null | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * 统计关键词匹配次数
 */
function countKeywordMatches(text: string | null | undefined, keywords: string[]): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    return lowerText.includes(keyword.toLowerCase()) ? count + 1 : count;
  }, 0);
}

/**
 * 检查URL是否匹配模式
 */
function matchesUrlPattern(url: string | null | undefined, patterns: RegExp[]): boolean {
  if (!url) return false;
  return patterns.some(pattern => pattern.test(url));
}

/**
 * 检查作者是否匹配
 */
function matchesAuthor(author: string | null | undefined, authors: string[]): boolean {
  if (!author) return false;
  const lowerAuthor = author.toLowerCase();
  return authors.some(a => lowerAuthor.includes(a.toLowerCase()));
}

/**
 * 为播客自动标注主题（只返回1个标签）
 * @param podcast 播客数据
 * @returns 匹配的主题名称，如果没有匹配则返回 null
 */
function calculateRuleScore(
  podcast: {
    title: string;
    sourceUrl?: string | null;
    description?: string | null;
    showAuthor?: string | null;
    summary?: string | null;
    originalTranscript?: string | null;
  },
  rule: AutoTagRule
): number {
  const { keywords, urlPatterns, authors, sources } = rule.rules;
  let score = 0;

  if (keywords) {
    if (keywords.all && keywords.all.length) {
      const matches =
        countKeywordMatches(podcast.title, keywords.all) +
        countKeywordMatches(podcast.description, keywords.all) +
        countKeywordMatches(podcast.summary, keywords.all) +
        countKeywordMatches(podcast.originalTranscript, keywords.all);
      score += matches * 1.5;
    }

    if (keywords.title && keywords.title.length) {
      score += countKeywordMatches(podcast.title, keywords.title) * 3;
    }

    if (keywords.description && keywords.description.length) {
      score += countKeywordMatches(podcast.description, keywords.description) * 2;
    }

    if (keywords.summary && keywords.summary.length) {
      score += countKeywordMatches(podcast.summary, keywords.summary) * 2;
    }

    if (keywords.transcript && keywords.transcript.length) {
      score += countKeywordMatches(podcast.originalTranscript, keywords.transcript);
    }
  }

  if (urlPatterns && urlPatterns.length && matchesUrlPattern(podcast.sourceUrl, urlPatterns)) {
    score += 4;
  }

  if (authors && authors.length && matchesAuthor(podcast.showAuthor, authors)) {
    score += 3;
  }

  if (sources && sources.length && podcast.sourceUrl) {
    const urlLower = podcast.sourceUrl.toLowerCase();
    if (sources.some(source => urlLower.includes(source.toLowerCase()))) {
      score += 2;
    }
  }

  return score;
}

export async function autoTagPodcast(
  podcast: {
    title: string;
    sourceUrl?: string | null;
    description?: string | null;
    showAuthor?: string | null;
    summary?: string | null;
    originalTranscript?: string | null;
  }
): Promise<string | null> {
  // 获取所有已审核的主题
  const approvedTopics = await db.topic.findMany({
    where: { approved: true },
    select: { name: true },
  });
  
  const approvedTopicNames = new Set(approvedTopics.map(t => t.name));
  
  let bestMatch: { topicName: string; score: number } | null = null;

  for (const rule of AUTO_TAG_RULES) {
    if (!approvedTopicNames.has(rule.topicName)) continue;

    const score = calculateRuleScore(podcast, rule);

    if (score <= 0) continue;

    const weightedScore = score + rule.priority * 0.01;

    if (!bestMatch || weightedScore > bestMatch.score) {
      bestMatch = { topicName: rule.topicName, score: weightedScore };
    }
  }

  return bestMatch ? bestMatch.topicName : null;
}

/**
 * 批量自动标注播客（只标注1个标签）
 * @param podcastIds 播客ID数组，如果为空则处理所有播客（包括已有标签的）
 * @param dryRun 是否只是预览，不实际更新数据库
 * @returns 标注结果统计
 */
export async function batchAutoTagPodcasts(
  podcastIds?: string[],
  dryRun: boolean = false
): Promise<{
  total: number;
  tagged: number;
  skipped: number;
  results: Array<{ podcastId: string; title: string; topicName: string | null }>;
}> {
  const whereClause: any = podcastIds 
    ? { id: { in: podcastIds }, status: 'READY' as any }
    : { status: 'READY' as any }; // 处理所有已就绪的播客（包括已有标签的）
  
  const podcasts = await db.podcast.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      description: true,
      showAuthor: true,
      summary: true,
      originalTranscript: true,
      topicId: true,
    },
  });
  
  const results: Array<{ podcastId: string; title: string; topicName: string | null }> = [];
  let tagged = 0;
  let skipped = 0;
  
  for (const podcast of podcasts) {
    const topicName = await autoTagPodcast({
      title: podcast.title,
      sourceUrl: podcast.sourceUrl,
      description: podcast.description,
      showAuthor: podcast.showAuthor,
      summary: podcast.summary,
      originalTranscript: podcast.originalTranscript,
    });
    
    results.push({
      podcastId: podcast.id,
      title: podcast.title,
      topicName,
    });
    
    if (topicName) {
      // 查找主题ID
      const topic = await db.topic.findUnique({
        where: { name: topicName },
        select: { id: true },
      });
      
      if (topic && !dryRun) {
        // 无论是否已有标签，都更新（允许重新标注）
        await db.podcast.update({
          where: { id: podcast.id },
          data: { topicId: topic.id },
        });
        tagged++;
      } else if (topic) {
        tagged++;
      }
    } else {
      skipped++;
    }
  }
  
  return {
    total: podcasts.length,
    tagged,
    skipped,
    results,
  };
}

