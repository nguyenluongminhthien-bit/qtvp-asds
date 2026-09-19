import { DonVi, VehicleLocationData } from '../types';
import { getAllSubordinateIds } from './hierarchy';

/**
 * Phân tích chuỗi hoặc đối tượng địa điểm sử dụng thành cấu trúc chuẩn VehicleLocationData.
 * Hỗ trợ tương thích ngược với dữ liệu cũ dạng chuỗi văn bản tự do.
 */
export const parseVehicleLocation = (raw: any): VehicleLocationData => {
  if (!raw) return {};

  if (typeof raw === 'object') {
    return raw as VehicleLocationData;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as VehicleLocationData;
        }
      } catch (e) {
        // Không phải JSON hợp lệ, fallback về chuỗi thường
      }
    }
    return { dia_chi_day_du: trimmed };
  }

  return {};
};

/**
 * Đóng gói đối tượng địa điểm 3 cấp thành chuỗi JSON để lưu vào Supabase ts_xe.dia_diem_su_dung.
 */
export const stringifyVehicleLocation = (data: VehicleLocationData | null): string | null => {
  if (!data) return null;
  if (!data.cap1_id && !data.cap2_id && !data.cap3_id && !data.dia_chi_day_du) {
    return null;
  }
  return JSON.stringify(data);
};

/**
 * Format thông tin địa điểm để hiển thị trên bảng dữ liệu hoặc thẻ Mobile.
 * Trả về:
 * - main: Tên đơn vị cụ thể nhất (Cấp 3 > Cấp 2 > Cấp 1)
 * - sub: Nhánh đơn vị cấp trên (nếu có)
 * - full: Toàn bộ lộ trình phân cấp dùng cho tooltip
 */
export const formatVehicleLocationDisplay = (
  raw: any,
  donViMap?: Record<string, string>
): { main: string; sub: string; full: string } => {
  const loc = parseVehicleLocation(raw);

  // Nếu là dữ liệu cũ (chuỗi văn bản tự do)
  if (!loc.cap1_id && !loc.cap2_id && !loc.cap3_id) {
    const text = loc.dia_chi_day_du || '';
    return {
      main: text || '---',
      sub: '',
      full: text
    };
  }

  const cap1Name = loc.cap1_ten || (loc.cap1_id && donViMap ? donViMap[loc.cap1_id] : '') || '';
  const cap2Name = loc.cap2_ten || (loc.cap2_id && donViMap ? donViMap[loc.cap2_id] : '') || '';
  const cap3Name = loc.cap3_ten || (loc.cap3_id && donViMap ? donViMap[loc.cap3_id] : '') || '';

  if (cap3Name) {
    const parentPath = [cap1Name, cap2Name].filter(Boolean).join(' > ');
    const fullPath = [cap1Name, cap2Name, cap3Name].filter(Boolean).join(' > ');
    return {
      main: cap3Name,
      sub: parentPath,
      full: fullPath
    };
  }

  if (cap2Name) {
    const fullPath = [cap1Name, cap2Name].filter(Boolean).join(' > ');
    return {
      main: cap2Name,
      sub: cap1Name,
      full: fullPath
    };
  }

  if (cap1Name) {
    return {
      main: cap1Name,
      sub: '',
      full: cap1Name
    };
  }

  return {
    main: loc.dia_chi_day_du || '---',
    sub: '',
    full: loc.dia_chi_day_du || ''
  };
};

/**
 * Kiểm tra xe có khớp với bộ lọc Địa điểm sử dụng 3 cấp hay không.
 * Có tính chất KẾ THỪA PHÂN CẤP:
 * - Chọn Cấp 1 -> Thấy toàn bộ xe tại Cấp 1, các đơn vị con (Cấp 2) và cháu (Cấp 3).
 * - Chọn Cấp 2 -> Thấy toàn bộ xe tại Cấp 2 và các đơn vị con/cháu trực thuộc Cấp 2.
 * - Chọn Cấp 3 -> Thấy chính xác xe tại Cấp 3.
 */
export const isVehicleInLocation = (
  carLocationRaw: any,
  filterCap1Id?: string,
  filterCap2Id?: string,
  filterCap3Id?: string,
  donViList: DonVi[] = []
): boolean => {
  const f1 = (filterCap1Id || '').trim();
  const f2 = (filterCap2Id || '').trim();
  const f3 = (filterCap3Id || '').trim();

  // Không có bộ lọc nào được áp dụng
  if (!f1 && !f2 && !f3) return true;

  const loc = parseVehicleLocation(carLocationRaw);
  if (!loc.cap1_id && !loc.cap2_id && !loc.cap3_id && !loc.dia_chi_day_du) {
    return false;
  }

  const c1 = String(loc.cap1_id || '').trim();
  const c2 = String(loc.cap2_id || '').trim();
  const c3 = String(loc.cap3_id || '').trim();

  // 1. Nếu người dùng chọn đích danh Cấp 3
  if (f3) {
    return c3 === f3;
  }

  // 2. Nếu người dùng chọn Cấp 2 (và không chọn Cấp 3)
  if (f2) {
    if (c2 === f2) return true;
    const subIds = new Set(getAllSubordinateIds(f2, donViList));
    if (c3 && subIds.has(c3)) return true;
    return false;
  }

  // 3. Nếu người dùng chỉ chọn Cấp 1
  if (f1) {
    if (c1 === f1) return true;
    const allSubIds = new Set(getAllSubordinateIds(f1, donViList));
    if (c2 && allSubIds.has(c2)) return true;
    if (c3 && allSubIds.has(c3)) return true;
    return false;
  }

  return true;
};
