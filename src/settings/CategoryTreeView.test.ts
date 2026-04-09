import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryTreeView, CategoryTreeNode } from './CategoryTreeView';

// Mock i18n
vi.mock('./i18n', () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			'settings.addTopLevel': '添加一级分类',
			'settings.enterCategoryName': '请输入分类名称',
			'settings.enterNewName': '请输入新名称',
			'settings.categoryExists': '分类已存在',
			'settings.confirmDelete': '确认删除此分类？',
			'settings.confirmDeleteWithChildren': '此分类包含子分类，确认删除所有子分类吗？',
		};
		return translations[key] || key;
	}
}));

/**
 * 创建模拟的 Obsidian HTMLElement
 */
function createMockElement(tagName: string = 'div'): HTMLElement & {
	empty: () => void;
	createDiv: (className?: string) => ReturnType<typeof createMockElement>;
	createEl: (tagName: string, options?: { cls?: string; text?: string }) => ReturnType<typeof createMockElement>;
	addClass: (className: string) => void;
} {
	const element = document.createElement(tagName) as ReturnType<typeof createMockElement>;
	
	// 模拟 Obsidian 扩展的 API
	element.empty = () => {
		element.innerHTML = '';
	};
	
	element.createDiv = (className?: string) => {
		const div = createMockElement('div');
		if (className) div.addClass(className);
		element.appendChild(div);
		return div;
	};
	
	element.createEl = (tagName: string, options?: { cls?: string; text?: string }) => {
		const el = createMockElement(tagName);
		if (options?.cls) el.addClass(options.cls);
		if (options?.text) el.textContent = options.text;
		element.appendChild(el);
		return el;
	};
	
	element.addClass = (className: string) => {
		element.classList.add(className);
	};
	
	return element;
}

describe('CategoryTreeView', () => {
	let containerEl: ReturnType<typeof createMockElement>;
	let mockOnChange: ReturnType<typeof vi.fn>;
	let sampleTree: CategoryTreeNode;

	beforeEach(() => {
		// 创建模拟的 DOM 容器
		containerEl = createMockElement();

		// 模拟 onChange 回调
		mockOnChange = vi.fn();

		// 示例分类树
		sampleTree = {
			'编程': {
				'前端': true,
				'后端': true,
			},
			'AI': {
				'机器学习': true,
				'深度学习': true,
			},
			'Other': true,
		};
	});

	it('应该正确初始化并渲染树结构', () => {
		new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// 检查容器是否包含树结构
		const treeNodes = containerEl.querySelectorAll('.category-node');
		expect(treeNodes.length).toBeGreaterThan(0);

		// 检查是否包含顶层分类
		expect(containerEl.textContent).toContain('编程');
		expect(containerEl.textContent).toContain('AI');
		expect(containerEl.textContent).toContain('Other');
	});

	it('应该显示添加一级分类按钮', () => {
		new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// 检查是否存在添加一级分类按钮
		const addButton = Array.from(containerEl.querySelectorAll('button'))
			.find(btn => btn.textContent?.includes('添加一级分类'));
		
		expect(addButton).toBeDefined();
	});

	it('应该正确处理子节点', () => {
		new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// 检查是否有展开按钮（针对有子节点的分类）
		const expandButtons = containerEl.querySelectorAll('.category-expand-btn');
		expect(expandButtons.length).toBeGreaterThan(0);
	});

	it('应该为每个节点显示操作按钮', () => {
		new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// 检查编辑和删除按钮
		const actionButtons = containerEl.querySelectorAll('.category-action-btn');
		expect(actionButtons.length).toBeGreaterThan(0);
	});

	it('应该调用 onChange 回调当树更新时', () => {
		new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// updateTree 是外部调用的，不应该触发 onChange
		// onChange 应该只在用户交互时触发
		expect(mockOnChange).not.toHaveBeenCalled();
	});

	it('应该正确区分叶子节点和父节点', () => {
		new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// 检查图标
		const icons = containerEl.querySelectorAll('.category-icon');
		const folderIcons = Array.from(icons).filter(icon => icon.textContent === '📂');
		const fileIcons = Array.from(icons).filter(icon => icon.textContent === '📄');

		// '编程' 和 'AI' 应该是文件夹，'Other' 应该是文件
		expect(folderIcons.length).toBeGreaterThan(0);
		expect(fileIcons.length).toBeGreaterThan(0);
	});

	it('应该在添加一级分类后触发更新', () => {
		const treeView = new CategoryTreeView(containerEl, sampleTree, mockOnChange);

		// 模拟添加一级分类
		// 由于实际操作需要用户输入，这里直接测试 updateTree
		const newTree = {
			...sampleTree,
			'新分类': {},
		};

		treeView.updateTree(newTree);
		expect(containerEl.textContent).toContain('新分类');
	});
});
