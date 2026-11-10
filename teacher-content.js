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
  if (typeof window.toast === 'function') window.toast(msg, type);
  else alert(msg);
};
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
    { v: 'verb', l: 'Verb (V) - Động từ' },
    { v: 'noun', l: 'Noun (N) - Danh từ' },
    { v: 'adjective', l: 'Adjective (Adj) - Tính từ' },
    { v: 'adverb', l: 'Adverb (Adv) - Trạng từ' },
    { v: 'phrase', l: 'Phrase / Idiom - Cụm từ' }
  ];

  return `
  <div class="teacher-form-card">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="mb-0 text-primary">👨‍🏫 ${isEdit ? 'Chỉnh sửa từ vựng' : 'Thêm từ vựng mới vào Unit'}</h5>
      <button type="button" class="btn-close" id="btnCloseVocabForm" aria-label="Đóng"></button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label fw-bold">Unit *</label>
        <select id="tvUnit" class="form-select">${units.map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      <div class="col-md-5">
        <label class="form-label fw-bold">Từ / Cụm từ *</label>
        <input id="tvWord" class="form-control" placeholder="vd. sustainable development" value="${esc(x.word || '')}">
      </div>
      <div class="col-md-3">
        <label class="form-label fw-bold">Từ loại</label>
        <select id="tvPos" class="form-select">${posList.map(p => `<option value="${p.v}" ${x.pos === p.v ? 'selected' : ''}>${p.l}</option>`).join('')}</select>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">Phát âm (Phonetics)</label>
        <input id="tvPron" class="form-control" placeholder="/səˈsteɪnəbl dɪˈveləpmənt/" value="${esc(x.pron || '')}">
      </div>
      <div class="col-md-8">
        <label class="form-label fw-bold">Nghĩa tiếng Việt *</label>
        <input id="tvMeaning" class="form-control" placeholder="sự phát triển bền vững" value="${esc(x.meaning || '')}">
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">Cách dùng / Cụm đi kèm</label>
        <textarea id="tvPattern" class="form-control" rows="2" placeholder="promote / achieve sustainable development">${esc(x.pattern || '')}</textarea>
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">Ví dụ minh họa</label>
        <textarea id="tvExample" class="form-control" rows="2" placeholder="Countries are working toward sustainable development.">${esc(x.example || '')}</textarea>
      </div>
      <div class="col-12">
        <label class="form-label fw-bold">Ghi chú / Word Family</label>
        <input id="tvNote" class="form-control" placeholder="sustain (v), sustainability (n)" value="${esc(x.note || x.family || '')}">
      </div>
    </div>
    <div class="d-flex gap-2 justify-content-end mt-4">
      <button type="button" id="btnCancelVocab" class="btn btn-outline-secondary">Hủy</button>
      <button type="button" id="btnSaveVocab" class="btn btn-primary px-4">💾 ${isEdit ? 'Lưu thay đổi' : 'Thêm từ vựng'}</button>
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
      showToast('Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt.', 'error');
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
        showToast('Đã cập nhật từ vựng thành công!');
      } else {
        await setDoc(doc(collection(db, 'teacherVocab')), { ...payload, createdAt: serverTimestamp() });
        showToast('Đã thêm từ vựng mới vào Unit!');
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
  if (!confirm(tr('Bạn có chắc chắn muốn xóa từ vựng này khỏi Unit không?', 'Delete this vocabulary item from the unit?'))) return;
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
    if (root) root.innerHTML = '<div class="alert alert-danger">Không tải được bài Listening giáo viên.</div>';
  });
  stops.push(stop);
}

function renderTeacherListeningBoard(list) {
  const root = document.getElementById('teacherListeningList');
  if (!root) return;
  if (!list.length) {
    root.innerHTML = '<div class="muted py-3">Chưa có bài Listening giáo viên đăng.</div>';
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

    return `
    <article class="teacher-listening-item" data-tl-id="${esc(item.id)}">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <span class="tag fw-bold">${esc(item.unit || 'Unit')}</span>
          <span class="tag ${item.published ? 'tag-published' : 'tag-draft'}">${item.published ? tr('Đã xuất bản', 'Published') : tr('Bản nháp', 'Draft')}</span>
          <span class="tag">🎧 ${isBlanks ? tr('Điền chỗ trống', 'Gap fill') : tr('Trắc nghiệm nghe', 'Listening MCQ')}</span>
        </div>
        ${staff ? `
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-tl-edit="${esc(item.id)}">✏️ ${tr('Sửa', 'Edit')}</button>
          <button class="btn btn-sm btn-outline-danger" data-tl-del="${esc(item.id)}">🗑 ${tr('Xóa', 'Delete')}</button>
        </div>` : ''}
      </div>

      <h4 class="mt-2 mb-3">${esc(item.title || tr('Bài nghe', 'Listening task'))}</h4>

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
        <h6 class="fw-bold mb-3">📝 ${tr('Nhiệm vụ nghe:', 'Listening task:')}</h6>
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
        if (!confirm(tr('Bạn có chắc muốn xóa bài Listening này không?', 'Delete this listening task?'))) return;
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
      <h5 class="mb-0 text-primary">🎧 ${isEdit ? 'Chỉnh sửa bài Listening' : 'Thêm bài Listening mới'}</h5>
      <button type="button" class="btn-close" id="btnCloseListeningForm" aria-label="Đóng"></button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label fw-bold">Unit *</label>
        <select id="tlUnit" class="form-select">${units.map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      <div class="col-md-8">
        <label class="form-label fw-bold">Tiêu đề bài nghe *</label>
        <input id="tlTitle" class="form-control" placeholder="vd. ASEAN Culture & Youth Exchange" value="${esc(x.title || '')}">
      </div>
      <div class="col-md-8">
        <label class="form-label fw-bold">Link Audio (MP3 direct URL) hoặc Link YouTube *</label>
        <input id="tlAudio" class="form-control" placeholder="vd. https://.../audio.mp3 hoặc https://www.youtube.com/watch?v=..." value="${esc(x.audioUrl || '')}">
        <div class="form-text">Có thể dán link tệp âm thanh trực tiếp (.mp3, .wav, .m4a) hoặc link video YouTube.</div>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">Dạng bài tập</label>
        <select id="tlKind" class="form-select">
          <option value="blanks" ${(x.kind || 'blanks') === 'blanks' ? 'selected' : ''}>Điền chỗ trống (Gap fill)</option>
          <option value="mcq" ${x.kind === 'mcq' ? 'selected' : ''}>Trắc nghiệm nghe (MCQ)</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label fw-bold">Link nguồn / trang tham khảo (nếu có)</label>
        <input id="tlSource" class="form-control" placeholder="https://..." value="${esc(x.sourceUrl || '')}">
      </div>
      <div class="col-md-7">
        <label class="form-label fw-bold">Các câu hỏi hoặc câu cần điền * (Mỗi dòng một câu)</label>
        <textarea id="tlPrompts" class="form-control" rows="6" placeholder="Câu 1: The students will visit on the 5th of ________.\nCâu 2: They will spend ________ days in Viet Nam.">${esc(prompts)}</textarea>
        <div class="form-text">Dùng dấu <code>________</code> để biểu thị chỗ trống.</div>
      </div>
      <div class="col-md-5">
        <label class="form-label fw-bold">Đáp án tương ứng * (Mỗi dòng một đáp án)</label>
        <textarea id="tlAnswers" class="form-control" rows="6" placeholder="May\nfive">${esc(answers)}</textarea>
        <div class="form-text">Số dòng đáp án phải khớp với số dòng câu hỏi.</div>
      </div>
      <div class="col-12">
        <label class="form-label fw-bold">Lời thoại / Bài đọc Transcript (để học sinh đối chiếu sau khi nộp)</label>
        <textarea id="tlTranscript" class="form-control" rows="4" placeholder="Nội dung bài nghe transcript...">${esc(x.transcript || '')}</textarea>
      </div>
      <div class="col-12">
        <div class="form-check form-switch">
          <input id="tlPublished" class="form-check-input" type="checkbox" ${x.published === false ? '' : 'checked'}>
          <label class="form-check-label fw-bold">Đã xuất bản (học sinh thấy và làm được ngay)</label>
        </div>
      </div>
    </div>
    <div class="d-flex gap-2 justify-content-end mt-4">
      <button type="button" id="btnCancelListening" class="btn btn-outline-secondary">Hủy</button>
      <button type="button" id="btnSaveListening" class="btn btn-primary px-4">💾 ${isEdit ? 'Lưu thay đổi' : 'Đăng bài nghe'}</button>
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
    if (root) root.innerHTML = '<div class="alert alert-danger">Không tải được bài tập giáo viên.</div>';
  });
  stops.push(stop);
}

