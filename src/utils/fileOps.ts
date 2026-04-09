import { TFile, Vault } from 'obsidian';

/**
 * 文件操作工具
 */
export const fileOps = {
	/**
	 * 构建分类路径
	 */
	buildCategoryPath(category: string, inboxFolder: string): string {
		// 将分类路径中的 "/" 转换为 Vault 中的文件夹分隔符
		const normalizedCategory = category.replace(/\//g, '/');
		return `${inboxFolder}/${normalizedCategory}`;
	},
	
	/**
	 * 移动文件到目标路径
	 */
	async moveFile(file: TFile, newFolderPath: string): Promise<TFile> {
		try {
			const vault = file.vault;
			const adapter = vault.adapter;
			
			// 确保目标文件夹存在（处理竞态条件）
			try {
				if (!await adapter.exists(newFolderPath)) {
					await vault.createFolder(newFolderPath);
				}
			} catch (folderError: unknown) {
				// 如果文件夹已存在，忽略错误
				const errorMsg = (folderError as { message?: string })?.message || '';
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
				
				if (!(newFile instanceof TFile)) {
					throw new Error('移动后无法找到文件');
				}
				
				return newFile;
			}
			
			// 执行移动
			await vault.rename(file, newPath);
			
			// 返回新的文件引用
			const newFile = vault.getAbstractFileByPath(newPath);
			
			if (!(newFile instanceof TFile)) {
				throw new Error('移动后无法找到文件');
			}
			
			return newFile;
		} catch (e) {
			const error = e as Error;
			console.error('移动文件失败:', error);
			throw new Error(`移动文件失败: ${error.message}`);
		}
	},
	
	/**
	 * 获取文件名（不含扩展名）
	 */
	getBasename(file: TFile): string {
		return file.basename;
	},
	
	/**
	 * 检查文件是否存在于指定路径
	 */
	async exists(vault: Vault, path: string): Promise<boolean> {
		return await vault.adapter.exists(path);
	},
	
	/**
	 * 确保文件夹存在，不存在则创建
	 */
	async ensureFolder(vault: Vault, folderPath: string): Promise<boolean> {
		try {
			if (!await vault.adapter.exists(folderPath)) {
				await vault.createFolder(folderPath);
				return true; // 返回 true 表示新创建了文件夹
			}
			return false; // 返回 false 表示文件夹已存在
		} catch (e) {
			console.error('创建文件夹失败:', e);
			throw e;
		}
	},
};
