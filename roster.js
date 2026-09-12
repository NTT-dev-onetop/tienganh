import{doc,getDoc,setDoc}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";

const escLocal=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const TEACHER_OPTION={id:'teacher-dat',name:'👨‍🏫 Thầy Đạt'};
const DEFAULT_ROSTER=[
'Trần Diễm Linh Giang','Võ Hồ Minh Hằng','Nguyễn Anh Khôi','Huỳnh Nguyễn Ly Lam','Nguyễn Thị Ngọc Mỹ',
'Lê Bảo Ngọc','Phạm Minh Triết','Phan Trần Huỳnh Hương','Võ Mai Khánh','Nguyễn Trần Thùy Ngân',
'Nguyễn Thanh Sang','Phạm Nhật Trường','Nguyễn Dương Gia Nghi','Nguyễn Phúc Thịnh','Lê Nguyễn Trung Trực',
'Nguyễn Ngọc Bích Anh','Nguyễn Thùy Anh','Lê Ngọc Quốc Bảo','Huỳnh Lê Minh Đạt','Lê Minh Đạt',
'Lê Ngọc Bảo Hân','Trương Thị Kim Hân','Trần Huy Hoàng','Nguyễn Tuấn Huy','Nguyễn Đăng Khoa',
'Lê Nguyễn Hoàng Nam','Nguyễn Khánh Ngọc','Nguyễn Lê Hồng Ngọc','Nguyễn Vũ Bảo Ngọc','Bùi Ngọc An Nhi',
'Dương Ngọc Tâm Như','Nguyễn Tấn Phát','Trần Minh Phi','Nguyễn Ngọc Bích Phương','Phạm Hà Mai Quỳnh',
'Nguyễn Bùi Phúc Trí','Lê Nhã Thanh','Nguyễn Khánh Thi','Phạm Hoàng Thiên','Trần Thiện Tín',
'Phạm Ngọc Bảo Trân','Vĩnh Huỳnh Diễm Trinh','Lê Quốc Trọng','Võ Hoàng Trọng','Nguyễn Trung Trực'
].map((name,i)=>({id:`s${String(i+1).padStart(2,'0')}`,name}));
let modalEl=null;
function getModal(){
  if(modalEl)return modalEl;
  modalEl=document.createElement('div');
  modalEl.className='modal fade';modalEl.id='rosterModal';modalEl.tabIndex=-1;modalEl.setAttribute('aria-hidden','true');
  modalEl.innerHTML='<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Chọn tên trong danh sách lớp</h5></div><div class="modal-body"><p class="muted">Lần đầu đăng nhập, chọn đúng tên của bạn. Không tự nhập tên khác.</p><select id="rosterSelect" class="form-select form-select-lg"></select><div id="rosterErr" class="alert alert-danger d-none mt-3"></div></div><div class="modal-footer"><button id="rosterSave" class="btn btn-primary">Xác nhận tên</button></div></div></div>';
  document.body.appendChild(modalEl);return modalEl;
}
async function readRoster(){
  const snap=await getDoc(doc(db,'config','roster'));
  if(!snap.exists())return DEFAULT_ROSTER;
  const students=snap.data()?.students;
  return Array.isArray(students)&&students.length?students.filter(x=>x&&String(x.id??'').trim()&&String(x.name??'').trim()):DEFAULT_ROSTER;
}
export async function initRosterGate(user,role){
  if(!user||!user.uid||role==='admin'||role==='builder'||role==='teacher')return true;
  try{
    const userSnap=await getDoc(doc(db,'users',user.uid));
    if(!userSnap.exists())throw new Error('Không tìm thấy hồ sơ người dùng.');
    const profile=userSnap.data()||{};
    if(profile.rosterId){
      const mapping=await getDoc(doc(db,'users_by_roster',String(profile.rosterId)));
      if(mapping.exists()&&mapping.data()?.uid===user.uid)return true;
      throw new Error('Tên lớp đang được liên kết với tài khoản khác. Liên hệ thầy để reset.');
    }
    let students=await readRoster();
    // Thầy Đạt là lựa chọn đặc biệt, chỉ hiện khi chưa được đăng ký.
    try { const claimed=await getDoc(doc(db,'users_by_roster',TEACHER_OPTION.id)); if(!claimed.exists()) students=[TEACHER_OPTION,...students]; } catch(e) { console.warn('Không kiểm tra trạng thái Thầy Đạt:',e); }
    if(!students.length)throw new Error('Thầy chưa cấu hình danh sách lớp. Vui lòng báo thầy tạo config/roster.');
    const modal=getModal(),select=modal.querySelector('#rosterSelect'),err=modal.querySelector('#rosterErr'),save=modal.querySelector('#rosterSave');
    select.innerHTML='<option value="">-- Chọn tên của bạn --</option>'+students.map(x=>`<option value="${escLocal(x.id)}">${escLocal(x.name)}</option>`).join('');
    err.classList.add('d-none');save.disabled=false;
    const bs=window.bootstrap?.Modal?.getOrCreateInstance(modal,{backdrop:'static',keyboard:false});
    if(!bs)throw new Error('Bootstrap Modal chưa sẵn sàng.');
    bs.show();
    await new Promise(resolve=>{save.onclick=async()=>{
      const rosterId=String(select.value||'').trim();if(!rosterId){err.textContent='Hãy chọn tên.';err.classList.remove('d-none');return}
      save.disabled=true;
      try{
        const target=students.find(x=>String(x.id)===rosterId);if(!target)throw new Error('Tên không còn trong roster.');
        const mappingRef=doc(db,'users_by_roster',rosterId);const mapping=await getDoc(mappingRef);
        if(mapping.exists()&&mapping.data()?.uid!==user.uid)throw new Error('Tên này đã được đăng ký. Liên hệ thầy.');
        await setDoc(mappingRef,{uid:user.uid,email:String(user.email||'').toLowerCase(),name:String(target.name),rosterId, specialTeacher:rosterId==='teacher-dat'});
        const specialTeacher=rosterId==='teacher-dat';
        await setDoc(doc(db,'users',user.uid),{rosterId,name:String(target.name),className:'11T1',...(specialTeacher?{role:'teacher',isTeacher:true}:{})},{merge:true});
        bs.hide();resolve();
      }catch(e){console.error('Lỗi gắn roster:',e);err.textContent=e.message||'Không thể lưu tên.';err.classList.remove('d-none');save.disabled=false}
    }});
    return true;
  }catch(error){console.error('Lỗi roster:',error);toastGlobal(error.message||'Không thể kiểm tra roster.','error');return false}
}
function toastGlobal(msg,type){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast-note';document.body.appendChild(el)}el.className=`toast-note ${type}`;el.textContent=String(msg??'');clearTimeout(window.__toast);requestAnimationFrame(()=>el.classList.add('show'));window.__toast=setTimeout(()=>el.classList.remove('show'),3500)}
