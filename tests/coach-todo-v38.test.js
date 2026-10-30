const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

// Ayşe: 2 cevapsız mesaj · Mehmet: bugün 1/3 · Zeynep: 2 geciken konu · Ali: gelecek haftası dolu.
const DEMO=`
  const wk=programCurrentWeekStart(),next=shiftProgramWeek(wk,1),day=(new Date().getDay()+6)%7,now=new Date().toISOString();
  const row3=()=>[0,1,2].map(i=>Array.from({length:7},(_,d)=>d===day?["Problemler 40 soru","Mol kavramı","20 paragraf"][i]:""));
  const share=(name,dn,extra={})=>({profile:{name},updatedAt:extra.updatedAt||now,progress:{overdueTopics:extra.overdue||0},
    program:{weeks:[{week:wk,data:{r:row3(),dn}}].concat(extra.next?[{week:next,data:{r:[Array.from({length:7},(_,d)=>d===0?"Deneme":"")]}}]:[])}});
  const link={active:true};
  coachReportRows=[
    {studentUid:"a",link,share:share("Ayşe Yılmaz",{["r-0-"+day]:1,["r-1-"+day]:1,["r-2-"+day]:1})},
    {studentUid:"b",link,share:share("Mehmet Kaya",{["r-0-"+day]:1})},
    {studentUid:"c",link,share:share("Zeynep Demir",{["r-0-"+day]:1,["r-1-"+day]:1,["r-2-"+day]:1},{overdue:2})},
    {studentUid:"d",link,share:share("Ali Can",{["r-0-"+day]:1,["r-1-"+day]:1,["r-2-"+day]:1},{next:true})}
  ];
  const at=ms=>({toMillis:()=>ms,toDate:()=>new Date(ms)});
  applyCoachMessageSnapshot({docs:[
    {id:"1",data:()=>({studentUid:"a",senderRole:"coach",text:"Nasıl gidiyor?",createdAt:at(1)})},
    {id:"2",data:()=>({studentUid:"a",senderRole:"student",text:"Paragrafta yine takıldım",createdAt:at(2)})},
    {id:"3",data:()=>({studentUid:"a",senderRole:"student",text:"Ne yapayım?",createdAt:at(3)})},
    {id:"4",data:()=>({studentUid:"b",senderRole:"student",text:"Tamamdır",createdAt:at(4)})},
    {id:"5",data:()=>({studentUid:"b",senderRole:"coach",text:"Süper",createdAt:at(5)})}
  ]});
  renderCoachDashboard();
`;

function fixture(t,extra=""){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}};
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    serverTimestamp:()=>({}),getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"action"}),
    signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:fn=>{w.__timer=fn;return 1},clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  // let/const yalnız aynı eval içinde görünür; örnek veri uygulama koduyla birlikte çalışır.
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+extra+"}");
  return{w,doc:w.document};
}
const tasks=doc=>[...doc.querySelectorAll("#dashboardTodo .coach-v38-task")].map(node=>({kind:node.dataset.todoKind,title:node.querySelector("b").textContent,sub:node.querySelector("small").textContent,actions:[...node.querySelectorAll("button")].map(b=>b.textContent)}));

test("v38 Bugün yapılacaklar: önce cevap bekleyen mesaj, sonra takip edilecekler, Perşembe'den itibaren boş gelecek hafta",t=>{
  const {doc}=fixture(t,DEMO),list=tasks(doc),weekday=(new Date().getDay()+6)%7;
  assert.deepEqual(list[0],{kind:"msg",title:"Ayşe Yılmaz · 2 mesaj cevap bekliyor",sub:list[0].sub,actions:["Cevapla"]});
  assert.match(list[0].sub,/^“Ne yapayım\?” · /);
  assert.ok(!list.some(item=>item.kind==="msg"&&/Mehmet/.test(item.title)),"koçun cevapladığı konuşma listede yok");
  const zeynep=list.find(item=>/Zeynep/.test(item.title)),mehmet=list.find(item=>/Mehmet/.test(item.title));
  assert.deepEqual([zeynep.kind,zeynep.title,zeynep.actions],["bad","Zeynep Demir · 2 geciken konu",["Mesaj yaz","Raporu aç"]]);
  assert.deepEqual([mehmet.kind,mehmet.title,mehmet.sub,mehmet.actions],["warn","Mehmet Kaya · bugün 1 / 3 görev","Kalan: Mol kavramı, 20 paragraf",["Hatırlat","Programı aç"]]);
  const plans=list.filter(item=>item.kind==="plan").map(item=>item.title.split(" · ")[0]);
  assert.deepEqual(plans,weekday>=3?["Ayşe Yılmaz","Mehmet Kaya","Zeynep Demir"]:[],"Ali'nin gelecek haftası dolu");
  assert.equal(doc.querySelector("#dashboardTodoCount").textContent,list.length+" iş");
});

test("v38 cevap bekleyen mesaj sayısı yan menüde, ana sayfada ve Mesajlar listesinde görünür",t=>{
  const {doc}=fixture(t,DEMO);
  for(const id of ["#coachNavMessageBadge","#dashboardMessageBadge"]){
    assert.equal(doc.querySelector(id).hidden,false);
    assert.equal(doc.querySelector(id).textContent,"2");
  }
  assert.equal(doc.querySelector('[data-message-student="a"] .coach-v38-pending').textContent,"2");
  assert.equal(doc.querySelector('[data-message-student="b"] .coach-v38-pending'),null);
});

