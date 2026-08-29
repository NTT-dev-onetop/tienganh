# English Notebook — Personal Learning Workflow

Phiên bản này được đổi hướng từ một app SRS/quiz chung sang **sổ tiếng Anh cá nhân sau giờ học thêm**.

## Luồng chính
1. Sau giờ học: `＋ Ghi bài`.
2. Từ mới: lưu nghĩa, từ loại, phát âm, word family, V1/V2/V3, bị động/V3, cấu trúc và ví dụ.
3. Cấu trúc: lưu công thức + ví dụ + lỗi dễ sai + mẹo nhớ.
4. Câu sai: chép câu ngắn, đáp án đúng, vì sao sai, quy tắc; đánh mức độ.
5. `Sổ câu sai`: xử lý từng lỗi, đánh dấu đã hiểu khi bạn chắc chắn.
6. `Ôn nhanh`: hệ thống chỉ đưa những thứ bạn đã ghi vào một hàng ôn nhỏ, không ép học toàn bộ.

## Ví dụ lớp 11 đã tính đến
- `start + to V / V-ing`
- `need + to V`
- `need + V-ing` (cách dùng mang nghĩa cần được làm)
- `be + V3` (bị động)
- V1 / V2 / V3 của động từ bất quy tắc
- word family / biến thể từ

## Firebase
Giữ nguyên `firebase-config.js` của project hiện tại.

Firestore path:
`users/{uid}/english_notes/{noteId}`

Mỗi note có `type`: `vocab`, `grammar`, hoặc `mistakes`.

## Security Rules
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
