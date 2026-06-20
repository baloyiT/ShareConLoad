// scripts/export-pdfs.js
'use strict';

const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const HTML_DIR = path.resolve(__dirname, '../docs/user-guides/html');
const OUT_DIR  = path.resolve(__dirname, '../docs/user-guides');

const ROLES = ['customer', 'operator', 'agent', 'measurement-agent', 'transporter'];

(async () => {
  const roleArg = process.argv[2];
  const roles   = roleArg ? [roleArg] : ROLES;

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  for (const roleId of roles) {
    const htmlPath = path.join(HTML_DIR, `${roleId}-user-guide.html`);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`⚠️  HTML not found for ${roleId} — run generate-guides.js first`);
      continue;
    }

    const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    const pdfPath = path.join(OUT_DIR, `${roleId}-user-guide.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });

    console.log(`✓ ${roleId}-user-guide.pdf`);
  }

  await browser.close();
  console.log('\n✅ PDFs exported → docs/user-guides/');
})();
