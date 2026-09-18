import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save,
  Car, Building2, MapPin, ChevronDown, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen,
  Receipt, Calendar, Info, Eye, BarChart3, Briefcase, AlertTriangle, ShieldCheck, FileSpreadsheet, Sparkles,
  SlidersHorizontal, Archive, History, CheckCircle2, Filter, RotateCcw,
  FileText, Link as LinkIcon, ExternalLink
} from 'lucide-react';
import { apiService } from '../services/api';
import { searchVehicleDriveFile } from '../services/googleDrive';
import { exportVehicleSchedule } from '../utils/exportExcel';
import { DonVi, TS_Xe, CP_HoatDongXe } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getDefaultUnitId, getAllSubordinateIds } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import { formatCurrencySpace as formatCurrency, stripAccents } from '../utils/formatters';
import { safeEvalMath } from '../utils/mathEvaluator';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import VehicleStatsTab from '../components/vehicle/VehicleStatsTab';
import VehicleScheduleTab from '../components/vehicle/VehicleScheduleTab';
import SegmentTabs from '../components/ui/SegmentTabs';
import { motion, AnimatePresence } from 'motion/react';
import PasteImportModal, { ColumnMapItem } from '../components/ui/PasteImportModal';

// --- HÀM TỰ ĐỘNG DÒ TÌM ID TỪ SUPABASE ---
const getCostId = (cp: any) => cp.id || cp.id_chi_phi_xe || '';
const getCostCarId = (cp: any) => cp.id_ts_xe || cp.id_phuong_tien || '';

const formatMonthYear = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 7);
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

const formatDateDisplay = (dateStr?: string | null) => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('vi-VN');
  } catch {
    return String(dateStr);
  }
};

const isLiquidatedCar = (xe: any) => xe?.hien_trang === 'Đã Thanh lý' || xe?.hien_trang === 'da_thanh_ly';

