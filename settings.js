import { getLang, tr } from './i18n.js';
import { safeUrl } from './security.js';

const THEME_KEY = 'english-notebook-theme';
const GLASS_KEY = 'english-notebook-glass';

let capabilityCache = null;
let initialized = false;
let isOpenState = false;
let activeTrigger = null;
let onSignOutHandler = null;
let lastUserMeta = null;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function getTheme() {
  if (document.documentElement.dataset.theme === 'dark') return 'dark';
  return readStorage(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function setTheme(nextTheme) {
  const theme = nextTheme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  writeStorage(THEME_KEY, theme);
  syncSettingsUI();
  window.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme } }));
  return theme;
}

export function getGlass() {
  if (document.documentElement.dataset.glass === 'on') return 'on';
  return readStorage(GLASS_KEY) === 'on' ? 'on' : 'off';
}

export function probeDeviceCapability(forceRefresh = false) {
  if (capabilityCache && !forceRefresh) return capabilityCache;

  const supportsBackdrop = !!(
    window.CSS?.supports?.('backdrop-filter', 'blur(2px)') ||
    window.CSS?.supports?.('-webkit-backdrop-filter', 'blur(2px)')
  );
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const reducedTransparency = !!window.matchMedia?.('(prefers-reduced-transparency: reduce)')?.matches;
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memoryGb = Number(navigator.deviceMemory || 0);

  let renderer = '';
  let webglBasic = false;
  let webglCaveat = false;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (gl) {
      webglBasic = true;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      }
      const fastGl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
      webglCaveat = !fastGl;
      if (fastGl && fastGl !== gl) {
        fastGl.getExtension('WEBGL_lose_context')?.loseContext?.();
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext?.();
    }
  } catch {}

  const isSoftwareGpu = /swiftshader|llvmpipe|softpipe|microsoft basic render|gdi generic/i.test(renderer);

  let tier = 'medium';
  let reason = 'medium';

  if (!supportsBackdrop) {
    tier = 'unsupported';
    reason = 'unsupported';
  } else if (reducedTransparency) {
    tier = 'weak';
    reason = 'reduced-transparency';
  } else if (reducedMotion) {
    tier = 'weak';
    reason = 'reduced-motion';
  } else if (isSoftwareGpu || webglCaveat) {
    tier = 'weak';
    reason = 'software-gpu';
  } else if ((memoryGb > 0 && memoryGb <= 2) || (cores > 0 && cores <= 2)) {
    tier = 'weak';
    reason = 'low-spec';
  } else if (
    !isSoftwareGpu &&
    !webglCaveat &&
    ((cores >= 8 && (memoryGb === 0 || memoryGb >= 8)) || (cores >= 6 && memoryGb >= 8))
  ) {
    tier = 'strong';
    reason = 'strong';
  }

  capabilityCache = {
    tier,
    reason,
    supportsBackdrop,
    reducedMotion,
    reducedTransparency,
    cores,
    memoryGb,
    webglBasic,
    webglCaveat,
    isSoftwareGpu
  };
  return capabilityCache;
}

export function setGlass(enabled) {
  const cap = probeDeviceCapability();
  if (enabled && !cap.supportsBackdrop) {
    window.appToast?.(
      tr(
        'Trình duyệt này chưa hỗ trợ làm mờ nền (backdrop-filter).',
        'This browser does not support backdrop blur.'
      ),
      'error'
    );
    document.documentElement.dataset.glass = 'off';
    writeStorage(GLASS_KEY, 'off');
    syncSettingsUI();
    return false;
  }

  const next = enabled ? 'on' : 'off';
  document.documentElement.dataset.glass = next;
  writeStorage(GLASS_KEY, next);
  syncSettingsUI();
  window.dispatchEvent(new CustomEvent('app:glass-change', { detail: { glass: next } }));
  return enabled;
}

