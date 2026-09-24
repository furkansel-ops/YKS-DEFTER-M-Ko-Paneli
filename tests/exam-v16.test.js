const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Deneme v1.6 mevcut canlı panel DOM akışını geliştirir',()=>{
  const js=read('exam-live-v16.js');
  for(const token of ['Canlı deneme analizi','Son deneme','Ortalama','En yüksek','Deneme sayısı','Net trendi','Deneme geçmişi','Deneme sonrası görev'])assert.ok(js.includes(token),token);
  assert.match(js,/MutationObserver/);
  assert.match(js,/document\.getElementById\(TAB_ID\)/);
  assert.match(js,/requestAnimationFrame/);
  assert.match(js,/__YKS_COACH_EXAM_V16__/);
  assert.doesNotThrow(()=>new Function(js));
});

test('Deneme v1.6 Firebase katmanını çoğaltmadan çalışır',()=>{
  const js=read('exam-live-v16.js');
  assert.doesNotMatch(js,/initializeApp|getFirestore|setDoc|updateDoc|onSnapshot/);
  assert.match(js,/form\[data-action='post_exam_task'\]/);
  assert.match(js,/İlerleme analizine geç/);
  assert.match(js,/Hata Defteri’ni aç/);
});

test('Deneme v1.6 görev önerileri mevcut kontrollü action formunu kullanır',()=>{
  const js=read('exam-live-v16.js');
  for(const token of ['Yanlış çıkan konuları tekrar et','En düşük netli dersten 40 soru çöz','Deneme yanlışlarını Hata Defteri’ne işle'])assert.ok(js.includes(token),token);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage/);
});

test('Deneme v1.6 responsive stil ve trend bileşenlerini içerir',()=>{
  const css=read('exam-live-v16.css');
  for(const token of ['.exam-dashboard-v16','.exam-metrics','.exam-trend-panel','.exam-history-row','.exam-action-card','.exam-presets'])assert.ok(css.includes(token),token);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
});

test('GitHub Pages Deneme v1.6 assetlerini yükler',()=>{
  const html=read('index.html');
  assert.match(html,/exam-live-v16\.css\?v=1\.6\.0/);
  assert.match(html,/exam-live-v16\.js\?v=1\.6\.0/);
  assert.match(html,/summary-live-v15\.js\?v=1\.5\.0/);
  assert.match(html,/program-mirror-v14\.js\?v=1\.6\.0/);
});
