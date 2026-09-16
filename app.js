import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,collection,doc,getDoc,getDocs,onSnapshot,query,where,setDoc,updateDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

const firebaseApp=initializeApp(FIREBASE_CONFIG);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});

const DAYS=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
const tabs=[["summary","Özet"],["program","Program"],["exams","Deneme"],["progress","İlerleme"],["topics","Konular"],["errors","Hata Defteri"]];
const state={user:null,coach:null,students:[],selectedUid:"",tab:"summary",programWeek:"",shareStop:null};
const $=id=>document.getElementById(id);
const text=(value,max=220)=>String(value??"").trim().slice(0,max);
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const num=value=>Number(value||0)||0;
const today=()=>new Date().toISOString().slice(0,10);
const normalizeCode=value=>String(value??"").toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,12);
const formatCode=value=>normalizeCode(value).replace(/(.{4})(?=.)/g,"$1-");

function setStatus(node,message,type=""){
  if(!node)return;
  node.textContent=message;
  node.className=`status ${type}`.trim();
  node.classList.remove("hidden");
}
function hideStatus(node){node?.classList.add("hidden")}
function friendlyError(error){
  const code=String(error?.code||"");
  if(code.includes("popup-closed"))return"Google giriş penceresi kapatıldı.";
  if(code.includes("popup-blocked"))return"Tarayıcı giriş penceresini engelledi. Açılır pencerelere izin ver.";
  if(code.includes("permission-denied"))return"Firebase erişim izni reddedildi. Firestore Rules sürümünü kontrol et.";
  return text(error?.message||"İşlem tamamlanamadı",180);
}
function showAuth(message="Koç hesabınla giriş yap.",type=""){
  stopSelectedShare();
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
  setStatus($("authStatus"),message,type);
}
function showApp(){
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
}
async function loadCoachProfile(user){
  const snap=await getDoc(doc(db,COLLECTIONS.profiles,user.uid));
  if(!snap.exists())return null;
  const profile=snap.data();
  return profile.role==="coach"?profile:null;
}

