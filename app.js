import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore,collection,addDoc,doc,updateDoc,deleteDoc,onSnapshot,serverTimestamp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id);let user=null,unsub=null,data={vocab:[],grammar:[],mistakes:[]},reviewQueue=[],reviewIndex=0;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function page(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('d-none'));$(id)?.classList.remove('d-none');document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id));if(id==='home')renderHome();if(id==='vocab')renderVocab();if(id==='grammar')renderGrammar();if(id==='mistakes')renderMistakes();if(id==='review')startReview();if(id==='textbook')renderTextbook()}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('login').onclick=async()=>{try{await signInWithPopup(auth,provider)}catch(e){$('authErr').textContent=e.message;$('authErr').classList.remove('d-none')}};$('logout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{user=u;if(u){$('auth').classList.add('d-none');$('app').classList.remove('d-none');$('user').textContent=u.displayName||u.email||'';listen()}else{$('auth').classList.remove('d-none');$('app').classList.add('d-none');if(unsub)unsub()}});
const base=()=>collection(db,'users',user.uid,'english_notes');
function listen(){unsub=onSnapshot(base(),snap=>{data={vocab:[],grammar:[],mistakes:[]};snap.forEach(d=>{const x={id:d.id,...d.data()};if(data[x.type])data[x.type].push(x)});data.vocab.sort(sortDate);data.grammar.sort(sortDate);data.mistakes.sort((a,b)=>(Number(b.priority||1)-Number(a.priority||1))||sortDate(a,b));renderHome();renderVocab();renderGrammar();renderMistakes()})}
function sortDate(a,b){return String(b.createdDate||'').localeCompare(String(a.createdDate||''))}
async function addNote(type,payload){await addDoc(base(),{type,createdDate:today(),createdAt:serverTimestamp(),...payload})}
function reset(ids){ids.forEach(id=>$(id).value='')}
function getRadio(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||'1'}
$('saveVocab').onclick=async()=>{const word=$('vWord').value.trim();if(!word)return alert('Bạn chưa nhập từ / cụm từ.');await addNote('vocab',{unit:$('vUnit').value,word,meaning:$('vMeaning').value.trim(),pos:$('vPos').value,pron:$('vPron').value.trim(),family:$('vFamily').value.trim(),forms:$('vForms').value.trim(),passive:$('vPassive').value.trim(),pattern:$('vPattern').value.trim(),example:$('vExample').value.trim(),note:$('vNote').value.trim()});reset(['vWord','vMeaning','vPron','vFamily','vForms','vPassive','vPattern','vExample','vNote']);alert('Đã lưu từ mới.');renderVocab()};
$('clearVocab').onclick=()=>reset(['vWord','vMeaning','vPron','vFamily','vForms','vPassive','vPattern','vExample','vNote']);
$('saveGrammar').onclick=async()=>{const title=$('gTitle').value.trim();if(!title)return alert('Bạn chưa nhập cấu trúc.');await addNote('grammar',{unit:$('gUnit').value,title,meaning:$('gMeaning').value.trim(),topic:$('gTopic').value,formula:$('gFormula').value.trim(),example:$('gExample').value.trim(),trap:$('gTrap').value.trim(),tip:$('gTip').value.trim()});reset(['gTitle','gMeaning','gFormula','gExample','gTrap','gTip']);alert('Đã lưu cấu trúc.');renderGrammar()};
$('clearGrammar').onclick=()=>reset(['gTitle','gMeaning','gFormula','gExample','gTrap','gTip']);
$('saveMistake').onclick=async()=>{const question=$('mQuestion').value.trim();if(!question)return alert('Bạn chưa nhập câu sai.');await addNote('mistakes',{unit:$('mUnit').value,question,answer:$('mAnswer').value.trim(),mistakeType:$('mType').value,why:$('mWhy').value.trim(),rule:$('mRule').value.trim(),priority:Number(getRadio('mLevel')),resolved:false,resolvedDate:''});reset(['mQuestion','mAnswer','mWhy','mRule']);alert('Đã ghim câu sai vào sổ lỗi.');renderMistakes()};
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
function renderTextbook(){const u=$('textbookUnit')?.value||'all';const list=textbookVocab.filter(x=>u==='all'||x.unit===u);$('textbookList').innerHTML=list.map(x=>`<div class="col-md-6 col-xl-4"><div class="vocab-card"><div class="d-flex gap-2"><span class="tag">#${x.no}</span><span class="tag">${esc(x.unit)}</span></div><div class="vocab-word">${esc(x.word)}</div><div class="meaning">${esc(x.meaning)}</div><div class="mini-box"><b>Cách dùng</b>${esc(x.pattern)}</div>${x.family?`<div class="mini-box"><b>Biến thể</b>${esc(x.family)}</div>`:''}</div></div>`).join('');}
$('textbookUnit').onchange=renderTextbook;$('startTextbookReview').onclick=()=>{const u=$('textbookUnit').value;const list=textbookVocab.filter(x=>u==='all'||x.unit===u);reviewQueue=list.map(x=>({type:'textbook',x})).sort(()=>Math.random()-.5);reviewIndex=0;page('review')};
function renderVocab(){const q=($('vocabSearch')?.value||'').toLowerCase(),u=$('vocabUnit')?.value||'all';const list=data.vocab.filter(x=>(u==='all'||x.unit===u)&&`${x.word} ${x.meaning} ${x.family} ${x.pattern} ${x.forms}`.toLowerCase().includes(q));$('vocabList').innerHTML=list.length?list.map(x=>`<div class="col-md-6 col-xl-4"><div class="vocab-card"><span class="tag">${esc(x.unit||'')}</span><span class="tag">${esc(x.pos||'')}</span><div class="vocab-word">${esc(x.word)}</div><div class="pron">${esc(x.pron||'')}</div><div class="meaning">${esc(x.meaning||'Chưa ghi nghĩa')}</div><div class="info-row"><span class="tag">${esc(x.createdDate||'')}</span></div>${x.family?`<div class="mini-box"><b>Word family</b>${esc(x.family)}</div>`:''}${x.forms?`<div class="mini-box"><b>V1 / V2 / V3</b>${esc(x.forms)}</div>`:''}${x.passive?`<div class="mini-box"><b>Bị động / V3</b>${esc(x.passive)}</div>`:''}${x.pattern?`<div class="mini-box"><b>Cấu trúc</b>${esc(x.pattern)}</div>`:''}${x.example?`<div class="mini-box"><b>Ví dụ</b>${esc(x.example)}</div>`:''}${x.note?`<div class="mini-box"><b>Ghi nhớ</b>${esc(x.note)}</div>`:''}<div class="card-actions"><button class="btn btn-sm btn-outline-primary" data-review="vocab" data-id="${x.id}">Ôn từ này</button><button class="btn btn-sm btn-outline-danger" data-del="${x.id}">Xóa</button></div></div></div>`).join(''):'<div class="col-12"><div class="empty"><div>📖</div><h4>Chưa có từ vựng</h4><p>Ghi từ mới ngay sau buổi học để không quên.</p></div></div>';bindDelete();bindReview()}
$('vocabSearch').oninput=renderVocab;$('vocabUnit').onchange=renderVocab;
function renderGrammar(){const list=data.grammar;$('grammarList').innerHTML=list.length?list.map(x=>`<div class="grammar-card"><div><span class="tag">${esc(x.topic||'')}</span><div class="pattern-title mt-2">${esc(x.title)}</div><p class="muted mb-0">${esc(x.meaning||'')}</p></div><div><div class="formula">${esc(x.formula||'')}</div>${x.example?`<div class="mini-box"><b>Ví dụ</b>${esc(x.example)}</div>`:''}${x.trap?`<div class="trap"><b>⚠ Dễ sai:</b> ${esc(x.trap)}</div>`:''}${x.tip?`<div class="mini-box"><b>Mẹo nhớ</b>${esc(x.tip)}</div>`:''}</div><div><button class="btn btn-sm btn-outline-primary" data-review="grammar" data-id="${x.id}">Ôn</button><button class="btn btn-sm btn-outline-danger mt-2" data-del="${x.id}">Xóa</button></div></div>`).join(''):'<div class="empty"><div>🧩</div><h4>Chưa có cấu trúc</h4><p>Ví dụ: start + to V / V-ing, need + to V / V-ing, be + V3.</p></div>';bindDelete();bindReview()}
function renderMistakes(){const q=($('mistakeSearch')?.value||'').toLowerCase(),f=$('mistakeFilter')?.value||'all';let list=data.mistakes.filter(x=>(f==='all'||(f==='open'&&!x.resolved)||(f==='done'&&x.resolved)||(f==='3'&&Number(x.priority)===3))&&`${x.question} ${x.answer} ${x.rule} ${x.why} ${x.mistakeType}`.toLowerCase().includes(q));$('mistakeList').innerHTML=list.length?list.map(x=>`<div class="mistake-card priority-${x.priority||1} ${x.resolved?'is-done':''}"><div><div class="d-flex gap-2 flex-wrap"><span class="tag">${esc(x.mistakeType||'Grammar')}</span><span class="tag">${x.resolved?'✓ Đã xử lý':'⚠ Chưa xử lý'}</span></div><div class="mistake-q mt-2">${esc(x.question)}</div>${x.answer?`<div class="answer-box"><b>Đáp án đúng</b><br>${esc(x.answer)}</div>`:''}${x.why?`<div class="mini-box"><b>Vì sao sai</b>${esc(x.why)}</div>`:''}${x.rule?`<div class="rule-box"><b>Quy tắc cần nhớ</b><br>${esc(x.rule)}</div>`:''}</div><div class="mistake-actions"><button class="btn btn-sm ${x.resolved?'btn-outline-secondary':'btn-success'}" data-resolve="${x.id}" data-state="${x.resolved}">${x.resolved?'↩ Mở lại':'✓ Đã hiểu'}</button><button class="btn btn-sm btn-outline-danger" data-del="${x.id}">Xóa</button></div></div>`).join(''):'<div class="empty"><div>🧹</div><h4>Không có câu phù hợp</h4><p>Đây là chỗ để bạn giữ lại đúng những lỗi mình từng mắc.</p></div>';bindDelete();document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,'users',user.uid,'english_notes',b.dataset.resolve),{resolved:b.dataset.state!=='true',resolvedDate:today()});renderMistakes()})}
$('mistakeSearch').oninput=renderMistakes;$('mistakeFilter').onchange=renderMistakes;
function bindDelete(){document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Xóa ghi chú này?'))await deleteDoc(doc(db,'users',user.uid,'english_notes',b.dataset.del))})}
function bindReview(){document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{buildReview([b.dataset.review+':'+b.dataset.id]);page('review')})}
function buildReview(items){reviewQueue=[];items.forEach(k=>{const [type,id]=k.split(':');const arr=type==='vocab'?data.vocab:data.grammar;const x=arr.find(y=>y.id===id);if(x)reviewQueue.push({type,x})});reviewIndex=0;renderReviewCard()}
function startReview(){if(!reviewQueue.length){const mistakes=data.mistakes.filter(x=>!x.resolved).slice(0,5);reviewQueue=[...mistakes.map(x=>({type:'mistake',x})),...data.grammar.slice(0,5).map(x=>({type:'grammar',x})),...data.vocab.slice(0,8).map(x=>({type:'vocab',x}))].sort(()=>Math.random()-.5)}renderReviewCard()}
function renderReviewCard(){if(!reviewQueue.length){$('reviewEmpty').classList.remove('d-none');$('reviewArea').classList.add('d-none');$('reviewProgress').textContent='0 mục';return}$('reviewEmpty').classList.add('d-none');$('reviewArea').classList.remove('d-none');const item=reviewQueue[reviewIndex];$('reviewProgress').textContent=`${reviewIndex+1}/${reviewQueue.length}`;$('reviewAnswer').classList.add('d-none');$('reveal').classList.remove('d-none');$('reviewAgain').classList.add('d-none');$('reviewKnown').classList.add('d-none');if(item.type==='vocab'){const x=item.x;$('reviewType').textContent='TỪ VỰNG';$('reviewPrompt').textContent=x.word;$('reviewExtra').textContent='Tự nói nghĩa + từ loại + cấu trúc / V2 / V3 nếu có.';$('reviewAnswer').innerHTML=`<b>${esc(x.meaning||'Chưa ghi nghĩa')}</b>${x.pos?` · ${esc(x.pos)}`:''}${x.forms?`<br>V1/V2/V3: ${esc(x.forms)}`:''}${x.passive?`<br>Bị động/V3: ${esc(x.passive)}`:''}${x.pattern?`<br>Cấu trúc: ${esc(x.pattern)}`:''}`}else if(item.type==='textbook'){const x=item.x;$('reviewType').textContent=`TỪ VỰNG SGK · ${x.unit}`;$('reviewPrompt').textContent=x.word;$('reviewExtra').textContent='Tự nói nghĩa + cách dùng trước khi mở đáp án.';$('reviewAnswer').innerHTML=`<b>${esc(x.meaning)}</b><br>${esc(x.pattern)}${x.family?`<br><br><b>Biến thể:</b> ${esc(x.family)}`:''}`}else if(item.type==='grammar'){const x=item.x;$('reviewType').textContent='CẤU TRÚC';$('reviewPrompt').textContent=x.title;$('reviewExtra').textContent='Tự điền công thức và một ví dụ trước khi xem.';$('reviewAnswer').innerHTML=`<div class="formula">${esc(x.formula||'')}</div>${x.example?`<div class="mt-2">${esc(x.example)}</div>`:''}`}else{const x=item.x;$('reviewType').textContent='CÂU SAI';$('reviewPrompt').textContent=x.question;$('reviewExtra').textContent='Tự sửa câu trước khi xem đáp án.';$('reviewAnswer').innerHTML=`<b>Đáp án:</b> ${esc(x.answer||'Chưa ghi')}<br><b>Quy tắc:</b> ${esc(x.rule||'Chưa ghi')}`}}
$('reveal').onclick=()=>{$('reviewAnswer').classList.remove('d-none');$('reveal').classList.add('d-none');$('reviewAgain').classList.remove('d-none');$('reviewKnown').classList.remove('d-none')};
$('reviewAgain').onclick=()=>{const x=reviewQueue.splice(reviewIndex,1)[0];reviewQueue.push(x);if(reviewIndex>=reviewQueue.length)reviewIndex=0;renderReviewCard()};$('reviewKnown').onclick=()=>{reviewQueue.splice(reviewIndex,1);if(reviewIndex>=reviewQueue.length)reviewIndex=0;renderReviewCard()};
// Seed practical examples only in local UI; they are not written to Firestore automatically.
$('vWord').addEventListener('blur',()=>{const w=$('vWord').value.trim().toLowerCase();const hints={start:{pattern:'start + to V / V-ing',note:'Cả hai dạng đều thường dùng được.'},need:{pattern:'need + to V / need + V-ing',passive:'need + V-ing = cần được làm',note:'So sánh với need to V = cần làm.'},go:{forms:'go — went — gone',passive:'be + gone không phải bị động của go',note:'V3 của go là gone.'},write:{forms:'write — wrote — written',note:'Bất quy tắc: V2 wrote, V3 written.'}};const h=hints[w];if(h){if(!$('vPattern').value)$('vPattern').value=h.pattern||'';if(!$('vForms').value)$('vForms').value=h.forms||'';if(!$('vPassive').value)$('vPassive').value=h.passive||'';if(!$('vNote').value)$('vNote').value=h.note||''}});
