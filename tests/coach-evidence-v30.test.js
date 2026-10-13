const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test/",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,writes=[],auth={currentUser:{uid:"coach-1"}};
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...x)=>x,where:(...x)=>x,
    serverTimestamp:()=>({}),
    addDoc:async(ref,data)=>{writes.push({ref,data});return{id:"action-1"}},
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    updateDoc:async()=>{},setDoc:async()=>{},signOut:async()=>{},
    alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:()=>1,clearTimeout:()=>{},
    requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},
    scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+
    "\nwindow.evidenceTest={analyze:reportEvidenceAnalysis,draw:renderReportEvidence,render:renderStudentReport,date:reportDateOffset};");
  const day=w.evidenceTest.date;
  const row={studentUid:"student-1",share:{
    updatedAt:new Date(),
    profile:{name:"Öğrenci"},
    progress:{daily14:[],subjects7:[],minutes7:0,questions7:0,overdueTopics:1},
    program:{weeks:[{week:day(-7),data:{s:{0:{0:"TYT Matematik · Test"}},dn:{}}}],rowLabels:{s:{0:"Matematik"}}},
    topics:{items:[
      {exam:"TYT",subject:"Matematik",topic:"Üslü Sayılar",st:1,deadline:day(-1)},
      {exam:"TYT",subject:"Fizik",topic:"Kuvvet",st:3,deadline:day(-10)}
    ]},
    errorJournal:[
      {date:day(-2),subject:"Matematik",topic:"Üslü Sayılar",n:2},
      {date:day(-1),subject:" matematik ",topic:" üslü   sayılar ",n:3},
      {date:day(-1),subject:"Kimya",topic:"Mol",n:1}
    ],
    exams:[
      {id:"old-tyt",date:day(-14),type:"TYT",subjectResults:[{name:"Matematik",net:25},{name:"Fizik",net:11}]},
      {id:"old-ayt",date:day(-9),type:"AYT",subjectResults:[{name:"Matematik",net:30}]},
      {id:"new-tyt",date:day(-1),type:"TYT",subjectResults:[{name:"Matematik",net:20},{name:"Fizik",net:13}]}
    ]
  }};
  return{w,row,writes,document:w.document};
}

test("evidence combines only exact topic errors and retains independent status labels",t=>{
  const h=fixture(t),report=h.w.evidenceTest.analyze(h.row);
  assert.equal(report.mistakes.length,2);
  assert.equal(report.mistakes[0].wrong,5);
  assert.equal(report.mistakes[0].stage,"İşlendi");
  assert.equal(report.mistakes[0].stageLinked,true);
  assert.equal(report.delayed.length,1);
  assert.equal(report.delayed[0].topic,"Üslü Sayılar");
  assert.equal(report.changes.length,1);
  assert.equal(report.changes[0].type,"TYT");
  assert.equal(report.changes[0].subject,"Matematik");
  assert.equal(report.changes[0].delta,-5);
  assert.equal(h.writes.length,0);
});

test("exam net drops are compared within the same exam type; no topic errors fabricated from exams",t=>{
  const h=fixture(t);
  h.row.share.errorJournal=[];
  h.row.share.topics={items:[]};
  let data=h.w.evidenceTest.analyze(h.row);
  assert.equal(data.mistakes.length,0);
  assert.equal(data.delayed.length,0);
  assert.equal(data.changes.length,1);
  // AYT appears only once; its net is never compared with TYT.
  assert.ok(!data.changes.some(x=>x.type==="AYT"));
  h.row.share.exams=[h.row.share.exams[0],h.row.share.exams[1]];
  data=h.w.evidenceTest.analyze(h.row);
  assert.equal(data.changes.length,0);
});

test("a pending program task is not classified as a learning deficit",t=>{
  const h=fixture(t);
  h.row.share.errorJournal=[];
  h.row.share.exams=[];
  h.row.share.topics={items:[]};
  const data=h.w.evidenceTest.analyze(h.row);
  assert.equal(data.mistakes.length,0);
  assert.equal(data.delayed.length,0);
  assert.equal(data.changes.length,0);
  h.w.evidenceTest.draw(h.row);
  const text=h.document.querySelector("#reportEvidenceAnalysis").textContent;
  assert.match(text,/Tamamlanmayan program görevleri bilgi eksiği sayılmaz/);
  assert.doesNotMatch(text,/Önerilen çalışma|şimdi çalış|Ödev oluştur/);
  assert.equal(h.writes.length,0);
});

test("unsafe content is escaped; a duplicate TYT/AYT topic is not falsely correlated",t=>{
  const h=fixture(t);
  h.row.share.topics.items.push({exam:"AYT",subject:"Matematik",topic:"Üslü Sayılar",st:3,deadline:""});
  h.row.share.errorJournal.push({date:h.w.evidenceTest.date(-1),subject:"Fizik",topic:'<img src=x onerror="window.pwn=1">',n:4});
  const report=h.w.evidenceTest.analyze(h.row);
  assert.equal(report.mistakes.find(x=>x.wrong===5).stageLinked,false);
  h.w.evidenceTest.draw(h.row);
  const host=h.document.querySelector("#reportEvidenceAnalysis");
  assert.equal(host.querySelector("img,script"),null);
  assert.ok(host.textContent.includes("<img src=x onerror="));
  assert.equal(h.w.pwn,undefined);
  assert.equal(h.writes.length,0);
});

test("student detail integrates live evidence and reports data limitations, without coach actions",t=>{
  const h=fixture(t);
  h.w.evidenceTest.render(h.row);
  const host=h.document.querySelector("#reportEvidenceAnalysis");
  assert.match(host.textContent,/5 yanlış/);
  assert.match(host.textContent,/Hedef:/);
  assert.match(host.textContent,/−5 net/);
  assert.match(host.textContent,/Denemelerde konu bazlı yanlış sayısı/);
  assert.equal(h.writes.length,0);
  const second={studentUid:"student-2",share:{profile:{name:"Diğer"},program:{weeks:[]},topics:{items:[]},errorJournal:[],exams:[]}};
  h.w.evidenceTest.render(second);
  assert.doesNotMatch(h.document.querySelector("#reportEvidenceAnalysis").textContent,/Üslü Sayılar|−5 net/);
});

test("missing and stale timestamps are explicit, without invented freshness claims",t=>{
  const h=fixture(t);
  delete h.row.share.updatedAt;
  h.w.evidenceTest.draw(h.row);
  assert.match(h.document.querySelector("#reportEvidenceAnalysis").textContent,/Son paylaşım zamanı bilinmiyor/);
  h.row.share.updatedAt=new Date("2020-01-01T00:00:00Z");
  h.w.evidenceTest.draw(h.row);
  assert.match(h.document.querySelector("#reportEvidenceAnalysis").textContent,/48 saatten eski/);
});

test("stylesheet and report container do not alter weekly program controls",()=>{
  const html=read("index.html"),css=read("coach-evidence-v30.css"),js=read("app-reset.js");
  assert.match(html,/id="reportEvidenceAnalysis"/);
  assert.match(html,/coach-evidence-v30\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-r28-r29-v30/);
  assert.match(js,/function reportEvidenceAnalysis/);
  assert.doesNotMatch(css,/#programsPage|#coachVisualWeekBoard|#programWeekBoard/);
});