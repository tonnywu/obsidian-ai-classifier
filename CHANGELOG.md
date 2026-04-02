# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-03

### Added

#### AI 智能分类核心功能
- AI 自动分析文章标题和内容,理解主题
- 从自定义分类树中选择最合适的分类
- 支持 Ollama 本地模型 (Llama, Qwen, Mistral 等)
- 支持 OpenAI API (GPT-4, DeepSeek, Moonshot, 智谱等)
- 批量分类 Inbox 文件夹
- 可视化分类树编辑器
- 置信度评分系统
- 低置信度结果请求用户确认

#### 错误处理增强
- 自动重试机制 (指数退避,最多 3 次)
- 网络超时控制 (默认 30 秒)
- 用户友好的错误消息,包含解决建议
- 配置验证 (启动前检查 API Key/URL)
- 连接测试功能

#### 文件操作改进
- 文件冲突自动处理 (添加数字后缀)
- 文件夹创建并发保护
- 详细日志记录
- 安全文件移动 (失败自动回滚)

#### 用户界面
- 命令面板快速访问
- 右键菜单集成
- 编辑器菜单集成
- 实时通知显示分类进度

#### 文档与示例
- 完整 README (中英文)
- 3 个示例配置文件
  - 技术博客分类
  - 个人知识管理
  - 学术论文管理
- 故障排除指南
- 最佳实践建议

### Security
- API Key 本地安全存储
- Ollama 完全本地运行,数据不上传
- 无第三方数据收集

### Known Issues
- 暂不支持撤销分类操作
- 批量处理无进度条显示
- 仅支持 .md 和 .txt 文件
- 不支持实时监听自动分类

## [Unreleased]

### Planned for v0.2.0
- 分类历史记录
- 撤销分类操作
- 批量处理进度条
- 多语言支持 (i18n)
- 性能优化

### Planned for v0.3.0+
- 自动标签生成
- 分类规则引擎 (关键词、正则匹配)
- 统计面板 (分类数量、准确率等)
- 实时监听自动分类
- 分类建议模式 (不自动移动文件)
- 自定义分类提示词

### Considering
- 支持更多文件类型 (PDF, DOCX)
- 批量重命名功能
- 分类模板库
- 团队协作功能
- 云端同步分类配置

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-04-03 | 首次发布,核心功能完整 |

---

## Migration Guide

### Upgrading to 0.1.0

这是首个版本,无需迁移。

如果你之前使用过测试版本,建议:
1. 删除旧配置文件
2. 重新配置 AI 提供商
3. 重新定义分类树

---

**[View all releases](https://github.com/tonnywu/obsidian-ai-classifier/releases)**
