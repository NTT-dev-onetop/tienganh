import{collection,doc,getDoc,setDoc,updateDoc,query,where,getDocs,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{auth,db}from"./firebase-services.js";
import{decodeCorrectIndex,makeSignature}from"./security.js";

let currentUser=null,currentSets=[],selectedSet=null,answers={},submitting=false,stopSets=null;
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg,type='success')=>{let e=document.getElementById('toast');if(!e){e=document.createElement('div');e.id='toast';e.className='toast-note';document.body.appendChild(e)}e.className=`toast-note ${type}`;e.textContent=msg;clearTimeout(window.__toast);requestAnimationFrame(()=>e.classList.add('show'));window.__toast=setTimeout(()=>e.classList.remove('show'),2500)};
async function loadSets(){
  if(!currentUser)return;
  try{
    const snap=await getDocs(query(collection(db,'sets'),where('published','==',true)));
    currentSets=[];snap.forEach(d=>{const x={id:d.id,...d.data()};if(Number.isInteger(Number(x.order)))currentSets.push(x)});currentSets.sort((a,b)=>Number(a.order)-Number(b.order));
    await renderDailySetPage();
  }catch(e){console.error('Không tải được Daily Set:',e);toast('Không tải được bộ đề. Kiểm tra Firestore.','error')}
}
async function passedSetIds(){
  if(!currentUser)return new Set();
  try{
    const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));
    const out=new Set();snap.forEach(d=>{const x=d.data()||{};if(x.passed===true&&x.setId)out.add(String(x.setId))});return out;
  }catch(e){console.error('Không đọc được lịch sử set:',e);return new Set()}
}
function unlockedFor(set,index,passed){
  if(!set||index<0)return false;
  if(index===0)return true;
  const previous=currentSets[index-1];return previous?passed.has(previous.id):false;
}
function watchSetsRealtime(){
  if(stopSets)stopSets();
  if(!currentUser)return;
  const q=query(collection(db,'sets'),where('published','==',true));
  stopSets=onSnapshot(q,snap=>{
    currentSets=[];
    snap.forEach(d=>{
      const x={id:d.id,...d.data()};
      if(Number.isInteger(Number(x.order)))currentSets.push(x);
    });
    currentSets.sort((a,b)=>Number(a.order)-Number(b.order));
    const live=document.getElementById('dailyLiveStatus');
    if(live){live.textContent='🟢 Cập nhật thời gian thực';live.classList.remove('is-offline')}
    if(!selectedSet)renderDailySetPage();
  },e=>{
    console.error('Realtime Daily Set:',e);
    const live=document.getElementById('dailyLiveStatus');
    if(live){live.textContent='🟠 Đang chờ kết nối';live.classList.add('is-offline')}
  });
}
export async function initDailySet(){onAuthStateChanged(auth,async u=>{currentUser=u;if(stopSets){stopSets();stopSets=null}if(!u){currentSets=[];selectedSet=null;renderDailySetPage();return}await loadSets();watchSetsRealtime()})}
export async function renderDailySetPage(){
  const root=document.getElementById('daily');if(!root)return;
  if(!currentUser){root.innerHTML='<div class="empty"><div>🔒</div><h3>Đăng nhập để làm Daily Set</h3></div>';return}
  const passed=await passedSetIds();
  const allFivePassed=currentSets.length>=5&&currentSets.slice(0,5).every(x=>passed.has(x.id));
  const cards=currentSets.map((s,i)=>{const unlocked=allFivePassed||unlockedFor(s,i,passed);const done=passed.has(s.id);return `<button class="daily-set-card ${unlocked?'':'is-locked'}" data-set-id="${esc(s.id)}" ${unlocked?'':'disabled'}><div class="daily-set-number">${String(Number(s.order)).padStart(2,'0')}</div><div class="daily-set-info"><b>${esc(s.title||`Set ${Number(s.order)}`)}</b><span>${done?'✓ Đã pass':unlocked?'🔓 Đã mở':'🔒 Cần pass set trước'}</span></div><div class="daily-set-arrow">→</div></button>`}).join('');
  root.innerHTML=`<div class="head"><div><div class="eyebrow">DAILY ENGLISH · 11T1</div><h2>🎯 Daily Set</h2><p>20 câu · đạt từ 15/20 để pass · mỗi set chỉ nộp 1 lần/ngày.</p></div><div class="daily-head-actions"><span class="live-sync-badge" id="dailyLiveStatus">🟡 Đang đồng bộ…</span><div class="daily-streak" id="dailyStreak">🔥 …</div></div></div><div class="daily-progress"><div><b>${Math.min(passed.size,5)}/5</b> set đã pass</div><div class="progress"><div class="progress-bar" style="width:${Math.min(100,Math.round(Math.min(passed.size,5)/5*100))}%"></div></div></div><div class="daily-set-grid">${cards||'<div class="empty"><h4>Chưa có Set</h4><p>Admin hãy tạo 5 Set trong Dashboard.</p></div>'}</div><div id="dailyWork" class="mt-4"></div>`;
  root.querySelectorAll('[data-set-id]').forEach(b=>b.onclick=()=>openSet(b.dataset.setId));
  try{const snap=await getDoc(doc(db,'users',currentUser.uid));const streak=Number(snap.exists()?snap.data()?.streak||0:0);const el=document.getElementById('dailyStreak');if(el)el.textContent=`🔥 ${streak} ngày`;}catch(e){console.error('Không đọc được streak:',e)}
}
async function openSet(id){
  const set=currentSets.find(x=>x.id===id);if(!set)return;
  const questions=Array.isArray(set.questions)?set.questions:[];if(questions.length!==20){toast('Set này chưa đủ 20 câu. Admin cần sửa lại.','error');return}
  const date=today();
  try{
    const existing=await getDoc(doc(db,'submissions',`${currentUser.uid}_${date}_${id}`));
    if(existing.exists()){toast('Bạn đã nộp Set này hôm nay.','error');return}
  }catch(e){console.error('Không kiểm tra được submission:',e);toast('Không thể kiểm tra lượt làm.','error');return}
  selectedSet=set;answers={};submitting=false;renderSetQuestion();
}
function normalizeText(s){return String(s??'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ')}
function renderSetQuestion(){
  const root=document.getElementById('dailyWork');if(!root||!selectedSet)return;
  const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];const i=Object.keys(answers).length;const idx=Math.min(i,qs.length-1);const q=qs[idx];if(!q){return}
  const kind=String(q.kind||'mcq');const opts=Array.isArray(q.options)?q.options:[];
  let body='';
  if(kind==='form'||kind==='rewrite')body=`<input id="dailyText" class="form-control form-control-lg" placeholder="${kind==='form'?'Nhập dạng đúng…':'Viết lại câu…'}" autocomplete="off">`;
  else body=`<div class="option-grid">${opts.map((o,j)=>`<label class="exercise-option"><input type="radio" name="dailyAnswer" value="${j}"><span><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</span></label>`).join('')}</div>`;
  root.innerHTML=`<div class="panel daily-question"><div class="d-flex justify-content-between gap-3 flex-wrap"><span class="tag">${esc(selectedSet.title||'Daily Set')}</span><b>Câu ${idx+1}/20</b></div><div class="progress my-3"><div class="progress-bar" style="width:${Math.round(idx/20*100)}%"></div></div><h3>${idx+1}. ${esc(q.prompt||'Câu hỏi')}</h3>${body}<div class="d-flex justify-content-between mt-4"><button id="dailyCancel" class="btn btn-outline-secondary">← Danh sách Set</button><button id="dailyNext" class="btn btn-primary">${idx===19?'Nộp bài':'Tiếp →'}</button></div></div>`;
  document.getElementById('dailyCancel').onclick=()=>{selectedSet=null;renderDailySetPage()};document.getElementById('dailyNext').onclick=saveCurrentAnswer;
}
function saveCurrentAnswer(){
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];const idx=Object.keys(answers).length;if(idx<0||idx>=qs.length)return;const q=qs[idx];let val='';if(q.kind==='form'||q.kind==='rewrite')val=document.getElementById('dailyText')?.value||'';else val=document.querySelector('input[name="dailyAnswer"]:checked')?.value||'';if(!String(val).trim()){toast('Hãy trả lời câu này trước.','error');return}answers[idx]=val;if(idx===19)submitSet();else renderSetQuestion();
}
export async function submitSet(){
  if(submitting||!currentUser||!selectedSet)return;submitting=true;
  const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];let score=0;
  qs.forEach((q,i)=>{const val=answers[i];const ci=decodeCorrectIndex(String(q?.correctCode||''));if(q?.kind==='form'||q?.kind==='rewrite'){if(normalizeText(val)===normalizeText(q?.answer||''))score++;}else if(Number(val)===ci)score++});
  const date=today(),passed=score>=15,bonusPoints=passed?2:0;
  try{
    const userRef=doc(db,'users',currentUser.uid),userSnap=await getDoc(userRef);if(!userSnap.exists())throw new Error('Hồ sơ học sinh không tồn tại.');
    const profile=userSnap.data()||{};const oldStreak=Number(profile.streak||0);const last=String(profile.lastCompletedDate||'');let streak=oldStreak;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const y=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    if(passed){streak=last===date?oldStreak:last===y?oldStreak+1:1}else streak=oldStreak;
    const ref=doc(db,'submissions',`${currentUser.uid}_${date}_${selectedSet.id}`);
    const existing=await getDoc(ref);if(existing.exists()){toast('Bạn đã nộp Set này hôm nay.','error');submitting=false;return}
    await setDoc(ref,{uid:currentUser.uid,name:String(profile.name||currentUser.displayName||'Tài khoản'),className:String(profile.className||'11T1'),setId:selectedSet.id,score,total:20,passed,bonusPoints,submittedAt:serverTimestamp(),date,streakAtSubmission:streak,signature:makeSignature(currentUser.uid,selectedSet.id,score,date)});
    if(passed&&last!==date){await updateDoc(userRef,{lastCompletedDate:date,streak,totalSetsCompleted:Number(profile.totalSetsCompleted||0)+1,totalBonusPoints:Number(profile.totalBonusPoints||0)+bonusPoints})}
    else if(passed){await updateDoc(userRef,{streak})}
    const streakEl=document.getElementById('dailyStreak');if(streakEl)streakEl.textContent=`🔥 ${streak} ngày`;
    document.dispatchEvent(new CustomEvent('daily:streak-updated',{detail:{streak}}));
    rootResult(score,passed,streak);
  }catch(e){console.error('Lỗi nộp Daily Set:',e);toast('Không thể nộp bài. Vui lòng thử lại.','error');submitting=false}
}
function rootResult(score,passed,streak){const root=document.getElementById('dailyWork');if(!root)return;root.innerHTML=`<div class="panel daily-result"><div class="result-icon">${passed?'🏆':'📚'}</div><h2>${score}/20</h2><p>${passed?'Đạt — Set đã được mở tiếp theo.':'Chưa đạt — bạn có thể xem lại kiến thức và làm Set khác vào ngày sau.'}</p><div class="streak-result">🔥 Streak: <b>${streak}</b> ngày ${passed?'<span class="text-success"> · +2 điểm</span>':''}</div><button id="dailyBack" class="btn btn-primary mt-3">← Về Daily Set</button></div>`;document.getElementById('dailyBack').onclick=()=>{selectedSet=null;loadSets()}}
initDailySet();
