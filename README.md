# 🏢 HỆ THỐNG QUẢN TRỊ VĂN PHÒNG & AN SINH ĐỜI SỐNG (QTVP-ASDS)

Tài liệu này cung cấp bức tranh toàn cảnh 100% về kiến trúc, tất cả 13 phân hệ nghiệp vụ, cơ chế phân quyền, nguyên tắc tối ưu hiệu năng và giải thích cấu trúc file dự án **QTVP-ASDS**.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ (SYSTEM OVERVIEW & TECH STACK)

### 1.1. Mục tiêu Hệ thống
* **Mục tiêu:** Số hóa, chuẩn hóa và quản trị tập trung toàn bộ các mảng nghiệp vụ: **QTVP&ASĐS - Nhân sự - Tài sản - Xe - Thiết bị - PCCC - ATVSLĐ - An ninh Bảo vệ - VTLT - Báo cáo** cho hệ thống Đơn vị Công ty Tỉnh thành/Showroom/Điểm bán hàng trực thuộc trên toàn quốc.
* **Mô hình kiến trúc:** Single Page Application (SPA) React + TypeScript kết hợp Supabase REST API & Smart Two-Layer Cache.
* **Cơ chế phân quyền:** Quản trị phân quyền dựa trên cây dữ liệu đệ quy (Hierarchy-based Access Control) kết hợp vai trò người dùng (Role-based Access Control).

### 1.2. Công nghệ sử dụng (Tech Stack)
* **Core Frontend:** React 19, TypeScript 5.8 (Strict Type Checking), Vite 6.
* **Giao diện & Biểu tượng:** Tailwind CSS v4, Lucide React Icons, Motion (Framer Motion).
* **Mã QR & Tiện ích:** `qrcode.react`, `html5-qrcode` (Quét & tạo mã QR tài sản).
* **Backend & Database:** Supabase (PostgreSQL Database, REST API, Row Level Security).
* **Xuất Báo cáo & Excel:** Xuất file Excel HTML/XML đa sheet hỗ trợ tiếng Việt có dấu.

---

## 2. BẢN ĐỒ TẤT CẢ 13 PHÂN HỆ NGHIỆP VỤ (MODULE SITEMAP)

Hệ thống bao gồm 13 phân hệ chính được tích hợp liền mạch trên thanh Sidebar bên trái:

```text
QTVP-ASDS App
├── 📊 01. Tổng quan (Dashboard)
├── 🏢 02. Đơn vị & Sơ đồ tổ chức (Departments)
├── 👥 03. Quản lý Nhân sự & Cước Di động (Personnel)
├── 🧯 04. Quản lý PCCC & CNCH (Fire Safety)
├── 🛡️ 05. Quản lý ATVSLĐ & Thiết bị Nghiêm ngặt (ATVSLĐ)
├── 🚗 06. Quản lý Xe & Chi phí Vận hành (Vehicles)
├── 💻 07. Quản lý Trang thiết bị & QR Code (Equipments)
├── 🤝 08. Quản lý Nhà cung cấp (Suppliers)
├── 📄 09. Quản lý Văn bản & Thông báo (Documents)
├── 📜 10. Quản lý Quy định & Quy trình (Policies)
├── 📊 11. Báo cáo Tổng hợp & Custom Builder (Reports)
├── 👤 12. Quản lý Tài khoản (Accounts)
└── 📜 13. Nhật ký Hệ thống (System Logs)
```

---

### 🟢 CHI TIẾT TÍNH NĂNG TỪNG PHÂN HỆ

#### 📊 01. Phân hệ Tổng quan (DashboardPage.tsx)
- **Hệ thống Thẻ KPI**: Hiển thị tổng số nhân sự, đơn vị, xe, thiết bị, tình hình PCCC và ATVSLĐ thuộc phạm vi quản lý. Số liệu nghiệp vụ nhân sự được phân loại đồng bộ với trang Nhân sự: nhóm Bảo vệ (phòng ban hoặc phân loại chứa "BV, ĐTKH"), nhóm PVHC (phòng ban chứa "PVHC") và nhóm QTVP & ASĐS (phòng ban chứa "QTVP" hoặc phân loại chứa "PT QTVP").
- **Biểu đồ Nhân sự (PersonnelDoughnutChart.tsx)**: Phân tích cơ cấu nhân sự theo phân loại, thâm niên, độ tuổi và giới tính.
- **Bảng Cảnh báo Hạn (ExpiryAlertPanel.tsx)**: Tự động gom nhóm các đối tượng Sắp hết hạn / Quá hạn (Biên bản kiểm định thiết bị nghiêm ngặt, Chứng chỉ ATVSLĐ, Bảo hiểm chay nổ PCCC, Bơm sạc bình PCCC, Kiểm định xe...).
- **Tùy chỉnh Dashboard (DashboardCustomizerModal.tsx)**: Cho phép bật/tắt và sắp xếp các widget theo sở thích cá nhân.

#### 🏢 02. Phân hệ Đơn vị & Sơ đồ Tổ chức (DepartmentPage.tsx)
- **Cấu trúc Cây Đơn vị đệ quy**: Quản lý cấp quan hệ cha-con từ Văn phòng Điều hành -> Công ty Tỉnh thành -> Showroom / Điểm bán hàng.
- **Quản lý Pháp nhân (PnModal.tsx)**: Lưu giữ thông tin Mã số thuế, tên công ty, địa chỉ xuất hóa đơn, giấy phép kinh doanh.
- **Quản lý Phòng họp (PhModal.tsx)**: Quản lý vị trí, sức chứa, thiết bị trình chiếu, thiết bị họp online, layout bàn ghế.
- **Tích hợp các Sub-modal nghiệp vụ**: Nhật ký An ninh bảo vệ (SecurityModal), Phục vụ hành chính (PvhcModal), PCCC (PcccModal), ATVSLĐ (AtvsldModal), PCTT (PcttModal).
- **Sơ đồ Mạng lưới & Lộ trình Showroom (`DepartmentMapModal.tsx`)**:
  - *Bản đồ Phủ bán kính & Tính khoảng cách OSRM*: Lọc loại hình đơn vị, tính chuỗi khoảng cách đường bộ / chim bay, đề xuất lộ trình ghé thăm tối ưu.
  - *Popup Tooltip Đơn vị Sang trọng Bọc vừa khít*: Thẻ Popup bản đồ dạng Mini-card bọc khung vừa khít (`custom-showroom-popup`, `minWidth: 380px`, `maxWidth: 480px`), trình bày thẳng hàng 4 dòng thông tin chuẩn:
    * **Dòng 1**: Lãnh đạo & SĐT liên hệ.
    * **Dòng 2**: Diện tích mặt bằng (`m²`) & Số cổng ra vào.
    * **Dòng 3**: Quy mô (tầng, hầm).
    * **Dòng 4**: Lượt khách BQ & Tổng CB-NV (lấy chuẩn từ `tong_nhan_su` trong bảng `dm_don_vi`).
    * **Khối AN-BV & Phương án**: AN-BV Định biên / Hiện hữu, phân bổ ca ngày / ca đêm, chữ viết đầy đủ không viết tắt (*Nội bộ*, *Dịch vụ*, *Cố định*, *Tuần tra*).
    * **Tiếp giáp địa bàn**: Tách biệt 4 hướng **• Trước**, **• Sau**, **• Trái**, **• Phải** dạng block lưới 2 cột ngắt dòng tự nhiên (`break-words`), **nguyên văn 100% không bị ba chấm `...`**.
    * **Camera & Giám sát**: Tổng số mắt camera (Hoạt động tốt / Hư hỏng) và đánh giá an ninh địa bàn.
  - *Chọn Điểm Dừng Chân 1-Click Trên Bản Đồ*: Chọn/thêm điểm dừng chân (Tab Khoảng cách) hoặc điểm ghé thăm (Tab Tuyến tối ưu) trực tiếp bằng cách click vào marker bản đồ hoặc bấm nút thao tác nhanh trong Popup HTML.

