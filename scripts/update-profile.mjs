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
const colors = { NONE: '#192630', FIRST_QUARTILE: '#164c49', SECOND_QUARTILE: '#247e70', THIRD_QUARTILE: '#38b49a', FOURTH_QUARTILE: '#72e6bc' };
const updated = new Date().toISOString().slice(0, 10);
const portrait = (await readFile(new URL('../assets/portrait.txt', import.meta.url), 'utf8')).trimEnd().split('\n');
const stats = [
  ['CONTRIBUTIONS', calendar.totalContributions],
  ['COMMITS', activity.totalCommitContributions],
  ['PULL REQUESTS', activity.totalPullRequestContributions],
  ['REVIEWS', activity.totalPullRequestReviewContributions],
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720" role="img" aria-labelledby="title desc">
<title id="title">${escape(profile.name || login)} — GitHub profile</title>
<desc id="desc">ML/AI Platform Engineer. ${number(calendar.totalContributions)} contributions over the past 12 months. Updated ${updated}.</desc>
<style>
text { font-family: 'DejaVu Sans Mono', 'SFMono-Regular', Consolas, monospace; }
.body { fill: #d2dce6; font-size: 16px; }
.muted { fill: #93a6b7; font-size: 13px; }
.label { fill: #72e6bc; font-size: 14px; }
.heading { fill: #eff5fa; font-size: 30px; font-weight: 700; }
.value { fill: #eff5fa; font-size: 32px; font-weight: 700; }
.ascii { fill: #b9cbd7; font-size: 5.7px; white-space: pre; }
</style>
<rect x="1" y="1" width="958" height="718" rx="18" fill="#0d141c" stroke="#2b3946"/>
<path d="M1 52H959" stroke="#2b3946"/>
<circle cx="25" cy="27" r="5" fill="#ff7b72"/><circle cx="44" cy="27" r="5" fill="#e3b341"/><circle cx="63" cy="27" r="5" fill="#72e6bc"/>
${text(91, 32, `${login} / README`, 'muted')}
${text(925, 32, 'PROFILE.SYS', 'muted', 'text-anchor="end"')}
${portrait.map((line, i) => text(48, 76 + i * 4.05, line, 'ascii', 'xml:space="preserve"')).join('\n')}
${text(36, 295, '$ whoami', 'label')}
${text(36, 321, 'build · measure · refine', 'muted')}
<path d="M298 85V327" stroke="#2b3946"/>
${text(330, 110, profile.name || login, 'heading')}
${text(330, 142, 'ML/AI Platform Engineer', 'label')}
${text(330, 185, 'Making production systems behave.')}
${text(330, 212, 'Clean abstractions. Fast feedback loops.', 'muted')}
${text(330, 260, 'focus', 'label')}${text(435, 260, 'ML/AI Ops, AI platform')}
${text(330, 288, 'github', 'label')}${text(435, 288, `@${login}`)}
<path d="M35 351H925" stroke="#2b3946"/>
${text(36, 382, '$ activity --last-12-months', 'label')}
${stats.map(([label, count], index) => {
  const x = 36 + index * 226;
  return `<rect x="${x}" y="400" width="210" height="87" rx="8" fill="#121e28"/>${text(x + 16, 425, label, 'muted')}${text(x + 16, 465, number(count), 'value')}`;
}).join('\n')}
${text(36, 526, 'CONTRIBUTION HISTORY', 'muted')}
${calendar.weeks.map((week, index) => week.contributionDays.map(day => `<rect x="${36 + index * 16.7}" y="${545 + day.weekday * 16}" width="13" height="13" rx="3" fill="${colors[day.contributionLevel]}"><title>${escape(day.date)}: ${day.contributionCount} contributions</title></rect>`).join('')).join('\n')}
${text(36, 691, `Updated ${updated} UTC · refreshes nightly`, 'muted')}
${text(925, 691, 'Less', 'muted', 'text-anchor="end" transform="translate(-161 0)"')}
${Object.values(colors).map((color, index) => `<rect x="${780 + index * 17}" y="680" width="12" height="12" rx="2" fill="${color}"/>`).join('')}
${text(925, 691, 'More', 'muted', 'text-anchor="end"')}
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
