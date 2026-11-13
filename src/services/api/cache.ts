import { SUPABASE_URL, HEADERS } from './client';

export const TABLE_MAP: Record<string, string> = {
  'DM_Donvi': 'dm_don_vi',
  'PhapNhan': 'dm_phap_nhan',
  'PhongHop': 'dm_phong_hop',
  'HS_AnNinh': 'hs_an_ninh',
  'HS_PVHC': 'hs_pvhc',
  'HS_PCCC': 'hs_pccc',
  'TS_PCCC': 'ts_pccc',
  'HS_ATVSLD': 'hs_an_toan_lao_dong',
  'HS_PCTT': 'hs_pctt',
  'NhaCungCap': 'dm_ncc',
  'HS_KhamSucKhoe': 'hs_kham_suc_khoe',
  'NK_KhamSucKhoeCaNhan': 'nk_kham_suc_khoe_canhan',
  'Config_KhamSucKhoe': 'config_kham_suc_khoe',
  'DM_KMP': 'dm_kmp',
  'DM_BoPhan': 'dm_bo_phan',
  'DM_BoPhanCap1': 'dm_bo_phan_cap1',
  'DM_BoPhanCap2': 'dm_bo_phan_cap2',
  'DNTT': 'dntt',
  'DNTT_ChiTiet': 'dntt_chi_tiet',
  'DNTT_PhanBo': 'dntt_phan_bo'
};

export const resolveTable = (name: string) => TABLE_MAP[name] || name.toLowerCase();

