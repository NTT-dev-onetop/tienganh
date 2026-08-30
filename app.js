import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore,collection,addDoc,doc,updateDoc,deleteDoc,onSnapshot,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id);let user=null,unsub=null,data={vocab:[],grammar:[],mistakes:[]},reviewQueue=[],reviewIndex=0;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function page(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('d-none'));$(id)?.classList.remove('d-none');document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id));if(id==='home')renderHome();if(id==='vocab')renderVocab();if(id==='grammar')renderGrammar();if(id==='mistakes')renderMistakes();if(id==='review')startReview();if(id==='textbook')renderTextbook();if(id==='listening')renderListeningTests()}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page(b.dataset.page);document.getElementById('mobileMenu')?.classList.remove('open');document.getElementById('mobileMenuToggle')?.setAttribute('aria-expanded','false')});
const mobileMenuToggle=document.getElementById('mobileMenuToggle');
mobileMenuToggle?.addEventListener('click',()=>{const menu=document.getElementById('mobileMenu');const open=menu?.classList.toggle('open');mobileMenuToggle.setAttribute('aria-expanded',open?'true':'false')});
document.addEventListener('click',e=>{const menu=document.getElementById('mobileMenu');if(menu?.classList.contains('open')&&!e.target.closest('#mobileMenu')&&!e.target.closest('#mobileMenuToggle')){menu.classList.remove('open');mobileMenuToggle?.setAttribute('aria-expanded','false')}});
$('login').onclick=async()=>{try{await signInWithPopup(auth,provider)}catch(e){$('authErr').textContent=e.message;$('authErr').classList.remove('d-none')}};$('logout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{user=u;if(u){$('auth').classList.add('d-none');$('app').classList.remove('d-none');$('user').textContent=u.email||'';$('userName').textContent=u.displayName||'Tài khoản';$('avatar').textContent=(u.displayName||u.email||'U').trim().charAt(0).toUpperCase();listen()}else{$('auth').classList.remove('d-none');$('app').classList.add('d-none');if(unsub)unsub()}});
const base=()=>collection(db,'users',user.uid,'english_notes');
function listen(){unsub=onSnapshot(base(),snap=>{data={vocab:[],grammar:[],mistakes:[]};snap.forEach(d=>{const x={id:d.id,...d.data()};if(data[x.type]&&!pendingDeletes.has(x.id))data[x.type].push(x)});data.vocab.sort(sortDate);data.grammar.sort(sortDate);data.mistakes.sort((a,b)=>(Number(b.priority||1)-Number(a.priority||1))||sortDate(a,b));renderHome();renderVocab();renderGrammar();renderMistakes();renderTextbookGrammar()})}
function sortDate(a,b){return String(b.createdDate||'').localeCompare(String(a.createdDate||''))}
async function addNote(type,payload){await addDoc(base(),{type,createdDate:today(),createdAt:serverTimestamp(),...payload})}
function reset(ids){ids.forEach(id=>$(id).value='')}
function getRadio(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||'1'}
const pendingDeletes=new Set();
function toast(msg,type='success'){let el=$('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast-note';document.body.appendChild(el)}el.className=`toast-note ${type}`;el.textContent=msg;clearTimeout(window.__toast);requestAnimationFrame(()=>el.classList.add('show'));window.__toast=setTimeout(()=>el.classList.remove('show'),2200)}
async function busyButton(btn,fn,busyText='Đang lưu…'){if(!btn||btn.dataset.busy==='1')return;btn.dataset.busy='1';btn.disabled=true;const old=btn.innerHTML;btn.innerHTML=`<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${busyText}`;try{return await fn()}finally{btn.dataset.busy='0';btn.disabled=false;btn.innerHTML=old}}

$('saveVocab').onclick=()=>busyButton($('saveVocab'),async()=>{const word=$('vWord').value.trim();if(!word){toast('Bạn chưa nhập từ / cụm từ.','error');return}await addNote('vocab',{unit:$('vUnit').value,word,meaning:$('vMeaning').value.trim(),pos:$('vPos').value,pron:$('vPron').value.trim(),family:$('vFamily').value.trim(),forms:$('vForms').value.trim(),passive:$('vPassive').value.trim(),pattern:$('vPattern').value.trim(),example:$('vExample').value.trim(),note:$('vNote').value.trim()});reset(['vWord','vMeaning','vPron','vFamily','vForms','vPassive','vPattern','vExample','vNote']);toast('Đã lưu từ mới.');},'Đang lưu…');
$('clearVocab').onclick=()=>reset(['vWord','vMeaning','vPron','vFamily','vForms','vPassive','vPattern','vExample','vNote']);
$('saveGrammar').onclick=()=>busyButton($('saveGrammar'),async()=>{const title=$('gTitle').value.trim();if(!title){toast('Bạn chưa nhập cấu trúc.','error');return}await addNote('grammar',{unit:$('gUnit').value,title,meaning:$('gMeaning').value.trim(),topic:$('gTopic').value,formula:$('gFormula').value.trim(),example:$('gExample').value.trim(),trap:$('gTrap').value.trim(),tip:$('gTip').value.trim()});reset(['gTitle','gMeaning','gFormula','gExample','gTrap','gTip']);toast('Đã lưu cấu trúc.');},'Đang lưu…');
$('clearGrammar').onclick=()=>reset(['gTitle','gMeaning','gFormula','gExample','gTrap','gTip']);
$('saveMistake').onclick=()=>busyButton($('saveMistake'),async()=>{const question=$('mQuestion').value.trim();if(!question){toast('Bạn chưa nhập câu sai.','error');return}await addNote('mistakes',{unit:$('mUnit').value,question,answer:$('mAnswer').value.trim(),mistakeType:$('mType').value,why:$('mWhy').value.trim(),rule:$('mRule').value.trim(),priority:Number(getRadio('mLevel')),resolved:false,resolvedDate:''});reset(['mQuestion','mAnswer','mWhy','mRule']);toast('Đã ghim câu sai.');},'Đang lưu…');
$('clearMistake').onclick=()=>reset(['mQuestion','mAnswer','mWhy','mRule']);
document.querySelectorAll('.capture-tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.capture-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.querySelectorAll('.capture-form').forEach(x=>x.classList.add('d-none'));$(`${t.dataset.capture}Form`).classList.remove('d-none')});
function renderHome(){if(!user)return;const unresolved=data.mistakes.filter(x=>!x.resolved);$('total').textContent=data.vocab.length+data.grammar.length+data.mistakes.length;$('vocabTotal').textContent=data.vocab.length;$('mistakeTotal').textContent=unresolved.length;$('grammarTotal').textContent=data.grammar.length;const all=[...data.vocab.map(x=>({...x,label:'Từ vựng',title:x.word})),...data.grammar.map(x=>({...x,label:'Cấu trúc',title:x.title})),...data.mistakes.map(x=>({...x,label:'Câu sai',title:x.question}))].sort(sortDate).slice(0,6);$('recent').innerHTML=all.length?all.map(x=>`<div class="recent-item"><div><span class="tag">${esc(x.label)}</span><div class="fw-bold mt-1">${esc(x.title).slice(0,100)}</div><small class="muted">${esc(x.createdDate||'')}</small></div><button class="btn btn-sm btn-outline-secondary" data-open="${x.label}">Xem</button></div>`).join(''):'<div class="muted py-3">Chưa có ghi chú. Sau giờ học, vào <b>＋ Ghi bài</b> và lưu ngay.</div>';document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>page(b.dataset.open==='Từ vựng'?'vocab':b.dataset.open==='Cấu trúc'?'grammar':'mistakes'));
const att=[];if(unresolved.length)att.push(`❌ ${unresolved.length} câu sai đang chờ xử lý`);const verbs=data.vocab.filter(x=>x.forms||x.passive);if(verbs.length)att.push(`🔤 ${verbs.length} từ có V1/V2/V3 hoặc bị động để kiểm tra`);if(data.grammar.length)att.push(`🧩 ${data.grammar.length} cấu trúc đã lưu — ưu tiên xem các lỗi dễ nhầm`);$('attention').innerHTML=att.length?att.map(x=>`<div class="attention-item"><span>${x}</span><span>→</span></div>`).join(''):'<div class="muted">Chưa có việc cần xử lý. Ghi lại bài học mới là được.</div>'}
const textbookVocab = [
  {
    "no": 1,
    "unit": "Unit 1",
    "word": "infection",
    "pos": "N",
    "meaning": "sự lây nhiễm",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 1",
    "word": "ingredient",
    "pos": "N",
    "meaning": "thành phần, nguyên liệu",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 1",
    "word": "life expectancy",
    "pos": "N",
    "meaning": "tuổi thọ",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 1",
    "word": "muscle",
    "pos": "N",
    "meaning": "cơ bắp",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 1",
    "word": "nutrient",
    "pos": "N",
    "meaning": "chất dinh dưỡng",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 1",
    "word": "press-up",
    "pos": "N",
    "meaning": "động tác chống đẩy",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 1",
    "word": "antibiotic",
    "pos": "N",
    "meaning": "thuốc kháng sinh",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 1",
    "word": "bacteria",
    "pos": "N",
    "meaning": "vi khuẩn",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 1",
    "word": "balanced",
    "pos": "Adj",
    "meaning": "cân bằng, điều độ",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 1",
    "word": "cut down on",
    "pos": "Phrase",
    "meaning": "cắt giảm",
    "pattern": "cut down on + N"
  },
  {
    "no": 11,
    "unit": "Unit 1",
    "word": "diameter",
    "pos": "N",
    "meaning": "đường kính",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 1",
    "word": "disease",
    "pos": "N",
    "meaning": "bệnh",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 1",
    "word": "energy",
    "pos": "N",
    "meaning": "năng lượng",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 1",
    "word": "spread",
    "pos": "N",
    "meaning": "sự lây lan",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 1",
    "word": "examine",
    "pos": "V",
    "meaning": "kiểm tra, khám (sức khỏe)",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 1",
    "word": "fitness",
    "pos": "N",
    "meaning": "sức khỏe, thể lực",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 1",
    "word": "food poisoning",
    "pos": "N",
    "meaning": "ngộ độc thức ăn",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 1",
    "word": "star jump",
    "pos": "N",
    "meaning": "động tác nhảy dang tay chân",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 1",
    "word": "germ",
    "pos": "N",
    "meaning": "vi trùng",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 1",
    "word": "strength",
    "pos": "N",
    "meaning": "sức mạnh",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 1",
    "word": "give up",
    "pos": "Phrase",
    "meaning": "từ bỏ",
    "pattern": "give up + N/V-ing"
  },
  {
    "no": 22,
    "unit": "Unit 1",
    "word": "suffer",
    "pos": "V",
    "meaning": "chịu đựng",
    "pattern": "suffer from + illness/problem"
  },
  {
    "no": 23,
    "unit": "Unit 1",
    "word": "illness",
    "pos": "N",
    "meaning": "sự ốm đau",
    "pattern": ""
  },
  {
    "no": 24,
    "unit": "Unit 1",
    "word": "treatment",
    "pos": "N",
    "meaning": "cách điều trị",
    "pattern": ""
  },
  {
    "no": 25,
    "unit": "Unit 1",
    "word": "tuberculosis",
    "pos": "N",
    "meaning": "bệnh lao phổi",
    "pattern": ""
  },
  {
    "no": 26,
    "unit": "Unit 1",
    "word": "virus",
    "pos": "N",
    "meaning": "vi-rút",
    "pattern": ""
  },
  {
    "no": 27,
    "unit": "Unit 1",
    "word": "work out",
    "pos": "Phrase",
    "meaning": "tập thể dục",
    "pattern": "work out"
  },
  {
    "no": 28,
    "unit": "Unit 1",
    "word": "properly",
    "pos": "Adv",
    "meaning": "một cách đúng, hợp lí",
    "pattern": ""
  },
  {
    "no": 29,
    "unit": "Unit 1",
    "word": "recipe",
    "pos": "N",
    "meaning": "công thức nấu ăn",
    "pattern": ""
  },
  {
    "no": 30,
    "unit": "Unit 1",
    "word": "regular",
    "pos": "Adj",
    "meaning": "đều đặn, thường xuyên",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 2",
    "word": "adapt",
    "pos": "V",
    "meaning": "thích nghi, thay đổi cho phù hợp",
    "pattern": "adapt to + N/V-ing"
  },
  {
    "no": 2,
    "unit": "Unit 2",
    "word": "argument",
    "pos": "N",
    "meaning": "tranh luận, tranh cãi",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 2",
    "word": "characteristic",
    "pos": "N",
    "meaning": "đặc tính, đặc điểm",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 2",
    "word": "conflict",
    "pos": "N",
    "meaning": "sự xung đột, va chạm",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 2",
    "word": "curious",
    "pos": "Adj",
    "meaning": "tò mò, muốn tìm hiểu",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 2",
    "word": "digital native",
    "pos": "N",
    "meaning": "người được sinh ra trong thời đại công nghệ và Internet",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 2",
    "word": "experience",
    "pos": "N/V",
    "meaning": "trải nghiệm",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 2",
    "word": "extended family",
    "pos": "N",
    "meaning": "gia đình đa thế hệ, đại gia đình",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 2",
    "word": "freedom",
    "pos": "N",
    "meaning": "sự tự do",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 2",
    "word": "generation gap",
    "pos": "N",
    "meaning": "khoảng cách giữa các thế hệ",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 2",
    "word": "hire",
    "pos": "V",
    "meaning": "thuê nhân công, thuê người làm",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 2",
    "word": "honesty",
    "pos": "N",
    "meaning": "tính trung thực, tính chân thật",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 2",
    "word": "individualism",
    "pos": "N",
    "meaning": "chủ nghĩa cá nhân",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 2",
    "word": "influence",
    "pos": "V",
    "meaning": "gây ảnh hưởng",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 2",
    "word": "limit",
    "pos": "V",
    "meaning": "giới hạn, hạn chế",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 2",
    "word": "nuclear family",
    "pos": "N",
    "meaning": "gia đình hạt nhân, gồm 1–2 thế hệ",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 2",
    "word": "screentime",
    "pos": "N",
    "meaning": "thời gian sử dụng thiết bị điện tử",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 2",
    "word": "social media",
    "pos": "N",
    "meaning": "phương tiện truyền thông xã hội",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 2",
    "word": "value",
    "pos": "N/V",
    "meaning": "giá trị",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 2",
    "word": "view",
    "pos": "N",
    "meaning": "quan điểm",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 3",
    "word": "article",
    "pos": "N",
    "meaning": "bài báo",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 3",
    "word": "card reader",
    "pos": "N",
    "meaning": "thiết bị đọc thẻ",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 3",
    "word": "city dweller",
    "pos": "N",
    "meaning": "người dân thành phố",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 3",
    "word": "cycle path",
    "pos": "N",
    "meaning": "làn đường dành cho xe đạp",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 3",
    "word": "efficiently",
    "pos": "Adv",
    "meaning": "có hiệu quả",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 3",
    "word": "high-rise",
    "pos": "Adj",
    "meaning": "cao tầng, có nhiều tầng",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 3",
    "word": "infrastructure",
    "pos": "N",
    "meaning": "cơ sở hạ tầng",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 3",
    "word": "interact",
    "pos": "V",
    "meaning": "tương tác",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 3",
    "word": "liveable",
    "pos": "Adj",
    "meaning": "đáng sống",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 3",
    "word": "neighbourhood",
    "pos": "N",
    "meaning": "khu dân cư",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 3",
    "word": "operate",
    "pos": "V",
    "meaning": "vận hành",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 3",
    "word": "pedestrian",
    "pos": "N",
    "meaning": "người đi bộ",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 3",
    "word": "privacy",
    "pos": "N",
    "meaning": "sự riêng tư",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 3",
    "word": "roof garden",
    "pos": "N",
    "meaning": "vườn trên sân thượng",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 3",
    "word": "sense of community",
    "pos": "Phrase",
    "meaning": "ý thức cộng đồng",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 3",
    "word": "sensor",
    "pos": "N",
    "meaning": "cảm biến",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 3",
    "word": "skyscraper",
    "pos": "N",
    "meaning": "tòa nhà chọc trời",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 3",
    "word": "smart city",
    "pos": "N",
    "meaning": "thành phố thông minh",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 3",
    "word": "sustainable",
    "pos": "Adj",
    "meaning": "bền vững",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 3",
    "word": "urban centre",
    "pos": "Phrase",
    "meaning": "khu đô thị, trung tâm đô thị",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 4",
    "word": "apply for",
    "pos": "V",
    "meaning": "xin việc, ứng cử",
    "pattern": "apply for + job/position"
  },
  {
    "no": 2,
    "unit": "Unit 4",
    "word": "celebration",
    "pos": "N",
    "meaning": "lễ kỉ niệm, lễ tổ chức",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 4",
    "word": "community",
    "pos": "N",
    "meaning": "cộng đồng",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 4",
    "word": "compliment",
    "pos": "N",
    "meaning": "lời khen",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 4",
    "word": "contribution",
    "pos": "N",
    "meaning": "sự đóng góp, cống hiến",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 4",
    "word": "cultural exchange",
    "pos": "N",
    "meaning": "sự trao đổi văn hóa",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 4",
    "word": "current",
    "pos": "Adj",
    "meaning": "hiện tại, đương thời",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 4",
    "word": "development",
    "pos": "N",
    "meaning": "sự phát triển",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 4",
    "word": "eye-opening",
    "pos": "Adj",
    "meaning": "mở mang tầm mắt",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 4",
    "word": "honour",
    "pos": "V",
    "meaning": "thể hiện sự kính trọng",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 4",
    "word": "issue",
    "pos": "N",
    "meaning": "vấn đề",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 4",
    "word": "leadership skills",
    "pos": "Phrase",
    "meaning": "kĩ năng lãnh đạo",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 4",
    "word": "live-stream",
    "pos": "V",
    "meaning": "phát sóng trực tuyến",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 4",
    "word": "politics",
    "pos": "N",
    "meaning": "chính trị",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 4",
    "word": "promote",
    "pos": "V",
    "meaning": "thúc đẩy, khuyến mãi, quảng bá",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 4",
    "word": "proposal",
    "pos": "N",
    "meaning": "lời/ bản đề xuất",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 4",
    "word": "propose",
    "pos": "V",
    "meaning": "đề xuất",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 4",
    "word": "qualify",
    "pos": "V",
    "meaning": "đủ tiêu chuẩn, đủ khả năng",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 4",
    "word": "region",
    "pos": "N",
    "meaning": "vùng",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 4",
    "word": "relation",
    "pos": "N",
    "meaning": "mối quan hệ",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 4",
    "word": "represent",
    "pos": "V",
    "meaning": "đại diện, tượng trưng",
    "pattern": ""
  },
  {
    "no": 22,
    "unit": "Unit 4",
    "word": "representative",
    "pos": "N",
    "meaning": "người đại diện",
    "pattern": ""
  },
  {
    "no": 23,
    "unit": "Unit 4",
    "word": "strengthen",
    "pos": "V",
    "meaning": "tăng cường, đẩy mạnh",
    "pattern": ""
  },
  {
    "no": 24,
    "unit": "Unit 4",
    "word": "support",
    "pos": "V",
    "meaning": "hỗ trợ",
    "pattern": ""
  },
  {
    "no": 25,
    "unit": "Unit 4",
    "word": "take part in",
    "pos": "Phrase",
    "meaning": "tham gia",
    "pattern": "take part in + N"
  },
  {
    "no": 26,
    "unit": "Unit 4",
    "word": "volunteer",
    "pos": "N/V",
    "meaning": "tình nguyện, tình nguyện viên",
    "pattern": ""
  },
  {
    "no": 27,
    "unit": "Unit 4",
    "word": "youth",
    "pos": "N",
    "meaning": "tuổi trẻ",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 5",
    "word": "atmosphere",
    "pos": "N",
    "meaning": "khí quyển",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 5",
    "word": "balance",
    "pos": "N",
    "meaning": "sự cân bằng",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 5",
    "word": "carbon dioxide",
    "pos": "N",
    "meaning": "khí cacbonic (CO₂)",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 5",
    "word": "coal",
    "pos": "N",
    "meaning": "than đá",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 5",
    "word": "consequence",
    "pos": "N",
    "meaning": "hậu quả, kết quả",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 5",
    "word": "cut down",
    "pos": "Phrase",
    "meaning": "chặt, đốn (cây)",
    "pattern": "cut down + tree"
  },
  {
    "no": 7,
    "unit": "Unit 5",
    "word": "deforestation",
    "pos": "N",
    "meaning": "sự phá rừng",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 5",
    "word": "emission",
    "pos": "N",
    "meaning": "sự phát thải",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 5",
    "word": "environment",
    "pos": "N",
    "meaning": "môi trường",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 5",
    "word": "farming",
    "pos": "N",
    "meaning": "nghề nông",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 5",
    "word": "farmland",
    "pos": "N",
    "meaning": "đất chăn nuôi/trồng trọt",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 5",
    "word": "fossil fuel",
    "pos": "N",
    "meaning": "nhiên liệu hóa thạch",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 5",
    "word": "global warming",
    "pos": "N",
    "meaning": "sự nóng lên toàn cầu",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 5",
    "word": "heat-trapping",
    "pos": "Adj",
    "meaning": "giữ nhiệt",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 5",
    "word": "human activity",
    "pos": "N",
    "meaning": "hoạt động của con người",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 5",
    "word": "leaflet",
    "pos": "N",
    "meaning": "tờ rơi",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 5",
    "word": "methane",
    "pos": "N",
    "meaning": "khí mê-tan (CH₄)",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 5",
    "word": "pollutant",
    "pos": "N",
    "meaning": "chất gây ô nhiễm",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 5",
    "word": "release",
    "pos": "V",
    "meaning": "thải ra, giải phóng",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 5",
    "word": "renewable",
    "pos": "Adj",
    "meaning": "tái tạo, có thể tái tạo",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 5",
    "word": "sealevel",
    "pos": "N",
    "meaning": "mực nước biển",
    "pattern": ""
  },
  {
    "no": 22,
    "unit": "Unit 5",
    "word": "soil",
    "pos": "N",
    "meaning": "đất trồng",
    "pattern": ""
  },
  {
    "no": 23,
    "unit": "Unit 5",
    "word": "soot",
    "pos": "N",
    "meaning": "muội, bồ hóng",
    "pattern": ""
  },
  {
    "no": 24,
    "unit": "Unit 5",
    "word": "temperature",
    "pos": "N",
    "meaning": "nhiệt độ",
    "pattern": ""
  },
  {
    "no": 25,
    "unit": "Unit 5",
    "word": "waste",
    "pos": "N",
    "meaning": "rác, chất thải",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 6",
    "word": "ancient",
    "pos": "Adj",
    "meaning": "cổ kính",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 6",
    "word": "appreciate",
    "pos": "V",
    "meaning": "hiểu rõ giá trị, đánh giá cao",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 6",
    "word": "performing arts",
    "pos": "N",
    "meaning": "nghệ thuật biểu diễn",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 6",
    "word": "citadel",
    "pos": "N",
    "meaning": "thành trì",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 6",
    "word": "complex",
    "pos": "N",
    "meaning": "quần thể, tổ hợp",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 6",
    "word": "crowdfunding",
    "pos": "N",
    "meaning": "việc quyên góp, huy động vốn từ cộng đồng",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 6",
    "word": "festive",
    "pos": "Adj",
    "meaning": "thuộc về ngày lễ, có không khí lễ hội",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 6",
    "word": "fine",
    "pos": "N",
    "meaning": "tiền phạt",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 6",
    "word": "folk",
    "pos": "Adj",
    "meaning": "thuộc về dân gian",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 6",
    "word": "heritage",
    "pos": "N",
    "meaning": "di sản",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 6",
    "word": "historic",
    "pos": "Adj",
    "meaning": "quan trọng, có giá trị lịch sử",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 6",
    "word": "historical",
    "pos": "Adj",
    "meaning": "thuộc về lịch sử, mang tính lịch sử",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 6",
    "word": "imperial",
    "pos": "Adj",
    "meaning": "thuộc về hoàng tộc",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 6",
    "word": "landscape",
    "pos": "N",
    "meaning": "phong cảnh",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 6",
    "word": "limestone",
    "pos": "N",
    "meaning": "đá vôi",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 6",
    "word": "monument",
    "pos": "N",
    "meaning": "lăng mộ, đài kỉ niệm, công trình tưởng niệm",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 6",
    "word": "preserve",
    "pos": "V",
    "meaning": "bảo tồn",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 6",
    "word": "restore",
    "pos": "V",
    "meaning": "khôi phục, sửa lại",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 6",
    "word": "state",
    "pos": "N",
    "meaning": "hiện trạng, tình trạng",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 6",
    "word": "temple",
    "pos": "N",
    "meaning": "đền, miếu",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 6",
    "word": "trending",
    "pos": "Adj",
    "meaning": "theo xu hướng",
    "pattern": ""
  },
  {
    "no": 22,
    "unit": "Unit 6",
    "word": "valley",
    "pos": "N",
    "meaning": "thung lũng",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 7",
    "word": "academic",
    "pos": "Adj",
    "meaning": "có tính chất học thuật, liên quan tới học tập",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 7",
    "word": "apprenticeship",
    "pos": "N",
    "meaning": "thời gian học nghề, học việc",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 7",
    "word": "bachelor’s degree",
    "pos": "N",
    "meaning": "bằng cử nhân",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 7",
    "word": "brochure",
    "pos": "N",
    "meaning": "ấn phẩm quảng cáo, giới thiệu",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 7",
    "word": "doctorate",
    "pos": "N",
    "meaning": "bằng tiến sĩ",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 7",
    "word": "entrance exam",
    "pos": "N",
    "meaning": "kì thi đầu vào",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 7",
    "word": "formal",
    "pos": "Adj",
    "meaning": "chính quy, có hệ thống",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 7",
    "word": "graduation",
    "pos": "N",
    "meaning": "khi tốt nghiệp, lễ tốt nghiệp",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 7",
    "word": "higher education",
    "pos": "N",
    "meaning": "giáo dục đại học",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 7",
    "word": "institution",
    "pos": "N",
    "meaning": "cơ sở, viện (đào tạo)",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 7",
    "word": "manage",
    "pos": "V",
    "meaning": "cố gắng, làm được việc gì đó",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 7",
    "word": "master’s degree",
    "pos": "N",
    "meaning": "bằng thạc sĩ",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 7",
    "word": "mechanic",
    "pos": "N",
    "meaning": "thợ cơ khí",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 7",
    "word": "professional",
    "pos": "Adj",
    "meaning": "chuyên nghiệp, nhà nghề",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 7",
    "word": "qualification",
    "pos": "N",
    "meaning": "trình độ chuyên môn, văn bằng",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 7",
    "word": "school-leaver",
    "pos": "N",
    "meaning": "học sinh tốt nghiệp trung học phổ thông",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 7",
    "word": "sixth-form college",
    "pos": "N",
    "meaning": "trường cho học sinh 16–19 tuổi, tập trung vào các trình độ A-levels để chuẩn bị vào đại học",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 7",
    "word": "vocational school",
    "pos": "N",
    "meaning": "trường dạy nghề",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 8",
    "word": "achieve",
    "pos": "V",
    "meaning": "đạt được, giành được",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 8",
    "word": "carry out",
    "pos": "Phrase",
    "meaning": "tiến hành",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 8",
    "word": "combine",
    "pos": "V",
    "meaning": "kết hợp",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 8",
    "word": "come up with",
    "pos": "Phrase",
    "meaning": "nghĩ ra, nảy ra",
    "pattern": "come up with + idea/solution"
  },
  {
    "no": 5,
    "unit": "Unit 8",
    "word": "confidence",
    "pos": "N",
    "meaning": "sự tự tin",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 8",
    "word": "confident",
    "pos": "Adj",
    "meaning": "tự tin",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 8",
    "word": "deal with",
    "pos": "Phrase",
    "meaning": "giải quyết, đối phó",
    "pattern": "deal with + problem/person"
  },
  {
    "no": 8,
    "unit": "Unit 8",
    "word": "decision-making skills",
    "pos": "Phrase",
    "meaning": "kĩ năng đưa ra quyết định",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 8",
    "word": "get around",
    "pos": "Phrase",
    "meaning": "đi lại",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 8",
    "word": "get into the habit of",
    "pos": "Phrase",
    "meaning": "tạo thói quen",
    "pattern": "get into the habit of + V-ing"
  },
  {
    "no": 11,
    "unit": "Unit 8",
    "word": "independence",
    "pos": "N",
    "meaning": "sự độc lập",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 8",
    "word": "independent",
    "pos": "Adj",
    "meaning": "độc lập, không lệ thuộc",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 8",
    "word": "learner",
    "pos": "N",
    "meaning": "người học",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 8",
    "word": "learning goal",
    "pos": "Phrase",
    "meaning": "mục tiêu học tập",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 8",
    "word": "life skill",
    "pos": "N",
    "meaning": "kĩ năng sống",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 8",
    "word": "make use of",
    "pos": "Phrase",
    "meaning": "tận dụng",
    "pattern": "make use of + N"
  },
  {
    "no": 17,
    "unit": "Unit 8",
    "word": "manage",
    "pos": "V",
    "meaning": "quản lí",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 8",
    "word": "measure",
    "pos": "V",
    "meaning": "đo",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 8",
    "word": "money-management skills",
    "pos": "Phrase",
    "meaning": "kĩ năng quản lí tiền",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 8",
    "word": "remove",
    "pos": "V",
    "meaning": "lấy ra, loại bỏ",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 8",
    "word": "responsibility",
    "pos": "N",
    "meaning": "sự chịu trách nhiệm, trách nhiệm",
    "pattern": ""
  },
  {
    "no": 22,
    "unit": "Unit 8",
    "word": "responsible",
    "pos": "Adj",
    "meaning": "có trách nhiệm",
    "pattern": ""
  },
  {
    "no": 23,
    "unit": "Unit 8",
    "word": "rice cooker",
    "pos": "N",
    "meaning": "nồi cơm điện",
    "pattern": ""
  },
  {
    "no": 24,
    "unit": "Unit 8",
    "word": "self-motivated",
    "pos": "Adj",
    "meaning": "có động lực",
    "pattern": ""
  },
  {
    "no": 25,
    "unit": "Unit 8",
    "word": "self-study",
    "pos": "N",
    "meaning": "sự tự học",
    "pattern": ""
  },
  {
    "no": 26,
    "unit": "Unit 8",
    "word": "time-management skills",
    "pos": "Phrase",
    "meaning": "kĩ năng quản lí thời gian",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 9",
    "word": "admit",
    "pos": "V",
    "meaning": "thừa nhận",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 9",
    "word": "alcohol",
    "pos": "N",
    "meaning": "đồ uống có cồn (rượu, bia...)",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 9",
    "word": "anxiety",
    "pos": "N",
    "meaning": "sự lo lắng",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 9",
    "word": "ashamed",
    "pos": "Adj",
    "meaning": "xấu hổ",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 9",
    "word": "awareness",
    "pos": "N",
    "meaning": "nhận thức",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 9",
    "word": "body shaming",
    "pos": "N",
    "meaning": "sự chê bai ngoại hình của người khác",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 9",
    "word": "bully",
    "pos": "V",
    "meaning": "bắt nạt",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 9",
    "word": "campaign",
    "pos": "N",
    "meaning": "chiến dịch",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 9",
    "word": "crime",
    "pos": "N",
    "meaning": "tội phạm",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 9",
    "word": "cyberbullying",
    "pos": "N",
    "meaning": "bắt nạt trên mạng",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 9",
    "word": "depression",
    "pos": "N",
    "meaning": "sự trầm cảm",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 9",
    "word": "hang out",
    "pos": "Phrase",
    "meaning": "đi chơi",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 9",
    "word": "lie",
    "pos": "N",
    "meaning": "lời nói dối",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 9",
    "word": "make fun of",
    "pos": "Phrase",
    "meaning": "trêu chọc, chế giễu",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 9",
    "word": "offensive",
    "pos": "Adj",
    "meaning": "gây xúc phạm",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 9",
    "word": "overpopulation",
    "pos": "N",
    "meaning": "sự quá tải dân số",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 9",
    "word": "peer pressure",
    "pos": "N",
    "meaning": "áp lực từ bạn bè",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 9",
    "word": "physical",
    "pos": "Adj",
    "meaning": "về mặt thể chất",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 9",
    "word": "poverty",
    "pos": "N",
    "meaning": "sự nghèo đói",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 9",
    "word": "self-confidence",
    "pos": "N",
    "meaning": "sự tự tin vào bản thân",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 9",
    "word": "skip",
    "pos": "V",
    "meaning": "trốn, bỏ",
    "pattern": ""
  },
  {
    "no": 22,
    "unit": "Unit 9",
    "word": "stand up to",
    "pos": "Phrase",
    "meaning": "đứng lên chống lại",
    "pattern": "stand up to + N"
  },
  {
    "no": 23,
    "unit": "Unit 9",
    "word": "struggle",
    "pos": "V",
    "meaning": "đấu tranh",
    "pattern": ""
  },
  {
    "no": 24,
    "unit": "Unit 9",
    "word": "the odd one out",
    "pos": "Phrase",
    "meaning": "kẻ/người khác biệt",
    "pattern": ""
  },
  {
    "no": 25,
    "unit": "Unit 9",
    "word": "the poverty line",
    "pos": "N",
    "meaning": "mức nghèo đói",
    "pattern": ""
  },
  {
    "no": 26,
    "unit": "Unit 9",
    "word": "verbal",
    "pos": "Adj",
    "meaning": "bằng lời nói",
    "pattern": ""
  },
  {
    "no": 27,
    "unit": "Unit 9",
    "word": "victim",
    "pos": "N",
    "meaning": "nạn nhân",
    "pattern": ""
  },
  {
    "no": 28,
    "unit": "Unit 9",
    "word": "violent",
    "pos": "Adj",
    "meaning": "sử dụng vũ lực, bạo lực",
    "pattern": ""
  },
  {
    "no": 1,
    "unit": "Unit 10",
    "word": "biodiversity",
    "pos": "N",
    "meaning": "đa dạng sinh học",
    "pattern": ""
  },
  {
    "no": 2,
    "unit": "Unit 10",
    "word": "conservation",
    "pos": "N",
    "meaning": "sự bảo tồn thiên nhiên",
    "pattern": ""
  },
  {
    "no": 3,
    "unit": "Unit 10",
    "word": "coral reef",
    "pos": "N",
    "meaning": "rạn san hô",
    "pattern": ""
  },
  {
    "no": 4,
    "unit": "Unit 10",
    "word": "delta",
    "pos": "N",
    "meaning": "đồng bằng",
    "pattern": ""
  },
  {
    "no": 5,
    "unit": "Unit 10",
    "word": "destroy",
    "pos": "V",
    "meaning": "phá hủy",
    "pattern": ""
  },
  {
    "no": 6,
    "unit": "Unit 10",
    "word": "ecosystem",
    "pos": "N",
    "meaning": "hệ sinh thái",
    "pattern": ""
  },
  {
    "no": 7,
    "unit": "Unit 10",
    "word": "endangered",
    "pos": "Adj",
    "meaning": "bị nguy hiểm",
    "pattern": ""
  },
  {
    "no": 8,
    "unit": "Unit 10",
    "word": "fauna",
    "pos": "N",
    "meaning": "động vật",
    "pattern": ""
  },
  {
    "no": 9,
    "unit": "Unit 10",
    "word": "flora",
    "pos": "N",
    "meaning": "thực vật",
    "pattern": ""
  },
  {
    "no": 10,
    "unit": "Unit 10",
    "word": "food chain",
    "pos": "N",
    "meaning": "chuỗi thức ăn",
    "pattern": ""
  },
  {
    "no": 11,
    "unit": "Unit 10",
    "word": "green",
    "pos": "Adj",
    "meaning": "xanh",
    "pattern": ""
  },
  {
    "no": 12,
    "unit": "Unit 10",
    "word": "habitat",
    "pos": "N",
    "meaning": "khu vực sống",
    "pattern": ""
  },
  {
    "no": 13,
    "unit": "Unit 10",
    "word": "living things",
    "pos": "N",
    "meaning": "các sinh vật sống",
    "pattern": ""
  },
  {
    "no": 14,
    "unit": "Unit 10",
    "word": "mammal",
    "pos": "N",
    "meaning": "động vật có vú",
    "pattern": ""
  },
  {
    "no": 15,
    "unit": "Unit 10",
    "word": "national park",
    "pos": "N",
    "meaning": "rừng quốc gia",
    "pattern": ""
  },
  {
    "no": 16,
    "unit": "Unit 10",
    "word": "native",
    "pos": "Adj",
    "meaning": "tự nhiên, bản địa",
    "pattern": ""
  },
  {
    "no": 17,
    "unit": "Unit 10",
    "word": "natural resources",
    "pos": "N",
    "meaning": "tài nguyên thiên nhiên",
    "pattern": ""
  },
  {
    "no": 18,
    "unit": "Unit 10",
    "word": "pangolin",
    "pos": "N",
    "meaning": "con tê tê",
    "pattern": ""
  },
  {
    "no": 19,
    "unit": "Unit 10",
    "word": "resource",
    "pos": "N",
    "meaning": "nguồn lực",
    "pattern": ""
  },
  {
    "no": 20,
    "unit": "Unit 10",
    "word": "species",
    "pos": "N",
    "meaning": "loài",
    "pattern": ""
  },
  {
    "no": 21,
    "unit": "Unit 10",
    "word": "tropical forest",
    "pos": "N",
    "meaning": "rừng nhiệt đới",
    "pattern": ""
  },
  {
    "no": 22,
    "unit": "Unit 10",
    "word": "wildlife",
    "pos": "N",
    "meaning": "động vật hoang dã",
    "pattern": ""
  }
];
const textbookGrammar = [
  {unit:'Unit 1', title:'Past simple vs Present perfect', topic:'Tenses', formula:'Past simple: S + V2/ed ...\nPresent perfect: S + have/has + V3/ed ...', meaning:'Phân biệt hành động đã kết thúc ở quá khứ với trải nghiệm/kết quả/hành động kéo dài đến hiện tại.', example:'I saw the doctor yesterday. / I have seen this doctor before.', trap:'Có mốc thời gian quá khứ đã kết thúc (yesterday, last week, in 2020...) → thường dùng past simple; không dùng present perfect với mốc quá khứ xác định đã kết thúc.'},
  {unit:'Unit 2', title:'Modal verbs: must / have to / should', topic:'Modal verbs', formula:'must + V1\nhave to + V1\nshould + V1', meaning:'Nghĩa vụ/bắt buộc và lời khuyên.', example:'You must follow the rules. / I have to get up early. / You should talk to your parents.', trap:'Sau modal verb dùng V nguyên mẫu không “to”: should go, must study.'},
  {unit:'Unit 2', title:'Cleft sentence: It is/was ... that/who ...', topic:'Cleft sentence', formula:'It is/was + phần muốn nhấn mạnh + that/who + mệnh đề', meaning:'Nhấn mạnh một thành phần của câu.', example:'It was Nam that/who helped me. / It was yesterday that we met.', trap:'Đừng đổi cấu trúc thành “It was ... because ...”; phần nhấn mạnh đứng sau is/was.'},
  {unit:'Unit 3', title:'Stative verbs in the continuous form', topic:'Stative verbs', formula:'Một số stative verbs thường không dùng ở tiếp diễn; một số có thể dùng khi nghĩa chuyển sang hành động/trạng thái tạm thời.', meaning:'Nhận biết khi nào động từ trạng thái có thể dùng ở continuous.', example:'She has a younger sister. / He is having a birthday party now.', trap:'have, think, see, taste, smell, feel... có thể đổi nghĩa và khi đó cách chia cũng đổi.'},
  {unit:'Unit 3', title:'Linking verbs + adjective', topic:'Linking verbs', formula:'S + linking verb + adjective/noun', meaning:'Động từ nối liên kết chủ ngữ với tính từ hoặc danh từ mô tả chủ ngữ.', example:'She seems happy. / The soup tastes delicious. / He became a doctor.', trap:'Khi là linking verb, thường theo sau là adjective/noun, không phải trạng từ: She looks happy.'},
  {unit:'Unit 4', title:'Gerunds as subjects and objects', topic:'Gerund', formula:'V-ing + ... + V ...\nV + V-ing', meaning:'Danh động từ dùng như danh từ, đặc biệt làm chủ ngữ hoặc tân ngữ.', example:'Learning English takes time. / They enjoy helping others.', trap:'Sau các động từ như enjoy, avoid, finish, suggest, mind... dùng V-ing.'},
  {unit:'Unit 5', title:'Present participle clauses', topic:'Participle clauses', formula:'V-ing ..., S + V ...', meaning:'Mệnh đề phân từ hiện tại; thường rút gọn khi chủ ngữ của hai mệnh đề giống nhau và mang nghĩa chủ động.', example:'Learning about global warming, we decided to save energy.', trap:'Chủ ngữ của cụm V-ing phải phù hợp với chủ ngữ mệnh đề chính.'},
  {unit:'Unit 5', title:'Past participle clauses', topic:'Participle clauses', formula:'V3/ed ..., S + V ...', meaning:'Mệnh đề phân từ quá khứ; thường mang nghĩa bị động.', example:'Given enough information, we started our report.', trap:'Dùng V3/ed khi chủ thể nhận tác động; không dùng V-ing nếu nghĩa là bị động.'},
  {unit:'Unit 6', title:'To-infinitive clauses: purpose', topic:'To-infinitive', formula:'S + V + ... + to + V1', meaning:'Diễn tả mục đích.', example:'He studied hard to pass the exam.', trap:'Sau “to” trong cấu trúc này là V1, không phải V2/V3/V-ing.'},
  {unit:'Unit 6', title:'To-infinitive after ordinal/superlative/next/last/only', topic:'To-infinitive', formula:'the first/last/only/best/next + noun + to + V1', meaning:'Bổ nghĩa cho danh từ/cụm danh từ có số thứ tự, so sánh nhất, next, last hoặc only.', example:'She was the first person to arrive. / This is the best place to visit.', trap:'Không tự động dùng mệnh đề quan hệ; sách dùng to-infinitive trong các mẫu này.'},
  {unit:'Unit 7', title:'Perfect gerund', topic:'Perfect gerund', formula:'having + V3/ed', meaning:'Danh động từ hoàn thành, dùng khi hành động ở dạng gerund xảy ra trước một hành động/thời điểm khác.', example:'He admitted having made a mistake.', trap:'Sau having phải là V3/ed.'},
  {unit:'Unit 7', title:'Perfect participle clauses', topic:'Perfect participle', formula:'Having + V3/ed, S + V ...', meaning:'Nhấn mạnh hành động thứ nhất đã hoàn thành trước hành động chính.', example:'Having finished school, I can apply to university.', trap:'Chủ ngữ của cụm Having + V3 phải phù hợp với chủ ngữ mệnh đề chính.'},
  {unit:'Unit 8', title:'Cleft sentences with It is/was ... that/who ...', topic:'Cleft sentence', formula:'It is/was + S/O/A + that/who + ...', meaning:'Nhấn mạnh người, vật, nơi chốn, thời gian hoặc thành phần muốn tập trung.', example:'It was Nam that/who taught Mai how to use the app.', trap:'who thường dùng cho người; that có thể dùng rộng hơn theo cấu trúc của sách.'},
  {unit:'Unit 9', title:'Linking words and phrases', topic:'Linking words', formula:'Clause + however/therefore/furthermore...\nBecause/Although/If + clause', meaning:'Liên kết ý: tương phản, nguyên nhân, kết quả, bổ sung và điều kiện.', example:'The factories closed. Therefore, unemployment increased. / Although it was difficult, they continued.', trap:'Phân biệt từ nối đứng giữa hai mệnh đề với cụm giới từ như because of/due to.'},
  {unit:'Unit 9', title:'Conditional sentence type 0', topic:'Conditionals', formula:'If/When + S + V1, S + V1', meaning:'Sự thật, quy luật hoặc kết quả luôn đúng.', example:'If you heat ice, it melts.', trap:'Type 0 dùng hiện tại đơn ở cả hai mệnh đề; không tự động dùng will.'},
  {unit:'Unit 10', title:'Compound nouns', topic:'Compound nouns', formula:'N + N / Adj + N / V-ing + N / N + V-ing / V + prep', meaning:'Danh từ ghép được tạo từ hai hoặc nhiều từ hoạt động như một đơn vị.', example:'bus stop, wildlife, washing machine, film-making.', trap:'Cách viết có thể là open, hyphenated hoặc closed compound; cần nhớ từng từ cụ thể.'},
  {unit:'Chuyên đề', title:'Too ... to V', topic:'To-infinitive', formula:'S + V + too + Adj/Adv + (for O) + to V1', meaning:'Quá ... đến nỗi không thể làm gì.', example:'The tea is too hot for me to drink.', trap:'Sau too + tính từ/trạng từ là to + V1; có thể thêm for + O.'},
  {unit:'Chuyên đề', title:'Adj/Adv + enough to V', topic:'To-infinitive', formula:'S + V + Adj/Adv + enough + (for O) + to V1', meaning:'Đủ ... để làm gì.', example:'He is strong enough to lift this stone.', trap:'enough đứng sau adjective/adverb trong mẫu này.'},
  {unit:'Chuyên đề', title:'It is + adjective + for O + to V', topic:'To-infinitive', formula:'It + be + Adj + for O + to V1', meaning:'Đánh giá một hành động là dễ, khó, cần thiết, không thể... đối với ai.', example:'It is impossible for him to find a job now.', trap:'Dùng for + O để nêu người thực hiện hành động của to V.'},
  {unit:'Chuyên đề', title:'Find it + adjective + to V', topic:'To-infinitive', formula:'S + find/make/think/consider/believe/feel + it + Adj/N + to V1', meaning:'Dùng it làm tân ngữ giả để nhận xét/đánh giá hành động.', example:'I find it necessary to master a foreign language.', trap:'it đứng trước adjective/noun, còn to V nêu hành động được đánh giá.'},
  {unit:'Chuyên đề', title:'It takes + O + time + to V', topic:'To-infinitive', formula:'It + takes/took + O + time + to V1', meaning:'Mất bao nhiêu thời gian để ai làm gì.', example:'It took us five hours to get to London.', trap:'Có thể đổi với spend time + V-ing khi chủ thể tương ứng.'},
  {unit:'Chuyên đề', title:'To-infinitive expressing purpose', topic:'To-infinitive', formula:'S + V + ... + to V1', meaning:'To-infinitive diễn tả mục đích.', example:'She learns English to find a good job.', trap:'to V trả lời câu hỏi “để làm gì?”.'},
  {unit:'Chuyên đề', title:'Remember / Forget / Regret + to V or V-ing', topic:'Gerund / Infinitive', formula:'remember/forget/regret + to V1 → việc cần/định làm; + V-ing → nhớ/quên/tiếc một việc đã xảy ra', meaning:'Ý nghĩa thay đổi tùy theo to V hay V-ing.', example:'Remember to return the book tomorrow. / I’ll never forget seeing her at the first time.', trap:'to V thường hướng tới hành động cần làm; V-ing nói về hành động đã xảy ra.'},
  {unit:'Chuyên đề', title:'Stop + to V / V-ing', topic:'Gerund / Infinitive', formula:'stop + to V1 → dừng lại để làm việc khác; stop + V-ing → từ bỏ/chấm dứt việc đang làm', meaning:'Hai cấu trúc có nghĩa khác nhau.', example:'He stopped to eat. / My father stopped smoking two months ago.', trap:'stop to V không có nghĩa là “ngừng việc sau to V”; nó là dừng một việc để làm việc khác.'},
  {unit:'Chuyên đề', title:'Try + to V / V-ing', topic:'Gerund / Infinitive', formula:'try + to V1 → cố gắng; try + V-ing → thử làm', meaning:'Hai cấu trúc có nghĩa khác nhau.', example:'I will try to study hard. / He tried making a cake.', trap:'Phân biệt “cố làm” với “thử làm” theo ngữ cảnh.'},
  {unit:'Chuyên đề', title:'Verbs of perception + O + V0 / V-ing', topic:'Verbs of perception', formula:'hear/see/smell/feel/notice/watch + O + V0 hoặc V-ing', meaning:'V0 nhấn mạnh hành động trọn vẹn; V-ing nhấn mạnh hành động đang diễn ra.', example:'We saw him leave the house. / She smelled something burning.', trap:'V0 = thấy/nghe toàn bộ hành động; V-ing = bắt gặp hành động đang diễn ra.'},
  {unit:'Chuyên đề', title:'Infinitive without to', topic:'Bare infinitive', formula:'make/let/help + O + V0; had better/would rather + V0; can/could/will/would/may/might/should + V0', meaning:'Một số động từ và modal verbs đi với động từ nguyên mẫu không “to”.', example:'You had better put your money in the bank. / They made him leave.', trap:'Sau modal verb dùng V0. “ought to” và “used to” vẫn có to theo chính cấu trúc của chúng.'},
  {unit:'Chuyên đề', title:'Continue / begin / start + to V / V-ing', topic:'Gerund / Infinitive', formula:'continue/begin/start + to V1 hoặc V-ing', meaning:'Hai dạng thường giữ nguyên nghĩa.', example:'I began to work. / I began working.', trap:'Không nhầm với các động từ mà to V và V-ing làm thay đổi nghĩa như stop, try.'},
  {unit:'Chuyên đề', title:'Allow / permit + O + to V', topic:'Verb patterns', formula:'allow/permit + O + to V1', meaning:'Cho phép ai làm gì.', example:'The teacher allowed us to leave early.', trap:'Khi có tân ngữ chỉ người, dùng O + to V.'},
  {unit:'Chuyên đề', title:'Advise / recommend / encourage + O + to V hoặc V-ing', topic:'Verb patterns', formula:'advise/recommend/encourage + O + to V1; advise/recommend/encourage + V-ing', meaning:'Khuyên, đề nghị hoặc khuyến khích.', example:'She advised me to study harder. / She recommended studying early.', trap:'Có O chỉ người → O + to V; không có O → V-ing là mẫu thường gặp.'},
  {unit:'Chuyên đề', title:'Be used to / get used to + V-ing', topic:'Used to', formula:'be accustomed to / be used to / become accustomed to / get used to + V-ing', meaning:'Quen với việc gì.', example:'We are used to going to school by bus.', trap:'Trong used to mang nghĩa “quen với”, to là giới từ nên theo sau là V-ing/N.'},
  {unit:'Chuyên đề', title:'Used to + V0', topic:'Used to', formula:'S + used to + V0', meaning:'Đã từng thường xuyên làm gì trong quá khứ nhưng hiện tại không còn.', example:'My grandfather used to play tennis when he was young.', trap:'Phân biệt used to + V0 với be/get used to + V-ing.'},
  {unit:'Chuyên đề', title:'Spend time + V-ing ↔ It takes + O + time + to V', topic:'Sentence transformation', formula:'S + spend(s)/spent + time + V-ing ↔ It + take(s)/took + O + time + to V1', meaning:'Hai cấu trúc diễn tả cùng ý về lượng thời gian cần để làm việc.', example:'We spent five hours getting to London. ↔ It took us five hours to get to London.', trap:'Đổi chủ thể phù hợp: spend dùng người; take dùng it + O.'},
  {unit:'Chuyên đề', title:'Can’t / couldn’t ... because of ↔ prevent / stop ... from V-ing', topic:'Sentence transformation', formula:'S + can/could not + V1 + because of + N ↔ S + prevent(s)/stop(s) + O + from + V-ing', meaning:'Chuyển giữa nguyên nhân gây cản trở và cấu trúc prevent/stop.', example:'We can’t drive because of fog. ↔ The fog prevents us from driving.', trap:'prevent/stop đi với O + from + V-ing.'},
  {unit:'Chuyên đề', title:'Because / Since / As ↔ Because of / Due to', topic:'Sentence transformation', formula:'Because/Since/As + S + V ↔ Because of/Due to + N/V-ing', meaning:'Chuyển mệnh đề chỉ nguyên nhân thành cụm từ chỉ nguyên nhân.', example:'Because she walked in the sun, she was sick. ↔ Because of walking in the sun, she was sick.', trap:'Sau because of/due to dùng noun phrase hoặc V-ing, không dùng nguyên một mệnh đề S + V.'},
  {unit:'Chuyên đề', title:'Although / Though / Even though ↔ In spite of / Despite', topic:'Sentence transformation', formula:'Although/Though/Even though + S + V ↔ In spite of/Despite + N/V-ing', meaning:'Chuyển mệnh đề nhượng bộ sang cụm giới từ.', example:'Although he is rich, he is extremely mean. ↔ In spite of his richness, he is extremely mean.', trap:'Despite/In spite of + noun/V-ing; nếu dùng mệnh đề phải có the fact that.'},
  {unit:'Chuyên đề', title:'Formal subject It', topic:'Sentence transformation', formula:'V-ing/To V + be + Adj/N (+ for O) ↔ It + be + Adj/N (+ for O) + to V1', meaning:'Đưa chủ ngữ dài (V-ing/to V) xuống cuối câu bằng it.', example:'Knowing English is useful. ↔ It is useful to know English.', trap:'it chỉ là chủ ngữ giả; to V mới nêu nội dung hành động.'},
  {unit:'Chuyên đề', title:'Started / began + V-ing / to V ↔ Present perfect', topic:'Sentence transformation', formula:'S + started/began + V-ing/to V + ... + khoảng TG ago ↔ S + have/has + V3/been V-ing + for/since', meaning:'Đổi câu bắt đầu làm việc gì trong quá khứ sang hiện tại hoàn thành.', example:'We started studying English half an hour ago. ↔ We have studied/have been studying English for half an hour.', trap:'Hành động kéo dài đến hiện tại có thể dùng have + V3 hoặc have been + V-ing tùy động từ/ngữ cảnh.'},
  {unit:'Chuyên đề', title:'The last time ... was ... ↔ have/has not ... for/since', topic:'Sentence transformation', formula:'The last time + S + V2/ed + ... was + time ago/prep time ↔ S + have/has not + V3 + for/since', meaning:'Diễn tả đã bao lâu kể từ lần cuối làm việc gì.', example:'The last time she had a swim was five years ago. ↔ She has not had a swim for five years.', trap:'Dùng present perfect ở câu chuyển đổi và for/since theo dữ kiện thời gian.'},
  {unit:'Chuyên đề', title:'Last ... when ... ↔ have/has not ... since ...', topic:'Sentence transformation', formula:'S + last + V2 + when + S + V2 ↔ S + have/has not + V3 + since + S + V2', meaning:'Chuyển “lần cuối ... khi ...” sang “chưa ... kể từ khi ...”.', example:'I last went to the football match when I was a student. ↔ I haven’t gone to the football match since I was a student.', trap:'Mệnh đề sau since thường giữ mốc quá khứ.'},
  {unit:'Chuyên đề', title:'Have/has not + V3 for ↔ It is ... since ... last + V2', topic:'Sentence transformation', formula:'S + have/has not + V3 + for + duration ↔ It + is + duration + since + S + last + V2', meaning:'Đổi cấu trúc present perfect sang mẫu It is ... since ...', example:'She hasn’t had a swim for five years. ↔ It is five years since she last had a swim.', trap:'Sau since dùng last + V2 để chỉ lần cuối xảy ra hành động.'},
  {unit:'Chuyên đề', title:'Never/not ... before ↔ This/It is the first time ...', topic:'Sentence transformation', formula:'S + have/has + never/not + V3 + before ↔ This/It is the first time (that) + S + have/has + (ever) + V3', meaning:'Đổi “chưa từng trước đây” thành “đây là lần đầu tiên”.', example:'I’ve never visited Paris before. ↔ This is the first time I’ve ever visited Paris.', trap:'Sau “This/It is the first time” dùng present perfect.'},
  {unit:'Chuyên đề', title:'S + V2 and then S + V2 ↔ After + past perfect', topic:'Sentence transformation', formula:'S + V2/ed ... and then S + V2/ed ↔ After + S + had + V3/ed, S + V2/ed', meaning:'Nhấn mạnh hành động xảy ra trước bằng past perfect.', example:'I had breakfast and then went to school. ↔ After I had had breakfast, I went to school.', trap:'Hành động xảy ra trước → had + V3; hành động sau → past simple.'}
];
function renderTextbookGrammar(){const u=$('grammarUnitFilter')?.value||'all';const list=textbookGrammar.filter(x=>u==='all'||x.unit===u);$('textbookGrammarList').innerHTML=list.map(x=>`<div class="grammar-card textbook-grammar"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(x.unit)}</span><span class="tag">${esc(x.topic)}</span></div><div class="pattern-title mt-2">${esc(x.title)}</div><p class="muted mb-0">${esc(x.meaning)}</p></div><div><div class="formula">${esc(x.formula)}</div><div class="mini-box"><b>Ví dụ</b>${esc(x.example)}</div><div class="trap"><b>⚠ Dễ sai:</b> ${esc(x.trap)}</div></div></div>`).join('');}
$('grammarUnitFilter').onchange=renderTextbookGrammar;

function renderTextbook(){const u=$('textbookUnit')?.value||'all';const list=textbookVocab.filter(x=>u==='all'||x.unit===u);$('textbookList').innerHTML=list.map(x=>`<div class="col-md-6 col-xl-4"><div class="vocab-card"><div class="d-flex gap-2"><span class="tag">#${x.no}</span><span class="tag">${esc(x.unit)}</span></div><div class="vocab-word">${esc(x.word)}</div><div class="meaning">${esc(x.meaning)}</div><div class="mini-box"><b>Cách dùng</b>${esc(x.pattern)}</div>${x.family?`<div class="mini-box"><b>Biến thể</b>${esc(x.family)}</div>`:''}</div></div>`).join('');}
$('textbookUnit').onchange=renderTextbook;$('startTextbookReview').onclick=()=>{const u=$('textbookUnit').value;const list=textbookVocab.filter(x=>u==='all'||x.unit===u);reviewQueue=list.map(x=>({type:'textbook',x})).sort(()=>Math.random()-.5);reviewIndex=0;page('review')};
function renderVocab(){const q=($('vocabSearch')?.value||'').toLowerCase(),u=$('vocabUnit')?.value||'all';const list=data.vocab.filter(x=>(u==='all'||x.unit===u)&&`${x.word} ${x.meaning} ${x.family} ${x.pattern} ${x.forms}`.toLowerCase().includes(q));$('vocabList').innerHTML=list.length?list.map(x=>`<div class="col-md-6 col-xl-4"><div class="vocab-card"><span class="tag">${esc(x.unit||'')}</span><span class="tag">${esc(x.pos||'')}</span><div class="vocab-word">${esc(x.word)}</div><div class="pron">${esc(x.pron||'')}</div><div class="meaning">${esc(x.meaning||'Chưa ghi nghĩa')}</div><div class="info-row"><span class="tag">${esc(x.createdDate||'')}</span></div>${x.family?`<div class="mini-box"><b>Word family</b>${esc(x.family)}</div>`:''}${x.forms?`<div class="mini-box"><b>V1 / V2 / V3</b>${esc(x.forms)}</div>`:''}${x.passive?`<div class="mini-box"><b>Bị động / V3</b>${esc(x.passive)}</div>`:''}${x.pattern?`<div class="mini-box"><b>Cấu trúc</b>${esc(x.pattern)}</div>`:''}${x.example?`<div class="mini-box"><b>Ví dụ</b>${esc(x.example)}</div>`:''}${x.note?`<div class="mini-box"><b>Ghi nhớ</b>${esc(x.note)}</div>`:''}<div class="card-actions"><button class="btn btn-sm btn-outline-primary" data-review="vocab" data-id="${x.id}">Ôn từ này</button><button class="btn btn-sm btn-outline-danger" data-del="${x.id}">Xóa</button></div></div></div>`).join(''):'<div class="col-12"><div class="empty"><div>📖</div><h4>Chưa có từ vựng</h4><p>Ghi từ mới ngay sau buổi học để không quên.</p></div></div>';bindDelete();bindReview()}
$('vocabSearch').oninput=renderVocab;$('vocabUnit').onchange=renderVocab;
function renderGrammar(){renderTextbookGrammar();const u=$('grammarUnitFilter')?.value||'all';const list=data.grammar.filter(x=>u==='all'||x.unit===u);$('grammarList').innerHTML=list.length?list.map(x=>`<div class="grammar-card"><div><span class="tag">${esc(x.topic||'')}</span><div class="pattern-title mt-2">${esc(x.title)}</div><p class="muted mb-0">${esc(x.meaning||'')}</p></div><div><div class="formula">${esc(x.formula||'')}</div>${x.example?`<div class="mini-box"><b>Ví dụ</b>${esc(x.example)}</div>`:''}${x.trap?`<div class="trap"><b>⚠ Dễ sai:</b> ${esc(x.trap)}</div>`:''}${x.tip?`<div class="mini-box"><b>Mẹo nhớ</b>${esc(x.tip)}</div>`:''}</div><div><button class="btn btn-sm btn-outline-primary" data-review="grammar" data-id="${x.id}">Ôn</button><button class="btn btn-sm btn-outline-danger mt-2" data-del="${x.id}">Xóa</button></div></div>`).join(''):'<div class="empty"><div>🧩</div><h4>Chưa có cấu trúc</h4><p>Ví dụ: start + to V / V-ing, need + to V / V-ing, be + V3.</p></div>';bindDelete();bindReview()}
function renderMistakes(){const q=($('mistakeSearch')?.value||'').toLowerCase(),f=$('mistakeFilter')?.value||'all';let list=data.mistakes.filter(x=>(f==='all'||(f==='open'&&!x.resolved)||(f==='done'&&x.resolved)||(f==='3'&&Number(x.priority)===3))&&`${x.question} ${x.answer} ${x.rule} ${x.why} ${x.mistakeType}`.toLowerCase().includes(q));$('mistakeList').innerHTML=list.length?list.map(x=>`<div class="mistake-card priority-${x.priority||1} ${x.resolved?'is-done':''}"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(x.mistakeType||'Grammar')}</span><span class="tag">${x.resolved?'✓ Đã xử lý':'⚠ Chưa xử lý'}</span></div><div class="mistake-q mt-2">${esc(x.question)}</div>${x.answer?`<div class="answer-box"><b>Đáp án đúng</b><br>${esc(x.answer)}</div>`:''}${x.why?`<div class="mini-box"><b>Vì sao sai</b>${esc(x.why)}</div>`:''}${x.rule?`<div class="rule-box"><b>Quy tắc cần nhớ</b><br>${esc(x.rule)}</div>`:''}</div><div class="mistake-actions"><button class="btn btn-sm ${x.resolved?'btn-outline-secondary':'btn-success'}" data-resolve="${x.id}" data-state="${x.resolved}">${x.resolved?'↩ Mở lại':'✓ Đã hiểu'}</button><button class="btn btn-sm btn-outline-danger" data-del="${x.id}">Xóa</button></div></div>`).join(''):'<div class="empty"><div>🧹</div><h4>Không có câu phù hợp</h4><p>Đây là chỗ để bạn giữ lại đúng những lỗi mình từng mắc.</p></div>';bindDelete();document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,'users',user.uid,'english_notes',b.dataset.resolve),{resolved:b.dataset.state!=='true',resolvedDate:today()});renderMistakes()})}
$('mistakeSearch').oninput=renderMistakes;$('mistakeFilter').onchange=renderMistakes;
function bindDelete(){document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const id=b.dataset.del;if(b.dataset.busy==='1'||pendingDeletes.has(id))return;if(!confirm('Xóa ghi chú này?'))return;pendingDeletes.add(id);b.dataset.busy='1';b.disabled=true;b.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Đang xóa…';const card=b.closest('.vocab-card,.grammar-card,.mistake-card,.col-md-6');card?.classList.add('is-removing');setTimeout(()=>card?.remove(),120);for(const type of ['vocab','grammar','mistakes'])data[type]=data[type].filter(x=>x.id!==id);try{await deleteDoc(doc(db,'users',user.uid,'english_notes',id));toast('Đã xóa.')}catch(e){toast('Xóa thất bại, dữ liệu sẽ được khôi phục.','error')}finally{pendingDeletes.delete(id);b.dataset.busy='0'}})}
function bindReview(){document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{buildReview([b.dataset.review+':'+b.dataset.id]);page('review')})}
function buildReview(items){reviewQueue=[];items.forEach(k=>{const [type,id]=k.split(':');const arr=type==='vocab'?data.vocab:data.grammar;const x=arr.find(y=>y.id===id);if(x)reviewQueue.push({type,x})});reviewIndex=0;renderReviewCard()}
function startReview(){if(!reviewQueue.length){const mistakes=data.mistakes.filter(x=>!x.resolved).slice(0,5);reviewQueue=[...mistakes.map(x=>({type:'mistake',x})),...data.grammar.slice(0,5).map(x=>({type:'grammar',x})),...data.vocab.slice(0,8).map(x=>({type:'vocab',x}))].sort(()=>Math.random()-.5)}renderReviewCard()}
function renderReviewCard(){if(!reviewQueue.length){$('reviewEmpty').classList.remove('d-none');$('reviewArea').classList.add('d-none');$('reviewProgress').textContent='0 mục';return}$('reviewEmpty').classList.add('d-none');$('reviewArea').classList.remove('d-none');const item=reviewQueue[reviewIndex];$('reviewProgress').textContent=`${reviewIndex+1}/${reviewQueue.length}`;$('reviewAnswer').classList.add('d-none');$('reveal').classList.remove('d-none');$('reviewAgain').classList.add('d-none');$('reviewKnown').classList.add('d-none');if(item.type==='vocab'){const x=item.x;$('reviewType').textContent='TỪ VỰNG';$('reviewPrompt').textContent=x.word;$('reviewExtra').textContent='Tự nói nghĩa + từ loại + cấu trúc / V2 / V3 nếu có.';$('reviewAnswer').innerHTML=`<b>${esc(x.meaning||'Chưa ghi nghĩa')}</b>${x.pos?` · ${esc(x.pos)}`:''}${x.forms?`<br>V1/V2/V3: ${esc(x.forms)}`:''}${x.passive?`<br>Bị động/V3: ${esc(x.passive)}`:''}${x.pattern?`<br>Cấu trúc: ${esc(x.pattern)}`:''}`}else if(item.type==='textbook'){const x=item.x;$('reviewType').textContent=`TỪ VỰNG SGK · ${x.unit}`;$('reviewPrompt').textContent=x.word;$('reviewExtra').textContent='Tự nói nghĩa + cách dùng trước khi mở đáp án.';$('reviewAnswer').innerHTML=`<b>${esc(x.meaning)}</b><br>${esc(x.pattern)}${x.family?`<br><br><b>Biến thể:</b> ${esc(x.family)}`:''}`}else if(item.type==='grammar'){const x=item.x;$('reviewType').textContent='CẤU TRÚC';$('reviewPrompt').textContent=x.title;$('reviewExtra').textContent='Tự điền công thức và một ví dụ trước khi xem.';$('reviewAnswer').innerHTML=`<div class="formula">${esc(x.formula||'')}</div>${x.example?`<div class="mt-2">${esc(x.example)}</div>`:''}`}else{const x=item.x;$('reviewType').textContent='CÂU SAI';$('reviewPrompt').textContent=x.question;$('reviewExtra').textContent='Tự sửa câu trước khi xem đáp án.';$('reviewAnswer').innerHTML=`<b>Đáp án:</b> ${esc(x.answer||'Chưa ghi')}<br><b>Quy tắc:</b> ${esc(x.rule||'Chưa ghi')}`}}
$('reveal').onclick=()=>{$('reviewAnswer').classList.remove('d-none');$('reveal').classList.add('d-none');$('reviewAgain').classList.remove('d-none');$('reviewKnown').classList.remove('d-none')};
$('reviewAgain').onclick=()=>{const x=reviewQueue.splice(reviewIndex,1)[0];reviewQueue.push(x);if(reviewIndex>=reviewQueue.length)reviewIndex=0;renderReviewCard()};$('reviewKnown').onclick=()=>{reviewQueue.splice(reviewIndex,1);if(reviewIndex>=reviewQueue.length)reviewIndex=0;renderReviewCard()};
// Seed practical examples only in local UI; they are not written to Firestore automatically.
$('vWord').addEventListener('blur',()=>{const w=$('vWord').value.trim().toLowerCase();const hints={start:{pattern:'start + to V / V-ing',note:'Cả hai dạng đều thường dùng được.'},need:{pattern:'need + to V / need + V-ing',passive:'need + V-ing = cần được làm',note:'So sánh với need to V = cần làm.'},go:{forms:'go — went — gone',passive:'be + gone không phải bị động của go',note:'V3 của go là gone.'},write:{forms:'write — wrote — written',note:'Bất quy tắc: V2 wrote, V3 written.'}};const h=hints[w];if(h){if(!$('vPattern').value)$('vPattern').value=h.pattern||'';if(!$('vForms').value)$('vForms').value=h.forms||'';if(!$('vPassive').value)$('vPassive').value=h.passive||'';if(!$('vNote').value)$('vNote').value=h.note||''}});

