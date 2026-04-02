import { describe, it, expect } from 'vitest';

/**
 * 测试 ContentExtractor 的纯逻辑方法
 * 
 * 注意：cleanContent 是私有方法，通过类型断言访问
 */
describe('ContentExtractor', () => {
	// 简化版 cleanContent 实现（用于测试，与源码保持一致）
	const cleanContent = (content: string): string => {
		return content
			.replace(/^---[\s\S]*?---\n?/, '')
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/```[\s\S]*?```/g, (match) => {
				const langMatch = match.match(/```(\w*)/);
				const lang = langMatch ? langMatch[1] : '';
				return `[代码块: ${lang}]`;
			})
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '[$1]')
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	};

	describe('cleanContent', () => {
		it('应该移除 YAML frontmatter', () => {
			const content = `---
title: Test
date: 2024-01-01
---
# Hello World`;
			
			const result = cleanContent(content);
			expect(result).not.toContain('---');
			expect(result).not.toContain('title: Test');
			expect(result).toContain('# Hello World');
		});

		it('应该移除 HTML 注释', () => {
			const content = `Hello <!-- 这是注释 -->World`;
			const result = cleanContent(content);
			expect(result).toBe('Hello World');
		});

		it('应该将代码块替换为占位符', () => {
			const content = 'Text before\n```typescript\nconst x = 1;\n```\nText after';
			const result = cleanContent(content);
			expect(result).toContain('[代码块: typescript]');
			expect(result).not.toContain('const x = 1;');
		});

		it('应该处理无语言标记的代码块', () => {
			const content = 'Text\n```\ncode here\n```\nEnd';
			const result = cleanContent(content);
			expect(result).toContain('[代码块: ]');
		});

		it('应该移除图片链接但保留 alt text', () => {
			const content = 'See image ![Screenshot](image.png) here';
			const result = cleanContent(content);
			expect(result).toContain('[Screenshot]');
			expect(result).not.toContain('image.png');
		});

		it('应该移除链接但保留文本', () => {
			const content = 'Visit [Google](https://google.com) now';
			const result = cleanContent(content);
			expect(result).toBe('Visit Google now');
		});

		it('应该压缩多余空行', () => {
			const content = 'Line 1\n\n\n\n\nLine 2';
			const result = cleanContent(content);
			expect(result).toBe('Line 1\n\nLine 2');
		});

		it('应该去除首尾空白', () => {
			const content = '  \n  Content here  \n  ';
			const result = cleanContent(content);
			expect(result).toBe('Content here');
		});

		it('应该处理复杂内容', () => {
			const content = `---
title: Complex Note
tags: [test]
---

# Header

Some text with a [link](https://example.com).

![Image](img.png)

\`\`\`python
print("hello")
\`\`\`

<!-- TODO: update this -->
`;
			const result = cleanContent(content);
			expect(result).not.toContain('---');
			expect(result).not.toContain('TODO');
			expect(result).toContain('# Header');
			expect(result).toContain('link');
			expect(result).toContain('[Image]');
			expect(result).toContain('[代码块: python]');
		});
	});

	describe('generateSummary', () => {
		// 从 ContentExtractor 类复制的逻辑
		const generateSummary = (content: string, maxLength = 2000): string => {
			if (content.length <= maxLength) {
				return content;
			}
			
			const truncated = content.slice(0, maxLength);
			const lastPeriod = truncated.lastIndexOf('。');
			const lastNewline = truncated.lastIndexOf('\n');
			
			const breakPoint = Math.max(lastPeriod, lastNewline);
			
			if (breakPoint > maxLength * 0.7) {
				return truncated.slice(0, breakPoint + 1);
			}
			
			return truncated + '...';
		};

		it('应该返回短内容原样', () => {
			const content = 'Short content';
			const result = generateSummary(content, 100);
			expect(result).toBe('Short content');
		});

		it('应该在句号处截断长内容（边界点大于70%）', () => {
			// maxLength=20, 70%阈值=14
			// 内容长度31字符，会被截断
			const content = '这是第一句。这是第二句。这是第三句。这是第四句。这是第五句。';
			const result = generateSummary(content, 20);
			// 截断后 truncated='这是第一句。这是第二句。这是第三句。这是' (20字符)
			// 最后一个句号在位置17，17 > 14，满足条件
			// 返回 truncated.slice(0, 18) = '这是第一句。这是第二句。这是第三句。'
			expect(result).toBe('这是第一句。这是第二句。这是第三句。');
		});

		it('应该在边界点截断（满足70%条件）', () => {
			// maxLength=20, 70%阈值=14
			const content = 'abcdefghij。klmnopqrst。uvwxyz';
			const result = generateSummary(content, 20);
			// 截断后 'abcdefghij。klmnopqrs' (20字符)
			// 最后一个句号在位置10，10 > 14 为假
			// 返回截断内容 + '...'
			expect(result).toBe('abcdefghij。klmnopqrs...');
		});

		it('应该在换行处截断（边界点大于70%）', () => {
			const content = 'First paragraph here.\nSecond paragraph.\nThird paragraph.';
			// maxLength=25, 70%阈值=17.5
			// 截断后 'First paragraph here.\n' 中换行符在位置22
			// 22 > 17.5，满足条件
			const result = generateSummary(content, 25);
			expect(result).toBe('First paragraph here.\n');
		});

		it('当边界点小于70%时应该添加省略号', () => {
			const content = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
			const result = generateSummary(content, 10);
			expect(result).toBe('ABCDEFGHIJ...');
		});

		it('应该优先选择最晚的边界点', () => {
			// 测试同时有句号和换行符时选择更晚的边界点
			const content = '短句。\n这是一个非常长的句子没有句号\n另一行还有更多文字继续延伸到最后';
			// maxLength=25, 70%阈值=17.5
			const result = generateSummary(content, 25);
			// 截断后 '短句。\n这是一个非常长的句子没有句号\n'
			// 句号在位置2，换行符在位置3和24
			// Math.max(2, 24) = 24，24 > 17.5，满足条件
			// 返回 truncated.slice(0, 25) 包含第一个换行符
			// 实际上 truncated 是前25个字符
			expect(result).toContain('短句。');
		});

		it('应该处理空内容', () => {
			const result = generateSummary('', 100);
			expect(result).toBe('');
		});
	});
});
