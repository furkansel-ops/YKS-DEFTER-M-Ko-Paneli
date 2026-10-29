import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,setPersistence,browserLocalPersistence,GoogleAuthProvider,signInWithPopup,updateProfile}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,doc,getDoc,runTransaction,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

/* v34 · Koç girişi ve kaydı: e-posta/şifre + Google, şifre sıfırlama.
   Google ile giriş (#signInBtn) ve profil yükleme app-reset.js'te kalır.
   Bu modül bir akış yürütürken window.__YKS_COACH_AUTH_BUSY__ ile app-reset'in
   "koç profili yok → çıkış" davranışını bekletir; akış bitince sayfayı yeniler. */
const app=getApps().find(item=>item.name==="yks-coach-panel")||initializeApp(FIREBASE_CONFIG,"yks-coach-panel");
const auth=getAuth(app),db=getFirestore(app);
try{auth.languageCode="tr"}catch{}
const PENDING_KEY="yks_coach_pending_v1";
const $=id=>document.getElementById(id);
const text=(value,max)=>String(value??"").trim().slice(0,max);
const loginForm=$("nbLoginForm"),registerForm=$("nbRegisterForm");

function status(message,type=""){const node=$("authStatus");if(!node)return;node.textContent=message;node.className=`status ${type}`.trim()}
function busy(on){if(on)window.__YKS_COACH_AUTH_BUSY__=true;else setTimeout(()=>{window.__YKS_COACH_AUTH_BUSY__=false},800);for(const form of [loginForm,registerForm])form?.querySelectorAll("button,input").forEach(node=>{node.disabled=on})}
function friendly(error){
  const code=String(error?.code||"");
  const map={
    "auth/invalid-email":"E-posta adresi geçerli görünmüyor.",
    "auth/invalid-credential":"E-posta veya şifre hatalı.",
    "auth/wrong-password":"E-posta veya şifre hatalı.",
    "auth/user-not-found":"Bu e-posta ile kayıtlı hesap yok.",
    "auth/email-already-in-use":"Bu e-posta ile zaten bir hesap var. Giriş yap sekmesini kullan.",
    "auth/weak-password":"Şifre en az 8 karakter olmalı.",
    "auth/too-many-requests":"Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
    "auth/network-request-failed":"İnternet bağlantısı yok gibi görünüyor.",
    "auth/operation-not-allowed":"E-posta ile giriş açık değil.",
    "auth/popup-closed-by-user":"Google giriş penceresi kapatıldı.",
    "auth/popup-blocked":"Tarayıcı Google giriş penceresini engelledi."
  };
  return map[code]||text(error?.message||"Bir sorun oluştu. Tekrar dene.",200);
}
const continueUrl=()=>({url:location.origin+location.pathname,handleCodeInApp:false});
async function verifyMail(user){try{await sendEmailVerification(user,continueUrl())}catch{await sendEmailVerification(user)}}
function readPending(){try{return JSON.parse(localStorage.getItem(PENDING_KEY)||"null")}catch{return null}}
function writePending(value){try{value?localStorage.setItem(PENDING_KEY,JSON.stringify(value)):localStorage.removeItem(PENDING_KEY)}catch{}}

