const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {JSDOM}=require("jsdom");
const {createWriteGuard,SLOW_MS}=require("../coach-write-guard-v78.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

function setup(t){
  const dom=new JSDOM("<!doctype html><body></body>",{url:"https://coach.example.test"});
  t.after(()=>dom.window.close());
  const w=dom.window,timers=new Map();let next=1;
  w.setTimeout=(fn,ms)=>{const id=next++;timers.set(id,{fn,ms});return id};
  w.clearTimeout=id=>timers.delete(id);
  const fire=ms=>{for(const [id,item] of [...timers])if(item.ms===ms){timers.delete(id);item.fn()}};
  const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
  return{w,doc:w.document,fire,deferred,guard:createWriteGuard(w)};
}
const tick=()=>new Promise(r=>setImmediate(r));
const leave=w=>{const e=new w.Event("beforeunload",{cancelable:true});w.dispatchEvent(e);return e.defaultPrevented};

test("v78 hızlı yazmada uyarı çıkmaz; ulaşmayan yazma uyarı verir, ulaşınca 'ulaştı' der",async t=>{
  const {w,doc,fire,deferred,guard}=setup(t);
  const fast=deferred(),slow=deferred();
  assert.equal(guard.track(fast.promise),fast.promise,"çağıran aynı sözü alır");
  fast.resolve();await tick();
  assert.equal(doc.querySelector("#coachWriteGuard"),null);
  guard.track(slow.promise);
  assert.equal(leave(w),true,"bekleyen varken sekme kapatma sorulur");
  fire(SLOW_MS);
  const box=doc.querySelector("#coachWriteGuard");
  assert.equal(box.hidden,false);assert.match(box.className,/is-wait/);
  assert.match(box.textContent,/1 gönderim sunucuya ulaşmadı/);assert.match(box.textContent,/sekmeyi kapatma/);
  slow.resolve();await tick();
  assert.match(box.className,/is-ok/);assert.match(box.textContent,/ulaştı/);
  assert.equal(leave(w),false);
  fire(5000);assert.equal(box.hidden,true);
});

test("v78 reddedilen yazma da bekleyenden düşer; hata gösterimi çağıranda kalır",async t=>{
  const {w,fire,deferred,guard}=setup(t);
  const bad=deferred();
  const out=guard.track(bad.promise);
  fire(SLOW_MS);bad.reject(new Error("permission-denied"));
  await assert.rejects(out,/permission-denied/);await tick();
  assert.equal(guard.pendingCount(),0);assert.equal(leave(w),false);
});

test("v78 Firestore yazmaları bekçiden geçer; panel sarmalayıcıyı yükler",()=>{
  const app=read("app-reset.js"),html=read("index.html"),wrap=read("coach-firestore-v78.js");
  assert.match(app.split("\n")[2],/addDoc,setDoc,updateDoc,.*writeBatch\}from"\.\/coach-firestore-v78\.js\?v=13\.4\.0";$/);
  assert.match(wrap,/export\*from"https:\/\/www\.gstatic\.com\/firebasejs\/13\.4\.0\/firebase-firestore\.js"/);
  for(const name of ["addDoc","setDoc","updateDoc"])assert.match(wrap,new RegExp("export const "+name+"=\\(\\.\\.\\.args\\)=>guard\\(fs\\."+name+"\\(\\.\\.\\.args\\)\\)"));
  assert.match(wrap,/batch\.commit=\(\)=>guard\(commit\(\)\)/);
  assert.match(html,/<script defer src="\.\/coach-write-guard-v78\.js\?v=1\.0\.0"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-write-guard-v78\.css\?v=1\.0\.0">/);
});
