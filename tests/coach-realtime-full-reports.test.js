const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test/",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,listeners=[],timers=[],writes=[],auth={currentUser:{uid:"coach-test"}};
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},
    onSnapshot:(ref,callback)=>{listeners.push({ref,callback});return()=>{}},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...x)=>x,where:(...x)=>x,
    serverTimestamp:()=>({}),
    addDoc:async(ref,data)=>{writes.push({ref,data});return{id:"action"}},
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    updateDoc:async()=>{writes.push("update")},setDoc:async()=>{writes.push("set")},
    signOut:async()=>{},
    alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:callback=>{timers.push(callback);return timers.length},
    requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},
    scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+
    "\nwindow.syncV31={setRows(rows){coachReportRows=rows},start:startCoachShareRealtime,render:renderCoachRealtimeViews,watchCalls(){const calls=[];renderExamAnalysis=scope=>calls.push(['exam',scope]);renderTopicAnalysis=scope=>calls.push(['topic',scope]);renderErrorAnalysis=scope=>calls.push(['errors',scope]);return calls;}};");
  return{w,listeners,timers,writes};
}
function choose(document,id,value){
  const select=document.getElementById(id);
  assert.ok(select,id);
  select.replaceChildren();
  select.add(new document.defaultView.Option("Tümü","all"));
  select.add(new document.defaultView.Option("Öğrenci","student-a"));
  select.value=value;
}
function row(){
  return{studentUid:"student-a",link:{id:"student-a_coach-test",active:true},profile:{displayName:"Öğrenci"},
    share:{profile:{name:"Öğrenci"},exams:[],topics:{items:[]},errorJournal:[],program:{weeks:[]},progress:{daily14:[],subjects7:[]}}};
}

test("coachingShares snapshot refreshes exams, topics and wrong log immediately without losing selected student",t=>{
  const h=fixture(t),entry=row();
  const calls=h.w.syncV31.watchCalls();
  choose(h.w.document,"examStudentSelect","student-a");
  choose(h.w.document,"topicStudentSelect","student-a");
  choose(h.w.document,"errorStudentSelect","student-a");
  h.w.syncV31.setRows([entry]);
  h.w.syncV31.start();
  assert.equal(h.listeners.length,1);
  assert.deepEqual([...h.listeners[0].ref.parts],["coachingShares","student-a"]);
  const changed={profile:{name:"Öğrenci"},exams:[{type:"TYT",date:"2026-10-13"}],
    topics:{items:[{subject:"Matematik",topic:"Problemler",st:1}]},
    errorJournal:[{subject:"Matematik",topic:"Problemler",n:3}],
    program:{weeks:[]},progress:{daily14:[],subjects7:[]}};
  h.listeners[0].callback({exists:()=>true,data:()=>changed});
  assert.equal(entry.share,changed,"the incoming realtime snapshot must replace the old share");
  // Advance only the scheduled, debounced projection, no Firestore writes.
  assert.ok(h.timers.length);
  h.timers.at(-1)();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ["exam","student-a"],["topic","student-a"],["errors","student-a"]
  ]);
  for(const id of ["examStudentSelect","topicStudentSelect","errorStudentSelect"])
    assert.equal(h.w.document.getElementById(id).value,"student-a");
  assert.equal(h.writes.length,0);
});

test("removed share invalidates all three projections without leaving stale data",t=>{
  const h=fixture(t),entry=row(),calls=h.w.syncV31.watchCalls();
  h.w.syncV31.setRows([entry]);
  h.w.syncV31.start();
  h.listeners[0].callback({exists:()=>false});
  h.timers.at(-1)();
  assert.equal(entry.share,null);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ["exam","all"],["topic","all"],["errors","all"]
  ]);
  assert.equal(h.writes.length,0);
});

test("live report code refreshes each read-only view, and bundle version prevents stale cache",()=>{
  const js=read("app-reset.js"),html=read("index.html");
  const body=js.slice(js.indexOf("function renderCoachRealtimeViews()"),js.indexOf("function scheduleCoachRealtimeRender()"));
  for(const token of ["renderExamAnalysis","renderTopicAnalysis","renderErrorAnalysis","renderParagraphProblem","renderReport","renderProgramWorkspace"])assert.match(body,new RegExp(token));
  assert.match(html,/app-reset\.js\?v=1\.0\.70-r28-r29-v30-live/);
});