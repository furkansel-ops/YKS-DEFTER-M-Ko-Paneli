const CAL_VERSION="1.9.0";
const DAYS=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
const MONTHS=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parse=k=>{const d=new Date(`${k}T12:00:00`);return Number.isNaN(d.getTime())?null:d};
const add=(k,n)=>{const d=parse(k);d.setDate(d.getDate()+n);return key(d)};
function selectedWeek(host){return host.querySelector(".program-week-title small")?.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0]||""}
function readCards(host){
 const cards=[...host.querySelectorAll(".program-card")];if(cards.length<2)return null;
 const out={days:Array.from({length:7},()=>({tasks:[],filled:0,done:0}))};
 for(const card of cards.slice(0,2)){const table=card.querySelector(".program-table");if(!table)continue;const cells=[...table.querySelectorAll(":scope > .program-cell")],labels=[...table.querySelectorAll(":scope > .program-row-label")];
  for(let r=0;r<labels.length;r++)for(let d=0;d<7;d++){const c=cells[r*7+d],task=c?.classList.contains("has-task")?(c.querySelector("span")?.textContent||"").trim():"";if(!task)continue;out.days[d].filled++;if(c.classList.contains("is-done"))out.days[d].done++;out.days[d].tasks.push({text:task,done:c.classList.contains("is-done"),moved:c.classList.contains("is-moved")});}}
 return out;
}
function fmt(k){const d=parse(k);return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",weekday:"long"}).format(d)}
function calendar(monthDate,weekKey,data,selected){
 const y=monthDate.getFullYear(),m=monthDate.getMonth(),first=new Date(y,m,1,12),last=new Date(y,m+1,0,12),offset=(first.getDay()+6)%7,cells=[];
 for(let i=0;i<offset;i++)cells.push('<button class="coach-cal-day blank" disabled></button>');
 for(let n=1;n<=last.getDate();n++){const dk=key(new Date(y,m,n,12)),idx=weekKey&&dk>=weekKey&&dk<=add(weekKey,6)?Math.round((parse(dk)-parse(weekKey))/86400000):-1,st=idx>=0?data.days[idx]:null,pct=st?.filled?Math.round(st.done/st.filled*100):0;
  cells.push(`<button class="coach-cal-day ${st?.filled?"planned":""} ${pct===100?"done":""} ${dk===selected?"selected":""}" data-cal-date="${dk}"><span>${n}</span>${st?.filled?`<small>${st.done}/${st.filled}</small>`:""}</button>`);}
 return `<section class="coach-calendar-card"><div class="coach-calendar-head"><button type="button" data-cal-shift="-1">‹</button><h3>${MONTHS[m]} ${y}</h3><button type="button" data-cal-shift="1">›</button></div><div class="coach-calendar-weekdays">${["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map(x=>`<span>${x}</span>`).join("")}</div><div class="coach-calendar-grid">${cells.join("")}</div><div class="coach-calendar-legend"><span><i></i>Plan var</span><span><i></i>Tamamlandı</span><span><i></i>Seçili gün</span></div></section>`;
}
function detail(date,weekKey,data){
 const idx=weekKey&&date>=weekKey&&date<=add(weekKey,6)?Math.round((parse(date)-parse(weekKey))/86400000):-1,st=idx>=0?data.days[idx]:{tasks:[],filled:0,done:0},pct=st.filled?Math.round(st.done/st.filled*100):0;
 return `<section class="coach-day-card"><h3>${esc(fmt(date))}</h3><div class="coach-day-metrics"><div><span>Plan sadakati</span><b>${st.done}/${st.filled} · %${pct}</b></div><div><span>Günü tamamladım</span><b>${st.filled&&st.done===st.filled?"Evet":"Hayır"}</b></div></div><h4>Günün planı</h4><div class="coach-day-tasks">${st.tasks.length?st.tasks.map(t=>`<div class="${t.done?"done":""}"><i>${t.done?"✓":"–"}</i><span>${esc(t.text)}</span></div>`).join(""):'<p>Bu gün için kayıtlı görev yok.</p>'}</div></section>`;
}
function analytics(data){
 const bars=data.days.map((d,i)=>{const pct=d.filled?Math.round(d.done/d.filled*100):0;return`<div class="coach-analysis-row"><span>${DAYS[i].slice(0,3)}</span><i><em style="width:${pct}%"></em></i><b>${d.filled?"%"+pct:"—"}</b></div>`}).join("");
 return `<section class="coach-analysis-card"><h3>Erteleme analizi</h3><small>Güne göre tamamlama</small>${bars}</section>`;
}
function enhance(){
 const host=document.getElementById("content");if(!host||host.dataset.coachCalendar==="1")return;
 const shell=host.querySelector(".program-student-shell"),cards=[...host.querySelectorAll(".program-card")];if(!shell||cards.length<2)return;
 const weekKey=selectedWeek(host),data=readCards(host);if(!weekKey||!data)return;
 host.dataset.coachCalendar="1";let selected=add(weekKey,6),month=parse(selected);
 const wrap=document.createElement("div");wrap.className="coach-program-dashboard";
 function draw(){wrap.innerHTML=`<div class="coach-program-switch"><button class="on" type="button">Haftalık plan</button><button type="button">Takvim</button></div><div class="coach-program-calendar-layout">${calendar(month,weekKey,data,selected)}${detail(selected,weekKey,data)}</div>${analytics(data)}`;
  wrap.querySelectorAll("[data-cal-date]").forEach(b=>b.onclick=()=>{selected=b.dataset.calDate;draw()});
  wrap.querySelectorAll("[data-cal-shift]").forEach(b=>b.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+Number(b.dataset.calShift),1,12);draw()});
 }
 draw();shell.append(wrap);
}
let queued=false;function run(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance()})}
new MutationObserver(()=>{const h=document.getElementById("content");if(h&&!h.querySelector(".program-student-shell"))delete h.dataset.coachCalendar;run()}).observe(document.getElementById("content"),{childList:true,subtree:true});run();
window.__YKS_COACH_PROGRAM_CALENDAR__={version:CAL_VERSION,refresh:run};