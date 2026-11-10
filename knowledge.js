import{collection,onSnapshot,query}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";
import{tr}from"./i18n.js";

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const text=s=>esc(s).replace(/\r?\n/g,'<br>');
let stop=null,loadToken=0,latestRoot=null,latestRows=[],latestError=false,langBound=false;
const isPublished=v=>v===undefined||v===null||v===true||v===1||String(v).trim().toLowerCase()==='true'||String(v).trim().toLowerCase()==='published';

function render(root,rows){
  if(!root)return;
  if(latestError){
    root.innerHTML=`<div class="alert alert-danger">${tr('Không tải được kho kiến thức.','Could not load study notes.')}</div>`;
    return;
  }
  const sorted=[...rows].sort((a,b)=>{const ta=a.updatedAt?.seconds||a.createdAt?.seconds||0,tb=b.updatedAt?.seconds||b.createdAt?.seconds||0;return tb-ta});
  root.classList.add('knowledge-ready');
  root.innerHTML=sorted.length?sorted.map(k=>`<article class="knowledge-card"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><span class="tag">${esc(k.category||tr('Kiến thức','Study Note'))}</span>${k.unit?` <span class="tag">${esc(k.unit)}</span>`:''}</div><small class="muted">${esc(k.authorName||k.author||tr('Giáo viên','Teacher'))}</small></div><h3>${esc(k.title||tr('Không có tiêu đề','Untitled'))}</h3>${k.content?`<div class="knowledge-block"><b>${tr('Lý thuyết','Content')}</b><div>${text(k.content)}</div></div>`:''}${k.examples?`<div class="knowledge-block"><b>${tr('Ví dụ','Examples')}</b><div>${text(k.examples)}</div></div>`:''}${k.notes?`<div class="knowledge-note"><b>💡 ${tr('Ghi chú','Notes')}</b><div>${text(k.notes)}</div></div>`:''}${k.exercises?`<div class="knowledge-exercises"><b>📝 ${tr('Bài tập','Exercises')}</b><div>${text(k.exercises)}</div></div>`:''}</article>`).join(''):`<div class="empty"><div>📚</div><h3>${tr('Chưa có kiến thức mới','No study notes yet')}</h3><p>${tr('Giáo viên sẽ đăng bài tại Dashboard. Khi đăng xong, nội dung xuất hiện ở đây.','Teachers can publish notes from the Dashboard and they will appear here right away.')}</p></div>`;
}
export function stopKnowledge(){if(stop){stop();stop=null}}
export function initKnowledge(){
  const root=document.getElementById('knowledgeList');if(!root)return;
  latestRoot=root;
  latestError=false;
  if(!langBound){
    langBound=true;
    window.addEventListener('app:lang-change',()=>{if(latestRoot)render(latestRoot,latestRows)});
  }
  const token=++loadToken;
  stopKnowledge();
  // Do not depend on a Firestore where(published == true) query here.
  // Older documents may store published as a string/number, and this also
  // avoids the page appearing empty when legacy data uses a different type.
  const q=query(collection(db,'knowledge'));
  stop=onSnapshot(q,snap=>{
    if(token!==loadToken)return;
    const rows=[];snap.forEach(d=>{const data=d.data()||{};if(isPublished(data.published))rows.push({id:d.id,...data})});
    latestError=false;
    latestRows=rows;
    render(root,rows);
  },e=>{
    console.error('Lỗi tải kiến thức:',e);
    latestError=true;
    render(root,[]);
  });
}
