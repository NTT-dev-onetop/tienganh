import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, auth } from "./firebase-services.js";
import { safeUrl } from "./security.js";
import { getCurrentRole, isStaffRole } from "./roles.js";
import { tr } from "./i18n.js";

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const isPublished = v => v === undefined || v === null || v === true || v === 1 || String(v).trim().toLowerCase() === 'true' || String(v).trim().toLowerCase() === 'published';
const showToast = (msg, type = 'info') => {
  if (typeof window.appToast === 'function') window.appToast(msg, type);
  else if (typeof window.toast === 'function') window.toast(msg, type);
  else if (typeof window.appAlert === 'function') window.appAlert(msg);
};
const askConfirm = (opts) => window.appConfirm ? window.appConfirm(opts) : Promise.resolve(false);
const isStaff = () => isStaffRole(getCurrentRole());

let stops = [];
const clear = () => { stops.forEach(f => f && f()); stops = []; };

let teacherVocabList = [];
let teacherListeningList = [];
let teacherQuestionList = [];

export function initTeacherContent() {
  clear();
  initVocab();
  initListening();
  initQuestions();
  bindGlobalTeacherButtons();
  const onLang = () => {
    renderTeacherListeningBoard(teacherListeningList);
    renderTeacherExercises(teacherQuestionList);
  };
  window.addEventListener('app:lang-change', onLang);
  stops.push(() => window.removeEventListener('app:lang-change', onLang));
}

export function stopTeacherContent() {
  clear();
}

// ===== HELPER: YOUTUBE EMBED =====
function parseYouTubeEmbed(urlOrId) {
  if (!urlOrId) return '';
  const str = String(urlOrId).trim();
  const match = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&/#]|$)/i);
  if (match && match[1] && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return `https://www.youtube.com/embed/${str}`;
  return '';
}

// =========================================================
// 1. TEACHER VOCABULARY MANAGEMENT (#textbook)
// =========================================================
function initVocab() {
  const q = query(collection(db, 'teacherVocab'));
  const stop = onSnapshot(q, snap => {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => String(a.unit || '').localeCompare(String(b.unit || '')) || String(a.word || '').localeCompare(String(b.word || ''), 'vi'));
    teacherVocabList = list;
    window.__teacherVocab = list;
    if (typeof window.__renderTextbook === 'function') {
      window.__renderTextbook();
    }
  }, e => console.error('Lỗi tải từ vựng giáo viên:', e));
  stops.push(stop);
}

