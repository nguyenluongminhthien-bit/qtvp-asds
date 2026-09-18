// src/types/cost.ts
export * from './index';

export type ThongKeSubTab = 'doi_sanh' | 'quan_tri';
export type PeriodType = 'thang' | 'quy' | '6thang' | 'nam' | 'custom';
export type DimensionType =
  | 'don_vi_phan_loai'
  | 'mien'
  | 'don_vi_quan_tri'
  | 'phap_nhan_mst'
  | 'showroom'
  | 'khoi_nghiep_vu'
  | 'bo_phan_thuong_hieu';
