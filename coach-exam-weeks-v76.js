/* v76 · Denemeler › Hafta hafta: öğrencinin planladığı denemeler (progress.examPlans) ve girdiği sonuçlar (exams)
   Pazartesi–Pazar haftalarına ayrılır. Koçun planı coach_note/exam_plan_add olarak gider (Firestore kuralı değişmez);
   öğrenci uygulaması Deneme takvimine ekler. Saf fonksiyonlar; DOM ve ağ yok. */
(function(root){"use strict";
const list=value=>Array.isArray(value)?value:[];
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const TYPES=["TYT","AYT","YDT","BRANS"],TYPE_LABEL={TYT:"TYT",AYT:"AYT",YDT:"YDT",BRANS:"Branş"};
const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"],DAYS=["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];

function addDays(key,days){const d=new Date(key+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
const realDate=key=>DATE.test(String(key||""))&&addDays(key,0)===key;
const weekday=key=>new Date(key+"T12:00:00Z").getUTCDay();
function mondayOf(key){return addDays(key,-((weekday(key)+6)%7))}
const dayLabel=key=>DAYS[weekday(key)]+" "+Number(key.slice(8,10))+" "+MONTHS[Number(key.slice(5,7))-1];
function weekLabel(start,end){
  const a=Number(start.slice(8,10)),b=Number(end.slice(8,10)),ma=MONTHS[Number(start.slice(5,7))-1],mb=MONTHS[Number(end.slice(5,7))-1];
  return ma===mb?a+"–"+b+" "+mb:a+" "+ma+" – "+b+" "+mb;
}

/** Bugünün haftası ortada: `past` hafta geri, `future` hafta ileri; eskiden yeniye. */
function examWeeks(share,today,{past=4,future=4}={}){
  const now=mondayOf(today),weeks=[];
  for(let i=-past;i<=future;i++){const start=addDays(now,7*i);weeks.push({start,end:addDays(start,6),offset:i,plans:[],exams:[]})}
  const find=date=>realDate(date)?weeks.find(w=>date>=w.start&&date<=w.end):null;
  const exams=list(share?.exams).filter(e=>find(e?.date)).map(e=>({date:e.date,name:String(e.name||"Deneme"),type:String(e.type||"").toLocaleUpperCase("tr-TR"),net:num(e.totalNet)}));
  for(const e of exams)find(e.date).exams.push(e);
  for(const p of list(share?.progress?.examPlans)){
    const w=find(p?.date);if(!w)continue;
    const type=TYPES.includes(p.type)?p.type:"TYT";
    // Aynı gün aynı türde sonuç girilmişse plan tamamlanmış sayılır; sonuç satırı yeter.
    if(exams.some(e=>e.date===p.date&&e.type===type))continue;
    w.plans.push({date:p.date,name:String(p.name||"Deneme"),type,missed:p.date<today});
  }
  for(const w of weeks){w.plans.sort((a,b)=>a.date.localeCompare(b.date));w.exams.sort((a,b)=>a.date.localeCompare(b.date))}
  return weeks;
}

const fmt=n=>String(Math.round(n*100)/100).replace(".",",");
function examWeeksHtml(weeks,{esc}){
  return'<div class="coach-v76-weeks">'+list(weeks).map(w=>{
    const when=w.offset===0?"Bu hafta":w.offset===1?"Gelecek hafta":w.offset===-1?"Geçen hafta":"";
    const avg=w.exams.length?" · ort. "+fmt(w.exams.reduce((a,e)=>a+e.net,0)/w.exams.length)+" net":"";
    const facts=[when,w.exams.length?w.exams.length+" sonuç"+avg:"",w.plans.length?w.plans.length+" planlı":""].filter(Boolean).join(" · ");
    const items=[...w.exams.map(e=>({...e,kind:"done"})),...w.plans.map(p=>({...p,kind:p.missed?"miss":"plan"}))].sort((a,b)=>a.date.localeCompare(b.date));
    const rows=items.length?'<ul>'+items.map(x=>'<li class="'+x.kind+'"><span class="coach-v76-type">'+esc(TYPE_LABEL[x.type]||x.type||"—")+'</span><span class="coach-v76-name"><b>'+esc(x.name)+'</b><small>'+esc(dayLabel(x.date))+'</small></span><em>'+esc(x.kind==="done"?fmt(x.net)+" net":x.kind==="miss"?"Sonuç girilmedi":"Planlı")+'</em></li>').join("")+'</ul>':'<p class="coach-v76-none">Deneme yok</p>';
    return'<section class="coach-v76-week'+(w.offset===0?" is-now":"")+'"><header><b>'+esc(weekLabel(w.start,w.end))+'</b><small>'+esc(facts)+'</small></header>'+rows+'</section>';
  }).join("")+'</div>';
}

/** Koçun formundan öğrenciye gidecek eylem yükü; hatada {error}. */
function planPayload(input,today){
  const date=String(input?.date||""),type=String(input?.type||""),name=String(input?.name||"").trim().slice(0,80)||(TYPE_LABEL[type]||type)+" denemesi";
  if(!realDate(date))return{error:"Geçerli bir tarih seç."};
  if(date<today)return{error:"Bugün ya da ileri bir tarih seç."};
  if(!TYPES.includes(type))return{error:"Deneme türünü seç."};
  return{payload:{operation:"exam_plan_add",text:"Deneme planı · "+name+" · "+dayLabel(date),date,type,name}};
}

const api={addDays,mondayOf,examWeeks,examWeeksHtml,planPayload};
root.CoachExamWeeks=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
