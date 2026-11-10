const isPassedValue=v=>v===true||v===1||String(v).toLowerCase()==='true'||String(v).toLowerCase()==='passed';
import{collection,doc,getDoc,setDoc,updateDoc,deleteDoc,getDocs,query,where,onSnapshot,serverTimestamp,writeBatch}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{db}from"./firebase-services.js";
import{encodeCorrectIndex,decodeCorrectIndex,safeUrl}from"./security.js";
import{getCurrentRole,isStaffRole,OWNER_EMAIL,invalidateRoleCaches}from"./roles.js";
import{invalidateRosterCache,readRoster,removeDiacritics}from"./roster.js";
import{normalizeExerciseItem}from"./exercises.js";
import{progressFromSubmissionDocs}from"./progress.js";
import{tr,getLang}from"./i18n.js";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const DEFAULT_ROSTER=['Trần Diễm Linh Giang','Võ Hồ Minh Hằng','Nguyễn Anh Khôi','Huỳnh Nguyễn Ly Lam','Nguyễn Thị Ngọc Mỹ','Lê Bảo Ngọc','Phạm Minh Triết','Phan Trần Huỳnh Hương','Võ Mai Khánh','Nguyễn Trần Thùy Ngân','Nguyễn Thanh Sang','Phạm Nhật Trường','Nguyễn Dương Gia Nghi','Nguyễn Phúc Thịnh','Lê Nguyễn Trung Trực','Nguyễn Ngọc Bích Anh','Nguyễn Thùy Anh','Lê Ngọc Quốc Bảo','Huỳnh Lê Minh Đạt','Lê Minh Đạt','Lê Ngọc Bảo Hân','Trương Thị Kim Hân','Trần Huy Hoàng','Nguyễn Tuấn Huy','Nguyễn Đăng Khoa','Lê Nguyễn Hoàng Nam','Nguyễn Khánh Ngọc','Nguyễn Lê Hồng Ngọc','Nguyễn Vũ Bảo Ngọc','Bùi Ngọc An Nhi','Dương Ngọc Tâm Như','Nguyễn Tấn Phát','Trần Minh Phi','Nguyễn Ngọc Bích Phương','Phạm Hà Mai Quỳnh','Nguyễn Bùi Phúc Trí','Lê Nhã Thanh','Nguyễn Khánh Thi','Phạm Hoàng Thiên','Trần Thiện Tín','Phạm Ngọc Bảo Trân','Vĩnh Huỳnh Diễm Trinh','Lê Quốc Trọng','Võ Hoàng Trọng','Nguyễn Trung Trực'];
const toast=(m,t='success')=>window.appToast?window.appToast(m,t):undefined;
const appConfirm=(opts)=>window.appConfirm?window.appConfirm(opts):Promise.resolve(false);
const safeErr=(e,vi,en)=>window.appErrorMsg?window.appErrorMsg(e,vi,en):tr(vi,en);
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const isValidYouTubeInput=v=>{const s=String(v||'').trim();return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&/#]|$)/i.test(s)||/^[a-zA-Z0-9_-]{11}$/.test(s)};
let currentUser=null,sets=[],questions=[],knowledge=[],listenings=[],stopUsersProgress=null,rerenderUsers=null,langBound=false,exportControlsBound=false;
let overviewStats={totalStudents:0,count11T1:0,count11_1:0,activeToday:0,today11T1:0,today11_1:0,streakPositive:0,avgStreak:0};
const role=()=>getCurrentRole();
const admin=()=>!!currentUser&&role()==='admin';
const staff=()=>!!currentUser&&isStaffRole(role());

const EXPORT_CFG_KEY='english-notebook-export-cfg';
const DEFAULT_EXPORT_CFG={mode:'split',preset:'streak',filter:'all',sort:'stt'};
const VALID_EXPORT_MODES=new Set(['split','11T1','11.1','combined']);
const VALID_EXPORT_PRESETS=new Set(['streak','detailed','today']);
const VALID_EXPORT_FILTERS=new Set(['all','today','notToday','active','zero']);
const VALID_EXPORT_SORTS=new Set(['stt','name','streakDesc']);

function getExportConfig(){
  try{
    const raw=JSON.parse(localStorage.getItem(EXPORT_CFG_KEY)||'{}');
    return {
      mode:VALID_EXPORT_MODES.has(raw.mode)?raw.mode:DEFAULT_EXPORT_CFG.mode,
      preset:VALID_EXPORT_PRESETS.has(raw.preset)?raw.preset:DEFAULT_EXPORT_CFG.preset,
      filter:VALID_EXPORT_FILTERS.has(raw.filter)?raw.filter:DEFAULT_EXPORT_CFG.filter,
      sort:VALID_EXPORT_SORTS.has(raw.sort)?raw.sort:DEFAULT_EXPORT_CFG.sort
    };
  }catch{
    return {...DEFAULT_EXPORT_CFG};
  }
}
function saveExportConfig(cfg){
  const clean={
    mode:VALID_EXPORT_MODES.has(cfg?.mode)?cfg.mode:DEFAULT_EXPORT_CFG.mode,
    preset:VALID_EXPORT_PRESETS.has(cfg?.preset)?cfg.preset:DEFAULT_EXPORT_CFG.preset,
    filter:VALID_EXPORT_FILTERS.has(cfg?.filter)?cfg.filter:DEFAULT_EXPORT_CFG.filter,
    sort:VALID_EXPORT_SORTS.has(cfg?.sort)?cfg.sort:DEFAULT_EXPORT_CFG.sort
  };
  try{localStorage.setItem(EXPORT_CFG_KEY,JSON.stringify(clean))}catch{}
  syncExportSummaryUI();
  return clean;
}
function getExportPresetLabel(preset){
  if(preset==='detailed')return tr('Chi tiết','Detailed');
  if(preset==='today')return tr('Điểm danh hôm nay','Today Check');
  return 'Streak';
}
function getExportModePillLabel(mode){
  if(mode==='split')return tr('2 file','2 files');
  if(mode==='11T1')return '11T1';
  if(mode==='11.1')return '11.1';
  return tr('Gộp 1 file','Merged');
}
function syncExportSummaryUI(){
  const cfg=getExportConfig();
  const exportLbl=document.querySelector('#exportStreak [data-i18n="teacher.shell.exportBtn"]');
  if(exportLbl)exportLbl.textContent=tr('Xuất Word','Export Word');
  const pill=document.getElementById('exportModePill');
  if(pill)pill.textContent=getExportModePillLabel(cfg.mode);
  const chipText=document.getElementById('adminPresetChipText');
  if(chipText){
    const modeDesc=cfg.mode==='split'?tr('2 file riêng','2 separate files'):cfg.mode==='combined'?tr('Gộp 2 lớp','Merged'):tr(`Lớp ${cfg.mode}`,`Class ${cfg.mode}`);
    chipText.textContent=`${modeDesc} · ${getExportPresetLabel(cfg.preset)}`;
  }
}

function renderAdminOverview(){
  const host=document.getElementById('adminOverview');
  if(!host||!staff())return;
  const total=overviewStats.totalStudents;
  const count11T1=overviewStats.count11T1;
  const count11_1=overviewStats.count11_1;
  const todayCount=overviewStats.activeToday;
  const today11T1=overviewStats.today11T1;
  const today11_1=overviewStats.today11_1;
  const streakPos=overviewStats.streakPositive;
  const avgStreak=overviewStats.avgStreak;
  const pubSets=sets.filter(s=>s.published!==false).length;
  const pubKnowledge=knowledge.filter(k=>k.published!==false).length;
  const pubListening=listenings.filter(l=>l.published!==false).length;
  const todayPct=total?Math.round(todayCount*100/total):0;
  const streakPct=total?Math.round(streakPos*100/total):0;

  host.innerHTML=`
    <div class="admin-kpi-grid">
      <div class="admin-kpi-card">
        <div class="admin-kpi-head">
          <span class="admin-kpi-label">${tr('Sĩ số 2 lớp','2-Class Roster')}</span>
          <span class="admin-kpi-icon is-blue" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
        </div>
        <div class="admin-kpi-value tnum">${total}</div>
        <div class="admin-kpi-sub tnum">11T1: <b>${count11T1}</b> · 11.1: <b>${count11_1}</b></div>
      </div>
      <div class="admin-kpi-card">
        <div class="admin-kpi-head">
          <span class="admin-kpi-label">${tr('Hoàn thành hôm nay','Completed Today')}</span>
          <span class="admin-kpi-icon is-green" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
        </div>
        <div class="admin-kpi-value tnum">${todayCount}</div>
        <div class="admin-kpi-sub tnum">${todayPct}% · 11T1: ${today11T1} · 11.1: ${today11_1}</div>
      </div>
      <div class="admin-kpi-card">
        <div class="admin-kpi-head">
          <span class="admin-kpi-label">${tr('Đang giữ Streak','Active Streaks')}</span>
          <span class="admin-kpi-icon is-amber" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></span>
        </div>
        <div class="admin-kpi-value tnum">${streakPos}</div>
        <div class="admin-kpi-sub tnum">${streakPct}% · ${tr('TB','Avg')} ${avgStreak} ${tr('ngày','days')}</div>
      </div>
      <div class="admin-kpi-card">
        <div class="admin-kpi-head">
          <span class="admin-kpi-label">${tr('Nội dung xuất bản','Published Content')}</span>
          <span class="admin-kpi-icon is-slate" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></span>
        </div>
        <div class="admin-kpi-value tnum">${pubSets}</div>
        <div class="admin-kpi-sub tnum">${tr(`Daily · ${pubKnowledge} bài · ${pubListening} nghe`,`Daily · ${pubKnowledge} notes · ${pubListening} audio`)}</div>
      </div>
    </div>
  `;
}

export async function loadAdminForUser(user){
  if(stopUsersProgress){stopUsersProgress();stopUsersProgress=null}
  rerenderUsers=null;
  currentUser=user;
  if(staff())await loadAdmin();else renderDenied();
}
export function stopAdminListeners(){
  if(stopUsersProgress){stopUsersProgress();stopUsersProgress=null}
  rerenderUsers=null;
  currentUser=null;
}
async function loadAdmin(){
  const isAdm=admin();
  document.querySelector('[data-cms=admins]')?.classList.toggle('d-none',!isAdm);
  document.getElementById('adminRosterWrap')?.classList.toggle('d-none',!isAdm);
  if(!isAdm){
    const adminsTab=document.querySelector('[data-cms=admins]');
    if(adminsTab?.classList.contains('active'))document.querySelector('[data-cms=students]')?.click();
  }
  await Promise.all([
    loadUsers(),
    isAdm?loadTeachers():Promise.resolve(),
    isAdm?loadRoster():Promise.resolve(),
    loadKnowledge(),
    loadQuestions(),
    loadListenings()
  ]);
  await loadSets();
  bindCmsTabs();
  bindExportControls();
  syncExportSummaryUI();
  renderAdminOverview();
  if(!langBound){
    langBound=true;
    window.addEventListener('app:lang-change',()=>{
      if(!staff())return;
      syncExportSummaryUI();
      renderAdminOverview();
      rerenderUsers?.();
      renderDailyAdmin();
      renderKnowledgeAdmin();
      renderListeningAdmin();
      renderQuestionAdmin();
      if(admin()){loadTeachers();loadRoster();}
    });
  }
}
function renderDenied(){const r=document.getElementById('adminContent');if(r)r.innerHTML=`<div class="empty"><div>🔒</div><h3>${tr('Khu vực dành cho giáo viên','Teacher Dashboard')}</h3><p>${tr('Tài khoản này chưa được cấp quyền quản trị.','This account does not have staff permissions.')}</p></div>`}

async function loadUsers(){
  const r=document.getElementById('adminUsers');if(!r)return;
  if(stopUsersProgress){stopUsersProgress();stopUsersProgress=null}
  let stopUsers=()=>{},stopSubmissions=()=>{};
  try{
    let latestUsers=[],latestSubmissions=[],latestRosterData={'11T1':[],'11.1':[]};
    let renderTimer=null;
    let sortKey='stt',sortDir=1,streakFilter='all',classFilter='all',searchQuery='';
    const normName=v=>String(v??'').trim().replace(/\s+/g,' ').toLowerCase();

    const render=()=>{
      const progress=progressFromSubmissionDocs(latestSubmissions);
      const byUid=new Map();
      const byRoster=new Map();
      const byNameAndClass=new Map();
      const byName=new Map();

      const allRosterStudents=[
        ...(latestRosterData['11T1']||[]),
        ...(latestRosterData['11.1']||[])
      ];

      allRosterStudents.forEach((x,i)=>{
        const row={
          uid:'',
          name:String(x.name||tr('Học sinh','Student')),
          className:String(x.className||'11T1'),
          role:'student',
          rosterId:String(x.id||`s${String(i+1).padStart(2,'0')}`),
          legacyId:x.legacyId||'',
          stt:Number(x.stt||i+1),
          rosterIndex:i
        };
        byRoster.set(row.rosterId,row);
        if(row.legacyId)byRoster.set(row.legacyId,row);
        byNameAndClass.set(`${normName(row.name)}_${row.className}`,row);
        byName.set(normName(row.name),row);
      });

      latestUsers.forEach(x=>{
        const userRole=String(x.role||'student');
        const isOwnerStudent=userRole==='admin'&&(String(x.rosterId||'')==='s45'||String(x.rosterId||'')==='11T1_s45');
        if((userRole==='admin'&&!isOwnerStudent)||userRole==='teacher'||x.rosterId==='__teacher_dat__')return;
        const uid=String(x.uid||'');
        const rosterId=String(x.rosterId||'');
        const userClass=String(x.className||'11T1');
        const nameKey=normName(x.name||'');

        let row=(rosterId&&byRoster.get(rosterId))
          ||(nameKey&&byNameAndClass.get(`${nameKey}_${userClass}`))
          ||(nameKey&&byName.get(nameKey));

        if(row){
          Object.assign(row,x,{
            uid:uid||row.uid,
            name:String(x.name||row.name),
            className:row.className,
            stt:row.stt,
            role:'student',
            rosterId:row.rosterId
          });
        }else return;
        if(uid)byUid.set(uid,row);
      });

      latestSubmissions.forEach(d=>{
        const x=d.data?d.data():(d||{}),uid=String(x.uid||'');if(!uid)return;
        if(byUid.has(uid))return;
        const nameKey=normName(x.name||'');
        const row=nameKey&&byName.get(nameKey);
        if(!row)return;
        row.uid=uid;byUid.set(uid,row);
      });

      let allRows=[...new Set([...byRoster.values(),...byUid.values()])].filter(x=>String(x.role||'student')==='student').map(x=>{
        const p=progress.get(String(x.uid))||{streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''};
        return {
          ...x,
          streak:p.streak,
          totalSetsCompleted:p.totalPassed,
          totalBonusPoints:p.totalBonus,
          lastCompletedDate:p.lastCompletedDate||x.lastCompletedDate||''
        };
      });

      const today=localToday();
      const count11T1=allRows.filter(x=>x.className==='11T1').length;
      const count11_1=allRows.filter(x=>x.className==='11.1').length;
      const today11T1=allRows.filter(x=>x.className==='11T1'&&x.lastCompletedDate===today).length;
      const today11_1=allRows.filter(x=>x.className==='11.1'&&x.lastCompletedDate===today).length;
      const avgStreak=allRows.length?Math.round((allRows.reduce((s,x)=>s+Number(x.streak||0),0)/allRows.length)*10)/10:0;

      overviewStats={
        totalStudents:allRows.length,
        count11T1,
        count11_1,
        activeToday:today11T1+today11_1,
        today11T1,
        today11_1,
        streakPositive:allRows.filter(x=>Number(x.streak||0)>0).length,
        avgStreak
      };
      renderAdminOverview();

      const compareRoot=document.getElementById('adminClassCompare');
      if(compareRoot){
        const calcClass=(cls)=>{
          const list=allRows.filter(x=>x.className===cls);
          const n=list.length;
          const activeStreak=list.filter(x=>Number(x.streak||0)>0).length;
          const doneToday=list.filter(x=>x.lastCompletedDate===today).length;
          const totalPass=list.reduce((s,x)=>s+Number(x.totalSetsCompleted||0),0);
          const avgBonus=n?Math.round((list.reduce((s,x)=>s+Number(x.totalBonusPoints||0),0)/n)*10)/10:0;
          const clsAvgStreak=n?Math.round((list.reduce((s,x)=>s+Number(x.streak||0),0)/n)*10)/10:0;
          return {
            cls,n,activeStreak,doneToday,totalPass,avgBonus,avgStreak:clsAvgStreak,
            todayPct:n?Math.round(doneToday*100/n):0,
            streakPct:n?Math.round(activeStreak*100/n):0
          };
        };
        const stats1=calcClass('11T1');
        const stats2=calcClass('11.1');
        compareRoot.innerHTML=[stats1,stats2].map(c=>{
          const selected=classFilter===c.cls;
          return `
            <div class="admin-class-card ${selected?'is-active':''}">
              <div class="admin-class-head">
                <div>
                  <span class="badge ${c.cls==='11T1'?'bg-primary':'bg-info text-dark'}">${esc(c.cls)}</span>
                  <strong class="ms-2 tnum">${c.n} ${tr('học sinh','students')}</strong>
                </div>
                <button type="button" class="btn btn-sm ${selected?'btn-primary':'btn-outline-secondary'}" data-class-pick="${esc(c.cls)}">
                  ${selected?tr('Đang lọc ✓','Filtered ✓'):tr('Lọc lớp','Filter')}
                </button>
              </div>
              <div class="admin-class-bars">
                <div class="admin-class-bar-row">
                  <div class="d-flex justify-content-between small"><span>${tr('Hoàn thành hôm nay','Completed today')}</span><b class="tnum">${c.doneToday}/${c.n} (${c.todayPct}%)</b></div>
                  <div class="admin-class-track is-green"><span style="width:${c.todayPct}%"></span></div>
                </div>
                <div class="admin-class-bar-row">
                  <div class="d-flex justify-content-between small"><span>${tr('Đang giữ Streak > 0','Active Streak > 0')}</span><b class="tnum">${c.activeStreak}/${c.n} (${c.streakPct}%)</b></div>
                  <div class="admin-class-track"><span style="width:${c.streakPct}%"></span></div>
                </div>
              </div>
              <div class="admin-class-metrics">
                <div><small>${tr('Streak TB','Avg streak')}</small><b class="tnum">${c.avgStreak}</b></div>
                <div><small>${tr('Tổng Set pass','Sets passed')}</small><b class="tnum">${c.totalPass}</b></div>
                <div><small>${tr('Bonus TB','Avg bonus')}</small><b class="tnum">${c.avgBonus}</b></div>
              </div>
            </div>
          `;
        }).join('');
        compareRoot.querySelectorAll('[data-class-pick]').forEach(b=>b.onclick=()=>{
          const picked=b.dataset.classPick;
          classFilter=classFilter===picked?'all':picked;
          render();
        });
      }

      let rows=allRows;
      if(classFilter!=='all'){
        rows=rows.filter(x=>x.className===classFilter);
      }
      rows=rows.filter(x=>{
        if(streakFilter==='zero')return Number(x.streak||0)===0;
        if(streakFilter==='active')return Number(x.streak||0)>0;
        if(streakFilter==='today')return x.lastCompletedDate===today;
        if(streakFilter==='notToday')return x.lastCompletedDate!==today;
        return true;
      });

      if(searchQuery){
        const q=removeDiacritics(searchQuery);
        rows=rows.filter(x=>{
          const n=removeDiacritics(x.name||'');
          const stt=String(x.stt||'');
          return n.includes(q)||stt===q;
        });
      }

      const value=(x,k)=>k==='name'?String(x.name||''):k==='className'?String(x.className||''):k==='lastCompletedDate'?String(x.lastCompletedDate||''):Number(x[k]||0);
      rows.sort((a,b)=>{
        const av=value(a,sortKey),bv=value(b,sortKey);
        const cmp=typeof av==='string'?av.localeCompare(bv,'vi'):av-bv;
        return cmp*sortDir||Number(a.stt??9999)-Number(b.stt??9999);
      });

      const th=(key,label)=>`<th><button type="button" class="btn btn-sm btn-link p-0 text-reset text-decoration-none admin-sort" data-sort="${key}">${label}${sortKey===key?(sortDir===1?' ↑':' ↓'):''}</button></th>`;

      r.innerHTML=`
        <div class="admin-progress-toolbar d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
          <div>
            <b>${tr('Danh sách chi tiết','Student Details')}</b>
            <span class="tag ms-2 tnum">${rows.length} ${tr('học sinh','students')}</span>
            <span class="text-muted small ms-1 tnum">(11T1: ${count11T1} · 11.1: ${count11_1})</span>
          </div>
          <div class="d-flex gap-2 flex-wrap align-items-center">
            <input type="text" id="adminStudentSearch" class="form-control form-control-sm" placeholder="${tr('Tìm tên / STT...','Search name / #...')}" style="width:165px" value="${esc(searchQuery)}">
            <select id="studentClassFilter" class="form-select form-select-sm" style="width:auto">
              <option value="all" ${classFilter==='all'?'selected':''}>${tr('Cả 2 lớp (11T1 & 11.1)','Both classes (11T1 & 11.1)')}</option>
              <option value="11T1" ${classFilter==='11T1'?'selected':''}>${tr('Lớp 11T1','Class 11T1')}</option>
              <option value="11.1" ${classFilter==='11.1'?'selected':''}>${tr('Lớp 11.1','Class 11.1')}</option>
            </select>
            <select id="studentStreakFilter" class="form-select form-select-sm" style="width:auto">
              <option value="all" ${streakFilter==='all'?'selected':''}>${tr('Tất cả học sinh','All students')}</option>
              <option value="today" ${streakFilter==='today'?'selected':''}>${tr('Đã làm hôm nay','Completed today')}</option>
              <option value="notToday" ${streakFilter==='notToday'?'selected':''}>${tr('Chưa làm hôm nay','Pending today')}</option>
              <option value="active" ${streakFilter==='active'?'selected':''}>${tr('Streak > 0','Streak > 0')}</option>
              <option value="zero" ${streakFilter==='zero'?'selected':''}>${tr('Streak = 0','Streak = 0')}</option>
            </select>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table align-middle admin-students-table">
            <thead>
              <tr>
                ${th('stt',tr('STT','#'))}
                ${th('name',tr('Họ và tên','Full Name'))}
                ${th('className',tr('Lớp','Class'))}
                ${th('totalBonusPoints','Bonus')}
                ${th('streak','Streak')}
                ${th('totalSetsCompleted',tr('Set pass','Passed'))}
                ${th('lastCompletedDate',tr('Gần nhất','Last Active'))}
              </tr>
            </thead>
            <tbody>
              ${rows.map((x,i)=>{
                const isToday=x.lastCompletedDate===today;
                return `
                <tr>
                  <td><b class="tnum">#${String(x.stt||i+1).padStart(2,'0')}</b></td>
                  <td><span class="fw-medium">${esc(x.name||x.email||'')}</span></td>
                  <td><span class="badge ${x.className==='11T1'?'bg-primary':'bg-info text-dark'}">${esc(x.className||'11T1')}</span></td>
                  <td class="tnum">${Number(x.totalBonusPoints||0)}</td>
                  <td class="tnum"><b>${Number(x.streak||0)}</b></td>
                  <td class="tnum">${Number(x.totalSetsCompleted||0)}</td>
                  <td class="tnum">${isToday?`<span class="badge bg-success-subtle text-success">${esc(x.lastCompletedDate)}</span>`:esc(x.lastCompletedDate||'—')}</td>
                </tr>`;
              }).join('')||`<tr><td colspan="7" class="text-center py-3 text-muted">${tr('Không tìm thấy học sinh phù hợp.','No matching students found.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      `;

      r.querySelectorAll('[data-sort]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.sort;if(sortKey===key)sortDir*=-1;else{sortKey=key;sortDir=1}render()});
      r.querySelector('#studentClassFilter')?.addEventListener('change',e=>{classFilter=e.target.value;render()});
      r.querySelector('#studentStreakFilter')?.addEventListener('change',e=>{streakFilter=e.target.value;render()});
      const searchBox=r.querySelector('#adminStudentSearch');
      if(searchBox){
        searchBox.addEventListener('input',e=>{searchQuery=e.target.value.trim();render();const el=r.querySelector('#adminStudentSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}});
      }
    };

    rerenderUsers=render;
    const scheduleRender=()=>{clearTimeout(renderTimer);renderTimer=setTimeout(render,0)};
    latestRosterData=await readRoster(true);
    stopUsers=onSnapshot(collection(db,'users'),snap=>{latestUsers=[];snap.forEach(d=>latestUsers.push({uid:d.id,...d.data()}));scheduleRender()},e=>{console.error('Realtime users:',e);r.innerHTML=`<div class="alert alert-danger">${tr('Không đồng bộ được danh sách học sinh.','Could not sync student list.')}</div>`});
    stopSubmissions=onSnapshot(collection(db,'submissions'),snap=>{latestSubmissions=snap.docs.filter(d=>isPassedValue(d.data()?.passed));scheduleRender()},e=>{console.error('Realtime submissions:',e);r.innerHTML=`<div class="alert alert-danger">${tr('Không đồng bộ được tiến độ bài làm.','Could not sync submission progress.')}</div>`});
    stopUsersProgress=()=>{stopUsers();stopSubmissions();clearTimeout(renderTimer)};
    render();
  }catch(e){stopUsers();stopSubmissions();r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được học sinh.','Failed to load students.')}</div>`;console.error(e)}
}

async function saveAdmins(){if(!admin())return;try{const lines=String(document.getElementById('adminEmails')?.value||'').split(/\r?\n/).map(x=>x.trim().toLowerCase()).filter(Boolean);if(lines.some(x=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))throw new Error(tr('Có email admin không hợp lệ.','Invalid admin email found.'));const ownerEmail=OWNER_EMAIL;const emails=[...new Set([ownerEmail,...lines])];await setDoc(doc(db,'config','admins'),{emails,updatedAt:serverTimestamp()},{merge:true});invalidateRoleCaches();toast(tr('Đã lưu danh sách admin.','Admin list saved.'));await loadTeachers()}catch(e){console.error(e);toast(safeErr(e,'Không thể lưu admin.','Could not save admin list.'),'error')}}

async function loadTeachers(){const r=document.getElementById('adminAdmins');if(!r||!admin())return;let adminEmails=[],teacherEmails=[];try{const a=await getDoc(doc(db,'config','admins'));adminEmails=a.exists()&&Array.isArray(a.data()?.emails)?a.data().emails.map(x=>String(x).trim().toLowerCase()).filter(Boolean):[];const t=await getDoc(doc(db,'config','teachers'));teacherEmails=t.exists()&&Array.isArray(t.data()?.emails)?t.data().emails.map(x=>String(x).trim().toLowerCase()).filter(Boolean):[];r.innerHTML=`<div class="cms-form"><h4>👑 Admin</h4><textarea id="adminEmails" class="form-control" rows="3">${esc(adminEmails.join('\n'))}</textarea><div class="small muted mt-2">${tr('Admin có toàn quyền và có thể bổ nhiệm giáo viên.','Admins have full access and can appoint teachers.')}</div><button id="saveAdmins" class="btn btn-dark mt-2">${tr('Lưu Admin','Save Admins')}</button><hr class="my-4"><h4>👨‍🏫 ${tr('Giáo viên','Teachers')}</h4><textarea id="teacherEmails" class="form-control" rows="4" placeholder="teacher@example.com">${esc(teacherEmails.join('\n'))}</textarea><div class="small muted mt-2">${tr('Mỗi dòng một Gmail. Giáo viên có quyền quản lý nội dung, Daily Set và xuất tiến độ; không có quyền quản trị hệ thống.','One Gmail per line. Teachers can manage content, Daily Sets, and export reports; no system-admin privileges.')}</div><button id="saveTeachers" class="btn btn-success mt-2">${tr('Lưu danh sách giáo viên','Save Teachers')}</button></div>`;document.getElementById('saveAdmins').onclick=saveAdmins;document.getElementById('saveTeachers').onclick=saveTeachers}catch(e){console.error(e);r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được danh sách quản trị viên.','Could not load permissions list.')}</div>`}}
async function saveTeachers(){if(!admin())return;try{const lines=String(document.getElementById('teacherEmails')?.value||'').split(/\r?\n/).map(x=>x.trim().toLowerCase()).filter(Boolean);if(lines.some(x=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))throw new Error(tr('Có email giáo viên không hợp lệ.','Invalid teacher email found.'));const admins=(await getDoc(doc(db,'config','admins'))).data()?.emails||[];const cleanAdmins=new Set([String(OWNER_EMAIL).trim().toLowerCase(),...admins.map(x=>String(x).trim().toLowerCase())]);const teachers=[...new Set(lines.filter(x=>!cleanAdmins.has(x)))];await setDoc(doc(db,'config','teachers'),{emails:teachers,updatedAt:serverTimestamp()});invalidateRoleCaches();toast(tr('Đã lưu danh sách giáo viên.','Teacher list saved.'));await loadTeachers()}catch(e){console.error(e);toast(safeErr(e,'Không thể lưu giáo viên.','Could not save teacher list.'),'error')}}

async function loadRoster(){
  const r=document.getElementById('adminRoster');if(!r||!admin())return;
  try{
    const rosterData=await readRoster(true);
    const s11T1=rosterData['11T1']||[];
    const s11_1=rosterData['11.1']||[];
    r.innerHTML=`
      <div class="cms-form">
        <div class="d-flex gap-2 mb-3 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-primary active" id="btnTabRoster11T1">${tr(`Lớp 11T1 (${s11T1.length} HS)`,`Class 11T1 (${s11T1.length})`)}</button>
          <button type="button" class="btn btn-sm btn-outline-primary" id="btnTabRoster11_1">${tr(`Lớp 11.1 (${s11_1.length} HS)`,`Class 11.1 (${s11_1.length})`)}</button>
        </div>
        <div id="paneRoster11T1">
          <label class="form-label fw-bold">${tr('Danh sách học sinh lớp 11T1 (Mỗi dòng một tên):','Class 11T1 Roster (One name per line):')}</label>
          <textarea id="rosterNames11T1" class="form-control font-monospace" rows="10" placeholder="${tr('Mỗi dòng một tên','One name per line')}">${esc(s11T1.map(x=>String(x.name||'')).join('\n'))}</textarea>
          <div class="small muted mt-2">${tr('Đã nạp sẵn danh sách lớp 11T1. Sửa và bấm Lưu khi có thay đổi danh sách.','Preloaded 11T1 student list. Click Save after changes.')}</div>
          <button id="saveRoster11T1" class="btn btn-success mt-2">💾 ${tr('Lưu Roster Lớp 11T1','Save 11T1 Roster')}</button>
        </div>
        <div id="paneRoster11_1" class="d-none">
          <label class="form-label fw-bold">${tr('Danh sách học sinh lớp 11.1 (Mỗi dòng một tên):','Class 11.1 Roster (One name per line):')}</label>
          <textarea id="rosterNames11_1" class="form-control font-monospace" rows="10" placeholder="${tr('Mỗi dòng một tên','One name per line')}">${esc(s11_1.map(x=>String(x.name||'')).join('\n'))}</textarea>
          <div class="small muted mt-2">${tr('Dán danh sách học sinh lớp 11.1 vào đây. Học sinh sẽ thấy ngay trong bảng chọn danh tính.','Paste class 11.1 roster here. Students see it immediately during onboarding.')}</div>
          <button id="saveRoster11_1" class="btn btn-success mt-2">💾 ${tr('Lưu Roster Lớp 11.1','Save 11.1 Roster')}</button>
        </div>
      </div>
    `;
    const tab11T1=document.getElementById('btnTabRoster11T1');
    const tab11_1=document.getElementById('btnTabRoster11_1');
    const pane11T1=document.getElementById('paneRoster11T1');
    const pane11_1=document.getElementById('paneRoster11_1');
    tab11T1.onclick=()=>{
      tab11T1.classList.add('active');tab11_1.classList.remove('active');
      pane11T1.classList.remove('d-none');pane11_1.classList.add('d-none');
    };
    tab11_1.onclick=()=>{
      tab11_1.classList.add('active');tab11T1.classList.remove('active');
      pane11_1.classList.remove('d-none');pane11T1.classList.add('d-none');
    };
    document.getElementById('saveRoster11T1').onclick=()=>saveRosterClass('11T1');
    document.getElementById('saveRoster11_1').onclick=()=>saveRosterClass('11.1');
  }catch(e){console.error(e);r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được roster.','Could not load roster.')}</div>`}
}

async function saveRosterClass(className){
  if(!admin())return;
  try{
    const textareaId=className==='11T1'?'rosterNames11T1':'rosterNames11_1';
    const lines=String(document.getElementById(textareaId)?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length<1)throw new Error(tr(`Roster lớp ${className} phải có ít nhất 1 tên.`,`Roster for ${className} must contain at least 1 name.`));
    if(className==='11T1'&&lines.length!==45&&!(await appConfirm({title:tr('Xác nhận số lượng học sinh','Confirm Class Size'),message:tr(`Lớp 11T1 hiện có ${lines.length} HS (khác mặc định 45). Vẫn lưu?`,`11T1 has ${lines.length} students (default 45). Save anyway?`),confirmText:tr('Vẫn lưu','Save Anyway')})))return;
    const students=lines.map((name,i)=>({
      id:`${className}_s${String(i+1).padStart(2,'0')}`,
      name,
      className,
      stt:i+1
    }));
    const patch={updatedAt:serverTimestamp()};
    if(className==='11T1'){
      patch.students_11T1=students;
      patch.students=students;
    }else{
      patch.students_11_1=students;
    }
    await setDoc(doc(db,'config','roster'),patch,{merge:true});
    invalidateRosterCache();
    toast(tr(`Đã lưu roster lớp ${className} (${lines.length} HS).`,`Saved ${className} roster (${lines.length} students).`));
    await Promise.all([loadRoster(),loadUsers()]);
  }catch(e){toast(safeErr(e,'Không thể lưu roster.','Could not save roster.'),'error')}
}

function activateCmsTab(id){
  const targetId=id||'students';
  document.querySelectorAll('.cms-tab[data-cms]').forEach(x=>{
    const active=(x.dataset.cms===targetId);
    x.classList.toggle('active',active);
    x.setAttribute('aria-selected',String(active));
  });
  document.querySelectorAll('.cms-pane').forEach(x=>x.classList.toggle('d-none',x.id!==`cms-${targetId}`));
}

function bindCmsTabs(){
  document.querySelectorAll('[data-cms]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.cms;
    const adminPage=document.getElementById('admin');
    if(adminPage?.classList.contains('d-none')&&typeof window.__openAppPage==='function'){
      window.__openAppPage('admin');
    }
    document.querySelectorAll('[data-t-page]').forEach(p=>p.classList.remove('active'));
    activateCmsTab(id);
  });
  document.querySelectorAll('[data-t-home]').forEach(b=>b.onclick=()=>{
    const tab=b.dataset.tHome||'students';
    if(typeof window.__openAppPage==='function')window.__openAppPage('admin');
    document.querySelectorAll('[data-t-page]').forEach(p=>p.classList.remove('active'));
    activateCmsTab(tab);
  });
  document.querySelectorAll('[data-qsub]').forEach(b=>b.onclick=()=>{
    const sub=b.dataset.qsub;
    document.querySelectorAll('.cms-subtab').forEach(x=>{
      const active=(x===b);
      x.classList.toggle('active',active);
      x.setAttribute('aria-selected',String(active));
    });
    document.getElementById('subPaneDaily')?.classList.toggle('d-none',sub!=='sets');
    document.getElementById('subPaneBank')?.classList.toggle('d-none',sub!=='bank');
  });
}

// ===== KNOWLEDGE CMS =====
async function loadKnowledge(){const r=document.getElementById('adminKnowledge');if(!r)return;try{const snap=await getDocs(collection(db,'knowledge'));knowledge=[];snap.forEach(d=>knowledge.push({id:d.id,...d.data()}));knowledge.sort((a,b)=>Number(b.updatedAt?.seconds||b.createdAt?.seconds||0)-Number(a.updatedAt?.seconds||a.createdAt?.seconds||0));renderKnowledgeAdmin();renderAdminOverview()}catch(e){console.error(e);r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được kiến thức.','Could not load study notes.')}</div>`}}
function knowledgeForm(k=null){const x=k||{};return `<div class="cms-form"><div class="row g-3"><div class="col-md-8"><label>${tr('Tiêu đề *','Title *')}</label><input id="kTitle" class="form-control form-control-lg" value="${esc(x.title||'')}" placeholder="Unit 6 – Relative clauses"></div><div class="col-md-4"><label>Unit</label><select id="kUnit" class="form-select form-select-lg">${['Unit 1','Unit 2','Unit 3','Unit 4','Unit 5','Unit 6','Unit 7','Unit 8','Unit 9','Unit 10','Chuyên đề','Khác'].map(u=>`<option value="${u}" ${x.unit===u?'selected':''}>${u==='Chuyên đề'?tr('Chuyên đề','Special Topic'):u==='Khác'?tr('Khác','Other'):u}</option>`).join('')}</select></div><div class="col-md-6"><label>${tr('Môn / chủ đề','Topic / Category')}</label><input id="kCategory" class="form-control" value="${esc(x.category||'Grammar')}" placeholder="Grammar / Vocabulary / Reading..."></div><div class="col-12"><label>${tr('Lý thuyết *','Content *')}</label><textarea id="kContent" class="form-control" rows="7" placeholder="${tr('Viết nội dung bài học...','Write lesson content...')}">${esc(x.content||'')}</textarea></div><div class="col-12"><label>${tr('Ví dụ','Examples')}</label><textarea id="kExamples" class="form-control" rows="4" placeholder="${tr('Mỗi ví dụ một dòng...','One example per line...')}">${esc(x.examples||'')}</textarea></div><div class="col-md-6"><label>${tr('Ghi chú / mẹo nhớ','Notes / Tips')}</label><textarea id="kNotes" class="form-control" rows="4">${esc(x.notes||'')}</textarea></div><div class="col-md-6"><label>${tr('Bài tập (nếu muốn)','Exercises (optional)')}</label><textarea id="kExercises" class="form-control" rows="4" placeholder="1. ...&#10;2. ...">${esc(x.exercises||'')}</textarea></div><div class="col-12"><div class="form-check form-switch"><input id="kPublished" class="form-check-input" type="checkbox" ${x.published===false?'':'checked'}><label class="form-check-label"><b>${tr('Đã xuất bản','Published')}</b> — ${tr('học sinh sẽ thấy ngay','visible to students immediately')}</label></div></div></div><div class="form-actions"><button id="saveKnowledge" class="btn btn-primary btn-lg">💾 ${k?tr('Cập nhật','Update'):tr('Đăng kiến thức','Publish')}</button><button id="cancelKnowledge" class="btn btn-outline-secondary">${tr('Hủy','Cancel')}</button></div></div>`}
function renderKnowledgeAdmin(){const r=document.getElementById('adminKnowledge');if(!r)return;r.innerHTML=`<button id="newKnowledge" class="btn btn-primary mb-3">＋ ${tr('Thêm kiến thức','Add Study Note')}</button><div id="knowledgeEditor"></div><div class="cms-list">${knowledge.map(k=>`<article class="cms-item"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(k.unit==='Chuyên đề'?tr('Chuyên đề','Special Topic'):k.unit==='Khác'?tr('Khác','Other'):(k.unit||''))}</span><span class="tag ${k.published?'tag-published':'tag-draft'}">${k.published?tr('Đã xuất bản','Published'):tr('Nháp','Draft')}</span></div><h4 class="mt-2 mb-1 h5">${esc(k.title||tr('Không có tiêu đề','Untitled'))}</h4><small class="muted">${esc(k.category||'')} · ${esc(k.authorName||'')}</small></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" data-k-edit="${esc(k.id)}">${tr('Sửa','Edit')}</button><button class="btn btn-sm btn-outline-danger" data-k-del="${esc(k.id)}">${tr('Xóa','Delete')}</button></div></article>`).join('')||`<div class="muted">${tr('Chưa có bài kiến thức.','No study notes yet.')}</div>`}</div>`;document.getElementById('newKnowledge').onclick=()=>openKnowledge();r.querySelectorAll('[data-k-edit]').forEach(b=>b.onclick=()=>openKnowledge(b.dataset.kEdit));r.querySelectorAll('[data-k-del]').forEach(b=>b.onclick=()=>deleteKnowledge(b.dataset.kDel))}
function openKnowledge(id){const r=document.getElementById('knowledgeEditor');if(!r)return;const k=id?knowledge.find(x=>x.id===id):null;r.innerHTML=knowledgeForm(k);document.getElementById('saveKnowledge').onclick=()=>saveKnowledge(id);document.getElementById('cancelKnowledge').onclick=()=>{r.innerHTML=''};r.scrollIntoView({behavior:'smooth',block:'start'})}
async function saveKnowledge(id){if(!staff())return;try{const title=document.getElementById('kTitle').value.trim(),content=document.getElementById('kContent').value.trim();if(!title||!content)throw new Error(tr('Tiêu đề và lý thuyết là bắt buộc.','Title and content are required.'));const payload={title,unit:document.getElementById('kUnit').value,category:document.getElementById('kCategory').value.trim()||'Grammar',content,examples:document.getElementById('kExamples').value.trim(),notes:document.getElementById('kNotes').value.trim(),exercises:document.getElementById('kExercises').value.trim(),published:document.getElementById('kPublished').checked,author:currentUser.email||'',authorName:currentUser.displayName||currentUser.email||tr('Giáo viên','Teacher'),updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'knowledge',id),payload);else await setDoc(doc(collection(db,'knowledge')),{...payload,createdAt:serverTimestamp()});toast(payload.published?tr('Đã đăng kiến thức — học sinh thấy ngay.','Published — visible to students.'):tr('Đã lưu bản nháp.','Draft saved.'));await loadKnowledge()}catch(e){console.error(e);toast(safeErr(e,'Không thể lưu kiến thức.','Could not save study note.'),'error')}}
async function deleteKnowledge(id){if(!staff())return;if(!(await appConfirm({title:tr('Xóa bài kiến thức?','Delete study note?'),message:tr('Xóa bài kiến thức này?','Delete this study note?'),danger:true})))return;try{await deleteDoc(doc(db,'knowledge',id));toast(tr('Đã xóa kiến thức.','Study note deleted.'));await loadKnowledge()}catch(e){console.error(e);toast(tr('Xóa thất bại.','Delete failed.'),'error')}}

// ===== QUESTION CMS =====
const getKinds=()=>[
  ['mcq',tr('4 lựa chọn','4-choice MCQ')],
  ['two',tr('2 lựa chọn','2 choices')],
  ['reading',tr('Đọc hiểu (Reading)','Reading Comprehension')],
  ['form',tr('Điền dạng đúng','Word form')],
  ['rewrite',tr('Viết lại câu','Sentence rewrite')]
];
async function loadQuestions(){const r=document.getElementById('adminQuestions');if(!r)return;try{const snap=await getDocs(collection(db,'questionBank'));questions=[];snap.forEach(d=>questions.push({id:d.id,...d.data()}));questions.sort((a,b)=>String(a.unit||'').localeCompare(String(b.unit||''))||Number(b.updatedAt?.seconds||b.createdAt?.seconds||0)-Number(a.updatedAt?.seconds||a.createdAt?.seconds||0));renderQuestionAdmin();renderAdminOverview()}catch(e){console.error(e);r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được ngân hàng câu hỏi.','Could not load question bank.')}</div>`}}
function questionForm(q=null){const x=q||{};const opts=Array.isArray(x.options)?x.options:[];return `<div class="cms-form"><div class="row g-3"><div class="col-md-3"><label>Unit</label><select id="qUnit" class="form-select">${Array.from({length:10},(_,i)=>`<option ${x.unit===`Unit ${i+1}`?'selected':''}>Unit ${i+1}</option>`).join('')}<option ${x.unit==='Review'?'selected':''}>Review</option></select></div><div class="col-md-3"><label>${tr('Dạng câu','Type')}</label><select id="qKind" class="form-select">${getKinds().map(k=>`<option value="${k[0]}" ${x.kind===k[0]?'selected':''}>${k[1]}</option>`).join('')}</select></div><div class="col-md-6"><label>${tr('Trạng thái','Status')}</label><div class="form-check form-switch mt-2"><input id="qPublished" class="form-check-input" type="checkbox" ${x.published?'checked':''}><label class="form-check-label">${tr('Đã xuất bản','Published')}</label></div></div><div class="col-12"><label>${tr('Câu hỏi *','Question *')}</label><textarea id="qPrompt" class="form-control" rows="3" placeholder="${tr('Chọn đáp án đúng...','Enter prompt...')}">${esc(x.prompt||'')}</textarea></div><div class="col-md-8"><label>${tr('Các lựa chọn (mỗi dòng một đáp án)','Options (one per line)')}</label><textarea id="qOptions" class="form-control" rows="5" placeholder="A&#10;B&#10;C&#10;D">${esc(opts.join('\n'))}</textarea></div><div class="col-md-4"><label>${tr('Đáp án đúng','Correct option')}</label><select id="qCorrect" class="form-select">${[0,1,2,3].map(i=>`<option value="${i}" ${Number(x.correctIndex)===i?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select><label class="mt-3">${tr('Đáp án chữ (form/rewrite)','Text answer (form/rewrite)')}</label><input id="qAnswer" class="form-control" value="${esc(x.answer||'')}" placeholder="went / who..."><label class="mt-3">${tr('Giải thích','Explanation')}</label><textarea id="qExplain" class="form-control" rows="3">${esc(x.explain||'')}</textarea></div></div><div class="form-actions"><button id="saveQuestion" class="btn btn-primary btn-lg">💾 ${q?tr('Cập nhật','Update'):tr('Thêm câu hỏi','Add Question')}</button><button id="cancelQuestion" class="btn btn-outline-secondary">${tr('Hủy','Cancel')}</button></div></div>`}
function renderQuestionAdmin(){const r=document.getElementById('adminQuestions');if(!r)return;r.innerHTML=`
<div class="question-bank-toolbar panel mb-3">
  <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
    <div>
      <b>${tr('Quản lý hàng loạt','Bulk Actions')}</b>
      <span id="qSelectedCount" class="tag ms-2">${tr('0 đã chọn','0 selected')}</span>
    </div>
    <div class="d-flex gap-2 flex-wrap">
      <button id="qSelectAll" type="button" class="btn btn-sm btn-outline-secondary">☑ ${tr('Chọn tất cả','Select all')}</button>
      <button id="qClearSelect" type="button" class="btn btn-sm btn-outline-secondary">${tr('Bỏ chọn','Clear')}</button>
      <button id="qMakeSet01" type="button" class="btn btn-sm btn-primary" disabled>🚀 ${tr('Tạo Set từ câu đã chọn','Create Set from Selected')}</button>
      <button id="qDeleteSelected" type="button" class="btn btn-sm btn-outline-danger" disabled>🗑 ${tr('Xóa đã chọn','Delete Selected')}</button>
      <button id="qDeleteAll" type="button" class="btn btn-sm btn-danger" ${questions.length?'':'disabled'}>🗑 ${tr('Xóa toàn bộ ngân hàng','Clear Bank')}</button>
    </div>
  </div>
  <div class="small muted mt-2">${tr('Chọn một hoặc nhiều câu để tạo thành <b>1 Set</b>. Số câu không bị giới hạn 20.','Select one or more questions to build a <b>Daily Set</b> (no 20-question limit).')}</div>
</div>

<button id="newQuestion" class="btn btn-primary mb-3">＋ ${tr('Thêm câu hỏi','Add Question')}</button><div id="questionEditor"></div><div class="cms-list">${questions.map(q=>`<article class="cms-item question-bank-item"><div class="d-flex align-items-start gap-3"><input class="form-check-input q-select mt-1" type="checkbox" value="${esc(q.id)}" aria-label="${tr('Chọn câu hỏi','Select question')}"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(q.unit||'')}</span><span class="tag">${esc(q.kind||'')}</span><span class="tag ${q.published?'tag-published':'tag-draft'}">${q.published?tr('Đã xuất bản','Published'):tr('Nháp','Draft')}</span></div><h4 class="mt-2 mb-0 fs-6 fw-semibold">${esc(q.prompt||'').slice(0,150)}</h4></div></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" data-q-edit="${esc(q.id)}">${tr('Sửa','Edit')}</button><button class="btn btn-sm btn-outline-danger" data-q-del="${esc(q.id)}">${tr('Xóa','Delete')}</button></div></article>`).join('')||`<div class="muted">${tr('Chưa có câu hỏi.','No questions in bank yet.')}</div>`}</div>`;
document.getElementById('newQuestion').onclick=()=>openQuestion();r.querySelectorAll('[data-q-edit]').forEach(b=>b.onclick=()=>openQuestion(b.dataset.qEdit));r.querySelectorAll('[data-q-del]').forEach(b=>b.onclick=()=>deleteQuestion(b.dataset.qDel));bindQuestionBulk(r)}

function bindQuestionBulk(r){
  const boxes=()=>[...r.querySelectorAll('.q-select')];
  const selected=()=>boxes().filter(x=>x.checked).map(x=>x.value);
  const countEl=r.querySelector('#qSelectedCount'),setBtn=r.querySelector('#qMakeSet01'),delBtn=r.querySelector('#qDeleteSelected'),allBtn=r.querySelector('#qDeleteAll');
  const sync=()=>{const ids=selected(),n=ids.length;if(countEl)countEl.textContent=tr(`${n} đã chọn`,`${n} selected`);if(setBtn)setBtn.disabled=n<1;if(delBtn)delBtn.disabled=n===0;const all=boxes();if(r.querySelector('#qSelectAll'))r.querySelector('#qSelectAll').textContent=all.length&&n===all.length?tr('☐ Bỏ chọn tất cả','☐ Deselect all'):tr('☑ Chọn tất cả','☑ Select all')};
  boxes().forEach(b=>b.addEventListener('change',sync));
  r.querySelector('#qSelectAll')?.addEventListener('click',()=>{const all=boxes(),should=all.some(x=>!x.checked);all.forEach(x=>x.checked=should);sync()});
  r.querySelector('#qClearSelect')?.addEventListener('click',()=>{boxes().forEach(x=>x.checked=false);sync()});
  delBtn?.addEventListener('click',async()=>{const ids=selected();if(!ids.length)return;if(!(await appConfirm({title:tr('Xóa câu hỏi?','Delete questions?'),message:tr(`Xóa ${ids.length} câu hỏi đã chọn?`,`Delete ${ids.length} selected questions?`),danger:true})))return;await deleteQuestionsBulk(ids)});
  allBtn?.addEventListener('click',async()=>{if(!questions.length)return;if(!(await appConfirm({title:tr('Xóa toàn bộ ngân hàng?','Clear entire question bank?'),message:tr(`Xóa TOÀN BỘ ${questions.length} câu hỏi trong ngân hàng?\nHành động này không thể hoàn tác.`,`Delete ALL ${questions.length} questions in the bank?\nThis cannot be undone.`),danger:true})))return;await deleteQuestionsBulk(questions.map(q=>q.id))});
  setBtn?.addEventListener('click',async()=>{const ids=selected();if(ids.length<1)return;await createDailySetFromQuestionIds(ids,1,true)});
  sync();
}

async function deleteQuestionsBulk(ids){if(!staff()||!ids.length)return;const CHUNK=450;try{for(let i=0;i<ids.length;i+=CHUNK){const batch=writeBatch(db);ids.slice(i,i+CHUNK).forEach(id=>batch.delete(doc(db,'questionBank',id)));await batch.commit()}toast(tr(`🗑 Đã xóa ${ids.length} câu hỏi.`,`🗑 Deleted ${ids.length} questions.`));await loadQuestions()}catch(e){console.error(e);toast(safeErr(e,'Xóa hàng loạt thất bại.','Bulk delete failed.'),'error')}}

async function createDailySetFromQuestionIds(ids,order=1,published=true,unit=1){if(!staff()||ids.length<1)return;try{const chosen=ids.map(id=>questions.find(q=>q.id===id)).filter(Boolean);if(chosen.length!==ids.length)throw new Error(tr('Một số câu hỏi không còn tồn tại. Hãy tải lại danh sách.','Some questions no longer exist. Reload and try again.'));const qs=chosen.map(q=>{const n=normalizeExerciseItem(q.kind,q.kind==='form'||q.kind==='rewrite'?[q.prompt,q.answer]:[q.prompt,...q.options,Number(q.correctIndex),q.explain]);if(!n)throw new Error(tr(`Câu hỏi "${String(q.prompt||'').slice(0,60)}" sai định dạng.`,`Question "${String(q.prompt||'').slice(0,60)}" is invalid.`));const x={sourceQuestionId:q.id,kind:n.kind,prompt:n.prompt,options:n.options,correctCode:encodeCorrectIndex(n.correctIndex),explain:n.explain};if(n.kind==='form'||n.kind==='rewrite')x.answer=q.answer;return x});const setId=`u${String(unit).padStart(2,'0')}d${String(order).padStart(2,'0')}`;const ref=doc(db,'sets',setId);const existing=await getDoc(ref);if(existing.exists()&&!(await appConfirm({title:tr('Ghi đè Daily Set?','Overwrite Daily Set?'),message:tr(`Unit ${unit} · Daily ${String(order).padStart(2,'0')} đã tồn tại. Ghi đè danh sách câu hỏi hiện tại?`,`Unit ${unit} · Daily ${String(order).padStart(2,'0')} already exists. Overwrite it?`),confirmText:tr('Ghi đè','Overwrite'),danger:true})))return;await setDoc(ref,{order,unitNumber:unit,dailyNumber:order,title:`Unit ${unit} · Daily ${String(order).padStart(2,'0')}`,questions:qs,totalQuestions:qs.length,passScore:Math.max(1,Math.min(qs.length,Math.ceil(qs.length*0.75))),passTotal:qs.length,published,isDaily:true,author:currentUser.email||'',updatedAt:serverTimestamp(),...(existing.exists()?{}:{createdAt:serverTimestamp()})},{merge:true});toast(tr(`🚀 Đã đưa ${qs.length} câu vào Unit ${unit} · Daily ${String(order).padStart(2,'0')} và ${published?'xuất bản':'lưu nháp'}.`,`🚀 Added ${qs.length} questions to Unit ${unit} · Daily ${String(order).padStart(2,'0')}.`));await loadSets();document.querySelector('[data-cms="questions"]')?.click();document.querySelector('[data-qsub="sets"]')?.click()}catch(e){console.error(e);toast(safeErr(e,'Không thể tạo Daily Set.','Could not create Daily Set.'),'error')}}

async function parseDocxVocabulary(file){const buf=await file.arrayBuffer(),bytes=new Uint8Array(buf);const cd=findCentralDirectory(bytes);let xmlBytes=null,off=cd.offset,end=off+cd.size;while(off<end){if(readU32(bytes,off)!==0x02014b50)break;const method=readU16(bytes,off+10),csize=readU32(bytes,off+20),nlen=readU16(bytes,off+28),elen=readU16(bytes,off+30),clen=readU16(bytes,off+32),local=readU32(bytes,off+42);const name=new TextDecoder('utf-8').decode(bytes.slice(off+46,off+46+nlen));if(name==='word/document.xml'){const lf=local;if(readU32(bytes,lf)!==0x04034b50)throw new Error(tr('DOCX local header không hợp lệ.','Invalid DOCX local header.'));const ln=readU16(bytes,lf+26),le=readU16(bytes,lf+28),data=bytes.slice(lf+30+ln+le,lf+30+ln+le+csize);xmlBytes=method===0?data:await inflateRaw(data)}off+=46+nlen+elen+clen}if(!xmlBytes)throw new Error(tr('Không tìm thấy word/document.xml trong file.','Missing word/document.xml inside file.'));return parseWordXml(new TextDecoder('utf-8').decode(xmlBytes))}
function findCentralDirectory(bytes){for(let i=bytes.length-22;i>=Math.max(0,bytes.length-66000);i--){if(readU32(bytes,i)===0x06054b50)return{offset:readU32(bytes,i+16),size:readU32(bytes,i+12)} }throw new Error(tr('File .docx không phải ZIP hợp lệ.','File is not a valid .docx archive.'))}
function readU16(b,i){return b[i]|(b[i+1]<<8)}function readU32(b,i){return (b[i]|(b[i+1]<<8)|(b[i+2]<<16)|(b[i+3]<<24))>>>0}
async function inflateRaw(data){if(!('DecompressionStream' in window))throw new Error(tr('Trình duyệt này chưa hỗ trợ đọc Word trực tiếp. Hãy dùng Chrome/Edge/Safari mới.','This browser version cannot read .docx files directly. Please use modern Chrome, Edge, or Safari.'));return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
function parseWordXml(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error(tr('Word XML bị lỗi.','Corrupted Word XML.'));const ps=[...doc.getElementsByTagNameNS('*','p')];const rows=ps.map(p=>{const runs=[...p.getElementsByTagNameNS('*','r')];let text='',bold=false;for(const run of runs){const t=[...run.getElementsByTagNameNS('*','t')].map(x=>x.textContent||'').join('');if(t){text+=t;const rpr=run.getElementsByTagNameNS('*','rPr')[0];const b=rpr&&[...rpr.children].find(x=>x.localName==='b');if(b&&b.getAttribute('w:val')!=='0'&&b.getAttribute('w:val')!=='false'&&b.getAttribute('w:val')!=='off')bold=true}}return{text:text.replace(/\s+/g,' ').trim(),bold}}).filter(x=>x.text);const out=[];let cur=null;for(const row of rows){const qm=row.text.match(/^\s*(\d+)[\.)]\s*(.+)$/);const om=row.text.match(/^\s*([ABCD])\s*[\.)\-:]\s*(.+)$/i);if(qm){if(cur)finishWordQuestion(cur,out);cur={prompt:qm[2].trim(),options:[],correctIndex:-1}}else if(om&&cur){const idx='ABCD'.indexOf(om[1].toUpperCase());cur.options[idx]=om[2].trim();if(row.bold)cur.correctIndex=idx}else if(cur&&row.text){cur.prompt+=` ${row.text}`}}if(cur)finishWordQuestion(cur,out);if(!out.length)throw new Error(tr('Không nhận được câu nào. Hãy dùng đúng mẫu Word.','No valid questions found. Please follow the standard Word format.'));return out}
function finishWordQuestion(q,out){const options=(q.options||[]).map(x=>String(x||'').trim());if(!q.prompt||options.length!==4||options.some(x=>!x)||q.correctIndex<0)return;out.push({prompt:q.prompt,options,correctIndex:q.correctIndex})}
function friendlyFileName(name){return String(name||'Word Set').replace(/[\\/:*?"<>|]/g,' ').replace(/\s+/g,' ').trim()||'Word Set'}
function openQuestion(id){const r=document.getElementById('questionEditor');const q=id?questions.find(x=>x.id===id):null;r.innerHTML=questionForm(q);document.getElementById('saveQuestion').onclick=()=>saveQuestion(id);document.getElementById('cancelQuestion').onclick=()=>{r.innerHTML=''};r.scrollIntoView({behavior:'smooth',block:'start'})}
async function saveQuestion(id){if(!staff())return;try{const kind=document.getElementById('qKind').value,prompt=document.getElementById('qPrompt').value.trim(),options=document.getElementById('qOptions').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),correctIndex=Number(document.getElementById('qCorrect').value),answer=document.getElementById('qAnswer').value.trim(),explain=document.getElementById('qExplain').value.trim();if(!prompt)throw new Error(tr('Chưa nhập câu hỏi.','Missing question prompt.'));if((kind==='mcq'&&options.length!==4)||(kind==='two'&&options.length!==2))throw new Error(kind==='mcq'?tr('MCQ phải có đúng 4 lựa chọn.','MCQ requires 4 options.'):tr('Dạng 2 lựa chọn phải có đúng 2 đáp án.','Two-choice requires 2 options.'));if(kind==='reading'&&options.length<2)throw new Error(tr('Câu đọc hiểu cần ít nhất 2 lựa chọn.','Reading questions need at least 2 options.'));if((kind==='mcq'||kind==='two'||kind==='reading')&&(!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>=options.length))throw new Error(tr('Đáp án đúng vượt quá số lựa chọn hiện có.','Selected answer index exceeds provided options.'));if((kind==='form'||kind==='rewrite')&&!answer)throw new Error(tr('Dạng này cần đáp án chữ.','This question type requires a text answer.'));const payload={unit:document.getElementById('qUnit').value,kind,prompt,options,correctIndex,answer,explain,published:document.getElementById('qPublished').checked,author:currentUser.email||'',updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'questionBank',id),payload);else await setDoc(doc(collection(db,'questionBank')),{...payload,createdAt:serverTimestamp()});toast(tr('Đã lưu câu hỏi.','Question saved.'));await loadQuestions()}catch(e){toast(safeErr(e,'Không thể lưu câu hỏi.','Could not save question.'),'error')}}
async function deleteQuestion(id){if(!staff())return;if(!(await appConfirm({title:tr('Xóa câu hỏi?','Delete question?'),message:tr('Xóa câu hỏi này?','Delete this question?'),danger:true})))return;try{await deleteDoc(doc(db,'questionBank',id));toast(tr('Đã xóa câu hỏi.','Question deleted.'));await loadQuestions()}catch(e){toast(tr('Xóa thất bại.','Delete failed.'),'error')}}

// ===== LISTENING CMS =====
async function loadListenings(){const r=document.getElementById('adminListening');if(!r)return;try{const snap=await getDocs(collection(db,'listeningContent'));listenings=[];snap.forEach(d=>listenings.push({id:d.id,...d.data()}));listenings.sort((a,b)=>String(a.unit||'').localeCompare(String(b.unit||'')));renderListeningAdmin();renderAdminOverview()}catch(e){console.error(e);r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được Listening.','Could not load listening items.')}</div>`}}
function listeningForm(x=null){x=x||{};return `<div class="cms-form"><div class="row g-3"><div class="col-md-3"><label>Unit</label><select id="lUnit" class="form-select">${Array.from({length:10},(_,i)=>`<option ${x.unit===`Unit ${i+1}`?'selected':''}>Unit ${i+1}</option>`).join('')}</select></div><div class="col-md-9"><label>${tr('Tiêu đề *','Title *')}</label><input id="lTitle" class="form-control" value="${esc(x.title||'')}" placeholder="Healthy habits listening"></div><div class="col-md-6"><label>${tr('Audio URL (MP3 hoặc YouTube)','Audio URL (MP3 or YouTube)')}</label><input id="lAudio" class="form-control" value="${esc(x.audioUrl||'')}" placeholder="https://..."></div><div class="col-md-6"><label>${tr('Trang nguồn','Reference URL')}</label><input id="lSource" class="form-control" value="${esc(x.sourceUrl||'')}" placeholder="https://..."></div><div class="col-12"><label>${tr('Câu hỏi / gợi ý (mỗi dòng một câu)','Prompts (one per line)')}</label><textarea id="lPrompts" class="form-control" rows="5">${esc((Array.isArray(x.prompts)?x.prompts:[]).join('\n'))}</textarea></div><div class="col-12"><label>${tr('Đáp án tương ứng (mỗi dòng một đáp án)','Answers (one per line)')}</label><textarea id="lAnswers" class="form-control" rows="5">${esc((Array.isArray(x.answers)?x.answers:[]).join('\n'))}</textarea></div><div class="col-12"><label>Transcript</label><textarea id="lTranscript" class="form-control" rows="5">${esc(x.transcript||'')}</textarea></div><div class="col-12"><div class="form-check form-switch"><input id="lPublished" class="form-check-input" type="checkbox" ${x.published?'checked':''}><label class="form-check-label">${tr('Đã xuất bản','Published')}</label></div></div></div><div class="form-actions"><button id="saveListening" class="btn btn-primary btn-lg">💾 ${x.id?tr('Cập nhật','Update'):tr('Thêm Listening','Add Listening')}</button><button id="cancelListening" class="btn btn-outline-secondary">${tr('Hủy','Cancel')}</button></div></div>`}
function renderListeningAdmin(){const r=document.getElementById('adminListening');if(!r)return;r.innerHTML=`<button id="newListening" class="btn btn-primary mb-3">＋ ${tr('Thêm bài Listening','Add Listening Task')}</button><div id="listeningEditor"></div><div class="cms-list">${listenings.map(x=>`<article class="cms-item"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(x.unit||'')}</span><span class="tag ${x.published?'tag-published':'tag-draft'}">${x.published?tr('Đã xuất bản','Published'):tr('Nháp','Draft')}</span></div><h4 class="mt-2 mb-0 fs-6 fw-semibold">${esc(x.title||'')}</h4></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" data-l-edit="${esc(x.id)}">${tr('Sửa','Edit')}</button><button class="btn btn-sm btn-outline-danger" data-l-del="${esc(x.id)}">${tr('Xóa','Delete')}</button></div></article>`).join('')||`<div class="muted">${tr('Chưa có bài Listening do giáo viên tạo.','No listening tasks created yet.')}</div>`}</div>`;document.getElementById('newListening').onclick=()=>openListening();r.querySelectorAll('[data-l-edit]').forEach(b=>b.onclick=()=>openListening(b.dataset.lEdit));r.querySelectorAll('[data-l-del]').forEach(b=>b.onclick=()=>deleteListening(b.dataset.lDel))}
function openListening(id){const r=document.getElementById('listeningEditor');const x=id?listenings.find(a=>a.id===id):null;r.innerHTML=listeningForm(x);document.getElementById('saveListening').onclick=()=>saveListening(id);document.getElementById('cancelListening').onclick=()=>{r.innerHTML=''};r.scrollIntoView({behavior:'smooth',block:'start'})}
async function saveListening(id){if(!staff())return;try{const title=document.getElementById('lTitle').value.trim(),audioUrl=document.getElementById('lAudio').value.trim(),sourceUrl=document.getElementById('lSource').value.trim(),prompts=document.getElementById('lPrompts').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),answers=document.getElementById('lAnswers').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!title)throw new Error(tr('Thiếu tiêu đề.','Missing title.'));if(audioUrl&&!safeUrl(audioUrl)&&!isValidYouTubeInput(audioUrl))throw new Error(tr('Link Audio / YouTube không hợp lệ (chỉ hỗ trợ https:// hoặc mã video YouTube).','Invalid Audio / YouTube URL (must be https:// or YouTube ID).'));if(sourceUrl&&!safeUrl(sourceUrl))throw new Error(tr('Link trang nguồn không hợp lệ (phải là https://).','Invalid reference URL (must start with https://).'));if(!prompts.length||!answers.length)throw new Error(tr('Cần ít nhất 1 câu hỏi và 1 đáp án.','Need at least 1 prompt and 1 answer.'));if(prompts.length!==answers.length)throw new Error(tr(`Số câu hỏi (${prompts.length}) không khớp với số đáp án (${answers.length}).`,`Prompt count (${prompts.length}) does not match answer count (${answers.length}).`));const payload={unit:document.getElementById('lUnit').value,title,audioUrl,sourceUrl,prompts,answers,transcript:document.getElementById('lTranscript').value.trim(),published:document.getElementById('lPublished').checked,author:currentUser.email||'',updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'listeningContent',id),payload);else await setDoc(doc(collection(db,'listeningContent')),{...payload,createdAt:serverTimestamp()});toast(tr('Đã lưu Listening.','Listening saved.'));await loadListenings()}catch(e){toast(safeErr(e,'Không thể lưu Listening.','Could not save listening task.'),'error')}}
async function deleteListening(id){if(!staff())return;if(!(await appConfirm({title:tr('Xóa bài Listening?','Delete listening task?'),message:tr('Xóa bài Listening này?','Delete this listening task?'),danger:true})))return;try{await deleteDoc(doc(db,'listeningContent',id));toast(tr('Đã xóa Listening.','Listening deleted.'));await loadListenings()}catch(e){toast(tr('Xóa thất bại.','Delete failed.'),'error')}}

// ===== DAILY SET BUILDER =====
async function loadSets(){
  const r=document.getElementById('adminSetManager');
  if(!r)return;
  try{
    const snap=await getDocs(collection(db,'sets'));
    sets=[]; snap.forEach(d=>sets.push({id:d.id,...d.data()}));
    sets.sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    renderDailyAdmin();
    renderAdminOverview();
  }catch(e){
    console.error(e);
    r.innerHTML=`<div class="alert alert-danger">${tr('Không tải được danh sách Daily Set.','Could not load Daily Sets.')}</div>`;
  }
}

function toSetQuestion(q){
  const kind=String(q?.kind||'mcq');
  const x={
    kind,
    prompt:String(q?.prompt||''),
    options:Array.isArray(q?.options)?q.options:[],
    correctCode: q?.correctCode ?? encodeCorrectIndex(Number(q?.correctIndex)||0),
    explain:String(q?.explain||'')
  };
  if(kind==='form'||kind==='rewrite')x.answer=String(q?.answer||'');
  if(q?.sourceQuestionId)x.sourceQuestionId=q.sourceQuestionId;
  return x;
}
function sourceToSetQuestion(q){
  const x=toSetQuestion(q);
  if(q?.correctIndex!==undefined)x.correctCode=encodeCorrectIndex(Number(q.correctIndex));
  return x;
}
function setPool(s){
  const src=Array.isArray(s?.sourceQuestions)&&s.sourceQuestions.length?s.sourceQuestions:s?.questions;
  return Array.isArray(src)?src.map(toSetQuestion):[];
}
function chooseSetQuestions(pool,count,randomize){
  const arr=pool.slice();
  if(randomize){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];
    }
  }
  return arr.slice(0,Math.max(1,Math.min(count,arr.length)));
}
function setDefaultPass(n){return Math.max(1,Math.ceil(Math.max(1,n)*0.75));}

function bindDailyWordImport(r){
  const file=r.querySelector('#dailyWordFile'),
    parse=r.querySelector('#parseDailyWord'),
    createBtn=r.querySelector('#createDailyFromWord'),
    status=r.querySelector('#dailyWordStatus'),
    preview=r.querySelector('#dailyWordPreview'),
    count=r.querySelector('#dwCount'),
    pass=r.querySelector('#dwPass'),
    title=r.querySelector('#dwTitle'),
    random=r.querySelector('#dwRandom');
  let pool=[];

  const sync=()=>{
    const n=pool.length;
    if(count){
      count.max=String(Math.max(1,n));
      if(n && (!Number(count.value)||Number(count.value)>n))count.value=String(n);
      if(Number(count.value)<1)count.value='1';
    }
    const out=n?Math.max(1,Math.min(n,Number(count?.value)||n)):0;
    if(pass){
      pass.max=String(Math.max(1,out));
      if(out && (!Number(pass.value)||Number(pass.value)>out))pass.value=String(setDefaultPass(out));
    }
    const ps=out?Math.max(1,Math.min(out,Number(pass?.value)||setDefaultPass(out))):0;
    const label=r.querySelector('#dwCountDisplay');
    if(label)label.textContent=n?tr(`Chọn ${out}/${n} câu · đạt ${ps}/${out}`,`${out}/${n} picked · pass ${ps}/${out}`):tr('Chưa đọc file','No file loaded');
    if(createBtn)createBtn.disabled=!n;
  };

  const renderPool=()=>{
    if(!preview)return;
    if(!pool.length){preview.innerHTML='';return}
    preview.innerHTML=`<div class="word-preview-head">
      <b>📄 ${esc(title?.value.trim()||'Daily Set')}</b>
      <span class="tag">${pool.length} ${tr('câu gốc','source questions')}</span>
    </div>
    <div class="word-preview-list">${pool.slice(0,30).map((q,i)=>`<article>
      <b>${i+1}. ${esc(q.prompt)}</b>
      <div class="small mt-1">${(q.options||[]).map((o,j)=>`<span class="word-opt ${j===q.correctIndex?'is-correct':''}">${String.fromCharCode(65+j)}. ${esc(o)}${j===q.correctIndex?' ✓':''}</span>`).join('')}</div>
    </article>`).join('')}</div>
    ${pool.length>30?`<div class="small muted mt-2">${tr(`Hiển thị 30/${pool.length} câu đầu. Khi tạo Set, web vẫn giữ toàn bộ ${pool.length} câu gốc.`,`Showing first 30/${pool.length} questions. All ${pool.length} source questions will be saved.`)}</div>`:''}`;
  };

  parse?.addEventListener('click',async()=>{
    pool=[]; if(createBtn)createBtn.disabled=true;
    const f=file?.files?.[0];
    if(!f){status.textContent=tr('⚠ Chưa chọn file .docx.','⚠ No .docx file selected.');return}
    if(!/\.docx$/i.test(f.name)){status.textContent=tr('⚠ Chỉ nhận file .docx.','⚠ Only .docx files are accepted.');return}
    if(f.size>15*1024*1024){status.textContent=tr('⚠ File vượt quá giới hạn 15 MB.','⚠ File exceeds the 15 MB limit.');return}
    try{
      status.textContent=tr('⏳ Đang đọc toàn bộ Word…','⏳ Reading Word file…');
      pool=await parseDocxVocabulary(f);
      if(title && !title.value.trim())title.value=friendlyFileName(f.name).replace(/\.docx$/i,'');
      renderPool(); sync();
      status.textContent=pool.length
        ? tr(`✅ File có ${pool.length} câu hợp lệ. Bạn có thể chọn số câu Daily và điều kiện đạt.`,`✅ Found ${pool.length} valid questions. Configure count and pass threshold below.`)
        : tr('❌ File không có câu hợp lệ.','❌ No valid questions found in file.');
    }catch(e){
      console.error(e);status.textContent=`❌ ${safeErr(e,'Không đọc được file Word.','Could not read Word file.')}`;
    }
  });
  [count,pass,title,random].forEach(el=>el?.addEventListener('input',sync));
  createBtn?.addEventListener('click',async()=>{
    if(!pool.length||!staff())return;
    createBtn.disabled=true;
    try{
      const unit=Number(r.querySelector('#dwUnit')?.value)||1;
      const order=Number(r.querySelector('#dwOrder').value)||1;
      const out=Math.max(1,Math.min(pool.length,Number(count?.value)||pool.length));
      const passScore=Math.max(1,Math.min(out,Number(pass?.value)||setDefaultPass(out)));
      const selected=chooseSetQuestions(pool,out,!!random?.checked);
      const setId=`u${String(unit).padStart(2,'0')}d${String(order).padStart(2,'0')}`;
      const ref=doc(db,'sets',setId),existing=await getDoc(ref);
      const qs=selected.map(sourceToSetQuestion);
      const fullPool=pool.map(sourceToSetQuestion);
      await setDoc(ref,{
        order,
        unitNumber:unit,
        dailyNumber:order,
        title:title?.value.trim()||`Unit ${unit} · Daily ${String(order).padStart(2,'0')}`,
        sourceQuestions:fullPool,
        questions:qs,
        totalQuestions:qs.length,
        sourceQuestionCount:fullPool.length,
        passScore,
        passTotal:qs.length,
        published:true,
        isDaily:true,
        source:'word-import',
        sourceFile:file?.files?.[0]?.name||'',
        author:currentUser.email||'',
        updatedAt:serverTimestamp(),
        ...(existing.exists()?{}:{createdAt:serverTimestamp()})
      },{merge:true});
      toast(tr(`🚀 Đã tạo Unit ${unit} · Daily ${String(order).padStart(2,'0')} · ${qs.length}/${fullPool.length} câu · đạt ${passScore}/${qs.length}.`,`🚀 Created Unit ${unit} · Daily ${String(order).padStart(2,'0')} · ${qs.length}/${fullPool.length} Qs · pass ${passScore}/${qs.length}.`));
      status.textContent=tr(`✅ Đã lưu Unit ${unit} · Daily ${String(order).padStart(2,'0')}. Có thể bấm “Cập nhật” ở danh sách để đổi tên, số câu hoặc điều kiện.`,`✅ Saved Unit ${unit} · Daily ${String(order).padStart(2,'0')}. Use “Edit” below to update name, count, or pass score.`);
      await loadSets();
    }catch(e){
      console.error(e);toast(tr('Không thể tạo Daily Set từ Word.','Could not create Daily Set from Word.'),'error');createBtn.disabled=false;
    }
  });
  sync();
}

function renderDailyAdmin(){
  const r=document.getElementById('adminSetManager');if(!r)return;
  const published=questions.filter(q=>q.published);
  r.innerHTML=`
  <div class="daily-word-import panel mb-3" id="dailyWordImport">
    <div class="panel-title">
      <h4>${tr('Upload Word → 1 file = 1 Daily Set','Upload Word → 1 File = 1 Daily Set')}</h4>
      <span class="tag">.DOCX</span>
    </div>
    <div class="cms-help mb-3">${tr('<b>Luồng dùng:</b> upload 1 file Word → web đọc toàn bộ câu → chọn <b>bao nhiêu câu muốn đưa ra</b> → đặt <b>tên Set</b> → đặt <b>điều kiện đạt</b> → tạo Daily. Ví dụ file 20 câu có thể tạo Daily 10/20, sau đó cập nhật thành 15/20 mà không cần upload lại.','<b>Workflow:</b> upload 1 .docx file → parse questions → choose <b>how many to serve</b> → set <b>title & pass score</b> → publish Daily. Original source questions are preserved for later edits.')}</div>
    <div class="row g-2 align-items-end">
      <div class="col-md-2"><label class="fw-bold">Unit</label><input id="dwUnit" type="number" min="1" class="form-control" value="1"></div>
      <div class="col-md-2"><label class="fw-bold">Daily #</label><input id="dwOrder" type="number" min="1" class="form-control" value="1"></div>
      <div class="col-md-4"><label class="fw-bold">${tr('Tên Daily Set','Daily Set Title')}</label><input id="dwTitle" class="form-control" placeholder="${tr('VD: Unit 3 · Music','e.g. Unit 3 · Music')}"></div>
      <div class="col-md-2"><label class="fw-bold">${tr('Số câu đưa ra','Served Qs')}</label><input id="dwCount" type="number" min="1" class="form-control" value="1"></div>
      <div class="col-md-2"><label class="fw-bold">${tr('Điều kiện đạt','Pass Score')}</label><input id="dwPass" type="number" min="1" class="form-control" value="1"></div>
      <div class="col-md-2"><label class="fw-bold">${tr('File Word','Word File')}</label><input id="dailyWordFile" class="form-control" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></div>
      <div class="col-12 d-flex flex-wrap gap-3 align-items-center mt-2">
        <label class="form-check"><input id="dwRandom" class="form-check-input me-2" type="checkbox"> ${tr('Chọn ngẫu nhiên khi lấy câu','Pick questions randomly')}</label>
        <span id="dwCountDisplay" class="tag">${tr('Chưa đọc file','No file loaded')}</span>
        <button id="parseDailyWord" class="btn btn-outline-primary">🔎 ${tr('Đọc Word','Parse Word')}</button>
        <button id="createDailyFromWord" class="btn btn-primary" disabled>🚀 ${tr('Tạo Daily Set','Create Daily Set')}</button>
      </div>
    </div>
    <div id="dailyWordStatus" class="small muted mt-3">${tr('File có bao nhiêu câu hợp lệ cũng được (tối đa 15 MB).','Any valid question count works (max 15 MB).')}</div>
    <div id="dailyWordPreview" class="word-import-preview mt-3"></div>
  </div>

  <div class="cms-help mb-3">${tr('<b>📌 Danh sách Daily Set đã tạo:</b> mỗi dòng là 1 Set. Bấm <b>✏️ Cập nhật</b> để đổi tên, số câu, câu được chọn hoặc điều kiện đạt. Dữ liệu gốc từ Word được giữ lại.','<b>📌 Published & Draft Daily Sets:</b> click <b>✏️ Edit</b> to change title, question subset, or pass score without re-uploading Word.')}</div>
  <div class="cms-list">
    ${sets.filter(s=>s.isDaily!==false).map(s=>{
      const total=Array.isArray(s.questions)?s.questions.length:0;
      const sourceCount=Array.isArray(s.sourceQuestions)?s.sourceQuestions.length:total;
      const pass=Math.max(1,Math.min(total,Number(s.passScore)||setDefaultPass(total||1)));
      return `<article class="cms-item">
        <div>
          <div class="d-flex gap-2 flex-wrap">
            <span class="tag">UNIT ${String(Number(s.unitNumber||1)).padStart(2,'0')} · DAILY ${String(Number(s.dailyNumber||s.order||0)).padStart(2,'0')}</span>
            <span class="tag ${s.published?'tag-published':'tag-draft'}">${s.published?tr('Đã xuất bản','Published'):tr('Nháp','Draft')}</span>
          </div>
          <h4 class="mt-2 mb-0 fs-6 fw-semibold">${esc(s.title||tr('Không có tên','Untitled'))}</h4>
          <small class="muted">${total}/${sourceCount} ${tr('câu','Qs')} · ${tr('đạt','pass')} ${pass}/${total||0}</small>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-primary" data-d-edit="${esc(s.id)}">✏️ ${tr('Cập nhật','Edit')}</button>
          <button class="btn btn-sm btn-outline-danger" data-d-del="${esc(s.id)}">${tr('Xóa','Delete')}</button>
        </div>
      </article>`;
    }).join('')||`<div class="muted">${tr('Chưa có Daily Set. Upload file Word ở trên để tạo Set đầu tiên.','No Daily Sets yet. Upload a .docx file above to create one.')}</div>`}
  </div>

  <div id="dailyEditor" class="mt-3"></div>

  <details class="mt-4">
    <summary class="fw-bold">⚙ ${tr('Tạo Daily từ ngân hàng câu hỏi thủ công','Build Daily Set from Question Bank')}</summary>
    <div class="cms-form mt-3">
      <div class="row g-3">
        <div class="col-md-2"><label>Unit</label><input id="dUnit" type="number" min="1" class="form-control" value="1"></div>
        <div class="col-md-2"><label>Daily #</label><input id="dOrder" type="number" min="1" class="form-control" value="1"></div>
        <div class="col-md-7"><label>${tr('Tiêu đề','Title')}</label><input id="dTitle" class="form-control" placeholder="Daily Set"></div>
        <div class="col-md-2"><label>${tr('Điều kiện đạt','Pass Score')}</label><input id="dPassScore" type="number" min="1" class="form-control" value="1"></div>
        <div class="col-12"><label>${tr('Chọn câu hỏi','Select questions')} <span id="dSelectedCount" class="badge text-bg-primary">0 ${tr('câu','Qs')}</span></label><div class="question-picker">${published.map(q=>`<label class="question-pick"><input type="checkbox" value="${esc(q.id)}"><span><b>${esc(q.unit||'')}</b> · ${esc(q.prompt||'').slice(0,120)}</span></label>`).join('')||`<div class="muted">${tr('Chưa có câu hỏi đã xuất bản.','No published questions in bank.')}</div>`}</div></div>
        <div class="col-12"><div class="form-check form-switch"><input id="dPublished" class="form-check-input" type="checkbox"><label class="form-check-label">${tr('Đã xuất bản','Published')}</label></div></div>
      </div>
      <div class="form-actions"><button id="saveDaily" class="btn btn-primary">💾 ${tr('Lưu Daily Set thủ công','Save Manual Daily Set')}</button></div>
    </div>
  </details>`;
  bindDailyWordImport(r);
  bindManualDailyEditor(r);
  r.querySelectorAll('[data-d-edit]').forEach(b=>b.onclick=()=>openSetEditor(b.dataset.dEdit));
  r.querySelectorAll('[data-d-del]').forEach(b=>b.onclick=()=>deleteDaily(b.dataset.dDel));
}

function bindManualDailyEditor(r){
  const update=()=>{
    const n=r.querySelectorAll('.question-pick input:checked').length;
    const el=r.querySelector('#dSelectedCount');if(el)el.textContent=`${n} ${tr('câu','Qs')}`;
    const pass=r.querySelector('#dPassScore');
    if(pass){pass.max=String(Math.max(1,n));if(n&&(!Number(pass.value)||Number(pass.value)>n))pass.value=String(setDefaultPass(n));}
  };
  r.querySelectorAll('.question-pick input').forEach(c=>c.onchange=update);
  r.querySelector('#dPassScore')?.addEventListener('input',update);
  r.querySelector('#saveDaily')?.addEventListener('click',async()=>{
    if(!staff())return;
    try{
      const unit=Number(r.querySelector('#dUnit').value)||1;
      const order=Number(r.querySelector('#dOrder').value)||1;
      const title=r.querySelector('#dTitle').value.trim()||`Unit ${unit} · Daily ${String(order).padStart(2,'0')}`;
      const ids=[...r.querySelectorAll('.question-pick input:checked')].map(x=>x.value);
      if(!ids.length)throw new Error(tr('Hãy chọn ít nhất 1 câu.','Select at least 1 question.'));
      const chosen=ids.map(id=>questions.find(q=>q.id===id)).filter(Boolean);
      const qs=chosen.map(sourceToSetQuestion);
      const pass=Math.max(1,Math.min(qs.length,Number(r.querySelector('#dPassScore').value)||setDefaultPass(qs.length)));
      const setId=`u${String(unit).padStart(2,'0')}d${String(order).padStart(2,'0')}`;
      const existing=await getDoc(doc(db,'sets',setId));
      await setDoc(doc(db,'sets',setId),{
        order,unitNumber:unit,dailyNumber:order,title,questions:qs,sourceQuestions:qs,totalQuestions:qs.length,sourceQuestionCount:qs.length,
        passScore:pass,passTotal:qs.length,published:r.querySelector('#dPublished').checked,isDaily:true,
        author:currentUser.email||'',updatedAt:serverTimestamp(),...(existing.exists()?{}:{createdAt:serverTimestamp()})
      },{merge:true});
      toast(tr(`Đã lưu Daily Set · ${qs.length} câu · đạt ${pass}/${qs.length}.`,`Saved Daily Set · ${qs.length} Qs · pass ${pass}/${qs.length}.`));
      await loadSets();
    }catch(e){console.error(e);toast(safeErr(e,'Không thể lưu Daily Set.','Could not save Daily Set.'),'error')}
  });
}

function openSetEditor(id){
  const s=sets.find(x=>x.id===id);if(!s)return;
  const root=document.getElementById('dailyEditor');if(!root)return;
  const pool=setPool(s);const current=Array.isArray(s.questions)?s.questions:[];
  const currentKeys=new Set(current.map(q=>String(q.prompt||'').trim()));
  const order=Number(s.order)||1,unit=Number(s.unitNumber)||1,total=current.length,sourceCount=pool.length;
  const pass=Math.max(1,Math.min(total||1,Number(s.passScore)||setDefaultPass(total||1)));
  root.innerHTML=`<div class="cms-form panel">
    <div class="panel-title"><h4>✏️ ${esc(s.title||`Daily ${String(order).padStart(2,'0')}`)}</h4><span class="tag">${total}/${sourceCount} ${tr('câu','Qs')}</span></div>
    <div class="row g-3 mt-1">
      <div class="col-md-2"><label>Unit</label><input id="eUnit" type="number" min="1" class="form-control" value="${unit}"></div>
      <div class="col-md-2"><label>Daily #</label><input id="eOrder" type="number" min="1" class="form-control" value="${order}"></div>
      <div class="col-md-5"><label>${tr('Tên Set','Title')}</label><input id="eTitle" class="form-control" value="${esc(s.title||'')}"></div>
      <div class="col-md-2"><label>${tr('Số câu đưa ra','Served Qs')}</label><input id="eCount" type="number" min="1" max="${Math.max(1,sourceCount)}" class="form-control" value="${Math.max(1,total)}"></div>
      <div class="col-md-3"><label>${tr('Điều kiện đạt','Pass Score')}</label><input id="ePass" type="number" min="1" max="${Math.max(1,total)}" class="form-control" value="${pass}"></div>
      <div class="col-12"><label>${tr('Chọn câu từ file gốc','Select from source bank')} <span id="eSelectedCount" class="badge text-bg-primary">${total}/${sourceCount}</span></label>
        <div class="question-picker" id="eSourcePicker">${pool.map((q,i)=>{
          const checked=currentKeys.has(String(q.prompt||'').trim());
          return `<label class="question-pick ${checked?'selected':''}"><input type="checkbox" data-source-index="${i}" ${checked?'checked':''}><span><b>${tr('Câu','Q')} ${i+1}</b> · ${esc(q.prompt||'').slice(0,160)}</span></label>`;
        }).join('')||`<div class="muted">${tr('Set cũ không có dữ liệu nguồn để chỉnh số câu.','Legacy Set has no source bank.')}</div>`}</div>
      </div>
      <div class="col-12"><div class="form-check form-switch"><input id="ePublished" class="form-check-input" type="checkbox" ${s.published!==false?'checked':''}><label class="form-check-label">${tr('Đã xuất bản','Published')}</label></div></div>
    </div>
    <div class="form-actions">
      <button id="saveSetUpdate" class="btn btn-primary btn-lg">💾 ${tr('Cập nhật Set','Update Set')}</button>
      <button id="cancelSetUpdate" class="btn btn-outline-secondary">${tr('Hủy','Cancel')}</button>
    </div>
  </div>`;
  const sync=()=>{
    const checked=[...root.querySelectorAll('#eSourcePicker input:checked')];
    const n=checked.length;
    root.querySelector('#eSelectedCount').textContent=`${n}/${sourceCount}`;
    const c=root.querySelector('#eCount');if(c){c.max=String(Math.max(1,sourceCount));if(Number(c.value)>n&&n)c.value=String(n);if(Number(c.value)<1)c.value='1';}
    const out=Math.max(1,Math.min(sourceCount,Number(c?.value)||n||1));
    const p=root.querySelector('#ePass');if(p){p.max=String(out);if(Number(p.value)>out||!Number(p.value))p.value=String(setDefaultPass(out));}
    root.querySelectorAll('.question-pick').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked));
  };
  root.querySelectorAll('#eSourcePicker input').forEach(c=>c.addEventListener('change',sync));
  root.querySelector('#eCount')?.addEventListener('input',sync);
  root.querySelector('#ePass')?.addEventListener('input',sync);
  root.querySelector('#cancelSetUpdate').onclick=()=>{root.innerHTML='';window.scrollTo({top:0,behavior:'smooth'})};
  root.querySelector('#saveSetUpdate').onclick=async()=>{
    if(!staff())return;
    try{
      const checked=[...root.querySelectorAll('#eSourcePicker input:checked')].map(x=>Number(x.dataset.sourceIndex));
      const wanted=Math.max(1,Math.min(sourceCount,Number(root.querySelector('#eCount').value)||checked.length));
      let selected=checked.map(i=>pool[i]).filter(Boolean);
      if(selected.length>wanted)selected=selected.slice(0,wanted);
      if(selected.length<wanted){
        const remaining=pool.filter((_,i)=>!checked.includes(i));
        selected=selected.concat(remaining.slice(0,wanted-selected.length));
      }
      if(!selected.length)throw new Error(tr('Hãy chọn ít nhất 1 câu.','Select at least 1 question.'));
      const pass=Math.max(1,Math.min(selected.length,Number(root.querySelector('#ePass').value)||setDefaultPass(selected.length)));
      const newOrder=Number(root.querySelector('#eOrder').value)||order;
      const newUnit=Number(root.querySelector('#eUnit').value)||unit;
      const newId=`u${String(newUnit).padStart(2,'0')}d${String(newOrder).padStart(2,'0')}`;
      const payload={
        order:newOrder,unitNumber:newUnit,dailyNumber:newOrder,title:root.querySelector('#eTitle').value.trim()||`Unit ${newUnit} · Daily ${String(newOrder).padStart(2,'0')}`,
        questions:selected.map(toSetQuestion),totalQuestions:selected.length,passScore:pass,passTotal:selected.length,
        published:root.querySelector('#ePublished').checked,isDaily:true,sourceQuestions:pool.map(toSetQuestion),
        sourceQuestionCount:pool.length,updatedAt:serverTimestamp()
      };
      if(newId!==id){
        const existing=await getDoc(doc(db,'sets',newId));
        if(existing.exists())throw new Error(tr(`Daily Set ${String(newOrder).padStart(2,'0')} đã tồn tại.`,`Daily Set ${String(newOrder).padStart(2,'0')} already exists.`));
        await setDoc(doc(db,'sets',newId),{...payload,createdAt:serverTimestamp()});
        await deleteDoc(doc(db,'sets',id));
      }else{
        await updateDoc(doc(db,'sets',id),payload);
      }
      toast(tr(`✅ Đã cập nhật ${payload.title} · ${selected.length}/${pool.length} câu · đạt ${pass}/${selected.length}.`,`✅ Updated ${payload.title} · ${selected.length}/${pool.length} Qs · pass ${pass}/${selected.length}.`));
      root.innerHTML='';await loadSets();
    }catch(e){console.error(e);toast(safeErr(e,'Cập nhật Set thất bại.','Failed to update Set.'),'error')}
  };
  sync();
  root.scrollIntoView({behavior:'smooth',block:'start'});
}

async function deleteDaily(id){
  if(!staff()||!(await appConfirm({title:tr('Xóa Daily Set?','Delete Daily Set?'),message:tr('Xóa Daily Set này?','Delete this Daily Set?'),danger:true})))return;
  try{await deleteDoc(doc(db,'sets',id));toast(tr('Đã xóa Daily Set.','Daily Set deleted.'));await loadSets();}
  catch(e){toast(tr('Xóa thất bại.','Delete failed.'),'error')}
}

// ===== WORD EXPORT (2 SEPARATE FILES BY CLASS + PRESET CONFIGURATION) =====
const xmlEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function crc32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concatBytes(parts){const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function zipStore(files){const enc=new TextEncoder(),local=[],central=[];let offset=0;for(const file of files){const name=enc.encode(file.name),data=typeof file.data==='string'?enc.encode(file.data):file.data,crc=crc32(data);const head=concatBytes([new Uint8Array([0x50,0x4b,0x03,0x04,20,0,0,0,0,0,0,0,0,0]),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);local.push(head);const ch=concatBytes([new Uint8Array([0x50,0x4b,0x01,0x02,20,0,20,0,0,0,0,0,0,0,0,0]),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);central.push(ch);offset+=head.length}const cd=concatBytes(central),allLocal=concatBytes(local);const end=concatBytes([new Uint8Array([0x50,0x4b,0x05,0x06,0,0,0,0]),u16(files.length),u16(files.length),u32(cd.length),u32(allLocal.length),u16(0)]);return concatBytes([allLocal,cd,end])}
function wRun(text,bold=false,size=22){return `<w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`}
function wCell(text,width,bold=false,align='left'){return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="B7C0CE"/><w:left w:val="single" w:sz="4" w:space="0" w:color="B7C0CE"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="B7C0CE"/><w:right w:val="single" w:sz="4" w:space="0" w:color="B7C0CE"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="0"/></w:pPr>${wRun(text,bold,20)}</w:p></w:tc>`}
function wRow(cells,columns,header=false){return `<w:tr>${columns.map((col,i)=>wCell(String(cells[i]??''),col.width,header,header&&col.align==='left'?'left':col.align)).join('')}</w:tr>`}

function buildDocxSpec(preset,includeClass){
  if(preset==='detailed'){
    return includeClass ? [
      {label:tr('STT','#'),width:650,align:'center'},
      {label:tr('Học sinh','Student'),width:2950,align:'left'},
      {label:tr('Lớp','Class'),width:950,align:'center'},
      {label:'Streak',width:900,align:'center'},
      {label:tr('Set pass','Passed'),width:950,align:'center'},
      {label:'Bonus',width:900,align:'center'},
      {label:tr('Gần nhất','Last Active'),width:1300,align:'center'}
    ] : [
      {label:tr('STT','#'),width:700,align:'center'},
      {label:tr('Học sinh','Student'),width:3500,align:'left'},
      {label:'Streak',width:1000,align:'center'},
      {label:tr('Set pass','Passed'),width:1000,align:'center'},
      {label:'Bonus',width:1000,align:'center'},
      {label:tr('Gần nhất','Last Active'),width:1400,align:'center'}
    ];
  }
  if(preset==='today'){
    return includeClass ? [
      {label:tr('STT','#'),width:700,align:'center'},
      {label:tr('Học sinh','Student'),width:4100,align:'left'},
      {label:tr('Lớp','Class'),width:1100,align:'center'},
      {label:tr('Hôm nay','Today'),width:1600,align:'center'},
      {label:'Streak',width:1100,align:'center'}
    ] : [
      {label:tr('STT','#'),width:800,align:'center'},
      {label:tr('Học sinh','Student'),width:5200,align:'left'},
      {label:tr('Hôm nay','Today'),width:1500,align:'center'},
      {label:'Streak',width:1100,align:'center'}
    ];
  }
  return includeClass ? [
    {label:tr('STT','#'),width:800,align:'center'},
    {label:tr('Học sinh','Student'),width:5000,align:'left'},
    {label:tr('Lớp','Class'),width:1400,align:'center'},
    {label:'🔥 Streak',width:1400,align:'center'}
  ] : [
    {label:tr('STT','#'),width:900,align:'center'},
    {label:tr('Học sinh','Student'),width:6300,align:'left'},
    {label:'🔥 Streak',width:1400,align:'center'}
  ];
}

function buildDocxBytes(columns,rows,title,subtitle,footerSummary){
  const grid=`<w:tblGrid>${columns.map(c=>`<w:gridCol w:w="${c.width}"/>`).join('')}</w:tblGrid>`;
  const headerRow=wRow(columns.map(c=>c.label),columns,true);
  const bodyRows=rows.map(r=>wRow(r,columns,false)).join('');
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="140"/></w:pPr>${wRun(title,true,30)}</w:p><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="220"/></w:pPr>${wRun(subtitle,false,20)}</w:p><w:tbl><w:tblPr><w:tblW w:w="8600" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="7A8699"/><w:left w:val="single" w:sz="6" w:color="7A8699"/><w:bottom w:val="single" w:sz="6" w:color="7A8699"/><w:right w:val="single" w:sz="6" w:color="7A8699"/><w:insideH w:val="single" w:sz="4" w:color="B7C0CE"/><w:insideV w:val="single" w:sz="4" w:color="B7C0CE"/></w:tblBorders></w:tblPr>${grid}${headerRow}${bodyRows}</w:tbl><w:p><w:pPr><w:spacing w:before="220"/></w:pPr>${wRun(footerSummary,true,20)}</w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wordRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const files=[{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:documentXml},{name:'word/_rels/document.xml.rels',data:wordRels}];
  return zipStore(files);
}

function triggerSingleDownload(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

function openWordSplitDownloadModal(jobs,todayStr,presetTag){
  const oldCfgModal=document.getElementById('exportConfigModal');
  if(oldCfgModal){
    try{window.bootstrap?.Modal?.getInstance(oldCfgModal)?.dispose();}catch{}
    oldCfgModal.remove();
  }
  document.getElementById('wordSplitDownloadModal')?.remove();
  document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');

  const wrap=document.createElement('div');
  wrap.className='modal fade';
  wrap.id='wordSplitDownloadModal';
  wrap.tabIndex=-1;
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML=`
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title fw-bold">📄 ${tr('Tải 2 file Word theo lớp','Download 2 Separate Word Files')}</h5>
            <p class="small muted mb-0">${tr('Bấm tải từng lớp ngay trên web (không bật cảnh báo trình duyệt) hoặc gộp 1 gói ZIP.','Download each class file individually here or grab both inside one ZIP archive.')}</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${tr('Đóng','Close')}"></button>
        </div>
        <div class="modal-body">
          <div class="word-split-list">
            <div class="word-split-card">
              <div class="word-split-meta">
                <strong>📘 ${tr('Lớp 11T1','Class 11T1')} · ${jobs[0].count} ${tr('HS','students')}</strong>
                <small>${esc(jobs[0].filename)}</small>
                <span class="tag tag-published mt-1" id="splitStatus0">✓ ${tr('Đã tải xong','Downloaded')}</span>
              </div>
              <button type="button" class="btn btn-sm btn-outline-secondary" id="splitBtn0">↻ ${tr('Tải lại 11T1','Re-download')}</button>
            </div>
            <div class="word-split-card">
              <div class="word-split-meta">
                <strong>📗 ${tr('Lớp 11.1','Class 11.1')} · ${jobs[1].count} ${tr('HS','students')}</strong>
                <small>${esc(jobs[1].filename)}</small>
                <span class="tag mt-1" id="splitStatus1">${tr('Sẵn sàng tải','Ready to download')}</span>
              </div>
              <button type="button" class="btn btn-sm btn-primary fw-bold" id="splitBtn1">⬇ ${tr('Tải Lớp 11.1 (.docx)','Download 11.1 (.docx)')}</button>
            </div>
          </div>
        </div>
        <div class="modal-footer justify-content-between flex-wrap gap-2">
          <button type="button" class="btn btn-outline-primary" id="splitBtnZip">🗜 ${tr('Tải 1 file .zip (cả 2 lớp)','Download .zip (both files)')}</button>
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${tr('Đóng','Close')}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(wrap);
  const modal=window.bootstrap?.Modal?.getOrCreateInstance(wrap);
  if(!modal){wrap.remove();return;}
  wrap.addEventListener('hidden.bs.modal',()=>{wrap.remove();},{once:true});

  wrap.querySelector('#splitBtn0').onclick=()=>{
    triggerSingleDownload(jobs[0].blob,jobs[0].filename);
    const s0=wrap.querySelector('#splitStatus0');
    if(s0)s0.textContent=`✓ ${tr('Đã tải lại','Re-downloaded')}`;
  };
  wrap.querySelector('#splitBtn1').onclick=()=>{
    triggerSingleDownload(jobs[1].blob,jobs[1].filename);
    const s1=wrap.querySelector('#splitStatus1');
    if(s1){s1.className='tag tag-published mt-1';s1.textContent=`✓ ${tr('Đã tải xong','Downloaded')}`;}
    const b1=wrap.querySelector('#splitBtn1');
    if(b1){b1.className='btn btn-sm btn-outline-secondary';b1.textContent=`↻ ${tr('Tải lại 11.1','Re-download')}`;}
  };
  wrap.querySelector('#splitBtnZip').onclick=()=>{
    const zipBytes=zipStore([
      {name:jobs[0].filename,data:jobs[0].bytes},
      {name:jobs[1].filename,data:jobs[1].bytes}
    ]);
    const zipBlob=new Blob([zipBytes],{type:'application/zip'});
    triggerSingleDownload(zipBlob,`english-notebook-2-classes-${presetTag}-${todayStr}.zip`);
    toast(tr('Đã tải gói ZIP gồm 2 file Word 11T1 & 11.1.','Downloaded ZIP archive with 11T1 & 11.1 Word files.'));
  };
  modal.show();
}

async function exportStudentsStreak(overrideCfg=null){
  if(!staff())return false;
  const cfg=overrideCfg||getExportConfig();
  try{
    const [userSnap,subSnap,rosterData]=await Promise.all([
      getDocs(collection(db,'users')),
      getDocs(collection(db,'submissions')),
      readRoster(true)
    ]);
    const normName=v=>String(v??'').trim().replace(/\s+/g,' ').toLowerCase();
    const progress=progressFromSubmissionDocs(subSnap.docs);
    const usersByUid=new Map(),usersByRoster=new Map(),usersByNameAndClass=new Map(),usersByName=new Map();

    userSnap.forEach(d=>{
      const x=d.data()||{}, userRole=String(x.role||'student');
      const isOwnerStudent=userRole==='admin'&&(String(x.rosterId||'')==='s45'||String(x.rosterId||'')==='11T1_s45');
      if((userRole==='admin'&&!isOwnerStudent)||userRole==='teacher'||x.rosterId==='__teacher_dat__')return;
      const row={uid:d.id,...x};
      usersByUid.set(d.id,row);
      if(x.rosterId)usersByRoster.set(String(x.rosterId),row);
      if(x.name){
        usersByNameAndClass.set(`${normName(x.name)}_${x.className||'11T1'}`,row);
        usersByName.set(normName(x.name),row);
      }
    });

    const today=localToday();
    const hydrateStudentList=(list,cls)=>list.map((r,i)=>{
      const user=usersByRoster.get(String(r.id||''))
        ||(r.legacyId&&usersByRoster.get(String(r.legacyId)))
        ||usersByNameAndClass.get(`${normName(r.name)}_${r.className||cls}`)
        ||usersByName.get(normName(r.name));
      const uid=String(user?.uid||'');
      const p=uid?(progress.get(uid)||{streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''}):{streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''};
      const lastDate=p.lastCompletedDate||user?.lastCompletedDate||'';
      return {
        stt:Number(r.stt||i+1),
        name:String(r.name||user?.name||tr('Học sinh','Student')),
        className:String(r.className||cls||'11T1'),
        streak:Number(p.streak||0),
        totalPassed:Number(p.totalPassed||0),
        totalBonus:Number(p.totalBonus||0),
        lastCompletedDate:lastDate,
        doneToday:lastDate===today
      };
    });

    const applyFilterAndSort=(rows)=>{
      let out=rows.filter(x=>{
        if(cfg.filter==='active')return x.streak>0;
        if(cfg.filter==='zero')return x.streak===0;
        if(cfg.filter==='today')return x.doneToday;
        if(cfg.filter==='notToday')return !x.doneToday;
        return true;
      });
      if(cfg.sort==='name'){
        out.sort((a,b)=>a.name.localeCompare(b.name,'vi')||a.stt-b.stt);
      }else if(cfg.sort==='streakDesc'){
        out.sort((a,b)=>(b.streak-a.streak)||(b.totalPassed-a.totalPassed)||a.stt-b.stt);
      }else{
        out.sort((a,b)=>a.stt-b.stt);
      }
      return out;
    };

    const toRowCells=(x,includeClass)=>{
      if(cfg.preset==='detailed'){
        return includeClass
          ?[x.stt,x.name,x.className,x.streak,x.totalPassed,x.totalBonus,x.lastCompletedDate||'—']
          :[x.stt,x.name,x.streak,x.totalPassed,x.totalBonus,x.lastCompletedDate||'—'];
      }
      if(cfg.preset==='today'){
        const todayText=x.doneToday?tr('✓ Đã làm','✓ Done'):tr('Chưa làm','Pending');
        return includeClass
          ?[x.stt,x.name,x.className,todayText,x.streak]
          :[x.stt,x.name,todayText,x.streak];
      }
      return includeClass
        ?[x.stt,x.name,x.className,x.streak]
        :[x.stt,x.name,x.streak];
    };

    const docxMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const buildJob=(cls,students,includeClass)=>{
      const filtered=applyFilterAndSort(students);
      const columns=buildDocxSpec(cfg.preset,includeClass);
      const rows=filtered.map(x=>toRowCells(x,includeClass));
      const classLabel=cls==='ALL'?tr('KHỐI 11 (11T1 & 11.1)','GRADE 11 (11T1 & 11.1)'):tr(`LỚP ${cls}`,`CLASS ${cls}`);
      const title=tr(`DANH SÁCH HỌC SINH ${classLabel}`,`STUDENT PROGRESS REPORT · ${classLabel}`);
      const subtitle=tr(`Cập nhật ngày ${today} · Mẫu: ${getExportPresetLabel(cfg.preset)}`,`Updated ${today} · Preset: ${getExportPresetLabel(cfg.preset)}`);
      const footer=tr(`Tổng số: ${rows.length} học sinh`,`Total: ${rows.length} students`);
      const fileTag=cls==='ALL'?'khoi11':cls;
      const filename=`english-notebook-${fileTag}-${cfg.preset}-${today}.docx`;
      const bytes=buildDocxBytes(columns,rows,title,subtitle,footer);
      const blob=new Blob([bytes],{type:docxMime});
      return {cls,filename,bytes,blob,count:rows.length};
    };

    const jobs=[];
    if(cfg.mode==='split'){
      jobs.push(buildJob('11T1',hydrateStudentList(rosterData['11T1']||[],'11T1'),false));
      jobs.push(buildJob('11.1',hydrateStudentList(rosterData['11.1']||[],'11.1'),false));
    }else if(cfg.mode==='11T1'){
      jobs.push(buildJob('11T1',hydrateStudentList(rosterData['11T1']||[],'11T1'),false));
    }else if(cfg.mode==='11.1'){
      jobs.push(buildJob('11.1',hydrateStudentList(rosterData['11.1']||[],'11.1'),false));
    }else{
      const combined=[
        ...hydrateStudentList(rosterData['11T1']||[],'11T1'),
        ...hydrateStudentList(rosterData['11.1']||[],'11.1')
      ];
      jobs.push(buildJob('ALL',combined,true));
    }

    if(jobs.length===2){
      triggerSingleDownload(jobs[0].blob,jobs[0].filename);
      openWordSplitDownloadModal(jobs,today,cfg.preset);
      toast(tr(
        `Đã tải Lớp 11T1 (${jobs[0].count} HS) — bấm tải Lớp 11.1 trong hộp thoại.`,
        `Downloaded 11T1 (${jobs[0].count}) — click 11.1 in the dialog to save the second file.`
      ));
    }else{
      triggerSingleDownload(jobs[0].blob,jobs[0].filename);
      toast(tr(
        `Đã xuất Word: ${jobs[0].count} học sinh.`,
        `Exported Word: ${jobs[0].count} students.`
      ));
    }
    return true;
  }catch(e){
    console.error('Export streak Word:',e);
    toast(tr('Không thể xuất Word.','Word export failed.'),'error');
    return false;
  }
}

function openExportConfigModal(triggerEl=null){
  document.getElementById('exportConfigModal')?.remove();
  const cfg=getExportConfig();
  const presets=[
    {
      id:'p1',
      mode:'split',preset:'streak',filter:'all',sort:'stt',
      title:tr('2 lớp tách 2 file · Điểm Streak','2 Split Files · Streak Score'),
      desc:tr('Xuất riêng file 11T1.docx và 11.1.docx gồm STT, Họ tên, Streak.','Exports separate 11T1 & 11.1 Word files with #, Name, Streak.')
    },
    {
      id:'p2',
      mode:'split',preset:'detailed',filter:'all',sort:'stt',
      title:tr('2 lớp tách 2 file · Chi tiết','2 Split Files · Detailed'),
      desc:tr('Thêm số Set pass, Bonus và ngày hoàn thành gần nhất.','Includes Sets Passed, Bonus points, and Last Active date.')
    },
    {
      id:'p3',
      mode:'split',preset:'today',filter:'all',sort:'stt',
      title:tr('2 lớp tách 2 file · Điểm danh hôm nay','2 Split Files · Today Check'),
      desc:tr('Hiển thị trạng thái Đã làm / Chưa làm trong ngày hôm nay.','Shows Done / Pending status for today beside Streak.')
    },
    {
      id:'p4',
      mode:'split',preset:'detailed',filter:'all',sort:'streakDesc',
      title:tr('2 lớp tách 2 file · Xếp hạng Streak ↓','2 Split Files · Ranked by Streak'),
      desc:tr('Tách 2 lớp, sắp xếp học sinh có Streak cao nhất lên đầu.','Separate files per class sorted highest Streak first.')
    }
  ];

  const wrap=document.createElement('div');
  wrap.className='modal fade';
  wrap.id='exportConfigModal';
  wrap.tabIndex=-1;
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML=`
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title fw-bold">📄 ${tr('Cấu hình xuất Word & Mẫu có sẵn','Word Export Configuration & Presets')}</h5>
            <p class="small muted mb-0">${tr('Mặc định xuất tách riêng 2 lớp 11T1 và 11.1 thành 2 file Word độc lập.','Defaults to exporting 11T1 and 11.1 into 2 separate Word files.')}</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${tr('Đóng','Close')}"></button>
        </div>
        <div class="modal-body">
          <div class="fw-bold small mb-2">${tr('1. Chọn nhanh cấu hình sẵn','1. One-click presets')}</div>
          <div class="export-preset-grid mb-4">
            ${presets.map(p=>{
              const active=cfg.mode===p.mode&&cfg.preset===p.preset&&cfg.filter===p.filter&&cfg.sort===p.sort;
              return `<button type="button" class="export-preset-card ${active?'is-active':''}" data-exp-preset="${p.id}">
                <strong>${esc(p.title)}</strong>
                <span>${esc(p.desc)}</span>
              </button>`;
            }).join('')}
          </div>

          <div class="fw-bold small mb-2">${tr('2. Tùy chỉnh chi tiết','2. Custom options')}</div>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">${tr('Phạm vi xuất file','File Scope')}</label>
              <select id="expCfgMode" class="form-select">
                <option value="split" ${cfg.mode==='split'?'selected':''}>${tr('Tách 2 lớp thành 2 file riêng (11T1 + 11.1)','2 separate files (11T1 + 11.1)')}</option>
                <option value="11T1" ${cfg.mode==='11T1'?'selected':''}>${tr('Chỉ xuất lớp 11T1 (1 file)','Only class 11T1 (1 file)')}</option>
                <option value="11.1" ${cfg.mode==='11.1'?'selected':''}>${tr('Chỉ xuất lớp 11.1 (1 file)','Only class 11.1 (1 file)')}</option>
                <option value="combined" ${cfg.mode==='combined'?'selected':''}>${tr('Gộp chung 2 lớp (1 file)','Merge both classes (1 file)')}</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">${tr('Cột dữ liệu','Columns')}</label>
              <select id="expCfgPreset" class="form-select">
                <option value="streak" ${cfg.preset==='streak'?'selected':''}>${tr('Cơ bản (STT · Học sinh · Streak)','Basic (# · Student · Streak)')}</option>
                <option value="detailed" ${cfg.preset==='detailed'?'selected':''}>${tr('Chi tiết (Streak · Set pass · Bonus · Ngày)','Detailed (Streak · Passed · Bonus · Date)')}</option>
                <option value="today" ${cfg.preset==='today'?'selected':''}>${tr('Điểm danh (Hôm nay · Streak)','Attendance (Today · Streak)')}</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">${tr('Lọc học sinh','Student Filter')}</label>
              <select id="expCfgFilter" class="form-select">
                <option value="all" ${cfg.filter==='all'?'selected':''}>${tr('Tất cả học sinh trong lớp','All students in class')}</option>
                <option value="today" ${cfg.filter==='today'?'selected':''}>${tr('Đã làm Daily hôm nay','Completed Daily today')}</option>
                <option value="notToday" ${cfg.filter==='notToday'?'selected':''}>${tr('Chưa làm Daily hôm nay','Pending Daily today')}</option>
                <option value="active" ${cfg.filter==='active'?'selected':''}>${tr('Đang có Streak > 0','Streak > 0')}</option>
                <option value="zero" ${cfg.filter==='zero'?'selected':''}>${tr('Streak = 0','Streak = 0')}</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">${tr('Sắp xếp danh sách','Sort Order')}</label>
              <select id="expCfgSort" class="form-select">
                <option value="stt" ${cfg.sort==='stt'?'selected':''}>${tr('Theo STT danh sách lớp','By Roster #')}</option>
                <option value="name" ${cfg.sort==='name'?'selected':''}>${tr('Theo Tên (A → Z)','By Name (A → Z)')}</option>
                <option value="streakDesc" ${cfg.sort==='streakDesc'?'selected':''}>${tr('Theo Streak (Cao → Thấp)','By Streak (High → Low)')}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer justify-content-between flex-wrap gap-2">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${tr('Đóng','Close')}</button>
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" id="expCfgSave" class="btn btn-outline-primary">${tr('Lưu cấu hình','Save Config')}</button>
            <button type="button" id="expCfgExportNow" class="btn btn-primary">⇩ ${tr('Lưu & Xuất Word ngay','Save & Export Now')}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  const modal=window.bootstrap?.Modal?.getOrCreateInstance(wrap);
  if(!modal){wrap.remove();return}
  wrap.addEventListener('hidden.bs.modal',()=>{triggerEl?.focus?.();wrap.remove()},{once:true});

  const modeEl=wrap.querySelector('#expCfgMode');
  const presetEl=wrap.querySelector('#expCfgPreset');
  const filterEl=wrap.querySelector('#expCfgFilter');
  const sortEl=wrap.querySelector('#expCfgSort');
  const readForm=()=>({mode:modeEl.value,preset:presetEl.value,filter:filterEl.value,sort:sortEl.value});
  const syncPresetActive=()=>{
    const cur=readForm();
    wrap.querySelectorAll('[data-exp-preset]').forEach(btn=>{
      const p=presets.find(x=>x.id===btn.dataset.expPreset);
      btn.classList.toggle('is-active',!!(p&&cur.mode===p.mode&&cur.preset===p.preset&&cur.filter===p.filter&&cur.sort===p.sort));
    });
  };
  wrap.querySelectorAll('[data-exp-preset]').forEach(btn=>btn.onclick=()=>{
    const p=presets.find(x=>x.id===btn.dataset.expPreset);
    if(!p)return;
    modeEl.value=p.mode;presetEl.value=p.preset;filterEl.value=p.filter;sortEl.value=p.sort;
    syncPresetActive();
  });
  [modeEl,presetEl,filterEl,sortEl].forEach(el=>el?.addEventListener('change',syncPresetActive));

  wrap.querySelector('#expCfgSave').onclick=()=>{
    saveExportConfig(readForm());
    toast(tr('Đã lưu cấu hình xuất Word.','Saved Word export configuration.'));
    modal.hide();
  };
  wrap.querySelector('#expCfgExportNow').onclick=async()=>{
    const saved=saveExportConfig(readForm());
    try{modal.dispose();}catch{}
    wrap.remove();
    document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    const btn=document.getElementById('exportStreak');
    await handleExportStreak(btn,saved);
  };
  modal.show();
}

function bindExportControls(){
  if(exportControlsBound)return;
  exportControlsBound=true;
  document.addEventListener('click',e=>{
    const exportBtn=e.target?.closest?.('#exportStreak');
    if(exportBtn){handleExportStreak(exportBtn);return}
    const cfgBtn=e.target?.closest?.('#exportConfigBtn,#adminPresetChip');
    if(cfgBtn){openExportConfigModal(cfgBtn);return}
  });
}

async function handleExportStreak(button,overrideCfg=null){
  if(!button||button.dataset.exporting==='1')return;
  button.dataset.exporting='1';button.disabled=true;button.setAttribute('aria-busy','true');button.classList.remove('export-done');button.classList.add('exporting');
  const original=button.innerHTML;button.innerHTML=`<span class="export-spinner" aria-hidden="true"></span><span>${tr('Đang tạo Word…','Building Word…')}</span>`;
  try{
    const ok=await exportStudentsStreak(overrideCfg);
    if(ok){button.classList.remove('exporting');button.classList.add('export-done');button.innerHTML=`<span class="export-check" aria-hidden="true">✓</span><span>${tr('Đã tải Word','Word Ready')}</span>`;setTimeout(()=>{button.classList.remove('export-done');button.innerHTML=original;syncExportSummaryUI();button.disabled=false;button.removeAttribute('aria-busy');delete button.dataset.exporting},1800)}
    else{button.classList.remove('exporting');button.innerHTML=original;syncExportSummaryUI();button.disabled=false;button.removeAttribute('aria-busy');delete button.dataset.exporting}
  }catch(error){button.classList.remove('exporting');button.innerHTML=original;syncExportSummaryUI();button.disabled=false;button.removeAttribute('aria-busy');delete button.dataset.exporting;throw error}
}
