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

const coachPages={home:"homePage",students:"studentsPage",programs:"programsPage",reports:"reportsPage",exams:"examsPage",topics:"topicsPage",errors:"errorsPage",messages:"messagesPage",settings:"settingsPage"};
function showCoachPage(page){
  const targetId=coachPages[page];
  if(!targetId)return;
  document.querySelectorAll("[data-coach-page]").forEach(item=>item.classList.toggle("on",item.dataset.coachPage===page));
  document.querySelectorAll("#homePage,#studentsPage,#programsPage,#reportsPage,#examsPage,#topicsPage,#errorsPage,#messagesPage,#settingsPage").forEach(section=>section.classList.add("hidden"));
  $(targetId)?.classList.remove("hidden");
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
  try{renderDashboardDayReviews()}catch(error){console.error("Canlı gün sonu notları",error)}
  try{renderStudentsPage()}catch(error){console.error("Canlı öğrenci görünümü",error)}
  try{hydrateProgramStudents();renderProgramWorkspace()}catch(error){console.error("Canlı program görünümü",error)}
  try{renderReport($("reportStudentSelect")?.value||"all")}catch(error){console.error("Canlı rapor görünümü",error)}
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
function weekStats(program){
  const item=latestWeek(program),data=item?.data||{},rows=[...programRowList(data.r),...programRowList(data.s)];
  const taskCounts=Array.from({length:7},(_,day)=>rows.reduce((sum,row)=>sum+(String(row?.[day]||"").trim()?1:0),0));
  const done=Array.from({length:7},(_,day)=>Boolean(data?.done?.[day]));
  const plannedDays=taskCounts.filter(Boolean).length;
  const doneDays=taskCounts.reduce((sum,count,day)=>sum+(count&&done[day]?1:0),0);
  return{week:item?.week||"",taskCounts,done,plannedDays,doneDays,ratio:plannedDays?Math.round(doneDays/plannedDays*100):0};
}
function studentName(row){return row?.share?.profile?.name||row?.profile?.displayName||"Öğrenci"}
function studentDayReview(row,date=todayIsoLocal()){
  const entries=Array.isArray(row?.share?.progress?.dayReview?.entries)?row.share.progress.dayReview.entries:[];
  return [...entries].reverse().find(item=>item?.date===date&&(item?.mood||String(item?.note||"").trim()))||null;
}
function dayReviewMoodMeta(mood){
  if(mood==="good")return{label:"İyi",icon:"🙂",tone:"good"};
  if(mood==="mid")return{label:"Orta",icon:"😐",tone:"mid"};
  if(mood==="hard")return{label:"Zor",icon:"😮‍💨",tone:"hard"};
  return{label:"Not",icon:"☾",tone:"mid"};
}
function renderDashboardDayReviews(){
  const root=$("dashboardDayReviews");if(!root)return;
  const today=todayIsoLocal(),items=coachReportRows.map(row=>({row,review:studentDayReview(row,today)})).filter(item=>item.review).sort((a,b)=>reportNum(b.review?.at)-reportNum(a.review?.at));
  if(!items.length){
    root.innerHTML='<div class="dashboard-day-review-empty"><span>☾</span><div><b>Bugün henüz not yok</b><p>Öğrenciler gün sonu değerlendirmesini kaydettiğinde burada canlı görünecek.</p></div></div>';return;
  }
  root.innerHTML=items.map(({row,review})=>{
    const name=studentName(row),mood=dayReviewMoodMeta(review.mood),note=String(review.note||"").trim()||"Kısa not eklenmedi.";
    const when=review.at?new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(review.at)):"";
    return '<article class="dashboard-day-review-row"><span class="dashboard-day-review-avatar">'+escHtml(reportInitial(name))+'</span><span class="dashboard-day-review-student"><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS öğrencisi")+'</small></span><span class="dashboard-day-review-mood '+mood.tone+'"><i>'+mood.icon+'</i>'+mood.label+'</span><p class="dashboard-day-review-note">'+escHtml(note)+'</p><time class="dashboard-day-review-time">'+escHtml(when)+'</time></article>';
  }).join("");
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
function renderReport(scope){
  if(!coachReportRows.length){setReportState("reportEmpty");return}
  if(scope==="all"){renderReportOverview();return}
  const row=coachReportRows.find(x=>x.studentUid===scope);
  if(!row){renderReportOverview();return}
  renderStudentReport(row);
}
function renderReportOverview(){
  const rows=coachReportRows,withShare=rows.filter(r=>r.share);
  const minutes=withShare.reduce((s,r)=>s+reportNum(r.share?.progress?.minutes7),0);
  const questions=withShare.reduce((s,r)=>s+reportNum(r.share?.progress?.questions7),0);
  const overdueStudents=withShare.filter(r=>reportNum(r.share?.progress?.overdueTopics)>0).length;
  $("reportScopeTitle").textContent="Tüm öğrenciler";
  $("reportScopeMeta").textContent="Son 7 günlük koçluk özeti";
  $("reportOverviewKpis").innerHTML=
    kpi("BAĞLI ÖĞRENCİ",String(rows.length),"Aktif bağlantı")+
    kpi("TOPLAM ÇALIŞMA",reportMinutes(minutes),"Son 7 gün")+
    kpi("ÇÖZÜLEN SORU",String(Math.round(questions)),"Son 7 gün")+
    kpi("GECİKEN KONUSU OLAN",String(overdueStudents),"Öğrenci",overdueStudents?"warn":"");
  const studentRows=rows.map(row=>{
    const p=row.share?.progress||{},w=weekStats(row.share?.program),name=studentName(row);
    return '<button class="report-student-row" type="button" data-report-student="'+escHtml(row.studentUid)+'" data-report-name="'+escHtml(name.toLocaleLowerCase("tr-TR"))+'"><span class="report-student-main"><i>'+escHtml(reportInitial(name))+'</i><b>'+escHtml(name)+'</b><small>'+escHtml(row.share?.profile?.track||"YKS")+'</small></span><strong>'+escHtml(reportMinutes(p.minutes7))+'</strong><strong>'+escHtml(String(Math.round(reportNum(p.questions7))))+'</strong><strong>'+(w.plannedDays?escHtml(w.ratio+"%"):"—")+'</strong><strong>'+escHtml(String(Math.round(reportNum(p.overdueTopics))))+'</strong><em>'+escHtml(reportStatus(row))+' ›</em></button>';
  }).join("");
  $("reportStudentList").innerHTML=studentRows||'<div class="report-list-empty">Öğrenci verisi yok.</div>';
  $("reportCoachSummary").innerHTML=
    '<div><span>Verisi güncel öğrenci</span><strong>'+withShare.length+' / '+rows.length+'</strong></div>'+
    '<div><span>Ortalama çalışma</span><strong>'+reportMinutes(rows.length?minutes/rows.length:0)+'</strong></div>'+
    '<div><span>Ortalama soru</span><strong>'+Math.round(rows.length?questions/rows.length:0)+'</strong></div>'+
    '<div><span>Geciken konu toplamı</span><strong>'+withShare.reduce((s,r)=>s+reportNum(r.share?.progress?.overdueTopics),0)+'</strong></div>';
  const stamps=withShare.map(r=>r.share?.updatedAt).filter(Boolean);
  $("reportSyncBox").innerHTML=stamps.length?'<b>'+escHtml(reportTimestamp(stamps.at(-1)))+'</b><span>Öğrenci uygulamasından gelen son veri</span>':'<b>Veri bekleniyor</b><span>Henüz paylaşım alınmadı</span>';
  document.querySelectorAll("[data-report-student]").forEach(btn=>btn.addEventListener("click",()=>{
    if($("reportStudentSelect"))$("reportStudentSelect").value=btn.dataset.reportStudent;
    renderReport(btn.dataset.reportStudent);
  }));
  setReportState("reportOverview");
}
function renderStudentReport(row){
  const share=row.share||{},profile=share.profile||{},progress=share.progress||{},w=weekStats(share.program),name=studentName(row);
  $("reportScopeTitle").textContent=name;
  $("reportScopeMeta").textContent="Öğrenci detay raporu";
  $("reportStudentAvatar").textContent=reportInitial(name);
  $("reportStudentName").textContent=name;
  const target=[profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ");
  $("reportStudentTarget").textContent=[profile.track,target].filter(Boolean).join(" • ")||"Hedef bilgisi yok";
  $("reportStudentSync").textContent="Son veri: "+reportTimestamp(share.updatedAt);
  $("reportStudentKpis").innerHTML=
    kpi("ÇALIŞMA",reportMinutes(progress.minutes7),"Son 7 gün")+
    kpi("SORU",String(Math.round(reportNum(progress.questions7))),"Son 7 gün")+
    kpi("PROGRAM UYUMU",w.plannedDays?w.ratio+"%":"—",w.plannedDays?w.doneDays+" / "+w.plannedDays+" gün":"Program verisi yok")+
    kpi("GECİKEN KONU",String(Math.round(reportNum(progress.overdueTopics))),"Takip bekleyen",reportNum(progress.overdueTopics)?"warn":"");
  $("reportProgramTitle").textContent=w.week?"Hafta · "+w.week:"Haftalık program";
  $("reportProgramScore").textContent=w.plannedDays?w.ratio+"%":"—";
  const days=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  $("reportWeekDays").innerHTML=days.map((day,i)=>{
    const tasks=w.taskCounts[i]||0,done=w.done[i],cls=!tasks?"empty":done?"done":"open";
    const meta=!tasks?"Plan yok":done?"Tamamlandı":tasks+" görev";
    return '<div class="report-day '+cls+'"><span>'+day+'</span><b>'+tasks+'</b><small>'+meta+'</small></div>';
  }).join("");
  $("reportTopicStats").innerHTML=
    '<div><span>Tamamlanan</span><strong>'+Math.round(reportNum(progress.completedTopics))+'</strong></div>'+
    '<div><span>Devam eden</span><strong>'+Math.round(reportNum(progress.activeTopics))+'</strong></div>'+
    '<div class="'+(reportNum(progress.overdueTopics)?"danger":"")+'"><span>Geciken</span><strong>'+Math.round(reportNum(progress.overdueTopics))+'</strong></div>';
  const exams=Array.isArray(share.exams)?[...share.exams].slice(-4).reverse():[];
  $("reportExamList").innerHTML=exams.length?exams.map(exam=>'<div class="report-exam-row"><div><b>'+escHtml(exam.name||exam.type||"Deneme")+'</b><span>'+escHtml(exam.date||"Tarih yok")+'</span></div><strong>'+escHtml(String(reportNum(exam.totalNet)))+' net</strong></div>').join(""):'<div class="report-mini-empty">Henüz deneme verisi yok.</div>';
  const errors=Array.isArray(share.errorJournal)?[...share.errorJournal].slice(-5).reverse():[];
  $("reportErrorList").innerHTML=errors.length?errors.map(item=>'<div class="report-error-row"><div><b>'+escHtml(item.subject||"Ders")+'</b><span>'+escHtml(item.topic||"Konu belirtilmemiş")+'</span></div><strong>'+escHtml(String(Math.max(1,reportNum(item.n))))+' yanlış</strong></div>').join(""):'<div class="report-mini-empty">Henüz hata defteri kaydı yok.</div>';
  setReportState("reportStudentDetail");
}
$("reportStudentSelect")?.addEventListener("change",event=>renderReport(event.currentTarget.value));
$("reportRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user)void loadCoachReports(user.uid)});
$("reportSearch")?.addEventListener("input",event=>{
  const q=String(event.currentTarget.value||"").trim().toLocaleLowerCase("tr-TR");
  document.querySelectorAll("[data-report-name]").forEach(row=>row.classList.toggle("hidden",q&&!String(row.dataset.reportName||"").includes(q)));
});


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
function openCoachProgramEdit(weekStart,taskId){
  const cell=coachTaskCell(weekStart,taskId);if(!cell)return;
  coachProgramEditContext={weekStart,taskId};openProgramTaskModal(cell.value.replace(/^Koç ·(?: Deneme sonrası · )?/,""));
  if($("programTaskTitle"))$("programTaskTitle").textContent="Çalışmayı düzenle";
  if($("programTaskSend"))$("programTaskSend").textContent="Değişiklikleri kaydet";
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
  const list=$("programStudentList"),empty=$("programStudentEmpty"),count=$("programStudentCount");
  if(count)count.textContent=String(coachReportRows.length);
  if(!list||!empty)return;
  if(!coachReportRows.length){
    empty.classList.remove("hidden");list.classList.add("hidden");list.innerHTML="";
    selectedProgramStudentUid="";selectedProgramWeekStart="";return;
  }
  empty.classList.add("hidden");list.classList.remove("hidden");
  if(!selectedProgramStudentUid||!coachReportRows.some(x=>x.studentUid===selectedProgramStudentUid))selectedProgramStudentUid=coachReportRows[0].studentUid;
  const q=String($("programStudentSearch")?.value||"").trim().toLocaleLowerCase("tr-TR");
  list.innerHTML=coachReportRows.filter(row=>!q||studentName(row).toLocaleLowerCase("tr-TR").includes(q)).map(row=>{
    const name=studentName(row),weeks=programWeeks(row),stats=weekStats(row.share?.program);
    return '<button type="button" class="program-student-item '+(row.studentUid===selectedProgramStudentUid?"active":"")+'" data-program-student="'+escHtml(row.studentUid)+'"><i>'+escHtml(reportInitial(name))+'</i><span><b>'+escHtml(name)+'</b><small>'+(weeks.length?weeks.length+" hafta · "+stats.ratio+"% uyum":"Program verisi bekleniyor")+'</small></span><em>›</em></button>';
  }).join("")||'<div class="program-student-filter-empty">Öğrenci bulunamadı.</div>';
  document.querySelectorAll("[data-program-student]").forEach(button=>button.addEventListener("click",()=>{
    selectedProgramStudentUid=button.dataset.programStudent;
    selectedProgramWeekStart="";
    hydrateProgramStudents();
    renderProgramWorkspace();
  }));
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
  const done=Array.from({length:7},(_,d)=>Boolean(data.done?.[d]));
  const doneDays=tasks.reduce((sum,x,d)=>sum+(x.length&&done[d]?1:0),0);
  const ratio=plannedDays?Math.round(doneDays/plannedDays*100):0;
  if($("programWeekLabel"))$("programWeekLabel").textContent=formatProgramWeek(week.week);
  const storedWeek=weeks.some(item=>item.week===week.week);
  if($("programDoneMeta"))$("programDoneMeta").textContent=storedWeek?plannedDays+" planlı gün":"Bu hafta henüz boş";
  if($("programTaskCount"))$("programTaskCount").textContent=String(taskCount);
  if($("programDoneDays"))$("programDoneDays").textContent=String(doneDays);

  const completedTaskCount=tasks.reduce((sum,x,d)=>sum+(done[d]?x.length:0),0);
  const pendingTaskCount=Math.max(0,taskCount-completedTaskCount);
  if($("programProgress"))$("programProgress").textContent=ratio+"%";
  if($("programPendingTasks"))$("programPendingTasks").textContent=String(pendingTaskCount);
  if($("programHeroProgress"))$("programHeroProgress").textContent=ratio+"%";
  if($("programHeroProgressBar"))$("programHeroProgressBar").style.width=Math.max(0,Math.min(100,ratio))+"%";
  if($("programPrevWeek"))$("programPrevWeek").disabled=false;
  if($("programNextWeek"))$("programNextWeek").disabled=false;
  empty?.classList.add("hidden");
  if(board)board.innerHTML=tasks.map((dayTasks,day)=>{
    const completed=done[day]&&dayTasks.length,isToday=programDayDate(week.week,day)===todayIsoLocal();
    const stateBadge=completed?'<span class="day-state done">✓ Tamamlandı</span>':isToday?'<span class="day-state today">Bugün</span>':'';
    return '<section class="day-column '+(completed?"done ":"")+(isToday?"today":"")+'"><header><div><b>'+escHtml(programDayLabel(week.week,day))+'</b><small>'+dayTasks.length+' görev</small></div>'+stateBadge+'</header><div class="day-tasks" data-program-drop-day="'+day+'">'+(dayTasks.length?dayTasks.map(task=>{
      const tone=programSubjectTone(task),coachTask=/^Koç ·/.test(task.text);
      const cleanText=task.text.replace(/^Koç ·(?: Deneme sonrası · )?/,"");
      return '<article class="program-task-card tone-'+tone+'" data-program-task-id="'+escHtml(task.id)+'" data-program-task-day="'+day+'"><button type="button" class="program-select-task" data-program-select aria-label="Görevi başka güne taşımak için seç">○</button><button type="button" class="program-edit-task" data-program-edit aria-label="Görevi düzenle">✎</button><span class="task-accent"></span><div><div class="task-meta-row">'+(task.label?'<small class="task-label">'+escHtml(task.label)+'</small>':'<small class="task-label">Program görevi</small>')+(coachTask?'<em>Koç görevi</em>':'')+'</div><b>'+escHtml(cleanText)+'</b></div></article>';
    }).join(""):'<div class="day-empty"><i>＋</i><span>Bu gün için görev yok</span></div>')+'</div></section>';
  }).join("");
  bindCoachProgramCardActions(week.week);
}
$("programStudentSearch")?.addEventListener("input",hydrateProgramStudents);
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
  const task=coachProgramTaskText(),resource=coachProgramResource(),preview=$("programTaskPreview"),dest=$("programTaskDestination");
  if(preview)preview.textContent=task?(resource?task+" · video bağlantılı":task):"Çalışmanı seç; eklenecek plan burada görünsün.";
  const labels=["Pzt","Sal","Çar","Per","Cum","Cts","Paz"],dates=[...coachProgramDays].sort().map(day=>labels[day]+" "+Number(coachProgramDateForDay(day).slice(8)));
  const monday=coachProgramMonday(coachProgramBaseDate||todayIsoLocal()),weekLabel=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric"}).format(monday);
  if(dest)dest.textContent=weekLabel+" haftası · "+(dates.length?dates.join(", "):"En az bir gün seç");
  document.querySelectorAll("[data-program-day]").forEach(button=>{const active=coachProgramDays.has(Number(button.dataset.programDay));button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active))});
  const send=$("programTaskSend");if(send)send.textContent=coachProgramDays.size>1?coachProgramDays.size+" güne ekle":"Programa ekle";
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
function openProgramTaskModal(prefill=""){
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid);if(!row){alert("Önce soldan bir öğrenci seç.");return}
  $("programTaskBackdrop")?.classList.remove("hidden");$("programTaskBackdrop")?.setAttribute("aria-hidden","false");
  if($("programTaskStudentName"))$("programTaskStudentName").textContent=studentName(row)+" için yeni çalışma";
  const week=activeProgramWeek(row);coachProgramBaseDate=week.week||programCurrentWeekStart();
  const today=new Date(),monday=coachProgramMonday(coachProgramBaseDate),diff=Math.round((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(monday.getFullYear(),monday.getMonth(),monday.getDate()))/86400000);
  coachProgramSelectedDay=diff>=0&&diff<=6?diff:0;coachProgramDays=new Set([coachProgramSelectedDay]);
  if($("programTaskText"))$("programTaskText").value=prefill;if($("programTaskVideo"))$("programTaskVideo").value="";
  if($("programTaskQuestions"))$("programTaskQuestions").value="";if($("programTaskMinutes"))$("programTaskMinutes").value="";
  if(prefill)setCoachProgramMode(false);else setCoachProgramMode(true);
  if($("programTaskStatus")){$("programTaskStatus").className="program-task-status hidden";$("programTaskStatus").textContent=""}updateCoachProgramBuilder();
}
function closeProgramTaskModal(){$("programTaskBackdrop")?.classList.add("hidden");$("programTaskBackdrop")?.setAttribute("aria-hidden","true")}
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
$("programTaskSend")?.addEventListener("click",async()=>{
  const row=coachReportRows.find(x=>x.studentUid===selectedProgramStudentUid),user=auth.currentUser,button=$("programTaskSend"),base=coachProgramTaskText(),resource=coachProgramResource();
  if(!row||!user)return;if(!base){setProgramTaskStatus("Ders seç veya çalışma metni yaz.","error");return}if(base.length>600){setProgramTaskStatus("Çalışma metni en fazla 600 karakter olabilir.","error");return}if(resource===null){setProgramTaskStatus("Video bağlantısı geçerli bir http/https adresi olmalı.","error");return}
  if(!coachProgramDays.size){setProgramTaskStatus("En az bir gün seç.","error");return}
  const task=base+(resource?" — "+resource:""),days=[...coachProgramDays].sort((a,b)=>a-b);if(task.length>600){setProgramTaskStatus("Video bağlantısıyla birlikte çalışma en fazla 600 karakter olabilir.","error");return}
  if(button)button.disabled=true;setProgramTaskStatus(days.length+" çalışma gönderiliyor…","loading");
  try{
    if(coachProgramEditContext){
      const edit=coachProgramEditContext,cell=coachTaskCell(edit.weekStart,edit.taskId);
      await addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{operation:"edit",sourceWeek:edit.weekStart,taskId:edit.taskId,text:task},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if(cell){cell.rows[cell.ri][cell.day]=task;cell.week.data[cell.blk]=cell.rows;renderProgramWorkspace()}
      coachProgramEditContext=null;setProgramTaskStatus("Çalışma güncellendi ✓","success");setTimeout(closeProgramTaskModal,650);
    }else{
      await Promise.all(days.map(day=>addDoc(collection(db,"coachingActions"),{studentUid:row.studentUid,coachUid:user.uid,type:"program_task",payload:{text:task,date:coachProgramDateForDay(day)},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()})));
      setProgramTaskStatus(days.length===1?"Çalışma öğrenci programına gönderildi ✓":days.length+" güne çalışma gönderildi ✓","success");setTimeout(closeProgramTaskModal,850);
    }
  }catch(error){console.error("Program görevi",error);setProgramTaskStatus("Çalışma gönderilemedi: "+String(error?.message||"Bilinmeyen hata"),"error")}finally{if(button)button.disabled=false}
});