#### 👥 03. Phân hệ Quản lý Nhân sự & Cước Di động (PersonnelPage.tsx)
- **Hồ sơ Nhân sự 360°**: Quản lý đầy đủ mã nhân viên, họ tên, chức danh, bộ phận, khối, ngạch lương, thâm niên, ngày nhận việc, CCCD, thông tin xe cá nhân, bằng cấp chứng chỉ (ANBV, PCCC, CNCH, Sơ cấp cứu, Võ thuật, GPLX, Tin học, Ngoại ngữ...).
- **Giao diện Tab Liền Khối Màu Xanh Thương Hiệu**: Đặt màu xanh thương hiệu `#00539c` (RGB `0, 82, 156`) làm chuẩn đồng bộ cho các khối tab lồng liền mạch cấp 1 & cấp 2.
- **Tối ưu Bảng Danh sách & Modal Xem Chi Tiết**: Cột "Họ và tên" `whitespace-nowrap` hiển thị thẳng hàng không bị xuống dòng / ba chấm. Khối **Lịch Sử Khám Sức Khỏe & BNN Cá Nhân** được di chuyển sang Modal Xem Chi Tiết Hồ Sơ Nhân Sự, đặt nằm phía trên khối "Ghi chú khác".
- **Quản lý Thuê bao & Cước di động (`CuocDiDongTab.tsx`)**:
  - Quản lý danh mục số thuê bao công ty cấp cho nhân sự/bộ phận.
  - Theo dõi lịch sử người sử dụng thuê bao (`lich_su_nsd`).
  - Quản lý chi tiết chi phí cước tháng phát sinh (`cp_cuoc_thang`), so sánh với snapshot định mức, hiển thị biểu đồ biến động cước (`PersonnelDetailCuocChart.tsx`, `ThueBaoDetailCuocChart.tsx`).
- **Thao tác Nghiệp vụ Nâng cao**: Tạo hồ sơ kiêm nhiệm (`handleDuplicate`), Điều chuyển / Nghỉ việc (`handleOffboardClick` - tự động kiểm tra tài sản chưa trả), Vào làm lại (`handleConfirmRehire`).
- **Xuất danh bạ (Excel)**: Chuyển đổi vai trò hiển thị và lọc từ "PT DVHT KD" thành "PT QTVP", chỉ trích xuất các nhân sự có chức vụ chính xác là "PT QTVP" hoặc "Trưởng phòng QTVP" (hỗ trợ so khớp NFC không phân biệt chữ hoa/thường). Tên file tải về định dạng: `Danh_Ba_Lanh_Dao_QTVP_YYYY-MM-DD.xls`.
- **Nhập Dán Excel Hàng Loạt (Paste Import)**: Cho phép copy-paste toàn bộ bảng Excel vào phần mềm.
  - *Quy tắc bảo toàn dữ liệu*: Bắt buộc MSNV và Họ tên. Đối với nhân sự đã tồn tại, các cột để trống trong file Excel sẽ **GIỮ NGUYÊN 100% dữ liệu cũ trong CSDL**, không bị ghi đè hay nhảy chức danh.
- **Bảo mật nâng cao & Quyền chi tiết (Granular Rules)**:
  - `NS_HIDE_SENSITIVE`: Tự động ẩn thông tin nhạy cảm (SĐT cá nhân, Số CCCD, Ngạch lương, Thu nhập, Mô tả ngoại hình) thành dạng `***` trên toàn giao diện xem danh sách, thẻ nhân sự và chi tiết hồ sơ.
  - `NS_NO_DETAIL`: Cấm tài khoản mở xem trang Chi tiết Hồ sơ 360° của nhân viên.

#### 🧯 04. Phân hệ Quản lý PCCC & CNCH (FireSafetyPage.tsx & Mục F - DepartmentPage.tsx)
- **Hồ sơ Đội PCCC cơ sở**: Số lượng đội viên, khả năng huy động ban ngày/ban đêm, phương án PCCC, hotline khẩn cấp (PCCC, UBND, Công an, Điện lực, Cấp nước, Y tế).
- **Quản lý Tài sản PCCC (TS_PCCC)**: Danh mục bình chữa cháy, hệ thống báo cháy, vách tường, dụng cụ CNCH.
- **Cảnh báo Lịch Bơm Sạc & Bảo hiểm**: Hệ thống cảnh báo tự động ngày đến hạn bơm sạc bình chữa cháy và ngày hết hạn bảo hiểm cháy nổ bắt buộc.
- **Dán Bảng Danh bạ Khẩn cấp Mẫu PC01 từ PowerPoint / Excel (`PcccContactPasteModal.tsx`, `pcccContactParser.ts`)**:
  - Tích hợp nút **"📋 Dán Bảng Danh bạ (PowerPoint / Excel)"** tại Mục 4 "Danh bạ Khẩn cấp & Ghi chú Tồn tại (Mẫu PC01)" trên cả trang **Hồ sơ PCCC** lẫn **Mục F (Thông tin đơn vị)**.
  - Cho phép người dùng copy toàn bộ bảng danh bạ từ slide PowerPoint hoặc file Excel (`Ctrl + C`) và dán trực tiếp (`Ctrl + V` hoặc bấm *"Dán từ Clipboard"*).
  - Tự động nhận diện cấu trúc HTML Table của PowerPoint/Excel hoặc phân tách chuỗi văn bản theo Tab (`\t`), gạch đứng (`|`), khoảng trắng.
  - Tự động làm sạch các thẻ dư thừa `[...]` hoặc phần mở ngoặc `(...)` và định dạng số điện thoại chuẩn 4-3-4 (`0292 3820 170`).
  - **Bỏ qua dòng 113:** Nhận diện dòng Cảnh sát Phản ứng nhanh (113) và tự động bỏ qua theo đúng yêu cầu nghiệp vụ.
  - **Bỏ qua cột Ghi chú:** Không đưa các nội dung mô tả ở cột 5 vào các trường lỗi/tồn tại.
  - **Hỗ trợ độc lập 3 vị trí Lãnh đạo Đơn vị:** Cho phép lưu trữ và chỉnh sửa trực tiếp thông tin của *Giám đốc Showroom*, *Giám đốc / PT KD DVPT*, và *Giám đốc / PT KD Xe*. Nếu đơn vị chưa nhập riêng trong PCCC, hệ thống tự động gợi ý/hiển thị thông tin từ Mục A (Nhân sự đơn vị).
  - **Cuộc gọi nhanh từ Popup Ngoài màn hình:** Popup "Danh bạ Khẩn cấp" ngoài trang tự động ưu tiên lấy thông tin lãnh đạo từ hồ sơ PCCC nếu Mục A chưa có, hỗ trợ gọi điện 1-click tức thì khi xảy ra sự cố.

##### 📋 BẢNG ĐỐI SOÁT ÁNH XẠ DỮ LIỆU DANH BẠ KHẨN CẤP PCCC (MẪU PC01)

