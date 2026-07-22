export interface User {
  id: string; // Khóa chính (thay cho ID_User)
  user_name: string; 
  password?: string;
  ho_ten: string;
  id_don_vi: string;
  quyen: string; // Đã đổi theo chuẩn Supabase (thay cho NhomQuyen)
  [key: string]: any;
}

export interface SysLog {
  id: string;
  thoi_gian: string;
  id_user: string;
  ho_ten?: string;
  hanh_dong: string;
  chi_tiet: string;
  id_don_vi: string;
  [key: string]: any;
}

export interface DonVi {
  id: string; // Khóa chính (thay cho ID_DonVi)
  ten_don_vi: string;
  cap_quan_ly: string;
  dia_chi: string;
  dien_tich: string | number;
  so_tang: string | number;
  so_ham: string | number;
  so_phong_cho: string | number;
  so_cong: string | number;
  luot_khach_bq: string | number;
  tong_nhan_su: string | number;
  loai_hinh: string;
  trang_thai: string;
  phia: string;
  id_giam_doc?: string;
  id_ptkd_xe?: string;
  id_ptkd_dvpt?: string;
  id_pt_dvht1?: string;
  id_pt_dvht2?: string;
  id_pt_nhan_su?: string;
  kinh_doanh?: string;
  [key: string]: any;
}

export interface Personnel {
  id: string; // Khóa chính (thay cho ID_NhanSu)
  ma_so_nhan_vien: string;
  ho_ten: string;
  chuc_vu: string;
  sdt_cong_ty: string;
  sdt_ca_nhan: string;
  email: string;
  gioi_tinh: string;
  nam_sinh: string;
  ngay_nhan_vien: string;
  id_don_vi: string;
  phan_loai: string;
  trinh_do_hoc_van: string;
  tuoi?: string | number;
  tham_nien?: string;
  thu_nhap: string | number;
  mo_ta_ngoai_hinh: string;
  ghi_chu: string;
  cc_atvsld: boolean;
  nhom_doi_tuong?: string;
  huan_luyen_tu?: string;
  huan_luyen_den?: string;
  gia_tri_den?: string;
  chung_nhan?: string;
  cc_anbv: boolean;
  cc_pccc: boolean;
  cc_cnch: boolean;
  cc_so_cap_cuu: boolean;
  cc_cpr: boolean;
  cc_vo_thuat: boolean;
  giay_phep_lai_xe: string;
  cc_attp: boolean;
  cc_pha_che: boolean;
  cc_ngoai_ngu: boolean;
  cc_tin_hoc: boolean;
  trang_thai: string;
  ngay_nghi_viec: string;
  [key: string]: any;
}

export interface AnNinh {
  id: string; // Khóa chính (thay cho ID_AnNinh)
  id_don_vi: string;
  bv_noi_bo: string | number;
  bv_dich_vu: string | number;
  vi_tri_bv_dv: string;
  ncc_dich_vu: string;
  chi_phi_thue: string | number;
  tong_bv: string | number;
  dinh_bien_bv: string | number;
  ngay_co_dinh: string | number;
  ngay_tuan_tra: string | number;
  dem_co_dinh: string | number;
  dem_tuan_tra: string | number;
  bo_tri_nghi: string | number;
  sl_camera: string | number;
  thoi_gian_luu: string;
  vi_tri_giam_sat: string;
  tinh_hinh_khu_vuc: string;
  tiep_giap_truoc: string;
  tiep_giap_sau: string;
  tiep_giap_trai: string;
  tiep_giap_phai: string;
  hang_rao_truoc?: string;
  hang_rao_sau?: string;
  hang_rao_trai?: string;
  hang_rao_phai?: string;
  link_pa_anbv: string;
  bo_tri_nghi_ca?: string;
  camera_hoat_dong?: string | number;
  camera_hu?: string | number;
  ly_do_camera_hu?: string;
  vi_tri_he_thong_camera?: string;
  vi_tri_gs_camera?: string;
  [key: string]: any;
}

