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
  assert.match(app,/accessCode,active:true/);
});

test('öğrenci detay sekmeleri yeni core üzerinden render edilir',()=>{
  const app=read('app.js');
  const css=read('dashboard-v20.css');
  for(const label of ['Özet','Program','Deneme','İlerleme','Konular','Hata Defteri'])assert.ok(app.includes(label),label);
  for(const fn of ['renderSummary','renderProgram','renderExams','renderProgress','renderTopics','renderErrors'])assert.match(app,new RegExp('function '+fn));
  assert.doesNotMatch(app,/topics-live-v18/);
  assert.match(css,/v3 · Yeni öğrenci detay teması/);
  assert.match(css,/\.coach-student-detail-v20 \.hero/);
  assert.match(css,/\.coach-student-detail-v20 \.tab\.on/);
  assert.match(css,/\.detail-v20-split/);
});

test('Program detay görünümü gerçek öğrenci Programım sözleşmesini korur',()=>{
  const app=read('app.js');
  for(const token of ['rowLabels','weeks','done','dn','mv','Rutinler','Ders Programım','Bu hafta'])assert.ok(app.includes(token),token);
  for(const day of ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'])assert.ok(app.includes(day),day);
  assert.match(app,/programGrid\(model,week,"r","Rutinler"\)/);
  assert.match(app,/programGrid\(model,week,"s","Ders Programım"\)/);
  assert.match(app,/onSnapshot\(doc\(db,COLLECTIONS\.shares,uid\)/);
});

test('koç görevleri kontrollü action kuyruğuna gönderilir',()=>{
  const app=read('app.js');
  assert.match(app,/COLLECTIONS\.actions/);
  assert.match(app,/status:"pending"/);
  for(const type of ['program_task','coach_note','post_exam_task'])assert.ok(app.includes(type),type);
});

test('eski detay tema ve enhancer assetleri artık yüklenmez',()=>{
  const html=read('index.html');
  const forbidden=[
    'program-v12.css','program-live-v14.css','program-calendar-v19.css','program-calendar-v19.js',
    'program-mirror-v14.js','summary-live-v15.css','summary-live-v15.js',
    'exam-live-v16.css','exam-live-v16.js','progress-live-v17.css','progress-live-v17.js',
    'topics-live-v18.css','topics-live-v18.mjs'
  ];
  for(const file of forbidden)assert.ok(!html.includes(file),file);
  assert.match(html,/core-v20\.css\?v=2\.3\.0/);
  assert.match(html,/dashboard-v20\.css\?v=3\.0\.0/);
  assert.match(html,/app\.js\?v=3\.0\.0/);
  assert.match(html,/dashboard-v20\.js\?v=3\.0\.0/);
});

test('yeni detay programı eski CSS olmadan kendi stillerine sahiptir',()=>{
  const css=read('dashboard-v20.css');
  for(const token of ['.program-live-note','.program-toolbar','.program-layout','.program-table','.program-cell.is-done','.program-cell.is-moved'])assert.ok(css.includes(token),token);
});

test('kayıt sayfası öğrenci hesabını koça çevirmeyi reddeder',()=>{
  const register=read('register.js');
  assert.match(register,/existing\.role==="coach"/);
  assert.match(register,/öğrenci hesabı olarak kayıtlı/);
  assert.match(register,/emailVerified/);
});
