const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {analyze,detect}=require('../analyzer'),syntax=require('../public/gitignore-syntax'),knowledge=require('../public/knowledge'),reading=require('../public/reading-model');
const feedback=fs.readFileSync(path.join(__dirname,'fixtures/feedback-ignore.gitignore'),'utf8');
test('feedback works both by filename and by conservative content detection',()=>{
 for(const name of ['.gitignore','screenshot.txt','']){
  const r=analyze(feedback,name);assert.equal(r.status,'ready');assert.equal(r.language,'Gitignore');assert.equal(r.documentKind,'configuration');
  assert.equal(r.blocks[0].configurationNodes.filter(n=>n.rule.kind==='rule').length,13);
  const keep=r.blocks[0].configurationNodes.find(n=>n.start===10);assert.equal(keep.rule.negated,true);assert.match(keep.guide.why,/上级目录/);
  assert.equal(r.blocks[0].configurationNodes.find(n=>n.start===2).rule.pattern,'_pycache_/');
  assert.ok(r.blocks[0].learning.every(x=>knowledge.cards[x.id]));
 }
});
test('ordinary code, path lists and Dockerignore are not guessed to be Gitignore',()=>{
 for(const code of ['a/\nb/\nc/','def run():\n    return 3','const x = !ok;\nconst y = a * b;','name: CI\njobs:\n  build: test'])assert.notEqual(detect(code),'Gitignore');
 assert.equal(detect(feedback,'.dockerignore'),'Dockerignore');
 assert.equal(require('../public/file-types').accepts('.gitignore'),true);
});
test('comments, escapes and trailing spaces retain Git semantics and source ranges',()=>{
 const rows=syntax.read('# 中文\n #literal\n\\#literal\n\\!literal\nname   \nname\\ \nfoo #bar\n');
 assert.equal(rows[0].kind,'comment');assert.equal(rows[1].kind,'rule');assert.equal(rows[2].kind,'rule');assert.equal(rows[3].negated,false);
 assert.equal(rows[4].pattern,'name');assert.equal(rows[5].pattern,'name\\ ');assert.equal(rows[6].pattern,'foo #bar');
 assert.equal(rows[4].endColumn,7);
});
test('slash scopes and malformed trailing backslash are explicit',()=>{
 const rows=syntax.read('logs/\n/logs/\na/logs/\n**/logs/\nplain\nbad\\');
 assert.deepEqual(rows.map(x=>x.anchored),[false,true,true,false,false,false]);
 assert.equal(rows[0].directory,true);assert.equal(rows[4].directory,false);
 assert.equal(analyze('bad\\','.gitignore').status,'partial');
});
test('pattern symbols have Git lessons, not list/function meanings',()=>{
 const r=reading.lessons('!cache/*\npart[0-9]?.log\n\\#name\n**/tmp/','Gitignore');
 assert.ok(r.parts.some(x=>x.text==='!'&&/例外/.test(x.plain)));assert.ok(r.parts.some(x=>x.text==='[0-9]'&&/不是列表/.test(x.plain)));
 assert.ok(reading.scan('# 中文\nname#literal','gitignore').filter(x=>x.kind==='comment').length===1);
});
test('Git itself confirms examples, directory exclusions, and tracked-file caveat',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'who-gitignore-'));
 const empty=path.join(dir,'empty-excludes');fs.writeFileSync(empty,'');
 const git=(args,input)=>{const r=spawnSync('git',['-c','core.excludesFile='+empty,...args],{cwd:dir,input,encoding:'utf8',windowsHide:true});assert.ok(!r.error,String(r.error));assert.notEqual(r.status,128,r.stderr);return r;};
 assert.equal(git(['init','--quiet']).status,0);
 const ignored=file=>git(['check-ignore','--no-index','-q','--',file]).status===0;
 fs.writeFileSync(path.join(dir,'.gitignore'),feedback);
 assert.equal(ignored('lesson/items/tmp.txt'),true);assert.equal(ignored('lesson/items/.keep'),false);assert.equal(ignored('src/reports/a.txt'),true);assert.equal(ignored('other/lesson/settings.toml'),false);assert.equal(ignored('lesson/settings.toml'),true);
 fs.writeFileSync(path.join(dir,'.gitignore'),'cache/\n!cache/.gitkeep\n');assert.equal(ignored('cache/.gitkeep'),true);
 fs.writeFileSync(path.join(dir,'.gitignore'),'cache/*\n!cache/.gitkeep\n');assert.equal(ignored('cache/.gitkeep'),false);
 fs.writeFileSync(path.join(dir,'.gitignore'),'**/cache/\na/**/b\npart[0-9].log\nfile?.txt\n\\#name\n\\!name\nname\\ \n');
 for(const p of ['x/cache/file','a/b','a/x/y/b','part2.log','file1.txt','#name','!name','name '])assert.equal(ignored(p),true,p);
 for(const p of ['part12.log','file12.txt','name'])assert.equal(ignored(p),false,p);
 fs.writeFileSync(path.join(dir,'tracked.log'),'x');assert.equal(git(['add','--','tracked.log']).status,0);fs.writeFileSync(path.join(dir,'.gitignore'),'*.log\n');
 assert.equal(git(['check-ignore','-q','--','tracked.log']).status,1);assert.equal(ignored('tracked.log'),true);
 // Leave this isolated Git fixture in the system temp directory for failure diagnosis.
});
