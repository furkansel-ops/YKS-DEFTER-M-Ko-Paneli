const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html"),app=read("app-reset.js"),videos=read("program-videos-v1.js");
const line=(src,start)=>{const at=src.indexOf(start);assert.ok(at>=0,start+" bulunamadı");return src.slice(at,src.indexOf("\n",at))};

test("v67 CSP: satır içi ve yabancı betik çalışamaz, sayfa buna uygun kalır",()=>{
  const csp=(html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)||[])[1];
  assert.ok(csp,"CSP meta etiketi olmalı");
  const rule=name=>(csp.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+" "))||"");
  assert.equal(rule("default-src"),"default-src 'none'");
  assert.equal(rule("script-src"),"script-src 'self' https://www.gstatic.com https://apis.google.com");
  assert.equal(rule("object-src"),"object-src 'none'");
  assert.equal(rule("base-uri"),"base-uri 'none'");
  assert.ok(html.indexOf("Content-Security-Policy")<html.indexOf("<script"),"politika ilk betikten önce gelmeli");
  // Politika satır içi betiği engeller; sayfada satır içi betik ya da olay niteliği kalırsa panel bozulur.
  assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)[^>]*>/,"satır içi <script> olmamalı");
  assert.doesNotMatch(html,/\son[a-z]+="/,"satır içi olay niteliği olmamalı");
  for(const src of [app,videos])assert.doesNotMatch(src,/\son[a-z]+=\\?["']/,"şablonlarda satır içi olay niteliği olmamalı");
});

test("v67 öğrenci adı her zaman metindir: bozuk ad listeleri çökertemez",()=>{
  const context=vm.createContext({String});
  vm.runInContext(line(app,"function studentName(row){")+";globalThis.studentName=studentName;",context);
  const names=[{share:{profile:{name:123}}},{share:{profile:{name:{}}}},{profile:{displayName:"Ayşe"}},{}].map(context.studentName);
  assert.deepEqual(names.map(x=>typeof x),["string","string","string","string"]);
  assert.doesNotThrow(()=>names.slice().sort((a,b)=>a.localeCompare(b,"tr")));
  assert.equal(names[2],"Ayşe");assert.equal(names[3],"Öğrenci");
  assert.equal(context.studentName({share:{profile:{name:"x".repeat(200)}}}).length,80);
});

test("v67 öneri küçük resmi ve açılan video adresi denetlenir, toplu gönderim sınırlıdır",()=>{
  assert.match(app,/thumb=\/\^https:\\\/\\\/\(\?:i\\d\?\\\.ytimg\\\.com\|img\\\.youtube\\\.com\)\\\/\/\.test\(rawThumb\)\?rawThumb:""/);
  const context=vm.createContext({String});
  vm.runInContext(line(videos,"function isHttpsUrl(v){")+";globalThis.isHttpsUrl=isHttpsUrl;",context);
  assert.equal(context.isHttpsUrl("https://www.youtube.com/watch?v=abc"),true);
  for(const bad of ["javascript:alert(1)","http://acik.example","data:text/html,x","",null])assert.equal(context.isHttpsUrl(bad),false);
  assert.equal(videos.split("isHttpsUrl(item.url))window.open(item.url").length-1,2);
  assert.doesNotMatch(videos,/if\(item\)window\.open\(/);
  assert.match(app,/if\(items\.length>200\)\{say\("Tek seferde en fazla 200 görev gönderilebilir\./);
});