function parseDateKey(key){const d=new Date(`${key}T12:00:00`);return Number.isNaN(d.getTime())?null:d}
function dateKey(d){return d.toISOString().slice(0,10)}
function mondayKey(date=new Date()){
  const d=new Date(date);d.setHours(12,0,0,0);
  const shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);
  return dateKey(d);
}
function addDaysKey(key,days){const d=parseDateKey(key);if(!d)return key;d.setDate(d.getDate()+days);return dateKey(d)}
function formatShortDate(key){const d=parseDateKey(key);return d?new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short"}).format(d):key}
function formatWeekRange(key){return`${formatShortDate(key)} – ${formatShortDate(addDaysKey(key,6))}`}
function formatSyncedAt(value){
  const date=value?.toDate?.()||null;
  return date?new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(date):"canlı";
}

function programModel(share){
  const p=share?.program||{};
  const weeks=(Array.isArray(p.weeks)?p.weeks:[]).filter(w=>/^\d{4}-\d{2}-\d{2}$/.test(String(w?.week||""))).slice().sort((a,b)=>String(a.week).localeCompare(String(b.week)));
  const maxRows=kind=>Math.max(1,...weeks.map(w=>Array.isArray(w?.data?.[kind])?w.data[kind].length:0));
  const rowCount={r:Math.max(1,num(p?.rows?.r)||maxRows("r")),s:Math.max(1,num(p?.rows?.s)||maxRows("s"))};
  const labels={
    r:Array.from({length:rowCount.r},(_,i)=>text(p?.rowLabels?.r?.[i],80)||`Rutin ${i+1}`),
    s:Array.from({length:rowCount.s},(_,i)=>text(p?.rowLabels?.s?.[i],80)||`Ders ${i+1}`)
  };
  return{version:num(p.version),weeks,rowCount,labels};
}
function programItems(share){
  const model=programModel(share),result=[];
  for(const week of model.weeks){
    for(const kind of ["r","s"]){
      for(let r=0;r<(week?.data?.[kind]||[]).length;r++){
        const row=week.data[kind][r]||[];
        for(let d=0;d<7;d++){
          const task=text(row[d],220);if(!task)continue;
          const cid=`${kind}-${r}-${d}`;
          result.push({week:week.week,task,label:model.labels[kind][r]||"",day:DAYS[d],done:Boolean(week?.data?.dn?.[cid])});
        }
      }
    }
  }
  return result.slice(-160).reverse();
}
function weekStats(week){
  const byDay=Array.from({length:7},()=>({filled:0,done:0}));let filled=0,done=0;
  for(const kind of ["r","s"]){
    (week?.data?.[kind]||[]).forEach((row,r)=>(row||[]).forEach((raw,d)=>{
      if(!text(raw))return;filled++;byDay[d].filled++;
      if(week?.data?.dn?.[`${kind}-${r}-${d}`]){done++;byDay[d].done++}
    }));
  }
  return{filled,done,pct:filled?Math.round(done/filled*100):0,byDay};
}
function examsInfo(share){
  const exams=Array.isArray(share?.exams)?share.exams:[];
  const latest=exams.at(-1)||null,previous=exams.at(-2)||null;
  return{exams,latest,previous,delta:latest&&previous?num(latest.totalNet)-num(previous.totalNet):null};
}
function topErrors(share){
  const map=new Map();
  for(const item of share?.errorJournal||[]){
    const subject=text(item.subject||item.lesson||item.ders,60)||"Ders",topic=text(item.topic||item.konu,100)||"Konu",key=`${subject}|${topic}`;
    const current=map.get(key)||{subject,topic,count:0};current.count+=Math.max(1,num(item.n||item.count||1));map.set(key,current);
  }
  return[...map.values()].sort((a,b)=>b.count-a.count);
}
function topicStats(share){
  const items=Array.isArray(share?.topics?.items)?share.topics.items:[];
  return{items,overdue:items.filter(item=>item.deadline&&item.deadline<today()&&num(item.st)<3),active:items.filter(item=>num(item.st)>0&&num(item.st)<3),complete:items.filter(item=>num(item.st)>=3)};
}
function studentName(entry){return text(entry?.share?.profile?.name||entry?.profile?.displayName,80)||"Öğrenci"}
function studentTrack(entry){return text(entry?.share?.profile?.track||entry?.profile?.track,30)||"YKS"}
function subjectName(item){return text(item.subject||item.lesson||item.ders,70)||"Ders"}
function topicName(item){return text(item.topic||item.name||item.konu,120)||"Konu"}
function statusName(st){return num(st)>=3?"Tamamlandı":num(st)>0?"Çalışılıyor":"Başlanmadı"}

function stopSelectedShare(){try{state.shareStop?.()}catch{}state.shareStop=null}
function watchSelectedShare(){
  stopSelectedShare();
  const uid=state.selectedUid;if(!uid||!state.user)return;
  state.shareStop=onSnapshot(doc(db,COLLECTIONS.shares,uid),snap=>{
    const entry=state.students.find(s=>s.link.studentUid===uid);if(!entry)return;
    entry.share=snap.exists()?snap.data():null;
    if(state.selectedUid!==uid)return;
    const pill=$("syncPill");if(pill)pill.innerHTML=`<i></i> Canlı eşitlendi · ${esc(formatSyncedAt(entry.share?.updatedAt))}`;
    renderStudentList();renderSelected();
  },error=>{
    console.error("Öğrenci canlı paylaşımı",error);
    const pill=$("syncPill");if(pill)pill.textContent="Eşitleme hatası";
  });
}
async function loadStudents(){
  if(!state.user)return;
  $("studentList").innerHTML='<div class="empty">Öğrenciler yükleniyor…</div>';
  const snap=await getDocs(query(collection(db,COLLECTIONS.links),where("coachUid","==",state.user.uid)));
  const links=snap.docs.map(d=>({id:d.id,...d.data()})).filter(link=>link.active===true);
  const students=await Promise.all(links.map(async link=>{
    const[shareSnap,profileSnap]=await Promise.all([getDoc(doc(db,COLLECTIONS.shares,link.studentUid)),getDoc(doc(db,COLLECTIONS.profiles,link.studentUid))]);
    return{link,share:shareSnap.exists()?shareSnap.data():null,profile:profileSnap.exists()?profileSnap.data():null};
  }));
  students.sort((a,b)=>studentName(a).localeCompare(studentName(b),"tr"));state.students=students;
  if(state.selectedUid&&!students.some(s=>s.link.studentUid===state.selectedUid)){state.selectedUid="";state.programWeek=""}
  renderStudentList();
  if(state.selectedUid){watchSelectedShare();renderSelected()}else showNoStudent();
}
function renderStudentList(){
  const host=$("studentList");
  if(!state.students.length){host.innerHTML='<div class="empty">Henüz bağlı öğrenci yok.<br>Öğrencinin Koç Kodum kodunu yukarıdan ekleyebilirsin.</div>';return}
  host.innerHTML="";
  for(const entry of state.students){
    const button=document.createElement("button");button.type="button";button.className=`student ${entry.link.studentUid===state.selectedUid?"on":""}`;
    button.innerHTML=`<b>${esc(studentName(entry))}</b><span>${esc(studentTrack(entry))}${entry.share?" · canlı veri":" · paylaşım bekleniyor"}</span>`;
    button.onclick=()=>{state.selectedUid=entry.link.studentUid;state.tab="summary";state.programWeek="";renderStudentList();watchSelectedShare();renderSelected();closeSidebar()};
    host.append(button);
  }
}
function showNoStudent(){stopSelectedShare();$("emptyState").classList.remove("hidden");$("studentView").classList.add("hidden")}
function selectedEntry(){return state.students.find(s=>s.link.studentUid===state.selectedUid)||null}
function renderTabs(){
  const host=$("tabs");host.innerHTML="";
  for(const[key,label]of tabs){const b=document.createElement("button");b.type="button";b.className=`tab ${state.tab===key?"on":""}`;b.textContent=label;b.onclick=()=>{state.tab=key;renderTabs();renderContent(selectedEntry())};host.append(b)}
}
function renderSelected(){
  const entry=selectedEntry();if(!entry){showNoStudent();return}
  $("emptyState").classList.add("hidden");$("studentView").classList.remove("hidden");
  $("studentName").textContent=studentName(entry);$("studentMeta").textContent=`${studentTrack(entry)} · ${entry.profile?.displayName||"Öğrenci hesabı"}`;
  $("shareState").textContent=entry.share?"● Paylaşım aktif":"○ Paylaşım bekleniyor";renderTabs();renderContent(entry);
}
function metric(label,value,note){return`<div class="metric"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`}
function rows(items,render){return items.length?items.map(render).join(""):'<div class="empty">Henüz veri yok.</div>'}

async function sendAction(studentUid,type,payload,button){
  if(!state.user)throw new Error("Koç oturumu gerekli");if(button)button.disabled=true;
  try{await setDoc(doc(collection(db,COLLECTIONS.actions)),{studentUid,coachUid:state.user.uid,type,payload,status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});alert("Gönderildi ✓")}finally{if(button)button.disabled=false}
}
function wireActionForms(host,entry){
  host.querySelectorAll("[data-action]").forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();const fd=new FormData(form),payload={};for(const[key,value]of fd.entries())payload[key]=text(value,key==="text"?500:220);
    const button=form.querySelector("button[type='submit']");try{await sendAction(entry.link.studentUid,form.dataset.action,payload,button);form.reset()}catch(error){alert("Gönderilemedi: "+friendlyError(error))}
  });
}

