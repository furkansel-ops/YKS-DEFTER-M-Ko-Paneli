(function(){
  "use strict";

  const ROOT_ID="programVideoLibrary";
  const INSTANCES=[
    "https://pipedapi.adminforge.de",
    "https://pipedapi.rivo.lol",
    "https://pipedapi.leptons.xyz",
    "https://piped-api.lunar.icu",
    "https://api.piped.private.coffee",
    "https://pipedapi.kavin.rocks"
  ];
  const CATEGORIES={
    all:{label:"Tümü",term:""},
    konu:{label:"Konu",term:"konu anlatımı"},
    kamp:{label:"Kamp",term:"kamp"},
    soru:{label:"Soru",term:"soru çözümü"},
    deneme:{label:"Deneme",term:"deneme çözümü"},
    tekrar:{label:"Tekrar",term:"genel tekrar"}
  };
  const SUBJECTS=["Matematik","Geometri","Türkçe","Edebiyat","Fizik","Kimya","Biyoloji","Tarih","Coğrafya","Felsefe","Din Kültürü"];
  const TEACHERS=[
    {n:"MatMan",d:["Matematik","Matematik (AYT)"],id:"UCi3OrIf5uqtIdR7tX9ZZyVA"},
    {n:"Bıyıklı Matematik",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCxHSLxJcuZ8SpF5zgJeQ8Cg"},
    {n:"Rehber Matematik",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCzxj9SKkLuDhdxSDXxcmwqQ"},
    {n:"Eyüp B.",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCbv-0vMCnLqwlZXUWoI4a5w"},
    {n:"Mert Hoca",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCzMVi_CPx_XB9uhMl4uWR9g"},
    {n:"Matematiğin Güler Yüzü",d:["Matematik","Matematik (AYT)"],id:"UCdj-EiG6PCWM7ZqR5PzNOOw"},
    {n:"İlyas Güneş",d:["Matematik","Matematik (AYT)"],id:"UCRTxepZJj8vWniao-0Tkp4g"},
    {n:"SML Hoca",d:["Matematik","Matematik (AYT)"],id:"UCSiatSbaEJZpI_tkQXwRbcw"},
    {n:"Moz Akademi",d:["Matematik","Matematik (AYT)"],id:"UCSqWGILaJ5qZ_D9149h6RJg"},
    {n:"Barış Çelenk",d:["Matematik","Matematik (AYT)"],id:"UCpogE5vw7rLYOuzYoDk1Ang"},
    {n:"Kenan Kara",d:["Geometri","Geometri (AYT)"],id:"UC1X0FciySnrdUZld0O_tDXw"},
    {n:"Merkeze Teğet Geometri",d:["Geometri","Geometri (AYT)"],id:"UCGlM-klG4Q70q9WkXX9cTWA"},
    {n:"Nurtaç Hoca",d:["Geometri","Geometri (AYT)"],id:"UCNgmALbCj_-cQpxiIpTqOSQ"},
    {n:"Rüştü Hoca",d:["Türkçe","Edebiyat"],id:"UCyohoF5P2JFvc3KLLZRwDug"},
    {n:"Türkçenin Matematiği",d:["Türkçe"],id:"UCCAmWzulVvB1DjnR5IQCTUQ"},
    {n:"Deniz Hoca",d:["Edebiyat"],id:"UC_ke4VQZo9TewOf-p-LSx_Q"},
    {n:"Özcan Aykın",d:["Fizik","Fizik (AYT)"],id:"UC_IRxSYYyDa4Li9lxAM4xbQ"},
    {n:"VIP Fizik",d:["Fizik","Fizik (AYT)"],h:"@vipfizik"},
    {n:"Umut Öncül",d:["Fizik","Fizik (AYT)"],h:"@umutonculakademi"},
    {n:"Ertan Sinan Şahin",d:["Fizik","Fizik (AYT)"],id:"UCbIOzYvwXdvFGxt70WD2Y2A"},
    {n:"Fizikle Barış",d:["Fizik","Fizik (AYT)"],id:"UCooJ3GA5zLWnrV-qWupXakg"},
    {n:"Altuğ Güneş",d:["Fizik","Fizik (AYT)"],id:"UCx4651yGDx7DR6KiyxG_CUA"},
    {n:"Fizikfinito",d:["Fizik","Fizik (AYT)"],id:"UC-zDbhn0rWs2EywjGQMrK7A"},
    {n:"Fizik Evim",d:["Fizik","Fizik (AYT)"],id:"UCkRD9iVmodQfET17HeqxUrg"},
    {n:"Ferrum",d:["Kimya","Kimya (AYT)"],id:"UC0yco2kB3xW3WI__8E8HaKw"},
    {n:"Kimya Adası",d:["Kimya","Kimya (AYT)"],h:"@kimyaadasi"},
    {n:"Meschemy Kimya",d:["Kimya","Kimya (AYT)"],h:"@meschemykimya"},
    {n:"Paraksilen Kimya",d:["Kimya","Kimya (AYT)"],h:"@paraksilen"},
    {n:"Kimya Dersleri · Sinan İhtiyaroğlu",d:["Kimya","Kimya (AYT)"],h:"@kimyadersleri"},
    {n:"Semih Balmuk Kimya",d:["Kimya","Kimya (AYT)"],id:"UCoholQ9DKzOGYK7y9rYgrmA"},
    {n:"Levent Özdede ile Kimya",d:["Kimya","Kimya (AYT)"],h:"@leventozdede"},
    {n:"Görkem Şahin · Benim Hocam",d:["Kimya","Kimya (AYT)"],h:"@benimhocam",q:"Görkem Şahin Kimya",searchOnly:true},
    {n:"Biosem",d:["Biyoloji","Biyoloji (AYT)"],h:"@biosem"},
    {n:"Dr. Biyoloji",d:["Biyoloji","Biyoloji (AYT)"],id:"UCY7Nh-CV3qqaWTxldlG4RCA"},
    {n:"Selin Hoca",d:["Biyoloji","Biyoloji (AYT)"],id:"UCl50Dhk1O-5YZYwHrWmuLtw"},
    {n:"Senin Biyolojin",d:["Biyoloji","Biyoloji (AYT)"],h:"@seninbiyolojin"},
    {n:"Betül Biyoloji",d:["Biyoloji","Biyoloji (AYT)"],h:"@betulbiyoloji"},
    {n:"Cici Biyoloji",d:["Biyoloji","Biyoloji (AYT)"],h:"@CiciBiyoloji"},
    {n:"Yavuz Tuna Coğrafya",d:["Coğrafya","Coğrafya (AYT)"],id:"UCai5DYClxEjy-VH-eqz4MIA"},
    {n:"Coğrafyanın Kodları",d:["Coğrafya","Coğrafya (AYT)"],id:"UCIvX31CHx2RsFQM46qbjuJA"},
    {n:"KR Akademi",d:["Tarih","Tarih (AYT)","Coğrafya","Coğrafya (AYT)"],id:"UC1NYzm_kEss5qScWlf-TtwA"},
    {n:"Hocalara Geldik",d:["Türkçe","Matematik","Matematik (AYT)","Geometri","Geometri (AYT)","Fizik","Fizik (AYT)","Kimya","Kimya (AYT)","Biyoloji","Biyoloji (AYT)","Tarih","Tarih (AYT)","Coğrafya","Coğrafya (AYT)","Felsefe","Din Kültürü","Edebiyat"],id:"UCBcM2J8SHyq8GUSvrhWnwTg",searchOnly:true},
    {n:"Tonguç Akademi",d:["Türkçe","Matematik","Matematik (AYT)","Geometri","Geometri (AYT)","Fizik","Fizik (AYT)","Kimya","Kimya (AYT)","Biyoloji","Biyoloji (AYT)","Tarih","Tarih (AYT)","Coğrafya","Coğrafya (AYT)","Felsefe","Din Kültürü","Edebiyat"],id:"UCm3vDH7Uvz_qwql5Qih4yGw",searchOnly:true}
  ];

  const state={scope:"TYT",subject:"Matematik",teacher:"",category:"all",mode:"videos",query:"",nextpage:"",instance:"",busy:false,items:[],cache:new Map()};

  const $=id=>document.getElementById(id);
  function esc(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
  function compact(v){return String(v??"").replace(/\s+/g," ").trim();}
  function teacherByName(){return TEACHERS.find(t=>t.n===state.teacher)||null;}
  function subjectKey(){
    if(state.scope==="AYT"&&state.subject!=="Edebiyat")return state.subject+" (AYT)";
    return state.subject;
  }
  function availableSubjects(){
    return SUBJECTS.filter(subject=>{
      if(state.scope==="TYT"&&subject==="Edebiyat")return false;
      const key=state.scope==="AYT"&&subject!=="Edebiyat"?subject+" (AYT)":subject;
      return TEACHERS.some(t=>t.d.includes(key));
    });
  }
  function availableTeachers(){const key=subjectKey();return TEACHERS.filter(t=>t.d.includes(key));}

  function buildShell(){
    const page=$("programsPage"),summary=page?.querySelector(".program-summary");
    if(!page||!summary||$(ROOT_ID))return;
    const section=document.createElement("section");
    section.id=ROOT_ID;
    section.className="coach-video-library";
    section.innerHTML=
      '<div class="coach-video-head"><div><span>HOCALAR &amp; VİDEOLAR</span><h3>Güncel video kütüphanesi</h3><p>TYT / AYT, ders, hoca ve içerik türüne göre ara; videoyu veya oynatma listesini öğrencinin programına tek tıkla ekle.</p></div><div class="coach-video-live"><i></i><b>Canlı kaynak</b><small>YouTube sonuçları</small></div></div>'+
      '<div class="coach-video-filters">'+
        '<div class="coach-video-seg" id="coachVideoScope"><button type="button" data-scope="TYT" class="active">TYT</button><button type="button" data-scope="AYT">AYT</button></div>'+
        '<label><span>Ders</span><select id="coachVideoSubject"></select></label>'+
        '<label class="coach-video-teacher-field"><span>Hoca</span><select id="coachVideoTeacher"></select></label>'+
        '<div class="coach-video-seg" id="coachVideoMode"><button type="button" data-mode="videos" class="active">Videolar</button><button type="button" data-mode="playlists">Oynatma listeleri</button></div>'+
      '</div>'+
      '<div class="coach-video-tools"><div class="coach-video-cats" id="coachVideoCategories"></div><label class="coach-video-search"><span>⌕</span><input id="coachVideoSearch" type="search" placeholder="Başlıkta ara..."></label><button type="button" id="coachVideoRefresh" class="coach-video-refresh">↻ Yenile</button></div>'+
      '<div class="coach-video-meta"><span id="coachVideoStatus">Kaynak hazırlanıyor…</span><a id="coachVideoChannel" href="#" target="_blank" rel="noopener noreferrer" class="hidden">YouTube kanalını aç ↗</a></div>'+
      '<div class="coach-video-results" id="coachVideoResults"></div>'+
      '<div class="coach-video-more-row"><button type="button" id="coachVideoMore" class="coach-video-more hidden">Daha fazla getir</button></div>';
    summary.insertAdjacentElement("afterend",section);
    const cats=$("coachVideoCategories");
    Object.entries(CATEGORIES).forEach(([key,row])=>{
      const b=document.createElement("button");b.type="button";b.dataset.category=key;b.textContent=row.label;if(key==="all")b.classList.add("active");cats.appendChild(b);
    });
    bind();
    rebuildSubjects();
  }

  function bind(){
    $("coachVideoScope")?.addEventListener("click",event=>{
      const b=event.target.closest("[data-scope]");if(!b||state.busy)return;
      state.scope=b.dataset.scope||"TYT";
      document.querySelectorAll("#coachVideoScope [data-scope]").forEach(x=>x.classList.toggle("active",x===b));
      rebuildSubjects();void load(true);
    });
    $("coachVideoSubject")?.addEventListener("change",event=>{state.subject=event.target.value;rebuildTeachers();void load(true);});
    $("coachVideoTeacher")?.addEventListener("change",event=>{state.teacher=event.target.value;syncChannelLink();void load(true);});
    $("coachVideoMode")?.addEventListener("click",event=>{
      const b=event.target.closest("[data-mode]");if(!b||state.busy)return;
      state.mode=b.dataset.mode||"videos";
      document.querySelectorAll("#coachVideoMode [data-mode]").forEach(x=>x.classList.toggle("active",x===b));
      void load(true);
    });
    $("coachVideoCategories")?.addEventListener("click",event=>{
      const b=event.target.closest("[data-category]");if(!b||state.busy)return;
      state.category=b.dataset.category||"all";
      document.querySelectorAll("#coachVideoCategories [data-category]").forEach(x=>x.classList.toggle("active",x===b));
      void load(true);
    });
    let timer=0;
    $("coachVideoSearch")?.addEventListener("input",event=>{
      clearTimeout(timer);state.query=compact(event.target.value);timer=setTimeout(()=>void load(true),350);
    });
    $("coachVideoRefresh")?.addEventListener("click",()=>{state.cache.clear();void load(true,true);});
    $("coachVideoMore")?.addEventListener("click",()=>void load(false));
    $("coachVideoResults")?.addEventListener("click",event=>{
      const add=event.target.closest("[data-video-add]"),open=event.target.closest("[data-video-open]");
      if(add){const item=state.items[Number(add.dataset.videoAdd)];if(item)addToProgram(item);}
      if(open){const item=state.items[Number(open.dataset.videoOpen)];if(item)window.open(item.url,"_blank","noopener,noreferrer");}
    });
  }

  function rebuildSubjects(){
    const select=$("coachVideoSubject"),subjects=availableSubjects();if(!select)return;
    const wanted=subjects.includes(state.subject)?state.subject:subjects[0]||"Matematik";state.subject=wanted;
    select.innerHTML=subjects.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");select.value=wanted;
    rebuildTeachers();
  }
  function rebuildTeachers(){
    const select=$("coachVideoTeacher"),teachers=availableTeachers();if(!select)return;
    const wanted=teachers.some(t=>t.n===state.teacher)?state.teacher:(teachers[0]?.n||"");state.teacher=wanted;
    select.innerHTML=teachers.map(t=>'<option value="'+esc(t.n)+'">'+esc(t.n)+'</option>').join("");select.value=wanted;
    syncChannelLink();
  }
  function syncChannelLink(){
    const a=$("coachVideoChannel"),t=teacherByName();if(!a)return;
    const url=t?.id?"https://www.youtube.com/channel/"+encodeURIComponent(t.id):(t?.h?"https://www.youtube.com/"+t.h:"");
    a.classList.toggle("hidden",!url);if(url)a.href=url;
  }

  function queryText(){
    const t=teacherByName(),category=CATEGORIES[state.category]?.term||"",base=t?.q||t?.n||"";
    return [base,state.scope,state.subject,category,state.query].filter(Boolean).join(" ");
  }
  function cacheKey(){return [state.mode,state.scope,state.subject,state.teacher,state.category,state.query].join("|");}
  function setStatus(text){const n=$("coachVideoStatus");if(n)n.textContent=text;}
  function setBusy(on){
    state.busy=on;
    const root=$(ROOT_ID);root?.classList.toggle("loading",on);
    ["coachVideoSubject","coachVideoTeacher","coachVideoRefresh","coachVideoSearch"].forEach(id=>{const n=$(id);if(n)n.disabled=on;});
  }

  async function fetchJson(base,path){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
    try{
      const res=await fetch(base+path,{headers:{Accept:"application/json"},cache:"no-store",credentials:"omit",signal:controller.signal});
      if(!res.ok)throw new Error("HTTP "+res.status);
      return await res.json();
    }finally{clearTimeout(timer);}
  }
  async function firstJson(path){
    const attempts=INSTANCES.map(base=>fetchJson(base,path).then(data=>({base,data})));
    try{return await Promise.any(attempts);}catch{throw new Error("video-kaynagi-yok");}
  }
  function resultItems(data){return Array.isArray(data)?data:(Array.isArray(data?.items)?data.items:(Array.isArray(data?.relatedStreams)?data.relatedStreams:[]));}
  function nextToken(data){return String(data?.nextpage||data?.nextPage||"");}
  function videoId(item){
    const raw=String(item?.id||item?.url||item?.videoUrl||"");
    const m=raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/)||raw.match(/\/watch\/([A-Za-z0-9_-]{6,})/)||raw.match(/^([A-Za-z0-9_-]{6,})$/);
    return m?m[1]:"";
  }
  function playlistId(item){
    const raw=String(item?.id||item?.url||"");
    const m=raw.match(/[?&]list=([A-Za-z0-9_-]{8,})/)||raw.match(/^((?:PL|UU|OLAK5uy_)[A-Za-z0-9_-]{8,})$/);
    return m?m[1]:"";
  }
  function normalize(item){
    if(state.mode==="playlists"){
      const id=playlistId(item);if(!id)return null;
      return {kind:"playlist",id,title:compact(item?.name||item?.title||"Oynatma listesi"),thumb:String(item?.thumbnail||item?.thumbnailUrl||""),by:compact(item?.uploaderName||item?.uploader||item?.uploaderUrl||state.teacher),meta:compact(item?.videos?item.videos+" video":item?.videoCount?item.videoCount+" video":""),url:"https://www.youtube.com/playlist?list="+encodeURIComponent(id)};
    }
    const id=videoId(item);if(!id)return null;
    return {kind:"video",id,title:compact(item?.title||"YouTube videosu"),thumb:String(item?.thumbnail||item?.thumbnailUrl||("https://i.ytimg.com/vi/"+id+"/hqdefault.jpg")),by:compact(item?.uploaderName||item?.uploader||state.teacher),meta:compact(item?.uploadedDate||item?.publishedText||item?.duration||""),url:"https://www.youtube.com/watch?v="+encodeURIComponent(id)};
  }
  function dedupe(list){
    const seen=new Set(),out=[];
    for(const x of list){if(!x||seen.has(x.kind+":"+x.id))continue;seen.add(x.kind+":"+x.id);out.push(x);}
    return out;
  }

  async function requestPage(reset){
    const q=queryText(),filter=state.mode==="playlists"?"playlists":"videos";
    if(!reset&&state.nextpage&&state.instance){
      const path="/nextpage/search?nextpage="+encodeURIComponent(state.nextpage)+"&q="+encodeURIComponent(q)+"&filter="+encodeURIComponent(filter);
      try{return {base:state.instance,data:await fetchJson(state.instance,path)};}catch{}
    }
    const path="/search?q="+encodeURIComponent(q)+"&filter="+encodeURIComponent(filter);
    return await firstJson(path);
  }

  async function load(reset=true,forced=false){
    if(state.busy||!state.teacher)return;
    const key=cacheKey();
    if(reset&&!forced&&state.cache.has(key)){
      const saved=state.cache.get(key);state.items=saved.items.slice();state.nextpage=saved.nextpage;state.instance=saved.instance;render();return;
    }
    setBusy(true);
    if(reset){state.items=[];state.nextpage="";state.instance="";renderSkeleton();}
    setStatus((reset?"Güncel ":"Daha fazla ")+(state.mode==="playlists"?"oynatma listesi":"video")+" aranıyor…");
    try{
      const response=await requestPage(reset),incoming=dedupe(resultItems(response.data).map(normalize).filter(Boolean));
      state.instance=response.base;state.nextpage=nextToken(response.data);
      state.items=dedupe(reset?incoming:state.items.concat(incoming));
      state.cache.set(key,{items:state.items.slice(),nextpage:state.nextpage,instance:state.instance,at:Date.now()});
      render();
    }catch(error){
      if(reset)renderError();
      else setStatus("Yeni sonuç getirilemedi. Biraz sonra tekrar deneyebilirsin.");
      console.error("[coach-video-library]",error);
    }finally{setBusy(false);}
  }

  function renderSkeleton(){
    const host=$("coachVideoResults");if(!host)return;
    host.innerHTML=Array.from({length:4},()=>'<article class="coach-video-card skeleton"><div></div><span></span><b></b><small></small></article>').join("");
    $("coachVideoMore")?.classList.add("hidden");
  }
  function renderError(){
    const host=$("coachVideoResults");if(!host)return;
    const searchUrl="https://www.youtube.com/results?search_query="+encodeURIComponent(queryText());
    host.innerHTML='<div class="coach-video-empty"><span>↗</span><b>Canlı video kaynağı şu an yanıt vermedi</b><p>Hoca ve filtre seçimin korundu. İstersen aynı aramayı YouTube’da açabilirsin.</p><a href="'+esc(searchUrl)+'" target="_blank" rel="noopener noreferrer">YouTube’da ara</a></div>';
    setStatus("Canlı kaynak bağlantısı kurulamadı.");
    $("coachVideoMore")?.classList.add("hidden");
  }
  function render(){
    const host=$("coachVideoResults"),more=$("coachVideoMore");if(!host)return;
    if(!state.items.length){
      const searchUrl="https://www.youtube.com/results?search_query="+encodeURIComponent(queryText());
      host.innerHTML='<div class="coach-video-empty"><span>⌕</span><b>Bu filtrede sonuç bulunamadı</b><p>Filtreyi genişletebilir veya aynı aramayı YouTube’da açabilirsin.</p><a href="'+esc(searchUrl)+'" target="_blank" rel="noopener noreferrer">YouTube’da ara</a></div>';
      setStatus(state.teacher+" · "+state.scope+" · sonuç yok");
      more?.classList.add("hidden");return;
    }
    host.innerHTML=state.items.map((item,index)=>{
      const thumb=item.thumb?'<img src="'+esc(item.thumb)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<div class="coach-video-thumb-empty">▶</div>';
      return '<article class="coach-video-card">'+
        '<button type="button" class="coach-video-thumb" data-video-open="'+index+'" aria-label="Videoyu aç">'+thumb+'<span>'+(item.kind==="playlist"?"Liste":"Video")+'</span></button>'+
        '<div class="coach-video-card-body"><small>'+esc(item.by||state.teacher)+'</small><b>'+esc(item.title)+'</b><em>'+esc(item.meta||state.scope+" · "+state.subject)+'</em></div>'+
        '<div class="coach-video-card-actions"><button type="button" data-video-open="'+index+'">Aç ↗</button><button type="button" class="primary" data-video-add="'+index+'">Programa ekle</button></div>'+
      '</article>';
    }).join("");
    setStatus(state.teacher+" · "+state.scope+" "+state.subject+" · "+state.items.length+" "+(state.mode==="playlists"?"liste":"video")+" gösteriliyor");
    more?.classList.toggle("hidden",!state.nextpage);
  }

  function addToProgram(item){
    const hero=compact($("programHeroName")?.textContent);
    if(!hero||/seçilmedi/i.test(hero)){setStatus("Önce soldan bir öğrenci seç, sonra videoyu programa ekle.");return;}
    const open=$("programAddTaskBtn");if(!open)return;
    open.click();
    setTimeout(()=>{
      const backdrop=$("programTaskBackdrop");
      if(!backdrop||backdrop.classList.contains("hidden")){setStatus("Çalışma ekleme penceresi açılamadı.");return;}
      $("programCustomTab")?.click();
      const text=$("programTaskText"),video=$("programTaskVideo");
      const prefix=item.kind==="playlist"?"Oynatma listesi":"Video izle";
      if(text){text.value=(prefix+" · "+state.teacher+" · "+item.title).slice(0,600);text.dispatchEvent(new Event("input",{bubbles:true}));}
      if(video){video.value=item.url;video.dispatchEvent(new Event("input",{bubbles:true}));}
      backdrop.scrollIntoView({block:"center",behavior:"smooth"});
      setStatus(item.kind==="playlist"?"Oynatma listesi görev penceresine eklendi.":"Video görev penceresine eklendi.");
    },0);
  }

  function boot(){buildShell();if($(ROOT_ID))void load(true);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();