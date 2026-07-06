import { User, DonVi, Personnel, TS_Xe, CP_HoatDongXe, PhapNhan, PhongHop, VB_TB, ThietBi, NhatKyThietBi, ATVSLD, HS_PCCC, TS_PCCC, PCTT } from '../../types';

export const INITIAL_MOCK_DATA: Record<string, any[]> = {
  config_users: [
    {
      id: 'USR1',
      user_name: 'admin',
      password: '1',
      ho_ten: 'Quản trị viên Hệ thống',
      id_don_vi: 'ALL',
      quyen: 'admin',
      quyen_truy_cap: '',
      quyen_chi_tiet: ''
    },
    {
      id: 'USR2',
      user_name: 'user',
      password: '1',
      ho_ten: 'Nguyễn Lương Minh Thiện',
      id_don_vi: 'SR1',
      quyen: 'user',
      quyen_truy_cap: '',
      quyen_chi_tiet: ''
    }
  ],

  dm_don_vi: [
    {
      id: 'HO',
      ten_don_vi: 'Văn phòng Điều hành (HO)',
      cap_quan_ly: '',
      dia_chi: 'TP. Hồ Chí Minh',
      dien_tich: 1200,
      so_tang: 5,
      so_ham: 1,
      so_phong_cho: 3,
      so_cong: 1,
      luot_khach_bq: 150,
      tong_nhan_su: 85,
      loai_hinh: 'Văn phòng',
      trang_thai: 'Hoạt động',
      phia: 'Nam'
    },
    {
      id: 'SR1',
      ten_don_vi: 'Showroom Bình Dương',
      cap_quan_ly: 'HO',
      dia_chi: 'Đại lộ Bình Dương, Thủ Dầu Một',
      dien_tich: 800,
      so_tang: 2,
      so_ham: 0,
      so_phong_cho: 2,
      so_cong: 2,
      luot_khach_bq: 80,
      tong_nhan_su: 32,
      loai_hinh: 'Showroom',
      trang_thai: 'Hoạt động',
      phia: 'Nam'
    },
    {
      id: 'SR2',
      ten_don_vi: 'Showroom Hà Nội',
      cap_quan_ly: 'HO',
      dia_chi: 'Cầu Giấy, Hà Nội',
      dien_tich: 1000,
      so_tang: 3,
      so_ham: 1,
      so_phong_cho: 4,
      so_cong: 2,
      luot_khach_bq: 120,
      tong_nhan_su: 40,
      loai_hinh: 'Showroom',
      trang_thai: 'Hoạt động',
      phia: 'Bắc'
    }
  ],

  ns_dich_vu: [
    {
      id: 'NS1',
      ma_so_nhan_vien: '2112277',
      ho_ten: 'Nguyễn Lương Minh Thiện',
      chuc_vu: 'Trưởng bộ phận Hành chính',
      sdt_cong_ty: '0901234567',
      sdt_ca_nhan: '0987654321',
      email: 'thien.nlm@company.com',
      gioi_tinh: 'Nam',
      nam_sinh: '1995',
      ngay_nhan_viec: '2021-12-01',
      id_don_vi: 'SR1',
      phan_loai: 'Văn phòng',
      trinh_do_hoc_van: 'Đại học',
      thu_nhap: 22000000,
      mo_ta_ngoai_hinh: 'Cao 1m75, đeo kính',
      ghi_chu: 'Phụ trách chung văn phòng Bình Dương',
      cc_atvsld: true,
      cc_anbv: false,
      cc_pccc: true,
      cc_cnch: false,
      cc_so_cap_cuu: true,
      cc_cpr: true,
      cc_vo_thuat: false,
      giay_phep_lai_xe: 'B2',
      cc_attp: false,
      cc_pha_che: false,
      cc_ngoai_ngu: true,
      cc_tin_hoc: true,
      trang_thai: 'Đang làm việc',
      ngay_nghi_viec: ''
    },
    {
      id: 'NS2',
      ma_so_nhan_vien: '2201002',
      ho_ten: 'Nguyễn Đức Hồng Long',
      chuc_vu: 'Nhân viên Bảo vệ',
      sdt_cong_ty: '0902345678',
      sdt_ca_nhan: '0976543210',
      email: 'long.ndh@company.com',
      gioi_tinh: 'Nam',
      nam_sinh: '1998',
      ngay_nhan_viec: '2022-01-15',
      id_don_vi: 'SR1',
      phan_loai: 'Bảo vệ',
      trinh_do_hoc_van: 'Trung học',
      thu_nhap: 9500000,
      mo_ta_ngoai_hinh: 'Cao 1m80, khỏe mạnh',
      ghi_chu: 'Làm ca đêm',
      cc_atvsld: true,
      cc_anbv: true,
      cc_pccc: true,
      cc_cnch: true,
      cc_so_cap_cuu: true,
      cc_cpr: false,
      cc_vo_thuat: true,
      giay_phep_lai_xe: 'A1',
      cc_attp: false,
      cc_pha_che: false,
      cc_ngoai_ngu: false,
      cc_tin_hoc: false,
      trang_thai: 'Đang làm việc',
      ngay_nghi_viec: ''
    }
  ],

  ts_xe: [
    {
      id: 'XE1',
      id_don_vi: 'SR1',
      muc_dich_su_dung: 'Giao xe khách hàng',
      ma_tai_san: 'TS-XE-001',
      don_vi_so_huu: 'Chi nhánh Bình Dương',
      nguyen_gia: 950000000,
      khau_hao_thue: 10000000,
      bien_so: '61A-12345',
      loai_phuong_tien: 'Ô tô con',
      hieu_xe: 'Toyota',
      loai_xe: 'Camry',
      phien_ban: '2.5Q',
      mau_xe: 'Đen',
      nam_sx: 2022,
      nam_dk: 2022,
      so_khung: 'RLAA1234567890',
      so_may: '2AR-FE123456',
      so_cho: 5,
      nhien_lieu: 'Xăng',
      dung_tich: '2.5L',
      cong_thuc_banh: '4x2',
      hinh_thuc_so_huu: 'Mua mới',
      gps: 'Có',
      hien_trang: 'Hoạt động',
      ghi_chu: 'Xe đi giao showroom thường xuyên'
    }
  ],

  cp_hoat_dong_xe: [
    {
      id: 'CP1',
      id_don_vi: 'SR1',
      thang_nam: '2026-06',
      id_ts_xe: 'XE1',
      km_hien_tai: 18500,
      so_lit_nhien_lieu: 140,
      cp_nhien_lieu: 3200000,
      cp_cau_duong_ben_bai: 450000,
      cp_rua_xe: 180000,
      cp_bao_duong_sua_chua: 1200000,
      cp_thue_khau_hao: 0,
      ghi_chu: 'Đi công tác tỉnh nhiều'
    }
  ],

  ts_thiet_bi: [
    {
      id: 'TB1',
      id_don_vi: 'SR1',
      ma_tai_san: 'TS-IT-001',
      ten_thiet_bi: 'PC Gaming Văn Phòng',
      nhom_thiet_bi: 'Máy móc CNTT (PC, Laptop, Server...)',
      mo_ta_dac_diem: 'Core i7, RAM 16GB, SSD 512GB',
      nha_cung_cap: 'Phong Vũ IT',
      ngay_mua: '2023-05-10',
      gia_mua: '18500000',
      han_bao_hanh: '2025-05-10',
      tinh_trang: 'Tốt',
      link_hinh_anh: '',
      link_ho_so: '',
      so_seri: 'PCDELL12345',
      cpu: 'Core i7 12700',
      ram: '16GB',
      ssd: '512GB',
      hdd: 'None',
      vga: 'GTX 1650',
      man_hinh: 'Dell 24 inch',
      phu_kien: 'Chuột, phím, tai nghe',
      don_vi_tinh: 'Bộ',
      quy_cach_chat_lieu: 'Kim loại/Nhựa',
      thoi_gian_khau_hao: '3 năm',
      tai_san_thuoc: 'Công ty sở hữu'
    }
  ],

  nk_thiet_bi: [
    {
      id: 'NK1',
      id_ts_thiet_bi: 'TB1',
      id_don_vi: 'SR1',
      ngay_ghi_nhan: '2023-05-11',
      loai_nhat_ky: 'Bàn giao',
      msnv_nguoi_dung: '2112277',
      ho_ten_nguoi_dung: 'Nguyễn Lương Minh Thiện',
      bp_quan_ly_su_dung: 'Bộ phận Hành chính',
      ghi_chu_sua_chua_nang_cap: 'Bàn giao máy mới 100%',
      tinh_trang_ghi_nhan_thiet_bi: 'Mới nguyên seal',
      chi_phi: 0
    }
  ],

  hs_an_ninh: [
    {
      id: 'AN1',
      id_don_vi: 'SR1',
      bv_noi_bo: 2,
      bv_dich_vu: 4,
      vi_tri_bv_dv: 'Cổng chính và Bãi xe',
      ncc_dich_vu: 'Công ty Bảo vệ Thắng Lợi',
      chi_phi_thue: 35000000,
      tong_bv: 6,
      dinh_bien_bv: 6,
      ngay_co_dinh: 1,
      ngay_tuan_tra: 1,
      dem_co_dinh: 1,
      dem_tuan_tra: 1,
      bo_tri_nghi: 'Xoay ca tuần',
      sl_camera: 16,
      thoi_gian_luu: '30 ngày',
      vi_tri_giam_sat: 'Phòng bảo vệ trung tâm',
      tinh_hinh_khu_vuc: 'An ninh tốt',
      tiep_giap_truoc: 'Đường quốc lộ',
      tiep_giap_sau: 'Khu dân cư',
      tiep_giap_trai: 'Công ty xăng dầu',
      tiep_giap_phai: 'Đất trống',
      link_pa_anbv: '',
      camera_hoat_dong: 15,
      camera_hu: 1,
      ly_do_camera_hu: 'Hỏng nguồn ngoài trời',
      vi_tri_he_thong_camera: 'Mái hiên showroom',
      vi_tri_gs_camera: 'Phòng bảo vệ'
    }
  ],

  hs_pvhc: [],
  hs_pctt: [],
  sys_logs: [],

  hs_pccc: [
    {
      id: 'PCCC1',
      id_don_vi: 'SR1',
      giay_phep_pccc: 'GP-PCCC-BD2022',
      bao_hiem_chay_no: 'BHCN-123456',
      ngay_het_han_bh: '2026-12-31',
      ho_ten_doi_truong: 'Nguyễn Lương Minh Thiện',
      sdt_doi_truong: '0901234567',
      chuc_vu: 'Đội trưởng PCCC cơ sở',
      tong_sl_thanh_vien: 10,
      sl_huy_dong_ban_ngay: 6,
      sl_huy_dong_ban_dem: 4,
      ngay_dien_tap: '2025-10-15',
      link_phuong_an_pccc: '',
      sdt_pccc: '114',
      sdt_ub: '0274-123456',
      sdt_ca_pccc_catt: '0274-999999',
      sdt_cax: '0274-888888',
      sdt_dien_luc: '19001006',
      sdt_cap_thoat_nuoc: '0274-555555',
      sdt_yte: '115',
      ht_bao_chay_tu_dong: 'Hoạt động tốt',
      ht_chua_chay_tu_dong_nuoc: 'Không có',
      ht_chua_chay_nuoc: 'Họng nước vách tường hoạt động tốt',
      dung_cu_pccc: 'Bình chữa cháy xách tay, rìu, búa, câu liêm',
      khu_vuc_rui_ro_cao: 'Kho phụ tùng, Bãi chứa xe',
      loi_ton_tai_chua_khac_phuc: 'Thiếu 2 biển chỉ dẫn exit ở tầng lửng',
      ghi_chu: 'Kế hoạch kiểm tra định kỳ hàng tháng'
    }
  ],

  ts_pccc: [
    {
      id: 'TSPCCC1',
      id_don_vi: 'SR1',
      nhom_he_thong: 'Bình chữa cháy xách tay',
      loai_thiet_bi: 'Bình bột BC MFZ4',
      so_luong: 24,
      don_vi_tinh: 'Bình',
      vi_tri_bo_tri: 'Dọc hành lang và khu vực kỹ thuật',
      ngay_bom_sac: '2025-11-20',
      ngay_het_han: '2026-11-20',
      tinh_trang: 'Đầy áp suất, sẵn sàng dùng'
    }
  ],

  hs_an_toan_lao_dong: [
    {
      id: 'ATLD1',
      id_don_vi: 'SR1',
      nguoi_phu_trach: 'Nguyễn Lương Minh Thiện',
      so_luong_mang_luoi: 3,
      link_ho_so_quy_dinh: '',
      khoa_huan_luyen_tu: '2025-03-01',
      khoa_huan_luyen_den: '2025-03-03',
      can_cu_quyet_dinh: 'QĐ-HL-ATLD-SR1',
      thong_ke_hl: { total: 32, passed: 32, failed: 0 },
      ty_le_hoan_thanh_hl: '100%',
      ngay_ksk: '2025-06-15',
      ngay_kham_bnn: '2025-06-16',
      so_luong_thiet_bi_nghiem_ngat: 2,
      so_luong_thiet_bi_qua_han_kt: 0,
      ngay_quan_trac_mt: '2025-09-10',
      ty_le_cap_bhld: '100%',
      ngay_tu_kiem_tra: '2026-05-15',
      cac_loi_hien_truong: 'Không phát hiện lỗi nghiêm trọng',
      so_tai_nan_trong_nam: 0,
      link_bien_ban_kiem_tra: '',
      ghi_chu: 'Duy trì vệ sinh 5S hàng ngày'
    }
  ],

  dm_phap_nhan: [
    {
      id: 'PN1',
      id_don_vi: 'HO',
      ten_cong_ty: 'CÔNG TY CỔ PHẦN THƯƠNG MẠI DỊCH VỤ Ô TÔ',
      ma_so_thue: '0312345678',
      dia_chi: 'Quận 1, TP. Hồ Chí Minh',
      gpkd: 'ĐKKD số 0312345678 do Sở KHĐT TP.HCM cấp',
      mail: 'contact@company.com'
    }
  ],

  dm_phong_hop: [
    {
      id: 'PH1',
      id_don_vi: 'HO',
      ten_phong_hop: 'Phòng họp Hội đồng (VIP)',
      vi_tri: 'Tầng 4, tòa nhà HO',
      suc_chua: '30 người',
      tb_trinh_chieu: 'Màn hình LED 100 inch',
      tb_hop_online: true,
      bang_viet: true,
      but_viet: 'Có sẵn',
      but_chi: 'Có sẵn',
      tb_chuyen_slide: true,
      layout: 'Oval',
      ghi_chu: 'Yêu cầu đăng ký trước 24 tiếng'
    }
  ],

  qd_qt: [
    {
      id: 'QD1',
      id_don_vi: 'HO',
      phan_loai: 'Quy định',
      so_hieu: 'QD-01-2025',
      ngay_ban_hanh: '2025-01-01',
      tieu_de: 'Quy định Sử dụng Tài sản và Thiết bị Công nghệ',
      noi_dung: 'Tất cả cán bộ nhân viên phải bảo quản trang thiết bị làm việc được giao...',
      nguoi_ky: 'Tổng Giám Đốc',
      hieu_luc: 'Có hiệu lực',
      nghiep_vu: 'Quản trị Văn phòng',
      link_vb: '',
      vb_thay_the: '',
      mat: false
    }
  ],

  vb_tb: [
    {
      id: 'VB1',
      id_don_vi: 'HO',
      phan_loai: 'Văn bản đến',
      so_hieu: 'VB-128-SXD',
      ngay_ban_hanh: '2026-05-12',
      tieu_de: 'Về việc kiểm tra phòng chống lụt bão mùa mưa năm 2026',
      noi_dung: 'Công văn từ Sở Xây dựng yêu cầu các doanh nghiệp rà soát hạ tầng phòng chống thiên tai...',
      nguoi_ky: 'Phó Giám đốc Sở',
      chuc_vu: 'Phó Giám đốc',
      nguoi_lay_so: 'Văn thư HO',
      bo_phan_lay_so: 'Hành chính Tổng hợp',
      pham_vi_ap_dung: 'Toàn hệ thống',
      hieu_luc: 'Có hiệu lực',
      nghiep_vu: 'Văn thư lưu trữ',
      link_vb: '',
      vb_thay_the: '',
      mat: false,
      so_den: 'SXD-1025',
      ngay_nhan: '2026-05-14',
      bo_phan_xu_ly: 'Ban Quản lý cơ sở vật chất',
      han_xu_ly: '2026-06-15',
      trang_thai_xu_ly: 'Đang xử lý',
      muc_do_khan: 'Khẩn'
    }
  ]
};
