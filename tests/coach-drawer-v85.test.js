const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-drawer-v85.css");

test("v85 telefon menüsü ✕ ile kapanır",t=>{
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window;w.innerWidth=375;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>({currentUser:null}),getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:()=>({}),doc:()=>({}),serverTimestamp:()=>({}),getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,""));
  const doc=w.document,sidebar=doc.getElementById("sidebar"),close=doc.getElementById("sidebarCloseBtn");
  assert.equal(close.closest(".coach-brand-v20")!==null,true,"✕ menünün başında");
  assert.equal(close.getAttribute("aria-label"),"Menüyü kapat");
  doc.getElementById("menuBtn").click();
  assert.equal(sidebar.classList.contains("open"),true);
  close.click();
  assert.equal(sidebar.classList.contains("open"),false);
  assert.equal(doc.getElementById("overlay").classList.contains("show"),false);
});

test("v85 stilleri: yalnız çekmecede; düz zemin, bulanıklık yok; ham renk yok",()=>{
  assert.match(read("index.html"),/<link rel="stylesheet" href="\.\/coach-drawer-v85\.css\?v=1\.0\.0">/);
  assert.match(css,/^\.coach-v85-close\{display:none\}\n@media\(max-width:759px\)\{/m,"tablet ve masaüstünde ✕ yok");
  assert.match(css,/#sidebar\{[^}]*background:var\(--k-side\);-webkit-backdrop-filter:none;backdrop-filter:none/);
  assert.match(css,/\.overlay\.show\{[^}]*backdrop-filter:none\}/);
  assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/i);
  for(const size of css.match(/font-size:[\d.]+px/g)||[])assert.ok(parseFloat(size.slice(10))>=11,size);
});
