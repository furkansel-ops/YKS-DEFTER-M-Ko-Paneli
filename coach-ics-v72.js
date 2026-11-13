/* v72 · Randevuları takvime aktar: onaylı ve henüz geçmemiş randevulardan .ics (iCalendar) metni üretir.
   Google Takvim, Apple Takvim ve Outlook bu dosyayı içe aktarır. Saat koçun tarayıcı saat diliminden UTC'ye çevrilir. */
(function(root){"use strict";
const esc=value=>String(value??"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
const utc=date=>date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");

function appointmentsIcs(list,nameFor,now=new Date()){
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//YKS Defterim//Koc Paneli//TR","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  let count=0;
  for(const appt of Array.isArray(list)?list:[]){
    if(appt?.status!=="confirmed"||!/^\d{4}-\d{2}-\d{2}$/.test(appt.date||"")||!/^\d{2}:\d{2}$/.test(appt.time||""))continue;
    const start=new Date(appt.date+"T"+appt.time+":00");
    if(Number.isNaN(start.getTime())||start<=now)continue;
    const end=new Date(start.getTime()+(Number(appt.duration)||30)*60000);
    // shortcut: 75 baytta satır katlama yok; takvim uygulamaları uzun satırı okuyor, sorun çıkarsa katla.
    lines.push("BEGIN:VEVENT","UID:"+esc(appt.id)+"@yks-koc-paneli","DTSTAMP:"+utc(now),"DTSTART:"+utc(start),"DTEND:"+utc(end),
      "SUMMARY:"+esc("Görüşme: "+(nameFor?.(appt.studentUid)||"Öğrenci")));
    if(appt.topic)lines.push("DESCRIPTION:"+esc(appt.topic));
    if(/^https:\/\/\S+$/.test(appt.link||""))lines.push("URL:"+esc(appt.link),"LOCATION:"+esc(appt.link));
    lines.push("END:VEVENT");count++;
  }
  lines.push("END:VCALENDAR");
  return{count,text:lines.join("\r\n")+"\r\n"};
}

const api={appointmentsIcs};
root.YKSCoachIcsV72=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
