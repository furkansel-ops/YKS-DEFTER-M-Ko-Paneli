import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,collection,doc,getDoc,getDocs,query,where,setDoc,updateDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

const firebaseApp=initializeApp(FIREBASE_CONFIG);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});

const tabs=[["summary","Özet"],["program","Program"],["exams","Deneme"],["progress","İlerleme"],["topics","Konular"],["errors","Hata Defteri"]];
const state={user:null,coach:null,students:[],selectedUid:"",tab:"summary"};
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

function programItems(share){
  const result=[];
  for(const week of share?.program?.weeks||[]){
    const weekName=text(week?.week,20)||"Hafta";
    const rows=[...(week?.data?.r||[]),...(week?.data?.s||[])];
    for(const row of rows){
      for(const raw of row||[]){
        const task=text(raw,220);
        if(task)result.push({week:weekName,task});
      }
    }
  }
  return result.slice(-80).reverse();
}
function examsInfo(share){
  const exams=Array.isArray(share?.exams)?share.exams:[];
  const latest=exams.at(-1)||null;
  const previous=exams.at(-2)||null;
  const delta=latest&&previous?num(latest.totalNet)-num(previous.totalNet):null;
  return{exams,latest,previous,delta};
}
function topErrors(share){
  const map=new Map();
  for(const item of share?.errorJournal||[]){
    const subject=text(item.subject||item.lesson||item.ders,60)||"Ders";
    const topic=text(item.topic||item.konu,100)||"Konu";
    const key=`${subject}|${topic}`;
    const current=map.get(key)||{subject,topic,count:0};
    current.count+=Math.max(1,num(item.n||item.count||1));
    map.set(key,current);
  }
  return[...map.values()].sort((a,b)=>b.count-a.count);
}
function topicStats(share){
  const items=Array.isArray(share?.topics?.items)?share.topics.items:[];
  const overdue=items.filter(item=>item.deadline&&item.deadline<today()&&num(item.st)<3);
  const active=items.filter(item=>num(item.st)>0&&num(item.st)<3);
  const complete=items.filter(item=>num(item.st)>=3);
  return{items,overdue,active,complete};
}
function studentName(entry){return text(entry?.share?.profile?.name||entry?.profile?.displayName,80)||"Öğrenci"}
function studentTrack(entry){return text(entry?.share?.profile?.track||entry?.profile?.track,30)||"YKS"}
function subjectName(item){return text(item.subject||item.lesson||item.ders,70)||"Ders"}
function topicName(item){return text(item.topic||item.name||item.konu,120)||"Konu"}
function statusName(st){return num(st)>=3?"Tamamlandı":num(st)>0?"Çalışılıyor":"Başlanmadı"}

async function loadStudents(){
  if(!state.user)return;
  $("studentList").innerHTML='<div class="empty">Öğrenciler yükleniyor…</div>';
  const snap=await getDocs(query(collection(db,COLLECTIONS.links),where("coachUid","==",state.user.uid)));
  const links=snap.docs.map(d=>({id:d.id,...d.data()})).filter(link=>link.active===true);
  const students=await Promise.all(links.map(async link=>{
    const[shareSnap,profileSnap]=await Promise.all([
      getDoc(doc(db,COLLECTIONS.shares,link.studentUid)),
      getDoc(doc(db,COLLECTIONS.profiles,link.studentUid))
    ]);
    return{link,share:shareSnap.exists()?shareSnap.data():null,profile:profileSnap.exists()?profileSnap.data():null};
  }));
  students.sort((a,b)=>studentName(a).localeCompare(studentName(b),"tr"));
  state.students=students;
  if(state.selectedUid&&!students.some(s=>s.link.studentUid===state.selectedUid))state.selectedUid="";
  renderStudentList();
  if(state.selectedUid)renderSelected();
  else showNoStudent();
}

function renderStudentList(){
  const host=$("studentList");
  if(!state.students.length){host.innerHTML='<div class="empty">Henüz bağlı öğrenci yok.<br>Öğrencinin Koç Kodum kodunu yukarıdan ekleyebilirsin.</div>';return}
  host.innerHTML="";
  for(const entry of state.students){
    const button=document.createElement("button");
    button.type="button";
    button.className=`student ${entry.link.studentUid===state.selectedUid?"on":""}`;
    button.innerHTML=`<b>${esc(studentName(entry))}</b><span>${esc(studentTrack(entry))}${entry.share?" · veri hazır":" · paylaşım bekleniyor"}</span>`;
    button.onclick=()=>{
      state.selectedUid=entry.link.studentUid;
      state.tab="summary";
      renderStudentList();
      renderSelected();
      closeSidebar();
    };
    host.append(button);
  }
}