| STT Slide | Cơ quan / Bộ phận (PowerPoint) | Từ khóa nhận diện tự động (Match Keywords) | Trường Tên DB (`hs_pccc`) | Trường SĐT DB (`hs_pccc`) | Quy tắc nghiệp vụ & Ghi chú đối soát |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | Cảnh sát Phản ứng nhanh (113) | `113`, `phan ung nhanh` | *(Bỏ qua)* | *(Bỏ qua)* | 🔴 **Bỏ qua hoàn toàn**, không lưu vào DB |
| **2** | Cảnh sát PCCC | `canh sat pccc`, `cs pccc`, `pccc va cnch`, `phong pccc` | `ten_ca_pccc` | `sdt_ca_pccc` | Đầu mối ứng cứu hỏa hoạn chính |
| **3** | Cấp cứu y tế | `cap cuu y te`, `cap cuu`, `115` | `ten_yte` | `sdt_yte` | Cấp cứu thương vong tại chỗ |
| **4** | Bảo vệ dân phố / Dân quân tự vệ | `dan pho`, `dan quan tu ve`, `dan quan`, `tu ve` | `ten_bv_dan_quan` | `sdt_bv_dan_quan` | Lực lượng hỗ trợ an ninh địa bàn |
| **5** | Công an khu vực | `cong an khu vuc`, `ca khu vuc` | `ten_ca_khu_vuc` | `sdt_ca_khu_vuc` | Cán bộ CA khu vực phụ trách địa bàn |
| **6** | Công an Xã/Phường | `cong an xa`, `cong an phuong`, `ca xa`, `ca phuong` | `ten_ca_xa_phuong` | `sdt_ca_xa_phuong` | Công an xã/phường sở tại |
| **7** | PCCC Xã/Phường | `pccc xa`, `pccc phuong` | `ten_pccc_xa_phuong` | `sdt_pccc_xa_phuong` | Đội PCCC cấp cơ sở phường/xã |
| **8** | Điện lực khu vực | `dien luc`, `dien luc khu vuc` | `ten_dien_luc` | `sdt_dien_luc` | Cắt điện lưới khu vực khẩn cấp |
| **9** | Giám đốc Showroom | `giam doc showroom`, `giam doc don vi`, `giam doc` | `ten_giam_doc` | `sdt_giam_doc` | 🟢 Lưu vào PCCC; Gợi ý từ Mục A nếu chưa có |
| **10** | Giám đốc / PT KD DVPT | `ban hang dvpt`, `kinh doanh dvpt`, `dvpt`, `dich vu phu tung`, `ptkd dvpt` | `ten_ptkd_dvpt` | `sdt_ptkd_dvpt` | 🟢 Lưu vào PCCC; Gợi ý từ Mục A nếu chưa có |
| **11** | Giám đốc / PT KD Xe | `ban hang xe`, `kinh doanh xe`, `kd xe`, `ptkd xe` | `ten_ptkd_xe` | `sdt_ptkd_xe` | 🟢 Lưu vào PCCC; Gợi ý từ Mục A nếu chưa có |
| **12** | Phụ trách Kho xe & Lái xe | `kho xe`, `lai xe`, `phu trach kho xe` | `ten_kho_xe` | `sdt_kho_xe` | Di dời tài sản & phương tiện |
| **13** | Tổ trưởng bảo vệ, đón tiếp KH | `to truong bao ve`, `don tiep khach hang`, `tt bao ve`, `don tiep kh` | `ten_tt_bao_ve` | `sdt_tt_bao_ve` | Hướng dẫn thoát hiểm, mở cổng cứu hộ |
| **14** | Phụ trách QTVP (Hành chính) | `dich vu ho tro kd`, `ho tro kd`, `hanh chinh`, `vp cty`, `qtvp`, `hc ns` | `ten_hc_ns` | `sdt_hc_ns` | Đầu mối hậu cần & thông tin tổng hợp |
| **15** | Cơ sở y tế gần nhất (ký HĐ y tế) | `hop dong y te`, `y te gan nhat`, `bv lien ket`, `co so y te gan nhat` | `ten_bv_lien_ket` | `sdt_bv_lien_ket` | Bệnh viện liên kết khám chữa bệnh / cấp cứu |

> 📌 **Câu lệnh SQL cấu trúc bảng `hs_pccc` (Supabase):**
> ```sql
> ALTER TABLE hs_pccc 
> ADD COLUMN IF NOT EXISTS ten_giam_doc TEXT, 
> ADD COLUMN IF NOT EXISTS sdt_giam_doc TEXT, 
> ADD COLUMN IF NOT EXISTS ten_ptkd_dvpt TEXT, 
> ADD COLUMN IF NOT EXISTS sdt_ptkd_dvpt TEXT, 
> ADD COLUMN IF NOT EXISTS ten_ptkd_xe TEXT, 
> ADD COLUMN IF NOT EXISTS sdt_ptkd_xe TEXT;
> ```


#### 🛡️ 05. Phân hệ Quản lý ATVSLĐ & Thiết bị Nghiêm ngặt (AtvsldPage.tsx)
- **Tab 1: Hồ sơ Báo cáo Cơ sở (`HoSoTab.tsx`)**: Tự động tổng hợp số liệu huấn luyện các Nhóm 1-6 và thiết bị nghiêm ngặt từ database mà không cần nhập tay.
- **Tab 2: Kế hoạch Đào tạo đợt tới (`KeHoachTab.tsx`)**: Quét và phân loại tự động nhân sự thành 4 diện: *Chưa học*, *Quá hạn*, *Sắp hết hạn (<60 ngày)*, *An toàn*. Hỗ trợ xuất danh sách Excel theo mẫu.
- **Tab 3: Khóa học Huấn luyện (`KhoaHocTab.tsx`)**: Quản lý các đợt đào tạo qua 2 chế độ:
  - **Danh sách khóa huấn luyện:** Tạo khóa học mới, nhập danh sách học viên qua dán Excel, đồng bộ chứng chỉ ngầm theo batch.
  - **Lịch sử đào tạo cá nhân:** Hiển thị dưới dạng **Bảng ma trận (Matrix View)** gom nhóm lịch sử đạt các năm (cột năm động) kèm timeline chi tiết và **Bảng chi tiết (List View)** lọc theo đơn vị lúc học thực tế để tính toán chi phí. Tích hợp nút **"Xuất Excel Đợt Học Tiếp Theo"** tự động đề xuất nhân sự chưa học/hết hạn chứng chỉ chuẩn 14 cột.
  - *Đồng bộ thông minh nhân sự kiêm nhiệm:* Khi lưu học viên và đồng bộ chứng chỉ sang hồ sơ chính, hệ thống tự động quét MSNV trên toàn hệ thống và cập nhật đồng bộ cho tất cả hồ sơ công tác chính và kiêm nhiệm ở các đơn vị khác nhau.
- **Tab 4: Thiết bị yêu cầu Nghiêm ngặt về ATLĐ (`StrictEquipmentTab.tsx`)**:
  - Quản lý danh mục thiết bị có yêu cầu nghiêm ngặt (xe nâng, nồi hơi, thang máy, bình chịu áp lực...).
  - Quản lý nhật ký/lịch sử kiểm định (`nk_kiem_dinh_tbnn`), đơn vị kiểm định, chi phí, link biên bản PDF.
  - Cảnh báo thời hạn kiểm định qua huy hiệu màu chuẩn: *Đỏ (Quá hạn)*, *Cam (Dưới 30 ngày)*, *Vàng (Dưới 60 ngày)*, *Xanh (An toàn)*.
- **Tab 5: Khám sức khỏe & Bệnh nghề nghiệp (`SucKhoeTab.tsx`)**:
  - Quản lý chiến dịch khám sức khỏe định kỳ của toàn đơn vị.
  - Hỗ trợ dán Excel danh sách KSK cá nhân (tự viết hoa chữ cái đầu họ tên, tự gán đúng đơn vị khám năm cũ), tự động tính toán & tổng hợp đợt KSK cấp đơn vị.
  - Cơ chế lọc phân tách: Bảng ma trận lọc theo đơn vị hiện tại (xem tiến trình điều chuyển đơn vị), Bảng chi tiết lọc theo đơn vị lúc khám thực tế (báo cáo thống kê).
  - *Custom Confirm Modal Xóa:* Thay thế dialog confirm native của trình duyệt bằng Custom Confirm Modal giao diện mờ backdrop blur sang trọng.

