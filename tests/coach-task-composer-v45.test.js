const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-task-composer-v45.css");

const DEMO=`
  const wk=programCurrentWeekStart(),now=new Date().toISOString();
  coachReportRows=[{studentUid:"b",link:{id:"l-b",active:true,coachUid:"coach-1"},share:{profile:{name:"Mehmet Kaya"},updatedAt:now,progress:{},program:{weeks:[{week:wk,data:{r:[],dn:{}}}]}}}];
  selectedProgramStudentUid="b";selectedProgramWeekStart="";
  hydrateProgramStudents();renderProgramWorkspace();
  window.__week=step=>formatProgramWeek(shiftProgramWeek(programCurrentWeekStart(),step));
  window.__selected=()=>[...coachWeeklySelectedDates].sort();
  window.__dayDate=(step,day)=>programDayDate(shiftProgramWeek(programCurrentWeekStart(),step),day);
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
  doc.getElementById("programAddTaskBtn").click();
  const chip=(group,value)=>doc.querySelector("[data-v45-"+group+'="'+value+'"]');
  return{w,doc,chip,text:()=>doc.getElementById("programTaskText").value};
}

test("v45 stil dosyası yüklenir; Haftaya Toplu Ekle kalktı; hafta satırı ve kısa etiketler",()=>{
  const html=read("index.html");
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-task-composer-v45\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-programs44-composer45[^"]*"/);
  assert.doesNotMatch(html,/programAddWeekBtn/);
  assert.match(html,/<button type="button" id="programTaskPrevWeek" aria-label="Önceki hafta">‹<\/button><strong id="programTaskWeekLabel">—<\/strong><button type="button" id="programTaskNextWeek" aria-label="Sonraki hafta">›<\/button>/);
  assert.match(html,/id="programDaysAll">Her gün</);assert.match(html,/id="programDaysClear">Temizle</);
  assert.match(html,/id="programTaskAddDraft">Taslağa ekle</);
  assert.doesNotMatch(read("app-reset.js"),/bulk:true/);
});

test("v45 2 · 3: ders ve çalışma türü yongaları seçim kutularından kurulur",t=>{
  const {doc}=fixture(t);
  const subjects=[...doc.querySelectorAll("#programBuilderSubjectChips [data-v45-subject]")];
  assert.deepEqual(subjects.filter(b=>!b.hidden).map(b=>b.textContent),["Matematik","Türkçe","Paragraf","Geometri","Fizik","Kimya","Biyoloji","Deneme"]);
  assert.deepEqual(subjects.filter(b=>b.hidden).map(b=>b.textContent),["Edebiyat","Tarih","Coğrafya","Felsefe","Din Kültürü"]);
  assert.deepEqual([...doc.querySelectorAll("#programBuilderActivityChips button")].map(b=>b.textContent),["Konu anlatımı","Soru çözümü","Tekrar","Deneme analizi","Diğer"]);
  assert.equal(doc.querySelector('#programBuilderActivityChips [aria-pressed="true"]').textContent,"Soru çözümü");
  assert.equal(doc.getElementById("programBuilderSubjectChips").getAttribute("aria-label"),"Ders");
});

test("v45 4: yongaya dokundukça görev metni kendiliğinden yazılır",t=>{
  const {doc,chip,text}=fixture(t);
  chip("subject","Kimya").click();
  assert.equal(doc.getElementById("programBuilderSubject").value,"Kimya");
  assert.equal(chip("subject","Kimya").getAttribute("aria-pressed"),"true");
  assert.equal(text(),"TYT Kimya · Soru çözümü");
  chip("activity","Tekrar").click();
  assert.equal(doc.getElementById("programBuilderActivity").value,"Tekrar");
  assert.equal(text(),"TYT Kimya · Tekrar");
  assert.equal(doc.getElementById("programBuilderCount").closest("label").hidden,true,"soru sayısı yalnız soru çözümünde");
  assert.equal(doc.querySelector(".coach-v18-builder-bottom").classList.contains("is-manual"),false);
});

test("v45 4: elle yazılan metin korunur ve yalnız o zaman 'Görev metnini oluştur' görünür",t=>{
  const {w,doc,chip,text}=fixture(t);
  chip("subject","Fizik").click();
  const area=doc.getElementById("programTaskText");
  area.value="Kendi metnim";area.dispatchEvent(new w.Event("input",{bubbles:true}));
  chip("subject","Biyoloji").click();
  assert.equal(text(),"Kendi metnim");
  assert.ok(doc.querySelector(".coach-v18-builder-bottom").classList.contains("is-manual"));
  doc.getElementById("programBuilderApply").click();
  assert.equal(text(),"TYT Biyoloji · Soru çözümü");
  assert.match(css,/\.coach-v18-builder-bottom:not\(\.is-manual\)\{display:none\}/);
});

test("v45 2: 'Diğer' kalan dersleri açar; pencere yeniden açılınca kapanır",t=>{
  const {doc,chip,text}=fixture(t);
  const more=doc.getElementById("programBuilderMoreSubjects");
  more.click();
  assert.equal(more.getAttribute("aria-expanded"),"true");assert.equal(chip("subject","Tarih").hidden,false);
  chip("subject","Tarih").click();
  assert.equal(text(),"TYT Tarih · Soru çözümü");
  doc.getElementById("programTaskClose").click();doc.getElementById("programAddTaskBtn").click();
  assert.equal(chip("subject","Tarih").hidden,true);assert.equal(more.getAttribute("aria-expanded"),"false");
  assert.equal(doc.querySelector('#programBuilderSubjectChips [aria-pressed="true"]'),null);
});

test("v45 5: hafta tek satırda değişir; seçili günler yeni haftada da aynı günlerdir",t=>{
  const {w,doc}=fixture(t);
  const label=doc.getElementById("programTaskWeekLabel");
  assert.equal(label.textContent,w.__week(0));
  doc.getElementById("programDaysWeekdays").click();
  doc.getElementById("programTaskNextWeek").click();
  assert.equal(label.textContent,w.__week(1));
  assert.deepEqual(Array.from(w.__selected()),[0,1,2,3,4].map(day=>w.__dayDate(1,day)));
  assert.equal(doc.getElementById("programTaskSend").textContent,"5 güne gönder");
  doc.getElementById("programTaskPrevWeek").click();doc.getElementById("programTaskPrevWeek").click();
  assert.equal(label.textContent,w.__week(-1));
  assert.deepEqual(Array.from(w.__selected()),[0,1,2,3,4].map(day=>w.__dayDate(-1,day)));
});

test("v45 stilleri: gizli seçim kutuları, kalkan tarih kutusu, Vazgeç ve hazır örnekler",()=>{
  assert.match(css,/label:is\(:has\(#programBuilderSubject\),:has\(#programBuilderActivity\)\) select\{display:none\}/);
  assert.match(css,/#programTaskBackdrop:not\(\[data-editing\]\) \.coach-v18-date\{display:none\}/,"düzenlemede görevin günü görünür kalır");
  assert.match(css,/#programTaskBackdrop:not\(\[data-editing\]\) \.coach-v19-left>\.program-task-body\{grid-template-areas:"builder days" "builder task" "keep task" "info info" "status status"\}/);
  assert.match(css,/#programTaskBackdrop #programTaskCancel\{display:none\}/);
  assert.match(css,/#programTaskBackdrop \.coach-v18-quick\{display:none\}/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.program-task-modal>header>div>span\{display:none\}/);
});

test("v45 stilleri yalnız tema değişkenleri ve en az 11px yazı kullanır",()=>{
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});
