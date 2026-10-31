const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('personal video library includes the five original channels and three Turkish teachers',()=>{
  const js=read('program-videos-v1.js');
  const block=js.slice(js.indexOf('const TEACHERS=['),js.indexOf('const TOPICS='));
  for(const name of ['Eyüp B.','3D Yayınları','Ferrum','Biosem','Özcan Aykın','Kadir Gümüş','Aker Kartal','Deniz Hoca']){
    assert.ok(block.includes('n:"'+name+'"'),name);
  }
  assert.equal([...block.matchAll(/\{n:"/g)].length,8,'only the eight explicitly selected teachers are available');
  for(const name of ['@EyupB','@3DYayınları','@yferrum','@Biosem','@ÖzcanAykınFİZİK-y2k','@kadirgumustürkçe','@akerkartall','@DenizHoca']){
    assert.ok(block.includes(name),name+' is the channel given by the user');
  }
  assert.match(js,/USER_TEACHERS_FEED="media\/my-teachers-feed.json"/);
  assert.match(js,/teachers-v2-feed.json/,'keep legacy media as a fallback');
  assert.match(read('index.html'),/program-videos-v1\.js\?v=1\.9\.4/);
});

test('all public videos are indexed in pages, not silently clipped to 240 or 500',()=>{
  const script=read('scripts/sync-selected-teachers.mjs');
  assert.match(script,/PAGE_SIZE=80/);
  assert.match(script,/primary\+"\/videos"/);
  assert.match(script,/primary\+"\/playlists"/);
  assert.match(script,/for\(let p=0;p<allVideos.length;p\+=PAGE_SIZE\)/);
  assert.match(script,/enriched\.flatMap\(x=>x\.videos\|\|\[\]\)/);
  assert.match(script,/contentComplete:Boolean\(total&&all\.length>=total\)/);
  assert.doesNotMatch(script,/--playlist-end|slice\(0,240\)|slice\(0,40\)/);
  // ABD sunucusunda YouTube otomatik İngilizce başlık döndürmesin; kanalın asıl (Türkçe) başlıkları gelsin.
  assert.match(script,/"--extractor-args","youtube:lang=tr","--add-headers","Accept-Language:tr-TR,tr;q=0\.9"/);
  assert.match(script,/Keeping previous catalog/);
});

test('coach can load additional archive pages and match playlists by contained videos',()=>{
  const js=read('program-videos-v1.js');
  assert.match(js,/nextArchiveIndex\(archive\)/);
  assert.match(js,/state\.hasMore=nextArchiveIndex\(archive\)>=0/);
  assert.match(js,/searching=Boolean\(state\.topic\|\|state\.query\|\|state\.category!=="all"\)/);
  assert.match(js,/playlistText=item\?\.kind==="playlist"/);
  assert.match(js,/if\(!topicMatches\(playlistText\)\)return false/);
  assert.match(js,/row\.match\.ayt\|\|!row\.match\.tyt/);
  assert.match(js,/row\.match\.tyt\|\|!row\.match\.ayt/);
  assert.match(js,/function coachVideoPickLabel\(\)\{return !\$\("coachVideoPickerBackdrop"\)/);
});

test('metadata refresh is scheduled and releases a page with same visible controls',()=>{
  const workflow=read('.github/workflows/sync-selected-teachers.yml');
  assert.match(workflow,/workflow_dispatch/);
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/pip install --quiet --upgrade yt-dlp/);
  assert.match(workflow,/node scripts\/sync-selected-teachers.mjs/);
  assert.match(workflow,/upload-pages-artifact/);
  assert.match(workflow,/deploy-pages/);
  const html=read('index.html');
  for(const id of ['programAddTaskBtn','programAddVideoBtn','programTaskSend','coachVideoPickerSave'])
    assert.ok(html.includes('id="'+id+'"'));
});
