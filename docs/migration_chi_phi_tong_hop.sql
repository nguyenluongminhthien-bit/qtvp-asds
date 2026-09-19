-- ============================================================
-- MIGRATION TỔNG HỢP: MODULE QUẢN LÝ CHI PHÍ (SUPABASE)
-- Dự án: QTVP-ASDS
-- Phiên bản: Chuẩn hóa theo PROMPT TỔNG HỢP & PHẢN HỒI NGHIỆP VỤ
-- ============================================================

-- ------------------------------------------------------------
-- 1.1. BẢNG CHỐT KỲ & SNAPSHOT THỐNG KÊ
-- ------------------------------------------------------------
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

create table if not exists chi_phi_thong_ke (
  id text primary key default ('TK_' || replace(gen_random_uuid()::text, '-', '')),
  chot_ky_id text not null references chi_phi_chot_ky(id) on delete cascade,
  thang int not null,
  nam int not null,
  id_kmp text references dm_kmp(id),
  id_bo_phan text references dm_bo_phan(id),
  id_don_vi text references dm_don_vi(id),
  id_phap_nhan text references dm_phap_nhan(id),
  ma_so_thue text,
  thuoc_bao_cao_hanh_chinh boolean, -- Đóng băng tại thời điểm chốt kỳ
  tong_tien numeric(18,2) not null default 0,
  so_dong_phan_bo int not null default 0,
  created_at timestamptz not null default now()
);

-- Bổ sung cột nếu bảng đã tạo từ trước nhưng chưa có cột này
alter table chi_phi_thong_ke add column if not exists thuoc_bao_cao_hanh_chinh boolean;

create unique index if not exists uq_chi_phi_thong_ke_dim
  on chi_phi_thong_ke (chot_ky_id, id_kmp, id_bo_phan, id_don_vi, id_phap_nhan);
create index if not exists idx_thong_ke_ky on chi_phi_thong_ke (nam, thang);
create index if not exists idx_thong_ke_kmp on chi_phi_thong_ke (id_kmp);
create index if not exists idx_thong_ke_bophan on chi_phi_thong_ke (id_bo_phan);
create index if not exists idx_thong_ke_donvi on chi_phi_thong_ke (id_don_vi);
create index if not exists idx_thong_ke_phapnhan on chi_phi_thong_ke (id_phap_nhan);
create index if not exists idx_thong_ke_mst on chi_phi_thong_ke (ma_so_thue);

grant all on chi_phi_chot_ky to anon, authenticated, service_role;
grant all on chi_phi_thong_ke to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 1.2. DM_DON_VI: TÁI SỬ DỤNG LOẠI HÌNH, PHÍA & ĐIỀN TỰ ĐỘNG 100%
-- ------------------------------------------------------------
alter table dm_don_vi add column if not exists mien text;
alter table dm_don_vi add column if not exists don_vi_quan_tri text;

-- 1.2.1. Cập nhật cột mien tự động từ cột phia:
update dm_don_vi set mien = case
  when phia ilike '%Bắc%' then 'Bắc'
  when phia ilike '%Nam%' then 'Nam'
  when phia ilike '%VPĐH%' or phia ilike '%Văn phòng%' then 'VPĐH'
  else 'Khác'
end;

-- 1.2.2. Cập nhật don_vi_quan_tri tự động 100% từ loai_hinh & cap_quan_ly:
-- Bước 1: Với các đơn vị là cấp quản trị (Showroom Quản trị, Công ty Tỉnh thành, Văn phòng) -> chính nó
update dm_don_vi 
set don_vi_quan_tri = ten_don_vi
where loai_hinh in ('Showroom Quản trị', 'Công ty Tỉnh thành', 'Văn phòng')
   or cap_quan_ly = 'HO';

-- Bước 2: Với các Showroom con, đại lý -> lấy theo tên của đơn vị cha (cap_quan_ly)
update dm_don_vi con
set don_vi_quan_tri = cha.ten_don_vi
from dm_don_vi cha
where con.cap_quan_ly = cha.id
  and (con.don_vi_quan_tri is null or con.don_vi_quan_tri = '')
  and cha.loai_hinh in ('Showroom Quản trị', 'Công ty Tỉnh thành', 'Văn phòng');

-- Bước 3: Với các đơn vị cấp cháu (2 cấp phân cấp) -> truy vết tiếp lên đơn vị quản trị cấp ông
update dm_don_vi con
set don_vi_quan_tri = ong.ten_don_vi
from dm_don_vi cha
join dm_don_vi ong on cha.cap_quan_ly = ong.id
where con.cap_quan_ly = cha.id
  and (con.don_vi_quan_tri is null or con.don_vi_quan_tri = '')
  and ong.loai_hinh in ('Showroom Quản trị', 'Công ty Tỉnh thành', 'Văn phòng');

