const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('new 3/4 video stylesheet loads last and leaves the existing composer intact',()=>{
  const html=read('index.html');
  const v20=html.indexOf('coach-compact-videos-v20.css?v=1.0.0');
  const v21=html.indexOf('coach-video-grid-v21.css?v=1.0.0');
  assert.ok(v20>=0&&v21>v20);
  for(const name of ['programTaskSend','programBuilderSubject','coachV19VideoPane','coachV19Workbench','coachV19ShowEditor','coachV19ShowVideos'])assert.ok(html.includes('id="'+name+'"'));
});
test('video results show three cards on desktop and four cards on large desktop',()=>{
  const css=read('coach-video-grid-v21.css');
  assert.match(css,/@media \(min-width:1100px\)\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media \(min-width:1450px\)\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-columns:68px minmax\(0,1fr\)/);
  assert.match(css,/grid-template-columns:64px minmax\(0,1fr\)/);
  assert.match(css,/grid-template-rows:minmax\(66px,auto\) auto/);
  assert.match(css,/\.coach-video-card-actions button\{[\s\S]*?min-height:34px/);
});
test('compact results are responsive and cannot affect the weekly calendar or lesson form',()=>{
  const css=read('coach-video-grid-v21.css');
  assert.match(css,/@media \(min-width:911px\) and \(max-width:1099px\)/);
  assert.match(css,/@media \(max-width:910px\)/);
  assert.match(css,/@media \(max-width:600px\)/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/#programsPage|#coachVisualWeekBoard|\.coach-v14-week|\.coach-v19-left|#programTaskText|display:none!important/);
  assert.match(css,/grid-template-columns:minmax\(0,49fr\) minmax\(0,51fr\)/);
});
test('video and playlist linking still use the existing action hooks',()=>{
  const js=read('program-videos-v1.js');
  for(const token of ['data-video-add','data-playlist-video-add','data-playlist-attach','data-video-recommend','yks:coach-video-attach'])assert.ok(js.includes(token));
  assert.match(read('app-reset.js'),/yks:coach-video-attach/);
});
