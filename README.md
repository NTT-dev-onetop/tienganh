# English Notebook — UI/UX Redesign v15

Redesign giữ nguyên các tính năng hiện có, tập trung vào trải nghiệm tự học lớp 11.

## Giữ nguyên chức năng
- Firebase Auth + Firestore
- Ghi Từ mới: nghĩa, từ loại, phát âm, word family, V1/V2/V3, bị động/V3, pattern, ví dụ, ghi nhớ
- Ghi Cấu trúc + công thức + ví dụ + bẫy + mẹo
- Ghi Câu sai + mức độ + xử lý lại
- Kho từ vựng Global Success 11 theo Unit
- Kho cấu trúc 10 Unit + chuyên đề English Course 11
- Bài tập theo Unit/Review
- Reading selection: tô đậm, dịch, thêm vào từ mới
- Listening 10 Unit, 6 blanks, nguồn audio gốc
- Ôn nhanh phần yếu
- Xóa optimistic UI + chặn click xoá trùng

## UI/UX v15
- Desktop: sidebar cố định, nhóm theo Tổng quan / Ghi & lưu / Luyện tập.
- Mobile: top bar + menu + bottom navigation 4 mục quan trọng.
- Dashboard ưu tiên 3 hành động: ghi bài, xử lý câu sai, ôn Unit/Listening.
- Không dùng FOMO giả (không có countdown/người đang xem). Với app tự học, trạng thái "còn X câu sai" là feedback thực tế và hữu ích hơn.
- WCAG-oriented: focus-visible, tương phản cao, vùng chạm >= 44px ở mobile, reduced-motion.
- Motion: cubic-bezier(.22,1,.36,1), khoảng 180–250ms cho feedback và chuyển trạng thái.


## Vocabulary expansion — v16
- Giữ nguyên 238 mục Glossary SGK.
- Thêm 184 mục mở rộng theo 10 Unit: từ/cụm xuất hiện trong nội dung sách + nhóm từ THPT.
- Thêm 95 gia đình từ:
  - 36 nhóm lấy từ Tệp 1.
  - 59 nhóm thông dụng B1–B2/THPT, tham chiếu Oxford 3000/5000 và British Council B1–B2.
- Từ trong kho được gắn nguồn: SGK Glossary / SGK cross-check / THPT mở rộng / Tệp 1.
- Thêm Word Family bank và Word Family Challenge 20 câu/lượt.
- Không thay đổi Firebase/Auth, Grammar, Exercises, Reading, Listening hay sidebar hiện có.
- Tệp 2 được rà soát toàn bộ 134 trang; phần mở rộng ưu tiên các từ/cụm xuất hiện trong nội dung Unit, Reading/Listening/Looking Back/Project và các nhóm từ hữu ích cho THPT.


## v17 — IELTS Self-study Roadmap
- Added `Lộ trình IELTS` tab based on the supplied `Lộ trình nền tảng.pdf` and `Lộ trình IELTS cơ bản.pdf`.
- IELTS Basic: 48-day plan with day-by-day focus, tasks, skill routing, checklist and completion progress.
- Foundation: 4-stage view of the 100-day foundation plan, kept separate from the IELTS 48-day track.
- Study workflow: Learn → Retrieval Practice → targeted practice → Distributed Review.
- Retrieval Exit Ticket: write at least 2 things learned, a short self-explanation, and the current gap.
- Distributed Review queue is generated after completion using short-to-long intervals (1, 3, 8, 16 days) as a web implementation of the source's distributed-practice principle; it is not claimed as an exact schedule from the PDF.
- Existing vocabulary, word-family, grammar, exercise, reading, listening, mistakes and Firebase features are preserved.
- Progress/log for the IELTS roadmap is stored locally on the device; existing personal notes remain in Firebase.
