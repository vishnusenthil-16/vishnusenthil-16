import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const login = process.env.PROFILE_USERNAME || 'vishnusenthil-16';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error('Set GH_TOKEN or GITHUB_TOKEN to read GitHub contribution data.');

async function api(path, body) {
  const response = await fetch(`https://api.github.com/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub ${path}: HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors) throw new Error(`GitHub GraphQL: ${result.errors.map(e => e.message).join('; ')}`);
  return result;
}

const query = `query($login: String!) {
  user(login: $login) {
    name
    contributionsCollection {
      startedAt endedAt
      totalCommitContributions totalPullRequestContributions
      totalIssueContributions totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel weekday } }
      }
    }
  }
}`;
const result = await api('graphql', { query, variables: { login } });
if (!result.data?.user) throw new Error(`GitHub user not found: ${login}`);
const profile = result.data.user;
const activity = profile.contributionsCollection;
const calendar = activity.contributionCalendar;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const number = value => new Intl.NumberFormat('en-US').format(value);
const text = (x, y, value, cls = 'body', extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${escape(value)}</text>`;
const updated = new Date().toISOString().slice(0, 10);
const weeks = calendar.weeks.map(week => ({
  date: week.contributionDays[0].date,
  count: week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0),
}));
const maximum = Math.max(1, ...weeks.map(week => week.count));
const chartWidth = 850;
const step = chartWidth / weeks.length;
const stats = [
  ['CONTRIBUTIONS', calendar.totalContributions],
  ['COMMITS', activity.totalCommitContributions],
  ['PULL REQUESTS', activity.totalPullRequestContributions],
  ['REVIEWS', activity.totalPullRequestReviewContributions],
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="690" viewBox="0 0 960 690" role="img" aria-labelledby="title desc">
<title id="title">${escape(profile.name || login)} — ML/AI Platform Engineer</title>
<desc id="desc">Focus: ML/AI Ops and AI platform. ${number(calendar.totalContributions)} GitHub contributions in the last 12 months. A weekly contribution bar chart. Updated ${updated}.</desc>
<style>
text { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.name { fill: #202823; font-size: 102px; font-weight: 800; letter-spacing: -6px; }
.body { fill: #202823; font-size: 25px; letter-spacing: -.5px; }
.micro { fill: #596159; font-family: 'DejaVu Sans Mono', monospace; font-size: 12px; letter-spacing: .5px; }
.value { fill: #202823; font-size: 43px; font-weight: 500; letter-spacing: -2px; }
.dark-label { fill: #bec6ba; font-family: 'DejaVu Sans Mono', monospace; font-size: 12px; }
.axis { fill: #a0ac9e; font-family: 'DejaVu Sans Mono', monospace; font-size: 11px; }
</style>
<rect width="960" height="690" fill="#f0efe6"/>
<rect x="40" y="35" width="10" height="10" fill="#dc5b36"/>
${text(62, 45, `@${login}`, 'micro')}
${text(918, 45, 'ML/AI PLATFORM ENGINEER', 'micro', 'text-anchor="end"')}
<path d="M40 65H920" stroke="#c8cbbf"/>
${text(36, 162, 'VISHNU', 'name')}
${text(36, 253, 'SENTHIL', 'name')}
<path d="M625 102V249" stroke="#dc5b36" stroke-width="2"/>
${text(654, 123, 'FOCUS', 'micro')}
${text(654, 167, 'ML/AI Ops', 'body')}
${text(654, 204, 'AI platform', 'body')}
<path d="M40 288H920" stroke="#c8cbbf"/>
${stats.map(([label, count], index) => {
  const x = 40 + index * 225;
  return `${index ? `<path d="M${x - 20} 315V374" stroke="#c8cbbf"/>` : ''}${text(x, 345, number(count), 'value')}${text(x, 373, label, 'micro')}`;
}).join('')}
<rect y="410" width="960" height="280" fill="#202823"/>
${text(40, 446, 'WEEKLY CONTRIBUTIONS', 'dark-label')}
${text(920, 446, 'LAST 12 MONTHS', 'dark-label', 'text-anchor="end"')}
<path d="M65 483H920 M65 533H920 M65 583H920" stroke="#3a453b" stroke-width=".6"/>
${text(49, 487, number(maximum), 'axis', 'text-anchor="end"')}
${text(49, 587, '0', 'axis', 'text-anchor="end"')}
${weeks.map((week, i) => {
  const height = week.count / maximum * 100;
  return `<rect x="${65 + i * step}" y="${583 - height}" width="${step - 4}" height="${height}" fill="${week.count === maximum ? '#f2bd83' : '#de7653'}"><title>Week of ${week.date}: ${week.count} contributions</title></rect>`;
}).join('')}
${weeks.map((week, i) => {
  const month = week.date.slice(0, 7);
  if (i === 0 || weeks[i - 1].date.slice(0, 7) === month) return '';
  if (i > weeks.length - 3) return '';
  const label = new Date(`${week.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  return text(65 + i * step, 607, label, 'axis');
}).join('')}
<path d="M40 635H920" stroke="#445044"/>
${text(40, 663, `UPDATED ${updated} UTC`, 'dark-label')}
${text(920, 663, 'REFRESHED NIGHTLY', 'dark-label', 'text-anchor="end"')}
</svg>\n`;
await mkdir('assets', { recursive: true });
// Write only after all requests and rendering succeed: failed refreshes keep the last good card.
const readme = await readFile('README.md', 'utf8');
const version = createHash('sha256').update(svg).digest('hex').slice(0, 12);
const refreshedReadme = readme.replace(/src="\.\/assets\/profile(?:-[a-f0-9]{12})?\.svg(?:\?v=[a-f0-9]+)?"/, `src="./assets/profile-${version}.svg"`);
if (refreshedReadme === readme && !readme.includes(`profile-${version}.svg`)) {
  throw new Error('README profile image reference was not found.');
}
await writeFile(`assets/profile-${version}.svg`, svg);
await writeFile('README.md', refreshedReadme);
for (const name of await readdir('assets')) {
  if (/^profile(?:-[a-f0-9]{12})?\.svg$/.test(name) && name !== `profile-${version}.svg`) {
    await unlink(`assets/${name}`);
  }
}
console.log(`Updated profile for ${login}: ${calendar.totalContributions} contributions.`);
