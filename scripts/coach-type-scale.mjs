// Koç paneli yazı boyutları: 11px altındaki sabit font-size değerlerini okunur alt sınıra çeker.
// İlk geçişte (v37) 12px altı her şey büyütüldü: <7.5px → 11px, 7.5–9px → 11.5px, 9–12px → 12px.
// Bu betik artık yalnız yeni eklenen küçük yazıları yakalar ve tekrar çalıştırmak güvenlidir:
// <7.5px → 11px, 7.5–9px → 11.5px, 9–11px → 12px; 11px ve üstü olduğu gibi kalır.
// Kullanım: node scripts/coach-type-scale.mjs [klasör]   (varsayılan: depo kökü)
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),".."));
const scaledSize=px=>px>=11?px:px<7.5?11:px<9?11.5:12;
let changed=0;
for(const name of fs.readdirSync(root).filter(file=>file.endsWith(".css"))){
  const file=path.join(root,name),source=fs.readFileSync(file,"utf8");
  const next=source.replace(/(font-size\s*:\s*)(\d+(?:\.\d+)?)px/g,(all,lead,value)=>{
    const px=Number(value),size=scaledSize(px);
    if(size===px)return all;
    changed++;return lead+size+"px";
  });
  if(next!==source)fs.writeFileSync(file,next);
}
console.log(root+": "+changed+" yazı boyutu büyütüldü");
