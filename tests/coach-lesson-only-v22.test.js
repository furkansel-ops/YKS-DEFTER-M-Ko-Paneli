const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Çalışma Ekle shows one lesson pane and keeps the old media components dormant',t=>{
  const dom=new JSDOM(read('index.html'),{url:'https://coach.test/'});
  t.after(()=>dom.window.close());
  const root=dom.window.document;
  const workbench=root.getElementById('coachV19Workbench');
  const media=root.getElementById('coachV19VideoPane');
  const tabs=root.querySelector('.coach-v19-mobile-tabs');
  const left=workbench.querySelector('.coach-v19-left');
  assert.ok(left);
  assert.equal(workbench.dataset.activePane,'program');
  assert.equal(media.hidden,true,'video pane must start hidden');
  assert.equal(tabs.hidden,true,'mobile video tab must start hidden');
  assert.ok(left.contains(root.getElementById('programBuilderSubject')));
  assert.ok(left.contains(root.getElementById('programBuilderTopic')));
  assert.ok(left.contains(root.getElementById('programTaskDayGrid')));
  assert.ok(left.contains(root.getElementById('programTaskText')));
  assert.ok(left.contains(root.getElementById('programTaskSend')));
  assert.ok(media.querySelector('#coachV19Linked'),'media code/markup remains available for future reuse');
});

test('last stylesheet returns form to full-width single column at all breakpoints',()=>{
  const html=read('index.html'),css=read('coach-lesson-only-v22.css');
  const prior=html.indexOf('coach-video-grid-v21.css?v=1.0.0');
  const last=html.indexOf('coach-lesson-only-v22.css?v=1.0.0');
  assert.ok(prior>0&&last>prior);
  assert.match(css,/width:min\(790px,calc\(100vw - 24px\)\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/grid-template-rows:minmax\(0,1fr\)/);
  assert.match(css,/\.coach-v19-video-pane\[hidden\]/);
  assert.match(css,/\.coach-v19-mobile-tabs\[hidden\]/);
  assert.match(css,/@media\(max-width:910px\)/);
  assert.doesNotMatch(css,/#coachVisualWeekBoard|#programsPage|\.coach-v14-week/);
});

test('video URL is hidden for new lessons, available for editing older linked tasks',()=>{
  const html=read('index.html'),css=read('coach-lesson-only-v22.css');
  assert.match(html,/class="coach-v22-legacy-video-link"/);
  assert.match(html,/id="programTaskVideo"/);
  assert.match(css,/\.program-task-backdrop:not\(\[data-editing\]\) \.coach-v22-legacy-video-link\{[\s\S]*?display:none!important/);
  assert.match(css,/\.program-task-backdrop\[data-editing\] \.coach-v22-legacy-video-link\{[\s\S]*?display:grid/);
  assert.match(read('app-reset.js'),/programTaskVideo/);
});

test('media runtime is retained but blocks fetch while the video panel is hidden',()=>{
  const html=read('index.html'),video=read('program-videos-v1.js');
  assert.match(html,/program-videos-v1\.js\?v=1\.9\.4/);
  assert.match(video,/const ROOT_ID="programVideoLibrary"/);
  assert.match(video,/function buildShell\(\)/);
  assert.match(video,/function recommendResource\(item\)/);
  assert.match(video,/function addToProgram\(item\)/);
  assert.match(video,/yks:coach-program-editor-open"[\s\S]*?if\(\$\("coachV19VideoPane"\)\?\.hidden\)return/);
  assert.match(video,/yks:coach-video-filters"[\s\S]*?if\(\$\("coachV19VideoPane"\)\?\.hidden\)return/);
  assert.match(read('index.html'),/id="programTaskDelete"/);
  assert.match(read('index.html'),/id="programTaskAddDraft"/);
});