function formatCapabilityCopy(cap) {
  const specs = [];
  if (cap.cores > 0) specs.push(`${cap.cores} CPU`);
  if (cap.memoryGb > 0) specs.push(`${cap.memoryGb} GB RAM`);
  if (cap.isSoftwareGpu || cap.webglCaveat) {
    specs.push(tr('GPU phần mềm', 'Software GPU'));
  } else if (cap.webglBasic) {
    specs.push('GPU OK');
  }

  let badgeText = tr('Cấu hình trung bình · Chạy ổn', 'Moderate · Smooth');
  let iconClass = 'bi-cpu';
  let noteText = tr(
    'Minimal Frost dùng kính mờ tĩnh tối ưu pin. Tắt bất cứ lúc nào nếu thấy máy nóng.',
    'Minimal Frost uses static blur to protect battery. Turn off anytime if needed.'
  );

  if (cap.tier === 'unsupported') {
    badgeText = tr('Không hỗ trợ kính mờ', 'Backdrop blur unsupported');
    iconClass = 'bi-slash-circle';
    noteText = tr(
      'Trình duyệt hiện tại không hỗ trợ CSS backdrop-filter.',
      'Your browser does not support CSS backdrop-filter.'
    );
  } else if (cap.tier === 'strong') {
    badgeText = tr('Máy đủ mạnh · Hỗ trợ mượt', 'Capable hardware · Smooth');
    iconClass = 'bi-check-circle-fill';
    noteText = tr(
      'Thiết bị có tăng tốc GPU phần cứng và bộ nhớ tốt cho kính mờ đa tầng.',
      'Hardware GPU acceleration and resources look solid for layered frosted glass.'
    );
  } else if (cap.tier === 'weak') {
    badgeText = tr('Khuyên tắt · Dễ giật lag', 'Recommended off · May lag');
    iconClass = 'bi-exclamation-triangle-fill';
    if (cap.reason === 'reduced-transparency') {
      noteText = tr(
        'Hệ điều hành đang bật Giảm độ trong suốt. Nếu vẫn bật thủ công, kính có thể hiển thị kém rõ.',
        'System Reduce Transparency is enabled. Manual override may reduce visual clarity.'
      );
    } else if (cap.reason === 'reduced-motion') {
      noteText = tr(
        'Hệ điều hành đang bật Giảm chuyển động / tiết kiệm năng lượng. Bạn vẫn có thể bật thử nếu muốn.',
        'System Reduce Motion / power-saving is active. You can still toggle it on manually.'
      );
    } else if (cap.reason === 'software-gpu') {
      noteText = tr(
        'Phát hiện trình duyệt chưa bật tăng tốc phần cứng GPU. Bật kính mờ có thể làm cuộn trang chậm.',
        'Browser GPU hardware acceleration appears off. Enabling glass may drop scroll FPS.'
      );
    } else {
      noteText = tr(
        'CPU/RAM báo cáo ở mức thấp. Nên tắt để giữ tốc độ phản hồi nhanh nhất khi làm bài.',
        'Low CPU/RAM detected. Keeping glass off ensures fastest responsiveness during quizzes.'
      );
    }
  }

  return {
    badgeText,
    iconClass,
    specsText: specs.join(' · '),
    noteText
  };
}

export function syncSettingsUI() {
  const lang = getLang();
  const theme = getTheme();
  const glassOn = getGlass() === 'on';
  const cap = probeDeviceCapability();
  const copy = formatCapabilityCopy(cap);

  document.querySelectorAll('[data-set-lang]').forEach(btn => {
    const active = btn.dataset.setLang === lang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  document.querySelectorAll('[data-set-theme]').forEach(btn => {
    const active = btn.dataset.setTheme === theme;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  const glassSwitch = document.getElementById('glassSwitch');
  if (glassSwitch) {
    glassSwitch.setAttribute('aria-checked', String(glassOn));
    glassSwitch.classList.toggle('is-on', glassOn);
    glassSwitch.disabled = !cap.supportsBackdrop;
  }

  const hwCard = document.getElementById('glassHwCard');
  if (hwCard) {
    hwCard.dataset.tier = cap.tier;
    const badgeIcon = hwCard.querySelector('#glassHwBadge i');
    if (badgeIcon) badgeIcon.className = `bi ${copy.iconClass}`;
    const badgeTextEl = document.getElementById('glassHwBadgeText');
    if (badgeTextEl) badgeTextEl.textContent = copy.badgeText;
    const specsEl = document.getElementById('glassHwSpecs');
    if (specsEl) specsEl.textContent = copy.specsText;
    const noteEl = document.getElementById('glassHwNote');
    if (noteEl) noteEl.textContent = copy.noteText;
  }

  const langTag = lang === 'en' ? 'EN' : 'VI';
  const themeLabel = theme === 'dark' ? tr('Tối', 'Dark') : tr('Sáng', 'Light');
  const mobileParts = [langTag, themeLabel];
  if (glassOn) mobileParts.push('Glass');

  ['settingsBadgeSidebar', 'settingsBadgeTeacher'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = langTag;
  });
  const mobileSummary = document.getElementById('settingsBadgeMobile');
  if (mobileSummary) mobileSummary.textContent = mobileParts.join(' · ');

  document.querySelectorAll('[data-settings-trigger]').forEach(trigger => {
    trigger.classList.toggle('is-glass-on', glassOn);
    trigger.classList.toggle('is-dark-on', theme === 'dark');
  });

  const ambient = document.getElementById('glassAmbient');
  if (ambient) {
    ambient.toggleAttribute('hidden', !glassOn);
  }

  const nameEl = document.getElementById('settingsUserName');
  if (nameEl) {
    nameEl.textContent = lastUserMeta?.name || tr('Tài khoản', 'Account');
  }
  const roleEl = document.getElementById('settingsUserRole');
  if (roleEl && lastUserMeta?.roleLabel) {
    const r = lastUserMeta.roleLabel;
    if (r === 'Học sinh' || r === 'Student') {
      roleEl.textContent = tr('Học sinh', 'Student');
    } else if (r === 'Giáo viên' || r === 'Teacher') {
      roleEl.textContent = tr('Giáo viên', 'Teacher');
    } else {
      roleEl.textContent = r;
    }
  }
}

window.__syncSettingsUI = syncSettingsUI;
window.__syncThemeLabel = syncSettingsUI;

export function syncSettingsUser({ name = '', email = '', photoURL = '', roleLabel = '' } = {}) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '');
  const cleanRole = String(roleLabel || '').trim();
  lastUserMeta = (cleanName || cleanEmail) ? { name: cleanName, email: cleanEmail, photoURL, roleLabel: cleanRole } : null;

  const avatarEl = document.getElementById('settingsUserAvatar');
  const nameEl = document.getElementById('settingsUserName');
  const emailEl = document.getElementById('settingsUserEmail');
  const roleEl = document.getElementById('settingsUserRole');

  const fallback = tr('Tài khoản', 'Account');
  const displayName = cleanName || fallback;

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = cleanEmail;
  if (roleEl) {
    const hasRole = Boolean(cleanRole);
    roleEl.textContent = cleanRole;
    roleEl.classList.toggle('d-none', !hasRole);
  }
  if (avatarEl) {
    avatarEl.replaceChildren();
    const safe = safeUrl(photoURL);
    if (safe) {
      const img = document.createElement('img');
      img.src = safe;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      avatarEl.appendChild(img);
    } else {
      avatarEl.textContent = String(displayName || email || 'U').trim().charAt(0).toUpperCase() || 'U';
    }
  }
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 767.98px)').matches;
}

