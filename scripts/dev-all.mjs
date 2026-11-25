import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--watch', 'server/app.js'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: '3080' },
  }),
  spawn('npx', ['vite'], { stdio: 'inherit', shell: true }),
];

function shutdown() {
  for (const p of procs) {
    try {
      p.kill();
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