function renderSummary(host,entry){
  const share=entry.share;if(!share){host.innerHTML='<div class="empty">Öğrencinin koç paylaşımı henüz oluşmadı. Öğrenci YKS Defterim uygulamasını açtığında veriler burada görünecek.</div>';return}
  const exams=examsInfo(share),topics=topicStats(share),errors=topErrors(share),program=programItems(share).slice(0,5);
  const latestNet=exams.latest?`${num(exams.latest.totalNet).toFixed(1)} net`:"—",delta=exams.delta==null?"İlk deneme":`${exams.delta>=0?"+":""}${exams.delta.toFixed(1)} net değişim`;
  host.innerHTML=`<div class="metrics">${metric("7 gün çalışma",`${(num(share.progress?.minutes7)/60).toFixed(1)} sa`,"Toplam odak süresi")}${metric("7 gün soru",String(num(share.progress?.questions7)),"Son 7 gün")}${metric("Son deneme",latestNet,delta)}${metric("Geciken konu",String(topics.overdue.length),`${topics.active.length} aktif · ${topics.complete.length} tamam`)}</div>
  <div class="grid"><section class="card"><h3>⚠️ Dikkat edilmesi gerekenler</h3>${topics.overdue.length?`<div class="alert"><div><strong>Geciken konular</strong><small>${esc(topics.overdue.slice(0,3).map(topicName).join(" · "))}</small></div><span class="badge">${topics.overdue.length}</span></div>`:""}${errors.length?`<div class="alert"><div><strong>En çok hata yapılan konu</strong><small>${esc(errors[0].subject)} · ${esc(errors[0].topic)}</small></div><span class="badge">${errors[0].count}</span></div>`:""}${exams.delta!=null&&exams.delta<0?`<div class="alert"><div><strong>Son denemede net düşüşü</strong><small>${esc(exams.latest?.name||exams.latest?.type||"Son deneme")}</small></div><span class="badge">${exams.delta.toFixed(1)}</span></div>`:""}${!topics.overdue.length&&!errors.length&&!(exams.delta!=null&&exams.delta<0)?'<div class="empty">Şu anda öne çıkan kritik uyarı yok.</div>':""}</section>
  <section class="card"><h3>🗓️ Programdan son görevler</h3>${rows(program,item=>`<div class="row"><span>${esc(item.day)} · ${esc(item.task)}</span><b>${item.done?"✓":""}</b></div>`)}</section>
  <section class="card"><h3>📊 Son denemeler</h3>${rows(exams.exams.slice(-4).reverse(),item=>`<div class="row"><span>${esc(item.date||"")} · ${esc(item.name||item.type||"Deneme")}</span><b>${num(item.totalNet).toFixed(1)} net</b></div>`)}</section>
  <section class="card"><h3>🧭 Hızlı işlemler</h3><form class="form" data-action="program_task"><input class="field" name="text" maxlength="220" required placeholder="Programa görev ekle"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Görevi gönder</button></form><form class="form" data-action="coach_note" style="margin-top:12px"><textarea class="field" name="text" maxlength="500" required placeholder="Koç notu"></textarea><button class="btn" type="submit">Not gönder</button></form></section></div>`;
  wireActionForms(host,entry);
}
function programGrid(model,week,kind,title){
  const count=model.rowCount[kind],labels=model.labels[kind],matrix=week?.data?.[kind]||[],dn=week?.data?.dn||{},mv=week?.data?.mv||{},dayDone=week?.data?.done||[];
  const heads=DAYS.map((day,d)=>`<div class="program-day-head ${dayDone[d]?"day-complete":""}"><b>${esc(day.slice(0,3))}</b><small>${dayDone[d]?"Gün tamam ✓":""}</small></div>`).join("");
  let body="";
  for(let r=0;r<count;r++){
    body+=`<div class="program-row-label">${esc(labels[r]||`${title} ${r+1}`)}</div>`;
    for(let d=0;d<7;d++){
      const cid=`${kind}-${r}-${d}`,task=text(matrix?.[r]?.[d],220),done=Boolean(dn[cid]),moved=Object.prototype.hasOwnProperty.call(mv,cid);
      body+=`<div class="program-cell ${task?"has-task":""} ${done?"is-done":""} ${moved?"is-moved":""}">${task?`<span>${esc(task)}</span><small>${done?"✓ Tamamlandı":moved?"↪ Taşındı":"Planlandı"}</small>`:'<span class="program-empty">—</span>'}</div>`;
    }
  }
  return`<section class="card program-card"><div class="program-section-title"><div><span class="eyebrow">${kind==="r"?"Rutin":"Ders"}</span><h3>${esc(title)}</h3></div><span class="mini-pill">${count} satır</span></div><div class="program-scroll"><div class="program-table"><div class="program-corner">Satır</div>${heads}${body}</div></div></section>`;
}
function ensureProgramWeek(entry){
  const model=programModel(entry.share);if(!model.weeks.length){state.programWeek="";return{model,week:null,index:-1}}
  let index=model.weeks.findIndex(w=>w.week===state.programWeek);
  if(index<0){const current=mondayKey();index=model.weeks.findIndex(w=>w.week===current);if(index<0)index=model.weeks.length-1;state.programWeek=model.weeks[index].week}
  return{model,week:model.weeks[index],index};
}
function renderProgram(host,entry){
  const{model,week,index}=ensureProgramWeek(entry);
  if(!entry.share){host.innerHTML='<div class="empty">Öğrenci paylaşımı henüz hazır değil.</div>';return}
  if(!week){
    host.innerHTML=`<div class="grid"><section class="card"><h3>Programım</h3><div class="empty">Öğrencinin Programım bölümünde henüz kayıtlı haftalık plan yok.</div></section><section class="card"><h3>Programa görev gönder</h3><form class="form" data-action="program_task"><input class="field" name="text" maxlength="220" required placeholder="Görev"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Gönder</button></form></section></div>`;wireActionForms(host,entry);return;
  }
  const stats=weekStats(week),completedDays=(week?.data?.done||[]).filter(Boolean).length;
  host.innerHTML=`<section class="program-live-note"><div><span class="live-dot"></span><b>YKS Defterim Programım canlı eşitleniyor</b><small>Öğrenci planı değiştirdiğinde bu ekran otomatik güncellenir.</small></div><span class="pill">Program v${model.version||1}</span></section>
  <div class="program-toolbar"><div class="program-nav"><button class="btn" type="button" data-program-nav="-1" ${index<=0?"disabled":""}>← Önceki</button><button class="btn" type="button" data-program-current>Bu hafta</button><button class="btn" type="button" data-program-nav="1" ${index>=model.weeks.length-1?"disabled":""}>Sonraki →</button></div><div class="program-week-title"><span class="eyebrow">Hafta</span><h3>${esc(formatWeekRange(week.week))}</h3><small>${esc(week.week)} · ${index+1}/${model.weeks.length}</small></div></div>
  <div class="metrics program-metrics">${metric("Haftalık ilerleme",`%${stats.pct}`,`${stats.done}/${stats.filled} görev tamamlandı`)}${metric("Planlanan görev",String(stats.filled),"Rutin + ders")}${metric("Tamamlanan görev",String(stats.done),"İşaretlenen hücre")}${metric("Tamamlanan gün",`${completedDays}/7`,"Gün durumu")}</div>
  <div class="program-layout"><div class="program-main">${programGrid(model,week,"r","Rutinler")}${programGrid(model,week,"s","Ders Programım")}</div><aside class="card program-action-card"><span class="eyebrow">Koç işlemi</span><h3>Programa görev gönder</h3><p class="muted">Görev öğrencinin YKS Defterim Programım bölümüne eklenir. Uygulandıktan sonra bu tablo canlı yenilenir.</p><form class="form" data-action="program_task"><input class="field" name="text" maxlength="220" required placeholder="Örn. Matematik · Problemler 40 soru"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Görevi gönder</button></form></aside></div>`;
  host.querySelectorAll("[data-program-nav]").forEach(button=>button.onclick=()=>{const next=index+Number(button.dataset.programNav);if(next>=0&&next<model.weeks.length){state.programWeek=model.weeks[next].week;renderProgram(host,entry)}});
  host.querySelector("[data-program-current]")?.addEventListener("click",()=>{const current=mondayKey(),found=model.weeks.find(w=>w.week===current);state.programWeek=found?.week||model.weeks.at(-1).week;renderProgram(host,entry)});
  wireActionForms(host,entry);
}
function renderExams(host,entry){
  const info=examsInfo(entry.share);host.innerHTML=`<div class="grid"><section class="card"><h3>Deneme geçmişi</h3>${rows(info.exams.slice().reverse(),item=>`<div class="row"><span>${esc(item.date||"")} · ${esc(item.name||item.type||"Deneme")}</span><b>${num(item.totalNet).toFixed(1)} net</b></div>`)}</section><section class="card"><h3>Deneme sonrası görev</h3><form class="form" data-action="post_exam_task"><input class="field" name="text" maxlength="220" required placeholder="Deneme sonrası görev"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Gönder</button></form></section></div>`;wireActionForms(host,entry);
}
function renderProgress(host,entry){
  const share=entry.share||{},info=examsInfo(share),topics=topicStats(share),net=info.latest?num(info.latest.totalNet).toFixed(1):"—";
  host.innerHTML=`<div class="metrics">${metric("7 gün çalışma",`${(num(share.progress?.minutes7)/60).toFixed(1)} sa`,"Odak süresi")}${metric("7 gün soru",String(num(share.progress?.questions7)),"Çözülen soru")}${metric("Son net",String(net),info.delta==null?"Karşılaştırma yok":`${info.delta>=0?"+":""}${info.delta.toFixed(1)} değişim`)}${metric("Konu ilerleme",`${topics.complete.length}/${topics.items.length}`,`${topics.active.length} çalışılıyor`)}</div><section class="card"><h3>İlerleme özeti</h3><div class="row"><span>Tamamlanan konu</span><b>${topics.complete.length}</b></div><div class="row"><span>Aktif konu</span><b>${topics.active.length}</b></div><div class="row"><span>Geciken konu</span><b>${topics.overdue.length}</b></div><div class="row"><span>Kayıtlı deneme</span><b>${info.exams.length}</b></div></section>`;
}
function renderTopics(host,entry){
  const stats=topicStats(entry.share),sorted=[...stats.items].sort((a,b)=>Number(!!b.deadline)-Number(!!a.deadline)||num(a.st)-num(b.st));
  host.innerHTML=`<div class="grid"><section class="card"><h3>Konu durumu</h3><div class="stack">${rows(sorted.slice(0,80),item=>`<div class="item"><b>${esc(subjectName(item))} · ${esc(topicName(item))}</b><small>${esc(statusName(item.st))}${item.deadline?` · Hedef ${esc(item.deadline)}`:""}</small></div>`)}</div></section><section class="card"><h3>Konu bitiş hedefi gönder</h3><form class="form" data-action="topic_deadline"><input class="field" name="text" maxlength="220" required placeholder="Ders · Konu"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Hedef gönder</button></form></section></div>`;wireActionForms(host,entry);
}
function renderErrors(host,entry){const errors=topErrors(entry.share);host.innerHTML=`<section class="card"><h3>Hata Defteri özeti</h3><div class="stack">${rows(errors.slice(0,50),item=>`<div class="row"><span>${esc(item.subject)} · ${esc(item.topic)}</span><b>${item.count} hata</b></div>`)}</div></section>`}
function renderContent(entry){
  const host=$("content");host.innerHTML="";if(!entry)return;
  if(!entry.share&&state.tab!=="summary"){host.innerHTML='<div class="empty">Öğrenci paylaşımı henüz hazır değil.</div>';return}
  ({summary:renderSummary,program:renderProgram,exams:renderExams,progress:renderProgress,topics:renderTopics,errors:renderErrors}[state.tab]||renderSummary)(host,entry);
}

