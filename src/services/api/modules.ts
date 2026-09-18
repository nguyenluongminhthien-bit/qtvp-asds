import { Personnel, DonVi, User, SysLog, ThueBao, CuocThang, NhaCungCap, DmKmp, DmNhomChiPhi, DmBoPhan, BoPhanCap1, BoPhanCap2, DNTT, DnttChiTiet, DnttPhanBo, ChiPhiChotKy, ChiPhiThongKe } from '../../types';
import { fetchWithCache, resolveTable, invalidateCache } from './cache';
import { SUPABASE_URL, HEADERS, API_MODE } from './client';
import { writeLog } from './logs';
import { getLocalRecords, saveLocalRecord, deleteLocalRecord } from './localStore';
import { currentUser } from './auth';
import { getAllSubordinateIds, getUserPermittedUnitIds, isUserAdminOrAllAccess } from '../../utils/hierarchy';

// Helper wrapper cho tất cả GET requests có chế độ fallback
async function getWithFallback<T>(tableName: string, forceRefresh = false): Promise<T[]> {
  if (API_MODE === 'MOCK') {
    return getLocalRecords(tableName) as T[];
  }
  try {
    return await fetchWithCache(tableName, forceRefresh) as T[];
  } catch (err) {
    console.warn(`⚠️ Không thể tải dữ liệu bảng ${tableName} từ Supabase. Tự động dùng dữ liệu offline Local!`);
    return getLocalRecords(tableName) as T[];
  }
}

export const getPersonnel = (forceRefresh = false) => getWithFallback<Personnel>('ns_dich_vu', forceRefresh);
export const getDonVi = (forceRefresh = false) => getWithFallback<DonVi>('dm_don_vi', forceRefresh);
export const getNhaCungCap = (forceRefresh = false) => getWithFallback<NhaCungCap>('dm_ncc', forceRefresh);
export const getAnNinh = () => getWithFallback<any>('hs_an_ninh');
export const getXe = () => getWithFallback<any>('ts_xe');
export const getChiPhiXe = () => getWithFallback<any>('cp_hoat_dong_xe');
export const getPhapNhan = (forceRefresh = false) => getWithFallback<any>('dm_phap_nhan', forceRefresh);
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
export const getThueBao = () => getWithFallback<ThueBao>('dm_thue_bao');
export const getCuocThang = () => getWithFallback<CuocThang>('cp_cuoc_thang');
export const getKhoaHuanLuyen = () => getWithFallback<any>('hs_khoa_huan_luyen');
export const getHocVienKhoaHuanLuyen = () => getWithFallback<any>('hs_hoc_vien_khoa_huan_luyen');
export const getChuKyATVSLD = (forceRefresh = false) => getWithFallback<any>('dm_chu_ky_atvsld', forceRefresh);
export const getThietBiNghiemNgat = () => getWithFallback<any>('ts_thiet_bi_nghiem_ngat');
export const getKiemDinhTBNN = () => getWithFallback<any>('nk_kiem_dinh_tbnn');
export const getNhatKySuDungXe = () => getWithFallback<any>('nk_su_dung_xe');
export const getDmNhomChiPhi = (forceRefresh = false) => getWithFallback<DmNhomChiPhi>('dm_nhom_chi_phi', forceRefresh);
export const getDmKmp = (forceRefresh = false) => getWithFallback<DmKmp>('dm_kmp', forceRefresh);
export const getDmBoPhan = (forceRefresh = false) => getWithFallback<DmBoPhan>('dm_bo_phan', forceRefresh);
export const getDmBoPhanCap1 = async (forceRefresh = false): Promise<BoPhanCap1[]> => {
  const bpList = await getDmBoPhan(forceRefresh);
  const seen = new Set<string>();
  const list: BoPhanCap1[] = [];
  (bpList || []).forEach(b => {
    if (b.ma_cap1 && !seen.has(b.ma_cap1)) {
      seen.add(b.ma_cap1);
      list.push({
        id: b.ma_cap1,
        ma: b.ma_cap1,
        ten: b.ten_cap1,
        yeu_cau_cap2: b.yeu_cau_cap2,
        thu_tu: b.thu_tu || 0,
        active: b.active !== false
      });
    }
  });
  return list;
};

