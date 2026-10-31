const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');

test('biyoloji only Biosem, fizik only Özcan, and Türkçe has all 3 requested teachers',()=>{
 const js=read('program-videos-v1.js'),table=js.slice(js.indexOf('const TEACHERS=['),js.indexOf('const FEATURED_PLAYLISTS='));
 const rows=[...table.matchAll(/\{n:"([^"]+)",d:\[([^\]]+)\]/g)]
   .map(m=>({name:m[1],subjects:[...m[2].matchAll(/"([^"]+)"/g)].map(x=>x[1])}));
 assert.equal(rows.length,8);
 const namesFor=subject=>rows.filter(x=>x.subjects.includes(subject)).map(x=>x.name);
 assert.deepEqual(namesFor('Biyoloji'),['Biosem']);
 assert.deepEqual(namesFor('Biyoloji (AYT)'),['Biosem']);
 assert.deepEqual(namesFor('Fizik'),['Özcan Aykın']);
 assert.deepEqual(namesFor('Fizik (AYT)'),['Özcan Aykın']);
 assert.deepEqual(namesFor('Türkçe'),['Kadir Gümüş','Aker Kartal','Deniz Hoca']);
 assert.deepEqual(namesFor('Edebiyat'),['Kadir Gümüş','Aker Kartal','Deniz Hoca']);
});

test('official YKS playlists pinned independently of sparse /playlists channel tab',()=>{
 const js=read('program-videos-v1.js'),script=read('scripts/sync-selected-teachers.mjs');
 for(const id of [
   'PLhhV4F6NB0-uEPdZncMf_qb0tSKyBM-Lf',
   'PLhhV4F6NB0-tU__PwCFhnaK-Gg_I3JG_4',
   'PLqLwBmByktJWbDXnjbl5CMRrm5nEwMFOg',
   'PL5w_hbb3voMkxc2sU0JxNY88-kZ8bVmxq',
   'PL5w_hbb3voMmqux0of19HHOOcQT4j_Wzg'
 ]){
   assert.ok(js.includes(id),'front-end pinned source '+id);
   assert.ok(script.includes(id),'catalog sync pinned source '+id);
 }
 assert.match(script,/PINNED_YKS_PLAYLISTS\[name\]/);
 assert.match(script,/playlists=unique/);
 assert.match(js,/byId\.get\(item\.id\)/,'prefer scan data when pinned list is also archived');
 assert.match(js,/item\.videos\.length>existing\.videos\.length/);
 assert.match(js,/s\[ıi\]n\[ıi\]f/,'non-YKS grade lists are filtered out');
 assert.match(script,/channel\.name==="Biosem"/,'Biosem foreign uploader must be excluded');
});

test('updated sources keep original task sending flow and show new asset version',()=>{
 const html=read('index.html'),js=read('program-videos-v1.js');
 assert.match(html,/program-videos-v1\.js\?v=1\.9\.6/);
 assert.match(html,/id="programAddVideoBtn"/);
 assert.match(html,/id="programAddTaskBtn"/);
 assert.match(js,/yks:coach-video-picked/);
 assert.match(js,/yks:coach-video-attach/);
 assert.match(js,/type="button" data-playlist-back/);
});
