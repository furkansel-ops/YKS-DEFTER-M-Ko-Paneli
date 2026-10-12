const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('last CSS gives the lesson modal a desktop-width one-screen composition',()=>{
  const html=read('index.html'),css=read('coach-task-one-screen-v23.css');
  const prior=html.indexOf('coach-lesson-only-v22.css?v=1.0.0');
  const current=html.indexOf('coach-task-one-screen-v23.css?v=1.0.0');
  assert.ok(prior>=0&&current>prior);
  assert.match(css,/width:min\(1060px,calc\(100vw - 32px\)\)/);
  assert.match(css,/height:min\(700px,calc\(100dvh - 20px\)\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(css,/"builder date"[\s\S]*?"builder days"[\s\S]*?"quick task"[\s\S]*?"keep task"[\s\S]*?"info info"/);
  assert.match(css,/grid-area:builder/);
  assert.match(css,/grid-area:days/);
  assert.match(css,/grid-area:task/);
  assert.match(css,/grid-area:keep/);
  assert.match(css,/grid-area:info/);
});

test('all main fields and both save actions stay in the always-visible task form',t=>{
  const dom=new JSDOM(read('index.html'),{url:'https://coach.test/'});
  t.after(()=>dom.window.close());
  const root=dom.window.document;
  const body=root.querySelector('.coach-v19-left>.program-task-body');
  const footer=root.querySelector('.coach-v19-left>footer');
  assert.ok(body&&footer);
  for(const id of ['programBuilderLevel','programBuilderSubject','programBuilderTopic',
    'programBuilderActivity','programBuilderCount','programBuilderApply',
    'programTaskDate','programTaskDayGrid','programDaysWeekdays','programDaysAll',
    'programDaysClear','programTaskDayCount','programTaskText','programTaskKeepOpen']){
    assert.ok(body.contains(root.getElementById(id)),id+' must remain accessible');
  }
  for(const id of ['programTaskCancel','programTaskAddDraft','programTaskSend','programTaskDelete']){
    assert.ok(footer.contains(root.getElementById(id)),id+' must remain accessible');
  }
  assert.equal(root.querySelector('.coach-v19-mobile-tabs').hidden,true);
  assert.equal(root.getElementById('coachV19VideoPane').hidden,true);
});

test('layout compacts fields and day chips without hiding them or changing user data',()=>{
  const css=read('coach-task-one-screen-v23.css');
  assert.match(css,/\.coach-v18-fields input,[\s\S]*?height:34px/);
  assert.match(css,/\.coach-fast-day-grid button\{[\s\S]*?min-height:43px/);
  assert.match(css,/\.coach-v18-task-text textarea\{[\s\S]*?min-height:74px/);
  assert.match(css,/\.coach-v19-left>footer\{[\s\S]*?min-height:57px/);
  assert.match(css,/overflow-y:auto/,'zoom and unexpected content must never be clipped');
  assert.doesNotMatch(css,/#programsPage|#coachVisualWeekBoard|\.coach-v14-week|\.coach-v19-video-pane/);
  const app=read('app-reset.js');
  assert.match(app,/programTaskSend/);
  assert.match(app,/coachingActions/);
});

test('edit mode and small devices preserve correct controls and readable fallback',()=>{
  const css=read('coach-task-one-screen-v23.css');
  assert.match(css,/\[data-editing\] \.coach-v19-left>\.program-task-body\{[\s\S]*?"date task"[\s\S]*?"video task"/);
  assert.match(css,/\[data-editing\] \.coach-v22-legacy-video-link\{[\s\S]*?grid-area:video/);
  assert.match(css,/@media\(min-width:731px\) and \(max-height:650px\)/);
  assert.match(css,/@media\(max-width:730px\)/);
  assert.match(css,/"builder"[\s\S]*?"date"[\s\S]*?"days"[\s\S]*?"task"[\s\S]*?"keep"/);
  assert.match(css,/@media\(max-width:420px\)/);
});
