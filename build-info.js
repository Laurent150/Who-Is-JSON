const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=crypto.createHash('sha256');
function scan(dir){
    for(const name of fs.readdirSync(dir).sort()){
        const file=path.join(dir,name),relative=path.relative(__dirname,file).replaceAll('\\','/');
        if(['node_modules','tests','.runtime','.browser-artifacts','__pycache__','.git'].includes(name))continue;
        if(fs.statSync(file).isDirectory()){if(['public','parsers','explanation','ocr-data'].includes(name)||relative.startsWith('public/'))scan(file);}
        else if(/\.(?:js|py|css|html)$/.test(name)||['package.json','pnpm-lock.yaml','manifest.json'].includes(name))hash.update(relative+'\0').update(fs.readFileSync(file)).update('\0');
    }
}
scan(__dirname);
module.exports={version:require('./package.json').version,buildId:hash.digest('hex').slice(0,16)};
