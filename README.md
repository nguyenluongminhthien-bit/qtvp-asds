# 🏢 HỆ THỐNG QUẢN LÝ DỊCH VỤ HỖ TRỢ - THACO AUTO (ERP MINI)

## 1. TỔNG QUAN HỆ THỐNG
* **Mục tiêu:** Số hóa, chuẩn hóa và quản trị tập trung tổng thể Hành chính - Nhân sự - Tài sản - PCCC cho hệ thống Showroom/Đơn vị trên toàn quốc.
* **Mô hình kiến trúc:** JAMstack (Client-side React + Backend-as-a-Service Supabase).
* **Đặc tính cốt lõi:** Quản trị phân quyền theo dữ liệu phân cấp dạng cây (Hierarchy-based Access Control) kết hợp vai trò (Role-based Access Control).

## 2. CÔNG NGHỆ (TECH STACK)
* **Frontend:** React 18 (Vite), TypeScript (Strict Typing).
* **Styling & UI:** Tailwind CSS, Lucide React (Icons).
* **Backend & Database:** Supabase (PostgreSQL, Authentication JWT, Storage).
* **Xử lý Dữ liệu/Excel:** `xlsx` (SheetJS) - *Dự kiến tích hợp*.

---

## 3. CẤU TRÚC THƯ MỤC & CHỨC NĂNG (PROJECT STRUCTURE)

Dự án được tổ chức theo mô hình Feature-based kết hợp Layer-based. Dưới đây là sơ đồ chi tiết chức năng của từng file/thư mục lõi:

