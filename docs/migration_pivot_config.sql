-- ============================================================
-- MIGRATION: BẢNG LƯU CẤU HÌNH PIVOT (SAVED PIVOT CONFIGURATION)
-- Dự án: QTVP-ASDS
-- Module: Quản lý Chi phí
-- ============================================================

create table if not exists chi_phi_pivot_config (
  id text primary key default ('PVC_' || replace(gen_random_uuid()::text, '-', '')),
  ten_cau_hinh text not null,
  mo_ta text,
  cau_hinh jsonb not null,                                                     -- Lưu trạng thái Rows/Columns/Values/Filters
  khoa boolean not null default false,                                         -- TRUE = không cho sửa trực tiếp bản gốc
  la_mac_dinh boolean not null default false,                                  -- Cấu hình mở ra đầu tiên khi vào tab
  loai_renderer text not null default 'pivot_generic' check (loai_renderer in ('pivot_generic', 'matrix_thaco')),
  tao_boi text,
  id_don_vi text,                                                              -- Đơn vị sở hữu cấu hình (null = Mẫu dùng chung toàn hệ thống)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index tra cứu theo đơn vị
create index if not exists idx_chi_phi_pivot_config_don_vi on chi_phi_pivot_config(id_don_vi);

grant all on chi_phi_pivot_config to anon, authenticated, service_role;

-- Seed cấu hình Báo cáo mặc định (Báo cáo Quản trị CPHC)
insert into chi_phi_pivot_config (
  id,
  ten_cau_hinh,
  mo_ta,
  cau_hinh,
  khoa,
  la_mac_dinh,
  loai_renderer,
  tao_boi
)
values (
  'PVC_DEFAULT_CPHC',
  'Báo cáo Quản trị CPHC',
  'Mẫu báo cáo ma trận chi phí hành chính mặc định (La Mã > KMP > Đơn vị / Showroom)',
  '{
    "rows": ["nhom_chi_phi", "kmp", "don_vi"],
    "cols": ["thang"],
    "vals": [{"field": "so_tien", "agg": "sum"}],
    "filters": {}
  }'::jsonb,
  true,
  true,
  'matrix_thaco',
  'Hệ thống'
)
on conflict (id) do update set
  ten_cau_hinh = excluded.ten_cau_hinh,
  mo_ta = excluded.mo_ta,
  cau_hinh = excluded.cau_hinh,
  khoa = excluded.khoa,
  la_mac_dinh = excluded.la_mac_dinh,
  loai_renderer = excluded.loai_renderer;

-- ============================================================
-- NẾU ĐÃ TẠO BẢNG TRƯỚC ĐÓ, CHỈ CẦN CHẠY 2 DÒNG LỆNH SAU:
-- ============================================================
alter table chi_phi_pivot_config add column if not exists id_don_vi text;
create index if not exists idx_chi_phi_pivot_config_don_vi on chi_phi_pivot_config(id_don_vi);
