(()=>{
  "use strict";

  const PAGE_META={
    home:["Ana Sayfa","Öğrencilerinin genel durumunu tek ekrandan takip et."],
    students:["Öğrenciler","Tüm öğrencilerini tek ekranda takip et, filtrele ve yönet."],
    programs:["Programlar","Öğrencilerin çalışma programlarını görüntüle ve takip et."],
    reports:["Takip & Rapor","Öğrencilerinin ilerleyişini analiz et, karşılaştır ve raporla."],
    exams:["Deneme Analizi","Öğrencilerin deneme performansını karşılaştır ve gelişimi incele."],
    topics:["Konular","Konu ilerleyişini, eksikleri ve çalışma durumunu takip et."],
    errors:["Hata Defteri","Tekrar eden hataları ve yoğunlaşan dersleri analiz et."],
    messages:["Mesajlar","Öğrencilere koç notu gönder ve iletişimi tek yerden yönet."],
    settings:["Ayarlar","Koç paneli tercihlerini, bağlantıları ve hesap durumunu yönet."]
  };
  const DAYS=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  const ui={page:"home",detail:false,detailTab:"summary",returnPage:"home",search:"",studentFilter:"all",selectedUid:"",messageUid:"",sessionMessages:new Map(),programWeekByStudent:new Map()};
  let snapshot={user:null,coach:null,students:[],selectedUid:"",tab:"summary"};

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const text=(value,max=200)=>String(value??"").trim().slice(0,max);
  const num=value=>Number(value||0)||0;
  const pct=value=>Math.max(0,Math.min(100,Math.round(num(value))));
  const avg=values=>{const list=values.filter(Number.isFinite);return list.length?list.reduce((a,b)=>a+b,0)/list.length:0};
  const fmt=value=>Number.isFinite(value)?value.toLocaleString("tr-TR",{maximumFractionDigits:1}):"—";
  const initials=name=>text(name,80).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"Ö";
  const core=()=>window.__YKS_COACH_CORE__||null;

  function studentShare(student){return student?.share||{}}
  function studentName(student){return text(student?.name||student?.profile?.displayName,80)||"Öğrenci"}
  function studentTrack(student){return text(student?.track||student?.profile?.track,40)||"YKS"}
  function studentGrade(student){return text(student?.profile?.grade,20)||""}
  function timestampDate(value){
    try{if(value?.toDate)return value.toDate();if(value instanceof Date)return value;const d=new Date(value);return Number.isNaN(d.getTime())?null:d}catch{return null}
  }
  function relativeTime(value){
    const date=timestampDate(value);if(!date)return"canlı";
    const diff=Math.max(0,Date.now()-date.getTime()),min=Math.round(diff/60000);
    if(min<2)return"az önce";if(min<60)return min+" dk önce";
    const hour=Math.round(min/60);if(hour<24)return hour+" sa önce";
    return Math.round(hour/24)+" gün önce";
  }
  function exams(student){
    const list=studentShare(student).exams;
    return Array.isArray(list)?list:[];
  }
  function examInfo(student){
    const list=exams(student),latest=list.at(-1)||null,previous=list.at(-2)||null;
    const latestNet=latest?num(latest.totalNet):null,previousNet=previous?num(previous.totalNet):null;
    return{list,latest,previous,latestNet,previousNet,delta:latestNet!==null&&previousNet!==null?latestNet-previousNet:null};
  }
  function topics(student){
    const list=studentShare(student)?.topics?.items;
    return Array.isArray(list)?list.filter(Boolean):[];
  }
  function topicInfo(student){
    const list=topics(student),complete=list.filter(item=>num(item.st)>=3).length,active=list.filter(item=>num(item.st)>0&&num(item.st)<3).length;
    const now=new Date().toISOString().slice(0,10),overdue=list.filter(item=>item?.deadline&&String(item.deadline)<now&&num(item.st)<3).length;
    return{list,complete,active,notstarted:Math.max(0,list.length-complete-active),overdue,pct:list.length?Math.round(complete/list.length*100):0};
  }
  function errors(student){
    const list=studentShare(student).errorJournal;
    return Array.isArray(list)?list.filter(Boolean):[];
  }
  function errorCount(student){return errors(student).reduce((sum,item)=>sum+Math.max(1,num(item?.n||item?.count||1)),0)}
  function programModel(student){
    const p=studentShare(student).program||{},weeks=(Array.isArray(p.weeks)?p.weeks:[]).filter(w=>/^\d{4}-\d{2}-\d{2}$/.test(String(w?.week||""))).slice().sort((a,b)=>String(a.week).localeCompare(String(b.week)));
    const maxRows=kind=>Math.max(1,...weeks.map(w=>Array.isArray(w?.data?.[kind])?w.data[kind].length:0));
    const rowCount={
      r:Math.max(1,num(p?.rows?.r)||maxRows("r")),
      s:Math.max(1,num(p?.rows?.s)||maxRows("s"))
    };
    const labels={
      r:Array.from({length:rowCount.r},(_,i)=>text(p?.rowLabels?.r?.[i],80)||`Rutin ${i+1}`),
      s:Array.from({length:rowCount.s},(_,i)=>text(p?.rowLabels?.s?.[i],80)||`Ders ${i+1}`)
    };
    return{p,weeks,rowCount,labels,week:weeks.at(-1)||null};
  }
  function mondayKeyLocal(date=new Date()){
    const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function selectedProgramWeek(student){
    const model=programModel(student);if(!model.weeks.length)return{model,week:null,index:-1};
    const uid=student?.studentUid||"",saved=ui.programWeekByStudent.get(uid);
    let index=model.weeks.findIndex(w=>w.week===saved);
    if(index<0)index=model.weeks.findIndex(w=>w.week===mondayKeyLocal());
    if(index<0)index=model.weeks.length-1;
    const week=model.weeks[index];if(uid)ui.programWeekByStudent.set(uid,week.week);
    return{model,week,index};
  }
  function weekInfo(student){
    const {week}=programModel(student);const byDay=Array.from({length:7},()=>({filled:0,done:0}));let filled=0,done=0;
    if(!week)return{filled,done,pct:0,byDay,week:null};
    for(const kind of["r","s"]){
      for(let r=0;r<(week?.data?.[kind]||[]).length;r++){
        const row=week.data[kind][r]||[];
        for(let d=0;d<7;d++){
          if(!text(row[d]))continue;filled++;byDay[d].filled++;
          if(week?.data?.dn?.[`${kind}-${r}-${d}`]){done++;byDay[d].done++}
        }
      }
    }
    return{filled,done,pct:filled?Math.round(done/filled*100):0,byDay,week};
  }
  function progressInfo(student){
    const p=studentShare(student).progress||{};
    return{hours:num(p.minutes7)/60,questions:num(p.questions7)};
  }
  function studentSignal(student){
    const p=weekInfo(student),e=examInfo(student),t=topicInfo(student);
    if(!student?.share)return{key:"risk",label:"Paylaşım bekleniyor"};
    if(p.filled&&p.pct<50||t.overdue>=3||e.delta!==null&&e.delta<-8)return{key:"risk",label:"Riskli"};
    if(p.filled&&p.pct<72||t.overdue>0||e.delta!==null&&e.delta<0)return{key:"warn",label:"Takip"};
    if(p.filled&&p.pct>=88&&t.overdue===0&&!(e.delta!==null&&e.delta<0))return{key:"good",label:"Çok iyi"};
    return{key:"good",label:"İyi"};
  }
  function filteredStudents(){
    const q=ui.search.toLocaleLowerCase("tr-TR");
    if(!q)return snapshot.students||[];
    return(snapshot.students||[]).filter(student=>`${studentName(student)} ${studentTrack(student)} ${studentGrade(student)}`.toLocaleLowerCase("tr-TR").includes(q));
  }
  function selectedStudent(){
    const list=snapshot.students||[];
    return list.find(s=>s.studentUid===ui.selectedUid)||list[0]||null;
  }
  function aggregate(){
    const students=snapshot.students||[],withShare=students.filter(s=>s.share);
    const programValues=withShare.map(s=>weekInfo(s)).filter(x=>x.filled).map(x=>x.pct);
    const latestNets=withShare.map(s=>examInfo(s).latestNet).filter(Number.isFinite);
    const hours=withShare.map(s=>progressInfo(s).hours);
    const allTopics=withShare.flatMap(s=>topics(s)),complete=allTopics.filter(x=>num(x.st)>=3).length;
    return{
      students:students.length,
      shared:withShare.length,
      programPct:programValues.length?Math.round(avg(programValues)):0,
      hours:avg(hours),
      latestNet:latestNets.length?avg(latestNets):0,
      topicPct:allTopics.length?Math.round(complete/allTopics.length*100):0,
      errors:withShare.reduce((sum,s)=>sum+errorCount(s),0)
    };
  }
  function statusHtml(student){
    const s=studentSignal(student),cls=s.key==="risk"?"risk":s.key==="warn"?"warn":"";
    return`<span class="coach-status ${cls}">${esc(s.label)}</span>`;
  }
  function progressHtml(value){
    const n=pct(value),cls=n<55?"risk":n<75?"warn":"";
    return`<div class="coach-progress ${cls}"><span>%${n}</span><div class="coach-progress-track"><i style="width:${n}%"></i></div></div>`;
  }
  function kpi(label,value,note,icon,tone="blue",trend=""){
    return`<article class="coach-kpi" data-tone="${tone}"><div><span>${esc(label)}</span><b>${esc(value)}</b><small class="${trend}">${esc(note)}</small></div><i class="coach-kpi-icon">${icon}</i></article>`;
  }
  function cardHeader(title,subtitle="",link="",action=""){
    return`<div class="coach-card-header"><div><h3>${esc(title)}</h3>${subtitle?`<p>${esc(subtitle)}</p>`:""}</div>${link?`<button class="coach-card-link" type="button" data-page-action="${esc(action)}">${esc(link)}</button>`:""}</div>`;
  }
  function pageHead(title,subtitle,actions=""){
    return`<section class="coach-page-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${actions?`<div class="coach-page-actions">${actions}</div>`:""}</section>`;
  }
  function empty(message){return`<div class="coach-empty">${esc(message)}</div>`}

  function studentRows(limit=50){
    const list=filteredStudents().slice(0,limit);
    if(!list.length)return`<tr><td colspan="7">${empty("Gösterilecek öğrenci yok.")}</td></tr>`;
    return list.map(student=>{
      const p=weekInfo(student),e=examInfo(student),name=studentName(student);
      return`<tr><td><div class="coach-person"><span class="coach-avatar">${esc(initials(name))}</span><b>${esc(name)}</b></div></td><td>${esc(studentGrade(student)||studentTrack(student))}</td><td>${progressHtml(p.pct)}</td><td>${e.latestNet===null?"—":fmt(e.latestNet)}</td><td>${esc(relativeTime(studentShare(student).updatedAt))}</td><td>${statusHtml(student)}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="summary">Detay ›</button></td></tr>`;
    }).join("");
  }
  function studentTable(){
    return`<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Ad Soyad</th><th>Sınıf / Alan</th><th>Program Uyumu</th><th>Son Net</th><th>Son Aktivite</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${studentRows()}</tbody></table></div>`;
  }
  function dayAggregate(){
    const totals=Array.from({length:7},()=>({filled:0,done:0}));
    for(const student of snapshot.students||[]){
      const w=weekInfo(student);w.byDay.forEach((d,i)=>{totals[i].filled+=d.filled;totals[i].done+=d.done});
    }
    return totals;
  }
  function weeklyBars(){
    const days=dayAggregate(),max=Math.max(1,...days.map(d=>d.filled));
    return`<div class="coach-chart-legend"><span>Tamamlanan</span><span>Eksik</span><span>Toplam</span></div><div class="coach-bar-chart">${days.map((d,i)=>{
      const doneH=Math.round(d.done/max*100),missing=Math.max(0,d.filled-d.done),missingH=Math.round(missing/max*100),totalH=Math.round(d.filled/max*100);
      return`<div class="coach-bar-col"><i style="height:${doneH}%"></i><i style="height:${missingH}%"></i><i style="height:${totalH}%"></i><em>${DAYS[i]}</em></div>`;
    }).join("")}</div>`;
  }
  function lineSeriesValues(){
    const studentLists=(snapshot.students||[]).map(s=>exams(s).slice(-6).map(e=>num(e.totalNet))).filter(x=>x.length);
    const count=Math.max(0,...studentLists.map(x=>x.length)),values=[];
    for(let i=0;i<count;i++){const vals=studentLists.map(list=>list[list.length-count+i]).filter(Number.isFinite);values.push(vals.length?avg(vals):0)}
    return values;
  }
  function lineSvg(values,extraClass=""){
    if(values.length<2)return empty("Trend için en az iki deneme verisi gerekli.");
    const width=620,height=180,pad=18,min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
    const points=values.map((v,i)=>{const x=pad+i/(values.length-1)*(width-pad*2),y=height-pad-(v-min)/range*(height-pad*2);return{x,y,v}});
    const poly=points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return`<svg class="coach-line-chart ${extraClass}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Performans trendi"><line class="grid" x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"></line><line class="grid" x1="${pad}" y1="${height/2}" x2="${width-pad}" y2="${height/2}"></line><polyline points="${poly}"></polyline>${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"><title>${fmt(p.v)}</title></circle>`).join("")}</svg>`;
  }
  function subjectStats(){
    const map=new Map();
    for(const student of snapshot.students||[])for(const item of topics(student)){
      const subject=text(item.subject||item.lesson||item.ders,60)||"Diğer";
      const row=map.get(subject)||{subject,total:0,complete:0};row.total++;if(num(item.st)>=3)row.complete++;map.set(subject,row);
    }
    return[...map.values()].map(row=>({...row,pct:row.total?Math.round(row.complete/row.total*100):0})).sort((a,b)=>b.total-a.total);
  }
  function subjectList(limit=6){
    const list=subjectStats().slice(0,limit);if(!list.length)return empty("Henüz konu paylaşımı yok.");
    return`<div class="coach-subject-list">${list.map(row=>`<div class="coach-subject-row"><span>${esc(row.subject)}</span><div class="coach-subject-track"><i style="width:${row.pct}%"></i></div><b>%${row.pct}</b></div>`).join("")}</div>`;
  }
  function recentActivities(limit=6){
    const list=(snapshot.students||[]).map(student=>({student,date:timestampDate(studentShare(student).updatedAt)})).filter(x=>x.student.share).sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0)).slice(0,limit);
    if(!list.length)return empty("Henüz canlı öğrenci hareketi yok.");
    return`<div class="coach-mini-list">${list.map(({student})=>`<div class="coach-mini-row"><span class="coach-avatar">${esc(initials(studentName(student)))}</span><div><b>${esc(studentName(student))}</b><small>YKS Defterim verileri eşitlendi.</small></div><span>${esc(relativeTime(studentShare(student).updatedAt))}</span></div>`).join("")}</div>`;
  }
  function pendingItems(limit=5){
    const items=[];
    for(const student of snapshot.students||[]){
      const name=studentName(student),t=topicInfo(student),e=examInfo(student),w=weekInfo(student);
      if(t.overdue>0)items.push({icon:"⌛",title:"Geciken konu kontrolü",name,note:`${t.overdue} konu`,tone:"red",uid:student.studentUid,tab:"topics"});
      if(e.delta!==null&&e.delta<0)items.push({icon:"▥",title:"Deneme analizi",name,note:`${fmt(Math.abs(e.delta))} net düşüş`,tone:"blue",uid:student.studentUid,tab:"exams"});
      if(w.filled&&w.pct<65)items.push({icon:"▣",title:"Program kontrolü",name,note:`%${w.pct} uyum`,tone:"orange",uid:student.studentUid,tab:"program"});
      if(errorCount(student)>=6)items.push({icon:"✎",title:"Hata defteri kontrolü",name,note:`${errorCount(student)} hata`,tone:"purple",uid:student.studentUid,tab:"errors"});
    }
    return items.slice(0,limit);
  }
  function pendingList(limit=5){
    const items=pendingItems(limit);
    if(!items.length)return empty("Şu anda bekleyen kritik işlem yok.");
    return`<div class="coach-pending-list">${items.map(item=>`<button class="coach-pending-row" type="button" data-student-detail="${esc(item.uid)}" data-detail-tab="${esc(item.tab)}"><span class="coach-pending-icon ${item.tone}">${item.icon}</span><div><b>${esc(item.title)}</b><small>${esc(item.name)}</small></div><em>${esc(item.note)}</em></button>`).join("")}</div>`;
  }
  function quickActions(){
    return`<div class="coach-quick-grid"><button type="button" data-page-action="students"><span>♟</span><b>Öğrenci Ekle</b><small>Yeni bağlantı oluştur</small></button><button type="button" data-page-action="programs"><span>▣</span><b>Program Görüntüle</b><small>Haftalık planları aç</small></button><button type="button" data-page-action="exams"><span>▥</span><b>Deneme Analizi</b><small>Sonuçları karşılaştır</small></button><button type="button" data-page-action="reports"><span>▤</span><b>Rapor Oluştur</b><small>Genel ilerlemeyi incele</small></button></div>`;
  }
  function recentExamTable(limit=5){
    const list=(snapshot.students||[]).flatMap(student=>exams(student).map(exam=>({student,exam}))).sort((a,b)=>String(b.exam.date||"").localeCompare(String(a.exam.date||""))).slice(0,limit);
    if(!list.length)return empty("Henüz deneme sonucu yok.");
    return`<div class="coach-table-wrap"><table class="coach-table coach-compact-table"><thead><tr><th>Öğrenci</th><th>Deneme</th><th>Net</th><th>Tarih</th></tr></thead><tbody>${list.map(({student,exam})=>`<tr><td><div class="coach-person"><span class="coach-avatar">${esc(initials(studentName(student)))}</span><b>${esc(studentName(student))}</b></div></td><td>${esc(exam.name||exam.type||"Deneme")}</td><td><b>${fmt(num(exam.totalNet))}</b></td><td>${esc(exam.date||"—")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function gradeDistribution(){
    const map=new Map();
    for(const student of snapshot.students||[]){
      const grade=studentGrade(student)||"Belirtilmemiş";
      map.set(grade,(map.get(grade)||0)+1);
    }
    const list=[...map.entries()].sort((a,b)=>b[1]-a[1]);
    if(!list.length)return empty("Sınıf bilgisi bulunmuyor.");
    const total=list.reduce((s,x)=>s+x[1],0);
    return`<div class="coach-grade-dist"><div class="coach-grade-donut"><strong>${total}<small>Öğrenci</small></strong></div><div class="coach-grade-list">${list.slice(0,5).map(([grade,count],i)=>`<div><i style="--grade-i:${i}"></i><span>${esc(grade)}</span><b>${count} · %${Math.round(count/total*100)}</b></div>`).join("")}</div></div>`;
  }

  function selectedSummary(student){
    if(!student)return empty("Öğrenci seç.");
    const p=weekInfo(student),e=examInfo(student),t=topicInfo(student),name=studentName(student);
    return`<div class="coach-selected-card"><div class="coach-selected-head"><span class="coach-avatar">${esc(initials(name))}</span><div><h3>${esc(name)}</h3><p>${esc([studentGrade(student),studentTrack(student)].filter(Boolean).join(" · "))}</p></div>${statusHtml(student)}</div><div class="coach-selected-metrics"><div class="coach-selected-metric"><span>Program uyumu</span><b>%${p.pct}</b></div><div class="coach-selected-metric"><span>Son deneme</span><b>${e.latestNet===null?"—":fmt(e.latestNet)}</b></div><div class="coach-selected-metric"><span>Konu tamam.</span><b>%${t.pct}</b></div></div><div class="coach-note-box"><b>Koç görünümü</b><p>${t.overdue?`${t.overdue} geciken konu bulunuyor. `:""}${e.delta!==null?`Son iki deneme değişimi ${e.delta>=0?"+":""}${fmt(e.delta)} net. `:""}${p.filled?`Haftalık program uyumu %${p.pct}.`:"Program verisi henüz yok."}</p></div><div class="coach-quick-actions"><button class="coach-quick-btn" data-student-detail="${esc(student.studentUid)}" data-detail-tab="summary">Öğrenci detayını aç <span>›</span></button><button class="coach-quick-btn" data-student-detail="${esc(student.studentUid)}" data-detail-tab="program">Programı görüntüle <span>›</span></button><button class="coach-quick-btn" data-message-student="${esc(student.studentUid)}">Mesaj gönder <span>›</span></button></div></div>`;
  }

  function homePage(){
    const a=aggregate(),name=text(snapshot.coach?.displayName||snapshot.user?.displayName,80)||"Koç";
    const risk=(snapshot.students||[]).filter(s=>studentSignal(s).key==="risk").length;
    const pending=pendingItems(99).length;
    return`${pageHead(`Merhaba ${name} 👋`,`${a.shared} öğrencinin canlı verisi bağlı. Genel durumu buradan izleyebilirsin.`,`<button class="coach-secondary" data-page-action="reports">Rapor Oluştur</button><button class="coach-secondary" data-page-action="programs">Programlar</button><button class="coach-primary" data-connect-student>+ Öğrenci Ekle</button>`)}
      <section class="coach-kpis">${kpi("Toplam Öğrenci",String(a.students),`${a.shared} canlı paylaşım`,"♟","blue","up")}${kpi("Program Uyumu",`%${a.programPct}`,"Haftalık ortalama","◎","green","up")}${kpi("Ortalama Çalışma",`${fmt(a.hours)} sa`,"Son 7 gün","◷","blue","up")}${kpi("Deneme Ortalaması",a.latestNet?fmt(a.latestNet):"—","Son denemeler","▥","red","up")}${kpi("Konu Tamamlama",`%${a.topicPct}`,risk?`${risk} öğrenci risk sinyali`:"Kritik risk yok","▤","purple",risk?"down":"up")}</section>

      <section class="coach-home-main-grid">
        <article class="coach-card coach-home-students">${cardHeader("Öğrenci Listesi","Canlı verisi bağlı öğrenciler","Tümünü gör","students")}${studentTable()}</article>
        <div class="coach-home-center">
          <article class="coach-card">${cardHeader("Haftalık Genel Durum","Program tamamlanma hareketi")}${weeklyBars()}</article>
          <article class="coach-card">${cardHeader("Konu İlerleme Durumu","Ders bazlı tamamlanma","Konulara git","topics")}${subjectList(5)}</article>
        </div>
        <aside class="coach-home-right">
          <article class="coach-card">${cardHeader("Bekleyen İşlemler",pending?`${pending} takip sinyali`:"Kritik işlem yok","Tümünü gör","reports")}${pendingList(5)}</article>
          <article class="coach-card">${cardHeader("Hızlı İşlemler")}${quickActions()}</article>
        </aside>
      </section>

      <section class="coach-home-lower-grid">
        <article class="coach-card">${cardHeader("Son Deneme Sonuçları","En güncel paylaşılan denemeler","Tümünü gör","exams")}${recentExamTable(5)}</article>
        <article class="coach-card">${cardHeader("Program Uyumu Trendi","Öğrencilerin haftalık uyum görünümü")}${lineSvg((snapshot.students||[]).map(s=>weekInfo(s).pct).filter(Number.isFinite))}</article>
        <article class="coach-card">${cardHeader("Sınıf Dağılımı","Bağlı öğrencilerin sınıf bilgisi")}${gradeDistribution()}</article>
        <article class="coach-card">${cardHeader("Son Aktiviteler","Canlı paylaşım güncellemeleri","Tümünü gör","students")}${recentActivities(5)}</article>
      </section>`;
  }

  function studentsPage(){
    const base=filteredStudents(),all=snapshot.students||[],activeAll=all.filter(s=>s.share).length,riskAll=all.filter(s=>studentSignal(s).key==="risk").length;
    const list=base.filter(s=>ui.studentFilter==="active"?Boolean(s.share):ui.studentFilter==="risk"?studentSignal(s).key==="risk":true);
    const selected=all.find(s=>s.studentUid===ui.selectedUid)||list[0]||selectedStudent();
    const goodAll=all.filter(s=>studentSignal(s).key==="good").length,warnAll=all.filter(s=>studentSignal(s).key==="warn").length;
    const rows=list.length?list.slice(0,50).map(student=>{const p=weekInfo(student),e=examInfo(student),name=studentName(student);return`<tr><td><div class="coach-person"><span class="coach-avatar">${esc(initials(name))}</span><b>${esc(name)}</b></div></td><td>${esc(studentGrade(student)||studentTrack(student))}</td><td>${progressHtml(p.pct)}</td><td>${e.latestNet===null?"—":fmt(e.latestNet)}</td><td>${esc(relativeTime(studentShare(student).updatedAt))}</td><td>${statusHtml(student)}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="summary">Detay ›</button></td></tr>`}).join(""):`<tr><td colspan="7">${empty("Bu filtrede öğrenci yok.")}</td></tr>`;
    return`${pageHead("Öğrenciler","Tüm öğrencilerini tek ekranda takip et, filtrele ve yönet.",`<button class="coach-primary" data-connect-student>+ Öğrenci Ekle</button>`)}
      <section class="coach-kpis four">${kpi("Toplam Öğrenci",String(all.length),"Bağlı öğrenci sayısı","♟")}${kpi("Aktif Paylaşım",String(activeAll),"Canlı veri gönderen","●","green")}${kpi("Risk Sinyali",String(riskAll),"Takip gerektiren","△","red")}${kpi("Son 7 Gün Soru",String(all.reduce((sum,s)=>sum+progressInfo(s).questions,0)),"Toplam soru","▥","purple")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Öğrenci Listesi","Arama ve durum filtreleri birlikte çalışır")}<div class="coach-filter-row"><button class="coach-filter-pill ${ui.studentFilter==="all"?"on":""}" data-student-filter="all">Tümü (${all.length})</button><button class="coach-filter-pill ${ui.studentFilter==="active"?"on":""}" data-student-filter="active">Aktif (${activeAll})</button><button class="coach-filter-pill ${ui.studentFilter==="risk"?"on":""}" data-student-filter="risk">Riskli (${riskAll})</button></div><div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Ad Soyad</th><th>Sınıf / Alan</th><th>Program Uyumu</th><th>Son Net</th><th>Son Aktivite</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${rows}</tbody></table></div></article><aside class="coach-grid"><article class="coach-card">${cardHeader("Seçili Öğrenci Özeti")}${selectedSummary(selected)}</article><article class="coach-card">${cardHeader("Hızlı İşlemler")}${selected?`<div class="coach-quick-actions"><button class="coach-quick-btn" data-student-detail="${esc(selected.studentUid)}" data-detail-tab="summary">Öğrenci detayı <span>›</span></button><button class="coach-quick-btn" data-student-detail="${esc(selected.studentUid)}" data-detail-tab="program">Programı aç <span>›</span></button><button class="coach-quick-btn" data-message-student="${esc(selected.studentUid)}">Mesaj gönder <span>›</span></button><button class="coach-quick-btn" data-student-detail="${esc(selected.studentUid)}" data-detail-tab="exams">Deneme analizi <span>›</span></button></div>`:empty("Öğrenci seç.")}</article></aside></section>
      <section class="coach-grid equal"><article class="coach-card">${cardHeader("Risk Durumu Dağılımı")}<div class="coach-donut-wrap"><div class="coach-donut"><strong>${all.length}<small>Öğrenci</small></strong></div><div class="coach-legend-list"><div class="coach-legend-item"><i></i><span>İyi / Çok iyi</span><b>${goodAll}</b></div><div class="coach-legend-item"><i></i><span>Takip</span><b>${warnAll}</b></div><div class="coach-legend-item"><i></i><span>Riskli</span><b>${riskAll}</b></div></div></div></article><article class="coach-card">${cardHeader("Son Öğrenci Hareketleri","Canlı veri güncellemeleri")}${recentActivities(7)}</article></section>`;
  }

  function programsPage(){
    const students=filteredStudents(),programmed=students.filter(s=>programModel(s).weeks.length),selected=(snapshot.students||[]).find(s=>s.studentUid===ui.selectedUid)||students[0]||null;
    if(selected&&!ui.selectedUid)ui.selectedUid=selected.studentUid;
    const current=selected?selectedProgramWeek(selected):{model:{weeks:[],rowCount:{r:0,s:0},labels:{r:[],s:[]}},week:null,index:-1},week=current.week,model=current.model;
    const totalPlanned=students.reduce((sum,s)=>sum+weekInfo(s).filled,0),totalDone=students.reduce((sum,s)=>sum+weekInfo(s).done,0),avgPct=programmed.length?Math.round(avg(programmed.map(s=>weekInfo(s).pct))):0;
    const rows=students.map(student=>{const w=weekInfo(student),m=programModel(student),name=studentName(student),on=selected?.studentUid===student.studentUid;return`<tr class="${on?"program-row-selected":""}"><td><button class="program-student-pick" type="button" data-program-select="${esc(student.studentUid)}"><span class="coach-avatar">${esc(initials(name))}</span><b>${esc(name)}</b></button></td><td>${esc(studentTrack(student))}</td><td>${m.weeks.length}</td><td>${progressHtml(w.pct)}</td><td>${w.done}/${w.filled}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="program">Tam ekran ›</button></td></tr>`}).join("");
    return`<div class="coach-page coach-page-programs">${pageHead("Programlar","Öğrencinin YKS Defterim → Programım tablosunu koç ekranında birebir görüntüle.",`<button class="coach-primary" data-program-task>+ Programa Görev Gönder</button>`)}
      <section class="programs-overview-band">
        <div class="programs-selected"><span class="eyebrow">Seçili öğrenci</span><h3>${selected?esc(studentName(selected)):"Öğrenci seç"}</h3><p>${selected?`${esc(studentTrack(selected))} · ${model.weeks.length} kayıtlı hafta`:"Programı görüntülemek için öğrenci seç."}</p></div>
        <div class="programs-band-stat"><span>Programı olan</span><b>${programmed.length}/${students.length}</b></div>
        <div class="programs-band-stat"><span>Haftalık uyum</span><b>%${avgPct}</b></div>
        <div class="programs-band-stat"><span>Görev ilerleme</span><b>${totalDone}/${totalPlanned}</b></div>
        <button class="coach-secondary" type="button" data-student-detail="${selected?esc(selected.studentUid):""}" data-detail-tab="program" ${selected?"":"disabled"}>Tam ekran program</button>
      </section>
      <section class="programs-calendar-stage coach-card">
        ${cardHeader("Öğrencinin Gerçek Haftalık Programı","Satır adları, görevler, tamamlanan ve taşınan hücreler öğrenci verisinden birebir okunur")}
        ${week?canonicalProgramMirror(selected,current):empty("Seçili öğrencide kayıtlı haftalık program yok.")}
      </section>
      <section class="programs-bottom-grid">
        <article class="coach-card programs-list-card">${cardHeader("Öğrenci Programları","Öğrenciye tıklayarak yukarıdaki programı değiştir")}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Öğrenci</th><th>Alan</th><th>Hafta</th><th>Uyum</th><th>Görev</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="6">${empty("Program verisi yok.")}</td></tr>`}</tbody></table></div></article>
        <aside class="programs-side-stack"><article class="coach-card">${cardHeader("Seçili Program")}${selectedSummary(selected)}</article><article class="coach-card">${cardHeader("Son Güncellemeler")}${recentActivities(5)}</article></aside>
      </section></div>`;
  }

  function canonicalProgramMirror(student,current){
    const{model,week,index}=current,days=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"],dn=week?.data?.dn||{},mv=week?.data?.mv||{},dayDone=week?.data?.done||[];
    const stats=weekInfo(student),uid=student.studentUid;
    const section=(kind,title)=>{
      const rows=model.rowCount[kind],labels=model.labels[kind],matrix=week?.data?.[kind]||[];
      let body="";
      for(let r=0;r<rows;r++){
        body+=`<div class="canonical-program-label">${esc(labels[r]||`${title} ${r+1}`)}</div>`;
        for(let d=0;d<7;d++){
          const cid=`${kind}-${r}-${d}`,task=text(matrix?.[r]?.[d],220),done=Boolean(dn[cid]),moved=Object.prototype.hasOwnProperty.call(mv,cid);
          body+=`<div class="canonical-program-cell ${task?"has-task":""} ${done?"is-done":""} ${moved?"is-moved":""}">${task?`<span>${esc(task)}</span><small>${done?"✓ Tamamlandı":moved?"↪ Taşındı":"Planlandı"}</small>`:'<span class="canonical-program-empty">—</span>'}</div>`;
        }
      }
      return`<section class="canonical-program-section"><div class="canonical-program-section-head"><div><span>${kind==="r"?"Rutin":"Ders"}</span><h4>${esc(title)}</h4></div><b>${rows} satır</b></div><div class="canonical-program-scroll"><div class="canonical-program-grid"><div class="canonical-program-corner">Satır</div>${days.map((day,d)=>`<div class="canonical-program-day ${dayDone[d]?"day-done":""}"><b>${esc(day)}</b><small>${dayDone[d]?"Gün tamam ✓":""}</small></div>`).join("")}${body}</div></div></section>`;
    };
    return`<div class="canonical-program-shell"><div class="canonical-program-toolbar"><button type="button" data-program-week-shift="-1" ${index<=0?"disabled":""}>‹</button><div><b>${esc(week.week)}</b><span>${index+1} / ${model.weeks.length}. hafta</span></div><button type="button" data-program-week-current>Bu hafta</button><button type="button" data-program-week-shift="1" ${index>=model.weeks.length-1?"disabled":""}>›</button></div><div class="canonical-program-summary"><span><b>${stats.filled}</b> planlanan</span><span><b>${stats.done}</b> tamamlanan</span><span><b>%${stats.pct}</b> uyum</span></div>${section("r","Rutinler")}${section("s","Ders Programım")}</div>`;
  }


  function reportsPage(){
    const a=aggregate(),students=filteredStudents(),deltas=students.map(s=>examInfo(s).delta).filter(Number.isFinite),netGain=deltas.length?avg(deltas):0;
    return`<div class="coach-page coach-page-reports">${pageHead("Takip & Rapor","Bütün öğrencilerin performansını tek analiz ekranında karşılaştır.",`<button class="coach-primary" data-print-report>Rapor Oluştur</button>`)}
      <section class="reports-hero-grid">
        <article class="coach-card reports-main-chart">${cardHeader("Genel Performans Trendi","Deneme netlerinin zaman içindeki ortak hareketi")}${lineSvg(lineSeriesValues())}<div class="reports-inline-metrics"><span><small>Program uyumu</small><b>%${a.programPct}</b></span><span><small>Haftalık çalışma</small><b>${fmt((snapshot.students||[]).reduce((sum,s)=>sum+progressInfo(s).hours,0))} sa</b></span><span><small>Net değişimi</small><b>${netGain>=0?"+":""}${fmt(netGain)}</b></span></div></article>
        <aside class="reports-scorecard coach-card"><span class="eyebrow">Rapor özeti</span><strong>${a.shared}<small>/ ${a.students} öğrenci</small></strong><p>Canlı paylaşımı olan öğrenciler rapora dahil edildi.</p><div class="reports-score-list"><div><span>Konu tamamlama</span><b>%${a.topicPct}</b></div><div><span>Risk / takip</span><b>${(snapshot.students||[]).filter(s=>studentSignal(s).key!=="good").length}</b></div><div><span>Toplam hata</span><b>${a.errors}</b></div></div></aside>
      </section>
      <section class="coach-card reports-comparison">${cardHeader("Öğrenci Karşılaştırma","Program uyumu, net ve değişim tek tabloda")}${studentComparison(students.slice(0,12))}</section>
      <section class="reports-lower-grid"><article class="coach-card">${cardHeader("Ders Bazlı İlerleme")}${subjectList(8)}</article><article class="coach-card">${cardHeader("Durum Dağılımı")}<div class="coach-donut-wrap"><div class="coach-donut"><strong>${a.students}<small>Öğrenci</small></strong></div><div class="coach-legend-list"><div class="coach-legend-item"><i></i><span>Paylaşım aktif</span><b>${a.shared}</b></div><div class="coach-legend-item"><i></i><span>Takip / risk</span><b>${(snapshot.students||[]).filter(s=>studentSignal(s).key!=="good").length}</b></div></div></div></article><article class="coach-card">${cardHeader("Rapor Hareketleri")}${recentActivities(6)}</article></section></div>`;
  }

  function studentComparison(students){
    if(!students.length)return empty("Öğrenci verisi yok.");
    return`<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>#</th><th>Ad Soyad</th><th>Program</th><th>Son Net</th><th>Değişim</th><th>Durum</th></tr></thead><tbody>${students.map((s,i)=>{const e=examInfo(s);return`<tr><td>${i+1}</td><td>${esc(studentName(s))}</td><td>%${weekInfo(s).pct}</td><td>${e.latestNet===null?"—":fmt(e.latestNet)}</td><td>${e.delta===null?"—":`${e.delta>=0?"+":""}${fmt(e.delta)}`}</td><td>${statusHtml(s)}</td></tr>`}).join("")}</tbody></table></div>`;
  }

  function examsPage(){
    const students=filteredStudents(),all=students.flatMap(student=>exams(student).map(exam=>({student,exam}))),latestNets=students.map(s=>examInfo(s).latestNet).filter(Number.isFinite),best=all.length?Math.max(...all.map(x=>num(x.exam.totalNet))):0,deltas=students.map(s=>examInfo(s).delta).filter(Number.isFinite);
    const rows=students.map((s,i)=>{const e=examInfo(s);return`<tr><td>${i+1}</td><td><div class="coach-person"><span class="coach-avatar">${esc(initials(studentName(s)))}</span><b>${esc(studentName(s))}</b></div></td><td>${esc(e.latest?.name||e.latest?.type||"—")}</td><td><b>${e.latestNet===null?"—":fmt(e.latestNet)}</b></td><td>${e.delta===null?"—":`${e.delta>=0?"↑":"↓"} ${fmt(Math.abs(e.delta))}`}</td><td>${statusHtml(s)}</td><td><button class="coach-detail-link" data-student-detail="${esc(s.studentUid)}" data-detail-tab="exams">Analiz ›</button></td></tr>`}).join("");
    return`<div class="coach-page coach-page-exams">${pageHead("Deneme Analizi","Deneme performansını grafik, sıralama ve öğrenci bazında incele.")}
      <section class="exam-lab-head">
        <div class="exam-lab-stat"><span>Ortalama Net</span><b>${latestNets.length?fmt(avg(latestNets)):"—"}</b><small>Son denemeler</small></div>
        <div class="exam-lab-stat"><span>En Yüksek Net</span><b>${all.length?fmt(best):"—"}</b><small>Kayıtlı denemeler</small></div>
        <div class="exam-lab-stat"><span>Ortalama Değişim</span><b>${deltas.length?`${avg(deltas)>=0?"+":""}${fmt(avg(deltas))}`:"—"}</b><small>Son iki deneme</small></div>
        <div class="exam-lab-stat"><span>Deneme Kaydı</span><b>${all.length}</b><small>Toplam kayıt</small></div>
      </section>
      <section class="exam-lab-grid">
        <article class="coach-card exam-lab-chart">${cardHeader("Net Trendi","Son denemelerin ortalama performansı")}${lineSvg(lineSeriesValues())}</article>
        <article class="coach-card exam-lab-ranking">${cardHeader("Öğrenci Sıralaması","Son deneme netine göre")}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>#</th><th>Öğrenci</th><th>Deneme</th><th>Net</th><th>Değişim</th><th>Durum</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Deneme verisi yok.")}</td></tr>`}</tbody></table></div></article>
      </section>
      <section class="exam-lab-bottom"><article class="coach-card">${cardHeader("Ders Bazlı Performans","Konu ilerlemesiyle birlikte yorumla")}${subjectList(8)}</article><article class="coach-card">${cardHeader("Son Deneme Akışı")}${recentExamRows(8)}</article></section></div>`;
  }

  function recentExamRows(limit){
    const list=(snapshot.students||[]).flatMap(student=>exams(student).map(exam=>({student,exam}))).sort((a,b)=>String(b.exam.date||"").localeCompare(String(a.exam.date||""))).slice(0,limit);
    if(!list.length)return empty("Henüz deneme kaydı yok.");
    return`<div class="coach-mini-list">${list.map(({student,exam})=>`<div class="coach-mini-row"><span class="coach-avatar">${esc(initials(studentName(student)))}</span><div><b>${esc(studentName(student))}</b><small>${esc(exam.name||exam.type||"Deneme")} · ${fmt(num(exam.totalNet))} net</small></div><span>${esc(exam.date||"")}</span></div>`).join("")}</div>`;
  }

  function topicsPage(){
    const flat=filteredStudents().flatMap(student=>topics(student).map(topic=>({student,topic}))),complete=flat.filter(x=>num(x.topic.st)>=3).length,active=flat.filter(x=>num(x.topic.st)>0&&num(x.topic.st)<3).length,now=new Date().toISOString().slice(0,10),overdue=flat.filter(x=>x.topic.deadline&&String(x.topic.deadline)<now&&num(x.topic.st)<3).length;
    const selected=flat[0]||null;
    const rows=flat.slice(0,90).map(({student,topic})=>{const st=num(topic.st);return`<tr><td>${esc(topic.subject||topic.lesson||"Ders")}</td><td><b>${esc(topic.topic||topic.name||"Konu")}</b></td><td>${esc(studentName(student))}</td><td>${st>=3?"%100":st===2?"%66":st===1?"%33":"%0"}</td><td>${esc(topic.deadline||"—")}</td><td>${st>=3?'<span class="coach-status">Tamamlandı</span>':st>0?'<span class="coach-status info">Devam</span>':'<span class="coach-status warn">Başlanmadı</span>'}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="topics">Aç ›</button></td></tr>`}).join("");
    return`<div class="coach-page coach-page-topics">${pageHead("Konular","Konu listesini bir gezgin gibi incele; öğrenci ve ilerleme durumunu yan panelden yönet.")}
      <section class="topics-workspace">
        <article class="coach-card topics-explorer">${cardHeader("Konu Gezgini",`${flat.length} paylaşılmış konu · ${overdue} geciken`)}<div class="topics-filter-strip"><span>Tamamlanan <b>${complete}</b></span><span>Devam eden <b>${active}</b></span><span>Geciken <b>${overdue}</b></span></div><div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Ders</th><th>Konu</th><th>Öğrenci</th><th>İlerleme</th><th>Son Tarih</th><th>Durum</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Konu verisi yok.")}</td></tr>`}</tbody></table></div></article>
        <aside class="topics-inspector"><article class="coach-card topics-sticky-card">${cardHeader("Konu Detayı")}${selected?`<div class="topic-focus-icon">${esc((selected.topic.subject||"K")[0])}</div><h2>${esc(selected.topic.topic||selected.topic.name||"Konu")}</h2><p class="topic-focus-meta">${esc(selected.topic.subject||"Ders")} · ${esc(studentName(selected.student))}</p><div class="coach-selected-metrics"><div class="coach-selected-metric"><span>Aşama</span><b>${num(selected.topic.st)}/3</b></div><div class="coach-selected-metric"><span>Son tarih</span><b>${esc(selected.topic.deadline||"—")}</b></div></div><div class="topic-focus-actions"><button class="coach-primary" data-student-detail="${esc(selected.student.studentUid)}" data-detail-tab="topics">Konu detayını aç</button><button class="coach-secondary" data-student-detail="${esc(selected.student.studentUid)}" data-detail-tab="program">Programa git</button></div>`:empty("Konu seçimi için veri bekleniyor.")}</article></aside>
      </section>
      <section class="topics-bottom-grid"><article class="coach-card">${cardHeader("Ders Bazlı İlerleme")}${subjectList(10)}</article><article class="coach-card">${cardHeader("Konu Durumu Dağılımı")}<div class="coach-donut-wrap"><div class="coach-donut"><strong>${flat.length}<small>Konu</small></strong></div><div class="coach-legend-list"><div class="coach-legend-item"><i></i><span>Tamamlanan</span><b>${complete}</b></div><div class="coach-legend-item"><i></i><span>Devam eden</span><b>${active}</b></div><div class="coach-legend-item"><i></i><span>Geciken</span><b>${overdue}</b></div></div></div></article></section></div>`;
  }

  function errorsPage(){
    const flat=filteredStudents().flatMap(student=>errors(student).map(error=>({student,error,count:Math.max(1,num(error?.n||error?.count||1))}))),total=flat.reduce((sum,x)=>sum+x.count,0),ordered=flat.sort((a,b)=>b.count-a.count);
    const selected=ordered[0]||null,subjectMap=new Map();for(const x of ordered){const subject=text(x.error.subject||x.error.lesson||x.error.ders,60)||"Diğer";subjectMap.set(subject,(subjectMap.get(subject)||0)+x.count)}
    const rows=ordered.slice(0,90).map(({student,error,count})=>`<tr><td>${esc(error.subject||error.lesson||error.ders||"Ders")}</td><td><b>${esc(error.topic||error.konu||"Konu")}</b></td><td>${esc(studentName(student))}</td><td>${esc(error.type||error.errorType||"Hata")}</td><td><b>${count}</b></td><td>${count>=4?'<span class="coach-status risk">Kritik</span>':count>=2?'<span class="coach-status warn">Tekrar</span>':'<span class="coach-status">Takip</span>'}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="errors">Aç ›</button></td></tr>`).join("");
    const critical=ordered.filter(x=>x.count>=4).slice(0,5);
    return`<div class="coach-page coach-page-errors">${pageHead("Hata Defteri","Hataları kayıt defteri mantığında izle; tekrar edenleri kritik kuyruğa taşı.")}
      <section class="errors-workspace">
        <article class="coach-card errors-ledger">${cardHeader("Hata Kayıt Defteri",`${total} toplam hata · ${ordered.length} kayıt`)}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Ders</th><th>Konu</th><th>Öğrenci</th><th>Hata Türü</th><th>Tekrar</th><th>Durum</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Hata kaydı yok.")}</td></tr>`}</tbody></table></div></article>
        <aside class="errors-side-stack">
          <article class="coach-card errors-critical">${cardHeader("Kritik Hata Kuyruğu","4+ tekrar eden kayıtlar")}${critical.length?critical.map(x=>`<button class="error-critical-row" data-student-detail="${esc(x.student.studentUid)}" data-detail-tab="errors"><span>${x.count}</span><div><b>${esc(x.error.topic||x.error.konu||"Konu")}</b><small>${esc(studentName(x.student))} · ${esc(x.error.subject||x.error.ders||"Ders")}</small></div><em>›</em></button>`).join(""):empty("Kritik tekrar eden hata yok.")}</article>
          <article class="coach-card">${cardHeader("Seçili Hata")}${selected?`<div class="error-focus"><strong>${selected.count}</strong><div><h3>${esc(selected.error.topic||selected.error.konu||"Hata")}</h3><p>${esc(selected.error.type||selected.error.errorType||"Hata")} · ${esc(studentName(selected.student))}</p></div></div><button class="coach-primary error-focus-action" data-student-detail="${esc(selected.student.studentUid)}" data-detail-tab="errors">Hata defterini aç</button>`:empty("Hata seçimi yok.")}</article>
        </aside>
      </section>
      <section class="errors-bottom-grid"><article class="coach-card">${cardHeader("Ders Bazlı Hata Yoğunluğu")}<div class="coach-subject-list">${[...subjectMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>`<div class="coach-subject-row"><span>${esc(name)}</span><div class="coach-subject-track"><i style="width:${Math.min(100,total?count/total*100:0)}%"></i></div><b>${count}</b></div>`).join("")||empty("Hata verisi yok.")}</div></article><article class="coach-card">${cardHeader("Son Hata Hareketleri")}${recentActivities(7)}</article></section></div>`;
  }

  function messagesPage(){
    const students=filteredStudents(),student=(snapshot.students||[]).find(s=>s.studentUid===ui.messageUid)||students[0]||null;
    if(student)ui.messageUid=student.studentUid;
    const sent=student?ui.sessionMessages.get(student.studentUid)||[]:[];
    return`${pageHead("Mesajlar","Öğrencilere koç notu gönder ve iletişimi tek yerden yönet.")}
      <section class="coach-chat-layout"><aside class="coach-card coach-chat-list"><div class="coach-chat-search"><input type="search" value="${esc(ui.search)}" placeholder="Öğrenci veya mesaj ara..." data-message-search></div>${students.length?students.map(s=>`<button type="button" class="coach-chat-contact ${s.studentUid===ui.messageUid?"on":""}" data-message-contact="${esc(s.studentUid)}"><span class="coach-avatar">${esc(initials(studentName(s)))}</span><div><b>${esc(studentName(s))}</b><p>${s.share?"Canlı paylaşım bağlı":"Paylaşım bekleniyor"}</p></div><time>${esc(relativeTime(studentShare(s).updatedAt))}</time></button>`).join(""):empty("Öğrenci yok.")}</aside>
      <article class="coach-card coach-chat-panel"><header class="coach-chat-header"><div><h3>${student?esc(studentName(student)):"Öğrenci seç"}</h3><small>${student?esc(studentTrack(student)):""}</small></div>${student?statusHtml(student):""}</header><div class="coach-chat-body">${student?`<div class="coach-message">Bu alan koçtan öğrenciye gönderilen notları kullanır. Öğrenciden gelen mesaj verisi henüz paylaşım sözleşmesinde olmadığı için yalnız gönderdiğin koç notları burada görünür.<small>Sistem</small></div>${sent.map(msg=>`<div class="coach-message mine">${esc(msg.text)}<small>${esc(msg.time)}</small></div>`).join("")}`:empty("Mesajlaşmak için öğrenci seç.")}</div><form class="coach-chat-compose" data-message-form><textarea name="message" maxlength="500" placeholder="Mesaj yaz..." ${student?"":"disabled"}></textarea><button class="coach-primary" type="submit" ${student?"":"disabled"}>Gönder</button></form></article></section>`;
  }

  function settingsPage(){
    const a=aggregate(),name=text(snapshot.coach?.displayName||snapshot.user?.displayName,80)||"Koç",email=text(snapshot.user?.email,100)||"—",prefs=loadPrefs();
    return`${pageHead("Ayarlar","Koç paneli tercihlerini, bildirimlerini ve hesap durumunu buradan yönet.")}
      <section class="coach-kpis four">${kpi("Hesap Durumu",snapshot.user?"Aktif":"Kapalı","Google/Firebase oturumu","●","green")}${kpi("Bağlı Öğrenci",String(a.students),`${a.shared} canlı paylaşım`,"♟")}${kpi("Bildirimler",prefs.messages||prefs.program||prefs.exams?"Açık":"Kapalı","Bu cihaz tercihleri","♢","red")}${kpi("Senkronizasyon",a.shared?"Canlı":"Bekliyor","Firestore paylaşımı","↻","blue")}</section>
      <section class="coach-settings-grid"><div class="coach-settings-stack"><article class="coach-card">${cardHeader("Profil Bilgileri")}<div class="coach-profile-card"><span class="coach-avatar">${esc(initials(name))}</span><div><h3>${esc(name)}</h3><p>${esc(email)} · ${esc(snapshot.coach?.specialization||snapshot.coach?.coachTitle||"Koç")}</p></div><span class="coach-status">Doğrulandı</span></div></article>
      <article class="coach-card">${cardHeader("Bildirim Tercihleri","Bu cihazda saklanan panel tercihleri")}<div class="coach-setting-row"><div><b>Yeni mesaj bildirimi</b><small>Mesaj ekranındaki koç notlarını takip et.</small></div>${toggle("messages",prefs.messages)}</div><div class="coach-setting-row"><div><b>Program güncellemesi</b><small>Öğrenci program değişimlerini öne çıkar.</small></div>${toggle("program",prefs.program)}</div><div class="coach-setting-row"><div><b>Deneme sonucu bildirimi</b><small>Yeni deneme paylaşımını vurgula.</small></div>${toggle("exams",prefs.exams)}</div></article>
      <article class="coach-card">${cardHeader("Panel Tercihleri")}<div class="coach-setting-row"><div><b>Varsayılan sayfa</b><small>Panel açıldığında gösterilecek görünüm.</small></div><select class="coach-select" data-pref-page><option value="home" ${prefs.page==="home"?"selected":""}>Ana Sayfa</option><option value="students" ${prefs.page==="students"?"selected":""}>Öğrenciler</option><option value="reports" ${prefs.page==="reports"?"selected":""}>Takip & Rapor</option></select></div><div class="coach-setting-row"><div><b>Görünüm</b><small>Yeni koç paneli açık tema kullanıyor.</small></div><span class="coach-status info">Açık</span></div></article>
      <article class="coach-card">${cardHeader("Güvenlik","Mevcut hesap altyapısı")}<div class="coach-setting-row"><div><b>Google ile oturum</b><small>Kimlik doğrulama Firebase Auth üzerinden.</small></div><span class="coach-status">Bağlı</span></div><div class="coach-setting-row"><div><b>Öğrenci erişimi</b><small>Koç yalnız coachingShares ile paylaşılan veriyi okur.</small></div><span class="coach-status">Sınırlı</span></div></article></div>
      <aside class="coach-settings-stack"><article class="coach-card">${cardHeader("Senkronizasyon Durumu")}<div class="coach-setting-row"><div><b>Öğrenci Uygulaması</b><small>${a.shared} öğrenciden canlı veri</small></div><span class="coach-status">Bağlı</span></div><div class="coach-setting-row"><div><b>Koç Paneli</b><small>Firebase üzerinden dinleniyor</small></div><span class="coach-status">Bağlı</span></div><div class="coach-insight">Program, deneme, konu, ilerleme ve hata verileri yalnız öğrencinin koç paylaşımı üzerinden okunur.</div></article><article class="coach-card">${cardHeader("Entegrasyonlar")}<div class="coach-setting-row"><div><b>Firebase</b><small>Kimlik ve canlı veri senkronizasyonu</small></div><span class="coach-status">Bağlı</span></div><div class="coach-setting-row"><div><b>GitHub Pages</b><small>Koç panelinin web yayını</small></div><span class="coach-status info">Web</span></div></article><article class="coach-card">${cardHeader("Hızlı İşlemler")}<div class="coach-quick-actions"><button class="coach-quick-btn" data-page-action="students">Öğrenci bağlantılarını yönet <span>›</span></button><button class="coach-quick-btn" data-refresh-data>Verileri yenile <span>↻</span></button><button class="coach-quick-btn" data-print-report>Paneli yazdır <span>›</span></button></div></article></aside></section>`;
  }

  function toggle(key,on){return`<button class="coach-toggle ${on?"on":""}" type="button" data-pref-toggle="${key}" aria-pressed="${on?"true":"false"}"><i></i></button>`}
  function loadPrefs(){
    const fallback={messages:true,program:true,exams:true,page:"home"};
    try{return{...fallback,...JSON.parse(localStorage.getItem("yks-coach-v20-prefs")||"{}")}}catch{return fallback}
  }
  function savePrefs(next){
    try{localStorage.setItem("yks-coach-v20-prefs",JSON.stringify(next))}catch{}
  }

  function detailNav(student){
    const tabs=[["summary","Genel Bakış"],["program","Program"],["exams","Denemeler"],["progress","İlerleme"],["topics","Konular"],["errors","Hata Defteri"]];
    return`<nav class="student-detail-nav-v3">${tabs.map(([key,label])=>`<button type="button" class="${ui.detailTab===key?"on":""}" data-detail-section="${key}">${label}</button>`).join("")}<button type="button" class="student-detail-message-v3" data-message-student="${esc(student.studentUid)}">Mesaj Gönder</button></nav>`;
  }
  function detailHero(student){
    const p=weekInfo(student),e=examInfo(student),t=topicInfo(student),sig=studentSignal(student),name=studentName(student);
    return`<section class="student-detail-hero-v3">
      <button type="button" class="student-detail-back-v3" data-detail-back>← Öğrencilere dön</button>
      <div class="student-detail-identity-v3"><span class="student-detail-avatar-v3">${esc(initials(name))}</span><div><span>ÖĞRENCİ PROFİLİ</span><h2>${esc(name)}</h2><p>${esc([studentGrade(student),studentTrack(student)].filter(Boolean).join(" · ")||"YKS")}</p></div></div>
      <div class="student-detail-hero-stats-v3"><div><span>Program</span><b>%${p.pct}</b></div><div><span>Son Net</span><b>${e.latestNet===null?"—":fmt(e.latestNet)}</b></div><div><span>Konu</span><b>%${t.pct}</b></div><div><span>Durum</span><b>${esc(sig.label)}</b></div></div>
    </section>`;
  }
  function detailSummary(student){
    const p=weekInfo(student),e=examInfo(student),t=topicInfo(student),prog=progressInfo(student),errs=errors(student).slice(0,6);
    return`<div class="student-summary-v3">
      <section class="student-summary-primary-v3"><article><span>7 Gün Çalışma</span><b>${fmt(prog.hours)} sa</b><small>Odak süresi</small></article><article><span>7 Gün Soru</span><b>${prog.questions}</b><small>Toplam soru</small></article><article><span>Program Uyumu</span><b>%${p.pct}</b><small>${p.done}/${p.filled} görev</small></article><article><span>Son Deneme</span><b>${e.latestNet===null?"—":fmt(e.latestNet)}</b><small>${e.delta===null?"İlk kayıt":`${e.delta>=0?"+":""}${fmt(e.delta)} değişim`}</small></article></section>
      <section class="student-summary-grid-v3"><article class="student-panel-v3 student-focus-v3"><div class="student-panel-head-v3"><div><span>KOÇ ODAĞI</span><h3>Dikkat edilmesi gerekenler</h3></div></div>${t.overdue? `<div class="student-alert-v3"><b>${t.overdue} geciken konu</b><small>Konu planında son tarihi geçen kayıtlar var.</small></div>`:""}${e.delta!==null&&e.delta<0?`<div class="student-alert-v3"><b>${fmt(Math.abs(e.delta))} net düşüş</b><small>Son iki deneme arasında gerileme var.</small></div>`:""}${errs.length?`<div class="student-alert-v3"><b>${errorCount(student)} hata kaydı</b><small>Hata Defteri incelemesi öneriliyor.</small></div>`:""}${!t.overdue&&!(e.delta!==null&&e.delta<0)&&!errs.length?empty("Kritik takip sinyali görünmüyor."):""}</article>
      <article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>SON DENEMELER</span><h3>Performans akışı</h3></div><button data-detail-section="exams">Tümünü aç</button></div>${recentStudentExams(student,5)}</article>
      <article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>PROGRAM</span><h3>Bu haftanın akışı</h3></div><button data-detail-section="program">Programa git</button></div>${studentProgramPulse(student)}</article>
      <article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>KONU İLERLEMESİ</span><h3>Ders bazlı durum</h3></div><button data-detail-section="topics">Konuları aç</button></div>${studentSubjectProgress(student)}</article></section>
    </div>`;
  }
  function recentStudentExams(student,limit=5){
    const list=exams(student).slice(-limit).reverse();
    if(!list.length)return empty("Henüz deneme kaydı yok.");
    return`<div class="student-feed-v3">${list.map(exam=>`<div><span><b>${esc(exam.name||exam.type||"Deneme")}</b><small>${esc(exam.date||"Tarih yok")}</small></span><strong>${fmt(num(exam.totalNet))} net</strong></div>`).join("")}</div>`;
  }
  function studentProgramPulse(student){
    const w=weekInfo(student);
    if(!w.week)return empty("Bu öğrenci için program haftası yok.");
    return`<div class="student-day-bars-v3">${w.byDay.map((d,i)=>{const pct=d.filled?Math.round(d.done/d.filled*100):0;return`<div><span>${DAYS[i]}</span><i><em style="width:${pct}%"></em></i><b>${d.filled?`${d.done}/${d.filled}`:"—"}</b></div>`}).join("")}</div>`;
  }
  function studentSubjectProgress(student){
    const map=new Map();
    for(const item of topics(student)){const subject=text(item.subject||item.lesson||item.ders,60)||"Diğer",row=map.get(subject)||{total:0,done:0};row.total++;if(num(item.st)>=3)row.done++;map.set(subject,row)}
    const list=[...map.entries()].slice(0,7);
    if(!list.length)return empty("Konu paylaşımı yok.");
    return`<div class="student-subject-bars-v3">${list.map(([name,row])=>{const pct=row.total?Math.round(row.done/row.total*100):0;return`<div><span>${esc(name)}</span><i><em style="width:${pct}%"></em></i><b>%${pct}</b></div>`}).join("")}</div>`;
  }
  function detailProgram(student){
    const current=selectedProgramWeek(student);
    if(!current.week)return empty("Öğrencinin kayıtlı programı yok.");
    return`<section class="student-detail-workspace-v3"><div class="student-panel-head-v3"><div><span>PROGRAMIM</span><h3>Gerçek haftalık program</h3></div><button class="coach-primary" data-detail-action="program_task">Görev gönder</button></div>${canonicalProgramMirror(student,current)}</section>`;
  }
  function detailExams(student){
    const e=examInfo(student),vals=e.list.map(x=>num(x.totalNet));
    return`<section class="student-detail-workspace-v3"><div class="student-detail-metric-row-v3"><article><span>Deneme Sayısı</span><b>${e.list.length}</b></article><article><span>Son Net</span><b>${e.latestNet===null?"—":fmt(e.latestNet)}</b></article><article><span>Değişim</span><b>${e.delta===null?"—":`${e.delta>=0?"+":""}${fmt(e.delta)}`}</b></article><article><span>En İyi</span><b>${vals.length?fmt(Math.max(...vals)):"—"}</b></article></div><div class="student-detail-two-v3"><article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>NET TRENDİ</span><h3>Deneme gelişimi</h3></div></div>${lineSvg(vals)}</article><article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>GEÇMİŞ</span><h3>Tüm denemeler</h3></div><button data-detail-action="post_exam_task">Görev gönder</button></div>${recentStudentExams(student,20)}</article></div></section>`;
  }
  function detailProgress(student){
    const p=progressInfo(student),w=weekInfo(student),e=examInfo(student),t=topicInfo(student);
    return`<section class="student-detail-workspace-v3"><div class="student-progress-hero-v3"><div><span>7 GÜNLÜK ODAK</span><b>${fmt(p.hours)} saat</b><small>${p.questions} soru çözüldü</small></div><div class="student-progress-ring-v3"><strong>%${w.pct}</strong><span>program uyumu</span></div></div><div class="student-detail-three-v3"><article class="student-panel-v3"><h3>Program ritmi</h3>${studentProgramPulse(student)}</article><article class="student-panel-v3"><h3>Konu ilerlemesi</h3>${studentSubjectProgress(student)}</article><article class="student-panel-v3"><h3>Deneme özeti</h3><div class="student-big-stat-v3"><b>${e.latestNet===null?"—":fmt(e.latestNet)}</b><span>son net</span><small>${t.complete}/${t.list.length} konu tamamlandı</small></div></article></div></section>`;
  }
  function detailTopics(student){
    const t=topicInfo(student);
    return`<section class="student-detail-workspace-v3"><div class="student-detail-metric-row-v3"><article><span>Toplam</span><b>${t.list.length}</b></article><article><span>Tamam</span><b>${t.complete}</b></article><article><span>Aktif</span><b>${t.active}</b></article><article><span>Geciken</span><b>${t.overdue}</b></article></div><article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>KONU LİSTESİ</span><h3>Öğrencinin paylaştığı konular</h3></div><button data-detail-action="program_task">Görev gönder</button></div><div class="student-topic-table-v3">${t.list.length?t.list.map(item=>`<div><span>${esc(item.subject||item.lesson||item.ders||"Ders")}</span><b>${esc(item.topic||item.name||item.konu||"Konu")}</b><small>${item.deadline?esc(item.deadline):"Son tarih yok"}</small><i class="${num(item.st)>=3?"done":num(item.st)>0?"active":""}">${num(item.st)>=3?"Tamam":num(item.st)>0?"Devam":"Başlanmadı"}</i></div>`).join(""):empty("Konu kaydı yok.")}</div></article></section>`;
  }
  function detailErrors(student){
    const list=errors(student).slice().sort((a,b)=>num(b.n||b.count||1)-num(a.n||a.count||1));
    return`<section class="student-detail-workspace-v3"><div class="student-errors-hero-v3"><div><span>HATA DEFTERİ</span><b>${errorCount(student)}</b><small>toplam tekrar</small></div><button class="coach-primary" data-message-student="${esc(student.studentUid)}">Öğrenciye mesaj gönder</button></div><article class="student-panel-v3"><div class="student-panel-head-v3"><div><span>KAYITLAR</span><h3>Hata yoğunluğu</h3></div></div><div class="student-error-list-v3">${list.length?list.map(item=>`<div><span>${esc(item.subject||item.lesson||item.ders||"Ders")}</span><b>${esc(item.topic||item.konu||"Konu")}</b><small>${esc(item.type||item.errorType||"Hata")}</small><strong>${Math.max(1,num(item.n||item.count||1))}×</strong></div>`).join(""):empty("Hata kaydı yok.")}</div></article></section>`;
  }
  function studentDetailPage(){
    const student=(snapshot.students||[]).find(s=>s.studentUid===ui.selectedUid);
    if(!student)return`<div class="coach-empty">Öğrenci bulunamadı.</div>`;
    const renderer={summary:detailSummary,program:detailProgram,exams:detailExams,progress:detailProgress,topics:detailTopics,errors:detailErrors}[ui.detailTab]||detailSummary;
    return`<div class="student-detail-page-v3">${detailHero(student)}${detailNav(student)}${renderer(student)}</div>`;
  }
  async function runDetailAction(type){
    const student=(snapshot.students||[]).find(s=>s.studentUid===ui.selectedUid);if(!student)return;
    const textValue=prompt(type==="post_exam_task"?"Deneme sonrası görev:":"Öğrenciye gönderilecek görev:");
    if(!textValue?.trim())return;
    try{await core()?.sendAction?.(student.studentUid,type,{text:textValue.trim(),date:new Date().toISOString().slice(0,10)});alert("Gönderildi ✓")}catch(error){alert("Gönderilemedi: "+text(error?.message||error,160))}
  }

  function renderPage(){
    const host=$("dashboardView");if(!host)return;
    const page=ui.page in PAGE_META?ui.page:"home",meta=PAGE_META[page];
    $("coachPageTitle").textContent=meta[0];$("coachPageSubtitle").textContent=meta[1];
    document.querySelectorAll("[data-coach-page]").forEach(btn=>btn.classList.toggle("on",btn.dataset.coachPage===page));
    const search=$("coachGlobalSearch");if(search&&search.value!==ui.search)search.value=ui.search;
    host.classList.remove("hidden");
    if(ui.detail){
      host.innerHTML=studentDetailPage();
      bindPage();
      return;
    }
    host.innerHTML=({home:homePage,students:studentsPage,programs:programsPage,reports:reportsPage,exams:examsPage,topics:topicsPage,errors:errorsPage,messages:messagesPage,settings:settingsPage}[page]||homePage)();
    bindPage();
  }

  function setPage(page){
    if(!(page in PAGE_META))page="home";
    ui.page=page;ui.detail=false;
    if(page!=="messages")ui.messageUid="";
    renderPage();closeMobileSidebar();
  }
  function openDetail(uid,tab){
    ui.detail=true;ui.returnPage=ui.page;ui.selectedUid=uid;ui.detailTab=tab||"summary";
    const ok=core()?.selectStudent?.(uid,ui.detailTab);
    if(ok===false){ui.detail=false;renderPage();return}
    $("coachPageTitle").textContent="Öğrenci Detayı";$("coachPageSubtitle").textContent="Yeni koç görünümü · canlı öğrenci verileri";
    renderPage();
  }
  function closeDetail(){ui.detail=false;setPage(ui.returnPage||"students")}
  function closeMobileSidebar(){document.getElementById("sidebar")?.classList.remove("open");document.getElementById("overlay")?.classList.remove("show")}

  function bindPage(){
    document.querySelectorAll("[data-page-action]").forEach(btn=>btn.addEventListener("click",()=>setPage(btn.dataset.pageAction)));
    document.querySelectorAll("[data-student-detail]").forEach(btn=>btn.addEventListener("click",()=>openDetail(btn.dataset.studentDetail,btn.dataset.detailTab||"summary")));
    document.querySelectorAll("[data-detail-section]").forEach(btn=>btn.addEventListener("click",()=>{ui.detailTab=btn.dataset.detailSection||"summary";renderPage()}));
    document.querySelectorAll("[data-detail-back]").forEach(btn=>btn.addEventListener("click",closeDetail));
    document.querySelectorAll("[data-detail-action]").forEach(btn=>btn.addEventListener("click",()=>runDetailAction(btn.dataset.detailAction)));

    document.querySelectorAll("[data-message-student]").forEach(btn=>btn.addEventListener("click",()=>{ui.messageUid=btn.dataset.messageStudent;setPage("messages")}));
    document.querySelectorAll("[data-message-contact]").forEach(btn=>btn.addEventListener("click",()=>{ui.messageUid=btn.dataset.messageContact;renderPage()}));
    document.querySelectorAll("[data-student-filter]").forEach(btn=>btn.addEventListener("click",()=>{ui.studentFilter=btn.dataset.studentFilter||"all";renderPage()}));
    document.querySelector("[data-message-search]")?.addEventListener("input",event=>{ui.search=event.target.value;renderPage()});
    document.querySelector("[data-connect-student]")?.addEventListener("click",openConnectModal);
    document.querySelector("[data-program-task]")?.addEventListener("click",()=>{const s=selectedStudent();if(s)openDetail(s.studentUid,"program");else setPage("students")});
    document.querySelectorAll("[data-program-select]").forEach(btn=>btn.addEventListener("click",()=>{ui.selectedUid=btn.dataset.programSelect||"";renderPage()}));
    document.querySelectorAll("[data-program-week-shift]").forEach(btn=>btn.addEventListener("click",()=>{const s=selectedStudent();if(!s)return;const current=selectedProgramWeek(s),next=current.index+Number(btn.dataset.programWeekShift);if(next>=0&&next<current.model.weeks.length){ui.programWeekByStudent.set(s.studentUid,current.model.weeks[next].week);renderPage()}}));
    document.querySelector("[data-program-week-current]")?.addEventListener("click",()=>{const s=selectedStudent();if(!s)return;const m=programModel(s),found=m.weeks.find(w=>w.week===mondayKeyLocal())||m.weeks.at(-1);if(found){ui.programWeekByStudent.set(s.studentUid,found.week);renderPage()}});

    document.querySelectorAll("[data-print-report]").forEach(btn=>btn.addEventListener("click",()=>window.print()));
    document.querySelector("[data-refresh-data]")?.addEventListener("click",async event=>{event.currentTarget.disabled=true;try{await core()?.refresh?.()}finally{event.currentTarget.disabled=false}});
    document.querySelectorAll("[data-pref-toggle]").forEach(btn=>btn.addEventListener("click",()=>{const prefs=loadPrefs(),key=btn.dataset.prefToggle;prefs[key]=!prefs[key];savePrefs(prefs);renderPage()}));
    document.querySelector("[data-pref-page]")?.addEventListener("change",event=>{const prefs=loadPrefs();prefs.page=event.target.value;savePrefs(prefs)});
    document.querySelector("[data-message-form]")?.addEventListener("submit",sendMessage);
  }
  async function sendMessage(event){
    event.preventDefault();const student=(snapshot.students||[]).find(s=>s.studentUid===ui.messageUid),input=event.currentTarget.elements.message,message=text(input?.value,500);
    if(!student||!message)return;const button=event.currentTarget.querySelector("button");button.disabled=true;
    try{
      await core()?.sendAction?.(student.studentUid,"coach_note",{text:message});
      const list=ui.sessionMessages.get(student.studentUid)||[];list.push({text:message,time:new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date())});ui.sessionMessages.set(student.studentUid,list);input.value="";renderPage();
    }catch(error){alert("Mesaj gönderilemedi: "+text(error?.message||error,160))}finally{button.disabled=false}
  }
  function openConnectModal(){
    const overlay=document.createElement("div");overlay.className="coach-modal-backdrop";
    overlay.innerHTML=`<form class="coach-modal"><div class="coach-card-header"><div><h3>Öğrenci Ekle</h3><p>YKS Defterim içindeki 12 karakterlik Koç Kodum kodunu gir.</p></div><button type="button" class="coach-modal-close">×</button></div><input class="field" name="code" maxlength="14" autocomplete="off" placeholder="XXXX-XXXX-XXXX" required><div class="coach-modal-feedback"></div><button class="coach-primary" type="submit">Öğrenciyi ekle</button></form>`;
    document.body.append(overlay);const form=overlay.querySelector("form"),input=form.elements.code,feedback=overlay.querySelector(".coach-modal-feedback");
    const close=()=>overlay.remove();overlay.addEventListener("click",e=>{if(e.target===overlay)close()});overlay.querySelector(".coach-modal-close").onclick=close;
    input.addEventListener("input",()=>{input.value=core()?.formatCode?.(input.value)||input.value});
    form.addEventListener("submit",async e=>{e.preventDefault();const button=form.querySelector("button[type=submit]");button.disabled=true;feedback.textContent="";try{const result=await core()?.connectStudent?.(input.value);feedback.className="coach-modal-feedback coach-success";feedback.textContent=result?.already?"Bu öğrenci zaten bağlı.":"Öğrenci eklendi ✓";setTimeout(close,350)}catch(error){feedback.className="coach-modal-feedback coach-error";feedback.textContent=text(error?.message||error,180)}finally{button.disabled=false}});
    input.focus();
  }

  function updateHeader(){
    const date=$("coachDate");if(date)date.textContent=new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"long",year:"numeric",weekday:"long"}).format(new Date());
    const name=text(snapshot.coach?.displayName||snapshot.user?.displayName,80)||"Koç";
    const side=$("coachSidebarName"),avatar=$("coachSidebarAvatar"),topAvatar=$("coachTopAvatar"),notify=$("coachNotifyCount");
    if(side)side.textContent=name;
    if(avatar)avatar.textContent=initials(name).slice(0,1);
    if(topAvatar)topAvatar.textContent=initials(name).slice(0,1);
    if(notify){
      const count=pendingItems(99).length;
      notify.textContent=String(Math.min(99,count));
      notify.classList.toggle("hidden",count===0);
    }
  }
  function receive(next){
    snapshot=next||core()?.snapshot?.()||snapshot;
    if(!ui.selectedUid&&snapshot.students?.length)ui.selectedUid=snapshot.students[0].studentUid;
    updateHeader();renderPage();
  }

  document.addEventListener("click",event=>{
    const nav=event.target.closest("[data-coach-page]");if(nav)setPage(nav.dataset.coachPage);
  });
  $("coachGlobalSearch")?.addEventListener("input",event=>{ui.search=event.target.value;renderPage()});
  $("coachDetailBack")?.addEventListener("click",closeDetail);
  window.addEventListener("yks:coach-state",event=>receive(event.detail));

  function start(){
    const snap=core()?.snapshot?.();if(snap)receive(snap);else setTimeout(start,60);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.__YKS_COACH_DASHBOARD_V20__={version:"2.0.0",setPage,render:renderPage};
})();