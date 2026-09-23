import { TS_Xe, DonVi } from '../../../types';

export type VehiclePivotFieldKey =
  // Đơn vị & Địa bàn
  | 'don_vi'
  | 'cong_ty_tinh_thanh'
  | 'phia'
  | 'dia_diem_cap1'
  | 'dia_diem_cap2'
  | 'dia_diem_cap3'
  // Đặc tính xe
  | 'muc_dich_su_dung'
  | 'hieu_xe'
  | 'loai_xe'
  | 'loai_phuong_tien'
  | 'nam_sx'
  | 'so_cho'
  | 'loai_nhien_lieu'
  | 'mau_xe'
  | 'gps'
  // Hiện trạng & Pháp lý
  | 'hien_trang'
  | 'hinh_thuc_so_huu'
  | 'don_vi_chu_so_huu'
  | 'trang_thai_dang_kiem'
  | 'trang_thai_bh_tnds'
  | 'trang_thai_bh_vc';

export type VehiclePivotMeasure = 'count' | 'nguyen_gia' | 'tong_km' | 'chi_phi';

export interface VehiclePivotFieldMeta {
  key: VehiclePivotFieldKey;
  label: string;
  category: 'Đơn vị & Địa bàn' | 'Đặc tính Xe' | 'Hiện trạng & Pháp lý';
}

export const VEHICLE_PIVOT_AVAILABLE_FIELDS: VehiclePivotFieldMeta[] = [
  // Nhóm Đơn vị & Địa bàn
  { key: 'don_vi', label: 'Đơn vị quản lý', category: 'Đơn vị & Địa bàn' },
  { key: 'cong_ty_tinh_thanh', label: 'Công ty Tỉnh thành', category: 'Đơn vị & Địa bàn' },
  { key: 'phia', label: 'Miền / Phía', category: 'Đơn vị & Địa bàn' },
  { key: 'dia_diem_cap1', label: 'Địa điểm SD (Cấp 1)', category: 'Đơn vị & Địa bàn' },
  { key: 'dia_diem_cap2', label: 'Địa điểm SD (Cấp 2 - Showroom)', category: 'Đơn vị & Địa bàn' },
  { key: 'dia_diem_cap3', label: 'Địa điểm SD (Cấp 3 - ĐBH)', category: 'Đơn vị & Địa bàn' },

  // Nhóm Đặc tính xe
  { key: 'muc_dich_su_dung', label: 'Mục đích sử dụng', category: 'Đặc tính Xe' },
  { key: 'hieu_xe', label: 'Hãng xe', category: 'Đặc tính Xe' },
  { key: 'loai_xe', label: 'Dòng xe (Model)', category: 'Đặc tính Xe' },
  { key: 'loai_phuong_tien', label: 'Loại phương tiện', category: 'Đặc tính Xe' },
  { key: 'nam_sx', label: 'Năm sản xuất', category: 'Đặc tính Xe' },
  { key: 'so_cho', label: 'Số chỗ ngồi', category: 'Đặc tính Xe' },
  { key: 'loai_nhien_lieu', label: 'Nhiên liệu', category: 'Đặc tính Xe' },
  { key: 'mau_xe', label: 'Màu sơn xe', category: 'Đặc tính Xe' },
  { key: 'gps', label: 'Trạng thái GPS', category: 'Đặc tính Xe' },

  // Nhóm Hiện trạng & Pháp lý
  { key: 'hien_trang', label: 'Hiện trạng hoạt động', category: 'Hiện trạng & Pháp lý' },
  { key: 'hinh_thuc_so_huu', label: 'Hình thức sở hữu', category: 'Hiện trạng & Pháp lý' },
  { key: 'don_vi_chu_so_huu', label: 'Đơn vị đứng tên Cà vẹt', category: 'Hiện trạng & Pháp lý' },
  { key: 'trang_thai_dang_kiem', label: 'Hạn Đăng kiểm', category: 'Hiện trạng & Pháp lý' },
  { key: 'trang_thai_bh_tnds', label: 'Hạn BH TNDS', category: 'Hiện trạng & Pháp lý' },
  { key: 'trang_thai_bh_vc', label: 'Hạn BH Vật chất', category: 'Hiện trạng & Pháp lý' }
];

