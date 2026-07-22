# KIẾN TRÚC DỰ ÁN QTVP-ASDS

Dự án QTVP-ASDS (Quản trị Văn phòng & An sinh Đời sống) được xây dựng trên nền tảng React + Vite + TypeScript + Tailwind CSS + Supabase.

## 1. Cấu trúc thư mục chính
* `src/pages/`: Chứa các trang giao diện chính. Mỗi module là 1 file trang (ví dụ: `PersonnelPage.tsx`, `AtvsldPage.tsx`).
* `src/components/`: Chứa các component giao diện dùng chung hoặc theo module.
* `src/services/api/`: Lớp dịch vụ API giao tiếp với Supabase.
  * `client.ts`: Khởi tạo Supabase client.
  * `cache.ts`: Quản lý bộ đệm 2 lớp (In-Memory và LocalStorage) và cấu trúc dependencies xóa cache.
  * `modules.ts`: Chứa các hàm giao tiếp trực tiếp với các bảng dữ liệu trên Supabase.
  * `index.ts`: Gom nhóm các hàm API để export qua `apiService`.
* `src/types/`: Định nghĩa các kiểu dữ liệu TypeScript dùng chung.
* `src/utils/`: Chứa các helper functions (formatter, toast, hierarchy...).

---

## 2. Module Khóa Huấn luyện ATVSLĐ (Giai đoạn 1)

Module này được tích hợp trong trang Quản lý ATVSLĐ (`AtvsldPage.tsx`) dưới dạng 3 tab components riêng biệt:
1. **Hồ sơ Báo cáo Cơ sở (`HoSoTab.tsx`)**:
   * Hiển thị báo cáo ATVSLĐ của các đơn vị.
   * Số liệu về thời gian huấn luyện và số lượng nhân sự hoàn thành theo từng nhóm (1-6) được tính toán hoàn toàn tự động từ bảng dữ liệu khóa học và học viên thay vì nhập tay.
2. **Kế hoạch Đào tạo đợt tới (`KeHoachTab.tsx`)**:
   * Quét và phân loại nhân sự thuộc các diện cần đào tạo: Chưa học, Quá hạn, Sắp hết hạn (dưới 60 ngày), An toàn.
   * Hỗ trợ xuất danh sách Excel theo đúng định dạng.
3. **Khóa học Huấn luyện (`KhoaHocTab.tsx`)**:
   * Quản lý thông tin các khóa học huấn luyện ATVSLĐ.
   * Hỗ trợ nhập danh sách học viên trực tiếp bằng cách copy-paste từ bảng Excel qua `PasteImportModal.tsx`.
   * **Đồng bộ ngược nền (Background Batch Sync)**: Tự động chạy nền để cập nhật thông tin chứng chỉ về hồ sơ nhân sự (`ns_dich_vu`) đối với những học viên đạt yêu cầu, chạy song song theo lô (batch size = 15) giúp tối ưu hiệu năng.

### Các bảng Supabase sử dụng:
* `dm_chu_ky_atvsld`: Danh mục chu kỳ hiệu lực chứng chỉ theo từng Nhóm (Nhóm 1, 2 = 24 tháng; còn lại = 12 tháng).
* `hs_khoa_huan_luyen`: Chứa thông tin tổng quan của các đợt/khóa huấn luyện.
* `hs_hoc_vien_khoa_huan_luyen`: Chứa chi tiết học viên tham gia khóa học và kết quả.
* `ns_dich_vu`: Tái sử dụng các trường ATVSLĐ có sẵn để lưu kết quả đồng bộ (`cc_atvsld`, `nhom_doi_tuong`, `huan_luyen_tu`, `huan_luyen_den`, `gia_tri_den`, `chung_nhan`).

---

## 3. Module Thiết bị Nghiêm ngặt về ATLĐ (Giai đoạn 2)

Module này được tích hợp làm một tab lớn cấp 1 độc lập (`StrictEquipmentTab.tsx`) bên trong trang quản lý chung `AtvsldPage.tsx`.

### 3.1. Các Tab lớn cấp 1 và Sub-tabs cấp 2 mới
Trang `AtvsldPage.tsx` hiện tại quản lý tập trung 4 phân hệ chính:
1. **Hồ sơ Báo cáo Cơ sở (`HoSoTab.tsx`)**:
   * Hiển thị tình hình báo cáo ATVSLĐ của showroom.
   * Số liệu thiết bị nghiêm ngặt và quá hạn kiểm định được tính toán **hoàn toàn tự động** từ database thay vì nhập tay.
   * **Drill-down**: Người dùng có thể click trực tiếp vào số lượng thiết bị của cơ sở để điều hướng ngay sang phân hệ thiết bị nghiêm ngặt.
2. **Đào tạo ATVSLĐ**:
   * Phân chia thành 2 sub-tabs: **Kế hoạch đào tạo đợt tới (`KeHoachTab.tsx`)** và **Khóa học huấn luyện (`KhoaHocTab.tsx`)**.
3. **Thiết bị yêu cầu nghiêm ngặt (`StrictEquipmentTab.tsx`)**:
   * Quản lý danh sách thiết bị có yêu cầu nghiêm ngặt về an toàn lao động và lịch sử/nhật ký kiểm định của chúng.
   * Cho phép import hàng loạt nhật ký kiểm định từ file Excel thông qua `PasteImportModal.tsx`, tự động đối chiếu theo số serial/mã thiết bị để tránh ghi đè hoặc nhân bản thông tin thiết bị master.
   * Hệ thống cảnh báo thời hạn kiểm định qua các badge màu đồng bộ: Đỏ (Quá hạn), Cam (Gấp - dưới 30 ngày), Lime (Cảnh báo - dưới 60 ngày), và Xanh lá (An toàn).
4. **Khám sức khỏe**:
   * Phân hệ quản lý y tế và bệnh nghề nghiệp (sẽ phát triển ở giai đoạn sau).

### Các bảng Supabase sử dụng:
* `ts_thiet_bi_nghiem_ngat`: Chứa thông tin master của thiết bị yêu cầu nghiêm ngặt (tên, serial, mã thiết bị, mã chế tạo, showroom sở hữu, địa điểm lắp đặt, tình trạng).
* `nk_kiem_dinh_tbnn`: Nhật ký/Lịch sử kiểm định đi kèm của từng thiết bị master (ngày kiểm định, hạn kiểm định, người ký, giá thành, đơn vị hỗ trợ, link biên bản PDF).
