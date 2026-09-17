const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('İlerleme v1.7 gerçek paylaşılan metriklerden analiz paneli kurar',()=>{
  const app=read('app.js');
  const progress=read('progress-live-v17.js');
  for(const token of ['7 gün çalışma','7 gün soru','Son net','Konu ilerleme','Tamamlanan konu','Aktif konu','Geciken konu','Kayıtlı deneme'])assert.ok(app.includes(token),token);
  for(const token of ['Canlı ilerleme analizi','Günlük çalışma ort.','Günlük soru ort.','Konu tamamlanma','Son net değişimi','Koç sinyalleri','Takip özeti'])assert.ok(progress.includes(token),token);
  assert.match(progress,/hours\/7/);
  assert.match(progress,/questions\/7/);
  assert.match(progress,/completed\/total\*100/);
  assert.doesNotMatch(progress,/başarı puanı|performance score|success score/i);
});

test('İlerleme v1.7 son iki denemeden gerçek net değişim grafiği üretir',()=>{
  const progress=read('progress-live-v17.js');
  for(const token of ['Son iki deneme','Önceki deneme','Son deneme','progress-chart','progress-delta'])assert.ok(progress.includes(token),token);
  assert.match(progress,/previous=latest-delta/);
  assert.match(progress,/polyline/);
  assert.match(progress,/En az iki deneme olduğunda/);
});

test('İlerleme v1.7 konu dağılımını çakışmasız tamamlanan aktif başlanmayan olarak gösterir',()=>{
  const progress=read('progress-live-v17.js');
  assert.match(progress,/remaining=Math\.max\(0,total-completed-active\)/);
  for(const token of ['Tamamlanan','Aktif','Başlanmayan','geciken'])assert.ok(progress.includes(token),token);
  assert.match(progress,/progress-topic-bar/);
  assert.match(progress,/completionPct/);
});

test('İlerleme v1.7 yalnız mevcut canlı DOM akışını geliştirir',()=>{
  const progress=read('progress-live-v17.js');
  assert.match(progress,/MutationObserver/);
  assert.match(progress,/document\.getElementById\(CONTENT_ID\)/);
  assert.match(progress,/progress-dashboard-head/);
  assert.match(progress,/__YKS_COACH_PROGRESS_V17__/);
  assert.doesNotMatch(progress,/initializeApp|getFirestore|coachingShares|setDoc|updateDoc/);
  assert.doesNotThrow(()=>new Function(progress));
});

test('İlerleme v1.7 sekmeye tekrar dönüldüğünde yeniden oluşturulabilir',()=>{
  const progress=read('progress-live-v17.js');
  assert.match(progress,/host\.querySelector\(":scope > \.progress-dashboard-head"\)/);
  assert.doesNotMatch(progress,/host\.dataset\.progressV17===VERSION/);
  assert.match(progress,/isProgressActive\(\)/);
});

test('İlerleme v1.7 ayrıntı sekmelerine hızlı geçiş verir',()=>{
  const progress=read('progress-live-v17.js');
  for(const token of ['Deneme analizini aç','Konuları aç','Programı aç','data-progress-tab'])assert.ok(progress.includes(token),token);
  assert.match(progress,/clickTab/);
});

test('GitHub Pages İlerleme v1.7 varlıklarını cache kırarak yükler',()=>{
  const html=read('index.html');
  const css=read('progress-live-v17.css');
  assert.match(html,/progress-live-v17\.css\?v=1\.7\.0/);
  assert.match(html,/progress-live-v17\.js\?v=1\.7\.0/);
  for(const token of ['.progress-dashboard-v17','.progress-insights','.progress-analysis-grid','.progress-chart','.progress-topic-bar','.progress-signals','.progress-shortcuts'])assert.ok(css.includes(token),token);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
});