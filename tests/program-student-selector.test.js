const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Programlar öğrenci seçici üst barda ve tablo tam genişlikte çalışır',()=>{
  const html=read('index.html'),css=read('program-classic-v1.css'),js=read('app-reset.js');

  assert.match(html,/class="program-student-picker"/);
  assert.match(html,/id="programStudentSelect"/);
  assert.match(html,/<span>Öğrencilerim<\/span>/);
  assert.doesNotMatch(html,/class="program-students"/);
  assert.doesNotMatch(html,/id="programStudentList"/);
  assert.match(html,/programs-v21\.css\?v=3\.5\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70/);

  assert.match(css,/student-program-scroller/);
  assert.match(css,/student-program-grid/);
  assert.match(html,/class="program-student-shell"/);
  assert.doesNotMatch(html,/class="week-board"/);

  assert.match(js,/const select=\$\("programStudentSelect"\)/);
  assert.match(js,/select\.innerHTML=coachReportRows\.map/);
  assert.match(js,/selectedProgramStudentUid=event\.target\.value\|\|""/);
  assert.match(js,/hydrateProgramStudents\(\);\s*renderProgramWorkspace\(\)/);
});
