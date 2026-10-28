#!/usr/bin/env node
/**
 * Run the passive security-review module against a configurable website URL.
 *
 * Usage:
 *   npm run test:security-review
 *   npm run test:security-review -- --url=https://next-baersupply.vercel.app
 *   npm run test:security-review -- --url=https://qa-baersupply.vercel.app --fail-on=none
 *   ENV=production npm run test:security-review
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const ARG_TO_ENV = {
  url: 'SECURITY_REVIEW_BASE_URL',
  'fail-on': 'SECURITY_REVIEW_FAIL_ON',
  'max-pages': 'SECURITY_REVIEW_MAX_PAGES',
  'max-scripts': 'SECURITY_REVIEW_MAX_SCRIPTS',
  paths: 'SECURITY_REVIEW_PATHS',
  json: 'SECURITY_REVIEW_JSON',
  html: 'SECURITY_REVIEW_HTML',
};

const playwrightArgs = [];
const env = {
  ...process.env,
  PW_CHANNEL: process.env.PW_CHANNEL || 'chrome',
};
let headed = false;
let openReport = false;

for (const arg of process.argv.slice(2)) {
  if (arg === '--headed' || arg === '--headed=true') {
    headed = true;
    continue;
  }
  if (arg === '--headless' || arg === '--headless=true') {
    env.HEADLESS = 'true';
    env.HEADED = '0';
    continue;
  }
  if (arg === '--open') {
    openReport = true;
    continue;
  }

  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) {
    const [, name, value] = match;
    if (name in ARG_TO_ENV) {
      env[ARG_TO_ENV[name]] = value;
      if (name === 'url') env.BASE_URL = value;
      continue;
    }
  }

  playwrightArgs.push(arg);
}

if (headed) {
  env.HEADED = '1';
  env.HEADLESS = 'false';
  playwrightArgs.push('--headed');
} else if (!env.HEADLESS && !env.HEADED) {
  env.HEADLESS = 'true';
}

if (env.SECURITY_REVIEW_BASE_URL && !env.BASE_URL) {
  env.BASE_URL = env.SECURITY_REVIEW_BASE_URL;
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'playwright',
    'test',
    '--config=playwright.security-review.config.ts',
    '--project=chromium',
    '--workers=1',
    '--retries=0',
    ...playwrightArgs,
  ],
  {
    cwd: root,
    env,
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  if (openReport) {
    const html = path.resolve(root, env.SECURITY_REVIEW_HTML || 'reports/security-review.html');
    spawn('open', [html], { stdio: 'ignore', detached: true }).unref();
  }
  process.exit(code ?? 1);
});