// Danh sách cột tối ưu mặc định cho từng bảng nếu hàm gọi không chỉ định cột cụ thể (triệt tiêu triệt để select=*)
export const TABLE_DEFAULT_COLUMNS: Record<string, string> = {
  'dntt': 'id,so_dntt,ngay_lap,id_phap_nhan,id_don_vi,nguoi_de_nghi,bo_phan_hien_thi,noi_dung_thanh_toan,tong_so_tien,so_tien_bang_chu,hinh_thuc_thanh_toan,ten_tai_khoan,so_tai_khoan,ten_ngan_hang,chi_nhanh_ngan_hang,trang_thai,created_at,updated_at,don_vi_hien_thi,hien_thi_phan_bo,ky_chuc_danh_1,ky_chuc_danh_2,ky_chuc_danh_3,ky_chuc_danh_4,ky_ho_ten_1,ky_ho_ten_2,ky_ho_ten_3,ky_ho_ten_4,so_hoa_don,ngay_hoa_don,noi_dung_chuyen_khoan,ghi_chu,hien_thi_nd_ck,hien_thi_ghi_chu,dia_diem_ky,ngay_ky_ngay,hien_thi_hoa_don,ngay_ky_nam,ngay_ky_thang,mo_khoa_chinh_sua,hien_thi_cau_dan,cau_dan',
  'dntt_chi_tiet': 'id,dntt_id,stt,noi_dung,so_tien',
  'dntt_phan_bo': 'id,dntt_id,dntt_chi_tiet_id,kieu_nhap,phan_tram,so_tien,id_kmp,thang,nam,id_bo_phan,id_bo_phan_cap1,id_bo_phan_cap2,thu_tu,ghi_chu,created_at',
  'chi_phi_chot_ky': 'id,thang,nam,trang_thai,chot_boi,chot_luc,huy_boi,huy_luc,ghi_chu,id_don_vi,ten_don_vi,danh_sach_don_vi_ap_dung,danh_sach_don_vi_mo_khoa,mo_khoa_toan_bo,han_mo_khoa,ly_do_mo_khoa',
  'hs_khoa_huan_luyen': 'id,id_don_vi,ten_khoa_hoc,don_vi_dao_tao,ngay_bat_dau,ngay_ket_thuc,dia_diem,si_so_du_kien,si_so_thuc_te,trang_thai,link_ho_so,ghi_chu,created_at,updated_at',
  'hs_hoc_vien_khoa_huan_luyen': 'id,id_khoa_hoc,stt,msnv,ho_ten,ngay_sinh,gioi_tinh,so_cccd,quoc_tich,chuc_vu,don_vi_text,id_don_vi,nhom,noi_dung_huan_luyen,thoi_gian_text,diem_ly_thuyet,diem_thuc_hanh,ket_qua,ghi_chu,da_dong_bo_nhan_su,created_at',
  'hs_kham_suc_khoe': 'id,id_don_vi,nam_kham,ten_dot_kham,id_ncc,ten_ncc,hinh_thuc_kham,dia_diem_kham,ngay_lay_mau,ngay_kham_lam_sang,sl_dang_ky,sl_thuc_te,sl_khong_kham,ly_do_khong_kham,tong_chi_phi,goi_kham_schema,goi_kham_values,ket_qua_ksk_json,bnn_lan_1_json,bnn_lan_2_json,danh_gia_ncc,ly_do_ncc_khong_dat,link_bao_cao,ghi_chu,created_at,updated_at,id_ncc_bnn,ten_ncc_bnn,ngay_kham_bnn_lan_1,ngay_kham_bnn_lan_2,goi_kham_bnn_schema,id_config_thong_bao,so_hieu_thong_bao,ap_dung_goi_tap_doan',
  'config_kham_suc_khoe': 'id,nam,loai_dot_kham,so_hieu_thong_bao,tieu_de_thong_bao,ngay_ban_hanh,link_thong_bao,file_dinh_kem_url,trang_thai,goi_kham_schema,goi_kham_bnn_schema,bang_anh_xa_tap_doan,ghi_chu,created_at,updated_at',
  'nk_kham_suc_khoe_canhan': 'id,ma_so_nhan_vien,ho_ten,id_don_vi,nam_kham,id_dot_ksk,ma_goi_kham,ten_goi_kham,loai_suc_khoe,ket_luan_bnn,ten_benh_nghe_nghiep,ngay_kham,ghi_chu_suc_khoe,created_at,nam_sinh,gioi_tinh,hon_nhan,chieu_cao,can_nang',
  'ns_ve_may_bay': 'id,id_nhan_su,ma_so_nhan_vien,ho_ten,id_don_vi,loai_phuong_tien,hang_van_chuyen,id_ncc,ten_ncc,code_ve_di,chuyen_bay_di,ngay_di,chang_di,gia_ve_di,code_ve_ve,chuyen_bay_ve,ngay_ve,chang_ve,gia_ve_ve,phi_doi_ve,phi_hanh_ly,nv_tu_tra,cty_thanh_toan,tong_tien,thang,nam,lan_ve_phep,muc_dich,trang_thai_doi_chieu,tien_ncc_ke,ghi_chu_doi_chieu,ghi_chu,created_at,updated_at',
  'ns_dich_vu': 'id,ma_so_nhan_vien,ho_ten,chuc_vu,sdt_cong_ty,sdt_ca_nhan,email,gioi_tinh,nam_sinh,ngay_nhan_vien,id_don_vi,chuc_danh,trinh_do_hoc_van,tuoi,tham_nien,thu_nhap,mo_to_ngoai_hinh,ghi_chu,cc_atvsld,nhom_doi_tuong,huan_luyen_tu,huan_luyen_den,gia_tri_den,chung_nhan,cc_anbv,cc_pccc,cc_cnch,cc_so_cap_cuu,cc_cpr,cc_vo_thuat,giay_phep_lai_xe,cc_attp,cc_pha_che,cc_ngoai_ngu,cc_tin_hoc,trang_thai,ngay_nghi_viec,cccd,dia_chi,dv_chi_luong,the_thang,the_xe,hang_loai_xe,bks,to_chuc,bo_phan,huong_chinh_sach_ve_phep,dinh_muc_ve_phep_nam,ngach_ve_phep,tuyen_ve_phep,hinh_thuc_ve_phep,ghi_chu_ve_phep,created_at,updated_at',
  'config_users': 'id,user_name,password,ho_ten,id_don_vi,quyen,quyen_truy_cap,quyen_chi_tiet,can_view,can_create,can_update,can_delete,can_delete_unit,can_lock_period',
  'dm_don_vi': 'id,ten_don_vi,cap_quan_ly,dia_chi,dien_tich,so_tang,so_ham,so_phong_cho,so_cong,luot_khach_bq,tong_nhan_su,loai_hinh,trang_thai,phia,id_giam_doc,id_ptkd_xe,id_ptkd_dvpt,id_pt_dvht1,id_pt_dvht2,id_pt_nhan_su,kinh_doanh,created_at,updated_at,thu_tu,vi_do,kinh_do',
  'dm_phap_nhan': 'id,id_don_vi,ten_cong_ty,ma_so_thue,dia_chi,gpkd,mail,created_at,updated_at',
  'dm_ncc': 'id,ten_cong_ty,ten_goi_tat,mst,dai_dien_phap_luat,sdt_ddpl,dau_moi,sdt_dau_moi,email_dau_moi,dia_chi,nhom_dich_vu,dich_vu,id_don_vi,ngay_bat_dau_hd,ngay_het_han_hd,danh_gia,trang_thai,hinh_thuc_tt,link_ho_so,ghi_chu,created_at,dau_moi_json,chuc_vu_ddpl,chuc_vu_dau_moi,gia_han_tu_dong',
  'ts_thiet_bi': 'id,id_don_vi,ma_tai_san,ten_thiet_bi,nhom_thiet_bi,mo_ta_dac_diem,nha_cung_cap,ngay_mua,gia_mua,han_bao_hanh,tinh_trang,so_seri,cpu,ram,ssd,hdd,vga,man_hinh,phu_kien,link_ho_so,vi_tri_bo_tri,don_vi_tinh,quy_cach_chat_lieu,thoi_gian_khau_hao,tai_san_thuoc,created_at,updated_at,link_hinh_anh,so_luong,thong_so_ky_thuat,id_ncc',
  'nk_thiet_bi': 'id,id_ts_thiet_bi,id_don_vi,ngay_ghi_nhan,loai_nhat_ky,msnv_nguoi_dung,ho_ten_nguoi_dung,bp_quan_ly_su_dung,ghi_chu_sua_chua_nang_cap,ghi_chu_su_dung,chi_phi,hinh_anh_minh_chung,tinh_trang_ghi_nhan_thiet_bi,created_at,updated_at',
  'ts_xe': 'id,id_don_vi,muc_dich_su_dung,ma_tai_san,don_vi_chu_so_huu,nguyen_gia,cp_thue_khau_hao,bien_so,loai_phuong_tien,hieu_xe,loai_xe,phien_ban,mau_xe,nam_sx,nam_dk,so_khung,so_may,so_cho,loai_nhien_lieu,dung_tich,cong_thuc_banh,hinh_thuc_so_huu,gps,hien_trang,ghi_chu,created_at,updated_at,han_dang_kiem,han_bh_tnds,han_bh_vc,dia_diem_su_dung,tai_trong,kich_thuoc_xe,kich_thuoc_thung,ngay_thanh_ly,ho_so_xe',
  'cp_hoat_dong_xe': 'id,thang_nam,id_ts_xe,km_hien_tai,so_lit_nhien_lieu,cp_nhien_lieu,cp_cau_duong_ben_bai,cp_rua_xe,cp_bao_duong_sua_chua,cp_thue_khau_hao,ghi_chu,id_don_vi,cp_dang_kiem,cp_bh_tnds,cp_bh_vc',
  'hs_an_toan_lao_dong': 'id,id_don_vi,ghi_chu,nguoi_phu_trach,so_luong_mang_luoi,link_ho_so_quy_dinh,can_cu_quyet_dinh',
  'ts_thiet_bi_nghiem_ngat': 'id,id_don_vi,don_vi_text,so_serial,ten_thiet_bi,ma_thiet_bi,ma_che_tao,thong_so_ky_thuat,dia_diem_lap_dat,tinh_trang,created_at,updated_at',
  'nk_kiem_dinh_tbnn': 'id,id_thiet_bi,ngay_kiem_dinh,hl_kiem_dinh,han_kiem_dinh,nguoi_ky,gia_thanh,loai_kiem_dinh,bien_ban_kiem_dinh,cap_ly_lich,nguoi_ho_tro,tinh_trang_ho_so_luu_tru,ghi_chu,created_at',
  'vb_tb': 'id,id_don_vi,phan_loai,so_hieu,ngay_ban_hanh,tieu_de,noi_dung,nguoi_ky,chuc_vu,nguoi_lay_so,bo_phan_lay_so,pham_vi_ap_dung,hieu_luc,nghiep_vu,link_vb,van_ban_thay_the,mat,noi_goi_nhan,so_den,ngay_nhan,bo_phan_xu_ly,han_xu_ly,trang_thai_xu_ly,muc_do_khan,created_at,updated_at,msnv_nguoi_lay_so',
  'qd_qt': 'id,phan_loai,so_hieu,ngay_ban_hanh,tieu_de,noi_dung,nghiep_vu,link_vb,created_at,updated_at,hieu_luc,bo_phan_lay_so',
  'sys_logs': 'id,thoi_gian,id_user,hanh_dong,chi_tiet,id_don_vi,ho_ten',
  'cp_cuoc_thang': 'id,id_thue_bao,so_dien_thoai,ma_so_nv,ho_ten_nv,id_nhan_su,id_don_vi,id_phap_nhan,thang_nam,tong_cuoc,cuoc_noi_mang,cuoc_ngoai_mang,cuoc_data,cuoc_sms,cuoc_khac,so_phut_goi,dung_luong_data,dinh_muc_snap,trang_thai,ghi_chu,nguoi_nhap,created_at,updated_at,cuoc_goc,cuoc_su_dung,dieu_chinh,khuyen_mai,no_cu,thue',
  'dm_thue_bao': 'id,so_dien_thoai,nha_mang,goi_cuoc,loai_thue_bao,id_nhan_su,ma_so_nv,ho_ten_nv,ten_bo_phan,id_don_vi,id_phap_nhan,ten_phap_nhan,ngay_cap,trang_thai,lich_su_nsd,ghi_chu,created_at,updated_at,dinh_muc_cuoc,id_ncc',
  'dm_kmp': 'id,ma_b7,ma_b10,nhom_chi_phi,dien_giai,trong_yeu,active,created_at,updated_at,bao_cao_chi_phi_hanh_chinh,id_nhom_chi_phi,thuoc_bao_cao_hanh_chinh',
  'dm_nhom_chi_phi': 'id,ten_nhom,so_la_ma,thu_tu,active,created_at',
  'dm_bo_phan': 'id,ma_cap1,ten_cap1,ma_cap2,ten_cap2,thu_tu,active,created_at,id_don_vi',
  'dm_phong_hop': 'id,id_don_vi,ten_phong_hop,vi_tri,suc_chua,tb_trinh_chieu,tb_hop_online,bang_viet,but_viet,but_chi,tb_chuyen_slide,layout,ghi_chu,created_at,updated_at',
  'hs_an_ninh': 'id,id_don_vi,bv_noi_bo,bv_dich_vu,vi_tri_bv_dv,ncc_dich_vu,chi_phi_thue,ngay_ky_hd,han_hop_dong,tong_bv,dinh_bien_bv,ngay_co_dinh,ngay_tuan_tra,dem_co_dinh,dem_tuan_tra,bo_tri_nghi_ca,sl_camera,camera_hoat_dong,camera_hu,ly_do_camera_hu,thoi_gian_luu,vi_tri_he_thong_camera,vi_tri_gs_camera,tinh_hinh_khu_vuc,tiep_giap_truoc,tiep_giap_sau,tiep_giap_trai,tiep_giap_phai,link_pa_anbv,created_at,updated_at,gia_han_them,hang_rao_truoc,hang_rao_sau,hang_rao_trai,hang_rao_phai,id_ncc',
  'hs_pvhc': 'id,id_don_vi,pvhc_khach_cho,pvhc_ve_sinh,hien_huu,dinh_bien,pvhc_dich_vu,ncc_dich_vu,chi_phi_thue,vi_tri,created_at,updated_at,id_ncc',
  'hs_pctt': 'id,id_don_vi,ghi_chu,created_at,updated_at,doi_truong_pctt,sl_nhan_su_doi,link_pa_pctt,vi_tri_di_doi,ngay_kiem_tra_pctt,tinh_trang_ha_tang,tinh_trang_bao_hiem,ngay_cap_nhat_tai_san,so_vu_thien_tai',
  'hs_pccc': 'id,id_don_vi,giay_phep_pccc,bao_hiem_chay_no,ngay_het_han_bh,ho_ten_doi_truong,sdt_doi_truong,chuc_vu,tong_sl_thanh_vien,sl_huy_dong_ban_ngay,sl_huy_dong_ban_dem,ngay_dien_tap,link_phuong_an_pccc,sdt_ca_pccc,sdt_ub,sdt_pccc_xa_phuong,sdt_ca_xa_phuong,sdt_dien_luc,sdt_cap_thoat_nuoc,sdt_yte,he_thong_bao_chay_tu_dong,he_thong_chua_chay_tu_dong_nuoc,he_thong_chua_chay_nuoc,dung_cu_pccc,ghi_chu,created_at,updated_at,khu_vuc_rui_ro_cao,loi_ton_tai_chua_khac_phuc,ten_ca_pccc,ten_ub,ten_pccc_xa_phuong,ten_ca_xa_phuong,ten_dien_luc,ten_yte,sdt_bv_dan_quan,ten_bv_dan_quan,sdt_ca_khu_vuc,ten_ca_khu_vuc,sdt_kho_xe,ten_kho_xe,sdt_tt_bao_ve,ten_tt_bao_ve,sdt_hc_ns,ten_hc_ns,sdt_bv_lien_ket,ten_bv_lien_ket,ten_ptkd_dvpt,sdt_ptkd_dvpt,ten_ptkd_xe,sdt_ptkd_xe,sdt_giam_doc,ten_cap_thoat_nuoc,ten_giam_doc',
  'ts_pccc': 'id,id_don_vi,nhom_he_thong,loai_thiet_bi,so_luong,don_vi_tinh,vi_tri_bo_tri,ngay_bom_sac,ngay_het_han,tinh_trang,created_at,updated_at',
  'dm_chu_ky_atvsld': 'id,nhom,so_thang_hieu_luc,ghi_chu,created_at'
};

