#!/usr/bin/env node
/**
 * Drives the exported web build in headless Chromium and screenshots every
 * screen.
 *
 * The app has no sample data and cannot scan in a browser, so this seeds the
 * persisted stores directly, then walks the UI the way a person would.
 *
 * Usage:
 *   node .claude/skills/run-scanly/drive.mjs [--theme light|dark|both]
 *                                            [--out DIR] [--base URL]
 *                                            [--only NAME]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => (a.startsWith('--') ? [[a.slice(2), all[i + 1]]] : []))
);

const BASE = args.base ?? 'http://localhost:8100';
const OUT = resolve(args.out ?? '.preview/shots');
const THEMES = args.theme === 'both' || !args.theme ? ['light', 'dark'] : [args.theme];

// Playwright is installed with --no-save and never downloads a browser here
// (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1), so point it at the preinstalled one.
const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const now = Date.now();
const page = (id, file, filter, text) => ({
  id,
  sourceUri: `${BASE}/demo/${file}`,
  uri: `${BASE}/demo/${file}`,
  width: 1240,
  height: 1754,
  filter,
  rotation: 0,
  revision: 0,
  text,
});

const FOLDERS = [
  { id: 'f1', name: 'Work', createdAt: now },
  { id: 'f2', name: 'Household', createdAt: now },
];

// `text` is what OCR would have produced. Seeding it is what makes the
// content-search screen demonstrable without a native recogniser.
const DOCUMENTS = [
  {
    id: 'd1',
    name: 'INVOICE',
    createdAt: now - 5_400_000,
    updatedAt: now - 900_000,
    folderId: 'f1',
    pages: [
      page('p1', 'invoice-1.jpg', 'enhance',
        'INVOICE\n\nNorthwind Supplies Ltd\n42 Harbour Road, Bristol BS1 4QA\n\n' +
        'Invoice no. NW-2026-0418\nDate 4 September 2026\n\nTotal due £289.68'),
      page('p2', 'invoice-2.jpg', 'enhance',
        'TERMS OF SUPPLY\n\n1. Delivery\nGoods are dispatched within three working days.'),
    ],
  },
  {
    id: 'd2',
    name: 'The Copper Kettle',
    createdAt: now - 86_400_000,
    updatedAt: now - 86_400_000,
    folderId: 'f2',
    pages: [
      page('p3', 'receipt.jpg', 'blackwhite',
        'CAFÉ RECEIPT\n\nThe Copper Kettle\n12 Mill Lane 6 Sept 2026 09:14\n\n' +
        'Flat white £3.40\nAlmond croissant £3.10\nTotal £8.70'),
    ],
  },
  {
    id: 'd3',
    name: 'Terms of supply',
    createdAt: now - 200_000_000,
    updatedAt: now - 200_000_000,
    pages: [
      page('p4', 'invoice-2.jpg', 'enhance',
        'TERMS OF SUPPLY\n\n2. Payment\nInvoices fall due 28 days from the date of issue.'),
    ],
  },
];

function settings(theme) {
  return {
    theme,
    defaultFilter: 'enhance',
    pageSize: 'fit',
    pdfQuality: 'balanced',
    sort: 'recent',
    autoRecognizeText: true,
    smartNaming: true,
    // Leave the lock off: the browser has no biometrics, so an enabled lock
    // would park every run on the unlock screen.
    appLock: false,
  };
}

async function walk(browser, theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));

  const shot = (name) => tab.screenshot({ path: `${OUT}/${theme}-${name}.png` });
  // Text selectors are a trap here — getByText('Scan') also matches the title
  // "Scanly". Every control the driver touches carries an aria-label.
  const byLabel = (label) => tab.locator(`[aria-label="${label}"]`).first();
  const want = (name) => !args.only || args.only === name;

  await tab.goto(BASE, { waitUntil: 'domcontentloaded' });
  await tab.evaluate(
    ([documents, folders, prefs]) => {
      localStorage.setItem(
        'scanly.documents.v1',
        JSON.stringify({ state: { documents, folders }, version: 0 })
      );
      localStorage.setItem('scanly.settings.v1', JSON.stringify({ state: prefs, version: 0 }));
    },
    [DOCUMENTS, FOLDERS, settings(theme)]
  );

  // CanvasKit is fetched and instantiated on first load; the reload is what
  // picks up the seeded stores, and the wait covers the wasm handshake.
  await tab.reload({ waitUntil: 'networkidle' });
  await tab.waitForTimeout(4200);

  if (want('library')) await shot('1-library');

  if (want('search')) {
    await tab.locator('input').first().fill('croissant');
    await tab.waitForTimeout(1100);
    await shot('2-search');
    await tab.locator('input').first().fill('');
    await tab.waitForTimeout(800);
  }

  if (want('scan')) {
    await byLabel('Scan a document').click();
    await tab.waitForTimeout(900);
    await shot('3-scan');
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(600);
  }

  await tab.getByText('INVOICE', { exact: false }).first().click();
  await tab.waitForTimeout(1400);
  if (want('document')) await shot('4-document');

  if (want('actions')) {
    await byLabel('More').click();
    await tab.waitForTimeout(900);
    await shot('5-actions');
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(600);
  }

  await byLabel('Page 1, edit').click();
  await tab.waitForTimeout(2600);
  if (want('editor')) await shot('6-editor');

  if (want('editor-bw')) {
    await tab.getByText('B & W', { exact: false }).first().click();
    await tab.waitForTimeout(1300);
    await shot('7-editor-bw');
  }

  if (want('signing')) {
    await byLabel('Sign this page').click();
    await tab.waitForTimeout(2600);
    await drawSignature(tab);
    await shot('8-signing');
  }

  if (want('settings')) {
    await tab.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await tab.waitForTimeout(2200);
    await shot('9-settings');
  }

  console.log(`${theme}: ${errors.length} page error(s)${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
  await context.close();
  return errors.length;
}

/** Scribbles across the page so the signing screenshot shows real ink. */
async function drawSignature(tab) {
  const box = await tab.locator('canvas').last().boundingBox().catch(() => null);
  if (!box) return;

  const x = box.x + box.width * 0.4;
  const y = box.y + box.height * 0.7;
  const wave = [
    [-44, -18], [-30, 12], [-14, -26], [2, 14], [18, -22],
    [34, 10], [50, -16], [68, 2], [88, -12], [104, 6],
  ];

  await tab.mouse.move(x - 58, y);
  await tab.mouse.down();
  for (const [dx, dy] of wave) {
    await tab.mouse.move(x + dx, y + dy);
    // Without a pause between moves the points collapse into one segment.
    await tab.waitForTimeout(22);
  }
  await tab.mouse.up();
  await tab.waitForTimeout(1100);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
let failures = 0;
for (const theme of THEMES) failures += await walk(browser, theme);
await browser.close();

console.log(`screenshots -> ${OUT}`);
// A page error means a screen threw; the screenshots are not trustworthy.
process.exit(failures === 0 ? 0 : 1);