async function existingLink(studentUid){
  const snap=await getDocs(query(collection(db,COLLECTIONS.links),where("coachUid","==",state.user.uid)));
  return snap.docs.map(d=>({id:d.id,...d.data()})).find(item=>item.studentUid===studentUid)||null;
}
async function addStudent(rawCode){
  const accessCode=normalizeCode(rawCode);if(!/^[A-Z2-9]{12}$/.test(accessCode))throw new Error("12 karakterlik öğrenci kodunu kontrol et");
  const codeSnap=await getDoc(doc(db,COLLECTIONS.studentCodes,accessCode));if(!codeSnap.exists())throw new Error("Öğrenci kodu bulunamadı");
  const codeData=codeSnap.data();if(codeData.active!==true||normalizeCode(codeData.code)!==accessCode)throw new Error("Bu öğrenci kodu aktif değil");
  const studentUid=text(codeData.studentUid,128);if(!studentUid)throw new Error("Öğrenci bilgisi bulunamadı");
  const profileSnap=await getDoc(doc(db,COLLECTIONS.profiles,studentUid));if(!profileSnap.exists()||profileSnap.data().role!=="student")throw new Error("Bu kod öğrenci hesabına ait değil");
  const existing=await existingLink(studentUid);if(existing?.active===true)return{studentUid,already:true};
  const now=serverTimestamp();if(existing)await updateDoc(doc(db,COLLECTIONS.links,existing.id),{active:true,accessCode,updatedAt:now});else await setDoc(doc(db,COLLECTIONS.links,`${studentUid}_${state.user.uid}`),{studentUid,coachUid:state.user.uid,accessCode,active:true,createdAt:now,updatedAt:now});
  return{studentUid,already:false};
}
function openSidebar(){$("sidebar").classList.add("open");$("overlay").classList.add("show")}
function closeSidebar(){$("sidebar").classList.remove("open");$("overlay").classList.remove("show")}

