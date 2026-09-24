# 📑 ARCHITECTURE.md — BẢN ĐỒ HỆ THỐNG QTVP-ASDS (dành cho AI & Developers)

> File này được dựng lại bằng cách quét trực tiếp toàn bộ 100% mã nguồn thật trong repo (không suy đoán từ tên file). Nguồn xác thực: export chính của từng file + tên bảng Supabase thực sự được gọi (`services/api/modules.ts`, `apiService.save(...)`).
> **Quy tắc bắt buộc:** Mỗi khi thêm/sửa 1 tính năng hoặc file mới, PHẢI cập nhật các bảng mục 3, 4 và danh mục file mục 7 trong cùng lần commit.

---

## 1. TỔNG QUAN

- **Kiến trúc:** JAMstack — React 19 (Vite 6, TS strict) + Supabase (PostgreSQL, REST trực tiếp qua `fetch`, KHÔNG dùng Supabase JS client).
- **Chế độ vận hành:** `API_MODE` ở `services/api/client.ts` chọn `'SUPABASE'` hoặc `'MOCK'` (fallback đọc `localStorage` qua `services/api/localStore.ts` khi mất kết nối).
- **Phân quyền:** Kết hợp Role (`ADMIN` / `viewer_hanche` / `USER`) + phân cấp đơn vị (`id_don_vi` hỗ trợ đa đơn vị ngăn cách bằng dấu phẩy) + Ma trận quyền chi tiết (`quyen_chi_tiet`) cho từng phân hệ.

---

## 2. CẤU TRÚC THƯ MỤC THẬT (đã xác minh 100% từng file)

```text
src/
├── App.tsx                              # Router nội bộ theo activeTab, Deep link QR/cphc, TabContainer cache
├── main.tsx                             # Entry point ứng dụng
├── index.css                            # CSS toàn cục Tailwind v4
├── vite-env.d.ts
├── contexts/
│   └── AuthContext.tsx                  # AuthProvider, useAuth(), checkPermission(), validate phiên đăng nhập
├── hooks/
│   ├── useAllowedUnits.ts                # Tính danh sách đơn vị user được phép truy cập
│   └── useDebounce.ts                    # Hook debounce tìm kiếm
├── types/
│   ├── index.ts                         # Interface dữ liệu toàn hệ thống (Personnel, DonVi, TS_Xe, DNTT...)
│   ├── cost.ts                          # Re-export & kiểu dữ liệu chi phí
│   └── xlsx.d.ts                        # Khai báo kiểu dữ liệu thư viện Excel
├── constants/
│   ├── certificates.ts                  # Danh mục chứng chỉ chuẩn
│   └── reportTemplates.ts               # Danh mục cấu hình mẫu báo cáo cho ReportPage
├── services/
│   ├── api.ts                           # Re-export apiService (entry point duy nhất pages dùng)
│   ├── googleDrive.ts                   # Service tìm kiếm Google Drive API v3 (Số khung xe, Số hiệu văn bản)
│   └── api/
│       ├── client.ts                    # SUPABASE_URL, ANON_KEY, HEADERS, API_MODE
│       ├── cache.ts                     # Smart Two-Layer Cache, Parallel Batch Fetching, CACHE_DEPENDENCIES
│       ├── modules.ts                   # Toàn bộ hàm getX(), save(), deleteRecord(), chotKyChiPhi(), checkUnitPermission()
│       ├── auth.ts                      # setCurrentUser, quản lý phiên đăng nhập
│       ├── logs.ts                      # writeLog() ghi Audit log
│       ├── localStore.ts                # CRUD giả lập khi ở chế độ MOCK/offline
│       └── mockData.ts                  # Dữ liệu mẫu cho chế độ MOCK
├── utils/
│   ├── hierarchy.ts                     # Cây đơn vị đệ quy, getAllSubordinateIds(), getDefaultUnitId(), isCostManagementUnit()
│   ├── formatters.ts                    # formatCurrency, formatPhoneNumber, cleanTechnicalString, formatMemorySize
│   ├── expiryStatus.ts                  # Tính trạng thái hạn (CẢNH BÁO / QUÁ HẠN / AN TOÀN)
│   ├── atvsld.ts                        # getChungNhanByNhom(), calcGiaTriDen() — công thức hạn ATVSLĐ
│   ├── pcccContactParser.ts             # Parser phân tích bảng danh bạ PCCC mẫu PC01 từ PowerPoint/Excel
│   ├── exportExcel.ts / exportReports.ts# Xuất file Excel bảng biểu và mẫu báo cáo
│   ├── exportThacoCostReport.ts         # Xuất file Excel Báo cáo Ma trận Chi phí Quản trị THACO
│   ├── thacoCostDataEngine.ts           # Động cơ tổng hợp và tính toán số liệu chi phí THACO ma trận đa chiều
│   ├── numberToWordsVN.ts               # Đọc số tiền thành chữ tiếng Việt trong phiếu DNTT
│   ├── costGroupColors.ts               # Bảng màu nhận diện các nhóm chi phí La Mã
│   ├── vehicleLocationHelper.ts         # Parser & filter vị trí xe 3 cấp (Khu vực / Showroom / Bộ phận)
│   ├── excelTemplates.ts                # Định nghĩa cấu trúc cột và dữ liệu mẫu Excel dán hàng loạt đọc từ DB theo 3 tiêu chí
│   ├── mathEvaluator.ts                 # safeEvalMath() — tính công thức số học nhập tay
│   ├── logger.ts                        # Ghi nhật ký lịch sử thay đổi (diff log)
│   └── toast.ts                         # Tiện ích thông báo Toast
├── pages/                               # 14 trang phân hệ nghiệp vụ chính (ánh xạ ở mục 3)
└── components/
    ├── ui/                              # 10 UI component dùng chung (UnitFilterSidebar, SegmentTabs, PasteImportModal...)
    ├── common/                          # EmptyState, TablePaginationFooter
    ├── dashboard/                       # KpiSection, ExpiryAlertPanel, PersonnelDoughnutChart, DashboardCustomizerModal
    ├── department/                      # 10 Modal hồ sơ đơn vị (Security, PCCC, ATVSLD, Bản đồ Showroom OSRM...)
    ├── personnel/                       # Cụm Cước ĐTDĐ (CuocDiDongTab) + PersonnelModal + Chart cước
    ├── atvsld/                          # 5 Tab con của AtvsldPage (HoSoTab, KeHoachTab, KhoaHocTab, StrictEquipmentTab, SucKhoeTab)
    ├── vehicle/                         # 3 Component xe (VehicleScheduleTab, VehicleStatsTab, VehicleLocationPicker)
    ├── cost/                            # 9 Component quản lý CPHC (DnttTab, CostStatisticsTab, CostMatrixView...)
    │   └── pivot/                       # 6 Component Dynamic Pivot Table (CostPivotBuilder, CostPivotView, pivotEngine...)
    ├── document/                        # 7 Component bảng văn bản theo từng tab (AllDocTable, ThongBaoTable...)
    └── report/                          # CustomReportBuilder + 4 component phụ trợ báo cáo
```

---

## 3. BẢNG ÁNH XẠ TÍNH NĂNG ↔ FILE ↔ BẢNG SUPABASE (xác thực 100% từ code)

| Menu Sidebar (tab id) | Page chính | Component/Modal con | Bảng Supabase thật | Trạng thái |
|---|---|---|---|---|
| Tổng quan (`dashboard`) | `DashboardPage.tsx` (1486 dòng) | `KpiSection`, `ExpiryAlertPanel`, `PersonnelDoughnutChart`, `DashboardCustomizerModal` | đọc `dm_don_vi`, `ns_dich_vu`, `ts_thiet_bi` (tổng hợp KPI, không ghi) | ✅ |
| Thông tin Công ty (`departments`) | `DepartmentPage.tsx` (2944 dòng) | `SecurityModal`, `PcccModal`, `PcccContactPasteModal`, `AtvsldModal`, `PcttModal`, `PvhcModal`, `PnModal`, `PhModal`, `PersonnelCard`, `DepartmentMapModal` (Sơ đồ showroom bản đồ & OSRM) | `dm_don_vi`, `hs_an_ninh`, `hs_pccc` (gồm 6 cột lãnh đạo mới) + `ts_pccc`, `hs_an_toan_lao_dong`, `hs_pctt`, `hs_pvhc`, `dm_phap_nhan`, `dm_phong_hop` | ✅ |
| Nhân sự (`personnel`) | `PersonnelPage.tsx` (2868 dòng) | `PersonnelModal`, component `SegmentTabs.tsx`; module con **Cước ĐTDĐ**: `CuocDiDongTab.tsx` (3366 dòng), `ThueBaoCuocHistorySection`, `BatchCostEntryModal`, `PersonnelDetailCuocChart`, `ThueBaoDetailCuocChart` | `ns_dich_vu` (hồ sơ NS); Cước ĐTDĐ dùng `dm_thue_bao` + `cp_cuoc_thang` | ✅ |
| An toàn PCCC (`firesafety`) | `FireSafetyPage.tsx` (1465 dòng) | `PcccContactPasteModal`, `pcccContactParser.ts`, dùng chung `PcccModal` (ở `components/department/`) | `hs_pccc` (bổ sung 6 cột lãnh đạo), `ts_pccc` | ✅ |
| ATVSLĐ (`atvsld`) | `AtvsldPage.tsx` (676 dòng) — 5 tab cấp 1: `hoso`, `daotao`, `thietbi`, `khamsuckhoe` | `HoSoTab.tsx`, `KeHoachTab.tsx`, `KhoaHocTab.tsx` (1742 dòng), `StrictEquipmentTab.tsx` (996 dòng), `SucKhoeTab.tsx` (705 dòng), modal `AtvsldModal`, component `SegmentTabs.tsx` | `hs_an_toan_lao_dong` (hồ sơ), `hs_khoa_huan_luyen`+`hs_hoc_vien_khoa_huan_luyen` (khóa học), `ts_thiet_bi_nghiem_ngat`+`nk_kiem_dinh_tbnn` (TBNN), `hs_kham_suc_khoe`+`nk_kham_suc_khoe_canhan` (KSK) | ✅ |
| Quản lý Xe (`vehicles`) | `VehiclePage.tsx` (3746 dòng — **file lớn nhất theo page**) | `VehicleScheduleTab.tsx` (lịch trình), `VehicleStatsTab.tsx` (thống kê xe), `VehicleLocationPicker.tsx` (địa điểm 3 cấp), `vehicleLocationHelper.ts`, `SegmentTabs.tsx`, tích hợp Google Drive (`googleDrive.ts`, `searchVehicleDriveFile` theo Số khung) | `ts_xe` (lưu JSON địa điểm 3 cấp `dia_diem_su_dung`, cột `ho_so_xe`), `cp_hoat_dong_xe`, `nk_su_dung_xe` | ✅ |
| Tài sản-Thiết bị (`equipments`) | `EquipmentPage.tsx` (3205 dòng) | `PasteImportModal`, `CustomAutocomplete`, `SegmentTabs.tsx` | `ts_thiet_bi`, `nk_thiet_bi`, `dm_phap_nhan` (lọc theo chuỗi đa đơn vị `id_don_vi`) | ✅ |
| Quản lý Chi phí (`cphc`) | `CostManagementPage.tsx` (654 dòng) — 4 tab cấp 1: `dntt`, `thong_ke`, `kmp`, `admin` | `DnttTab.tsx` (148KB), `DnttAllocationModal.tsx`, `exportDnttDocx.ts`, `exportDnttPdf.ts`, `CostStatisticsTab.tsx` (62KB), `CostMatrixView.tsx` (32KB), `CostDashboardTab.tsx`, `KmpConfigTab.tsx`, `AdminLegalTab.tsx`, Cụm Pivot: `CostPivotView.tsx`, `CostPivotBuilder.tsx`, `PivotConfigBar.tsx`, `pivotEngine.ts`, `exportGenericPivotExcel.ts` | `dm_nhom_chi_phi`, `dm_kmp`, `dm_bo_phan` (Cấp 1 & Cấp 2), `dntt`, `dntt_chi_tiet`, `dntt_phan_bo`, `chi_phi_chot_ky`, `chi_phi_thong_ke`, `chi_phi_pivot_config` | ✅ (Native) |
| Nhà cung cấp (`suppliers`) | `SupplierPage.tsx` (khoảng 600 dòng) | modal xem chi tiết, modal thêm/sửa | `dm_ncc` | ✅ |
| Tài liệu (`documents`) | `DocumentPage.tsx` (1674 dòng) | 6 Table component (`AllDocTable`, `ThongBaoTable`, `QuyetDinhTable`, `CongVanDenTable`, `CongVanDiTable`, `ToTrinhTable`), helper `documentHelpers.ts`, tích hợp Google Drive (`googleDrive.ts`, `searchGoogleDriveFile`) | `vb_tb` | ✅ |
| Quy định (`policies`) | `PolicyPage.tsx` (557 dòng) | `SegmentTabs.tsx` | `qd_qt` | ✅ |
| Báo cáo (`reports`) | `ReportPage.tsx` (699 dòng) | `CustomReportBuilder`, `ReportConfigPanel`, `ReportFilterBar`, `ReportList` (tích hợp tải Form dán mẫu DB theo 3 tiêu chí), `ReportPreviewTable` | đọc tổng hợp (`hs_an_ninh`, `dm_don_vi`, `ns_dich_vu`, `dm_phap_nhan`, `vb_tb`), không ghi | ✅ |
| Tài khoản (`accounts`) | `AccountPage.tsx` (1093 dòng) | Ma trận quyền chi tiết (`quyen_chi_tiet` gồm Văn bản, Quy định, Nhân sự, Thiết bị, Xe `XE_ALLOW_LIST`, Chi phí `CP_PIVOT_CLONE`), phân cấp quản trị HO Admin / Admin Đơn vị / User, phân quyền đa đơn vị | `config_users` | ✅ |
| Nhật ký (`logs`) | `LogPage.tsx` (146 dòng) | — | `sys_logs` (ghi tự động qua `writeLog()` ở mọi `save()`/`deleteRecord()`) | ✅ |
| Đăng nhập | `LoginPage.tsx` (131 dòng) | `AuthContext.tsx` | Supabase Auth | ✅ |

