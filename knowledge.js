import{collection,query,where,onSnapshot}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const text=s=>esc(s).replace(/\r?\n/g,'<br>');
let stop=null;
export function stopKnowledge(){if(stop){stop();stop=null}}
export function initKnowledge(){
  const root=document.getElementById('knowledgeList');if(!root)return;
  if(stop)stop();
  const q=query(collection(db,'knowledge'),where('published','==',true));
  stop=onSnapshot(q,snap=>{
    const rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));
    rows.sort((a,b)=>String(b.updatedAt?.seconds||b.createdAt?.seconds||0).localeCompare(String(a.updatedAt?.seconds||a.createdAt?.seconds||0)));
    root.innerHTML=rows.length?rows.map(k=>`<article class="knowledge-card"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><span class="tag">${esc(k.category||'Kiến thức')}</span>${k.unit?` <span class="tag">${esc(k.unit)}</span>`:''}</div><small class="muted">${esc(k.authorName||'Giáo viên')}</small></div><h3>${esc(k.title||'Không có tiêu đề')}</h3>${k.content?`<div class="knowledge-block"><b>Lý thuyết</b><div>${text(k.content)}</div></div>`:''}${k.examples?`<div class="knowledge-block"><b>Ví dụ</b><div>${text(k.examples)}</div></div>`:''}${k.notes?`<div class="knowledge-note"><b>💡 Ghi chú</b><div>${text(k.notes)}</div></div>`:''}${k.exercises?`<div class="knowledge-exercises"><b>📝 Bài tập</b><div>${text(k.exercises)}</div></div>`:''}</article>`).join(''):'<div class="empty"><div>📚</div><h3>Chưa có kiến thức mới</h3><p>Giáo viên sẽ đăng bài tại Dashboard. Khi đăng xong, nội dung xuất hiện ở đây.</p></div>';
  },e=>{console.error('Lỗi tải kiến thức:',e);root.innerHTML='<div class="alert alert-danger">Không tải được kho kiến thức.</div>'});
}
