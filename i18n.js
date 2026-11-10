const LANG_KEY = 'english-notebook-lang';

const DICT = {
  vi: {
    'auth.subtitle': 'Biến những gì học thêm thành một cuốn sổ tiếng Anh riêng của bạn.',
    'auth.login': 'Đăng nhập Google',
    'nav.sec.teacherAdmin': 'Quản lý lớp học',
    'nav.admin': 'Khu vực Giáo viên',
    'nav.daily': 'Daily Set',
    'nav.sec.overview': 'Tổng quan',
    'nav.home': 'Tổng quan',
    'nav.sec.capture': 'Ghi & lưu',
    'nav.capture': 'Ghi bài',
    'nav.mistakes': 'Câu sai',
    'nav.vocab': 'Từ vựng',
    'nav.grammar': 'Cấu trúc',
    'nav.sec.practice': 'Học liệu & Luyện tập',
    'nav.knowledge': 'Kiến thức giáo viên',
    'nav.textbook': 'Từ vựng theo Unit',
    'nav.exercises': 'Bài tập',
    'nav.listening': 'Listening',
    'nav.review': 'Ôn nhanh',
    'nav.profile': 'Hồ sơ',
    'mb.home': 'Trang chủ',
    'mb.teacher': 'Giáo viên',
    'mb.daily': 'Daily',
    'mb.exercises': 'Bài tập',
    'mb.listening': 'Nghe',
    'mb.mistakes': 'Câu sai',
    'mb.more': 'Thêm',
    'more.knowledge': '📚 Kiến thức giáo viên',
    'more.textbook': '▦ Từ vựng theo Unit',
    'more.listening': '◖ Listening',
    'more.capture': '＋ Ghi bài',
    'more.vocab': 'Aa Từ vựng',
    'more.grammar': 'ƒ Cấu trúc',
    'more.review': '↯ Ôn nhanh',
    'more.profile': '👤 Hồ sơ',
    'more.admin': '⚙ Khu vực Giáo viên',
    'admin.eyebrow': 'QUẢN LÝ KHỐI 11 · LỚP 11T1 & 11.1',
    'admin.title': 'Khu vực Giáo viên',
    'admin.subtitle': 'Theo dõi 2 lớp 11T1 & 11.1, quản lý Daily Set, kiến thức, bài nghe và xuất Word.',
    'admin.exportWord': 'Xuất Word',
    'admin.tab.students': '2 Lớp & Tiến độ',
    'admin.tab.questions': 'Daily Sets & Đề',
    'admin.tab.knowledge': 'Kiến thức',
    'admin.tab.listening': 'Bài nghe',
    'admin.tab.admins': 'Phân quyền',
    'admin.panel.students': 'Tiến độ học sinh 2 lớp (11T1 & 11.1)',
    'admin.panel.roster': 'Cấu hình danh sách học sinh (11T1 & 11.1)',
    'admin.panel.dailySets': 'Quản lý Daily Set',
    'admin.panel.questionBank': 'Ngân hàng câu hỏi thủ công',
    'admin.panel.knowledge': 'Quản lý kiến thức',
    'admin.panel.listening': 'Quản lý Listening',
    'admin.panel.admins': 'Giáo viên / quản trị viên',
    'admin.sub.daily': 'Daily Sets (Word & Danh sách)',
    'admin.sub.bank': 'Ngân hàng câu hỏi',
    'page.knowledge.title': '📚 Kiến thức học tập giáo viên',
    'page.knowledge.desc': 'Bài học được giáo viên đăng từ Khu vực Giáo viên. Khi xuất bản, học sinh thấy ngay trên web.',
    'page.textbook.title': 'Ôn từ vựng theo Unit',
    'page.textbook.btnReview': '▶ Ôn Unit',
    'page.textbook.btnAdd': '＋ Thêm từ vựng',
    'page.listening.title': '🎧 Nghe & điền chỗ trống',
    'page.listening.btnStart': '▶ Bắt đầu',
    'page.listening.btnAdd': '＋ Thêm bài nghe',
    'page.listening.teacherSec': 'LISTENING GIÁO VIÊN ĐĂNG',
    'page.exercises.title': 'Bài tập theo từng Unit',
    'page.exercises.btnStart': '▶ Bắt đầu Unit',
    'page.exercises.btnAdd': '＋ Thêm bài tập',
    'page.exercises.teacherSec': 'BÀI TẬP GIÁO VIÊN ĐĂNG',
    'theme.light': 'Giao diện sáng',
    'theme.dark': 'Giao diện tối',
    'logout.label': 'Đăng xuất'
  },
  en: {
    'auth.subtitle': 'Turn class notes into your personal English mastery notebook.',
    'auth.login': 'Sign in with Google',
    'nav.sec.teacherAdmin': 'Class Management',
    'nav.admin': 'Teacher Dashboard',
    'nav.daily': 'Daily Set',
    'nav.sec.overview': 'Overview',
    'nav.home': 'Overview',
    'nav.sec.capture': 'Capture & Notes',
    'nav.capture': 'Quick Note',
    'nav.mistakes': 'Mistakes',
    'nav.vocab': 'Vocabulary',
    'nav.grammar': 'Grammar',
    'nav.sec.practice': 'Materials & Practice',
    'nav.knowledge': 'Teacher Notes',
    'nav.textbook': 'Unit Vocabulary',
    'nav.exercises': 'Exercises',
    'nav.listening': 'Listening',
    'nav.review': 'Quick Review',
    'nav.profile': 'Profile',
    'mb.home': 'Home',
    'mb.teacher': 'Teacher',
    'mb.daily': 'Daily',
    'mb.exercises': 'Practice',
    'mb.listening': 'Listen',
    'mb.mistakes': 'Errors',
    'mb.more': 'More',
    'more.knowledge': '📚 Teacher Notes',
    'more.textbook': '▦ Unit Vocabulary',
    'more.listening': '◖ Listening',
    'more.capture': '＋ Quick Note',
    'more.vocab': 'Aa Vocabulary',
    'more.grammar': 'ƒ Grammar',
    'more.review': '↯ Quick Review',
    'more.profile': '👤 Profile',
    'more.admin': '⚙ Teacher Dashboard',
    'admin.eyebrow': 'GRADE 11 MANAGEMENT · CLASSES 11T1 & 11.1',
    'admin.title': 'Teacher Workspace',
    'admin.subtitle': 'Track 11T1 & 11.1 classes, manage Daily Sets, study notes, listening tasks, and export Word reports.',
    'admin.exportWord': 'Export Word',
    'admin.tab.students': '2 Classes & Progress',
    'admin.tab.questions': 'Daily Sets & Bank',
    'admin.tab.knowledge': 'Knowledge',
    'admin.tab.listening': 'Listening',
    'admin.tab.admins': 'Permissions',
    'admin.panel.students': 'Student Progress Across 2 Classes (11T1 & 11.1)',
    'admin.panel.roster': 'Class Roster Configuration (11T1 & 11.1)',
    'admin.panel.dailySets': 'Daily Set Manager',
    'admin.panel.questionBank': 'Manual Question Bank',
    'admin.panel.knowledge': 'Knowledge Management',
    'admin.panel.listening': 'Listening Management',
    'admin.panel.admins': 'Teachers & Administrators',
    'admin.sub.daily': 'Daily Sets (Word & List)',
    'admin.sub.bank': 'Question Bank',
    'page.knowledge.title': '📚 Teacher Study Notes',
    'page.knowledge.desc': 'Lessons published from the Teacher Workspace appear here immediately for students.',
    'page.textbook.title': 'Unit Vocabulary Review',
    'page.textbook.btnReview': '▶ Review Unit',
    'page.textbook.btnAdd': '＋ Add Vocabulary',
    'page.listening.title': '🎧 Listening Practice',
    'page.listening.btnStart': '▶ Start',
    'page.listening.btnAdd': '＋ Add Listening',
    'page.listening.teacherSec': 'TEACHER LISTENING TASKS',
    'page.exercises.title': 'Unit Practice Exercises',
    'page.exercises.btnStart': '▶ Start Unit',
    'page.exercises.btnAdd': '＋ Add Exercise',
    'page.exercises.teacherSec': 'TEACHER EXERCISES',
    'theme.light': 'Light mode',
    'theme.dark': 'Dark mode',
    'logout.label': 'Sign out'
  }
};

