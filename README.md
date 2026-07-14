# 🏢 HỆ THỐNG QUẢN LÝ DỊCH VỤ HỖ TRỢ - THACO AUTO (ERP MINI)

Tài liệu này tổng hợp toàn bộ thông tin kiến trúc, quy định nghiệp vụ cốt lõi, cơ chế phân quyền, quy chuẩn kỹ thuật và hướng dẫn vận hành của hệ thống **Quản lý Dịch vụ Hỗ trợ - THACO AUTO**.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ (SYSTEM OVERVIEW & TECH STACK)

### 1.1. Mục tiêu & Kiến trúc
* **Mục tiêu:** Số hóa, chuẩn hóa và quản trị tập trung tổng thể Hành chính - Nhân sự - Tài sản - PCCC - ATVSLĐ cho hệ thống Đơn vị / Showroom / Điểm bán hàng trên toàn quốc.
* **Mô hình kiến trúc:** JAMstack (Client-side React + Backend-as-a-Service Supabase).
* **Đặc tính cốt lõi:** Quản trị phân quyền theo dữ liệu phân cấp dạng cây (Hierarchy-based Access Control) kết hợp vai trò (Role-based Access Control).

### 1.2. Công nghệ sử dụng (Tech Stack)
* **Frontend:** React 18 (Vite), TypeScript (Strict Typing).
* **Styling & UI:** Vanilla CSS, Tailwind CSS v3, Lucide React Icons.
* **Backend & Database:** Supabase (PostgreSQL RLS, Authentication JWT, Storage).
* **Xử lý Dữ liệu/Excel:** `xlsx` (SheetJS) hỗ trợ xuất báo cáo & import dữ liệu hàng loạt.

---

## 2. CẤU TRÚC THƯ MỤC & PHÂN VÙNG CHỨC NĂNG (PROJECT STRUCTURE)

Dự án được tổ chức theo mô hình **Feature-based** kết hợp **Layer-based** nhằm tối ưu hóa khả năng bảo trì và mở rộng:

```text
src/
├── components/       # Các thành phần UI dùng chung & Modals nghiệp vụ
├── constants/        # Hằng số toàn hệ thống (Chứng chỉ, mẫu báo cáo, cấu hình...)
├── contexts/         # Quản lý State toàn cục (Authentication...)
├── hooks/            # Custom React Hooks dùng chung (Phân quyền, tính toán cây đơn vị...)
├── pages/            # Các trang tính năng chính (Dashboard, Personnel, Document, Report...)
├── services/         # Tương tác Cơ sở dữ liệu (Supabase API Gateway)
├── types/            # Định nghĩa kiểu dữ liệu TypeScript
└── utils/            # Thư viện hàm tiện ích hỗ trợ (Formatters, Hierarchy...)
```

### Chi tiết chức năng từng phân vùng:
| Phân mục lõi | Thư mục con / File khóa | Vai trò & Chức năng nghiệp vụ |
| :--- | :--- | :--- |
| **`components/`** | `dashboard/` | Chứa các widgets Dashboard được modul hóa: `PersonnelDoughnutChart`, `ExpiryAlertPanel`, `KpiSection`. |
| | `report/` | Bộ lọc cấu hình báo cáo động `ReportFilterBar`, bảng xem trước `ReportPreviewTable`, trình tạo mẫu báo cáo. |
| | `department/`, `personnel/` | Modals nghiệp vụ quản trị sơ đồ tổ chức, cơ cấu phòng ban và hồ sơ nhân viên. |
| | `ui/` | Các component nguyên tử dùng chung: `CustomAutocomplete`, `Pagination`, `UnitFilterSidebar`. |
| **`constants/`** | `certificates.ts`, `reportTemplates.ts` | Quy hoạch danh sách chứng chỉ nghiệp vụ và cấu hình các mẫu báo cáo chuẩn hệ thống. |
| **`contexts/`** | `AuthContext.tsx` | Quản lý phiên đăng nhập và phân quyền truy cập thông qua giải mã token JWT (`user_metadata`). |
| **`hooks/`** | `useAllowedUnits.ts` | Tính toán phạm vi truy cập danh sách Đơn vị đệ quy (`Allowed Unit IDs`). |
| **`pages/`** | *Các Module chính* | Màn hình nghiệp vụ: `DashboardPage`, `PersonnelPage`, `DocumentPage`, `ReportPage`, `AccountPage`, `LogPage`... |
| **`services/`** | `api.ts` | Cổng kết nối duy nhất tương tác và thực hiện các tác vụ CRUD với cơ sở dữ liệu Supabase. |
| **`utils/`** | `hierarchy.ts`, `formatters.ts` | Xử lý cấu trúc cây đơn vị (`getAllSubordinateIds`), định dạng ngày tháng, số điện thoại, tiền tệ chuẩn hóa. |

