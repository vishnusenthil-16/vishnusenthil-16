import { readFileSync, writeFileSync } from "node:fs";

const outputDir = "profile-summary-card-output/github_dark";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findLabel(svg, label) {
  const pattern = new RegExp(
    `<text x="21" y="([^"]+)" class="gpsc-item" style="--gpsc-i: (\\d+);[^"]*">${escapeRegex(label)}</text>`,
  );
  const match = svg.match(pattern);

  return match
    ? { node: match[0], y: match[1], index: Number(match[2]) }
    : null;
}

function removeRow(svg, label) {
  const row = findLabel(svg, label);

  if (!row) {
    return svg;
  }

  const y = escapeRegex(row.y);
  const icon = new RegExp(
    `<g class="gpsc-item" style="--gpsc-i: ${row.index};"><g transform="translate\\(0,[^"]+\\)" width="14" height="14" fill="[^"]+"><path [\\s\\S]*?</path></g></g>`,
  );
  const value = new RegExp(
    `<text x="(?:130|150)" y="${y}" class="gpsc-item" style="--gpsc-i: ${row.index};[^"]*">[^<]*</text>`,
  );

  if (!icon.test(svg)) {
    throw new Error(`Could not find the icon for "${label}"`);
  }

  return svg.replace(icon, "").replace(row.node, "").replace(value, "");
}

function moveRow(svg, label, index, iconY, textY) {
  const row = findLabel(svg, label);

  if (!row) {
    throw new Error(`Could not find "${label}"`);
  }

  const oldY = escapeRegex(row.y);
  const icon = new RegExp(
    `<g class="gpsc-item" style="--gpsc-i: ${row.index};"><g transform="translate\\(0,[^"]+\\)" width="14" height="14" fill="[^"]+">`,
  );
  const value = new RegExp(
    `<text x="(?:130|150)" y="${oldY}" class="gpsc-item" style="--gpsc-i: ${row.index};([^"]*)">`,
  );

  svg = svg.replace(
    icon,
    `<g class="gpsc-item" style="--gpsc-i: ${index};"><g transform="translate(0,${iconY})" width="14" height="14" fill="#8b949e">`,
  );
  svg = svg.replace(
    row.node,
    row.node
      .replace(`y="${row.y}"`, `y="${textY}"`)
      .replace(`--gpsc-i: ${row.index};`, `--gpsc-i: ${index};`),
  );
  svg = svg.replace(
    value,
    `<text x="150" y="${textY}" class="gpsc-item" style="--gpsc-i: ${index};$1">`,
  );

  return svg;
}

function customizeProfileDetails() {
  const path = `${outputDir}/0-profile-details.svg`;
  let svg = readFileSync(path, "utf8");

  svg = svg.replace(
    /(<text x="30" y="40" class="gpsc-item"[^>]*>)[^<]*(<\/text>)/,
    "$1vishnusenthil-16$2",
  );
  svg = removeRow(svg, "Joined GitHub 4 years ago");
  svg = moveRow(svg, "Shipt Inc.", 2, 56, 70);

  writeFileSync(path, svg);
}

function customizeStats() {
  const path = `${outputDir}/3-stats.svg`;
  let svg = readFileSync(path, "utf8");

  svg = removeRow(svg, "Total Stars:");
  svg = removeRow(svg, "Contributed to:");
  svg = moveRow(svg, "Total Commits:", 0, 0, 14);
  svg = moveRow(svg, "Total PRs:", 1, 50.4, 64.4);
  svg = moveRow(svg, "Total Issues:", 2, 100.8, 114.8);

  writeFileSync(path, svg);
}

customizeProfileDetails();
customizeStats();
