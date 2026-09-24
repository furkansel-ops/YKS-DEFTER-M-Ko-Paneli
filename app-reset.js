import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,doc,getDoc,collection,getDocs,query,where,addDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

const firebaseApp=initializeApp(FIREBASE_CONFIG);
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
function showAuth(message="Koç hesabınla giriş yap.",type=""){
  $("authView")?.classList.remove("hidden");
  $("appView")?.classList.add("hidden");
  setStatus(message,type);
}
function showApp(profile,user){
  $("authView")?.classList.add("hidden");
  $("appView")?.classList.remove("hidden");
  const name=text(profile?.displayName||user?.displayName||"Koç",80)||"Koç";
  const nameNode=$("coachSidebarName"),avatar=$("coachSidebarAvatar");
  if(nameNode)nameNode.textContent=name;
  if(avatar)avatar.textContent=initials(name).slice(0,1);
  const dashName=$("dashboardCoachName");if(dashName)dashName.textContent=name.split(/\\s+/)[0]||"Koç";
  const dashDate=$("dashboardDate");if(dashDate)dashDate.textContent=new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
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

const coachPages={home:"homePage",students:"studentsPage",programs:"programsPage",reports:"reportsPage",exams:"examsPage",topics:"topicsPage",errors:"errorsPage",messages:"messagesPage"};
function showCoachPage(page){
  const targetId=coachPages[page];
  if(!targetId)return;
  document.querySelectorAll("[data-coach-page]").forEach(item=>item.classList.toggle("on",item.dataset.coachPage===page));
  document.querySelectorAll("#homePage,#studentsPage,#programsPage,#reportsPage,#examsPage,#topicsPage,#errorsPage,#messagesPage").forEach(section=>section.classList.add("hidden"));
  $(targetId)?.classList.remove("hidden");
  closeSidebar();
}
document.querySelectorAll("[data-coach-page]").forEach(button=>{
  button.addEventListener("click",()=>showCoachPage(button.dataset.coachPage));
});

onAuthStateChanged(auth,async user=>{
  if(!user){showAuth();return}
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


document.querySelectorAll("[data-student-filter]").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll("[data-student-filter]").forEach(x=>x.classList.toggle("active",x===button));
}));
$("addStudentBtn")?.addEventListener("click",()=>alert("Öğrenci bağlantı akışını sonraki adımda gerçek sisteme bağlayacağız."));




let coachReportRows=[];
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
function latestWeek(program){
  const weeks=Array.isArray(program?.weeks)?program.weeks:[];
  return [...weeks].sort((x,y)=>String(x?.week||"").localeCompare(String(y?.week||""))).at(-1)||null;
}
function weekStats(program){
  const item=latestWeek(program),data=item?.data||{},rows=[...(data.r||[]),...(data.s||[])];
  const taskCounts=Array.from({length:7},(_,day)=>rows.reduce((sum,row)=>sum+(String(row?.[day]||"").trim()?1:0),0));
  const done=Array.from({length:7},(_,day)=>Boolean(data?.done?.[day]));
  const plannedDays=taskCounts.filter(Boolean).length;
  const doneDays=taskCounts.reduce((sum,count,day)=>sum+(count&&done[day]?1:0),0);
  return{week:item?.week||"",taskCounts,done,plannedDays,doneDays,ratio:plannedDays?Math.round(doneDays/plannedDays*100):0};
}
function studentName(row){return row?.share?.profile?.name||row?.profile?.displayName||"Öğrenci"}
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
    try{renderMessageStudents()}catch(error){console.error("Mesaj öğrenci listesi",error)}
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
let selectedMessageStudent="";
let messageStudentFilter="all";

