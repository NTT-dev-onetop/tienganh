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
