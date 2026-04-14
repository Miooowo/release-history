![:name](https://count.getloli.com/@release-history?name=release-history&theme=booru-helltaker&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=auto)
# Release History

本地页面：用 GitHub Releases 画「累积发布数 + 语义化版本」曲线（交互图在 `index.html`）。

## 和 star-history 的差别

[star-history](https://star-history.com) 通过 **`https://api.star-history.com/svg?...`** 这类**固定图片地址**生成 SVG，README 里用普通 `![](...)` 即可，图会随对方服务更新。

本仓库没有中央 API，要让 README 里的图**自动更新**，常见做法是：**在仓库里放一张 SVG，用 GitHub Actions 定期或在发版时重新生成并提交**（本仓库已提供脚本与工作流）。

## 把图放进 README（推荐：Actions 更新 SVG）

1. 将下列文件放进**你要展示的那个仓库**（例如你的模组根目录）：
   - `.github/workflows/update-release-chart.yml`
   - `scripts/gen-release-chart-svg.mjs`
   - `shared/chart-svg.mjs`
2. 推送后，在 GitHub 打开 **Actions → Update release chart SVG → Run workflow** 跑一次，会生成 `docs/release-chart.svg`。
3. 在 README 里引用 **raw 地址**（把 `OWNER`、`REPO`、`BRANCH` 换成你的）：

```markdown
## Release History

![Release History](https://raw.githubusercontent.com/OWNER/REPO/BRANCH/docs/release-chart.svg)
```

可选：带上链接到本页或仓库 Releases：

```markdown
[![Release History](https://raw.githubusercontent.com/OWNER/REPO/BRANCH/docs/release-chart.svg)](https://github.com/OWNER/REPO/releases)
```

工作流会在 **每周一**、**手动运行**、以及 **发布 Release** 时尝试更新 SVG（若曲线无变化则不会提交）。

### 本地生成 SVG

```bash
node scripts/gen-release-chart-svg.mjs OWNER REPO docs/release-chart.svg
```

若设置环境变量 `GITHUB_TOKEN`（或 `GH_TOKEN`），可减轻未授权 API 限速。

## 手动导出（不跑 Actions）

用浏览器打开 `index.html`，加载仓库后点 **「导出 SVG」**，把下载的文件放进仓库（例如 `docs/release-chart.svg`），再在 README 里用上面的 `raw.githubusercontent.com` 地址引用。之后每次发版可手动重新导出并提交。

## 许可证

MIT

## Star History

<a href="https://www.star-history.com/?repos=Miooowo%2Frelease-history&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Miooowo/release-history&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Miooowo/release-history&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Miooowo/release-history&type=date&legend=top-left" />
 </picture>
</a>
