-- ====================================================================
-- MIGRATION SCRIPT: TÍCH HỢP QUẢN LÝ VỀ PHÉP & ĐỐI CHIẾU VÉ MÁY BAY / TÀU HỎA
-- Dự án: APP_QTVP.ASDS
-- Hướng dẫn: Copy toàn bộ nội dung script này và Dán vào Supabase SQL Editor rồi nhấn RUN.
-- ====================================================================

-- 1. BỔ SUNG CỘT CHÍNH SÁCH VỀ PHÉP VÀO BẢNG NHÂN SỰ (ns_dich_vu)
-- Giúp lưu trực tiếp trạng thái hưởng chính sách và định mức vào hồ sơ nhân sự,
-- không làm phát sinh thêm truy vấn riêng biệt, tiết kiệm tối đa băng thông Egress.

ALTER TABLE IF EXISTS public.ns_dich_vu 
ADD COLUMN IF NOT EXISTS huong_chinh_sach_ve_phep BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.ns_dich_vu 
ADD COLUMN IF NOT EXISTS dinh_muc_ve_phep_nam INTEGER DEFAULT 0;

ALTER TABLE IF EXISTS public.ns_dich_vu 
ADD COLUMN IF NOT EXISTS ngach_ve_phep TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.ns_dich_vu 
ADD COLUMN IF NOT EXISTS tuyen_ve_phep TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.ns_dich_vu 
ADD COLUMN IF NOT EXISTS hinh_thuc_ve_phep TEXT DEFAULT 'Vé máy bay';

ALTER TABLE IF EXISTS public.ns_dich_vu 
ADD COLUMN IF NOT EXISTS ghi_chu_ve_phep TEXT DEFAULT '';

-- Tạo Index hỗ trợ lọc nhanh danh sách nhân sự hưởng chính sách
CREATE INDEX IF NOT EXISTS idx_ns_dich_vu_ve_phep 
ON public.ns_dich_vu(huong_chinh_sach_ve_phep) 
WHERE huong_chinh_sach_ve_phep = TRUE;


-- 2. TẠO BẢNG SỔ THEO DÕI VÉ MÁY BAY & TÀU HỎA (ns_ve_may_bay)
-- Lưu trữ chi tiết từng lượt đặt vé theo đúng cấu trúc nghiệp vụ từ file Excel thực tế.

