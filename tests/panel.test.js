const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));

test('panel yalnız sol menü ve boş çalışma alanı ile açılır',()=>{
  const html=read('index.html');
  for(const label of ['Ana Sayfa','Öğrenciler','Programlar','Deneme Analizi','Konular','Hata Defteri','Mesajlar','Ayarlar'])assert.ok(html.includes(label),label);
  assert.match(html,/Takip &amp; Rapor/);
  assert.match(html,/class="sidebar coach-sidebar-v20"/);
  assert.match(html,/class="coach-reset-canvas"/);
  assert.doesNotMatch(html,/coach-topbar-v20|dashboardView|studentView|coachPageTitle|coachGlobalSearch|syncPill|coachNotifyCount/);
});

test('eski sağ taraf dashboard dosyaları repodan silinmiştir',()=>{
  for(const file of ['app.js','dashboard-v20.js','dashboard-v20.css','core-v20.css'])assert.equal(exists(file),false,file);
  assert.equal(exists('app-reset.js'),true);
  assert.equal(exists('sidebar-v20.css'),true);
  assert.equal(exists('base-reset.css'),true);
});

test('index sadece reset runtime ve sidebar stillerini yükler',()=>{
  const html=read('index.html');
  assert.match(html,/base-reset\.css\?v=1\.0\.0/);
  assert.match(html,/sidebar-v20\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.\d+/);
  assert.doesNotMatch(html,/dashboard-v20|app\.js\?|core-v20/);
});

test('sol menü görünümü ve mobil açılışı korunur',()=>{
  const css=read('sidebar-v20.css');
  const js=read('app-reset.js');
  assert.match(css,/\.coach-sidebar-v20/);
  assert.match(css,/\.coach-nav-item\.on/);
  assert.match(css,/\.coach-profile-v20/);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(js,/openSidebar/);
  assert.match(js,/closeSidebar/);
  assert.match(js,/data-coach-page/);
  assert.doesNotThrow(()=>new Function(js.replace(/^import[^\n]+\n/gm,'')));
});

test('koç girişi ve profil bilgisi reset runtime içinde korunur',()=>{
  const js=read('app-reset.js');
  assert.match(js,/initializeApp/);
  assert.match(js,/getAuth/);
  assert.match(js,/loadCoachProfile/);
  assert.match(js,/profile\?\.role==="coach"/);
  assert.match(js,/coachSidebarName/);
  assert.match(js,/coachSidebarAvatar/);
  assert.match(js,/signOut/);
});

test('kayıt ekranı minimal reset stilini kullanır',()=>{
  const html=read('register.html');
  const register=read('register.js');
  assert.match(html,/base-reset\.css\?v=1\.0\.0/);
  assert.doesNotMatch(html,/core-v20|dashboard-v20/);
  assert.match(register,/existing\.role==="coach"/);
  assert.match(register,/öğrenci hesabı olarak kayıtlı/);
  assert.match(register,/emailVerified/);
});


test('koç program oluşturucu öğrenci Programım alanlarını taşır',()=>{
  const html=read('index.html');
  const js=read('app-reset.js');
  for(const id of ['programQuickTab','programCustomTab','programTaskSubject','programTaskTopic','programTaskQuestions','programTaskMinutes','programTaskVideo','programTaskPreview','programTaskDestination'])assert.ok(html.includes('id="'+id+'"'),id);
  for(const day of ['0','1','2','3','4','5','6'])assert.ok(html.includes('data-program-day="'+day+'"'),'day '+day);
  assert.match(js,/COACH_PROGRAM_SUBJECTS/);
  assert.match(js,/Promise\.all\(days\.map/);
  assert.match(js,/payload:\{text:task,date:coachProgramDateForDay\(day\)\}/);
  assert.match(js,/weekLabel\+" haftası/);
});


test('koç paneli öğrenci programını F5 olmadan canlı dinler',()=>{
  const js=read('app-reset.js');
  assert.match(js,/onSnapshot\(doc\(db,"coachingShares",row\.studentUid\)/);
  assert.match(js,/target\.share=snap\.exists\(\)\?snap\.data\(\):null/);
  assert.match(js,/scheduleCoachRealtimeRender/);
  assert.match(js,/renderProgramWorkspace\(\)/);
  assert.match(js,/stopCoachShareRealtime/);
});


test('koç günlük program kartları sürüklenerek sıralanır',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('programs-v21.css');
  assert.match(js,/type:"program_order"/);
  assert.match(js,/saveCoachProgramOrder/);
  assert.match(js,/data-program-drag/);
  assert.match(js,/pointerdown/);
  assert.match(js,/ArrowUp/);
  assert.match(css,/program-drag-handle/);
  assert.match(html,/app-reset\.js\?v=1\.0\.27/);
});
