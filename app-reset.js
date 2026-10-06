import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,doc,getDoc,collection,getDocs,query,where,addDoc,setDoc,updateDoc,serverTimestamp,onSnapshot}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

const firebaseApp=initializeApp(FIREBASE_CONFIG,"yks-coach-panel");
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
const $=id=>document.getElementById(id);
const text=(value,max=120)=>String(value??"").trim().slice(0,max);
const initials=name=>text(name,80).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"K";

function dashboardGreetingFor(date=new Date()){
  const hour=date.getHours();
  if(hour>=5&&hour<12)return"Günaydın";
  if(hour>=12&&hour<18)return"İyi günler";
  if(hour>=18&&hour<23)return"İyi akşamlar";
  return"İyi geceler";
}
function refreshDashboardGreeting(){
  const node=$("dashboardGreeting");if(node)node.textContent=dashboardGreetingFor();
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshDashboardGreeting()});
setInterval(refreshDashboardGreeting,60000);

function setStatus(message,type=""){
  const node=$("authStatus");if(!node)return;
  node.textContent=message;
  node.className=`status ${type}`.trim();
}
function finishBoot(){$("bootView")?.classList.add("hidden")}
function showAuth(message="Koç hesabınla giriş yap.",type=""){
  finishBoot();
  $("authView")?.classList.remove("hidden");
  $("appView")?.classList.add("hidden");
  setStatus(message,type);
}
function showApp(profile,user){
  finishBoot();
  $("authView")?.classList.add("hidden");
  $("appView")?.classList.remove("hidden");
  const name=text(profile?.displayName||user?.displayName||"Koç",80)||"Koç";
  const nameNode=$("coachSidebarName"),avatar=$("coachSidebarAvatar");
  if(nameNode)nameNode.textContent=name;
  if(avatar)avatar.textContent=initials(name).slice(0,1);
  const dashName=$("dashboardCoachName");if(dashName)dashName.textContent=name.split(/\\s+/)[0]||"Koç";
  refreshDashboardGreeting();
  const dashDate=$("dashboardDate");if(dashDate)dashDate.textContent=new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  hydrateCoachSettings(profile,user);
  const startPage=readCoachUiPrefs().defaultPage||"home";
  if(startPage!=="home")setTimeout(()=>showCoachPage(startPage),0);
  void loadCoachReports(user.uid);
  void loadCoachMessages(user.uid);
}
async function loadCoachProfile(user){
  const snap=await getDoc(doc(db,COLLECTIONS.profiles,user.uid));
  if(!snap.exists())return null;
  const profile=snap.data();
  return profile?.role==="coach"?profile:null;
}
function openSidebar(){$("sidebar")?.classList.add("open");$("overlay")?.classList.add("show")}
function closeSidebar(){$("sidebar")?.classList.remove("open");$("overlay")?.classList.remove("show")}

$("signInBtn")?.addEventListener("click",async event=>{
  event.currentTarget.disabled=true;
  try{
    await setPersistence(auth,browserLocalPersistence);
    await signInWithPopup(auth,provider);
  }catch(error){
    const code=String(error?.code||"");
    const message=code.includes("popup-closed")?"Google giriş penceresi kapatıldı.":code.includes("popup-blocked")?"Tarayıcı giriş penceresini engelledi.":text(error?.message||"Giriş yapılamadı",180);
    showAuth(message,"err");
  }finally{event.currentTarget.disabled=false}
});
$("signOutBtn")?.addEventListener("click",()=>signOut(auth));
$("menuBtn")?.addEventListener("click",openSidebar);
$("overlay")?.addEventListener("click",closeSidebar);

const coachPages={home:"homePage",students:"studentsPage",programs:"programsPage",reports:"reportsPage",paragraphProblem:"paragraphProblemPage",exams:"examsPage",topics:"topicsPage",errors:"errorsPage",messages:"messagesPage",settings:"settingsPage"};
function showCoachPage(page){
  const targetId=coachPages[page];
  if(!targetId)return;
  document.querySelectorAll("[data-coach-page]").forEach(item=>item.classList.toggle("on",item.dataset.coachPage===page));
  document.querySelectorAll("#homePage,#studentsPage,#programsPage,#reportsPage,#paragraphProblemPage,#examsPage,#topicsPage,#errorsPage,#messagesPage,#settingsPage").forEach(section=>section.classList.add("hidden"));
  $(targetId)?.classList.remove("hidden");
  if(page==="home"){try{refreshDashboardGreeting();renderCoachDashboard();renderDashboardDayReviews()}catch(error){console.error("Ana panel yenileme",error)}}
  closeSidebar();
}
document.querySelectorAll("[data-coach-page]").forEach(button=>{
  button.addEventListener("click",()=>showCoachPage(button.dataset.coachPage));
});

onAuthStateChanged(auth,async user=>{
  if(!user){stopCoachShareRealtime();if(coachMessageStop){try{coachMessageStop()}catch{}coachMessageStop=null;coachMessageUid=""}coachMessageActions=[];selectedMessageStudent="";showAuth();return}
  try{
    const profile=await loadCoachProfile(user);
    if(!profile){
      await signOut(auth);
      showAuth("Bu Google hesabında koç profili yok.","err");
      return;
    }
    showApp(profile,user);
  }catch(error){
    console.error(error);
    showAuth(text(error?.message||"Koç profili yüklenemedi",180),"err");
  }
});


document.querySelectorAll("[data-go-page]").forEach(button=>button.addEventListener("click",()=>{
  const page=button.dataset.goPage;
  document.querySelector('[data-coach-page="'+page+'"]')?.click();
}));


let studentListFilter="all";
document.querySelectorAll("[data-student-filter]").forEach(button=>button.addEventListener("click",()=>{
  studentListFilter=button.dataset.studentFilter||"all";
  document.querySelectorAll("[data-student-filter]").forEach(x=>x.classList.toggle("active",x===button));
  renderStudentsPage();
}));




let coachReportRows=[];
let coachShareStops=[],coachRealtimeRenderTimer=null;
function stopCoachShareRealtime(){coachShareStops.splice(0).forEach(stop=>{try{stop()}catch{}});clearTimeout(coachRealtimeRenderTimer);coachRealtimeRenderTimer=null}
function renderCoachRealtimeViews(){
  try{renderCoachDashboard()}catch(error){console.error("Canlı ana panel görünümü",error)}
  try{renderDashboardDayReviews()}catch(error){console.error("Canlı gün sonu notları",error)}
  try{renderStudentsPage()}catch(error){console.error("Canlı öğrenci görünümü",error)}
  try{hydrateProgramStudents();renderProgramWorkspace()}catch(error){console.error("Canlı program görünümü",error)}
  try{renderReport($("reportStudentSelect")?.value||"all")}catch(error){console.error("Canlı rapor görünümü",error)}
  try{hydrateParagraphProblemControls();renderParagraphProblem($("ppCoachStudentSelect")?.value||"")}catch(error){console.error("Canlı paragraf/problem görünümü",error)}
}
function scheduleCoachRealtimeRender(){clearTimeout(coachRealtimeRenderTimer);coachRealtimeRenderTimer=setTimeout(()=>{coachRealtimeRenderTimer=null;renderCoachRealtimeViews()},60)}
function startCoachShareRealtime(){
  stopCoachShareRealtime();
  coachReportRows.forEach(row=>{
    const stop=onSnapshot(doc(db,"coachingShares",row.studentUid),snap=>{
      const target=coachReportRows.find(item=>item.studentUid===row.studentUid);if(!target)return;
      target.share=snap.exists()?snap.data():null;scheduleCoachRealtimeRender();
    },error=>console.error("Öğrenci canlı paylaşımı",row.studentUid,error));
    coachShareStops.push(stop);
  });
}

const escHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
const reportNum=value=>Number.isFinite(Number(value))?Number(value):0;
const reportInitial=name=>String(name||"Ö").trim().charAt(0).toLocaleUpperCase("tr-TR")||"Ö";
function reportMinutes(value){
  const n=Math.max(0,Math.round(reportNum(value)));
  if(n<60)return n+" dk";
  const h=Math.floor(n/60),m=n%60;
  return m?h+" sa "+m+" dk":h+" sa";
}
function reportTimestamp(value){
  try{
    const d=value?.toDate?.()||new Date(value);
    if(!d||Number.isNaN(d.getTime()))return"—";
    return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);
  }catch{return"—"}
}
function programRowList(value){
  if(Array.isArray(value))return value;
  if(!value||typeof value!=="object")return[];
  return Object.keys(value).sort((a,b)=>Number(a)-Number(b)).map(key=>Array.isArray(value[key])?value[key]:[]);
}
function latestWeek(program){
  const weeks=Array.isArray(program?.weeks)?program.weeks:[];
  return [...weeks].sort((x,y)=>String(x?.week||"").localeCompare(String(y?.week||""))).at(-1)||null;
}
function programTaskDone(data,task,day){
  return Boolean(data?.done?.[day])||Boolean(data?.dn?.[task?.id]);
}
function weekStats(program){
  const item=latestWeek(program),data=item?.data||{};
  const tasks=Array.from({length:7},(_,day)=>collectProgramDayTasks(program,item||{data:{}},day));
  const taskCounts=tasks.map(dayTasks=>dayTasks.length);
  const completedCounts=tasks.map((dayTasks,day)=>dayTasks.filter(task=>programTaskDone(data,task,day)).length);
  const plannedDays=taskCounts.filter(Boolean).length;
  const doneDays=taskCounts.reduce((sum,count,day)=>sum+(count&&completedCounts[day]===count?1:0),0);
  const total=taskCounts.reduce((sum,count)=>sum+count,0),completed=completedCounts.reduce((sum,count)=>sum+count,0);
  return{week:item?.week||"",taskCounts,completedCounts,plannedDays,doneDays,total,completed,ratio:total?Math.round(completed/total*100):0};
}
function studentName(row){return row?.share?.profile?.name||row?.profile?.displayName||"Öğrenci"}
function studentDayReviews(row){
  const entries=Array.isArray(row?.share?.progress?.dayReview?.entries)?row.share.progress.dayReview.entries:[];
  return entries.filter(item=>item&&/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||""))&&(item.mood||String(item.note||"").trim())).sort((a,b)=>String(b.date).localeCompare(String(a.date))||reportNum(b.at)-reportNum(a.at));
}
function studentDayReview(row,date=todayIsoLocal()){
  return studentDayReviews(row).find(item=>item.date===date)||null;
}
function dayReviewMoodMeta(mood){
  if(mood==="good")return{label:"İyi",icon:"🙂",tone:"good"};
  if(mood==="mid")return{label:"Orta",icon:"😐",tone:"mid"};
  if(mood==="hard")return{label:"Zor",icon:"😮‍💨",tone:"hard"};
  return{label:"Not",icon:"☾",tone:"mid"};
}

function dashboardProgramStats(row){
  const weekStart=programCurrentWeekStart();
  const week=programWeeks(row).find(item=>item?.week===weekStart);
  if(!week)return{week:null,planned:0,done:0,ratio:0,todayPlanned:0,todayDone:0};
  const data=week.data||{},program=row?.share?.program||{},todayDay=(new Date().getDay()+6)%7;
  let planned=0,done=0,todayPlanned=0,todayDone=0;
  for(let day=0;day<7;day++){
    const tasks=collectProgramDayTasks(program,week,day);
    planned+=tasks.length;
    if(day===todayDay)todayPlanned=tasks.length;
    for(const task of tasks){
      const completed=Boolean(data?.done?.[day])||Boolean(data?.dn?.[task.id]);
      if(completed){done++;if(day===todayDay)todayDone++}
    }
  }
  return{week,planned,done,ratio:planned?Math.round(done/planned*100):0,todayPlanned,todayDone};
}
function dashboardNeedsReview(row){
  const overdue=reportNum(row?.share?.progress?.overdueTopics);
  const review=studentDayReview(row,todayIsoLocal());
  return overdue>0||review?.mood==="hard";
}
function dashboardStudentOpen(uid){
  if(!uid)return;
  showCoachPage("reports");
  if($("reportStudentSelect"))$("reportStudentSelect").value=uid;
  renderReport(uid);
}
function renderCoachDashboard(){
  const rows=coachReportRows.slice(),stats=rows.map(row=>({row,program:dashboardProgramStats(row)}));
  const completed=stats.reduce((sum,item)=>sum+item.program.todayDone,0);
  const pending=rows.filter(dashboardNeedsReview).length;
  const progressRows=stats.filter(item=>item.program.planned>0);
  const progress=progressRows.length?Math.round(progressRows.reduce((sum,item)=>sum+item.program.ratio,0)/progressRows.length):0;
  if($("statStudents"))$("statStudents").textContent=String(rows.length);
  if($("statCompleted"))$("statCompleted").textContent=String(completed);
  if($("statPending"))$("statPending").textContent=String(pending);
  if($("statProgress"))$("statProgress").textContent=progress+"%";

  const flow=$("dashboardFlow");
  if(flow){
    const active=stats.filter(item=>studentActiveToday(item.row)).sort((a,b)=>(studentUpdatedDate(b.row)?.getTime()||0)-(studentUpdatedDate(a.row)?.getTime()||0)).slice(0,6);
    if(!rows.length){
      flow.innerHTML='<div class="empty-state"><span>◎</span><b>Henüz bağlı öğrenci yok</b><p>Öğrenci eklediğinde çalışma hareketleri burada görünecek.</p></div>';
    }else if(!active.length){
      flow.innerHTML='<div class="empty-state"><span>◎</span><b>Bugün henüz senkron yok</b><p>Öğrenci YKS Defterim’i açtığında güncel durum burada otomatik görünecek.</p></div>';
    }else{
      flow.innerHTML='<div class="dashboard-flow-list">'+active.map(({row,program})=>{
        const name=studentName(row),minutes=reportMinutes(row?.share?.progress?.minutes7);
        const taskText=program.todayPlanned?program.todayDone+" / "+program.todayPlanned+" görev tamamlandı":"Bugün plan görevi yok";
        return '<button type="button" class="dashboard-flow-row" data-dashboard-student="'+escHtml(row.studentUid)+'"><span class="dashboard-flow-avatar">'+escHtml(reportInitial(name))+'</span><span class="dashboard-flow-main"><b>'+escHtml(name)+'</b><small>'+escHtml(taskText)+' · Son 7 gün '+escHtml(minutes)+'</small></span><span class="dashboard-flow-status"><i></i>Aktif</span><time>'+escHtml(studentLastActivity(row))+'</time><span class="dashboard-flow-open">›</span></button>';
      }).join("")+'</div>';
    }
  }

  const statusRoot=$("dashboardStudentStatus");
  if(statusRoot){
    if(!rows.length){
      statusRoot.innerHTML='<div class="student-placeholder"><div class="placeholder-bars"><i></i><i></i><i></i></div><div><b>Öğrenci verileri bekleniyor</b><p>Bağlı öğrencilerin program ve çalışma verileri geldikçe bu alan otomatik dolacak.</p></div></div>';
    }else{
      const ordered=stats.sort((a,b)=>Number(dashboardNeedsReview(b.row))-Number(dashboardNeedsReview(a.row))||Number(studentActiveToday(b.row))-Number(studentActiveToday(a.row))||b.program.ratio-a.program.ratio).slice(0,5);
      statusRoot.innerHTML='<div class="dashboard-student-list">'+ordered.map(({row,program})=>{
        const name=studentName(row),overdue=Math.max(0,Math.round(reportNum(row?.share?.progress?.overdueTopics)));
        const active=studentActiveToday(row),needs=dashboardNeedsReview(row);
        const label=overdue?overdue+" geciken konu":needs?"Kontrol et":active?"Bugün aktif":"Takipte";
        const tone=needs?"attention":active?"active":"idle";
        const progressText=program.planned?program.done+" / "+program.planned+" görev":"Bu hafta program yok";
        return '<button type="button" class="dashboard-student-row" data-dashboard-student="'+escHtml(row.studentUid)+'"><span class="dashboard-student-avatar">'+escHtml(reportInitial(name))+'</span><span class="dashboard-student-main"><b>'+escHtml(name)+'</b><small>'+escHtml(progressText)+'</small><span class="dashboard-progress"><i style="width:'+Math.max(0,Math.min(100,program.ratio))+'%"></i></span></span><span class="dashboard-student-pill '+tone+'">'+escHtml(label)+'</span><strong>'+program.ratio+'%</strong></button>';
      }).join("")+'</div>';
    }
  }

  document.querySelectorAll("[data-dashboard-student]").forEach(button=>button.addEventListener("click",()=>dashboardStudentOpen(button.dataset.dashboardStudent)));
}
function renderDashboardDayReviews(){
  const root=$("dashboardDayReviews"),summary=$("dashboardDayReviewSummary");if(!root)return;
  const today=todayIsoLocal(),items=coachReportRows.map(row=>({row,review:studentDayReview(row,today)})).filter(item=>item.review).sort((a,b)=>reportNum(b.review?.at)-reportNum(a.review?.at));
  const counts={good:0,mid:0,hard:0};items.forEach(({review})=>{if(counts[review.mood]!==undefined)counts[review.mood]++});
  if(summary){
    summary.innerHTML=
      '<span><b>'+items.length+'</b> not</span>'+
      '<span class="good">🙂 <b>'+counts.good+'</b> iyi</span>'+
      '<span class="mid">😐 <b>'+counts.mid+'</b> orta</span>'+
      '<span class="hard">😮‍💨 <b>'+counts.hard+'</b> zor</span>';
  }
  if(!items.length){
    root.innerHTML='<div class="dashboard-day-review-empty"><span>☾</span><div><b>Bugün henüz not yok</b><p>Öğrenciler gün sonu değerlendirmesini kaydettiğinde burada canlı görünecek.</p></div></div>';return;
  }
  root.innerHTML=items.map(({row,review})=>{
    const name=studentName(row),mood=dayReviewMoodMeta(review.mood),note=String(review.note||"").trim()||"Kısa not eklenmedi.";
    const when=review.at?new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(review.at)):"";
    return '<button type="button" class="dashboard-day-review-row" data-day-review-student="'+escHtml(row.studentUid)+'"><span class="dashboard-day-review-avatar">'+escHtml(reportInitial(name))+'</span><span class="dashboard-day-review-student"><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS öğrencisi")+'</small></span><span class="dashboard-day-review-mood '+mood.tone+'"><i>'+mood.icon+'</i>'+mood.label+'</span><span class="dashboard-day-review-note">'+escHtml(note)+'</span><time class="dashboard-day-review-time">'+escHtml(when)+'</time><span class="dashboard-day-review-open">Raporu aç ›</span></button>';
  }).join("");
  root.querySelectorAll("[data-day-review-student]").forEach(button=>button.addEventListener("click",()=>{
    const uid=button.dataset.dayReviewStudent;if(!uid)return;
    showCoachPage("reports");if($("reportStudentSelect"))$("reportStudentSelect").value=uid;renderReport(uid);
  }));
}

