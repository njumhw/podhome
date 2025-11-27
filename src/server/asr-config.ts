/**
 * ASR配置常量
 * 独立文件，避免循环依赖
 */

// 阿里云ASR服务配置
export const ASR_CONFIG = {
	// 阿里云ASR API配置
	region: 'cn-shanghai', // 根据你的服务区域调整
	endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
	version: '2019-02-28',
	
	// 音频限制
    maxDuration: 120, // 120秒切片（与清洗块策略匹配）
	maxFileSize: 10 * 1024 * 1024, // 10MB
	supportedFormats: ['m4a', 'mp3', 'wav', 'aac'],
	
	// 转写参数
	enablePunctuation: true,
	enableWordTime: true,
	enableSpeakerDiarization: true, // 说话人分离
};



