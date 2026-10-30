const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const OWN=new Set(["coach-theme-tokens-v36.css","coach-themes-v36.css"]);
const sheets=()=>fs.readdirSync(root).filter(name=>name.endsWith(".css")&&!OWN.has(name));

const DEMO_ROWS=`
    const wk=programCurrentWeekStart(),day=(new Date().getDay()+6)%7,now=new Date().toISOString();
    const share=(name,dn,extra={})=>({profile:{name},updatedAt:extra.updatedAt||now,progress:{overdueTopics:extra.overdue||0},
      program:{weeks:[{week:wk,data:{r:[Array.from({length:7},(_,d)=>d===day?"Görev A":""),Array.from({length:7},(_,d)=>d===day?"Görev B":"")],dn}}]}});
    coachReportRows=[
      {studentUid:"a",share:share("Ayşe",{["r-0-"+day]:1,["r-1-"+day]:1})},
      {studentUid:"b",share:share("Mehmet",{["r-0-"+day]:1})},
      {studentUid:"c",share:share("Zeynep",{},{overdue:2})},
      {studentUid:"d",share:share("Ali",{},{updatedAt:"2020-01-01T10:00:00Z"})}
    ];
    renderCoachDashboard();
  `;

function fixture(t,extra=""){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach"}};
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    serverTimestamp:()=>({}),getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"action"}),
    signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  // let/const yalnız aynı eval içinde görünür; örnek veri uygulama koduyla birlikte çalışır.
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+extra+"}");
  return{w,doc:w.document};
}

test("v36 tema dosyaları yüklenir; tema ilk boyamadan önce uygulanır",()=>{
  const html=read("index.html"),head=html.slice(0,html.indexOf("</head>"));
  assert.match(head,/coach-theme-tokens-v36\.css/);
  assert.match(head,/coach-themes-v36\.css/);
  assert.match(head,/<script src="\.\/coach-theme-boot-v36\.js\?v=[^"]+"><\/script>/);
  const boot=read("coach-theme-boot-v36.js");
  assert.match(boot,/yks_coach_ui_preferences_v2/);
  assert.match(boot,/theme==="night"\|\|theme==="vivid"/);
});

