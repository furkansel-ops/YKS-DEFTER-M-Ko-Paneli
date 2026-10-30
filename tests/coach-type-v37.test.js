const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
const sheets=()=>fs.readdirSync(root).filter(name=>name.endsWith(".css"));

test("v37 koç panelinde 11px'ten küçük sabit yazı boyutu yok",()=>{
  for(const name of sheets()){
    const css=fs.readFileSync(path.join(root,name),"utf8").replace(/\/\*[\s\S]*?\*\//g,"");
    for(const [,value] of css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g))
      assert.ok(Number(value)>=11,name+": font-size "+value+"px okunamayacak kadar küçük (node scripts/coach-type-scale.mjs)");
  }
});

test("v37 yazı boyutu betiği yeni küçük yazıları büyütür, mevcutlara dokunmaz",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"coach-type-"));
  try{
    fs.writeFileSync(path.join(dir,"a.css"),".a{font-size:7px}.b{font-size:8px}.c{font-size:10px}.d{font-size:11px}.e{font-size:11.5px}.f{font-size:14px}");
    execFileSync(process.execPath,[path.join(root,"scripts/coach-type-scale.mjs"),dir]);
    const once=fs.readFileSync(path.join(dir,"a.css"),"utf8");
    assert.equal(once,".a{font-size:11px}.b{font-size:11.5px}.c{font-size:12px}.d{font-size:11px}.e{font-size:11.5px}.f{font-size:14px}");
    execFileSync(process.execPath,[path.join(root,"scripts/coach-type-scale.mjs"),dir]);
    assert.equal(fs.readFileSync(path.join(dir,"a.css"),"utf8"),once,"ikinci çalıştırma hiçbir şeyi değiştirmez");
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
