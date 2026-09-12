import{doc,getDoc,setDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";

// Chủ sở hữu hệ thống: chỉ email này được bootstrap thành ADMIN cao nhất.
export const OWNER_EMAIL="icloud07072010@gmail.com";
export const ADMIN_EMAILS=[OWNER_EMAIL];
export const BUILDER_EMAIL=OWNER_EMAIL;
let currentRole=null;
const cleanEmail=e=>String(e??'').trim().toLowerCase();

export async function checkIsAdmin(email){
 const normalized=cleanEmail(email);
 if(!normalized)return false;
 if(normalized===cleanEmail(OWNER_EMAIL))return false;
 try{
  const snap=await getDoc(doc(db,'config','admins'));
  const emails=snap.exists()&&Array.isArray(snap.data()?.emails)?snap.data().emails:[];
  return emails.some(x=>cleanEmail(x)===normalized);
 }catch(error){console.error('Không đọc được config/admins:',error);return false}
}

export async function checkIsTeacher(email){
 const normalized=cleanEmail(email);
 if(!normalized)return false;
 if(await checkIsAdmin(normalized))return false;
 try{
  const snap=await getDoc(doc(db,'config','teachers'));
  const emails=snap.exists()&&Array.isArray(snap.data()?.emails)?snap.data().emails:[];
  return emails.some(x=>cleanEmail(x)===normalized);
 }catch(error){console.error('Không đọc được config/teachers:',error);return false}
}

export async function ensureUserDoc(user){
 if(!user?.uid)return null;
 const ref=doc(db,'users',user.uid);
 const normalized=cleanEmail(user.email);
 try{
  const snap=await getDoc(ref);
  const owner=normalized===cleanEmail(OWNER_EMAIL);
  const admin=await checkIsAdmin(normalized);
  const teacher=admin?false:await checkIsTeacher(normalized);
  const desiredRole=owner?'builder':admin?'admin':teacher?'teacher':'student';
  if(snap.exists()){
   const existing=snap.data()||{};
   // Sửa legacy role như builder và luôn ép chủ sở hữu về admin.
   const existingRole=['admin','teacher','builder','student'].includes(existing.role)?existing.role:'student';
   const role=owner? 'builder' : (admin?'admin':(teacher?'teacher':existingRole==='teacher'?'teacher':existingRole==='builder'?'builder':'student'));
   const patch={lastLoginAt:serverTimestamp()};
   if(existing.role!==role)patch.role=role;
   if(!existing.email)patch.email=normalized;
   await setDoc(ref,patch,{merge:true});
   currentRole=role;
   return {...existing,...patch,role};
  }
  const profile={email:normalized,name:String(user.displayName||'').trim(),className:'11T1',role:desiredRole,createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),streak:0,lastCompletedDate:'',totalSetsCompleted:0,totalBonusPoints:0};
  await setDoc(ref,profile);currentRole=desiredRole;return {...profile,role:desiredRole};
 }catch(error){currentRole=null;console.error('Không thể tạo/đọc hồ sơ người dùng:',error);throw error}
}
export function getCurrentRole(){return currentRole}
export function clearCurrentRole(){currentRole=null}
export function isBuilderRole(role){return role==='builder'}
export function isStaffRole(role){return role==='admin'||role==='teacher'||role==='builder'}
