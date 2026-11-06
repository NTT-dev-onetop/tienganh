import { doc, getDoc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-services.js";
import { OWNER_EMAIL } from "./roles.js";

const escLocal = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

export const DEFAULT_ROSTER_11T1 = [
  'Trần Diễm Linh Giang', 'Võ Hồ Minh Hằng', 'Nguyễn Anh Khôi', 'Huỳnh Nguyễn Ly Lam', 'Nguyễn Thị Ngọc Mỹ',
  'Lê Bảo Ngọc', 'Phạm Minh Triết', 'Phan Trần Huỳnh Hương', 'Võ Mai Khánh', 'Nguyễn Trần Thùy Ngân',
  'Nguyễn Thanh Sang', 'Phạm Nhật Trường', 'Nguyễn Dương Gia Nghi', 'Nguyễn Phúc Thịnh', 'Lê Nguyễn Trung Trực',
  'Nguyễn Ngọc Bích Anh', 'Nguyễn Thùy Anh', 'Lê Ngọc Quốc Bảo', 'Huỳnh Lê Minh Đạt', 'Lê Minh Đạt',
  'Lê Ngọc Bảo Hân', 'Trương Thị Kim Hân', 'Trần Huy Hoàng', 'Nguyễn Tuấn Huy', 'Nguyễn Đăng Khoa',
  'Lê Nguyễn Hoàng Nam', 'Nguyễn Khánh Ngọc', 'Nguyễn Lê Hồng Ngọc', 'Nguyễn Vũ Bảo Ngọc', 'Bùi Ngọc An Nhi',
  'Dương Ngọc Tâm Như', 'Nguyễn Tấn Phát', 'Trần Minh Phi', 'Nguyễn Ngọc Bích Phương', 'Phạm Hà Mai Quỳnh',
  'Nguyễn Bùi Phúc Trí', 'Lê Nhã Thanh', 'Nguyễn Khánh Thi', 'Phạm Hoàng Thiên', 'Trần Thiện Tín',
  'Phạm Ngọc Bảo Trân', 'Vĩnh Huỳnh Diễm Trinh', 'Lê Quốc Trọng', 'Võ Hoàng Trọng', 'Nguyễn Trung Trực'
];

export const DEFAULT_ROSTER_11_1 = [
  'Bùi Minh Anh', 'Đỗ Gia Bảo', 'Đặng Thùy Dung', 'Hoàng Minh Đức', 'Lê Khánh Hà',
  'Nguyễn Quốc Huy', 'Phan Bảo Nam', 'Trần Quỳnh Nga', 'Vũ Thái Sơn', 'Lê Thảo Vy'
];

let modalEl = null;
let rosterCache = null, rosterCacheAt = 0;
const ROSTER_TTL = 60_000;

export function removeDiacritics(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (!parts.length) return 'HS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function readRoster(force = false) {
  const now = Date.now();
  if (!force && rosterCache && now - rosterCacheAt < ROSTER_TTL) return rosterCache;
  const snap = await getDoc(doc(db, 'config', 'roster'));
  const rosterData = {
    '11T1': [],
    '11.1': []
  };

  if (!snap.exists()) {
    rosterData['11T1'] = DEFAULT_ROSTER_11T1.map((name, i) => ({
      id: `11T1_s${String(i + 1).padStart(2, '0')}`,
      legacyId: `s${String(i + 1).padStart(2, '0')}`,
      name,
      className: '11T1',
      stt: i + 1
    }));
    rosterData['11.1'] = DEFAULT_ROSTER_11_1.map((name, i) => ({
      id: `11.1_s${String(i + 1).padStart(2, '0')}`,
      name,
      className: '11.1',
      stt: i + 1
    }));
  } else {
    const data = snap.data() || {};
    const raw11T1 = Array.isArray(data.students_11T1) && data.students_11T1.length
      ? data.students_11T1
      : (Array.isArray(data.students) && data.students.length ? data.students : null);

    if (!raw11T1) {
      rosterData['11T1'] = DEFAULT_ROSTER_11T1.map((name, i) => ({
        id: `11T1_s${String(i + 1).padStart(2, '0')}`,
        legacyId: `s${String(i + 1).padStart(2, '0')}`,
        name,
        className: '11T1',
        stt: i + 1
      }));
    } else {
      rosterData['11T1'] = raw11T1.map((x, i) => {
        const rawId = String(x?.id || `s${String(i + 1).padStart(2, '0')}`);
        const id = rawId.startsWith('11T1_') ? rawId : `11T1_${rawId}`;
        const legacyId = rawId.startsWith('11T1_') ? rawId.replace('11T1_', '') : rawId;
        return {
          id,
          legacyId,
          name: String(x?.name || '').trim(),
          className: '11T1',
          stt: i + 1
        };
      }).filter(x => x.name);
    }

    const raw11_1 = Array.isArray(data.students_11_1) && data.students_11_1.length ? data.students_11_1 : null;
    if (!raw11_1) {
      rosterData['11.1'] = DEFAULT_ROSTER_11_1.map((name, i) => ({
        id: `11.1_s${String(i + 1).padStart(2, '0')}`,
        name,
        className: '11.1',
        stt: i + 1
      }));
    } else {
      rosterData['11.1'] = raw11_1.map((x, i) => {
        const rawId = String(x?.id || `s${String(i + 1).padStart(2, '0')}`);
        const id = rawId.startsWith('11.1_') ? rawId : `11.1_${rawId}`;
        return {
          id,
          name: String(x?.name || '').trim(),
          className: '11.1',
          stt: i + 1
        };
      }).filter(x => x.name);
    }
  }

  rosterCache = rosterData;
  rosterCacheAt = now;
  return rosterData;
}

export function invalidateRosterCache() {
  rosterCache = null;
  rosterCacheAt = 0;
}

function buildModalDOM() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'rosterModal';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.setAttribute('data-bs-backdrop', 'static');
  modalEl.setAttribute('data-bs-keyboard', 'false');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered roster-modal-dialog">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header border-0 pb-0">
          <div>
            <div class="roster-header-pill">Bước 1 / 1 · Xác thực học sinh</div>
            <h5 class="modal-title fw-bold">Chọn danh tính của bạn</h5>
            <p class="text-muted small mb-0">Liên kết tài khoản Google với danh sách lớp để lưu điểm & streak.</p>
          </div>
        </div>
        <div class="modal-body pt-3">
          <!-- VIEW 1: SELECTION VIEW -->
          <div id="rosterSelectionView">
            <!-- Segmented Class Switcher -->
            <div class="roster-class-switch d-flex gap-1 p-1 mb-3">
              <button type="button" class="btn roster-class-btn active flex-fill" data-class="11T1" id="rosterTab11T1">
                🏫 Lớp 11T1 <span class="badge bg-primary ms-1" id="badgeCount11T1">45</span>
              </button>
              <button type="button" class="btn roster-class-btn flex-fill" data-class="11.1" id="rosterTab11_1">
                🏫 Lớp 11.1 <span class="badge bg-secondary ms-1" id="badgeCount11_1">10</span>
              </button>
            </div>

            <!-- Instant Search Bar -->
            <div class="roster-search-wrapper mb-2">
              <span class="roster-search-icon" aria-hidden="true">🔍</span>
              <input type="text" id="rosterSearchInput" class="form-control roster-search-input" placeholder="Gõ tên hoặc số thứ tự (vd: Trực, 45)..." autocomplete="off" spellcheck="false">
              <button type="button" id="rosterSearchClear" class="roster-search-clear d-none" title="Xóa tìm kiếm">✕</button>
            </div>

            <!-- Filter Status & Stats -->
            <div class="d-flex justify-content-between align-items-center mb-2 px-1">
              <small class="text-muted" id="rosterStatsCount">Đang tải...</small>
              <small class="text-muted"><span class="status-dot available"></span> Chưa chọn · <span class="status-dot claimed"></span> Đã kích hoạt</small>
            </div>

            <!-- Scrollable Student Card List -->
            <div class="roster-student-list" id="rosterStudentList" role="listbox" aria-label="Danh sách học sinh"></div>

            <!-- Error Banner -->
            <div id="rosterErr" class="alert alert-danger d-none mt-3 mb-0 py-2 small"></div>

            <!-- Selected Student Banner -->
            <div id="rosterSelectedBanner" class="roster-selected-banner d-none mt-3">
              <div class="d-flex align-items-center justify-content-between">
                <div>
                  <div class="small text-muted">Bạn đang chọn:</div>
                  <strong id="rosterSelectedName" class="text-primary">—</strong>
                </div>
                <span class="badge bg-primary" id="rosterSelectedClassBadge">11T1</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="mt-3">
              <button id="rosterProceedBtn" class="btn btn-primary w-100 py-2 fw-bold" disabled>Tiếp tục với tên này →</button>
            </div>
          </div>

          <!-- VIEW 2: CONFIRMATION VIEW -->
          <div id="rosterConfirmView" class="roster-confirm-view d-none">
            <div class="confirm-card p-3 rounded-4 border text-center mb-3">
              <div class="confirm-avatar mb-2" id="confirmAvatar">HS</div>
              <h4 class="mb-1 fw-bold" id="confirmStudentName">—</h4>
              <div class="d-flex justify-content-center gap-2 mb-3">
                <span class="badge bg-primary fs-6 px-3 py-1" id="confirmClassBadge">Lớp 11T1</span>
                <span class="badge bg-dark-subtle text-dark fs-6 px-3 py-1" id="confirmSttBadge">STT #01</span>
              </div>
              <div class="confirm-email-box p-2 rounded-3 small mb-3">
                Email Google liên kết: <b id="confirmGoogleEmail">—</b>
              </div>
              <div class="alert alert-warning text-start small mb-0 py-2">
                <strong>⚠️ Lưu ý quan trọng:</strong> Mỗi tài khoản chỉ được liên kết <b>1 lần duy nhất</b> với danh sách lớp. Bạn không thể tự đổi lại tên nếu chọn sai.
              </div>
            </div>
            <div id="confirmErr" class="alert alert-danger d-none mb-3 py-2 small"></div>
            <div class="d-flex gap-2">
              <button type="button" id="confirmBackBtn" class="btn btn-outline-secondary flex-fill py-2">← Chọn lại</button>
              <button type="button" id="confirmSaveBtn" class="btn btn-primary flex-fill py-2 fw-bold">✓ Xác nhận & Bắt đầu</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  return modalEl;
}

