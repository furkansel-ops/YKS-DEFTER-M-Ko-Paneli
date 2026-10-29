const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test/",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},writes=[];
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
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+
    "\nwindow.v33={showApp,showAuth,showPage:showCoachPage,runViewport:syncCoachVisualViewport,auth};");
  return{w,doc:w.document,writes,auth};
}

test("refresh restores preferred Programlar before first visible frame, never flashes default home",t=>{
  const h=fixture(t),{w,doc}=h;
  w.localStorage.setItem("yks_coach_ui_preferences_v2",JSON.stringify({defaultPage:"programs"}));
  w.eval("finishBoot=function(){window.firstFrame={visible:!document.getElementById('appView').classList.contains('hidden'),programs:!document.getElementById('programsPage').classList.contains('hidden'),home:!document.getElementById('homePage').classList.contains('hidden'),active:document.querySelector('.coach-nav-item.on')?.dataset.coachPage};document.getElementById('bootView').classList.add('hidden');}");
  w.v33.showApp({displayName:"Deneme Koçu",role:"coach"},{uid:"coach-1",displayName:"Deneme"});
  assert.equal(w.firstFrame.visible,true);
  assert.equal(w.firstFrame.programs,true);
  assert.equal(w.firstFrame.home,false);
  assert.equal(w.firstFrame.active,"programs");
  assert.ok(doc.getElementById("bootView").classList.contains("hidden"));
  assert.equal(h.writes.length,0);
});

test("unknown saved route safely falls back to home without re-entrant inline navigation",t=>{
  const h=fixture(t),{w,doc}=h;
  w.localStorage.setItem("yks_coach_ui_preferences_v2",JSON.stringify({defaultPage:"deleted-legacy-page"}));
  w.v33.showApp({role:"coach"},{uid:"coach-1"});
  assert.equal(doc.querySelector(".coach-nav-item.on")?.dataset.coachPage,"home");
  assert.equal(doc.getElementById("homePage").classList.contains("hidden"),false);
  const visible=[...doc.querySelectorAll("main.coach-reset-canvas>section")].filter(x=>!x.classList.contains("hidden"));
  assert.equal(visible.length,1);
});

test("Safari bfcache resume restores active tab and closes drawer; signed-out restore hides private shell",t=>{
  const h=fixture(t),{w,doc,auth}=h;
  w.v33.showApp({role:"coach"},{uid:"coach-1"});
  w.v33.showPage("reports");
  const sidebar=doc.getElementById("sidebar");
  sidebar.classList.add("open");
  const event=new w.Event("pageshow");Object.defineProperty(event,"persisted",{value:true});
  w.dispatchEvent(event);
  assert.equal(sidebar.classList.contains("open"),false);
  assert.equal(doc.getElementById("reportsPage").classList.contains("hidden"),false);
  assert.equal(doc.querySelector(".coach-nav-item.on")?.dataset.coachPage,"reports");
  auth.currentUser=null;
  w.dispatchEvent(event);
  assert.equal(doc.getElementById("appView").classList.contains("hidden"),true);
  assert.equal(doc.getElementById("authView").classList.contains("hidden"),false);
});

test("iPadOS/Android virtual viewport tracks resize and restores after keyboard closes",t=>{
  const h=fixture(t),{w,doc}=h,root=doc.documentElement;
  w.visualViewport={height:365,addEventListener:()=>{}};
  w.dispatchEvent(new w.Event("resize"));
  assert.equal(root.style.getPropertyValue("--coach-visible-height"),"365px");
  w.visualViewport.height=750;
  w.dispatchEvent(new w.Event("orientationchange"));
  assert.equal(root.style.getPropertyValue("--coach-visible-height"),"750px");
  assert.equal(h.writes.length,0);
});

test("failed Firebase module import exposes retry without ever showing a stale panel",t=>{
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test/",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,boot=w.document.getElementById("bootView");
  let timer;
  w.setTimeout=fn=>{timer=fn;return 1};
  w.eval(read("coach-startup-v33.js"));
  const module=w.document.querySelector("script[data-coach-app]");
  assert.ok(module);
  module.dispatchEvent(new w.Event("error"));
  assert.equal(boot.querySelectorAll(".coach-boot-retry").length,1);
  assert.equal(w.document.getElementById("appView").classList.contains("hidden"),true);
  assert.match(boot.textContent,/Bağlantı kurulamadı/);
  module.dispatchEvent(new w.Event("error"));
  assert.equal(boot.querySelectorAll(".coach-boot-retry").length,1);
  boot.classList.add("hidden");
  timer();
  assert.equal(boot.querySelectorAll(".coach-boot-retry").length,1);
});

test("all screen routing has exactly one authoritative JavaScript handler, and mobile modal rules are isolated",()=>{
  const html=read("index.html"),js=read("app-reset.js"),css=read("coach-mobile-compat-v33.css");
  assert.doesNotMatch(html,/document\.addEventListener\("click",function\(e\).*?\[data-coach-page\]/);
  assert.match(js,/button\.addEventListener\("click",\(\)=>showCoachPage\(button\.dataset\.coachPage\)\)/);
  assert.match(html,/data-coach-app src="\.\/app-reset\.js\?v=1\.0\.70-r28-r29-v30-live-mobile32-boot33-defter34-bulk36-theme36"/);
  assert.match(html,/coach-startup-v33\.js\?v=1\.0\.0/);
  assert.match(html,/coach-mobile-compat-v33\.css\?v=1\.0\.0/);
  assert.match(css,/@media\(max-width:1024px\),\(hover:none\) and \(pointer:coarse\)/);
  assert.match(css,/max-height:calc\(var\(--coach-visible-height,100dvh\) - 16px\)/);
  assert.match(css,/student-connect-modal \.student-connect-body/);
  assert.match(css,/font-size:16px/);
  for(const id of ["homePage","programsPage","reportsPage","programTaskBackdrop","studentConnectBackdrop","coachVideoPickerBackdrop"]){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.doesNotMatch(css,/display:none\s*!important/);
});