// Thời gian sống của bộ đệm (TTL - tăng lên 30 phút để chặn đứng tràn Egress Supabase)
export const CACHE_DURATION = 30 * 60 * 1000;

export interface CacheEntry {
  data: any;
  timestamp: number;
}

// Bộ đệm Layer 1: In-Memory Cache (siêu nhanh trong phiên làm việc)
export const apiCache: Record<string, CacheEntry> = {};

// Khi bảng A thay đổi -> tự động xóa cache các bảng liên quan
export const CACHE_DEPENDENCIES: Record<string, string[]> = {
  'ns_dich_vu':      ['dm_don_vi', 'hs_hoc_vien_khoa_huan_luyen'],        // Thêm/sửa nhân sự -> làm mới đơn vị
  'dm_don_vi':       ['ns_dich_vu'],       // Sửa đơn vị -> làm mới nhân sự
  'ts_xe':           ['cp_hoat_dong_xe'],  // Sửa xe -> làm mới chi phí xe
  'cp_hoat_dong_xe': ['ts_xe'],            // Sửa chi phí -> làm mới xe
  'ts_thiet_bi':     ['nk_thiet_bi'],      // Sửa thiết bị -> làm mới nhật ký
  'nk_thiet_bi':     ['ts_thiet_bi'],      // Sửa nhật ký -> làm mới thiết bị
  'hs_pccc':         ['ts_pccc'],          // Sửa hồ sơ PCCC -> làm mới tài sản PCCC
  'ts_pccc':         ['hs_pccc'],          // Sửa tài sản PCCC -> làm mới hồ sơ
  'hs_khoa_huan_luyen':            ['hs_hoc_vien_khoa_huan_luyen', 'hs_an_toan_lao_dong'],
  'hs_hoc_vien_khoa_huan_luyen':   ['hs_khoa_huan_luyen', 'ns_dich_vu', 'hs_an_toan_lao_dong'],
  'ts_thiet_bi_nghiem_ngat':       ['nk_kiem_dinh_tbnn', 'hs_an_toan_lao_dong'],
  'nk_kiem_dinh_tbnn':             ['ts_thiet_bi_nghiem_ngat', 'hs_an_toan_lao_dong'],
  'dntt':                          ['dntt_chi_tiet', 'dntt_phan_bo'],
  'dntt_chi_tiet':                 ['dntt', 'dntt_phan_bo'],
  'dntt_phan_bo':                  ['dntt', 'dntt_chi_tiet'],
  'dm_bo_phan_cap1':               ['dm_bo_phan_cap2', 'dntt_phan_bo'],
  'dm_bo_phan_cap2':               ['dm_bo_phan_cap1', 'dntt_phan_bo'],
  'dm_kmp':                        ['dntt_phan_bo'],
};

