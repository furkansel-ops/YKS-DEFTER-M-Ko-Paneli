const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Programlar öğrenci seçici kompakt ve seçime bağlı çalışır',()=>{
  const html=read('index.html'),css=read('programs-v21.css'),js=read('app-reset.js');

  assert.match(html,/<b>Öğrencilerim<\/b>/);
  assert.doesNotMatch(html,/id="programStudentSearch"/);
  assert.match(html,/programs-v21\.css\?v=3\.1\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.40/);

  assert.match(css,/v3\.1 — compact student selector/);
  assert.match(css,/\.program-students\{align-self:start;min-height:0/);
  assert.match(css,/\.program-student-list\{margin:10px 0 0/);

  assert.match(js,/aria-pressed/);
  assert.match(js,/active\?"Seçili · ":""/);
  assert.match(js,/selectedProgramStudentUid=button\.dataset\.programStudent/);
  assert.match(js,/hydrateProgramStudents\(\);\s*renderProgramWorkspace\(\)/);
});
