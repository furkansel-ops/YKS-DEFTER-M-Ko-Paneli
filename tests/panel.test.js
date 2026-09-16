const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('panel bağımsız Firebase projesine bağlanır',()=>{
  const config=read('firebase-config.js');
  assert.match(config,/projectId:"yks-uygulamam"/);
  assert.match(config,/studentCoachCodes/);
  assert.match(config,/coachingShares/);
  assert.match(config,/coachingActions/);
});

test('koç paneli öğrenci koduyla güvenli bağlantı kurar',()=>{
  const app=read('app.js');
  assert.match(app,/\^\[A-Z2-9\]\{12\}\$/);
  assert.match(app,/COLLECTIONS\.studentCodes/);
  assert.match(app,/where\("coachUid","==",state\.user\.uid\)/);
  assert.doesNotMatch(app,/getDoc\(doc\(db,COLLECTIONS\.links,`\$\{studentUid\}_\$\{state\.user\.uid\}`\)\)/);
  assert.match(app,/accessCode,active:true/);
});

test('ana görünüm özet ve ayrı detay sekmeleri içerir',()=>{
  const app=read('app.js');
  for(const label of ['Özet','Program','Deneme','İlerleme','Konular','Hata Defteri'])assert.ok(app.includes(label));
  assert.match(app,/7 gün çalışma/);
  assert.match(app,/7 gün soru/);
  assert.match(app,/Geciken konu/);
  assert.match(app,/En çok hata yapılan konu/);
});

test('koç yalnız paylaşılan veri modeliyle çalışır',()=>{
  const app=read('app.js');
  assert.match(app,/COLLECTIONS\.shares/);
  assert.doesNotMatch(app,/users.*sync/);
  assert.doesNotMatch(app,/sync\/meta/);
});

test('koç görevleri kontrollü action kuyruğuna gönderilir',()=>{
  const app=read('app.js');
  assert.match(app,/COLLECTIONS\.actions/);
  assert.match(app,/status:"pending"/);
  for(const type of ['program_task','coach_note','post_exam_task','topic_deadline'])assert.ok(app.includes(type));
});

test('kayıt sayfası öğrenci hesabını koça çevirmeyi reddeder',()=>{
  const register=read('register.js');
  assert.match(register,/existing\.role==="coach"/);
  assert.match(register,/öğrenci hesabı olarak kayıtlı/);
  assert.match(register,/emailVerified/);
});

test('GitHub Pages ana sayfası yeni iki sütunlu paneli yükler',()=>{
  const html=read('index.html');
  const css=read('styles.css');
  const studentCss=read('ui-v11.css');
  assert.match(html,/YKS Defterim · Koç Paneli/);
  assert.match(html,/app\.js\?v=1\.1\.0/);
  assert.match(html,/styles\.css\?v=1\.1\.0/);
  assert.match(html,/ui-v11\.css\?v=1\.1\.0/);
  assert.match(html,/Koçluk Merkezi/);
  assert.match(html,/Öğrencilerim/);
  assert.match(css,/grid-template-columns:320px minmax\(0,1fr\)/);
  assert.match(css,/welcome-card/);
  assert.match(css,/student-workspace/);
  assert.match(studentCss,/\.student\.on/);
});
