/**
 * ساخت خروجی production و ZIP آمادهٔ آپلود روی cPanel
 * Usage: npm run pack:cpanel
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const stage = path.join(root, `.cpanel-pack-${stamp}`);
const outZip = path.join(root, `acc-mobile-cpanel-${stamp}.zip`);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) {
    cleanup();
    process.exit(r.status || 1);
  }
}

function cleanup() {
  try {
    fs.rmSync(stage, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === 'node_modules' || name === '.git') continue;
      if (/\.sqlite(-.*)?$/i.test(name)) continue;
      if (name === '.env' || name === '.env.local') continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('→ npm run build:vite');
run('npm', ['run', 'build:vite']);

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/index.html پیدا نشد؛ build ناموفق بود.');
  process.exit(1);
}

cleanup();
fs.mkdirSync(stage, { recursive: true });

const include = [
  'start.js',
  'package.json',
  'package-lock.json',
  '.env.example',
  'README-SERVER.md',
  'server',
  'dist',
  'public',
  'scripts/backup-db.js',
  'scripts/ensure-dist.mjs',
];

const keepEmpty = [
  'data/.gitkeep',
  'data/uploads/.gitkeep',
  'backups/.gitkeep',
  'backups/auto/.gitkeep',
  'backups/manual/.gitkeep',
  'backups/safety/.gitkeep',
];

for (const rel of include) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.warn('  رد شد (نیست):', rel);
    continue;
  }
  console.log('  +', rel);
  copyRecursive(abs, path.join(stage, rel));
}

for (const rel of keepEmpty) {
  const abs = path.join(root, rel);
  const dest = path.join(stage, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(abs)) fs.copyFileSync(abs, dest);
  else fs.writeFileSync(dest, '');
  console.log('  +', rel);
}

if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

console.log('→ ساخت ZIP…');
if (process.platform === 'win32') {
  run(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path (Join-Path '${stage.replace(/'/g, "''")}' '*') -DestinationPath '${outZip.replace(/'/g, "''")}' -Force`,
    ],
    { cwd: os.tmpdir() }
  );
} else {
  run('zip', ['-r', outZip, '.'], { cwd: stage });
}

cleanup();

const sizeMb = (fs.statSync(outZip).size / (1024 * 1024)).toFixed(2);
console.log(`✓ آماده: ${path.basename(outZip)} (${sizeMb} MB)`);
console.log('روی cPanel آپلود و استخراج کنید، سپس: npm ci --omit=dev و Restart');
