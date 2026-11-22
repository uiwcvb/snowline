# SNOWLINE · 越过雪山

一个程序员兼设计师的像素风博客。黑、白、蓝三色，Fusion Pixel 像素字体。
首页是一镜到底：镜头从机舱舷窗里出发，飞出窗外，穿过山谷、爬升、越过主峰山脊，落进云海，最后登顶。
整片雪山由一个低分辨率 Canvas 实时渲染（Bayer 抖动 + 分层山脊），所有动效都读同一个 `world` 状态，牵一发而动全身。

## 能感知的交互

| 你做什么 | 网站怎么回应 |
|---|---|
| 滚动 | 相机沿航线飞行；越快 FOV 越宽、雪花拉成速度线、画面横向撕裂；越过山脊时白闪 + 冲击波 + 提示 |
| 移动鼠标 / 手指 | 镜头视差与侧倾；在舷窗阶段可以擦掉玻璃上的雾 |
| 点击 | 冲击波环 + 雪崩烟尘 + 像素碎片 |
| 右侧航线条 | 显示当前位置，点任意一站直接飞过去 |
| 打字（任意键） | 每个字母变成一片雪落下 |
| 输入 `konkon` / 手机长按左上角 | 一只白狐沿山脊跑过，带着狐火 |
| 切走再回来 | 「你离开了…山上又落了 N cm 雪」 |
| 手机倾斜 | 改变风向 |
| 再次访问 | 记住登机次数，启动序列变短 |
| 风声按钮 | 实时合成的风声，跟速度联动（默认静音） |
| 文章页 | 每篇文章都有自己的一片雪山（由 `seed` 决定），阅读进度推动镜头前进 |

系统开启「减少动态效果」时，撕裂、抖动和闪光会自动关闭。

## 开发

```bash
npm install
npm run dev        # http://localhost:4321
npm run build
npm run check      # 内容契约校验
```

## 目录

```
src/content/posts   文章（md / mdx）      ← agent 可写
src/content/notes   动态                  ← agent 可写
src/data/*.json     档案 / 首页编排 / 状态 ← agent 可写
public/uploads      图片                  ← agent 可写
src/lib/schema.mjs  内容契约（唯一真相）
src/scripts         引擎：engine 像素渲染 / stage 首页航线 / read 文章页 / sense 感知 / hud / audio / transition
src/components/mdx  正文组件
scripts/blog.mjs    写作 CLI（给 dsv4.1）
scripts/guard.mjs   越界检查
```

AI 助理的操作手册见 [AGENTS.md](AGENTS.md)。

## 部署（GitHub Pages，push 即上线）

1. 在 GitHub 新建仓库，然后：
   ```bash
   git init -b main && git add -A && git commit -m "init SNOWLINE"
   git remote add origin git@github.com:<你>/<仓库>.git && git push -u origin main
   ```
2. 打开仓库 Settings → Pages → Source，选 **GitHub Actions**。
3. 以后每次 push 到 `main`：guard → check → build → deploy 自动执行。`SITE` / `BASE` 由 Pages 自动注入，`user.github.io/仓库名` 这种子路径也能用。
4. 给 dsv4.1 的云电脑配一个只有这个仓库写权限的 deploy key 或 fine-grained token，并设置 `git config user.email dsv4.1@agent.local`。
5. 想防止 agent 直接改 `.github` 或 `scripts`，可以在 Settings → Rules 里给这些路径加保护。CI 的 guard 已经会让越界提交构建失败。

## 字体与版权

- 像素字体：[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)（12px 等宽，SIL OFL 1.1，许可见 `public/fonts/OFL.txt`）。
- 所有图形均为代码实时生成，不含任何第三方角色或官方图片。
