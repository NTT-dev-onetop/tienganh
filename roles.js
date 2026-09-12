import{doc,getDoc,setDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";

// Chủ sở hữu hệ thống: chỉ email này được bootstrap thành ADMIN cao nhất.
export const OWNER_EMAIL="icloud07072010@gmail.com";
export const ADMIN_EMAILS=[OWNER_EMAIL];
let currentRole=null;
const cleanEmail=e=>String(e??'').trim().toLowerCase();

export async function checkIsAdmin(email){
 const normalized=cleanEmail(email);
 if(!normalized)return false;
 if(normalized===cleanEmail(OWNER_EMAIL))return true;
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
  const specialTeacher=String(profile?.rosterId||'')==='__teacher_dat__' && String(profile?.name||'')==='Thầy Đạt';
  const adminFromConfig=await checkIsAdmin(normalized);
  const teacher=adminFromConfig||specialTeacher?false:await checkIsTeacher(normalized);
  // Thầy Đạt hiển thị là Giáo viên nhưng quyền backend vẫn là ADMIN.
  const desiredRole=owner||adminFromConfig||specialTeacher?'admin':teacher?'teacher':'student';
  if(snap.exists()){
   const existing=snap.data()||{};
   const existingRole=['admin','teacher','student'].includes(existing.role)?existing.role:'student';
   // OWNER_EMAIL is simultaneously the student's account (STT 45) and an admin.
   // The teacher account remains separate and is never promoted to admin here.
   const role=owner||adminFromConfig||specialTeacher?'admin':teacher?'teacher':existingRole;
   const patch={lastLoginAt:serverTimestamp()};
   if(existing.role!==role)patch.role=role;
   if(!existing.email)patch.email=normalized;
   if(owner){
    patch.rosterId='s45';
    patch.name='Nguyễn Trung Trực';
    patch.className='11T1';
   }
   if(specialTeacher){
    patch.rosterId='__teacher_dat__';
    patch.name='Thầy Đạt';
    patch.className='Giáo viên';
    patch.teacherLabel='Thầy Đạt';
    patch.displayRole='teacher';
   }
   await setDoc(ref,patch,{merge:true});
   currentRole=role;
   return {...existing,...patch,role};
  }
  const profile={email:normalized,name:owner?'Nguyễn Trung Trực':String(user.displayName||'').trim(),className:owner?'11T1':'11T1',role:desiredRole,createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),streak:0,lastCompletedDate:'',totalSetsCompleted:0,totalBonusPoints:0};
  if(owner)profile.rosterId='s45';
  if(specialTeacher){profile.rosterId='__teacher_dat__';profile.name='Thầy Đạt';profile.className='Giáo viên';profile.teacherLabel='Thầy Đạt';profile.displayRole='teacher';}
  await setDoc(ref,profile);
  // Bind the owner's account to STT 45 so Admin + Student is a single account.
  if(owner){
   await setDoc(doc(db,'users_by_roster','s45'),{uid:user.uid,email:normalized,name:'Nguyễn Trung Trực',rosterId:'s45'},{merge:true});
  }
  currentRole=desiredRole;return {...profile,role:desiredRole};
 }catch(error){currentRole=null;console.error('Không thể tạo/đọc hồ sơ người dùng:',error);throw error}
}
export function setCurrentRole(role){currentRole=role}
export function getCurrentRole(){return currentRole}
export function clearCurrentRole(){currentRole=null}
export function isStaffRole(role){return role==='admin'||role==='teacher'}