export interface TS_Xe {
  id: string; // Khóa chính (thay cho id_ts_xe)
  id_don_vi: string;
  muc_dich_su_dung: string;
  ma_tai_san: string;
  don_vi_so_huu: string;
  nguyen_gia: string | number;
  khau_hao_thue: string | number;
  bien_so: string;
  loai_phuong_tien: string;
  hieu_xe: string;
  loai_xe: string;
  phien_ban: string;
  mau_xe: string;
  nam_sx: string | number;
  nam_dk: string | number;
  so_khung: string;
  so_may: string;
  so_cho: string | number;
  nhien_lieu: string;
  dung_tich: string;
  cong_thuc_banh: string;
  hinh_thuc_so_huu: string;
  gps: string;
  hien_trang: string;
  ghi_chu: string;
  [key: string]: any;
}

export interface CP_HoatDongXe {
  id: string; // Khóa chính (thay cho ID_ChiPhiXe)
  id_don_vi: string;
  thang_nam: string;
  id_ts_xe: string;
  km_hien_tai: string | number;
  so_lit_nhien_lieu: string | number;
  cp_nhien_lieu: string | number;
  cp_cau_duong_ben_bai: string | number;
  cp_rua_xe: string | number;
  cp_bao_duong_sua_chua: string | number;
  cp_thue_khau_hao: string | number;
  ghi_chu: string;
  [key: string]: any;
}

export interface PhapNhan {
  id: string; // Khóa chính (thay cho Id_Phapnhan)
  id_don_vi: string;
  ten_cong_ty: string;
  ma_so_thue: string;
  dia_chi: string;
  gpkd: string;
  mail: string; // Hoặc email tùy db của bạn
  [key: string]: any;
}

export interface PhongHop {
  id: string; // Khóa chính (thay cho ID_Phonghop)
  id_don_vi: string;
  ten_phong_hop: string;
  vi_tri: string;
  suc_chua: string;
  tb_trinh_chieu: string;
  tb_hop_online: boolean;
  bang_viet: boolean;
  but_viet: string;
  but_chi: string;
  tb_chuyen_slide: boolean;
  layout: string;
  ghi_chu: string;
  [key: string]: any;
}

export interface VB_TB {
  id: string; // Khóa chính (thay cho ID_VanBan)
  id_don_vi: string;
  phan_loai: string;
  so_hieu: string;
  ngay_ban_hanh: string;
  tieu_de: string;
  noi_dung: string;
  nguoi_ky: string;
  chuc_vu: string;
  nguoi_lay_so: string;
  bo_phan_lay_so: string;
  msnv_lay_so?: string;
  msnv_nguoi_lay_so?: string;
  pham_vi_ap_dung: string;
  hieu_luc: string;
  nghiep_vu: string;
  link_vb: string;
  vb_thay_the: string;
  mat: boolean | string;
  noi_goi_nhan?: string;
  so_den?: string;
  ngay_nhan?: string;
  bo_phan_xu_ly?: string;
  han_xu_ly?: string;
  trang_thai_xu_ly?: string;
  muc_do_khan?: string;
  [key: string]: any;
}

export interface ThietBi {
  id: string; // Khóa chính (thay cho ID_TTB)
  id_don_vi: string;
  ma_tai_san: string;
  ten_thiet_bi: string;
  nhom_thiet_bi: string;
  mo_ta_dac_diem: string;
  nha_cung_cap: string;
  ngay_mua: string;
  gia_mua: string;
  han_bao_hanh: string;
  tinh_trang: string;
  link_hinh_anh: string;
  link_ho_so: string;
  so_seri: string;
  cpu: string;
  ram: string;
  ssd: string;
  hdd: string;
  vga: string;
  man_hinh: string;
  phu_kien: string;
  don_vi_tinh: string;
  quy_cach_chat_lieu: string;
  thoi_gian_khau_hao: string;
  tai_san_thuoc: string;
  [key: string]: any;
}

