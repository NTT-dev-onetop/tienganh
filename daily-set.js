
function startDailySetCountdown(set) {
  const minutes = getSetDurationMinutes(set);
  if (!minutes) return;

  const endMs = Date.now() + minutes * 60 * 1000;
  window._dailySetTimerEnd = endMs;

  if (window._dailySetTimerInterval) clearInterval(window._dailySetTimerInterval);

  const render = () => {
    const remaining = Math.max(0, window._dailySetTimerEnd - Date.now());
    const totalSec = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');

    let el = document.getElementById('daily-set-countdown');
    if (!el) {
      el = document.createElement('div');
      el.id = 'daily-set-countdown';
      el.style.cssText =
        'position:fixed;top:12px;right:12px;z-index:9999;' +
        'padding:8px 12px;border-radius:10px;' +
        'background:#111;color:#fff;font-weight:700;font-variant-numeric:tabular-nums;';
      document.body.appendChild(el);
    }
    el.textContent = `⏱ ${mm}:${ss}`;

    if (remaining <= 0) {
      clearInterval(window._dailySetTimerInterval);
      window._dailySetTimerInterval = null;
      el.textContent = '⏱ 00:00';
      el.setAttribute('data-expired', 'true');

      // Do not silently discard answers. The existing submit button can still
      // invoke submitSet(), which performs the final expiry check.
      alert('Đã hết thời gian làm bài. Hệ thống sẽ khóa lượt nộp.');
    }
  };

  render();
  window._dailySetTimerInterval = setInterval(render, 500);
}

import{collection,doc,getDoc,setDoc,updateDoc,query,where,getDocs,onSnapshot,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{auth,db}from"./firebase-services.js";
import{decodeCorrectIndex}from"./security.js";

let currentUser=null,currentSets=[],selectedSet=null,answers={},submitting=false,stopSets=null,stopProgress=null;
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg,type='success')=>window.appToast?window.appToast(msg,type):undefined;

function _scheduleDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getSetScheduleState(set) {
  const now = new Date();
  const start = _scheduleDate(set?.startAt);
  const end = _scheduleDate(set?.endAt);

  if (start && now < start) return { state: 'upcoming', start, end };
  if (end && now >= end) return { state: 'closed', start, end };
  return { state: 'open', start, end };
}

