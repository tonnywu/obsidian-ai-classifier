'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
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

// 国际化支持 - 当前仅支持中文
const translations = {
    settings: {
        title: 'AI智能分类设置',
        aiProvider: 'AI 提供商',
        aiProviderDesc: '选择 AI 服务的提供方',
        ollamaUrl: 'Ollama 地址',
        ollamaUrlDesc: '本地 Ollama 服务的地址',
        ollamaModel: 'Ollama 模型',
        ollamaModelDesc: '使用的模型名称',
        openaiApiKey: 'OpenAI API Key',
        openaiApiKeyDesc: '您的 OpenAI API 密钥',
        openaiModel: 'OpenAI 模型',
        openaiModelDesc: '使用的 OpenAI 模型',
        inboxFolder: '收件箱文件夹',
        inboxFolderDesc: '待分类文件所在的文件夹',
        categoryTree: '分类结构',
        categoryTreeDesc: '定义您的分类树结构（JSON格式）',
        categories: '分类列表',
        enableSuggestedCategories: '启用 AI 推荐新分类',
        enableSuggestedCategoriesDesc: '当文章无法匹配现有分类时，AI 可以建议新分类',
        autoMoveFile: '自动移动文件',
        autoMoveFileDesc: '分类完成后自动将文件移动到对应文件夹',
        confidenceThreshold: '置信度阈值',
        confidenceThresholdDesc: '低于此置信度将提示用户确认',
        enableDebugLog: '启用调试日志',
        enableDebugLogDesc: '在控制台输出详细日志',
        testConnection: '测试连接',
        connectionSuccess: '连接成功！',
        connectionFailed: '连接失败：',
        save: '保存设置',
        categoriesPlaceholder: '编程/前端, 编程/后端, AI/机器学习, ...',
        addTopLevel: '添加一级分类',
        enterCategoryName: '请输入分类名称',
        enterNewName: '请输入新名称',
        categoryExists: '分类已存在',
        confirmDelete: '确认删除此分类？',
        confirmDeleteWithChildren: '此分类包含子分类，确认删除所有子分类吗？',
        restoreDefault: '恢复默认',
        confirmRestoreDefault: '确认恢复默认分类树？当前的自定义配置将丢失。',
    },
    classify: {
        command: 'AI智能分类',
        classifyInbox: '分类收件箱',
        classifyCurrent: '分类当前文件',
        processing: '正在分析: ',
        success: '分类完成',
        moved: '已移动到: ',
        uncertain: '置信度较低 (',
        confirm: '是否确认分类到: ',
        lowConfidence: '置信度过低，请手动确认',
        suggestedCategory: '建议新增分类: ',
        addCategory: '是否将此分类添加到预设?',
        noInbox: '未找到收件箱文件夹: ',
        noFiles: '收件箱中没有文件',
        skip: '跳过',
    },
    errors: {
        noContent: '无法提取文件内容',
        noTitle: '无法获取文件标题',
        aiError: 'AI 服务错误: ',
        moveError: '移动文件失败: ',
    },
};
function t(key) {
    const keys = key.split('.');
    let result = translations;
    for (const k of keys) {
        result = result?.[k];
    }
    return result || key;
}

/**
 * 分类树可视化组件
 */
class CategoryTreeView {
    containerEl;
    tree;
    onChange;
    expandedNodes = new Set();
    constructor(containerEl, tree, onChange) {
        this.containerEl = containerEl;
        this.tree = JSON.parse(JSON.stringify(tree)); // 深拷贝
        this.onChange = onChange;
        this.render();
    }
    /**
     * 渲染整个树
     */
    render() {
        this.containerEl.empty();
        this.containerEl.addClass('category-tree-container');
        // 渲染树形结构
        const treeEl = this.containerEl.createDiv('category-tree');
        this.renderTreeLevel(treeEl, this.tree, '');
        // 添加一级分类按钮
        const actionsEl = this.containerEl.createDiv('category-tree-actions');
        const addBtn = actionsEl.createEl('button', {
            cls: 'mod-cta',
            text: t('settings.addTopLevel')
        });
        addBtn.addEventListener('click', () => {
            this.addTopLevelCategory();
        });
    }
    /**
     * 渲染树的某一级
     */
    renderTreeLevel(container, node, path) {
        for (const [key, value] of Object.entries(node)) {
            const currentPath = path ? `${path}/${key}` : key;
            const hasChildren = typeof value === 'object' && value !== null && Object.keys(value).length > 0;
            const isExpanded = this.expandedNodes.has(currentPath);
            // 创建节点容器
            const nodeEl = container.createDiv('category-node');
            // 节点行（名称 + 操作按钮）
            const nodeRow = nodeEl.createDiv('category-node-row');
            // 展开/折叠按钮（仅当有子节点时显示）
            if (hasChildren) {
                const expandBtn = nodeRow.createEl('button', {
                    cls: 'category-expand-btn',
                    text: isExpanded ? '▼' : '▶'
                });
                expandBtn.addEventListener('click', () => {
                    if (isExpanded) {
                        this.expandedNodes.delete(currentPath);
                    }
                    else {
                        this.expandedNodes.add(currentPath);
                    }
                    this.render();
                });
            }
            else {
                // 占位符，保持对齐
                nodeRow.createEl('span', { cls: 'category-expand-placeholder', text: '　' });
            }
            // 图标
            nodeRow.createEl('span', {
                cls: 'category-icon',
                text: hasChildren ? '📂' : '📄'
            });
            // 名称
            nodeRow.createEl('span', {
                cls: 'category-name',
                text: key
            });
            // 操作按钮容器
            const actionsEl = nodeRow.createDiv('category-node-actions');
            // 编辑按钮
            actionsEl.createEl('button', {
                cls: 'category-action-btn',
                text: '✏️'
            }).addEventListener('click', () => {
                this.editNode(currentPath, key);
            });
            // 删除按钮
            actionsEl.createEl('button', {
                cls: 'category-action-btn',
                text: '🗑️'
            }).addEventListener('click', () => {
                this.deleteNode(currentPath, key, hasChildren);
            });
            // 添加子分类按钮（仅对父节点显示）
            if (hasChildren || typeof value === 'object') {
                actionsEl.createEl('button', {
                    cls: 'category-action-btn',
                    text: '➕'
                }).addEventListener('click', () => {
                    this.addChildCategory(currentPath);
                });
            }
            // 渲染子节点
            if (hasChildren && isExpanded) {
                const childrenEl = nodeEl.createDiv('category-children');
                this.renderTreeLevel(childrenEl, value, currentPath);
            }
        }
    }
    /**
     * 添加一级分类
     */
    addTopLevelCategory() {
        this.showPromptModal(t('settings.enterCategoryName'), '', (name) => {
            if (this.tree[name]) {
                new obsidian.Notice(t('settings.categoryExists'));
                return;
            }
            this.tree[name] = {};
            this.notifyChange();
        });
    }
    /**
     * 添加子分类
     */
    addChildCategory(parentPath) {
        this.showPromptModal(t('settings.enterCategoryName'), '', (name) => {
            const parent = this.getNodeByPath(parentPath);
            if (!parent)
                return;
            if (parent[name]) {
                new obsidian.Notice(t('settings.categoryExists'));
                return;
            }
            parent[name] = {};
            this.expandedNodes.add(parentPath);
            this.notifyChange();
        });
    }
    /**
     * 编辑节点名称
     */
    editNode(path, oldName) {
        this.showPromptModal(t('settings.enterNewName'), oldName, (newName) => {
            if (!newName || newName.trim() === '' || newName === oldName)
                return;
            const pathParts = path.split('/');
            const parentPath = pathParts.slice(0, -1).join('/');
            const parent = parentPath ? this.getNodeByPath(parentPath) : this.tree;
            if (!parent)
                return;
            if (parent[newName]) {
                new obsidian.Notice(t('settings.categoryExists'));
                return;
            }
            // 重命名
            parent[newName] = parent[oldName];
            delete parent[oldName];
            this.notifyChange();
        });
    }
    /**
     * 删除节点
     */
    deleteNode(path, name, hasChildren) {
        const message = hasChildren
            ? t('settings.confirmDeleteWithChildren')
            : t('settings.confirmDelete');
        this.showConfirmModal(message, () => {
            const pathParts = path.split('/');
            const parentPath = pathParts.slice(0, -1).join('/');
            const parent = parentPath ? this.getNodeByPath(parentPath) : this.tree;
            if (!parent)
                return;
            delete parent[name];
            this.notifyChange();
        });
    }
    /**
     * 根据路径获取节点
     */
    getNodeByPath(path) {
        const parts = path.split('/');
        let current = this.tree;
        for (const part of parts) {
            const child = current[part];
            if (!child || typeof child !== 'object') {
                return null;
            }
            current = child;
        }
        return current;
    }
    /**
     * 通知外部树已更新
     */
    notifyChange() {
        this.onChange(this.tree);
        this.render();
    }
    /**
     * 更新树数据（外部调用）
     */
    updateTree(newTree) {
        this.tree = JSON.parse(JSON.stringify(newTree));
        this.render();
    }
    /**
     * 显示输入对话框
     */
    showPromptModal(placeholder, defaultValue, onSubmit) {
        const modal = new InputModal(placeholder, defaultValue, onSubmit);
        modal.open();
    }
    /**
     * 显示确认对话框
     */
    showConfirmModal(message, onConfirm) {
        const modal = new ConfirmModal$1(message, onConfirm);
        modal.open();
    }
}
/**
 * 输入对话框
 */
class InputModal extends obsidian.Modal {
    placeholder;
    defaultValue;
    onSubmit;
    constructor(placeholder, defaultValue, onSubmit) {
        super(app);
        this.placeholder = placeholder;
        this.defaultValue = defaultValue;
        this.onSubmit = onSubmit;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: this.placeholder });
        const input = contentEl.createEl('input', {
            type: 'text',
            value: this.defaultValue,
            cls: 'modal-input'
        });
        // 监听回车键
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.onSubmit(input.value);
                this.close();
            }
        });
        const buttonsEl = contentEl.createDiv('modal-button-container');
        const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());
        const confirmBtn = buttonsEl.createEl('button', {
            text: 'Confirm',
            cls: 'mod-cta'
        });
        confirmBtn.addEventListener('click', () => {
            this.onSubmit(input.value);
            this.close();
        });
        // 自动聚焦
        input.focus();
        input.select();
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
/**
 * 确认对话框
 */
let ConfirmModal$1 = class ConfirmModal extends obsidian.Modal {
    message;
    onConfirm;
    constructor(message, onConfirm) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: this.message });
        const buttonsEl = contentEl.createDiv('modal-button-container');
        const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());
        const confirmBtn = buttonsEl.createEl('button', {
            text: 'Confirm',
            cls: 'mod-cta'
        });
        confirmBtn.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
};

