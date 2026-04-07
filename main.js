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
                const exhaustiveCheck = providerType;
                throw new Error(`未知的 AI Provider: ${exhaustiveCheck}`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3NyYy9zZXR0aW5ncy90eXBlcy50cyIsInNyYy9zcmMvc2V0dGluZ3MvaTE4bi50cyIsInNyYy9zcmMvc2V0dGluZ3MvQ2F0ZWdvcnlUcmVlVmlldy50cyIsInNyYy9zcmMvc2V0dGluZ3MvU2V0dGluZ3NUYWIudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NvbnRlbnRFeHRyYWN0b3IudHMiLCJzcmMvc3JjL3V0aWxzL2ZpbGVPcHMudHMiLCJzcmMvc3JjL3NlcnZpY2VzL0NsYXNzaWZpZXIudHMiLCJzcmMvc3JjL3V0aWxzL2Vycm9ySGFuZGxlci50cyIsInNyYy9zcmMvY29tbWFuZHMvQ2xhc3NpZnlDb21tYW5kLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9wcm9tcHRzLnRzIiwic3JjL3NyYy9zZXJ2aWNlcy9PbGxhbWFQcm92aWRlci50cyIsInNyYy9zcmMvc2VydmljZXMvT3BlbkFJUHJvdmlkZXIudHMiLCJzcmMvc3JjL3V0aWxzL2xvZ2dlci50cyIsInNyYy9zcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZXhwb3J0IHR5cGUgQUlQcm92aWRlclR5cGUgPSAnb2xsYW1hJyB8ICdvcGVuYWknIHwgJ2RlZXBzZWVrJyB8ICdtb29uc2hvdCcgfCAnemhpcHUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5VHJlZSB7XG5cdFtuYW1lOiBzdHJpbmddOiBDYXRlZ29yeVRyZWUgfCBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpblNldHRpbmdzIHtcblx0Ly8gQUkg6YWN572uXG5cdGFpUHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlO1xuXHRvbGxhbWFVcmw6IHN0cmluZztcblx0b2xsYW1hTW9kZWw6IHN0cmluZztcblx0XG5cdC8vIE9wZW5BSSDphY3nva5cblx0b3BlbmFpQXBpS2V5OiBzdHJpbmc7XG5cdG9wZW5haU1vZGVsOiBzdHJpbmc7XG5cdG9wZW5haUFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gRGVlcFNlZWsg6YWN572uXG5cdGRlZXBzZWVrQXBpS2V5OiBzdHJpbmc7XG5cdGRlZXBzZWVrTW9kZWw6IHN0cmluZztcblx0ZGVlcHNlZWtBcGlVcmw6IHN0cmluZztcblx0XG5cdC8vIE1vb25zaG90IChLaW1pKSDphY3nva5cblx0bW9vbnNob3RBcGlLZXk6IHN0cmluZztcblx0bW9vbnNob3RNb2RlbDogc3RyaW5nO1xuXHRtb29uc2hvdEFwaVVybDogc3RyaW5nO1xuXHRcblx0Ly8gWmhpcHUgKOaZuuiwsSBBSSkg6YWN572uXG5cdHpoaXB1QXBpS2V5OiBzdHJpbmc7XG5cdHpoaXB1TW9kZWw6IHN0cmluZztcblx0emhpcHVBcGlVcmw6IHN0cmluZztcblx0XG5cdC8vIOWIhuexu+mFjee9rlxuXHRpbmJveEZvbGRlcjogc3RyaW5nO1xuXHRjYXRlZ29yeVRyZWU6IENhdGVnb3J5VHJlZTtcblx0Y2F0ZWdvcmllczogc3RyaW5nW107XG5cdHNjYW5TdWJmb2xkZXJzOiBib29sZWFuO1xuXHRcblx0Ly8g6auY57qn5Yqf6IO9XG5cdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXM6IGJvb2xlYW47XG5cdGF1dG9Nb3ZlRmlsZTogYm9vbGVhbjtcblx0Y29uZmlkZW5jZVRocmVzaG9sZDogbnVtYmVyO1xuXHRcblx0Ly8g5pel5b+XXG5cdGVuYWJsZURlYnVnTG9nOiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG5cdGFpUHJvdmlkZXI6ICdvbGxhbWEnLFxuXHRvbGxhbWFVcmw6ICdodHRwOi8vbG9jYWxob3N0OjExNDM0Jyxcblx0b2xsYW1hTW9kZWw6ICdsbGFtYTMuMicsXG5cdFxuXHQvLyBPcGVuQUkg6buY6K6k6YWN572uXG5cdG9wZW5haUFwaUtleTogJycsXG5cdG9wZW5haU1vZGVsOiAnZ3B0LTRvLW1pbmknLFxuXHRvcGVuYWlBcGlVcmw6ICdodHRwczovL2FwaS5vcGVuYWkuY29tL3YxJyxcblx0XG5cdC8vIERlZXBTZWVrIOm7mOiupOmFjee9rlxuXHRkZWVwc2Vla0FwaUtleTogJycsXG5cdGRlZXBzZWVrTW9kZWw6ICdkZWVwc2Vlay1jaGF0Jyxcblx0ZGVlcHNlZWtBcGlVcmw6ICdodHRwczovL2FwaS5kZWVwc2Vlay5jb20vdjEnLFxuXHRcblx0Ly8gTW9vbnNob3QgKEtpbWkpIOm7mOiupOmFjee9rlxuXHRtb29uc2hvdEFwaUtleTogJycsXG5cdG1vb25zaG90TW9kZWw6ICdtb29uc2hvdC12MS04aycsXG5cdG1vb25zaG90QXBpVXJsOiAnaHR0cHM6Ly9hcGkubW9vbnNob3QuY24vdjEnLFxuXHRcblx0Ly8gWmhpcHUgKOaZuuiwsSkg6buY6K6k6YWN572uXG5cdHpoaXB1QXBpS2V5OiAnJyxcblx0emhpcHVNb2RlbDogJ2dsbS00Jyxcblx0emhpcHVBcGlVcmw6ICdodHRwczovL29wZW4uYmlnbW9kZWwuY24vYXBpL3BhYXMvdjQnLFxuXHRcblx0aW5ib3hGb2xkZXI6ICdJbmJveCcsXG5cdGNhdGVnb3J5VHJlZToge1xuXHRcdCdQcm9ncmFtbWluZyc6IHtcblx0XHRcdCdGcm9udGVuZCc6IHRydWUsXG5cdFx0XHQnQmFja2VuZCc6IHRydWUsXG5cdFx0XHQnTW9iaWxlJzogdHJ1ZSxcblx0XHRcdCdEZXZPcHMnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0FJICYgTUwnOiB7XG5cdFx0XHQnTWFjaGluZSBMZWFybmluZyc6IHRydWUsXG5cdFx0XHQnRGVlcCBMZWFybmluZyc6IHRydWUsXG5cdFx0XHQnTkxQJzogdHJ1ZSxcblx0XHR9LFxuXHRcdCdEYXRhJzoge1xuXHRcdFx0J0RhdGFiYXNlJzogdHJ1ZSxcblx0XHRcdCdEYXRhIEVuZ2luZWVyaW5nJzogdHJ1ZSxcblx0XHRcdCdBbmFseXRpY3MnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J0FyY2hpdGVjdHVyZSc6IHtcblx0XHRcdCdTeXN0ZW0gRGVzaWduJzogdHJ1ZSxcblx0XHRcdCdNaWNyb3NlcnZpY2VzJzogdHJ1ZSxcblx0XHR9LFxuXHRcdCdPdGhlcic6IHRydWUsXG5cdH0sXG5cdGNhdGVnb3JpZXM6IFtdLFxuXHRzY2FuU3ViZm9sZGVyczogdHJ1ZSxcblx0XG5cdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXM6IGZhbHNlLFxuXHRhdXRvTW92ZUZpbGU6IHRydWUsXG5cdGNvbmZpZGVuY2VUaHJlc2hvbGQ6IDAuNyxcblx0XG5cdGVuYWJsZURlYnVnTG9nOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuXHRjYXRlZ29yeTogc3RyaW5nO1xuXHRjb25maWRlbmNlOiBudW1iZXI7XG5cdHJlYXNvbmluZzogc3RyaW5nO1xuXHRpc1VuY2VydGFpbjogYm9vbGVhbjtcblx0c3VnZ2VzdGVkQ2F0ZWdvcnk/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQUlQcm92aWRlciB7XG5cdG5hbWU6IHN0cmluZztcblx0dGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9Pjtcblx0Y2xhc3NpZnkoY29udGVudDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBjYXRlZ29yaWVzOiBzdHJpbmdbXSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHQ+O1xufVxuIiwiLy8g5Zu96ZmF5YyW5pSv5oyBIC0g5b2T5YmN5LuF5pSv5oyB5Lit5paHXG5leHBvcnQgY29uc3QgdHJhbnNsYXRpb25zID0ge1xuXHRzZXR0aW5nczoge1xuXHRcdHRpdGxlOiAnQUnmmbrog73liIbnsbvorr7nva4nLFxuXHRcdGFpUHJvdmlkZXI6ICdBSSDmj5DkvpvllYYnLFxuXHRcdGFpUHJvdmlkZXJEZXNjOiAn6YCJ5oupIEFJIOacjeWKoeeahOaPkOS+m+aWuScsXG5cdFx0b2xsYW1hVXJsOiAnT2xsYW1hIOWcsOWdgCcsXG5cdFx0b2xsYW1hVXJsRGVzYzogJ+acrOWcsCBPbGxhbWEg5pyN5Yqh55qE5Zyw5Z2AJyxcblx0XHRvbGxhbWFNb2RlbDogJ09sbGFtYSDmqKHlnosnLFxuXHRcdG9sbGFtYU1vZGVsRGVzYzogJ+S9v+eUqOeahOaooeWei+WQjeensCcsXG5cdFx0b3BlbmFpQXBpS2V5OiAnT3BlbkFJIEFQSSBLZXknLFxuXHRcdG9wZW5haUFwaUtleURlc2M6ICfmgqjnmoQgT3BlbkFJIEFQSSDlr4bpkqUnLFxuXHRcdG9wZW5haU1vZGVsOiAnT3BlbkFJIOaooeWeiycsXG5cdFx0b3BlbmFpTW9kZWxEZXNjOiAn5L2/55So55qEIE9wZW5BSSDmqKHlnosnLFxuXHRcdGluYm94Rm9sZGVyOiAn5pS25Lu2566x5paH5Lu25aS5Jyxcblx0XHRpbmJveEZvbGRlckRlc2M6ICflvoXliIbnsbvmlofku7bmiYDlnKjnmoTmlofku7blpLknLFxuXHRcdGNhdGVnb3J5VHJlZTogJ+WIhuexu+e7k+aehCcsXG5cdFx0Y2F0ZWdvcnlUcmVlRGVzYzogJ+WumuS5ieaCqOeahOWIhuexu+agkee7k+aehO+8iEpTT07moLzlvI/vvIknLFxuXHRcdGNhdGVnb3JpZXM6ICfliIbnsbvliJfooagnLFxuXHRcdGVuYWJsZVN1Z2dlc3RlZENhdGVnb3JpZXM6ICflkK/nlKggQUkg5o6o6I2Q5paw5YiG57G7Jyxcblx0XHRlbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzRGVzYzogJ+W9k+aWh+eroOaXoOazleWMuemFjeeOsOacieWIhuexu+aXtu+8jEFJIOWPr+S7peW7uuiuruaWsOWIhuexuycsXG5cdFx0YXV0b01vdmVGaWxlOiAn6Ieq5Yqo56e75Yqo5paH5Lu2Jyxcblx0XHRhdXRvTW92ZUZpbGVEZXNjOiAn5YiG57G75a6M5oiQ5ZCO6Ieq5Yqo5bCG5paH5Lu256e75Yqo5Yiw5a+55bqU5paH5Lu25aS5Jyxcblx0XHRjb25maWRlbmNlVGhyZXNob2xkOiAn572u5L+h5bqm6ZiI5YC8Jyxcblx0XHRjb25maWRlbmNlVGhyZXNob2xkRGVzYzogJ+S9juS6juatpOe9ruS/oeW6puWwhuaPkOekuueUqOaIt+ehruiupCcsXG5cdFx0ZW5hYmxlRGVidWdMb2c6ICflkK/nlKjosIPor5Xml6Xlv5cnLFxuXHRcdGVuYWJsZURlYnVnTG9nRGVzYzogJ+WcqOaOp+WItuWPsOi+k+WHuuivpue7huaXpeW/lycsXG5cdFx0dGVzdENvbm5lY3Rpb246ICfmtYvor5Xov57mjqUnLFxuXHRcdGNvbm5lY3Rpb25TdWNjZXNzOiAn6L+e5o6l5oiQ5Yqf77yBJyxcblx0XHRjb25uZWN0aW9uRmFpbGVkOiAn6L+e5o6l5aSx6LSl77yaJyxcblx0XHRzYXZlOiAn5L+d5a2Y6K6+572uJyxcblx0XHRjYXRlZ29yaWVzUGxhY2Vob2xkZXI6ICfnvJbnqIsv5YmN56uvLCDnvJbnqIsv5ZCO56uvLCBBSS/mnLrlmajlrabkuaAsIC4uLicsXG5cdFx0YWRkVG9wTGV2ZWw6ICfmt7vliqDkuIDnuqfliIbnsbsnLFxuXHRcdGVudGVyQ2F0ZWdvcnlOYW1lOiAn6K+36L6T5YWl5YiG57G75ZCN56ewJyxcblx0XHRlbnRlck5ld05hbWU6ICfor7fovpPlhaXmlrDlkI3np7AnLFxuXHRcdGNhdGVnb3J5RXhpc3RzOiAn5YiG57G75bey5a2Y5ZyoJyxcblx0XHRjb25maXJtRGVsZXRlOiAn56Gu6K6k5Yig6Zmk5q2k5YiG57G777yfJyxcblx0XHRjb25maXJtRGVsZXRlV2l0aENoaWxkcmVuOiAn5q2k5YiG57G75YyF5ZCr5a2Q5YiG57G777yM56Gu6K6k5Yig6Zmk5omA5pyJ5a2Q5YiG57G75ZCX77yfJyxcblx0XHRyZXN0b3JlRGVmYXVsdDogJ+aBouWkjem7mOiupCcsXG5cdFx0Y29uZmlybVJlc3RvcmVEZWZhdWx0OiAn56Gu6K6k5oGi5aSN6buY6K6k5YiG57G75qCR77yf5b2T5YmN55qE6Ieq5a6a5LmJ6YWN572u5bCG5Lii5aSx44CCJyxcblx0fSxcblx0Y2xhc3NpZnk6IHtcblx0XHRjb21tYW5kOiAnQUnmmbrog73liIbnsbsnLFxuXHRcdGNsYXNzaWZ5SW5ib3g6ICfliIbnsbvmlLbku7bnrrEnLFxuXHRcdGNsYXNzaWZ5Q3VycmVudDogJ+WIhuexu+W9k+WJjeaWh+S7ticsXG5cdFx0cHJvY2Vzc2luZzogJ+ato+WcqOWIhuaekDogJyxcblx0XHRzdWNjZXNzOiAn5YiG57G75a6M5oiQJyxcblx0XHRtb3ZlZDogJ+W3suenu+WKqOWIsDogJyxcblx0XHR1bmNlcnRhaW46ICfnva7kv6HluqbovoPkvY4gKCcsXG5cdFx0Y29uZmlybTogJ+aYr+WQpuehruiupOWIhuexu+WIsDogJyxcblx0XHRsb3dDb25maWRlbmNlOiAn572u5L+h5bqm6L+H5L2O77yM6K+35omL5Yqo56Gu6K6kJyxcblx0XHRzdWdnZXN0ZWRDYXRlZ29yeTogJ+W7uuiuruaWsOWinuWIhuexuzogJyxcblx0XHRhZGRDYXRlZ29yeTogJ+aYr+WQpuWwhuatpOWIhuexu+a3u+WKoOWIsOmihOiuvj8nLFxuXHRcdG5vSW5ib3g6ICfmnKrmib7liLDmlLbku7bnrrHmlofku7blpLk6ICcsXG5cdFx0bm9GaWxlczogJ+aUtuS7tueuseS4reayoeacieaWh+S7ticsXG5cdFx0c2tpcDogJ+i3s+i/hycsXG5cdH0sXG5cdGVycm9yczoge1xuXHRcdG5vQ29udGVudDogJ+aXoOazleaPkOWPluaWh+S7tuWGheWuuScsXG5cdFx0bm9UaXRsZTogJ+aXoOazleiOt+WPluaWh+S7tuagh+mimCcsXG5cdFx0YWlFcnJvcjogJ0FJIOacjeWKoemUmeivrzogJyxcblx0XHRtb3ZlRXJyb3I6ICfnp7vliqjmlofku7blpLHotKU6ICcsXG5cdH0sXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IGtleXMgPSBrZXkuc3BsaXQoJy4nKTtcblx0bGV0IHJlc3VsdDogYW55ID0gdHJhbnNsYXRpb25zO1xuXHRmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuXHRcdHJlc3VsdCA9IHJlc3VsdD8uW2tdO1xuXHR9XG5cdHJldHVybiByZXN1bHQgfHwga2V5O1xufVxuIiwiaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5pbXBvcnQgeyBBcHAsIE1vZGFsLCBTZXR0aW5nLCBOb3RpY2UgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8vIOWjsOaYjuWFqOWxgCBhcHAg5Y+Y6YePXG5kZWNsYXJlIGNvbnN0IGFwcDogQXBwO1xuXG4vKipcbiAqIOWIhuexu+agkeiKgueCueaVsOaNrue7k+aehFxuICovXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3J5Tm9kZSB7XG5cdG5hbWU6IHN0cmluZztcblx0Y2hpbGRyZW4/OiBDYXRlZ29yeU5vZGVbXTtcbn1cblxuLyoqXG4gKiDliIbnsbvmoJHoioLngrnnsbvlnotcbiAqL1xudHlwZSBDYXRlZ29yeVRyZWVOb2RlID0gUmVjb3JkPHN0cmluZywgQ2F0ZWdvcnlUcmVlTm9kZSB8IHRydWU+O1xuXG4vKipcbiAqIOWIhuexu+agkeWPr+inhuWMlue7hOS7tlxuICovXG5leHBvcnQgY2xhc3MgQ2F0ZWdvcnlUcmVlVmlldyB7XG5cdHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRyZWU6IENhdGVnb3J5VHJlZU5vZGU7XG5cdHByaXZhdGUgb25DaGFuZ2U6ICh0cmVlOiBDYXRlZ29yeVRyZWVOb2RlKSA9PiB2b2lkO1xuXHRwcml2YXRlIGV4cGFuZGVkTm9kZXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcblx0XHR0cmVlOiBDYXRlZ29yeVRyZWVOb2RlLFxuXHRcdG9uQ2hhbmdlOiAodHJlZTogQ2F0ZWdvcnlUcmVlTm9kZSkgPT4gdm9pZFxuXHQpIHtcblx0XHR0aGlzLmNvbnRhaW5lckVsID0gY29udGFpbmVyRWw7XG5cdFx0dGhpcy50cmVlID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0cmVlKSk7IC8vIOa3seaLt+i0nVxuXHRcdHRoaXMub25DaGFuZ2UgPSBvbkNoYW5nZTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOa4suafk+aVtOS4quagkVxuXHQgKi9cblx0cHJpdmF0ZSByZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jb250YWluZXJFbC5lbXB0eSgpO1xuXHRcdHRoaXMuY29udGFpbmVyRWwuYWRkQ2xhc3MoJ2NhdGVnb3J5LXRyZWUtY29udGFpbmVyJyk7XG5cblx0XHQvLyDmuLLmn5PmoJHlvaLnu5PmnoRcblx0XHRjb25zdCB0cmVlRWwgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdignY2F0ZWdvcnktdHJlZScpO1xuXHRcdHRoaXMucmVuZGVyVHJlZUxldmVsKHRyZWVFbCwgdGhpcy50cmVlLCAnJyk7XG5cblx0XHQvLyDmt7vliqDkuIDnuqfliIbnsbvmjInpkq5cblx0XHRjb25zdCBhY3Rpb25zRWwgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdignY2F0ZWdvcnktdHJlZS1hY3Rpb25zJyk7XG5cdFx0Y29uc3QgYWRkQnRuID0gYWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRjbHM6ICdtb2QtY3RhJyxcblx0XHRcdHRleHQ6IHQoJ3NldHRpbmdzLmFkZFRvcExldmVsJylcblx0XHR9KTtcblx0XHRhZGRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmFkZFRvcExldmVsQ2F0ZWdvcnkoKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmuLLmn5PmoJHnmoTmn5DkuIDnuqdcblx0ICovXG5cdHByaXZhdGUgcmVuZGVyVHJlZUxldmVsKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0bm9kZTogQ2F0ZWdvcnlUcmVlTm9kZSxcblx0XHRwYXRoOiBzdHJpbmdcblx0KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMobm9kZSkpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRQYXRoID0gcGF0aCA/IGAke3BhdGh9LyR7a2V5fWAgOiBrZXk7XG5cdFx0XHRjb25zdCBoYXNDaGlsZHJlbiA9IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA+IDA7XG5cdFx0XHRjb25zdCBpc0V4cGFuZGVkID0gdGhpcy5leHBhbmRlZE5vZGVzLmhhcyhjdXJyZW50UGF0aCk7XG5cblx0XHRcdC8vIOWIm+W7uuiKgueCueWuueWZqFxuXHRcdFx0Y29uc3Qgbm9kZUVsID0gY29udGFpbmVyLmNyZWF0ZURpdignY2F0ZWdvcnktbm9kZScpO1xuXG5cdFx0XHQvLyDoioLngrnooYzvvIjlkI3np7AgKyDmk43kvZzmjInpkq7vvIlcblx0XHRcdGNvbnN0IG5vZGVSb3cgPSBub2RlRWwuY3JlYXRlRGl2KCdjYXRlZ29yeS1ub2RlLXJvdycpO1xuXG5cdFx0XHQvLyDlsZXlvIAv5oqY5Y+g5oyJ6ZKu77yI5LuF5b2T5pyJ5a2Q6IqC54K55pe25pi+56S677yJXG5cdFx0XHRpZiAoaGFzQ2hpbGRyZW4pIHtcblx0XHRcdFx0Y29uc3QgZXhwYW5kQnRuID0gbm9kZVJvdy5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0XHRcdGNsczogJ2NhdGVnb3J5LWV4cGFuZC1idG4nLFxuXHRcdFx0XHRcdHRleHQ6IGlzRXhwYW5kZWQgPyAn4pa8JyA6ICfilrYnXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRleHBhbmRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGlzRXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuZXhwYW5kZWROb2Rlcy5kZWxldGUoY3VycmVudFBhdGgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4cGFuZGVkTm9kZXMuYWRkKGN1cnJlbnRQYXRoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyDljaDkvY3nrKbvvIzkv53mjIHlr7npvZBcblx0XHRcdFx0bm9kZVJvdy5jcmVhdGVFbCgnc3BhbicsIHsgY2xzOiAnY2F0ZWdvcnktZXhwYW5kLXBsYWNlaG9sZGVyJywgdGV4dDogJ+OAgCcgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIOWbvuagh1xuXHRcdFx0bm9kZVJvdy5jcmVhdGVFbCgnc3BhbicsIHtcblx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktaWNvbicsXG5cdFx0XHRcdHRleHQ6IGhhc0NoaWxkcmVuID8gJ/Cfk4InIDogJ/Cfk4QnXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8g5ZCN56ewXG5cdFx0XHRub2RlUm93LmNyZWF0ZUVsKCdzcGFuJywge1xuXHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1uYW1lJyxcblx0XHRcdFx0dGV4dDoga2V5XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8g5pON5L2c5oyJ6ZKu5a655ZmoXG5cdFx0XHRjb25zdCBhY3Rpb25zRWwgPSBub2RlUm93LmNyZWF0ZURpdignY2F0ZWdvcnktbm9kZS1hY3Rpb25zJyk7XG5cblx0XHRcdC8vIOe8lui+keaMiemSrlxuXHRcdFx0YWN0aW9uc0VsLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHRcdGNsczogJ2NhdGVnb3J5LWFjdGlvbi1idG4nLFxuXHRcdFx0XHR0ZXh0OiAn4pyP77iPJ1xuXHRcdFx0fSkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZWRpdE5vZGUoY3VycmVudFBhdGgsIGtleSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8g5Yig6Zmk5oyJ6ZKuXG5cdFx0XHRhY3Rpb25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdFx0Y2xzOiAnY2F0ZWdvcnktYWN0aW9uLWJ0bicsXG5cdFx0XHRcdHRleHQ6ICfwn5eR77iPJ1xuXHRcdFx0fSkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZGVsZXRlTm9kZShjdXJyZW50UGF0aCwga2V5LCBoYXNDaGlsZHJlbik7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8g5re75Yqg5a2Q5YiG57G75oyJ6ZKu77yI5LuF5a+554i26IqC54K55pi+56S677yJXG5cdFx0XHRpZiAoaGFzQ2hpbGRyZW4gfHwgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRhY3Rpb25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdFx0XHRjbHM6ICdjYXRlZ29yeS1hY3Rpb24tYnRuJyxcblx0XHRcdFx0XHR0ZXh0OiAn4p6VJ1xuXHRcdFx0XHR9KS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmFkZENoaWxkQ2F0ZWdvcnkoY3VycmVudFBhdGgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8g5riy5p+T5a2Q6IqC54K5XG5cdFx0XHRpZiAoaGFzQ2hpbGRyZW4gJiYgaXNFeHBhbmRlZCkge1xuXHRcdFx0XHRjb25zdCBjaGlsZHJlbkVsID0gbm9kZUVsLmNyZWF0ZURpdignY2F0ZWdvcnktY2hpbGRyZW4nKTtcblx0XHRcdFx0dGhpcy5yZW5kZXJUcmVlTGV2ZWwoY2hpbGRyZW5FbCwgdmFsdWUsIGN1cnJlbnRQYXRoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICog5re75Yqg5LiA57qn5YiG57G7XG5cdCAqL1xuXHRwcml2YXRlIGFkZFRvcExldmVsQ2F0ZWdvcnkoKTogdm9pZCB7XG5cdFx0dGhpcy5zaG93UHJvbXB0TW9kYWwoXG5cdFx0XHR0KCdzZXR0aW5ncy5lbnRlckNhdGVnb3J5TmFtZScpLFxuXHRcdFx0JycsXG5cdFx0XHQobmFtZSkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy50cmVlW25hbWVdKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jYXRlZ29yeUV4aXN0cycpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy50cmVlW25hbWVdID0ge307XG5cdFx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmt7vliqDlrZDliIbnsbtcblx0ICovXG5cdHByaXZhdGUgYWRkQ2hpbGRDYXRlZ29yeShwYXJlbnRQYXRoOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNob3dQcm9tcHRNb2RhbChcblx0XHRcdHQoJ3NldHRpbmdzLmVudGVyQ2F0ZWdvcnlOYW1lJyksXG5cdFx0XHQnJyxcblx0XHRcdChuYW1lKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHBhcmVudCA9IHRoaXMuZ2V0Tm9kZUJ5UGF0aChwYXJlbnRQYXRoKTtcblx0XHRcdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdFx0XHRpZiAocGFyZW50W25hbWVdKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jYXRlZ29yeUV4aXN0cycpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwYXJlbnRbbmFtZV0gPSB7fTtcblx0XHRcdFx0dGhpcy5leHBhbmRlZE5vZGVzLmFkZChwYXJlbnRQYXRoKTtcblx0XHRcdFx0dGhpcy5ub3RpZnlDaGFuZ2UoKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOe8lui+keiKgueCueWQjeensFxuXHQgKi9cblx0cHJpdmF0ZSBlZGl0Tm9kZShwYXRoOiBzdHJpbmcsIG9sZE5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuc2hvd1Byb21wdE1vZGFsKFxuXHRcdFx0dCgnc2V0dGluZ3MuZW50ZXJOZXdOYW1lJyksXG5cdFx0XHRvbGROYW1lLFxuXHRcdFx0KG5ld05hbWUpID0+IHtcblx0XHRcdFx0aWYgKCFuZXdOYW1lIHx8IG5ld05hbWUudHJpbSgpID09PSAnJyB8fCBuZXdOYW1lID09PSBvbGROYW1lKSByZXR1cm47XG5cblx0XHRcdFx0Y29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuXHRcdFx0XHRjb25zdCBwYXJlbnRQYXRoID0gcGF0aFBhcnRzLnNsaWNlKDAsIC0xKS5qb2luKCcvJyk7XG5cdFx0XHRcdGNvbnN0IHBhcmVudCA9IHBhcmVudFBhdGggPyB0aGlzLmdldE5vZGVCeVBhdGgocGFyZW50UGF0aCkgOiB0aGlzLnRyZWU7XG5cblx0XHRcdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdFx0XHRpZiAocGFyZW50W25ld05hbWVdKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jYXRlZ29yeUV4aXN0cycpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyDph43lkb3lkI1cblx0XHRcdFx0cGFyZW50W25ld05hbWVdID0gcGFyZW50W29sZE5hbWVdO1xuXHRcdFx0XHRkZWxldGUgcGFyZW50W29sZE5hbWVdO1xuXG5cdFx0XHRcdHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDliKDpmaToioLngrlcblx0ICovXG5cdHByaXZhdGUgZGVsZXRlTm9kZShwYXRoOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgaGFzQ2hpbGRyZW46IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBtZXNzYWdlID0gaGFzQ2hpbGRyZW5cblx0XHRcdD8gdCgnc2V0dGluZ3MuY29uZmlybURlbGV0ZVdpdGhDaGlsZHJlbicpXG5cdFx0XHQ6IHQoJ3NldHRpbmdzLmNvbmZpcm1EZWxldGUnKTtcblxuXHRcdHRoaXMuc2hvd0NvbmZpcm1Nb2RhbChtZXNzYWdlLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwYXRoUGFydHMgPSBwYXRoLnNwbGl0KCcvJyk7XG5cdFx0XHRjb25zdCBwYXJlbnRQYXRoID0gcGF0aFBhcnRzLnNsaWNlKDAsIC0xKS5qb2luKCcvJyk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBwYXJlbnRQYXRoID8gdGhpcy5nZXROb2RlQnlQYXRoKHBhcmVudFBhdGgpIDogdGhpcy50cmVlO1xuXG5cdFx0XHRpZiAoIXBhcmVudCkgcmV0dXJuO1xuXG5cdFx0XHRkZWxldGUgcGFyZW50W25hbWVdO1xuXHRcdFx0dGhpcy5ub3RpZnlDaGFuZ2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmoLnmja7ot6/lvoTojrflj5boioLngrlcblx0ICovXG5cdHByaXZhdGUgZ2V0Tm9kZUJ5UGF0aChwYXRoOiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgbnVsbCB7XG5cdFx0Y29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcvJyk7XG5cdFx0bGV0IGN1cnJlbnQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB0aGlzLnRyZWU7XG5cblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcblx0XHRcdGlmICghY3VycmVudFtwYXJ0XSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGN1cnJlbnQgPSBjdXJyZW50W3BhcnRdO1xuXHRcdH1cblxuXHRcdHJldHVybiBjdXJyZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIOmAmuefpeWklumDqOagkeW3suabtOaWsFxuXHQgKi9cblx0cHJpdmF0ZSBub3RpZnlDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5vbkNoYW5nZSh0aGlzLnRyZWUpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHQvKipcblx0ICog5pu05paw5qCR5pWw5o2u77yI5aSW6YOo6LCD55So77yJXG5cdCAqL1xuXHR1cGRhdGVUcmVlKG5ld1RyZWU6IFJlY29yZDxzdHJpbmcsIGFueT4pOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG5ld1RyZWUpKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIOaYvuekuui+k+WFpeWvueivneahhlxuXHQgKi9cblx0cHJpdmF0ZSBzaG93UHJvbXB0TW9kYWwoXG5cdFx0cGxhY2Vob2xkZXI6IHN0cmluZyxcblx0XHRkZWZhdWx0VmFsdWU6IHN0cmluZyxcblx0XHRvblN1Ym1pdDogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWRcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kYWwgPSBuZXcgSW5wdXRNb2RhbChcblx0XHRcdHBsYWNlaG9sZGVyLFxuXHRcdFx0ZGVmYXVsdFZhbHVlLFxuXHRcdFx0b25TdWJtaXRcblx0XHQpO1xuXHRcdG1vZGFsLm9wZW4oKTtcblx0fVxuXG5cdC8qKlxuXHQgKiDmmL7npLrnoa7orqTlr7nor53moYZcblx0ICovXG5cdHByaXZhdGUgc2hvd0NvbmZpcm1Nb2RhbChcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0b25Db25maXJtOiAoKSA9PiB2b2lkXG5cdCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGFsID0gbmV3IENvbmZpcm1Nb2RhbChcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRvbkNvbmZpcm1cblx0XHQpO1xuXHRcdG1vZGFsLm9wZW4oKTtcblx0fVxufVxuXG4vKipcbiAqIOi+k+WFpeWvueivneahhlxuICovXG5jbGFzcyBJbnB1dE1vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwcml2YXRlIHBsYWNlaG9sZGVyOiBzdHJpbmc7XG5cdHByaXZhdGUgZGVmYXVsdFZhbHVlOiBzdHJpbmc7XG5cdHByaXZhdGUgb25TdWJtaXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHBsYWNlaG9sZGVyOiBzdHJpbmcsXG5cdFx0ZGVmYXVsdFZhbHVlOiBzdHJpbmcsXG5cdFx0b25TdWJtaXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkXG5cdCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xuXHRcdHRoaXMuZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlO1xuXHRcdHRoaXMub25TdWJtaXQgPSBvblN1Ym1pdDtcblx0fVxuXG5cdG9uT3BlbigpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IHRoaXMucGxhY2Vob2xkZXIgfSk7XG5cblx0XHRjb25zdCBpbnB1dCA9IGNvbnRlbnRFbC5jcmVhdGVFbCgnaW5wdXQnLCB7XG5cdFx0XHR0eXBlOiAndGV4dCcsXG5cdFx0XHR2YWx1ZTogdGhpcy5kZWZhdWx0VmFsdWVcblx0XHR9KTtcblxuXHRcdGlucHV0LnN0eWxlLndpZHRoID0gJzEwMCUnO1xuXHRcdGlucHV0LnN0eWxlLm1hcmdpbkJvdHRvbSA9ICcyMHB4JztcblxuXHRcdC8vIOebkeWQrOWbnui9pumUrlxuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG5cdFx0XHRcdHRoaXMub25TdWJtaXQoaW5wdXQudmFsdWUpO1xuXHRcdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBidXR0b25zRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KCdtb2RhbC1idXR0b24tY29udGFpbmVyJyk7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0YnV0dG9uc0VsLnN0eWxlLmp1c3RpZnlDb250ZW50ID0gJ2ZsZXgtZW5kJztcblx0XHRidXR0b25zRWwuc3R5bGUuZ2FwID0gJzhweCc7XG5cblx0XHRjb25zdCBjYW5jZWxCdG4gPSBidXR0b25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHsgdGV4dDogJ+WPlua2iCcgfSk7XG5cdFx0Y2FuY2VsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5jbG9zZSgpKTtcblxuXHRcdGNvbnN0IGNvbmZpcm1CdG4gPSBidXR0b25zRWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICfnoa7lrponLFxuXHRcdFx0Y2xzOiAnbW9kLWN0YSdcblx0XHR9KTtcblx0XHRjb25maXJtQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5vblN1Ym1pdChpbnB1dC52YWx1ZSk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fSk7XG5cblx0XHQvLyDoh6rliqjogZrnhKZcblx0XHRpbnB1dC5mb2N1cygpO1xuXHRcdGlucHV0LnNlbGVjdCgpO1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0fVxufVxuXG4vKipcbiAqIOehruiupOWvueivneahhlxuICovXG5jbGFzcyBDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgbWVzc2FnZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uQ29uZmlybTogKCkgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0b25Db25maXJtOiAoKSA9PiB2b2lkXG5cdCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLm9uQ29uZmlybSA9IG9uQ29uZmlybTtcblx0fVxuXG5cdG9uT3BlbigpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IHRleHQ6IHRoaXMubWVzc2FnZSB9KTtcblxuXHRcdGNvbnN0IGJ1dHRvbnNFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ21vZGFsLWJ1dHRvbi1jb250YWluZXInKTtcblx0XHRidXR0b25zRWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4Jztcblx0XHRidXR0b25zRWwuc3R5bGUuanVzdGlmeUNvbnRlbnQgPSAnZmxleC1lbmQnO1xuXHRcdGJ1dHRvbnNFbC5zdHlsZS5nYXAgPSAnOHB4JztcblxuXHRcdGNvbnN0IGNhbmNlbEJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywgeyB0ZXh0OiAn5Y+W5raIJyB9KTtcblx0XHRjYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlKCkpO1xuXG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGJ1dHRvbnNFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0dGV4dDogJ+ehruWumicsXG5cdFx0XHRjbHM6ICdtb2QtY3RhJ1xuXHRcdH0pO1xuXHRcdGNvbmZpcm1CdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR0aGlzLm9uQ29uZmlybSgpO1xuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0fVxufVxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBOb3RpY2UgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBBSUNsYXNzaWZpZXJQbHVnaW4gZnJvbSAnLi4vbWFpbic7XG5pbXBvcnQgeyBBSVByb3ZpZGVyVHlwZSwgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5pbXBvcnQgeyBDYXRlZ29yeVRyZWVWaWV3IH0gZnJvbSAnLi9DYXRlZ29yeVRyZWVWaWV3JztcblxuLy8g5ZCE5pyN5Yqh5ZWG5Y+v55So5qih5Z6L5YiX6KGoXG5jb25zdCBBVkFJTEFCTEVfTU9ERUxTOiBSZWNvcmQ8c3RyaW5nLCBBcnJheTx7IHZhbHVlOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfT4+ID0ge1xuXHRvcGVuYWk6IFtcblx0XHR7IHZhbHVlOiAnZ3B0LTRvLW1pbmknLCBsYWJlbDogJ0dQVC00byBNaW5pICjmjqjojZApJyB9LFxuXHRcdHsgdmFsdWU6ICdncHQtNG8nLCBsYWJlbDogJ0dQVC00bycgfSxcblx0XHR7IHZhbHVlOiAnZ3B0LTQtdHVyYm8nLCBsYWJlbDogJ0dQVC00IFR1cmJvJyB9LFxuXHRcdHsgdmFsdWU6ICdncHQtMy41LXR1cmJvJywgbGFiZWw6ICdHUFQtMy41IFR1cmJvJyB9LFxuXHRdLFxuXHRkZWVwc2VlazogW1xuXHRcdHsgdmFsdWU6ICdkZWVwc2Vlay1jaGF0JywgbGFiZWw6ICdEZWVwU2VlayBDaGF0ICjmjqjojZApJyB9LFxuXHRcdHsgdmFsdWU6ICdkZWVwc2Vlay1jb2RlcicsIGxhYmVsOiAnRGVlcFNlZWsgQ29kZXInIH0sXG5cdF0sXG5cdG1vb25zaG90OiBbXG5cdFx0eyB2YWx1ZTogJ21vb25zaG90LXYxLThrJywgbGFiZWw6ICdNb29uc2hvdCBWMSA4SyAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnbW9vbnNob3QtdjEtMzJrJywgbGFiZWw6ICdNb29uc2hvdCBWMSAzMksnIH0sXG5cdFx0eyB2YWx1ZTogJ21vb25zaG90LXYxLTEyOGsnLCBsYWJlbDogJ01vb25zaG90IFYxIDEyOEsnIH0sXG5cdF0sXG5cdHpoaXB1OiBbXG5cdFx0eyB2YWx1ZTogJ2dsbS00JywgbGFiZWw6ICdHTE0tNCAo5o6o6I2QKScgfSxcblx0XHR7IHZhbHVlOiAnZ2xtLTQtZmxhc2gnLCBsYWJlbDogJ0dMTS00IEZsYXNoJyB9LFxuXHRcdHsgdmFsdWU6ICdnbG0tMy10dXJibycsIGxhYmVsOiAnR0xNLTMgVHVyYm8nIH0sXG5cdF0sXG59O1xuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblx0cGx1Z2luOiBBSUNsYXNzaWZpZXJQbHVnaW47XG5cdFxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBBSUNsYXNzaWZpZXJQbHVnaW4pIHtcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblx0XG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXHRcdFxuXHRcdC8vIOmhtumDqOWvvOiIquagj1xuXHRcdGNvbnN0IGhlYWRlckVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KCdzZXR0aW5ncy1oZWFkZXInKTtcblx0XHRoZWFkZXJFbC5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDsgbWFyZ2luLWJvdHRvbTogMjBweDsnO1xuXHRcdFxuXHRcdC8vIOi/lOWbnuaMiemSrlxuXHRcdGNvbnN0IGJhY2tCdG4gPSBoZWFkZXJFbC5jcmVhdGVFbCgnYnV0dG9uJywge1xuXHRcdFx0Y2xzOiAnY2xpY2thYmxlLWljb24nLFxuXHRcdFx0YXR0cjoge1xuXHRcdFx0XHQnYXJpYS1sYWJlbCc6ICfov5Tlm57kuIrkuIDnuqcnLFxuXHRcdFx0XHQndGl0bGUnOiAn6L+U5Zue5LiK5LiA57qnJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGJhY2tCdG4uaW5uZXJIVE1MID0gJzxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMjRcIiBoZWlnaHQ9XCIyNFwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48cGF0aCBkPVwibTE1IDE4LTYtNiA2LTZcIi8+PC9zdmc+Jztcblx0XHRiYWNrQnRuLnN0eWxlLmNzc1RleHQgPSAnYmFja2dyb3VuZDogbm9uZTsgYm9yZGVyOiBub25lOyBjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDRweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTsnO1xuXHRcdGJhY2tCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG5cdFx0XHQvLyDnm7TmjqXop6blj5EgT2JzaWRpYW4g6Ieq5bim55qE6L+U5Zue5Yqf6IO9XG5cdFx0XHQvLyDmn6Xmib7orr7nva7kvqfovrnmoI/kuK3nmoTnrKzkuIDkuKrmj5Lku7bpgInpobnlubbngrnlh7tcblx0XHRcdGNvbnN0IGNvbW11bml0eVBsdWdpbk5hdkl0ZW0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubmF2LWZvbGRlci5tb2Qtcm9vdCA+IC5uYXYtZm9sZGVyLXRpdGxlJyk7XG5cdFx0XHRpZiAoY29tbXVuaXR5UGx1Z2luTmF2SXRlbSkge1xuXHRcdFx0XHQoY29tbXVuaXR5UGx1Z2luTmF2SXRlbSBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIOWmguaenOaJvuS4jeWIsO+8jOWwneivleeCueWHu+S7u+S9leS4gOS4quS+p+i+ueagj+mhuVxuXHRcdFx0XHRjb25zdCBhbnlOYXZJdGVtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnZlcnRpY2FsLXRhYi1uYXYtaXRlbScpO1xuXHRcdFx0XHRpZiAoYW55TmF2SXRlbSkge1xuXHRcdFx0XHRcdChhbnlOYXZJdGVtIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0YmFja0J0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCAoKSA9PiB7XG5cdFx0XHRiYWNrQnRuLnN0eWxlLmNvbG9yID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG5cdFx0fSk7XG5cdFx0YmFja0J0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsICgpID0+IHtcblx0XHRcdGJhY2tCdG4uc3R5bGUuY29sb3IgPSAndmFyKC0tdGV4dC1tdXRlZCknO1xuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIOagh+mimFxuXHRcdGNvbnN0IHRpdGxlRWwgPSBoZWFkZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6IHQoJ3NldHRpbmdzLnRpdGxlJykgfSk7XG5cdFx0dGl0bGVFbC5zdHlsZS5jc3NUZXh0ID0gJ21hcmdpbjogMDsgZmxleDogMTsnO1xuXHRcdFxuXHRcdHRoaXMuYWRkQUlQcm92aWRlclNlY3Rpb24oKTtcblx0XHR0aGlzLmFkZENhdGVnb3J5U2VjdGlvbigpO1xuXHRcdHRoaXMuYWRkQWR2YW5jZWRTZWN0aW9uKCk7XG5cdFx0dGhpcy5hZGREZWJ1Z1NlY3Rpb24oKTtcblx0fVxuXHRcblx0cHJpdmF0ZSBhZGRBSVByb3ZpZGVyU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ0FJIOmFjee9ricgfSk7XG5cdFx0XG5cdFx0Ly8gQUkg5o+Q5L6b5ZWG6YCJ5oupXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5haVByb3ZpZGVyJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5haVByb3ZpZGVyRGVzYycpKVxuXHRcdFx0LmFkZERyb3Bkb3duKGRyb3Bkb3duID0+IHtcblx0XHRcdFx0ZHJvcGRvd25cblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdvbGxhbWEnLCAnT2xsYW1hICjmnKzlnLApJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdvcGVuYWknLCAnT3BlbkFJJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCdkZWVwc2VlaycsICdEZWVwU2VlaycpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbignbW9vbnNob3QnLCAnTW9vbnNob3QgKEtpbWkpJylcblx0XHRcdFx0XHQuYWRkT3B0aW9uKCd6aGlwdScsICdaaGlwdSAo5pm66LCxIEFJKScpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciA9IHZhbHVlIGFzIEFJUHJvdmlkZXJUeXBlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyID09PSAnb2xsYW1hJykge1xuXHRcdFx0Ly8gT2xsYW1hIOmFjee9rlxuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLm9sbGFtYVVybCcpKVxuXHRcdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5vbGxhbWFVcmxEZXNjJykpXG5cdFx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hVXJsKVxuXHRcdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5vbGxhbWFVcmwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5vbGxhbWFNb2RlbCcpKVxuXHRcdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5vbGxhbWFNb2RlbERlc2MnKSlcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5vbGxhbWFNb2RlbClcblx0XHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mub2xsYW1hTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEFQSSBLZXkg6YWN572uXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUoYCR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSBBUEkgS2V5YClcblx0XHRcdFx0LnNldERlc2MoYOivt+i+k+WFpSAke3RoaXMuZ2V0UHJvdmlkZXJEaXNwbGF5TmFtZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyKX0g55qEIEFQSSBLZXlgKVxuXHRcdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHtcblx0XHRcdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMuZ2V0UHJvdmlkZXJWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyLCAnYXBpS2V5JykpXG5cdFx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ3NrLS4uLicpXG5cdFx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvdmlkZXJDb25maWcodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2FwaUtleScsIHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR0ZXh0LmlucHV0RWwudHlwZSA9ICdwYXNzd29yZCc7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyBNb2RlbCDphY3nva7vvIjkuIvmi4npgInmi6nvvIlcblx0XHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0XHQuc2V0TmFtZShgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOaooeWei2ApXG5cdFx0XHRcdC5zZXREZXNjKGDor7fpgInmi6kgJHt0aGlzLmdldFByb3ZpZGVyRGlzcGxheU5hbWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcil9IOeahOaooeWei2ApXG5cdFx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWxzID0gdGhpcy5nZXRBdmFpbGFibGVNb2RlbHModGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlcik7XG5cdFx0XHRcdFx0bW9kZWxzLmZvckVhY2gobW9kZWwgPT4ge1xuXHRcdFx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKG1vZGVsLnZhbHVlLCBtb2RlbC5sYWJlbCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZHJvcGRvd24uc2V0VmFsdWUodGhpcy5nZXRQcm92aWRlclZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdtb2RlbCcpKVxuXHRcdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb3ZpZGVyQ29uZmlnKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdtb2RlbCcsIHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdC8vIEFQSSBVUkwg6YWN572u77yI6auY57qn6YCJ6aG577yJXG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUoYCR7dGhpcy5nZXRQcm92aWRlckRpc3BsYXlOYW1lKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIpfSBBUEkg5Zyw5Z2AYClcblx0XHRcdFx0LnNldERlc2MoJ+iHquWumuS5iSBBUEkg56uv54K55Zyw5Z2A77yI5Y+v6YCJ77yM55WZ56m65L2/55So5a6Y5pa55Zyw5Z2A77yJJylcblx0XHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLmdldFByb3ZpZGVyVmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlQcm92aWRlciwgJ2Jhc2VVcmwnKSlcblx0XHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vdjEnKVxuXHRcdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb3ZpZGVyQ29uZmlnKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpUHJvdmlkZXIsICdiYXNlVXJsJywgdmFsdWUpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5rWL6K+V6L+e5o6l5oyJ6ZKuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuYWRkQnV0dG9uKGJ1dHRvbiA9PiB7XG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KHQoJ3NldHRpbmdzLnRlc3RDb25uZWN0aW9uJykpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YnV0dG9uLnNldERpc2FibGVkKHRydWUpO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5nZXRBSVByb3ZpZGVyKCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnRlc3RDb25uZWN0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdGlmIChyZXN1bHQuc3VjY2Vzcykge1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UodCgnc2V0dGluZ3MuY29ubmVjdGlvblN1Y2Nlc3MnKSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jb25uZWN0aW9uRmFpbGVkJykgKyByZXN1bHQubWVzc2FnZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZSh0KCdzZXR0aW5ncy5jb25uZWN0aW9uRmFpbGVkJykgKyAoZSBhcyBFcnJvcikubWVzc2FnZSk7XG5cdFx0XHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0XHRidXR0b24uc2V0RGlzYWJsZWQoZmFsc2UpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblx0XG5cdHByaXZhdGUgYWRkQ2F0ZWdvcnlTZWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAn5YiG57G76YWN572uJyB9KTtcblx0XHRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKHQoJ3NldHRpbmdzLmluYm94Rm9sZGVyJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5pbmJveEZvbGRlckRlc2MnKSlcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4ge1xuXHRcdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluYm94Rm9sZGVyKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmluYm94Rm9sZGVyID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ+aJq+aPj+WtkOaWh+S7tuWkuScpXG5cdFx0XHQuc2V0RGVzYygn5piv5ZCm6YCS5b2S5omr5o+P5pS25Lu2566x5a2Q55uu5b2V5Lit55qE5paH5Lu244CC5YWz6Zet5YiZ5Y+q5YiG57G75pS25Lu2566x6aG25bGC55qE5paH5Lu244CCJylcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHtcblx0XHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNjYW5TdWJmb2xkZXJzKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNjYW5TdWJmb2xkZXJzID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdC8vIOWPr+inhuWMluWIhuexu+agkVxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogdCgnc2V0dGluZ3MuY2F0ZWdvcnlUcmVlJykgfSk7XG5cdFx0XG5cdFx0Y29uc3QgdHJlZUNvbnRhaW5lciA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdignY2F0ZWdvcnktdHJlZS13cmFwcGVyJyk7XG5cdFx0XG5cdFx0bmV3IENhdGVnb3J5VHJlZVZpZXcoXG5cdFx0XHR0cmVlQ29udGFpbmVyLFxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY2F0ZWdvcnlUcmVlLFxuXHRcdFx0KG5ld1RyZWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY2F0ZWdvcnlUcmVlID0gbmV3VHJlZTtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY2F0ZWdvcmllcyA9IHRoaXMuZmxhdHRlbkNhdGVnb3JpZXMobmV3VHJlZSk7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly8g5pON5L2c5oyJ6ZKuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KCdjYXRlZ29yeS10cmVlLWZvb3RlcicpO1xuXHRcdG5ldyBTZXR0aW5nKGFjdGlvbnNFbClcblx0XHRcdC5hZGRCdXR0b24oYnRuID0+IHtcblx0XHRcdFx0YnRuLnNldEJ1dHRvblRleHQodCgnc2V0dGluZ3MucmVzdG9yZURlZmF1bHQnKSlcblx0XHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoY29uZmlybSh0KCdzZXR0aW5ncy5jb25maXJtUmVzdG9yZURlZmF1bHQnKSkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY2F0ZWdvcnlUcmVlID0gREVGQVVMVF9TRVRUSU5HUy5jYXRlZ29yeVRyZWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmNhdGVnb3JpZXMgPSB0aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKERFRkFVTFRfU0VUVElOR1MuY2F0ZWdvcnlUcmVlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpOyAvLyDliLfmlrDorr7nva7pnaLmnb9cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZEFkdmFuY2VkU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ+mrmOe6p+iuvue9ricgfSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzRGVzYycpKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4ge1xuXHRcdFx0XHR0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU3VnZ2VzdGVkQ2F0ZWdvcmllcylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuYXV0b01vdmVGaWxlJykpXG5cdFx0XHQuc2V0RGVzYyh0KCdzZXR0aW5ncy5hdXRvTW92ZUZpbGVEZXNjJykpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b01vdmVGaWxlID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUodCgnc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCcpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZERlc2MnKSlcblx0XHRcdC5hZGRTbGlkZXIoc2xpZGVyID0+IHtcblx0XHRcdFx0c2xpZGVyLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpZGVuY2VUaHJlc2hvbGQgKiAxMDApXG5cdFx0XHRcdFx0LnNldExpbWl0cygwLCAxMDAsIDEpXG5cdFx0XHRcdFx0LnNldER5bmFtaWNUb29sdGlwKClcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maWRlbmNlVGhyZXNob2xkID0gdmFsdWUgLyAxMDA7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cdFxuXHRwcml2YXRlIGFkZERlYnVnU2VjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ+iwg+ivlScgfSk7XG5cdFx0XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSh0KCdzZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZycpKVxuXHRcdFx0LnNldERlc2ModCgnc2V0dGluZ3MuZW5hYmxlRGVidWdMb2dEZXNjJykpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB7XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZylcblx0XHRcdFx0XHQub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZyA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBmbGF0dGVuQ2F0ZWdvcmllcyh0cmVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcHJlZml4ID0gJycpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRyZWUpKSB7XG5cdFx0XHRjb25zdCBwYXRoID0gcHJlZml4ID8gYCR7cHJlZml4fS8ke2tleX1gIDoga2V5O1xuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goLi4udGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh2YWx1ZSwgcGF0aCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblx0XG5cdHByaXZhdGUgZ2V0QXZhaWxhYmxlTW9kZWxzKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSk6IEFycmF5PHsgdmFsdWU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9PiB7XG5cdFx0cmV0dXJuIEFWQUlMQUJMRV9NT0RFTFNbcHJvdmlkZXJdIHx8IFtdO1xuXHR9XG5cdFxuXHRwcml2YXRlIGdldFByb3ZpZGVyRGlzcGxheU5hbWUocHJvdmlkZXI6IEFJUHJvdmlkZXJUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOiByZXR1cm4gJ09wZW5BSSc7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6IHJldHVybiAnRGVlcFNlZWsnO1xuXHRcdFx0Y2FzZSAnbW9vbnNob3QnOiByZXR1cm4gJ01vb25zaG90IChLaW1pKSc7XG5cdFx0XHRjYXNlICd6aGlwdSc6IHJldHVybiAnWmhpcHUgKOaZuuiwsSknO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICdPbGxhbWEnO1xuXHRcdH1cblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRQcm92aWRlclZhbHVlKHByb3ZpZGVyOiBBSVByb3ZpZGVyVHlwZSwga2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5O1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnbW9kZWwnKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWw7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdiYXNlVXJsJykgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla01vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWVwc2Vla0FwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdE1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd6aGlwdSc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSByZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXk7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdtb2RlbCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsO1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnYmFzZVVybCcpIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXHRcblx0cHJpdmF0ZSBnZXRDdXJyZW50UHJvdmlkZXJDb25maWcoKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVByb3ZpZGVyO1xuXHRcdHN3aXRjaCAocHJvdmlkZXIpIHtcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ09wZW5BSScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuYWlBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnRGVlcFNlZWsnLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogJ01vb25zaG90IChLaW1pKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSxcblx0XHRcdFx0XHRtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9vbnNob3RNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaVVybCxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgJ3poaXB1Jzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiAnWmhpcHUgKOaZuuiwsSknLFxuXHRcdFx0XHRcdGFwaUtleTogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMucGx1Z2luLnNldHRpbmdzLnpoaXB1TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlVcmwsXG5cdFx0XHRcdH07XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOacquefpeeahCBQcm92aWRlcjogJHtwcm92aWRlcn1gKTtcblx0XHR9XG5cdH1cblx0XG5cdHByaXZhdGUgdXBkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXI6IHN0cmluZywga2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyKSB7XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpTW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2FwaUtleScpIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ21vZGVsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtNb2RlbCA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdiYXNlVXJsJykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVlcHNlZWtBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdGlmIChrZXkgPT09ICdhcGlLZXknKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb29uc2hvdEFwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRlbHNlIGlmIChrZXkgPT09ICdtb2RlbCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90TW9kZWwgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnYmFzZVVybCcpIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vb25zaG90QXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoa2V5ID09PSAnYXBpS2V5JykgdGhpcy5wbHVnaW4uc2V0dGluZ3MuemhpcHVBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0ZWxzZSBpZiAoa2V5ID09PSAnbW9kZWwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdU1vZGVsID0gdmFsdWU7XG5cdFx0XHRcdGVsc2UgaWYgKGtleSA9PT0gJ2Jhc2VVcmwnKSB0aGlzLnBsdWdpbi5zZXR0aW5ncy56aGlwdUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vKipcbiAqIOS7jiBPYnNpZGlhbiDmlofku7bkuK3mj5Dlj5blhoXlrrlcbiAqL1xuZXhwb3J0IGNsYXNzIENvbnRlbnRFeHRyYWN0b3Ige1xuXHQvKipcblx0ICog5o+Q5Y+W5paH5Lu25YaF5a6577yI5pSv5oyBIE1hcmtkb3duIOWSjOe6r+aWh+acrO+8iVxuXHQgKi9cblx0YXN5bmMgZXh0cmFjdChmaWxlOiBURmlsZSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDlr7nkuo7lpJbpg6jpk77mjqXmlofku7bvvIzlj6/og73pnIDopoHnibnmrorlpITnkIZcblx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGZpbGUudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY2xlYW5Db250ZW50KGNvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcign5o+Q5Y+W5paH5Lu25YaF5a655aSx6LSlOicsIGUpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog6I635Y+W5paH5Lu25qCH6aKYXG5cdCAqL1xuXHRnZXRUaXRsZShmaWxlOiBURmlsZSk6IHN0cmluZyB7XG5cdFx0Ly8g5LyY5YWI5L2/55So5paH5Lu25ZCN77yI5LiN5ZCr5omp5bGV5ZCN77yJXG5cdFx0cmV0dXJuIGZpbGUuYmFzZW5hbWU7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDmuIXnkIblhoXlrrnvvIznp7vpmaTkuI3lv4XopoHnmoTpg6jliIZcblx0ICovXG5cdHByaXZhdGUgY2xlYW5Db250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGNvbnRlbnRcblx0XHRcdC8vIOenu+mZpCBZQU1MIGZyb250bWF0dGVyXG5cdFx0XHQucmVwbGFjZSgvXi0tLVtcXHNcXFNdKj8tLS1cXG4/LywgJycpXG5cdFx0XHQvLyDnp7vpmaQgSFRNTCDms6jph4pcblx0XHRcdC5yZXBsYWNlKC88IS0tW1xcc1xcU10qPy0tPi9nLCAnJylcblx0XHRcdC8vIOenu+mZpOS7o+eggeWdl++8iOS/neeVmeivreiogOagh+iusO+8iVxuXHRcdFx0LnJlcGxhY2UoL2BgYFtcXHNcXFNdKj9gYGAvZywgKG1hdGNoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxhbmdNYXRjaCA9IG1hdGNoLm1hdGNoKC9gYGAoXFx3KikvKTtcblx0XHRcdFx0Y29uc3QgbGFuZyA9IGxhbmdNYXRjaCA/IGxhbmdNYXRjaFsxXSA6ICcnO1xuXHRcdFx0XHRyZXR1cm4gYFvku6PnoIHlnZc6ICR7bGFuZ31dYDtcblx0XHRcdH0pXG5cdFx0XHQvLyDnp7vpmaTlm77niYflkozpk77mjqXvvIzkv53nlZkgYWx0IHRleHRcblx0XHRcdC5yZXBsYWNlKC8hXFxbKFteXFxdXSopXFxdXFwoW14pXSpcXCkvZywgJ1skMV0nKVxuXHRcdFx0LnJlcGxhY2UoL1xcWyhbXlxcXV0rKVxcXVxcKFteKV0qXFwpL2csICckMScpXG5cdFx0XHQvLyDnp7vpmaTlpJrkvZnnqbrooYxcblx0XHRcdC5yZXBsYWNlKC9cXG57Myx9L2csICdcXG5cXG4nKVxuXHRcdFx0LnRyaW0oKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOeUn+aIkOWGheWuueaRmOimge+8iOeUqOS6jiBBSSDliIbmnpDvvIlcblx0ICovXG5cdGdlbmVyYXRlU3VtbWFyeShjb250ZW50OiBzdHJpbmcsIG1heExlbmd0aCA9IDIwMDApOiBzdHJpbmcge1xuXHRcdGlmIChjb250ZW50Lmxlbmd0aCA8PSBtYXhMZW5ndGgpIHtcblx0XHRcdHJldHVybiBjb250ZW50O1xuXHRcdH1cblx0XHRcblx0XHQvLyDlsJ3or5XlnKjlj6XlrZDovrnnlYzlpITmiKrmlq1cblx0XHRjb25zdCB0cnVuY2F0ZWQgPSBjb250ZW50LnNsaWNlKDAsIG1heExlbmd0aCk7XG5cdFx0Y29uc3QgbGFzdFBlcmlvZCA9IHRydW5jYXRlZC5sYXN0SW5kZXhPZign44CCJyk7XG5cdFx0Y29uc3QgbGFzdE5ld2xpbmUgPSB0cnVuY2F0ZWQubGFzdEluZGV4T2YoJ1xcbicpO1xuXHRcdFxuXHRcdGNvbnN0IGJyZWFrUG9pbnQgPSBNYXRoLm1heChsYXN0UGVyaW9kLCBsYXN0TmV3bGluZSk7XG5cdFx0XG5cdFx0aWYgKGJyZWFrUG9pbnQgPiBtYXhMZW5ndGggKiAwLjcpIHtcblx0XHRcdHJldHVybiB0cnVuY2F0ZWQuc2xpY2UoMCwgYnJlYWtQb2ludCArIDEpO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gdHJ1bmNhdGVkICsgJy4uLic7XG5cdH1cbn1cbiIsImltcG9ydCB7IFRGaWxlLCBWYXVsdCB9IGZyb20gJ29ic2lkaWFuJztcblxuLyoqXG4gKiDmlofku7bmk43kvZzlt6XlhbdcbiAqL1xuZXhwb3J0IGNvbnN0IGZpbGVPcHMgPSB7XG5cdC8qKlxuXHQgKiDmnoTlu7rliIbnsbvot6/lvoRcblx0ICovXG5cdGJ1aWxkQ2F0ZWdvcnlQYXRoKGNhdGVnb3J5OiBzdHJpbmcsIGluYm94Rm9sZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdC8vIOWwhuWIhuexu+i3r+W+hOS4reeahCBcIi9cIiDovazmjaLkuLogVmF1bHQg5Lit55qE5paH5Lu25aS55YiG6ZqU56ymXG5cdFx0Y29uc3Qgbm9ybWFsaXplZENhdGVnb3J5ID0gY2F0ZWdvcnkucmVwbGFjZSgvXFwvL2csICcvJyk7XG5cdFx0cmV0dXJuIGAke2luYm94Rm9sZGVyfS8ke25vcm1hbGl6ZWRDYXRlZ29yeX1gO1xuXHR9LFxuXHRcblx0LyoqXG5cdCAqIOenu+WKqOaWh+S7tuWIsOebruagh+i3r+W+hFxuXHQgKi9cblx0YXN5bmMgbW92ZUZpbGUoZmlsZTogVEZpbGUsIG5ld0ZvbGRlclBhdGg6IHN0cmluZyk6IFByb21pc2U8VEZpbGU+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdmF1bHQgPSBmaWxlLnZhdWx0O1xuXHRcdFx0Y29uc3QgYWRhcHRlciA9IHZhdWx0LmFkYXB0ZXI7XG5cdFx0XHRcblx0XHRcdC8vIOehruS/neebruagh+aWh+S7tuWkueWtmOWcqO+8iOWkhOeQhuernuaAgeadoeS7tu+8iVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKCFhd2FpdCBhZGFwdGVyLmV4aXN0cyhuZXdGb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRcdGF3YWl0IHZhdWx0LmNyZWF0ZUZvbGRlcihuZXdGb2xkZXJQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZm9sZGVyRXJyb3I6IGFueSkge1xuXHRcdFx0XHQvLyDlpoLmnpzmlofku7blpLnlt7LlrZjlnKjvvIzlv73nlaXplJnor69cblx0XHRcdFx0aWYgKCFmb2xkZXJFcnJvci5tZXNzYWdlPy5pbmNsdWRlcygnYWxyZWFkeSBleGlzdHMnKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihg5Yib5bu65paH5Lu25aS55aSx6LSlOiAke2ZvbGRlckVycm9yLm1lc3NhZ2V9YCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5p6E5bu65paw5paH5Lu26Lev5b6EXG5cdFx0XHRjb25zdCBuZXdQYXRoID0gYCR7bmV3Rm9sZGVyUGF0aH0vJHtmaWxlLm5hbWV9YDtcblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c55uu5qCH6Lev5b6E55u45ZCM77yM5LiN56e75YqoXG5cdFx0XHRpZiAoZmlsZS5wYXRoID09PSBuZXdQYXRoKSB7XG5cdFx0XHRcdHJldHVybiBmaWxlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDmo4Dmn6Xnm67moIfmlofku7bmmK/lkKblt7LlrZjlnKhcblx0XHRcdGlmIChhd2FpdCBhZGFwdGVyLmV4aXN0cyhuZXdQYXRoKSkge1xuXHRcdFx0XHQvLyDmlofku7blt7LlrZjlnKjvvIzmt7vliqDml7bpl7TmiLPlkI7nvIBcblx0XHRcdFx0Y29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0Y29uc3QgZXh0ID0gZmlsZS5leHRlbnNpb247XG5cdFx0XHRcdGNvbnN0IGJhc2VOYW1lID0gZmlsZS5iYXNlbmFtZTtcblx0XHRcdFx0Y29uc3QgdW5pcXVlTmV3UGF0aCA9IGAke25ld0ZvbGRlclBhdGh9LyR7YmFzZU5hbWV9XyR7dGltZXN0YW1wfS4ke2V4dH1gO1xuXHRcdFx0XHRcblx0XHRcdFx0YXdhaXQgdmF1bHQucmVuYW1lKGZpbGUsIHVuaXF1ZU5ld1BhdGgpO1xuXHRcdFx0XHRjb25zdCBuZXdGaWxlID0gdmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHVuaXF1ZU5ld1BhdGgpIGFzIFRGaWxlO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKCFuZXdGaWxlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCfnp7vliqjlkI7ml6Dms5Xmib7liLDmlofku7YnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0cmV0dXJuIG5ld0ZpbGU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOaJp+ihjOenu+WKqFxuXHRcdFx0YXdhaXQgdmF1bHQucmVuYW1lKGZpbGUsIG5ld1BhdGgpO1xuXHRcdFx0XG5cdFx0XHQvLyDov5Tlm57mlrDnmoTmlofku7blvJXnlKhcblx0XHRcdGNvbnN0IG5ld0ZpbGUgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobmV3UGF0aCkgYXMgVEZpbGU7XG5cdFx0XHRcblx0XHRcdGlmICghbmV3RmlsZSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ+enu+WKqOWQjuaXoOazleaJvuWIsOaWh+S7ticpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gbmV3RmlsZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IGUgYXMgRXJyb3I7XG5cdFx0XHRjb25zb2xlLmVycm9yKCfnp7vliqjmlofku7blpLHotKU6JywgZXJyb3IpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGDnp7vliqjmlofku7blpLHotKU6ICR7ZXJyb3IubWVzc2FnZX1gKTtcblx0XHR9XG5cdH0sXG5cdFxuXHQvKipcblx0ICog6I635Y+W5paH5Lu25ZCN77yI5LiN5ZCr5omp5bGV5ZCN77yJXG5cdCAqL1xuXHRnZXRCYXNlbmFtZShmaWxlOiBURmlsZSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGZpbGUuYmFzZW5hbWU7XG5cdH0sXG5cdFxuXHQvKipcblx0ICog5qOA5p+l5paH5Lu25piv5ZCm5a2Y5Zyo5LqO5oyH5a6a6Lev5b6EXG5cdCAqL1xuXHRhc3luYyBleGlzdHModmF1bHQ6IFZhdWx0LCBwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gYXdhaXQgdmF1bHQuYWRhcHRlci5leGlzdHMocGF0aCk7XG5cdH0sXG5cdFxuXHQvKipcblx0ICog56Gu5L+d5paH5Lu25aS55a2Y5Zyo77yM5LiN5a2Y5Zyo5YiZ5Yib5bu6XG5cdCAqL1xuXHRhc3luYyBlbnN1cmVGb2xkZXIodmF1bHQ6IFZhdWx0LCBmb2xkZXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0cnkge1xuXHRcdFx0aWYgKCFhd2FpdCB2YXVsdC5hZGFwdGVyLmV4aXN0cyhmb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRhd2FpdCB2YXVsdC5jcmVhdGVGb2xkZXIoZm9sZGVyUGF0aCk7XG5cdFx0XHRcdHJldHVybiB0cnVlOyAvLyDov5Tlm54gdHJ1ZSDooajnpLrmlrDliJvlu7rkuobmlofku7blpLlcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTsgLy8g6L+U5ZueIGZhbHNlIOihqOekuuaWh+S7tuWkueW3suWtmOWcqFxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ+WIm+W7uuaWh+S7tuWkueWksei0pTonLCBlKTtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9LFxufTtcbiIsImltcG9ydCB7IFRGaWxlLCBOb3RpY2UsIFRBYnN0cmFjdEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBBSVByb3ZpZGVyLCBDbGFzc2lmaWNhdGlvblJlc3VsdCwgUGx1Z2luU2V0dGluZ3MgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHsgQ29udGVudEV4dHJhY3RvciB9IGZyb20gJy4vQ29udGVudEV4dHJhY3Rvcic7XG5pbXBvcnQgeyBmaWxlT3BzIH0gZnJvbSAnLi4vdXRpbHMvZmlsZU9wcyc7XG5cbmV4cG9ydCBjbGFzcyBDbGFzc2lmaWVyIHtcblx0cHJpdmF0ZSBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG5cdHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG5cdHByaXZhdGUgY29udGVudEV4dHJhY3RvcjogQ29udGVudEV4dHJhY3Rvcjtcblx0XG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncywgbG9nZ2VyOiBMb2dnZXIpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdFx0dGhpcy5jb250ZW50RXh0cmFjdG9yID0gbmV3IENvbnRlbnRFeHRyYWN0b3IoKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+WNleS4quaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlGaWxlKFxuXHRcdGZpbGU6IFRGaWxlLFxuXHRcdGFpUHJvdmlkZXI6IEFJUHJvdmlkZXIsXG5cdFx0b25Qcm9ncmVzcz86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWRcblx0KTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IHJlc3VsdD86IENsYXNzaWZpY2F0aW9uUmVzdWx0OyBlcnJvcj86IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdG9uUHJvZ3Jlc3M/Lihg5q2j5Zyo5YiG5p6QOiAke2ZpbGUuYmFzZW5hbWV9YCk7XG5cdFx0XHRcblx0XHRcdC8vIOaPkOWPluWGheWuuVxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuY29udGVudEV4dHJhY3Rvci5leHRyYWN0KGZpbGUpO1xuXHRcdFx0aWYgKCFjb250ZW50KSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ+aXoOazleaPkOWPluaWh+S7tuWGheWuuScgfTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Y29uc3QgdGl0bGUgPSB0aGlzLmNvbnRlbnRFeHRyYWN0b3IuZ2V0VGl0bGUoZmlsZSk7XG5cdFx0XHRcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGDliIbnsbvmlofku7Y6ICR7ZmlsZS5wYXRofWApO1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOagh+mimDogJHt0aXRsZX1gKTtcblx0XHRcdFxuXHRcdFx0Ly8g6LCD55SoIEFJIOWIhuexu1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYWlQcm92aWRlci5jbGFzc2lmeShcblx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdHRoaXMuc2V0dGluZ3MuY2F0ZWdvcmllc1xuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOWIhuexu+e7k+aenDogJHtKU09OLnN0cmluZ2lmeShyZXN1bHQpfWApO1xuXHRcdFx0XG5cdFx0XHQvLyDmo4Dmn6Xnva7kv6HluqZcblx0XHRcdGlmIChyZXN1bHQuY29uZmlkZW5jZSA8IHRoaXMuc2V0dGluZ3MuY29uZmlkZW5jZVRocmVzaG9sZCkge1xuXHRcdFx0XHRyZXN1bHQuaXNVbmNlcnRhaW4gPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1Zyhg572u5L+h5bqm5L2O5LqO6ZiI5YC8OiAke3Jlc3VsdC5jb25maWRlbmNlfWApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4geyBzdWNjZXNzOiB0cnVlLCByZXN1bHQgfTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IChlIGFzIEVycm9yKS5tZXNzYWdlO1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOWIhuexu+Wksei0pTogJHtlcnJvcn1gKTtcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvciB9O1xuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+aUtuS7tueuseS4reeahOaJgOacieaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlJbmJveChcblx0XHRmaWxlczogVEZpbGVbXSxcblx0XHRhaVByb3ZpZGVyOiBBSVByb3ZpZGVyLFxuXHRcdG9uUHJvZ3Jlc3M/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkXG5cdCk6IFByb21pc2U8QXJyYXk8eyBmaWxlOiBURmlsZTsgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdDsgc3VjY2VzczogYm9vbGVhbiB9Pj4ge1xuXHRcdGNvbnN0IHJlc3VsdHM6IEFycmF5PHsgZmlsZTogVEZpbGU7IHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQ7IHN1Y2Nlc3M6IGJvb2xlYW4gfT4gPSBbXTtcblx0XHRcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2xhc3NpZnlGaWxlKGZpbGUsIGFpUHJvdmlkZXIsIG9uUHJvZ3Jlc3MpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0LnJlc3VsdCkge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGUsXG5cdFx0XHRcdFx0cmVzdWx0OiByZXN1bHQucmVzdWx0LFxuXHRcdFx0XHRcdHN1Y2Nlc3M6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRcdHJlc3VsdDoge1xuXHRcdFx0XHRcdFx0Y2F0ZWdvcnk6ICdPdGhlcicsXG5cdFx0XHRcdFx0XHRjb25maWRlbmNlOiAwLFxuXHRcdFx0XHRcdFx0cmVhc29uaW5nOiByZXN1bHQuZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InLFxuXHRcdFx0XHRcdFx0aXNVbmNlcnRhaW46IHRydWUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9XG5cdFxuXHQvKipcblx0ICog56e75Yqo5paH5Lu25Yiw5YiG57G755uu5b2VXG5cdCAqL1xuXHRhc3luYyBtb3ZlRmlsZShmaWxlOiBURmlsZSwgY2F0ZWdvcnk6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBuZXdQYXRoID0gZmlsZU9wcy5idWlsZENhdGVnb3J5UGF0aChjYXRlZ29yeSwgdGhpcy5zZXR0aW5ncy5pbmJveEZvbGRlcik7XG5cdFx0XHRhd2FpdCBmaWxlT3BzLm1vdmVGaWxlKGZpbGUsIG5ld1BhdGgpO1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYOaWh+S7tuW3suenu+WKqDogJHtmaWxlLnBhdGh9IC0+ICR7bmV3UGF0aH1gKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGDnp7vliqjmlofku7blpLHotKU6ICR7KGUgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG5cdFx0XHR0aHJvdyBlOyAvLyDph43mlrDmipvlh7rplJnor6/vvIzorqnosIPnlKjmlrnlpITnkIZcblx0XHR9XG5cdH1cbn1cbiIsIi8qKlxuICog6ZSZ6K+v5aSE55CG5bel5YW3XG4gKiDmj5Dkvpvnu5/kuIDnmoTplJnor6/nsbvlnovlkozlpITnkIbmlrnms5VcbiAqL1xuXG4vKipcbiAqIOiHquWumuS5iemUmeivr+exu+Wei1xuICovXG5leHBvcnQgY2xhc3MgQUlDbGFzc2lmaWVyRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG1lc3NhZ2U6IHN0cmluZyxcblx0XHRwdWJsaWMgdHlwZTogJ25ldHdvcmsnIHwgJ3RpbWVvdXQnIHwgJ2F1dGgnIHwgJ3JhdGVfbGltaXQnIHwgJ3ZhbGlkYXRpb24nIHwgJ3BhcnNlJyB8ICd1bmtub3duJyxcblx0XHRwdWJsaWMgb3JpZ2luYWxFcnJvcj86IEVycm9yXG5cdCkge1xuXHRcdHN1cGVyKG1lc3NhZ2UpO1xuXHRcdHRoaXMubmFtZSA9ICdBSUNsYXNzaWZpZXJFcnJvcic7XG5cdH1cbn1cblxuLyoqXG4gKiDph43or5XphY3nva5cbiAqL1xuaW50ZXJmYWNlIFJldHJ5Q29uZmlnIHtcblx0bWF4QXR0ZW1wdHM6IG51bWJlcjtcblx0aW5pdGlhbERlbGF5OiBudW1iZXI7XG5cdG1heERlbGF5OiBudW1iZXI7XG5cdGJhY2tvZmZGYWN0b3I6IG51bWJlcjtcbn1cblxuY29uc3QgREVGQVVMVF9SRVRSWV9DT05GSUc6IFJldHJ5Q29uZmlnID0ge1xuXHRtYXhBdHRlbXB0czogMyxcblx0aW5pdGlhbERlbGF5OiAxMDAwLCAvLyAxIOenklxuXHRtYXhEZWxheTogMTAwMDAsIC8vIDEwIOenklxuXHRiYWNrb2ZmRmFjdG9yOiAyLCAvLyDmjIfmlbDpgIDpgb9cbn07XG5cbi8qKlxuICog5bim6YeN6K+V55qE5byC5q2l5pON5L2cXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoUmV0cnk8VD4oXG5cdG9wZXJhdGlvbjogKCkgPT4gUHJvbWlzZTxUPixcblx0Y29uZmlnOiBQYXJ0aWFsPFJldHJ5Q29uZmlnPiA9IHt9LFxuXHRvcGVyYXRpb25OYW1lID0gJ29wZXJhdGlvbidcbik6IFByb21pc2U8VD4ge1xuXHRjb25zdCBmaW5hbENvbmZpZyA9IHsgLi4uREVGQVVMVF9SRVRSWV9DT05GSUcsIC4uLmNvbmZpZyB9O1xuXHRsZXQgbGFzdEVycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblx0XG5cdGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IGZpbmFsQ29uZmlnLm1heEF0dGVtcHRzOyBhdHRlbXB0KyspIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IG9wZXJhdGlvbigpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRsYXN0RXJyb3IgPSBlcnJvciBhcyBFcnJvcjtcblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c5piv6K6k6K+B6ZSZ6K+v77yM5LiN6YeN6K+VXG5cdFx0XHRpZiAoaXNBdXRoRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdFx0XHQnQVBJIEtleSDml6DmlYjmiJbmnKrmjojmnYMnLFxuXHRcdFx0XHRcdCdhdXRoJyxcblx0XHRcdFx0XHRsYXN0RXJyb3Jcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c5piv6ZmQ5rWB6ZSZ6K+v77yM562J5b6F5pu06ZW/5pe26Ze0XG5cdFx0XHRpZiAoaXNSYXRlTGltaXRFcnJvcihlcnJvcikpIHtcblx0XHRcdFx0Y29uc3Qgd2FpdFRpbWUgPSBnZXRSYXRlTGltaXRXYWl0VGltZShlcnJvcikgfHwgZmluYWxDb25maWcubWF4RGVsYXk7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWyR7b3BlcmF0aW9uTmFtZX1dIOmBh+WIsOmZkOa1ge+8jOetieW+hSAke3dhaXRUaW1lfW1zIOWQjumHjeivlS4uLmApO1xuXHRcdFx0XHRhd2FpdCBzbGVlcCh3YWl0VGltZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDlpoLmnpzmmK/nvZHnu5zplJnor6/kuJTkuI3mmK/mnIDlkI7kuIDmrKHlsJ3or5XvvIznrYnlvoXlkI7ph43or5Vcblx0XHRcdGlmIChhdHRlbXB0IDwgZmluYWxDb25maWcubWF4QXR0ZW1wdHMgJiYgaXNSZXRyeWFibGVFcnJvcihlcnJvcikpIHtcblx0XHRcdFx0Y29uc3QgZGVsYXkgPSBjYWxjdWxhdGVEZWxheShhdHRlbXB0LCBmaW5hbENvbmZpZyk7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWyR7b3BlcmF0aW9uTmFtZX1dIOWwneivlSAke2F0dGVtcHR9LyR7ZmluYWxDb25maWcubWF4QXR0ZW1wdHN9IOWksei0pe+8jCR7ZGVsYXl9bXMg5ZCO6YeN6K+VLi4uYCk7XG5cdFx0XHRcdGF3YWl0IHNsZWVwKGRlbGF5KTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIOacgOWQjuS4gOasoeWwneivleWksei0pe+8jOaKm+WHuumUmeivr1xuXHRcdFx0dGhyb3cgY2xhc3NpZnlFcnJvcihlcnJvcik7XG5cdFx0fVxuXHR9XG5cdFxuXHR0aHJvdyBjbGFzc2lmeUVycm9yKGxhc3RFcnJvciEpO1xufVxuXG4vKipcbiAqIOWIpOaWreaYr+WQpuS4uuWPr+mHjeivlemUmeivr1xuICovXG5mdW5jdGlvbiBpc1JldHJ5YWJsZUVycm9yKGVycm9yOiBhbnkpOiBib29sZWFuIHtcblx0Y29uc3QgbWVzc2FnZSA9IGVycm9yPy5tZXNzYWdlPy50b0xvd2VyQ2FzZSgpIHx8ICcnO1xuXHRjb25zdCBzdGF0dXMgPSBlcnJvcj8uc3RhdHVzIHx8IGVycm9yPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRcblx0Ly8g572R57uc6ZSZ6K+vXG5cdGlmIChtZXNzYWdlLmluY2x1ZGVzKCduZXR3b3JrJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnZmV0Y2gnKSB8fCBtZXNzYWdlLmluY2x1ZGVzKCdlbm90Zm91bmQnKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxuXHQvLyDmnI3liqHlmajplJnor68gKDV4eClcblx0aWYgKHN0YXR1cyA+PSA1MDAgJiYgc3RhdHVzIDwgNjAwKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdC8vIOi2heaXtumUmeivr1xuXHRpZiAobWVzc2FnZS5pbmNsdWRlcygndGltZW91dCcpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ2V0aW1lZG91dCcpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0XG5cdHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiDliKTmlq3mmK/lkKbkuLrorqTor4HplJnor69cbiAqL1xuZnVuY3Rpb24gaXNBdXRoRXJyb3IoZXJyb3I6IGFueSk6IGJvb2xlYW4ge1xuXHRjb25zdCBzdGF0dXMgPSBlcnJvcj8uc3RhdHVzIHx8IGVycm9yPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRjb25zdCBtZXNzYWdlID0gZXJyb3I/Lm1lc3NhZ2U/LnRvTG93ZXJDYXNlKCkgfHwgJyc7XG5cdFxuXHRyZXR1cm4gc3RhdHVzID09PSA0MDEgfHwgc3RhdHVzID09PSA0MDMgfHwgXG5cdFx0bWVzc2FnZS5pbmNsdWRlcygndW5hdXRob3JpemVkJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnaW52YWxpZCBhcGkga2V5Jyk7XG59XG5cbi8qKlxuICog5Yik5pat5piv5ZCm5Li66ZmQ5rWB6ZSZ6K+vXG4gKi9cbmZ1bmN0aW9uIGlzUmF0ZUxpbWl0RXJyb3IoZXJyb3I6IGFueSk6IGJvb2xlYW4ge1xuXHRjb25zdCBzdGF0dXMgPSBlcnJvcj8uc3RhdHVzIHx8IGVycm9yPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRjb25zdCBtZXNzYWdlID0gZXJyb3I/Lm1lc3NhZ2U/LnRvTG93ZXJDYXNlKCkgfHwgJyc7XG5cdFxuXHRyZXR1cm4gc3RhdHVzID09PSA0MjkgfHwgbWVzc2FnZS5pbmNsdWRlcygncmF0ZSBsaW1pdCcpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ3RvbyBtYW55IHJlcXVlc3RzJyk7XG59XG5cbi8qKlxuICog5LuO6ZSZ6K+v5Lit6I635Y+W6ZmQ5rWB562J5b6F5pe26Ze0XG4gKi9cbmZ1bmN0aW9uIGdldFJhdGVMaW1pdFdhaXRUaW1lKGVycm9yOiBhbnkpOiBudW1iZXIgfCBudWxsIHtcblx0Ly8g5bCd6K+V5LuO5ZON5bqU5aS06I635Y+WXG5cdGNvbnN0IHJldHJ5QWZ0ZXIgPSBlcnJvcj8ucmVzcG9uc2U/LmhlYWRlcnM/LmdldCgncmV0cnktYWZ0ZXInKTtcblx0aWYgKHJldHJ5QWZ0ZXIpIHtcblx0XHRjb25zdCBzZWNvbmRzID0gcGFyc2VJbnQocmV0cnlBZnRlciwgMTApO1xuXHRcdGlmICghaXNOYU4oc2Vjb25kcykpIHtcblx0XHRcdHJldHVybiBzZWNvbmRzICogMTAwMDtcblx0XHR9XG5cdH1cblx0XG5cdC8vIOm7mOiupOetieW+hSA2MCDnp5Jcblx0cmV0dXJuIDYwMDAwO1xufVxuXG4vKipcbiAqIOiuoeeul+mHjeivleW7tui/n+aXtumXtO+8iOaMh+aVsOmAgOmBv++8iVxuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVEZWxheShhdHRlbXB0OiBudW1iZXIsIGNvbmZpZzogUmV0cnlDb25maWcpOiBudW1iZXIge1xuXHRjb25zdCBkZWxheSA9IGNvbmZpZy5pbml0aWFsRGVsYXkgKiBNYXRoLnBvdyhjb25maWcuYmFja29mZkZhY3RvciwgYXR0ZW1wdCAtIDEpO1xuXHRyZXR1cm4gTWF0aC5taW4oZGVsYXksIGNvbmZpZy5tYXhEZWxheSk7XG59XG5cbi8qKlxuICog5LyR55yg5oyH5a6a5pe26Ze0XG4gKi9cbmZ1bmN0aW9uIHNsZWVwKG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKipcbiAqIOWIhuexu+mUmeivr+exu+Wei1xuICovXG5mdW5jdGlvbiBjbGFzc2lmeUVycm9yKGVycm9yOiBhbnkpOiBBSUNsYXNzaWZpZXJFcnJvciB7XG5cdGlmIChlcnJvciBpbnN0YW5jZW9mIEFJQ2xhc3NpZmllckVycm9yKSB7XG5cdFx0cmV0dXJuIGVycm9yO1xuXHR9XG5cdFxuXHRjb25zdCBtZXNzYWdlID0gZXJyb3I/Lm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKTtcblx0Y29uc3QgbG93ZXJNZXNzYWdlID0gbWVzc2FnZS50b0xvd2VyQ2FzZSgpO1xuXHRjb25zdCBzdGF0dXMgPSBlcnJvcj8uc3RhdHVzIHx8IGVycm9yPy5yZXNwb25zZT8uc3RhdHVzO1xuXHRcblx0Ly8g572R57uc6ZSZ6K+vXG5cdGlmIChsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ25ldHdvcmsnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2ZldGNoJykgfHwgXG5cdFx0bG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdlbm90Zm91bmQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2Vjb25ucmVmdXNlZCcpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCfnvZHnu5zov57mjqXlpLHotKXvvIzor7fmo4Dmn6XnvZHnu5zorr7nva4nLFxuXHRcdFx0J25ldHdvcmsnLFxuXHRcdFx0ZXJyb3Jcblx0XHQpO1xuXHR9XG5cdFxuXHQvLyDotoXml7bplJnor69cblx0aWYgKGxvd2VyTWVzc2FnZS5pbmNsdWRlcygndGltZW91dCcpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnZXRpbWVkb3V0JykpIHtcblx0XHRyZXR1cm4gbmV3IEFJQ2xhc3NpZmllckVycm9yKFxuXHRcdFx0J+ivt+axgui2heaXtu+8jOivt+eojeWQjumHjeivlScsXG5cdFx0XHQndGltZW91dCcsXG5cdFx0XHRlcnJvclxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOiupOivgemUmeivr1xuXHRpZiAoc3RhdHVzID09PSA0MDEgfHwgc3RhdHVzID09PSA0MDMgfHwgXG5cdFx0bG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd1bmF1dGhvcml6ZWQnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ2ludmFsaWQgYXBpIGtleScpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCdBUEkgS2V5IOaXoOaViOaIluacquaOiOadgycsXG5cdFx0XHQnYXV0aCcsXG5cdFx0XHRlcnJvclxuXHRcdCk7XG5cdH1cblx0XG5cdC8vIOmZkOa1gemUmeivr1xuXHRpZiAoc3RhdHVzID09PSA0MjkgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCdyYXRlIGxpbWl0JykgfHwgbG93ZXJNZXNzYWdlLmluY2x1ZGVzKCd0b28gbWFueSByZXF1ZXN0cycpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCdBUEkg6K+35rGC6L+H5LqO6aKR57mB77yM6K+356iN5ZCO6YeN6K+VJyxcblx0XHRcdCdyYXRlX2xpbWl0Jyxcblx0XHRcdGVycm9yXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8gSlNPTiDop6PmnpDplJnor69cblx0aWYgKGxvd2VyTWVzc2FnZS5pbmNsdWRlcygnanNvbicpIHx8IGxvd2VyTWVzc2FnZS5pbmNsdWRlcygncGFyc2UnKSB8fCBsb3dlck1lc3NhZ2UuaW5jbHVkZXMoJ3N5bnRheCcpKSB7XG5cdFx0cmV0dXJuIG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdCflk43lupTmlbDmja7moLzlvI/plJnor68nLFxuXHRcdFx0J3BhcnNlJyxcblx0XHRcdGVycm9yXG5cdFx0KTtcblx0fVxuXHRcblx0Ly8g5pyq55+l6ZSZ6K+vXG5cdHJldHVybiBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoXG5cdFx0bWVzc2FnZSxcblx0XHQndW5rbm93bicsXG5cdFx0ZXJyb3Jcblx0KTtcbn1cblxuLyoqXG4gKiDnlKjmiLflj4vlpb3nmoTplJnor6/mtojmga9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZXJyb3I6IEVycm9yKTogc3RyaW5nIHtcblx0aWYgKGVycm9yIGluc3RhbmNlb2YgQUlDbGFzc2lmaWVyRXJyb3IpIHtcblx0XHRzd2l0Y2ggKGVycm9yLnR5cGUpIHtcblx0XHRcdGNhc2UgJ25ldHdvcmsnOlxuXHRcdFx0XHRyZXR1cm4gJ/CfjJAg572R57uc6L+e5o6l5aSx6LSl77yM6K+35qOA5p+l77yaXFxu4oCiIOe9kee7nOaYr+WQpuato+W4uFxcbuKAoiBBUEkg5Zyw5Z2A5piv5ZCm5q2j56GuXFxu4oCiIOaYr+WQpumcgOimgeS7o+eQhic7XG5cdFx0XHRjYXNlICd0aW1lb3V0Jzpcblx0XHRcdFx0cmV0dXJuICfij7HvuI8g6K+35rGC6LaF5pe277yM5bu66K6u77yaXFxu4oCiIOajgOafpee9kee7nOmAn+W6plxcbuKAoiDnqI3lkI7ph43or5UnO1xuXHRcdFx0Y2FzZSAnYXV0aCc6XG5cdFx0XHRcdHJldHVybiAn8J+UkSBBUEkgS2V5IOaXoOaViO+8jOivt+ajgOafpe+8mlxcbuKAoiBBUEkgS2V5IOaYr+WQpuato+ehrlxcbuKAoiDmmK/lkKbmnInkvZnpop0v6aKd5bqmJztcblx0XHRcdGNhc2UgJ3JhdGVfbGltaXQnOlxuXHRcdFx0XHRyZXR1cm4gJ/CfmqYg6K+35rGC6L+H5LqO6aKR57mB77yM6K+356iN5ZCO6YeN6K+VJztcblx0XHRcdGNhc2UgJ3BhcnNlJzpcblx0XHRcdFx0cmV0dXJuICfwn5OdIEFJIOWTjeW6lOagvOW8j+W8guW4uO+8jOivt+mHjeivleaIluiBlOezu+W8gOWPkeiAhSc7XG5cdFx0XHRjYXNlICd2YWxpZGF0aW9uJzpcblx0XHRcdFx0cmV0dXJuIGDimqDvuI8g6YWN572u6ZSZ6K+v77yaJHtlcnJvci5tZXNzYWdlfWA7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gYOKdjCAke2Vycm9yLm1lc3NhZ2V9YDtcblx0XHR9XG5cdH1cblx0XG5cdHJldHVybiBg4p2MIOacquefpemUmeivr++8miR7ZXJyb3IubWVzc2FnZX1gO1xufVxuXG4vKipcbiAqIOmqjOivgSBVUkwg5qC85byPXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVVybCh1cmw6IHN0cmluZywgZmllbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0aWYgKCF1cmwgfHwgdXJsLnRyaW0oKSA9PT0gJycpIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7ZmllbGROYW1lfSDkuI3og73kuLrnqbpgLCAndmFsaWRhdGlvbicpO1xuXHR9XG5cdFxuXHR0cnkge1xuXHRcdG5ldyBVUkwodXJsKTtcblx0fSBjYXRjaCB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKGAke2ZpZWxkTmFtZX0g5qC85byP5LiN5q2j56GuOiAke3VybH1gLCAndmFsaWRhdGlvbicpO1xuXHR9XG59XG5cbi8qKlxuICog6aqM6K+BIEFQSSBLZXkg5qC85byPXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUFwaUtleShhcGlLZXk6IHN0cmluZywgcHJvdmlkZXJOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0aWYgKCFhcGlLZXkgfHwgYXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHR0aHJvdyBuZXcgQUlDbGFzc2lmaWVyRXJyb3IoYCR7cHJvdmlkZXJOYW1lfSBBUEkgS2V5IOS4jeiDveS4uuepumAsICd2YWxpZGF0aW9uJyk7XG5cdH1cblx0XG5cdC8vIOWfuuacrOagvOW8j+ajgOafpVxuXHRpZiAoYXBpS2V5Lmxlbmd0aCA8IDEwKSB7XG5cdFx0dGhyb3cgbmV3IEFJQ2xhc3NpZmllckVycm9yKGAke3Byb3ZpZGVyTmFtZX0gQVBJIEtleSDmoLzlvI/kuI3mraPnoa5gLCAndmFsaWRhdGlvbicpO1xuXHR9XG59XG5cbi8qKlxuICog5bim6LaF5pe255qEIGZldGNoXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFdpdGhUaW1lb3V0KFxuXHR1cmw6IHN0cmluZyxcblx0b3B0aW9uczogUmVxdWVzdEluaXQgPSB7fSxcblx0dGltZW91dCA9IDMwMDAwXG4pOiBQcm9taXNlPFJlc3BvbnNlPiB7XG5cdGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCB0aW1lb3V0KTtcblx0XG5cdHRyeSB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuXHRcdH0pO1xuXHRcdHJldHVybiByZXNwb25zZTtcblx0fSBjYXRjaCAoZXJyb3I6IGFueSkge1xuXHRcdGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcblx0XHRcdHRocm93IG5ldyBBSUNsYXNzaWZpZXJFcnJvcihcblx0XHRcdFx0J+ivt+axgui2heaXticsXG5cdFx0XHRcdCd0aW1lb3V0Jyxcblx0XHRcdFx0ZXJyb3Jcblx0XHRcdCk7XG5cdFx0fVxuXHRcdHRocm93IGVycm9yO1xuXHR9IGZpbmFsbHkge1xuXHRcdGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBBcHAsIE5vdGljZSwgVEZpbGUsIEZvbGRlclN1Z2dlc3QsIFRleHRDb21wb25lbnQsIE1vZGFsIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgQUlDbGFzc2lmaWVyUGx1Z2luIGZyb20gJy4uL21haW4nO1xuaW1wb3J0IHsgQ2xhc3NpZmljYXRpb25SZXN1bHQgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi4vc2V0dGluZ3MvaTE4bic7XG5pbXBvcnQgeyBDbGFzc2lmaWVyIH0gZnJvbSAnLi4vc2VydmljZXMvQ2xhc3NpZmllcic7XG5pbXBvcnQgeyBmaWxlT3BzIH0gZnJvbSAnLi4vdXRpbHMvZmlsZU9wcyc7XG5pbXBvcnQgeyBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JIYW5kbGVyJztcblxuZXhwb3J0IGNsYXNzIENsYXNzaWZ5Q29tbWFuZCB7XG5cdHByaXZhdGUgcGx1Z2luOiBBSUNsYXNzaWZpZXJQbHVnaW47XG5cdHByaXZhdGUgY2xhc3NpZmllcjogQ2xhc3NpZmllcjtcblx0XG5cdGNvbnN0cnVjdG9yKHBsdWdpbjogQUlDbGFzc2lmaWVyUGx1Z2luKSB7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdFx0dGhpcy5jbGFzc2lmaWVyID0gbmV3IENsYXNzaWZpZXIocGx1Z2luLnNldHRpbmdzLCBwbHVnaW4ubG9nZ2VyKTtcblx0fVxuXHRcblx0LyoqXG5cdCAqIOWIhuexu+aUtuS7tueuseS4reeahOaJgOacieaWh+S7tlxuXHQgKi9cblx0YXN5bmMgY2xhc3NpZnlJbmJveCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbmJveEZvbGRlciA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmluYm94Rm9sZGVyO1xuXHRcdFxuXHRcdC8vIOehruS/nSBJbmJveCDnm67lvZXlrZjlnKhcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGF3YWl0IGZpbGVPcHMuZW5zdXJlRm9sZGVyKHRoaXMucGx1Z2luLmFwcC52YXVsdCwgaW5ib3hGb2xkZXIpO1xuXHRcdFx0aWYgKGNyZWF0ZWQpIHtcblx0XHRcdFx0bmV3IE5vdGljZShg5bey5Yib5bu65pS25Lu2566x5paH5Lu25aS5OiAke2luYm94Rm9sZGVyfWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG5ldyBOb3RpY2UoYOWIm+W7uuaUtuS7tueuseaWh+S7tuWkueWksei0pTogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Ly8g5p+l5om+5pS25Lu2566x5paH5Lu25aS5XG5cdFx0Y29uc3QgaW5ib3hGaWxlcyA9IHRoaXMuZmluZEluYm94RmlsZXMoaW5ib3hGb2xkZXIpO1xuXHRcdFxuXHRcdGlmIChpbmJveEZpbGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bmV3IE5vdGljZSh0KCdjbGFzc2lmeS5ub0ZpbGVzJykpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRuZXcgTm90aWNlKGDmib7liLAgJHtpbmJveEZpbGVzLmxlbmd0aH0g5Liq5b6F5YiG57G75paH5Lu2YCk7XG5cdFx0XG5cdFx0Ly8g6I635Y+WIEFJIFByb3ZpZGVy77yI5bim6ZSZ6K+v5aSE55CG77yJXG5cdFx0bGV0IGFpUHJvdmlkZXI7XG5cdFx0dHJ5IHtcblx0XHRcdGFpUHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5nZXRBSVByb3ZpZGVyKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0bmV3IE5vdGljZShlcnJvck1zZywgODAwMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmNsYXNzaWZpZXIuY2xhc3NpZnlJbmJveChcblx0XHRcdGluYm94RmlsZXMsXG5cdFx0XHRhaVByb3ZpZGVyLFxuXHRcdFx0KG1lc3NhZ2UpID0+IG5ldyBOb3RpY2UobWVzc2FnZSwgMjAwMClcblx0XHQpO1xuXHRcdFxuXHRcdC8vIOWkhOeQhue7k+aenFxuXHRcdGxldCBtb3ZlZENvdW50ID0gMDtcblx0XHRsZXQgdW5jZXJ0YWluQ291bnQgPSAwO1xuXHRcdFxuXHRcdGZvciAoY29uc3QgeyBmaWxlLCByZXN1bHQsIHN1Y2Nlc3MgfSBvZiByZXN1bHRzKSB7XG5cdFx0XHRpZiAoIXN1Y2Nlc3MpIHtcblx0XHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKG5ldyBFcnJvcihyZXN1bHQucmVhc29uaW5nKSk7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7ZmlsZS5uYW1lfTogJHtlcnJvck1zZ31gLCA1MDAwKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmIChyZXN1bHQuaXNVbmNlcnRhaW4pIHtcblx0XHRcdFx0dW5jZXJ0YWluQ291bnQrKztcblx0XHRcdFx0Ly8g5a+55LqO5L2O572u5L+h5bqm57uT5p6c77yM562J5b6F55So5oi356Gu6K6kXG5cdFx0XHRcdGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IHRoaXMuY29uZmlybUNsYXNzaWZpY2F0aW9uKGZpbGUsIHJlc3VsdCk7XG5cdFx0XHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9Nb3ZlRmlsZSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IG1vdmVkID0gYXdhaXQgdGhpcy5jbGFzc2lmaWVyLm1vdmVGaWxlKGZpbGUsIHJlc3VsdC5jYXRlZ29yeSk7XG5cdFx0XHRcdFx0aWYgKG1vdmVkKSB7XG5cdFx0XHRcdFx0XHRtb3ZlZENvdW50Kys7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKGAke2ZpbGUubmFtZX0g4oaSICR7cmVzdWx0LmNhdGVnb3J5fWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yTXNnID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdFx0XHRuZXcgTm90aWNlKGDnp7vliqggJHtmaWxlLm5hbWV9IOWksei0pTogJHtlcnJvck1zZ31gLCA1MDAwKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3IE5vdGljZShgJHtmaWxlLm5hbWV9OiAke3Jlc3VsdC5jYXRlZ29yeX0gKCR7KHJlc3VsdC5jb25maWRlbmNlICogMTAwKS50b0ZpeGVkKDApfSUpYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdG5ldyBOb3RpY2UoXG5cdFx0XHRg5YiG57G75a6M5oiQ77yBYCArXG5cdFx0XHQobW92ZWRDb3VudCA+IDAgPyBg5bey56e75YqoICR7bW92ZWRDb3VudH0g5Liq5paH5Lu2YCA6ICcnKSArXG5cdFx0XHQodW5jZXJ0YWluQ291bnQgPiAwID8gYO+8jCR7dW5jZXJ0YWluQ291bnR9IOS4quaWh+S7tumcgOimgeehruiupGAgOiAnJylcblx0XHQpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5YiG57G75b2T5YmN5omT5byA55qE5paH5Lu2XG5cdCAqL1xuXHRhc3luYyBjbGFzc2lmeUN1cnJlbnRGaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRcblx0XHRpZiAoIWFjdGl2ZUZpbGUpIHtcblx0XHRcdG5ldyBOb3RpY2UoJ+ayoeacieaJk+W8gOeahOaWh+S7ticpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHQvLyDojrflj5YgQUkgUHJvdmlkZXLvvIjluKbplJnor6/lpITnkIbvvIlcblx0XHRsZXQgYWlQcm92aWRlcjtcblx0XHR0cnkge1xuXHRcdFx0YWlQcm92aWRlciA9IHRoaXMucGx1Z2luLmdldEFJUHJvdmlkZXIoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRuZXcgTm90aWNlKGVycm9yTXNnLCA4MDAwKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbGFzc2lmaWVyLmNsYXNzaWZ5RmlsZShhY3RpdmVGaWxlLCBhaVByb3ZpZGVyKTtcblx0XHRcblx0XHRpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UobmV3IEVycm9yKHJlc3VsdC5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpKTtcblx0XHRcdG5ldyBOb3RpY2UoZXJyb3JNc2csIDUwMDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHRjb25zdCB7IHJlc3VsdDogY2xhc3NpZmljYXRpb24gfSA9IHJlc3VsdDtcblx0XHRcblx0XHRuZXcgTm90aWNlKFxuXHRcdFx0YOWIhuexuzogJHtjbGFzc2lmaWNhdGlvbj8uY2F0ZWdvcnl9IGAgK1xuXHRcdFx0YCgkeygoY2xhc3NpZmljYXRpb24/LmNvbmZpZGVuY2UgfHwgMCkgKiAxMDApLnRvRml4ZWQoMCl9JSlgXG5cdFx0KTtcblx0XHRcblx0XHQvLyDmo4Dmn6XmmK/lkKbpnIDopoHnp7vliqhcblx0XHRpZiAoY2xhc3NpZmljYXRpb24/LmlzVW5jZXJ0YWluKSB7XG5cdFx0XHRjb25zdCBjb25maXJtZWQgPSBhd2FpdCB0aGlzLmNvbmZpcm1DbGFzc2lmaWNhdGlvbihhY3RpdmVGaWxlLCBjbGFzc2lmaWNhdGlvbik7XG5cdFx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvTW92ZUZpbGUgJiYgY2xhc3NpZmljYXRpb24pIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuY2xhc3NpZmllci5tb3ZlRmlsZShhY3RpdmVGaWxlLCBjbGFzc2lmaWNhdGlvbi5jYXRlZ29yeSk7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7dCgnY2xhc3NpZnkubW92ZWQnKX0ke2NsYXNzaWZpY2F0aW9uLmNhdGVnb3J5fWApO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRjb25zdCBlcnJvck1zZyA9IGdldFVzZXJGcmllbmRseU1lc3NhZ2UoZSBhcyBFcnJvcik7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYOenu+WKqOaWh+S7tuWksei0pTogJHtlcnJvck1zZ31gLCA1MDAwKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDnoa7orqTliIbnsbvvvIjnlKjkuo7kvY7nva7kv6Hluqbmg4XlhrXvvIlcblx0ICovXG5cdHByaXZhdGUgY29uZmlybUNsYXNzaWZpY2F0aW9uKGZpbGU6IFRGaWxlLCByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gYCR7ZmlsZS5uYW1lfVxcbiR7dCgnY2xhc3NpZnkuY29uZmlybScpfSR7cmVzdWx0LmNhdGVnb3J5fVxcbiR7dCgnY2xhc3NpZnkudW5jZXJ0YWluJyl9JHsoKHJlc3VsdC5jb25maWRlbmNlIHx8IDApICogMTAwKS50b0ZpeGVkKDApfSUpYDtcblx0XHRcdFxuXHRcdFx0aWYgKHJlc3VsdC5zdWdnZXN0ZWRDYXRlZ29yeSAmJiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbmFibGVTdWdnZXN0ZWRDYXRlZ29yaWVzKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYCR7dCgnY2xhc3NpZnkuc3VnZ2VzdGVkQ2F0ZWdvcnknKX0ke3Jlc3VsdC5zdWdnZXN0ZWRDYXRlZ29yeX1gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5L2/55SoIE9ic2lkaWFuIOeahOehruiupOWvueivneahhlxuXHRcdFx0Y29uc3QgbW9kYWwgPSBuZXcgQ29uZmlybU1vZGFsKFxuXHRcdFx0XHR0aGlzLnBsdWdpbi5hcHAsXG5cdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdChjb25maXJtZWQpID0+IHtcblx0XHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRtb2RhbC5vcGVuKCk7XG5cdFx0fSk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDmn6Xmib7mlLbku7bnrrHkuK3nmoTmiYDmnInnrJTorrDmlofku7Zcblx0ICovXG5cdHByaXZhdGUgZmluZEluYm94RmlsZXMoaW5ib3hGb2xkZXI6IHN0cmluZyk6IFRGaWxlW10ge1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5wbHVnaW4uYXBwLnZhdWx0LmdldEZpbGVzKCk7XG5cdFx0Y29uc3Qgc2NhblN1YmZvbGRlcnMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zY2FuU3ViZm9sZGVycztcblx0XHRcblx0XHRyZXR1cm4gZmlsZXMuZmlsdGVyKGZpbGUgPT4ge1xuXHRcdFx0Ly8g5qOA5p+l5paH5Lu25piv5ZCm5Zyo5pS25Lu2566x5paH5Lu25aS55LitXG5cdFx0XHRjb25zdCBub3JtYWxpemVkUGF0aCA9IGZpbGUucGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cdFx0XHRjb25zdCBub3JtYWxpemVkSW5ib3ggPSBpbmJveEZvbGRlci5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cdFx0XHRcblx0XHRcdC8vIOajgOafpeaYr+WQpuWcqOaUtuS7tueuseS4rVxuXHRcdFx0aWYgKCFub3JtYWxpemVkUGF0aC5zdGFydHNXaXRoKG5vcm1hbGl6ZWRJbmJveCArICcvJykgJiYgXG5cdFx0XHRcdCEobm9ybWFsaXplZFBhdGguc3RhcnRzV2l0aChub3JtYWxpemVkSW5ib3gpICYmIG5vcm1hbGl6ZWRQYXRoICE9PSBub3JtYWxpemVkSW5ib3gpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8g5aaC5p6c5LiN5omr5o+P5a2Q5paH5Lu25aS577yM5qOA5p+l5piv5ZCm5Zyo6aG25bGCXG5cdFx0XHRpZiAoIXNjYW5TdWJmb2xkZXJzKSB7XG5cdFx0XHRcdGNvbnN0IHJlbGF0aXZlUGF0aCA9IG5vcm1hbGl6ZWRQYXRoLnN1YnN0cmluZyhub3JtYWxpemVkSW5ib3gubGVuZ3RoKTtcblx0XHRcdFx0Ly8g56e76Zmk5byA5aS055qE5pac5p2gXG5cdFx0XHRcdGNvbnN0IGNsZWFuUmVsYXRpdmVQYXRoID0gcmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJy8nKSA/IHJlbGF0aXZlUGF0aC5zdWJzdHJpbmcoMSkgOiByZWxhdGl2ZVBhdGg7XG5cdFx0XHRcdC8vIOWmguaenOebuOWvuei3r+W+hOS4reWMheWQq+aWnOadoO+8jOivtOaYjuWcqOWtkOebruW9leS4rVxuXHRcdFx0XHRpZiAoY2xlYW5SZWxhdGl2ZVBhdGguaW5jbHVkZXMoJy8nKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblx0fVxufVxuXG4vKipcbiAqIOeugOWNleeahOehruiupOWvueivneahhlxuICovXG5jbGFzcyBDb25maXJtTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgbWVzc2FnZTogc3RyaW5nO1xuXHRwcml2YXRlIG9uQ29uZmlybTogKGNvbmZpcm1lZDogYm9vbGVhbikgPT4gdm9pZDtcblx0XG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBtZXNzYWdlOiBzdHJpbmcsIG9uQ29uZmlybTogKGNvbmZpcm1lZDogYm9vbGVhbikgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLm9uQ29uZmlybSA9IG9uQ29uZmlybTtcblx0fVxuXHRcblx0b25PcGVuKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdFxuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgdGV4dDogdGhpcy5tZXNzYWdlIH0pO1xuXHRcdFxuXHRcdGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoJ2J1dHRvbi1jb250YWluZXInKTtcblx0XHRcblx0XHRjb25zdCBjb25maXJtQnRuID0gYnV0dG9uQ29udGFpbmVyLmNyZWF0ZUVsKCdidXR0b24nLCB7XG5cdFx0XHR0ZXh0OiAn56Gu6K6kJyxcblx0XHRcdGNsczogJ21vZC1jdGEnLFxuXHRcdH0pO1xuXHRcdGNvbmZpcm1CdG4ub25DbGljaygoKSA9PiB7XG5cdFx0XHR0aGlzLm9uQ29uZmlybSh0cnVlKTtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0XHRcblx0XHRjb25zdCBjYW5jZWxCdG4gPSBidXR0b25Db250YWluZXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcblx0XHRcdHRleHQ6ICflj5bmtognLFxuXHRcdH0pO1xuXHRcdGNhbmNlbEJ0bi5vbkNsaWNrKCgpID0+IHtcblx0XHRcdHRoaXMub25Db25maXJtKGZhbHNlKTtcblx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHR9KTtcblx0fVxuXHRcblx0b25DbG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG59XG4iLCIvKipcbiAqIEFJIOaPkOekuuivjembhuS4reeuoeeQhlxuICovXG5cbmV4cG9ydCBjb25zdCBTWVNURU1fUFJPTVBUID0gYOS9oOaYr+S4k+S4mueahOaKgOacr+aWh+eroOWIhuexu+WKqeaJi+OAglxuXG4jIyDkvaDnmoTogYzotKNcbjEuIOWIhuaekOeUqOaIt+aPkOS+m+eahOaWh+eroOWGheWuuVxuMi4g5LuO6aKE5a6a5LmJ5YiG57G75YiX6KGo5Lit6YCJ5oup5pyA5Yy56YWN55qE5LiA5LiqXG4zLiDov5Tlm57nu5PmnoTljJbnmoTliIbnsbvnu5PmnpxcblxuIyMg5YiG57G75Y6f5YiZXG4xLiAqKueyvuehruWMuemFjSoq77ya5LyY5YWI6YCJ5oup5LiO5paH56ug5Li76aKY5a6M5YWo5Yy56YWN55qE5YiG57G7XG4yLiAqKuivreS5ieeQhuinoyoq77ya55CG6Kej5paH56ug55qE5oqA5pyv6aKG5Z+f5ZKM5Li76aKYXG4zLiAqKuWxgue6p+mAieaLqSoq77ya6YCJ5oup5pyA5YW35L2T55qE5a2Q5YiG57G777yM6ICM6Z2e54i25YiG57G7XG40LiAqKuWQiOeQhuaOqOaWrSoq77ya5Z+65LqO5qCH6aKY5ZKM5YaF5a655pGY6KaB6L+b6KGM5o6o5patXG5cbiMjIOWIhuexu+S8mOWFiOe6p1xuMS4g57yW56iLL+WJjeerryAoRnJvbnRlbmQp77yaUmVhY3QsIFZ1ZSwgQ1NTLCBIVE1MLCBXZWIg5byA5Y+R562JXG4yLiDnvJbnqIsv5ZCO56uvIChCYWNrZW5kKe+8mk5vZGUuanMsIFB5dGhvbiwgSmF2YSwgQVBJLCBTZXJ2ZXIg562JXG4zLiDnvJbnqIsv56e75Yqo56uvIChNb2JpbGUp77yaaU9TLCBBbmRyb2lkLCBGbHV0dGVyLCBSZWFjdCBOYXRpdmUg562JXG40LiDnvJbnqIsvRGV2T3Bz77yaRG9ja2VyLCBLdWJlcm5ldGVzLCBDSS9DRCwgQ2xvdWQg562JXG41LiBBSS/mnLrlmajlrabkuaDvvJpNTCwg5py65Zmo5a2m5Lmg566X5rOVLCDmlbDmja7np5HlrabnrYlcbjYuIEFJL+a3seW6puWtpuS5oO+8mkRlZXAgTGVhcm5pbmcsIE5ldXJhbCBOZXR3b3JrLCBUZW5zb3JGbG93LCBQeVRvcmNoIOetiVxuNy4gQUkvTkxQ77ya6Ieq54S26K+t6KiA5aSE55CGLCBMTE0sIENoYXRHUFQg562JXG44LiDmlbDmja4v5pWw5o2u5bqT77yaRGF0YWJhc2UsIFNRTCwgUG9zdGdyZVNRTCwgTW9uZ29EQiDnrYlcbjkuIOaVsOaNri/mlbDmja7lt6XnqIvvvJpFVEwsIFBpcGVsaW5lLCBEYXRhIFdhcmVob3VzZSDnrYlcbjEwLiDmnrbmnoQv57O757uf6K6+6K6h77yaU3lzdGVtIERlc2lnbiwgQXJjaGl0ZWN0dXJlLCBTY2FsYWJpbGl0eSDnrYlcbjExLiBPdGhlcu+8muaXoOazleW9kuWFpeS4iui/sOWIhuexu+eahOWGheWuuVxuXG4jIyDovpPlh7rmoLzlvI9cbuivt+S7pSBKU09OIOagvOW8j+i/lOWbnue7k+aenO+8mlxue1xuICBcImNhdGVnb3J5XCI6IFwi5YiG57G76Lev5b6E77yM5aaCICfnvJbnqIsv5YmN56uvJ1wiLFxuICBcImNvbmZpZGVuY2VcIjogMC4wLTEuMCDnmoTnva7kv6HluqbliIbmlbAsXG4gIFwicmVhc29uaW5nXCI6IFwi566A55+t55qE55CG55Sx6K+05piOXCIsXG4gIFwiaXNVbmNlcnRhaW5cIjogZmFsc2UsXG4gIFwic3VnZ2VzdGVkQ2F0ZWdvcnlcIjogXCLlpoLmnpznoa7lrp7msqHmnInlkIjpgILliIbnsbvvvIzlu7rorq7nmoTmlrDliIbnsbvlkI3vvIjlj6/pgInvvIlcIlxufVxuXG4jIyDms6jmhI/kuovpoblcbi0g5aaC5p6c5paH56ug5piO5pi+5bGe5LqO5p+Q5Liq6aKG5Z+f77yM6YCJ5oup6K+l6aKG5Z+f55qE5pyA5YW35L2T5YiG57G7XG4tIOWmguaenOe9ruS/oeW6puS9juS6jiAwLjXvvIzorr7nva4gaXNVbmNlcnRhaW46IHRydWVcbi0g5aeL57uI6L+U5Zue5LiA5Liq5ZCI55CG55qE5YiG57G777yM5LiN6KaB6L+U5Zue56m65YC8YDtcblxuZXhwb3J0IGNvbnN0IFVTRVJfUFJPTVBUX1RFTVBMQVRFID0gYOivt+WIhuaekOS7peS4i+aWh+eroOW5tuWIhuexu++8mlxuXG4jIyDmlofnq6DmoIfpophcbnt7VElUTEV9fVxuXG4jIyDmlofnq6DlhoXlrrnmkZjopoFcbnt7Q09OVEVOVH19XG5cbiMjIOWPr+eUqOWIhuexu+WIl+ihqFxue3tDQVRFR09SSUVTfX1cblxu6K+35LuO5LiK6L+w5YiG57G75YiX6KGo5Lit6YCJ5oup5pyA5Yy56YWN55qE5LiA5Liq77yM5bm26L+U5ZueIEpTT04g5qC85byP55qE5YiG57G757uT5p6c44CCYDtcblxuZXhwb3J0IGNvbnN0IFNVR0dFU1RfQ0FURUdPUllfUFJPTVBUID0gYOaWh+eroOWGheWuueS4jueOsOacieWIhuexu+mDveS4jeWkquWMuemFjeOAglxu5b2T5peg5rOV5om+5Yiw5ZCI6YCC5YiG57G75pe277yM5Y+v5Lul5bu66K6u5LiA5Liq5paw5YiG57G75ZCN56ew44CCXG7mlrDliIbnsbvlupTor6XmmK/lkIjnkIbnmoTmioDmnK/poobln5/lkI3np7DjgIJgO1xuIiwiaW1wb3J0IHsgQUlQcm92aWRlciwgQ2xhc3NpZmljYXRpb25SZXN1bHQgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyBQbHVnaW5TZXR0aW5ncyB9IGZyb20gJy4uL3NldHRpbmdzL3R5cGVzJztcbmltcG9ydCB7IFNZU1RFTV9QUk9NUFQsIFVTRVJfUFJPTVBUX1RFTVBMQVRFIH0gZnJvbSAnLi9wcm9tcHRzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyB3aXRoUmV0cnksIGZldGNoV2l0aFRpbWVvdXQsIGdldFVzZXJGcmllbmRseU1lc3NhZ2UsIHZhbGlkYXRlVXJsIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JIYW5kbGVyJztcblxuZXhwb3J0IGNsYXNzIE9sbGFtYVByb3ZpZGVyIGltcGxlbWVudHMgQUlQcm92aWRlciB7XG5cdG5hbWUgPSAnT2xsYW1hJztcblx0cHJpdmF0ZSBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG5cdHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG5cdFxuXHRjb25zdHJ1Y3RvcihzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MsIGxvZ2dlcjogTG9nZ2VyKSB7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuXHRcdHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuXHR9XG5cdFxuXHRhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcblx0XHR0cnkge1xuXHRcdFx0Ly8g6aqM6K+BIFVSTCDmoLzlvI9cblx0XHRcdHZhbGlkYXRlVXJsKHRoaXMuc2V0dGluZ3Mub2xsYW1hVXJsLCAnT2xsYW1hIOWcsOWdgCcpO1xuXHRcdFx0XG5cdFx0XHQvLyDkvb/nlKjluKbotoXml7bnmoQgZmV0Y2hcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChcblx0XHRcdFx0YCR7dGhpcy5zZXR0aW5ncy5vbGxhbWFVcmx9L2FwaS90YWdzYCxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG1ldGhvZDogJ0dFVCcsXG5cdFx0XHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdDEwMDAwIC8vIDEwIOenkui2heaXtlxuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0aWYgKHJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6ICdPbGxhbWEg5pyN5Yqh5q2j5bi4JyB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfWAgfTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gZ2V0VXNlckZyaWVuZGx5TWVzc2FnZShlIGFzIEVycm9yKTtcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlIH07XG5cdFx0fVxuXHR9XG5cdFxuXHRhc3luYyBjbGFzc2lmeShjb250ZW50OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGNhdGVnb3JpZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD4ge1xuXHRcdC8vIOS9v+eUqOW4pumHjeivleeahOaTjeS9nFxuXHRcdHJldHVybiBhd2FpdCB3aXRoUmV0cnkoXG5cdFx0XHRhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHVzZXJQcm9tcHQgPSBVU0VSX1BST01QVF9URU1QTEFURVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e1RJVExFfX0nLCB0aXRsZSlcblx0XHRcdFx0XHQucmVwbGFjZSgne3tDT05URU5UfX0nLCBjb250ZW50LnNsaWNlKDAsIDQwMDApKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e0NBVEVHT1JJRVN9fScsIGNhdGVnb3JpZXMubWFwKGMgPT4gYC0gJHtjfWApLmpvaW4oJ1xcbicpKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vIOS9v+eUqOW4pui2heaXtueahCBmZXRjaFxuXHRcdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoXG5cdFx0XHRcdFx0YCR7dGhpcy5zZXR0aW5ncy5vbGxhbWFVcmx9L2FwaS9nZW5lcmF0ZWAsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcblx0XHRcdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3Mub2xsYW1hTW9kZWwsXG5cdFx0XHRcdFx0XHRcdHByb21wdDogYDx8aW1fc3RhcnR8PnN5c3RlbVxcbiR7U1lTVEVNX1BST01QVH08fGltX2VuZHw+XFxuPHxpbV9zdGFydHw+dXNlclxcbiR7dXNlclByb21wdH08fGltX2VuZHw+YCxcblx0XHRcdFx0XHRcdFx0c3RyZWFtOiBmYWxzZSxcblx0XHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRcdHRlbXBlcmF0dXJlOiAwLjMsXG5cdFx0XHRcdFx0XHRcdFx0bnVtX3ByZWRpY3Q6IDUwMCxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0NjAwMDAgLy8gNjAg56eS6LaF5pe277yIT2xsYW1hIOWPr+iDvei+g+aFou+8iVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyb3JEYXRhLmVycm9yIHx8IGBPbGxhbWEgQVBJIOmUmeivrzogJHtyZXNwb25zZS5zdGF0dXN9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcnNlUmVzcG9uc2UoZGF0YS5yZXNwb25zZSk7XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRtYXhBdHRlbXB0czogMyxcblx0XHRcdFx0aW5pdGlhbERlbGF5OiAyMDAwLFxuXHRcdFx0fSxcblx0XHRcdCdPbGxhbWEgY2xhc3NpZnknXG5cdFx0KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBwYXJzZVJlc3BvbnNlKHJlc3BvbnNlOiBzdHJpbmcpOiBDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG5cdFx0Ly8g5bCd6K+V5LuO5ZON5bqU5Lit5o+Q5Y+WIEpTT05cblx0XHRjb25zdCBqc29uTWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvYGBganNvblxcbihbXFxzXFxTXSo/KVxcbmBgYC8pIHx8IHJlc3BvbnNlLm1hdGNoKC8oXFx7W1xcc1xcU10qXFx9KS8pO1xuXHRcdFxuXHRcdGlmIChqc29uTWF0Y2gpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoanNvbk1hdGNoWzFdKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjYXRlZ29yeTogcGFyc2VkLmNhdGVnb3J5IHx8ICdPdGhlcicsXG5cdFx0XHRcdFx0Y29uZmlkZW5jZTogcGFyc2VkLmNvbmZpZGVuY2UgfHwgMC41LFxuXHRcdFx0XHRcdHJlYXNvbmluZzogcGFyc2VkLnJlYXNvbmluZyB8fCAnJyxcblx0XHRcdFx0XHRpc1VuY2VydGFpbjogcGFyc2VkLmlzVW5jZXJ0YWluIHx8IGZhbHNlLFxuXHRcdFx0XHRcdHN1Z2dlc3RlZENhdGVnb3J5OiBwYXJzZWQuc3VnZ2VzdGVkQ2F0ZWdvcnksXG5cdFx0XHRcdH07XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoJ0pTT04g6Kej5p6Q5aSx6LSl77yM5L2/55So5paH5pys6Kej5p6QJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdC8vIOWkh+eUqOino+aekO+8muaPkOWPluesrOS4gOS4quWIhuexu+i3r+W+hFxuXHRcdGNvbnN0IGNhdGVnb3J5TWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvY2F0ZWdvcnlbXFxzOl0rW1wiJ10/KFteXFxuXCInXSspL2kpO1xuXHRcdGNvbnN0IGNvbmZpZGVuY2VNYXRjaCA9IHJlc3BvbnNlLm1hdGNoKC9jb25maWRlbmNlW1xcczpdKyhbMC05Ll0rKS9pKTtcblx0XHRcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2F0ZWdvcnk6IGNhdGVnb3J5TWF0Y2ggPyBjYXRlZ29yeU1hdGNoWzFdLnRyaW0oKSA6ICdPdGhlcicsXG5cdFx0XHRjb25maWRlbmNlOiBjb25maWRlbmNlTWF0Y2ggPyBwYXJzZUZsb2F0KGNvbmZpZGVuY2VNYXRjaFsxXSkgOiAwLjUsXG5cdFx0XHRyZWFzb25pbmc6IHJlc3BvbnNlLnNsaWNlKDAsIDIwMCksXG5cdFx0XHRpc1VuY2VydGFpbjogZmFsc2UsXG5cdFx0fTtcblx0fVxufVxuIiwiaW1wb3J0IHsgQUlQcm92aWRlciwgQ2xhc3NpZmljYXRpb25SZXN1bHQgfSBmcm9tICcuLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyBTWVNURU1fUFJPTVBULCBVU0VSX1BST01QVF9URU1QTEFURSB9IGZyb20gJy4vcHJvbXB0cyc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHsgd2l0aFJldHJ5LCBmZXRjaFdpdGhUaW1lb3V0LCBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlLCB2YWxpZGF0ZVVybCB9IGZyb20gJy4uL3V0aWxzL2Vycm9ySGFuZGxlcic7XG5cbmludGVyZmFjZSBQcm92aWRlckNvbmZpZyB7XG5cdG5hbWU6IHN0cmluZztcblx0YXBpS2V5OiBzdHJpbmc7XG5cdG1vZGVsOiBzdHJpbmc7XG5cdGJhc2VVcmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5BSUNvbXBhdGlibGVQcm92aWRlciBpbXBsZW1lbnRzIEFJUHJvdmlkZXIge1xuXHRuYW1lOiBzdHJpbmc7XG5cdHByaXZhdGUgY29uZmlnOiBQcm92aWRlckNvbmZpZztcblx0cHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblx0XG5cdGNvbnN0cnVjdG9yKGNvbmZpZzogUHJvdmlkZXJDb25maWcsIGxvZ2dlcjogTG9nZ2VyKSB7XG5cdFx0dGhpcy5uYW1lID0gY29uZmlnLm5hbWU7XG5cdFx0dGhpcy5jb25maWcgPSBjb25maWc7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdH1cblx0XG5cdGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyDpqozor4EgQVBJIEtleVxuXHRcdFx0aWYgKCF0aGlzLmNvbmZpZy5hcGlLZXkgfHwgdGhpcy5jb25maWcuYXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBUEkgS2V5IOacquiuvue9ru+8jOivt+WFiOmFjee9riBBUEkgS2V5JyB9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyDpqozor4EgVVJMXG5cdFx0XHR2YWxpZGF0ZVVybCh0aGlzLmNvbmZpZy5iYXNlVXJsLCAnQVBJIOWcsOWdgCcpO1xuXHRcdFx0XG5cdFx0XHQvLyDkvb/nlKjluKbotoXml7bnmoQgZmV0Y2hcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChcblx0XHRcdFx0YCR7dGhpcy5jb25maWcuYmFzZVVybH0vbW9kZWxzYCxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG1ldGhvZDogJ0dFVCcsXG5cdFx0XHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcdFx0J0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7dGhpcy5jb25maWcuYXBpS2V5fWAsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0MTAwMDAgLy8gMTAg56eS6LaF5pe2XG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVzcG9uc2Uub2spIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYCR7dGhpcy5uYW1lfSBBUEkg6L+e5o6l5q2j5bi4YCB9O1xuXHRcdFx0fSBlbHNlIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMSkge1xuXHRcdFx0XHRyZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FQSSBLZXkg5peg5pWI5oiW5pyq5o6I5p2D77yM6K+35qOA5p+l5piv5ZCm5q2j56GuJyB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfTog5pyN5Yqh5pqC5pe25LiN5Y+v55SoYCB9O1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBnZXRVc2VyRnJpZW5kbHlNZXNzYWdlKGUgYXMgRXJyb3IpO1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2UgfTtcblx0XHR9XG5cdH1cblx0XG5cdGFzeW5jIGNsYXNzaWZ5KGNvbnRlbnQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgY2F0ZWdvcmllczogc3RyaW5nW10pOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0PiB7XG5cdFx0Ly8g5L2/55So5bim6YeN6K+V55qE5pON5L2cXG5cdFx0cmV0dXJuIGF3YWl0IHdpdGhSZXRyeShcblx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdXNlclByb21wdCA9IFVTRVJfUFJPTVBUX1RFTVBMQVRFXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7VElUTEV9fScsIHRpdGxlKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCd7e0NPTlRFTlR9fScsIGNvbnRlbnQuc2xpY2UoMCwgNDAwMCkpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ3t7Q0FURUdPUklFU319JywgY2F0ZWdvcmllcy5tYXAoYyA9PiBgLSAke2N9YCkuam9pbignXFxuJykpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8g5L2/55So5bim6LaF5pe255qEIGZldGNoXG5cdFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChcblx0XHRcdFx0XHRgJHt0aGlzLmNvbmZpZy5iYXNlVXJsfS9jaGF0L2NvbXBsZXRpb25zYCxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0XHRcdFx0J0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7dGhpcy5jb25maWcuYXBpS2V5fWAsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRcdFx0XHRtb2RlbDogdGhpcy5jb25maWcubW9kZWwsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2VzOiBbXG5cdFx0XHRcdFx0XHRcdFx0eyByb2xlOiAnc3lzdGVtJywgY29udGVudDogU1lTVEVNX1BST01QVCB9LFxuXHRcdFx0XHRcdFx0XHRcdHsgcm9sZTogJ3VzZXInLCBjb250ZW50OiB1c2VyUHJvbXB0IH0sXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdHRlbXBlcmF0dXJlOiAwLjMsXG5cdFx0XHRcdFx0XHRcdG1heF90b2tlbnM6IDUwMCxcblx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZm9ybWF0OiB7IHR5cGU6ICdqc29uX29iamVjdCcgfSxcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0MzAwMDAgLy8gMzAg56eS6LaF5pe2XG5cdFx0XHRcdCk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JNc2cgPSBlcnJvci5lcnJvcj8ubWVzc2FnZSB8fCBgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIOaehOmAoOabtOivpue7hueahOmUmeivr1xuXHRcdFx0XHRcdGNvbnN0IGVuaGFuY2VkRXJyb3IgPSBuZXcgRXJyb3IoZXJyb3JNc2cpIGFzIGFueTtcblx0XHRcdFx0XHRlbmhhbmNlZEVycm9yLnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcblx0XHRcdFx0XHRlbmhhbmNlZEVycm9yLnJlc3BvbnNlID0geyBcblx0XHRcdFx0XHRcdHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuXHRcdFx0XHRcdFx0aGVhZGVyczogcmVzcG9uc2UuaGVhZGVycyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRocm93IGVuaGFuY2VkRXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdFRleHQgPSBkYXRhLmNob2ljZXNbMF0/Lm1lc3NhZ2U/LmNvbnRlbnQgfHwgJ3t9Jztcblx0XHRcdFx0XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcnNlUmVzcG9uc2UocmVzdWx0VGV4dCk7XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRtYXhBdHRlbXB0czogMyxcblx0XHRcdFx0aW5pdGlhbERlbGF5OiAxNTAwLFxuXHRcdFx0fSxcblx0XHRcdGAke3RoaXMubmFtZX0gY2xhc3NpZnlgXG5cdFx0KTtcblx0fVxuXHRcblx0cHJpdmF0ZSBwYXJzZVJlc3BvbnNlKHJlc3BvbnNlVGV4dDogc3RyaW5nKTogQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJlc3BvbnNlVGV4dCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYXRlZ29yeTogcGFyc2VkLmNhdGVnb3J5IHx8ICdPdGhlcicsXG5cdFx0XHRcdGNvbmZpZGVuY2U6IHBhcnNlZC5jb25maWRlbmNlIHx8IDAuNSxcblx0XHRcdFx0cmVhc29uaW5nOiBwYXJzZWQucmVhc29uaW5nIHx8ICcnLFxuXHRcdFx0XHRpc1VuY2VydGFpbjogcGFyc2VkLmlzVW5jZXJ0YWluIHx8IGZhbHNlLFxuXHRcdFx0XHRzdWdnZXN0ZWRDYXRlZ29yeTogcGFyc2VkLnN1Z2dlc3RlZENhdGVnb3J5LFxuXHRcdFx0fTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKCdKU09OIOino+aekOWksei0pScpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICdPdGhlcicsXG5cdFx0XHRcdGNvbmZpZGVuY2U6IDAuNSxcblx0XHRcdFx0cmVhc29uaW5nOiByZXNwb25zZVRleHQuc2xpY2UoMCwgMjAwKSxcblx0XHRcdFx0aXNVbmNlcnRhaW46IHRydWUsXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKiDnroDljZXml6Xlv5flt6XlhbdcbiAqL1xuZXhwb3J0IGNsYXNzIExvZ2dlciB7XG5cdHByaXZhdGUgZW5hYmxlZDogYm9vbGVhbjtcblx0cHJpdmF0ZSBwcmVmaXggPSAnW0FJQ2xhc3NpZmllcl0nO1xuXHRcblx0Y29uc3RydWN0b3IoZW5hYmxlZCA9IGZhbHNlKSB7XG5cdFx0dGhpcy5lbmFibGVkID0gZW5hYmxlZDtcblx0fVxuXHRcblx0c2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZW5hYmxlZDtcblx0fVxuXHRcblx0ZGVidWcobWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVuYWJsZWQpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0XHR9XG5cdH1cblx0XG5cdGluZm8obWVzc2FnZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnNvbGUuZGVidWcoYCR7dGhpcy5wcmVmaXh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcblx0fVxuXHRcblx0d2FybihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Y29uc29sZS53YXJuKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cblx0XG5cdGVycm9yKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRjb25zb2xlLmVycm9yKGAke3RoaXMucHJlZml4fSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG5cdH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlLCBURmlsZSB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IERFRkFVTFRfU0VUVElOR1MsIFBsdWdpblNldHRpbmdzLCBBSVByb3ZpZGVyIH0gZnJvbSAnLi9zZXR0aW5ncy90eXBlcyc7XG5pbXBvcnQgeyBTZXR0aW5nc1RhYiB9IGZyb20gJy4vc2V0dGluZ3MvU2V0dGluZ3NUYWInO1xuaW1wb3J0IHsgQ2xhc3NpZnlDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9DbGFzc2lmeUNvbW1hbmQnO1xuaW1wb3J0IHsgT2xsYW1hUHJvdmlkZXIgfSBmcm9tICcuL3NlcnZpY2VzL09sbGFtYVByb3ZpZGVyJztcbmltcG9ydCB7IE9wZW5BSUNvbXBhdGlibGVQcm92aWRlciB9IGZyb20gJy4vc2VydmljZXMvT3BlbkFJUHJvdmlkZXInO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHsgZmlsZU9wcyB9IGZyb20gJy4vdXRpbHMvZmlsZU9wcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFJQ2xhc3NpZmllclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdC8vIOaPkuS7tuiuvue9rlxuXHRzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuXHRcblx0Ly8g5pel5b+XXG5cdGxvZ2dlciA9IG5ldyBMb2dnZXIoKTtcblx0XG5cdC8vIOWRveS7pOWkhOeQhlxuXHRwcml2YXRlIGNvbW1hbmRzOiBDbGFzc2lmeUNvbW1hbmQ7XG5cdFxuXHQvLyDorr7nva7pnaLmnb9cblx0cHJpdmF0ZSBzZXR0aW5nc1RhYjogU2V0dGluZ3NUYWI7XG5cdFxuXHRhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc29sZS5kZWJ1ZygnW0FJIENsYXNzaWZpZXJdIOaPkuS7tuWKoOi9veS4rS4uLicpO1xuXHRcdFxuXHRcdC8vIOWKoOi9veiuvue9rlxuXHRcdGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cdFx0XG5cdFx0Ly8g5Yid5aeL5YyW5pel5b+XXG5cdFx0dGhpcy5sb2dnZXIuc2V0RW5hYmxlZCh0aGlzLnNldHRpbmdzLmVuYWJsZURlYnVnTG9nKTtcblx0XHRcblx0XHQvLyDoh6rliqjliJvlu7ogSW5ib3gg55uu5b2V77yI5aaC5p6c5LiN5a2Y5Zyo77yJXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBmaWxlT3BzLmVuc3VyZUZvbGRlcih0aGlzLmFwcC52YXVsdCwgdGhpcy5zZXR0aW5ncy5pbmJveEZvbGRlcik7XG5cdFx0XHRpZiAoY3JlYXRlZCkge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGDlt7LliJvlu7rmlLbku7bnrrHmlofku7blpLk6ICR7dGhpcy5zZXR0aW5ncy5pbmJveEZvbGRlcn1gKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5lcnJvcign5Yib5bu65pS25Lu2566x5paH5Lu25aS55aSx6LSlOicsIGUpO1xuXHRcdH1cblx0XHRcblx0XHQvLyDliJ3lp4vljJblkb3ku6Rcblx0XHR0aGlzLmNvbW1hbmRzID0gbmV3IENsYXNzaWZ5Q29tbWFuZCh0aGlzKTtcblx0XHRcblx0XHQvLyDms6jlhozlkb3ku6Rcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6ICdjbGFzc2lmeS1pbmJveCcsXG5cdFx0XHRuYW1lOiAnQUnmmbrog73liIbnsbsgLSDliIbnsbvmlLbku7bnrrEnLFxuXHRcdFx0Y2FsbGJhY2s6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kcy5jbGFzc2lmeUluYm94KCk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogJ2NsYXNzaWZ5LWN1cnJlbnQnLFxuXHRcdFx0bmFtZTogJ0FJ5pm66IO95YiG57G7IC0g5YiG57G75b2T5YmN5paH5Lu2Jyxcblx0XHRcdGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMuY29tbWFuZHMuY2xhc3NpZnlDdXJyZW50RmlsZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIDEuIOa3u+WKoCBSaWJib24g5Zu+5qCH77yI5bem5L6n6L655qCP77yJXG5cdFx0dGhpcy5hZGRSaWJib25JY29uKCdzcGFya2xlcycsICdBSeaZuuiDveWIhuexuycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlJbmJveCgpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIDIuIOa3u+WKoOaWh+S7tuWPs+mUruiPnOWNlVxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1tZW51JywgKG1lbnUsIGZpbGUpID0+IHtcblx0XHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0XHRcdFx0aXRlbVxuXHRcdFx0XHRcdFx0XHQuc2V0VGl0bGUoJ0FJ5pm66IO95YiG57G7Jylcblx0XHRcdFx0XHRcdFx0LnNldEljb24oJ3NwYXJrbGVzJylcblx0XHRcdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlDdXJyZW50RmlsZSgpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXHRcdFxuXHRcdC8vIDMuIOa3u+WKoOe8lui+keWZqOiPnOWNle+8iOWPs+S4iuinkuabtOWkmuiPnOWNle+8iVxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbignZWRpdG9yLW1lbnUnLCAobWVudSkgPT4ge1xuXHRcdFx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdFx0XHRpdGVtXG5cdFx0XHRcdFx0XHQuc2V0VGl0bGUoJ0FJ5pm66IO95YiG57G7Jylcblx0XHRcdFx0XHRcdC5zZXRJY29uKCdzcGFya2xlcycpXG5cdFx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZHMuY2xhc3NpZnlDdXJyZW50RmlsZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHQpO1xuXHRcdFxuXHRcdC8vIOa3u+WKoOiuvue9rumdouadv1xuXHRcdHRoaXMuc2V0dGluZ3NUYWIgPSBuZXcgU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpO1xuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYih0aGlzLnNldHRpbmdzVGFiKTtcblx0XHRcblx0XHRjb25zb2xlLmRlYnVnKCdbQUkgQ2xhc3NpZmllcl0g5o+S5Lu25Yqg6L295a6M5oiQIScpO1xuXHR9XG5cdFxuXHRvbnVubG9hZCgpOiB2b2lkIHtcblx0XHRjb25zb2xlLmRlYnVnKCdbQUkgQ2xhc3NpZmllcl0g5o+S5Lu25bey5Y246L29Jyk7XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDojrflj5YgQUkgUHJvdmlkZXIg5a6e5L6LXG5cdCAqL1xuXHRnZXRBSVByb3ZpZGVyKCk6IEFJUHJvdmlkZXIge1xuXHRcdGNvbnN0IHByb3ZpZGVyVHlwZSA9IHRoaXMuc2V0dGluZ3MuYWlQcm92aWRlcjtcblx0XHRcblx0XHQvLyDpqozor4HphY3nva5cblx0XHR0aGlzLnZhbGlkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXJUeXBlKTtcblx0XHRcblx0XHRzd2l0Y2ggKHByb3ZpZGVyVHlwZSkge1xuXHRcdFx0Y2FzZSAnb2xsYW1hJzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPbGxhbWFQcm92aWRlcih0aGlzLnNldHRpbmdzLCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ29wZW5haSc6XG5cdFx0XHRcdHJldHVybiBuZXcgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyKHtcblx0XHRcdFx0XHRuYW1lOiAnT3BlbkFJJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLm9wZW5haU1vZGVsLFxuXHRcdFx0XHRcdGJhc2VVcmw6IHRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpVXJsLFxuXHRcdFx0XHR9LCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ2RlZXBzZWVrJzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIoe1xuXHRcdFx0XHRcdG5hbWU6ICdEZWVwU2VlaycsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLmRlZXBzZWVrTW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5zZXR0aW5ncy5kZWVwc2Vla0FwaVVybCxcblx0XHRcdFx0fSwgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdtb29uc2hvdCc6XG5cdFx0XHRcdHJldHVybiBuZXcgT3BlbkFJQ29tcGF0aWJsZVByb3ZpZGVyKHtcblx0XHRcdFx0XHRuYW1lOiAnTW9vbnNob3QgKEtpbWkpJyxcblx0XHRcdFx0XHRhcGlLZXk6IHRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlLZXksXG5cdFx0XHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MubW9vbnNob3RNb2RlbCxcblx0XHRcdFx0XHRiYXNlVXJsOiB0aGlzLnNldHRpbmdzLm1vb25zaG90QXBpVXJsLFxuXHRcdFx0XHR9LCB0aGlzLmxvZ2dlcik7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ3poaXB1Jzpcblx0XHRcdFx0cmV0dXJuIG5ldyBPcGVuQUlDb21wYXRpYmxlUHJvdmlkZXIoe1xuXHRcdFx0XHRcdG5hbWU6ICdaaGlwdSAo5pm66LCxKScsXG5cdFx0XHRcdFx0YXBpS2V5OiB0aGlzLnNldHRpbmdzLnpoaXB1QXBpS2V5LFxuXHRcdFx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLnpoaXB1TW9kZWwsXG5cdFx0XHRcdFx0YmFzZVVybDogdGhpcy5zZXR0aW5ncy56aGlwdUFwaVVybCxcblx0XHRcdFx0fSwgdGhpcy5sb2dnZXIpO1xuXHRcdFx0XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdGNvbnN0IGV4aGF1c3RpdmVDaGVjazogbmV2ZXIgPSBwcm92aWRlclR5cGU7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihg5pyq55+l55qEIEFJIFByb3ZpZGVyOiAke2V4aGF1c3RpdmVDaGVja31gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiDpqozor4EgUHJvdmlkZXIg6YWN572uXG5cdCAqL1xuXHRwcml2YXRlIHZhbGlkYXRlUHJvdmlkZXJDb25maWcocHJvdmlkZXJUeXBlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVyVHlwZSkge1xuXHRcdFx0Y2FzZSAnb2xsYW1hJzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm9sbGFtYVVybCB8fCB0aGlzLnNldHRpbmdzLm9sbGFtYVVybC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPbGxhbWEg5Zyw5Z2A5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm9sbGFtYU1vZGVsIHx8IHRoaXMuc2V0dGluZ3Mub2xsYW1hTW9kZWwudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignT2xsYW1hIOaooeWei+acqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdvcGVuYWknOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5IHx8IHRoaXMuc2V0dGluZ3Mub3BlbmFpQXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ09wZW5BSSBBUEkgS2V5IOacqumFjee9ru+8jOivt+WcqOiuvue9ruS4reWhq+WGmScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlICdkZWVwc2Vlayc6XG5cdFx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5kZWVwc2Vla0FwaUtleSB8fCB0aGlzLnNldHRpbmdzLmRlZXBzZWVrQXBpS2V5LnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RlZXBTZWVrIEFQSSBLZXkg5pyq6YWN572u77yM6K+35Zyo6K6+572u5Lit5aGr5YaZJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgJ21vb25zaG90Jzpcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLm1vb25zaG90QXBpS2V5IHx8IHRoaXMuc2V0dGluZ3MubW9vbnNob3RBcGlLZXkudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTW9vbnNob3QgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0Y2FzZSAnemhpcHUnOlxuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuemhpcHVBcGlLZXkgfHwgdGhpcy5zZXR0aW5ncy56aGlwdUFwaUtleS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCfmmbrosLEgQUkgQVBJIEtleSDmnKrphY3nva7vvIzor7flnKjorr7nva7kuK3loavlhpknKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdFxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDmnKrnn6XnmoQgQUkgUHJvdmlkZXI6ICR7cHJvdmlkZXJUeXBlfWApO1xuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIOWKoOi9veiuvue9rlxuXHQgKi9cblx0YXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IHtcblx0XHRcdC4uLkRFRkFVTFRfU0VUVElOR1MsXG5cdFx0XHQuLi5kYXRhLFxuXHRcdH07XG5cdFx0XG5cdFx0Ly8g5Yid5aeL5YyW5YiG57G75YiX6KGoXG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmNhdGVnb3JpZXMgfHwgdGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5zZXR0aW5ncy5jYXRlZ29yaWVzID0gdGhpcy5mbGF0dGVuQ2F0ZWdvcmllcyh0aGlzLnNldHRpbmdzLmNhdGVnb3J5VHJlZSk7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICog5L+d5a2Y6K6+572uXG5cdCAqL1xuXHRhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0XHR0aGlzLmxvZ2dlci5zZXRFbmFibGVkKHRoaXMuc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cpO1xuXHR9XG5cdFxuXHQvKipcblx0ICog5bCG5YiG57G75qCR5bGV5bmz5Li65YiX6KGoXG5cdCAqL1xuXHRwcml2YXRlIGZsYXR0ZW5DYXRlZ29yaWVzKHRyZWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwcmVmaXggPSAnJyk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModHJlZSkpIHtcblx0XHRcdGNvbnN0IHBhdGggPSBwcmVmaXggPyBgJHtwcmVmaXh9LyR7a2V5fWAgOiBrZXk7XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCguLi50aGlzLmZsYXR0ZW5DYXRlZ29yaWVzKHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwYXRoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucHVzaChwYXRoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuIl0sIm5hbWVzIjpbIk5vdGljZSIsIkNvbmZpcm1Nb2RhbCIsIk1vZGFsIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJURmlsZSIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7OztBQWlETyxNQUFNLGdCQUFnQixHQUFtQjtBQUMvQyxJQUFBLFVBQVUsRUFBRSxRQUFRO0FBQ3BCLElBQUEsU0FBUyxFQUFFLHdCQUF3QjtBQUNuQyxJQUFBLFdBQVcsRUFBRSxVQUFVOztBQUd2QixJQUFBLFlBQVksRUFBRSxF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
