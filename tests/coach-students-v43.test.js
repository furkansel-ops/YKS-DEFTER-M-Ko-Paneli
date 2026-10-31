const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-students-v43.css");

// Ayşe ve Mehmet bugün aktif (3/3, 1/3); Zeynep'in 3 geciken konusu var; Ali 4 gündür girmedi.
const DEMO=`
  const wk=programCurrentWeekStart(),day=(new Date().getDay()+6)%7,ago=n=>new Date(Date.now()-n*864e5).toISOString();
  const rows=()=>[0,1,2].map(i=>Array.from({length:7},(_,d)=>d===day?["Problemler 40 soru","Mol kavramı","20 paragraf"][i]:""));
  const share=(name,dn,opts={})=>({profile:{name,track:"Sayısal"},updatedAt:opts.updated||ago(0),progress:{overdueTopics:opts.overdue||0,minutes7:opts.min||0},program:{weeks:[{week:wk,data:{r:rows(),dn}}]}});
  const link=id=>({id,active:true,coachUid:"coach-1"});
  coachReportRows=[
    {studentUid:"a",link:link("l-a"),share:share("Ayşe Yılmaz",{["r-0-"+day]:1,["r-1-"+day]:1,["r-2-"+day]:1},{min:540})},
    {studentUid:"b",link:link("l-b"),share:share("Mehmet Kaya",{["r-0-"+day]:1},{min:240})},
    {studentUid:"c",link:link("l-c"),share:share("Zeynep Demir",{},{updated:ago(2),min:60,overdue:3})},
    {studentUid:"d",link:link("l-d"),share:share("Ali Can",{},{updated:ago(4)})}
  ];
  // loadCoachReports gibi rapor seçicisini doldur.
  $("reportStudentSelect").innerHTML='<option value="all">Tüm öğrenciler</option>'+coachReportRows.map(row=>'<option value="'+row.studentUid+'">'+studentName(row)+'</option>').join("");
  hydrateProgramStudents();renderStudentsPage();
`;

function fixture(t,extra=""){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}};
  w.innerWidth=375;w.__updates=[];w.__confirm=true;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    serverTimestamp:()=>({}),getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async(ref,data)=>{w.__updates.push({ref,data})},addDoc:async()=>({id:"action"}),
    signOut:async()=>{},alert:()=>{},confirm:()=>w.__confirm,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:fn=>{w.__timer=fn;return 1},clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+extra+"}");
  return{w,doc:w.document};
}
const names=doc=>[...doc.querySelectorAll("#studentsList .student-row .student-cell-main b")].map(node=>node.textContent);
const visible=(doc,id)=>!doc.getElementById(id).classList.contains("hidden");

test("v43 stil dosyası yüklenir; önbellek etiketi yenilendi; filtrelerde sayı, boş halde iki adım",()=>{
  const html=read("index.html");
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-students-v43\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-home42-students43"/);
  for(const id of ["studentsCountAll","studentsCountActive","studentsCountAttention","studentsHeadMeta"])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/<ol class="students-v43-steps">/);
  assert.match(html,/＋ <span class="students-v43-wide">Öğrenci <\/span>Ekle/);
});

test("v43 2 · 6: sayılar filtrelerde ve başlıkta; ilgilenilmesi gereken öğrenci üstte",t=>{
  const {doc}=fixture(t,DEMO);
  assert.deepEqual(["studentsCountAll","studentsCountActive","studentsCountAttention"].map(id=>doc.getElementById(id).textContent),["4","2","1"]);
  assert.equal(doc.getElementById("studentsHeadMeta").textContent,"4 öğrenci · bugün aktif 2");
  assert.deepEqual(names(doc),["Zeynep Demir","Ali Can","Mehmet Kaya","Ayşe Yılmaz"]);
  doc.querySelector('[data-student-filter="active"]').click();
  assert.deepEqual(names(doc),["Mehmet Kaya","Ayşe Yılmaz"],"filtre sırayı bozmaz");
});

test("v43 4: telefon satırı hafta, 7 gün ve son hareketi tek satırda taşır; eski tarih gün olarak yazılır",t=>{
  const {w,doc}=fixture(t,DEMO+`
    const y=new Date();y.setDate(y.getDate()-1);y.setHours(0,0,0,0);
    window.__dun=studentLastActivity({share:{updatedAt:y.toISOString()}});
  `);
  const lines=[...doc.querySelectorAll("#studentsList .students-v43-line>span:first-child")].map(node=>node.textContent);
  assert.deepEqual(lines,[
    "Bu hafta %0 · 7 günde 1 sa · 2 gün önce",
    "Bu hafta %0 · 7 günde 0 dk · 4 gün önce",
    "Bu hafta %33 · 7 günde 4 sa · az önce",
    "Bu hafta %100 · 7 günde 9 sa · az önce"
  ]);
  assert.equal(doc.querySelector('[data-student-row="b"] .students-v43-bar>i').getAttribute("style"),"width:33%");
  assert.equal(w.__dun,"Dün");
});

