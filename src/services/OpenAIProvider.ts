import { AIProvider, ClassificationResult } from '../settings/types';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from './prompts';
import { Logger } from '../utils/logger';
import { withRetry, fetchWithTimeout, getUserFriendlyMessage, validateUrl } from '../utils/errorHandler';

interface ProviderConfig {
	name: string;
	apiKey: string;
	model: string;
	baseUrl: string;
}

export class OpenAICompatibleProvider implements AIProvider {
	name: string;
	private config: ProviderConfig;
	private logger: Logger;
	
	constructor(config: ProviderConfig, logger: Logger) {
		this.name = config.name;
		this.config = config;
		this.logger = logger;
	}
	
	async testConnection(): Promise<{ success: boolean; message: string }> {
		try {
			// 验证 API Key
			if (!this.config.apiKey || this.config.apiKey.trim() === '') {
				return { success: false, message: 'API Key 未设置，请先配置 API Key' };
			}
			
			// 验证 URL
			validateUrl(this.config.baseUrl, 'API 地址');
			
			// 使用带超时的 fetch
			const response = await fetchWithTimeout(
				`${this.config.baseUrl}/models`,
				{
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${this.config.apiKey}`,
					},
				},
				10000 // 10 秒超时
			);
			
			if (response.ok) {
				return { success: true, message: `${this.name} API 连接正常` };
			} else if (response.status === 401) {
				return { success: false, message: 'API Key 无效或未授权，请检查是否正确' };
			} else {
				return { success: false, message: `HTTP ${response.status}: 服务暂时不可用` };
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
					`${this.config.baseUrl}/chat/completions`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${this.config.apiKey}`,
						},
						body: JSON.stringify({
							model: this.config.model,
							messages: [
								{ role: 'system', content: SYSTEM_PROMPT },
								{ role: 'user', content: userPrompt },
							],
							temperature: 0.3,
							max_tokens: 500,
							response_format: { type: 'json_object' },
						}),
					},
					30000 // 30 秒超时
				);
				
				if (!response.ok) {
					const error = await response.json().catch(() => ({}));
					const errorMsg = error.error?.message || `HTTP ${response.status}`;
					
					// 构造更详细的错误
					const enhancedError = new Error(errorMsg) as any;
					enhancedError.status = response.status;
					enhancedError.response = { 
						status: response.status,
						headers: response.headers,
					};
					throw enhancedError;
				}
				
				const data = await response.json();
				const resultText = data.choices[0]?.message?.content || '{}';
				
				return this.parseResponse(resultText);
			},
			{
				maxAttempts: 3,
				initialDelay: 1500,
			},
			`${this.name} classify`
		);
	}
	
	private parseResponse(responseText: string): ClassificationResult {
		try {
			const parsed = JSON.parse(responseText);
			return {
				category: parsed.category || 'Other',
				confidence: parsed.confidence || 0.5,
				reasoning: parsed.reasoning || '',
				isUncertain: parsed.isUncertain || false,
				suggestedCategory: parsed.suggestedCategory,
			};
		} catch {
			this.logger.debug('JSON 解析失败');
			return {
				category: 'Other',
				confidence: 0.5,
				reasoning: responseText.slice(0, 200),
				isUncertain: true,
			};
		}
	}
}
