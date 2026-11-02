const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

const at=ms=>({toMillis:()=>ms,toDate:()=>new Date(ms)});
const T=minute=>Date.UTC(2026,9,31,10,minute);

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},listeners={},writes=[];
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},
    onSnapshot:(q,cb)=>{listeners[Array.isArray(q)?q[0].name:q.name]=cb;return()=>{}},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({path:parts.join("/")}),
    serverTimestamp:()=>"NOW",getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async(ref,data,options)=>{writes.push({path:ref.path,data,options})},updateDoc:async()=>{},addDoc:async()=>({id:"x"}),
    signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{coachReportRows=[{studentUid:"a",link:{id:"l-a",active:true,coachUid:"coach-1"},share:{profile:{name:"Ayşe Yılmaz"},progress:{}}}];
  window.__open=uid=>openCoachMessageThread(uid,"");void loadCoachMessages("coach-1");}`);
  const doc=w.document;
  const messages=list=>listeners.coachingMessages({docs:list.map(([id,role,minute])=>({id,data:()=>({studentUid:"a",coachUid:"coach-1",senderUid:role==="coach"?"coach-1":"a",senderRole:role,text:id,createdAt:at(T(minute))})}))});
  const reads=data=>listeners.coachingReads({docs:data?[{id:"coach-1_a",data:()=>({studentUid:"a",coachUid:"coach-1",...data})}]:[]});
  return{w,doc,writes,messages,reads,listeners};
}

test("v51 koç konuşmayı açınca okundu yazılır; yalnız kendi alanı, birleştirerek",t=>{
  const {w,doc,writes,messages,reads,listeners}=fixture(t);
  assert.ok(listeners.coachingReads,"okundu dinleyicisi mesajlarla birlikte açılır");
  messages([["m1","student",0],["m2","coach",5],["m3","student",10]]);
  w.__open("a");
  assert.equal(doc.getElementById("messagesPage").classList.contains("hidden"),false);
  assert.equal(writes.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0])),{path:"coachingReads/coach-1_a",data:{coachUid:"coach-1",studentUid:"a",coachReadAt:"NOW"},options:{merge:true}});
  reads({coachReadAt:at(T(10)),studentReadAt:at(T(7))});
  messages([["m1","student",0],["m2","coach",5],["m3","student",10]]);
  assert.equal(writes.length,1,"zaten okunmuşsa tekrar yazılmaz");
});

test("v51 kendi mesajında ✓ ya da ✓✓; son mesajın altında Okundu ya da Gönderildi; listede durum",t=>{
  const {w,doc,messages,reads,listeners}=fixture(t);
  messages([["m1","student",0],["m2","coach",5],["m3","student",10]]);
  w.__open("a");
  reads({coachReadAt:at(T(10)),studentReadAt:at(T(7))});
  let ticks=[...doc.querySelectorAll("#messageThread .coach-v51-tick")];
  assert.equal(ticks.length,1);assert.equal(ticks[0].textContent,"✓✓");assert.ok(ticks[0].classList.contains("is-read"));
  assert.match(doc.querySelector("#messageThread .coach-v51-status").textContent,/^Okundu · \d{2}:\d{2}$/);
  assert.equal(doc.querySelector('[data-message-student="a"] .coach-v51-state'),null,"son mesaj öğrencinin");
  messages([["m1","student",0],["m2","coach",5],["m3","student",10],["m4","coach",12]]);
  ticks=[...doc.querySelectorAll("#messageThread .coach-v51-tick")];
  assert.deepEqual(ticks.map(node=>node.textContent),["✓✓","✓"]);
  assert.equal(doc.querySelectorAll("#messageThread .coach-v51-status").length,1,"durum yalnız son mesajın altında");
  assert.equal(doc.querySelector("#messageThread .coach-v51-status").textContent,"Gönderildi");
  assert.equal(doc.querySelector('[data-message-student="a"] .coach-v51-state').textContent,"Gönderildi");
  reads({coachReadAt:at(T(10)),studentReadAt:at(T(13))});
  assert.equal(doc.querySelector('[data-message-student="a"] .coach-v51-state').textContent,"Okundu");
  listeners.coachingMessages({docs:[["m5",null],["m4",12]].map(([id,minute])=>({id,data:()=>({studentUid:"a",coachUid:"coach-1",senderUid:"coach-1",senderRole:"coach",text:id,createdAt:minute==null?null:at(T(minute))})}))});
  const bubbles=[...doc.querySelectorAll("#messageThread .message-bubble p")].map(node=>node.textContent);
  assert.deepEqual(bubbles,["m4","m5"],"sunucu saati gelmemiş mesaj sonda");
  assert.equal(doc.querySelector("#messageThread .coach-v51-status").textContent,"Gönderildi");
  assert.equal([...doc.querySelectorAll("#messageThread .message-bubble-meta span")].at(-1).textContent,"—");
});

test("v51 Mesajlar sayfası kapalıyken gelen mesaj okundu sayılmaz",t=>{
  const {w,doc,writes,messages}=fixture(t);
  messages([["m1","student",0]]);
  w.__open("a");
  assert.equal(writes.length,1);
  doc.querySelector('[data-coach-page="home"]').click();
  messages([["m1","student",0],["m2","student",3]]);
  assert.equal(writes.length,1);
});

test("v51 koç hesabı silinince okundu kayıtları da silinir; stiller tema değişkenleriyle",()=>{
  assert.match(read("coach-auth-v34.js"),/try\{const reads=await byCoach\("coachingReads"\);for\(const item of reads\.docs\)await deleteDoc\(item\.ref\)\}\s*catch\(error\)\{if\(!String\(error\?\.code\|\|""\)\.includes\("permission-denied"\)\)throw error\}/);
  const html=read("index.html"),css=read("coach-messages-read-v51.css");
  assert.match(html,/coach-auth-v34\.js\?v=1\.1\.4/);
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-messages-read-v51\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-bulk50-read51-exams52-photos52-reports53"/);
  assert.match(css,/#messagesPage \.coach-v51-state~\.message-mini-badges i\.applied\{display:none\}/);
  assert.match(css,/#messagesPage \.message-bubble-row\.incoming \.message-bubble\{color:var\(--k-ink\)\}/,"gelen mesaj yazısı açık temada görünür");
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});
