/* global Chart — 由 index.html 中的 Chart.js UMD 提供 */
import { buildReleaseHistorySvg } from "./shared/chart-svg.mjs";

const Chart = window.Chart;

/** 最近一次成功加载的数据，用于导出 SVG */
let lastExport = null;

/**
 * 分页拉取仓库下全部 releases（不含 draft）
 */
async function fetchAllReleases(owner, repo) {
  const releases = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (res.status === 404) {
      throw new Error("仓库不存在或未公开，或路径错误。");
    }
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      throw new Error(
        remaining === "0"
          ? "GitHub API 速率限制：未登录约 60 次/小时。请稍后再试或使用带 Token 的请求。"
          : `请求被拒绝 (403)。${await res.text()}`
      );
    }
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      if (r.draft || !r.published_at) continue;
      releases.push(r);
    }

    if (batch.length < perPage) break;
    page += 1;
  }

  return releases;
}

/**
 * 从 tag 名解析语义化版本（支持 v 前缀；无 patch 时视为 .0）
 */
function parseSemver(tag) {
  if (!tag || typeof tag !== "string") return null;
  const raw = tag.trim().replace(/^v/i, "");
  let m = raw.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (m) return semverParts(+m[1], +m[2], +m[3]);
  m = raw.match(/^(\d+)\.(\d+)(?:[^.\d]|$)/);
  if (m) return semverParts(+m[1], +m[2], 0);
  return null;
}

function semverParts(major, minor, patch) {
  return {
    major,
    minor,
    patch,
    num: major * 1_000_000 + minor * 1_000 + patch,
    str: `${major}.${minor}.${patch}`,
  };
}

function semverNumToLabel(n) {
  if (n == null || Number.isNaN(n)) return "";
  const major = Math.floor(n / 1_000_000);
  const minor = Math.floor((n % 1_000_000) / 1_000);
  const patch = n % 1_000;
  return `${major}.${minor}.${patch}`;
}

/**
 * 按发布时间升序：累积数量 + 版本号（无法解析的 tag 沿用上一次成功解析的版本）
 */
function buildSeries(releases) {
  const sorted = [...releases].sort(
    (a, b) => new Date(a.published_at) - new Date(b.published_at)
  );

  let lastSemver = null;
  return sorted.map((r, i) => {
    const tag = r.tag_name || r.name || `#${i + 1}`;
    const sv = parseSemver(tag);
    if (sv) lastSemver = sv;

    return {
      x: new Date(r.published_at),
      countY: i + 1,
      tag,
      semverParsed: sv,
      versionY: lastSemver ? lastSemver.num : NaN,
      versionLabel: lastSemver ? lastSemver.str : "",
    };
  });
}

let chartInstance = null;

function renderChart(points, owner, repo) {
  const ctx = document.getElementById("chart");
  if (chartInstance) {
    chartInstance.destroy();
  }

  const countData = points.map((p) => ({
    x: p.x,
    y: p.countY,
    tag: p.tag,
  }));
  const versionData = points.map((p) => ({
    x: p.x,
    y: p.versionY,
    tag: p.tag,
    versionLabel: p.versionLabel,
  }));

  const parsedTags = points.filter((p) => p.semverParsed).length;
  const hasVersionLine = points.some((p) => !Number.isNaN(p.versionY));

  const datasets = [
    {
      label: "累积 Release 数",
      yAxisID: "y",
      data: countData,
      borderColor: "#58a6ff",
      backgroundColor: "rgba(88, 166, 255, 0.12)",
      fill: true,
      tension: 0.2,
      parsing: { xAxisKey: "x", yAxisKey: "y" },
    },
  ];
  if (hasVersionLine) {
    datasets.push({
      label: "语义化版本号",
      yAxisID: "y1",
      data: versionData,
      borderColor: "#a371f7",
      backgroundColor: "rgba(163, 113, 247, 0.08)",
      fill: false,
      tension: 0.15,
      spanGaps: false,
      parsing: { xAxisKey: "x", yAxisKey: "y" },
    });
  }

  const scales = {
    x: {
      type: "time",
      time: { tooltipFormat: "yyyy-MM-dd HH:mm" },
      grid: { color: "#30363d55" },
      ticks: { color: "#8b949e", maxRotation: 45 },
    },
    y: {
      id: "y",
      position: "left",
      beginAtZero: true,
      grid: { color: "#30363d55" },
      ticks: { color: "#8b949e" },
      title: {
        display: true,
        text: "累积数量",
        color: "#8b949e",
        font: { size: 11 },
      },
    },
  };
  if (hasVersionLine) {
    scales.y1 = {
      id: "y1",
      position: "right",
      grid: { drawOnChartArea: false },
      ticks: {
        color: "#c9a8ff",
        callback: (value) => semverNumToLabel(value),
      },
      title: {
        display: true,
        text: "版本号 (major.minor.patch)",
        color: "#c9a8ff",
        font: { size: 11 },
      },
    };
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          labels: { color: "#8b949e" },
        },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0].dataIndex;
              return points[i]?.x?.toLocaleString?.() ?? "";
            },
            label(ctx) {
              const p = points[ctx.dataIndex];
              if (ctx.datasetIndex === 0) {
                const lines = [`累积: ${ctx.parsed.y}`];
                if (p?.tag) lines.push(`标签: ${p.tag}`);
                return lines;
              }
              if (Number.isNaN(ctx.parsed.y)) {
                return "版本: （此前无可用 x.y.z 式 tag）";
              }
              const lines = [`版本: ${p.versionLabel || semverNumToLabel(ctx.parsed.y)}`];
              if (p?.tag) lines.push(`标签: ${p.tag}`);
              return lines;
            },
          },
        },
      },
      scales,
    },
  });

  const verHint =
    parsedTags === 0
      ? "；未能从 tag 中解析 x.y.z 版本号，紫线可能为空"
      : `；其中 ${parsedTags} 个 tag 可解析为语义化版本`;
  document.getElementById("meta").textContent =
    `${owner}/${repo} · 共 ${points.length} 个已发布 Release（不含草稿）${verHint}`;
}

