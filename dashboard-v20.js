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
  const ui={page:"home",detail:false,returnPage:"home",search:"",selectedUid:"",messageUid:"",sessionMessages:new Map()};
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
    return{p,weeks,week:weeks.at(-1)||null};
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
    const list=snapshot.students||[],active=list.filter(s=>s.share).length,risk=list.filter(s=>studentSignal(s).key==="risk").length;
    const selected=selectedStudent();
    return`${pageHead("Öğrenciler","Tüm öğrencilerini tek ekranda takip et, filtrele ve yönet.",`<button class="coach-primary" data-connect-student>+ Öğrenci Ekle</button>`)}
      <section class="coach-kpis four">${kpi("Toplam Öğrenci",String(list.length),"Bağlı öğrenci sayısı","♟")}${kpi("Aktif Paylaşım",String(active),"Canlı veri gönderen","●","green")}${kpi("Risk Sinyali",String(risk),"Takip gerektiren","△","red")}${kpi("Son 7 Gün Soru",String(list.reduce((sum,s)=>sum+progressInfo(s).questions,0)),"Toplam soru","▥","purple")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Öğrenci Listesi","Arama üst bardan da çalışır")}<div class="coach-filter-row"><button class="coach-filter-pill on">Tümü (${list.length})</button><span class="coach-filter-pill">Aktif (${active})</span><span class="coach-filter-pill">Riskli (${risk})</span></div>${studentTable()}</article><aside class="coach-grid"><article class="coach-card">${cardHeader("Seçili Öğrenci Özeti")}${selectedSummary(selected)}</article><article class="coach-card">${cardHeader("Risk Durumu Dağılımı")}<div class="coach-donut-wrap"><div class="coach-donut"><strong>${list.length}<small>Öğrenci</small></strong></div><div class="coach-legend-list"><div class="coach-legend-item"><i></i><span>İyi / Çok iyi</span><b>${list.filter(s=>studentSignal(s).key==="good").length}</b></div><div class="coach-legend-item"><i></i><span>Takip</span><b>${list.filter(s=>studentSignal(s).key==="warn").length}</b></div><div class="coach-legend-item"><i></i><span>Riskli</span><b>${risk}</b></div></div></div></article></aside></section>`;
  }

  function programsPage(){
    const students=filteredStudents(),programmed=students.filter(s=>programModel(s).weeks.length),avgPct=programmed.length?Math.round(avg(programmed.map(s=>weekInfo(s).pct))):0;
    const rows=students.map(student=>{const w=weekInfo(student),m=programModel(student),name=studentName(student);return`<tr><td><div class="coach-person"><span class="coach-avatar">${esc(initials(name))}</span><b>Haftalık Program</b></div></td><td>${esc(name)}</td><td>${esc(studentTrack(student))}</td><td>${m.weeks.length}</td><td>${progressHtml(w.pct)}</td><td>${statusHtml(student)}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="program">Detay ›</button></td></tr>`}).join("");
    const selected=selectedStudent(),week=weekInfo(selected);
    return`${pageHead("Programlar","Öğrencilerin çalışma programlarını görüntüle, takip et ve görev gönder.",`<button class="coach-primary" data-program-task>+ Programa Görev Gönder</button>`)}
      <section class="coach-kpis four">${kpi("Programı Olan",String(programmed.length),`${students.length} öğrenciden`,"▣")}${kpi("Haftalık Uyum",`%${avgPct}`,"Aktif program ortalaması","◎","green")}${kpi("Planlanan Görev",String(students.reduce((sum,s)=>sum+weekInfo(s).filled,0)),"Son haftalar","◷","orange")}${kpi("Tamamlanan Görev",String(students.reduce((sum,s)=>sum+weekInfo(s).done,0)),"Son haftalar","✓","purple")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Program Listesi","Öğrencilerin YKS Defterim Programım verisi")}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Program</th><th>Öğrenci</th><th>Tür</th><th>Hafta</th><th>Uyum</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Program verisi yok.")}</td></tr>`}</tbody></table></div></article><aside class="coach-card">${cardHeader("Seçili Program Özeti")}${selectedSummary(selected)}</aside></section>
      <section class="coach-grid equal"><article class="coach-card">${cardHeader("Haftalık Program Akışı","Seçili öğrencinin son haftası")}${week.week?programPreview(week.week):empty("Seçili öğrencide program haftası yok.")}</article><article class="coach-card">${cardHeader("Program Uyum Trendi","Öğrenciler arası haftalık uyum")}${lineSvg(students.map(s=>weekInfo(s).pct).filter(Number.isFinite))}</article></section>`;
  }
  function programPreview(week){
    const lessons=new Map();
    for(const kind of["r","s"])(week?.data?.[kind]||[]).forEach((row,r)=>{for(let d=0;d<7;d++){const task=text(row?.[d],80);if(!task)continue;const key=task.split(/[·:-]/)[0].trim()||`Görev ${r+1}`;if(!lessons.has(key))lessons.set(key,Array(7).fill(""));lessons.get(key)[d]=task}});
    const entries=[...lessons.entries()].slice(0,5);if(!entries.length)return empty("Bu haftada planlanmış görev yok.");
    return`<div class="coach-table-wrap"><div class="coach-program-week"><div class="head">Ders</div>${DAYS.map(d=>`<div class="head">${d}</div>`).join("")}${entries.map(([name,days],row)=>`<div class="head">${esc(name)}</div>${days.map((task,d)=>`<div class="${task?`lesson c${(row+d)%5+1}`:""}" title="${esc(task)}">${task?esc(text(task,16)):""}</div>`).join("")}`).join("")}</div></div>`;
  }

  function reportsPage(){
    const a=aggregate(),students=filteredStudents();
    const deltas=students.map(s=>examInfo(s).delta).filter(Number.isFinite),netGain=deltas.length?avg(deltas):0;
    return`${pageHead("Takip & Rapor","Öğrencilerinin ilerleyişini analiz et, karşılaştır ve raporla.",`<button class="coach-primary" data-print-report>Rapor Oluştur</button>`)}
      <section class="coach-kpis four">${kpi("Haftalık Çalışma",`${fmt((snapshot.students||[]).reduce((sum,s)=>sum+progressInfo(s).hours,0))} sa`,"Tüm öğrenciler","◷")}${kpi("Program Uyumu",`%${a.programPct}`,"Haftalık ortalama","%","green")}${kpi("Net Değişimi",`${netGain>=0?"+":""}${fmt(netGain)}`,"Son iki deneme ort.","↗","blue",netGain>=0?"up":"down")}${kpi("Raporlanan Öğrenci",`${a.shared}/${a.students}`,"Canlı paylaşımı olan","♟","purple")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Genel Performans Trendi","Kayıtlı son denemelerin ortalama neti")}${lineSvg(lineSeriesValues())}</article><article class="coach-card">${cardHeader("Öğrenci Karşılaştırma","Program ve deneme görünümü")}${studentComparison(students.slice(0,8))}</article></section>
      <section class="coach-grid three"><article class="coach-card">${cardHeader("Ders Bazlı İlerleme")}${subjectList(8)}</article><article class="coach-card">${cardHeader("Aylık Rapor Özeti")}<div class="coach-donut-wrap"><div class="coach-donut"><strong>${a.students}<small>Öğrenci</small></strong></div><div class="coach-legend-list"><div class="coach-legend-item"><i></i><span>Paylaşım aktif</span><b>${a.shared}</b></div><div class="coach-legend-item"><i></i><span>Takip / risk</span><b>${(snapshot.students||[]).filter(s=>studentSignal(s).key!=="good").length}</b></div></div></div></article><article class="coach-card">${cardHeader("Son Rapor Hareketleri")}${recentActivities(6)}</article></section>`;
  }
  function studentComparison(students){
    if(!students.length)return empty("Öğrenci verisi yok.");
    return`<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>#</th><th>Ad Soyad</th><th>Program</th><th>Son Net</th><th>Değişim</th><th>Durum</th></tr></thead><tbody>${students.map((s,i)=>{const e=examInfo(s);return`<tr><td>${i+1}</td><td>${esc(studentName(s))}</td><td>%${weekInfo(s).pct}</td><td>${e.latestNet===null?"—":fmt(e.latestNet)}</td><td>${e.delta===null?"—":`${e.delta>=0?"+":""}${fmt(e.delta)}`}</td><td>${statusHtml(s)}</td></tr>`}).join("")}</tbody></table></div>`;
  }

  function examsPage(){
    const students=filteredStudents(),all=students.flatMap(student=>exams(student).map(exam=>({student,exam}))),latestNets=students.map(s=>examInfo(s).latestNet).filter(Number.isFinite),best=all.length?Math.max(...all.map(x=>num(x.exam.totalNet))):0,deltas=students.map(s=>examInfo(s).delta).filter(Number.isFinite);
    const rows=students.map((s,i)=>{const e=examInfo(s);return`<tr><td>${i+1}</td><td><div class="coach-person"><span class="coach-avatar">${esc(initials(studentName(s)))}</span><b>${esc(studentName(s))}</b></div></td><td>${esc(e.latest?.name||e.latest?.type||"—")}</td><td>${e.latestNet===null?"—":fmt(e.latestNet)}</td><td>${e.delta===null?"—":`${e.delta>=0?"↑":"↓"} ${fmt(Math.abs(e.delta))}`}</td><td>${statusHtml(s)}</td><td><button class="coach-detail-link" data-student-detail="${esc(s.studentUid)}" data-detail-tab="exams">Analiz ›</button></td></tr>`}).join("");
    return`${pageHead("Deneme Analizi","Öğrencilerin deneme performansını analiz et, karşılaştır ve geliştir.",`<button class="coach-primary" data-page-action="students">Öğrenci Seç</button>`)}
      <section class="coach-kpis four">${kpi("Ortalama Net",latestNets.length?fmt(avg(latestNets)):"—","Son denemeler","▥")}${kpi("En Yüksek Net",all.length?fmt(best):"—","Kayıtlı denemeler","★","green")}${kpi("Net Değişimi",deltas.length?`${avg(deltas)>=0?"+":""}${fmt(avg(deltas))}`:"—","Son iki deneme ort.","↗","blue")}${kpi("Toplam Deneme",String(all.length),"Paylaşılan kayıt","▤","purple")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Deneme Performans Trendi","Son denemelerin ortalama neti")}${lineSvg(lineSeriesValues())}</article><article class="coach-card">${cardHeader("Öğrenci Deneme Sıralaması","Son kayıtlar")}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>#</th><th>Ad Soyad</th><th>Son Deneme</th><th>Toplam Net</th><th>Değişim</th><th>Durum</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Deneme verisi yok.")}</td></tr>`}</tbody></table></div></article></section>
      <section class="coach-grid equal"><article class="coach-card">${cardHeader("Ders Bazlı Deneme Analizi","Konu tamamlama desteği")}${subjectList(8)}</article><article class="coach-card">${cardHeader("Son Deneme Hareketleri")}${recentExamRows(8)}</article></section>`;
  }
  function recentExamRows(limit){
    const list=(snapshot.students||[]).flatMap(student=>exams(student).map(exam=>({student,exam}))).sort((a,b)=>String(b.exam.date||"").localeCompare(String(a.exam.date||""))).slice(0,limit);
    if(!list.length)return empty("Henüz deneme kaydı yok.");
    return`<div class="coach-mini-list">${list.map(({student,exam})=>`<div class="coach-mini-row"><span class="coach-avatar">${esc(initials(studentName(student)))}</span><div><b>${esc(studentName(student))}</b><small>${esc(exam.name||exam.type||"Deneme")} · ${fmt(num(exam.totalNet))} net</small></div><span>${esc(exam.date||"")}</span></div>`).join("")}</div>`;
  }

  function topicsPage(){
    const flat=filteredStudents().flatMap(student=>topics(student).map(topic=>({student,topic}))),complete=flat.filter(x=>num(x.topic.st)>=3).length,active=flat.filter(x=>num(x.topic.st)>0&&num(x.topic.st)<3).length,now=new Date().toISOString().slice(0,10),overdue=flat.filter(x=>x.topic.deadline&&String(x.topic.deadline)<now&&num(x.topic.st)<3).length;
    const rows=flat.slice(0,80).map(({student,topic})=>{const st=num(topic.st),status=st>=3?'<span class="coach-status">Tamamlandı</span>':st>0?'<span class="coach-status info">Devam</span>':'<span class="coach-status warn">Başlanmadı</span>';return`<tr><td>${esc(topic.subject||topic.lesson||"Ders")}</td><td>${esc(topic.topic||topic.name||"Konu")}</td><td>${esc(studentName(student))}</td><td>${st>=3?"%100":st===2?"%66":st===1?"%33":"%0"}</td><td>${esc(topic.deadline||"—")}</td><td>${status}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="topics">Detay ›</button></td></tr>`}).join("");
    return`${pageHead("Konular","Öğrencilerin konu ilerleyişini analiz et, eksikleri takip et ve çalışma planını yönlendir.")}
      <section class="coach-kpis four">${kpi("Toplam Konu",String(flat.length),"Paylaşılan kayıt","▤")}${kpi("Tamamlanan",String(complete),"Pekiştirilen konular","✓","green")}${kpi("Devam Eden",String(active),"Çalışılan konular","▶","blue")}${kpi("Geciken",String(overdue),"Son tarihi geçen","△","red")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Konu Listesi","Tüm öğrencilerde paylaşılan konu kayıtları")}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Ders</th><th>Konu</th><th>Öğrenci</th><th>İlerleme</th><th>Son Tarih</th><th>Durum</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Konu verisi yok.")}</td></tr>`}</tbody></table></div></article><aside class="coach-card">${cardHeader("Ders Bazlı Konu İlerlemesi")}${subjectList(10)}<div class="coach-insight">${overdue?overdue+" geciken konu koç takibi bekliyor.":"Şu anda geciken konu görünmüyor."}</div></aside></section>`;
  }

  function errorsPage(){
    const flat=filteredStudents().flatMap(student=>errors(student).map(error=>({student,error,count:Math.max(1,num(error?.n||error?.count||1))}))),total=flat.reduce((sum,x)=>sum+x.count,0);
    const subjectMap=new Map();for(const x of flat){const subject=text(x.error.subject||x.error.lesson||x.error.ders,60)||"Diğer";subjectMap.set(subject,(subjectMap.get(subject)||0)+x.count)}
    const rows=flat.sort((a,b)=>b.count-a.count).slice(0,80).map(({student,error,count})=>`<tr><td>${esc(error.subject||error.lesson||error.ders||"Ders")}</td><td>${esc(error.topic||error.konu||"Konu")}</td><td>${esc(studentName(student))}</td><td>${esc(error.type||error.errorType||"Hata")}</td><td>${count}</td><td>${count>=4?'<span class="coach-status risk">Kritik</span>':count>=2?'<span class="coach-status warn">Açık</span>':'<span class="coach-status">Takip</span>'}</td><td><button class="coach-detail-link" data-student-detail="${esc(student.studentUid)}" data-detail-tab="errors">Detay ›</button></td></tr>`).join("");
    const subjects=[...subjectMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
    return`${pageHead("Hata Defteri","Öğrencilerin yaptıkları hataları takip et, tekrar eden konuları analiz et ve gelişimi destekle.")}
      <section class="coach-kpis four">${kpi("Toplam Hata Kaydı",String(total),"Paylaşılan hata toplamı","▤")}${kpi("Tekrar Eden",String(flat.filter(x=>x.count>=2).reduce((s,x)=>s+x.count,0)),"2+ tekrar","↻","red")}${kpi("Tekil Hata",String(flat.filter(x=>x.count===1).length),"Bir kez görülen","✓","green")}${kpi("Kritik Kayıt",String(flat.filter(x=>x.count>=4).length),"4+ tekrar","△","red")}</section>
      <section class="coach-grid two"><article class="coach-card">${cardHeader("Hata Kayıtları","Öğrencilerin paylaşılan hata defterleri")}<div class="coach-table-wrap"><table class="coach-table"><thead><tr><th>Ders</th><th>Konu</th><th>Öğrenci</th><th>Hata Türü</th><th>Tekrar</th><th>Durum</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${empty("Hata kaydı yok.")}</td></tr>`}</tbody></table></div></article><aside class="coach-card">${cardHeader("Ders Bazlı Hata Yoğunluğu")}${subjects.length?`<div class="coach-subject-list">${subjects.map(([name,count])=>`<div class="coach-subject-row"><span>${esc(name)}</span><div class="coach-subject-track"><i style="width:${Math.min(100,total?count/total*100:0)}%"></i></div><b>${count}</b></div>`).join("")}</div>`:empty("Hata verisi yok.")}</aside></section>`;
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
      <section class="coach-kpis four">${kpi("Hesap Durumu",snapshot.user?"Aktif":"Kapalı","Firebase oturumu","●","green")}${kpi("Bağlı Öğrenci",String(a.students),`${a.shared} canlı paylaşım`,"♟")}${kpi("Bildirimler",prefs.messages||prefs.program||prefs.exams?"Açık":"Kapalı","Bu cihaz tercihleri","♢","red")}${kpi("Senkronizasyon",a.shared?"Canlı":"Bekliyor","Firestore paylaşımı","↻","blue")}</section>
      <section class="coach-settings-grid"><div class="coach-settings-stack"><article class="coach-card">${cardHeader("Profil Bilgileri")}<div class="coach-profile-card"><span class="coach-avatar">${esc(initials(name))}</span><div><h3>${esc(name)}</h3><p>${esc(email)} · ${esc(snapshot.coach?.specialization||snapshot.coach?.coachTitle||"Koç")}</p></div><span class="coach-status">Doğrulandı</span></div></article>
      <article class="coach-card">${cardHeader("Bildirim Tercihleri","Bu cihazda saklanan panel tercihleri")}<div class="coach-setting-row"><div><b>Yeni mesaj bildirimi</b><small>Mesaj ekranındaki koç notlarını takip et.</small></div>${toggle("messages",prefs.messages)}</div><div class="coach-setting-row"><div><b>Program güncellemesi</b><small>Öğrenci program değişimlerini öne çıkar.</small></div>${toggle("program",prefs.program)}</div><div class="coach-setting-row"><div><b>Deneme sonucu bildirimi</b><small>Yeni deneme paylaşımını vurgula.</small></div>${toggle("exams",prefs.exams)}</div></article>
      <article class="coach-card">${cardHeader("Panel Tercihleri")}<div class="coach-setting-row"><div><b>Varsayılan sayfa</b><small>Panel açıldığında gösterilecek görünüm.</small></div><select class="coach-select" data-pref-page><option value="home" ${prefs.page==="home"?"selected":""}>Ana Sayfa</option><option value="students" ${prefs.page==="students"?"selected":""}>Öğrenciler</option><option value="reports" ${prefs.page==="reports"?"selected":""}>Takip & Rapor</option></select></div></article></div>
      <aside class="coach-settings-stack"><article class="coach-card">${cardHeader("Senkronizasyon Durumu")}<div class="coach-setting-row"><div><b>Öğrenci Uygulaması</b><small>${a.shared} öğrenciden canlı veri</small></div><span class="coach-status">Bağlı</span></div><div class="coach-setting-row"><div><b>Koç Paneli</b><small>Firebase üzerinden dinleniyor</small></div><span class="coach-status">Bağlı</span></div><div class="coach-insight">Program, deneme, konu, ilerleme ve hata verileri yalnız öğrencinin koç paylaşımı üzerinden okunur.</div></article><article class="coach-card">${cardHeader("Hızlı İşlemler")}<div class="coach-quick-actions"><button class="coach-quick-btn" data-page-action="students">Öğrenci bağlantılarını yönet <span>›</span></button><button class="coach-quick-btn" data-refresh-data>Verileri yenile <span>↻</span></button><button class="coach-quick-btn" data-print-report>Paneli yazdır <span>›</span></button></div></article></aside></section>`;
  }
  function toggle(key,on){return`<button class="coach-toggle ${on?"on":""}" type="button" data-pref-toggle="${key}" aria-pressed="${on?"true":"false"}"><i></i></button>`}
  function loadPrefs(){
    const fallback={messages:true,program:true,exams:true,page:"home"};
    try{return{...fallback,...JSON.parse(localStorage.getItem("yks-coach-v20-prefs")||"{}")}}catch{return fallback}
  }
  function savePrefs(next){
    try{localStorage.setItem("yks-coach-v20-prefs",JSON.stringify(next))}catch{}
  }

  function renderPage(){
    const host=$("dashboardView");if(!host)return;
    const page=ui.page in PAGE_META?ui.page:"home",meta=PAGE_META[page];
    $("coachPageTitle").textContent=meta[0];$("coachPageSubtitle").textContent=meta[1];
    document.querySelectorAll("[data-coach-page]").forEach(btn=>btn.classList.toggle("on",btn.dataset.coachPage===page));
    const search=$("coachGlobalSearch");if(search&&search.value!==ui.search)search.value=ui.search;
    if(ui.detail){
      host.classList.add("hidden");$("emptyState")?.classList.add("hidden");$("studentView")?.classList.remove("hidden");
      return;
    }
    $("studentView")?.classList.add("hidden");$("emptyState")?.classList.add("hidden");host.classList.remove("hidden");
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
    ui.detail=true;ui.returnPage=ui.page;ui.selectedUid=uid;
    const ok=core()?.selectStudent?.(uid,tab||"summary");
    if(ok===false){ui.detail=false;renderPage();return}
    const labels={summary:"Öğrenci Detayı",program:"Program",exams:"Deneme Analizi",progress:"Takip & Rapor",topics:"Konular",errors:"Hata Defteri"};
    $("coachPageTitle").textContent=labels[tab]||"Öğrenci Detayı";$("coachPageSubtitle").textContent="Canlı öğrenci paylaşımını ayrıntılı incele.";
    renderPage();
  }
  function closeDetail(){ui.detail=false;setPage(ui.returnPage||"students")}
  function closeMobileSidebar(){document.getElementById("sidebar")?.classList.remove("open");document.getElementById("overlay")?.classList.remove("show")}

  function bindPage(){
    document.querySelectorAll("[data-page-action]").forEach(btn=>btn.addEventListener("click",()=>setPage(btn.dataset.pageAction)));
    document.querySelectorAll("[data-student-detail]").forEach(btn=>btn.addEventListener("click",()=>openDetail(btn.dataset.studentDetail,btn.dataset.detailTab||"summary")));
    document.querySelectorAll("[data-message-student]").forEach(btn=>btn.addEventListener("click",()=>{ui.messageUid=btn.dataset.messageStudent;setPage("messages")}));
    document.querySelectorAll("[data-message-contact]").forEach(btn=>btn.addEventListener("click",()=>{ui.messageUid=btn.dataset.messageContact;renderPage()}));
    document.querySelector("[data-message-search]")?.addEventListener("input",event=>{ui.search=event.target.value;renderPage()});
    document.querySelector("[data-connect-student]")?.addEventListener("click",openConnectModal);
    document.querySelector("[data-program-task]")?.addEventListener("click",()=>{const s=selectedStudent();if(s)openDetail(s.studentUid,"program");else setPage("students")});
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