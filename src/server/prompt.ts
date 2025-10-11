export function buildSpeakerIdentificationPrompt(cleanedTranscript: string) {
	return `任务：根据逐字稿内容推断说话人姓名，并用姓名替换 Speaker 标签。
规则：
- 仅基于逐字稿信息判断，不得编造。
- 若能从自我介绍或上下文推断姓名（或常用称呼），替换相应的 SpeakerX 为该姓名。
- 无法判断的保留原 SpeakerX。
- 保持原文顺序与段落，仅替换说话人标签，不改动其余文本。

输入逐字稿：\n${cleanedTranscript}`;
}

export function buildSummaryPrompt(text: string) {
	return `任务：为以下内容生成“快速浏览”总结，保留核心论点与论据，不是逐字稿的精简。
- 用条目化结构输出，语言简洁。
- 不得虚构未出现的信息。

输入：\n${text}`;
}
