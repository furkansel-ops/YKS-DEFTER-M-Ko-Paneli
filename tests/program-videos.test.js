const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('programlar ekranında güncel hoca ve video kütüphanesi yüklenir',()=>{
  const html=read('index.html'),js=read('program-videos-v1.js'),css=read('program-videos-v1.css');
  assert.match(html,/program-videos-v1\.css\?v=1\.0\.0/);
  assert.match(html,/program-videos-v1\.js\?v=1\.0\.0/);
  assert.match(js,/HOCALAR &amp; VİDEOLAR/);
  assert.match(js,/data-scope="TYT"/);
  assert.match(js,/data-scope="AYT"/);
  assert.match(js,/&filter=/);
  assert.match(js,/playlists/);
  assert.match(js,/konu anlatımı/);
  assert.match(js,/deneme çözümü/);
  assert.match(js,/programTaskVideo/);
  assert.match(js,/programCustomTab/);
  assert.match(js,/Programa ekle/);
  assert.match(js,/Biosem/);
  assert.match(js,/Senin Biyolojin/);
  assert.match(css,/\.coach-video-library/);
});