$("signInBtn").onclick=async()=>{$("signInBtn").disabled=true;try{await setPersistence(auth,browserLocalPersistence);await signInWithPopup(auth,provider)}catch(error){showAuth(friendlyError(error),"err")}finally{$("signInBtn").disabled=false}};
$("signOutBtn").onclick=()=>signOut(auth);
$("refreshBtn").onclick=async()=>{try{await loadStudents()}catch(error){alert(friendlyError(error))}};
$("menuBtn").onclick=openSidebar;$("overlay").onclick=closeSidebar;
$("addStudentForm").onsubmit=async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector("button");button.disabled=true;hideStatus($("addStatus"));
  try{const result=await addStudent($("studentCode").value);$("studentCode").value="";setStatus($("addStatus"),result.already?"Bu öğrenci zaten bağlı.":"Öğrenci eklendi ✓","ok");state.selectedUid=result.studentUid;state.tab="summary";state.programWeek="";await loadStudents()}catch(error){setStatus($("addStatus"),friendlyError(error),"err")}finally{button.disabled=false}
};
$("studentCode").addEventListener("input",event=>{const cursor=event.target.selectionStart;event.target.value=formatCode(event.target.value);try{event.target.setSelectionRange(cursor,cursor)}catch{}});

onAuthStateChanged(auth,async user=>{
  stopSelectedShare();state.user=user||null;state.coach=null;state.students=[];state.selectedUid="";state.tab="summary";state.programWeek="";
  if(!user){showAuth();return}
  try{
    const profile=await loadCoachProfile(user);if(!profile){await signOut(auth);showAuth("Bu Google hesabında koç profili yok. Yeni koç hesabı oluştur sayfasını kullan.","err");return}
    state.coach=profile;$("coachName").textContent=profile.displayName||user.displayName||"Koç";$("coachMeta").textContent=[profile.coachTitle,profile.specialization].filter(Boolean).join(" · ")||user.email||"Koç hesabı";showApp();await loadStudents();
  }catch(error){console.error(error);showAuth(friendlyError(error),"err")}
});
