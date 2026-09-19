import { ChiPhiPivotConfig, PivotLayoutConfig, PivotValueConfig } from '../../../types';

export type PivotFieldKey =
  | 'nam'
  | 'thang'
  | 'quy'
  | 'phia'
  | 'cong_ty_tinh_thanh'
  | 'don_vi'
  | 'loai_hinh'
  | 'phap_nhan'
  | 'nhom_chi_phi'
  | 'kmp'
  | 'khoi_nghiep_vu'
  | 'thuong_hieu_bo_phan';

export interface PivotFieldMeta {
  key: PivotFieldKey;
  label: string;
  category: 'Thời gian' | 'Công ty' | 'Chi phí';
  iconName?: string;
}

export const PIVOT_AVAILABLE_FIELDS: PivotFieldMeta[] = [
  // Nhóm Thời gian: Tháng | Quý | Năm
  { key: 'thang', label: 'Tháng', category: 'Thời gian' },
  { key: 'quy', label: 'Quý', category: 'Thời gian' },
  { key: 'nam', label: 'Năm', category: 'Thời gian' },

  // Nhóm Công ty: Thương hiệu / Bộ phận | Khối / Nghiệp vụ | Showroom | CTy TT | Pháp nhân | Phía
  { key: 'thuong_hieu_bo_phan', label: 'Thương hiệu / Bộ phận', category: 'Công ty' },
  { key: 'khoi_nghiep_vu', label: 'Khối / Nghiệp vụ', category: 'Công ty' },
  { key: 'don_vi', label: 'Showroom', category: 'Công ty' },
  { key: 'cong_ty_tinh_thanh', label: 'CTy TT', category: 'Công ty' },
  { key: 'phap_nhan', label: 'Pháp nhân', category: 'Công ty' },
  { key: 'phia', label: 'Phía', category: 'Công ty' },

  // Nhóm Chi phí: KMP | Nhóm chi phí
  { key: 'kmp', label: 'KMP', category: 'Chi phí' },
  { key: 'nhom_chi_phi', label: 'Nhóm chi phí', category: 'Chi phí' }
];

export interface PivotFlatRecord {
  id: string;
  nam: number;
  thang: number;
  quy: number;
  thang_label: string;
  quy_label: string;
  phia: string;
  cong_ty_tinh_thanh: string;
  don_vi_id: string;
  don_vi: string;
  loai_hinh: string;
  phap_nhan_id: string;
  phap_nhan: string;
  nhom_chi_phi: string;
  kmp_id: string;
  kmp: string;
  kmp_code: string;
  khoi_nghiep_vu: string;
  thuong_hieu_bo_phan: string;
  so_tien: number;
  is_temporary: boolean;
  thuoc_bao_cao_hanh_chinh: boolean;
}

export interface PivotNode {
  key: string;
  label: string;
  field: string;
  depth: number;
  values: Record<string, number>; // colKey -> value
  total: number;
  count: number;
  children: PivotNode[];
  isExpanded?: boolean;
}

export interface PivotColumnHeader {
  key: string;
  label: string;
  field?: string;
  depth?: number;
  children?: PivotColumnHeader[];
}

export interface PivotTableData {
  rootNodes: PivotNode[];
  leafColumns: PivotColumnHeader[];
  grandTotalByCol: Record<string, number>;
  grandTotalAll: number;
  grandTotalCount: number;
}
