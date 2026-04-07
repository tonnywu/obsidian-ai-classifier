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
                new Notice(t('settings.categoryExists'));
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
                new Notice(t('settings.categoryExists'));
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
                new Notice(t('settings.categoryExists'));
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
            if (!current[part]) {
                return null;
            }
            current = current[part];
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
            value: this.defaultValue
        });
        input.style.width = '100%';
        input.style.marginBottom = '20px';
        // 监听回车键
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.onSubmit(input.value);
                this.close();
            }
        });
        const buttonsEl = contentEl.createDiv('modal-button-container');
        buttonsEl.style.display = 'flex';
        buttonsEl.style.justifyContent = 'flex-end';
        buttonsEl.style.gap = '8px';
        const cancelBtn = buttonsEl.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => this.close());
        const confirmBtn = buttonsEl.createEl('button', {
            text: '确定',
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
        buttonsEl.style.display = 'flex';
        buttonsEl.style.justifyContent = 'flex-end';
        buttonsEl.style.gap = '8px';
        const cancelBtn = buttonsEl.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => this.close());
        const confirmBtn = buttonsEl.createEl('button', {
            text: '确定',
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
    addAIProviderSection() {
        const { containerEl } = this;
        containerEl.createEl('h3', { text: 'AI 配置' });
        // AI 提供商选择
        new obsidian.Setting(containerEl)
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
                this.plugin.settings.aiProvider = value;
                this.plugin.saveSettings();
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
                    this.plugin.saveSettings();
                });
            });
            new obsidian.Setting(containerEl)
                .setName(t('settings.ollamaModel'))
                .setDesc(t('settings.ollamaModelDesc'))
                .addText(text => {
                text.setValue(this.plugin.settings.ollamaModel)
                    .onChange((value) => {
                    this.plugin.settings.ollamaModel = value;
                    this.plugin.saveSettings();
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
                    this.plugin.saveSettings();
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
                    this.plugin.saveSettings();
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
                    this.plugin.saveSettings();
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
        containerEl.createEl('h3', { text: '分类配置' });
        new obsidian.Setting(containerEl)
            .setName(t('settings.inboxFolder'))
            .setDesc(t('settings.inboxFolderDesc'))
            .addText(text => {
            text.setValue(this.plugin.settings.inboxFolder)
                .onChange((value) => {
                this.plugin.settings.inboxFolder = value;
                this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
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
        new CategoryTreeView(treeContainer, this.plugin.settings.categoryTree, (newTree) => {
            this.plugin.settings.categoryTree = newTree;
            this.plugin.settings.categories = this.flattenCategories(newTree);
            this.plugin.saveSettings();
        });
        // 操作按钮
        const actionsEl = containerEl.createDiv('category-tree-footer');
        new obsidian.Setting(actionsEl)
            .addButton(btn => {
            btn.setButtonText(t('settings.restoreDefault'))
                .onClick(() => {
                if (confirm(t('settings.confirmRestoreDefault'))) {
                    this.plugin.settings.categoryTree = DEFAULT_SETTINGS.categoryTree;
                    this.plugin.settings.categories = this.flattenCategories(DEFAULT_SETTINGS.categoryTree);
                    void this.plugin.saveSettings();
                    this.display(); // 刷新设置面板
                }
            });
        });
    }
    addAdvancedSection() {
        const { containerEl } = this;
        containerEl.createEl('h3', { text: '高级设置' });
        new obsidian.Setting(containerEl)
            .setName(t('settings.enableSuggestedCategories'))
            .setDesc(t('settings.enableSuggestedCategoriesDesc'))
            .addToggle(toggle => {
            toggle.setValue(this.plugin.settings.enableSuggestedCategories)
                .onChange((value) => {
                this.plugin.settings.enableSuggestedCategories = value;
                this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName(t('settings.autoMoveFile'))
            .setDesc(t('settings.autoMoveFileDesc'))
            .addToggle(toggle => {
            toggle.setValue(this.plugin.settings.autoMoveFile)
                .onChange((value) => {
                this.plugin.settings.autoMoveFile = value;
                this.plugin.saveSettings();
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
                this.plugin.saveSettings();
            });
        });
    }
    addDebugSection() {
        const { containerEl } = this;
        containerEl.createEl('h3', { text: '调试' });
        new obsidian.Setting(containerEl)
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
                if (!newFile) {
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
    const message = error?.message || String(error);
    const lowerMessage = message.toLowerCase();
    const status = error?.status || error?.response?.status;
    // 网络错误
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') ||
        lowerMessage.includes('enotfound') || lowerMessage.includes('econnrefused')) {
        return new AIClassifierError('网络连接失败，请检查网络设置', 'network', error);
    }
    // 超时错误
    if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
        return new AIClassifierError('请求超时，请稍后重试', 'timeout', error);
    }
    // 认证错误
    if (status === 401 || status === 403 ||
        lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid api key')) {
        return new AIClassifierError('API Key 无效或未授权', 'auth', error);
    }
    // 限流错误
    if (status === 429 || lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
        return new AIClassifierError('API 请求过于频繁，请稍后重试', 'rate_limit', error);
    }
    // JSON 解析错误
    if (lowerMessage.includes('json') || lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
        return new AIClassifierError('响应数据格式错误', 'parse', error);
    }
    // 未知错误
    return new AIClassifierError(message, 'unknown', error);
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
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
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
            json: async () => response.json,
            text: async () => response.text,
            blob: async () => new Blob([response.arrayBuffer]),
            arrayBuffer: async () => response.arrayBuffer,
            formData: async () => { throw new Error('formData not supported'); },
            clone: function () { return this; },
            body: null,
            bodyUsed: false,
            redirected: false,
            type: 'basic',
            url: url,
        };
    }
    catch (error) {
        throw new AIClassifierError('请求超时或网络错误', 'timeout', error);
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
            if (typeof value === 'object' && value !== null && value !== true) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3NyYy9zZXR0aW5ncy90eXBlcy50cyIsInNyYy9zcmMvc2V0dGluZ3MvaTE4bi50cyIsInNyYy9zcmMvc2V0dGluZ3MvQ2F0ZWdvcnlUcmVlVmlldy50cyIsInNyYy9zcmMvc2V0dGluZ3MvU2V0dGluZ3NUYWIudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NvbnRlbnRFeHRyYWN0b3IudHMiLCJzcmMvc3JjL3V0aWxzL2ZpbGVPcHMudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NsYXNzaWZpZXIudHMiLCJzcmMvc3JjL3V0aWxzL2Vycm9ySGFuZGxlci50cyIsInNyYy9zcmMvY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9wcm9tcHRzLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlci50cyIsInNyYy9zcmMvc2VydmljZXMvT3BlbkFJUHJvdmlkZXIudHMiLCJzcmMvc3JjL3V0aWxzL2xvZ2dlci50cyIsInNyYy9zcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgdHlwZSBBSVByb3ZpZGVyVHlwZSA9ICdvbGxhbWEnIHwgJ29wZW5haScgfCAnZGVlcHNlZWsnIHwgJ21vb25zaG90JyB8ICd6aGlwdSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2F0ZWdvcnlUcmVlIHtcblx0W25hbWU6IHN0cmluZ106IENhdGVnb3J5VHJlZSB8IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuXHQvLyBBSSDphY3nva5cblx0YWlQcm92aWRlcjogQUlQcm92aWRlclR5cGU7XG5cdG9sbGFtYVVybDogc3RyaW5nO1xuXHRvbGxhbWFNb2RlbDogc3RyaW5nO1xuXHRcblx0Ly8gT3BlbkFJIOmFjee9rlxuXHRvcGVuYWlBcGlLZXk6IHN0cmluZztcblx0b3BlbmFpTW9kZWw6IHN0cmluZztcblx0b3BlbmFpQXBpVXJsOiBzdHJpbmc7XG5cdFxuXHQvLyBEZWVwU2VlayDphY3nva5cblx0ZGVlcHNlZWtBcGlLZXk6IHN0cmluZztcblx0ZGVlcHNlZWtNb2RlbDogc3RyaW5nO1xuXHRkZWVwc2Vla0FwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gTW9vbnNob3QgKEtpbWkpIOmFjee9rlxuXHRtb29uc2hvdEFwaUtleTogc3RyaW5nO1xuXHRtb29uc2hvdE1vZGVsOiBzdHJpbmc7XG5cdG1vb25zaG90QXBpVXJsOiBzdHJpbmc7XG5cdFxuXHQvLyBaaGlwdSAo5pm66LCxIEFJKSDphY3nva5cblx0emhpcHVBcGlLZXk6IHN0cmluZztcblx0emhpcHVNb2RlbDogc3RyaW5nO1xuXHR6aGlwdUFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8g5YiG57G76YWN572uXG5cdGluYm94Rm9sZGVyOiBzdHJpbmc7XG5cdGNhdGVnb3J5VHJlZTogQ2F0ZWdvcnlUcmVlO1xuXHRjYXRlZ29yaWVzOiBzdHJpbmdbXTtcblx0c2NhblN1YmZvbGRlcnM6IGJvb2xlYW47XG5cdFxuXHQvLyDpq5jnuqflip/og71cblx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogYm9vbGVhbjtcblx0YXV0b01vdmVGaWxlOiBib29sZWFuO1xuXHRjb25maWRlbmNlVGhyZXNob2xkOiBudW1iZXI7XG5cdFxuXHQvLyDml6Xlv5dcblx0ZW5hYmxlRGVidWdMb2c6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcblx0YWlQcm92aWRlcjogJ29sbGFtYScsXG5cdG9sbGFtYVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MTE0MzQnLFxuXHRvbGxhbWFNb2RlbDogJ2xsYW1hMy4yJyxcblx0XG5cdC8vIE9wZW5BSSDpu5jorqTphY3nva5cblx0b3BlbmFpQXBpS2V5OiAnJyxcblx0b3BlbmFpTW9kZWw6ICdncHQtNG8tbWluaScsXG5cdG9wZW5haUFwaVVybDogJ2h0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEnLFxuXHRcblx0Ly8gRGVlcFNlZWsg6buY6K6k6YWN572uXG5cdGRlZXBzZWVrQXBpS2V5OiAnJyxcblx0ZGVlcHNlZWtNb2RlbDogJ2RlZXBzZWVrLWNoYXQnLFxuXHRkZWVwc2Vla0FwaVVybDogJ2h0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbS92MScsXG5cdFxuXHQvLyBNb29uc2hvdCAoS2ltaSkg6buY6K6k6YWN572uXG5cdG1vb25zaG90QXBpS2V5OiAnJyxcblx0bW9vbnNob3RNb2RlbDogJ21vb25zaG90LXYxLThrJyxcblx0bW9vbnNob3RBcGlVcmw6ICdodHRwczovL2FwaS5tb29uc2hvdC5jbi92MScsXG5cdFxuXHQvLyBaaGlwdSAo5pm66LCxKSDpu5jorqTphY3nva5cblx0emhpcHVBcGlLZXk6ICcnLFxuXHR6aGlwdU1vZGVsOiAnZ2xtLTQnLFxuXHR6aGlwdUFwaVVybDogJ2h0dHBzOi8vb3Blbi5iaWdtb2RlbC5jbi9hcGkvcGFhcy92NCcsXG5cdFxuXHRpbmJveEZvbGRlcjogJ0luYm94Jyxcblx0Y2F0ZWdvcnlUcmVlOiB7XG5cdFx0J1Byb2dyYW1taW5nJzoge1xuXHRcdFx0J0Zyb250ZW5kJzogdHJ1ZSxcblx0XHRcdCdCYWNrZW5kJzogdHJ1ZSxcblx0XHRcdCdNb2JpbGUnOiB0cnVlLFxuXHRcdFx0J0Rldk9wcyc6IHRydWUsXG5cdFx0fSxcblx0XHQnQUkgJiBNTCc6IHtcblx0XHRcdCdNYWNoaW5lIExlYXJuaW5nJzogdHJ1ZSxcblx0XHRcdCdEZWVwIExlYXJuaW5nJzogdHJ1ZSxcblx0XHRcdCdOTFAnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0RhdGEnOiB7XG5cdFx0XHQnRGF0YWJhc2UnOiB0cnVlLFxuXHRcdFx0J0RhdGEgRW5naW5lZXJpbmcnOiB0cnVlLFxuXHRcdFx0J0FuYWx5dGljcyc6IHRydWUsXG5cdFx0fSxcblx0XHQnQXJjaGl0ZWN0dXJlJzoge1xuXHRcdFx0J1N5c3RlbSBEZXNpZ24nOiB0cnVlLFxuXHRcdFx0J01pY3Jvc2VydmljZXMnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J090aGVyJzogdHJ1ZSxcblx0fSxcblx0Y2F0ZWdvcmllczogW10sXG5cdHNjYW5TdWJmb2xkZXJzOiB0cnVlLFxuXHRcblx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogZmFsc2UsXG5cdGF1dG9Nb3ZlRmlsZTogdHJ1ZSxcblx0Y29uZmlkZW5jZVRocmVzaG9sZDogMC43LFxuXHRcblx0ZW5hYmxlRGVidWdMb2c6IGZhbHNlLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdGNhdGVnb3J5OiBzdHJpbmc7XG5cdGNvbmZpZGVuY2U6IG51bWJlcjtcblx0cmVhc29uaW5nOiBzdHJpbmc7XG5cdGlzVW5jZXJ0YWluOiBib29sZWFuO1xuXHRzdWdnZXN0ZWRDYXRlZ29yeT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBSVByb3ZpZGVyIHtcblx0bmFtZTogc3RyaW5nO1xuXHR0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+O1xuXHRjbGFzc2lmeShjb250ZW50OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGNhdGVnb3JpZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD47XG59XG4iLCIvLyDlm73pmYXljJbmlK/mjIEgLSDlvZPliY3ku4XmlK/mjIHkuK3mlodcbmV4cG9ydCBjb25zdCB0cmFuc2xhdGlvbnMgPSB7XG5cdHNldHRpbmdzOiB7XG5cdFx0dGl0bGU6ICdBSeaZuuiDveWIhuexu+iuvue9ricsXG5cdFx0YWlQcm92aWRlcjogJ0FJIOaPkOS+m+WVhicsXG5cdFx0YWlQcm92aWRlckRlc2M6ICfpgInmi6kgQUkg5pyN5Yqh55qE5o+Q5L6b5pa5Jyxcblx0XHRvbGxhbWFVcmw6ICdPbGxhbWEg5Zyw5Z2AJyxcblx0XHRvbGxhbWFVcmxEZXNjOiAn5pys5ZywIE9sbGFtYSDmnI3liqHnmoTlnLDlnYAnLFxuXHRcdG9sbGFtYU1vZGVsOiAnT2xsYW1hIOaooeWeiycsXG5cdFx0b2xsYW1hTW9kZWxEZXNjOiAn5L2/55So55qE5qih5Z6L5ZCN56ewJyxcblx0XHRvcGVuYWlBcGlLZXk6ICdPcGVuQUkgQVBJIEtleScsXG5cdFx0b3BlbmFpQXBpS2V5RGVzYzogJ+aCqOeahCBPcGVuQUkgQVBJIOWvhumSpScsXG5cdFx0b3BlbmFpTW9kZWw6ICdPcGVuQUkg5qih5Z6LJyxcblx0XHRvcGVuYWlNb2RlbERlc2M6ICfkvb/nlKjnmoQgT3BlbkFJIOaooeWeiycsXG5cdFx0aW5ib3hGb2xkZXI6ICfmlLbku7bnrrHmlofku7blpLknLFxuXHRcdGluYm94Rm9sZGVyRGVzYzogJ+W+heWIhuexu+aWh+S7tuaJgOWcqOeahOaWh+S7tuWkuScsXG5cdFx0Y2F0ZWdvcnlUcmVlOiAn5YiG57G757uT5p6EJyxcblx0XHRjYXRlZ29yeVRyZWVEZXNjOiAn5a6a5LmJ5oKo55qE5YiG57G75qCR57uT5p6E77yISlNPTuagvOW8j++8iScsXG5cdFx0Y2F0ZWdvcmllczogJ+WIhuexu+WIl+ihqCcsXG5cdFx0ZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllczogJ+WQr+eUqCBBSSDmjqjojZDmlrDliIbnsbsnLFxuXHRcdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXNEZXNjOiAn5b2T5paH56ug5peg5rOV5Yy56YWN546w5pyJ5YiG57G75pe277yMQUkg5Y+v5Lul5bu66K6u5paw5YiG57G7Jyxcblx0XHRhdXRvTW92ZUZpbGU6ICfoh6rliqjnp7vliqjmlofku7YnLFxuXHRcdGF1dG9Nb3ZlRmlsZURlc2M6ICfliIbnsbvlrozmiJDlkI7oh6rliqjlsIbmlofku7bnp7vliqjliLDlr7nlupTmlofku7blpLknLFxuXHRcdGNvbmZpZGVuY2VUaHJlc2hvbGQ6ICfnva7kv6HluqbpmIjlgLwnLFxuXHRcdGNvbmZpZGVuY2VUaHJlc2hvbGREZXNjOiAn5L2O5LqO5q2k572u5L+h5bqm5bCG5o+Q56S655So5oi356Gu6K6kJyxcblx0XHRlbmFibGVEZWJ1Z0xvZzogJ+WQr+eUqOiwg+ivleaXpeW/lycsXG5cdFx0ZW5hYmxlRGVidWdMb2dEZXNjOiAn5Zyo5o6n5Yi25Y+w6L6T5Ye66K+m57uG5pel5b+XJyxcblx0XHR0ZXN0Q29ubmVjdGlvbjogJ+a1i+ivlei/nuaOpScsXG5cdFx0Y29ubmVjdGlvblN1Y2Nlc3M6ICfov57mjqXmiJDlip/vvIEnLFxuXHRcdGNvbm5lY3Rpb25GYWlsZWQ6ICfov57mjqXlpLHotKXvvJonLFxuXHRcdHNhdmU6ICfkv53lrZjorr7nva4nLFxuXHRcdGNhdGVnb3JpZXNQbGFjZWhvbGRlcjogJ+e8lueoiy/liY3nq68sIOe8lueoiy/lkI7nq68sIEFJL+acuuWZqOWtpuS5oCwgLi4uJyxcblx0XHRhZGRUb3BMZXZlbDogJ+a3u+WKoOS4gOe6p+WIhuexuycsXG5cdFx0ZW50ZXJDYXRlZ29yeU5hbWU6ICfor7fovpPlhaXliIbnsbvlkI3np7AnLFxuXHRcdGVudGVyTmV3TmFtZTogJ+ivt+i+k+WFpeaWsOWQjeensCcsXG5cdFx0Y2F0ZWdvcnlFeGlzdHM6ICfliIbnsbvlt7LlrZjlnKgnLFxuXHRcdGNvbmZpcm1EZWxldGU6ICfnoa7orqTliKDpmaTmraTliIbnsbvvvJ8nLFxuXHRcdGNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW46ICfmraTliIbnsbvljIXlkKvlrZDliIbnsbvvvIznoa7orqTliKDpmaTmiYDmnInlrZDliIbnsbvlkJfvvJ8nLFxuXHRcdHJlc3RvcmVEZWZhdWx0OiAn5oGi5aSN6buY6K6kJyxcblx0XHRjb25maXJtUmVzdG9yZURlZmF1bHQ6ICfnoa7orqTmgaLlpI3pu5jorqTliIbnsbvmoJHvvJ/lvZPliY3nmoToh6rlrprkuYnphY3nva7lsIbkuKLlpLHjgIInLFxuXHR9LFxuXHRjbGFzc2lmeToge1xuXHRcdGNvbW1hbmQ6ICdBSeaZuuiDveWIhuexuycsXG5cdFx0Y2xhc3NpZnlJbmJveDogJ+WIhuexu+aUtuS7tueusScsXG5cdFx0Y2xhc3NpZnlDdXJyZW50OiAn5YiG57G75b2T5YmN5paH5Lu2Jyxcblx0XHRwcm9jZXNzaW5nOiAn5q2j5Zyo5YiG5p6QOiAnLFxuXHRcdHN1Y2Nlc3M6ICfliIbnsbvlrozmiJAnLFxuXHRcdG1vdmVkOiAn5bey56e75Yqo5YiwOiAnLFxuXHRcdHVuY2VydGFpbjogJ+e9ruS/oeW6pui+g+S9jiAoJyxcblx0XHRjb25maXJtOiAn5piv5ZCm56Gu6K6k5YiG57G75YiwOiAnLFxuXHRcdGxvd0NvbmZpZGVuY2U6ICfnva7kv6Hluqbov4fkvY7vvIzor7fmiYvliqjnoa7orqQnLFxuXHRcdHN1Z2dlc3RlZENhdGVnb3J5OiAn5bu66K6u5paw5aKe5YiG57G7OiAnLFxuXHRcdGFkZENhdGVnb3J5OiAn5piv5ZCm5bCG5q2k5YiG57G75re75Yqg5Yiw6aKE6K6+PycsXG5cdFx0bm9JbmJveDogJ+acquaJvuWIsOaUtuS7tueuseaWh+S7tuWkuTogJyxcblx0XHRub0ZpbGVzOiAn5pS25Lu2566x5Lit5rKh5pyJ5paH5Lu2Jyxcblx0XHRza2lwOiAn6Lez6L+HJyxcblx0fSxcblx0ZXJyb3JzOiB7XG5cdFx0bm9Db250ZW50OiAn5peg5rOV5o+Q5Y+W5paH5Lu25YaF5a65Jyxcblx0XHRub1RpdGxlOiAn5peg5rOV6I635Y+W5paH5Lu25qCH6aKYJyxcblx0XHRhaUVycm9yOiAnQUkg5pyN5Yqh6ZSZ6K+vOiAnLFxuXHRcdG1vdmVFcnJvcjogJ+enu+WKqOaWh+S7tuWksei0pTogJyxcblx0fSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB0KGtleTogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qga2V5cyA9IGtleS5zcGxpdCgnLicpO1xuXHRsZXQgcmVzdWx0OiB1bmtub3duID0gdHJhbnNsYXRpb25zO1xuXHRmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuXHRcdHJlc3VsdCA9IChyZXN1bHQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pPy5ba107XG5cdH1cblx0cmV0dXJuIChyZXN1bHQgYXMgc3RyaW5nKSB8fCBrZXk7XG59XG4iLCJpbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcbmltcG9ydCB7IEFwcCwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8vIOWjsOaYjuWFqOWxgCBhcHAg5Y+Y6YePXG5kZWNsYXJlIGNvbnN0IGFwcDogQXBwO1xuXG4vKipcbiAqIOWIhuexu+agkeiKgueCueaVsOaNrue7k+aehFxuICovXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5Tm9kZSB7XG5cdG5hbWU6IHN0cmluZztcblx0Y2hpbGRyZW4/OiBDYXRlZ29yeU5vZGVbXTtcbn1cblxuLyoqXG4gKiDliIbnsbvmoJHoioLngrnnsbvlnotcbiAqL1xuaW50ZXJmYWNlIENhdGVnb3J5VHJlZU5vZGUge1xuXHRba2V5OiBzdHJpbmddOiBDYXRlZ29yeVRyZWVOb2RlIHwgdHJ1ZTtcbn1cblxuLyoqXG4gKiDliIbnsbvmoJHlj6/op4bljJbnu4Tku7ZcbiAqL1xuZXhwb3J0IGNsYXNzIENhdGVnb3J5VHJlZVZpZXcge1xuXHRwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0cmVlOiBDYXRlZ29yeVRyZWVOb2RlO1xuXHRwcml2YXRlIG9uQ2hhbmdlOiAodHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSkgPT4gdm9pZDtcblx0cHJpdmF0ZSBleHBhbmRlZE5vZGVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0dHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSxcblx0XHRvbkNoYW5nZTogKHRyZWU6IENhdGVnb3J5VHJlZU5vZGUpID0+IHZvaWRcblx0KSB7XG5cdFx0dGhpcy5jb250YWluZXJFbCA9IGNvbnRhaW5lckVsO1xuXHRcdHRoaXMudHJlZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodHJlZSkpOyAvLyDmt7Hmi7fotJ1cblx0XHR0aGlzLm9uQ2hhbmdlID0gb25DaGFuZ2U7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmuLLmn5PmlbTkuKrmoJFcblx0ICovXG5cdHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHR0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKCdjYXRlZ29yeS10cmVlLWNvbnRhaW5lcicpO1xuXG5cdFx0Ly8g5riy5p+T5qCR5b2i57uT5p6EXG5cdFx0Y29uc3QgdHJlZUVsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUnKTtcblx0XHR0aGlzLnJlbmRlclRyZWVMZXZlbCh0cmVlRWwsIHRoaXMudHJlZSwgJycpO1xuXG5cdFx0Ly8g5re75Yqg5LiA57qn5YiG57G75oyJ6ZKuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtYWN0aW9ucycpO1xuXHRcdGNvbnN0IGFkZEJ0biA9IGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0XHR0ZXh0OiB0KCdzZXR0aW5ncy5hZGRUb3BMZXZlbCcpXG5cdFx0fSk7XG5cdFx0YWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5hZGRUb3BMZXZlbENhdGVnb3J5KCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5riy5p+T5qCR55qE5p+Q5LiA57qnXG5cdCAqL1xuXHRwcml2YXRlIHJlbmRlclRyZWVMZXZlbChcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG5vZGU6IENhdGVnb3J5VHJlZU5vZGUsXG5cdFx0cGF0aDogc3RyaW5nXG5cdCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGUpKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50UGF0aCA9IHBhdGggPyBgJHtwYXRofS8ke2tleX1gIDoga2V5O1xuXHRcdFx0Y29uc3QgaGFzQ2hpbGRyZW4gPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPiAwO1xuXHRcdFx0Y29uc3QgaXNFeHBhbmRlZCA9IHRoaXMuZXhwYW5kZWROb2Rlcy5oYXMoY3VycmVudFBhdGgpO1xuXG5cdFx0XHQvLyDliJvlu7roioLngrnlrrnlmahcblx0XHRcdGNvbnN0IG5vZGVFbCA9IGNvbnRhaW5lci5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUnKTtcblxuXHRcdFx0Ly8g6IqC54K56KGM77yI5ZCN56ewICsg5pON5L2c5oyJ6ZKu77yJXG5cdFx0XHRjb25zdCBub2RlUm93ID0gbm9kZUVsLmNyZWF0ZURpdignY2F0ZWdvcnktbm9kZS1yb3cnKTtcblxuXHRcdFx0Ly8g5bGV5byAL+aKmOWPoOaMiemSru+8iOS7heW9k+acieWtkOiKgueCueaXtuaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IGV4cGFuZEJ0biA9IG5vZGVSb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1leHBhbmQtYnRuJyxcblx0XHRcdFx0XHR0ZXh0OiBpc0V4cGFuZGVkID8gJ+KWvCcgOiAn4pa2J1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZXhwYW5kQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpc0V4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4cGFuZGVkTm9kZXMuZGVsZXRlKGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5leHBhbmRlZE5vZGVzLmFkZChjdXJyZW50UGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8g5Y2g5L2N56ym77yM5L+d5oyB5a+56b2QXG5cdFx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7IGNsczogJ2NhdGVnb3J5LWV4cGFuZC1wbGFjZWhvbGRlcicsIHRleHQ6ICfjgIAnIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyDlm77moIdcblx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWljb24nLFxuXHRcdFx0XHR0ZXh0OiBoYXNDaGlsZHJlbiA/ICfwn5OCJyA6ICfwn5OEJ1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWQjeensFxuXHRcdFx0bm9kZVJvdy5jcmVhdGVFbCgnc3BhbicsIHtcblx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktbmFtZScsXG5cdFx0XHRcdHRleHQ6IGtleVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOaTjeS9nOaMiemSruWuueWZqFxuXHRcdFx0Y29uc3QgYWN0aW9uc0VsID0gbm9kZVJvdy5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUtYWN0aW9ucycpO1xuXG5cdFx0XHQvLyDnvJbovpHmjInpkq5cblx0XHRcdGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1hY3Rpb24tYnRuJyxcblx0XHRcdFx0dGV4dDogJ+Kcj++4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXROb2RlKGN1cnJlbnRQYXRoLCBrZXkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWIoOmZpOaMiemSrlxuXHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWFjdGlvbi1idG4nLFxuXHRcdFx0XHR0ZXh0OiAn8J+Xke+4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRlbGV0ZU5vZGUoY3VycmVudFBhdGgsIGtleSwgaGFzQ2hpbGRyZW4pO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOa3u+WKoOWtkOWIhuexu+aMiemSru+8iOS7heWvueeItuiKgueCueaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktYWN0aW9uLWJ0bicsXG5cdFx0XHRcdFx0dGV4dDogJ+KelSdcblx0XHRcdFx0fSkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5hZGRDaGlsZENhdGVnb3J5KGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIOa4suafk+WtkOiKgueCuVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuICYmIGlzRXhwYW5kZWQpIHtcblx0XHRcdFx0Y29uc3QgY2hpbGRyZW5FbCA9IG5vZGVFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LWNoaWxkcmVuJyk7XG5cdFx0XHRcdHRoaXMucmVuZGVyVHJlZUxldmVsKGNoaWxkcmVuRWwsIHZhbHVlLCBjdXJyZW50UGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIOa3u+WKoOS4gOe6p+WIhuexu1xuXHQgKi9cblx0cHJpdmF0ZSBhZGRUb3BMZXZlbENhdGVnb3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuc2hvd1Byb21wdE1vZGFsKFxuXHRcdFx0dCgnc2V0dGluZ3MuZW50ZXJDYXRlZ29yeU5hbWUnKSxcblx0XHRcdCcnLFxuXHRcdFx0KG5hbWUpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMudHJlZVtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudHJlZVtuYW1lXSA9IHt9O1xuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5re75Yqg5a2Q5YiG57G7XG5cdCAqL1xuXHRwcml2YXRlIGFkZENoaWxkQ2F0ZWdvcnkocGFyZW50UGF0aDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zaG93UHJvbXB0TW9kYWwoXG5cdFx0XHR0KCdzZXR0aW5ncy5lbnRlckNhdGVnb3J5TmFtZScpLFxuXHRcdFx0JycsXG5cdFx0XHQobmFtZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLmdldE5vZGVCeVBhdGgocGFyZW50UGF0aCk7XG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGFyZW50W25hbWVdID0ge307XG5cdFx0XHRcdHRoaXMuZXhwYW5kZWROb2Rlcy5hZGQocGFyZW50UGF0aCk7XG5cdFx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDnvJbovpHoioLngrnlkI3np7Bcblx0ICovXG5cdHByaXZhdGUgZWRpdE5vZGUocGF0aDogc3RyaW5nLCBvbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNob3dQcm9tcHRNb2RhbChcblx0XHRcdHQoJ3NldHRpbmdzLmVudGVyTmV3TmFtZScpLFxuXHRcdFx0b2xkTmFtZSxcblx0XHRcdChuZXdOYW1lKSA9PiB7XG5cdFx0XHRcdGlmICghbmV3TmFtZSB8fCBuZXdOYW1lLnRyaW0oKSA9PT0gJycgfHwgbmV3TmFtZSA9PT0gb2xkTmFtZSkgcmV0dXJuO1xuXG5cdFx0XHRcdGNvbnN0IHBhdGhQYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRQYXRoID8gdGhpcy5nZXROb2RlQnlQYXRoKHBhcmVudFBhdGgpIDogdGhpcy50cmVlO1xuXG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuZXdOYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8g6YeN5ZG95ZCNXG5cdFx0XHRcdHBhcmVudFtuZXdOYW1lXSA9IHBhcmVudFtvbGROYW1lXTtcblx0XHRcdFx0ZGVsZXRlIHBhcmVudFtvbGROYW1lXTtcblxuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5Yig6Zmk6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGRlbGV0ZU5vZGUocGF0aDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGhhc0NoaWxkcmVuOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGhhc0NoaWxkcmVuXG5cdFx0XHQ/IHQoJ3NldHRpbmdzLmNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW4nKVxuXHRcdFx0OiB0KCdzZXR0aW5ncy5jb25maXJtRGVsZXRlJyk7XG5cblx0XHR0aGlzLnNob3dDb25maXJtTW9kYWwobWVzc2FnZSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gcGFyZW50UGF0aCA/IHRoaXMuZ2V0Tm9kZUJ5UGF0aChwYXJlbnRQYXRoKSA6IHRoaXMudHJlZTtcblxuXHRcdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdFx0ZGVsZXRlIHBhcmVudFtuYW1lXTtcblx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5qC55o2u6Lev5b6E6I635Y+W6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGdldE5vZGVCeVBhdGgocGF0aDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgYW55PiB8IG51bGwge1xuXHRcdGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdGxldCBjdXJyZW50OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0gdGhpcy50cmVlO1xuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG5cdFx0XHRpZiAoIWN1cnJlbnRbcGFydF0pIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50ID0gY3VycmVudFtwYXJ0XTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY3VycmVudDtcblx0fVxuXG5cdC8qKlxuXHQgKiDpgJrnn6XlpJbpg6jmoJHlt7Lmm7TmlrBcblx0ICovXG5cdHByaXZhdGUgbm90aWZ5Q2hhbmdlKCk6IHZvaWQge1xuXHRcdHRoaXMub25DaGFuZ2UodGhpcy50cmVlKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOabtOaWsOagkeaVsOaNru+8iOWklumDqOiwg+eUqO+8iVxuXHQgKi9cblx0dXBkYXRlVHJlZShuZXdUcmVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogdm9pZCB7XG5cdFx0dGhpcy50cmVlID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShuZXdUcmVlKSk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmmL7npLrovpPlhaXlr7nor53moYZcblx0ICovXG5cdHByaXZhdGUgc2hvd1Byb21wdE1vZGFsKFxuXHRcdHBsYWNlaG9sZGVyOiBzdHJpbmcsXG5cdFx0ZGVmYXVsdFZhbHVlOiBzdHJpbmcsXG5cdFx0b25TdWJtaXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkXG5cdCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGFsID0gbmV3IElucHV0TW9kYWwoXG5cdFx0XHRwbGFjZWhvbGRlcixcblx0XHRcdGRlZmF1bHRWYWx1ZSxcblx0XHRcdG9uU3VibWl0XG5cdFx0KTtcblx0XHRtb2RhbC5vcGVuKCk7XG5cdH1cblxuXHQvKipcblx0ICog5pi+56S656Gu6K6k5a+56K+d5qGGXG5cdCAqL1xuXHRwcml2YXRlIHNob3dDb25maXJtTW9kYWwoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdG9uQ29uZmlybTogKCkgPT4gdm9pZFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RhbCA9IG5ldyBDb25maXJtTW9kYWwoXG5cdFx0XHRtZXNzYWdlLFxuXHRcdFx0b25Db25maXJtXG5cdFx0KTtcblx0XHRtb2RhbC5vcGVuKCk7XG5cdH1cbn1cblxuLyoqXG4gKiDovpPlhaXlr7nor53moYZcbiAqL1xuY2xhc3MgSW5wdXRNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBwbGFjZWhvbGRlcjogc3RyaW5nO1xuXHRwcml2YXRlIGRlZmF1bHRWYWx1ZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uU3VibWl0OiAodmFsdWU6IHN0cmluZykgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwbGFjZWhvbGRlcjogc3RyaW5nLFxuXHRcdGRlZmF1bHRWYWx1ZTogc3RyaW5nLFxuXHRcdG9uU3VibWl0OiAodmFsdWU6IHN0cmluZykgPT4gdm9pZFxuXHQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0XHR0aGlzLmRlZmF1bHRWYWx1ZSA9IGRlZmF1bHRWYWx1ZTtcblx0XHR0aGlzLm9uU3VibWl0ID0gb25TdWJtaXQ7XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLnBsYWNlaG9sZGVyIH0pO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjb250ZW50RWwuY3JlYXRlRWwoJ2lucHV0Jywge1xuXHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0dmFsdWU6IHRoaXMuZGVmYXVsdFZhbHVlXG5cdFx0fSk7XG5cblx0XHRpbnB1dC5zdHlsZS53aWR0aCA9ICcxMDAlJztcblx0XHRpbnB1dC5zdHlsZS5tYXJnaW5Cb3R0b20gPSAnMjBweCc7XG5cblx0XHQvLyDnm5HlkKzlm57ovabplK5cblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGUpID0+IHtcblx0XHRcdGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuXHRcdFx0XHR0aGlzLm9uU3VibWl0KGlucHV0LnZhbHVlKTtcblx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYnV0dG9uc0VsID0gY29udGVudEVsLmNyZWF0ZURpdignbW9kYWwtYnV0dG9uLWNvbnRhaW5lcicpO1xuXHRcdGJ1dHRvbnNFbC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdGJ1dHRvbnNFbC5zdHlsZS5qdXN0aWZ5Q29udGVudCA9ICdmbGV4LWVuZCc7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmdhcCA9ICc4cHgnO1xuXG5cdFx0Y29uc3QgY2FuY2VsQnRuID0gYnV0dG9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7IHRleHQ6ICflj5bmtognIH0pO1xuXHRcdGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuY2xvc2UoKSk7XG5cblx0XHRjb25zdCBjb25maXJtQnRuID0gYnV0dG9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHR0ZXh0OiAn56Gu5a6aJyxcblx0XHRcdGNsczogJ21vZC1jdGEnXG5cdFx0fSk7XG5cdFx0Y29uZmlybUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMub25TdWJtaXQoaW5wdXQudmFsdWUpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0Ly8g6Ieq5Yqo6IGa54SmXG5cdFx0aW5wdXQuZm9jdXMoKTtcblx0XHRpbnB1dC5zZWxlY3QoKTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cblxuLyoqXG4gKiDnoa7orqTlr7nor53moYZcbiAqL1xuY2xhc3MgQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwcml2YXRlIG1lc3NhZ2U6IHN0cmluZztcblx0cHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdG9uQ29uZmlybTogKCkgPT4gdm9pZFxuXHQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5vbkNvbmZpcm0gPSBvbkNvbmZpcm07XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLm1lc3NhZ2UgfSk7XG5cblx0XHRjb25zdCBidXR0b25zRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KCdtb2RhbC1idXR0b24tY29udGFpbmVyJyk7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmp1c3RpZnlDb250ZW50ID0gJ2ZsZXgtZW5kJztcblx0XHRidXR0b25zRWwuc3R5bGUuZ2FwID0gJzhweCc7XG5cblx0XHRjb25zdCBjYW5jZWxCdG4gPSBidXR0b25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgdGV4dDogJ+WPlua2iCcgfSk7XG5cdFx0Y2FuY2VsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5jbG9zZSgpKTtcblxuXHRcdGNvbnN0IGNvbmZpcm1CdG4gPSBidXR0b25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICfnoa7lrponLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oKTtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgQUlDbGFzc2lmaWVyUGx1Z2luIGZyb20gJy4uL21haW4nO1xuaW1wb3J0IHsgQUlQcm92aWRlclR5cGUsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgQ2F0ZWdvcnlUcmVlVmlldyB9IGZyb20gJy4vQ2F0ZWdvcnlUcmVlVmlldyc7XG5cbi8vIOWQhOacjeWKoeWVhuWPr+eUqOaooeWei+WIl+ihqFxuY29uc3QgQVZBSUxBQkxFX01PREVMUzogUmVjb3JkPHN0cmluZywgQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+PiA9IHtcblx0b3BlbmFpOiBbXG5cdFx0eyB2YWx1ZTogJ2dwdC00by1taW5pJywgbGFiZWw6ICdHUFQtNG8gTWluaSAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTRvJywgbGFiZWw6ICdHUFQtNG8nIH0sXG5cdFx0eyB2YWx1ZTogJ2dwdC00LXR1cmJvJywgbGFiZWw6ICdHUFQtNCBUdXJibycgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTMuNS10dXJibycsIGxhYmVsOiAnR1BULTMuNSBUdXJibycgfSxcblx0XSxcblx0ZGVlcHNlZWs6IFtcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY2hhdCcsIGxhYmVsOiAnRGVlcFNlZWsgQ2hhdCAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY29kZXInLCBsYWJlbDogJ0RlZXBTZWVrIENvZGVyJyB9LFxuXHRdLFxuXHRtb29uc2hvdDogW1xuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS04aycsIGxhYmVsOiAnTW9vbnNob3QgVjEgOEsgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ21vb25zaG90LXYxLTMyaycsIGxhYmVsOiAnTW9vbnNob3QgVjEgMzJLJyB9LFxuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS0xMjhrJywgbGFiZWw6ICdNb29uc2hvdCBWMSAxMjhLJyB9LFxuXHRdLFxuXHR6aGlwdTogW1xuXHRcdHsgdmFsdWU6ICdnbG0tNCcsIGxhYmVsOiAnR0xNLTQgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ2dsbS00LWZsYXNoJywgbGFiZWw6ICdHTE0tNCBGbGFzaCcgfSxcblx0XHR7IHZhbHVlOiAnZ2xtLTMtdHVyYm8nLCBsYWJlbDogJ0dMTS0zIFR1cmJvJyB9LFxuXHRdLFxufTtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luO1xuXHRcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cdFxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHRcblx0XHQvLyDpobbpg6jlr7zoiKrmoI9cblx0XHRjb25zdCBoZWFkZXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignc2V0dGluZ3MtaGVhZGVyJyk7XG5cdFx0aGVhZGVyRWwuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEycHg7IG1hcmdpbi1ib3R0b206IDIwcHg7Jztcblx0XHRcblx0XHQvLyDov5Tlm57mjInpkq5cblx0XHRjb25zdCBiYWNrQnRuID0gaGVhZGVyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdGNsczogJ2NsaWNrYWJsZS1pY29uJyxcblx0XHRcdGF0dHI6IHtcblx0XHRcdFx0J2FyaWEtbGFiZWwnOiAn6L+U5Zue5LiK5LiA57qnJyxcblx0XHRcdFx0J3RpdGxlJzogJ+i/lOWbnuS4iuS4gOe6pydcblx0XHRcdH1cblx0XHR9KTtcblx0XHRiYWNrQnRuLmlubmVySFRNTCA9ICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjI0XCIgaGVpZ2h0PVwiMjRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIm0xNSAxOC02LTYgNi02XCIvPjwvc3ZnPic7XG5cdFx0YmFja0J0bi5zdHlsZS5jc3NUZXh0ID0gJ2JhY2tncm91bmQ6IG5vbmU7IGJvcmRlcjogbm9uZTsgY3Vyc29yOiBwb2ludGVyOyBwYWRkaW5nOiA0cHg7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyOyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7Jztcblx0XHRiYWNrQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0Ly8g55u05o6l6Kem5Y+RIE9ic2lkaWFuIOiHquW4pueahOi/lOWbnuWKn+iDvVxuXHRcdFx0Ly8g5p+l5om+6K6+572u5L6n6L655qCP5Lit55qE56ys5LiA5Liq5o+S5Lu26YCJ6aG55bm254K55Ye7XG5cdFx0XHRjb25zdCBjb21tdW5pdHlQbHVnaW5OYXZJdGVtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm5hdi1mb2xkZXIubW9kLXJvb3QgPiAubmF2LWZvbGRlci10aXRsZScpO1xuXHRcdFx0aWYgKGNvbW11bml0eVBsdWdpbk5hdkl0ZW0pIHtcblx0XHRcdFx0KGNvbW11bml0eVBsdWdpbk5hdkl0ZW0gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyDlpoLmnpzmib7kuI3liLDvvIzlsJ3or5Xngrnlh7vku7vkvZXkuIDkuKrkvqfovrnmoI/poblcblx0XHRcdFx0Y29uc3QgYW55TmF2SXRlbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy52ZXJ0aWNhbC10YWItbmF2LWl0ZW0nKTtcblx0XHRcdFx0aWYgKGFueU5hdkl0ZW0pIHtcblx0XHRcdFx0XHQoYW55TmF2SXRlbSBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGJhY2tCdG4uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgKCkgPT4ge1xuXHRcdFx0YmFja0J0bi5zdHlsZS5jb2xvciA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuXHRcdH0pO1xuXHRcdGJhY2tCdG4uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdXQnLCAoKSA9PiB7XG5cdFx0XHRiYWNrQnRuLnN0eWxlLmNvbG9yID0gJ3ZhcigtLXRleHQtbXV0ZWQpJztcblx0XHR9KTtcblx0XHRcblx0XHQvLyDmoIfpophcblx0XHRjb25zdCB0aXRsZUVsID0gaGVhZGVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiB0KCdzZXR0aW5ncy50aXRsZScpIH0pO1xuXHRcdHRpdGxlRWwuc3R5bGUuY3NzVGV4dCA9ICdtYXJnaW46IDA7IGZsZXg6IDE7Jztcblx0XHRcblx0XHR0aGlzLmFkZEFJUHJvdmlkZXJTZWN0aW9uKCk7XG5cdFx0dGhpcy5hZGRDYXRlZ29yeVNlY3Rpb24oKTtcblx0XHR0aGlzLmFkZEFkdmFuY2VkU2VjdGlvbigpO1xuXHRcdHRoaXMuYWRkRGVidWdTZWN0aW9uKCk7XG5cdH1cblx0XG5cdHByaXZhdGUgYWRkQUlQcm92aWRlclNlY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdBSSDphY3nva4nIH0pO1xuXHRcdFxuXHRcdC8vIEFJIOaPkOS+m+WVhumAieaLqVxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuYWlQcm92aWRlcicpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuYWlQcm92aWRlckRlc2MnKSlcblx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignb2xsYW1hJywgJ09sbGFtYSAo5pys5ZywKScpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignb3BlbmFpJywgJ09wZW5BSScpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignZGVlcHNlZWsnLCAnRGVlcFNlZWsnKVxuXHRcdFx0XHRcdC5hZGRPcHRpb24oJ21vb25zaG90JywgJ01vb25zaG90IChLaW1pKScpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignemhpcHUnLCAnWmhpcHUgKOaZuuiwsSBBSSknKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIgPSB2YWx1ZSBhcyBBSVByb3ZpZGVyVHlwZTtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciA9PT0gJ29sbGFtYScpIHtcblx0XHRcdC8vIE9sbGFtYSDphY3nva5cblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5vbGxhbWFVcmwnKSlcblx0XHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3Mub2xsYW1hVXJsRGVzYycpKVxuXHRcdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm9sbGFtYVVybClcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hVXJsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3Mub2xsYW1hTW9kZWwnKSlcblx0XHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3Mub2xsYW1hTW9kZWxEZXNjJykpXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwpXG5cdFx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm9sbGFtYU1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBUEkgS2V5IOmFjee9rlxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIEtleWApXG5cdFx0XHRcdC5zZXREZXNjKGDor7fovpPlhaUgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOeahCBBUEkgS2V5YClcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLmdldFByb3ZpZGVyVmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2FwaUtleScpKVxuXHRcdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdzay0uLi4nKVxuXHRcdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb3ZpZGVyQ29uZmlnKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdhcGlLZXknLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLnR5cGUgPSAncGFzc3dvcmQnO1xuXHRcdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gTW9kZWwg6YWN572u77yI5LiL5ouJ6YCJ5oup77yJXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUoYCR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSDmqKHlnotgKVxuXHRcdFx0XHQuc2V0RGVzYyhg6K+36YCJ5oupICR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSDnmoTmqKHlnotgKVxuXHRcdFx0XHQuYWRkRHJvcGRvd24oZHJvcGRvd24gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVscyA9IHRoaXMuZ2V0QXZhaWxhYmxlTW9kZWxzKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpO1xuXHRcdFx0XHRcdG1vZGVscy5mb3JFYWNoKG1vZGVsID0+IHtcblx0XHRcdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihtb2RlbC52YWx1ZSwgbW9kZWwubGFiZWwpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuZ2V0UHJvdmlkZXJWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnbW9kZWwnKSlcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlckNvbmZpZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnbW9kZWwnLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyBBUEkgVVJMIOmFjee9ru+8iOmrmOe6p+mAiemhue+8iVxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIOWcsOWdgGApXG5cdFx0XHRcdC5zZXREZXNjKCfoh6rlrprkuYkgQVBJIOerr+eCueWcsOWdgO+8iOWPr+mAie+8jOeVmeepuuS9v+eUqOWumOaWueWcsOWdgO+8iScpXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5nZXRQcm92aWRlclZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdiYXNlVXJsJykpXG5cdFx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ2h0dHBzOi8vYXBpLmV4YW1wbGUuY29tL3YxJylcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlckNvbmZpZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnYmFzZVVybCcsIHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOa1i+ivlei/nuaOpeaMiemSrlxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LmFkZEJ1dHRvbihidXR0b24gPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dCh0KCdzZXR0aW5ncy50ZXN0Q29ubmVjdGlvbicpKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGJ1dHRvbi5zZXREaXNhYmxlZCh0cnVlKTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wbHVnaW4uZ2V0QUlQcm92aWRlcigpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci50ZXN0Q29ubmVjdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdFx0XHRuZXcgTm90aWNlKHQoJ3NldHRpbmdzLmNvbm5lY3Rpb25TdWNjZXNzJykpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvbkZhaWxlZCcpICsgcmVzdWx0Lm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvbkZhaWxlZCcpICsgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLnNldERpc2FibGVkKGZhbHNlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZENhdGVnb3J5U2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ+WIhuexu+mFjee9ricgfSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5pbmJveEZvbGRlcicpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuaW5ib3hGb2xkZXJEZXNjJykpXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmJveEZvbGRlcilcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmJveEZvbGRlciA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCfmiavmj4/lrZDmlofku7blpLknKVxuXHRcdFx0LnNldERlc2MoJ+aYr+WQpumAkuW9kuaJq+aPj+aUtuS7tueuseWtkOebruW9leS4reeahOaWh+S7tuOAguWFs+mXreWImeWPquWIhuexu+aUtuS7tueusemhtuWxgueahOaWh+S7tuOAgicpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycyA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHQvLyDlj6/op4bljJbliIbnsbvmoJFcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6IHQoJ3NldHRpbmdzLmNhdGVnb3J5VHJlZScpIH0pO1xuXHRcdFxuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtd3JhcHBlcicpO1xuXHRcdFxuXHRcdG5ldyBDYXRlZ29yeVRyZWVWaWV3KFxuXHRcdFx0dHJlZUNvbnRhaW5lcixcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSxcblx0XHRcdChuZXdUcmVlKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSA9IG5ld1RyZWU7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKG5ld1RyZWUpO1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH1cblx0XHQpO1xuXHRcdFxuXHRcdC8vIOaTjeS9nOaMiemSrlxuXHRcdGNvbnN0IGFjdGlvbnNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignY2F0ZWdvcnktdHJlZS1mb290ZXInKTtcblx0XHRuZXcgU2V0dGluZyhhY3Rpb25zRWwpXG5cdFx0XHQuYWRkQnV0dG9uKGJ0biA9PiB7XG5cdFx0XHRcdGJ0bi5zZXRCdXR0b25UZXh0KHQoJ3NldHRpbmdzLnJlc3RvcmVEZWZhdWx0JykpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGNvbmZpcm0odCgnc2V0dGluZ3MuY29uZmlybVJlc3RvcmVEZWZhdWx0JykpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSA9IERFRkFVTFRfU0VUVElOR1MuY2F0ZWdvcnlUcmVlO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyhERUZBVUxUX1NFVFRJTkdTLmNhdGVnb3J5VHJlZSk7XG5cdFx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpOyAvLyDliLfmlrDorr7nva7pnaLmnb9cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZEFkdmFuY2VkU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ+mrmOe6p+iuvue9ricgfSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzRGVzYycpKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0XHR0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuYXV0b01vdmVGaWxlJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5hdXRvTW92ZUZpbGVEZXNjJykpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b01vdmVGaWxlID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCcpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZERlc2MnKSlcblx0XHRcdC5hZGRTbGlkZXIoc2xpZGVyID0+IHtcblx0XHRcdFx0c2xpZGVyLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGQgKiAxMDApXG5cdFx0XHRcdFx0LnNldExpbWl0cygwLCAxMDAsIDEpXG5cdFx0XHRcdFx0LnNldER5bmFtaWNUb29sdGlwKClcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkID0gdmFsdWUgLyAxMDA7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZERlYnVnU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ+iwg+ivlScgfSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZycpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuZW5hYmxlRGVidWdMb2dEZXNjJykpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBmbGF0dGVuQ2F0ZWdvcmllcyh0cmVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcHJlZml4ID0gJycpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRyZWUpKSB7XG5cdFx0XHRjb25zdCBwYXRoID0gcHJlZml4ID8gYCR7cHJlZml4fS8ke2tleX1gIDoga2V5O1xuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goLi4udGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcGF0aCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblx0XG5cdHByaXZhdGUgZ2V0QXZhaWxhYmxlTW9kZWxzKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSk6IEFycmF5PHsgdmFsdWU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9PiB7XG5cdFx0cmV0dXJuIEFWQUlMQUJMRV9NT0RFTFNbcHJvdmlkZXJdIHx8IFtdO1xuXHR9XG5cdFxuXHRwcml2YXRlIGdldFByb3ZpZGVyRGlzcGxheU5hbWUocHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOiByZXR1cm4gJ09wZW5BSSc7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6IHJldHVybiAnRGVlcFNlZWsnO1xuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOiByZXR1cm4gJ01vb25zaG90IChLaW1pKSc7XG5cdFx0XHRjYXNlICd6aGlwdSc6IHJldHVybiAnWmhpcHUgKOaZuuiwsSknO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICdPbGxhbWEnO1xuXHRcdH1cblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRQcm92aWRlclZhbHVlKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSwga2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5O1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnbW9kZWwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWw7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdiYXNlVXJsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla01vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdE1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRDdXJyZW50UHJvdmlkZXJDb25maWcoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyO1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ09wZW5BSScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnRGVlcFNlZWsnLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ01vb25zaG90IChLaW1pKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ3poaXB1Jzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnWmhpcHUgKOaZuuiwsSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBQcm92aWRlcjogJHtwcm92aWRlcn1gKTtcblx0XHR9XG5cdH1cblx0XG5cdHByaXZhdGUgdXBkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXI6IHN0cmluZywga2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtNb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdiYXNlVXJsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdtb2RlbCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90TW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnbW9kZWwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIOS7jiBPYnNpZGlhbiDmlofku7bkuK3mj5Dlj5blhoXlrrlcbiAqL1xuZXhwb3J0IGNsYXNzIENvbnRlbnRFeHRyYWN0b3Ige1xuXHQvKipcblx0ICog5o+Q5Y+W5paH5Lu25YaF5a6577yI5pSv5oyBIE1hcmtkb3duIOWSjOe6r+aWh+acrO+8iVxuXHQgKi9cblx0YXN5bmMgZXh0cmFjdChmaWxlOiBURmlsZSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDlr7nkuo7lpJbpg6jpk77mjqXmlofku7bvvIzlj6/og73pnIDopoHnibnmrorlpITnkIZcblx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGZpbGUudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY2xlYW5Db250ZW50KGNvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcign5o+Q5Y+W5paH5Lu25YaF5a655aSx6LSlOicsIGUpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog6I635Y+W5paH5Lu25qCH6aKYXG5cdCAqL1xuXHRnZXRUaXRsZShmaWxlOiBURmlsZSk6IHN0cmluZyB7XG5cdFx0Ly8g5LyY5YWI5L2/55So5paH5Lu25ZCN77yI5LiN5ZCr5omp5bGV5ZCN77yJXG5cdFx0cmV0dXJuIGZpbGUuYmFzZW5hbWU7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDmuIXnkIblhoXlrrnvvIznp7vpmaTkuI3lv4XopoHnmoTpg6jliIZcblx0ICovXG5cdHByaXZhdGUgY2xlYW5Db250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGNvbnRlbnRcblx0XHRcdC8vIOenu+mZpCBZQU1MIGZyb250bWF0dGVyXG5cdFx0XHQucmVwbGFjZSgvXi0tLVtcXHNcXFNdKj8tLS1cXG4/LywgJycpXG5cdFx0XHQvLyDnp7vpmaQgSFRNTCDms6jph4pcblx0XHRcdC5yZXBsYWNlKC88IS0tW1xcc1xcU10qPy0tPi9nLCAnJylcblx0XHRcdC8vIOenu+mZpOS7o+eggeWdl++8iOS/neeVmeivreiogOagh+iusO+8iVxuXHRcdFx0LnJlcGxhY2UoL2BgYFtcXHNcXFNdKj9gYGAvZywgKG1hdGNoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxhbmdNYXRjaCA9IG1hdGNoLm1hdGNoKC9gYGAoXFx3KikvKTtcblx0XHRcdFx0Y29uc3QgbGFuZyA9IGxhbmdNYXRjaCA/IGxhbmdNYXRjaFsxXSA6ICcnO1xuXHRcdFx0XHRyZXR1cm4gYFvku6PnoIHlnZc6ICR7bGFuZ31dYDtcblx0XHRcdH0pXG5cdFx0XHQvLyDnp7vpmaTlm77niYflkozpk77mjqXvvIzkv53nlZkgYWx0IHRleHRcblx0XHRcdC5yZXBsYWNlKC8hXFxbKFteXFxdXSopXFxdXFwoW14pXSpcXCkvZywgJ1skMV0nKVxuXHRcdFx0LnJlcGxhY2UoL1xcWyhbXlxcXV0rKVxcXVxcKFteKV0qXFwpL2csICckMScpXG5cdFx0XHQvLyDnp7vpmaTlpJrkvZnnqbrooYxcblx0XHRcdC5yZXBsYWNlKC9cXG57Myx9L2csICdcXG5cXG4nKVxuXHRcdFx0LnRyaW0oKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOeUn+aIkOWGheWuueaRmOimge+8iOeUqOS6jiBBSSDliIbmnpDvvIlcblx0ICovXG5cdGdlbmVyYXRlU3VtbWFyeShjb250ZW50OiBzdHJpbmcsIG1heExlbmd0aCA9IDIwMDApOiBzdHJpbmcge1xuXHRcdGlmIChjb250ZW50Lmxlbmd0aCA8PSBtYXhMZW5ndGgpIHtcblx0XHRcdHJldHVybiBjb250ZW50O1xuXHRcdH1cblx0XHRcblx0XHQvLyDlsJ3or5XlnKjlj6XlrZDovrnnlYzlpITmiKrmlq1cblx0XHRjb25zdCB0cnVuY2F0ZWQgPSBjb250ZW50LnNsaWNlKDAsIG1heExlbmd0aCk7XG5cdFx0Y29uc3QgbGFzdFBlcmlvZCA9IHRydW5jYXRlZC5sYXN0SW5kZXhPZign44CCJyk7XG5cdFx0Y29uc3QgbGFzdE5ld2xpbmUgPSB0cnVuY2F0ZWQubGFzdEluZGV4T2YoJ1xcbicpO1xuXHRcdFxuXHRcdGNvbnN0IGJyZWFrUG9pbnQgPSBNYXRoLm1heChsYXN0UGVyaW9kLCBsYXN0TmV3bGluZSk7XG5cdFx0XG5cdFx0aWYgKGJyZWFrUG9pbnQgPiBtYXhMZW5ndGggKiAwLjcpIHtcblx0XHRcdHJldHVybiB0cnVuY2F0ZWQuc2xpY2UoMCwgYnJlYWtQb2ludCArIDEpO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gdHJ1bmNhdGVkICsgJy4uLic7XG5cdH1cbn1cbiIsImltcG9ydCB7IFRGaWxlLCBWYXVsdCB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiDmlofku7bmk43kvZzlt6XlhbdcbiAqL1xuZXhwb3J0IGNvbnN0IGZpbGVPcHMgPSB7XG5cdC8qKlxuXHQgKiDmnoTlu7rliIbnsbvot6/lvoRcblx0ICovXG5cdGJ1aWxkQ2F0ZWdvcnlQYXRoKGNhdGVnb3J5OiBzdHJpbmcsIGluYm94Rm9sZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdC8vIOWwhuWIhuexu+i3r+W+hOS4reeahCBcIi9cIiDovazmjaLkuLogVmF1bHQg5Lit55qE5paH5Lu25aS55YiG6ZqU56ymXG5cdFx0Y29uc3Qgbm9ybWFsaXplZENhdGVnb3J5ID0gY2F0ZWdvcnkucmVwbGFjZSgvXFwvL2csICcvJyk7XG5cdFx0cmV0dXJuIGAke2luYm94Rm9sZGVyfS8ke25vcm1hbGl6ZWRDYXRlZ29yeX1gO1xuXHR9LFxuXHRcblx0LyoqXG5cdCAqIOenu+WKqOaWh+S7tuWIsOebruagh+i3r+W+hFxuXHQgKi9cblx0YXN5bmMgbW92ZUZpbGUoZmlsZTogVEZpbGUsIG5ld0ZvbGRlclBhdGg6IHN0cmluZyk6IFByb21pc2U8VEZpbGU+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdmF1bHQgPSBmaWxlLnZhdWx0O1xuXHRcdFx0Y29uc3QgYWRhcHRlciA9IHZhdWx0LmFkYXB0ZXI7XG5cdFx0XHRcblx0XHRcdC8vIOehruS/neebruagh+aWh+S7tuWkueWtmOWcqO+8iOWkhOeQhuernuaAgeadoeS7tu+8iVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKCFhd2FpdCBhZGFwdGVyLmV4aXN0cyhuZXdGb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRcdGF3YWl0IHZhdWx0LmNyZWF0ZUZvbGRlcihuZXdGb2xkZXJQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZm9sZGVyRXJyb3I6IHVua25vd24pIHtcblx0XHRcdFx0Ly8g5aaC5p6c5paH5Lu25aS55bey5a2Y5Zyo77yM5b+955Wl6ZSZ6K+vXG5cdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gKGZvbGRlckVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZSB8fCAnJztcblx0XHRcdFx0aWYgKCFlcnJvck1zZy5pbmNsdWRlcygnYWxyZWFkeSBleGlzdHMnKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihg5Yib5bu65paH5Lu25aS55aSx6LSlOiAke2Vycm9yTXNnfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOaehOW7uuaWsOaWh+S7tui3r+W+hFxuXHRcdFx0Y29uc3QgbmV3UGF0aCA9IGAke25ld0ZvbGRlclBhdGh9LyR7ZmlsZS5uYW1lfWA7XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOebruagh+i3r+W+hOebuOWQjO+8jOS4jeenu+WKqFxuXHRcdFx0aWYgKGZpbGUucGF0aCA9PT0gbmV3UGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gZmlsZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5qOA5p+l55uu5qCH5paH5Lu25piv5ZCm5bey5a2Y5ZyoXG5cdFx0XHRpZiAoYXdhaXQgYWRhcHRlci5leGlzdHMobmV3UGF0aCkpIHtcblx0XHRcdFx0Ly8g5paH5Lu25bey5a2Y5Zyo77yM5re75Yqg5pe26Ze05oiz5ZCO57yAXG5cdFx0XHRcdGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG5cdFx0XHRcdGNvbnN0IGV4dCA9IGZpbGUuZXh0ZW5zaW9uO1xuXHRcdFx0XHRjb25zdCBiYXNlTmFtZSA9IGZpbGUuYmFzZW5hbWU7XG5cdFx0XHRcdGNvbnN0IHVuaXF1ZU5ld1BhdGggPSBgJHtuZXdGb2xkZXJQYXRofS8ke2Jhc2VOYW1lfV8ke3RpbWVzdGFtcH0uJHtleHR9YDtcblx0XHRcdFx0XG5cdFx0XHRcdGF3YWl0IHZhdWx0LnJlbmFtZShmaWxlLCB1bmlxdWVOZXdQYXRoKTtcblx0XHRcdFx0Y29uc3QgbmV3RmlsZSA9IHZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh1bmlxdWVOZXdQYXRoKSBhcyBURmlsZTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmICghbmV3RmlsZSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcign56e75Yqo5ZCO5peg5rOV5om+5Yiw5paH5Lu2Jyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHJldHVybiBuZXdGaWxlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDmiafooYznp7vliqhcblx0XHRcdGF3YWl0IHZhdWx0LnJlbmFtZShmaWxlLCBuZXdQYXRoKTtcblx0XHRcdFxuXHRcdFx0Ly8g6L+U5Zue5paw55qE5paH5Lu25byV55SoXG5cdFx0XHRjb25zdCBuZXdGaWxlID0gdmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5ld1BhdGgpO1xuXHRcdFx0XG5cdFx0XHRpZiAoIShuZXdGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcign56e75Yqo5ZCO5peg5rOV5om+5Yiw5paH5Lu2Jyk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiBuZXdGaWxlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gZSBhcyBFcnJvcjtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ+enu+WKqOaWh+S7tuWksei0pTonLCBlcnJvcik7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOenu+WKqOaWh+S7tuWksei0pTogJHtlcnJvci5tZXNzYWdlfWApO1xuXHRcdH1cblx0fSxcblx0XG5cdC8qKlxuXHQgKiDojrflj5bmlofku7blkI3vvIjkuI3lkKvmianlsZXlkI3vvIlcblx0ICovXG5cdGdldEJhc2VuYW1lKGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZmlsZS5iYXNlbmFtZTtcblx0fSxcblx0XG5cdC8qKlxuXHQgKiDmo4Dmn6Xmlofku7bmmK/lkKblrZjlnKjkuo7mjIflrprot6/lvoRcblx0ICovXG5cdGFzeW5jIGV4aXN0cyh2YXVsdDogVmF1bHQsIHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBhd2FpdCB2YXVsdC5hZGFwdGVyLmV4aXN0cyhwYXRoKTtcblx0fSxcblx0XG5cdC8qKlxuXHQgKiDnoa7kv53mlofku7blpLnlrZjlnKjvvIzkuI3lrZjlnKjliJnliJvlu7pcblx0ICovXG5cdGFzeW5jIGVuc3VyZUZvbGRlcih2YXVsdDogVmF1bHQsIGZvbGRlclBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAoIWF3YWl0IHZhdWx0LmFkYXB0ZXIuZXhpc3RzKGZvbGRlclBhdGgpKSB7XG5cdFx0XHRcdGF3YWl0IHZhdWx0LmNyZWF0ZUZvbGRlcihmb2xkZXJQYXRoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7IC8vIOi/lOWbniB0cnVlIOihqOekuuaWsOWIm+W7uuS6huaWh+S7tuWkuVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyDov5Tlm54gZmFsc2Ug6KGo56S65paH5Lu25aS55bey5a2Y5ZyoXG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcign5Yib5bu65paH5Lu25aS55aSx6LSlOicsIGUpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH0sXG59O1xuIiwiaW1wb3J0IHsgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCwgUGx1Z2luU2V0dGluZ3MgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHsgQ29udGVudEV4dHJhY3RvciB9IGZyb20gJy4vQ29udGVudEV4dHJhY3Rvcic7XG5pbXBvcnQgeyBmaWxlT3BzIH0gZnJvbSAnLi4vdXRpbHMvZmlsZU9wcyc7XG5cbmV4cG9ydCBjbGFzcyBDbGFzc2lmaWVyIHtcblx0cHJpdmF0ZSBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG5cdHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG5cdHByaXZhdGUgY29udGVudEV4dHJhY3RvcjogQ29udGVudEV4dHJhY3Rvcjtcblx0XG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdFx0dGhpcy5jb250ZW50RXh0cmFjdG9yID0gbmV3IENvbnRlbnRFeHRyYWN0b3IoKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+WNleS4quaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlGaWxlKFxuXHRcdGZpbGU6IFRGaWxlLFxuXHRcdGFpUHJvdmlkZXI6IEFJUHJvdmlkZXIsXG5cdFx0b25Qcm9ncmVzcz86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWRcblx0KTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IHJlc3VsdD86IENsYXNzaWZpY2F0aW9uUmVzdWx0OyBlcnJvcj86IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdG9uUHJvZ3Jlc3M/Lihg5q2j5Zyo5YiG5p6QOiAke2ZpbGUuYmFzZW5hbWV9YCk7XG5cdFx0XHRcblx0XHRcdC8vIOaPkOWPluWGheWuuVxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuY29udGVudEV4dHJhY3Rvci5leHRyYWN0KGZpbGUpO1xuXHRcdFx0aWYgKCFjb250ZW50KSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ+aXoOazleaPkOWPluaWh+S7tuWGheWuuScgfTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Y29uc3QgdGl0bGUgPSB0aGlzLmNvbnRlbnRFeHRyYWN0b3IuZ2V0VGl0bGUoZmlsZSk7XG5cdFx0XHRcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDliIbnsbvmlofku7Y6ICR7ZmlsZS5wYXRofWApO1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOagh+mimDogJHt0aXRsZX1gKTtcblx0XHRcdFxuXHRcdFx0Ly8g6LCD55SoIEFJIOWIhuexu1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYWlQcm92aWRlci5jbGFzc2lmeShcblx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdHRoaXMuc2V0dGluZ3MuY2F0ZWdvcmllc1xuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOWIhuexu+e7k+aenDogJHtKU09OLnN0cmluZ2lmeShyZXN1bHQpfWApO1xuXHRcdFx0XG5cdFx0XHQvLyDmo4Dmn6Xnva7kv6HluqZcblx0XHRcdGlmIChyZXN1bHQuY29uZmlkZW5jZSA8IHRoaXMuc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCkge1xuXHRcdFx0XHRyZXN1bHQuaXNVbmNlcnRhaW4gPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg572u5L+h5bqm5L2O5LqO6ZiI5YC8OiAke3Jlc3VsdC5jb25maWRlbmNlfWApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiB0cnVlLCByZXN1bHQgfTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IChlIGFzIEVycm9yKS5tZXNzYWdlO1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOWIhuexu+Wksei0pTogJHtlcnJvcn1gKTtcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvciB9O1xuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+aUtuS7tueuseS4reeahOaJgOacieaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlJbmJveChcblx0XHRmaWxlczogVEZpbGVbXSxcblx0XHRhaVByb3ZpZGVyOiBBSVByb3ZpZGVyLFxuXHRcdG9uUHJvZ3Jlc3M/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkXG5cdCk6IFByb21pc2U8QXJyYXk8eyBmaWxlOiBURmlsZTsgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdDsgc3VjY2VzczogYm9vbGVhbiB9Pj4ge1xuXHRcdGNvbnN0IHJlc3VsdHM6IEFycmF5PHsgZmlsZTogVEZpbGU7IHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQ7IHN1Y2Nlc3M6IGJvb2xlYW4gfT4gPSBbXTtcblx0XHRcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2xhc3NpZnlGaWxlKGZpbGUsIGFpUHJvdmlkZXIsIG9uUHJvZ3Jlc3MpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0LnJlc3VsdCkge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGUsXG5cdFx0XHRcdFx0cmVzdWx0OiByZXN1bHQucmVzdWx0LFxuXHRcdFx0XHRcdHN1Y2Nlc3M6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRcdHJlc3VsdDoge1xuXHRcdFx0XHRcdFx0Y2F0ZWdvcnk6ICdPdGhlcicsXG5cdFx0XHRcdFx0XHRjb25maWRlbmNlOiAwLFxuXHRcdFx0XHRcdFx0cmVhc29uaW5nOiByZXN1bHQuZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InLFxuXHRcdFx0XHRcdFx0aXNVbmNlcnRhaW46IHRydWUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9XG5cdFxuXHQvKipcblx0ICog56e75Yqo5paH5Lu25Yiw5YiG57G755uu5b2VXG5cdCAqL1xuXHRhc3luYyBtb3ZlRmlsZShmaWxlOiBURmlsZSwgY2F0ZWdvcnk6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBuZXdQYXRoID0gZmlsZU9wcy5idWlsZENhdGVnb3J5UGF0aChjYXRlZ29yeSwgdGhpcy5zZXR0aW5ncy5pbmJveEZvbGRlcik7XG5cdFx0XHRhd2FpdCBmaWxlT3BzLm1vdmVGaWxlKGZpbGUsIG5ld1BhdGgpO1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOaWh+S7tuW3suenu+WKqDogJHtmaWxlLnBhdGh9IC0+ICR7bmV3UGF0aH1gKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGDnp7vliqjmlofku7blpLHotKU6ICR7KGUgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG5cdFx0XHR0aHJvdyBlOyAvLyDph43mlrDmipvlh7rplJnor6/vvIzorqnosIPnlKjmlrnlpITnkIZcblx0XHR9XG5cdH1cbn1cbiIsIi8qKlxuICog6ZSZ6K+v5aSE55CG5bel5YW3XG4gKiDmj5Dkvpvnu5/kuIDnmoTplJnor6/nsbvlnovlkozlpITnkIbmlrnms5VcbiAqL1xuaW1wb3J0IHsgcmVxdWVzdFVybCwgUmVxdWVzdFVybFBhcmFtLCBSZXNwb25zZSB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiDoh6rlrprkuYnplJnor6/nsbvlnotcbiAqL1xuZXhwb3J0IGNsYXNzIEFJQ2xhc3NpZmllckVycm9yIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0cHVibGljIHR5cGU6ICduZXR3b3JrJyB8ICd0aW1lb3V0JyB8ICdhdXRoJyB8ICdyYXRlX2xpbWl0JyB8ICd2YWxpZGF0aW9uJyB8ICdwYXJzZScgfCAndW5rbm93bicsXG5cdFx0cHVibGljIG9yaWdpbmFsRXJyb3I/OiBFcnJvclxuXHQpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLm5hbWUgPSAnQUlDbGFzc2lmaWVyRXJyb3InO1xuXHR9XG59XG5cbi8qKlxuICog6YeN6K+V6YWN572uXG4gKi9cbmludGVyZmFjZSBSZXRyeUNvbmZpZyB7XG5cdG1heEF0dGVtcHRzOiBudW1iZXI7XG5cdGluaXRpYWxEZWxheTogbnVtYmVyO1xuXHRtYXhEZWxheTogbnVtYmVyO1xuXHRiYWNrb2ZmRmFjdG9yOiBudW1iZXI7XG59XG5cbmNvbnN0IERFRkFVTFRfUkVUUllfQ09ORklHOiBSZXRyeUNvbmZpZyA9IHtcblx0bWF4QXR0ZW1wdHM6IDMsXG5cdGluaXRpYWxEZWxheTogMTAwMCwgLy8gMSDnp5Jcblx0bWF4RGVsYXk6IDEwMDAwLCAvLyAxMCDnp5Jcblx0YmFja29mZkZhY3RvcjogMiwgLy8g5oyH5pWw6YCA6YG/XG59O1xuXG4vKipcbiAqIOW4pumHjeivleeahOW8guatpeaTjeS9nFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aFJldHJ5PFQ+KFxuXHRvcGVyYXRpb246ICgpID0+IFByb21pc2U8VD4sXG5cdGNvbmZpZzogUGFydGlhbDxSZXRyeUNvbmZpZz4gPSB7fSxcblx0b3BlcmF0aW9uTmFtZSA9ICdvcGVyYXRpb24nXG4pOiBQcm9taXNlPFQ+IHtcblx0Y29uc3QgZmluYWxDb25maWcgPSB7IC4uLkRFRkFVTFRfUkVUUllfQ09ORklHLCAuLi5jb25maWcgfTtcblx0bGV0IGxhc3RFcnJvcjogRXJyb3IgfCB1bmRlZmluZWQ7XG5cdFxuXHRmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSBmaW5hbENvbmZpZy5tYXhBdHRlbXB0czsgYXR0ZW1wdCsrKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCBvcGVyYXRpb24oKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bGFzdEVycm9yID0gZXJyb3IgYXMgRXJyb3I7XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOaYr+iupOivgemUmeivr++8jOS4jemHjeivlVxuXHRcdFx0aWYgKGlzQXV0aEVycm9yKGVycm9yKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHRcdFx0J0FQSSBLZXkg5peg5pWI5oiW5pyq5o6I5p2DJyxcblx0XHRcdFx0XHQnYXV0aCcsXG5cdFx0XHRcdFx0bGFzdEVycm9yXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOaYr+mZkOa1gemUmeivr++8jOetieW+heabtOmVv+aXtumXtFxuXHRcdFx0aWYgKGlzUmF0ZUxpbWl0RXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdGNvbnN0IHdhaXRUaW1lID0gZ2V0UmF0ZUxpbWl0V2FpdFRpbWUoZXJyb3IpIHx8IGZpbmFsQ29uZmlnLm1heERlbGF5O1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske29wZXJhdGlvbk5hbWV9XSDpgYfliLDpmZDmtYHvvIznrYnlvoUgJHt3YWl0VGltZX1tcyDlkI7ph43or5UuLi5gKTtcblx0XHRcdFx0YXdhaXQgc2xlZXAod2FpdFRpbWUpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c5piv572R57uc6ZSZ6K+v5LiU5LiN5piv5pyA5ZCO5LiA5qyh5bCd6K+V77yM562J5b6F5ZCO6YeN6K+VXG5cdFx0XHRpZiAoYXR0ZW1wdCA8IGZpbmFsQ29uZmlnLm1heEF0dGVtcHRzICYmIGlzUmV0cnlhYmxlRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdGNvbnN0IGRlbGF5ID0gY2FsY3VsYXRlRGVsYXkoYXR0ZW1wdCwgZmluYWxDb25maWcpO1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYFske29wZXJhdGlvbk5hbWV9XSDlsJ3or5UgJHthdHRlbXB0fS8ke2ZpbmFsQ29uZmlnLm1heEF0dGVtcHRzfSDlpLHotKXvvIwke2RlbGF5fW1zIOWQjumHjeivlS4uLmApO1xuXHRcdFx0XHRhd2FpdCBzbGVlcChkZWxheSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDmnIDlkI7kuIDmrKHlsJ3or5XlpLHotKXvvIzmipvlh7rplJnor69cblx0XHRcdHRocm93IGNsYXNzaWZ5RXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXHRcblx0dGhyb3cgY2xhc3NpZnlFcnJvcihsYXN0RXJyb3IhKTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrlj6/ph43or5XplJnor69cbiAqL1xuZnVuY3Rpb24gaXNSZXRyeWFibGVFcnJvcihlcnJvcjogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRjb25zdCBtZXNzYWdlID0gKGVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0Y29uc3Qgc3RhdHVzID0gKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pPy5zdGF0dXMgfHwgKGVycm9yIGFzIHsgcmVzcG9uc2U/OiB7IHN0YXR1cz86IG51bWJlciB9IH0pPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRcblx0Ly8g572R57uc6ZSZ6K+vXG5cdGlmIChtZXNzYWdlLmluY2x1ZGVzKCduZXR3b3JrJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnZmV0Y2gnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdlbm90Zm91bmQnKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxuXHQvLyDmnI3liqHlmajplJnor68gKDV4eClcblx0aWYgKHN0YXR1cyA+PSA1MDAgJiYgc3RhdHVzIDwgNjAwKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdC8vIOi2heaXtumUmeivr1xuXHRpZiAobWVzc2FnZS5pbmNsdWRlcygndGltZW91dCcpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ2V0aW1lZG91dCcpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrorqTor4HplJnor69cbiAqL1xuZnVuY3Rpb24gaXNBdXRoRXJyb3IoZXJyb3I6IHVua25vd24pOiBib29sZWFuIHtcblx0Y29uc3Qgc3RhdHVzID0gKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pPy5zdGF0dXMgfHwgKGVycm9yIGFzIHsgcmVzcG9uc2U/OiB7IHN0YXR1cz86IG51bWJlciB9IH0pPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRjb25zdCBtZXNzYWdlID0gKGVycm9yIGFzIHsgbWVzc2FnZT86IHN0cmluZyB9KT8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0XG5cdHJldHVybiBzdGF0dXMgPT09IDQwMSB8fCBzdGF0dXMgPT09IDQwMyB8fCBcblx0XHRtZXNzYWdlLmluY2x1ZGVzKCd1bmF1dGhvcml6ZWQnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdpbnZhbGlkIGFwaSBrZXknKTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrpmZDmtYHplJnor69cbiAqL1xuZnVuY3Rpb24gaXNSYXRlTGltaXRFcnJvcihlcnJvcjogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRjb25zdCBzdGF0dXMgPSAoZXJyb3IgYXMgeyBzdGF0dXM/OiBudW1iZXIgfSk/LnN0YXR1cyB8fCAoZXJyb3IgYXMgeyByZXNwb25zZT86IHsgc3RhdHVzPzogbnVtYmVyIH0gfSk/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdGNvbnN0IG1lc3NhZ2UgPSAoZXJyb3IgYXMgeyBtZXNzYWdlPzogc3RyaW5nIH0pPy5tZXNzYWdlPy50b0xvd2VyQ2FzZSgpIHx8ICcnO1xuXHRcblx0cmV0dXJuIHN0YXR1cyA9PT0gNDI5IHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ3JhdGUgbGltaXQnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCd0b28gbWFueSByZXF1ZXN0cycpO1xufVxuXG4vKipcbiAqIOS7jumUmeivr+S4reiOt+WPlumZkOa1geetieW+heaXtumXtFxuICovXG5mdW5jdGlvbiBnZXRSYXRlTGltaXRXYWl0VGltZShlcnJvcjogdW5rbm93bik6IG51bWJlciB8IG51bGwge1xuXHQvLyDlsJ3or5Xku47lk43lupTlpLTojrflj5Zcblx0Y29uc3QgcmV0cnlBZnRlciA9IChlcnJvciBhcyB7IHJlc3BvbnNlPzogeyBoZWFkZXJzPzogeyBnZXQ6IChrZXk6IHN0cmluZykgPT4gc3RyaW5nIHwgbnVsbCB9IH0gfSk/LnJlc3BvbnNlPy5oZWFkZXJzPy5nZXQoJ3JldHJ5LWFmdGVyJyk7XG5cdGlmIChyZXRyeUFmdGVyKSB7XG5cdFx0Y29uc3Qgc2Vjb25kcyA9IHBhcnNlSW50KHJldHJ5QWZ0ZXIsIDEwKTtcblx0XHRpZiAoIWlzTmFOKHNlY29uZHMpKSB7XG5cdFx0XHRyZXR1cm4gc2Vjb25kcyAqIDEwMDA7XG5cdFx0fVxuXHR9XG5cdFxuXHQvLyDpu5jorqTnrYnlvoUgNjAg56eSXG5cdHJldHVybiA2MDAwMDtcbn1cblxuLyoqXG4gKiDorqHnrpfph43or5Xlu7bov5/ml7bpl7TvvIjmjIfmlbDpgIDpgb/vvIlcbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlRGVsYXkoYXR0ZW1wdDogbnVtYmVyLCBjb25maWc6IFJldHJ5Q29uZmlnKTogbnVtYmVyIHtcblx0Y29uc3QgZGVsYXkgPSBjb25maWcuaW5pdGlhbERlbGF5ICogTWF0aC5wb3coY29uZmlnLmJhY2tvZmZGYWN0b3IsIGF0dGVtcHQgLSAxKTtcblx0cmV0dXJuIE1hdGgubWluKGRlbGF5LCBjb25maWcubWF4RGVsYXkpO1xufVxuXG4vKipcbiAqIOS8keecoOaMh+WumuaXtumXtFxuICovXG5mdW5jdGlvbiBzbGVlcChtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cblxuLyoqXG4gKiDliIbnsbvplJnor6/nsbvlnotcbiAqL1xuZnVuY3Rpb24gY2xhc3NpZnlFcnJvcihlcnJvcjogdW5rbm93bik6IEFJQ2xhc3NpZmllckVycm9yIHtcblx0aWYgKGVycm9yIGluc3RhbmNlb2YgQUlDbGFzc2lmaWVyRXJyb3IpIHtcblx0XHRyZXR1cm4gZXJyb3I7XG5cdH1cblx0XG5cdGNvbnN0IG1lc3NhZ2UgPSBlcnJvcj8ubWVzc2FnZSB8fCBTdHJpbmcoZXJyb3IpO1xuXHRjb25zdCBsb3dlck1lc3NhZ2UgPSBtZXNzYWdlLnRvTG93ZXJDYXNlKCk7XG5cdGNvbnN0IHN0YXR1cyA9IGVycm9yPy5zdGF0dXMgfHwgZXJyb3I/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdFxuXHQvLyDnvZHnu5zplJnor69cblx0aWYgKGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnbmV0d29yaycpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnZmV0Y2gnKSB8fCBcblx0XHRsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2Vub3Rmb3VuZCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnZWNvbm5yZWZ1c2VkJykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+e9kee7nOi/nuaOpeWksei0pe+8jOivt+ajgOafpee9kee7nOiuvue9ricsXG5cdFx0XHQnbmV0d29yaycsXG5cdFx0XHRlcnJvclxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOi2heaXtumUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd0aW1lb3V0JykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdldGltZWRvdXQnKSkge1xuXHRcdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHQn6K+35rGC6LaF5pe277yM6K+356iN5ZCO6YeN6K+VJyxcblx0XHRcdCd0aW1lb3V0Jyxcblx0XHRcdGVycm9yXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g6K6k6K+B6ZSZ6K+vXG5cdGlmIChzdGF0dXMgPT09IDQwMSB8fCBzdGF0dXMgPT09IDQwMyB8fCBcblx0XHRsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3VuYXV0aG9yaXplZCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnaW52YWxpZCBhcGkga2V5JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J0FQSSBLZXkg5peg5pWI5oiW5pyq5o6I5p2DJyxcblx0XHRcdCdhdXRoJyxcblx0XHRcdGVycm9yXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g6ZmQ5rWB6ZSZ6K+vXG5cdGlmIChzdGF0dXMgPT09IDQyOSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3JhdGUgbGltaXQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3RvbyBtYW55IHJlcXVlc3RzJykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J0FQSSDor7fmsYLov4fkuo7popHnuYHvvIzor7fnqI3lkI7ph43or5UnLFxuXHRcdFx0J3JhdGVfbGltaXQnLFxuXHRcdFx0ZXJyb3Jcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyBKU09OIOino+aekOmUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdqc29uJykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdwYXJzZScpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnc3ludGF4JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+WTjeW6lOaVsOaNruagvOW8j+mUmeivrycsXG5cdFx0XHQncGFyc2UnLFxuXHRcdFx0ZXJyb3Jcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyDmnKrnn6XplJnor69cblx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRtZXNzYWdlLFxuXHRcdCd1bmtub3duJyxcblx0XHRlcnJvclxuXHQpO1xufVxuXG4vKipcbiAqIOeUqOaIt+WPi+WlveeahOmUmeivr+a2iOaBr1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlcnJvcjogRXJyb3IpOiBzdHJpbmcge1xuXHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBBSUNsYXNzaWZpZXJFcnJvcikge1xuXHRcdHN3aXRjaCAoZXJyb3IudHlwZSkge1xuXHRcdFx0Y2FzZSAnbmV0d29yayc6XG5cdFx0XHRcdHJldHVybiAn8J+MkCDnvZHnu5zov57mjqXlpLHotKXvvIzor7fmo4Dmn6XvvJpcXG7igKIg572R57uc5piv5ZCm5q2j5bi4XFxu4oCiIEFQSSDlnLDlnYDmmK/lkKbmraPnoa5cXG7igKIg5piv5ZCm6ZyA6KaB5Luj55CGJztcblx0XHRcdGNhc2UgJ3RpbWVvdXQnOlxuXHRcdFx0XHRyZXR1cm4gJ+KPse+4jyDor7fmsYLotoXml7bvvIzlu7rorq7vvJpcXG7igKIg5qOA5p+l572R57uc6YCf5bqmXFxu4oCiIOeojeWQjumHjeivlSc7XG5cdFx0XHRjYXNlICdhdXRoJzpcblx0XHRcdFx0cmV0dXJuICfwn5SRIEFQSSBLZXkg5peg5pWI77yM6K+35qOA5p+l77yaXFxu4oCiIEFQSSBLZXkg5piv5ZCm5q2j56GuXFxu4oCiIOaYr+WQpuacieS9meminS/pop3luqYnO1xuXHRcdFx0Y2FzZSAncmF0ZV9saW1pdCc6XG5cdFx0XHRcdHJldHVybiAn8J+apiDor7fmsYLov4fkuo7popHnuYHvvIzor7fnqI3lkI7ph43or5UnO1xuXHRcdFx0Y2FzZSAncGFyc2UnOlxuXHRcdFx0XHRyZXR1cm4gJ/Cfk50gQUkg5ZON5bqU5qC85byP5byC5bi477yM6K+36YeN6K+V5oiW6IGU57O75byA5Y+R6ICFJztcblx0XHRcdGNhc2UgJ3ZhbGlkYXRpb24nOlxuXHRcdFx0XHRyZXR1cm4gYOKaoO+4jyDphY3nva7plJnor6/vvJoke2Vycm9yLm1lc3NhZ2V9YDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBg4p2MICR7ZXJyb3IubWVzc2FnZX1gO1xuXHRcdH1cblx0fVxuXHRcblx0cmV0dXJuIGDinYwg5pyq55+l6ZSZ6K+v77yaJHtlcnJvci5tZXNzYWdlfWA7XG59XG5cbi8qKlxuICog6aqM6K+BIFVSTCDmoLzlvI9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVXJsKHVybDogc3RyaW5nLCBmaWVsZE5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRpZiAoIXVybCB8fCB1cmwudHJpbSgpID09PSAnJykge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihgJHtmaWVsZE5hbWV9IOS4jeiDveS4uuepumAsICd2YWxpZGF0aW9uJyk7XG5cdH1cblx0XG5cdHRyeSB7XG5cdFx0bmV3IFVSTCh1cmwpO1xuXHR9IGNhdGNoIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7ZmllbGROYW1lfSDmoLzlvI/kuI3mraPnoa46ICR7dXJsfWAsICd2YWxpZGF0aW9uJyk7XG5cdH1cbn1cblxuLyoqXG4gKiDpqozor4EgQVBJIEtleSDmoLzlvI9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQXBpS2V5KGFwaUtleTogc3RyaW5nLCBwcm92aWRlck5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRpZiAoIWFwaUtleSB8fCBhcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihgJHtwcm92aWRlck5hbWV9IEFQSSBLZXkg5LiN6IO95Li656m6YCwgJ3ZhbGlkYXRpb24nKTtcblx0fVxuXHRcblx0Ly8g5Z+65pys5qC85byP5qOA5p+lXG5cdGlmIChhcGlLZXkubGVuZ3RoIDwgMTApIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7cHJvdmlkZXJOYW1lfSBBUEkgS2V5IOagvOW8j+S4jeato+ehrmAsICd2YWxpZGF0aW9uJyk7XG5cdH1cbn1cblxuLyoqXG4gKiDluKbotoXml7bnmoQgZmV0Y2jvvIjkvb/nlKggT2JzaWRpYW4g55qEIHJlcXVlc3RVcmzvvIlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoV2l0aFRpbWVvdXQoXG5cdHVybDogc3RyaW5nLFxuXHRvcHRpb25zOiBSZXF1ZXN0SW5pdCA9IHt9LFxuXHR0aW1lb3V0ID0gMzAwMDBcbik6IFByb21pc2U8UmVzcG9uc2U+IHtcblx0dHJ5IHtcblx0XHRjb25zdCByZXF1ZXN0UGFyYW1zOiBSZXF1ZXN0VXJsUGFyYW0gPSB7XG5cdFx0XHR1cmwsXG5cdFx0XHRtZXRob2Q6IG9wdGlvbnMubWV0aG9kIGFzICdHRVQnIHwgJ1BPU1QnIHwgJ1BVVCcgfCAnREVMRVRFJyB8ICdQQVRDSCcgfHwgJ0dFVCcsXG5cdFx0XHRoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8fCB7fSxcblx0XHRcdGJvZHk6IG9wdGlvbnMuYm9keSBhcyBzdHJpbmcgfHwgdW5kZWZpbmVkLFxuXHRcdH07XG5cdFx0XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcblx0XHRcdC4uLnJlcXVlc3RQYXJhbXMsXG5cdFx0XHR0aHJvdzogZmFsc2UsIC8vIOS4jeiHquWKqOaKm+WHuiBIVFRQIOmUmeivr1xuXHRcdH0pO1xuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRvazogcmVzcG9uc2Uuc3RhdHVzID49IDIwMCAmJiByZXNwb25zZS5zdGF0dXMgPCAzMDAsXG5cdFx0XHRzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcblx0XHRcdHN0YXR1c1RleHQ6IHJlc3BvbnNlLnRleHQgfHwgJycsXG5cdFx0XHRoZWFkZXJzOiBuZXcgSGVhZGVycyhyZXNwb25zZS5oZWFkZXJzKSxcblx0XHRcdGpzb246IGFzeW5jICgpID0+IHJlc3BvbnNlLmpzb24sXG5cdFx0XHR0ZXh0OiBhc3luYyAoKSA9PiByZXNwb25zZS50ZXh0LFxuXHRcdFx0YmxvYjogYXN5bmMgKCkgPT4gbmV3IEJsb2IoW3Jlc3BvbnNlLmFycmF5QnVmZmVyXSksXG5cdFx0XHRhcnJheUJ1ZmZlcjogYXN5bmMgKCkgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIsXG5cdFx0XHRmb3JtRGF0YTogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2Zvcm1EYXRhIG5vdCBzdXBwb3J0ZWQnKTsgfSxcblx0XHRcdGNsb25lOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMgYXMgUmVzcG9uc2U7IH0sXG5cdFx0XHRib2R5OiBudWxsLFxuXHRcdFx0Ym9keVVzZWQ6IGZhbHNlLFxuXHRcdFx0cmVkaXJlY3RlZDogZmFsc2UsXG5cdFx0XHR0eXBlOiAnYmFzaWMnIGFzIFJlc3BvbnNlVHlwZSxcblx0XHRcdHVybDogdXJsLFxuXHRcdH0gYXMgUmVzcG9uc2U7XG5cdH0gY2F0Y2ggKGVycm9yOiB1bmtub3duKSB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+ivt+axgui2heaXtuaIlue9kee7nOmUmeivrycsXG5cdFx0XHQndGltZW91dCcsXG5cdFx0XHRlcnJvclxuXHRcdCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEFwcCwgTm90aWNlLCBURmlsZSwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBBSUNsYXNzaWZpZXJQbHVnaW4gZnJvbSAnLi4vbWFpbic7XG5pbXBvcnQgeyBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuLi9zZXR0aW5ncy9pMThuJztcbmltcG9ydCB7IENsYXNzaWZpZXIgfSBmcm9tICcuLi9zZXJ2aWNlcy9DbGFzc2lmaWVyJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuLi91dGlscy9maWxlT3BzJztcbmltcG9ydCB7IGdldFVzZXJGcmllbmRseU1lc3NhZ2UgfSBmcm9tICcuLi91dGlscy9lcnJvckhhbmRsZXInO1xuXG5leHBvcnQgY2xhc3MgQ2xhc3NpZnlDb21tYW5kIHtcblx0cHJpdmF0ZSBwbHVnaW46IEFJQ2xhc3NpZmllclBsdWdpbjtcblx0cHJpdmF0ZSBjbGFzc2lmaWVyOiBDbGFzc2lmaWVyO1xuXHRcblx0Y29uc3RydWN0b3IocGx1Z2luOiBBSUNsYXNzaWZpZXJQbHVnaW4pIHtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0XHR0aGlzLmNsYXNzaWZpZXIgPSBuZXcgQ2xhc3NpZmllcihwbHVnaW4uc2V0dGluZ3MsIHBsdWdpbi5sb2dnZXIpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75pS25Lu2566x5Lit55qE5omA5pyJ5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUluYm94KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluYm94Rm9sZGVyID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5ib3hGb2xkZXI7XG5cdFx0XG5cdFx0Ly8g56Gu5L+dIEluYm94IOebruW9leWtmOWcqFxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjcmVhdGVkID0gYXdhaXQgZmlsZU9wcy5lbnN1cmVGb2xkZXIodGhpcy5wbHVnaW4uYXBwLnZhdWx0LCBpbmJveEZvbGRlcik7XG5cdFx0XHRpZiAoY3JlYXRlZCkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGDlt7LliJvlu7rmlLbku7bnrrHmlofku7blpLk6ICR7aW5ib3hGb2xkZXJ9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0bmV3IE5vdGljZShg5Yib5bu65pS25Lu2566x5paH5Lu25aS55aSx6LSlOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHQvLyDmn6Xmib7mlLbku7bnrrHmlofku7blpLlcblx0XHRjb25zdCBpbmJveEZpbGVzID0gdGhpcy5maW5kSW5ib3hGaWxlcyhpbmJveEZvbGRlcik7XG5cdFx0XG5cdFx0aWYgKGluYm94RmlsZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRuZXcgTm90aWNlKHQoJ2NsYXNzaWZ5Lm5vRmlsZXMnKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdG5ldyBOb3RpY2UoYOaJvuWIsCAke2luYm94RmlsZXMubGVuZ3RofSDkuKrlvoXliIbnsbvmlofku7ZgKTtcblx0XHRcblx0XHQvLyDojrflj5YgQUkgUHJvdmlkZXLvvIjluKbplJnor6/lpITnkIbvvIlcblx0XHRsZXQgYWlQcm92aWRlcjtcblx0XHR0cnkge1xuXHRcdFx0YWlQcm92aWRlciA9IHRoaXMucGx1Z2luLmdldEFJUHJvdmlkZXIoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRuZXcgTm90aWNlKGVycm9yTXNnLCA4MDAwKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuY2xhc3NpZmllci5jbGFzc2lmeUluYm94KFxuXHRcdFx0aW5ib3hGaWxlcyxcblx0XHRcdGFpUHJvdmlkZXIsXG5cdFx0XHQobWVzc2FnZSkgPT4gbmV3IE5vdGljZShtZXNzYWdlLCAyMDAwKVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8g5aSE55CG57uT5p6cXG5cdFx0bGV0IG1vdmVkQ291bnQgPSAwO1xuXHRcdGxldCB1bmNlcnRhaW5Db3VudCA9IDA7XG5cdFx0XG5cdFx0Zm9yIChjb25zdCB7IGZpbGUsIHJlc3VsdCwgc3VjY2VzcyB9IG9mIHJlc3VsdHMpIHtcblx0XHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UobmV3IEVycm9yKHJlc3VsdC5yZWFzb25pbmcpKTtcblx0XHRcdFx0bmV3IE5vdGljZShgJHtmaWxlLm5hbWV9OiAke2Vycm9yTXNnfWAsIDUwMDApO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYgKHJlc3VsdC5pc1VuY2VydGFpbikge1xuXHRcdFx0XHR1bmNlcnRhaW5Db3VudCsrO1xuXHRcdFx0XHQvLyDlr7nkuo7kvY7nva7kv6Hluqbnu5PmnpzvvIznrYnlvoXnlKjmiLfnoa7orqRcblx0XHRcdFx0Y29uc3QgY29uZmlybWVkID0gYXdhaXQgdGhpcy5jb25maXJtQ2xhc3NpZmljYXRpb24oZmlsZSwgcmVzdWx0KTtcblx0XHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b01vdmVGaWxlKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgbW92ZWQgPSBhd2FpdCB0aGlzLmNsYXNzaWZpZXIubW92ZUZpbGUoZmlsZSwgcmVzdWx0LmNhdGVnb3J5KTtcblx0XHRcdFx0XHRpZiAobW92ZWQpIHtcblx0XHRcdFx0XHRcdG1vdmVkQ291bnQrKztcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoYCR7ZmlsZS5uYW1lfSDihpIgJHtyZXN1bHQuY2F0ZWdvcnl9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoYOenu+WKqCAke2ZpbGUubmFtZX0g5aSx6LSlOiAke2Vycm9yTXNnfWAsIDUwMDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgTm90aWNlKGAke2ZpbGUubmFtZX06ICR7cmVzdWx0LmNhdGVnb3J5fSAoJHsocmVzdWx0LmNvbmZpZGVuY2UgKiAxMDApLnRvRml4ZWQoMCl9JSlgKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0bmV3IE5vdGljZShcblx0XHRcdGDliIbnsbvlrozmiJDvvIFgICtcblx0XHRcdChtb3ZlZENvdW50ID4gMCA/IGDlt7Lnp7vliqggJHttb3ZlZENvdW50fSDkuKrmlofku7ZgIDogJycpICtcblx0XHRcdCh1bmNlcnRhaW5Db3VudCA+IDAgPyBg77yMJHt1bmNlcnRhaW5Db3VudH0g5Liq5paH5Lu26ZyA6KaB56Gu6K6kYCA6ICcnKVxuXHRcdCk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDliIbnsbvlvZPliY3miZPlvIDnmoTmlofku7Zcblx0ICovXG5cdGFzeW5jIGNsYXNzaWZ5Q3VycmVudEZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFxuXHRcdGlmICghYWN0aXZlRmlsZSkge1xuXHRcdFx0bmV3IE5vdGljZSgn5rKh5pyJ5omT5byA55qE5paH5Lu2Jyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOiOt+WPliBBSSBQcm92aWRlcu+8iOW4pumUmeivr+WkhOeQhu+8iVxuXHRcdGxldCBhaVByb3ZpZGVyO1xuXHRcdHRyeSB7XG5cdFx0XHRhaVByb3ZpZGVyID0gdGhpcy5wbHVnaW4uZ2V0QUlQcm92aWRlcigpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdG5ldyBOb3RpY2UoZXJyb3JNc2csIDgwMDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsYXNzaWZpZXIuY2xhc3NpZnlGaWxlKGFjdGl2ZUZpbGUsIGFpUHJvdmlkZXIpO1xuXHRcdFxuXHRcdGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShuZXcgRXJyb3IocmVzdWx0LmVycm9yIHx8ICdVbmtub3duIGVycm9yJykpO1xuXHRcdFx0bmV3IE5vdGljZShlcnJvck1zZywgNTAwMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdGNvbnN0IHsgcmVzdWx0OiBjbGFzc2lmaWNhdGlvbiB9ID0gcmVzdWx0O1xuXHRcdFxuXHRcdG5ldyBOb3RpY2UoXG5cdFx0XHRg5YiG57G7OiAke2NsYXNzaWZpY2F0aW9uPy5jYXRlZ29yeX0gYCArXG5cdFx0XHRgKCR7KChjbGFzc2lmaWNhdGlvbj8uY29uZmlkZW5jZSB8fCAwKSAqIDEwMCkudG9GaXhlZCgwKX0lKWBcblx0XHQpO1xuXHRcdFxuXHRcdC8vIOajgOafpeaYr+WQpumcgOimgeenu+WKqFxuXHRcdGlmIChjbGFzc2lmaWNhdGlvbj8uaXNVbmNlcnRhaW4pIHtcblx0XHRcdGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IHRoaXMuY29uZmlybUNsYXNzaWZpY2F0aW9uKGFjdGl2ZUZpbGUsIGNsYXNzaWZpY2F0aW9uKTtcblx0XHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSAmJiBjbGFzc2lmaWNhdGlvbikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jbGFzc2lmaWVyLm1vdmVGaWxlKGFjdGl2ZUZpbGUsIGNsYXNzaWZpY2F0aW9uLmNhdGVnb3J5KTtcblx0XHRcdFx0bmV3IE5vdGljZShgJHt0KCdjbGFzc2lmeS5tb3ZlZCcpfSR7Y2xhc3NpZmljYXRpb24uY2F0ZWdvcnl9YCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdFx0bmV3IE5vdGljZShg56e75Yqo5paH5Lu25aSx6LSlOiAke2Vycm9yTXNnfWAsIDUwMDApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOehruiupOWIhuexu++8iOeUqOS6juS9jue9ruS/oeW6puaDheWGte+8iVxuXHQgKi9cblx0cHJpdmF0ZSBjb25maXJtQ2xhc3NpZmljYXRpb24oZmlsZTogVEZpbGUsIHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBgJHtmaWxlLm5hbWV9XFxuJHt0KCdjbGFzc2lmeS5jb25maXJtJyl9JHtyZXN1bHQuY2F0ZWdvcnl9XFxuJHt0KCdjbGFzc2lmeS51bmNlcnRhaW4nKX0keygocmVzdWx0LmNvbmZpZGVuY2UgfHwgMCkgKiAxMDApLnRvRml4ZWQoMCl9JSlgO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzdWx0LnN1Z2dlc3RlZENhdGVnb3J5ICYmIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXMpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgJHt0KCdjbGFzc2lmeS5zdWdnZXN0ZWRDYXRlZ29yeScpfSR7cmVzdWx0LnN1Z2dlc3RlZENhdGVnb3J5fWApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDkvb/nlKggT2JzaWRpYW4g55qE56Gu6K6k5a+56K+d5qGGXG5cdFx0XHRjb25zdCBtb2RhbCA9IG5ldyBDb25maXJtTW9kYWwoXG5cdFx0XHRcdHRoaXMucGx1Z2luLmFwcCxcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0KGNvbmZpcm1lZCkgPT4ge1xuXHRcdFx0XHRcdGlmIChjb25maXJtZWQpIHtcblx0XHRcdFx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlc29sdmUoZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHRcdG1vZGFsLm9wZW4oKTtcblx0XHR9KTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOafpeaJvuaUtuS7tueuseS4reeahOaJgOacieeslOiusOaWh+S7tlxuXHQgKi9cblx0cHJpdmF0ZSBmaW5kSW5ib3hGaWxlcyhpbmJveEZvbGRlcjogc3RyaW5nKTogVEZpbGVbXSB7XG5cdFx0Y29uc3QgZmlsZXMgPSB0aGlzLnBsdWdpbi5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcblx0XHRjb25zdCBzY2FuU3ViZm9sZGVycyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnNjYW5TdWJmb2xkZXJzO1xuXHRcdFxuXHRcdHJldHVybiBmaWxlcy5maWx0ZXIoZmlsZSA9PiB7XG5cdFx0XHQvLyDmo4Dmn6Xmlofku7bmmK/lkKblnKjmlLbku7bnrrHmlofku7blpLnkuK1cblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gZmlsZS5wYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWRJbmJveCA9IGluYm94Rm9sZGVyLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblx0XHRcdFxuXHRcdFx0Ly8g5qOA5p+l5piv5ZCm5Zyo5pS25Lu2566x5LitXG5cdFx0XHRpZiAoIW5vcm1hbGl6ZWRQYXRoLnN0YXJ0c1dpdGgobm9ybWFsaXplZEluYm94ICsgJy8nKSAmJiBcblx0XHRcdFx0IShub3JtYWxpemVkUGF0aC5zdGFydHNXaXRoKG5vcm1hbGl6ZWRJbmJveCkgJiYgbm9ybWFsaXplZFBhdGggIT09IG5vcm1hbGl6ZWRJbmJveCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzkuI3miavmj4/lrZDmlofku7blpLnvvIzmo4Dmn6XmmK/lkKblnKjpobblsYJcblx0XHRcdGlmICghc2NhblN1YmZvbGRlcnMpIHtcblx0XHRcdFx0Y29uc3QgcmVsYXRpdmVQYXRoID0gbm9ybWFsaXplZFBhdGguc3Vic3RyaW5nKG5vcm1hbGl6ZWRJbmJveC5sZW5ndGgpO1xuXHRcdFx0XHQvLyDnp7vpmaTlvIDlpLTnmoTmlpzmnaBcblx0XHRcdFx0Y29uc3QgY2xlYW5SZWxhdGl2ZVBhdGggPSByZWxhdGl2ZVBhdGguc3RhcnRzV2l0aCgnLycpID8gcmVsYXRpdmVQYXRoLnN1YnN0cmluZygxKSA6IHJlbGF0aXZlUGF0aDtcblx0XHRcdFx0Ly8g5aaC5p6c55u45a+56Lev5b6E5Lit5YyF5ZCr5pac5p2g77yM6K+05piO5Zyo5a2Q55uu5b2V5LitXG5cdFx0XHRcdGlmIChjbGVhblJlbGF0aXZlUGF0aC5pbmNsdWRlcygnLycpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXHR9XG59XG5cbi8qKlxuICog566A5Y2V55qE56Gu6K6k5a+56K+d5qGGXG4gKi9cbmNsYXNzIENvbmZpcm1Nb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBtZXNzYWdlOiBzdHJpbmc7XG5cdHByaXZhdGUgb25Db25maXJtOiAoY29uZmlybWVkOiBib29sZWFuKSA9PiB2b2lkO1xuXHRcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIG1lc3NhZ2U6IHN0cmluZywgb25Db25maXJtOiAoY29uZmlybWVkOiBib29sZWFuKSA9PiB2b2lkKSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdHRoaXMub25Db25maXJtID0gb25Db25maXJtO1xuXHR9XG5cdFxuXHRvbk9wZW4oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLm1lc3NhZ2UgfSk7XG5cdFx0XG5cdFx0Y29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdignYnV0dG9uLWNvbnRhaW5lcicpO1xuXHRcdFxuXHRcdGNvbnN0IGNvbmZpcm1CdG4gPSBidXR0b25Db250YWluZXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICfnoa7orqQnLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0fSk7XG5cdFx0Y29uZmlybUJ0bi5vbkNsaWNrKCgpID0+IHtcblx0XHRcdHRoaXMub25Db25maXJtKHRydWUpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbkNvbnRhaW5lci5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ+WPlua2iCcsXG5cdFx0fSk7XG5cdFx0Y2FuY2VsQnRuLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oZmFsc2UpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cdFxuXHRvbkNsb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsIi8qKlxuICogQUkg5o+Q56S66K+N6ZuG5Lit566h55CGXG4gKi9cblxuZXhwb3J0IGNvbnN0IFNZU1RFTV9QUk9NUFQgPSBg5L2g5piv5LiT5Lia55qE5oqA5pyv5paH56ug5YiG57G75Yqp5omL44CCXG5cbiMjIOS9oOeahOiBjOi0o1xuMS4g5YiG5p6Q55So5oi35o+Q5L6b55qE5paH56ug5YaF5a65XG4yLiDku47pooTlrprkuYnliIbnsbvliJfooajkuK3pgInmi6nmnIDljLnphY3nmoTkuIDkuKpcbjMuIOi/lOWbnue7k+aehOWMlueahOWIhuexu+e7k+aenFxuXG4jIyDliIbnsbvljp/liJlcbjEuICoq57K+56Gu5Yy56YWNKirvvJrkvJjlhYjpgInmi6nkuI7mlofnq6DkuLvpopjlrozlhajljLnphY3nmoTliIbnsbtcbjIuICoq6K+t5LmJ55CG6KejKirvvJrnkIbop6Pmlofnq6DnmoTmioDmnK/poobln5/lkozkuLvpophcbjMuICoq5bGC57qn6YCJ5oupKirvvJrpgInmi6nmnIDlhbfkvZPnmoTlrZDliIbnsbvvvIzogIzpnZ7niLbliIbnsbtcbjQuICoq5ZCI55CG5o6o5patKirvvJrln7rkuo7moIfpopjlkozlhoXlrrnmkZjopoHov5vooYzmjqjmlq1cblxuIyMg5YiG57G75LyY5YWI57qnXG4xLiDnvJbnqIsv5YmN56uvIChGcm9udGVuZCnvvJpSZWFjdCwgVnVlLCBDU1MsIEhUTUwsIFdlYiDlvIDlj5HnrYlcbjIuIOe8lueoiy/lkI7nq68gKEJhY2tlbmQp77yaTm9kZS5qcywgUHl0aG9uLCBKYXZhLCBBUEksIFNlcnZlciDnrYlcbjMuIOe8lueoiy/np7vliqjnq68gKE1vYmlsZSnvvJppT1MsIEFuZHJvaWQsIEZsdXR0ZXIsIFJlYWN0IE5hdGl2ZSDnrYlcbjQuIOe8lueoiy9EZXZPcHPvvJpEb2NrZXIsIEt1YmVybmV0ZXMsIENJL0NELCBDbG91ZCDnrYlcbjUuIEFJL+acuuWZqOWtpuS5oO+8mk1MLCDmnLrlmajlrabkuaDnrpfms5UsIOaVsOaNruenkeWtpuetiVxuNi4gQUkv5rex5bqm5a2m5Lmg77yaRGVlcCBMZWFybmluZywgTmV1cmFsIE5ldHdvcmssIFRlbnNvckZsb3csIFB5VG9yY2gg562JXG43LiBBSS9OTFDvvJroh6rnhLbor63oqIDlpITnkIYsIExMTSwgQ2hhdEdQVCDnrYlcbjguIOaVsOaNri/mlbDmja7lupPvvJpEYXRhYmFzZSwgU1FMLCBQb3N0Z3JlU1FMLCBNb25nb0RCIOetiVxuOS4g5pWw5o2uL+aVsOaNruW3peeoi++8mkVUTCwgUGlwZWxpbmUsIERhdGEgV2FyZWhvdXNlIOetiVxuMTAuIOaetuaehC/ns7vnu5/orr7orqHvvJpTeXN0ZW0gRGVzaWduLCBBcmNoaXRlY3R1cmUsIFNjYWxhYmlsaXR5IOetiVxuMTEuIE90aGVy77ya5peg5rOV5b2S5YWl5LiK6L+w5YiG57G755qE5YaF5a65XG5cbiMjIOi+k+WHuuagvOW8j1xu6K+35LulIEpTT04g5qC85byP6L+U5Zue57uT5p6c77yaXG57XG4gIFwiY2F0ZWdvcnlcIjogXCLliIbnsbvot6/lvoTvvIzlpoIgJ+e8lueoiy/liY3nq68nXCIsXG4gIFwiY29uZmlkZW5jZVwiOiAwLjAtMS4wIOeahOe9ruS/oeW6puWIhuaVsCxcbiAgXCJyZWFzb25pbmdcIjogXCLnroDnn63nmoTnkIbnlLHor7TmmI5cIixcbiAgXCJpc1VuY2VydGFpblwiOiBmYWxzZSxcbiAgXCJzdWdnZXN0ZWRDYXRlZ29yeVwiOiBcIuWmguaenOehruWunuayoeacieWQiOmAguWIhuexu++8jOW7uuiurueahOaWsOWIhuexu+WQje+8iOWPr+mAie+8iVwiXG59XG5cbiMjIOazqOaEj+S6i+mhuVxuLSDlpoLmnpzmlofnq6DmmI7mmL7lsZ7kuo7mn5DkuKrpoobln5/vvIzpgInmi6nor6Xpoobln5/nmoTmnIDlhbfkvZPliIbnsbtcbi0g5aaC5p6c572u5L+h5bqm5L2O5LqOIDAuNe+8jOiuvue9riBpc1VuY2VydGFpbjogdHJ1ZVxuLSDlp4vnu4jov5Tlm57kuIDkuKrlkIjnkIbnmoTliIbnsbvvvIzkuI3opoHov5Tlm57nqbrlgLxgO1xuXG5leHBvcnQgY29uc3QgVVNFUl9QUk9NUFRfVEVNUExBVEUgPSBg6K+35YiG5p6Q5Lul5LiL5paH56ug5bm25YiG57G777yaXG5cbiMjIOaWh+eroOagh+mimFxue3tUSVRMRX19XG5cbiMjIOaWh+eroOWGheWuueaRmOimgVxue3tDT05URU5UfX1cblxuIyMg5Y+v55So5YiG57G75YiX6KGoXG57e0NBVEVHT1JJRVN9fVxuXG7or7fku47kuIrov7DliIbnsbvliJfooajkuK3pgInmi6nmnIDljLnphY3nmoTkuIDkuKrvvIzlubbov5Tlm54gSlNPTiDmoLzlvI/nmoTliIbnsbvnu5PmnpzjgIJgO1xuXG5leHBvcnQgY29uc3QgU1VHR0VTVF9DQVRFR09SWV9QUk9NUFQgPSBg5paH56ug5YaF5a655LiO546w5pyJ5YiG57G76YO95LiN5aSq5Yy56YWN44CCXG7lvZPml6Dms5Xmib7liLDlkIjpgILliIbnsbvml7bvvIzlj6/ku6Xlu7rorq7kuIDkuKrmlrDliIbnsbvlkI3np7DjgIJcbuaWsOWIhuexu+W6lOivpeaYr+WQiOeQhueahOaKgOacr+mihuWfn+WQjeensOOAgmA7XG4iLCJpbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFBsdWdpblNldHRpbmdzIH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU1lTVEVNX1BST01QVCwgVVNFUl9QUk9NUFRfVEVNUExBVEUgfSBmcm9tICcuL3Byb21wdHMnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IHdpdGhSZXRyeSwgZmV0Y2hXaXRoVGltZW91dCwgZ2V0VXNlckZyaWVuZGx5TWVzc2FnZSwgdmFsaWRhdGVVcmwgfSBmcm9tICcuLi91dGlscy9lcnJvckhhbmRsZXInO1xuXG5leHBvcnQgY2xhc3MgT2xsYW1hUHJvdmlkZXIgaW1wbGVtZW50cyBBSVByb3ZpZGVyIHtcblx0bmFtZSA9ICdPbGxhbWEnO1xuXHRwcml2YXRlIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblx0cHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblx0XG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdH1cblx0XG5cdGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDpqozor4EgVVJMIOagvOW8j1xuXHRcdFx0dmFsaWRhdGVVcmwodGhpcy5zZXR0aW5ncy5vbGxhbWFVcmwsICdPbGxhbWEg5Zyw5Z2AJyk7XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRgJHt0aGlzLnNldHRpbmdzLm9sbGFtYVVybH0vYXBpL3RhZ3NgLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWV0aG9kOiAnR0VUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcblx0XHRcdFx0fSxcblx0XHRcdFx0MTAwMDAgLy8gMTAg56eS6LaF5pe2XG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzcG9uc2Uub2spIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ09sbGFtYSDmnI3liqHmraPluLgnIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCB9O1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2UgfTtcblx0XHR9XG5cdH1cblx0XG5cdGFzeW5jIGNsYXNzaWZ5KGNvbnRlbnQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgY2F0ZWdvcmllczogc3RyaW5nW10pOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0PiB7XG5cdFx0Ly8g5L2/55So5bim6YeN6K+V55qE5pON5L2cXG5cdFx0cmV0dXJuIGF3YWl0IHdpdGhSZXRyeShcblx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdXNlclByb21wdCA9IFVTRVJfUFJPTVBUX1RFTVBMQVRFXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7VElUTEV9fScsIHRpdGxlKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e0NPTlRFTlR9fScsIGNvbnRlbnQuc2xpY2UoMCwgNDAwMCkpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q0FURUdPUklFU319JywgY2F0ZWdvcmllcy5tYXAoYyA9PiBgLSAke2N9YCkuam9pbignXFxuJykpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8g5L2/55So5bim6LaF5pe255qEIGZldGNoXG5cdFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChcblx0XHRcdFx0XHRgJHt0aGlzLnNldHRpbmdzLm9sbGFtYVVybH0vYXBpL2dlbmVyYXRlYCxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuXHRcdFx0XHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5vbGxhbWFNb2RlbCxcblx0XHRcdFx0XHRcdFx0cHJvbXB0OiBgPHxpbV9zdGFydHw+c3lzdGVtXFxuJHtTWVNURU1fUFJPTVBUfTx8aW1fZW5kfD5cXG48fGltX3N0YXJ0fD51c2VyXFxuJHt1c2VyUHJvbXB0fTx8aW1fZW5kfD5gLFxuXHRcdFx0XHRcdFx0XHRzdHJlYW06IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0dGVtcGVyYXR1cmU6IDAuMyxcblx0XHRcdFx0XHRcdFx0XHRudW1fcHJlZGljdDogNTAwLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQ2MDAwMCAvLyA2MCDnp5LotoXml7bvvIhPbGxhbWEg5Y+v6IO96L6D5oWi77yJXG5cdFx0XHRcdCk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnJvckRhdGEuZXJyb3IgfHwgYE9sbGFtYSBBUEkg6ZSZ6K+vOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyc2VSZXNwb25zZShkYXRhLnJlc3BvbnNlKTtcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG1heEF0dGVtcHRzOiAzLFxuXHRcdFx0XHRpbml0aWFsRGVsYXk6IDIwMDAsXG5cdFx0XHR9LFxuXHRcdFx0J09sbGFtYSBjbGFzc2lmeSdcblx0XHQpO1xuXHR9XG5cdFxuXHRwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2U6IHN0cmluZyk6IENsYXNzaWZpY2F0aW9uUmVzdWx0IHtcblx0XHQvLyDlsJ3or5Xku47lk43lupTkuK3mj5Dlj5YgSlNPTlxuXHRcdGNvbnN0IGpzb25NYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9gYGBqc29uXFxuKFtcXHNcXFNdKj8pXFxuYGBgLykgfHwgcmVzcG9uc2UubWF0Y2goLyhcXHtbXFxzXFxTXSpcXH0pLyk7XG5cdFx0XG5cdFx0aWYgKGpzb25NYXRjaCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uTWF0Y2hbMV0pO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGNhdGVnb3J5OiBwYXJzZWQuY2F0ZWdvcnkgfHwgJ090aGVyJyxcblx0XHRcdFx0XHRjb25maWRlbmNlOiBwYXJzZWQuY29uZmlkZW5jZSB8fCAwLjUsXG5cdFx0XHRcdFx0cmVhc29uaW5nOiBwYXJzZWQucmVhc29uaW5nIHx8ICcnLFxuXHRcdFx0XHRcdGlzVW5jZXJ0YWluOiBwYXJzZWQuaXNVbmNlcnRhaW4gfHwgZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGVkQ2F0ZWdvcnk6IHBhcnNlZC5zdWdnZXN0ZWRDYXRlZ29yeSxcblx0XHRcdFx0fTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZygnSlNPTiDop6PmnpDlpLHotKXvvIzkvb/nlKjmlofmnKzop6PmnpAnKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0Ly8g5aSH55So6Kej5p6Q77ya5o+Q5Y+W56ys5LiA5Liq5YiG57G76Lev5b6EXG5cdFx0Y29uc3QgY2F0ZWdvcnlNYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9jYXRlZ29yeVtcXHM6XStbXCInXT8oW15cXG5cIiddKykvaSk7XG5cdFx0Y29uc3QgY29uZmlkZW5jZU1hdGNoID0gcmVzcG9uc2UubWF0Y2goL2NvbmZpZGVuY2VbXFxzOl0rKFswLTkuXSspL2kpO1xuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRjYXRlZ29yeTogY2F0ZWdvcnlNYXRjaCA/IGNhdGVnb3J5TWF0Y2hbMV0udHJpbSgpIDogJ090aGVyJyxcblx0XHRcdGNvbmZpZGVuY2U6IGNvbmZpZGVuY2VNYXRjaCA/IHBhcnNlRmxvYXQoY29uZmlkZW5jZU1hdGNoWzFdKSA6IDAuNSxcblx0XHRcdHJlYXNvbmluZzogcmVzcG9uc2Uuc2xpY2UoMCwgMjAwKSxcblx0XHRcdGlzVW5jZXJ0YWluOiBmYWxzZSxcblx0XHR9O1xuXHR9XG59XG4iLCJpbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFNZU1RFTV9QUk9NUFQsIFVTRVJfUFJPTVBUX1RFTVBMQVRFIH0gZnJvbSAnLi9wcm9tcHRzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyB3aXRoUmV0cnksIGZldGNoV2l0aFRpbWVvdXQsIGdldFVzZXJGcmllbmRseU1lc3NhZ2UsIHZhbGlkYXRlVXJsIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JIYW5kbGVyJztcblxuaW50ZXJmYWNlIFByb3ZpZGVyQ29uZmlnIHtcblx0bmFtZTogc3RyaW5nO1xuXHRhcGlLZXk6IHN0cmluZztcblx0bW9kZWw6IHN0cmluZztcblx0YmFzZVVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyIGltcGxlbWVudHMgQUlQcm92aWRlciB7XG5cdG5hbWU6IHN0cmluZztcblx0cHJpdmF0ZSBjb25maWc6IFByb3ZpZGVyQ29uZmlnO1xuXHRwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuXHRcblx0Y29uc3RydWN0b3IoY29uZmlnOiBQcm92aWRlckNvbmZpZywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLm5hbWUgPSBjb25maWcubmFtZTtcblx0XHR0aGlzLmNvbmZpZyA9IGNvbmZpZztcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcblx0fVxuXHRcblx0YXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIOmqjOivgSBBUEkgS2V5XG5cdFx0XHRpZiAoIXRoaXMuY29uZmlnLmFwaUtleSB8fCB0aGlzLmNvbmZpZy5hcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FQSSBLZXkg5pyq6K6+572u77yM6K+35YWI6YWN572uIEFQSSBLZXknIH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOmqjOivgSBVUkxcblx0XHRcdHZhbGlkYXRlVXJsKHRoaXMuY29uZmlnLmJhc2VVcmwsICdBUEkg5Zyw5Z2AJyk7XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRgJHt0aGlzLmNvbmZpZy5iYXNlVXJsfS9tb2RlbHNgLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWV0aG9kOiAnR0VUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmNvbmZpZy5hcGlLZXl9YCxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQxMDAwMCAvLyAxMCDnp5LotoXml7Zcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdGlmIChyZXNwb25zZS5vaykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgJHt0aGlzLm5hbWV9IEFQSSDov57mjqXmraPluLhgIH07XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxKSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQVBJIEtleSDml6DmlYjmiJbmnKrmjojmnYPvvIzor7fmo4Dmn6XmmK/lkKbmraPnoa4nIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiDmnI3liqHmmoLml7bkuI3lj6/nlKhgIH07XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZSB9O1xuXHRcdH1cblx0fVxuXHRcblx0YXN5bmMgY2xhc3NpZnkoY29udGVudDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBjYXRlZ29yaWVzOiBzdHJpbmdbXSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHQ+IHtcblx0XHQvLyDkvb/nlKjluKbph43or5XnmoTmk43kvZxcblx0XHRyZXR1cm4gYXdhaXQgd2l0aFJldHJ5KFxuXHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB1c2VyUHJvbXB0ID0gVVNFUl9QUk9NUFRfVEVNUExBVEVcblx0XHRcdFx0XHQucmVwbGFjZSgne3tUSVRMRX19JywgdGl0bGUpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q09OVEVOVH19JywgY29udGVudC5zbGljZSgwLCA0MDAwKSlcblx0XHRcdFx0XHQucmVwbGFjZSgne3tDQVRFR09SSUVTfX0nLCBjYXRlZ29yaWVzLm1hcChjID0+IGAtICR7Y31gKS5qb2luKCdcXG4nKSk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvLyDkvb/nlKjluKbotoXml7bnmoQgZmV0Y2hcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRcdGAke3RoaXMuY29uZmlnLmJhc2VVcmx9L2NoYXQvY29tcGxldGlvbnNgLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmNvbmZpZy5hcGlLZXl9YCxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdFx0XHRcdG1vZGVsOiB0aGlzLmNvbmZpZy5tb2RlbCxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0XHRcdFx0XHR7IHJvbGU6ICdzeXN0ZW0nLCBjb250ZW50OiBTWVNURU1fUFJPTVBUIH0sXG5cdFx0XHRcdFx0XHRcdFx0eyByb2xlOiAndXNlcicsIGNvbnRlbnQ6IHVzZXJQcm9tcHQgfSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0dGVtcGVyYXR1cmU6IDAuMyxcblx0XHRcdFx0XHRcdFx0bWF4X3Rva2VuczogNTAwLFxuXHRcdFx0XHRcdFx0XHRyZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQzMDAwMCAvLyAzMCDnp5LotoXml7Zcblx0XHRcdFx0KTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0XHRjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcblx0XHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGVycm9yLmVycm9yPy5tZXNzYWdlIHx8IGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfWA7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8g5p6E6YCg5pu06K+m57uG55qE6ZSZ6K+vXG5cdFx0XHRcdFx0Y29uc3QgZW5oYW5jZWRFcnJvciA9IG5ldyBFcnJvcihlcnJvck1zZykgYXMgYW55O1xuXHRcdFx0XHRcdGVuaGFuY2VkRXJyb3Iuc3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuXHRcdFx0XHRcdGVuaGFuY2VkRXJyb3IucmVzcG9uc2UgPSB7IFxuXHRcdFx0XHRcdFx0c3RhdHVzOiByZXNwb25zZS5zdGF0dXMsXG5cdFx0XHRcdFx0XHRoZWFkZXJzOiByZXNwb25zZS5oZWFkZXJzLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dGhyb3cgZW5oYW5jZWRFcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0VGV4dCA9IGRhdGEuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudCB8fCAne30nO1xuXHRcdFx0XHRcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyc2VSZXNwb25zZShyZXN1bHRUZXh0KTtcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG1heEF0dGVtcHRzOiAzLFxuXHRcdFx0XHRpbml0aWFsRGVsYXk6IDE1MDAsXG5cdFx0XHR9LFxuXHRcdFx0YCR7dGhpcy5uYW1lfSBjbGFzc2lmeWBcblx0XHQpO1xuXHR9XG5cdFxuXHRwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2VUZXh0OiBzdHJpbmcpOiBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmVzcG9uc2VUZXh0KTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhdGVnb3J5OiBwYXJzZWQuY2F0ZWdvcnkgfHwgJ090aGVyJyxcblx0XHRcdFx0Y29uZmlkZW5jZTogcGFyc2VkLmNvbmZpZGVuY2UgfHwgMC41LFxuXHRcdFx0XHRyZWFzb25pbmc6IHBhcnNlZC5yZWFzb25pbmcgfHwgJycsXG5cdFx0XHRcdGlzVW5jZXJ0YWluOiBwYXJzZWQuaXNVbmNlcnRhaW4gfHwgZmFsc2UsXG5cdFx0XHRcdHN1Z2dlc3RlZENhdGVnb3J5OiBwYXJzZWQuc3VnZ2VzdGVkQ2F0ZWdvcnksXG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoJ0pTT04g6Kej5p6Q5aSx6LSlJyk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYXRlZ29yeTogJ090aGVyJyxcblx0XHRcdFx0Y29uZmlkZW5jZTogMC41LFxuXHRcdFx0XHRyZWFzb25pbmc6IHJlc3BvbnNlVGV4dC5zbGljZSgwLCAyMDApLFxuXHRcdFx0XHRpc1VuY2VydGFpbjogdHJ1ZSxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG59XG4iLCIvKipcbiAqIOeugOWNleaXpeW/l+W3peWFt1xuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcblx0cHJpdmF0ZSBlbmFibGVkOiBib29sZWFuO1xuXHRwcml2YXRlIHByZWZpeCA9ICdbQUlDbGFzc2lmaWVyXSc7XG5cdFxuXHRjb25zdHJ1Y3RvcihlbmFibGVkID0gZmFsc2UpIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cdFxuXHRzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cdFxuXHRkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVuYWJsZWQpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0XHR9XG5cdH1cblx0XG5cdGluZm8obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRjb25zb2xlLmRlYnVnKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cblx0XG5cdHdhcm4obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRjb25zb2xlLndhcm4oYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0fVxuXHRcblx0ZXJyb3IobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcblx0XHRjb25zb2xlLmVycm9yKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbiwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTLCBQbHVnaW5TZXR0aW5ncywgQUlQcm92aWRlciB9IGZyb20gJy4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU2V0dGluZ3NUYWIgfSBmcm9tICcuL3NldHRpbmdzL1NldHRpbmdzVGFiJztcbmltcG9ydCB7IENsYXNzaWZ5Q29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kJztcbmltcG9ydCB7IE9sbGFtYVByb3ZpZGVyIH0gZnJvbSAnLi9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlcic7XG5pbXBvcnQgeyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIgfSBmcm9tICcuL3NlcnZpY2VzL09wZW5BSVByb3ZpZGVyJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuL3V0aWxzL2ZpbGVPcHMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBSUNsYXNzaWZpZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHQvLyDmj5Lku7borr7nva5cblx0c2V0dGluZ3M6IFBsdWdpblNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcblx0XG5cdC8vIOaXpeW/l1xuXHRsb2dnZXIgPSBuZXcgTG9nZ2VyKCk7XG5cdFxuXHQvLyDlkb3ku6TlpITnkIZcblx0cHJpdmF0ZSBjb21tYW5kczogQ2xhc3NpZnlDb21tYW5kO1xuXHRcblx0Ly8g6K6+572u6Z2i5p2/XG5cdHByaXZhdGUgc2V0dGluZ3NUYWI6IFNldHRpbmdzVGFiO1xuXHRcblx0YXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnNvbGUuZGVidWcoJ1tBSSBDbGFzc2lmaWVyXSDmj5Lku7bliqDovb3kuK0uLi4nKTtcblx0XHRcblx0XHQvLyDliqDovb3orr7nva5cblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXHRcdFxuXHRcdC8vIOWIneWni+WMluaXpeW/l1xuXHRcdHRoaXMubG9nZ2VyLnNldEVuYWJsZWQodGhpcy5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyk7XG5cdFx0XG5cdFx0Ly8g6Ieq5Yqo5Yib5bu6IEluYm94IOebruW9le+8iOWmguaenOS4jeWtmOWcqO+8iVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjcmVhdGVkID0gYXdhaXQgZmlsZU9wcy5lbnN1cmVGb2xkZXIodGhpcy5hcHAudmF1bHQsIHRoaXMuc2V0dGluZ3MuaW5ib3hGb2xkZXIpO1xuXHRcdFx0aWYgKGNyZWF0ZWQpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhg5bey5Yib5bu65pS25Lu2566x5paH5Lu25aS5OiAke3RoaXMuc2V0dGluZ3MuaW5ib3hGb2xkZXJ9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoJ+WIm+W7uuaUtuS7tueuseaWh+S7tuWkueWksei0pTonLCBlKTtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5Yid5aeL5YyW5ZG95LukXG5cdFx0dGhpcy5jb21tYW5kcyA9IG5ldyBDbGFzc2lmeUNvbW1hbmQodGhpcyk7XG5cdFx0XG5cdFx0Ly8g5rOo5YaM5ZG95LukXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAnY2xhc3NpZnktaW5ib3gnLFxuXHRcdFx0bmFtZTogJ0FJ5pm66IO95YiG57G7IC0g5YiG57G75pS25Lu2566xJyxcblx0XHRcdGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlJbmJveCgpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICdjbGFzc2lmeS1jdXJyZW50Jyxcblx0XHRcdG5hbWU6ICdBSeaZuuiDveWIhuexuyAtIOWIhuexu+W9k+WJjeaWh+S7ticsXG5cdFx0XHRjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0aWYgKCFjaGVja2luZykge1xuXHRcdFx0XHRcdFx0dm9pZCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5Q3VycmVudEZpbGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRcblx0XHQvLyAxLiDmt7vliqAgUmliYm9uIOWbvuagh++8iOW3puS+p+i+ueagj++8iVxuXHRcdHRoaXMuYWRkUmliYm9uSWNvbignc3BhcmtsZXMnLCAnQUnmmbrog73liIbnsbsnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5SW5ib3goKTtcblx0XHR9KTtcblx0XHRcblx0XHQvLyAyLiDmt7vliqDmlofku7blj7PplK7oj5zljZVcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdFx0XHRcdGl0ZW1cblx0XHRcdFx0XHRcdFx0LnNldFRpdGxlKCdBSeaZuuiDveWIhuexuycpXG5cdFx0XHRcdFx0XHRcdC5zZXRJY29uKCdzcGFya2xlcycpXG5cdFx0XHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5Q3VycmVudEZpbGUoKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblx0XHRcblx0XHQvLyAzLiDmt7vliqDnvJbovpHlmajoj5zljZXvvIjlj7PkuIrop5Lmm7TlpJroj5zljZXvvIlcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2VkaXRvci1tZW51JywgKG1lbnUpID0+IHtcblx0XHRcdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRcdFx0aXRlbVxuXHRcdFx0XHRcdFx0LnNldFRpdGxlKCdBSeaZuuiDveWIhuexuycpXG5cdFx0XHRcdFx0XHQuc2V0SWNvbignc3BhcmtsZXMnKVxuXHRcdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5Q3VycmVudEZpbGUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pXG5cdFx0KTtcblx0XHRcblx0XHQvLyDmt7vliqDorr7nva7pnaLmnb9cblx0XHR0aGlzLnNldHRpbmdzVGFiID0gbmV3IFNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKTtcblx0XHR0aGlzLmFkZFNldHRpbmdUYWIodGhpcy5zZXR0aW5nc1RhYik7XG5cdFx0XG5cdFx0Y29uc29sZS5kZWJ1ZygnW0FJIENsYXNzaWZpZXJdIOaPkuS7tuWKoOi9veWujOaIkCEnKTtcblx0fVxuXHRcblx0b251bmxvYWQoKTogdm9pZCB7XG5cdFx0Y29uc29sZS5kZWJ1ZygnW0FJIENsYXNzaWZpZXJdIOaPkuS7tuW3suWNuOi9vScpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog6I635Y+WIEFJIFByb3ZpZGVyIOWunuS+i1xuXHQgKi9cblx0Z2V0QUlQcm92aWRlcigpOiBBSVByb3ZpZGVyIHtcblx0XHRjb25zdCBwcm92aWRlclR5cGUgPSB0aGlzLnNldHRpbmdzLmFpUHJvdmlkZXI7XG5cdFx0XG5cdFx0Ly8g6aqM6K+B6YWN572uXG5cdFx0dGhpcy52YWxpZGF0ZVByb3ZpZGVyQ29uZmlnKHByb3ZpZGVyVHlwZSk7XG5cdFx0XG5cdFx0c3dpdGNoIChwcm92aWRlclR5cGUpIHtcblx0XHRcdGNhc2UgJ29sbGFtYSc6XG5cdFx0XHRcdHJldHVybiBuZXcgT2xsYW1hUHJvdmlkZXIodGhpcy5zZXR0aW5ncywgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ09wZW5BSScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnNldHRpbmdzLm9wZW5haUFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5vcGVuYWlNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLm9wZW5haUFwaVVybCxcblx0XHRcdFx0fSwgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdHJldHVybiBuZXcgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyKHtcblx0XHRcdFx0XHRuYW1lOiAnRGVlcFNlZWsnLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5kZWVwc2Vla01vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ01vb25zaG90IChLaW1pKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnNldHRpbmdzLm1vb25zaG90QXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLm1vb25zaG90TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5zZXR0aW5ncy5tb29uc2hvdEFwaVVybCxcblx0XHRcdFx0fSwgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdHJldHVybiBuZXcgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyKHtcblx0XHRcdFx0XHRuYW1lOiAnWmhpcHUgKOaZuuiwsSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy56aGlwdU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3MuemhpcHVBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBBSSBQcm92aWRlcjogJHtwcm92aWRlclR5cGUgYXMgc3RyaW5nfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOmqjOivgSBQcm92aWRlciDphY3nva5cblx0ICovXG5cdHByaXZhdGUgdmFsaWRhdGVQcm92aWRlckNvbmZpZyhwcm92aWRlclR5cGU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHN3aXRjaCAocHJvdmlkZXJUeXBlKSB7XG5cdFx0XHRjYXNlICdvbGxhbWEnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub2xsYW1hVXJsIHx8IHRoaXMuc2V0dGluZ3Mub2xsYW1hVXJsLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ09sbGFtYSDlnLDlnYDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub2xsYW1hTW9kZWwgfHwgdGhpcy5zZXR0aW5ncy5vbGxhbWFNb2RlbC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPbGxhbWEg5qih5Z6L5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignT3BlbkFJIEFQSSBLZXkg5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5IHx8IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignRGVlcFNlZWsgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy5tb29uc2hvdEFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNb29uc2hvdCBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleSB8fCB0aGlzLnNldHRpbmdzLnpoaXB1QXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ+aZuuiwsSBBSSBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBBSSBQcm92aWRlcjogJHtwcm92aWRlclR5cGV9YCk7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5Yqg6L296K6+572uXG5cdCAqL1xuXHRhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcblx0XHR0aGlzLnNldHRpbmdzID0ge1xuXHRcdFx0Li4uREVGQVVMVF9TRVRUSU5HUyxcblx0XHRcdC4uLmRhdGEsXG5cdFx0fTtcblx0XHRcblx0XHQvLyDliJ3lp4vljJbliIbnsbvliJfooahcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuY2F0ZWdvcmllcyB8fCB0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKHRoaXMuc2V0dGluZ3MuY2F0ZWdvcnlUcmVlKTtcblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDkv53lrZjorr7nva5cblx0ICovXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHRcdHRoaXMubG9nZ2VyLnNldEVuYWJsZWQodGhpcy5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDlsIbliIbnsbvmoJHlsZXlubPkuLrliJfooahcblx0ICovXG5cdHByaXZhdGUgZmxhdHRlbkNhdGVnb3JpZXModHJlZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHByZWZpeCA9ICcnKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0cmVlKSkge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHByZWZpeCA/IGAke3ByZWZpeH0vJHtrZXl9YCA6IGtleTtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB0cnVlKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKC4uLnRoaXMuZmxhdHRlbkNhdGVnb3JpZXModmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHBhdGgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHBhdGgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG4iXSwibmFtZXMiOlsiQ29uZmlybU1vZGFsIiwiTW9kYWwiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk5vdGljZSIsIlRGaWxlIiwicmVxdWVzdFVybCIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7OztBQStDTyxNQUFNLGdCQUFnQixHQUFtQjtBQUMvQyxJQUFBLFVBQVUsRUFBRSxRQUFRO0FBQ3BCLElBQUEsU0FBUyxFQUFFLHdCQUF3QjtBQUNuQyxJQUFBLFdBQVcsRUFBRSxVQUFVOztBQUd2QixJQUFBLFlBQVksRUFBRSxFQUFFO0FBQ2hCLElBQUEsV0FBVyxFQUFFLGFBQWE7QUFDMUIsSUFBQSxZQUFZLEVBQUUsMkJBQTJCOztBQUd6QyxJQUFBLGNBQWMsRUFBRSxFQUFFO0FBQ2xCLElBQUEsYUFBYSxFQUFFLGVBQWU7QUFDOUIsSUFBQSxjQUFjLEVBQUUsNkJBQTZCOztBQUc3QyxJQUFBLGNBQWMsRUFBRSxFQUFFO0FBQ2xCLElBQUEsYUFBYSxFQUFFLGdCQUFnQjtBQUMvQixJQUFBLGNBQWMsRUFBRSw0QkFBNEI7O0FBRzVDLElBQUEsV0FBVyxFQUFFLEVBQUU7QUFDZixJQUFBLFVBQVUsRUFBRSxPQUFPO0FBQ25CLElBQUEsV0FBVyxFQUFFLHNDQUFzQztBQUVuRCxJQUFBLFdBQVcsRUFBRSxPQUFPO0FBQ3BCLElBQUEsWUFBWSxFQUFFO0FBQ2IsUUFBQSxhQUFhLEVBQUU7QUFDZCxZQUFBLFVBQVUsRUFBRSxJQUFJO0FBQ2hCLFlBQUEsU0FBUyxFQUFFLElBQUk7QUFDZixZQUFBLFFBQVEsRUFBRSxJQUFJO0FBQ2QsWUFBQSxRQUFRLEVBQUUsSUFBSTtBQUNkLFNBQUE7QUFDRCxRQUFBLFNBQVMsRUFBRTtBQUNWLFlBQUEsa0JBQWtCLEVBQUUsSUFBSTtBQUN4QixZQUFBLGVBQWUsRUFBRSxJQUFJO0FBQ3JCLFlBQUEsS0FBSyxFQUFFLElBQUk7QUFDWCxTQUFBO0FBQ0QsUUFBQSxN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
