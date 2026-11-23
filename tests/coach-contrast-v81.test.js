const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const lum=hex=>{const n=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*n[0]+.7152*n[1]+.0722*n[2]};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};

test("v81 yazı renkleri açık temalarda panel zemininde 4.5:1",()=>{
  const tokens=read("coach-theme-tokens-v36.css");
  const value=(scope,key)=>{const at=tokens.indexOf(scope);return tokens.slice(at,tokens.indexOf("}",at)).match(new RegExp("--kc-"+key+":([^;]+);"))?.[1]};
  const keys=["d25a58","c85b5b","c35b5b","339578","148b75","2d8a69","6b7a90","637596"];
  for(const scope of [":root:not([data-theme])",...["vivid","okyanus","orman","gunbatimi"].map(t=>`:root[data-theme="${t}"]`)])
    for(const key of keys){const hex=value(scope,key)||"#"+key;assert.ok(ratio(hex,"#f3f6fd")>=4.5,scope+" "+key+" → "+hex+" "+ratio(hex,"#f3f6fd").toFixed(2))}
});

test("v81 Sade Mavi üst kartı: beyaz yazı 4.5:1, ikinci düğme koyu tül",()=>{
  const css=read("coach-themes-v36.css");
  const start=css.match(/:root:not\(\[data-theme\]\)\{[\s\S]*?--k-hero:linear-gradient\(135deg,(#[0-9a-f]{6}) 0%/)[1];
  assert.ok(ratio("#ffffff",start)>=4.5,start);
  assert.match(css,/\.coach-v36-hero-actions button\{[^}]*background:rgba\(0,0,0,\.16\);color:inherit\}/);
  assert.match(css,/\.coach-v36-hero \.dashboard-eyebrow\{color:inherit;opacity:\.95;/);
});
