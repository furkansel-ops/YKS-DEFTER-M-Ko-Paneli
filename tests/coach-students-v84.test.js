const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-students-v84.css");

// Ayşe: son 7 günde 3 gün çalıştı, önceki 7 günde daha az; bu hafta programı var; iki TYT; bir kitap.
// Ali: eski haftada programı var ama bu hafta yok; hiç çalışma yok, eşitleme 4 gün önce.
const DEMO=`
  const wk=programCurrentWeekStart(),old=shiftProgramWeek(wk,-2),day=(new Date().getDay()+6)%7,ago=n=>new Date(Date.now()-n*864e5).toISOString();
  const rows=()=>[0,1].map(i=>Array.from({length:7},(_,d)=>d===day?["Problemler","<b>Mol</b>"][i]:""));
  coachReportRows=[
    {studentUid:"a",link:{id:"l-a",active:true},share:{profile:{name:"Ayşe <i>Yılmaz</i>",track:"SAY",career:{tyt:{name:"Elmas I"}}},updatedAt:ago(0),
      exams:[{type:"TYT",date:"2026-10-01",totalNet:70},{type:"TYT",date:"2026-10-20",totalNet:74.5}],
      progress:{daily31:[{date:reportDateOffset(0),minutes:60},{date:reportDateOffset(-2),minutes:30},{date:reportDateOffset(-6),minutes:30},{date:reportDateOffset(-8),minutes:45}],
        books:[{name:"Paragraf",total:40,done:20,perTest:12}]},
      program:{weeks:[{week:wk,data:{r:rows(),dn:{["r-0-"+day]:1,["r-1-"+day]:1}}}]}}},
    {studentUid:"d",link:{id:"l-d",active:true},share:{profile:{name:"Ali Can",track:"EA"},updatedAt:ago(4),progress:{},
      program:{weeks:[{week:old,data:{r:rows(),dn:{["r-0-"+day]:1,["r-1-"+day]:1}}}]}}}
  ];
  renderStudentsPage();
`;

function fixture(t){
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
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+DEMO+"}");
  return{w,doc:w.document};
}
const text=node=>node.textContent.replace(/\s+/g," ").trim();

test("v84 satır kartı: son 7 gün, bu haftanın programı, son deneme, kitap; öğrenci metni kaçışlı",t=>{
  const {doc}=fixture(t);
  const a=doc.querySelector('[data-student-row="a"]');
  assert.equal(a.querySelector(".student-cell-main b").textContent,"Ayşe <i>Yılmaz</i>");
  assert.equal(a.querySelector(".student-cell-main i i"),null,"ad HTML olarak yazılmaz");
  assert.equal(text(a.querySelector(".student-cell-main small")),"SAY · TYT Elmas I");
  const bars=[...a.querySelectorAll(".coach-v84-spark i")];
  assert.equal(bars.length,7);
  assert.deepEqual(bars.map(i=>i.getAttribute("style")||i.className),["--h:50%","is-zero","is-zero","is-zero","--h:50%","is-zero","--h:100%"]);
  assert.equal(text(a.querySelector(".coach-v84-week b")),"2 sa");
  assert.equal(a.querySelector(".coach-v84-week small").textContent,"önceki 7 gün 45 dk");
  assert.equal(a.querySelector(".coach-v84-week small").className,"up");
  assert.deepEqual([...a.querySelectorAll(".coach-v84-program :is(b,small)")].map(text),["1/1","gün tamam"]);
  assert.equal(a.querySelector(".coach-v84-bar i").getAttribute("style"),"width:100%");
  const facts=[...a.querySelectorAll(".coach-v84-fact")].map(text);
  assert.deepEqual(facts,["TYT 74,5▲ 4,5","20/40test"],"b ve small ayrı satır");
});

test("v84 eski haftanın programı bu hafta sayılmaz; eski eşitleme uyarısı; dikkat isteyen önde",t=>{
  const {doc}=fixture(t);
  const d=doc.querySelector('[data-student-row="d"]');
  assert.equal(text(d.querySelector(".coach-v84-program")),"Program yok");
  assert.equal(d.querySelector(".student-v54-sync").textContent,"Veri eski · son eşitleme 4 gün önce");
  assert.ok(d.classList.contains("is-attention"));
  assert.deepEqual([...doc.querySelectorAll("#studentsList .coach-v84-row")].map(r=>r.dataset.studentRow),["d","a"]);
  assert.deepEqual([...d.querySelectorAll(".coach-v84-fact")].map(text),["Deneme yok","Kitap yok"]);
});

test("v84 düğmeler: Rapor · Program · Mesaj satırda, menüde öğrenci kartı ve kaldırma",t=>{
  const {doc}=fixture(t);
  const a=doc.querySelector('[data-student-row="a"]');
  assert.deepEqual([...a.querySelectorAll(".student-actions .coach-v84-act")].map(b=>b.textContent),["Rapor","Program","Mesaj"]);
  assert.deepEqual([...a.querySelectorAll(".students-v43-menu button")].map(b=>b.textContent),["▤ Öğrenci kartı","Panelden kaldır…"]);
  a.querySelector("[data-student-menu]").click();
  a.querySelector("[data-open-student]").click();
  assert.equal(doc.getElementById("studentCardModal").hidden,false);
  assert.equal(a.querySelector(".students-v43-menu").hidden,true,"kart açılınca menü kapanır");
  assert.equal(doc.querySelector(".students-summary"),null,"sayı kutuları kalktı");
  assert.equal([...doc.querySelectorAll(".students-table-head span")].map(s=>s.textContent).join("|"),"Öğrenci|Son 7 gün|Bu hafta program|Son deneme|Kitap|");
});

test("v84 stilleri: tema değişkenleri, en az 11px, hareket v68'e bağlı",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-students-v84\.css\?v=1\.0\.0">/);
  assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/i,"ham renk yok");
  for(const size of css.match(/font-size:[\d.]+px/g)||[])assert.ok(parseFloat(size.slice(10))>=11,size);
  assert.match(css,/\.coach-shell-reset #studentsPage\[data-motion-enter\] \.coach-v84-spark i\{animation:coach-v84-up/);
  assert.doesNotMatch(css.replace(/\[data-motion-enter\][^{]*\{[^}]*\}/g,""),/animation:/,"çubuk hareketi yalnız sayfa açılırken");
});