/* register.js ile aynı sözleşme: öğrenci profili olan hesap koç olamaz. */
async function createCoachProfile(user,fields){
  return runTransaction(db,async tx=>{
    const ref=doc(db,COLLECTIONS.profiles,user.uid),snap=await tx.get(ref);
    if(snap.exists()){
      if(snap.data().role==="coach")return{existing:true};
      throw new Error("Bu hesap öğrenci hesabı olarak kayıtlı. Koç hesabı için farklı bir hesap kullan.");
    }
    tx.set(ref,{uid:user.uid,role:"coach",displayName:fields.displayName,coachTitle:fields.coachTitle,specialization:fields.specialization,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    return{existing:false};
  });
}

function setMode(mode){
  const register=mode==="register";
  loginForm.hidden=register;registerForm.hidden=!register;
  document.querySelectorAll("[data-nb-mode]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.nbMode===mode)));
  $("nbAuthTitle").textContent=register?"Koç hesabı oluştur":"Tekrar hoş geldin";
  $("nbAuthSub").textContent=register?"Bilgilerin bağlantı kurduğun öğrencilere görünür.":"Koç hesabınla giriş yap.";
  status(register?"Ad soyad zorunlu; unvan ve uzmanlık isteğe bağlı.":"Koç hesabınla giriş yap.");
}
document.querySelectorAll("[data-nb-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.nbMode)));
if(location.hash==="#register")setMode("register");

loginForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const email=text(loginForm.email.value,120),password=loginForm.password.value;
  if(!/^\S+@\S+\.\S+$/.test(email)){status("Geçerli bir e-posta adresi yaz.","err");return}
  if(!password){status("Şifreni yaz.","err");return}
  busy(true);status("Giriş yapılıyor…");
  try{
    await setPersistence(auth,browserLocalPersistence);
    const {user}=await signInWithEmailAndPassword(auth,email,password);
    if(!user.emailVerified){
      await verifyMail(user);await signOut(auth);
      status(`E-postanı doğrula: ${email} adresine bağlantı gönderdik. Doğruladıktan sonra giriş yap.`,"ok");return;
    }
    const snap=await getDoc(doc(db,COLLECTIONS.profiles,user.uid));
    if(!snap.exists()){
      const pending=readPending();
      if(pending&&pending.email===email.toLowerCase()){await createCoachProfile(user,pending);writePending(null);}
      else{await signOut(auth);status("Bu hesapta koç profili yok. “Koç hesabı oluştur” sekmesinden kayıt olabilirsin.","err");return}
    }else if(snap.data()?.role!=="coach"){
      await signOut(auth);status("Bu hesap öğrenci hesabı. Koç paneli için ayrı bir koç hesabı gerekir.","err");return;
    }
    status("Giriş yapıldı. Panel açılıyor…","ok");location.reload();
  }catch(error){
    console.error(error);try{if(auth.currentUser)await signOut(auth)}catch{}
    status(friendly(error),"err");
  }finally{busy(false)}
});

loginForm?.querySelector("[data-nb-reset]")?.addEventListener("click",async()=>{
  const email=text(loginForm.email.value,120);
  if(!/^\S+@\S+\.\S+$/.test(email)){status("Önce e-posta adresini yaz, sonra “Şifremi unuttum”a bas.","err");loginForm.email.focus();return}
  try{
    try{await sendPasswordResetEmail(auth,email,continueUrl())}catch(error){if(String(error?.code||"").includes("continue"))await sendPasswordResetEmail(auth,email);else throw error}
    status(`Şifre sıfırlama bağlantısını gönderdik: ${email}. Gelmediyse spam klasörüne bak.`,"ok");
  }catch(error){status(friendly(error),"err")}
});

function registerFields(){
  return{displayName:text(registerForm.displayName.value,80),coachTitle:text(registerForm.coachTitle.value,100),specialization:text(registerForm.specialization.value,160)};
}
registerForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const fields=registerFields(),email=text(registerForm.email.value,120).toLowerCase(),password=registerForm.password.value;
  if(!fields.displayName){status("Ad Soyad alanını doldur.","err");return}
  if(!/^\S+@\S+\.\S+$/.test(email)){status("Geçerli bir e-posta adresi yaz.","err");return}
  if(password.length<8||!/\d/.test(password)){status("Şifre en az 8 karakter olmalı ve bir rakam içermeli.","err");return}
  busy(true);status("Hesap oluşturuluyor…");
  try{
    await setPersistence(auth,browserLocalPersistence);
    const {user}=await createUserWithEmailAndPassword(auth,email,password);
    try{await updateProfile(user,{displayName:fields.displayName})}catch{}
    // Profil, e-posta doğrulandıktan sonraki ilk girişte oluşturulur (Firestore kuralları doğrulanmış e-posta ister).
    writePending({...fields,email});
    await verifyMail(user);await signOut(auth);
    setMode("login");loginForm.email.value=email;
    status(`Hesabın oluşturuldu. ${email} adresine doğrulama bağlantısı gönderdik; doğruladıktan sonra giriş yap.`,"ok");
  }catch(error){
    console.error(error);try{if(auth.currentUser)await signOut(auth)}catch{}
    status(friendly(error),"err");
  }finally{busy(false)}
});

registerForm?.querySelector("[data-nb-google-register]")?.addEventListener("click",async()=>{
  const fields=registerFields();
  if(!fields.displayName){status("Ad Soyad alanını doldur.","err");registerForm.displayName.focus();return}
  busy(true);status("Google hesabı açılıyor…");
  let signedIn=false;
  try{
    const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
    await setPersistence(auth,browserLocalPersistence);
    const {user}=await signInWithPopup(auth,provider);signedIn=true;
    if(!user?.emailVerified)throw new Error("Doğrulanmış Google hesabı gerekli");
    const result=await createCoachProfile(user,fields);
    status(result.existing?"Koç hesabın zaten hazır. Panel açılıyor…":"Koç hesabı oluşturuldu. Panel açılıyor…","ok");
    location.reload();
  }catch(error){
    console.error(error);if(signedIn)try{await signOut(auth)}catch{}
    status(friendly(error),"err");
  }finally{busy(false)}
});

/* Ayarlar › Hesap: giriş yöntemi ve e-posta hesaplarında şifre değiştirme. */
function isPasswordUser(user){return Array.isArray(user?.providerData)&&user.providerData.some(item=>item?.providerId==="password")}
onAuthStateChanged(auth,user=>{
  const password=isPasswordUser(user);
  const method=$("settingsAccountMethod"),note=$("settingsAccountNote"),reset=$("settingsPasswordBtn"),session=$("settingsSessionNote");
  if(method)method.textContent=password?"E-posta ve şifre":"Google";
  if(note)note.textContent=password?"E-posta ile doğrulanmış koç hesabı":"Google ile doğrulanmış koç hesabı";
  if(session)session.textContent=password?"Koç verilerin silinmez. Yeniden giriş için e-posta ve şifreni kullanırsın.":"Koç verilerin silinmez. Yeniden giriş yapmak için Google hesabını kullanırsın.";
  if(reset)reset.hidden=!password;
});
$("settingsPasswordBtn")?.addEventListener("click",async event=>{
  const user=auth.currentUser,button=event.currentTarget;if(!user?.email)return;
  button.disabled=true;
  try{await sendPasswordResetEmail(auth,user.email);button.textContent="Bağlantı gönderildi ✓"}
  catch(error){button.textContent=friendly(error)}
  finally{setTimeout(()=>{button.disabled=false;button.textContent="Şifreyi değiştir"},4000)}
});
document.documentElement.dataset.coachAuthV34="ready";