// Helper đọc bộ đệm Layer 2 từ LocalStorage
function getPersistentCache(tableName: string): any | null {
  try {
    const raw = localStorage.getItem(`SMART_CACHE_${tableName}`);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      return parsed.data;
    }
  } catch (e) {
    // Bỏ qua lỗi parse
  }
  return null;
}

// Helper lưu bộ đệm Layer 2 vào LocalStorage với xử lý tràn bộ nhớ an toàn
function setPersistentCache(tableName: string, data: any): void {
  try {
    localStorage.setItem(`SMART_CACHE_${tableName}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e: any) {
    // Nếu quá dung lượng 5MB của localStorage, dọn bớt các cache đã hết hạn hoặc các cache khác
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('SMART_CACHE_') && key !== `SMART_CACHE_${tableName}`) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      // Thử lưu lại
      localStorage.setItem(`SMART_CACHE_${tableName}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (fallbackError) {
      // Nếu vẫn quá dung lượng thì chỉ dùng in-memory cache
      console.warn(`⚠️ LocalStorage đầy. Bảng ${tableName} sẽ chỉ được lưu trên In-Memory Cache.`);
    }
  }
}

// Xóa cache thông minh cho bảng và các bảng phụ thuộc
export function invalidateCache(tableName: string): void {
  const resolved = resolveTable(tableName);
  const targets = [resolved, ...(CACHE_DEPENDENCIES[resolved] || [])];
  
  targets.forEach(target => {
    delete apiCache[target];
    try {
      localStorage.removeItem(`SMART_CACHE_${target}`);
    } catch (e) {}
  });
}

// Smart Two-Layer Fetch với thuật toán Tải song song phân trang (Parallel Batch Fetching)
export async function fetchWithCache(tableName: string, forceRefresh = false, columns = '*') {
  const resolved = resolveTable(tableName);
  let selectParam = columns && columns.trim() ? columns.trim() : '*';
  // Tự động thay thế select=* bằng danh bạ cột tối ưu của bảng nếu có
  if (selectParam === '*' && TABLE_DEFAULT_COLUMNS[resolved]) {
    selectParam = TABLE_DEFAULT_COLUMNS[resolved];
  }

  // 1. Kiểm tra Layer 1: In-Memory Cache
  if (!forceRefresh && apiCache[resolved] && (Date.now() - apiCache[resolved].timestamp < CACHE_DURATION)) {
    return apiCache[resolved].data;
  }

  // 2. Kiểm tra Layer 2: Persistent LocalStorage Cache
  if (!forceRefresh) {
    const persistentData = getPersistentCache(resolved);
    if (persistentData) {
      apiCache[resolved] = { data: persistentData, timestamp: Date.now() };
      return persistentData;
    }
  }

  // 3. Gọi Supabase REST API với Tải song song phân trang (Parallel Batch Fetching)
  try {
    const batchSize = 1000;

    // Lần tải đầu tiên (0 - 999) + Đọc header Content-Range để lấy tổng số dòng
    const firstRes = await fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=${selectParam}`, {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Prefer': 'count=exact',
        'Range': `0-${batchSize - 1}`
      }
    });

    if (!firstRes.ok) throw new Error(`Lỗi tải dữ liệu bảng ${resolved}`);
    const firstBatch: any[] = await firstRes.json();
    let allData: any[] = [...firstBatch];

    // Đọc tổng số bản ghi từ header Content-Range (ví dụ: "0-999/3450" -> 3450)
    const contentRange = firstRes.headers.get('content-range');
    let totalCount = 0;
    if (contentRange && contentRange.includes('/')) {
      const parts = contentRange.split('/');
      totalCount = parseInt(parts[1], 10) || 0;
    }

    // Nếu tổng số dòng > 1000, bắn ĐỒNG THỜI (Parallel) toàn bộ các trang còn lại
    if (totalCount > batchSize) {
      const remainingPromises: Promise<any[]>[] = [];
      for (let from = batchSize; from < totalCount; from += batchSize) {
        const to = Math.min(from + batchSize - 1, totalCount - 1);
        remainingPromises.push(
          fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=${selectParam}`, {
            method: 'GET',
            headers: {
              ...HEADERS,
              'Range': `${from}-${to}`
            }
          }).then(res => {
            if (!res.ok) return [];
            return res.json();
          }).catch(() => [])
        );
      }

      const remainingResults = await Promise.all(remainingPromises);
      remainingResults.forEach(batch => {
        if (Array.isArray(batch)) {
          allData = allData.concat(batch);
        }
      });
    } else if (firstBatch.length === batchSize && totalCount === 0) {
      // Dự phòng nếu máy chủ không trả Content-Range header
      let from = batchSize;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=${selectParam}`, {
          method: 'GET',
          headers: {
            ...HEADERS,
            'Range': `${from}-${from + batchSize - 1}`
          }
        });
        if (!res.ok) break;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          allData = allData.concat(data);
          if (data.length < batchSize) hasMore = false;
          else from += batchSize;
        } else {
          hasMore = false;
        }
      }
    }

    // Cập nhật cả 2 tầng cache
    apiCache[resolved] = { data: allData, timestamp: Date.now() };
    setPersistentCache(resolved, allData);

    return allData;
  } catch (error) {
    // 4. Nếu mất mạng hoặc Supabase lỗi -> Thử trả về dữ liệu cũ nếu có
    if (apiCache[resolved]?.data) {
      console.warn(`⚠️ Dùng cache tạm thời cho bảng ${resolved} do lỗi kết nối.`);
      return apiCache[resolved].data;
    }
    throw error;
  }
}
