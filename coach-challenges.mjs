import{getApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,collection,doc,query,where,onSnapshot,setDoc,updateDoc,serverTimestamp}
 from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{challengeId,dayKey,plusDays,mondayOf,
 validateChallengeInput,nextState,rewardByDifficulty}from"./coach-challenge-core.mjs";

const app=getApp("yks-coach-panel"),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const n=(tag,cls="",txt="")=>{
  const e=document.createElement(tag);if(cls)e.className=cls;if(txt)e.textContent=txt;return e;
};
let coachUid="",tasks=[],stop=null,studentUid="",busy=false,watchKey="";
const context=()=>window.YKSCoachChallengeContext;
function notice(value,error=false){
  const el=$("cgStatus");if(el){el.textContent=value;el.dataset.error=String(error);}
}
function students(){
  return Array.isArray(context()?.getStudents?.())?context().getStudents():[];
}
function updateOptions(){
  const select=$("cgStudent");if(!select)return;
  const previous=select.value||studentUid;
  select.replaceChildren();
  for(const row of students()){
    if(!row?.uid)continue;
    const option=n("option","",row.name||"Öğrenci");option.value=row.uid;select.appendChild(option);
  }
  select.value=students().some(s=>s.uid===previous)?previous:select.options[0]?.value??"";
  studentUid=select.value;
  watchSelected();
  draw();
}
function formValue(){
  return {title:$("cgTitle")?.value,subject:$("cgSubject")?.value,note:$("cgNote")?.value,
    kind:$("cgKind")?.value,difficulty:$("cgDifficulty")?.value,
    goalMinutes:$("cgMinutes")?.value,goalQuestions:$("cgQuestions")?.value,
    startDay:$("cgStart")?.value,dueDay:$("cgDue")?.value};
}
function statusName(x){
  return {assigned:"Atandı",in_progress:"Devam ediyor",submitted:"Onay bekliyor",
    completed:"Otomatik tamamlandı",approved:"Koç onaylı",cancelled:"İptal edildi"}[x]||x;
}
function draw(){
  const root=$("cgList");if(!root)return;
  root.replaceChildren();
  const list=tasks.filter(t=>t.studentUid===studentUid&&t.coachUid===coachUid)
    .sort((a,b)=>String(b.startDay).localeCompare(String(a.startDay))||String(b.id).localeCompare(String(a.id)));
  if(!list.length){root.append(n("p","cg-empty","Bu öğrenciye henüz özel görev verilmedi."));return;}
  for(const task of list.slice(0,100)){
    const article=n("article","cg-item"),head=n("div","cg-item-head"),info=n("div","");
    info.append(n("strong","",task.title),n("small","",task.subject||"Genel çalışma"));
    head.append(info,n("b","",task.xp?"+"+task.xp+" XP":"Ödülsüz"));
    article.appendChild(head);
    article.append(n("p","",task.note||(
      task.kind==="manual"?"Koç onayı gerektiren özel görev":
      (task.goalMinutes?task.minutesDone+" / "+task.goalMinutes+" dk":"")+
      (task.goalQuestions?" · "+task.questionsDone+" / "+task.goalQuestions+" soru":""))));
    article.append(n("small","",task.startDay+" → "+task.dueDay+" · "+statusName(task.status)));
    const actions=n("div","cg-actions");
    if(task.status==="submitted"&&task.kind==="manual"){
      const approve=n("button","cg-approve","Onayla");
      approve.addEventListener("click",()=>void transition(task,"approve"));
      actions.appendChild(approve);
    }
    if(["assigned","in_progress","submitted"].includes(task.status)){
      const cancel=n("button","cg-cancel","İptal et");
      cancel.addEventListener("click",()=>void transition(task,"cancel"));
      actions.appendChild(cancel);
    }
    article.appendChild(actions);root.appendChild(article);
  }
}
async function transition(task,action){
  if(busy||!coachUid||task.coachUid!==coachUid)return;
  const status=nextState(task.kind,task.status,action);
  if(action==="cancel"&&!confirm("Bu görev iptal edilsin mi?"))return;
  busy=true;notice("Görev güncelleniyor…");
  try{
    const update={status,updatedAt:serverTimestamp()};
    if(status==="approved")update.approvedAt=serverTimestamp();
    await updateDoc(doc(db,"coachChallenges",task.id),update);
    notice(status==="approved"?"Ödev onaylandı. Ödül öğrenciye yansıyacak.":"Görev iptal edildi.");
  }catch(error){notice("İşlem başarısız: "+String(error?.message||error),true);}
  finally{busy=false;}
}
async function createChallenge(event){
  event.preventDefault();
  if(busy)return;
  if(!coachUid||!studentUid||!students().some(s=>s.uid===studentUid)){
    notice("Önce bağlı bir öğrenci seç.",true);return;
  }
  let payload;
  const rewardMode=$("cgReward")?.value==="yes";
  try{
    payload=validateChallengeInput(formValue());
  }catch(error){notice(String(error?.message||error),true);return;}
  busy=true;const button=$("cgSubmit");if(button)button.disabled=true;
  notice("Görev gönderiliyor…");
  try{
    const build=(slot)=>({
      studentUid,coachUid,weekStart:payload.weekStart,slot,
      title:payload.title,subject:payload.subject,note:payload.note,kind:payload.kind,
      difficulty:payload.difficulty,xp:rewardMode?rewardByDifficulty[payload.difficulty]:0,
      goalMinutes:payload.goalMinutes,goalQuestions:payload.goalQuestions,
      startDay:payload.startDay,dueDay:payload.dueDay,status:"assigned",
      minutesDone:0,questionsDone:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    if(rewardMode){
      // A slot is an immutable student/week document. A concurrent setDoc can
      // only CREATE; overwrite is rejected by Firestore Rules. No missing-doc
      // get/read is necessary (and nonexistent docs would be permission denied).
      let created=false,lastError;
      for(const slot of ["0","1","2"]){
        try{
          await setDoc(doc(db,"coachChallenges",
            challengeId(studentUid,coachUid,payload.weekStart,slot)),build(slot));
          created=true;break;
        }catch(error){
          lastError=error;
          if(error?.code!=="permission-denied"&&error?.code!=="already-exists")throw error;
        }
      }
      if(!created)throw Error("Bu öğrencinin haftalık XP yuvaları dolu veya yetkin yok. "+
        String(lastError?.message||"Ödülsüz görev seçebilirsin."));
    }else{
      const slot="free-"+crypto.randomUUID().replaceAll("-","").slice(0,16);
      await setDoc(doc(db,"coachChallenges",challengeId(studentUid,coachUid,payload.weekStart,slot)),build(slot));
    }
    notice("Görev öğrencinin hesabına gönderildi. Bağlantı geldiğinde görünecek.");
    $("cgTitle").value="";$("cgNote").value="";
  }catch(error){notice("Görev gönderilemedi: "+String(error?.message||error),true);}
  finally{busy=false;if(button)button.disabled=false;}
}
function watchSelected(){
  const key=coachUid+"|"+studentUid;
  if(key===watchKey)return;
  if(stop){stop();stop=null;}tasks=[];watchKey=key;
  if(!coachUid||!studentUid||!students().some(x=>x.uid===studentUid)){draw();return;}
  stop=onSnapshot(query(collection(db,"coachChallenges"),
    where("coachUid","==",coachUid),where("studentUid","==",studentUid)),snapshot=>{
    tasks=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    draw();
  },error=>notice("Öğrenci görevleri okunamadı: "+String(error.message||error),true));
}
function startListening(uid){
  coachUid=uid;
  watchKey="";
  if(stop){stop();stop=null;}
  tasks=[];
  watchSelected();
}
$("cgStudent")?.addEventListener("change",event=>{studentUid=event.target.value;watchSelected();draw();});
$("cgForm")?.addEventListener("submit",event=>void createChallenge(event));
$("cgKind")?.addEventListener("change",()=>{
  const kind=$("cgKind").value;
  $("cgMinutes").disabled=!["minutes","both"].includes(kind);
  $("cgQuestions").disabled=!["questions","both"].includes(kind);
});
$("cgKind")?.dispatchEvent(new Event("change"));
const start=plusDays(dayKey(new Date()),1);
if($("cgStart")){$("cgStart").min=start;$("cgStart").value=start;}
if($("cgDue")){$("cgDue").min=start;$("cgDue").value=plusDays(start,6);}
$("cgStart")?.addEventListener("change",()=>{
  const v=$("cgStart").value;
  try{const monday=mondayOf(v);$("cgDue").min=v;if($("cgDue").value<v)$("cgDue").value=v;
    notice("Ödül haftası: "+monday);}catch{notice("Tarih geçersiz",true);}
});
window.addEventListener("yks:coach-challenges-students",updateOptions);
onAuthStateChanged(auth,user=>{startListening(user?.uid||"");updateOptions();});
updateOptions();