#### 🚗 06. Phân hệ Quản lý Xe & Chi phí Vận hành (VehiclePage.tsx)
- **Master Tài sản Xe (TS_Xe)**: Quản lý biển số, loại phương tiện, hiệu xe, số khung, số máy, năm sản xuất, hình thức sở hữu, GPS, hiện trạng, đường link xem hồ sơ xe (`ho_so_xe`).
- **Tích hợp Hồ sơ xe & Tự động quét Google Drive theo Số khung**:
  - Tích hợp trường **"Hồ sơ xe"** kèm nút **"Tự động tìm file trên Drive"** tại modal Thêm mới & Cập nhật thông tin xe (nằm ngay dưới cụm Định vị GPS / Hiện trạng và phía trên Ghi chú khác).
  - Kết nối trực tiếp với Google Drive API v3 quét thư mục `Hồ sơ Xe` (ID: `1UZ5ZUTPrOZ4-ClAbxCgTQ8pbn8d6CzSa`).
  - **Quy tắc so khớp nghiêm ngặt theo Số khung (VIN)**: Hệ thống chuẩn hóa số khung (loại bỏ ký tự phân cách, khoảng trắng, dấu chấm, dấu gạch ngang, phần mở rộng file) và tìm kiếm cả **Tệp tin (File)** lẫn **Thư mục (Folder)** mang tên Số khung xe trong thư mục gốc và thư mục con cấp 1 (tuyệt đối không quét theo biển số xe).
  - Tích hợp biểu tượng xem nhanh (`FileText`) cạnh biển số xe trên Bảng danh sách desktop và Thẻ mobile với tooltip `"Xem hồ sơ xe"`, mở trực tiếp file hoặc thư mục trên Google Drive trong tab mới.
  - Hỗ trợ xem hồ sơ trong Modal Xem chi tiết và hỗ trợ dán Excel hàng loạt với cột "Hồ sơ xe".
- **Nhật ký Chi phí Vận hành (CP_HoatDongXe)**: Theo dõi số km, số lít nhiên liệu, chi phí nhiên liệu, cầu đường bến bãi, rửa xe, bảo dưỡng sửa chữa, khấu hao theo từng tháng/năm.


#### 💻 07. Phân hệ Quản lý Trang thiết bị & QR Code (EquipmentPage.tsx)
- **Master Thiết bị CNTT & Văn phòng**: Quản lý mã tài sản, tên thiết bị, nhóm, thông số kỹ thuật (CPU, RAM, SSD, VGA, màn hình...), hạn bảo hành, nhà cung cấp.
- **Ràng buộc Đơn vị Quản lý ↔ Pháp nhân (Công ty sở hữu)**: Khi chọn Đơn vị quản lý trong Modal Thêm/Sửa thiết bị, trường **Tài sản thuộc Pháp nhân** tự động lọc danh sách các pháp nhân thuộc Đơn vị quản lý đó (`dm_phap_nhan` theo `id_don_vi`), hỗ trợ sổ xuống chọn chuẩn xác ngay cả với các đơn vị có nhiều pháp nhân trực thuộc.
- **Chuẩn hóa Màu sắc & Giao diện Nhập liệu**: Đồng nhất màu nền `#FFFFF0` nhẹ dịu, chữ màu đen rõ ràng và font size đồng nhất giữa tất cả các trường dữ liệu trên bảng Thêm mới / Cập nhật tài sản.
- **Tự động Làm sạch Chuỗi Kỹ thuật (`cleanTechnicalString`)**: Tự động loại bỏ khoảng trắng thừa quanh dấu gạch ngang (VD: `i7 - 1185G7` thành `i7-1185G7`, `Core i5 - 1135G7` thành `Core i5-1135G7`). Áp dụng tự động cho CPU, VGA, Mã tài sản, Số seri.
- **Tự động Định dạng Đơn vị GB (`formatMemorySize`)**: Nhập số thuần (VD: `512`, `16`, `256`) hay chữ dính liền (`512gb`, `16GB`) $\rightarrow$ tự động gắn đơn vị chuẩn **`512 GB`**, **`16 GB`**, **`256 GB`**. Áp dụng đồng bộ cả khi Dán Excel hàng loạt lẫn Nhập/Sửa từng thiết bị đơn lẻ.
- **Ẩn giá trị tài sản qua Quyền chi tiết**:
  - `TB_HIDE_PRICE`: Ẩn thông tin Nguyên giá/Giá mua (`gia_mua`) của thiết bị thành `***` và khóa không cho chỉnh sửa trường này đối với tài khoản bị hạn chế.
- **Nhật ký Thiết bị (NhatKyThietBi)**: Ghi nhận lịch sử bàn giao người sử dụng, phòng ban quản lý, lịch sử sửa chữa, nâng cấp, báo hỏng, chi phí.
- **Deep Link & Quét mã QR**: Tạo mã QR tài sản (`qrcode.react`), hỗ trợ quét mã QR qua camera (`html5-qrcode`) hoặc truy cập thẳng qua URL `/?tab=equipment&qr=MÃ_TÀI_SẢN` để mở ngay chi tiết thiết bị.

#### 🤝 08. Phân hệ Quản lý Nhà cung cấp (SupplierPage.tsx)
- **Quản lý Đối tác & Nhà cung cấp**: Quản lý đầy đủ danh sách nhà cung cấp dịch vụ hành chính/tiện ích/kỹ thuật cho các đơn vị trên toàn quốc (16 nhóm dịch vụ cố định).
- **Bộ lọc đa chiều**: Lọc đệ quy theo Cây đơn vị (Unit Tree), phân nhóm dịch vụ, trạng thái hợp tác (Đang hợp tác/Ngừng hợp tác) và tìm kiếm thông tin nhanh.
- **Quản lý Hợp đồng & Thời hạn**: Tự động tính toán và hiển thị huy hiệu cảnh báo thời hạn hết hạn hợp đồng nếu còn dưới 30 ngày (sử dụng hàm kiểm tra `getExpiryStatus`).
- **Modal Thao tác Nghiệp vụ**: Xem chi tiết toàn diện thông tin doanh nghiệp, thông tin liên hệ đầu mối trực tiếp, đánh giá dịch vụ, và dán đường dẫn file hồ sơ năng lực trực tuyến.

#### 📄 09. Phân hệ Quản lý Văn bản & Thông báo (DocumentPage.tsx)
- **Phân loại Văn bản**: Quản lý văn bản đến/đi, thông báo, quyết định, quy định.
- **Phân quyền thao tác & Ma trận quyền nâng cao**:
  - Chỉ đơn vị ban hành hoặc HO Admin mới có quyền Sửa/Xóa văn bản đó. Các đơn vị khác chỉ có quyền Xem (Read-only).
  - `VB_HIDE_BTN`: Ẩn hoàn toàn nút Ban hành mới trên thanh công cụ.
  - `VB_VIEW_QD`, `VB_VIEW_TB`, `VB_VIEW_TB_BDH`, `VB_VIEW_TT`, `VB_VIEW_CV_DI`, `VB_VIEW_CV_DEN`: Hạn chế chỉ hiển thị loại văn bản tương ứng với quyền được tích chọn trong ma trận quyền.
