const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('koç paneli global polish katmanı güvenli şekilde yüklenir',()=>{
  const html=read('index.html'),css=read('coach-polish-v1.css');
  assert.match(html,/coach-polish-v1\.css\?v=1\.0\.0/);
  assert.match(css,/\.coach-reset-canvas/);
  assert.match(css,/\.coach-sidebar-v20/);
  assert.match(css,/\.dashboard-page,/);
  assert.match(css,/\.messages-shell/);
  assert.match(css,/\.settings-sidebar/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/display:none!important/);
});