function reportStatus(row){
  const overdue=reportNum(row?.share?.progress?.overdueTopics),minutes=reportNum(row?.share?.progress?.minutes7);
  if(overdue>0)return overdue+" geciken konu";
  if(minutes>0)return"Aktif";
  return"Veri bekleniyor";
}
function setReportState(name){
  ["reportLoading","reportEmpty","reportError","reportOverview","reportStudentDetail"].forEach(id=>$(id)?.classList.add("hidden"));
  $(name)?.classList.remove("hidden");
}
async function loadCoachReports(coachUid){
  if(!coachUid)return;
  stopCoachShareRealtime();
  setReportState("reportLoading");
  setParagraphProblemState("ppCoachLoading");
  try{
    const linkSnap=await getDocs(query(collection(db,"coachingLinks"),where("coachUid","==",coachUid)));
    const links=linkSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active===true);
    coachReportRows=await Promise.all(links.map(async link=>{
      const [shareSnap,profileSnap]=await Promise.all([
        getDoc(doc(db,"coachingShares",link.studentUid)),
        getDoc(doc(db,"accountProfiles",link.studentUid))
      ]);
      return{link,studentUid:link.studentUid,share:shareSnap.exists()?shareSnap.data():null,profile:profileSnap.exists()?profileSnap.data():null};
    }));
    const select=$("reportStudentSelect");
    if(select){
      select.innerHTML='<option value="all">Tüm öğrenciler</option>'+coachReportRows.map(row=>'<option value="'+escHtml(row.studentUid)+'">'+escHtml(studentName(row))+'</option>').join("");
      select.value="all";
    }
    try{renderReport("all")}catch(error){console.error("Takip & Rapor render",error);setReportState("reportError")}
    try{hydrateParagraphProblemControls();renderParagraphProblem($("ppCoachStudentSelect")?.value||"")}catch(error){console.error("Paragraf + Problem render",error);setParagraphProblemState("ppCoachEmpty")}
    try{hydrateExamStudentSelect();renderExamAnalysis("all")}catch(error){console.error("Deneme Analizi render",error);setExamState("examEmpty")}
    try{hydrateTopicControls();renderTopicAnalysis("all")}catch(error){console.error("Konular render",error);setTopicState("topicEmpty")}
    try{
      hydrateErrorControls();
      renderErrorAnalysis("all");
    }catch(error){
      console.error("Hata Defteri render",error);
      if($("errorLoadErrorText"))$("errorLoadErrorText").textContent=String(error?.message||"Hata kayıtları görüntülenemedi.");
      setErrorState("errorLoadError");
    }
    try{renderCoachDashboard()}catch(error){console.error("Ana panel render",error)}
    try{renderDashboardDayReviews()}catch(error){console.error("Gün sonu notları render",error)}
    try{renderStudentsPage()}catch(error){console.error("Öğrenciler render",error)}
    try{hydrateProgramStudents();renderProgramWorkspace()}catch(error){console.error("Programlar render",error)}
    try{renderMessageStudents()}catch(error){console.error("Mesaj öğrenci listesi",error)}
    startCoachShareRealtime();
  }catch(error){
    console.error("Takip raporları",error);
    if($("reportErrorText"))$("reportErrorText").textContent=String(error?.message||"Rapor verileri alınamadı.");
    setReportState("reportError");
  }
}
function kpi(label,value,note,tone=""){
  return '<article class="report-kpi '+tone+'"><span>'+escHtml(label)+'</span><strong>'+escHtml(value)+'</strong><small>'+escHtml(note)+'</small></article>';
}
function reportDateOffset(offset){
  const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function reportDailyRows(row){
  const entries=Array.isArray(row?.share?.progress?.daily14)?row.share.progress.daily14:[];
  return entries.filter(item=>item&&/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||""))).map(item=>({
    date:String(item.date),minutes:Math.max(0,reportNum(item.minutes)),questions:Math.max(0,reportNum(item.questions))
  })).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);
}
function reportPeriod(rows){
  const minutes=rows.reduce((sum,item)=>sum+item.minutes,0),questions=rows.reduce((sum,item)=>sum+item.questions,0);
  return{minutes,questions,activeDays:rows.filter(item=>item.minutes>0||item.questions>0).length};
}
function reportUpdatedMs(value){
  try{const d=value?.toDate?.()||new Date(value);return d&&!Number.isNaN(d.getTime())?d.getTime():0}catch{return 0}
}
function reportFreshnessHours(row){
  const ms=reportUpdatedMs(row?.share?.updatedAt);return ms?Math.max(0,(Date.now()-ms)/3600000):Infinity;
}
function reportPpSummaryMetrics(row,days=7){
  const dates=new Set(Array.from({length:days},(_,index)=>reportDateOffset(-(days-1-index))));
  const entries=(Array.isArray(row?.share?.paragraphProblem?.entries)?row.share.paragraphProblem.entries:[]).filter(item=>dates.has(String(item?.date||"")));
  const sums=entries.reduce((acc,item)=>{const correct=Math.max(0,reportNum(item?.correct)),wrong=Math.max(0,reportNum(item?.wrong)),blank=Math.max(0,reportNum(item?.blank)),total=correct+wrong+blank;acc.correct+=correct;acc.wrong+=wrong;acc.blank+=blank;acc.total+=total;if(item?.kind==="problem")acc.problem+=total;else acc.paragraph+=total;if(total)acc.days.add(String(item?.date||""));return acc},{correct:0,wrong:0,blank:0,total:0,paragraph:0,problem:0,days:new Set()});
  return{...sums,net:sums.correct-sums.wrong/4,accuracy:sums.total?sums.correct/sums.total*100:0,activeDays:sums.days.size};
}
function reportExamRows(row){
  return (Array.isArray(row?.share?.exams)?[...row.share.exams]:[]).filter(Boolean).sort((a,b)=>String(b?.date||"").localeCompare(String(a?.date||""))||reportNum(b?.id)-reportNum(a?.id));
}
function reportExamDelta(exams,index){
  const exam=exams[index];if(!exam)return null;
  const previous=exams.slice(index+1).find(item=>String(item?.type||"")===String(exam?.type||""))||exams[index+1];
  return previous?reportNum(exam.totalNet)-reportNum(previous.totalNet):null;
}
function reportSubjectRows(row){
  const progress=Array.isArray(row?.share?.progress?.subjects7)?row.share.progress.subjects7:[],map=new Map();
  const ensure=name=>{const key=String(name||"").trim();if(!key)return null;if(!map.has(key))map.set(key,{name:key,minutes:0,questions:0,wrongs:0,examNet:null});return map.get(key)};
  progress.forEach(item=>{const target=ensure(item?.name);if(target){target.minutes+=Math.max(0,reportNum(item?.minutes));target.questions+=Math.max(0,reportNum(item?.questions));}});
  const cutoff=reportDateOffset(-6);
  (Array.isArray(row?.share?.errorJournal)?row.share.errorJournal:[]).filter(item=>String(item?.date||"")>=cutoff).forEach(item=>{const target=ensure(item?.subject||"Ders");if(target)target.wrongs+=Math.max(1,reportNum(item?.n));});
  const latestExam=reportExamRows(row)[0];(Array.isArray(latestExam?.subjectResults)?latestExam.subjectResults:[]).forEach(item=>{const target=ensure(item?.name);if(target)target.examNet=reportNum(item?.net);});
  return[...map.values()].filter(item=>item.minutes||item.questions||item.wrongs||item.examNet!==null).sort((a,b)=>(b.minutes+b.questions+b.wrongs*20)-(a.minutes+a.questions+a.wrongs*20)).slice(0,10);
}
function reportRiskScore(row){
  if(!row?.share)return 100;
  const progress=row.share.progress||{},w=weekStats(row.share.program),fresh=reportFreshnessHours(row),review=studentDayReviews(row)[0],pp=reportPpSummaryMetrics(row);
  let score=0;
  if(fresh>48)score+=28;else if(fresh>24)score+=12;
  const minutes=reportNum(progress.minutes7),questions=reportNum(progress.questions7);
  if(minutes<120)score+=20;else if(minutes<300)score+=9;
  if(questions<80)score+=14;else if(questions<180)score+=6;
  if(w.total){if(w.ratio<50)score+=26;else if(w.ratio<75)score+=12}else score+=8;
  score+=Math.min(24,Math.round(reportNum(progress.overdueTopics))*6);
  if(review?.mood==="hard")score+=14;else if(review?.mood==="mid")score+=5;
  if(pp.total>0&&pp.activeDays<2)score+=5;
  return Math.min(100,Math.round(score));
}
function reportRiskMeta(score){
  if(score>=55)return{label:"Öncelikli",tone:"danger"};
  if(score>=30)return{label:"Takip",tone:"warn"};
  return{label:"İyi gidiyor",tone:"good"};
}
function reportStudentSignals(row){
  const progress=row?.share?.progress||{},w=weekStats(row?.share?.program),daily=reportDailyRows(row),current=reportPeriod(daily.slice(-7)),previous=reportPeriod(daily.slice(-14,-7)),pp=reportPpSummaryMetrics(row),exams=reportExamRows(row),signals=[];
  if(daily.length>=14&&previous.minutes>0){const pct=Math.round((current.minutes-previous.minutes)/previous.minutes*100);signals.push({tone:pct>=0?"good":"warn",title:"Çalışma süresi",text:"Önceki 7 güne göre "+(pct>=0?"+":"")+pct+"% değişti."});}
  else signals.push({tone:current.minutes?"good":"warn",title:"Çalışma kaydı",text:current.minutes?reportMinutes(current.minutes)+" çalışma · "+current.activeDays+"/7 aktif gün.":"Son 7 günde odak süresi görünmüyor."});
  if(w.total)signals.push({tone:w.ratio>=75?"good":w.ratio>=50?"warn":"danger",title:"Program uyumu",text:w.completed+" / "+w.total+" görev tamamlandı · %"+w.ratio+" uyum."});
  if(reportNum(progress.overdueTopics)>0)signals.push({tone:"danger",title:"Geciken konular",text:Math.round(reportNum(progress.overdueTopics))+" konu hedef tarihini geçmiş."});
  else signals.push({tone:"good",title:"Konu takibi",text:"Geciken konu görünmüyor."});
  if(exams.length>=2){const delta=reportExamDelta(exams,0);signals.push({tone:delta===null?"":delta>=0?"good":"warn",title:"Deneme trendi",text:delta===null?"Yeni deneme verisi bekleniyor.":"Son deneme "+(delta>=0?"+":"")+delta.toFixed(1).replace(".",",")+" net değişti."});}
  else if(pp.total)signals.push({tone:pp.accuracy>=70?"good":"warn",title:"P&P düzeni",text:pp.total+" soru · "+pp.activeDays+"/7 aktif gün · %"+Math.round(pp.accuracy)+" doğruluk."});
  const review=studentDayReviews(row)[0];if(review?.mood==="hard")signals.unshift({tone:"danger",title:"Gün sonu notu",text:"Öğrenci son gününü zor olarak işaretledi; notunu kontrol et."});
  return signals.slice(0,4);
}
function renderReport(scope){
  if(!coachReportRows.length){setReportState("reportEmpty");return}
  if(scope==="all"){renderReportOverview();return}
  const row=coachReportRows.find(x=>x.studentUid===scope);
  if(!row){renderReportOverview();return}
  renderStudentReport(row);
}
function renderReportOverview(){
  const rows=coachReportRows,withShare=rows.filter(r=>r.share),minutes=withShare.reduce((s,r)=>s+reportNum(r.share?.progress?.minutes7),0),questions=withShare.reduce((s,r)=>s+reportNum(r.share?.progress?.questions7),0);
  const programRows=withShare.map(row=>weekStats(row.share?.program)).filter(w=>w.total),avgProgram=programRows.length?Math.round(programRows.reduce((sum,w)=>sum+w.ratio,0)/programRows.length):0;
  const activeToday=withShare.filter(row=>reportDailyRows(row).some(item=>item.date===reportDateOffset(0)&&(item.minutes>0||item.questions>0))).length;
  const attention=rows.map(row=>({row,score:reportRiskScore(row)})).sort((a,b)=>b.score-a.score||studentName(a.row).localeCompare(studentName(b.row),"tr"));
  $("reportScopeTitle").textContent="Tüm öğrenciler";
  $("reportScopeMeta").textContent="Son 7 gün · çalışma, program, P&P ve risk özeti";
  $("reportOverviewKpis").innerHTML=
    kpi("BAĞLI ÖĞRENCİ",String(rows.length),withShare.length+" öğrenciden veri var")+
    kpi("BUGÜN AKTİF",String(activeToday),rows.length?activeToday+" / "+rows.length+" öğrenci":"Günlük veri bekleniyor",activeToday?"good":"")+
    kpi("TOPLAM ÇALIŞMA",reportMinutes(minutes),"Son 7 gün")+
    kpi("ÇÖZÜLEN SORU",String(Math.round(questions)),"Son 7 gün")+
    kpi("ORT. PROGRAM UYUMU",programRows.length?avgProgram+"%":"—",programRows.length+" programlı öğrenci",avgProgram&&avgProgram<60?"warn":"");
  const studentRows=[...rows].sort((a,b)=>reportRiskScore(b)-reportRiskScore(a)).map(row=>{
    const p=row.share?.progress||{},w=weekStats(row.share?.program),name=studentName(row),pp=reportPpSummaryMetrics(row),risk=reportRiskMeta(reportRiskScore(row));
    return '<button class="report-student-row" type="button" data-report-student="'+escHtml(row.studentUid)+'" data-report-name="'+escHtml(name.toLocaleLowerCase("tr-TR"))+'"><span class="report-student-main"><i>'+escHtml(reportInitial(name))+'</i><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS")+'</small></span><strong>'+escHtml(reportMinutes(p.minutes7))+'</strong><strong>'+escHtml(String(Math.round(reportNum(p.questions7))))+'</strong><strong>'+(w.total?escHtml(w.ratio+"%"):"—")+'</strong><strong>'+escHtml(String(Math.round(pp.total)))+'</strong><strong>'+escHtml(String(Math.round(reportNum(p.overdueTopics))))+'</strong><em class="report-risk-inline '+risk.tone+'">'+escHtml(risk.label)+' ›</em></button>';
  }).join("");
  $("reportStudentList").innerHTML=studentRows||'<div class="report-list-empty">Öğrenci verisi yok.</div>';
  const attentionRows=attention.slice(0,4);
  $("reportAttentionList").innerHTML=attentionRows.length?attentionRows.map(({row,score})=>{const risk=reportRiskMeta(score),p=row.share?.progress||{},w=weekStats(row.share?.program);return '<button type="button" data-report-student="'+escHtml(row.studentUid)+'"><span><b>'+escHtml(studentName(row))+'</b><small>'+(w.total?"Program %"+w.ratio:"Program yok")+' · '+Math.round(reportNum(p.overdueTopics))+' geciken</small></span><em class="'+risk.tone+'">'+escHtml(risk.label)+'</em></button>';}).join(""):'<div class="report-mini-empty">Takip önceliği oluşmadı.</div>';
  const overdueTotal=withShare.reduce((s,r)=>s+reportNum(r.share?.progress?.overdueTopics),0),ppTotal=withShare.reduce((s,r)=>s+reportPpSummaryMetrics(r).total,0);
  $("reportCoachSummary").innerHTML=
    '<div><span>Verisi güncel öğrenci</span><strong>'+withShare.length+' / '+rows.length+'</strong></div>'+
    '<div><span>Ortalama çalışma</span><strong>'+reportMinutes(rows.length?minutes/rows.length:0)+'</strong></div>'+
    '<div><span>Ortalama soru</span><strong>'+Math.round(rows.length?questions/rows.length:0)+'</strong></div>'+
    '<div><span>Paragraf + Problem</span><strong>'+Math.round(ppTotal)+' soru</strong></div>'+
    '<div><span>Geciken konu toplamı</span><strong>'+Math.round(overdueTotal)+'</strong></div>';
  const freshest=withShare.map(row=>({row,ms:reportUpdatedMs(row.share?.updatedAt)})).sort((a,b)=>b.ms-a.ms)[0]?.row;
  $("reportSyncBox").innerHTML=freshest?'<b>'+escHtml(reportTimestamp(freshest.share?.updatedAt))+'</b><span>En son '+escHtml(studentName(freshest))+' verisi güncellendi</span>':'<b>Veri bekleniyor</b><span>Henüz paylaşım alınmadı</span>';
  document.querySelectorAll("[data-report-student]").forEach(btn=>btn.addEventListener("click",()=>{
    if($("reportStudentSelect"))$("reportStudentSelect").value=btn.dataset.reportStudent;
    renderReport(btn.dataset.reportStudent);
  }));
  setReportState("reportOverview");
}
function renderStudentReport(row){
  const share=row.share||{},profile=share.profile||{},progress=share.progress||{},w=weekStats(share.program),name=studentName(row),daily=reportDailyRows(row),current7=reportPeriod(daily.slice(-7)),previous7=reportPeriod(daily.slice(-14,-7)),riskScore=reportRiskScore(row),risk=reportRiskMeta(riskScore);
  $("reportScopeTitle").textContent=name;
  $("reportScopeMeta").textContent="Detaylı takip · son 7 gün";
  $("reportStudentAvatar").textContent=reportInitial(name);
  $("reportStudentName").textContent=name;
  const target=[profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ");
  $("reportStudentTarget").textContent=[profile.track,target].filter(Boolean).join(" • ")||"Hedef bilgisi yok";
  $("reportStudentSync").textContent="Son veri: "+reportTimestamp(share.updatedAt);
  $("reportStudentRisk").textContent=risk.label;$("reportStudentRisk").className="report-risk-pill "+risk.tone;
  $("reportStudentKpis").innerHTML=
    kpi("ÇALIŞMA",reportMinutes(progress.minutes7),"Son 7 gün")+
    kpi("SORU",String(Math.round(reportNum(progress.questions7))),"Son 7 gün")+
    kpi("AKTİF GÜN",daily.length?current7.activeDays+" / 7":"—",daily.length?"Çalışma veya soru kaydı":"Yeni senkron bekleniyor")+
    kpi("PROGRAM UYUMU",w.total?w.ratio+"%":"—",w.total?w.completed+" / "+w.total+" görev":"Program verisi yok",w.total&&w.ratio<60?"warn":"")+
    kpi("GECİKEN KONU",String(Math.round(reportNum(progress.overdueTopics))),"Takip bekleyen",reportNum(progress.overdueTopics)?"warn":"");

  const trend=$("reportActivityTrend");
  if(daily.length>=14&&previous7.minutes>0){const pct=Math.round((current7.minutes-previous7.minutes)/previous7.minutes*100);trend.textContent=(pct>=0?"+":"")+pct+"% süre";trend.className="report-trend-pill "+(pct>=0?"good":"warn");}
  else{trend.textContent=daily.length?"7 günlük görünüm":"Günlük veri bekleniyor";trend.className="report-trend-pill";}
  if(daily.length){
    const rows=daily.slice(-7),maxMinutes=Math.max(1,...rows.map(item=>item.minutes)),maxQuestions=Math.max(1,...rows.map(item=>item.questions));
    $("reportActivityChart").innerHTML='<div class="report-activity-bars">'+rows.map(item=>{const d=new Date(item.date+"T12:00:00"),label=new Intl.DateTimeFormat("tr-TR",{weekday:"short"}).format(d);return '<div class="report-activity-day" title="'+escHtml(item.date+" · "+Math.round(item.minutes)+" dk · "+Math.round(item.questions)+" soru")+'"><div class="report-activity-columns"><i style="height:'+Math.max(item.minutes?8:2,item.minutes/maxMinutes*100)+'%"></i><b style="height:'+Math.max(item.questions?8:2,item.questions/maxQuestions*100)+'%"></b></div><span>'+escHtml(label)+'</span><small>'+Math.round(item.minutes)+'dk · '+Math.round(item.questions)+'s</small></div>';}).join("")+'</div><div class="report-activity-legend"><span><i></i>Odak süresi</span><span><b></b>Soru</span><em>'+reportMinutes(current7.minutes)+' · '+Math.round(current7.questions)+' soru</em></div>';
  }else $("reportActivityChart").innerHTML='<div class="report-data-wait"><b>Günlük dağılım yeni senkronla açılacak.</b><span>Toplam çalışma: '+escHtml(reportMinutes(progress.minutes7))+' · '+Math.round(reportNum(progress.questions7))+' soru</span></div>';

  $("reportStudentSignals").innerHTML=reportStudentSignals(row).map(item=>'<div class="report-signal '+item.tone+'"><i></i><span><b>'+escHtml(item.title)+'</b><small>'+escHtml(item.text)+'</small></span></div>').join("");

  $("reportProgramTitle").textContent=w.week?"Hafta · "+w.week:"Haftalık program";
  $("reportProgramScore").textContent=w.total?w.ratio+"%":"—";
  const days=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  $("reportWeekDays").innerHTML=days.map((day,i)=>{
    const tasks=w.taskCounts[i]||0,completed=w.completedCounts[i]||0,cls=!tasks?"empty":completed>=tasks?"done":completed>0?"partial":"open";
    const meta=!tasks?"Plan yok":completed>=tasks?"Tümü tamam":completed+" / "+tasks+" tamamlandı";
    return '<div class="report-day '+cls+'"><span>'+day+'</span><b>'+completed+'<small>/'+tasks+'</small></b><em class="report-day-progress"><i style="width:'+(tasks?Math.round(completed/tasks*100):0)+'%"></i></em><small>'+meta+'</small></div>';
  }).join("");

  const pp=reportPpSummaryMetrics(row);
  $("reportPpSummary").innerHTML=
    '<div><span>Soru</span><strong>'+Math.round(pp.total)+'</strong><small>Paragraf '+Math.round(pp.paragraph)+' · Problem '+Math.round(pp.problem)+'</small></div>'+
    '<div><span>Net</span><strong>'+paragraphProblemFmtNet(pp.net)+'</strong><small>Son 7 gün</small></div>'+
    '<div><span>Doğruluk</span><strong>'+Math.round(pp.accuracy)+'%</strong><small>'+Math.round(pp.correct)+' doğru · '+Math.round(pp.wrong)+' yanlış</small></div>'+
    '<div><span>Aktif gün</span><strong>'+pp.activeDays+'/7</strong><small>'+(pp.activeDays?"Düzenli kayıt":"Henüz kayıt yok")+'</small></div>';

  const dayReviews=studentDayReviews(row).slice(0,7),latestReview=dayReviews[0]||null,latestMood=dayReviewMoodMeta(latestReview?.mood);
  $("reportDayReviewLatest").textContent=latestReview?latestMood.icon+" "+latestMood.label:"—";
  $("reportDayReviewHistory").innerHTML=dayReviews.length?dayReviews.map(item=>{
    const mood=dayReviewMoodMeta(item.mood),date=new Intl.DateTimeFormat("tr-TR",{weekday:"short",day:"numeric",month:"short"}).format(new Date(item.date+"T12:00:00")),note=String(item.note||"").trim()||"Not eklenmedi.",when=item.at?new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(item.at)):"";
    return '<div class="report-day-review-row"><span class="report-day-review-date">'+escHtml(date)+'</span><span class="report-day-review-mood '+mood.tone+'">'+mood.icon+' '+mood.label+'</span><p>'+escHtml(note)+'</p><time>'+escHtml(when)+'</time></div>';
  }).join(""):'<div class="report-mini-empty">Henüz gün sonu değerlendirmesi yok.</div>';

  const subjects=reportSubjectRows(row);
  $("reportSubjectBreakdown").innerHTML=subjects.length?'<div class="report-subject-row head"><span>Ders</span><span>Odak</span><span>Soru</span><span>Yanlış</span><span>Son deneme</span></div>'+subjects.map(item=>'<div class="report-subject-row"><b>'+escHtml(item.name)+'</b><span>'+escHtml(reportMinutes(item.minutes))+'</span><span>'+Math.round(item.questions)+'</span><em class="'+(item.wrongs?"warn":"")+'">'+Math.round(item.wrongs)+'</em><strong>'+(item.examNet===null?"—":escHtml(paragraphProblemFmtNet(item.examNet)+" net"))+'</strong></div>').join(""):'<div class="report-data-wait"><b>Ders dağılımı yeni öğrenci senkronuyla açılacak.</b><span>Odak oturumları ve soru kayıtları ders bazında burada görünecek.</span></div>';

  $("reportTopicStats").innerHTML=
    '<div><span>Tamamlanan</span><strong>'+Math.round(reportNum(progress.completedTopics))+'</strong></div>'+
    '<div><span>Devam eden</span><strong>'+Math.round(reportNum(progress.activeTopics))+'</strong></div>'+
    '<div class="'+(reportNum(progress.overdueTopics)?"danger":"")+'"><span>Geciken</span><strong>'+Math.round(reportNum(progress.overdueTopics))+'</strong></div>';
  const topicItems=Array.isArray(share.topics?.items)?share.topics.items:[],today=reportDateOffset(0),topicFocus=[...topicItems].filter(item=>reportNum(item?.st)<3&&(item?.deadline||reportNum(item?.st)>0)).sort((a,b)=>{const ao=a?.deadline&&a.deadline<today?0:1,bo=b?.deadline&&b.deadline<today?0:1;return ao-bo||String(a?.deadline||"9999").localeCompare(String(b?.deadline||"9999"))}).slice(0,5);
  $("reportTopicFocus").innerHTML=topicFocus.length?topicFocus.map(item=>{const overdue=item.deadline&&item.deadline<today;return '<div class="report-topic-focus-row '+(overdue?"danger":"")+'"><span><b>'+escHtml(item.subject||"Ders")+'</b><small>'+escHtml(item.topic||"Konu")+'</small></span><em>'+(item.deadline?escHtml(item.deadline):"Devam ediyor")+'</em></div>';}).join(""):'<div class="report-mini-empty">Takip bekleyen detaylı konu görünmüyor.</div>';

  const exams=reportExamRows(row),latestDelta=exams.length>1?reportExamDelta(exams,0):null;
  $("reportExamTrend").textContent=latestDelta===null?"—":(latestDelta>=0?"+":"")+latestDelta.toFixed(1).replace(".",",")+" net";
  $("reportExamTrend").className="report-trend-pill "+(latestDelta===null?"":latestDelta>=0?"good":"warn");
  $("reportExamList").innerHTML=exams.length?exams.slice(0,5).map((exam,index)=>{const delta=reportExamDelta(exams,index);return '<div class="report-exam-row"><div><b>'+escHtml(exam.name||exam.type||"Deneme")+'</b><span>'+escHtml(exam.date||"Tarih yok")+' · '+escHtml(exam.type||"YKS")+'</span></div><span class="report-exam-delta '+(delta===null?"":delta>=0?"good":"warn")+'">'+(delta===null?"İlk veri":(delta>=0?"+":"")+delta.toFixed(1).replace(".",",")+' net')+'</span><strong>'+escHtml(paragraphProblemFmtNet(reportNum(exam.totalNet)))+' net</strong></div>';}).join(""):'<div class="report-mini-empty">Henüz deneme verisi yok.</div>';

  const errorMap=new Map();(Array.isArray(share.errorJournal)?share.errorJournal:[]).forEach(item=>{const key=(item?.subject||"Ders")+"|"+(item?.topic||"Konu"),current=errorMap.get(key)||{subject:item?.subject||"Ders",topic:item?.topic||"Konu",n:0,date:""};current.n+=Math.max(1,reportNum(item?.n));if(String(item?.date||"")>current.date)current.date=String(item.date);errorMap.set(key,current);});
  const errors=[...errorMap.values()].sort((a,b)=>b.n-a.n||b.date.localeCompare(a.date)).slice(0,7);
  $("reportErrorList").innerHTML=errors.length?errors.map(item=>'<div class="report-error-row"><div><b>'+escHtml(item.subject)+'</b><span>'+escHtml(item.topic)+' · '+escHtml(item.date||"tarih yok")+'</span></div><strong>'+Math.round(item.n)+' yanlış</strong></div>').join(""):'<div class="report-mini-empty">Henüz hata defteri kaydı yok.</div>';
  setReportState("reportStudentDetail");
}
$("reportStudentSelect")?.addEventListener("change",event=>renderReport(event.currentTarget.value));
$("reportRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user)void loadCoachReports(user.uid)});
$("reportSearch")?.addEventListener("input",event=>{
  const q=String(event.currentTarget.value||"").trim().toLocaleLowerCase("tr-TR");
  document.querySelectorAll("[data-report-name]").forEach(row=>row.classList.toggle("hidden",q&&!String(row.dataset.reportName||"").includes(q)));
});
$("reportOpenPp")?.addEventListener("click",()=>{
  const uid=$("reportStudentSelect")?.value||"";showCoachPage("paragraphProblem");hydrateParagraphProblemControls();
  if(uid&&uid!=="all"&&$("ppCoachStudentSelect")){$("ppCoachStudentSelect").value=uid;renderParagraphProblem(uid)}
});


function paragraphProblemEntries(row){
  const entries=Array.isArray(row?.share?.paragraphProblem?.entries)?row.share.paragraphProblem.entries:[];
  return entries.filter(item=>item&&/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||""))&&(item.kind==="paragraph"||item.kind==="problem")).map(item=>({
    id:String(item.id||""),date:String(item.date||""),kind:item.kind,
    correct:Math.max(0,Math.floor(reportNum(item.correct))),
    wrong:Math.max(0,Math.floor(reportNum(item.wrong))),
    blank:Math.max(0,Math.floor(reportNum(item.blank))),
    createdAt:Math.max(0,reportNum(item.createdAt))
  }));
}
function paragraphProblemDateOffset(offset){
  const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function paragraphProblemMetrics(entries){
  const totals=entries.reduce((sum,item)=>{sum.correct+=item.correct;sum.wrong+=item.wrong;sum.blank+=item.blank;return sum},{correct:0,wrong:0,blank:0});
  const total=totals.correct+totals.wrong+totals.blank,net=totals.correct-totals.wrong/4,accuracy=total?100*totals.correct/total:0,wrongRate=total?100*totals.wrong/total:0;
  return{...totals,total,net,accuracy,wrongRate,sessions:entries.length,activeDays:new Set(entries.filter(item=>item.correct+item.wrong+item.blank>0).map(item=>item.date)).size};
}
function paragraphProblemEntriesForDays(entries,days,endOffset=0){
  const keys=new Set(Array.from({length:days},(_,i)=>paragraphProblemDateOffset(endOffset-(days-1-i))));
  return entries.filter(item=>keys.has(item.date));
}
function paragraphProblemActiveStreak(entries){
  const active=new Set(entries.filter(item=>item.correct+item.wrong+item.blank>0).map(item=>item.date));
  let start=0;if(!active.has(paragraphProblemDateOffset(0))&&active.has(paragraphProblemDateOffset(-1)))start=-1;
  if(!active.has(paragraphProblemDateOffset(start)))return 0;
  let streak=0;while(streak<3650&&active.has(paragraphProblemDateOffset(start-streak)))streak++;return streak;
}
function paragraphProblemFmtNet(value){const n=reportNum(value);return Number.isInteger(n)?String(n):n.toFixed(2).replace(".",",")}
function paragraphProblemFmtPct(value,digits=0){return reportNum(value).toFixed(digits).replace(".",",")+"%"}
function paragraphProblemSigned(value,suffix=""){const n=reportNum(value);if(Math.abs(n)<.005)return"0"+suffix;return(n>0?"+":"")+n.toFixed(1).replace(".",",")+suffix}
function paragraphProblemDateLabel(date){
  return new Intl.DateTimeFormat("tr-TR",{weekday:"short",day:"2-digit",month:"short"}).format(new Date(date+"T12:00:00"));
}
function paragraphProblemBestDay(entries){
  const grouped=new Map();
  entries.forEach(item=>{const list=grouped.get(item.date)||[];list.push(item);grouped.set(item.date,list)});
  return[...grouped.entries()].map(([date,list])=>({date,m:paragraphProblemMetrics(list)})).sort((a,b)=>b.m.net-a.m.net||b.m.total-a.m.total)[0]||null;
}
function hydrateParagraphProblemControls(){
  const select=$("ppCoachStudentSelect");if(!select)return;
  const current=select.value;
  if(!coachReportRows.length){select.innerHTML='<option value="">Öğrenci yok</option>';select.value="";return}
  select.innerHTML=coachReportRows.map(row=>'<option value="'+escHtml(row.studentUid)+'">'+escHtml(studentName(row))+'</option>').join("");
  select.value=coachReportRows.some(row=>row.studentUid===current)?current:coachReportRows[0].studentUid;
}
function setParagraphProblemState(name){
  ["ppCoachLoading","ppCoachEmpty","ppCoachContent"].forEach(id=>$(id)?.classList.add("hidden"));
  $(name)?.classList.remove("hidden");
}
function paragraphProblemKpi(label,value,note,tone=""){
  return '<article class="pp-coach-kpi '+tone+'"><span>'+escHtml(label)+'</span><strong>'+escHtml(value)+'</strong><small>'+escHtml(note)+'</small></article>';
}
function paragraphProblemKindCard(kind,entries){
  const items=entries.filter(item=>item.kind===kind),today=paragraphProblemMetrics(paragraphProblemEntriesForDays(items,1)),last7=paragraphProblemMetrics(paragraphProblemEntriesForDays(items,7)),prev7=paragraphProblemMetrics(paragraphProblemEntriesForDays(items,7,-7)),last30=paragraphProblemMetrics(paragraphProblemEntriesForDays(items,30)),label=kind==="paragraph"?"Paragraf":"Problem",delta=prev7.total?last7.accuracy-prev7.accuracy:null;
  return '<article class="pp-coach-kind '+kind+'"><div class="pp-coach-kind-head"><div><span>ÇALIŞMA ALANI</span><b>'+label+'</b></div><em>'+(last7.total?(last7.accuracy>=70?"İyi gidiyor":"Dikkat"):"Veri bekleniyor")+'</em></div><div class="pp-coach-kind-main"><div><span>Bugün</span><strong>'+today.total+'</strong><small>soru · '+paragraphProblemFmtNet(today.net)+' net</small></div><div><span>7 gün</span><strong>'+last7.total+'</strong><small>'+paragraphProblemFmtPct(last7.accuracy)+' doğruluk</small></div><div><span>30 gün</span><strong>'+last30.total+'</strong><small>'+paragraphProblemFmtNet(last30.net)+' net</small></div></div><div class="pp-coach-kind-foot"><div><span>7 günlük net</span><b>'+paragraphProblemFmtNet(last7.net)+'</b></div><div><span>Yanlış oranı</span><b>'+paragraphProblemFmtPct(last7.wrongRate)+'</b></div><div><span>Aktif gün</span><b>'+last7.activeDays+'/7</b></div><div><span>Doğruluk farkı</span><b>'+(delta===null?"—":paragraphProblemSigned(delta," puan"))+'</b></div></div></article>';
}
function renderParagraphProblem(scope=""){
  if(!coachReportRows.length){if($("ppCoachEmptyText"))$("ppCoachEmptyText").textContent="Henüz bağlı öğrenci yok.";setParagraphProblemState("ppCoachEmpty");return}
  let row=coachReportRows.find(item=>item.studentUid===scope);if(!row)row=coachReportRows[0];
  if($("ppCoachStudentSelect"))$("ppCoachStudentSelect").value=row.studentUid;
  const entries=paragraphProblemEntries(row).sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.createdAt-a.createdAt),name=studentName(row);
  if($("ppCoachScopeTitle"))$("ppCoachScopeTitle").textContent=name;
  if($("ppCoachScopeMeta"))$("ppCoachScopeMeta").textContent="Paragraf + Problem performans görünümü";
  $("ppCoachSync").textContent=row.share?.updatedAt?"Son veri · "+reportTimestamp(row.share.updatedAt):"Henüz paylaşım alınmadı";
  if(!entries.length){if($("ppCoachEmptyText"))$("ppCoachEmptyText").textContent=name+" henüz paragraf veya problem kaydı eklememiş.";setParagraphProblemState("ppCoachEmpty");return}

  const today=paragraphProblemMetrics(paragraphProblemEntriesForDays(entries,1)),last7=paragraphProblemMetrics(paragraphProblemEntriesForDays(entries,7)),prev7=paragraphProblemMetrics(paragraphProblemEntriesForDays(entries,7,-7)),last30Entries=paragraphProblemEntriesForDays(entries,30),last30=paragraphProblemMetrics(last30Entries),streak=paragraphProblemActiveStreak(entries);
  $("ppCoachKpis").innerHTML=
    paragraphProblemKpi("BUGÜN TOPLAM",today.total+" soru",today.sessions+" oturum","accent")+
    paragraphProblemKpi("BUGÜN NET",paragraphProblemFmtNet(today.net)+" net",paragraphProblemFmtPct(today.accuracy)+" doğruluk")+
    paragraphProblemKpi("7 GÜNLÜK HACİM",last7.total+" soru",last7.activeDays+"/7 aktif gün")+
    paragraphProblemKpi("AKTİF SERİ",streak+" gün","düzenli kayıtla büyür",streak?"good":"");
  $("ppCoachKinds").innerHTML=paragraphProblemKindCard("paragraph",entries)+paragraphProblemKindCard("problem",entries);

  const tempoDays=Array.from({length:14},(_,i)=>paragraphProblemDateOffset(i-13)),tempoRows=tempoDays.map(date=>{const m=paragraphProblemMetrics(entries.filter(item=>item.date===date));return{date,m}}),tempoMax=Math.max(1,...tempoRows.map(item=>item.m.total));
  $("ppCoachTempo").innerHTML='<div class="pp-tempo-bars">'+tempoRows.map(({date,m})=>'<div class="pp-tempo-day" title="'+escHtml(paragraphProblemDateLabel(date))+' · '+m.total+' soru"><div class="pp-tempo-columns"><i style="height:'+(m.total/tempoMax*100)+'%"></i><b style="height:'+(m.correct/tempoMax*100)+'%"></b></div><span>'+date.slice(8)+'</span></div>').join("")+'</div><div class="pp-tempo-legend"><span><i></i>Soru hacmi</span><span><b></b>Doğru</span></div>';

  const volumeDelta=last7.total-prev7.total,signals=[];
  signals.push(today.total?'Bugün '+today.total+' soru çözüldü ve '+paragraphProblemFmtNet(today.net)+' net yapıldı.':'Bugün henüz kayıt yok. İlk oturum eklendiğinde günlük performans burada oluşacak.');
  signals.push(prev7.total?'Son 7 günde '+last7.total+' soru çözüldü. Önceki 7 güne göre '+paragraphProblemSigned(volumeDelta,' soru')+'.':'Son 7 günde '+last7.total+' soru çözüldü. Önceki dönem verisi oluşunca karşılaştırma açılacak.');
  signals.push('Aktif çalışma serisi '+streak+' gün. Son 30 günde '+last30.activeDays+' aktif gün var.');
  $("ppCoachSignals").innerHTML=signals.map((signal,index)=>'<div><b>'+(index+1)+'</b><p>'+escHtml(signal)+'</p></div>').join("");

  const accuracyDelta=last7.accuracy-prev7.accuracy,activeDelta=last7.activeDays-prev7.activeDays;
  $("ppCoachCompare").innerHTML='<div class="pp-compare-row head"><span>Ölçüm</span><span>Son 7</span><span>Önceki 7</span><span>Fark</span></div>'+
    '<div class="pp-compare-row"><b>Soru</b><strong>'+last7.total+'</strong><span>'+prev7.total+'</span><em>'+(prev7.total?paragraphProblemSigned(volumeDelta):"Yeni veri")+'</em></div>'+
    '<div class="pp-compare-row"><b>Net</b><strong>'+paragraphProblemFmtNet(last7.net)+'</strong><span>'+paragraphProblemFmtNet(prev7.net)+'</span><em>'+paragraphProblemSigned(last7.net-prev7.net)+'</em></div>'+
    '<div class="pp-compare-row"><b>Doğruluk</b><strong>'+paragraphProblemFmtPct(last7.accuracy)+'</strong><span>'+paragraphProblemFmtPct(prev7.accuracy)+'</span><em>'+paragraphProblemSigned(accuracyDelta," puan")+'</em></div>'+
    '<div class="pp-compare-row"><b>Aktif gün</b><strong>'+last7.activeDays+'</strong><span>'+prev7.activeDays+'</span><em>'+paragraphProblemSigned(activeDelta)+'</em></div>';

  const best=paragraphProblemBestDay(last30Entries),avg=last30.activeDays?last30.total/last30.activeDays:0,maxDay=Math.max(1,...Array.from({length:30},(_,i)=>paragraphProblemMetrics(entries.filter(item=>item.date===paragraphProblemDateOffset(i-29))).total));
  $("ppCoachRhythm").innerHTML='<div class="pp-rhythm-stats"><div><span>Aktif gün</span><strong>'+last30.activeDays+'<small>/30</small></strong></div><div><span>Aktif gün ort.</span><strong>'+avg.toFixed(1).replace(".",",")+'<small> soru</small></strong></div><div><span>Seri</span><strong>'+streak+'<small> gün</small></strong></div><div><span>En iyi gün</span><strong>'+(best?paragraphProblemFmtNet(best.m.net):"—")+'<small>'+(best?" net · "+paragraphProblemDateLabel(best.date):"")+'</small></strong></div></div><div class="pp-rhythm-heat">'+Array.from({length:30},(_,i)=>{const date=paragraphProblemDateOffset(i-29),m=paragraphProblemMetrics(entries.filter(item=>item.date===date)),level=m.total?Math.max(.18,m.total/maxDay):0;return'<i title="'+escHtml(paragraphProblemDateLabel(date))+' · '+m.total+' soru" style="--pp-level:'+level+'"></i>'}).join("")+'</div>';

  const daily=Array.from({length:7},(_,index)=>paragraphProblemDateOffset(-index)).map(date=>{
    const dayEntries=entries.filter(item=>item.date===date),m=paragraphProblemMetrics(dayEntries),p=paragraphProblemMetrics(dayEntries.filter(item=>item.kind==="paragraph")),pr=paragraphProblemMetrics(dayEntries.filter(item=>item.kind==="problem"));return{date,m,p,pr};
  });
  $("ppCoachDaily").innerHTML='<div class="pp-coach-daily-row head"><span>Gün</span><span>Paragraf</span><span>Problem</span><span>Toplam</span><span>Net</span><span>Doğruluk</span></div>'+daily.map(({date,m,p,pr})=>'<div class="pp-coach-daily-row"><b>'+escHtml(paragraphProblemDateLabel(date))+'</b><span>'+p.total+'</span><span>'+pr.total+'</span><strong>'+m.total+'</strong><span>'+escHtml(paragraphProblemFmtNet(m.net))+'</span><em>'+escHtml(paragraphProblemFmtPct(m.accuracy))+'</em></div>').join("");

  $("ppCoachHistory").innerHTML=entries.slice(0,40).map(item=>{const m=paragraphProblemMetrics([item]);return'<div class="pp-coach-history-row"><span class="pp-coach-badge '+item.kind+'">'+(item.kind==="paragraph"?"Paragraf":"Problem")+'</span><b>'+escHtml(paragraphProblemDateLabel(item.date))+'</b><span>'+item.correct+' doğru</span><span>'+item.wrong+' yanlış</span><span>'+item.blank+' boş</span><strong>'+m.total+' soru</strong><em>'+escHtml(paragraphProblemFmtNet(m.net))+' net</em><small>'+escHtml(paragraphProblemFmtPct(m.accuracy))+' doğruluk</small></div>'}).join("");
  setParagraphProblemState("ppCoachContent");
}
$("ppCoachStudentSelect")?.addEventListener("change",event=>renderParagraphProblem(event.currentTarget.value));
$("ppCoachRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user)void loadCoachReports(user.uid)});


function examList(row,type="all"){
  const exams=Array.isArray(row?.share?.exams)?row.share.exams:[];
  const filtered=type==="all"?exams:exams.filter(x=>String(x?.type||"").toLocaleUpperCase("tr-TR")===type);
  return [...filtered].sort((a,b)=>String(a?.date||"").localeCompare(String(b?.date||"")));
}
function hydrateExamStudentSelect(){
  const select=$("examStudentSelect");if(!select)return;
  const current=select.value||"all";
  select.innerHTML='<option value="all">Tüm öğrenciler</option>'+coachReportRows.map(row=>'<option value="'+escHtml(row.studentUid)+'">'+escHtml(studentName(row))+'</option>').join("");
  select.value=coachReportRows.some(x=>x.studentUid===current)?current:"all";
}
function setExamState(name){
  ["examLoading","examEmpty","examOverview","examStudentDetail"].forEach(id=>$(id)?.classList.add("hidden"));
  $(name)?.classList.remove("hidden");
}
function examKpi(label,value,note,tone=""){
  return '<article class="exam-kpi '+tone+'"><span>'+escHtml(label)+'</span><strong>'+escHtml(value)+'</strong><small>'+escHtml(note)+'</small></article>';
}
function examTypeValue(){return $("examTypeSelect")?.value||"all"}
function renderExamAnalysis(scope){
  if(!coachReportRows.length){setExamState("examEmpty");return}
  const type=examTypeValue();
  const totalExams=coachReportRows.reduce((sum,row)=>sum+examList(row,type).length,0);
  if(!totalExams){setExamState("examEmpty");return}
  if(scope==="all"){renderExamOverview(type);return}
  const row=coachReportRows.find(x=>x.studentUid===scope);
  if(!row){renderExamOverview(type);return}
  renderExamStudent(row,type);
}
function renderExamOverview(type){
  $("examScopeTitle").textContent="Tüm öğrenciler";
  $("examScopeMeta").textContent=type==="all"?"Tüm deneme türleri":type+" denemeleri";
  const all=coachReportRows.flatMap(row=>examList(row,type).map(exam=>({row,exam})));
  const nets=all.map(x=>reportNum(x.exam.totalNet));
  const avg=nets.length?nets.reduce((a,b)=>a+b,0)/nets.length:0;
  const best=nets.length?Math.max(...nets):0;
  const studentsWithExams=coachReportRows.filter(row=>examList(row,type).length).length;
  $("examOverviewKpis").innerHTML=
    examKpi("TOPLAM DENEME",String(all.length),type==="all"?"Tüm türler":type)+
    examKpi("ORTALAMA NET",avg.toFixed(1),"Tüm sonuçlar")+
    examKpi("EN YÜKSEK NET",best.toFixed(1),"Kayıtlı sonuç")+
    examKpi("DENEME GİREN",String(studentsWithExams),coachReportRows.length+" bağlı öğrenci");
  const recent=[...all].sort((a,b)=>String(b.exam?.date||"").localeCompare(String(a.exam?.date||""))).slice(0,10);
  $("examRecentList").innerHTML=recent.map(({row,exam})=>'<button type="button" class="exam-recent-row" data-exam-student="'+escHtml(row.studentUid)+'"><span><i>'+escHtml(reportInitial(studentName(row)))+'</i><b>'+escHtml(studentName(row))+'</b></span><strong>'+escHtml(exam.name||"Deneme")+'</strong><em>'+escHtml(exam.type||"—")+'</em><small>'+escHtml(exam.date||"—")+'</small><b>'+reportNum(exam.totalNet).toFixed(1)+'</b></button>').join("");
  const compare=coachReportRows.map(row=>({row,list:examList(row,type)})).filter(x=>x.list.length).map(x=>({row:x.row,exam:x.list.at(-1)})).sort((a,b)=>reportNum(b.exam.totalNet)-reportNum(a.exam.totalNet));
  const max=Math.max(1,...compare.map(x=>Math.max(0,reportNum(x.exam.totalNet))));
  $("examComparisonList").innerHTML=compare.length?compare.map(({row,exam})=>'<button type="button" class="exam-compare-row" data-exam-student="'+escHtml(row.studentUid)+'"><div><span>'+escHtml(studentName(row))+'</span><strong>'+reportNum(exam.totalNet).toFixed(1)+' net</strong></div><i><b style="width:'+Math.max(3,Math.min(100,reportNum(exam.totalNet)/max*100))+'%"></b></i></button>').join(""):'<div class="exam-mini-empty">Karşılaştırılacak deneme yok.</div>';
  document.querySelectorAll("[data-exam-student]").forEach(btn=>btn.addEventListener("click",()=>{if($("examStudentSelect"))$("examStudentSelect").value=btn.dataset.examStudent;renderExamAnalysis(btn.dataset.examStudent)}));
  setExamState("examOverview");
}
function renderExamStudent(row,type){
  const list=examList(row,type),name=studentName(row),profile=row.share?.profile||{};
  if(!list.length){setExamState("examEmpty");return}
  const latest=list.at(-1),previous=list.length>1?list.at(-2):null;
  const latestNet=reportNum(latest.totalNet),previousNet=previous?reportNum(previous.totalNet):null;
  const delta=previousNet===null?null:latestNet-previousNet;
  const best=Math.max(...list.map(x=>reportNum(x.totalNet)));
  const avg=list.reduce((s,x)=>s+reportNum(x.totalNet),0)/list.length;
  $("examScopeTitle").textContent=name;
  $("examScopeMeta").textContent=(type==="all"?"Tüm türler":type)+" · "+list.length+" deneme";
  $("examStudentAvatar").textContent=reportInitial(name);
  $("examStudentName").textContent=name;
  const target=[profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ");
  $("examStudentTarget").textContent=[profile.track,target].filter(Boolean).join(" • ")||"Hedef bilgisi yok";
  $("examLatestPill").textContent="Son deneme · "+(latest.date||"Tarih yok");
  $("examStudentKpis").innerHTML=
    examKpi("SON NET",latestNet.toFixed(1),latest.name||latest.type||"Son deneme")+
    examKpi("EN İYİ NET",best.toFixed(1),list.length+" deneme")+
    examKpi("ORTALAMA NET",avg.toFixed(1),type==="all"?"Tüm türler":type)+
    examKpi("SON DEĞİŞİM",delta===null?"—":(delta>0?"+":"")+delta.toFixed(1),previous?"Önceki denemeye göre":"Karşılaştırma yok",delta!==null&&delta<0?"down":delta!==null&&delta>0?"up":"");
  const trend=list.slice(-10),max=Math.max(1,...trend.map(x=>Math.max(0,reportNum(x.totalNet))));
  $("examTrendChart").innerHTML='<div class="exam-chart-y"><span>'+Math.ceil(max)+'</span><span>'+Math.ceil(max/2)+'</span><span>0</span></div><div class="exam-chart-main"><div class="exam-chart-grid"><i></i><i></i><i></i></div><div class="exam-bars">'+trend.map((exam,index)=>'<div class="exam-bar-wrap" title="'+escHtml(exam.name||"Deneme")+' · '+reportNum(exam.totalNet).toFixed(1)+' net"><b style="height:'+Math.max(4,reportNum(exam.totalNet)/max*100)+'%"></b><span>'+escHtml(exam.date?exam.date.slice(5):String(index+1))+'</span></div>').join("")+'</div></div>';
  const subjects=Array.isArray(latest.subjectResults)?latest.subjectResults:[];
  const subjectMax=Math.max(1,...subjects.map(x=>Math.max(0,reportNum(x.net))));
  $("examSubjectList").innerHTML=subjects.length?subjects.map(item=>'<div class="exam-subject-row"><div><b>'+escHtml(item.name||"Ders")+'</b><span>'+reportNum(item.net).toFixed(1)+' net</span></div><i><b style="width:'+Math.max(3,Math.min(100,reportNum(item.net)/subjectMax*100))+'%"></b></i></div>').join(""):'<div class="exam-mini-empty">Bu denemede ders bazlı veri yok.</div>';
  const reversed=[...list].reverse();
  $("examHistoryList").innerHTML=reversed.map((exam,index)=>{
    const prev=reversed[index+1],change=prev?reportNum(exam.totalNet)-reportNum(prev.totalNet):null;
    const changeText=change===null?"—":(change>0?"+":"")+change.toFixed(1);
    const cls=change===null?"":change>0?"up":change<0?"down":"";
    return '<div class="exam-history-row"><span><b>'+escHtml(exam.name||"Deneme")+'</b><small>'+escHtml((exam.subjectResults||[]).length+" ders")+'</small></span><em>'+escHtml(exam.type||"—")+'</em><small>'+escHtml(exam.date||"—")+'</small><strong>'+reportNum(exam.totalNet).toFixed(1)+'</strong><i class="'+cls+'">'+changeText+'</i></div>';
  }).join("");
  let insight='<div><span>Toplam deneme</span><strong>'+list.length+'</strong></div><div><span>Son net</span><strong>'+latestNet.toFixed(1)+'</strong></div><div><span>En iyi net</span><strong>'+best.toFixed(1)+'</strong></div>';
  if(delta!==null)insight+='<div><span>Son değişim</span><strong class="'+(delta>0?"up":delta<0?"down":"")+'">'+(delta>0?"+":"")+delta.toFixed(1)+'</strong></div>';
  $("examInsight").innerHTML=insight;
  setExamState("examStudentDetail");
}
$("examStudentSelect")?.addEventListener("change",event=>renderExamAnalysis(event.currentTarget.value));
$("examTypeSelect")?.addEventListener("change",()=>renderExamAnalysis($("examStudentSelect")?.value||"all"));
$("examRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user){setExamState("examLoading");void loadCoachReports(user.uid)}});


function topicItems(row){
  const items=row?.share?.topics?.items;
  return Array.isArray(items)?items:[];
}
function topicToday(){return new Date().toISOString().slice(0,10)}
function topicState(item){
  const st=reportNum(item?.st),deadline=String(item?.deadline||"");
  if(st>=3)return"completed";
  if(deadline&&deadline<topicToday())return"overdue";
  if(st>0)return"active";
  return"not-started";
}
function topicStateText(item){
  const state=topicState(item);
  return state==="completed"?"Tamamlandı":state==="overdue"?"Gecikti":state==="active"?"Devam ediyor":"Başlanmadı";
}
function topicFiltered(items){
  const subject=$("topicSubjectSelect")?.value||"all";
  const status=$("topicStatusSelect")?.value||"all";
  return items.filter(item=>(subject==="all"||String(item.subject||"Ders")===subject)&&(status==="all"||topicState(item)===status));
}
function hydrateTopicControls(){
  const student=$("topicStudentSelect"),subject=$("topicSubjectSelect");
  if(student){
    const current=student.value||"all";
    student.innerHTML='<option value="all">Tüm öğrenciler</option>'+coachReportRows.map(row=>'<option value="'+escHtml(row.studentUid)+'">'+escHtml(studentName(row))+'</option>').join("");
    student.value=coachReportRows.some(x=>x.studentUid===current)?current:"all";
  }
  if(subject){
    const current=subject.value||"all";
    const subjects=[...new Set(coachReportRows.flatMap(row=>topicItems(row).map(x=>String(x.subject||"Ders"))))].sort((a,b)=>a.localeCompare(b,"tr"));
    subject.innerHTML='<option value="all">Tüm dersler</option>'+subjects.map(name=>'<option value="'+escHtml(name)+'">'+escHtml(name)+'</option>').join("");
    subject.value=subjects.includes(current)?current:"all";
  }
}
function setTopicState(name){
  ["topicLoading","topicEmpty","topicOverview","topicStudentDetail"].forEach(id=>$(id)?.classList.add("hidden"));
  $(name)?.classList.remove("hidden");
}
function topicKpi(label,value,note,tone=""){
  return '<article class="topic-kpi '+tone+'"><span>'+escHtml(label)+'</span><strong>'+escHtml(value)+'</strong><small>'+escHtml(note)+'</small></article>';
}
function topicCounts(items){
  const counts={total:items.length,completed:0,active:0,overdue:0,notStarted:0};
  items.forEach(item=>{const s=topicState(item);if(s==="completed")counts.completed++;else if(s==="active")counts.active++;else if(s==="overdue")counts.overdue++;else counts.notStarted++});
  counts.ratio=counts.total?Math.round(counts.completed/counts.total*100):0;
  return counts;
}
function renderTopicAnalysis(scope){
  const allTopics=coachReportRows.flatMap(row=>topicItems(row));
  if(!coachReportRows.length||!allTopics.length){setTopicState("topicEmpty");return}
  if(scope==="all"){renderTopicOverview();return}
  const row=coachReportRows.find(x=>x.studentUid===scope);
  if(!row){renderTopicOverview();return}
  renderTopicStudent(row);
}
function renderTopicOverview(){
  const rows=coachReportRows;
  const all=topicFiltered(rows.flatMap(row=>topicItems(row)));
  if(!all.length){setTopicState("topicEmpty");return}
  const counts=topicCounts(all);
  $("topicScopeTitle").textContent="Tüm öğrenciler";
  $("topicScopeMeta").textContent="Genel konu ilerleme özeti";
  $("topicOverviewKpis").innerHTML=
    topicKpi("TOPLAM KONU",String(counts.total),"Takip edilen")+
    topicKpi("TAMAMLANAN",String(counts.completed),counts.ratio+"% tamamlandı")+
    topicKpi("DEVAM EDEN",String(counts.active),"Aktif çalışma")+
    topicKpi("GECİKEN",String(counts.overdue),"Koç takibi",counts.overdue?"warn":"");
  $("topicStudentList").innerHTML=rows.map(row=>{
    const items=topicFiltered(topicItems(row)),c=topicCounts(items),name=studentName(row);
    if(!items.length)return"";
    return '<button type="button" class="topic-student-row" data-topic-student="'+escHtml(row.studentUid)+'"><span class="topic-student-main"><i>'+escHtml(reportInitial(name))+'</i><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS")+'</small></span><strong>'+c.completed+'</strong><strong>'+c.active+'</strong><strong class="'+(c.overdue?"danger":"")+'">'+c.overdue+'</strong><span class="topic-progress-cell"><i><b style="width:'+c.ratio+'%"></b></i><em>'+c.ratio+'%</em></span></button>';
  }).join("")||'<div class="topic-mini-empty">Seçili filtrelerde öğrenci konusu yok.</div>';
  const subjectMap=new Map();
  all.forEach(item=>{const key=String(item.subject||"Ders"),entry=subjectMap.get(key)||{total:0,completed:0};entry.total++;if(topicState(item)==="completed")entry.completed++;subjectMap.set(key,entry)});
  $("topicSubjectOverview").innerHTML=[...subjectMap.entries()].sort((a,b)=>b[1].total-a[1].total).slice(0,8).map(([name,v])=>{const ratio=v.total?Math.round(v.completed/v.total*100):0;return '<div><span>'+escHtml(name)+'</span><i><b style="width:'+ratio+'%"></b></i><strong>'+ratio+'%</strong></div>'}).join("")||'<div class="topic-mini-empty">Ders verisi yok.</div>';
  const overdue=rows.flatMap(row=>topicItems(row).filter(x=>topicState(x)==="overdue").map(item=>({row,item}))).slice(0,6);
  $("topicOverdueOverview").innerHTML=overdue.length?overdue.map(({row,item})=>'<button type="button" data-topic-student="'+escHtml(row.studentUid)+'"><div><b>'+escHtml(item.topic||"Konu")+'</b><span>'+escHtml(studentName(row))+' · '+escHtml(item.subject||"Ders")+'</span></div><strong>'+escHtml(item.deadline||"—")+'</strong></button>').join(""):'<div class="topic-mini-empty">Geciken konu yok.</div>';
  document.querySelectorAll("[data-topic-student]").forEach(btn=>btn.addEventListener("click",()=>{if($("topicStudentSelect"))$("topicStudentSelect").value=btn.dataset.topicStudent;renderTopicAnalysis(btn.dataset.topicStudent)}));
  setTopicState("topicOverview");
}
function renderTopicStudent(row){
  const base=topicItems(row),items=topicFiltered(base),counts=topicCounts(base),name=studentName(row),profile=row.share?.profile||{};
  if(!base.length){setTopicState("topicEmpty");return}
  $("topicScopeTitle").textContent=name;
  $("topicScopeMeta").textContent="Öğrenci konu detay raporu";
  $("topicStudentAvatar").textContent=reportInitial(name);
  $("topicStudentName").textContent=name;
  const target=[profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ");
  $("topicStudentTarget").textContent=[profile.track,target].filter(Boolean).join(" • ")||"Hedef bilgisi yok";
  $("topicStudentProgress").textContent=counts.ratio+"% tamamlandı";
  $("topicStudentKpis").innerHTML=
    topicKpi("TOPLAM KONU",String(counts.total),"Takip edilen")+
    topicKpi("TAMAMLANAN",String(counts.completed),counts.ratio+"% ilerleme")+
    topicKpi("DEVAM EDEN",String(counts.active),"Aktif çalışma")+
    topicKpi("GECİKEN",String(counts.overdue),"Takip bekleyen",counts.overdue?"warn":"");
  $("topicDetailList").innerHTML=items.length?items.sort((a,b)=>String(a.subject||"").localeCompare(String(b.subject||""),"tr")).map(item=>{
    const state=topicState(item);
    return '<div class="topic-detail-row"><span><b>'+escHtml(item.topic||"Konu")+'</b><small>'+escHtml(item.key||"")+'</small></span><strong>'+escHtml(item.subject||"Ders")+'</strong><em>'+escHtml(item.exam||"YKS")+'</em><small>'+escHtml(item.deadline||"—")+'</small><i class="'+state+'">'+escHtml(topicStateText(item))+'</i></div>';
  }).join(""):'<div class="topic-mini-empty">Seçili filtrelerde konu yok.</div>';
  const subjectMap=new Map();
  base.forEach(item=>{const key=String(item.subject||"Ders"),entry=subjectMap.get(key)||{total:0,completed:0};entry.total++;if(topicState(item)==="completed")entry.completed++;subjectMap.set(key,entry)});
  $("topicStudentSubjects").innerHTML=[...subjectMap.entries()].sort((a,b)=>b[1].total-a[1].total).map(([subject,v])=>{const ratio=v.total?Math.round(v.completed/v.total*100):0;return '<div><div><span>'+escHtml(subject)+'</span><strong>'+ratio+'%</strong></div><i><b style="width:'+ratio+'%"></b></i><small>'+v.completed+' / '+v.total+' konu</small></div>'}).join("");
  const priority=base.filter(item=>topicState(item)==="overdue").sort((a,b)=>String(a.deadline||"").localeCompare(String(b.deadline||""))).slice(0,7);
  $("topicPriorityList").innerHTML=priority.length?priority.map(item=>'<div><span><b>'+escHtml(item.topic||"Konu")+'</b><small>'+escHtml(item.subject||"Ders")+'</small></span><strong>'+escHtml(item.deadline||"—")+'</strong></div>').join(""):'<div class="topic-mini-empty">Geciken hedef yok.</div>';
  setTopicState("topicStudentDetail");
}
$("topicStudentSelect")?.addEventListener("change",event=>renderTopicAnalysis(event.currentTarget.value));
$("topicSubjectSelect")?.addEventListener("change",()=>renderTopicAnalysis($("topicStudentSelect")?.value||"all"));
$("topicStatusSelect")?.addEventListener("change",()=>renderTopicAnalysis($("topicStudentSelect")?.value||"all"));
$("topicRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user){setTopicState("topicLoading");void loadCoachReports(user.uid)}});


function errorItems(row){
  const items=row?.share?.errorJournal;
  return Array.isArray(items)?items:[];
}
function errorFiltered(items){
  const subject=$("errorSubjectSelect")?.value||"all";
  return items.filter(item=>subject==="all"||String(item.subject||"Ders")===subject);
}
function errorTotal(items){return items.reduce((sum,item)=>sum+Math.max(1,reportNum(item?.n)||1),0)}
function errorLatestDate(items){
  return [...items].map(x=>String(x?.date||"")).filter(Boolean).sort().at(-1)||"—";
}
function errorSubjectMap(items){
  const map=new Map();
  items.forEach(item=>{
    const key=String(item?.subject||"Ders"),entry=map.get(key)||{records:0,total:0};
    entry.records++;entry.total+=Math.max(1,reportNum(item?.n)||1);map.set(key,entry);
  });
  return map;
}
function errorTopicMap(items){
  const map=new Map();
  items.forEach(item=>{
    const subject=String(item?.subject||"Ders"),topic=String(item?.topic||"Konu"),key=subject+"|"+topic,entry=map.get(key)||{subject,topic,records:0,total:0,last:""};
    entry.records++;entry.total+=Math.max(1,reportNum(item?.n)||1);if(String(item?.date||"")>entry.last)entry.last=String(item?.date||"");map.set(key,entry);
  });
  return map;
}
function hydrateErrorControls(){
  const student=$("errorStudentSelect"),subject=$("errorSubjectSelect");
  if(student){
    const current=student.value||"all";
    student.innerHTML='<option value="all">Tüm öğrenciler</option>'+coachReportRows.map(row=>'<option value="'+escHtml(row.studentUid)+'">'+escHtml(studentName(row))+'</option>').join("");
    student.value=coachReportRows.some(x=>x.studentUid===current)?current:"all";
  }
  if(subject){
    const current=subject.value||"all";
    const subjects=[...new Set(coachReportRows.flatMap(row=>errorItems(row).map(x=>String(x.subject||"Ders"))))].sort((a,b)=>a.localeCompare(b,"tr"));
    subject.innerHTML='<option value="all">Tüm dersler</option>'+subjects.map(name=>'<option value="'+escHtml(name)+'">'+escHtml(name)+'</option>').join("");
    subject.value=subjects.includes(current)?current:"all";
  }
}
function setErrorState(name){
  ["errorLoading","errorEmpty","errorLoadError","errorOverview","errorStudentDetail"].forEach(id=>$(id)?.classList.add("hidden"));
  $(name)?.classList.remove("hidden");
}
function errorKpi(label,value,note,tone=""){
  return '<article class="error-kpi '+tone+'"><span>'+escHtml(label)+'</span><strong>'+escHtml(value)+'</strong><small>'+escHtml(note)+'</small></article>';
}
function renderErrorAnalysis(scope){
  const all=coachReportRows.flatMap(row=>errorItems(row));
  if(!coachReportRows.length||!all.length){setErrorState("errorEmpty");return}
  if(scope==="all"){renderErrorOverview();return}
  const row=coachReportRows.find(x=>x.studentUid===scope);
  if(!row){renderErrorOverview();return}
  renderErrorStudent(row);
}
function renderErrorOverview(){
  const rows=coachReportRows,all=errorFiltered(rows.flatMap(row=>errorItems(row)));
  if(!all.length){setErrorState("errorEmpty");return}
  const total=errorTotal(all),subjects=errorSubjectMap(all),topics=errorTopicMap(all);
  const repeated=[...topics.values()].filter(x=>x.records>1||x.total>1);
  $("errorScopeTitle").textContent="Tüm öğrenciler";
  $("errorScopeMeta").textContent="Genel yanlış analizi";
  $("errorOverviewKpis").innerHTML=
    errorKpi("HATA KAYDI",String(all.length),"Toplam kayıt")+
    errorKpi("TOPLAM YANLIŞ",String(total),"Kayıtlardaki toplam")+
    errorKpi("DERS",String(subjects.size),"Yanlış bulunan")+
    errorKpi("TEKRAR EDEN KONU",String(repeated.length),"Koç odağı",repeated.length?"warn":"");
  $("errorStudentList").innerHTML=rows.map(row=>{
    const items=errorFiltered(errorItems(row));if(!items.length)return"";
    const subjectEntries=[...errorSubjectMap(items).entries()].sort((a,b)=>b[1].total-a[1].total),top=subjectEntries[0];
    const name=studentName(row);
    return '<button type="button" class="error-student-row" data-error-student="'+escHtml(row.studentUid)+'"><span class="error-student-main"><i>'+escHtml(reportInitial(name))+'</i><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS")+'</small></span><strong>'+items.length+'</strong><strong>'+errorTotal(items)+'</strong><span>'+escHtml(top?top[0]:"—")+'</span><em>'+escHtml(errorLatestDate(items))+' ›</em></button>';
  }).join("")||'<div class="error-mini-empty">Seçili derste hata kaydı yok.</div>';
  const maxSubject=Math.max(1,...[...subjects.values()].map(x=>x.total));
  $("errorSubjectOverview").innerHTML=[...subjects.entries()].sort((a,b)=>b[1].total-a[1].total).slice(0,8).map(([name,v])=>'<div><div><span>'+escHtml(name)+'</span><strong>'+v.total+'</strong></div><i><b style="width:'+Math.max(4,v.total/maxSubject*100)+'%"></b></i><small>'+v.records+' kayıt</small></div>').join("");
  $("errorTopicOverview").innerHTML=[...topics.values()].sort((a,b)=>b.total-a.total||b.records-a.records).slice(0,7).map(item=>'<div><span><b>'+escHtml(item.topic)+'</b><small>'+escHtml(item.subject)+'</small></span><strong>'+item.total+' yanlış</strong></div>').join("")||'<div class="error-mini-empty">Konu verisi yok.</div>';
  document.querySelectorAll("[data-error-student]").forEach(btn=>btn.addEventListener("click",()=>{if($("errorStudentSelect"))$("errorStudentSelect").value=btn.dataset.errorStudent;renderErrorAnalysis(btn.dataset.errorStudent)}));
  setErrorState("errorOverview");
}
function renderErrorStudent(row){
  const base=errorItems(row),items=errorFiltered(base),name=studentName(row),profile=row.share?.profile||{};
  if(!base.length){setErrorState("errorEmpty");return}
  const subjects=errorSubjectMap(base),topics=errorTopicMap(base),repeated=[...topics.values()].filter(x=>x.records>1||x.total>1).sort((a,b)=>b.total-a.total);
  $("errorScopeTitle").textContent=name;
  $("errorScopeMeta").textContent="Öğrenci hata detay raporu";
  $("errorStudentAvatar").textContent=reportInitial(name);
  $("errorStudentName").textContent=name;
  const target=[profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ");
  $("errorStudentTarget").textContent=[profile.track,target].filter(Boolean).join(" • ")||"Hedef bilgisi yok";
  $("errorStudentCount").textContent=errorTotal(base)+" toplam yanlış";
  $("errorStudentKpis").innerHTML=
    errorKpi("HATA KAYDI",String(base.length),"Toplam kayıt")+
    errorKpi("TOPLAM YANLIŞ",String(errorTotal(base)),"Tüm kayıtlar")+
    errorKpi("DERS",String(subjects.size),"Yanlış bulunan")+
    errorKpi("TEKRAR EDEN",String(repeated.length),"Konu",repeated.length?"warn":"");
  $("errorLogList").innerHTML=items.length?[...items].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(item=>'<div class="error-log-row"><span><b>'+escHtml(item.topic||"Konu belirtilmemiş")+'</b><small>'+escHtml(item.subject||"Ders")+'</small></span><strong>'+escHtml(item.subject||"Ders")+'</strong><em>'+escHtml(item.date||"—")+'</em><i>'+Math.max(1,reportNum(item.n)||1)+' yanlış</i></div>').join(""):'<div class="error-mini-empty">Seçili derste hata kaydı yok.</div>';
  const max=Math.max(1,...[...subjects.values()].map(x=>x.total));
  $("errorStudentSubjects").innerHTML=[...subjects.entries()].sort((a,b)=>b[1].total-a[1].total).map(([subject,v])=>'<div><div><span>'+escHtml(subject)+'</span><strong>'+v.total+'</strong></div><i><b style="width:'+Math.max(4,v.total/max*100)+'%"></b></i><small>'+v.records+' kayıt</small></div>').join("");
  $("errorRepeatedTopics").innerHTML=repeated.length?repeated.slice(0,8).map(item=>'<div><span><b>'+escHtml(item.topic)+'</b><small>'+escHtml(item.subject)+' · '+escHtml(item.last||"Tarih yok")+'</small></span><strong>'+item.total+' yanlış</strong></div>').join(""):'<div class="error-mini-empty">Tekrar eden konu görünmüyor.</div>';
  setErrorState("errorStudentDetail");
}
function safeRenderErrors(scope){
  try{
    hydrateErrorControls();
    renderErrorAnalysis(scope);
  }catch(error){
    console.error("Hata Defteri",error);
    if($("errorLoadErrorText"))$("errorLoadErrorText").textContent=String(error?.message||"Hata kayıtları görüntülenemedi.");
    setErrorState("errorLoadError");
  }
}
$("errorStudentSelect")?.addEventListener("change",event=>safeRenderErrors(event.currentTarget.value));
$("errorSubjectSelect")?.addEventListener("change",()=>safeRenderErrors($("errorStudentSelect")?.value||"all"));
$("errorRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user){setErrorState("errorLoading");void loadCoachReports(user.uid)}});
document.querySelector('[data-coach-page="errors"]')?.addEventListener("click",()=>{
  if(coachReportRows.length)safeRenderErrors($("errorStudentSelect")?.value||"all");
});


let coachMessageActions=[];
let coachMessageStop=null;
let coachMessageUid="";
let selectedMessageStudent="";
let messageStudentFilter="all";

function messageTimestamp(value){
  try{const d=value?.toDate?.()||new Date(value);if(!d||Number.isNaN(d.getTime()))return"—";return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d)}catch{return"—"}
}
function applyCoachMessageSnapshot(snap){
  coachMessageActions=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a?.createdAt?.toMillis?.()||0)-(b?.createdAt?.toMillis?.()||0));
  renderMessageStudents();
  if(selectedMessageStudent)renderMessageConversation(selectedMessageStudent);
}
async function loadCoachMessages(coachUid){
  if(!coachUid)return;
  if(coachMessageStop&&coachMessageUid===coachUid)return;
  if(coachMessageStop){try{coachMessageStop()}catch{}coachMessageStop=null}
  coachMessageUid=coachUid;
  const q=query(collection(db,"coachingMessages"),where("coachUid","==",coachUid));
  try{
    coachMessageStop=onSnapshot(q,applyCoachMessageSnapshot,error=>{
      console.error("Canlı mesajlar",error);
      coachMessageStop=null;coachMessageUid="";
    });
  }catch(error){
    console.error("Mesaj dinleyicisi",error);
    try{applyCoachMessageSnapshot(await getDocs(q))}catch(fetchError){console.error("Mesajlar",fetchError);coachMessageActions=[];renderMessageStudents()}
  }
}
function messageRows(){return coachReportRows.filter(row=>row?.link?.active===true)}
function messageActionsFor(studentUid){return coachMessageActions.filter(x=>x.studentUid===studentUid)}
function rowMatchesMessageFilter(row){
  if(messageStudentFilter==="all")return true;
  const actions=messageActionsFor(row.studentUid);
  if(messageStudentFilter==="student")return actions.some(x=>x.senderRole==="student");
  if(messageStudentFilter==="coach")return actions.some(x=>x.senderRole==="coach");
  return true;
}
function renderMessageStudents(){
  const rows=messageRows(),list=$("messageStudentList");
  if($("messageStudentCount"))$("messageStudentCount").textContent=String(rows.length);
  if(!list)return;
  if(!rows.length){
    list.innerHTML='<div class="message-side-empty"><b>Henüz bağlı öğrenci yok</b><span>Öğrenciler bağlandığında konuşmalar burada açılacak.</span></div>';
    $("messageNoStudent")?.classList.remove("hidden");$("messageConversation")?.classList.add("hidden");$("messageInfoEmpty")?.classList.remove("hidden");$("messageInfoPanel")?.classList.add("hidden");return;
  }
  list.innerHTML=rows.map(row=>{
    const name=studentName(row),actions=messageActionsFor(row.studentUid),last=actions.at(-1),incoming=actions.filter(x=>x.senderRole==="student").length;
    const hidden=rowMatchesMessageFilter(row)?"":" hidden";
    return '<button type="button" class="message-student-item '+(selectedMessageStudent===row.studentUid?"active":"")+hidden+'" data-message-student="'+escHtml(row.studentUid)+'" data-message-name="'+escHtml(name.toLocaleLowerCase("tr-TR"))+'"><span class="message-avatar">'+escHtml(reportInitial(name))+'</span><span class="message-student-copy"><b>'+escHtml(name)+'</b><small>'+escHtml(last?.text||"Henüz mesaj yok")+'</small></span><span class="message-student-meta"><small>'+escHtml(last?messageTimestamp(last.createdAt):"")+'</small><span class="message-mini-badges">'+(incoming?'<i class="applied">'+incoming+'</i>':'')+'</span></span></button>';
  }).join("");
  document.querySelectorAll("[data-message-student]").forEach(btn=>btn.addEventListener("click",()=>{selectedMessageStudent=btn.dataset.messageStudent;const input=$("messageInput");if(input)input.value="";if($("messageCharCount"))$("messageCharCount").textContent="0";renderMessageStudents();renderMessageConversation(selectedMessageStudent)}));
  if(!selectedMessageStudent&&rows.length){selectedMessageStudent=rows[0].studentUid;renderMessageStudents();renderMessageConversation(selectedMessageStudent)}
}
function renderMessageConversation(studentUid){
  const row=coachReportRows.find(x=>x.studentUid===studentUid);if(!row)return;
  const name=studentName(row),profile=row.share?.profile||{},progress=row.share?.progress||{},actions=messageActionsFor(studentUid);
  $("messageNoStudent")?.classList.add("hidden");$("messageConversation")?.classList.remove("hidden");$("messageInfoEmpty")?.classList.add("hidden");$("messageInfoPanel")?.classList.remove("hidden");
  $("messageChatAvatar").textContent=reportInitial(name);$("messageChatName").textContent=name;$("messageChatMeta").textContent=[profile.track,profile.targetDepartment].filter(Boolean).join(" · ")||"Bağlı öğrenci";
  $("messageInfoAvatar").textContent=reportInitial(name);$("messageInfoName").textContent=name;$("messageInfoTarget").textContent=[profile.track,profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ")||"YKS öğrencisi";
  $("messageStudyMinutes").textContent=reportMinutes(progress.minutes7);$("messageStudyQuestions").textContent=String(Math.round(reportNum(progress.questions7)));$("messageOverdueTopics").textContent=String(Math.round(reportNum(progress.overdueTopics)));
  $("messageSentCount").textContent=String(actions.filter(x=>x.senderRole==="coach").length);$("messageAppliedCount").textContent=String(actions.filter(x=>x.senderRole==="student").length);$("messagePendingCount").textContent=String(actions.length);$("messageFailedCount").textContent="0";
  const thread=$("messageThread");
  if(thread){
    thread.innerHTML=actions.length?actions.map(message=>'<div class="message-bubble-row '+(message.senderRole==="coach"?"outgoing":"incoming")+'"><div class="message-bubble"><p>'+escHtml(message.text||"")+'</p><div class="message-bubble-meta"><span>'+escHtml(messageTimestamp(message.createdAt))+'</span><strong>'+(message.senderRole==="coach"?"Sen":"Öğrenci")+'</strong></div></div></div>').join(""):'<div class="message-thread-empty"><span>✉</span><b>Henüz mesaj yok</b><p>İlk mesajı aşağıdan gönderebilirsin.</p></div>';
    requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight});
  }
}
async function sendCoachMessage(){
  const studentUid=selectedMessageStudent,input=$("messageInput"),button=$("messageSendBtn"),user=auth.currentUser,value=String(input?.value||"").trim().slice(0,500);
  if(!user||!studentUid||!value)return;
  const row=coachReportRows.find(x=>x.studentUid===studentUid);if(!row?.link?.active){alert("Bu öğrenciyle aktif koç bağlantısı bulunamadı.");return}
  if(button)button.disabled=true;
  try{
    await addDoc(collection(db,"coachingMessages"),{studentUid,coachUid:user.uid,senderUid:user.uid,senderRole:"coach",text:value,createdAt:serverTimestamp()});
    if(input)input.value="";if($("messageCharCount"))$("messageCharCount").textContent="0";
  }catch(error){console.error("Mesaj gönderilemedi",error);alert("Mesaj gönderilemedi: "+String(error?.message||"Bilinmeyen hata"))}finally{if(button)button.disabled=false}
}
$("messageComposeForm")?.addEventListener("submit",event=>{event.preventDefault();void sendCoachMessage()});
$("messageInput")?.addEventListener("input",event=>{if($("messageCharCount"))$("messageCharCount").textContent=String(event.currentTarget.value.length)});
$("messageInput")?.addEventListener("keydown",event=>{const prefs=readCoachUiPrefs();if(prefs.ctrlEnter!==false&&event.ctrlKey&&event.key==="Enter"){event.preventDefault();void sendCoachMessage()}});
$("messageRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user)void loadCoachMessages(user.uid)});
$("messageStudentSearch")?.addEventListener("input",event=>{const q=String(event.currentTarget.value||"").trim().toLocaleLowerCase("tr-TR");document.querySelectorAll("[data-message-name]").forEach(item=>{const searchMatch=!q||String(item.dataset.messageName||"").includes(q),row=coachReportRows.find(x=>x.studentUid===item.dataset.messageStudent);item.classList.toggle("hidden",!searchMatch||!rowMatchesMessageFilter(row||{}))})});
document.querySelectorAll("[data-message-filter]").forEach(button=>button.addEventListener("click",()=>{messageStudentFilter=button.dataset.messageFilter||"all";document.querySelectorAll("[data-message-filter]").forEach(x=>x.classList.toggle("active",x===button));renderMessageStudents();$("messageStudentSearch")?.dispatchEvent(new Event("input"))}));
document.querySelectorAll("[data-message-template]").forEach(button=>button.addEventListener("click",()=>{const input=$("messageInput");if(!input)return;input.value=button.dataset.messageTemplate||"";if($("messageCharCount"))$("messageCharCount").textContent=String(input.value.length);input.focus()}));
document.querySelector('[data-coach-page="messages"]')?.addEventListener("click",()=>{const user=auth.currentUser;if(user){renderMessageStudents();void loadCoachMessages(user.uid)}});

const COACH_UI_PREFS="yks_coach_ui_preferences_v2";
let currentCoachProfile=null;
let currentCoachUser=null;

function readCoachUiPrefs(){
  try{return JSON.parse(localStorage.getItem(COACH_UI_PREFS)||"{}")||{}}catch{return{}}
}
function writeCoachUiPrefs(next){
  try{localStorage.setItem(COACH_UI_PREFS,JSON.stringify(next))}catch{}
}
function applyCoachUiPrefs(){
  const prefs=readCoachUiPrefs();
  document.body.classList.toggle("coach-compact",prefs.compact===true);
  document.body.classList.toggle("coach-reduce-motion",prefs.reduceMotion===true);
  document.body.classList.toggle("coach-hide-quick-messages",prefs.quickMessages===false);
  if($("settingsCompactMode"))$("settingsCompactMode").checked=prefs.compact===true;
  if($("settingsReduceMotion"))$("settingsReduceMotion").checked=prefs.reduceMotion===true;
  document.querySelectorAll("[data-density]").forEach(button=>button.classList.toggle("active",(button.dataset.density==="compact")===Boolean(prefs.compact)));
  if($("appearanceDensityLabel"))$("appearanceDensityLabel").textContent=prefs.compact===true?"Kompakt":"Standart";
  if($("appearancePreviewTitle"))$("appearancePreviewTitle").textContent=prefs.compact===true?"Kompakt panel":"Standart panel";
  $("appearanceLivePreview")?.classList.toggle("compact",prefs.compact===true);
  if($("settingsCtrlEnter"))$("settingsCtrlEnter").checked=prefs.ctrlEnter!==false;
  if($("settingsQuickMessages"))$("settingsQuickMessages").checked=prefs.quickMessages!==false;
  if($("settingsDefaultPage"))$("settingsDefaultPage").value=prefs.defaultPage||"home";
}
function updateSettingsPill(textValue,state=""){
  const node=$("settingsSaveState");if(!node)return;
  const span=node.querySelector("span");if(span)span.textContent=textValue;
  node.classList.toggle("dirty",state==="dirty");
  node.classList.toggle("saved",state==="saved");
}
function settingsInitials(name){return initials(name||"Koç")}
function hydrateCoachSettings(profile,user){
  currentCoachProfile=profile;
  currentCoachUser=user;
  const name=String(profile?.displayName||user?.displayName||"Koç");
  const title=String(profile?.coachTitle||"YKS Koçu");
  const specialization=String(profile?.specialization||"");
  const avatar=settingsInitials(name);
  ["settingsMiniAvatar","settingsAvatarLarge","settingsAccountAvatar"].forEach(id=>{if($(id))$(id).textContent=avatar});
  if($("settingsMiniName"))$("settingsMiniName").textContent=name;
  if($("settingsMiniTitle"))$("settingsMiniTitle").textContent=title||"YKS Koçu";
  if($("settingsProfileNamePreview"))$("settingsProfileNamePreview").textContent=name;
  if($("settingsDisplayName"))$("settingsDisplayName").value=name;
  if($("settingsCoachTitle"))$("settingsCoachTitle").value=profile?.coachTitle||"";
  if($("settingsSpecialization"))$("settingsSpecialization").value=specialization;
  if($("settingsSpecializationCount"))$("settingsSpecializationCount").textContent=String(specialization.length);
  if($("settingsAccountName"))$("settingsAccountName").textContent=name;
  if($("settingsAccountEmail"))$("settingsAccountEmail").textContent=user?.email||"—";
  applyCoachUiPrefs();
  updateSettingsPill("Hazır");
}
function settingsDirty(){
  updateSettingsPill("Kaydedilmemiş değişiklik","dirty");
  if($("settingsProfileStatus"))$("settingsProfileStatus").textContent="Kaydedilmemiş değişiklik";
}
document.querySelectorAll("[data-settings-tab]").forEach(button=>button.addEventListener("click",()=>{
  const tab=button.dataset.settingsTab;
  document.querySelectorAll("[data-settings-tab]").forEach(x=>x.classList.toggle("active",x===button));
  document.querySelectorAll("[data-settings-panel]").forEach(panel=>panel.classList.toggle("hidden",panel.dataset.settingsPanel!==tab));
}));
["settingsDisplayName","settingsCoachTitle","settingsSpecialization"].forEach(id=>$(id)?.addEventListener("input",()=>{
  settingsDirty();
  if(id==="settingsDisplayName"&&$("settingsProfileNamePreview"))$("settingsProfileNamePreview").textContent=$("settingsDisplayName").value.trim()||"Koç";
  if(id==="settingsSpecialization"&&$("settingsSpecializationCount"))$("settingsSpecializationCount").textContent=String($("settingsSpecialization").value.length);
}));
$("coachSettingsForm")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const user=auth.currentUser,button=$("settingsSaveProfile"),status=$("settingsProfileStatus");
  if(!user)return;
  const displayName=String($("settingsDisplayName")?.value||"").trim().slice(0,80);
  const coachTitle=String($("settingsCoachTitle")?.value||"").trim().slice(0,100);
  const specialization=String($("settingsSpecialization")?.value||"").trim().slice(0,160);
  if(!displayName){if(status)status.textContent="Ad soyad boş bırakılamaz.";return}
  if(button)button.disabled=true;
  if(status)status.textContent="Kaydediliyor…";
  updateSettingsPill("Kaydediliyor…");
  try{
    await updateDoc(doc(db,COLLECTIONS.profiles,user.uid),{displayName,coachTitle,specialization,updatedAt:serverTimestamp()});
    currentCoachProfile={...(currentCoachProfile||{}),displayName,coachTitle,specialization};
    if($("coachSidebarName"))$("coachSidebarName").textContent=displayName;
    if($("coachSidebarAvatar"))$("coachSidebarAvatar").textContent=initials(displayName);
    if($("dashboardCoachName"))$("dashboardCoachName").textContent=displayName.split(/\s+/)[0]||"Koç";
    if($("settingsMiniName"))$("settingsMiniName").textContent=displayName;
    if($("settingsMiniTitle"))$("settingsMiniTitle").textContent=coachTitle||"YKS Koçu";
    ["settingsMiniAvatar","settingsAvatarLarge","settingsAccountAvatar"].forEach(id=>{if($(id))$(id).textContent=settingsInitials(displayName)});
    if($("settingsAccountName"))$("settingsAccountName").textContent=displayName;
    if(status)status.textContent="Profil kaydedildi ✓";
    updateSettingsPill("Kaydedildi","saved");
  }catch(error){
    console.error("Ayarlar kaydedilemedi",error);
    if(status)status.textContent="Kaydedilemedi: "+String(error?.message||"Bilinmeyen hata");
    updateSettingsPill("Kaydedilemedi","dirty");
  }finally{if(button)button.disabled=false}
});
function saveLocalPreference(key,value){
  const prefs=readCoachUiPrefs();prefs[key]=value;writeCoachUiPrefs(prefs);applyCoachUiPrefs();updateSettingsPill("Tercih kaydedildi","saved");
}
$("settingsDefaultPage")?.addEventListener("change",event=>saveLocalPreference("defaultPage",event.currentTarget.value));
$("settingsCompactMode")?.addEventListener("change",event=>saveLocalPreference("compact",event.currentTarget.checked));
document.querySelectorAll("[data-density]").forEach(button=>button.addEventListener("click",()=>saveLocalPreference("compact",button.dataset.density==="compact")));
$("settingsReduceMotion")?.addEventListener("change",event=>saveLocalPreference("reduceMotion",event.currentTarget.checked));
$("settingsCtrlEnter")?.addEventListener("change",event=>saveLocalPreference("ctrlEnter",event.currentTarget.checked));
$("settingsQuickMessages")?.addEventListener("change",event=>saveLocalPreference("quickMessages",event.currentTarget.checked));
$("settingsSignOutBtn")?.addEventListener("click",()=>signOut(auth));
applyCoachUiPrefs();


let pendingStudentConnection=null;
const STUDENT_CODE_RE=/^[A-Z2-9]{12}$/;
function normalizeStudentCoachCode(value){
  return String(value||"").toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,12);
}
function formatStudentCoachCode(value){
  return normalizeStudentCoachCode(value).replace(/(.{4})(?=.)/g,"$1-");
}
function studentUpdatedDate(row){
  try{
    const value=row?.share?.updatedAt;
    const d=value?.toDate?.()||new Date(value);
    return d&&!Number.isNaN(d.getTime())?d:null;
  }catch{return null}
}
function studentActiveToday(row){
  const d=studentUpdatedDate(row);if(!d)return false;
  const now=new Date();
  return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
}
function studentNeedsAttention(row){return reportNum(row?.share?.progress?.overdueTopics)>0}
function studentLastActivity(row){
  const d=studentUpdatedDate(row);if(!d)return"Veri bekleniyor";
  const now=new Date(),diff=Math.max(0,now-d);
  if(diff<60000)return"Az önce";
  if(diff<3600000)return Math.floor(diff/60000)+" dk önce";
  if(diff<86400000)return Math.floor(diff/3600000)+" sa önce";
  return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short"}).format(d);
}
function renderStudentsPage(){
  const total=$("studentsTotal"),active=$("studentsActive"),attention=$("studentsAttention"),list=$("studentsList"),empty=$("studentsEmpty");
  if(total)total.textContent=String(coachReportRows.length);
  if(active)active.textContent=String(coachReportRows.filter(studentActiveToday).length);
  if(attention)attention.textContent=String(coachReportRows.filter(studentNeedsAttention).length);
  if(!list||!empty)return;
  if(!coachReportRows.length){
    empty.classList.remove("hidden");list.classList.add("hidden");list.innerHTML="";return;
  }
  empty.classList.add("hidden");list.classList.remove("hidden");
  const search=String($("studentSearch")?.value||"").trim().toLocaleLowerCase("tr-TR");
  const rows=coachReportRows.filter(row=>{
    const name=studentName(row).toLocaleLowerCase("tr-TR");
    if(search&&!name.includes(search))return false;
    if(studentListFilter==="active"&&!studentActiveToday(row))return false;
    if(studentListFilter==="attention"&&!studentNeedsAttention(row))return false;
    return true;
  });
  list.innerHTML=rows.length?rows.map(row=>{
    const name=studentName(row),program=weekStats(row.share?.program),overdue=Math.round(reportNum(row?.share?.progress?.overdueTopics));
    const today=studentActiveToday(row);
    const statusClass=overdue?"attention":today?"active":"idle";
    const statusText=overdue?overdue+" geciken konu":today?"Bugün aktif":"Aktivite bekleniyor";
    return '<div class="student-row" data-student-row="'+escHtml(row.studentUid)+'"><span class="student-cell-main"><i>'+escHtml(reportInitial(name))+'</i><span><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS öğrencisi")+'</small></span></span><span class="student-status '+statusClass+'"><i></i>'+escHtml(statusText)+'</span><span class="student-program"><b>'+(program.plannedDays?program.ratio+"%":"—")+'</b><small>'+(program.plannedDays?program.doneDays+" / "+program.plannedDays+" gün":"Program verisi yok")+'</small></span><span class="student-last">'+escHtml(studentLastActivity(row))+'</span><span class="student-actions"><button type="button" class="student-open" data-open-student="'+escHtml(row.studentUid)+'">İncele</button><button type="button" class="student-remove" data-remove-student="'+escHtml(row.studentUid)+'" aria-label="'+escHtml(name)+' öğrencisini panelden sil">Sil</button></span></div>';
  }).join(""):'<div class="students-filter-empty">Bu filtrede öğrenci bulunamadı.</div>';
  document.querySelectorAll("[data-open-student]").forEach(button=>button.addEventListener("click",()=>{
    const uid=button.dataset.openStudent;
    showCoachPage("reports");
    if($("reportStudentSelect"))$("reportStudentSelect").value=uid;
    renderReport(uid);
  }));
  document.querySelectorAll("[data-remove-student]").forEach(button=>button.addEventListener("click",()=>void removeCoachStudent(button.dataset.removeStudent,button)));
}
async function removeCoachStudent(studentUid,button){
  const row=coachReportRows.find(item=>item.studentUid===studentUid),user=auth.currentUser;if(!row||!user)return;
  const name=studentName(row),linkId=String(row.link?.id||"");
  if(!linkId||row.link?.coachUid!==user.uid){alert("Bu öğrenci bağlantısı doğrulanamadı.");return}
  const approved=confirm(name+" öğrencisini koç panelinden silmek istediğine emin misin?\n\nÖğrencinin YKS Defterim hesabı ve verileri silinmez; sadece koç bağlantısı kaldırılır.");
  if(!approved)return;
  const previous=button?.textContent;if(button){button.disabled=true;button.textContent="Siliniyor…"}
  try{
    await updateDoc(doc(db,"coachingLinks",linkId),{active:false,endedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    if(selectedProgramStudentUid===studentUid){selectedProgramStudentUid="";selectedProgramWeekStart=""}
    if(selectedMessageStudent===studentUid)selectedMessageStudent="";
    await loadCoachReports(user.uid);
  }catch(error){
    console.error("Öğrenci silme",error);
    alert("Öğrenci panelden kaldırılamadı: "+String(error?.message||"Bilinmeyen hata"));
    if(button){button.disabled=false;button.textContent=previous||"Sil"}
  }
}
$("studentSearch")?.addEventListener("input",renderStudentsPage);

function openStudentConnect(){
  pendingStudentConnection=null;
  const backdrop=$("studentConnectBackdrop"),input=$("studentCoachCodeInput");
  backdrop?.classList.remove("hidden");backdrop?.setAttribute("aria-hidden","false");
  if(input){input.value="";setTimeout(()=>input.focus(),0)}
  $("studentConnectPreview")?.classList.add("hidden");
  $("studentCodeStatus")?.classList.add("hidden");
  if($("studentConnectConfirm"))$("studentConnectConfirm").disabled=true;
  if($("studentCodeHint"))$("studentCodeHint").textContent="Kod 12 karakterdir. Tireleri yazmak zorunda değilsin.";
}
function closeStudentConnect(){
  $("studentConnectBackdrop")?.classList.add("hidden");
  $("studentConnectBackdrop")?.setAttribute("aria-hidden","true");
  pendingStudentConnection=null;
}
function setStudentCodeStatus(message,type=""){
  const node=$("studentCodeStatus");if(!node)return;
  node.textContent=message;node.className="student-code-status "+type;
  node.classList.toggle("hidden",!message);
}
async function verifyStudentCoachCode(){
  const input=$("studentCoachCodeInput"),button=$("studentCodeCheckBtn"),confirm=$("studentConnectConfirm");
  const code=normalizeStudentCoachCode(input?.value);
  if(input)input.value=formatStudentCoachCode(code);
  pendingStudentConnection=null;
  $("studentConnectPreview")?.classList.add("hidden");
  if(confirm)confirm.disabled=true;
  if(!STUDENT_CODE_RE.test(code)){setStudentCodeStatus("Kod 12 karakter olmalı.","error");return}
  if(button)button.disabled=true;
  setStudentCodeStatus("Kod doğrulanıyor…","loading");
  try{
    const codeSnap=await getDoc(doc(db,"studentCoachCodes",code));
    if(!codeSnap.exists()){setStudentCodeStatus("Bu kodla eşleşen öğrenci bulunamadı. Kodu kontrol et.","error");return}
    const codeData=codeSnap.data();
    if(codeData.active!==true||!codeData.studentUid){setStudentCodeStatus("Bu koç kodu artık aktif değil. Öğrenciden yeni kod iste.","error");return}
    const profileSnap=await getDoc(doc(db,"accountProfiles",codeData.studentUid));
    if(!profileSnap.exists()||profileSnap.data()?.role!=="student"){setStudentCodeStatus("Kod geçerli bir öğrenci hesabına ait değil.","error");return}
    const profile=profileSnap.data();
    const existing=coachReportRows.find(row=>row.studentUid===codeData.studentUid);
    if(existing){
      setStudentCodeStatus(studentName(existing)+" zaten öğrencilerin arasında.","success");
      return;
    }
    pendingStudentConnection={code,studentUid:codeData.studentUid,profile};
    if($("studentPreviewAvatar"))$("studentPreviewAvatar").textContent=reportInitial(profile.displayName||"Öğrenci");
    if($("studentPreviewName"))$("studentPreviewName").textContent=profile.displayName||"Öğrenci";
    if($("studentPreviewMeta"))$("studentPreviewMeta").textContent=[profile.coachTitle,profile.specialization].filter(Boolean).join(" · ")||"YKS öğrencisi";
    $("studentConnectPreview")?.classList.remove("hidden");
    setStudentCodeStatus("Kod doğrulandı. Bağlantıyı kurabilirsin.","success");
    if(confirm)confirm.disabled=false;
  }catch(error){
    console.error("Öğrenci kodu doğrulama",error);
    setStudentCodeStatus("Kod doğrulanamadı: "+String(error?.message||"Bilinmeyen hata"),"error");
  }finally{if(button)button.disabled=false}
}
async function connectStudentByCode(){
  const candidate=pendingStudentConnection,user=auth.currentUser,button=$("studentConnectConfirm");
  if(!candidate||!user)return;
  if(button)button.disabled=true;
  setStudentCodeStatus("Öğrenci bağlanıyor…","loading");
  try{
    const linksSnap=await getDocs(query(collection(db,"coachingLinks"),where("coachUid","==",user.uid)));
    const existing=linksSnap.docs.map(d=>({id:d.id,...d.data()})).find(link=>link.studentUid===candidate.studentUid);
    if(existing?.active===true){
      setStudentCodeStatus("Bu öğrenci zaten bağlı.","success");
    }else if(existing){
      await updateDoc(doc(db,"coachingLinks",existing.id),{active:true,accessCode:candidate.code,updatedAt:serverTimestamp()});
    }else{
      const linkId=candidate.studentUid+"_"+user.uid;
      await setDoc(doc(db,"coachingLinks",linkId),{
        studentUid:candidate.studentUid,
        coachUid:user.uid,
        accessCode:candidate.code,
        active:true,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
    }
    setStudentCodeStatus((candidate.profile?.displayName||"Öğrenci")+" başarıyla eklendi ✓","success");
    await loadCoachReports(user.uid);
    setTimeout(closeStudentConnect,650);
  }catch(error){
    console.error("Öğrenci bağlantısı",error);
    setStudentCodeStatus("Öğrenci eklenemedi: "+String(error?.message||"Bilinmeyen hata"),"error");
    if(button)button.disabled=false;
  }
}
$("addStudentBtn")?.addEventListener("click",openStudentConnect);
document.querySelector("[data-add-student]")?.addEventListener("click",openStudentConnect);
$("studentConnectClose")?.addEventListener("click",closeStudentConnect);
$("studentConnectCancel")?.addEventListener("click",closeStudentConnect);
$("studentConnectBackdrop")?.addEventListener("click",event=>{if(event.target===event.currentTarget)closeStudentConnect()});
$("studentCoachCodeInput")?.addEventListener("input",event=>{
  const raw=normalizeStudentCoachCode(event.currentTarget.value);
  event.currentTarget.value=formatStudentCoachCode(raw);
  pendingStudentConnection=null;
  $("studentConnectPreview")?.classList.add("hidden");
  if($("studentConnectConfirm"))$("studentConnectConfirm").disabled=true;
  setStudentCodeStatus("");
});
$("studentCoachCodeInput")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void verifyStudentCoachCode()}});
$("studentCodeCheckBtn")?.addEventListener("click",()=>void verifyStudentCoachCode());
$("studentConnectConfirm")?.addEventListener("click",()=>void connectStudentByCode());
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("studentConnectBackdrop")?.classList.contains("hidden"))closeStudentConnect()});


