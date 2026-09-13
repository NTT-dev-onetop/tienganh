import{collection,onSnapshot}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const text=s=>esc(s).replace(/\r?\n/g,'<br>');
const isPublished=x=>x.published===true||x.published===1||['true','1','yes','published','public'].includes(String(x.published??'').trim().toLowerCase())||['published','public','visible'].includes(String(x.status??x.visibility??'').trim().toLowerCase());
let stop=null;
export function stopKnowledge(){if(stop){stop();stop=null}}
export function initKnowledge(){
  const root=document.getElementById('knowledgeList');if(!root)return;
  if(stop)stop();
  root.innerHTML='<div class="empty"><div>📚</div><h3>Đang tải kiến thức...</h3><p>Đang đồng bộ nội dung từ giáo viên.</p></div>';
  stop=onSnapshot(collection(db,'knowledge'),snap=>{
    const rows=[];
    snap.forEach(d=>{const x={id:d.id,...d.data()};if(isPublished(x))rows.push(x)});
    rows.sort((a,b)=>{const ta=Number(a.updatedAt?.seconds||a.createdAt?.seconds||0),tb=Number(b.updatedAt?.seconds||b.createdAt?.seconds||0);return tb-ta||String(a.title||'').localeCompare(String(b.title||''),'vi')});
    root.innerHTML=rows.length?rows.map(k=>`<article class="knowledge-card"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><span class="tag">${esc(k.category||'Kiến thức')}</span>${k.unit?` <span class="tag">${esc(k.unit)}</span>`:''}</div><small class="muted">${esc(k.authorName||'Giáo viên')}</small></div><h3>${esc(k.title||'Không có tiêu đề')}</h3>${k.content?`<div class="knowledge-block"><b>Lý thuyết</b><div>${text(k.content)}</div></div>`:''}${k.examples?`<div class="knowledge-block"><b>Ví dụ</b><div>${text(k.examples)}</div></div>`:''}${k.notes?`<div class="knowledge-note"><b>💡 Ghi chú</b><div>${text(k.notes)}</div></div>`:''}${k.exercises?`<div class="knowledge-exercises"><b>📝 Bài tập</b><div>${text(k.exercises)}</div></div>`:''}</article>`).join(''):'<div class="empty"><div>📚</div><h3>Chưa có kiến thức đã xuất bản</h3><p>Khi giáo viên bật “Đã xuất bản”, bài sẽ xuất hiện ở đây.</p></div>';
  },e=>{console.error('Lỗi tải kiến thức:',e);root.innerHTML='<div class="alert alert-danger">Không tải được kho kiến thức. Hãy kiểm tra đăng nhập và Firestore Rules.</div>'});
}
