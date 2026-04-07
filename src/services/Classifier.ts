import { TFile } from 'obsidian';
import { AIProvider, ClassificationResult, PluginSettings } from '../settings/types';
import { Logger } from '../utils/logger';
import { ContentExtractor } from './ContentExtractor';
import { fileOps } from '../utils/fileOps';

export class Classifier {
	private settings: PluginSettings;
	private logger: Logger;
	private contentExtractor: ContentExtractor;
	
	constructor(settings: PluginSettings, logger: Logger) {
		this.settings = settings;
		this.logger = logger;
		this.contentExtractor = new ContentExtractor();
	}
	
	/**
	 * 分类单个文件
	 */
	async classifyFile(
		file: TFile,
		aiProvider: AIProvider,
		onProgress?: (message: string) => void
	): Promise<{ success: boolean; result?: ClassificationResult; error?: string }> {
		try {
			onProgress?.(`正在分析: ${file.basename}`);
			
			// 提取内容
			const content = await this.contentExtractor.extract(file);
			if (!content) {
				return { success: false, error: '无法提取文件内容' };
			}
			
			const title = this.contentExtractor.getTitle(file);
			
			this.logger.debug(`分类文件: ${file.path}`);
			this.logger.debug(`标题: ${title}`);
			
			// 调用 AI 分类
			const result = await aiProvider.classify(
				content,
				title,
				this.settings.categories
			);
			
			this.logger.debug(`分类结果: ${JSON.stringify(result)}`);
			
			// 检查置信度
			if (result.confidence < this.settings.confidenceThreshold) {
				result.isUncertain = true;
				this.logger.debug(`置信度低于阈值: ${result.confidence}`);
			}
			
			return { success: true, result };
		} catch (e) {
			const error = (e as Error).message;
			this.logger.debug(`分类失败: ${error}`);
			return { success: false, error };
		}
	}
	
	/**
	 * 分类收件箱中的所有文件
	 */
	async classifyInbox(
		files: TFile[],
		aiProvider: AIProvider,
		onProgress?: (message: string) => void
	): Promise<Array<{ file: TFile; result: ClassificationResult; success: boolean }>> {
		const results: Array<{ file: TFile; result: ClassificationResult; success: boolean }> = [];
		
		for (const file of files) {
			const result = await this.classifyFile(file, aiProvider, onProgress);
			
			if (result.success && result.result) {
				results.push({
					file,
					result: result.result,
					success: true,
				});
			} else {
				results.push({
					file,
					result: {
						category: 'Other',
						confidence: 0,
						reasoning: result.error || 'Unknown error',
						isUncertain: true,
					},
					success: false,
				});
			}
		}
		
		return results;
	}
	
	/**
	 * 移动文件到分类目录
	 */
	async moveFile(file: TFile, category: string): Promise<boolean> {
		try {
			const newPath = fileOps.buildCategoryPath(category, this.settings.inboxFolder);
			await fileOps.moveFile(file, newPath);
			this.logger.debug(`文件已移动: ${file.path} -> ${newPath}`);
			return true;
		} catch (e) {
			this.logger.error(`移动文件失败: ${(e as Error).message}`);
			throw e; // 重新抛出错误，让调用方处理
		}
	}
}