- **Tự động tìm kiếm file đính kèm trên Google Drive**: Tích hợp nút **"Tự động tìm file trên Drive"** cạnh trường nhập đường dẫn file. Hệ thống tự động phân tích Năm ban hành, Phân loại văn bản và Số hiệu để truy vấn Google Drive API v3. Sử dụng thuật toán so khớp RegExp thông minh ở Client-side hỗ trợ đa tiền tố viết tắt (QĐ/QD, CVĐ/CVD, TTr/TT) giúp tìm chính xác file PDF bất kể sự không đồng nhất về khoảng trắng, dấu chấm phân cách hay hậu tố chữ cái (ví dụ khớp chuẩn: QĐ09, QD34, QĐ.04, QĐ 40, QĐ12B).
- **Auto-fill Người lấy số**: Nhập mã nhân viên tự động điền Họ tên và Bộ phận lấy số.
- **Hỗ trợ Đa nghiệp vụ**: Cho phép nhập nhiều phân loại nghiệp vụ ngăn cách bởi dấu `;`. Giao diện bảng danh sách tài liệu (`AllDocTable.tsx`, `ThongBaoTable.tsx`, `QuyetDinhTable.tsx`, `CongVanDiTable.tsx`, `ToTrinhTable.tsx`) tự động tách chuỗi theo dấu `;` để hiển thị thành các tag nghiệp vụ độc lập, gọn gàng.
- **Autocomplete Nhiều giá trị**: Ô nhập liệu Nghiệp vụ tự động gợi ý thông minh dựa trên phần văn bản sau dấu `;` cuối cùng và điền tiếp nối một cách chuẩn xác mà không đè lên giá trị đã nhập trước đó.
- **Cấp số hiệu tự động (Auto-numbering)**: Tích hợp checkbox "Số tự động" cạnh ô Số hiệu giúp tự động tính toán số hiệu tiếp theo dạng `[số]/[năm]/[loại]-[đơn vị]` dựa trên phân loại, đơn vị ban hành, năm hiện hành và viết tắt chức danh người ký.
- **Cấu trúc Component hóa (Modular architecture)**: Tách mã nguồn hiển thị bảng dữ liệu của từng loại văn bản thành các file `.tsx` riêng biệt (`AllDocTable`, `ThongBaoTable`, `QuyetDinhTable`, `CongVanDenTable`, `CongVanDiTable`, `ToTrinhTable`) giúp dễ bảo trì và tối ưu cột hiển thị riêng cho mỗi loại.
- **Copy nhanh Thông tin phản hồi**: Hỗ trợ nút sao chép thông tin phản hồi định dạng chuẩn bên cạnh mục Ban hành trong bảng Chi tiết Văn bản để phản hồi ngay cho người xin cấp số (bao gồm Số hiệu, Nội dung, Ngày ban hành, Người phê duyệt, Nhân sự & Bộ phận trình).

#### 📜 10. Phân hệ Quản lý Quy định & Quy trình (PolicyPage.tsx)
- Lưu trữ, phân loại và tra cứu các quy định hành chính, quy trình làm việc chuẩn áp dụng trong toàn hệ thống.
- **Bộ lọc Quyền nâng cao**:
  - `QD_TYPES:type1|type2|...`: Giới hạn các loại tài liệu quy định (Ví dụ: chỉ cho phép xem Quy định và Quy trình).
  - `QD_YEARS:year1|year2|...`: Giới hạn các tài liệu quy định chỉ được ban hành trong các năm chỉ định.
- **Xử lý Đa nghiệp vụ Đồng bộ**: Tự động đồng bộ và tách các chuỗi nghiệp vụ ghép từ phân hệ Văn bản. Danh sách nhóm nghiệp vụ bên trái chỉ chứa các nghiệp vụ đơn lẻ, sạch sẽ. Bộ lọc và số lượng đếm tài liệu cho mỗi nghiệp vụ được xử lý chính xác tuyệt đối.

#### 📊 11. Phân hệ Báo cáo Tổng hợp & Custom Builder (ReportPage.tsx)
- **Mẫu báo cáo Cấu trúc Đơn vị (`ReportList.tsx`)**: Tổng hợp sơ đồ và thông tin liên hệ đơn vị.
- **Mẫu báo cáo Danh sách Nhân sự theo Đơn vị (`personnel_by_unit`)**: Báo cáo hồ sơ nhân sự theo đơn vị và phòng ban. Hỗ trợ bộ lọc **Showroom** phân cấp động theo **Đơn vị** đã chọn (khi chọn Đơn vị, ô Showroom chỉ hiển thị các showroom/cơ sở trực thuộc đơn vị đó, hiển thị số lượng và tự động reset khi thay đổi Đơn vị). Báo cáo tự động lọc và chỉ xuất các CB-NV có trạng thái làm việc là **"Đang làm việc"**. Khi xuất Excel, hệ thống tự động sắp xếp cột **Chức Danh** ngay trước cột **Chức Vụ**, bổ sung cột **Showroom** ngay trước cột **Đơn Vị Quản Lý** ở sheet **Dữ liệu**, đồng thời tự động tạo thêm **Sheet "Thống kê"** ở vị trí đầu tiên (Sheet 1) tổng hợp chuyên nghiệp 5 bảng số liệu dựa trên tập nhân sự đang làm việc: *Khối KPI tổng quan*, *Bảng 1: Thống kê theo Showroom/Đơn vị*, *Bảng 2: Thống kê theo Phòng ban/Bộ phận*, *Bảng 3: Thống kê Bảo vệ & Phục vụ hậu cần (Chỉ lấy nhân sự có Phòng ban là BV,ĐTKH hoặc PVHC và có Chức danh tương ứng để phân loại NV, Tổ trưởng/phó, Cộng BV, Cộng HC)*, *Bảng 4: Tổng hợp nhân sự theo Bộ phận và Cấp bậc (Cấp quản lý, Cấp giám sát, Chuyên môn, Dịch vụ hỗ trợ, Nghiệp vụ, Khác)* và *Bảng 5: Thống kê theo Độ tuổi & Thâm niên làm việc*. Sheet *Thông tin* tự động giải mã ID Đơn vị và Showroom thành tên tiếng Việt rõ ràng.
- **Mẫu báo cáo Pháp nhân Hóa đơn**: Tổng hợp mã số thuế và tên công ty xuất hóa đơn.
- **Mẫu báo cáo Khảo sát An ninh Bảo vệ 13 mục**: Cho phép xuất file Excel đa Worksheet (mỗi đơn vị/showroom 1 Sheet) theo đúng chuẩn khảo sát AN-BV.
- **Danh sách Quy định - Quy trình hiện hành**: Báo cáo tích hợp nâng cao của tính năng xuất Excel từ mục Quy định. Hệ thống tự động gộp dữ liệu từ bảng quy định (`qd_qt`) và bảng văn bản liên kết (`vb_tb` có gán nghiệp vụ) để đảm bảo đầy đủ 100% dữ liệu (116 văn bản). Hỗ trợ các bộ lọc nâng cao gồm Năm ban hành, Loại tài liệu (quét động toàn bộ các loại tài liệu thực tế đang có như Quy định, Quy trình, Tờ trình, Thông báo...), Nghiệp vụ áp dụng (quét từ chuỗi nghiệp vụ ghép) và Bộ phận ban hành, tự động xuất Excel theo đúng mẫu thiết kế gốc gồm 8 cột (STT, Số hiệu, Tiêu đề, Trích yếu, Nghiệp vụ, Bộ phận ban hành, Ngày ban hành, Đính kèm) có chèn Hyperlink.
- **Trình dựng Báo cáo Tùy chỉnh (`CustomReportBuilder.tsx`)**: Cho phép chọn bảng dữ liệu, chọn cột hiển thị, thiết lập bộ lọc và xuất file Excel theo ý muốn.
- **Tải Form Nhập Hàng Loạt Chuẩn DB theo 3 Tiêu chí**: Tích hợp khu vực tải tập trung 4 biểu mẫu dán Excel chuẩn hóa. Đặc biệt đối với **Trang thiết bị văn phòng** và **Nhân sự**, file Excel mẫu `.xls` được tạo tự động bằng cách quét 100% dữ liệu thực tế đang có trong DB và áp dụng thuật toán trích xuất 01 bản ghi mẫu theo đúng 3 tiêu chí: *1. Điền đầy đủ thông tin nhất*, *2. Thời gian thêm mới gần nhất với hiện tại*, *3. Mô tả chi tiết nhất*. Dữ liệu dòng mẫu 100% là dữ liệu thật thực tế từ hệ thống của người dùng.

