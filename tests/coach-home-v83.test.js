const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-home-v83.css");

// Ayşe: bugün 80 dk, dün 30 dk, geçen hafta 200 dk, iki TYT, gün sonu ve haftalık notu var, bugünkü görevi bitti.
// Mehmet: bugün çalışmadı, bugün 1/3 görev. İkisinin de gelecek haftası boş.
const DEMO=`
  const wk=programCurrentWeekStart(),last=shiftProgramWeek(wk,-1),day=(new Date().getDay()+6)%7,now=new Date().toISOString();
  const rows=()=>[0,1,2].map(i=>Array.from({length:7},(_,d)=>d===day?["Problemler 40 soru","Mol kavramı","20 paragraf"][i]:""));
  const share=(name,dn,extra={})=>({profile:{name},updatedAt:now,...extra,progress:{overdueTopics:0,minutes7:240,...extra.progress},program:{weeks:[{week:wk,data:{r:rows(),dn}}]}});
  const link={active:true};
  coachReportRows=[
    {studentUid:"a",link,share:share("Ayşe Yılmaz",{["r-0-"+day]:1,["r-1-"+day]:1,["r-2-"+day]:1},{
      exams:[{type:"TYT",date:"2026-11-01",totalNet:75.25},{type:"TYT",date:"2026-11-20",totalNet:78.5}],
      progress:{daily31:[{date:last,minutes:200},{date:reportDateOffset(-1),minutes:30},{date:reportDateOffset(0),minutes:80}],
        dayReview:{entries:[{date:todayIsoLocal(),mood:"good",note:"<i>iyi</i> geçti",at:1}]},
        weeklyReviews:[{week:last,good:"Paragraf",hard:"",focus:"Fizik"}]}})},
    {studentUid:"b",link,share:share("Mehmet Kaya",{["r-0-"+day]:1})}
  ];
  renderCoachDashboard();
`;

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}};
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
    setInterval:()=>0,clearInterval:()=>{},setTimeout:fn=>{w.__timer=fn;return 1},clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:()=>{}},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("coach-weekly-v74.js"));
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+DEMO+"}");
  return{w,doc:w.document};
}
const late=(new Date().getDay()+6)%7>=3;

test("v83 dört sayı: bugün çalışan, bugün toplam, cevap bekleyen, haftası boş",t=>{
  const {doc}=fixture(t);
  const card=id=>{const node=doc.getElementById(id),box=node.closest(".stat-card");return[node.textContent,box.querySelector("em").textContent,box.classList.contains("is-warn")]};
  assert.deepEqual(card("statStudents"),["1 / 2","Ayşe",false]);
  assert.deepEqual(card("statCompleted"),["1 sa 20 dk","dün 30 dk",false]);
  assert.deepEqual(card("statPending"),["0","mesaj",false]);
  const [count,note,warn]=card("statProgress");
  assert.equal(count,"2");assert.match(note,/^Ayşe \+1 · /);assert.equal(warn,late,"Perşembeden önce turuncu değil");
  assert.equal(doc.querySelector("#statStudents").closest("button").dataset.goPage,"students");
  doc.getElementById("statEmptyWeek").click();
  assert.equal(doc.querySelector("#programsPage").classList.contains("hidden"),false,"haftası boş kartı programı açar");
});

test("v83 Öğrencilerim: satırda bu hafta, görev, son deneme, tek düğme; notlar altında ve kaçışlı",t=>{
  const {doc}=fixture(t);
  assert.equal(doc.querySelector(".coach-v74-week,.day-review-panel"),null,"eski kartlar kalktı");
  const rows=Object.fromEntries([...doc.querySelectorAll(".coach-v83-row")].map(row=>[row.querySelector(".coach-v83-name b").textContent,row]));
  const ayse=rows["Ayşe Yılmaz"],cells=[...ayse.querySelectorAll(".coach-v83-cell")].map(cell=>cell.textContent);
  // Dün Pazartesi değilse bu haftaya girer (80+30); Pazartesi ise geçen haftaya (200+30).
  const monday=new Date().getDay()===1;
  assert.deepEqual(cells,[monday?"1 sa 20 dkgeçen hafta 3 sa 50 dk":"1 sa 50 dkgeçen hafta 3 sa 20 dk","3/3","TYT 78,5▲ 3,25"]);
  assert.equal(ayse.querySelector(".coach-v83-cell small").className,"down");
  const notes=[...ayse.querySelectorAll(".coach-v83-note")].map(node=>node.textContent);
  assert.deepEqual(notes,["🙂 Gün sonu · İyi: “<i>iyi</i> geçti”","✎ Geçen hafta · İyi gitti: Paragraf · Odak: Fizik"]);
  assert.equal(ayse.querySelector(".coach-v83-note i"),null,"öğrenci metni HTML olarak yazılmaz");
  const mehmet=rows["Mehmet Kaya"];
  assert.deepEqual([...mehmet.querySelectorAll(".coach-v83-cell")].map(cell=>cell.textContent),["0 dkgeçen hafta 0 dk","1/3","Deneme yok"]);
  assert.equal(mehmet.querySelectorAll(".coach-v83-note").length,0);
  const act=ayse.querySelector("[data-home-act]");
  assert.equal(act.textContent,late?"Haftayı hazırla":"Programı aç");
  act.click();
  assert.equal(doc.querySelector("#programsPage").classList.contains("hidden"),false);
});

test("v83 stilleri: tema değişkenleri, en az 11px; index stil dosyasını yükler",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-home-v83\.css\?v=1\.0\.0">/);
  assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/i,"ham renk yok");
  for(const size of css.match(/font-size:[\d.]+px/g)||[])assert.ok(parseFloat(size.slice(10))>=11,size);
  assert.match(css,/#homePage \.coach-v83-facts\{display:contents\}/);
});
