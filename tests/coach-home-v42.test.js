const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-home-v42.css");

// Mehmet: bugün 1/3 görev (Hatırlat + Programı aç) · Ayşe: hedefte.
const DEMO=`
  const wk=programCurrentWeekStart(),day=(new Date().getDay()+6)%7,now=new Date().toISOString();
  const rows=()=>[0,1,2].map(i=>Array.from({length:7},(_,d)=>d===day?["Problemler 40 soru","Mol kavramı","20 paragraf"][i]:""));
  const share=(name,dn)=>({profile:{name},updatedAt:now,progress:{overdueTopics:0,minutes7:240},program:{weeks:[{week:wk,data:{r:rows(),dn}}]}});
  const link={active:true};
  coachReportRows=[
    {studentUid:"a",link,share:share("Ayşe Yılmaz",{["r-0-"+day]:1,["r-1-"+day]:1,["r-2-"+day]:1})},
    {studentUid:"b",link,share:share("Mehmet Kaya",{["r-0-"+day]:1})}
  ];
  renderCoachDashboard();renderDashboardDayReviews();
`;

function fixture(t,extra="",wide=false){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}};
  w.innerWidth=wide?1440:375;
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
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}},
    matchMedia:query=>({matches:wide&&/min-width:1201px/.test(query),addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+extra+"}");
  return{w,doc:w.document};
}

test("v42 stil dosyası yüklenir; app-reset önbellek etiketi yenilendi",()=>{
  const html=read("index.html");
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-home-v42\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-appt41-r4-home42"/);
  for(const short of ["öğrenci","tamamlanan","kontrol","haftalık"])assert.ok(html.includes('data-short="'+short+'"'),short);
});

test("v42 3: satırın düğme dışına dokunmak ikinci işi (Programı aç) açar; tek düğmeli işte ana işi",t=>{
  const {doc}=fixture(t,DEMO);
  const warn=[...doc.querySelectorAll("#dashboardTodo .coach-v38-task")].find(node=>node.dataset.todoKind==="warn");
  assert.ok(warn,"Mehmet'in kalan görevi listede");
  warn.querySelector(".coach-v38-task-copy").click();
  assert.equal(doc.querySelector("#programsPage").classList.contains("hidden"),false,"ikinci iş: program açılır");
});

test("v42 4: öğrenci satırı Bugünün Akışı'ndaki son 7 gün süresini taşır",t=>{
  const {doc}=fixture(t,DEMO);
  const rows=[...doc.querySelectorAll(".dashboard-student-row small")].map(node=>node.textContent);
  assert.ok(rows.length>=2);
  for(const row of rows)assert.match(row,/ · 7 günde /);
});

test("v42 6: gün sonu notu yokken panel tek satıra iner",t=>{
  const {doc}=fixture(t,DEMO);
  assert.equal(doc.querySelector(".day-review-panel").classList.contains("is-empty"),true);
  assert.match(css,/\.day-review-panel\.is-empty :is\(\.panel-title p,\.panel-title button,#dashboardDayReviewSummary\)\{display:none\}/);
});

test("v42 7: koç notları telefonda kapalı, geniş ekranda açık başlar; kapalıyken ilk satır başlıkta",t=>{
  const {w,doc}=fixture(t,DEMO);
  const body=doc.querySelector("#coachNotesBody"),toggle=doc.querySelector("#coachNotesToggle");
  assert.equal(body.hidden,true);assert.equal(toggle.getAttribute("aria-expanded"),"false");assert.equal(toggle.textContent,"Aç");
  toggle.click();
  assert.equal(body.hidden,false);assert.equal(toggle.textContent,"Kapat");
  const input=doc.querySelector("#coachNotesInput");
  input.value="\n  Mehmet: Cuma deneme sonrası konuş\nAyşe: paragraf";input.dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.equal(doc.querySelector("#coachNotesPreview").textContent,"Mehmet: Cuma deneme sonrası konuş");
  input.value="x".repeat(80);input.dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.equal(doc.querySelector("#coachNotesPreview").textContent,"x".repeat(59)+"…");
  doc.querySelector(".coach-v36-note .panel-title h2").click();
  assert.equal(body.hidden,true,"başlığa dokunmak da kapatır");
  const wide=fixture(t,DEMO,true);
  assert.equal(wide.doc.querySelector("#coachNotesBody").hidden,false,"geniş ekranda açık");
});

test("v42 4 · 5 · stiller: Bugünün Akışı ve Hızlı İşlemler gizli; telefonda tek sıra sayı, tek satır iş",()=>{
  assert.match(css,/#homePage \.dashboard-grid>\.coach-v36-flow,#homePage \.dashboard-grid>\.coach-v36-quick\{display:none\}/);
  assert.match(css,/@media\(max-width:600px\)\{[\s\S]*#homePage \.coach-v36-top \.dashboard-stats\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/#homePage \.coach-v36-top \.stat-card::after\{content:attr\(data-short\)/);
  assert.match(css,/#homePage \.coach-v38-task\{grid-template-columns:32px minmax\(0,1fr\) auto;/);
  assert.match(css,/button:not\(\.primary\)::after\{content:"›";/);
  assert.match(css,/#homePage \.dashboard-student-row>strong\{display:none\}/);
});

test("v42 stilleri yalnız tema değişkenleri ve en az 11px yazı kullanır",()=>{
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});
