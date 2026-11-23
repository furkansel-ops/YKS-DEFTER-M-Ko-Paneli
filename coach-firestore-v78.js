// v78: app-reset.js Firestore'u buradan alır. Yazmalar coach-write-guard-v78.js bekçisinden geçer; geri kalan her şey aynen.
// Testler import satırlarını silip window'daki sahte Firestore'u kullanır; bekçinin kendi testi coach-write-guard-v78.test.js.
import*as fs from"https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
export*from"https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
// v80: kalıcı önbellek — bekleyen gönderim IndexedDB'de durur; sekme kapansa da panel sonraki açılışta gönderir.
// IndexedDB yoksa SDK kendisi bellek önbelleğine döner; zaten başlatılmışsa (ikinci çağrı) aynı örnek döner.
export function getFirestore(app){
  try{return fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()})})}
  catch{return fs.getFirestore(app)}
}
const guard=promise=>globalThis.coachWriteGuard?globalThis.coachWriteGuard(promise):promise;
export const addDoc=(...args)=>guard(fs.addDoc(...args));
export const setDoc=(...args)=>guard(fs.setDoc(...args));
export const updateDoc=(...args)=>guard(fs.updateDoc(...args));
export function writeBatch(db){const batch=fs.writeBatch(db),commit=batch.commit.bind(batch);batch.commit=()=>guard(commit());return batch}