function renderVocabForm(data = null) {
  const x = data || {};
  const isEdit = !!x.id;
  const units = ['Unit 1','Unit 2','Unit 3','Unit 4','Unit 5','Unit 6','Unit 7','Unit 8','Unit 9','Unit 10','Review 1','Review 2','Review 3','Review 4','Khác'];
  const posList = [
    { v: 'verb', l: tr('Verb (V) - Động từ', 'Verb (V)') },
    { v: 'noun', l: tr('Noun (N) - Danh từ', 'Noun (N)') },
    { v: 'adjective', l: tr('Adjective (Adj) - Tính từ', 'Adjective (Adj)') },
    { v: 'adverb', l: tr('Adverb (Adv) - Trạng từ', 'Adverb (Adv)') },
    { v: 'phrase', l: tr('Phrase / Idiom - Cụm từ', 'Phrase / Idiom') }
  ];

  return `
  <div class="teacher-form-card">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="mb-0 text-primary fs-5 fw-bold">👨‍🏫 ${isEdit ? tr('Chỉnh sửa từ vựng', 'Edit Vocabulary') : tr('Thêm từ vựng mới vào Unit', 'Add New Vocabulary to Unit')}</h3>
      <button type="button" class="btn-close" id="btnCloseVocabForm" aria-label="${tr('Đóng', 'Close')}"></button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label fw-bold">Unit *</label>
        <select id="tvUnit" class="form-select">${units.map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u === 'Khác' ? tr('Khác', 'Other') : u}</option>`).join('')}</select>
      </div>
      <div class="col-md-5">
        <label class="form-label fw-bold">${tr('Từ / Cụm từ *', 'Word / Phrase *')}</label>
        <input id="tvWord" class="form-control" placeholder="${tr('vd. sustainable development', 'e.g. sustainable development')}" value="${esc(x.word || '')}">
      </div>
      <div class="col-md-3">
        <label class="form-label fw-bold">${tr('Từ loại', 'Part of Speech')}</label>
        <select id="tvPos" class="form-select">${posList.map(p => `<option value="${p.v}" ${x.pos === p.v ? 'selected' : ''}>${p.l}</option>`).join('')}</select>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">${tr('Phát âm (Phonetics)', 'Phonetics')}</label>
        <input id="tvPron" class="form-control" placeholder="/səˈsteɪnəbl dɪˈveləpmənt/" value="${esc(x.pron || '')}">
      </div>
      <div class="col-md-8">
        <label class="form-label fw-bold">${tr('Nghĩa tiếng Việt *', 'Meaning *')}</label>
        <input id="tvMeaning" class="form-control" placeholder="${tr('sự phát triển bền vững', 'Vietnamese meaning / definition')}" value="${esc(x.meaning || '')}">
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">${tr('Cách dùng / Cụm đi kèm', 'Usage / Collocations')}</label>
        <textarea id="tvPattern" class="form-control" rows="2" placeholder="promote / achieve sustainable development">${esc(x.pattern || '')}</textarea>
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">${tr('Ví dụ minh họa', 'Example Sentence')}</label>
        <textarea id="tvExample" class="form-control" rows="2" placeholder="Countries are working toward sustainable development.">${esc(x.example || '')}</textarea>
      </div>
      <div class="col-12">
        <label class="form-label fw-bold">${tr('Ghi chú / Word Family', 'Notes / Word Family')}</label>
        <input id="tvNote" class="form-control" placeholder="sustain (v), sustainability (n)" value="${esc(x.note || x.family || '')}">
      </div>
    </div>
    <div class="d-flex gap-2 justify-content-end mt-4">
      <button type="button" id="btnCancelVocab" class="btn btn-outline-secondary">${tr('Hủy', 'Cancel')}</button>
      <button type="button" id="btnSaveVocab" class="btn btn-primary px-4">💾 ${isEdit ? tr('Lưu thay đổi', 'Save Changes') : tr('Thêm từ vựng', 'Add Vocabulary')}</button>
    </div>
  </div>`;
}

function openVocabModal(id = null) {
  const container = document.getElementById('teacherVocabFormContainer');
  if (!container) return;
  const item = id ? teacherVocabList.find(x => x.id === id) : null;
  container.innerHTML = renderVocabForm(item);
  container.classList.remove('d-none');
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const closeForm = () => { container.innerHTML = ''; container.classList.add('d-none'); };
  document.getElementById('btnCloseVocabForm')?.addEventListener('click', closeForm);
  document.getElementById('btnCancelVocab')?.addEventListener('click', closeForm);

  document.getElementById('btnSaveVocab')?.addEventListener('click', async () => {
    if (!isStaff()) return;
    const word = document.getElementById('tvWord')?.value.trim();
    const meaning = document.getElementById('tvMeaning')?.value.trim();
    const unit = document.getElementById('tvUnit')?.value;
    const pos = document.getElementById('tvPos')?.value;
    const pron = document.getElementById('tvPron')?.value.trim();
    const pattern = document.getElementById('tvPattern')?.value.trim();
    const example = document.getElementById('tvExample')?.value.trim();
    const note = document.getElementById('tvNote')?.value.trim();

    if (!word || !meaning) {
      showToast(tr('Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt.', 'Please enter both the English word and its meaning.'), 'error');
      return;
    }

    try {
      const payload = {
        word,
        meaning,
        unit,
        pos,
        pron,
        pattern,
        example,
        note,
        family: note,
        author: auth?.currentUser?.email || '',
        updatedAt: serverTimestamp()
      };
      if (id) {
        await updateDoc(doc(db, 'teacherVocab', id), payload);
        showToast(tr('Đã cập nhật từ vựng thành công!', 'Vocabulary updated successfully!'));
      } else {
        await setDoc(doc(collection(db, 'teacherVocab')), { ...payload, createdAt: serverTimestamp() });
        showToast(tr('Đã thêm từ vựng mới vào Unit!', 'Added new vocabulary item to Unit!'));
      }
      closeForm();
    } catch (err) {
      console.error('Save teacher vocab:', err);
      showToast(tr('Không thể lưu từ vựng. Vui lòng thử lại.', 'Could not save vocabulary item.'), 'error');
    }
  });
}

window.__editTeacherVocab = openVocabModal;
window.__deleteTeacherVocab = async (id) => {
  if (!isStaff()) return;
  const ok = await askConfirm({
    title: tr('Xóa từ vựng?', 'Delete vocabulary?'),
    message: tr('Bạn có chắc chắn muốn xóa từ vựng này khỏi Unit không?', 'Delete this vocabulary item from the unit?'),
    danger: true
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'teacherVocab', id));
    showToast(tr('Đã xóa từ vựng thành công.', 'Vocabulary item deleted.'));
  } catch (err) {
    console.error('Delete teacher vocab:', err);
    showToast(tr('Xóa từ vựng thất bại.', 'Could not delete vocabulary item.'), 'error');
  }
};


// =========================================================
// 2. TEACHER LISTENING MANAGEMENT (#listening)
// =========================================================
function initListening() {
  const root = document.getElementById('teacherListeningList');
  if (!root) return;
  const q = query(collection(db, 'listeningContent'));
  const stop = onSnapshot(q, snap => {
    const rows = [];
    snap.forEach(d => {
      const x = d.data() || {};
      if (isPublished(x.published) || isStaff()) {
        rows.push({ id: d.id, ...x });
      }
    });
    rows.sort((a, b) => String(a.unit || '').localeCompare(String(b.unit || '')));
    teacherListeningList = rows;
    renderTeacherListeningBoard(rows);
  }, e => {
    console.error(e);
    if (root) root.innerHTML = `<div class="alert alert-danger">${tr('Không tải được bài Listening giáo viên.', 'Could not load teacher listening tasks.')}</div>`;
  });
  stops.push(stop);
}

function renderTeacherListeningBoard(list) {
  const root = document.getElementById('teacherListeningList');
  if (!root) return;
  if (!list.length) {
    root.innerHTML = `<div class="muted py-3">${tr('Chưa có bài Listening giáo viên đăng.', 'No teacher listening tasks published yet.')}</div>`;
    return;
  }

  const staff = isStaff();

  root.innerHTML = list.map(item => {
    const isBlanks = (item.kind || 'blanks') === 'blanks';
    const isMcq = (item.kind || '') === 'mcq';
    const safeAudio = safeUrl(item.audioUrl);
    const ytEmbed = parseYouTubeEmbed(item.audioUrl);
    const safeSource = safeUrl(item.sourceUrl);
    const prompts = Array.isArray(item.prompts) ? item.prompts : [];
    const answers = Array.isArray(item.answers) ? item.answers : [];
    const displayUnit = item.unit === 'Chuyên đề' ? tr('Chuyên đề', 'Special Topic') : (item.unit || 'Unit');

    return `
    <article class="teacher-listening-item" data-tl-id="${esc(item.id)}">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <span class="tag fw-bold">${esc(displayUnit)}</span>
          <span class="tag ${item.published ? 'tag-published' : 'tag-draft'}">${item.published ? tr('Đã xuất bản', 'Published') : tr('Bản nháp', 'Draft')}</span>
          <span class="tag">🎧 ${isBlanks ? tr('Điền chỗ trống', 'Gap fill') : tr('Trắc nghiệm nghe', 'Listening MCQ')}</span>
        </div>
        ${staff ? `
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-tl-edit="${esc(item.id)}">✏️ ${tr('Sửa', 'Edit')}</button>
          <button class="btn btn-sm btn-outline-danger" data-tl-del="${esc(item.id)}">🗑 ${tr('Xóa', 'Delete')}</button>
        </div>` : ''}
      </div>

      <h3 class="h5 mt-2 mb-3 fw-bold">${esc(item.title || tr('Bài nghe', 'Listening task'))}</h3>

      <!-- AUDIO PLAYER / YOUTUBE -->
      ${ytEmbed ? `
      <div class="ratio ratio-16x9 mb-3" style="max-height: 380px;">
        <iframe src="${esc(ytEmbed)}" title="${esc(item.title)}" allowfullscreen class="rounded-3"></iframe>
      </div>` : safeAudio ? `
      <div class="mb-3">
        <audio controls preload="none" src="${esc(safeAudio)}" class="w-100"></audio>
      </div>` : ''}

      ${safeSource ? `<div class="mb-3"><a class="btn btn-sm btn-outline-secondary" href="${esc(safeSource)}" target="_blank" rel="noopener noreferrer">↗ ${tr('Mở nguồn / Bài viết tham khảo', 'Open source / reference')}</a></div>` : ''}

      <!-- INTERACTIVE EXERCISE -->
      <div class="teacher-listening-exercise p-3 bg-light rounded-3 mb-3">
        <div class="fw-bold mb-3">📝 ${tr('Nhiệm vụ nghe:', 'Listening task:')}</div>
        ${isBlanks ? `
        <div class="listening-blanks-container d-grid gap-3">
          ${prompts.map((p, i) => {
            const parts = p.split(/_{3,}|\[blank\]/i);
            return `
            <div class="listening-prompt-row">
              <b>${i + 1}.</b> 
              ${parts.length > 1 ? `
                ${esc(parts[0])}
                <input type="text" class="listening-blank-input" data-idx="${i}" placeholder="${tr('điền từ...', 'type answer...')}">
                ${esc(parts[1] || '')}
              ` : `
                ${esc(p)}
                <div class="mt-1"><input type="text" class="listening-blank-input w-100" data-idx="${i}" placeholder="${tr('Đáp án...', 'Answer...')}"></div>
              `}
              <span class="listening-feedback ms-2" id="fb-${esc(item.id)}-${i}"></span>
            </div>`;
          }).join('')}
        </div>` : isMcq ? `
        <div class="listening-mcq-container d-grid gap-3">
          ${prompts.map((p, i) => {
            const opts = Array.isArray(item.options?.[i]) ? item.options[i] : (item.options?.[i] ? String(item.options[i]).split('|').map(s => s.trim()) : []);
            return `
            <div class="listening-mcq-row">
              <p class="fw-bold mb-1">${i + 1}. ${esc(p)}</p>
              <div class="d-flex flex-column gap-1 ms-3">
                ${opts.map((opt, oi) => `
                  <label class="form-check-label d-flex align-items-center gap-2">
                    <input type="radio" class="form-check-input" name="lmcq-${esc(item.id)}-${i}" value="${oi}">
                    <span><b>${String.fromCharCode(65 + oi)}.</b> ${esc(opt)}</span>
                  </label>
                `).join('')}
              </div>
              <span class="listening-feedback ms-2" id="fb-${esc(item.id)}-${i}"></span>
            </div>`;
          }).join('')}
        </div>` : ''}

        <div class="d-flex align-items-center gap-3 flex-wrap mt-3 pt-2 border-top">
          <button class="btn btn-primary" data-tl-submit="${esc(item.id)}">🚀 ${tr('Nộp bài & Chấm điểm', 'Submit & Grade')}</button>
          <span id="score-${esc(item.id)}" class="fw-bold"></span>
          ${item.transcript ? `<button class="btn btn-outline-info btn-sm ms-auto" data-tl-toggle-trans="${esc(item.id)}">👁️ ${tr('Lời thoại (Transcript)', 'Transcript')}</button>` : ''}
        </div>

        ${item.transcript ? `
        <div id="trans-${esc(item.id)}" class="d-none mt-3 p-3 bg-white border rounded-3">
          <b class="text-primary">📜 Transcript:</b>
          <p class="mt-2 mb-0" style="white-space: pre-line;">${esc(item.transcript)}</p>
        </div>` : ''}
      </div>
    </article>`;
  }).join('');

  // Bind interactive checks
  root.querySelectorAll('[data-tl-submit]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.tlSubmit;
      const card = root.querySelector(`[data-tl-id="${CSS.escape(id)}"]`);
      if (!card) return;
      const item = list.find(x => x.id === id);
      if (!item) return;

      const isBlanks = (item.kind || 'blanks') === 'blanks';
      const isMcq = (item.kind || '') === 'mcq';
      const itemAnswers = Array.isArray(item.answers) ? item.answers : [];
      let score = 0;
      const total = item.prompts?.length || 0;

      if (isBlanks) {
        card.querySelectorAll('.listening-blank-input').forEach((input, idx) => {
          const blankIdx = Number(input.dataset.idx ?? idx);
          const rawExpected = String(itemAnswers[blankIdx] ?? '');
          const expected = rawExpected.trim().toLowerCase();
          const userVal = input.value.trim().toLowerCase();
          const fb = card.querySelector(`#fb-${CSS.escape(id)}-${blankIdx}`);
          if (userVal && userVal === expected) {
            input.classList.remove('wrong');
            input.classList.add('correct');
            if (fb) fb.innerHTML = `<span class="text-success fw-bold">✓ ${tr('Đúng', 'Correct')}</span>`;
            score++;
          } else {
            input.classList.remove('correct');
            input.classList.add('wrong');
            if (fb) fb.innerHTML = `<span class="text-danger fw-bold">× ${tr('Sai', 'Wrong')} (${tr('Đáp án', 'Answer')}: ${esc(rawExpected)})</span>`;
          }
        });
      } else if (isMcq) {
        (item.prompts || []).forEach((_, i) => {
          const checked = card.querySelector(`input[name="lmcq-${CSS.escape(id)}-${i}"]:checked`);
          const fb = card.querySelector(`#fb-${CSS.escape(id)}-${i}`);
          const expectedIdx = Number(itemAnswers[i] ?? 0);
          if (checked && Number(checked.value) === expectedIdx) {
            score++;
            if (fb) fb.innerHTML = `<span class="text-success fw-bold">✓ ${tr('Đúng', 'Correct')}</span>`;
          } else {
            const letter = String.fromCharCode(65 + expectedIdx);
            if (fb) fb.innerHTML = `<span class="text-danger fw-bold">× ${tr('Sai', 'Wrong')} (${tr('Đáp án', 'Answer')}: ${letter})</span>`;
          }
        });
      }

      const scoreEl = card.querySelector(`#score-${CSS.escape(id)}`);
      if (scoreEl) {
        scoreEl.innerHTML = `<span class="badge ${score === total ? 'bg-success' : 'bg-primary'} fs-6">${score}/${total} ${tr('điểm', 'pts')}</span>`;
      }
    };
  });

  // Bind transcript toggles
  root.querySelectorAll('[data-tl-toggle-trans]').forEach(btn => {
    btn.onclick = () => {
      const trans = root.querySelector(`#trans-${CSS.escape(btn.dataset.tlToggleTrans)}`);
      trans?.classList.toggle('d-none');
    };
  });

  // Bind teacher edit & delete
  if (staff) {
    root.querySelectorAll('[data-tl-edit]').forEach(btn => {
      btn.onclick = () => openListeningModal(btn.dataset.tlEdit);
    });
    root.querySelectorAll('[data-tl-del]').forEach(btn => {
      btn.onclick = async () => {
        const ok = await askConfirm({
          title: tr('Xóa bài Listening?', 'Delete listening task?'),
          message: tr('Bạn có chắc muốn xóa bài Listening này không?', 'Delete this listening task?'),
          danger: true
        });
        if (!ok) return;
        try {
          await deleteDoc(doc(db, 'listeningContent', btn.dataset.tlDel));
          showToast(tr('Đã xóa bài Listening.', 'Listening task deleted.'));
        } catch (e) {
          console.error('Delete teacher listening:', e);
          showToast(tr('Xóa bài Listening thất bại.', 'Could not delete listening task.'), 'error');
        }
      };
    });
  }
}

