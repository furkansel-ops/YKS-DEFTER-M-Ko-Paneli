const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));

test('panel yalnız sol menü ve boş çalışma alanı ile açılır',()=>{
  const html=read('index.html');
  for(const label of ['Ana Sayfa','Öğrenciler','Programlar','Paragraf + Problem','Deneme Analizi','Konular','Hata Defteri','Mesajlar','Ayarlar'])assert.ok(html.includes(label),label);
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
  assert.match(html,/sidebar-v20\.css\?v=1\.0\.1/);
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
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});

test('koç program düzenleme mevcut hücreyi, günü ve video kaynağını korur',()=>{
  const js=read('app-reset.js'),html=read('index.html');
  assert.match(js,/function coachProgramSplitExisting/);
  assert.match(js,/openProgramTaskModal\(cell\.value,\{edit:true,weekStart,day:cell\.day\}\)/);
  assert.match(js,/coachProgramEditContext=\{weekStart,taskId,day:cell\.day,prefix:""\}/);
  assert.match(js,/parsed\.resource/);
  assert.match(js,/button\.disabled=editing/);
  assert.match(js,/editing\?"Değişiklikleri kaydet"/);
  assert.match(js,/const editedTask=\(edit\.prefix\|\|""\)\+task/);
  assert.match(js,/if\(!cell\)\{setProgramTaskStatus\("Bu görev artık programda bulunmuyor/);
  assert.match(js,/function closeProgramTaskModal\(\)\{coachProgramEditContext=null/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
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
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
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
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
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
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
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
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
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
  assert.match(html,/reports-v21\.css\?v=4\.1\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('koç ana paneli gerçek öğrenci verileriyle dolar',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('dashboard-v21.css');
  for(const id of ['statStudents','statCompleted','statPending','statProgress','dashboardFlow','dashboardStudentStatus'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(js,/function renderCoachDashboard/);
  assert.match(js,/function dashboardProgramStats/);
  assert.match(js,/programCurrentWeekStart\(\)/);
  assert.match(js,/data\?\.dn\?\.\[task\.id\]/);
  assert.match(js,/studentActiveToday/);
  assert.match(js,/renderCoachRealtimeViews\(\)[\s\S]*renderCoachDashboard/);
  assert.match(js,/loadCoachReports[\s\S]*renderCoachDashboard/);
  assert.match(css,/dashboard-flow-row/);
  assert.match(css,/dashboard-student-row/);
  assert.match(html,/dashboard-v21\.css\?v=1\.3\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('koç ana ekran selamlaması saate göre otomatik değişir',()=>{
  const html=read('index.html'),js=read('app-reset.js');
  assert.match(html,/id="dashboardGreeting">Merhaba</);
  assert.doesNotMatch(html,/İyi akşamlar, <span id="dashboardCoachName"/);
  assert.match(js,/function dashboardGreetingFor/);
  assert.match(js,/hour>=5&&hour<12/);
  assert.match(js,/return"Günaydın"/);
  assert.match(js,/return"İyi günler"/);
  assert.match(js,/return"İyi akşamlar"/);
  assert.match(js,/return"İyi geceler"/);
  assert.match(js,/setInterval\(refreshDashboardGreeting,60000\)/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('koç programında öğrencinin tamamladığı dersler tek tek görünür',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('programs-v21.css');
  assert.match(js,/function programTaskDone/);
  assert.match(js,/data\?\.dn\?\.\[task\?\.id\]/);
  assert.match(js,/completedByDay/);
  assert.match(js,/data-task-completed/);
  assert.match(js,/task-complete-badge/);
  assert.match(js,/✓ Tamamlandı/);
  assert.match(js,/day-state partial/);
  assert.match(css,/program-task-card\.completed/);
  assert.match(css,/task-complete-badge/);
  assert.match(css,/day-state\.partial/);
  assert.match(html,/programs-v21\.css\?v=3\.4\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('koçun eklediği program görevi düzenleme ekranından silinebilir',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('programs-v21.css');
  assert.match(html,/id="programTaskDelete">Görevi Sil<\/button>/);
  assert.match(js,/p?ayload:\{operation:"delete",sourceWeek:edit\.weekStart,taskId:edit\.taskId\}/);
  assert.match(js,/function removeCoachProgramTaskLocal/);
  assert.match(js,/delete cell\.week\.data\.dn\[taskId\]/);
  assert.match(js,/cell\.week\.data\.mv\[orderKey\]=cell\.week\.data\.mv\[orderKey\]\.filter\(id=>id!==taskId\)/);
  assert.match(js,/Sadece koç tarafından eklenen görevler buradan silinebilir/);
  assert.match(js,/confirm\("Bu koç görevi öğrencinin programından silinsin mi\?"\)/);
  assert.match(css,/\.program-task-delete/);
  assert.match(html,/programs-v21\.css\?v=3\.4\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('paragraf + problem bölümü seçili öğrencinin çalışma verilerini canlı analiz eder',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('paragraph-problem-v1.css');
  assert.match(html,/data-coach-page="paragraphProblem"/);
  assert.match(html,/id="paragraphProblemPage"/);
  for(const id of ['ppCoachStudentSelect','ppCoachKpis','ppCoachKinds','ppCoachTempo','ppCoachSignals','ppCoachCompare','ppCoachRhythm','ppCoachDaily','ppCoachHistory'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.doesNotMatch(html,/ppCoachStudentInfo|ppCoachStudentTarget|ppCoachStudentMeta|ppCoachRangeSelect/);
  assert.match(html,/paragraph-problem-v1\.css\?v=1\.2\.0/);
  assert.match(js,/function paragraphProblemEntries/);
  assert.match(js,/share\?\.paragraphProblem\?\.entries/);
  assert.match(js,/function paragraphProblemActiveStreak/);
  assert.match(js,/function paragraphProblemBestDay/);
  assert.match(js,/Son 7 günde/);
  assert.match(js,/30 günde/);
  assert.match(js,/hydrateParagraphProblemControls\(\);renderParagraphProblem/);
  assert.match(js,/Canlı paragraf\/problem görünümü/);
  assert.match(css,/\.pp-tempo-bars/);
  assert.match(css,/\.pp-rhythm-heat/);
  assert.match(css,/\.pp-coach-history-row/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('sol menüde kaçış karakteri görünmez ve tüm menüler kaydırılabilir alanda kalır',()=>{
  const html=read('index.html'),css=read('sidebar-v20.css');
  assert.doesNotMatch(html,/Takip &amp; Rapor<\/b><\/button>\\n/);
  assert.match(html,/sidebar-v20\.css\?v=1\.0\.1/);
  assert.match(css,/\.coach-nav-v20\{[^}]*overflow-y:auto/);
  assert.match(css,/min-height:39px/);
  assert.match(css,/\.coach-sidebar-spacer\{flex:1;min-height:4px\}/);
});


test('Paragraf + Problem ekranı kişisel profil yerine çalışma performansını gösterir',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('paragraph-problem-v1.css');
  const ppHtml=html.slice(html.indexOf('<section class="pp-coach-page'),html.indexOf('<section class="exams-page'));
  const ppJs=js.slice(js.indexOf('function paragraphProblemEntries'),js.indexOf('function examList'));
  assert.doesNotMatch(ppHtml,/ÖĞRENCİ BİLGİLERİ|Hedef bilgisi yok|ppCoachStudentAvatar|ppCoachStudentTarget|ppCoachStudentMeta/);
  assert.doesNotMatch(ppJs,/renderParagraphProblemStudentInfo|profile\.targetUniversity|profile\.targetDepartment|profile\.targetNetTYT|profile\.targetNetAYT/);
  for(const label of ['BUGÜN TOPLAM','BUGÜN NET','7 GÜNLÜK HACİM','AKTİF SERİ'])assert.match(ppJs,new RegExp(label));
  for(const heading of ['Son 14 gün','Performans sinyalleri','Son 7 gün ↔ önceki 7 gün','30 günlük ritim','GÜNLÜK DÖKÜM','Geçmiş oturumlar'])assert.ok(ppHtml.includes(heading),heading);
  assert.match(css,/\.pp-coach-kind-main/);
  assert.match(css,/\.pp-compare-row/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('Takip & Rapor ayrıntılı koçluk analitiği gösterir',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('reports-v21.css');
  for(const id of ['reportAttentionList','reportStudentRisk','reportActivityTrend','reportActivityChart','reportStudentSignals','reportPpSummary','reportSubjectBreakdown','reportExamTrend','reportTopicFocus','reportOpenPp','reportCohortSubjects','reportStudyPulse','reportSubjectFocusBars'])assert.match(html,new RegExp('id="'+id+'"'));
  for(const fn of ['reportDailyRows','reportPpSummaryMetrics','reportSubjectRows','reportRiskScore','reportStudentSignals','reportStudyPulse','reportCohortSubjectRows'])assert.match(js,new RegExp('function '+fn));
  assert.match(js,/progress\?\.daily14/);
  assert.match(js,/progress\?\.subjects7/);
  assert.match(js,/w\.completedCounts\[i\]/);
  assert.match(js,/reportRiskMeta\(reportRiskScore\(row\)\)/);
  assert.match(js,/showCoachPage\("paragraphProblem"\)/);
  assert.match(css,/\.report-activity-bars/);
  assert.match(css,/\.report-signal-list/);
  assert.match(css,/\.report-pp-summary/);
  assert.match(css,/\.report-subject-row/);
  assert.match(css,/\.report-attention-list/);
  assert.match(css,/\.report-pulse-grid/);
  assert.match(css,/\.report-cohort-subject-row/);
  assert.match(css,/\.report-subject-focus-row/);
  assert.match(html,/reports-v21\.css\?v=4\.1\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});

test('uzun program görevleri gün kartının dışına taşmaz',()=>{
  const html=read('index.html'),css=read('programs-v21.css');
  assert.match(css,/\.day-tasks \.program-task-card\{overflow:hidden!important\}/);
  assert.match(css,/\.day-tasks \.program-task-card>div\{min-width:0;max-width:100%;overflow:hidden\}/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(css,/word-break:break-word/);
  assert.match(css,/\.task-meta-row\{min-width:0;max-width:100%;flex-wrap:wrap/);
  assert.match(html,/programs-v21\.css\?v=3\.4\.0/);
});


test('Konular ekranı koç önceliği, hedef takvimi ve gelişmiş filtrelerle çalışır',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('topics-v21.css');
  for(const id of ['topicExamSelect','topicSearchInput','topicAttentionOverview','topicDeadlineOverview','topicStudentRisk','topicStudentSignals','topicWeakSubjects'])assert.match(html,new RegExp('id="'+id+'"'));
  for(const fn of ['topicDaysUntil','topicDueSoon','topicSubjectStats','topicErrorWeight','topicPriorityScore','topicStudentRisk','topicStudentSignals'])assert.match(js,new RegExp('function '+fn));
  assert.match(js,/status==="due-soon"\?topicDueSoon\(item\)/);
  assert.match(js,/errorJournal/);
  assert.match(js,/topicErrorWeight\(row,item\)/);
  assert.match(js,/topicPriorityMeta\(topicStudentRisk\(row,items\)\)/);
  assert.match(js,/topicSearchInput/);
  assert.match(css,/\.topic-attention-overview/);
  assert.match(css,/\.topic-signal-list/);
  assert.match(css,/\.topic-weak-subjects/);
  assert.match(css,/\.topic-priority-badge/);
  assert.match(html,/topics-v21\.css\?v=3\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('Paragraf + Problem koç görünümünde doğru yanlış boş ve toplam sayıları görünür',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('paragraph-problem-v1.css');
  assert.match(html,/id="ppCoachAnswerSummary"/);
  for(const label of ['Doğru','Yanlış','Boş','Toplam','Bugün','Son 7 gün'])assert.ok(js.includes(label),label);
  assert.match(js,/today\.correct/);
  assert.match(js,/today\.wrong/);
  assert.match(js,/today\.blank/);
  assert.match(js,/last7\.correct/);
  assert.match(js,/last7\.wrong/);
  assert.match(js,/last7\.blank/);
  assert.match(css,/\.pp-coach-answer-summary/);
  assert.match(html,/paragraph-problem-v1\.css\?v=1\.2\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});


test('Konular v3 premium komuta merkezi ilerleme ve haftalık odak kartları gösterir',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('topics-v21.css');
  for(const id of ['topicQuickFilters','topicOverviewProgress','topicOverviewStage','topicCriticalDeck','topicStudentProgressBoard','topicStudentFocusDeck'])assert.match(html,new RegExp('id="'+id+'"'));
  for(const fn of ['topicProgressVisual','topicCoachAction','topicFocusReason','topicFocusCards'])assert.match(js,new RegExp('function '+fn));
  assert.match(js,/data-topic-quick/);
  assert.match(js,/topicCriticalDeck/);
  assert.match(js,/topicStudentFocusDeck/);
  assert.match(css,/\.topic-command-grid/);
  assert.match(css,/\.topic-progress-ring/);
  assert.match(css,/\.topic-critical-item/);
  assert.match(css,/\.topic-focus-card/);
  assert.match(html,/topics-v21\.css\?v=3\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.50/);
});
