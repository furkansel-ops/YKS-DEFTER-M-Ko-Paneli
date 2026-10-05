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
  assert.match(html,/base-reset\.css\?v=1\.0\.1/);
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
  assert.match(html,/base-reset\.css\?v=1\.0\.1/);
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






test('program kartlarında sürükleme yerine seç-taşı ve düzenle kontrolleri vardır',()=>{
  const js=read('app-reset.js'),css=read('programs-v21.css'),html=read('index.html');
  assert.doesNotMatch(js,/bindCoachProgramReorder/);
  assert.doesNotMatch(js,/data-program-drag/);
  assert.match(js,/data-program-select/);
  assert.match(js,/data-program-edit/);
  assert.match(js,/openCoachMoveMenu/);
  assert.match(js,/openCoachProgramEdit/);
  assert.match(js,/operation:"move"/);
  assert.match(js,/operation:"edit"/);
  assert.match(css,/program-select-task/);
  assert.match(css,/program-edit-task/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});


test('koç program takvimi kayıtlı hafta sınırına bağlı değildir',()=>{
  const js=read('app-reset.js'),html=read('index.html');
  assert.match(js,/let selectedProgramWeekStart=""/);
  assert.match(js,/function shiftProgramWeek/);
  assert.match(js,/return weeks\.find\(item=>item\?\.week===selectedProgramWeekStart\)\|\|\{week:selectedProgramWeekStart,data:\{\}\}/);
  assert.match(js,/selectedProgramWeekStart=shiftProgramWeek\(activeProgramWeek\(row\)\.week,-1\)/);
  assert.match(js,/selectedProgramWeekStart=shiftProgramWeek\(activeProgramWeek\(row\)\.week,1\)/);
  assert.match(js,/selectedProgramWeekStart=programCurrentWeekStart\(\)/);
  assert.doesNotMatch(js,/selectedProgramWeekIndex/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});


test('öğrenciler bölümünde bağlantıyı güvenli şekilde silme aksiyonu vardır',()=>{
  const js=read('app-reset.js'),css=read('students-v21.css'),html=read('index.html');
  assert.match(js,/data-remove-student/);
  assert.match(js,/function removeCoachStudent/);
  assert.match(js,/active:false,endedAt:serverTimestamp\(\),updatedAt:serverTimestamp\(\)/);
  assert.match(js,/Öğrencinin YKS Defterim hesabı ve verileri silinmez/);
  assert.doesNotMatch(js,/deleteDoc\(/);
  assert.match(css,/student-remove/);
  assert.match(html,/students-v21\.css\?v=2\.3\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});


test('sayfa yenilenirken giriş ekranı parlamaz',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('base-reset.css');
  assert.match(html,/id="bootView" class="coach-boot"/);
  assert.match(html,/id="authView" class="auth-page hidden"/);
  assert.match(js,/function finishBoot/);
  assert.match(js,/function showAuth[\s\S]*finishBoot\(\)/);
  assert.match(js,/function showApp[\s\S]*finishBoot\(\)/);
  assert.match(css,/\.coach-boot/);
  assert.match(html,/base-reset\.css\?v=1\.0\.1/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});


test('koç ana ekranı öğrencilerin gün sonu notlarını canlı gösterir',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('dashboard-v21.css');
  assert.match(html,/id="dashboardDayReviews"/);
  assert.match(html,/Gün Sonu Notları/);
  assert.match(js,/function studentDayReview/);
  assert.match(js,/progress\?\.dayReview\?\.entries/);
  assert.match(js,/function renderDashboardDayReviews/);
  assert.match(js,/dayReviewMoodMeta/);
  assert.match(js,/renderCoachRealtimeViews\(\)[\s\S]*renderDashboardDayReviews/);
  assert.match(css,/dashboard-day-review-row/);
  assert.match(html,/dashboard-v21\.css\?v=1\.3\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});


test('gün sonu entegrasyonu ana özet ve öğrenci geçmişi içerir',()=>{
  const html=read('index.html'),js=read('app-reset.js'),dash=read('dashboard-v21.css'),reports=read('reports-v21.css');
  assert.match(html,/id="dashboardDayReviewSummary"/);
  assert.match(html,/id="reportDayReviewHistory"/);
  assert.match(js,/function studentDayReviews/);
  assert.match(js,/data-day-review-student/);
  assert.match(js,/showCoachPage\("reports"\)/);
  assert.match(js,/studentDayReviews\(row\)\.slice\(0,7\)/);
  assert.match(js,/reportDayReviewLatest/);
  assert.match(dash,/dashboard-day-review-summary/);
  assert.match(reports,/report-day-review-history/);
  assert.match(html,/dashboard-v21\.css\?v=1\.3\.0/);
  assert.match(html,/reports-v21\.css\?v=3\.1\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});


test('koç ana paneli gerçek öğrenci verileriyle dolar',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('dashboard-v21.css');
  for(const id of ['statStudents','statCompleted','statPending','statProgress','dashboardFlow','dashboardStudentStatus'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(js,/function renderCoachDashboard/);
  assert.match(js,/function dashboardProgramStats/);
  assert.match(js,/programCurrentWeekStart\(\)/);
  assert.match(js,/data\?\.dn\?\[task\.id\]/);
  assert.match(js,/studentActiveToday/);
  assert.match(js,/renderCoachRealtimeViews\(\)[\s\S]*renderCoachDashboard/);
  assert.match(js,/loadCoachReports[\s\S]*renderCoachDashboard/);
  assert.match(css,/dashboard-flow-row/);
  assert.match(css,/dashboard-student-row/);
  assert.match(html,/dashboard-v21\.css\?v=1\.3\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.36/);
});
