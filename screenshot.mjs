import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Desktop full-page
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'MyAsset/snap_desktop.png', fullPage: false });
await page.screenshot({ path: 'MyAsset/snap_fullpage.png', fullPage: true });

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'MyAsset/snap_mobile.png', fullPage: false });

await browser.close();
console.log('Screenshots saved.');