---

## 3. CƠ CHẾ PHÂN QUYỀN TRUY CẬP & THAO TÁC (AUTHORIZATION & PERMISSION MODEL)

Hệ thống kiểm soát hiển thị và tác vụ dựa trên định danh người dùng từ token JWT (`user_metadata`) kết hợp với cây đơn vị đệ quy (`useAllowedUnits`).

### 3.1. Quản trị Toàn quốc (HO Admin / Master View)
* **Định danh:** Tài khoản có quyền `ADMIN` và `id_don_vi` thuộc nhóm `ALL`, `HO`, `DV_HO` hoặc cấp Quản trị Toàn quốc.
* **Quyền hạn:**
  * Xem và quản lý toàn bộ dữ liệu trên toàn hệ thống (Tất cả Đơn vị, Showroom, Điểm bán hàng).
  * Toàn quyền Ban hành, Sửa, Xóa mọi Văn bản - Thông báo.
  * Truy cập đầy đủ nhóm **Hệ thống** trên Sidebar: **Báo cáo**, **Tài khoản**, **Nhật ký Log**.

### 3.2. Tài khoản cấp Đơn vị (Unit Account / Unit Admin / User)

#### A. Phân hệ Văn bản - Thông báo (`DocumentPage.tsx`)
* **Quyền xem:** Xem được văn bản do Đơn vị mình ban hành, các Đơn vị trực thuộc cấp dưới ban hành, và các văn bản có Phạm vi áp dụng `*` (Toàn hệ thống).
* **Quyền Sửa / Xóa (`canEditOrDeleteDocument`):**
  * **Chỉ được Sửa / Xóa** các văn bản do **chính Đơn vị mình** ban hành (`document.id_don_vi === user.id_don_vi`).
  * **CẤM Sửa / Xóa** đối với các văn bản do HO ban hành (Phạm vi `*`) hoặc văn bản thuộc Đơn vị khác (luôn hiển thị ở chế độ Read-Only).

