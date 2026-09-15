import{doc,getDoc,setDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";

// Chủ sở hữu hệ thống: chỉ email này được bootstrap thành ADMIN cao nhất.
export const OWNER_EMAIL="icloud07072010@gmail.com";
let currentRole=null;
const cleanEmail=e=>String(e??'').trim().toLowerCase();

// ===== CACHE =====
// Tránh đọc lại config/admins và config/teachers nhiều lần trong 1 phiên login.
const CACHE_TTL=60_000;
const adminCache={value:null,at:0};
const teacherCache={value:null,at:0};

async function readAdminEmails(force=false){
  const now=Date.now();
  if(!force&&adminCache.value&&now-adminCache.at<CACHE_TTL)return adminCache.value;
  try{
    const snap=await getDoc(doc(db,'config','admins'));
    const emails=snap.exists()&&Array.isArray(snap.data()?.emails)?snap.data().emails:[];
    adminCache.value=emails;adminCache.at=now;
    return emails;
  }catch{return adminCache.value||[]}
}
async function readTeacherEmails(force=false){
  const now=Date.now();
  if(!force&&teacherCache.value&&now-teacherCache.at<CACHE_TTL)return teacherCache.value;
  try{
    const snap=await getDoc(doc(db,'config','teachers'));
    const emails=snap.exists()&&Array.isArray(snap.data()?.emails)?snap.data().emails:[];
    teacherCache.value=emails;teacherCache.at=now;
    return emails;
  }catch{return teacherCache.value||[]}
}
export function invalidateRoleCaches(){adminCache.value=null;adminCache.at=0;teacherCache.value=null;teacherCache.at=0}

export async function checkIsAdmin(email){
  const normalized=cleanEmail(email);
  if(!normalized)return false;
  if(normalized===cleanEmail(OWNER_EMAIL))return true;
  const emails=await readAdminEmails();
  return emails.some(x=>cleanEmail(x)===normalized);
}

export async function checkIsTeacher(email){
  const normalized=cleanEmail(email);
  if(!normalized)return false;
  if(normalized===cleanEmail(OWNER_EMAIL))return false;
  const emails=await readTeacherEmails();
  return emails.some(x=>cleanEmail(x)===normalized);
}

export async function ensureUserDoc(user){
  if(!user?.uid)return null;
  const ref=doc(db,'users',user.uid);
  const normalized=cleanEmail(user.email);
  try{
    const owner=normalized===cleanEmail(OWNER_EMAIL);
    // Song song: đọc user doc + admins + teachers cùng lúc.
    const [snap,adminFromConfig,teacherFromConfig]=await Promise.all([
      getDoc(ref),
      owner?Promise.resolve(true):checkIsAdmin(normalized),
      owner?Promise.resolve(false):checkIsTeacher(normalized)
    ]);
    const existing=snap.exists()?snap.data()||{}:{};
    const teacher=adminFromConfig?false:teacherFromConfig;
    const desiredRole=owner||adminFromConfig?'admin':teacher?'teacher':'student';

    if(snap.exists()){
      const role=desiredRole;
      const patch={};
      if(existing.role!==role)patch.role=role;
      if(!existing.email)patch.email=normalized;
      if(owner){
        if(!String(existing.rosterId||'').trim())patch.rosterId='s45';
        if(!String(existing.name||'').trim())patch.name='Nguyễn Trung Trực';
        if(!String(existing.className||'').trim())patch.className='11T1';
      }
      // Chỉ ghi Firestore khi thực sự có gì cần đổi; nếu không, bỏ qua hoàn toàn.
      if(Object.keys(patch).length){
        patch.lastLoginAt=serverTimestamp();
        await setDoc(ref,patch,{merge:true});
        Object.assign(existing,patch);
      }
      currentRole=role;
      return {...existing,role};
    }

    const profile={
      email:normalized,
      name:owner?'Nguyễn Trung Trực':String(user.displayName||'').trim(),
      className:'11T1',
      role:desiredRole,
      createdAt:serverTimestamp(),
      lastLoginAt:serverTimestamp(),
      streak:0,lastCompletedDate:'',totalSetsCompleted:0,totalBonusPoints:0
    };
    if(owner)profile.rosterId='s45';
    await setDoc(ref,profile);
    if(owner){
      await setDoc(doc(db,'users_by_roster','s45'),{uid:user.uid,email:normalized,name:'Nguyễn Trung Trực',rosterId:'s45'},{merge:true});
    }
    currentRole=desiredRole;
    return {...profile,role:desiredRole};
  }catch(error){
    currentRole=null;
    console.error('Không thể tạo/đọc hồ sơ người dùng:',error);
    throw error;
  }
}

export function setCurrentRole(role){currentRole=role}
export function getCurrentRole(){return currentRole}
export function clearCurrentRole(){currentRole=null}
export function isStaffRole(role){return role==='admin'||role==='teacher'}