test("v43 5: ⋯ menüsü açılır, dışarı dokunmak ve Esc kapatır; işler doğru sayfayı açar",t=>{
  const {w,doc}=fixture(t,DEMO);
  const row=uid=>doc.querySelector('[data-student-row="'+uid+'"]');
  const more=row("b").querySelector("[data-student-menu]"),menu=row("b").querySelector(".students-v43-menu");
  assert.equal(menu.hidden,true);
  more.click();
  assert.equal(menu.hidden,false);assert.equal(more.getAttribute("aria-expanded"),"true");
  assert.equal(doc.activeElement.dataset.studentAct,"report","menü açılınca ilk işe odaklanır");
  doc.querySelector("#studentsPage h1").click();
  assert.equal(menu.hidden,true,"dışarı dokunmak kapatır");
  more.click();doc.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  assert.equal(menu.hidden,true,"Esc kapatır");assert.equal(doc.activeElement,more);

  more.click();menu.querySelector('[data-student-act="program"]').click();
  assert.ok(visible(doc,"programsPage"));assert.equal(doc.getElementById("programStudentSelect").value,"b");

  doc.querySelector('[data-coach-page="students"]').click();
  row("a").querySelector("[data-student-menu]").click();
  row("a").querySelector('[data-student-act="message"]').click();
  assert.ok(visible(doc,"messagesPage"));

  doc.querySelector('[data-coach-page="students"]').click();
  row("c").querySelector("[data-student-menu]").click();
  row("c").querySelector('[data-student-act="report"]').click();
  assert.ok(visible(doc,"reportsPage"));assert.equal(doc.getElementById("reportStudentSelect").value,"c");
});

test("v43 5: satıra dokunmak raporu açar; ⋯ düğmesi açmaz",t=>{
  const {doc}=fixture(t,DEMO);
  doc.querySelector('[data-coach-page="students"]').click();
  doc.querySelector('[data-student-row="d"] [data-student-menu]').click();
  assert.ok(visible(doc,"studentsPage"),"⋯ yalnız menüyü açar");
  doc.querySelector('[data-student-row="d"] .students-v43-line').click();
  assert.ok(visible(doc,"reportsPage"));assert.equal(doc.getElementById("reportStudentSelect").value,"d");
});

test("v43 5: \"Sil\" satırda durmaz; menüdeki \"Panelden kaldır…\" onay sorar, vazgeçilince dokunmaz",t=>{
  const {w,doc}=fixture(t,DEMO);
  assert.equal(doc.querySelector("#studentsList .student-actions [data-remove-student]"),null);
  const remove=doc.querySelector('[data-student-row="c"] .students-v43-menu [data-remove-student]');
  assert.equal(remove.textContent,"Panelden kaldır…");
  w.__confirm=false;remove.click();
  assert.equal(w.__updates.length,0);
  w.__confirm=true;remove.click();
  assert.deepEqual(w.__updates[0].ref.parts,["coachingLinks","l-c"]);
  assert.equal(w.__updates[0].data.active,false);
});

test("v43 7: öğrenci yokken sayfa tek karta iner",t=>{
  const {doc}=fixture(t,"coachReportRows=[];renderStudentsPage();");
  assert.equal(doc.getElementById("studentsPage").classList.contains("is-empty"),true);
  assert.equal(doc.getElementById("studentsHeadMeta").textContent,"Henüz öğrenci yok");
  assert.equal(doc.getElementById("studentsEmpty").classList.contains("hidden"),false);
  assert.match(css,/#studentsPage\.is-empty :is\(\.students-summary,\.students-toolbar,\.students-table-head\)\{display:none\}/);
  const full=fixture(t,DEMO);
  assert.equal(full.doc.getElementById("studentsPage").classList.contains("is-empty"),false);
});

test("v43 stilleri: telefonda kısa başlık, kartsız sayılar, iki satırlık öğrenci",()=>{
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*#studentsPage \.students-summary\{display:none\}/);
  assert.match(css,/#studentsPage \.students-head :is\(\.dashboard-eyebrow,p\)\{display:none\}/);
  assert.match(css,/grid-template-areas:"av main status more" "av line line more"/);
  assert.match(css,/#studentsPage :is\(\.student-program,\.student-last,\.student-open\)\{display:none\}/);
});

test("v43 stilleri yalnız tema değişkenleri ve en az 11px yazı kullanır",()=>{
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});
