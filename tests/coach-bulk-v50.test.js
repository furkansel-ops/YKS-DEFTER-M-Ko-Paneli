const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-bulk-v50.css");

const DEMO=`
  const wk=programCurrentWeekStart(),now=new Date().toISOString();
  coachReportRows=[{studentUid:"b",link:{id:"l-b",active:true,coachUid:"coach-1"},share:{profile:{name:"Mehmet Kaya"},updatedAt:now,progress:{},program:{weeks:[{week:wk,data:{r:[],dn:{}}}]}}}];
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
  const doc=w.document;
  doc.getElementById("programBulkTasksBtn").click();
  const bulk=doc.getElementById("coachV10Bulk");
  const row=i=>bulk.querySelector('[data-v35-row="'+i+'"]');
  const pick=(i,field,value)=>{const node=row(i).querySelector('[data-v35-field="'+field+'"]');node.value=value;node.dispatchEvent(new w.Event("change",{bubbles:true}))};
  return{w,doc,bulk,row,pick,open:()=>[...bulk.querySelectorAll("[data-v35-row]")].filter(node=>!node.classList.contains("is-collapsed")).map(node=>node.dataset.v35Row)};
}

test("v50 2: yeni satır açık gelir, öncekiler tek satır özete kapanır; özete dokununca o satır açılır",t=>{
  const {bulk,row,pick,open}=fixture(t);
  assert.deepEqual(open(),["0"]);
  pick(0,"subject","Matematik");
  row(0).querySelector('[data-v35-day="0"]').click();row(0).querySelector('[data-v35-day="2"]').click();
  pick(0,"topic","Problemler");pick(0,"count","40");
  bulk.querySelector("[data-v35-add-row]").click();
  assert.deepEqual(open(),["1"],"yeni satır açık");
  const sum=row(0).querySelector(".coach-v50-sum");
  assert.equal(sum.getAttribute("aria-expanded"),"false");
  assert.equal(sum.querySelector("b").textContent,"Pzt, Çar · TYT Matematik");
  assert.equal(sum.querySelector("small").textContent,"Problemler · Soru çözümü · 40 soru");
  assert.equal(row(1).querySelector(".coach-v50-sum b").textContent,"Gün yok · Ders seçilmedi");
  sum.click();
  assert.deepEqual(open(),["0"]);
  bulk.querySelector("[data-v35-dup-row]").click();
  assert.deepEqual(open(),["2"],"çoğaltılan satır açık");
  row(1).querySelector("[data-v35-remove]").click();
  assert.deepEqual(open(),["1"],"silinen satırdan sonra açık satır kayar");
});

test("v50 3: gün kısayolları satırın günlerini seçer; gönder düğmesi görev sayısını yazar",t=>{
  const {bulk,row,pick}=fixture(t);
  pick(0,"subject","Kimya");
  row(0).querySelector('[data-v50-days="week"]').click();
  assert.deepEqual([...row(0).querySelectorAll("[data-v35-day]")].filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.textContent),["Pzt","Sal","Çar","Per","Cum"]);
  assert.equal(bulk.querySelector("[data-v10-bulk-add]").textContent,"Öğrenciye gönder (5 görev)");
  row(0).querySelector('[data-v50-days="all"]').click();
  assert.equal(bulk.querySelector("[data-v35-sum]").textContent,"1 satır · 7 görev");
  row(0).querySelector('[data-v50-days="none"]').click();
  assert.equal(row(0).querySelectorAll('[data-v35-day][aria-pressed="true"]').length,0);
});

test("v50 4: Satır ekle alt kısımda; Yapıştır sekmesinde gizlenir",t=>{
  const {bulk}=fixture(t);
  const tools=bulk.querySelector("[data-v50-tools]");
  assert.ok(tools.closest(".coach-v35-bottom"),"alt kısımda");
  assert.equal(bulk.querySelector(".coach-v35-body [data-v35-add-row]"),null);
  bulk.querySelector('[data-v35-mode="paste"]').click();
  assert.equal(tools.hidden,true);
  bulk.querySelector('[data-v35-mode="table"]').click();
  assert.equal(tools.hidden,false);
});

test("v50 stilleri: telefonda kapalı satır, açık satır düzeni, sabit alt kısım; tema değişkenleri ve en az 11px",()=>{
  const html=read("index.html");
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-bulk-v50\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-subj49-bulk50[^"]*"/);
  assert.match(css,/#coachV10Bulk \.coach-v35-dialog\{max-height:calc\(100dvh - 8vh\);grid-template-rows:auto minmax\(0,1fr\) auto;overflow:hidden\}/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.coach-v35-row\.is-collapsed>:not\(\.coach-v50-sum,\.coach-v35-remove\)\{display:none\}/);
  assert.match(css,/#coachV10Bulk \.coach-v50-note\{display:none\}/);
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});