// --- HÀM TẠO MÀU SẮC CHO NHÃN HÃNG XE ---
const getBrandBadgeStyle = (brandStr: string = '') => {
  const b = brandStr.trim().toLowerCase();
  if (!b) return 'bg-gray-100 text-gray-700 border border-gray-200';
  if (b.includes('bmw')) return 'bg-sky-50 text-sky-700 border border-sky-200';
  if (b.includes('peugeot')) return 'bg-violet-50 text-violet-700 border border-violet-200';
  if (b.includes('mazda')) return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (b.includes('kia')) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (b.includes('toyota')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (b.includes('ford')) return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (b.includes('fuso')) return 'bg-teal-50 text-teal-700 border border-teal-200';
  if (b.includes('mercedes') || b.includes('merc')) return 'bg-slate-100 text-slate-800 border border-slate-300';
  if (b.includes('hyundai')) return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
  if (b.includes('honda')) return 'bg-red-50 text-red-700 border border-red-200';
  if (b.includes('lexus')) return 'bg-purple-50 text-purple-700 border border-purple-200';
  if (b.includes('mitsubishi')) return 'bg-pink-50 text-pink-700 border border-pink-200';
  if (b.includes('thaco') || b.includes('truck')) return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  if (b.includes('vinfast')) return 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200';
  if (b.includes('nissan')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (b.includes('isuzu')) return 'bg-lime-50 text-lime-700 border border-lime-200';
  if (b.includes('hino')) return 'bg-yellow-50 text-yellow-800 border border-yellow-300';
  if (b.includes('suzuki')) return 'bg-blue-100 text-blue-800 border border-blue-300';
  if (b.includes('audi')) return 'bg-zinc-100 text-zinc-800 border border-zinc-300';
  if (b.includes('porsche')) return 'bg-amber-100 text-amber-900 border border-amber-300';
  if (b.includes('chevrolet')) return 'bg-stone-100 text-stone-800 border border-stone-300';

  // Hash fallback cho các hãng xe khác
  const palettes = [
    'bg-teal-100 text-teal-800 border border-teal-300',
    'bg-indigo-100 text-indigo-800 border border-indigo-300',
    'bg-rose-100 text-rose-800 border border-rose-300',
    'bg-cyan-100 text-cyan-800 border border-cyan-300',
    'bg-purple-100 text-purple-800 border border-purple-300',
    'bg-orange-100 text-orange-800 border border-orange-300'
  ];
  let hash = 0;
  for (let i = 0; i < b.length; i++) hash = b.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
};



// ─── DỮ LIỆU HÃNG XE & MODEL ──────────────────────────────────────────────
// Cập nhật danh sách model tại đây khi cần
const VEHICLE_MODELS: Record<string, string[]> = {
  "THACO": ["Ollin 198", "Ollin 350", "Ollin 500", "Ollin 700", "Ollin 720", "Towner 800", "Towner Van", "Frontier 125", "Frontier 990", "Frontier K200", "Frontier K250", "TL700", "Bus 29 chỗ", "Aumark 500", "IVECO"],
  "KIA": ["Morning", "Soluto", "Sonet", "Seltos", "Sedona", "Sportage", "Carnival", "Sorento", "Telluride", "K3", "K5", "EV6", "EV9", "Stonic", "Carens", "K190", "K3000"],
  "MAZDA": ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-8", "CX-60", "CX-90", "MX-5", "BT-50"],
  "PEUGEOT": ["208", "2008", "3008", "5008", "408", "508", "508 SW", "Django", "Rifter", "Partner", "Expert", "Traveller", "Boxer"],
  "BMW": ["118i", "218i", "320i", "330i", "430i", "520i", "530i", "730Li", "740Li", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "M2", "M3", "M4", "M5", "iX3", "i4"],
  "BMW MOTORRAD": ["R1250GS", "R1250R", "R1250RT", "S1000RR", "S1000R", "F900R", "F900XR", "G310R", "G310GS", "R18", "M1000RR", "C400"],
  "JEEP": ["Wrangler", "Wrangler Unlimited", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Compass", "Renegade", "Commander"],
  "RAM": ["1500", "2500", "3500", "ProMaster"],
  "FUSO": ["Canter 1.9T", "Canter 3.5T", "Canter 5T", "Canter 6.5T", "Canter 7T", "Fighter", "Super Great", "Rosa 16 chỗ", "Rosa 29 chỗ"],
  "Mitsubishi": ["Xe nâng điện", "Xe nâng dầu"],
  "TCM": ["Xe nâng điện", "Xe nâng dầu"],
};

// ─── MÀU SỬ NHÃN MỤC ĐÍCH Sử DỤNG ──────────────────────────────────────────────
const getPurposeBadgeStyle = (purpose: string = '') => {
  const p = purpose.toLowerCase();
  if (p.includes('chuyên dụng') || p.includes('chuyen dung')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (p.includes('cho thuê') || p.includes('cho thue')) return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
  if (p.includes('sửa chữa') || p.includes('sua chua')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (p.includes('sự kiện') || p.includes('su kien') || p.includes('roadshow')) return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (p.includes('công') || p.includes('cong')) return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (p.includes('lái thử') || p.includes('lai thu')) return 'bg-violet-50 text-violet-700 border border-violet-200';
  if (p.includes('thay thế') || p.includes('thay the')) return 'bg-amber-50 text-amber-800 border border-amber-300';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
};

const getStatusBadgeStyle = (status: string = '') => {
  const s = status.trim();
  switch (s) {
    case 'Đang hoạt động':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'Sửa chữa':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'Ngưng hoạt động':
    case 'Ngừng hoạt động':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'Đã Thanh lý':
      return 'bg-gray-100 text-gray-600 border border-gray-200';
    case 'Chuyển KD xe QSD':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    default:
      return 'bg-gray-50 text-gray-500 border border-gray-205';
  }
};

const getStatusEmoji = (status: string = '') => {
  const s = status.trim();
  switch (s) {
    case 'Đang hoạt động': return '🟢';
    case 'Sửa chữa': return '🟡';
    case 'Ngưng hoạt động':
    case 'Ngừng hoạt động': return '🔴';
    case 'Đã Thanh lý': return '⚫';
    case 'Chuyển KD xe QSD': return '🔵';
    default: return '⚪';
  }
};

const formatMathInput = (val: string | number | undefined | null) => {
  if (!val) return '';
  const str = String(val);
  if (/[+\-*/()]/.test(str)) return str;
  return formatCurrency(str);
};

// ─── HELPER XỬ LÝ KÍCH THƯỚC XE & THÙNG XE ────────────────────────────────
interface KichThuocObj {
  dai?: number | string;
  rong?: number | string;
  cao?: number | string;
}

const parseKichThuoc = (val: any): { dai: string; rong: string; cao: string } => {
  if (!val) return { dai: '', rong: '', cao: '' };
  let obj = val;
  if (typeof val === 'string') {
    try {
      obj = JSON.parse(val);
    } catch {
      const parts = val.split(/[xX*×]/).map((s: string) => s.trim());
      if (parts.length === 3) return { dai: parts[0], rong: parts[1], cao: parts[2] };
      return { dai: '', rong: '', cao: '' };
    }
  }
  if (typeof obj === 'object' && obj !== null) {
    return {
      dai: obj.dai !== undefined && obj.dai !== null ? String(obj.dai) : '',
      rong: obj.rong !== undefined && obj.rong !== null ? String(obj.rong) : '',
      cao: obj.cao !== undefined && obj.cao !== null ? String(obj.cao) : ''
    };
  }
  return { dai: '', rong: '', cao: '' };
};

const formatKichThuoc = (val: any): string => {
  if (!val) return '---';
  const { dai, rong, cao } = parseKichThuoc(val);
  if (!dai && !rong && !cao) return '---';
  return `${Number(dai)?.toLocaleString('vi-VN') || dai || 0} × ${Number(rong)?.toLocaleString('vi-VN') || rong || 0} × ${Number(cao)?.toLocaleString('vi-VN') || cao || 0} mm`;
};

const cleanKichThuocPayload = (val: any): KichThuocObj | null => {
  if (!val) return null;
  const { dai, rong, cao } = parseKichThuoc(val);
  if (!dai && !rong && !cao) return null;
  return {
    dai: dai !== '' ? (isNaN(Number(dai)) ? dai : Number(dai)) : 0,
    rong: rong !== '' ? (isNaN(Number(rong)) ? rong : Number(rong)) : 0,
    cao: cao !== '' ? (isNaN(Number(cao)) ? cao : Number(cao)) : 0
  };
};

// ─── THÔNG SỐ KỸ THUẬT MẪU (PRESETS) CHO CÁC DÒNG XE ───────────────────────
export interface VehicleSpecPreset {
  so_cho?: number | string;
  tai_trong?: string;
  dung_tich?: string;
  kich_thuoc_xe?: { dai: string | number; rong: string | number; cao: string | number };
  kich_thuoc_thung?: { dai: string | number; rong: string | number; cao: string | number };
  cong_thuc_banh?: string;
  loai_nhien_lieu?: string;
}

const VEHICLE_SPECS_PRESETS: Record<string, Record<string, VehicleSpecPreset>> = {
  "THACO": {
    "Frontier K200": { so_cho: 3, tai_trong: '1.9', dung_tich: '2497 cc', kich_thuoc_xe: { dai: '5280', rong: '1830', cao: '2640' }, kich_thuoc_thung: { dai: '3200', rong: '1670', cao: '1830' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Frontier K250": { so_cho: 3, tai_trong: '2.49', dung_tich: '2497 cc', kich_thuoc_xe: { dai: '5620', rong: '1860', cao: '2555' }, kich_thuoc_thung: { dai: '3500', rong: '1670', cao: '1670' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Ollin 350": { so_cho: 3, tai_trong: '3.49', dung_tich: '2771 cc', kich_thuoc_xe: { dai: '6185', rong: '2020', cao: '2900' }, kich_thuoc_thung: { dai: '4350', rong: '1870', cao: '1830' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Ollin 500": { so_cho: 3, tai_trong: '5', dung_tich: '3760 cc', kich_thuoc_xe: { dai: '6185', rong: '2020', cao: '2900' }, kich_thuoc_thung: { dai: '4350', rong: '1870', cao: '1830' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Ollin 700": { so_cho: 3, tai_trong: '7', dung_tich: '4087 cc', kich_thuoc_xe: { dai: '7700', rong: '2250', cao: '3260' }, kich_thuoc_thung: { dai: '5700', rong: '2100', cao: '2040' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Ollin 720": { so_cho: 3, tai_trong: '7.2', dung_tich: '4087 cc', kich_thuoc_xe: { dai: '8050', rong: '2250', cao: '3280' }, kich_thuoc_thung: { dai: '6200', rong: '2100', cao: '2040' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Towner 800": { so_cho: 2, tai_trong: '0.9', dung_tich: '970 cc', kich_thuoc_xe: { dai: '3570', rong: '1400', cao: '2105' }, kich_thuoc_thung: { dai: '2200', rong: '1330', cao: '1440' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Towner Van": { so_cho: 2, tai_trong: '0.95', dung_tich: '970 cc', kich_thuoc_xe: { dai: '3290', rong: '1400', cao: '1780' }, kich_thuoc_thung: { dai: '1460', rong: '1220', cao: '1200' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Bus 29 chỗ": { so_cho: 29, dung_tich: '3907 cc', kich_thuoc_xe: { dai: '7620', rong: '2090', cao: '2860' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Aumark 500": { so_cho: 3, tai_trong: '5', dung_tich: '3760 cc', kich_thuoc_xe: { dai: '6185', rong: '2020', cao: '2900' }, kich_thuoc_thung: { dai: '4350', rong: '1870', cao: '1830' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' }
  },
  "FUSO": {
    "Canter 1.9T": { so_cho: 3, tai_trong: '1.9', dung_tich: '2977 cc', kich_thuoc_xe: { dai: '6040', rong: '1870', cao: '2820' }, kich_thuoc_thung: { dai: '4350', rong: '1750', cao: '1780' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Canter 3.5T": { so_cho: 3, tai_trong: '3.49', dung_tich: '2977 cc', kich_thuoc_xe: { dai: '6080', rong: '1995', cao: '2950' }, kich_thuoc_thung: { dai: '4350', rong: '1870', cao: '1830' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Canter 5T": { so_cho: 3, tai_trong: '5', dung_tich: '3908 cc', kich_thuoc_xe: { dai: '7030', rong: '2170', cao: '3000' }, kich_thuoc_thung: { dai: '5200', rong: '2050', cao: '1900' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Canter 6.5T": { so_cho: 3, tai_trong: '6.5', dung_tich: '3908 cc', kich_thuoc_xe: { dai: '7800', rong: '2170', cao: '3100' }, kich_thuoc_thung: { dai: '6000', rong: '2050', cao: '1900' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Canter 7T": { so_cho: 3, tai_trong: '7', dung_tich: '3908 cc', kich_thuoc_xe: { dai: '8100', rong: '2200', cao: '3150' }, kich_thuoc_thung: { dai: '6200', rong: '2050', cao: '1900' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Fighter": { so_cho: 3, tai_trong: '8', dung_tich: '7545 cc', kich_thuoc_xe: { dai: '9150', rong: '2490', cao: '3600' }, kich_thuoc_thung: { dai: '7100', rong: '2350', cao: '2150' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Super Great": { so_cho: 2, tai_trong: '15', dung_tich: '11967 cc', kich_thuoc_xe: { dai: '11900', rong: '2500', cao: '3800' }, kich_thuoc_thung: { dai: '9600', rong: '2350', cao: '2150' }, cong_thuc_banh: '8x4', loai_nhien_lieu: 'Dầu Diesel' },
    "Rosa 16 chỗ": { so_cho: 16, dung_tich: '3908 cc', kich_thuoc_xe: { dai: '6990', rong: '2010', cao: '2630' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Rosa 29 chỗ": { so_cho: 29, dung_tich: '3908 cc', kich_thuoc_xe: { dai: '7730', rong: '2010', cao: '2630' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' }
  },
  "KIA": {
    "Carnival": { so_cho: 7, dung_tich: '2151 cc', kich_thuoc_xe: { dai: '5155', rong: '1995', cao: '1775' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Morning": { so_cho: 5, dung_tich: '1248 cc', kich_thuoc_xe: { dai: '3595', rong: '1595', cao: '1485' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Soluto": { so_cho: 5, dung_tich: '1368 cc', kich_thuoc_xe: { dai: '4300', rong: '1700', cao: '1460' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Sonet": { so_cho: 5, dung_tich: '1497 cc', kich_thuoc_xe: { dai: '4120', rong: '1790', cao: '1642' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Seltos": { so_cho: 5, dung_tich: '1353 cc', kich_thuoc_xe: { dai: '4315', rong: '1800', cao: '1645' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "K3": { so_cho: 5, dung_tich: '1591 cc', kich_thuoc_xe: { dai: '4640', rong: '1800', cao: '1450' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "K5": { so_cho: 5, dung_tich: '1999 cc', kich_thuoc_xe: { dai: '4905', rong: '1860', cao: '1445' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Sedona": { so_cho: 7, dung_tich: '2199 cc', kich_thuoc_xe: { dai: '5115', rong: '1985', cao: '1755' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Sorento": { so_cho: 7, dung_tich: '2151 cc', kich_thuoc_xe: { dai: '4810', rong: '1900', cao: '1700' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "Sportage": { so_cho: 5, dung_tich: '1999 cc', kich_thuoc_xe: { dai: '4660', rong: '1865', cao: '1665' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Carens": { so_cho: 7, dung_tich: '1497 cc', kich_thuoc_xe: { dai: '4540', rong: '1800', cao: '1700' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "K190": { so_cho: 3, tai_trong: '1.9', dung_tich: '2665 cc', kich_thuoc_xe: { dai: '5200', rong: '1770', cao: '2150' }, kich_thuoc_thung: { dai: '3200', rong: '1670', cao: '380' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' },
    "K3000": { so_cho: 3, tai_trong: '1.4', dung_tich: '2957 cc', kich_thuoc_xe: { dai: '5330', rong: '1770', cao: '2120' }, kich_thuoc_thung: { dai: '3400', rong: '1650', cao: '380' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' }
  },
  "MAZDA": {
    "Mazda2": { so_cho: 5, dung_tich: '1496 cc', kich_thuoc_xe: { dai: '4340', rong: '1695', cao: '1470' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Mazda3": { so_cho: 5, dung_tich: '1496 cc', kich_thuoc_xe: { dai: '4660', rong: '1795', cao: '1440' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Mazda6": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '4865', rong: '1840', cao: '1450' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "CX-3": { so_cho: 5, dung_tich: '1496 cc', kich_thuoc_xe: { dai: '4275', rong: '1765', cao: '1535' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "CX-30": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '4395', rong: '1795', cao: '1540' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "CX-5": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '4590', rong: '1845', cao: '1680' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "CX-8": { so_cho: 7, dung_tich: '2488 cc', kich_thuoc_xe: { dai: '4900', rong: '1840', cao: '1730' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "CX-60": { so_cho: 5, dung_tich: '2488 cc', kich_thuoc_xe: { dai: '4745', rong: '1890', cao: '1680' }, cong_thuc_banh: '4x4', loai_nhien_lieu: 'Xăng' },
    "CX-90": { so_cho: 7, dung_tich: '3283 cc', kich_thuoc_xe: { dai: '5120', rong: '1994', cao: '1745' }, cong_thuc_banh: '4x4', loai_nhien_lieu: 'Xăng' },
    "BT-50": { so_cho: 5, tai_trong: '0.9', dung_tich: '1898 cc', kich_thuoc_xe: { dai: '5280', rong: '1870', cao: '1790' }, kich_thuoc_thung: { dai: '1495', rong: '1530', cao: '490' }, cong_thuc_banh: '4x4', loai_nhien_lieu: 'Dầu Diesel' }
  },
  "PEUGEOT": {
    "2008": { so_cho: 5, dung_tich: '1199 cc', kich_thuoc_xe: { dai: '4300', rong: '1770', cao: '1550' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "3008": { so_cho: 5, dung_tich: '1598 cc', kich_thuoc_xe: { dai: '4510', rong: '1850', cao: '1650' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "5008": { so_cho: 7, dung_tich: '1598 cc', kich_thuoc_xe: { dai: '4670', rong: '1855', cao: '1655' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "408": { so_cho: 5, dung_tich: '1598 cc', kich_thuoc_xe: { dai: '4687', rong: '1848', cao: '1478' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "Traveller": { so_cho: 7, dung_tich: '1997 cc', kich_thuoc_xe: { dai: '5309', rong: '1935', cao: '1915' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Dầu Diesel' }
  },
  "BMW": {
    "320i": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '4709', rong: '1827', cao: '1435' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "520i": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '4963', rong: '1868', cao: '1479' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "730Li": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '5260', rong: '1902', cao: '1479' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "X1": { so_cho: 5, dung_tich: '1499 cc', kich_thuoc_xe: { dai: '4500', rong: '1845', cao: '1642' }, cong_thuc_banh: '4x2', loai_nhien_lieu: 'Xăng' },
    "X3": { so_cho: 5, dung_tich: '1998 cc', kich_thuoc_xe: { dai: '4708', rong: '1891', cao: '1676' }, cong_thuc_banh: '4x4', loai_nhien_lieu: 'Xăng' },
    "X5": { so_cho: 7, dung_tich: '2998 cc', kich_thuoc_xe: { dai: '4922', rong: '2004', cao: '1745' }, cong_thuc_banh: '4x4', loai_nhien_lieu: 'Xăng' }
  }
};

const getSuggestedSpecs = (
  loai_phuong_tien: string = '',
  hieu_xe: string = '',
  loai_xe: string = '',
  existingCars: TS_Xe[] = []
): { specs: Partial<TS_Xe> & { kich_thuoc_xe?: any; kich_thuoc_thung?: any }; source: 'history' | 'preset' } | null => {
  if (!hieu_xe || !loai_xe) return null;
  const cleanBrand = hieu_xe.trim().toLowerCase();
  const cleanModel = loai_xe.trim().toLowerCase();
  const cleanType = loai_phuong_tien.trim().toLowerCase();

  // 1. Tìm trong existingCars (ưu tiên xe có cùng loại phương tiện nếu có, và có ít nhất 1 thông số)
  const matchedCars = existingCars.filter(c => {
    const b = String(c.hieu_xe || '').trim().toLowerCase();
    const m = String(c.loai_xe || '').trim().toLowerCase();
    return b === cleanBrand && m === cleanModel;
  });

  if (matchedCars.length > 0) {
    const bestMatch = matchedCars.find(c => String(c.loai_phuong_tien || '').trim().toLowerCase() === cleanType) || matchedCars[0];
    const ktXe = parseKichThuoc(bestMatch.kich_thuoc_xe);
    const ktThung = parseKichThuoc(bestMatch.kich_thuoc_thung);
    const hasAnySpec = bestMatch.so_cho || bestMatch.tai_trong || bestMatch.dung_tich || bestMatch.cong_thuc_banh || ktXe.dai || ktThung.dai;

    if (hasAnySpec) {
      return {
        source: 'history',
        specs: {
          so_cho: bestMatch.so_cho || '',
          tai_trong: bestMatch.tai_trong || '',
          dung_tich: bestMatch.dung_tich || '',
          kich_thuoc_xe: ktXe,
          kich_thuoc_thung: ktThung,
          cong_thuc_banh: bestMatch.cong_thuc_banh || '',
          loai_nhien_lieu: bestMatch.loai_nhien_lieu || ''
        }
      };
    }
  }

  // 2. Tìm trong VEHICLE_SPECS_PRESETS
  const brandKey = Object.keys(VEHICLE_SPECS_PRESETS).find(k => k.toLowerCase() === cleanBrand);
  if (brandKey) {
    const brandPresets = VEHICLE_SPECS_PRESETS[brandKey];
    const modelKey = Object.keys(brandPresets).find(k => k.toLowerCase() === cleanModel);
    if (modelKey && brandPresets[modelKey]) {
      const p = brandPresets[modelKey];
      return {
        source: 'preset',
        specs: {
          so_cho: p.so_cho !== undefined ? String(p.so_cho) : '',
          tai_trong: p.tai_trong || '',
          dung_tich: p.dung_tich || '',
          kich_thuoc_xe: p.kich_thuoc_xe ? { dai: String(p.kich_thuoc_xe.dai || ''), rong: String(p.kich_thuoc_xe.rong || ''), cao: String(p.kich_thuoc_xe.cao || '') } : { dai: '', rong: '', cao: '' },
          kich_thuoc_thung: p.kich_thuoc_thung ? { dai: String(p.kich_thuoc_thung.dai || ''), rong: String(p.kich_thuoc_thung.rong || ''), cao: String(p.kich_thuoc_thung.cao || '') } : { dai: '', rong: '', cao: '' },
          cong_thuc_banh: p.cong_thuc_banh || '',
          loai_nhien_lieu: p.loai_nhien_lieu || ''
        }
      };
    }
  }

  return null;
};

export default function VehiclePage() {
  const { user } = useAuth();
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [xeData, setXeData] = useState<TS_Xe[]>([]);
  const [chiPhiData, setChiPhiData] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [carSearchTerm, setCarSearchTerm] = useState('');
  const [unitSearchTerm, setUnitSearchTerm] = useState('');

  // 🟢 Tự động làm sạch khi dán vào ô tìm kiếm xe: viết liền không dấu, bỏ ký tự đặc biệt, gạch nối, gạch dưới, khoảng trắng thừa
  const handlePasteSearch = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleaned = stripAccents(pastedText)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    setCarSearchTerm(cleaned);
  };
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // 🟢 STATE CHO THANH CẢNH BÁO XE
  const [isWarningOpen, setIsWarningOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // 🟢 STATE CHO TAB & BỘ LỌC NÂNG CAO
  const [activeTab, setActiveTab] = useState<'list' | 'schedule' | 'stats'>('list');
  const [vehicleSubTab, setVehicleSubTab] = useState<'active' | 'liquidated'>('active');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterPurpose, setFilterPurpose] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 🟢 STATE CHO MODAL CẬP NHẬT TRẠNG THÁI XE (TAB HIỆN HỮU)
  const [statusModalCar, setStatusModalCar] = useState<TS_Xe | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Đang hoạt động');
  const [liquidationDate, setLiquidationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusReason, setStatusReason] = useState<string>('');

  // 🟢 STATE CHO MODAL TÁI CẤP BIỂN SỐ XE ĐÃ THANH LÝ
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean;
    oldCar: TS_Xe | null;
    pendingCarData: any;
    mode: 'create' | 'update';
  }>({
    isOpen: false,
    oldCar: null,
    pendingCarData: null,
    mode: 'create'
  });

  // 🟢 STATE CHO MODAL XÓA VĨNH VIỄN XE THANH LÝ
  const [permanentDeleteCar, setPermanentDeleteCar] = useState<TS_Xe | null>(null);

  const [plateError, setPlateError] = useState(false);
  const [chassisError, setChassisError] = useState<{ isDuplicate: boolean; carInfo?: string }>({ isDuplicate: false });
  const [selectedCarForCost, setSelectedCarForCost] = useState<TS_Xe | null>(null);

  const [carModal, setCarModal] = useState<{
    isOpen: boolean; mode: 'create' | 'update'; formData: Partial<TS_Xe> & any;
  }>({ isOpen: false, mode: 'create', formData: {} });
  const [scanningDrive, setScanningDrive] = useState(false);

  const [specSuggestionInfo, setSpecSuggestionInfo] = useState<{
    brand: string;
    model: string;
    source: string;
  } | null>(null);

  const [costModal, setCostModal] = useState<{
    isOpen: boolean; mode: 'create' | 'update'; formData: any;
  }>({ isOpen: false, mode: 'create', formData: {} });

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<TS_Xe & any | null>(null);

  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<'create' | 'update'>('create');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFeaturesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'xe' | 'chiphi' } | null>(null);

  const isCarModalOpen = carModal.isOpen;
  const modalMode = carModal.mode;
  const carFormData = carModal.formData;
  const setCarFormData = (d: any) => setCarModal(p => ({ ...p, formData: typeof d === 'function' ? d(p.formData) : d }));

  const isCostModalOpen = costModal.isOpen;
  const costModalMode = costModal.mode;
  const costFormData = costModal.formData;
  const setCostFormData = (d: any) => setCostModal(p => ({ ...p, formData: typeof d === 'function' ? d(p.formData) : d }));

  const [nhatKyData, setNhatKyData] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, xeResult, cpResult, nkResult] = await Promise.all([
        apiService.getDonVi(), apiService.getXe(), apiService.getChiPhiXe(), apiService.getNhatKySuDungXe()
      ]);
      setDonViList(dvResult || []); setXeData(xeResult || []); setChiPhiData(cpResult || []); setNhatKyData(nkResult || []);
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (viewData) {
      apiService.writeLog(
        'XEM XE',
        `Biển số: ${viewData.bien_so || ''} | Hiệu xe: ${viewData.hieu_xe || ''} | Loại xe: ${viewData.loai_xe || ''}`
      );
    }
  }, [viewData]);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[dv.id] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const allowedDonViIds = useAllowedUnits(donViList);

  const limitPlates = useMemo(() => {
    if (!user?.quyen_chi_tiet) return null;
    const rules = user.quyen_chi_tiet.split(',').map(r => r.trim());
    const rule = rules.find(r => r.startsWith('XE_LIMIT:'));
    if (!rule) return null;
    return rule.substring('XE_LIMIT:'.length).split('|').filter(Boolean).map(p => p.toUpperCase().replace(/[\s\-\.]/g, ''));
  }, [user]);

  const permittedCars = useMemo(() => {
    if (!limitPlates) return xeData;
    return xeData.filter(item => {
      const cleanPlate = String(item.bien_so || '').toUpperCase().replace(/[\s\-\.]/g, '');
      return limitPlates.includes(cleanPlate);
    });
  }, [xeData, limitPlates]);

  const permittedChiPhi = useMemo(() => {
    if (!limitPlates) return chiPhiData;
    return chiPhiData.filter(cp => {
      const carId = getCostCarId(cp);
      const car = xeData.find(x => x.id === carId);
      if (!car) return false;
      const cleanPlate = String(car.bien_so || '').toUpperCase().replace(/[\s\-\.]/g, '');
      return limitPlates.includes(cleanPlate);
    });
  }, [chiPhiData, xeData, limitPlates]);

  const permittedNhatKy = useMemo(() => {
    if (!limitPlates) return nhatKyData;
    return nhatKyData.filter(nk => {
      const cleanPlate = String(nk.bien_so || '').toUpperCase().replace(/[\s\-\.]/g, '');
      return limitPlates.includes(cleanPlate);
    });
  }, [nhatKyData, limitPlates]);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (donViList.length > 0 && !hasInitializedRef.current) {
      const defId = getDefaultUnitId(user, donViList);
      if (defId && allowedDonViIds.includes(defId)) {
        setSelectedUnitFilter(defId);
      } else if (allowedDonViIds.length > 0) {
        setSelectedUnitFilter(allowedDonViIds[0]);
      }
      hasInitializedRef.current = true;
    }
  }, [donViList, user, allowedDonViIds]);

  const filteredUnits = useMemo(() => {
    let baseUnits = donViList.filter(item => allowedDonViIds.includes(item.id));
    if (!unitSearchTerm) return baseUnits;

    const lower = unitSearchTerm.toLowerCase();
    const matchedIds = new Set<string>();

    baseUnits.forEach(u => {
      if (String(u.ten_don_vi || '').toLowerCase().includes(lower) || String(u.id || '').toLowerCase().includes(lower)) {
        matchedIds.add(u.id);
        let parentId = u.cap_quan_ly;
        while (parentId && parentId !== 'HO') {
          matchedIds.add(parentId);
          const parentUnit = baseUnits.find(p => p.id === parentId);
          parentId = parentUnit ? parentUnit.cap_quan_ly : null;
        }
      }
    });

    const addChildren = (parentId: string) => {
      baseUnits.forEach(u => {
        if (u.cap_quan_ly === parentId && !matchedIds.has(u.id)) {
          matchedIds.add(u.id);
          addChildren(u.id);
        }
      });
    };

    const initialMatches = Array.from(matchedIds);
    initialMatches.forEach(id => addChildren(id));

    return baseUnits.filter(item => matchedIds.has(item.id));
  }, [donViList, unitSearchTerm, allowedDonViIds]);

  const parentUnits = useMemo(() => filteredUnits.filter(item => item.cap_quan_ly === 'HO' || !item.cap_quan_ly), [filteredUnits]);
  const getChildUnits = (parentId: string) => sortDonViByThuTu(filteredUnits.filter(item => item.cap_quan_ly === parentId));

  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => {
    return groupParentUnits(parentUnits);
  }, [parentUnits]);

  // 🟢 OPTIONS MODEL CHO BỘ LỌC (cascade theo hãng)
  const modelFilterOptions = useMemo(() => {
    if (filterBrand && VEHICLE_MODELS[filterBrand]) return VEHICLE_MODELS[filterBrand];
    return [...new Set(xeData.map((x: any) => x.loai_xe).filter(Boolean))].sort() as string[];
  }, [filterBrand, xeData]);

  const unitCars = useMemo(() => {
    let result = permittedCars.filter((x: any) => allowedDonViIds.includes(x.id_don_vi));
    if (selectedUnitFilter) {
      const childUnitIds = getAllSubordinateIds(selectedUnitFilter, donViList);
      const validIds = [selectedUnitFilter, ...childUnitIds];
      result = result.filter((item: any) => validIds.includes(item.id_don_vi));
    }
    return result;
  }, [permittedCars, selectedUnitFilter, allowedDonViIds, donViList]);

  // Bộ lọc chung (search, hãng, model, mục đích)
  const baseFilteredCars = useMemo(() => {
    let result = unitCars;
    if (carSearchTerm) {
      const cleanSearch = stripAccents(carSearchTerm).trim().toLowerCase();
      const normalizeClean = (str: string) => stripAccents(str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const searchNormalized = normalizeClean(carSearchTerm);
      result = result.filter(item =>
        stripAccents(item.bien_so || '').toLowerCase().includes(cleanSearch) ||
        (searchNormalized && normalizeClean(item.bien_so || '').includes(searchNormalized)) ||
        stripAccents(item.ma_tai_san || '').toLowerCase().includes(cleanSearch) ||
        stripAccents(item.hieu_xe || '').toLowerCase().includes(cleanSearch) ||
        stripAccents(item.loai_xe || '').toLowerCase().includes(cleanSearch) ||
        stripAccents(item.so_khung || '').toLowerCase().includes(cleanSearch) ||
        stripAccents(item.so_may || '').toLowerCase().includes(cleanSearch)
      );
    }
    if (filterBrand) result = result.filter((i: any) => i.hieu_xe === filterBrand);
    if (filterModel) result = result.filter((i: any) => i.loai_xe === filterModel);
    if (filterPurpose) result = result.filter((i: any) => i.muc_dich_su_dung === filterPurpose);
    return result;
  }, [unitCars, carSearchTerm, filterBrand, filterModel, filterPurpose]);

  const activeCarsCount = useMemo(() => {
    return baseFilteredCars.filter(item => !isLiquidatedCar(item)).length;
  }, [baseFilteredCars]);

  const liquidatedCarsCount = useMemo(() => {
    return baseFilteredCars.filter(item => isLiquidatedCar(item)).length;
  }, [baseFilteredCars]);

  const filteredCars = useMemo(() => {
    if (vehicleSubTab === 'active') {
      let result = baseFilteredCars.filter(item => !isLiquidatedCar(item));
      if (filterStatus) result = result.filter((i: any) => i.hien_trang === filterStatus);
      return result;
    } else {
      return baseFilteredCars.filter(item => isLiquidatedCar(item));
    }
  }, [baseFilteredCars, vehicleSubTab, filterStatus]);

  const vehicleTabs = useMemo(() => [
    { id: 'list', label: 'Danh sách xe', icon: <Car size={16} />, count: activeCarsCount },
    { id: 'schedule', label: 'Lịch trình & Nhật ký', icon: <Calendar size={16} /> },
    { id: 'stats', label: 'Thống kê', icon: <BarChart3 size={16} /> }
  ], [activeCarsCount]);


  // 🟢 BỘ LỌC CẢNH BÁO XE (Tự động quét Hạn đăng kiểm và Bảo hiểm)
  const expiringCars = useMemo(() => {
    const warnings: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredCars.forEach((xe: any) => {
      // Bỏ qua xe đã thanh lý hoặc ngừng hoạt động
      if (xe.hien_trang !== 'Đang hoạt động') return;

      const checkExp = (dateStr: any, label: string) => {
        if (!dateStr) return;
        const expDate = new Date(dateStr);
        if (isNaN(expDate.getTime())) return;
        expDate.setHours(0, 0, 0, 0);

        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          warnings.push({
            type: label,
            name: `${xe.hieu_xe} ${xe.loai_xe} - ${xe.bien_so}`,
            unitName: donViMap[xe.id_don_vi] || xe.id_don_vi,
            diffDays,
            dateStr: expDate.toLocaleDateString('vi-VN')
          });
        }
      };

      checkExp(xe.han_dang_kiem, 'Hạn Đăng kiểm');
      checkExp(xe.han_bh_tnds, 'Bảo hiểm TNDS');
      checkExp(xe.han_bh_vc, 'Bảo hiểm Vật chất');
    });

    return warnings.sort((a, b) => a.diffDays - b.diffDays);
  }, [filteredCars, donViMap]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Tất cả Đơn vị';
    const unit = donViList.find(d => d.id === selectedUnitFilter);
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViList]);

  // 🟢 BẮT ĐẦU: STATE VÀ LOGIC PHÂN TRANG (PAGINATION)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | string>(100);

  const actualRowsPerPage = typeof rowsPerPage === 'number' && rowsPerPage > 0 ? rowsPerPage : 100;
  const totalPages = Math.ceil(filteredCars.length / actualRowsPerPage) || 1;

  // Tự động quay về trang 1 nếu người dùng tìm kiếm, đổi đơn vị hoặc đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedUnitFilter, carSearchTerm, filterBrand, filterModel, filterPurpose, filterStatus, vehicleSubTab]);

  // Lấy danh sách xe của trang hiện tại
  const paginatedCars = useMemo(() => {
    const startIndex = (currentPage - 1) * actualRowsPerPage;
    return filteredCars.slice(startIndex, startIndex + actualRowsPerPage);
  }, [filteredCars, currentPage, actualRowsPerPage]);
  // 🟢 KẾT THÚC: LOGIC PHÂN TRANG

  const openCarModal = (mode: 'create' | 'update', item?: TS_Xe | any) => {
    setCarModal(prev => ({ ...prev, mode })); setPlateError(false); setChassisError({ isDuplicate: false }); setSpecSuggestionInfo(null);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;
    if (item) {
      setCarFormData({
        ...item,
        ho_so_xe: item.ho_so_xe || item.link_ho_so_xe || '',
        tai_trong: item.tai_trong || '',
        kich_thuoc_xe: parseKichThuoc(item.kich_thuoc_xe),
        kich_thuoc_thung: parseKichThuoc(item.kich_thuoc_thung)
      });
    } else {
      setCarFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), muc_dich_su_dung: 'Xe công', dia_diem_su_dung: '', ma_tai_san: '', don_vi_chu_so_huu: '', nguyen_gia: '', cp_thue_khau_hao: '',
        bien_so: '', loai_phuong_tien: 'Ô tô du lịch', hieu_xe: '', loai_xe: '', phien_ban: '', mau_xe: '', nam_sx: '', nam_dk: '', so_khung: '', so_may: '',
        so_cho: '', loai_nhien_lieu: 'Xăng', dung_tich: '', cong_thuc_banh: '', hinh_thuc_so_huu: 'Sở hữu', gps: 'Có', hien_trang: 'Đang hoạt động', ghi_chu: '',
        // 🟢 CÁC CỘT HẠN NGÀY MỚI
        han_dang_kiem: '', han_bh_tnds: '', han_bh_vc: '',
        // 🟢 THÔNG SỐ TẢI TRỌNG & KÍCH THƯỚC MỚI
        tai_trong: '',
        kich_thuoc_xe: { dai: '', rong: '', cao: '' },
        kich_thuoc_thung: { dai: '', rong: '', cao: '' },
        ho_so_xe: ''
      });
    }
    setCarModal(prev => ({ ...prev, isOpen: true })); setError(null);
  };

  const saveCarFinal = async (carData: any, mode: 'create' | 'update', oldLiquidatedCar?: TS_Xe | null) => {
    let finalData = { ...carData };

    // Tự động in hoa Địa điểm sử dụng
    if (finalData.dia_diem_su_dung) {
      finalData.dia_diem_su_dung = String(finalData.dia_diem_su_dung).toUpperCase();
    }

    if (finalData.ho_so_xe) {
      finalData.ho_so_xe = String(finalData.ho_so_xe).trim();
    }

    const isTruck = finalData.loai_phuong_tien === 'Ô tô tải';
    finalData.kich_thuoc_xe = cleanKichThuocPayload(finalData.kich_thuoc_xe);
    if (isTruck) {
      finalData.kich_thuoc_thung = cleanKichThuocPayload(finalData.kich_thuoc_thung);
      finalData.tai_trong = finalData.tai_trong ? String(finalData.tai_trong).trim() : null;
    } else {
      finalData.kich_thuoc_thung = null;
      finalData.tai_trong = null;
    }

    // Xử lý giá trị rỗng thành null
    Object.keys(finalData).forEach(key => {
      if (key === 'kich_thuoc_xe' || key === 'kich_thuoc_thung') return;
      if (finalData[key] === '' || finalData[key] === ' ') finalData[key] = null;
    });

    if (mode === 'create' && !finalData.id) {
      finalData.id = `XE-${Date.now()}`;
    }

    setSubmitting(true); setError(null);
    try {
      const response = await apiService.save(finalData, mode, "ts_xe");
      const savedId = response?.id || response?.newId || finalData.id;
      const newCar = { ...finalData, id: savedId } as TS_Xe;

      if (mode === 'create') setXeData(prev => [newCar, ...prev]);
      else setXeData(prev => prev.map(item => item.id === savedId ? newCar : item));

      // Ghi log tái cấp biển số nếu có xe cũ
      if (oldLiquidatedCar) {
        await apiService.writeLog(
          'CẤP LẠI BIỂN SỐ',
          `Cấp lại biển số [${finalData.bien_so}] của xe thanh lý (ID cũ: ${oldLiquidatedCar.id} | ${oldLiquidatedCar.hieu_xe} ${oldLiquidatedCar.loai_xe} | Số khung: ${oldLiquidatedCar.so_khung || '---'} | Ngày thanh lý: ${formatDateDisplay(oldLiquidatedCar.ngay_thanh_ly)}) cho xe mới (ID: ${savedId} | ${finalData.hieu_xe} ${finalData.loai_xe})`
        );
      }

      setCarModal(prev => ({ ...prev, isOpen: false }));
      if (mode === 'create') toast.success("Thêm mới phương tiện thành công!");
      else toast.success("Cập nhật thông tin xe thành công!");

    } catch (err: any) {
      setError(err.message || 'Lỗi lưu dữ liệu Xe.');
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin xe!");
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // 🟢 HÀM TỰ ĐỘNG TÌM & LIÊN KẾT FILE HỒ SƠ XE TRÊN GOOGLE DRIVE THEO SỐ KHUNG (VIN)
  const handleAutoScanDriveCar = async () => {
    const chassis = carFormData.so_khung;
    if (!chassis || !String(chassis).trim()) {
      toast.warning("Vui lòng nhập Số khung xe trước khi quét Drive!");
      return;
    }

    const cleanChassis = String(chassis).trim().toUpperCase();
    setScanningDrive(true);
    try {
      const match = await searchVehicleDriveFile(cleanChassis);
      if (match) {
        setCarFormData((prev: any) => ({ ...prev, ho_so_xe: match.link }));
        const itemType = match.isFolder ? "Thư mục hồ sơ" : "Tệp hồ sơ";
        toast.success(`Đã tìm thấy ${itemType} [${match.name}] cho Số khung [${cleanChassis}] thành công!`);
      } else {
        toast.error(`Không tìm thấy Tệp hoặc Thư mục hồ sơ cho Số khung [${cleanChassis}] trong thư mục Hồ sơ Xe trên Google Drive. Bạn có thể dán liên kết thủ công!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi quét liên kết Google Drive!");
    } finally {
      setScanningDrive(false);
    }
  };

  const handleCarSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carFormData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị quản lý!");
    if (!carFormData.hieu_xe) return toast.warning("Vui lòng chọn Hiệu xe!");

    // 1. Kiểm tra trùng lặp Biển Số Xe (License Plate) trong danh mục
    const newPlate = String(carFormData.bien_so || '').trim().toUpperCase().replace(/[\s\-\.]/g, '');
    if (newPlate) {
      const duplicateCars = xeData.filter(xe => {
        if ((modalMode === 'edit' || modalMode === 'update') && xe.id === carFormData.id) return false;
        const existingPlate = String(xe.bien_so || '').trim().toUpperCase().replace(/[\s\-\.]/g, '');
        return existingPlate === newPlate;
      });

      if (duplicateCars.length > 0) {
        // Có xe đang hoạt động / hiện hữu trùng biển số -> CHẶN
        const activeDup = duplicateCars.find(xe => !isLiquidatedCar(xe));
        if (activeDup) {
          const unitName = donViMap[activeDup.id_don_vi] || activeDup.id_don_vi || '';
          return toast.error(`Biển số xe "${carFormData.bien_so}" đang được sử dụng bởi xe ${activeDup.hieu_xe || ''} ${activeDup.loai_xe || ''} (${activeDup.hien_trang || 'Đang hoạt động'}) thuộc đơn vị "${unitName}"! Vui lòng kiểm tra lại.`);
        }

        // Chỉ trùng với xe đã thanh lý -> Hiện popup xác nhận tái cấp biển số
        const liquidatedDup = duplicateCars.find(xe => isLiquidatedCar(xe));
        if (liquidatedDup) {
          setReassignModal({
            isOpen: true,
            oldCar: liquidatedDup,
            pendingCarData: { ...carFormData },
            mode: modalMode
          });
          return;
        }
      }
    }

    // 2. Kiểm tra trùng lặp Số Khung (VIN/Chassis) trong danh mục
    const newChassis = String(carFormData.so_khung || '').trim().toUpperCase().replace(/[\s\-\.]/g, '');
    if (newChassis) {
      const dupCar = xeData.find(xe => {
        if ((modalMode === 'edit' || modalMode === 'update') && xe.id === carFormData.id) return false;
        const existingChassis = String(xe.so_khung || '').trim().toUpperCase().replace(/[\s\-\.]/g, '');
        return existingChassis === newChassis;
      });
      if (dupCar) {
        const unitName = donViMap[dupCar.id_don_vi] || dupCar.id_don_vi || '';
        const isOldCarLiquidated = isLiquidatedCar(dupCar);
        return toast.error(`Số khung "${carFormData.so_khung}" đã tồn tại trên xe Biển số: ${dupCar.bien_so || 'Chưa có BS'}${isOldCarLiquidated ? ' (Đã thanh lý)' : ''}${unitName ? ` (${unitName})` : ''}! Vui lòng kiểm tra lại.`);
      }
    }

    await saveCarFinal(carFormData, modalMode);
  };

  const executeSaveWithReassignedPlate = async () => {
    if (!reassignModal.pendingCarData || !reassignModal.oldCar) return;
    try {
      await saveCarFinal(reassignModal.pendingCarData, reassignModal.mode, reassignModal.oldCar);
      setReassignModal({ isOpen: false, oldCar: null, pendingCarData: null, mode: 'create' });
    } catch {
      // Error handled in saveCarFinal
    }
  };

  // 🟢 HÀM MỞ & XỬ LÝ ĐỔI TRẠNG THÁI XE (TAB HIỆN HỮU)
  const openStatusModal = (car: TS_Xe) => {
    setStatusModalCar(car);
    setNewStatus(car.hien_trang || 'Đang hoạt động');
    setLiquidationDate(car.ngay_thanh_ly || new Date().toISOString().split('T')[0]);
    setStatusReason('');
  };

  const handleSaveStatus = async () => {
    if (!statusModalCar) return;
    if (newStatus === 'Đã Thanh lý' && !liquidationDate) {
      return toast.warning("Vui lòng chọn Ngày thanh lý!");
    }
    setSubmitting(true);
    try {
      const isLiquidating = newStatus === 'Đã Thanh lý';
      const updatedCar: TS_Xe = {
        ...statusModalCar,
        hien_trang: newStatus,
        ngay_thanh_ly: isLiquidating ? liquidationDate : (statusModalCar.ngay_thanh_ly || null),
        ghi_chu: statusReason ? `${statusModalCar.ghi_chu ? `${statusModalCar.ghi_chu} | ` : ''}[${new Date().toLocaleDateString('vi-VN')} Đổi TT: ${newStatus}] ${statusReason}` : statusModalCar.ghi_chu
      };

      await apiService.save(updatedCar, 'update', 'ts_xe');

      // Ghi audit log
      await apiService.writeLog(
        isLiquidating ? 'THANH LÝ XE' : 'CẬP NHẬT TRẠNG THÁI XE',
        `Xe: ${statusModalCar.bien_so} (${statusModalCar.hieu_xe} ${statusModalCar.loai_xe}) | Trạng thái: "${statusModalCar.hien_trang}" -> "${newStatus}"${isLiquidating ? ` | Ngày thanh lý: ${liquidationDate}` : ''}${statusReason ? ` | Lý do: ${statusReason}` : ''}`
      );

      setXeData(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
      setStatusModalCar(null);

      if (isLiquidating) {
        toast.success(`Đã chuyển xe ${statusModalCar.bien_so} sang danh mục Thanh lý!`);
      } else {
        toast.success(`Cập nhật trạng thái xe ${statusModalCar.bien_so} thành "${newStatus}" thành công!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi cập nhật trạng thái xe!");
    } finally {
      setSubmitting(false);
    }
  };

  // 🟢 HÀM MỞ & XỬ LÝ XÓA VĨNH VIỄN XE THANH LÝ (TAB THANH LÝ)
  const openPermanentDeleteModal = (car: TS_Xe) => {
    setPermanentDeleteCar(car);
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteCar) return;
    setSubmitting(true);
    try {
      // 1. Ghi log kiểm toán lưu vết đầy đủ TRƯỚC KHI XÓA
      await apiService.writeLog(
        'XÓA CỨNG XE THANH LÝ',
        `Xóa vĩnh viễn xe thanh lý: Biển số: ${permanentDeleteCar.bien_so || ''} | Số khung: ${permanentDeleteCar.so_khung || ''} | Hiệu xe: ${permanentDeleteCar.hieu_xe || ''} ${permanentDeleteCar.loai_xe || ''} | Ngày thanh lý: ${formatDateDisplay(permanentDeleteCar.ngay_thanh_ly)} | Đơn vị: ${donViMap[permanentDeleteCar.id_don_vi] || permanentDeleteCar.id_don_vi} | Người thực hiện: ${user?.ten_nguoi_dung || user?.email || 'N/A'}`
      );

      // 2. Xử lý khóa ngoại: Xóa các bản ghi chi phí liên quan trước
      const costsToDelete = chiPhiData.filter(cp => getCostCarId(cp) === permanentDeleteCar.id);
      if (costsToDelete.length > 0) {
        for (const cp of costsToDelete) {
          const cpId = getCostId(cp);
          if (cpId) await apiService.delete(cpId, "cp_hoat_dong_xe");
        }
      }

      // 3. Xóa xe khỏi bảng ts_xe
      await apiService.delete(permanentDeleteCar.id, "ts_xe");

      // 4. Cập nhật state
      setXeData(prev => prev.filter(item => item.id !== permanentDeleteCar.id));
      setChiPhiData(prev => prev.filter(item => getCostCarId(item) !== permanentDeleteCar.id));

      toast.success(`Đã xóa vĩnh viễn xe ${permanentDeleteCar.bien_so} khỏi hệ thống!`);
      setPermanentDeleteCar(null);
    } catch (err: any) {
      toast.error(err.message || "Đã xảy ra lỗi khi xóa vĩnh viễn xe!");
    } finally {
      setSubmitting(false);
    }
  };

  const pasteColumns = useMemo<ColumnMapItem[]>(() => {
    const isUpdate = bulkImportMode === 'update';
    return [
      { label: 'STT', key: 'stt', type: 'number' },
      { label: 'VP Cty/Showroom', key: 'showroom_ref', type: 'text' },
      { label: 'Thương hiệu *', key: 'hieu_xe', type: 'text', required: !isUpdate },
      { label: 'Loại xe *', key: 'loai_xe', type: 'text', required: !isUpdate },
      { label: 'Năm sản xuất', key: 'nam_sx', type: 'number' },
      { label: 'Năm đăng ký', key: 'nam_dk', type: 'number' },
      { label: 'Biển số *', key: 'bien_so', type: 'text', required: true },
      { label: 'Màu sơn', key: 'mau_xe', type: 'text' },
      { label: 'Số Km hiện tại', key: 'km_hien_tai', type: 'number' },
      { label: 'Mục đích sử dụng *', key: 'muc_dich_su_dung', type: 'text', required: !isUpdate },
      { label: 'Chủ sở hữu', key: 'don_vi_chu_so_huu', type: 'text' },
      { label: 'Loại phương tiện *', key: 'loai_phuong_tien', type: 'text', required: !isUpdate },
      { label: 'Phiên bản', key: 'phien_ban', type: 'text' },
      { label: 'Số chỗ', key: 'so_cho', type: 'number' },
      { label: 'Tải trọng', key: 'tai_trong', type: 'text' },
      { label: 'Dung tích', key: 'dung_tich', type: 'text' },
      { label: 'Công thức bánh xe', key: 'cong_thuc_banh', type: 'text' },
      { label: 'Số khung', key: 'so_khung', type: 'text' },
      { label: 'Số máy', key: 'so_may', type: 'text' },
      { label: 'Mã tài sản', key: 'ma_tai_san', type: 'text' },
      { label: 'Nguyên giá', key: 'nguyen_gia', type: 'number' },
      { label: 'Hồ sơ xe (Link Drive)', key: 'ho_so_xe', type: 'text' }
    ];
  }, [bulkImportMode]);

  const handleValidatePasteRow = (row: any, allRows?: any[]) => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const isUpdate = bulkImportMode === 'update';

    // 1. Biển số xe: loại bỏ các ký tự đặc biệt để check trùng
    const plate = String(row.bien_so || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '');
    if (!plate) {
      errors.bien_so = 'Biển số không được để trống.';
    } else {
      const isDuplicateDb = xeData.some(x => String(x.bien_so || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '') === plate);

      if (isUpdate) {
        if (!isDuplicateDb) {
          errors.bien_so = `Biển số "${row.bien_so}" không tồn tại trong hệ thống, không thể cập nhật.`;
        } else {
          warnings.bien_so = `Hợp lệ (Sẽ cập nhật thông tin bổ sung).`;
        }
      } else {
        if (isDuplicateDb) {
          errors.bien_so = `Biển số "${row.bien_so}" đã tồn tại trong cơ sở dữ liệu.`;
        }
        if (allRows) {
          const dupCount = allRows.filter(r => String(r.bien_so || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '') === plate).length;
          if (dupCount > 1) {
            errors.bien_so = `Biển số "${row.bien_so}" bị trùng trong file dán.`;
          }
        }
      }
    }

    // 1.1. Số khung xe: kiểm tra trùng lặp
    const chassis = String(row.so_khung || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '');
    if (chassis) {
      const isDuplicateChassisDb = xeData.some(x => {
        if (isUpdate && plate && String(x.bien_so || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '') === plate) {
          return false;
        }
        return String(x.so_khung || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '') === chassis;
      });

      if (!isUpdate && isDuplicateChassisDb) {
        errors.so_khung = `Số khung "${row.so_khung}" đã tồn tại trong cơ sở dữ liệu.`;
      }
      if (allRows) {
        const dupChassisCount = allRows.filter(r => String(r.so_khung || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '') === chassis).length;
        if (dupChassisCount > 1) {
          errors.so_khung = `Số khung "${row.so_khung}" bị trùng lặp trong danh sách dán.`;
        }
      }
    }

    // 2. Đối chiếu thương hiệu & loại xe
    const brand = String(row.hieu_xe || '').trim().toUpperCase();
    if (row.hieu_xe) {
      const matchedBrandKey = Object.keys(VEHICLE_MODELS).find(b => b.toUpperCase() === brand);
      if (!matchedBrandKey) {
        warnings.hieu_xe = `Thương hiệu "${row.hieu_xe}" chưa có trong danh mục mẫu.`;
      } else {
        const model = String(row.loai_xe || '').trim().toUpperCase();
        const validModels = (VEHICLE_MODELS[matchedBrandKey] || []).map(m => m.toUpperCase());
        if (row.loai_xe && !validModels.includes(model)) {
          warnings.loai_xe = `Loại xe "${row.loai_xe}" không khớp với các mẫu của hãng ${matchedBrandKey}.`;
        }
      }
    }

    // 3. Mục đích sử dụng
    const validPurposes = ['Xe công', 'Xe lái thử', 'Xe Chuyên dụng', 'Xe cho thuê', 'Xe thay thế cho KH', 'Xe sửa chữa lưu động'];
    if (row.muc_dich_su_dung) {
      const matchedPurpose = validPurposes.find(p => p.toLowerCase() === String(row.muc_dich_su_dung).trim().toLowerCase());
      if (!matchedPurpose) {
        warnings.muc_dich_su_dung = `Mục đích "${row.muc_dich_su_dung}" không nằm trong danh mục chuẩn.`;
      }
    }

    const validTypes = ['Ô tô du lịch', 'Ô tô tải', 'Xe máy', 'Xe chuyên dụng'];
    if (row.loai_phuong_tien) {
      const matchedType = validTypes.find(t => t.toLowerCase() === String(row.loai_phuong_tien).trim().toLowerCase());
      if (!matchedType) {
        warnings.loai_phuong_tien = `Loại xe "${row.loai_phuong_tien}" không khớp danh mục mẫu.`;
      }
    }

    // 5. Kiểm tra năm sản xuất và năm đăng ký
    const currentYear = new Date().getFullYear();
    if (row.nam_sx) {
      const year = parseInt(row.nam_sx);
      if (isNaN(year) || year < 1900 || year > currentYear + 1) {
        errors.nam_sx = `Năm sản xuất không hợp lệ.`;
      }
    }
    if (row.nam_dk) {
      const year = parseInt(row.nam_dk);
      if (isNaN(year) || year < 1900 || year > currentYear + 1) {
        errors.nam_dk = `Năm đăng ký không hợp lệ.`;
      }
    }

    return { errors, warnings };
  };

  const handleBulkImportSave = async (data: any[]) => {
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;
    const targetDonViId = (selectedUnitFilter && selectedUnitFilter !== 'ALL')
      ? selectedUnitFilter
      : (defaultDonViId && defaultDonViId !== 'ALL' ? defaultDonViId : allowedDonViIds[0]);

    if (!targetDonViId) {
      toast.error("Không xác định được Đơn vị để thêm xe. Vui lòng chọn một Showroom/Đơn vị!");
      return;
    }

    const cleanCars: any[] = [];
    const createCosts: any[] = [];
    const updateCosts: any[] = [];

    const currentMonth = new Date().toISOString().slice(0, 7);
    const isUpdateMode = bulkImportMode === 'update';

    const validPurposes = ['Xe công', 'Xe lái thử', 'Xe Chuyên dụng', 'Xe cho thuê', 'Xe thay thế cho KH', 'Xe sửa chữa lưu động'];
    const validTypes = ['Ô tô du lịch', 'Ô tô tải', 'Xe máy', 'Xe chuyên dụng'];

    data.forEach((row, idx) => {
      const cleanPlate = String(row.bien_so || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '');
      if (!cleanPlate) return;

      // Chuẩn hóa Thương hiệu
      let brand = row.hieu_xe !== undefined && row.hieu_xe !== null ? String(row.hieu_xe).trim() : null;
      if (brand) {
        const matchedBrandKey = Object.keys(VEHICLE_MODELS).find(b => b.toUpperCase() === brand!.toUpperCase());
        if (matchedBrandKey) brand = matchedBrandKey;
        else brand = brand.toUpperCase();
      }

      // Chuẩn hóa Loại xe
      let model = row.loai_xe !== undefined && row.loai_xe !== null ? String(row.loai_xe).trim() : null;
      if (model && brand) {
        const matchedBrandKey = Object.keys(VEHICLE_MODELS).find(b => b.toUpperCase() === brand!.toUpperCase());
        if (matchedBrandKey) {
          const matchedModel = (VEHICLE_MODELS[matchedBrandKey] || []).find(m => m.toUpperCase() === model!.toUpperCase());
          if (matchedModel) model = matchedModel;
        }
      }

      // Chuẩn hóa Mục đích
      let purpose = row.muc_dich_su_dung !== undefined && row.muc_dich_su_dung !== null ? String(row.muc_dich_su_dung).trim() : null;
      if (purpose) {
        const matchedPurpose = validPurposes.find(p => p.toLowerCase() === purpose!.toLowerCase());
        if (matchedPurpose) purpose = matchedPurpose;
      }

      // Chuẩn hóa Loại phương tiện
      let type = row.loai_phuong_tien !== undefined && row.loai_phuong_tien !== null ? String(row.loai_phuong_tien).trim() : null;
      if (type) {
        const matchedType = validTypes.find(t => t.toLowerCase() === type!.toLowerCase());
        if (matchedType) type = matchedType;
      }

      const namSx = row.nam_sx !== undefined && row.nam_sx !== null && String(row.nam_sx).trim() !== '' ? parseInt(String(row.nam_sx)) : null;
      const namDk = row.nam_dk !== undefined && row.nam_dk !== null && String(row.nam_dk).trim() !== '' ? parseInt(String(row.nam_dk)) : null;
      const soCho = row.so_cho !== undefined && row.so_cho !== null && String(row.so_cho).trim() !== '' ? parseInt(String(row.so_cho)) : null;

      // Số Km hiện tại
      let km: number | null = null;
      if (row.km_hien_tai !== undefined && row.km_hien_tai !== null && String(row.km_hien_tai).trim() !== '') {
        let rawStr = String(row.km_hien_tai).trim();
        if (rawStr.includes('.') && !rawStr.includes(',')) {
          const parts = rawStr.split('.');
          if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            rawStr = rawStr.replace(/\./g, '');
          }
        }
        rawStr = rawStr.replace(/,/g, '');
        const parsed = parseFloat(rawStr);
        if (!isNaN(parsed) && parsed >= 0) km = parsed;
      }

      // Nguyên giá
      let nguyenGia: number | null = null;
      if (row.nguyen_gia !== undefined && row.nguyen_gia !== null && String(row.nguyen_gia).trim() !== '') {
        let rawStr = String(row.nguyen_gia).trim();
        if (rawStr.includes('.') && !rawStr.includes(',')) {
          const parts = rawStr.split('.');
          if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            rawStr = rawStr.replace(/\./g, '');
          }
        }
        rawStr = rawStr.replace(/,/g, '');
        const parsed = parseFloat(rawStr);
        if (!isNaN(parsed) && parsed >= 0) nguyenGia = parsed;
      }

      if (isUpdateMode) {
        const existingCar = xeData.find(x => String(x.bien_so || '').trim().toUpperCase().replace(/[\s\-\.,]/g, '') === cleanPlate);
        if (!existingCar) return;

        // Chỉ cập nhật các trường có giá trị dán lên (không rỗng/null)
        const updatedCar = { ...existingCar };

        if (brand !== null) updatedCar.hieu_xe = brand;
        if (model !== null) updatedCar.loai_xe = model;
        if (namSx !== null) updatedCar.nam_sx = namSx;
        if (namDk !== null) updatedCar.nam_dk = namDk;
        if (row.mau_xe !== undefined && row.mau_xe !== null && String(row.mau_xe).trim() !== '') {
          updatedCar.mau_xe = String(row.mau_xe).trim().toUpperCase();
        }
        if (purpose !== null) updatedCar.muc_dich_su_dung = purpose;
        if (row.don_vi_chu_so_huu !== undefined && row.don_vi_chu_so_huu !== null && String(row.don_vi_chu_so_huu).trim() !== '') {
          updatedCar.don_vi_chu_so_huu = String(row.don_vi_chu_so_huu).trim().toUpperCase();
        }
        if (type !== null) updatedCar.loai_phuong_tien = type;
        if (row.phien_ban !== undefined && row.phien_ban !== null && String(row.phien_ban).trim() !== '') {
          updatedCar.phien_ban = String(row.phien_ban).trim().toUpperCase();
        }
        if (soCho !== null) updatedCar.so_cho = soCho;
        if (row.tai_trong !== undefined && row.tai_trong !== null && String(row.tai_trong).trim() !== '') {
          updatedCar.tai_trong = String(row.tai_trong).trim();
        }
        if (row.loai_nhien_lieu !== undefined && row.loai_nhien_lieu !== null && String(row.loai_nhien_lieu).trim() !== '') {
          updatedCar.loai_nhien_lieu = String(row.loai_nhien_lieu).trim().toUpperCase();
        }
        if (row.dung_tich !== undefined && row.dung_tich !== null && String(row.dung_tich).trim() !== '') {
          updatedCar.dung_tich = String(row.dung_tich).trim();
        }
        if (row.cong_thuc_banh !== undefined && row.cong_thuc_banh !== null && String(row.cong_thuc_banh).trim() !== '') {
          updatedCar.cong_thuc_banh = String(row.cong_thuc_banh).trim().toUpperCase();
        }
        if (row.so_khung !== undefined && row.so_khung !== null && String(row.so_khung).trim() !== '') {
          updatedCar.so_khung = String(row.so_khung).trim().toUpperCase();
        }
        if (row.so_may !== undefined && row.so_may !== null && String(row.so_may).trim() !== '') {
          updatedCar.so_may = String(row.so_may).trim().toUpperCase();
        }
        if (row.ma_tai_san !== undefined && row.ma_tai_san !== null && String(row.ma_tai_san).trim() !== '') {
          updatedCar.ma_tai_san = String(row.ma_tai_san).trim().toUpperCase();
        }
        if (nguyenGia !== null) {
          updatedCar.nguyen_gia = nguyenGia;
        }
        if (row.ho_so_xe !== undefined && row.ho_so_xe !== null && String(row.ho_so_xe).trim() !== '') {
          updatedCar.ho_so_xe = String(row.ho_so_xe).trim();
        }

        cleanCars.push(updatedCar);

        // Cập nhật số Km nếu có
        if (km !== null) {
          const existingCost = chiPhiData.find(cp => getCostCarId(cp) === existingCar.id && cp.thang_nam === currentMonth);
          if (existingCost) {
            updateCosts.push({
              ...existingCost,
              km_hien_tai: km
            });
          } else {
            createCosts.push({
              id: `CP-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`,
              id_don_vi: existingCar.id_don_vi || targetDonViId,
              thang_nam: currentMonth,
              id_ts_xe: existingCar.id,
              km_hien_tai: km,
              so_lit_nhien_lieu: 0,
              cp_nhien_lieu: 0,
              cp_cau_duong_ben_bai: 0,
              cp_rua_xe: 0,
              cp_bao_duong_sua_chua: 0,
              cp_thue_khau_hao: 0,
              cp_dang_kiem: 0,
              cp_bh_tnds: 0,
              cp_bh_vc: 0,
              ghi_chu: 'Khởi tạo Số Km hiện tại khi dán bổ sung'
            });
          }
        }

      } else {
        const carId = `XE-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`;
        const newCar: TS_Xe = {
          id: carId,
          id_don_vi: targetDonViId,
          muc_dich_su_dung: purpose || 'Xe công',
          dia_diem_su_dung: '',
          ma_tai_san: row.ma_tai_san ? String(row.ma_tai_san).trim().toUpperCase() : '',
          don_vi_chu_so_huu: String(row.don_vi_chu_so_huu || '').trim().toUpperCase(),
          nguyen_gia: nguyenGia,
          cp_thue_khau_hao: null,
          bien_so: cleanPlate,
          loai_phuong_tien: type || 'Ô tô du lịch',
          hieu_xe: brand || '',
          loai_xe: model || '',
          phien_ban: String(row.phien_ban || '').trim().toUpperCase(),
          mau_xe: String(row.mau_xe || '').trim().toUpperCase(),
          nam_sx: namSx,
          nam_dk: namDk,
          so_khung: String(row.so_khung || '').trim().toUpperCase(),
          so_may: String(row.so_may || '').trim().toUpperCase(),
          so_cho: soCho,
          tai_trong: row.tai_trong ? String(row.tai_trong).trim() : null,
          kich_thuoc_xe: null,
          kich_thuoc_thung: null,
          loai_nhien_lieu: String(row.loai_nhien_lieu || 'Xăng').trim().toUpperCase(),
          dung_tich: String(row.dung_tich || '').trim(),
          cong_thuc_banh: String(row.cong_thuc_banh || '').trim().toUpperCase(),
          hinh_thuc_so_huu: 'Sở hữu',
          gps: 'Có',
          hien_trang: 'Đang hoạt động',
          ghi_chu: 'Nhập hàng loạt từ Excel',
          han_dang_kiem: null,
          han_bh_tnds: null,
          han_bh_vc: null,
          ho_so_xe: row.ho_so_xe && String(row.ho_so_xe).trim() !== '' ? String(row.ho_so_xe).trim() : null
        };
        cleanCars.push(newCar);

        if (km !== null) {
          createCosts.push({
            id: `CP-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`,
            id_don_vi: targetDonViId,
            thang_nam: currentMonth,
            id_ts_xe: carId,
            km_hien_tai: km,
            so_lit_nhien_lieu: 0,
            cp_nhien_lieu: 0,
            cp_cau_duong_ben_bai: 0,
            cp_rua_xe: 0,
            cp_bao_duong_sua_chua: 0,
            cp_thue_khau_hao: 0,
            cp_dang_kiem: 0,
            cp_bh_tnds: 0,
            cp_bh_vc: 0,
            ghi_chu: 'Khởi tạo Số Km hiện tại khi thêm hàng loạt'
          });
        }
      }
    });

    setSubmitting(true);
    try {
      if (isUpdateMode) {
        const savedCars = await apiService.save(cleanCars, 'update', 'ts_xe');
        const responseCars = Array.isArray(savedCars) ? savedCars : cleanCars;

        setXeData(prev => prev.map(item => {
          const matched = responseCars.find(c => c.id === item.id);
          return matched ? matched : item;
        }));

        let totalKmCreatedUpdated = 0;
        if (createCosts.length > 0) {
          const savedCosts = await apiService.save(createCosts, 'create', 'cp_hoat_dong_xe');
          const responseCosts = Array.isArray(savedCosts) ? savedCosts : createCosts;
          setChiPhiData(prev => [...responseCosts, ...prev]);
          totalKmCreatedUpdated += createCosts.length;
        }
        if (updateCosts.length > 0) {
          const savedCosts = await apiService.save(updateCosts, 'update', 'cp_hoat_dong_xe');
          const responseCosts = Array.isArray(savedCosts) ? savedCosts : updateCosts;
          setChiPhiData(prev => prev.map(item => {
            const matched = responseCosts.find(c => getCostId(c) === getCostId(item));
            return matched ? matched : item;
          }));
          totalKmCreatedUpdated += updateCosts.length;
        }

        if (totalKmCreatedUpdated > 0) {
          toast.info(`Đã cập nhật số Km hiện tại cho ${totalKmCreatedUpdated} xe.`);
        }
        toast.success(`Đã cập nhật thành công thông tin cho ${cleanCars.length} phương tiện!`);

      } else {
        const savedCars = await apiService.save(cleanCars, 'create', 'ts_xe');
        const responseCars = Array.isArray(savedCars) ? savedCars : cleanCars;
        setXeData(prev => [...responseCars, ...prev]);

        if (createCosts.length > 0) {
          const savedCosts = await apiService.save(createCosts, 'create', 'cp_hoat_dong_xe');
          const responseCosts = Array.isArray(savedCosts) ? savedCosts : createCosts;
          setChiPhiData(prev => [...responseCosts, ...prev]);
          toast.info(`Đã khởi tạo số Km ban đầu cho ${createCosts.length} xe.`);
        }
        toast.success(`Đã nhập thành công ${cleanCars.length} phương tiện xe mới!`);
      }

      setIsBulkImportOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi lưu danh sách xe hàng loạt!");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── TỰ ĐỘNG GỢI Ý & ĐIỀN TRƯỚC THÔNG SỐ KỸ THUẬT XE ────────────────────────
  const applySuggestedSpecs = (
    currentData: any,
    brand: string,
    model: string,
    vehicleType: string,
    forceOverwrite: boolean = false
  ) => {
    const suggested = getSuggestedSpecs(vehicleType, brand, model, xeData);
    if (!suggested) {
      setSpecSuggestionInfo(null);
      return currentData;
    }

    const { specs, source } = suggested;
    const isTruck = vehicleType === 'Ô tô tải';
    const shouldFill = (val: any) => forceOverwrite || val === '' || val === null || val === undefined;

    const curKichThuocXe = typeof currentData.kich_thuoc_xe === 'object' && currentData.kich_thuoc_xe !== null
      ? currentData.kich_thuoc_xe
      : parseKichThuoc(currentData.kich_thuoc_xe);

    const nextKichThuocXe = { ...curKichThuocXe };
    if (specs.kich_thuoc_xe) {
      if (shouldFill(nextKichThuocXe.dai) && specs.kich_thuoc_xe.dai) nextKichThuocXe.dai = String(specs.kich_thuoc_xe.dai);
      if (shouldFill(nextKichThuocXe.rong) && specs.kich_thuoc_xe.rong) nextKichThuocXe.rong = String(specs.kich_thuoc_xe.rong);
      if (shouldFill(nextKichThuocXe.cao) && specs.kich_thuoc_xe.cao) nextKichThuocXe.cao = String(specs.kich_thuoc_xe.cao);
    }

    const curKichThuocThung = typeof currentData.kich_thuoc_thung === 'object' && currentData.kich_thuoc_thung !== null
      ? currentData.kich_thuoc_thung
      : parseKichThuoc(currentData.kich_thuoc_thung);

    const nextKichThuocThung = { ...curKichThuocThung };
    if (isTruck && specs.kich_thuoc_thung) {
      if (shouldFill(nextKichThuocThung.dai) && specs.kich_thuoc_thung.dai) nextKichThuocThung.dai = String(specs.kich_thuoc_thung.dai);
      if (shouldFill(nextKichThuocThung.rong) && specs.kich_thuoc_thung.rong) nextKichThuocThung.rong = String(specs.kich_thuoc_thung.rong);
      if (shouldFill(nextKichThuocThung.cao) && specs.kich_thuoc_thung.cao) nextKichThuocThung.cao = String(specs.kich_thuoc_thung.cao);
    }

    const nextData = {
      ...currentData,
      so_cho: shouldFill(currentData.so_cho) && specs.so_cho ? specs.so_cho : currentData.so_cho,
      dung_tich: shouldFill(currentData.dung_tich) && specs.dung_tich ? specs.dung_tich : currentData.dung_tich,
      cong_thuc_banh: shouldFill(currentData.cong_thuc_banh) && specs.cong_thuc_banh ? specs.cong_thuc_banh : currentData.cong_thuc_banh,
      kich_thuoc_xe: nextKichThuocXe,
      ...(isTruck ? {
        tai_trong: shouldFill(currentData.tai_trong) && specs.tai_trong ? specs.tai_trong : currentData.tai_trong,
        kich_thuoc_thung: nextKichThuocThung,
      } : {}),
      ...(shouldFill(currentData.loai_nhien_lieu) || currentData.loai_nhien_lieu === 'Xăng' ? {
        loai_nhien_lieu: specs.loai_nhien_lieu || currentData.loai_nhien_lieu || 'Xăng'
      } : {})
    };

    setSpecSuggestionInfo({
      brand,
      model,
      source: source === 'history' ? 'dữ liệu xe đã có' : 'mẫu chuẩn'
    });

    return nextData;
  };

  const handleReapplySpecs = (force: boolean = true) => {
    if (!carFormData.hieu_xe || !carFormData.loai_xe) {
      toast.info("Vui lòng chọn Hiệu xe và Loại xe trước.");
      return;
    }
    const updated = applySuggestedSpecs(carFormData, carFormData.hieu_xe, carFormData.loai_xe, carFormData.loai_phuong_tien, force);
    setCarFormData(updated);
    toast.success(`Đã áp dụng thông số mẫu cho ${carFormData.hieu_xe} ${carFormData.loai_xe}!`);
  };

  const handleInputCarChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'bien_so') {
      if (/[\s\-\.]/.test(value)) { setPlateError(true); setTimeout(() => setPlateError(false), 4000); }
      const cleanPlate = value.toUpperCase().replace(/[\s\-\.]/g, '');
      setCarFormData(prev => ({ ...prev, [name]: cleanPlate })); return;
    }
    if (name === 'dia_diem_su_dung') {
      setCarFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
      return;
    }
    if (name === 'so_khung') {
      const cleanChassis = value.toUpperCase().replace(/\s+/g, '');
      if (cleanChassis) {
        const dupCar = xeData.find(xe => {
          if ((modalMode === 'edit' || modalMode === 'update') && xe.id === carFormData.id) return false;
          const existingChassis = String(xe.so_khung || '').trim().toUpperCase().replace(/[\s\-\.]/g, '');
          return existingChassis === cleanChassis.replace(/[\s\-\.]/g, '');
        });
        if (dupCar) {
          const unitName = donViMap[dupCar.id_don_vi] || dupCar.id_don_vi || '';
          setChassisError({
            isDuplicate: true,
            carInfo: `Xe BS: ${dupCar.bien_so || 'Chưa có BS'}${unitName ? ` - ${unitName}` : ''}`
          });
        } else {
          setChassisError({ isDuplicate: false });
        }
      } else {
        setChassisError({ isDuplicate: false });
      }
      setCarFormData(prev => ({ ...prev, [name]: cleanChassis }));
      return;
    }
    if (name === 'hieu_xe') {
      const models = VEHICLE_MODELS[value] || [];
      setCarFormData(prev => {
        const newLoaiXe = models.includes(prev.loai_xe || '') ? (prev.loai_xe || '') : '';
        let nextState = {
          ...prev,
          hieu_xe: value,
          loai_xe: newLoaiXe
        };
        if (value && newLoaiXe) {
          nextState = applySuggestedSpecs(nextState, value, newLoaiXe, nextState.loai_phuong_tien);
        } else {
          setSpecSuggestionInfo(null);
        }
        return nextState;
      });
      return;
    }
    if (name === 'loai_xe') {
      setCarFormData(prev => {
        let nextState = { ...prev, loai_xe: value };
        if (value && prev.hieu_xe) {
          nextState = applySuggestedSpecs(nextState, prev.hieu_xe, value, nextState.loai_phuong_tien);
        } else {
          setSpecSuggestionInfo(null);
        }
        return nextState;
      });
      return;
    }
    if (name === 'loai_phuong_tien') {
      setCarFormData(prev => {
        let nextState = { ...prev, loai_phuong_tien: value };
        if (prev.hieu_xe && prev.loai_xe) {
          nextState = applySuggestedSpecs(nextState, prev.hieu_xe, prev.loai_xe, value);
        }
        return nextState;
      });
      return;
    }
    if (name === 'nguyen_gia' || name === 'cp_thue_khau_hao') {
      setCarFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '') })); return;
    }
    setCarFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDimChange = (dimField: 'kich_thuoc_xe' | 'kich_thuoc_thung', axis: 'dai' | 'rong' | 'cao', val: string) => {
    const cleanNum = val.replace(/\D/g, '');
    setCarFormData(prev => ({
      ...prev,
      [dimField]: {
        ...(typeof prev[dimField] === 'object' && prev[dimField] !== null ? prev[dimField] : {}),
        [axis]: cleanNum
      }
    }));
  };

  // --- XỬ LÝ CHI PHÍ VÀ MÁY TÍNH INLINE ---
  const carCosts = useMemo(() => {
    if (!selectedCarForCost) return [];
    return chiPhiData.filter(cp => getCostCarId(cp) === selectedCarForCost.id).sort((a, b) => b.thang_nam.localeCompare(a.thang_nam));
  }, [chiPhiData, selectedCarForCost]);

  const viewHistoryCosts = useMemo(() => {
    if (!viewData) return [];
    return chiPhiData.filter(cp => getCostCarId(cp) === viewData.id).sort((a, b) => a.thang_nam.localeCompare(b.thang_nam));
  }, [chiPhiData, viewData]);

  const openCostModal = (car: TS_Xe) => {
    setSelectedCarForCost(car); setCostModal(prev => ({ ...prev, mode: 'create' }));
    setCostFormData({
      id: '', thang_nam: new Date().toISOString().slice(0, 7), id_ts_xe: car.id, id_don_vi: car.id_don_vi,
      km_hien_tai: '', so_lit_nhien_lieu: '', cp_nhien_lieu: '', cp_cau_duong_ben_bai: '', cp_rua_xe: '', cp_bao_duong_sua_chua: '', cp_thue_khau_hao: '',
      cp_dang_kiem: '', cp_bh_tnds: '', cp_bh_vc: '', ghi_chu: '' // 🟢 Thêm 3 cột chi phí
    });
    setCostModal(prev => ({ ...prev, isOpen: true }));
  };

  const editCost = (cost: any) => {
    setCostModal(prev => ({ ...prev, mode: 'update' }));
    setCostFormData({ ...cost, id: getCostId(cost), id_ts_xe: getCostCarId(cost), id_don_vi: cost.id_don_vi || selectedCarForCost?.id_don_vi || '' });
  };

  const handleInputCostChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'km_hien_tai') {
      finalValue = value.replace(/\D/g, '');
    } else if (['cp_nhien_lieu', 'cp_cau_duong_ben_bai', 'cp_rua_xe', 'cp_bao_duong_sua_chua', 'cp_thue_khau_hao', 'cp_dang_kiem', 'cp_bh_tnds', 'cp_bh_vc'].includes(name)) {
      finalValue = value.replace(/[^0-9+\-*/().\s]/g, '');
    }

    setCostFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleCostMathBlur = (name: string, value: string) => {
    setCostFormData(prev => ({ ...prev, [name]: safeEvalMath(value) }));
  };

  const handleCostMathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, name: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCostMathBlur(name, e.currentTarget.value);
    }
  };

  const handleCostSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      let finalData = { ...costFormData };

      // Xử lý tính toán công thức cho toàn bộ cột chi phí
      const costFields = ['cp_nhien_lieu', 'cp_cau_duong_ben_bai', 'cp_rua_xe', 'cp_bao_duong_sua_chua', 'cp_thue_khau_hao', 'cp_dang_kiem', 'cp_bh_tnds', 'cp_bh_vc'];
      costFields.forEach(field => {
        finalData[field] = safeEvalMath(finalData[field]);
      });

      if (costModalMode === 'create' && !finalData.id) {
        finalData.id = `CP-${Date.now()}`;
      }

      const response = await apiService.save(finalData, costModalMode, "cp_hoat_dong_xe");
      const savedId = response?.id || response?.newId || finalData.id;
      const savedCost = { ...finalData, id: savedId };

      if (costModalMode === 'create') {
        setChiPhiData(prev => [savedCost, ...prev]);
      } else {
        setChiPhiData(prev => prev.map(item => getCostId(item) === finalData.id ? savedCost : item));
      }

      setCostModal(prev => ({ ...prev, mode: 'create' }));
      setCostFormData({
        id: '', thang_nam: costFormData.thang_nam, id_ts_xe: selectedCarForCost?.id || '', id_don_vi: selectedCarForCost?.id_don_vi || '',
        km_hien_tai: '', so_lit_nhien_lieu: '', cp_nhien_lieu: '', cp_cau_duong_ben_bai: '', cp_rua_xe: '', cp_bao_duong_sua_chua: '', cp_thue_khau_hao: '',
        cp_dang_kiem: '', cp_bh_tnds: '', cp_bh_vc: '', ghi_chu: ''
      });
      toast.success(costModalMode === 'create' ? "Đã lưu chi phí!" : "Đã cập nhật chi phí!");

    } catch (err: any) {
      setError(err.message || 'Lỗi lưu dữ liệu Chi phí.');
      toast.error(err.message || "Đã xảy ra lỗi khi lưu chi phí xe!");
    } finally {
      setSubmitting(false);
    }
  };

  const chartScale = useMemo(() => {
    if (viewHistoryCosts.length === 0) return { maxCP: 1, maxKm: 1 };
    const costs = viewHistoryCosts.map(c =>
      (Number(c.cp_nhien_lieu) || 0) + (Number(c.cp_cau_duong_ben_bai) || 0) + (Number(c.cp_rua_xe) || 0) +
      (Number(c.cp_bao_duong_sua_chua) || 0) + (Number(c.cp_thue_khau_hao) || 0) +
      (Number(c.cp_dang_kiem) || 0) + (Number(c.cp_bh_tnds) || 0) + (Number(c.cp_bh_vc) || 0)
    );
    const kms = viewHistoryCosts.map(c => Number(c.km_hien_tai) || 0);
    return { maxCP: Math.max(...costs, 1), maxKm: Math.max(...kms, 1) };
  }, [viewHistoryCosts]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      if (itemToDelete.type === 'xe') {
        const costsToDelete = chiPhiData.filter(cp => getCostCarId(cp) === itemToDelete.id);
        if (costsToDelete.length > 0) {
          for (const cp of costsToDelete) {
            const cpId = getCostId(cp);
            if (cpId) await apiService.delete(cpId, "cp_hoat_dong_xe");
          }
        }
        await apiService.delete(itemToDelete.id, "ts_xe");
        setXeData(prev => prev.filter(item => item.id !== itemToDelete.id));
        setChiPhiData(prev => prev.filter(item => getCostCarId(item) !== itemToDelete.id));
        toast.success("Xóa thông định xe thành công!");
      } else {
        await apiService.delete(itemToDelete.id, "cp_hoat_dong_xe");
        setChiPhiData(prev => prev.filter(item => getCostId(item) !== itemToDelete.id));
        toast.success("Xóa chi phí hoạt động thành công!");
      }
      setIsConfirmOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi xóa dữ liệu.');
      toast.error(err.message || "Đã xảy ra lỗi khi xóa dữ liệu!");
    } finally {
      setSubmitting(false);
    }
  };

  const getUnitFullName = (id: string) => {
    const unit = donViList.find(u => u.id === id);
    if (!unit) return '-';

    const ancestors: string[] = [];
    let currParentId = unit.cap_quan_ly;
    let depth = 0;
    while (currParentId && currParentId !== 'HO' && depth < 5) {
      const p = donViList.find(u => u.id === currParentId);
      if (p) {
        ancestors.push(p.ten_don_vi);
        currParentId = p.cap_quan_ly;
      } else {
        break;
      }
      depth++;
    }

    if (ancestors.length > 0) {
      return `${unit.ten_don_vi} (Trực thuộc: ${ancestors.join(' - ')})`;
    }
    return unit.ten_don_vi;
  };

  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all" title="Mở danh sách đơn vị"><PanelLeftOpen size={20} /></button>
      )}

      <UnitFilterSidebar
        donViList={donViList}
        selectedUnitFilter={selectedUnitFilter}
        setSelectedUnitFilter={setSelectedUnitFilter}
        allowedDonViIds={allowedDonViIds}
        unitSearchTerm={unitSearchTerm}
        setUnitSearchTerm={setUnitSearchTerm}
        expandedParents={expandedParents}
        setExpandedParents={setExpandedParents}
        isListCollapsed={isListCollapsed}
        setIsListCollapsed={setIsListCollapsed}
        themeColor="blue"
        allUnitsLabel="Xe tại tất cả các Đơn vị"
      />

      {/* --- CỘT PHẢI (DANH SÁCH XE) --- */}
      <div className="flex-1 min-w-0 max-w-full overflow-hidden p-4 sm:p-6 relative transition-all duration-300 w-full flex flex-col">

        {/* FIXED HEADER & WARNINGS */}
        <div className="shrink-0 flex flex-col z-30">
          <div className={`flex flex-col md:flex-row justify-between items-start mb-4 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            {/* Cột trái: Tiêu đề & Thông tin đơn vị */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {isListCollapsed && (
                <button
                  onClick={() => setIsListCollapsed(false)}
                  className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all flex items-center justify-center shrink-0"
                  title="Mở bộ lọc đơn vị"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Car size={28} /> Quản lý Xe Demo/Mobile Service</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({activeCarsCount} xe hiện hữu{liquidatedCarsCount > 0 ? `, ${liquidatedCarsCount} đã thanh lý` : ''})</p>
              </div>
            </div>

            {/* Cột phải: Tìm kiếm, Thêm xe mới và Bộ lọc bên dưới */}
            <div className="flex flex-col items-stretch md:items-end gap-3 w-full md:w-auto shrink-0">
              <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto relative z-30">
                {/* Ô tìm kiếm 256 x 32 px */}
                <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Tìm Biển số, Mã tài sản, Hiệu xe, Số khung..."
                    className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                    value={carSearchTerm}
                    onChange={(e) => setCarSearchTerm(e.target.value)}
                    onPaste={handlePasteSearch}
                  />
                </div>

                {/* Nút Đồng bộ dữ liệu (24 x 24 px) */}
                <button
                  onClick={() => {
                    loadData();
                    toast.success('Đang đồng bộ dữ liệu xe mới nhất từ Supabase...');
                  }}
                  title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                  disabled={loading}
                  className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white hover:bg-gray-50 text-gray-700 hover:text-[#05469B] rounded-md border border-gray-200 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
                >
                  <RotateCcw size={13} className={loading ? 'animate-spin text-[#05469B]' : ''} />
                </button>

                {/* Nút Tính năng (119 x 32 px) - Màu xanh dương đặc trưng */}
                <div className="relative z-[99]" ref={dropdownRef}>
                  <button
                    onClick={() => setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen)}
                    className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${isFeaturesDropdownOpen || showAdvancedFilters
                      ? 'bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white border-[#05469B] shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-[#05469B]'
                      }`}
                  >
                    <Sparkles size={14} className={isFeaturesDropdownOpen || showAdvancedFilters ? 'text-amber-300 animate-pulse' : 'text-[#05469B] dark:text-blue-400'} />
                    <span>Tính năng</span>
                    {(filterBrand || filterModel || filterPurpose || filterStatus) && !showAdvancedFilters && (
                      <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        {[filterBrand, filterModel, filterPurpose, filterStatus].filter(Boolean).length}
                      </span>
                    )}
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isFeaturesDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[40]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 p-2 z-[50] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                        {/* 1. Lọc nâng cao */}
                        <button
                          onClick={() => {
                            setShowAdvancedFilters(!showAdvancedFilters);
                            setIsFeaturesDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${showAdvancedFilters
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${showAdvancedFilters ? 'bg-amber-500 text-white' : 'bg-blue-50 dark:bg-slate-800 text-[#05469B] dark:text-blue-400'}`}>
                              <Filter size={14} />
                            </div>
                            <span>Lọc nâng cao</span>
                          </div>
                          {(filterBrand || filterModel || filterPurpose || filterStatus) ? (
                            <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              {[filterBrand, filterModel, filterPurpose, filterStatus].filter(Boolean).length}
                            </span>
                          ) : (
                            <ChevronRight size={14} className="text-gray-400" />
                          )}
                        </button>

                        <div className="border-t border-gray-100 dark:border-slate-800 my-1"></div>

                        {/* 2. Thêm từng xe */}
                        <button
                          onClick={() => {
                            openCarModal('create');
                            setIsFeaturesDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center gap-2.5 transition-all cursor-pointer"
                        >
                          <div className="p-1.5 bg-blue-50 dark:bg-slate-800 text-[#05469B] dark:text-blue-400 rounded-lg">
                            <Car size={14} />
                          </div>
                          <span>Thêm từng xe</span>
                        </button>

                        {/* 3. Thêm hàng loạt */}
                        <button
                          onClick={() => {
                            setBulkImportMode('create');
                            setIsBulkImportOpen(true);
                            setIsFeaturesDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center gap-2.5 transition-all cursor-pointer"
                        >
                          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <Plus size={14} />
                          </div>
                          <span>Thêm hàng loạt</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 🟢 KHUNG BỘ LỌC NÂNG CAO (ẨN / HIỆN KHI BẤM "LỌC NÂNG CAO") */}
          {showAdvancedFilters && activeTab === 'list' && (
            <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm mb-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 dark:bg-slate-800 text-[#05469B] dark:text-blue-400 rounded-lg">
                    <Filter size={16} className="shrink-0" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#05469B] dark:text-blue-400">Bộ lọc nâng cao</span>
                  {(filterBrand || filterModel || filterPurpose || filterStatus) && (
                    <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full animate-in fade-in duration-200">
                      Đang lọc ({[filterBrand, filterModel, filterPurpose, filterStatus].filter(Boolean).length} tiêu chí)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(filterBrand || filterModel || filterPurpose || filterStatus) && (
                    <button
                      onClick={() => {
                        setFilterBrand('');
                        setFilterModel('');
                        setFilterPurpose('');
                        setFilterStatus('');
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      <RotateCcw size={13} /> Xóa bộ lọc
                    </button>
                  )}
                  <button
                    onClick={() => setShowAdvancedFilters(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Ẩn khung bộ lọc"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Lưới 4 slicer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Hãng xe */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <span>🏭</span> Hãng xe ({Object.keys(VEHICLE_MODELS).length})
                  </label>
                  <select
                    value={filterBrand}
                    onChange={e => { setFilterBrand(e.target.value); setFilterModel(''); }}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none transition-all cursor-pointer ${filterBrand
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#05469B]/20'
                      }`}
                  >
                    <option value="">Tất cả Hãng</option>
                    {Object.keys(VEHICLE_MODELS).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* 2. Loại xe */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <span>🚗</span> Loại xe ({modelFilterOptions.length})
                  </label>
                  <select
                    value={filterModel}
                    onChange={e => setFilterModel(e.target.value)}
                    disabled={modelFilterOptions.length === 0}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none transition-all cursor-pointer ${filterModel
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#05469B]/20'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <option value="">Tất cả Loại xe</option>
                    {modelFilterOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* 3. Mục đích sử dụng */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <span>🎯</span> Mục đích sử dụng
                  </label>
                  <select
                    value={filterPurpose}
                    onChange={e => setFilterPurpose(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none transition-all cursor-pointer ${filterPurpose
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#05469B]/20'
                      }`}
                  >
                    <option value="">Tất cả Mục đích</option>
                    <option value="Xe công">Xe công</option>
                    <option value="Xe lái thử">Xe lái thử</option>
                    <option value="Xe Chuyên dụng">Xe Chuyên dụng</option>
                    <option value="Xe cho thuê">Xe cho thuê</option>
                    <option value="Xe thay thế cho KH">Xe thay thế cho KH</option>
                    <option value="Xe sửa chữa lưu động">Xe sửa chữa lưu động</option>
                  </select>
                </div>

                {/* 4. Tình trạng */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <span>🛡️</span> Tình trạng
                  </label>
                  {vehicleSubTab === 'active' ? (
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none transition-all cursor-pointer ${filterStatus
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#05469B]/20'
                        }`}
                    >
                      <option value="">Tất cả Tình trạng</option>
                      <option value="Đang hoạt động">Đang hoạt động</option>
                      <option value="Sửa chữa">Sửa chữa</option>
                      <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                      <option value="Chuyển KD xe QSD">Chuyển KD xe QSD</option>
                    </select>
                  ) : (
                    <div className="w-full text-xs font-bold rounded-xl px-3 py-2 border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 flex items-center gap-1.5">
                      ⚫ Đã Thanh lý
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 🟢 KHU VỰC TAB PHÂN CẤP LỒNG KHỐI LIỀN MẠCH (#005698) CHUẨN NCT */}
          <div className={`w-full flex flex-col mb-4 select-none shrink-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
            {/* --- CẤP 1 (CHA) --- */}
            <div className={`w-full bg-gray-100 dark:bg-slate-800 flex flex-wrap gap-1 pt-1 px-1 items-center transition-all duration-300 ${activeTab === 'list' ? 'pb-0 border-b-0' : 'pb-1'}`}>
              {vehicleTabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${isActive
                      ? `text-white font-black z-10 ${activeTab === 'list' ? 'pb-2.5 sm:pb-3' : ''}`
                      : 'text-gray-500 hover:text-[#005698] dark:hover:text-blue-300 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-xl'
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="vehicleMainTabSlide"
                        className={`absolute inset-0 z-0 shadow-xs ${activeTab === 'list' ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'}`}
                        style={{ backgroundColor: '#005698' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
                    <span className="relative z-10">{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* --- CẤP 2 (CON - Mở khi chọn Tab 1: Danh sách xe) --- */}
            <AnimatePresence initial={false}>
              {activeTab === 'list' && (
                <motion.div
                  key="level2-vehicle"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden bg-[#005698]"
                >
                  <div className="w-full flex flex-wrap gap-4 px-4 py-1.5 items-center transition-all duration-300">
                    {[
                      { id: 'active', label: 'Hiện hữu', icon: <Car className="w-4 h-4" />, count: activeCarsCount },
                      { id: 'liquidated', label: 'Thanh lý', icon: <Archive className="w-4 h-4" />, count: liquidatedCarsCount }
                    ].map(st => {
                      const isSubActive = vehicleSubTab === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setVehicleSubTab(st.id as any)}
                          className={`relative py-1.5 px-4 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                            isSubActive ? 'text-white font-black' : 'text-white/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {isSubActive && (
                            <motion.div
                              layoutId="vehicleSubTabSlide"
                              className="absolute inset-0 bg-[#00386b] rounded-lg shadow-sm ring-1 ring-sky-400/40 z-0"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1.5">
                            {st.icon}
                            <span>{st.label}</span>
                          </span>
                          <span className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${isSubActive ? 'bg-[#0284c7] text-white' : 'bg-white/15 text-white/90'}`}>
                            {st.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm shrink-0"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

          {/* 🟢 THANH CẢNH BÁO HẠN ĐĂNG KIỂM & BẢO HIỂM XE */}
          {expiringCars.length > 0 && !isDismissed && (
            <div className={`mb-6 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex justify-between items-center p-3 sm:p-4">
                  <div
                    className="flex items-center gap-2 text-red-700 cursor-pointer flex-1"
                    onClick={() => setIsWarningOpen(!isWarningOpen)}
                  >
                    <AlertCircle size={18} className={expiringCars.some(i => i.diffDays < 0) ? "animate-pulse shrink-0" : "shrink-0"} />
                    <h3 className="font-bold text-sm">
                      {expiringCars.length} hạng mục xe sắp / đã quá hạn ĐK & Bảo hiểm
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 shrink-0">
                    <button onClick={() => setIsWarningOpen(!isWarningOpen)} className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors" title="Xem chi tiết">
                      {isWarningOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <button onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }} className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors" title="Đóng cảnh báo">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {isWarningOpen && (
                  <div className="border-t border-red-100 bg-white">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {expiringCars.map((warn, idx) => (
                            <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                              <td className="p-3 w-28">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${warn.diffDays < 0 ? 'bg-red-100 text-red-700 border-red-200' : warn.diffDays === 0 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                  {warn.diffDays < 0 ? 'QUÁ HẠN' : warn.diffDays === 0 ? 'HÔM NAY' : 'SẮP HẾT HẠN'}
                                </span>
                              </td>
                              <td className="p-3 font-semibold text-gray-800">
                                {warn.type}
                                <span className="text-gray-400 mx-2">—</span>
                                <span className="text-[#05469B] font-bold">{warn.name}</span>
                              </td>
                              <td className="p-3 text-gray-600 text-xs w-48">
                                {warn.unitName}
                              </td>
                              <td className="p-3 text-right font-bold text-gray-700 text-xs w-32">
                                {warn.dateStr}
                                {warn.diffDays > 0 && <span className="block text-[10px] font-normal text-gray-500 mt-0.5">Còn {warn.diffDays} ngày</span>}
                                {warn.diffDays < 0 && <span className="block text-[10px] font-normal text-red-500 mt-0.5">Trễ {Math.abs(warn.diffDays)} ngày</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BẢNG DỮ LIỆU CHÍNH */}
        <div className={`flex flex-col flex-1 min-h-0 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>

          {activeTab === 'list' && (
            <>
              {/* BẢNG DỮ LIỆU PC */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 w-full flex-1 min-h-0 overflow-auto custom-scrollbar">
                <table className="w-full table-fixed text-left border-collapse min-w-[1100px] text-[12px]">
                  <thead className="sticky top-0 bg-[#f8fafc] z-10">
                    <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">BIỂN SỐ XE</th>
                      <th className="py-3 px-3 w-[15%] bg-[#f8fafc]">HÃNG - LOẠI XE</th>
                      <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">PHƯƠNG TIỆN</th>
                      <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">MỤC ĐÍCH SD</th>
                      <th className="py-3 px-3 w-[12%] bg-[#f8fafc]">ĐỊA ĐIỂM SD</th>
                      <th className="py-3 px-3 w-[18%] bg-[#f8fafc]">ĐƠN VỊ QUẢN LÝ</th>
                      {vehicleSubTab === 'liquidated' ? (
                        <th className="py-3 px-3 w-[10%] bg-[#f8fafc] text-red-600">NGÀY THANH LÝ</th>
                      ) : (
                        <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">TÌNH TRẠNG</th>
                      )}
                      <th className="py-3 px-3 text-center w-[15%] bg-[#f8fafc]">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={8} className="p-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />Đang tải dữ liệu...</td></tr>
                    ) : filteredCars.length === 0 ? (
                      <tr><td colSpan={8} className="p-16 text-center text-gray-500">
                        <Car size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-lg font-medium">Không có xe nào trong danh sách hiển thị.</p>
                      </td></tr>
                    ) : (
                      paginatedCars.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="py-3 px-3 font-black text-[#05469B] text-sm whitespace-nowrap align-middle">
                            <div className="flex items-center gap-1.5">
                              <span>🚙 {item.bien_so}</span>
                              {(item.ho_so_xe || item.link_ho_so_xe) && (
                                <a
                                  href={item.ho_so_xe || item.link_ho_so_xe}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center p-1 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors shadow-2xs"
                                  title="Xem hồ sơ xe"
                                >
                                  <FileText size={14} className="text-red-500 hover:text-red-600" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 align-middle">
                            <div className="flex flex-col justify-center items-start gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs truncate max-w-full ${getBrandBadgeStyle(item.hieu_xe)}`} title={`Hãng: ${item.hieu_xe || 'Khác'}`}>
                                {item.hieu_xe || 'Khác'}
                              </span>
                              <p className="text-[11px] text-slate-500 truncate w-full font-medium" title={`${item.loai_xe || ''} ${item.phien_ban ? `- ${item.phien_ban}` : ''}`}>
                                {item.loai_xe || '---'} {item.phien_ban ? `• ${item.phien_ban}` : ''}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-700 font-medium align-middle truncate" title={item.loai_phuong_tien}>{item.loai_phuong_tien || '---'}</td>
                          <td className="py-3 px-3 align-middle">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${getPurposeBadgeStyle(item.muc_dich_su_dung)}`}>
                              {item.muc_dich_su_dung || '---'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-700 font-medium align-middle truncate" title={item.dia_diem_su_dung || ''}>{item.dia_diem_su_dung || '---'}</td>
                          <td className="py-3 px-3 align-middle">
                            {(() => {
                              const unit = donViList.find(u => u.id === item.id_don_vi);
                              if (!unit) return <span className="text-gray-400 font-medium">---</span>;

                              const line1 = unit.ten_don_vi;
                              const ancestors: string[] = [];
                              let currParentId = unit.cap_quan_ly;
                              let depth = 0;
                              while (currParentId && currParentId !== 'HO' && depth < 5) {
                                const p = donViList.find(u => u.id === currParentId);
                                if (p) {
                                  ancestors.push(p.ten_don_vi);
                                  currParentId = p.cap_quan_ly;
                                } else {
                                  break;
                                }
                                depth++;
                              }

                              let line2 = '';
                              if (ancestors.length > 0) {
                                line2 = `Trực thuộc: ${ancestors.join(' - ')}`;
                              } else if (item.don_vi_chu_so_huu) {
                                line2 = `CSH: ${item.don_vi_chu_so_huu}`;
                              } else {
                                line2 = `Sở hữu: ${item.hinh_thuc_so_huu || 'HO'}`;
                              }

                              return (
                                <div className="flex flex-col justify-center">
                                  <p className="font-bold text-gray-800 text-[12px] leading-snug truncate" title={line1}>{line1}</p>
                                  <p className="text-[10.5px] font-semibold text-slate-500 mt-0.5 truncate" title={line2}>{line2}</p>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 align-middle">
                            {vehicleSubTab === 'liquidated' ? (
                              <span className="font-bold text-red-600 whitespace-nowrap text-xs">
                                {formatDateDisplay(item.ngay_thanh_ly)}
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold whitespace-nowrap inline-block border ${getStatusBadgeStyle(item.hien_trang)}`}>
                                {getStatusEmoji(item.hien_trang)} {item.hien_trang}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 align-middle text-center">
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-full max-w-[110px] mx-auto">
                              {/* Dòng 1: Chi phí */}
                              <button onClick={() => openCostModal(item)} className="w-full py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded text-[10.5px] font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs leading-none">
                                <Receipt size={12} /> Chi phí
                              </button>

                              {/* Dòng 2: Nút theo từng sub-tab */}
                              {vehicleSubTab === 'active' ? (
                                <div className="grid grid-cols-3 gap-1">
                                  <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="py-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Xem chi tiết">
                                    <Eye size={12} />
                                  </button>
                                  <button onClick={() => openCarModal('update', item)} className="py-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Sửa">
                                    <Edit size={12} />
                                  </button>
                                  <button onClick={() => openStatusModal(item)} className="py-1 bg-white border border-amber-300 text-amber-600 hover:bg-amber-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Cập nhật trạng thái">
                                    <SlidersHorizontal size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-1">
                                  <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="py-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Xem chi tiết">
                                    <Eye size={12} />
                                  </button>
                                  <button onClick={() => openPermanentDeleteModal(item)} className="py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Xóa vĩnh viễn xe">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 🟢 VIEW TRÊN MOBILE: THẺ CARD DỌC */}
              <div className="block md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
                {filteredCars.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 italic">Không có xe nào trong danh sách hiển thị.</div>
                ) : (
                  paginatedCars.map((item) => {
                    const unit = donViList.find(u => u.id === item.id_don_vi);
                    const line1 = unit ? unit.ten_don_vi : '---';

                    const costs = chiPhiData
                      .filter(cp => getCostCarId(cp) === item.id)
                      .sort((a, b) => String(a.thang_nam || '').localeCompare(String(b.thang_nam || '')));

                    const monthlyTotals = costs.map(cost => {
                      const phikhac = (Number(cost.cp_thue_khau_hao) || 0) + (Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0);
                      const total = (Number(cost.cp_nhien_lieu) || 0) + (Number(cost.cp_cau_duong_ben_bai) || 0) + (Number(cost.cp_rua_xe) || 0) + (Number(cost.cp_bao_duong_sua_chua) || 0) + phikhac;
                      return total;
                    });
                    const sumCost = monthlyTotals.reduce((a, b) => a + b, 0);
                    const n = monthlyTotals.length;

                    return (
                      <div
                        key={item.id}
                        className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative flex flex-col gap-3 transition-all"
                      >
                        {/* Header: Biển số & Hiệu xe & Hiện trạng */}
                        <div className="pb-2.5 border-b border-gray-100">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-[#05469B] text-sm">🚙 {item.bien_so}</span>
                              {(item.ho_so_xe || item.link_ho_so_xe) && (
                                <a
                                  href={item.ho_so_xe || item.link_ho_so_xe}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center p-0.5 rounded text-red-600 hover:text-red-700"
                                  title="Xem hồ sơ xe"
                                >
                                  <FileText size={14} className="text-red-500 hover:text-red-600" />
                                </a>
                              )}
                            </div>
                            {vehicleSubTab === 'liquidated' ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-red-600 bg-red-50 border border-red-200">
                                TL: {formatDateDisplay(item.ngay_thanh_ly)}
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap border ${getStatusBadgeStyle(item.hien_trang)}`}>
                                {getStatusEmoji(item.hien_trang)} {item.hien_trang}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs ${getBrandBadgeStyle(item.hieu_xe)}`}>
                              {item.hieu_xe || 'Khác'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">({item.loai_xe || '---'} {item.phien_ban ? `• ${item.phien_ban}` : ''})</span>
                          </div>
                        </div>

                        {/* Body: Details */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Loại phương tiện</p>
                            <p className="font-bold text-gray-700 mt-0.5">{item.loai_phuong_tien || '---'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Mục đích SD</p>
                            <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded text-[10px] font-bold ${getPurposeBadgeStyle(item.muc_dich_su_dung)}`}>
                              {item.muc_dich_su_dung || '---'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Địa điểm SD</p>
                            <p className="font-bold text-gray-700 mt-0.5">{item.dia_diem_su_dung || '---'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Đơn vị quản lý</p>
                            <p className="font-bold text-gray-800 mt-0.5">{line1}</p>
                            {item.don_vi_chu_so_huu && <p className="text-[9px] text-gray-400 font-medium mt-0.5">Sở hữu: {item.don_vi_chu_so_huu}</p>}
                          </div>
                          <div className="col-span-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Tổng chi phí ({n} tháng)</span>
                              <span className="text-xs font-black text-red-600 mt-0.5">{formatCurrency(sumCost)} VNĐ</span>
                            </div>
                            <button onClick={() => openCostModal(item)} className="px-2 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-md text-[10px] font-bold shadow-2xs">Chi tiết</button>
                          </div>
                        </div>

                        {/* Footer: Actions */}
                        <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t border-gray-100 mt-1">
                          <button onClick={() => openCostModal(item)} className="py-1.5 px-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs" title="Quản lý chi phí xe"><Receipt size={13} /> QL Chi phí</button>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xem chi tiết"><Eye size={13} /> Xem</button>
                            {vehicleSubTab === 'active' ? (
                              <>
                                <button onClick={() => openCarModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit size={13} /> Sửa</button>
                                <button onClick={() => openStatusModal(item)} className="p-1.5 text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Cập nhật trạng thái"><SlidersHorizontal size={13} /> Trạng thái</button>
                              </>
                            ) : (
                              <button onClick={() => openPermanentDeleteModal(item)} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa vĩnh viễn"><Trash2 size={13} /> Xóa</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 🟢 GIAO DIỆN PHÂN TRANG (PAGINATION BAR) */}
              <div className="shrink-0 pt-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  rowsPerPage={rowsPerPage}
                  totalRows={filteredCars.length}
                  onPageChange={setCurrentPage}
                  onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
                  itemName="xe"
                />
              </div>
            </>
          )}

          {/* ── TAB LỊCH TRÌNH & NHẬT KÝ ── */}
          {activeTab === 'schedule' && (
            <VehicleScheduleTab
              xeData={permittedCars}
              allowedDonViIds={allowedDonViIds}
              selectedUnitFilter={selectedUnitFilter}
              donViList={donViList}
              nhatKyData={permittedNhatKy}
              setNhatKyData={setNhatKyData}
            />
          )}

          {/* ── TAB THỐNG KÊ ── */}
          {activeTab === 'stats' && (
            <VehicleStatsTab
              filteredCars={filteredCars}
              chiPhiData={permittedChiPhi}
              donViMap={donViMap}
              onViewCar={(car) => { setViewData(car); setIsViewModalOpen(true); }}
              nhatKyData={permittedNhatKy}
            />
          )}

        </div>
      </div>

      {/* --- MODAL NHẬP THÔNG TIN TÀI SẢN XE --- */}
      {isCarModalOpen && createPortal(
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2"><Car size={24} /> {modalMode === 'create' ? 'Thêm Xe Mới' : 'Cập nhật Thông tin Xe'}</h3>
              <button onClick={() => setCarModal(prev => ({ ...prev, isOpen: false }))} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleCarSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">

                <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-[#05469B] rounded-full"></div> Hồ sơ Đăng ký & Sở hữu</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* ── Dòng 1: Biển số | Mục đích sử dụng | Địa điểm sử dụng ── */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Biển Số *</label>
                      <input type="text" required name="bien_so" value={carFormData.bien_so || ''} onChange={handleInputCarChange} placeholder="VD: 51H12345" className={`w-full p-2.5 border rounded-lg outline-none font-bold focus:ring-2 focus:ring-[#05469B] ${plateError ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-[#FFFFF0] text-[#05469B]'}`} />
                      {plateError && <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse">Lỗi: Gõ liền, không dấu cách/-/. !</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mục đích sử dụng</label>
                      <select name="muc_dich_su_dung" value={carFormData.muc_dich_su_dung || 'Xe công'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="Xe công">Xe công</option>
                        <option value="Xe lái thử">Xe lái thử</option>
                        <option value="Xe Chuyên dụng">Xe Chuyên dụng</option>
                        <option value="Xe cho thuê">Xe cho thuê</option>
                        <option value="Xe thay thế cho KH">Xe thay thế cho KH</option>
                        <option value="Xe sửa chữa lưu động">Xe sửa chữa lưu động</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Địa điểm sử dụng</label>
                      <input type="text" name="dia_diem_su_dung" value={carFormData.dia_diem_su_dung || ''} onChange={handleInputCarChange} placeholder="VD: TP. Hồ Chí Minh..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>

                    {/* ── Dòng 2: Đơn vị quản lý | Hình thức sở hữu | Đơn vị đứng tên Cà vẹt ── */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị quản lý *</label>
                      <select required name="id_don_vi" value={carFormData.id_don_vi || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" style={{ fontFamily: 'monospace, sans-serif' }}>
                        <option value="">-- Chọn đơn vị --</option>
                        {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id} className="font-normal text-gray-700">
                            {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hình thức Sở hữu</label>
                      <select name="hinh_thuc_so_huu" value={carFormData.hinh_thuc_so_huu || 'Sở hữu'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="Sở hữu">Sở hữu</option>
                        <option value="Quản lý sử dụng">Quản lý sử dụng</option>
                        <option value="Thuê">Thuê</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị Đứng tên Cà vẹt (Chủ sở hữu)</label>
                      <input type="text" name="don_vi_chu_so_huu" value={carFormData.don_vi_chu_so_huu || ''} onChange={handleInputCarChange} placeholder="Tên công ty/cá nhân trên Giấy đăng ký xe" className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>

                    {/* ── Dòng 3: Mã Tài sản | Nguyên giá | Chi phí Thuê/Khấu hao ── */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mã Tài Sản (Kế toán)</label>
                      <input type="text" name="ma_tai_san" value={carFormData.ma_tai_san || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nguyên giá (VNĐ)</label>
                      <input type="text" name="nguyen_gia" value={formatCurrency(carFormData.nguyen_gia)} onChange={handleInputCarChange} placeholder="Giá trị mua xe ban đầu..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Chi phí Thuê / Khấu hao tháng (VNĐ)</label>
                      <input type="text" name="cp_thue_khau_hao" value={formatCurrency(carFormData.cp_thue_khau_hao)} onChange={handleInputCarChange} placeholder="Chi phí cố định hàng tháng..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                  </div>
                </div>

                {/* 🟢 KHỐI MỚI: HẠN PHÁP LÝ & BẢO HIỂM */}
                <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-emerald-600 rounded-full"></div> Hạn Pháp lý & Bảo hiểm</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hạn Đăng kiểm</label>
                      <input type="date" name="han_dang_kiem" value={carFormData.han_dang_kiem ? carFormData.han_dang_kiem.split('T')[0] : ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hạn Bảo hiểm TNDS</label>
                      <input type="date" name="han_bh_tnds" value={carFormData.han_bh_tnds ? carFormData.han_bh_tnds.split('T')[0] : ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hạn Bảo hiểm Vật chất</label>
                      <input type="date" name="han_bh_vc" value={carFormData.han_bh_vc ? carFormData.han_bh_vc.split('T')[0] : ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <div className="w-2 h-6 bg-gray-400 rounded-full"></div> Đặc điểm Kỹ thuật
                    </h4>
                    {carFormData.hieu_xe && carFormData.loai_xe && (
                      <div className="flex items-center gap-2">
                        {specSuggestionInfo && specSuggestionInfo.brand === carFormData.hieu_xe && specSuggestionInfo.model === carFormData.loai_xe ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-[#05469B] rounded-lg text-xs font-semibold shadow-2xs">
                            <Sparkles size={13} className="text-amber-500 shrink-0" />
                            <span>Đã gợi ý từ {specSuggestionInfo.source}</span>
                            <button
                              type="button"
                              onClick={() => handleReapplySpecs(true)}
                              className="ml-1 text-[11px] underline text-[#05469B] hover:text-blue-800 font-bold cursor-pointer"
                              title="Điền lại toàn bộ thông số mẫu cho dòng xe này"
                            >
                              Áp dụng lại
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReapplySpecs(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            title="Tự động điền thông số kỹ thuật chuẩn của dòng xe này"
                          >
                            <Sparkles size={13} className="text-amber-500 shrink-0" />
                            <span>Gợi ý thông số mẫu</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dòng 1: Loại phương tiện - Hiệu xe (Hãng) - Loại xe - Phiên bản */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Loại phương tiện</label>
                      <select name="loai_phuong_tien" value={carFormData.loai_phuong_tien || 'Ô tô du lịch'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="Ô tô du lịch">Ô tô du lịch</option>
                        <option value="Ô tô tải">Ô tô tải</option>
                        <option value="Xe máy">Xe máy</option>
                        <option value="Xe chuyên dụng">Xe chuyên dụng</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hiệu xe (Hãng) *</label>
                      <select required name="hieu_xe" value={carFormData.hieu_xe || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="" className="font-normal text-gray-500">-- Chọn Hãng --</option>
                        {Object.keys(VEHICLE_MODELS).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Loại xe *</label>
                      {(VEHICLE_MODELS[carFormData.hieu_xe || ''] || []).length > 0 ? (
                        <select required name="loai_xe" value={carFormData.loai_xe || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#05469B]">
                          <option value="" className="font-normal text-gray-500">-- Chọn Loại xe --</option>
                          {VEHICLE_MODELS[carFormData.hieu_xe || ''].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : (
                        <input type="text" required name="loai_xe" value={carFormData.loai_xe || ''} onChange={handleInputCarChange} placeholder="Nhập loại xe..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      )}
                    </div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Phiên bản</label><input type="text" name="phien_ban" value={carFormData.phien_ban || ''} onChange={handleInputCarChange} placeholder="VD: 2.0 Premium..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  </div>

                  {/* Dòng 2: Năm SX - Năm ĐK lần đầu - Màu xe - Số chỗ ngồi - Tải trọng (nếu là Ô tô tải) */}
                  <div className={`grid grid-cols-2 ${carFormData.loai_phuong_tien === 'Ô tô tải' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 mt-4`}>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Năm SX</label><input type="text" name="nam_sx" value={carFormData.nam_sx || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Năm Đăng ký ban đầu</label><input type="text" name="nam_dk" value={carFormData.nam_dk || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Màu xe</label><input type="text" name="mau_xe" value={carFormData.mau_xe || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Số chỗ ngồi</label><input type="number" name="so_cho" value={carFormData.so_cho || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    {carFormData.loai_phuong_tien === 'Ô tô tải' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tải trọng (tấn)</label>
                        <input
                          type="text"
                          name="tai_trong"
                          value={carFormData.tai_trong || ''}
                          onChange={handleInputCarChange}
                          placeholder="VD: 1.9, 3.5, 5..."
                          className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Dòng 3: Số khung - Số máy - Loại nhiên liệu - Dung tích */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                        <span>Số Khung</span>
                        {chassisError.isDuplicate && (
                          <span className="text-[10px] text-red-500 font-bold">Trùng lặp!</span>
                        )}
                      </label>
                      <input
                        type="text"
                        name="so_khung"
                        value={carFormData.so_khung || ''}
                        onChange={handleInputCarChange}
                        placeholder="VD: RL4MC..."
                        className={`w-full p-2.5 border rounded-lg outline-none font-bold uppercase transition-all ${chassisError.isDuplicate
                          ? 'border-red-500 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-200 bg-[#FFFFF0] focus:ring-2 focus:ring-[#05469B]'
                          }`}
                      />
                      {chassisError.isDuplicate && (
                        <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse" title={chassisError.carInfo}>
                          ⚠️ Đã tồn tại ({chassisError.carInfo})
                        </p>
                      )}
                    </div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Số Máy</label><input type="text" name="so_may" value={carFormData.so_may || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Loại Nhiên liệu</label><select name="loai_nhien_lieu" value={carFormData.loai_nhien_lieu || 'Xăng'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Xăng">Xăng</option><option value="Dầu Diesel">Dầu Diesel</option><option value="Điện">Điện</option><option value="Khác">Khác</option></select></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Dung tích</label><input type="text" name="dung_tich" value={carFormData.dung_tich || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  </div>

                  {/* Dòng 4: Kích thước xe - Kích thước thùng (nếu là Ô tô tải) - Công thức bánh xe */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 items-end">
                    {/* Kích thước xe (áp dụng mọi loại phương tiện) */}
                    <div className={carFormData.loai_phuong_tien === 'Ô tô tải' ? 'md:col-span-5' : 'md:col-span-8'}>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                        <span>Kích thước xe (Dài × Rộng × Cao)</span>
                        <span className="text-[10px] text-gray-400 font-normal">Đơn vị: mm</span>
                      </label>
                      <div className="h-[42px] grid grid-cols-3 gap-1 p-1 bg-[#FFFFF0] border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[#05469B] focus-within:border-transparent transition-all">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Dài"
                          value={carFormData.kich_thuoc_xe?.dai ?? ''}
                          onChange={(e) => handleDimChange('kich_thuoc_xe', 'dai', e.target.value)}
                          className="w-full h-full text-xs text-center border-0 bg-transparent outline-none rounded font-semibold text-gray-800"
                          title="Chiều dài xe (mm)"
                        />
                        <div className="border-x border-gray-200 flex items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Rộng"
                            value={carFormData.kich_thuoc_xe?.rong ?? ''}
                            onChange={(e) => handleDimChange('kich_thuoc_xe', 'rong', e.target.value)}
                            className="w-full h-full text-xs text-center border-0 bg-transparent outline-none rounded font-semibold text-gray-800"
                            title="Chiều rộng xe (mm)"
                          />
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Cao"
                          value={carFormData.kich_thuoc_xe?.cao ?? ''}
                          onChange={(e) => handleDimChange('kich_thuoc_xe', 'cao', e.target.value)}
                          className="w-full h-full text-xs text-center border-0 bg-transparent outline-none rounded font-semibold text-gray-800"
                          title="Chiều cao xe (mm)"
                        />
                      </div>
                    </div>

                    {/* Kích thước thùng xe (chỉ hiển thị nếu Ô tô tải) */}
                    {carFormData.loai_phuong_tien === 'Ô tô tải' && (
                      <div className="md:col-span-5">
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                          <span>Kích thước thùng (Dài × Rộng × Cao)</span>
                          <span className="text-[10px] text-gray-400 font-normal">Đơn vị: mm</span>
                        </label>
                        <div className="h-[42px] grid grid-cols-3 gap-1 p-1 bg-[#FFFFF0] border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[#05469B] focus-within:border-transparent transition-all">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Dài"
                            value={carFormData.kich_thuoc_thung?.dai ?? ''}
                            onChange={(e) => handleDimChange('kich_thuoc_thung', 'dai', e.target.value)}
                            className="w-full h-full text-xs text-center border-0 bg-transparent outline-none rounded font-semibold text-gray-800"
                            title="Chiều dài thùng (mm)"
                          />
                          <div className="border-x border-gray-200 flex items-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Rộng"
                              value={carFormData.kich_thuoc_thung?.rong ?? ''}
                              onChange={(e) => handleDimChange('kich_thuoc_thung', 'rong', e.target.value)}
                              className="w-full h-full text-xs text-center border-0 bg-transparent outline-none rounded font-semibold text-gray-800"
                              title="Chiều rộng thùng (mm)"
                            />
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Cao"
                            value={carFormData.kich_thuoc_thung?.cao ?? ''}
                            onChange={(e) => handleDimChange('kich_thuoc_thung', 'cao', e.target.value)}
                            className="w-full h-full text-xs text-center border-0 bg-transparent outline-none rounded font-semibold text-gray-800"
                            title="Chiều cao thùng (mm)"
                          />
                        </div>
                      </div>
                    )}

                    {/* Công thức bánh xe */}
                    <div className={carFormData.loai_phuong_tien === 'Ô tô tải' ? 'md:col-span-2' : 'md:col-span-4'}>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Công thức bánh</label>
                      <input
                        type="text"
                        name="cong_thuc_banh"
                        value={carFormData.cong_thuc_banh || ''}
                        onChange={handleInputCarChange}
                        className="w-full h-[42px] px-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="VD: 4x2..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50/40 p-5 rounded-xl border border-orange-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Định vị GPS</label><select name="gps" value={carFormData.gps || 'Có'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Có">Có</option><option value="Không">Không</option></select></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Hiện trạng</label><select name="hien_trang" value={carFormData.hien_trang || 'Đang hoạt động'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] font-bold text-[#05469B] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Đang hoạt động">Đang hoạt động</option><option value="Sửa chữa">Sửa chữa</option><option value="Ngưng hoạt động">Ngưng hoạt động</option><option value="Đã Thanh lý">Đã Thanh lý</option><option value="Chuyển KD xe QSD">Chuyển KD xe QSD</option></select></div>

                    {/* 🟢 TRƯỜNG HỒ SƠ XE: NGAY DƯỚI ĐỊNH VỊ GPS VÀ HIỆN TRẠNG, TRÊN PHẦN GHI CHÚ KHÁC */}
                    <div className="md:col-span-2 pt-3 border-t border-orange-200/60">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <FileText size={14} className="text-red-500" />
                          <span>Hồ sơ xe (Link File / Folder Google Drive)</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoScanDriveCar}
                          disabled={scanningDrive}
                          className="text-[10px] text-[#05469B] hover:text-blue-700 font-bold flex items-center gap-1 bg-white hover:bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 hover:border-blue-300 disabled:opacity-50 transition-all cursor-pointer shadow-2xs shrink-0"
                          title="Tự động tìm File hoặc Folder theo Số khung trong thư mục Hồ sơ Xe trên Google Drive"
                        >
                          {scanningDrive ? (
                            <>
                              <Loader2 className="animate-spin" size={11} />
                              Đang quét Drive...
                            </>
                          ) : (
                            <>
                              <Search size={11} />
                              Tự động tìm file trên Drive
                            </>
                          )}
                        </button>
                      </div>
                      <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                          <input
                            type="url"
                            name="ho_so_xe"
                            value={carFormData.ho_so_xe || ''}
                            onChange={handleInputCarChange}
                            placeholder="Dán link Google Drive hồ sơ xe hoặc bấm 'Tự động tìm file trên Drive'..."
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 font-medium text-xs break-all"
                          />
                        </div>
                        {carFormData.ho_so_xe && (
                          <a
                            href={carFormData.ho_so_xe}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0 shadow-2xs"
                            title="Mở xem file PDF trên Google Drive"
                          >
                            <ExternalLink size={12} />
                            <span>Xem thử</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú khác</label><textarea name="ghi_chu" value={carFormData.ghi_chu || ''} onChange={handleInputCarChange} rows={2} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea></div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
                <button type="button" onClick={() => setCarModal(prev => ({ ...prev, isOpen: false }))} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
                <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Hồ Sơ Xe
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL XEM CHI TIẾT XE VÀ THỐNG KÊ CHI PHÍ --- */}
      {isViewModalOpen && viewData && createPortal(
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-h-[92vh] md:max-h-[90vh] md:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in duration-200 overflow-hidden mt-auto md:mt-0">
            <div className="flex justify-between p-4 md:p-5 border-b border-gray-100 bg-[#05469B] rounded-t-3xl md:rounded-t-2xl shrink-0">
              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2"><Car size={24} /> Chi tiết Thông tin & Hoạt động Xe</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-blue-200 hover:text-white rounded-full p-1 transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-5 md:gap-6 custom-scrollbar">

              {/* Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5 md:pb-6 shrink-0">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 text-[#05469B] rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner shrink-0">
                    <Car size={40} className="sm:w-12 sm:h-12" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight">{viewData.bien_so}</h2>
                    <p className="text-base sm:text-xl font-bold text-[#05469B] mt-1">{viewData.hieu_xe} {viewData.loai_xe} {viewData.phien_ban ? `- ${viewData.phien_ban}` : ''}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold uppercase">{viewData.loai_phuong_tien}</span>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">{viewData.muc_dich_su_dung}</span>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getStatusBadgeStyle(viewData.hien_trang)}`}>
                        {getStatusEmoji(viewData.hien_trang)} {viewData.hien_trang}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-center sm:text-right shrink-0 mt-2 sm:mt-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase mb-1">Đơn vị quản lý</p>
                  <p className="text-sm sm:text-lg font-black text-gray-800">{getUnitFullName(viewData.id_don_vi)}</p>
                </div>
              </div>

              {/* Data Grid: Các thông số cơ bản */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200 shrink-0">
                <div><p className="text-xs text-gray-500 font-bold mb-1">Chủ sở hữu</p><p className="font-semibold text-gray-800">{viewData.don_vi_chu_so_huu || '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Số Khung</p><p className="font-semibold text-gray-800">{viewData.so_khung || '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Số Máy</p><p className="font-semibold text-gray-800">{viewData.so_may || '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Định vị GPS</p><p className="font-semibold text-gray-800">{viewData.gps || '-'}</p></div>

                <div><p className="text-xs text-gray-500 font-bold mb-1">Năm Sản Xuất</p><p className="font-semibold text-gray-800">{viewData.nam_sx || '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Năm Đăng Ký Lần Đầu</p><p className="font-semibold text-gray-800">{viewData.nam_dk || '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Số Chỗ ngồi</p><p className="font-semibold text-gray-800">{viewData.so_cho ? `${viewData.so_cho} chỗ` : '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Nhiên Liệu</p><p className="font-semibold text-gray-800">{viewData.loai_nhien_lieu || '-'}</p></div>

                {viewData.loai_phuong_tien === 'Ô tô tải' && (
                  <div><p className="text-xs text-gray-500 font-bold mb-1">Tải trọng (tấn)</p><p className="font-bold text-emerald-700">{viewData.tai_trong ? `${viewData.tai_trong} tấn` : '-'}</p></div>
                )}
                <div><p className="text-xs text-gray-500 font-bold mb-1">Kích thước xe (D × R × C)</p><p className="font-semibold text-gray-800">{formatKichThuoc(viewData.kich_thuoc_xe)}</p></div>
                {viewData.loai_phuong_tien === 'Ô tô tải' && (
                  <div><p className="text-xs text-gray-500 font-bold mb-1">Kích thước thùng (D × R × C)</p><p className="font-bold text-emerald-700">{formatKichThuoc(viewData.kich_thuoc_thung)}</p></div>
                )}
                <div><p className="text-xs text-gray-500 font-bold mb-1">Công thức bánh</p><p className="font-semibold text-gray-800">{viewData.cong_thuc_banh || '-'}</p></div>
                {isLiquidatedCar(viewData) && (
                  <div>
                    <p className="text-xs text-red-500 font-bold mb-1">Ngày thanh lý</p>
                    <p className="font-bold text-red-600">{formatDateDisplay(viewData.ngay_thanh_ly)}</p>
                  </div>
                )}
              </div>

              {/* 🟢 Data Grid: Hạn Ngày Pháp lý & Hồ sơ xe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shrink-0">
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Hạn Đăng kiểm</p>
                  <p className="font-bold text-gray-800">{viewData.han_dang_kiem ? new Date(viewData.han_dang_kiem).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Hạn BH TNDS</p>
                  <p className="font-bold text-gray-800">{viewData.han_bh_tnds ? new Date(viewData.han_bh_tnds).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Hạn BH Vật chất</p>
                  <p className="font-bold text-gray-800">{viewData.han_bh_vc ? new Date(viewData.han_bh_vc).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Hồ sơ xe</p>
                  {(viewData.ho_so_xe || viewData.link_ho_so_xe) ? (
                    <a
                      href={viewData.ho_so_xe || viewData.link_ho_so_xe}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-all shadow-2xs"
                    >
                      <FileText size={13} className="text-red-500" />
                      <span>Xem hồ sơ ↗</span>
                    </a>
                  ) : (
                    <p className="font-semibold text-gray-400 text-xs">Chưa cập nhật</p>
                  )}
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={18} className="text-[#05469B]" /> Thống kê Quãng đường & Chi phí</h4>

                  <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1"><div className="w-4 h-1.5 bg-emerald-500 rounded-full"></div> <span>Số Km</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div> <span>Nhiên liệu</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div> <span>Bảo dưỡng</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></div> <span>Cầu đường</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm"></div> <span>Rửa xe</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-gray-400 rounded-sm"></div> <span>Khác (ĐK, BH, KH)</span></div>
                  </div>
                </div>

                {viewHistoryCosts.length === 0 ? (
                  <div className="text-center py-10 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400">
                    <Receipt className="mx-auto mb-2 opacity-50" size={32} />
                    <p>Chưa có dữ liệu khai báo chi phí cho xe này.</p>
                  </div>
                ) : (
                  <div className="relative h-56 sm:h-64 mt-4 px-10 sm:px-12">
                    <div className="absolute left-0 top-0 h-[calc(100%-24px)] flex flex-col justify-between text-[9px] font-bold text-gray-400 border-r border-gray-100 pr-2">
                      <span>{formatCurrency(chartScale.maxCP)} đ</span>
                      <span>{formatCurrency(chartScale.maxCP / 2)} đ</span>
                      <span>0 đ</span>
                    </div>
                    <div className="absolute right-0 top-0 h-[calc(100%-24px)] flex flex-col justify-between text-[9px] font-bold text-emerald-600 border-l border-gray-100 pl-2 text-right">
                      <span>{formatCurrency(chartScale.maxKm)} km</span>
                      <span>{formatCurrency(chartScale.maxKm / 2)} km</span>
                      <span>0 km</span>
                    </div>

                    <div className="relative w-full h-[calc(100%-24px)] border-b border-gray-200 flex items-end z-0">
                      <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-gray-100 -z-10"></div>

                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                          points={viewHistoryCosts.map((cost, idx) => `${(idx + 0.5) * (100 / viewHistoryCosts.length)},${100 - ((Number(cost.km_hien_tai) || 0) / chartScale.maxKm * 100)}`).join(' ')}
                          fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" strokeDasharray="4 4"
                        />
                      </svg>

                      {viewHistoryCosts.map((cost, idx) => {
                        const nl = Number(cost.cp_nhien_lieu) || 0;
                        const cd = Number(cost.cp_cau_duong_ben_bai) || 0;
                        const rx = Number(cost.cp_rua_xe) || 0;
                        const bd = Number(cost.cp_bao_duong_sua_chua) || 0;
                        // Gộp Khấu hao, Đăng kiểm, Bảo hiểm vào nhóm "Khác"
                        const khac = (Number(cost.cp_thue_khau_hao) || 0) + (Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0);

                        const totalCP = nl + cd + rx + bd + khac;
                        const km = Number(cost.km_hien_tai) || 0;

                        const hNL = chartScale.maxCP > 0 ? (nl / chartScale.maxCP) * 100 : 0;
                        const hCD = chartScale.maxCP > 0 ? (cd / chartScale.maxCP) * 100 : 0;
                        const hRX = chartScale.maxCP > 0 ? (rx / chartScale.maxCP) * 100 : 0;
                        const hBD = chartScale.maxCP > 0 ? (bd / chartScale.maxCP) * 100 : 0;
                        const hKhac = chartScale.maxCP > 0 ? (khac / chartScale.maxCP) * 100 : 0;

                        const totalHeight = Math.max((totalCP / chartScale.maxCP) * 100, totalCP > 0 ? 2 : 0);
                        const costId = getCostId(cost) || `chart-${idx}`;

                        return (
                          <div key={costId} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                            <div style={{ bottom: `calc(${km > 0 ? (km / chartScale.maxKm * 100) : 0}% - 4px)` }} className="absolute w-2.5 h-2.5 bg-white rounded-full border-2 border-emerald-500 z-30 transition-all group-hover:scale-150 group-hover:bg-emerald-500"></div>

                            <div style={{ height: `${totalHeight}%` }} className="w-full max-w-[28px] flex flex-col justify-end opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                              {hKhac > 0 && <div style={{ height: `${(hKhac / totalHeight) * 100}%` }} className="w-full bg-gray-400 rounded-t-sm"></div>}
                              {hRX > 0 && <div style={{ height: `${(hRX / totalHeight) * 100}%` }} className="w-full bg-cyan-500"></div>}
                              {hCD > 0 && <div style={{ height: `${(hCD / totalHeight) * 100}%` }} className="w-full bg-amber-500"></div>}
                              {hBD > 0 && <div style={{ height: `${(hBD / totalHeight) * 100}%` }} className="w-full bg-red-500"></div>}
                              {hNL > 0 && <div style={{ height: `${(hNL / totalHeight) * 100}%` }} className="w-full bg-blue-500"></div>}
                            </div>

                            <div className="absolute bottom-full mb-3 hidden group-hover:block bg-gray-900 text-white p-3 rounded-lg text-[10px] z-50 shadow-2xl whitespace-nowrap min-w-[160px] pointer-events-none">
                              <p className="font-bold text-gray-300 border-b border-gray-700 pb-1 mb-1.5 uppercase">Tháng {formatMonthYear(cost.thang_nam)}</p>
                              <div className="space-y-1 mb-2">
                                {nl > 0 && <p className="flex justify-between gap-4"><span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-500 rounded-sm"></span>Nhiên liệu:</span> <span>{formatCurrency(nl)} đ</span></p>}
                                {bd > 0 && <p className="flex justify-between gap-4"><span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-500 rounded-sm"></span>Sửa chữa:</span> <span>{formatCurrency(bd)} đ</span></p>}
                                {cd > 0 && <p className="flex justify-between gap-4"><span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-500 rounded-sm"></span>Cầu đường:</span> <span>{formatCurrency(cd)} đ</span></p>}
                                {rx > 0 && <p className="flex justify-between gap-4"><span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-cyan-500 rounded-sm"></span>Rửa xe:</span> <span>{formatCurrency(rx)} đ</span></p>}
                                {khac > 0 && <p className="flex justify-between gap-4"><span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-gray-400 rounded-sm"></span>Khác (ĐK,BH...):</span> <span>{formatCurrency(khac)} đ</span></p>}
                              </div>
                              <p className="flex justify-between gap-4 border-t border-gray-700 pt-1.5 font-bold"><span>TỔNG CỘNG:</span> <span className="text-red-400">{formatCurrency(totalCP)} đ</span></p>
                              <p className="flex justify-between gap-4 pt-1 font-bold"><span>SỐ KM:</span> <span className="text-emerald-400">{formatCurrency(km)} Km</span></p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="w-full h-6 flex justify-between items-end">
                      {viewHistoryCosts.map((cost, idx) => {
                        const costId = getCostId(cost) || `label-${idx}`;
                        return (
                          <div key={costId} className="flex-1 text-center text-[9px] font-black text-gray-500">{formatMonthYear(cost.thang_nam)}</div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Table */}
              <div className="border border-gray-200 rounded-xl flex flex-col overflow-hidden shrink-0 mt-2">
                <div className="overflow-x-auto overflow-y-auto max-h-56 w-full custom-scrollbar relative">
                  <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                    <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm border-b border-gray-200">
                      <tr className="text-[11px] text-gray-600 uppercase tracking-wider">
                        <th className="p-3 bg-gray-50">Tháng</th>
                        <th className="p-3 bg-gray-50">Số Km</th>
                        <th className="p-3 text-right bg-gray-50">Nhiên liệu</th>
                        <th className="p-3 text-right bg-gray-50">Bảo dưỡng</th>
                        <th className="p-3 text-right bg-gray-50 text-indigo-600" title="Đăng kiểm, Bảo hiểm, Khấu hao">ĐK / BH / KH</th>
                        <th className="p-3 text-right font-bold text-red-600 bg-gray-50">Tổng CP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewHistoryCosts.slice().reverse().map((cost, idx) => {
                        const phikhac = (Number(cost.cp_thue_khau_hao) || 0) + (Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0);
                        const total = (Number(cost.cp_nhien_lieu) || 0) + (Number(cost.cp_cau_duong_ben_bai) || 0) + (Number(cost.cp_rua_xe) || 0) + (Number(cost.cp_bao_duong_sua_chua) || 0) + phikhac;
                        const costId = getCostId(cost) || `table-${idx}`;
                        return (
                          <tr key={costId} className="hover:bg-blue-50/30 text-xs">
                            <td className="p-3 font-bold text-[#05469B] bg-white">{formatMonthYear(cost.thang_nam)}</td>
                            <td className="p-3 font-medium text-emerald-600 bg-white">{formatCurrency(cost.km_hien_tai)}</td>
                            <td className="p-3 text-right bg-white">{formatCurrency(cost.cp_nhien_lieu)}</td>
                            <td className="p-3 text-right bg-white">{formatCurrency(cost.cp_bao_duong_sua_chua)}</td>
                            <td className="p-3 text-right bg-white text-indigo-600">{formatCurrency(phikhac)}</td>
                            <td className="p-3 text-right font-black text-red-600 bg-white">{formatCurrency(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0 rounded-b-2xl">
              <button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors">Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL CHI PHÍ HOẠT ĐỘNG --- */}
      {isCostModalOpen && selectedCarForCost && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setCostModal(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="bg-white shadow-2xl w-full max-w-md md:max-w-xl h-full flex flex-col animate-in slide-in-from-right duration-300 relative z-10">

            <div className="p-5 border-b border-indigo-100 bg-indigo-600 text-white flex justify-between items-start shrink-0">
              <div className="flex-1 pr-4">
                <h3 className="text-xl font-black flex items-center gap-2 mb-1.5"><Receipt size={20} /> Khai báo Chi phí</h3>
                <p className="text-sm text-indigo-100 font-medium leading-relaxed">
                  <span className="text-white font-bold text-base tracking-wider">{selectedCarForCost.bien_so}</span>
                  <span className="mx-2 opacity-60">|</span>
                  {selectedCarForCost.hieu_xe} {selectedCarForCost.loai_xe}
                  <span className="mx-2 opacity-60">|</span>
                  {getUnitFullName(selectedCarForCost.id_don_vi)}
                </p>
              </div>
              <button onClick={() => setCostModal(prev => ({ ...prev, isOpen: false }))} className="text-indigo-200 hover:text-white bg-indigo-700/50 hover:bg-indigo-700 p-2 rounded-full transition-colors mt-1 shrink-0"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col min-h-0 custom-scrollbar">
              <div className="p-5 bg-white border-b border-gray-200 shadow-sm z-10 shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5"><Calendar size={16} className="text-indigo-600" /> {costModalMode === 'create' ? 'Khai báo tháng mới' : 'Cập nhật tháng'}</h4>
                  {costModalMode === 'update' && (
                    <button onClick={() => { setCostModal(prev => ({ ...prev, mode: 'create' })); setCostFormData({ id: '', thang_nam: new Date().toISOString().slice(0, 7), id_ts_xe: selectedCarForCost.id, id_don_vi: selectedCarForCost.id_don_vi, km_hien_tai: '', so_lit_nhien_lieu: '', cp_nhien_lieu: '', cp_cau_duong_ben_bai: '', cp_rua_xe: '', cp_bao_duong_sua_chua: '', cp_thue_khau_hao: '', cp_dang_kiem: '', cp_bh_tnds: '', cp_bh_vc: '', ghi_chu: '' }) }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={14} /> Thêm mới</button>
                  )}
                </div>
                <form onSubmit={handleCostSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Tháng khai báo *</label><input type="month" required name="thang_nam" value={costFormData.thang_nam || ''} onChange={handleInputCostChange} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0] text-indigo-900 font-bold" /></div>

                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Km hiện tại (Đồng hồ)</label><input type="text" name="km_hien_tai" value={formatCurrency(costFormData.km_hien_tai)} onChange={handleInputCostChange} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" /></div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Số Lít nhiên liệu tiêu thụ</label><input type="number" name="so_lit_nhien_lieu" value={costFormData.so_lit_nhien_lieu || ''} onChange={handleInputCostChange} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" /></div>

                    <div className="col-span-2 border-t border-gray-100 pt-3 mt-1"><p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Chi phí Vận hành (Hỗ trợ nhập phép tính +, -, *, /)</p></div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Nhiên liệu</label>
                      <input type="text" name="cp_nhien_lieu" value={formatMathInput(costFormData.cp_nhien_lieu)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_nhien_lieu', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_nhien_lieu')} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Cầu đường, bến bãi</label>
                      <input type="text" name="cp_cau_duong_ben_bai" value={formatMathInput(costFormData.cp_cau_duong_ben_bai)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_cau_duong_ben_bai', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_cau_duong_ben_bai')} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Rửa xe</label>
                      <input type="text" name="cp_rua_xe" value={formatMathInput(costFormData.cp_rua_xe)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_rua_xe', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_rua_xe')} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Bảo dưỡng, sửa chữa</label>
                      <input type="text" name="cp_bao_duong_sua_chua" value={formatMathInput(costFormData.cp_bao_duong_sua_chua)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_bao_duong_sua_chua', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_bao_duong_sua_chua')} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" />
                    </div>

                    <div className="col-span-2 border-t border-gray-100 pt-3 mt-1"><p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Chi phí Pháp lý & Khấu hao</p></div>

                    {/* 🟢 3 CỘT CHI PHÍ MỚI */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Phí Đăng kiểm</label>
                      <input type="text" name="cp_dang_kiem" value={formatMathInput(costFormData.cp_dang_kiem)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_dang_kiem', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_dang_kiem')} className="w-full p-2 text-sm border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-800" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Phí Bảo hiểm TNDS</label>
                      <input type="text" name="cp_bh_tnds" value={formatMathInput(costFormData.cp_bh_tnds)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_bh_tnds', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_bh_tnds')} className="w-full p-2 text-sm border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-800" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Phí BH Vật chất</label>
                      <input type="text" name="cp_bh_vc" value={formatMathInput(costFormData.cp_bh_vc)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_bh_vc', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_bh_vc')} className="w-full p-2 text-sm border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-800" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Thuê ngoài / Khấu hao</label>
                      <input type="text" name="cp_thue_khau_hao" value={formatMathInput(costFormData.cp_thue_khau_hao)} onChange={handleInputCostChange} onBlur={(e) => handleCostMathBlur('cp_thue_khau_hao', e.target.value)} onKeyDown={(e) => handleCostMathKeyDown(e, 'cp_thue_khau_hao')} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0]" />
                    </div>

                    <div className="col-span-2"><label className="block text-[11px] font-bold text-gray-600 mb-1">Ghi chú (Nơi sửa chữa, lý do...)</label><textarea name="ghi_chu" value={costFormData.ghi_chu || ''} onChange={handleInputCostChange} rows={2} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0] resize-none"></textarea></div>
                  </div>
                  <button type="submit" disabled={submitting} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex justify-center items-center gap-2 transition-colors shadow-md mt-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {costModalMode === 'create' ? 'Lưu Chi Phí' : 'Cập Nhật Thay Đổi'}
                  </button>
                </form>
              </div>

              <div className="p-5 flex-1">
                <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-3">Lịch sử khai báo ({carCosts.length} tháng)</h4>
                <div className="space-y-3">
                  {carCosts.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300"><Info className="mx-auto w-6 h-6 mb-2 opacity-50" /><p className="text-sm font-medium">Chưa có dữ liệu chi phí nào</p></div>
                  ) : (
                    carCosts.map((cost, idx) => {
                      const tongCP = (Number(cost.cp_nhien_lieu) || 0) + (Number(cost.cp_cau_duong_ben_bai) || 0) + (Number(cost.cp_rua_xe) || 0) + (Number(cost.cp_bao_duong_sua_chua) || 0) + (Number(cost.cp_thue_khau_hao) || 0) + (Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0);
                      const costId = getCostId(cost) || `log-${idx}`;
                      return (
                        <div key={costId} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-sm">{formatMonthYear(cost.thang_nam)}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editCost(cost)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                              <button onClick={() => { setItemToDelete({ id: costId, type: 'chiphi' }); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                            <div className="text-gray-500">Số Km: <span className="font-semibold text-gray-800">{formatCurrency(cost.km_hien_tai)}</span></div>
                            <div className="text-gray-500 text-right">Lít NL: <span className="font-semibold text-gray-800">{cost.so_lit_nhien_lieu} L</span></div>
                            <div className="text-gray-500">Nhiên liệu: <span className="font-semibold text-gray-800">{formatCurrency(cost.cp_nhien_lieu)}</span></div>
                            <div className="text-gray-500 text-right">Bảo dưỡng: <span className="font-semibold text-gray-800">{formatCurrency(cost.cp_bao_duong_sua_chua)}</span></div>
                            <div className="text-gray-500 col-span-2 mt-1 pt-1 border-t border-gray-50">ĐK & Bảo hiểm: <span className="font-semibold text-emerald-600">{formatCurrency((Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0))}</span></div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                            <span className="text-xs font-bold text-gray-400">TỔNG CHI PHÍ:</span>
                            <span className="text-sm font-black text-red-600">{formatCurrency(tongCP)} VNĐ</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* --- MODAL CẬP NHẬT TRẠNG THÁI XE (TAB HIỆN HỮU) --- */}
      {statusModalCar && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#005698] to-[#04367a] text-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5" />
                <h3 className="text-base font-bold">Cập nhật Trạng thái xe</h3>
              </div>
              <button
                onClick={() => setStatusModalCar(null)}
                className="text-white/80 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Car summary badge */}
              <div className="bg-blue-50/70 dark:bg-slate-800/80 p-3 rounded-xl border border-blue-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-black text-[#005698] dark:text-blue-400 text-sm">🚙 {statusModalCar.bien_so}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{statusModalCar.hieu_xe} {statusModalCar.loai_xe}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Trạng thái hiện tại</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyle(statusModalCar.hien_trang)}`}>
                    {getStatusEmoji(statusModalCar.hien_trang)} {statusModalCar.hien_trang}
                  </span>
                </div>
              </div>

              {/* 5 Status Options */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Chọn trạng thái mới</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'Đang hoạt động', emoji: '🟢', desc: 'Xe sẵn sàng phục vụ và hoạt động bình thường' },
                    { id: 'Sửa chữa', emoji: '🟡', desc: 'Xe đang bảo dưỡng, sửa chữa tại xưởng' },
                    { id: 'Ngưng hoạt động', emoji: '🔴', desc: 'Tạm ngừng sử dụng hoặc chờ phân bổ' },
                    { id: 'Chuyển KD xe QSD', emoji: '🔵', desc: 'Chuyển sang kinh doanh xe đã qua sử dụng' },
                    { id: 'Đã Thanh lý', emoji: '⚫', desc: 'Kết thúc vòng đời xe, giải phóng biển số để tái cấp' },
                  ].map(opt => {
                    const isSelected = newStatus === opt.id;
                    const isLiquidate = opt.id === 'Đã Thanh lý';
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setNewStatus(opt.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${isSelected
                          ? isLiquidate
                            ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20'
                            : 'border-[#005698] bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 hover:bg-gray-50/60 dark:hover:bg-slate-800/60'
                          }`}
                      >
                        <input
                          type="radio"
                          name="modal_new_status"
                          checked={isSelected}
                          onChange={() => setNewStatus(opt.id)}
                          className="mt-0.5 text-[#005698] focus:ring-[#005698]"
                        />
                        <div className="flex-1">
                          <p className={`text-xs font-bold flex items-center gap-1.5 ${isSelected ? (isLiquidate ? 'text-red-700 dark:text-red-400 font-black' : 'text-[#005698] dark:text-blue-400 font-black') : 'text-gray-800 dark:text-gray-200'
                            }`}>
                            <span>{opt.emoji}</span>
                            <span>{opt.id}</span>
                            {isLiquidate && <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-100 text-red-700 font-bold border border-red-200">Quan trọng</span>}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warning & Date if Đã Thanh lý */}
              {newStatus === 'Đã Thanh lý' && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex flex-col gap-2.5 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2 text-red-700 dark:text-red-400 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>
                      <strong>Cảnh báo:</strong> Xe sẽ được chuyển sang tab <strong>Thanh lý</strong>. Biển số <strong>{statusModalCar.bien_so}</strong> sẽ được giải phóng để có thể tái cấp cho xe khác.
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-red-800 dark:text-red-300 mb-1">
                      Ngày thanh lý <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={liquidationDate}
                      onChange={e => setLiquidationDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-red-300 dark:border-red-800 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              )}

              {/* Ghi chú lý do */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú / Lý do (tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: Quyết định thanh lý số 123/QĐ..."
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#005698] bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStatusModalCar(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveStatus}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${newStatus === 'Đã Thanh lý'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#005698] hover:bg-[#004880]'
                    }`}
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{newStatus === 'Đã Thanh lý' ? 'Xác nhận Thanh lý' : 'Lưu trạng thái'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL XÁC NHẬN TÁI CẤP BIỂN SỐ XE ĐÃ THANH LÝ --- */}
      {reassignModal.isOpen && reassignModal.oldCar && createPortal(
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                <h3 className="text-base font-bold">Xác nhận Tái cấp Biển số xe đã thanh lý</h3>
              </div>
              <button
                onClick={() => setReassignModal(prev => ({ ...prev, isOpen: false, oldCar: null, pendingCarData: null }))}
                className="text-white/80 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-300">
                <p className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <span>ℹ️</span> Biển số đã từng được sử dụng trước đây
                </p>
                <p>
                  Biển số <strong>{reassignModal.pendingCarData?.bien_so}</strong> trước đây thuộc về một phương tiện đã được thanh lý. Dưới đây là thông tin xe cũ trong lịch sử:
                </p>
              </div>

              {/* Thông tin xe thanh lý cũ */}
              <div className="bg-gray-50 dark:bg-slate-800/70 p-4 rounded-xl border border-gray-200 dark:border-slate-700 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Biển số cũ</p>
                  <p className="font-black text-[#005698] dark:text-blue-400 text-sm mt-0.5">{reassignModal.oldCar.bien_so}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Ngày thanh lý</p>
                  <p className="font-bold text-red-600 dark:text-red-400 mt-0.5">{formatDateDisplay(reassignModal.oldCar.ngay_thanh_ly)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Hãng - Loại xe cũ</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{reassignModal.oldCar.hieu_xe} {reassignModal.oldCar.loai_xe}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Số khung cũ</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{reassignModal.oldCar.so_khung || '---'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Đơn vị quản lý trước đây</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{donViMap[reassignModal.oldCar.id_don_vi] || reassignModal.oldCar.id_don_vi || '---'}</p>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Bạn có chắc chắn muốn <strong>TÁI CẤP BIỂN SỐ NÀY</strong> cho xe mới (<em>{reassignModal.pendingCarData?.hieu_xe} {reassignModal.pendingCarData?.loai_xe}</em>) không? Hệ thống sẽ lưu và ghi nhận audit log liên kết lịch sử.
              </p>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReassignModal(prev => ({ ...prev, isOpen: false, oldCar: null, pendingCarData: null }))}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy (Sửa lại biển số)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={executeSaveWithReassignedPlate}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Xác nhận Cấp lại Biển số</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL XÓA VĨNH VIỄN XE THANH LÝ (HARD DELETE) --- */}
      {permanentDeleteCar && createPortal(
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-200 dark:border-red-900">
            {/* Header */}
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-base font-bold">XÓA VĨNH VIỄN XE THANH LÝ</h3>
              </div>
              <button
                onClick={() => setPermanentDeleteCar(null)}
                className="text-white/80 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400">
                <p className="font-black text-sm mb-1">⚠️ CẢNH BÁO NGUY HIỂM</p>
                <p>
                  Hành động này sẽ <strong>XÓA VĨNH VIỄN</strong> dữ liệu xe và toàn bộ các khoản chi phí hoạt động liên quan khỏi hệ thống.
                </p>
                <p className="mt-1 font-bold">
                  HÀNH ĐỘNG NÀY KHÔNG THỂ HOÀN TÁC!
                </p>
              </div>

              {/* Thông tin xe */}
              <div className="bg-gray-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 space-y-1.5">
                <p><span className="text-gray-400 font-bold">Biển số:</span> <strong className="text-red-600 text-sm">🚙 {permanentDeleteCar.bien_so}</strong></p>
                <p><span className="text-gray-400 font-bold">Hãng - Loại xe:</span> <strong>{permanentDeleteCar.hieu_xe} {permanentDeleteCar.loai_xe}</strong></p>
                <p><span className="text-gray-400 font-bold">Số khung:</span> <strong>{permanentDeleteCar.so_khung || '---'}</strong></p>
                <p><span className="text-gray-400 font-bold">Ngày thanh lý:</span> <strong>{formatDateDisplay(permanentDeleteCar.ngay_thanh_ly)}</strong></p>
                <p><span className="text-gray-400 font-bold">Đơn vị quản lý:</span> <strong>{donViMap[permanentDeleteCar.id_don_vi] || permanentDeleteCar.id_don_vi || '---'}</strong></p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPermanentDeleteCar(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handlePermanentDelete}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Xác nhận Xóa vĩnh viễn</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- XÁC NHẬN XÓA --- */}
      {isConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa dữ liệu vĩnh viễn.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
              <button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Xóa</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isBulkImportOpen && (
        <PasteImportModal
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          onSave={handleBulkImportSave}
          title={bulkImportMode === 'update' ? "Dán Excel - Cập nhật thông tin xe hàng loạt" : "Dán Excel - Thêm mới xe hàng loạt"}
          columnMapping={pasteColumns}
          onValidateRow={handleValidatePasteRow}
        />
      )}
    </div>
  );
}