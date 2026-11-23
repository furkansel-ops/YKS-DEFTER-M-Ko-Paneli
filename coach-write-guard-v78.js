/* v78 · Gönderim bekçisi: Firestore kota dolunca ya da bağlantı yokken yazmayı hata vermeden sonsuza dek yeniden dener;
   v80: kalıcı önbellek açık; bekleyen gönderim cihazda saklanır, panel sonraki açılışta gönderir (IndexedDB yoksa bellek: sekme kapanınca kaybolur).
   Bir yazma SLOW_MS içinde sunucuya ulaşmazsa koça uyarı çıkar; bekleyen varken sekme kapatılırsa (önbellek açılamadıysa diye) tarayıcı yine sorar.
   Elle "tekrar dene" yok: SDK zaten tekrar dener, ikinci gönderim aynı görevi iki kez yazar. */
(function(root){
"use strict";
const SLOW_MS=12000;
function createWriteGuard(win,opts={}){
  const doc=win.document,slow=opts.slowMs??SLOW_MS,pending=new Set();
  let node=null,warned=false,doneTimer=0;
  function el(){
    if(node&&node.isConnected)return node;
    node=doc.createElement("div");node.id="coachWriteGuard";node.className="coach-v78-guard";node.hidden=true;
    node.setAttribute("role","status");node.setAttribute("aria-live","polite");
    doc.body.appendChild(node);return node;
  }
  function show(kind,html){const box=el();box.className="coach-v78-guard "+kind;box.innerHTML=html;box.hidden=false}
  function render(){
    const late=[...pending].filter(item=>item.late).length;
    if(late){
      warned=true;win.clearTimeout(doneTimer);
      show("is-wait","<b>"+late+" gönderim sunucuya ulaşmadı</b><span>Bağlantı yok ya da günlük kota doldu. Gönderim bu cihazda saklandı; sunucu açılınca kendiliğinden gider. Paneli kapatırsan bir sonraki açılışta gönderilir.</span>");
    }else if(warned&&!pending.size){
      warned=false;show("is-ok","<b>Bekleyen gönderimler ulaştı</b>");
      doneTimer=win.setTimeout(()=>{if(node)node.hidden=true},5000);
    }
  }
  function track(promise){
    if(!promise||typeof promise.then!=="function")return promise;
    const item={late:false};pending.add(item);
    const timer=win.setTimeout(()=>{item.late=true;render()},slow);
    const settle=()=>{win.clearTimeout(timer);pending.delete(item);render()};
    promise.then(settle,settle);
    return promise;
  }
  win.addEventListener("beforeunload",event=>{if(pending.size){event.preventDefault();event.returnValue=""}});
  return{track,pendingCount:()=>pending.size};
}
if(root.document&&root.addEventListener){const guard=createWriteGuard(root);root.coachWriteGuard=guard.track}
if(typeof module!=="undefined"&&module.exports)module.exports={createWriteGuard,SLOW_MS};
})(typeof window!=="undefined"?window:globalThis);
