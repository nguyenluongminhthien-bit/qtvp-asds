-- ============================================================
-- MIGRATION: BẢNG CHỐT KỲ & FACT TABLE THỐNG KÊ CHI PHÍ
-- Dự án: QTVP-ASDS
-- Áp dụng cho: Module Quản lý Chi phí
-- Lưu ý: dm_don_vi giữ nguyên vẹn 100% (đã có sẵn cột phia, loai_hinh, cap_quan_ly)
-- ============================================================

-- 1. Bảng ghi nhận kỳ đã chốt
create table if not exists chi_phi_chot_ky (
  id text primary key default ('CK_' || replace(gen_random_uuid()::text, '-', '')),
  thang int not null check (thang between 1 and 12),
  nam int not null check (nam between 2000 and 2100),
  trang_thai text not null default 'da_chot' check (trang_thai in ('da_chot','da_huy_chot')),
  chot_boi text,
  chot_luc timestamptz not null default now(),
  huy_boi text,
  huy_luc timestamptz,
  ghi_chu text,
  unique (thang, nam)
);
comment on table chi_phi_chot_ky is 'Kỳ tháng/năm đã chốt số liệu thống kê — độc lập, không FK tới dntt';

-- 2. Bảng snapshot tổng hợp (fact table)
-- Cột ma_so_thue lưu trực tiếp MST từ dm_phap_nhan để gom nhóm đúng theo Pháp nhân thật
create table if not exists chi_phi_thong_ke (
  id text primary key default ('TK_' || replace(gen_random_uuid()::text, '-', '')),
  chot_ky_id text not null references chi_phi_chot_ky(id) on delete cascade,
  thang int not null check (thang between 1 and 12),
  nam int not null check (nam between 2000 and 2100),
  id_kmp text references dm_kmp(id),
  id_bo_phan text references dm_bo_phan(id),
  id_don_vi text references dm_don_vi(id),
  id_phap_nhan text references dm_phap_nhan(id),
  ma_so_thue text,
  tong_tien numeric(18,2) not null default 0,
  so_dong_phan_bo int not null default 0,
  created_at timestamptz not null default now()
);
comment on table chi_phi_thong_ke is 'Snapshot Tháng/Năm × KMP × Bộ phận × Đơn vị × Pháp nhân — KHÔNG FK tới dntt/dntt_chi_tiet/dntt_phan_bo, để xóa DNTT cũ không ảnh hưởng bảng này';

-- 3. Chỉ mục tối ưu truy vấn thống kê đa chiều
create unique index if not exists uq_chi_phi_thong_ke_dim
  on chi_phi_thong_ke (chot_ky_id, id_kmp, id_bo_phan, id_don_vi, id_phap_nhan);
create index if not exists idx_thong_ke_ky on chi_phi_thong_ke (nam, thang);
create index if not exists idx_thong_ke_kmp on chi_phi_thong_ke (id_kmp);
create index if not exists idx_thong_ke_bophan on chi_phi_thong_ke (id_bo_phan);
create index if not exists idx_thong_ke_donvi on chi_phi_thong_ke (id_don_vi);
create index if not exists idx_thong_ke_phapnhan on chi_phi_thong_ke (id_phap_nhan);
create index if not exists idx_thong_ke_mst on chi_phi_thong_ke (ma_so_thue);

-- 4. Phân quyền Supabase REST API
grant all on chi_phi_chot_ky to anon, authenticated, service_role;
grant all on chi_phi_thong_ke to anon, authenticated, service_role;
