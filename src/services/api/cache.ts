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
  'HS_PCTT': 'hs_pctt',
  'NhaCungCap': 'dm_ncc',
  'HS_KhamSucKhoe': 'hs_kham_suc_khoe',
  'NK_KhamSucKhoeCaNhan': 'nk_kham_suc_khoe_canhan',
  'DM_KMP': 'dm_kmp',
  'DM_BoPhan': 'dm_bo_phan',
  'DM_BoPhanCap1': 'dm_bo_phan_cap1',
  'DM_BoPhanCap2': 'dm_bo_phan_cap2',
  'DNTT': 'dntt',
  'DNTT_ChiTiet': 'dntt_chi_tiet',
  'DNTT_PhanBo': 'dntt_phan_bo'
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
  'dntt':                          ['dntt_chi_tiet', 'dntt_phan_bo'],
  'dntt_chi_tiet':                 ['dntt', 'dntt_phan_bo'],
  'dntt_phan_bo':                  ['dntt', 'dntt_chi_tiet'],
  'dm_bo_phan_cap1':               ['dm_bo_phan_cap2', 'dntt_phan_bo'],
  'dm_bo_phan_cap2':               ['dm_bo_phan_cap1', 'dntt_phan_bo'],
  'dm_kmp':                        ['dntt_phan_bo'],
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

// Helper lưu bộ đệm Layer 2 vào LocalStorage với xử lý tràn bộ nhớ an toàn
function setPersistentCache(tableName: string, data: any): void {
  try {
    localStorage.setItem(`SMART_CACHE_${tableName}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e: any) {
    // Nếu quá dung lượng 5MB của localStorage, dọn bớt các cache đã hết hạn hoặc các cache khác
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('SMART_CACHE_') && key !== `SMART_CACHE_${tableName}`) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      // Thử lưu lại
      localStorage.setItem(`SMART_CACHE_${tableName}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (fallbackError) {
      // Nếu vẫn quá dung lượng thì chỉ dùng in-memory cache
      console.warn(`⚠️ LocalStorage đầy. Bảng ${tableName} sẽ chỉ được lưu trên In-Memory Cache.`);
    }
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

// Smart Two-Layer Fetch với thuật toán Tải song song phân trang (Parallel Batch Fetching)
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

  // 3. Gọi Supabase REST API với Tải song song phân trang (Parallel Batch Fetching)
  try {
    const batchSize = 1000;

    // Lần tải đầu tiên (0 - 999) + Đọc header Content-Range để lấy tổng số dòng
    const firstRes = await fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=*`, {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Prefer': 'count=exact',
        'Range': `0-${batchSize - 1}`
      }
    });

    if (!firstRes.ok) throw new Error(`Lỗi tải dữ liệu bảng ${resolved}`);
    const firstBatch: any[] = await firstRes.json();
    let allData: any[] = [...firstBatch];

    // Đọc tổng số bản ghi từ header Content-Range (ví dụ: "0-999/3450" -> 3450)
    const contentRange = firstRes.headers.get('content-range');
    let totalCount = 0;
    if (contentRange && contentRange.includes('/')) {
      const parts = contentRange.split('/');
      totalCount = parseInt(parts[1], 10) || 0;
    }

    // Nếu tổng số dòng > 1000, bắn ĐỒNG THỜI (Parallel) toàn bộ các trang còn lại
    if (totalCount > batchSize) {
      const remainingPromises: Promise<any[]>[] = [];
      for (let from = batchSize; from < totalCount; from += batchSize) {
        const to = Math.min(from + batchSize - 1, totalCount - 1);
        remainingPromises.push(
          fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=*`, {
            method: 'GET',
            headers: {
              ...HEADERS,
              'Range': `${from}-${to}`
            }
          }).then(res => {
            if (!res.ok) return [];
            return res.json();
          }).catch(() => [])
        );
      }

      const remainingResults = await Promise.all(remainingPromises);
      remainingResults.forEach(batch => {
        if (Array.isArray(batch)) {
          allData = allData.concat(batch);
        }
      });
    } else if (firstBatch.length === batchSize && totalCount === 0) {
      // Dự phòng nếu máy chủ không trả Content-Range header
      let from = batchSize;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${resolved}?select=*`, {
          method: 'GET',
          headers: {
            ...HEADERS,
            'Range': `${from}-${from + batchSize - 1}`
          }
        });
        if (!res.ok) break;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          allData = allData.concat(data);
          if (data.length < batchSize) hasMore = false;
          else from += batchSize;
        } else {
          hasMore = false;
        }
      }
    }

    // Cập nhật cả 2 tầng cache
    apiCache[resolved] = { data: allData, timestamp: Date.now() };
    setPersistentCache(resolved, allData);

    return allData;
  } catch (error) {
    // 4. Nếu mất mạng hoặc Supabase lỗi -> Thử trả về dữ liệu cũ nếu có
    if (apiCache[resolved]?.data) {
      console.warn(`⚠️ Dùng cache tạm thời cho bảng ${resolved} do lỗi kết nối.`);
      return apiCache[resolved].data;
    }
    throw error;
  }
}
