# v0.1.0 - 首次发布 🎉

**发布日期**: 2026-04-03

## ✨ 新功能

### 🤖 AI 智能分类
- **核心功能**: 使用 AI 自动分析文章内容并分类到对应文件夹
- **双提供商支持**: 
  - Ollama (本地免费,隐私保护)
  - OpenAI API (云端,GPT-4/DeepSeek/Kimi/智谱)
- **批量处理**: 一键分类整个 Inbox 文件夹
- **可视化分类树编辑器**: 直观配置分类体系
- **置信度评分**: AI 对每个分类结果给出置信度

### 🛡️ 错误处理增强
- **智能重试**: 网络失败自动重试(指数退避策略)
- **超时控制**: 防止长时间等待,默认 30 秒超时
- **友好提示**: 用户友好的错误消息,包含解决建议
- **配置验证**: 启动前检查 API Key/URL 有效性

### 📁 文件操作改进
- **冲突处理**: 自动处理文件重名,避免覆盖
- **竞态条件**: 文件夹创建并发保护
- **详细日志**: 操作过程可追溯,便于排查问题
- **安全移动**: 确保文件完整性,失败自动回滚

## 📖 文档与示例

- **完整 README**: 包含快速开始、故障排除、最佳实践
- **双语支持**: 中英文完整文档
- **示例配置**: 提供 3 个典型场景配置文件
  - 技术博客分类 (`examples/tech-blog-config.json`)
  - 个人知识管理 (`examples/personal-knowledge-config.json`)
  - 学术论文管理 (`examples/academic-papers-config.json`)

## 🔧 已知限制

- 仅支持 Markdown (.md) 和文本 (.txt) 文件
- 暂不支持分类历史与撤销
- 批量处理时无进度条显示(计划 v0.2.0)
- 不支持实时监听自动分类(计划 v0.3.0+)

## 📦 安装

### 方式一:社区插件市场
1. Obsidian 设置 → 社区插件
2. 关闭"安全模式"
3. 搜索 "AI Classifier" 或 "AI智能分类" → 安装

### 方式二:手动安装
```bash
cd /path/to/vault/.obsidian/plugins/
git clone https://github.com/tonnywu/obsidian-ai-classifier.git
cd obsidian-ai-classifier
npm install && npm run build
```

然后在 Obsidian 中启用插件。

## 🎯 快速开始

### 1. 配置 AI 服务

#### 使用 Ollama (免费,本地)
```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下载推荐模型
ollama pull llama3.2  # 或 qwen2.5, mistral
```

在插件设置中选择 "Ollama",地址 `http://localhost:11434`。

#### 使用 OpenAI API (云端)
获取 API Key (OpenAI / DeepSeek / Kimi / 智谱),填入设置即可。

### 2. 配置分类树
使用默认模板或自定义你的分类体系。

### 3. 开始分类
- 将文件放入 `Inbox` 文件夹
- 按 `Cmd/Ctrl + P` 打开命令面板
- 输入 "AI智能分类",选择"分类收件箱"

## 💰 费用参考

| 服务商 | 模型 | 价格(每百万 Token) |
|--------|------|-------------------|
| Ollama | llama3.2 | **免费** |
| DeepSeek | deepseek-chat | ¥0.1 / ¥0.2 |
| OpenAI | gpt-4o-mini | ¥0.7 / ¥2.1 |

> 每篇文章约消耗 500-1000 tokens,分类 100 篇文章约花费 ¥0.05-0.5 (使用 API 时)

## 🙏 致谢

感谢早期测试用户的反馈与建议!

特别感谢:
- [Obsidian](https://obsidian.md) - 强大的知识管理工具
- [Ollama](https://ollama.com) - 本地大模型运行工具
- [OpenAI](https://openai.com) - GPT 系列模型

## 📝 完整更新日志

见 [CHANGELOG.md](./CHANGELOG.md)

## 📚 相关链接

- **GitHub**: https://github.com/tonnywu/obsidian-ai-classifier
- **问题反馈**: https://github.com/tonnywu/obsidian-ai-classifier/issues
- **功能建议**: https://github.com/tonnywu/obsidian-ai-classifier/discussions

---

**如果这个插件帮到了你,请给一个 ⭐ Star 支持一下!**
