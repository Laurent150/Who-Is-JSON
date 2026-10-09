const {test}=require('node:test'),assert=require('node:assert/strict'),display=require('../public/point-display');
test('explicit inline code markers become code segments without decorative quotes or data changes',()=>{
 const raw='`members` keeps "Ada"; `members[1:]` selects later items.\nIt\'s not a new name.';
 assert.equal(display.text(raw),'members keeps "Ada"; members[1:] selects later items.\nIt\'s not a new name.');
 assert.equal(display.text('"dark" and \'Guest\' and don\'t'),'"dark" and \'Guest\' and don\'t');
 assert.equal(display.text('``a`b`` and \\`literal\\` and `unclosed'),'a`b and \\`literal\\` and `unclosed');
 assert.deepEqual(display.segments('Read `"dark"`.'),[{kind:'text',text:'Read '},{kind:'code',text:'"dark"'},{kind:'text',text:'.'}]);
 assert.equal(display.text('`<img src=x onerror=alert(1)>`'),'<img src=x onerror=alert(1)>');
});
test('fenced code retains internal template and string characters and natural paragraph boundaries',()=>{
 const code='const text = `hello $'+'{name}`;\r\nconst quote = "\'";\r\n';
 assert.equal(display.text('Example:\r\n```js\r\n'+code+'```\r\nThen `value`.'),'Example:\r\n'+code+'Then value.');
 assert.equal(display.text('~~~python\nx = "`word`"\n~~~\n'),'x = "`word`"\n');
 assert.equal(display.text('```js\nconst value = `x`;'),'const value = `x`;');
 assert.equal(display.text('One `value`.\n\nAnother `result`.'),'One value.\n\nAnother result.');
});
test('visible point-reading paths render from canonical raw while saving the original answer',()=>{
 const fs=require('fs');for(const file of ['public/studio.js','public/line-reading-ui.js']){
  const source=fs.readFileSync(file,'utf8');assert.match(source,/WhoPointDisplay\?\.paragraph/);assert.doesNotMatch(source,/appendExplanationSave\([^;]*WhoPointDisplay/);
 }assert.match(fs.readFileSync('public/studio.js','utf8'),/WhoPointDisplay.render/);
 assert.equal(JSON.parse(fs.readFileSync('desktop/app-files.json')).filter(p=>p==='public/point-display.js').length,1);
 assert.match(fs.readFileSync('public/index.html','utf8'),/point-display\.js/);
 assert.doesNotMatch(fs.readFileSync('public/point-display.js','utf8'),/innerHTML|eval\(|new Function/);
});