function showNoStudent(){
  $("emptyState").classList.remove("hidden");
  $("studentView").classList.add("hidden");
}
function selectedEntry(){return state.students.find(s=>s.link.studentUid===state.selectedUid)||null}
function renderTabs(){
  const host=$("tabs");host.innerHTML="";
  for(const[key,label]of tabs){
    const b=document.createElement("button");b.type="button";b.className=`tab ${state.tab===key?"on":""}`;b.textContent=label;
    b.onclick=()=>{state.tab=key;renderTabs();renderContent(selectedEntry())};
    host.append(b);
  }
}
function renderSelected(){
  const entry=selectedEntry();
  if(!entry){showNoStudent();return}
  $("emptyState").classList.add("hidden");
  $("studentView").classList.remove("hidden");
  $("studentName").textContent=studentName(entry);
  $("studentMeta").textContent=`${studentTrack(entry)} · ${entry.profile?.displayName||"Öğrenci hesabı"}`;
  $("shareState").textContent=entry.share?"● Paylaşım aktif":"○ Paylaşım bekleniyor";
  renderTabs();renderContent(entry);
}

function metric(label,value,note){return`<div class="metric"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`}
function rows(items,render){return items.length?items.map(render).join(""):'<div class="empty">Henüz veri yok.</div>'}

async function sendAction(studentUid,type,payload,button){
  if(!state.user)throw new Error("Koç oturumu gerekli");
  if(button)button.disabled=true;
  try{
    await setDoc(doc(collection(db,COLLECTIONS.actions)),{studentUid,coachUid:state.user.uid,type,payload,status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    alert("Gönderildi ✓");
  }finally{if(button)button.disabled=false}
}
function wireActionForms(host,entry){
  host.querySelectorAll("[data-action]").forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();
    const fd=new FormData(form),payload={};
    for(const[key,value]of fd.entries())payload[key]=text(value,key==="text"?500:220);
    const button=form.querySelector("button[type='submit']");
    try{await sendAction(entry.link.studentUid,form.dataset.action,payload,button);form.reset()}catch(error){alert("Gönderilemedi: "+friendlyError(error))}
  });
}