#### 👤 12. Phân hệ Quản lý Tài khoản (AccountPage.tsx)
- **Quản lý Người dùng**: Tạo mới, cập nhật thông tin tài khoản, cấp lại mật khẩu.
- **Phân quyền chi tiết & Ma trận quyền nâng cao (Granular & Advanced Permissions)**: 
  - Phân quyền theo Cây đơn vị (`id_don_vi`) quyết định phạm vi dữ liệu đơn vị trực thuộc được phép xem.
  - Phân quyền Module thanh menu (`quyen_truy_cap`) để cấp quyền hiển thị các phân hệ chính trên Sidebar.
  - Ma trận Quyền chi tiết (`quyen_chi_tiet`) cho phép bật/tắt các chính sách cụ thể (như ẩn lương nhân viên, ẩn giá mua thiết bị, cấm xem chi tiết, ẩn nút ban hành, giới hạn loại văn bản, giới hạn năm/phân loại quy trình) để kiểm soát truy cập dữ liệu nhạy cảm.
- **Cơ chế bảo mật phiên đăng nhập kết hợp**:
  - **Kiểm tra phiên bản ứng dụng (App Versioning - `APP_VERSION: '1.1.0'`)**: Tự động dọn dẹp các cache dữ liệu cũ của trình duyệt và buộc đăng nhập lại khi có cập nhật lớn trên hệ thống.
  - **Giới hạn thời hạn phiên**: Phiên đăng nhập ghi nhớ (`localStorage`) tự động hết hạn và xóa sau **2 ngày** (48 giờ) kể từ thời điểm đăng nhập thành công.
  - **Đồng bộ ngầm quyền hạn và mật khẩu (Database Sync & Password Change)**: Mỗi khi tải ứng dụng, hệ thống tự động gọi ngầm API để đối chiếu mật khẩu và đồng bộ phân quyền mới nhất từ cơ sở dữ liệu Supabase, hoặc buộc đăng xuất ngay lập tức nếu tài khoản bị khóa/xóa hoặc đổi mật khẩu.


#### 📜 13. Phân hệ Nhật ký Hệ thống (LogPage.tsx)
- **Ghi vết Tự động (SysLog)**: Tự động lưu vết lịch sử Đăng nhập, Đăng xuất, Thêm mới, Cập nhật, Xóa bản ghi (cho tất cả các phân hệ dữ liệu hệ thống), đồng thời tự động ghi log khi người dùng Xem chi tiết đối tượng (Đơn vị, Nhân sự, Xe, Thiết bị, Nhà cung cấp, Văn bản, Quy định) hoặc thực hiện các thao tác Xuất Excel. Tích hợp cơ chế tự động dọn dẹp hệ thống log cũ quá hạn 5 ngày chạy ngầm khi khởi chạy ứng dụng.

---

## 3. KIẾN TRÚC KỸ THUẬT & TỐI ƯU HIỆU NĂNG (PERFORMANCE ARCHITECTURE)

### 3.1. Bộ Đệm 2 Tầng Thông Minh (Smart Two-Layer Cache)
Nằm trong `src/services/api/cache.ts`:
1. **Layer 1 - In-Memory Cache**: Trả về dữ liệu siêu tốc (<1ms) trong phiên làm việc đối với các bảng chưa hết hạn TTL (5 phút).
2. **Layer 2 - Persistent LocalStorage Cache**: Lưu bản nạp dữ liệu offline.
   - *Cơ chế an toàn*: Tự động bắt lỗi `QuotaExceededError` khi `localStorage` chạm ngưỡng 5MB, tự động dọn dẹp cache cũ và hạ cấp mượt mà xuống In-Memory cache mà không làm đơ/crash ứng dụng.

### 3.2. Quản lý Render DOM Thông Minh (TabContainer Optimization)
Trong `src/App.tsx`:
- Sử dụng `React.memo` cho `TabContainer`.
- Khi chuyển đổi tab, các tab không active sẽ được gán thuộc tính `hidden` (`display: none`), ngắt hoàn toàn pipeline tính toán Layout/Paint/Compositing của trình duyệt giúp chuyển tab nhẹ và cuộn trang mượt mà.

### 3.3. Thuật Toán Tra Cứu Map O(1)
Trong `src/pages/PersonnelPage.tsx`:
- Thay thế tìm kiếm mảng đệ quy O(N) `.find()` trong các hàm tra cứu tên đơn vị bằng `donViLookupMap` dạng `Map<string, DonVi>` cho tốc độ tra cứu O(1), tối ưu cho bảng dữ liệu chứa hàng ngàn nhân sự.

### 3.4. Cổng ghi dữ liệu duy nhất (đã xác minh trực tiếp trong `services/api/modules.ts`)
- Toàn bộ thao tác **Đọc** đi qua các hàm `getX()` (VD `getPersonnel()`, `getThietBi()`...), có cơ chế fallback tự động sang dữ liệu offline (`getLocalRecords`) nếu Supabase lỗi.
- Toàn bộ thao tác **Ghi/Sửa** bắt buộc qua `apiService.save(data, action, tableName)` — hàm tự làm sạch payload, tự sinh `id`, và tự gọi `invalidateCache()` + `writeLog()` (ghi Audit log). Không được gọi thẳng Supabase REST trong component.
- Toàn bộ thao tác **Xóa** qua `apiService.deleteRecord(id, tableName).`

---

## 4. QUY CHUẨN THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX DESIGN SYSTEM)

Hệ thống QTVP-ASDS áp dụng bộ quy chuẩn thiết kế giao diện đồng bộ, chuẩn xác đến từng pixel và inch nhằm mang lại trải nghiệm nhất quán, hiện đại và cao cấp trên tất cả 13 phân hệ.

### 4.1. Giao diện Tabs Phân cấp Liền khối (Nested Connected Tabs - NCT) & Hiệu ứng Trượt FlyonUI
- **Kết cấu Liền khối Không Khoảng Hở (Single Container Geometry)**:
  - Khi phân hệ có tab con cấp 2 (ví dụ: *Quản lý Xe*: Tab cha "Danh sách xe" $\rightarrow$ Sub-tab con "Hiện hữu (2) | Thanh lý (0)"; hoặc *ATVSLĐ*: Tab cha "Hồ sơ Báo cáo cơ sở" $\rightarrow$ Sub-tab con "Định kỳ | Đột xuất"), tab cha và dải sub-tab con **BẮT BUỘC nằm chung trong 1 container duy nhất** (`gap: 0`).
  - Tuyệt đối không tách rời thành 2 container độc lập có khoảng hở (gap) hay bo góc rời rạc như 2 viên pill xếp chồng.
  - Mép đáy của tab cha đang active tiếp giáp liền mạch, không có viền phân cách với hàng sub-tab bên dưới (`rounded-t-xl rounded-b-none pb-2.5 sm:pb-3`), màu nền đồng nhất tạo cảm giác một khối liên hoàn.
- **Hiệu ứng Trượt FlyonUI (Sliding Pill Effect)**:
  - Sử dụng `motion.div` từ `motion/react` (Framer Motion) với thuộc tính `layoutId` riêng biệt theo cấp (VD: `layoutId="vehicleSubTab"`, `layoutId="atvsldSubTab"`).
  - Cấu hình chuyển động `transition={{ type: "spring", stiffness: 400, damping: 30 }}` giúp khối màu nền trượt mượt mà, đàn hồi tự nhiên giữa các tab khi người dùng chuyển đổi.
- **Hiển thị Số lượng (Count Badges)**:
  - Tất cả các tab cha và sub-tab con đều tích hợp huy hiệu số lượng tự động cập nhật:
    * *Tab cha*: `Danh sách xe (2) | Lịch trình & Nhật ký | Thống kê`
    * *Sub-tab*: `Hiện hữu (2) | Thanh lý (0)`