function renderListeningForm(data = null) {
  const x = data || {};
  const isEdit = !!x.id;
  const units = ['Unit 1','Unit 2','Unit 3','Unit 4','Unit 5','Unit 6','Unit 7','Unit 8','Unit 9','Unit 10','Review 1','Review 2','Review 3','Review 4','Chuyên đề'];
  const prompts = Array.isArray(x.prompts) ? x.prompts.join('\n') : '';
  const answers = Array.isArray(x.answers) ? x.answers.join('\n') : '';

  return `
  <div class="teacher-form-card">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="mb-0 text-primary fs-5 fw-bold">🎧 ${isEdit ? tr('Chỉnh sửa bài Listening', 'Edit Listening Task') : tr('Thêm bài Listening mới', 'Add New Listening Task')}</h3>
      <button type="button" class="btn-close" id="btnCloseListeningForm" aria-label="${tr('Đóng', 'Close')}"></button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label fw-bold">Unit *</label>
        <select id="tlUnit" class="form-select">${units.map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u === 'Chuyên đề' ? tr('Chuyên đề', 'Special Topic') : u}</option>`).join('')}</select>
      </div>
      <div class="col-md-8">
        <label class="form-label fw-bold">${tr('Tiêu đề bài nghe *', 'Listening Title *')}</label>
        <input id="tlTitle" class="form-control" placeholder="${tr('vd. ASEAN Culture & Youth Exchange', 'e.g. ASEAN Culture & Youth Exchange')}" value="${esc(x.title || '')}">
      </div>
      <div class="col-md-8">
        <label class="form-label fw-bold">${tr('Link Audio (MP3 direct URL) hoặc Link YouTube *', 'Audio URL (MP3) or YouTube Link *')}</label>
        <input id="tlAudio" class="form-control" placeholder="https://.../audio.mp3" value="${esc(x.audioUrl || '')}">
        <div class="form-text">${tr('Có thể dán link tệp âm thanh trực tiếp (.mp3, .wav, .m4a) hoặc link video YouTube.', 'Paste a direct audio URL (.mp3, .wav, .m4a) or a YouTube video link.')}</div>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">${tr('Dạng bài tập', 'Exercise Type')}</label>
        <select id="tlKind" class="form-select">
          <option value="blanks" ${(x.kind || 'blanks') === 'blanks' ? 'selected' : ''}>${tr('Điền chỗ trống (Gap fill)', 'Gap fill')}</option>
          <option value="mcq" ${x.kind === 'mcq' ? 'selected' : ''}>${tr('Trắc nghiệm nghe (MCQ)', 'Listening MCQ')}</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label fw-bold">${tr('Link nguồn / trang tham khảo (nếu có)', 'Reference URL (optional)')}</label>
        <input id="tlSource" class="form-control" placeholder="https://..." value="${esc(x.sourceUrl || '')}">
      </div>
      <div class="col-md-7">
        <label class="form-label fw-bold">${tr('Các câu hỏi hoặc câu cần điền * (Mỗi dòng một câu)', 'Prompts / Sentences * (One per line)')}</label>
        <textarea id="tlPrompts" class="form-control" rows="6" placeholder="${tr('Câu 1: The students will visit on the 5th of ________.\nCâu 2: They will spend ________ days in Viet Nam.', '1. The students will visit on the 5th of ________.\n2. They will spend ________ days in Viet Nam.')}">${esc(prompts)}</textarea>
        <div class="form-text">${tr('Dùng dấu <code>________</code> để biểu thị chỗ trống.', 'Use <code>________</code> to indicate a blank.')}</div>
      </div>
      <div class="col-md-5">
        <label class="form-label fw-bold">${tr('Đáp án tương ứng * (Mỗi dòng một đáp án)', 'Matching Answers * (One per line)')}</label>
        <textarea id="tlAnswers" class="form-control" rows="6" placeholder="May&#10;five">${esc(answers)}</textarea>
        <div class="form-text">${tr('Số dòng đáp án phải khớp với số dòng câu hỏi.', 'Answer line count must match prompt line count.')}</div>
      </div>
      <div class="col-12">
        <label class="form-label fw-bold">${tr('Lời thoại / Bài đọc Transcript (để học sinh đối chiếu sau khi nộp)', 'Transcript (shown for self-check after submission)')}</label>
        <textarea id="tlTranscript" class="form-control" rows="4" placeholder="${tr('Nội dung bài nghe transcript...', 'Full audio transcript...')}">${esc(x.transcript || '')}</textarea>
      </div>
      <div class="col-12">
        <div class="form-check form-switch">
          <input id="tlPublished" class="form-check-input" type="checkbox" ${x.published === false ? '' : 'checked'}>
          <label class="form-check-label fw-bold">${tr('Đã xuất bản (học sinh thấy và làm được ngay)', 'Published (visible to students immediately)')}</label>
        </div>
      </div>
    </div>
    <div class="d-flex gap-2 justify-content-end mt-4">
      <button type="button" id="btnCancelListening" class="btn btn-outline-secondary">${tr('Hủy', 'Cancel')}</button>
      <button type="button" id="btnSaveListening" class="btn btn-primary px-4">💾 ${isEdit ? tr('Lưu thay đổi', 'Save Changes') : tr('Đăng bài nghe', 'Publish Listening')}</button>
    </div>
  </div>`;
}

function openListeningModal(id = null) {
  const container = document.getElementById('teacherListeningFormContainer');
  if (!container) return;
  const item = id ? teacherListeningList.find(x => x.id === id) : null;
  container.innerHTML = renderListeningForm(item);
  container.classList.remove('d-none');
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const closeForm = () => { container.innerHTML = ''; container.classList.add('d-none'); };
  document.getElementById('btnCloseListeningForm')?.addEventListener('click', closeForm);
  document.getElementById('btnCancelListening')?.addEventListener('click', closeForm);

  document.getElementById('btnSaveListening')?.addEventListener('click', async () => {
    if (!isStaff()) return;
    const title = document.getElementById('tlTitle')?.value.trim();
    const unit = document.getElementById('tlUnit')?.value;
    const audioUrl = document.getElementById('tlAudio')?.value.trim();
    const sourceUrl = document.getElementById('tlSource')?.value.trim();
    const kind = document.getElementById('tlKind')?.value;
    const prompts = document.getElementById('tlPrompts')?.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const answers = document.getElementById('tlAnswers')?.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const transcript = document.getElementById('tlTranscript')?.value.trim();
    const published = document.getElementById('tlPublished')?.checked;

    if (!title) {
      showToast(tr('Vui lòng nhập tiêu đề bài nghe.', 'Please enter a listening title.'), 'error');
      return;
    }
    if (audioUrl && !safeUrl(audioUrl) && !parseYouTubeEmbed(audioUrl)) {
      showToast(tr('Link Audio / YouTube không hợp lệ (chỉ hỗ trợ https:// hoặc mã video YouTube).', 'Invalid Audio / YouTube link (only https:// or YouTube ID supported).'), 'error');
      return;
    }
    if (sourceUrl && !safeUrl(sourceUrl)) {
      showToast(tr('Link nguồn tham khảo không hợp lệ (phải là https://).', 'Invalid reference URL (must start with https://).'), 'error');
      return;
    }
    if (!prompts.length || !answers.length) {
      showToast(tr('Vui lòng nhập ít nhất 1 câu hỏi và 1 đáp án.', 'Please enter at least 1 prompt and 1 answer.'), 'error');
      return;
    }
    if (prompts.length !== answers.length) {
      showToast(tr(`Số câu hỏi (${prompts.length}) không khớp với số đáp án (${answers.length}).`, `Prompt count (${prompts.length}) does not match answer count (${answers.length}).`), 'error');
      return;
    }

    try {
      const payload = {
        title,
        unit,
        audioUrl,
        sourceUrl,
        kind,
        prompts,
        answers,
        transcript,
        published: !!published,
        author: auth?.currentUser?.email || '',
        updatedAt: serverTimestamp()
      };
      if (id) {
        await updateDoc(doc(db, 'listeningContent', id), payload);
        showToast(tr('Đã cập nhật bài Listening thành công!', 'Listening task updated!'));
      } else {
        await setDoc(doc(collection(db, 'listeningContent')), { ...payload, createdAt: serverTimestamp() });
        showToast(tr('Đã đăng bài Listening mới!', 'New listening task published!'));
      }
      closeForm();
    } catch (e) {
      console.error('Save teacher listening:', e);
      showToast(tr('Không thể lưu bài Listening. Vui lòng thử lại.', 'Could not save listening task.'), 'error');
    }
  });
}


// =========================================================
// 3. TEACHER EXERCISES & READING COMPREHENSION (#exercises)
// =========================================================
function initQuestions() {
  const root = document.getElementById('teacherQuestionList');
  if (!root) return;
  const q = query(collection(db, 'questionBank'));
  const stop = onSnapshot(q, snap => {
    const rows = [];
    snap.forEach(d => {
      const x = d.data() || {};
      if (isPublished(x.published) || isStaff()) {
        rows.push({ id: d.id, ...x });
      }
    });
    teacherQuestionList = rows;
    renderTeacherExercises(rows);
  }, e => {
    console.error(e);
    if (root) root.innerHTML = `<div class="alert alert-danger">${tr('Không tải được bài tập giáo viên.', 'Could not load teacher exercises.')}</div>`;
  });
  stops.push(stop);
}

function renderTeacherExercises(rows) {
  const root = document.getElementById('teacherQuestionList');
  if (!root) return;
  if (!rows.length) {
    root.innerHTML = `<div class="empty"><div>📝</div><h3>${tr('Chưa có bài tập giáo viên đăng', 'No teacher exercises published yet')}</h3></div>`;
    return;
  }

  const openSetIds = new Set([...root.querySelectorAll('.teacher-set-quiz:not(.d-none)')].map(el => el.id.replace(/^teacher-set-/, '')));
  const staff = isStaff();

  // Nhóm theo setId hoặc bài đọc reading
  const groups = new Map();
  rows.forEach(x => {
    const key = String(x.setId || 'set_' + (x.sourceFile || x.unit || x.id));
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        title: String(x.setTitle || x.sourceFile || x.unit || tr('Bài tập Unit', 'Unit Practice')),
        unit: String(x.unit || ''),
        kind: String(x.kind || 'mcq'),
        passage: String(x.passage || x.readingPassage || ''),
        items: []
      });
    }
    groups.get(key).items.push(x);
  });

  const sets = [...groups.values()].sort((a, b) => a.unit.localeCompare(b.unit) || a.title.localeCompare(b.title, 'vi'));

  root.innerHTML = sets.map(set => {
    const isReading = set.kind === 'reading' || !!set.passage;
    const isOpen = openSetIds.has(set.id);

    return `
    <article class="teacher-set-card" data-set="${esc(set.id)}">
      <div class="teacher-set-summary">
        <div>
          <div class="d-flex gap-2 flex-wrap align-items-center">
            <span class="tag fw-bold">${esc(set.unit)}</span>
            <span class="tag">${isReading ? tr('📖 Đọc hiểu (Reading)', '📖 Reading Comprehension') : tr('📝 Trắc nghiệm', '📝 Multiple Choice')}</span>
            <span class="tag">${set.items.length} ${tr('câu', 'Qs')}</span>
          </div>
          <h3 class="h5 mt-2 mb-1 fw-bold">${esc(set.title)}</h3>
          <p class="muted mb-0">${isReading ? tr('Bài đọc hiểu có đoạn văn & câu hỏi đi kèm.', 'Reading passage with comprehension questions.') : tr('Bài tập do giáo viên đăng · bấm để làm bài.', 'Teacher-assigned set · click to start.')}</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          ${staff ? `
            <button class="btn btn-sm btn-outline-primary" data-te-edit-set="${esc(set.id)}">✏️ ${tr('Sửa', 'Edit')}</button>
            <button class="btn btn-sm btn-outline-danger" data-te-del-set="${esc(set.id)}">🗑 ${tr('Xóa', 'Delete')}</button>
          ` : ''}
          <button class="btn btn-primary" data-start-set="${esc(set.id)}">▶ ${tr('Làm bài', 'Start')}</button>
        </div>
      </div>

      <div class="teacher-set-quiz ${isOpen ? '' : 'd-none'} p-3" id="teacher-set-${esc(set.id)}">
        <!-- ĐOẠN VĂN ĐỌC HIỂU NẾU LÀ READING -->
        ${set.passage ? `
        <div class="teacher-reading-passage">
          <div class="d-flex align-items-center gap-2 mb-2 text-primary fw-bold">
            <span>📖 ${tr('ĐOẠN VĂN BÀI ĐỌC:', 'READING PASSAGE:')}</span>
          </div>
          <div>${esc(set.passage)}</div>
        </div>` : ''}

        <div class="teacher-quiz-list">
          ${set.items.map((x, i) => {
            const opts = Array.isArray(x.options) ? x.options : [];
            const isTextForm = x.kind === 'form' || x.kind === 'rewrite';
            return `
            <article class="teacher-quiz-q" data-q-id="${esc(x.id)}">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small muted">${tr('Câu', 'Q')} ${i + 1}/${set.items.length}</span>
                ${staff ? `<button class="btn btn-link btn-sm text-danger p-0" data-te-del-q="${esc(x.id)}">${tr('Xóa câu này', 'Delete question')}</button>` : ''}
              </div>
              <h4 class="fs-6 fw-bold mt-1 mb-2">${esc(x.prompt || '')}</h4>

              ${isTextForm ? `
                <div class="mt-2">
                  <input type="text" class="form-control" name="textans-${esc(set.id)}-${i}" placeholder="${tr('Nhập đáp án...', 'Type answer...')}">
                </div>
              ` : `
                <div class="d-grid gap-1 mt-2">
                  ${opts.map((o, j) => `
                    <label class="teacher-quiz-option">
                      <input type="radio" name="ans-${esc(set.id)}-${i}" value="${j}">
                      <span><b>${String.fromCharCode(65 + j)}.</b> ${esc(o)}</span>
                    </label>
                  `).join('')}
                </div>
              `}
              <div class="quiz-item-feedback mt-2" id="qfb-${esc(set.id)}-${i}"></div>
            </article>`;
          }).join('')}
        </div>

        <div class="d-flex gap-2 flex-wrap align-items-center mt-3 pt-3 border-top">
          <button class="btn btn-success px-4" data-submit-set="${esc(set.id)}">🚀 ${tr('Nộp bài', 'Submit')}</button>
          <button class="btn btn-outline-secondary" data-close-set="${esc(set.id)}">${tr('Đóng', 'Close')}</button>
          <span class="teacher-quiz-result fw-bold ms-auto" id="result-${esc(set.id)}"></span>
        </div>
      </div>
    </article>`;
  }).join('');

  // Bind controls
  root.querySelectorAll('[data-start-set]').forEach(b => {
    b.onclick = () => document.getElementById(`teacher-set-${b.dataset.startSet}`)?.classList.remove('d-none');
  });
  root.querySelectorAll('[data-close-set]').forEach(b => {
    b.onclick = () => document.getElementById(`teacher-set-${b.dataset.closeSet}`)?.classList.add('d-none');
  });

  root.querySelectorAll('[data-submit-set]').forEach(b => {
    b.onclick = () => {
      const setId = b.dataset.submitSet;
      const set = groups.get(setId);
      if (!set) return;

      let score = 0;
      let answered = 0;

      set.items.forEach((x, i) => {
        const isTextForm = x.kind === 'form' || x.kind === 'rewrite';
        const fb = root.querySelector(`#qfb-${CSS.escape(setId)}-${i}`);

        if (isTextForm) {
          const textInput = root.querySelector(`input[name="textans-${CSS.escape(setId)}-${i}"]`);
          const userText = textInput?.value.trim().toLowerCase();
          const expected = String(x.answer || '').trim().toLowerCase();
          if (userText) {
            answered++;
            if (userText === expected) {
              score++;
              if (fb) fb.innerHTML = `<span class="text-success fw-bold">✓ ${tr('Chính xác', 'Correct')}</span>`;
            } else {
              if (fb) fb.innerHTML = `<span class="text-danger fw-bold">× ${tr('Sai', 'Wrong')} (${tr('Đáp án', 'Answer')}: ${esc(x.answer)})</span>`;
            }
          }
        } else {
          const checked = root.querySelector(`input[name="ans-${CSS.escape(setId)}-${i}"]:checked`);
          if (checked) {
            answered++;
            if (Number(checked.value) === Number(x.correctIndex)) {
              score++;
              if (fb) fb.innerHTML = `<span class="text-success fw-bold">✓ ${tr('Chính xác', 'Correct')}</span>`;
            } else {
              const letter = String.fromCharCode(65 + Number(x.correctIndex));
              if (fb) fb.innerHTML = `<span class="text-danger fw-bold">× ${tr('Sai', 'Wrong')} (${tr('Đáp án đúng', 'Correct answer')}: ${letter})</span>${x.explain ? `<div class="small text-muted mt-1">💡 ${esc(x.explain)}</div>` : ''}`;
            }
          }
        }
      });

      const resEl = root.querySelector(`#result-${CSS.escape(setId)}`);
      if (resEl) {
        resEl.innerHTML = `<span class="badge ${score === set.items.length ? 'bg-success' : 'bg-primary'} fs-6">${score}/${set.items.length} ${tr('điểm', 'pts')}</span> · ${tr(`đã làm ${answered}/${set.items.length} câu`, `answered ${answered}/${set.items.length}`)}`;
      }
    };
  });

  if (staff) {
    root.querySelectorAll('[data-te-del-q]').forEach(b => {
      b.onclick = async () => {
        const ok = await askConfirm({
          title: tr('Xóa câu hỏi?', 'Delete question?'),
          message: tr('Xóa câu hỏi này?', 'Delete this question?'),
          danger: true
        });
        if (!ok) return;
        try {
          await deleteDoc(doc(db, 'questionBank', b.dataset.teDelQ));
          showToast(tr('Đã xóa câu hỏi.', 'Question deleted.'));
        } catch (e) {
          console.error('Delete teacher question:', e);
          showToast(tr('Xóa câu hỏi thất bại.', 'Could not delete question.'), 'error');
        }
      };
    });

    root.querySelectorAll('[data-te-edit-set]').forEach(b => {
      b.onclick = () => {
        const setId = b.dataset.teEditSet;
        const set = groups.get(setId);
        if (set) openExerciseModal(set);
      };
    });

    root.querySelectorAll('[data-te-del-set]').forEach(b => {
      b.onclick = async () => {
        const setId = b.dataset.teDelSet;
        const set = groups.get(setId);
        const ok = await askConfirm({
          title: tr('Xóa bộ bài tập?', 'Delete exercise set?'),
          message: tr(`Bạn có chắc muốn xóa toàn bộ bộ bài tập "${set?.title}" (${set?.items.length} câu)?`, `Delete the entire exercise set "${set?.title}" (${set?.items.length} questions)?`),
          danger: true
        });
        if (!ok) return;
        try {
          await Promise.all(set.items.map(item => deleteDoc(doc(db, 'questionBank', item.id))));
          showToast(tr('Đã xóa bộ bài tập.', 'Exercise set deleted.'));
        } catch (e) {
          console.error('Delete teacher exercise set:', e);
          showToast(tr('Xóa bộ bài tập thất bại.', 'Could not delete exercise set.'), 'error');
        }
      };
    });
  }
}

