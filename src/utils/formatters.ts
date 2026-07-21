export const formatCurrency = (val: string | number | undefined | null): string => {
  if (!val && val !== 0) return 'Chưa cập nhật';
  const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num) || num === 0) return String(val);
  return num.toLocaleString('vi-VN') + ' VNĐ';
};

export const formatCurrencySpace = (val: string | number | undefined | null): string => {
  if (!val) return '';
  return val.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export const parseDateStrict = (val: any): Date | null => {
  if (!val || val === 0 || val === '0') return null;
  const d = new Date(val);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
  const s = String(val).trim().toLowerCase();
  const mVN = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mVN) {
    const d2 = new Date(parseInt(mVN[3], 10), parseInt(mVN[2], 10) - 1, parseInt(mVN[1], 10));
    if (!isNaN(d2.getTime())) return d2;
  }
  const numMatch = s.match(/\b(\d{5})\b/);
  if (numMatch && Number(numMatch[1]) > 30000) {
    return new Date((Number(numMatch[1]) - 25569) * 86400 * 1000);
  }
  return null;
};

export const formatPhoneNumber = (val: string | number | undefined | null): string => {
  if (!val) return '';
  const cleaned = val.toString().replace(/\D/g, ''); 
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
};

export const getDirectImageLink = (url: string): string => {
  if (!url) return '';
  const match = url.match(/[-\w]{25,}/);
  if (match && match[0]) {
    return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800`;
  }
  return url; 
};

const unaccentCache = new Map<string, string>();
const stripAccentsCache = new Map<string, string>();

export const toUnaccented = (str: any): string => {
  if (!str) return '';
  const key = String(str);
  const cached = unaccentCache.get(key);
  if (cached !== undefined) return cached;

  const res = key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (unaccentCache.size > 2000) unaccentCache.clear();
  unaccentCache.set(key, res);
  return res;
};

export const stripAccents = (str: any): string => {
  if (!str) return '';
  const key = String(str);
  const cached = stripAccentsCache.get(key);
  if (cached !== undefined) return cached;

  const res = key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();

  if (stripAccentsCache.size > 2000) stripAccentsCache.clear();
  stripAccentsCache.set(key, res);
  return res;
};

export const normalizeDateToISO = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(str)) {
    const parts = str.split(/[\/\-]/);
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
};

export const safeGet = (obj: any, key: string): any => {
  if (!obj) return '';
  if (obj[key] !== undefined) return obj[key];
  const lowerKey = key.toLowerCase();
  for (const k in obj) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  return '';
};