let selectedProgramStudentUid="";
let selectedProgramWeekStart="";
function shiftProgramWeek(start,amount){
  const base=/^\d{4}-\d{2}-\d{2}$/.test(String(start||""))?new Date(start+"T12:00:00"):new Date(programCurrentWeekStart()+"T12:00:00");
  base.setDate(base.getDate()+amount*7);return base.toISOString().slice(0,10);
}
function activeProgramWeek(row){
  const weeks=programWeeks(row);
  if(!selectedProgramWeekStart)selectedProgramWeekStart=weeks.at(-1)?.week||programCurrentWeekStart();
  return weeks.find(item=>item?.week===selectedProgramWeekStart)||{week:selectedProgramWeekStart,data:{}};
}

function programWeeks(row){
  const weeks=Array.isArray(row?.share?.program?.weeks)?row.share.program.weeks:[];
  return [...weeks].sort((a,b)=>String(a?.week||"").localeCompare(String(b?.week||"")));
}
function programTargetText(row){
  const p=row?.share?.profile||{},parts=[];
  if(p.targetUniversity)parts.push(String(p.targetUniversity));
  if(p.targetDepartment)parts.push(String(p.targetDepartment));
  if(parts.length)return parts.join(" · ");
  const nets=[];
  if(Number(p.targetNetTYT)>0)nets.push("TYT "+Math.round(Number(p.targetNetTYT))+" net");
  if(Number(p.targetNetAYT)>0)nets.push("AYT "+Math.round(Number(p.targetNetAYT))+" net");
  return nets.length?nets.join(" · "):String(p.track||"YKS öğrencisi");
}
function programSubjectTone(task){
  const value=(String(task?.label||"")+" "+String(task?.text||"")).toLocaleLowerCase("tr-TR");
  if(/matematik|problem|geometri/.test(value))return"math";
  if(/fizik/.test(value))return"physics";
  if(/kimya/.test(value))return"chemistry";
  if(/biyoloji/.test(value))return"biology";
  if(/türkçe|paragraf|dil bilgisi/.test(value))return"turkish";
  if(/edebiyat/.test(value))return"literature";
  if(/tarih/.test(value))return"history";
  if(/coğrafya/.test(value))return"geography";
  return"general";
}
function programCurrentWeekStart(){
  const d=new Date(),day=(d.getDay()+6)%7;
  d.setHours(12,0,0,0);d.setDate(d.getDate()-day);
  return d.toISOString().slice(0,10);
}
function formatProgramWeek(start){
  if(!start)return"Program yok";
  try{
    const d=new Date(start+"T12:00:00");
    const end=new Date(d);end.setDate(end.getDate()+6);
    const f=x=>new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short"}).format(x);
    return f(d)+" – "+f(end);
  }catch{return start}
}
function programDayDate(weekStart,day){
  if(!weekStart)return"";
  const d=new Date(weekStart+"T12:00:00");d.setDate(d.getDate()+day);return d.toISOString().slice(0,10);
}
function programDayLabel(weekStart,day){
  const names=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  if(!weekStart)return names[day];
  const d=new Date(programDayDate(weekStart,day)+"T12:00:00");
  return names[day]+" · "+new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short"}).format(d);
}
function collectProgramDayTasks(program,week,day){
  const data=week?.data||{},out=[];
  const groups=[["r",programRowList(data.r)],["s",programRowList(data.s)]];
  groups.forEach(([key,rows])=>{
    rows.forEach((row,index)=>{
      const value=String(row?.[day]||"").trim();if(!value)return;
      const label=String(program?.rowLabels?.[key]?.[index]||"").trim();
      out.push({id:key+"-"+index+"-"+day,text:value,label});
    });
  });
  const order=Array.isArray(data?.mv?.["order-"+day])?data.mv["order-"+day]:[],rank=new Map(order.map((id,index)=>[String(id),index]));
  out.sort((a,b)=>(rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER));
  return out;
}
function coachProgramOrderIds(container){
  return Array.from(container.querySelectorAll("[data-program-task-id]")).map(node=>node.dataset.programTaskId||"").filter(Boolean);
}
async function saveCoachProgramOrder(weekStart,day,ids){
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid),user=auth.currentUser;if(!row||!user||!ids.length)return false;
  const week=programWeeks(row).find(item=>item.week===weekStart);if(!week)return false;
  week.data??={};week.data.mv??={};const key="order-"+day,had=Object.prototype.hasOwnProperty.call(week.data.mv,key),previous=week.data.mv[key];
  week.data.mv[key]=ids.slice();renderProgramWorkspace();
  try{
    await addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{operation:"order",date:programDayDate(weekStart,day),order:ids.slice()},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    return true;
  }catch(error){
    console.error("Program sırası",error);if(had)week.data.mv[key]=previous;else delete week.data.mv[key];renderProgramWorkspace();return false;
  }
}
async function saveCoachProgramMove(weekStart,taskId,targetDay){
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid),user=auth.currentUser;if(!row||!user)return false;
  const week=programWeeks(row).find(item=>item.week===weekStart),data=week?.data;if(!week||!data)return false;
  const parts=String(taskId).split("-"),blk=parts[0],sourceRow=Number(parts[1]),sourceDay=Number(parts[2]),rows=programRowList(data[blk]);
  if(!["r","s"].includes(blk)||!Number.isInteger(sourceRow)||!Number.isInteger(sourceDay)||!Number.isInteger(targetDay)||targetDay<0||targetDay>6||sourceDay===targetDay)return false;
  const taskText=String(rows[sourceRow]?.[sourceDay]||"").trim();if(!taskText)return false;
  let targetRow=sourceRow;
  if(String(rows[targetRow]?.[targetDay]||"").trim())targetRow=rows.findIndex(item=>!String(item?.[targetDay]||"").trim());
  if(targetRow<0){alert("Hedef günde boş çalışma satırı yok.");return false}
  const backup=JSON.parse(JSON.stringify(data)),targetId=blk+"-"+targetRow+"-"+targetDay;
  rows[targetRow][targetDay]=taskText;rows[sourceRow][sourceDay]="";data[blk]=rows;
  data.dn??={};delete data.dn[taskId];delete data.dn[targetId];
  data.mv??={};delete data.mv[taskId];data.mv[targetId]={from:programDayDate(weekStart,sourceDay),at:Date.now()};
  const sourceKey="order-"+sourceDay,targetKey="order-"+targetDay;
  if(Array.isArray(data.mv[sourceKey])){data.mv[sourceKey]=data.mv[sourceKey].filter(id=>id!==taskId);if(!data.mv[sourceKey].length)delete data.mv[sourceKey]}
  const targetOrder=Array.isArray(data.mv[targetKey])?data.mv[targetKey].filter(id=>id!==targetId):collectProgramDayTasks(row.share?.program,week,targetDay).map(task=>task.id).filter(id=>id!==targetId);
  targetOrder.push(targetId);data.mv[targetKey]=targetOrder;
  renderProgramWorkspace();
  try{
    await addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{operation:"move",sourceWeek:weekStart,taskId,date:programDayDate(weekStart,targetDay)},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    return true;
  }catch(error){
    console.error("Program günü taşıma",error);week.data=backup;renderProgramWorkspace();alert("Görev başka güne taşınamadı.");return false;
  }
}
let coachMoveMenu=null,coachProgramEditContext=null;
function closeCoachMoveMenu(){coachMoveMenu?.remove();coachMoveMenu=null;document.querySelectorAll(".program-task-card[data-selected]").forEach(card=>card.removeAttribute("data-selected"))}
function openCoachMoveMenu(weekStart,taskId,sourceDay,anchor){
  closeCoachMoveMenu();anchor?.closest(".program-task-card")?.setAttribute("data-selected","");
  const menu=document.createElement("div");menu.className="program-move-menu";menu.setAttribute("role","dialog");menu.setAttribute("aria-label","Görevi başka güne taşı");
  const title=document.createElement("b");title.textContent="Hangi güne taşınsın?";menu.append(title);
  const days=document.createElement("div");days.className="program-move-days";
  ["Pzt","Sal","Çar","Per","Cum","Cts","Paz"].forEach((label,day)=>{
    const button=document.createElement("button");button.type="button";button.textContent=label;button.disabled=day===sourceDay;
    button.addEventListener("click",async()=>{button.disabled=true;const ok=await saveCoachProgramMove(weekStart,taskId,day);closeCoachMoveMenu();if(!ok)renderProgramWorkspace()});
    days.append(button);
  });
  const cancel=document.createElement("button");cancel.type="button";cancel.className="program-move-cancel";cancel.textContent="Vazgeç";cancel.addEventListener("click",closeCoachMoveMenu);
  menu.append(days,cancel);document.body.append(menu);coachMoveMenu=menu;
  const rect=anchor.getBoundingClientRect(),menuRect=menu.getBoundingClientRect(),left=Math.max(10,Math.min(window.innerWidth-menuRect.width-10,rect.left)),top=Math.min(window.innerHeight-menuRect.height-10,rect.bottom+8);
  menu.style.left=left+"px";menu.style.top=Math.max(10,top)+"px";
}
function coachTaskCell(weekStart,taskId){
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid),week=programWeeks(row).find(item=>item.week===weekStart);if(!row||!week)return null;
  const parts=String(taskId).split("-"),blk=parts[0],ri=Number(parts[1]),day=Number(parts[2]),rows=programRowList(week.data?.[blk]),value=String(rows[ri]?.[day]||"").trim();
  if(!value)return null;return{row,week,blk,ri,day,rows,value};
}
function removeCoachProgramTaskLocal(cell,taskId){
  if(!cell)return false;
  cell.rows[cell.ri][cell.day]="";cell.week.data[cell.blk]=cell.rows;
  if(cell.week.data.dn)delete cell.week.data.dn[taskId];
  if(cell.week.data.mv){
    delete cell.week.data.mv[taskId];
    const orderKey="order-"+cell.day;
    if(Array.isArray(cell.week.data.mv[orderKey])){
      cell.week.data.mv[orderKey]=cell.week.data.mv[orderKey].filter(id=>id!==taskId);
      if(!cell.week.data.mv[orderKey].length)delete cell.week.data.mv[orderKey];
    }
  }
  return true;
}
function openCoachProgramEdit(weekStart,taskId){
  const cell=coachTaskCell(weekStart,taskId);if(!cell)return;
  closeCoachMoveMenu();coachProgramEditContext={weekStart,taskId,day:cell.day,prefix:""};
  openProgramTaskModal(cell.value,{edit:true,weekStart,day:cell.day});
  if($("programTaskTitle"))$("programTaskTitle").textContent="Çalışmayı düzenle";
  updateCoachProgramBuilder();
}
function bindCoachProgramCardActions(weekStart){
  document.querySelectorAll("#programWeekBoard [data-program-select]").forEach(button=>button.addEventListener("click",event=>{
    event.stopPropagation();const card=button.closest("[data-program-task-id]");if(!card)return;openCoachMoveMenu(weekStart,card.dataset.programTaskId||"",Number(card.dataset.programTaskDay),button);
  }));
  document.querySelectorAll("#programWeekBoard [data-program-edit]").forEach(button=>button.addEventListener("click",event=>{
    event.stopPropagation();const card=button.closest("[data-program-task-id]");if(card)openCoachProgramEdit(weekStart,card.dataset.programTaskId||"");
  }));
}

