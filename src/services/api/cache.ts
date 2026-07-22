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
  'HS_PCTT': 'hs_pctt'
};

export const resolveTable = (name: string) => TABLE_MAP[name] || name.toLowerCase();

// Thời gian sống của bộ đệm (TTL - 5 phút)
export const CACHE_DURATION = 5 * 60 * 1000;

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

// Helper lưu bộ đệm Layer 2 vào LocalStorage
function setPersistentCache(tableName: string, data: any): void {
  try {
    localStorage.setItem(`SMART_CACHE_${tableName}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Quá dung lượng localStorage thì chỉ dùng in-memory
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

// Smart Two-Layer Fetch
export async function fetchWithCache(tableName: string, forceRefresh = false) {
  const resolved = resolveTable(tableName);

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

  // 3. Gọi Supabase REST API
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=*`, {
      method: 'GET',
      headers: HEADERS
    });

    if (!response.ok) throw new Error(`Lỗi tải dữ liệu bảng ${resolved}`);
    const finalData = await response.json();

    // Cập nhật cả 2 tầng cache
    apiCache[resolved] = { data: finalData, timestamp: Date.now() };
    setPersistentCache(resolved, finalData);

    return finalData;
  } catch (error) {
    // 4. Nếu mất mạng hoặc Supabase lỗi -> Thử trả về dữ liệu cũ (Stale Cache) nếu có
    if (apiCache[resolved]?.data) {
      console.warn(`⚠️ Dùng cache tạm thời cho bảng ${resolved} do lỗi kết nối.`);
      return apiCache[resolved].data;
    }
    throw error;
  }
}
