const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('koç playlist detayında videoları başlığa göre arayabilir',()=>{
  const html=read('index.html');
  const js=read('program-videos-v1.js');
  const css=read('program-videos-v1.css');
  assert.match(html,/program-videos-v1\.js\?v=1\.8\.0/);
  assert.match(html,/program-videos-v1\.css\?v=1\.4\.0/);
  assert.match(js,/playlistVideoQuery/);
  assert.match(js,/id="coachPlaylistVideoSearch"/);
  assert.match(js,/Bu playlistte video ara/);
  assert.match(js,/norm\(\[row\.video\.title,row\.video\.by\|\|state\.teacher\]\.join\(" "\)\)\.includes\(query\)/);
  assert.match(js,/rows\.length\+" \/ "\+videos\.length\+' video'/);
  assert.match(js,/data-playlist-video-recommend/);
  assert.match(js,/data-playlist-video-add/);
  assert.match(css,/\.coach-playlist-video-search-row/);
  assert.match(css,/\.coach-playlist-video-search/);
});
