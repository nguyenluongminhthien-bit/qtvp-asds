// src/constants/reportTemplates.ts

export interface ReportColumn {
  key: string;
  label: string;
  width?: number;
  format?: 'date' | 'currency' | 'phone' | 'boolean' | 'status_nv';
  defaultVisible: boolean;
}

export interface ReportFilter {
  key: string;
  label: string;
  type: 'unit' | 'daterange' | 'select' | 'multiselect' | 'year' | 'year_multi' | 'text' | 'unit_multi';
  options?: string[];
  placeholder?: string;
}

export interface ReportTemplate {
  id: string;
  module: 'HỆ THỐNG' | 'NHÂN SỰ' | 'VĂN BẢN';
  title: string;
  icon: string;
  description: string;
  dataSource: 'getDonVi' | 'getPersonnel' | 'getVanBan';
  columns: ReportColumn[];
  filters: ReportFilter[];
  customizable: boolean;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'system_donvi_structure',
    module: 'HỆ THỐNG',
    title: 'Tổng hợp thông tin liên hệ Đơn vị',
    icon: 'Building2',
    description: 'Báo cáo thông tin cơ cấu tổ chức lãnh đạo (Tổng Giám đốc, PT QTVP & ASĐS, PT DVHC, PT Nhân sự) của các đơn vị.',
    dataSource: 'getDonVi',
    customizable: false,
    columns: [
      { key: 'index', label: 'TT', width: 60, defaultVisible: true },
      { key: 'ten_don_vi', label: 'Tên Đơn vị', width: 250, defaultVisible: true },
      { key: 'ten_giam_doc', label: 'Tổng Giám đốc (Họ tên)', width: 180, defaultVisible: true },
      { key: 'email_giam_doc', label: 'Tổng Giám đốc (Mail)', width: 180, defaultVisible: true },
      { key: 'sdt_giam_doc', label: 'Tổng Giám đốc (SĐT)', width: 130, format: 'phone', defaultVisible: true },
      { key: 'ten_pt_nhan_su', label: 'PT QTVP & ASĐS (Họ tên)', width: 180, defaultVisible: true },
      { key: 'email_pt_nhan_su', label: 'PT QTVP & ASĐS (Mail)', width: 180, defaultVisible: true },
      { key: 'sdt_pt_nhan_su', label: 'PT QTVP & ASĐS (SĐT)', width: 130, format: 'phone', defaultVisible: true },
      { key: 'ten_pt_dvhc', label: 'PT DVHC (Họ tên)', width: 180, defaultVisible: true },
      { key: 'email_pt_dvhc', label: 'PT DVHC (Mail)', width: 180, defaultVisible: true },
      { key: 'sdt_pt_dvhc', label: 'PT DVHC (SĐT)', width: 130, format: 'phone', defaultVisible: true },
      { key: 'ten_pt_ns', label: 'PT Nhân sự (Họ tên)', width: 180, defaultVisible: true },
      { key: 'email_pt_ns', label: 'PT Nhân sự (Mail)', width: 180, defaultVisible: true },
      { key: 'sdt_pt_ns', label: 'PT Nhân sự (SĐT)', width: 130, format: 'phone', defaultVisible: true }
    ],
    filters: [
      { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit_multi' },
      { key: 'loai_hinh', label: 'Chọn loại hình', type: 'multiselect' }
    ]
  },
  {
    id: 'system_donvi_billing',
    module: 'HỆ THỐNG',
    title: 'Báo cáo Thông tin pháp nhân theo Quản trị',
    icon: 'FileText',
    description: 'Báo cáo thông tin xuất hóa đơn và pháp lý đầy đủ (Tên Công ty, MST, Địa chỉ xuất hóa đơn, Email, GPKD) của các đơn vị.',
    dataSource: 'getDonVi',
    customizable: false,
    columns: [
      { key: 'index', label: 'TT', width: 60, defaultVisible: true },
      { key: 'ten_don_vi_quan_ly', label: 'Đơn vị quản lý', width: 220, defaultVisible: true },
      { key: 'ten_don_vi', label: 'Tên Đơn vị', width: 250, defaultVisible: true },
      { key: 'ten_cong_ty', label: 'Tên Công ty (Pháp nhân)', width: 250, defaultVisible: true },
      { key: 'ma_so_thue', label: 'Mã số thuế', width: 130, defaultVisible: true },
      { key: 'dia_chi', label: 'Địa chỉ xuất hoá đơn', width: 300, defaultVisible: true },
      { key: 'mail', label: 'Mail', width: 180, defaultVisible: true }
    ],
    filters: [
      { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit_multi' }
    ]
  },
  {
    id: 'system_security_report',
    module: 'HỆ THỐNG',
    title: 'Báo cáo Khảo sát An ninh Bảo vệ',
    icon: 'ShieldCheck',
    description: 'Báo cáo khảo sát chi tiết hiện trạng an ninh bảo vệ, cơ sở vật chất, hệ thống camera và tiếp giáp khu vực của các đơn vị/showroom.',
    dataSource: 'getDonVi',
    customizable: false,
    columns: [
      { key: 'index', label: 'TT', width: 60, defaultVisible: true },
      { key: 'ten_don_vi', label: 'Tên Đơn vị / Showroom', width: 250, defaultVisible: true },
      { key: 'dia_chi', label: 'Địa chỉ', width: 280, defaultVisible: true },
      { key: 'quy_mo', label: 'Quy mô', width: 150, defaultVisible: true },
      { key: 'dien_tich_str', label: 'Diện tích', width: 130, defaultVisible: true },
      { key: 'so_cong_str', label: 'Số cổng', width: 120, defaultVisible: true },
      { key: 'sl_camera', label: 'SL Camera', width: 110, defaultVisible: true },
      { key: 'thoi_gian_luu', label: 'Thời gian lưu (ngày)', width: 150, defaultVisible: true },
      { key: 'vi_tri_gs_camera', label: 'Vị trí quan sát Camera', width: 220, defaultVisible: true },
      { key: 'tinh_hinh_khu_vuc', label: 'Tình hình an ninh', width: 250, defaultVisible: true }
    ],
    filters: [
      { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit_multi' }
    ]
  },
  {
    id: 'personnel_by_unit',
    module: 'NHÂN SỰ',
    title: 'Danh sách Nhân sự theo Đơn vị',
    icon: 'Users',
    description: 'Báo cáo tổng hợp hồ sơ nhân sự theo đơn vị, phòng ban kèm các bộ lọc phân loại chuyên môn.',
    dataSource: 'getPersonnel',
    customizable: true,
    columns: [
      { key: 'ma_so_nhan_vien', label: 'Mã Số Nhân Viên', width: 130, defaultVisible: true },
      { key: 'ho_ten', label: 'Họ và Tên', width: 180, defaultVisible: true },
      { key: 'chuc_vu', label: 'Chức Vụ', width: 150, defaultVisible: true },
      { key: 'phong_ban', label: 'Phòng Ban / Bộ phận', width: 150, defaultVisible: true },
      { key: 'ten_don_vi', label: 'Đơn Vị Quản Lý', width: 220, defaultVisible: true },
      { key: 'sdt_ca_nhan', label: 'Số Điện Thoại Cá Nhân', width: 130, format: 'phone', defaultVisible: true },
      { key: 'sdt_cong_ty', label: 'Số Điện Thoại Công Ty', width: 130, format: 'phone', defaultVisible: true },
      { key: 'email', label: 'Email', width: 180, defaultVisible: true },
      { key: 'gioi_tinh', label: 'Giới Tính', width: 80, defaultVisible: true },
      { key: 'nam_sinh', label: 'Năm Sinh', width: 100, format: 'date', defaultVisible: false },
      { key: 'ngay_nhan_vien', label: 'Ngày Nhận Việc', width: 110, format: 'date', defaultVisible: true },
      { key: 'phan_loai', label: 'Phân Loại Nhân Sự', width: 130, defaultVisible: true },
      { key: 'trinh_do_hoc_van', label: 'Trình Độ Học Vấn', width: 120, defaultVisible: false },
      { key: 'ngach_luong', label: 'Ngạch Lương', width: 120, defaultVisible: false },
      { key: 'thu_nhap', label: 'Mức Thu Nhập (Lương đóng BH)', width: 160, format: 'currency', defaultVisible: false },
      { key: 'trang_thai', label: 'Trạng Thái', width: 110, format: 'status_nv', defaultVisible: true },
      { key: 'ngay_nghi_viec', label: 'Ngày Nghỉ Việc', width: 110, format: 'date', defaultVisible: false }
    ],
    filters: [
      { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit' },
      { key: 'phan_loai', label: 'Phân loại Nhân sự', type: 'select', options: ['Chính thức', 'Thử việc', 'Cộng tác viên', 'Kiêm nhiệm', 'Học việc'] },
      { key: 'trang_thai', label: 'Trạng thái Làm việc', type: 'select', options: ['Đang làm việc', 'Đã nghỉ việc'] }
    ]
  },
  {
    id: 'personnel_by_certificate',
    module: 'NHÂN SỰ',
    title: 'Theo dõi Chứng chỉ & Huấn luyện Nhân sự',
    icon: 'GraduationCap',
    description: 'Báo cáo chi tiết danh sách chứng chỉ (ATVSLĐ, PCCC, CNCH, Sơ cấp cứu...) kèm tình trạng hiệu lực và cảnh báo tái huấn luyện.',
    dataSource: 'getPersonnel',
    customizable: true,
    columns: [
      { key: 'ma_so_nhan_vien', label: 'Mã Nhân Viên', width: 110, defaultVisible: true },
      { key: 'ho_ten', label: 'Họ và Tên', width: 160, defaultVisible: true },
      { key: 'chuc_vu', label: 'Chức Vụ', width: 130, defaultVisible: true },
      { key: 'ten_don_vi', label: 'Đơn Vị Quản Lý', width: 200, defaultVisible: true },
      { key: 'nhom_doi_tuong', label: 'Nhóm Đối Tượng ATVSLĐ', width: 150, defaultVisible: true },
      { key: 'cc_atvsld', label: 'Chứng chỉ ATVSLĐ', width: 130, format: 'boolean', defaultVisible: true },
      { key: 'huan_luyen_tu', label: 'Huấn luyện từ ngày', width: 120, format: 'date', defaultVisible: false },
      { key: 'huan_luyen_den', label: 'Đến ngày', width: 120, format: 'date', defaultVisible: false },
      { key: 'gia_tri_den', label: 'Hết hạn ATVSLĐ', width: 125, format: 'date', defaultVisible: true },
      { key: 'cc_pccc', label: 'Chứng chỉ PCCC', width: 110, format: 'boolean', defaultVisible: true },
      { key: 'cc_cnch', label: 'Chứng chỉ CNCH', width: 110, format: 'boolean', defaultVisible: true },
      { key: 'cc_so_cap_cuu', label: 'Chứng chỉ Sơ cấp cứu', width: 130, format: 'boolean', defaultVisible: false },
      { key: 'giay_phep_lai_xe', label: 'Giấy phép Lái xe', width: 150, defaultVisible: true }
    ],
    filters: [
      { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit' },
      { key: 'nhom_doi_tuong', label: 'Nhóm ATVSLĐ', type: 'select', options: ['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4', 'Nhóm 6'] },
      { key: 'certificate_type', label: 'Loại Chứng chỉ', type: 'select', options: ['Chứng chỉ ATVSLĐ', 'Chứng chỉ PCCC', 'Chứng chỉ CNCH', 'Giấy phép Lái xe'] },
      { key: 'expiry_status', label: 'Trạng thái Hiệu lực', type: 'select', options: ['Còn hiệu lực', 'Sắp hết hạn (30 ngày)', 'Đã hết hạn', 'Chưa có'] }
    ]
  },
  {
    id: 'personnel_turnover_stats',
    module: 'NHÂN SỰ',
    title: 'Thống kê Biến động Nhân sự (Tuyển mới / Nghỉ việc)',
    icon: 'TrendingUp',
    description: 'Báo cáo biến động số lượng nhân sự tuyển mới và thôi việc định kỳ theo tháng/quý.',
    dataSource: 'getPersonnel',
    customizable: false,
    columns: [
      { key: 'period', label: 'Khoảng thời gian (Tháng / Quý)', width: 150, defaultVisible: true },
      { key: 'recruited_count', label: 'Số lượng Tuyển Mới', width: 150, defaultVisible: true },
      { key: 'resigned_count', label: 'Số lượng Nghỉ Việc', width: 150, defaultVisible: true },
      { key: 'net_change', label: 'Thay đổi Tịnh (Tăng / Giảm)', width: 150, defaultVisible: true }
    ],
    filters: [
      { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit' },
      { key: 'daterange', label: 'Chọn Khoảng thời gian', type: 'daterange' }
    ]
  },
  {
    id: 'document_list_report',
    module: 'VĂN BẢN',
    title: 'Danh sách Văn bản & Thông báo ban hành',
    icon: 'FileText',
    description: 'Báo cáo tổng hợp văn bản quy định hành chính, thông báo và tờ trình, hỗ trợ xuất Excel tách sheet và thống kê theo bộ phận.',
    dataSource: 'getVanBan',
    customizable: true,
    columns: [
      { key: 'so_hieu', label: 'Số Hiệu Văn Bản', width: 150, defaultVisible: true },
      { key: 'ngay_ban_hanh', label: 'Ngày Ban Hành', width: 110, format: 'date', defaultVisible: true },
      { key: 'tieu_de', label: 'Tiêu Đề', width: 280, defaultVisible: true },
      { key: 'nguoi_ky', label: 'Người Ký', width: 150, defaultVisible: true },
      { key: 'chuc_vu', label: 'Chức Vụ Người Ký', width: 150, defaultVisible: true },
      { key: 'nguoi_lay_so', label: 'Người Lấy Số', width: 150, defaultVisible: true },
      { key: 'bo_phan_lay_so', label: 'Bộ Phận Lấy Số', width: 150, defaultVisible: true },
      { key: 'hieu_luc', label: 'Tình Trạng Hiệu Lực', width: 120, defaultVisible: true },
      { key: 'vb_thay_the', label: 'Văn Bản Thay Thế', width: 150, defaultVisible: true },
      { key: 'phan_loai', label: 'Phân Loại Văn Bản', width: 120, defaultVisible: true },
      { key: 'nghiep_vu', label: 'Phân loại Nghiệp vụ', width: 150, defaultVisible: false }
    ],
    filters: [
      { key: 'year', label: 'Năm Ban Hành', type: 'year_multi' },
      { key: 'id_don_vi', label: 'Chọn Đơn vị ban hành', type: 'unit_multi' },
      { key: 'phan_loai', label: 'Loại Văn bản', type: 'multiselect', options: ['Thông báo', 'Quyết định', 'Tờ trình', 'Công văn đến', 'Công văn đi'] },
      { key: 'bo_phan_lay_so', label: 'Bộ phận lấy số (Nhiều mục)', type: 'multiselect', options: [] }
    ]
  }
];
