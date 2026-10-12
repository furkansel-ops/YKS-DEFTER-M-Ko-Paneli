const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('compact media styles are loaded after the established split workbench and never replace its layout',()=>{
  const html=read('index.html');
  const old=html.indexOf('coach-split-composer-v19.css?v=1.0.0');
  const compact=html.indexOf('coach-compact-videos-v20.css?v=1.0.0');
  assert.ok(old>0&&compact>old,'compact overrides must load last');
  assert.match(html,/id="coachV19VideoPane"/);
  assert.match(html,/id="coachV19Workbench"/);
  assert.match(html,/id="programTaskSend"/);
  assert.match(html,/id="programBuilderSubject"/);
  assert.match(html,/id="coachV19ShowVideos"/);
  assert.match(html,/id="coachV19ShowEditor"/);
});

test('right pane alone gets dense two-column horizontal video cards and smaller thumbnails',()=>{
  const css=read('coach-compact-videos-v20.css');
  assert.match(css,/\.coach-v19-video-pane \.coach-video-results\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-card:not\(\.skeleton\)\{[\s\S]*?grid-template-columns:92px minmax\(0,1fr\)/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-card:not\(\.skeleton\) \.coach-video-thumb\{[\s\S]*?grid-column:1/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-card:not\(\.skeleton\) \.coach-video-card-actions\{[\s\S]*?grid-column:1\/-1/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-card-actions button\{[\s\S]*?min-height:31px/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-card-body b\{[\s\S]*?font-size:10\.5px/);
  assert.doesNotMatch(css,/#programsPage|#coachVisualWeekBoard|\.coach-v14-week|\.coach-v19-left|#programTaskText|display:none!important/);
});

test('compact layout keeps teacher filters, playlist detail and actions usable',()=>{
  const css=read('coach-compact-videos-v20.css'),video=read('program-videos-v1.js');
  assert.match(css,/grid-template-areas:[\s\S]*?"scope mode"[\s\S]*?"subject topic"[\s\S]*?"teacher teacher"/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-filters>label:nth-of-type\(3\)\{grid-area:teacher\}/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-meta/);
  assert.match(css,/\.coach-v19-video-pane \.coach-video-more-row/);
  assert.match(video,/data-video-add/);
  assert.match(video,/data-playlist-video-add/);
  assert.match(video,/data-playlist-attach/);
  assert.match(video,/data-video-recommend/);
  assert.match(video,/function addToProgram/);
  assert.match(video,/yks:coach-video-attach/);
});

test('narrow desktop, tablets, phones, and reduced-motion retain readable cards',()=>{
  const css=read('coach-compact-videos-v20.css');
  assert.match(css,/@media \(min-width:911px\) and \(max-width:1190px\)/);
  assert.match(css,/@media \(max-width:910px\)/);
  assert.match(css,/@media \(max-width:600px\)/);
  assert.match(css,/@media \(max-width:375px\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/grid-template-columns:105px minmax\(0,1fr\)/);
  assert.match(css,/grid-template-columns:88px minmax\(0,1fr\)/);
  assert.match(css,/min-height:35px/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});
