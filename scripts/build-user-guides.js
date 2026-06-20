// scripts/build-user-guides.js
// Usage: node scripts/build-user-guides.js [role]
// Runs: generate-guides.js → export-pdfs.js
// Screenshots must already exist (run capture-screenshots.js separately)
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const roleArg = process.argv[2] ?? '';
const flag    = roleArg ? ` ${roleArg}` : '';

function run(script) {
  const cmd = `node ${path.join(__dirname, script)}${flag}`;
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

run('generate-guides.js');
run('export-pdfs.js');

console.log('\n🎉  User guides build complete.');