---

## 4. TOÀN BỘ 38 BẢNG SUPABASE THẬT (từ `services/api/modules.ts`)

Toàn bộ các bảng CSDL thực tế trong hệ thống được phân nhóm nghiệp vụ rõ ràng:

1. **Nhóm Danh mục Cơ sở & Đơn vị (5 bảng):** `dm_don_vi`, `dm_phap_nhan`, `dm_phong_hop`, `dm_ncc`, `dm_thue_bao`.
2. **Nhóm Quản lý Chi phí Hành chính (9 bảng):** `dm_nhom_chi_phi`, `dm_kmp`, `dm_bo_phan`, `dntt`, `dntt_chi_tiet`, `dntt_phan_bo`, `chi_phi_chot_ky`, `chi_phi_thong_ke`, `chi_phi_pivot_config`.
3. **Nhóm Quản lý Nhân sự & Cước (2 bảng):** `ns_dich_vu`, `cp_cuoc_thang`.
4. **Nhóm Quản lý Xe & Vận hành (3 bảng):** `ts_xe`, `cp_hoat_dong_xe`, `nk_su_dung_xe`.
5. **Nhóm Quản lý Trang thiết bị CNTT & VP (2 bảng):** `ts_thiet_bi`, `nk_thiet_bi`.
6. **Nhóm Quản lý PCCC & CNCH (2 bảng):** `hs_pccc`, `ts_pccc`.
7. **Nhóm Quản lý ATVSLĐ, TBNN & Sức khỏe (9 bảng):** `hs_an_toan_lao_dong`, `hs_khoa_huan_luyen`, `hs_hoc_vien_khoa_huan_luyen`, `dm_chu_ky_atvsld`, `ts_thiet_bi_nghiem_ngat`, `nk_kiem_dinh_tbnn`, `hs_kham_suc_khoe`, `hs_kham_suc_khoe_campaign`, `nk_kham_suc_khoe_canhan`.
8. **Nhóm Văn bản, Quy định & Hồ sơ Đơn vị (4 bảng):** `vb_tb`, `qd_qt`, `hs_an_ninh`, `hs_pvhc`, `hs_pctt`.
9. **Nhóm Quản trị Người dùng & Nhật ký Hệ thống (2 bảng):** `config_users`, `sys_logs`.

---

## 5. GATEWAY GHI DỮ LIỆU & TỐI ƯU TRUY VẤN (xác thực từ `modules.ts` & `cache.ts`)

- **Đọc dữ liệu với Tải song song phân trang (Parallel Batch Fetching):**
  - Mọi thao tác đọc dữ liệu đều đi qua hàm `getX()` trong `modules.ts` $\rightarrow$ gọi `getWithFallback(tableName)`.
  - `fetchWithCache(tableName)` trong `cache.ts` kiểm tra bộ đệm Layer 1 (Memory TTL 5 phút) $\rightarrow$ Layer 2 (LocalStorage).
  - Khi gọi Supabase, hàm gửi request đầu tiên `Range: 0-999` kèm `Prefer: count=exact`. Nếu `Content-Range` cho biết tổng số dòng > 1.000, hệ thống tự động sinh mảng Promise tải đồng thời (`Promise.all`) tất cả các trang còn lại và hợp nhất kết quả. Nếu lỗi kết nối, tự động fallback sang `getLocalRecords()`.
- **Kiểm soát Phạm vi Ghi (`checkUnitPermission`):**
  - Mọi thao tác **Ghi/Sửa** BẮT BUỘC đi qua `apiService.save(data, action, tableName)`.
  - Trước khi gửi đi, `checkUnitPermission()` kiểm tra `id_don_vi` của bản ghi. Nếu tài khoản không có quyền trên đơn vị đó, hệ thống sẽ chặn đứng và ném lỗi ngay lập tức mà không gửi request lên máy chủ.
  - Tự sinh `id` định dạng `{2 ký tự đầu bảng}{timestamp}{random}`, tự làm sạch payload (`sanitizePayload`: biến `""` thành `null`, loại bỏ các trường UI-only).
- **Thao tác Xóa:** Bắt buộc qua `apiService.deleteRecord(id, tableName)`.
- **Tự động Xóa Cache quan hệ (`CACHE_DEPENDENCIES`) & Ghi Audit Log:** Mọi lệnh `save`/`deleteRecord` tự động gọi `invalidateCache()` xóa cache của bảng mục tiêu và các bảng phụ thuộc, đồng thời tự động gọi `writeLog()` ghi vết kiểm toán vào `sys_logs`.
- **Nghiệp vụ Chốt kỳ Chi phí Chuyên biệt:**
  - `chotKyChiPhi(thang, nam, nguoiChot, ghiChu)`: Tự động gom nhóm toàn bộ dòng phân bổ của DNTT thành Fact Table Snapshot lưu vào `chi_phi_thong_ke` và tạo bản ghi `chi_phi_chot_ky` trạng thái `da_chot`.
  - `checkDnttBelongsToLockedPeriod(dnttId)`: Khóa chặt không cho sửa/xóa các phiếu DNTT thuộc kỳ đã chốt.
  - `huyChotKyChiPhi(chotKyId, nguoiHuy)`: Chuyển trạng thái sang `da_huy_chot` và xóa snapshot an toàn.
  - `updateDnttStatusBulk(dnttIds, newStatus, nguoiCapNhat)`: Cập nhật trạng thái nhiều phiếu, tự động bỏ qua các phiếu trong kỳ bị khóa.

---

## 6. CƠ CHẾ PHÂN QUYỀN

- `AuthContext.tsx`: Đọc thông tin từ `config_users` (và Supabase JWT `user_metadata`) $\rightarrow$ lấy `quyen` (`ADMIN` / `viewer_hanche` / `USER`), `id_don_vi` (có thể là chuỗi nhiều ID ngăn cách bởi dấu phẩy), `quyen_truy_cap` và `quyen_chi_tiet`.
- **Phân cấp Quản trị 3 Tầng:**
  1. **HO Admin (Quản trị viên Tập đoàn):** Tài khoản có quyền `ADMIN` và `id_don_vi` là `HO`, `ALL`, hoặc thuộc Ban điều hành / Toàn quốc $\rightarrow$ Toàn quyền xem và sửa đổi dữ liệu của toàn bộ các đơn vị trên toàn quốc.
  2. **Admin Đơn vị (Quản trị viên Công ty Tỉnh thành):** Quản trị viên tại các Công ty tỉnh thành $\rightarrow$ Xem và quản lý tài khoản, dữ liệu của chính đơn vị mẹ và các Showroom/Điểm bán lẻ trực thuộc.
  3. **User / Chuyên viên (Người dùng thường):** Chỉ được thao tác trong phạm vi đơn vị được gán, không được xem thông tin nhạy cảm hoặc sửa dữ liệu ngoài phạm vi.
- **Ma trận Quyền Chi tiết (`quyen_chi_tiet`):**
  - **Chi phí:** `CP_PIVOT_CLONE` (Cho phép tạo và lưu mẫu báo cáo Pivot tùy chỉnh).
  - **Xe:** `XE_ALLOW_LIST` (Giới hạn danh sách biển số xe được phép xem), `can_view_vehicle_stats` (Đặc quyền nghiệp vụ tích hợp: Cho phép Admin cấu hình bật/tắt quyền xem Tab con Thống kê xe - Pivot đa chiều & Dashboard).
  - **Nhân sự:** `NS_HIDE_SENSITIVE` (Ẩn SĐT, CCCD, Lương, Ngạch), `NS_NO_DETAIL` (Cấm xem chi tiết hồ sơ 360°).
  - **Thiết bị:** `TB_HIDE_PRICE` (Ẩn cột Nguyên giá thiết bị).
  - **Văn bản:** `VB_HIDE_BTN` (Ẩn nút Ban hành), `VB_VIEW_*` (Giới hạn loại văn bản được xem).
  - **Quy định:** `QD_TYPES` (Giới hạn loại quy định), `QD_YEARS` (Giới hạn năm ban hành).

---

## 7. BẢNG TRA CỨU HỆ THỐNG VAI TRÒ TOÀN BỘ FILE TRONG DỰ ÁN (FILE ROLE & RESPONSIBILITY DIRECTORY)

Nhằm thuận tiện cho việc tra cứu, cập nhật, bảo trì và mở rộng tính năng, toàn bộ các tệp nguồn trong dự án được chuẩn hóa và phân loại hệ thống theo các tầng kiến trúc dưới đây:

