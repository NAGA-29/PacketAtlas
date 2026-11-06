// OGP 画像(1200×630)を自作の HTML から書き出す:node scripts/og.mjs
// フォントは node_modules の IBM Plex(OFL)を読み込む。外部のサイトや画像は使わない
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const font = (pkg, file) => pathToFileURL(resolve(root, 'node_modules/@fontsource', pkg, 'files', file)).href;

const lanes = [
  { x: 120, name: 'ブラウザ' },
  { x: 400, name: 'リゾルバー' },
  { x: 680, name: 'サーバー' },
];
const arrows = [
  { y: 150, from: 0, to: 1, color: '#8F6204', label: 'DNS' },
  { y: 200, from: 1, to: 0, color: '#8F6204', label: 'A 203.0.113.80' },
  { y: 260, from: 0, to: 2, color: '#2B57C9', label: 'SYN' },
  { y: 310, from: 2, to: 0, color: '#2B57C9', label: 'SYN-ACK' },
  { y: 370, from: 0, to: 2, color: '#2B57C9', label: 'ClientHello' },
  { y: 420, from: 2, to: 0, color: '#2B57C9', label: 'ServerHello … Finished' },
  { y: 480, from: 0, to: 2, color: '#0F7F70', label: 'GET /' },
  { y: 530, from: 2, to: 0, color: '#0F7F70', label: '200 OK' },
];

const svg = `<svg width="800" height="580" viewBox="0 0 800 580" xmlns="http://www.w3.org/2000/svg">
  ${lanes.map((l) => `<line x1="${l.x}" y1="80" x2="${l.x}" y2="565" stroke="#C6CEC8" stroke-width="2"/>
  <text x="${l.x}" y="60" text-anchor="middle" font-size="22" font-weight="700" fill="#18202B">${l.name}</text>`).join('')}
  ${arrows.map((a) => {
    const x1 = lanes[a.from].x, x2 = lanes[a.to].x, d = Math.sign(x2 - x1);
    const ex = x2 - d * 6, hx = ex - d * 12;
    return `<line x1="${x1 + d * 6}" y1="${a.y}" x2="${hx}" y2="${a.y}" stroke="${a.color}" stroke-width="3"/>
    <path d="M${ex},${a.y} L${hx},${a.y - 7} L${hx},${a.y + 7} z" fill="${a.color}"/>
    <text x="${(x1 + x2) / 2}" y="${a.y - 10}" text-anchor="middle" font-size="17" font-weight="500" fill="${a.color}" paint-order="stroke" stroke="#F7F8F4" stroke-width="6">${a.label}</text>`;
  }).join('')}
  <circle cx="${lanes[0].x}" cy="480" r="9" fill="#0F7F70"/>
</svg>`;

const bytes = '16 03 01 00 94 01 00 00 90 03 03'.split(' ');
// TLS レコードヘッダー(5)・ハンドシェイク型(1)・長さ(3)・バージョン(2) を色分け
const GROUP = [0, 0, 0, 1, 1, 2, 3, 3, 3, 4, 4];
const colors = [['#DCE5FB', '#1D3E92'], ['#F7DCE8', '#7E1C4C'], ['#D6F0EA', '#0B5A4F'], ['#F5E7C6', '#6B4A05'], ['#E6DDF6', '#4A2E86']];

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
@font-face{font-family:'Plex JP';src:url(${font('ibm-plex-sans-jp', 'ibm-plex-sans-jp-japanese-700-normal.woff2')}) format('woff2');font-weight:700}
@font-face{font-family:'Plex JP';src:url(${font('ibm-plex-sans-jp', 'ibm-plex-sans-jp-japanese-500-normal.woff2')}) format('woff2');font-weight:500}
@font-face{font-family:'Plex JP';src:url(${font('ibm-plex-sans-jp', 'ibm-plex-sans-jp-latin-700-normal.woff2')}) format('woff2');font-weight:700;unicode-range:U+0000-00FF}
@font-face{font-family:'Plex JP';src:url(${font('ibm-plex-sans-jp', 'ibm-plex-sans-jp-latin-500-normal.woff2')}) format('woff2');font-weight:500;unicode-range:U+0000-00FF}
@font-face{font-family:'Plex Mono';src:url(${font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2')}) format('woff2');font-weight:500}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#E9EDE8;font-family:'Plex JP',sans-serif;color:#18202B;
  background-image:linear-gradient(rgba(24,32,43,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(24,32,43,.06) 1px,transparent 1px);background-size:24px 24px;
  display:grid;grid-template-columns:440px minmax(0,1fr);gap:24px;padding:56px 40px 40px 64px}
.logo{font-size:30px;font-weight:700;display:flex;align-items:center;gap:14px}
.logo i{width:18px;height:18px;border-radius:50%;background:#2B57C9;display:block}
h1{font-size:50px;line-height:1.2;font-weight:700;margin-top:56px;letter-spacing:-.01em}
p{font-size:21px;font-weight:500;color:#5A6570;margin-top:22px;line-height:1.6}
.bytes{display:flex;flex-wrap:wrap;gap:6px;margin-top:40px;font-family:'Plex Mono',monospace;font-size:22px;font-weight:500}
.bytes span{padding:2px 8px;border-radius:5px}
.panel{background:#F7F8F4;border:2px solid #C6CEC8;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:12px 16px;overflow:hidden;min-width:0}
.panel svg{width:100%;height:auto;font-family:'Plex JP',sans-serif}
</style></head><body>
<div><div class="logo"><i></i>Packet Atlas</div>
<h1>インターネットの<br>プロトコルを、<br>1パケットずつ</h1>
<p>シーケンス図とバイト単位の分解で学ぶ<br>6部21レッスン</p>
<div class="bytes">${bytes.map((b, i) => { const [bg, fg] = colors[GROUP[i]]; return `<span style="background:${bg};color:${fg}">${b}</span>`; }).join('')}</div></div>
<div class="panel">${svg}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(root, 'public/og.png') });
await browser.close();
console.log('wrote public/og.png');
