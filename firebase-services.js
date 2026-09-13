import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";

// Dùng DUY NHẤT một Firebase App cho toàn bộ English Notebook.
// Nếu tạo thêm app riêng, Auth state có thể không được truyền sang Firestore
// và sẽ gây "Missing or insufficient permissions".
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