function renderExerciseForm(data = null) {
  const x = data || {};
  const isEdit = !!x.id;
  const units = ['Unit 1','Unit 2','Unit 3','Unit 4','Unit 5','Unit 6','Unit 7','Unit 8','Unit 9','Unit 10','Review 1','Review 2','Review 3','Review 4'];
  const firstItem = x.items?.[0] || x;
  const currentKind = String(x.kind || firstItem.kind || (x.passage ? 'reading' : 'mcq'));
  const promptVal = firstItem.prompt || '';
  const optionsVal = Array.isArray(firstItem.options) ? firstItem.options.join('\n') : '';
  const correctVal = firstItem.correctIndex ?? 0;
  const answerVal = firstItem.answer || '';
  const explainVal = firstItem.explain || '';
  const passageVal = x.passage || firstItem.passage || '';
  const isReading = currentKind === 'reading' || !!passageVal;
  const isText = currentKind === 'form' || currentKind === 'rewrite';

  return `
  <div class="teacher-form-card">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="mb-0 text-primary fs-5 fw-bold">📝 ${isEdit ? tr('Chỉnh sửa bài tập', 'Edit Exercise') : tr('Thêm bài tập mới (Trắc nghiệm / Đọc hiểu / Điền từ)', 'Add New Exercise (MCQ / Reading / Fill-in)')}</h3>
      <button type="button" class="btn-close" id="btnCloseExerciseForm" aria-label="${tr('Đóng', 'Close')}"></button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label fw-bold">Unit *</label>
        <select id="teUnit" class="form-select">${units.map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">${tr('Dạng bài tập *', 'Exercise Type *')}</label>
        <select id="teKind" class="form-select">
          <option value="mcq" ${currentKind === 'mcq' ? 'selected' : ''}>${tr('Trắc nghiệm 4 lựa chọn (MCQ)', '4-Choice MCQ')}</option>
          <option value="reading" ${isReading ? 'selected' : ''}>${tr('📖 Đọc hiểu (Reading Comprehension)', '📖 Reading Comprehension')}</option>
          <option value="two" ${currentKind === 'two' ? 'selected' : ''}>${tr('Trắc nghiệm Đúng/Sai (2 lựa chọn)', 'True/False (2 choices)')}</option>
          <option value="form" ${currentKind === 'form' ? 'selected' : ''}>${tr('Điền dạng đúng của từ (Word form)', 'Word Form')}</option>
          <option value="rewrite" ${currentKind === 'rewrite' ? 'selected' : ''}>${tr('Viết lại câu (Sentence rewrite)', 'Sentence Rewrite')}</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">${tr('Tên bộ bài tập / Tiêu đề *', 'Exercise Set Title *')}</label>
        <input id="teTitle" class="form-control" placeholder="${tr('vd. Reading Practice - Eco Tourism', 'e.g. Reading Practice - Eco Tourism')}" value="${esc(x.title || '')}">
      </div>

      <!-- READING PASSAGE (NẾU LÀ ĐỌC HIỂU) -->
      <div class="col-12 ${isReading ? '' : 'd-none'}" id="teReadingBox">
        <label class="form-label fw-bold text-success">📖 ${tr('Đoạn văn bài đọc (Reading Passage) *', 'Reading Passage *')}</label>
        <textarea id="tePassage" class="form-control" rows="6" placeholder="${tr('Dán toàn bộ đoạn văn đọc hiểu vào đây...', 'Paste the reading passage here...')}">${esc(passageVal)}</textarea>
      </div>

      <!-- STANDARD MCQ FIELDS -->
      <div class="col-12" id="tePromptBox">
        <label class="form-label fw-bold" id="tePromptLabel">${tr('Câu hỏi *', 'Question Prompt *')}</label>
        <textarea id="tePrompt" class="form-control" rows="3" placeholder="${tr('Nhập câu hỏi...', 'Enter question prompt...')}">${esc(promptVal)}</textarea>
      </div>

      <div class="col-md-8" id="teOptionsBox" style="${isText ? 'display:none;' : ''}">
        <label class="form-label fw-bold">${tr('Các lựa chọn (Mỗi dòng một đáp án A, B, C, D)', 'Options (One per line: A, B, C, D)')}</label>
        <textarea id="teOptions" class="form-control" rows="4" placeholder="${tr('Đáp án A&#10;Đáp án B&#10;Đáp án C&#10;Đáp án D', 'Option A&#10;Option B&#10;Option C&#10;Option D')}">${esc(optionsVal)}</textarea>
      </div>

      <div class="col-md-4" id="teCorrectBox">
        <div id="teCorrectSelectWrap" style="${isText ? 'display:none;' : ''}">
          <label class="form-label fw-bold">${tr('Đáp án đúng', 'Correct Option')}</label>
          <select id="teCorrect" class="form-select">
            <option value="0" ${Number(correctVal) === 0 ? 'selected' : ''}>A</option>
            <option value="1" ${Number(correctVal) === 1 ? 'selected' : ''}>B</option>
            <option value="2" ${Number(correctVal) === 2 ? 'selected' : ''}>C</option>
            <option value="3" ${Number(correctVal) === 3 ? 'selected' : ''}>D</option>
          </select>
        </div>
        <div class="mt-2" id="teAnswerBox" style="${isText ? '' : 'display:none;'}">
          <label class="form-label fw-bold">${tr('Đáp án chữ mẫu', 'Sample Text Answer')}</label>
          <input id="teAnswer" class="form-control" placeholder="${tr('vd. was developed', 'e.g. was developed')}" value="${esc(answerVal)}">
        </div>
      </div>

      <div class="col-12">
        <label class="form-label fw-bold">${tr('Giải thích chi tiết (sau khi học sinh nộp bài)', 'Explanation (shown after submission)')}</label>
        <textarea id="teExplain" class="form-control" rows="2" placeholder="${tr('Giải thích vì sao chọn đáp án này...', 'Explain why this is correct...')}">${esc(explainVal)}</textarea>
      </div>

      <div class="col-12">
        <div class="form-check form-switch">
          <input id="tePublished" class="form-check-input" type="checkbox" ${x.published === false ? '' : 'checked'}>
          <label class="form-check-label fw-bold">${tr('Đã xuất bản (học sinh thấy và làm được ngay)', 'Published (visible to students immediately)')}</label>
        </div>
      </div>
    </div>

    <div class="d-flex gap-2 justify-content-end mt-4">
      <button type="button" id="btnCancelExercise" class="btn btn-outline-secondary">${tr('Hủy', 'Cancel')}</button>
      <button type="button" id="btnSaveExercise" class="btn btn-primary px-4">💾 ${isEdit ? tr('Lưu thay đổi', 'Save Changes') : tr('Đăng bài tập', 'Publish Exercise')}</button>
    </div>
  </div>`;
}

