/**
 * Generates minimal valid PDF fixtures for document upload tests.
 * Run once: node tests/fixtures/create-pdfs.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makePdf(title, content) {
  const body = `BT /F1 12 Tf 50 750 Td (${title}) Tj 0 -20 Td (${content}) Tj ET`;
  const stream = `stream\n${body}\nendstream`;
  return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>/Parent 2 0 R>>endobj
4 0 obj<</Length ${stream.length}>>
${stream}
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f\r
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;
}

const docs = [
  { file: 'freight-forwarder-license.pdf',  title: 'Freight Forwarder License', content: 'License No: FF-ZA-2019-10583 | Holder: Justice Baloyi | Expiry: 2028-06-30' },
  { file: 'business-registration.pdf',       title: 'Certificate of Incorporation', content: 'Baloyi International Freight Solutions Pty Ltd | Reg: 2019/078341/07 | CIPC' },
  { file: 'identity-document.pdf',           title: 'South African Identity Document', content: 'Name: Justice Baloyi | ID No: 9001015678083 | Nationality: South African' },
  { file: 'proof-of-address.pdf',            title: 'Proof of Address', content: 'Baloyi International Freight Solutions | 14 Commerce Street, Sandton, 2196' },
  { file: 'sample-doc.pdf',                  title: 'Test Document', content: 'ShareConLoad Test Fixture — for automated testing only' },
];

for (const { file, title, content } of docs) {
  writeFileSync(join(__dirname, file), makePdf(title, content));
  console.log(`✅ Created ${file}`);
}

console.log('\nAll PDF fixtures created in tests/fixtures/');
