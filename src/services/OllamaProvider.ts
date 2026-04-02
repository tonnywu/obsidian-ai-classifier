import { AIProvider, ClassificationResult } from '../settings/types';
import { PluginSettings } from '../settings/types';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from './prompts';
import { Logger } from '../utils/logger';
import { withRetry, fetchWithTimeout, getUserFriendlyMessage, validateUrl } from '../utils/errorHandler';

export class OllamaProvider implements AIProvider {
	name = 'Ollama';
	private settings: PluginSettings;
	private logger: Logger;
	
	constructor(settings: PluginSettings, logger: Logger) {
		this.settings = settings;
		this.logger = logger;
	}
	
	async testConnection(): Promise<{ success: boolean; message: string }> {
		try {
			// 验证 URL 格式
			validateUrl(this.settings.ollamaUrl, 'Ollama 地址');
			
			// 使用带超时的 fetch
			const response = await fetchWithTimeout(
				`${this.settings.ollamaUrl}/api/tags`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				},
				10000 // 10 秒超时
			);
			
			if (response.ok) {
				return { success: true, message: 'Ollama 服务正常' };
			} else {
				return { success: false, message: `HTTP ${response.status}` };
			}
		} catch (e) {
			const message = getUserFriendlyMessage(e as Error);
			return { success: false, message };
		}
	}
	
	async classify(content: string, title: string, categories: string[]): Promise<ClassificationResult> {
		// 使用带重试的操作
		return await withRetry(
			async () => {
				const userPrompt = USER_PROMPT_TEMPLATE
					.replace('{{TITLE}}', title)
					.replace('{{CONTENT}}', content.slice(0, 4000))
					.replace('{{CATEGORIES}}', categories.map(c => `- ${c}`).join('\n'));
				
				// 使用带超时的 fetch
				const response = await fetchWithTimeout(
					`${this.settings.ollamaUrl}/api/generate`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model: this.settings.ollamaModel,
							prompt: `<|im_start|>system\n${SYSTEM_PROMPT}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>`,
							stream: false,
							options: {
								temperature: 0.3,
								num_predict: 500,
							},
						}),
					},
					60000 // 60 秒超时（Ollama 可能较慢）
				);
				
				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.error || `Ollama API 错误: ${response.status}`);
				}
				
				const data = await response.json();
				return this.parseResponse(data.response);
			},
			{
				maxAttempts: 3,
				initialDelay: 2000,
			},
			'Ollama classify'
		);
	}
	
	private parseResponse(response: string): ClassificationResult {
		// 尝试从响应中提取 JSON
		const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/(\{[\s\S]*\})/);
		
		if (jsonMatch) {
			try {
				const parsed = JSON.parse(jsonMatch[1]);
				return {
					category: parsed.category || 'Other',
					confidence: parsed.confidence || 0.5,
					reasoning: parsed.reasoning || '',
					isUncertain: parsed.isUncertain || false,
					suggestedCategory: parsed.suggestedCategory,
				};
			} catch {
				this.logger.debug('JSON 解析失败，使用文本解析');
			}
		}
		
		// 备用解析：提取第一个分类路径
		const categoryMatch = response.match(/category[\s:]+["']?([^\n"']+)/i);
		const confidenceMatch = response.match(/confidence[\s:]+([0-9.]+)/i);
		
		return {
			category: categoryMatch ? categoryMatch[1].trim() : 'Other',
			confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
			reasoning: response.slice(0, 200),
			isUncertain: false,
		};
	}
}