function renderSummary(host,entry){
  const share=entry.share;
  if(!share){host.innerHTML='<div class="empty">Öğrencinin koç paylaşımı henüz oluşmadı. Öğrenci YKS Defterim uygulamasını açıp senkronizasyonu tamamladığında veriler burada görünecek.</div>';return}
  const exams=examsInfo(share),topics=topicStats(share),errors=topErrors(share),program=programItems(share).slice(0,5);
  const latestNet=exams.latest?`${num(exams.latest.totalNet).toFixed(1)} net`:"—";
  const delta=exams.delta==null?"İlk deneme":`${exams.delta>=0?"+":""}${exams.delta.toFixed(1)} net değişim`;
  host.innerHTML=`<div class="metrics">
    ${metric("7 gün çalışma",`${(num(share.progress?.minutes7)/60).toFixed(1)} sa`,"Toplam odak süresi")}
    ${metric("7 gün soru",String(num(share.progress?.questions7)),"Son 7 gün")}
    ${metric("Son deneme",latestNet,delta)}
    ${metric("Geciken konu",String(topics.overdue.length),`${topics.active.length} aktif · ${topics.complete.length} tamam`)}
  </div>
  <div class="grid">
    <section class="card"><h3>⚠️ Dikkat edilmesi gerekenler</h3>
      ${topics.overdue.length?`<div class="alert"><div><strong>Geciken konular</strong><small>${esc(topics.overdue.slice(0,3).map(topicName).join(" · "))}</small></div><span class="badge">${topics.overdue.length}</span></div>`:""}
      ${errors.length?`<div class="alert"><div><strong>En çok hata yapılan konu</strong><small>${esc(errors[0].subject)} · ${esc(errors[0].topic)}</small></div><span class="badge">${errors[0].count}</span></div>`:""}
      ${exams.delta!=null&&exams.delta<0?`<div class="alert"><div><strong>Son denemede net düşüşü</strong><small>${esc(exams.latest?.name||exams.latest?.type||"Son deneme")}</small></div><span class="badge">${exams.delta.toFixed(1)}</span></div>`:""}
      ${!topics.overdue.length&&!errors.length&&!(exams.delta!=null&&exams.delta<0)?'<div class="empty">Şu anda öne çıkan kritik uyarı yok.</div>':""}
    </section>
    <section class="card"><h3>🗓️ Programdan son görevler</h3>${rows(program,item=>`<div class="row"><span>${esc(item.task)}</span><b>${esc(item.week)}</b></div>`)}</section>
    <section class="card"><h3>📊 Son denemeler</h3>${rows(exams.exams.slice(-4).reverse(),item=>`<div class="row"><span>${esc(item.date||"")} · ${esc(item.name||item.type||"Deneme")}</span><b>${num(item.totalNet).toFixed(1)} net</b></div>`)}</section>
    <section class="card"><h3>🧭 Hızlı işlemler</h3>
      <form class="form" data-action="program_task"><input class="field" name="text" maxlength="220" required placeholder="Programa görev ekle"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Görevi gönder</button></form>
      <form class="form" data-action="coach_note" style="margin-top:12px"><textarea class="field" name="text" maxlength="500" required placeholder="Koç notu"></textarea><button class="btn" type="submit">Not gönder</button></form>
    </section>
  </div>`;
  wireActionForms(host,entry);
}
function renderProgram(host,entry){
  const items=programItems(entry.share);
  host.innerHTML=`<div class="grid"><section class="card"><h3>Program kayıtları</h3><div class="stack">${rows(items.slice(0,40),item=>`<div class="item"><b>${esc(item.task)}</b><small>${esc(item.week)}</small></div>`)}</div></section><section class="card"><h3>Programa görev gönder</h3><form class="form" data-action="program_task"><input class="field" name="text" maxlength="220" required placeholder="Görev"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Gönder</button></form></section></div>`;
  wireActionForms(host,entry);
}
function renderExams(host,entry){
  const info=examsInfo(entry.share);
  host.innerHTML=`<div class="grid"><section class="card"><h3>Deneme geçmişi</h3>${rows(info.exams.slice().reverse(),item=>`<div class="row"><span>${esc(item.date||"")} · ${esc(item.name||item.type||"Deneme")}</span><b>${num(item.totalNet).toFixed(1)} net</b></div>`)}</section><section class="card"><h3>Deneme sonrası görev</h3><form class="form" data-action="post_exam_task"><input class="field" name="text" maxlength="220" required placeholder="Deneme sonrası görev"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Gönder</button></form></section></div>`;
  wireActionForms(host,entry);
}
function renderProgress(host,entry){
  const share=entry.share||{},info=examsInfo(share),topics=topicStats(share);
  const net=info.latest?num(info.latest.totalNet).toFixed(1):"—";
  host.innerHTML=`<div class="metrics">${metric("7 gün çalışma",`${(num(share.progress?.minutes7)/60).toFixed(1)} sa`,"Odak süresi")}${metric("7 gün soru",String(num(share.progress?.questions7)),"Çözülen soru")}${metric("Son net",String(net),info.delta==null?"Karşılaştırma yok":`${info.delta>=0?"+":""}${info.delta.toFixed(1)} değişim`)}${metric("Konu ilerleme",`${topics.complete.length}/${topics.items.length}`,`${topics.active.length} çalışılıyor`)}</div><section class="card"><h3>İlerleme özeti</h3><div class="row"><span>Tamamlanan konu</span><b>${topics.complete.length}</b></div><div class="row"><span>Aktif konu</span><b>${topics.active.length}</b></div><div class="row"><span>Geciken konu</span><b>${topics.overdue.length}</b></div><div class="row"><span>Kayıtlı deneme</span><b>${info.exams.length}</b></div></section>`;
}
function renderTopics(host,entry){
  const stats=topicStats(entry.share);
  const sorted=[...stats.items].sort((a,b)=>Number(!!b.deadline)-Number(!!a.deadline)||num(a.st)-num(b.st));
  host.innerHTML=`<div class="grid"><section class="card"><h3>Konu durumu</h3><div class="stack">${rows(sorted.slice(0,80),item=>`<div class="item"><b>${esc(subjectName(item))} · ${esc(topicName(item))}</b><small>${esc(statusName(item.st))}${item.deadline?` · Hedef ${esc(item.deadline)}`:""}</small></div>`)}</div></section><section class="card"><h3>Konu bitiş hedefi gönder</h3><form class="form" data-action="topic_deadline"><input class="field" name="text" maxlength="220" required placeholder="Ders · Konu"><input class="field" name="date" type="date" value="${today()}"><button class="btn primary" type="submit">Hedef gönder</button></form></section></div>`;
  wireActionForms(host,entry);
}
function renderErrors(host,entry){
  const errors=topErrors(entry.share);
  host.innerHTML=`<section class="card"><h3>Hata Defteri özeti</h3><div class="stack">${rows(errors.slice(0,50),item=>`<div class="row"><span>${esc(item.subject)} · ${esc(item.topic)}</span><b>${item.count} hata</b></div>`)}</div></section>`;
}
function renderContent(entry){
  const host=$("content");host.innerHTML="";
  if(!entry){return}
  if(!entry.share&&state.tab!=="summary"){host.innerHTML='<div class="empty">Öğrenci paylaşımı henüz hazır değil.</div>';return}
  ({summary:renderSummary,program:renderProgram,exams:renderExams,progress:renderProgress,topics:renderTopics,errors:renderErrors}[state.tab]||renderSummary)(host,entry);
}