### 4.2. Quy cách Kích thước Chuẩn của Thanh Công Cụ (Header Toolbar Specifications)

- **🔍 Ô tìm kiếm (Search Input)**:
  - Kích thước chuẩn: **256 x 32 px** (`2.766 x 0.3458 in`), Tailwind: `w-[256px] h-[32px]`.
  - Màu nền: Vàng ngà nhẹ chống lóa `#FFFFF0` (`bg-[#FFFFF0]`).
  - Viền & Bo góc: Bo tròn `rounded-lg`, viền mỏng `border-gray-200`.
  - Trạng thái Focus: Viền xanh dương thương hiệu `#05469B` (`focus:border-[#05469B] focus:ring-1 focus:ring-[#05469B] outline-none`).
  - Biểu tượng: Kính lúp (Search) 14px căn giữa dọc bên trái, text placeholder 12-13px (`text-xs`).

- **✨ Nút Tính năng (Features Button)**:
  - Kích thước chuẩn: **119 x 32 px** (`1.286 x 0.3458 in`), Tailwind: `w-[119px] h-[32px]`.
  - Kiểu dáng: Bo tròn `rounded-lg`, mặc định nền trắng `bg-white text-gray-800 border-gray-200`.
  - Trạng thái Kích hoạt / Mở Menu: Tự động đổi sang màu/gradient đặc trưng của từng phân hệ, chữ trắng, đổ bóng nổi bật.
  - Phân tầng hiển thị (Z-Index): Nút cha `z-50`, backdrop che `z-[90]`, Dropdown menu xổ xuống có **`z-[100]`** và `shadow-2xl` để đảm bảo luôn nổi lên trên hàng tiêu đề bảng cố định (`sticky thead` có `z-10`).

- **🔄 Nút Đồng bộ Dữ liệu (Sync Button)**:
  - Kích thước chuẩn: **24 x 24 px** (`0.2594 x 0.2594 in`), Tailwind: `w-[24px] h-[24px] min-w-[24px]`.
  - Kiểu dáng: Nền trắng `bg-white`, bo góc `rounded-md`, viền `border-gray-200`.
  - Biểu tượng & Trạng thái: Icon `RotateCcw` 13px; khi click hoặc tải ngầm sẽ quay tròn liên tục (`animate-spin`) và hiển thị màu đặc trưng phân hệ.

- **📤 Nút Ban hành (Quản lý VTLT & Quy định - Quy trình)**:
  - Chiều cao chuẩn: **27 px** (`h-[27px] px-3`).
  - Bố cục: Nằm trên **cùng 1 dòng duy nhất** (`flex-nowrap`, không ngắt dòng) cùng với: Ô tìm kiếm (256x32) | Nút đồng bộ (24x24) | Bộ lọc nâng cao / Bộ phận ban hành | Nút ban hành.

### 4.3. Bảng Màu Đặc Trưng Theo Phân Hệ (Module Characteristic Colors)
- **Xanh dương `#05469B`** (`from-[#05469B] to-[#0a5bc4]`): Thông tin Nhân sự, Quản lý Xe Demo/Mobile Service, Quản lý Nhà cung cấp, Quản lý Trang thiết bị VP, Quản lý Văn bản - Tài liệu lưu trữ (VTLT), Quản lý Quy định - Quy trình.
- **Đỏ `#dc2626`** (`from-red-600 to-rose-700`): Quản lý Hồ sơ PCCC & CNCH.
- **Xanh lá `#16a34a`** (`from-emerald-600 to-teal-700`): Quản lý ATVSLĐ & Thiết bị Nghiêm ngặt.

### 4.4. Ma Trận Tùy Chọn Nút "Tính Năng" Theo Phân Hệ
- **Thông tin Nhân sự**: `Thêm từng nhân sự` | `Thêm hàng loạt` | `Xuất báo cáo`.
- **Quản lý Xe**: `Lọc nâng cao` (ẩn/hiện thanh slicer Hãng, Loại xe, Mục đích, Tình trạng) | `Thêm từng xe` | `Thêm hàng loạt`.
- **Hồ sơ PCCC**: `Thêm mới Hồ sơ PCCC`.
- **ATVSLĐ**: `Thêm Báo cáo cơ sở`.
- **Trang thiết bị VP**: `Quét QR` | `Thêm từng thiết bị` | `Thêm hàng loạt`.
- **Nhà cung cấp**: `Thêm Đối tác`.

---

## 5. GIẢI THÍCH CẤU TRÚC FILE DỰ ÁN (HÌNH 1 VS HÌNH 2)

Dưới đây là giải thích chi tiết lý do vì sao phiên bản gốc (Hình 1) chỉ có các file cơ bản, và phiên bản hiện tại (Hình 2) phát sinh thêm một số file ngoài thư mục root:

```text
📁 Cấu trúc Thư mục Root
├── 📂 dist/                      # Chứa sản phẩm đã build (HTML, JS, CSS)
├── 📂 node_modules/              # Thư mục chứa thư viện npm (phát sinh khi chạy npm install)
├── 📂 public/                    # Chứa tài nguyên tĩnh (favicon, logo)
├── 📂 src/                       # Thư mục chứa 100% mã nguồn React TypeScript
├── 📄 .gitignore                 # File cấu hình Git loại trừ các thư mục rác (dist, node_modules)
├── 📄 ARCHITECTURE.md            # Tài liệu mô tả kiến trúc mã nguồn dành cho AI/Developer
├── 📄 deptTabStats_restored.ts   # File nháp tạm khôi phục code (đã loại trừ khỏi build)
├── 📄 find_stats.cjs             # Script công cụ hỗ trợ tìm kiếm code nội bộ
├── 📄 find_stats.js              # Script công cụ hỗ trợ tìm kiếm code nội bộ
├── 📄 search_results.txt         # File văn bản lưu kết quả xuất ra từ script tìm kiếm
├── 📄 index.html                 # File HTML gốc của ứng dụng React SPA
├── 📄 metadata.json              # File thông tin cấu hình dự án
├── 📄 package.json               # File khai báo danh sách thư viện phụ thuộc
├── 📄 package-lock.json          # File khóa phiên bản chính xác của các gói npm
├── 📄 README.md                  # Tài liệu hướng dẫn sử dụng và tổng quan nghiệp vụ này
├── 📄 tsconfig.json              # File cấu hình trình biên dịch TypeScript (đã chỉnh include src)
└── 📄 vite.config.ts             # File cấu hình đóng gói Vite (đã chỉnh emptyOutDir: false)
```

### 💡 Bảng so sánh & Giải thích nguyên nhân phát sinh:

| File / Thư mục phát sinh | Nguyên nhân xuất hiện | Chức năng & Vai trò |
| :--- | :--- | :--- |
| **`node_modules/`** | Phát sinh khi thực hiện chạy lệnh `npm install` hoặc khởi chạy môi trường dev. | Chứa toàn bộ bộ mã nguồn của các thư viện dependency (React, Vite, Tailwind, Supabase...). |
| **`.gitignore`** | Được khởi tạo để quản lý phiên bản mã nguồn Git. | Khai báo danh sách file/folder không cần đẩy lên kho lưu trữ code (như `node_modules`, `dist`). |
| **`ARCHITECTURE.md`** | Tài liệu kỹ thuật dành riêng cho AI/Developer đọc trước khi sửa code. | Bản đồ kiến trúc mã nguồn, bảng ánh xạ Tính năng ↔ File ↔ Bảng Supabase, quy ước code, nợ kỹ thuật. |
| **`deptTabStats_restored.ts`** | File nháp phát sinh trong phiên khôi phục đoạn tính toán thống kê phòng ban cũ. | File code nháp ngoài root (đã được cấu hình loại trừ khỏi dự án trong `tsconfig.json`). |
| **`find_stats.cjs` / `.js`** | Script nhỏ bằng Node.js được tạo ra để tìm kiếm code. | Công cụ phụ trợ quét và định vị đoạn code tính toán trong dự án. |
| **`search_results.txt`** | File kết quả do script tìm kiếm xuất ra. | File lưu nhật ký văn bản kết quả tìm kiếm. |