export function getLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function tr(vi, en) {
  return getLang() === 'en' ? en : vi;
}

export function t(key) {
  const lang = getLang();
  return DICT[lang]?.[key] ?? DICT.vi[key] ?? key;
}

export function syncLangButtons() {
  const lang = getLang();
  const isEn = lang === 'en';
  const desktop = document.getElementById('langToggle');
  const mobile = document.getElementById('langToggleMobile');
  const logout = document.getElementById('logout');
  if (desktop) {
    desktop.textContent = isEn ? 'EN' : 'VI';
    desktop.setAttribute('aria-label', isEn ? 'Switch language to Vietnamese' : 'Chuyển sang tiếng Anh (English)');
    desktop.title = isEn ? 'English (click for Tiếng Việt)' : 'Tiếng Việt (bấm đổi sang English)';
    desktop.dataset.lang = lang;
  }
  if (mobile) {
    mobile.textContent = isEn ? '🌐 English' : '🌐 Tiếng Việt';
    mobile.setAttribute('aria-label', isEn ? 'Switch language to Vietnamese' : 'Chuyển sang tiếng Anh');
  }
  if (logout) {
    logout.title = t('logout.label');
    logout.setAttribute('aria-label', t('logout.label'));
  }
  window.__syncThemeLabel?.();
}

export function applyTranslations() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = DICT[lang]?.[el.dataset.i18n];
    if (val !== undefined) el.textContent = val;
  });
  syncLangButtons();
}

export function setLang(lang) {
  const next = lang === 'en' ? 'en' : 'vi';
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {}
  applyTranslations();
  window.dispatchEvent(new CustomEvent('app:lang-change', { detail: { lang: next } }));
}

export function toggleLang() {
  setLang(getLang() === 'en' ? 'vi' : 'en');
}

export function initI18n() {
  applyTranslations();
  const bind = (id) => {
    const el = document.getElementById(id);
    if (el && !el.dataset.i18nBound) {
      el.dataset.i18nBound = '1';
      el.addEventListener('click', toggleLang);
    }
  };
  bind('langToggle');
  bind('langToggleMobile');
}
