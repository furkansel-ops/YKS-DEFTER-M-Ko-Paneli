/* v74 · Pano › Geçen hafta: her öğrencinin geçen takvim haftası (Pzt–Paz) ve bir önceki haftayla farkı.
   Süre ve soru progress.daily31'den, denemeler exams'ten, yanlışlar errorJournal'dan, görev uyumu
   program.weeks'ten gelir. Görev listesi app-reset.js'deki collectProgramDayTasks ile verilir. Saf; DOM ve ağ yok. */
(function(root){"use strict";
const list=value=>Array.isArray(value)?value:[];
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
const DATE=/^\d{4}-\d{2}-\d{2}$/;

function addDays(key,days){const d=new Date(key+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}

/** Bir haftanın özeti; weekStart Pazartesi (YYYY-MM-DD). */
function weekSummary(share,weekStart,collect){
  const end=addDays(weekStart,6),inWeek=date=>DATE.test(String(date||""))&&date>=weekStart&&date<=end;
  const days=list(share?.progress?.daily31).filter(d=>inWeek(d?.date));
  const exams=list(share?.exams).filter(x=>inWeek(x?.date));
  const out={minutes:0,questions:0,exams:exams.length,avgNet:0,wrongs:0,tasksDone:0,tasksTotal:0,hasDays:days.length>0};
  for(const d of days){out.minutes+=Math.max(0,Math.round(num(d.minutes)));out.questions+=Math.max(0,Math.round(num(d.questions)))}
  if(exams.length)out.avgNet=Math.round(exams.reduce((a,x)=>a+num(x.totalNet),0)/exams.length*100)/100;
  for(const e of list(share?.errorJournal))if(inWeek(e?.date))out.wrongs+=Math.max(1,Math.floor(num(e.n)||1));
  const week=list(share?.program?.weeks).find(w=>w?.week===weekStart);
  if(week&&typeof collect==="function")for(let day=0;day<7;day++)for(const task of collect(share.program||{},week,day)||[]){
    out.tasksTotal++;if(week.data?.done?.[day]||week.data?.dn?.[task.id])out.tasksDone++;
  }
  return out;
}

/** Öğrenci başına geçen hafta ve önceki hafta; en az çalışan en üstte (koçun önce bakması gereken). */
function weeklyRows(rows,thisWeekStart,collect){
  const last=addDays(thisWeekStart,-7),prev=addDays(thisWeekStart,-14);
  return list(rows).filter(r=>r?.share).map(row=>({row,last:weekSummary(row.share,last,collect),prev:weekSummary(row.share,prev,collect)}))
    .sort((a,b)=>a.last.minutes-b.last.minutes);
}

/** Önceki haftaya göre süre farkı yüzdesi; önceki hafta veri yoksa null. */
function minutesChange(last,prev){
  if(!prev.hasDays||!prev.minutes)return null;
  return Math.round((last.minutes-prev.minutes)/prev.minutes*100);
}

function weeklyHtml(items,{esc,name,fmtMinutes}){
  if(!items.length)return'<p class="coach-v74-empty">Öğrenci paylaşımı geldikçe geçen haftanın özeti burada görünür.</p>';
  return'<div class="coach-v74-list">'+items.map(({row,last,prev})=>{
    const change=minutesChange(last,prev);
    const trend=change===null?"":'<span class="coach-v74-trend '+(change>=0?"up":"down")+'" title="Önceki haftaya göre çalışma süresi">'+(change>=0?"▲ %":"▼ %")+Math.abs(change)+'</span>';
    const tasks=last.tasksTotal?last.tasksDone+"/"+last.tasksTotal+" görev":"Program yok";
    const facts=[tasks,last.questions+" soru",last.exams?last.exams+" deneme · ort. "+String(last.avgNet).replace(".",",")+" net":"Deneme yok",last.wrongs?last.wrongs+" yanlış kaydı":""].filter(Boolean);
    return'<button type="button" class="coach-v74-row" data-v74-student="'+esc(row.studentUid)+'"><span class="coach-v74-name"><b>'+esc(name(row))+'</b><small>'+esc(facts.join(" · "))+'</small></span><span class="coach-v74-min"><b>'+esc(fmtMinutes(last.minutes))+'</b>'+trend+'</span></button>';
  }).join("")+'</div>';
}

const api={addDays,weekSummary,weeklyRows,minutesChange,weeklyHtml};
root.CoachWeekly=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
