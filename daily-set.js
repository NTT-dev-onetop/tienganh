import{collection,doc,getDoc,setDoc,updateDoc,query,where,getDocs,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{auth,db}from"./firebase-services.js";
import{decodeCorrectIndex,makeSignature}from"./security.js";

let currentUser=null,currentSets=[],selectedSet=null,answers={},submitting=false,stopSets=null,stopProgress=null;
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg,type='success')=>window.appToast?window.appToast(msg,type):undefined;
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
function progressFromSubmissionDocs(docs){
  const bySet=new Map();
  const sorted=[...docs].map(d=>d.data?d.data():(d||{})).filter(x=>x?.passed===true&&x?.setId).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  for(const x of sorted){
    const setId=String(x.setId);
    if(bySet.has(setId))continue; // only the first pass of a set counts for bonus/streak
    bySet.set(setId,x);
  }
  const passedDates=new Set();let totalBonus=0,lastCompletedDate='';
  for(const x of bySet.values()){
    const date=String(x.date||'');
    if(date){passedDates.add(date);if(date>lastCompletedDate)lastCompletedDate=date}
    totalBonus+=2;
  }
  const now=today();const yesterdayDate=(()=>{const d=new Date();d.setDate(d.getDate()-1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})();
  let streak=0;
  if(passedDates.has(now)||passedDates.has(yesterdayDate)){
    let cursor=new Date((passedDates.has(now)?now:yesterdayDate)+'T00:00:00');
    while(true){const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;if(!passedDates.has(key))break;streak++;cursor.setDate(cursor.getDate()-1)}
  }
  return {streak,totalPassed:bySet.size,totalBonus,lastCompletedDate};
}
async function getStudentProgress(){
  if(!currentUser)return {streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''};
  try{const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));return progressFromSubmissionDocs(snap.docs)}catch(e){console.error('Không đọc được tiến độ Daily Set:',e);return {streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''}}
}
function watchStudentProgress(){
  if(stopProgress)stopProgress();
  if(!currentUser)return;
  const q=query(collection(db,'submissions'),where('uid','==',currentUser.uid));
  stopProgress=onSnapshot(q,snap=>{
    const p=progressFromSubmissionDocs(snap.docs);const el=document.getElementById('dailyStreak');
    if(el)el.textContent=`🔥 ${p.streak} ngày`;
    const live=document.getElementById('dailyLiveStatus');if(live){live.textContent='🟢 Cập nhật thời gian thực';live.classList.remove('is-offline')}
    if(!selectedSet)renderDailySetPage();
  },e=>console.error('Realtime tiến độ Daily Set:',e));
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
export async function initDailySet(){onAuthStateChanged(auth,async u=>{currentUser=u;if(stopSets){stopSets();stopSets=null}if(stopProgress){stopProgress();stopProgress=null}if(!u){currentSets=[];selectedSet=null;renderDailySetPage();return}await loadSets();watchSetsRealtime();watchStudentProgress()})}
export async function renderDailySetPage(){
  const root=document.getElementById('daily');if(!root)return;
  if(!currentUser){root.innerHTML='<div class="empty"><div>🔒</div><h3>Đăng nhập để làm Daily Set</h3></div>';return}
  let submissionDocs=[];
  try{const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));submissionDocs=snap.docs}catch(e){console.error('Không đọc được lịch sử Daily Set:',e)}
  const passed=new Set();submissionDocs.forEach(d=>{const x=d.data()||{};if(x.passed===true&&x.setId)passed.add(String(x.setId))});
  const progress=progressFromSubmissionDocs(submissionDocs);
  const allFivePassed=currentSets.length>=5&&currentSets.slice(0,5).every(x=>passed.has(x.id));
  const cards=currentSets.map((s,i)=>{const unlocked=allFivePassed||unlockedFor(s,i,passed);const done=passed.has(s.id);return `<button class="daily-set-card ${unlocked?'':'is-locked'}" data-set-id="${esc(s.id)}" ${unlocked?'':'disabled'}><div class="daily-set-number">${String(Number(s.order)).padStart(2,'0')}</div><div class="daily-set-info"><b>${esc(s.title||`Set ${Number(s.order)}`)}</b><span>${done?'✓ Đã pass':unlocked?'🔓 Đã mở':'🔒 Cần pass set trước'}</span></div><div class="daily-set-arrow">→</div></button>`}).join('');
  root.innerHTML=`<div class="head"><div><div class="eyebrow">DAILY ENGLISH · 11T1</div><h2>🎯 Daily Set</h2><p>20 câu · đạt từ 15/20 để pass · mỗi set chỉ nộp 1 lần/ngày.</p></div><div class="daily-head-actions"><span class="live-sync-badge" id="dailyLiveStatus">🟡 Đang đồng bộ…</span><div class="daily-streak" id="dailyStreak">🔥 …</div></div></div><div class="daily-progress"><div><b>${Math.min(passed.size,5)}/5</b> set đã pass</div><div class="progress"><div class="progress-bar" style="width:${Math.min(100,Math.round(Math.min(passed.size,5)/5*100))}%"></div></div></div><div class="daily-set-grid">${cards||'<div class="empty"><h4>Chưa có Set</h4><p>Admin hãy tạo 5 Set trong Dashboard.</p></div>'}</div><div id="dailyWork" class="mt-4"></div>`;
  root.querySelectorAll('[data-set-id]').forEach(b=>b.onclick=()=>openSet(b.dataset.setId));
  const el=document.getElementById('dailyStreak');if(el)el.textContent=`🔥 ${progress.streak} ngày`;
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
  const btn=document.getElementById('dailyNext');if(btn?.disabled)return;if(btn)btn.disabled=true;
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];const idx=Object.keys(answers).length;if(idx<0||idx>=qs.length)return;const q=qs[idx];let val='';if(q.kind==='form'||q.kind==='rewrite')val=document.getElementById('dailyText')?.value||'';else val=document.querySelector('input[name="dailyAnswer"]:checked')?.value||'';if(!String(val).trim()){if(btn)btn.disabled=false;toast('Hãy trả lời câu này trước.','error');return}answers[idx]=val;if(idx===19)submitSet();else renderSetQuestion();
}
export async function submitSet(){
  if(submitting||!currentUser||!selectedSet)return;submitting=true;
  const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];let score=0;
  qs.forEach((q,i)=>{const val=answers[i];const ci=decodeCorrectIndex(String(q?.correctCode||''));if(q?.kind==='form'||q?.kind==='rewrite'){if(normalizeText(val)===normalizeText(q?.answer||''))score++;}else if(Number(val)===ci)score++});
  const date=today(),passed=score>=15;
  try{
    const userRef=doc(db,'users',currentUser.uid),userSnap=await getDoc(userRef);if(!userSnap.exists())throw new Error('Hồ sơ học sinh không tồn tại.');
    const profile=userSnap.data()||{};
    const historySnap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));
    const firstPass=!historySnap.docs.some(d=>{const x=d.data()||{};return x.passed===true&&String(x.setId||'')===String(selectedSet.id)});
    const bonusPoints=passed&&firstPass?2:0;
    const previousProgress=progressFromSubmissionDocs(historySnap.docs);
    const oldStreak=Number(previousProgress.streak||0);const last=String(previousProgress.lastCompletedDate||'');let streak=oldStreak;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const y=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    if(passed&&firstPass){streak=last===date?oldStreak:last===y?oldStreak+1:1}
    const ref=doc(db,'submissions',`${currentUser.uid}_${date}_${selectedSet.id}`);
    const existing=await getDoc(ref);if(existing.exists()){toast('Bạn đã nộp Set này hôm nay.','error');submitting=false;return}
    await setDoc(ref,{uid:currentUser.uid,name:String(profile.name||currentUser.displayName||'Tài khoản'),className:String(profile.className||'11T1'),setId:selectedSet.id,score,total:20,passed,bonusPoints,submittedAt:serverTimestamp(),date,streakAtSubmission:streak,signature:makeSignature(currentUser.uid,selectedSet.id,score,date)});
    // Submission là nguồn dữ liệu chuẩn. Summary trên users chỉ là dữ liệu denormalized để đọc nhanh.
    if(passed&&firstPass){
      try{
        const latest=progressFromSubmissionDocs((await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)))).docs);
        await setDoc(userRef,{lastCompletedDate:latest.lastCompletedDate,streak:latest.streak,totalSetsCompleted:latest.totalPassed,totalBonusPoints:latest.totalBonus},{merge:true});
      }catch(summaryError){console.warn('Đã lưu submission nhưng chưa cập nhật summary users:',summaryError)}
    }
    rootResult(score,passed,streak);
  }catch(e){console.error('Lỗi nộp Daily Set:',e);toast('Không thể nộp bài. Vui lòng thử lại.','error');submitting=false}
}
function rootResult(score,passed,streak){
  const root=document.getElementById('dailyWork');if(!root)return;
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];
  const review=qs.map((q,i)=>{const val=String(answers[i]??'');const ci=decodeCorrectIndex(String(q?.correctCode||''));const correct=(q?.kind==='form'||q?.kind==='rewrite')?String(q?.answer||''):(Number.isInteger(ci)&&Array.isArray(q?.options)?`${String.fromCharCode(65+ci)}. ${q.options[ci]??''}`:'');const yours=(q?.kind==='form'||q?.kind==='rewrite')?val:(val!==''&&Array.isArray(q?.options)?`${String.fromCharCode(65+Number(val))}. ${q.options[Number(val)]??''}`:'Chưa trả lời');const ok=(q?.kind==='form'||q?.kind==='rewrite')?normalizeText(val)===normalizeText(q?.answer||''):Number(val)===ci;return `<div class="daily-review-row ${ok?'is-correct':'is-wrong'}"><b>Câu ${i+1}</b><span>${ok?'✓':'✗'} Bạn: ${esc(yours)}</span>${ok?'':'<span>Đúng: '+esc(correct)+'</span>'}</div>`}).join('');
  root.innerHTML=`<div class="panel daily-result"><div class="result-icon">${passed?'🏆':'📚'}</div><h2>${score}/20</h2><p>${passed?'Đạt — Set tiếp theo đã được mở.':'Chưa đạt — bạn có thể xem lại kiến thức và thử lại Set này vào ngày mai.'}</p><div class="streak-result">🔥 Streak: <b>${streak}</b> ngày ${passed?'<span class="text-success"> · +2 điểm (lần pass đầu tiên của Set)</span>':''}</div><details class="daily-answer-review mt-4 text-start"><summary><b>Xem lại đáp án</b></summary><div class="daily-review-list mt-3">${review}</div></details><button id="dailyBack" class="btn btn-primary mt-3">← Về Daily Set</button></div>`;document.getElementById('dailyBack').onclick=()=>{selectedSet=null;loadSets()}}
initDailySet();
