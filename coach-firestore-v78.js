// v78: app-reset.js Firestore'u buradan alır. Yazmalar coach-write-guard-v78.js bekçisinden geçer; geri kalan her şey aynen.
// Testler import satırlarını silip window'daki sahte Firestore'u kullanır; bekçinin kendi testi coach-write-guard-v78.test.js.
import*as fs from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
export*from"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
const guard=promise=>globalThis.coachWriteGuard?globalThis.coachWriteGuard(promise):promise;
export const addDoc=(...args)=>guard(fs.addDoc(...args));
export const setDoc=(...args)=>guard(fs.setDoc(...args));
export const updateDoc=(...args)=>guard(fs.updateDoc(...args));
export function writeBatch(db){const batch=fs.writeBatch(db),commit=batch.commit.bind(batch);batch.commit=()=>guard(commit());return batch}
