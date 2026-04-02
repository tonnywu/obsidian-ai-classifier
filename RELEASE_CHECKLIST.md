# 发布检查清单

## ✅ v0.1.0 发布检查清单

**发布日期**: 2026-04-03  
**版本**: 0.1.0

---

## 📦 一、技术准备

### 代码质量
- [x] 版本号一致 (manifest.json 和 package.json 都是 0.1.0)
- [x] 构建验证: `npm run build` 无错误
- [x] 代码已提交到 Git
- [ ] 创建 Git Tag: `git tag v0.1.0`

### 功能测试
- [ ] **Ollama 连接测试**
  - [ ] 连接成功
  - [ ] 分类功能正常
  - [ ] 错误提示友好
  
- [ ] **OpenAI API 连接测试**
  - [ ] DeepSeek API 测试
  - [ ] OpenAI API 测试 (可选)
  - [ ] 错误处理测试
  
- [ ] **批量分类测试**
  - [ ] 单个文件分类
  - [ ] 多个文件批量分类
  - [ ] 低置信度确认流程
  
- [ ] **错误场景测试**
  - [ ] 断网情况
  - [ ] 错误的 API Key
  - [ ] 错误的 Ollama 地址
  - [ ] 文件冲突处理

### 跨平台测试
- [ ] macOS 测试 (你的开发环境)
- [ ] Windows 测试 (可选)
- [ ] Linux 测试 (可选)

### 文件完整性
- [x] `main.js` 存在且正常
- [x] `manifest.json` 存在且正确
- [x] `styles.css` 存在
- [x] `README.md` 完整
- [x] `RELEASE_NOTES.md` 创建完成
- [x] `CHANGELOG.md` 创建完成
- [x] LICENSE 文件存在 (MIT)
- [x] 示例配置文件齐全 (3 个)

---

## 📝 二、文档准备

### 核心文档
- [x] README.md 完整 (中英文)
- [x] RELEASE_NOTES.md 创建
- [x] CHANGELOG.md 创建
- [x] LICENSE 文件存在
- [x] 示例配置文件完整

### 作者信息更新
- [x] manifest.json 中的 `author` 更新为 `tonnywu`
- [x] manifest.json 中的 `authorUrl` 更新
- [x] README.md 中所有 GitHub 链接更新
- [x] README.md 底部作者署名更新

### 视觉材料 (待完成)
- [ ] **截图准备** (8 张)
  - [ ] 封面图 (1280x640px)
  - [ ] 分类前后对比图
  - [ ] 设置面板截图
  - [ ] 分类过程截图
  - [ ] 分类结果通知截图
  - [ ] Ollama 配置示例
  - [ ] API 配置示例
  - [ ] 错误提示示例
  
- [ ] **GIF 动图** (2-3 个)
  - [ ] 快速分类演示 (5-10 秒)
  - [ ] 分类树编辑器 (5 秒)
  - [ ] 批量处理演示 (8 秒)
  
- [ ] **演示视频** (2-3 分钟)
  - [ ] 录制视频
  - [ ] 后期剪辑
  - [ ] 上传到 YouTube/Bilibili
  - [ ] 添加字幕

---

## 🚀 三、GitHub 发布

### Repository 设置
- [ ] 确认所有更改已提交
- [ ] 推送到 GitHub: `git push origin main`
- [ ] 推送 Tags: `git push --tags`

### GitHub Release
- [ ] 访问 GitHub Releases 页面
- [ ] 点击 "Draft a new release"
- [ ] 选择 Tag: `v0.1.0`
- [ ] 填写标题: `v0.1.0 - 首次发布 🎉`
- [ ] 复制 RELEASE_NOTES.md 内容到描述
- [ ] 上传文件:
  - [ ] `main.js`
  - [ ] `manifest.json`
  - [ ] `styles.css`
- [ ] 发布 Release

### Repository 完善
- [ ] 添加 Topics: `obsidian`, `obsidian-plugin`, `ai`, `classifier`, `productivity`
- [ ] 设置 GitHub Pages (可选,用于演示视频)
- [ ] 创建 Issue Templates:
  - [ ] Bug 反馈模板
  - [ ] 功能建议模板
- [ ] 创建 Discussion 分类:
  - [ ] 公告
  - [ ] 功能建议
  - [ ] 问题讨论

---

## 🏪 四、Obsidian 社区提交

