const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Programlar öğrenci seçici üst barda ve tablo tam genişlikte çalışır',()=>{
  const html=read('index.html'),css=read('programs-v21.css'),js=read('app-reset.js');

  assert.match(html,/class="program-student-picker"/);
  assert.match(html,/id="programStudentSelect"/);
  assert.match(html,/<span>Öğrencilerim<\/span>/);
  assert.doesNotMatch(html,/class="program-students"/);
  assert.doesNotMatch(html,/id="programStudentList"/);
  assert.match(html,/programs-v21\.css\?v=3\.3\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.45/);

  assert.match(css,/v3\.2 — full-width program board/);
  assert.match(css,/\.program-layout\{display:block\}/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(150px,1fr\)\)/);
  assert.match(css,/\.day-column\{min-height:360px\}/);

  assert.match(js,/const select=\$\("programStudentSelect"\)/);
  assert.match(js,/select\.innerHTML=coachReportRows\.map/);
  assert.match(js,/selectedProgramStudentUid=event\.target\.value\|\|""/);
  assert.match(js,/hydrateProgramStudents\(\);\s*renderProgramWorkspace\(\)/);
});