function showError(msg) {
  const el = document.getElementById("err");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  const el = document.getElementById("err");
  el.textContent = "";
  el.classList.add("hidden");
}

/** 去掉 .git 后缀 */
function stripGitSuffix(segment) {
  return segment.replace(/\.git$/i, "");
}

/**
 * 支持：owner/repo、https://github.com/owner/repo、github.com/owner/repo
 */
function parseRepoRef(raw) {
  const s = raw.trim();
  if (!s) {
    return { error: "请填写仓库：owner/repo 或 GitHub 仓库链接。" };
  }

  const urlMatch = s.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s#?]+)\/([^\/\s#?]+)/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: stripGitSuffix(urlMatch[2]),
    };
  }

  const compact = s.replace(/^\/+/, "");
  const short = compact.match(/^([^\/\s]+)\/([^\/\s]+)$/);
  if (short) {
    return {
      owner: short[1],
      repo: stripGitSuffix(short[2]),
    };
  }

  return {
    error:
      "无法识别。请使用「owner/repo」或粘贴「https://github.com/owner/repo」形式的链接。",
  };
}

function readQuery() {
  const q = new URLSearchParams(window.location.search);
  const ref =
    q.get("ref")?.trim() ||
    q.get("q")?.trim() ||
    q.get("repo")?.trim();
  if (ref && ref.includes("/")) {
    return { ref };
  }
  const owner = q.get("owner")?.trim();
  const repo = q.get("repo")?.trim();
  if (owner && repo) {
    return { ref: `${owner}/${repo}` };
  }
  return { ref: ref || "" };
}

function writeQuery(ref) {
  const u = new URL(window.location.href);
  u.searchParams.delete("owner");
  u.searchParams.delete("repo");
  u.searchParams.delete("q");
  u.searchParams.set("ref", ref);
  window.history.replaceState({}, "", u);
}

async function load() {
  const refRaw = document.getElementById("ref").value;
  const parsed = parseRepoRef(refRaw);
  if (parsed.error) {
    showError(parsed.error);
    return;
  }
  const { owner: ownerIn, repo: repoIn } = parsed;

  clearError();
  const btn = document.getElementById("load");
  btn.disabled = true;
  document.getElementById("meta").textContent = "加载中…";

  try {
    const releases = await fetchAllReleases(ownerIn, repoIn);
    if (releases.length === 0) {
      lastExport = null;
      setExportEnabled(false);
      document.getElementById("meta").textContent = `${ownerIn}/${repoIn} · 没有已发布的 Release`;
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }

    const points = buildSeries(releases);
    const refForUrl = `${ownerIn}/${repoIn}`;
    document.getElementById("ref").value = refForUrl;
    writeQuery(refForUrl);
    renderChart(points, ownerIn, repoIn);
    lastExport = { points, owner: ownerIn, repo: repoIn };
    setExportEnabled(true);
  } catch (e) {
    lastExport = null;
    setExportEnabled(false);
    showError(e.message || String(e));
    document.getElementById("meta").textContent = "";
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  } finally {
    btn.disabled = false;
  }
}

function setExportEnabled(on) {
  const btn = document.getElementById("exportSvg");
  if (btn) btn.disabled = !on;
}

function downloadSvg() {
  if (!lastExport) return;
  const slim = lastExport.points.map((p) => ({
    x: p.x,
    countY: p.countY,
    versionY: p.versionY,
  }));
  const svg = buildReleaseHistorySvg(
    slim,
    lastExport.owner,
    lastExport.repo
  );
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `release-history-${lastExport.owner}-${lastExport.repo}.svg`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("load").addEventListener("click", load);
document.getElementById("exportSvg")?.addEventListener("click", downloadSvg);
document.getElementById("ref").addEventListener("keydown", (e) => {
  if (e.key === "Enter") load();
});

setExportEnabled(false);

const { ref: qRef } = readQuery();
if (qRef) document.getElementById("ref").value = qRef;
if (qRef) load();
