# 🏢 HỆ THỐNG QUẢN LÝ DỊCH VỤ HỖ TRỢ - THACO AUTO (ERP MINI)

## 1. TỔNG QUAN HỆ THỐNG
* **Mục tiêu:** Số hóa, chuẩn hóa và quản trị tập trung tổng thể Hành chính - Nhân sự - Tài sản - PCCC cho hệ thống Showroom/Đơn vị trên toàn quốc.
* **Mô hình kiến trúc:** JAMstack (Client-side React + Backend-as-a-Service Supabase).
* **Đặc tính cốt lược:** Quản trị phân quyền theo dữ liệu phân cấp dạng cây (Hierarchy-based Access Control) kết hợp vai trò (Role-based Access Control).

## 2. CÔNG NGHỆ (TECH STACK)
* **Frontend:** React 18 (Vite), TypeScript (Strict Typing).
* **Styling & UI:** Vanilla CSS (Tailwind CSS v3, Lucide React Icons).
* **Backend & Database:** Supabase (PostgreSQL RLS, Authentication JWT, Storage).
* **Xử lý Dữ liệu/Excel:** `xlsx` (SheetJS) hỗ trợ xuất báo cáo & import dữ liệu.

---

## 3. CẤU TRÚC THƯ MỤC & CHỨC NĂNG (PROJECT STRUCTURE)

Dự án được tổ chức theo mô hình **Feature-based** kết hợp **Layer-based** nhằm tối ưu hóa khả năng mở rộng. Dưới đây là sơ đồ thư mục thu gọn và mô tả chức năng chi tiết:

### 📂 Sơ đồ thư mục tổng quan
```text
src/
├── components/       # Các thành phần UI dùng chung & Modals nghiệp vụ
├── constants/        # Hằng số toàn hệ thống (Chứng chỉ, cấu hình...)
├── contexts/         # Quản lý State toàn cục (Authentication...)
├── hooks/            # Custom React Hooks dùng chung (Phân quyền...)
├── pages/            # Các trang tính năng chính (Dashboard, Personnel, Document...)
├── services/         # Tương tác Cơ sở dữ liệu (Supabase API Gateway)
├── types/            # Định nghĩa kiểu dữ liệu TypeScript
└── utils/            # Thư viện hàm tiện ích hỗ trợ (Formatters, Hierarchy...)
```

### 📋 Chi tiết chức năng từng phân vùng

| Phân mục lõi | Thư mục con / File khóa | Vai trò & Chức năng nghiệp vụ |
| :--- | :--- | :--- |
| **`components/`** <br>*(Giao diện dùng chung)* | `dashboard/` | Chứa các widgets Dashboard được modul hóa: `PersonnelDoughnutChart` (Biểu đồ cơ cấu), `ExpiryAlertPanel` (Cảnh báo hết hạn), `KpiSection` (Thẻ KPI). |
| | `department/`, `personnel/` | Modals nghiệp vụ quản trị sơ đồ tổ chức, cơ cấu phòng ban và hồ sơ nhân viên. |
| | `ui/` | Các component nguyên tử dùng chung: `CustomAutocomplete`, `Pagination`, `UnitFilterSidebar`. |
| **`constants/`** <br>*(Hằng số)* | `certificates.ts` | Quy hoạch danh sách chứng chỉ nghiệp vụ (PCCC, ATVSLĐ...) dùng chung làm nguồn dữ liệu chuẩn duy nhất (Single Source of Truth). |
| **`contexts/`** <br>*(State toàn cục)* | `AuthContext.tsx` | Quản lý phiên đăng nhập và phân quyền truy cập thông qua giải mã token JWT. |
| **`hooks/`** <br>*(Custom Hooks)* | `useAllowedUnits.ts` | Tính toán và phân quyền phạm vi truy cập danh sách Đơn vị đệ quy (Allowed Unit IDs). |
| **`pages/`** <br>*(Trang tính năng)* | *Các Module chính* | Đại diện cho các màn hình nghiệp vụ độc lập: `DashboardPage`, `PersonnelPage` (Nhân sự), `DocumentPage` (Văn bản), `VehiclePage` (Xe cộ), `FireSafetyPage` (PCCC), `EquipmentPage` (Thiết bị), `LogPage` (Nhật ký). |
| **`services/`** <br>*(Data Gateway)* | `api.ts` | Cổng kết nối duy nhất tương tác và thực hiện các tác vụ CRUD với cơ sở dữ liệu Supabase. |
| **`utils/`** <br>*(Hàm tiện ích)* | `hierarchy.ts`, `formatters.ts` | Xử lý cấu trúc cây đơn vị (`getAllSubordinateIds`), định dạng ngày tháng (`normalizeDateToISO`), số điện thoại, tiền tệ chuẩn hóa. |

