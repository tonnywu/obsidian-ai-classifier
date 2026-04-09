import { t } from './i18n';
import { App, Modal, Notice } from 'obsidian';

// 声明全局 app 变量
declare const app: App;

/**
 * 分类树节点数据结构
 */
export interface CategoryNode {
	name: string;
	children?: CategoryNode[];
}

/**
 * 分类树节点类型
 */
export interface CategoryTreeNode {
	[key: string]: CategoryTreeNode | true | boolean;
}

/**
 * 分类树可视化组件
 */
export class CategoryTreeView {
	private containerEl: HTMLElement;
	private tree: CategoryTreeNode;
	private onChange: (tree: CategoryTreeNode) => void;
	private expandedNodes: Set<string> = new Set();

	constructor(
		containerEl: HTMLElement,
		tree: CategoryTreeNode,
		onChange: (tree: CategoryTreeNode) => void
	) {
		this.containerEl = containerEl;
		this.tree = JSON.parse(JSON.stringify(tree)); // 深拷贝
		this.onChange = onChange;
		this.render();
	}

	/**
	 * 渲染整个树
	 */
	private render(): void {
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
	private renderTreeLevel(
		container: HTMLElement,
		node: CategoryTreeNode,
		path: string
	): void {
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
					} else {
						this.expandedNodes.add(currentPath);
					}
					this.render();
				});
			} else {
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
	private addTopLevelCategory(): void {
		this.showPromptModal(
			t('settings.enterCategoryName'),
			'',
			(name) => {
				if (this.tree[name]) {
					new Notice(t('settings.categoryExists'));
					return;
				}
				this.tree[name] = {};
				this.notifyChange();
			}
		);
	}

	/**
	 * 添加子分类
	 */
	private addChildCategory(parentPath: string): void {
		this.showPromptModal(
			t('settings.enterCategoryName'),
			'',
			(name) => {
				const parent = this.getNodeByPath(parentPath);
				if (!parent) return;

				if (parent[name]) {
					new Notice(t('settings.categoryExists'));
					return;
				}

				parent[name] = {};
				this.expandedNodes.add(parentPath);
				this.notifyChange();
			}
		);
	}

	/**
	 * 编辑节点名称
	 */
	private editNode(path: string, oldName: string): void {
		this.showPromptModal(
			t('settings.enterNewName'),
			oldName,
			(newName) => {
				if (!newName || newName.trim() === '' || newName === oldName) return;

				const pathParts = path.split('/');
				const parentPath = pathParts.slice(0, -1).join('/');
				const parent = parentPath ? this.getNodeByPath(parentPath) : this.tree;

				if (!parent) return;

				if (parent[newName]) {
					new Notice(t('settings.categoryExists'));
					return;
				}

				// 重命名
				parent[newName] = parent[oldName];
				delete parent[oldName];

				this.notifyChange();
			}
		);
	}

	/**
	 * 删除节点
	 */
	private deleteNode(path: string, name: string, hasChildren: boolean): void {
		const message = hasChildren
			? t('settings.confirmDeleteWithChildren')
			: t('settings.confirmDelete');

		this.showConfirmModal(message, () => {
			const pathParts = path.split('/');
			const parentPath = pathParts.slice(0, -1).join('/');
			const parent = parentPath ? this.getNodeByPath(parentPath) : this.tree;

			if (!parent) return;

			delete parent[name];
			this.notifyChange();
		});
	}

	/**
	 * 根据路径获取节点
	 */
	private getNodeByPath(path: string): CategoryTreeNode | null {
		const parts = path.split('/');
		let current: CategoryTreeNode = this.tree;

		for (const part of parts) {
			const child = current[part];
			if (!child || typeof child !== 'object') {
				return null;
			}
			current = child;
		}

		return current;
	}

	/**
	 * 通知外部树已更新
	 */
	private notifyChange(): void {
		this.onChange(this.tree);
		this.render();
	}

	/**
	 * 更新树数据（外部调用）
	 */
	updateTree(newTree: CategoryTreeNode): void {
		this.tree = JSON.parse(JSON.stringify(newTree));
		this.render();
	}

	/**
	 * 显示输入对话框
	 */
	private showPromptModal(
		placeholder: string,
		defaultValue: string,
		onSubmit: (value: string) => void
	): void {
		const modal = new InputModal(
			placeholder,
			defaultValue,
			onSubmit
		);
		modal.open();
	}

	/**
	 * 显示确认对话框
	 */
	private showConfirmModal(
		message: string,
		onConfirm: () => void
	): void {
		const modal = new ConfirmModal(
			message,
			onConfirm
		);
		modal.open();
	}
}

/**
 * 输入对话框
 */
class InputModal extends Modal {
	private placeholder: string;
	private defaultValue: string;
	private onSubmit: (value: string) => void;

	constructor(
		placeholder: string,
		defaultValue: string,
		onSubmit: (value: string) => void
	) {
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
			value: this.defaultValue,
			cls: 'modal-input'
		});

		// 监听回车键
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.onSubmit(input.value);
				this.close();
			}
		});

		const buttonsEl = contentEl.createDiv('modal-button-container');

		const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = buttonsEl.createEl('button', {
			text: 'Confirm',
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
class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;

	constructor(
		message: string,
		onConfirm: () => void
	) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('p', { text: this.message });

		const buttonsEl = contentEl.createDiv('modal-button-container');

		const cancelBtn = buttonsEl.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = buttonsEl.createEl('button', {
			text: 'Confirm',
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
}