function hydrateProgramStudents(){
  const select=$("programStudentSelect");
  if(!select)return;
  if(!coachReportRows.length){
    select.innerHTML='<option value="">Bağlı öğrenci yok</option>';
    select.value="";select.disabled=true;
    selectedProgramStudentUid="";selectedProgramWeekStart="";return;
  }
  select.disabled=false;
  if(!selectedProgramStudentUid||!coachReportRows.some(x=>x.studentUid===selectedProgramStudentUid))selectedProgramStudentUid=coachReportRows[0].studentUid;
  select.innerHTML=coachReportRows.map(row=>{
    const name=studentName(row),stats=weekStats(row.share?.program);
    const suffix=stats.total?" · "+stats.ratio+"% uyum":"";
    return '<option value="'+escHtml(row.studentUid)+'">'+escHtml(name+suffix)+'</option>';
  }).join("");
  select.value=selectedProgramStudentUid;
}
function renderProgramWorkspace(){
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid);
  const board=$("programWeekBoard"),empty=$("programMainEmpty");
  if(!row){
    if($("programWorkspaceTitle"))$("programWorkspaceTitle").textContent="Bir öğrenci seç";
    if($("programWorkspaceMeta"))$("programWorkspaceMeta").textContent="Öğrencinin programı burada açılacak.";
    if(board)board.innerHTML="";
    empty?.classList.remove("hidden");
    ["programTaskCount","programDoneDays","programPendingTasks","programStudyTime","programProgress"].forEach(id=>{if($(id))$(id).textContent="—"});
    if($("programWeekLabel"))$("programWeekLabel").textContent="—";
    if($("programHeroAvatar"))$("programHeroAvatar").textContent="Ö";
    if($("programHeroName"))$("programHeroName").textContent="Öğrenci seçilmedi";
    if($("programHeroStatus"))$("programHeroStatus").textContent="Veri bekleniyor";
    if($("programHeroTarget"))$("programHeroTarget").textContent="Hedef bilgisi öğrenciden geldiğinde burada görünecek.";
    if($("programHeroSync"))$("programHeroSync").textContent="Son senkron: —";
    if($("programHeroWeeks"))$("programHeroWeeks").textContent="0 hafta";
    if($("programHeroProgress"))$("programHeroProgress").textContent="—";
    if($("programHeroProgressBar"))$("programHeroProgressBar").style.width="0%";
    return;
  }
  const program=row.share?.program||{},weeks=programWeeks(row),name=studentName(row);
  if($("programWorkspaceTitle"))$("programWorkspaceTitle").textContent=name;
  if($("programWorkspaceMeta"))$("programWorkspaceMeta").textContent=weeks.length?weeks.length+" kayıtlı hafta · boş haftalara da geçebilirsin":"Henüz kayıtlı hafta yok · istediğin tarihe gidip çalışma ekleyebilirsin";
  if($("programStudyTime"))$("programStudyTime").textContent=reportMinutes(row.share?.progress?.minutes7);
  if($("programHeroAvatar"))$("programHeroAvatar").textContent=reportInitial(name);
  if($("programHeroName"))$("programHeroName").textContent=name;
  if($("programHeroTarget"))$("programHeroTarget").textContent=programTargetText(row);
  if($("programHeroSync"))$("programHeroSync").textContent="Son senkron: "+reportTimestamp(row.share?.updatedAt);
  if($("programHeroWeeks"))$("programHeroWeeks").textContent=weeks.length+" hafta";
  if($("programHeroStatus"))$("programHeroStatus").textContent=weeks.some(item=>item.week===selectedProgramWeekStart)?"Program güncel":"Bu hafta boş";
  selectedProgramWeekStart=selectedProgramWeekStart||weeks.at(-1)?.week||programCurrentWeekStart();
  const week=activeProgramWeek(row),data=week.data||{};
  const tasks=Array.from({length:7},(_,day)=>collectProgramDayTasks(program,week,day));
  const taskCount=tasks.reduce((s,x)=>s+x.length,0);
  const plannedDays=tasks.filter(x=>x.length).length;
  const completedByDay=tasks.map((dayTasks,day)=>dayTasks.filter(task=>programTaskDone(data,task,day)).length);
  const doneDays=tasks.reduce((sum,dayTasks,day)=>sum+(dayTasks.length&&completedByDay[day]===dayTasks.length?1:0),0);
  const completedTaskCount=completedByDay.reduce((sum,count)=>sum+count,0);
  const ratio=taskCount?Math.round(completedTaskCount/taskCount*100):0;
  if($("programWeekLabel"))$("programWeekLabel").textContent=formatProgramWeek(week.week);
  const storedWeek=weeks.some(item=>item.week===week.week);
  if($("programDoneMeta"))$("programDoneMeta").textContent=storedWeek?plannedDays+" planlı gün":"Bu hafta henüz boş";
  if($("programTaskCount"))$("programTaskCount").textContent=String(taskCount);
  if($("programDoneDays"))$("programDoneDays").textContent=String(doneDays);

  const pendingTaskCount=Math.max(0,taskCount-completedTaskCount);
  if($("programProgress"))$("programProgress").textContent=ratio+"%";
  if($("programPendingTasks"))$("programPendingTasks").textContent=String(pendingTaskCount);
  if($("programHeroProgress"))$("programHeroProgress").textContent=ratio+"%";
  if($("programHeroProgressBar"))$("programHeroProgressBar").style.width=Math.max(0,Math.min(100,ratio))+"%";
  if($("programPrevWeek"))$("programPrevWeek").disabled=false;
  if($("programNextWeek"))$("programNextWeek").disabled=false;
  empty?.classList.add("hidden");
  if(board)board.innerHTML=tasks.map((dayTasks,day)=>{
    const doneCount=completedByDay[day],completed=dayTasks.length>0&&doneCount===dayTasks.length,isToday=programDayDate(week.week,day)===todayIsoLocal();
    const partial=doneCount>0&&!completed;
    const stateBadge=completed?'<span class="day-state done">✓ Tamamlandı</span>':partial?'<span class="day-state partial">✓ '+doneCount+'/'+dayTasks.length+'</span>':isToday?'<span class="day-state today">Bugün</span>':'';
    return '<section class="day-column '+(completed?"done ":"")+(partial?"partial ":"")+(isToday?"today":"")+'"><header><div><b>'+escHtml(programDayLabel(week.week,day))+'</b><small>'+dayTasks.length+' görev · '+doneCount+' tamamlandı</small></div>'+stateBadge+'</header><div class="day-tasks" data-program-drop-day="'+day+'">'+(dayTasks.length?dayTasks.map(task=>{
      const tone=programSubjectTone(task),coachTask=/^Koç ·/.test(task.text),taskDone=programTaskDone(data,task,day);
      const cleanText=task.text.replace(/^Koç ·(?: Deneme sonrası · )?/,"");
      const statusBadges=(coachTask?'<em>Koç görevi</em>':'')+(taskDone?'<span class="task-complete-badge">✓ Tamamlandı</span>':'');
      return '<article class="program-task-card tone-'+tone+(taskDone?' completed':'')+'" data-program-task-id="'+escHtml(task.id)+'" data-program-task-day="'+day+'" data-task-completed="'+(taskDone?'true':'false')+'"><button type="button" class="program-select-task" data-program-select aria-label="Görevi başka güne taşımak için seç">○</button><button type="button" class="program-edit-task" data-program-edit aria-label="Görevi düzenle">✎</button><span class="task-accent"></span><div><div class="task-meta-row">'+(task.label?'<small class="task-label">'+escHtml(task.label)+'</small>':'<small class="task-label">Program görevi</small>')+(statusBadges?'<span class="task-meta-badges">'+statusBadges+'</span>':'')+'</div><b>'+escHtml(cleanText)+'</b></div></article>';
    }).join(""):'<div class="day-empty"><i>＋</i><span>Bu gün için görev yok</span></div>')+'</div></section>';
  }).join("");
  bindCoachProgramCardActions(week.week);
}
$("programStudentSelect")?.addEventListener("change",event=>{
  selectedProgramStudentUid=event.target.value||"";
  selectedProgramWeekStart="";
  hydrateProgramStudents();
  renderProgramWorkspace();
});
$("programPrevWeek")?.addEventListener("click",()=>{
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid);if(!row)return;
  selectedProgramWeekStart=shiftProgramWeek(activeProgramWeek(row).week,-1);renderProgramWorkspace();
});
$("programNextWeek")?.addEventListener("click",()=>{
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid);if(!row)return;
  selectedProgramWeekStart=shiftProgramWeek(activeProgramWeek(row).week,1);renderProgramWorkspace();
});
$("programCurrentWeek")?.addEventListener("click",()=>{selectedProgramWeekStart=programCurrentWeekStart();renderProgramWorkspace()});
document.querySelector('[data-coach-page="programs"]')?.addEventListener("click",async()=>{
  hydrateProgramStudents();renderProgramWorkspace();
  const user=auth.currentUser;if(!user)return;
  try{
    await loadCoachReports(user.uid);
    hydrateProgramStudents();renderProgramWorkspace();
  }catch(error){console.error("Programlar güncel veri yenileme",error)}
});

