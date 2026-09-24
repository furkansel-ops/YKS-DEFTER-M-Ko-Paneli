const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Dashboard v2 dokuz koç ekranını ve ortak navigasyonu yükler',()=>{
  const html=read('index.html');
  const js=read('dashboard-v20.js');
  for(const label of ['Ana Sayfa','Öğrenciler','Programlar','Takip & Rapor','Deneme Analizi','Konular','Hata Defteri','Mesajlar','Ayarlar']){
    assert.ok(html.includes(label),label);
    assert.ok(js.includes(label),label);
  }
  assert.match(html,/dashboard-v20\.css\?v=3\.0\.0/);
  assert.match(html,/dashboard-v20\.js\?v=3\.0\.0/);
  assert.match(js,/PAGE_META/);
  assert.match(js,/homePage/);
  assert.match(js,/studentsPage/);
  assert.match(js,/programsPage/);
  assert.match(js,/reportsPage/);
  assert.match(js,/examsPage/);
  assert.match(js,/topicsPage/);
  assert.match(js,/errorsPage/);
  assert.match(js,/messagesPage/);
  assert.match(js,/settingsPage/);
  assert.doesNotThrow(()=>new Function(js));
});

test('Dashboard v2 mevcut Firebase katmanını çoğaltmaz ve core köprüsünü kullanır',()=>{
  const js=read('dashboard-v20.js');
  const app=read('app.js');
  assert.doesNotMatch(js,/initializeApp|getFirestore|onSnapshot|COLLECTIONS\./);
  assert.match(js,/__YKS_COACH_CORE__/);
  assert.match(app,/window\.__YKS_COACH_CORE__/);
  assert.match(app,/dashboardSnapshot/);
  assert.match(app,/emitCoachState/);
  assert.match(app,/openDashboardStudent/);
  assert.match(app,/connectDashboardStudent/);
  assert.match(app,/sendAction:\(studentUid,type,payload\)=>sendAction/);
});

test('Dashboard v2 gerçek paylaşımlardan program deneme konu hata ve ilerleme metrikleri üretir',()=>{
  const js=read('dashboard-v20.js');
  for(const token of ['minutes7','questions7','totalNet','topics','errorJournal','program','weeks','dn'])assert.ok(js.includes(token),token);
  assert.match(js,/weekInfo/);
  assert.match(js,/examInfo/);
  assert.match(js,/topicInfo/);
  assert.match(js,/errorCount/);
  assert.match(js,/aggregate/);
  assert.doesNotMatch(js,/Math\.random/);
});

test('Dashboard v2 öğrenci detayında mevcut güvenli sekmeleri açar',()=>{
  const js=read('dashboard-v20.js');
  const app=read('app.js');
  for(const tab of ['summary','program','exams','progress','topics','errors'])assert.ok(app.includes(`"${tab}"`),tab);
  assert.match(js,/data-student-detail/);
  assert.match(js,/data-detail-tab/);
  assert.match(js,/core\(\)\?\.selectStudent/);
  assert.match(js,/coachDetailBack/);
});

test('Mesaj ekranı yeni veri koleksiyonu uydurmadan coaching action üzerinden koç notu gönderir',()=>{
  const js=read('dashboard-v20.js');
  assert.match(js,/sendAction\?\.\(student\.studentUid,"coach_note"/);
  assert.match(js,/Öğrenciden gelen mesaj verisi henüz paylaşım sözleşmesinde olmadığı için/);
  assert.doesNotMatch(js,/messagesCollection|chatMessages|collection\(/);
});

test('Dashboard v2 aydınlık profesyonel görünüm ve responsive kırılımlar içerir',()=>{
  const css=read('dashboard-v20.css');
  for(const token of ['.coach-nav-v20','.coach-kpis','.coach-table','.coach-donut','.coach-chat-layout','.coach-settings-grid','.coach-modal-backdrop'])assert.ok(css.includes(token),token);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:460px\)/);
  assert.match(css,/--coach-bg:#f4f7fb/);
});


test('Dashboard v2.1 görsel taslaklardaki ana içerik bloklarını tamamlar',()=>{
  const js=read('dashboard-v20.js');
  for(const token of [
    'Bekleyen İşlemler','Hızlı İşlemler','Son Deneme Sonuçları','Sınıf Dağılımı',
    'Son Öğrenci Hareketleri','Öğrencinin Gerçek Haftalık Programı','Son Güncellemeler',
    'Konu Gezgini','Konu Detayı','Hata Kayıt Defteri','Kritik Hata Kuyruğu',
    'Güvenlik','Entegrasyonlar'
  ])assert.ok(js.includes(token),token);
  assert.match(js,/data-student-filter/);
  assert.match(js,/pendingItems/);
  assert.match(js,/recentExamTable/);
  assert.match(js,/gradeDistribution/);
});

test('Dashboard v2.1 üst bar bildirim ve profil durumunu canlı koç state ile günceller',()=>{
  const html=read('index.html');
  const js=read('dashboard-v20.js');
  const css=read('dashboard-v20.css');
  assert.match(html,/coachNotifyCount/);
  assert.match(html,/coachTopAvatar/);
  assert.match(js,/pendingItems\(99\)/);
  assert.match(js,/coachNotifyCount/);
  assert.match(css,/\.coach-notify-v20/);
  assert.match(css,/\.coach-home-main-grid/);
  assert.match(css,/\.coach-home-lower-grid/);
});


test('Her ana bölüm kendine özgü sayfa kompozisyonu kullanır',()=>{
  const js=read('dashboard-v20.js');
  const css=read('dashboard-v20.css');
  for(const token of ['coach-page-programs','coach-page-reports','coach-page-exams','coach-page-topics','coach-page-errors'])assert.ok(js.includes(token),token);
  for(const token of ['.programs-calendar-stage','.reports-hero-grid','.exam-lab-grid','.topics-workspace','.errors-workspace'])assert.ok(css.includes(token),token);
  assert.match(js,/Öğrencinin Gerçek Haftalık Programı/);
  assert.match(js,/Genel Performans Trendi/);
  assert.match(js,/Öğrenci Sıralaması/);
  assert.match(js,/Konu Gezgini/);
  assert.match(js,/Kritik Hata Kuyruğu/);
});


test('Programlar ana görünümü öğrencinin canonical Programım modelini birebir kullanır',()=>{
  const js=read('dashboard-v20.js');
  const css=read('dashboard-v20.css');
  assert.match(js,/rowLabels/);
  assert.match(js,/rowCount/);
  assert.match(js,/week\?\.data\?\.dn/);
  assert.match(js,/week\?\.data\?\.mv/);
  assert.match(js,/week\?\.data\?\.done/);
  assert.match(js,/canonicalProgramMirror/);
  assert.match(js,/data-program-week-shift/);
  assert.match(js,/data-program-select/);
  assert.doesNotMatch(js,/function programPreview\(/);
  assert.match(css,/\.canonical-program-grid/);
  assert.match(css,/\.canonical-program-cell\.is-done/);
  assert.match(css,/\.canonical-program-cell\.is-moved/);
});
