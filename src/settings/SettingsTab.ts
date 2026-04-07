import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type AIClassifierPlugin from '../main';
import { AIProviderType, DEFAULT_SETTINGS } from './types';
import { t } from './i18n';
import { CategoryTreeView } from './CategoryTreeView';

// 各服务商可用模型列表
const AVAILABLE_MODELS: Record<string, Array<{ value: string; label: string }>> = {
	openai: [
		{ value: 'gpt-4o-mini', label: 'GPT-4o Mini (推荐)' },
		{ value: 'gpt-4o', label: 'GPT-4o' },
		{ value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
		{ value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
	],
	deepseek: [
		{ value: 'deepseek-chat', label: 'DeepSeek Chat (推荐)' },
		{ value: 'deepseek-coder', label: 'DeepSeek Coder' },
	],
	moonshot: [
		{ value: 'moonshot-v1-8k', label: 'Moonshot V1 8K (推荐)' },
		{ value: 'moonshot-v1-32k', label: 'Moonshot V1 32K' },
		{ value: 'moonshot-v1-128k', label: 'Moonshot V1 128K' },
	],
	zhipu: [
		{ value: 'glm-4', label: 'GLM-4 (推荐)' },
		{ value: 'glm-4-flash', label: 'GLM-4 Flash' },
		{ value: 'glm-3-turbo', label: 'GLM-3 Turbo' },
	],
};

export class SettingsTab extends PluginSettingTab {
	plugin: AIClassifierPlugin;
	
	constructor(app: App, plugin: AIClassifierPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		
		// 顶部导航栏
		const headerEl = containerEl.createDiv('settings-header');
		headerEl.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 20px;';
		
		// 返回按钮
		const backBtn = headerEl.createEl('button', {
			cls: 'clickable-icon',
			attr: {
				'aria-label': '返回上一级',
				'title': '返回上一级'
			}
		});
		backBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
		backBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-muted);';
		backBtn.addEventListener('click', () => {
			// 直接触发 Obsidian 自带的返回功能
			// 查找设置侧边栏中的第一个插件选项并点击
			const communityPluginNavItem = document.querySelector('.nav-folder.mod-root > .nav-folder-title');
			if (communityPluginNavItem) {
				(communityPluginNavItem as HTMLElement).click();
			} else {
				// 如果找不到，尝试点击任何一个侧边栏项
				const anyNavItem = document.querySelector('.vertical-tab-nav-item');
				if (anyNavItem) {
					(anyNavItem as HTMLElement).click();
				}
			}
		});
		backBtn.addEventListener('mouseover', () => {
			backBtn.style.color = 'var(--text-normal)';
		});
		backBtn.addEventListener('mouseout', () => {
			backBtn.style.color = 'var(--text-muted)';
		});
		
		// 标题
		const titleEl = headerEl.createEl('h2', { text: t('settings.title') });
		titleEl.style.cssText = 'margin: 0; flex: 1;';
		
		this.addAIProviderSection();
		this.addCategorySection();
		this.addAdvancedSection();
		this.addDebugSection();
	}
	
	private addAIProviderSection(): void {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: 'AI 配置' });
		
		// AI 提供商选择
		new Setting(containerEl)
			.setName(t('settings.aiProvider'))
			.setDesc(t('settings.aiProviderDesc'))
			.addDropdown(dropdown => {
				dropdown
					.addOption('ollama', 'Ollama (本地)')
					.addOption('openai', 'OpenAI')
					.addOption('deepseek', 'DeepSeek')
					.addOption('moonshot', 'Moonshot (Kimi)')
					.addOption('zhipu', 'Zhipu (智谱 AI)')
					.setValue(this.plugin.settings.aiProvider)
					.onChange((value) => {
						this.plugin.settings.aiProvider = value as AIProviderType;
						this.plugin.saveSettings();
						this.display();
					});
			});
		
		if (this.plugin.settings.aiProvider === 'ollama') {
			// Ollama 配置
			new Setting(containerEl)
				.setName(t('settings.ollamaUrl'))
				.setDesc(t('settings.ollamaUrlDesc'))
				.addText(text => {
					text.setValue(this.plugin.settings.ollamaUrl)
						.onChange((value) => {
							this.plugin.settings.ollamaUrl = value;
							this.plugin.saveSettings();
						});
				});
			
			new Setting(containerEl)
				.setName(t('settings.ollamaModel'))
				.setDesc(t('settings.ollamaModelDesc'))
				.addText(text => {
					text.setValue(this.plugin.settings.ollamaModel)
						.onChange((value) => {
							this.plugin.settings.ollamaModel = value;
							this.plugin.saveSettings();
						});
				});
		} else {
			// API Key 配置
			new Setting(containerEl)
				.setName(`${this.getProviderDisplayName(this.plugin.settings.aiProvider)} API Key`)
				.setDesc(`请输入 ${this.getProviderDisplayName(this.plugin.settings.aiProvider)} 的 API Key`)
				.addText(text => {
					text.setValue(this.getProviderValue(this.plugin.settings.aiProvider, 'apiKey'))
						.setPlaceholder('sk-...')
						.onChange((value) => {
							this.updateProviderConfig(this.plugin.settings.aiProvider, 'apiKey', value);
							this.plugin.saveSettings();
						});
					text.inputEl.type = 'password';
				});
			
			// Model 配置（下拉选择）
			new Setting(containerEl)
				.setName(`${this.getProviderDisplayName(this.plugin.settings.aiProvider)} 模型`)
				.setDesc(`请选择 ${this.getProviderDisplayName(this.plugin.settings.aiProvider)} 的模型`)
				.addDropdown(dropdown => {
					const models = this.getAvailableModels(this.plugin.settings.aiProvider);
					models.forEach(model => {
						dropdown.addOption(model.value, model.label);
					});
					dropdown.setValue(this.getProviderValue(this.plugin.settings.aiProvider, 'model'))
						.onChange((value) => {
							this.updateProviderConfig(this.plugin.settings.aiProvider, 'model', value);
							this.plugin.saveSettings();
						});
				});
			
			// API URL 配置（高级选项）
			new Setting(containerEl)
				.setName(`${this.getProviderDisplayName(this.plugin.settings.aiProvider)} API 地址`)
				.setDesc('自定义 API 端点地址（可选，留空使用官方地址）')
				.addText(text => {
					text.setValue(this.getProviderValue(this.plugin.settings.aiProvider, 'baseUrl'))
						.setPlaceholder('https://api.example.com/v1')
						.onChange((value) => {
							this.updateProviderConfig(this.plugin.settings.aiProvider, 'baseUrl', value);
							this.plugin.saveSettings();
						});
				});
		}
		
		// 测试连接按钮
		new Setting(containerEl)
			.addButton(button => {
				button.setButtonText(t('settings.testConnection'))
					.onClick(async () => {
						button.setDisabled(true);
						try {
							const provider = this.plugin.getAIProvider();
							const result = await provider.testConnection();
							if (result.success) {
								new Notice(t('settings.connectionSuccess'));
							} else {
								new Notice(t('settings.connectionFailed') + result.message);
							}
						} catch (e) {
							new Notice(t('settings.connectionFailed') + (e as Error).message);
						} finally {
							button.setDisabled(false);
						}
					});
			});
	}
	
	private addCategorySection(): void {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: '分类配置' });
		
		new Setting(containerEl)
			.setName(t('settings.inboxFolder'))
			.setDesc(t('settings.inboxFolderDesc'))
			.addText(text => {
				text.setValue(this.plugin.settings.inboxFolder)
					.onChange((value) => {
						this.plugin.settings.inboxFolder = value;
						this.plugin.saveSettings();
					});
			});
		
		new Setting(containerEl)
			.setName('扫描子文件夹')
			.setDesc('是否递归扫描收件箱子目录中的文件。关闭则只分类收件箱顶层的文件。')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.scanSubfolders)
					.onChange((value) => {
						this.plugin.settings.scanSubfolders = value;
						this.plugin.saveSettings();
					});
			});
		
		// 可视化分类树
		containerEl.createEl('h4', { text: t('settings.categoryTree') });
		
		const treeContainer = containerEl.createDiv('category-tree-wrapper');
		
		new CategoryTreeView(
			treeContainer,
			this.plugin.settings.categoryTree,
			(newTree) => {
				this.plugin.settings.categoryTree = newTree;
				this.plugin.settings.categories = this.flattenCategories(newTree);
				this.plugin.saveSettings();
			}
		);
		
		// 操作按钮
		const actionsEl = containerEl.createDiv('category-tree-footer');
		new Setting(actionsEl)
			.addButton(btn => {
				btn.setButtonText(t('settings.restoreDefault'))
					.onClick(() => {
						if (confirm(t('settings.confirmRestoreDefault'))) {
							this.plugin.settings.categoryTree = DEFAULT_SETTINGS.categoryTree;
							this.plugin.settings.categories = this.flattenCategories(DEFAULT_SETTINGS.categoryTree);
							this.plugin.saveSettings();
							this.display(); // 刷新设置面板
						}
					});
			});
	}
	
	private addAdvancedSection(): void {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: '高级设置' });
		
		new Setting(containerEl)
			.setName(t('settings.enableSuggestedCategories'))
			.setDesc(t('settings.enableSuggestedCategoriesDesc'))
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableSuggestedCategories)
					.onChange((value) => {
						this.plugin.settings.enableSuggestedCategories = value;
						this.plugin.saveSettings();
					});
			});
		
		new Setting(containerEl)
			.setName(t('settings.autoMoveFile'))
			.setDesc(t('settings.autoMoveFileDesc'))
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.autoMoveFile)
					.onChange((value) => {
						this.plugin.settings.autoMoveFile = value;
						this.plugin.saveSettings();
					});
			});
		
		new Setting(containerEl)
			.setName(t('settings.confidenceThreshold'))
			.setDesc(t('settings.confidenceThresholdDesc'))
			.addSlider(slider => {
				slider.setValue(this.plugin.settings.confidenceThreshold * 100)
					.setLimits(0, 100, 1)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.confidenceThreshold = value / 100;
						this.plugin.saveSettings();
					});
			});
	}
	
	private addDebugSection(): void {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: '调试' });
		
		new Setting(containerEl)
			.setName(t('settings.enableDebugLog'))
			.setDesc(t('settings.enableDebugLogDesc'))
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableDebugLog)
					.onChange((value) => {
						this.plugin.settings.enableDebugLog = value;
						this.plugin.saveSettings();
					});
			});
	}
	
	private flattenCategories(tree: any, prefix = ''): string[] {
		const result: string[] = [];
		for (const [key, value] of Object.entries(tree)) {
			const path = prefix ? `${prefix}/${key}` : key;
			if (typeof value === 'object' && value !== null) {
				result.push(...this.flattenCategories(value, path));
			} else {
				result.push(path);
			}
		}
		return result;
	}
	
	private getAvailableModels(provider: AIProviderType): Array<{ value: string; label: string }> {
		return AVAILABLE_MODELS[provider] || [];
	}
	
	private getProviderDisplayName(provider: AIProviderType): string {
		switch (provider) {
			case 'openai': return 'OpenAI';
			case 'deepseek': return 'DeepSeek';
			case 'moonshot': return 'Moonshot (Kimi)';
			case 'zhipu': return 'Zhipu (智谱)';
			default: return 'Ollama';
		}
	}
	
	private getProviderValue(provider: AIProviderType, key: string): string {
		switch (provider) {
			case 'openai':
				if (key === 'apiKey') return this.plugin.settings.openaiApiKey;
				if (key === 'model') return this.plugin.settings.openaiModel;
				if (key === 'baseUrl') return this.plugin.settings.openaiApiUrl;
				break;
			case 'deepseek':
				if (key === 'apiKey') return this.plugin.settings.deepseekApiKey;
				if (key === 'model') return this.plugin.settings.deepseekModel;
				if (key === 'baseUrl') return this.plugin.settings.deepseekApiUrl;
				break;
			case 'moonshot':
				if (key === 'apiKey') return this.plugin.settings.moonshotApiKey;
				if (key === 'model') return this.plugin.settings.moonshotModel;
				if (key === 'baseUrl') return this.plugin.settings.moonshotApiUrl;
				break;
			case 'zhipu':
				if (key === 'apiKey') return this.plugin.settings.zhipuApiKey;
				if (key === 'model') return this.plugin.settings.zhipuModel;
				if (key === 'baseUrl') return this.plugin.settings.zhipuApiUrl;
				break;
		}
		return '';
	}
	
	private getCurrentProviderConfig() {
		const provider = this.plugin.settings.aiProvider;
		switch (provider) {
			case 'openai':
				return {
					name: 'OpenAI',
					apiKey: this.plugin.settings.openaiApiKey,
					model: this.plugin.settings.openaiModel,
					baseUrl: this.plugin.settings.openaiApiUrl,
				};
			case 'deepseek':
				return {
					name: 'DeepSeek',
					apiKey: this.plugin.settings.deepseekApiKey,
					model: this.plugin.settings.deepseekModel,
					baseUrl: this.plugin.settings.deepseekApiUrl,
				};
			case 'moonshot':
				return {
					name: 'Moonshot (Kimi)',
					apiKey: this.plugin.settings.moonshotApiKey,
					model: this.plugin.settings.moonshotModel,
					baseUrl: this.plugin.settings.moonshotApiUrl,
				};
			case 'zhipu':
				return {
					name: 'Zhipu (智谱)',
					apiKey: this.plugin.settings.zhipuApiKey,
					model: this.plugin.settings.zhipuModel,
					baseUrl: this.plugin.settings.zhipuApiUrl,
				};
			default:
				throw new Error(`未知的 Provider: ${provider}`);
		}
	}
	
	private updateProviderConfig(provider: string, key: string, value: string) {
		switch (provider) {
			case 'openai':
				if (key === 'apiKey') this.plugin.settings.openaiApiKey = value;
				else if (key === 'model') this.plugin.settings.openaiModel = value;
				else if (key === 'baseUrl') this.plugin.settings.openaiApiUrl = value;
				break;
			case 'deepseek':
				if (key === 'apiKey') this.plugin.settings.deepseekApiKey = value;
				else if (key === 'model') this.plugin.settings.deepseekModel = value;
				else if (key === 'baseUrl') this.plugin.settings.deepseekApiUrl = value;
				break;
			case 'moonshot':
				if (key === 'apiKey') this.plugin.settings.moonshotApiKey = value;
				else if (key === 'model') this.plugin.settings.moonshotModel = value;
				else if (key === 'baseUrl') this.plugin.settings.moonshotApiUrl = value;
				break;
			case 'zhipu':
				if (key === 'apiKey') this.plugin.settings.zhipuApiKey = value;
				else if (key === 'model') this.plugin.settings.zhipuModel = value;
				else if (key === 'baseUrl') this.plugin.settings.zhipuApiUrl = value;
				break;
		}
	}
}
