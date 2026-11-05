import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=[];
function walk(folder) {for(const e of readdirSync(resolve(root,folder),{withFileTypes:true})) {
  const path=folder+'/'+e.name;
  if(e.isDirectory())walk(path);else if(e.isFile())files.push(path);
}}
for(const folder of ['app/tamiran','baseline','public/assets'])walk(folder);
const manifest={format:1,scope:'Frozen local source only; no staging access, live database, credentials or runtime data.',
  files:files.sort().map(path=>({path,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')}))};
writeFileSync(resolve(root,'baseline-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({frozen_files:manifest.files.length,api_files:files.filter(x=>x.startsWith('baseline/api/')).length}));
