import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,signInWithPopup,setPersistence,browserLocalPersistence,signOut}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,doc,runTransaction,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

const app=initializeApp(FIREBASE_CONFIG,"yks-coach-panel");
const auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
const form=document.getElementById("registerForm"),button=document.getElementById("registerBtn"),status=document.getElementById("registerStatus");
const text=(value,max)=>String(value??"").trim().slice(0,max);
function message(value,type=""){status.textContent=value;status.className=`status ${type}`.trim()}
function friendly(error){
  const code=String(error?.code||"");
  if(code.includes("popup-closed"))return"Google giriş penceresi kapatıldı.";
  if(code.includes("popup-blocked"))return"Tarayıcı Google giriş penceresini engelledi.";
  return text(error?.message||"Koç hesabı oluşturulamadı",220);
}

form.addEventListener("submit",async event=>{
  event.preventDefault();
  const displayName=text(document.getElementById("coachName").value,80);
  const coachTitle=text(document.getElementById("coachTitle").value,100);
  const specialization=text(document.getElementById("specialization").value,160);
  if(!displayName){message("Ad Soyad alanını doldur.","err");return}
  button.disabled=true;message("Google hesabı açılıyor…");
  let signedIn=false;
  try{
    await setPersistence(auth,browserLocalPersistence);
    const result=await signInWithPopup(auth,provider),user=result.user;signedIn=true;
    if(!user?.emailVerified)throw new Error("Doğrulanmış Google hesabı gerekli");
    const registration=await runTransaction(db,async tx=>{
      const profileRef=doc(db,COLLECTIONS.profiles,user.uid),snap=await tx.get(profileRef);
      if(snap.exists()){
        const existing=snap.data();
        if(existing.role==="coach")return{existing:true};
        throw new Error("Bu Google hesabı öğrenci hesabı olarak kayıtlı. Koç hesabı için farklı bir Google hesabı kullan.");
      }
      tx.set(profileRef,{uid:user.uid,role:"coach",displayName,coachTitle,specialization,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      return{existing:false};
    });
    message(registration.existing?"Koç hesabın zaten hazır. Panele yönlendiriliyorsun…":"Koç hesabı oluşturuldu. Panele yönlendiriliyorsun…","ok");
    setTimeout(()=>location.replace("./"),650);
  }catch(error){
    console.error(error);
    if(signedIn)try{await signOut(auth)}catch{}
    message(friendly(error),"err");button.disabled=false;
  }
});
