const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-templates-v88.css");

const DEMO=`
  const wk=programCurrentWeekStart();
  coachReportRows=[{studentUid:"a",link:{id:"l",active:true},share:{profile:{name:"Ayşe"},updatedAt:new Date().toISOString(),progress:{},
    program:{rowLabels:{s:["Ders"]},weeks:[{week:wk,data:{s:[["Koç · Matematik · Problemler · 40 soru","","Türkçe · <b>Paragraf</b>","","","",""]]}}]}}}];
  hydrateProgramStudents();showCoachPage("programs");renderProgramWorkspace();
`;
function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window;w.innerWidth=1440;w.__sent=[];
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:"coach-1"}}),getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:()=>({}),serverTimestamp:()=>"NOW",getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async(c,d)=>{w.__sent.push([c.name,d]);return{id:"a"}},signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+DEMO+"}");
  return{w,doc:w.document};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test("v88 hazır şablonlar: ders, gün çubuğu, görev sayısı; pencere body altında",t=>{
  const {doc}=fixture(t);
  doc.getElementById("programTemplatesBtn").click();
  const pop=doc.getElementById("programTemplatePopover");
  assert.equal(pop.parentElement,doc.body);assert.equal(pop.classList.contains("hidden"),false);
  const cards=[...pop.querySelectorAll(".coach-v88-card")];
  assert.equal(cards.length,6);
  const problem=cards.find(c=>c.querySelector("h4").textContent==="Problem kampı");
  assert.equal(problem.dataset.subject,"math");
  assert.deepEqual([...problem.querySelectorAll(".coach-v88-days i")].map(i=>i.className),["on","","on","","on","",""]);
  assert.equal(problem.querySelector(".coach-v88-top small").textContent,"3 gün · 3 görev");
  const deneme=cards.find(c=>c.querySelector("h4").textContent==="Deneme + analiz");
  assert.equal(deneme.querySelector("[data-v88-edit]"),null,"farklı metinli şablonda yalnız Haftaya ekle");
});

test("v88 Haftaya ekle: her gün için Çalışma ekle ile aynı coachingActions kaydı",async t=>{
  const {w,doc}=fixture(t);
  doc.getElementById("programTemplatesBtn").click();
  doc.querySelector('[data-v88-add="problem"]').click();await tick();await tick();await tick();
  const wk=w.eval("programCurrentWeekStart()"),day=n=>w.eval("programDayDate('"+wk+"',"+n+")");
  assert.deepEqual(w.__sent.map(([name,d])=>[name,d.type,d.studentUid,d.coachUid,d.status,d.payload.date,d.payload.text]),[0,2,4].map(n=>["coachingActions","program_task","a","coach-1","pending",day(n),"Matematik · Problemler · 40 soru"]));
  assert.match(doc.getElementById("coachV88Status").textContent,/^3 görev .* haftasına gönderildi/);
});

test("v88 Düzenleyip ekle Çalışma ekle'yi metin ve günlerle açar",t=>{
  const {doc}=fixture(t);
  doc.getElementById("programTemplatesBtn").click();
  doc.querySelector('[data-v88-edit="problem"]').click();
  assert.equal(doc.getElementById("programTemplatePopover").classList.contains("hidden"),true);
  assert.equal(doc.getElementById("programTaskBackdrop").classList.contains("hidden"),false);
  assert.equal(doc.getElementById("programTaskText").value,"Matematik · Problemler · 40 soru");
  assert.deepEqual([...doc.querySelectorAll("#programTaskDayGrid button")].map(b=>b.getAttribute("aria-pressed")),["true","false","true","false","true","false","false"]);
});

test("v88 Kendi şablonlarım: hafta kaydedilir (Koç öneki atılır, metin kaçışlı), silinir",t=>{
  const {w,doc}=fixture(t);
  doc.getElementById("programTemplatesBtn").click();
  doc.querySelector('[data-v88-tab="mine"]').click();
  doc.getElementById("coachV88Name").value="Normal hafta";
  doc.getElementById("coachV88SaveWeek").click();
  const saved=JSON.parse(w.localStorage.getItem("yks_coach_templates_v88"));
  assert.deepEqual(saved[0].tasks,[{day:0,text:"Matematik · Problemler · 40 soru"},{day:2,text:"Türkçe · <b>Paragraf</b>"}]);
  assert.equal(saved[0].title,"Normal hafta");
  const card=doc.querySelector("#coachV88Grid .coach-v88-card");
  assert.equal(card.querySelector("b"),null,"görev metni HTML olarak yazılmaz");
  assert.equal(doc.getElementById("coachV88MineCount").textContent,"1");
  card.querySelector("[data-v88-delete]").click();
  assert.deepEqual(JSON.parse(w.localStorage.getItem("yks_coach_templates_v88")),[]);
});

test("v88 stilleri: tema değişkenleri, ders renkleri belirteç yedeğiyle",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-templates-v88\.css\?v=1\.0\.0">/);
  assert.deepEqual(css.replace(/var\(--kc-[0-9a-f]{6},#[0-9a-f]{6}\)/g,"").match(/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/gi)||[],[]);
  assert.match(css,/#programTemplatePopover\.coach-v88-templates\{position:fixed;inset:0/);
});