### 7.1. Tầng Khởi tạo & Điều hướng Hệ thống (Core & Routing Layer)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Kiến trúc | Thành phần Phụ thuộc / Tương tác |
| :--- | :--- | :--- | :--- |
| `main.tsx` | [`main.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/main.tsx) | Điểm khởi đầu (Entry Point) của ứng dụng React. Khởi tạo ReactDOM root, bọc `<React.StrictMode>`, nạp CSS toàn cục. | `App.tsx`, `index.css` |
| `App.tsx` | [`App.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/App.tsx) | Bộ điều hướng trung tâm (Router & Page Orchestrator). Quản lý state trang active (`activePage`), bọc `AuthProvider`, nạp Header, Sidebar và điều hướng hiển thị 14 Pages. | `AuthContext.tsx`, `Sidebar.tsx`, 14 Pages |
| `AuthContext.tsx` | [`AuthContext.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/context/AuthContext.tsx) | Quản lý trạng thái xác thực toàn cục (Authentication & Authorization). Lưu thông tin phiên đăng nhập, kiểm tra thời hạn phiên (2 ngày), nạp quyền chi tiết và gọi `validateAndRefreshUser()`. | `apiService`, `client.ts`, `types/index.ts` |
| `index.css` | [`index.css`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/index.css) | Định nghĩa toàn bộ CSS Design Tokens, lớp giao diện Tailwind, FlyonUI styles, animation viên thuốc trượt, scrollbar tùy chỉnh và biến màu chủ đạo. | Toàn bộ ứng dụng |

---

### 7.2. Tầng Trang Nghiệp vụ Chính (Application Pages - 14 Phân hệ & Auth)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Nghiệp vụ | Bảng DB & Thành phần Liên quan |
| :--- | :--- | :--- | :--- |
| `DashboardPage.tsx` | [`DashboardPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/DashboardPage.tsx) | **01. Tổng quan**: Hiển thị KPI nhân sự 3 nhóm (QTVP, Bảo vệ, PVHC), cơ cấu nhân sự, cảnh báo sắp hết hạn (bảo hiểm, kiểm định, hợp đồng, bằng lái). | `KpiSection.tsx`, `ExpiryAlertPanel.tsx`, `PersonnelDoughnutChart.tsx` |
| `DepartmentPage.tsx` | [`DepartmentPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/DepartmentPage.tsx) | **02. Hồ sơ Đơn vị 360°**: Quản lý 6 phân mục thông tin showroom: Mục A (Nhân sự), B (Mặt bằng/Diện tích), C (PCCC), D (An ninh/Camera), E (Tổ chức), F (PCCC & CNCH). | `dm_don_vi`, `dm_phap_nhan`, `DepartmentMapModal.tsx`, `PcccModal.tsx` |
| `PersonnelPage.tsx` | [`PersonnelPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/PersonnelPage.tsx) | **03. Thông tin Nhân sự**: Quản lý hồ sơ nhân viên toàn hệ thống, tìm kiếm, lọc phòng ban, xem chi tiết 360°, tích hợp cước di động viễn thông, xuất báo cáo. | `nhan_su`, `dm_phong_ban`, `PersonnelModal.tsx`, `CuocDiDongTab.tsx` |
| `VehiclePage.tsx` | [`VehiclePage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/VehiclePage.tsx) | **04. Quản lý Xe Demo / Mobile Service**: Quản lý hồ sơ xe, bảo hiểm, đăng kiểm, bộ chọn địa điểm 3 cấp, tab Lịch trình & Nhật ký, tab Thống kê xe, quét Drive theo VIN. | `ts_xe`, `xe_lich_trinh`, `VehicleLocationPicker.tsx`, `VehicleScheduleTab.tsx`, `VehicleStatsTab.tsx` |
| `EquipmentPage.tsx` | [`EquipmentPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/EquipmentPage.tsx) | **05. Trang thiết bị VP**: Quản lý máy tính, máy in, máy chiếu, tạo mã QR, tự động format GB bộ nhớ, ràng buộc Đơn vị ↔ Pháp nhân sở hữu, import Excel. | `ttb_van_phong`, `dm_loai_tb`, `PasteImportModal.tsx`, `formatters.ts` |
| `SupplierPage.tsx` | [`SupplierPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/SupplierPage.tsx) | **06. Quản lý Nhà cung cấp**: Quản lý danh mục đối tác, hợp đồng dịch vụ, phân loại ngành hàng cung ứng, đánh giá NCC định kỳ. | `nha_cung_cap`, `dm_don_vi` |
| `CostManagementPage.tsx` | [`CostManagementPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/CostManagementPage.tsx) | **07. Quản lý Chi phí Hành chính (CPHC)**: Điều phối 4 phân hệ con: Đề nghị thanh toán (DNTT), Thống kê (Ma trận/Pivot/Dashboard), Cấu hình KMP, Quản trị Bộ phận/Pháp nhân. | `chi_phi_dntt`, `chi_phi_dntt_chi_tiet`, `dm_kmp`, `DnttTab.tsx`, `CostStatisticsTab.tsx` |
| `FireSafetyPage.tsx` | [`FireSafetyPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/FireSafetyPage.tsx) | **08. Quản lý Hồ sơ PCCC & CNCH**: Quản lý phương tiện PCCC, bình chữa cháy, danh bạ khẩn cấp PC01 (15 đầu mối), cảnh báo quá hạn nạp sạc. | `hs_pccc`, `pccc_thiet_bi`, `PcccContactPasteModal.tsx`, `pcccContactParser.ts` |
| `AtvsldPage.tsx` | [`AtvsldPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/AtvsldPage.tsx) | **09. Quản lý ATVSLĐ & TBNN**: Điều phối 5 tab: Báo cáo cơ sở định kỳ/đột xuất, Kế hoạch ATVSLĐ, Khóa học đào tạo nhóm 1-6, Thiết bị nghiêm ngặt, Khám sức khỏe & BNN. | `atvsld_bao_cao`, `dm_khoa_hoc`, `ts_thiet_bi_nghiem_ngat`, `SucKhoeTab.tsx` |
| `DisasterPage.tsx` | [`DisasterPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/DisasterPage.tsx) | **10. Phòng chống Thiên tai (PCTT & TKCN)**: Phương án ứng phó bão lũ, danh sách đội xung kích cơ sở, phương tiện cứu nạn cứu hộ. | `hs_pctt`, `dm_don_vi` |
| `DocumentPage.tsx` | [`DocumentPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/DocumentPage.tsx) | **11. Văn thư Lưu trữ & Thông báo**: Quản lý Công văn đến/đi, Quyết định, Thông báo, Tờ trình, phân loại nghiệp vụ, tích hợp quét file PDF từ Google Drive API v3. | `vb_tb`, `googleDrive.ts`, `AllDocTable.tsx`, `QuyetDinhTable.tsx` |
| `PolicyPage.tsx` | [`PolicyPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/PolicyPage.tsx) | **12. Quy định & Quy trình**: Quản lý tài liệu pháp quy THACO AUTO, tra cứu theo bộ phận/năm/nghiệp vụ, phân tích đa nghiệp vụ cách nhau bởi dấu `;`. | `qd_qt`, `googleDrive.ts`, `CustomAutocomplete.tsx` |
| `ReportsPage.tsx` | [`ReportsPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/ReportsPage.tsx) | **13. Báo cáo Tổng hợp**: Trung tâm xuất báo cáo đa phân hệ, tùy biến chọn cột, lọc động nâng cao, xem trước bảng và xuất file Excel chuyên nghiệp. | `exportReports.ts`, `reportTemplates.ts`, `ReportFilterBar.tsx` |
| `AccountPage.tsx` | [`AccountPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/AccountPage.tsx) | **14. Quản trị Tài khoản & Phân quyền**: Quản lý danh sách tài khoản, phân cấp 3 tầng quyền (HO Admin, Admin Đơn vị, User), gán đa đơn vị (`don_vi_phu_trach`), cấu hình quyền chi tiết. | `config_users`, `dm_don_vi`, `hierarchy.ts` |
| `LoginPage.tsx` | [`LoginPage.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/pages/LoginPage.tsx) | **Xác thực Đăng nhập**: Form đăng nhập người dùng, kiểm tra mật khẩu mặc định, lưu phiên làm việc. | `AuthContext.tsx`, `apiService.login` |

---

### 7.3. Phân hệ Quản lý Chi phí Hành chính (Components: `components/cost/` & `cost/pivot/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `DnttTab.tsx` | [`DnttTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/DnttTab.tsx) | Tab quản lý toàn diện Đề nghị thanh toán (DNTT): Danh sách phiếu theo đơn vị/tháng, form lập DNTT, bảng chi tiết KMP, quản lý trạng thái, nạp/xóa chứng từ. | `DnttAllocationModal.tsx`, `exportDnttDocx.ts`, `exportDnttPdf.ts` |
| `DnttAllocationModal.tsx` | [`DnttAllocationModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/DnttAllocationModal.tsx) | Modal chỉnh sửa phân bổ chi phí chi tiết theo từng KMP, Pháp nhân và Đơn vị trực thuộc. | `chi_phi_dntt_chi_tiet`, `formatters.ts` |
| `CostStatisticsTab.tsx` | [`CostStatisticsTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/CostStatisticsTab.tsx) | Tab Trung tâm Thống kê CPHC: Điều phối chuyển đổi giữa Báo cáo Ma trận THACO và Báo cáo Pivot Đa chiều, tích hợp nút Chốt kỳ dữ liệu. | `CostMatrixView.tsx`, `CostPivotBuilder.tsx`, `CostDashboardTab.tsx` |
| `CostMatrixView.tsx` | [`CostMatrixView.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/CostMatrixView.tsx) | Bảng hiển thị Ma trận Chi phí THACO AUTO: Cột là Bộ phận, Hàng là KMP Cấp 1/Cấp 2, tính tổng tự động, nút xuất Excel ma trận. | `thacoCostDataEngine.ts`, `exportThacoCostReport.ts` |
| `CostDashboardTab.tsx` | [`CostDashboardTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/CostDashboardTab.tsx) | Tab Dashboard Biểu đồ trực quan: Tỷ trọng cơ cấu chi phí theo KMP, so sánh thực tế vs ngân sách, xu hướng chi phí theo tháng. | `costGroupColors.ts`, Recharts |
| `KmpConfigTab.tsx` | [`KmpConfigTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/KmpConfigTab.tsx) | Tab Quản trị Danh mục Khoản mục Phí (KMP Cấp 1, Cấp 2): Thêm, sửa, kích hoạt/vô hiệu hóa, quy định mã KMP chuẩn. | `dm_kmp`, `dm_nhom_chi_phi` |
| `AdminLegalTab.tsx` | [`AdminLegalTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/AdminLegalTab.tsx) | Tab Quản trị Bộ phận Cấp 1/Cấp 2 và Pháp nhân sở hữu: Quản lý danh sách pháp nhân dùng chung nhiều đơn vị qua mảng `don_vi_ids`. | `dm_bo_phan`, `dm_phap_nhan` |
| `exportDnttDocx.ts` | [`exportDnttDocx.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/exportDnttDocx.ts) | Tiện ích xuất file Word (.docx) Giấy Đề nghị thanh toán theo đúng mẫu ký duyệt chuẩn THACO AUTO, tự động đọc tiền thành chữ. | `docx`, `numberToWordsVN.ts` |
| `exportDnttPdf.ts` | [`exportDnttPdf.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/exportDnttPdf.ts) | Tiện ích xuất file PDF Giấy Đề nghị thanh toán & Bảng kê phân bổ chi phí chuẩn THACO AUTO: Bảng 5 cột chuẩn (`STT | Khối/NV | Thương hiệu/BP | Tỷ lệ | Số tiền`), dòng 1 trên 1 dòng duy nhất (không dùng ký tự `|`), dòng mục lớn merge 4 cột, dòng con đánh số phân cấp `1.1, 1.2... N.1`, chân chữ ký viền trong suốt và cơ chế Smart Adaptive Layout tự động co gọn vừa vặn 1 trang A4 hoặc sang trang 2 lặp lại header (`thead`). | `jspdf`, `jspdf-autotable`, `numberToWordsVN.ts` |
| `CostPivotBuilder.tsx` | [`CostPivotBuilder.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/pivot/CostPivotBuilder.tsx) | Trình dựng báo cáo Pivot kéo thả: Chọn Chiều dòng (Row Dimensions), Chiều cột (Column Dimensions), Giá trị đo lường và Bộ lọc. | `pivotEngine.ts`, `PivotConfigBar.tsx`, `CostPivotView.tsx` |
| `CostPivotView.tsx` | [`CostPivotView.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/pivot/CostPivotView.tsx) | Bảng hiển thị kết quả Pivot đa chiều: Tự động gộp ô (Rowspan/Colspan), định dạng tiền tệ và tính tổng biên (Grand Totals). | `pivotTypes.ts`, `formatters.ts` |
| `PivotConfigBar.tsx` | [`PivotConfigBar.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/pivot/PivotConfigBar.tsx) | Thanh công cụ cấu hình Pivot: Lưu/Nạp mẫu báo cáo cá nhân hoặc hệ thống (`chi_phi_pivot_config`), chia sẻ mẫu cấu hình. | `chi_phi_pivot_config`, `AuthContext.tsx` |
| `pivotEngine.ts` | [`pivotEngine.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/pivot/pivotEngine.ts) | Thuật toán lõi tổng hợp và xoay dữ liệu ma trận đa chiều (Client-side Multidimensional Pivot Engine) hiệu năng cao. | `pivotTypes.ts` |
| `pivotTypes.ts` | [`pivotTypes.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/pivot/pivotTypes.ts) | Định nghĩa TypeScript Interfaces cho chiều dữ liệu, trường đo lường, bộ lọc và cấu hình Pivot Table. | `CostPivotBuilder.tsx`, `CostPivotView.tsx` |
| `exportGenericPivotExcel.ts` | [`exportGenericPivotExcel.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/cost/pivot/exportGenericPivotExcel.ts) | Tiện ích xuất file Excel bảng Pivot đa cấp phân tầng (Nested Headers & Subtotals) tùy biến linh hoạt. | `xlsx`, `pivotTypes.ts` |

---

### 7.4. Phân hệ Quản lý Xe (Components: `components/vehicle/` & `vehicle/pivot/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `VehicleLocationPicker.tsx` | [`VehicleLocationPicker.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/VehicleLocationPicker.tsx) | Bộ chọn địa điểm 3 cấp (Cascader): Cấp 1 Đơn vị/Showroom $\rightarrow$ Cấp 2 Tỉnh/Thành $\rightarrow$ Cấp 3 Quận/Huyện hoặc địa chỉ tự do. | `VehiclePage.tsx`, `VehicleScheduleTab.tsx`, `hierarchy.ts` |
| `VehicleScheduleTab.tsx` | [`VehicleScheduleTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/VehicleScheduleTab.tsx) | Tab Quản lý Lịch trình & Nhật ký vận hành: Theo dõi lộ trình di chuyển, người sử dụng, số km đi, mục đích chuyến đi, phân trang và xuất Excel. | `xe_lich_trinh`, `VehicleLocationPicker.tsx` |
| `VehicleStatsTab.tsx` | [`VehicleStatsTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/VehicleStatsTab.tsx) | Tab Thống kê xe: Điều phối 2 sub-tab con: **Thống kê** (Pivot đa chiều) và **Dashboard** (KPI tổng quan, biểu đồ tròn cơ cấu mục đích, tỷ trọng hãng, chi phí & km vận hành). | `VehiclePivotView.tsx`, Recharts, `ts_xe`, `cp_hoat_dong_xe` |
| `VehiclePivotView.tsx` | [`VehiclePivotView.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/pivot/VehiclePivotView.tsx) | Bảng ma trận Pivot xe đa chiều: 6 mẫu preset 1-click, chọn linh hoạt chiều Hàng (Rows), chiều Cột (Cols) và Chỉ số đo lường (Measures: Số lượng, Nguyên giá, Km, Chi phí), hỗ trợ đóng/mở cây phân cấp. | `vehiclePivotEngine.ts`, `vehiclePivotTypes.ts`, `exportVehiclePivotExcel.ts` |
| `vehiclePivotEngine.ts` | [`vehiclePivotEngine.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/pivot/vehiclePivotEngine.ts) | Thuật toán làm phẳng dữ liệu xe kết hợp chi phí, nhật ký km, bóc tách địa điểm 3 cấp, kiểm tra hạn Đăng kiểm/Bảo hiểm và tính ma trận pivot đa cấp kèm tổng biên. | `vehiclePivotTypes.ts`, `vehicleLocationHelper.ts` |
| `vehiclePivotTypes.ts` | [`vehiclePivotTypes.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/pivot/vehiclePivotTypes.ts) | Định nghĩa 21 chiều phân tích xe (Đơn vị, Địa bàn, Đặc tính kỹ thuật, Pháp lý/Hiện trạng), 4 chỉ số đo lường và 6 mẫu Preset chuẩn THACO AUTO. | `VehiclePivotView.tsx`, `vehiclePivotEngine.ts` |
| `exportVehiclePivotExcel.ts` | [`exportVehiclePivotExcel.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/vehicle/pivot/exportVehiclePivotExcel.ts) | Tiện ích xuất dữ liệu bảng Pivot xe ra định dạng Excel XML chuẩn, giữ nguyên cấu trúc phân tầng thụt dòng (Indentation), số liệu định dạng tiền tệ và tổng cộng. | `vehiclePivotTypes.ts` |