test("v38 Hatırlat düzenlenebilir hazır metin açar, hiçbir şey kendiliğinden gönderilmez",t=>{
  const {w,doc}=fixture(t,DEMO);
  let sent=0;w.addDoc=async()=>{sent++;return{id:"x"}};
  doc.querySelector('[data-todo-action="remind"][data-todo-student="b"]').click();
  assert.equal(doc.querySelector("#messagesPage").classList.contains("hidden"),false);
  assert.equal(doc.querySelector("#messageChatName").textContent,"Mehmet Kaya");
  assert.equal(doc.querySelector("#messageInput").value,"Merhaba Mehmet, bugün 2 görevin kaldı. Takıldığın bir yer var mı?");
  assert.equal(sent,0);
  doc.querySelector('[data-coach-page="home"]').click();
  doc.querySelector('[data-todo-action="reply"][data-todo-student="a"]').click();
  assert.equal(doc.querySelector("#messageChatName").textContent,"Ayşe Yılmaz");
  assert.equal(doc.querySelector("#messageInput").value,"");
});

test("v38 bekleyen iş yoksa sakin bir boş durum gösterilir",t=>{
  const {doc}=fixture(t,"coachReportRows=[{studentUid:'z',link:{active:true},share:{profile:{name:'Ece'},updatedAt:new Date().toISOString(),progress:{},program:{weeks:[{week:shiftProgramWeek(programCurrentWeekStart(),1),data:{r:[['Deneme','','','','','','']]}}]}}}];renderCoachDashboard();");
  assert.equal(doc.querySelector("#dashboardTodo").textContent,"Bugün için bekleyen iş yok.");
  assert.equal(doc.querySelector("#coachNavMessageBadge").hidden,true);
});

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function cloud(w,{remote=null,fail=false}={}){
  const store={},writes=[];
  if(remote!==null)store["coachNotes/coach-1"]={text:remote};
  w.getDoc=async ref=>{const key=ref.parts.join("/");if(fail)throw Object.assign(new Error("izin"),{code:"permission-denied"});return{exists:()=>Boolean(store[key]),data:()=>store[key]}};
  w.setDoc=async(ref,data)=>{if(fail)throw Object.assign(new Error("izin"),{code:"permission-denied"});writes.push(data);store[ref.parts.join("/")]=data};
  return{store,writes};
}

test("v39 koç notları buluta kaydedilir ve tüm cihazlarda açılır; yer tutucu metin kaldırıldı",async t=>{
  const {w,doc}=fixture(t);
  assert.doesNotMatch(read("index.html"),/Panel sade tutuldu/);
  const {store}=cloud(w),input=doc.querySelector("#coachNotesInput");
  input.value="Mehmet: Cuma deneme sonrası konuş.";
  input.dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.equal(doc.querySelector("#coachNotesState").textContent,"Kaydediliyor…");
  w.__timer();await flush();
  assert.equal(store["coachNotes/coach-1"].text,"Mehmet: Cuma deneme sonrası konuş.");
  assert.deepEqual(Object.keys(store["coachNotes/coach-1"]).sort(),["text","updatedAt"]);
  assert.equal(w.localStorage.getItem("yks_coach_notes_v1:coach-1"),"Mehmet: Cuma deneme sonrası konuş.");
  assert.equal(doc.querySelector("#coachNotesState").textContent,"Kaydedildi");
  assert.equal(doc.querySelector("#coachNotesScope").textContent,"Tüm cihazlarında");
});

test("v39 başka cihazda yazılan not açılışta buluttan gelir",async t=>{
  const {w,doc}=fixture(t);
  cloud(w,{remote:"Zeynep velisini ara"});
  w.localStorage.setItem("yks_coach_notes_v1:coach-1","eski not");
  w.eval("loadCoachNotes()");await flush();
  assert.equal(doc.querySelector("#coachNotesInput").value,"Zeynep velisini ara");
  assert.equal(w.localStorage.getItem("yks_coach_notes_v1:coach-1"),"Zeynep velisini ara");
});

test("v39 yalnız bu cihazda olan eski not ilk açılışta buluta taşınır",async t=>{
  const {w}=fixture(t);
  const {writes}=cloud(w);
  w.localStorage.setItem("yks_coach_notes_v1:coach-1","cihazdaki not");
  w.eval("loadCoachNotes()");await flush();
  assert.deepEqual(writes.map(x=>x.text),["cihazdaki not"]);
});

test("v39 kural yayında değilken not kaybolmaz: bu cihazda saklanır",async t=>{
  const {w,doc}=fixture(t);
  cloud(w,{fail:true});
  const input=doc.querySelector("#coachNotesInput");
  input.value="kural yokken";input.dispatchEvent(new w.Event("input",{bubbles:true}));
  w.__timer();await flush();
  assert.equal(w.localStorage.getItem("yks_coach_notes_v1:coach-1"),"kural yokken");
  assert.equal(doc.querySelector("#coachNotesState").textContent,"Bu cihazda kaydedildi");
  assert.equal(doc.querySelector("#coachNotesScope").textContent,"Bu cihazda saklanır");
});

test("v38 uzun listede ilk 6 iş görünür, gerisi düğmeyle açılır",t=>{
  const many=Array.from({length:8},(_,i)=>"{studentUid:'s"+i+"',link:{active:true},share:{profile:{name:'Öğrenci "+i+"'},updatedAt:new Date().toISOString(),progress:{overdueTopics:1},program:{weeks:[]}}}").join(",");
  const {doc}=fixture(t,"coachReportRows=["+many+"];renderCoachDashboard();");
  const visible=()=>doc.querySelectorAll("#dashboardTodo .coach-v38-task").length;
  assert.equal(visible(),6);
  const more=doc.querySelector("[data-todo-more]");
  assert.match(more.textContent,/iş daha göster$/);
  more.click();
  assert.ok(visible()>6);
  assert.equal(doc.querySelector("[data-todo-more]").textContent,"Daha az göster");
});