async function existingLink(studentUid){
  const snap=await getDocs(query(collection(db,COLLECTIONS.links),where("coachUid","==",state.user.uid)));
  return snap.docs.map(d=>({id:d.id,...d.data()})).find(item=>item.studentUid===studentUid)||null;
}
async function addStudent(rawCode){
  const accessCode=normalizeCode(rawCode);
  if(!/^[A-Z2-9]{12}$/.test(accessCode))throw new Error("12 karakterlik öğrenci kodunu kontrol et");
  const codeSnap=await getDoc(doc(db,COLLECTIONS.studentCodes,accessCode));
  if(!codeSnap.exists())throw new Error("Öğrenci kodu bulunamadı");
  const codeData=codeSnap.data();
  if(codeData.active!==true||normalizeCode(codeData.code)!==accessCode)throw new Error("Bu öğrenci kodu aktif değil");
  const studentUid=text(codeData.studentUid,128);
  if(!studentUid)throw new Error("Öğrenci bilgisi bulunamadı");
  const profileSnap=await getDoc(doc(db,COLLECTIONS.profiles,studentUid));
  if(!profileSnap.exists()||profileSnap.data().role!=="student")throw new Error("Bu kod öğrenci hesabına ait değil");
  const existing=await existingLink(studentUid);
  if(existing?.active===true)return{studentUid,already:true};
  const now=serverTimestamp();
  if(existing)await updateDoc(doc(db,COLLECTIONS.links,existing.id),{active:true,accessCode,updatedAt:now});
  else await setDoc(doc(db,COLLECTIONS.links,`${studentUid}_${state.user.uid}`),{studentUid,coachUid:state.user.uid,accessCode,active:true,createdAt:now,updatedAt:now});
  return{studentUid,already:false};
}

function openSidebar(){$("sidebar").classList.add("open");$("overlay").classList.add("show")}
function closeSidebar(){$("sidebar").classList.remove("open");$("overlay").classList.remove("show")}

$("signInBtn").onclick=async()=>{
  $("signInBtn").disabled=true;
  try{await setPersistence(auth,browserLocalPersistence);await signInWithPopup(auth,provider)}catch(error){showAuth(friendlyError(error),"err")}finally{$("signInBtn").disabled=false}
};
$("signOutBtn").onclick=()=>signOut(auth);
$("refreshBtn").onclick=async()=>{try{await loadStudents()}catch(error){alert(friendlyError(error))}};
$("menuBtn").onclick=openSidebar;$("overlay").onclick=closeSidebar;
$("addStudentForm").onsubmit=async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector("button");button.disabled=true;hideStatus($("addStatus"));
  try{
    const result=await addStudent($("studentCode").value);
    $("studentCode").value="";
    setStatus($("addStatus"),result.already?"Bu öğrenci zaten bağlı.":"Öğrenci eklendi ✓","ok");
    state.selectedUid=result.studentUid;state.tab="summary";await loadStudents();
  }catch(error){setStatus($("addStatus"),friendlyError(error),"err")}finally{button.disabled=false}
};
$("studentCode").addEventListener("input",event=>{const cursor=event.target.selectionStart;event.target.value=formatCode(event.target.value);try{event.target.setSelectionRange(cursor,cursor)}catch{}});

onAuthStateChanged(auth,async user=>{
  state.user=user||null;state.coach=null;state.students=[];state.selectedUid="";state.tab="summary";
  if(!user){showAuth();return}
  try{
    const profile=await loadCoachProfile(user);
    if(!profile){
      await signOut(auth);
      showAuth("Bu Google hesabında koç profili yok. Yeni koç hesabı oluştur sayfasını kullan.","err");
      return;
    }
    state.coach=profile;
    $("coachName").textContent=profile.displayName||user.displayName||"Koç";
    $("coachMeta").textContent=[profile.coachTitle,profile.specialization].filter(Boolean).join(" · ")||user.email||"Koç hesabı";
    showApp();
    await loadStudents();
  }catch(error){console.error(error);showAuth(friendlyError(error),"err")}
});
