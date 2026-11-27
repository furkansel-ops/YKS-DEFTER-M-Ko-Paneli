const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-programs-v86.css");

// Bu hafta 5 görev (Matematik 2, Türkçe 1, Kimya 1, Deneme 1), 2'si bitti; Ali'nin yalnız eski haftası var.
const DEMO=`
  const wk=programCurrentWeekStart(),old=shiftProgramWeek(wk,-3);
  const grid=[["Matematik · Problemler · 40 soru","Kimya · Mol kavramı · 30 soru","Deneme · TYT genel deneme · 120 soru","","","",""],
    ["Türkçe · Paragraf · 20 soru","Matematik · <b>Türev</b> videosu","","","","",""]];
  coachReportRows=[
    {studentUid:"a",link:{id:"l-a",active:true},share:{profile:{name:"Ayşe"},updatedAt:new Date().toISOString(),progress:{},
      program:{rowLabels:{s:["Ders","Ders"]},weeks:[{week:wk,data:{s:grid,dn:{"s-0-0":1,"s-1-0":1}}}]}}},
    {studentUid:"b",link:{id:"l-b",active:true},share:{profile:{name:"Ali"},updatedAt:new Date().toISOString(),progress:{},
      program:{rowLabels:{s:["Ders"]},weeks:[{week:old,data:{s:[["Fizik · 10 soru","","","","","",""]],dn:{"s-0-0":1}}}]}}}
  ];
  hydrateProgramStudents();showCoachPage("programs");renderProgramWorkspace();
`;

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window;w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:"coach-1"}}),getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:()=>({}),doc:()=>({}),serverTimestamp:()=>({}),getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+DEMO+"}");
  return{w,doc:w.document};
}

test("v86 şerit: bitti/toplam, çubuk ve ders ders bitti/toplam",t=>{
  const {doc}=fixture(t);
  const strip=doc.getElementById("coachV86Strip");
  assert.equal(strip.querySelector(".coach-v86-total b").textContent,"2/5");
  assert.equal(strip.querySelector(".coach-v86-bar").getAttribute("aria-valuenow"),"40");
  assert.equal(strip.querySelector(".coach-v86-bar i").getAttribute("style"),"width:40%");
  assert.deepEqual([...strip.querySelectorAll(".coach-v86-chip")].map(c=>c.dataset.subject+" "+c.textContent),
    ["math Matematik 1/2","exam Deneme 0/1","chemistry Kimya 0/1","reading Türkçe 1/1"]);
  assert.equal(doc.querySelectorAll("#coachV15Overview .coach-v15-stat").length,4,"eski kartlar DOM'da kalır, CSS gizler");
});

test("v86 gün başlığı: büyük tarih ve soru toplamı; görev metni kaçışlı",t=>{
  const {doc}=fixture(t);
  const monday=doc.querySelector('.coach-v6-day[data-day="0"] .coach-v6-day-head');
  const start=doc.defaultView.eval("programCurrentWeekStart()");
  assert.equal(monday.querySelector(".coach-v86-dn").textContent,String(Number(start.slice(8,10))));
  assert.equal(monday.querySelector(".coach-v86-q").textContent,"60 soru");
  assert.match(monday.textContent,/Pazartesi/);assert.match(monday.textContent,/Gün tamamlandı/);
  const tuesday=doc.querySelector('.coach-v6-day[data-day="1"] .coach-v6-day-head');
  assert.equal(tuesday.querySelector(".coach-v86-q").textContent,"30 soru","video görevinde soru yok");
  assert.equal(doc.querySelector('.coach-v6-day[data-day="3"] .coach-v86-q'),null,"boş günde soru yazılmaz");
  assert.equal(doc.querySelector('.coach-v6-day[data-day="1"] .coach-v6-task-copy b'),null,"görev metni HTML olarak yazılmaz");
});

test("v86 öğrenci seçici bu haftayı gösterir; eski haftanın uyumu yazılmaz",t=>{
  const {doc}=fixture(t);
  assert.deepEqual([...doc.querySelectorAll("#programStudentSelect option")].map(o=>o.textContent),["Ayşe · bu hafta 2/5","Ali · bu hafta boş"]);
  doc.getElementById("programStudentSelect").value="b";doc.getElementById("programStudentSelect").dispatchEvent(new doc.defaultView.Event("change"));
  assert.equal(doc.querySelector("#coachV86Strip .coach-v86-empty").textContent,"Bu hafta henüz görev yok. Çalışma ekle ya da Toplu yaz ile başla.");
});

test("v86 stilleri: eski kartlar gizli, ders renkleri belirteçten; ham renk yalnız belirteç yedeğinde",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-programs-v86\.css\?v=1\.0\.0">/);
  assert.match(css,/#programsPage \.coach-v15-overview\{display:none\}/);
  assert.deepEqual(css.replace(/var\(--kc-[0-9a-f]{6},#[0-9a-f]{6}\)/g,"").match(/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/gi)||[],[]);
  assert.match(css,/\[data-task-completed="true"\] \.coach-v6-task-copy>span\{[^}]*text-decoration:line-through/);
  assert.match(css,/#programsPage #coachVisualWeekBoard \.coach-v11-day-footer\{display:none!important\}/,"günlerin altında Ekle yok");
});
