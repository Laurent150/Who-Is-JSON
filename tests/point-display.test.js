const {test}=require('node:test'),assert=require('node:assert/strict'),display=require('../public/point-display');
test('paired inline formatting uses upright ASCII quotes without changing source-like strings',()=>{
 const raw='`members` keeps "Ada"; `members[1:]` selects later items.\nIt\'s not a new name.';
 assert.equal(display.text(raw),'\'members\' keeps "Ada"; \'members[1:]\' selects later items.\nIt\'s not a new name.');
 assert.equal(raw,'`members` keeps "Ada"; `members[1:]` selects later items.\nIt\'s not a new name.');
 assert.equal(display.text('``a`b`` and \\`literal\\` and `unclosed'),"'a`b' and \\`literal\\` and `unclosed");
});
test('fenced code loses only the fence lines and retains every internal character',()=>{
 const code='const text = `hello ${name}`;\r\nconst quote = "\'";\r\n';
 assert.equal(display.text('Example:\r\n```js\r\n'+code+'```\r\nThen `value`.'),'Example:\r\n'+code+"Then 'value'.");
 assert.equal(display.text('~~~python\nx = "`word`"\n~~~\n'), 'x = "`word`"\n');
 assert.equal(display.text('```js\nconst value = `x`;'), 'const value = `x`;');
});
test('visible point-reading paths format display while saving the original answer',()=>{
 const fs=require('fs');for(const file of ['public/studio.js','public/line-reading-ui.js']){
  const source=fs.readFileSync(file,'utf8');assert.match(source,/WhoPointDisplay\?\.text/);assert.doesNotMatch(source,/appendExplanationSave\([^;]*WhoPointDisplay/);
 }
 assert.equal(JSON.parse(fs.readFileSync('desktop/app-files.json')).filter(p=>p==='public/point-display.js').length,1);
 assert.match(fs.readFileSync('public/index.html','utf8'),/point-display\.js/);
});