// 各服务商可用模型列表
const AVAILABLE_MODELS = {
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
class SettingsTab extends obsidian.PluginSettingTab {
    plugin;
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        // 顶部导航栏
        const headerEl = containerEl.createDiv('settings-header');
        // 返回按钮
        const backBtn = headerEl.createEl('button', {
            cls: 'settings-back-btn clickable-icon',
            attr: {
                'aria-label': 'Back to previous level',
                'title': 'Back to previous level'
            }
        });
        // 创建 SVG 图标
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'm15 18-6-6 6-6');
        svg.appendChild(path);
        backBtn.appendChild(svg);
        backBtn.addEventListener('click', () => {
            // 直接触发 Obsidian 自带的返回功能
            // 查找设置侧边栏中的第一个插件选项并点击
            const communityPluginNavItem = document.querySelector('.nav-folder.mod-root > .nav-folder-title');
            if (communityPluginNavItem) {
                communityPluginNavItem.click();
            }
            else {
                // 如果找不到，尝试点击任何一个侧边栏项
                const anyNavItem = document.querySelector('.vertical-tab-nav-item');
                if (anyNavItem) {
                    anyNavItem.click();
                }
            }
        });
        // 标题
        new obsidian.Setting(headerEl)
            .setName(t('settings.title'))
            .setHeading();
        this.addAIProviderSection();
        this.addCategorySection();
        this.addAdvancedSection();
        this.addDebugSection();
    }
    addAIProviderSection() {
        const { containerEl } = this;
        new obsidian.Setting(containerEl)
            .setName('AI configuration')
            .setHeading();
        // AI 提供商选择
        new obsidian.Setting(containerEl)
            .setName(t('settings.aiProvider'))
            .setDesc(t('settings.aiProviderDesc'))
            .addDropdown(dropdown => {
            dropdown
                .addOption('ollama', 'Ollama (local)')
                .addOption('openai', 'OpenAi')
                .addOption('deepseek', 'Deepseek')
                .addOption('moonshot', 'Moonshot (kimi)')
                .addOption('zhipu', 'Zhipu AI')
                .setValue(this.plugin.settings.aiProvider)
                .onChange((value) => {
                this.plugin.settings.aiProvider = value;
                void this.plugin.saveSettings();
                this.display();
            });
        });
        if (this.plugin.settings.aiProvider === 'ollama') {
            // Ollama 配置
            new obsidian.Setting(containerEl)
                .setName(t('settings.ollamaUrl'))
                .setDesc(t('settings.ollamaUrlDesc'))
                .addText(text => {
                text.setValue(this.plugin.settings.ollamaUrl)
                    .onChange((value) => {
                    this.plugin.settings.ollamaUrl = value;
                    void this.plugin.saveSettings();
                });
            });
            new obsidian.Setting(containerEl)
                .setName(t('settings.ollamaModel'))
                .setDesc(t('settings.ollamaModelDesc'))
                .addText(text => {
                text.setValue(this.plugin.settings.ollamaModel)
                    .onChange((value) => {
                    this.plugin.settings.ollamaModel = value;
                    void this.plugin.saveSettings();
                });
            });
        }
        else {
            // API Key 配置
            new obsidian.Setting(containerEl)
                .setName(`${this.getProviderDisplayName(this.plugin.settings.aiProvider)} API Key`)
                .setDesc(`请输入 ${this.getProviderDisplayName(this.plugin.settings.aiProvider)} 的 API Key`)
                .addText(text => {
                text.setValue(this.getProviderValue(this.plugin.settings.aiProvider, 'apiKey'))
                    .setPlaceholder('API key...')
                    .onChange((value) => {
                    this.updateProviderConfig(this.plugin.settings.aiProvider, 'apiKey', value);
                    void this.plugin.saveSettings();
                });
                text.inputEl.type = 'password';
            });
            // Model 配置（下拉选择）
            new obsidian.Setting(containerEl)
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
                    void this.plugin.saveSettings();
                });
            });
            // API URL 配置（高级选项）
            new obsidian.Setting(containerEl)
                .setName(`${this.getProviderDisplayName(this.plugin.settings.aiProvider)} API 地址`)
                .setDesc('自定义 API 端点地址（可选，留空使用官方地址）')
                .addText(text => {
                text.setValue(this.getProviderValue(this.plugin.settings.aiProvider, 'baseUrl'))
                    .setPlaceholder('https://api.example.com/v1')
                    .onChange((value) => {
                    this.updateProviderConfig(this.plugin.settings.aiProvider, 'baseUrl', value);
                    void this.plugin.saveSettings();
                });
            });
        }
        // 测试连接按钮
        new obsidian.Setting(containerEl)
            .addButton(button => {
            button.setButtonText(t('settings.testConnection'))
                .onClick(async () => {
                button.setDisabled(true);
                try {
                    const provider = this.plugin.getAIProvider();
                    const result = await provider.testConnection();
                    if (result.success) {
                        new obsidian.Notice(t('settings.connectionSuccess'));
                    }
                    else {
                        new obsidian.Notice(t('settings.connectionFailed') + result.message);
                    }
                }
                catch (e) {
                    new obsidian.Notice(t('settings.connectionFailed') + e.message);
                }
                finally {
                    button.setDisabled(false);
                }
            });
        });
    }
    addCategorySection() {
        const { containerEl } = this;
        new obsidian.Setting(containerEl)
            .setName('Category configuration')
            .setHeading();
        new obsidian.Setting(containerEl)
            .setName(t('settings.inboxFolder'))
            .setDesc(t('settings.inboxFolderDesc'))
            .addText(text => {
            text.setValue(this.plugin.settings.inboxFolder)
                .onChange((value) => {
                this.plugin.settings.inboxFolder = value;
                void this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName('Scan subfolders')
            .setDesc('Whether to recursively scan files in inbox subdirectories. Disable to only classify files at the top level of inbox.')
            .addToggle(toggle => {
            toggle.setValue(this.plugin.settings.scanSubfolders)
                .onChange((value) => {
                this.plugin.settings.scanSubfolders = value;
                void this.plugin.saveSettings();
            });
        });
        // 可视化分类树
        new obsidian.Setting(containerEl)
            .setName(t('settings.categoryTree'))
            .setHeading();
        const treeContainer = containerEl.createDiv('category-tree-wrapper');
        new CategoryTreeView(treeContainer, this.plugin.settings.categoryTree, (newTree) => {
            this.plugin.settings.categoryTree = newTree;
            this.plugin.settings.categories = this.flattenCategories(newTree);
            void this.plugin.saveSettings();
        });
        // 操作按钮
        const actionsEl = containerEl.createDiv('category-tree-footer');
        new obsidian.Setting(actionsEl)
            .addButton(btn => {
            btn.setButtonText(t('settings.restoreDefault'))
                .onClick(() => {
                this.showRestoreConfirm();
            });
        });
    }
    showRestoreConfirm() {
        const modal = new RestoreConfirmModal(this.app, () => {
            this.plugin.settings.categoryTree = DEFAULT_SETTINGS.categoryTree;
            this.plugin.settings.categories = this.flattenCategories(DEFAULT_SETTINGS.categoryTree);
            void this.plugin.saveSettings();
            this.display(); // 刷新设置面板
        });
        modal.open();
    }
    addAdvancedSection() {
        const { containerEl } = this;
        new obsidian.Setting(containerEl)
            .setName('Advanced')
            .setHeading();
        new obsidian.Setting(containerEl)
            .setName(t('settings.enableSuggestedCategories'))
            .setDesc(t('settings.enableSuggestedCategoriesDesc'))
            .addToggle(toggle => {
            toggle.setValue(this.plugin.settings.enableSuggestedCategories)
                .onChange((value) => {
                this.plugin.settings.enableSuggestedCategories = value;
                void this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName(t('settings.autoMoveFile'))
            .setDesc(t('settings.autoMoveFileDesc'))
            .addToggle(toggle => {
            toggle.setValue(this.plugin.settings.autoMoveFile)
                .onChange((value) => {
                this.plugin.settings.autoMoveFile = value;
                void this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName(t('settings.confidenceThreshold'))
            .setDesc(t('settings.confidenceThresholdDesc'))
            .addSlider(slider => {
            slider.setValue(this.plugin.settings.confidenceThreshold * 100)
                .setLimits(0, 100, 1)
                .setDynamicTooltip()
                .onChange((value) => {
                this.plugin.settings.confidenceThreshold = value / 100;
                void this.plugin.saveSettings();
            });
        });
    }
    addDebugSection() {
        const { containerEl } = this;
        new obsidian.Setting(containerEl)
            .setName('Debug')
            .setHeading();
        new obsidian.Setting(containerEl)
            .setName(t('settings.enableDebugLog'))
            .setDesc(t('settings.enableDebugLogDesc'))
            .addToggle(toggle => {
            toggle.setValue(this.plugin.settings.enableDebugLog)
                .onChange((value) => {
                this.plugin.settings.enableDebugLog = value;
                void this.plugin.saveSettings();
            });
        });
    }
    flattenCategories(tree, prefix = '') {
        const result = [];
        for (const [key, value] of Object.entries(tree)) {
            const path = prefix ? `${prefix}/${key}` : key;
            if (typeof value === 'object' && value !== null) {
                result.push(...this.flattenCategories(value, path));
            }
            else {
                result.push(path);
            }
        }
        return result;
    }
    getAvailableModels(provider) {
        return AVAILABLE_MODELS[provider] || [];
    }
    getProviderDisplayName(provider) {
        switch (provider) {
            case 'openai': return 'OpenAI';
            case 'deepseek': return 'DeepSeek';
            case 'moonshot': return 'Moonshot (Kimi)';
            case 'zhipu': return 'Zhipu (智谱)';
            default: return 'Ollama';
        }
    }
    getProviderValue(provider, key) {
        switch (provider) {
            case 'openai':
                if (key === 'apiKey')
                    return this.plugin.settings.openaiApiKey;
                if (key === 'model')
                    return this.plugin.settings.openaiModel;
                if (key === 'baseUrl')
                    return this.plugin.settings.openaiApiUrl;
                break;
            case 'deepseek':
                if (key === 'apiKey')
                    return this.plugin.settings.deepseekApiKey;
                if (key === 'model')
                    return this.plugin.settings.deepseekModel;
                if (key === 'baseUrl')
                    return this.plugin.settings.deepseekApiUrl;
                break;
            case 'moonshot':
                if (key === 'apiKey')
                    return this.plugin.settings.moonshotApiKey;
                if (key === 'model')
                    return this.plugin.settings.moonshotModel;
                if (key === 'baseUrl')
                    return this.plugin.settings.moonshotApiUrl;
                break;
            case 'zhipu':
                if (key === 'apiKey')
                    return this.plugin.settings.zhipuApiKey;
                if (key === 'model')
                    return this.plugin.settings.zhipuModel;
                if (key === 'baseUrl')
                    return this.plugin.settings.zhipuApiUrl;
                break;
        }
        return '';
    }
    getCurrentProviderConfig() {
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
    updateProviderConfig(provider, key, value) {
        switch (provider) {
            case 'openai':
                if (key === 'apiKey')
                    this.plugin.settings.openaiApiKey = value;
                else if (key === 'model')
                    this.plugin.settings.openaiModel = value;
                else if (key === 'baseUrl')
                    this.plugin.settings.openaiApiUrl = value;
                break;
            case 'deepseek':
                if (key === 'apiKey')
                    this.plugin.settings.deepseekApiKey = value;
                else if (key === 'model')
                    this.plugin.settings.deepseekModel = value;
                else if (key === 'baseUrl')
                    this.plugin.settings.deepseekApiUrl = value;
                break;
            case 'moonshot':
                if (key === 'apiKey')
                    this.plugin.settings.moonshotApiKey = value;
                else if (key === 'model')
                    this.plugin.settings.moonshotModel = value;
                else if (key === 'baseUrl')
                    this.plugin.settings.moonshotApiUrl = value;
                break;
            case 'zhipu':
                if (key === 'apiKey')
                    this.plugin.settings.zhipuApiKey = value;
                else if (key === 'model')
                    this.plugin.settings.zhipuModel = value;
                else if (key === 'baseUrl')
                    this.plugin.settings.zhipuApiUrl = value;
                break;
        }
    }
}
/**
 * Restore confirmation modal
 */
class RestoreConfirmModal extends obsidian.Modal {
    onConfirm;
    constructor(app, onConfirm) {
        super(app);
        this.onConfirm = onConfirm;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: t('settings.confirmRestoreDefault') });
        const buttonContainer = contentEl.createDiv('modal-button-container');
        const confirmBtn = buttonContainer.createEl('button', {
            text: 'Confirm',
            cls: 'mod-cta',
        });
        confirmBtn.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });
        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel',
        });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * 从 Obsidian 文件中提取内容
 */
class ContentExtractor {
    /**
     * 提取文件内容（支持 Markdown 和纯文本）
     */
    async extract(file) {
        try {
            // 对于外部链接文件，可能需要特殊处理
            if (file instanceof obsidian.TFile) {
                const content = await file.vault.read(file);
                return this.cleanContent(content);
            }
            return null;
        }
        catch (e) {
            console.error('提取文件内容失败:', e);
            return null;
        }
    }
    /**
     * 获取文件标题
     */
    getTitle(file) {
        // 优先使用文件名（不含扩展名）
        return file.basename;
    }
    /**
     * 清理内容，移除不必要的部分
     */
    cleanContent(content) {
        return content
            // 移除 YAML frontmatter
            .replace(/^---[\s\S]*?---\n?/, '')
            // 移除 HTML 注释
            .replace(/<!--[\s\S]*?-->/g, '')
            // 移除代码块（保留语言标记）
            .replace(/```[\s\S]*?```/g, (match) => {
            const langMatch = match.match(/```(\w*)/);
            const lang = langMatch ? langMatch[1] : '';
            return `[代码块: ${lang}]`;
        })
            // 移除图片和链接，保留 alt text
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '[$1]')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            // 移除多余空行
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    /**
     * 生成内容摘要（用于 AI 分析）
     */
    generateSummary(content, maxLength = 2000) {
        if (content.length <= maxLength) {
            return content;
        }
        // 尝试在句子边界处截断
        const truncated = content.slice(0, maxLength);
        const lastPeriod = truncated.lastIndexOf('。');
        const lastNewline = truncated.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        if (breakPoint > maxLength * 0.7) {
            return truncated.slice(0, breakPoint + 1);
        }
        return truncated + '...';
    }
}

/**
 * 文件操作工具
 */
const fileOps = {
    /**
     * 构建分类路径
     */
    buildCategoryPath(category, inboxFolder) {
        // 将分类路径中的 "/" 转换为 Vault 中的文件夹分隔符
        const normalizedCategory = category.replace(/\//g, '/');
        return `${inboxFolder}/${normalizedCategory}`;
    },
    /**
     * 移动文件到目标路径
     */
    async moveFile(file, newFolderPath) {
        try {
            const vault = file.vault;
            const adapter = vault.adapter;
            // 确保目标文件夹存在（处理竞态条件）
            try {
                if (!await adapter.exists(newFolderPath)) {
                    await vault.createFolder(newFolderPath);
                }
            }
            catch (folderError) {
                // 如果文件夹已存在，忽略错误
                const errorMsg = folderError?.message || '';
                if (!errorMsg.includes('already exists')) {
                    throw new Error(`创建文件夹失败: ${errorMsg}`);
                }
            }
            // 构建新文件路径
            const newPath = `${newFolderPath}/${file.name}`;
            // 如果目标路径相同，不移动
            if (file.path === newPath) {
                return file;
            }
            // 检查目标文件是否已存在
            if (await adapter.exists(newPath)) {
                // 文件已存在，添加时间戳后缀
                const timestamp = Date.now();
                const ext = file.extension;
                const baseName = file.basename;
                const uniqueNewPath = `${newFolderPath}/${baseName}_${timestamp}.${ext}`;
                await vault.rename(file, uniqueNewPath);
                const newFile = vault.getAbstractFileByPath(uniqueNewPath);
                if (!(newFile instanceof obsidian.TFile)) {
                    throw new Error('移动后无法找到文件');
                }
                return newFile;
            }
            // 执行移动
            await vault.rename(file, newPath);
            // 返回新的文件引用
            const newFile = vault.getAbstractFileByPath(newPath);
            if (!(newFile instanceof obsidian.TFile)) {
                throw new Error('移动后无法找到文件');
            }
            return newFile;
        }
        catch (e) {
            const error = e;
            console.error('移动文件失败:', error);
            throw new Error(`移动文件失败: ${error.message}`);
        }
    },
    /**
     * 获取文件名（不含扩展名）
     */
    getBasename(file) {
        return file.basename;
    },
    /**
     * 检查文件是否存在于指定路径
     */
    async exists(vault, path) {
        return await vault.adapter.exists(path);
    },
    /**
     * 确保文件夹存在，不存在则创建
     */
    async ensureFolder(vault, folderPath) {
        try {
            if (!await vault.adapter.exists(folderPath)) {
                await vault.createFolder(folderPath);
                return true; // 返回 true 表示新创建了文件夹
            }
            return false; // 返回 false 表示文件夹已存在
        }
        catch (e) {
            console.error('创建文件夹失败:', e);
            throw e;
        }
    },
};

class Classifier {
    settings;
    logger;
    contentExtractor;
    constructor(settings, logger) {
        this.settings = settings;
        this.logger = logger;
        this.contentExtractor = new ContentExtractor();
    }
    /**
     * 分类单个文件
     */
    async classifyFile(file, aiProvider, onProgress) {
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
            const result = await aiProvider.classify(content, title, this.settings.categories);
            this.logger.debug(`分类结果: ${JSON.stringify(result)}`);
            // 检查置信度
            if (result.confidence < this.settings.confidenceThreshold) {
                result.isUncertain = true;
                this.logger.debug(`置信度低于阈值: ${result.confidence}`);
            }
            return { success: true, result };
        }
        catch (e) {
            const error = e.message;
            this.logger.debug(`分类失败: ${error}`);
            return { success: false, error };
        }
    }
    /**
     * 分类收件箱中的所有文件
     */
    async classifyInbox(files, aiProvider, onProgress) {
        const results = [];
        for (const file of files) {
            const result = await this.classifyFile(file, aiProvider, onProgress);
            if (result.success && result.result) {
                results.push({
                    file,
                    result: result.result,
                    success: true,
                });
            }
            else {
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
    async moveFile(file, category) {
        try {
            const newPath = fileOps.buildCategoryPath(category, this.settings.inboxFolder);
            await fileOps.moveFile(file, newPath);
            this.logger.debug(`文件已移动: ${file.path} -> ${newPath}`);
            return true;
        }
        catch (e) {
            this.logger.error(`移动文件失败: ${e.message}`);
            throw e; // 重新抛出错误，让调用方处理
        }
    }
}

/**
 * 错误处理工具
 * 提供统一的错误类型和处理方法
 */
/**
 * 自定义错误类型
 */
class AIClassifierError extends Error {
    type;
    originalError;
    constructor(message, type, originalError) {
        super(message);
        this.type = type;
        this.originalError = originalError;
        this.name = 'AIClassifierError';
    }
}
const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 秒
    maxDelay: 10000, // 10 秒
    backoffFactor: 2, // 指数退避
};
/**
 * 带重试的异步操作
 */
async function withRetry(operation, config = {}, operationName = 'operation') {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError;
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // 如果是认证错误，不重试
            if (isAuthError(error)) {
                throw new AIClassifierError('API Key 无效或未授权', 'auth', lastError);
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
    throw classifyError(lastError);
}
/**
 * 判断是否为可重试错误
 */
function isRetryableError(error) {
    const message = error?.message?.toLowerCase() || '';
    const status = error?.status ||
        error?.response?.status;
    // 网络错误
    if (message.includes('network') || message.includes('fetch') || message.includes('enotfound')) {
        return true;
    }
    // 服务器错误 (5xx)
    if (status !== undefined && status >= 500 && status < 600) {
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
function isAuthError(error) {
    const status = error?.status || error?.response?.status;
    const message = error?.message?.toLowerCase() || '';
    return status === 401 || status === 403 ||
        message.includes('unauthorized') || message.includes('invalid api key');
}
/**
 * 判断是否为限流错误
 */
function isRateLimitError(error) {
    const status = error?.status || error?.response?.status;
    const message = error?.message?.toLowerCase() || '';
    return status === 429 || message.includes('rate limit') || message.includes('too many requests');
}
/**
 * 从错误中获取限流等待时间
 */
function getRateLimitWaitTime(error) {
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
function calculateDelay(attempt, config) {
    const delay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1);
    return Math.min(delay, config.maxDelay);
}
/**
 * 休眠指定时间
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 分类错误类型
 */
function classifyError(error) {
    if (error instanceof AIClassifierError) {
        return error;
    }
    const errorObj = error;
    const message = errorObj?.message || String(error);
    const lowerMessage = message.toLowerCase();
    const status = errorObj?.status || errorObj?.response?.status;
    // 网络错误
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') ||
        lowerMessage.includes('enotfound') || lowerMessage.includes('econnrefused')) {
        return new AIClassifierError('网络连接失败，请检查网络设置', 'network', error instanceof Error ? error : undefined);
    }
    // 超时错误
    if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
        return new AIClassifierError('请求超时，请稍后重试', 'timeout', error instanceof Error ? error : undefined);
    }
    // 认证错误
    if (status === 401 || status === 403 ||
        lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid api key')) {
        return new AIClassifierError('API Key 无效或未授权', 'auth', error instanceof Error ? error : undefined);
    }
    // 限流错误
    if (status === 429 || lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
        return new AIClassifierError('API 请求过于频繁，请稍后重试', 'rate_limit', error instanceof Error ? error : undefined);
    }
    // JSON 解析错误
    if (lowerMessage.includes('json') || lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
        return new AIClassifierError('响应数据格式错误', 'parse', error instanceof Error ? error : undefined);
    }
    // 未知错误
    return new AIClassifierError(message, 'unknown', error instanceof Error ? error : undefined);
}
/**
 * 用户友好的错误消息
 */
function getUserFriendlyMessage(error) {
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
function validateUrl(url, fieldName) {
    if (!url || url.trim() === '') {
        throw new AIClassifierError(`${fieldName} 不能为空`, 'validation');
    }
    try {
        new URL(url);
    }
    catch {
        throw new AIClassifierError(`${fieldName} 格式不正确: ${url}`, 'validation');
    }
}
/**
 * 带超时的 fetch（使用 Obsidian 的 requestUrl）
 */
async function fetchWithTimeout(url, options = {}, _timeout = 30000) {
    try {
        const requestParams = {
            url,
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body || undefined,
        };
        const response = await obsidian.requestUrl({
            ...requestParams,
            throw: false, // 不自动抛出 HTTP 错误
        });
        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.text || '',
            headers: new Headers(response.headers),
            json: () => Promise.resolve(response.json),
            text: () => Promise.resolve(response.text),
            blob: () => Promise.resolve(new Blob([response.arrayBuffer])),
            arrayBuffer: () => Promise.resolve(response.arrayBuffer),
            formData: () => Promise.reject(new Error('formData not supported')),
            clone: function () { return this; },
            body: null,
            bodyUsed: false,
            redirected: false,
            type: 'basic',
            url: url,
        };
    }
    catch (error) {
        throw new AIClassifierError('请求超时或网络错误', 'timeout', error instanceof Error ? error : undefined);
    }
}

class ClassifyCommand {
    plugin;
    classifier;
    constructor(plugin) {
        this.plugin = plugin;
        this.classifier = new Classifier(plugin.settings, plugin.logger);
    }
    /**
     * 分类收件箱中的所有文件
     */
    async classifyInbox() {
        const inboxFolder = this.plugin.settings.inboxFolder;
        // 确保 Inbox 目录存在
        try {
            const created = await fileOps.ensureFolder(this.plugin.app.vault, inboxFolder);
            if (created) {
                new obsidian.Notice(`已创建收件箱文件夹: ${inboxFolder}`);
            }
        }
        catch (e) {
            new obsidian.Notice(`创建收件箱文件夹失败: ${e.message}`);
            return;
        }
        // 查找收件箱文件夹
        const inboxFiles = this.findInboxFiles(inboxFolder);
        if (inboxFiles.length === 0) {
            new obsidian.Notice(t('classify.noFiles'));
            return;
        }
        new obsidian.Notice(`找到 ${inboxFiles.length} 个待分类文件`);
        // 获取 AI Provider（带错误处理）
        let aiProvider;
        try {
            aiProvider = this.plugin.getAIProvider();
        }
        catch (e) {
            const errorMsg = getUserFriendlyMessage(e);
            new obsidian.Notice(errorMsg, 8000);
            return;
        }
        const results = await this.classifier.classifyInbox(inboxFiles, aiProvider, (message) => new obsidian.Notice(message, 2000));
        // 处理结果
        let movedCount = 0;
        let uncertainCount = 0;
        for (const { file, result, success } of results) {
            if (!success) {
                const errorMsg = getUserFriendlyMessage(new Error(result.reasoning));
                new obsidian.Notice(`${file.name}: ${errorMsg}`, 5000);
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
                        new obsidian.Notice(`${file.name} → ${result.category}`);
                    }
                }
                catch (e) {
                    const errorMsg = getUserFriendlyMessage(e);
                    new obsidian.Notice(`移动 ${file.name} 失败: ${errorMsg}`, 5000);
                }
            }
            else {
                new obsidian.Notice(`${file.name}: ${result.category} (${(result.confidence * 100).toFixed(0)}%)`);
            }
        }
        new obsidian.Notice(`分类完成！` +
            (movedCount > 0 ? `已移动 ${movedCount} 个文件` : '') +
            (uncertainCount > 0 ? `，${uncertainCount} 个文件需要确认` : ''));
    }
    /**
     * 分类当前打开的文件
     */
    async classifyCurrentFile() {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            new obsidian.Notice('没有打开的文件');
            return;
        }
        // 获取 AI Provider（带错误处理）
        let aiProvider;
        try {
            aiProvider = this.plugin.getAIProvider();
        }
        catch (e) {
            const errorMsg = getUserFriendlyMessage(e);
            new obsidian.Notice(errorMsg, 8000);
            return;
        }
        const result = await this.classifier.classifyFile(activeFile, aiProvider);
        if (!result.success) {
            const errorMsg = getUserFriendlyMessage(new Error(result.error || 'Unknown error'));
            new obsidian.Notice(errorMsg, 5000);
            return;
        }
        const { result: classification } = result;
        new obsidian.Notice(`分类: ${classification?.category} ` +
            `(${((classification?.confidence || 0) * 100).toFixed(0)}%)`);
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
                new obsidian.Notice(`${t('classify.moved')}${classification.category}`);
            }
            catch (e) {
                const errorMsg = getUserFriendlyMessage(e);
                new obsidian.Notice(`移动文件失败: ${errorMsg}`, 5000);
            }
        }
    }
    /**
     * 确认分类（用于低置信度情况）
     */
    confirmClassification(file, result) {
        return new Promise((resolve) => {
            const message = `${file.name}\n${t('classify.confirm')}${result.category}\n${t('classify.uncertain')}${((result.confidence || 0) * 100).toFixed(0)}%)`;
            if (result.suggestedCategory && this.plugin.settings.enableSuggestedCategories) {
                new obsidian.Notice(`${t('classify.suggestedCategory')}${result.suggestedCategory}`);
            }
            // 使用 Obsidian 的确认对话框
            const modal = new ConfirmModal(this.plugin.app, message, (confirmed) => {
                if (confirmed) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            });
            modal.open();
        });
    }
    /**
     * 查找收件箱中的所有笔记文件
     */
    findInboxFiles(inboxFolder) {
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
class ConfirmModal extends obsidian.Modal {
    message;
    onConfirm;
    constructor(app, message, onConfirm) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: this.message });
        const buttonContainer = contentEl.createDiv('button-container');
        const confirmBtn = buttonContainer.createEl('button', {
            text: 'Confirm',
            cls: 'mod-cta',
        });
        confirmBtn.addEventListener('click', () => {
            this.onConfirm(true);
            this.close();
        });
        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel',
        });
        cancelBtn.addEventListener('click', () => {
            this.onConfirm(false);
            this.close();
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}

/**
 * AI 提示词集中管理
 */
const SYSTEM_PROMPT = `你是专业的技术文章分类助手。

## 你的职责
1. 分析用户提供的文章内容
2. 从预定义分类列表中选择最匹配的一个
3. 返回结构化的分类结果

## 分类原则
1. **精确匹配**：优先选择与文章主题完全匹配的分类
2. **语义理解**：理解文章的技术领域和主题
3. **层级选择**：选择最具体的子分类，而非父分类
4. **合理推断**：基于标题和内容摘要进行推断

## 分类优先级
1. 编程/前端 (Frontend)：React, Vue, CSS, HTML, Web 开发等
2. 编程/后端 (Backend)：Node.js, Python, Java, API, Server 等
3. 编程/移动端 (Mobile)：iOS, Android, Flutter, React Native 等
4. 编程/DevOps：Docker, Kubernetes, CI/CD, Cloud 等
5. AI/机器学习：ML, 机器学习算法, 数据科学等
6. AI/深度学习：Deep Learning, Neural Network, TensorFlow, PyTorch 等
7. AI/NLP：自然语言处理, LLM, ChatGPT 等
8. 数据/数据库：Database, SQL, PostgreSQL, MongoDB 等
9. 数据/数据工程：ETL, Pipeline, Data Warehouse 等
10. 架构/系统设计：System Design, Architecture, Scalability 等
11. Other：无法归入上述分类的内容

## 输出格式
请以 JSON 格式返回结果：
{
  "category": "分类路径，如 '编程/前端'",
  "confidence": 0.0-1.0 的置信度分数,
  "reasoning": "简短的理由说明",
  "isUncertain": false,
  "suggestedCategory": "如果确实没有合适分类，建议的新分类名（可选）"
}

## 注意事项
- 如果文章明显属于某个领域，选择该领域的最具体分类
- 如果置信度低于 0.5，设置 isUncertain: true
- 始终返回一个合理的分类，不要返回空值`;
const USER_PROMPT_TEMPLATE = `请分析以下文章并分类：

## 文章标题
{{TITLE}}

## 文章内容摘要
{{CONTENT}}

## 可用分类列表
{{CATEGORIES}}

请从上述分类列表中选择最匹配的一个，并返回 JSON 格式的分类结果。`;

class OllamaProvider {
    name = 'Ollama';
    settings;
    logger;
    constructor(settings, logger) {
        this.settings = settings;
        this.logger = logger;
    }
    async testConnection() {
        try {
            // 验证 URL 格式
            validateUrl(this.settings.ollamaUrl, 'Ollama 地址');
            // 使用带超时的 fetch
            const response = await fetchWithTimeout(`${this.settings.ollamaUrl}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }, 10000 // 10 秒超时
            );
            if (response.ok) {
                return { success: true, message: 'Ollama 服务正常' };
            }
            else {
                return { success: false, message: `HTTP ${response.status}` };
            }
        }
        catch (e) {
            const message = getUserFriendlyMessage(e);
            return { success: false, message };
        }
    }
    async classify(content, title, categories) {
        // 使用带重试的操作
        return await withRetry(async () => {
            const userPrompt = USER_PROMPT_TEMPLATE
                .replace('{{TITLE}}', title)
                .replace('{{CONTENT}}', content.slice(0, 4000))
                .replace('{{CATEGORIES}}', categories.map(c => `- ${c}`).join('\n'));
            // 使用带超时的 fetch
            const response = await fetchWithTimeout(`${this.settings.ollamaUrl}/api/generate`, {
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
            }, 60000 // 60 秒超时（Ollama 可能较慢）
            );
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ollama API 错误: ${response.status}`);
            }
            const data = await response.json();
            return this.parseResponse(data.response);
        }, {
            maxAttempts: 3,
            initialDelay: 2000,
        }, 'Ollama classify');
    }
    parseResponse(response) {
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
            }
            catch {
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

class OpenAICompatibleProvider {
    name;
    config;
    logger;
    constructor(config, logger) {
        this.name = config.name;
        this.config = config;
        this.logger = logger;
    }
    async testConnection() {
        try {
            // 验证 API Key
            if (!this.config.apiKey || this.config.apiKey.trim() === '') {
                return { success: false, message: 'API Key 未设置，请先配置 API Key' };
            }
            // 验证 URL
            validateUrl(this.config.baseUrl, 'API 地址');
            // 使用带超时的 fetch
            const response = await fetchWithTimeout(`${this.config.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
            }, 10000 // 10 秒超时
            );
            if (response.ok) {
                return { success: true, message: `${this.name} API 连接正常` };
            }
            else if (response.status === 401) {
                return { success: false, message: 'API Key 无效或未授权，请检查是否正确' };
            }
            else {
                return { success: false, message: `HTTP ${response.status}: 服务暂时不可用` };
            }
        }
        catch (e) {
            const message = getUserFriendlyMessage(e);
            return { success: false, message };
        }
    }
    async classify(content, title, categories) {
        // 使用带重试的操作
        return await withRetry(async () => {
            const userPrompt = USER_PROMPT_TEMPLATE
                .replace('{{TITLE}}', title)
                .replace('{{CONTENT}}', content.slice(0, 4000))
                .replace('{{CATEGORIES}}', categories.map(c => `- ${c}`).join('\n'));
            // 使用带超时的 fetch
            const response = await fetchWithTimeout(`${this.config.baseUrl}/chat/completions`, {
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
            }, 30000 // 30 秒超时
            );
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const errorMsg = error.error?.message || `HTTP ${response.status}`;
                // 构造更详细的错误
                const enhancedError = new Error(errorMsg);
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
        }, {
            maxAttempts: 3,
            initialDelay: 1500,
        }, `${this.name} classify`);
    }
    parseResponse(responseText) {
        try {
            const parsed = JSON.parse(responseText);
            return {
                category: parsed.category || 'Other',
                confidence: parsed.confidence || 0.5,
                reasoning: parsed.reasoning || '',
                isUncertain: parsed.isUncertain || false,
                suggestedCategory: parsed.suggestedCategory,
            };
        }
        catch {
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

/**
 * 简单日志工具
 */
class Logger {
    enabled;
    prefix = '[AIClassifier]';
    constructor(enabled = false) {
        this.enabled = enabled;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    debug(message, ...args) {
        if (this.enabled) {
            console.debug(`${this.prefix} ${message}`, ...args);
        }
    }
    info(message, ...args) {
        console.debug(`${this.prefix} ${message}`, ...args);
    }
    warn(message, ...args) {
        console.warn(`${this.prefix} ${message}`, ...args);
    }
    error(message, ...args) {
        console.error(`${this.prefix} ${message}`, ...args);
    }
}

class AIClassifierPlugin extends obsidian.Plugin {
    // 插件设置
    settings = DEFAULT_SETTINGS;
    // 日志
    logger = new Logger();
    // 命令处理
    commands;
    // 设置面板
    settingsTab;
    async onload() {
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
        }
        catch (e) {
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
        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof obsidian.TFile) {
                menu.addItem((item) => {
                    item
                        .setTitle('AI智能分类')
                        .setIcon('sparkles')
                        .onClick(async () => {
                        await this.commands.classifyCurrentFile();
                    });
                });
            }
        }));
        // 3. 添加编辑器菜单（右上角更多菜单）
        this.registerEvent(this.app.workspace.on('editor-menu', (menu) => {
            menu.addItem((item) => {
                item
                    .setTitle('AI智能分类')
                    .setIcon('sparkles')
                    .onClick(async () => {
                    await this.commands.classifyCurrentFile();
                });
            });
        }));
        // 添加设置面板
        this.settingsTab = new SettingsTab(this.app, this);
        this.addSettingTab(this.settingsTab);
        console.debug('[AI Classifier] 插件加载完成!');
    }
    onunload() {
        console.debug('[AI Classifier] 插件已卸载');
    }
    /**
     * 获取 AI Provider 实例
     */
    getAIProvider() {
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
                throw new Error(`未知的 AI Provider: ${providerType}`);
            }
        }
    }
    /**
     * 验证 Provider 配置
     */
    validateProviderConfig(providerType) {
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
    async loadSettings() {
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
    async saveSettings() {
        await this.saveData(this.settings);
        this.logger.setEnabled(this.settings.enableDebugLog);
    }
    /**
     * 将分类树展平为列表
     */
    flattenCategories(tree, prefix = '') {
        const result = [];
        for (const [key, value] of Object.entries(tree)) {
            const path = prefix ? `${prefix}/${key}` : key;
            if (typeof value === 'object' && value !== null) {
                result.push(...this.flattenCategories(value, path));
            }
            else {
                result.push(path);
            }
        }
        return result;
    }
}

module.exports = AIClassifierPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3NyYy9zZXR0aW5ncy90eXBlcy50cyIsInNyYy9zcmMvc2V0dGluZ3MvaTE4bi50cyIsInNyYy9zcmMvc2V0dGluZ3MvQ2F0ZWdvcnlUcmVlVmlldy50cyIsInNyYy9zcmMvc2V0dGluZ3MvU2V0dGluZ3NUYWIudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NvbnRlbnRFeHRyYWN0b3IudHMiLCJzcmMvc3JjL3V0aWxzL2ZpbGVPcHMudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NsYXNzaWZpZXIudHMiLCJzcmMvc3JjL3V0aWxzL2Vycm9ySGFuZGxlci50cyIsInNyYy9zcmMvY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9wcm9tcHRzLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlci50cyIsInNyYy9zcmMvc2VydmljZXMvT3BlbkFJUHJvdmlkZXIudHMiLCJzcmMvc3JjL3V0aWxzL2xvZ2dlci50cyIsInNyYy9zcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgdHlwZSBBSVByb3ZpZGVyVHlwZSA9ICdvbGxhbWEnIHwgJ29wZW5haScgfCAnZGVlcHNlZWsnIHwgJ21vb25zaG90JyB8ICd6aGlwdSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2F0ZWdvcnlUcmVlIHtcblx0W25hbWU6IHN0cmluZ106IENhdGVnb3J5VHJlZSB8IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuXHQvLyBBSSDphY3nva5cblx0YWlQcm92aWRlcjogQUlQcm92aWRlclR5cGU7XG5cdG9sbGFtYVVybDogc3RyaW5nO1xuXHRvbGxhbWFNb2RlbDogc3RyaW5nO1xuXHRcblx0Ly8gT3BlbkFJIOmFjee9rlxuXHRvcGVuYWlBcGlLZXk6IHN0cmluZztcblx0b3BlbmFpTW9kZWw6IHN0cmluZztcblx0b3BlbmFpQXBpVXJsOiBzdHJpbmc7XG5cdFxuXHQvLyBEZWVwU2VlayDphY3nva5cblx0ZGVlcHNlZWtBcGlLZXk6IHN0cmluZztcblx0ZGVlcHNlZWtNb2RlbDogc3RyaW5nO1xuXHRkZWVwc2Vla0FwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gTW9vbnNob3QgKEtpbWkpIOmFjee9rlxuXHRtb29uc2hvdEFwaUtleTogc3RyaW5nO1xuXHRtb29uc2hvdE1vZGVsOiBzdHJpbmc7XG5cdG1vb25zaG90QXBpVXJsOiBzdHJpbmc7XG5cdFxuXHQvLyBaaGlwdSAo5pm66LCxIEFJKSDphY3nva5cblx0emhpcHVBcGlLZXk6IHN0cmluZztcblx0emhpcHVNb2RlbDogc3RyaW5nO1xuXHR6aGlwdUFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8g5YiG57G76YWN572uXG5cdGluYm94Rm9sZGVyOiBzdHJpbmc7XG5cdGNhdGVnb3J5VHJlZTogQ2F0ZWdvcnlUcmVlO1xuXHRjYXRlZ29yaWVzOiBzdHJpbmdbXTtcblx0c2NhblN1YmZvbGRlcnM6IGJvb2xlYW47XG5cdFxuXHQvLyDpq5jnuqflip/og71cblx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogYm9vbGVhbjtcblx0YXV0b01vdmVGaWxlOiBib29sZWFuO1xuXHRjb25maWRlbmNlVGhyZXNob2xkOiBudW1iZXI7XG5cdFxuXHQvLyDml6Xlv5dcblx0ZW5hYmxlRGVidWdMb2c6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcblx0YWlQcm92aWRlcjogJ29sbGFtYScsXG5cdG9sbGFtYVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MTE0MzQnLFxuXHRvbGxhbWFNb2RlbDogJ2xsYW1hMy4yJyxcblx0XG5cdC8vIE9wZW5BSSDpu5jorqTphY3nva5cblx0b3BlbmFpQXBpS2V5OiAnJyxcblx0b3BlbmFpTW9kZWw6ICdncHQtNG8tbWluaScsXG5cdG9wZW5haUFwaVVybDogJ2h0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEnLFxuXHRcblx0Ly8gRGVlcFNlZWsg6buY6K6k6YWN572uXG5cdGRlZXBzZWVrQXBpS2V5OiAnJyxcblx0ZGVlcHNlZWtNb2RlbDogJ2RlZXBzZWVrLWNoYXQnLFxuXHRkZWVwc2Vla0FwaVVybDogJ2h0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbS92MScsXG5cdFxuXHQvLyBNb29uc2hvdCAoS2ltaSkg6buY6K6k6YWN572uXG5cdG1vb25zaG90QXBpS2V5OiAnJyxcblx0bW9vbnNob3RNb2RlbDogJ21vb25zaG90LXYxLThrJyxcblx0bW9vbnNob3RBcGlVcmw6ICdodHRwczovL2FwaS5tb29uc2hvdC5jbi92MScsXG5cdFxuXHQvLyBaaGlwdSAo5pm66LCxKSDpu5jorqTphY3nva5cblx0emhpcHVBcGlLZXk6ICcnLFxuXHR6aGlwdU1vZGVsOiAnZ2xtLTQnLFxuXHR6aGlwdUFwaVVybDogJ2h0dHBzOi8vb3Blbi5iaWdtb2RlbC5jbi9hcGkvcGFhcy92NCcsXG5cdFxuXHRpbmJveEZvbGRlcjogJ0luYm94Jyxcblx0Y2F0ZWdvcnlUcmVlOiB7XG5cdFx0J1Byb2dyYW1taW5nJzoge1xuXHRcdFx0J0Zyb250ZW5kJzogdHJ1ZSxcblx0XHRcdCdCYWNrZW5kJzogdHJ1ZSxcblx0XHRcdCdNb2JpbGUnOiB0cnVlLFxuXHRcdFx0J0Rldk9wcyc6IHRydWUsXG5cdFx0fSxcblx0XHQnQUkgJiBNTCc6IHtcblx0XHRcdCdNYWNoaW5lIExlYXJuaW5nJzogdHJ1ZSxcblx0XHRcdCdEZWVwIExlYXJuaW5nJzogdHJ1ZSxcblx0XHRcdCdOTFAnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0RhdGEnOiB7XG5cdFx0XHQnRGF0YWJhc2UnOiB0cnVlLFxuXHRcdFx0J0RhdGEgRW5naW5lZXJpbmcnOiB0cnVlLFxuXHRcdFx0J0FuYWx5dGljcyc6IHRydWUsXG5cdFx0fSxcblx0XHQnQXJjaGl0ZWN0dXJlJzoge1xuXHRcdFx0J1N5c3RlbSBEZXNpZ24nOiB0cnVlLFxuXHRcdFx0J01pY3Jvc2VydmljZXMnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J090aGVyJzogdHJ1ZSxcblx0fSxcblx0Y2F0ZWdvcmllczogW10sXG5cdHNjYW5TdWJmb2xkZXJzOiB0cnVlLFxuXHRcblx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogZmFsc2UsXG5cdGF1dG9Nb3ZlRmlsZTogdHJ1ZSxcblx0Y29uZmlkZW5jZVRocmVzaG9sZDogMC43LFxuXHRcblx0ZW5hYmxlRGVidWdMb2c6IGZhbHNlLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdGNhdGVnb3J5OiBzdHJpbmc7XG5cdGNvbmZpZGVuY2U6IG51bWJlcjtcblx0cmVhc29uaW5nOiBzdHJpbmc7XG5cdGlzVW5jZXJ0YWluOiBib29sZWFuO1xuXHRzdWdnZXN0ZWRDYXRlZ29yeT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBSVByb3ZpZGVyIHtcblx0bmFtZTogc3RyaW5nO1xuXHR0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+O1xuXHRjbGFzc2lmeShjb250ZW50OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGNhdGVnb3JpZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD47XG59XG4iLCIvLyDlm73pmYXljJbmlK/mjIEgLSDlvZPliY3ku4XmlK/mjIHkuK3mlodcbmV4cG9ydCBjb25zdCB0cmFuc2xhdGlvbnMgPSB7XG5cdHNldHRpbmdzOiB7XG5cdFx0dGl0bGU6ICdBSeaZuuiDveWIhuexu+iuvue9ricsXG5cdFx0YWlQcm92aWRlcjogJ0FJIOaPkOS+m+WVhicsXG5cdFx0YWlQcm92aWRlckRlc2M6ICfpgInmi6kgQUkg5pyN5Yqh55qE5o+Q5L6b5pa5Jyxcblx0XHRvbGxhbWFVcmw6ICdPbGxhbWEg5Zyw5Z2AJyxcblx0XHRvbGxhbWFVcmxEZXNjOiAn5pys5ZywIE9sbGFtYSDmnI3liqHnmoTlnLDlnYAnLFxuXHRcdG9sbGFtYU1vZGVsOiAnT2xsYW1hIOaooeWeiycsXG5cdFx0b2xsYW1hTW9kZWxEZXNjOiAn5L2/55So55qE5qih5Z6L5ZCN56ewJyxcblx0XHRvcGVuYWlBcGlLZXk6ICdPcGVuQUkgQVBJIEtleScsXG5cdFx0b3BlbmFpQXBpS2V5RGVzYzogJ+aCqOeahCBPcGVuQUkgQVBJIOWvhumSpScsXG5cdFx0b3BlbmFpTW9kZWw6ICdPcGVuQUkg5qih5Z6LJyxcblx0XHRvcGVuYWlNb2RlbERlc2M6ICfkvb/nlKjnmoQgT3BlbkFJIOaooeWeiycsXG5cdFx0aW5ib3hGb2xkZXI6ICfmlLbku7bnrrHmlofku7blpLknLFxuXHRcdGluYm94Rm9sZGVyRGVzYzogJ+W+heWIhuexu+aWh+S7tuaJgOWcqOeahOaWh+S7tuWkuScsXG5cdFx0Y2F0ZWdvcnlUcmVlOiAn5YiG57G757uT5p6EJyxcblx0XHRjYXRlZ29yeVRyZWVEZXNjOiAn5a6a5LmJ5oKo55qE5YiG57G75qCR57uT5p6E77yISlNPTuagvOW8j++8iScsXG5cdFx0Y2F0ZWdvcmllczogJ+WIhuexu+WIl+ihqCcsXG5cdFx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogJ+WQr+eUqCBBSSDmjqjojZDmlrDliIbnsbsnLFxuXHRcdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXNEZXNjOiAn5b2T5paH56ug5peg5rOV5Yy56YWN546w5pyJ5YiG57G75pe277yMQUkg5Y+v5Lul5bu66K6u5paw5YiG57G7Jyxcblx0XHRhdXRvTW92ZUZpbGU6ICfoh6rliqjnp7vliqjmlofku7YnLFxuXHRcdGF1dG9Nb3ZlRmlsZURlc2M6ICfliIbnsbvlrozmiJDlkI7oh6rliqjlsIbmlofku7bnp7vliqjliLDlr7nlupTmlofku7blpLknLFxuXHRcdGNvbmZpZGVuY2VUaHJlc2hvbGQ6ICfnva7kv6HluqbpmIjlgLwnLFxuXHRcdGNvbmZpZGVuY2VUaHJlc2hvbGREZXNjOiAn5L2O5LqO5q2k572u5L+h5bqm5bCG5o+Q56S655So5oi356Gu6K6kJyxcblx0XHRlbmFibGVEZWJ1Z0xvZzogJ+WQr+eUqOiwg+ivleaXpeW/lycsXG5cdFx0ZW5hYmxlRGVidWdMb2dEZXNjOiAn5Zyo5o6n5Yi25Y+w6L6T5Ye66K+m57uG5pel5b+XJyxcblx0XHR0ZXN0Q29ubmVjdGlvbjogJ+a1i+ivlei/nuaOpScsXG5cdFx0Y29ubmVjdGlvblN1Y2Nlc3M6ICfov57mjqXmiJDlip/vvIEnLFxuXHRcdGNvbm5lY3Rpb25GYWlsZWQ6ICfov57mjqXlpLHotKXvvJonLFxuXHRcdHNhdmU6ICfkv53lrZjorr7nva4nLFxuXHRcdGNhdGVnb3JpZXNQbGFjZWhvbGRlcjogJ+e8lueoiy/liY3nq68sIOe8lueoiy/lkI7nq68sIEFJL+acuuWZqOWtpuS5oCwgLi4uJyxcblx0XHRhZGRUb3BMZXZlbDogJ+a3u+WKoOS4gOe6p+WIhuexuycsXG5cdFx0ZW50ZXJDYXRlZ29yeU5hbWU6ICfor7fovpPlhaXliIbnsbvlkI3np7AnLFxuXHRcdGVudGVyTmV3TmFtZTogJ+ivt+i+k+WFpeaWsOWQjeensCcsXG5cdFx0Y2F0ZWdvcnlFeGlzdHM6ICfliIbnsbvlt7LlrZjlnKgnLFxuXHRcdGNvbmZpcm1EZWxldGU6ICfnoa7orqTliKDpmaTmraTliIbnsbvvvJ8nLFxuXHRcdGNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW46ICfmraTliIbnsbvljIXlkKvlrZDliIbnsbvvvIznoa7orqTliKDpmaTmiYDmnInlrZDliIbnsbvlkJfvvJ8nLFxuXHRcdHJlc3RvcmVEZWZhdWx0OiAn5oGi5aSN6buY6K6kJyxcblx0XHRjb25maXJtUmVzdG9yZURlZmF1bHQ6ICfnoa7orqTmgaLlpI3pu5jorqTliIbnsbvmoJHvvJ/lvZPliY3nmoToh6rlrprkuYnphY3nva7lsIbkuKLlpLHjgIInLFxuXHR9LFxuXHRjbGFzc2lmeToge1xuXHRcdGNvbW1hbmQ6ICdBSeaZuuiDveWIhuexuycsXG5cdFx0Y2xhc3NpZnlJbmJveDogJ+WIhuexu+aUtuS7tueusScsXG5cdFx0Y2xhc3NpZnlDdXJyZW50OiAn5YiG57G75b2T5YmN5paH5Lu2Jyxcblx0XHRwcm9jZXNzaW5nOiAn5q2j5Zyo5YiG5p6QOiAnLFxuXHRcdHN1Y2Nlc3M6ICfliIbnsbvlrozmiJAnLFxuXHRcdG1vdmVkOiAn5bey56e75Yqo5YiwOiAnLFxuXHRcdHVuY2VydGFpbjogJ+e9ruS/oeW6pui+g+S9jiAoJyxcblx0XHRjb25maXJtOiAn5piv5ZCm56Gu6K6k5YiG57G75YiwOiAnLFxuXHRcdGxvd0NvbmZpZGVuY2U6ICfnva7kv6Hluqbov4fkvY7vvIzor7fmiYvliqjnoa7orqQnLFxuXHRcdHN1Z2dlc3RlZENhdGVnb3J5OiAn5bu66K6u5paw5aKe5YiG57G7OiAnLFxuXHRcdGFkZENhdGVnb3J5OiAn5piv5ZCm5bCG5q2k5YiG57G75re75Yqg5Yiw6aKE6K6+PycsXG5cdFx0bm9JbmJveDogJ+acquaJvuWIsOaUtuS7tueuseaWh+S7tuWkuTogJyxcblx0XHRub0ZpbGVzOiAn5pS25Lu2566x5Lit5rKh5pyJ5paH5Lu2Jyxcblx0XHRza2lwOiAn6Lez6L+HJyxcblx0fSxcblx0ZXJyb3JzOiB7XG5cdFx0bm9Db250ZW50OiAn5peg5rOV5o+Q5Y+W5paH5Lu25YaF5a65Jyxcblx0XHRub1RpdGxlOiAn5peg5rOV6I635Y+W5paH5Lu25qCH6aKYJyxcblx0XHRhaUVycm9yOiAnQUkg5pyN5Yqh6ZSZ6K+vOiAnLFxuXHRcdG1vdmVFcnJvcjogJ+enu+WKqOaWh+S7tuWksei0pTogJyxcblx0fSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB0KGtleTogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qga2V5cyA9IGtleS5zcGxpdCgnLicpO1xuXHRsZXQgcmVzdWx0OiB1bmtub3duID0gdHJhbnNsYXRpb25zO1xuXHRmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuXHRcdHJlc3VsdCA9IChyZXN1bHQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pPy5ba107XG5cdH1cblx0cmV0dXJuIChyZXN1bHQgYXMgc3RyaW5nKSB8fCBrZXk7XG59XG4iLCJpbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcbmltcG9ydCB7IEFwcCwgTW9kYWwsIE5vdGljZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLy8g5aOw5piO5YWo5bGAIGFwcCDlj5jph49cbmRlY2xhcmUgY29uc3QgYXBwOiBBcHA7XG5cbi8qKlxuICog5YiG57G75qCR6IqC54K55pWw5o2u57uT5p6EXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2F0ZWdvcnlOb2RlIHtcblx0bmFtZTogc3RyaW5nO1xuXHRjaGlsZHJlbj86IENhdGVnb3J5Tm9kZVtdO1xufVxuXG4vKipcbiAqIOWIhuexu+agkeiKgueCueexu+Wei1xuICovXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5VHJlZU5vZGUge1xuXHRba2V5OiBzdHJpbmddOiBDYXRlZ29yeVRyZWVOb2RlIHwgYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDliIbnsbvmoJHlj6/op4bljJbnu4Tku7ZcbiAqL1xuZXhwb3J0IGNsYXNzIENhdGVnb3J5VHJlZVZpZXcge1xuXHRwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0cmVlOiBDYXRlZ29yeVRyZWVOb2RlO1xuXHRwcml2YXRlIG9uQ2hhbmdlOiAodHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSkgPT4gdm9pZDtcblx0cHJpdmF0ZSBleHBhbmRlZE5vZGVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0dHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSxcblx0XHRvbkNoYW5nZTogKHRyZWU6IENhdGVnb3J5VHJlZU5vZGUpID0+IHZvaWRcblx0KSB7XG5cdFx0dGhpcy5jb250YWluZXJFbCA9IGNvbnRhaW5lckVsO1xuXHRcdHRoaXMudHJlZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodHJlZSkpOyAvLyDmt7Hmi7fotJ1cblx0XHR0aGlzLm9uQ2hhbmdlID0gb25DaGFuZ2U7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmuLLmn5PmlbTkuKrmoJFcblx0ICovXG5cdHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHR0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKCdjYXRlZ29yeS10cmVlLWNvbnRhaW5lcicpO1xuXG5cdFx0Ly8g5riy5p+T5qCR5b2i57uT5p6EXG5cdFx0Y29uc3QgdHJlZUVsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUnKTtcblx0XHR0aGlzLnJlbmRlclRyZWVMZXZlbCh0cmVlRWwsIHRoaXMudHJlZSwgJycpO1xuXG5cdFx0Ly8g5re75Yqg5LiA57qn5YiG57G75oyJ6ZKuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtYWN0aW9ucycpO1xuXHRcdGNvbnN0IGFkZEJ0biA9IGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0XHR0ZXh0OiB0KCdzZXR0aW5ncy5hZGRUb3BMZXZlbCcpXG5cdFx0fSk7XG5cdFx0YWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5hZGRUb3BMZXZlbENhdGVnb3J5KCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5riy5p+T5qCR55qE5p+Q5LiA57qnXG5cdCAqL1xuXHRwcml2YXRlIHJlbmRlclRyZWVMZXZlbChcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG5vZGU6IENhdGVnb3J5VHJlZU5vZGUsXG5cdFx0cGF0aDogc3RyaW5nXG5cdCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGUpKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50UGF0aCA9IHBhdGggPyBgJHtwYXRofS8ke2tleX1gIDoga2V5O1xuXHRcdFx0Y29uc3QgaGFzQ2hpbGRyZW4gPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPiAwO1xuXHRcdFx0Y29uc3QgaXNFeHBhbmRlZCA9IHRoaXMuZXhwYW5kZWROb2Rlcy5oYXMoY3VycmVudFBhdGgpO1xuXG5cdFx0XHQvLyDliJvlu7roioLngrnlrrnlmahcblx0XHRcdGNvbnN0IG5vZGVFbCA9IGNvbnRhaW5lci5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUnKTtcblxuXHRcdFx0Ly8g6IqC54K56KGM77yI5ZCN56ewICsg5pON5L2c5oyJ6ZKu77yJXG5cdFx0XHRjb25zdCBub2RlUm93ID0gbm9kZUVsLmNyZWF0ZURpdignY2F0ZWdvcnktbm9kZS1yb3cnKTtcblxuXHRcdFx0Ly8g5bGV5byAL+aKmOWPoOaMiemSru+8iOS7heW9k+acieWtkOiKgueCueaXtuaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IGV4cGFuZEJ0biA9IG5vZGVSb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1leHBhbmQtYnRuJyxcblx0XHRcdFx0XHR0ZXh0OiBpc0V4cGFuZGVkID8gJ+KWvCcgOiAn4pa2J1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZXhwYW5kQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpc0V4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4cGFuZGVkTm9kZXMuZGVsZXRlKGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5leHBhbmRlZE5vZGVzLmFkZChjdXJyZW50UGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8g5Y2g5L2N56ym77yM5L+d5oyB5a+56b2QXG5cdFx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7IGNsczogJ2NhdGVnb3J5LWV4cGFuZC1wbGFjZWhvbGRlcicsIHRleHQ6ICfjgIAnIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyDlm77moIdcblx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWljb24nLFxuXHRcdFx0XHR0ZXh0OiBoYXNDaGlsZHJlbiA/ICfwn5OCJyA6ICfwn5OEJ1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWQjeensFxuXHRcdFx0bm9kZVJvdy5jcmVhdGVFbCgnc3BhbicsIHtcblx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktbmFtZScsXG5cdFx0XHRcdHRleHQ6IGtleVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOaTjeS9nOaMiemSruWuueWZqFxuXHRcdFx0Y29uc3QgYWN0aW9uc0VsID0gbm9kZVJvdy5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUtYWN0aW9ucycpO1xuXG5cdFx0XHQvLyDnvJbovpHmjInpkq5cblx0XHRcdGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1hY3Rpb24tYnRuJyxcblx0XHRcdFx0dGV4dDogJ+Kcj++4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXROb2RlKGN1cnJlbnRQYXRoLCBrZXkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWIoOmZpOaMiemSrlxuXHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWFjdGlvbi1idG4nLFxuXHRcdFx0XHR0ZXh0OiAn8J+Xke+4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRlbGV0ZU5vZGUoY3VycmVudFBhdGgsIGtleSwgaGFzQ2hpbGRyZW4pO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOa3u+WKoOWtkOWIhuexu+aMiemSru+8iOS7heWvueeItuiKgueCueaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktYWN0aW9uLWJ0bicsXG5cdFx0XHRcdFx0dGV4dDogJ+KelSdcblx0XHRcdFx0fSkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5hZGRDaGlsZENhdGVnb3J5KGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIOa4suafk+WtkOiKgueCuVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuICYmIGlzRXhwYW5kZWQpIHtcblx0XHRcdFx0Y29uc3QgY2hpbGRyZW5FbCA9IG5vZGVFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LWNoaWxkcmVuJyk7XG5cdFx0XHRcdHRoaXMucmVuZGVyVHJlZUxldmVsKGNoaWxkcmVuRWwsIHZhbHVlLCBjdXJyZW50UGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIOa3u+WKoOS4gOe6p+WIhuexu1xuXHQgKi9cblx0cHJpdmF0ZSBhZGRUb3BMZXZlbENhdGVnb3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuc2hvd1Byb21wdE1vZGFsKFxuXHRcdFx0dCgnc2V0dGluZ3MuZW50ZXJDYXRlZ29yeU5hbWUnKSxcblx0XHRcdCcnLFxuXHRcdFx0KG5hbWUpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMudHJlZVtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudHJlZVtuYW1lXSA9IHt9O1xuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5re75Yqg5a2Q5YiG57G7XG5cdCAqL1xuXHRwcml2YXRlIGFkZENoaWxkQ2F0ZWdvcnkocGFyZW50UGF0aDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zaG93UHJvbXB0TW9kYWwoXG5cdFx0XHR0KCdzZXR0aW5ncy5lbnRlckNhdGVnb3J5TmFtZScpLFxuXHRcdFx0JycsXG5cdFx0XHQobmFtZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLmdldE5vZGVCeVBhdGgocGFyZW50UGF0aCk7XG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGFyZW50W25hbWVdID0ge307XG5cdFx0XHRcdHRoaXMuZXhwYW5kZWROb2Rlcy5hZGQocGFyZW50UGF0aCk7XG5cdFx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDnvJbovpHoioLngrnlkI3np7Bcblx0ICovXG5cdHByaXZhdGUgZWRpdE5vZGUocGF0aDogc3RyaW5nLCBvbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNob3dQcm9tcHRNb2RhbChcblx0XHRcdHQoJ3NldHRpbmdzLmVudGVyTmV3TmFtZScpLFxuXHRcdFx0b2xkTmFtZSxcblx0XHRcdChuZXdOYW1lKSA9PiB7XG5cdFx0XHRcdGlmICghbmV3TmFtZSB8fCBuZXdOYW1lLnRyaW0oKSA9PT0gJycgfHwgbmV3TmFtZSA9PT0gb2xkTmFtZSkgcmV0dXJuO1xuXG5cdFx0XHRcdGNvbnN0IHBhdGhQYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRQYXRoID8gdGhpcy5nZXROb2RlQnlQYXRoKHBhcmVudFBhdGgpIDogdGhpcy50cmVlO1xuXG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuZXdOYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8g6YeN5ZG95ZCNXG5cdFx0XHRcdHBhcmVudFtuZXdOYW1lXSA9IHBhcmVudFtvbGROYW1lXTtcblx0XHRcdFx0ZGVsZXRlIHBhcmVudFtvbGROYW1lXTtcblxuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5Yig6Zmk6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGRlbGV0ZU5vZGUocGF0aDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGhhc0NoaWxkcmVuOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGhhc0NoaWxkcmVuXG5cdFx0XHQ/IHQoJ3NldHRpbmdzLmNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW4nKVxuXHRcdFx0OiB0KCdzZXR0aW5ncy5jb25maXJtRGVsZXRlJyk7XG5cblx0XHR0aGlzLnNob3dDb25maXJtTW9kYWwobWVzc2FnZSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gcGFyZW50UGF0aCA/IHRoaXMuZ2V0Tm9kZUJ5UGF0aChwYXJlbnRQYXRoKSA6IHRoaXMudHJlZTtcblxuXHRcdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdFx0ZGVsZXRlIHBhcmVudFtuYW1lXTtcblx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5qC55o2u6Lev5b6E6I635Y+W6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGdldE5vZGVCeVBhdGgocGF0aDogc3RyaW5nKTogQ2F0ZWdvcnlUcmVlTm9kZSB8IG51bGwge1xuXHRcdGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdGxldCBjdXJyZW50OiBDYXRlZ29yeVRyZWVOb2RlID0gdGhpcy50cmVlO1xuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG5cdFx0XHRjb25zdCBjaGlsZCA9IGN1cnJlbnRbcGFydF07XG5cdFx0XHRpZiAoIWNoaWxkIHx8IHR5cGVvZiBjaGlsZCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50ID0gY2hpbGQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGN1cnJlbnQ7XG5cdH1cblxuXHQvKipcblx0ICog6YCa55+l5aSW6YOo5qCR5bey5pu05pawXG5cdCAqL1xuXHRwcml2YXRlIG5vdGlmeUNoYW5nZSgpOiB2b2lkIHtcblx0XHR0aGlzLm9uQ2hhbmdlKHRoaXMudHJlZSk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmm7TmlrDmoJHmlbDmja7vvIjlpJbpg6josIPnlKjvvIlcblx0ICovXG5cdHVwZGF0ZVRyZWUobmV3VHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSk6IHZvaWQge1xuXHRcdHRoaXMudHJlZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobmV3VHJlZSkpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHQvKipcblx0ICog5pi+56S66L6T5YWl5a+56K+d5qGGXG5cdCAqL1xuXHRwcml2YXRlIHNob3dQcm9tcHRNb2RhbChcblx0XHRwbGFjZWhvbGRlcjogc3RyaW5nLFxuXHRcdGRlZmF1bHRWYWx1ZTogc3RyaW5nLFxuXHRcdG9uU3VibWl0OiAodmFsdWU6IHN0cmluZykgPT4gdm9pZFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RhbCA9IG5ldyBJbnB1dE1vZGFsKFxuXHRcdFx0cGxhY2Vob2xkZXIsXG5cdFx0XHRkZWZhdWx0VmFsdWUsXG5cdFx0XHRvblN1Ym1pdFxuXHRcdCk7XG5cdFx0bW9kYWwub3BlbigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOaYvuekuuehruiupOWvueivneahhlxuXHQgKi9cblx0cHJpdmF0ZSBzaG93Q29uZmlybU1vZGFsKFxuXHRcdG1lc3NhZ2U6IHN0cmluZyxcblx0XHRvbkNvbmZpcm06ICgpID0+IHZvaWRcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kYWwgPSBuZXcgQ29uZmlybU1vZGFsKFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdG9uQ29uZmlybVxuXHRcdCk7XG5cdFx0bW9kYWwub3BlbigpO1xuXHR9XG59XG5cbi8qKlxuICog6L6T5YWl5a+56K+d5qGGXG4gKi9cbmNsYXNzIElucHV0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgcGxhY2Vob2xkZXI6IHN0cmluZztcblx0cHJpdmF0ZSBkZWZhdWx0VmFsdWU6IHN0cmluZztcblx0cHJpdmF0ZSBvblN1Ym1pdDogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cGxhY2Vob2xkZXI6IHN0cmluZyxcblx0XHRkZWZhdWx0VmFsdWU6IHN0cmluZyxcblx0XHRvblN1Ym1pdDogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWRcblx0KSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG5cdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWU7XG5cdFx0dGhpcy5vblN1Ym1pdCA9IG9uU3VibWl0O1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogdGhpcy5wbGFjZWhvbGRlciB9KTtcblxuXHRcdGNvbnN0IGlucHV0ID0gY29udGVudEVsLmNyZWF0ZUVsKCdpbnB1dCcsIHtcblx0XHRcdHR5cGU6ICd0ZXh0Jyxcblx0XHRcdHZhbHVlOiB0aGlzLmRlZmF1bHRWYWx1ZSxcblx0XHRcdGNsczogJ21vZGFsLWlucHV0J1xuXHRcdH0pO1xuXG5cdFx0Ly8g55uR5ZCs5Zue6L2m6ZSuXG5cdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcblx0XHRcdFx0dGhpcy5vblN1Ym1pdChpbnB1dC52YWx1ZSk7XG5cdFx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGJ1dHRvbnNFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ21vZGFsLWJ1dHRvbi1jb250YWluZXInKTtcblxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyB0ZXh0OiAnQ2FuY2VsJyB9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlKCkpO1xuXG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NvbmZpcm0nLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vblN1Ym1pdChpbnB1dC52YWx1ZSk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cblx0XHQvLyDoh6rliqjogZrnhKZcblx0XHRpbnB1dC5mb2N1cygpO1xuXHRcdGlucHV0LnNlbGVjdCgpO1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0fVxufVxuXG4vKipcbiAqIOehruiupOWvueivneahhlxuICovXG5jbGFzcyBDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgbWVzc2FnZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0b25Db25maXJtOiAoKSA9PiB2b2lkXG5cdCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLm9uQ29uZmlybSA9IG9uQ29uZmlybTtcblx0fVxuXG5cdG9uT3BlbigpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IHRoaXMubWVzc2FnZSB9KTtcblxuXHRcdGNvbnN0IGJ1dHRvbnNFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ21vZGFsLWJ1dHRvbi1jb250YWluZXInKTtcblxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyB0ZXh0OiAnQ2FuY2VsJyB9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlKCkpO1xuXG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NvbmZpcm0nLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oKTtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlLCBNb2RhbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB0eXBlIEFJQ2xhc3NpZmllclBsdWdpbiBmcm9tICcuLi9tYWluJztcbmltcG9ydCB7IEFJUHJvdmlkZXJUeXBlLCBERUZBVUxUX1NFVFRJTkdTLCBDYXRlZ29yeVRyZWUgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgQ2F0ZWdvcnlUcmVlVmlldywgQ2F0ZWdvcnlUcmVlTm9kZSB9IGZyb20gJy4vQ2F0ZWdvcnlUcmVlVmlldyc7XG5cbi8vIOWQhOacjeWKoeWVhuWPr+eUqOaooeWei+WIl+ihqFxuY29uc3QgQVZBSUxBQkxFX01PREVMUzogUmVjb3JkPHN0cmluZywgQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+PiA9IHtcblx0b3BlbmFpOiBbXG5cdFx0eyB2YWx1ZTogJ2dwdC00by1taW5pJywgbGFiZWw6ICdHUFQtNG8gTWluaSAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTRvJywgbGFiZWw6ICdHUFQtNG8nIH0sXG5cdFx0eyB2YWx1ZTogJ2dwdC00LXR1cmJvJywgbGFiZWw6ICdHUFQtNCBUdXJibycgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTMuNS10dXJibycsIGxhYmVsOiAnR1BULTMuNSBUdXJibycgfSxcblx0XSxcblx0ZGVlcHNlZWs6IFtcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY2hhdCcsIGxhYmVsOiAnRGVlcFNlZWsgQ2hhdCAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY29kZXInLCBsYWJlbDogJ0RlZXBTZWVrIENvZGVyJyB9LFxuXHRdLFxuXHRtb29uc2hvdDogW1xuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS04aycsIGxhYmVsOiAnTW9vbnNob3QgVjEgOEsgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ21vb25zaG90LXYxLTMyaycsIGxhYmVsOiAnTW9vbnNob3QgVjEgMzJLJyB9LFxuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS0xMjhrJywgbGFiZWw6ICdNb29uc2hvdCBWMSAxMjhLJyB9LFxuXHRdLFxuXHR6aGlwdTogW1xuXHRcdHsgdmFsdWU6ICdnbG0tNCcsIGxhYmVsOiAnR0xNLTQgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ2dsbS00LWZsYXNoJywgbGFiZWw6ICdHTE0tNCBGbGFzaCcgfSxcblx0XHR7IHZhbHVlOiAnZ2xtLTMtdHVyYm8nLCBsYWJlbDogJ0dMTS0zIFR1cmJvJyB9LFxuXHRdLFxufTtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luO1xuXHRcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cdFxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHRcblx0XHQvLyDpobbpg6jlr7zoiKrmoI9cblx0XHRjb25zdCBoZWFkZXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignc2V0dGluZ3MtaGVhZGVyJyk7XG5cdFx0XG5cdFx0Ly8g6L+U5Zue5oyJ6ZKuXG5cdFx0Y29uc3QgYmFja0J0biA9IGhlYWRlckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRjbHM6ICdzZXR0aW5ncy1iYWNrLWJ0biBjbGlja2FibGUtaWNvbicsXG5cdFx0XHRhdHRyOiB7XG5cdFx0XHRcdCdhcmlhLWxhYmVsJzogJ0JhY2sgdG8gcHJldmlvdXMgbGV2ZWwnLFxuXHRcdFx0XHQndGl0bGUnOiAnQmFjayB0byBwcmV2aW91cyBsZXZlbCdcblx0XHRcdH1cblx0XHR9KTtcblx0XHRcblx0XHQvLyDliJvlu7ogU1ZHIOWbvuagh1xuXHRcdGNvbnN0IHN2ZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAnc3ZnJyk7XG5cdFx0c3ZnLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCAnMjQnKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCAnMjQnKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgJzAgMCAyNCAyNCcpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ2ZpbGwnLCAnbm9uZScpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3N0cm9rZScsICdjdXJyZW50Q29sb3InKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCdzdHJva2Utd2lkdGgnLCAnMicpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3N0cm9rZS1saW5lY2FwJywgJ3JvdW5kJyk7XG5cdFx0c3ZnLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLWxpbmVqb2luJywgJ3JvdW5kJyk7XG5cdFx0XG5cdFx0Y29uc3QgcGF0aCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAncGF0aCcpO1xuXHRcdHBhdGguc2V0QXR0cmlidXRlKCdkJywgJ20xNSAxOC02LTYgNi02Jyk7XG5cdFx0c3ZnLmFwcGVuZENoaWxkKHBhdGgpO1xuXHRcdGJhY2tCdG4uYXBwZW5kQ2hpbGQoc3ZnKTtcblx0XHRcblx0XHRiYWNrQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0Ly8g55u05o6l6Kem5Y+RIE9ic2lkaWFuIOiHquW4pueahOi/lOWbnuWKn+iDvVxuXHRcdFx0Ly8g5p+l5om+6K6+572u5L6n6L655qCP5Lit55qE56ys5LiA5Liq5o+S5Lu26YCJ6aG55bm254K55Ye7XG5cdFx0XHRjb25zdCBjb21tdW5pdHlQbHVnaW5OYXZJdGVtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm5hdi1mb2xkZXIubW9kLXJvb3QgPiAubmF2LWZvbGRlci10aXRsZScpO1xuXHRcdFx0aWYgKGNvbW11bml0eVBsdWdpbk5hdkl0ZW0pIHtcblx0XHRcdFx0KGNvbW11bml0eVBsdWdpbk5hdkl0ZW0gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyDlpoLmnpzmib7kuI3liLDvvIzlsJ3or5Xngrnlh7vku7vkvZXkuIDkuKrkvqfovrnmoI/poblcblx0XHRcdFx0Y29uc3QgYW55TmF2SXRlbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy52ZXJ0aWNhbC10YWItbmF2LWl0ZW0nKTtcblx0XHRcdFx0aWYgKGFueU5hdkl0ZW0pIHtcblx0XHRcdFx0XHQoYW55TmF2SXRlbSBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIOagh+mimFxuXHRcdG5ldyBTZXR0aW5nKGhlYWRlckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MudGl0bGUnKSlcblx0XHRcdC5zZXRIZWFkaW5nKCk7XG5cdFx0XG5cdFx0dGhpcy5hZGRBSVByb3ZpZGVyU2VjdGlvbigpO1xuXHRcdHRoaXMuYWRkQ2F0ZWdvcnlTZWN0aW9uKCk7XG5cdFx0dGhpcy5hZGRBZHZhbmNlZFNlY3Rpb24oKTtcblx0XHR0aGlzLmFkZERlYnVnU2VjdGlvbigpO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZEFJUHJvdmlkZXJTZWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnQUkgY29uZmlndXJhdGlvbicpXG5cdFx0XHQuc2V0SGVhZGluZygpO1xuXHRcdFxuXHRcdC8vIEFJIOaPkOS+m+WVhumAieaLqVxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuYWlQcm92aWRlcicpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuYWlQcm92aWRlckRlc2MnKSlcblx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignb2xsYW1hJywgJ09sbGFtYSAobG9jYWwpJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdvcGVuYWknLCAnT3BlbkFpJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdkZWVwc2VlaycsICdEZWVwc2VlaycpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignbW9vbnNob3QnLCAnTW9vbnNob3QgKGtpbWkpJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCd6aGlwdScsICdaaGlwdSBBSScpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciA9IHZhbHVlIGFzIEFJUHJvdmlkZXJUeXBlO1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XG5cdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIgPT09ICdvbGxhbWEnKSB7XG5cdFx0XHQvLyBPbGxhbWEg6YWN572uXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3Mub2xsYW1hVXJsJykpXG5cdFx0XHRcdC5zZXREZXNjKHQoJ3NldHRpbmdzLm9sbGFtYVVybERlc2MnKSlcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hVXJsKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm9sbGFtYVVybCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5vbGxhbWFNb2RlbCcpKVxuXHRcdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5vbGxhbWFNb2RlbERlc2MnKSlcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBUEkgS2V5IOmFjee9rlxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIEtleWApXG5cdFx0XHRcdC5zZXREZXNjKGDor7fovpPlhaUgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOeahCBBUEkgS2V5YClcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5nZXRQcm92aWRlclZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdhcGlLZXknKSlcblx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ0FQSSBrZXkuLi4nKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvdmlkZXJDb25maWcodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2FwaUtleScsIHZhbHVlKTtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLnR5cGUgPSAncGFzc3dvcmQnO1xuXHRcdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gTW9kZWwg6YWN572u77yI5LiL5ouJ6YCJ5oup77yJXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUoYCR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSDmqKHlnotgKVxuXHRcdFx0XHQuc2V0RGVzYyhg6K+36YCJ5oupICR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSDnmoTmqKHlnotgKVxuXHRcdFx0XHQuYWRkRHJvcGRvd24oZHJvcGRvd24gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVscyA9IHRoaXMuZ2V0QXZhaWxhYmxlTW9kZWxzKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpO1xuXHRcdFx0XHRcdG1vZGVscy5mb3JFYWNoKG1vZGVsID0+IHtcblx0XHRcdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihtb2RlbC52YWx1ZSwgbW9kZWwubGFiZWwpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLmdldFByb3ZpZGVyVmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ21vZGVsJykpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlckNvbmZpZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnbW9kZWwnLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gQVBJIFVSTCDphY3nva7vvIjpq5jnuqfpgInpobnvvIlcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZShgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IEFQSSDlnLDlnYBgKVxuXHRcdFx0XHQuc2V0RGVzYygn6Ieq5a6a5LmJIEFQSSDnq6/ngrnlnLDlnYDvvIjlj6/pgInvvIznlZnnqbrkvb/nlKjlrpjmlrnlnLDlnYDvvIknKVxuXHRcdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLmdldFByb3ZpZGVyVmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2Jhc2VVcmwnKSlcblx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ2h0dHBzOi8vYXBpLmV4YW1wbGUuY29tL3YxJylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb3ZpZGVyQ29uZmlnKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdiYXNlVXJsJywgdmFsdWUpO1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOa1i+ivlei/nuaOpeaMiemSrlxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LmFkZEJ1dHRvbihidXR0b24gPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dCh0KCdzZXR0aW5ncy50ZXN0Q29ubmVjdGlvbicpKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGJ1dHRvbi5zZXREaXNhYmxlZCh0cnVlKTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wbHVnaW4uZ2V0QUlQcm92aWRlcigpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci50ZXN0Q29ubmVjdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdFx0XHRuZXcgTm90aWNlKHQoJ3NldHRpbmdzLmNvbm5lY3Rpb25TdWNjZXNzJykpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvbkZhaWxlZCcpICsgcmVzdWx0Lm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvbkZhaWxlZCcpICsgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLnNldERpc2FibGVkKGZhbHNlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZENhdGVnb3J5U2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ0NhdGVnb3J5IGNvbmZpZ3VyYXRpb24nKVxuXHRcdFx0LnNldEhlYWRpbmcoKTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmluYm94Rm9sZGVyJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5pbmJveEZvbGRlckRlc2MnKSlcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmJveEZvbGRlcilcblx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmluYm94Rm9sZGVyID0gdmFsdWU7XG5cdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdTY2FuIHN1YmZvbGRlcnMnKVxuXHRcdFx0LnNldERlc2MoJ1doZXRoZXIgdG8gcmVjdXJzaXZlbHkgc2NhbiBmaWxlcyBpbiBpbmJveCBzdWJkaXJlY3Rvcmllcy4gRGlzYWJsZSB0byBvbmx5IGNsYXNzaWZ5IGZpbGVzIGF0IHRoZSB0b3AgbGV2ZWwgb2YgaW5ib3guJylcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHtcblx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycylcblx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNjYW5TdWJmb2xkZXJzID0gdmFsdWU7XG5cdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHQvLyDlj6/op4bljJbliIbnsbvmoJFcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmNhdGVnb3J5VHJlZScpKVxuXHRcdFx0LnNldEhlYWRpbmcoKTtcblx0XHRcblx0XHRjb25zdCB0cmVlQ29udGFpbmVyID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KCdjYXRlZ29yeS10cmVlLXdyYXBwZXInKTtcblx0XHRcblx0XHRuZXcgQ2F0ZWdvcnlUcmVlVmlldyhcblx0XHRcdHRyZWVDb250YWluZXIsXG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYXRlZ29yeVRyZWUgYXMgQ2F0ZWdvcnlUcmVlTm9kZSxcblx0XHRcdChuZXdUcmVlKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSA9IG5ld1RyZWUgYXMgQ2F0ZWdvcnlUcmVlO1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyhuZXdUcmVlKTtcblx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH1cblx0XHQpO1xuXHRcdFxuXHRcdC8vIOaTjeS9nOaMiemSrlxuXHRcdGNvbnN0IGFjdGlvbnNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignY2F0ZWdvcnktdHJlZS1mb290ZXInKTtcblx0XHRuZXcgU2V0dGluZyhhY3Rpb25zRWwpXG5cdFx0XHQuYWRkQnV0dG9uKGJ0biA9PiB7XG5cdFx0XHRcdGJ0bi5zZXRCdXR0b25UZXh0KHQoJ3NldHRpbmdzLnJlc3RvcmVEZWZhdWx0JykpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5zaG93UmVzdG9yZUNvbmZpcm0oKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIHNob3dSZXN0b3JlQ29uZmlybSgpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RhbCA9IG5ldyBSZXN0b3JlQ29uZmlybU1vZGFsKFxuXHRcdFx0dGhpcy5hcHAsXG5cdFx0XHQoKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSA9IERFRkFVTFRfU0VUVElOR1MuY2F0ZWdvcnlUcmVlO1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyhERUZBVUxUX1NFVFRJTkdTLmNhdGVnb3J5VHJlZSk7XG5cdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpOyAvLyDliLfmlrDorr7nva7pnaLmnb9cblx0XHRcdH1cblx0XHQpO1xuXHRcdG1vZGFsLm9wZW4oKTtcblx0fVxuXHRcblx0cHJpdmF0ZSBhZGRBZHZhbmNlZFNlY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdBZHZhbmNlZCcpXG5cdFx0XHQuc2V0SGVhZGluZygpO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcycpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllc0Rlc2MnKSlcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHtcblx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzKVxuXHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcyA9IHZhbHVlO1xuXHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5hdXRvTW92ZUZpbGUnKSlcblx0XHRcdC5zZXREZXNjKHQoJ3NldHRpbmdzLmF1dG9Nb3ZlRmlsZURlc2MnKSlcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHtcblx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUpXG5cdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUgPSB2YWx1ZTtcblx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCcpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZERlc2MnKSlcblx0XHRcdC5hZGRTbGlkZXIoc2xpZGVyID0+IHtcblx0XHRcdHNsaWRlci5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkICogMTAwKVxuXHRcdFx0XHQuc2V0TGltaXRzKDAsIDEwMCwgMSlcblx0XHRcdFx0LnNldER5bmFtaWNUb29sdGlwKClcblx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGQgPSB2YWx1ZSAvIDEwMDtcblx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZERlYnVnU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ0RlYnVnJylcblx0XHRcdC5zZXRIZWFkaW5nKCk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZycpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuZW5hYmxlRGVidWdMb2dEZXNjJykpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHR0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpXG5cdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyA9IHZhbHVlO1xuXHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblx0XG5cdHByaXZhdGUgZmxhdHRlbkNhdGVnb3JpZXModHJlZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHByZWZpeCA9ICcnKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0cmVlKSkge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHByZWZpeCA/IGAke3ByZWZpeH0vJHtrZXl9YCA6IGtleTtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKC4uLnRoaXMuZmxhdHRlbkNhdGVnb3JpZXModmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHBhdGgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHBhdGgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cdFxuXHRwcml2YXRlIGdldEF2YWlsYWJsZU1vZGVscyhwcm92aWRlcjogQUlQcm92aWRlclR5cGUpOiBBcnJheTx7IHZhbHVlOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfT4ge1xuXHRcdHJldHVybiBBVkFJTEFCTEVfTU9ERUxTW3Byb3ZpZGVyXSB8fCBbXTtcblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRQcm92aWRlckRpc3BsYXlOYW1lKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSk6IHN0cmluZyB7XG5cdFx0c3dpdGNoIChwcm92aWRlcikge1xuXHRcdFx0Y2FzZSAnb3BlbmFpJzogcmV0dXJuICdPcGVuQUknO1xuXHRcdFx0Y2FzZSAnZGVlcHNlZWsnOiByZXR1cm4gJ0RlZXBTZWVrJztcblx0XHRcdGNhc2UgJ21vb25zaG90JzogcmV0dXJuICdNb29uc2hvdCAoS2ltaSknO1xuXHRcdFx0Y2FzZSAnemhpcHUnOiByZXR1cm4gJ1poaXB1ICjmmbrosLEpJztcblx0XHRcdGRlZmF1bHQ6IHJldHVybiAnT2xsYW1hJztcblx0XHR9XG5cdH1cblx0XG5cdHByaXZhdGUgZ2V0UHJvdmlkZXJWYWx1ZShwcm92aWRlcjogQUlQcm92aWRlclR5cGUsIGtleTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaUtleTtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ21vZGVsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haU1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlVcmw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZGVlcHNlZWsnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5O1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnbW9kZWwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtNb2RlbDtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpS2V5O1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnbW9kZWwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RNb2RlbDtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlVcmw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1QXBpS2V5O1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnbW9kZWwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVNb2RlbDtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlVcmw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRyZXR1cm4gJyc7XG5cdH1cblx0XG5cdHByaXZhdGUgZ2V0Q3VycmVudFByb3ZpZGVyQ29uZmlnKCkge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcjtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWU6ICdPcGVuQUknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ0RlZXBTZWVrJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla01vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpVXJsLFxuXHRcdFx0XHR9O1xuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWU6ICdNb29uc2hvdCAoS2ltaSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ1poaXB1ICjmmbrosLEpJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1QXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1QXBpVXJsLFxuXHRcdFx0XHR9O1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDmnKrnn6XnmoQgUHJvdmlkZXI6ICR7cHJvdmlkZXJ9YCk7XG5cdFx0fVxuXHR9XG5cdFxuXHRwcml2YXRlIHVwZGF0ZVByb3ZpZGVyQ29uZmlnKHByb3ZpZGVyOiBzdHJpbmcsIGtleTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG5cdFx0c3dpdGNoIChwcm92aWRlcikge1xuXHRcdFx0Y2FzZSAnb3BlbmFpJzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdtb2RlbCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haU1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdtb2RlbCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnbW9kZWwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdE1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3poaXB1Jzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1QXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVNb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdiYXNlVXJsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogUmVzdG9yZSBjb25maXJtYXRpb24gbW9kYWxcbiAqL1xuY2xhc3MgUmVzdG9yZUNvbmZpcm1Nb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIG9uQ29uZmlybTogKCkgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5vbkNvbmZpcm0gPSBvbkNvbmZpcm07XG5cdH1cblxuXHRvbk9wZW4oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0KCdzZXR0aW5ncy5jb25maXJtUmVzdG9yZURlZmF1bHQnKSB9KTtcblxuXHRcdGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ21vZGFsLWJ1dHRvbi1jb250YWluZXInKTtcblxuXHRcdGNvbnN0IGNvbmZpcm1CdG4gPSBidXR0b25Db250YWluZXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICdDb25maXJtJyxcblx0XHRcdGNsczogJ21vZC1jdGEnLFxuXHRcdH0pO1xuXHRcdGNvbmZpcm1CdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR0aGlzLm9uQ29uZmlybSgpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY2FuY2VsQnRuID0gYnV0dG9uQ29udGFpbmVyLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHR0ZXh0OiAnQ2FuY2VsJyxcblx0XHR9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRvbkNsb3NlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiDku44gT2JzaWRpYW4g5paH5Lu25Lit5o+Q5Y+W5YaF5a65XG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZW50RXh0cmFjdG9yIHtcblx0LyoqXG5cdCAqIOaPkOWPluaWh+S7tuWGheWuue+8iOaUr+aMgSBNYXJrZG93biDlkoznuq/mlofmnKzvvIlcblx0ICovXG5cdGFzeW5jIGV4dHJhY3QoZmlsZTogVEZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHR0cnkge1xuXHRcdFx0Ly8g5a+55LqO5aSW6YOo6ZO+5o6l5paH5Lu277yM5Y+v6IO96ZyA6KaB54m55q6K5aSE55CGXG5cdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmaWxlLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRcdHJldHVybiB0aGlzLmNsZWFuQ29udGVudChjb250ZW50KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ+aPkOWPluaWh+S7tuWGheWuueWksei0pTonLCBlKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOiOt+WPluaWh+S7tuagh+mimFxuXHQgKi9cblx0Z2V0VGl0bGUoZmlsZTogVEZpbGUpOiBzdHJpbmcge1xuXHRcdC8vIOS8mOWFiOS9v+eUqOaWh+S7tuWQje+8iOS4jeWQq+aJqeWxleWQje+8iVxuXHRcdHJldHVybiBmaWxlLmJhc2VuYW1lO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5riF55CG5YaF5a6577yM56e76Zmk5LiN5b+F6KaB55qE6YOo5YiGXG5cdCAqL1xuXHRwcml2YXRlIGNsZWFuQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBjb250ZW50XG5cdFx0XHQvLyDnp7vpmaQgWUFNTCBmcm9udG1hdHRlclxuXHRcdFx0LnJlcGxhY2UoL14tLS1bXFxzXFxTXSo/LS0tXFxuPy8sICcnKVxuXHRcdFx0Ly8g56e76ZmkIEhUTUwg5rOo6YeKXG5cdFx0XHQucmVwbGFjZSgvPCEtLVtcXHNcXFNdKj8tLT4vZywgJycpXG5cdFx0XHQvLyDnp7vpmaTku6PnoIHlnZfvvIjkv53nlZnor63oqIDmoIforrDvvIlcblx0XHRcdC5yZXBsYWNlKC9gYGBbXFxzXFxTXSo/YGBgL2csIChtYXRjaCkgPT4ge1xuXHRcdFx0XHRjb25zdCBsYW5nTWF0Y2ggPSBtYXRjaC5tYXRjaCgvYGBgKFxcdyopLyk7XG5cdFx0XHRcdGNvbnN0IGxhbmcgPSBsYW5nTWF0Y2ggPyBsYW5nTWF0Y2hbMV0gOiAnJztcblx0XHRcdFx0cmV0dXJuIGBb5Luj56CB5Z2XOiAke2xhbmd9XWA7XG5cdFx0XHR9KVxuXHRcdFx0Ly8g56e76Zmk5Zu+54mH5ZKM6ZO+5o6l77yM5L+d55WZIGFsdCB0ZXh0XG5cdFx0XHQucmVwbGFjZSgvIVxcWyhbXlxcXV0qKVxcXVxcKFteKV0qXFwpL2csICdbJDFdJylcblx0XHRcdC5yZXBsYWNlKC9cXFsoW15cXF1dKylcXF1cXChbXildKlxcKS9nLCAnJDEnKVxuXHRcdFx0Ly8g56e76Zmk5aSa5L2Z56m66KGMXG5cdFx0XHQucmVwbGFjZSgvXFxuezMsfS9nLCAnXFxuXFxuJylcblx0XHRcdC50cmltKCk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDnlJ/miJDlhoXlrrnmkZjopoHvvIjnlKjkuo4gQUkg5YiG5p6Q77yJXG5cdCAqL1xuXHRnZW5lcmF0ZVN1bW1hcnkoY29udGVudDogc3RyaW5nLCBtYXhMZW5ndGggPSAyMDAwKTogc3RyaW5nIHtcblx0XHRpZiAoY29udGVudC5sZW5ndGggPD0gbWF4TGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5bCd6K+V5Zyo5Y+l5a2Q6L6555WM5aSE5oiq5patXG5cdFx0Y29uc3QgdHJ1bmNhdGVkID0gY29udGVudC5zbGljZSgwLCBtYXhMZW5ndGgpO1xuXHRcdGNvbnN0IGxhc3RQZXJpb2QgPSB0cnVuY2F0ZWQubGFzdEluZGV4T2YoJ+OAgicpO1xuXHRcdGNvbnN0IGxhc3ROZXdsaW5lID0gdHJ1bmNhdGVkLmxhc3RJbmRleE9mKCdcXG4nKTtcblx0XHRcblx0XHRjb25zdCBicmVha1BvaW50ID0gTWF0aC5tYXgobGFzdFBlcmlvZCwgbGFzdE5ld2xpbmUpO1xuXHRcdFxuXHRcdGlmIChicmVha1BvaW50ID4gbWF4TGVuZ3RoICogMC43KSB7XG5cdFx0XHRyZXR1cm4gdHJ1bmNhdGVkLnNsaWNlKDAsIGJyZWFrUG9pbnQgKyAxKTtcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIHRydW5jYXRlZCArICcuLi4nO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBURmlsZSwgVmF1bHQgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8qKlxuICog5paH5Lu25pON5L2c5bel5YW3XG4gKi9cbmV4cG9ydCBjb25zdCBmaWxlT3BzID0ge1xuXHQvKipcblx0ICog5p6E5bu65YiG57G76Lev5b6EXG5cdCAqL1xuXHRidWlsZENhdGVnb3J5UGF0aChjYXRlZ29yeTogc3RyaW5nLCBpbmJveEZvbGRlcjogc3RyaW5nKTogc3RyaW5nIHtcblx0XHQvLyDlsIbliIbnsbvot6/lvoTkuK3nmoQgXCIvXCIg6L2s5o2i5Li6IFZhdWx0IOS4reeahOaWh+S7tuWkueWIhumalOesplxuXHRcdGNvbnN0IG5vcm1hbGl6ZWRDYXRlZ29yeSA9IGNhdGVnb3J5LnJlcGxhY2UoL1xcLy9nLCAnLycpO1xuXHRcdHJldHVybiBgJHtpbmJveEZvbGRlcn0vJHtub3JtYWxpemVkQ2F0ZWdvcnl9YDtcblx0fSxcblx0XG5cdC8qKlxuXHQgKiDnp7vliqjmlofku7bliLDnm67moIfot6/lvoRcblx0ICovXG5cdGFzeW5jIG1vdmVGaWxlKGZpbGU6IFRGaWxlLCBuZXdGb2xkZXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPFRGaWxlPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHZhdWx0ID0gZmlsZS52YXVsdDtcblx0XHRcdGNvbnN0IGFkYXB0ZXIgPSB2YXVsdC5hZGFwdGVyO1xuXHRcdFx0XG5cdFx0XHQvLyDnoa7kv53nm67moIfmlofku7blpLnlrZjlnKjvvIjlpITnkIbnq57mgIHmnaHku7bvvIlcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmICghYXdhaXQgYWRhcHRlci5leGlzdHMobmV3Rm9sZGVyUGF0aCkpIHtcblx0XHRcdFx0XHRhd2FpdCB2YXVsdC5jcmVhdGVGb2xkZXIobmV3Rm9sZGVyUGF0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGZvbGRlckVycm9yOiB1bmtub3duKSB7XG5cdFx0XHRcdC8vIOWmguaenOaWh+S7tuWkueW3suWtmOWcqO+8jOW/veeVpemUmeivr1xuXHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IChmb2xkZXJFcnJvciBhcyB7IG1lc3NhZ2U/OiBzdHJpbmcgfSk/Lm1lc3NhZ2UgfHwgJyc7XG5cdFx0XHRcdGlmICghZXJyb3JNc2cuaW5jbHVkZXMoJ2FscmVhZHkgZXhpc3RzJykpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOWIm+W7uuaWh+S7tuWkueWksei0pTogJHtlcnJvck1zZ31gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDmnoTlu7rmlrDmlofku7bot6/lvoRcblx0XHRcdGNvbnN0IG5ld1BhdGggPSBgJHtuZXdGb2xkZXJQYXRofS8ke2ZpbGUubmFtZX1gO1xuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpznm67moIfot6/lvoTnm7jlkIzvvIzkuI3np7vliqhcblx0XHRcdGlmIChmaWxlLnBhdGggPT09IG5ld1BhdGgpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOajgOafpeebruagh+aWh+S7tuaYr+WQpuW3suWtmOWcqFxuXHRcdFx0aWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKG5ld1BhdGgpKSB7XG5cdFx0XHRcdC8vIOaWh+S7tuW3suWtmOWcqO+8jOa3u+WKoOaXtumXtOaIs+WQjue8gFxuXHRcdFx0XHRjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRjb25zdCBleHQgPSBmaWxlLmV4dGVuc2lvbjtcblx0XHRcdFx0Y29uc3QgYmFzZU5hbWUgPSBmaWxlLmJhc2VuYW1lO1xuXHRcdFx0XHRjb25zdCB1bmlxdWVOZXdQYXRoID0gYCR7bmV3Rm9sZGVyUGF0aH0vJHtiYXNlTmFtZX1fJHt0aW1lc3RhbXB9LiR7ZXh0fWA7XG5cdFx0XHRcdFxuXHRcdFx0XHRhd2FpdCB2YXVsdC5yZW5hbWUoZmlsZSwgdW5pcXVlTmV3UGF0aCk7XG5cdFx0XHRcdGNvbnN0IG5ld0ZpbGUgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodW5pcXVlTmV3UGF0aCk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIShuZXdGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCfnp7vliqjlkI7ml6Dms5Xmib7liLDmlofku7YnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0cmV0dXJuIG5ld0ZpbGU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOaJp+ihjOenu+WKqFxuXHRcdFx0YXdhaXQgdmF1bHQucmVuYW1lKGZpbGUsIG5ld1BhdGgpO1xuXHRcdFx0XG5cdFx0XHQvLyDov5Tlm57mlrDnmoTmlofku7blvJXnlKhcblx0XHRcdGNvbnN0IG5ld0ZpbGUgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobmV3UGF0aCk7XG5cdFx0XHRcblx0XHRcdGlmICghKG5ld0ZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCfnp7vliqjlkI7ml6Dms5Xmib7liLDmlofku7YnKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIG5ld0ZpbGU7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3IgPSBlIGFzIEVycm9yO1xuXHRcdFx0Y29uc29sZS5lcnJvcign56e75Yqo5paH5Lu25aSx6LSlOicsIGVycm9yKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihg56e75Yqo5paH5Lu25aSx6LSlOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG5cdFx0fVxuXHR9LFxuXHRcblx0LyoqXG5cdCAqIOiOt+WPluaWh+S7tuWQje+8iOS4jeWQq+aJqeWxleWQje+8iVxuXHQgKi9cblx0Z2V0QmFzZW5hbWUoZmlsZTogVEZpbGUpOiBzdHJpbmcge1xuXHRcdHJldHVybiBmaWxlLmJhc2VuYW1lO1xuXHR9LFxuXHRcblx0LyoqXG5cdCAqIOajgOafpeaWh+S7tuaYr+WQpuWtmOWcqOS6juaMh+Wumui3r+W+hFxuXHQgKi9cblx0YXN5bmMgZXhpc3RzKHZhdWx0OiBWYXVsdCwgcGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIGF3YWl0IHZhdWx0LmFkYXB0ZXIuZXhpc3RzKHBhdGgpO1xuXHR9LFxuXHRcblx0LyoqXG5cdCAqIOehruS/neaWh+S7tuWkueWtmOWcqO+8jOS4jeWtmOWcqOWImeWIm+W7ulxuXHQgKi9cblx0YXN5bmMgZW5zdXJlRm9sZGVyKHZhdWx0OiBWYXVsdCwgZm9sZGVyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICghYXdhaXQgdmF1bHQuYWRhcHRlci5leGlzdHMoZm9sZGVyUGF0aCkpIHtcblx0XHRcdFx0YXdhaXQgdmF1bHQuY3JlYXRlRm9sZGVyKGZvbGRlclBhdGgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8g6L+U5ZueIHRydWUg6KGo56S65paw5Yib5bu65LqG5paH5Lu25aS5XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIOi/lOWbniBmYWxzZSDooajnpLrmlofku7blpLnlt7LlrZjlnKhcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCfliJvlu7rmlofku7blpLnlpLHotKU6JywgZSk7XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fSxcbn07XG4iLCJpbXBvcnQgeyBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEFJUHJvdmlkZXIsIENsYXNzaWZpY2F0aW9uUmVzdWx0LCBQbHVnaW5TZXR0aW5ncyB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyBDb250ZW50RXh0cmFjdG9yIH0gZnJvbSAnLi9Db250ZW50RXh0cmFjdG9yJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuLi91dGlscy9maWxlT3BzJztcblxuZXhwb3J0IGNsYXNzIENsYXNzaWZpZXIge1xuXHRwcml2YXRlIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblx0cHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblx0cHJpdmF0ZSBjb250ZW50RXh0cmFjdG9yOiBDb250ZW50RXh0cmFjdG9yO1xuXHRcblx0Y29uc3RydWN0b3Ioc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzLCBsb2dnZXI6IExvZ2dlcikge1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcblx0XHR0aGlzLmNvbnRlbnRFeHRyYWN0b3IgPSBuZXcgQ29udGVudEV4dHJhY3RvcigpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75Y2V5Liq5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUZpbGUoXG5cdFx0ZmlsZTogVEZpbGUsXG5cdFx0YWlQcm92aWRlcjogQUlQcm92aWRlcixcblx0XHRvblByb2dyZXNzPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZFxuXHQpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgcmVzdWx0PzogQ2xhc3NpZmljYXRpb25SZXN1bHQ7IGVycm9yPzogc3RyaW5nIH0+IHtcblx0XHR0cnkge1xuXHRcdFx0b25Qcm9ncmVzcz8uKGDmraPlnKjliIbmnpA6ICR7ZmlsZS5iYXNlbmFtZX1gKTtcblx0XHRcdFxuXHRcdFx0Ly8g5o+Q5Y+W5YaF5a65XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5jb250ZW50RXh0cmFjdG9yLmV4dHJhY3QoZmlsZSk7XG5cdFx0XHRpZiAoIWNvbnRlbnQpIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn5peg5rOV5o+Q5Y+W5paH5Lu25YaF5a65JyB9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRjb25zdCB0aXRsZSA9IHRoaXMuY29udGVudEV4dHJhY3Rvci5nZXRUaXRsZShmaWxlKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOWIhuexu+aWh+S7tjogJHtmaWxlLnBhdGh9YCk7XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5qCH6aKYOiAke3RpdGxlfWApO1xuXHRcdFx0XG5cdFx0XHQvLyDosIPnlKggQUkg5YiG57G7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBhaVByb3ZpZGVyLmNsYXNzaWZ5KFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0dGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5YiG57G757uT5p6cOiAke0pTT04uc3RyaW5naWZ5KHJlc3VsdCl9YCk7XG5cdFx0XHRcblx0XHRcdC8vIOajgOafpee9ruS/oeW6plxuXHRcdFx0aWYgKHJlc3VsdC5jb25maWRlbmNlIDwgdGhpcy5zZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkKSB7XG5cdFx0XHRcdHJlc3VsdC5pc1VuY2VydGFpbiA9IHRydWU7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDnva7kv6HluqbkvY7kuo7pmIjlgLw6ICR7cmVzdWx0LmNvbmZpZGVuY2V9YCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHJlc3VsdCB9O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gKGUgYXMgRXJyb3IpLm1lc3NhZ2U7XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5YiG57G75aSx6LSlOiAke2Vycm9yfWApO1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yIH07XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75pS25Lu2566x5Lit55qE5omA5pyJ5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUluYm94KFxuXHRcdGZpbGVzOiBURmlsZVtdLFxuXHRcdGFpUHJvdmlkZXI6IEFJUHJvdmlkZXIsXG5cdFx0b25Qcm9ncmVzcz86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWRcblx0KTogUHJvbWlzZTxBcnJheTx7IGZpbGU6IFRGaWxlOyByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0OyBzdWNjZXNzOiBib29sZWFuIH0+PiB7XG5cdFx0Y29uc3QgcmVzdWx0czogQXJyYXk8eyBmaWxlOiBURmlsZTsgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdDsgc3VjY2VzczogYm9vbGVhbiB9PiA9IFtdO1xuXHRcdFxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbGFzc2lmeUZpbGUoZmlsZSwgYWlQcm92aWRlciwgb25Qcm9ncmVzcyk7XG5cdFx0XHRcblx0XHRcdGlmIChyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQucmVzdWx0KSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaCh7XG5cdFx0XHRcdFx0ZmlsZSxcblx0XHRcdFx0XHRyZXN1bHQ6IHJlc3VsdC5yZXN1bHQsXG5cdFx0XHRcdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGUsXG5cdFx0XHRcdFx0cmVzdWx0OiB7XG5cdFx0XHRcdFx0XHRjYXRlZ29yeTogJ090aGVyJyxcblx0XHRcdFx0XHRcdGNvbmZpZGVuY2U6IDAsXG5cdFx0XHRcdFx0XHRyZWFzb25pbmc6IHJlc3VsdC5lcnJvciB8fCAnVW5rbm93biBlcnJvcicsXG5cdFx0XHRcdFx0XHRpc1VuY2VydGFpbjogdHJ1ZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIHJlc3VsdHM7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDnp7vliqjmlofku7bliLDliIbnsbvnm67lvZVcblx0ICovXG5cdGFzeW5jIG1vdmVGaWxlKGZpbGU6IFRGaWxlLCBjYXRlZ29yeTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG5ld1BhdGggPSBmaWxlT3BzLmJ1aWxkQ2F0ZWdvcnlQYXRoKGNhdGVnb3J5LCB0aGlzLnNldHRpbmdzLmluYm94Rm9sZGVyKTtcblx0XHRcdGF3YWl0IGZpbGVPcHMubW92ZUZpbGUoZmlsZSwgbmV3UGF0aCk7XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5paH5Lu25bey56e75YqoOiAke2ZpbGUucGF0aH0gLT4gJHtuZXdQYXRofWApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoYOenu+WKqOaWh+S7tuWksei0pTogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gKTtcblx0XHRcdHRocm93IGU7IC8vIOmHjeaWsOaKm+WHuumUmeivr++8jOiuqeiwg+eUqOaWueWkhOeQhlxuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKiDplJnor6/lpITnkIblt6XlhbdcbiAqIOaPkOS+m+e7n+S4gOeahOmUmeivr+exu+Wei+WSjOWkhOeQhuaWueazlVxuICovXG5pbXBvcnQgeyByZXF1ZXN0VXJsLCBSZXF1ZXN0VXJsUGFyYW0gfSBmcm9tICdvYnNpZGlhbic7XG5cbi8qKlxuICog6Ieq5a6a5LmJ6ZSZ6K+v57G75Z6LXG4gKi9cbmV4cG9ydCBjbGFzcyBBSUNsYXNzaWZpZXJFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdHB1YmxpYyB0eXBlOiAnbmV0d29yaycgfCAndGltZW91dCcgfCAnYXV0aCcgfCAncmF0ZV9saW1pdCcgfCAndmFsaWRhdGlvbicgfCAncGFyc2UnIHwgJ3Vua25vd24nLFxuXHRcdHB1YmxpYyBvcmlnaW5hbEVycm9yPzogRXJyb3Jcblx0KSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5uYW1lID0gJ0FJQ2xhc3NpZmllckVycm9yJztcblx0fVxufVxuXG4vKipcbiAqIOmHjeivlemFjee9rlxuICovXG5pbnRlcmZhY2UgUmV0cnlDb25maWcge1xuXHRtYXhBdHRlbXB0czogbnVtYmVyO1xuXHRpbml0aWFsRGVsYXk6IG51bWJlcjtcblx0bWF4RGVsYXk6IG51bWJlcjtcblx0YmFja29mZkZhY3RvcjogbnVtYmVyO1xufVxuXG5jb25zdCBERUZBVUxUX1JFVFJZX0NPTkZJRzogUmV0cnlDb25maWcgPSB7XG5cdG1heEF0dGVtcHRzOiAzLFxuXHRpbml0aWFsRGVsYXk6IDEwMDAsIC8vIDEg56eSXG5cdG1heERlbGF5OiAxMDAwMCwgLy8gMTAg56eSXG5cdGJhY2tvZmZGYWN0b3I6IDIsIC8vIOaMh+aVsOmAgOmBv1xufTtcblxuLyoqXG4gKiDluKbph43or5XnmoTlvILmraXmk43kvZxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhSZXRyeTxUPihcblx0b3BlcmF0aW9uOiAoKSA9PiBQcm9taXNlPFQ+LFxuXHRjb25maWc6IFBhcnRpYWw8UmV0cnlDb25maWc+ID0ge30sXG5cdG9wZXJhdGlvbk5hbWUgPSAnb3BlcmF0aW9uJ1xuKTogUHJvbWlzZTxUPiB7XG5cdGNvbnN0IGZpbmFsQ29uZmlnID0geyAuLi5ERUZBVUxUX1JFVFJZX0NPTkZJRywgLi4uY29uZmlnIH07XG5cdGxldCBsYXN0RXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkO1xuXHRcblx0Zm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gZmluYWxDb25maWcubWF4QXR0ZW1wdHM7IGF0dGVtcHQrKykge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgb3BlcmF0aW9uKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGxhc3RFcnJvciA9IGVycm9yIGFzIEVycm9yO1xuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzmmK/orqTor4HplJnor6/vvIzkuI3ph43or5Vcblx0XHRcdGlmIChpc0F1dGhFcnJvcihlcnJvcikpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0XHRcdCdBUEkgS2V5IOaXoOaViOaIluacquaOiOadgycsXG5cdFx0XHRcdFx0J2F1dGgnLFxuXHRcdFx0XHRcdGxhc3RFcnJvclxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzmmK/pmZDmtYHplJnor6/vvIznrYnlvoXmm7Tplb/ml7bpl7Rcblx0XHRcdGlmIChpc1JhdGVMaW1pdEVycm9yKGVycm9yKSkge1xuXHRcdFx0XHRjb25zdCB3YWl0VGltZSA9IGdldFJhdGVMaW1pdFdhaXRUaW1lKGVycm9yKSB8fCBmaW5hbENvbmZpZy5tYXhEZWxheTtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtvcGVyYXRpb25OYW1lfV0g6YGH5Yiw6ZmQ5rWB77yM562J5b6FICR7d2FpdFRpbWV9bXMg5ZCO6YeN6K+VLi4uYCk7XG5cdFx0XHRcdGF3YWl0IHNsZWVwKHdhaXRUaW1lKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOaYr+e9kee7nOmUmeivr+S4lOS4jeaYr+acgOWQjuS4gOasoeWwneivle+8jOetieW+heWQjumHjeivlVxuXHRcdFx0aWYgKGF0dGVtcHQgPCBmaW5hbENvbmZpZy5tYXhBdHRlbXB0cyAmJiBpc1JldHJ5YWJsZUVycm9yKGVycm9yKSkge1xuXHRcdFx0XHRjb25zdCBkZWxheSA9IGNhbGN1bGF0ZURlbGF5KGF0dGVtcHQsIGZpbmFsQ29uZmlnKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtvcGVyYXRpb25OYW1lfV0g5bCd6K+VICR7YXR0ZW1wdH0vJHtmaW5hbENvbmZpZy5tYXhBdHRlbXB0c30g5aSx6LSl77yMJHtkZWxheX1tcyDlkI7ph43or5UuLi5gKTtcblx0XHRcdFx0YXdhaXQgc2xlZXAoZGVsYXkpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5pyA5ZCO5LiA5qyh5bCd6K+V5aSx6LSl77yM5oqb5Ye66ZSZ6K+vXG5cdFx0XHR0aHJvdyBjbGFzc2lmeUVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblx0XG5cdHRocm93IGNsYXNzaWZ5RXJyb3IobGFzdEVycm9yISk7XG59XG5cbi8qKlxuICog5Yik5pat5piv5ZCm5Li65Y+v6YeN6K+V6ZSZ6K+vXG4gKi9cbmZ1bmN0aW9uIGlzUmV0cnlhYmxlRXJyb3IoZXJyb3I6IHVua25vd24pOiBib29sZWFuIHtcblx0Y29uc3QgbWVzc2FnZSA9IChlcnJvciBhcyB7IG1lc3NhZ2U/OiBzdHJpbmcgfSk/Lm1lc3NhZ2U/LnRvTG93ZXJDYXNlKCkgfHwgJyc7XG5cdGNvbnN0IHN0YXR1cyA9IChlcnJvciBhcyB7IHN0YXR1cz86IG51bWJlciB9KT8uc3RhdHVzIHx8IFxuXHRcdChlcnJvciBhcyB7IHJlc3BvbnNlPzogeyBzdGF0dXM/OiBudW1iZXIgfSB9KT8ucmVzcG9uc2U/LnN0YXR1cztcblx0XG5cdC8vIOe9kee7nOmUmeivr1xuXHRpZiAobWVzc2FnZS5pbmNsdWRlcygnbmV0d29yaycpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ2ZldGNoJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnZW5vdGZvdW5kJykpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRcblx0Ly8g5pyN5Yqh5Zmo6ZSZ6K+vICg1eHgpXG5cdGlmIChzdGF0dXMgIT09IHVuZGVmaW5lZCAmJiBzdGF0dXMgPj0gNTAwICYmIHN0YXR1cyA8IDYwMCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxuXHQvLyDotoXml7bplJnor69cblx0aWYgKG1lc3NhZ2UuaW5jbHVkZXMoJ3RpbWVvdXQnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdldGltZWRvdXQnKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICog5Yik5pat5piv5ZCm5Li66K6k6K+B6ZSZ6K+vXG4gKi9cbmZ1bmN0aW9uIGlzQXV0aEVycm9yKGVycm9yOiB1bmtub3duKTogYm9vbGVhbiB7XG5cdGNvbnN0IHN0YXR1cyA9IChlcnJvciBhcyB7IHN0YXR1cz86IG51bWJlciB9KT8uc3RhdHVzIHx8IChlcnJvciBhcyB7IHJlc3BvbnNlPzogeyBzdGF0dXM/OiBudW1iZXIgfSB9KT8ucmVzcG9uc2U/LnN0YXR1cztcblx0Y29uc3QgbWVzc2FnZSA9IChlcnJvciBhcyB7IG1lc3NhZ2U/OiBzdHJpbmcgfSk/Lm1lc3NhZ2U/LnRvTG93ZXJDYXNlKCkgfHwgJyc7XG5cdFxuXHRyZXR1cm4gc3RhdHVzID09PSA0MDEgfHwgc3RhdHVzID09PSA0MDMgfHwgXG5cdFx0bWVzc2FnZS5pbmNsdWRlcygndW5hdXRob3JpemVkJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnaW52YWxpZCBhcGkga2V5Jyk7XG59XG5cbi8qKlxuICog5Yik5pat5piv5ZCm5Li66ZmQ5rWB6ZSZ6K+vXG4gKi9cbmZ1bmN0aW9uIGlzUmF0ZUxpbWl0RXJyb3IoZXJyb3I6IHVua25vd24pOiBib29sZWFuIHtcblx0Y29uc3Qgc3RhdHVzID0gKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pPy5zdGF0dXMgfHwgKGVycm9yIGFzIHsgcmVzcG9uc2U/OiB7IHN0YXR1cz86IG51bWJlciB9IH0pPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRjb25zdCBtZXNzYWdlID0gKGVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0XG5cdHJldHVybiBzdGF0dXMgPT09IDQyOSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdyYXRlIGxpbWl0JykgfHwgbWVzc2FnZS5pbmNsdWRlcygndG9vIG1hbnkgcmVxdWVzdHMnKTtcbn1cblxuLyoqXG4gKiDku47plJnor6/kuK3ojrflj5bpmZDmtYHnrYnlvoXml7bpl7RcbiAqL1xuZnVuY3Rpb24gZ2V0UmF0ZUxpbWl0V2FpdFRpbWUoZXJyb3I6IHVua25vd24pOiBudW1iZXIgfCBudWxsIHtcblx0Ly8g5bCd6K+V5LuO5ZON5bqU5aS06I635Y+WXG5cdGNvbnN0IHJldHJ5QWZ0ZXIgPSAoZXJyb3IgYXMgeyByZXNwb25zZT86IHsgaGVhZGVycz86IHsgZ2V0OiAoa2V5OiBzdHJpbmcpID0+IHN0cmluZyB8IG51bGwgfSB9IH0pPy5yZXNwb25zZT8uaGVhZGVycz8uZ2V0KCdyZXRyeS1hZnRlcicpO1xuXHRpZiAocmV0cnlBZnRlcikge1xuXHRcdGNvbnN0IHNlY29uZHMgPSBwYXJzZUludChyZXRyeUFmdGVyLCAxMCk7XG5cdFx0aWYgKCFpc05hTihzZWNvbmRzKSkge1xuXHRcdFx0cmV0dXJuIHNlY29uZHMgKiAxMDAwO1xuXHRcdH1cblx0fVxuXHRcblx0Ly8g6buY6K6k562J5b6FIDYwIOenklxuXHRyZXR1cm4gNjAwMDA7XG59XG5cbi8qKlxuICog6K6h566X6YeN6K+V5bu26L+f5pe26Ze077yI5oyH5pWw6YCA6YG/77yJXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZURlbGF5KGF0dGVtcHQ6IG51bWJlciwgY29uZmlnOiBSZXRyeUNvbmZpZyk6IG51bWJlciB7XG5cdGNvbnN0IGRlbGF5ID0gY29uZmlnLmluaXRpYWxEZWxheSAqIE1hdGgucG93KGNvbmZpZy5iYWNrb2ZmRmFjdG9yLCBhdHRlbXB0IC0gMSk7XG5cdHJldHVybiBNYXRoLm1pbihkZWxheSwgY29uZmlnLm1heERlbGF5KTtcbn1cblxuLyoqXG4gKiDkvJHnnKDmjIflrprml7bpl7RcbiAqL1xuZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG5cbi8qKlxuICog5YiG57G76ZSZ6K+v57G75Z6LXG4gKi9cbmZ1bmN0aW9uIGNsYXNzaWZ5RXJyb3IoZXJyb3I6IHVua25vd24pOiBBSUNsYXNzaWZpZXJFcnJvciB7XG5cdGlmIChlcnJvciBpbnN0YW5jZW9mIEFJQ2xhc3NpZmllckVycm9yKSB7XG5cdFx0cmV0dXJuIGVycm9yO1xuXHR9XG5cdFxuXHRjb25zdCBlcnJvck9iaiA9IGVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZzsgc3RhdHVzPzogbnVtYmVyOyByZXNwb25zZT86IHsgc3RhdHVzPzogbnVtYmVyIH0gfTtcblx0Y29uc3QgbWVzc2FnZSA9IGVycm9yT2JqPy5tZXNzYWdlIHx8IFN0cmluZyhlcnJvcik7XG5cdGNvbnN0IGxvd2VyTWVzc2FnZSA9IG1lc3NhZ2UudG9Mb3dlckNhc2UoKTtcblx0Y29uc3Qgc3RhdHVzID0gZXJyb3JPYmo/LnN0YXR1cyB8fCBlcnJvck9iaj8ucmVzcG9uc2U/LnN0YXR1cztcblx0XG5cdC8vIOe9kee7nOmUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCduZXR3b3JrJykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdmZXRjaCcpIHx8IFxuXHRcdGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnZW5vdGZvdW5kJykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdlY29ubnJlZnVzZWQnKSkge1xuXHRcdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHQn572R57uc6L+e5o6l5aSx6LSl77yM6K+35qOA5p+l572R57uc6K6+572uJyxcblx0XHRcdCduZXR3b3JrJyxcblx0XHRcdGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IHVuZGVmaW5lZFxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOi2heaXtumUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd0aW1lb3V0JykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdldGltZWRvdXQnKSkge1xuXHRcdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHQn6K+35rGC6LaF5pe277yM6K+356iN5ZCO6YeN6K+VJyxcblx0XHRcdCd0aW1lb3V0Jyxcblx0XHRcdGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IHVuZGVmaW5lZFxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOiupOivgemUmeivr1xuXHRpZiAoc3RhdHVzID09PSA0MDEgfHwgc3RhdHVzID09PSA0MDMgfHwgXG5cdFx0bG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd1bmF1dGhvcml6ZWQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2ludmFsaWQgYXBpIGtleScpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCdBUEkgS2V5IOaXoOaViOaIluacquaOiOadgycsXG5cdFx0XHQnYXV0aCcsXG5cdFx0XHRlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiB1bmRlZmluZWRcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyDpmZDmtYHplJnor69cblx0aWYgKHN0YXR1cyA9PT0gNDI5IHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygncmF0ZSBsaW1pdCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygndG9vIG1hbnkgcmVxdWVzdHMnKSkge1xuXHRcdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHQnQVBJIOivt+axgui/h+S6jumikee5ge+8jOivt+eojeWQjumHjeivlScsXG5cdFx0XHQncmF0ZV9saW1pdCcsXG5cdFx0XHRlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiB1bmRlZmluZWRcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyBKU09OIOino+aekOmUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdqc29uJykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdwYXJzZScpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnc3ludGF4JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+WTjeW6lOaVsOaNruagvOW8j+mUmeivrycsXG5cdFx0XHQncGFyc2UnLFxuXHRcdFx0ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogdW5kZWZpbmVkXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g5pyq55+l6ZSZ6K+vXG5cdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0bWVzc2FnZSxcblx0XHQndW5rbm93bicsXG5cdFx0ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogdW5kZWZpbmVkXG5cdCk7XG59XG5cbi8qKlxuICog55So5oi35Y+L5aW955qE6ZSZ6K+v5raI5oGvXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGVycm9yOiBFcnJvcik6IHN0cmluZyB7XG5cdGlmIChlcnJvciBpbnN0YW5jZW9mIEFJQ2xhc3NpZmllckVycm9yKSB7XG5cdFx0c3dpdGNoIChlcnJvci50eXBlKSB7XG5cdFx0XHRjYXNlICduZXR3b3JrJzpcblx0XHRcdFx0cmV0dXJuICfwn4yQIOe9kee7nOi/nuaOpeWksei0pe+8jOivt+ajgOafpe+8mlxcbuKAoiDnvZHnu5zmmK/lkKbmraPluLhcXG7igKIgQVBJIOWcsOWdgOaYr+WQpuato+ehrlxcbuKAoiDmmK/lkKbpnIDopoHku6PnkIYnO1xuXHRcdFx0Y2FzZSAndGltZW91dCc6XG5cdFx0XHRcdHJldHVybiAn4o+x77iPIOivt+axgui2heaXtu+8jOW7uuiuru+8mlxcbuKAoiDmo4Dmn6XnvZHnu5zpgJ/luqZcXG7igKIg56iN5ZCO6YeN6K+VJztcblx0XHRcdGNhc2UgJ2F1dGgnOlxuXHRcdFx0XHRyZXR1cm4gJ/CflJEgQVBJIEtleSDml6DmlYjvvIzor7fmo4Dmn6XvvJpcXG7igKIgQVBJIEtleSDmmK/lkKbmraPnoa5cXG7igKIg5piv5ZCm5pyJ5L2Z6aKdL+mineW6pic7XG5cdFx0XHRjYXNlICdyYXRlX2xpbWl0Jzpcblx0XHRcdFx0cmV0dXJuICfwn5qmIOivt+axgui/h+S6jumikee5ge+8jOivt+eojeWQjumHjeivlSc7XG5cdFx0XHRjYXNlICdwYXJzZSc6XG5cdFx0XHRcdHJldHVybiAn8J+TnSBBSSDlk43lupTmoLzlvI/lvILluLjvvIzor7fph43or5XmiJbogZTns7vlvIDlj5HogIUnO1xuXHRcdFx0Y2FzZSAndmFsaWRhdGlvbic6XG5cdFx0XHRcdHJldHVybiBg4pqg77iPIOmFjee9rumUmeivr++8miR7ZXJyb3IubWVzc2FnZX1gO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIGDinYwgJHtlcnJvci5tZXNzYWdlfWA7XG5cdFx0fVxuXHR9XG5cdFxuXHRyZXR1cm4gYOKdjCDmnKrnn6XplJnor6/vvJoke2Vycm9yLm1lc3NhZ2V9YDtcbn1cblxuLyoqXG4gKiDpqozor4EgVVJMIOagvOW8j1xuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVVcmwodXJsOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdGlmICghdXJsIHx8IHVybC50cmltKCkgPT09ICcnKSB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKGAke2ZpZWxkTmFtZX0g5LiN6IO95Li656m6YCwgJ3ZhbGlkYXRpb24nKTtcblx0fVxuXHRcblx0dHJ5IHtcblx0XHRuZXcgVVJMKHVybCk7XG5cdH0gY2F0Y2gge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihgJHtmaWVsZE5hbWV9IOagvOW8j+S4jeato+ehrjogJHt1cmx9YCwgJ3ZhbGlkYXRpb24nKTtcblx0fVxufVxuXG4vKipcbiAqIOmqjOivgSBBUEkgS2V5IOagvOW8j1xuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVBcGlLZXkoYXBpS2V5OiBzdHJpbmcsIHByb3ZpZGVyTmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdGlmICghYXBpS2V5IHx8IGFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKGAke3Byb3ZpZGVyTmFtZX0gQVBJIEtleSDkuI3og73kuLrnqbpgLCAndmFsaWRhdGlvbicpO1xuXHR9XG5cdFxuXHQvLyDln7rmnKzmoLzlvI/mo4Dmn6Vcblx0aWYgKGFwaUtleS5sZW5ndGggPCAxMCkge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihgJHtwcm92aWRlck5hbWV9IEFQSSBLZXkg5qC85byP5LiN5q2j56GuYCwgJ3ZhbGlkYXRpb24nKTtcblx0fVxufVxuXG4vKipcbiAqIOW4pui2heaXtueahCBmZXRjaO+8iOS9v+eUqCBPYnNpZGlhbiDnmoQgcmVxdWVzdFVybO+8iVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hXaXRoVGltZW91dChcblx0dXJsOiBzdHJpbmcsXG5cdG9wdGlvbnM6IFJlcXVlc3RJbml0ID0ge30sXG5cdF90aW1lb3V0ID0gMzAwMDBcbik6IFByb21pc2U8UmVzcG9uc2U+IHtcblx0dHJ5IHtcblx0XHRjb25zdCByZXF1ZXN0UGFyYW1zOiBSZXF1ZXN0VXJsUGFyYW0gPSB7XG5cdFx0XHR1cmwsXG5cdFx0XHRtZXRob2Q6IG9wdGlvbnMubWV0aG9kIGFzICdHRVQnIHwgJ1BPU1QnIHwgJ1BVVCcgfCAnREVMRVRFJyB8ICdQQVRDSCcgfHwgJ0dFVCcsXG5cdFx0XHRoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8fCB7fSxcblx0XHRcdGJvZHk6IG9wdGlvbnMuYm9keSBhcyBzdHJpbmcgfHwgdW5kZWZpbmVkLFxuXHRcdH07XG5cdFx0XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcblx0XHRcdC4uLnJlcXVlc3RQYXJhbXMsXG5cdFx0XHR0aHJvdzogZmFsc2UsIC8vIOS4jeiHquWKqOaKm+WHuiBIVFRQIOmUmeivr1xuXHRcdH0pO1xuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRvazogcmVzcG9uc2Uuc3RhdHVzID49IDIwMCAmJiByZXNwb25zZS5zdGF0dXMgPCAzMDAsXG5cdFx0XHRzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcblx0XHRcdHN0YXR1c1RleHQ6IHJlc3BvbnNlLnRleHQgfHwgJycsXG5cdFx0XHRoZWFkZXJzOiBuZXcgSGVhZGVycyhyZXNwb25zZS5oZWFkZXJzKSxcblx0XHRcdGpzb246ICgpID0+IFByb21pc2UucmVzb2x2ZShyZXNwb25zZS5qc29uKSxcblx0XHRcdHRleHQ6ICgpID0+IFByb21pc2UucmVzb2x2ZShyZXNwb25zZS50ZXh0KSxcblx0XHRcdGJsb2I6ICgpID0+IFByb21pc2UucmVzb2x2ZShuZXcgQmxvYihbcmVzcG9uc2UuYXJyYXlCdWZmZXJdKSksXG5cdFx0XHRhcnJheUJ1ZmZlcjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHJlc3BvbnNlLmFycmF5QnVmZmVyKSxcblx0XHRcdGZvcm1EYXRhOiAoKSA9PiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ2Zvcm1EYXRhIG5vdCBzdXBwb3J0ZWQnKSksXG5cdFx0XHRjbG9uZTogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzIGFzIFJlc3BvbnNlOyB9LFxuXHRcdFx0Ym9keTogbnVsbCxcblx0XHRcdGJvZHlVc2VkOiBmYWxzZSxcblx0XHRcdHJlZGlyZWN0ZWQ6IGZhbHNlLFxuXHRcdFx0dHlwZTogJ2Jhc2ljJyBhcyBSZXNwb25zZVR5cGUsXG5cdFx0XHR1cmw6IHVybCxcblx0XHR9IGFzIFJlc3BvbnNlO1xuXHR9IGNhdGNoIChlcnJvcjogdW5rbm93bikge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCfor7fmsYLotoXml7bmiJbnvZHnu5zplJnor68nLFxuXHRcdFx0J3RpbWVvdXQnLFxuXHRcdFx0ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogdW5kZWZpbmVkXG5cdFx0KTtcblx0fVxufVxuIiwiaW1wb3J0IHsgQXBwLCBOb3RpY2UsIFRGaWxlLCBNb2RhbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB0eXBlIEFJQ2xhc3NpZmllclBsdWdpbiBmcm9tICcuLi9tYWluJztcbmltcG9ydCB7IENsYXNzaWZpY2F0aW9uUmVzdWx0IH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4uL3NldHRpbmdzL2kxOG4nO1xuaW1wb3J0IHsgQ2xhc3NpZmllciB9IGZyb20gJy4uL3NlcnZpY2VzL0NsYXNzaWZpZXInO1xuaW1wb3J0IHsgZmlsZU9wcyB9IGZyb20gJy4uL3V0aWxzL2ZpbGVPcHMnO1xuaW1wb3J0IHsgZ2V0VXNlckZyaWVuZGx5TWVzc2FnZSB9IGZyb20gJy4uL3V0aWxzL2Vycm9ySGFuZGxlcic7XG5cbmV4cG9ydCBjbGFzcyBDbGFzc2lmeUNvbW1hbmQge1xuXHRwcml2YXRlIHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luO1xuXHRwcml2YXRlIGNsYXNzaWZpZXI6IENsYXNzaWZpZXI7XG5cdFxuXHRjb25zdHJ1Y3RvcihwbHVnaW46IEFJQ2xhc3NpZmllclBsdWdpbikge1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHRcdHRoaXMuY2xhc3NpZmllciA9IG5ldyBDbGFzc2lmaWVyKHBsdWdpbi5zZXR0aW5ncywgcGx1Z2luLmxvZ2dlcik7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDliIbnsbvmlLbku7bnrrHkuK3nmoTmiYDmnInmlofku7Zcblx0ICovXG5cdGFzeW5jIGNsYXNzaWZ5SW5ib3goKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5ib3hGb2xkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmJveEZvbGRlcjtcblx0XHRcblx0XHQvLyDnoa7kv50gSW5ib3gg55uu5b2V5a2Y5ZyoXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBmaWxlT3BzLmVuc3VyZUZvbGRlcih0aGlzLnBsdWdpbi5hcHAudmF1bHQsIGluYm94Rm9sZGVyKTtcblx0XHRcdGlmIChjcmVhdGVkKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYOW3suWIm+W7uuaUtuS7tueuseaWh+S7tuWkuTogJHtpbmJveEZvbGRlcn1gKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRuZXcgTm90aWNlKGDliJvlu7rmlLbku7bnrrHmlofku7blpLnlpLHotKU6ICR7KGUgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOafpeaJvuaUtuS7tueuseaWh+S7tuWkuVxuXHRcdGNvbnN0IGluYm94RmlsZXMgPSB0aGlzLmZpbmRJbmJveEZpbGVzKGluYm94Rm9sZGVyKTtcblx0XHRcblx0XHRpZiAoaW5ib3hGaWxlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdG5ldyBOb3RpY2UodCgnY2xhc3NpZnkubm9GaWxlcycpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0bmV3IE5vdGljZShg5om+5YiwICR7aW5ib3hGaWxlcy5sZW5ndGh9IOS4quW+heWIhuexu+aWh+S7tmApO1xuXHRcdFxuXHRcdC8vIOiOt+WPliBBSSBQcm92aWRlcu+8iOW4pumUmeivr+WkhOeQhu+8iVxuXHRcdGxldCBhaVByb3ZpZGVyO1xuXHRcdHRyeSB7XG5cdFx0XHRhaVByb3ZpZGVyID0gdGhpcy5wbHVnaW4uZ2V0QUlQcm92aWRlcigpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdG5ldyBOb3RpY2UoZXJyb3JNc2csIDgwMDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5jbGFzc2lmaWVyLmNsYXNzaWZ5SW5ib3goXG5cdFx0XHRpbmJveEZpbGVzLFxuXHRcdFx0YWlQcm92aWRlcixcblx0XHRcdChtZXNzYWdlKSA9PiBuZXcgTm90aWNlKG1lc3NhZ2UsIDIwMDApXG5cdFx0KTtcblx0XHRcblx0XHQvLyDlpITnkIbnu5Pmnpxcblx0XHRsZXQgbW92ZWRDb3VudCA9IDA7XG5cdFx0bGV0IHVuY2VydGFpbkNvdW50ID0gMDtcblx0XHRcblx0XHRmb3IgKGNvbnN0IHsgZmlsZSwgcmVzdWx0LCBzdWNjZXNzIH0gb2YgcmVzdWx0cykge1xuXHRcdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShuZXcgRXJyb3IocmVzdWx0LnJlYXNvbmluZykpO1xuXHRcdFx0XHRuZXcgTm90aWNlKGAke2ZpbGUubmFtZX06ICR7ZXJyb3JNc2d9YCwgNTAwMCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiAocmVzdWx0LmlzVW5jZXJ0YWluKSB7XG5cdFx0XHRcdHVuY2VydGFpbkNvdW50Kys7XG5cdFx0XHRcdC8vIOWvueS6juS9jue9ruS/oeW6pue7k+aenO+8jOetieW+heeUqOaIt+ehruiupFxuXHRcdFx0XHRjb25zdCBjb25maXJtZWQgPSBhd2FpdCB0aGlzLmNvbmZpcm1DbGFzc2lmaWNhdGlvbihmaWxlLCByZXN1bHQpO1xuXHRcdFx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBtb3ZlZCA9IGF3YWl0IHRoaXMuY2xhc3NpZmllci5tb3ZlRmlsZShmaWxlLCByZXN1bHQuY2F0ZWdvcnkpO1xuXHRcdFx0XHRcdGlmIChtb3ZlZCkge1xuXHRcdFx0XHRcdFx0bW92ZWRDb3VudCsrO1xuXHRcdFx0XHRcdFx0bmV3IE5vdGljZShgJHtmaWxlLm5hbWV9IOKGkiAke3Jlc3VsdC5jYXRlZ29yeX1gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShg56e75YqoICR7ZmlsZS5uYW1lfSDlpLHotKU6ICR7ZXJyb3JNc2d9YCwgNTAwMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7ZmlsZS5uYW1lfTogJHtyZXN1bHQuY2F0ZWdvcnl9ICgkeyhyZXN1bHQuY29uZmlkZW5jZSAqIDEwMCkudG9GaXhlZCgwKX0lKWApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHRuZXcgTm90aWNlKFxuXHRcdFx0YOWIhuexu+WujOaIkO+8gWAgK1xuXHRcdFx0KG1vdmVkQ291bnQgPiAwID8gYOW3suenu+WKqCAke21vdmVkQ291bnR9IOS4quaWh+S7tmAgOiAnJykgK1xuXHRcdFx0KHVuY2VydGFpbkNvdW50ID4gMCA/IGDvvIwke3VuY2VydGFpbkNvdW50fSDkuKrmlofku7bpnIDopoHnoa7orqRgIDogJycpXG5cdFx0KTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+W9k+WJjeaJk+W8gOeahOaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlDdXJyZW50RmlsZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5wbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XG5cdFx0aWYgKCFhY3RpdmVGaWxlKSB7XG5cdFx0XHRuZXcgTm90aWNlKCfmsqHmnInmiZPlvIDnmoTmlofku7YnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g6I635Y+WIEFJIFByb3ZpZGVy77yI5bim6ZSZ6K+v5aSE55CG77yJXG5cdFx0bGV0IGFpUHJvdmlkZXI7XG5cdFx0dHJ5IHtcblx0XHRcdGFpUHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5nZXRBSVByb3ZpZGVyKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0bmV3IE5vdGljZShlcnJvck1zZywgODAwMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2xhc3NpZmllci5jbGFzc2lmeUZpbGUoYWN0aXZlRmlsZSwgYWlQcm92aWRlcik7XG5cdFx0XG5cdFx0aWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuXHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKG5ldyBFcnJvcihyZXN1bHQuZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKSk7XG5cdFx0XHRuZXcgTm90aWNlKGVycm9yTXNnLCA1MDAwKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29uc3QgeyByZXN1bHQ6IGNsYXNzaWZpY2F0aW9uIH0gPSByZXN1bHQ7XG5cdFx0XG5cdFx0bmV3IE5vdGljZShcblx0XHRcdGDliIbnsbs6ICR7Y2xhc3NpZmljYXRpb24/LmNhdGVnb3J5fSBgICtcblx0XHRcdGAoJHsoKGNsYXNzaWZpY2F0aW9uPy5jb25maWRlbmNlIHx8IDApICogMTAwKS50b0ZpeGVkKDApfSUpYFxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8g5qOA5p+l5piv5ZCm6ZyA6KaB56e75YqoXG5cdFx0aWYgKGNsYXNzaWZpY2F0aW9uPy5pc1VuY2VydGFpbikge1xuXHRcdFx0Y29uc3QgY29uZmlybWVkID0gYXdhaXQgdGhpcy5jb25maXJtQ2xhc3NpZmljYXRpb24oYWN0aXZlRmlsZSwgY2xhc3NpZmljYXRpb24pO1xuXHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b01vdmVGaWxlICYmIGNsYXNzaWZpY2F0aW9uKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNsYXNzaWZpZXIubW92ZUZpbGUoYWN0aXZlRmlsZSwgY2xhc3NpZmljYXRpb24uY2F0ZWdvcnkpO1xuXHRcdFx0XHRuZXcgTm90aWNlKGAke3QoJ2NsYXNzaWZ5Lm1vdmVkJyl9JHtjbGFzc2lmaWNhdGlvbi5jYXRlZ29yeX1gKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0XHRuZXcgTm90aWNlKGDnp7vliqjmlofku7blpLHotKU6ICR7ZXJyb3JNc2d9YCwgNTAwMCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog56Gu6K6k5YiG57G777yI55So5LqO5L2O572u5L+h5bqm5oOF5Ya177yJXG5cdCAqL1xuXHRwcml2YXRlIGNvbmZpcm1DbGFzc2lmaWNhdGlvbihmaWxlOiBURmlsZSwgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGAke2ZpbGUubmFtZX1cXG4ke3QoJ2NsYXNzaWZ5LmNvbmZpcm0nKX0ke3Jlc3VsdC5jYXRlZ29yeX1cXG4ke3QoJ2NsYXNzaWZ5LnVuY2VydGFpbicpfSR7KChyZXN1bHQuY29uZmlkZW5jZSB8fCAwKSAqIDEwMCkudG9GaXhlZCgwKX0lKWA7XG5cdFx0XHRcblx0XHRcdGlmIChyZXN1bHQuc3VnZ2VzdGVkQ2F0ZWdvcnkgJiYgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcykge1xuXHRcdFx0XHRuZXcgTm90aWNlKGAke3QoJ2NsYXNzaWZ5LnN1Z2dlc3RlZENhdGVnb3J5Jyl9JHtyZXN1bHQuc3VnZ2VzdGVkQ2F0ZWdvcnl9YCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqCBPYnNpZGlhbiDnmoTnoa7orqTlr7nor53moYZcblx0XHRcdGNvbnN0IG1vZGFsID0gbmV3IENvbmZpcm1Nb2RhbChcblx0XHRcdFx0dGhpcy5wbHVnaW4uYXBwLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHQoY29uZmlybWVkKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZShmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0bW9kYWwub3BlbigpO1xuXHRcdH0pO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5p+l5om+5pS25Lu2566x5Lit55qE5omA5pyJ56yU6K6w5paH5Lu2XG5cdCAqL1xuXHRwcml2YXRlIGZpbmRJbmJveEZpbGVzKGluYm94Rm9sZGVyOiBzdHJpbmcpOiBURmlsZVtdIHtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMucGx1Z2luLmFwcC52YXVsdC5nZXRGaWxlcygpO1xuXHRcdGNvbnN0IHNjYW5TdWJmb2xkZXJzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2NhblN1YmZvbGRlcnM7XG5cdFx0XG5cdFx0cmV0dXJuIGZpbGVzLmZpbHRlcihmaWxlID0+IHtcblx0XHRcdC8vIOajgOafpeaWh+S7tuaYr+WQpuWcqOaUtuS7tueuseaWh+S7tuWkueS4rVxuXHRcdFx0Y29uc3Qgbm9ybWFsaXplZFBhdGggPSBmaWxlLnBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXHRcdFx0Y29uc3Qgbm9ybWFsaXplZEluYm94ID0gaW5ib3hGb2xkZXIucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXHRcdFx0XG5cdFx0XHQvLyDmo4Dmn6XmmK/lkKblnKjmlLbku7bnrrHkuK1cblx0XHRcdGlmICghbm9ybWFsaXplZFBhdGguc3RhcnRzV2l0aChub3JtYWxpemVkSW5ib3ggKyAnLycpICYmIFxuXHRcdFx0XHQhKG5vcm1hbGl6ZWRQYXRoLnN0YXJ0c1dpdGgobm9ybWFsaXplZEluYm94KSAmJiBub3JtYWxpemVkUGF0aCAhPT0gbm9ybWFsaXplZEluYm94KSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOS4jeaJq+aPj+WtkOaWh+S7tuWkue+8jOajgOafpeaYr+WQpuWcqOmhtuWxglxuXHRcdFx0aWYgKCFzY2FuU3ViZm9sZGVycykge1xuXHRcdFx0XHRjb25zdCByZWxhdGl2ZVBhdGggPSBub3JtYWxpemVkUGF0aC5zdWJzdHJpbmcobm9ybWFsaXplZEluYm94Lmxlbmd0aCk7XG5cdFx0XHRcdC8vIOenu+mZpOW8gOWktOeahOaWnOadoFxuXHRcdFx0XHRjb25zdCBjbGVhblJlbGF0aXZlUGF0aCA9IHJlbGF0aXZlUGF0aC5zdGFydHNXaXRoKCcvJykgPyByZWxhdGl2ZVBhdGguc3Vic3RyaW5nKDEpIDogcmVsYXRpdmVQYXRoO1xuXHRcdFx0XHQvLyDlpoLmnpznm7jlr7not6/lvoTkuK3ljIXlkKvmlpzmnaDvvIzor7TmmI7lnKjlrZDnm67lvZXkuK1cblx0XHRcdFx0aWYgKGNsZWFuUmVsYXRpdmVQYXRoLmluY2x1ZGVzKCcvJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cdH1cbn1cblxuLyoqXG4gKiDnroDljZXnmoTnoa7orqTlr7nor53moYZcbiAqL1xuY2xhc3MgQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwcml2YXRlIG1lc3NhZ2U6IHN0cmluZztcblx0cHJpdmF0ZSBvbkNvbmZpcm06IChjb25maXJtZWQ6IGJvb2xlYW4pID0+IHZvaWQ7XG5cdFxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgbWVzc2FnZTogc3RyaW5nLCBvbkNvbmZpcm06IChjb25maXJtZWQ6IGJvb2xlYW4pID0+IHZvaWQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5vbkNvbmZpcm0gPSBvbkNvbmZpcm07XG5cdH1cblx0XG5cdG9uT3BlbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IHRoaXMubWVzc2FnZSB9KTtcblx0XHRcblx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCdidXR0b24tY29udGFpbmVyJyk7XG5cdFx0XG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbkNvbnRhaW5lci5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NvbmZpcm0nLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0fSk7XG5cdFx0Y29uZmlybUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMub25Db25maXJtKHRydWUpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbkNvbnRhaW5lci5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NhbmNlbCcsXG5cdFx0fSk7XG5cdFx0Y2FuY2VsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oZmFsc2UpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cdFxuXHRvbkNsb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsIi8qKlxuICogQUkg5o+Q56S66K+N6ZuG5Lit566h55CGXG4gKi9cblxuZXhwb3J0IGNvbnN0IFNZU1RFTV9QUk9NUFQgPSBg5L2g5piv5LiT5Lia55qE5oqA5pyv5paH56ug5YiG57G75Yqp5omL44CCXG5cbiMjIOS9oOeahOiBjOi0o1xuMS4g5YiG5p6Q55So5oi35o+Q5L6b55qE5paH56ug5YaF5a65XG4yLiDku47pooTlrprkuYnliIbnsbvliJfooajkuK3pgInmi6nmnIDljLnphY3nmoTkuIDkuKpcbjMuIOi/lOWbnue7k+aehOWMlueahOWIhuexu+e7k+aenFxuXG4jIyDliIbnsbvljp/liJlcbjEuICoq57K+56Gu5Yy56YWNKirvvJrkvJjlhYjpgInmi6nkuI7mlofnq6DkuLvpopjlrozlhajljLnphY3nmoTliIbnsbtcbjIuICoq6K+t5LmJ55CG6KejKirvvJrnkIbop6Pmlofnq6DnmoTmioDmnK/poobln5/lkozkuLvpophcbjMuICoq5bGC57qn6YCJ5oupKirvvJrpgInmi6nmnIDlhbfkvZPnmoTlrZDliIbnsbvvvIzogIzpnZ7niLbliIbnsbtcbjQuICoq5ZCI55CG5o6o5patKirvvJrln7rkuo7moIfpopjlkozlhoXlrrnmkZjopoHov5vooYzmjqjmlq1cblxuIyMg5YiG57G75LyY5YWI57qnXG4xLiDnvJbnqIsv5YmN56uvIChGcm9udGVuZCnvvJpSZWFjdCwgVnVlLCBDU1MsIEhUTUwsIFdlYiDlvIDlj5HnrYlcbjIuIOe8lueoiy/lkI7nq68gKEJhY2tlbmQp77yaTm9kZS5qcywgUHl0aG9uLCBKYXZhLCBBUEksIFNlcnZlciDnrYlcbjMuIOe8lueoiy/np7vliqjnq68gKE1vYmlsZSnvvJppT1MsIEFuZHJvaWQsIEZsdXR0ZXIsIFJlYWN0IE5hdGl2ZSDnrYlcbjQuIOe8lueoiy9EZXZPcHPvvJpEb2NrZXIsIEt1YmVybmV0ZXMsIENJL0NELCBDbG91ZCDnrYlcbjUuIEFJL+acuuWZqOWtpuS5oO+8mk1MLCDmnLrlmajlrabkuaDnrpfms5UsIOaVsOaNruenkeWtpuetiVxuNi4gQUkv5rex5bqm5a2m5Lmg77yaRGVlcCBMZWFybmluZywgTmV1cmFsIE5ldHdvcmssIFRlbnNvckZsb3csIFB5VG9yY2gg562JXG43LiBBSS9OTFDvvJroh6rnhLbor63oqIDlpITnkIYsIExMTSwgQ2hhdEdQVCDnrYlcbjguIOaVsOaNri/mlbDmja7lupPvvJpEYXRhYmFzZSwgU1FMLCBQb3N0Z3JlU1FMLCBNb25nb0RCIOetiVxuOS4g5pWw5o2uL+aVsOaNruW3peeoi++8mkVUTCwgUGlwZWxpbmUsIERhdGEgV2FyZWhvdXNlIOetiVxuMTAuIOaetuaehC/ns7vnu5/orr7orqHvvJpTeXN0ZW0gRGVzaWduLCBBcmNoaXRlY3R1cmUsIFNjYWxhYmlsaXR5IOetiVxuMTEuIE90aGVy77ya5peg5rOV5b2S5YWl5LiK6L+w5YiG57G755qE5YaF5a65XG5cbiMjIOi+k+WHuuagvOW8j1xu6K+35LulIEpTT04g5qC85byP6L+U5Zue57uT5p6c77yaXG57XG4gIFwiY2F0ZWdvcnlcIjogXCLliIbnsbvot6/lvoTvvIzlpoIgJ+e8lueoiy/liY3nq68nXCIsXG4gIFwiY29uZmlkZW5jZVwiOiAwLjAtMS4wIOeahOe9ruS/oeW6puWIhuaVsCxcbiAgXCJyZWFzb25pbmdcIjogXCLnroDnn63nmoTnkIbnlLHor7TmmI5cIixcbiAgXCJpc1VuY2VydGFpblwiOiBmYWxzZSxcbiAgXCJzdWdnZXN0ZWRDYXRlZ29yeVwiOiBcIuWmguaenOehruWunuayoeacieWQiOmAguWIhuexu++8jOW7uuiurueahOaWsOWIhuexu+WQje+8iOWPr+mAie+8iVwiXG59XG5cbiMjIOazqOaEj+S6i+mhuVxuLSDlpoLmnpzmlofnq6DmmI7mmL7lsZ7kuo7mn5DkuKrpoobln5/vvIzpgInmi6nor6Xpoobln5/nmoTmnIDlhbfkvZPliIbnsbtcbi0g5aaC5p6c572u5L+h5bqm5L2O5LqOIDAuNe+8jOiuvue9riBpc1VuY2VydGFpbjogdHJ1ZVxuLSDlp4vnu4jov5Tlm57kuIDkuKrlkIjnkIbnmoTliIbnsbvvvIzkuI3opoHov5Tlm57nqbrlgLxgO1xuXG5leHBvcnQgY29uc3QgVVNFUl9QUk9NUFRfVEVNUExBVEUgPSBg6K+35YiG5p6Q5Lul5LiL5paH56ug5bm25YiG57G777yaXG5cbiMjIOaWh+eroOagh+mimFxue3tUSVRMRX19XG5cbiMjIOaWh+eroOWGheWuueaRmOimgVxue3tDT05URU5UfX1cblxuIyMg5Y+v55So5YiG57G75YiX6KGoXG57e0NBVEVHT1JJRVN9fVxuXG7or7fku47kuIrov7DliIbnsbvliJfooajkuK3pgInmi6nmnIDljLnphY3nmoTkuIDkuKrvvIzlubbov5Tlm54gSlNPTiDmoLzlvI/nmoTliIbnsbvnu5PmnpzjgIJgO1xuXG5leHBvcnQgY29uc3QgU1VHR0VTVF9DQVRFR09SWV9QUk9NUFQgPSBg5paH56ug5YaF5a655LiO546w5pyJ5YiG57G76YO95LiN5aSq5Yy56YWN44CCXG7lvZPml6Dms5Xmib7liLDlkIjpgILliIbnsbvml7bvvIzlj6/ku6Xlu7rorq7kuIDkuKrmlrDliIbnsbvlkI3np7DjgIJcbuaWsOWIhuexu+W6lOivpeaYr+WQiOeQhueahOaKgOacr+mihuWfn+WQjeensOOAgmA7XG4iLCJpbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFBsdWdpblNldHRpbmdzIH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU1lTVEVNX1BST01QVCwgVVNFUl9QUk9NUFRfVEVNUExBVEUgfSBmcm9tICcuL3Byb21wdHMnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IHdpdGhSZXRyeSwgZmV0Y2hXaXRoVGltZW91dCwgZ2V0VXNlckZyaWVuZGx5TWVzc2FnZSwgdmFsaWRhdGVVcmwgfSBmcm9tICcuLi91dGlscy9lcnJvckhhbmRsZXInO1xuXG5leHBvcnQgY2xhc3MgT2xsYW1hUHJvdmlkZXIgaW1wbGVtZW50cyBBSVByb3ZpZGVyIHtcblx0bmFtZSA9ICdPbGxhbWEnO1xuXHRwcml2YXRlIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblx0cHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblx0XG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdH1cblx0XG5cdGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDpqozor4EgVVJMIOagvOW8j1xuXHRcdFx0dmFsaWRhdGVVcmwodGhpcy5zZXR0aW5ncy5vbGxhbWFVcmwsICdPbGxhbWEg5Zyw5Z2AJyk7XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRgJHt0aGlzLnNldHRpbmdzLm9sbGFtYVVybH0vYXBpL3RhZ3NgLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWV0aG9kOiAnR0VUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcblx0XHRcdFx0fSxcblx0XHRcdFx0MTAwMDAgLy8gMTAg56eS6LaF5pe2XG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzcG9uc2Uub2spIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ09sbGFtYSDmnI3liqHmraPluLgnIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCB9O1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2UgfTtcblx0XHR9XG5cdH1cblx0XG5cdGFzeW5jIGNsYXNzaWZ5KGNvbnRlbnQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgY2F0ZWdvcmllczogc3RyaW5nW10pOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0PiB7XG5cdFx0Ly8g5L2/55So5bim6YeN6K+V55qE5pON5L2cXG5cdFx0cmV0dXJuIGF3YWl0IHdpdGhSZXRyeShcblx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdXNlclByb21wdCA9IFVTRVJfUFJPTVBUX1RFTVBMQVRFXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7VElUTEV9fScsIHRpdGxlKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e0NPTlRFTlR9fScsIGNvbnRlbnQuc2xpY2UoMCwgNDAwMCkpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q0FURUdPUklFU319JywgY2F0ZWdvcmllcy5tYXAoYyA9PiBgLSAke2N9YCkuam9pbignXFxuJykpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8g5L2/55So5bim6LaF5pe255qEIGZldGNoXG5cdFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChcblx0XHRcdFx0XHRgJHt0aGlzLnNldHRpbmdzLm9sbGFtYVVybH0vYXBpL2dlbmVyYXRlYCxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuXHRcdFx0XHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5vbGxhbWFNb2RlbCxcblx0XHRcdFx0XHRcdFx0cHJvbXB0OiBgPHxpbV9zdGFydHw+c3lzdGVtXFxuJHtTWVNURU1fUFJPTVBUfTx8aW1fZW5kfD5cXG48fGltX3N0YXJ0fD51c2VyXFxuJHt1c2VyUHJvbXB0fTx8aW1fZW5kfD5gLFxuXHRcdFx0XHRcdFx0XHRzdHJlYW06IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0dGVtcGVyYXR1cmU6IDAuMyxcblx0XHRcdFx0XHRcdFx0XHRudW1fcHJlZGljdDogNTAwLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQ2MDAwMCAvLyA2MCDnp5LotoXml7bvvIhPbGxhbWEg5Y+v6IO96L6D5oWi77yJXG5cdFx0XHRcdCk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnJvckRhdGEuZXJyb3IgfHwgYE9sbGFtYSBBUEkg6ZSZ6K+vOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyc2VSZXNwb25zZShkYXRhLnJlc3BvbnNlKTtcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG1heEF0dGVtcHRzOiAzLFxuXHRcdFx0XHRpbml0aWFsRGVsYXk6IDIwMDAsXG5cdFx0XHR9LFxuXHRcdFx0J09sbGFtYSBjbGFzc2lmeSdcblx0XHQpO1xuXHR9XG5cdFxuXHRwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2U6IHN0cmluZyk6IENsYXNzaWZpY2F0aW9uUmVzdWx0IHtcblx0XHQvLyDlsJ3or5Xku47lk43lupTkuK3mj5Dlj5YgSlNPTlxuXHRcdGNvbnN0IGpzb25NYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9gYGBqc29uXFxuKFtcXHNcXFNdKj8pXFxuYGBgLykgfHwgcmVzcG9uc2UubWF0Y2goLyhcXHtbXFxzXFxTXSpcXH0pLyk7XG5cdFx0XG5cdFx0aWYgKGpzb25NYXRjaCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uTWF0Y2hbMV0pO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGNhdGVnb3J5OiBwYXJzZWQuY2F0ZWdvcnkgfHwgJ090aGVyJyxcblx0XHRcdFx0XHRjb25maWRlbmNlOiBwYXJzZWQuY29uZmlkZW5jZSB8fCAwLjUsXG5cdFx0XHRcdFx0cmVhc29uaW5nOiBwYXJzZWQucmVhc29uaW5nIHx8ICcnLFxuXHRcdFx0XHRcdGlzVW5jZXJ0YWluOiBwYXJzZWQuaXNVbmNlcnRhaW4gfHwgZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGVkQ2F0ZWdvcnk6IHBhcnNlZC5zdWdnZXN0ZWRDYXRlZ29yeSxcblx0XHRcdFx0fTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZygnSlNPTiDop6PmnpDlpLHotKXvvIzkvb/nlKjmlofmnKzop6PmnpAnKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0Ly8g5aSH55So6Kej5p6Q77ya5o+Q5Y+W56ys5LiA5Liq5YiG57G76Lev5b6EXG5cdFx0Y29uc3QgY2F0ZWdvcnlNYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9jYXRlZ29yeVtcXHM6XStbXCInXT8oW15cXG5cIiddKykvaSk7XG5cdFx0Y29uc3QgY29uZmlkZW5jZU1hdGNoID0gcmVzcG9uc2UubWF0Y2goL2NvbmZpZGVuY2VbXFxzOl0rKFswLTkuXSspL2kpO1xuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRjYXRlZ29yeTogY2F0ZWdvcnlNYXRjaCA/IGNhdGVnb3J5TWF0Y2hbMV0udHJpbSgpIDogJ090aGVyJyxcblx0XHRcdGNvbmZpZGVuY2U6IGNvbmZpZGVuY2VNYXRjaCA/IHBhcnNlRmxvYXQoY29uZmlkZW5jZU1hdGNoWzFdKSA6IDAuNSxcblx0XHRcdHJlYXNvbmluZzogcmVzcG9uc2Uuc2xpY2UoMCwgMjAwKSxcblx0XHRcdGlzVW5jZXJ0YWluOiBmYWxzZSxcblx0XHR9O1xuXHR9XG59XG4iLCJpbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFNZU1RFTV9QUk9NUFQsIFVTRVJfUFJPTVBUX1RFTVBMQVRFIH0gZnJvbSAnLi9wcm9tcHRzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyB3aXRoUmV0cnksIGZldGNoV2l0aFRpbWVvdXQsIGdldFVzZXJGcmllbmRseU1lc3NhZ2UsIHZhbGlkYXRlVXJsIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JIYW5kbGVyJztcblxuaW50ZXJmYWNlIFByb3ZpZGVyQ29uZmlnIHtcblx0bmFtZTogc3RyaW5nO1xuXHRhcGlLZXk6IHN0cmluZztcblx0bW9kZWw6IHN0cmluZztcblx0YmFzZVVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyIGltcGxlbWVudHMgQUlQcm92aWRlciB7XG5cdG5hbWU6IHN0cmluZztcblx0cHJpdmF0ZSBjb25maWc6IFByb3ZpZGVyQ29uZmlnO1xuXHRwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuXHRcblx0Y29uc3RydWN0b3IoY29uZmlnOiBQcm92aWRlckNvbmZpZywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLm5hbWUgPSBjb25maWcubmFtZTtcblx0XHR0aGlzLmNvbmZpZyA9IGNvbmZpZztcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcblx0fVxuXHRcblx0YXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIOmqjOivgSBBUEkgS2V5XG5cdFx0XHRpZiAoIXRoaXMuY29uZmlnLmFwaUtleSB8fCB0aGlzLmNvbmZpZy5hcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FQSSBLZXkg5pyq6K6+572u77yM6K+35YWI6YWN572uIEFQSSBLZXknIH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOmqjOivgSBVUkxcblx0XHRcdHZhbGlkYXRlVXJsKHRoaXMuY29uZmlnLmJhc2VVcmwsICdBUEkg5Zyw5Z2AJyk7XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRgJHt0aGlzLmNvbmZpZy5iYXNlVXJsfS9tb2RlbHNgLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWV0aG9kOiAnR0VUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmNvbmZpZy5hcGlLZXl9YCxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQxMDAwMCAvLyAxMCDnp5LotoXml7Zcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdGlmIChyZXNwb25zZS5vaykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgJHt0aGlzLm5hbWV9IEFQSSDov57mjqXmraPluLhgIH07XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxKSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQVBJIEtleSDml6DmlYjmiJbmnKrmjojmnYPvvIzor7fmo4Dmn6XmmK/lkKbmraPnoa4nIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiDmnI3liqHmmoLml7bkuI3lj6/nlKhgIH07XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZSB9O1xuXHRcdH1cblx0fVxuXHRcblx0YXN5bmMgY2xhc3NpZnkoY29udGVudDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBjYXRlZ29yaWVzOiBzdHJpbmdbXSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHQ+IHtcblx0XHQvLyDkvb/nlKjluKbph43or5XnmoTmk43kvZxcblx0XHRyZXR1cm4gYXdhaXQgd2l0aFJldHJ5KFxuXHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB1c2VyUHJvbXB0ID0gVVNFUl9QUk9NUFRfVEVNUExBVEVcblx0XHRcdFx0XHQucmVwbGFjZSgne3tUSVRMRX19JywgdGl0bGUpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q09OVEVOVH19JywgY29udGVudC5zbGljZSgwLCA0MDAwKSlcblx0XHRcdFx0XHQucmVwbGFjZSgne3tDQVRFR09SSUVTfX0nLCBjYXRlZ29yaWVzLm1hcChjID0+IGAtICR7Y31gKS5qb2luKCdcXG4nKSk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvLyDkvb/nlKjluKbotoXml7bnmoQgZmV0Y2hcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRcdGAke3RoaXMuY29uZmlnLmJhc2VVcmx9L2NoYXQvY29tcGxldGlvbnNgLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmNvbmZpZy5hcGlLZXl9YCxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdFx0XHRcdG1vZGVsOiB0aGlzLmNvbmZpZy5tb2RlbCxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0XHRcdFx0XHR7IHJvbGU6ICdzeXN0ZW0nLCBjb250ZW50OiBTWVNURU1fUFJPTVBUIH0sXG5cdFx0XHRcdFx0XHRcdFx0eyByb2xlOiAndXNlcicsIGNvbnRlbnQ6IHVzZXJQcm9tcHQgfSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0dGVtcGVyYXR1cmU6IDAuMyxcblx0XHRcdFx0XHRcdFx0bWF4X3Rva2VuczogNTAwLFxuXHRcdFx0XHRcdFx0XHRyZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQzMDAwMCAvLyAzMCDnp5LotoXml7Zcblx0XHRcdFx0KTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0XHRjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcblx0XHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGVycm9yLmVycm9yPy5tZXNzYWdlIHx8IGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfWA7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8g5p6E6YCg5pu06K+m57uG55qE6ZSZ6K+vXG5cdFx0XHRcdFx0Y29uc3QgZW5oYW5jZWRFcnJvciA9IG5ldyBFcnJvcihlcnJvck1zZykgYXMgRXJyb3IgJiB7XG5cdFx0XHRcdFx0XHRzdGF0dXM6IG51bWJlcjtcblx0XHRcdFx0XHRcdHJlc3BvbnNlOiB7IHN0YXR1czogbnVtYmVyOyBoZWFkZXJzOiBIZWFkZXJzIH07XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRlbmhhbmNlZEVycm9yLnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcblx0XHRcdFx0XHRlbmhhbmNlZEVycm9yLnJlc3BvbnNlID0geyBcblx0XHRcdFx0XHRcdHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuXHRcdFx0XHRcdFx0aGVhZGVyczogcmVzcG9uc2UuaGVhZGVycyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRocm93IGVuaGFuY2VkRXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdFRleHQgPSBkYXRhLmNob2ljZXNbMF0/Lm1lc3NhZ2U/LmNvbnRlbnQgfHwgJ3t9Jztcblx0XHRcdFx0XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcnNlUmVzcG9uc2UocmVzdWx0VGV4dCk7XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRtYXhBdHRlbXB0czogMyxcblx0XHRcdFx0aW5pdGlhbERlbGF5OiAxNTAwLFxuXHRcdFx0fSxcblx0XHRcdGAke3RoaXMubmFtZX0gY2xhc3NpZnlgXG5cdFx0KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBwYXJzZVJlc3BvbnNlKHJlc3BvbnNlVGV4dDogc3RyaW5nKTogQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJlc3BvbnNlVGV4dCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYXRlZ29yeTogcGFyc2VkLmNhdGVnb3J5IHx8ICdPdGhlcicsXG5cdFx0XHRcdGNvbmZpZGVuY2U6IHBhcnNlZC5jb25maWRlbmNlIHx8IDAuNSxcblx0XHRcdFx0cmVhc29uaW5nOiBwYXJzZWQucmVhc29uaW5nIHx8ICcnLFxuXHRcdFx0XHRpc1VuY2VydGFpbjogcGFyc2VkLmlzVW5jZXJ0YWluIHx8IGZhbHNlLFxuXHRcdFx0XHRzdWdnZXN0ZWRDYXRlZ29yeTogcGFyc2VkLnN1Z2dlc3RlZENhdGVnb3J5LFxuXHRcdFx0fTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKCdKU09OIOino+aekOWksei0pScpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICdPdGhlcicsXG5cdFx0XHRcdGNvbmZpZGVuY2U6IDAuNSxcblx0XHRcdFx0cmVhc29uaW5nOiByZXNwb25zZVRleHQuc2xpY2UoMCwgMjAwKSxcblx0XHRcdFx0aXNVbmNlcnRhaW46IHRydWUsXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKiDnroDljZXml6Xlv5flt6XlhbdcbiAqL1xuZXhwb3J0IGNsYXNzIExvZ2dlciB7XG5cdHByaXZhdGUgZW5hYmxlZDogYm9vbGVhbjtcblx0cHJpdmF0ZSBwcmVmaXggPSAnW0FJQ2xhc3NpZmllcl0nO1xuXHRcblx0Y29uc3RydWN0b3IoZW5hYmxlZCA9IGZhbHNlKSB7XG5cdFx0dGhpcy5lbmFibGVkID0gZW5hYmxlZDtcblx0fVxuXHRcblx0c2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZW5hYmxlZDtcblx0fVxuXHRcblx0ZGVidWcobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5lbmFibGVkKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdFx0fVxuXHR9XG5cdFxuXHRpbmZvKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhgJHt0aGlzLnByZWZpeH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuXHR9XG5cdFxuXHR3YXJuKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG5cdFx0Y29uc29sZS53YXJuKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cblx0XG5cdGVycm9yKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG5cdFx0Y29uc29sZS5lcnJvcihgJHt0aGlzLnByZWZpeH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4sIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgREVGQVVMVF9TRVRUSU5HUywgUGx1Z2luU2V0dGluZ3MsIEFJUHJvdmlkZXIgfSBmcm9tICcuL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFNldHRpbmdzVGFiIH0gZnJvbSAnLi9zZXR0aW5ncy9TZXR0aW5nc1RhYic7XG5pbXBvcnQgeyBDbGFzc2lmeUNvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL0NsYXNzaWZ5Q29tbWFuZCc7XG5pbXBvcnQgeyBPbGxhbWFQcm92aWRlciB9IGZyb20gJy4vc2VydmljZXMvT2xsYW1hUHJvdmlkZXInO1xuaW1wb3J0IHsgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyIH0gZnJvbSAnLi9zZXJ2aWNlcy9PcGVuQUlQcm92aWRlcic7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyBmaWxlT3BzIH0gZnJvbSAnLi91dGlscy9maWxlT3BzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQUlDbGFzc2lmaWVyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcblx0Ly8g5o+S5Lu26K6+572uXG5cdHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG5cdFxuXHQvLyDml6Xlv5dcblx0bG9nZ2VyID0gbmV3IExvZ2dlcigpO1xuXHRcblx0Ly8g5ZG95Luk5aSE55CGXG5cdHByaXZhdGUgY29tbWFuZHM6IENsYXNzaWZ5Q29tbWFuZDtcblx0XG5cdC8vIOiuvue9rumdouadv1xuXHRwcml2YXRlIHNldHRpbmdzVGFiOiBTZXR0aW5nc1RhYjtcblx0XG5cdGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zb2xlLmRlYnVnKCdbQUkgQ2xhc3NpZmllcl0g5o+S5Lu25Yqg6L295LitLi4uJyk7XG5cdFx0XG5cdFx0Ly8g5Yqg6L296K6+572uXG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblx0XHRcblx0XHQvLyDliJ3lp4vljJbml6Xlv5dcblx0XHR0aGlzLmxvZ2dlci5zZXRFbmFibGVkKHRoaXMuc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpO1xuXHRcdFxuXHRcdC8vIOiHquWKqOWIm+W7uiBJbmJveCDnm67lvZXvvIjlpoLmnpzkuI3lrZjlnKjvvIlcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGF3YWl0IGZpbGVPcHMuZW5zdXJlRm9sZGVyKHRoaXMuYXBwLnZhdWx0LCB0aGlzLnNldHRpbmdzLmluYm94Rm9sZGVyKTtcblx0XHRcdGlmIChjcmVhdGVkKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8oYOW3suWIm+W7uuaUtuS7tueuseaWh+S7tuWkuTogJHt0aGlzLnNldHRpbmdzLmluYm94Rm9sZGVyfWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKCfliJvlu7rmlLbku7bnrrHmlofku7blpLnlpLHotKU6JywgZSk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOWIneWni+WMluWRveS7pFxuXHRcdHRoaXMuY29tbWFuZHMgPSBuZXcgQ2xhc3NpZnlDb21tYW5kKHRoaXMpO1xuXHRcdFxuXHRcdC8vIOazqOWGjOWRveS7pFxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogJ2NsYXNzaWZ5LWluYm94Jyxcblx0XHRcdG5hbWU6ICdBSeaZuuiDveWIhuexuyAtIOWIhuexu+aUtuS7tueusScsXG5cdFx0XHRjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5SW5ib3goKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0XG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAnY2xhc3NpZnktY3VycmVudCcsXG5cdFx0XHRuYW1lOiAnQUnmmbrog73liIbnsbsgLSDliIbnsbvlvZPliY3mlofku7YnLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFx0XHRpZiAoZmlsZSkge1xuXHRcdFx0XHRcdGlmICghY2hlY2tpbmcpIHtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5jb21tYW5kcy5jbGFzc2lmeUN1cnJlbnRGaWxlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0XG5cdFx0Ly8gMS4g5re75YqgIFJpYmJvbiDlm77moIfvvIjlt6bkvqfovrnmoI/vvIlcblx0XHR0aGlzLmFkZFJpYmJvbkljb24oJ3NwYXJrbGVzJywgJ0FJ5pm66IO95YiG57G7JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kcy5jbGFzc2lmeUluYm94KCk7XG5cdFx0fSk7XG5cdFx0XG5cdFx0Ly8gMi4g5re75Yqg5paH5Lu25Y+z6ZSu6I+c5Y2VXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW1lbnUnLCAobWVudSwgZmlsZSkgPT4ge1xuXHRcdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRcdFx0XHRpdGVtXG5cdFx0XHRcdFx0XHRcdC5zZXRUaXRsZSgnQUnmmbrog73liIbnsbsnKVxuXHRcdFx0XHRcdFx0XHQuc2V0SWNvbignc3BhcmtsZXMnKVxuXHRcdFx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kcy5jbGFzc2lmeUN1cnJlbnRGaWxlKCk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8gMy4g5re75Yqg57yW6L6R5Zmo6I+c5Y2V77yI5Y+z5LiK6KeS5pu05aSa6I+c5Y2V77yJXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKCdlZGl0b3ItbWVudScsIChtZW51KSA9PiB7XG5cdFx0XHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0XHRcdGl0ZW1cblx0XHRcdFx0XHRcdC5zZXRUaXRsZSgnQUnmmbrog73liIbnsbsnKVxuXHRcdFx0XHRcdFx0LnNldEljb24oJ3NwYXJrbGVzJylcblx0XHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kcy5jbGFzc2lmeUN1cnJlbnRGaWxlKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8g5re75Yqg6K6+572u6Z2i5p2/XG5cdFx0dGhpcy5zZXR0aW5nc1RhYiA9IG5ldyBTZXR0aW5nc1RhYih0aGlzLmFwcCwgdGhpcyk7XG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKHRoaXMuc2V0dGluZ3NUYWIpO1xuXHRcdFxuXHRcdGNvbnNvbGUuZGVidWcoJ1tBSSBDbGFzc2lmaWVyXSDmj5Lku7bliqDovb3lrozmiJAhJyk7XG5cdH1cblx0XG5cdG9udW5sb2FkKCk6IHZvaWQge1xuXHRcdGNvbnNvbGUuZGVidWcoJ1tBSSBDbGFzc2lmaWVyXSDmj5Lku7blt7Lljbjovb0nKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOiOt+WPliBBSSBQcm92aWRlciDlrp7kvotcblx0ICovXG5cdGdldEFJUHJvdmlkZXIoKTogQUlQcm92aWRlciB7XG5cdFx0Y29uc3QgcHJvdmlkZXJUeXBlID0gdGhpcy5zZXR0aW5ncy5haVByb3ZpZGVyO1xuXHRcdFxuXHRcdC8vIOmqjOivgemFjee9rlxuXHRcdHRoaXMudmFsaWRhdGVQcm92aWRlckNvbmZpZyhwcm92aWRlclR5cGUpO1xuXHRcdFxuXHRcdHN3aXRjaCAocHJvdmlkZXJUeXBlKSB7XG5cdFx0XHRjYXNlICdvbGxhbWEnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9sbGFtYVByb3ZpZGVyKHRoaXMuc2V0dGluZ3MsIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnb3BlbmFpJzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIoe1xuXHRcdFx0XHRcdG5hbWU6ICdPcGVuQUknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3Mub3BlbmFpTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnZGVlcHNlZWsnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ0RlZXBTZWVrJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpVXJsLFxuXHRcdFx0XHR9LCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIoe1xuXHRcdFx0XHRcdG5hbWU6ICdNb29uc2hvdCAoS2ltaSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5tb29uc2hvdE1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ1poaXB1ICjmmbrosLEpJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMuc2V0dGluZ3MuemhpcHVBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MuemhpcHVNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLnpoaXB1QXBpVXJsLFxuXHRcdFx0XHR9LCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDmnKrnn6XnmoQgQUkgUHJvdmlkZXI6ICR7cHJvdmlkZXJUeXBlIGFzIHN0cmluZ31gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDpqozor4EgUHJvdmlkZXIg6YWN572uXG5cdCAqL1xuXHRwcml2YXRlIHZhbGlkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXJUeXBlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyVHlwZSkge1xuXHRcdFx0Y2FzZSAnb2xsYW1hJzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm9sbGFtYVVybCB8fCB0aGlzLnNldHRpbmdzLm9sbGFtYVVybC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPbGxhbWEg5Zyw5Z2A5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm9sbGFtYU1vZGVsIHx8IHRoaXMuc2V0dGluZ3Mub2xsYW1hTW9kZWwudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignT2xsYW1hIOaooeWei+acqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5IHx8IHRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ09wZW5BSSBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSB8fCB0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RlZXBTZWVrIEFQSSBLZXkg5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm1vb25zaG90QXBpS2V5IHx8IHRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTW9vbnNob3QgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuemhpcHVBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCfmmbrosLEgQUkgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDmnKrnn6XnmoQgQUkgUHJvdmlkZXI6ICR7cHJvdmlkZXJUeXBlfWApO1xuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOWKoOi9veiuvue9rlxuXHQgKi9cblx0YXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IHtcblx0XHRcdC4uLkRFRkFVTFRfU0VUVElOR1MsXG5cdFx0XHQuLi5kYXRhLFxuXHRcdH07XG5cdFx0XG5cdFx0Ly8g5Yid5aeL5YyW5YiG57G75YiX6KGoXG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMgfHwgdGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh0aGlzLnNldHRpbmdzLmNhdGVnb3J5VHJlZSk7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5L+d5a2Y6K6+572uXG5cdCAqL1xuXHRhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0XHR0aGlzLmxvZ2dlci5zZXRFbmFibGVkKHRoaXMuc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5bCG5YiG57G75qCR5bGV5bmz5Li65YiX6KGoXG5cdCAqL1xuXHRwcml2YXRlIGZsYXR0ZW5DYXRlZ29yaWVzKHRyZWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwcmVmaXggPSAnJyk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModHJlZSkpIHtcblx0XHRcdGNvbnN0IHBhdGggPSBwcmVmaXggPyBgJHtwcmVmaXh9LyR7a2V5fWAgOiBrZXk7XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCguLi50aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwYXRoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucHVzaChwYXRoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuIl0sIm5hbWVzIjpbIk5vdGljZSIsIkNvbmZpcm1Nb2RhbCIsIk1vZGFsIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJURmlsZSIsInJlcXVlc3RVcmwiLCJQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUErQ08sTUFBTSxnQkFBZ0IsR0FBbUI7QUFDL0MsSUFBQSxVQUFVLEVBQUUsUUFBUTtBQUNwQixJQUFBLFNBQVMsRUFBRSx3QkFBd0I7QUFDbkMsSUFBQSxXQUFXLEVBQUUsVUFBVTs7QUFHdkIsSUFBQSxZQUFZLEVBQUUsRUFBRTtBQUNoQixJQUFBLFdBQVcsRUFBRSxhQUFhO0FBQzFCLElBQUEsWUFBWSxFQUFFLDJCQUEyQjs7QUFHekMsSUFBQSxjQUFjLEVB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