// ===== UNIT EXERCISES =====
let exerciseSession=null;
const exerciseStoreKey='englishNotebook.exerciseScores.v1';
const getExerciseScores=()=>{try{return JSON.parse(localStorage.getItem(exerciseStoreKey)||'{}')}catch{return {}}};
const saveExerciseScore=(unit,score,total)=>{const all=getExerciseScores();const old=all[unit];if(!old||score>old.score)all[unit]={score,total,percent:Math.round(score/total*100),date:today()};localStorage.setItem(exerciseStoreKey,JSON.stringify(all))};
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function exerciseItems(unit,count){const s=exerciseBank.find(x=>x.unit===unit)?.sections;if(!s)return[];const out=[];shuffle(s.mcq).slice(0,count).forEach(q=>out.push({kind:'mcq',q}));shuffle(s.two).slice(0,count).forEach(q=>out.push({kind:'two',q}));shuffle(s.form).slice(0,count).forEach(q=>out.push({kind:'form',q}));shuffle(s.rewrite).slice(0,count).forEach(q=>out.push({kind:'rewrite',q}));shuffle(s.reading.qs).forEach(q=>out.push({kind:'reading',q}));const c=Array.isArray(s.closest)?s.closest:[s.closest],o=Array.isArray(s.opposite)?s.opposite:[s.opposite];shuffle(c).slice(0,Math.min(count,4)).forEach(q=>out.push({kind:'closest',q}));shuffle(o).slice(0,Math.min(count,4)).forEach(q=>out.push({kind:'opposite',q}));return shuffle(out)}
function renderExerciseOverview(){const unit=$('exerciseUnit')?.value;const d=exerciseBank.find(x=>x.unit===unit);if(!d)return;const scores=getExerciseScores();const best=scores[unit];$('exerciseOverview').innerHTML=`<div class="exercise-title"><div><span class="tag">${esc(d.unit)}</span><h3>${esc(d.title)}</h3><p class="muted mb-0"><b>Grammar:</b> ${esc(d.grammar)} · <b>Reading:</b> ${esc(d.reading)}</p></div>${best?`<div class="best-score"><span>Best</span><b>${best.percent}%</b><small>${best.score}/${best.total}</small></div>`:''}</div><div class="exercise-types"><span>ABCD</span><span>1 trong 2</span><span>Correct form</span><span>Rewrite</span><span>Reading</span><span>Closest</span><span>Opposite</span></div>`}
function renderExerciseCard(){const s=exerciseSession;if(!s)return;const item=s.items[s.index];const total=s.items.length;$('exerciseArea').innerHTML=`<div class="exercise-top"><div><span class="tag">${esc(s.unit)}</span><b class="ms-2">${s.index+1}/${total}</b></div><div class="exercise-progress"><span style="width:${Math.round((s.index)/total*100)}%"></span></div></div>${renderExerciseItem(item,s.index)}<div class="exercise-nav"><button id="exercisePrev" class="btn btn-outline-secondary" ${s.index===0?'disabled':''}>← Câu trước</button><button id="exerciseCheck" class="btn btn-primary">${s.index===total-1?'Nộp bài':'Kiểm tra'}</button><button id="exerciseNext" class="btn btn-outline-primary d-none">Tiếp →</button></div><div id="exerciseFeedback" class="exercise-feedback d-none"></div>`;bindExerciseAnswer(item);$('exerciseCheck').onclick=checkExerciseAnswer}
// ===== Reading word helper =====
const readingHighlightKey='englishNotebook.readingHighlights.v1';
const normalizeWord=s=>String(s||'').trim().toLowerCase().replace(/[“”‘’.,!?;:()\[\]{}]/g,'').replace(/\s+/g,' ');
function getReadingHighlights(){try{return JSON.parse(localStorage.getItem(readingHighlightKey)||'{}')}catch{return {}}}
function saveReadingHighlight(unit,text,meaning){const all=getReadingHighlights();all[unit]=Array.isArray(all[unit])?all[unit]:[];const key=normalizeWord(text);if(!all[unit].some(x=>normalizeWord(x.text)===key)){all[unit].push({text,meaning})}localStorage.setItem(readingHighlightKey,JSON.stringify(all))}
function highlightSavedReading(text,unit){const hs=(getReadingHighlights()[unit]||[]).filter(x=>x.text);let html=esc(text);hs.sort((a,b)=>b.text.length-a.text.length).forEach(h=>{const pattern=h.text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');try{html=html.replace(new RegExp(`(?<![A-Za-z])${pattern}(?![A-Za-z])`,'gi'),m=>`<strong class="reading-highlight" title="${esc(h.meaning||'')}">${esc(m)}</strong>`)}catch{}});return html}
function glossaryMeaning(term,unit){const key=normalizeWord(term);const exact=textbookVocab.find(x=>normalizeWord(x.word)===key);if(exact)return exact.meaning;const lower=key.replace(/s$/,'');const partial=textbookVocab.find(x=>normalizeWord(x.word)===lower);if(partial)return partial.meaning;const common={healthy:'khỏe mạnh',lifestyle:'lối sống',require:'yêu cầu',extreme:'cực đoan',change:'thay đổi',teenager:'thanh thiếu niên',teenagers:'thanh thiếu niên',begin:'bắt đầu',sleeping:'việc ngủ',enough:'đủ',drinking:'việc uống',water:'nước',regular:'thường xuyên',exercise:'tập thể dục',habit:'thói quen',habits:'thói quen',improve:'cải thiện',energy:'năng lượng',concentration:'sự tập trung',matter:'quan trọng',consistency:'tính đều đặn',student:'học sinh',short:'ngắn',time:'thời gian',several:'một vài',days:'ngày',week:'tuần',benefit:'có lợi',someone:'ai đó',long:'dài',once:'một lần',generation:'thế hệ',conflict:'xung đột',efficient:'hiệu quả',responsible:'có trách nhiệm',cooperate:'hợp tác',strengthen:'củng cố',practical:'thiết thực',informed:'có đầy đủ thông tin',gradual:'dần dần',independent:'độc lập',responsibility:'trách nhiệm',trusted:'đáng tin cậy',habitat:'môi trường sống',restore:'khôi phục'};return common[key]||''}
let readingSelection=null;
function getSelectedReadingText(){const sel=window.getSelection();if(!sel||sel.isCollapsed)return null;const node=sel.anchorNode;const passage=node?.nodeType===3?node.parentElement?.closest('.reading-passage'):node?.closest?.('.reading-passage');if(!passage||!passage.contains(sel.focusNode))return null;const text=sel.toString().trim();if(!text)return null;return {text,range:sel.getRangeAt(0).cloneRange(),passage,unit:passage.dataset.readingUnit||exerciseSession?.unit||'Review'}}
function showReadingSelectionTools(){const item=getSelectedReadingText();if(!item)return;readingSelection=item;let bar=document.getElementById('readingFloatingTools');if(!bar){bar=document.createElement('div');bar.id='readingFloatingTools';bar.className='reading-floating-tools';document.body.appendChild(bar)}const meaning=glossaryMeaning(item.text,item.unit);bar.innerHTML=`<span class="reading-selected">“${esc(item.text.slice(0,35))}${item.text.length>35?'…':''}”</span><button class="btn btn-sm btn-light" data-reading-action="bold">🖊 Tô đậm</button><button class="btn btn-sm btn-light" data-reading-action="translate">🌐 Dịch</button><button class="btn btn-sm btn-primary" data-reading-action="both">✨ Tô đậm + dịch</button><button class="btn btn-sm btn-success" data-reading-action="add">＋ Từ mới</button>`;bar.querySelectorAll('[data-reading-action]').forEach(b=>b.onclick=()=>readingAction(b.dataset.readingAction,meaning));requestAnimationFrame(()=>{const r=item.range.getBoundingClientRect();bar.style.left=`${Math.max(8,Math.min(window.innerWidth-390,r.left))}px`;bar.style.top=`${Math.max(8,r.bottom+8)}px`;bar.classList.add('show')})}
function hideReadingSelectionTools(){document.getElementById('readingFloatingTools')?.classList.remove('show')}
async function translateReading(term,unit){const local=glossaryMeaning(term,unit);if(local)return local;try{const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|vi`;const res=await fetch(url,{signal:AbortSignal.timeout(5000)});const json=await res.json();return json?.responseData?.translatedText||''}catch{return ''}}
async function readingAction(action,knownMeaning=''){if(!readingSelection)return;const {text,range,passage,unit}=readingSelection;let meaning=knownMeaning;if(action==='translate'||action==='both'||action==='add')meaning=meaning||await translateReading(text,unit);if(action==='bold'||action==='both'){try{const strong=document.createElement('strong');strong.className='reading-highlight';strong.title=meaning||'';range.surroundContents(strong)}catch{saveReadingHighlight(unit,text,meaning);passage.innerHTML=highlightSavedReading(exerciseBank.find(x=>x.unit===unit).sections.reading.text,unit)}if(action==='both'&&meaning)showReadingTranslation(text,meaning)}else if(action==='translate'){showReadingTranslation(text,meaning)}if(action==='add'){openVocabFromReading(text,meaning,unit)}hideReadingSelectionTools();window.getSelection()?.removeAllRanges()}
function showReadingTranslation(text,meaning){const box=document.getElementById('readingSelectionResult');if(!box)return;box.classList.remove('d-none');box.innerHTML=`<span class="reading-chip-word">${esc(text)}</span><span class="reading-chip-arrow">→</span><span class="reading-chip-meaning">${esc(meaning||'Chưa tìm thấy nghĩa tự động — bạn có thể nhập lại trong Từ mới.')}</span>`}
function openVocabFromReading(text,meaning,unit){page('capture');document.querySelectorAll('.capture-tab').forEach(x=>x.classList.toggle('active',x.dataset.capture==='vocab'));document.querySelectorAll('.capture-form').forEach(x=>x.classList.add('d-none'));$('vocabForm').classList.remove('d-none');$('vUnit').value=unit.startsWith('Unit')?unit:'Review';$('vWord').value=text;$('vMeaning').value=meaning||'';setTimeout(()=>{$('vWord').focus();$('vWord').scrollIntoView({behavior:'smooth',block:'center'});toast('Đã đưa từ vào ô Từ mới — kiểm tra nghĩa rồi lưu nhé.')},80)}
document.addEventListener('mouseup',()=>setTimeout(showReadingSelectionTools,0));document.addEventListener('keyup',e=>{if(e.key==='Shift'||e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown')setTimeout(showReadingSelectionTools,0)});document.addEventListener('mousedown',e=>{if(!e.target.closest('#readingFloatingTools'))setTimeout(()=>{if(!getSelectedReadingText())hideReadingSelectionTools()},120)});

function renderExerciseItem(item,n){const typeLabels={mcq:'Choose the best answer — ABCD',two:'Choose ONE of the TWO',form:'Complete the sentence — correct form',rewrite:'Rewrite without changing meaning',reading:'Reading comprehension',closest:'Closest meaning',opposite:'Opposite meaning'};if(item.kind==='mcq'){const [stem,...rest]=item.q;const opts=rest.slice(0,4);return `<div class="exercise-card"><div class="exercise-label">${typeLabels[item.kind]}</div><h4>${n+1}. ${esc(stem)}</h4><div class="option-grid">${opts.map((x,i)=>`<label class="exercise-option"><input type="radio" name="exAnswer" value="${i}"><span><b>${'ABCD'[i]}.</b> ${esc(x)}</span></label>`).join('')}</div></div>`}
if(item.kind==='two'){const [stem,a,b,ans]=item.q;return `<div class="exercise-card"><div class="exercise-label">${typeLabels[item.kind]}</div><h4>${n+1}. ${esc(stem)}</h4><div class="option-grid two">${[a,b].map((x,i)=>`<label class="exercise-option"><input type="radio" name="exAnswer" value="${i}"><span>${i?'B':'A'}. ${esc(x)}</span></label>`).join('')}</div></div>`}
if(item.kind==='form'){const [stem,answer]=item.q;return `<div class="exercise-card"><div class="exercise-label">${typeLabels[item.kind]}</div><h4>${n+1}. ${esc(stem)}</h4><input id="exText" class="form-control form-control-lg" autocomplete="off" placeholder="Type the correct form…"></div>`}
if(item.kind==='rewrite'){const [src,answer]=item.q;return `<div class="exercise-card"><div class="exercise-label">${typeLabels[item.kind]}</div><div class="rewrite-source">${esc(src)}</div><input id="exText" class="form-control form-control-lg mt-3" autocomplete="off" placeholder="Write the new sentence…"></div>`}
if(item.kind==='reading'){const [q,opts,ans]=item.q;const passage=exerciseBank.find(x=>x.unit===exerciseSession.unit).sections.reading.text;return `<div class="exercise-card"><div class="exercise-label">${typeLabels[item.kind]}</div><div class="reading-tools"><div class="reading-tool-hint">💡 Bôi đen một từ/cụm từ trong bài đọc để <b>tô đậm · dịch · thêm vào Từ mới</b>.</div><div class="reading-selection-result d-none" id="readingSelectionResult"></div></div><div class="reading-passage" data-reading-unit="${esc(exerciseSession.unit)}">${highlightSavedReading(passage,exerciseSession.unit)}</div><h4>${n+1}. ${esc(q)}</h4><div class="option-grid">${opts.map((x,i)=>`<label class="exercise-option"><input type="radio" name="exAnswer" value="${i}"><span><b>${'ABCD'[i]}.</b> ${esc(x)}</span></label>`).join('')}</div></div>`}
const [word,a,b,ans]=item.q;return `<div class="exercise-card"><div class="exercise-label">${typeLabels[item.kind]}</div><h4>${n+1}. ${esc(word)}</h4><p class="muted">Choose the word closest to / opposite to <b>${esc(word)}</b>.</p><div class="option-grid">${[a,b,word==='benefit'?'avoid':'ignore',word==='benefit'?'repeat':'preserve'].map((x,i)=>`<label class="exercise-option"><input type="radio" name="exAnswer" value="${i}"><span><b>${'ABCD'[i]}.</b> ${esc(x)}</span></label>`).join('')}</div></div>`}
function bindExerciseAnswer(item){$('exercisePrev')?.addEventListener('click',()=>{if(exerciseSession.index>0){exerciseSession.index--;renderExerciseCard()}});}
function normalizeAnswer(s){return String(s||'').trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ')}
function correctExercise(item,val){if(item.kind==='mcq'||item.kind==='two'||item.kind==='reading')return Number(val)===Number(item.q[item.kind==='mcq'?5:item.kind==='two'?3:2]);if(item.kind==='form'||item.kind==='rewrite')return normalizeAnswer(val)===normalizeAnswer(item.q[1]);return Number(val)===Number(item.q[4]??item.q[3])}
function answerText(item){if(item.kind==='mcq')return item.q[5];if(item.kind==='two')return item.q[3];if(item.kind==='reading')return item.q[2];if(item.kind==='form'||item.kind==='rewrite')return item.q[1];return item.q[4]??item.q[3]}
async function checkExerciseAnswer(){const s=exerciseSession,item=s.items[s.index];if(s.checking)return;let val;if(item.kind==='form'||item.kind==='rewrite')val=$('exText')?.value||'';else val=document.querySelector('input[name="exAnswer"]:checked')?.value;if(val===undefined||val===''){toast('Chọn/nhập đáp án trước nhé.','error');return}s.checking=true;const btn=$('exerciseCheck');if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Đang kiểm tra…'}const ok=correctExercise(item,val);if(!s.answered){if(ok)s.score++;s.answered=true}s.lastAnswer=val;const fb=$('exerciseFeedback');fb.classList.remove('d-none');fb.className='exercise-feedback '+(ok?'correct':'wrong');const ans=answerText(item);const label=(item.kind==='mcq'||item.kind==='reading'||item.kind==='closest'||item.kind==='opposite')?['A','B','C','D'][ans]:(item.kind==='two'?['A','B'][ans]:ans);fb.innerHTML=`<b>${ok?'✓ Chính xác':'✗ Chưa đúng'}</b><div class="mt-1">Đáp án: <b>${esc(label)}</b></div>${item.q[6]?`<small>${esc(item.q[6])}</small>`:''}`;if(!ok&&user){try{const prompt=item.kind==='mcq'?item.q[0]:item.kind==='two'?item.q[0]:item.kind==='reading'?item.q[0]:item.kind==='form'?item.q[0]:item.kind==='rewrite'?item.q[0]:`Choose the ${item.kind} meaning of ${item.q[0]}`;const correct=item.kind==='mcq'?item.q[1+ans]:item.kind==='reading'?item.q[1][ans]:item.kind==='closest'||item.kind==='opposite'?item.q[1+ans]:item.kind==='two'?item.q[1+ans]:item.q[1];const rule=item.q[6]||`Đáp án đúng: ${correct}`;await addNote('mistakes',{unit:s.unit,question:String(prompt),answer:String(correct),mistakeType:'Bài tập',why:'Sai khi tự luyện — xem lại câu và quy tắc.',rule:String(rule),priority:2,resolved:false,resolvedDate:'',source:'exercise'});toast('Đã tự động ghim câu sai vào Sổ câu sai.','error')}catch(e){}}$('exerciseCheck').classList.add('d-none');if(s.index<s.items.length-1){const n=document.createElement('button');n.id='exerciseNext';n.className='btn btn-primary';n.textContent='Tiếp →';n.onclick=()=>{s.index++;s.answered=false;s.checking=false;renderExerciseCard()};$('exerciseArea').querySelector('.exercise-nav').appendChild(n)}else{const n=document.createElement('button');n.id='exerciseFinish';n.className='btn btn-success';n.textContent='Xem kết quả';n.onclick=finishExercise;$('exerciseArea').querySelector('.exercise-nav').appendChild(n)}s.checking=false}function finishExercise(){const s=exerciseSession;saveExerciseScore(s.unit,s.score,s.items.length);$('exerciseArea').innerHTML=`<div class="panel exercise-result"><div class="result-icon">${s.score===s.items.length?'🏆':'🎯'}</div><h2>${s.score}/${s.items.length}</h2><p>${Math.round(s.score/s.items.length*100)}% · ${s.score===s.items.length?'Quá sạch!':'Làm lại Unit này để vá những câu sai.'}</p><div class="result-actions"><button id="retryExercise" class="btn btn-primary">↻ Làm lại</button><button id="backExercise" class="btn btn-outline-secondary">← Chọn Unit khác</button></div></div>`;$('retryExercise').onclick=startExercise;$('backExercise').onclick=()=>{$('exerciseArea').classList.add('d-none');$('exerciseSetup').classList.remove('d-none');renderExerciseOverview()}}
function startExercise(){const unit=$('exerciseUnit').value,count=Number($('exerciseCount').value||3);exerciseSession={unit,items:exerciseItems(unit,count),index:0,score:0,answered:false};$('exerciseSetup').classList.add('d-none');$('exerciseArea').classList.remove('d-none');renderExerciseCard()}
$('exerciseUnit')?.addEventListener('change',()=>{renderExerciseOverview();$('exerciseArea')?.classList.add('d-none');$('exerciseSetup')?.classList.remove('d-none')});$('startExercise')?.addEventListener('click',startExercise);renderExerciseOverview();

// ===== Listening: school-test style, 6 blanks, max 2 plays =====
let listeningSession=null;
function listeningTests(unit){return listeningBank.filter(x=>x.unit===unit)}
function renderListeningTests(){const u=$('listeningUnit')?.value;if(!u||!$('listeningTest'))return;const tests=listeningTests(u);$('listeningTest').innerHTML=tests.map((x,i)=>`<option value="${i}">Đề ${i+1} · ${esc(x.title)}</option>`).join('')}
function listeningNormalize(v){return String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[“”"'.,!?;:()\-]/g,' ').replace(/\s+/g,' ').trim()}
function listeningAnswerOK(given,answer){const a=listeningNormalize(given),b=listeningNormalize(answer);if(!a)return false;if(a===b)return true;const al=a.replace(/\b(a|an|the)\b/g,'').replace(/\s+/g,' ').trim(),bl=b.replace(/\b(a|an|the)\b/g,'').replace(/\s+/g,' ').trim();return al===bl}
function listeningTranscript(item){let text=esc(item.script);for(const ans of [...item.blanks].sort((a,b)=>b.length-a.length)){const safe=ans.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.replace(new RegExp(safe,'i'),`<mark>${esc(ans)}</mark>`)}return text}
function renderListeningCard(){const s=listeningSession;if(!s)return;const item=s.item;const src=listeningSources?.[s.unit];let player='';if(src?.type==='youtube'){const start=Number(src.start||0);player=`<div class="ratio ratio-16x9 original-video"><iframe src="https://www.youtube.com/embed/${src.id}?rel=0&start=${start}" title="${esc(src.label)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="d-flex flex-wrap gap-2 mt-2"><a class="btn btn-sm btn-outline-primary" href="https://www.youtube.com/watch?v=${encodeURIComponent(src.id)}&t=${start}s" target="_blank" rel="noopener">↗ Mở audio gốc</a><a class="btn btn-sm btn-outline-secondary" href="${esc(src.page)}" target="_blank" rel="noopener">📖 Xem bài Listening</a></div>`}else{player=`<div class="source-listening-box"><b>🎧 Nguồn Listening gốc</b><a class="btn btn-outline-primary ms-2" href="${esc(src?.page||item.sourcePage)}" target="_blank" rel="noopener">Mở nguồn</a></div>`}$('listeningArea').innerHTML=`<div class="listening-top"><span class="tag">${esc(s.unit)}</span><b>6 chỗ trống</b><div class="listening-progress"><span style="width:${s.submitted?100:0}%"></span></div></div><div class="listening-card"><div class="listening-label">LISTENING · ORIGINAL TEXTBOOK AUDIO</div><div class="listening-title">${esc(item.title)}</div>${player}<div class="listen-note mt-3"><b>Nghe bài gốc</b> → nghe tối đa 2 lần → điền 6 chỗ trống. Câu hỏi được chuyển sang đúng format bài kiểm tra ở trường.</div><div class="blank-list">${item.prompts.map((p,i)=>`<div class="blank-row"><div class="blank-num">${i+1}</div><div class="flex-grow-1"><div class="small mb-1">${esc(p)}</div><input id="listenBlank${i}" autocomplete="off" spellcheck="false" placeholder="Điền đáp án..."></div></div>`).join('')}</div><div id="listeningFeedback"></div><div class="listening-actions"><button id="listenBack" class="btn btn-outline-secondary">← Chọn Unit khác</button><button id="submitListening" class="btn btn-primary">Nộp bài</button></div></div>`;bindListeningCard()} 
function bindListeningCard(){const s=listeningSession;if(!s)return;$('submitListening').onclick=()=>checkListening();$('listenBack').onclick=()=>{$('listeningArea').classList.add('d-none');$('listeningSetup').classList.remove('d-none')};$('listeningArea').querySelectorAll('input').forEach((el,i)=>el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(i<5)$(`listenBlank${i+1}`)?.focus();else checkListening()}}))}
function renderListeningCounterOnly(){const el=document.querySelector('.listen-count');if(el&&listeningSession)el.textContent=`Lần nghe: ${listeningSession.plays}/2`}
async function checkListening(){const s=listeningSession;if(!s||s.submitted)return;const btn=$('submitListening');if(btn.dataset.busy==='1')return;btn.dataset.busy='1';btn.disabled=true;const answers=s.item.blanks.map((_,i)=>$(`listenBlank${i}`)?.value.trim()||'');const results=answers.map((x,i)=>listeningAnswerOK(x,s.item.blanks[i]));const score=results.filter(Boolean).length;s.submitted=true;s.score=score;const fb=$('listeningFeedback');fb.innerHTML=`<div class="listening-feedback ${score===6?'correct':'wrong'}"><b>${score===6?'✓ Hoàn hảo':'🎯 Kết quả: '+score+'/6'}</b><div class="mt-1">${results.map((ok,i)=>`<div>${i+1}. ${ok?'✓ Đúng':'✗ Sai'} ${ok?'':`· Đáp án: <span class="listening-answer">${esc(s.item.blanks[i])}</span>`}</div>`).join('')}</div></div><div class="listening-transcript"><b>📜 Bài gốc & transcript</b><div class="mt-2"><a href="${esc(s.item.sourcePage)}" target="_blank" rel="noopener">Mở nguồn Listening của ${esc(s.unit)}</a></div></div>`;document.querySelector('.listening-progress span').style.width='100%';document.querySelectorAll('.blank-row input').forEach((el,i)=>{el.disabled=true;el.classList.toggle('is-correct',results[i])});btn.innerHTML='✓ Đã nộp';if(score<6&&user){for(let i=0;i<6;i++){if(!results[i]){try{await addNote('mistakes',{unit:s.unit,question:`Listening: ${s.item.title} — chỗ trống ${i+1}`,answer:s.item.blanks[i],mistakeType:'Listening',why:'Chưa nghe ra từ/cụm từ trong bài nghe.',rule:`Nghe lại từ khóa trong ngữ cảnh: ${s.item.blanks[i]}`,priority:2,resolved:false,resolvedDate:'',source:'listening'});}catch(e){}}}toast('Các chỗ sai đã được ghim vào Sổ câu sai.','error')}else toast('Đã chấm bài Listening.');}
function startListening(){const u=$('listeningUnit')?.value;const i=Number($('listeningTest')?.value||0);const item=listeningTests(u)[i];if(!item)return;listeningSession={unit:u,item,plays:0,submitted:false,score:0};$('listeningSetup').classList.add('d-none');$('listeningArea').classList.remove('d-none');renderListeningCard()}
$('listeningUnit')?.addEventListener('change',renderListeningTests);$('startListening')?.addEventListener('click',startListening);renderListeningTests();
