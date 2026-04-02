/**
 * 错误处理工具
 * 提供统一的错误类型和处理方法
 */

/**
 * 自定义错误类型
 */
export class AIClassifierError extends Error {
	constructor(
		message: string,
		public type: 'network' | 'timeout' | 'auth' | 'rate_limit' | 'validation' | 'parse' | 'unknown',
		public originalError?: Error
	) {
		super(message);
		this.name = 'AIClassifierError';
	}
}

/**
 * 重试配置
 */
interface RetryConfig {
	maxAttempts: number;
	initialDelay: number;
	maxDelay: number;
	backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	initialDelay: 1000, // 1 秒
	maxDelay: 10000, // 10 秒
	backoffFactor: 2, // 指数退避
};

/**
 * 带重试的异步操作
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	config: Partial<RetryConfig> = {},
	operationName = 'operation'
): Promise<T> {
	const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
	let lastError: Error | undefined;
	
	for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			
			// 如果是认证错误，不重试
			if (isAuthError(error)) {
				throw new AIClassifierError(
					'API Key 无效或未授权',
					'auth',
					lastError
				);
			}
			
			// 如果是限流错误，等待更长时间
			if (isRateLimitError(error)) {
				const waitTime = getRateLimitWaitTime(error) || finalConfig.maxDelay;
				console.warn(`[${operationName}] 遇到限流，等待 ${waitTime}ms 后重试...`);
				await sleep(waitTime);
				continue;
			}
			
			// 如果是网络错误且不是最后一次尝试，等待后重试
			if (attempt < finalConfig.maxAttempts && isRetryableError(error)) {
				const delay = calculateDelay(attempt, finalConfig);
				console.warn(`[${operationName}] 尝试 ${attempt}/${finalConfig.maxAttempts} 失败，${delay}ms 后重试...`);
				await sleep(delay);
				continue;
			}
			
			// 最后一次尝试失败，抛出错误
			throw classifyError(error);
		}
	}
	
	throw classifyError(lastError!);
}

/**
 * 判断是否为可重试错误
 */
function isRetryableError(error: any): boolean {
	const message = error?.message?.toLowerCase() || '';
	const status = error?.status || error?.response?.status;
	
	// 网络错误
	if (message.includes('network') || message.includes('fetch') || message.includes('enotfound')) {
		return true;
	}
	
	// 服务器错误 (5xx)
	if (status >= 500 && status < 600) {
		return true;
	}
	
	// 超时错误
	if (message.includes('timeout') || message.includes('etimedout')) {
		return true;
	}
	
	return false;
}

/**
 * 判断是否为认证错误
 */
function isAuthError(error: any): boolean {
	const status = error?.status || error?.response?.status;
	const message = error?.message?.toLowerCase() || '';
	
	return status === 401 || status === 403 || 
		message.includes('unauthorized') || message.includes('invalid api key');
}

/**
 * 判断是否为限流错误
 */
function isRateLimitError(error: any): boolean {
	const status = error?.status || error?.response?.status;
	const message = error?.message?.toLowerCase() || '';
	
	return status === 429 || message.includes('rate limit') || message.includes('too many requests');
}

/**
 * 从错误中获取限流等待时间
 */
function getRateLimitWaitTime(error: any): number | null {
	// 尝试从响应头获取
	const retryAfter = error?.response?.headers?.get('retry-after');
	if (retryAfter) {
		const seconds = parseInt(retryAfter, 10);
		if (!isNaN(seconds)) {
			return seconds * 1000;
		}
	}
	
	// 默认等待 60 秒
	return 60000;
}

/**
 * 计算重试延迟时间（指数退避）
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
	const delay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1);
	return Math.min(delay, config.maxDelay);
}

/**
 * 休眠指定时间
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 分类错误类型
 */
function classifyError(error: any): AIClassifierError {
	if (error instanceof AIClassifierError) {
		return error;
	}
	
	const message = error?.message || String(error);
	const lowerMessage = message.toLowerCase();
	const status = error?.status || error?.response?.status;
	
	// 网络错误
	if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || 
		lowerMessage.includes('enotfound') || lowerMessage.includes('econnrefused')) {
		return new AIClassifierError(
			'网络连接失败，请检查网络设置',
			'network',
			error
		);
	}
	
	// 超时错误
	if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
		return new AIClassifierError(
			'请求超时，请稍后重试',
			'timeout',
			error
		);
	}
	
	// 认证错误
	if (status === 401 || status === 403 || 
		lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid api key')) {
		return new AIClassifierError(
			'API Key 无效或未授权',
			'auth',
			error
		);
	}
	
	// 限流错误
	if (status === 429 || lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
		return new AIClassifierError(
			'API 请求过于频繁，请稍后重试',
			'rate_limit',
			error
		);
	}
	
	// JSON 解析错误
	if (lowerMessage.includes('json') || lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
		return new AIClassifierError(
			'响应数据格式错误',
			'parse',
			error
		);
	}
	
	// 未知错误
	return new AIClassifierError(
		message,
		'unknown',
		error
	);
}

/**
 * 用户友好的错误消息
 */
export function getUserFriendlyMessage(error: Error): string {
	if (error instanceof AIClassifierError) {
		switch (error.type) {
			case 'network':
				return '🌐 网络连接失败，请检查：\n• 网络是否正常\n• API 地址是否正确\n• 是否需要代理';
			case 'timeout':
				return '⏱️ 请求超时，建议：\n• 检查网络速度\n• 稍后重试';
			case 'auth':
				return '🔑 API Key 无效，请检查：\n• API Key 是否正确\n• 是否有余额/额度';
			case 'rate_limit':
				return '🚦 请求过于频繁，请稍后重试';
			case 'parse':
				return '📝 AI 响应格式异常，请重试或联系开发者';
			case 'validation':
				return `⚠️ 配置错误：${error.message}`;
			default:
				return `❌ ${error.message}`;
		}
	}
	
	return `❌ 未知错误：${error.message}`;
}

/**
 * 验证 URL 格式
 */
export function validateUrl(url: string, fieldName: string): void {
	if (!url || url.trim() === '') {
		throw new AIClassifierError(`${fieldName} 不能为空`, 'validation');
	}
	
	try {
		new URL(url);
	} catch {
		throw new AIClassifierError(`${fieldName} 格式不正确: ${url}`, 'validation');
	}
}

/**
 * 验证 API Key 格式
 */
export function validateApiKey(apiKey: string, providerName: string): void {
	if (!apiKey || apiKey.trim() === '') {
		throw new AIClassifierError(`${providerName} API Key 不能为空`, 'validation');
	}
	
	// 基本格式检查
	if (apiKey.length < 10) {
		throw new AIClassifierError(`${providerName} API Key 格式不正确`, 'validation');
	}
}

/**
 * 带超时的 fetch
 */
export async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout = 30000
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	
	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		return response;
	} catch (error: any) {
		if (error.name === 'AbortError') {
			throw new AIClassifierError(
				'请求超时',
				'timeout',
				error
			);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}
