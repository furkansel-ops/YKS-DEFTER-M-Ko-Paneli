/* v70 · Denemeden göreve: son denemeden en fazla 3 görev önerisi çıkarır.
   Önce Hata Defteri'nde o denemeye bağlı yanlışlar (konu konu), yetmezse ders sonuçları
   (yanlış sayısı + aynı türdeki önceki denemeye göre net düşüşü). Saf fonksiyonlar; DOM ve ağ yok. */
(function(root){"use strict";
const list=value=>Array.isArray(value)?value:[];
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
const str=(value,max)=>String(value??"").trim().slice(0,max);

function examTaskSuggestions(share,limit=3){
  const exams=list(share?.exams).filter(x=>x&&typeof x==="object")
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||num(b.id)-num(a.id));
  const exam=exams[0];if(!exam)return{exam:null,items:[]};
  const id=String(exam.id??"");
  const topics=new Map();
  if(id)for(const e of list(share?.errorJournal)){
    if(String(e?.exam??"")!==id)continue;
    const subject=str(e?.subject,60)||"Ders",topic=str(e?.topic,100);if(!topic)continue;
    const key=subject+"|"+topic,cur=topics.get(key)||{kind:"topic",key,subject,topic,wrong:0};
    cur.wrong+=Math.max(1,Math.floor(num(e?.n)||1));topics.set(key,cur);
  }
  const items=[...topics.values()].sort((a,b)=>b.wrong-a.wrong||a.topic.localeCompare(b.topic,"tr")).slice(0,limit)
    .map(x=>({...x,text:x.topic+": konu tekrarı + 30 soru"}));
  if(items.length<limit){
    const used=new Set(items.map(x=>x.subject));
    const prev=exams.slice(1).find(x=>String(x.type||"")===String(exam.type||""));
    const prevNet=new Map(list(prev?.subjectResults).map(x=>[str(x?.name,60),num(x?.net)]));
    const subjects=list(exam.subjectResults).map(x=>{
      const subject=str(x?.name,60),wrong=Math.max(0,Math.floor(num(x?.y)));
      const drop=prevNet.has(subject)?Math.max(0,prevNet.get(subject)-num(x?.net)):0;
      return{kind:"subject",key:subject,subject,topic:"",wrong,drop:Math.round(drop*100)/100};
    }).filter(x=>x.subject&&!used.has(x.subject)&&(x.wrong>0||x.drop>0))
      .sort((a,b)=>(b.wrong+b.drop*2)-(a.wrong+a.drop*2)||a.subject.localeCompare(b.subject,"tr"));
    for(const x of subjects.slice(0,limit-items.length))items.push({...x,text:x.subject+": denemedeki yanlışların çözümü + 20 soru"});
  }
  return{exam:{id,name:str(exam.name,100)||str(exam.type,16)||"Deneme",date:str(exam.date,10),type:str(exam.type,16)},items};
}

const fmt=n=>String(Math.round(n*100)/100).replace(".",",");
function examTaskReason(item){
  if(item.kind==="topic")return item.wrong+" yanlış · Hata Defteri";
  return [item.wrong?item.wrong+" yanlış":"",item.drop?"net "+fmt(item.drop)+" düştü":""].filter(Boolean).join(" · ");
}

/* esc: sayfanın HTML kaçırıcısı. sent: gönderilen önerilerin anahtarları. */
function examTasksHtml(result,{esc,minDate,date,sent=new Set(),status={}}){
  if(!result?.exam)return"";
  const head='<div class="exam-tasks-v70-head"><b>Deneme sonrası öneriler</b><small>'+esc(result.exam.name)+(result.exam.date?" · "+esc(result.exam.date):"")+'</small></div>';
  if(!result.items.length)return'<div class="exam-tasks-v70">'+head+'<p class="exam-tasks-v70-empty">Bu denemede öne çıkan yanlış yok.</p></div>';
  return'<div class="exam-tasks-v70">'+head+result.items.map((item,i)=>{
    const done=sent.has(item.key),note=status[item.key];
    return'<div class="exam-tasks-v70-row" data-exam-task="'+i+'">'
      +'<div class="exam-tasks-v70-copy"><b>'+esc(item.subject)+(item.topic?" · "+esc(item.topic):"")+'</b><small>'+esc(examTaskReason(item))+'</small></div>'
      +(done?'<span class="exam-tasks-v70-done">Gönderildi ✓</span>'
        :'<input class="field" data-exam-task-text maxlength="300" aria-label="Görev metni" value="'+esc(item.text)+'">'
        +'<input class="field" type="date" data-exam-task-date aria-label="Görev günü" min="'+esc(minDate)+'" value="'+esc(date)+'">'
        +'<button class="btn primary" type="button" data-exam-task-send>Programa gönder</button>')
      +(note?'<small class="exam-tasks-v70-status'+(note.error?" err":"")+'" role="status">'+esc(note.text)+'</small>':"")
      +'</div>';
  }).join("")+'</div>';
}
const api={examTaskSuggestions,examTaskReason,examTasksHtml};
root.YKSExamTasksV70=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
