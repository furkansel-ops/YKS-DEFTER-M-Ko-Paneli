const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(new URL('../'+file,'file://'+__filename), 'utf8');
test('seven-day viewport stylesheet is loaded after the existing visual and table styles',()=>{
  const html=read('index.html');
  const v16=html.indexOf('coach-table-only-v16.css?v=1.0.0');
  const v17=html.indexOf('coach-table-fit-v17.css?v=1.0.0');
  assert.ok(v16>0 && v17>v16);
  assert.match(html,/id="coachFutureProgramTable"/);
  assert.match(html,/id="coachVisualWeekBoard"/);
  assert.match(html,/id="programStudentSelect"/);
});
test('seven desktop columns fit their container rather than requiring a 170px minimum each',()=>{
  const css=read('coach-table-fit-v17.css');
  assert.match(css,/\.coach-v14-week:not\(\[data-layout="list"\]\)\{[\s\S]*?grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/\.coach-v14-week\[data-density="wide"\]:not\(\[data-layout="list"\]\)\{\s*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/\.coach-v12-card-stack\{[\s\S]*?max-height:none!important/);
  assert.match(css,/\.coach-v11-task\{[\s\S]*?min-height:0/);
  assert.match(css,/\.coach-v11-day-footer\{[\s\S]*?padding:5px 4px/);
  assert.doesNotMatch(css,/display:\s*none|line-clamp|max-height:\s*\d+px|overflow-y:\s*(hidden|scroll)/);
});
test('small screens permit horizontal movement without shrinking cards to illegibility',()=>{
  const css=read('coach-table-fit-v17.css');
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(138px,1fr\)\)/);
  assert.match(css,/overflow-x:auto/);
});