---

## 6. HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH (OPERATIONAL GUIDE)

### 6.1. Chạy trên máy Cục bộ (Local Development)
1. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
2. Chạy Server phát triển tại cổng 3000:
   ```bash
   npm run dev
   ```
3. Truy cập trình duyệt tại địa chỉ: [http://127.0.0.1:3000/](http://127.0.0.1:3000/) hoặc [http://localhost:3000/](http://localhost:3000/)

### 6.2. Kiểm tra Cú pháp & Đóng gói Production
1. Kiểm tra linter & kiểu dữ liệu TypeScript (Strict mode):
   ```bash
   npx tsc --noEmit
   ```
2. Đóng gói sản phẩm sản xuất (Output xuất ra thư mục `dist/`):
   ```bash
   npx vite build
   ```

---

## 7. NGUYÊN TẮC PHÁT TRIỂN & BẢO TRÌ DÀNH CHO AI / DEVELOPERS

> ⚠️ **2 NGUYÊN TẮC LÀM VIỆC BẮT BUỘC KHI CẬP NHẬT CODE:**
> 1. **Nguyên tắc 1 (Trình bày tóm tắt trước khi code)**: Trước bất kỳ lần sửa đổi mã nguồn nào, phải lập bản tóm tắt phương án triển khai rõ ràng, người dùng xem và bấm **Đồng ý** thì mới được phép ghi code.
> 2. **Nguyên tắc 2 (Không tự ý bỏ / thay thế tính năng)**: Tuyệt đối không tự ý xóa bỏ hoặc thay thế bất kỳ tính năng, liên kết hay trường dữ liệu nào. Nếu bắt buộc phải thay đổi, phải giải thích lý do và có sự đồng ý của người dùng mới được triển khai.
> 3. **Nguyên tắc 3 (Đồng bộ tài liệu bắt buộc)**: Sau khi hoàn thành bất kỳ thay đổi code nào (thêm/sửa/xóa tính năng, đổi bảng Supabase, thêm file mới...), AI PHẢI tự đề xuất nội dung cần cập nhật vào ĐÚNG 1 trong 2 file:
>    - Thay đổi thuộc về **nghiệp vụ/tính năng người dùng thấy được** (tab mới, quy tắc nhập liệu mới, cách vận hành...) → cập nhật `README.md` (mục 2 tương ứng phân hệ, hoặc mục 8 nếu là vấn đề kỹ thuật cần lưu ý).
>    - Thay đổi thuộc về **cấu trúc code** (file mới, đổi tên bảng Supabase, đổi luồng gọi API, nợ kỹ thuật mới phát sinh...) → cập nhật `ARCHITECTURE.md` mục 3 (bảng ánh xạ), mục 7 (nợ kỹ thuật) hoặc mục 8 (quy chuẩn UI/UX).
>    - Nếu thay đổi ảnh hưởng cả 2 khía cạnh, phải đề xuất cập nhật CẢ 2 file.
>    - AI không tự ý sửa file tài liệu — chỉ đề xuất nội dung, chờ bạn duyệt rồi mới ghi.

---

## 8. VẤN ĐỀ KỸ THUẬT ĐÃ XÁC MINH TRỰC TIẾP TRONG CODE (cập nhật mới nhất)

> Mục này được thêm sau khi quét toàn bộ 81 file `.ts/.tsx` thật trong `src/` (không suy đoán). Xem chi tiết bảng ánh xạ Tính năng ↔ File ↔ Bảng Supabase đầy đủ tại `ARCHITECTURE.md`.

- **Cơ chế xác định Đơn vị mặc định khi truy cập hệ thống**: Tự động chọn đơn vị mặc định khi truy cập bất kỳ phân hệ nào qua hàm `getDefaultUnitId(user, donViList)` trong `src/utils/hierarchy.ts`. Tài khoản Admin/Toàn quyền sẽ hiển thị mặc định đơn vị **THACO AUTO**, tài khoản thường (Showroom, điểm bán lẻ) sẽ hiển thị **Đơn vị mẹ quản lý** (Công ty tỉnh thành) của tài khoản đó.
- **Xây dựng phân hệ Khám sức khỏe & Bệnh nghề nghiệp (`SucKhoeTab.tsx`)**: Đã chuyển đổi từ khung placeholder thành giao diện tính năng hoàn chỉnh, hỗ trợ dán Excel cá nhân (tự viết hoa chữ cái đầu họ tên, tự gán đúng đơn vị khám cũ), tự động tính toán tổng hợp đợt KSK cấp đơn vị, phân tách bộ lọc: Ma trận lọc theo đơn vị hiện tại (xem tiến trình điều chuyển), Danh sách lọc theo đơn vị lúc khám.
- **Nâng cấp Đào tạo/Huấn luyện sang cơ chế Matrix & List View (`KhoaHocTab.tsx`)**: Tích hợp SubTab chia xem danh sách khóa học và lịch sử cá nhân. Bảng ma trận hiển thị lịch sử các năm (cột năm động) kèm timeline chi tiết, bảng danh sách lọc theo đơn vị lúc học để báo cáo chi phí. Tích hợp nút xuất Excel đề xuất học đợt tiếp theo chuẩn 14 cột. Hỗ trợ validate và đồng bộ ngược thông minh toàn hệ thống theo MSNV khi nhân sự đã điều chuyển đơn vị.
- **utils/logger.tsx trùng lặp đã được xóa**: Đã xóa tệp `utils/logger.tsx` dư thừa, giữ lại `utils/logger.ts` làm nguồn duy nhất chứa logic export hàm `generateDiffLog()`, tránh cảnh báo khi biên dịch.
- **Bảng `dm_chu_ky_atvsld`**: có hàm đọc `getChuKyATVSLD()` khai báo sẵn trong `services/api/modules.ts`, nhưng không tìm thấy nơi nào trong `pages/` hoặc `components/` gọi hàm này — cần kiểm tra lại thủ công (có thể là bảng chưa nối vào UI, hoặc đã đổi tên biến ở nơi khác).
- **`services/api/client.ts`** chứa `SUPABASE_ANON_KEY` hardcode trực tiếp trong source. Đây là anon key public (được bảo vệ bởi Row Level Security phía Supabase) nên không phải lỗi bảo mật nghiêm trọng, nhưng nên cân nhắc chuyển sang biến môi trường (`.env` + `import.meta.env` của Vite) để thuận tiện đổi giữa môi trường dev/production.
- **2 file lớn nhất hệ thống** (ứng viên hàng đầu nếu cần tách nhỏ để dễ bảo trì): `components/personnel/CuocDiDongTab.tsx` (3.366 dòng) và `pages/PersonnelPage.tsx` (2.851 dòng).
- **Lỗi trùng khớp kết quả OSH (ATVSLĐ) "Chưa đạt"**: Các hàm kiểm tra kết quả học viên đạt trong `KhoaHocTab.tsx`, `HoSoTab.tsx` và `AtvsldPage.tsx` ban đầu sử dụng phương thức `.includes('đạt')` / `.includes('dat')`, gây ra lỗi logic nhận nhầm trạng thái "Chưa đạt" thành "Đạt" (do có chứa từ khóa "đạt"). Đã được khắc phục hoàn toàn bằng cách so khớp chính xác (`=== 'đạt' || === 'dat'`) sau khi chuyển chữ thường, loại bỏ khoảng trắng và chuẩn hóa Unicode bằng `.normalize('NFC')` để chống lệch dấu tiếng Việt.