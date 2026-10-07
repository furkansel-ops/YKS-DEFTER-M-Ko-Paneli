const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('playlist içi arama filtrelerken aç öner programa ekle doğru asıl videoyu hedefler',()=>{
  const source=read('program-videos-v1.js');
  assert.match(source,/const rows=videos\.map\(\(video,index\)=>\(\{video,index\}\)\)\.filter/);
  assert.match(source,/data-playlist-video-open="'\+index\+'"/);
  assert.match(source,/data-playlist-video-recommend="'\+index\+'"/);
  assert.match(source,/data-playlist-video-add="'\+index\+'"/);
  assert.match(source,/state\.selectedPlaylist\?\.videos\?\.\[Number\(playlistVideoRecommend\.dataset\.playlistVideoRecommend\)\]/);
  assert.match(source,/state\.selectedPlaylist\?\.videos\?\.\[Number\(playlistAdd\.dataset\.playlistVideoAdd\)\]/);
  assert.match(source,/state\.selectedPlaylist\?\.videos\?\.\[Number\(playlistOpen\.dataset\.playlistVideoOpen\)\]/);
});

test('konu ve koç önerisi aynı seçili öğrenci akışında taşınır',()=>{
  const videos=read('program-videos-v1.js');
  const app=read('app-reset.js');
  assert.match(videos,/function topicMatches/);
  assert.match(videos,/topic:compact\(state\.topic\)/);
  assert.match(videos,/yks:coach-resource-recommend/);
  assert.match(app,/coachReportRows\.find\(x=>x\.studentUid===selectedProgramStudentUid\)/);
  assert.match(app,/operation:"resource_recommendation"/);
  assert.match(app,/topic=String\(detail\.topic\|\|""\)/);
});