function messageTimestamp(value){
  try{
    const d=value?.toDate?.()||new Date(value);
    if(!d||Number.isNaN(d.getTime()))return"—";
    return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);
  }catch{return"—"}
}
function messageDayKey(value){
  try{
    const d=value?.toDate?.()||new Date(value);
    if(!d||Number.isNaN(d.getTime()))return"";
    return d.toISOString().slice(0,10);
  }catch{return""}
}
function messageDayLabel(value){
  try{
    const d=value?.toDate?.()||new Date(value),today=new Date(),yesterday=new Date();
    yesterday.setDate(today.getDate()-1);
    const key=d.toISOString().slice(0,10),todayKey=today.toISOString().slice(0,10),yesterdayKey=yesterday.toISOString().slice(0,10);
    if(key===todayKey)return"Bugün";
    if(key===yesterdayKey)return"Dün";
    return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long"}).format(d);
  }catch{return""}
}
function messageStatusText(status){
  return status==="applied"?"Uygulandı":status==="rejected"?"Başarısız":status==="cancelled"?"İptal":status==="pending"?"Bekliyor":"Gönderildi";
}
function messageStatusClass(status){
  return status==="applied"?"applied":status==="rejected"?"failed":status==="cancelled"?"cancelled":"pending";
}
async function loadCoachMessages(coachUid){
  if(!coachUid)return;
  try{
    const snap=await getDocs(query(collection(db,"coachingActions"),where("coachUid","==",coachUid)));
    coachMessageActions=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.type==="coach_note").sort((a,b)=>{
      const av=a?.createdAt?.toMillis?.()||0,bv=b?.createdAt?.toMillis?.()||0;return av-bv;
    });
  }catch(error){
    console.error("Mesajlar",error);
    coachMessageActions=[];
  }
  renderMessageStudents();
  if(selectedMessageStudent)renderMessageConversation(selectedMessageStudent);
}
function messageRows(){return coachReportRows.filter(row=>row?.link?.active===true)}
function messageActionsFor(studentUid){return coachMessageActions.filter(x=>x.studentUid===studentUid)}
function rowMatchesMessageFilter(row){
  if(messageStudentFilter==="all")return true;
  const actions=messageActionsFor(row.studentUid);
  if(messageStudentFilter==="pending")return actions.some(x=>x.status==="pending");
  if(messageStudentFilter==="failed")return actions.some(x=>x.status==="rejected");
  return true;
}
function renderMessageStudents(){
  const rows=messageRows(),list=$("messageStudentList");
  if($("messageStudentCount"))$("messageStudentCount").textContent=String(rows.length);
  if(!list)return;
  if(!rows.length){
    list.innerHTML='<div class="message-side-empty"><b>Henüz bağlı öğrenci yok</b><span>Öğrenciler bağlandığında konuşmalar burada açılacak.</span></div>';
    $("messageNoStudent")?.classList.remove("hidden");
    $("messageConversation")?.classList.add("hidden");
    $("messageInfoEmpty")?.classList.remove("hidden");
    $("messageInfoPanel")?.classList.add("hidden");
    return;
  }
  list.innerHTML=rows.map(row=>{
    const name=studentName(row),actions=messageActionsFor(row.studentUid),last=actions.at(-1),pending=actions.filter(x=>x.status==="pending").length,failed=actions.filter(x=>x.status==="rejected").length;
    const hidden=rowMatchesMessageFilter(row)?"":" hidden";
    return '<button type="button" class="message-student-item '+(selectedMessageStudent===row.studentUid?"active":"")+hidden+'" data-message-student="'+escHtml(row.studentUid)+'" data-message-name="'+escHtml(name.toLocaleLowerCase("tr-TR"))+'"><span class="message-avatar">'+escHtml(reportInitial(name))+'</span><span class="message-student-copy"><b>'+escHtml(name)+'</b><small>'+escHtml(last?.payload?.text||"Henüz mesaj yok")+'</small></span><span class="message-student-meta"><small>'+escHtml(last?messageTimestamp(last.createdAt):"")+'</small><span class="message-mini-badges">'+(pending?'<i class="pending">'+pending+'</i>':'')+(failed?'<i class="failed">!</i>':last?'<i class="'+messageStatusClass(last.status)+'"></i>':'')+'</span></span></button>';
  }).join("");
  document.querySelectorAll("[data-message-student]").forEach(btn=>btn.addEventListener("click",()=>{
    selectedMessageStudent=btn.dataset.messageStudent;
    const input=$("messageInput");if(input)input.value="";
    if($("messageCharCount"))$("messageCharCount").textContent="0";
    renderMessageStudents();
    renderMessageConversation(selectedMessageStudent);
  }));
  if(!selectedMessageStudent&&rows.length){
    selectedMessageStudent=rows[0].studentUid;
    renderMessageStudents();
    renderMessageConversation(selectedMessageStudent);
  }
}
function renderMessageConversation(studentUid){
  const row=coachReportRows.find(x=>x.studentUid===studentUid);if(!row)return;
  const name=studentName(row),profile=row.share?.profile||{},progress=row.share?.progress||{},actions=messageActionsFor(studentUid);
  $("messageNoStudent")?.classList.add("hidden");
  $("messageConversation")?.classList.remove("hidden");
  $("messageInfoEmpty")?.classList.add("hidden");
  $("messageInfoPanel")?.classList.remove("hidden");
  $("messageChatAvatar").textContent=reportInitial(name);
  $("messageChatName").textContent=name;
  $("messageChatMeta").textContent=[profile.track,profile.targetDepartment].filter(Boolean).join(" · ")||"Bağlı öğrenci";
  $("messageInfoAvatar").textContent=reportInitial(name);
  $("messageInfoName").textContent=name;
  $("messageInfoTarget").textContent=[profile.track,profile.targetUniversity,profile.targetDepartment].filter(Boolean).join(" · ")||"YKS öğrencisi";
  $("messageStudyMinutes").textContent=reportMinutes(progress.minutes7);
  $("messageStudyQuestions").textContent=String(Math.round(reportNum(progress.questions7)));
  $("messageOverdueTopics").textContent=String(Math.round(reportNum(progress.overdueTopics)));
  $("messageSentCount").textContent=String(actions.length);
  $("messageAppliedCount").textContent=String(actions.filter(x=>x.status==="applied").length);
  $("messagePendingCount").textContent=String(actions.filter(x=>x.status==="pending").length);
  $("messageFailedCount").textContent=String(actions.filter(x=>x.status==="rejected").length);
  const thread=$("messageThread");
  if(thread){
    if(!actions.length){
      thread.innerHTML='<div class="message-thread-empty"><span>✉</span><b>Henüz mesaj yok</b><p>İlk koç notunu aşağıdan gönderebilir veya hızlı mesajlardan birini seçebilirsin.</p></div>';
    }else{
      let lastDay="";
      thread.innerHTML=actions.map(action=>{
        const key=messageDayKey(action.createdAt),divider=key&&key!==lastDay?'<div class="message-day-divider"><span>'+escHtml(messageDayLabel(action.createdAt))+'</span></div>':"";
        lastDay=key||lastDay;
        const failed=action.status==="rejected";
        return divider+'<div class="message-bubble-row outgoing"><div class="message-bubble '+(failed?"bubble-failed":"")+'"><p>'+escHtml(action?.payload?.text||"")+'</p><div class="message-bubble-meta"><span>'+escHtml(messageTimestamp(action.createdAt))+'</span><strong class="'+messageStatusClass(action.status)+'">'+escHtml(messageStatusText(action.status))+'</strong></div>'+(failed?'<button type="button" class="message-reuse" data-message-reuse="'+escHtml(action.id)+'">Mesajı düzenleyip tekrar gönder</button>':'')+'</div></div>';
      }).join("");
      document.querySelectorAll("[data-message-reuse]").forEach(btn=>btn.addEventListener("click",()=>{
        const action=coachMessageActions.find(x=>x.id===btn.dataset.messageReuse);
        const input=$("messageInput");if(!action||!input)return;
        input.value=String(action?.payload?.text||"").slice(0,500);
        if($("messageCharCount"))$("messageCharCount").textContent=String(input.value.length);
        input.focus();
      }));
    }
    requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight});
  }
}
async function sendCoachMessage(){
  const studentUid=selectedMessageStudent,input=$("messageInput"),button=$("messageSendBtn"),user=auth.currentUser;
  const value=String(input?.value||"").trim().slice(0,500);
  if(!user||!studentUid||!value)return;
  const row=coachReportRows.find(x=>x.studentUid===studentUid);
  if(!row?.link?.active){alert("Bu öğrenciyle aktif koç bağlantısı bulunamadı.");return}
  if(button)button.disabled=true;
  try{
    await addDoc(collection(db,"coachingActions"),{studentUid,coachUid:user.uid,type:"coach_note",payload:{text:value},status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    if(input)input.value="";
    if($("messageCharCount"))$("messageCharCount").textContent="0";
    await loadCoachMessages(user.uid);
  }catch(error){
    console.error("Mesaj gönderilemedi",error);
    alert("Mesaj gönderilemedi: "+String(error?.message||"Bilinmeyen hata"));
  }finally{if(button)button.disabled=false}
}
$("messageComposeForm")?.addEventListener("submit",event=>{event.preventDefault();void sendCoachMessage()});
$("messageInput")?.addEventListener("input",event=>{if($("messageCharCount"))$("messageCharCount").textContent=String(event.currentTarget.value.length)});
$("messageInput")?.addEventListener("keydown",event=>{if(event.ctrlKey&&event.key==="Enter"){event.preventDefault();void sendCoachMessage()}});
$("messageRefreshBtn")?.addEventListener("click",()=>{const user=auth.currentUser;if(user)void loadCoachMessages(user.uid)});
$("messageStudentSearch")?.addEventListener("input",event=>{
  const q=String(event.currentTarget.value||"").trim().toLocaleLowerCase("tr-TR");
  document.querySelectorAll("[data-message-name]").forEach(item=>{
    const searchMatch=!q||String(item.dataset.messageName||"").includes(q);
    const row=coachReportRows.find(x=>x.studentUid===item.dataset.messageStudent);
    item.classList.toggle("hidden",!searchMatch||!rowMatchesMessageFilter(row||{}));
  });
});
document.querySelectorAll("[data-message-filter]").forEach(button=>button.addEventListener("click",()=>{
  messageStudentFilter=button.dataset.messageFilter||"all";
  document.querySelectorAll("[data-message-filter]").forEach(x=>x.classList.toggle("active",x===button));
  renderMessageStudents();
  $("messageStudentSearch")?.dispatchEvent(new Event("input"));
}));
document.querySelectorAll("[data-message-template]").forEach(button=>button.addEventListener("click",()=>{
  const input=$("messageInput");if(!input)return;
  input.value=button.dataset.messageTemplate||"";
  if($("messageCharCount"))$("messageCharCount").textContent=String(input.value.length);
  input.focus();
}));
document.querySelector('[data-coach-page="messages"]')?.addEventListener("click",()=>{
  const input=$("messageInput");if(input)input.value="";
  if($("messageCharCount"))$("messageCharCount").textContent="0";
  const user=auth.currentUser;
  if(user){renderMessageStudents();void loadCoachMessages(user.uid)}
});
