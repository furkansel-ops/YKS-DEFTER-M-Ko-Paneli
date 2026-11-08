const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const day=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const IMG="data:image/jpeg;base64,AAAA";
function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1",email:"koc@example.test",emailVerified:true}},errors=[];
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),Notification:class{static permission="denied"},
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),serverTimestamp:()=>"NOW",
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;window.__v62={
  set(wrongReview,photos){coachReportRows=[{studentUid:"elif",link:{active:true},share:{profile:{name:"Elif Yılmaz"},progress:wrongReview?{wrongReview}:{}}}];coachErrorPhotos=photos;errorPhotoFilter="all";},
  grid(){renderErrorPhotos();return document.getElementById("errorPhotoGrid")},
  meta(item){return errorPhotoMetaHtml(item)},
  card(){openStudentCard("elif");return document.getElementById("studentCardReview")}
};`);
  return{w,doc:w.document,errors};
}
const photo=(id,wrongId)=>({id,studentUid:"elif",photoKey:wrongId+"-0",wrongId,subject:"Fizik",topic:"Optik <b>x</b>",date:day(-3),thumb:IMG});

test("v62 fotoğraf kartında tekrar sonucu: seri, yanlış, henüz çözülmedi; tarih ifadesi doğru",t=>{
  const {w,errors}=fixture(t);
  w.__v62.set({learned:4,due:1,waiting:2,items:{"11":{ok:2,miss:1,due:day(10)},"12":{ok:0,miss:3,due:day(1)},"14":{ok:1,miss:0,due:day(-1)}}},[photo("a","11"),photo("b","12"),photo("c","13"),photo("d","14")]);
  const reps=[...w.__v62.grid().querySelectorAll(".coach-v62-rep")].map(x=>x.className.replace("coach-v62-rep ","")+"|"+x.textContent);
  assert.equal(reps.length,4);
  assert.ok(reps.some(r=>r.startsWith("is-good|✓ Üst üste 2 doğru · sıradaki ")),reps.join("\n"));
  assert.ok(reps.includes("is-bad|✗ 3 kez yanlış · yarın yine"),reps.join("\n"));
  assert.ok(reps.includes("is-none|Henüz tekrar çözülmedi"));
  assert.ok(reps.includes("is-good|✓ Üst üste 1 doğru · bugün bekliyor"));
  assert.ok(!w.__v62.grid().innerHTML.includes("<b>x</b>"),"konu kaçışlı");
  assert.match(w.__v62.meta(photo("a","11")),/Tekrar çöz<b>2 doğru serisi · 1 yanlış<\/b>/);
  assert.deepEqual(errors,[]);
});

test("v62 eski öğrenci sürümünde (wrongReview yok) rozet ve satır görünmez; bozuk kayıt yok sayılır",t=>{
  const {w}=fixture(t);
  w.__v62.set(null,[photo("a","11")]);
  assert.equal(w.__v62.grid().querySelectorAll(".coach-v62-rep").length,0);
  assert.doesNotMatch(w.__v62.meta(photo("a","11")),/Tekrar/);
  assert.equal(w.__v62.card().hidden,true);
  w.__v62.set({learned:"x",due:-5,items:{"11":{ok:9,miss:1,due:"bozuk"}}},[photo("a","11")]);
  assert.equal(w.__v62.grid().querySelector(".coach-v62-rep").textContent,"Henüz tekrar çözülmedi");
  assert.equal(w.__v62.card().hidden,true,"sayılar sıfırsa satır yok");
});

test("v62 öğrenci kartında öğrenilen / bekleyen / sırada sayıları",t=>{
  const {w}=fixture(t);
  w.__v62.set({learned:4,due:3,waiting:6,items:{}},[]);
  const box=w.__v62.card();
  assert.equal(box.hidden,false);
  assert.equal(box.textContent,"📷 Tekrar çöz4 soru öğrenildi · 3 soru bugün bekliyor · 6 soru sırada");
});
