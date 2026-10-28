-- ========================================================================================
-- TỔNG HỢP MIGRATION: QUẢN LÝ GÓI KHÁM, ĐỊNH MỨC THÔNG BÁO & ÁNH XẠ ĐỐI ỨNG TẬP ĐOÀN
-- Dự án: QTVP-ASDS
-- Module: An toàn vệ sinh lao động (Khám sức khỏe & Bệnh nghề nghiệp)
-- ========================================================================================

-- 1. TẠO BẢNG CẤU HÌNH THÔNG BÁO & GÓI KHÁM ĐỊNH MỨC
CREATE TABLE IF NOT EXISTS config_kham_suc_khoe (
  id TEXT PRIMARY KEY DEFAULT ('CFG_KSK_' || replace(gen_random_uuid()::text, '-', '')),
  nam INTEGER NOT NULL,                                                     -- Năm áp dụng (VD: 2026)
  loai_dot_kham TEXT NOT NULL,                                              -- 'BNN', 'KSK', 'KSK_VA_BNN'
  so_hieu_thong_bao TEXT NOT NULL,                                          -- Số hiệu văn bản (VD: "88/TB-QTVP")
  tieu_de_thong_bao TEXT NOT NULL,                                          -- Tiêu đề thông báo
  ngay_ban_hanh DATE,                                                       -- Ngày ký ban hành
  link_thong_bao TEXT,                                                      -- Link file PDF văn bản thông báo
  file_dinh_kem_url TEXT,                                                   -- Alias link file PDF đính kèm
  trang_thai TEXT NOT NULL DEFAULT 'DANG_AP_DUNG',                         -- 'DANG_AP_DUNG', 'HET_HIEU_LUC'
  
  -- Danh mục gói KSK kèm Định mức chi phí (JSONB)
  goi_kham_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Danh mục gói BNN kèm Định mức chi phí (JSONB)
  goi_kham_bnn_schema JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Bảng Ma Trận Ánh Xạ Đối Ứng Động (Tập đoàn mẹ THACO AUTO <-> Đơn vị tỉnh thành) (JSONB)
  bang_anh_xa_tap_doan JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  ghi_chu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index tra cứu theo năm & trạng thái hiệu lực
CREATE INDEX IF NOT EXISTS idx_config_ksk_nam ON config_kham_suc_khoe(nam, trang_thai);

-- Cấp quyền đầy đủ cho bảng cấu hình
GRANT ALL ON config_kham_suc_khoe TO anon, authenticated, service_role;


-- 2. BỔ SUNG CÁC CỘT LIÊN KẾT VÀO BẢNG ĐỢT KHÁM 'hs_kham_suc_khoe' HIỆN CÓ
ALTER TABLE hs_kham_suc_khoe 
  ADD COLUMN IF NOT EXISTS id_config_thong_bao TEXT,
  ADD COLUMN IF NOT EXISTS so_hieu_thong_bao TEXT,
  ADD COLUMN IF NOT EXISTS ap_dung_goi_tap_doan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS goi_kham_schema JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS goi_kham_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS goi_kham_bnn_schema JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS goi_kham_bnn_values JSONB DEFAULT '{}'::jsonb;

-- Cấp quyền đầy đủ cho bảng đợt khám (đảm bảo đồng bộ)
GRANT ALL ON hs_kham_suc_khoe TO anon, authenticated, service_role;


-- 3. KHỞI TẠO DỮ LIỆU MẪU MẶC ĐỊNH (SEED DATA NĂM 2026 KÈM MA TRẬN ĐỐI ỨNG THACO AUTO)
INSERT INTO config_kham_suc_khoe (
  id,
  nam,
  loai_dot_kham,
  so_hieu_thong_bao,
  tieu_de_thong_bao,
  ngay_ban_hanh,
  trang_thai,
  goi_kham_schema,
  goi_kham_bnn_schema,
  bang_anh_xa_tap_doan,
  ghi_chu
)
VALUES (
  'CFG_KSK_2026_DEFAULT',
  2026,
  'KSK_VA_BNN',
  '88/TB-QTVP-ATVSLD',
  'Thông báo về việc triển khai khám sức khỏe định kỳ & Bệnh nghề nghiệp năm 2026',
  '2026-03-15',
  'DANG_AP_DUNG',
  '[
    {
      "code": "GK_1",
      "label": "GK 1 (Ngạch A6-A8)",
      "mo_ta": "Gói tiêu chuẩn dành cho Cấp Quản lý & Chuyên viên",
      "price": 1200000,
      "price_nam": 1200000,
      "price_nu_dt": 1500000,
      "price_nu_cgd": 1800000,
      "max_price": 1200000,
      "max_price_nam": 1200000,
      "max_price_nu_dt": 1500000,
      "max_price_nu_cgd": 1800000
    },
    {
      "code": "GK_2",
      "label": "GK 2 (Ngạch B1-B3)",
      "mo_ta": "Gói tiêu chuẩn dành cho Nhân viên nghiệp vụ",
      "price": 1000000,
      "price_nam": 1000000,
      "price_nu_dt": 1200000,
      "price_nu_cgd": 1500000,
      "max_price": 1000000,
      "max_price_nam": 1000000,
      "max_price_nu_dt": 1200000,
      "max_price_nu_cgd": 1500000
    },
    {
      "code": "GK_3A",
      "label": "GK 3A (Kho xe, Lái xe, Bảo vệ, Đón tiếp)",
      "mo_ta": "Gói khám đặc thù nhóm vận hành và an ninh cơ sở",
      "price": 1100000,
      "price_nam": 1100000,
      "price_nu_dt": 1300000,
      "price_nu_cgd": 1600000,
      "max_price": 1100000,
      "max_price_nam": 1100000,
      "max_price_nu_dt": 1300000,
      "max_price_nu_cgd": 1600000
    },
    {
      "code": "GK_3B",
      "label": "GK 3B (Thợ, Kỹ thuật viên Xưởng)",
      "mo_ta": "Gói khám đặc thù độc hại và cơ khí xưởng dịch vụ",
      "price": 1300000,
      "price_nam": 1300000,
      "price_nu_dt": 1500000,
      "price_nu_cgd": 1800000,
      "max_price": 1300000,
      "max_price_nam": 1300000,
      "max_price_nu_dt": 1500000,
      "max_price_nu_cgd": 1800000
    },
    {
      "code": "GK_3C",
      "label": "GK 3C (Tạp vụ, Rửa xe, Phục vụ)",
      "mo_ta": "Gói khám lao động hỗ trợ dịch vụ",
      "price": 900000,
      "price_nam": 900000,
      "price_nu_dt": 1100000,
      "price_nu_cgd": 1400000,
      "max_price": 900000,
      "max_price_nam": 900000,
      "max_price_nu_dt": 1100000,
      "max_price_nu_cgd": 1400000
    }
  ]'::jsonb,
  '[
    {
      "code": "BNN_BUI",
      "label": "Khám BNN Bụi phổi (Chụp X-Quang chuẩn ILO)",
      "price": 350000,
      "max_price": 350000
    },
    {
      "code": "BNN_ON",
      "label": "Khám BNN Điếc nghề nghiệp (Đo thính lực dải tần)",
      "price": 250000,
      "max_price": 250000
    },
    {
      "code": "BNN_HOA_CHAT",
      "label": "Khám BNN Nhiễm độc dung môi / Hóa chất sơn xưởng",
      "price": 450000,
      "max_price": 450000
    }
  ]'::jsonb,
  '[
    {
      "id": "MAP_1",
      "ma_goi_tap_doan": "GK1",
      "ten_goi_tap_doan": "Gói Khám Lãnh đạo cấp cao",
      "ngach_tap_doan": "Ngạch A1-A3",
      "ma_goi_don_vi": "",
      "ten_goi_don_vi": "(Không có đối ứng tại Đơn vị)",
      "ngach_don_vi": ""
    },
    {
      "id": "MAP_2",
      "ma_goi_tap_doan": "GK2",
      "ten_goi_tap_doan": "Gói Khám Lãnh đạo/Quản lý cấp trung",
      "ngach_tap_doan": "Ngạch A4-A5",
      "ma_goi_don_vi": "",
      "ten_goi_don_vi": "(Không có đối ứng tại Đơn vị)",
      "ngach_don_vi": ""
    },
    {
      "id": "MAP_3",
      "ma_goi_tap_doan": "GK3",
      "ten_goi_tap_doan": "Gói Khám Quản lý / Chuyên viên cấp cao",
      "ngach_tap_doan": "Ngạch A6-A7",
      "ma_goi_don_vi": "GK_1",
      "ten_goi_don_vi": "GK 1 (Tiêu chuẩn Quản lý/Chuyên viên)",
      "ngach_don_vi": "Ngạch A6-A8"
    },
    {
      "id": "MAP_4",
      "ma_goi_tap_doan": "GK4",
      "ten_goi_tap_doan": "Gói Khám Nhân viên nghiệp vụ",
      "ngach_tap_doan": "Ngạch B1-B3",
      "ma_goi_don_vi": "GK_2",
      "ten_goi_don_vi": "GK 2 (Nhân viên nghiệp vụ)",
      "ngach_don_vi": "Ngạch B1-B3"
    },
    {
      "id": "MAP_5",
      "ma_goi_tap_doan": "GK4A",
      "ten_goi_tap_doan": "Gói Khám Nhân viên lái xe, Bảo vệ, Cây xanh",
      "ngach_tap_doan": "NV Lái xe, Bảo vệ, Cây xanh",
      "ma_goi_don_vi": "GK_3A",
      "ten_goi_don_vi": "GK 3A (Kho xe, Lái xe, Bảo vệ, Đón tiếp)",
      "ngach_don_vi": "NV Kho xe & Lái xe, Bảo vệ, Đón tiếp KH"
    },
    {
      "id": "MAP_6",
      "ma_goi_tap_doan": "GK4B",
      "ten_goi_tap_doan": "Gói Khám Thợ, Kỹ thuật viên Xưởng",
      "ngach_tap_doan": "Thợ, Xưởng,...",
      "ma_goi_don_vi": "GK_3B",
      "ten_goi_don_vi": "GK 3B (Thợ, Kỹ thuật viên Xưởng)",
      "ngach_don_vi": "Thợ, Kỹ thuật viên Xưởng Dịch vụ,..."
    },
    {
      "id": "MAP_7",
      "ma_goi_tap_doan": "GK4C",
      "ten_goi_tap_doan": "Gói Khám Tạp vụ, Phục vụ, Rửa xe",
      "ngach_tap_doan": "Tạp vụ, Lao động phổ thông",
      "ma_goi_don_vi": "GK_3C",
      "ten_goi_don_vi": "GK 3C (Tạp vụ, Rửa xe, Phục vụ)",
      "ngach_don_vi": "Tạp vụ, Phục vụ, Rửa xe"
    }
  ]'::jsonb,
  'Mẫu cấu hình khởi tạo chuẩn Thông báo THACO AUTO năm 2026'
)
ON CONFLICT (id) DO UPDATE SET
  nam = EXCLUDED.nam,
  loai_dot_kham = EXCLUDED.loai_dot_kham,
  so_hieu_thong_bao = EXCLUDED.so_hieu_thong_bao,
  tieu_de_thong_bao = EXCLUDED.tieu_de_thong_bao,
  ngay_ban_hanh = EXCLUDED.ngay_ban_hanh,
  trang_thai = EXCLUDED.trang_thai,
  goi_kham_schema = EXCLUDED.goi_kham_schema,
  goi_kham_bnn_schema = EXCLUDED.goi_kham_bnn_schema,
  bang_anh_xa_tap_doan = EXCLUDED.bang_anh_xa_tap_doan,
  ghi_chu = EXCLUDED.ghi_chu;
