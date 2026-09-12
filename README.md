# English Notebook v17

Firebase project: `englishproject-c0131`

## Build
- Vanilla JS ES Modules
- Firebase 10.12.5
- Bootstrap 5.3.3 + Bootstrap Icons
- No build step / no extra library

## First-time Firebase setup
1. Firestore: create `config/admins` with `{ emails: ["GMAIL_CUA_THAY"] }`.
2. Deploy `firestore.rules`.
3. Admin login once. Dashboard appears automatically.
4. Dashboard → Roster: nhập đúng 46 tên, mỗi dòng một tên.
5. Dashboard → Daily Sets → `Tạo 5 Set mẫu từ ngân hàng`.

## Data
- `users/{uid}`: hồ sơ + role + streak.
- `users_by_roster/{rosterId}`: khóa một tên với một UID.
- `sets/{setId}`: 5 Daily Set, mỗi set 20 câu.
- `submissions/{uid_date_setId}`: mỗi học sinh chỉ có một submission cho một set trong một ngày.
- `config/admins`: danh sách admin.
- `config/roster`: 46 tên lớp.

## Đổi Gmail admin
Sửa mảng `emails` trong `config/admins` bằng Firestore Console. Whitelist `ADMIN_EMAILS` trong `roles.js` chỉ là fallback khẩn cấp.

## Chống nhiều Gmail
Roster binding khóa `rosterId` vào UID. Nếu học sinh đổi Gmail, admin xóa mapping `users_by_roster/{rosterId}` rồi học sinh đăng nhập Gmail mới và chọn lại tên.

## Lưu ý bảo mật
Phase 6 chỉ làm khó client-side. Đáp án và điểm vẫn có thể bị phân tích trong trình duyệt; muốn chống gian lận nghiêm túc phải chuyển chấm điểm/signature sang backend đáng tin cậy.
