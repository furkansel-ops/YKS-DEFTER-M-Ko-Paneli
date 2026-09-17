const DAYS_FULL=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
const DAYS_SHORT=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const MIRROR_VERSION="1.3.0";

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

function localDateKey(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return`${y}-${m}-${d}`;
}
function mondayKeyLocal(date=new Date()){
  const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return localDateKey(d);
}
function selectedWeekKey(host){
  const raw=host.querySelector(".program-week-title small")?.textContent||"";
  return raw.match(/\d{4}-\d{2}-\d{2}/)?.[0]||"";
}
function selectedWeekIsCurrent(host){return selectedWeekKey(host)===mondayKeyLocal()}

function readProgramTable(card){
  const table=card?.querySelector(".program-table");if(!table)return null;
  const heads=[...table.querySelectorAll(":scope > .program-day-head")].slice(0,7);
  const labels=[...table.querySelectorAll(":scope > .program-row-label")];
  const rawCells=[...table.querySelectorAll(":scope > .program-cell")];
  const rows=[];
  for(let r=0;r<labels.length;r++){
    const cells=[];
    for(let d=0;d<7;d++){
      const cell=rawCells[r*7+d];
      const hasTask=Boolean(cell?.classList.contains("has-task"));
      const task=hasTask?(cell?.querySelector("span")?.textContent||"").trim():"";
      cells.push({task,done:Boolean(cell?.classList.contains("is-done")),moved:Boolean(cell?.classList.contains("is-moved"))});
    }
    rows.push({label:(labels[r]?.textContent||"").trim(),cells});
  }
  return{rows,dayDone:heads.map(head=>head.classList.contains("day-complete"))};
}
function dayStats(routines,study){
  return Array.from({length:7},(_,d)=>{
    let filled=0,done=0;
    for(const model of[routines,study])for(const row of model?.rows||[]){const cell=row.cells[d];if(!cell?.task)continue;filled++;if(cell.done)done++}
    return{filled,done,pct:filled?Math.round(done/filled*100):0};
  });
}
function weekStats(days){
  const filled=days.reduce((sum,item)=>sum+item.filled,0),done=days.reduce((sum,item)=>sum+item.done,0);
  return{filled,done,pct:filled?Math.round(done/filled*100):0};
}
function weekOverview(days,isCurrent){
  const total=weekStats(days),today=isCurrent?((new Date().getDay()+6)%7):-1;
  let message=total.filled?`${total.done}/${total.filled} görev tamamlandı · %${total.pct}`:"Bu hafta henüz görev yok";
  if(total.filled&&total.done===total.filled)message="Haftanın tüm görevleri tamamlandı ✓";
  const chips=days.map((item,d)=>`<div class="student-program-day-chip ${d===today?"today":""} ${item.filled&&item.done===item.filled?"all-done":""}"><span>${DAYS_SHORT[d]}</span><b>${item.filled?`${item.done}/${item.filled}`:"—"}</b><i><em style="width:${item.pct}%"></em></i></div>`).join("");
  return`<section class="student-program-week-overview" aria-label="Haftalık ilerleme"><div class="student-program-week-top"><div><span>Haftalık ilerleme</span><b>${escapeHtml(message)}</b></div><strong>${total.pct}%</strong></div><div class="student-program-week-bar"><i style="width:${total.pct}%"></i></div><div class="student-program-day-chips">${chips}</div></section>`;
}
function headHtml(d,days,isCurrent){
  const today=isCurrent&&d===((new Date().getDay()+6)%7),item=days[d];
  return`<div class="student-program-cell student-program-head ${today?"today-col":""}"><span>${DAYS_FULL[d]}</span><small>${item.filled?`${item.done}/${item.filled}`:"—"}</small></div>`;
}
function taskCellHtml(cell,d,isCurrent){
  const today=isCurrent&&d===((new Date().getDay()+6)%7);
  if(!cell?.task)return`<div class="student-program-cell student-program-task ${today?"today-col":""}"><span class="student-program-empty"> </span></div>`;
  const status=cell.done?"Tamamlandı":cell.moved?"Önceki günden taşındı":"Planlandı";
  return`<div class="student-program-cell student-program-task ${cell.done?"is-done":""} ${cell.moved?"is-moved":""} ${today?"today-col":""}" title="${escapeHtml(status)}"><span class="student-program-tick" aria-hidden="true">${cell.done?"✓":""}</span>${cell.moved?'<span class="student-program-moved" aria-hidden="true">→</span>':""}<span class="student-program-text">${escapeHtml(cell.task)}</span></div>`;
}
function routineGrid(model,days,isCurrent){
  let html='<div class="student-program-cell student-program-empty-head"></div>'+[0,1,2,3,4].map(d=>headHtml(d,days,isCurrent)).join("")+'<div class="student-program-spacer"></div>'+[5,6].map(d=>headHtml(d,days,isCurrent)).join("");
  html+=`<div class="student-program-cell student-program-tag" style="grid-row:span ${Math.max(1,model.rows.length)}">RUTİNLER</div>`;
  for(const row of model.rows)html+=[0,1,2,3,4].map(d=>taskCellHtml(row.cells[d],d,isCurrent)).join("")+'<div class="student-program-spacer"></div>'+[5,6].map(d=>taskCellHtml(row.cells[d],d,isCurrent)).join("");
  return`<div class="student-program-scroller"><div class="student-program-grid student-program-routines">${html}</div></div>`;
}
function dayDoneHtml(d,dayDone,days,isCurrent){
  const today=isCurrent&&d===((new Date().getDay()+6)%7),item=days[d],on=Boolean(dayDone[d]);
  return`<div class="student-program-cell student-program-day-done ${on?"on":""} ${today?"today-col":""}"><span class="student-program-check-box" aria-hidden="true"></span><span>Günü tamamladım${item.filled?`<small>${item.done}/${item.filled}</small>`:""}</span></div>`;
}
function studyGrid(model,days,isCurrent){
  let html='<div class="student-program-bar">DERS PROGRAMIM</div>';
  for(const row of model.rows){
    html+=`<div class="student-program-cell student-program-row-label">${escapeHtml(row.label||"Ders")}</div>`+[0,1,2,3,4].map(d=>taskCellHtml(row.cells[d],d,isCurrent)).join("")+'<div class="student-program-spacer"></div>'+[5,6].map(d=>taskCellHtml(row.cells[d],d,isCurrent)).join("");
  }
  html+='<div class="student-program-cell student-program-empty-head"></div>'+[0,1,2,3,4].map(d=>dayDoneHtml(d,model.dayDone,days,isCurrent)).join("")+'<div class="student-program-spacer"></div>'+[5,6].map(d=>dayDoneHtml(d,model.dayDone,days,isCurrent)).join("");
  return`<div class="student-program-scroller"><div class="student-program-grid student-program-study">${html}</div></div>`;
}
function adaptWeekNavigation(host,isCurrent){
  const toolbar=host.querySelector(".program-toolbar"),nav=toolbar?.querySelector(".program-nav"),title=toolbar?.querySelector(".program-week-title");
  if(!toolbar||!nav||!title)return;
  const buttons=[...nav.querySelectorAll("button")];if(buttons.length<3)return;
  const[prev,current,next]=buttons,range=title.querySelector("h3")?.textContent?.trim()||"Hafta",meta=title.querySelector("small")?.textContent?.trim()||"";
  toolbar.classList.add("student-program-toolbar");nav.classList.add("student-program-weeknav");title.classList.add("student-program-original-week-title");
  prev.textContent="‹";prev.setAttribute("aria-label","Önceki hafta");next.textContent="›";next.setAttribute("aria-label","Sonraki hafta");
  current.classList.add("student-program-week-center");current.innerHTML=`<span>${escapeHtml(range)}</span><small>${isCurrent?"bu hafta":escapeHtml(meta.replace(/^\d{4}-\d{2}-\d{2}\s*·?\s*/,""))}</small>`;
}
function enhanceProgram(){
  const host=document.getElementById("content");if(!host||host.querySelector(".program-student-shell"))return;
  const cards=[...host.querySelectorAll(".program-card")];if(cards.length<2)return;
  const routines=readProgramTable(cards[0]),study=readProgramTable(cards[1]);if(!routines||!study)return;
  const isCurrent=selectedWeekIsCurrent(host),days=dayStats(routines,study),main=host.querySelector(".program-main");if(!main)return;
  adaptWeekNavigation(host,isCurrent);
  host.querySelector(".program-metrics")?.remove();
  const shell=document.createElement("div");shell.className="program-student-shell";shell.dataset.mirrorVersion=MIRROR_VERSION;shell.setAttribute("aria-label","YKS Defterim Programım aynası");
  shell.innerHTML=`<div class="student-program-title">Haftalık plan · Klasik+</div>${weekOverview(days,isCurrent)}${routineGrid(routines,days,isCurrent)}${studyGrid(study,days,isCurrent)}<p class="student-program-hint">Bu görünüm öğrencinin YKS Defterim → Programım ekranını canlı ve salt okunur olarak aynalar. Tamamlanan görevler, taşınan görevler ve gün durumu öğrenci uygulamasındaki kayıtla birlikte güncellenir.</p>`;
  main.replaceChildren(shell);
}

let scheduled=false;
function scheduleEnhance(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;enhanceProgram()})}
const content=document.getElementById("content");
if(content){new MutationObserver(scheduleEnhance).observe(content,{childList:true,subtree:true});scheduleEnhance()}
window.__YKS_COACH_PROGRAM_MIRROR__={version:MIRROR_VERSION,refresh:scheduleEnhance};
