/** Saf kural hesapları: tarayıcı ve Node testleri aynı modülü kullanır. */
export const rewardByDifficulty=Object.freeze({easy:20,normal:35,hard:50});
export function dayKey(date){
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
export function dateFromKey(key){
  const date=new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,Number(key.slice(8)),12);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||dayKey(date)!==key)throw Error("Tarih geçersiz");
  return date;
}
export function plusDays(key,days){
  const date=dateFromKey(key);date.setDate(date.getDate()+days);return dayKey(date);
}
export function mondayOf(key){
  const date=dateFromKey(key);return plusDays(key,-((date.getDay()+6)%7));
}
export function challengeId(studentUid,coachUid,week,slot){
  if(!studentUid||!coachUid)throw Error("Öğrenci/koç eksik");
  dateFromKey(week);
  if(!/^(?:[012]|free-[A-Za-z0-9]{8,24})$/.test(String(slot)))throw Error("Geçersiz görev bölümü");
  // A rewarded slot is student-scoped across ALL coaches. Unrewarded stays coach-scoped.
  return /^[012]$/.test(String(slot))?
    studentUid+"_"+week+"_"+slot:
    studentUid+"_"+coachUid+"_"+week+"_"+slot;
}
export function availableRewardSlot(existing,studentUid,coachUid,week){
  const used=new Set(existing.filter(x=>x.studentUid===studentUid&&x.coachUid===coachUid&&
    x.weekStart===week&&Number(x.xp)>0).map(x=>String(x.slot)));
  return ["0","1","2"].find(x=>!used.has(x))??null;
}
export function validateChallengeInput(draft,now=new Date()){
  const start=String(draft.startDay||"").trim();
  const due=String(draft.dueDay||"").trim();
  dateFromKey(start);dateFromKey(due);
  if(start<=dayKey(now))throw Error("Ödüllü görev en erken yarın başlayabilir.");
  if(due<start)throw Error("Son tarih başlangıçtan önce olamaz.");
  if(due>plusDays(start,30))throw Error("Görev süresi 30 günü geçemez.");
  const title=String(draft.title||"").trim(),subject=String(draft.subject||"").trim(),
    note=String(draft.note||"").trim(),kind=String(draft.kind||""),
    difficulty=String(draft.difficulty||"normal");
  if(title.length<3||title.length>120)throw Error("Görev başlığı 3–120 karakter olmalı.");
  if(subject.length>100||note.length>500)throw Error("Açıklama çok uzun.");
  if(!["minutes","questions","both","manual"].includes(kind))throw Error("Görev türü geçersiz");
  if(!(difficulty in rewardByDifficulty))throw Error("Zorluk geçersiz");
  const minutes=kind==="minutes"||kind==="both"?Number(draft.goalMinutes):0;
  const questions=kind==="questions"||kind==="both"?Number(draft.goalQuestions):0;
  if(!Number.isInteger(minutes)||minutes<0||minutes>480||
    !Number.isInteger(questions)||questions<0||questions>300)throw Error("Hedefler sınır dışında");
  if(kind!=="manual"&&minutes===0&&questions===0)throw Error("Ölçülebilir bir hedef gerekli");
  if((kind==="minutes"||kind==="both")&&minutes===0)throw Error("Süre hedefi gerekli");
  if((kind==="questions"||kind==="both")&&questions===0)throw Error("Soru hedefi gerekli");
  return {title,subject,note,kind,difficulty,goalMinutes:minutes,goalQuestions:questions,
    startDay:start,dueDay:due,weekStart:mondayOf(start)};
}
export function nextState(kind,current,action){
  if(action==="cancel"&&["assigned","in_progress","submitted"].includes(current))return "cancelled";
  if(action==="approve"&&kind==="manual"&&current==="submitted")return "approved";
  throw Error("Bu durum değişikliğine izin verilmiyor.");
}
