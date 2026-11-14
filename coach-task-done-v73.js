/* v73 · Görev tamamlandı bildirimi: öğrencinin paylaşımı canlı güncellenince önceki haline göre
   yeni tamamlanan program görevlerini bulur. Görev listesi app-reset.js'deki collectProgramDayTasks ile gelir;
   burada DOM ve ağ yok. Bir görev, günü tümden "tamam" işaretliyse ya da görev tek tek işaretliyse tamamdır. */
(function(root){"use strict";
const weeksOf=share=>Array.isArray(share?.program?.weeks)?share.program.weeks.filter(w=>w&&typeof w==="object"):[];
const isDone=(week,day,id)=>Boolean(week?.data?.done?.[day])||Boolean(week?.data?.dn?.[id]);

/** prev yoksa (ilk yükleme) boş döner; böylece panel açılışında eski tamamlananlar bildirilmez. */
function newlyDoneTasks(prevShare,nextShare,collect){
  if(!prevShare||!nextShare||typeof collect!=="function")return[];
  const before=new Map(weeksOf(prevShare).map(w=>[String(w.week||""),w])),out=[];
  for(const week of weeksOf(nextShare)){
    const key=String(week.week||""),old=before.get(key);
    for(let day=0;day<7;day++)for(const task of collect(nextShare.program||{},week,day)||[]){
      if(isDone(week,day,task.id)&&!isDone(old,day,task.id))out.push({week:key,day,id:String(task.id),text:String(task.text||"").slice(0,140)});
    }
  }
  return out;
}

/** Bildirim metni: tek görevde görevin kendisi, çoğunda sayı ve ilk görev. */
function taskDoneMessage(items){
  if(!items.length)return"";
  if(items.length===1)return"Görevi tamamladı: "+items[0].text;
  return items.length+" görev tamamladı · "+items[0].text;
}

const api={newlyDoneTasks,taskDoneMessage};
root.CoachTaskDone=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