---

### 7.5. Phân hệ An toàn Vệ sinh Lao động (Components: `components/atvsld/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `HoSoTab.tsx` | [`HoSoTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/atvsld/HoSoTab.tsx) | Tab quản lý Hồ sơ Báo cáo cơ sở ATVSLĐ định kỳ và đột xuất gửi Sở LĐ-TB&XH. | `atvsld_bao_cao`, `SegmentTabs.tsx` |
| `KeHoachTab.tsx` | [`KeHoachTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/atvsld/KeHoachTab.tsx) | Tab lập và theo dõi tiến độ Kế hoạch ATVSLĐ hàng năm của từng đơn vị cơ sở. | `atvsld_ke_hoach`, `dm_don_vi` |
| `KhoaHocTab.tsx` | [`KhoaHocTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/atvsld/KhoaHocTab.tsx) | Tab Quản lý Huấn luyện/Đào tạo ATVSLĐ nhóm 1-6: Chế độ xem Ma trận & Danh sách, cảnh báo hết hạn chứng chỉ, đồng bộ nhân sự kiêm nhiệm. | `dm_khoa_hoc`, `nk_khoa_hoc`, `nhan_su` |
| `StrictEquipmentTab.tsx` | [`StrictEquipmentTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/atvsld/StrictEquipmentTab.tsx) | Tab quản lý Thiết bị có yêu cầu nghiêm ngặt về ATLĐ: Cầu nâng, bình nén khí, palang, theo dõi hạn kiểm định kế tiếp. | `ts_thiet_bi_nghiem_ngat`, `dm_loai_tb` |
| `SucKhoeTab.tsx` | [`SucKhoeTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/atvsld/SucKhoeTab.tsx) | Tab theo dõi Khám sức khỏe định kỳ & Bệnh nghề nghiệp: Lịch sử khám cá nhân, đợt khám cấp đơn vị, phân loại sức khỏe loại I-V. | `nk_kham_suc_khoe_canhan`, `atvsld_kham_suc_khoe` |

---

