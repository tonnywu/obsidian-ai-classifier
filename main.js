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
                .addOption('openai', 'OpenAI')
                .addOption('deepseek', 'DeepSeek')
                .addOption('moonshot', 'Moonshot (Kimi)')
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
                    .setPlaceholder('sk-...')
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3NyYy9zZXR0aW5ncy90eXBlcy50cyIsInNyYy9zcmMvc2V0dGluZ3MvaTE4bi50cyIsInNyYy9zcmMvc2V0dGluZ3MvQ2F0ZWdvcnlUcmVlVmlldy50cyIsInNyYy9zcmMvc2V0dGluZ3MvU2V0dGluZ3NUYWIudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NvbnRlbnRFeHRyYWN0b3IudHMiLCJzcmMvc3JjL3V0aWxzL2ZpbGVPcHMudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NsYXNzaWZpZXIudHMiLCJzcmMvc3JjL3V0aWxzL2Vycm9ySGFuZGxlci50cyIsInNyYy9zcmMvY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9wcm9tcHRzLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlci50cyIsInNyYy9zcmMvc2VydmljZXMvT3BlbkFJUHJvdmlkZXIudHMiLCJzcmMvc3JjL3V0aWxzL2xvZ2dlci50cyIsInNyYy9zcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgdHlwZSBBSVByb3ZpZGVyVHlwZSA9ICdvbGxhbWEnIHwgJ29wZW5haScgfCAnZGVlcHNlZWsnIHwgJ21vb25zaG90JyB8ICd6aGlwdSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2F0ZWdvcnlUcmVlIHtcblx0W25hbWU6IHN0cmluZ106IENhdGVnb3J5VHJlZSB8IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuXHQvLyBBSSDphY3nva5cblx0YWlQcm92aWRlcjogQUlQcm92aWRlclR5cGU7XG5cdG9sbGFtYVVybDogc3RyaW5nO1xuXHRvbGxhbWFNb2RlbDogc3RyaW5nO1xuXHRcblx0Ly8gT3BlbkFJIOmFjee9rlxuXHRvcGVuYWlBcGlLZXk6IHN0cmluZztcblx0b3BlbmFpTW9kZWw6IHN0cmluZztcblx0b3BlbmFpQXBpVXJsOiBzdHJpbmc7XG5cdFxuXHQvLyBEZWVwU2VlayDphY3nva5cblx0ZGVlcHNlZWtBcGlLZXk6IHN0cmluZztcblx0ZGVlcHNlZWtNb2RlbDogc3RyaW5nO1xuXHRkZWVwc2Vla0FwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gTW9vbnNob3QgKEtpbWkpIOmFjee9rlxuXHRtb29uc2hvdEFwaUtleTogc3RyaW5nO1xuXHRtb29uc2hvdE1vZGVsOiBzdHJpbmc7XG5cdG1vb25zaG90QXBpVXJsOiBzdHJpbmc7XG5cdFxuXHQvLyBaaGlwdSAo5pm66LCxIEFJKSDphY3nva5cblx0emhpcHVBcGlLZXk6IHN0cmluZztcblx0emhpcHVNb2RlbDogc3RyaW5nO1xuXHR6aGlwdUFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8g5YiG57G76YWN572uXG5cdGluYm94Rm9sZGVyOiBzdHJpbmc7XG5cdGNhdGVnb3J5VHJlZTogQ2F0ZWdvcnlUcmVlO1xuXHRjYXRlZ29yaWVzOiBzdHJpbmdbXTtcblx0c2NhblN1YmZvbGRlcnM6IGJvb2xlYW47XG5cdFxuXHQvLyDpq5jnuqflip/og71cblx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogYm9vbGVhbjtcblx0YXV0b01vdmVGaWxlOiBib29sZWFuO1xuXHRjb25maWRlbmNlVGhyZXNob2xkOiBudW1iZXI7XG5cdFxuXHQvLyDml6Xlv5dcblx0ZW5hYmxlRGVidWdMb2c6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcblx0YWlQcm92aWRlcjogJ29sbGFtYScsXG5cdG9sbGFtYVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MTE0MzQnLFxuXHRvbGxhbWFNb2RlbDogJ2xsYW1hMy4yJyxcblx0XG5cdC8vIE9wZW5BSSDpu5jorqTphY3nva5cblx0b3BlbmFpQXBpS2V5OiAnJyxcblx0b3BlbmFpTW9kZWw6ICdncHQtNG8tbWluaScsXG5cdG9wZW5haUFwaVVybDogJ2h0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEnLFxuXHRcblx0Ly8gRGVlcFNlZWsg6buY6K6k6YWN572uXG5cdGRlZXBzZWVrQXBpS2V5OiAnJyxcblx0ZGVlcHNlZWtNb2RlbDogJ2RlZXBzZWVrLWNoYXQnLFxuXHRkZWVwc2Vla0FwaVVybDogJ2h0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbS92MScsXG5cdFxuXHQvLyBNb29uc2hvdCAoS2ltaSkg6buY6K6k6YWN572uXG5cdG1vb25zaG90QXBpS2V5OiAnJyxcblx0bW9vbnNob3RNb2RlbDogJ21vb25zaG90LXYxLThrJyxcblx0bW9vbnNob3RBcGlVcmw6ICdodHRwczovL2FwaS5tb29uc2hvdC5jbi92MScsXG5cdFxuXHQvLyBaaGlwdSAo5pm66LCxKSDpu5jorqTphY3nva5cblx0emhpcHVBcGlLZXk6ICcnLFxuXHR6aGlwdU1vZGVsOiAnZ2xtLTQnLFxuXHR6aGlwdUFwaVVybDogJ2h0dHBzOi8vb3Blbi5iaWdtb2RlbC5jbi9hcGkvcGFhcy92NCcsXG5cdFxuXHRpbmJveEZvbGRlcjogJ0luYm94Jyxcblx0Y2F0ZWdvcnlUcmVlOiB7XG5cdFx0J1Byb2dyYW1taW5nJzoge1xuXHRcdFx0J0Zyb250ZW5kJzogdHJ1ZSxcblx0XHRcdCdCYWNrZW5kJzogdHJ1ZSxcblx0XHRcdCdNb2JpbGUnOiB0cnVlLFxuXHRcdFx0J0Rldk9wcyc6IHRydWUsXG5cdFx0fSxcblx0XHQnQUkgJiBNTCc6IHtcblx0XHRcdCdNYWNoaW5lIExlYXJuaW5nJzogdHJ1ZSxcblx0XHRcdCdEZWVwIExlYXJuaW5nJzogdHJ1ZSxcblx0XHRcdCdOTFAnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0RhdGEnOiB7XG5cdFx0XHQnRGF0YWJhc2UnOiB0cnVlLFxuXHRcdFx0J0RhdGEgRW5naW5lZXJpbmcnOiB0cnVlLFxuXHRcdFx0J0FuYWx5dGljcyc6IHRydWUsXG5cdFx0fSxcblx0XHQnQXJjaGl0ZWN0dXJlJzoge1xuXHRcdFx0J1N5c3RlbSBEZXNpZ24nOiB0cnVlLFxuXHRcdFx0J01pY3Jvc2VydmljZXMnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J090aGVyJzogdHJ1ZSxcblx0fSxcblx0Y2F0ZWdvcmllczogW10sXG5cdHNjYW5TdWJmb2xkZXJzOiB0cnVlLFxuXHRcblx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogZmFsc2UsXG5cdGF1dG9Nb3ZlRmlsZTogdHJ1ZSxcblx0Y29uZmlkZW5jZVRocmVzaG9sZDogMC43LFxuXHRcblx0ZW5hYmxlRGVidWdMb2c6IGZhbHNlLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdGNhdGVnb3J5OiBzdHJpbmc7XG5cdGNvbmZpZGVuY2U6IG51bWJlcjtcblx0cmVhc29uaW5nOiBzdHJpbmc7XG5cdGlzVW5jZXJ0YWluOiBib29sZWFuO1xuXHRzdWdnZXN0ZWRDYXRlZ29yeT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBSVByb3ZpZGVyIHtcblx0bmFtZTogc3RyaW5nO1xuXHR0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+O1xuXHRjbGFzc2lmeShjb250ZW50OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGNhdGVnb3JpZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD47XG59XG4iLCIvLyDlm73pmYXljJbmlK/mjIEgLSDlvZPliY3ku4XmlK/mjIHkuK3mlodcbmV4cG9ydCBjb25zdCB0cmFuc2xhdGlvbnMgPSB7XG5cdHNldHRpbmdzOiB7XG5cdFx0dGl0bGU6ICdBSeaZuuiDveWIhuexu+iuvue9ricsXG5cdFx0YWlQcm92aWRlcjogJ0FJIOaPkOS+m+WVhicsXG5cdFx0YWlQcm92aWRlckRlc2M6ICfpgInmi6kgQUkg5pyN5Yqh55qE5o+Q5L6b5pa5Jyxcblx0XHRvbGxhbWFVcmw6ICdPbGxhbWEg5Zyw5Z2AJyxcblx0XHRvbGxhbWFVcmxEZXNjOiAn5pys5ZywIE9sbGFtYSDmnI3liqHnmoTlnLDlnYAnLFxuXHRcdG9sbGFtYU1vZGVsOiAnT2xsYW1hIOaooeWeiycsXG5cdFx0b2xsYW1hTW9kZWxEZXNjOiAn5L2/55So55qE5qih5Z6L5ZCN56ewJyxcblx0XHRvcGVuYWlBcGlLZXk6ICdPcGVuQUkgQVBJIEtleScsXG5cdFx0b3BlbmFpQXBpS2V5RGVzYzogJ+aCqOeahCBPcGVuQUkgQVBJIOWvhumSpScsXG5cdFx0b3BlbmFpTW9kZWw6ICdPcGVuQUkg5qih5Z6LJyxcblx0XHRvcGVuYWlNb2RlbERlc2M6ICfkvb/nlKjnmoQgT3BlbkFJIOaooeWeiycsXG5cdFx0aW5ib3hGb2xkZXI6ICfmlLbku7bnrrHmlofku7blpLknLFxuXHRcdGluYm94Rm9sZGVyRGVzYzogJ+W+heWIhuexu+aWh+S7tuaJgOWcqOeahOaWh+S7tuWkuScsXG5cdFx0Y2F0ZWdvcnlUcmVlOiAn5YiG57G757uT5p6EJyxcblx0XHRjYXRlZ29yeVRyZWVEZXNjOiAn5a6a5LmJ5oKo55qE5YiG57G75qCR57uT5p6E77yISlNPTuagvOW8j++8iScsXG5cdFx0Y2F0ZWdvcmllczogJ+WIhuexu+WIl+ihqCcsXG5cdFx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogJ+WQr+eUqCBBSSDmjqjojZDmlrDliIbnsbsnLFxuXHRcdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXNEZXNjOiAn5b2T5paH56ug5peg5rOV5Yy56YWN546w5pyJ5YiG57G75pe277yMQUkg5Y+v5Lul5bu66K6u5paw5YiG57G7Jyxcblx0XHRhdXRvTW92ZUZpbGU6ICfoh6rliqjnp7vliqjmlofku7YnLFxuXHRcdGF1dG9Nb3ZlRmlsZURlc2M6ICfliIbnsbvlrozmiJDlkI7oh6rliqjlsIbmlofku7bnp7vliqjliLDlr7nlupTmlofku7blpLknLFxuXHRcdGNvbmZpZGVuY2VUaHJlc2hvbGQ6ICfnva7kv6HluqbpmIjlgLwnLFxuXHRcdGNvbmZpZGVuY2VUaHJlc2hvbGREZXNjOiAn5L2O5LqO5q2k572u5L+h5bqm5bCG5o+Q56S655So5oi356Gu6K6kJyxcblx0XHRlbmFibGVEZWJ1Z0xvZzogJ+WQr+eUqOiwg+ivleaXpeW/lycsXG5cdFx0ZW5hYmxlRGVidWdMb2dEZXNjOiAn5Zyo5o6n5Yi25Y+w6L6T5Ye66K+m57uG5pel5b+XJyxcblx0XHR0ZXN0Q29ubmVjdGlvbjogJ+a1i+ivlei/nuaOpScsXG5cdFx0Y29ubmVjdGlvblN1Y2Nlc3M6ICfov57mjqXmiJDlip/vvIEnLFxuXHRcdGNvbm5lY3Rpb25GYWlsZWQ6ICfov57mjqXlpLHotKXvvJonLFxuXHRcdHNhdmU6ICfkv53lrZjorr7nva4nLFxuXHRcdGNhdGVnb3JpZXNQbGFjZWhvbGRlcjogJ+e8lueoiy/liY3nq68sIOe8lueoiy/lkI7nq68sIEFJL+acuuWZqOWtpuS5oCwgLi4uJyxcblx0XHRhZGRUb3BMZXZlbDogJ+a3u+WKoOS4gOe6p+WIhuexuycsXG5cdFx0ZW50ZXJDYXRlZ29yeU5hbWU6ICfor7fovpPlhaXliIbnsbvlkI3np7AnLFxuXHRcdGVudGVyTmV3TmFtZTogJ+ivt+i+k+WFpeaWsOWQjeensCcsXG5cdFx0Y2F0ZWdvcnlFeGlzdHM6ICfliIbnsbvlt7LlrZjlnKgnLFxuXHRcdGNvbmZpcm1EZWxldGU6ICfnoa7orqTliKDpmaTmraTliIbnsbvvvJ8nLFxuXHRcdGNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW46ICfmraTliIbnsbvljIXlkKvlrZDliIbnsbvvvIznoa7orqTliKDpmaTmiYDmnInlrZDliIbnsbvlkJfvvJ8nLFxuXHRcdHJlc3RvcmVEZWZhdWx0OiAn5oGi5aSN6buY6K6kJyxcblx0XHRjb25maXJtUmVzdG9yZURlZmF1bHQ6ICfnoa7orqTmgaLlpI3pu5jorqTliIbnsbvmoJHvvJ/lvZPliY3nmoToh6rlrprkuYnphY3nva7lsIbkuKLlpLHjgIInLFxuXHR9LFxuXHRjbGFzc2lmeToge1xuXHRcdGNvbW1hbmQ6ICdBSeaZuuiDveWIhuexuycsXG5cdFx0Y2xhc3NpZnlJbmJveDogJ+WIhuexu+aUtuS7tueusScsXG5cdFx0Y2xhc3NpZnlDdXJyZW50OiAn5YiG57G75b2T5YmN5paH5Lu2Jyxcblx0XHRwcm9jZXNzaW5nOiAn5q2j5Zyo5YiG5p6QOiAnLFxuXHRcdHN1Y2Nlc3M6ICfliIbnsbvlrozmiJAnLFxuXHRcdG1vdmVkOiAn5bey56e75Yqo5YiwOiAnLFxuXHRcdHVuY2VydGFpbjogJ+e9ruS/oeW6pui+g+S9jiAoJyxcblx0XHRjb25maXJtOiAn5piv5ZCm56Gu6K6k5YiG57G75YiwOiAnLFxuXHRcdGxvd0NvbmZpZGVuY2U6ICfnva7kv6Hluqbov4fkvY7vvIzor7fmiYvliqjnoa7orqQnLFxuXHRcdHN1Z2dlc3RlZENhdGVnb3J5OiAn5bu66K6u5paw5aKe5YiG57G7OiAnLFxuXHRcdGFkZENhdGVnb3J5OiAn5piv5ZCm5bCG5q2k5YiG57G75re75Yqg5Yiw6aKE6K6+PycsXG5cdFx0bm9JbmJveDogJ+acquaJvuWIsOaUtuS7tueuseaWh+S7tuWkuTogJyxcblx0XHRub0ZpbGVzOiAn5pS25Lu2566x5Lit5rKh5pyJ5paH5Lu2Jyxcblx0XHRza2lwOiAn6Lez6L+HJyxcblx0fSxcblx0ZXJyb3JzOiB7XG5cdFx0bm9Db250ZW50OiAn5peg5rOV5o+Q5Y+W5paH5Lu25YaF5a65Jyxcblx0XHRub1RpdGxlOiAn5peg5rOV6I635Y+W5paH5Lu25qCH6aKYJyxcblx0XHRhaUVycm9yOiAnQUkg5pyN5Yqh6ZSZ6K+vOiAnLFxuXHRcdG1vdmVFcnJvcjogJ+enu+WKqOaWh+S7tuWksei0pTogJyxcblx0fSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB0KGtleTogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qga2V5cyA9IGtleS5zcGxpdCgnLicpO1xuXHRsZXQgcmVzdWx0OiB1bmtub3duID0gdHJhbnNsYXRpb25zO1xuXHRmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuXHRcdHJlc3VsdCA9IChyZXN1bHQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pPy5ba107XG5cdH1cblx0cmV0dXJuIChyZXN1bHQgYXMgc3RyaW5nKSB8fCBrZXk7XG59XG4iLCJpbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcbmltcG9ydCB7IEFwcCwgTW9kYWwsIE5vdGljZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLy8g5aOw5piO5YWo5bGAIGFwcCDlj5jph49cbmRlY2xhcmUgY29uc3QgYXBwOiBBcHA7XG5cbi8qKlxuICog5YiG57G75qCR6IqC54K55pWw5o2u57uT5p6EXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2F0ZWdvcnlOb2RlIHtcblx0bmFtZTogc3RyaW5nO1xuXHRjaGlsZHJlbj86IENhdGVnb3J5Tm9kZVtdO1xufVxuXG4vKipcbiAqIOWIhuexu+agkeiKgueCueexu+Wei1xuICovXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5VHJlZU5vZGUge1xuXHRba2V5OiBzdHJpbmddOiBDYXRlZ29yeVRyZWVOb2RlIHwgYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDliIbnsbvmoJHlj6/op4bljJbnu4Tku7ZcbiAqL1xuZXhwb3J0IGNsYXNzIENhdGVnb3J5VHJlZVZpZXcge1xuXHRwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0cmVlOiBDYXRlZ29yeVRyZWVOb2RlO1xuXHRwcml2YXRlIG9uQ2hhbmdlOiAodHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSkgPT4gdm9pZDtcblx0cHJpdmF0ZSBleHBhbmRlZE5vZGVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0dHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSxcblx0XHRvbkNoYW5nZTogKHRyZWU6IENhdGVnb3J5VHJlZU5vZGUpID0+IHZvaWRcblx0KSB7XG5cdFx0dGhpcy5jb250YWluZXJFbCA9IGNvbnRhaW5lckVsO1xuXHRcdHRoaXMudHJlZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodHJlZSkpOyAvLyDmt7Hmi7fotJ1cblx0XHR0aGlzLm9uQ2hhbmdlID0gb25DaGFuZ2U7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmuLLmn5PmlbTkuKrmoJFcblx0ICovXG5cdHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHR0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKCdjYXRlZ29yeS10cmVlLWNvbnRhaW5lcicpO1xuXG5cdFx0Ly8g5riy5p+T5qCR5b2i57uT5p6EXG5cdFx0Y29uc3QgdHJlZUVsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUnKTtcblx0XHR0aGlzLnJlbmRlclRyZWVMZXZlbCh0cmVlRWwsIHRoaXMudHJlZSwgJycpO1xuXG5cdFx0Ly8g5re75Yqg5LiA57qn5YiG57G75oyJ6ZKuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtYWN0aW9ucycpO1xuXHRcdGNvbnN0IGFkZEJ0biA9IGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0XHR0ZXh0OiB0KCdzZXR0aW5ncy5hZGRUb3BMZXZlbCcpXG5cdFx0fSk7XG5cdFx0YWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5hZGRUb3BMZXZlbENhdGVnb3J5KCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5riy5p+T5qCR55qE5p+Q5LiA57qnXG5cdCAqL1xuXHRwcml2YXRlIHJlbmRlclRyZWVMZXZlbChcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG5vZGU6IENhdGVnb3J5VHJlZU5vZGUsXG5cdFx0cGF0aDogc3RyaW5nXG5cdCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGUpKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50UGF0aCA9IHBhdGggPyBgJHtwYXRofS8ke2tleX1gIDoga2V5O1xuXHRcdFx0Y29uc3QgaGFzQ2hpbGRyZW4gPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPiAwO1xuXHRcdFx0Y29uc3QgaXNFeHBhbmRlZCA9IHRoaXMuZXhwYW5kZWROb2Rlcy5oYXMoY3VycmVudFBhdGgpO1xuXG5cdFx0XHQvLyDliJvlu7roioLngrnlrrnlmahcblx0XHRcdGNvbnN0IG5vZGVFbCA9IGNvbnRhaW5lci5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUnKTtcblxuXHRcdFx0Ly8g6IqC54K56KGM77yI5ZCN56ewICsg5pON5L2c5oyJ6ZKu77yJXG5cdFx0XHRjb25zdCBub2RlUm93ID0gbm9kZUVsLmNyZWF0ZURpdignY2F0ZWdvcnktbm9kZS1yb3cnKTtcblxuXHRcdFx0Ly8g5bGV5byAL+aKmOWPoOaMiemSru+8iOS7heW9k+acieWtkOiKgueCueaXtuaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IGV4cGFuZEJ0biA9IG5vZGVSb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1leHBhbmQtYnRuJyxcblx0XHRcdFx0XHR0ZXh0OiBpc0V4cGFuZGVkID8gJ+KWvCcgOiAn4pa2J1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZXhwYW5kQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpc0V4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4cGFuZGVkTm9kZXMuZGVsZXRlKGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5leHBhbmRlZE5vZGVzLmFkZChjdXJyZW50UGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8g5Y2g5L2N56ym77yM5L+d5oyB5a+56b2QXG5cdFx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7IGNsczogJ2NhdGVnb3J5LWV4cGFuZC1wbGFjZWhvbGRlcicsIHRleHQ6ICfjgIAnIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyDlm77moIdcblx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWljb24nLFxuXHRcdFx0XHR0ZXh0OiBoYXNDaGlsZHJlbiA/ICfwn5OCJyA6ICfwn5OEJ1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWQjeensFxuXHRcdFx0bm9kZVJvdy5jcmVhdGVFbCgnc3BhbicsIHtcblx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktbmFtZScsXG5cdFx0XHRcdHRleHQ6IGtleVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOaTjeS9nOaMiemSruWuueWZqFxuXHRcdFx0Y29uc3QgYWN0aW9uc0VsID0gbm9kZVJvdy5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUtYWN0aW9ucycpO1xuXG5cdFx0XHQvLyDnvJbovpHmjInpkq5cblx0XHRcdGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1hY3Rpb24tYnRuJyxcblx0XHRcdFx0dGV4dDogJ+Kcj++4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXROb2RlKGN1cnJlbnRQYXRoLCBrZXkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWIoOmZpOaMiemSrlxuXHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWFjdGlvbi1idG4nLFxuXHRcdFx0XHR0ZXh0OiAn8J+Xke+4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRlbGV0ZU5vZGUoY3VycmVudFBhdGgsIGtleSwgaGFzQ2hpbGRyZW4pO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOa3u+WKoOWtkOWIhuexu+aMiemSru+8iOS7heWvueeItuiKgueCueaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktYWN0aW9uLWJ0bicsXG5cdFx0XHRcdFx0dGV4dDogJ+KelSdcblx0XHRcdFx0fSkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5hZGRDaGlsZENhdGVnb3J5KGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIOa4suafk+WtkOiKgueCuVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuICYmIGlzRXhwYW5kZWQpIHtcblx0XHRcdFx0Y29uc3QgY2hpbGRyZW5FbCA9IG5vZGVFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LWNoaWxkcmVuJyk7XG5cdFx0XHRcdHRoaXMucmVuZGVyVHJlZUxldmVsKGNoaWxkcmVuRWwsIHZhbHVlLCBjdXJyZW50UGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIOa3u+WKoOS4gOe6p+WIhuexu1xuXHQgKi9cblx0cHJpdmF0ZSBhZGRUb3BMZXZlbENhdGVnb3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuc2hvd1Byb21wdE1vZGFsKFxuXHRcdFx0dCgnc2V0dGluZ3MuZW50ZXJDYXRlZ29yeU5hbWUnKSxcblx0XHRcdCcnLFxuXHRcdFx0KG5hbWUpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMudHJlZVtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudHJlZVtuYW1lXSA9IHt9O1xuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5re75Yqg5a2Q5YiG57G7XG5cdCAqL1xuXHRwcml2YXRlIGFkZENoaWxkQ2F0ZWdvcnkocGFyZW50UGF0aDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zaG93UHJvbXB0TW9kYWwoXG5cdFx0XHR0KCdzZXR0aW5ncy5lbnRlckNhdGVnb3J5TmFtZScpLFxuXHRcdFx0JycsXG5cdFx0XHQobmFtZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLmdldE5vZGVCeVBhdGgocGFyZW50UGF0aCk7XG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGFyZW50W25hbWVdID0ge307XG5cdFx0XHRcdHRoaXMuZXhwYW5kZWROb2Rlcy5hZGQocGFyZW50UGF0aCk7XG5cdFx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDnvJbovpHoioLngrnlkI3np7Bcblx0ICovXG5cdHByaXZhdGUgZWRpdE5vZGUocGF0aDogc3RyaW5nLCBvbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNob3dQcm9tcHRNb2RhbChcblx0XHRcdHQoJ3NldHRpbmdzLmVudGVyTmV3TmFtZScpLFxuXHRcdFx0b2xkTmFtZSxcblx0XHRcdChuZXdOYW1lKSA9PiB7XG5cdFx0XHRcdGlmICghbmV3TmFtZSB8fCBuZXdOYW1lLnRyaW0oKSA9PT0gJycgfHwgbmV3TmFtZSA9PT0gb2xkTmFtZSkgcmV0dXJuO1xuXG5cdFx0XHRcdGNvbnN0IHBhdGhQYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRQYXRoID8gdGhpcy5nZXROb2RlQnlQYXRoKHBhcmVudFBhdGgpIDogdGhpcy50cmVlO1xuXG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuZXdOYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8g6YeN5ZG95ZCNXG5cdFx0XHRcdHBhcmVudFtuZXdOYW1lXSA9IHBhcmVudFtvbGROYW1lXTtcblx0XHRcdFx0ZGVsZXRlIHBhcmVudFtvbGROYW1lXTtcblxuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5Yig6Zmk6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGRlbGV0ZU5vZGUocGF0aDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGhhc0NoaWxkcmVuOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGhhc0NoaWxkcmVuXG5cdFx0XHQ/IHQoJ3NldHRpbmdzLmNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW4nKVxuXHRcdFx0OiB0KCdzZXR0aW5ncy5jb25maXJtRGVsZXRlJyk7XG5cblx0XHR0aGlzLnNob3dDb25maXJtTW9kYWwobWVzc2FnZSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gcGFyZW50UGF0aCA/IHRoaXMuZ2V0Tm9kZUJ5UGF0aChwYXJlbnRQYXRoKSA6IHRoaXMudHJlZTtcblxuXHRcdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdFx0ZGVsZXRlIHBhcmVudFtuYW1lXTtcblx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5qC55o2u6Lev5b6E6I635Y+W6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGdldE5vZGVCeVBhdGgocGF0aDogc3RyaW5nKTogQ2F0ZWdvcnlUcmVlTm9kZSB8IG51bGwge1xuXHRcdGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdGxldCBjdXJyZW50OiBDYXRlZ29yeVRyZWVOb2RlID0gdGhpcy50cmVlO1xuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG5cdFx0XHRjb25zdCBjaGlsZCA9IGN1cnJlbnRbcGFydF07XG5cdFx0XHRpZiAoIWNoaWxkIHx8IHR5cGVvZiBjaGlsZCAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50ID0gY2hpbGQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGN1cnJlbnQ7XG5cdH1cblxuXHQvKipcblx0ICog6YCa55+l5aSW6YOo5qCR5bey5pu05pawXG5cdCAqL1xuXHRwcml2YXRlIG5vdGlmeUNoYW5nZSgpOiB2b2lkIHtcblx0XHR0aGlzLm9uQ2hhbmdlKHRoaXMudHJlZSk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmm7TmlrDmoJHmlbDmja7vvIjlpJbpg6josIPnlKjvvIlcblx0ICovXG5cdHVwZGF0ZVRyZWUobmV3VHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSk6IHZvaWQge1xuXHRcdHRoaXMudHJlZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobmV3VHJlZSkpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHQvKipcblx0ICog5pi+56S66L6T5YWl5a+56K+d5qGGXG5cdCAqL1xuXHRwcml2YXRlIHNob3dQcm9tcHRNb2RhbChcblx0XHRwbGFjZWhvbGRlcjogc3RyaW5nLFxuXHRcdGRlZmF1bHRWYWx1ZTogc3RyaW5nLFxuXHRcdG9uU3VibWl0OiAodmFsdWU6IHN0cmluZykgPT4gdm9pZFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RhbCA9IG5ldyBJbnB1dE1vZGFsKFxuXHRcdFx0cGxhY2Vob2xkZXIsXG5cdFx0XHRkZWZhdWx0VmFsdWUsXG5cdFx0XHRvblN1Ym1pdFxuXHRcdCk7XG5cdFx0bW9kYWwub3BlbigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOaYvuekuuehruiupOWvueivneahhlxuXHQgKi9cblx0cHJpdmF0ZSBzaG93Q29uZmlybU1vZGFsKFxuXHRcdG1lc3NhZ2U6IHN0cmluZyxcblx0XHRvbkNvbmZpcm06ICgpID0+IHZvaWRcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kYWwgPSBuZXcgQ29uZmlybU1vZGFsKFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdG9uQ29uZmlybVxuXHRcdCk7XG5cdFx0bW9kYWwub3BlbigpO1xuXHR9XG59XG5cbi8qKlxuICog6L6T5YWl5a+56K+d5qGGXG4gKi9cbmNsYXNzIElucHV0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgcGxhY2Vob2xkZXI6IHN0cmluZztcblx0cHJpdmF0ZSBkZWZhdWx0VmFsdWU6IHN0cmluZztcblx0cHJpdmF0ZSBvblN1Ym1pdDogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cGxhY2Vob2xkZXI6IHN0cmluZyxcblx0XHRkZWZhdWx0VmFsdWU6IHN0cmluZyxcblx0XHRvblN1Ym1pdDogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWRcblx0KSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG5cdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWU7XG5cdFx0dGhpcy5vblN1Ym1pdCA9IG9uU3VibWl0O1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogdGhpcy5wbGFjZWhvbGRlciB9KTtcblxuXHRcdGNvbnN0IGlucHV0ID0gY29udGVudEVsLmNyZWF0ZUVsKCdpbnB1dCcsIHtcblx0XHRcdHR5cGU6ICd0ZXh0Jyxcblx0XHRcdHZhbHVlOiB0aGlzLmRlZmF1bHRWYWx1ZSxcblx0XHRcdGNsczogJ21vZGFsLWlucHV0J1xuXHRcdH0pO1xuXG5cdFx0Ly8g55uR5ZCs5Zue6L2m6ZSuXG5cdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcblx0XHRcdFx0dGhpcy5vblN1Ym1pdChpbnB1dC52YWx1ZSk7XG5cdFx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGJ1dHRvbnNFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ21vZGFsLWJ1dHRvbi1jb250YWluZXInKTtcblxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyB0ZXh0OiAnQ2FuY2VsJyB9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlKCkpO1xuXG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NvbmZpcm0nLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vblN1Ym1pdChpbnB1dC52YWx1ZSk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cblx0XHQvLyDoh6rliqjogZrnhKZcblx0XHRpbnB1dC5mb2N1cygpO1xuXHRcdGlucHV0LnNlbGVjdCgpO1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0fVxufVxuXG4vKipcbiAqIOehruiupOWvueivneahhlxuICovXG5jbGFzcyBDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgbWVzc2FnZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0b25Db25maXJtOiAoKSA9PiB2b2lkXG5cdCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLm9uQ29uZmlybSA9IG9uQ29uZmlybTtcblx0fVxuXG5cdG9uT3BlbigpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IHRoaXMubWVzc2FnZSB9KTtcblxuXHRcdGNvbnN0IGJ1dHRvbnNFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ21vZGFsLWJ1dHRvbi1jb250YWluZXInKTtcblxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyB0ZXh0OiAnQ2FuY2VsJyB9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlKCkpO1xuXG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NvbmZpcm0nLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oKTtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlLCBNb2RhbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB0eXBlIEFJQ2xhc3NpZmllclBsdWdpbiBmcm9tICcuLi9tYWluJztcbmltcG9ydCB7IEFJUHJvdmlkZXJUeXBlLCBERUZBVUxUX1NFVFRJTkdTLCBDYXRlZ29yeVRyZWUgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgQ2F0ZWdvcnlUcmVlVmlldywgQ2F0ZWdvcnlUcmVlTm9kZSB9IGZyb20gJy4vQ2F0ZWdvcnlUcmVlVmlldyc7XG5cbi8vIOWQhOacjeWKoeWVhuWPr+eUqOaooeWei+WIl+ihqFxuY29uc3QgQVZBSUxBQkxFX01PREVMUzogUmVjb3JkPHN0cmluZywgQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+PiA9IHtcblx0b3BlbmFpOiBbXG5cdFx0eyB2YWx1ZTogJ2dwdC00by1taW5pJywgbGFiZWw6ICdHUFQtNG8gTWluaSAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTRvJywgbGFiZWw6ICdHUFQtNG8nIH0sXG5cdFx0eyB2YWx1ZTogJ2dwdC00LXR1cmJvJywgbGFiZWw6ICdHUFQtNCBUdXJibycgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTMuNS10dXJibycsIGxhYmVsOiAnR1BULTMuNSBUdXJibycgfSxcblx0XSxcblx0ZGVlcHNlZWs6IFtcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY2hhdCcsIGxhYmVsOiAnRGVlcFNlZWsgQ2hhdCAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY29kZXInLCBsYWJlbDogJ0RlZXBTZWVrIENvZGVyJyB9LFxuXHRdLFxuXHRtb29uc2hvdDogW1xuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS04aycsIGxhYmVsOiAnTW9vbnNob3QgVjEgOEsgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ21vb25zaG90LXYxLTMyaycsIGxhYmVsOiAnTW9vbnNob3QgVjEgMzJLJyB9LFxuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS0xMjhrJywgbGFiZWw6ICdNb29uc2hvdCBWMSAxMjhLJyB9LFxuXHRdLFxuXHR6aGlwdTogW1xuXHRcdHsgdmFsdWU6ICdnbG0tNCcsIGxhYmVsOiAnR0xNLTQgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ2dsbS00LWZsYXNoJywgbGFiZWw6ICdHTE0tNCBGbGFzaCcgfSxcblx0XHR7IHZhbHVlOiAnZ2xtLTMtdHVyYm8nLCBsYWJlbDogJ0dMTS0zIFR1cmJvJyB9LFxuXHRdLFxufTtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luO1xuXHRcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cdFxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHRcblx0XHQvLyDpobbpg6jlr7zoiKrmoI9cblx0XHRjb25zdCBoZWFkZXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignc2V0dGluZ3MtaGVhZGVyJyk7XG5cdFx0XG5cdFx0Ly8g6L+U5Zue5oyJ6ZKuXG5cdFx0Y29uc3QgYmFja0J0biA9IGhlYWRlckVsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRjbHM6ICdzZXR0aW5ncy1iYWNrLWJ0biBjbGlja2FibGUtaWNvbicsXG5cdFx0XHRhdHRyOiB7XG5cdFx0XHRcdCdhcmlhLWxhYmVsJzogJ0JhY2sgdG8gcHJldmlvdXMgbGV2ZWwnLFxuXHRcdFx0XHQndGl0bGUnOiAnQmFjayB0byBwcmV2aW91cyBsZXZlbCdcblx0XHRcdH1cblx0XHR9KTtcblx0XHRcblx0XHQvLyDliJvlu7ogU1ZHIOWbvuagh1xuXHRcdGNvbnN0IHN2ZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAnc3ZnJyk7XG5cdFx0c3ZnLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCAnMjQnKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCAnMjQnKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgJzAgMCAyNCAyNCcpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ2ZpbGwnLCAnbm9uZScpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3N0cm9rZScsICdjdXJyZW50Q29sb3InKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCdzdHJva2Utd2lkdGgnLCAnMicpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3N0cm9rZS1saW5lY2FwJywgJ3JvdW5kJyk7XG5cdFx0c3ZnLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLWxpbmVqb2luJywgJ3JvdW5kJyk7XG5cdFx0XG5cdFx0Y29uc3QgcGF0aCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAncGF0aCcpO1xuXHRcdHBhdGguc2V0QXR0cmlidXRlKCdkJywgJ20xNSAxOC02LTYgNi02Jyk7XG5cdFx0c3ZnLmFwcGVuZENoaWxkKHBhdGgpO1xuXHRcdGJhY2tCdG4uYXBwZW5kQ2hpbGQoc3ZnKTtcblx0XHRcblx0XHRiYWNrQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0Ly8g55u05o6l6Kem5Y+RIE9ic2lkaWFuIOiHquW4pueahOi/lOWbnuWKn+iDvVxuXHRcdFx0Ly8g5p+l5om+6K6+572u5L6n6L655qCP5Lit55qE56ys5LiA5Liq5o+S5Lu26YCJ6aG55bm254K55Ye7XG5cdFx0XHRjb25zdCBjb21tdW5pdHlQbHVnaW5OYXZJdGVtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm5hdi1mb2xkZXIubW9kLXJvb3QgPiAubmF2LWZvbGRlci10aXRsZScpO1xuXHRcdFx0aWYgKGNvbW11bml0eVBsdWdpbk5hdkl0ZW0pIHtcblx0XHRcdFx0KGNvbW11bml0eVBsdWdpbk5hdkl0ZW0gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyDlpoLmnpzmib7kuI3liLDvvIzlsJ3or5Xngrnlh7vku7vkvZXkuIDkuKrkvqfovrnmoI/poblcblx0XHRcdFx0Y29uc3QgYW55TmF2SXRlbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy52ZXJ0aWNhbC10YWItbmF2LWl0ZW0nKTtcblx0XHRcdFx0aWYgKGFueU5hdkl0ZW0pIHtcblx0XHRcdFx0XHQoYW55TmF2SXRlbSBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIOagh+mimFxuXHRcdG5ldyBTZXR0aW5nKGhlYWRlckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MudGl0bGUnKSlcblx0XHRcdC5zZXRIZWFkaW5nKCk7XG5cdFx0XG5cdFx0dGhpcy5hZGRBSVByb3ZpZGVyU2VjdGlvbigpO1xuXHRcdHRoaXMuYWRkQ2F0ZWdvcnlTZWN0aW9uKCk7XG5cdFx0dGhpcy5hZGRBZHZhbmNlZFNlY3Rpb24oKTtcblx0XHR0aGlzLmFkZERlYnVnU2VjdGlvbigpO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZEFJUHJvdmlkZXJTZWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnQUkgY29uZmlndXJhdGlvbicpXG5cdFx0XHQuc2V0SGVhZGluZygpO1xuXHRcdFxuXHRcdC8vIEFJIOaPkOS+m+WVhumAieaLqVxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuYWlQcm92aWRlcicpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuYWlQcm92aWRlckRlc2MnKSlcblx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignb2xsYW1hJywgJ09sbGFtYSAobG9jYWwpJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdvcGVuYWknLCAnT3BlbkFJJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdkZWVwc2VlaycsICdEZWVwU2VlaycpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignbW9vbnNob3QnLCAnTW9vbnNob3QgKEtpbWkpJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCd6aGlwdScsICdaaGlwdSBBSScpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciA9IHZhbHVlIGFzIEFJUHJvdmlkZXJUeXBlO1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XG5cdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIgPT09ICdvbGxhbWEnKSB7XG5cdFx0XHQvLyBPbGxhbWEg6YWN572uXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3Mub2xsYW1hVXJsJykpXG5cdFx0XHRcdC5zZXREZXNjKHQoJ3NldHRpbmdzLm9sbGFtYVVybERlc2MnKSlcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hVXJsKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm9sbGFtYVVybCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5vbGxhbWFNb2RlbCcpKVxuXHRcdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5vbGxhbWFNb2RlbERlc2MnKSlcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBUEkgS2V5IOmFjee9rlxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIEtleWApXG5cdFx0XHRcdC5zZXREZXNjKGDor7fovpPlhaUgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOeahCBBUEkgS2V5YClcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5nZXRQcm92aWRlclZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdhcGlLZXknKSlcblx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ3NrLS4uLicpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlckNvbmZpZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnYXBpS2V5JywgdmFsdWUpO1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR0ZXh0LmlucHV0RWwudHlwZSA9ICdwYXNzd29yZCc7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyBNb2RlbCDphY3nva7vvIjkuIvmi4npgInmi6nvvIlcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZShgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOaooeWei2ApXG5cdFx0XHRcdC5zZXREZXNjKGDor7fpgInmi6kgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOeahOaooeWei2ApXG5cdFx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWxzID0gdGhpcy5nZXRBdmFpbGFibGVNb2RlbHModGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcik7XG5cdFx0XHRcdFx0bW9kZWxzLmZvckVhY2gobW9kZWwgPT4ge1xuXHRcdFx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKG1vZGVsLnZhbHVlLCBtb2RlbC5sYWJlbCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuZ2V0UHJvdmlkZXJWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnbW9kZWwnKSlcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb3ZpZGVyQ29uZmlnKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdtb2RlbCcsIHZhbHVlKTtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyBBUEkgVVJMIOmFjee9ru+8iOmrmOe6p+mAiemhue+8iVxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIOWcsOWdgGApXG5cdFx0XHRcdC5zZXREZXNjKCfoh6rlrprkuYkgQVBJIOerr+eCueWcsOWdgO+8iOWPr+mAie+8jOeVmeepuuS9v+eUqOWumOaWueWcsOWdgO+8iScpXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMuZ2V0UHJvdmlkZXJWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnYmFzZVVybCcpKVxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vdjEnKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvdmlkZXJDb25maWcodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2Jhc2VVcmwnLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5rWL6K+V6L+e5o6l5oyJ6ZKuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuYWRkQnV0dG9uKGJ1dHRvbiA9PiB7XG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KHQoJ3NldHRpbmdzLnRlc3RDb25uZWN0aW9uJykpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YnV0dG9uLnNldERpc2FibGVkKHRydWUpO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5nZXRBSVByb3ZpZGVyKCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnRlc3RDb25uZWN0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdGlmIChyZXN1bHQuc3VjY2Vzcykge1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvblN1Y2Nlc3MnKSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jb25uZWN0aW9uRmFpbGVkJykgKyByZXN1bHQubWVzc2FnZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jb25uZWN0aW9uRmFpbGVkJykgKyAoZSBhcyBFcnJvcikubWVzc2FnZSk7XG5cdFx0XHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0XHRidXR0b24uc2V0RGlzYWJsZWQoZmFsc2UpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblx0XG5cdHByaXZhdGUgYWRkQ2F0ZWdvcnlTZWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnQ2F0ZWdvcnkgY29uZmlndXJhdGlvbicpXG5cdFx0XHQuc2V0SGVhZGluZygpO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuaW5ib3hGb2xkZXInKSlcblx0XHRcdC5zZXREZXNjKHQoJ3NldHRpbmdzLmluYm94Rm9sZGVyRGVzYycpKVxuXHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluYm94Rm9sZGVyKVxuXHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5ib3hGb2xkZXIgPSB2YWx1ZTtcblx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ1NjYW4gc3ViZm9sZGVycycpXG5cdFx0XHQuc2V0RGVzYygnV2hldGhlciB0byByZWN1cnNpdmVseSBzY2FuIGZpbGVzIGluIGluYm94IHN1YmRpcmVjdG9yaWVzLiBEaXNhYmxlIHRvIG9ubHkgY2xhc3NpZnkgZmlsZXMgYXQgdGhlIHRvcCBsZXZlbCBvZiBpbmJveC4nKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNjYW5TdWJmb2xkZXJzKVxuXHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc2NhblN1YmZvbGRlcnMgPSB2YWx1ZTtcblx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdC8vIOWPr+inhuWMluWIhuexu+agkVxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuY2F0ZWdvcnlUcmVlJykpXG5cdFx0XHQuc2V0SGVhZGluZygpO1xuXHRcdFxuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtd3JhcHBlcicpO1xuXHRcdFxuXHRcdG5ldyBDYXRlZ29yeVRyZWVWaWV3KFxuXHRcdFx0dHJlZUNvbnRhaW5lcixcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSBhcyBDYXRlZ29yeVRyZWVOb2RlLFxuXHRcdFx0KG5ld1RyZWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY2F0ZWdvcnlUcmVlID0gbmV3VHJlZSBhcyBDYXRlZ29yeVRyZWU7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKG5ld1RyZWUpO1xuXHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8g5pON5L2c5oyJ6ZKuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KCdjYXRlZ29yeS10cmVlLWZvb3RlcicpO1xuXHRcdG5ldyBTZXR0aW5nKGFjdGlvbnNFbClcblx0XHRcdC5hZGRCdXR0b24oYnRuID0+IHtcblx0XHRcdFx0YnRuLnNldEJ1dHRvblRleHQodCgnc2V0dGluZ3MucmVzdG9yZURlZmF1bHQnKSlcblx0XHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnNob3dSZXN0b3JlQ29uZmlybSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblx0XG5cdHByaXZhdGUgc2hvd1Jlc3RvcmVDb25maXJtKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGFsID0gbmV3IFJlc3RvcmVDb25maXJtTW9kYWwoXG5cdFx0XHR0aGlzLmFwcCxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY2F0ZWdvcnlUcmVlID0gREVGQVVMVF9TRVRUSU5HUy5jYXRlZ29yeVRyZWU7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKERFRkFVTFRfU0VUVElOR1MuY2F0ZWdvcnlUcmVlKTtcblx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7IC8vIOWIt+aWsOiuvue9rumdouadv1xuXHRcdFx0fVxuXHRcdCk7XG5cdFx0bW9kYWwub3BlbigpO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZEFkdmFuY2VkU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ0FkdmFuY2VkJylcblx0XHRcdC5zZXRIZWFkaW5nKCk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzRGVzYycpKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXMpXG5cdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzID0gdmFsdWU7XG5cdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmF1dG9Nb3ZlRmlsZScpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuYXV0b01vdmVGaWxlRGVzYycpKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSlcblx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkRGVzYycpKVxuXHRcdFx0LmFkZFNsaWRlcihzbGlkZXIgPT4ge1xuXHRcdFx0c2xpZGVyLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGQgKiAxMDApXG5cdFx0XHRcdC5zZXRMaW1pdHMoMCwgMTAwLCAxKVxuXHRcdFx0XHQuc2V0RHluYW1pY1Rvb2x0aXAoKVxuXHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCA9IHZhbHVlIC8gMTAwO1xuXHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblx0XG5cdHByaXZhdGUgYWRkRGVidWdTZWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnRGVidWcnKVxuXHRcdFx0LnNldEhlYWRpbmcoKTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmVuYWJsZURlYnVnTG9nJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZ0Rlc2MnKSlcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHtcblx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZylcblx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZURlYnVnTG9nID0gdmFsdWU7XG5cdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBmbGF0dGVuQ2F0ZWdvcmllcyh0cmVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcHJlZml4ID0gJycpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRyZWUpKSB7XG5cdFx0XHRjb25zdCBwYXRoID0gcHJlZml4ID8gYCR7cHJlZml4fS8ke2tleX1gIDoga2V5O1xuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goLi4udGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcGF0aCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblx0XG5cdHByaXZhdGUgZ2V0QXZhaWxhYmxlTW9kZWxzKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSk6IEFycmF5PHsgdmFsdWU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9PiB7XG5cdFx0cmV0dXJuIEFWQUlMQUJMRV9NT0RFTFNbcHJvdmlkZXJdIHx8IFtdO1xuXHR9XG5cdFxuXHRwcml2YXRlIGdldFByb3ZpZGVyRGlzcGxheU5hbWUocHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOiByZXR1cm4gJ09wZW5BSSc7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6IHJldHVybiAnRGVlcFNlZWsnO1xuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOiByZXR1cm4gJ01vb25zaG90IChLaW1pKSc7XG5cdFx0XHRjYXNlICd6aGlwdSc6IHJldHVybiAnWmhpcHUgKOaZuuiwsSknO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICdPbGxhbWEnO1xuXHRcdH1cblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRQcm92aWRlclZhbHVlKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSwga2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5O1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnbW9kZWwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWw7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdiYXNlVXJsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla01vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdE1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRDdXJyZW50UHJvdmlkZXJDb25maWcoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyO1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ09wZW5BSScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnRGVlcFNlZWsnLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ01vb25zaG90IChLaW1pKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ3poaXB1Jzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnWmhpcHUgKOaZuuiwsSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBQcm92aWRlcjogJHtwcm92aWRlcn1gKTtcblx0XHR9XG5cdH1cblx0XG5cdHByaXZhdGUgdXBkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXI6IHN0cmluZywga2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtNb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdiYXNlVXJsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdtb2RlbCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90TW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnbW9kZWwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cblxuLyoqXG4gKiBSZXN0b3JlIGNvbmZpcm1hdGlvbiBtb2RhbFxuICovXG5jbGFzcyBSZXN0b3JlQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgb25Db25maXJtOiAoKSA9PiB2b2lkKSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLm9uQ29uZmlybSA9IG9uQ29uZmlybTtcblx0fVxuXG5cdG9uT3BlbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IHQoJ3NldHRpbmdzLmNvbmZpcm1SZXN0b3JlRGVmYXVsdCcpIH0pO1xuXG5cdFx0Y29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdignbW9kYWwtYnV0dG9uLWNvbnRhaW5lcicpO1xuXG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbkNvbnRhaW5lci5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ0NvbmZpcm0nLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0fSk7XG5cdFx0Y29uZmlybUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMub25Db25maXJtKCk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBjYW5jZWxCdG4gPSBidXR0b25Db250YWluZXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICdDYW5jZWwnLFxuXHRcdH0pO1xuXHRcdGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xvc2UoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIOS7jiBPYnNpZGlhbiDmlofku7bkuK3mj5Dlj5blhoXlrrlcbiAqL1xuZXhwb3J0IGNsYXNzIENvbnRlbnRFeHRyYWN0b3Ige1xuXHQvKipcblx0ICog5o+Q5Y+W5paH5Lu25YaF5a6577yI5pSv5oyBIE1hcmtkb3duIOWSjOe6r+aWh+acrO+8iVxuXHQgKi9cblx0YXN5bmMgZXh0cmFjdChmaWxlOiBURmlsZSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDlr7nkuo7lpJbpg6jpk77mjqXmlofku7bvvIzlj6/og73pnIDopoHnibnmrorlpITnkIZcblx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGZpbGUudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY2xlYW5Db250ZW50KGNvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcign5o+Q5Y+W5paH5Lu25YaF5a655aSx6LSlOicsIGUpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog6I635Y+W5paH5Lu25qCH6aKYXG5cdCAqL1xuXHRnZXRUaXRsZShmaWxlOiBURmlsZSk6IHN0cmluZyB7XG5cdFx0Ly8g5LyY5YWI5L2/55So5paH5Lu25ZCN77yI5LiN5ZCr5omp5bGV5ZCN77yJXG5cdFx0cmV0dXJuIGZpbGUuYmFzZW5hbWU7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDmuIXnkIblhoXlrrnvvIznp7vpmaTkuI3lv4XopoHnmoTpg6jliIZcblx0ICovXG5cdHByaXZhdGUgY2xlYW5Db250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGNvbnRlbnRcblx0XHRcdC8vIOenu+mZpCBZQU1MIGZyb250bWF0dGVyXG5cdFx0XHQucmVwbGFjZSgvXi0tLVtcXHNcXFNdKj8tLS1cXG4/LywgJycpXG5cdFx0XHQvLyDnp7vpmaQgSFRNTCDms6jph4pcblx0XHRcdC5yZXBsYWNlKC88IS0tW1xcc1xcU10qPy0tPi9nLCAnJylcblx0XHRcdC8vIOenu+mZpOS7o+eggeWdl++8iOS/neeVmeivreiogOagh+iusO+8iVxuXHRcdFx0LnJlcGxhY2UoL2BgYFtcXHNcXFNdKj9gYGAvZywgKG1hdGNoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxhbmdNYXRjaCA9IG1hdGNoLm1hdGNoKC9gYGAoXFx3KikvKTtcblx0XHRcdFx0Y29uc3QgbGFuZyA9IGxhbmdNYXRjaCA/IGxhbmdNYXRjaFsxXSA6ICcnO1xuXHRcdFx0XHRyZXR1cm4gYFvku6PnoIHlnZc6ICR7bGFuZ31dYDtcblx0XHRcdH0pXG5cdFx0XHQvLyDnp7vpmaTlm77niYflkozpk77mjqXvvIzkv53nlZkgYWx0IHRleHRcblx0XHRcdC5yZXBsYWNlKC8hXFxbKFteXFxdXSopXFxdXFwoW14pXSpcXCkvZywgJ1skMV0nKVxuXHRcdFx0LnJlcGxhY2UoL1xcWyhbXlxcXV0rKVxcXVxcKFteKV0qXFwpL2csICckMScpXG5cdFx0XHQvLyDnp7vpmaTlpJrkvZnnqbrooYxcblx0XHRcdC5yZXBsYWNlKC9cXG57Myx9L2csICdcXG5cXG4nKVxuXHRcdFx0LnRyaW0oKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOeUn+aIkOWGheWuueaRmOimge+8iOeUqOS6jiBBSSDliIbmnpDvvIlcblx0ICovXG5cdGdlbmVyYXRlU3VtbWFyeShjb250ZW50OiBzdHJpbmcsIG1heExlbmd0aCA9IDIwMDApOiBzdHJpbmcge1xuXHRcdGlmIChjb250ZW50Lmxlbmd0aCA8PSBtYXhMZW5ndGgpIHtcblx0XHRcdHJldHVybiBjb250ZW50O1xuXHRcdH1cblx0XHRcblx0XHQvLyDlsJ3or5XlnKjlj6XlrZDovrnnlYzlpITmiKrmlq1cblx0XHRjb25zdCB0cnVuY2F0ZWQgPSBjb250ZW50LnNsaWNlKDAsIG1heExlbmd0aCk7XG5cdFx0Y29uc3QgbGFzdFBlcmlvZCA9IHRydW5jYXRlZC5sYXN0SW5kZXhPZign44CCJyk7XG5cdFx0Y29uc3QgbGFzdE5ld2xpbmUgPSB0cnVuY2F0ZWQubGFzdEluZGV4T2YoJ1xcbicpO1xuXHRcdFxuXHRcdGNvbnN0IGJyZWFrUG9pbnQgPSBNYXRoLm1heChsYXN0UGVyaW9kLCBsYXN0TmV3bGluZSk7XG5cdFx0XG5cdFx0aWYgKGJyZWFrUG9pbnQgPiBtYXhMZW5ndGggKiAwLjcpIHtcblx0XHRcdHJldHVybiB0cnVuY2F0ZWQuc2xpY2UoMCwgYnJlYWtQb2ludCArIDEpO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gdHJ1bmNhdGVkICsgJy4uLic7XG5cdH1cbn1cbiIsImltcG9ydCB7IFRGaWxlLCBWYXVsdCB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiDmlofku7bmk43kvZzlt6XlhbdcbiAqL1xuZXhwb3J0IGNvbnN0IGZpbGVPcHMgPSB7XG5cdC8qKlxuXHQgKiDmnoTlu7rliIbnsbvot6/lvoRcblx0ICovXG5cdGJ1aWxkQ2F0ZWdvcnlQYXRoKGNhdGVnb3J5OiBzdHJpbmcsIGluYm94Rm9sZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdC8vIOWwhuWIhuexu+i3r+W+hOS4reeahCBcIi9cIiDovazmjaLkuLogVmF1bHQg5Lit55qE5paH5Lu25aS55YiG6ZqU56ymXG5cdFx0Y29uc3Qgbm9ybWFsaXplZENhdGVnb3J5ID0gY2F0ZWdvcnkucmVwbGFjZSgvXFwvL2csICcvJyk7XG5cdFx0cmV0dXJuIGAke2luYm94Rm9sZGVyfS8ke25vcm1hbGl6ZWRDYXRlZ29yeX1gO1xuXHR9LFxuXHRcblx0LyoqXG5cdCAqIOenu+WKqOaWh+S7tuWIsOebruagh+i3r+W+hFxuXHQgKi9cblx0YXN5bmMgbW92ZUZpbGUoZmlsZTogVEZpbGUsIG5ld0ZvbGRlclBhdGg6IHN0cmluZyk6IFByb21pc2U8VEZpbGU+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdmF1bHQgPSBmaWxlLnZhdWx0O1xuXHRcdFx0Y29uc3QgYWRhcHRlciA9IHZhdWx0LmFkYXB0ZXI7XG5cdFx0XHRcblx0XHRcdC8vIOehruS/neebruagh+aWh+S7tuWkueWtmOWcqO+8iOWkhOeQhuernuaAgeadoeS7tu+8iVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKCFhd2FpdCBhZGFwdGVyLmV4aXN0cyhuZXdGb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRcdGF3YWl0IHZhdWx0LmNyZWF0ZUZvbGRlcihuZXdGb2xkZXJQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZm9sZGVyRXJyb3I6IHVua25vd24pIHtcblx0XHRcdFx0Ly8g5aaC5p6c5paH5Lu25aS55bey5a2Y5Zyo77yM5b+955Wl6ZSZ6K+vXG5cdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gKGZvbGRlckVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZSB8fCAnJztcblx0XHRcdFx0aWYgKCFlcnJvck1zZy5pbmNsdWRlcygnYWxyZWFkeSBleGlzdHMnKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihg5Yib5bu65paH5Lu25aS55aSx6LSlOiAke2Vycm9yTXNnfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOaehOW7uuaWsOaWh+S7tui3r+W+hFxuXHRcdFx0Y29uc3QgbmV3UGF0aCA9IGAke25ld0ZvbGRlclBhdGh9LyR7ZmlsZS5uYW1lfWA7XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOebruagh+i3r+W+hOebuOWQjO+8jOS4jeenu+WKqFxuXHRcdFx0aWYgKGZpbGUucGF0aCA9PT0gbmV3UGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gZmlsZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5qOA5p+l55uu5qCH5paH5Lu25piv5ZCm5bey5a2Y5ZyoXG5cdFx0XHRpZiAoYXdhaXQgYWRhcHRlci5leGlzdHMobmV3UGF0aCkpIHtcblx0XHRcdFx0Ly8g5paH5Lu25bey5a2Y5Zyo77yM5re75Yqg5pe26Ze05oiz5ZCO57yAXG5cdFx0XHRcdGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG5cdFx0XHRcdGNvbnN0IGV4dCA9IGZpbGUuZXh0ZW5zaW9uO1xuXHRcdFx0XHRjb25zdCBiYXNlTmFtZSA9IGZpbGUuYmFzZW5hbWU7XG5cdFx0XHRcdGNvbnN0IHVuaXF1ZU5ld1BhdGggPSBgJHtuZXdGb2xkZXJQYXRofS8ke2Jhc2VOYW1lfV8ke3RpbWVzdGFtcH0uJHtleHR9YDtcblx0XHRcdFx0XG5cdFx0XHRcdGF3YWl0IHZhdWx0LnJlbmFtZShmaWxlLCB1bmlxdWVOZXdQYXRoKTtcblx0XHRcdFx0Y29uc3QgbmV3RmlsZSA9IHZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh1bmlxdWVOZXdQYXRoKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmICghKG5ld0ZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ+enu+WKqOWQjuaXoOazleaJvuWIsOaWh+S7ticpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRyZXR1cm4gbmV3RmlsZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5omn6KGM56e75YqoXG5cdFx0XHRhd2FpdCB2YXVsdC5yZW5hbWUoZmlsZSwgbmV3UGF0aCk7XG5cdFx0XHRcblx0XHRcdC8vIOi/lOWbnuaWsOeahOaWh+S7tuW8leeUqFxuXHRcdFx0Y29uc3QgbmV3RmlsZSA9IHZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChuZXdQYXRoKTtcblx0XHRcdFxuXHRcdFx0aWYgKCEobmV3RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ+enu+WKqOWQjuaXoOazleaJvuWIsOaWh+S7ticpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gbmV3RmlsZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IGUgYXMgRXJyb3I7XG5cdFx0XHRjb25zb2xlLmVycm9yKCfnp7vliqjmlofku7blpLHotKU6JywgZXJyb3IpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGDnp7vliqjmlofku7blpLHotKU6ICR7ZXJyb3IubWVzc2FnZX1gKTtcblx0XHR9XG5cdH0sXG5cdFxuXHQvKipcblx0ICog6I635Y+W5paH5Lu25ZCN77yI5LiN5ZCr5omp5bGV5ZCN77yJXG5cdCAqL1xuXHRnZXRCYXNlbmFtZShmaWxlOiBURmlsZSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGZpbGUuYmFzZW5hbWU7XG5cdH0sXG5cdFxuXHQvKipcblx0ICog5qOA5p+l5paH5Lu25piv5ZCm5a2Y5Zyo5LqO5oyH5a6a6Lev5b6EXG5cdCAqL1xuXHRhc3luYyBleGlzdHModmF1bHQ6IFZhdWx0LCBwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gYXdhaXQgdmF1bHQuYWRhcHRlci5leGlzdHMocGF0aCk7XG5cdH0sXG5cdFxuXHQvKipcblx0ICog56Gu5L+d5paH5Lu25aS55a2Y5Zyo77yM5LiN5a2Y5Zyo5YiZ5Yib5bu6XG5cdCAqL1xuXHRhc3luYyBlbnN1cmVGb2xkZXIodmF1bHQ6IFZhdWx0LCBmb2xkZXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0cnkge1xuXHRcdFx0aWYgKCFhd2FpdCB2YXVsdC5hZGFwdGVyLmV4aXN0cyhmb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRhd2FpdCB2YXVsdC5jcmVhdGVGb2xkZXIoZm9sZGVyUGF0aCk7XG5cdFx0XHRcdHJldHVybiB0cnVlOyAvLyDov5Tlm54gdHJ1ZSDooajnpLrmlrDliJvlu7rkuobmlofku7blpLlcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTsgLy8g6L+U5ZueIGZhbHNlIOihqOekuuaWh+S7tuWkueW3suWtmOWcqFxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ+WIm+W7uuaWh+S7tuWkueWksei0pTonLCBlKTtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9LFxufTtcbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgQUlQcm92aWRlciwgQ2xhc3NpZmljYXRpb25SZXN1bHQsIFBsdWdpblNldHRpbmdzIH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IENvbnRlbnRFeHRyYWN0b3IgfSBmcm9tICcuL0NvbnRlbnRFeHRyYWN0b3InO1xuaW1wb3J0IHsgZmlsZU9wcyB9IGZyb20gJy4uL3V0aWxzL2ZpbGVPcHMnO1xuXG5leHBvcnQgY2xhc3MgQ2xhc3NpZmllciB7XG5cdHByaXZhdGUgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuXHRwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuXHRwcml2YXRlIGNvbnRlbnRFeHRyYWN0b3I6IENvbnRlbnRFeHRyYWN0b3I7XG5cdFxuXHRjb25zdHJ1Y3RvcihzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MsIGxvZ2dlcjogTG9nZ2VyKSB7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuXHRcdHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuXHRcdHRoaXMuY29udGVudEV4dHJhY3RvciA9IG5ldyBDb250ZW50RXh0cmFjdG9yKCk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDliIbnsbvljZXkuKrmlofku7Zcblx0ICovXG5cdGFzeW5jIGNsYXNzaWZ5RmlsZShcblx0XHRmaWxlOiBURmlsZSxcblx0XHRhaVByb3ZpZGVyOiBBSVByb3ZpZGVyLFxuXHRcdG9uUHJvZ3Jlc3M/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkXG5cdCk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyByZXN1bHQ/OiBDbGFzc2lmaWNhdGlvblJlc3VsdDsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRvblByb2dyZXNzPy4oYOato+WcqOWIhuaekDogJHtmaWxlLmJhc2VuYW1lfWApO1xuXHRcdFx0XG5cdFx0XHQvLyDmj5Dlj5blhoXlrrlcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmNvbnRlbnRFeHRyYWN0b3IuZXh0cmFjdChmaWxlKTtcblx0XHRcdGlmICghY29udGVudCkge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfml6Dms5Xmj5Dlj5bmlofku7blhoXlrrknIH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGNvbnN0IHRpdGxlID0gdGhpcy5jb250ZW50RXh0cmFjdG9yLmdldFRpdGxlKGZpbGUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5YiG57G75paH5Lu2OiAke2ZpbGUucGF0aH1gKTtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDmoIfpopg6ICR7dGl0bGV9YCk7XG5cdFx0XHRcblx0XHRcdC8vIOiwg+eUqCBBSSDliIbnsbtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFpUHJvdmlkZXIuY2xhc3NpZnkoXG5cdFx0XHRcdGNvbnRlbnQsXG5cdFx0XHRcdHRpdGxlLFxuXHRcdFx0XHR0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXNcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDliIbnsbvnu5Pmnpw6ICR7SlNPTi5zdHJpbmdpZnkocmVzdWx0KX1gKTtcblx0XHRcdFxuXHRcdFx0Ly8g5qOA5p+l572u5L+h5bqmXG5cdFx0XHRpZiAocmVzdWx0LmNvbmZpZGVuY2UgPCB0aGlzLnNldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGQpIHtcblx0XHRcdFx0cmVzdWx0LmlzVW5jZXJ0YWluID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOe9ruS/oeW6puS9juS6jumYiOWAvDogJHtyZXN1bHQuY29uZmlkZW5jZX1gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgcmVzdWx0IH07XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3IgPSAoZSBhcyBFcnJvcikubWVzc2FnZTtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDliIbnsbvlpLHotKU6ICR7ZXJyb3J9YCk7XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3IgfTtcblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDliIbnsbvmlLbku7bnrrHkuK3nmoTmiYDmnInmlofku7Zcblx0ICovXG5cdGFzeW5jIGNsYXNzaWZ5SW5ib3goXG5cdFx0ZmlsZXM6IFRGaWxlW10sXG5cdFx0YWlQcm92aWRlcjogQUlQcm92aWRlcixcblx0XHRvblByb2dyZXNzPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZFxuXHQpOiBQcm9taXNlPEFycmF5PHsgZmlsZTogVEZpbGU7IHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQ7IHN1Y2Nlc3M6IGJvb2xlYW4gfT4+IHtcblx0XHRjb25zdCByZXN1bHRzOiBBcnJheTx7IGZpbGU6IFRGaWxlOyByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0OyBzdWNjZXNzOiBib29sZWFuIH0+ID0gW107XG5cdFx0XG5cdFx0Zm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsYXNzaWZ5RmlsZShmaWxlLCBhaVByb3ZpZGVyLCBvblByb2dyZXNzKTtcblx0XHRcdFxuXHRcdFx0aWYgKHJlc3VsdC5zdWNjZXNzICYmIHJlc3VsdC5yZXN1bHQpIHtcblx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRcdHJlc3VsdDogcmVzdWx0LnJlc3VsdCxcblx0XHRcdFx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaCh7XG5cdFx0XHRcdFx0ZmlsZSxcblx0XHRcdFx0XHRyZXN1bHQ6IHtcblx0XHRcdFx0XHRcdGNhdGVnb3J5OiAnT3RoZXInLFxuXHRcdFx0XHRcdFx0Y29uZmlkZW5jZTogMCxcblx0XHRcdFx0XHRcdHJlYXNvbmluZzogcmVzdWx0LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyxcblx0XHRcdFx0XHRcdGlzVW5jZXJ0YWluOiB0cnVlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c3VjY2VzczogZmFsc2UsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gcmVzdWx0cztcblx0fVxuXHRcblx0LyoqXG5cdCAqIOenu+WKqOaWh+S7tuWIsOWIhuexu+ebruW9lVxuXHQgKi9cblx0YXN5bmMgbW92ZUZpbGUoZmlsZTogVEZpbGUsIGNhdGVnb3J5OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbmV3UGF0aCA9IGZpbGVPcHMuYnVpbGRDYXRlZ29yeVBhdGgoY2F0ZWdvcnksIHRoaXMuc2V0dGluZ3MuaW5ib3hGb2xkZXIpO1xuXHRcdFx0YXdhaXQgZmlsZU9wcy5tb3ZlRmlsZShmaWxlLCBuZXdQYXRoKTtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDmlofku7blt7Lnp7vliqg6ICR7ZmlsZS5wYXRofSAtPiAke25ld1BhdGh9YCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihg56e75Yqo5paH5Lu25aSx6LSlOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0dGhyb3cgZTsgLy8g6YeN5paw5oqb5Ye66ZSZ6K+v77yM6K6p6LCD55So5pa55aSE55CGXG5cdFx0fVxuXHR9XG59XG4iLCIvKipcbiAqIOmUmeivr+WkhOeQhuW3peWFt1xuICog5o+Q5L6b57uf5LiA55qE6ZSZ6K+v57G75Z6L5ZKM5aSE55CG5pa55rOVXG4gKi9cbmltcG9ydCB7IHJlcXVlc3RVcmwsIFJlcXVlc3RVcmxQYXJhbSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiDoh6rlrprkuYnplJnor6/nsbvlnotcbiAqL1xuZXhwb3J0IGNsYXNzIEFJQ2xhc3NpZmllckVycm9yIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0cHVibGljIHR5cGU6ICduZXR3b3JrJyB8ICd0aW1lb3V0JyB8ICdhdXRoJyB8ICdyYXRlX2xpbWl0JyB8ICd2YWxpZGF0aW9uJyB8ICdwYXJzZScgfCAndW5rbm93bicsXG5cdFx0cHVibGljIG9yaWdpbmFsRXJyb3I/OiBFcnJvclxuXHQpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLm5hbWUgPSAnQUlDbGFzc2lmaWVyRXJyb3InO1xuXHR9XG59XG5cbi8qKlxuICog6YeN6K+V6YWN572uXG4gKi9cbmludGVyZmFjZSBSZXRyeUNvbmZpZyB7XG5cdG1heEF0dGVtcHRzOiBudW1iZXI7XG5cdGluaXRpYWxEZWxheTogbnVtYmVyO1xuXHRtYXhEZWxheTogbnVtYmVyO1xuXHRiYWNrb2ZmRmFjdG9yOiBudW1iZXI7XG59XG5cbmNvbnN0IERFRkFVTFRfUkVUUllfQ09ORklHOiBSZXRyeUNvbmZpZyA9IHtcblx0bWF4QXR0ZW1wdHM6IDMsXG5cdGluaXRpYWxEZWxheTogMTAwMCwgLy8gMSDnp5Jcblx0bWF4RGVsYXk6IDEwMDAwLCAvLyAxMCDnp5Jcblx0YmFja29mZkZhY3RvcjogMiwgLy8g5oyH5pWw6YCA6YG/XG59O1xuXG4vKipcbiAqIOW4pumHjeivleeahOW8guatpeaTjeS9nFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aFJldHJ5PFQ+KFxuXHRvcGVyYXRpb246ICgpID0+IFByb21pc2U8VD4sXG5cdGNvbmZpZzogUGFydGlhbDxSZXRyeUNvbmZpZz4gPSB7fSxcblx0b3BlcmF0aW9uTmFtZSA9ICdvcGVyYXRpb24nXG4pOiBQcm9taXNlPFQ+IHtcblx0Y29uc3QgZmluYWxDb25maWcgPSB7IC4uLkRFRkFVTFRfUkVUUllfQ09ORklHLCAuLi5jb25maWcgfTtcblx0bGV0IGxhc3RFcnJvcjogRXJyb3IgfCB1bmRlZmluZWQ7XG5cdFxuXHRmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSBmaW5hbENvbmZpZy5tYXhBdHRlbXB0czsgYXR0ZW1wdCsrKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCBvcGVyYXRpb24oKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bGFzdEVycm9yID0gZXJyb3IgYXMgRXJyb3I7XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOaYr+iupOivgemUmeivr++8jOS4jemHjeivlVxuXHRcdFx0aWYgKGlzQXV0aEVycm9yKGVycm9yKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHRcdFx0J0FQSSBLZXkg5peg5pWI5oiW5pyq5o6I5p2DJyxcblx0XHRcdFx0XHQnYXV0aCcsXG5cdFx0XHRcdFx0bGFzdEVycm9yXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOaYr+mZkOa1gemUmeivr++8jOetieW+heabtOmVv+aXtumXtFxuXHRcdFx0aWYgKGlzUmF0ZUxpbWl0RXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdGNvbnN0IHdhaXRUaW1lID0gZ2V0UmF0ZUxpbWl0V2FpdFRpbWUoZXJyb3IpIHx8IGZpbmFsQ29uZmlnLm1heERlbGF5O1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske29wZXJhdGlvbk5hbWV9XSDpgYfliLDpmZDmtYHvvIznrYnlvoUgJHt3YWl0VGltZX1tcyDlkI7ph43or5UuLi5gKTtcblx0XHRcdFx0YXdhaXQgc2xlZXAod2FpdFRpbWUpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c5piv572R57uc6ZSZ6K+v5LiU5LiN5piv5pyA5ZCO5LiA5qyh5bCd6K+V77yM562J5b6F5ZCO6YeN6K+VXG5cdFx0XHRpZiAoYXR0ZW1wdCA8IGZpbmFsQ29uZmlnLm1heEF0dGVtcHRzICYmIGlzUmV0cnlhYmxlRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdGNvbnN0IGRlbGF5ID0gY2FsY3VsYXRlRGVsYXkoYXR0ZW1wdCwgZmluYWxDb25maWcpO1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske29wZXJhdGlvbk5hbWV9XSDlsJ3or5UgJHthdHRlbXB0fS8ke2ZpbmFsQ29uZmlnLm1heEF0dGVtcHRzfSDlpLHotKXvvIwke2RlbGF5fW1zIOWQjumHjeivlS4uLmApO1xuXHRcdFx0XHRhd2FpdCBzbGVlcChkZWxheSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDmnIDlkI7kuIDmrKHlsJ3or5XlpLHotKXvvIzmipvlh7rplJnor69cblx0XHRcdHRocm93IGNsYXNzaWZ5RXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXHRcblx0dGhyb3cgY2xhc3NpZnlFcnJvcihsYXN0RXJyb3IhKTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrlj6/ph43or5XplJnor69cbiAqL1xuZnVuY3Rpb24gaXNSZXRyeWFibGVFcnJvcihlcnJvcjogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRjb25zdCBtZXNzYWdlID0gKGVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0Y29uc3Qgc3RhdHVzID0gKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pPy5zdGF0dXMgfHwgXG5cdFx0KGVycm9yIGFzIHsgcmVzcG9uc2U/OiB7IHN0YXR1cz86IG51bWJlciB9IH0pPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRcblx0Ly8g572R57uc6ZSZ6K+vXG5cdGlmIChtZXNzYWdlLmluY2x1ZGVzKCduZXR3b3JrJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnZmV0Y2gnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdlbm90Zm91bmQnKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxuXHQvLyDmnI3liqHlmajplJnor68gKDV4eClcblx0aWYgKHN0YXR1cyAhPT0gdW5kZWZpbmVkICYmIHN0YXR1cyA+PSA1MDAgJiYgc3RhdHVzIDwgNjAwKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdC8vIOi2heaXtumUmeivr1xuXHRpZiAobWVzc2FnZS5pbmNsdWRlcygndGltZW91dCcpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ2V0aW1lZG91dCcpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrorqTor4HplJnor69cbiAqL1xuZnVuY3Rpb24gaXNBdXRoRXJyb3IoZXJyb3I6IHVua25vd24pOiBib29sZWFuIHtcblx0Y29uc3Qgc3RhdHVzID0gKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pPy5zdGF0dXMgfHwgKGVycm9yIGFzIHsgcmVzcG9uc2U/OiB7IHN0YXR1cz86IG51bWJlciB9IH0pPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRjb25zdCBtZXNzYWdlID0gKGVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0XG5cdHJldHVybiBzdGF0dXMgPT09IDQwMSB8fCBzdGF0dXMgPT09IDQwMyB8fCBcblx0XHRtZXNzYWdlLmluY2x1ZGVzKCd1bmF1dGhvcml6ZWQnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdpbnZhbGlkIGFwaSBrZXknKTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrpmZDmtYHplJnor69cbiAqL1xuZnVuY3Rpb24gaXNSYXRlTGltaXRFcnJvcihlcnJvcjogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRjb25zdCBzdGF0dXMgPSAoZXJyb3IgYXMgeyBzdGF0dXM/OiBudW1iZXIgfSk/LnN0YXR1cyB8fCAoZXJyb3IgYXMgeyByZXNwb25zZT86IHsgc3RhdHVzPzogbnVtYmVyIH0gfSk/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdGNvbnN0IG1lc3NhZ2UgPSAoZXJyb3IgYXMgeyBtZXNzYWdlPzogc3RyaW5nIH0pPy5tZXNzYWdlPy50b0xvd2VyQ2FzZSgpIHx8ICcnO1xuXHRcblx0cmV0dXJuIHN0YXR1cyA9PT0gNDI5IHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ3JhdGUgbGltaXQnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCd0b28gbWFueSByZXF1ZXN0cycpO1xufVxuXG4vKipcbiAqIOS7jumUmeivr+S4reiOt+WPlumZkOa1geetieW+heaXtumXtFxuICovXG5mdW5jdGlvbiBnZXRSYXRlTGltaXRXYWl0VGltZShlcnJvcjogdW5rbm93bik6IG51bWJlciB8IG51bGwge1xuXHQvLyDlsJ3or5Xku47lk43lupTlpLTojrflj5Zcblx0Y29uc3QgcmV0cnlBZnRlciA9IChlcnJvciBhcyB7IHJlc3BvbnNlPzogeyBoZWFkZXJzPzogeyBnZXQ6IChrZXk6IHN0cmluZykgPT4gc3RyaW5nIHwgbnVsbCB9IH0gfSk/LnJlc3BvbnNlPy5oZWFkZXJzPy5nZXQoJ3JldHJ5LWFmdGVyJyk7XG5cdGlmIChyZXRyeUFmdGVyKSB7XG5cdFx0Y29uc3Qgc2Vjb25kcyA9IHBhcnNlSW50KHJldHJ5QWZ0ZXIsIDEwKTtcblx0XHRpZiAoIWlzTmFOKHNlY29uZHMpKSB7XG5cdFx0XHRyZXR1cm4gc2Vjb25kcyAqIDEwMDA7XG5cdFx0fVxuXHR9XG5cdFxuXHQvLyDpu5jorqTnrYnlvoUgNjAg56eSXG5cdHJldHVybiA2MDAwMDtcbn1cblxuLyoqXG4gKiDorqHnrpfph43or5Xlu7bov5/ml7bpl7TvvIjmjIfmlbDpgIDpgb/vvIlcbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlRGVsYXkoYXR0ZW1wdDogbnVtYmVyLCBjb25maWc6IFJldHJ5Q29uZmlnKTogbnVtYmVyIHtcblx0Y29uc3QgZGVsYXkgPSBjb25maWcuaW5pdGlhbERlbGF5ICogTWF0aC5wb3coY29uZmlnLmJhY2tvZmZGYWN0b3IsIGF0dGVtcHQgLSAxKTtcblx0cmV0dXJuIE1hdGgubWluKGRlbGF5LCBjb25maWcubWF4RGVsYXkpO1xufVxuXG4vKipcbiAqIOS8keecoOaMh+WumuaXtumXtFxuICovXG5mdW5jdGlvbiBzbGVlcChtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cblxuLyoqXG4gKiDliIbnsbvplJnor6/nsbvlnotcbiAqL1xuZnVuY3Rpb24gY2xhc3NpZnlFcnJvcihlcnJvcjogdW5rbm93bik6IEFJQ2xhc3NpZmllckVycm9yIHtcblx0aWYgKGVycm9yIGluc3RhbmNlb2YgQUlDbGFzc2lmaWVyRXJyb3IpIHtcblx0XHRyZXR1cm4gZXJyb3I7XG5cdH1cblx0XG5cdGNvbnN0IGVycm9yT2JqID0gZXJyb3IgYXMgeyBtZXNzYWdlPzogc3RyaW5nOyBzdGF0dXM/OiBudW1iZXI7IHJlc3BvbnNlPzogeyBzdGF0dXM/OiBudW1iZXIgfSB9O1xuXHRjb25zdCBtZXNzYWdlID0gZXJyb3JPYmo/Lm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKTtcblx0Y29uc3QgbG93ZXJNZXNzYWdlID0gbWVzc2FnZS50b0xvd2VyQ2FzZSgpO1xuXHRjb25zdCBzdGF0dXMgPSBlcnJvck9iaj8uc3RhdHVzIHx8IGVycm9yT2JqPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRcblx0Ly8g572R57uc6ZSZ6K+vXG5cdGlmIChsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ25ldHdvcmsnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2ZldGNoJykgfHwgXG5cdFx0bG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdlbm90Zm91bmQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2Vjb25ucmVmdXNlZCcpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCfnvZHnu5zov57mjqXlpLHotKXvvIzor7fmo4Dmn6XnvZHnu5zorr7nva4nLFxuXHRcdFx0J25ldHdvcmsnLFxuXHRcdFx0ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogdW5kZWZpbmVkXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g6LaF5pe26ZSZ6K+vXG5cdGlmIChsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3RpbWVvdXQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2V0aW1lZG91dCcpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCfor7fmsYLotoXml7bvvIzor7fnqI3lkI7ph43or5UnLFxuXHRcdFx0J3RpbWVvdXQnLFxuXHRcdFx0ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogdW5kZWZpbmVkXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g6K6k6K+B6ZSZ6K+vXG5cdGlmIChzdGF0dXMgPT09IDQwMSB8fCBzdGF0dXMgPT09IDQwMyB8fCBcblx0XHRsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3VuYXV0aG9yaXplZCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnaW52YWxpZCBhcGkga2V5JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J0FQSSBLZXkg5peg5pWI5oiW5pyq5o6I5p2DJyxcblx0XHRcdCdhdXRoJyxcblx0XHRcdGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IHVuZGVmaW5lZFxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOmZkOa1gemUmeivr1xuXHRpZiAoc3RhdHVzID09PSA0MjkgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdyYXRlIGxpbWl0JykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd0b28gbWFueSByZXF1ZXN0cycpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCdBUEkg6K+35rGC6L+H5LqO6aKR57mB77yM6K+356iN5ZCO6YeN6K+VJyxcblx0XHRcdCdyYXRlX2xpbWl0Jyxcblx0XHRcdGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IHVuZGVmaW5lZFxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIEpTT04g6Kej5p6Q6ZSZ6K+vXG5cdGlmIChsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2pzb24nKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3BhcnNlJykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdzeW50YXgnKSkge1xuXHRcdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHQn5ZON5bqU5pWw5o2u5qC85byP6ZSZ6K+vJyxcblx0XHRcdCdwYXJzZScsXG5cdFx0XHRlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiB1bmRlZmluZWRcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyDmnKrnn6XplJnor69cblx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRtZXNzYWdlLFxuXHRcdCd1bmtub3duJyxcblx0XHRlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiB1bmRlZmluZWRcblx0KTtcbn1cblxuLyoqXG4gKiDnlKjmiLflj4vlpb3nmoTplJnor6/mtojmga9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZXJyb3I6IEVycm9yKTogc3RyaW5nIHtcblx0aWYgKGVycm9yIGluc3RhbmNlb2YgQUlDbGFzc2lmaWVyRXJyb3IpIHtcblx0XHRzd2l0Y2ggKGVycm9yLnR5cGUpIHtcblx0XHRcdGNhc2UgJ25ldHdvcmsnOlxuXHRcdFx0XHRyZXR1cm4gJ/CfjJAg572R57uc6L+e5o6l5aSx6LSl77yM6K+35qOA5p+l77yaXFxu4oCiIOe9kee7nOaYr+WQpuato+W4uFxcbuKAoiBBUEkg5Zyw5Z2A5piv5ZCm5q2j56GuXFxu4oCiIOaYr+WQpumcgOimgeS7o+eQhic7XG5cdFx0XHRjYXNlICd0aW1lb3V0Jzpcblx0XHRcdFx0cmV0dXJuICfij7HvuI8g6K+35rGC6LaF5pe277yM5bu66K6u77yaXFxu4oCiIOajgOafpee9kee7nOmAn+W6plxcbuKAoiDnqI3lkI7ph43or5UnO1xuXHRcdFx0Y2FzZSAnYXV0aCc6XG5cdFx0XHRcdHJldHVybiAn8J+UkSBBUEkgS2V5IOaXoOaViO+8jOivt+ajgOafpe+8mlxcbuKAoiBBUEkgS2V5IOaYr+WQpuato+ehrlxcbuKAoiDmmK/lkKbmnInkvZnpop0v6aKd5bqmJztcblx0XHRcdGNhc2UgJ3JhdGVfbGltaXQnOlxuXHRcdFx0XHRyZXR1cm4gJ/CfmqYg6K+35rGC6L+H5LqO6aKR57mB77yM6K+356iN5ZCO6YeN6K+VJztcblx0XHRcdGNhc2UgJ3BhcnNlJzpcblx0XHRcdFx0cmV0dXJuICfwn5OdIEFJIOWTjeW6lOagvOW8j+W8guW4uO+8jOivt+mHjeivleaIluiBlOezu+W8gOWPkeiAhSc7XG5cdFx0XHRjYXNlICd2YWxpZGF0aW9uJzpcblx0XHRcdFx0cmV0dXJuIGDimqDvuI8g6YWN572u6ZSZ6K+v77yaJHtlcnJvci5tZXNzYWdlfWA7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gYOKdjCAke2Vycm9yLm1lc3NhZ2V9YDtcblx0XHR9XG5cdH1cblx0XG5cdHJldHVybiBg4p2MIOacquefpemUmeivr++8miR7ZXJyb3IubWVzc2FnZX1gO1xufVxuXG4vKipcbiAqIOmqjOivgSBVUkwg5qC85byPXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVVybCh1cmw6IHN0cmluZywgZmllbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0aWYgKCF1cmwgfHwgdXJsLnRyaW0oKSA9PT0gJycpIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7ZmllbGROYW1lfSDkuI3og73kuLrnqbpgLCAndmFsaWRhdGlvbicpO1xuXHR9XG5cdFxuXHR0cnkge1xuXHRcdG5ldyBVUkwodXJsKTtcblx0fSBjYXRjaCB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKGAke2ZpZWxkTmFtZX0g5qC85byP5LiN5q2j56GuOiAke3VybH1gLCAndmFsaWRhdGlvbicpO1xuXHR9XG59XG5cbi8qKlxuICog6aqM6K+BIEFQSSBLZXkg5qC85byPXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUFwaUtleShhcGlLZXk6IHN0cmluZywgcHJvdmlkZXJOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0aWYgKCFhcGlLZXkgfHwgYXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7cHJvdmlkZXJOYW1lfSBBUEkgS2V5IOS4jeiDveS4uuepumAsICd2YWxpZGF0aW9uJyk7XG5cdH1cblx0XG5cdC8vIOWfuuacrOagvOW8j+ajgOafpVxuXHRpZiAoYXBpS2V5Lmxlbmd0aCA8IDEwKSB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKGAke3Byb3ZpZGVyTmFtZX0gQVBJIEtleSDmoLzlvI/kuI3mraPnoa5gLCAndmFsaWRhdGlvbicpO1xuXHR9XG59XG5cbi8qKlxuICog5bim6LaF5pe255qEIGZldGNo77yI5L2/55SoIE9ic2lkaWFuIOeahCByZXF1ZXN0VXJs77yJXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFdpdGhUaW1lb3V0KFxuXHR1cmw6IHN0cmluZyxcblx0b3B0aW9uczogUmVxdWVzdEluaXQgPSB7fSxcblx0X3RpbWVvdXQgPSAzMDAwMFxuKTogUHJvbWlzZTxSZXNwb25zZT4ge1xuXHR0cnkge1xuXHRcdGNvbnN0IHJlcXVlc3RQYXJhbXM6IFJlcXVlc3RVcmxQYXJhbSA9IHtcblx0XHRcdHVybCxcblx0XHRcdG1ldGhvZDogb3B0aW9ucy5tZXRob2QgYXMgJ0dFVCcgfCAnUE9TVCcgfCAnUFVUJyB8ICdERUxFVEUnIHwgJ1BBVENIJyB8fCAnR0VUJyxcblx0XHRcdGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHx8IHt9LFxuXHRcdFx0Ym9keTogb3B0aW9ucy5ib2R5IGFzIHN0cmluZyB8fCB1bmRlZmluZWQsXG5cdFx0fTtcblx0XHRcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuXHRcdFx0Li4ucmVxdWVzdFBhcmFtcyxcblx0XHRcdHRocm93OiBmYWxzZSwgLy8g5LiN6Ieq5Yqo5oqb5Ye6IEhUVFAg6ZSZ6K+vXG5cdFx0fSk7XG5cdFx0XG5cdFx0cmV0dXJuIHtcblx0XHRcdG9rOiByZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCxcblx0XHRcdHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuXHRcdFx0c3RhdHVzVGV4dDogcmVzcG9uc2UudGV4dCB8fCAnJyxcblx0XHRcdGhlYWRlcnM6IG5ldyBIZWFkZXJzKHJlc3BvbnNlLmhlYWRlcnMpLFxuXHRcdFx0anNvbjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHJlc3BvbnNlLmpzb24pLFxuXHRcdFx0dGV4dDogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHJlc3BvbnNlLnRleHQpLFxuXHRcdFx0YmxvYjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFtyZXNwb25zZS5hcnJheUJ1ZmZlcl0pKSxcblx0XHRcdGFycmF5QnVmZmVyOiAoKSA9PiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UuYXJyYXlCdWZmZXIpLFxuXHRcdFx0Zm9ybURhdGE6ICgpID0+IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignZm9ybURhdGEgbm90IHN1cHBvcnRlZCcpKSxcblx0XHRcdGNsb25lOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMgYXMgUmVzcG9uc2U7IH0sXG5cdFx0XHRib2R5OiBudWxsLFxuXHRcdFx0Ym9keVVzZWQ6IGZhbHNlLFxuXHRcdFx0cmVkaXJlY3RlZDogZmFsc2UsXG5cdFx0XHR0eXBlOiAnYmFzaWMnIGFzIFJlc3BvbnNlVHlwZSxcblx0XHRcdHVybDogdXJsLFxuXHRcdH0gYXMgUmVzcG9uc2U7XG5cdH0gY2F0Y2ggKGVycm9yOiB1bmtub3duKSB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+ivt+axgui2heaXtuaIlue9kee7nOmUmeivrycsXG5cdFx0XHQndGltZW91dCcsXG5cdFx0XHRlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiB1bmRlZmluZWRcblx0XHQpO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBBcHAsIE5vdGljZSwgVEZpbGUsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgQUlDbGFzc2lmaWVyUGx1Z2luIGZyb20gJy4uL21haW4nO1xuaW1wb3J0IHsgQ2xhc3NpZmljYXRpb25SZXN1bHQgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi4vc2V0dGluZ3MvaTE4bic7XG5pbXBvcnQgeyBDbGFzc2lmaWVyIH0gZnJvbSAnLi4vc2VydmljZXMvQ2xhc3NpZmllcic7XG5pbXBvcnQgeyBmaWxlT3BzIH0gZnJvbSAnLi4vdXRpbHMvZmlsZU9wcyc7XG5pbXBvcnQgeyBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JIYW5kbGVyJztcblxuZXhwb3J0IGNsYXNzIENsYXNzaWZ5Q29tbWFuZCB7XG5cdHByaXZhdGUgcGx1Z2luOiBBSUNsYXNzaWZpZXJQbHVnaW47XG5cdHByaXZhdGUgY2xhc3NpZmllcjogQ2xhc3NpZmllcjtcblx0XG5cdGNvbnN0cnVjdG9yKHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luKSB7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdFx0dGhpcy5jbGFzc2lmaWVyID0gbmV3IENsYXNzaWZpZXIocGx1Z2luLnNldHRpbmdzLCBwbHVnaW4ubG9nZ2VyKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+aUtuS7tueuseS4reeahOaJgOacieaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlJbmJveCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbmJveEZvbGRlciA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmluYm94Rm9sZGVyO1xuXHRcdFxuXHRcdC8vIOehruS/nSBJbmJveCDnm67lvZXlrZjlnKhcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGF3YWl0IGZpbGVPcHMuZW5zdXJlRm9sZGVyKHRoaXMucGx1Z2luLmFwcC52YXVsdCwgaW5ib3hGb2xkZXIpO1xuXHRcdFx0aWYgKGNyZWF0ZWQpIHtcblx0XHRcdFx0bmV3IE5vdGljZShg5bey5Yib5bu65pS25Lu2566x5paH5Lu25aS5OiAke2luYm94Rm9sZGVyfWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG5ldyBOb3RpY2UoYOWIm+W7uuaUtuS7tueuseaWh+S7tuWkueWksei0pTogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5p+l5om+5pS25Lu2566x5paH5Lu25aS5XG5cdFx0Y29uc3QgaW5ib3hGaWxlcyA9IHRoaXMuZmluZEluYm94RmlsZXMoaW5ib3hGb2xkZXIpO1xuXHRcdFxuXHRcdGlmIChpbmJveEZpbGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bmV3IE5vdGljZSh0KCdjbGFzc2lmeS5ub0ZpbGVzJykpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRuZXcgTm90aWNlKGDmib7liLAgJHtpbmJveEZpbGVzLmxlbmd0aH0g5Liq5b6F5YiG57G75paH5Lu2YCk7XG5cdFx0XG5cdFx0Ly8g6I635Y+WIEFJIFByb3ZpZGVy77yI5bim6ZSZ6K+v5aSE55CG77yJXG5cdFx0bGV0IGFpUHJvdmlkZXI7XG5cdFx0dHJ5IHtcblx0XHRcdGFpUHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5nZXRBSVByb3ZpZGVyKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0bmV3IE5vdGljZShlcnJvck1zZywgODAwMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmNsYXNzaWZpZXIuY2xhc3NpZnlJbmJveChcblx0XHRcdGluYm94RmlsZXMsXG5cdFx0XHRhaVByb3ZpZGVyLFxuXHRcdFx0KG1lc3NhZ2UpID0+IG5ldyBOb3RpY2UobWVzc2FnZSwgMjAwMClcblx0XHQpO1xuXHRcdFxuXHRcdC8vIOWkhOeQhue7k+aenFxuXHRcdGxldCBtb3ZlZENvdW50ID0gMDtcblx0XHRsZXQgdW5jZXJ0YWluQ291bnQgPSAwO1xuXHRcdFxuXHRcdGZvciAoY29uc3QgeyBmaWxlLCByZXN1bHQsIHN1Y2Nlc3MgfSBvZiByZXN1bHRzKSB7XG5cdFx0XHRpZiAoIXN1Y2Nlc3MpIHtcblx0XHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKG5ldyBFcnJvcihyZXN1bHQucmVhc29uaW5nKSk7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7ZmlsZS5uYW1lfTogJHtlcnJvck1zZ31gLCA1MDAwKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmIChyZXN1bHQuaXNVbmNlcnRhaW4pIHtcblx0XHRcdFx0dW5jZXJ0YWluQ291bnQrKztcblx0XHRcdFx0Ly8g5a+55LqO5L2O572u5L+h5bqm57uT5p6c77yM562J5b6F55So5oi356Gu6K6kXG5cdFx0XHRcdGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IHRoaXMuY29uZmlybUNsYXNzaWZpY2F0aW9uKGZpbGUsIHJlc3VsdCk7XG5cdFx0XHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IG1vdmVkID0gYXdhaXQgdGhpcy5jbGFzc2lmaWVyLm1vdmVGaWxlKGZpbGUsIHJlc3VsdC5jYXRlZ29yeSk7XG5cdFx0XHRcdFx0aWYgKG1vdmVkKSB7XG5cdFx0XHRcdFx0XHRtb3ZlZENvdW50Kys7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKGAke2ZpbGUubmFtZX0g4oaSICR7cmVzdWx0LmNhdGVnb3J5fWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdFx0XHRuZXcgTm90aWNlKGDnp7vliqggJHtmaWxlLm5hbWV9IOWksei0pTogJHtlcnJvck1zZ31gLCA1MDAwKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3IE5vdGljZShgJHtmaWxlLm5hbWV9OiAke3Jlc3VsdC5jYXRlZ29yeX0gKCR7KHJlc3VsdC5jb25maWRlbmNlICogMTAwKS50b0ZpeGVkKDApfSUpYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdG5ldyBOb3RpY2UoXG5cdFx0XHRg5YiG57G75a6M5oiQ77yBYCArXG5cdFx0XHQobW92ZWRDb3VudCA+IDAgPyBg5bey56e75YqoICR7bW92ZWRDb3VudH0g5Liq5paH5Lu2YCA6ICcnKSArXG5cdFx0XHQodW5jZXJ0YWluQ291bnQgPiAwID8gYO+8jCR7dW5jZXJ0YWluQ291bnR9IOS4quaWh+S7tumcgOimgeehruiupGAgOiAnJylcblx0XHQpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75b2T5YmN5omT5byA55qE5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUN1cnJlbnRGaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRcblx0XHRpZiAoIWFjdGl2ZUZpbGUpIHtcblx0XHRcdG5ldyBOb3RpY2UoJ+ayoeacieaJk+W8gOeahOaWh+S7ticpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHQvLyDojrflj5YgQUkgUHJvdmlkZXLvvIjluKbplJnor6/lpITnkIbvvIlcblx0XHRsZXQgYWlQcm92aWRlcjtcblx0XHR0cnkge1xuXHRcdFx0YWlQcm92aWRlciA9IHRoaXMucGx1Z2luLmdldEFJUHJvdmlkZXIoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRuZXcgTm90aWNlKGVycm9yTXNnLCA4MDAwKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbGFzc2lmaWVyLmNsYXNzaWZ5RmlsZShhY3RpdmVGaWxlLCBhaVByb3ZpZGVyKTtcblx0XHRcblx0XHRpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UobmV3IEVycm9yKHJlc3VsdC5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpKTtcblx0XHRcdG5ldyBOb3RpY2UoZXJyb3JNc2csIDUwMDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRjb25zdCB7IHJlc3VsdDogY2xhc3NpZmljYXRpb24gfSA9IHJlc3VsdDtcblx0XHRcblx0XHRuZXcgTm90aWNlKFxuXHRcdFx0YOWIhuexuzogJHtjbGFzc2lmaWNhdGlvbj8uY2F0ZWdvcnl9IGAgK1xuXHRcdFx0YCgkeygoY2xhc3NpZmljYXRpb24/LmNvbmZpZGVuY2UgfHwgMCkgKiAxMDApLnRvRml4ZWQoMCl9JSlgXG5cdFx0KTtcblx0XHRcblx0XHQvLyDmo4Dmn6XmmK/lkKbpnIDopoHnp7vliqhcblx0XHRpZiAoY2xhc3NpZmljYXRpb24/LmlzVW5jZXJ0YWluKSB7XG5cdFx0XHRjb25zdCBjb25maXJtZWQgPSBhd2FpdCB0aGlzLmNvbmZpcm1DbGFzc2lmaWNhdGlvbihhY3RpdmVGaWxlLCBjbGFzc2lmaWNhdGlvbik7XG5cdFx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUgJiYgY2xhc3NpZmljYXRpb24pIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuY2xhc3NpZmllci5tb3ZlRmlsZShhY3RpdmVGaWxlLCBjbGFzc2lmaWNhdGlvbi5jYXRlZ29yeSk7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7dCgnY2xhc3NpZnkubW92ZWQnKX0ke2NsYXNzaWZpY2F0aW9uLmNhdGVnb3J5fWApO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYOenu+WKqOaWh+S7tuWksei0pTogJHtlcnJvck1zZ31gLCA1MDAwKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDnoa7orqTliIbnsbvvvIjnlKjkuo7kvY7nva7kv6Hluqbmg4XlhrXvvIlcblx0ICovXG5cdHByaXZhdGUgY29uZmlybUNsYXNzaWZpY2F0aW9uKGZpbGU6IFRGaWxlLCByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gYCR7ZmlsZS5uYW1lfVxcbiR7dCgnY2xhc3NpZnkuY29uZmlybScpfSR7cmVzdWx0LmNhdGVnb3J5fVxcbiR7dCgnY2xhc3NpZnkudW5jZXJ0YWluJyl9JHsoKHJlc3VsdC5jb25maWRlbmNlIHx8IDApICogMTAwKS50b0ZpeGVkKDApfSUpYDtcblx0XHRcdFxuXHRcdFx0aWYgKHJlc3VsdC5zdWdnZXN0ZWRDYXRlZ29yeSAmJiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7dCgnY2xhc3NpZnkuc3VnZ2VzdGVkQ2F0ZWdvcnknKX0ke3Jlc3VsdC5zdWdnZXN0ZWRDYXRlZ29yeX1gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5L2/55SoIE9ic2lkaWFuIOeahOehruiupOWvueivneahhlxuXHRcdFx0Y29uc3QgbW9kYWwgPSBuZXcgQ29uZmlybU1vZGFsKFxuXHRcdFx0XHR0aGlzLnBsdWdpbi5hcHAsXG5cdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdChjb25maXJtZWQpID0+IHtcblx0XHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRtb2RhbC5vcGVuKCk7XG5cdFx0fSk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDmn6Xmib7mlLbku7bnrrHkuK3nmoTmiYDmnInnrJTorrDmlofku7Zcblx0ICovXG5cdHByaXZhdGUgZmluZEluYm94RmlsZXMoaW5ib3hGb2xkZXI6IHN0cmluZyk6IFRGaWxlW10ge1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5wbHVnaW4uYXBwLnZhdWx0LmdldEZpbGVzKCk7XG5cdFx0Y29uc3Qgc2NhblN1YmZvbGRlcnMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycztcblx0XHRcblx0XHRyZXR1cm4gZmlsZXMuZmlsdGVyKGZpbGUgPT4ge1xuXHRcdFx0Ly8g5qOA5p+l5paH5Lu25piv5ZCm5Zyo5pS25Lu2566x5paH5Lu25aS55LitXG5cdFx0XHRjb25zdCBub3JtYWxpemVkUGF0aCA9IGZpbGUucGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cdFx0XHRjb25zdCBub3JtYWxpemVkSW5ib3ggPSBpbmJveEZvbGRlci5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cdFx0XHRcblx0XHRcdC8vIOajgOafpeaYr+WQpuWcqOaUtuS7tueuseS4rVxuXHRcdFx0aWYgKCFub3JtYWxpemVkUGF0aC5zdGFydHNXaXRoKG5vcm1hbGl6ZWRJbmJveCArICcvJykgJiYgXG5cdFx0XHRcdCEobm9ybWFsaXplZFBhdGguc3RhcnRzV2l0aChub3JtYWxpemVkSW5ib3gpICYmIG5vcm1hbGl6ZWRQYXRoICE9PSBub3JtYWxpemVkSW5ib3gpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c5LiN5omr5o+P5a2Q5paH5Lu25aS577yM5qOA5p+l5piv5ZCm5Zyo6aG25bGCXG5cdFx0XHRpZiAoIXNjYW5TdWJmb2xkZXJzKSB7XG5cdFx0XHRcdGNvbnN0IHJlbGF0aXZlUGF0aCA9IG5vcm1hbGl6ZWRQYXRoLnN1YnN0cmluZyhub3JtYWxpemVkSW5ib3gubGVuZ3RoKTtcblx0XHRcdFx0Ly8g56e76Zmk5byA5aS055qE5pac5p2gXG5cdFx0XHRcdGNvbnN0IGNsZWFuUmVsYXRpdmVQYXRoID0gcmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJy8nKSA/IHJlbGF0aXZlUGF0aC5zdWJzdHJpbmcoMSkgOiByZWxhdGl2ZVBhdGg7XG5cdFx0XHRcdC8vIOWmguaenOebuOWvuei3r+W+hOS4reWMheWQq+aWnOadoO+8jOivtOaYjuWcqOWtkOebruW9leS4rVxuXHRcdFx0XHRpZiAoY2xlYW5SZWxhdGl2ZVBhdGguaW5jbHVkZXMoJy8nKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblx0fVxufVxuXG4vKipcbiAqIOeugOWNleeahOehruiupOWvueivneahhlxuICovXG5jbGFzcyBDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgbWVzc2FnZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uQ29uZmlybTogKGNvbmZpcm1lZDogYm9vbGVhbikgPT4gdm9pZDtcblx0XG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBtZXNzYWdlOiBzdHJpbmcsIG9uQ29uZmlybTogKGNvbmZpcm1lZDogYm9vbGVhbikgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLm9uQ29uZmlybSA9IG9uQ29uZmlybTtcblx0fVxuXHRcblx0b25PcGVuKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdFxuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogdGhpcy5tZXNzYWdlIH0pO1xuXHRcdFxuXHRcdGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ2J1dHRvbi1jb250YWluZXInKTtcblx0XHRcblx0XHRjb25zdCBjb25maXJtQnRuID0gYnV0dG9uQ29udGFpbmVyLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHR0ZXh0OiAnQ29uZmlybScsXG5cdFx0XHRjbHM6ICdtb2QtY3RhJyxcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0odHJ1ZSk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cdFx0XG5cdFx0Y29uc3QgY2FuY2VsQnRuID0gYnV0dG9uQ29udGFpbmVyLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHR0ZXh0OiAnQ2FuY2VsJyxcblx0XHR9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR0aGlzLm9uQ29uZmlybShmYWxzZSk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cdH1cblx0XG5cdG9uQ2xvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jb250ZW50RWwuZW1wdHkoKTtcblx0fVxufVxuIiwiLyoqXG4gKiBBSSDmj5DnpLror43pm4bkuK3nrqHnkIZcbiAqL1xuXG5leHBvcnQgY29uc3QgU1lTVEVNX1BST01QVCA9IGDkvaDmmK/kuJPkuJrnmoTmioDmnK/mlofnq6DliIbnsbvliqnmiYvjgIJcblxuIyMg5L2g55qE6IGM6LSjXG4xLiDliIbmnpDnlKjmiLfmj5DkvpvnmoTmlofnq6DlhoXlrrlcbjIuIOS7jumihOWumuS5ieWIhuexu+WIl+ihqOS4remAieaLqeacgOWMuemFjeeahOS4gOS4qlxuMy4g6L+U5Zue57uT5p6E5YyW55qE5YiG57G757uT5p6cXG5cbiMjIOWIhuexu+WOn+WImVxuMS4gKirnsr7noa7ljLnphY0qKu+8muS8mOWFiOmAieaLqeS4juaWh+eroOS4u+mimOWujOWFqOWMuemFjeeahOWIhuexu1xuMi4gKiror63kuYnnkIbop6MqKu+8mueQhuino+aWh+eroOeahOaKgOacr+mihuWfn+WSjOS4u+mimFxuMy4gKirlsYLnuqfpgInmi6kqKu+8mumAieaLqeacgOWFt+S9k+eahOWtkOWIhuexu++8jOiAjOmdnueItuWIhuexu1xuNC4gKirlkIjnkIbmjqjmlq0qKu+8muWfuuS6juagh+mimOWSjOWGheWuueaRmOimgei/m+ihjOaOqOaWrVxuXG4jIyDliIbnsbvkvJjlhYjnuqdcbjEuIOe8lueoiy/liY3nq68gKEZyb250ZW5kKe+8mlJlYWN0LCBWdWUsIENTUywgSFRNTCwgV2ViIOW8gOWPkeetiVxuMi4g57yW56iLL+WQjuerryAoQmFja2VuZCnvvJpOb2RlLmpzLCBQeXRob24sIEphdmEsIEFQSSwgU2VydmVyIOetiVxuMy4g57yW56iLL+enu+WKqOerryAoTW9iaWxlKe+8mmlPUywgQW5kcm9pZCwgRmx1dHRlciwgUmVhY3QgTmF0aXZlIOetiVxuNC4g57yW56iLL0Rldk9wc++8mkRvY2tlciwgS3ViZXJuZXRlcywgQ0kvQ0QsIENsb3VkIOetiVxuNS4gQUkv5py65Zmo5a2m5Lmg77yaTUwsIOacuuWZqOWtpuS5oOeul+azlSwg5pWw5o2u56eR5a2m562JXG42LiBBSS/mt7HluqblrabkuaDvvJpEZWVwIExlYXJuaW5nLCBOZXVyYWwgTmV0d29yaywgVGVuc29yRmxvdywgUHlUb3JjaCDnrYlcbjcuIEFJL05MUO+8muiHqueEtuivreiogOWkhOeQhiwgTExNLCBDaGF0R1BUIOetiVxuOC4g5pWw5o2uL+aVsOaNruW6k++8mkRhdGFiYXNlLCBTUUwsIFBvc3RncmVTUUwsIE1vbmdvREIg562JXG45LiDmlbDmja4v5pWw5o2u5bel56iL77yaRVRMLCBQaXBlbGluZSwgRGF0YSBXYXJlaG91c2Ug562JXG4xMC4g5p625p6EL+ezu+e7n+iuvuiuoe+8mlN5c3RlbSBEZXNpZ24sIEFyY2hpdGVjdHVyZSwgU2NhbGFiaWxpdHkg562JXG4xMS4gT3RoZXLvvJrml6Dms5XlvZLlhaXkuIrov7DliIbnsbvnmoTlhoXlrrlcblxuIyMg6L6T5Ye65qC85byPXG7or7fku6UgSlNPTiDmoLzlvI/ov5Tlm57nu5PmnpzvvJpcbntcbiAgXCJjYXRlZ29yeVwiOiBcIuWIhuexu+i3r+W+hO+8jOWmgiAn57yW56iLL+WJjeerrydcIixcbiAgXCJjb25maWRlbmNlXCI6IDAuMC0xLjAg55qE572u5L+h5bqm5YiG5pWwLFxuICBcInJlYXNvbmluZ1wiOiBcIueugOefreeahOeQhueUseivtOaYjlwiLFxuICBcImlzVW5jZXJ0YWluXCI6IGZhbHNlLFxuICBcInN1Z2dlc3RlZENhdGVnb3J5XCI6IFwi5aaC5p6c56Gu5a6e5rKh5pyJ5ZCI6YCC5YiG57G777yM5bu66K6u55qE5paw5YiG57G75ZCN77yI5Y+v6YCJ77yJXCJcbn1cblxuIyMg5rOo5oSP5LqL6aG5XG4tIOWmguaenOaWh+eroOaYjuaYvuWxnuS6juafkOS4qumihuWfn++8jOmAieaLqeivpemihuWfn+eahOacgOWFt+S9k+WIhuexu1xuLSDlpoLmnpznva7kv6HluqbkvY7kuo4gMC4177yM6K6+572uIGlzVW5jZXJ0YWluOiB0cnVlXG4tIOWni+e7iOi/lOWbnuS4gOS4quWQiOeQhueahOWIhuexu++8jOS4jeimgei/lOWbnuepuuWAvGA7XG5cbmV4cG9ydCBjb25zdCBVU0VSX1BST01QVF9URU1QTEFURSA9IGDor7fliIbmnpDku6XkuIvmlofnq6DlubbliIbnsbvvvJpcblxuIyMg5paH56ug5qCH6aKYXG57e1RJVExFfX1cblxuIyMg5paH56ug5YaF5a655pGY6KaBXG57e0NPTlRFTlR9fVxuXG4jIyDlj6/nlKjliIbnsbvliJfooahcbnt7Q0FURUdPUklFU319XG5cbuivt+S7juS4iui/sOWIhuexu+WIl+ihqOS4remAieaLqeacgOWMuemFjeeahOS4gOS4qu+8jOW5tui/lOWbniBKU09OIOagvOW8j+eahOWIhuexu+e7k+aenOOAgmA7XG5cbmV4cG9ydCBjb25zdCBTVUdHRVNUX0NBVEVHT1JZX1BST01QVCA9IGDmlofnq6DlhoXlrrnkuI7njrDmnInliIbnsbvpg73kuI3lpKrljLnphY3jgIJcbuW9k+aXoOazleaJvuWIsOWQiOmAguWIhuexu+aXtu+8jOWPr+S7peW7uuiuruS4gOS4quaWsOWIhuexu+WQjeensOOAglxu5paw5YiG57G75bqU6K+l5piv5ZCI55CG55qE5oqA5pyv6aKG5Z+f5ZCN56ew44CCYDtcbiIsImltcG9ydCB7IEFJUHJvdmlkZXIsIENsYXNzaWZpY2F0aW9uUmVzdWx0IH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyBTWVNURU1fUFJPTVBULCBVU0VSX1BST01QVF9URU1QTEFURSB9IGZyb20gJy4vcHJvbXB0cyc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHsgd2l0aFJldHJ5LCBmZXRjaFdpdGhUaW1lb3V0LCBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlLCB2YWxpZGF0ZVVybCB9IGZyb20gJy4uL3V0aWxzL2Vycm9ySGFuZGxlcic7XG5cbmV4cG9ydCBjbGFzcyBPbGxhbWFQcm92aWRlciBpbXBsZW1lbnRzIEFJUHJvdmlkZXIge1xuXHRuYW1lID0gJ09sbGFtYSc7XG5cdHByaXZhdGUgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuXHRwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuXHRcblx0Y29uc3RydWN0b3Ioc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzLCBsb2dnZXI6IExvZ2dlcikge1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcblx0fVxuXHRcblx0YXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIOmqjOivgSBVUkwg5qC85byPXG5cdFx0XHR2YWxpZGF0ZVVybCh0aGlzLnNldHRpbmdzLm9sbGFtYVVybCwgJ09sbGFtYSDlnLDlnYAnKTtcblx0XHRcdFxuXHRcdFx0Ly8g5L2/55So5bim6LaF5pe255qEIGZldGNoXG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoXG5cdFx0XHRcdGAke3RoaXMuc2V0dGluZ3Mub2xsYW1hVXJsfS9hcGkvdGFnc2AsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRtZXRob2Q6ICdHRVQnLFxuXHRcdFx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQxMDAwMCAvLyAxMCDnp5LotoXml7Zcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdGlmIChyZXNwb25zZS5vaykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnT2xsYW1hIOacjeWKoeato+W4uCcgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gIH07XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZSB9O1xuXHRcdH1cblx0fVxuXHRcblx0YXN5bmMgY2xhc3NpZnkoY29udGVudDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBjYXRlZ29yaWVzOiBzdHJpbmdbXSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHQ+IHtcblx0XHQvLyDkvb/nlKjluKbph43or5XnmoTmk43kvZxcblx0XHRyZXR1cm4gYXdhaXQgd2l0aFJldHJ5KFxuXHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB1c2VyUHJvbXB0ID0gVVNFUl9QUk9NUFRfVEVNUExBVEVcblx0XHRcdFx0XHQucmVwbGFjZSgne3tUSVRMRX19JywgdGl0bGUpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q09OVEVOVH19JywgY29udGVudC5zbGljZSgwLCA0MDAwKSlcblx0XHRcdFx0XHQucmVwbGFjZSgne3tDQVRFR09SSUVTfX0nLCBjYXRlZ29yaWVzLm1hcChjID0+IGAtICR7Y31gKS5qb2luKCdcXG4nKSk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvLyDkvb/nlKjluKbotoXml7bnmoQgZmV0Y2hcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRcdGAke3RoaXMuc2V0dGluZ3Mub2xsYW1hVXJsfS9hcGkvZ2VuZXJhdGVgLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG5cdFx0XHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLm9sbGFtYU1vZGVsLFxuXHRcdFx0XHRcdFx0XHRwcm9tcHQ6IGA8fGltX3N0YXJ0fD5zeXN0ZW1cXG4ke1NZU1RFTV9QUk9NUFR9PHxpbV9lbmR8Plxcbjx8aW1fc3RhcnR8PnVzZXJcXG4ke3VzZXJQcm9tcHR9PHxpbV9lbmR8PmAsXG5cdFx0XHRcdFx0XHRcdHN0cmVhbTogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0XHR0ZW1wZXJhdHVyZTogMC4zLFxuXHRcdFx0XHRcdFx0XHRcdG51bV9wcmVkaWN0OiA1MDAsXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdDYwMDAwIC8vIDYwIOenkui2heaXtu+8iE9sbGFtYSDlj6/og73ovoPmhaLvvIlcblx0XHRcdFx0KTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0XHRjb25zdCBlcnJvckRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVycm9yRGF0YS5lcnJvciB8fCBgT2xsYW1hIEFQSSDplJnor686ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wYXJzZVJlc3BvbnNlKGRhdGEucmVzcG9uc2UpO1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bWF4QXR0ZW1wdHM6IDMsXG5cdFx0XHRcdGluaXRpYWxEZWxheTogMjAwMCxcblx0XHRcdH0sXG5cdFx0XHQnT2xsYW1hIGNsYXNzaWZ5J1xuXHRcdCk7XG5cdH1cblx0XG5cdHByaXZhdGUgcGFyc2VSZXNwb25zZShyZXNwb25zZTogc3RyaW5nKTogQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuXHRcdC8vIOWwneivleS7juWTjeW6lOS4reaPkOWPliBKU09OXG5cdFx0Y29uc3QganNvbk1hdGNoID0gcmVzcG9uc2UubWF0Y2goL2BgYGpzb25cXG4oW1xcc1xcU10qPylcXG5gYGAvKSB8fCByZXNwb25zZS5tYXRjaCgvKFxce1tcXHNcXFNdKlxcfSkvKTtcblx0XHRcblx0XHRpZiAoanNvbk1hdGNoKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGpzb25NYXRjaFsxXSk7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IHBhcnNlZC5jYXRlZ29yeSB8fCAnT3RoZXInLFxuXHRcdFx0XHRcdGNvbmZpZGVuY2U6IHBhcnNlZC5jb25maWRlbmNlIHx8IDAuNSxcblx0XHRcdFx0XHRyZWFzb25pbmc6IHBhcnNlZC5yZWFzb25pbmcgfHwgJycsXG5cdFx0XHRcdFx0aXNVbmNlcnRhaW46IHBhcnNlZC5pc1VuY2VydGFpbiB8fCBmYWxzZSxcblx0XHRcdFx0XHRzdWdnZXN0ZWRDYXRlZ29yeTogcGFyc2VkLnN1Z2dlc3RlZENhdGVnb3J5LFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKCdKU09OIOino+aekOWksei0pe+8jOS9v+eUqOaWh+acrOino+aekCcpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHQvLyDlpIfnlKjop6PmnpDvvJrmj5Dlj5bnrKzkuIDkuKrliIbnsbvot6/lvoRcblx0XHRjb25zdCBjYXRlZ29yeU1hdGNoID0gcmVzcG9uc2UubWF0Y2goL2NhdGVnb3J5W1xcczpdK1tcIiddPyhbXlxcblwiJ10rKS9pKTtcblx0XHRjb25zdCBjb25maWRlbmNlTWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvY29uZmlkZW5jZVtcXHM6XSsoWzAtOS5dKykvaSk7XG5cdFx0XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNhdGVnb3J5OiBjYXRlZ29yeU1hdGNoID8gY2F0ZWdvcnlNYXRjaFsxXS50cmltKCkgOiAnT3RoZXInLFxuXHRcdFx0Y29uZmlkZW5jZTogY29uZmlkZW5jZU1hdGNoID8gcGFyc2VGbG9hdChjb25maWRlbmNlTWF0Y2hbMV0pIDogMC41LFxuXHRcdFx0cmVhc29uaW5nOiByZXNwb25zZS5zbGljZSgwLCAyMDApLFxuXHRcdFx0aXNVbmNlcnRhaW46IGZhbHNlLFxuXHRcdH07XG5cdH1cbn1cbiIsImltcG9ydCB7IEFJUHJvdmlkZXIsIENsYXNzaWZpY2F0aW9uUmVzdWx0IH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU1lTVEVNX1BST01QVCwgVVNFUl9QUk9NUFRfVEVNUExBVEUgfSBmcm9tICcuL3Byb21wdHMnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IHdpdGhSZXRyeSwgZmV0Y2hXaXRoVGltZW91dCwgZ2V0VXNlckZyaWVuZGx5TWVzc2FnZSwgdmFsaWRhdGVVcmwgfSBmcm9tICcuLi91dGlscy9lcnJvckhhbmRsZXInO1xuXG5pbnRlcmZhY2UgUHJvdmlkZXJDb25maWcge1xuXHRuYW1lOiBzdHJpbmc7XG5cdGFwaUtleTogc3RyaW5nO1xuXHRtb2RlbDogc3RyaW5nO1xuXHRiYXNlVXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIgaW1wbGVtZW50cyBBSVByb3ZpZGVyIHtcblx0bmFtZTogc3RyaW5nO1xuXHRwcml2YXRlIGNvbmZpZzogUHJvdmlkZXJDb25maWc7XG5cdHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG5cdFxuXHRjb25zdHJ1Y3Rvcihjb25maWc6IFByb3ZpZGVyQ29uZmlnLCBsb2dnZXI6IExvZ2dlcikge1xuXHRcdHRoaXMubmFtZSA9IGNvbmZpZy5uYW1lO1xuXHRcdHRoaXMuY29uZmlnID0gY29uZmlnO1xuXHRcdHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuXHR9XG5cdFxuXHRhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcblx0XHR0cnkge1xuXHRcdFx0Ly8g6aqM6K+BIEFQSSBLZXlcblx0XHRcdGlmICghdGhpcy5jb25maWcuYXBpS2V5IHx8IHRoaXMuY29uZmlnLmFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQVBJIEtleSDmnKrorr7nva7vvIzor7flhYjphY3nva4gQVBJIEtleScgfTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g6aqM6K+BIFVSTFxuXHRcdFx0dmFsaWRhdGVVcmwodGhpcy5jb25maWcuYmFzZVVybCwgJ0FQSSDlnLDlnYAnKTtcblx0XHRcdFxuXHRcdFx0Ly8g5L2/55So5bim6LaF5pe255qEIGZldGNoXG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoXG5cdFx0XHRcdGAke3RoaXMuY29uZmlnLmJhc2VVcmx9L21vZGVsc2AsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRtZXRob2Q6ICdHRVQnLFxuXHRcdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3RoaXMuY29uZmlnLmFwaUtleX1gLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdDEwMDAwIC8vIDEwIOenkui2heaXtlxuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0aWYgKHJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGAke3RoaXMubmFtZX0gQVBJIOi/nuaOpeato+W4uGAgfTtcblx0XHRcdH0gZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDEpIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBUEkgS2V5IOaXoOaViOaIluacquaOiOadg++8jOivt+ajgOafpeaYr+WQpuato+ehricgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306IOacjeWKoeaaguaXtuS4jeWPr+eUqGAgfTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlIH07XG5cdFx0fVxuXHR9XG5cdFxuXHRhc3luYyBjbGFzc2lmeShjb250ZW50OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGNhdGVnb3JpZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD4ge1xuXHRcdC8vIOS9v+eUqOW4pumHjeivleeahOaTjeS9nFxuXHRcdHJldHVybiBhd2FpdCB3aXRoUmV0cnkoXG5cdFx0XHRhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHVzZXJQcm9tcHQgPSBVU0VSX1BST01QVF9URU1QTEFURVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e1RJVExFfX0nLCB0aXRsZSlcblx0XHRcdFx0XHQucmVwbGFjZSgne3tDT05URU5UfX0nLCBjb250ZW50LnNsaWNlKDAsIDQwMDApKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e0NBVEVHT1JJRVN9fScsIGNhdGVnb3JpZXMubWFwKGMgPT4gYC0gJHtjfWApLmpvaW4oJ1xcbicpKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoXG5cdFx0XHRcdFx0YCR7dGhpcy5jb25maWcuYmFzZVVybH0vY2hhdC9jb21wbGV0aW9uc2AsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3RoaXMuY29uZmlnLmFwaUtleX1gLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0XHRcdFx0bW9kZWw6IHRoaXMuY29uZmlnLm1vZGVsLFxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlczogW1xuXHRcdFx0XHRcdFx0XHRcdHsgcm9sZTogJ3N5c3RlbScsIGNvbnRlbnQ6IFNZU1RFTV9QUk9NUFQgfSxcblx0XHRcdFx0XHRcdFx0XHR7IHJvbGU6ICd1c2VyJywgY29udGVudDogdXNlclByb21wdCB9LFxuXHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHR0ZW1wZXJhdHVyZTogMC4zLFxuXHRcdFx0XHRcdFx0XHRtYXhfdG9rZW5zOiA1MDAsXG5cdFx0XHRcdFx0XHRcdHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiAnanNvbl9vYmplY3QnIH0sXG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdDMwMDAwIC8vIDMwIOenkui2heaXtlxuXHRcdFx0XHQpO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gZXJyb3IuZXJyb3I/Lm1lc3NhZ2UgfHwgYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YDtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvLyDmnoTpgKDmm7Tor6bnu4bnmoTplJnor69cblx0XHRcdFx0XHRjb25zdCBlbmhhbmNlZEVycm9yID0gbmV3IEVycm9yKGVycm9yTXNnKSBhcyBFcnJvciAmIHtcblx0XHRcdFx0XHRcdHN0YXR1czogbnVtYmVyO1xuXHRcdFx0XHRcdFx0cmVzcG9uc2U6IHsgc3RhdHVzOiBudW1iZXI7IGhlYWRlcnM6IEhlYWRlcnMgfTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGVuaGFuY2VkRXJyb3Iuc3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuXHRcdFx0XHRcdGVuaGFuY2VkRXJyb3IucmVzcG9uc2UgPSB7IFxuXHRcdFx0XHRcdFx0c3RhdHVzOiByZXNwb25zZS5zdGF0dXMsXG5cdFx0XHRcdFx0XHRoZWFkZXJzOiByZXNwb25zZS5oZWFkZXJzLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dGhyb3cgZW5oYW5jZWRFcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0VGV4dCA9IGRhdGEuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudCB8fCAne30nO1xuXHRcdFx0XHRcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyc2VSZXNwb25zZShyZXN1bHRUZXh0KTtcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG1heEF0dGVtcHRzOiAzLFxuXHRcdFx0XHRpbml0aWFsRGVsYXk6IDE1MDAsXG5cdFx0XHR9LFxuXHRcdFx0YCR7dGhpcy5uYW1lfSBjbGFzc2lmeWBcblx0XHQpO1xuXHR9XG5cdFxuXHRwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2VUZXh0OiBzdHJpbmcpOiBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmVzcG9uc2VUZXh0KTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhdGVnb3J5OiBwYXJzZWQuY2F0ZWdvcnkgfHwgJ090aGVyJyxcblx0XHRcdFx0Y29uZmlkZW5jZTogcGFyc2VkLmNvbmZpZGVuY2UgfHwgMC41LFxuXHRcdFx0XHRyZWFzb25pbmc6IHBhcnNlZC5yZWFzb25pbmcgfHwgJycsXG5cdFx0XHRcdGlzVW5jZXJ0YWluOiBwYXJzZWQuaXNVbmNlcnRhaW4gfHwgZmFsc2UsXG5cdFx0XHRcdHN1Z2dlc3RlZENhdGVnb3J5OiBwYXJzZWQuc3VnZ2VzdGVkQ2F0ZWdvcnksXG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoJ0pTT04g6Kej5p6Q5aSx6LSlJyk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYXRlZ29yeTogJ090aGVyJyxcblx0XHRcdFx0Y29uZmlkZW5jZTogMC41LFxuXHRcdFx0XHRyZWFzb25pbmc6IHJlc3BvbnNlVGV4dC5zbGljZSgwLCAyMDApLFxuXHRcdFx0XHRpc1VuY2VydGFpbjogdHJ1ZSxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG59XG4iLCIvKipcbiAqIOeugOWNleaXpeW/l+W3peWFt1xuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcblx0cHJpdmF0ZSBlbmFibGVkOiBib29sZWFuO1xuXHRwcml2YXRlIHByZWZpeCA9ICdbQUlDbGFzc2lmaWVyXSc7XG5cdFxuXHRjb25zdHJ1Y3RvcihlbmFibGVkID0gZmFsc2UpIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cdFxuXHRzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cdFxuXHRkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVuYWJsZWQpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0XHR9XG5cdH1cblx0XG5cdGluZm8obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRjb25zb2xlLmRlYnVnKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cblx0XG5cdHdhcm4obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRjb25zb2xlLndhcm4oYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0fVxuXHRcblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRjb25zb2xlLmVycm9yKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbiwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTLCBQbHVnaW5TZXR0aW5ncywgQUlQcm92aWRlciB9IGZyb20gJy4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU2V0dGluZ3NUYWIgfSBmcm9tICcuL3NldHRpbmdzL1NldHRpbmdzVGFiJztcbmltcG9ydCB7IENsYXNzaWZ5Q29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kJztcbmltcG9ydCB7IE9sbGFtYVByb3ZpZGVyIH0gZnJvbSAnLi9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlcic7XG5pbXBvcnQgeyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIgfSBmcm9tICcuL3NlcnZpY2VzL09wZW5BSVByb3ZpZGVyJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuL3V0aWxzL2ZpbGVPcHMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBSUNsYXNzaWZpZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHQvLyDmj5Lku7borr7nva5cblx0c2V0dGluZ3M6IFBsdWdpblNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcblx0XG5cdC8vIOaXpeW/l1xuXHRsb2dnZXIgPSBuZXcgTG9nZ2VyKCk7XG5cdFxuXHQvLyDlkb3ku6TlpITnkIZcblx0cHJpdmF0ZSBjb21tYW5kczogQ2xhc3NpZnlDb21tYW5kO1xuXHRcblx0Ly8g6K6+572u6Z2i5p2/XG5cdHByaXZhdGUgc2V0dGluZ3NUYWI6IFNldHRpbmdzVGFiO1xuXHRcblx0YXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnNvbGUuZGVidWcoJ1tBSSBDbGFzc2lmaWVyXSDmj5Lku7bliqDovb3kuK0uLi4nKTtcblx0XHRcblx0XHQvLyDliqDovb3orr7nva5cblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXHRcdFxuXHRcdC8vIOWIneWni+WMluaXpeW/l1xuXHRcdHRoaXMubG9nZ2VyLnNldEVuYWJsZWQodGhpcy5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyk7XG5cdFx0XG5cdFx0Ly8g6Ieq5Yqo5Yib5bu6IEluYm94IOebruW9le+8iOWmguaenOS4jeWtmOWcqO+8iVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjcmVhdGVkID0gYXdhaXQgZmlsZU9wcy5lbnN1cmVGb2xkZXIodGhpcy5hcHAudmF1bHQsIHRoaXMuc2V0dGluZ3MuaW5ib3hGb2xkZXIpO1xuXHRcdFx0aWYgKGNyZWF0ZWQpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhg5bey5Yib5bu65pS25Lu2566x5paH5Lu25aS5OiAke3RoaXMuc2V0dGluZ3MuaW5ib3hGb2xkZXJ9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoJ+WIm+W7uuaUtuS7tueuseaWh+S7tuWkueWksei0pTonLCBlKTtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5Yid5aeL5YyW5ZG95LukXG5cdFx0dGhpcy5jb21tYW5kcyA9IG5ldyBDbGFzc2lmeUNvbW1hbmQodGhpcyk7XG5cdFx0XG5cdFx0Ly8g5rOo5YaM5ZG95LukXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAnY2xhc3NpZnktaW5ib3gnLFxuXHRcdFx0bmFtZTogJ0FJ5pm66IO95YiG57G7IC0g5YiG57G75pS25Lu2566xJyxcblx0XHRcdGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlJbmJveCgpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICdjbGFzc2lmeS1jdXJyZW50Jyxcblx0XHRcdG5hbWU6ICdBSeaZuuiDveWIhuexuyAtIOWIhuexu+W9k+WJjeaWh+S7ticsXG5cdFx0XHRjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0aWYgKCFjaGVja2luZykge1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5Q3VycmVudEZpbGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRcblx0XHQvLyAxLiDmt7vliqAgUmliYm9uIOWbvuagh++8iOW3puS+p+i+ueagj++8iVxuXHRcdHRoaXMuYWRkUmliYm9uSWNvbignc3BhcmtsZXMnLCAnQUnmmbrog73liIbnsbsnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5SW5ib3goKTtcblx0XHR9KTtcblx0XHRcblx0XHQvLyAyLiDmt7vliqDmlofku7blj7PplK7oj5zljZVcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdFx0XHRcdGl0ZW1cblx0XHRcdFx0XHRcdFx0LnNldFRpdGxlKCdBSeaZuuiDveWIhuexuycpXG5cdFx0XHRcdFx0XHRcdC5zZXRJY29uKCdzcGFya2xlcycpXG5cdFx0XHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5Q3VycmVudEZpbGUoKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblx0XHRcblx0XHQvLyAzLiDmt7vliqDnvJbovpHlmajoj5zljZXvvIjlj7PkuIrop5Lmm7TlpJroj5zljZXvvIlcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2VkaXRvci1tZW51JywgKG1lbnUpID0+IHtcblx0XHRcdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRcdFx0aXRlbVxuXHRcdFx0XHRcdFx0LnNldFRpdGxlKCdBSeaZuuiDveWIhuexuycpXG5cdFx0XHRcdFx0XHQuc2V0SWNvbignc3BhcmtsZXMnKVxuXHRcdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5Q3VycmVudEZpbGUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pXG5cdFx0KTtcblx0XHRcblx0XHQvLyDmt7vliqDorr7nva7pnaLmnb9cblx0XHR0aGlzLnNldHRpbmdzVGFiID0gbmV3IFNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKTtcblx0XHR0aGlzLmFkZFNldHRpbmdUYWIodGhpcy5zZXR0aW5nc1RhYik7XG5cdFx0XG5cdFx0Y29uc29sZS5kZWJ1ZygnW0FJIENsYXNzaWZpZXJdIOaPkuS7tuWKoOi9veWujOaIkCEnKTtcblx0fVxuXHRcblx0b251bmxvYWQoKTogdm9pZCB7XG5cdFx0Y29uc29sZS5kZWJ1ZygnW0FJIENsYXNzaWZpZXJdIOaPkuS7tuW3suWNuOi9vScpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog6I635Y+WIEFJIFByb3ZpZGVyIOWunuS+i1xuXHQgKi9cblx0Z2V0QUlQcm92aWRlcigpOiBBSVByb3ZpZGVyIHtcblx0XHRjb25zdCBwcm92aWRlclR5cGUgPSB0aGlzLnNldHRpbmdzLmFpUHJvdmlkZXI7XG5cdFx0XG5cdFx0Ly8g6aqM6K+B6YWN572uXG5cdFx0dGhpcy52YWxpZGF0ZVByb3ZpZGVyQ29uZmlnKHByb3ZpZGVyVHlwZSk7XG5cdFx0XG5cdFx0c3dpdGNoIChwcm92aWRlclR5cGUpIHtcblx0XHRcdGNhc2UgJ29sbGFtYSc6XG5cdFx0XHRcdHJldHVybiBuZXcgT2xsYW1hUHJvdmlkZXIodGhpcy5zZXR0aW5ncywgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ09wZW5BSScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnNldHRpbmdzLm9wZW5haUFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5vcGVuYWlNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLm9wZW5haUFwaVVybCxcblx0XHRcdFx0fSwgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdHJldHVybiBuZXcgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyKHtcblx0XHRcdFx0XHRuYW1lOiAnRGVlcFNlZWsnLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5kZWVwc2Vla01vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ01vb25zaG90IChLaW1pKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnNldHRpbmdzLm1vb25zaG90QXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLm1vb25zaG90TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5zZXR0aW5ncy5tb29uc2hvdEFwaVVybCxcblx0XHRcdFx0fSwgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdHJldHVybiBuZXcgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyKHtcblx0XHRcdFx0XHRuYW1lOiAnWmhpcHUgKOaZuuiwsSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy56aGlwdU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3MuemhpcHVBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBBSSBQcm92aWRlcjogJHtwcm92aWRlclR5cGUgYXMgc3RyaW5nfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOmqjOivgSBQcm92aWRlciDphY3nva5cblx0ICovXG5cdHByaXZhdGUgdmFsaWRhdGVQcm92aWRlckNvbmZpZyhwcm92aWRlclR5cGU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHN3aXRjaCAocHJvdmlkZXJUeXBlKSB7XG5cdFx0XHRjYXNlICdvbGxhbWEnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub2xsYW1hVXJsIHx8IHRoaXMuc2V0dGluZ3Mub2xsYW1hVXJsLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ09sbGFtYSDlnLDlnYDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub2xsYW1hTW9kZWwgfHwgdGhpcy5zZXR0aW5ncy5vbGxhbWFNb2RlbC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPbGxhbWEg5qih5Z6L5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignT3BlbkFJIEFQSSBLZXkg5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5IHx8IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignRGVlcFNlZWsgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy5tb29uc2hvdEFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNb29uc2hvdCBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleSB8fCB0aGlzLnNldHRpbmdzLnpoaXB1QXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ+aZuuiwsSBBSSBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBBSSBQcm92aWRlcjogJHtwcm92aWRlclR5cGV9YCk7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5Yqg6L296K6+572uXG5cdCAqL1xuXHRhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcblx0XHR0aGlzLnNldHRpbmdzID0ge1xuXHRcdFx0Li4uREVGQVVMVF9TRVRUSU5HUyxcblx0XHRcdC4uLmRhdGEsXG5cdFx0fTtcblx0XHRcblx0XHQvLyDliJ3lp4vljJbliIbnsbvliJfooahcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuY2F0ZWdvcmllcyB8fCB0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKHRoaXMuc2V0dGluZ3MuY2F0ZWdvcnlUcmVlKTtcblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDkv53lrZjorr7nva5cblx0ICovXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHRcdHRoaXMubG9nZ2VyLnNldEVuYWJsZWQodGhpcy5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDlsIbliIbnsbvmoJHlsZXlubPkuLrliJfooahcblx0ICovXG5cdHByaXZhdGUgZmxhdHRlbkNhdGVnb3JpZXModHJlZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHByZWZpeCA9ICcnKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0cmVlKSkge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHByZWZpeCA/IGAke3ByZWZpeH0vJHtrZXl9YCA6IGtleTtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKC4uLnRoaXMuZmxhdHRlbkNhdGVnb3JpZXModmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHBhdGgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHBhdGgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG4iXSwibmFtZXMiOlsiTm90aWNlIiwiQ29uZmlybU1vZGFsIiwiTW9kYWwiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlRGaWxlIiwicmVxdWVzdFVybCIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7OztBQStDTyxNQUFNLGdCQUFnQixHQUFtQjtBQUMvQyxJQUFBLFVBQVUsRUFBRSxRQUFRO0FBQ3BCLElBQUEsU0FBUyxFQUFFLHdCQUF3QjtBQUNuQyxJQUFBLFdBQVcsRUFBRSxVQUFVOztBQUd2QixJQUFBLFlBQVksRUFBRSxFQUFFO0FBQ2hCLElBQUEsV0FBVyxFQUFFLGFBQWE7QUFDMUIsSUFBQSxZQUFZLEVBQUUsMkJBQTJCOztBQUd6QyxJQUFBLGNBQWMsRUFBRSxF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