---

## 4. CƠ CHẾ PHÂN QUYỀN (AUTHORIZATION LOGIC) - ⚠️ RẤT QUAN TRỌ

Hệ thống lọc dữ liệu hiển thị dựa trên sự kết hợp của 2 yếu tố:

### A. Định danh người dùng (Lấy từ Supabase)
Code không đọc bảng `users` thuần, mà đọc qua `user_metadata` trong JWT Token của Supabase.
* Quy tắc xác định: `const meta = userData.user_metadata;`

### B. Logic Cấp quyền Hiển thị Dữ liệu (Row-level Visibility)
1. **Quyền Toàn Hệ Thống (Master View):**
   * Chỉ kích hoạt khi Unit ID của user là `ALL`. Quản trị viên (Admin) của 1 đơn vị cụ thể chỉ được cấu hình nội bộ đơn vị đó, không có quyền xem Toàn quốc.
2. **Quyền Theo Đơn Vị Phân Cấp (Recursive Hierarchy - sử dụng `useAllowedUnits`):**
   * Lấy quyền truy cập qua Hook dùng chung `useAllowedUnits`. Hệ thống sử dụng thuật toán đệ quy `getAllSubordinateIds` để tìm chính nó và **TẤT CẢ** các đơn vị con, cháu trực thuộc nó.
3. **Phân quyền Module "Viewer Hạn chế":**
   * Đối với tài khoản cấp độ thao tác (Viewer hạn chế), menu và quyền truy cập module được quản lý chặt chẽ. Nếu tài khoản chỉ được cấp quyền xem một số Module (ví dụ: *Văn bản - Thông báo*), các module khác bao gồm cả Tổng quan (Dashboard) sẽ bị ẩn hoàn toàn để bảo mật thông tin.

---

## 5. TÍNH NĂNG NỔI BẬT & QUY ƯỚC LẬP TRÌNH (CONVENTIONS)

* **Tìm kiếm Tiếng Việt Thông minh (Accent-Insensitive Search):**
  * Hỗ trợ tìm kiếm linh hoạt trên toàn bộ ô tìm kiếm của ứng dụng: Tìm kiếm theo kiểu **không bỏ dấu** hoặc **có bỏ dấu** đều được, giúp người dùng dễ dàng định vị bản ghi chính xác.
* **Bộ lọc Nâng cao gợi ý tự động (Autocomplete Filter):**
  * Tại các bộ lọc nâng cao của các module, người dùng có thể tự do gõ và hiển thị danh sách gợi ý tự động dựa trên dữ liệu đang có (sử dụng component `CustomAutocomplete`).
* **Liên kết dữ liệu & Auto-fill thông minh:**
  * **Hồ sơ nhân sự:** Tự động sinh `Ngày nhận việc` từ `Mã Nhân viên`. Import hàng loạt qua Clipboard (Excel).
  * **Hành chính - Văn bản (Cấp số):** Tại mục Theo dõi xử lý & Thông tin phụ trợ (bố cục Dòng 2 chia tỷ lệ **20 - 40 - 40** cho MSNV - Người lấy số - Bộ phận lấy số). Khi người dùng nhập/chọn MSNV, hệ thống tự động đối chiếu thông tin nhân sự để lấy **Họ tên** và **Bộ phận làm việc** để điền tự động.
* **Nhật ký hệ thống chi tiết (Audit Trail):**
  * Trang Nhật ký hệ thống (Log) bổ sung cột **Họ tên** trực tiếp sau cột Tài khoản. Cột này tự động lưu và đối chiếu dữ liệu tên nhân viên từ bảng tài khoản sang bảng `sys_logs` (Supabase).
* **Format Dữ liệu chuẩn VN:**
  * Số điện thoại: Chia block `4-3-3` (Ví dụ: `0901 234 567`).
  * Tiền tệ: Phân cách hàng nghìn bằng dấu cách (Ví dụ: `15 000 000`).

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