function getSetDurationMinutes(set) {
  const n = Number(set?.durationMinutes);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatScheduleDate(d) {
  if (!d) return '';
  return d.toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

async function loadSets(){
  if(!currentUser)return;
  try{
    const snap=await getDocs(collection(db,'sets'));
    currentSets=[];snap.forEach(d=>{const x={id:d.id,...d.data()};if((x.published===true||x.published===1||['true','published','public'].includes(String(x.published??'').toLowerCase())) && Number.isInteger(Number(x.order)) && x.isDaily !== false)currentSets.push(x)});currentSets.sort((a,b)=>{const ua=String(a.unit||''),ub=String(b.unit||'');const na=Number((ua.match(/\d+/)||['999'])[0]),nb=Number((ub.match(/\d+/)||['999'])[0]);return na-nb||ua.localeCompare(ub,'vi')||Number(a.order)-Number(b.order)});
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
  const unit=String(set.unit||'Chưa phân Unit');
  const sameUnit=currentSets.filter(x=>String(x.unit||'Chưa phân Unit')===unit);
  const pos=sameUnit.findIndex(x=>x.id===set.id);
  if(pos<=0)return true;
  return passed.has(sameUnit[pos-1].id);
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
  const q=query(collection(db,'sets'));
  stopSets=onSnapshot(q,snap=>{
    currentSets=[];
    snap.forEach(d=>{
      const x={id:d.id,...d.data()};
      if((x.published===true||x.published===1||['true','published','public'].includes(String(x.published??'').toLowerCase())) && Number.isInteger(Number(x.order)) && x.isDaily !== false)currentSets.push(x);
    });
    currentSets.sort((a,b)=>{const ua=String(a.unit||''),ub=String(b.unit||'');const na=Number((ua.match(/\d+/)||['999'])[0]),nb=Number((ub.match(/\d+/)||['999'])[0]);return na-nb||ua.localeCompare(ub,'vi')||Number(a.order)-Number(b.order)});
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
  const cards=currentSets.map((s,i)=>{const unlocked=unlockedFor(s,i,passed);const done=passed.has(s.id);return `<button class="daily-set-card ${unlocked?'':'is-locked'}" data-set-id="${esc(s.id)}" ${unlocked?'':'disabled'}><div class="daily-set-number">${String(Number(s.order)).padStart(2,'0')}</div><div class="daily-set-info"><b>${esc(s.title||`Set ${Number(s.order)}`)}</b><span>${done?'✓ Đã pass':unlocked?'🔓 Đã mở':'🔒 Cần pass set trước'}</span></div><div class="daily-set-arrow">→</div></button>`}).join('');
  root.innerHTML=`<div class="head"><div><div class="eyebrow">DAILY ENGLISH · 11T1</div><h2>🎯 Daily Set</h2><p>Mỗi Set có số câu riêng · đạt theo điều kiện của Set · không giới hạn số Set · tiến độ được phân theo Unit.</p></div><div class="daily-head-actions"><span class="live-sync-badge" id="dailyLiveStatus">🟡 Đang đồng bộ…</span><div class="daily-streak" id="dailyStreak">🔥 …</div></div></div><div class="daily-progress"><div><b>${${passed.size}/${currentSets.length}</b> set đã pass</div><div class="progress"><div class="progress-bar" style="width:${currentSets.length?Math.min(100,Math.round(passed.size/currentSets.length*100)):0}%"></div></div></div><div class="daily-set-grid">${cards||'<div class="empty"><h4>Chưa có Set</h4><p>Giáo viên có thể tạo không giới hạn Daily Set và phân theo Unit.</p></div>'}</div><div id="dailyWork" class="mt-4"></div>`;
  root.querySelectorAll('[data-set-id]').forEach(b=>b.onclick=()=>openSet(b.dataset.setId));
  const el=document.getElementById('dailyStreak');if(el)el.textContent=`🔥 ${progress.streak} ngày`;
}
async function openSet(id){
  const set=currentSets.find(x=>x.id===id);if(!set)return;
  // Schedule gate: start/end times are authoritative for the student UI.
  // The final submit is checked again below, so an expired attempt cannot be submitted.
  const schedule = getSetScheduleState(set);
  if (schedule.state === 'upcoming') {
    alert(`Bài chưa mở. Bắt đầu: ${formatScheduleDate(schedule.start)}`);
    return;
  }
  if (schedule.state === 'closed') {
    alert(`Bài đã đóng. Hạn chót: ${formatScheduleDate(schedule.end)}`);
    return;
  }
  window._dailySetStartedAt = Date.now();
  window._dailySetDurationMinutes = getSetDurationMinutes(set);
  startDailySetCountdown(set);

  const questions=Array.isArray(set.questions)?set.questions:[];if(!questions.length){toast('Set này chưa có câu hỏi.','error');return}
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
  root.innerHTML=`<div class="panel daily-question"><div class="d-flex justify-content-between gap-3 flex-wrap"><span class="tag">${esc(selectedSet.title||'Daily Set')}</span><b>Câu ${idx+1}/${qs.length}</b></div><div class="progress my-3"><div class="progress-bar" style="width:${Math.round(((idx+1)/qs.length)*100)}%"></div></div><h3>${idx+1}. ${esc(q.prompt||'Câu hỏi')}</h3>${body}<div class="d-flex justify-content-between mt-4"><button id="dailyCancel" class="btn btn-outline-secondary">← Danh sách Set</button><button id="dailyNext" class="btn btn-primary">${idx===qs.length-1?'Nộp bài':'Tiếp →'}</button></div></div>`;
  document.getElementById('dailyCancel').onclick=()=>{selectedSet=null;renderDailySetPage()};document.getElementById('dailyNext').onclick=saveCurrentAnswer;
}
function saveCurrentAnswer(){
  const btn=document.getElementById('dailyNext');if(btn?.disabled)return;if(btn)btn.disabled=true;
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];const idx=Object.keys(answers).length;if(idx<0||idx>=qs.length)return;const q=qs[idx];let val='';if(q.kind==='form'||q.kind==='rewrite')val=document.getElementById('dailyText')?.value||'';else val=document.querySelector('input[name="dailyAnswer"]:checked')?.value||'';if(!String(val).trim()){if(btn)btn.disabled=false;toast('Hãy trả lời câu này trước.','error');return}answers[idx]=val;if(idx===qs.length-1)submitSet();else renderSetQuestion();
}
export async function submitSet(){
  // Re-check the schedule immediately before writing the submission.
  // This prevents submissions after End Time even if the page stayed open.
  try {
    const scheduleSnap = await getDoc(doc(db, 'sets', selectedSet.id));
    if (!scheduleSnap.exists()) {
      throw new Error('Bài tập không còn tồn tại.');
    }
    const currentSet = scheduleSnap.data();
    const schedule = getSetScheduleState(currentSet);
    if (schedule.state === 'upcoming') {
      throw new Error(`Bài chưa mở. Bắt đầu: ${formatScheduleDate(schedule.start)}`);
    }
    if (schedule.state === 'closed') {
      throw new Error(`Đã hết hạn nộp bài (${formatScheduleDate(schedule.end)}).`);
    }
    const duration = getSetDurationMinutes(currentSet);
    if (duration > 0 && window._dailySetStartedAt) {
      const elapsed = (Date.now() - window._dailySetStartedAt) / 60000;
      if (elapsed >= duration) {
        throw new Error('Đã hết thời gian làm bài.');
      }
    }
  } catch (scheduleError) {
    throw scheduleError;
  }

  if(submitting||!currentUser||!selectedSet)return;submitting=true;
  const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];let score=0;
  qs.forEach((q,i)=>{const val=answers[i];const ci=decodeCorrectIndex(String(q?.correctCode||''));if(q?.kind==='form'||q?.kind==='rewrite'){if(normalizeText(val)===normalizeText(q?.answer||''))score++;}else if(Number(val)===ci)score++});
  const date=today();const total=qs.length;const required=Math.max(1,Math.min(total,Number(selectedSet?.passScore)||Math.ceil(total*0.75)));const passed=score>=required;
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
    await setDoc(ref,{uid:currentUser.uid,name:String(profile.name||currentUser.displayName||'Tài khoản'),className:String(profile.className||'11T1'),setId:selectedSet.id,score,total,passScore:required,passed,bonusPoints,submittedAt:serverTimestamp(),date,streakAtSubmission:streak});
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
  root.innerHTML=`<div class="panel daily-result"><div class="result-icon">${passed?'🏆':'📚'}</div><h2>${score}/${qs.length}</h2><p>${passed?'Đạt — Set tiếp theo đã được mở.':'Chưa đạt — bạn có thể xem lại kiến thức và thử lại Set này vào ngày mai.'}<br><span class="muted">Điều kiện đạt: <b>${Math.max(1,Math.min(qs.length,Number(selectedSet?.passScore)||Math.ceil(qs.length*0.75)))}/${qs.length}</b> câu đúng</span></p><div class="streak-result">🔥 Streak: <b>${streak}</b> ngày ${passed?'<span class="text-success"> · +2 điểm (lần pass đầu tiên của Set)</span>':''}</div><details class="daily-answer-review mt-4 text-start"><summary><b>Xem lại đáp án</b></summary><div class="daily-review-list mt-3">${review}</div></details><button id="dailyBack" class="btn btn-primary mt-3">← Về Daily Set</button></div>`;document.getElementById('dailyBack').onclick=()=>{selectedSet=null;loadSets()}}
initDailySet();
