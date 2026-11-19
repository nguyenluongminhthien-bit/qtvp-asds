import { SUPABASE_URL, HEADERS, API_MODE } from './client';
import { currentUser } from './auth';
import { saveLocalRecord, getLocalRecords } from './localStore';

// Danh sách hành động cho phép ghi log: Chỉ ghi Đăng nhập, Đăng xuất và Truy cập phân hệ
const ALLOWED_LOG_ACTIONS = new Set(['ĐĂNG NHẬP', 'ĐĂNG XUẤT', 'TRUY CẬP']);

export async function writeLog(hanhDong: string, chiTiet: string): Promise<void> {
  try {
    if (!currentUser) return; // Nếu chưa đăng nhập thì không ghi log

    const actionUpper = (hanhDong || '').trim().toUpperCase();
    const isAllowed = ALLOWED_LOG_ACTIONS.has(actionUpper) || actionUpper.startsWith('TRUY CẬP');
    if (!isAllowed) {
      // Bỏ qua các log chi tiết nghiệp vụ (Thêm/Sửa/Xóa/Snapshot) để tiết kiệm băng thông và dung lượng DB
      return;
    }
    
    const logData: any = {
      id: `LOG${Date.now()}${Math.floor(Math.random() * 1000)}`,
      thoi_gian: new Date().toISOString(), 
      id_user: currentUser?.id || null, 
      ho_ten: currentUser?.ho_ten || null,
      hanh_dong: hanhDong,
      chi_tiet: chiTiet
    };

    // Xử lý an toàn Khóa ngoại
    if (currentUser?.id_don_vi && currentUser.id_don_vi !== 'ALL' && currentUser.id_don_vi !== 'UNKNOWN') {
      logData.id_don_vi = currentUser.id_don_vi;
    } else {
      logData.id_don_vi = null; 
    }

    if (API_MODE === 'MOCK') {
      saveLocalRecord(logData, 'create', 'sys_logs');
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/sys_logs`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(logData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lỗi Supabase khi ghi Log:", errorText);
      // Fallback
      saveLocalRecord(logData, 'create', 'sys_logs');
    }
  } catch (error) {
    console.error("Lỗi hệ thống khi ghi Log:", error);
    // Fallback
    try {
      const logData: any = {
        id: `LOG${Date.now()}${Math.floor(Math.random() * 1000)}`,
        thoi_gian: new Date().toISOString(), 
        id_user: currentUser?.id || null, 
        ho_ten: currentUser?.ho_ten || null,
        hanh_dong: hanhDong,
        chi_tiet: chiTiet,
        id_don_vi: currentUser?.id_don_vi && currentUser.id_don_vi !== 'ALL' ? currentUser.id_don_vi : null
      };
      saveLocalRecord(logData, 'create', 'sys_logs');
    } catch (e) {}
  }
}

export async function cleanOldLogs(_days = 5): Promise<void> {
  // Người dùng chủ động quản trị và xóa log trực tiếp trên Supabase.
  // Ứng dụng không tự động xóa để bảo toàn dữ liệu lịch sử.
  return;
}
