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
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},updates=[],deletes=[],errors=[];
  w.innerWidth=375;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),serverTimestamp:()=>"NOW",
    getDoc:async()=>({exists:()=>false}),
    getDocs:async q=>{const name=Array.isArray(q)?q[0].name:"";if(name.startsWith("coachingErrorPhoto"))return{docs:[{ref:{path:name+"/x_1"},data:()=>({studentUid:"x"})},{ref:{path:name+"/y_1"},data:()=>({studentUid:"y"})}]};return{docs:[]}},
    writeBatch:()=>({delete(ref){deletes.push(ref.path)},commit:async()=>{}}),
    setDoc:async()=>{},updateDoc:async(ref,data)=>{updates.push({ref,data})},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{const ago=n=>new Date(Date.now()-n*864e5).toISOString(),link=id=>({id,active:true,coachUid:"coach-1",createdAt:{toDate:()=>new Date(2026,9,12)}});
  const share=(name,track,o)=>({profile:{name,track,targetNetTYT:90,career:{level:12,tyt:{name:"Platin III"}}},updatedAt:o.updated,progress:{minutes7:o.min||0,daily14:o.study===undefined?[]:[{date:reportDateOffset(-o.study),minutes:70,questions:30}]},exams:o.exams||[],program:{weeks:[]}});
  coachReportRows=[{studentUid:"x",link:link("l-x"),share:share("Elif Yılmaz","SAY",{updated:ago(0),study:0,min:420,exams:[{type:"TYT",date:"2026-10-20",totalNet:70},{type:"TYT",date:"2026-10-30",totalNet:78.75}]})},
    {studentUid:"y",link:link("l-y"),share:share("Zeynep Ak","SÖZ",{updated:ago(3),study:1,min:200})}];
  renderStudentsPage();}`);
  return{w,doc:w.document,updates,deletes,errors};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};

test("v54 son çalışma ve eşitleme ayrı; 2 günden eski eşitleme 'Veri eski'",t=>{
  const {doc,errors}=fixture(t);
  assert.match(text(doc.querySelector('[data-student-row="x"] .student-last')),/^Bugün 1 sa 10 dk · 30 soru Son eşitleme az önce$/);
  const stale=doc.querySelector('[data-student-row="y"] .student-v54-sync');
  assert.equal(stale.textContent,"Veri eski · son eşitleme 3 gün önce");assert.ok(stale.classList.contains("is-stale"));
  assert.match(text(doc.querySelector('[data-student-row="x"] .students-v43-line')),/^TYT Platin III · Seviye 12 · 7 günde 7 sa · Son TYT 78,75 ▲ 8,75 · Program yok/);
  assert.deepEqual(errors,[]);
});

test("v54 alan süzgeci ve sıralama",t=>{
  const {w,doc}=fixture(t);
  const names=()=>[...doc.querySelectorAll("#studentsList .student-cell-main b")].map(n=>n.textContent);
  const track=doc.getElementById("studentTrackSelect");track.value="SOZ";track.dispatchEvent(new w.Event("change"));
  assert.deepEqual(names(),["Zeynep Ak"],"SÖZ = SOZ");
  track.value="all";track.dispatchEvent(new w.Event("change"));
  const sort=doc.getElementById("studentSortSelect");sort.value="study";sort.dispatchEvent(new w.Event("change"));
  assert.deepEqual(names(),["Elif Yılmaz","Zeynep Ak"],"en yeni çalışan önce");
  sort.value="name";sort.dispatchEvent(new w.Event("change"));assert.deepEqual(names(),["Elif Yılmaz","Zeynep Ak"]);
});

test("v54 öğrenci kartı bilgileri; kaldırınca bağlantı kapanır ve yalnız o öğrencinin fotoğrafları silinir",async t=>{
  const {doc,updates,deletes,errors}=fixture(t);
  doc.querySelector('[data-open-student="x"]').click();
  assert.match(text(doc.getElementById("studentCardFacts")),/Rank · seviye TYT Platin III · Seviye 12 Hedef net TYT 90 Son çalışma Bugün 1 sa 10 dk · 30 soru/);
  assert.match(text(doc.getElementById("studentCardFacts")),/Bağlantı 12 Ekim'den beri/);
  doc.getElementById("studentCardRemove").click();
  const dialog=doc.getElementById("studentRemoveModal");assert.equal(dialog.hidden,false);
  dialog.querySelector('[data-student-remove-answer="yes"]').click();
  for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));
  assert.deepEqual([...updates[0].ref.parts],["coachingLinks","l-x"]);assert.equal(updates[0].data.active,false);
  assert.deepEqual(deletes,["coachingErrorPhotos/x_1","coachingErrorPhotoImages/x_1"],"başka öğrencinin fotoğrafına dokunmaz");
  assert.match(read("index.html"),/Bağlanınca neleri görürsün\?/);
  assert.deepEqual(errors.filter(e=>!/Öğrenci (verileri|raporları)/.test(e)),[]);
});
