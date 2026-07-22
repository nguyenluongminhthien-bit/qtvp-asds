import { ChuKyATVSLD } from '../types';

export function getChungNhanByNhom(nhom: string): string | null {
  const cleanNhom = String(nhom).trim();
  if (cleanNhom === '1' || cleanNhom === '2' || cleanNhom === '6') {
    return 'Giấy chứng nhận huấn luyện ATVSLĐ';
  } else if (cleanNhom === '3') {
    return 'Thẻ An toàn lao động';
  } else if (cleanNhom === '4') {
    return 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';
  }
  return null;
}

export function calcGiaTriDen(
  huanLuyenDen: string | null | undefined,
  nhom: string,
  chuKyList: ChuKyATVSLD[]
): string | null {
  if (!huanLuyenDen) return null;
  const cleanNhom = String(nhom).trim();
  const cfg = chuKyList.find(c => String(c.nhom).trim() === cleanNhom);
  
  let soThang = 12;
  if (cfg) {
    soThang = Number(cfg.so_thang_hieu_luc);
  } else {
    if (cleanNhom === '1' || cleanNhom === '2') {
      soThang = 24;
    }
  }

  const d = new Date(huanLuyenDen);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + soThang);
  return d.toISOString().slice(0, 10);
}