export async function initRosterGate(user, role, existingProfile = null) {
  if (!user || !user.uid) return true;
  try {
    let profile = existingProfile;
    if (!profile) {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) throw new Error('Không tìm thấy hồ sơ người dùng.');
      profile = userSnap.data() || {};
    }

    const cleanUserEmail = String(user.email || '').trim().toLowerCase();
    const ownerEmail = String(OWNER_EMAIL).trim().toLowerCase();

    // Owner Auto-Bypass & Permanent Alignment
    if (cleanUserEmail === ownerEmail) {
      const mappingRef = doc(db, 'users_by_roster', '11T1_s45');
      const legacyRef = doc(db, 'users_by_roster', 's45');
      const mapping = await getDoc(mappingRef);
      if (!mapping.exists() || mapping.data()?.uid === user.uid) {
        await setDoc(mappingRef, { uid: user.uid, email: ownerEmail, name: 'Nguyễn Trung Trực', rosterId: '11T1_s45', className: '11T1' }, { merge: true });
        await setDoc(legacyRef, { uid: user.uid, email: ownerEmail, name: 'Nguyễn Trung Trực', rosterId: 's45', className: '11T1' }, { merge: true });
        await setDoc(doc(db, 'users', user.uid), { rosterId: '11T1_s45', name: 'Nguyễn Trung Trực', className: '11T1', role: 'admin' }, { merge: true });
        if (existingProfile) {
          existingProfile.rosterId = '11T1_s45';
          existingProfile.name = 'Nguyễn Trung Trực';
          existingProfile.className = '11T1';
          existingProfile.role = 'admin';
        }
        return true;
      }
    }

    // If profile already has rosterId, verify it matches users_by_roster
    if (profile.rosterId) {
      const rId = String(profile.rosterId);
      const mapping = await getDoc(doc(db, 'users_by_roster', rId));
      if (mapping.exists() && mapping.data()?.uid === user.uid) return true;
      // Also allow legacy s45 for owner
      if (rId === 's45' && cleanUserEmail === ownerEmail) return true;
      throw new Error('Tên lớp đang được liên kết với tài khoản khác. Vui lòng liên hệ thầy cô để reset.');
    }

    // Load both rosters and claimed identities in parallel
    const [rosterData, claimedSnap] = await Promise.all([
      readRoster(),
      getDocs(collection(db, 'users_by_roster'))
    ]);

    const claimedMap = new Map();
    claimedSnap.forEach(d => {
      claimedMap.set(d.id, d.data() || {});
    });

    const modal = buildModalDOM();
    const selectionView = modal.querySelector('#rosterSelectionView');
    const confirmView = modal.querySelector('#rosterConfirmView');
    const tab11T1 = modal.querySelector('#rosterTab11T1');
    const tab11_1 = modal.querySelector('#rosterTab11_1');
    const badge11T1 = modal.querySelector('#badgeCount11T1');
    const badge11_1 = modal.querySelector('#badgeCount11_1');
    const searchInput = modal.querySelector('#rosterSearchInput');
    const searchClear = modal.querySelector('#rosterSearchClear');
    const statsCount = modal.querySelector('#rosterStatsCount');
    const studentListEl = modal.querySelector('#rosterStudentList');
    const errEl = modal.querySelector('#rosterErr');
    const selectedBanner = modal.querySelector('#rosterSelectedBanner');
    const selectedNameEl = modal.querySelector('#rosterSelectedName');
    const selectedClassBadge = modal.querySelector('#rosterSelectedClassBadge');
    const proceedBtn = modal.querySelector('#rosterProceedBtn');

    // Confirm View Elements
    const confirmAvatar = modal.querySelector('#confirmAvatar');
    const confirmStudentName = modal.querySelector('#confirmStudentName');
    const confirmClassBadge = modal.querySelector('#confirmClassBadge');
    const confirmSttBadge = modal.querySelector('#confirmSttBadge');
    const confirmGoogleEmail = modal.querySelector('#confirmGoogleEmail');
    const confirmErr = modal.querySelector('#confirmErr');
    const confirmBackBtn = modal.querySelector('#confirmBackBtn');
    const confirmSaveBtn = modal.querySelector('#confirmSaveBtn');

    // State
    let currentClass = '11T1';
    let selectedStudent = null;
    let searchQuery = '';

    badge11T1.textContent = (rosterData['11T1'] || []).length;
    badge11_1.textContent = (rosterData['11.1'] || []).length;

    // Reset view to selection mode
    selectionView.classList.remove('d-none');
    confirmView.classList.add('d-none');
    errEl.classList.add('d-none');
    confirmErr.classList.add('d-none');
    searchInput.value = '';
    searchClear.classList.add('d-none');
    proceedBtn.disabled = true;
    selectedBanner.classList.add('d-none');
    selectedStudent = null;

    const isStudentClaimed = (student) => {
      if (claimedMap.has(student.id)) return claimedMap.get(student.id);
      if (student.legacyId && claimedMap.has(student.legacyId)) return claimedMap.get(student.legacyId);
      return null;
    };

    const renderStudents = () => {
      const list = rosterData[currentClass] || [];
      const queryNorm = removeDiacritics(searchQuery);

      const filtered = list.filter(s => {
        if (!queryNorm) return true;
        const nameNorm = removeDiacritics(s.name);
        const sttStr = String(s.stt);
        const paddedStt = String(s.stt).padStart(2, '0');
        return nameNorm.includes(queryNorm) || sttStr === queryNorm || paddedStt === queryNorm;
      });

      statsCount.textContent = `Hiển thị ${filtered.length} / ${list.length} học sinh`;

      if (!filtered.length) {
        studentListEl.innerHTML = `
          <div class="roster-empty py-4 text-center text-muted">
            <div class="fs-2 mb-2">🔍</div>
            <p class="mb-0">Không tìm thấy học sinh nào phù hợp với từ khóa.</p>
          </div>
        `;
        return;
      }

      studentListEl.innerHTML = filtered.map(s => {
        const claimInfo = isStudentClaimed(s);
        const claimed = !!claimInfo;
        const isSelected = selectedStudent && selectedStudent.id === s.id;
        const isMine = claimInfo && claimInfo.uid === user.uid;

        return `
          <div class="roster-student-card ${claimed && !isMine ? 'is-claimed' : ''} ${isSelected ? 'is-selected' : ''}" data-id="${escLocal(s.id)}" role="button">
            <div class="roster-card-stt">#${String(s.stt).padStart(2, '0')}</div>
            <div class="roster-card-body">
              <div class="roster-card-name">${escLocal(s.name)}</div>
              <div class="roster-card-meta">
                <span class="badge bg-light text-dark border">${escLocal(s.className)}</span>
                ${claimed
                  ? `<span class="badge ${isMine ? 'bg-primary text-white' : 'bg-secondary-subtle text-muted'}">🔒 ${isMine ? 'Tài khoản của bạn' : 'Đã kích hoạt'}</span>`
                  : `<span class="badge bg-success-subtle text-success">🟢 Sẵn sàng chọn</span>`
                }
              </div>
            </div>
            <div class="roster-card-check">${isSelected ? '✓' : ''}</div>
          </div>
        `;
      }).join('');

      // Wire card selection
      studentListEl.querySelectorAll('.roster-student-card:not(.is-claimed)').forEach(card => {
        card.onclick = () => {
          const id = card.dataset.id;
          const found = list.find(x => x.id === id);
          if (!found) return;
          selectedStudent = found;
          errEl.classList.add('d-none');
          selectedBanner.classList.remove('d-none');
          selectedNameEl.textContent = `${found.name} (STT #${String(found.stt).padStart(2, '0')})`;
          selectedClassBadge.textContent = found.className;
          proceedBtn.disabled = false;
          renderStudents();
        };
      });
    };

    // Class switcher handlers
    tab11T1.onclick = () => {
      if (currentClass === '11T1') return;
      currentClass = '11T1';
      tab11T1.classList.add('active');
      tab11_1.classList.remove('active');
      selectedStudent = null;
      proceedBtn.disabled = true;
      selectedBanner.classList.add('d-none');
      renderStudents();
    };

    tab11_1.onclick = () => {
      if (currentClass === '11.1') return;
      currentClass = '11.1';
      tab11_1.classList.add('active');
      tab11T1.classList.remove('active');
      selectedStudent = null;
      proceedBtn.disabled = true;
      selectedBanner.classList.add('d-none');
      renderStudents();
    };

    // Live search handler
    searchInput.oninput = (e) => {
      searchQuery = e.target.value.trim();
      searchClear.classList.toggle('d-none', !searchQuery);
      renderStudents();
    };

    searchClear.onclick = () => {
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.add('d-none');
      searchInput.focus();
      renderStudents();
    };

    // Proceed to confirmation view
    proceedBtn.onclick = () => {
      if (!selectedStudent) return;
      confirmAvatar.textContent = getInitials(selectedStudent.name);
      confirmStudentName.textContent = selectedStudent.name;
      confirmClassBadge.textContent = `Lớp ${selectedStudent.className}`;
      confirmSttBadge.textContent = `STT #${String(selectedStudent.stt).padStart(2, '0')}`;
      confirmGoogleEmail.textContent = user.email || '—';
      confirmErr.classList.add('d-none');

      selectionView.classList.add('d-none');
      confirmView.classList.remove('d-none');
    };

    // Back from confirmation view
    confirmBackBtn.onclick = () => {
      confirmView.classList.add('d-none');
      selectionView.classList.remove('d-none');
    };

    // Initial render
    renderStudents();

    const bsModal = window.bootstrap?.Modal?.getOrCreateInstance(modal, {
      backdrop: 'static',
      keyboard: false
    });
    if (!bsModal) throw new Error('Bootstrap Modal chưa sẵn sàng.');
    const mobileNav = document.querySelector('.mobile-bottom');
    if (mobileNav) mobileNav.classList.add('d-none');
    modal.addEventListener('hidden.bs.modal', () => {
      if (mobileNav) mobileNav.classList.remove('d-none');
    }, { once: true });
    bsModal.show();

    return await new Promise((resolve, reject) => {
      confirmSaveBtn.onclick = async () => {
        if (!selectedStudent) return;
        confirmSaveBtn.disabled = true;
        confirmBackBtn.disabled = true;
        confirmSaveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Đang lưu...';

        try {
          // Concurrency safety check
          const mappingRef = doc(db, 'users_by_roster', selectedStudent.id);
          const currentSnap = await getDoc(mappingRef);
          if (currentSnap.exists() && currentSnap.data()?.uid !== user.uid) {
            throw new Error(`Tên ${selectedStudent.name} vừa được một tài khoản khác kích hoạt. Vui lòng chọn lại.`);
          }

          // Write mapping to users_by_roster
          const mappingData = {
            uid: user.uid,
            email: cleanUserEmail,
            name: String(selectedStudent.name),
            rosterId: selectedStudent.id,
            className: selectedStudent.className
          };
          await setDoc(mappingRef, mappingData);

          // If 11T1 has legacyId, keep legacy users_by_roster mapping in sync
          if (selectedStudent.legacyId) {
            await setDoc(doc(db, 'users_by_roster', selectedStudent.legacyId), {
              ...mappingData,
              rosterId: selectedStudent.legacyId
            }, { merge: true });
          }

          // Update user profile document
          await setDoc(doc(db, 'users', user.uid), {
            rosterId: selectedStudent.id,
            name: String(selectedStudent.name),
            className: selectedStudent.className,
            email: cleanUserEmail
          }, { merge: true });

          if (existingProfile) {
            existingProfile.rosterId = selectedStudent.id;
            existingProfile.name = String(selectedStudent.name);
            existingProfile.className = selectedStudent.className;
            existingProfile.email = cleanUserEmail;
          }

          bsModal.hide();
          toastGlobal(`Xin chào ${selectedStudent.name} (${selectedStudent.className})! Đã kích hoạt tài khoản thành công.`, 'success');
          resolve(true);
        } catch (err) {
          console.error('Lỗi lưu danh tính roster:', err);
          confirmErr.textContent = err.message || 'Không thể lưu tên. Vui lòng thử lại.';
          confirmErr.classList.remove('d-none');
          confirmSaveBtn.disabled = false;
          confirmBackBtn.disabled = false;
          confirmSaveBtn.textContent = '✓ Xác nhận & Bắt đầu';
        }
      };
    });
  } catch (error) {
    console.error('Lỗi khởi tạo Roster Gate:', error);
    toastGlobal(error.message || 'Không thể kiểm tra danh sách lớp.', 'error');
    return false;
  }
}

function toastGlobal(msg, type) {
  return window.appToast ? window.appToast(msg, type) : undefined;
}
