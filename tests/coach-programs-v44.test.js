const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-programs-v44.css");
const TODAY=(new Date().getDay()+6)%7,OTHER=TODAY===0?1:0;

// Mehmet: bu hafta yalnız bugün 3 görev, 1'i tamam.
const DEMO=`
  const wk=programCurrentWeekStart(),day=${TODAY},now=new Date().toISOString();
  const rows=()=>[0,1,2].map(i=>Array.from({length:7},(_,d)=>d===day?["Problemler 40 soru","Mol kavramı tekrar","20 paragraf"][i]:""));
  coachReportRows=[{studentUid:"b",link:{id:"l-b",active:true,coachUid:"coach-1"},share:{profile:{name:"Mehmet Kaya"},updatedAt:now,progress:{},
    program:{rowLabels:{r:["TYT Matematik","TYT Kimya","Paragraf"]},weeks:[{week:wk,data:{r:rows(),dn:{["r-0-"+day]:1}}}]}}}];
  selectedProgramStudentUid="b";selectedProgramWeekStart="";
  hydrateProgramStudents();renderProgramWorkspace();
`;

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}};
  w.innerWidth=375;
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
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+DEMO+"}");
  return{w,doc:w.document};
}
const picked=doc=>[...doc.querySelectorAll("#coachVisualWeekBoard .coach-v14-week>.coach-v14-day.is-picked")].map(node=>node.dataset.day);
const pressed=doc=>[...doc.querySelectorAll("[data-coach-v44-day]")].filter(node=>node.getAttribute("aria-pressed")==="true").map(node=>node.dataset.coachV44Day);

test("v44 stil dosyası yüklenir; önbellek etiketi yenilendi; ⋯ düğmesi işlemlerin sonunda",()=>{
  const html=read("index.html");
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-programs-v44\.css\?v=1\.0\.\d+">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-students43-programs44[^"]*"/);
  assert.match(html,/id="programBulkTasksBtn"[^>]*>▤ Toplu Görev Yaz<\/button>\s*<button type="button" class="program-secondary coach-v44-more" id="programMoreBtn" aria-expanded="false"/);
});

test("v44 3: sayı kutuları telefonda kısa etiket taşır",t=>{
  const {doc}=fixture(t);
  const shorts=[...doc.querySelectorAll("#coachV15Overview .coach-v15-stat")].map(node=>node.dataset.short+" "+node.querySelector("strong").textContent);
  assert.deepEqual(shorts,["görev 3","ilerleme 33%","ders 3","günlük 0,4"]);
});

test("v44 5: gün şeridi 7 gün; açılışta bugün seçili, her günde durum yazar",t=>{
  const {doc}=fixture(t);
  const strip=[...doc.querySelectorAll("[data-coach-v44-day]")];
  assert.equal(strip.length,7);
  assert.deepEqual(pressed(doc),[String(TODAY)]);
  assert.deepEqual(picked(doc),[String(TODAY)]);
  assert.equal(strip[TODAY].querySelector("small").textContent,["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"][TODAY]);
  assert.equal(strip[TODAY].querySelector("em").textContent,"1/3");
  assert.equal(strip[OTHER].querySelector("em").textContent,"—");
  assert.ok(strip[TODAY].classList.contains("is-today"));
  assert.match(strip[TODAY].getAttribute("aria-label"),/ · 1\/3 tamamlandı$/);
});

test("v44 5: güne dokunmak o günü açar; aynı haftada yenilenince seçim kalır, hafta değişince sıfırlanır",t=>{
  const {doc}=fixture(t);
  doc.querySelector('[data-coach-v44-day="'+OTHER+'"]').click();
  assert.deepEqual(picked(doc),[String(OTHER)]);assert.deepEqual(pressed(doc),[String(OTHER)]);
  doc.getElementById("programCurrentWeek").click();
  assert.deepEqual(picked(doc),[String(OTHER)],"aynı hafta yeniden çizilince seçili gün korunur");
  doc.getElementById("programNextWeek").click();
  assert.deepEqual(picked(doc),["0"],"boş haftada Pazartesi açılır");
  doc.getElementById("programPrevWeek").click();
  assert.deepEqual(picked(doc),[String(TODAY)],"bu haftaya dönünce yine bugün");
});

test("v44 4: ⋯ menüsü açılır; seçilince, dışarı dokununca ve Esc ile kapanır",t=>{
  const {w,doc}=fixture(t);
  const box=doc.querySelector("#programsPage .coach-v15-actions"),more=doc.getElementById("programMoreBtn");
  more.click();
  assert.ok(box.classList.contains("is-more-open"));assert.equal(more.getAttribute("aria-expanded"),"true");
  doc.getElementById("programTemplatesBtn").click();
  assert.equal(box.classList.contains("is-more-open"),false,"seçilince kapanır");
  assert.equal(doc.getElementById("programTemplatePopover").classList.contains("hidden"),false,"Şablonlar yine açılır");
  more.click();doc.querySelector("#programsPage h1").click();
  assert.equal(box.classList.contains("is-more-open"),false,"dışarı dokunmak kapatır");
  more.click();doc.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  assert.equal(box.classList.contains("is-more-open"),false);assert.equal(doc.activeElement,more);
});

test("v44 stilleri: telefonda kısa başlık, tek kart, tek sıra sayı ve işlem, gün şeridi ve tek gün",()=>{
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*#programsPage :is\(\.coach-v15-breadcrumb,\.coach-v15-title-icon,#coachV15Subtitle\)\{display:none\}/);
  assert.match(css,/#programsPage \.coach-v15-overview\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/#programsPage :is\(#programTemplatesBtn,#programAddVideoBtn\)\{display:none;/);
  assert.match(css,/\.coach-v14-week\.coach-v44-week:not\(\[data-layout="list"\]\)>\.coach-v14-day:not\(\.is-picked\)\{display:none\}/);
  assert.match(css,/#programsPage \.coach-v44-more,#programsPage \.coach-v44-daystrip\{display:none\}/,"masaüstünde şerit ve ⋯ yok");
});

test("v44 6: mor anahtarlar panelin rengine bağlanır; ders renkleri kalır",()=>{
  assert.match(css,/:is\(#programsPage,#programTaskBackdrop,#coachVideoPickerBackdrop,#coachV10Bulk\)\{/);
  assert.match(css,/--kc-6553ee:var\(--k-accent\);/);
  assert.match(css,/--kc-f7f5ff:color-mix\(in srgb,var\(--k-accent\) 7%,var\(--k-surface\)\);/);
  assert.doesNotMatch(css,/--kc-9955dd:/,"Geometri rengi kalır");
  assert.doesNotMatch(css,/--kc-8253ee:/,"sayı kutusu simgesi kendi rengini korur");
});

test("v44 stilleri yalnız tema değişkenleri ve en az 11px yazı kullanır",()=>{
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});