#### B. Phân hệ Báo cáo Tổng hợp (`ReportPage.tsx` & Module `BaoCao`)
* **Cấp quyền theo Module:** Quản lý trong form **Cập nhật tài khoản -> Phân quyền Module (Thanh Menu)** với checkbox **📑 Báo cáo Tổng hợp (`BaoCao`)**. Khi được cấp quyền, mục Báo cáo sẽ hiển thị trên Sidebar.
* **Phạm vi dữ liệu:** Tự động giới hạn dữ liệu báo cáo trong phạm vi Đơn vị của tài khoản và các Đơn vị trực thuộc cấp dưới.
* **3 Mẫu Báo cáo chuẩn thuộc nhóm HỆ THỐNG:**
  1. **Tổng hợp thông tin liên hệ Đơn vị (`system_donvi_structure`):**
     * **Chọn Đơn vị (`unit_multi`):** Hiển thị danh sách các Đơn vị cấp cha (`THACO AUTO`, `Phân Phối THACO AUTO`, Tổng công ty, Công ty Tỉnh thành...), tự động lọc bỏ Showroom/Điểm bán hàng để dropdown gọn gàng đúng chuẩn.
     * **Chọn loại hình (`multiselect`):** Giao diện dạng ô tick (checkbox đa chọn), chỉ chắt lọc hiển thị 3 loại hình chính: **Văn phòng**, **Công ty Tỉnh thành**, **Showroom** (tự động ẩn các loại hình phụ khác).
  2. **Báo cáo Thông tin pháp nhân theo Quản trị (`system_donvi_billing`):** Tổng hợp mã số thuế, tên pháp nhân, địa chỉ xuất hóa đơn.
  3. **Báo cáo Khảo sát An ninh Bảo vệ (`system_security_report`):**
     * Cho phép xem trước tổng quan cơ sở vật chất, diện tích, quy mô, số cổng, hệ thống camera trên giao diện Web.
     * Khi xuất Excel, tự động sinh từng Worksheet ứng với từng Đơn vị/Showroom theo đúng định dạng khảo sát AN-BV chuẩn 13 mục chi tiết.

#### C. Phân hệ Tổng quan (`DashboardPage.tsx`)
* **Phạm vi số liệu & cảnh báo:** Tài khoản Đơn vị chỉ nhìn thấy các chỉ số KPI, thống kê nhân sự, và **Cảnh báo hạn kiểm định / chứng chỉ / PCCC / ATVSLĐ** của **Đơn vị mình và các Showroom/Điểm bán hàng trực thuộc** (`currentSubordinateIds`).
* Không hiển thị cảnh báo toàn hệ thống của các Đơn vị khác ngoài phạm vi quản lý.

#### D. Phân hệ Quản lý Tài khoản (`AccountPage.tsx`)
* **Quyền xem (`visibleAccounts`):** Luôn xem được tài khoản của chính mình và danh sách tài khoản thuộc các đơn vị trực thuộc cấp dưới.
* **Quyền Cấp mới / Cập nhật:**
  * Khi cấp mới tài khoản: Danh sách *Đơn vị quản lý* bị giới hạn trong nhánh trực thuộc, không thể nâng quyền lên HO Admin.
  * Khi tự cập nhật tài khoản chính mình: Được phép sửa họ tên và đổi mật khẩu; các trường *Đơn vị quản lý* và *Cấp độ thao tác* tự động bị khóa (`disabled`).

---

## 4. QUY CHUẨN NGHIỆP VỤ & HIỂN THỊ DỮ LIỆU (UX/UI CONVENTIONS)

1. **Dữ liệu thực tế (Data-Driven Filtering):**
   * Các bộ lọc như **Năm ban hành**, **Đơn vị ban hành**, **Loại văn bản** được tự động quét và khởi tạo từ dữ liệu thực tế hiện có trong database, không hiển thị cứng các giá trị rỗng hoặc không tồn tại.
2. **Chuẩn hóa nhãn "Chọn tất cả":**
   * Khi bộ lọc cho phép chọn nhiều đối tượng (Checkbox multi-select), nhãn chọn tất cả tuân thủ định dạng chuẩn:
     ```text
     Chọn tất cả (<số_lượng>) <theo_chủ_thể>
     ```
     *Ví dụ: `Chọn tất cả (10) năm`, `Chọn tất cả (21) Đơn vị`.*
3. **Bộ lọc Đơn vị ban hành:**
   * Ưu tiên hiển thị danh sách **Công ty mẹ / Đơn vị chính**, không hiển thị tràn lan các Showroom hay Kho con không có chức năng ban hành văn bản độc lập.
4. **Tìm kiếm Tiếng Việt thông minh (Accent-Insensitive Search):**
   * Hỗ trợ tìm kiếm linh hoạt trên toàn bộ hệ thống: gõ **có dấu** hoặc **không dấu** đều định vị chính xác bản ghi.
