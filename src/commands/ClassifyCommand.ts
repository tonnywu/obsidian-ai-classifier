import { App, Notice, TFile, FolderSuggest, TextComponent, Modal } from 'obsidian';
import type AIClassifierPlugin from '../main';
import { ClassificationResult } from '../settings/types';
import { t } from '../settings/i18n';
import { Classifier } from '../services/Classifier';
import { fileOps } from '../utils/fileOps';
import { getUserFriendlyMessage } from '../utils/errorHandler';

export class ClassifyCommand {
	private plugin: AIClassifierPlugin;
	private classifier: Classifier;
	
	constructor(plugin: AIClassifierPlugin) {
		this.plugin = plugin;
		this.classifier = new Classifier(plugin.settings, plugin.logger);
	}
	
	/**
	 * 分类收件箱中的所有文件
	 */
	async classifyInbox(): Promise<void> {
		const inboxFolder = this.plugin.settings.inboxFolder;
		
		// 确保 Inbox 目录存在
		try {
			const created = await fileOps.ensureFolder(this.plugin.app.vault, inboxFolder);
			if (created) {
				new Notice(`已创建收件箱文件夹: ${inboxFolder}`);
			}
		} catch (e) {
			new Notice(`创建收件箱文件夹失败: ${(e as Error).message}`);
			return;
		}
		
		// 查找收件箱文件夹
		const inboxFiles = await this.findInboxFiles(inboxFolder);
		
		if (inboxFiles.length === 0) {
			new Notice(t('classify.noFiles'));
			return;
		}
		
		new Notice(`找到 ${inboxFiles.length} 个待分类文件`);
		
		// 获取 AI Provider（带错误处理）
		let aiProvider;
		try {
			aiProvider = this.plugin.getAIProvider();
		} catch (e) {
			const errorMsg = getUserFriendlyMessage(e as Error);
			new Notice(errorMsg, 8000);
			return;
		}
		
		const results = await this.classifier.classifyInbox(
			inboxFiles,
			aiProvider,
			(message) => new Notice(message, 2000)
		);
		
		// 处理结果
		let movedCount = 0;
		let uncertainCount = 0;
		
		for (const { file, result, success } of results) {
			if (!success) {
				const errorMsg = getUserFriendlyMessage(new Error(result.reasoning));
				new Notice(`${file.name}: ${errorMsg}`, 5000);
				continue;
			}
			
			if (result.isUncertain) {
				uncertainCount++;
				// 对于低置信度结果，等待用户确认
				const confirmed = await this.confirmClassification(file, result);
				if (!confirmed) {
					continue;
				}
			}
			
			if (this.plugin.settings.autoMoveFile) {
				try {
					const moved = await this.classifier.moveFile(file, result.category);
					if (moved) {
						movedCount++;
						new Notice(`${file.name} → ${result.category}`);
					}
				} catch (e) {
					const errorMsg = getUserFriendlyMessage(e as Error);
					new Notice(`移动 ${file.name} 失败: ${errorMsg}`, 5000);
				}
			} else {
				new Notice(`${file.name}: ${result.category} (${(result.confidence * 100).toFixed(0)}%)`);
			}
		}
		
		new Notice(
			`分类完成！` +
			(movedCount > 0 ? `已移动 ${movedCount} 个文件` : '') +
			(uncertainCount > 0 ? `，${uncertainCount} 个文件需要确认` : '')
		);
	}
	
