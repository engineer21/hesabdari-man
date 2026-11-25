/**
 * cPanel-safe build:
 * - اگر dist از قبل در بسته باشد → موفق (بدون Vite)
 * - اگر سورس فرانت موجود باشد → vite build
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distIndex = path.join(root, 'dist', 'index.html');
const srcIndex = path.join(root, 'index.html');

if (fs.existsSync(distIndex)) {
  console.log('dist/ آماده است — نیازی به build روی سرور نیست.');
  process.exit(0);
}

if (!fs.existsSync(srcIndex)) {
  console.error(`
✗ خروجی dist و فایل index.html پیدا نشد.

روی cPanel:
  1) بستهٔ pack:cpanel را آپلود کنید (داخلش پوشهٔ dist هست)
  2) دستور Build را خالی بگذارید یا همین npm run build را بزنید
  3) فقط این را اجرا کنید: npm ci --omit=dev
  4) Startup file = start.js سپس Restart

پوشهٔ فعلی: ${root}
`);
  process.exit(1);
}

console.log('→ vite build');
const r = spawnSync('npx', ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
