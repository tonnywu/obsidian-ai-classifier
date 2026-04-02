# Obsidian AI 智能分类插件

<div align="center">

**让 AI 帮你整理笔记，告别手动分类的烦恼**

[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22obsidian-ai-classifier%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=obsidian-ai-classifier)
[![GitHub stars](https://img.shields.io/github/stars/tonnywu/obsidian-ai-classifier?style=social)](https://github.com/tonnywu/obsidian-ai-classifier)

[English](#english) | 简体中文

</div>

---

## 🎯 解决什么问题？

你是否也有这样的困扰：

- ❌ **Inbox 文件堆积**：每天收集的文章越来越多，但整理起来费时费力
- ❌ **手动分类繁琐**：每次都要想"这篇文章该放哪个文件夹？"
- ❌ **分类标准不统一**：有时放在"前端"，有时放在"React"，混乱不堪
- ❌ **拖延整理**：因为太麻烦，Inbox 里的文件越来越多...

**这个插件就是为了解决这些问题而生的！**

---

## ✨ 核心特性

### 🤖 AI 智能分类
- **自动分析内容**：AI 会阅读文章标题和内容，理解主题
- **精准分类**：从你定义的分类树中选择最合适的分类
- **置信度评分**：告诉你对分类结果有多确信

### 🌐 双提供商支持
- **Ollama (本地)**：完全免费，隐私保护，支持 Llama、Qwen 等模型
- **OpenAI API**：云端服务，支持 GPT-4、DeepSeek、Kimi 等模型

### 📦 批量处理
- 一键分类整个 Inbox 文件夹
- 实时显示处理进度
- 低置信度结果自动请求确认

### 🎨 灵活配置
- 可视化分类树编辑器
- 自定义置信度阈值
- 选择是否自动移动文件

---

## 📸 效果演示

### 分类前
```
Inbox/
├── 如何用 React Hooks 优化性能.md
├── Docker 容器化最佳实践.md
├── 机器学习算法详解.md
└── ... (100+ 篇文章堆积)
```

### 分类后
```
Inbox/
├── 编程/
│   ├── 前端/
│   │   └── 如何用 React Hooks 优化性能.md
│   └── DevOps/
│       └── Docker 容器化最佳实践.md
└── AI & ML/
    └── 机器学习/
        └── 机器学习算法详解.md
```

---

## 🚀 快速开始

### 1️⃣ 安装插件

#### 方式一：社区市场（推荐）
1. 打开 Obsidian 设置 → 社区插件
2. 关闭"安全模式"
3. 浏览社区插件，搜索 "AI Classifier"
4. 点击安装并启用

#### 方式二：手动安装
```bash
# 下载最新版本
cd /path/to/your/vault/.obsidian/plugins/
git clone https://github.com/your-username/obsidian-ai-classifier.git
cd obsidian-ai-classifier
npm install
npm run build
```

然后在 Obsidian 中启用插件。

---

### 2️⃣ 配置 AI 服务

#### 选项 A：使用 Ollama（免费，本地）

**适合**：有本地 GPU、注重隐私、不想付费的用户

1. **安装 Ollama**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh
   
   # 或访问 https://ollama.com 下载
   ```

2. **下载模型**
   ```bash
   # 推荐模型（按效果排序）
   ollama pull llama3.2      # 最新 Llama 模型（推荐）
   ollama pull qwen2.5       # 阿里千问，中文效果好
   ollama pull mistral       # 欧洲开源模型
   ```

3. **配置插件**
   - 打开插件设置
   - AI 提供商选择 "Ollama"
   - 地址保持默认 `http://localhost:11434`
   - 模型填写你下载的模型名（如 `llama3.2`）

4. **测试连接**
   - 点击"测试连接"按钮
   - 看到"连接成功"即可开始使用

#### 选项 B：使用 OpenAI API（云端）

**适合**：追求最佳效果、愿意付费的用户

支持的 API 服务：
- **OpenAI**：GPT-4、GPT-3.5
- **DeepSeek**：性价比高，中文友好
- **Moonshot (Kimi)**：长文本支持
- **智谱 AI**：国产大模型

**配置步骤**：
1. 获取 API Key（从对应服务商官网）
2. 在插件设置中选择提供商
3. 填入 API Key
4. 选择模型（推荐 `gpt-4o-mini` 或 `deepseek-chat`）
5. 点击"测试连接"验证

**费用参考**：
| 服务商 | 模型 | 价格（每百万 Token） |
|--------|------|---------------------|
| OpenAI | GPT-4o-mini | ¥0.7 / ¥2.1 |
| DeepSeek | DeepSeek Chat | ¥0.1 / ¥0.2 |
| Moonshot | V1 8K | ¥0.8 / ¥2.0 |

> 💡 每篇文章约消耗 500-1000 tokens，分类 100 篇文章约花费 ¥0.05-0.5

---

### 3️⃣ 配置分类树

插件默认提供技术博客的分类模板：

```json
{
  "编程": {
    "前端": true,
    "后端": true,
    "移动端": true,
    "DevOps": true
  },
  "AI & ML": {
    "机器学习": true,
    "深度学习": true,
    "NLP": true
  },
  "数据": {
    "数据库": true,
    "数据工程": true
  },
  "架构": {
    "系统设计": true
  },
  "Other": true
}
```

**自定义分类树**：
1. 在设置面板中直接编辑
2. 添加/删除/重命名分类
3. 支持多层级嵌套
4. 点击"恢复默认"可重置

---

### 4️⃣ 开始使用

#### 方式一：分类 Inbox 文件夹
1. 将待分类文件放入 `Inbox` 文件夹
2. 按 `Cmd/Ctrl + P` 打开命令面板
3. 输入"AI智能分类"，选择"分类收件箱"
4. 等待处理完成

#### 方式二：分类当前文件
1. 打开任意笔记
2. 按 `Cmd/Ctrl + P` 打开命令面板
3. 选择"AI智能分类 - 分类当前文件"
4. 查看分类结果

#### 方式三：右键菜单
- 在文件管理器中右键文件 → "AI智能分类"
- 或在编辑器右上角菜单 → "AI智能分类"

---

## ⚙️ 高级设置

### 置信度阈值
- **默认值**：0.7 (70%)
- **作用**：AI 置信度低于此值时，会请求用户确认
- **建议**：
  - 追求准确：设为 0.8
  - 追求效率：设为 0.6

### 自动移动文件
- **开启**：分类后自动移动到对应文件夹
- **关闭**：仅显示分类建议，不移动文件

### 扫描子文件夹
- **开启**：递归扫描 Inbox 下所有子文件夹
- **关闭**：仅扫描 Inbox 顶层文件

---

## 📖 使用场景

### 场景一：技术博客收集者
```
每天收集 10+ 篇技术文章 → 每周整理一次 → 插件自动分类到：
编程/前端、编程/后端、AI/机器学习、数据/数据库...
```

### 场景二：个人知识管理
```
自定义分类树：
工作/
├── 项目管理
├── 技术方案
└── 会议记录
学习/
├── 读书笔记
├── 课程笔记
└── 技能提升
生活/
├── 健康管理
└── 财务规划
```

### 场景三：学术论文管理
```
按领域分类：
论文/
├── 机器学习/
│   ├── 监督学习
│   ├── 无监督学习
│   └── 强化学习
├── 计算机视觉/
└── 自然语言处理/
```

---

## 🎓 最佳实践

### ✅ DO
- ✅ **定义清晰的分类树**：每个分类要有明确的边界
- ✅ **定期回顾低置信度结果**：帮助改进 AI 判断
- ✅ **保持分类树精简**：建议不超过 3 层、20 个分类
- ✅ **备份重要文件**：虽然插件会安全移动，但备份总是好的

### ❌ DON'T
- ❌ **过度细分**：如"React Hooks"、"React Router" 分得太细
- ❌ **混合维度**：如同时用"前端"和"React"两个分类
- ❌ **忽略低置信度提示**：AI 也不确定时，人工确认更靠谱

---

## 🔧 故障排除

### 问题：Ollama 连接失败
```
解决步骤：
1. 确认 Ollama 正在运行：在终端输入 ollama list
2. 检查地址是否正确：默认 http://localhost:11434
3. 尝试重启 Ollama：ollama serve
4. 检查防火墙设置
```

### 问题：API Key 无效
```
解决步骤：
1. 检查 API Key 是否正确复制（没有多余空格）
2. 确认账户是否有余额
3. 对于 DeepSeek 等，检查是否开通了 API 服务
```

### 问题：分类结果不准确
```
解决步骤：
1. 尝试更强的模型（如 GPT-4o）
2. 调整置信度阈值
3. 简化分类树，避免模糊边界
4. 在 GitHub Issues 反馈具体案例
```

### 问题：处理速度慢
```
解决步骤：
1. Ollama：使用更小的模型或开启 GPU 加速
2. API：检查网络延迟，考虑使用国内 API（DeepSeek、Kimi）
3. 批量处理时减少单次文件数量
```

---

## ❓ 常见问题

**Q: 支持哪些文件类型？**
A: 目前支持 Markdown (`.md`) 和纯文本 (`.txt`) 文件。

**Q: 数据会上传到云端吗？**
A: 
- 使用 Ollama：完全本地运行，数据不上传
- 使用 API：文章内容会发送到对应服务商

**Q: 可以撤销分类吗？**
A: 当前版本暂不支持，建议先在测试库中试用。

**Q: 支持中文吗？**
A: 完全支持！推荐使用 Qwen、DeepSeek 等中文友好的模型。

**Q: 为什么有些分类结果很奇怪？**
A: AI 模型可能对某些领域不熟悉，建议：
1. 使用更强大的模型
2. 在分类树中添加更明确的描述
3. 反馈给我们改进提示词

---

## 🗺️ 功能路线图

### ✅ 已完成（v0.1.0）
- [x] AI 智能分类核心功能
- [x] Ollama + OpenAI 双提供商
- [x] 可视化分类树编辑器
- [x] 批量处理

### 🚧 进行中（v0.2.0）
- [ ] 分类历史与撤销
- [ ] 进度条显示
- [ ] 多语言支持

### 📅 计划中
- [ ] 自动标签生成
- [ ] 分类规则引擎
- [ ] 统计面板
- [ ] 自动分类（实时监听）

---

## 🤝 贡献指南

欢迎贡献代码、报告 Bug 或提出建议！

### 开发环境
```bash
git clone https://github.com/tonnywu/obsidian-ai-classifier.git
cd obsidian-ai-classifier
npm install
npm run dev  # 开发模式，自动监听文件变化
```

### 项目结构
```
src/
├── main.ts              # 插件入口
├── services/
│   ├── Classifier.ts    # 分类核心逻辑
│   ├── OllamaProvider.ts
│   └── OpenAIProvider.ts
├── commands/
│   └── ClassifyCommand.ts
├── settings/
│   ├── SettingsTab.ts   # 设置面板
│   └── CategoryTreeView.ts
└── utils/
    ├── fileOps.ts       # 文件操作
    └── errorHandler.ts  # 错误处理
```

### 提交 PR
1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

---

## 📄 许可证

MIT License - 自由使用、修改和分发

---

## 💬 社区与支持

- **Bug 反馈**：[GitHub Issues](https://github.com/tonnywu/obsidian-ai-classifier/issues)
- **功能建议**：[GitHub Discussions](https://github.com/tonnywu/obsidian-ai-classifier/discussions)
- **加入社区**：Obsidian 中文社区、少数派、V2EX

---

## 🙏 致谢

- [Obsidian](https://obsidian.md) - 强大的知识管理工具
- [Ollama](https://ollama.com) - 本地大模型运行工具
- [OpenAI](https://openai.com) - GPT 系列模型
- 所有贡献者和早期测试用户

---

<div align="center">

**如果这个插件帮到了你，请给一个 ⭐ Star 支持一下！**

Made with ❤️ by [tonnywu](https://github.com/tonnywu)

</div>

---

## English

### What problem does this solve?

**Obsidian AI Classifier** automatically organizes your notes using AI, so you don't have to manually sort files into folders anymore.

### Key Features
- 🤖 AI-powered content analysis and classification
- 🌐 Supports Ollama (free, local) and OpenAI API (cloud)
- 📦 Batch process entire folders
- 🎨 Visual category tree editor
- 🌍 Multi-language support (Chinese & English)

### Quick Start
1. Install from Obsidian Community Plugins
2. Configure AI provider (Ollama or OpenAI API)
3. Define your category tree
4. Run classification command

### Documentation
For detailed documentation in English, please visit [Wiki](https://github.com/tonnywu/obsidian-ai-classifier/wiki).

### License
MIT License
