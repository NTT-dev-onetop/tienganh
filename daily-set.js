import{getProgressForUid}from"./progress.js";
import{tr,getLang}from"./i18n.js";

function startDailySetCountdown(set) {
  const minutes = getSetDurationMinutes(set);
  if (!minutes) return;

  const startedAt=Number(window._dailySetStartedAt||0)||Date.now();
  window._dailySetStartedAt=startedAt;
  const endMs = startedAt + minutes * 60 * 1000;
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

      const next=document.getElementById('dailyNext');
      if(next)next.disabled=true;
      toast(tr('Đã hết thời gian làm bài. Lượt nộp đã bị khóa.','Time expired. Submission is locked.'),'error');
    }
  };

  render();
  window._dailySetTimerInterval = setInterval(render, 500);
}

import{collection,doc,getDoc,setDoc,updateDoc,query,where,getDocs,onSnapshot,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{auth,db}from"./firebase-services.js";
import{decodeCorrectIndex}from"./security.js";

let currentUser=null,currentSets=[],selectedSet=null,answers={},dailyQuestionIndex=0,submitting=false,stopSets=null,stopProgress=null,_passedCache=null,lastResult=null;
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg,type='success')=>window.appToast?window.appToast(msg,type):undefined;
const isPassedValue=v=>v===true||v===1||String(v).toLowerCase()==='true'||String(v).toLowerCase()==='passed';
const dailyAttemptKey=(uid,setId,date=today())=>`englishNotebook.dailyAttempt.${String(uid||'')}.${String(date)}.${String(setId||'')}`;
const readDailyAttemptStartedAt=(uid,setId)=>{try{const n=Number(localStorage.getItem(dailyAttemptKey(uid,setId)));return Number.isFinite(n)&&n>0?n:0}catch{return 0}};
const writeDailyAttemptStartedAt=(uid,setId,startedAt)=>{try{localStorage.setItem(dailyAttemptKey(uid,setId),String(startedAt))}catch{}};
const clearDailyAttemptStartedAt=(uid,setId)=>{try{localStorage.removeItem(dailyAttemptKey(uid,setId))}catch{}};

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
  return d.toLocaleString(getLang() === 'en' ? 'en-US' : 'vi-VN', {
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
  }catch(e){console.error('Không tải được Daily Set:',e);toast(tr('Không tải được bộ đề. Kiểm tra Firestore.','Could not load Daily Sets. Check Firestore.'),'error')}
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
    if(el)el.textContent=`🔥 ${p.streak} ${tr('ngày','days')}`;
    const live=document.getElementById('dailyLiveStatus');if(live){live.textContent=tr('🟢 Cập nhật thời gian thực','🟢 Live sync');live.classList.remove('is-offline')}
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
    if(live){live.textContent=tr('🟢 Cập nhật thời gian thực','🟢 Live sync');live.classList.remove('is-offline')}
    if(!selectedSet&&!document.querySelector('#daily .daily-node'))renderDailySetPage();
  },e=>{
    console.error('Realtime Daily Set:',e);
    const live=document.getElementById('dailyLiveStatus');
    if(live){live.textContent=tr('🟠 Đang chờ kết nối','🟠 Connecting…');live.classList.add('is-offline')}
  });
}
export async function initDailySet(){onAuthStateChanged(auth,async u=>{currentUser=u;_passedCache=null;if(stopSets){stopSets();stopSets=null}if(stopProgress){stopProgress();stopProgress=null}if(!u){currentSets=[];selectedSet=null;renderDailySetPage();return}await loadSets();watchSetsRealtime();watchStudentProgress()})}
export async function renderDailySetPage(){
  const root=document.getElementById('daily');if(!root)return;
  if(!currentUser){root.innerHTML=`<div class="empty"><div>🔒</div><h3>${tr('Đăng nhập để làm Daily Set','Sign in to access Daily Set')}</h3></div>`;return}
  let submissionDocs=[];
  try{const snap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));submissionDocs=snap.docs}catch(e){console.error('Không đọc được lịch sử Daily Set:',e);toast(tr('Không đồng bộ được tiến độ Daily.','Could not sync Daily progress.'),'error')}
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
      const label=done?'✓':(unlocked?tr('BẮT ĐẦU','START'):'🔒');
      const mascot=unlocked&&!done?`<img class="daily-node-mascot" src="./img/roach.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"> <span class="daily-node-fallback" style="display:none" aria-hidden="true">🪳</span>`:'';
      const doneIcon=done?'<span class="daily-node-check" aria-hidden="true">✓</span>':'';
      const justPassed=done&&String(window._dailyJustPassedId||'')===String(s.id);
      return `<button class="daily-node ${state}" data-set-id="${esc(s.id)}" ${justPassed?'data-just-passed="true"':''} ${unlocked?'':'disabled'} aria-label="Daily ${getDailyOfSet(s)}"><span class="daily-node-num">${doneIcon||mascot||String(getDailyOfSet(s)).padStart(2,'0')}</span><span class="daily-node-label">${label}</span></button>`;
    }).join('');
    return `<article class="daily-unit ${unitUnlocked?'unlocked':'locked'} ${isCurrent?'is-current':''}"><header class="daily-unit-head"><div><div class="eyebrow">UNIT ${String(u.unit).padStart(2,'0')}</div><b>${u.passed}/${u.total} ${tr('daily đã pass','daily passed')}</b></div><div class="daily-unit-progress"><span style="width:${unitProg}%"></span></div></header><div class="daily-unit-path">${nodes||`<div class="muted small">${tr('Chưa có daily','No daily sets')}</div>`}</div></article>`;
  }).join('');
  // ── Dữ liệu cho sidebar phải ──
  const todayStr = today();
  const passedToday = submissionDocs.filter(d=>{
    const x = d.data()||{};
    return String(x.date||'')===todayStr && isPassedValue(x.passed);
  }).length;
  const perfectToday = submissionDocs.filter(d=>{
    const x = d.data()||{};
    return String(x.date||'')===todayStr && isPassedValue(x.passed) && Number(x.score)>=Number(x.total);
  }).length;
  const todayDone = String(progress.lastCompletedDate||'')===todayStr ? 1 : 0;
  const currentUnit = unitStats[currentUnitIdx] || unitStats[0];
  const unitNo = String(currentUnit?.unit || 1).padStart(2,'0');
  const clsName = document.getElementById('profileClass')?.textContent?.trim();
  const classTag = clsName ? `${tr('LỚP','CLASS')} ${esc(clsName)}` : tr('11T1 & 11.1','11T1 & 11.1');

  root.innerHTML = `
  <div class="duo-layout">
    <div class="duo-main">
      <div class="duo-unit-banner">
        <div class="duo-unit-info">
          <div class="duo-unit-eyebrow">UNIT ${unitNo} · ${classTag}</div>
          <div class="duo-unit-title">Daily English · Unit ${currentUnit?.unit || 1}</div>
        </div>
        <div class="duo-unit-actions">
          <span class="live-sync-badge" id="dailyLiveStatus">${tr('🟡 Đang đồng bộ…','🟡 Syncing…')}</span>
          <div class="daily-streak" id="dailyStreak">🔥 …</div>
        </div>
      </div>

      <div class="duo-progress-strip">
        <div class="duo-progress-bar"><span style="width:${totalSets?Math.round(totalPassed/totalSets*100):0}%"></span></div>
        <div class="duo-progress-label"><b>${totalPassed}/${totalSets}</b>&nbsp;${tr('daily đã pass','daily passed')}</div>
      </div>

      <div class="daily-units">${unitHtml||`<div class="empty"><h4>${tr('Chưa có Unit nào','No Units yet')}</h4><p>${tr('Admin hãy tạo Daily Set trong Dashboard.','Teachers can create Daily Sets in Dashboard.')}</p></div>`}</div>
      <div id="dailyWork" class="mt-4"></div>
    </div>

    <aside class="duo-side">
      <div class="duo-card duo-trial">
        <div class="duo-trial-emoji">🔥</div>
        <div>
          <b style="font-size:15px">Streak ${progress.streak} ${tr('ngày','days')}</b>
          <div class="duo-muted">${tr('Học mỗi ngày để giữ chuỗi','Study daily to keep your streak')}</div>
        </div>
      </div>

      <div class="duo-card">
        <div class="duo-card-head"><b>${tr('Tiến độ tổng','Overall Progress')}</b></div>
        <div class="duo-stat">
          <span class="duo-stat-ic">⭐</span>
          <div>
            <div class="duo-stat-value">${totalPassed} / ${totalSets}</div>
            <div class="duo-muted">${tr('Daily Set đã pass','Daily Sets Passed')}</div>
          </div>
        </div>
        <div class="duo-stat">
          <span class="duo-stat-ic">📚</span>
          <div>
            <div class="duo-stat-value">${Number(progress.totalBonus||0)} ${tr('điểm','pts')}</div>
            <div class="duo-muted">${tr('Bonus tích lũy','Total Bonus')}</div>
          </div>
        </div>
      </div>

      <div class="duo-card">
        <div class="duo-card-head"><b>${tr('Nhiệm vụ hằng ngày','Daily Quests')}</b></div>
        <div class="duo-quest">
          <span class="duo-quest-ic">⚡</span>
          <div class="duo-quest-body">
            <div class="duo-quest-title">${tr('Hoàn thành 1 Daily hôm nay','Complete 1 Daily today')}</div>
            <div class="duo-quest-track"><span style="width:${Math.min(100,passedToday*100)}%"></span></div>
            <div class="duo-quest-num">${passedToday} / 1</div>
          </div>
        </div>
        <div class="duo-quest">
          <span class="duo-quest-ic">🔥</span>
          <div class="duo-quest-body">
            <div class="duo-quest-title">${tr('Giữ streak hôm nay','Keep streak today')}</div>
            <div class="duo-quest-track"><span style="width:${todayDone*100}%"></span></div>
            <div class="duo-quest-num">${todayDone} / 1</div>
          </div>
        </div>
        <div class="duo-quest">
          <span class="duo-quest-ic">🎯</span>
          <div class="duo-quest-body">
            <div class="duo-quest-title">${tr('Điểm tuyệt đối 1 Daily','Perfect score on 1 Daily')}</div>
            <div class="duo-quest-track"><span style="width:${Math.min(100,perfectToday*100)}%"></span></div>
            <div class="duo-quest-num">${perfectToday} / 1</div>
          </div>
        </div>
      </div>
    </aside>
  </div>`;

  root.querySelectorAll('[data-set-id]:not([disabled])').forEach(b=>b.onclick=()=>_dpOpen(b.dataset.setId));
  window._dailyJustPassedId=null;
  const el=document.getElementById('dailyStreak');if(el)el.textContent=`🔥 ${progress.streak} ${tr('ngày','days')}`;

  // Nếu Daily đang được hiển thị (ví dụ user F5 khi đang ở trang Daily),
  // tự cuộn tới bài cần làm ngay sau khi render xong.
  if(!root.classList.contains('d-none')) setTimeout(_scrollToCurrentDailyTarget, 60);
}

