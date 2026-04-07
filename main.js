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
                    this.plugin.saveSettings();
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
                if (!folderError.message?.includes('already exists')) {
                    throw new Error(`创建文件夹失败: ${folderError.message}`);
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
            if (!newFile) {
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
 * 带超时的 fetch
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    }
    catch (error) {
        if (error.name === 'AbortError') {
            throw new AIClassifierError('请求超时', 'timeout', error);
        }
        throw error;
    }
    finally {
        clearTimeout(timeoutId);
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
        const inboxFiles = await this.findInboxFiles(inboxFolder);
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
    async findInboxFiles(inboxFolder) {
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
            console.log(`${this.prefix} ${message}`, ...args);
        }
    }
    info(message, ...args) {
        console.log(`${this.prefix} ${message}`, ...args);
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
        console.log('[AI Classifier] 插件加载中...');
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
                        this.commands.classifyCurrentFile();
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
        console.log('[AI Classifier] 插件加载完成!');
    }
    onunload() {
        console.log('[AI Classifier] 插件已卸载');
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
            default:
                throw new Error(`未知的 AI Provider: ${providerType}`);
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
            if (typeof value === 'object' && value !== true) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3NyYy9zZXR0aW5ncy90eXBlcy50cyIsInNyYy9zcmMvc2V0dGluZ3MvaTE4bi50cyIsInNyYy9zcmMvc2V0dGluZ3MvQ2F0ZWdvcnlUcmVlVmlldy50cyIsInNyYy9zcmMvc2V0dGluZ3MvU2V0dGluZ3NUYWIudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NvbnRlbnRFeHRyYWN0b3IudHMiLCJzcmMvc3JjL3V0aWxzL2ZpbGVPcHMudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NsYXNzaWZpZXIudHMiLCJzcmMvc3JjL3V0aWxzL2Vycm9ySGFuZGxlci50cyIsInNyYy9zcmMvY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9wcm9tcHRzLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlci50cyIsInNyYy9zcmMvc2VydmljZXMvT3BlbkFJUHJvdmlkZXIudHMiLCJzcmMvc3JjL3V0aWxzL2xvZ2dlci50cyIsInNyYy9zcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZXhwb3J0IHR5cGUgQUlQcm92aWRlclR5cGUgPSAnb2xsYW1hJyB8ICdvcGVuYWknIHwgJ2RlZXBzZWVrJyB8ICdtb29uc2hvdCcgfCAnemhpcHUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5VHJlZSB7XG5cdFtuYW1lOiBzdHJpbmddOiBDYXRlZ29yeVRyZWUgfCBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpblNldHRpbmdzIHtcblx0Ly8gQUkg6YWN572uXG5cdGFpUHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlO1xuXHRvbGxhbWFVcmw6IHN0cmluZztcblx0b2xsYW1hTW9kZWw6IHN0cmluZztcblx0XG5cdC8vIE9wZW5BSSDphY3nva5cblx0b3BlbmFpQXBpS2V5OiBzdHJpbmc7XG5cdG9wZW5haU1vZGVsOiBzdHJpbmc7XG5cdG9wZW5haUFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gRGVlcFNlZWsg6YWN572uXG5cdGRlZXBzZWVrQXBpS2V5OiBzdHJpbmc7XG5cdGRlZXBzZWVrTW9kZWw6IHN0cmluZztcblx0ZGVlcHNlZWtBcGlVcmw6IHN0cmluZztcblx0XG5cdC8vIE1vb25zaG90IChLaW1pKSDphY3nva5cblx0bW9vbnNob3RBcGlLZXk6IHN0cmluZztcblx0bW9vbnNob3RNb2RlbDogc3RyaW5nO1xuXHRtb29uc2hvdEFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gWmhpcHUgKOaZuuiwsSBBSSkg6YWN572uXG5cdHpoaXB1QXBpS2V5OiBzdHJpbmc7XG5cdHpoaXB1TW9kZWw6IHN0cmluZztcblx0emhpcHVBcGlVcmw6IHN0cmluZztcblx0XG5cdC8vIOWIhuexu+mFjee9rlxuXHRpbmJveEZvbGRlcjogc3RyaW5nO1xuXHRjYXRlZ29yeVRyZWU6IENhdGVnb3J5VHJlZTtcblx0Y2F0ZWdvcmllczogc3RyaW5nW107XG5cdHNjYW5TdWJmb2xkZXJzOiBib29sZWFuO1xuXHRcblx0Ly8g6auY57qn5Yqf6IO9XG5cdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXM6IGJvb2xlYW47XG5cdGF1dG9Nb3ZlRmlsZTogYm9vbGVhbjtcblx0Y29uZmlkZW5jZVRocmVzaG9sZDogbnVtYmVyO1xuXHRcblx0Ly8g5pel5b+XXG5cdGVuYWJsZURlYnVnTG9nOiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG5cdGFpUHJvdmlkZXI6ICdvbGxhbWEnLFxuXHRvbGxhbWFVcmw6ICdodHRwOi8vbG9jYWxob3N0OjExNDM0Jyxcblx0b2xsYW1hTW9kZWw6ICdsbGFtYTMuMicsXG5cdFxuXHQvLyBPcGVuQUkg6buY6K6k6YWN572uXG5cdG9wZW5haUFwaUtleTogJycsXG5cdG9wZW5haU1vZGVsOiAnZ3B0LTRvLW1pbmknLFxuXHRvcGVuYWlBcGlVcmw6ICdodHRwczovL2FwaS5vcGVuYWkuY29tL3YxJyxcblx0XG5cdC8vIERlZXBTZWVrIOm7mOiupOmFjee9rlxuXHRkZWVwc2Vla0FwaUtleTogJycsXG5cdGRlZXBzZWVrTW9kZWw6ICdkZWVwc2Vlay1jaGF0Jyxcblx0ZGVlcHNlZWtBcGlVcmw6ICdodHRwczovL2FwaS5kZWVwc2Vlay5jb20vdjEnLFxuXHRcblx0Ly8gTW9vbnNob3QgKEtpbWkpIOm7mOiupOmFjee9rlxuXHRtb29uc2hvdEFwaUtleTogJycsXG5cdG1vb25zaG90TW9kZWw6ICdtb29uc2hvdC12MS04aycsXG5cdG1vb25zaG90QXBpVXJsOiAnaHR0cHM6Ly9hcGkubW9vbnNob3QuY24vdjEnLFxuXHRcblx0Ly8gWmhpcHUgKOaZuuiwsSkg6buY6K6k6YWN572uXG5cdHpoaXB1QXBpS2V5OiAnJyxcblx0emhpcHVNb2RlbDogJ2dsbS00Jyxcblx0emhpcHVBcGlVcmw6ICdodHRwczovL29wZW4uYmlnbW9kZWwuY24vYXBpL3BhYXMvdjQnLFxuXHRcblx0aW5ib3hGb2xkZXI6ICdJbmJveCcsXG5cdGNhdGVnb3J5VHJlZToge1xuXHRcdCdQcm9ncmFtbWluZyc6IHtcblx0XHRcdCdGcm9udGVuZCc6IHRydWUsXG5cdFx0XHQnQmFja2VuZCc6IHRydWUsXG5cdFx0XHQnTW9iaWxlJzogdHJ1ZSxcblx0XHRcdCdEZXZPcHMnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0FJICYgTUwnOiB7XG5cdFx0XHQnTWFjaGluZSBMZWFybmluZyc6IHRydWUsXG5cdFx0XHQnRGVlcCBMZWFybmluZyc6IHRydWUsXG5cdFx0XHQnTkxQJzogdHJ1ZSxcblx0XHR9LFxuXHRcdCdEYXRhJzoge1xuXHRcdFx0J0RhdGFiYXNlJzogdHJ1ZSxcblx0XHRcdCdEYXRhIEVuZ2luZWVyaW5nJzogdHJ1ZSxcblx0XHRcdCdBbmFseXRpY3MnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0FyY2hpdGVjdHVyZSc6IHtcblx0XHRcdCdTeXN0ZW0gRGVzaWduJzogdHJ1ZSxcblx0XHRcdCdNaWNyb3NlcnZpY2VzJzogdHJ1ZSxcblx0XHR9LFxuXHRcdCdPdGhlcic6IHRydWUsXG5cdH0sXG5cdGNhdGVnb3JpZXM6IFtdLFxuXHRzY2FuU3ViZm9sZGVyczogdHJ1ZSxcblx0XG5cdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXM6IGZhbHNlLFxuXHRhdXRvTW92ZUZpbGU6IHRydWUsXG5cdGNvbmZpZGVuY2VUaHJlc2hvbGQ6IDAuNyxcblx0XG5cdGVuYWJsZURlYnVnTG9nOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuXHRjYXRlZ29yeTogc3RyaW5nO1xuXHRjb25maWRlbmNlOiBudW1iZXI7XG5cdHJlYXNvbmluZzogc3RyaW5nO1xuXHRpc1VuY2VydGFpbjogYm9vbGVhbjtcblx0c3VnZ2VzdGVkQ2F0ZWdvcnk/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQUlQcm92aWRlciB7XG5cdG5hbWU6IHN0cmluZztcblx0dGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9Pjtcblx0Y2xhc3NpZnkoY29udGVudDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBjYXRlZ29yaWVzOiBzdHJpbmdbXSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHQ+O1xufVxuIiwiLy8g5Zu96ZmF5YyW5pSv5oyBIC0g5b2T5YmN5LuF5pSv5oyB5Lit5paHXG5leHBvcnQgY29uc3QgdHJhbnNsYXRpb25zID0ge1xuXHRzZXR0aW5nczoge1xuXHRcdHRpdGxlOiAnQUnmmbrog73liIbnsbvorr7nva4nLFxuXHRcdGFpUHJvdmlkZXI6ICdBSSDmj5DkvpvllYYnLFxuXHRcdGFpUHJvdmlkZXJEZXNjOiAn6YCJ5oupIEFJIOacjeWKoeeahOaPkOS+m+aWuScsXG5cdFx0b2xsYW1hVXJsOiAnT2xsYW1hIOWcsOWdgCcsXG5cdFx0b2xsYW1hVXJsRGVzYzogJ+acrOWcsCBPbGxhbWEg5pyN5Yqh55qE5Zyw5Z2AJyxcblx0XHRvbGxhbWFNb2RlbDogJ09sbGFtYSDmqKHlnosnLFxuXHRcdG9sbGFtYU1vZGVsRGVzYzogJ+S9v+eUqOeahOaooeWei+WQjeensCcsXG5cdFx0b3BlbmFpQXBpS2V5OiAnT3BlbkFJIEFQSSBLZXknLFxuXHRcdG9wZW5haUFwaUtleURlc2M6ICfmgqjnmoQgT3BlbkFJIEFQSSDlr4bpkqUnLFxuXHRcdG9wZW5haU1vZGVsOiAnT3BlbkFJIOaooeWeiycsXG5cdFx0b3BlbmFpTW9kZWxEZXNjOiAn5L2/55So55qEIE9wZW5BSSDmqKHlnosnLFxuXHRcdGluYm94Rm9sZGVyOiAn5pS25Lu2566x5paH5Lu25aS5Jyxcblx0XHRpbmJveEZvbGRlckRlc2M6ICflvoXliIbnsbvmlofku7bmiYDlnKjnmoTmlofku7blpLknLFxuXHRcdGNhdGVnb3J5VHJlZTogJ+WIhuexu+e7k+aehCcsXG5cdFx0Y2F0ZWdvcnlUcmVlRGVzYzogJ+WumuS5ieaCqOeahOWIhuexu+agkee7k+aehO+8iEpTT07moLzlvI/vvIknLFxuXHRcdGNhdGVnb3JpZXM6ICfliIbnsbvliJfooagnLFxuXHRcdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXM6ICflkK/nlKggQUkg5o6o6I2Q5paw5YiG57G7Jyxcblx0XHRlbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzRGVzYzogJ+W9k+aWh+eroOaXoOazleWMuemFjeeOsOacieWIhuexu+aXtu+8jEFJIOWPr+S7peW7uuiuruaWsOWIhuexuycsXG5cdFx0YXV0b01vdmVGaWxlOiAn6Ieq5Yqo56e75Yqo5paH5Lu2Jyxcblx0XHRhdXRvTW92ZUZpbGVEZXNjOiAn5YiG57G75a6M5oiQ5ZCO6Ieq5Yqo5bCG5paH5Lu256e75Yqo5Yiw5a+55bqU5paH5Lu25aS5Jyxcblx0XHRjb25maWRlbmNlVGhyZXNob2xkOiAn572u5L+h5bqm6ZiI5YC8Jyxcblx0XHRjb25maWRlbmNlVGhyZXNob2xkRGVzYzogJ+S9juS6juatpOe9ruS/oeW6puWwhuaPkOekuueUqOaIt+ehruiupCcsXG5cdFx0ZW5hYmxlRGVidWdMb2c6ICflkK/nlKjosIPor5Xml6Xlv5cnLFxuXHRcdGVuYWJsZURlYnVnTG9nRGVzYzogJ+WcqOaOp+WItuWPsOi+k+WHuuivpue7huaXpeW/lycsXG5cdFx0dGVzdENvbm5lY3Rpb246ICfmtYvor5Xov57mjqUnLFxuXHRcdGNvbm5lY3Rpb25TdWNjZXNzOiAn6L+e5o6l5oiQ5Yqf77yBJyxcblx0XHRjb25uZWN0aW9uRmFpbGVkOiAn6L+e5o6l5aSx6LSl77yaJyxcblx0XHRzYXZlOiAn5L+d5a2Y6K6+572uJyxcblx0XHRjYXRlZ29yaWVzUGxhY2Vob2xkZXI6ICfnvJbnqIsv5YmN56uvLCDnvJbnqIsv5ZCO56uvLCBBSS/mnLrlmajlrabkuaAsIC4uLicsXG5cdFx0YWRkVG9wTGV2ZWw6ICfmt7vliqDkuIDnuqfliIbnsbsnLFxuXHRcdGVudGVyQ2F0ZWdvcnlOYW1lOiAn6K+36L6T5YWl5YiG57G75ZCN56ewJyxcblx0XHRlbnRlck5ld05hbWU6ICfor7fovpPlhaXmlrDlkI3np7AnLFxuXHRcdGNhdGVnb3J5RXhpc3RzOiAn5YiG57G75bey5a2Y5ZyoJyxcblx0XHRjb25maXJtRGVsZXRlOiAn56Gu6K6k5Yig6Zmk5q2k5YiG57G777yfJyxcblx0XHRjb25maXJtRGVsZXRlV2l0aENoaWxkcmVuOiAn5q2k5YiG57G75YyF5ZCr5a2Q5YiG57G777yM56Gu6K6k5Yig6Zmk5omA5pyJ5a2Q5YiG57G75ZCX77yfJyxcblx0XHRyZXN0b3JlRGVmYXVsdDogJ+aBouWkjem7mOiupCcsXG5cdFx0Y29uZmlybVJlc3RvcmVEZWZhdWx0OiAn56Gu6K6k5oGi5aSN6buY6K6k5YiG57G75qCR77yf5b2T5YmN55qE6Ieq5a6a5LmJ6YWN572u5bCG5Lii5aSx44CCJyxcblx0fSxcblx0Y2xhc3NpZnk6IHtcblx0XHRjb21tYW5kOiAnQUnmmbrog73liIbnsbsnLFxuXHRcdGNsYXNzaWZ5SW5ib3g6ICfliIbnsbvmlLbku7bnrrEnLFxuXHRcdGNsYXNzaWZ5Q3VycmVudDogJ+WIhuexu+W9k+WJjeaWh+S7ticsXG5cdFx0cHJvY2Vzc2luZzogJ+ato+WcqOWIhuaekDogJyxcblx0XHRzdWNjZXNzOiAn5YiG57G75a6M5oiQJyxcblx0XHRtb3ZlZDogJ+W3suenu+WKqOWIsDogJyxcblx0XHR1bmNlcnRhaW46ICfnva7kv6HluqbovoPkvY4gKCcsXG5cdFx0Y29uZmlybTogJ+aYr+WQpuehruiupOWIhuexu+WIsDogJyxcblx0XHRsb3dDb25maWRlbmNlOiAn572u5L+h5bqm6L+H5L2O77yM6K+35omL5Yqo56Gu6K6kJyxcblx0XHRzdWdnZXN0ZWRDYXRlZ29yeTogJ+W7uuiuruaWsOWinuWIhuexuzogJyxcblx0XHRhZGRDYXRlZ29yeTogJ+aYr+WQpuWwhuatpOWIhuexu+a3u+WKoOWIsOmihOiuvj8nLFxuXHRcdG5vSW5ib3g6ICfmnKrmib7liLDmlLbku7bnrrHmlofku7blpLk6ICcsXG5cdFx0bm9GaWxlczogJ+aUtuS7tueuseS4reayoeacieaWh+S7ticsXG5cdFx0c2tpcDogJ+i3s+i/hycsXG5cdH0sXG5cdGVycm9yczoge1xuXHRcdG5vQ29udGVudDogJ+aXoOazleaPkOWPluaWh+S7tuWGheWuuScsXG5cdFx0bm9UaXRsZTogJ+aXoOazleiOt+WPluaWh+S7tuagh+mimCcsXG5cdFx0YWlFcnJvcjogJ0FJIOacjeWKoemUmeivrzogJyxcblx0XHRtb3ZlRXJyb3I6ICfnp7vliqjmlofku7blpLHotKU6ICcsXG5cdH0sXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IGtleXMgPSBrZXkuc3BsaXQoJy4nKTtcblx0bGV0IHJlc3VsdDogYW55ID0gdHJhbnNsYXRpb25zO1xuXHRmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuXHRcdHJlc3VsdCA9IHJlc3VsdD8uW2tdO1xuXHR9XG5cdHJldHVybiByZXN1bHQgfHwga2V5O1xufVxuIiwiaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5pbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBOb3RpY2UgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8vIOWjsOaYjuWFqOWxgCBhcHAg5Y+Y6YePXG5kZWNsYXJlIGNvbnN0IGFwcDogQXBwO1xuXG4vKipcbiAqIOWIhuexu+agkeiKgueCueaVsOaNrue7k+aehFxuICovXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5Tm9kZSB7XG5cdG5hbWU6IHN0cmluZztcblx0Y2hpbGRyZW4/OiBDYXRlZ29yeU5vZGVbXTtcbn1cblxuLyoqXG4gKiDliIbnsbvmoJHlj6/op4bljJbnu4Tku7ZcbiAqL1xuZXhwb3J0IGNsYXNzIENhdGVnb3J5VHJlZVZpZXcge1xuXHRwcml2YXRlIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0cmVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuXHRwcml2YXRlIG9uQ2hhbmdlOiAodHJlZTogUmVjb3JkPHN0cmluZywgYW55PikgPT4gdm9pZDtcblx0cHJpdmF0ZSBleHBhbmRlZE5vZGVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0dHJlZTogUmVjb3JkPHN0cmluZywgYW55Pixcblx0XHRvbkNoYW5nZTogKHRyZWU6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IHZvaWRcblx0KSB7XG5cdFx0dGhpcy5jb250YWluZXJFbCA9IGNvbnRhaW5lckVsO1xuXHRcdHRoaXMudHJlZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodHJlZSkpOyAvLyDmt7Hmi7fotJ1cblx0XHR0aGlzLm9uQ2hhbmdlID0gb25DaGFuZ2U7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmuLLmn5PmlbTkuKrmoJFcblx0ICovXG5cdHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHR0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKCdjYXRlZ29yeS10cmVlLWNvbnRhaW5lcicpO1xuXG5cdFx0Ly8g5riy5p+T5qCR5b2i57uT5p6EXG5cdFx0Y29uc3QgdHJlZUVsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUnKTtcblx0XHR0aGlzLnJlbmRlclRyZWVMZXZlbCh0cmVlRWwsIHRoaXMudHJlZSwgJycpO1xuXG5cdFx0Ly8g5re75Yqg5LiA57qn5YiG57G75oyJ6ZKuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtYWN0aW9ucycpO1xuXHRcdGNvbnN0IGFkZEJ0biA9IGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0XHR0ZXh0OiB0KCdzZXR0aW5ncy5hZGRUb3BMZXZlbCcpXG5cdFx0fSk7XG5cdFx0YWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5hZGRUb3BMZXZlbENhdGVnb3J5KCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5riy5p+T5qCR55qE5p+Q5LiA57qnXG5cdCAqL1xuXHRwcml2YXRlIHJlbmRlclRyZWVMZXZlbChcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG5vZGU6IFJlY29yZDxzdHJpbmcsIGFueT4sXG5cdFx0cGF0aDogc3RyaW5nXG5cdCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGUpKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50UGF0aCA9IHBhdGggPyBgJHtwYXRofS8ke2tleX1gIDoga2V5O1xuXHRcdFx0Y29uc3QgaGFzQ2hpbGRyZW4gPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPiAwO1xuXHRcdFx0Y29uc3QgaXNFeHBhbmRlZCA9IHRoaXMuZXhwYW5kZWROb2Rlcy5oYXMoY3VycmVudFBhdGgpO1xuXG5cdFx0XHQvLyDliJvlu7roioLngrnlrrnlmahcblx0XHRcdGNvbnN0IG5vZGVFbCA9IGNvbnRhaW5lci5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUnKTtcblxuXHRcdFx0Ly8g6IqC54K56KGM77yI5ZCN56ewICsg5pON5L2c5oyJ6ZKu77yJXG5cdFx0XHRjb25zdCBub2RlUm93ID0gbm9kZUVsLmNyZWF0ZURpdignY2F0ZWdvcnktbm9kZS1yb3cnKTtcblxuXHRcdFx0Ly8g5bGV5byAL+aKmOWPoOaMiemSru+8iOS7heW9k+acieWtkOiKgueCueaXtuaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IGV4cGFuZEJ0biA9IG5vZGVSb3cuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1leHBhbmQtYnRuJyxcblx0XHRcdFx0XHR0ZXh0OiBpc0V4cGFuZGVkID8gJ+KWvCcgOiAn4pa2J1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZXhwYW5kQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpc0V4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4cGFuZGVkTm9kZXMuZGVsZXRlKGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5leHBhbmRlZE5vZGVzLmFkZChjdXJyZW50UGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8g5Y2g5L2N56ym77yM5L+d5oyB5a+56b2QXG5cdFx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7IGNsczogJ2NhdGVnb3J5LWV4cGFuZC1wbGFjZWhvbGRlcicsIHRleHQ6ICfjgIAnIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyDlm77moIdcblx0XHRcdG5vZGVSb3cuY3JlYXRlRWwoJ3NwYW4nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWljb24nLFxuXHRcdFx0XHR0ZXh0OiBoYXNDaGlsZHJlbiA/ICfwn5OCJyA6ICfwn5OEJ1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWQjeensFxuXHRcdFx0bm9kZVJvdy5jcmVhdGVFbCgnc3BhbicsIHtcblx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktbmFtZScsXG5cdFx0XHRcdHRleHQ6IGtleVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOaTjeS9nOaMiemSruWuueWZqFxuXHRcdFx0Y29uc3QgYWN0aW9uc0VsID0gbm9kZVJvdy5jcmVhdGVEaXYoJ2NhdGVnb3J5LW5vZGUtYWN0aW9ucycpO1xuXG5cdFx0XHQvLyDnvJbovpHmjInpkq5cblx0XHRcdGFjdGlvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1hY3Rpb24tYnRuJyxcblx0XHRcdFx0dGV4dDogJ+Kcj++4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXROb2RlKGN1cnJlbnRQYXRoLCBrZXkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOWIoOmZpOaMiemSrlxuXHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWFjdGlvbi1idG4nLFxuXHRcdFx0XHR0ZXh0OiAn8J+Xke+4jydcblx0XHRcdH0pLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRlbGV0ZU5vZGUoY3VycmVudFBhdGgsIGtleSwgaGFzQ2hpbGRyZW4pO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIOa3u+WKoOWtkOWIhuexu+aMiemSru+8iOS7heWvueeItuiKgueCueaYvuekuu+8iVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktYWN0aW9uLWJ0bicsXG5cdFx0XHRcdFx0dGV4dDogJ+KelSdcblx0XHRcdFx0fSkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5hZGRDaGlsZENhdGVnb3J5KGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIOa4suafk+WtkOiKgueCuVxuXHRcdFx0aWYgKGhhc0NoaWxkcmVuICYmIGlzRXhwYW5kZWQpIHtcblx0XHRcdFx0Y29uc3QgY2hpbGRyZW5FbCA9IG5vZGVFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LWNoaWxkcmVuJyk7XG5cdFx0XHRcdHRoaXMucmVuZGVyVHJlZUxldmVsKGNoaWxkcmVuRWwsIHZhbHVlLCBjdXJyZW50UGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIOa3u+WKoOS4gOe6p+WIhuexu1xuXHQgKi9cblx0cHJpdmF0ZSBhZGRUb3BMZXZlbENhdGVnb3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuc2hvd1Byb21wdE1vZGFsKFxuXHRcdFx0dCgnc2V0dGluZ3MuZW50ZXJDYXRlZ29yeU5hbWUnKSxcblx0XHRcdCcnLFxuXHRcdFx0KG5hbWUpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMudHJlZVtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudHJlZVtuYW1lXSA9IHt9O1xuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5re75Yqg5a2Q5YiG57G7XG5cdCAqL1xuXHRwcml2YXRlIGFkZENoaWxkQ2F0ZWdvcnkocGFyZW50UGF0aDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zaG93UHJvbXB0TW9kYWwoXG5cdFx0XHR0KCdzZXR0aW5ncy5lbnRlckNhdGVnb3J5TmFtZScpLFxuXHRcdFx0JycsXG5cdFx0XHQobmFtZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLmdldE5vZGVCeVBhdGgocGFyZW50UGF0aCk7XG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGFyZW50W25hbWVdID0ge307XG5cdFx0XHRcdHRoaXMuZXhwYW5kZWROb2Rlcy5hZGQocGFyZW50UGF0aCk7XG5cdFx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDnvJbovpHoioLngrnlkI3np7Bcblx0ICovXG5cdHByaXZhdGUgZWRpdE5vZGUocGF0aDogc3RyaW5nLCBvbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNob3dQcm9tcHRNb2RhbChcblx0XHRcdHQoJ3NldHRpbmdzLmVudGVyTmV3TmFtZScpLFxuXHRcdFx0b2xkTmFtZSxcblx0XHRcdChuZXdOYW1lKSA9PiB7XG5cdFx0XHRcdGlmICghbmV3TmFtZSB8fCBuZXdOYW1lLnRyaW0oKSA9PT0gJycgfHwgbmV3TmFtZSA9PT0gb2xkTmFtZSkgcmV0dXJuO1xuXG5cdFx0XHRcdGNvbnN0IHBhdGhQYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRQYXRoID8gdGhpcy5nZXROb2RlQnlQYXRoKHBhcmVudFBhdGgpIDogdGhpcy50cmVlO1xuXG5cdFx0XHRcdGlmICghcGFyZW50KSByZXR1cm47XG5cblx0XHRcdFx0aWYgKHBhcmVudFtuZXdOYW1lXSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY2F0ZWdvcnlFeGlzdHMnKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8g6YeN5ZG95ZCNXG5cdFx0XHRcdHBhcmVudFtuZXdOYW1lXSA9IHBhcmVudFtvbGROYW1lXTtcblx0XHRcdFx0ZGVsZXRlIHBhcmVudFtvbGROYW1lXTtcblxuXHRcdFx0XHR0aGlzLm5vdGlmeUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICog5Yig6Zmk6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGRlbGV0ZU5vZGUocGF0aDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGhhc0NoaWxkcmVuOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGhhc0NoaWxkcmVuXG5cdFx0XHQ/IHQoJ3NldHRpbmdzLmNvbmZpcm1EZWxldGVXaXRoQ2hpbGRyZW4nKVxuXHRcdFx0OiB0KCdzZXR0aW5ncy5jb25maXJtRGVsZXRlJyk7XG5cblx0XHR0aGlzLnNob3dDb25maXJtTW9kYWwobWVzc2FnZSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50UGF0aCA9IHBhdGhQYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLycpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gcGFyZW50UGF0aCA/IHRoaXMuZ2V0Tm9kZUJ5UGF0aChwYXJlbnRQYXRoKSA6IHRoaXMudHJlZTtcblxuXHRcdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdFx0ZGVsZXRlIHBhcmVudFtuYW1lXTtcblx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICog5qC55o2u6Lev5b6E6I635Y+W6IqC54K5XG5cdCAqL1xuXHRwcml2YXRlIGdldE5vZGVCeVBhdGgocGF0aDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgYW55PiB8IG51bGwge1xuXHRcdGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdGxldCBjdXJyZW50OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0gdGhpcy50cmVlO1xuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG5cdFx0XHRpZiAoIWN1cnJlbnRbcGFydF0pIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50ID0gY3VycmVudFtwYXJ0XTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY3VycmVudDtcblx0fVxuXG5cdC8qKlxuXHQgKiDpgJrnn6XlpJbpg6jmoJHlt7Lmm7TmlrBcblx0ICovXG5cdHByaXZhdGUgbm90aWZ5Q2hhbmdlKCk6IHZvaWQge1xuXHRcdHRoaXMub25DaGFuZ2UodGhpcy50cmVlKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOabtOaWsOagkeaVsOaNru+8iOWklumDqOiwg+eUqO+8iVxuXHQgKi9cblx0dXBkYXRlVHJlZShuZXdUcmVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogdm9pZCB7XG5cdFx0dGhpcy50cmVlID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShuZXdUcmVlKSk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmmL7npLrovpPlhaXlr7nor53moYZcblx0ICovXG5cdHByaXZhdGUgc2hvd1Byb21wdE1vZGFsKFxuXHRcdHBsYWNlaG9sZGVyOiBzdHJpbmcsXG5cdFx0ZGVmYXVsdFZhbHVlOiBzdHJpbmcsXG5cdFx0b25TdWJtaXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkXG5cdCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGFsID0gbmV3IElucHV0TW9kYWwoXG5cdFx0XHRwbGFjZWhvbGRlcixcblx0XHRcdGRlZmF1bHRWYWx1ZSxcblx0XHRcdG9uU3VibWl0XG5cdFx0KTtcblx0XHRtb2RhbC5vcGVuKCk7XG5cdH1cblxuXHQvKipcblx0ICog5pi+56S656Gu6K6k5a+56K+d5qGGXG5cdCAqL1xuXHRwcml2YXRlIHNob3dDb25maXJtTW9kYWwoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdG9uQ29uZmlybTogKCkgPT4gdm9pZFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RhbCA9IG5ldyBDb25maXJtTW9kYWwoXG5cdFx0XHRtZXNzYWdlLFxuXHRcdFx0b25Db25maXJtXG5cdFx0KTtcblx0XHRtb2RhbC5vcGVuKCk7XG5cdH1cbn1cblxuLyoqXG4gKiDovpPlhaXlr7nor53moYZcbiAqL1xuY2xhc3MgSW5wdXRNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBwbGFjZWhvbGRlcjogc3RyaW5nO1xuXHRwcml2YXRlIGRlZmF1bHRWYWx1ZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uU3VibWl0OiAodmFsdWU6IHN0cmluZykgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwbGFjZWhvbGRlcjogc3RyaW5nLFxuXHRcdGRlZmF1bHRWYWx1ZTogc3RyaW5nLFxuXHRcdG9uU3VibWl0OiAodmFsdWU6IHN0cmluZykgPT4gdm9pZFxuXHQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0XHR0aGlzLmRlZmF1bHRWYWx1ZSA9IGRlZmF1bHRWYWx1ZTtcblx0XHR0aGlzLm9uU3VibWl0ID0gb25TdWJtaXQ7XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLnBsYWNlaG9sZGVyIH0pO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjb250ZW50RWwuY3JlYXRlRWwoJ2lucHV0Jywge1xuXHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0dmFsdWU6IHRoaXMuZGVmYXVsdFZhbHVlXG5cdFx0fSk7XG5cblx0XHRpbnB1dC5zdHlsZS53aWR0aCA9ICcxMDAlJztcblx0XHRpbnB1dC5zdHlsZS5tYXJnaW5Cb3R0b20gPSAnMjBweCc7XG5cblx0XHQvLyDnm5HlkKzlm57ovabplK5cblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGUpID0+IHtcblx0XHRcdGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuXHRcdFx0XHR0aGlzLm9uU3VibWl0KGlucHV0LnZhbHVlKTtcblx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYnV0dG9uc0VsID0gY29udGVudEVsLmNyZWF0ZURpdignbW9kYWwtYnV0dG9uLWNvbnRhaW5lcicpO1xuXHRcdGJ1dHRvbnNFbC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdGJ1dHRvbnNFbC5zdHlsZS5qdXN0aWZ5Q29udGVudCA9ICdmbGV4LWVuZCc7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmdhcCA9ICc4cHgnO1xuXG5cdFx0Y29uc3QgY2FuY2VsQnRuID0gYnV0dG9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7IHRleHQ6ICflj5bmtognIH0pO1xuXHRcdGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuY2xvc2UoKSk7XG5cblx0XHRjb25zdCBjb25maXJtQnRuID0gYnV0dG9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHR0ZXh0OiAn56Gu5a6aJyxcblx0XHRcdGNsczogJ21vZC1jdGEnXG5cdFx0fSk7XG5cdFx0Y29uZmlybUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMub25TdWJtaXQoaW5wdXQudmFsdWUpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0Ly8g6Ieq5Yqo6IGa54SmXG5cdFx0aW5wdXQuZm9jdXMoKTtcblx0XHRpbnB1dC5zZWxlY3QoKTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cblxuLyoqXG4gKiDnoa7orqTlr7nor53moYZcbiAqL1xuY2xhc3MgQ29uZmlybU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwcml2YXRlIG1lc3NhZ2U6IHN0cmluZztcblx0cHJpdmF0ZSBvbkNvbmZpcm06ICgpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdG9uQ29uZmlybTogKCkgPT4gdm9pZFxuXHQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5vbkNvbmZpcm0gPSBvbkNvbmZpcm07XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLm1lc3NhZ2UgfSk7XG5cblx0XHRjb25zdCBidXR0b25zRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KCdtb2RhbC1idXR0b24tY29udGFpbmVyJyk7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmp1c3RpZnlDb250ZW50ID0gJ2ZsZXgtZW5kJztcblx0XHRidXR0b25zRWwuc3R5bGUuZ2FwID0gJzhweCc7XG5cblx0XHRjb25zdCBjYW5jZWxCdG4gPSBidXR0b25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgdGV4dDogJ+WPlua2iCcgfSk7XG5cdFx0Y2FuY2VsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5jbG9zZSgpKTtcblxuXHRcdGNvbnN0IGNvbmZpcm1CdG4gPSBidXR0b25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICfnoa7lrponLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oKTtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgQUlDbGFzc2lmaWVyUGx1Z2luIGZyb20gJy4uL21haW4nO1xuaW1wb3J0IHsgQUlQcm92aWRlclR5cGUsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgQ2F0ZWdvcnlUcmVlVmlldyB9IGZyb20gJy4vQ2F0ZWdvcnlUcmVlVmlldyc7XG5cbi8vIOWQhOacjeWKoeWVhuWPr+eUqOaooeWei+WIl+ihqFxuY29uc3QgQVZBSUxBQkxFX01PREVMUzogUmVjb3JkPHN0cmluZywgQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+PiA9IHtcblx0b3BlbmFpOiBbXG5cdFx0eyB2YWx1ZTogJ2dwdC00by1taW5pJywgbGFiZWw6ICdHUFQtNG8gTWluaSAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTRvJywgbGFiZWw6ICdHUFQtNG8nIH0sXG5cdFx0eyB2YWx1ZTogJ2dwdC00LXR1cmJvJywgbGFiZWw6ICdHUFQtNCBUdXJibycgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTMuNS10dXJibycsIGxhYmVsOiAnR1BULTMuNSBUdXJibycgfSxcblx0XSxcblx0ZGVlcHNlZWs6IFtcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY2hhdCcsIGxhYmVsOiAnRGVlcFNlZWsgQ2hhdCAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZGVlcHNlZWstY29kZXInLCBsYWJlbDogJ0RlZXBTZWVrIENvZGVyJyB9LFxuXHRdLFxuXHRtb29uc2hvdDogW1xuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS04aycsIGxhYmVsOiAnTW9vbnNob3QgVjEgOEsgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ21vb25zaG90LXYxLTMyaycsIGxhYmVsOiAnTW9vbnNob3QgVjEgMzJLJyB9LFxuXHRcdHsgdmFsdWU6ICdtb29uc2hvdC12MS0xMjhrJywgbGFiZWw6ICdNb29uc2hvdCBWMSAxMjhLJyB9LFxuXHRdLFxuXHR6aGlwdTogW1xuXHRcdHsgdmFsdWU6ICdnbG0tNCcsIGxhYmVsOiAnR0xNLTQgKOaOqOiNkCknIH0sXG5cdFx0eyB2YWx1ZTogJ2dsbS00LWZsYXNoJywgbGFiZWw6ICdHTE0tNCBGbGFzaCcgfSxcblx0XHR7IHZhbHVlOiAnZ2xtLTMtdHVyYm8nLCBsYWJlbDogJ0dMTS0zIFR1cmJvJyB9LFxuXHRdLFxufTtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luO1xuXHRcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cdFxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHRcblx0XHQvLyDpobbpg6jlr7zoiKrmoI9cblx0XHRjb25zdCBoZWFkZXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignc2V0dGluZ3MtaGVhZGVyJyk7XG5cdFx0aGVhZGVyRWwuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEycHg7IG1hcmdpbi1ib3R0b206IDIwcHg7Jztcblx0XHRcblx0XHQvLyDov5Tlm57mjInpkq5cblx0XHRjb25zdCBiYWNrQnRuID0gaGVhZGVyRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdGNsczogJ2NsaWNrYWJsZS1pY29uJyxcblx0XHRcdGF0dHI6IHtcblx0XHRcdFx0J2FyaWEtbGFiZWwnOiAn6L+U5Zue5LiK5LiA57qnJyxcblx0XHRcdFx0J3RpdGxlJzogJ+i/lOWbnuS4iuS4gOe6pydcblx0XHRcdH1cblx0XHR9KTtcblx0XHRiYWNrQnRuLmlubmVySFRNTCA9ICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjI0XCIgaGVpZ2h0PVwiMjRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIm0xNSAxOC02LTYgNi02XCIvPjwvc3ZnPic7XG5cdFx0YmFja0J0bi5zdHlsZS5jc3NUZXh0ID0gJ2JhY2tncm91bmQ6IG5vbmU7IGJvcmRlcjogbm9uZTsgY3Vyc29yOiBwb2ludGVyOyBwYWRkaW5nOiA0cHg7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyOyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7Jztcblx0XHRiYWNrQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0Ly8g55u05o6l6Kem5Y+RIE9ic2lkaWFuIOiHquW4pueahOi/lOWbnuWKn+iDvVxuXHRcdFx0Ly8g5p+l5om+6K6+572u5L6n6L655qCP5Lit55qE56ys5LiA5Liq5o+S5Lu26YCJ6aG55bm254K55Ye7XG5cdFx0XHRjb25zdCBjb21tdW5pdHlQbHVnaW5OYXZJdGVtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm5hdi1mb2xkZXIubW9kLXJvb3QgPiAubmF2LWZvbGRlci10aXRsZScpO1xuXHRcdFx0aWYgKGNvbW11bml0eVBsdWdpbk5hdkl0ZW0pIHtcblx0XHRcdFx0KGNvbW11bml0eVBsdWdpbk5hdkl0ZW0gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyDlpoLmnpzmib7kuI3liLDvvIzlsJ3or5Xngrnlh7vku7vkvZXkuIDkuKrkvqfovrnmoI/poblcblx0XHRcdFx0Y29uc3QgYW55TmF2SXRlbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy52ZXJ0aWNhbC10YWItbmF2LWl0ZW0nKTtcblx0XHRcdFx0aWYgKGFueU5hdkl0ZW0pIHtcblx0XHRcdFx0XHQoYW55TmF2SXRlbSBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGJhY2tCdG4uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgKCkgPT4ge1xuXHRcdFx0YmFja0J0bi5zdHlsZS5jb2xvciA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuXHRcdH0pO1xuXHRcdGJhY2tCdG4uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdXQnLCAoKSA9PiB7XG5cdFx0XHRiYWNrQnRuLnN0eWxlLmNvbG9yID0gJ3ZhcigtLXRleHQtbXV0ZWQpJztcblx0XHR9KTtcblx0XHRcblx0XHQvLyDmoIfpophcblx0XHRjb25zdCB0aXRsZUVsID0gaGVhZGVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiB0KCdzZXR0aW5ncy50aXRsZScpIH0pO1xuXHRcdHRpdGxlRWwuc3R5bGUuY3NzVGV4dCA9ICdtYXJnaW46IDA7IGZsZXg6IDE7Jztcblx0XHRcblx0XHR0aGlzLmFkZEFJUHJvdmlkZXJTZWN0aW9uKCk7XG5cdFx0dGhpcy5hZGRDYXRlZ29yeVNlY3Rpb24oKTtcblx0XHR0aGlzLmFkZEFkdmFuY2VkU2VjdGlvbigpO1xuXHRcdHRoaXMuYWRkRGVidWdTZWN0aW9uKCk7XG5cdH1cblx0XG5cdHByaXZhdGUgYWRkQUlQcm92aWRlclNlY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdBSSDphY3nva4nIH0pO1xuXHRcdFxuXHRcdC8vIEFJIOaPkOS+m+WVhumAieaLqVxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuYWlQcm92aWRlcicpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuYWlQcm92aWRlckRlc2MnKSlcblx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignb2xsYW1hJywgJ09sbGFtYSAo5pys5ZywKScpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignb3BlbmFpJywgJ09wZW5BSScpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignZGVlcHNlZWsnLCAnRGVlcFNlZWsnKVxuXHRcdFx0XHRcdC5hZGRPcHRpb24oJ21vb25zaG90JywgJ01vb25zaG90IChLaW1pKScpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignemhpcHUnLCAnWmhpcHUgKOaZuuiwsSBBSSknKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIgPSB2YWx1ZSBhcyBBSVByb3ZpZGVyVHlwZTtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciA9PT0gJ29sbGFtYScpIHtcblx0XHRcdC8vIE9sbGFtYSDphY3nva5cblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5vbGxhbWFVcmwnKSlcblx0XHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3Mub2xsYW1hVXJsRGVzYycpKVxuXHRcdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm9sbGFtYVVybClcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hVXJsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3Mub2xsYW1hTW9kZWwnKSlcblx0XHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3Mub2xsYW1hTW9kZWxEZXNjJykpXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwpXG5cdFx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm9sbGFtYU1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBUEkgS2V5IOmFjee9rlxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIEtleWApXG5cdFx0XHRcdC5zZXREZXNjKGDor7fovpPlhaUgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOeahCBBUEkgS2V5YClcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLmdldFByb3ZpZGVyVmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2FwaUtleScpKVxuXHRcdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdzay0uLi4nKVxuXHRcdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb3ZpZGVyQ29uZmlnKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdhcGlLZXknLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLnR5cGUgPSAncGFzc3dvcmQnO1xuXHRcdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gTW9kZWwg6YWN572u77yI5LiL5ouJ6YCJ5oup77yJXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUoYCR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSDmqKHlnotgKVxuXHRcdFx0XHQuc2V0RGVzYyhg6K+36YCJ5oupICR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSDnmoTmqKHlnotgKVxuXHRcdFx0XHQuYWRkRHJvcGRvd24oZHJvcGRvd24gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVscyA9IHRoaXMuZ2V0QXZhaWxhYmxlTW9kZWxzKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpO1xuXHRcdFx0XHRcdG1vZGVscy5mb3JFYWNoKG1vZGVsID0+IHtcblx0XHRcdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihtb2RlbC52YWx1ZSwgbW9kZWwubGFiZWwpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuZ2V0UHJvdmlkZXJWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnbW9kZWwnKSlcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlckNvbmZpZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnbW9kZWwnLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyBBUEkgVVJMIOmFjee9ru+8iOmrmOe6p+mAiemhue+8iVxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKGAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0gQVBJIOWcsOWdgGApXG5cdFx0XHRcdC5zZXREZXNjKCfoh6rlrprkuYkgQVBJIOerr+eCueWcsOWdgO+8iOWPr+mAie+8jOeVmeepuuS9v+eUqOWumOaWueWcsOWdgO+8iScpXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5nZXRQcm92aWRlclZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdiYXNlVXJsJykpXG5cdFx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ2h0dHBzOi8vYXBpLmV4YW1wbGUuY29tL3YxJylcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlckNvbmZpZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnYmFzZVVybCcsIHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOa1i+ivlei/nuaOpeaMiemSrlxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LmFkZEJ1dHRvbihidXR0b24gPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dCh0KCdzZXR0aW5ncy50ZXN0Q29ubmVjdGlvbicpKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGJ1dHRvbi5zZXREaXNhYmxlZCh0cnVlKTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wbHVnaW4uZ2V0QUlQcm92aWRlcigpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci50ZXN0Q29ubmVjdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdFx0XHRuZXcgTm90aWNlKHQoJ3NldHRpbmdzLmNvbm5lY3Rpb25TdWNjZXNzJykpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvbkZhaWxlZCcpICsgcmVzdWx0Lm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvbkZhaWxlZCcpICsgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLnNldERpc2FibGVkKGZhbHNlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZENhdGVnb3J5U2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ+WIhuexu+mFjee9ricgfSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5pbmJveEZvbGRlcicpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuaW5ib3hGb2xkZXJEZXNjJykpXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmJveEZvbGRlcilcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmJveEZvbGRlciA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCfmiavmj4/lrZDmlofku7blpLknKVxuXHRcdFx0LnNldERlc2MoJ+aYr+WQpumAkuW9kuaJq+aPj+aUtuS7tueuseWtkOebruW9leS4reeahOaWh+S7tuOAguWFs+mXreWImeWPquWIhuexu+aUtuS7tueusemhtuWxgueahOaWh+S7tuOAgicpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycyA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHQvLyDlj6/op4bljJbliIbnsbvmoJFcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6IHQoJ3NldHRpbmdzLmNhdGVnb3J5VHJlZScpIH0pO1xuXHRcdFxuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoJ2NhdGVnb3J5LXRyZWUtd3JhcHBlcicpO1xuXHRcdFxuXHRcdG5ldyBDYXRlZ29yeVRyZWVWaWV3KFxuXHRcdFx0dHJlZUNvbnRhaW5lcixcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSxcblx0XHRcdChuZXdUcmVlKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSA9IG5ld1RyZWU7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKG5ld1RyZWUpO1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH1cblx0XHQpO1xuXHRcdFxuXHRcdC8vIOaTjeS9nOaMiemSrlxuXHRcdGNvbnN0IGFjdGlvbnNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignY2F0ZWdvcnktdHJlZS1mb290ZXInKTtcblx0XHRuZXcgU2V0dGluZyhhY3Rpb25zRWwpXG5cdFx0XHQuYWRkQnV0dG9uKGJ0biA9PiB7XG5cdFx0XHRcdGJ0bi5zZXRCdXR0b25UZXh0KHQoJ3NldHRpbmdzLnJlc3RvcmVEZWZhdWx0JykpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGNvbmZpcm0odCgnc2V0dGluZ3MuY29uZmlybVJlc3RvcmVEZWZhdWx0JykpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3J5VHJlZSA9IERFRkFVTFRfU0VUVElOR1MuY2F0ZWdvcnlUcmVlO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyhERUZBVUxUX1NFVFRJTkdTLmNhdGVnb3J5VHJlZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTsgLy8g5Yi35paw6K6+572u6Z2i5p2/XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBhZGRBZHZhbmNlZFNlY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICfpq5jnuqforr7nva4nIH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcycpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllc0Rlc2MnKSlcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHtcblx0XHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXMpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcyA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmF1dG9Nb3ZlRmlsZScpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuYXV0b01vdmVGaWxlRGVzYycpKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0XHR0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b01vdmVGaWxlKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGQnKSlcblx0XHRcdC5zZXREZXNjKHQoJ3NldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGREZXNjJykpXG5cdFx0XHQuYWRkU2xpZGVyKHNsaWRlciA9PiB7XG5cdFx0XHRcdHNsaWRlci5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkICogMTAwKVxuXHRcdFx0XHRcdC5zZXRMaW1pdHMoMCwgMTAwLCAxKVxuXHRcdFx0XHRcdC5zZXREeW5hbWljVG9vbHRpcCgpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCA9IHZhbHVlIC8gMTAwO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBhZGREZWJ1Z1NlY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICfosIPor5UnIH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cnKSlcblx0XHRcdC5zZXREZXNjKHQoJ3NldHRpbmdzLmVuYWJsZURlYnVnTG9nRGVzYycpKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0XHR0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblx0XG5cdHByaXZhdGUgZmxhdHRlbkNhdGVnb3JpZXModHJlZTogYW55LCBwcmVmaXggPSAnJyk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModHJlZSkpIHtcblx0XHRcdGNvbnN0IHBhdGggPSBwcmVmaXggPyBgJHtwcmVmaXh9LyR7a2V5fWAgOiBrZXk7XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCguLi50aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKHZhbHVlLCBwYXRoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucHVzaChwYXRoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRBdmFpbGFibGVNb2RlbHMocHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlKTogQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+IHtcblx0XHRyZXR1cm4gQVZBSUxBQkxFX01PREVMU1twcm92aWRlcl0gfHwgW107XG5cdH1cblx0XG5cdHByaXZhdGUgZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZShwcm92aWRlcjogQUlQcm92aWRlclR5cGUpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6IHJldHVybiAnT3BlbkFJJztcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzogcmV0dXJuICdEZWVwU2Vlayc7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6IHJldHVybiAnTW9vbnNob3QgKEtpbWkpJztcblx0XHRcdGNhc2UgJ3poaXB1JzogcmV0dXJuICdaaGlwdSAo5pm66LCxKSc7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gJ09sbGFtYSc7XG5cdFx0fVxuXHR9XG5cdFxuXHRwcml2YXRlIGdldFByb3ZpZGVyVmFsdWUocHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlLCBrZXk6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0c3dpdGNoIChwcm92aWRlcikge1xuXHRcdFx0Y2FzZSAnb3BlbmFpJzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlNb2RlbDtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpVXJsO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleTtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ21vZGVsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrTW9kZWw7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdiYXNlVXJsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpVXJsO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleTtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ21vZGVsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90TW9kZWw7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdiYXNlVXJsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpVXJsO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3poaXB1Jzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaUtleTtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ21vZGVsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1TW9kZWw7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdiYXNlVXJsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1QXBpVXJsO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cdFxuXHRwcml2YXRlIGdldEN1cnJlbnRQcm92aWRlckNvbmZpZygpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXI7XG5cdFx0c3dpdGNoIChwcm92aWRlcikge1xuXHRcdFx0Y2FzZSAnb3BlbmFpJzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnT3BlbkFJJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpVXJsLFxuXHRcdFx0XHR9O1xuXHRcdFx0Y2FzZSAnZGVlcHNlZWsnOlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWU6ICdEZWVwU2VlaycsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnTW9vbnNob3QgKEtpbWkpJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdE1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpVXJsLFxuXHRcdFx0XHR9O1xuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWU6ICdaaGlwdSAo5pm66LCxKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihg5pyq55+l55qEIFByb3ZpZGVyOiAke3Byb3ZpZGVyfWApO1xuXHRcdH1cblx0fVxuXHRcblx0cHJpdmF0ZSB1cGRhdGVQcm92aWRlckNvbmZpZyhwcm92aWRlcjogc3RyaW5nLCBrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnbW9kZWwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlNb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdiYXNlVXJsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZGVlcHNlZWsnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnbW9kZWwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla01vZGVsID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RNb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdiYXNlVXJsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdtb2RlbCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1TW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1QXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8qKlxuICog5LuOIE9ic2lkaWFuIOaWh+S7tuS4reaPkOWPluWGheWuuVxuICovXG5leHBvcnQgY2xhc3MgQ29udGVudEV4dHJhY3RvciB7XG5cdC8qKlxuXHQgKiDmj5Dlj5bmlofku7blhoXlrrnvvIjmlK/mjIEgTWFya2Rvd24g5ZKM57qv5paH5pys77yJXG5cdCAqL1xuXHRhc3luYyBleHRyYWN0KGZpbGU6IFRGaWxlKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIOWvueS6juWklumDqOmTvuaOpeaWh+S7tu+8jOWPr+iDvemcgOimgeeJueauiuWkhOeQhlxuXHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgZmlsZS52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5jbGVhbkNvbnRlbnQoY29udGVudCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCfmj5Dlj5bmlofku7blhoXlrrnlpLHotKU6JywgZSk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDojrflj5bmlofku7bmoIfpophcblx0ICovXG5cdGdldFRpdGxlKGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcblx0XHQvLyDkvJjlhYjkvb/nlKjmlofku7blkI3vvIjkuI3lkKvmianlsZXlkI3vvIlcblx0XHRyZXR1cm4gZmlsZS5iYXNlbmFtZTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOa4heeQhuWGheWuue+8jOenu+mZpOS4jeW/heimgeeahOmDqOWIhlxuXHQgKi9cblx0cHJpdmF0ZSBjbGVhbkNvbnRlbnQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gY29udGVudFxuXHRcdFx0Ly8g56e76ZmkIFlBTUwgZnJvbnRtYXR0ZXJcblx0XHRcdC5yZXBsYWNlKC9eLS0tW1xcc1xcU10qPy0tLVxcbj8vLCAnJylcblx0XHRcdC8vIOenu+mZpCBIVE1MIOazqOmHilxuXHRcdFx0LnJlcGxhY2UoLzwhLS1bXFxzXFxTXSo/LS0+L2csICcnKVxuXHRcdFx0Ly8g56e76Zmk5Luj56CB5Z2X77yI5L+d55WZ6K+t6KiA5qCH6K6w77yJXG5cdFx0XHQucmVwbGFjZSgvYGBgW1xcc1xcU10qP2BgYC9nLCAobWF0Y2gpID0+IHtcblx0XHRcdFx0Y29uc3QgbGFuZ01hdGNoID0gbWF0Y2gubWF0Y2goL2BgYChcXHcqKS8pO1xuXHRcdFx0XHRjb25zdCBsYW5nID0gbGFuZ01hdGNoID8gbGFuZ01hdGNoWzFdIDogJyc7XG5cdFx0XHRcdHJldHVybiBgW+S7o+eggeWdlzogJHtsYW5nfV1gO1xuXHRcdFx0fSlcblx0XHRcdC8vIOenu+mZpOWbvueJh+WSjOmTvuaOpe+8jOS/neeVmSBhbHQgdGV4dFxuXHRcdFx0LnJlcGxhY2UoLyFcXFsoW15cXF1dKilcXF1cXChbXildKlxcKS9nLCAnWyQxXScpXG5cdFx0XHQucmVwbGFjZSgvXFxbKFteXFxdXSspXFxdXFwoW14pXSpcXCkvZywgJyQxJylcblx0XHRcdC8vIOenu+mZpOWkmuS9meepuuihjFxuXHRcdFx0LnJlcGxhY2UoL1xcbnszLH0vZywgJ1xcblxcbicpXG5cdFx0XHQudHJpbSgpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog55Sf5oiQ5YaF5a655pGY6KaB77yI55So5LqOIEFJIOWIhuaekO+8iVxuXHQgKi9cblx0Z2VuZXJhdGVTdW1tYXJ5KGNvbnRlbnQ6IHN0cmluZywgbWF4TGVuZ3RoID0gMjAwMCk6IHN0cmluZyB7XG5cdFx0aWYgKGNvbnRlbnQubGVuZ3RoIDw9IG1heExlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOWwneivleWcqOWPpeWtkOi+ueeVjOWkhOaIquaWrVxuXHRcdGNvbnN0IHRydW5jYXRlZCA9IGNvbnRlbnQuc2xpY2UoMCwgbWF4TGVuZ3RoKTtcblx0XHRjb25zdCBsYXN0UGVyaW9kID0gdHJ1bmNhdGVkLmxhc3RJbmRleE9mKCfjgIInKTtcblx0XHRjb25zdCBsYXN0TmV3bGluZSA9IHRydW5jYXRlZC5sYXN0SW5kZXhPZignXFxuJyk7XG5cdFx0XG5cdFx0Y29uc3QgYnJlYWtQb2ludCA9IE1hdGgubWF4KGxhc3RQZXJpb2QsIGxhc3ROZXdsaW5lKTtcblx0XHRcblx0XHRpZiAoYnJlYWtQb2ludCA+IG1heExlbmd0aCAqIDAuNykge1xuXHRcdFx0cmV0dXJuIHRydW5jYXRlZC5zbGljZSgwLCBicmVha1BvaW50ICsgMSk7XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiB0cnVuY2F0ZWQgKyAnLi4uJztcblx0fVxufVxuIiwiaW1wb3J0IHsgVEZpbGUsIFZhdWx0IH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIOaWh+S7tuaTjeS9nOW3peWFt1xuICovXG5leHBvcnQgY29uc3QgZmlsZU9wcyA9IHtcblx0LyoqXG5cdCAqIOaehOW7uuWIhuexu+i3r+W+hFxuXHQgKi9cblx0YnVpbGRDYXRlZ29yeVBhdGgoY2F0ZWdvcnk6IHN0cmluZywgaW5ib3hGb2xkZXI6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Ly8g5bCG5YiG57G76Lev5b6E5Lit55qEIFwiL1wiIOi9rOaNouS4uiBWYXVsdCDkuK3nmoTmlofku7blpLnliIbpmpTnrKZcblx0XHRjb25zdCBub3JtYWxpemVkQ2F0ZWdvcnkgPSBjYXRlZ29yeS5yZXBsYWNlKC9cXC8vZywgJy8nKTtcblx0XHRyZXR1cm4gYCR7aW5ib3hGb2xkZXJ9LyR7bm9ybWFsaXplZENhdGVnb3J5fWA7XG5cdH0sXG5cdFxuXHQvKipcblx0ICog56e75Yqo5paH5Lu25Yiw55uu5qCH6Lev5b6EXG5cdCAqL1xuXHRhc3luYyBtb3ZlRmlsZShmaWxlOiBURmlsZSwgbmV3Rm9sZGVyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxURmlsZT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB2YXVsdCA9IGZpbGUudmF1bHQ7XG5cdFx0XHRjb25zdCBhZGFwdGVyID0gdmF1bHQuYWRhcHRlcjtcblx0XHRcdFxuXHRcdFx0Ly8g56Gu5L+d55uu5qCH5paH5Lu25aS55a2Y5Zyo77yI5aSE55CG56ue5oCB5p2h5Lu277yJXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoIWF3YWl0IGFkYXB0ZXIuZXhpc3RzKG5ld0ZvbGRlclBhdGgpKSB7XG5cdFx0XHRcdFx0YXdhaXQgdmF1bHQuY3JlYXRlRm9sZGVyKG5ld0ZvbGRlclBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChmb2xkZXJFcnJvcjogYW55KSB7XG5cdFx0XHRcdC8vIOWmguaenOaWh+S7tuWkueW3suWtmOWcqO+8jOW/veeVpemUmeivr1xuXHRcdFx0XHRpZiAoIWZvbGRlckVycm9yLm1lc3NhZ2U/LmluY2x1ZGVzKCdhbHJlYWR5IGV4aXN0cycpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDliJvlu7rmlofku7blpLnlpLHotKU6ICR7Zm9sZGVyRXJyb3IubWVzc2FnZX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDmnoTlu7rmlrDmlofku7bot6/lvoRcblx0XHRcdGNvbnN0IG5ld1BhdGggPSBgJHtuZXdGb2xkZXJQYXRofS8ke2ZpbGUubmFtZX1gO1xuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpznm67moIfot6/lvoTnm7jlkIzvvIzkuI3np7vliqhcblx0XHRcdGlmIChmaWxlLnBhdGggPT09IG5ld1BhdGgpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOajgOafpeebruagh+aWh+S7tuaYr+WQpuW3suWtmOWcqFxuXHRcdFx0aWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKG5ld1BhdGgpKSB7XG5cdFx0XHRcdC8vIOaWh+S7tuW3suWtmOWcqO+8jOa3u+WKoOaXtumXtOaIs+WQjue8gFxuXHRcdFx0XHRjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRjb25zdCBleHQgPSBmaWxlLmV4dGVuc2lvbjtcblx0XHRcdFx0Y29uc3QgYmFzZU5hbWUgPSBmaWxlLmJhc2VuYW1lO1xuXHRcdFx0XHRjb25zdCB1bmlxdWVOZXdQYXRoID0gYCR7bmV3Rm9sZGVyUGF0aH0vJHtiYXNlTmFtZX1fJHt0aW1lc3RhbXB9LiR7ZXh0fWA7XG5cdFx0XHRcdFxuXHRcdFx0XHRhd2FpdCB2YXVsdC5yZW5hbWUoZmlsZSwgdW5pcXVlTmV3UGF0aCk7XG5cdFx0XHRcdGNvbnN0IG5ld0ZpbGUgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodW5pcXVlTmV3UGF0aCkgYXMgVEZpbGU7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIW5ld0ZpbGUpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ+enu+WKqOWQjuaXoOazleaJvuWIsOaWh+S7ticpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRyZXR1cm4gbmV3RmlsZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5omn6KGM56e75YqoXG5cdFx0XHRhd2FpdCB2YXVsdC5yZW5hbWUoZmlsZSwgbmV3UGF0aCk7XG5cdFx0XHRcblx0XHRcdC8vIOi/lOWbnuaWsOeahOaWh+S7tuW8leeUqFxuXHRcdFx0Y29uc3QgbmV3RmlsZSA9IHZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChuZXdQYXRoKSBhcyBURmlsZTtcblx0XHRcdFxuXHRcdFx0aWYgKCFuZXdGaWxlKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcign56e75Yqo5ZCO5peg5rOV5om+5Yiw5paH5Lu2Jyk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiBuZXdGaWxlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gZSBhcyBFcnJvcjtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ+enu+WKqOaWh+S7tuWksei0pTonLCBlcnJvcik7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOenu+WKqOaWh+S7tuWksei0pTogJHtlcnJvci5tZXNzYWdlfWApO1xuXHRcdH1cblx0fSxcblx0XG5cdC8qKlxuXHQgKiDojrflj5bmlofku7blkI3vvIjkuI3lkKvmianlsZXlkI3vvIlcblx0ICovXG5cdGdldEJhc2VuYW1lKGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZmlsZS5iYXNlbmFtZTtcblx0fSxcblx0XG5cdC8qKlxuXHQgKiDmo4Dmn6Xmlofku7bmmK/lkKblrZjlnKjkuo7mjIflrprot6/lvoRcblx0ICovXG5cdGFzeW5jIGV4aXN0cyh2YXVsdDogVmF1bHQsIHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBhd2FpdCB2YXVsdC5hZGFwdGVyLmV4aXN0cyhwYXRoKTtcblx0fSxcblx0XG5cdC8qKlxuXHQgKiDnoa7kv53mlofku7blpLnlrZjlnKjvvIzkuI3lrZjlnKjliJnliJvlu7pcblx0ICovXG5cdGFzeW5jIGVuc3VyZUZvbGRlcih2YXVsdDogVmF1bHQsIGZvbGRlclBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAoIWF3YWl0IHZhdWx0LmFkYXB0ZXIuZXhpc3RzKGZvbGRlclBhdGgpKSB7XG5cdFx0XHRcdGF3YWl0IHZhdWx0LmNyZWF0ZUZvbGRlcihmb2xkZXJQYXRoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7IC8vIOi/lOWbniB0cnVlIOihqOekuuaWsOWIm+W7uuS6huaWh+S7tuWkuVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyDov5Tlm54gZmFsc2Ug6KGo56S65paH5Lu25aS55bey5a2Y5ZyoXG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcign5Yib5bu65paH5Lu25aS55aSx6LSlOicsIGUpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH0sXG59O1xuIiwiaW1wb3J0IHsgVEZpbGUsIE5vdGljZSwgVEFic3RyYWN0RmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IEFJUHJvdmlkZXIsIENsYXNzaWZpY2F0aW9uUmVzdWx0LCBQbHVnaW5TZXR0aW5ncyB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyBDb250ZW50RXh0cmFjdG9yIH0gZnJvbSAnLi9Db250ZW50RXh0cmFjdG9yJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuLi91dGlscy9maWxlT3BzJztcblxuZXhwb3J0IGNsYXNzIENsYXNzaWZpZXIge1xuXHRwcml2YXRlIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblx0cHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblx0cHJpdmF0ZSBjb250ZW50RXh0cmFjdG9yOiBDb250ZW50RXh0cmFjdG9yO1xuXHRcblx0Y29uc3RydWN0b3Ioc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzLCBsb2dnZXI6IExvZ2dlcikge1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcblx0XHR0aGlzLmNvbnRlbnRFeHRyYWN0b3IgPSBuZXcgQ29udGVudEV4dHJhY3RvcigpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75Y2V5Liq5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUZpbGUoXG5cdFx0ZmlsZTogVEZpbGUsXG5cdFx0YWlQcm92aWRlcjogQUlQcm92aWRlcixcblx0XHRvblByb2dyZXNzPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZFxuXHQpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgcmVzdWx0PzogQ2xhc3NpZmljYXRpb25SZXN1bHQ7IGVycm9yPzogc3RyaW5nIH0+IHtcblx0XHR0cnkge1xuXHRcdFx0b25Qcm9ncmVzcz8uKGDmraPlnKjliIbmnpA6ICR7ZmlsZS5iYXNlbmFtZX1gKTtcblx0XHRcdFxuXHRcdFx0Ly8g5o+Q5Y+W5YaF5a65XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5jb250ZW50RXh0cmFjdG9yLmV4dHJhY3QoZmlsZSk7XG5cdFx0XHRpZiAoIWNvbnRlbnQpIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn5peg5rOV5o+Q5Y+W5paH5Lu25YaF5a65JyB9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRjb25zdCB0aXRsZSA9IHRoaXMuY29udGVudEV4dHJhY3Rvci5nZXRUaXRsZShmaWxlKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOWIhuexu+aWh+S7tjogJHtmaWxlLnBhdGh9YCk7XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5qCH6aKYOiAke3RpdGxlfWApO1xuXHRcdFx0XG5cdFx0XHQvLyDosIPnlKggQUkg5YiG57G7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBhaVByb3ZpZGVyLmNsYXNzaWZ5KFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0dGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5YiG57G757uT5p6cOiAke0pTT04uc3RyaW5naWZ5KHJlc3VsdCl9YCk7XG5cdFx0XHRcblx0XHRcdC8vIOajgOafpee9ruS/oeW6plxuXHRcdFx0aWYgKHJlc3VsdC5jb25maWRlbmNlIDwgdGhpcy5zZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkKSB7XG5cdFx0XHRcdHJlc3VsdC5pc1VuY2VydGFpbiA9IHRydWU7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDnva7kv6HluqbkvY7kuo7pmIjlgLw6ICR7cmVzdWx0LmNvbmZpZGVuY2V9YCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHJlc3VsdCB9O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gKGUgYXMgRXJyb3IpLm1lc3NhZ2U7XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5YiG57G75aSx6LSlOiAke2Vycm9yfWApO1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yIH07XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75pS25Lu2566x5Lit55qE5omA5pyJ5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUluYm94KFxuXHRcdGZpbGVzOiBURmlsZVtdLFxuXHRcdGFpUHJvdmlkZXI6IEFJUHJvdmlkZXIsXG5cdFx0b25Qcm9ncmVzcz86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWRcblx0KTogUHJvbWlzZTxBcnJheTx7IGZpbGU6IFRGaWxlOyByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0OyBzdWNjZXNzOiBib29sZWFuIH0+PiB7XG5cdFx0Y29uc3QgcmVzdWx0czogQXJyYXk8eyBmaWxlOiBURmlsZTsgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdDsgc3VjY2VzczogYm9vbGVhbiB9PiA9IFtdO1xuXHRcdFxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbGFzc2lmeUZpbGUoZmlsZSwgYWlQcm92aWRlciwgb25Qcm9ncmVzcyk7XG5cdFx0XHRcblx0XHRcdGlmIChyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQucmVzdWx0KSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaCh7XG5cdFx0XHRcdFx0ZmlsZSxcblx0XHRcdFx0XHRyZXN1bHQ6IHJlc3VsdC5yZXN1bHQsXG5cdFx0XHRcdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGUsXG5cdFx0XHRcdFx0cmVzdWx0OiB7XG5cdFx0XHRcdFx0XHRjYXRlZ29yeTogJ090aGVyJyxcblx0XHRcdFx0XHRcdGNvbmZpZGVuY2U6IDAsXG5cdFx0XHRcdFx0XHRyZWFzb25pbmc6IHJlc3VsdC5lcnJvciB8fCAnVW5rbm93biBlcnJvcicsXG5cdFx0XHRcdFx0XHRpc1VuY2VydGFpbjogdHJ1ZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIHJlc3VsdHM7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDnp7vliqjmlofku7bliLDliIbnsbvnm67lvZVcblx0ICovXG5cdGFzeW5jIG1vdmVGaWxlKGZpbGU6IFRGaWxlLCBjYXRlZ29yeTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG5ld1BhdGggPSBmaWxlT3BzLmJ1aWxkQ2F0ZWdvcnlQYXRoKGNhdGVnb3J5LCB0aGlzLnNldHRpbmdzLmluYm94Rm9sZGVyKTtcblx0XHRcdGF3YWl0IGZpbGVPcHMubW92ZUZpbGUoZmlsZSwgbmV3UGF0aCk7XG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg5paH5Lu25bey56e75YqoOiAke2ZpbGUucGF0aH0gLT4gJHtuZXdQYXRofWApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoYOenu+WKqOaWh+S7tuWksei0pTogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gKTtcblx0XHRcdHRocm93IGU7IC8vIOmHjeaWsOaKm+WHuumUmeivr++8jOiuqeiwg+eUqOaWueWkhOeQhlxuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKiDplJnor6/lpITnkIblt6XlhbdcbiAqIOaPkOS+m+e7n+S4gOeahOmUmeivr+exu+Wei+WSjOWkhOeQhuaWueazlVxuICovXG5cbi8qKlxuICog6Ieq5a6a5LmJ6ZSZ6K+v57G75Z6LXG4gKi9cbmV4cG9ydCBjbGFzcyBBSUNsYXNzaWZpZXJFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdHB1YmxpYyB0eXBlOiAnbmV0d29yaycgfCAndGltZW91dCcgfCAnYXV0aCcgfCAncmF0ZV9saW1pdCcgfCAndmFsaWRhdGlvbicgfCAncGFyc2UnIHwgJ3Vua25vd24nLFxuXHRcdHB1YmxpYyBvcmlnaW5hbEVycm9yPzogRXJyb3Jcblx0KSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5uYW1lID0gJ0FJQ2xhc3NpZmllckVycm9yJztcblx0fVxufVxuXG4vKipcbiAqIOmHjeivlemFjee9rlxuICovXG5pbnRlcmZhY2UgUmV0cnlDb25maWcge1xuXHRtYXhBdHRlbXB0czogbnVtYmVyO1xuXHRpbml0aWFsRGVsYXk6IG51bWJlcjtcblx0bWF4RGVsYXk6IG51bWJlcjtcblx0YmFja29mZkZhY3RvcjogbnVtYmVyO1xufVxuXG5jb25zdCBERUZBVUxUX1JFVFJZX0NPTkZJRzogUmV0cnlDb25maWcgPSB7XG5cdG1heEF0dGVtcHRzOiAzLFxuXHRpbml0aWFsRGVsYXk6IDEwMDAsIC8vIDEg56eSXG5cdG1heERlbGF5OiAxMDAwMCwgLy8gMTAg56eSXG5cdGJhY2tvZmZGYWN0b3I6IDIsIC8vIOaMh+aVsOmAgOmBv1xufTtcblxuLyoqXG4gKiDluKbph43or5XnmoTlvILmraXmk43kvZxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhSZXRyeTxUPihcblx0b3BlcmF0aW9uOiAoKSA9PiBQcm9taXNlPFQ+LFxuXHRjb25maWc6IFBhcnRpYWw8UmV0cnlDb25maWc+ID0ge30sXG5cdG9wZXJhdGlvbk5hbWUgPSAnb3BlcmF0aW9uJ1xuKTogUHJvbWlzZTxUPiB7XG5cdGNvbnN0IGZpbmFsQ29uZmlnID0geyAuLi5ERUZBVUxUX1JFVFJZX0NPTkZJRywgLi4uY29uZmlnIH07XG5cdGxldCBsYXN0RXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkO1xuXHRcblx0Zm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gZmluYWxDb25maWcubWF4QXR0ZW1wdHM7IGF0dGVtcHQrKykge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgb3BlcmF0aW9uKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGxhc3RFcnJvciA9IGVycm9yIGFzIEVycm9yO1xuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzmmK/orqTor4HplJnor6/vvIzkuI3ph43or5Vcblx0XHRcdGlmIChpc0F1dGhFcnJvcihlcnJvcikpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0XHRcdCdBUEkgS2V5IOaXoOaViOaIluacquaOiOadgycsXG5cdFx0XHRcdFx0J2F1dGgnLFxuXHRcdFx0XHRcdGxhc3RFcnJvclxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzmmK/pmZDmtYHplJnor6/vvIznrYnlvoXmm7Tplb/ml7bpl7Rcblx0XHRcdGlmIChpc1JhdGVMaW1pdEVycm9yKGVycm9yKSkge1xuXHRcdFx0XHRjb25zdCB3YWl0VGltZSA9IGdldFJhdGVMaW1pdFdhaXRUaW1lKGVycm9yKSB8fCBmaW5hbENvbmZpZy5tYXhEZWxheTtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtvcGVyYXRpb25OYW1lfV0g6YGH5Yiw6ZmQ5rWB77yM562J5b6FICR7d2FpdFRpbWV9bXMg5ZCO6YeN6K+VLi4uYCk7XG5cdFx0XHRcdGF3YWl0IHNsZWVwKHdhaXRUaW1lKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOWmguaenOaYr+e9kee7nOmUmeivr+S4lOS4jeaYr+acgOWQjuS4gOasoeWwneivle+8jOetieW+heWQjumHjeivlVxuXHRcdFx0aWYgKGF0dGVtcHQgPCBmaW5hbENvbmZpZy5tYXhBdHRlbXB0cyAmJiBpc1JldHJ5YWJsZUVycm9yKGVycm9yKSkge1xuXHRcdFx0XHRjb25zdCBkZWxheSA9IGNhbGN1bGF0ZURlbGF5KGF0dGVtcHQsIGZpbmFsQ29uZmlnKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBbJHtvcGVyYXRpb25OYW1lfV0g5bCd6K+VICR7YXR0ZW1wdH0vJHtmaW5hbENvbmZpZy5tYXhBdHRlbXB0c30g5aSx6LSl77yMJHtkZWxheX1tcyDlkI7ph43or5UuLi5gKTtcblx0XHRcdFx0YXdhaXQgc2xlZXAoZGVsYXkpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5pyA5ZCO5LiA5qyh5bCd6K+V5aSx6LSl77yM5oqb5Ye66ZSZ6K+vXG5cdFx0XHR0aHJvdyBjbGFzc2lmeUVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblx0XG5cdHRocm93IGNsYXNzaWZ5RXJyb3IobGFzdEVycm9yISk7XG59XG5cbi8qKlxuICog5Yik5pat5piv5ZCm5Li65Y+v6YeN6K+V6ZSZ6K+vXG4gKi9cbmZ1bmN0aW9uIGlzUmV0cnlhYmxlRXJyb3IoZXJyb3I6IGFueSk6IGJvb2xlYW4ge1xuXHRjb25zdCBtZXNzYWdlID0gZXJyb3I/Lm1lc3NhZ2U/LnRvTG93ZXJDYXNlKCkgfHwgJyc7XG5cdGNvbnN0IHN0YXR1cyA9IGVycm9yPy5zdGF0dXMgfHwgZXJyb3I/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdFxuXHQvLyDnvZHnu5zplJnor69cblx0aWYgKG1lc3NhZ2UuaW5jbHVkZXMoJ25ldHdvcmsnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdmZXRjaCcpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ2Vub3Rmb3VuZCcpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdC8vIOacjeWKoeWZqOmUmeivryAoNXh4KVxuXHRpZiAoc3RhdHVzID49IDUwMCAmJiBzdGF0dXMgPCA2MDApIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRcblx0Ly8g6LaF5pe26ZSZ6K+vXG5cdGlmIChtZXNzYWdlLmluY2x1ZGVzKCd0aW1lb3V0JykgfHwgbWVzc2FnZS5pbmNsdWRlcygnZXRpbWVkb3V0JykpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRcblx0cmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIOWIpOaWreaYr+WQpuS4uuiupOivgemUmeivr1xuICovXG5mdW5jdGlvbiBpc0F1dGhFcnJvcihlcnJvcjogYW55KTogYm9vbGVhbiB7XG5cdGNvbnN0IHN0YXR1cyA9IGVycm9yPy5zdGF0dXMgfHwgZXJyb3I/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdGNvbnN0IG1lc3NhZ2UgPSBlcnJvcj8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0XG5cdHJldHVybiBzdGF0dXMgPT09IDQwMSB8fCBzdGF0dXMgPT09IDQwMyB8fCBcblx0XHRtZXNzYWdlLmluY2x1ZGVzKCd1bmF1dGhvcml6ZWQnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdpbnZhbGlkIGFwaSBrZXknKTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrpmZDmtYHplJnor69cbiAqL1xuZnVuY3Rpb24gaXNSYXRlTGltaXRFcnJvcihlcnJvcjogYW55KTogYm9vbGVhbiB7XG5cdGNvbnN0IHN0YXR1cyA9IGVycm9yPy5zdGF0dXMgfHwgZXJyb3I/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdGNvbnN0IG1lc3NhZ2UgPSBlcnJvcj8ubWVzc2FnZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcblx0XG5cdHJldHVybiBzdGF0dXMgPT09IDQyOSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdyYXRlIGxpbWl0JykgfHwgbWVzc2FnZS5pbmNsdWRlcygndG9vIG1hbnkgcmVxdWVzdHMnKTtcbn1cblxuLyoqXG4gKiDku47plJnor6/kuK3ojrflj5bpmZDmtYHnrYnlvoXml7bpl7RcbiAqL1xuZnVuY3Rpb24gZ2V0UmF0ZUxpbWl0V2FpdFRpbWUoZXJyb3I6IGFueSk6IG51bWJlciB8IG51bGwge1xuXHQvLyDlsJ3or5Xku47lk43lupTlpLTojrflj5Zcblx0Y29uc3QgcmV0cnlBZnRlciA9IGVycm9yPy5yZXNwb25zZT8uaGVhZGVycz8uZ2V0KCdyZXRyeS1hZnRlcicpO1xuXHRpZiAocmV0cnlBZnRlcikge1xuXHRcdGNvbnN0IHNlY29uZHMgPSBwYXJzZUludChyZXRyeUFmdGVyLCAxMCk7XG5cdFx0aWYgKCFpc05hTihzZWNvbmRzKSkge1xuXHRcdFx0cmV0dXJuIHNlY29uZHMgKiAxMDAwO1xuXHRcdH1cblx0fVxuXHRcblx0Ly8g6buY6K6k562J5b6FIDYwIOenklxuXHRyZXR1cm4gNjAwMDA7XG59XG5cbi8qKlxuICog6K6h566X6YeN6K+V5bu26L+f5pe26Ze077yI5oyH5pWw6YCA6YG/77yJXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZURlbGF5KGF0dGVtcHQ6IG51bWJlciwgY29uZmlnOiBSZXRyeUNvbmZpZyk6IG51bWJlciB7XG5cdGNvbnN0IGRlbGF5ID0gY29uZmlnLmluaXRpYWxEZWxheSAqIE1hdGgucG93KGNvbmZpZy5iYWNrb2ZmRmFjdG9yLCBhdHRlbXB0IC0gMSk7XG5cdHJldHVybiBNYXRoLm1pbihkZWxheSwgY29uZmlnLm1heERlbGF5KTtcbn1cblxuLyoqXG4gKiDkvJHnnKDmjIflrprml7bpl7RcbiAqL1xuZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG5cbi8qKlxuICog5YiG57G76ZSZ6K+v57G75Z6LXG4gKi9cbmZ1bmN0aW9uIGNsYXNzaWZ5RXJyb3IoZXJyb3I6IGFueSk6IEFJQ2xhc3NpZmllckVycm9yIHtcblx0aWYgKGVycm9yIGluc3RhbmNlb2YgQUlDbGFzc2lmaWVyRXJyb3IpIHtcblx0XHRyZXR1cm4gZXJyb3I7XG5cdH1cblx0XG5cdGNvbnN0IG1lc3NhZ2UgPSBlcnJvcj8ubWVzc2FnZSB8fCBTdHJpbmcoZXJyb3IpO1xuXHRjb25zdCBsb3dlck1lc3NhZ2UgPSBtZXNzYWdlLnRvTG93ZXJDYXNlKCk7XG5cdGNvbnN0IHN0YXR1cyA9IGVycm9yPy5zdGF0dXMgfHwgZXJyb3I/LnJlc3BvbnNlPy5zdGF0dXM7XG5cdFxuXHQvLyDnvZHnu5zplJnor69cblx0aWYgKGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnbmV0d29yaycpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnZmV0Y2gnKSB8fCBcblx0XHRsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2Vub3Rmb3VuZCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnZWNvbm5yZWZ1c2VkJykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+e9kee7nOi/nuaOpeWksei0pe+8jOivt+ajgOafpee9kee7nOiuvue9ricsXG5cdFx0XHQnbmV0d29yaycsXG5cdFx0XHRlcnJvclxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOi2heaXtumUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd0aW1lb3V0JykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdldGltZWRvdXQnKSkge1xuXHRcdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0XHQn6K+35rGC6LaF5pe277yM6K+356iN5ZCO6YeN6K+VJyxcblx0XHRcdCd0aW1lb3V0Jyxcblx0XHRcdGVycm9yXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g6K6k6K+B6ZSZ6K+vXG5cdGlmIChzdGF0dXMgPT09IDQwMSB8fCBzdGF0dXMgPT09IDQwMyB8fCBcblx0XHRsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3VuYXV0aG9yaXplZCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnaW52YWxpZCBhcGkga2V5JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J0FQSSBLZXkg5peg5pWI5oiW5pyq5o6I5p2DJyxcblx0XHRcdCdhdXRoJyxcblx0XHRcdGVycm9yXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g6ZmQ5rWB6ZSZ6K+vXG5cdGlmIChzdGF0dXMgPT09IDQyOSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3JhdGUgbGltaXQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3RvbyBtYW55IHJlcXVlc3RzJykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J0FQSSDor7fmsYLov4fkuo7popHnuYHvvIzor7fnqI3lkI7ph43or5UnLFxuXHRcdFx0J3JhdGVfbGltaXQnLFxuXHRcdFx0ZXJyb3Jcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyBKU09OIOino+aekOmUmeivr1xuXHRpZiAobG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdqc29uJykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdwYXJzZScpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnc3ludGF4JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+WTjeW6lOaVsOaNruagvOW8j+mUmeivrycsXG5cdFx0XHQncGFyc2UnLFxuXHRcdFx0ZXJyb3Jcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyDmnKrnn6XplJnor69cblx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRtZXNzYWdlLFxuXHRcdCd1bmtub3duJyxcblx0XHRlcnJvclxuXHQpO1xufVxuXG4vKipcbiAqIOeUqOaIt+WPi+WlveeahOmUmeivr+a2iOaBr1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlcnJvcjogRXJyb3IpOiBzdHJpbmcge1xuXHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBBSUNsYXNzaWZpZXJFcnJvcikge1xuXHRcdHN3aXRjaCAoZXJyb3IudHlwZSkge1xuXHRcdFx0Y2FzZSAnbmV0d29yayc6XG5cdFx0XHRcdHJldHVybiAn8J+MkCDnvZHnu5zov57mjqXlpLHotKXvvIzor7fmo4Dmn6XvvJpcXG7igKIg572R57uc5piv5ZCm5q2j5bi4XFxu4oCiIEFQSSDlnLDlnYDmmK/lkKbmraPnoa5cXG7igKIg5piv5ZCm6ZyA6KaB5Luj55CGJztcblx0XHRcdGNhc2UgJ3RpbWVvdXQnOlxuXHRcdFx0XHRyZXR1cm4gJ+KPse+4jyDor7fmsYLotoXml7bvvIzlu7rorq7vvJpcXG7igKIg5qOA5p+l572R57uc6YCf5bqmXFxu4oCiIOeojeWQjumHjeivlSc7XG5cdFx0XHRjYXNlICdhdXRoJzpcblx0XHRcdFx0cmV0dXJuICfwn5SRIEFQSSBLZXkg5peg5pWI77yM6K+35qOA5p+l77yaXFxu4oCiIEFQSSBLZXkg5piv5ZCm5q2j56GuXFxu4oCiIOaYr+WQpuacieS9meminS/pop3luqYnO1xuXHRcdFx0Y2FzZSAncmF0ZV9saW1pdCc6XG5cdFx0XHRcdHJldHVybiAn8J+apiDor7fmsYLov4fkuo7popHnuYHvvIzor7fnqI3lkI7ph43or5UnO1xuXHRcdFx0Y2FzZSAncGFyc2UnOlxuXHRcdFx0XHRyZXR1cm4gJ/Cfk50gQUkg5ZON5bqU5qC85byP5byC5bi477yM6K+36YeN6K+V5oiW6IGU57O75byA5Y+R6ICFJztcblx0XHRcdGNhc2UgJ3ZhbGlkYXRpb24nOlxuXHRcdFx0XHRyZXR1cm4gYOKaoO+4jyDphY3nva7plJnor6/vvJoke2Vycm9yLm1lc3NhZ2V9YDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBg4p2MICR7ZXJyb3IubWVzc2FnZX1gO1xuXHRcdH1cblx0fVxuXHRcblx0cmV0dXJuIGDinYwg5pyq55+l6ZSZ6K+v77yaJHtlcnJvci5tZXNzYWdlfWA7XG59XG5cbi8qKlxuICog6aqM6K+BIFVSTCDmoLzlvI9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVXJsKHVybDogc3RyaW5nLCBmaWVsZE5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRpZiAoIXVybCB8fCB1cmwudHJpbSgpID09PSAnJykge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihgJHtmaWVsZE5hbWV9IOS4jeiDveS4uuepumAsICd2YWxpZGF0aW9uJyk7XG5cdH1cblx0XG5cdHRyeSB7XG5cdFx0bmV3IFVSTCh1cmwpO1xuXHR9IGNhdGNoIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7ZmllbGROYW1lfSDmoLzlvI/kuI3mraPnoa46ICR7dXJsfWAsICd2YWxpZGF0aW9uJyk7XG5cdH1cbn1cblxuLyoqXG4gKiDpqozor4EgQVBJIEtleSDmoLzlvI9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQXBpS2V5KGFwaUtleTogc3RyaW5nLCBwcm92aWRlck5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRpZiAoIWFwaUtleSB8fCBhcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihgJHtwcm92aWRlck5hbWV9IEFQSSBLZXkg5LiN6IO95Li656m6YCwgJ3ZhbGlkYXRpb24nKTtcblx0fVxuXHRcblx0Ly8g5Z+65pys5qC85byP5qOA5p+lXG5cdGlmIChhcGlLZXkubGVuZ3RoIDwgMTApIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7cHJvdmlkZXJOYW1lfSBBUEkgS2V5IOagvOW8j+S4jeato+ehrmAsICd2YWxpZGF0aW9uJyk7XG5cdH1cbn1cblxuLyoqXG4gKiDluKbotoXml7bnmoQgZmV0Y2hcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoV2l0aFRpbWVvdXQoXG5cdHVybDogc3RyaW5nLFxuXHRvcHRpb25zOiBSZXF1ZXN0SW5pdCA9IHt9LFxuXHR0aW1lb3V0ID0gMzAwMDBcbik6IFByb21pc2U8UmVzcG9uc2U+IHtcblx0Y29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0Y29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIHRpbWVvdXQpO1xuXHRcblx0dHJ5IHtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3BvbnNlO1xuXHR9IGNhdGNoIChlcnJvcjogYW55KSB7XG5cdFx0aWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuXHRcdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0XHQn6K+35rGC6LaF5pe2Jyxcblx0XHRcdFx0J3RpbWVvdXQnLFxuXHRcdFx0XHRlcnJvclxuXHRcdFx0KTtcblx0XHR9XG5cdFx0dGhyb3cgZXJyb3I7XG5cdH0gZmluYWxseSB7XG5cdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEFwcCwgTm90aWNlLCBURmlsZSwgRm9sZGVyU3VnZ2VzdCwgVGV4dENvbXBvbmVudCwgTW9kYWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBBSUNsYXNzaWZpZXJQbHVnaW4gZnJvbSAnLi4vbWFpbic7XG5pbXBvcnQgeyBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuLi9zZXR0aW5ncy9pMThuJztcbmltcG9ydCB7IENsYXNzaWZpZXIgfSBmcm9tICcuLi9zZXJ2aWNlcy9DbGFzc2lmaWVyJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuLi91dGlscy9maWxlT3BzJztcbmltcG9ydCB7IGdldFVzZXJGcmllbmRseU1lc3NhZ2UgfSBmcm9tICcuLi91dGlscy9lcnJvckhhbmRsZXInO1xuXG5leHBvcnQgY2xhc3MgQ2xhc3NpZnlDb21tYW5kIHtcblx0cHJpdmF0ZSBwbHVnaW46IEFJQ2xhc3NpZmllclBsdWdpbjtcblx0cHJpdmF0ZSBjbGFzc2lmaWVyOiBDbGFzc2lmaWVyO1xuXHRcblx0Y29uc3RydWN0b3IocGx1Z2luOiBBSUNsYXNzaWZpZXJQbHVnaW4pIHtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0XHR0aGlzLmNsYXNzaWZpZXIgPSBuZXcgQ2xhc3NpZmllcihwbHVnaW4uc2V0dGluZ3MsIHBsdWdpbi5sb2dnZXIpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75pS25Lu2566x5Lit55qE5omA5pyJ5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUluYm94KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluYm94Rm9sZGVyID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5ib3hGb2xkZXI7XG5cdFx0XG5cdFx0Ly8g56Gu5L+dIEluYm94IOebruW9leWtmOWcqFxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjcmVhdGVkID0gYXdhaXQgZmlsZU9wcy5lbnN1cmVGb2xkZXIodGhpcy5wbHVnaW4uYXBwLnZhdWx0LCBpbmJveEZvbGRlcik7XG5cdFx0XHRpZiAoY3JlYXRlZCkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGDlt7LliJvlu7rmlLbku7bnrrHmlofku7blpLk6ICR7aW5ib3hGb2xkZXJ9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0bmV3IE5vdGljZShg5Yib5bu65pS25Lu2566x5paH5Lu25aS55aSx6LSlOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHQvLyDmn6Xmib7mlLbku7bnrrHmlofku7blpLlcblx0XHRjb25zdCBpbmJveEZpbGVzID0gYXdhaXQgdGhpcy5maW5kSW5ib3hGaWxlcyhpbmJveEZvbGRlcik7XG5cdFx0XG5cdFx0aWYgKGluYm94RmlsZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRuZXcgTm90aWNlKHQoJ2NsYXNzaWZ5Lm5vRmlsZXMnKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdG5ldyBOb3RpY2UoYOaJvuWIsCAke2luYm94RmlsZXMubGVuZ3RofSDkuKrlvoXliIbnsbvmlofku7ZgKTtcblx0XHRcblx0XHQvLyDojrflj5YgQUkgUHJvdmlkZXLvvIjluKbplJnor6/lpITnkIbvvIlcblx0XHRsZXQgYWlQcm92aWRlcjtcblx0XHR0cnkge1xuXHRcdFx0YWlQcm92aWRlciA9IHRoaXMucGx1Z2luLmdldEFJUHJvdmlkZXIoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRuZXcgTm90aWNlKGVycm9yTXNnLCA4MDAwKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuY2xhc3NpZmllci5jbGFzc2lmeUluYm94KFxuXHRcdFx0aW5ib3hGaWxlcyxcblx0XHRcdGFpUHJvdmlkZXIsXG5cdFx0XHQobWVzc2FnZSkgPT4gbmV3IE5vdGljZShtZXNzYWdlLCAyMDAwKVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8g5aSE55CG57uT5p6cXG5cdFx0bGV0IG1vdmVkQ291bnQgPSAwO1xuXHRcdGxldCB1bmNlcnRhaW5Db3VudCA9IDA7XG5cdFx0XG5cdFx0Zm9yIChjb25zdCB7IGZpbGUsIHJlc3VsdCwgc3VjY2VzcyB9IG9mIHJlc3VsdHMpIHtcblx0XHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UobmV3IEVycm9yKHJlc3VsdC5yZWFzb25pbmcpKTtcblx0XHRcdFx0bmV3IE5vdGljZShgJHtmaWxlLm5hbWV9OiAke2Vycm9yTXNnfWAsIDUwMDApO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYgKHJlc3VsdC5pc1VuY2VydGFpbikge1xuXHRcdFx0XHR1bmNlcnRhaW5Db3VudCsrO1xuXHRcdFx0XHQvLyDlr7nkuo7kvY7nva7kv6Hluqbnu5PmnpzvvIznrYnlvoXnlKjmiLfnoa7orqRcblx0XHRcdFx0Y29uc3QgY29uZmlybWVkID0gYXdhaXQgdGhpcy5jb25maXJtQ2xhc3NpZmljYXRpb24oZmlsZSwgcmVzdWx0KTtcblx0XHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b01vdmVGaWxlKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgbW92ZWQgPSBhd2FpdCB0aGlzLmNsYXNzaWZpZXIubW92ZUZpbGUoZmlsZSwgcmVzdWx0LmNhdGVnb3J5KTtcblx0XHRcdFx0XHRpZiAobW92ZWQpIHtcblx0XHRcdFx0XHRcdG1vdmVkQ291bnQrKztcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoYCR7ZmlsZS5uYW1lfSDihpIgJHtyZXN1bHQuY2F0ZWdvcnl9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoYOenu+WKqCAke2ZpbGUubmFtZX0g5aSx6LSlOiAke2Vycm9yTXNnfWAsIDUwMDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgTm90aWNlKGAke2ZpbGUubmFtZX06ICR7cmVzdWx0LmNhdGVnb3J5fSAoJHsocmVzdWx0LmNvbmZpZGVuY2UgKiAxMDApLnRvRml4ZWQoMCl9JSlgKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0bmV3IE5vdGljZShcblx0XHRcdGDliIbnsbvlrozmiJDvvIFgICtcblx0XHRcdChtb3ZlZENvdW50ID4gMCA/IGDlt7Lnp7vliqggJHttb3ZlZENvdW50fSDkuKrmlofku7ZgIDogJycpICtcblx0XHRcdCh1bmNlcnRhaW5Db3VudCA+IDAgPyBg77yMJHt1bmNlcnRhaW5Db3VudH0g5Liq5paH5Lu26ZyA6KaB56Gu6K6kYCA6ICcnKVxuXHRcdCk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDliIbnsbvlvZPliY3miZPlvIDnmoTmlofku7Zcblx0ICovXG5cdGFzeW5jIGNsYXNzaWZ5Q3VycmVudEZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFxuXHRcdGlmICghYWN0aXZlRmlsZSkge1xuXHRcdFx0bmV3IE5vdGljZSgn5rKh5pyJ5omT5byA55qE5paH5Lu2Jyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOiOt+WPliBBSSBQcm92aWRlcu+8iOW4pumUmeivr+WkhOeQhu+8iVxuXHRcdGxldCBhaVByb3ZpZGVyO1xuXHRcdHRyeSB7XG5cdFx0XHRhaVByb3ZpZGVyID0gdGhpcy5wbHVnaW4uZ2V0QUlQcm92aWRlcigpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdG5ldyBOb3RpY2UoZXJyb3JNc2csIDgwMDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsYXNzaWZpZXIuY2xhc3NpZnlGaWxlKGFjdGl2ZUZpbGUsIGFpUHJvdmlkZXIpO1xuXHRcdFxuXHRcdGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShuZXcgRXJyb3IocmVzdWx0LmVycm9yIHx8ICdVbmtub3duIGVycm9yJykpO1xuXHRcdFx0bmV3IE5vdGljZShlcnJvck1zZywgNTAwMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdGNvbnN0IHsgcmVzdWx0OiBjbGFzc2lmaWNhdGlvbiB9ID0gcmVzdWx0O1xuXHRcdFxuXHRcdG5ldyBOb3RpY2UoXG5cdFx0XHRg5YiG57G7OiAke2NsYXNzaWZpY2F0aW9uPy5jYXRlZ29yeX0gYCArXG5cdFx0XHRgKCR7KChjbGFzc2lmaWNhdGlvbj8uY29uZmlkZW5jZSB8fCAwKSAqIDEwMCkudG9GaXhlZCgwKX0lKWBcblx0XHQpO1xuXHRcdFxuXHRcdC8vIOajgOafpeaYr+WQpumcgOimgeenu+WKqFxuXHRcdGlmIChjbGFzc2lmaWNhdGlvbj8uaXNVbmNlcnRhaW4pIHtcblx0XHRcdGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IHRoaXMuY29uZmlybUNsYXNzaWZpY2F0aW9uKGFjdGl2ZUZpbGUsIGNsYXNzaWZpY2F0aW9uKTtcblx0XHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSAmJiBjbGFzc2lmaWNhdGlvbikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jbGFzc2lmaWVyLm1vdmVGaWxlKGFjdGl2ZUZpbGUsIGNsYXNzaWZpY2F0aW9uLmNhdGVnb3J5KTtcblx0XHRcdFx0bmV3IE5vdGljZShgJHt0KCdjbGFzc2lmeS5tb3ZlZCcpfSR7Y2xhc3NpZmljYXRpb24uY2F0ZWdvcnl9YCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdFx0bmV3IE5vdGljZShg56e75Yqo5paH5Lu25aSx6LSlOiAke2Vycm9yTXNnfWAsIDUwMDApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOehruiupOWIhuexu++8iOeUqOS6juS9jue9ruS/oeW6puaDheWGte+8iVxuXHQgKi9cblx0cHJpdmF0ZSBjb25maXJtQ2xhc3NpZmljYXRpb24oZmlsZTogVEZpbGUsIHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBgJHtmaWxlLm5hbWV9XFxuJHt0KCdjbGFzc2lmeS5jb25maXJtJyl9JHtyZXN1bHQuY2F0ZWdvcnl9XFxuJHt0KCdjbGFzc2lmeS51bmNlcnRhaW4nKX0keygocmVzdWx0LmNvbmZpZGVuY2UgfHwgMCkgKiAxMDApLnRvRml4ZWQoMCl9JSlgO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzdWx0LnN1Z2dlc3RlZENhdGVnb3J5ICYmIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXMpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgJHt0KCdjbGFzc2lmeS5zdWdnZXN0ZWRDYXRlZ29yeScpfSR7cmVzdWx0LnN1Z2dlc3RlZENhdGVnb3J5fWApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDkvb/nlKggT2JzaWRpYW4g55qE56Gu6K6k5a+56K+d5qGGXG5cdFx0XHRjb25zdCBtb2RhbCA9IG5ldyBDb25maXJtTW9kYWwoXG5cdFx0XHRcdHRoaXMucGx1Z2luLmFwcCxcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0KGNvbmZpcm1lZCkgPT4ge1xuXHRcdFx0XHRcdGlmIChjb25maXJtZWQpIHtcblx0XHRcdFx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlc29sdmUoZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHRcdG1vZGFsLm9wZW4oKTtcblx0XHR9KTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOafpeaJvuaUtuS7tueuseS4reeahOaJgOacieeslOiusOaWh+S7tlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBmaW5kSW5ib3hGaWxlcyhpbmJveEZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTxURmlsZVtdPiB7XG5cdFx0Y29uc3QgZmlsZXMgPSB0aGlzLnBsdWdpbi5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcblx0XHRjb25zdCBzY2FuU3ViZm9sZGVycyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnNjYW5TdWJmb2xkZXJzO1xuXHRcdFxuXHRcdHJldHVybiBmaWxlcy5maWx0ZXIoZmlsZSA9PiB7XG5cdFx0XHQvLyDmo4Dmn6Xmlofku7bmmK/lkKblnKjmlLbku7bnrrHmlofku7blpLnkuK1cblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gZmlsZS5wYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWRJbmJveCA9IGluYm94Rm9sZGVyLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblx0XHRcdFxuXHRcdFx0Ly8g5qOA5p+l5piv5ZCm5Zyo5pS25Lu2566x5LitXG5cdFx0XHRpZiAoIW5vcm1hbGl6ZWRQYXRoLnN0YXJ0c1dpdGgobm9ybWFsaXplZEluYm94ICsgJy8nKSAmJiBcblx0XHRcdFx0IShub3JtYWxpemVkUGF0aC5zdGFydHNXaXRoKG5vcm1hbGl6ZWRJbmJveCkgJiYgbm9ybWFsaXplZFBhdGggIT09IG5vcm1hbGl6ZWRJbmJveCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzkuI3miavmj4/lrZDmlofku7blpLnvvIzmo4Dmn6XmmK/lkKblnKjpobblsYJcblx0XHRcdGlmICghc2NhblN1YmZvbGRlcnMpIHtcblx0XHRcdFx0Y29uc3QgcmVsYXRpdmVQYXRoID0gbm9ybWFsaXplZFBhdGguc3Vic3RyaW5nKG5vcm1hbGl6ZWRJbmJveC5sZW5ndGgpO1xuXHRcdFx0XHQvLyDnp7vpmaTlvIDlpLTnmoTmlpzmnaBcblx0XHRcdFx0Y29uc3QgY2xlYW5SZWxhdGl2ZVBhdGggPSByZWxhdGl2ZVBhdGguc3RhcnRzV2l0aCgnLycpID8gcmVsYXRpdmVQYXRoLnN1YnN0cmluZygxKSA6IHJlbGF0aXZlUGF0aDtcblx0XHRcdFx0Ly8g5aaC5p6c55u45a+56Lev5b6E5Lit5YyF5ZCr5pac5p2g77yM6K+05piO5Zyo5a2Q55uu5b2V5LitXG5cdFx0XHRcdGlmIChjbGVhblJlbGF0aXZlUGF0aC5pbmNsdWRlcygnLycpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXHR9XG59XG5cbi8qKlxuICog566A5Y2V55qE56Gu6K6k5a+56K+d5qGGXG4gKi9cbmNsYXNzIENvbmZpcm1Nb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBtZXNzYWdlOiBzdHJpbmc7XG5cdHByaXZhdGUgb25Db25maXJtOiAoY29uZmlybWVkOiBib29sZWFuKSA9PiB2b2lkO1xuXHRcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIG1lc3NhZ2U6IHN0cmluZywgb25Db25maXJtOiAoY29uZmlybWVkOiBib29sZWFuKSA9PiB2b2lkKSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdHRoaXMub25Db25maXJtID0gb25Db25maXJtO1xuXHR9XG5cdFxuXHRvbk9wZW4oKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiB0aGlzLm1lc3NhZ2UgfSk7XG5cdFx0XG5cdFx0Y29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdignYnV0dG9uLWNvbnRhaW5lcicpO1xuXHRcdFxuXHRcdGNvbnN0IGNvbmZpcm1CdG4gPSBidXR0b25Db250YWluZXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICfnoa7orqQnLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YScsXG5cdFx0fSk7XG5cdFx0Y29uZmlybUJ0bi5vbkNsaWNrKCgpID0+IHtcblx0XHRcdHRoaXMub25Db25maXJtKHRydWUpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbkNvbnRhaW5lci5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ+WPlua2iCcsXG5cdFx0fSk7XG5cdFx0Y2FuY2VsQnRuLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0dGhpcy5vbkNvbmZpcm0oZmFsc2UpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cdFxuXHRvbkNsb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cbiIsIi8qKlxuICogQUkg5o+Q56S66K+N6ZuG5Lit566h55CGXG4gKi9cblxuZXhwb3J0IGNvbnN0IFNZU1RFTV9QUk9NUFQgPSBg5L2g5piv5LiT5Lia55qE5oqA5pyv5paH56ug5YiG57G75Yqp5omL44CCXG5cbiMjIOS9oOeahOiBjOi0o1xuMS4g5YiG5p6Q55So5oi35o+Q5L6b55qE5paH56ug5YaF5a65XG4yLiDku47pooTlrprkuYnliIbnsbvliJfooajkuK3pgInmi6nmnIDljLnphY3nmoTkuIDkuKpcbjMuIOi/lOWbnue7k+aehOWMlueahOWIhuexu+e7k+aenFxuXG4jIyDliIbnsbvljp/liJlcbjEuICoq57K+56Gu5Yy56YWNKirvvJrkvJjlhYjpgInmi6nkuI7mlofnq6DkuLvpopjlrozlhajljLnphY3nmoTliIbnsbtcbjIuICoq6K+t5LmJ55CG6KejKirvvJrnkIbop6Pmlofnq6DnmoTmioDmnK/poobln5/lkozkuLvpophcbjMuICoq5bGC57qn6YCJ5oupKirvvJrpgInmi6nmnIDlhbfkvZPnmoTlrZDliIbnsbvvvIzogIzpnZ7niLbliIbnsbtcbjQuICoq5ZCI55CG5o6o5patKirvvJrln7rkuo7moIfpopjlkozlhoXlrrnmkZjopoHov5vooYzmjqjmlq1cblxuIyMg5YiG57G75LyY5YWI57qnXG4xLiDnvJbnqIsv5YmN56uvIChGcm9udGVuZCnvvJpSZWFjdCwgVnVlLCBDU1MsIEhUTUwsIFdlYiDlvIDlj5HnrYlcbjIuIOe8lueoiy/lkI7nq68gKEJhY2tlbmQp77yaTm9kZS5qcywgUHl0aG9uLCBKYXZhLCBBUEksIFNlcnZlciDnrYlcbjMuIOe8lueoiy/np7vliqjnq68gKE1vYmlsZSnvvJppT1MsIEFuZHJvaWQsIEZsdXR0ZXIsIFJlYWN0IE5hdGl2ZSDnrYlcbjQuIOe8lueoiy9EZXZPcHPvvJpEb2NrZXIsIEt1YmVybmV0ZXMsIENJL0NELCBDbG91ZCDnrYlcbjUuIEFJL+acuuWZqOWtpuS5oO+8mk1MLCDmnLrlmajlrabkuaDnrpfms5UsIOaVsOaNruenkeWtpuetiVxuNi4gQUkv5rex5bqm5a2m5Lmg77yaRGVlcCBMZWFybmluZywgTmV1cmFsIE5ldHdvcmssIFRlbnNvckZsb3csIFB5VG9yY2gg562JXG43LiBBSS9OTFDvvJroh6rnhLbor63oqIDlpITnkIYsIExMTSwgQ2hhdEdQVCDnrYlcbjguIOaVsOaNri/mlbDmja7lupPvvJpEYXRhYmFzZSwgU1FMLCBQb3N0Z3JlU1FMLCBNb25nb0RCIOetiVxuOS4g5pWw5o2uL+aVsOaNruW3peeoi++8mkVUTCwgUGlwZWxpbmUsIERhdGEgV2FyZWhvdXNlIOetiVxuMTAuIOaetuaehC/ns7vnu5/orr7orqHvvJpTeXN0ZW0gRGVzaWduLCBBcmNoaXRlY3R1cmUsIFNjYWxhYmlsaXR5IOetiVxuMTEuIE90aGVy77ya5peg5rOV5b2S5YWl5LiK6L+w5YiG57G755qE5YaF5a65XG5cbiMjIOi+k+WHuuagvOW8j1xu6K+35LulIEpTT04g5qC85byP6L+U5Zue57uT5p6c77yaXG57XG4gIFwiY2F0ZWdvcnlcIjogXCLliIbnsbvot6/lvoTvvIzlpoIgJ+e8lueoiy/liY3nq68nXCIsXG4gIFwiY29uZmlkZW5jZVwiOiAwLjAtMS4wIOeahOe9ruS/oeW6puWIhuaVsCxcbiAgXCJyZWFzb25pbmdcIjogXCLnroDnn63nmoTnkIbnlLHor7TmmI5cIixcbiAgXCJpc1VuY2VydGFpblwiOiBmYWxzZSxcbiAgXCJzdWdnZXN0ZWRDYXRlZ29yeVwiOiBcIuWmguaenOehruWunuayoeacieWQiOmAguWIhuexu++8jOW7uuiurueahOaWsOWIhuexu+WQje+8iOWPr+mAie+8iVwiXG59XG5cbiMjIOazqOaEj+S6i+mhuVxuLSDlpoLmnpzmlofnq6DmmI7mmL7lsZ7kuo7mn5DkuKrpoobln5/vvIzpgInmi6nor6Xpoobln5/nmoTmnIDlhbfkvZPliIbnsbtcbi0g5aaC5p6c572u5L+h5bqm5L2O5LqOIDAuNe+8jOiuvue9riBpc1VuY2VydGFpbjogdHJ1ZVxuLSDlp4vnu4jov5Tlm57kuIDkuKrlkIjnkIbnmoTliIbnsbvvvIzkuI3opoHov5Tlm57nqbrlgLxgO1xuXG5leHBvcnQgY29uc3QgVVNFUl9QUk9NUFRfVEVNUExBVEUgPSBg6K+35YiG5p6Q5Lul5LiL5paH56ug5bm25YiG57G777yaXG5cbiMjIOaWh+eroOagh+mimFxue3tUSVRMRX19XG5cbiMjIOaWh+eroOWGheWuueaRmOimgVxue3tDT05URU5UfX1cblxuIyMg5Y+v55So5YiG57G75YiX6KGoXG57e0NBVEVHT1JJRVN9fVxuXG7or7fku47kuIrov7DliIbnsbvliJfooajkuK3pgInmi6nmnIDljLnphY3nmoTkuIDkuKrvvIzlubbov5Tlm54gSlNPTiDmoLzlvI/nmoTliIbnsbvnu5PmnpzjgIJgO1xuXG5leHBvcnQgY29uc3QgU1VHR0VTVF9DQVRFR09SWV9QUk9NUFQgPSBg5paH56ug5YaF5a655LiO546w5pyJ5YiG57G76YO95LiN5aSq5Yy56YWN44CCXG7lvZPml6Dms5Xmib7liLDlkIjpgILliIbnsbvml7bvvIzlj6/ku6Xlu7rorq7kuIDkuKrmlrDliIbnsbvlkI3np7DjgIJcbuaWsOWIhuexu+W6lOivpeaYr+WQiOeQhueahOaKgOacr+mihuWfn+WQjeensOOAgmA7XG4iLCJpbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFBsdWdpblNldHRpbmdzIH0gZnJvbSAnLi4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU1lTVEVNX1BST01QVCwgVVNFUl9QUk9NUFRfVEVNUExBVEUgfSBmcm9tICcuL3Byb21wdHMnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IHdpdGhSZXRyeSwgZmV0Y2hXaXRoVGltZW91dCwgZ2V0VXNlckZyaWVuZGx5TWVzc2FnZSwgdmFsaWRhdGVVcmwgfSBmcm9tICcuLi91dGlscy9lcnJvckhhbmRsZXInO1xuXG5leHBvcnQgY2xhc3MgT2xsYW1hUHJvdmlkZXIgaW1wbGVtZW50cyBBSVByb3ZpZGVyIHtcblx0bmFtZSA9ICdPbGxhbWEnO1xuXHRwcml2YXRlIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblx0cHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblx0XG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdH1cblx0XG5cdGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDpqozor4EgVVJMIOagvOW8j1xuXHRcdFx0dmFsaWRhdGVVcmwodGhpcy5zZXR0aW5ncy5vbGxhbWFVcmwsICdPbGxhbWEg5Zyw5Z2AJyk7XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRgJHt0aGlzLnNldHRpbmdzLm9sbGFtYVVybH0vYXBpL3RhZ3NgLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWV0aG9kOiAnR0VUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcblx0XHRcdFx0fSxcblx0XHRcdFx0MTAwMDAgLy8gMTAg56eS6LaF5pe2XG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzcG9uc2Uub2spIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ09sbGFtYSDmnI3liqHmraPluLgnIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCB9O1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2UgfTtcblx0XHR9XG5cdH1cblx0XG5cdGFzeW5jIGNsYXNzaWZ5KGNvbnRlbnQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgY2F0ZWdvcmllczogc3RyaW5nW10pOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0PiB7XG5cdFx0Ly8g5L2/55So5bim6YeN6K+V55qE5pON5L2cXG5cdFx0cmV0dXJuIGF3YWl0IHdpdGhSZXRyeShcblx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdXNlclByb21wdCA9IFVTRVJfUFJPTVBUX1RFTVBMQVRFXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7VElUTEV9fScsIHRpdGxlKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e0NPTlRFTlR9fScsIGNvbnRlbnQuc2xpY2UoMCwgNDAwMCkpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q0FURUdPUklFU319JywgY2F0ZWdvcmllcy5tYXAoYyA9PiBgLSAke2N9YCkuam9pbignXFxuJykpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8g5L2/55So5bim6LaF5pe255qEIGZldGNoXG5cdFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChcblx0XHRcdFx0XHRgJHt0aGlzLnNldHRpbmdzLm9sbGFtYVVybH0vYXBpL2dlbmVyYXRlYCxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuXHRcdFx0XHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5vbGxhbWFNb2RlbCxcblx0XHRcdFx0XHRcdFx0cHJvbXB0OiBgPHxpbV9zdGFydHw+c3lzdGVtXFxuJHtTWVNURU1fUFJPTVBUfTx8aW1fZW5kfD5cXG48fGltX3N0YXJ0fD51c2VyXFxuJHt1c2VyUHJvbXB0fTx8aW1fZW5kfD5gLFxuXHRcdFx0XHRcdFx0XHRzdHJlYW06IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0dGVtcGVyYXR1cmU6IDAuMyxcblx0XHRcdFx0XHRcdFx0XHRudW1fcHJlZGljdDogNTAwLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQ2MDAwMCAvLyA2MCDnp5LotoXml7bvvIhPbGxhbWEg5Y+v6IO96L6D5oWi77yJXG5cdFx0XHRcdCk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnJvckRhdGEuZXJyb3IgfHwgYE9sbGFtYSBBUEkg6ZSZ6K+vOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyc2VSZXNwb25zZShkYXRhLnJlc3BvbnNlKTtcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG1heEF0dGVtcHRzOiAzLFxuXHRcdFx0XHRpbml0aWFsRGVsYXk6IDIwMDAsXG5cdFx0XHR9LFxuXHRcdFx0J09sbGFtYSBjbGFzc2lmeSdcblx0XHQpO1xuXHR9XG5cdFxuXHRwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2U6IHN0cmluZyk6IENsYXNzaWZpY2F0aW9uUmVzdWx0IHtcblx0XHQvLyDlsJ3or5Xku47lk43lupTkuK3mj5Dlj5YgSlNPTlxuXHRcdGNvbnN0IGpzb25NYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9gYGBqc29uXFxuKFtcXHNcXFNdKj8pXFxuYGBgLykgfHwgcmVzcG9uc2UubWF0Y2goLyhcXHtbXFxzXFxTXSpcXH0pLyk7XG5cdFx0XG5cdFx0aWYgKGpzb25NYXRjaCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uTWF0Y2hbMV0pO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGNhdGVnb3J5OiBwYXJzZWQuY2F0ZWdvcnkgfHwgJ090aGVyJyxcblx0XHRcdFx0XHRjb25maWRlbmNlOiBwYXJzZWQuY29uZmlkZW5jZSB8fCAwLjUsXG5cdFx0XHRcdFx0cmVhc29uaW5nOiBwYXJzZWQucmVhc29uaW5nIHx8ICcnLFxuXHRcdFx0XHRcdGlzVW5jZXJ0YWluOiBwYXJzZWQuaXNVbmNlcnRhaW4gfHwgZmFsc2UsXG5cdFx0XHRcdFx0c3VnZ2VzdGVkQ2F0ZWdvcnk6IHBhcnNlZC5zdWdnZXN0ZWRDYXRlZ29yeSxcblx0XHRcdFx0fTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZygnSlNPTiDop6PmnpDlpLHotKXvvIzkvb/nlKjmlofmnKzop6PmnpAnKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0Ly8g5aSH55So6Kej5p6Q77ya5o+Q5Y+W56ys5LiA5Liq5YiG57G76Lev5b6EXG5cdFx0Y29uc3QgY2F0ZWdvcnlNYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9jYXRlZ29yeVtcXHM6XStbXCInXT8oW15cXG5cIiddKykvaSk7XG5cdFx0Y29uc3QgY29uZmlkZW5jZU1hdGNoID0gcmVzcG9uc2UubWF0Y2goL2NvbmZpZGVuY2VbXFxzOl0rKFswLTkuXSspL2kpO1xuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRjYXRlZ29yeTogY2F0ZWdvcnlNYXRjaCA/IGNhdGVnb3J5TWF0Y2hbMV0udHJpbSgpIDogJ090aGVyJyxcblx0XHRcdGNvbmZpZGVuY2U6IGNvbmZpZGVuY2VNYXRjaCA/IHBhcnNlRmxvYXQoY29uZmlkZW5jZU1hdGNoWzFdKSA6IDAuNSxcblx0XHRcdHJlYXNvbmluZzogcmVzcG9uc2Uuc2xpY2UoMCwgMjAwKSxcblx0XHRcdGlzVW5jZXJ0YWluOiBmYWxzZSxcblx0XHR9O1xuXHR9XG59XG4iLCJpbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFNZU1RFTV9QUk9NUFQsIFVTRVJfUFJPTVBUX1RFTVBMQVRFIH0gZnJvbSAnLi9wcm9tcHRzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyB3aXRoUmV0cnksIGZldGNoV2l0aFRpbWVvdXQsIGdldFVzZXJGcmllbmRseU1lc3NhZ2UsIHZhbGlkYXRlVXJsIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JIYW5kbGVyJztcblxuaW50ZXJmYWNlIFByb3ZpZGVyQ29uZmlnIHtcblx0bmFtZTogc3RyaW5nO1xuXHRhcGlLZXk6IHN0cmluZztcblx0bW9kZWw6IHN0cmluZztcblx0YmFzZVVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyIGltcGxlbWVudHMgQUlQcm92aWRlciB7XG5cdG5hbWU6IHN0cmluZztcblx0cHJpdmF0ZSBjb25maWc6IFByb3ZpZGVyQ29uZmlnO1xuXHRwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuXHRcblx0Y29uc3RydWN0b3IoY29uZmlnOiBQcm92aWRlckNvbmZpZywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLm5hbWUgPSBjb25maWcubmFtZTtcblx0XHR0aGlzLmNvbmZpZyA9IGNvbmZpZztcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcblx0fVxuXHRcblx0YXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIOmqjOivgSBBUEkgS2V5XG5cdFx0XHRpZiAoIXRoaXMuY29uZmlnLmFwaUtleSB8fCB0aGlzLmNvbmZpZy5hcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FQSSBLZXkg5pyq6K6+572u77yM6K+35YWI6YWN572uIEFQSSBLZXknIH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOmqjOivgSBVUkxcblx0XHRcdHZhbGlkYXRlVXJsKHRoaXMuY29uZmlnLmJhc2VVcmwsICdBUEkg5Zyw5Z2AJyk7XG5cdFx0XHRcblx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRgJHt0aGlzLmNvbmZpZy5iYXNlVXJsfS9tb2RlbHNgLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWV0aG9kOiAnR0VUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmNvbmZpZy5hcGlLZXl9YCxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQxMDAwMCAvLyAxMCDnp5LotoXml7Zcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdGlmIChyZXNwb25zZS5vaykge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgJHt0aGlzLm5hbWV9IEFQSSDov57mjqXmraPluLhgIH07XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxKSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQVBJIEtleSDml6DmlYjmiJbmnKrmjojmnYPvvIzor7fmo4Dmn6XmmK/lkKbmraPnoa4nIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiDmnI3liqHmmoLml7bkuI3lj6/nlKhgIH07XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZSB9O1xuXHRcdH1cblx0fVxuXHRcblx0YXN5bmMgY2xhc3NpZnkoY29udGVudDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBjYXRlZ29yaWVzOiBzdHJpbmdbXSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHQ+IHtcblx0XHQvLyDkvb/nlKjluKbph43or5XnmoTmk43kvZxcblx0XHRyZXR1cm4gYXdhaXQgd2l0aFJldHJ5KFxuXHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB1c2VyUHJvbXB0ID0gVVNFUl9QUk9NUFRfVEVNUExBVEVcblx0XHRcdFx0XHQucmVwbGFjZSgne3tUSVRMRX19JywgdGl0bGUpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q09OVEVOVH19JywgY29udGVudC5zbGljZSgwLCA0MDAwKSlcblx0XHRcdFx0XHQucmVwbGFjZSgne3tDQVRFR09SSUVTfX0nLCBjYXRlZ29yaWVzLm1hcChjID0+IGAtICR7Y31gKS5qb2luKCdcXG4nKSk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvLyDkvb/nlKjluKbotoXml7bnmoQgZmV0Y2hcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KFxuXHRcdFx0XHRcdGAke3RoaXMuY29uZmlnLmJhc2VVcmx9L2NoYXQvY29tcGxldGlvbnNgLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHRcdFx0XHQnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmNvbmZpZy5hcGlLZXl9YCxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdFx0XHRcdG1vZGVsOiB0aGlzLmNvbmZpZy5tb2RlbCxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0XHRcdFx0XHR7IHJvbGU6ICdzeXN0ZW0nLCBjb250ZW50OiBTWVNURU1fUFJPTVBUIH0sXG5cdFx0XHRcdFx0XHRcdFx0eyByb2xlOiAndXNlcicsIGNvbnRlbnQ6IHVzZXJQcm9tcHQgfSxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0dGVtcGVyYXR1cmU6IDAuMyxcblx0XHRcdFx0XHRcdFx0bWF4X3Rva2VuczogNTAwLFxuXHRcdFx0XHRcdFx0XHRyZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQzMDAwMCAvLyAzMCDnp5LotoXml7Zcblx0XHRcdFx0KTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0XHRjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcblx0XHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGVycm9yLmVycm9yPy5tZXNzYWdlIHx8IGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfWA7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8g5p6E6YCg5pu06K+m57uG55qE6ZSZ6K+vXG5cdFx0XHRcdFx0Y29uc3QgZW5oYW5jZWRFcnJvciA9IG5ldyBFcnJvcihlcnJvck1zZykgYXMgYW55O1xuXHRcdFx0XHRcdGVuaGFuY2VkRXJyb3Iuc3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuXHRcdFx0XHRcdGVuaGFuY2VkRXJyb3IucmVzcG9uc2UgPSB7IFxuXHRcdFx0XHRcdFx0c3RhdHVzOiByZXNwb25zZS5zdGF0dXMsXG5cdFx0XHRcdFx0XHRoZWFkZXJzOiByZXNwb25zZS5oZWFkZXJzLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dGhyb3cgZW5oYW5jZWRFcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0VGV4dCA9IGRhdGEuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudCB8fCAne30nO1xuXHRcdFx0XHRcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyc2VSZXNwb25zZShyZXN1bHRUZXh0KTtcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG1heEF0dGVtcHRzOiAzLFxuXHRcdFx0XHRpbml0aWFsRGVsYXk6IDE1MDAsXG5cdFx0XHR9LFxuXHRcdFx0YCR7dGhpcy5uYW1lfSBjbGFzc2lmeWBcblx0XHQpO1xuXHR9XG5cdFxuXHRwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2VUZXh0OiBzdHJpbmcpOiBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmVzcG9uc2VUZXh0KTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhdGVnb3J5OiBwYXJzZWQuY2F0ZWdvcnkgfHwgJ090aGVyJyxcblx0XHRcdFx0Y29uZmlkZW5jZTogcGFyc2VkLmNvbmZpZGVuY2UgfHwgMC41LFxuXHRcdFx0XHRyZWFzb25pbmc6IHBhcnNlZC5yZWFzb25pbmcgfHwgJycsXG5cdFx0XHRcdGlzVW5jZXJ0YWluOiBwYXJzZWQuaXNVbmNlcnRhaW4gfHwgZmFsc2UsXG5cdFx0XHRcdHN1Z2dlc3RlZENhdGVnb3J5OiBwYXJzZWQuc3VnZ2VzdGVkQ2F0ZWdvcnksXG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoJ0pTT04g6Kej5p6Q5aSx6LSlJyk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYXRlZ29yeTogJ090aGVyJyxcblx0XHRcdFx0Y29uZmlkZW5jZTogMC41LFxuXHRcdFx0XHRyZWFzb25pbmc6IHJlc3BvbnNlVGV4dC5zbGljZSgwLCAyMDApLFxuXHRcdFx0XHRpc1VuY2VydGFpbjogdHJ1ZSxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG59XG4iLCIvKipcbiAqIOeugOWNleaXpeW/l+W3peWFt1xuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcblx0cHJpdmF0ZSBlbmFibGVkOiBib29sZWFuO1xuXHRwcml2YXRlIHByZWZpeCA9ICdbQUlDbGFzc2lmaWVyXSc7XG5cdFxuXHRjb25zdHJ1Y3RvcihlbmFibGVkID0gZmFsc2UpIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cdFxuXHRzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cdFxuXHRkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZW5hYmxlZCkge1xuXHRcdFx0Y29uc29sZS5sb2coYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0XHR9XG5cdH1cblx0XG5cdGluZm8obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnNvbGUubG9nKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cblx0XG5cdHdhcm4obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnNvbGUud2FybihgJHt0aGlzLnByZWZpeH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuXHR9XG5cdFxuXHRlcnJvcihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Y29uc29sZS5lcnJvcihgJHt0aGlzLnByZWZpeH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIE5vdGljZSwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTLCBQbHVnaW5TZXR0aW5ncywgQUlQcm92aWRlciB9IGZyb20gJy4vc2V0dGluZ3MvdHlwZXMnO1xuaW1wb3J0IHsgU2V0dGluZ3NUYWIgfSBmcm9tICcuL3NldHRpbmdzL1NldHRpbmdzVGFiJztcbmltcG9ydCB7IENsYXNzaWZ5Q29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kJztcbmltcG9ydCB7IE9sbGFtYVByb3ZpZGVyIH0gZnJvbSAnLi9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlcic7XG5pbXBvcnQgeyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIgfSBmcm9tICcuL3NlcnZpY2VzL09wZW5BSVByb3ZpZGVyJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IGZpbGVPcHMgfSBmcm9tICcuL3V0aWxzL2ZpbGVPcHMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBSUNsYXNzaWZpZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHQvLyDmj5Lku7borr7nva5cblx0c2V0dGluZ3M6IFBsdWdpblNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcblx0XG5cdC8vIOaXpeW/l1xuXHRsb2dnZXIgPSBuZXcgTG9nZ2VyKCk7XG5cdFxuXHQvLyDlkb3ku6TlpITnkIZcblx0cHJpdmF0ZSBjb21tYW5kczogQ2xhc3NpZnlDb21tYW5kO1xuXHRcblx0Ly8g6K6+572u6Z2i5p2/XG5cdHByaXZhdGUgc2V0dGluZ3NUYWI6IFNldHRpbmdzVGFiO1xuXHRcblx0YXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnNvbGUubG9nKCdbQUkgQ2xhc3NpZmllcl0g5o+S5Lu25Yqg6L295LitLi4uJyk7XG5cdFx0XG5cdFx0Ly8g5Yqg6L296K6+572uXG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblx0XHRcblx0XHQvLyDliJ3lp4vljJbml6Xlv5dcblx0XHR0aGlzLmxvZ2dlci5zZXRFbmFibGVkKHRoaXMuc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpO1xuXHRcdFxuXHRcdC8vIOiHquWKqOWIm+W7uiBJbmJveCDnm67lvZXvvIjlpoLmnpzkuI3lrZjlnKjvvIlcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGF3YWl0IGZpbGVPcHMuZW5zdXJlRm9sZGVyKHRoaXMuYXBwLnZhdWx0LCB0aGlzLnNldHRpbmdzLmluYm94Rm9sZGVyKTtcblx0XHRcdGlmIChjcmVhdGVkKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8oYOW3suWIm+W7uuaUtuS7tueuseaWh+S7tuWkuTogJHt0aGlzLnNldHRpbmdzLmluYm94Rm9sZGVyfWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKCfliJvlu7rmlLbku7bnrrHmlofku7blpLnlpLHotKU6JywgZSk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOWIneWni+WMluWRveS7pFxuXHRcdHRoaXMuY29tbWFuZHMgPSBuZXcgQ2xhc3NpZnlDb21tYW5kKHRoaXMpO1xuXHRcdFxuXHRcdC8vIOazqOWGjOWRveS7pFxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogJ2NsYXNzaWZ5LWluYm94Jyxcblx0XHRcdG5hbWU6ICdBSeaZuuiDveWIhuexuyAtIOWIhuexu+aUtuS7tueusScsXG5cdFx0XHRjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRzLmNsYXNzaWZ5SW5ib3goKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0XG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAnY2xhc3NpZnktY3VycmVudCcsXG5cdFx0XHRuYW1lOiAnQUnmmbrog73liIbnsbsgLSDliIbnsbvlvZPliY3mlofku7YnLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFx0XHRpZiAoZmlsZSkge1xuXHRcdFx0XHRcdGlmICghY2hlY2tpbmcpIHtcblx0XHRcdFx0XHRcdHRoaXMuY29tbWFuZHMuY2xhc3NpZnlDdXJyZW50RmlsZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIDEuIOa3u+WKoCBSaWJib24g5Zu+5qCH77yI5bem5L6n6L655qCP77yJXG5cdFx0dGhpcy5hZGRSaWJib25JY29uKCdzcGFya2xlcycsICdBSeaZuuiDveWIhuexuycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlJbmJveCgpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIDIuIOa3u+WKoOaWh+S7tuWPs+mUruiPnOWNlVxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1tZW51JywgKG1lbnUsIGZpbGUpID0+IHtcblx0XHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0XHRcdFx0aXRlbVxuXHRcdFx0XHRcdFx0XHQuc2V0VGl0bGUoJ0FJ5pm66IO95YiG57G7Jylcblx0XHRcdFx0XHRcdFx0LnNldEljb24oJ3NwYXJrbGVzJylcblx0XHRcdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlDdXJyZW50RmlsZSgpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXHRcdFxuXHRcdC8vIDMuIOa3u+WKoOe8lui+keWZqOiPnOWNle+8iOWPs+S4iuinkuabtOWkmuiPnOWNle+8iVxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbignZWRpdG9yLW1lbnUnLCAobWVudSkgPT4ge1xuXHRcdFx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdFx0XHRpdGVtXG5cdFx0XHRcdFx0XHQuc2V0VGl0bGUoJ0FJ5pm66IO95YiG57G7Jylcblx0XHRcdFx0XHRcdC5zZXRJY29uKCdzcGFya2xlcycpXG5cdFx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlDdXJyZW50RmlsZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHQpO1xuXHRcdFxuXHRcdC8vIOa3u+WKoOiuvue9rumdouadv1xuXHRcdHRoaXMuc2V0dGluZ3NUYWIgPSBuZXcgU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpO1xuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYih0aGlzLnNldHRpbmdzVGFiKTtcblx0XHRcblx0XHRjb25zb2xlLmxvZygnW0FJIENsYXNzaWZpZXJdIOaPkuS7tuWKoOi9veWujOaIkCEnKTtcblx0fVxuXHRcblx0b251bmxvYWQoKTogdm9pZCB7XG5cdFx0Y29uc29sZS5sb2coJ1tBSSBDbGFzc2lmaWVyXSDmj5Lku7blt7Lljbjovb0nKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOiOt+WPliBBSSBQcm92aWRlciDlrp7kvotcblx0ICovXG5cdGdldEFJUHJvdmlkZXIoKTogQUlQcm92aWRlciB7XG5cdFx0Y29uc3QgcHJvdmlkZXJUeXBlID0gdGhpcy5zZXR0aW5ncy5haVByb3ZpZGVyO1xuXHRcdFxuXHRcdC8vIOmqjOivgemFjee9rlxuXHRcdHRoaXMudmFsaWRhdGVQcm92aWRlckNvbmZpZyhwcm92aWRlclR5cGUpO1xuXHRcdFxuXHRcdHN3aXRjaCAocHJvdmlkZXJUeXBlKSB7XG5cdFx0XHRjYXNlICdvbGxhbWEnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9sbGFtYVByb3ZpZGVyKHRoaXMuc2V0dGluZ3MsIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnb3BlbmFpJzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIoe1xuXHRcdFx0XHRcdG5hbWU6ICdPcGVuQUknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3Mub3BlbmFpTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5zZXR0aW5ncy5vcGVuYWlBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnZGVlcHNlZWsnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ0RlZXBTZWVrJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MuZGVlcHNlZWtNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpVXJsLFxuXHRcdFx0XHR9LCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIoe1xuXHRcdFx0XHRcdG5hbWU6ICdNb29uc2hvdCAoS2ltaSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5tb29uc2hvdE1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlVcmwsXG5cdFx0XHRcdH0sIHRoaXMubG9nZ2VyKTtcblx0XHRcdFxuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRyZXR1cm4gbmV3IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlcih7XG5cdFx0XHRcdFx0bmFtZTogJ1poaXB1ICjmmbrosLEpJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMuc2V0dGluZ3MuemhpcHVBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MuemhpcHVNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLnpoaXB1QXBpVXJsLFxuXHRcdFx0XHR9LCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihg5pyq55+l55qEIEFJIFByb3ZpZGVyOiAke3Byb3ZpZGVyVHlwZX1gKTtcblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDpqozor4EgUHJvdmlkZXIg6YWN572uXG5cdCAqL1xuXHRwcml2YXRlIHZhbGlkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXJUeXBlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyVHlwZSkge1xuXHRcdFx0Y2FzZSAnb2xsYW1hJzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm9sbGFtYVVybCB8fCB0aGlzLnNldHRpbmdzLm9sbGFtYVVybC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPbGxhbWEg5Zyw5Z2A5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm9sbGFtYU1vZGVsIHx8IHRoaXMuc2V0dGluZ3Mub2xsYW1hTW9kZWwudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignT2xsYW1hIOaooeWei+acqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5IHx8IHRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ09wZW5BSSBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSB8fCB0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RlZXBTZWVrIEFQSSBLZXkg5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm1vb25zaG90QXBpS2V5IHx8IHRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTW9vbnNob3QgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuemhpcHVBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCfmmbrosLEgQUkgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDmnKrnn6XnmoQgQUkgUHJvdmlkZXI6ICR7cHJvdmlkZXJUeXBlfWApO1xuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOWKoOi9veiuvue9rlxuXHQgKi9cblx0YXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IHtcblx0XHRcdC4uLkRFRkFVTFRfU0VUVElOR1MsXG5cdFx0XHQuLi5kYXRhLFxuXHRcdH07XG5cdFx0XG5cdFx0Ly8g5Yid5aeL5YyW5YiG57G75YiX6KGoXG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMgfHwgdGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh0aGlzLnNldHRpbmdzLmNhdGVnb3J5VHJlZSk7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5L+d5a2Y6K6+572uXG5cdCAqL1xuXHRhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0XHR0aGlzLmxvZ2dlci5zZXRFbmFibGVkKHRoaXMuc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5bCG5YiG57G75qCR5bGV5bmz5Li65YiX6KGoXG5cdCAqL1xuXHRwcml2YXRlIGZsYXR0ZW5DYXRlZ29yaWVzKHRyZWU6IGFueSwgcHJlZml4ID0gJycpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRyZWUpKSB7XG5cdFx0XHRjb25zdCBwYXRoID0gcHJlZml4ID8gYCR7cHJlZml4fS8ke2tleX1gIDoga2V5O1xuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IHRydWUpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goLi4udGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh2YWx1ZSwgcGF0aCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cbiJdLCJuYW1lcyI6WyJOb3RpY2UiLCJDb25maXJtTW9kYWwiLCJNb2RhbCIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiVEZpbGUiLCJQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFpRE8sTUFBTSxnQkFBZ0IsR0FBbUI7QUFDL0MsSUFBQSxVQUFVLEVBQUUsUUFBUTtBQUNwQixJQUFBLFNBQVMsRUFBRSx3QkFBd0I7QUFDbkMsSUFBQSxXQUFXLEVBQUUsVUFBVTs7QUFHdkIsSUFBQSxZQUFZLEVBQUUsRUFBRTtBQUNoQixJQUFBLFdBQVcsRUFBRSxhQUFhO0FBQzFCLElBQUEsWUFBWSxFQUFFLDJCQUEyQjs7QUFHekMsSUFBQSxjQUFjLEVBQUUsRUFBRTtBQUNsQixJQUFBLGFBQWEsRUFBRSxlQUFlO0FBQzlCLElBQUEsY0FBYyxFQUFFLDZCQUE2Qjs7QUFHN0MsSUFBQSxjQUFjLEVBQUUsRUFBRTtBQUNsQixJQUFBLGFBQWEsRUFBRSxnQkFBZ0I7QUFDL0IsSUFBQSxjQUFjLEVBQUUsNEJBQTRCOztBQUc1QyxJQUFBLFdB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
