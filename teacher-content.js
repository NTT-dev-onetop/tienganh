import{collection,query,where,onSnapshot}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let stops=[];
const clear=()=>{stops.forEach(f=>f&&f());stops=[]};
export function initTeacherContent(){clear();initQuestions();initListening()}
export function stopTeacherContent(){clear()}
function initQuestions(){
  const root=document.getElementById('teacherQuestionList');if(!root)return;
  const q=query(collection(db,'questionBank'),where('published','==',true));
  const stop=onSnapshot(q,snap=>{
    const rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));
    const groups=new Map();
    rows.forEach(x=>{
      const key=String(x.setId||'legacy_'+(x.sourceFile||x.unit||x.id));
      if(!groups.has(key))groups.set(key,{id:key,title:String(x.setTitle||x.sourceFile||x.unit||'Bài tập'),unit:String(x.unit||''),items:[]});
      groups.get(key).items.push(x);
    });
    const sets=[...groups.values()].sort((a,b)=>a.unit.localeCompare(b.unit)||a.title.localeCompare(b.title,'vi'));
    root.innerHTML=sets.length?sets.map((set,si)=>`<article class="teacher-set-card" data-set="${esc(set.id)}"><div class="teacher-set-summary"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(set.unit)}</span><span class="tag">📝 ${set.items.length} câu</span></div><h4>${esc(set.title)}</h4><p class="muted mb-0">Một bộ bài tập · bấm để bắt đầu làm bài</p></div><button class="btn btn-primary" data-start-set="${esc(set.id)}">▶ Làm bài</button></div><div class="teacher-set-quiz d-none" id="teacher-set-${esc(set.id)}"><div class="teacher-quiz-list">${set.items.sort((a,b)=>Number(a.setQuestionNo||0)-Number(b.setQuestionNo||0)).map((x,i)=>{const opts=Array.isArray(x.options)?x.options:[];return `<article class="teacher-quiz-q"><div class="small muted mb-1">Câu ${i+1}/${set.items.length}</div><h5>${esc(x.prompt||'')}</h5>${opts.map((o,j)=>`<label class="teacher-quiz-option"><input type="radio" name="ans-${esc(set.id)}-${i}" value="${j}"><span><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</span></label>`).join('')}</article>`}).join('')}</div><div class="d-flex gap-2 flex-wrap mt-3"><button class="btn btn-success" data-submit-set="${esc(set.id)}">Nộp bài</button><button class="btn btn-outline-secondary" data-close-set="${esc(set.id)}">Đóng</button><span class="teacher-quiz-result" id="result-${esc(set.id)}"></span></div></div></article>`).join(''):'<div class="empty"><div>📝</div><h4>Chưa có bài tập giáo viên đăng</h4></div>';
    root.querySelectorAll('[data-start-set]').forEach(b=>b.onclick=()=>document.getElementById(`teacher-set-${b.dataset.startSet}`)?.classList.remove('d-none'));
    root.querySelectorAll('[data-close-set]').forEach(b=>b.onclick=()=>document.getElementById(`teacher-set-${b.dataset.closeSet}`)?.classList.add('d-none'));
    root.querySelectorAll('[data-submit-set]').forEach(b=>b.onclick=()=>{const set=groups.get(b.dataset.submitSet);if(!set)return;let score=0,answered=0;set.items.forEach((x,i)=>{const el=root.querySelector(`input[name="ans-${CSS.escape(set.id)}-${i}"]:checked`);if(el){answered++;if(Number(el.value)===Number(x.correctIndex))score++}});const result=document.getElementById(`result-${set.id}`);if(result)result.innerHTML=`<b>${score}/${set.items.length}</b> · đã trả lời ${answered}/${set.items.length} câu`;});
  },e=>{console.error(e);root.innerHTML='<div class="alert alert-danger">Không tải được bài tập giáo viên.</div>'});
  stops.push(stop)
}
function initListening(){const root=document.getElementById('teacherListeningList');if(!root)return;const q=query(collection(db,'listeningContent'),where('published','==',true));const stop=onSnapshot(q,snap=>{const rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));rows.sort((a,b)=>String(a.unit||'').localeCompare(String(b.unit||'')));root.innerHTML=rows.length?rows.map(x=>`<article class="teacher-listening"><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(x.unit||'')}</span><span class="tag">🎧 Giáo viên</span></div><h4>${esc(x.title||'')}</h4>${x.audioUrl?`<audio controls preload="none" src="${esc(x.audioUrl)}" class="w-100 mb-3"></audio>`:''}${x.sourceUrl?`<a class="btn btn-sm btn-outline-primary" href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">↗ Mở nguồn</a>`:''}${Array.isArray(x.prompts)&&x.prompts.length?`<div class="mt-3"><b>Gợi ý:</b><ol>${x.prompts.map(p=>`<li>${esc(p)}</li>`).join('')}</ol></div>`:''}</article>`).join(''):'<div class="muted">Chưa có bài Listening giáo viên đăng.</div>'},e=>{console.error(e);root.innerHTML='<div class="alert alert-danger">Không tải được Listening giáo viên.</div>'});stops.push(stop)}