### 提交流程
- [ ] Fork [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
- [ ] 克隆 Fork 的仓库
- [ ] 编辑 `community-plugins.json`,添加:
  ```json
  {
    "id": "obsidian-ai-classifier",
    "name": "AI智能分类",
    "author": "tonnywu",
    "description": "Automatically organize your notes using AI. Supports Ollama (free, local) and OpenAI API.",
    "repo": "tonnywu/obsidian-ai-classifier"
  }
  ```
- [ ] 提交 PR
- [ ] 等待审核 (通常 1-3 天)

### PR 描述模板
```
## Plugin Name
AI Classifier (AI智能分类)

## Plugin Description
Automatically organize your notes using AI. Supports Ollama (free, local) and OpenAI API.

## Plugin Repository
https://github.com/tonnywu/obsidian-ai-classifier

## README
README is available in both Chinese and English.

## Key Features
- 🤖 AI-powered content analysis and classification
- 🌐 Supports Ollama (free, local) and OpenAI API (cloud)
- 📦 Batch process entire folders
- 🎨 Visual category tree editor
- 🔧 Smart error handling with retry and timeout
- 📁 Safe file operations with conflict handling

## Video Demo
[Link to demo video]

## Screenshots
[Include 3-5 key screenshots]

## Testing
This plugin has been tested on:
- macOS with Obsidian 1.5.x
- Ollama (llama3.2, qwen2.5)
- DeepSeek API

## License
MIT

## Author
tonnywu (https://github.com/tonnywu)
```

---

## 📢 五、营销推广

### 社交媒体
- [ ] **Twitter/X**
  - [ ] 准备推文文案
  - [ ] 准备截图/GIF
  - [ ] 发布推文
  
- [ ] **Reddit (r/ObsidianMD)**
  - [ ] 准备发帖文案
  - [ ] 发布帖子
  
- [ ] **中文社区**
  - [ ] 少数派发帖
  - [ ] V2EX 发帖
  - [ ] Obsidian 中文社区分享

### 产品平台 (可选)
- [ ] **Product Hunt**
  - [ ] 准备发布材料
  - [ ] 选择发布时间 (工作日早上)
  - [ ] 发布产品页面

---

## 🔍 六、发布后跟进

### 监控与反馈
- [ ] 监控 GitHub Issues
- [ ] 监控 GitHub Discussions
- [ ] 监控社交媒体反馈
- [ ] 记录用户建议和 Bug

### 快速响应
- [ ] 准备常见问题 FAQ
- [ ] 快速修复关键 Bug (如有)
- [ ] 回复用户评论和问题

### 数据收集
- [ ] 追踪下载量
- [ ] 收集用户反馈
- [ ] 记录功能建议
- [ ] 分析使用场景

---

## 📊 七、后续规划

### v0.2.0 计划
- [ ] 收集用户反馈
- [ ] 确定优先级最高的改进
- [ ] 开始开发新功能
- [ ] 预计发布时间: 2-3 周后

### 长期规划
- [ ] v0.3.0: 自动标签生成、分类规则引擎
- [ ] v0.4.0: 统计面板、实时监听
- [ ] v1.0.0: 功能完善、稳定版本

---

## 🎯 发布时间线

### Day 1 (今天) - 2026-04-03
- [x] 完成发布文档 (RELEASE_NOTES, CHANGELOG)
- [x] 更新作者信息
- [ ] 准备截图和 GIF (可选)
- [ ] 录制演示视频 (可选)

### Day 2 - 2026-04-04
- [ ] 创建 GitHub Release
- [ ] 提交 Obsidian 社区审核

### Day 3-5 - 2026-04-05 ~ 2026-04-07
- [ ] 等待审核通过
- [ ] 准备营销文案

### Day 5+ - 2026-04-08+
- [ ] 审核通过后立即发布
- [ ] 社交媒体推广
- [ ] 收集用户反馈

---

## 📋 快速命令参考

```bash
# 构建
npm run build

# 提交代码
git add .
git commit -m "chore: prepare for v0.1.0 release"
git push origin main

# 创建 Tag
git tag v0.1.0
git push --tags

# 检查文件
ls -la main.js manifest.json styles.css

# 验证 manifest
cat manifest.json | grep -E '"version"|"author"'
```

---

## ✨ 完成标准

发布准备完成的标志:
- ✅ 所有文档准备完毕
- ✅ GitHub Release 发布成功
- ✅ Obsidian 社区 PR 提交完成
- ✅ 营销材料准备就绪
- ✅ 监控机制就位

---

**祝发布顺利! 🎉**

Made with ❤️ by tonnywu
