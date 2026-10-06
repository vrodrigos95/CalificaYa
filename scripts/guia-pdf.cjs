// Genera docs/Guia_CalificaYa.pdf a partir de docs/guia/guia.html (Chromium/Playwright).
// Uso: node scripts/guia-pdf.cjs
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '../docs/guia/guia.html'), { waitUntil: 'networkidle' });
  await p.pdf({ path: path.resolve(__dirname, '../docs/Guia_CalificaYa.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;text-align:center;font-size:8px;color:#94a3b8;font-family:Arial">CalificaYa · Guía rápida para docentes · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
  await b.close();
  console.log('docs/Guia_CalificaYa.pdf');
})();