async function openSet(id){
  const set=currentSets.find(x=>x.id===id);if(!set)return;
  const passed=await passedSetIds();
  if(!unlockedFor(set,passed)){
    toast(tr('Daily này chưa mở. Hãy hoàn thành các Daily trước theo lộ trình.','This Daily is locked. Complete earlier sets in order.'),'error');
    return;
  }
  // Schedule gate: start/end times are authoritative for the student UI.
  // The final submit is checked again below, so an expired attempt cannot be submitted.
  const schedule = getSetScheduleState(set);
  if (schedule.state === 'upcoming') {
    toast(tr(`Bài chưa mở. Bắt đầu: ${formatScheduleDate(schedule.start)}`,`Not open yet. Opens: ${formatScheduleDate(schedule.start)}`),'error');
    return;
  }
  if (schedule.state === 'closed') {
    toast(tr(`Bài đã đóng. Hạn chót: ${formatScheduleDate(schedule.end)}`,`Closed. Deadline: ${formatScheduleDate(schedule.end)}`),'error');
    return;
  }
  const questions=Array.isArray(set.questions)?set.questions:[];if(!questions.length){toast(tr('Set này chưa có câu hỏi.','This Set has no questions yet.'),'error');return}
  const date=today();
  try{
    const existing=await getDoc(doc(db,'submissions',`${currentUser.uid}_${date}_${id}`));
    if(existing.exists()){clearDailyAttemptStartedAt(currentUser.uid,id);toast(tr('Bạn đã nộp Set này hôm nay.','You already submitted this Set today.'),'error');return}
  }catch(e){console.error('Không kiểm tra được submission:',e);toast(tr('Không thể kiểm tra lượt làm.','Could not verify attempt status.'),'error');return}
  const duration=getSetDurationMinutes(set);
  const storedStartedAt=duration>0?readDailyAttemptStartedAt(currentUser.uid,id):0;
  const startedAt=storedStartedAt||Date.now();
  if(duration>0&&Date.now()-startedAt>=duration*60*1000){clearDailyAttemptStartedAt(currentUser.uid,id);toast(tr('Lượt làm này đã hết thời gian. Vui lòng chờ lượt tiếp theo.','Attempt time expired. Please try again later.'),'error');return}
  window._dailySetStartedAt=startedAt;
  window._dailySetDurationMinutes=duration;
  if(duration>0)writeDailyAttemptStartedAt(currentUser.uid,id,startedAt);
  startDailySetCountdown(set);
  lastResult=null;selectedSet=set;answers={};dailyQuestionIndex=0;submitting=false;_openExamOverlay();renderSetQuestion();
}
function normalizeText(s){return String(s??'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ')}
function getDailyAnswerValue(q){
  if(q?.kind==='form'||q?.kind==='rewrite')return document.getElementById('dailyText')?.value||'';
  return document.querySelector('input[name="dailyAnswer"]:checked')?.value||'';
}
function dailySlide(direction='next'){
  const current=document.querySelector('.daily-question');
  if(current&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){current.classList.remove('is-leaving','is-entering-prev');current.classList.add(direction==='prev'?'is-leaving-prev':'is-leaving');setTimeout(renderSetQuestion,180)}else renderSetQuestion();
}
function renderSetQuestion(){
  if(!selectedSet)return;
  const ov=document.getElementById('dailyExamOverlay');
  if(!ov||!ov.classList.contains('is-open'))_openExamOverlay();
  const root=document.getElementById('dailyExamBody');if(!root)return;
  const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];const idx=Math.max(0,Math.min(dailyQuestionIndex,qs.length-1));dailyQuestionIndex=idx;const q=qs[idx];if(!q)return;
  const bar=document.getElementById('dailyExamProgressBar');if(bar)bar.style.width=Math.round(((idx+1)/qs.length)*100)+'%';
  const counter=document.getElementById('dailyExamCounter');if(counter)counter.textContent=`${idx+1}/${qs.length}`;
  const kind=String(q.kind||'mcq');const opts=Array.isArray(q.options)?q.options:[];let body='';
  if(kind==='form'||kind==='rewrite')body=`<input id="dailyText" class="form-control form-control-lg" placeholder="${kind==='form'?tr('Nhập dạng đúng…','Enter the correct form…'):tr('Viết lại câu…','Rewrite the sentence…')}" autocomplete="off" value="${esc(answers[idx]||'')}">`;
  else body=`<div class="option-grid">${opts.map((o,j)=>`<label class="exercise-option"><input type="radio" name="dailyAnswer" value="${j}" ${String(answers[idx])===String(j)?'checked':''}><span><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</span></label>`).join('')}</div>`;
  root.innerHTML=`<div class="daily-question">
    <div class="d-flex justify-content-between gap-3 flex-wrap align-items-center"><span class="tag">${esc(selectedSet.title||'Daily Set')}</span><b>${tr('Câu','Question')} ${idx+1}/${qs.length}</b></div>
    <h3>${idx+1}. ${esc(q.prompt||tr('Câu hỏi','Question'))}</h3>${body}
    <div class="d-flex justify-content-between mt-4 exercise-nav">
      <button id="dailyPrev" class="btn btn-outline-secondary" ${idx===0?'disabled':''}>${tr('← Trước','← Prev')}</button>
      <button id="dailyNext" class="btn btn-primary">${idx===qs.length-1?tr('Nộp bài','Submit'):tr('Tiếp →','Next →')}</button>
    </div>
  </div>`;
  const prev=document.getElementById('dailyPrev');prev?.addEventListener('click',()=>{if(idx>0){dailyQuestionIndex=idx-1;dailySlide('prev')}});
  document.getElementById('dailyNext').onclick=saveCurrentAnswer;
  const current=document.querySelector('.daily-question');current?.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{answers[idx]=getDailyAnswerValue(q);const c=document.getElementById('dailyExamCounter');if(c)c.textContent=`${idx+1}/${qs.length}`;}));
  current?.querySelector('#dailyText')?.addEventListener('input',()=>{answers[idx]=getDailyAnswerValue(q);const c=document.getElementById('dailyExamCounter');if(c)c.textContent=`${idx+1}/${qs.length}`;});
  let touchStartX=0;current?.addEventListener('touchstart',e=>{touchStartX=e.touches[0]?.clientX||0},{passive:true});current?.addEventListener('touchend',e=>{const endX=e.changedTouches[0]?.clientX||0;const dx=endX-touchStartX;if(Math.abs(dx)<60||submitting)return;if(dx<0)saveCurrentAnswer();else if(idx>0){dailyQuestionIndex=idx-1;dailySlide('prev')}},{passive:true});
}
function saveCurrentAnswer(){
  const btn=document.getElementById('dailyNext');if(btn?.disabled)return;if(btn)btn.disabled=true;
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];const idx=dailyQuestionIndex;if(idx<0||idx>=qs.length){if(btn)btn.disabled=false;return}const q=qs[idx];const val=getDailyAnswerValue(q);
  if(!String(val).trim()){if(btn)btn.disabled=false;toast(tr('Hãy trả lời câu này trước.','Please answer this question first.'),'error');return}
  answers[idx]=val;
  if(idx===qs.length-1){
    submitSet().catch(e=>{console.error('Lỗi nộp Daily:',e);toast(e?.message||tr('Không thể nộp bài.','Could not submit.'),'error')}).finally(()=>{
      if(btn&&idx===qs.length-1)btn.disabled=false;
    });
  }else{dailyQuestionIndex=idx+1;dailySlide('next')}
}
function handleDailyExamKeydown(e){
  const overlay=document.getElementById('dailyExamOverlay');if(!overlay?.classList.contains('is-open')||e.defaultPrevented)return;
  if(e.key==='Escape')return;
  const tag=e.target?.tagName?.toLowerCase();if(tag==='input'&&e.target.type==='text'&&e.key!=='Enter')return;
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];const idx=dailyQuestionIndex;const q=qs[idx];
  if(/^[1-4]$/.test(e.key)&&q&&!(q.kind==='form'||q.kind==='rewrite')){const n=Number(e.key)-1;document.querySelectorAll('input[name="dailyAnswer"]')[n]?.click();e.preventDefault();return}
  if(/^[a-d]$/i.test(e.key)&&q&&!(q.kind==='form'||q.kind==='rewrite')){const n=e.key.toLowerCase().charCodeAt(0)-97;document.querySelectorAll('input[name="dailyAnswer"]')[n]?.click();e.preventDefault();return}
  if(e.key==='Enter'){e.preventDefault();document.getElementById('dailyNext')?.click()}
}
if(!window.__dailyKeyboardBound){document.addEventListener('keydown',handleDailyExamKeydown);window.__dailyKeyboardBound=true}
export async function submitSet(){
  if(submitting||!currentUser||!selectedSet)return;
  submitting=true;
  try{
    const setId=String(selectedSet.id);
    const scheduleSnap=await getDoc(doc(db,'sets',setId));
    if(!scheduleSnap.exists())throw new Error(tr('Bài tập không còn tồn tại.','This Set no longer exists.'));
    const currentSet=scheduleSnap.data()||{};
    const schedule=getSetScheduleState(currentSet);
    if(schedule.state==='upcoming')throw new Error(tr(`Bài chưa mở. Bắt đầu: ${formatScheduleDate(schedule.start)}`,`Not open yet. Opens: ${formatScheduleDate(schedule.start)}`));
    if(schedule.state==='closed')throw new Error(tr(`Đã hết hạn nộp bài (${formatScheduleDate(schedule.end)}).`,`Submission deadline passed (${formatScheduleDate(schedule.end)}).`));
    const duration=getSetDurationMinutes(currentSet);
    const persistedStartedAt=duration>0?readDailyAttemptStartedAt(currentUser.uid,setId):0;
    const startedAt=Number(window._dailySetStartedAt||persistedStartedAt||0);
    if(duration>0&&startedAt){
      const elapsed=(Date.now()-startedAt)/60000;
      if(elapsed>=duration)throw new Error(tr('Đã hết thời gian làm bài.','Attempt time expired.'));
    }
    const qs=Array.isArray(selectedSet.questions)?selectedSet.questions:[];let score=0;
    qs.forEach((q,i)=>{const val=answers[i];const ci=decodeCorrectIndex(String(q?.correctCode||''));if(q?.kind==='form'||q?.kind==='rewrite'){if(normalizeText(val)===normalizeText(q?.answer||''))score++;}else if(Number(val)===ci)score++});
    const date=today();const total=qs.length;const required=Math.max(1,Math.min(total,Number(selectedSet?.passScore)||Math.ceil(total*0.75)));const passed=score>=required;
    const userRef=doc(db,'users',currentUser.uid),userSnap=await getDoc(userRef);if(!userSnap.exists())throw new Error(tr('Hồ sơ học sinh không tồn tại.','Student profile not found.'));
    const profile=userSnap.data()||{};
    const historySnap=await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)));
    const firstPass=!historySnap.docs.some(d=>{const x=d.data()||{};return isPassedValue(x.passed)&&String(x.setId||'')===setId});
    const bonusPoints=passed&&firstPass?2:0;
    const previousProgress=getProgressForUid(historySnap.docs,currentUser.uid);
    const oldStreak=Number(previousProgress.streak||0);const last=String(previousProgress.lastCompletedDate||'');let streak=oldStreak;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const y=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    if(passed&&firstPass){streak=last===date?oldStreak:last===y?oldStreak+1:1}
    const ref=doc(db,'submissions',`${currentUser.uid}_${date}_${setId}`);
    const existing=await getDoc(ref);if(existing.exists()){toast(tr('Bạn đã nộp Set này hôm nay.','You already submitted this Set today.'),'error');return}
    await setDoc(ref,{uid:currentUser.uid,name:String(profile.name||currentUser.displayName||tr('Tài khoản','Account')),className:String(profile.className||'11T1'),setId:selectedSet.id,score,total,passScore:required,passed,bonusPoints,submittedAt:serverTimestamp(),date,streakAtSubmission:streak});
    _passedCache=null;
    if(passed&&firstPass){
      try{
        const latest=getProgressForUid((await getDocs(query(collection(db,'submissions'),where('uid','==',currentUser.uid)))).docs,currentUser.uid);
        await setDoc(userRef,{lastCompletedDate:latest.lastCompletedDate,streak:latest.streak,totalSetsCompleted:latest.totalPassed,totalBonusPoints:latest.totalBonus},{merge:true});
      }catch(summaryError){console.warn('Đã lưu submission nhưng chưa cập nhật summary users:',summaryError)}
    }
    clearDailyAttemptStartedAt(currentUser.uid,setId);
    window._dailySetStartedAt=null;
    if(window._dailySetTimerInterval){clearInterval(window._dailySetTimerInterval);window._dailySetTimerInterval=null;}
    document.getElementById('daily-set-countdown')?.remove();
    if(passed&&firstPass)window._dailyJustPassedId=selectedSet.id;
    if(!passed&&navigator.vibrate)navigator.vibrate(50);
    rootResult(score,passed,streak);
  }catch(e){console.error('Lỗi nộp Daily Set:',e);toast(e.message||tr('Không thể nộp bài. Vui lòng thử lại.','Could not submit. Please try again.'),'error')}
  finally{submitting=false}
}
function burstConfetti(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const pieces=[];const colors=['#58CC02','#FFC800','#1CB0F6','#FF4B4B'];
  for(let i=0;i<30;i++){const el=document.createElement('div');el.className='confetti';el.style.left='50%';el.style.top='45%';el.style.background=colors[i%colors.length];el.style.setProperty('--tx',`${(Math.random()-.5)*400}px`);el.style.setProperty('--ty',`${-Math.random()*300-100}px`);el.style.animationDelay=`${Math.random()*.2}s`;document.body.appendChild(el);pieces.push(el);setTimeout(()=>el.remove(),1500)}
}
function rootResult(score,passed,streak,skipConfetti=false){
  lastResult={score,passed,streak};
  if(passed&&!skipConfetti)burstConfetti();
  const root=document.getElementById('dailyExamBody');if(!root)return;
  const bar=document.getElementById('dailyExamProgressBar');if(bar)bar.style.width='100%';
  const qs=Array.isArray(selectedSet?.questions)?selectedSet.questions:[];
  const review=qs.map((q,i)=>{const val=String(answers[i]??'');const ci=decodeCorrectIndex(String(q?.correctCode||''));const correct=(q?.kind==='form'||q?.kind==='rewrite')?String(q?.answer||''):(Number.isInteger(ci)&&Array.isArray(q?.options)?`${String.fromCharCode(65+ci)}. ${q.options[ci]??''}`:'');const yours=(q?.kind==='form'||q?.kind==='rewrite')?val:(val!==''&&Array.isArray(q?.options)?`${String.fromCharCode(65+Number(val))}. ${q.options[Number(val)]??''}`:tr('Chưa trả lời','Not answered'));const ok=(q?.kind==='form'||q?.kind==='rewrite')?normalizeText(val)===normalizeText(q?.answer||''):Number(val)===ci;return `<div class="daily-review-row ${ok?'is-correct':'is-wrong'}"><b>${tr('Câu','Q')} ${i+1}</b><span>${ok?'✓':'✗'} ${tr('Bạn:','Yours:')} ${esc(yours)}</span>${ok?'':`<span>${tr('Đúng:','Correct:')} ${esc(correct)}</span>`}</div>`}).join('');
  root.innerHTML=`<div class="panel daily-result"><div class="result-icon">${passed?'🏆':'📚'}</div><h2>${score}/${qs.length}</h2><p>${passed?tr('Đạt — Set tiếp theo đã được mở.','Passed — the next Set is unlocked.'):tr('Chưa đạt — bạn có thể xem lại kiến thức và thử lại Set này vào ngày mai.','Not passed yet — review and retry tomorrow.')}<br><span class="muted">${tr('Điều kiện đạt:','Passing score:')} <b>${Math.max(1,Math.min(qs.length,Number(selectedSet?.passScore)||Math.ceil(qs.length*0.75)))}/${qs.length}</b> ${tr('câu đúng','correct')}</span></p><div class="streak-result">🔥 Streak: <b>${streak}</b> ${tr('ngày','days')} ${passed?`<span class="text-success"> · ${tr('+2 điểm (lần pass đầu tiên của Set)','+2 pts (first pass bonus)')}</span>`:''}</div><details class="daily-answer-review mt-4 text-start"><summary><b>${tr('Xem lại đáp án','Review answers')}</b></summary><div class="daily-review-list mt-3">${review}</div></details><button id="dailyBack" class="btn btn-primary mt-3">${tr('← Về Daily Set','← Back to Daily Sets')}</button></div>`;document.getElementById('dailyBack').onclick=()=>{_closeExamOverlay()}}
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
      <button class="daily-exam-close" id="dailyExamClose" type="button" aria-label="${tr('Đóng bài làm','Close quiz')}">×</button>
      <div class="daily-exam-progress"><span id="dailyExamProgressBar"></span></div>
      <div class="daily-exam-counter" id="dailyExamCounter">0/0</div>
    </div>
    <div class="daily-exam-body" id="dailyExamBody"></div>`;
  document.body.appendChild(el);
  el.querySelector('#dailyExamClose').onclick=()=>{
    const hasAnswers=Object.keys(answers||{}).some(k=>String(answers[k]??'').trim()!=='');
    if(hasAnswers){
      if(window.confirm(tr('Thoát bài làm? Tiến độ chưa nộp sẽ bị mất.','Exit quiz? Unsubmitted progress will be lost.')))_closeExamOverlay();
    }else _closeExamOverlay();
  };
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&el.classList.contains('is-open')){
      if(window.confirm(tr('Thoát bài làm? Tiến độ chưa nộp sẽ bị mất.','Exit quiz? Unsubmitted progress will be lost.')))_closeExamOverlay();
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
  if(currentUser&&selectedSet?.id)clearDailyAttemptStartedAt(currentUser.uid,selectedSet.id);
  selectedSet=null;answers={};lastResult=null;
  renderDailySetPage();
  setTimeout(()=>window.__scrollToCurrentDaily?.(),80);
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
    <button class="daily-popup-close" id="dailyPopupClose" aria-label="${tr('Đóng','Close')}">×</button>
    <div class="daily-popup-mascot">
      <img src="./img/roach.png" alt="" loading="lazy"
           onerror="this.parentElement.innerHTML='<span style=&quot;font-size:64px&quot;>🪳</span>'">
    </div>
    <div class="daily-popup-eyebrow" id="dailyPopupEyebrow"></div>
    <h3 class="daily-popup-title" id="dailyPopupTitle"></h3>
    <p class="daily-popup-meta" id="dailyPopupMeta"></p>
    <button class="daily-popup-start" id="dailyPopupStart">${tr('BẮT ĐẦU','START')}</button>
    <button class="daily-popup-skip" id="dailyPopupSkip">${tr('Để sau','Later')}</button>`;
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
    ? `${tr('Đã hoàn thành','Completed')} · ${total} ${tr('câu','Qs')}`
    : `${total} ${tr('câu','Qs')} · ${tr('đạt','pass')} ${required}/${total}`;

  const start=pp.querySelector('#dailyPopupStart');
  start.textContent=done?tr('XEM LẠI','REVIEW'):tr('BẮT ĐẦU','START');
  start.onclick=()=>{_dpClose();openSet(setId)};

  requestAnimationFrame(()=>{
    bd.classList.add('is-open');
    pp.classList.add('is-open');
    document.body.classList.add('daily-popup-open');
  });
}