function positionPanel(triggerEl) {
  const panel = document.getElementById('settingsPanel');
  if (!panel) return;

  if (isMobileViewport() || !triggerEl || !triggerEl.isConnected) {
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.dataset.mode = isMobileViewport() ? 'sheet' : 'popover';
    panel.dataset.anchor = isMobileViewport() ? 'bottom' : 'center';
    if (!isMobileViewport()) {
      const w = Math.min(360, window.innerWidth - 24);
      panel.style.width = `${w}px`;
      panel.style.left = `${Math.round((window.innerWidth - w) / 2)}px`;
      panel.style.top = `${Math.max(12, Math.round((window.innerHeight - Math.min(panel.offsetHeight || 460, window.innerHeight - 24)) / 2))}px`;
    }
    return;
  }

  panel.dataset.mode = 'popover';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(364, vw - 24);
  panel.style.width = `${width}px`;

  const rect = triggerEl.getBoundingClientRect();
  const panelHeight = Math.min(panel.offsetHeight || 480, vh - 24);
  const origin = triggerEl.dataset.settingsTrigger || 'header';

  let left;
  let top;

  if (origin === 'sidebar') {
    panel.dataset.anchor = 'sidebar';
    const navRect = triggerEl.closest('.nav')?.getBoundingClientRect() || rect;
    left = navRect.right + 12;
    if (left + width > vw - 12) {
      left = vw - width - 12;
    }
    top = rect.bottom - panelHeight;
    if (top < 12) top = 12;
    if (top + panelHeight > vh - 12) top = Math.max(12, vh - panelHeight - 12);
  } else {
    panel.dataset.anchor = 'header';
    left = rect.right - width;
    if (left < 12) left = 12;
    if (left + width > vw - 12) left = vw - width - 12;
    top = rect.bottom + 10;
    if (top + panelHeight > vh - 12) {
      top = Math.max(12, rect.top - panelHeight - 10);
    }
  }

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

export function openSettings(triggerEl = null) {
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  if (!panel || !backdrop) return;

  if (triggerEl?.dataset?.settingsTrigger === 'mobile') {
    window.__closeMoreSheet?.();
  }

  activeTrigger = triggerEl || activeTrigger || document.activeElement;
  isOpenState = true;
  probeDeviceCapability(true);
  syncSettingsUI();

  document.body.classList.add('settings-open');
  panel.classList.add('is-open');
  backdrop.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  backdrop.setAttribute('aria-hidden', 'false');
  document.querySelectorAll('[data-settings-trigger]').forEach(btn => {
    btn.setAttribute('aria-expanded', String(btn === activeTrigger));
  });

  positionPanel(activeTrigger);

  requestAnimationFrame(() => {
    if (!isOpenState) return;
    positionPanel(activeTrigger);
    const closeBtn = document.getElementById('settingsClose');
    closeBtn?.focus({ preventScroll: true });
  });
}

export function closeSettings({ restoreFocus = true } = {}) {
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  if (!panel || !backdrop || !isOpenState) return;

  isOpenState = false;
  document.body.classList.remove('settings-open');
  panel.classList.remove('is-open');
  backdrop.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  backdrop.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('[data-settings-trigger]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });

  if (restoreFocus && activeTrigger && document.contains(activeTrigger)) {
    try {
      activeTrigger.focus({ preventScroll: true });
    } catch {}
  }
}

function getFocusableControls(container) {
  return [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
}

export function initSettings({ onSignOut } = {}) {
  if (typeof onSignOut === 'function') {
    onSignOutHandler = onSignOut;
  }

  document.documentElement.dataset.theme = getTheme();
  document.documentElement.dataset.glass = getGlass();
  syncSettingsUI();

  if (initialized) return;
  initialized = true;

  document.querySelectorAll('[data-settings-trigger]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isOpenState && activeTrigger === btn) {
        closeSettings();
      } else {
        openSettings(btn);
      }
    });
  });

  document.getElementById('settingsClose')?.addEventListener('click', () => closeSettings());
  document.getElementById('settingsBackdrop')?.addEventListener('click', () => closeSettings());

  document.querySelectorAll('[data-set-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.setTheme);
    });
  });

  document.getElementById('glassSwitch')?.addEventListener('click', () => {
    const nextOn = getGlass() !== 'on';
    setGlass(nextOn);
  });

  document.getElementById('settingsLogoutBtn')?.addEventListener('click', async () => {
    if (typeof onSignOutHandler !== 'function') return;
    const msg = tr(
      'Bạn có chắc muốn đăng xuất khỏi English Notebook trên thiết bị này không?',
      'Are you sure you want to sign out of English Notebook on this device?'
    );
    const confirmed = window.appConfirm
      ? await window.appConfirm({
          title: tr('Đăng xuất tài khoản?', 'Sign out?'),
          message: msg,
          confirmText: tr('Đăng xuất', 'Sign out'),
          cancelText: tr('Ở lại', 'Stay'),
          danger: true,
          icon: '↪'
        })
      : true;

    if (!confirmed) {
      document.getElementById('settingsLogoutBtn')?.focus?.();
      return;
    }

    closeSettings({ restoreFocus: false });
    try {
      await onSignOutHandler();
    } catch (err) {
      console.error('Lỗi đăng xuất:', err);
      window.appToast?.(
        window.appErrorMsg
          ? window.appErrorMsg(err, 'Không thể đăng xuất. Vui lòng thử lại.', 'Could not sign out. Please try again.')
          : tr('Không thể đăng xuất. Vui lòng thử lại.', 'Could not sign out. Please try again.'),
        'error'
      );
    }
  });

  const panel = document.getElementById('settingsPanel');
  let touchStartY = 0;
  let touchDraggingFromHead = false;
  panel?.addEventListener('touchstart', e => {
    if (!isMobileViewport() || !e.touches?.length) return;
    touchDraggingFromHead = !!e.target.closest('.settings-sheet-handle, .settings-head') || panel.scrollTop <= 0;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  panel?.addEventListener('touchend', e => {
    if (!isMobileViewport() || !touchDraggingFromHead || !e.changedTouches?.length) return;
    if (e.changedTouches[0].clientY - touchStartY > 70) {
      closeSettings();
    }
    touchDraggingFromHead = false;
  }, { passive: true });

  document.addEventListener('keydown', e => {
    if (!isOpenState) return;
    if (document.querySelector('.app-dialog-backdrop')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSettings();
      return;
    }
    if (e.key === 'Tab' && panel) {
      const focusables = getFocusableControls(panel);
      if (!focusables.length) return;
      const idx = focusables.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1]?.focus();
        }
      } else if (idx === focusables.length - 1 || idx === -1) {
        e.preventDefault();
        focusables[0]?.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (isOpenState) positionPanel(activeTrigger);
  });

  ['(prefers-reduced-motion: reduce)', '(prefers-reduced-transparency: reduce)'].forEach(query => {
    try {
      const mql = window.matchMedia(query);
      mql?.addEventListener?.('change', () => {
        probeDeviceCapability(true);
        syncSettingsUI();
      });
    } catch {}
  });
}
