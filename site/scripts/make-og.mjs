// Renders the social share image (public/og.png, 1200x630) and the
// apple-touch-icon (public/apple-touch-icon.png, 180x180) from Dotty itself.
//
// Run after building the package:  pnpm build && pnpm --filter dotty-botty-site og
// Uses your installed Chrome through playwright-core, so no browser download.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DottyBotty } from '../../packages/dotty-botty/dist/index.js';

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const bot = (props) => renderToStaticMarkup(h(DottyBotty, { followPointer: false, ...props }));

const friends = [
  { shape: 'cat', ink: '#2f6bff', spot: '#f4f8ff', expression: 'happy', x: 676, y: 62, size: 118 },
  { shape: 'bunny', ink: '#a78bfa', spot: '#1e1340', expression: 'neutral', x: 1036, y: 44, size: 112 },
  { shape: 'heart', ink: '#f43f5e', spot: '#ffffff', expression: 'calm', x: 1074, y: 270, size: 96 },
  { shape: 'bear', ink: '#3e7d4f', spot: '#f3f1e7', expression: 'surprised', x: 1022, y: 458, size: 116 },
  { shape: 'cloud', ink: '#38bdf8', spot: '#082f49', expression: 'sleepy', x: 668, y: 470, size: 108 },
  { shape: 'star', ink: '#ffc21a', spot: '#2a1d00', expression: 'inspecting', x: 640, y: 286, size: 84 },
];

const og = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0f0f12; color: #f2f1ee;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif; position: relative; }
  .copy { position: absolute; left: 72px; top: 72px; bottom: 64px; width: 560px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
  h1 { font-size: 132px; line-height: 0.95; letter-spacing: -0.045em; margin-top: 56px; }
  p { font-size: 44px; line-height: 1.12; letter-spacing: -0.02em; margin-top: 18px; color: #c9c7cf; font-weight: 600; }
  .foot { margin-top: auto; display: flex; gap: 14px; align-items: center; font-size: 24px; }
  .pill { white-space: nowrap; background: #000000; border: 1px solid rgba(255, 255, 255, 0.14); color: #f2efe8; border-radius: 14px; padding: 12px 18px;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 22px; }
  .url { white-space: nowrap; color: #a09fa6; font-weight: 600; }
  .hero { position: absolute; left: 744px; top: 150px; }
  .f { position: absolute; }
</style></head><body>
  <div class="copy">
    <div class="brand">${bot({ size: 40 })}<span>dotty-botty</span></div>
    <h1>Dotty</h1>
    <p>A tiny character<br>for your agents</p>
    <div class="foot"><span class="pill">npm install dotty-botty</span><span class="url">dotty.roybarber.com</span></div>
  </div>
  <div class="hero">${bot({ size: 330, expression: 'happy' })}</div>
  ${friends.map(({ x, y, ...p }) => `<div class="f" style="left:${x}px;top:${y}px">${bot(p)}</div>`).join('')}
</body></html>`;

const icon = `<!doctype html><html><head><style>
  body { margin: 0; width: 180px; height: 180px; background: #ff6b1a; display: grid; place-items: center; overflow: hidden; }
</style></head><body>${bot({ size: 176, ink: '#ffffff', spot: '#ff6b1a' })}</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(og);
writeFileSync(out('og.png'), await page.screenshot({ type: 'png' }));
const iconPage = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
await iconPage.setContent(icon);
writeFileSync(out('apple-touch-icon.png'), await iconPage.screenshot({ type: 'png' }));
await browser.close();
console.log('Wrote public/og.png and public/apple-touch-icon.png');
