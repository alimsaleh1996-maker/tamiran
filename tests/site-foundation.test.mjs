import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
assert.equal(manifest.project_id,'appgprj_6abc1a7567b48191a56163caace8160f');
assert.equal(manifest.static.directory,'dist');
const html=readFileSync('dist/index.html','utf8');
assert(html.includes('این صفحه فقط دموی قبلی است'));
assert(html.includes('داده واقعی ثبت نکنید'));
assert(html.includes('href="/migration-status.html"'));
assert(existsSync('dist/migration-status.html'));
const report=readFileSync('dist/migration-status.html','utf8');
assert(report.includes('هنوز انجام نشده')&&report.includes('E2E'));
function walk(dir) { for(const e of readdirSync(dir,{withFileTypes:true})) {
  const path=dir+'/'+e.name;
  if(e.isDirectory())walk(path);else assert(!/\.php$|\.env|\.map$|config\.php|runtime-secrets/.test(path),'Unsafe served asset '+path);
}}
walk('dist');
assert(!/tamiran-session-guard|hybrid-premium/.test(html));
console.log('PASS Site identity, static manifest, demo warning, status link, verification limits, served-assets isolation and no unapproved overlay');
