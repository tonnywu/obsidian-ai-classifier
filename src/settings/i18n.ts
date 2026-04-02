// 国际化支持 - 当前仅支持中文
export const translations = {
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

export function t(key: string): string {
	const keys = key.split('.');
	let result: any = translations;
	for (const k of keys) {
		result = result?.[k];
	}
	return result || key;
}