CREATE TABLE IF NOT EXISTS public.ns_ve_may_bay (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_nhan_su TEXT,                          -- ID nhân sự từ ns_dich_vu
    ma_so_nhan_vien TEXT NOT NULL,             -- Mã nhân viên
    ho_ten TEXT NOT NULL,                      -- Họ tên nhân viên
    id_don_vi TEXT,                            -- Mã đơn vị / Showroom
    loai_phuong_tien TEXT DEFAULT 'Vé máy bay', -- 'Vé máy bay' | 'Tàu hỏa' | 'Khác'
    hang_van_chuyen TEXT,                      -- Hãng bay (VJ, VNA, Bamboo, Vietravel Airlines, Đường sắt...)
    
    -- Thông tin Nhà cung cấp (liên kết với Quản lý NCC - dm_ncc)
    id_ncc TEXT,                               -- ID Nhà cung cấp (dm_ncc)
    ten_ncc TEXT,                              -- Tên / Tên viết tắt NCC (Đại lý vé)

    -- Chi tiết vé lượt đi
    code_ve_di TEXT,                           -- Mã đặt chỗ / Code vé đi
    chuyen_bay_di TEXT,                        -- Số hiệu chuyến bay đi (VD: VJ123)
    ngay_di DATE,                              -- Ngày bay đi
    chang_di TEXT,                             -- Chặng đi (VD: SGN - HAN)
    gia_ve_di NUMERIC(15, 2) DEFAULT 0,        -- Giá vé đi

    -- Chi tiết vé lượt về (nếu vé khứ hồi)
    code_ve_ve TEXT,                           -- Mã đặt chỗ / Code vé về
    chuyen_bay_ve TEXT,                        -- Số hiệu chuyến bay về
    ngay_ve DATE,                              -- Ngày bay về
    chang_ve TEXT,                             -- Chặng về (VD: HAN - SGN)
    gia_ve_ve NUMERIC(15, 2) DEFAULT 0,        -- Giá vé về

    -- Phụ phí & Phân bổ chi phí
    phi_doi_ve NUMERIC(15, 2) DEFAULT 0,       -- Phí đổi vé / giờ bay phát sinh
    phi_hanh_ly NUMERIC(15, 2) DEFAULT 0,      -- Phí mua thêm hành lý
    nv_tu_tra NUMERIC(15, 2) DEFAULT 0,        -- Số tiền nhân viên tự chi trả
    cty_thanh_toan NUMERIC(15, 2) DEFAULT 0,   -- Số tiền Công ty chi trả
    tong_tien NUMERIC(15, 2) DEFAULT 0,        -- Tổng giá trị thanh toán

    -- Kỳ theo dõi & Lần về phép
    thang INTEGER NOT NULL,                    -- Tháng theo dõi (1 - 12)
    nam INTEGER NOT NULL,                      -- Năm theo dõi (VD: 2026)
    lan_ve_phep INTEGER DEFAULT 1,             -- Lần về phép thứ mấy trong năm
    muc_dich TEXT DEFAULT 'Về phép',           -- 'Về phép' | 'Công tác'

    -- Trạng thái đối chiếu công nợ với Nhà cung cấp
    trang_thai_doi_chieu TEXT DEFAULT 'Chưa đối chiếu', -- 'Chưa đối chiếu' | 'Khớp' | 'Lệch tiền' | 'Không tìm thấy'
    tien_ncc_ke NUMERIC(15, 2) DEFAULT 0,      -- Số tiền NCC kê khai trên bảng đối chiếu
    ghi_chu_doi_chieu TEXT,                    -- Ghi chú chênh lệch (nếu có)
    
    ghi_chu TEXT,                              -- Ghi chú chung
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TẠO INDEXES TỐI ƯU HIỆU NĂNG TRUY VẤN CHO ns_ve_may_bay
CREATE INDEX IF NOT EXISTS idx_ns_ve_may_bay_msnv ON public.ns_ve_may_bay(ma_so_nhan_vien);
CREATE INDEX IF NOT EXISTS idx_ns_ve_may_bay_thang_nam ON public.ns_ve_may_bay(nam, thang);
CREATE INDEX IF NOT EXISTS idx_ns_ve_may_bay_code_di ON public.ns_ve_may_bay(code_ve_di);
CREATE INDEX IF NOT EXISTS idx_ns_ve_may_bay_code_ve ON public.ns_ve_may_bay(code_ve_ve);
CREATE INDEX IF NOT EXISTS idx_ns_ve_may_bay_ncc ON public.ns_ve_may_bay(ten_ncc);

-- 4. PHÂN QUYỀN TRUY CẬP (GRANT PERMISSIONS)
GRANT ALL ON TABLE public.ns_ve_may_bay TO anon;
GRANT ALL ON TABLE public.ns_ve_may_bay TO authenticated;
GRANT ALL ON TABLE public.ns_ve_may_bay TO service_role;

-- 5. TRIGGER TỰ ĐỘNG CẬP NHẬT updated_at (NẾU HỆ THỐNG ĐÃ CÓ FUNCTION update_updated_at_column)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS trigger_ns_ve_may_bay_updated_at ON public.ns_ve_may_bay;
        CREATE TRIGGER trigger_ns_ve_may_bay_updated_at
            BEFORE UPDATE ON public.ns_ve_may_bay
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- THÔNG BÁO HOÀN TẤT
COMMENT ON TABLE public.ns_ve_may_bay IS 'Bảng lưu trữ thông tin vé máy bay/tàu hỏa phục vụ quản lý về phép và đối chiếu NCC';

