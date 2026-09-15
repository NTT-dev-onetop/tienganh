import{getProgressForUid}from"./progress.js";

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

let currentUser=null,currentSets=[],selectedSet=null,answers={},submitting=false,stopSets=null,stopProgress=null,_passedCache=null;
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg,type='success')=>window.appToast?window.appToast(msg,type):undefined;
const isPassedValue=v=>v===true||v===1||String(v).toLowerCase()==='true'||String(v).toLowerCase()==='passed';

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
    const snap=await getDocs(query(collection(db,'sets'),where('published','==',true)));
    currentSets=[];
    snap.forEach(d=>{
      const x={id:d.id,...d.data()};
      const hasOrder=Number.isInteger(Number(x.order));
      const hasUnit=Number.isInteger(Number(x.unitNumber));
      if((hasOrder||hasUnit) && x.isDaily!==false)currentSets.push(x);
    });
    currentSets.sort((a,b)=>getUnitOfSet(a)-getUnitOfSet(b)||getDailyOfSet(a)-getDailyOfSet(b));
    await renderDailySetPage();
  }catch(e){console.error('Không tải được Daily Set:',e);toast('Không tải được bộ đề. Kiểm tra Firestore.','error')}
}
function getUnitOfSet(s){
  const u=Number(s?.unitNumber);
  if(Number.isFinite(u)&&u>0)return u;
  return 1;
}
function getDailyOfSet(s){
  const d=Number(s?.dailyNumber);
  if(Number.isFinite(d)&&d>0)return d;
  const o=Number(s?.order);
  return Number.isFinite(o)&&o>0?o:1;
}
async function passedSetIds(force=false){
  if(_passedCache && !force)return _passedCache;
  if(!currentUser)return new Set();
  try{
    const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));
    const out=new Set();snap.forEach(d=>{const x=d.data()||{};if(isPassedValue(x.passed)&&x.setId)out.add(String(x.setId))});
    _passedCache=out;return out;
  }catch(e){console.error('Không đọc được lịch sử set:',e);return new Set()}
}
function unlockedFor(set,passed){
  if(!set)return false;
  const unit=getUnitOfSet(set), daily=getDailyOfSet(set);
  const units=[...new Set(currentSets.map(getUnitOfSet))].sort((a,b)=>a-b);
  const unitIndex=units.indexOf(unit);
  if(unitIndex<0)return false;
  const previousUnits=units.filter(u=>u<unit);
  if(previousUnits.some(u=>currentSets.filter(x=>getUnitOfSet(x)===u).some(x=>!passed.has(String(x.id)))))return false;
  const sameUnit=currentSets.filter(x=>getUnitOfSet(x)===unit).sort((a,b)=>getDailyOfSet(a)-getDailyOfSet(b));
  return sameUnit.filter(x=>getDailyOfSet(x)<daily).every(x=>passed.has(String(x.id)));
}
async function getStudentProgress(){
  if(!currentUser)return {streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''};
  try{const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));return getProgressForUid(snap.docs,currentUser.uid)}catch(e){console.error('Không đọc được tiến độ Daily Set:',e);return {streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''}}
}
function watchStudentProgress(){
  if(stopProgress)stopProgress();
  if(!currentUser)return;
  const q=query(collection(db,'submissions'),where('uid','==',currentUser.uid));
  stopProgress=onSnapshot(q,snap=>{
    const p=getProgressForUid(snap.docs,currentUser.uid);const el=document.getElementById('dailyStreak');
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
      const hasOrder=Number.isInteger(Number(x.order));
      const hasUnit=Number.isInteger(Number(x.unitNumber));
      if((hasOrder||hasUnit) && x.isDaily!==false)currentSets.push(x);
    });
    currentSets.sort((a,b)=>getUnitOfSet(a)-getUnitOfSet(b)||getDailyOfSet(a)-getDailyOfSet(b));
    const live=document.getElementById('dailyLiveStatus');
    if(live){live.textContent='🟢 Cập nhật thời gian thực';live.classList.remove('is-offline')}
    if(!selectedSet)renderDailySetPage();
  },e=>{
    console.error('Realtime Daily Set:',e);
    const live=document.getElementById('dailyLiveStatus');
    if(live){live.textContent='🟠 Đang chờ kết nối';live.classList.add('is-offline')}
  });
}
export async function initDailySet(){onAuthStateChanged(auth,async u=>{currentUser=u;_passedCache=null;if(stopSets){stopSets();stopSets=null}if(stopProgress){stopProgress();stopProgress=null}if(!u){currentSets=[];selectedSet=null;renderDailySetPage();return}await loadSets();watchSetsRealtime();watchStudentProgress()})}
export async function renderDailySetPage(){
  const root=document.getElementById('daily');if(!root)return;
  if(!currentUser){root.innerHTML='<div class="empty"><div>🔒</div><h3>Đăng nhập để làm Daily Set</h3></div>';return}
  let submissionDocs=[];
  try{const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));submissionDocs=snap.docs}catch(e){console.error('Không đọc được lịch sử Daily Set:',e)}
  const passed=new Set();submissionDocs.forEach(d=>{const x=d.data()||{};if(isPassedValue(x.passed)&&x.setId)passed.add(String(x.setId))});
  const progress=getProgressForUid(submissionDocs,currentUser.uid);
  const unitMap=new Map();
  for(const s of currentSets){const u=getUnitOfSet(s);if(!unitMap.has(u))unitMap.set(u,[]);unitMap.get(u).push(s)}
  const units=[...unitMap.entries()].map(([u,sets])=>({unit:u,sets:sets.sort((a,b)=>getDailyOfSet(a)-getDailyOfSet(b))})).sort((a,b)=>a.unit-b.unit);
  const unitStats=units.map(u=>({...u,total:u.sets.length,passed:u.sets.filter(s=>passed.has(String(s.id))).length}));
  const totalPassed=unitStats.reduce((sum,u)=>sum+u.passed,0),totalSets=unitStats.reduce((sum,u)=>sum+u.total,0);
  let currentUnitIdx=0;
  const allDone=unitStats.every(u=>u.passed===u.total)&&unitStats.length>0;
  if(allDone)currentUnitIdx=Math.max(0,unitStats.length-1);else{const idx=unitStats.findIndex(u=>u.passed<u.total);currentUnitIdx=idx<0?0:idx}
  const unitHtml=unitStats.map((u,ui)=>{
    const unitUnlocked=ui===0||unitStats.slice(0,ui).every(prev=>prev.passed===prev.total);
    const isCurrent=ui===currentUnitIdx,unitProg=u.total?Math.round(u.passed/u.total*100):0;
    const nodes=u.sets.map((s,si)=>{
      const prevDailies=u.sets.slice(0,si),allPrevPassed=prevDailies.every(p=>passed.has(String(p.id)));
      const unlocked=unitUnlocked&&allPrevPassed,done=passed.has(String(s.id));
      const state=done?'done':(unlocked?'open':'locked');
      const label=done?'✓':(unlocked?'BẮT ĐẦU':'🔒');
      const mascot=unlocked&&!done?`<img class="daily-node-mascot" src="./img/roach.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"> <span class="daily-node-fallback" style="display:none" aria-hidden="true">🪳</span>`:'';
      const doneIcon=done?'<span class="daily-node-check" aria-hidden="true">✓</span>':'';
      const justPassed=done&&String(window._dailyJustPassedId||'')===String(s.id);
      return `<button class="daily-node ${state}" data-set-id="${esc(s.id)}" ${justPassed?'data-just-passed="true"':''} ${unlocked?'':'disabled'} aria-label="Daily ${getDailyOfSet(s)}"><span class="daily-node-num">${doneIcon||mascot||String(getDailyOfSet(s)).padStart(2,'0')}</span><span class="daily-node-label">${label}</span></button>`;
    }).join('');
    return `<article class="daily-unit ${unitUnlocked?'unlocked':'locked'} ${isCurrent?'is-current':''}"><header class="daily-unit-head"><div><div class="eyebrow">UNIT ${String(u.unit).padStart(2,'0')}</div><b>${u.passed}/${u.total} daily đã pass</b></div><div class="daily-unit-progress"><span style="width:${unitProg}%"></span></div></header><div class="daily-unit-path">${nodes||'<div class="muted small">Chưa có daily</div>'}</div></article>`;
  }).join('');
  root.innerHTML=`<div class="head"><div><div class="eyebrow">DAILY ENGLISH · 11T1</div><h2>🎯 Daily Set</h2><p>Học theo lộ trình <b>Unit → Daily</b>. Pass Daily trong Unit để mở Daily kế tiếp; pass hết Unit sẽ mở Unit tiếp theo.</p></div><div class="daily-head-actions"><span class="live-sync-badge" id="dailyLiveStatus">🟡 Đang đồng bộ…</span><div class="daily-streak" id="dailyStreak">🔥 …</div></div></div><div class="daily-progress"><div><b>${totalPassed}/${totalSets}</b> daily đã pass</div><div class="progress"><div class="progress-bar" style="width:${totalSets?Math.round(totalPassed/totalSets*100):0}%"></div></div></div><div class="daily-units">${unitHtml||'<div class="empty"><h4>Chưa có Unit nào</h4><p>Admin hãy tạo Daily Set trong Dashboard.</p></div>'}</div><div id="dailyWork" class="mt-4"></div>`;
  root.querySelectorAll('[data-set-id]:not([disabled])').forEach(b=>b.onclick=()=>_dpOpen(b.dataset.setId));
  window._dailyJustPassedId=null;
  const el=document.getElementById('dailyStreak');if(el)el.textContent=`🔥 ${progress.streak} ngày`;
}
async function openSet(id){
  const set=currentSets.find(x=>x.id===id);if(!set)return;
  const passed=await passedSetIds();
  if(!unlockedFor(set,passed)){
    toast('Daily này chưa mở. Hãy hoàn thành các Daily trước theo lộ trình.','error');
    return;
  }
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
  selectedSet=set;answers={};submitting=false;_openExamOverlay();renderSetQuestion();
}
function normalizeText(s){return String(s??'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ')}
function renderSetQuestion(){
  if(!selectedSet)return;
  const ov=document.getElementById('dailyExamOverlay');
  if(!ov||!ov.classList.contains('is-open'))_openExamOverlay();
  const root=document.getElementById('dailyExamBody');
  if(!root)return;
  const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];
  const i=Object.keys(answers).length;
  const idx=Math.min(i,qs.length-1);
  const q=qs[idx];
  if(!q)return;
  // Cập nhật thanh tiến độ + đếm câu
  const bar=document.getElementById('dailyExamProgressBar');
  if(bar)bar.style.width=Math.round(((idx+1)/qs.length)*100)+'%';
  const counter=document.getElementById('dailyExamCounter');
  if(counter)counter.textContent=`${idx+1}/${qs.length}`;
  const kind=String(q.kind||'mcq');
  const opts=Array.isArray(q.options)?q.options:[];
  let body='';
  if(kind==='form'||kind==='rewrite'){
    body=`<input id="dailyText" class="form-control form-control-lg" placeholder="${kind==='form'?'Nhập dạng đúng…':'Viết lại câu…'}" autocomplete="off">`;
  }else{
    body=`<div class="option-grid">${opts.map((o,j)=>`<label class="exercise-option"><input type="radio" name="dailyAnswer" value="${j}"><span><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</span></label>`).join('')}</div>`;
  }
  root.innerHTML=`<div class="daily-question">
    <div class="d-flex justify-content-between gap-3 flex-wrap align-items-center">
      <span class="tag">${esc(selectedSet.title||'Daily Set')}</span>
      <b>Câu ${idx+1}/${qs.length}</b>
    </div>
    <h3>${idx+1}. ${esc(q.prompt||'Câu hỏi')}</h3>
    ${body}
    <div class="d-flex justify-content-between mt-4 exercise-nav">
      <button id="dailyCancel" class="btn btn-outline-secondary">← Thoát</button>
      <button id="dailyNext" class="btn btn-primary">${idx===qs.length-1?'Nộp bài':'Tiếp →'}</button>
    </div>
  </div>`;
  document.getElementById('dailyCancel').onclick=()=>{if(window.confirm('Thoát bài làm? Tiến độ chưa nộp sẽ bị mất.'))_closeExamOverlay()};
  document.getElementById('dailyNext').onclick=saveCurrentAnswer;
}
function saveCurrentAnswer(){
  const btn=document.getElementById('dailyNext');if(btn?.disabled)return;if(btn)btn.disabled=true;
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];const idx=Object.keys(answers).length;if(idx<0||idx>=qs.length)return;const q=qs[idx];let val='';if(q.kind==='form'||q.kind==='rewrite')val=document.getElementById('dailyText')?.value||'';else val=document.querySelector('input[name="dailyAnswer"]:checked')?.value||'';if(!String(val).trim()){if(btn)btn.disabled=false;toast('Hãy trả lời câu này trước.','error');return}answers[idx]=val;if(idx===qs.length-1)submitSet();else renderSetQuestion();
}
export async function submitSet(){
  if(submitting||!currentUser||!selectedSet)return;
  submitting=true;
  try{
    const setId=String(selectedSet.id);
    const scheduleSnap=await getDoc(doc(db,'sets',setId));
    if(!scheduleSnap.exists())throw new Error('Bài tập không còn tồn tại.');
    const currentSet=scheduleSnap.data()||{};
    const schedule=getSetScheduleState(currentSet);
    if(schedule.state==='upcoming')throw new Error(`Bài chưa mở. Bắt đầu: ${formatScheduleDate(schedule.start)}`);
    if(schedule.state==='closed')throw new Error(`Đã hết hạn nộp bài (${formatScheduleDate(schedule.end)}).`);
    const duration=getSetDurationMinutes(currentSet);
    if(duration>0&&window._dailySetStartedAt){
      const elapsed=(Date.now()-window._dailySetStartedAt)/60000;
      if(elapsed>=duration)throw new Error('Đã hết thời gian làm bài.');
    }
    const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];let score=0;
    qs.forEach((q,i)=>{const val=answers[i];const ci=decodeCorrectIndex(String(q?.correctCode||''));if(q?.kind==='form'||q?.kind==='rewrite'){if(normalizeText(val)===normalizeText(q?.answer||''))score++;}else if(Number(val)===ci)score++});
    const date=today();const total=qs.length;const required=Math.max(1,Math.min(total,Number(selectedSet?.passScore)||Math.ceil(total*0.75)));const passed=score>=required;
    const userRef=doc(db,'users',currentUser.uid),userSnap=await getDoc(userRef);if(!userSnap.exists())throw new Error('Hồ sơ học sinh không tồn tại.');
    const profile=userSnap.data()||{};
    const historySnap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));
    const firstPass=!historySnap.docs.some(d=>{const x=d.data()||{};return isPassedValue(x.passed)&&String(x.setId||'')===setId});
    const bonusPoints=passed&&firstPass?2:0;
    const previousProgress=getProgressForUid(historySnap.docs,currentUser.uid);
    const oldStreak=Number(previousProgress.streak||0);const last=String(previousProgress.lastCompletedDate||'');let streak=oldStreak;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const y=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    if(passed&&firstPass){streak=last===date?oldStreak:last===y?oldStreak+1:1}
    const ref=doc(db,'submissions',`${currentUser.uid}_${date}_${setId}`);
    const existing=await getDoc(ref);if(existing.exists()){toast('Bạn đã nộp Set này hôm nay.','error');return}
    await setDoc(ref,{uid:currentUser.uid,name:String(profile.name||currentUser.displayName||'Tài khoản'),className:String(profile.className||'11T1'),setId:selectedSet.id,score,total,passScore:required,passed,bonusPoints,submittedAt:serverTimestamp(),date,streakAtSubmission:streak});
    _passedCache=null;
    if(passed&&firstPass){
      try{
        const latest=getProgressForUid((await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)))).docs,currentUser.uid);
        await setDoc(userRef,{lastCompletedDate:latest.lastCompletedDate,streak:latest.streak,totalSetsCompleted:latest.totalPassed,totalBonusPoints:latest.totalBonus},{merge:true});
      }catch(summaryError){console.warn('Đã lưu submission nhưng chưa cập nhật summary users:',summaryError)}
    }
    window._dailySetStartedAt=null;
    if(window._dailySetTimerInterval){clearInterval(window._dailySetTimerInterval);window._dailySetTimerInterval=null;}
    document.getElementById('daily-set-countdown')?.remove();
    if(passed&&firstPass)window._dailyJustPassedId=selectedSet.id;
    rootResult(score,passed,streak);
  }catch(e){console.error('Lỗi nộp Daily Set:',e);toast(e.message||'Không thể nộp bài. Vui lòng thử lại.','error')}
  finally{submitting=false}
}
function rootResult(score,passed,streak){
  const root=document.getElementById('dailyExamBody');if(!root)return;
  const bar=document.getElementById('dailyExamProgressBar');if(bar)bar.style.width='100%';
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];
  const review=qs.map((q,i)=>{const val=String(answers[i]??'');const ci=decodeCorrectIndex(String(q?.correctCode||''));const correct=(q?.kind==='form'||q?.kind==='rewrite')?String(q?.answer||''):(Number.isInteger(ci)&&Array.isArray(q?.options)?`${String.fromCharCode(65+ci)}. ${q.options[ci]??''}`:'');const yours=(q?.kind==='form'||q?.kind==='rewrite')?val:(val!==''&&Array.isArray(q?.options)?`${String.fromCharCode(65+Number(val))}. ${q.options[Number(val)]??''}`:'Chưa trả lời');const ok=(q?.kind==='form'||q?.kind==='rewrite')?normalizeText(val)===normalizeText(q?.answer||''):Number(val)===ci;return `<div class="daily-review-row ${ok?'is-correct':'is-wrong'}"><b>Câu ${i+1}</b><span>${ok?'✓':'✗'} Bạn: ${esc(yours)}</span>${ok?'':'<span>Đúng: '+esc(correct)+'</span>'}</div>`}).join('');
  root.innerHTML=`<div class="panel daily-result"><div class="result-icon">${passed?'🏆':'📚'}</div><h2>${score}/${qs.length}</h2><p>${passed?'Đạt — Set tiếp theo đã được mở.':'Chưa đạt — bạn có thể xem lại kiến thức và thử lại Set này vào ngày mai.'}<br><span class="muted">Điều kiện đạt: <b>${Math.max(1,Math.min(qs.length,Number(selectedSet?.passScore)||Math.ceil(qs.length*0.75)))}/${qs.length}</b> câu đúng</span></p><div class="streak-result">🔥 Streak: <b>${streak}</b> ngày ${passed?'<span class="text-success"> · +2 điểm (lần pass đầu tiên của Set)</span>':''}</div><details class="daily-answer-review mt-4 text-start"><summary><b>Xem lại đáp án</b></summary><div class="daily-review-list mt-3">${review}</div></details><button id="dailyBack" class="btn btn-primary mt-3">← Về Daily Set</button></div>`;document.getElementById('dailyBack').onclick=()=>{_closeExamOverlay()}}
