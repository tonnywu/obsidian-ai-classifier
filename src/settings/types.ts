export type AIProviderType = 'ollama' | 'openai' | 'deepseek' | 'moonshot' | 'zhipu';

export interface CategoryTree {
	[name: string]: CategoryTree | boolean;
}

export interface PluginSettings {
	// AI 配置
	aiProvider: AIProviderType;
	ollamaUrl: string;
	ollamaModel: string;
	
	// OpenAI 配置
	openaiApiKey: string;
	openaiModel: string;
	openaiApiUrl: string;
	
	// DeepSeek 配置
	deepseekApiKey: string;
	deepseekModel: string;
	deepseekApiUrl: string;
	
	// Moonshot (Kimi) 配置
	moonshotApiKey: string;
	moonshotModel: string;
	moonshotApiUrl: string;
	
	// Zhipu (智谱 AI) 配置
	zhipuApiKey: string;
	zhipuModel: string;
	zhipuApiUrl: string;
	
	// 分类配置
	inboxFolder: string;
	categoryTree: CategoryTree;
	categories: string[];
	scanSubfolders: boolean;
	
	// 高级功能
	enableSuggestedCategories: boolean;
	autoMoveFile: boolean;
	confidenceThreshold: number;
	
	// 日志
	enableDebugLog: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	aiProvider: 'ollama',
	ollamaUrl: 'http://localhost:11434',
	ollamaModel: 'llama3.2',
	
	// OpenAI 默认配置
	openaiApiKey: '',
	openaiModel: 'gpt-4o-mini',
	openaiApiUrl: 'https://api.openai.com/v1',
	
	// DeepSeek 默认配置
	deepseekApiKey: '',
	deepseekModel: 'deepseek-chat',
	deepseekApiUrl: 'https://api.deepseek.com/v1',
	
	// Moonshot (Kimi) 默认配置
	moonshotApiKey: '',
	moonshotModel: 'moonshot-v1-8k',
	moonshotApiUrl: 'https://api.moonshot.cn/v1',
	
	// Zhipu (智谱) 默认配置
	zhipuApiKey: '',
	zhipuModel: 'glm-4',
	zhipuApiUrl: 'https://open.bigmodel.cn/api/paas/v4',
	
	inboxFolder: 'Inbox',
	categoryTree: {
		'Programming': {
			'Frontend': true,
			'Backend': true,
			'Mobile': true,
			'DevOps': true,
		},
		'AI & ML': {
			'Machine Learning': true,
			'Deep Learning': true,
			'NLP': true,
		},
		'Data': {
			'Database': true,
			'Data Engineering': true,
			'Analytics': true,
		},
		'Architecture': {
			'System Design': true,
			'Microservices': true,
		},
		'Other': true,
	},
	categories: [],
	scanSubfolders: true,
	
	enableSuggestedCategories: false,
	autoMoveFile: true,
	confidenceThreshold: 0.7,
	
	enableDebugLog: false,
};

export interface ClassificationResult {
	category: string;
	confidence: number;
	reasoning: string;
	isUncertain: boolean;
	suggestedCategory?: string;
}

export interface AIProvider {
	name: string;
	testConnection(): Promise<{ success: boolean; message: string }>;
	classify(content: string, title: string, categories: string[]): Promise<ClassificationResult>;
}
