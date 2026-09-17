(()=>{
  "use strict";

  const VERSION="1.6.0";
  const CONTENT_ID="content";
  const TAB_ID="tabs";
  const normalize=value=>String(value??"").replace(/\s+/g," ").trim();
  const text=node=>normalize(node?.textContent||"");
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const fmt=value=>Number.isFinite(value)?value.toFixed(1):"—";

  function isExamActive(){
    const active=document.getElementById(TAB_ID)?.querySelector(".tab.on");
    return text(active)==="Deneme";
  }

  function findCard(host,label){
    return[...host.querySelectorAll(":scope > .grid > .card")].find(card=>text(card.querySelector("h3")).includes(label));
  }

  function parseNet(value){
    const n=Number(normalize(value).replace(",",".").replace(/[^0-9.-]/g,""));
    return Number.isFinite(n)?n:null;
  }

  function parseExamRow(row){
    const left=row.querySelector(":scope > span"),right=row.querySelector(":scope > b");
    const raw=text(left),parts=raw.split(" · ");
    const date=parts.length>1?parts.shift():"";
    return{
      row,
      left,
      right,
      date,
      name:parts.join(" · ")||raw||"Deneme",
      net:parseNet(text(right))
    };
  }

  function examData(card){
    return[...card?.querySelectorAll(":scope > .row")||[]].map(parseExamRow).filter(item=>item.net!==null);
  }

  function metric(label,value,note,tone="neutral"){
    return`<article class="exam-metric" data-tone="${esc(tone)}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></article>`;
  }

  function buildTrend(items){
    if(items.length<2)return'<div class="exam-trend-empty"><span>↗</span><div><b>Trend için en az 2 deneme gerekli</b><small>Yeni denemeler geldikçe net eğrisi otomatik oluşur.</small></div></div>';
    const chronological=[...items].reverse().slice(-10);
    const values=chronological.map(item=>item.net);
    const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
    const width=640,height=150,padX=22,padY=18;
    const points=values.map((value,index)=>{
      const x=values.length===1?width/2:padX+(index/(values.length-1))*(width-padX*2);
      const y=height-padY-((value-min)/range)*(height-padY*2);
      return{x,y,value};
    });
    const polyline=points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const circles=points.map((p,index)=>`<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"></circle><title>${esc(chronological[index].name)} · ${fmt(p.value)} net</title></g>`).join("");
    const latest=values.at(-1),first=values[0],delta=latest-first;
    return`<div class="exam-trend-head"><div><span class="exam-eyebrow">Net trendi</span><b>Son ${values.length} deneme</b></div><span class="exam-trend-delta ${delta>=0?"up":"down"}">${delta>=0?"+":""}${fmt(delta)} net</span></div><div class="exam-chart-wrap"><svg class="exam-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Deneme net trendi"><line x1="${padX}" x2="${width-padX}" y1="${height-padY}" y2="${height-padY}"></line><polyline points="${polyline}"></polyline>${circles}</svg><div class="exam-chart-scale"><span>${fmt(min)}</span><span>${fmt(max)}</span></div></div>`;
  }

  function overview(host,items){
    if(host.querySelector(":scope > .exam-dashboard-head"))return;
    const latest=items[0]?.net??null,previous=items[1]?.net??null;
    const delta=latest!==null&&previous!==null?latest-previous:null;
    const avg=items.length?items.reduce((sum,item)=>sum+item.net,0)/items.length:null;
    const best=items.length?Math.max(...items.map(item=>item.net)):null;
    const head=document.createElement("section");
    head.className="exam-dashboard-head";
    head.innerHTML=`<div class="exam-live-strip"><div><span class="exam-live-dot"></span><div><b>Canlı deneme analizi</b><small>YKS Defterim’e yeni deneme eklendiğinde bu ekran otomatik yenilenir.</small></div></div><span class="exam-version">Deneme v${VERSION}</span></div><div class="exam-metrics">${metric("Son deneme",latest===null?"—":`${fmt(latest)} net`,delta===null?"Karşılaştırma için veri bekleniyor":`${delta>=0?"+":""}${fmt(delta)} net değişim`,delta===null?"neutral":delta>=0?"positive":"negative")}${metric("Ortalama",avg===null?"—":`${fmt(avg)} net`,`${items.length} kayıt üzerinden`,"average")}${metric("En yüksek",best===null?"—":`${fmt(best)} net`,"Kayıtlı denemelerdeki zirve","best")}${metric("Deneme sayısı",String(items.length),items.length?"Canlı paylaşılan kayıt":"Henüz kayıt yok","count")}</div><section class="exam-trend-panel">${buildTrend(items)}</section>`;
    host.prepend(head);
  }

  function decorateHistory(card,items){
    if(!card)return;
    card.classList.add("exam-history-card");
    const title=card.querySelector(":scope > h3");
    if(title&&!card.querySelector(":scope > .exam-section-head")){
      const head=document.createElement("div");
      head.className="exam-section-head";
      head.innerHTML=`<div><span class="exam-eyebrow">Geçmiş</span><h3>${esc(text(title))}</h3><p>Son denemeden geriye doğru net değişimini ve kayıtlarını karşılaştır.</p></div><span class="exam-count">${items.length} kayıt</span>`;
      title.replaceWith(head);
    }

    if(items.length&&!card.querySelector(":scope > .exam-history-tools")){
      const tools=document.createElement("div");
      tools.className="exam-history-tools";
      tools.innerHTML='<label><span>Denemelerde ara</span><input type="search" class="field exam-search" placeholder="Deneme adı veya tarih"></label><button type="button" class="exam-clear-search">Temizle</button>';
      const anchor=card.querySelector(":scope > .row");
      if(anchor)card.insertBefore(tools,anchor);else card.append(tools);
      const input=tools.querySelector("input"),clear=tools.querySelector("button");
      const apply=()=>{
        const q=normalize(input.value).toLocaleLowerCase("tr-TR");
        items.forEach(item=>item.row.hidden=Boolean(q)&&!`${item.date} ${item.name}`.toLocaleLowerCase("tr-TR").includes(q));
      };
      input.addEventListener("input",apply);
      clear.addEventListener("click",()=>{input.value="";apply();input.focus()});
    }

    items.forEach((item,index)=>{
      if(item.row.dataset.examV16==="1")return;
      item.row.dataset.examV16="1";
      item.row.classList.add("exam-history-row");
      const older=items[index+1]?.net??null;
      const delta=older===null?null:item.net-older;
      if(item.left)item.left.innerHTML=`<small>${esc(item.date||"Tarih yok")}</small><strong>${esc(item.name)}</strong>${index===0?'<em>Son deneme</em>':""}`;
      if(item.right){
        item.right.className="exam-history-score";
        item.right.innerHTML=`<span>${fmt(item.net)} net</span>${delta===null?'<small class="flat">İlk kayıt</small>':`<small class="${delta>0?"up":delta<0?"down":"flat"}">${delta>0?"+":""}${fmt(delta)}</small>`}`;
      }
    });

    const empty=card.querySelector(":scope > .empty");
    if(empty){empty.classList.add("exam-empty");empty.innerHTML='<span>◎</span><div><b>Henüz deneme yok</b><small>Öğrenci ilk denemesini eklediğinde analiz burada başlayacak.</small></div>'}
  }

  function clickTab(label){
    const button=[...(document.getElementById(TAB_ID)?.querySelectorAll(".tab")||[])].find(item=>text(item)===label);
    button?.click();
  }

  function decorateAction(card){
    if(!card)return;
    card.classList.add("exam-action-card");
    const title=card.querySelector(":scope > h3");
    if(title&&!card.querySelector(":scope > .exam-section-head")){
      const head=document.createElement("div");
      head.className="exam-section-head";
      head.innerHTML=`<div><span class="exam-eyebrow">Koç işlemi</span><h3>${esc(text(title))}</h3><p>Deneme sonrasında öğrencinin Programım alanına kontrollü görev gönder.</p></div><span class="exam-secure">Güvenli action</span>`;
      title.replaceWith(head);
    }

    const form=card.querySelector("form[data-action='post_exam_task']");
    if(!form)return;
    form.classList.add("exam-action-form");
    if(!card.querySelector(":scope > .exam-presets")){
      const presets=document.createElement("div");
      presets.className="exam-presets";
      presets.innerHTML='<span>Hazır görevler</span><div><button type="button">Yanlış çıkan konuları tekrar et</button><button type="button">En düşük netli dersten 40 soru çöz</button><button type="button">Deneme yanlışlarını Hata Defteri’ne işle</button></div>';
      const input=form.querySelector("input[name='text']");
      presets.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{if(input){input.value=text(button);input.focus()}}));
      card.insertBefore(presets,form);
    }
    if(!card.querySelector(":scope > .exam-action-footer")){
      const footer=document.createElement("div");
      footer.className="exam-action-footer";
      footer.innerHTML='<button type="button" data-exam-tab="İlerleme">İlerleme analizine geç <span>→</span></button><button type="button" data-exam-tab="Hata Defteri">Hata Defteri’ni aç <span>→</span></button>';
      card.append(footer);
      footer.querySelectorAll("[data-exam-tab]").forEach(button=>button.addEventListener("click",()=>clickTab(button.dataset.examTab)));
    }
  }

  function enhance(){
    const host=document.getElementById(CONTENT_ID);
    if(!host||!isExamActive())return;
    const grid=host.querySelector(":scope > .grid");
    if(!grid)return;
    if(host.dataset.examV16===VERSION||host.dataset.examV16==="working")return;
    host.dataset.examV16="working";
    host.classList.add("exam-dashboard-v16");
    const history=findCard(host,"Deneme geçmişi"),action=findCard(host,"Deneme sonrası görev");
    const items=examData(history);
    overview(host,items);
    decorateHistory(history,items);
    decorateAction(action);
    host.dataset.examV16=VERSION;
  }

  let queued=false;
  function queue(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;enhance()});
  }

  const observer=new MutationObserver(queue);
  function start(){
    const content=document.getElementById(CONTENT_ID),tabs=document.getElementById(TAB_ID);
    if(content)observer.observe(content,{childList:true,subtree:true});
    if(tabs)observer.observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    queue();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.__YKS_COACH_EXAM_V16__={version:VERSION,refresh:queue};
})();