initDailySet();

// ===== Full-screen exam overlay =====
function _ensureExamOverlay(){
  let el=document.getElementById('dailyExamOverlay');
  if(el)return el;
  el=document.createElement('div');
  el.id='dailyExamOverlay';
  el.className='daily-exam-overlay';
  el.innerHTML=`
    <div class="daily-exam-top">
      <button class="daily-exam-close" id="dailyExamClose" type="button" aria-label="Đóng bài làm">×</button>
      <div class="daily-exam-progress"><span id="dailyExamProgressBar"></span></div>
      <div class="daily-exam-counter" id="dailyExamCounter">0/0</div>
    </div>
    <div class="daily-exam-body" id="dailyExamBody"></div>`;
  document.body.appendChild(el);
  el.querySelector('#dailyExamClose').onclick=_closeExamOverlay;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&el.classList.contains('is-open')){
      if(window.confirm('Thoát bài làm? Tiến độ chưa nộp sẽ bị mất.'))_closeExamOverlay();
    }
  });
  return el;
}
function _openExamOverlay(){
  const el=_ensureExamOverlay();
  el.classList.add('is-open');
  document.body.classList.add('daily-exam-open');
}
function _closeExamOverlay(){
  if(window._dailySetTimerInterval){clearInterval(window._dailySetTimerInterval);window._dailySetTimerInterval=null;}
  window._dailySetTimerEnd=null;
  document.getElementById('daily-set-countdown')?.remove();
  const el=document.getElementById('dailyExamOverlay');
  el?.classList.remove('is-open');
  document.body.classList.remove('daily-exam-open');
  selectedSet=null;answers={};
  renderDailySetPage();
}

