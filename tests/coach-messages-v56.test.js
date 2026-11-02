const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const at=ms=>({toMillis:()=>ms,toDate:()=>new Date(ms)});

function fixture(t,{addDoc}={}){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},listeners={},added=[],errors=[];
  w.innerWidth=375;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},
    onSnapshot:(q,cb,err)=>{listeners[Array.isArray(q)?q[0].name:q.name]={cb,err};return()=>{}},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({path:parts.join("/")}),
    serverTimestamp:()=>"NOW",getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),setDoc:async()=>{},updateDoc:async()=>{},
    addDoc:addDoc||(async(ref,data)=>{added.push(data);return{id:"x"}}),signOut:async()=>{},alert:()=>{throw new Error("alert kullanılmamalı")},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{const now=Date.now(),wk=programCurrentWeekStart(),day=(new Date().getDay()+6)%7,r=[["","","","","","",""],["","","","","","",""]];r[0][day]="Kimya mol 30 soru";r[1][day]="Fizik optik";
  coachReportRows=[
   {studentUid:"a",link:{id:"l-a",active:true,coachUid:"coach-1"},share:{profile:{name:"Ayşe Yılmaz",track:"SAY"},updatedAt:new Date().toISOString(),
     program:{weeks:[{week:wk,data:{r,dn:{["r-1-"+day]:true}}}],rowLabels:{r:["Ders","Ders"]}},
     exams:[{type:"TYT",date:"2026-10-20",totalNet:70},{type:"TYT",date:"2026-10-30",totalNet:78.75}],
     topics:{full:true,items:[{key:"TYT|Fizik|Optik",exam:"TYT",subject:"Fizik",topic:"Optik",st:3,ts:new Date(now-12*864e5).toISOString().slice(0,10),rev:[0]}]},progress:{}}},
   {studentUid:"b",link:{id:"l-b",active:true,coachUid:"coach-1"},share:{profile:{name:"Berk Can"},progress:{}}}];
  window.__rows=coachReportRows;void loadCoachMessages("coach-1");}`);
  const doc=w.document,now=Date.now();
  const messages=list=>listeners.coachingMessages.cb({docs:list.map(([id,uid,role,ago,text])=>({id,data:()=>({studentUid:uid,coachUid:"coach-1",senderUid:role==="coach"?"coach-1":uid,senderRole:role,text:text||id,createdAt:ago==null?null:at(now-ago*60000)})}))});
  return{w,doc,listeners,added,errors,messages};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};

test("v56 liste: cevap bekleyen üstte ve ne zamandır beklediği; 'Sen:' önizlemesi; sekme başlığında sayı; dürüst durum",t=>{
  const {doc,messages,listeners}=fixture(t);
  doc.title="Koç Paneli";
  assert.equal(doc.getElementById("messageLiveStatus").textContent,"Bağlanıyor…");
  messages([["m1","b","coach",120,"Akşam yazarım dedin"],["m2","a","student",1500,"Merhaba"],["m3","a","coach",1400,"Selam"],["m4","a","student",30,"Çözdüm, 14 doğru."]]);
  const rows=[...doc.querySelectorAll("#messageStudentList .message-student-item")];
  assert.deepEqual(rows.map(r=>r.dataset.messageStudent),["a","b"],"cevap bekleyen önce");
  assert.match(text(rows[0]),/Çözdüm, 14 doğru\. cevap bekliyor · 30 dk/);
  assert.match(text(rows[1]),/Sen: Akşam yazarım dedin/);
  assert.equal(doc.title,"(1) Koç Paneli");assert.equal(doc.getElementById("messageWaitingCount").textContent,"1");
  assert.equal(doc.getElementById("messageLiveStatus").textContent,"Canlı");
  listeners.coachingMessages.err(new Error("permission-denied"));
  assert.equal(doc.getElementById("messageLiveStatus").textContent,"Mesajlar alınamadı");
  assert.match(text(doc.querySelector("#messageThread .coach-v56-banner")),/Mesajlar alınamadı\. Yenile/);
});

test("v56 sohbet: telefonda tam ekran, gün ayırıcıları, son 50 mesaj + daha eskiler, gönderiliyor balonu",t=>{
  const {doc,messages}=fixture(t);
  const list=Array.from({length:55},(_,i)=>["x"+i,"a",i%2?"coach":"student",(55-i)*60*6]);list.push(["p1","a","coach",null,"Yolda"]);
  messages(list);
  const page=doc.getElementById("messagesPage");assert.equal(page.dataset.v56View,"list");
  doc.querySelector('[data-message-student="a"]').click();
  assert.equal(page.dataset.v56View,"chat");
  const thread=doc.getElementById("messageThread");
  assert.equal(thread.querySelectorAll(".message-bubble-row").length,50);
  assert.match(thread.querySelector(".coach-v56-older").textContent,/Daha eski mesajlar \(6\)/);
  const days=[...thread.querySelectorAll(".coach-v56-day")].map(x=>x.textContent);
  assert.equal(days.at(-1),"Bugün");assert.ok(days.includes("Dün"));assert.equal(new Set(days).size,days.length,"her gün bir kez");
  assert.equal(thread.querySelector(".coach-v56-pending .message-bubble-meta span").textContent,"Gönderiliyor…");
  thread.querySelector(".coach-v56-older").click();
  assert.equal(thread.querySelectorAll(".message-bubble-row").length,56);
  doc.getElementById("messageBackBtn").click();assert.equal(page.dataset.v56View,"list");
});

test("v56 gönderim: alan hemen boşalır; reddedilen mesaj 'Gönderilemedi' + Tekrar gönder; uyarı penceresi yok",async t=>{
  let fail=true;const sent=[];
  const {doc,messages,errors}=fixture(t,{addDoc:async(ref,data)=>{sent.push(data.text);if(fail){const e=new Error("x");e.code="permission-denied";throw e}return{id:"ok"}}});
  messages([["m1","a","student",5]]);
  doc.querySelector('[data-message-student="a"]').click();
  const input=doc.getElementById("messageInput");input.value="  Akşam 15 dk konuşalım mı?  ";
  doc.getElementById("messageComposeForm").dispatchEvent(new doc.defaultView.Event("submit",{cancelable:true}));
  assert.equal(input.value,"");
  for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));
  const failed=doc.querySelector("#messageThread .coach-v56-failed");
  assert.match(text(failed),/Akşam 15 dk konuşalım mı\? Gönderilemedi · izin yok ya da bağlantı kapalı ↻ Tekrar gönder/);
  fail=false;failed.querySelector("[data-v56-retry]").click();
  for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(sent,["Akşam 15 dk konuşalım mı?","Akşam 15 dk konuşalım mı?"]);
  assert.equal(doc.querySelector("#messageThread .coach-v56-failed"),null);
  assert.ok(errors.some(e=>/Mesaj gönderilemedi/.test(e)));
});

test("v56 taslak öğrenci başına saklanır; başka sayfadan açılınca da gelir",t=>{
  const {w,doc,messages}=fixture(t);
  messages([["m1","a","student",5],["m2","b","student",9]]);
  doc.querySelector('[data-message-student="a"]').click();
  const input=doc.getElementById("messageInput");input.value="Ayşe'ye taslak";input.dispatchEvent(new w.Event("input"));
  assert.equal(doc.getElementById("messageDraftState").textContent,"Taslak kaydedildi");
  doc.querySelector('[data-message-student="b"]').click();assert.equal(input.value,"");
  doc.querySelector('[data-message-student="a"]').click();assert.equal(input.value,"Ayşe'ye taslak");
  assert.match(w.localStorage.getItem("yks_coach_message_drafts_v1:coach-1"),/Ayşe'ye taslak/);
  doc.querySelector('[data-message-student="b"]').click();
  w.eval('openCoachMessageThread("a","")');assert.equal(input.value,"Ayşe'ye taslak");
});

test("v56 hızlı mesajlar öğrencinin verisinden; bağlantı kapalıysa yazma alanı kilitli",t=>{
  const {w,doc,messages}=fixture(t);
  messages([["m1","a","student",5]]);
  doc.querySelector('[data-message-student="a"]').click();
  const quick=[...doc.querySelectorAll(".message-quickbar [data-message-template]")];
  assert.deepEqual(quick.map(b=>b.textContent),["Bugün 1/2 görev","Optik tekrarı gecikti","Son TYT 78,75 (▲ 8,75)","Gün sonu kontrol"]);
  assert.match(quick[0].dataset.messageTemplate,/^Ayşe, bugün 1\/2 görev tamam\. Kalan: Kimya mol 30 soru\. Akşam bitirebilir misin\?$/);
  quick[1].click();assert.match(doc.getElementById("messageInput").value,/^Ayşe, Optik \(Fizik\) tekrarın 5 gün gecikti\./);
  w.__rows[0].link.active=false;w.eval('renderMessageConversation("a")');
  assert.equal(doc.getElementById("messageInput").disabled,true);
  assert.match(doc.getElementById("messageComposeStatus").textContent,/bağlantı kapalı/);
});

test("v56 dosyalar: stil, sürüm iğnesi, bildirim düğmesi; ham renk yok",()=>{
  const html=read("index.html"),css=read("messages-v56.css");
  assert.match(html,/<link rel="stylesheet" href="\.\/messages-v56\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-topics55-messages56"/);
  assert.match(html,/id="messageNotifyBtn"/);assert.match(html,/id="messageBackBtn"/);assert.match(html,/id="messageChatStatus">Bağlanıyor…</);
  assert.doesNotMatch(css.replace(/var\(--kc-[\w-]+,[^)]*\)/g,""),/#[0-9a-f]{3,8}\b/i);
});
