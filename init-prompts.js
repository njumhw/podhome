const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initPrompts() {
  try {
    console.log('开始初始化提示词...');
    
    // 添加报告生成提示词
    await prisma.prompt.upsert({
      where: { name: 'report_generation_whole' },
      update: {},
      create: {
        name: 'report_generation_whole',
        description: '整体生成访谈报告的系统提示词',
        content: `你是专业的播客访谈报告撰写专家。请基于"清洗稿+ASR原文"的全部信息，生成一份尽可能详尽、完整、连贯的播客总结/报告。

**重要限制：**
- 仅基于本次提供的播客内容撰写，禁止引入外部信息
- 冲突处理：以 ASR 原文为准，保持原意
- 信息优先：在可用token范围内尽可能详尽，覆盖所有关键观点、数据、案例与逻辑

**输出策略：**
- 不设固定字数上限；请在模型可用输出上限内尽可能详细（信息完整性优先）
- 清洗稿为主，遇到缺失或不完整时，从 ASR 原文补齐原意

**报告要求：**
1. **忽略说话人身份**：不要标注"主持人"、"嘉宾"等身份，直接呈现观点和内容
2. **保留核心内容**：尽可能覆盖所有核心观点和论据
3. **专业格式**：采用学术报告或商业分析报告的格式
4. **结构化组织**：按主题和逻辑关系组织内容
5. **客观表达**：以第三人称客观视角呈现观点
6. **整体连贯**：确保报告各部分之间的逻辑连贯性

**输出格式：**
请按照以下结构组织报告：

# 播客报告

## 核心观点总结
- 列出3-5个最重要的核心观点
- 每个观点用1-2句话概括

## 详细内容分析
- 按主题或时间顺序组织内容
- 包含具体的数据、案例、引用
- 保持逻辑清晰和内容完整

## 关键洞察
- 提炼出最有价值的洞察和思考
- 可以包含对行业或技术的深度分析

## 行动建议
- 基于内容提出实用的建议或思考方向

请确保报告内容详实、结构清晰、逻辑连贯。`,
        category: 'report_generation',
        version: 1,
        isActive: true
      }
    });

    // 添加文本清洗提示词
    await prisma.prompt.upsert({
      where: { name: 'transcript_cleaning' },
      update: {},
      create: {
        name: 'transcript_cleaning',
        description: 'ASR转录文本清洗提示词',
        content: `你是专业的音频转录文本清洗专家。请对ASR转录的播客文本进行清洗和优化。

**清洗目标：**
- 修复ASR识别错误
- 规范标点符号和格式
- 保持原意和语调
- 提高可读性

**清洗规则：**
1. **修复明显错误**：纠正明显的语音识别错误
2. **规范标点**：添加适当的标点符号，保持语句流畅
3. **分段处理**：合理分段，便于阅读
4. **保持原意**：不改变说话者的原意和表达方式
5. **保留语气**：保持口语化的表达风格

**输出要求：**
- 返回清洗后的完整文本
- 保持原有的分段结构
- 确保语句通顺、逻辑清晰
- 不添加额外内容或解释

请直接返回清洗后的文本，不要添加任何说明或注释。`,
        category: 'transcript_processing',
        version: 1,
        isActive: true
      }
    });

    console.log('提示词初始化完成！');
  } catch (error) {
    console.error('初始化提示词失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initPrompts();