export const getDmBoPhanCap2 = async (forceRefresh = false): Promise<BoPhanCap2[]> => {
  const bpList = await getDmBoPhan(forceRefresh);
  const seen = new Set<string>();
  const list: BoPhanCap2[] = [];
  (bpList || []).forEach(b => {
    if (b.ma_cap2 && !seen.has(b.ma_cap2)) {
      seen.add(b.ma_cap2);
      list.push({
        id: b.ma_cap2,
        ma: b.ma_cap2,
        ten: b.ten_cap2,
        thu_tu: b.thu_tu || 0,
        active: b.active !== false
      });
    }
  });
  return list;
};
export const getDntt = (forceRefresh = false) => getWithFallback<DNTT>('dntt', forceRefresh);
export const getDnttChiTiet = (forceRefresh = false) => getWithFallback<DnttChiTiet>('dntt_chi_tiet', forceRefresh);
export const getDnttPhanBo = (forceRefresh = false) => getWithFallback<DnttPhanBo>('dntt_phan_bo', forceRefresh);
export const getChiPhiChotKy = (forceRefresh = false) => getWithFallback<ChiPhiChotKy>('chi_phi_chot_ky', forceRefresh);
export const getChiPhiThongKe = (forceRefresh = false) => getWithFallback<ChiPhiThongKe>('chi_phi_thong_ke', forceRefresh);

// Helper làm sạch payload trước khi gửi lên Supabase (loại bỏ trường UI-only, rỗng "" -> null)
function sanitizePayload(item: Record<string, any>, isUpdate: boolean = false, tableName?: string): Record<string, any> {
  const cleaned: Record<string, any> = {};
  const uiOnlyKeys = new Set(['STT', 'isEditing', 'isSelected', 'action', '__rowNum__', 'showroom_ref']);
  if (tableName !== 'dntt_chi_tiet') {
    uiOnlyKeys.add('stt');
  }

  Object.keys(item || {}).forEach(key => {
    // Loại bỏ các trường nội bộ bắt đầu bằng _ hoặc trường UI-only
    if (key.startsWith('_') || uiOnlyKeys.has(key)) return;

    let value = item[key];
    if (value === '') value = null;
    cleaned[key] = value;
  });

  if (isUpdate) {
    delete cleaned.id;
    delete cleaned.ID;
  }

  return cleaned;
}

// Helper trích xuất tóm tắt ngắn gọn các trường định danh của bản ghi
function extractRecordSummary(data: any, tableName: string): string {
  if (!data) return '';
  const parts: string[] = [];

  const recordId = data.id || data.ID || data.ID_Xe || data.ID_User;
  if (recordId) {
    parts.push(`ID: ${recordId}`);
  }

  const table = tableName.toLowerCase();

  if (table.includes('ns_dich_vu')) {
    if (data.ho_ten) parts.push(`Họ tên: ${data.ho_ten}`);
    if (data.ma_so_nhan_vien) parts.push(`MSNV: ${data.ma_so_nhan_vien}`);
  } else if (table.includes('ts_xe')) {
    if (data.bien_so) parts.push(`Biển số: ${data.bien_so}`);
    if (data.hieu_xe || data.loai_xe) parts.push(`Xe: ${[data.hieu_xe, data.loai_xe].filter(Boolean).join(' ')}`);
  } else if (table.includes('ts_thiet_bi')) {
    if (data.ten_thiet_bi) parts.push(`Tên TB: ${data.ten_thiet_bi}`);
    if (data.ma_kiem_soat) parts.push(`Mã KS: ${data.ma_kiem_soat}`);
  } else if (table.includes('vb_tb')) {
    if (data.so_hieu) parts.push(`Số hiệu: ${data.so_hieu}`);
    if (data.tieu_de) parts.push(`Tiêu đề: ${data.tieu_de}`);
  } else if (table.includes('hs_khoa_huan_luyen')) {
    if (data.ten_khoa_hoc) parts.push(`Khóa học: ${data.ten_khoa_hoc}`);
  } else if (table.includes('hs_hoc_vien_khoa_huan_luyen')) {
    if (data.ho_ten_nv) parts.push(`Học viên: ${data.ho_ten_nv}`);
    if (data.msnv) parts.push(`MSNV: ${data.msnv}`);
  } else if (table.includes('config_users')) {
    if (data.user_name) parts.push(`Username: ${data.user_name}`);
    if (data.ho_ten) parts.push(`Họ tên: ${data.ho_ten}`);
  } else if (table.includes('hs_an_ninh')) {
    if (data.nguoi_lien_he) parts.push(`Liên hệ: ${data.nguoi_lien_he}`);
  } else if (table.includes('dm_don_vi')) {
    if (data.ten_don_vi) parts.push(`Tên ĐV: ${data.ten_don_vi}`);
  } else if (table.includes('dm_phap_nhan')) {
    if (data.ten_phap_nhan) parts.push(`Pháp nhân: ${data.ten_phap_nhan}`);
  }

  if (parts.length <= 1) {
    const commonName = data.ten || data.name || data.tieu_de || data.title || data.noi_dung;
    if (commonName) {
      parts.push(`Tên/Nội dung: ${String(commonName).substring(0, 50)}`);
    }
  }

  return parts.join(' | ');
}

