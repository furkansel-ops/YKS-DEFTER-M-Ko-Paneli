import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,doc,getDoc,collection,getDocs,query,where}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
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

const coachPages={home:"homePage",students:"studentsPage",programs:"programsPage",reports:"reportsPage",exams:"examsPage"};
function showCoachPage(page){
  const targetId=coachPages[page];
  if(!targetId)return;
  document.querySelectorAll("[data-coach-page]").forEach(item=>item.classList.toggle("on",item.dataset.coachPage===page));
  document.querySelectorAll("#homePage,#studentsPage,#programsPage,#reportsPage,#examsPage").forEach(section=>section.classList.add("hidden"));
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
    renderReport("all");
    hydrateExamStudentSelect();
    renderExamAnalysis("all");
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
