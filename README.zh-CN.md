<div align="center">

# PaperRouter

**给 Zotero 用的智能分类器——用向量相似度或 LLM zero-shot 把论文分配到对的收藏夹。**

[English](./README.md) · [简体中文](./README.zh-CN.md)

![PaperRouter 收藏夹对话框](assets/screenshot.png)

</div>

---

## 是什么

PaperRouter 是一个 Zotero 7–9 插件。选中一篇文献，打开对话框，它会按语义相关度给所有收藏夹打分，每条都附带置信度（`Conf:`）。确认或调整后一键归类。

它也会**从你的反馈学习**：被你拒掉的收藏夹会在之后的推荐里被降权或拉入黑名单。

## 核心功能

- **两种算法** — 向量余弦相似度（便宜、快）或 LLM zero-shot 分类（慢一点，但更精准）
- **置信度评分** — 每个收藏夹都标了 `Conf:` 分数，一眼看清模型有多确定
- **反馈感知排序** — 拒掉的收藏夹下次会被惩罚或黑名单
- **层级感知** — 理解父/子收藏夹关系，避免重复推荐子节点
- **快速搜索** — 对话框内按关键词过滤和高亮
- **可配置上限** — 限制单个条目最多归属几个收藏夹（默认 4）
- **后台预计算** — 启动时刷新向量缓存，对话框秒开
- **多语言界面** — English / 简体中文 / 繁體中文，可自动跟随系统

## 工作原理

PaperRouter 用条目标题（有摘要时也带上）和每个收藏夹名称之间的语义相似度做匹配，可选两条路径：

1. **向量余弦相似度** — 调 Embedding API 算向量夹角，再叠加 IDF 权重和层级深度惩罚
2. **LLM Zero-shot 分类** — 把全部收藏夹名一次性塞给 LLM，解析它返回的排序和置信度

## 环境要求

- [Zotero](https://www.zotero.org/) **7.x – 9.x**
- 至少一个受支持的 provider 的 API key：
  - **LLM**：OpenAI · Anthropic (Claude) · Gemini · OpenRouter · Cohere · 自定义（任何 OpenAI 兼容端点）
  - **Embedding**：OpenAI · Cohere · 自定义（OpenAI 兼容）

两侧互相独立——你可以只用 embedding、只用 LLM、或者都用。

## 安装

1. 从 [Releases](../../releases) 下载最新 `paperrouter-*.xpi`（也可直接用本仓库 `dist/paperrouter-0.0.1.xpi`）
2. Zotero：**工具 → 插件 → ⚙️ → 从文件安装插件…**
3. 选中 `.xpi`，重启 Zotero

### 从源码构建

```bash
npm ci
npm test                  # 跑 unit + integration 测试
./scripts/build-xpi.sh    # 产物在 dist/paperrouter-<version>.xpi
```

## 配置

1. 打开 **编辑 → 设置 → PaperRouter**
2. 至少配好一侧：
   - **Embedding** — 选 provider，填 API Key，挑（或手动输入）模型名，点 **Test**
   - **LLM** — 同上
3. 每个 provider 的 API Key 和模型名独立保存——切换 provider 不会冲掉其它已保存的配置

## 使用

- **右键**任意条目 → **发送到分类…**
- 或者点击 Zotero 工具栏里的 **PaperRouter 图标**

对话框里：

- 预先勾选的是该条目已归属的收藏夹（粗体红色）
- 拖动**阈值滑块**过滤低置信度的推荐
- 点 **Retry** 让模型带着你的反馈重新排序，点 **OK** 确认归类

## 版本说明

这个公开仓库是**对外发行版**线，从 **v0.0.1** 起步（对应内部 `3.0.6` 构建）。内部迭代日志不在这里；公开的 [CHANGELOG.md](./CHANGELOG.md) 同步留存了完整的变更历史，方便追溯。

## 许可证

[MPL-2.0](./LICENSE)。
