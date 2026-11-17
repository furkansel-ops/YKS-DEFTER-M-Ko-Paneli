const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const lum=hex=>{const n=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*n[0]+.7152*n[1]+.0722*n[2]};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};

test("v77 yeni temaların panel renkleri ve her --kc anahtarının karşılığı var",()=>{
  const tokens=read("coach-theme-tokens-v36.css"),themes=read("coach-themes-v36.css");
  const keys=[...tokens.slice(0,tokens.indexOf("}")).matchAll(/--kc-([\w-]+):/g)].map(m=>m[1]);
  for(const id of["okyanus","orman","gunbatimi","geceyarisi"]){
    const at=tokens.indexOf(`:root[data-theme="${id}"]{`);assert.ok(at>0,id+" renk eşlemesi");
    const block=tokens.slice(at,tokens.indexOf("}",at));
    for(const k of keys)assert.ok(block.includes("--kc-"+k+":"),id+": "+k);
    assert.ok(themes.includes(`:root[data-theme="${id}"]{`),id+" panel renkleri");
    assert.ok(themes.includes(`[data-swatch="${id}"]`),id+" örnek rengi");
  }
  assert.match(tokens.slice(tokens.indexOf(':root[data-theme="geceyarisi"]')),/^:root\[data-theme="geceyarisi"\]\{color-scheme:dark;/);
});

test("v77 renk tonu değişirken parlaklık korunur: ana vurgu beyaz yazıyla okunur",()=>{
  const tokens=read("coach-theme-tokens-v36.css");
  const value=(id,key)=>{const at=tokens.indexOf(`:root[data-theme="${id}"]{`);return tokens.slice(at,tokens.indexOf("}",at)).match(new RegExp("--kc-"+key+":(#[0-9a-f]{6});"))?.[1]};
  for(const id of["okyanus","orman","gunbatimi"]){const c=value(id,"2873f0");assert.ok(c,id);assert.ok(ratio(c,"#ffffff")>=4.5,id+" vurgu "+c);}
});
