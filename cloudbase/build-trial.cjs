// Creates an explicit, credential-free Cloud Run build context. No deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const output=path.resolve(root,process.argv[2]||`.browser-artifacts/trial-${Date.now()}`);
const allowed=path.join(root,'.browser-artifacts')+path.sep;
if(!output.startsWith(allowed)||fs.existsSync(output))throw Error('Use a new directory under .browser-artifacts');
const serviceFiles=['Dockerfile','package.json','server.mjs','handler.mjs','policy.mjs','followup.cjs','reading.cjs','module-output.cjs'];
const runtimeFiles=['ai-direct-reading.js','ai-module-reading-policy.js','ai-language-policy.js','ai-repair-policy.js','ai-point-contract.js','ai-token-prompts.js','ai-point-await-line.js','public/reading-model.js','public/gitignore-syntax.js','cloudbase/functions/ai-trial/module-output.cjs'];
const manifest={deployed:false,billingVersion:'failure-refund-v1',directReadingProfile:'direct-reading-v1',files:{}};
function copy(source,destination){
  const to=path.join(output,destination);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(source,to);
  manifest.files[destination.replaceAll('\\','/')]=crypto.createHash('sha256').update(fs.readFileSync(to)).digest('hex');
}
for(const f of serviceFiles)copy(path.join(__dirname,'functions/ai-trial',f),f);
for(const f of runtimeFiles)copy(path.join(root,f),'runtime/'+f);
fs.writeFileSync(path.join(output,'runtime/package.json'),'{"type":"commonjs"}\n');
const ts=path.dirname(require.resolve('typescript/package.json',{paths:[root]}));
if(JSON.parse(fs.readFileSync(path.join(ts,'package.json'),'utf8')).version!=='5.9.3')throw Error('Expected locked TypeScript 5.9.3');
function vendor(folder,relative=''){
  for(const e of fs.readdirSync(folder,{withFileTypes:true})){
    if(e.isSymbolicLink())throw Error('Unexpected dependency symlink');
    const next=path.join(relative,e.name);
    if(e.isDirectory())vendor(path.join(folder,e.name),next);
    else copy(path.join(folder,e.name),path.join('node_modules/typescript',next));
  }
}
vendor(ts);
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,files:Object.keys(manifest.files).length,typescript:'5.9.3',deployed:false}));
