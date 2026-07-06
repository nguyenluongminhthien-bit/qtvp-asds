import { Personnel, DonVi, User, SysLog } from '../../types';
import { fetchWithCache, resolveTable, apiCache, CACHE_DEPENDENCIES } from './cache';
import { SUPABASE_URL, HEADERS, API_MODE } from './client';
import { writeLog } from './logs';
import { getLocalRecords, saveLocalRecord, deleteLocalRecord } from './localStore';

// Helper wrapper cho tất cả GET requests có chế độ fallback
async function getWithFallback<T>(tableName: string): Promise<T[]> {
  if (API_MODE === 'MOCK') {
    return getLocalRecords(tableName) as T[];
  }
  try {
    return await fetchWithCache(tableName) as T[];
  } catch (err) {
    console.warn(`⚠️ Không thể tải dữ liệu bảng ${tableName} từ Supabase. Tự động dùng dữ liệu offline Local!`);
    return getLocalRecords(tableName) as T[];
  }
}

export const getPersonnel = () => getWithFallback<Personnel>('ns_dich_vu');
export const getDonVi = () => getWithFallback<DonVi>('dm_don_vi');
export const getAnNinh = () => getWithFallback<any>('hs_an_ninh');
export const getXe = () => getWithFallback<any>('ts_xe');
export const getChiPhiXe = () => getWithFallback<any>('cp_hoat_dong_xe');
export const getPhapNhan = () => getWithFallback<any>('dm_phap_nhan');
export const getPhongHop = () => getWithFallback<any>('dm_phong_hop');
export const getQuyDinh = () => getWithFallback<any>('qd_qt');
export const getThietBi = () => getWithFallback<any>('ts_thiet_bi');
export const getNhatKyThietBi = () => getWithFallback<any>('nk_thiet_bi');
export const getVanBan = () => getWithFallback<any>('vb_tb');
export const getPVHC = () => getWithFallback<any>('hs_pvhc');
export const getATVSLD = () => getWithFallback<any>('hs_an_toan_lao_dong');
export const getPCTT = () => getWithFallback<any>('hs_pctt');
export const getPCCC = () => getWithFallback<any>('hs_pccc');
export const getTsPCCC = () => getWithFallback<any>('ts_pccc');
export const getUsers = () => getWithFallback<User>('config_users');
export const getLogs = () => getWithFallback<SysLog>('sys_logs');

export async function save(data: any, action: 'create' | 'update', tableName: string): Promise<any> {
  if (API_MODE === 'MOCK') {
    return saveLocalRecord(data, action, tableName);
  }

  try {
    const realTableName = resolveTable(tableName);

    // Xử lý lưu nhiều dòng (Mảng)
    if (Array.isArray(data)) {
      const cleanArray = data.map(item => {
        const cleaned = { ...item };
        Object.keys(cleaned).forEach(k => { if (cleaned[k] === '') cleaned[k] = null; });
        return cleaned;
      });

      const response = await fetch(`${SUPABASE_URL}/rest/v1/${realTableName}`, {
        method: 'POST', 
        headers: HEADERS,
        body: JSON.stringify(cleanArray)
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lỗi Supabase: ${errText}`);
      }
      delete apiCache[realTableName];
      CACHE_DEPENDENCIES[realTableName]?.forEach(dep => delete apiCache[dep]);
      void writeLog('CẬP NHẬT MẢNG', `Bảng: ${realTableName} | Lưu ${data.length} bản ghi`);
      return response.json();
    }

    // Làm sạch dữ liệu Object (biến "" thành null)
    const cleanedData = { ...data };
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === '') cleanedData[key] = null;
    });

    if (action === 'create' && !cleanedData.id) {
      const prefix = realTableName.substring(0, 2).toUpperCase();
      cleanedData.id = `${prefix}${Date.now()}${Math.floor(Math.random() * 100)}`;
    }

    let url = `${SUPABASE_URL}/rest/v1/${realTableName}`;
    let method = 'POST'; 

    if (action === 'update') {
      const recordId = cleanedData.id || cleanedData.ID || cleanedData.ID_Xe || cleanedData.ID_User; 
      url = `${url}?id=eq.${recordId}`; 
      method = 'PATCH'; 
      delete cleanedData.id;
    }

    const response = await fetch(url, {
      method: method, 
      headers: HEADERS,
      body: JSON.stringify(cleanedData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = errorText;
      try {
        const errJson = JSON.parse(errorText);
        errorMsg = errJson.message || errJson.details || errorText;
      } catch (e) {}
      
      console.error(`🔴 LỖI TỪ SUPABASE (Bảng ${realTableName}):`, errorMsg);
      throw new Error(errorMsg); 
    }
    
    delete apiCache[realTableName];
    CACHE_DEPENDENCIES[realTableName]?.forEach(dep => delete apiCache[dep]);
    const tenHanhDong = action === 'create' ? 'THÊM MỚI' : 'CẬP NHẬT';
    void writeLog(tenHanhDong, `Bảng: ${realTableName}`);

    const resultData = await response.json();
    return Array.isArray(resultData) ? resultData[0] : resultData;
  } catch (err: any) {
    console.warn(`⚠️ Giao tiếp Supabase thất bại. Tự động lưu vào dữ liệu local bảng ${tableName}:`, err.message);
    return saveLocalRecord(data, action, tableName);
  }
}

export async function deleteRecord(id: string, tableName: string): Promise<boolean> {
  if (API_MODE === 'MOCK') {
    return deleteLocalRecord(id, tableName);
  }

  try {
    const realTableName = resolveTable(tableName);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${realTableName}?id=eq.${id}`, {
      method: 'DELETE', 
      headers: HEADERS
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi xóa ${realTableName}: ${errorText}`);
    }
    
    delete apiCache[realTableName];
    CACHE_DEPENDENCIES[realTableName]?.forEach(dep => delete apiCache[dep]);
    void writeLog('XÓA', `Bảng: ${realTableName} | ID Đối tượng: ${id}`);
    return true;
  } catch (err: any) {
    console.warn(`⚠️ Giao tiếp Supabase thất bại. Tự động xóa trong dữ liệu local bảng ${tableName}:`, err.message);
    return deleteLocalRecord(id, tableName);
  }
}
