const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function fixture(t,{goals=true}={}){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},errors=[];
  w.innerWidth=375;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),serverTimestamp:()=>"NOW",
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{const d=o=>paragraphProblemDateOffset(o),e=[];let n=0;const add=(o,kind,c,wr,b,extra={})=>e.push({id:"e"+(n++),date:d(o),kind,correct:c,wrong:wr,blank:b,createdAt:1000+n,...extra});
  add(0,"paragraph",18,3,0,{minutes:26});add(0,"problem",7,4,1,{minutes:20,topic:"Hareket"});
  add(-1,"problem",9,1,0,{minutes:18,topic:"Yaş"});add(-2,"paragraph",20,2,0);add(-3,"problem",4,6,0,{topic:"Hareket"});
  add(-9,"paragraph",15,5,0);add(-10,"problem",3,3,0,{topic:"İşçi"});
  for(let i=0;i<10;i++)add(-15-i,"paragraph",10,0,0);
  coachReportRows=[{studentUid:"elif",link:{id:"l1",active:true},share:{profile:{name:"Elif Yılmaz"},updatedAt:new Date().toISOString(),paragraphProblem:{entries:e${goals?",goals:{paragraph:30,problem:20}":""}},program:{weeks:[]}}}];
  hydrateParagraphProblemControls();renderParagraphProblem("elif");}`);
  return{w,doc:w.document,errors};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};

test("v57 Bugün kartı: hedefe göre soru, doğruluk ve süre; hafta toplamı, hız; eski kartlar gizli",t=>{
  const {doc,errors}=fixture(t);
  assert.equal(doc.getElementById("paragraphProblemPage").dataset.v57,"on");
  const body=doc.getElementById("ppV57Body");assert.equal(body.hidden,false);
  const today=body.querySelector(".pp-v57-card");
  assert.equal(text(today),"Bugün hedef %66 Paragraf %86 · 26 dk 21 / 30 Problem %58 · 20 dk 12 / 20 Bu hafta 75 / 350 Doğruluk %77 Hız 0,7 soru/dk");
  assert.equal(today.querySelector(".pp-v57-kind.paragraph .pp-v57-bar b").style.width,"70%");
  assert.deepEqual(errors,[]);
});

test("v57 7/30 gün: grafik gün sayısı, hedef çizgisi, önceki döneme göre fark",t=>{
  const {doc}=fixture(t);
  const body=doc.getElementById("ppV57Body");
  assert.equal(body.querySelectorAll(".pp-v57-chart>div").length,7);
  assert.ok(body.querySelector(".pp-v57-goal"));
  assert.match(text(body.querySelector(".pp-v57-cmp")),/^Önceki 7 güne göre Soru \+49 Doğruluk \+8,1 puan Aktif gün \+2$/);
  body.querySelector('[data-pp-v57-period="30"]').click();
  assert.equal(body.querySelectorAll(".pp-v57-chart>div").length,30);
  assert.match(text(body.querySelector(".pp-v57-cmp")),/Önceki 30 güne göre önceki dönem verisi yok/);
});

test("v57 zayıf problem türleri ve görev: program penceresi Matematik · Problemler · tür ve hedef sayısıyla açılır",t=>{
  const {doc}=fixture(t);
  const body=doc.getElementById("ppV57Body"),types=[...body.querySelectorAll(".pp-v57-list>div")];
  assert.deepEqual(types.map(x=>x.querySelector("b").textContent),["Hareket","İşçi","Yaş"]);
  assert.match(text(types[0]),/Hareket %50 doğru 22 soru · 10 yanlış Görev ver/);
  assert.equal(types[2].querySelector("[data-pp-v57-assign]"),null,"iyi giden türde görev düğmesi yok");
  types[0].querySelector("[data-pp-v57-assign]").click();
  assert.equal(doc.getElementById("programTaskBackdrop").classList.contains("hidden"),false);
  assert.equal(doc.getElementById("programBuilderSubject").value,"Matematik");
  assert.equal(doc.getElementById("programBuilderTopic").value,"Problemler · Hareket");
  assert.equal(doc.getElementById("programBuilderCount").value,"20");
  assert.equal(doc.getElementById("programBuilderActivity").value,"Soru çözümü");
});

test("v57 kayıt defteri son 10, Tümü ile hepsi; hedef yoksa çubuk yok, 'hedef girilmemiş'",t=>{
  const {doc}=fixture(t,{goals:false});
  const body=doc.getElementById("ppV57Body");
  assert.equal(body.querySelectorAll(".pp-v57-history>div").length,10);
  assert.match(text(body.querySelector(".pp-v57-history>div")),/^Problem Bugün Hareket · 20 dk 7D 4Y 1B$/);
  body.querySelector("[data-pp-v57-history]").click();
  assert.equal(body.querySelectorAll(".pp-v57-history>div").length,17);
  assert.match(text(body.querySelector(".pp-v57-card")),/^Bugün hedef girilmemiş Paragraf %86 · 26 dk 21 Problem/);
  assert.equal(body.querySelector(".pp-v57-bar"),null);
  body.querySelector('[data-pp-v57-assign="paragraph"]').click();
  assert.equal(doc.getElementById("programBuilderSubject").value,"Paragraf");assert.equal(doc.getElementById("programBuilderCount").value,"30");
});

test("v57 dosyalar: stil ve sürüm iğnesi; ham renk yok",()=>{
  const html=read("index.html"),css=read("paragraph-problem-v57.css");
  assert.match(html,/<link rel="stylesheet" href="\.\/paragraph-problem-v57\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-messages56-pp57-settings58"/);
  assert.doesNotMatch(css.replace(/var\(--kc-[\w-]+,[^)]*\)/g,""),/#[0-9a-f]{3,8}\b/i);
});
