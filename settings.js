import { tr } from './i18n.js';
import { safeUrl } from './security.js';

const THEME_KEY = 'english-notebook-theme';
const GLASS_KEY = 'english-notebook-glass';
const GLASS_LEVEL_KEY = 'english-notebook-glass-level';
const DEFAULT_GLASS_LEVEL = 65;

let capabilityCache = null;
let initialized = false;
let isOpenState = false;
let activeTrigger = null;
let onSignOutHandler = null;
let lastUserMeta = null;
let lensMapDataUrl = '';
let lastActiveLevel = DEFAULT_GLASS_LEVEL;
let pointerRaf = 0;
let pendingPointer = null;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

function clampLevel(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return DEFAULT_GLASS_LEVEL;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readStoredActiveLevel() {
  const raw = readStorage(GLASS_LEVEL_KEY);
  if (raw === null || raw === '') return DEFAULT_GLASS_LEVEL;
  const lvl = clampLevel(raw);
  return lvl > 0 ? lvl : DEFAULT_GLASS_LEVEL;
}

lastActiveLevel = readStoredActiveLevel();

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

export function getGlassLevel() {
  const ds = document.documentElement.style.getPropertyValue('--gl-level');
  if (getGlass() === 'off') return 0;
  if (ds !== '') return clampLevel(ds);
  return readStoredActiveLevel();
}

function detectSvgRefractionSupport() {
  try {
    const cssOk = !!(
      window.CSS?.supports?.('backdrop-filter', 'url(#liquidGlassFilter)') ||
      window.CSS?.supports?.('-webkit-backdrop-filter', 'url(#liquidGlassFilter)')
    );
    if (!cssOk) return false;
    const ua = navigator.userAgent || '';
    const isBlink = /chrome|chromium|edg|opr|crios/i.test(ua);
    const isFirefox = /firefox/i.test(ua);
    return isBlink && !isFirefox;
  } catch {
    return false;
  }
}

export function probeDeviceCapability(forceRefresh = false) {
  if (capabilityCache && !forceRefresh) return capabilityCache;

  const supportsBackdrop = !!(
    window.CSS?.supports?.('backdrop-filter', 'blur(2px)') ||
    window.CSS?.supports?.('-webkit-backdrop-filter', 'blur(2px)')
  );
  const supportsSvgRefraction = supportsBackdrop && detectSvgRefractionSupport();
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
    supportsSvgRefraction,
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

function buildLiquidLensMap() {
  if (lensMapDataUrl) return lensMapDataUrl;
  try {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const img = ctx.createImageData(size, size);
    const data = img.data;

    for (let y = 0; y < size; y++) {
      const ny = (y / (size - 1)) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / (size - 1)) * 2 - 1;
        // Rounded squircle distance: smooth curved bezel around outer ~24%
        const ax = Math.abs(nx);
        const ay = Math.abs(ny);
        const sqDist = Math.pow(Math.pow(ax, 4.2) + Math.pow(ay, 4.2), 1 / 4.2);

        let dx = 0;
        let dy = 0;

        const normLen = Math.hypot(nx, ny) || 1;
        const invX = -nx / normLen;
        const invY = -ny / normLen;

        // Smooth convex glass bezel starting around 0.64 and tapering to 0 right at outer boundary 1.0
        if (sqDist > 0.64 && sqDist < 1.0) {
          const u = (sqDist - 0.64) / 0.36;
          const bevel = Math.pow(Math.sin(u * Math.PI), 0.72);
          dx += invX * bevel * 0.96;
          dy += invY * bevel * 0.96;
        }

        // Gentle central dome lens swell so shapes lightly magnify while keeping UI text crisp
        const edgeFade = Math.max(0, 1 - Math.pow(sqDist, 3.2));
        dx += Math.sin(nx * Math.PI * 1.15) * Math.cos(ny * Math.PI * 0.95) * 0.14 * edgeFade;
        dy += Math.sin(ny * Math.PI * 1.15) * Math.cos(nx * Math.PI * 0.95) * 0.14 * edgeFade;

        const r = Math.max(0, Math.min(255, Math.round(128 + dx * 124)));
        const g = Math.max(0, Math.min(255, Math.round(128 + dy * 124)));
        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    lensMapDataUrl = canvas.toDataURL('image/png');
    const mapEl = document.getElementById('liquidGlassMap');
    if (mapEl && lensMapDataUrl) {
      mapEl.setAttribute('href', lensMapDataUrl);
      mapEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', lensMapDataUrl);
    }
    return lensMapDataUrl;
  } catch {
    return '';
  }
}

function getTierMeta(level, glassOn) {
  if (!glassOn || level <= 0) {
    return { key: 'off', label: tr('Đang tắt', 'Off') };
  }
  if (level <= 38) {
    return { key: 'subtle', label: tr('Nhẹ · Frost', 'Subtle') };
  }
  if (level <= 68) {
    return { key: 'crystal', label: tr('Pha lê', 'Crystal') };
  }
  if (level <= 90) {
    return { key: 'pro', label: 'Liquid Pro' };
  }
  return { key: 'extreme', label: tr('Tối đa · Prism', 'Max · Prism') };
}

function applyLiquidOptics() {
  const root = document.documentElement;
  const cap = probeDeviceCapability();
  const glassOn = getGlass() === 'on' && cap.supportsBackdrop;
  const level = glassOn ? clampLevel(root.style.getPropertyValue('--gl-level') || lastActiveLevel) : 0;
  const t = glassOn && level > 0 ? level / 100 : 0;
  const isStrongEnough = t > 0;

  root.style.setProperty('--gl-level', String(level));
  root.style.setProperty('--gl-fill', `${glassOn ? level : 0}%`);
  root.style.setProperty('--gl-t', t.toFixed(3));

  // Optical blur + color vibrancy interpolation (pre-blur kept crisper when SVG lens refracts)
  const cardBlur = (10 + 20 * t).toFixed(1);
  const chromeBlur = (8 + 14 * t).toFixed(1);
  const refractBlur = (3.5 + 5.5 * t).toFixed(1);
  const saturate = Math.round(150 + 180 * t);
  const brightLight = (1.02 + 0.06 * t).toFixed(3);
  const brightDark = (1.04 + 0.09 * t).toFixed(3);

  // Careful Light/Dark readability curve even at 100% Liquid Extreme
  const lightA1 = (0.86 - 0.38 * t).toFixed(3);
  const lightA2 = (0.76 - 0.40 * t).toFixed(3);
  const lightPanel1 = (0.91 - 0.35 * t).toFixed(3);
  const lightPanel2 = (0.85 - 0.37 * t).toFixed(3);

  const darkA1 = (0.82 - 0.36 * t).toFixed(3);
  const darkA2 = (0.72 - 0.38 * t).toFixed(3);
  const darkPanel1 = (0.88 - 0.34 * t).toFixed(3);
  const darkPanel2 = (0.80 - 0.36 * t).toFixed(3);

  const rimLight = (0.64 + 0.36 * t).toFixed(3);
  const rimDark = (0.18 + 0.30 * t).toFixed(3);
  const sheenOpacity = (0.20 + 0.40 * t).toFixed(3);
  const ambientOpacity = (0.62 + 0.38 * t).toFixed(3);
  const prismEdge = t > 0.28 ? Math.min(1, (t - 0.28) / 0.72).toFixed(3) : '0';
  const elevateShadow = (0.07 + 0.15 * t).toFixed(3);

  root.style.setProperty('--gl-blur', `${cardBlur}px`);
  root.style.setProperty('--gl-chrome-blur', `${chromeBlur}px`);
  root.style.setProperty('--gl-refract-blur', `${refractBlur}px`);
  root.style.setProperty('--gl-sat', `${saturate}%`);
  root.style.setProperty('--gl-bright-light', brightLight);
  root.style.setProperty('--gl-bright-dark', brightDark);
  root.style.setProperty('--gl-l1', lightA1);
  root.style.setProperty('--gl-l2', lightA2);
  root.style.setProperty('--gl-pl1', lightPanel1);
  root.style.setProperty('--gl-pl2', lightPanel2);
  root.style.setProperty('--gl-d1', darkA1);
  root.style.setProperty('--gl-d2', darkA2);
  root.style.setProperty('--gl-pd1', darkPanel1);
  root.style.setProperty('--gl-pd2', darkPanel2);
  root.style.setProperty('--gl-rim-l', rimLight);
  root.style.setProperty('--gl-rim-d', rimDark);
  root.style.setProperty('--gl-sheen', sheenOpacity);
  root.style.setProperty('--gl-ambient', ambientOpacity);
  root.style.setProperty('--gl-prism', prismEdge);
  root.style.setProperty('--gl-shadow-a', elevateShadow);

  const useSvgRefract = Boolean(isStrongEnough && cap.supportsSvgRefraction && !cap.reducedTransparency && level >= 5);
  root.dataset.glassEngine = useSvgRefract ? 'svg-refract' : 'crystal';
  root.dataset.glassRefract = useSvgRefract ? 'on' : 'off';

  if (useSvgRefract) {
    buildLiquidLensMap();
    // Calibrated objectBoundingBox optical displacement (0.012 -> 0.115 curved bezel warp + RGB dispersion)
    const baseScale = 0.012 + 0.103 * Math.pow(t, 1.15);
    const prismRatio = t > 0.28 ? 0.06 + 0.22 * ((t - 0.28) / 0.72) : 0.04;
    const scaleR = (baseScale * (1 - prismRatio)).toFixed(4);
    const scaleG = baseScale.toFixed(4);
    const scaleB = (baseScale * (1 + prismRatio)).toFixed(4);
    document.getElementById('liquidGlassDispR')?.setAttribute('scale', scaleR);
    document.getElementById('liquidGlassDispG')?.setAttribute('scale', scaleG);
    document.getElementById('liquidGlassDispB')?.setAttribute('scale', scaleB);
  } else {
    document.getElementById('liquidGlassDispR')?.setAttribute('scale', '0');
    document.getElementById('liquidGlassDispG')?.setAttribute('scale', '0');
    document.getElementById('liquidGlassDispB')?.setAttribute('scale', '0');
  }
}

export function setGlass(enabled, levelOverride = null) {
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
    document.documentElement.style.setProperty('--gl-level', '0');
    writeStorage(GLASS_KEY, 'off');
    syncSettingsUI();
    return false;
  }

  let nextLevel = levelOverride !== null ? clampLevel(levelOverride) : lastActiveLevel;
  if (enabled && nextLevel <= 0) {
    nextLevel = lastActiveLevel >= 12 ? lastActiveLevel : DEFAULT_GLASS_LEVEL;
  }

  const nextOn = Boolean(enabled && nextLevel > 0);
  if (nextOn) {
    if (nextLevel >= 12) lastActiveLevel = nextLevel;
    writeStorage(GLASS_LEVEL_KEY, String(nextLevel));
  }

  document.documentElement.dataset.glass = nextOn ? 'on' : 'off';
  document.documentElement.style.setProperty('--gl-level', String(nextOn ? nextLevel : 0));
  writeStorage(GLASS_KEY, nextOn ? 'on' : 'off');
  syncSettingsUI();
  window.dispatchEvent(new CustomEvent('app:glass-change', { detail: { glass: nextOn ? 'on' : 'off', level: nextOn ? nextLevel : 0 } }));
  return nextOn;
}

export function setGlassLevel(rawLevel) {
  const level = clampLevel(rawLevel);
  if (level <= 0) {
    return setGlass(false);
  }
  return setGlass(true, level);
}

function formatCapabilityCopy(cap, glassOn, level) {
  const specs = [];
  if (cap.cores > 0) specs.push(`${cap.cores} CPU`);
  if (cap.memoryGb > 0) specs.push(`${cap.memoryGb} GB RAM`);
  if (cap.isSoftwareGpu || cap.webglCaveat) {
    specs.push(tr('GPU phần mềm', 'Software GPU'));
  } else if (cap.supportsSvgRefraction) {
    specs.push(tr('Khúc xạ SVG', 'SVG Refraction'));
  } else if (cap.webglBasic) {
    specs.push('GPU OK');
  }

  let badgeText = tr('Cấu hình trung bình · Khuyên ≤80%', 'Moderate · Ideal ≤80%');
  let iconClass = 'bi-cpu';
  let noteText = glassOn && level > 85
    ? tr(
        `Đang đẩy lên ${level}% (mức tối đa). Nếu thấy cuộn hơi nặng hãy hạ về ~75%.`,
        `Running at ${level}% (extreme). Lower to ~75% if scrolling feels heavy.`
      )
    : cap.supportsSvgRefraction
      ? tr(
          'Hỗ trợ khúc xạ thấu kính SVG. Bạn có thể kéo thanh chỉnh lên Liquid Pro rất mượt.',
          'SVG optical refraction supported. Runs smoothly up to Liquid Pro.'
        )
      : tr(
          'Trình duyệt đang dùng chế độ Pha lê Optical Crystal để giữ tốc độ mượt.',
          'Browser uses Optical Crystal mode to keep scrolling crisp and responsive.'
        );

  if (cap.tier === 'unsupported') {
    badgeText = tr('Không hỗ trợ kính mờ', 'Backdrop blur unsupported');
    iconClass = 'bi-slash-circle';
    noteText = tr(
      'Trình duyệt hiện tại không hỗ trợ CSS backdrop-filter.',
      'Your browser does not support CSS backdrop-filter.'
    );
  } else if (cap.tier === 'strong') {
    badgeText = tr('Máy đủ mạnh · Sẵn sàng 100%', 'Capable GPU · Ready for 100%');
    iconClass = 'bi-check-circle-fill';
    noteText = cap.supportsSvgRefraction
      ? tr(
          'GPU phần cứng sẵn sàng gánh khúc xạ SVG iOS 26 + tán sắc viền ở mức 100%.',
          'Hardware GPU ready for full 100% SVG optical refraction and chromatic dispersion.'
        )
      : tr(
          'GPU mạnh sẵn sàng chạy Pha lê trong sâu 100% ở 60fps.',
          'Capable GPU ready for full 100% Optical Crystal depth at 60fps.'
        );
  } else if (cap.tier === 'weak') {
    badgeText = tr('Khuyên tắt hoặc ≤45%', 'Recommended off or ≤45%');
    iconClass = 'bi-exclamation-triangle-fill';
    if (glassOn && level > 45) {
      noteText = tr(
        `Đang kéo ${level}% (vượt mức khuyên dùng ≤45% của máy). Bạn vẫn tự do trải nghiệm hoặc hạ xuống nếu lag.`,
        `At ${level}% (above recommended ≤45%). Enjoy freely, or dial back if scroll FPS drops.`
      );
    } else if (cap.reason === 'reduced-transparency') {
      noteText = tr(
        'Hệ điều hành đang bật Giảm độ trong suốt. Hệ thống giữ nền đọc rõ ràng.',
        'System Reduce Transparency is active. Readability safeguards stay applied.'
      );
    } else if (cap.reason === 'reduced-motion') {
      noteText = tr(
        'Đang bật Giảm chuyển động / tiết kiệm pin. Bạn vẫn có thể kéo thử mức Nhẹ.',
        'System Reduce Motion / battery saver is on. Subtle preset still works cleanly.'
      );
    } else if (cap.reason === 'software-gpu') {
      noteText = tr(
        'Phát hiện trình duyệt chưa bật tăng tốc GPU phần cứng. Kéo mức >45% có thể làm cuộn chậm.',
        'Hardware GPU acceleration appears off. Going above 45% may reduce scroll FPS.'
      );
    } else {
      noteText = tr(
        'CPU/RAM báo cáo thấp. Nên để mức Nhẹ (≤45%) hoặc tắt khi làm bài.',
        'Low CPU/RAM reported. Keep at Subtle (≤45%) or off during long sessions.'
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
  const cap = probeDeviceCapability();
  applyLiquidOptics();

  const lang = document.documentElement.lang === 'en' ? 'en' : (readStorage('english-notebook-lang') === 'en' ? 'en' : 'vi');
  const theme = getTheme();
  const glassOn = getGlass() === 'on';
  const level = getGlassLevel();
  const tierMeta = getTierMeta(level, glassOn);
  const copy = formatCapabilityCopy(cap, glassOn, level);

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

  const levelBadge = document.getElementById('glassLevelBadge');
  if (levelBadge) {
    levelBadge.textContent = glassOn ? `${level}%` : tr('Tắt', 'Off');
    levelBadge.classList.toggle('is-on', glassOn);
  }

  const intensityBox = document.getElementById('glassIntensityBox');
  if (intensityBox) {
    intensityBox.classList.toggle('is-off', !glassOn);
  }

  const tierNameEl = document.getElementById('glassTierName');
  if (tierNameEl) {
    tierNameEl.textContent = tierMeta.label;
    tierNameEl.dataset.tierKey = tierMeta.key;
  }

  const sliderPercentEl = document.getElementById('glassSliderPercent');
  if (sliderPercentEl) {
    sliderPercentEl.textContent = glassOn ? `${level}%` : '0%';
  }

  const rangeEl = document.getElementById('glassRange');
  if (rangeEl) {
    rangeEl.value = String(glassOn ? level : 0);
    rangeEl.disabled = !cap.supportsBackdrop;
    rangeEl.setAttribute('aria-valuetext', `${glassOn ? level : 0}% · ${tierMeta.label}`);
  }

  document.querySelectorAll('[data-glass-preset]').forEach(btn => {
    const presetVal = Number(btn.dataset.glassPreset);
    let isMatched = false;
    if (glassOn) {
      if (presetVal === 25) isMatched = level > 0 && level <= 38;
      else if (presetVal === 55) isMatched = level > 38 && level <= 68;
      else if (presetVal === 80) isMatched = level > 68 && level <= 90;
      else if (presetVal === 100) isMatched = level > 90;
    }
    btn.classList.toggle('is-active', isMatched);
    btn.setAttribute('aria-pressed', String(isMatched));
    btn.disabled = !cap.supportsBackdrop;
  });

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
  if (glassOn) mobileParts.push(`Glass ${level}%`);

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

  if (isOpenState) {
    clampOpenPopover();
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

function clampOpenPopover() {
  if (!isOpenState || isMobileViewport()) return;
  const panel = document.getElementById('settingsPanel');
  if (!panel) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(392, vw - 24);
  panel.style.width = `${w}px`;
  const h = Math.min(panel.offsetHeight || 560, vh - 24);
  let left = parseFloat(panel.style.left);
  let top = parseFloat(panel.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    positionPanel(activeTrigger);
    return;
  }
  if (left + w > vw - 12) left = vw - w - 12;
  if (left < 12) left = 12;
  if (top + h > vh - 12) top = vh - h - 12;
  if (top < 12) top = 12;
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
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
      const w = Math.min(392, window.innerWidth - 24);
      panel.style.width = `${w}px`;
      panel.style.left = `${Math.round((window.innerWidth - w) / 2)}px`;
      panel.style.top = `${Math.max(12, Math.round((window.innerHeight - Math.min(panel.offsetHeight || 540, window.innerHeight - 24)) / 2))}px`;
    }
    return;
  }

  panel.dataset.mode = 'popover';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(392, vw - 24);
  panel.style.width = `${width}px`;

  const rect = triggerEl.getBoundingClientRect();
  const panelHeight = Math.min(panel.offsetHeight || 560, vh - 24);
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

function updatePointerSpecular() {
  pointerRaf = 0;
  if (!pendingPointer) return;
  const { x, y } = pendingPointer;
  pendingPointer = null;

  const panel = document.getElementById('settingsPanel');
  if (panel && isOpenState) {
    const pr = panel.getBoundingClientRect();
    const px = Math.max(0, Math.min(pr.width, x - pr.left));
    const py = Math.max(0, Math.min(pr.height, y - pr.top));
    panel.style.setProperty('--gl-mx', `${Math.round(px)}px`);
    panel.style.setProperty('--gl-my', `${Math.round(py)}px`);
  }

  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const vx = ((x / vw) * 100).toFixed(1);
  const vy = ((y / vh) * 100).toFixed(1);
  document.documentElement.style.setProperty('--gl-vx', `${vx}%`);
  document.documentElement.style.setProperty('--gl-vy', `${vy}%`);
}

export function initSettings({ onSignOut } = {}) {
  if (typeof onSignOut === 'function') {
    onSignOutHandler = onSignOut;
  }

  document.documentElement.dataset.theme = getTheme();
  const initialOn = getGlass() === 'on';
  document.documentElement.dataset.glass = initialOn ? 'on' : 'off';
  document.documentElement.style.setProperty('--gl-level', String(initialOn ? readStoredActiveLevel() : 0));
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

  const rangeEl = document.getElementById('glassRange');
  rangeEl?.addEventListener('input', () => {
    setGlassLevel(rangeEl.value);
  });

  document.querySelectorAll('[data-glass-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      setGlassLevel(Number(btn.dataset.glassPreset));
    });
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
    if (e.target.closest('.settings-liquid-range')) {
      touchDraggingFromHead = false;
      return;
    }
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

  window.addEventListener('pointermove', e => {
    if (getGlass() !== 'on' || capabilityCache?.reducedMotion) return;
    pendingPointer = { x: e.clientX, y: e.clientY };
    if (!pointerRaf) {
      pointerRaf = requestAnimationFrame(updatePointerSpecular);
    }
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