function todayIsoLocal(){
  const d=new Date(),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
const COACH_PROGRAM_SUBJECTS=[
  ["TYT · Türkçe",["Paragraf","Sözcükte Anlam","Cümlede Anlam","Dil Bilgisi","Yazım Kuralları","Noktalama"]],
  ["TYT · Matematik",["Temel Kavramlar","Sayı Basamakları","Problemler","Kümeler","Fonksiyonlar","Olasılık"]],
  ["TYT · Geometri",["Üçgenler","Dörtgenler","Çember","Analitik Geometri"]],
  ["TYT · Fizik",["Fizik Bilimine Giriş","Hareket ve Kuvvet","Enerji","Isı ve Sıcaklık","Elektrik","Optik"]],
  ["TYT · Kimya",["Kimya Bilimi","Atom","Periyodik Sistem","Kimyasal Türler","Maddenin Halleri","Karışımlar"]],
  ["TYT · Biyoloji",["Canlıların Ortak Özellikleri","Hücre","Canlıların Sınıflandırılması","Ekoloji","Kalıtım"]],
  ["AYT · Matematik",["Fonksiyonlar","Polinomlar","Trigonometri","Logaritma","Diziler","Limit","Türev","İntegral"]],
  ["AYT · Fizik",["Vektörler","Kuvvet ve Hareket","Elektrik ve Manyetizma","Çembersel Hareket","Dalgalar","Modern Fizik"]],
  ["AYT · Kimya",["Modern Atom Teorisi","Gazlar","Çözeltiler","Tepkimelerde Enerji","Kimyasal Denge","Organik Kimya"]],
  ["AYT · Biyoloji",["Sinir Sistemi","Endokrin Sistem","Duyu Organları","Destek ve Hareket","Sindirim","Dolaşım","Solunum","Boşaltım","Üreme","Genetik","Ekoloji"]]
];
let coachProgramQuickMode=true,coachProgramDays=new Set([0]),coachProgramSelectedDay=0,coachProgramBaseDate="";
function coachProgramMonday(value){
  const d=value?new Date(value+"T12:00:00"):new Date();if(Number.isNaN(d.getTime()))return new Date();
  d.setDate(d.getDate()-(d.getDay()+6)%7);return d;
}
function coachProgramDateForDay(day){
  const d=coachProgramMonday(coachProgramBaseDate||todayIsoLocal());d.setDate(d.getDate()+day);
  const off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
function coachProgramTaskText(){
  if(!coachProgramQuickMode)return String($("programTaskText")?.value||"").trim();
  const subject=String($("programTaskSubject")?.value||"").trim(),topic=String($("programTaskTopic")?.value||"").trim();
  if(!subject)return "";
  const parts=[subject.replace(" · "," "),topic].filter(Boolean),questions=String($("programTaskQuestions")?.value||"").trim(),minutes=String($("programTaskMinutes")?.value||"").trim();
  if(questions)parts.push(Number(questions)+" soru");if(minutes)parts.push(Number(minutes)+" dk");return parts.join(" · ");
}
function coachProgramResource(){
  const raw=String($("programTaskVideo")?.value||"").trim();if(!raw)return "";
  try{const url=new URL(raw);return ["http:","https:"].includes(url.protocol)&&url.hostname?raw:null}catch{return null}
}
function updateCoachProgramBuilder(){
  const task=coachProgramTaskText(),resource=coachProgramResource(),preview=$("programTaskPreview"),dest=$("programTaskDestination"),editing=Boolean(coachProgramEditContext);
  if(preview)preview.textContent=task?(resource?task+" · video bağlantılı":task):editing?"Düzenlenecek çalışma boş bırakılamaz.":"Çalışmanı seç; eklenecek plan burada görünsün.";
  const labels=["Pzt","Sal","Çar","Per","Cum","Cts","Paz"],dates=[...coachProgramDays].sort().map(day=>labels[day]+" "+Number(coachProgramDateForDay(day).slice(8)));
  const monday=coachProgramMonday(coachProgramBaseDate||todayIsoLocal()),weekLabel=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric"}).format(monday);
  if(dest)dest.textContent=editing?(dates[0]+" · mevcut görev düzenlenecek"):(weekLabel+" haftası · "+(dates.length?dates.join(", "):"En az bir gün seç"));
  document.querySelectorAll("[data-program-day]").forEach(button=>{const active=coachProgramDays.has(Number(button.dataset.programDay));button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));button.disabled=editing});
  document.querySelectorAll("[data-program-days]").forEach(button=>button.disabled=editing);
  const send=$("programTaskSend");if(send)send.textContent=editing?"Değişiklikleri kaydet":coachProgramDays.size>1?coachProgramDays.size+" güne ekle":"Programa ekle";
  const remove=$("programTaskDelete"),coachOwned=editing&&/^Koç ·/.test(String(coachProgramEditContext?.prefix||""));
  if(remove){remove.classList.toggle("hidden",!coachOwned);remove.disabled=false}
}
function syncCoachProgramTopics(){
  const subject=$("programTaskSubject"),topic=$("programTaskTopic");if(!subject||!topic)return;
  const item=COACH_PROGRAM_SUBJECTS.find(x=>x[0]===subject.value);topic.innerHTML='<option value="">Genel çalışma</option>';
  (item?.[1]||[]).forEach(name=>topic.add(new Option(name,name)));topic.disabled=!item;updateCoachProgramBuilder();
}
function setCoachProgramMode(quick){
  coachProgramQuickMode=quick;$("programQuickBuilder")?.classList.toggle("hidden",!quick);$("programCustomBuilder")?.classList.toggle("hidden",quick);
  $("programQuickTab")?.classList.toggle("active",quick);$("programCustomTab")?.classList.toggle("active",!quick);$("programQuickTab")?.setAttribute("aria-pressed",String(quick));$("programCustomTab")?.setAttribute("aria-pressed",String(!quick));updateCoachProgramBuilder();
}
function coachProgramSplitExisting(value){
  const raw=String(value||"").trim(),prefix=raw.match(/^Koç ·(?: Deneme sonrası · )?/)?.[0]||"",withoutPrefix=raw.replace(/^Koç ·(?: Deneme sonrası · )?/,"");
  const match=withoutPrefix.match(/\s+—\s+(https?:\/\/\S+)\s*$/i),resource=match?match[1].replace(/[.,;)]+$/,""):"";
  const text=(match?withoutPrefix.slice(0,match.index):withoutPrefix).trim();
  return{text,resource,prefix};
}
function openProgramTaskModal(prefill="",options={}){
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid);if(!row){alert("Önce soldan bir öğrenci seç.");return}
  const edit=Boolean(options.edit),editDay=Number(options.day),editWeek=String(options.weekStart||"");
  $("programTaskBackdrop")?.classList.remove("hidden");$("programTaskBackdrop")?.setAttribute("aria-hidden","false");
  $("programTaskBackdrop")?.toggleAttribute("data-editing",edit);
  if($("programTaskStudentName"))$("programTaskStudentName").textContent=studentName(row)+(edit?" için mevcut çalışma":" için yeni çalışma");
  const week=activeProgramWeek(row);coachProgramBaseDate=edit&&/^\d{4}-\d{2}-\d{2}$/.test(editWeek)?editWeek:(week.week||programCurrentWeekStart());
  if(edit&&Number.isInteger(editDay)&&editDay>=0&&editDay<=6)coachProgramSelectedDay=editDay;
  else{
    const today=new Date(),monday=coachProgramMonday(coachProgramBaseDate),diff=Math.round((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(monday.getFullYear(),monday.getMonth(),monday.getDate()))/86400000);
    coachProgramSelectedDay=diff>=0&&diff<=6?diff:0;
  }
  coachProgramDays=new Set([coachProgramSelectedDay]);
  const parsed=edit?coachProgramSplitExisting(prefill):{text:prefill,resource:"",prefix:""};
  if(edit&&coachProgramEditContext)coachProgramEditContext.prefix=parsed.prefix;
  if($("programTaskText"))$("programTaskText").value=parsed.text;if($("programTaskVideo"))$("programTaskVideo").value=parsed.resource;
  if($("programTaskQuestions"))$("programTaskQuestions").value="";if($("programTaskMinutes"))$("programTaskMinutes").value="";
  if(parsed.text)setCoachProgramMode(false);else setCoachProgramMode(true);
  if($("programTaskStatus")){$("programTaskStatus").className="program-task-status hidden";$("programTaskStatus").textContent=""}updateCoachProgramBuilder();
}
function closeProgramTaskModal(){coachProgramEditContext=null;$("programTaskBackdrop")?.classList.add("hidden");$("programTaskBackdrop")?.removeAttribute("data-editing");$("programTaskBackdrop")?.setAttribute("aria-hidden","true");document.querySelectorAll("[data-program-day],[data-program-days]").forEach(button=>button.disabled=false);$("programTaskDelete")?.classList.add("hidden");if($("programTaskDelete"))$("programTaskDelete").disabled=false;if($("programTaskTitle"))$("programTaskTitle").textContent="Çalışma ekle"}
function setProgramTaskStatus(message,type=""){const node=$("programTaskStatus");if(!node)return;node.textContent=message;node.className="program-task-status "+type;node.classList.toggle("hidden",!message)}
const coachSubjectSelect=$("programTaskSubject");COACH_PROGRAM_SUBJECTS.forEach(([name])=>coachSubjectSelect?.add(new Option(name,name)));
$("programQuickTab")?.addEventListener("click",()=>setCoachProgramMode(true));$("programCustomTab")?.addEventListener("click",()=>setCoachProgramMode(false));
$("programTaskSubject")?.addEventListener("change",syncCoachProgramTopics);
["programTaskTopic","programTaskQuestions","programTaskMinutes","programTaskText","programTaskVideo"].forEach(id=>$(id)?.addEventListener("input",updateCoachProgramBuilder));
document.querySelectorAll("[data-program-day]").forEach(button=>button.addEventListener("click",()=>{const day=Number(button.dataset.programDay);coachProgramDays.has(day)?coachProgramDays.delete(day):coachProgramDays.add(day);updateCoachProgramBuilder()}));
document.querySelectorAll("[data-program-days]").forEach(button=>button.addEventListener("click",()=>{const mode=button.dataset.programDays;coachProgramDays=new Set(mode==="all"?[0,1,2,3,4,5,6]:mode==="weekdays"?[0,1,2,3,4]:[coachProgramSelectedDay]);updateCoachProgramBuilder()}));
document.querySelectorAll("[data-coach-preset]").forEach(button=>button.addEventListener("click",()=>{const p=button.dataset.coachPreset,subject=$("programTaskSubject"),questions=$("programTaskQuestions");if(!subject||!questions)return;subject.value=p==="paragraph"?"TYT · Türkçe":"TYT · Matematik";syncCoachProgramTopics();$("programTaskTopic").value=p==="paragraph"?"Paragraf":"Problemler";questions.value=p==="paragraph"?"20":"30";updateCoachProgramBuilder()}));
$("programAddTaskBtn")?.addEventListener("click",()=>{coachProgramEditContext=null;openProgramTaskModal()});$("programTaskClose")?.addEventListener("click",closeProgramTaskModal);$("programTaskCancel")?.addEventListener("click",closeProgramTaskModal);$("programTaskBackdrop")?.addEventListener("click",e=>{if(e.target===e.currentTarget)closeProgramTaskModal()});
$("programTemplatesBtn")?.addEventListener("click",()=>$("programTemplatePopover")?.classList.toggle("hidden"));$("programTemplateClose")?.addEventListener("click",()=>$("programTemplatePopover")?.classList.add("hidden"));
document.querySelectorAll("[data-program-template]").forEach(button=>button.addEventListener("click",()=>{coachProgramEditContext=null;$("programTemplatePopover")?.classList.add("hidden");openProgramTaskModal(button.dataset.programTemplate||"")}));
$("programTaskDelete")?.addEventListener("click",async()=>{
  const edit=coachProgramEditContext,row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid),user=auth.currentUser,button=$("programTaskDelete"),send=$("programTaskSend");
  if(!edit||!row||!user)return;
  const cell=coachTaskCell(edit.weekStart,edit.taskId);
  if(!cell){setProgramTaskStatus("Bu görev artık programda bulunmuyor. Programı yenileyip tekrar dene.","error");return}
  if(!/^Koç ·/.test(cell.value)){setProgramTaskStatus("Sadece koç tarafından eklenen görevler buradan silinebilir.","error");return}
  if(!confirm("Bu koç görevi öğrencinin programından silinsin mi?"))return;
  if(button)button.disabled=true;if(send)send.disabled=true;setProgramTaskStatus("Görev siliniyor…","loading");
  try{
    await addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{operation:"delete",sourceWeek:edit.weekStart,taskId:edit.taskId},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    removeCoachProgramTaskLocal(cell,edit.taskId);renderProgramWorkspace();
    coachProgramEditContext=null;setProgramTaskStatus("Görev öğrencinin programından silindi ✓","success");setTimeout(closeProgramTaskModal,700);
  }catch(error){
    console.error("Program görevi silme",error);setProgramTaskStatus("Görev silinemedi: "+String(error?.message||"Bilinmeyen hata"),"error");
  }finally{if(button)button.disabled=false;if(send)send.disabled=false}
});
$("programTaskSend")?.addEventListener("click",async()=>{
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid),user=auth.currentUser,button=$("programTaskSend"),base=coachProgramTaskText(),resource=coachProgramResource();
  if(!row||!user)return;if(!base){setProgramTaskStatus("Ders seç veya çalışma metni yaz.","error");return}if(base.length>600){setProgramTaskStatus("Çalışma metni en fazla 600 karakter olabilir.","error");return}if(resource===null){setProgramTaskStatus("Video bağlantısı geçerli bir http/https adresi olmalı.","error");return}
  if(!coachProgramDays.size){setProgramTaskStatus("En az bir gün seç.","error");return}
  const task=base+(resource?" — "+resource:""),days=[...coachProgramDays].sort((a,b)=>a-b);if(task.length>600){setProgramTaskStatus("Video bağlantısıyla birlikte çalışma en fazla 600 karakter olabilir.","error");return}
  if(button)button.disabled=true;setProgramTaskStatus(days.length+" çalışma gönderiliyor…","loading");
  try{
    if(coachProgramEditContext){
      const edit=coachProgramEditContext,cell=coachTaskCell(edit.weekStart,edit.taskId);
      if(!cell){setProgramTaskStatus("Bu görev artık programda bulunmuyor. Programı yenileyip tekrar dene.","error");return}
      const editedTask=(edit.prefix||"")+task;
      await addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{operation:"edit",sourceWeek:edit.weekStart,taskId:edit.taskId,text:editedTask},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      cell.rows[cell.ri][cell.day]=editedTask;cell.week.data[cell.blk]=cell.rows;renderProgramWorkspace();
      coachProgramEditContext=null;setProgramTaskStatus("Çalışma güncellendi ✓","success");setTimeout(closeProgramTaskModal,650);
    }else{
      await Promise.all(days.map(day=>addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{text:task,date:coachProgramDateForDay(day)},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()})));
      setProgramTaskStatus(days.length===1?"Çalışma öğrenci programına gönderildi ✓":days.length+" güne çalışma gönderildi ✓","success");setTimeout(closeProgramTaskModal,850);
    }
  }catch(error){console.error("Program görevi",error);setProgramTaskStatus("Çalışma gönderilemedi: "+String(error?.message||"Bilinmeyen hata"),"error")}finally{if(button)button.disabled=false}
});