function openExerciseModal(editData = null) {
  const container = document.getElementById('teacherExerciseFormContainer');
  if (!container) return;
  container.innerHTML = renderExerciseForm(editData);
  container.classList.remove('d-none');
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const closeForm = () => { container.innerHTML = ''; container.classList.add('d-none'); };
  document.getElementById('btnCloseExerciseForm')?.addEventListener('click', closeForm);
  document.getElementById('btnCancelExercise')?.addEventListener('click', closeForm);

  const kindSelect = document.getElementById('teKind');
  const readingBox = document.getElementById('teReadingBox');
  const optionsBox = document.getElementById('teOptionsBox');
  const correctWrap = document.getElementById('teCorrectSelectWrap');
  const answerBox = document.getElementById('teAnswerBox');

  kindSelect?.addEventListener('change', () => {
    const k = kindSelect.value;
    if (k === 'reading') {
      readingBox?.classList.remove('d-none');
      if (optionsBox) optionsBox.style.display = 'block';
      if (correctWrap) correctWrap.style.display = 'block';
      if (answerBox) answerBox.style.display = 'none';
    } else if (k === 'form' || k === 'rewrite') {
      readingBox?.classList.add('d-none');
      if (optionsBox) optionsBox.style.display = 'none';
      if (correctWrap) correctWrap.style.display = 'none';
      if (answerBox) answerBox.style.display = 'block';
    } else if (k === 'two') {
      readingBox?.classList.add('d-none');
      if (optionsBox) optionsBox.style.display = 'block';
      if (correctWrap) correctWrap.style.display = 'block';
      if (answerBox) answerBox.style.display = 'none';
      const optEl = document.getElementById('teOptions');
      if (optEl && !optEl.value.trim()) optEl.value = 'True\nFalse';
    } else {
      readingBox?.classList.add('d-none');
      if (optionsBox) optionsBox.style.display = 'block';
      if (correctWrap) correctWrap.style.display = 'block';
      if (answerBox) answerBox.style.display = 'none';
    }
  });

  document.getElementById('btnSaveExercise')?.addEventListener('click', async () => {
    if (!isStaff()) return;
    const unit = document.getElementById('teUnit')?.value;
    const kind = document.getElementById('teKind')?.value;
    const title = document.getElementById('teTitle')?.value.trim();
    const prompt = document.getElementById('tePrompt')?.value.trim();
    const passage = document.getElementById('tePassage')?.value.trim();
    const options = document.getElementById('teOptions')?.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const correctIndex = Number(document.getElementById('teCorrect')?.value || 0);
    const answer = document.getElementById('teAnswer')?.value.trim();
    const explain = document.getElementById('teExplain')?.value.trim();
    const published = document.getElementById('tePublished')?.checked;

    if (!prompt) {
      showToast(tr('Vui lòng nhập câu hỏi.', 'Please enter a question prompt.'), 'error');
      return;
    }
    if (kind === 'reading' && !passage) {
      showToast(tr('Dạng bài đọc hiểu yêu cầu phải có đoạn văn (Reading passage).', 'Reading comprehension requires a reading passage.'), 'error');
      return;
    }
    if (kind === 'form' || kind === 'rewrite') {
      if (!answer) {
        showToast(tr('Vui lòng nhập đáp án chữ mẫu.', 'Please enter a sample text answer.'), 'error');
        return;
      }
    } else {
      const minOpts = kind === 'two' ? 2 : 2;
      if (options.length < minOpts) {
        showToast(tr(`Vui lòng nhập ít nhất ${minOpts} lựa chọn đáp án.`, `Please provide at least ${minOpts} options.`), 'error');
        return;
      }
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        showToast(tr(`Đáp án đúng (${String.fromCharCode(65 + (correctIndex || 0))}) vượt quá số lựa chọn hiện có (${options.length}).`, `Selected answer index exceeds the ${options.length} provided options.`), 'error');
        return;
      }
    }

    try {
      const setId = editData?.id || editData?.items?.[0]?.setId || ('set_' + Date.now());
      const editItemId = editData?.items?.[0]?.id || (editData?.id && !editData.id.startsWith('set_') ? editData.id : null);
      const payload = {
        unit,
        kind,
        prompt,
        options,
        correctIndex,
        answer,
        explain,
        passage: kind === 'reading' ? passage : '',
        setTitle: title || (kind === 'reading' ? `Reading - ${unit}` : tr(`Bài tập - ${unit}`, `Practice - ${unit}`)),
        setId,
        published: !!published,
        author: auth?.currentUser?.email || '',
        updatedAt: serverTimestamp()
      };

      if (editItemId) {
        await updateDoc(doc(db, 'questionBank', editItemId), payload);
        showToast(tr('Đã cập nhật bài tập thành công!', 'Exercise updated!'));
      } else {
        await setDoc(doc(collection(db, 'questionBank')), { ...payload, createdAt: serverTimestamp() });
        showToast(tr('Đã đăng bài tập thành công!', 'Exercise published!'));
      }
      closeForm();
    } catch (e) {
      console.error('Save teacher exercise:', e);
      showToast(tr('Không thể lưu bài tập. Vui lòng thử lại.', 'Could not save exercise.'), 'error');
    }
  });
}

// =========================================================
// 4. BIND GLOBAL BUTTONS
// =========================================================
let teacherButtonsBound = false;
function bindGlobalTeacherButtons() {
  if (teacherButtonsBound) return;
  teacherButtonsBound = true;

  document.getElementById('btnOpenAddVocab')?.addEventListener('click', () => {
    const box = document.getElementById('teacherVocabFormContainer');
    if (box && !box.classList.contains('d-none') && box.innerHTML) {
      box.classList.add('d-none');
    } else {
      openVocabModal();
    }
  });

  document.getElementById('btnOpenAddListening')?.addEventListener('click', () => {
    const box = document.getElementById('teacherListeningFormContainer');
    if (box && !box.classList.contains('d-none') && box.innerHTML) {
      box.classList.add('d-none');
    } else {
      openListeningModal();
    }
  });

  document.getElementById('btnOpenAddExercise')?.addEventListener('click', () => {
    const box = document.getElementById('teacherExerciseFormContainer');
    if (box && !box.classList.contains('d-none') && box.innerHTML) {
      box.classList.add('d-none');
    } else {
      openExerciseModal();
    }
  });
}