export interface NhatKyThietBi {
  id: string; // Khóa chính (thay cho ID_NKTTB)
  id_ts_thiet_bi: string; // Sửa theo đúng khóa ngoại Supabase
  id_don_vi: string;
  ngay_ghi_nhan: string;
  loai_nhat_ky: string;
  msnv_nguoi_dung: string;
  ho_ten_nguoi_dung: string;
  bp_quan_ly_su_dung: string;
  ghi_chu_sua_chua_nang_cap: string;
  tinh_trang_ghi_nhan_thiet_bi: string;
  chi_phi: string | number;
  [key: string]: any;
}

export interface ATVSLD {
  id: string; // Khóa chính (thay cho ID_ATVSLD)
  id_don_vi: string;
  nguoi_phu_trach: string;
  so_luong_mang_luoi: string | number;
  link_ho_so_quy_dinh: string;
  can_cu_quyet_dinh: string;
  ty_le_hoan_thanh_hl: string;
  ngay_ksk: string;
  ngay_kham_bnn: string;
  ngay_quan_trac_mt: string;
  ty_le_cap_bhld: string;
  ngay_tu_kiem_tra: string;
  cac_loi_hien_truong: string;
  so_tai_nan_trong_nam: string | number;
  link_bien_ban_kiem_tra: string;
  ghi_chu: string;
  [key: string]: any;
}

export interface HS_PCCC {
  id: string; // Khóa chính (thay cho ID_PCCC)
  id_don_vi: string;
  giay_phep_pccc: string;
  bao_hiem_chay_no: string;
  ngay_het_han_bh: string;
  ho_ten_doi_truong: string;
  sdt_doi_truong: string;
  chuc_vu: string;
  tong_sl_thanh_vien: string | number;
  sl_huy_dong_ban_ngay: string | number;
  sl_huy_dong_ban_dem: string | number;
  ngay_dien_tap: string;
  link_phuong_an_pccc: string;
  sdt_pccc: string;
  sdt_ub: string;
  sdt_ca_pccc_catt: string;
  sdt_cax: string;
  sdt_dien_luc: string;
  sdt_cap_thoat_nuoc: string;
  sdt_yte: string;
  ht_bao_chay_tu_dong: string;
  ht_chua_chay_tu_dong_nuoc: string;
  ht_chua_chay_nuoc: string;
  dung_cu_pccc: string;
  khu_vuc_rui_ro_cao?: string;
  loi_ton_tai_chua_khac_phuc?: string;
  ghi_chu?: string;
  [key: string]: any;
}

export interface TS_PCCC {
  id: string; // Khóa chính (thay cho ID_TBPCCC)
  id_don_vi: string;
  nhom_he_thong: string;
  loai_thiet_bi: string;
  so_luong: number | string;
  don_vi_tinh: string;
  vi_tri_bo_tri: string;
  ngay_bom_sac: string;
  ngay_het_han: string;
  tinh_trang: string;
  [key: string]: any;
}

export interface PCTT {
  id: string; // Khóa chính (thay cho ID_PCTT)
  id_don_vi: string;
  doi_truong_pctt: string;
  sl_nhan_su_doi: string | number;
  link_pa_pctt: string;
  vi_tri_di_doi: string;
  ngay_kiem_tra_pctt: string;
  tinh_trang_ha_tang: string;
  tinh_trang_bao_hiem: string;
  ngay_cap_nhat_tai_san: string;
  so_vu_thien_tai: string | number;
  link_ho_so_boi_thuong: string;
  tinh_trang_khac_phuc: string;
  ghi_chu: string;
  [key: string]: any;
}

// Một phần tử trong mảng lich_su_nsd (lưu trong dm_thue_bao.lich_su_nsd)
export interface LichSuNSD {
  ho_ten: string;       // Gõ tay hoặc chọn từ danh sách NV
  ma_so_nv: string;
  tu_ngay: string;      // YYYY-MM-DD
  den_ngay: string;     // YYYY-MM-DD hoặc '' nếu đang dùng
  ly_do: string;        // Lý do chuyển giao / thu hồi
  nguoi_ghi: string;    // Người ghi nhận (tự điền từ user đăng nhập)
}

