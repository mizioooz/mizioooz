import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const username = process.env.GITHUB_USERNAME || "mizioooz";
const privateToken = process.env.PROFILE_STATS_TOKEN;
const token = privateToken || process.env.GITHUB_TOKEN;
const includePrivate = Boolean(privateToken);
const outputDirectory = path.resolve("assets", "stats");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${username}-profile-stats`,
  "X-GitHub-Api-Version": "2022-11-28",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function github(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API ${response.status}: ${details.slice(0, 300)}`);
  }

  return response.json();
}

async function getOwnedRepositories() {
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const endpoint = includePrivate
      ? `/user/repos?visibility=all&affiliation=owner&sort=updated&per_page=100&page=${page}`
      : `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100&page=${page}`;
    const portion = await github(endpoint);
    repositories.push(
      ...portion.filter(
        (repository) =>
          repository.owner?.login?.toLowerCase() === username.toLowerCase(),
      ),
    );

    if (portion.length < 100) {
      return repositories;
    }
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function compactNumber(value) {
  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function svgDocument(content, height, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="${height}" viewBox="0 0 880 ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">Автоматически сформировано на основе актуальных данных GitHub.</desc>
  <defs>
    <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1117">
        <animate attributeName="stop-color" values="#0d1117;#17102b;#0d1117" dur="10s" repeatCount="indefinite"/>
      </stop>
      <stop offset="55%" stop-color="#131a27">
        <animate attributeName="stop-color" values="#131a27;#10243a;#131a27" dur="8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="#111827">
        <animate attributeName="stop-color" values="#111827;#0d2a25;#111827" dur="12s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6c5ce7"/>
      <stop offset="50%" stop-color="#00b4d8"/>
      <stop offset="100%" stop-color="#00d084"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="-0.35 0;0.35 0;-0.35 0" dur="6s" repeatCount="indefinite"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="878" height="${height - 2}" rx="22" fill="url(#surface)" stroke="#30363d"/>
  <ellipse cx="770" cy="30" rx="150" ry="85" fill="#6c5ce7" opacity=".13" filter="url(#glow)">
    <animate attributeName="opacity" values=".08;.22;.08" dur="7s" repeatCount="indefinite"/>
    <animate attributeName="cx" values="740;790;740" dur="11s" repeatCount="indefinite"/>
  </ellipse>
  <ellipse cx="120" cy="${height - 10}" rx="120" ry="55" fill="#00d084" opacity=".05" filter="url(#glow)">
    <animate attributeName="opacity" values=".03;.13;.03" dur="9s" repeatCount="indefinite"/>
  </ellipse>
  <rect x="28" y="26" width="72" height="4" rx="2" fill="url(#accent)">
    <animate attributeName="width" values="72;144;72" dur="5s" repeatCount="indefinite"/>
  </rect>
  ${content}
</svg>
`;
}

function createOverview(profile, repositories, commitCount, updatedAt) {
  const stars = repositories.reduce(
    (total, repository) => total + repository.stargazers_count,
    0,
  );
  const activeRepositories = repositories.filter((repository) => {
    const updated = new Date(repository.pushed_at || repository.updated_at);
    return updatedAt.getTime() - updated.getTime() <= 365 * 24 * 60 * 60 * 1000;
  }).length;

  const metrics = [
    ["Всего проектов", repositories.length],
    ["Коммиты", commitCount],
    ["Получено звёзд", stars],
    ["Активные за год", activeRepositories],
  ];

  const cards = metrics
    .map(([label, value], index) => {
      const x = 28 + index * 207;
      return `<g transform="translate(${x} 92)">
    <rect width="190" height="92" rx="15" fill="#161b22" stroke="#30363d"/>
    <text x="18" y="36" fill="#f0f6fc" font-family="Segoe UI,Arial,sans-serif" font-size="26" font-weight="700">${escapeXml(compactNumber(value))}</text>
    <text x="18" y="65" fill="#8b949e" font-family="Segoe UI,Arial,sans-serif" font-size="13">${escapeXml(label)}</text>
  </g>`;
    })
    .join("\n  ");

  const timestamp = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(updatedAt);

  return svgDocument(
    `<text x="28" y="62" fill="#f0f6fc" font-family="Segoe UI,Arial,sans-serif" font-size="23" font-weight="700">Dizarizago · GitHub</text>
  <text x="852" y="61" text-anchor="end" fill="#8b949e" font-family="Segoe UI,Arial,sans-serif" font-size="12">${escapeXml(timestamp)} МСК</text>
  ${cards}
  <text x="28" y="210" fill="#8b949e" font-family="Segoe UI,Arial,sans-serif" font-size="12">${includePrivate ? "Агрегировано по приватным и публичным репозиториям" : "Агрегировано по публичным репозиториям"} · без раскрытия доступа</text>`,
    232,
    `Статистика GitHub ${profile.login}`,
  );
}

const languageColors = {
  HTML: "#e34c26",
  CSS: "#1572b6",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Vue: "#41b883",
  SCSS: "#c6538c",
  Less: "#1d365d",
  Svelte: "#ff3e00",
  Astro: "#ff5d01",
  PHP: "#4f5d95",
};

function createLanguages(languageBytes, updatedAt) {
  const languages = [...languageBytes.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);
  const total = languages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;

  let barX = 28;
  const barWidth = 824;
  const barSegments = languages
    .map(([language, bytes], index) => {
      const width =
        index === languages.length - 1
          ? Math.max(0, 28 + barWidth - barX)
          : (bytes / total) * barWidth;
      const segment = `<rect x="${barX.toFixed(2)}" y="82" width="${width.toFixed(2)}" height="13" fill="${languageColors[language] || "#6c5ce7"}"/>`;
      barX += width;
      return segment;
    })
    .join("\n  ");

  const legend = languages
    .map(([language, bytes], index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 28 + column * 278;
      const y = 133 + row * 43;
      const percent = ((bytes / total) * 100).toFixed(1).replace(".", ",");
      return `<g transform="translate(${x} ${y})">
    <circle cx="7" cy="-4" r="6" fill="${languageColors[language] || "#6c5ce7"}"/>
    <text x="22" y="0" fill="#f0f6fc" font-family="Segoe UI,Arial,sans-serif" font-size="14" font-weight="600">${escapeXml(language)}</text>
    <text x="250" y="0" text-anchor="end" fill="#8b949e" font-family="Segoe UI,Arial,sans-serif" font-size="13">${percent}%</text>
  </g>`;
    })
    .join("\n  ");

  return svgDocument(
    `<text x="28" y="62" fill="#f0f6fc" font-family="Segoe UI,Arial,sans-serif" font-size="23" font-weight="700">Языки в веб-проектах</text>
  <rect x="28" y="82" width="824" height="13" rx="6.5" fill="#21262d"/>
  <clipPath id="languageBar"><rect x="28" y="82" width="824" height="13" rx="6.5"/></clipPath>
  <g clip-path="url(#languageBar)">
  ${barSegments}
  </g>
  ${legend}
  <text x="852" y="216" text-anchor="end" fill="#6e7681" font-family="Segoe UI,Arial,sans-serif" font-size="11">Обновляется в 00:00 и 12:00 МСК</text>`,
    238,
    "Языки в веб-проектах",
  );
}

async function main() {
  const [profile, repositories, commitSearch] = await Promise.all([
    github(`/users/${encodeURIComponent(username)}`),
    getOwnedRepositories(),
    github(`/search/commits?q=${encodeURIComponent(`author:${username}`)}&per_page=1`),
  ]);

  const sourceRepositories = repositories.filter(
    (repository) => !repository.fork && !repository.archived,
  );
  const languageReports = await Promise.all(
    sourceRepositories.map((repository) =>
      github(`/repos/${repository.full_name}/languages`),
    ),
  );
  const languageBytes = new Map();
  const webLanguages = new Set(Object.keys(languageColors));

  for (const report of languageReports) {
    for (const [language, bytes] of Object.entries(report)) {
      if (webLanguages.has(language)) {
        languageBytes.set(language, (languageBytes.get(language) || 0) + bytes);
      }
    }
  }

  const updatedAt = new Date();
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "overview.svg"),
      createOverview(profile, repositories, commitSearch.total_count, updatedAt),
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "languages.svg"),
      createLanguages(languageBytes, updatedAt),
      "utf8",
    ),
  ]);

  console.log(
    `Updated profile cards for ${username}: ${repositories.length} repositories, ${languageBytes.size} languages.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
