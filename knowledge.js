import{collection,getDocs,onSnapshot,query,where}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const text=s=>esc(s).replace(/\r?\n/g,'<br>');
let stop=null,loadToken=0;
const isPublished=v=>v===true||v===1||String(v??'').trim().toLowerCase()==='true'||String(v??'').trim().toLowerCase()==='published';
function render(root,rows){
  rows.sort((a,b)=>{const ta=a.updatedAt?.seconds||a.createdAt?.seconds||0,tb=b.updatedAt?.seconds||b.createdAt?.seconds||0;return tb-ta});
  root.innerHTML=rows.length?rows.map(k=>`<article class="knowledge-card"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><span class="tag">${esc(k.category||'Kiến thức')}</span>${k.unit?` <span class="tag">${esc(k.unit)}</span>`:''}</div><small class="muted">${esc(k.authorName||k.author||'Giáo viên')}</small></div><h3>${esc(k.title||'Không có tiêu đề')}</h3>${k.content?`<div class="knowledge-block"><b>Lý thuyết</b><div>${text(k.content)}</div></div>`:''}${k.examples?`<div class="knowledge-block"><b>Ví dụ</b><div>${text(k.examples)}</div></div>`:''}${k.notes?`<div class="knowledge-note"><b>💡 Ghi chú</b><div>${text(k.notes)}</div></div>`:''}${k.exercises?`<div class="knowledge-exercises"><b>📝 Bài tập</b><div>${text(k.exercises)}</div></div>`:''}</article>`).join(''):'<div class="empty"><div>📚</div><h3>Chưa có kiến thức mới</h3><p>Giáo viên sẽ đăng bài tại Dashboard. Khi đăng xong, nội dung xuất hiện ở đây.</p></div>';
}
export function stopKnowledge(){if(stop){stop();stop=null}}
export function initKnowledge(){
  const root=document.getElementById('knowledgeList');if(!root)return;
  const token=++loadToken;
  stopKnowledge();
  // Do not depend on a Firestore where(published == true) query here.
  // Older documents may store published as a string/number, and this also
  // avoids the page appearing empty when legacy data uses a different type.
  const q=query(collection(db,'knowledge'));
  stop=onSnapshot(q,snap=>{
    if(token!==loadToken)return;
    const rows=[];snap.forEach(d=>{const data=d.data()||{};if(data.published===undefined||isPublished(data.published))rows.push({id:d.id,...data})});
    render(root,rows);
  },e=>{
    console.error('Lỗi tải kiến thức:',e);
    root.innerHTML='<div class="alert alert-danger">Không tải được kho kiến thức.</div>';
  });
}
