# English Notebook v17 — Teacher CMS

Bản này giữ Firebase project/config hiện tại và thêm CMS cho giáo viên.

## Luồng mới

Giáo viên → Dashboard → chọn module → nhập nội dung → Lưu/Đăng → Firestore → học sinh thấy nội dung đã xuất bản theo realtime listener.

### 1. Kiến thức
Collection: `knowledge`

Các trường chính:
- `title`
- `unit`
- `category`
- `content`
- `examples`
- `notes`
- `exercises`
- `author`, `authorName`
- `published`
- `createdAt`, `updatedAt`

### 2. Bài tập
Collection: `questionBank`

Giáo viên thêm câu bằng form, chọn dạng MCQ/2 lựa chọn/điền dạng đúng/viết lại. Câu đã xuất bản xuất hiện ở mục Bài tập giáo viên đăng.

### 3. Listening
Collection: `listeningContent`

Giáo viên nhập Unit, tiêu đề, audio URL, nguồn, 6 gợi ý, 6 đáp án và transcript. Nội dung đã xuất bản xuất hiện trong mục Listening giáo viên đăng.

### 4. Daily Set
Dashboard → Daily Set → chọn đúng 20 câu đã xuất bản từ `questionBank` → chọn Set 01–05 → xuất bản.

Set lưu câu hỏi kèm `sourceQuestionId`, nên có thể truy ngược câu trong ngân hàng.

## Firebase

Project hiện tại: `englishproject-c0131`

Deploy Rules:

```bash
firebase use englishproject-c0131
firebase deploy --only firestore:rules
```

Deploy web bằng GitHub/Vercel như workflow hiện tại.

## Lưu ý bảo mật

- Chỉ admin/giáo viên được ghi `knowledge`, `questionBank`, `listeningContent`, `sets`.
- Học sinh chỉ đọc nội dung đã `published`.
- Quyền admin vẫn dựa trên `config/admins` + tài khoản bootstrap hiện tại.
- Không cần Cloud Functions/Blaze cho CMS này.


## Teacher Knowledge fix
Published knowledge is mirrored to `knowledge_public`; students read only that public collection, while drafts remain in `knowledge`.
