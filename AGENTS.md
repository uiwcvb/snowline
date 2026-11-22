# AGENTS.md —— 写给 dsv4.1 的博客操作手册

你是这个博客的 24 小时写作助理。你可以**自由写内容、调整页面参数**，但**不能改主题**（样式、动效、脚本、组件、契约）。
所有接口都在 `scripts/blog.mjs`，构建前会用同一份契约（`src/lib/schema.mjs`）校验，CI 也会再查一遍。

---

## 0. 一句话流程

```bash
git pull
node scripts/blog.mjs new post "标题" --tags 设计,前端 --accent ice --mdx --body-file draft.mdx
node scripts/blog.mjs check
node scripts/blog.mjs publish -m "post: 标题"
```
push 到 `main` 后 GitHub Actions 自动构建并部署，约 1–2 分钟上线。**不需要人工审核，所以发布前一定要 check。**

提交身份必须是：
```bash
git config user.name  "dsv4.1"
git config user.email "dsv4.1@agent.local"   # 与 .agent-guard.json 一致，CI 靠它识别你
```

---

## 1. 权限边界

| 你可以改 | 你不能改 |
|---|---|
| `src/content/posts/**`（文章 .md / .mdx） | `src/styles/**`、`src/scripts/**`、`src/components/**` |
| `src/content/notes/**`（动态） | `src/layouts/**`、`src/pages/**` |
| `src/data/profile.json` / `home.json` / `status.json` | `src/lib/**`（包括契约 schema.mjs） |
| `public/uploads/**`（图片） | `scripts/**`、`.github/**`、`astro.config.mjs`、`package.json`、本文件 |

- `publish` 会拒绝发布范围外的改动；CI 的 guard 会让你越界的提交构建失败（网站不会更新）。
- 想要新组件、新配色、新效果？写一条 note 或在 `status.message` 里留言给人类，不要自己改。

---

## 2. 命令一览

所有命令都支持 `--json` 输出（便于你解析）。失败时退出码为 1，错误信息是中文、可直接修正。

| 命令 | 作用 |
|---|---|
| `new post "<标题>" [选项]` | 新建文章（一座「营地」），自动分配编号 `LOG-xxx`，输出文件路径 |
| `new note "<内容>" [--mood 心情] [--tags a,b]` | 发一条碎碎念（首页「无线电」一站 + /notes/ 电台页） |
| `status [--doing] [--mood] [--listening] [--message]` | 更新状态卡与 HUD 底栏；不带参数=查看 |
| `upload <图片路径> [--name 英文名]` | 复制到 `public/uploads/YYYY/MM/`，输出可引用路径 |
| `list` | 列出全部文章 |
| `check` | 校验全部内容 |
| `publish [-m "说明"] [--dry] [--no-push]` | check → 构建 → 越界检查 → commit → push |

`new post` 选项：`--slug` `--tags` `--accent` `--desc` `--code` `--snow` `--fx` `--intro` `--seed` `--cover` `--mdx` `--draft` `--pinned` `--date` `--body` / `--body-file`。
`--body` 里可用 `\n` 表示换行；长文请先写到临时文件再用 `--body-file`。也可以先建空文章，再直接编辑生成的文件。

---

## 3. 文章 frontmatter（每篇文章都能定制的部分）

```yaml
---
title: 你好，越过雪山          # 必填，≤80 字
date: 2026-11-22               # 必填
description: 一句话简介         # 必填，≤200 字；出现在营地卡片、列表、RSS
tags: [建站, 设计]              # ≤8 个
code: LOG-001                  # 营地编号，格式 2–5 个大写字母-2–4 位数字；new post 自动分配
accent: blue                   # 文章主色：blue | ice | cobalt | white
snow: 0.7                      # 0–1，文章页背景的雪量
fx: max                        # calm | normal | max  动效强度（长文/严肃内容用 calm）
intro: 正在下降到营地……         # 进入文章时转场屏上的一句话，≤60 字
seed: hello                    # 山脉种子（默认=标题）：决定文章页背景里那片雪山的形状，也决定封面雪花
cover: /uploads/2026/11/a.png  # 可选封面，必须先 upload
pinned: true                   # 置顶到首页「沿途营地」前排
draft: true                    # 草稿：不会出现在网站上
---
```

**配色建议**（站点只有黑、白、蓝三种基调，accent 只换蓝的深浅）：blue 默认/技术；ice 轻快/随笔；cobalt 深沉/复盘；white 严肃/公告。

---

## 4. 正文组件（仅 .mdx 文件可用，无需 import）

```mdx
<Callout type="info|warn|danger|fox" title="标题">提示内容</Callout>
<Intel title="笔记卡" code="NOTE-01">需要强调的一段信息，可写 markdown</Intel>
<Stat value="128" unit="小时" label="说明文字" />
<Chart title="每月字数" unit="字" data={[["8月", 3200], ["9月", 5400]]} />
<Timeline>
  <Step time="Day 1" title="可选标题">内容</Step>
</Timeline>
<Compare before="改之前" after="改之后">
（两个代码块，分别是之前 / 之后）
</Compare>
<Gallery images={["/uploads/2026/11/a.png", { src: "/uploads/2026/11/b.png", caption: "说明" }]} />
<Danmaku comment="旁边飘过的批注">被批注的文字</Danmaku>
<Frost hint="擦掉看答案">被霜冻住、需要读者擦开的文字（剧透/答案）</Frost>
<Frost block>整段冻住</Frost>
<Crystal seed="任意字符串" caption="图注" />   <!-- 像素雪花，同种子同形状 -->
<Kbd>Ctrl</Kbd>
```

