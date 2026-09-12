import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig,"englishNotebookModules");
export const auth=getAuth(app);
export const db=getFirestore(app);