-- Fallback nếu còn sót: gán bằng chính tên đơn vị
update dm_don_vi 
set don_vi_quan_tri = ten_don_vi 
where don_vi_quan_tri is null or don_vi_quan_tri = '';

-- ------------------------------------------------------------
-- 1.3. BẢNG DANH MỤC NHÓM CHI PHÍ & ÁNH XẠ DM_KMP
-- ------------------------------------------------------------
create table if not exists dm_nhom_chi_phi (
  id text primary key default ('NCP_' || replace(gen_random_uuid()::text, '-', '')),
  ten_nhom text not null unique,
  so_la_ma text not null,
  thu_tu int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant all on dm_nhom_chi_phi to anon, authenticated, service_role;

-- Seed dữ liệu khớp tuyệt đối với 6 nhóm chi phí đang có thật trong dm_kmp
insert into dm_nhom_chi_phi (id, ten_nhom, so_la_ma, thu_tu) values
  ('NCP_01', 'Chi phí vận hành', 'I', 1),
  ('NCP_02', 'Chi phí tiện ích văn phòng', 'II', 2),
  ('NCP_03', 'Chi phí công tác', 'III', 3),
  ('NCP_04', 'Chi phí Hội họp và tiếp khách', 'IV', 4),
  ('NCP_05', 'Chi phí mua sắm, sửa chữa CCDC, TSCĐ', 'V', 5),
  ('NCP_06', 'Chi phí phục vụ Khách hàng', 'VI', 6)
on conflict (ten_nhom) do update 
  set so_la_ma = excluded.so_la_ma, thu_tu = excluded.thu_tu;

alter table dm_kmp add column if not exists id_nhom_chi_phi text references dm_nhom_chi_phi(id);

-- Update ánh xạ id_nhom_chi_phi cho dm_kmp (xử lý zero-width space chr(8203) nếu có trong chuỗi gốc)
update dm_kmp k
set id_nhom_chi_phi = n.id
from dm_nhom_chi_phi n
where lower(trim(replace(k.nhom_chi_phi, chr(8203), ''))) = lower(trim(replace(n.ten_nhom, chr(8203), '')));

-- ------------------------------------------------------------
-- 1.4. PHẠM VI "CHI PHÍ HÀNH CHÍNH" CHO DM_KMP
-- ------------------------------------------------------------
alter table dm_kmp add column if not exists thuoc_bao_cao_hanh_chinh boolean not null default true;

-- ------------------------------------------------------------
-- 1.5. HÌNH THỨC THANH TOÁN (THÊM 2 HÌNH THỨC MỚI)
-- ------------------------------------------------------------
alter table dntt drop constraint if exists dntt_hinh_thuc_thanh_toan_check;
alter table dntt add constraint dntt_hinh_thuc_thanh_toan_check 
  check (hinh_thuc_thanh_toan in ('Chuyển khoản','Tiền mặt','Cấn trừ công nợ','Ghi nhận chi phí'));

-- ------------------------------------------------------------
-- 1.6. ĐƠN GIẢN HÓA TRẠNG THÁI DNTT (CHỈ CÒN "Đã lưu" | "Lưu cập nhật")
-- ------------------------------------------------------------
-- Map dữ liệu cũ sang 2 giá trị mới:
update dntt set trang_thai = case
  when updated_at = created_at then 'Đã lưu'
  else 'Lưu cập nhật'
end
where trang_thai in ('Nháp','Chờ duyệt','Đã duyệt','Đã thanh toán');

-- Chốt constraint trạng thái:
alter table dntt drop constraint if exists dntt_trang_thai_check;
alter table dntt add constraint dntt_trang_thai_check 
  check (trang_thai in ('Đã lưu','Lưu cập nhật'));
alter table dntt alter column trang_thai set default 'Đã lưu';

-- ------------------------------------------------------------
-- 1.7. BỔ SUNG CÁC CỘT CHỮ KÝ & ĐỊA ĐIỂM KÝ CHO BẢNG DNTT
-- ------------------------------------------------------------
alter table dntt add column if not exists dia_diem_ky text;
alter table dntt add column if not exists ngay_ky_ngay text;
alter table dntt add column if not exists ngay_ky_thang text;
alter table dntt add column if not exists ngay_ky_nam text;
alter table dntt add column if not exists ky_chuc_danh_1 text default 'Phê duyệt';
alter table dntt add column if not exists ky_chuc_danh_2 text default 'Kế toán - Tài chính';
alter table dntt add column if not exists ky_chuc_danh_3 text default 'Trưởng bộ phận';
alter table dntt add column if not exists ky_chuc_danh_4 text default 'Người đề nghị';
alter table dntt add column if not exists ky_ho_ten_1 text;
alter table dntt add column if not exists ky_ho_ten_2 text;
alter table dntt add column if not exists ky_ho_ten_3 text;
alter table dntt add column if not exists ky_ho_ten_4 text;

