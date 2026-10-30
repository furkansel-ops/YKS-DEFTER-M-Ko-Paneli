// Koç paneli renklerini öğrencideki üç temaya bağlar.
// 1) Kök dizindeki CSS dosyalarındaki ham renkleri var(--kc-ANAHTAR,ham-renk) yapar
//    (Sade Mavi = yedek değer; yalnız okunmayan açık gri yazılar koyulaştırılır).
// 2) Tüm --kc-* anahtarlarından Sade Mavi, Gece ve Canlı karşılıklarını coach-theme-tokens-v36.css'e yazar.
// Tekrar çalıştırmak güvenlidir: sarılmış renklere dokunmaz, token dosyasını baştan üretir.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT="coach-theme-tokens-v36.css";
const SKIP=new Set([OUT,"coach-themes-v36.css"]);
const files=fs.readdirSync(root).filter(name=>name.endsWith(".css")&&!SKIP.has(name));

const COLOR=/var\(--kc-[\w-]+,[^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*[\s,]\s*\d+\s*[\s,]\s*\d+\s*(?:[,/]\s*[\d.]+%?\s*)?\)|(?<![-\w])(?:white|black)(?![-\w])/g;

function parse(raw){
  const value=raw.toLowerCase();
  if(value==="white")return[255,255,255,1];
  if(value==="black")return[0,0,0,1];
  if(value[0]==="#"){
    let hex=value.slice(1);
    if(![3,4,6,8].includes(hex.length))return null;
    if(hex.length<6)hex=[...hex].map(ch=>ch+ch).join("");
    const n=i=>parseInt(hex.slice(i,i+2),16);
    return[n(0),n(2),n(4),hex.length===8?n(6)/255:1];
  }
  const parts=value.match(/[\d.]+%?/g).map(String);
  const alpha=parts[3]===undefined?1:parts[3].endsWith("%")?parseFloat(parts[3])/100:parseFloat(parts[3]);
  return[+parts[0],+parts[1],+parts[2],alpha];
}
const hex2=n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0");
const keyOf=([r,g,b,a])=>hex2(r)+hex2(g)+hex2(b)+(a<1?"-a"+String(Math.round(a*1000)).padStart(3,"0"):"");

const keys=new Map();
let wrapped=0;
for(const name of files){
  const file=path.join(root,name),source=fs.readFileSync(file,"utf8");
  // Her bildirimin değeri ({ ; } veya yorum sonundan sonra gelen "özellik:değer") taranır; iç içe kurallar da dahil.
  const next=source.replace(/(^|[{;}]|\*\/)(\s*[\w-]+\s*:)([^;{}]*)/g,(all,lead,prop,value)=>lead+prop+value.replace(COLOR,match=>{
    if(match.startsWith("var(")){
      const key=match.slice(9,match.indexOf(","));
      keys.set(key,parse(match.slice(match.indexOf(",")+1,-1).trim()));
      return match;
    }
    const rgba=parse(match);if(!rgba)return match;
    const key=keyOf(rgba);keys.set(key,rgba);wrapped++;
    return "var(--kc-"+key+","+match+")";
  }));
  if(next!==source)fs.writeFileSync(file,next);
}

function toHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;
  if(!d)return[0,0,l];
  const s=d/(1-Math.abs(2*l-1));
  const h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return[h*60,s,l];
}
function fromHsl(h,s,l){
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return[(r+m)*255,(g+m)*255,(b+m)*255];
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const css=([r,g,b],a)=>a>=1?"#"+hex2(r)+hex2(g)+hex2(b):"rgba("+[r,g,b].map(Math.round).join(",")+","+(+a.toFixed(3))+")";

// Gece: açık yüzeyler koyu laciverte, koyu yazı açığa, renkler koyu zeminde okunacak kadar açılır.
function night([r,g,b,a]){
  const [h,s,l]=toHsl(r,g,b);
  if(a<1){
    if(l<.35)return css([0,0,0],a<.3?Math.min(.7,a*2.2):Math.min(.88,a*1.35));
    // Koyu yüzeyler açılınca üstlerindeki yarı saydam beyazlar kaybolur; onlar da koyu iz olur.
    if(l>.9&&s<.3)return a>=.5?css([18,26,44],a):css([4,8,18],Math.min(1,a*1.2));
    return css(fromHsl(h,Math.min(1,s),clamp(.6+l*.18,.62,.78)),Math.min(1,a*1.6));
  }
  if(l>=.8){
    if(s<.3||l>.985)return css(fromHsl(222,.38,l>=.995?.118:.13+(1-l)*.75),1);
    return css(fromHsl(h,Math.min(s,.55),.16+(1-l)*.5),1);
  }
  if(l<.3)return css(fromHsl(h,Math.min(s,.3),.92-l*.3),1);
  if(s<.25)return css(fromHsl(h,Math.min(s,.22),.6+(l-.3)*.32),1);
  return css(fromHsl(h,Math.min(1,s*1.05),clamp(.6+l*.18,.62,.78)),1);
}
// Canlı: maviler mora döner, açık nötrler sıcak kum tonuna, koyu nötrler mor-griye.
function vivid([r,g,b,a]){
  const [h,s,l]=toHsl(r,g,b);
  if(s<.25||l>=.97){
    if(l>=.995)return css([r,g,b],a);
    if(l>=.93)return css(fromHsl(34,.42,l),a);
    if(l>=.8)return css(fromHsl(33,Math.min(.3,s+.1),l),a);
    return css(fromHsl(250,s,l),a);
  }
  if(h>=190&&h<=235)return css(fromHsl(252+(h-217)*.3,Math.min(s,.75),l),a);
  return css([r,g,b],a);
}
// Açık temalar: açık gri yazılar (orta açıklıkta nötrler) beyaz zeminde 4.5:1'e ulaşacak kadar koyulaşır.
function readable(rgba,base=([r,g,b,a])=>css([r,g,b],a)){
  const [r,g,b,a]=rgba,[h,s,l]=toHsl(r,g,b);
  // Panelin ana mavisi yazı ve beyaz yazılı düğme zemini olarak 4.5:1'in altında kalıyordu.
  if(keyOf(rgba)==="2873f0"&&base(rgba)==="#2873f0")return"#2366dc";
  if(a<1||s>=.3||l<.5||l>=.72)return null;
  const [h2,s2]=toHsl(...parseCss(base(rgba)));
  return css(fromHsl(h2,s2,.44),1);
}
function parseCss(value){return value.startsWith("#")?parse(value).slice(0,3):value.match(/[\d.]+/g).slice(0,3).map(Number)}

const sorted=[...keys.keys()].sort();
const lines=map=>sorted.map(key=>{const value=map(keys.get(key));return value?"--kc-"+key+":"+value+";":""}).join("");
fs.writeFileSync(path.join(root,OUT),
  "/* Üretildi: scripts/coach-theme-tokens.mjs — elle düzenleme. Sade Mavi = var() yedekleri + okunur griler. */\n"
  +":root:not([data-theme]){"+lines(rgba=>readable(rgba))+"}\n"
  +":root[data-theme=\"night\"]{color-scheme:dark;"+lines(night)+"}\n"
  +":root[data-theme=\"vivid\"]{"+lines(rgba=>readable(rgba,vivid)||vivid(rgba))+"}\n");
console.log(files.length+" dosya, "+wrapped+" yeni sarma, "+sorted.length+" renk anahtarı");