// ===== Popup preview khi bấm node Daily =====
let _dpEl=null;
function _dpEnsure(){
  if(_dpEl)return _dpEl;
  const bd=document.createElement('div');
  bd.className='daily-popup-backdrop';bd.id='dailyPopupBackdrop';
  const pp=document.createElement('div');
  pp.className='daily-popup';pp.id='dailyPopup';
  pp.innerHTML=`
    <button class="daily-popup-close" id="dailyPopupClose" aria-label="Đóng">×</button>
    <div class="daily-popup-mascot">
      <img src="./img/roach.png" alt="" loading="lazy"
           onerror="this.parentElement.innerHTML='<span style=&quot;font-size:64px&quot;>🪳</span>'">
    </div>
    <div class="daily-popup-eyebrow" id="dailyPopupEyebrow"></div>
    <h3 class="daily-popup-title" id="dailyPopupTitle"></h3>
    <p class="daily-popup-meta" id="dailyPopupMeta"></p>
    <button class="daily-popup-start" id="dailyPopupStart">BẮT ĐẦU</button>
    <button class="daily-popup-skip" id="dailyPopupSkip">Để sau</button>`;
  document.body.appendChild(bd);document.body.appendChild(pp);
  pp.querySelector('#dailyPopupClose').onclick=_dpClose;
  pp.querySelector('#dailyPopupSkip').onclick=_dpClose;
  bd.onclick=_dpClose;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&pp.classList.contains('is-open'))_dpClose();
  });
  _dpEl={bd,pp};return _dpEl;
}
function _dpClose(){
  if(!_dpEl)return;
  _dpEl.bd.classList.remove('is-open');
  _dpEl.pp.classList.remove('is-open');
  document.body.classList.remove('daily-popup-open');
}
async function _dpOpen(setId){
  const set=currentSets.find(x=>x.id===String(setId));
  if(!set)return;
  const {bd,pp}=_dpEnsure();
  const passed=await passedSetIds();
  const done=passed.has(String(setId));
  const unit=getUnitOfSet(set),daily=getDailyOfSet(set);
  const total=Array.isArray(set.questions)?set.questions.length:0;
  const required=Math.max(1,Math.min(total,Number(set.passScore)||Math.ceil(total*0.75)));

  pp.querySelector('#dailyPopupEyebrow').textContent=
    `UNIT ${String(unit).padStart(2,'0')} · DAILY ${String(daily).padStart(2,'0')}`;
  pp.querySelector('#dailyPopupTitle').textContent=
    String(set.title||`Daily ${String(daily).padStart(2,'0')}`);
  pp.querySelector('#dailyPopupMeta').textContent=done
    ? `Đã hoàn thành · ${total} câu`
    : `${total} câu · đạt ${required}/${total}`;

  const start=pp.querySelector('#dailyPopupStart');
  start.textContent=done?'XEM LẠI':'BẮT ĐẦU';
  start.onclick=()=>{_dpClose();openSet(setId)};

  requestAnimationFrame(()=>{
    bd.classList.add('is-open');
    pp.classList.add('is-open');
    document.body.classList.add('daily-popup-open');
  });
}