// ===== Auto-scroll tới bài Daily cần làm khi mở trang =====
// Chỉ cuộn, KHÔNG đổi nội dung / logic / dữ liệu.
let _dailyAutoScrolled = false;

function _scrollToCurrentDailyTarget(){
  if(_dailyAutoScrolled) return;
  const root = document.getElementById('daily');
  if(!root || root.classList.contains('d-none')) return;

  // Ưu tiên: Unit hiện tại → Daily đang mở → Daily chưa disable đầu tiên
  const target =
    root.querySelector('.daily-unit.is-current') ||
    root.querySelector('.daily-node.open:not([disabled])') ||
    root.querySelector('.daily-node[data-set-id]:not([disabled])');
  if(!target) return;

  _dailyAutoScrolled = true;

  // 2 frame để chắc chắn layout đã xong, tránh bị scroll của page() ghi đè
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const offset = window.matchMedia('(max-width:991.98px)').matches ? 90 : 40;
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top: y, behavior: 'smooth' });
  }));
}

// app.js gọi khi user bấm vào mục "Daily Set"
window.__scrollToCurrentDaily = function(){
  _dailyAutoScrolled = false;
  // Thử 2 mốc: ngay sau khi đổi page, và sau khi mọi rAF/scroll của page() đã chạy
  setTimeout(_scrollToCurrentDailyTarget, 60);
  setTimeout(_scrollToCurrentDailyTarget, 280);
};

window.addEventListener('app:lang-change',()=>{
  const closeBtn=document.getElementById('dailyExamClose');
  if(closeBtn)closeBtn.setAttribute('aria-label',tr('Đóng bài làm','Close quiz'));
  if(_dpEl){
    _dpEl.pp.querySelector('#dailyPopupClose')?.setAttribute('aria-label',tr('Đóng','Close'));
    const skip=_dpEl.pp.querySelector('#dailyPopupSkip');
    if(skip)skip.textContent=tr('Để sau','Later');
  }
  renderDailySetPage();
  const ov=document.getElementById('dailyExamOverlay');
  if(ov?.classList.contains('is-open')&&selectedSet){
    if(lastResult)rootResult(lastResult.score,lastResult.passed,lastResult.streak,true);
    else renderSetQuestion();
  }
});