test("v36 panel CSS'inde ham renk kalmaz; her renk anahtarının Gece ve Canlı karşılığı vardır",()=>{
  const tokens=read("coach-theme-tokens-v36.css");
  const night=tokens.slice(tokens.indexOf(':root[data-theme="night"]'),tokens.indexOf(':root[data-theme="vivid"]'));
  const vivid=tokens.slice(tokens.indexOf(':root[data-theme="vivid"]'));
  // Saydamlığı değişkenden gelen rgba(…,var(--x)) tonları zaten iki zeminde de okunur.
  const raw=/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*[\s,]\s*\d+\s*[\s,]\s*\d+\s*(?:[,/]\s*[\d.]+%?\s*)?\)|(?<![-\w])(?:white|black)(?![-\w])/;
  for(const name of sheets()){
    const css=read(name);
    // Dosyanın tamamı taranır (iç içe kurallar ve yorum sonrası bildirimler dahil); yalnız yorumlar ve sarılmış renkler çıkarılır.
    const rest=css.replace(/\/\*[\s\S]*?\*\//g,"").replace(/var\(--kc-[\w-]+,[^()]*(?:\([^()]*\)[^()]*)*\)/g,"");
    const found=rest.match(raw);
    assert.equal(found,null,name+": temaya bağlanmamış renk → "+(found?rest.slice(Math.max(0,found.index-60),found.index+20):""));
    for(const [,key] of css.matchAll(/var\(--kc-([\w-]+),/g)){
      assert.ok(night.includes("--kc-"+key+":"),name+": Gece karşılığı yok "+key);
      assert.ok(vivid.includes("--kc-"+key+":"),name+": Canlı karşılığı yok "+key);
    }
  }
  assert.match(night,/color-scheme:dark/);
});

test("v36 renk eşlemesi: açık temalarda gri yazı okunur, Gece'de yarı saydam beyazlar koyu iz olur",()=>{
  const tokens=read("coach-theme-tokens-v36.css");
  const value=(scope,key)=>{const at=tokens.indexOf(scope);return tokens.slice(at,tokens.indexOf("}",at)).match(new RegExp("--kc-"+key+":([^;]+);"))?.[1]};
  const lum=hex=>{const n=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*n[0]+.7152*n[1]+.0722*n[2]};
  const onWhite=hex=>1.05/(lum(hex)+.05);
  for(const scope of [":root:not([data-theme])",':root[data-theme="vivid"]'])
    for(const key of ["71809a","9aa6b5","8a97a8"]){
      const hex=value(scope,key);
      assert.ok(hex&&onWhite(hex)>=4.5,scope+" "+key+" → "+hex+" beyazda "+(hex?onWhite(hex).toFixed(2):"yok"));
    }
  assert.match(value(':root[data-theme="night"]',"ffffff-a140"),/^rgba\(4,8,18,/);
  assert.ok(onWhite(value(":root:not([data-theme])","2873f0"))>=4.5,"Sade Mavi ana mavisi beyazla 4.5:1");
});

test("v36 yan menü öğrenci uygulaması gibi gruplu: Takip, Analiz, İletişim",t=>{
  const {doc}=fixture(t),nav=doc.querySelector("#coachNav");
  const order=[...nav.children].map(node=>node.classList.contains("coach-nav-group")?"#"+node.textContent:node.dataset.coachPage);
  assert.deepEqual(order,["#Takip","home","students","programs","reports","#Analiz","paragraphProblem","exams","topics","errors","#İletişim","messages","settings"]);
  const css=read("coach-themes-v36.css");
  assert.match(css,/@media\(min-width:760px\) and \(max-width:1179px\)\{[\s\S]*grid-template-columns:84px minmax\(0,1fr\)/);
  assert.match(css,/\.coach-mobile-menu-reset\.mobile-only,\.coach-shell-reset \.overlay\{display:none!important\}/);
});

test("v36 Ayarlar › Görünüm üç temayı seçer, kaydeder ve uygular",t=>{
  const {w,doc}=fixture(t),buttons=[...doc.querySelectorAll("[data-coach-theme]")];
  assert.deepEqual(buttons.map(b=>b.dataset.coachTheme),["refined-blue","night","vivid"]);
  assert.deepEqual(buttons.map(b=>b.querySelector("b").textContent),["Sade Mavi","Gece","Canlı"]);
  buttons[1].click();
  assert.equal(doc.documentElement.dataset.theme,"night");
  assert.equal(JSON.parse(w.localStorage.getItem("yks_coach_ui_preferences_v2")).theme,"night");
  assert.equal(buttons[1].getAttribute("aria-pressed"),"true");
  assert.equal(doc.querySelector("#appearanceThemeLabel").textContent,"Gece");
  assert.equal(doc.querySelector('meta[name="theme-color"]').content,"#0a0f1c");
  buttons[0].click();
  assert.equal(doc.documentElement.dataset.theme,undefined);
  assert.equal(buttons[0].getAttribute("aria-pressed"),"true");
});

test("v36 ana sayfa: özet kart, Toplu görev yaz ve renkli durum etiketleri",t=>{
  const {doc}=fixture(t,DEMO_ROWS);
  assert.ok(doc.querySelector(".coach-v36-top>.coach-v36-hero #dashboardBulkBtn"));
  assert.ok(doc.querySelector(".coach-v36-top>.dashboard-stats #statStudents"));
  const grid=[...doc.querySelector(".dashboard-grid").children].map(node=>node.className);
  assert.match(grid[0],/coach-v36-status/);assert.match(grid[1],/coach-v36-flow/);
  const pills=Object.fromEntries([...doc.querySelectorAll(".dashboard-student-row")].map(row=>[row.querySelector("b").textContent,row.querySelector(".dashboard-student-pill")]));
  assert.deepEqual([pills.Ayşe.textContent,pills.Ayşe.classList.contains("active")],["Hedefte",true]);
  assert.deepEqual([pills.Mehmet.textContent,pills.Mehmet.classList.contains("behind")],["Geride",true]);
  assert.deepEqual([pills.Zeynep.textContent,pills.Zeynep.classList.contains("attention")],["2 geciken konu",true]);
  assert.deepEqual([pills.Ali.textContent,pills.Ali.classList.contains("behind")],["Bugün girmedi",true]);
  assert.equal(doc.querySelector("#dashboardSummary").textContent,"Bugün hedefte: 1 / 4 öğrenci · Takip bekleyen: 1");
});

test("v36 öğrencisi olmayan koçta Toplu görev yaz öğrenci eklemeyi açar",t=>{
  const {doc}=fixture(t);
  doc.querySelector("#dashboardBulkBtn").click();
  assert.equal(doc.querySelector("#studentsPage").classList.contains("hidden"),false);
  assert.equal(doc.querySelector("#studentConnectBackdrop").classList.contains("hidden"),false);
  assert.equal(doc.querySelector("#coachV10Bulk"),null);
});

test("v36 tablette (760px+) çekmece kapanı devreye girmez; ikon şeridi her zaman görünür",t=>{
  const {w,doc}=fixture(t);
  w.innerWidth=900;
  doc.querySelector("#menuBtn").click();
  assert.equal(doc.querySelector("#sidebar").classList.contains("open"),false);
  w.innerWidth=390;
  doc.querySelector("#menuBtn").click();
  assert.equal(doc.querySelector("#sidebar").classList.contains("open"),true);
});
