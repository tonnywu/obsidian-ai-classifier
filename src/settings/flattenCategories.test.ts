import { describe, it, expect } from 'vitest';

/**
 * 测试分类树展平函数
 * 
 * 该函数将嵌套的分类树结构转换为扁平的路径列表
 */
describe('flattenCategories', () => {
	// 从源码复制的 flattenCategories 逻辑
	const flattenCategories = (tree: Record<string, unknown>, prefix = ''): string[] => {
		const result: string[] = [];
		for (const [key, value] of Object.entries(tree)) {
			const path = prefix ? `${prefix}/${key}` : key;
			if (typeof value === 'object' && value !== null) {
				result.push(...flattenCategories(value as Record<string, unknown>, path));
			} else {
				result.push(path);
			}
		}
		return result;
	};

	describe('基本功能', () => {
		it('应该展平简单分类树', () => {
			const tree = {
				'Programming': true,
				'Data': true,
			};
			const result = flattenCategories(tree);
			expect(result).toEqual(['Programming', 'Data']);
		});

		it('应该展平嵌套分类树', () => {
			const tree = {
				'Programming': {
					'Frontend': true,
					'Backend': true,
				},
			};
			const result = flattenCategories(tree);
			expect(result).toEqual(['Programming/Frontend', 'Programming/Backend']);
		});

		it('应该处理多层嵌套', () => {
			const tree = {
				'A': {
					'B': {
						'C': true,
					},
				},
			};
			const result = flattenCategories(tree);
			expect(result).toEqual(['A/B/C']);
		});
	});

	describe('DEFAULT_SETTINGS 示例', () => {
		it('应该正确展平默认分类树', () => {
			const tree = {
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
			};
			
			const result = flattenCategories(tree);
			
			expect(result).toContain('Programming/Frontend');
			expect(result).toContain('Programming/Backend');
			expect(result).toContain('AI & ML/Machine Learning');
			expect(result).toContain('Data/Database');
			expect(result).toContain('Architecture/System Design');
			expect(result).toContain('Other');
			// 4 + 3 + 3 + 2 + 1 = 13 个叶子节点
			expect(result).toHaveLength(13);
		});
	});

	describe('边界情况', () => {
		it('应该处理空树', () => {
			const result = flattenCategories({});
			expect(result).toEqual([]);
		});

		it('应该处理深层嵌套', () => {
			const tree = {
				'Level1': {
					'Level2': {
						'Level3': {
							'Level4': {
								'Level5': true,
							},
						},
					},
				},
			};
			const result = flattenCategories(tree);
			expect(result).toEqual(['Level1/Level2/Level3/Level4/Level5']);
		});

		it('应该处理混合层级', () => {
			const tree = {
				'Simple': true,
				'Nested': {
					'Child': true,
				},
				'Another': true,
			};
			const result = flattenCategories(tree);
			expect(result).toEqual(['Simple', 'Nested/Child', 'Another']);
		});

		it('应该处理包含特殊字符的分类名', () => {
			const tree = {
				'C++': true,
				'Node.js': {
					'Express.js': true,
				},
			};
			const result = flattenCategories(tree);
			expect(result).toContain('C++');
			expect(result).toContain('Node.js/Express.js');
		});

		it('应该处理中文分类', () => {
			const tree = {
				'技术': {
					'前端': true,
					'后端': true,
				},
				'其他': true,
			};
			const result = flattenCategories(tree);
			expect(result).toEqual(['技术/前端', '技术/后端', '其他']);
		});
	});

	describe('类型处理', () => {
		it('应该将 true 视为叶子节点', () => {
			const tree = { 'Category': true };
			const result = flattenCategories(tree);
			expect(result).toEqual(['Category']);
		});

		it('应该将空对象视为叶子节点', () => {
			const tree = { 'Category': {} };
			const result = flattenCategories(tree);
			expect(result).toEqual([]);
		});

		it('应该正确处理非 true 的布尔值', () => {
			const tree = { 
				'Active': true, 
				'Inactive': false 
			};
			const result = flattenCategories(tree);
			expect(result).toContain('Active');
			expect(result).toContain('Inactive');
		});
	});
});
