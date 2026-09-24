import{initializeApp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{getFirestore,doc,getDoc}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import{FIREBASE_CONFIG,COLLECTIONS}from"./firebase-config.js";

const firebaseApp=initializeApp(FIREBASE_CONFIG);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
const $=id=>document.getElementById(id);
const text=(value,max=120)=>String(value??"").trim().slice(0,max);
const initials=name=>text(name,80).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"K";

function setStatus(message,type=""){
  const node=$("authStatus");if(!node)return;
  node.textContent=message;
  node.className=`status ${type}`.trim();
}
function showAuth(message="Koç hesabınla giriş yap.",type=""){
  $("authView")?.classList.remove("hidden");
  $("appView")?.classList.add("hidden");
  setStatus(message,type);
}
function showApp(profile,user){
  $("authView")?.classList.add("hidden");
  $("appView")?.classList.remove("hidden");
  const name=text(profile?.displayName||user?.displayName||"Koç",80)||"Koç";
  const nameNode=$("coachSidebarName"),avatar=$("coachSidebarAvatar");
  if(nameNode)nameNode.textContent=name;
  if(avatar)avatar.textContent=initials(name).slice(0,1);
  const dashName=$("dashboardCoachName");if(dashName)dashName.textContent=name.split(/\\s+/)[0]||"Koç";
  const dashDate=$("dashboardDate");if(dashDate)dashDate.textContent=new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
}
async function loadCoachProfile(user){
  const snap=await getDoc(doc(db,COLLECTIONS.profiles,user.uid));
  if(!snap.exists())return null;
  const profile=snap.data();
  return profile?.role==="coach"?profile:null;
}
function openSidebar(){$("sidebar")?.classList.add("open");$("overlay")?.classList.add("show")}
function closeSidebar(){$("sidebar")?.classList.remove("open");$("overlay")?.classList.remove("show")}

$("signInBtn")?.addEventListener("click",async event=>{
  event.currentTarget.disabled=true;
  try{
    await setPersistence(auth,browserLocalPersistence);
    await signInWithPopup(auth,provider);
  }catch(error){
    const code=String(error?.code||"");
    const message=code.includes("popup-closed")?"Google giriş penceresi kapatıldı.":code.includes("popup-blocked")?"Tarayıcı giriş penceresini engelledi.":text(error?.message||"Giriş yapılamadı",180);
    showAuth(message,"err");
  }finally{event.currentTarget.disabled=false}
});
$("signOutBtn")?.addEventListener("click",()=>signOut(auth));
$("menuBtn")?.addEventListener("click",openSidebar);
$("overlay")?.addEventListener("click",closeSidebar);

function showCoachPage(page){
  const availablePages={home:"homePage",students:"studentsPage",programs:"programsPage"};
  const targetId=availablePages[page];
  if(!targetId)return;
  document.querySelectorAll("[data-coach-page]").forEach(item=>item.classList.toggle("on",item.dataset.coachPage===page));
  Object.values(availablePages).forEach(id=>$(id)?.classList.toggle("hidden",id!==targetId));
  closeSidebar();
}
document.querySelectorAll("[data-coach-page]").forEach(button=>{
  button.addEventListener("click",()=>showCoachPage(button.dataset.coachPage));
});

onAuthStateChanged(auth,async user=>{
  if(!user){showAuth();return}
  try{
    const profile=await loadCoachProfile(user);
    if(!profile){
      await signOut(auth);
      showAuth("Bu Google hesabında koç profili yok.","err");
      return;
    }
    showApp(profile,user);
  }catch(error){
    console.error(error);
    showAuth(text(error?.message||"Koç profili yüklenemedi",180),"err");
  }
});


document.querySelectorAll("[data-go-page]").forEach(button=>button.addEventListener("click",()=>{
  const page=button.dataset.goPage;
  document.querySelector('[data-coach-page="'+page+'"]')?.click();
}));


document.querySelectorAll("[data-student-filter]").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll("[data-student-filter]").forEach(x=>x.classList.toggle("active",x===button));
}));
$("addStudentBtn")?.addEventListener("click",()=>alert("Öğrenci bağlantı akışını sonraki adımda gerçek sisteme bağlayacağız."));
