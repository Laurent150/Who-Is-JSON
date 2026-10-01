// Download pinned public source bytes. Never import or execute corpus files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const manifest = require('./live-bilingual-cases.json');
const dir = path.resolve(__dirname, '../.runtime/bilingual-corpus');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function download(repo, commit, file, destination, expectedHash) {
  if (fs.existsSync(destination) && hash(fs.readFileSync(destination)) === expectedHash) return;
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${file}`;
  const response = await fetch(url, {signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== expectedHash) throw Error(`Source hash mismatch: ${repo}/${file}`);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, bytes);
}
(async () => {
  fs.mkdirSync(dir, {recursive: true});
  for (const repo of manifest.repos) {
    const target = path.join(dir, repo.repo.replace('/', '--'));
    await download(repo.repo, repo.commit, repo.license, path.join(target, 'LICENSE.upstream'), repo.licenseSha256);
    if (repo.notice) await download(repo.repo, repo.commit, repo.notice, path.join(target, 'NOTICE.upstream'), repo.noticeSha256);
  }
  for (const sample of manifest.cases) {
    await download(sample.repo, sample.commit, sample.file, path.join(dir, sample.local), sample.sha256);
    console.log(sample.id, sample.language, sample.task);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Verified ${manifest.cases.length} pinned source files; none executed.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
