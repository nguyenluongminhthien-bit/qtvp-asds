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

export const apiCache: Record<string, { data: any; timestamp: number }> = {};
export const CACHE_DURATION = 5 * 60 * 1000;

// Khi bảng A thay đổi -> tự động xóa cache các bảng liên quan
export const CACHE_DEPENDENCIES: Record<string, string[]> = {
  'ns_dich_vu':      ['dm_don_vi'],        // Thêm/sửa nhân sự -> làm mới đơn vị
  'dm_don_vi':       ['ns_dich_vu'],        // Sửa đơn vị -> làm mới nhân sự
  'ts_xe':           ['cp_hoat_dong_xe'],   // Sửa xe -> làm mới chi phí xe
  'cp_hoat_dong_xe': ['ts_xe'],             // Sửa chi phí -> làm mới xe
  'ts_thiet_bi':     ['nk_thiet_bi'],       // Sửa thiết bị -> làm mới nhật ký
  'nk_thiet_bi':     ['ts_thiet_bi'],       // Sửa nhật ký -> làm mới thiết bị
  'hs_pccc':         ['ts_pccc'],            // Sửa hồ sơ PCCC -> làm mới tài sản PCCC
  'ts_pccc':         ['hs_pccc'],            // Sửa tài sản PCCC -> làm mới hồ sơ
};

export async function fetchWithCache(tableName: string, forceRefresh = false) {
  if (!forceRefresh && apiCache[tableName] && (Date.now() - apiCache[tableName].timestamp < CACHE_DURATION)) {
    return apiCache[tableName].data;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*`, {
    method: 'GET',
    headers: HEADERS
  });

  if (!response.ok) throw new Error(`Lỗi tải dữ liệu bảng ${tableName}`);
  const finalData = await response.json();
  apiCache[tableName] = { data: finalData, timestamp: Date.now() };
  return finalData;
}
