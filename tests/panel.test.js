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

test('Program sekmesi YKS Defterim haftalık program veri sözleşmesini aynalar',()=>{
  const app=read('app.js');
  for(const token of ['rowLabels','weeks','done','dn','mv','Rutinler','Ders Programım','Bu hafta'])assert.ok(app.includes(token),token);
  for(const day of ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'])assert.ok(app.includes(day),day);
  assert.match(app,/programGrid\(model,week,"r","Rutinler"\)/);
  assert.match(app,/programGrid\(model,week,"s","Ders Programım"\)/);
  assert.match(app,/Haftalık ilerleme/);
  assert.match(app,/Tamamlanan gün/);
});

test('Programım v1.4 öğrenci görünümünü koç panelinde canlı kurar',()=>{
  const mirror=read('program-mirror-v14.js');
  for(const token of ['Haftalık plan · Klasik+','RUTİNLER','DERS PROGRAMIM','Günü tamamladım','Haftalık ilerleme','Önceki günden taşındı'])assert.ok(mirror.includes(token),token);
  for(const day of ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'])assert.ok(mirror.includes(day),day);
  assert.match(mirror,/student-program-day-chip/);
  assert.match(mirror,/student-program-week-overview/);
  assert.match(mirror,/student-program-moved/);
  assert.match(mirror,/student-program-day-done/);
  assert.match(mirror,/student-program-live-strip/);
  assert.match(mirror,/student-program-summary/);
  assert.match(mirror,/Taşındı/);
  assert.match(mirror,/tamamlanan gün/);
  assert.match(mirror,/MutationObserver/);
  assert.match(mirror,/canlı ve salt okunur olarak aynalar/);
  assert.match(mirror,/__YKS_COACH_PROGRAM_MIRROR__/);
  assert.doesNotThrow(()=>new Function(mirror));
});

test('Programım aynası mevcut canlı Firestore akışını bozmadan çalışır',()=>{
  const app=read('app.js');
  const mirror=read('program-mirror-v14.js');
  assert.match(app,/onSnapshot\(doc\(db,COLLECTIONS\.shares,uid\)/);
  assert.match(app,/watchSelectedShare/);
  assert.match(app,/renderSelected\(\)/);
  assert.doesNotMatch(mirror,/Firestore|setDoc|updateDoc|initializeApp/);
  assert.match(mirror,/document\.getElementById\("content"\)/);
  assert.match(mirror,/document\.getElementById\("syncPill"\)/);
});

test('Programım v1.4 haftalık koç özetini öğrencinin durumundan üretir',()=>{
  const mirror=read('program-mirror-v14.js');
  assert.match(mirror,/filled,done,moved/);
  assert.match(mirror,/planlanan/);
  assert.match(mirror,/tamamlanan/);
  assert.match(mirror,/taşınan/);
  assert.match(mirror,/dayDone\.filter\(Boolean\)\.length/);
  assert.match(mirror,/selectedWeekIsCurrent/);
});

test('seçili öğrencinin coachingShares belgesi canlı eşitlenir',()=>{
  const app=read('app.js');
  assert.match(app,/onSnapshot\(doc\(db,COLLECTIONS\.shares,uid\)/);
  assert.match(app,/watchSelectedShare/);
  assert.match(app,/Canlı eşitlendi/);
  assert.match(app,/renderSelected\(\)/);
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

test('GitHub Pages Programım v1.4 arayüzünü cache kırarak yükler',()=>{
  const html=read('index.html');
  const css=read('styles.css');
  const studentCss=read('ui-v11.css');
  const programCss=read('program-v12.css');
  const liveCss=read('program-live-v14.css');
  assert.match(html,/YKS Defterim · Koç Paneli/);
  assert.match(html,/app\.js\?v=1\.4\.0/);
  assert.match(html,/styles\.css\?v=1\.4\.0/);
  assert.match(html,/ui-v11\.css\?v=1\.4\.0/);
  assert.match(html,/program-v12\.css\?v=1\.4\.0/);
  assert.match(html,/program-live-v14\.css\?v=1\.4\.0/);
  assert.match(html,/program-mirror-v14\.js\?v=1\.4\.0/);
  assert.match(html,/Koçluk Merkezi/);
  assert.match(html,/Öğrencilerim/);
  assert.match(css,/grid-template-columns:320px minmax\(0,1fr\)/);
  assert.match(css,/welcome-card/);
  assert.match(css,/student-workspace/);
  assert.match(studentCss,/\.student\.on/);
  assert.match(programCss,/\.student-program-grid/);
  assert.match(programCss,/\.student-program-task\.is-done/);
  assert.match(programCss,/\.student-program-day-done/);
  assert.match(liveCss,/\.student-program-live-strip/);
  assert.match(liveCss,/\.student-program-summary/);
});