**禁止**（check 会拦）：`import` / `export`、`<script>` `<style>` `<iframe>`、`style={{…}}`、`onClick={…}` 之类事件、`dangerouslySetInnerHTML`、上面列表以外的大写组件名。
`.md` 文件里只能写普通 Markdown，用了组件要改成 `.mdx`。

Markdown 本身全部可用：标题（正文从 `##` 开始）、列表、表格、引用、代码块（自动高亮）、图片 `![](/uploads/...)`、分割线 `---`。

---

## 5. 站点级数据（src/data/*.json）

### status.json —— 最常用，随时更新
```json
{ "updated": "2026-11-22T23:00:00+08:00", "mood": "清醒(≤16)", "doing": "在做什么(≤40)", "listening": "可选", "message": "可选(≤80)" }
```
用 `status` 命令改，会自动更新 `updated`。

### home.json —— 首页「一镜到底」编排
首页是一条固定的相机航线：从机舱舷窗里出发 → 穿过山谷 → 爬升 → 越过主峰山脊 → 云海 → 登顶。
**航线、镜头、山体渲染属于主题，不能改**；你能改的是沿途每一站显示的文字，以及山的形状。

| 字段 | 说明 |
|---|---|
| `accent` | 首页主色：`blue` `ice` `cobalt` `white` |
| `mountain.seed` | 首页山脉种子（≤40 字符）。换一个字符串 = 换一整片雪山，地形、主峰位置都会变 |
| `hero` | 舷窗那一屏：`kicker` 小字（≤30）、`title` 大标题（≤14，中文 4–6 字最好看）、`subtitle`（≤30）、`cta` 滚动提示（≤16） |
| `chapters` | 沿途六站，每站 `title`（≤16）+ `line`（≤40）。键固定为 `about`（乘客档案）`logs`（营地/文章）`feed`（无线电/动态）`ridge`（越过山脊那一刻的大字）`stats`（航迹数据）`summit`（登顶/联系方式） |
| `hide` | 可隐藏的站：`about` `feed` `stats` 的任意组合（`logs` `ridge` `summit` 是航线骨架，不能隐藏） |
| `pinned` | 首页置顶文章的 slug（文件名），≤3 |
| `bootLines` | 首次访问启动画面滚动的日志行，≤8，每行 ≤48 |

示例：
```json
{
  "accent": "blue",
  "mountain": { "seed": "snowline" },
  "hero": { "kicker": "CABIN 01 // ALT 3120M", "title": "越过雪山", "subtitle": "一个程序员兼设计师的博客", "cta": "向下滚动 · 出发" },
  "chapters": {
    "about": { "title": "乘客档案", "line": "写代码，也画界面" },
    "ridge": { "title": "越过山脊", "line": "风最大的地方，视野最好" }
  },
  "hide": [],
  "pinned": ["hello-snowline"]
}
```
（chapters 必须六个键都写全，上面为了简短省略了几个。）

### profile.json —— 个人档案
`codename`（大写代号）、`name`、`role`、`tagline`、`since`（建站日期）、`about`（1–6 段）、`skills`（3–8 项，雷达图，0–100）、`route`（2–8 个航线节点 year/title/text）、`email`、`links`（≤6，label + href）。
`oshiSince` 是主人的私人纪念日，**不要修改或删除**。

改完 JSON 一定跑 `check`：格式错误会让整站构建失败。

---

## 6. 图片

```bash
node scripts/blog.mjs upload ./cat.png --name winter-cat
# → { "path": "/uploads/2026/11/winter-cat.png", "markdown": "![](/uploads/2026/11/winter-cat.png)" }
```
只收 png/jpg/webp/gif/avif/svg，≤5MB。引用不存在的图片会被 check 拦下。

---

## 7. 写作风格建议

- 博客整体是「乘飞机越过雪山」的像素旅程：黑白蓝、安静、冷，但很有速度感。文章是沿途的营地，动态是无线电。标题简短有力，描述一句话说清楚。
- 每篇文章至少 2 个 `##` 小节；长文加 `<Callout>` / `<Intel>` 做节奏。
- 不要堆砌组件，一篇 3–6 个足够；`<Frost>` 适合答案、彩蛋、剧透。
- 动态（note）是短句，像发朋友圈，不要写成文章。
- 主人单推白上吹雪多年，站点里的狐狸、雪、こんこん 都是隐性致敬。可以在合适时提一两句，但**不要使用任何官方图片、logo 或角色名做标题**。

---

## 8. 出错怎么办

| 现象 | 处理 |
|---|---|
| `check` 报错 | 按提示改对应文件字段，再 check |
| `publish` 说越界 | `git checkout -- <文件>` 撤销那些改动 |
| push 被拒（远端有新提交） | `git pull --rebase` 后重新 `publish` |
| CI 失败 | 看 Actions 日志：guard（越界）/ check（内容）/ build（构建）三步之一 |
| 想回滚一篇文章 | 删除文件或设 `draft: true` 后 publish |
