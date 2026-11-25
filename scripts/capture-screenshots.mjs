/**
 * Capture brochure screenshots from the running dev server.
 * Usage: npm run dev (separate terminal) then npm run screenshots
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'screenshots');
const BASE = process.env.SCREENSHOT_BASE || 'http://127.0.0.1:3000';

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

/** @type {{ name: string; viewport: typeof DESKTOP; setup: (page: import('playwright').Page) => Promise<void> }[]} */
const SHOTS = [
  {
    name: 'dashboard',
    viewport: DESKTOP,
    setup: async () => {},
  },
  {
    name: 'income',
    viewport: MOBILE,
    setup: async (page) => {
      await page.getByRole('button', { name: 'درآمد', exact: true }).click();
    },
  },
  {
    name: 'expense',
    viewport: MOBILE,
    setup: async (page) => {
      await page.getByRole('button', { name: 'هزینه', exact: true }).click();
    },
  },
  {
    name: 'banks',
    viewport: MOBILE,
    setup: async (page) => {
      await page.getByRole('button', { name: 'بیشتر' }).click();
      await page.getByRole('button', { name: 'بانک‌ها' }).click();
    },
  },
  {
    name: 'persons',
    viewport: MOBILE,
    setup: async (page) => {
      await page.getByRole('button', { name: 'بیشتر' }).click();
      await page.getByRole('button', { name: 'اشخاص' }).click();
    },
  },
  {
    name: 'reports',
    viewport: DESKTOP,
    setup: async (page) => {
      await page.getByRole('button', { name: 'گزارشات', exact: true }).click();
    },
  },
  {
    name: 'access',
    viewport: DESKTOP,
    setup: async (page) => {
      const sidebar = page.getByLabel('منوی اصلی');
      await sidebar.getByRole('button', { name: 'تنظیمات' }).click();
      await sidebar.getByRole('button', { name: 'دسترسی', exact: true }).click();
    },
  },
];

async function waitForServer(url, ms = 90000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server not reachable at ${url}`);
}

async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* try next */
    }
  }
  return chromium.launch();
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('button:has-text("ورود")', { timeout: 30000 });
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill('1111');
  await page.getByRole('button', { name: 'ورود' }).click();
  await page.waitForTimeout(1200);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let child = null;
  const reachable = await fetch(BASE).then(() => true).catch(() => false);
  if (!reachable) {
    child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000'], {
      cwd: ROOT,
      shell: true,
      stdio: 'ignore',
    });
    await waitForServer(BASE);
  }

  const browser = await launchBrowser();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  await login(page);

  for (const shot of SHOTS) {
    await page.setViewportSize(shot.viewport);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await shot.setup(page);
    await page.waitForTimeout(900);
    const pngPath = path.join(OUT_DIR, `${shot.name}.png`);
    await page.locator('#root').screenshot({ path: pngPath });
    console.log('Captured', shot.name);
  }

  await browser.close();
  if (child) child.kill();

  console.log('Done — screenshots in public/screenshots/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