// Danh mục thuê bao
export interface ThueBao {
  id: string;
  so_dien_thoai: string;
  nha_mang: string;
  goi_cuoc: string;
  loai_thue_bao: string;    // 'Cá nhân' | 'Bộ phận dùng chung' | 'Hotline'
  id_nhan_su: string;
  ma_so_nv: string;
  ho_ten_nv: string;
  ten_bo_phan: string;
  id_don_vi: string;
  id_phap_nhan: string;
  ten_phap_nhan: string;
  ngay_cap: string;
  trang_thai: string;       // 'Đang hoạt động' | 'Tạm ngưng' | 'Đã thu hồi - Chờ tái cấp'
  lich_su_nsd: LichSuNSD[]; // JSON array
  ghi_chu: string;
  [key: string]: any;
}

// Chi phí cước tháng
export interface CuocThang {
  id: string;
  id_thue_bao: string;
  so_dien_thoai: string;
  ma_so_nv: string;
  ho_ten_nv: string;
  id_nhan_su: string;
  id_don_vi: string;
  id_phap_nhan: string;
  thang_nam: string;        // 'YYYY-MM'
  tong_cuoc: number;        // TRƯỜNG CHÍNH — tổng cước phát sinh
  cuoc_noi_mang: number;
  cuoc_ngoai_mang: number;
  cuoc_data: number;
  cuoc_sms: number;
  cuoc_khac: number;
  so_phut_goi: number;
  dung_luong_data: number;
  dinh_muc_snap: number;    // Snapshot định mức tại thời điểm nhập
  cuoc_goc?: number;        // Cước trước KM/Thuế
  khuyen_mai?: number;      // Khuyến mãi
  thue?: number;            // Thuế
  dieu_chinh?: number;      // Điều chỉnh cước
  no_cu?: number;           // Nợ kỳ trước
  cuoc_su_dung?: number;    // Cước sử dụng thực tế
  trang_thai: string;
  ghi_chu: string;
  nguoi_nhap: string;
  [key: string]: any;
}

export interface ChuKyATVSLD {
  id: string;
  nhom: string;
  so_thang_hieu_luc: number;
  ghi_chu?: string;
  [key: string]: any;
}

export interface KhoaHuanLuyen {
  id: string;
  id_don_vi?: string;
  ten_khoa_hoc: string;
  don_vi_dao_tao?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  dia_diem?: string;
  si_so_du_kien?: number;
  si_so_thuc_te?: number;
  trang_thai?: string;
  link_ho_so?: string;
  ghi_chu?: string;
  [key: string]: any;
}

export interface HocVienKhoaHuanLuyen {
  id: string;
  id_khoa_hoc: string;
  stt?: number;
  msnv: string;
  ho_ten?: string;
  ngay_sinh?: string;
  gioi_tinh?: string;
  so_cccd?: string;
  quoc_tich?: string;
  chuc_vu?: string;
  don_vi_text?: string;
  id_don_vi?: string;
  nhom?: string;
  noi_dung_huan_luyen?: string;
  thoi_gian_text?: string;
  diem_ly_thuyet?: number;
  diem_thuc_hanh?: number;
  ket_qua?: string;
  ghi_chu?: string;
  da_dong_bo_nhan_su?: boolean;
  [key: string]: any;
}

export interface ThietBiNghiemNgat {
  id: string;
  id_don_vi: string;
  don_vi_text?: string;
  so_serial?: string;
  ten_thiet_bi: string;
  ma_thiet_bi?: string;
  ma_che_tao?: string;
  thong_so_ky_thuat?: string;
  dia_diem_lap_dat?: string;
  tinh_trang: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface KiemDinhTBNN {
  id: string;
  id_thiet_bi: string;
  ngay_kiem_dinh: string;
  hl_kiem_dinh?: string;
  han_kiem_dinh: string;
  nguoi_ky?: string;
  gia_thanh?: number;
  loai_kiem_dinh?: string;
  bien_ban_kiem_dinh?: string;
  cap_ly_lich?: string;
  nguoi_ho_tro?: string;
  tinh_trang_ho_so_luu_tru?: string;
  ghi_chu?: string;
  created_at?: string;
  [key: string]: any;
}