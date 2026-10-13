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
  const w=dom.window,writes=[],auth={currentUser:{uid:"coach-a"}};
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...args)=>args,where:(...args)=>args,
    serverTimestamp:()=>({}),addDoc:async(ref,body)=>{writes.push({ref,body});return{id:"action"}},
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
    "\nwindow.reportV29Test={window:(rows,end=0)=>reportCalendarWeek(rows,end),period:reportPeriod,week:programCurrentWeekStart,date:reportDateOffset,details:reportProgramDetails,render:renderStudentReport,stats:weekStats};");
  const curr=w.reportV29Test.week();
  const row={
    studentUid:"student-a",
    share:{
      profile:{name:"Elif"},
      progress:{daily14:[],subjects7:[]},
      program:{rowLabels:{s:{0:"Matematik",1:"Fizik"}},weeks:[
        {week:curr,data:{s:{0:{0:"TYT Matematik · Problemler",1:"AYT Matematik · Fonksiyonlar"},1:{0:"TYT Fizik · Hareket"}},
          dn:{"s-0-0":1}}}
      ]}
    }
  };
  return{w,row,writes,document:w.document};
}

test("date-bound 7 day comparisons never pull an old sparse day into the current week",t=>{
  const h=fixture(t),api=h.w.reportV29Test;
  const prior=api.date(-8),today=api.date(0),old=api.date(-12);
  const rows=[{date:old,minutes:60,questions:15},{date:prior,minutes:90,questions:20},{date:today,minutes:30,questions:5}];
  const current=api.window(rows),previous=api.window(rows,-7);
  assert.equal(current.length,7);
  assert.equal(current[6].date,today);
  assert.equal(api.period(current).minutes,30);
  assert.equal(api.period(current).questions,5);
  assert.equal(api.period(current).activeDays,1);
  assert.equal(api.period(previous).minutes,150);
  assert.ok(!current.some(item=>item.date===prior||item.date===old));
});

test("program insights count student completion flags, keep future work pending and group subjects",t=>{
  const h=fixture(t),details=h.w.reportV29Test.details(h.row);
  assert.equal(details.stats.total,3);
  assert.equal(details.stats.completed,1);
  assert.equal(details.pending.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(details.subjects.map(x=>({name:x.name,total:x.total,done:x.done})))),[
    {name:"Matematik",total:2,done:1},
    {name:"Fizik",total:1,done:0}
  ]);
  assert.equal(details.period,"Bu hafta");
  assert.equal(h.writes.length,0);
  const other={...h.row,share:{...h.row.share,program:{rowLabels:{},weeks:[]}}};
  const empty=h.w.reportV29Test.details(other);
  assert.equal(empty.stats.total,0);
  assert.equal(empty.pending.length,0);
});

test("report shows real pending tasks and the correct daily chart including empty calendar dates",t=>{
  const h=fixture(t),api=h.w.reportV29Test;
  h.row.share.progress.minutes7=40;
  h.row.share.progress.questions7=6;
  h.row.share.progress.daily14=[
    {date:api.date(-10),minutes:80,questions:20},
    {date:api.date(0),minutes:40,questions:6}
  ];
  api.render(h.row);
  const host=h.document.querySelector("#reportProgramDetails");
  assert.match(host.textContent,/1 tamamlanan/);
  assert.match(host.textContent,/2 bekleyen/);
  assert.equal(host.querySelectorAll(".report-v29-subject").length,2);
  assert.equal(host.querySelectorAll(".report-v29-task").length,2);
  assert.equal(h.document.querySelectorAll("#reportActivityChart .report-activity-day").length,7);
  assert.match(h.document.querySelector("#reportStudentKpis").textContent,/40 dk/);
  assert.equal(h.writes.length,0,"report rendering must remain read-only");
});

test("missing program and malicious task names render as text instead of HTML",t=>{
  const h=fixture(t),api=h.w.reportV29Test;
  h.row.share.program.weeks[0].data.s[0][1]='TYT Matematik · <img src=x onerror="window.pwned=1">';
  api.render(h.row);
  assert.equal(h.document.querySelector("#reportProgramDetails img"),null);
  assert.equal(h.w.pwned,undefined);
  assert.ok(h.document.querySelector("#reportProgramDetails").textContent.includes("<img src=x"));
  h.row.share.program.weeks=[];
  api.render(h.row);
  assert.match(h.document.querySelector("#reportProgramDetails").textContent,/henüz yok/);
  assert.equal(h.writes.length,0);
});

test("compact report CSS is isolated from the weekly program and assets are cache-busted",()=>{
  const html=read("index.html"),css=read("coach-reports-v29.css");
  assert.match(html,/id="reportProgramDetails"/);
  assert.match(html,/coach-reports-v29\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-r28-r29/);
  assert.match(css,/#reportsPage \.report-v29-program-card/);
  assert.doesNotMatch(css,/#programsPage|#coachVisualWeekBoard|#programWeekBoard/);
});