// Helper kiểm tra phạm vi ghi (chặn thật việc ghi dữ liệu ngoài phạm vi đơn vị)
async function checkUnitPermission(item: any, tableName: string) {
  if (!currentUser || isUserAdminOrAllAccess(currentUser)) return;

  const targetIdDonVi = item?.id_don_vi;
  if (targetIdDonVi === undefined || targetIdDonVi === null || String(targetIdDonVi).trim() === '') return;

  const strTargetId = String(targetIdDonVi).trim();
  const allUnits = await getDonVi();
  const permittedSet = getUserPermittedUnitIds(currentUser, allUnits);

  // Nếu là tài khoản toàn quyền thì cho phép
  if (!permittedSet) return;

  // Hỗ trợ trường hợp id_don_vi chứa nhiều mã đơn vị phân tách bằng dấu phẩy
  const targetIds = strTargetId.split(',').map(s => s.trim()).filter(Boolean);
  const unauthorizedIds = targetIds.filter(id => !permittedSet.has(id));

  if (unauthorizedIds.length > 0) {
    throw new Error(`Bạn không có quyền ghi dữ liệu cho đơn vị này (Mã ĐV: ${unauthorizedIds.join(', ')}). Vui lòng liên hệ Quản trị viên nếu đây là nhầm lẫn.`);
  }
}