export interface VehiclePivotFlatRecord {
  id: string;
  bien_so: string;
  don_vi_id: string;
  don_vi: string;
  cong_ty_tinh_thanh: string;
  phia: string;
  dia_diem_cap1: string;
  dia_diem_cap2: string;
  dia_diem_cap3: string;
  muc_dich_su_dung: string;
  hieu_xe: string;
  loai_xe: string;
  loai_phuong_tien: string;
  nam_sx: string;
  so_cho: string;
  loai_nhien_lieu: string;
  mau_xe: string;
  gps: string;
  hien_trang: string;
  hinh_thuc_so_huu: string;
  don_vi_chu_so_huu: string;
  trang_thai_dang_kiem: string;
  trang_thai_bh_tnds: string;
  trang_thai_bh_vc: string;
  nguyen_gia: number;
  tong_km: number;
  chi_phi: number;
}

export interface VehiclePivotNode {
  key: string;
  label: string;
  field: string;
  depth: number;
  values: Record<string, number>; // colKey -> measure value
  total: number;
  count: number;
  children: VehiclePivotNode[];
  isExpanded?: boolean;
}

export interface VehiclePivotColumnHeader {
  key: string;
  label: string;
  field?: string;
  depth?: number;
}

export interface VehiclePivotTableData {
  rootNodes: VehiclePivotNode[];
  leafColumns: VehiclePivotColumnHeader[];
  grandTotalByCol: Record<string, number>;
  grandTotalAll: number;
  grandTotalCount: number;
}

export interface VehiclePivotLayoutConfig {
  rows: VehiclePivotFieldKey[];
  cols: VehiclePivotFieldKey[];
  valField: VehiclePivotMeasure;
  filters: Record<string, string[]>;
}

export interface VehiclePivotPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  layout: VehiclePivotLayoutConfig;
}

export const VEHICLE_PIVOT_PRESETS: VehiclePivotPreset[] = [
  {
    id: 'preset_unit_purpose',
    name: 'Đơn vị × Mục đích sử dụng',
    description: 'Thống kê số lượng xe phân bổ theo Đơn vị và Mục đích (Xe công, Xe lái thử, Xe SCLĐ...)',
    icon: 'Store',
    layout: {
      rows: ['don_vi'],
      cols: ['muc_dich_su_dung'],
      valField: 'count',
      filters: {}
    }
  },
  {
    id: 'preset_unit_brand',
    name: 'Đơn vị × Hãng xe',
    description: 'Thống kê số lượng xe theo Hãng (Kia, Mazda, Peugeot, BMW...) tại từng Đơn vị',
    icon: 'Car',
    layout: {
      rows: ['don_vi'],
      cols: ['hieu_xe'],
      valField: 'count',
      filters: {}
    }
  },
  {
    id: 'preset_purpose_status',
    name: 'Mục đích SD × Hiện trạng',
    description: 'Kiểm soát tỷ lệ xe Đang hoạt động, Sửa chữa hay Ngưng hoạt động theo từng mục đích',
    icon: 'Activity',
    layout: {
      rows: ['muc_dich_su_dung'],
      cols: ['hien_trang'],
      valField: 'count',
      filters: {}
    }
  },
  {
    id: 'preset_ownership_legal',
    name: 'Hình thức sở hữu × Đơn vị đứng tên',
    description: 'Đối soát tài sản xe Sở hữu / Quản lý sử dụng với Pháp nhân đứng tên Cà vẹt',
    icon: 'ShieldCheck',
    layout: {
      rows: ['hinh_thuc_so_huu'],
      cols: ['don_vi_chu_so_huu'],
      valField: 'count',
      filters: {}
    }
  },
  {
    id: 'preset_unit_inspection',
    name: 'Đơn vị × Hạn Đăng kiểm',
    description: 'Theo dõi tình trạng hạn Đăng kiểm (Còn hạn / Sắp hết hạn / Quá hạn) của từng Đơn vị',
    icon: 'AlertTriangle',
    layout: {
      rows: ['don_vi'],
      cols: ['trang_thai_dang_kiem'],
      valField: 'count',
      filters: {}
    }
  },
  {
    id: 'preset_brand_cost',
    name: 'Hãng xe × Tổng Chi phí & Km',
    description: 'Tổng hợp chi phí vận hành (VNĐ) và cường độ hoạt động theo từng Hãng xe',
    icon: 'Receipt',
    layout: {
      rows: ['hieu_xe', 'loai_xe'],
      cols: [],
      valField: 'chi_phi',
      filters: {}
    }
  }
];