function renderTeacherExercises(rows) {
  const root = document.getElementById('teacherQuestionList');
  if (!root) return;
  if (!rows.length) {
    root.innerHTML = '<div class="empty"><div>📝</div><h4>Chưa có bài tập giáo viên đăng</h4></div>';
    return;
  }

  const staff = isStaff();

  // Nhóm theo setId hoặc bài đọc reading
  const groups = new Map();
  rows.forEach(x => {
    const key = String(x.setId || 'set_' + (x.sourceFile || x.unit || x.id));
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        title: String(x.setTitle || x.sourceFile || x.unit || 'Bài tập Unit'),
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

    return `
    <article class="teacher-set-card" data-set="${esc(set.id)}">
      <div class="teacher-set-summary">
        <div>
          <div class="d-flex gap-2 flex-wrap align-items-center">
            <span class="tag fw-bold">${esc(set.unit)}</span>
            <span class="tag">${isReading ? '📖 Đọc hiểu (Reading)' : '📝 Trắc nghiệm'}</span>
            <span class="tag">${set.items.length} câu</span>
          </div>
          <h4>${esc(set.title)}</h4>
          <p class="muted mb-0">${isReading ? 'Bài đọc hiểu có đoạn văn & câu hỏi đi kèm.' : 'Bài tập do giáo viên đăng · bấm để làm bài.'}</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          ${staff ? `
            <button class="btn btn-sm btn-outline-primary" data-te-edit-set="${esc(set.id)}">✏️ Sửa</button>
            <button class="btn btn-sm btn-outline-danger" data-te-del-set="${esc(set.id)}">🗑 Xóa</button>
          ` : ''}
          <button class="btn btn-primary" data-start-set="${esc(set.id)}">▶ Làm bài</button>
        </div>
      </div>

      <div class="teacher-set-quiz d-none p-3" id="teacher-set-${esc(set.id)}">
        <!-- ĐOẠN VĂN ĐỌC HIỂU NẾU LÀ READING -->
        ${set.passage ? `
        <div class="teacher-reading-passage">
          <div class="d-flex align-items-center gap-2 mb-2 text-primary fw-bold">
            <span>📖 ĐOẠN VĂN BÀI ĐỌC:</span>
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
                <span class="small muted">Câu ${i + 1}/${set.items.length}</span>
                ${staff ? `<button class="btn btn-link btn-sm text-danger p-0" data-te-del-q="${esc(x.id)}">Xóa câu này</button>` : ''}
              </div>
              <h5>${esc(x.prompt || '')}</h5>

              ${isTextForm ? `
                <div class="mt-2">
                  <input type="text" class="form-control" name="textans-${esc(set.id)}-${i}" placeholder="Nhập đáp án...">
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
          <button class="btn btn-success px-4" data-submit-set="${esc(set.id)}">🚀 Nộp bài</button>
          <button class="btn btn-outline-secondary" data-close-set="${esc(set.id)}">Đóng</button>
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
              if (fb) fb.innerHTML = '<span class="text-success fw-bold">✓ Chính xác</span>';
            } else {
              if (fb) fb.innerHTML = `<span class="text-danger fw-bold">× Sai (Đáp án: ${esc(x.answer)})</span>`;
            }
          }
        } else {
          const checked = root.querySelector(`input[name="ans-${CSS.escape(setId)}-${i}"]:checked`);
          if (checked) {
            answered++;
            if (Number(checked.value) === Number(x.correctIndex)) {
              score++;
              if (fb) fb.innerHTML = '<span class="text-success fw-bold">✓ Chính xác</span>';
            } else {
              const letter = String.fromCharCode(65 + Number(x.correctIndex));
              if (fb) fb.innerHTML = `<span class="text-danger fw-bold">× Sai (Đáp án đúng: ${letter})</span>${x.explain ? `<div class="small text-muted mt-1">💡 ${esc(x.explain)}</div>` : ''}`;
            }
          }
        }
      });

      const resEl = root.querySelector(`#result-${CSS.escape(setId)}`);
      if (resEl) {
        resEl.innerHTML = `<span class="badge ${score === set.items.length ? 'bg-success' : 'bg-primary'} fs-6">${score}/${set.items.length} điểm</span> · đã làm ${answered}/${set.items.length} câu`;
      }
    };
  });

  if (staff) {
    root.querySelectorAll('[data-te-del-q]').forEach(b => {
      b.onclick = async () => {
        if (!confirm(tr('Xóa câu hỏi này?', 'Delete this question?'))) return;
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
        if (!confirm(tr(`Bạn có chắc muốn xóa toàn bộ bộ bài tập "${set?.title}" (${set?.items.length} câu)?`, `Delete the entire exercise set "${set?.title}" (${set?.items.length} questions)?`))) return;
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
      <h5 class="mb-0 text-primary">📝 ${isEdit ? 'Chỉnh sửa bài tập' : 'Thêm bài tập mới (Trắc nghiệm / Đọc hiểu / Điền từ)'}</h5>
      <button type="button" class="btn-close" id="btnCloseExerciseForm" aria-label="Đóng"></button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label fw-bold">Unit *</label>
        <select id="teUnit" class="form-select">${units.map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">Dạng bài tập *</label>
        <select id="teKind" class="form-select">
          <option value="mcq" ${currentKind === 'mcq' ? 'selected' : ''}>Trắc nghiệm 4 lựa chọn (MCQ)</option>
          <option value="reading" ${isReading ? 'selected' : ''}>📖 Đọc hiểu (Reading Comprehension)</option>
          <option value="two" ${currentKind === 'two' ? 'selected' : ''}>Trắc nghiệm Đúng/Sai (2 lựa chọn)</option>
          <option value="form" ${currentKind === 'form' ? 'selected' : ''}>Điền dạng đúng của từ (Word form)</option>
          <option value="rewrite" ${currentKind === 'rewrite' ? 'selected' : ''}>Viết lại câu (Sentence rewrite)</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label fw-bold">Tên bộ bài tập / Tiêu đề *</label>
        <input id="teTitle" class="form-control" placeholder="vd. Reading Practice - Eco Tourism" value="${esc(x.title || '')}">
      </div>

      <!-- READING PASSAGE (NẾU LÀ ĐỌC HIỂU) -->
      <div class="col-12 ${isReading ? '' : 'd-none'}" id="teReadingBox">
        <label class="form-label fw-bold text-success">📖 Đoạn văn bài đọc (Reading Passage) *</label>
        <textarea id="tePassage" class="form-control" rows="6" placeholder="Dán toàn bộ đoạn văn đọc hiểu vào đây...">${esc(passageVal)}</textarea>
      </div>

      <!-- STANDARD MCQ FIELDS -->
      <div class="col-12" id="tePromptBox">
        <label class="form-label fw-bold" id="tePromptLabel">Câu hỏi *</label>
        <textarea id="tePrompt" class="form-control" rows="3" placeholder="Nhập câu hỏi...">${esc(promptVal)}</textarea>
      </div>

      <div class="col-md-8" id="teOptionsBox" style="${isText ? 'display:none;' : ''}">
        <label class="form-label fw-bold">Các lựa chọn (Mỗi dòng một đáp án A, B, C, D)</label>
        <textarea id="teOptions" class="form-control" rows="4" placeholder="Đáp án A\nĐáp án B\nĐáp án C\nĐáp án D">${esc(optionsVal)}</textarea>
      </div>

      <div class="col-md-4" id="teCorrectBox">
        <div id="teCorrectSelectWrap" style="${isText ? 'display:none;' : ''}">
          <label class="form-label fw-bold">Đáp án đúng</label>
          <select id="teCorrect" class="form-select">
            <option value="0" ${Number(correctVal) === 0 ? 'selected' : ''}>A</option>
            <option value="1" ${Number(correctVal) === 1 ? 'selected' : ''}>B</option>
            <option value="2" ${Number(correctVal) === 2 ? 'selected' : ''}>C</option>
            <option value="3" ${Number(correctVal) === 3 ? 'selected' : ''}>D</option>
          </select>
        </div>
        <div class="mt-2" id="teAnswerBox" style="${isText ? '' : 'display:none;'}">
          <label class="form-label fw-bold">Đáp án chữ mẫu</label>
          <input id="teAnswer" class="form-control" placeholder="vd. was developed" value="${esc(answerVal)}">
        </div>
      </div>

      <div class="col-12">
        <label class="form-label fw-bold">Giải thích chi tiết (sau khi học sinh nộp bài)</label>
        <textarea id="teExplain" class="form-control" rows="2" placeholder="Giải thích vì sao chọn đáp án này...">${esc(explainVal)}</textarea>
      </div>

      <div class="col-12">
        <div class="form-check form-switch">
          <input id="tePublished" class="form-check-input" type="checkbox" ${x.published === false ? '' : 'checked'}>
          <label class="form-check-label fw-bold">Đã xuất bản (học sinh thấy và làm được ngay)</label>
        </div>
      </div>
    </div>

    <div class="d-flex gap-2 justify-content-end mt-4">
      <button type="button" id="btnCancelExercise" class="btn btn-outline-secondary">Hủy</button>
      <button type="button" id="btnSaveExercise" class="btn btn-primary px-4">💾 ${isEdit ? 'Lưu thay đổi' : 'Đăng bài tập'}</button>
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
        setTitle: title || (kind === 'reading' ? `Reading - ${unit}` : `Bài tập - ${unit}`),
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
