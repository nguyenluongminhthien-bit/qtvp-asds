-- ============================================================
-- SCHEMA: MODULE QUẢN LÝ CHI PHÍ HÀNH CHÍNH (NATIVE, SUPABASE)
-- Dự án: QTVP-ASDS
-- Phiên bản đã hiệu chỉnh theo kết quả Audit thực tế:
-- Dùng TEXT cho id và các khóa ngoại để tương thích 100% với dm_don_vi & dm_phap_nhan
-- ============================================================

-- 1. DANH MỤC KHOẢN MỤC PHÍ
create table if not exists dm_kmp (
  id text primary key default ('KMP_' || replace(gen_random_uuid()::text, '-', '')),
  ma_b7 text not null,
  ma_b10 text,
  nhom_chi_phi text not null,
  dien_giai text,
  trong_yeu boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table dm_kmp is 'Danh mục Khoản mục phí: Mã B7/B10, Nhóm chi phí, Trọng yếu';

-- 2. DANH MỤC BỘ PHẬN (GỘP CẤP 1 & CẤP 2 THÀNH 1 BẢNG PHẲNG TƯƠNG TỰ DM_KMP)
-- Cấp 1: Khối / Nghiệp vụ
-- Cấp 2: Thương hiệu / Phòng / Bộ phận (phụ thuộc theo Cấp 1)
create table if not exists dm_bo_phan (
  id text primary key default ('BP_' || replace(gen_random_uuid()::text, '-', '')),
  ma_cap1 text not null,       -- Mã Khối/Nghiệp vụ (KD_XE, KD_DV, NVQT, DUNG_CHUNG...)
  ten_cap1 text not null,      -- Tên Khối/Nghiệp vụ (Kinh doanh xe, Kinh doanh DV, Nghiệp vụ Quản trị, Dùng chung & Khác)
  ma_cap2 text not null,       -- Mã Thương hiệu/Phòng/Bộ phận (KIA, MAZDA, QTVP, MKT, HR, KTTC...)
  ten_cap2 text not null,      -- Tên Thương hiệu/Phòng/Bộ phận (Kia, Mazda, Quản trị Văn phòng, Marketing, Nhân sự...)
  thu_tu int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table dm_bo_phan is 'Danh mục Bộ phận: Cấp 1 (Khối/Nghiệp vụ) và Cấp 2 (Thương hiệu/Phòng/Bộ phận)';

-- (Tùy chọn tương thích ngược: dm_bo_phan_cap1 & dm_bo_phan_cap2 nếu môi trường cũ chưa migrate)
create table if not exists dm_bo_phan_cap1 (
  id text primary key default ('BP1_' || replace(gen_random_uuid()::text, '-', '')),
  ma text not null unique,
  ten text not null,
  yeu_cau_cap2 boolean not null default false,
  thu_tu int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists dm_bo_phan_cap2 (
  id text primary key default ('BP2_' || replace(gen_random_uuid()::text, '-', '')),
  ma text not null unique,
  ten text not null,
  thu_tu int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. GIẤY ĐỀ NGHỊ THANH TOÁN (HEADER)
create table if not exists dntt (
  id text primary key default ('DNTT_' || replace(gen_random_uuid()::text, '-', '')),
  so_dntt text unique,                          -- mã tự sinh, ví dụ DNTT-2026-0001
  ngay_lap date not null default current_date,

  id_phap_nhan text references dm_phap_nhan(id) on delete set null, -- FK tới dm_phap_nhan hiện có
  id_don_vi text references dm_don_vi(id) on delete set null,       -- FK tới dm_don_vi hiện có (Showroom)

  nguoi_de_nghi text not null,
  bo_phan_hien_thi text,    -- Ô "Bộ phận" gõ tay tự do, CHỈ để in trên form — KHÔNG liên quan Cấp 1/Cấp 2
  noi_dung_thanh_toan text,

  tong_so_tien numeric(18,2) not null default 0,
  so_tien_bang_chu text,

  hinh_thuc_thanh_toan text not null default 'Chuyển khoản'
    check (hinh_thuc_thanh_toan in ('Chuyển khoản','Tiền mặt')),
  ten_tai_khoan text,
  so_tai_khoan text,
  ten_ngan_hang text,
  chi_nhanh_ngan_hang text,

  trang_thai text not null default 'Nháp'
    check (trang_thai in ('Nháp','Chờ duyệt','Đã duyệt','Đã thanh toán','Từ chối')),

  hien_thi_phan_bo boolean not null default true,
  so_hoa_don text,
  ngay_hoa_don text,
  noi_dung_chuyen_khoan text,
  ghi_chu text,
  hien_thi_nd_ck boolean not null default true,
  hien_thi_ghi_chu boolean not null default true,
  ky_chuc_danh_1 text default 'Phê duyệt',
  ky_chuc_danh_2 text default 'Kế toán - Tài chính',
  ky_chuc_danh_3 text default 'Trưởng bộ phận',
  ky_chuc_danh_4 text default 'Người đề nghị',
  ky_ho_ten_1 text default '',
  ky_ho_ten_2 text default '',
  ky_ho_ten_3 text default '',
  ky_ho_ten_4 text default '',

  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table dntt is 'Giấy Đề nghị Thanh toán — header, khớp mẫu MAU_DNTT.md';

-- 5. CHI TIẾT NỘI DUNG THANH TOÁN (dòng cha trên giấy DNTT)
create table if not exists dntt_chi_tiet (
  id text primary key default ('CT_' || replace(gen_random_uuid()::text, '-', '')),
  dntt_id text not null references dntt(id) on delete cascade,
  stt int not null,
  noi_dung text not null,
  so_tien numeric(18,2) not null default 0
);
comment on table dntt_chi_tiet is 'Các dòng nội dung thanh toán hiển thị trên giấy DNTT có STT';

-- 6. DÒNG PHÂN BỔ NỘI BỘ (dòng con gắn theo từng dòng cha)
create table if not exists dntt_phan_bo (
  id text primary key default ('PB_' || replace(gen_random_uuid()::text, '-', '')),
  dntt_id text not null references dntt(id) on delete cascade,
  dntt_chi_tiet_id text not null references dntt_chi_tiet(id) on delete cascade,

  kieu_nhap text not null default 'SO_TIEN' check (kieu_nhap in ('PHAN_TRAM','SO_TIEN')),
  phan_tram numeric(7,2),
  so_tien numeric(18,2) not null check (so_tien >= 0),

  id_kmp text not null references dm_kmp(id),
  thang int not null check (thang between 1 and 12),
  nam int not null check (nam between 2000 and 2100),

  -- Liên kết bộ phận: trỏ trực tiếp vào dm_bo_phan
  id_bo_phan text references dm_bo_phan(id),
  -- (Giữ lại các trường cũ dạng nullable để tương thích ngược 100%)
  id_bo_phan_cap1 text,
  id_bo_phan_cap2 text,

  thu_tu int not null default 0,  -- thứ tự hiển thị dòng con khi in ra file
  ghi_chu text,
  created_at timestamptz not null default now()
);
comment on table dntt_phan_bo is 'Phân bổ chi phí theo dòng nội dung, KMP và bộ phận (Khối/Nghiệp vụ & Thương hiệu/Phòng/Bộ phận)';

-- 7. CHỈ MỤC & VIEW KIỂM TRA
create index if not exists idx_dntt_phan_bo_dntt on dntt_phan_bo(dntt_id);
create index if not exists idx_dntt_phan_bo_chitiet on dntt_phan_bo(dntt_chi_tiet_id);
create index if not exists idx_dntt_phan_bo_ky on dntt_phan_bo(nam, thang);
create index if not exists idx_dntt_phan_bo_kmp on dntt_phan_bo(id_kmp);
create index if not exists idx_dntt_phan_bo_bophan on dntt_phan_bo(id_bo_phan);
create index if not exists idx_dntt_status on dntt(trang_thai);

create or replace view v_dntt_chi_tiet_check_tong as
select
  ct.id as dntt_chi_tiet_id,
  ct.dntt_id,
  ct.noi_dung,
  ct.so_tien as so_tien_dong_goc,
  coalesce(sum(pb.so_tien), 0) as tong_da_phan_bo,
  ct.so_tien - coalesce(sum(pb.so_tien), 0) as chenh_lech
from dntt_chi_tiet ct
left join dntt_phan_bo pb on pb.dntt_chi_tiet_id = ct.id
group by ct.id, ct.dntt_id, ct.noi_dung, ct.so_tien;
comment on view v_dntt_chi_tiet_check_tong is 'Kiểm tra dòng nội dung nào chưa phân bổ đủ 100% số tiền của chính nó';

-- 8. CẤP QUYỀN TRUY CẬP CHO SUPABASE REST API
grant all on dm_kmp to anon, authenticated, service_role;
grant all on dm_bo_phan to anon, authenticated, service_role;
grant all on dm_bo_phan_cap1 to anon, authenticated, service_role;
grant all on dm_bo_phan_cap2 to anon, authenticated, service_role;
grant all on dntt to anon, authenticated, service_role;
grant all on dntt_chi_tiet to anon, authenticated, service_role;
grant all on dntt_phan_bo to anon, authenticated, service_role;
grant select on v_dntt_chi_tiet_check_tong to anon, authenticated, service_role;

-- 9. DỮ LIỆU SEED MẪU BẢNG BỘ PHẬN (KHỐI/NGHIỆP VỤ & THƯƠNG HIỆU/PHÒNG/BỘ PHẬN)
insert into dm_bo_phan (id, ma_cap1, ten_cap1, ma_cap2, ten_cap2, thu_tu, active) values
  -- KHỐI KINH DOANH XE -> THƯƠNG HIỆU XE
  ('BP_KDX_KIA',     'KD_XE', 'Kinh doanh xe', 'KIA',     'Kia',              1,  true),
  ('BP_KDX_MAZDA',   'KD_XE', 'Kinh doanh xe', 'MAZDA',   'Mazda',            2,  true),
  ('BP_KDX_PEUGEOT', 'KD_XE', 'Kinh doanh xe', 'PEUGEOT', 'Peugeot',          3,  true),
  ('BP_KDX_BMW',     'KD_XE', 'Kinh doanh xe', 'BMW',     'BMW',              4,  true),
  ('BP_KDX_TAIBUS',  'KD_XE', 'Kinh doanh xe', 'TAI_BUS', 'Tải / Bus',        5,  true),
  -- KHỐI KINH DOANH DỊCH VỤ -> XƯỞNG DỊCH VỤ / THƯƠNG HIỆU
  ('BP_KDDV_KIA',     'KD_DV', 'Kinh doanh DV', 'DV_KIA',     'Dịch vụ Kia',     10, true),
  ('BP_KDDV_MAZDA',   'KD_DV', 'Kinh doanh DV', 'DV_MAZDA',   'Dịch vụ Mazda',   11, true),
  ('BP_KDDV_PEUGEOT', 'KD_DV', 'Kinh doanh DV', 'DV_PEUGEOT', 'Dịch vụ Peugeot', 12, true),
  ('BP_KDDV_CHUNG',   'KD_DV', 'Kinh doanh DV', 'DV_CHUNG',   'Dịch vụ Chung',   13, true),
  -- KHỐI NGHIỆP VỤ QUẢN TRỊ -> PHÒNG BAN CHỨC NĂNG
  ('BP_NVQT_QTVP', 'NVQT', 'Nghiệp vụ Quản trị', 'QTVP', 'Quản trị Văn phòng', 20, true),
  ('BP_NVQT_MKT',  'NVQT', 'Nghiệp vụ Quản trị', 'MKT',  'Marketing',          21, true),
  ('BP_NVQT_HR',   'NVQT', 'Nghiệp vụ Quản trị', 'HR',   'Nhân sự / HCNS',     22, true),
  ('BP_NVQT_KTTC', 'NVQT', 'Nghiệp vụ Quản trị', 'KTTC', 'Kế toán Tài chính',  23, true),
  ('BP_NVQT_IT',   'NVQT', 'Nghiệp vụ Quản trị', 'IT',   'Công nghệ Thông tin',24, true),
  ('BP_NVQT_BGD',  'NVQT', 'Nghiệp vụ Quản trị', 'BGD',  'Ban Giám đốc',       25, true),
  -- DÙNG CHUNG & KHÁC
  ('BP_DC_CHUNG', 'DUNG_CHUNG', 'Dùng chung & Khác', 'CHUNG', 'Chi phí dùng chung', 30, true)
on conflict (id) do nothing;