\`\`\`text
src/
├── components/           # (Thành Phần Giao Diện Dùng Chung)
│   ├── department/       # Modals xử lý riêng cho sơ đồ Tổ chức/Đơn vị (ATVSLĐ, PCCC...)
│   ├── ExpiryAlert.tsx   # Thanh cảnh báo hết hạn (Đăng kiểm, Bảo hiểm...)
│   ├── ExpiryBadge.tsx   # Nhãn trạng thái (Còn hạn/Hết hạn)
│   ├── Layout.tsx        # Bộ khung bọc ngoài các trang (chứa Header, Sidebar và Content)
│   ├── Sidebar.tsx       # Thanh menu điều hướng chính
│   └── SkeletonLoader.tsx# Hiệu ứng tải trang (Loading state)
│
├── contexts/             # (Quản Lý Trạng Thái Toàn Cục)
│   └── AuthContext.tsx   # Quản lý phiên đăng nhập. Nhiệm vụ cốt lõi: Giải mã `user_metadata` từ Supabase để trích xuất quyền (`quyen`) và mã đơn vị (`id_don_vi`).
│
├── pages/                # (Các Module Chức Năng Chính)
│   ├── AccountPage.tsx   # Quản lý tài khoản hệ thống, phân quyền (Admin/User), gán tài khoản thuộc đơn vị nào.
│   ├── AtvsldPage.tsx    # Quản lý An toàn Vệ sinh lao động.
│   ├── DashboardPage.tsx # Trang tổng quan thống kê (Charts, Metrics).
│   ├── DepartmentPage.tsx# Quản lý danh sách Cơ cấu tổ chức (Chi nhánh, Showroom, Đại lý) theo dạng cây.
│   ├── DocumentPage.tsx  # Module quản lý tài liệu lưu trữ, văn bản, tờ trình (Luân chuyển, hiệu lực).
│   ├── EquipmentPage.tsx # Quản lý Tài sản & Thiết bị Văn phòng (Cấp phát, Thu hồi, Báo hỏng).
│   ├── FireSafetyPage.tsx# Quản lý an toàn PCCC & An ninh bảo vệ (Thiết bị PCCC, Đội PCCC cơ sở, Hạn kiểm định).
│   ├── LoginPage.tsx     # Giao diện đăng nhập.
│   ├── LogPage.tsx       # Nhật ký hệ thống (Audit Trail) ghi vết thao tác người dùng.
│   ├── PersonnelPage.tsx # Quản lý Hồ sơ Nhân sự (Thông tin, Bằng cấp/Chứng chỉ, Thâm niên, Chốt nghỉ việc, Vào làm lại, Import).
│   ├── PolicyPage.tsx    # Quản lý Quy định, Quy trình & Văn bản (Theo dõi hiệu lực, Tích hợp link tài liệu gốc).
│   └── VehiclePage.tsx   # Quản lý Phương tiện & Xe cộ (Chi phí hoạt động, Cảnh báo hạn đăng kiểm/bảo hiểm).
│
├── services/             # (Giao Tiếp Cơ Sở Dữ Liệu)
│   └── api.ts            # Gateway duy nhất giao tiếp với Supabase. Chứa tất cả các hàm CRUD.
│
├── types/                # (Định Nghĩa Kiểu Dữ Liệu)
│   └── index.ts          # Interfaces/Types chuẩn hóa cho toàn dự án (TypeScript).
│
├── utils/                # (Hàm Tiện Ích Hỗ Trợ)
│   ├── exportExcel.ts    # Logic xuất dữ liệu ra file Excel.
│   ├── formatters.ts     # Format tiền tệ, số điện thoại, ngày tháng chuẩn VN.
│   ├── hierarchy.ts      # Thuật toán xử lý mảng Đơn vị thành cấu trúc Cây (Tree), tạo tiền tố thụt lề (│ ├──) và gán Emoji.
│   ├── logger.ts         # Ghi log hoạt động.
│   └── toast.ts          # Hiển thị thông báo popup (Success/Error).
│
├── App.tsx               # Cấu hình Routing (Chuyển trang).
├── index.css             # Định nghĩa CSS toàn cục & Custom scrollbar.
└── main.tsx              # Điểm khởi chạy của ứng dụng (Entry point).
\`\`\`

---

## 4. CƠ CHẾ PHÂN QUYỀN (AUTHORIZATION LOGIC) - ⚠️ RẤT QUAN TRỌNG

Hệ thống lọc dữ liệu hiển thị dựa trên sự kết hợp của 2 yếu tố:

### A. Định danh người dùng (Lấy từ Supabase)
Code không đọc bảng `users` thuần, mà đọc qua `user_metadata` trong JWT Token của Supabase.
* Quy tắc xác định: `const meta = userData.user_metadata;`

### B. Logic Cấp quyền Hiển thị Dữ liệu (Row-level Visibility)
1. **Quyền Toàn Hệ Thống (Master View):**
   * Chỉ kích hoạt khi Unit ID của user là `ALL`. Quản trị viên (Admin) của 1 đơn vị cụ thể chỉ được cấu hình nội bộ đơn vị đó, không có quyền xem Toàn quốc.
2. **Quyền Theo Đơn Vị Phân Cấp (Recursive Hierarchy):**
   * Nếu Unit ID là một mã cụ thể (VD: `DNB`), hệ thống sử dụng thuật toán đệ quy để tìm chính nó và **TẤT CẢ** các đơn vị con, cháu trực thuộc nó.
   * Để chống lỗi Database lưu nhầm Tên thay vì Mã, thuật toán đối chiếu và quy đổi 2 chiều giữa `id` và `ten_don_vi`.

### C. Logic Hiển Thị Menu (Cây Đơn Vị Bên Trái)
* **Nguyên tắc:** Nếu cấp quản lý (cha) của một đơn vị KHÔNG nằm trong quyền được xem của User, thì hệ thống tự động đẩy đơn vị con đó lên làm Đơn vị Gốc (Root) trên giao diện đối với User đó.

---

## 5. TÍNH NĂNG NỔI BẬT & QUY ƯỚC LẬP TRÌNH (CONVENTIONS)

* **Tự động hóa thông minh:**
  * Tự động sinh `Ngày nhận việc` từ `Mã Nhân viên`.
  * Import hàng loạt (Bulk Import) qua Clipboard (Copy Excel), tự động nhận diện cột và gán dữ liệu.
* **Xử lý Ảnh/File Đính kèm:** Sử dụng link chia sẻ Google Drive public. Code tự động bóc tách ID file qua hàm `getDirectImageLink` để render Thumbnail trực tiếp.
* **Format Dữ liệu:** * Số điện thoại: Chia block `4-3-3` (Ví dụ: `0901 234 567`).
  * Tiền tệ: Phân cách hàng nghìn bằng dấu cách (Ví dụ: `15 000 000`).
* **Quy tắc UI/UX nghiệp vụ:** * Thanh phân trang (Smart Pagination) cố định dưới đáy, bảng tự động cuộn độc lập.
  * Nhân sự "Đã nghỉ việc": Đẩy xuống cuối bảng, giảm độ sáng (`opacity-60`).
  * Chốt nghỉ việc (Offboarding): Hệ thống rà soát chéo CSDL Tài sản, nếu đang giữ tài sản cấp phát sẽ hiển thị cảnh báo đỏ chặn lại.

---

## 6. LỘ TRÌNH TÁI CẤU TRÚC VÀ MỞ RỘNG (SCALING STRATEGY)

Trong các phase tiếp theo, team dev cần ưu tiên xử lý các tác vụ refactor sau để chống "nợ kỹ thuật":
1. **Tách nhỏ Monolith API (`api.ts`):** Chia nhỏ thành thư mục `src/services/api/` (vd: `personnel.api.ts`, `document.api.ts`).
2. **Đóng gói UI Components:** Chuyển các phần giao diện lặp lại (Bảng, Thanh phân trang, Sidebar lọc đơn vị) thành các Reusable Components đặt tại `src/components/ui/`.

---

## 💡 PROMPT HƯỚNG DẪN KHI CHAT VỚI AI LẬP TRÌNH

Mỗi khi bắt đầu một phiên làm việc mới với AI, hãy thực hiện theo thứ tự sau để AI không bị mất bối cảnh:
1. Copy và gửi toàn bộ nội dung file `ARCHITECTURE.md` này kèm câu lệnh: *"Đây là bản đồ kiến trúc hệ thống của tôi, hãy đọc kỹ để nắm bối cảnh."*
2. Gửi (các) file `.tsx` hoặc `.ts` đang cần chỉnh sửa.
3. Nêu rõ vấn đề đang gặp phải (đính kèm mã lỗi nếu có) hoặc tính năng cần phát triển.