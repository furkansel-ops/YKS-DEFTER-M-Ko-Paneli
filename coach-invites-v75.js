/* v75 · Ayarlar › Koç davetleri (yalnız yönetici): kayıt davet kodu üretimi ve davet listesi.
   Kod kuraldaki ^[A-Z2-9]{24}$ kümesinden, eşit olasılıkla (reddetmeli örnekleme) üretilir. Saf; DOM ve ağ yok. */
(function(root){"use strict";
const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789",LIMIT=256-256%ALPHABET.length; // 238: üstü atılır, kayma olmaz

/** randomBytes(n) -> Uint8Array; tarayıcıda crypto.getRandomValues ile verilir. */
function makeInviteCode(randomBytes,length=24){
  let out="";
  while(out.length<length)for(const b of randomBytes(length*2)){if(b<LIMIT&&out.length<length)out+=ALPHABET[b%ALPHABET.length]}
  return out;
}

const toMs=value=>{if(!value)return 0;if(typeof value.toMillis==="function")return value.toMillis();const n=new Date(value).getTime();return Number.isFinite(n)?n:0};

/** open | used | expired */
function inviteStatus(data,now){
  if(data?.status==="used")return"used";
  return toMs(data?.expiresAt)>now?"open":"expired";
}

/** Açıklar önde (en yakın bitiş önce), sonra kullanılan ve süresi dolanlar (en yeni önce). */
function inviteRows(docs,now){
  const order={open:0,used:1,expired:2};
  return (Array.isArray(docs)?docs:[]).map(d=>({code:String(d.id||""),status:inviteStatus(d.data,now),expiresAt:toMs(d.data?.expiresAt),createdAt:toMs(d.data?.createdAt),usedAt:toMs(d.data?.usedAt)}))
    .filter(r=>/^[A-Z2-9]{24}$/.test(r.code))
    .sort((a,b)=>order[a.status]-order[b.status]||(a.status==="open"?a.expiresAt-b.expiresAt:b.createdAt-a.createdAt));
}

function invitesHtml(rows,{esc,fmtDate}){
  if(!rows.length)return'<p class="coach-v75-empty">Henüz davet yok. Ürettiğin kodlar burada listelenir.</p>';
  const label={open:"Açık",used:"Kullanıldı",expired:"Süresi doldu"};
  return'<ul class="coach-v75-list">'+rows.map(r=>{
    const when=r.status==="open"?"Son gün: "+fmtDate(r.expiresAt):r.status==="used"?"Kullanıldı: "+fmtDate(r.usedAt):"Bitti: "+fmtDate(r.expiresAt);
    return'<li class="coach-v75-row" data-status="'+r.status+'"><span class="coach-v75-code"><code>'+esc(r.code)+'</code><small>'+esc(label[r.status])+' · '+esc(when)+'</small></span>'
      +(r.status==="open"?'<span class="coach-v75-actions"><button type="button" class="coach-v75-btn" data-v75-copy="'+esc(r.code)+'">Kopyala</button><button type="button" class="coach-v75-btn danger" data-v75-cancel="'+esc(r.code)+'">İptal et</button></span>':"")+'</li>';
  }).join("")+'</ul>';
}

const api={ALPHABET,makeInviteCode,inviteStatus,inviteRows,invitesHtml};
root.CoachInvites=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
