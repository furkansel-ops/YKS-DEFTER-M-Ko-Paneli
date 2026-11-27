const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-composer-v87.css");

// Pzt 1 görev, Cum 3 görev, diğer günler boş; Matematik'te iki eksik konu, biri HTML içerir.
const DEMO=`
  const wk=programCurrentWeekStart();
  const grid=[["Matematik · Problemler · 40 soru","","","","Türkçe · Paragraf · 20 soru","",""],["","","","","Kimya · Mol","",""],["","","","","Fizik · Kuvvet","",""]];
  coachReportRows=[{studentUid:"a",link:{id:"l",active:true},share:{profile:{name:"Ayşe"},updatedAt:new Date().toISOString(),progress:{},
    errorJournal:[{subject:"Matematik",topic:"Problemler",n:6},{subject:"TYT Matematik",topic:"<b>Üslü</b>",n:2},{subject:"Fizik",topic:"Kuvvet",n:9}],
    program:{rowLabels:{s:["Ders","Ders","Ders"]},weeks:[{week:wk,data:{s:grid}}]}}}];
  hydrateProgramStudents();showCoachPage("programs");renderProgramWorkspace();openProgramTaskModal("",{date:wk});
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
  return{w,doc:w.document};
}

test("v87 günlerde mevcut görev sayısı; 'Boş günler' yalnız boş günleri seçer",t=>{
  const {doc}=fixture(t);
  const loads=[...doc.querySelectorAll("#programTaskDayGrid .coach-v87-load")].map(n=>n.textContent);
  assert.deepEqual(loads,["1 görev","boş","boş","boş","3 görev","boş","boş"]);
  assert.ok(doc.querySelectorAll("#programTaskDayGrid button")[4].classList.contains("is-busy"));
  doc.getElementById("programDaysEmpty").click();
  assert.deepEqual([...doc.querySelectorAll("#programTaskDayGrid button")].map(b=>b.getAttribute("aria-pressed")),["false","true","true","true","false","true","true"]);
});

test("v87 eksik konu ve hazır sayı düğmeleri alanı doldurur, metin kendiliğinden oluşur",t=>{
  const {w,doc}=fixture(t);
  doc.querySelector('[data-v45-subject="Matematik"]').click();
  const weak=[...doc.querySelectorAll("#coachV87Weak [data-v87-topic]")];
  assert.deepEqual(weak.map(b=>b.textContent),["Problemler · 6 yanlış","<b>Üslü</b> · 2 yanlış"],"TYT öneki aynı ders sayılır; Fizik gelmez");
  assert.equal(doc.querySelector("#coachV87Weak b"),null,"konu adı HTML olarak yazılmaz");
  weak[0].click();
  doc.querySelector('[data-v87-for="programBuilderCount"] [data-v87-value="40"]').click();
  assert.equal(doc.getElementById("programBuilderTopic").value,"Problemler");
  assert.equal(doc.getElementById("programBuilderCount").value,"40");
  assert.match(doc.getElementById("programTaskText").value,/Problemler.*40 soru/);
});

test("v87 önizleme: öğrencinin göreceği kart, haftanın çubukları ve dolu gün uyarısı",t=>{
  const {doc}=fixture(t);
  doc.querySelector('[data-v45-subject="Matematik"]').click();
  doc.getElementById("programDaysClear").click();
  doc.querySelectorAll("#programTaskDayGrid button")[4].click();
  const preview=doc.getElementById("coachV87Preview");
  assert.equal(preview.querySelector(".coach-v87-card").dataset.subject,"math");
  const friday=preview.querySelectorAll(".coach-v87-pips>div")[4];
  assert.ok(friday.classList.contains("is-picked"));
  assert.equal(friday.querySelectorAll("i").length,4,"3 mevcut + 1 yeni");
  assert.equal(friday.querySelectorAll("i.is-new").length,1);
  assert.match(preview.querySelector(".coach-v87-summary").textContent,/^1 güne gider: Cum \d+\. Cum zaten 3\+ görevle dolu\.$/);
  assert.ok(preview.querySelector(".coach-v87-summary").classList.contains("is-warn"));
});

test("v87 stilleri: tema değişkenleri, ders renkleri belirteç yedeğiyle; düzenlemede önizleme gizli",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-composer-v87\.css\?v=1\.0\.0">/);
  assert.deepEqual(css.replace(/var\(--kc-[0-9a-f]{6},#[0-9a-f]{6}\)/g,"").match(/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/gi)||[],[]);
  assert.match(css,/#programTaskBackdrop\[data-editing\] \.coach-v87-preview/);
  for(const size of css.match(/font-size:[\d.]+px/g)||[])assert.ok(parseFloat(size.slice(10))>=11,size);
});
