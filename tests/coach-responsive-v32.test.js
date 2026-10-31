const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach"}},writes=[];
  w.innerWidth=390;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},
    onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    serverTimestamp:()=>({}),
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{writes.push("set")},updateDoc:async()=>{writes.push("update")},
    addDoc:async()=>{writes.push("add");return{id:"action"}},
    signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
    scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,""));
  return{w,doc:w.document,writes};
}

test("small-screen sidebar is keyboard accessible and closes with Escape",t=>{
  const h=fixture(t),{doc,w}=h,menu=doc.querySelector("#menuBtn"),sidebar=doc.querySelector("#sidebar");
  assert.equal(menu.getAttribute("aria-controls"),"sidebar");
  assert.equal(menu.getAttribute("aria-expanded"),"false");
  menu.click();
  assert.equal(menu.getAttribute("aria-expanded"),"true");
  assert.equal(sidebar.classList.contains("open"),true);
  assert.equal(doc.querySelector("#overlay").classList.contains("show"),true);
  assert.equal(doc.activeElement,sidebar.querySelector(".coach-nav-item.on"));
  w.document.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
  assert.equal(menu.getAttribute("aria-expanded"),"false");
  assert.equal(doc.activeElement,menu);
  assert.equal(sidebar.classList.contains("open"),false);
  assert.equal(h.writes.length,0);
});

test("Tab cycles within the mobile drawer; clicking overlay returns focus",t=>{
  const h=fixture(t),{doc,w}=h,menu=doc.querySelector("#menuBtn");
  menu.click();
  const first=doc.querySelector(".coach-nav-item"),last=doc.querySelector("#signOutBtn");
  first.focus();
  doc.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}));
  assert.equal(doc.activeElement,last);
  doc.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));
  assert.equal(doc.activeElement,first);
  doc.querySelector("#overlay").click();
  assert.equal(menu.getAttribute("aria-expanded"),"false");
  assert.equal(doc.activeElement,menu);
});

test("menu navigation closes the drawer and preserves current page",t=>{
  const h=fixture(t),{doc}=h,menu=doc.querySelector("#menuBtn");
  menu.click();
  doc.querySelector('[data-coach-page="reports"]').click();
  assert.equal(doc.querySelector("#sidebar").classList.contains("open"),false);
  assert.equal(doc.querySelector("#overlay").classList.contains("show"),false);
  assert.equal(menu.getAttribute("aria-expanded"),"false");
  assert.equal(doc.querySelector("#reportsPage").classList.contains("hidden"),false);
  assert.equal(doc.querySelector('[data-coach-page="reports"]').classList.contains("on"),true);
  assert.equal(h.writes.length,0);
});

test("drawer collapses when viewport returns to desktop and cannot trap keyboard there",t=>{
  const h=fixture(t),{doc,w}=h,menu=doc.querySelector("#menuBtn");
  menu.click();
  w.innerWidth=1200;
  w.dispatchEvent(new w.Event("resize"));
  assert.equal(doc.querySelector("#sidebar").classList.contains("open"),false);
  assert.equal(menu.getAttribute("aria-expanded"),"false");
  menu.click(); // hidden desktop button should never open a modal sidebar
  assert.equal(menu.getAttribute("aria-expanded"),"false");
});

test("responsive CSS scopes 7-column timetable to a horizontal scroll and keeps four actions visible",()=>{
  const css=read("coach-responsive-v32.css"),html=read("index.html"),js=read("app-reset.js");
  assert.match(html,/coach-responsive-v32\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-r28-r29-v30-live-mobile32/);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:400px\)/);
  assert.match(css,/#programsPage #coachFutureProgramTable #coachVisualWeekBoard \.coach-v14-week:not\(\[data-layout="list"\]\)/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(158px,1fr\)\)/);
  assert.match(css,/overflow-x:auto/);
  assert.match(css,/#programsPage \.coach-v15-action-buttons\{/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/#reportsPage \.report-v30-grid\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/#programsPage \.coach-v15-action-buttons button\{/);
  assert.match(js,/function coachMobileNavActive\(\)/);
  assert.doesNotMatch(css,/@media\(min-width:/);
});

test("mobile CSS does not hide any main page, program editing tool or report source",()=>{
  const css=read("coach-responsive-v32.css"),html=read("index.html");
  for(const id of ["homePage","studentsPage","programsPage","reportsPage","examsPage","topicsPage","errorsPage","settingsPage","programAddTaskBtn","programTemplatesBtn","programDaysWeekdays","reportEvidenceAnalysis"])assert.ok(html.includes('id="'+id+'"'),id);
  assert.doesNotMatch(css,/display:none\s*!important/);
  assert.doesNotMatch(css,/position:\s*absolute/);
  assert.doesNotMatch(css,/coach-v11-task-menu.*display:none/);
});
