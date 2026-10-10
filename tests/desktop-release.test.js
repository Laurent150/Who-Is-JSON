const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('desktop payload explicitly includes release modules and excludes local evaluation data',()=>{
 const files=JSON.parse(fs.readFileSync(path.join(root,'desktop/app-files.json'),'utf8'));
 assert.equal(new Set(files).size,files.length);
 for(const file of files){assert.ok(!file.split('/').some(part=>part.startsWith('.')));assert.ok(fs.statSync(path.join(root,file)).isFile());assert.ok(!/browser-artifacts|talk-eval|node_modules|^desktop\//.test(file));}
 for(const file of ['ai/ai-talk-contracts.js','ai/ai-talk-async.js','ai/ai-talk-audience.js','ai/ai-talk-policy.js','ai/ai-review.js','ai/ai-usage.js','public/i18n.js','public/flow-model.js','public/saved-explanations.js','parsers/javascript-links.js'])assert.ok(files.includes(file),file);
 // All static relative production imports must be present (evaluation-only test hooks are excluded).
 for(const file of files.filter(f=>f.endsWith('.js'))){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){
   const target=path.resolve(root,path.dirname(file),match[1]);
   if(!target.startsWith(root+path.sep)||target.includes(path.sep+'tests'+path.sep))continue;
   const resolved=[target,target+'.js',target+'.json',path.join(target,'index.js')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
   if(resolved)assert.ok(files.includes(path.relative(root,resolved).replaceAll('\\','/')),file+' -> '+match[1]);
  }
 }
});
