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

test('Özet v1.5 canlı metrikleri ve dört çalışma panelini güçlendirir',()=>{
  const summary=read('summary-live-v15.js');
  const css=read('summary-live-v15.css');
  for(const token of ['7 gün çalışma','7 gün soru','Son deneme','Geciken konu','Dikkat edilmesi gerekenler','Programdan son görevler','Son denemeler','Hızlı işlemler'])assert.ok(summary.includes(token),token);
  for(const token of ['Canlı öğrenci özeti','Kritik uyarı görünmüyor','Tamamlandı','Bekliyor','Programı aç','Denemeleri aç','Konulara git'])assert.ok(summary.includes(token),token);
  assert.match(summary,/MutationObserver/);
  assert.match(summary,/summary-dashboard-v15/);
  assert.match(summary,/__YKS_COACH_SUMMARY_V15__/);
  assert.doesNotMatch(summary,/initializeApp|getFirestore|setDoc|updateDoc/);
  assert.match(css,/\.summary-metric/);
  assert.match(css,/\.summary-attention/);
  assert.match(css,/\.summary-program/);
  assert.match(css,/\.summary-exams/);
  assert.match(css,/\.summary-actions/);
  assert.doesNotThrow(()=>new Function(summary));
});

test('Özet v1.5 mevcut güvenli action formlarını korur',()=>{
  const app=read('app.js');
  const summary=read('summary-live-v15.js');
  assert.match(app,/data-action="program_task"/);
  assert.match(app,/data-action="coach_note"/);
  assert.match(summary,/summary-action-form/);
  assert.match(summary,/data-summary-tab/);
  assert.doesNotMatch(summary,/coachingActions|COLLECTIONS\.actions/);
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
  assert.doesNotMatch(mirror,/setDoc|updateDoc|initializeApp|getFirestore/);
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
  const topics=read('topics-live-v18.mjs');
  for(const type of ['program_task','coach_note','post_exam_task','topic_deadline'])assert.ok((app+topics).includes(type));
});

test('kayıt sayfası öğrenci hesabını koça çevirmeyi reddeder',()=>{
  const register=read('register.js');
  assert.match(register,/existing\.role==="coach"/);
  assert.match(register,/öğrenci hesabı olarak kayıtlı/);
  assert.match(register,/emailVerified/);
});

test('GitHub Pages Programım v1.4 ve Özet v1.5 arayüzünü cache kırarak yükler',()=>{
  const html=read('index.html');
  const css=read('styles.css');
  const studentCss=read('ui-v11.css');
  const programCss=read('program-v12.css');
  const liveCss=read('program-live-v14.css');
  const summaryCss=read('summary-live-v15.css');
  assert.match(html,/YKS Defterim · Koç Paneli/);
  assert.match(html,/app\.js\?v=1\.8\.0/);
  assert.match(html,/styles\.css\?v=1\.5\.0/);
  assert.match(html,/ui-v11\.css\?v=1\.5\.0/);
  assert.match(html,/program-v12\.css\?v=1\.5\.0/);
  assert.match(html,/program-live-v14\.css\?v=1\.5\.0/);
  assert.match(html,/program-mirror-v14\.js\?v=1\.5\.0/);
  assert.match(html,/summary-live-v15\.css\?v=1\.5\.0/);
  assert.match(html,/summary-live-v15\.js\?v=1\.5\.0/);
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
  assert.match(summaryCss,/\.summary-dashboard-v15/);
});


test('Program v1.9 koç takvimini ve günlük plan detayını yükler',()=>{
  const html=read('index.html');
  const js=read('program-calendar-v19.js');
  const css=read('program-calendar-v19.css');
  assert.match(html,/program-calendar-v19\.css\?v=1\.9\.0/);
  assert.match(html,/program-calendar-v19\.js\?v=1\.9\.0/);
  for(const token of ['Haftalık plan','Takvim','Günün planı','Plan sadakati','Erteleme analizi'])assert.ok(js.includes(token),token);
  assert.match(js,/program-card/);
  assert.match(js,/data-cal-date/);
  assert.match(css,/\.coach-calendar-grid/);
  assert.doesNotThrow(()=>new Function(js));
});
