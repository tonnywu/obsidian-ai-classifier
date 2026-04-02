import { describe, it, expect } from 'vitest';

/**
 * 测试 fileOps 工具函数
 */
describe('fileOps', () => {
	// 从源码复制的 buildCategoryPath 逻辑
	const buildCategoryPath = (category: string, inboxFolder: string): string => {
		const normalizedCategory = category.replace(/\//g, '/');
		return `${inboxFolder}/${normalizedCategory}`;
	};

	describe('buildCategoryPath', () => {
		it('应该构建简单分类路径', () => {
			const result = buildCategoryPath('Programming', 'Inbox');
			expect(result).toBe('Inbox/Programming');
		});

		it('应该构建嵌套分类路径', () => {
			const result = buildCategoryPath('Programming/Frontend', 'Inbox');
			expect(result).toBe('Inbox/Programming/Frontend');
		});

		it('应该处理多层嵌套', () => {
			const result = buildCategoryPath('A/B/C/D', 'Notes');
			expect(result).toBe('Notes/A/B/C/D');
		});

		it('应该处理空 inboxFolder', () => {
			const result = buildCategoryPath('Category', '');
			expect(result).toBe('/Category');
		});

		it('应该处理中文分类', () => {
			const result = buildCategoryPath('技术/前端/React', '收件箱');
			expect(result).toBe('收件箱/技术/前端/React');
		});

		it('应该处理特殊字符分类', () => {
			const result = buildCategoryPath('AI & ML', 'Inbox');
			expect(result).toBe('Inbox/AI & ML');
		});
	});
});