export async function save(data: any, action: 'create' | 'update', tableName: string): Promise<any> {
  // Thực hiện kiểm tra phạm vi ghi (Chặn thật ở Bước B)
  if (Array.isArray(data)) {
    for (const item of data) {
      await checkUnitPermission(item, tableName);
    }
  } else {
    await checkUnitPermission(data, tableName);
  }

  if (API_MODE === 'MOCK') {
    return saveLocalRecord(data, action, tableName);
  }

  try {
    const realTableName = resolveTable(tableName);

    // Xử lý lưu nhiều dòng (Mảng)
    if (Array.isArray(data)) {
      const cleanArray = data.map(item => {
        const cleaned = sanitizePayload(item, false, realTableName);
        if (realTableName === 'ns_dich_vu') {
          delete cleaned.phan_loai;
        }
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
      invalidateCache(realTableName);
      let arraySummary = '';
      if (Array.isArray(data) && data.length > 0) {
        const samples = data.slice(0, 3).map(item => {
          const detail = extractRecordSummary(item, realTableName);
          return `{${detail}}`;
        }).join(', ');
        arraySummary = ` | Chi tiết mẫu: [${samples}${data.length > 3 ? '...' : ''}]`;
      }
      void writeLog('CẬP NHẬT MẢNG', `Bảng: ${realTableName} | Lưu ${data.length} bản ghi${arraySummary}`);
      return response.json();
    }

    // Làm sạch dữ liệu Object (biến "" thành null, loại bỏ trường UI-only)
    const cleanedData = sanitizePayload(data, action === 'update', realTableName);
    if (realTableName === 'ns_dich_vu') {
      delete cleanedData.phan_loai;
    }

    if (action === 'create' && !cleanedData.id) {
      const prefix = realTableName.substring(0, 2).toUpperCase();
      cleanedData.id = `${prefix}${Date.now()}${Math.floor(Math.random() * 100)}`;
    }

    let url = `${SUPABASE_URL}/rest/v1/${realTableName}`;
    let method = 'POST';

    if (action === 'update') {
      const recordId = data.id || data.ID || data.ID_Xe || data.ID_User;
      url = `${url}?id=eq.${recordId}`;
      method = 'PATCH';
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
      } catch (e) { }

      console.error(`🔴 LỖI TỪ SUPABASE (Bảng ${realTableName}):`, errorMsg);
      throw new Error(errorMsg);
    }

    invalidateCache(realTableName);
    const tenHanhDong = action === 'create' ? 'THÊM MỚI' : 'CẬP NHẬT';
    const detailSummary = extractRecordSummary(data, realTableName);
    void writeLog(tenHanhDong, `Bảng: ${realTableName} | ${detailSummary}`);

    const resultData = await response.json();
    return Array.isArray(resultData) ? resultData[0] : resultData;
  } catch (err: any) {
    console.error(`🔴 Giao tiếp Supabase thất bại cho bảng ${tableName}:`, err.message);
    throw err;
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

    invalidateCache(realTableName);
    void writeLog('XÓA', `Bảng: ${realTableName} | ID Đối tượng: ${id}`);
    return true;
  } catch (err: any) {
    console.error(`🔴 Giao tiếp Supabase thất bại cho bảng ${tableName}:`, err.message);
    throw err;
  }
}

// 🟢 HELPER KHÁM SỨC KHỎE ĐỊNH KỲ & BỆNH NGHỀ NGHIỆP
export async function getKhamSucKhoeCampaigns(): Promise<any[]> {
  return getWithFallback('hs_kham_suc_khoe');
}

export async function saveKhamSucKhoeCampaign(data: any, action: 'create' | 'update'): Promise<any> {
  return save(data, action, 'hs_kham_suc_khoe');
}

export async function deleteKhamSucKhoeCampaign(id: string): Promise<boolean> {
  return deleteRecord(id, 'hs_kham_suc_khoe');
}

export async function getKhamSucKhoeCaNhan(): Promise<any[]> {
  return getWithFallback('nk_kham_suc_khoe_canhan');
}

export async function saveKhamSucKhoeCaNhanBatch(records: any[]): Promise<any[]> {
  const results = [];
  for (const record of records) {
    const res = await save(record, record.id ? 'update' : 'create', 'nk_kham_suc_khoe_canhan');
    results.push(res);
  }
  return results;
}

export async function deleteKhamSucKhoeCaNhan(id: string): Promise<boolean> {
  return deleteRecord(id, 'nk_kham_suc_khoe_canhan');
}

// 🟢 PHÂN HỆ QUẢN LÝ CHI PHÍ: CHỐT KỲ & THỐNG KÊ & BULK STATUS UPDATE
export async function checkDnttBelongsToLockedPeriod(dnttId: string): Promise<boolean> {
  try {
    const [allPhanBo, chotKyList] = await Promise.all([
      getDnttPhanBo(),
      getChiPhiChotKy()
    ]);
    const activeClosed = new Set(
      chotKyList.filter(ck => ck.trang_thai === 'da_chot').map(ck => `${ck.nam}_${ck.thang}`)
    );
    if (activeClosed.size === 0) return false;

    // 1. Ưu tiên kiểm tra các dòng phân bổ của DNTT này
    const relatedPb = allPhanBo.filter(pb => pb.dntt_id === dnttId);
    if (relatedPb.length > 0) {
      return relatedPb.some(pb => activeClosed.has(`${pb.nam}_${pb.thang}`));
    }

    // 2. Fallback qua ngày lập nếu chưa có dòng phân bổ nào
    const dnttList = await getDntt();
    const dntt = dnttList.find(d => d.id === dnttId);
    if (!dntt || !dntt.ngay_lap) return false;
    const date = new Date(dntt.ngay_lap);
    if (isNaN(date.getTime())) return false;
    return activeClosed.has(`${date.getFullYear()}_${date.getMonth() + 1}`);
  } catch (e) {
    return false;
  }
}

export async function chotKyChiPhi(
  thang: number,
  nam: number,
  nguoiChot: string,
  ghiChu?: string
): Promise<{ chotKy: ChiPhiChotKy; so_dong_snapshot: number }> {
  // 1. Kiểm tra xem kỳ này đã được chốt chưa
  const currentChotKyList = await getChiPhiChotKy(true);
  const existingActive = currentChotKyList.find(ck => ck.nam === nam && ck.thang === thang && ck.trang_thai === 'da_chot');
  if (existingActive) {
    throw new Error(`Kỳ Tháng ${thang}/${nam} đã được chốt số liệu trước đó!`);
  }

  // 2. Lấy dữ liệu DNTT, Phân bổ, Pháp nhân, KMP trong kỳ
  const [allDntt, allPhanBo, allPhapNhan, allKmp] = await Promise.all([
    getDntt(true),
    getDnttPhanBo(true),
    getPhapNhan(true),
    getDmKmp(true)
  ]);

  const dnttMap = new Map(allDntt.map(d => [d.id, d]));
  const phapNhanMap = new Map((allPhapNhan || []).map((p: any) => [p.id, p]));
  const kmpMap = new Map((allKmp || []).map(k => [k.id, k]));

  // Lấy TOÀN BỘ dòng phân bổ thuộc tháng/năm này (KHÔNG lọc theo trang_thai vì cả Đã lưu và Lưu cập nhật đều là dữ liệu thật)
  const targetAllocations = allPhanBo.filter(pb => {
    if (pb.nam !== nam || pb.thang !== thang) return false;
    const dntt = dnttMap.get(pb.dntt_id);
    return Boolean(dntt);
  });

  // 3. Gom nhóm theo: thang, nam, id_kmp, id_bo_phan, id_don_vi, id_phap_nhan, ma_so_thue
  const groupMap = new Map<string, {
    id_kmp?: string;
    id_bo_phan?: string;
    id_don_vi?: string;
    id_phap_nhan?: string;
    ma_so_thue?: string;
    thuoc_bao_cao_hanh_chinh?: boolean;
    tong_tien: number;
    so_dong_phan_bo: number;
  }>();

  targetAllocations.forEach(pb => {
    const dntt = dnttMap.get(pb.dntt_id);
    const idDonVi = dntt?.id_don_vi || undefined;
    const idPhapNhan = dntt?.id_phap_nhan || undefined;
    const pn = idPhapNhan ? phapNhanMap.get(idPhapNhan) : null;
    const maSoThue = pn?.ma_so_thue ? String(pn.ma_so_thue).trim() : undefined;
    const idKmp = pb.id_kmp || undefined;
    const kmp = idKmp ? kmpMap.get(idKmp) : null;
    // Đóng băng cờ phạm vi báo cáo hành chính tại đúng thời điểm chốt kỳ
    const thuocBcHc = kmp ? (kmp.thuoc_bao_cao_hanh_chinh !== false) : true;
    const idBoPhan = pb.id_bo_phan || pb.id_bo_phan_cap2 || pb.id_bo_phan_cap1 || undefined;

    const groupKey = `${idKmp || ''}|${idBoPhan || ''}|${idDonVi || ''}|${idPhapNhan || ''}|${maSoThue || ''}`;
    let item = groupMap.get(groupKey);
    if (!item) {
      item = {
        id_kmp: idKmp,
        id_bo_phan: idBoPhan,
        id_don_vi: idDonVi,
        id_phap_nhan: idPhapNhan,
        ma_so_thue: maSoThue,
        thuoc_bao_cao_hanh_chinh: thuocBcHc,
        tong_tien: 0,
        so_dong_phan_bo: 0
      };
      groupMap.set(groupKey, item);
    }
    item.tong_tien += Number(pb.so_tien || 0);
    item.so_dong_phan_bo += 1;
  });

  // 4. Tạo bản ghi chi_phi_chot_ky
  const chotKyId = `CK_${Date.now()}`;
  const chotKyPayload: ChiPhiChotKy = {
    id: chotKyId,
    thang,
    nam,
    trang_thai: 'da_chot',
    chot_boi: nguoiChot,
    chot_luc: new Date().toISOString(),
    ghi_chu: ghiChu || `Chốt kỳ Tháng ${thang}/${nam}`
  };

  await save(chotKyPayload, 'create', 'chi_phi_chot_ky');

  // 5. Lưu snapshot các dòng chi_phi_thong_ke
  const snapshotList = Array.from(groupMap.values());
  let idx = 0;
  for (const row of snapshotList) {
    idx++;
    const tkPayload: ChiPhiThongKe = {
      id: `TK_${Date.now()}_${idx}`,
      chot_ky_id: chotKyId,
      thang,
      nam,
      id_kmp: row.id_kmp,
      id_bo_phan: row.id_bo_phan,
      id_don_vi: row.id_don_vi,
      id_phap_nhan: row.id_phap_nhan,
      ma_so_thue: row.ma_so_thue,
      thuoc_bao_cao_hanh_chinh: row.thuoc_bao_cao_hanh_chinh,
      tong_tien: row.tong_tien,
      so_dong_phan_bo: row.so_dong_phan_bo
    };
    await save(tkPayload, 'create', 'chi_phi_thong_ke');
  }

  invalidateCache('chi_phi_chot_ky');
  invalidateCache('chi_phi_thong_ke');
  void writeLog('CHỐT KỲ', `Chốt kỳ chi phí Tháng ${thang}/${nam} | Snapshot: ${snapshotList.length} nhóm | Người chốt: ${nguoiChot}`);

  return { chotKy: chotKyPayload, so_dong_snapshot: snapshotList.length };
}

export async function huyChotKyChiPhi(chotKyId: string, nguoiHuy: string): Promise<boolean> {
  const currentChotKyList = await getChiPhiChotKy(true);
  const target = currentChotKyList.find(ck => ck.id === chotKyId);
  if (!target) {
    throw new Error('Không tìm thấy kỳ chốt cần hủy!');
  }

  // 1. Cập nhật chi_phi_chot_ky sang da_huy_chot
  const updatedPayload: ChiPhiChotKy = {
    ...target,
    trang_thai: 'da_huy_chot',
    huy_boi: nguoiHuy,
    huy_luc: new Date().toISOString()
  };
  await save(updatedPayload, 'update', 'chi_phi_chot_ky');

  // 2. Xóa các dòng snapshot chi_phi_thong_ke liên kết
  const thongKeList = await getChiPhiThongKe(true);
  const relatedTk = thongKeList.filter(tk => tk.chot_ky_id === chotKyId);
  for (const tk of relatedTk) {
    await deleteRecord(tk.id, 'chi_phi_thong_ke').catch(() => { });
  }

  invalidateCache('chi_phi_chot_ky');
  invalidateCache('chi_phi_thong_ke');
  void writeLog('HỦY CHỐT KỲ', `Hủy chốt kỳ Tháng ${target.thang}/${target.nam} | ID: ${chotKyId} | Người hủy: ${nguoiHuy}`);

  return true;
}

export async function updateDnttStatusBulk(
  dnttIds: string[],
  newStatus: string,
  nguoiCapNhat: string
): Promise<{ updatedCount: number; skippedLockedCount: number }> {
  if (!dnttIds || dnttIds.length === 0) {
    return { updatedCount: 0, skippedLockedCount: 0 };
  }

  const [allDntt, chotKyList] = await Promise.all([
    getDntt(true),
    getChiPhiChotKy(true)
  ]);

  const activeClosedPeriods = chotKyList.filter(ck => ck.trang_thai === 'da_chot');
  const lockedMonthYears = new Set(activeClosedPeriods.map(ck => `${ck.nam}_${ck.thang}`));

  let updatedCount = 0;
  let skippedLockedCount = 0;

  for (const id of dnttIds) {
    const dntt = allDntt.find(d => d.id === id);
    if (!dntt) continue;

    // Kiểm tra xem phiếu có rơi vào kỳ đã chốt không
    let isLocked = false;
    if (dntt.ngay_lap) {
      const date = new Date(dntt.ngay_lap);
      if (!isNaN(date.getTime())) {
        const thang = date.getMonth() + 1;
        const nam = date.getFullYear();
        if (lockedMonthYears.has(`${nam}_${thang}`)) {
          isLocked = true;
        }
      }
    }

    if (isLocked) {
      skippedLockedCount++;
      continue;
    }

    const payload = {
      ...dntt,
      trang_thai: newStatus,
      updated_at: new Date().toISOString()
    };
    await save(payload, 'update', 'dntt');
    updatedCount++;
  }

  invalidateCache('dntt');
  void writeLog('CẬP NHẬT TRẠNG THÁI HÀNG LOẠT', `Cập nhật ${updatedCount} phiếu DNTT sang trạng thái "${newStatus}" | Bỏ qua ${skippedLockedCount} phiếu thuộc kỳ đã chốt | Người thực hiện: ${nguoiCapNhat}`);

  return { updatedCount, skippedLockedCount };
}

