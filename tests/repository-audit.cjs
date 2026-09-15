// Opt-in audit of pinned, user-provided public repositories. Never imports their Python modules.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const catalog=require('./corpus/python-repositories.json'),{analyze}=require('../analyzer');
const root=process.argv[2],output=process.argv[3]||'repository-audit.json';
if(!root){console.error('Usage: node tests/repository-audit.cjs <directory containing pinned repositories> [report.json]');process.exit(2);}
const report={version:require('../package.json').version,files:[],failures:[],repositories:[]};
for(const repo of catalog){const dir=path.resolve(root,repo.name),head=cp.spawnSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
 if(head.status!==0||head.stdout.trim()!==repo.commit){report.failures.push(repo.name+': repository version differs');continue;}
 report.repositories.push({name:repo.name,commit:repo.commit,url:repo.url});
 for(const entry of repo.files){const file=path.join(dir,entry.file),code=fs.readFileSync(file,'utf8'),hash=crypto.createHash('sha256').update(code.replace(/\r\n/g,'\n')).digest('hex');
  if(hash!==entry.sha256){report.failures.push(repo.name+'/'+entry.file+': source differs');continue;}
  const r=analyze(code,file,process.env.CODELINGO_PYTHON||'python'),errors=[],lines=code.split('\n');
  if(!['ready','empty'].includes(r.status))errors.push(...r.warnings,'Unexpected status '+r.status);
  for(const d of entry.defs)if(!r.blocks.some(b=>b.title===d.name&&b.start===d.start&&b.end===d.end))errors.push('Missing definition '+d.name+':'+d.start);
  function visit(v){if(!v||typeof v!=='object')return;if(Number.isInteger(v.start)&&Number.isInteger(v.end)&&(v.start<1||v.end<v.start||v.end>lines.length||v.startColumn!=null&&v.startColumn>lines[v.start-1]?.length||v.endColumn!=null&&v.endColumn>lines[v.end-1]?.length))errors.push('Source range outside input');for(const x of Object.values(v))if(x&&typeof x==='object')visit(x);}
  visit(r.blocks);report.files.push({repo:repo.name,file:entry.file,split:entry.split,status:r.status,definitions:entry.defs.length,errors});
  if(errors.length)report.failures.push(repo.name+'/'+entry.file+': '+errors.join('; '));
 }
 console.log(repo.name+': '+repo.files.length+' files checked');
}
report.pass=report.failures.length===0&&report.files.length===catalog.reduce((n,r)=>n+r.files.length,0);fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('Pass: '+report.pass);if(!report.pass)process.exitCode=1;