	/**
	 * 分类当前打开的文件
	 */
	async classifyCurrentFile(): Promise<void> {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		
		if (!activeFile) {
			new Notice('没有打开的文件');
			return;
		}
		
		// 获取 AI Provider（带错误处理）
		let aiProvider;
		try {
			aiProvider = this.plugin.getAIProvider();
		} catch (e) {
			const errorMsg = getUserFriendlyMessage(e as Error);
			new Notice(errorMsg, 8000);
			return;
		}
		
		const result = await this.classifier.classifyFile(activeFile, aiProvider);
		
		if (!result.success) {
			const errorMsg = getUserFriendlyMessage(new Error(result.error || 'Unknown error'));
			new Notice(errorMsg, 5000);
			return;
		}
		
		const { result: classification } = result;
		
		new Notice(
			`分类: ${classification?.category} ` +
			`(${((classification?.confidence || 0) * 100).toFixed(0)}%)`
		);
		
		// 检查是否需要移动
		if (classification?.isUncertain) {
			const confirmed = await this.confirmClassification(activeFile, classification);
			if (!confirmed) {
				return;
			}
		}
		
		if (this.plugin.settings.autoMoveFile && classification) {
			try {
				await this.classifier.moveFile(activeFile, classification.category);
				new Notice(`${t('classify.moved')}${classification.category}`);
			} catch (e) {
				const errorMsg = getUserFriendlyMessage(e as Error);
				new Notice(`移动文件失败: ${errorMsg}`, 5000);
			}
		}
	}
	
	/**
	 * 确认分类（用于低置信度情况）
	 */
	private confirmClassification(file: TFile, result: ClassificationResult): Promise<boolean> {
		return new Promise((resolve) => {
			const message = `${file.name}\n${t('classify.confirm')}${result.category}\n${t('classify.uncertain')}${((result.confidence || 0) * 100).toFixed(0)}%)`;
			
			if (result.suggestedCategory && this.plugin.settings.enableSuggestedCategories) {
				new Notice(`${t('classify.suggestedCategory')}${result.suggestedCategory}`);
			}
			
			// 使用 Obsidian 的确认对话框
			const modal = new ConfirmModal(
				this.plugin.app,
				message,
				async (confirmed) => {
					if (confirmed) {
						resolve(true);
					} else {
						resolve(false);
					}
				}
			);
			modal.open();
		});
	}
	
	/**
	 * 查找收件箱中的所有笔记文件
	 */
	private async findInboxFiles(inboxFolder: string): Promise<TFile[]> {
		const files = this.plugin.app.vault.getFiles();
		const scanSubfolders = this.plugin.settings.scanSubfolders;
		
		return files.filter(file => {
			// 检查文件是否在收件箱文件夹中
			const normalizedPath = file.path.replace(/\\/g, '/');
			const normalizedInbox = inboxFolder.replace(/\\/g, '/');
			
			// 检查是否在收件箱中
			if (!normalizedPath.startsWith(normalizedInbox + '/') && 
				!(normalizedPath.startsWith(normalizedInbox) && normalizedPath !== normalizedInbox)) {
				return false;
			}
			
			// 如果不扫描子文件夹，检查是否在顶层
			if (!scanSubfolders) {
				const relativePath = normalizedPath.substring(normalizedInbox.length);
				// 移除开头的斜杠
				const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
				// 如果相对路径中包含斜杠，说明在子目录中
				if (cleanRelativePath.includes('/')) {
					return false;
				}
			}
			
			return true;
		});
	}
}

/**
 * 简单的确认对话框
 */
class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: (confirmed: boolean) => void;
	
	constructor(app: App, message: string, onConfirm: (confirmed: boolean) => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}
	
	onOpen(): void {
		const { contentEl } = this;
		
		contentEl.createEl('p', { text: this.message });
		
		const buttonContainer = contentEl.createDiv('button-container');
		
		const confirmBtn = buttonContainer.createEl('button', {
			text: '确认',
			cls: 'mod-cta',
		});
		confirmBtn.onClick(() => {
			this.onConfirm(true);
			this.close();
		});
		
		const cancelBtn = buttonContainer.createEl('button', {
			text: '取消',
		});
		cancelBtn.onClick(() => {
			this.onConfirm(false);
			this.close();
		});
	}
	
	onClose(): void {
		this.contentEl.empty();
	}
}
