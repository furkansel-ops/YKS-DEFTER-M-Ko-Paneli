const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-bulk-v90.css");

// Pazartesi'de zaten 1 görev var.
const DEMO=`
  const wk=programCurrentWeekStart();
  coachReportRows=[{studentUid:"a",link:{id:"l",active:true},share:{profile:{name:"Ayşe"},updatedAt:new Date().toISOString(),progress:{},
    program:{rowLabels:{s:["Ders"]},weeks:[{week:wk,data:{s:[["Kimya · Mol","","","","","",""]]}}]}}}];
  hydrateProgramStudents();showCoachPage("programs");renderProgramWorkspace();coachV35Open();
`;
function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window;w.innerWidth=1440;w.__sent=[];
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:"coach-1"}}),getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:()=>({}),doc:()=>({}),serverTimestamp:()=>({}),getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async(c,d)=>{w.__sent.push(d);return{id:"a"}},signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+DEMO+"}");
  const bulk=w.document.getElementById("coachV10Bulk");
  const set=(i,field,value)=>{const el=bulk.querySelector('[data-v35-row="'+i+'"] [data-v35-field="'+field+'"]');el.value=value;el.dispatchEvent(new w.Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}))};
  const day=(i,d)=>bulk.querySelector('[data-v35-row="'+i+'"] [data-v35-day="'+d+'"]').click();
  return{w,doc:w.document,bulk,set,day};
}

test("v90 satır dersin renginde; haftanın görünümü yeni görevleri, mevcut sayıyı ve boş günleri söyler",t=>{
  const {bulk,set,day}=fixture(t);
  set(0,"subject","Matematik");set(0,"topic","Problemler");set(0,"count","40");day(0,0);day(0,2);
  assert.equal(bulk.querySelector('[data-v35-row="0"]').dataset.subject,"math");
  const week=bulk.querySelector("[data-v90-week]");
  assert.ok(week.nextElementSibling.classList.contains("coach-v35-bottom"),"alt şeridin hemen üstünde");
  assert.equal(week.querySelector(".coach-v90-head small").textContent,"2 görev · 2 güne yayıldı · boş: Sal, Per, Cum, Cmt, Paz");
  const days=[...week.querySelectorAll(".coach-v90-days>div")];
  assert.equal(days[0].querySelector("small").textContent,"zaten 1 görev");
  assert.deepEqual([...days[0].querySelectorAll(".coach-v90-task")].map(n=>[n.dataset.subject,n.textContent]),[["math","MatematikProblemler · Soru çözümü · 40 soru"]]);
  assert.equal(days[1].querySelectorAll(".coach-v90-task").length,0);
});

test("v90 Taslak olarak sakla: görevler haftanın taslağına gider, öğrenciye gönderilmez; şerit görünür",t=>{
  const {w,doc,bulk,set,day}=fixture(t);
  const draft=bulk.querySelector("[data-v90-draft]");
  assert.equal(draft.disabled,true,"boşken kapalı");
  set(0,"subject","Türkçe");day(0,1);day(0,3);
  assert.equal(draft.disabled,false);
  draft.click();
  assert.equal(w.__sent.length,0,"öğrenciye hiçbir şey gitmedi");
  assert.equal(bulk.hidden,true);
  const key=Object.keys(w.sessionStorage).find(k=>k.startsWith("yks-coach-week-draft-v7:"));
  assert.deepEqual(JSON.parse(w.sessionStorage.getItem(key)).map(x=>[x.day,x.text]),[[1,"TYT Türkçe · Soru çözümü"],[3,"TYT Türkçe · Soru çözümü"]]);
  assert.equal(doc.querySelector("#programsPage [data-v7-send]").textContent,"Taslağı Gönder (2)");
  assert.match(css,/\.coach-v7-panel:has\(\[data-v7-send\]:not\(:disabled\)\)\{display:grid!important/);
});

test("v90 stilleri: tema değişkenleri, ders renkleri belirteç yedeğiyle",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-bulk-v90\.css\?v=1\.0\.0">/);
  assert.deepEqual(css.replace(/var\(--kc-[0-9a-f]{6},#[0-9a-f]{6}\)/g,"").match(/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/gi)||[],[]);
  for(const size of css.match(/font-size:[\d.]+px/g)||[])assert.ok(parseFloat(size.slice(10))>=11,size);
});
