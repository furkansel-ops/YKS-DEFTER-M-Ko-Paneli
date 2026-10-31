const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("app-reset.js");

// Ders eşleme tabloları ve konu listeleri uygulamadaki haliyle yüklenir.
function subjects(){
  const ctx=vm.createContext({});
  vm.runInContext(app.slice(app.indexOf("const COACH_V6_LESSONS="),app.indexOf("function coachV6Symbol(")).replace(/^const /gm,"var "),ctx);
  const topics=app.slice(app.indexOf("const COACH_V18_TOPICS="));
  vm.runInContext("var COACH_V18_TOPICS="+topics.slice(topics.indexOf("{"),topics.indexOf("\n};")+2),ctx);
  return task=>{const found=ctx.coachV6Subject({id:"s-0-1",...task});return found.title};
}

test("v49 ders adı yazılmayan görevin dersi konudan anlaşılır; satır adı ezmez",()=>{
  const subject=subjects();
  assert.equal(subject({text:"Koç · Üslü sayılar 30 soru",label:"Kimya"}),"Matematik","Kimya satırındaki üslü sayılar Matematik");
  assert.equal(subject({text:"Koç · Mol kavramı tekrar",label:"Matematik"}),"Kimya");
  assert.equal(subject({text:"Rasyonel sayılar 20 soru",label:"Fizik"}),"Matematik","en uzun konu adı");
  assert.equal(subject({text:"Koç · TYT Matematik · Üslü Sayılar · Soru çözümü",label:"Kimya"}),"Matematik","ders adı her zaman önce");
});

test("v49 konu birden çok derste geçiyorsa ya da hiç geçmiyorsa satır adına bakılır",()=>{
  const subject=subjects();
  assert.equal(subject({text:"Temel kavramlar tekrarı",label:"Geometri"}),"Geometri");
  assert.equal(subject({text:"Serbest okuma",label:"Fizik"}),"Fizik");
  assert.equal(subject({text:"Serbest okuma",label:""}),"Çalışma");
  assert.equal(subject({text:"Sayılarla oyun",label:""}),"Çalışma","kelime ortasındaki konu adı sayılmaz");
});

test("v49 önbellek etiketi yenilendi",()=>{
  assert.match(read("index.html"),/app-reset\.js\?v=1\.0\.70-[^"]*-multi48-subj49"/);
});