5. **Auto-fill & Liên kết thông minh:**
   * **Hồ sơ nhân sự:** Tự động sinh `Ngày nhận việc` từ `Mã Nhân viên`. Hỗ trợ import Excel qua Clipboard.
   * **Văn bản - Thông báo:** Dòng thông tin phụ trợ chia tỷ lệ chuẩn **20% - 40% - 40%** (MSNV - Người lấy số - Bộ phận lấy số). Nhập/chọn MSNV tự động điền Họ tên và Bộ phận làm việc.
6. **Định dạng dữ liệu chuẩn Việt Nam:**
   * **Số điện thoại:** Block `4-3-3` (Ví dụ: `0901 234 567`).
   * **Tiền tệ:** Phân cách hàng nghìn bằng dấu cách (Ví dụ: `15 000 000`).

---

## 5. QUY CHUẨN KỸ THUẬT & AN TOÀN LẬP TRÌNH REACT (DEVELOPMENT STANDARDS)

* **Chống lặp vô hạn (Infinite Recursion Protection):**
  * Khi duyệt cây phân cấp Đơn vị (`getAllSubordinateIds`, `renderUnitTree`), luôn sử dụng `Set<string>` để kiểm tra các node đã thăm (`visited`) và giới hạn độ sâu đệ quy (`maxDepth = 20`) để ngăn chặn treo trình duyệt khi cấu trúc cha-con bị lặp vòng.
* **Hooks React & Memoization:**
  * Luôn memoize các bộ lọc và dữ liệu phái sinh bằng `useMemo` và `useCallback`, import chuẩn xác từ `'react'`.
* **So sánh ID chuẩn hóa:**
  * Sử dụng `String(id).trim()` trong toàn bộ các phép so sánh ID giữa Đơn vị và Tài khoản để loại bỏ lỗi bất đồng bộ giữa kiểu số (`number`) và chuỗi (`string`).

---

## 6. HƯỚNG DẪN SỬ DỤNG HỆ THỐNG CHO NGƯỜI DÙNG (USER MANUAL)

1. **Đăng nhập & Điều hướng:**
   * Sử dụng tài khoản được cấp để đăng nhập. Hệ thống tự động nhận diện cấp quyền và hiển thị các menu tương ứng trên Sidebar bên trái.
2. **Khai thác module Văn bản - Thông báo:**
   * Tải lên văn bản mới kèm số văn bản tự động hoặc nhập thủ công.
   * Lọc nhanh theo đơn vị ban hành, năm ban hành hoặc từ khóa.
3. **Khai thác module Báo cáo Tổng hợp:**
   * Vào **Hệ thống -> Báo cáo**, chọn mẫu báo cáo mong muốn (ví dụ: *Tổng hợp thông tin liên hệ Đơn vị*).
   * Tích chọn bộ lọc **Chọn Đơn vị** hoặc **Chọn loại hình** (Văn phòng, Công ty Tỉnh thành, Showroom), sau đó nhấn **Xem trước** hoặc **Xuất Excel**.
4. **Khai thác module Tổng quan & Cảnh báo:**
   * Theo dõi các thẻ KPI và danh sách cảnh báo chứng chỉ/thiết bị sắp hết hạn trực tiếp trên màn hình chính.

---

## 7. HƯỚNG DẪN DÀNH CHO AI / LẬP TRÌNH VIÊN (DEVELOPER / AI INSTRUCTIONS)

Mỗi khi bắt đầu một phiên phát triển mới với AI Coding Assistant, hãy thực hiện theo thứ tự sau:
1. Gửi toàn bộ nội dung file `README.md` này kèm lời nhắc: *"Đây là bản đồ kiến trúc và quy chuẩn hệ thống ERP MINI, hãy đọc kỹ trước khi coding."*
2. Cung cấp file `.tsx` / `.ts` cần thao tác cùng mô tả rõ ràng yêu cầu nghiệp vụ.