import{doc,getDoc,setDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";

// Fallback khẩn cấp. Nên giữ trống nếu config/admins đã được cấu hình.
export const ADMIN_EMAILS=['icloud07072010@gmail.com'];
let currentRole=null;
const cleanEmail=e=>String(e??'').trim().toLowerCase();

export async function checkIsAdmin(email){
  const normalized=cleanEmail(email);
  if(!normalized)return false;
  try{
    const snap=await getDoc(doc(db,'config','admins'));
    if(snap.exists()){
      const emails=snap.data()?.emails;
      if(Array.isArray(emails)&&emails.some(x=>cleanEmail(x)===normalized))return true;
    }
  }catch(error){console.error('Không đọc được config/admins:',error)}
  return ADMIN_EMAILS.some(x=>cleanEmail(x)===normalized);
}

export async function ensureUserDoc(user){
  if(!user||!user.uid)return null;
  const ref=doc(db,'users',user.uid);
  try{
    const snap=await getDoc(ref);
    if(snap.exists()){
      const existing=snap.data()||{};
      const role=existing.role==='admin'||existing.role==='student'?existing.role:(await checkIsAdmin(user.email)?'admin':'student');
      currentRole=role;
      if(existing.role!==role){
        await setDoc(ref,{role,lastLoginAt:serverTimestamp()},{merge:true});
      }else{
        await setDoc(ref,{lastLoginAt:serverTimestamp()},{merge:true});
      }
      return {...existing,role};
    }
    const role=await checkIsAdmin(user.email)?'admin':'student';
    const profile={email:cleanEmail(user.email),name:String(user.displayName||'').trim(),className:'11T1',role,createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),streak:0,lastCompletedDate:'',totalSetsCompleted:0,totalBonusPoints:0};
    await setDoc(ref,profile);
    currentRole=role;
    return {...profile,role};
  }catch(error){
    currentRole=null;
    console.error('Không thể tạo/đọc hồ sơ người dùng:',error);
    throw error;
  }
}
export function getCurrentRole(){return currentRole}
export function clearCurrentRole(){currentRole=null}