### 7.6. Phân hệ Đơn vị & Bản đồ Showroom (Components: `components/department/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `DepartmentMapModal.tsx` | [`DepartmentMapModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/DepartmentMapModal.tsx) | Bản đồ số tương tác Leaflet hiển thị mạng lưới Showroom toàn quốc, mini-card popup 4 dòng chuẩn, đo khoảng cách, chọn điểm dừng chân 1-click. | Leaflet, `DepartmentPage.tsx`, `dm_don_vi` |
| `PersonnelCard.tsx` | [`PersonnelCard.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PersonnelCard.tsx) | Thẻ hiển thị thông tin nhân sự chủ chốt đơn vị (Ban Giám đốc, QTVP, Bảo vệ) tại Mục A. | `DepartmentPage.tsx`, `nhan_su` |
| `PcccModal.tsx` | [`PcccModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PcccModal.tsx) | Modal cập nhật hồ sơ Phòng cháy chữa cháy & Cứu nạn cứu hộ của đơn vị (Mục F). | `hs_pccc`, `FireSafetyPage.tsx` |
| `PcccContactPasteModal.tsx` | [`PcccContactPasteModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PcccContactPasteModal.tsx) | Modal dán trực tiếp danh bạ khẩn cấp PC01 từ clipboard PowerPoint / Excel, tự động bóc tách 15 đầu mối. | `pcccContactParser.ts`, `hs_pccc` |
| `SecurityModal.tsx` | [`SecurityModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/SecurityModal.tsx) | Modal cập nhật và theo dõi công tác An ninh trật tự - Bảo vệ cơ sở (Mục D). | `hs_an_ninh`, `dm_don_vi` |
| `PhModal.tsx` | [`PhModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PhModal.tsx) | Modal cập nhật thông tin Mặt bằng, Diện tích, Hướng tiếp giáp Showroom (Mục B). | `hs_ph`, `dm_don_vi` |
| `PnModal.tsx` | [`PnModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PnModal.tsx) | Modal cập nhật thông tin Pháp nhân sở hữu và Đơn vị quản lý. | `dm_phap_nhan`, `dm_don_vi` |
| `PvhcModal.tsx` | [`PvhcModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PvhcModal.tsx) | Modal cập nhật công tác Phục vụ hành chính và Đội ngũ tạp vụ. | `hs_pvhc`, `dm_don_vi` |
| `PcttModal.tsx` | [`PcttModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/PcttModal.tsx) | Modal cập nhật thông tin Phòng chống thiên tai & TKCN của Showroom. | `hs_pctt`, `DisasterPage.tsx` |
| `AtvsldModal.tsx` | [`AtvsldModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/department/AtvsldModal.tsx) | Modal cập nhật tóm tắt thông tin ATVSLĐ cấp đơn vị. | `atvsld_bao_cao`, `AtvsldPage.tsx` |

---

### 7.7. Phân hệ Nhân sự & Cước Viễn thông (Components: `components/personnel/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `PersonnelModal.tsx` | [`PersonnelModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/personnel/PersonnelModal.tsx) | Modal Xem chi tiết 360° / Thêm mới / Cập nhật hồ sơ nhân sự, tích hợp lịch sử KSK cá nhân và thông tin phụ cấp. | `PersonnelPage.tsx`, `nhan_su` |
| `CuocDiDongTab.tsx` | [`CuocDiDongTab.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/personnel/CuocDiDongTab.tsx) | Tab quản lý Cước ĐTDĐ chi tiết theo thuê bao và hóa đơn hàng tháng, đối soát hạn mức khoán, phát hiện vượt cước. | `ns_cuoc_dtdd`, `nhan_su` |
| `ThueBaoCuocHistorySection.tsx` | [`ThueBaoCuocHistorySection.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/personnel/ThueBaoCuocHistorySection.tsx) | Khối hiển thị dòng thời gian lịch sử cước của từng số thuê bao di động. | `CuocDiDongTab.tsx` |
| `PersonnelDetailCuocChart.tsx` | [`PersonnelDetailCuocChart.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/personnel/PersonnelDetailCuocChart.tsx) | Biểu đồ trực quan hóa chi phí cước của cá nhân theo từng tháng trong năm. | `PersonnelModal.tsx`, Recharts |
| `ThueBaoDetailCuocChart.tsx` | [`ThueBaoDetailCuocChart.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/personnel/ThueBaoDetailCuocChart.tsx) | Biểu đồ so sánh cước thực tế với hạn mức khoán quy định theo chức danh. | `CuocDiDongTab.tsx`, Recharts |

---

### 7.8. Phân hệ Văn bản & Quy định (Components: `components/document/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `AllDocTable.tsx` | [`AllDocTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/AllDocTable.tsx) | Bảng danh sách tổng hợp toàn bộ văn thư lưu trữ kèm bộ lọc đa tiêu chí. | `DocumentPage.tsx`, `vb_tb` |
| `CongVanDenTable.tsx` | [`CongVanDenTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/CongVanDenTable.tsx) | Bảng chuyên biệt cho Công văn đến (CVĐ): Theo dõi ngày nhận, nơi gửi, số văn bản đến. | `DocumentPage.tsx`, `vb_tb` |
| `CongVanDiTable.tsx` | [`CongVanDiTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/CongVanDiTable.tsx) | Bảng chuyên biệt cho Công văn đi (CVD): Quản lý nơi nhận, số phát hành, người ký. | `DocumentPage.tsx`, `vb_tb` |
| `QuyetDinhTable.tsx` | [`QuyetDinhTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/QuyetDinhTable.tsx) | Bảng chuyên biệt cho Quyết định ban hành (QĐ): Thẩm quyền ký, ngày hiệu lực. | `DocumentPage.tsx`, `vb_tb` |
| `ThongBaoTable.tsx` | [`ThongBaoTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/ThongBaoTable.tsx) | Bảng chuyên biệt cho Thông báo nội bộ (TB): Bộ phận ban hành, đối tượng áp dụng. | `DocumentPage.tsx`, `vb_tb` |
| `ToTrinhTable.tsx` | [`ToTrinhTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/ToTrinhTable.tsx) | Bảng chuyên biệt cho Tờ trình (TTr): Nội dung đề xuất, kết quả phê duyệt. | `DocumentPage.tsx`, `vb_tb` |
| `types.ts` | [`types.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/document/types.ts) | Định nghĩa kiểu dữ liệu nội bộ phục vụ hiển thị bảng và bộ lọc tài liệu văn bản. | Các Table Components văn bản |

---

### 7.9. Phân hệ Báo cáo & Dashboard (Components: `components/report/` & `dashboard/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `ReportList.tsx` | [`ReportList.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/report/ReportList.tsx) | Danh mục hiển thị các mẫu báo cáo chuẩn có sẵn trong hệ thống. | `ReportsPage.tsx`, `reportTemplates.ts` |
| `ReportFilterBar.tsx` | [`ReportFilterBar.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/report/ReportFilterBar.tsx) | Thanh công cụ lọc động theo đơn vị, thời gian, trạng thái cho các mẫu báo cáo. | `ReportsPage.tsx`, `hierarchy.ts` |
| `ReportPreviewTable.tsx` | [`ReportPreviewTable.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/report/ReportPreviewTable.tsx) | Bảng hiển thị trước dữ liệu báo cáo trước khi xuất ra file Excel. | `ReportsPage.tsx` |
| `ReportConfigPanel.tsx` | [`ReportConfigPanel.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/report/ReportConfigPanel.tsx) | Bảng điều khiển cấu hình hiển thị cột và thứ tự sắp xếp cho báo cáo. | `ReportsPage.tsx` |
| `CustomReportBuilder.tsx` | [`CustomReportBuilder.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/report/CustomReportBuilder.tsx) | Trình tùy biến tạo mẫu báo cáo mới theo nhu cầu người dùng. | `ReportsPage.tsx` |
| `KpiSection.tsx` | [`KpiSection.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/dashboard/KpiSection.tsx) | Khối hiển thị các thẻ chỉ số KPI tổng hợp trên trang Dashboard. | `DashboardPage.tsx` |
| `ExpiryAlertPanel.tsx` | [`ExpiryAlertPanel.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/dashboard/ExpiryAlertPanel.tsx) | Bảng cảnh báo các hạng mục sắp hết hạn (kiểm định TBNN, bằng lái, hợp đồng, KSK...). | `DashboardPage.tsx`, `expiryStatus.ts` |
| `PersonnelDoughnutChart.tsx` | [`PersonnelDoughnutChart.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/dashboard/PersonnelDoughnutChart.tsx) | Biểu đồ tròn tỷ trọng cơ cấu nhân sự theo phòng ban/đơn vị. | `DashboardPage.tsx`, Chart.js / Recharts |
| `DashboardCustomizerModal.tsx` | [`DashboardCustomizerModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/dashboard/DashboardCustomizerModal.tsx) | Modal cho phép người dùng tùy chọn ẩn/hiện các widget trên Dashboard. | `DashboardPage.tsx` |

---

### 7.10. Giao diện Dùng chung & UI Kit (Components: `components/ui/` & `common/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `SegmentTabs.tsx` | [`SegmentTabs.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/SegmentTabs.tsx) | Bộ Tab phân cấp dạng viên thuốc trượt FlyonUI (`motion/react`) chuẩn thiết kế hệ thống. | Toàn bộ 14 Pages |
| `LineTabs.tsx` | [`LineTabs.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/LineTabs.tsx) | Bộ Tab gạch chân truyền thống hỗ trợ các vùng nội dung phụ. | `AtvsldPage.tsx`, `PersonnelPage.tsx` |
| `Button.tsx` | [`Button.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/Button.tsx) | Nút bấm đa trạng thái chuẩn Tailwind (primary, secondary, danger, outline, icon). | Toàn hệ thống |
| `Badge.tsx` | [`Badge.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/Badge.tsx) | Huy hiệu trạng thái, phân loại, màu sắc tương phản cao. | Toàn hệ thống |
| `Modal.tsx` | [`Modal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/Modal.tsx) | Hộp thoại Popup chuẩn kèm backdrop làm mờ (backdrop-blur) và animation mượt. | Toàn bộ Modal trong app |
| `Pagination.tsx` | [`Pagination.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/Pagination.tsx) | Dải phân trang thu gọn kích thước chuẩn 22-26px, font 11px. | Các bảng danh sách dữ liệu |
| `CustomAutocomplete.tsx` | [`CustomAutocomplete.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/CustomAutocomplete.tsx) | Ô nhập liệu gợi ý tự động thông minh, hỗ trợ đa nghiệp vụ ngăn cách bởi dấu `;`. | `DocumentPage.tsx`, `PolicyPage.tsx` |
| `UnitFilterSidebar.tsx` | [`UnitFilterSidebar.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/UnitFilterSidebar.tsx) | Cây phân cấp Đơn vị dùng chung để lọc dữ liệu. Trong Quản lý chi phí hỗ trợ đầy đủ 4 cấp loại hình: VPĐH (🏢), Công ty Tỉnh thành (🏬), Văn phòng Công ty (💼 `VP Công ty`), và Showroom Quản trị (🏪). | `ReportsPage.tsx`, `PersonnelPage.tsx`, `CostManagementPage.tsx` |
| `PasteImportModal.tsx` | [`PasteImportModal.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/PasteImportModal.tsx) | Modal dán dữ liệu Excel hàng loạt đa năng, tự động map cột và kiểm tra lỗi. | `PersonnelPage.tsx`, `EquipmentPage.tsx`, `VehiclePage.tsx` |
| `index.ts` | [`index.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ui/index.ts) | Tệp export tập trung cho toàn bộ UI components. | Các trang gọi UI |
| `Sidebar.tsx` | [`Sidebar.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/Sidebar.tsx) | Thanh điều hướng chính bên trái hiển thị 14 phân hệ nghiệp vụ, badge và user profile. | `App.tsx`, `AuthContext.tsx` |
| `EmptyState.tsx` | [`EmptyState.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/common/EmptyState.tsx) | Giao diện trạng thái trống khi không có dữ liệu (hình minh họa và gợi ý thao tác). | Các bảng danh sách |
| `TablePaginationFooter.tsx` | [`TablePaginationFooter.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/common/TablePaginationFooter.tsx) | Chân bảng tích hợp đếm tổng số dòng và điều khiển chuyển trang. | Các bảng danh sách |
| `SkeletonLoader.tsx` | [`SkeletonLoader.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/SkeletonLoader.tsx) | Khung xương tải trang chống giật layout khi đang nạp dữ liệu từ API. | Toàn hệ thống |
| `ExpiryAlert.tsx` | [`ExpiryAlert.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ExpiryAlert.tsx) | Khối banner cảnh báo nhanh các thời hạn nguy cấp. | `DashboardPage.tsx` |
| `ExpiryBadge.tsx` | [`ExpiryBadge.tsx`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/components/ExpiryBadge.tsx) | Badge màu thông minh hiển thị trạng thái hạn (Còn hạn, Sắp hết hạn, Quá hạn). | `EquipmentPage.tsx`, `VehiclePage.tsx` |

---

### 7.11. Tầng Dịch vụ & Cổng kết nối API Gateway (`services/` & `services/api/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Quan hệ Phụ thuộc / Gọi tới |
| :--- | :--- | :--- | :--- |
| `client.ts` | [`client.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/client.ts) | Khởi tạo Supabase client chính thức với URL và Anon Key kết nối cơ sở dữ liệu. | `@supabase/supabase-js` |
| `index.ts` | [`index.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/index.ts) | Cổng API tập trung gom tất cả endpoints thành đối tượng `apiService` duy nhất. | Toàn bộ các module API |
| `modules.ts` | [`modules.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/modules.ts) | Bộ hàm CRUD dữ liệu: Tải song song phân trang (Parallel Batch Fetching), kiểm tra quyền ghi đơn vị (`checkUnitPermission`), truy vấn 38 bảng DB. | `client.ts`, `cache.ts` |
| `auth.ts` | [`auth.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/auth.ts) | Xử lý đăng nhập, kiểm tra tài khoản, đổi mật khẩu và nạp profile người dùng. | `client.ts`, `types/index.ts` |
| `cache.ts` | [`cache.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/cache.ts) | Quản lý bộ nhớ đệm Cache Client-side (Local & Memory Cache) giúp tăng tốc độ tải trang. | `modules.ts` |
| `localStore.ts` | [`localStore.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/localStore.ts) | Cơ chế lưu trữ cục bộ dự phòng khi chạy offline hoặc kiểm thử không kết nối server. | `index.ts` |
| `logs.ts` | [`logs.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/logs.ts) | Ghi nhận nhật ký người dùng (Audit Log) và hàm tự động dọn dẹp log quá hạn (`cleanOldLogs`). | `client.ts`, `logger.ts` |
| `mockData.ts` | [`mockData.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api/mockData.ts) | Dữ liệu mẫu giả lập phục vụ môi trường dev và kiểm thử giao diện ban đầu. | `localStore.ts` |
| `api.ts` | [`api.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/api.ts) | Re-export facade cho các module API. | `services/api/index.ts` |
| `googleDrive.ts` | [`googleDrive.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/services/googleDrive.ts) | Tích hợp Google Drive REST API v3: Quét tìm thư mục/file theo Số khung (VIN) xe và tài liệu PDF. | `VehiclePage.tsx`, `DocumentPage.tsx`, `PolicyPage.tsx` |

---

### 7.12. Tầng Tiện ích & Xử lý Dữ liệu (Utilities: `utils/` - 17 files)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Sử dụng Tại |
| :--- | :--- | :--- | :--- |
| `hierarchy.ts` | [`hierarchy.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/hierarchy.ts) | Thuật toán xử lý cây tổ chức: Ánh xạ Đơn vị ↔ Miền, lọc dữ liệu theo đơn vị được phân quyền (`don_vi_phu_trach`), gộp danh sách đơn vị. Hàm `isCostManagementUnit` nhận diện các đơn vị quản trị chi phí: Văn phòng, CTTT, `VP Công ty` (kiểm tra cả `loai_hinh` & `phan_loai`), Showroom Quản trị. Hàm `getUnitEmoji` gán icon chiếc cặp `💼` cho VP Công ty. | `AccountPage.tsx`, `VehicleLocationPicker.tsx`, `UnitFilterSidebar.tsx`, `CostManagementPage.tsx` |
| `numberToWordsVN.ts` | [`numberToWordsVN.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/numberToWordsVN.ts) | Thuật toán đọc số tiền tự động thành chữ tiếng Việt chuẩn ngân hàng/kế toán (đồng, hào, xu, chữ hoa đầu dòng). | `exportDnttDocx.ts`, `exportDnttPdf.ts`, `DnttTab.tsx` |
| `thacoCostDataEngine.ts` | [`thacoCostDataEngine.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/thacoCostDataEngine.ts) | Động cơ tổng hợp dữ liệu chi phí hành chính theo chuẩn mẫu Báo cáo Ma trận THACO AUTO (Cấp 1, Cấp 2, Đơn vị, Bộ phận). | `CostMatrixView.tsx`, `exportThacoCostReport.ts` |
| `costGroupColors.ts` | [`costGroupColors.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/costGroupColors.ts) | Bảng màu chuyên nghiệp gán theo nhóm chi phí và phân loại KMP phục vụ trực quan hóa biểu đồ và bảng số liệu. | `CostDashboardTab.tsx`, `CostStatisticsTab.tsx` |
| `exportThacoCostReport.ts` | [`exportThacoCostReport.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/exportThacoCostReport.ts) | Tiện ích xuất báo cáo ma trận chi phí THACO ra file Excel đa sheet đúng định dạng chuẩn; phân biệt VPĐH và VP Công ty để tạo sheet chi phí riêng cho đơn vị trực thuộc. | `CostMatrixView.tsx` |
| `exportExcel.ts` | [`exportExcel.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/exportExcel.ts) | Tiện ích xuất Excel dùng chung toàn hệ thống, tự động căn chỉnh độ rộng cột và định dạng header. | Toàn bộ 14 Pages |
| `exportReports.ts` | [`exportReports.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/exportReports.ts) | Bộ sinh báo cáo chuyên sâu đa phân hệ (Nhân sự, Xe, Thiết bị, Quy định, ATVSLĐ) hỗ trợ chèn Hyperlink. | `ReportsPage.tsx` |
| `excelTemplates.ts` | [`excelTemplates.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/excelTemplates.ts) | Bộ mẫu file Excel tải xuống để import hàng loạt, tự động trích xuất 01 bản ghi mẫu tốt nhất từ DB theo 3 tiêu chí. | `PasteImportModal.tsx`, `PersonnelPage.tsx`, `EquipmentPage.tsx` |
| `formatters.ts` | [`formatters.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/formatters.ts) | Bộ hàm định dạng chuẩn: Ngày tháng VN, tiền tệ VND, dung lượng bộ nhớ `formatMemorySize` (GB), làm sạch chuỗi kỹ thuật `cleanTechnicalString`. | Toàn hệ thống |
| `pcccContactParser.ts` | [`pcccContactParser.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/pcccContactParser.ts) | Bộ bóc tách thông minh danh bạ khẩn cấp PC01 từ clipboard PowerPoint/Excel thành 15 đầu mối. | `PcccContactPasteModal.tsx`, `FireSafetyPage.tsx` |
| `vehicleLocationHelper.ts` | [`vehicleLocationHelper.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/vehicleLocationHelper.ts) | Tiện ích phân tích và xử lý chuỗi địa điểm xe 3 cấp. | `VehicleLocationPicker.tsx`, `VehiclePage.tsx` |
| `documentHelpers.ts` | [`documentHelpers.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/documentHelpers.ts) | Tiện ích xử lý số hiệu văn bản, chuẩn hóa từ khóa và gợi ý nghiệp vụ tài liệu. | `DocumentPage.tsx`, `PolicyPage.tsx` |
| `expiryStatus.ts` | [`expiryStatus.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/expiryStatus.ts) | Hàm tính toán khoảng cách ngày đến hạn và trả về trạng thái hạn (đỏ, vàng, xanh). | `ExpiryAlertPanel.tsx`, `ExpiryBadge.tsx` |
| `atvsld.ts` | [`atvsld.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/atvsld.ts) | Tiện ích phân loại nhóm an toàn lao động (Nhóm 1 đến Nhóm 6) và quy tắc kiểm định TBNN. | `AtvsldPage.tsx`, `KhoaHocTab.tsx` |
| `mathEvaluator.ts` | [`mathEvaluator.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/mathEvaluator.ts) | Bộ tính toán biểu thức công thức an toàn không dùng `eval()`. | Các bảng tính toán chi phí |
| `logger.ts` | [`logger.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/logger.ts) | Tiện ích so sánh sai khác dữ liệu cũ/mới (`generateDiffLog`) phục vụ ghi Audit Log. | `logs.ts`, các thao tác Update |
| `toast.ts` | [`toast.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/utils/toast.ts) | Hệ thống hiển thị thông báo phản hồi nhanh góc màn hình (Toast Notification). | Toàn hệ thống |

---

### 7.13. Tầng Kiểu Dữ liệu & Hằng số (`types/` & `constants/`)

| Tên File | Đường dẫn File | Vai trò & Trách nhiệm Chi tiết | Sử dụng Tại |
| :--- | :--- | :--- | :--- |
| `types/index.ts` | [`index.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/types/index.ts) | Định nghĩa toàn bộ TypeScript Interfaces và Types của 14 phân hệ và 38 bảng Supabase CSDL. | Toàn hệ thống |
| `types/cost.ts` | [`cost.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/types/cost.ts) | Định nghĩa các kiểu dữ liệu bổ sung chuyên biệt cho phân hệ Chi phí Hành chính. | `CostManagementPage.tsx`, `DnttTab.tsx` |
| `types/xlsx.d.ts` | [`xlsx.d.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/types/xlsx.d.ts) | Khai báo kiểu TypeScript cho thư viện bảng tính Excel `xlsx` / `xlsx-js-style`. | `exportExcel.ts`, `exportReports.ts` |
| `constants/reportTemplates.ts` | [`reportTemplates.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/constants/reportTemplates.ts) | Danh mục các cấu hình mẫu báo cáo mặc định của hệ thống. | `ReportsPage.tsx`, `ReportList.tsx` |
| `constants/certificates.ts` | [`certificates.ts`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/src/constants/certificates.ts) | Danh mục các loại chứng chỉ, bằng cấp nghề nghiệp và chứng nhận ATVSLĐ. | `PersonnelModal.tsx`, `KhoaHocTab.tsx` |

---

### 7.14. Tầng Cơ sở Dữ liệu & Migrations SQL (`docs/*.sql`)

| Tên File | Đường dẫn File | Vai trò & Mục đích Thực thi SQL | Áp dụng Cho Bảng DB |
| :--- | :--- | :--- | :--- |
| `schema_chi_phi_hc_final.sql` | [`schema_chi_phi_hc_final.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/schema_chi_phi_hc_final.sql) | DDL khởi tạo toàn diện hệ thống bảng Quản lý Chi phí Hành chính (KMP, Bộ phận, DNTT, Bảng phân bổ). | `chi_phi_dntt`, `chi_phi_dntt_chi_tiet`, `dm_kmp`, `dm_bo_phan` |
| `migration_thong_ke_chot_ky.sql` | [`migration_thong_ke_chot_ky.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/migration_thong_ke_chot_ky.sql) | Script tạo bảng Snapshot `chi_phi_chot_ky` và bảng Fact Table `chi_phi_thong_ke` phục vụ chốt kỳ báo cáo. | `chi_phi_chot_ky`, `chi_phi_thong_ke` |
| `migration_pivot_config.sql` | [`migration_pivot_config.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/migration_pivot_config.sql) | Script tạo bảng lưu cấu hình mẫu Pivot tùy biến người dùng và hệ thống. | `chi_phi_pivot_config` |
| `migration_phap_nhan_multi_don_vi.sql` | [`migration_phap_nhan_multi_don_vi.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/migration_phap_nhan_multi_don_vi.sql) | Script chuyển đổi mô hình Pháp nhân dùng chung nhiều đơn vị qua mảng `don_vi_ids TEXT[]`. | `dm_phap_nhan` |
| `migration_chi_phi_tong_hop.sql` | [`migration_chi_phi_tong_hop.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/migration_chi_phi_tong_hop.sql) | Script cập nhật cấu trúc bảng tổng hợp và quan hệ khóa ngoại module Chi phí. | `dm_nhom_chi_phi`, `dm_kmp` |
| `migration_dntt_luu_nhap.sql` | [`migration_dntt_luu_nhap.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/migration_dntt_luu_nhap.sql) | Bổ sung trạng thái lưu nháp (`is_draft`) và cơ chế phê duyệt cho ĐNTT. | `chi_phi_dntt` |
| `fix_config_users_foreign_key.sql` | [`fix_config_users_foreign_key.sql`](file:///i:/My%20Drive/Web%20app/APP_QTVP.ASDS/docs/fix_config_users_foreign_key.sql) | Khắc phục ràng buộc khóa ngoại và phân cấp quản lý người dùng `config_users`. | `config_users` |

---

## 8. NỢ KỸ THUẬT & CÁC CẢI TIẾN ĐÃ HOÀN THÀNH

- [x] **Xây dựng Hoàn chỉnh Phân hệ Quản lý Chi phí Hành chính (CPHC) & Đề nghị thanh toán (DNTT) (`CostManagementPage.tsx`, `DnttTab.tsx`)**:
  - Quản lý vòng đời đầy đủ của phiếu ĐNTT: Lập phiếu, phân bổ KMP chi tiết, lưu nháp, trình ký, phê duyệt, hoàn tất thanh toán.
  - Tự động đồng bộ số tiền tổng hợp từ bảng chi tiết phân bổ `chi_phi_dntt_chi_tiet`.
  - Hỗ trợ đính kèm liên kết hóa đơn điện tử / chứng từ kế toán.
- [x] **Xuất File Word (.docx) & PDF Mẫu Ký Duyệt THACO AUTO Chuẩn Xác (`exportDnttDocx.ts`, `exportDnttPdf.ts`)**:
  - Xuất file Word và PDF đúng thể thức văn bản đề nghị thanh toán của THACO AUTO: Header công ty, số phiếu, người đề nghị, bảng phân bổ KMP, các ô chữ ký phân cấp (Người lập, Kế toán, Lãnh đạo Đơn vị, Ban Giám đốc).
  - Tự động tích hợp thuật toán đọc số tiền thành chữ tiếng Việt chuẩn xác (`numberToWordsVN.ts`).
- [x] **Động cơ Phân tích Đa chiều & Dynamic Pivot Table Engine (`CostPivotBuilder.tsx`, `pivotEngine.ts`, `exportGenericPivotExcel.ts`)**:
  - Trình dựng báo cáo Pivot kéo-thả trực quan Client-side: Người dùng tự do chọn Chiều dòng, Chiều cột, Chỉ số đo lường (Tổng tiền, Số phiếu, Trung bình).
  - Tự động gộp ô đa cấp (Rowspan/Colspan), hiển thị tổng biên (Grand Totals), lưu và nạp mẫu cấu hình từ DB `chi_phi_pivot_config`.
  - Xuất Excel bảng Pivot đa cấp phân tầng giữ nguyên cấu trúc phân nhóm.
- [x] **Cơ chế Chốt Kỳ Báo cáo Chi phí & Bảng Fact Snapshot (`chi_phi_chot_ky`, `chi_phi_thong_ke`)**:
  - Chức năng Chốt kỳ chi phí đóng băng dữ liệu kế toán theo tháng/năm. Khi chốt kỳ, hệ thống tạo bản ghi snapshot tại `chi_phi_chot_ky` và đồng bộ vào bảng Fact `chi_phi_thong_ke`.
  - Ngăn chặn việc sửa đổi số liệu hồi tố, đảm bảo tính toàn vẹn và nhất quán của báo cáo tài chính nội bộ.
- [x] **Mô hình Pháp nhân Dùng chung Đa Đơn vị (`AdminLegalTab.tsx`, `migration_phap_nhan_multi_don_vi.sql`)**:
  - Chuyển đổi từ ràng buộc 1 Pháp nhân - 1 Đơn vị sang mô hình mảng `don_vi_ids TEXT[]`, cho phép một Công ty/Pháp nhân đại diện pháp lý cho nhiều Showroom/Đơn vị trực thuộc.
  - Tự động lọc và hiển thị pháp nhân phù hợp khi tạo DNTT hoặc quản lý tài sản ở từng đơn vị.
- [x] **Bộ chọn Địa điểm Xe 3 cấp (Cascader Location Picker) & Quản lý Lịch trình/Thống kê Xe (`VehicleLocationPicker.tsx`, `VehicleScheduleTab.tsx`, `VehicleStatsTab.tsx`)**:
  - Thiết kế bộ chọn địa điểm 3 cấp (Showroom nội bộ $\rightarrow$ Tỉnh/Thành $\rightarrow$ Quận/Huyện/Địa chỉ) cho lộ trình xuất phát và điểm đến của xe.
  - Quản lý nhật ký lộ trình, số km vận hành, mục đích công tác, tự động tổng hợp hiệu suất và chi phí vận hành xe theo tháng.
- [x] **Cổng Kiểm soát Ghi Dữ liệu Tập trung (`checkUnitPermission`) & Tải Song song Phân trang (Parallel Batch Fetching)**:
  - Tất cả các thao tác Thêm/Sửa/Xóa dữ liệu đều được kiểm tra thẩm quyền qua hàm `checkUnitPermission()` trước khi gửi tới Supabase, ngăn chặn truy cập trái phép.
  - Tối ưu tải dữ liệu lớn bằng thuật toán tải song song nhiều trang đồng thời (Batch size: 1000 records/batch, Concurrency: 3-5 batches), tăng tốc độ tải từ 4-5 giây xuống dưới 0.8 giây đối với các bảng có hàng nghìn bản ghi.

- [x] **Ràng buộc Đơn vị Quản lý ↔ Pháp nhân (Công ty sở hữu)**: Trong Modal Thêm/Sửa thiết bị (`EquipmentPage.tsx`), chọn Đơn vị quản lý tự động lọc danh sách pháp nhân thuộc Đơn vị đó (`dm_phap_nhan` theo `id_don_vi`), hỗ trợ sổ xuống chọn chính xác đối với đơn vị có nhiều pháp nhân trực thuộc.
- [x] **Chuẩn hóa Giao diện Nhập liệu**: Màu nền `#FFFFF0` nhẹ dịu, chữ màu đen rõ ràng và cỡ chữ đồng nhất giữa tất cả các trường dữ liệu trên Modal Thêm mới/Chỉnh sửa thiết bị.
- [x] **Làm sạch Chuỗi Kỹ thuật & Tự thêm đơn vị GB (`utils/formatters.ts`)**: 
  - `cleanTechnicalString`: Xóa khoảng trắng thừa quanh dấu gạch ngang (VD: `i7 - 1185G7` thành `i7-1185G7`).
  - `formatMemorySize`: Nhập số thuần (`512`, `16`) hay chữ dính (`512gb`, `16GB`) $\rightarrow$ tự động gắn đơn vị chuẩn **`512 GB`**, **`16 GB`**. Áp dụng cả khi Dán Excel hàng loạt lẫn Nhập/Sửa từng thiết bị.
- [x] **Form Mẫu Excel Tải Xuất Từ DB theo 3 Tiêu chí (`utils/excelTemplates.ts`)**:
  - Tải Form Mẫu Nhập Hàng Loạt cho **Trang thiết bị văn phòng** và **Nhân sự** tự động trích xuất 01 bản ghi mẫu từ DB thực tế theo ĐÚNG 3 tiêu chí: *1. Điền đầy đủ nhất*, *2. Mới nhất gần thời điểm hiện tại nhất*, *3. Mô tả chi tiết nhất*.
- [x] **Hỗ trợ Đa nghiệp vụ (ngăn cách bằng dấu ";") cho Tài liệu & Quy định**:
  - Tự động tách chuỗi nghiệp vụ ghép (VD: `"Kinh doanh; Nhân sự"`) thành các tag/badge độc lập trên mọi bảng danh sách tài liệu và modal chi tiết.
  - Cập nhật danh sách nhóm nghiệp vụ bên trái ở `PolicyPage.tsx` để hiển thị các nghiệp vụ đơn lẻ, sửa đổi bộ lọc và logic đếm số lượng tài liệu chính xác.
  - Nâng cấp `CustomAutocomplete` ở `DocumentPage.tsx` hỗ trợ tự nhận diện từ khóa và điền gợi ý thông minh sau dấu `;`.
- [x] **utils/logger.tsx trùng lặp đã được xóa**: Đã xóa tệp `utils/logger.tsx` dư thừa, giữ lại `utils/logger.ts` làm nguồn duy nhất chứa logic export hàm `generateDiffLog()`, tránh cảnh báo khi biên dịch.
- [x] **Phân quyền chi tiết (Granular/Advanced Permissions)**: Tích hợp ma trận phân quyền chi tiết (`quyen_chi_tiet`) tại `AccountPage.tsx` để bảo vệ thông tin nhạy cảm ở các phân hệ Nhân sự (`NS_HIDE_SENSITIVE`, `NS_NO_DETAIL`), Thiết bị (`TB_HIDE_PRICE`), Văn bản (`VB_HIDE_BTN`, các quyền xem hạn chế `VB_VIEW_*`), Quy định (`QD_TYPES`, `QD_YEARS`).
- [x] **Tích hợp Google Drive API v3 (`googleDrive.ts` & `DocumentPage.tsx`)**: Xây dựng service tự động quét tìm và liên kết file PDF từ Google Drive. Sử dụng thuật toán so khớp RegExp thông minh ở Client-side hỗ trợ đa tiền tố viết tắt (QĐ/QD, CVĐ/CVD, TTr/TT) giúp tìm chính xác file PDF bất kể sự không đồng nhất về khoảng trắng, dấu chấm phân cách hay hậu tố chữ cái (ví dụ khớp chuẩn: QĐ09, QD34, QĐ.04, QĐ 40, QĐ12B).
- [x] **Nâng cấp giao diện SegmentTabs (`SegmentTabs.tsx`)**: Chuyển đổi toàn bộ cơ chế tab cũ (`LineTabs`) sang `SegmentTabs` sử dụng `motion/react` để tăng tính thẩm mỹ và hiệu năng chuyển động dạng viên thuốc trên toàn bộ các phân hệ chính (Nhân sự, Xe, Thiết bị, Văn bản, ATVSLĐ).
- [x] **Cơ chế bảo mật phiên đăng nhập kết hợp**: Tích hợp kiểm tra phiên bản ứng dụng (`APP_VERSION: '1.1.0'`) để tự dọn dẹp cache, giới hạn phiên đăng nhập tối đa **2 ngày**, và gọi ngầm `apiService.validateAndRefreshUser` trong `AuthContext.tsx` khi mở app để đồng bộ quyền hạn/kiểm tra đổi mật khẩu ngầm.
- [x] **Mẫu báo cáo Quy định - Quy trình hiện hành**: Tích hợp cấu hình mẫu báo cáo mới (`policy_list_report`) vào nhóm Báo cáo Văn bản (hiển thị đối diện với Danh sách Văn bản ban hành), tự động gộp dữ liệu từ 2 nguồn `qd_qt` và `vb_tb` có nghiệp vụ (đảm bảo đầy đủ 116 văn bản), hỗ trợ xem trước, lọc động nâng cao (Bộ phận ban hành, Nghiệp vụ áp dụng, Loại tài liệu, Năm ban hành) và xuất Excel 01 Sheet chuẩn 8 cột (STT, Số hiệu, Tiêu đề, Trích yếu, Nghiệp vụ, Bộ phận ban hành, Ngày ban hành, Đính kèm) có chèn Hyperlink.
- [x] **Mở rộng Nhật ký & Dọn dẹp Log tự động**: Tích hợp cơ chế tự động ghi log Audit khi người dùng thực hiện thao tác **Xem chi tiết** đối tượng (Đơn vị, Nhân sự, Xe, Thiết bị, Nhà cung cấp, Văn bản, Quy định) hoặc khi **Xuất Excel** trên toàn hệ thống. Đồng thời xây dựng hàm `cleanOldLogs(5)` tự động xóa sạch log quá hạn 5 ngày chạy ngầm khi tải ứng dụng.
- [x] **Chuẩn hóa thống kê Nhân sự trang Tổng quan**: Khắc phục lỗi thống kê lệch số lượng nhân sự các nhóm (QTVP, Bảo vệ, PVHC) tại thẻ KPI trang Tổng quan (`DashboardPage.tsx`) bằng cách chuyển sang quét đồng bộ theo phòng ban (`phong_ban`) và phân loại (`phan_loai`) tiếng Việt có dấu tương thích với trang quản lý nhân sự.
- [x] **Xây dựng hoàn thiện phân hệ Khám sức khỏe & Bệnh nghề nghiệp (`SucKhoeTab.tsx`)**: Đã phát triển thành công giao diện và logic hoàn chỉnh, hỗ trợ nhập dữ liệu KSK cá nhân, dán Excel tự động chuẩn hóa chữ hoa, tự động tính toán đợt KSK tổng hợp cấp đơn vị và đồng bộ phân tách bộ lọc: ma trận lọc theo đơn vị hiện tại (xem tiến trình điều chuyển) và danh sách lọc theo đơn vị lúc khám thực tế.
- [x] **Nâng cấp Đào tạo/Huấn luyện sang cơ chế Matrix & List View (`KhoaHocTab.tsx`)**: Tích hợp SubTab để phân nhóm xem "Danh sách khóa học" và "Lịch sử cá nhân". Bảng ma trận hiển thị lịch sử qua các năm (cột năm động) kèm timeline chi tiết, bảng danh sách lọc theo đơn vị lúc học để báo cáo chi phí. Tích hợp nút xuất Excel đề xuất học đợt tiếp theo chuẩn 14 cột. Hỗ trợ validate và đồng bộ ngược thông minh toàn hệ thống theo MSNV kể cả khi nhân sự đã điều chuyển đơn vị.
- [x] **Nâng cấp Tooltip Bản đồ Showroom & Chọn điểm dừng chân 1-Click (`DepartmentMapModal.tsx`)**: Popup đơn vị thiết kế mini-card bọc khung vừa khít (`custom-showroom-popup`, `minWidth: 380px`, `maxWidth: 480px`), trình bày 4 dòng thông tin chuẩn (Lãnh đạo, Diện tích, Số cổng, Quy mô, Lượt khách BQ, Tổng CB-NV theo `tong_nhan_su`), AN-BV (Nội bộ/Dịch vụ, Ca ngày/Ca đêm Cố định/Tuần tra), Tiếp giáp 4 hướng nguyên văn 100% không bị ba chấm `...`, Camera (Hoạt động tốt/Hư hỏng). Hỗ trợ 1-click chọn điểm dừng chân / ghé thăm trực tiếp từ marker bản đồ.
- [x] **Đồng bộ Giao diện Tab & Modal Hồ sơ Nhân sự (`PersonnelPage.tsx` & `PersonnelModal.tsx`)**: Đặt màu xanh thương hiệu `#00539c` cho khối tab lồng liền mạch cấp 1 & cấp 2, cột Họ và tên `whitespace-nowrap`, di chuyển Lịch sử KSK cá nhân vào Modal Xem Chi Tiết Hồ Sơ Nhân Sự phía trên khối Ghi chú khác.
- [x] **Đồng bộ ATVSLĐ Nhân sự Kiêm nhiệm (`KhoaHocTab.tsx`) & Custom Confirm Modal Xóa (`SucKhoeTab.tsx`)**: Tự động quét MSNV đồng bộ trạng thái/chứng chỉ ATVSLĐ cho toàn bộ hồ sơ công tác chính và kiêm nhiệm. Đồng bộ Custom Confirm Modal phông mờ backdrop blur thay thế `window.confirm` native.
- [x] **Tối ưu Dải Phân Trang (`Pagination.tsx`)**: Thu gọn dải phân trang chiều cao `22px - 26px`, font size `11px`.
- [x] **Dán Bảng Danh bạ Khẩn cấp PCCC (Mẫu PC01) từ PowerPoint/Excel & Bảng đối soát 15 đầu mối (`pcccContactParser.ts`, `PcccContactPasteModal.tsx`, `hs_pccc`)**:
  - Xây dựng tiện ích phân tích cú pháp thông minh (`src/utils/pcccContactParser.ts`) bóc tách dữ liệu bảng từ clipboard: ưu tiên parse HTML Table khi copy trực tiếp từ slide PowerPoint hoặc Excel, tự động fallback phân tích dạng plain text theo Tab (`\t`), gạch đứng (`|`) hoặc khoảng trắng.
  - Tự động làm sạch các thẻ ngoặc vuông `[...]` (nếu có), phần mở ngoặc đơn `(...)` và chuẩn hóa số điện thoại theo định dạng chuẩn 4-3-4 bằng `formatPhoneNumber`.
  - Nhận diện và **bỏ qua dòng 113** (Cảnh sát Phản ứng nhanh), **bỏ qua cột 5** (Ghi chú).
  - Bổ sung 6 cột vào bảng CSDL `hs_pccc`: `ten_giam_doc`, `sdt_giam_doc`, `ten_ptkd_dvpt`, `sdt_ptkd_dvpt`, `ten_ptkd_xe`, `sdt_ptkd_xe` để lưu độc lập thông tin liên hệ của 3 vị trí Lãnh đạo Showroom/Đơn vị.
  - Cơ chế gợi ý / fallback: Nếu chưa nhập riêng trong PCCC, tự động gợi ý/hiển thị từ Mục A (Nhân sự đơn vị). Cập nhật Popup Danh bạ Khẩn cấp ngoài trang tự động ưu tiên lấy thông tin lãnh đạo từ hồ sơ PCCC nếu Mục A chưa có.
  - Đồng bộ đồng thời trên cả 2 phân hệ: `DepartmentPage.tsx` (Mục F. Phòng chống cháy nổ), `FireSafetyPage.tsx` (Thêm/Sửa hồ sơ PCCC) và `PcccModal.tsx`.

  ##### 📋 BẢNG ĐỐI SOÁT ÁNH XẠ DỮ LIỆU DANH BẠ KHẨN CẤP PCCC (MẪU PC01)

  | STT Slide | Cơ quan / Bộ phận (PowerPoint) | Từ khóa nhận diện tự động (Match Patterns) | Trường Tên DB (`hs_pccc`) | Trường SĐT DB (`hs_pccc`) | Cơ chế xử lý & Ghi chú nghiệp vụ |
  | :---: | :--- | :--- | :--- | :--- | :--- |
  | **1** | Cảnh sát Phản ứng nhanh (113) | `113`, `phan ung nhanh` | *(Bỏ qua)* | *(Bỏ qua)* | 🔴 **Bỏ qua hoàn toàn**, không ghi vào CSDL |
  | **2** | Cảnh sát PCCC | `canh sat pccc`, `cs pccc`, `pccc va cnch`, `phong pccc` | `ten_ca_pccc` | `sdt_ca_pccc` | Hotline Cảnh sát PCCC & CNCH địa phương |
  | **3** | Cấp cứu y tế | `cap cuu y te`, `cap cuu`, `115` | `ten_yte` | `sdt_yte` | Cơ sở cấp cứu y tế 115 / trung tâm y tế |
  | **4** | Bảo vệ dân phố / Dân quân tự vệ | `dan pho`, `dan quan tu ve`, `dan quan`, `tu ve` | `ten_bv_dan_quan` | `sdt_bv_dan_quan` | Lực lượng an ninh nhân dân địa phương |
  | **5** | Công an khu vực | `cong an khu vuc`, `ca khu vuc` | `ten_ca_khu_vuc` | `sdt_ca_khu_vuc` | Công an phụ trách địa bàn |
  | **6** | Công an Xã/Phường | `cong an xa`, `cong an phuong`, `ca xa`, `ca phuong` | `ten_ca_xa_phuong` | `sdt_ca_xa_phuong` | Trụ sở Công an Xã/Phường sở tại |
  | **7** | PCCC Xã/Phường | `pccc xa`, `pccc phuong` | `ten_pccc_xa_phuong` | `sdt_pccc_xa_phuong` | Đội PCCC cấp Xã/Phường |
  | **8** | Điện lực khu vực | `dien luc`, `dien luc khu vuc` | `ten_dien_luc` | `sdt_dien_luc` | Điện lực khu vực hỗ trợ cắt điện |
  | **9** | Giám đốc Showroom | `giam doc showroom`, `giam doc don vi`, `giam doc` | `ten_giam_doc` | `sdt_giam_doc` | 🟢 Ghi nhận trực tiếp vào PCCC; Gợi ý từ Mục A nếu chưa nhập riêng |
  | **10** | Giám đốc / PT KD DVPT | `ban hang dvpt`, `kinh doanh dvpt`, `dvpt`, `dich vu phu tung`, `ptkd dvpt` | `ten_ptkd_dvpt` | `sdt_ptkd_dvpt` | 🟢 Ghi nhận trực tiếp vào PCCC; Gợi ý từ Mục A nếu chưa nhập riêng |
  | **11** | Giám đốc / PT KD Xe | `ban hang xe`, `kinh doanh xe`, `kd xe`, `ptkd xe` | `ten_ptkd_xe` | `sdt_ptkd_xe` | 🟢 Ghi nhận trực tiếp vào PCCC; Gợi ý từ Mục A nếu chưa nhập riêng |
  | **12** | Phụ trách Kho xe & Lái xe | `kho xe`, `lai xe`, `phu trach kho xe` | `ten_kho_xe` | `sdt_kho_xe` | Điều động di dời xe khi khẩn cấp |
  | **13** | Tổ trưởng bảo vệ, đón tiếp KH | `to truong bao ve`, `don tiep khach hang`, `tt bao ve`, `don tiep kh` | `ten_tt_bao_ve` | `sdt_tt_bao_ve` | Phụ trách lực lượng bảo vệ, mở cổng thoát hiểm |
  | **14** | Phụ trách QTVP (Hành chính) | `dich vu ho tro kd`, `ho tro kd`, `hanh chinh`, `vp cty`, `qtvp`, `hc ns` | `ten_hc_ns` | `sdt_hc_ns` | Hậu cần, cứu nạn và điều phối |
  | **15** | Cơ sở y tế gần nhất (ký HĐ y tế) | `hop dong y te`, `y te gan nhat`, `bv lien ket`, `co so y te gan nhat` | `ten_bv_lien_ket` | `sdt_bv_lien_ket` | Bệnh viện/cơ sở y tế ký hợp đồng |

  > 📌 **Script DDL Supabase Database:**
  > ```sql
  > ALTER TABLE hs_pccc 
  > ADD COLUMN IF NOT EXISTS ten_giam_doc TEXT, 
  > ADD COLUMN IF NOT EXISTS sdt_giam_doc TEXT, 
  > ADD COLUMN IF NOT EXISTS ten_ptkd_dvpt TEXT, 
  > ADD COLUMN IF NOT EXISTS sdt_ptkd_dvpt TEXT, 
  > ADD COLUMN IF NOT EXISTS ten_ptkd_xe TEXT, 
  > ADD COLUMN IF NOT EXISTS sdt_ptkd_xe TEXT;
  > ```

- [x] **Trường Hồ sơ xe & Tự động quét tìm Drive (File / Folder) theo Số khung (`VehiclePage.tsx`, `googleDrive.ts`, `ts_xe`)**:
  - Bổ sung trường `ho_so_xe` trong bảng `ts_xe` và `TS_Xe` interface để lưu link xem hồ sơ xe trên Google Drive.
  - Tích hợp tính năng **"Tự động tìm file trên Drive"** tại modal Thêm/Sửa xe: Quét thư mục Google Drive `Hồ sơ Xe` (Folder ID: `1UZ5ZUTPrOZ4-ClAbxCgTQ8pbn8d6CzSa`) bằng Google Drive API v3 (quét cả file trực tiếp lẫn thư mục con cấp 1).
  - **Quy tắc so khớp nghiêm ngặt theo SỐ KHUNG (VIN)**: Hỗ trợ nhận diện cả **Tệp tin (File)** (PDF, RAR, ZIP, DOC...) lẫn **Thư mục (Folder)** mang tên Số khung xe. So khớp normalized Số khung (loại bỏ phần mở rộng, ký tự phân cách, dấu chấm, gạch ngang, khoảng trắng, không phân biệt hoa thường). Tuyệt đối không quét theo biển số xe.
  - Vị trí trường nhập: Đặt ngay dưới các trường Định vị GPS và Hiện trạng, phía trên phần Ghi chú khác trong modal Thêm/Cập nhật xe.
  - Hiển thị trực quan: Icon `FileText` cạnh biển số xe trên Bảng danh sách desktop và Thẻ mobile kèm tooltip `"Xem hồ sơ xe"`, mở trực tiếp file hoặc thư mục Drive trong tab mới. Modal xem chi tiết xe bổ sung ô "Hồ sơ xe" và nút `[ Xem hồ sơ ↗ ]`. Hỗ trợ cả dán Excel hàng loạt với cột "Hồ sơ xe".
  - **Lưu ý Phân quyền Thư mục Google Drive**: Thư mục Google Drive `Hồ sơ Xe` phải được bật quyền truy cập chung là **"Bất kỳ ai có đường liên kết"** ➔ **"Người xem"** (Viewer) để Google Drive REST API cho phép đọc dữ liệu qua API Key Client-side mà không bị chặn bởi lỗi 404 bảo mật của Google.

  > 📌 **Script DDL Supabase Database:**
  > ```sql
  > ALTER TABLE ts_xe 
  > ADD COLUMN IF NOT EXISTS ho_so_xe TEXT;
  > ```



- [ ] Bảng `dm_chu_ky_atvsld` có hàm `getChuKyATVSLD()` trong `modules.ts` nhưng KHÔNG tìm thấy nơi nào trong `components/`/`pages/` gọi hàm này hoặc dùng chuỗi `'dm_chu_ky_atvsld'` trực tiếp — khả năng là bảng chưa được nối vào UI, hoặc đã lệch tên biến. Cần kiểm tra lại thủ công trước khi phát triển thêm module ATVSLĐ.
- [ ] `AtvsldPage.tsx` đã refactor tab (`HoSoTab`, `KeHoachTab`, `KhoaHocTab`, `StrictEquipmentTab`) nhưng bản thân `AtvsldPage.tsx` vẫn còn 663 dòng logic dùng chung (state, modal, hàm `getRegionName`) — có thể tách tiếp nếu muốn gọn hơn.
- [ ] `PersonnelPage.tsx` (2851 dòng) và `CuocDiDongTab.tsx` (3366 dòng) là 2 file lớn nhất hệ thống — ứng viên hàng đầu để tách nhỏ nếu tiếp tục mở rộng module Cước ĐTDĐ.
- [ ] `services/api/client.ts` chứa `SUPABASE_ANON_KEY` hardcode trực tiếp trong source — đây là anon key public (được bảo vệ bởi RLS ở phía Supabase) nên không phải lỗi bảo mật nghiêm trọng, nhưng nên chuyển sang biến môi trường (`.env` + Vite `import.meta.env`) để dễ đổi giữa môi trường dev/prod sau này.

---

## 9. QUY CHUẨN THIẾT KẾ GIAO DIỆN (UI/UX DESIGN SYSTEM SPECIFICATIONS)

Quy chuẩn này là **nguyên tắc bắt buộc** cho toàn bộ 14 phân hệ của ứng dụng QTVP-ASDS nhằm đảm bảo tính đồng nhất về thẩm mỹ, kích thước chuẩn xác và trải nghiệm người dùng cao cấp.

### 9.1. Giao diện Tabs Phân cấp Liền khối (Nested Connected Tabs - NCT) & Hiệu ứng Trượt FlyonUI
Áp dụng cho các trang có phân cấp tab con:
- **Quản lý Xe:** *Danh sách xe* $\rightarrow$ *Hiện hữu | Thanh lý*; *Lịch trình & Nhật ký*; *Thống kê xe*.
- **Quản lý ATVSLĐ:** *Hồ sơ Báo cáo cơ sở* $\rightarrow$ *Định kỳ | Đột xuất*; *Kế hoạch ATVSLĐ*; *Khóa học đào tạo* $\rightarrow$ *Danh sách | Lịch sử cá nhân*; *Thiết bị nghiêm ngặt*; *Khám sức khỏe*.
- **Quản lý Chi phí Hành chính (CPHC):** *Đề nghị thanh toán (DNTT)*; *Thống kê chi phí* $\rightarrow$ *Báo cáo Ma trận & Pivot | Biểu đồ Dashboard*; *Cấu hình KMP*; *Phân quyền & Quản trị*.

1. **Hình học & Cấu trúc bao bọc (Single Container Geometry)**:
   - Tab cha và hàng sub-tab con **BẮT BUỘC** phải nằm chung trong **cùng 1 container bảo vệ duy nhất** (`gap: 0`).
   - Tuyệt đối **KHÔNG ĐƯỢC** tách rời thành 2 khối container độc lập với khoảng hở ngăn cách ở giữa.
   - **Khối chuyển tiếp liền mạch (Seamless Connection)**: Khi tab cha được kích hoạt (`active`), phần chân tab nối liền không có viền ngăn cách với dải tab con bên dưới (`rounded-t-xl rounded-b-none pb-2.5 sm:pb-3`), màu nền tab cha active tiệp hoàn toàn với màu dải sub-tab con.
   - Container bao ngoài sử dụng nền `bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80`.
2. **Hiệu ứng Viên thuốc Trượt FlyonUI (FlyonUI Sliding Pill Effect)**:
   - Sử dụng thư viện `motion.div` (`motion/react` / Framer Motion).
   - Khai báo thuộc tính `layoutId` duy nhất cho mỗi cấp tab (VD: `layoutId="costSubTab"`, `layoutId="costStatSubTab"`, `layoutId="vehicleSubTab"`, `layoutId="atvsldSubTab"`).
   - Thông số chuyển động: `transition={{ type: "spring", stiffness: 400, damping: 30 }}` giúp viên thuốc nền trượt êm ái, co giãn tự nhiên khi chuyển tab.
3. **Hiển thị Huy hiệu Số lượng (Count Badges)**:
   - Toàn bộ tab cha và tab con phải hiển thị kèm số lượng bản ghi tương ứng trong ngoặc:
     * *Tab cha*: `Danh sách xe (2) | Lịch trình & Nhật ký | Thống kê`
     * *Sub-tab*: `Hiện hữu (2) | Thanh lý (0)`
     * *CPHC*: `Đề nghị thanh toán (DNTT) (15) | Thống kê chi phí | Cấu hình KMP (42) | Phân quyền & Quản trị`
   - Badge bo tròn nhỏ (`text-xs font-semibold px-1.5 py-0.5 rounded-full`), tự động đổi màu tương phản phù hợp theo trạng thái active/inactive.

---

### 9.2. Kích thước & Quy cách Thanh Công Cụ (Header Toolbar Specifications)

| Thành phần | Kích thước Pixels | Kích thước Inches | Màu sắc & Kiểu dáng | Trạng thái Tương tác & Phân lớp Z-Index |
| :--- | :---: | :---: | :--- | :--- |
| **Ô tìm kiếm (Search Input)** | **256 x 32 px** | `2.766 x 0.3458 in` | • Nền vàng nhạt chống lóa: `#FFFFF0`<br>• Viền xám: `border-gray-200`<br>• Bo góc: `rounded-lg` | • **Focus**: Viền & Ring xanh thương hiệu `#05469B` (hoặc màu đặc trưng phân hệ)<br>• Icon kính lúp 14px căn giữa dọc bên trái<br>• Phông chữ `text-xs` (12-13px) |
| **Nút Tính năng (Features Button)** | **119 x 32 px** | `1.286 x 0.3458 in` | • Mặc định: Nền trắng `bg-white`, chữ `text-gray-800`, viền `border-gray-200`<br>• Bo góc: `rounded-lg` | • **Active / Mở Menu**: Đổi sang màu đặc trưng mô-đun, chữ trắng.<br>• **Z-Index**: Nút `z-50`, backdrop `z-[90]`, dropdown menu **`z-[100]`** nổi tuyệt đối trên `sticky thead` (`z-10`). |
| **Nút Đồng bộ Dữ liệu (Sync Button)** | **24 x 24 px** | `0.2594 x 0.2594 in` | • Nền trắng `bg-white`<br>• Viền mỏng `border-gray-200`<br>• Bo góc `rounded-md` | • Icon `RotateCcw` 13px.<br>• **Đang tải / Bấm**: Quay vòng `animate-spin` với màu đặc trưng của mô-đun. |
| **Nút Ban hành** *(VTLT & Quy định)* | **Cao 27 px** | Chiều cao chuẩn `27px` | • Bo góc `rounded-lg`, `px-3 text-xs`<br>• Màu xanh thương hiệu `#05469B` | • **Bố cục**: Cùng 1 dòng duy nhất (`flex-nowrap`, không ngắt dòng) với Ô tìm kiếm, Nút đồng bộ và Bộ lọc. |

---

### 9.3. Bảng Màu Đặc Trưng Theo Phân Hệ (Module Characteristic Colors)

| Phân hệ Nghiệp vụ | Mã màu Hex / Tailwind | Tông màu hiển thị (Active Gradient) |
| :--- | :--- | :--- |
| 👥 **Thông tin Nhân sự** | `#05469B` | `bg-gradient-to-r from-[#05469B] to-[#0a5bc4]` (Xanh dương) |
| 🚗 **Quản lý Xe Demo / Mobile Service** | `#05469B` | `bg-gradient-to-r from-[#05469B] to-[#0a5bc4]` (Xanh dương) |
| 💻 **Quản lý Thiết bị VP (TTB VP)** | `#05469B` | `bg-gradient-to-r from-[#05469B] to-[#0a5bc4]` (Xanh dương) |
| 🤝 **Quản lý Nhà cung cấp (NCC)** | `#05469B` | `bg-gradient-to-r from-[#05469B] to-[#0a5bc4]` (Xanh dương) |
| 💰 **Quản lý Chi phí Hành chính (CPHC)** | `#D97706` | `bg-gradient-to-r from-amber-600 to-yellow-600` (Hổ phách - Amber) |
| 📄 **Quản lý VTLT & Thông báo** | `#05469B` | `bg-gradient-to-r from-[#05469B] to-[#0a5bc4]` (Xanh dương) |
| 📜 **Quản lý Quy định & Quy trình** | `#05469B` | `bg-gradient-to-r from-[#05469B] to-[#0a5bc4]` (Xanh dương) |
| 🧯 **Quản lý Hồ sơ PCCC & CNCH** | `#dc2626` | `bg-gradient-to-r from-red-600 to-rose-700` (Đỏ cảnh báo) |
| 🛡️ **Quản lý ATVSLĐ & TBNN** | `#16a34a` | `bg-gradient-to-r from-emerald-600 to-teal-700` (Xanh an toàn) |

---

### 9.4. Ma Trận Thao Tác Trong Menu Dropdown "Tính Năng"
- **👥 Thông tin Nhân sự**: `Thêm từng nhân sự` | `Thêm hàng loạt` | `Xuất báo cáo`.
- **🚗 Quản lý Xe**:
  - `Lọc nâng cao`: Mở rộng / thu gọn thanh slicer bộ lọc chi tiết (*Tất cả Hãng | Tất cả Loại xe | Tất cả Mục đích | Tất cả Tình trạng*).
  - `Thêm từng xe`: Mở modal thêm xe mới đơn lẻ.
  - `Thêm hàng loạt`: Mở modal dán dữ liệu Excel nhiều xe cùng lúc.
- **💰 Quản lý Chi phí Hành chính (CPHC)**:
  - `Tạo ĐNTT mới`: Mở modal lập Giấy đề nghị thanh toán.
  - `Thống kê chi phí`: Chuyển sang màn hình Báo cáo Ma trận & Pivot.
  - `Xuất Word/PDF`: Xuất mẫu phiếu ký duyệt THACO AUTO.
  - `Xuất Ma trận Excel THACO`: Xuất bảng chi phí phân cấp theo đơn vị và bộ phận.
  - `Cấu hình KMP`: Thêm/sửa danh mục khoản mục phí (màu đặc trưng hổ phách `#D97706`).
- **🧯 Hồ sơ PCCC**: `Thêm mới Hồ sơ PCCC` (màu đặc trưng đỏ `#dc2626`).
- **🛡️ Quản lý ATVSLĐ**: `Thêm Báo cáo cơ sở` (màu đặc trưng xanh lá `#16a34a`).
- **💻 Trang thiết bị VP**: `Quét QR` | `Thêm từng thiết bị` | `Thêm hàng loạt` (màu đặc trưng xanh dương `#05469B`).
- **🤝 Nhà cung cấp**: `Thêm Đối tác` (màu đặc trưng xanh dương `#05469B`).

---

## 10. PROMPT MẪU KHI LÀM VIỆC VỚI AI

1. Dán `ARCHITECTURE.md` kèm: *"Đây là bản đồ kiến trúc hệ thống, đọc kỹ trước khi làm."*
2. Tra bảng mục 3 (Bảng ánh xạ phân hệ ↔ file ↔ bảng DB) và **mục 7 (Bảng tra cứu hệ thống vai trò toàn bộ file)** theo tên chức năng để biết chính xác Page / Component / Tiện ích / Bảng dữ liệu cần thao tác.
3. Gửi kèm các file `.tsx` hoặc `.ts` liên quan trực tiếp.
4. Sau khi AI hoàn thành, yêu cầu: *"Đề xuất nội dung cần cập nhật vào bảng mục 3, mục 7 (tra cứu file), mục 8 (nợ kỹ thuật & cải tiến đã hoàn thành) và mục 9 (quy chuẩn UI/UX)."*


