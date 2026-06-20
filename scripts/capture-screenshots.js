// scripts/capture-screenshots.js
'use strict';

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../docs/user-guides/screenshots');

async function ss(page, role, name) {
  const dir = path.join(OUT, role);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${role}/${name}.png`);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
}

// ─── CUSTOMER ────────────────────────────────────────────────────────────────

async function captureCustomer(browser) {
  console.log('\n── Customer ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'customer', '01-login');

  await login(page, 'customer.shareconload@gmail.com', 'TestCustomer@2026!');

  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000);
  await ss(page, 'customer', '02-home-containers');

  // Click first container card
  const containerLink = page.locator('a[href^="/container/"]').first();
  await containerLink.waitFor({ timeout: 8000 });
  const containerId = (await containerLink.getAttribute('href')).split('/container/')[1].split('/')[0];
  await page.goto(`${BASE}/container/${containerId}`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '03-container-detail');

  await page.goto(`${BASE}/booking/${containerId}`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '04-booking-form');

  await page.goto(`${BASE}/payments/history`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '05-payment-history');

  await page.goto(`${BASE}/bookings`);
  await page.waitForTimeout(2000);
  // Try to get to a tracking page
  const trackLink = page.locator('a[href^="/booking/track/"]').first();
  const hasTrackLink = await trackLink.count() > 0;
  if (hasTrackLink) {
    await trackLink.click();
    await page.waitForTimeout(1500);
    await ss(page, 'customer', '06-tracking');
  } else {
    await ss(page, 'customer', '06-bookings-list');
  }

  await page.goto(`${BASE}/measurement-service`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '07-measurement-service');

  await page.goto(`${BASE}/disputes/new`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '08-dispute-new');

  await page.goto(`${BASE}/support/new`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '09-support-ticket');

  await page.goto(`${BASE}/onboarding/customer`);
  await page.waitForTimeout(1500);
  await ss(page, 'customer', '00-kyc-onboarding');

  await ctx.close();
}

// ─── OPERATOR ────────────────────────────────────────────────────────────────

async function captureOperator(browser) {
  console.log('\n── Operator ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'operator', '01-login');

  await login(page, 'mercy.affulbaloyi@gmail.com', 'TestOperator@2026!');

  await page.goto(`${BASE}/operator`);
  await page.waitForTimeout(2000);
  await ss(page, 'operator', '02-dashboard');

  await page.goto(`${BASE}/operator/create`);
  await page.waitForTimeout(1500);
  await ss(page, 'operator', '03-create-container');

  await page.goto(`${BASE}/operator/bookings`);
  await page.waitForTimeout(2000);
  await ss(page, 'operator', '04-manage-bookings');

  await page.goto(`${BASE}/operator/payouts`);
  await page.waitForTimeout(2000);
  await ss(page, 'operator', '05-payouts');

  await page.goto(`${BASE}/operator/compliance`);
  await page.waitForTimeout(1500);
  await ss(page, 'operator', '06-compliance');

  await page.goto(`${BASE}/onboarding/operator`);
  await page.waitForTimeout(1500);
  await ss(page, 'operator', '00-onboarding');

  await ctx.close();
}

// ─── AGENT ───────────────────────────────────────────────────────────────────

async function captureAgent(browser) {
  console.log('\n── Agent ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'agent', '01-login');

  await login(page, 'justice_baloyi@yahoo.com', 'TestAgent@2026!');

  await page.goto(`${BASE}/agent`);
  await page.waitForTimeout(2000);
  await ss(page, 'agent', '02-dashboard');

  await page.goto(`${BASE}/agent/shippers/new`);
  await page.waitForTimeout(1500);
  await ss(page, 'agent', '03-add-shipper');

  await page.goto(`${BASE}/agent/shippers`);
  await page.waitForTimeout(2000);
  await ss(page, 'agent', '04-shippers-list');

  await page.goto(`${BASE}/agent/bookings`);
  await page.waitForTimeout(2000);
  await ss(page, 'agent', '05-bookings');

  await page.goto(`${BASE}/onboarding/agent`);
  await page.waitForTimeout(1500);
  await ss(page, 'agent', '00-onboarding');

  await page.goto(`${BASE}/onboarding/agent/status`);
  await page.waitForTimeout(1500);
  await ss(page, 'agent', '00b-application-status');

  await ctx.close();
}

// ─── MEASUREMENT AGENT ───────────────────────────────────────────────────────

async function captureMeasurementAgent(browser) {
  console.log('\n── Measurement Agent ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'measurement-agent', '01-login');

  await login(page, 'measurement.shareconload@gmail.com', 'TestMeasure@2026!');

  await page.goto(`${BASE}/measurement-agent`);
  await page.waitForTimeout(2000);
  await ss(page, 'measurement-agent', '02-dashboard');

  await page.goto(`${BASE}/measurement-agent/jobs`);
  await page.waitForTimeout(2000);
  await ss(page, 'measurement-agent', '03-jobs-list');

  // Try to open first job
  const jobLink = page.locator('a[href^="/measurement-agent/jobs/"]').first();
  const hasJob = await jobLink.count() > 0;
  if (hasJob) {
    await jobLink.click();
    await page.waitForTimeout(1500);
    await ss(page, 'measurement-agent', '04-job-detail');
  }

  await page.goto(`${BASE}/onboarding/measurement-agent`);
  await page.waitForTimeout(1500);
  await ss(page, 'measurement-agent', '00-onboarding-step1');

  await ctx.close();
}

// ─── TRANSPORTER ─────────────────────────────────────────────────────────────

async function captureTransporter(browser) {
  console.log('\n── Transporter ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await ss(page, 'transporter', '01-login');

  await login(page, 'transporter.shareconload@gmail.com', 'TestTransport@2026!');

  await page.goto(`${BASE}/transporter`);
  await page.waitForTimeout(2000);
  await ss(page, 'transporter', '02-dashboard');

  await page.goto(`${BASE}/transporter/jobs`);
  await page.waitForTimeout(2000);
  await ss(page, 'transporter', '03-jobs-list');

  // Try to open first job
  const jobLink = page.locator('a[href^="/transporter/jobs/"]').first();
  const hasJob = await jobLink.count() > 0;
  if (hasJob) {
    await jobLink.click();
    await page.waitForTimeout(1500);
    await ss(page, 'transporter', '04-job-detail');
  }

  await page.goto(`${BASE}/onboarding/transporter`);
  await page.waitForTimeout(1500);
  await ss(page, 'transporter', '00-onboarding-step1');

  await ctx.close();
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

(async () => {
  const roleArg = process.argv[2]; // optional: --role customer
  const browser = await chromium.launch({ headless: true });

  try {
    if (!roleArg || roleArg === 'customer')         await captureCustomer(browser);
    if (!roleArg || roleArg === 'operator')         await captureOperator(browser);
    if (!roleArg || roleArg === 'agent')            await captureAgent(browser);
    if (!roleArg || roleArg === 'measurement-agent') await captureMeasurementAgent(browser);
    if (!roleArg || roleArg === 'transporter')      await captureTransporter(browser);
  } finally {
    await browser.close();
  }

  console.log('\n✅ Screenshots done → docs/user-guides/screenshots/');
})();
