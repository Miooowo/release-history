/**
 * 与 main.js 中逻辑一致的示例（可在 Node 18+ 直接 node test.js owner repo 试跑）
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    for (const r of batch) {
      if (r.draft || !r.published_at) continue;
      releases.push(r);
    }
    if (batch.length < perPage) break;
    page += 1;
  }
  return releases;
}

function parseSemver(tag) {
  if (!tag || typeof tag !== "string") return null;
  const raw = tag.trim().replace(/^v/i, "");
  let m = raw.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (m) return { str: `${m[1]}.${m[2]}.${m[3]}`, num: +m[1] * 1e6 + +m[2] * 1e3 + +m[3] };
  m = raw.match(/^(\d+)\.(\d+)(?:[^.\d]|$)/);
  if (m) return { str: `${m[1]}.${m[2]}.0`, num: +m[1] * 1e6 + +m[2] * 1e3 };
  return null;
}

function buildSeries(releases) {
  const sorted = [...releases].sort(
    (a, b) => new Date(a.published_at) - new Date(b.published_at)
  );
  let last = null;
  return sorted.map((r, i) => {
    const tag = r.tag_name || r.name || `#${i + 1}`;
    const sv = parseSemver(tag);
    if (sv) last = sv;
    return {
      x: new Date(r.published_at).toISOString(),
      countY: i + 1,
      tag,
      versionLabel: last ? last.str : "",
      versionNum: last ? last.num : null,
    };
  });
}

const owner = process.argv[2] || "microsoft";
const repo = process.argv[3] || "vscode";

fetchAllReleases(owner, repo)
  .then((r) => {
    const data = buildSeries(r);
    console.log(
      JSON.stringify(
        {
          count: data.length,
          sample: data.slice(0, 3),
          tail: data.slice(-2),
        },
        null,
        2
      )
    );

  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
