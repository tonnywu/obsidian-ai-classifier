import { Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, PluginSettings, AIProvider } from './settings/types';
import { SettingsTab } from './settings/SettingsTab';
import { ClassifyCommand } from './commands/ClassifyCommand';
import { OllamaProvider } from './services/OllamaProvider';
import { OpenAICompatibleProvider } from './services/OpenAIProvider';
import { Logger } from './utils/logger';
import { fileOps } from './utils/fileOps';

export default class AIClassifierPlugin extends Plugin {
	// 插件设置
	settings: PluginSettings = DEFAULT_SETTINGS;
	
	// 日志
	logger = new Logger();
	
	// 命令处理
	private commands: ClassifyCommand;
	
	// 设置面板
	private settingsTab: SettingsTab;
	
	async onload(): Promise<void> {
		console.debug('[AI Classifier] 插件加载中...');
		
		// 加载设置
		await this.loadSettings();
		
		// 初始化日志
		this.logger.setEnabled(this.settings.enableDebugLog);
		
		// 自动创建 Inbox 目录（如果不存在）
		try {
			const created = await fileOps.ensureFolder(this.app.vault, this.settings.inboxFolder);
			if (created) {
				this.logger.info(`已创建收件箱文件夹: ${this.settings.inboxFolder}`);
			}
		} catch (e) {
			this.logger.error('创建收件箱文件夹失败:', e);
		}
		
		// 初始化命令
		this.commands = new ClassifyCommand(this);
		
		// 注册命令
		this.addCommand({
			id: 'classify-inbox',
			name: 'AI智能分类 - 分类收件箱',
			callback: async () => {
				await this.commands.classifyInbox();
			},
		});
		
		this.addCommand({
			id: 'classify-current',
			name: 'AI智能分类 - 分类当前文件',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					if (!checking) {
						void this.commands.classifyCurrentFile();
					}
					return true;
				}
				return false;
			},
		});
		
		// 1. 添加 Ribbon 图标（左侧边栏）
		this.addRibbonIcon('sparkles', 'AI智能分类', async () => {
			await this.commands.classifyInbox();
		});
		
		// 2. 添加文件右键菜单
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile) {
					menu.addItem((item) => {
						item
							.setTitle('AI智能分类')
							.setIcon('sparkles')
							.onClick(async () => {
								await this.commands.classifyCurrentFile();
							});
					});
				}
			})
		);
		
		// 3. 添加编辑器菜单（右上角更多菜单）
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu) => {
				menu.addItem((item) => {
					item
						.setTitle('AI智能分类')
						.setIcon('sparkles')
						.onClick(async () => {
							await this.commands.classifyCurrentFile();
						});
				});
			})
		);
		
		// 添加设置面板
		this.settingsTab = new SettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		
		console.debug('[AI Classifier] 插件加载完成!');
	}
	
	onunload(): void {
		console.debug('[AI Classifier] 插件已卸载');
	}
	
	/**
	 * 获取 AI Provider 实例
	 */
	getAIProvider(): AIProvider {
		const providerType = this.settings.aiProvider;
		
		// 验证配置
		this.validateProviderConfig(providerType);
		
		switch (providerType) {
			case 'ollama':
				return new OllamaProvider(this.settings, this.logger);
			
			case 'openai':
				return new OpenAICompatibleProvider({
					name: 'OpenAI',
					apiKey: this.settings.openaiApiKey,
					model: this.settings.openaiModel,
					baseUrl: this.settings.openaiApiUrl,
				}, this.logger);
			
			case 'deepseek':
				return new OpenAICompatibleProvider({
					name: 'DeepSeek',
					apiKey: this.settings.deepseekApiKey,
					model: this.settings.deepseekModel,
					baseUrl: this.settings.deepseekApiUrl,
				}, this.logger);
			
			case 'moonshot':
				return new OpenAICompatibleProvider({
					name: 'Moonshot (Kimi)',
					apiKey: this.settings.moonshotApiKey,
					model: this.settings.moonshotModel,
					baseUrl: this.settings.moonshotApiUrl,
				}, this.logger);
			
			case 'zhipu':
				return new OpenAICompatibleProvider({
					name: 'Zhipu (智谱)',
					apiKey: this.settings.zhipuApiKey,
					model: this.settings.zhipuModel,
					baseUrl: this.settings.zhipuApiUrl,
				}, this.logger);
			
			default: {
				const exhaustiveCheck: never = providerType;
				throw new Error(`未知的 AI Provider: ${exhaustiveCheck}`);
			}
		}
	}
	
	/**
	 * 验证 Provider 配置
	 */
	private validateProviderConfig(providerType: string): void {
		switch (providerType) {
			case 'ollama':
				if (!this.settings.ollamaUrl || this.settings.ollamaUrl.trim() === '') {
					throw new Error('Ollama 地址未配置，请在设置中填写');
				}
				if (!this.settings.ollamaModel || this.settings.ollamaModel.trim() === '') {
					throw new Error('Ollama 模型未配置，请在设置中填写');
				}
				break;
			
			case 'openai':
				if (!this.settings.openaiApiKey || this.settings.openaiApiKey.trim() === '') {
					throw new Error('OpenAI API Key 未配置，请在设置中填写');
				}
				break;
			
			case 'deepseek':
				if (!this.settings.deepseekApiKey || this.settings.deepseekApiKey.trim() === '') {
					throw new Error('DeepSeek API Key 未配置，请在设置中填写');
				}
				break;
			
			case 'moonshot':
				if (!this.settings.moonshotApiKey || this.settings.moonshotApiKey.trim() === '') {
					throw new Error('Moonshot API Key 未配置，请在设置中填写');
				}
				break;
			
			case 'zhipu':
				if (!this.settings.zhipuApiKey || this.settings.zhipuApiKey.trim() === '') {
					throw new Error('智谱 AI API Key 未配置，请在设置中填写');
				}
				break;
			
			default:
				throw new Error(`未知的 AI Provider: ${providerType}`);
		}
	}
	
	/**
	 * 加载设置
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
		};
		
		// 初始化分类列表
		if (!this.settings.categories || this.settings.categories.length === 0) {
			this.settings.categories = this.flattenCategories(this.settings.categoryTree);
		}
	}
	
	/**
	 * 保存设置
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.logger.setEnabled(this.settings.enableDebugLog);
	}
	
	/**
	 * 将分类树展平为列表
	 */
	private flattenCategories(tree: Record<string, unknown>, prefix = ''): string[] {
		const result: string[] = [];
		for (const [key, value] of Object.entries(tree)) {
			const path = prefix ? `${prefix}/${key}` : key;
			if (typeof value === 'object' && value !== null && value !== true) {
				result.push(...this.flattenCategories(value as Record<string, unknown>, path));
			} else {
				result.push(path);
			}
		}
		return result;
	}
}
