const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('koç video kütüphanesi seçili öğrenciye güvenli kaynak önerisi gönderir',()=>{
  const html=read('index.html');
  const videos=read('program-videos-v1.js');
  const app=read('app-reset.js');
  const css=read('program-videos-v1.css');

  assert.match(html,/program-videos-v1\.css\?v=1\.3\.0/);
  assert.match(html,/program-videos-v1\.js\?v=1\.7\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.53/);
  assert.match(videos,/data-video-recommend/);
  assert.match(videos,/data-playlist-recommend/);
  assert.match(videos,/data-playlist-video-recommend/);
  assert.match(videos,/function recommendResource/);
  assert.match(videos,/yks:coach-resource-recommend/);
  assert.match(app,/yks:coach-resource-recommend/);
  assert.match(app,/type:"coach_note"/);
  assert.match(app,/operation:"resource_recommendation"/);
  assert.match(app,/collection\(db,"coachingActions"\)/);
  assert.match(css,/button\.recommend/);
  assert.match(css,/\.coach-playlist-detail-actions/);
});
