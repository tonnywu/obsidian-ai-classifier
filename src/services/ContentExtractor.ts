import { TFile } from 'obsidian';

/**
 * 从 Obsidian 文件中提取内容
 */
export class ContentExtractor {
	/**
	 * 提取文件内容（支持 Markdown 和纯文本）
	 */
	async extract(file: TFile): Promise<string | null> {
		try {
			// 对于外部链接文件，可能需要特殊处理
			if (file instanceof TFile) {
				const content = await file.vault.read(file);
				return this.cleanContent(content);
			}
			return null;
		} catch (e) {
			console.error('提取文件内容失败:', e);
			return null;
		}
	}
	
	/**
	 * 获取文件标题
	 */
	getTitle(file: TFile): string {
		// 优先使用文件名（不含扩展名）
		return file.basename;
	}
	
	/**
	 * 清理内容，移除不必要的部分
	 */
	private cleanContent(content: string): string {
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
	generateSummary(content: string, maxLength = 2000): string {
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
