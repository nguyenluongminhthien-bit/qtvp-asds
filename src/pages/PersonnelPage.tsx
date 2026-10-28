import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save,
  Users, ShieldCheck, Flame, LifeBuoy, Heart, Activity,
  Dumbbell, Car, Utensils, Coffee, Languages, Monitor, Copy, Eye, EyeOff, User as UserIcon,
  Building2, Phone, Mail, Info, MapPin, ChevronDown, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen, CheckCheck, Briefcase,
  LogOut, AlertTriangle, Image as ImageIcon, RotateCcw, Download, FileSpreadsheet, ClipboardPaste,
  BarChart3, PieChart as PieChartIcon, TrendingUp, Cake, Filter, Layers, Tag, Sparkles, Wrench, Settings2, UserPlus, UserCheck, ArrowRightLeft
} from 'lucide-react';
import { apiService } from '../services/api';
import { Personnel, DonVi, ThietBi } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getAllSubordinateIds, getDefaultUnitId } from '../utils/hierarchy';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import { formatPhoneNumber, getDirectImageLink, formatCurrencySpace as formatCurrency, toUnaccented, stripAccents } from '../utils/formatters';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import SegmentTabs from '../components/ui/SegmentTabs';
import PersonnelModal from '../components/personnel/PersonnelModal';
import { motion, AnimatePresence } from 'motion/react';

import { calcGiaTriDen, getChungNhanByNhom } from '../utils/atvsld';
import CuocDiDongTab from '../components/personnel/CuocDiDongTab';
import PersonnelDetailCuocChart from '../components/personnel/PersonnelDetailCuocChart';
import { CERTIFICATES } from '../constants/certificates';
import { getKhamSucKhoeCaNhan } from '../services/api/modules';
import PersonnelDashboardTab from '../components/personnel/PersonnelDashboardTab';
import PersonnelNgachLuongTab from '../components/personnel/PersonnelNgachLuongTab';

const extractStartDateFromMaNV = (maNV: string) => {
  if (!maNV || maNV.length < 4) return null;
  const yy = maNV.substring(0, 2);
  const mm = maNV.substring(2, 4);
  const monthNum = parseInt(mm, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return null;
  const fullYear = parseInt(yy, 10) > 50 ? `19${yy}` : `20${yy}`;
  return `${fullYear}-${mm}-01`;
};

const getUnitDepth = (unitId: string, allUnits: DonVi[]): number => {
  const strId = String(unitId || '').trim();
  if (!strId) return 999;
  let depth = 0;
  let currentId = strId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parent = allUnits.find(u => String(u.id) === String(currentId));
    if (!parent) {
      if (depth === 0) return 999;
      break;
    }
    const parentId = parent.cap_quan_ly?.trim() || '';
    if (!parentId || parentId === 'HO' || parentId === 'DV_HO') {
      break;
    }
    currentId = parentId;
    depth++;
  }
  return depth;
};

const isKiemTitle = (title?: string): boolean => {
  const clean = stripAccents(title || '').toLowerCase();
  return clean.includes('kiem') || clean.includes('kiêm');
};

const chucDanhOrder: Record<string, number> = {
  'Ban Lãnh đạo': 1, 'Ban lãnh đạo': 1, 'Lãnh đạo': 1,
  'Chủ tịch': 2,
  'Tổng Giám đốc': 3, 'Phó Tổng Giám đốc': 4,
  'Giám đốc': 5, 'Phó Giám đốc': 6,
  'Trưởng phòng': 7, 'Trưởng bộ phận': 8, 'Phó phòng': 9, 'Phó bộ phận': 9,
  'Trợ lý': 10, 'Trưởng nhóm': 11, 'Tổ trưởng': 12, 'Tổ phó': 13,
  'Chuyên viên': 14, 'PT DVHT KD': 14, 'PT DVHC': 15, 'PT NS': 16,
  'BV, ĐTKH': 17, 'Nhân viên': 18, 'Chưa phân loại': 99
};

const getChucDanhRank = (chucDanh?: string): number => {
  const cd = (chucDanh || '').trim();
  if (!cd) return 99;
  if (chucDanhOrder[cd] !== undefined) return chucDanhOrder[cd];
  const clean = stripAccents(cd).toLowerCase();
  if (clean.includes('lanh dao')) return 1;
  if (clean.includes('chu tich')) return 2;
  if (clean.includes('tong giam doc')) return 3;
  if (clean.includes('pho tong giam doc')) return 4;
  if (clean.includes('pho giam doc')) return 6;
  if (clean.includes('giam doc')) return 5;
  if (clean.includes('truong phong')) return 7;
  if (clean.includes('truong bo phan')) return 8;
  if (clean.includes('pho phong') || clean.includes('pho bo phan')) return 9;
  if (clean.includes('tro ly')) return 10;
  if (clean.includes('truong nhom')) return 11;
  if (clean.includes('to truong')) return 12;
  if (clean.includes('to pho')) return 13;
  if (clean.includes('chuyen vien')) return 14;
  if (clean.includes('nhan vien')) return 18;
  return 99;
};

// 🟢 Hàm so sánh nhân sự chuẩn theo 3 mức ưu tiên:
// Ưu tiên 1 - Cấp đơn vị trong sơ đồ tổ chức (getUnitDepth)
// Ưu tiên 2 - Chức vụ chính thức (không chứa từ kiêm/kiêm nhiệm xếp trước)
// Ưu tiên 3 - Cấp bậc phân loại cán bộ lãnh đạo (chucDanhOrder)
const comparePersonnel = (a: any, b: any, donViList: DonVi[]): number => {
  // 0. Nhân sự đã nghỉ việc / điều chuyển luôn xếp ở dưới cùng
  const isInactiveA = a.trang_thai === 'Đã nghỉ việc' || a.trang_thai === 'Đã điều chuyển';
  const isInactiveB = b.trang_thai === 'Đã nghỉ việc' || b.trang_thai === 'Đã điều chuyển';
  if (isInactiveA && !isInactiveB) return 1;
  if (!isInactiveA && isInactiveB) return -1;

  // Ưu tiên 1 - Cấp đơn vị trong sơ đồ tổ chức (depth nhỏ hơn = cấp cao hơn)
  const depthA = getUnitDepth(a.id_don_vi, donViList);
  const depthB = getUnitDepth(b.id_don_vi, donViList);
  if (depthA !== depthB) return depthA - depthB;

  // Ưu tiên 2 - Chức vụ chính thức (chính thức xếp trước kiêm nhiệm)
  const isKiemA = isKiemTitle(a.chuc_vu);
  const isKiemB = isKiemTitle(b.chuc_vu);
  if (!isKiemA && isKiemB) return -1;
  if (isKiemA && !isKiemB) return 1;

  // Ưu tiên 3 - Cấp bậc phân loại cán bộ lãnh đạo
  const orderA = getChucDanhRank(a.chuc_danh);
  const orderB = getChucDanhRank(b.chuc_danh);
  if (orderA !== orderB) return orderA - orderB;

  // Tiêu chí phụ 1: Thứ tự đơn vị trong sơ đồ tổ chức (thu_tu)
  const unitA = donViList.find(u => String(u.id) === String(a.id_don_vi));
  const unitB = donViList.find(u => String(u.id) === String(b.id_don_vi));
  const thuTuA = unitA ? (Number(unitA.thu_tu) || 999) : 999;
  const thuTuB = unitB ? (Number(unitB.thu_tu) || 999) : 999;
  if (thuTuA !== thuTuB) return thuTuA - thuTuB;

  // Tiêu chí phụ 2: Thời gian tạo
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return timeA - timeB;
};


const PersonnelDesktopRow = React.memo(({ item, props }: any) => {
  const { showSelectCheckboxes, selectedPersonnelIds, handleSelectRow, donViMap, hasRule, handleView, handleDuplicate, openModal, handleOffboardClick, setPersonnelToRehire, setIsRehireModalOpen, setItemToDelete, setIsConfirmOpen, calculateSeniority } = props;
  return (
    <tr className={`hover:bg-blue-50/50 transition-colors group ${item.trang_thai === 'Đã nghỉ việc' || item.trang_thai === 'Đã điều chuyển' ? 'opacity-60 bg-gray-50' : ''}`}>
      {showSelectCheckboxes && (
        <td className="py-2.5 px-3 text-center align-middle">
          <input
            type="checkbox"
            checked={selectedPersonnelIds.includes(item.id)}
            onChange={(e) => handleSelectRow(item.id, e.target.checked)}
            className="w-4 h-4 text-[#05469B] rounded border-gray-300 focus:ring-[#05469B] cursor-pointer"
          />
        </td>
      )}
      <td className="py-2.5 pl-3 pr-1.5 font-semibold text-gray-800 whitespace-nowrap text-[11px] align-middle text-left">{item.ma_so_nhan_vien}</td>
      <td className="py-2.5 pl-3 pr-1.5 align-middle text-left">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            {item.hinh_anh ? <img src={getDirectImageLink(item.hinh_anh)} alt="" className="w-full h-full object-cover" /> : <UserIcon size={14} className="text-gray-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-[#00539c] leading-snug text-[13px] whitespace-nowrap">{item.ho_ten}</p>
            </div>
            {(item.email || item.trang_thai === 'Đã nghỉ việc' || item.trang_thai === 'Đã điều chuyển') && (
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {item.email && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(item.email);
                      toast.success(`Đã sao chép email: ${item.email}`);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-[#00539c] border border-blue-200/70 transition-all cursor-pointer shadow-2xs max-w-full truncate"
                    title="Bấm để sao chép địa chỉ email"
                  >
                    <Mail size={10} className="shrink-0 text-blue-500" />
                    <span className="truncate">{item.email}</span>
                  </button>
                )}
                {item.trang_thai === 'Đã nghỉ việc' && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase">Đã nghỉ việc</span>}
                {item.trang_thai === 'Đã điều chuyển' && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded uppercase">Đã điều chuyển</span>}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="py-2.5 px-3 align-middle text-left">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-gray-800 text-[12px] leading-snug" title={item.chuc_vu}>{item.chuc_vu || '---'}</p>
            {item.is_kiem_nhiem_single && !item.kiem_nhiem_list?.length && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                Kiêm nhiệm
              </span>
            )}
          </div>
          {((item.phong_ban && item.phong_ban !== '-' && item.phong_ban !== 'Chưa phân bộ' && item.phong_ban !== 'Chưa có') || (item.khoi && item.khoi !== '-' && item.khoi !== 'Chưa có')) && (
            <div className="flex items-center gap-1 mt-0.5 overflow-hidden whitespace-nowrap">
              {item.phong_ban && item.phong_ban !== '-' && item.phong_ban !== 'Chưa phân bộ' && item.phong_ban !== 'Chưa có' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs truncate max-w-[180px]" title={`Bộ phận: ${item.phong_ban}`}>
                  {item.phong_ban}
                </span>
              )}
              {item.khoi && item.khoi !== '-' && item.khoi !== 'Chưa có' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs truncate max-w-[180px]" title={`Khối: ${item.khoi}`}>
                  {String(item.khoi).startsWith('Khối') ? item.khoi : `${item.khoi}`}
                </span>
              )}
            </div>
          )}

          {/* 🟢 Hiển thị các vai trò kiêm nhiệm gộp (đồng bộ tông màu & viền amber) */}
          {item.kiem_nhiem_list && item.kiem_nhiem_list.length > 0 && (
            <div className="mt-1.5 space-y-1 pt-1 border-t border-dashed border-amber-200/60">
              {item.kiem_nhiem_list.map((kn: any, knIdx: number) => (
                <div key={knIdx} className="flex items-center gap-1.5 text-[10px] text-amber-900 bg-amber-50/80 hover:bg-amber-100/70 border border-amber-200/90 rounded px-1.5 py-0.5 transition-colors shadow-2xs">
                  <span className="font-extrabold text-amber-800 bg-amber-100/90 px-1 py-0.2 rounded border border-amber-200 text-[9px] uppercase shrink-0">Kiêm:</span>
                  <span className="font-bold text-amber-950 truncate" title={kn.chuc_vu}>{kn.chuc_vu}</span>
                  <span className="text-amber-300">|</span>
                  <span className="text-amber-800/90 text-[9.5px] truncate font-medium" title={kn.ten_don_vi}>({kn.ten_don_vi})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3 text-[11.5px] font-medium text-gray-700 leading-normal align-middle text-left">
        <div>
          <p className="font-semibold text-gray-800">{donViMap[String(item.id_don_vi)] || item.id_don_vi || '-'}</p>
          {item.kiem_nhiem_list && item.kiem_nhiem_list.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5">
              {item.kiem_nhiem_list.map((kn: any, knIdx: number) => (
                <span key={knIdx} className="text-[10px] text-amber-800 font-medium truncate flex items-center gap-1" title={kn.ten_don_vi}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                  {kn.ten_don_vi}
                </span>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap align-middle text-left">
        <div className="flex flex-col gap-1 text-[11px]">
          {item.sdt_cong_ty && <a href={`tel:${String(item.sdt_cong_ty).replace(/\D/g, '')}`} className="font-bold text-[#05469B] hover:underline flex items-center gap-1 w-fit"><Phone size={11} className="text-blue-400" /> {formatPhoneNumber(item.sdt_cong_ty)}</a>}
          {item.sdt_ca_nhan && (
            hasRule('NS_HIDE_SENSITIVE') ? (
              <span className="text-gray-400 font-medium flex items-center gap-1 w-fit"><Lock size={11} className="text-gray-300" /> ***</span>
            ) : (
              <a href={`tel:${String(item.sdt_ca_nhan).replace(/\D/g, '')}`} className="font-bold text-emerald-500 hover:underline flex items-center gap-1 w-fit"><Phone size={11} className="text-emerald-400" /> {formatPhoneNumber(item.sdt_ca_nhan)}</a>
            )
          )}
          {!item.sdt_cong_ty && !item.sdt_ca_nhan && <span className="text-gray-400 font-medium">---</span>}
        </div>
      </td>
      <td className="py-2.5 px-3 text-[11.5px] font-medium text-emerald-600 whitespace-nowrap align-middle text-left">
        <span className={`rounded-md inline-block px-1.5 py-0.5 border ${item.trang_thai === 'Đã nghỉ việc' || item.trang_thai === 'Đã điều chuyển' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50/50 border-emerald-100'}`}>{calculateSeniority(item.ngay_nhan_vien, item.trang_thai || 'Đang làm việc', item.ngay_nghi_viec || '')}</span>
      </td>
      <td className="py-2.5 px-3 align-middle text-center">
        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleView(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" title="Xem chi tiết"><Eye className="w-3.5 h-3.5" /></button>
          {item.trang_thai !== 'Đã nghỉ việc' && item.trang_thai !== 'Đã điều chuyển' && (
            <>
              <button onClick={() => handleDuplicate(item)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Nhân bản (Tạo hồ sơ kiêm nhiệm)"><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Sửa"><Edit className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleOffboardClick(item)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-md transition-colors border border-transparent hover:border-orange-200" title="Điều chuyển / Nghỉ việc"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
            </>
          )}
          {(item.trang_thai === 'Đã nghỉ việc' || item.trang_thai === 'Đã điều chuyển') && (
            <>
              <button onClick={() => { setPersonnelToRehire(item); setIsRehireModalOpen(true); }} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Vào làm lại"><RotateCcw className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Xóa vĩnh viễn"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.props.showSelectCheckboxes === next.props.showSelectCheckboxes &&
    prev.props.selectedPersonnelIds.includes(prev.item.id) === next.props.selectedPersonnelIds.includes(next.item.id);
});

const PersonnelMobileCard = React.memo(({ item, props }: any) => {
  const { showSelectCheckboxes, selectedPersonnelIds, handleSelectRow, donViMap, hasRule, handleView, handleDuplicate, openModal, handleOffboardClick, setPersonnelToRehire, setIsRehireModalOpen, setItemToDelete, setIsConfirmOpen, calculateSeniority } = props;
  const seniorityStr = calculateSeniority(item.ngay_nhan_vien, item.trang_thai || 'Đang làm việc', item.ngay_nghi_viec || '');
  return (
    <div className={`p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative flex flex-col gap-3 transition-all ${item.trang_thai === 'Đã nghỉ việc' || item.trang_thai === 'Đã điều chuyển' ? 'opacity-70 bg-gray-50' : ''}`}>
      <div className="flex items-center gap-3 pb-2.5 border-b border-gray-100">
        {showSelectCheckboxes && (
          <input
            type="checkbox"
            checked={selectedPersonnelIds.includes(item.id)}
            onChange={(e) => handleSelectRow(item.id, e.target.checked)}
            className="w-4 h-4 text-[#05469B] rounded border-gray-300 focus:ring-[#05469B] shrink-0 cursor-pointer"
          />
        )}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
          {item.hinh_anh ? <img src={getDirectImageLink(item.hinh_anh)} alt="" className="w-full h-full object-cover" /> : <UserIcon size={16} className="text-gray-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-gray-500 text-[10px]">ID: {item.ma_so_nhan_vien}</span>
            {item.trang_thai === 'Đã nghỉ việc' ? (
              <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase">Đã nghỉ việc</span>
            ) : item.trang_thai === 'Đã điều chuyển' ? (
              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase">Đã điều chuyển</span>
            ) : (
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase">Đang làm việc</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <h4 className="font-extrabold text-[#00539c] text-sm leading-snug truncate">{item.ho_ten}</h4>
          </div>
          {item.email && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(item.email);
                toast.success(`Đã sao chép email: ${item.email}`);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-[#00539c] border border-blue-200/70 transition-all cursor-pointer shadow-2xs"
              title="Bấm để sao chép địa chỉ email"
            >
              <Mail size={10} className="shrink-0 text-blue-500" />
              <span className="truncate">{item.email}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div className="col-span-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Chức vụ &amp; Bộ phận</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-gray-800 leading-normal">{item.chuc_vu || '---'}</p>
            {item.is_kiem_nhiem_single && !item.kiem_nhiem_list?.length && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                Kiêm nhiệm
              </span>
            )}
          </div>
          {((item.phong_ban && item.phong_ban !== '-' && item.phong_ban !== 'Chưa phân bộ' && item.phong_ban !== 'Chưa có') || (item.khoi && item.khoi !== '-' && item.khoi !== 'Chưa có')) && (
            <div className="flex items-center gap-1.5 mt-1">
              {item.phong_ban && item.phong_ban !== '-' && item.phong_ban !== 'Chưa phân bộ' && item.phong_ban !== 'Chưa có' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  BP: {item.phong_ban}
                </span>
              )}
              {item.khoi && item.khoi !== '-' && item.khoi !== 'Chưa có' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {String(item.khoi).startsWith('Khối') ? item.khoi : `Khối: ${item.khoi}`}
                </span>
              )}
            </div>
          )}
          {item.kiem_nhiem_list && item.kiem_nhiem_list.length > 0 && (
            <div className="mt-1.5 space-y-1 pt-1 border-t border-dashed border-amber-200/60">
              {item.kiem_nhiem_list.map((kn: any, knIdx: number) => (
                <div key={knIdx} className="flex items-center gap-1.5 text-[10px] text-amber-900 bg-amber-50/80 border border-amber-200/90 rounded px-1.5 py-0.5 shadow-2xs">
                  <span className="font-extrabold text-amber-800 bg-amber-100/90 px-1 py-0.2 rounded border border-amber-200 text-[9px] uppercase shrink-0">Kiêm:</span>
                  <span className="font-bold text-amber-950 truncate">{kn.chuc_vu}</span>
                  <span className="text-amber-300">|</span>
                  <span className="text-amber-800/90 text-[9px] truncate">({kn.ten_don_vi})</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Đơn vị quản lý</p>
          <p className="font-medium text-gray-700 leading-normal">{donViMap[String(item.id_don_vi)] || item.id_don_vi || '-'}</p>
          {item.kiem_nhiem_list && item.kiem_nhiem_list.length > 0 && (
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">
              Kiêm: {item.kiem_nhiem_list.map((k: any) => k.ten_don_vi).join(', ')}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Điện thoại</p>
          <div className="flex flex-col gap-1 mt-1">
            {item.sdt_cong_ty && <a href={`tel:${String(item.sdt_cong_ty).replace(/\D/g, '')}`} className="font-bold text-[#05469B] hover:underline flex items-center gap-1 text-[11px]"><Phone size={11} className="text-blue-400 shrink-0" /> {formatPhoneNumber(item.sdt_cong_ty)}</a>}
            {item.sdt_ca_nhan && (
              hasRule('NS_HIDE_SENSITIVE') ? (
                <span className="text-gray-400 font-medium flex items-center gap-1 text-[11px]"><Lock size={11} className="text-gray-300 shrink-0" /> ***</span>
              ) : (
                <a href={`tel:${String(item.sdt_ca_nhan).replace(/\D/g, '')}`} className="font-bold text-emerald-600 hover:underline flex items-center gap-1 text-[11px]"><Phone size={11} className="text-emerald-400 shrink-0" /> {formatPhoneNumber(item.sdt_ca_nhan)}</a>
              )
            )}
            {!item.sdt_cong_ty && !item.sdt_ca_nhan && <span className="text-gray-400 font-medium">---</span>}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Thâm niên</p>
          <span className="mt-1 inline-block text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{seniorityStr}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-100 mt-1">
        <button onClick={() => handleView(item)} className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xem chi tiết"><Eye className="w-3.5 h-3.5" /> Xem</button>
        {item.trang_thai !== 'Đã nghỉ việc' && item.trang_thai !== 'Đã điều chuyển' && (
          <>
            <button onClick={() => handleDuplicate(item)} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Kiêm nhiệm"><Copy className="w-3.5 h-3.5" /> Kiêm nhiệm</button>
            <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit className="w-3.5 h-3.5" /> Sửa</button>
            <button onClick={() => handleOffboardClick(item)} className="p-1.5 text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Điều chuyển / Nghỉ việc"><ArrowRightLeft className="w-3.5 h-3.5" /> Chuyển/Nghỉ</button>
          </>
        )}
        {(item.trang_thai === 'Đã nghỉ việc' || item.trang_thai === 'Đã điều chuyển') && (
          <>
            <button onClick={() => { setPersonnelToRehire(item); setIsRehireModalOpen(true); }} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Vào làm lại"><RotateCcw className="w-3.5 h-3.5" /> Làm lại</button>
            <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa vĩnh viễn"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
          </>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.props.showSelectCheckboxes === next.props.showSelectCheckboxes &&
    prev.props.selectedPersonnelIds.includes(prev.item.id) === next.props.selectedPersonnelIds.includes(next.item.id);
});

export default function PersonnelPage() {
  const { user, canDelete, canCreate, canUpdate } = useAuth();
  const hasRule = (ruleId: string) => {
    if (!user) return false;
    if (String(user.quyen).toUpperCase() === 'ADMIN') return false;
    return String(user.quyen_chi_tiet || '').split(',').map(r => r.trim()).includes(ruleId);
  };
  const [data, setData] = useState<any[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personnelSearchTerm, setPersonnelSearchTerm] = useState('');
  const [filterPhongBan, setFilterPhongBan] = useState<string>('');
  const [filterKhoi, setFilterKhoi] = useState<string>('');
  const [filterChucVu, setFilterChucVu] = useState<string>('');
  const [filterChucDanh, setFilterChucDanh] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);
  const [isAddNewExpanded, setIsAddNewExpanded] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const debouncedPersonnelSearchTerm = useDebounce(personnelSearchTerm, 300);
  const debouncedUnitSearchTerm = useDebounce(unitSearchTerm, 300);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  const [phapNhanList, setPhapNhanList] = useState<any[]>([]);
  const [chuKyList, setChuKyList] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'cuoc'>('info');
  const [activeSubTabPersonnel, setActiveSubTabPersonnel] = useState<'ACTIVE' | 'OFFBOARD'>('ACTIVE');

  const [modal, setModal] = useState<{ isOpen: boolean; mode: 'create' | 'update'; formData: any; }>({ isOpen: false, mode: 'create', formData: {} });

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any | null>(null);
  const [showNgachLuong, setShowNgachLuong] = useState(false);
  const [showCCCD, setShowCCCD] = useState(false);
  const [kskHistoryView, setKskHistoryView] = useState<any[]>([]);
  const [loadingKskHistoryView, setLoadingKskHistoryView] = useState<boolean>(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [dupConfirmModal, setDupConfirmModal] = useState<{
    isOpen: boolean;
    dupInfo: { ho_ten: string; ten_don_vi: string; ma_so_nhan_vien: string } | null;
    onConfirm: () => void;
  }>({
    isOpen: false,
    dupInfo: null,
    onConfirm: () => { }
  });

  const chucDanhSuggestions = useMemo(() => {
    const list = data.map(p => String(p.chuc_danh || '').trim()).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [data]);



  const [isOffboardOpen, setIsOffboardOpen] = useState(false);
  const [personnelToOffboard, setPersonnelToOffboard] = useState<any | null>(null);
  const [unreturnedAssets, setUnreturnedAssets] = useState<any[]>([]);
  const [forceOffboard, setForceOffboard] = useState(false);
  const [checkingAssets, setCheckingAssets] = useState(false);

  const [activeSubTabStats, setActiveSubTabStats] = useState<'NHAN_SU' | 'DASHBOARD'>('NHAN_SU');

  // Thêm state cho Điều chuyển / Nghỉ việc
  const [transferType, setTransferType] = useState<'INTERNAL' | 'EXTERNAL' | 'OFFBOARD'>('INTERNAL');
  const [transferInternalUnitId, setTransferInternalUnitId] = useState('');
  const [transferExternalUnitName, setTransferExternalUnitName] = useState('');
  const [transferDiaDiem, setTransferDiaDiem] = useState('');
  const [transferKhoi, setTransferKhoi] = useState('');
  const [transferPhongBan, setTransferPhongBan] = useState('');
  const [transferChucDanh, setTransferChucDanh] = useState('');
  const [transferChucVu, setTransferChucVu] = useState('');

  const [transferSimAction, setTransferSimAction] = useState<'TRANSFER' | 'REVOKE'>('TRANSFER');
  const [personnelThueBao, setPersonnelThueBao] = useState<any | null>(null);
  const [transferAssetActions, setTransferAssetActions] = useState<Record<string, 'TRANSFER' | 'REVOKE'>>({});

  const khoiOptions = useMemo(() => {
    const base = [
      'Khối Bán lẻ',
      'Khối Thu mua',
      'Khối KD Xuất khẩu',
      'Khối KD Cơ khí và CNHT',
      'Khối KD xe & DV SBH xe DL',
      'Khối KD xe & DV SBH xe Thương mại',
      'Khối Sản xuất Cơ khí và TBCD',
      'Khối Công nghiệp nặng',
      'Khối Công nghệ và Giải pháp số hoá',
      'Khối SX Ô tô, Đầu máy & Toa xe và LKPT',
      'NVQT Chuyên ngành',
      'NVQT Cơ bản',
      'Nghiệp vụ'
    ];
    data.forEach(p => {
      const k = String(p.khoi || '').trim();
      if (k && !base.includes(k)) base.push(k);
    });
    return base;
  }, [data]);

  const [isRehireModalOpen, setIsRehireModalOpen] = useState(false);
  const [personnelToRehire, setPersonnelToRehire] = useState<any | null>(null);
  const [rehireDate, setRehireDate] = useState(new Date().toISOString().split('T')[0]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportRegion, setExportRegion] = useState<'ALL' | 'NAM' | 'BAC' | 'SPECIFIC'>('ALL');
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [clickStaffListModal, setClickStaffListModal] = useState<{
    isOpen: boolean;
    title: string;
    list: any[];
  }>({ isOpen: false, title: '', list: [] });
  const formData = modal.formData;

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportData, setBulkImportData] = useState<any[]>([]);
  const [isAnalyzingBulk, setIsAnalyzingBulk] = useState(false);
  const [ignoredUpdates, setIgnoredUpdates] = useState<Set<string>>(new Set());
  const [ignoredFields, setIgnoredFields] = useState<Set<string>>(new Set());
  const [pendingOffboards, setPendingOffboards] = useState<Map<string, any>>(new Map());
  const [activeReconcileTab, setActiveReconcileTab] = useState<'new' | 'update' | 'unchanged' | 'missing'>('new');

  const toggleMissingItemKeep = (item: any) => {
    const key = item.ma_so_nhan_vien;
    if (pendingOffboards.has(key)) {
      setPendingOffboards(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    } else {
      handleOffboardClick(item);
    }
  };



  const loadData = async (forceRefresh = false) => {
    setLoading(true); setError(null);
    try {
      const [nsResult, dvResult, pnResult, chuKyResult] = await Promise.all([
        apiService.getPersonnel(forceRefresh),
        apiService.getDonVi(forceRefresh),
        apiService.getPhapNhan(forceRefresh),
        apiService.getChuKyATVSLD ? apiService.getChuKyATVSLD(forceRefresh).catch(() => []) : Promise.resolve([])
      ]);
      setData(nsResult);
      setDonViList(dvResult);
      setPhapNhanList(pnResult || []);
      setChuKyList(chuKyResult || []);
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (viewData) {
      apiService.writeLog(
        'XEM NHÂN SỰ',
        `Họ tên: ${viewData.ho_ten || ''} | Mã NV: ${viewData.ma_nv || ''} | Bộ phận: ${viewData.bo_phan || ''}`
      );
    }
  }, [viewData]);

  const donViLookupMap = useMemo(() => {
    const map = new Map<string, DonVi>();
    donViList.forEach(dv => map.set(String(dv.id), dv));
    return map;
  }, [donViList]);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[String(dv.id)] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const getFullUnitName = useMemo(() => {
    return (unitId: string): string => {
      const parts: string[] = [];
      let currentId = unitId;
      let iterations = 0;
      while (currentId && iterations < 10) {
        const dv = donViLookupMap.get(String(currentId));
        if (!dv) break;
        parts.push(dv.ten_don_vi);
        currentId = dv.cap_quan_ly;
        iterations++;
      }
      return parts.reverse().join(' ➜ ');
    };
  }, [donViLookupMap]);

  const allowedDonViIds = useAllowedUnits(donViList, 'NhanSu');

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

  const calculateSeniority = (startDate: string, trangThai: string, endDate: string) => {
    if (!startDate) return 'Chưa có';
    const start = new Date(startDate);
    const end = ((trangThai === 'Đã nghỉ việc' || trangThai === 'Đã điều chuyển') && endDate) ? new Date(endDate) : new Date();
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years === 0 && months === 0) return 'Mới nhận việc';
    if (years === 0) return `${months} tháng`;
    return `${years} năm ${months} tháng`;
  };

  const filteredUnits = useMemo(() => {
    let baseUnits = donViList.filter(dv => allowedDonViIds.includes(dv.id));
    if (!debouncedUnitSearchTerm) return baseUnits;

    const lower = debouncedUnitSearchTerm.toLowerCase();
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
  }, [donViList, debouncedUnitSearchTerm, allowedDonViIds]);

  const parentUnits = useMemo(() => filteredUnits.filter(item => item.cap_quan_ly === 'HO' || !item.cap_quan_ly), [filteredUnits]);
  const getChildUnits = (parentId: string) => sortDonViByThuTu(filteredUnits.filter(item => item.cap_quan_ly === parentId));

  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => {
    return groupParentUnits(parentUnits);
  }, [parentUnits]);



  const selectedUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViList]);

  const currentActivePersonnelOfUnit = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return data.filter(ns => ns.trang_thai !== 'Đã nghỉ việc');
    }
    const unitIds = [selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)];
    return data.filter(ns => unitIds.includes(ns.id_don_vi) && ns.trang_thai !== 'Đã nghỉ việc');
  }, [data, selectedUnitFilter, donViList]);

  const reconciliationResult = useMemo(() => {
    if (bulkImportData.length === 0) return null;

    const activeDbList = currentActivePersonnelOfUnit;
    const newItems: any[] = [];
    const updateItems: any[] = [];
    const unchangedItems: any[] = [];

    // 🟢 Dò tìm toàn công ty để tránh tạo trùng nhân sự khi chuyển đơn vị (Option B)
    const dbMap = new Map<string, any>();
    data.forEach(ns => {
      if (ns.ma_so_nhan_vien && ns.trang_thai === 'Đã nghỉ việc') {
        const k = String(ns.ma_so_nhan_vien).trim().toLowerCase();
        if (!dbMap.has(k)) dbMap.set(k, ns);
      }
    });
    data.forEach(ns => {
      if (ns.ma_so_nhan_vien && ns.trang_thai !== 'Đã nghỉ việc') {
        const k = String(ns.ma_so_nhan_vien).trim().toLowerCase();
        dbMap.set(k, ns);
      }
    });

    bulkImportData.forEach((item: any) => {
      const key = String(item.ma_so_nhan_vien).trim().toLowerCase();
      const existing = dbMap.get(key);

      if (!existing) {
        newItems.push(item);
      } else {
        const changes: any[] = [];

        const fieldLabels: Record<string, string> = {
          id_don_vi: 'Đơn vị công tác',
          trang_thai: 'Trạng thái',
          ho_ten: 'Họ tên',
          chuc_vu: 'Chức vụ',
          phong_ban: 'Ban/Phòng',
          bo_phan: 'Bộ phận',
          chuc_danh: 'Chức danh',
          sdt_cong_ty: 'SĐT Công ty',
          sdt_ca_nhan: 'SĐT Cá nhân',
          email: 'Email',
          gioi_tinh: 'Giới tính',
          nam_sinh: 'Năm sinh',
          ngay_nhan_vien: 'Ngày vào làm',
          ngach_luong: 'Ngạch lương',
          nhom_doi_tuong: 'Nhóm đối tượng ATVSLĐ',
          huan_luyen_tu: 'Huấn luyện từ',
          huan_luyen_den: 'Huấn luyện đến',
          gia_tri_den: 'Giá trị chứng nhận đến',
          chung_nhan: 'Chứng nhận',
          khoi: 'Khối',
          to_chuc: 'Tổ chức / Mảng',
          dia_diem_lam_viec: 'Địa điểm làm việc',
          cccd: 'Số CCCD',
          the_thang: 'Thẻ tháng',
          the_xe: 'Thẻ xe',
          hang_loai_xe: 'Hạng/Loại xe',
          bks: 'Biển kiểm soát',
          dia_chi: 'Địa chỉ',
          dv_chi_luong: 'Đơn vị chi lương'
        };

        Object.keys(item).forEach(col => {
          if (col === 'id_don_vi') {
            const oldUnit = String(existing.id_don_vi || '').trim();
            const newUnit = String(item.id_don_vi || '').trim();
            if (oldUnit && newUnit && oldUnit !== newUnit) {
              changes.push({
                field: 'id_don_vi',
                label: 'Đơn vị công tác',
                oldValue: donViMap[oldUnit] || oldUnit || '---',
                newValue: donViMap[newUnit] || newUnit || '---'
              });
            }
            return;
          }

          const valIncoming = item[col];
          if (valIncoming !== undefined && valIncoming !== null) {
            const valExisting = existing[col];

            const strIncoming = String(valIncoming).trim().toLowerCase();
            const strExisting = String(valExisting || '').trim().toLowerCase();

            let isDifferent = false;
            if (col.startsWith('sdt_')) {
              const phoneIncoming = strIncoming.replace(/\D/g, '');
              const phoneExisting = strExisting.replace(/\D/g, '');
              isDifferent = phoneIncoming !== phoneExisting;
            } else if (col === 'bks') {
              const bksIncoming = strIncoming.replace(/[^a-z0-9]/g, '');
              const bksExisting = strExisting.replace(/[^a-z0-9]/g, '');
              isDifferent = bksIncoming !== bksExisting;
            } else {
              isDifferent = strIncoming !== strExisting;
            }

            if (isDifferent) {
              changes.push({
                field: col,
                label: fieldLabels[col] || col,
                oldValue: valExisting || '---',
                newValue: valIncoming
              });
            }
          }
        });

        if (changes.length > 0) {
          updateItems.push({ item, existing, changes });
        } else {
          unchangedItems.push(item);
        }
      }
    });

    const incomingMsnvs = new Set(bulkImportData.map(item => String(item.ma_so_nhan_vien).trim().toLowerCase()));
    const missingItems = activeDbList.filter(ns => {
      const msnv = String(ns.ma_so_nhan_vien || '').trim().toLowerCase();
      return msnv && !incomingMsnvs.has(msnv);
    });

    return {
      newItems,
      updateItems,
      unchangedItems,
      missingItems
    };
  }, [bulkImportData, currentActivePersonnelOfUnit, data, donViMap]);

  const allChangedFields = useMemo(() => {
    if (!reconciliationResult?.updateItems) return [];
    const fieldsMap = new Map<string, { field: string; label: string }>();
    reconciliationResult.updateItems.forEach(group => {
      group.changes.forEach((ch: any) => {
        if (!fieldsMap.has(ch.field)) {
          fieldsMap.set(ch.field, { field: ch.field, label: ch.label });
        }
      });
    });
    return Array.from(fieldsMap.values());
  }, [reconciliationResult?.updateItems]);

  const isColumnChecked = (fieldKey: string) => {
    if (!reconciliationResult?.updateItems) return false;
    const affectedGroups = reconciliationResult.updateItems.filter(group =>
      group.changes.some((ch: any) => ch.field === fieldKey)
    );
    if (affectedGroups.length === 0) return false;
    return affectedGroups.every(group =>
      !ignoredFields.has(`${group.existing.ma_so_nhan_vien}:${fieldKey}`)
    );
  };

  const toggleColumnUpdate = (fieldKey: string) => {
    if (!reconciliationResult?.updateItems) return;
    const affectedGroups = reconciliationResult.updateItems.filter(group =>
      group.changes.some((ch: any) => ch.field === fieldKey)
    );
    const isColFullySelected = affectedGroups.every(group =>
      !ignoredFields.has(`${group.existing.ma_so_nhan_vien}:${fieldKey}`)
    );

    setIgnoredFields(prev => {
      const next = new Set(prev);
      affectedGroups.forEach(group => {
        const key = `${group.existing.ma_so_nhan_vien}:${fieldKey}`;
        if (isColFullySelected) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  };

  // 🟢 TÍNH TOÁN DANH SÁCH TÙY CHỌN BỘ LỌC NÂNG CAO
  const availableFilterOptions = useMemo(() => {
    let base = data.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) {
      base = base.filter(item => selectedUnitSubordinates.includes(item.id_don_vi));
    }

    const getUnique = (key: string, currentList: any[]) => {
      const set = new Set<string>();
      currentList.forEach(item => {
        const val = String(item[key] || '').trim();
        if (val && val !== '-' && val !== 'Chưa có' && val !== 'Chưa phân bộ phận' && val !== 'null' && val !== 'undefined') {
          set.add(val);
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
    };

    const listForPhongBan = base.filter(item =>
      (!filterKhoi || String(item.khoi || '').trim() === filterKhoi) &&
      (!filterChucVu || String(item.chuc_vu || '').trim() === filterChucVu) &&
      (!filterChucDanh || String(item.chuc_danh || '').trim() === filterChucDanh)
    );
    const listForKhoi = base.filter(item =>
      (!filterPhongBan || String(item.phong_ban || '').trim() === filterPhongBan) &&
      (!filterChucVu || String(item.chuc_vu || '').trim() === filterChucVu) &&
      (!filterChucDanh || String(item.chuc_danh || '').trim() === filterChucDanh)
    );
    const listForChucVu = base.filter(item =>
      (!filterPhongBan || String(item.phong_ban || '').trim() === filterPhongBan) &&
      (!filterKhoi || String(item.khoi || '').trim() === filterKhoi) &&
      (!filterChucDanh || String(item.chuc_danh || '').trim() === filterChucDanh)
    );
    const listForChucDanh = base.filter(item =>
      (!filterPhongBan || String(item.phong_ban || '').trim() === filterPhongBan) &&
      (!filterKhoi || String(item.khoi || '').trim() === filterKhoi) &&
      (!filterChucVu || String(item.chuc_vu || '').trim() === filterChucVu)
    );

    return {
      phongBanList: getUnique('phong_ban', listForPhongBan),
      khoiList: getUnique('khoi', listForKhoi),
      chucVuList: getUnique('chuc_vu', listForChucVu),
      chucDanhList: getUnique('chuc_danh', listForChucDanh),
    };
  }, [data, allowedDonViIds, selectedUnitFilter, selectedUnitSubordinates, filterPhongBan, filterKhoi, filterChucVu, filterChucDanh]);

  // LỌC DANH SÁCH NHÂN SỰ CHUNG
  const filteredPersonnel = useMemo(() => {
    let result = data.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) result = result.filter(item => selectedUnitSubordinates.includes(item.id_don_vi));

    if (debouncedPersonnelSearchTerm) {
      const cleanSearch = stripAccents(debouncedPersonnelSearchTerm);
      const digitsSearch = debouncedPersonnelSearchTerm.replace(/\D/g, '');

      result = result.filter(item => {
        const cleanPhone1 = String(item.sdt_ca_nhan || '').replace(/\D/g, '');
        const cleanPhone2 = String(item.sdt_cong_ty || '').replace(/\D/g, '');

        return stripAccents(item.ma_so_nhan_vien || '').includes(cleanSearch) ||
          stripAccents(item.ho_ten || '').includes(cleanSearch) ||
          stripAccents(donViMap[String(item.id_don_vi)] || '').includes(cleanSearch) ||
          stripAccents(item.chuc_vu || '').includes(cleanSearch) ||
          stripAccents(item.phong_ban || '').includes(cleanSearch) ||
          stripAccents(item.sdt_ca_nhan || '').includes(cleanSearch) ||
          stripAccents(item.sdt_cong_ty || '').includes(cleanSearch) ||
          stripAccents(item.the_xe || '').includes(cleanSearch) ||
          (digitsSearch !== '' && (cleanPhone1.includes(digitsSearch) || cleanPhone2.includes(digitsSearch)));
      });
    }

    if (filterPhongBan) {
      const cleanVal = stripAccents(filterPhongBan);
      result = result.filter(item => stripAccents(item.phong_ban || '').includes(cleanVal));
    }
    if (filterKhoi) {
      const cleanVal = stripAccents(filterKhoi);
      result = result.filter(item => stripAccents(item.khoi || '').includes(cleanVal));
    }
    if (filterChucVu) {
      const cleanVal = stripAccents(filterChucVu);
      result = result.filter(item => stripAccents(item.chuc_vu || '').includes(cleanVal));
    }
    if (filterChucDanh) {
      const cleanVal = stripAccents(filterChucDanh);
      result = result.filter(item => stripAccents(item.chuc_danh || '').includes(cleanVal));
    }

    // 🟢 Sắp xếp danh sách theo 3 mức ưu tiên:
    // Ưu tiên 1 - Cấp đơn vị trong sơ đồ tổ chức;
    // Ưu tiên 2 - Chức vụ chính thức;
    // Ưu tiên 3 - Cấp bậc phân loại cán bộ lãnh đạo
    return result.sort((a, b) => comparePersonnel(a, b, donViList));
  }, [data, debouncedPersonnelSearchTerm, selectedUnitFilter, allowedDonViIds, donViMap, donViList, selectedUnitSubordinates, filterPhongBan, filterKhoi, filterChucVu, filterChucDanh]);

  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  const showSelectCheckboxes = useMemo(() => {
    return showAdvancedFilters && (
      filterPhongBan !== '' ||
      filterKhoi !== '' ||
      filterChucVu !== '' ||
      filterChucDanh !== ''
    );
  }, [showAdvancedFilters, filterPhongBan, filterKhoi, filterChucVu, filterChucDanh]);

  useEffect(() => {
    if (!showSelectCheckboxes) {
      setSelectedPersonnelIds([]);
    }
  }, [showSelectCheckboxes]);

  // 🟢 Hàm gộp các dòng kiêm nhiệm cùng mã số nhân viên & xác định vị trí chính (Primary appointment)
  const groupAppointments = (list: any[]) => {
    // Nhóm theo ma_so_nhan_vien (nếu rỗng thì theo id)
    const groupsMap = new Map<string, any[]>();
    list.forEach(item => {
      const key = item.ma_so_nhan_vien && String(item.ma_so_nhan_vien).trim() !== ''
        ? String(item.ma_so_nhan_vien).trim().toUpperCase()
        : `NO_MSNV_${item.id}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(item);
    });

    const result: any[] = [];

    groupsMap.forEach((records, msnvKey) => {
      if (records.length === 1) {
        const item = records[0];
        // Kiểm tra xem người này có kiêm nhiệm không (qua chức vụ hoặc nếu trong toàn bộ database data có nhiều hơn 1 vị trí)
        const hasOtherRolesInDb = msnvKey.startsWith('NO_MSNV_')
          ? false
          : data.some(d => d.id !== item.id && String(d.ma_so_nhan_vien || '').trim().toUpperCase() === msnvKey && d.trang_thai !== 'Đã nghỉ việc' && d.trang_thai !== 'Đã điều chuyển');

        const isKiem = isKiemTitle(item.chuc_vu) || hasOtherRolesInDb;

        result.push({
          ...item,
          kiem_nhiem_list: [],
          all_record_ids: [item.id],
          is_kiem_nhiem_single: isKiem
        });
        return;
      }

      // Có nhiều hơn 1 bản ghi trong danh sách đang lọc -> Sắp xếp theo 3 mức ưu tiên để tìm bản ghi Chính (Primary)
      const sorted = [...records].sort((a, b) => comparePersonnel(a, b, donViList));

      const primary = sorted[0];
      const others = sorted.slice(1);

      const kiem_nhiem_list = others.map(other => ({
        id: other.id,
        chuc_vu: other.chuc_vu || '---',
        chuc_danh: other.chuc_danh || '---',
        id_don_vi: other.id_don_vi,
        ten_don_vi: donViMap[String(other.id_don_vi)] || other.id_don_vi || '---',
        phong_ban: other.phong_ban,
        khoi: other.khoi,
        raw: other
      }));

      result.push({
        ...primary,
        kiem_nhiem_list,
        all_record_ids: records.map(r => r.id),
        is_kiem_nhiem_single: false
      });
    });

    // 🟢 Sắp xếp danh sách kết quả theo 3 mức ưu tiên:
    // Ưu tiên 1 - Cấp đơn vị trong sơ đồ tổ chức;
    // Ưu tiên 2 - Chức vụ chính thức;
    // Ưu tiên 3 - Cấp bậc phân loại cán bộ lãnh đạo
    return result.sort((a, b) => comparePersonnel(a, b, donViList));
  };

  // Tổng số vị trí công tác (Tổng số dòng thực tế trước khi gộp kiêm nhiệm)
  const totalActivePositions = useMemo(() => {
    return filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc' && p.trang_thai !== 'Đã điều chuyển').length;
  }, [filteredPersonnel]);

  // Danh sách nhân sự đang làm việc (Gộp các dòng kiêm nhiệm theo mã NV)
  const groupedActivePersonnel = useMemo(() => {
    const rawActive = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc' && p.trang_thai !== 'Đã điều chuyển');
    return groupAppointments(rawActive);
  }, [filteredPersonnel, data, donViList, donViMap]);

  // Danh sách nhân sự đã nghỉ việc / điều chuyển (Gộp theo mã NV)
  const groupedOffboardPersonnel = useMemo(() => {
    const rawOffboard = filteredPersonnel.filter(p => p.trang_thai === 'Đã nghỉ việc' || p.trang_thai === 'Đã điều chuyển');
    return groupAppointments(rawOffboard);
  }, [filteredPersonnel, data, donViList, donViMap]);

  // Số lượng đếm chuẩn hóa theo Headcount thực tế
  const countActive = useMemo(() => {
    return groupedActivePersonnel.length;
  }, [groupedActivePersonnel]);

  const countOffboard = useMemo(() => {
    return groupedOffboardPersonnel.length;
  }, [groupedOffboardPersonnel]);

  const personnelTabs = useMemo(() => [
    {
      id: 'info',
      label: 'Danh sách nhân sự',
      icon: <Users size={18} />,
      count: countActive + countOffboard,
      subTabs: [
        { id: 'ACTIVE', label: 'Đang làm việc', icon: <UserCheck className="w-4 h-4" />, count: countActive },
        { id: 'OFFBOARD', label: 'Đã nghỉ việc / Điều chuyển', icon: <LogOut className="w-4 h-4" />, count: countOffboard }
      ]
    },
    { id: 'cuoc', label: 'Cước điện thoại', icon: <Phone size={18} /> },
    {
      id: 'stats',
      label: 'Thống kê',
      icon: <BarChart3 size={18} />,
      subTabs: [
        { id: 'NHAN_SU', label: 'Nhân sự', icon: <Users className="w-4 h-4" /> },
        { id: 'DASHBOARD', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> }
      ]
    }
  ], [countActive, countOffboard]);

  const displayPersonnelList = useMemo(() => {
    if (activeSubTabPersonnel === 'ACTIVE') {
      return groupedActivePersonnel;
    }
    return groupedOffboardPersonnel;
  }, [groupedActivePersonnel, groupedOffboardPersonnel, activeSubTabPersonnel]);

  const isAllSelected = useMemo(() => {
    if (displayPersonnelList.length === 0) return false;
    return displayPersonnelList.every(p => selectedPersonnelIds.includes(p.id));
  }, [displayPersonnelList, selectedPersonnelIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filteredIds = displayPersonnelList.map(p => p.id);
      setSelectedPersonnelIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    } else {
      const filteredIds = displayPersonnelList.map(p => p.id);
      setSelectedPersonnelIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedPersonnelIds(prev => [...prev, id]);
    } else {
      setSelectedPersonnelIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleExportSelectedExcel = () => {
    const selectedStaff = data.filter(p => selectedPersonnelIds.includes(p.id));
    if (selectedStaff.length === 0) return;

    let rowsHTML = '';
    selectedStaff.forEach((p, idx) => {
      const dvText = donViMap[String(p.id_don_vi)] || p.id_don_vi || '---';
      const formatVal = (val: any) => val ? String(val).trim() : '---';
      const formatDate = (val: any) => val ? new Date(val).toLocaleDateString('vi-VN') : '---';
      const formatBool = (val: any) => (val === true || String(val).toLowerCase() === 'true' || String(val) === 'có') ? 'Có' : 'Không';
      const thuNhapText = p.thu_nhap ? Number(p.thu_nhap).toLocaleString('vi-VN') : '---';

      rowsHTML += `
        <tr>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${idx + 1}</td>
          <td style="mso-number-format:'\\@'; border: 1px solid #000000; padding: 5px;">${formatVal(p.ma_so_nhan_vien)}</td>
          <td style="font-weight: bold; color: #002060; border: 1px solid #000000; padding: 5px;">${formatVal(p.ho_ten)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatVal(p.gioi_tinh)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${p.nam_sinh ? formatDate(p.nam_sinh) : '---'}</td>
          <td style="mso-number-format:'\\@'; text-align: center; border: 1px solid #000000; padding: 5px;">${formatVal(p.sdt_cong_ty)}</td>
          <td style="mso-number-format:'\\@'; text-align: center; border: 1px solid #000000; padding: 5px;">${formatVal(p.sdt_ca_nhan)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.email)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(dvText)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.phong_ban)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.khoi)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.chuc_vu)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.phan_loai)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.ngach_luong)}</td>
          <td style="text-align: right; mso-number-format:'#\\,##0'; border: 1px solid #000000; padding: 5px;">${thuNhapText}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${p.ngay_nhan_vien ? formatDate(p.ngay_nhan_vien) : '---'}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${p.ngay_nghi_viec ? formatDate(p.ngay_nghi_viec) : '---'}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatVal(p.trang_thai)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatVal(p.nhom_doi_tuong)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${p.huan_luyen_tu ? formatDate(p.huan_luyen_tu) : '---'}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${p.huan_luyen_den ? formatDate(p.huan_luyen_den) : '---'}</td>
          <td style="text-align: center; font-weight: bold; color: #b91c1c; border: 1px solid #000000; padding: 5px;">${p.gia_tri_den ? formatDate(p.gia_tri_den) : '---'}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.chung_nhan)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_atvsld)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_anbv)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_pccc)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_cnch)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_so_cap_cuu)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_cpr)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_vo_thuat)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.giay_phep_lai_xe)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_attp)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_pha_che)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_ngoai_ngu)}</td>
          <td style="text-align: center; border: 1px solid #000000; padding: 5px;">${formatBool(p.cc_tin_hoc)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.dia_diem_lam_viec)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.mo_to_ngoai_hinh)}</td>
          <td style="border: 1px solid #000000; padding: 5px;">${formatVal(p.ghi_chu)}</td>
        </tr>
      `;
    });

    const headerHTML = `
      <tr class="header" style="background-color: #d9e1f2; font-weight: bold; text-align: center;">
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">STT</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Mã số nhân viên</th>
        <th rowspan="2" style="width: 180px; border: 1px solid #000000; padding: 5px;">Họ và tên</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Giới tính</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Năm sinh</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">SĐT công ty</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">SĐT cá nhân</th>
        <th rowspan="2" style="width: 200px; border: 1px solid #000000; padding: 5px;">Email</th>
        <th rowspan="2" style="width: 250px; border: 1px solid #000000; padding: 5px;">Đơn vị công tác</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Bộ phận làm việc</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Khối trực thuộc</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Chức danh nghiệp vụ</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Phân loại nhân sự</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Ngạch lương</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Thu nhập (Lương đóng BH)</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Ngày nhận việc</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Ngày nghỉ việc</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Trạng thái làm việc</th>
        <th colspan="5" style="border: 1px solid #000000; padding: 5px;">Thông tin chứng nhận ATVSLĐ</th>
        <th colspan="12" style="border: 1px solid #000000; padding: 5px;">Danh sách chứng chỉ bằng cấp</th>
        <th rowspan="2" style="border: 1px solid #000000; padding: 5px;">Địa điểm làm việc</th>
        <th rowspan="2" style="width: 200px; border: 1px solid #000000; padding: 5px;">Mô tả ngoại hình</th>
        <th rowspan="2" style="width: 200px; border: 1px solid #000000; padding: 5px;">Ghi chú</th>
      </tr>
      <tr class="header" style="background-color: #d9e1f2; font-weight: bold; text-align: center;">
        <th style="border: 1px solid #000000; padding: 5px;">Nhóm đối tượng</th>
        <th style="border: 1px solid #000000; padding: 5px;">Huấn luyện từ</th>
        <th style="border: 1px solid #000000; padding: 5px;">Huấn luyện đến</th>
        <th style="border: 1px solid #000000; padding: 5px;">Giá trị đến ngày</th>
        <th style="border: 1px solid #000000; padding: 5px;">Loại chứng nhận</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC ATVSLĐ</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC ANBV</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC PCCC</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC CNCH</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC Sơ cấp cứu</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC CPR</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC Võ thuật</th>
        <th style="border: 1px solid #000000; padding: 5px;">GPLX</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC ATTP</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC Pha chế</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC Ngoại ngữ</th>
        <th style="border: 1px solid #000000; padding: 5px;">CC Tin học</th>
      </tr>
    `;

    const tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 11pt; } th, td { border: 1px solid #000000; padding: 5px; vertical-align: middle; }</style></head><body><table><thead>${headerHTML}</thead><tbody>${rowsHTML}</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_Sach_Nhan_Su_Export_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Đã xuất dữ liệu của ${selectedStaff.length} nhân sự thành công!`);
  };

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Tất cả Đơn vị';
    const unit = donViList.find(d => d.id === selectedUnitFilter);
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViList]);

  const uniqueActiveStaff = useMemo(() => {
    const active = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc' && p.trang_thai !== 'Đã điều chuyển');
    const seen = new Set<string>();
    const unique: any[] = [];
    const sortedActive = [...active].sort((a, b) => {
      const aKiem = String(a.chuc_vu || '').includes('Kiêm nhiệm') ? 1 : 0;
      const bKiem = String(b.chuc_vu || '').includes('Kiêm nhiệm') ? 1 : 0;
      return aKiem - bKiem;
    });

    for (const p of sortedActive) {
      const maNV = String(p.ma_so_nhan_vien || '').toLowerCase().trim();
      if (!maNV) {
        unique.push(p);
      } else if (!seen.has(maNV)) {
        seen.add(maNV);
        unique.push(p);
      }
    }
    return unique;
  }, [filteredPersonnel]);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let total = 0; let newThisMonth = 0; let male = 0; let female = 0;
    let seniority = { '< 1 năm': 0, '1 - 3 năm': 0, '3 - 5 năm': 0, '> 5 năm': 0 };
    let ageGroups = { '< 25 tuổi': 0, '25 - 35 tuổi': 0, '36 - 45 tuổi': 0, '> 45 tuổi': 0 };
    let atvsldTrained = 0;
    let birthdays: any[] = [];

    uniqueActiveStaff.forEach(p => {
      total++;
      if (p.gioi_tinh === 'Nam') male++; else if (p.gioi_tinh === 'Nữ') female++;

      if (p.ngay_nhan_vien) {
        const d = new Date(p.ngay_nhan_vien);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) newThisMonth++;
        const years = (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (years < 1) seniority['< 1 năm']++; else if (years < 3) seniority['1 - 3 năm']++; else if (years < 5) seniority['3 - 5 năm']++; else seniority['> 5 năm']++;
      } else { seniority['< 1 năm']++; }

      if (p.cc_atvsld === true || String(p.cc_atvsld).toLowerCase() === 'true' || String(p.cc_atvsld) === 'có') atvsldTrained++;

      if (p.nam_sinh) {
        const b = new Date(p.nam_sinh);
        if (b.getMonth() === currentMonth) birthdays.push(p);
        const age = currentYear - b.getFullYear();
        if (age < 25) ageGroups['< 25 tuổi']++; else if (age <= 35) ageGroups['25 - 35 tuổi']++; else if (age <= 45) ageGroups['36 - 45 tuổi']++; else ageGroups['> 45 tuổi']++;
      }
    });
    return { total, newThisMonth, male, female, seniority, ageGroups, atvsldTrained, birthdays, currentMonth };
  }, [uniqueActiveStaff]);

  const crossTabStats = useMemo(() => {
    const calcStatsForIds = (ids: string[]) => {
      const staff = uniqueActiveStaff.filter(p => ids.includes(p.id_don_vi));
      let bv_nv = 0, bv_tt_tp = 0, pvhc_nv = 0, pvhc_tt_tp = 0;
      let l_bv_nv: any[] = [], l_bv_tt_tp: any[] = [], l_pvhc_nv: any[] = [], l_pvhc_tt_tp: any[] = [];

      staff.forEach(p => {
        const bp = String(p.phong_ban || '').trim().toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
        const pl = String(p.chuc_danh || '').trim().toLowerCase().normalize('NFC');
        const cv = String(p.chuc_vu || '').trim().toLowerCase().normalize('NFC');

        const isBV =
          bp === 'bv, đtkh' || bp === 'bv,đtkh' || bp === 'bv - đtkh' || bp === 'bv-đtkh' ||
          bp.startsWith('bv, đtkh') || bp.startsWith('bv,đtkh') ||
          bp.includes('bv, đtkh') || bp.includes('bv,đtkh') ||
          bp.includes('bảo vệ, đón tiếp') || bp.includes('bảo vệ & đón tiếp') || bp.includes('bảo vệ và đón tiếp');

        const isPVHC =
          bp === 'pvhc' || bp.startsWith('pvhc') || bp.includes('pvhc') ||
          bp.includes('phục vụ hậu cần') || bp.includes('phục vụ - hậu cần') || bp.includes('phục vụ & hậu cần');

        const isLead = pl.includes('tổ trưởng') || pl.includes('tổ phó') || pl.includes('trưởng nhóm') ||
          cv.includes('tổ trưởng') || cv.includes('tổ phó') || cv.includes('trưởng nhóm');

        if (isBV) {
          if (isLead) { bv_tt_tp++; l_bv_tt_tp.push(p); }
          else { bv_nv++; l_bv_nv.push(p); }
        } else if (isPVHC) {
          if (isLead) { pvhc_tt_tp++; l_pvhc_tt_tp.push(p); }
          else { pvhc_nv++; l_pvhc_nv.push(p); }
        }
      });
      const l_totalBV = [...l_bv_nv, ...l_bv_tt_tp];
      const l_totalPVHC = [...l_pvhc_nv, ...l_pvhc_tt_tp];
      const l_totalRow = [...l_totalBV, ...l_totalPVHC];

      return {
        bv_nv, bv_tt_tp, totalBV: l_totalBV.length,
        pvhc_nv, pvhc_tt_tp, totalPVHC: l_totalPVHC.length,
        totalRow: l_totalRow.length,
        lists: { bv_nv: l_bv_nv, bv_tt_tp: l_bv_tt_tp, totalBV: l_totalBV, pvhc_nv: l_pvhc_nv, pvhc_tt_tp: l_pvhc_tt_tp, totalPVHC: l_totalPVHC, totalRow: l_totalRow }
      };
    };

    const rows: any[] = [];
    let grandTotal = { bv_nv: 0, bv_tt_tp: 0, totalBV: 0, pvhc_nv: 0, pvhc_tt_tp: 0, totalPVHC: 0, totalRow: 0, lists: { bv_nv: [], bv_tt_tp: [], totalBV: [], pvhc_nv: [], pvhc_tt_tp: [], totalPVHC: [], totalRow: [] } };

    if (!selectedUnitFilter) {
      ['Bắc', 'Nam', 'VPĐH', 'Khác'].forEach(region => {
        let regionParentUnits = [];
        if (region === 'Bắc') regionParentUnits = ctttBacUnits;
        else if (region === 'Nam') regionParentUnits = ctttNamUnits;
        else if (region === 'VPĐH') regionParentUnits = vpdhUnits;
        else regionParentUnits = otherUnits;

        const validParents = regionParentUnits.filter(u => allowedDonViIds.includes(u.id));
        if (validParents.length === 0) return;

        const regionIds = validParents.flatMap(pu => [pu.id, ...getAllSubordinateIds(pu.id, donViList)]);
        const rStats = calcStatsForIds(regionIds);

        if (rStats.totalRow > 0) {
          rows.push({ type: 'region', name: `Phía ${region === 'VPĐH' ? 'VPĐH' : region}`, stats: rStats });
          validParents.forEach(pu => {
            const puStats = calcStatsForIds([pu.id, ...getAllSubordinateIds(pu.id, donViList)]);
            if (puStats.totalRow > 0) rows.push({ type: 'parent', name: pu.ten_don_vi, id: pu.id, stats: puStats });
          });
        }
      });
      grandTotal = calcStatsForIds(donViList.filter(d => allowedDonViIds.includes(d.id)).map(d => d.id));
    } else {
      const selectedUnit = donViList.find(u => u.id === selectedUnitFilter);
      if (selectedUnit) {
        const children = getChildUnits(selectedUnit.id);
        if (children.length > 0) {
          const aggStats = calcStatsForIds([selectedUnit.id, ...getAllSubordinateIds(selectedUnit.id, donViList)]);
          rows.push({ type: 'region', name: `Tổng: ${selectedUnit.ten_don_vi}`, stats: aggStats });
          grandTotal = aggStats;

          const directStats = calcStatsForIds([selectedUnit.id]);
          if (directStats.totalRow > 0) rows.push({ type: 'parent', name: `Văn phòng ${selectedUnit.ten_don_vi}`, id: selectedUnit.id, stats: directStats });

          children.forEach(child => {
            const childStats = calcStatsForIds([child.id, ...getAllSubordinateIds(child.id, donViList)]);
            if (childStats.totalRow > 0) rows.push({ type: 'child', name: child.ten_don_vi, id: child.id, stats: childStats });
          });
        } else {
          const stats = calcStatsForIds([selectedUnit.id]);
          rows.push({ type: 'region', name: selectedUnit.ten_don_vi, stats: stats });
          grandTotal = stats;
        }
      }
    }
    return { rows, grandTotal };
  }, [uniqueActiveStaff, donViList, selectedUnitFilter, allowedDonViIds, ctttBacUnits, ctttNamUnits, vpdhUnits, otherUnits]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | string>(100);

  const actualRowsPerPage = typeof rowsPerPage === 'number' && rowsPerPage > 0 ? rowsPerPage : 100;
  const totalPages = Math.ceil(displayPersonnelList.length / actualRowsPerPage) || 1;

  useEffect(() => { setCurrentPage(1); }, [selectedUnitFilter, debouncedPersonnelSearchTerm, filterPhongBan, filterKhoi, filterChucVu, filterChucDanh, activeSubTabPersonnel]);

  const deptTabStats = useMemo(() => {
    const deptMap: Record<string, Record<string, number>> = {};
    const deptListMap: Record<string, Record<string, any[]>> = {};
    const phanLoaiSet = new Set<string>();

    uniqueActiveStaff.forEach(p => {
      const pb = p.phong_ban?.trim() || 'Chưa phân bổ';
      const pl = p.chuc_danh?.trim() || 'Chưa phân loại';
      phanLoaiSet.add(pl);

      if (!deptMap[pb]) { deptMap[pb] = { total: 0 }; deptListMap[pb] = { total: [] }; }
      if (!deptMap[pb][pl]) { deptMap[pb][pl] = 0; deptListMap[pb][pl] = []; }

      deptMap[pb][pl]++;
      deptMap[pb].total++;
      deptListMap[pb][pl].push(p);
      deptListMap[pb].total.push(p);
    });

    const groups = [
      { id: 'quan_ly', label: 'CẤP QUẢN LÝ', color: 'bg-orange-50/30', headerColor: 'bg-orange-100 text-orange-800 border-orange-200', roles: ['Lãnh đạo', 'Chủ tịch', 'Tổng Giám đốc', 'Phó Tổng Giám đốc', 'Giám đốc', 'Phó Giám đốc', 'Trưởng phòng', 'Trưởng bộ phận', 'Phó phòng'] },
      { id: 'giam_sat', label: 'CẤP GIÁM SÁT', color: 'bg-amber-50/20', headerColor: 'bg-amber-100 text-amber-800 border-amber-200', roles: ['Trợ lý', 'Trưởng nhóm', 'Tổ trưởng', 'Tổ phó'] },
      { id: 'chuyen_vien', label: 'CHUYÊN MÔN', color: 'bg-blue-50/20', headerColor: 'bg-blue-100 text-blue-800 border-blue-200', roles: ['Chuyên viên'] },
      { id: 'ho_tro', label: 'DỊCH VỤ HỖ TRỢ', color: 'bg-emerald-50/20', headerColor: 'bg-emerald-100 text-emerald-800 border-emerald-200', roles: ['PT DVHT KD', 'PT DVHC', 'PT NS', 'BV, ĐTKH'] },
      { id: 'nhan_vien', label: 'NGHIỆP VỤ', color: 'bg-blue-50/20', headerColor: 'bg-blue-100 text-blue-800 border-blue-200', roles: ['Nhân viên'] },
      { id: 'khac', label: 'KHÁC', color: 'bg-gray-50/50', headerColor: 'bg-gray-100 text-gray-600 border-gray-200', roles: ['Chưa phân loại'] }
    ];

    const activeColumnsByGroup = groups.map(g => {
      const activeRoles = g.roles.filter(r => phanLoaiSet.has(r));
      return { ...g, activeRoles };
    }).filter(g => g.activeRoles.length > 0);

    const rows = Object.keys(deptMap).sort((a, b) => {
      const getPriority = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName === 'ban lãnh đạo') return 1;
        if (lowerName === 'lãnh đạo') return 2;
        if (lowerName === 'chưa phân bổ') return 99;
        return 3;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b, 'vi');
    });

    const colTotals: Record<string, number> = {};
    const colLists: Record<string, any[]> = {};
    let grandTotalList: any[] = [];

    activeColumnsByGroup.forEach(g => { g.activeRoles.forEach(c => { colTotals[c] = 0; colLists[c] = []; }); });

    rows.forEach(r => {
      activeColumnsByGroup.forEach(g => {
        g.activeRoles.forEach(c => {
          colTotals[c] += (deptMap[r][c] || 0);
          if (deptListMap[r][c]) {
            colLists[c].push(...deptListMap[r][c]);
            grandTotalList.push(...deptListMap[r][c]);
          }
        });
      });
    });

    return { deptMap, deptListMap, groupedColumns: activeColumnsByGroup, rows, colTotals, colLists, grandTotal: uniqueActiveStaff.length, grandTotalList };
  }, [uniqueActiveStaff]);

  const paginatedPersonnel = useMemo(() => {
    const startIndex = (currentPage - 1) * actualRowsPerPage;
    return displayPersonnelList.slice(startIndex, startIndex + actualRowsPerPage);
  }, [displayPersonnelList, currentPage, actualRowsPerPage]);

  const handleCopyMail = (roleType: 'LD' | 'DVHT' | 'NS') => {
    let emails: string[] = [];
    filteredPersonnel.forEach(p => {
      if (!p.email || p.trang_thai === 'Đã nghỉ việc' || p.trang_thai === 'Đã điều chuyển') return;
      const chucVu = String(p.chuc_vu || '').toLowerCase();
      if (roleType === 'LD' && chucVu.includes('tổng giám đốc')) { emails.push(p.email); }
      else if (roleType === 'DVHT' && (chucVu.includes('dvht') || chucVu.includes('dịch vụ hỗ trợ'))) { emails.push(p.email); }
      else if (roleType === 'NS' && chucVu.includes('nhân sự')) { emails.push(p.email); }
    });

    if (emails.length === 0) { alert('Không tìm thấy email nào phù hợp với chức vụ này trong danh sách hiện tại!'); return; }
    const uniqueEmails = Array.from(new Set(emails)).join('; ');
    navigator.clipboard.writeText(uniqueEmails).then(() => { setCopiedRole(roleType); setTimeout(() => setCopiedRole(null), 2000); });
  };

  const openModal = (mode: 'create' | 'update', item?: any) => {
    if (item) {
      const { all_record_ids, kiem_nhiem_list, is_kiem_nhiem_single, ...cleanItem } = item;
      setModal({ isOpen: true, mode, formData: { ...cleanItem } });
    } else {
      const defaultUnitId = selectedUnitFilter || allowedDonViIds[0] || (donViList[0]?.id ? String(donViList[0].id) : '');
      const targetUnit = donViList.find(d => String(d.id) === String(defaultUnitId));
      const defaultLegal = targetUnit ? (targetUnit.id_phap_nhan || '') : (phapNhanList[0]?.id || '');
      setModal({
        isOpen: true,
        mode,
        formData: {
          ma_so_nhan_vien: '', ho_ten: '', nam_sinh: '', cccd: '',
          dia_chi: '', dv_chi_luong: '',
          sdt_ca_nhan: '', sdt_cong_ty: '', email: '',
          id_don_vi: defaultUnitId,
          khoi: '', to_chuc: '', phong_ban: '', bo_phan: '', chuc_danh: '', chuc_vu: '', ngach_luong: '',
          ngay_nhan_vien: new Date().toISOString().split('T')[0],
          gioi_tinh: 'Nam', trang_thai: 'Đang làm việc'
        }
      });
    }
    setError(null);
  };

  const handleView = (item: any) => {
    if (hasRule('NS_NO_DETAIL')) {
      toast.warning("Bạn không có quyền xem chi tiết hồ sơ nhân sự này!");
      return;
    }
    let enhancedItem = item;
    if ((!item.kiem_nhiem_list || item.kiem_nhiem_list.length === 0) && item.ma_so_nhan_vien) {
      const msnv = String(item.ma_so_nhan_vien).trim().toUpperCase();
      const otherRoles = data.filter(d =>
        d.id !== item.id &&
        String(d.ma_so_nhan_vien || '').trim().toUpperCase() === msnv &&
        d.trang_thai !== 'Đã nghỉ việc' && d.trang_thai !== 'Đã điều chuyển'
      );
      if (otherRoles.length > 0) {
        enhancedItem = {
          ...item,
          kiem_nhiem_list: otherRoles.map(other => ({
            id: other.id,
            chuc_vu: other.chuc_vu || '---',
            chuc_danh: other.chuc_danh || '---',
            id_don_vi: other.id_don_vi,
            ten_don_vi: donViMap[String(other.id_don_vi)] || other.id_don_vi || '---',
            phong_ban: other.phong_ban,
            khoi: other.khoi,
            raw: other
          }))
        };
      }
    }
    setViewData(enhancedItem);
    setShowNgachLuong(false);
    setShowCCCD(false);
    setIsViewModalOpen(true);

    if (item?.ma_so_nhan_vien) {
      setLoadingKskHistoryView(true);
      getKhamSucKhoeCaNhan()
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          const msnv = String(item.ma_so_nhan_vien || '').trim().toLowerCase();
          const filtered = list.filter(r => String(r.ma_so_nhan_vien || '').trim().toLowerCase() === msnv);
          setKskHistoryView(filtered.sort((a, b) => Number(b.nam_kham || 0) - Number(a.nam_kham || 0)));
        })
        .catch(() => setKskHistoryView([]))
        .finally(() => setLoadingKskHistoryView(false));
    } else {
      setKskHistoryView([]);
    }
  };

  const handleDuplicate = (item: any) => {
    const { all_record_ids, kiem_nhiem_list, is_kiem_nhiem_single, ...cleanItem } = item;
    setModal({ isOpen: true, mode: 'create', formData: { ...cleanItem, id: '', chuc_vu: item.chuc_vu ? `${item.chuc_vu} (Kiêm nhiệm)` : 'Kiêm nhiệm', trang_thai: 'Đang làm việc', ngay_nghi_viec: '' } });
    setError(null);
  };

  const executeSave = async (finalDataToSave: any) => {
    setSubmitting(true); setError(null);
    try {
      const uiFields = ['all_record_ids', 'kiem_nhiem_list', 'is_kiem_nhiem_single', 'ngay_sinh', 'email_ca_nhan', 'id_phap_nhan', 'ten_phap_nhan', 'ten_don_vi', 'ngay_nhan_viec'];
      uiFields.forEach(f => { delete (finalDataToSave as any)[f]; });

      const response = await apiService.save(finalDataToSave, modal.mode, "ns_dich_vu");
      const currentId = response.id || response.newId || finalDataToSave.id || `NS-${Date.now()}`;
      finalDataToSave.id = currentId;

      if (modal.mode === 'update' && finalDataToSave.ma_so_nhan_vien) {
        const kiemNhiemList = data.filter(item => item.ma_so_nhan_vien === finalDataToSave.ma_so_nhan_vien && item.id !== currentId);
        if (kiemNhiemList.length > 0) {
          // 🟢 Các trường thuộc về Vị trí công tác tại Đơn vị cụ thể -> TUYỆT ĐỐI ĐỘC LẬP, KHÔNG ĐỒNG BỘ ĐÈ
          const positionSpecificFields = [
            'id', 'id_don_vi', 'chuc_vu', 'chuc_danh', 'phan_loai', 'phong_ban', 'bo_phan',
            'khoi', 'to_chuc', 'dia_diem_lam_viec', 'ngach_luong', 'thu_nhap', 'dv_chi_luong',
            'dinh_muc_cuoc', 'ngay_nhan_vien', 'ngay_nghi_viec', 'ngay_vao_lam_lai',
            'trang_thai', 'tham_nien', 'ghi_chu', ...uiFields
          ];
          const syncData: any = {};
          Object.keys(finalDataToSave).forEach(key => {
            if (!positionSpecificFields.includes(key) && finalDataToSave[key] !== undefined) {
              syncData[key] = finalDataToSave[key];
            }
          });
          // Chỉ đồng bộ nếu có thay đổi về thông tin cá nhân dùng chung
          if (Object.keys(syncData).length > 0) {
            for (const kn of kiemNhiemList) {
              const updatedKN = { ...kn, ...syncData };
              uiFields.forEach(f => { delete (updatedKN as any)[f]; });
              await apiService.save(updatedKN, 'update', "ns_dich_vu");
              setData(prev => prev.map(item => item.id === updatedKN.id ? updatedKN : item));
            }
            toast.success(`Đã tự động đồng bộ thông tin cá nhân cho ${kiemNhiemList.length} vị trí kiêm nhiệm!`);
          }
        }
      }

      if (modal.mode === 'create') { setData(prev => [...prev, finalDataToSave]); }
      else { setData(prev => prev.map(item => item.id === finalDataToSave.id ? finalDataToSave : item)); }

      setModal(prev => ({ ...prev, isOpen: false }));
      toast.success(modal.mode === 'create' ? "Thêm mới thành công!" : "Cập nhật thành công!");
    } catch (err: any) { setError(err.message || 'Lỗi lưu dữ liệu.'); toast.error(err.message || "Đã xảy ra lỗi!"); }
    finally { setSubmitting(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị công tác!");

    // Kiểm tra trùng MSNV khi THÊM MỚI nhân sự
    if (modal.mode === 'create' && formData.ma_so_nhan_vien) {
      const dup = data.find(item =>
        item.ma_so_nhan_vien &&
        String(item.ma_so_nhan_vien).trim().toLowerCase() === String(formData.ma_so_nhan_vien).trim().toLowerCase()
      );
      if (dup) {
        const finalDataToSave = {
          ...formData,
          tuoi: '',
          tham_nien: calculateSeniority(formData.ngay_nhan_vien || '', formData.trang_thai || 'Đang làm việc', formData.ngay_nghi_viec || ''),
          trang_thai: formData.trang_thai || 'Đang làm việc'
        };
        if (formData.nam_sinh) {
          const birthDate = new Date(formData.nam_sinh); const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
          finalDataToSave.tuoi = age.toString();
        }

        const fieldsToExclude = ['all_record_ids', 'kiem_nhiem_list', 'is_kiem_nhiem_single', 'ngay_sinh', 'email_ca_nhan', 'id_phap_nhan', 'ten_phap_nhan', 'ten_don_vi', 'ngay_nhan_viec'];
        fieldsToExclude.forEach(f => { delete (finalDataToSave as any)[f]; });

        if (!finalDataToSave.ngay_nhan_vien && finalDataToSave.ma_so_nhan_vien) { finalDataToSave.ngay_nhan_vien = extractStartDateFromMaNV(finalDataToSave.ma_so_nhan_vien); }
        if (!finalDataToSave.nam_sinh) finalDataToSave.nam_sinh = null;
        if (!finalDataToSave.ngay_nhan_vien) finalDataToSave.ngay_nhan_vien = null;
        if (!finalDataToSave.ngay_nghi_viec) finalDataToSave.ngay_nghi_viec = null;
        if (!finalDataToSave.ngay_vao_lam_lai) finalDataToSave.ngay_vao_lam_lai = null;

        const isCertChecked = formData.cc_atvsld === true || String(formData.cc_atvsld).toLowerCase() === 'true';
        finalDataToSave.cc_atvsld = isCertChecked;

        if (isCertChecked) {
          if (finalDataToSave.nhom_doi_tuong) {
            const nhom = String(finalDataToSave.nhom_doi_tuong).replace(/\D/g, '');
            if (nhom === '1' || nhom === '2' || nhom === '6') finalDataToSave.chung_nhan = 'Giấy chứng nhận huấn luyện ATVSLĐ';
            else if (nhom === '3') finalDataToSave.chung_nhan = 'Thẻ An toàn lao động';
            else if (nhom === '4') finalDataToSave.chung_nhan = 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';
          }
        } else {
          finalDataToSave.chung_nhan = null;
          finalDataToSave.huan_luyen_tu = null;
          finalDataToSave.huan_luyen_den = null;
          finalDataToSave.gia_tri_den = null;
        }

        setDupConfirmModal({
          isOpen: true,
          dupInfo: {
            ho_ten: dup.ho_ten,
            ten_don_vi: donViMap[dup.id_don_vi] || dup.id_don_vi,
            ma_so_nhan_vien: formData.ma_so_nhan_vien
          },
          onConfirm: () => {
            executeSave(finalDataToSave);
            setDupConfirmModal({ isOpen: false, dupInfo: null, onConfirm: () => { } });
          }
        });
        return;
      }
    }

    let calculatedTuoi = '';
    if (formData.nam_sinh) {
      const birthDate = new Date(formData.nam_sinh); const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
      calculatedTuoi = age.toString();
    }

    const finalDataToSave = {
      ...formData, tuoi: calculatedTuoi,
      tham_nien: calculateSeniority(formData.ngay_nhan_vien || '', formData.trang_thai || 'Đang làm việc', formData.ngay_nghi_viec || ''),
      trang_thai: formData.trang_thai || 'Đang làm việc'
    };

    // Loại bỏ các trường không thuộc bảng CSDL ns_dich_vu
    const fieldsToExclude = ['all_record_ids', 'kiem_nhiem_list', 'is_kiem_nhiem_single', 'ngay_sinh', 'email_ca_nhan', 'id_phap_nhan', 'ten_phap_nhan', 'ten_don_vi', 'ngay_nhan_viec'];
    fieldsToExclude.forEach(f => {
      delete (finalDataToSave as any)[f];
    });

    if (!finalDataToSave.ngay_nhan_vien && finalDataToSave.ma_so_nhan_vien) { finalDataToSave.ngay_nhan_vien = extractStartDateFromMaNV(finalDataToSave.ma_so_nhan_vien); }
    if (!finalDataToSave.nam_sinh) finalDataToSave.nam_sinh = null;
    if (!finalDataToSave.ngay_nhan_vien) finalDataToSave.ngay_nhan_vien = null;
    if (!finalDataToSave.ngay_nghi_viec) finalDataToSave.ngay_nghi_viec = null;
    if (!finalDataToSave.ngay_vao_lam_lai) finalDataToSave.ngay_vao_lam_lai = null;

    const isCertChecked = formData.cc_atvsld === true || String(formData.cc_atvsld).toLowerCase() === 'true';
    finalDataToSave.cc_atvsld = isCertChecked;

    if (isCertChecked) {
      if (finalDataToSave.nhom_doi_tuong) {
        const nhom = String(finalDataToSave.nhom_doi_tuong).replace(/\D/g, '');
        if (nhom === '1' || nhom === '2' || nhom === '6') finalDataToSave.chung_nhan = 'Giấy chứng nhận huấn luyện ATVSLĐ';
        else if (nhom === '3') finalDataToSave.chung_nhan = 'Thẻ An toàn lao động';
        else if (nhom === '4') finalDataToSave.chung_nhan = 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';
      }
    } else {
      finalDataToSave.chung_nhan = null;
      finalDataToSave.huan_luyen_tu = null;
      finalDataToSave.huan_luyen_den = null;
      finalDataToSave.gia_tri_den = null;
    }

    await executeSave(finalDataToSave);
  };

  const confirmBulkSave = async () => {
    if (!reconciliationResult) return;
    setSubmitting(true);
    try {
      let createCount = 0;
      let updateCount = 0;
      let offboardCount = 0;

      // 1. Thêm mới
      for (const item of reconciliationResult.newItems) {
        const newData = {
          phan_loai: 'Nhân viên',
          gioi_tinh: 'Nam',
          trang_thai: 'Đang làm việc',
          ...item,
          id: `NS-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        if (!newData.id_don_vi && selectedUnitFilter) {
          newData.id_don_vi = selectedUnitFilter;
        }
        await apiService.save(newData, 'create', 'ns_dich_vu');
        createCount++;
      }

      // 2. Cập nhật
      for (const group of reconciliationResult.updateItems) {
        const msnv = group.existing.ma_so_nhan_vien;
        if (ignoredUpdates.has(msnv)) {
          continue;
        }

        // Kiểm tra xem tất cả các trường thay đổi của nhân sự này có bị bỏ qua hay không
        const allFieldsIgnored = group.changes.every((ch: any) =>
          ignoredFields.has(`${msnv}:${ch.field}`)
        );
        if (allFieldsIgnored) {
          continue; // Bỏ qua nếu tất cả các trường của nhân sự đều bị bỏ qua cập nhật
        }

        const mergedData = { ...group.existing };
        let hasActualUpdate = false;

        Object.keys(group.item).forEach(key => {
          if (group.item[key] !== undefined && group.item[key] !== null) {
            // Chỉ cập nhật nếu trường này KHÔNG nằm trong danh sách bỏ qua chi tiết
            if (!ignoredFields.has(`${msnv}:${key}`)) {
              mergedData[key] = group.item[key];
              hasActualUpdate = true;
            }
          }
        });

        if (hasActualUpdate) {
          mergedData.trang_thai = 'Đang làm việc';
          await apiService.save(mergedData, 'update', 'ns_dich_vu');
          updateCount++;
        }
      }

      // 3. Điều chuyển / Nghỉ việc dôi dư
      for (const [msnv, offboardInfo] of pendingOffboards.entries()) {
        const fieldsToExclude = ['ngay_sinh', 'email_ca_nhan', 'id_phap_nhan', 'ten_phap_nhan', 'ten_don_vi', 'ngay_nhan_viec', 'phan_loai'];
        const cleanDataToSave = { ...offboardInfo.updatedData };
        fieldsToExclude.forEach(f => { delete (cleanDataToSave as any)[f]; });
        await apiService.save(cleanDataToSave, 'update', 'ns_dich_vu');
        if (offboardInfo.simPayload) {
          await apiService.save(offboardInfo.simPayload, 'update', 'dm_thue_bao');
        }
        if (offboardInfo.assetTasks && Array.isArray(offboardInfo.assetTasks)) {
          for (const task of offboardInfo.assetTasks) {
            if (task.deviceUpdate) {
              await apiService.save(task.deviceUpdate, 'update', 'ts_thiet_bi');
            }
            if (task.nkPayload) {
              await apiService.save(task.nkPayload, 'create', 'nk_thiet_bi');
            }
          }
        }
        offboardCount++;
      }

      let successMsg = `Thao tác thành công! Đã thêm mới ${createCount} người và cập nhật ${updateCount} người.`;
      if (offboardCount > 0) {
        successMsg = `Thao tác thành công! Đã thêm mới ${createCount} người, cập nhật ${updateCount} người và điều chuyển/nghỉ việc ${offboardCount} người.`;
      }
      toast.success(successMsg);

      await loadData(true);

      setIsBulkImportOpen(false);
      setBulkImportData([]);
      setBulkImportText('');
      setIgnoredUpdates(new Set());
      setIgnoredFields(new Set());
      setPendingOffboards(new Map());
    } catch (err: any) { setError(err.message || 'Lỗi lưu dữ liệu.'); toast.error(err.message || "Đã xảy ra lỗi!"); }
    finally { setSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const deletedPerson = data.find(p => p.id === itemToDelete);
    if (deletedPerson && !canDelete('NhanSu', deletedPerson.id_don_vi)) {
      toast.error("Bạn không có quyền XÓA nhân sự này! Vui lòng liên hệ Quản trị viên.");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await apiService.delete(itemToDelete, "ns_dich_vu", deletedPerson);
      setData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsConfirmOpen(false); setItemToDelete(null); toast.success("Xóa nhân sự thành công!");
    } catch (err: any) { setError(err.message || 'Lỗi xóa dữ liệu.'); toast.error(err.message || "Đã xảy ra lỗi!"); }
    finally { setSubmitting(false); }
  };

  const handleConfirmRehire = async () => {
    if (!personnelToRehire) return;
    setSubmitting(true);
    try {
      let cleanGhiChu = personnelToRehire.ghi_chu || '';
      if (personnelToRehire.trang_thai === 'Đã điều chuyển') {
        cleanGhiChu = cleanGhiChu.replace(/^\[Đã điều chuyển ra ngoài:[^\]]*\]\s*/, '');
      }

      const rehireData = {
        ...personnelToRehire,
        trang_thai: 'Đang làm việc',
        ngay_vao_lam_lai: rehireDate,
        ngay_nghi_viec: null,
        ghi_chu: cleanGhiChu
      };
      await apiService.save(rehireData, "update", "ns_dich_vu");
      setData(prev => prev.map(item => item.id === personnelToRehire.id ? rehireData : item));
      setIsRehireModalOpen(false); setPersonnelToRehire(null);
    } catch (err: any) { alert("Lỗi: " + err.message); } finally { setSubmitting(false); }
  };

  const handleOffboardClick = async (item: any) => {
    setPersonnelToOffboard(item);
    setCheckingAssets(true);
    setForceOffboard(false);
    setIsOffboardOpen(true);
    setUnreturnedAssets([]);
    setPersonnelThueBao(null);
    setTransferSimAction('TRANSFER');
    setTransferAssetActions({});

    // Kiểm tra xem nhân sự này đã có cấu hình trong đợt bulk import dôi dư chưa
    const existingPending = pendingOffboards.get(item.ma_so_nhan_vien);
    if (existingPending) {
      setTransferType(existingPending.transferType || 'INTERNAL');
      setTransferInternalUnitId(existingPending.transferInternalUnitId || '');
      setTransferDiaDiem(existingPending.transferDiaDiem !== undefined ? existingPending.transferDiaDiem : (item.dia_diem_lam_viec || ''));
      setTransferKhoi(existingPending.transferKhoi !== undefined ? existingPending.transferKhoi : (item.khoi || ''));
      setTransferPhongBan(existingPending.transferPhongBan !== undefined ? existingPending.transferPhongBan : (item.phong_ban || ''));
      setTransferChucDanh(existingPending.transferChucDanh !== undefined ? existingPending.transferChucDanh : (item.chuc_danh || ''));
      setTransferChucVu(existingPending.transferChucVu !== undefined ? existingPending.transferChucVu : (item.chuc_vu || ''));
      setTransferExternalUnitName(existingPending.transferExternalUnitName || '');
      if (existingPending.transferSimAction) setTransferSimAction(existingPending.transferSimAction);
      if (existingPending.transferAssetActions) setTransferAssetActions(existingPending.transferAssetActions);
    } else {
      setTransferType('INTERNAL');
      setTransferInternalUnitId('');
      setTransferDiaDiem(item.dia_diem_lam_viec || '');
      setTransferKhoi(item.khoi || '');
      setTransferPhongBan(item.phong_ban || '');
      setTransferChucDanh(item.chuc_danh || '');
      setTransferChucVu(item.chuc_vu || '');
      setTransferExternalUnitName('');
    }

    try {
      const [thietBiRaw, nhatKyRaw, thueBaoRaw] = await Promise.all([
        apiService.getThietBi(),
        apiService.getNhatKyThietBi(),
        apiService.getThueBao ? apiService.getThueBao() : Promise.resolve([])
      ]);
      const thietBiList: ThietBi[] = thietBiRaw || [];
      const nhatKyList: any[] = nhatKyRaw || [];
      const thueBaoList: any[] = thueBaoRaw || [];

      // 1. Quét tìm thông tin Thuê bao SIM công ty của nhân sự
      const cleanPhone = (item.sdt_cong_ty || '').replace(/\D/g, '');
      const cleanPhoneWithZero = cleanPhone.length === 9 ? '0' + cleanPhone : cleanPhone;
      const matchedTb = thueBaoList.find((tb: any) => {
        const tbPhone = (tb.so_dien_thoai || '').replace(/\D/g, '');
        const tbPhoneWithZero = tbPhone.length === 9 ? '0' + tbPhone : tbPhone;
        return (item.id && String(tb.id_nhan_su) === String(item.id)) ||
          (cleanPhoneWithZero && tbPhoneWithZero === cleanPhoneWithZero);
      });
      setPersonnelThueBao(matchedTb || null);

      // 2. Quét tìm danh sách Trang thiết bị nhân sự đang nắm giữ
      const latestLogsMap: Record<string, any> = {};
      nhatKyList.forEach(log => {
        const ttbId = log.id_ts_thiet_bi;
        if (!latestLogsMap[ttbId] || new Date(log.ngay_ghi_nhan).getTime() > new Date(latestLogsMap[ttbId].ngay_ghi_nhan).getTime()) {
          latestLogsMap[ttbId] = log;
        }
      });
      const foundAssets: any[] = [];
      const initialAssetActions: Record<string, 'TRANSFER' | 'REVOKE'> = {};
      Object.values(latestLogsMap).forEach(log => {
        if (
          log.msnv_nguoi_dung === item.ma_so_nhan_vien &&
          log.loai_nhat_ky !== 'Báo hỏng' &&
          log.loai_nhat_ky !== 'Thu hồi lưu kho' &&
          log.loai_nhat_ky !== 'Thu hồi'
        ) {
          const assetInfo = thietBiList.find(tb => tb.id === log.id_ts_thiet_bi);
          if (assetInfo) {
            const rawId = assetInfo.id;
            foundAssets.push({
              id: assetInfo.ma_tai_san || assetInfo.id,
              rawId,
              rawDevice: assetInfo,
              name: assetInfo.ten_thiet_bi,
              group: assetInfo.nhom_thiet_bi,
              sn: assetInfo.so_seri || '-',
              date: new Date(log.ngay_ghi_nhan).toLocaleDateString('vi-VN')
            });
            initialAssetActions[rawId] = existingPending?.transferAssetActions?.[rawId] || 'TRANSFER';
          }
        }
      });
      setUnreturnedAssets(foundAssets);
      setTransferAssetActions(initialAssetActions);
    } catch (err) {
      console.error("Lỗi quét tài sản/SIM:", err);
      toast.error("Cảnh báo: Không thể kiểm tra CSDL Tài sản & Thuê bao.");
      setIsOffboardOpen(false);
    } finally {
      setCheckingAssets(false);
    }
  };

  const confirmOffboard = async () => {
    if (!personnelToOffboard) return;
    if (transferType !== 'INTERNAL' && unreturnedAssets.length > 0 && !forceOffboard) {
      toast.warning("Vui lòng xử lý tài sản hoặc tick xác nhận!");
      return;
    }

    if (transferType === 'INTERNAL' && !transferInternalUnitId) {
      toast.warning("Vui lòng chọn Đơn vị đích nội bộ!");
      return;
    }
    if (transferType === 'EXTERNAL' && !transferExternalUnitName.trim()) {
      toast.warning("Vui lòng nhập tên đơn vị / công ty ngoài!");
      return;
    }

    setSubmitting(true);
    try {
      let updatedData: any = { ...personnelToOffboard };
      const today = new Date().toISOString().split('T')[0];
      let simUpdated = false;
      let assetTransferCount = 0;
      let assetRevokeCount = 0;

      let simPayload: any = null;
      const assetTasks: any[] = [];

      if (transferType === 'OFFBOARD') {
        updatedData.trang_thai = 'Đã nghỉ việc';
        updatedData.ngay_nghi_viec = today;

        // Tự động thu hồi SIM nếu có
        if (personnelThueBao) {
          let historyList: any[] = [];
          try {
            historyList = typeof personnelThueBao.lich_su_nsd === 'string'
              ? JSON.parse(personnelThueBao.lich_su_nsd)
              : (personnelThueBao.lich_su_nsd || []);
          } catch { historyList = []; }
          const openEntry = historyList.find((e: any) => !e.den_ngay);
          if (openEntry) openEntry.den_ngay = today;
          historyList.push({
            ho_ten: personnelToOffboard.ho_ten,
            ma_so_nv: personnelToOffboard.ma_so_nhan_vien,
            tu_ngay: today,
            den_ngay: today,
            ly_do: 'Thu hồi SIM do nhân sự nghỉ việc',
            nguoi_ghi: user?.ho_ten || 'Hệ thống'
          });
          simPayload = {
            ...personnelThueBao,
            trang_thai: 'Đã thu hồi - Chờ tái cấp',
            id_nhan_su: null,
            ma_so_nv: '',
            ho_ten_nv: '',
            lich_su_nsd: historyList,
            updated_at: new Date().toISOString()
          };
          updatedData.sdt_cong_ty = '';
        }

        // Tự động ghi log Thu hồi lưu kho cho thiết bị nếu tick forceOffboard
        for (const asset of unreturnedAssets) {
          assetTasks.push({
            nkPayload: {
              id: `NK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              id_ts_thiet_bi: asset.rawId,
              id_don_vi: personnelToOffboard.id_don_vi,
              ngay_ghi_nhan: today,
              loai_nhat_ky: 'Thu hồi lưu kho',
              chi_phi: '',
              msnv_nguoi_dung: '',
              ho_ten_nguoi_dung: '',
              bp_quan_ly_su_dung: '',
              tinh_trang_ghi_nhan_thiet_bi: 'Bình thường',
              ghi_chu_sua_chua_nang_cap: `Thu hồi lưu kho do nhân sự ${personnelToOffboard.ho_ten} nghỉ việc`
            }
          });
        }
      } else if (transferType === 'EXTERNAL') {
        updatedData.trang_thai = 'Đã điều chuyển';
        updatedData.ngay_nghi_viec = today;
        updatedData.ghi_chu = `[Đã điều chuyển ra ngoài: ${transferExternalUnitName.trim()}] ` + (updatedData.ghi_chu || '');

        // Tự động thu hồi SIM nếu có
        if (personnelThueBao) {
          let historyList: any[] = [];
          try {
            historyList = typeof personnelThueBao.lich_su_nsd === 'string'
              ? JSON.parse(personnelThueBao.lich_su_nsd)
              : (personnelThueBao.lich_su_nsd || []);
          } catch { historyList = []; }
          const openEntry = historyList.find((e: any) => !e.den_ngay);
          if (openEntry) openEntry.den_ngay = today;
          historyList.push({
            ho_ten: personnelToOffboard.ho_ten,
            ma_so_nv: personnelToOffboard.ma_so_nhan_vien,
            tu_ngay: today,
            den_ngay: today,
            ly_do: `Thu hồi SIM do điều chuyển ra ngoài (${transferExternalUnitName.trim()})`,
            nguoi_ghi: user?.ho_ten || 'Hệ thống'
          });
          simPayload = {
            ...personnelThueBao,
            trang_thai: 'Đã thu hồi - Chờ tái cấp',
            id_nhan_su: null,
            ma_so_nv: '',
            ho_ten_nv: '',
            lich_su_nsd: historyList,
            updated_at: new Date().toISOString()
          };
          updatedData.sdt_cong_ty = '';
        }

        // Tự động ghi log Thu hồi lưu kho cho thiết bị nếu tick forceOffboard
        for (const asset of unreturnedAssets) {
          assetTasks.push({
            nkPayload: {
              id: `NK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              id_ts_thiet_bi: asset.rawId,
              id_don_vi: personnelToOffboard.id_don_vi,
              ngay_ghi_nhan: today,
              loai_nhat_ky: 'Thu hồi lưu kho',
              chi_phi: '',
              msnv_nguoi_dung: '',
              ho_ten_nguoi_dung: '',
              bp_quan_ly_su_dung: '',
              tinh_trang_ghi_nhan_thiet_bi: 'Bình thường',
              ghi_chu_sua_chua_nang_cap: `Thu hồi lưu kho do nhân sự ${personnelToOffboard.ho_ten} điều chuyển ra ngoài`
            }
          });
        }
      } else if (transferType === 'INTERNAL') {
        const targetUnit = donViList.find(d => String(d.id) === String(transferInternalUnitId));
        const targetUnitName = targetUnit?.ten_don_vi || donViMap[transferInternalUnitId] || 'đơn vị mới';
        const targetPn = phapNhanList.find(p => String(p.id) === String(targetUnit?.id_phap_nhan));

        updatedData.id_don_vi = transferInternalUnitId;
        updatedData.ten_don_vi = targetUnitName;
        updatedData.dia_diem_lam_viec = transferDiaDiem.trim();
        updatedData.khoi = transferKhoi.trim();
        updatedData.phong_ban = transferPhongBan.trim();
        updatedData.chuc_danh = transferChucDanh.trim();
        updatedData.chuc_vu = transferChucVu.trim();
        if (!updatedData.trang_thai || updatedData.trang_thai === 'Đã nghỉ việc' || updatedData.trang_thai === 'Đã điều chuyển') {
          updatedData.trang_thai = 'Đang làm việc';
        }
        if (updatedData.ghi_chu) {
          updatedData.ghi_chu = updatedData.ghi_chu.replace(/^\[Đã điều chuyển ra ngoài:[^\]]*\]\s*/, '');
        }

        // 1. XỬ LÝ SIM CÔNG TY
        if (personnelThueBao) {
          let historyList: any[] = [];
          try {
            historyList = typeof personnelThueBao.lich_su_nsd === 'string'
              ? JSON.parse(personnelThueBao.lich_su_nsd)
              : (personnelThueBao.lich_su_nsd || []);
          } catch { historyList = []; }

          const openEntry = historyList.find((e: any) => !e.den_ngay);

          if (transferSimAction === 'REVOKE') {
            // Đơn vị cũ thu hồi lại SIM
            if (openEntry) openEntry.den_ngay = today;
            historyList.push({
              ho_ten: personnelToOffboard.ho_ten,
              ma_so_nv: personnelToOffboard.ma_so_nhan_vien,
              tu_ngay: today,
              den_ngay: today,
              ly_do: `Thu hồi SIM khi nhân sự điều chuyển sang ${targetUnitName}`,
              nguoi_ghi: user?.ho_ten || 'Hệ thống'
            });

            simPayload = {
              ...personnelThueBao,
              trang_thai: 'Đã thu hồi - Chờ tái cấp',
              id_nhan_su: null,
              ma_so_nv: '',
              ho_ten_nv: '',
              lich_su_nsd: historyList,
              updated_at: new Date().toISOString()
            };
            updatedData.sdt_cong_ty = '';
            simUpdated = true;
          } else {
            // Điều chuyển SIM sang đơn vị mới cùng nhân sự
            if (openEntry) openEntry.den_ngay = today;
            historyList.push({
              ho_ten: personnelToOffboard.ho_ten,
              ma_so_nv: personnelToOffboard.ma_so_nhan_vien,
              tu_ngay: today,
              den_ngay: '',
              ly_do: `Điều chuyển nội bộ cùng nhân sự sang ${targetUnitName}`,
              nguoi_ghi: user?.ho_ten || 'Hệ thống'
            });

            simPayload = {
              ...personnelThueBao,
              id_don_vi: transferInternalUnitId,
              id_phap_nhan: targetUnit?.id_phap_nhan || personnelThueBao.id_phap_nhan || '',
              ten_phap_nhan: targetPn?.ten_cong_ty || targetPn?.ten_phap_nhan || personnelThueBao.ten_phap_nhan || '',
              ten_bo_phan: transferPhongBan || personnelThueBao.ten_bo_phan || '',
              lich_su_nsd: historyList,
              updated_at: new Date().toISOString()
            };
            simUpdated = true;
          }
        }

        // 2. XỬ LÝ TRANG THIẾT BỊ
        for (const asset of unreturnedAssets) {
          const action = transferAssetActions[asset.rawId] || 'TRANSFER';
          if (action === 'TRANSFER') {
            assetTasks.push({
              deviceUpdate: {
                ...asset.rawDevice,
                id_don_vi: transferInternalUnitId
              },
              nkPayload: {
                id: `NK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                id_ts_thiet_bi: asset.rawId,
                id_don_vi: transferInternalUnitId,
                id_don_vi_nhan: transferInternalUnitId,
                ngay_ghi_nhan: today,
                loai_nhat_ky: 'Điều chuyển đơn vị',
                chi_phi: '',
                msnv_nguoi_dung: personnelToOffboard.ma_so_nhan_vien,
                ho_ten_nguoi_dung: personnelToOffboard.ho_ten,
                bp_quan_ly_su_dung: transferPhongBan || '',
                tinh_trang_ghi_nhan_thiet_bi: 'Bình thường',
                ghi_chu_sua_chua_nang_cap: `Điều chuyển cùng nhân sự ${personnelToOffboard.ho_ten} sang ${targetUnitName}`
              }
            });
            assetTransferCount++;
          } else {
            assetTasks.push({
              nkPayload: {
                id: `NK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                id_ts_thiet_bi: asset.rawId,
                id_don_vi: personnelToOffboard.id_don_vi,
                ngay_ghi_nhan: today,
                loai_nhat_ky: 'Thu hồi lưu kho',
                chi_phi: '',
                msnv_nguoi_dung: '',
                ho_ten_nguoi_dung: '',
                bp_quan_ly_su_dung: '',
                tinh_trang_ghi_nhan_thiet_bi: 'Bình thường',
                ghi_chu_sua_chua_nang_cap: `Thu hồi lưu kho khi nhân sự ${personnelToOffboard.ho_ten} điều chuyển sang ${targetUnitName}`
              }
            });
            assetRevokeCount++;
          }
        }
      }

      // 3. LƯU CẬP NHẬT HỒ SƠ NHÂN SỰ
      if (isBulkImportOpen) {
        setPendingOffboards(prev => {
          const next = new Map(prev);
          next.set(personnelToOffboard.ma_so_nhan_vien, {
            updatedData,
            transferType,
            transferInternalUnitId,
            transferExternalUnitName,
            transferDiaDiem,
            transferKhoi,
            transferPhongBan,
            transferChucDanh,
            transferChucVu,
            transferSimAction,
            transferAssetActions,
            simPayload,
            assetTasks
          });
          return next;
        });
        setIsOffboardOpen(false);
        setPersonnelToOffboard(null);
      } else {
        // Thực hiện lưu trực tiếp cho trường hợp thao tác đơn lẻ trên danh sách
        if (simPayload) {
          await apiService.save(simPayload, 'update', 'dm_thue_bao');
        }
        for (const task of assetTasks) {
          if (task.deviceUpdate) {
            await apiService.save(task.deviceUpdate, 'update', 'ts_thiet_bi');
          }
          if (task.nkPayload) {
            await apiService.save(task.nkPayload, 'create', 'nk_thiet_bi');
          }
        }
        const fieldsToExclude = ['ngay_sinh', 'email_ca_nhan', 'id_phap_nhan', 'ten_phap_nhan', 'ten_don_vi', 'ngay_nhan_viec', 'phan_loai'];
        const cleanDataToSave = { ...updatedData };
        fieldsToExclude.forEach(f => { delete (cleanDataToSave as any)[f]; });
        await apiService.save(cleanDataToSave, "update", "ns_dich_vu");
        setData(prev => prev.map(item => item.id === personnelToOffboard.id ? updatedData : item));
        setIsOffboardOpen(false);
        setPersonnelToOffboard(null);

        if (transferType === 'INTERNAL') {
          const targetUnitName = donViMap[transferInternalUnitId] || 'đơn vị mới';
          const details: string[] = [];
          if (personnelThueBao) {
            details.push(transferSimAction === 'TRANSFER' ? 'chuyển 1 SIM' : 'thu hồi 1 SIM');
          }
          if (assetTransferCount > 0) details.push(`chuyển ${assetTransferCount} thiết bị`);
          if (assetRevokeCount > 0) details.push(`thu hồi ${assetRevokeCount} thiết bị`);
          const detailMsg = details.length > 0 ? ` (${details.join(', ')})` : '';

          toast.success(`Đã điều chuyển nội bộ nhân sự ${personnelToOffboard.ho_ten} sang ${targetUnitName}${detailMsg} thành công!`);
        } else if (transferType === 'EXTERNAL') {
          toast.success(`Đã xác nhận điều chuyển ra ngoài cho nhân sự ${personnelToOffboard.ho_ten}!`);
        } else {
          toast.success(`Đã xác nhận nghỉ việc cho nhân sự ${personnelToOffboard.ho_ten}!`);
        }
      }
    } catch (err: any) {
      console.error("Lỗi lưu dữ liệu điều chuyển:", err);
      toast.error("Lỗi: " + (err.message || 'Không thể lưu thông tin'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    let unitsToExport: DonVi[] = [];
    const getRegion = (unitId: string): string => {
      const getAncestors = (id: string): string[] => {
        const u = donViList.find(d => d.id === id);
        if (!u || !u.cap_quan_ly || u.cap_quan_ly === 'HO') return [id];
        return [id, ...getAncestors(u.cap_quan_ly)];
      }
      const ancestors = getAncestors(unitId);
      const namIds = ctttNamUnits.map(u => u.id); const bacIds = ctttBacUnits.map(u => u.id);
      if (ancestors.some(id => bacIds.includes(id))) return 'Phía Bắc';
      if (ancestors.some(id => namIds.includes(id))) return 'Phía Nam';
      return 'VPĐH / Khác';
    }
    const topLevelUnits = donViList.filter(dv => allowedDonViIds.includes(dv.id) && (dv.cap_quan_ly === 'HO' || !dv.cap_quan_ly));
    if (exportRegion === 'ALL') { unitsToExport = topLevelUnits; }
    else if (exportRegion === 'NAM') { unitsToExport = topLevelUnits.filter(dv => getRegion(dv.id) === 'Phía Nam'); }
    else if (exportRegion === 'BAC') { unitsToExport = topLevelUnits.filter(dv => getRegion(dv.id) === 'Phía Bắc'); }
    else if (exportRegion === 'SPECIFIC' && selectedUnitFilter) {
      const getTopLevelParent = (id: string): DonVi | undefined => {
        const u = donViList.find(d => d.id === id); if (!u) return undefined;
        if (u.cap_quan_ly === 'HO' || !u.cap_quan_ly) return u; return getTopLevelParent(u.cap_quan_ly);
      };
      const topParent = getTopLevelParent(selectedUnitFilter);
      if (topParent && allowedDonViIds.includes(topParent.id)) { unitsToExport = [topParent]; }
    }
    unitsToExport = unitsToExport.filter(u => u.trang_thai !== 'Đại lý' && u.trang_thai !== 'Đầu tư mới');
    unitsToExport.sort((a, b) => (Number(a.thu_tu) || 9999) - (Number(b.thu_tu) || 9999));
    let rowsHTML = ''; let stt = 1;
    unitsToExport.forEach(dv => {
      const phia = getRegion(dv.id); const tenDV = dv.ten_don_vi;
      const validIds = [dv.id, ...getAllSubordinateIds(dv.id, donViList)];
      const unitStaff = data.filter(p => validIds.includes(p.id_don_vi) && p.trang_thai !== 'Đã nghỉ việc' && p.trang_thai !== 'Đã điều chuyển');

      const ptqtvp = unitStaff.find(p => {
        const cv = String(p.chuc_vu || '').trim().toLowerCase().normalize('NFC');
        return cv === 'pt qtvp' || cv === 'trưởng phòng qtvp' || cv === 'pt qtvp & asđs';
      }) || {};

      const ptns = unitStaff.find(p => {
        const cd = String(p.chuc_danh || '').trim().toLowerCase().normalize('NFC');
        const cv = String(p.chuc_vu || '').trim().toLowerCase().normalize('NFC');
        return cd === 'pt nhân sự' || cd === 'pt ns' || cv === 'pt nhân sự' || cv === 'pt ns' || cv === 'phụ trách nhân sự';
      }) || {};

      let tgd;
      const cleanTenDV = tenDV.trim().toUpperCase();
      if (cleanTenDV === 'THACO AUTO') {
        tgd = unitStaff.find(p => String(p.chuc_vu).trim().toLowerCase() === 'tổng giám đốc') || {};
      } else if (cleanTenDV === 'PHÂN PHỐI THACO AUTO') {
        tgd = unitStaff.find(p => String(p.chuc_vu).toLowerCase().includes('chủ tịch')) || {};
      } else {
        tgd = unitStaff.find(p => {
          const cv = String(p.chuc_vu).trim().toLowerCase();
          return cv.includes('chủ tịch') || cv === 'tổng giám đốc' || cv.includes('thường trực');
        }) || {};
      }

      if (!ptqtvp.ho_ten && !tgd.ho_ten && !ptns.ho_ten && unitStaff.length === 0) return;

      const getSdt = (p: any) => p.sdt_cong_ty || p.sdt_ca_nhan ? formatPhoneNumber(p.sdt_cong_ty || p.sdt_ca_nhan) : '';

      rowsHTML += `<tr>
        <td class="center">${stt++}</td>
        <td>${phia}</td>
        <td class="bold">${tenDV}</td>
        <td>${ptqtvp.ho_ten || ''}</td>
        <td>${ptqtvp.email || ''}</td>
        <td class="center">${getSdt(ptqtvp)}</td>
        <td>${tgd.ho_ten || ''}</td>
        <td>${tgd.email || ''}</td>
        <td class="center">${getSdt(tgd)}</td>
        <td>${ptns.ho_ten || ''}</td>
        <td>${ptns.email || ''}</td>
        <td class="center">${getSdt(ptns)}</td>
      </tr>`;
    });
    const tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; font-family: 'Times New Roman', serif; } th, td { border: 1px solid #000000; padding: 6px; vertical-align: middle; } .header { background-color: #fff2cc; color: #002060; font-weight: bold; text-align: center; } .center { text-align: center; } .bold { font-weight: bold; color: #002060; }</style></head><body><table><thead><tr class="header"><th rowspan="2">STT</th><th rowspan="2">Phía</th><th rowspan="2" style="width: 250px;">ĐƠN VỊ</th><th colspan="3">PT QTVP</th><th colspan="3">LÃNH ĐẠO ĐƠN VỊ</th><th colspan="3">PT NHÂN SỰ</th></tr><tr class="header"><th>Họ và tên</th><th>Email</th><th>SĐT</th><th>Họ và tên</th><th>Email</th><th>SĐT</th><th>Họ và tên</th><th>Email</th><th>SĐT</th></tr></thead><tbody>${rowsHTML}</tbody></table></body></html>`;
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `Danh_Ba_Lanh_Dao_QTVP_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    setIsExportModalOpen(false); toast.success("Đã xuất file Danh bạ (Excel) thành công!");
  };

  const handlePasteBulkData = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawText = e.target.value; setBulkImportText(rawText);
    if (!rawText.trim()) { setBulkImportData([]); return; }
    setIsAnalyzingBulk(true);
    setTimeout(() => {
      try {
        const rows: string[][] = []; let currentRow: string[] = []; let currentCell = ''; let inQuotes = false;
        for (let i = 0; i < rawText.length; i++) {
          const char = rawText[i];
          if (inQuotes) {
            if (char === '"') { if (i + 1 < rawText.length && rawText[i + 1] === '"') { currentCell += '"'; i++; } else { inQuotes = false; } }
            else { currentCell += char; }
          } else {
            if (char === '"') { inQuotes = true; } else if (char === '\t') { currentRow.push(currentCell.trim()); currentCell = ''; }
            else if (char === '\n') { currentRow.push(currentCell.trim()); rows.push(currentRow); currentRow = []; currentCell = ''; }
            else if (char === '\r') { } else { currentCell += char; }
          }
        }
        if (currentCell !== '' || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }

        const formatExcelDate = (dateStr: string) => {
          if (!dateStr) return ''; const parts = dateStr.split(/[\/\-.]/);
          if (parts.length === 3) { let d = parts[0].padStart(2, '0'); let m = parts[1].padStart(2, '0'); let y = parts[2]; if (y.length === 2) y = '20' + y; return `${y}-${m}-${d}`; }
          return dateStr;
        };

        const cleanUnitStr = (str: string) => {
          if (!str) return '';
          return toUnaccented(str).toLowerCase().replace(/[^a-z0-9]/g, '');
        };

        const stripUnitPrefixes = (str: string) => {
          if (!str) return '';
          const s = cleanUnitStr(str);
          const stripped = s
            .replace(/showroom/g, '')
            .replace(/sr/g, '')
            .replace(/vanphong|vp/g, '')
            .replace(/congty|cty/g, '')
            .replace(/tnhh|mtv/g, '')
            .replace(/thacoauto|thaco/g, '');
          return stripped.length >= 2 ? stripped : s;
        };

        const matchUnitInList = (text: string, candidateUnits: DonVi[]): DonVi | null => {
          if (!text || !text.trim()) return null;
          const cleanTarget = cleanUnitStr(text);
          if (!cleanTarget) return null;
          const strippedTarget = stripUnitPrefixes(text);

          // 1. Khớp chính xác hoàn toàn chuỗi sạch (VD: "thacoauto" === "thacoauto")
          const exactMatches = candidateUnits.filter(d => cleanUnitStr(d.ten_don_vi) === cleanTarget);
          if (exactMatches.length > 0) {
            exactMatches.sort((a, b) => getUnitDepth(b.id, donViList) - getUnitDepth(a.id, donViList));
            return exactMatches[0];
          }

          // 2. Khớp sau khi lược bỏ tiền tố (VD: "ansuong" === "ansuong")
          if (strippedTarget) {
            const strippedMatches = candidateUnits.filter(d => stripUnitPrefixes(d.ten_don_vi) === strippedTarget);
            if (strippedMatches.length > 0) {
              strippedMatches.sort((a, b) => getUnitDepth(b.id, donViList) - getUnitDepth(a.id, donViList));
              return strippedMatches[0];
            }
          }

          // 3. Khớp chuỗi con nếu từ khóa đủ đặc thù (độ dài >= 4 ký tự)
          if (cleanTarget.length >= 4) {
            const substringMatches = candidateUnits.filter(d => {
              const c = cleanUnitStr(d.ten_don_vi);
              return c.includes(cleanTarget) || cleanTarget.includes(c);
            });
            if (substringMatches.length > 0) {
              substringMatches.sort((a, b) => getUnitDepth(b.id, donViList) - getUnitDepth(a.id, donViList));
              return substringMatches[0];
            }
          }

          return null;
        };

        // Tự động nhận diện cấu trúc dán:
        // - Mẫu MỚI NHẤT (31 cột): Cột 4 là Giới tính, Cột 16 là Tổ chức, Cột 17 là Ban/Phòng, Cột 18 là Bộ phận
        // - Mẫu 30 cột: Cột 4 là Giới tính, Cột 16 là Ban/Phòng, Cột 17 là Bộ phận
        // - Mẫu CŨ (29 cột): Cột 4 là Chức danh, Cột 11 là Giới tính
        let hasHeaderToChuc = false;
        let isNewFormatWithGenderCol4 = false;
        let maxCols = 0;
        for (const r of rows) {
          if (r.length > maxCols) maxCols = r.length;
          const c3 = toUnaccented(r[3] || '').trim().toLowerCase();
          const c10 = toUnaccented(r[10] || '').trim().toLowerCase();
          if (c3 === 'gioi tinh' || c3 === 'nam' || c3 === 'nu') {
            isNewFormatWithGenderCol4 = true;
          }
          if (c10 === 'gioi tinh' || c10 === 'nam' || c10 === 'nu') {
            isNewFormatWithGenderCol4 = false;
          }
          const c15 = toUnaccented(r[15] || '').trim().toLowerCase();
          if (c15.includes('to chuc') || c15.includes('mang')) {
            hasHeaderToChuc = true;
          }
        }

        const is31ColFormat = isNewFormatWithGenderCol4 && (maxCols >= 31 || hasHeaderToChuc);
        const is30ColFormat = isNewFormatWithGenderCol4 && !is31ColFormat;

        const parsedData = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]; if (row.length < 3) continue;
          const checkHeader2 = toUnaccented(row[1] || ''); const checkHeader3 = toUnaccented(row[2] || '');
          if (checkHeader2.includes('ma') || checkHeader3.includes('ten')) continue;

          let maNV = '';
          let hoTen = '';
          let gioiTinh = '';
          let namSinh = '';
          let cccdVal = '';
          let diaChiVal = '';
          let sdtCaNhan = '';
          let sdtCongTy = '';
          let emailVal = '';
          let donViCongTacExcel = '';
          let showroomExcel = '';
          let dvChiLuongVal = '';
          let excelDate = '';
          let khoiVal = '';
          let toChucVal = '';
          let phongBanVal = '';
          let boPhanVal = '';
          let chucDanhVal = '';
          let chucVuVal = '';
          let ngachLuongVal = '';
          let diaDiemVal = '';
          let rawNhom = '';
          let hlTu = '';
          let hlDen = '';
          let giaTriDen = '';
          let theThangVal = '';
          let theXeVal = '';
          let hangLoaiXeVal = '';
          let bksVal = '';

          if (is31ColFormat) {
            // MẪU MỚI NHẤT (31 CỘT: CÓ TỔ CHỨC)
            maNV = row[1]?.trim() || '';
            hoTen = row[2]?.trim() || '';
            gioiTinh = row[3]?.trim() || '';
            namSinh = formatExcelDate(row[4]?.trim() || '');
            cccdVal = (row[5] || '').trim();
            diaChiVal = (row[6] || '').trim();
            sdtCaNhan = row[7]?.trim() || '';
            sdtCongTy = row[8]?.trim() || '';
            emailVal = row[9]?.trim() || '';
            donViCongTacExcel = row[10]?.trim() || '';
            showroomExcel = row[11]?.trim() || '';
            dvChiLuongVal = (row[12] || '').trim();
            excelDate = formatExcelDate(row[13]?.trim() || '');
            khoiVal = row[14]?.trim() || '';
            toChucVal = row[15]?.trim() || '';
            phongBanVal = row[16]?.trim() || '';
            boPhanVal = row[17]?.trim() || '';
            chucDanhVal = row[18]?.trim() || '';
            chucVuVal = row[19]?.trim() || '';
            ngachLuongVal = row[20]?.trim() || '';
            diaDiemVal = row[21]?.trim() || '';
            // row[22]: Phía (không lưu)
            rawNhom = row[23]?.trim() || '';
            hlTu = formatExcelDate(row[24]?.trim() || '');
            hlDen = formatExcelDate(row[25]?.trim() || '');
            giaTriDen = formatExcelDate(row[26]?.trim() || '');
            theThangVal = (row[27] || '').trim();
            theXeVal = (row[28] || '').trim();
            hangLoaiXeVal = (row[29] || '').trim();
            bksVal = (row[30] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          } else if (is30ColFormat) {
            // MẪU 30 CỘT (CÓ BỘ PHẬN, CHƯA CÓ TỔ CHỨC)
            maNV = row[1]?.trim() || '';
            hoTen = row[2]?.trim() || '';
            gioiTinh = row[3]?.trim() || '';
            namSinh = formatExcelDate(row[4]?.trim() || '');
            cccdVal = (row[5] || '').trim();
            diaChiVal = (row[6] || '').trim();
            sdtCaNhan = row[7]?.trim() || '';
            sdtCongTy = row[8]?.trim() || '';
            emailVal = row[9]?.trim() || '';
            donViCongTacExcel = row[10]?.trim() || '';
            showroomExcel = row[11]?.trim() || '';
            dvChiLuongVal = (row[12] || '').trim();
            excelDate = formatExcelDate(row[13]?.trim() || '');
            khoiVal = row[14]?.trim() || '';
            phongBanVal = row[15]?.trim() || '';
            boPhanVal = row[16]?.trim() || '';
            chucDanhVal = row[17]?.trim() || '';
            chucVuVal = row[18]?.trim() || '';
            ngachLuongVal = row[19]?.trim() || '';
            diaDiemVal = row[20]?.trim() || '';
            // row[21]: Phía (không lưu)
            rawNhom = row[22]?.trim() || '';
            hlTu = formatExcelDate(row[23]?.trim() || '');
            hlDen = formatExcelDate(row[24]?.trim() || '');
            giaTriDen = formatExcelDate(row[25]?.trim() || '');
            theThangVal = (row[26] || '').trim();
            theXeVal = (row[27] || '').trim();
            hangLoaiXeVal = (row[28] || '').trim();
            bksVal = (row[29] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          } else {
            // MẪU CŨ (29 CỘT)
            maNV = row[1]?.trim() || '';
            hoTen = row[2]?.trim() || '';
            chucDanhVal = row[3]?.trim() || '';
            chucVuVal = row[4]?.trim() || '';
            phongBanVal = row[5]?.trim() || '';
            donViCongTacExcel = row[6]?.trim() || '';
            showroomExcel = row[7]?.trim() || '';
            // row[8]: Phía
            sdtCongTy = row[9]?.trim() || '';
            gioiTinh = row[10]?.trim() || '';
            namSinh = formatExcelDate(row[11]?.trim() || '');
            excelDate = formatExcelDate(row[12]?.trim() || '');
            sdtCaNhan = row[13]?.trim() || '';
            emailVal = row[14]?.trim() || '';
            ngachLuongVal = row[15]?.trim() || '';
            rawNhom = row[16]?.trim() || '';
            hlTu = formatExcelDate(row[17]?.trim() || '');
            hlDen = formatExcelDate(row[18]?.trim() || '');
            giaTriDen = formatExcelDate(row[19]?.trim() || '');
            khoiVal = row[20]?.trim() || '';
            diaDiemVal = row[21]?.trim() || '';
            cccdVal = (row[22] || '').trim();
            theThangVal = (row[23] || '').trim();
            theXeVal = (row[24] || '').trim();
            hangLoaiXeVal = (row[25] || '').trim();
            bksVal = (row[26] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            diaChiVal = (row[27] || '').trim();
            dvChiLuongVal = (row[28] || '').trim();
          }

          const nhomNum = rawNhom.replace(/\D/g, '');

          if (!giaTriDen && hlDen && nhomNum) {
            giaTriDen = calcGiaTriDen(hlDen, nhomNum, chuKyList);
          }

          const certName = getChungNhanByNhom(nhomNum) || '';

          const item: Record<string, any> = {
            ma_so_nhan_vien: maNV,
            ho_ten: hoTen
          };

          if (chucDanhVal) item.chuc_danh = chucDanhVal;
          if (chucVuVal) item.chuc_vu = chucVuVal;
          if (toChucVal) item.to_chuc = toChucVal;
          if (phongBanVal) item.phong_ban = phongBanVal;
          if (boPhanVal) item.bo_phan = boPhanVal;
          if (sdtCongTy) item.sdt_cong_ty = sdtCongTy;
          if (gioiTinh) item.gioi_tinh = gioiTinh;
          if (namSinh) item.nam_sinh = namSinh;

          if (excelDate) item.ngay_nhan_vien = excelDate;
          else if (extractStartDateFromMaNV(maNV)) item.ngay_nhan_vien = extractStartDateFromMaNV(maNV);

          if (sdtCaNhan) item.sdt_ca_nhan = sdtCaNhan;
          if (emailVal) item.email = emailVal;
          if (ngachLuongVal) item.ngach_luong = ngachLuongVal;

          // 🟢 TỰ ĐỘNG DÒ TÌM ĐƠN VỊ CÔNG TÁC / SHOWROOM
          let resolvedUnitId = selectedUnitFilter;

          // Danh sách đơn vị cấp dưới của selectedUnitFilter
          const subIds = selectedUnitFilter
            ? [selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)]
            : [];
          const candidateSubUnits = donViList.filter(d => subIds.includes(d.id));

          let matchedUnit: DonVi | null = null;

          // Bước 1: Dò tìm trong phạm vi cây đơn vị đang lọc (ưu tiên cao nhất)
          // 1.1 Thử cột Showroom trước (cấp chi tiết hơn)
          if (showroomExcel && candidateSubUnits.length > 0) {
            matchedUnit = matchUnitInList(showroomExcel, candidateSubUnits);
          }
          // 1.2 Nếu cột Showroom không khớp hoặc trống, thử cột Đơn vị công tác
          if (!matchedUnit && donViCongTacExcel && candidateSubUnits.length > 0) {
            matchedUnit = matchUnitInList(donViCongTacExcel, candidateSubUnits);
          }

          // Bước 2: Nếu không khớp trong cây đang lọc, mở rộng dò tìm trên TOÀN BỘ đơn vị hệ thống
          if (!matchedUnit && showroomExcel) {
            matchedUnit = matchUnitInList(showroomExcel, donViList);
          }
          if (!matchedUnit && donViCongTacExcel) {
            matchedUnit = matchUnitInList(donViCongTacExcel, donViList);
          }

          if (matchedUnit) {
            resolvedUnitId = matchedUnit.id;
          }
          item.id_don_vi = resolvedUnitId;

          if (nhomNum) item.nhom_doi_tuong = nhomNum;
          if (hlTu) item.huan_luyen_tu = hlTu;
          if (hlDen) item.huan_luyen_den = hlDen;
          if (giaTriDen) item.gia_tri_den = giaTriDen;
          if (certName) item.chung_nhan = certName;
          if (giaTriDen || hlDen || hlTu) item.cc_atvsld = true;

          if (khoiVal) item.khoi = khoiVal;
          if (diaDiemVal) item.dia_diem_lam_viec = diaDiemVal;
          if (cccdVal) item.cccd = cccdVal;
          if (theThangVal) item.the_thang = theThangVal;
          if (theXeVal) item.the_xe = theXeVal;
          if (hangLoaiXeVal) item.hang_loai_xe = hangLoaiXeVal;
          if (bksVal) item.bks = bksVal;
          if (diaChiVal) item.dia_chi = diaChiVal;
          if (dvChiLuongVal) item.dv_chi_luong = dvChiLuongVal;

          parsedData.push(item);
        }
        const incoming = parsedData.filter(d => d.ma_so_nhan_vien && d.ho_ten);

        const activeDbList = currentActivePersonnelOfUnit;
        let newCount = 0;
        let updateCount = 0;
        let missingCount = 0;

        const dbMap = new Map<string, any>();
        data.forEach(ns => {
          if (ns.ma_so_nhan_vien && ns.trang_thai === 'Đã nghỉ việc') {
            const k = String(ns.ma_so_nhan_vien).trim().toLowerCase();
            if (!dbMap.has(k)) dbMap.set(k, ns);
          }
        });
        data.forEach(ns => {
          if (ns.ma_so_nhan_vien && ns.trang_thai !== 'Đã nghỉ việc') {
            const k = String(ns.ma_so_nhan_vien).trim().toLowerCase();
            dbMap.set(k, ns);
          }
        });

        incoming.forEach((item: any) => {
          const key = String(item.ma_so_nhan_vien).trim().toLowerCase();
          const existing = dbMap.get(key);
          if (!existing) {
            newCount++;
          } else {
            let hasChanged = false;
            Object.keys(item).forEach(col => {
              if (col === 'id_don_vi') {
                const oldUnit = String(existing.id_don_vi || '').trim();
                const newUnit = String(item.id_don_vi || '').trim();
                if (oldUnit && newUnit && oldUnit !== newUnit) {
                  hasChanged = true;
                }
                return;
              }
              const valIncoming = item[col];
              if (valIncoming !== undefined && valIncoming !== null) {
                const valExisting = existing[col];
                const strIncoming = String(valIncoming).trim().toLowerCase();
                const strExisting = String(valExisting || '').trim().toLowerCase();
                let isDifferent = false;
                if (col.startsWith('sdt_')) {
                  isDifferent = strIncoming.replace(/\D/g, '') !== strExisting.replace(/\D/g, '');
                } else if (col === 'bks') {
                  isDifferent = strIncoming.replace(/[^a-z0-9]/g, '') !== strExisting.replace(/[^a-z0-9]/g, '');
                } else {
                  isDifferent = strIncoming !== strExisting;
                }
                if (isDifferent) hasChanged = true;
              }
            });
            if (hasChanged) updateCount++;
          }
        });

        const incomingMsnvs = new Set(incoming.map(item => String(item.ma_so_nhan_vien).trim().toLowerCase()));
        activeDbList.forEach(ns => {
          const msnv = String(ns.ma_so_nhan_vien || '').trim().toLowerCase();
          if (msnv && !incomingMsnvs.has(msnv)) {
            missingCount++;
          }
        });

        if (newCount > 0) setActiveReconcileTab('new');
        else if (updateCount > 0) setActiveReconcileTab('update');
        else if (missingCount > 0) setActiveReconcileTab('missing');
        else setActiveReconcileTab('unchanged');

        setBulkImportData(incoming);
        toast.success(`Đã phân tích xong: Phát hiện ${newCount} người mới, ${updateCount} cập nhật, ${missingCount} dôi dư!`);
      } catch (err) { toast.error('Lỗi phân tích dữ liệu!'); } finally { setIsAnalyzingBulk(false); }
    }, 100);
  };



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    let value: string | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    if (name === 'thu_nhap') { value = (value as string).replace(/\D/g, ''); }
    setModal(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
  };

  const [isCopyEmailDropdownOpen, setIsCopyEmailDropdownOpen] = useState(false);
  const [selectedNgach, setSelectedNgach] = useState<string[]>([]);
  const [selectedDiaDiem, setSelectedDiaDiem] = useState<string[]>([]);

  const availableNgachLuong = useMemo(() => {
    const activeStaff = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc');
    const ngachList = activeStaff.map(p => p.ngach_luong).filter(n => n && n.trim() !== '');
    return Array.from(new Set(ngachList)).sort();
  }, [filteredPersonnel]);

  const availableDiaDiem = useMemo(() => {
    const activeStaff = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc');
    const locationList = activeStaff.map(p => (p as any).dia_diem_lam_viec || (p as any).noi_lam_viec).filter(n => n && String(n).trim() !== '');
    return Array.from(new Set(locationList)).sort();
  }, [filteredPersonnel]);

  const handleCopyTargetEmails = (type: string) => {
    const activeStaff = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc');
    let targetPersonnel: any[] = [];

    if (type === 'lanh_dao') {
      targetPersonnel = activeStaff.filter(p => p.chuc_danh === 'Lãnh đạo' && String(p.chuc_vu).trim() === 'Tổng Giám đốc');
    } else if (type === 'pt_qtvp') {
      targetPersonnel = activeStaff.filter(p =>
        p.chuc_danh === 'PT QTVP & ASĐS' ||
        p.chuc_danh === 'PT QTVT & ASĐS' ||
        p.chuc_danh === 'PT DVHT KD'
      );
    } else if (type === 'pt_ns') {
      targetPersonnel = activeStaff.filter(p => p.chuc_danh === 'PT Nhân sự' || p.chuc_danh === 'PT NS');
    }

    const emails = targetPersonnel.map(p => p.email?.trim()).filter(Boolean);

    if (emails.length === 0) toast.warning('Không tìm thấy email hợp lệ nào cho nhóm này!');
    else { navigator.clipboard.writeText(emails.join('; ')); toast.success(`Đã copy ${emails.length} email!`); }

    setIsCopyEmailDropdownOpen(false);
    setSelectedNgach([]);
    setSelectedDiaDiem([]);
  };

  const handleCopyMultiCriteria = () => {
    if (selectedNgach.length === 0 && selectedDiaDiem.length === 0) return;

    const activeStaff = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc' && p.trang_thai !== 'Đã điều chuyển');

    const targetPersonnel = activeStaff.filter(p => {
      const loc = (p as any).dia_diem_lam_viec || (p as any).noi_lam_viec || '';
      const ngach = p.ngach_luong || '';

      const passNgach = selectedNgach.length === 0 || selectedNgach.includes(ngach);
      const passDiaDiem = selectedDiaDiem.length === 0 || selectedDiaDiem.includes(loc);

      return passNgach && passDiaDiem;
    });

    const emails = targetPersonnel.map(p => p.email?.trim()).filter(Boolean);

    if (emails.length === 0) {
      toast.warning('Không có nhân sự nào thỏa mãn các tiêu chí đã chọn!');
    } else {
      navigator.clipboard.writeText(emails.join('; '));
      toast.success(`Đã copy ${emails.length} email!`);
    }

    setIsCopyEmailDropdownOpen(false);
    setSelectedNgach([]);
    setSelectedDiaDiem([]);
  };

  const toggleNgach = (nl: string) => setSelectedNgach(prev => prev.includes(nl) ? prev.filter(item => item !== nl) : [...prev, nl]);
  const toggleDiaDiem = (loc: string) => setSelectedDiaDiem(prev => prev.includes(loc) ? prev.filter(item => item !== loc) : [...prev, loc]);

  if (loading) return <PageWithFilterSkeleton rows={8} />;

  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (<button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-50 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all" title="Mở bộ lọc đơn vị"><PanelLeftOpen size={20} /></button>)}

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
        allUnitsLabel="Tất cả Nhân sự trực thuộc"
      />

      <div className="flex-1 min-w-0 max-w-full overflow-hidden p-4 sm:p-6 relative transition-all duration-300 flex flex-col">
        <div className="shrink-0 z-20 flex flex-col">
          <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            <div className="flex items-center gap-2.5">
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
                <h2 className="text-2xl font-bold text-[#00539c] flex items-center gap-2"><Users size={28} /> Quản lý Nhân sự</h2>
                <p className="text-sm font-medium text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({displayPersonnelList.length} nhân sự{totalActivePositions > countActive && activeSubTabPersonnel === 'ACTIVE' ? ` • ${totalActivePositions} vị trí` : ''})
                  </span>
                  {displayPersonnelList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAll(!isAllSelected)}
                      className="text-xs text-[#00539c] hover:text-[#00539c]/80 font-extrabold underline transition-colors"
                    >
                      {isAllSelected ? '✕ Hủy chọn tất cả' : '✓ Chọn tất cả đang xem'}
                    </button>
                  )}
                </p>
              </div>
            </div>

            {activeTab !== 'cuoc_di_dong' && (
              <div className="flex flex-col items-end gap-2 w-full xl:w-auto">
                <div className="flex flex-wrap items-center justify-end gap-2 w-full relative z-30">
                  <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Tìm Mã NV, Họ Tên, Thẻ xe, Chức vụ..."
                      className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                      value={personnelSearchTerm}
                      onChange={(e) => setPersonnelSearchTerm(e.target.value)}
                    />
                  </div>

                  {(filterPhongBan || filterKhoi || filterChucVu || filterChucDanh) && (
                    <button
                      onClick={() => {
                        setFilterPhongBan('');
                        setFilterKhoi('');
                        setFilterChucVu('');
                        setFilterChucDanh('');
                      }}
                      title="Xóa nhanh bộ lọc nâng cao"
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-all flex items-center gap-1 text-[11px] font-bold shadow-xs h-[32px]"
                    >
                      <RotateCcw size={13} /> <span className="hidden sm:inline">Xóa bộ lọc</span>
                      <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                        {[filterPhongBan, filterKhoi, filterChucVu, filterChucDanh].filter(Boolean).length}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      loadData(true);
                      toast.success('Đang đồng bộ dữ liệu mới nhất từ Supabase...');
                    }}
                    title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                    disabled={loading}
                    className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white hover:bg-gray-50 text-gray-700 hover:text-[#05469B] rounded-md border border-gray-200 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
                  >
                    <RotateCcw size={13} className={loading ? 'animate-spin text-[#05469B]' : ''} />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen);
                        setIsAddNewExpanded(false);
                      }}
                      className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${isFeaturesDropdownOpen || showAdvancedFilters
                        ? 'bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white border-[#05469B] shadow-sm'
                        : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:text-[#05469B]'
                        }`}
                    >
                      <Sparkles size={14} className={isFeaturesDropdownOpen || showAdvancedFilters ? 'text-amber-300 animate-pulse' : 'text-[#05469B]'} />
                      <span>Tính năng</span>
                      {(filterPhongBan || filterKhoi || filterChucVu || filterChucDanh) && !showAdvancedFilters && (
                        <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          {[filterPhongBan, filterKhoi, filterChucVu, filterChucDanh].filter(Boolean).length}
                        </span>
                      )}
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFeaturesDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-[40]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[50] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                          <button
                            onClick={() => {
                              setShowAdvancedFilters(!showAdvancedFilters);
                              setIsFeaturesDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${showAdvancedFilters ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'hover:bg-gray-50 text-gray-700'
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-lg ${showAdvancedFilters ? 'bg-amber-500 text-white' : 'bg-blue-50 text-[#05469B]'}`}>
                                <Filter size={14} />
                              </div>
                              <span>Lọc nâng cao</span>
                            </div>
                            {(filterPhongBan || filterKhoi || filterChucVu || filterChucDanh) ? (
                              <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                {[filterPhongBan, filterKhoi, filterChucVu, filterChucDanh].filter(Boolean).length}
                              </span>
                            ) : (
                              <ChevronRight size={14} className="text-gray-400" />
                            )}
                          </button>

                          <div className="relative">
                            <button
                              onClick={() => setIsAddNewExpanded(!isAddNewExpanded)}
                              className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-gray-50 text-gray-700 transition-all"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                                  <UserPlus size={14} />
                                </div>
                                <span>Thêm Nhân sự</span>
                              </div>
                              <ChevronRight size={14} className={`text-gray-400 transition-transform ${isAddNewExpanded ? 'rotate-90' : ''}`} />
                            </button>

                            {isAddNewExpanded && (
                              <div className="pl-9 pr-2 py-1 flex flex-col gap-1 border-l-2 border-indigo-100 ml-5 my-1">
                                <button
                                  onClick={() => {
                                    openModal('create');
                                    setIsFeaturesDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg font-semibold text-xs hover:bg-indigo-50 text-indigo-700 flex items-center gap-2 transition-all cursor-pointer"
                                >
                                  <UserPlus size={13} /> Thêm từng đối tượng
                                </button>
                                <button
                                  onClick={() => {
                                    setIsBulkImportOpen(true);
                                    setIsFeaturesDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg font-semibold text-xs hover:bg-indigo-50 text-indigo-700 flex items-center gap-2 transition-all cursor-pointer"
                                >
                                  <ClipboardPaste size={13} /> Thêm hàng loạt (Form)
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-gray-100 pt-1 mt-1">
                            <button
                              onClick={() => {
                                setIsExportModalOpen(true);
                                setIsFeaturesDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2.5 transition-all"
                            >
                              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                <FileSpreadsheet size={14} />
                              </div>
                              <span>Xuất danh bạ (Excel)</span>
                            </button>
                          </div>

                          <div className="border-t border-gray-100 pt-1 mt-1">
                            <button
                              onClick={() => {
                                setIsCopyEmailDropdownOpen(true);
                                setIsFeaturesDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-50 text-gray-700 flex items-center justify-between transition-all"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-blue-50 text-[#05469B] rounded-lg">
                                  <Copy size={14} />
                                </div>
                                <span>Copy email theo điều kiện</span>
                              </div>
                              <ChevronRight size={14} className="text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {showAdvancedFilters && (
            <div className={`bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-[#05469B] rounded-lg">
                    <Filter size={16} className="shrink-0" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#05469B]">Bộ lọc nâng cao</span>
                  {(filterPhongBan || filterKhoi || filterChucVu || filterChucDanh) && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-in fade-in duration-200">
                      Đang lọc ({[filterPhongBan, filterKhoi, filterChucVu, filterChucDanh].filter(Boolean).length} tiêu chí)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(filterPhongBan || filterKhoi || filterChucVu || filterChucDanh) && (
                    <button
                      onClick={() => {
                        setFilterPhongBan('');
                        setFilterKhoi('');
                        setFilterChucVu('');
                        setFilterChucDanh('');
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-all"
                    >
                      <RotateCcw size={13} /> Xóa bộ lọc
                    </button>
                  )}
                  <button
                    onClick={() => setShowAdvancedFilters(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Ẩn khung bộ lọc"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                    <Layers size={13} className="text-purple-500" /> Khối ({availableFilterOptions.khoiList.length})
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filterKhoi}
                      onChange={(e) => setFilterKhoi(e.target.value)}
                      list="khoi-filter-list"
                      placeholder="Gõ hoặc chọn Khối..."
                      className="w-full text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 pr-7 text-gray-700 focus:bg-white focus:ring-2 focus:ring-[#05469B]/20 focus:border-[#05469B] outline-none transition-all cursor-pointer"
                    />
                    <datalist id="khoi-filter-list">
                      {availableFilterOptions.khoiList.map((item, idx) => (
                        <option key={idx} value={item} />
                      ))}
                    </datalist>
                    {filterKhoi && (
                      <button
                        type="button"
                        onClick={() => setFilterKhoi('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-extrabold text-[10px] w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                    <Building2 size={13} className="text-blue-500" /> Bộ phận ({availableFilterOptions.phongBanList.length})
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filterPhongBan}
                      onChange={(e) => setFilterPhongBan(e.target.value)}
                      list="phong-ban-filter-list"
                      placeholder="Gõ hoặc chọn Bộ phận..."
                      className="w-full text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 pr-7 text-gray-700 focus:bg-white focus:ring-2 focus:ring-[#05469B]/20 focus:border-[#05469B] outline-none transition-all cursor-pointer"
                    />
                    <datalist id="phong-ban-filter-list">
                      {availableFilterOptions.phongBanList.map((item, idx) => (
                        <option key={idx} value={item} />
                      ))}
                    </datalist>
                    {filterPhongBan && (
                      <button
                        type="button"
                        onClick={() => setFilterPhongBan('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-extrabold text-[10px] w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                    <Tag size={13} className="text-emerald-500" /> Chức danh ({availableFilterOptions.chucDanhList.length})
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filterChucDanh}
                      onChange={(e) => setFilterChucDanh(e.target.value)}
                      list="chuc-danh-filter-list"
                      placeholder="Gõ hoặc chọn Chức danh..."
                      className="w-full text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 pr-7 text-gray-700 focus:bg-white focus:ring-2 focus:ring-[#05469B]/20 focus:border-[#05469B] outline-none transition-all cursor-pointer"
                    />
                    <datalist id="chuc-danh-filter-list">
                      {availableFilterOptions.chucDanhList.map((item, idx) => (
                        <option key={idx} value={item} />
                      ))}
                    </datalist>
                    {filterChucDanh && (
                      <button
                        type="button"
                        onClick={() => setFilterChucDanh('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-extrabold text-[10px] w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                    <Briefcase size={13} className="text-orange-500" /> Chức vụ ({availableFilterOptions.chucVuList.length})
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filterChucVu}
                      onChange={(e) => setFilterChucVu(e.target.value)}
                      list="chuc-vu-filter-list"
                      placeholder="Gõ hoặc chọn Chức vụ..."
                      className="w-full text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 pr-7 text-gray-700 focus:bg-white focus:ring-2 focus:ring-[#05469B]/20 focus:border-[#05469B] outline-none transition-all cursor-pointer"
                    />
                    <datalist id="chuc-vu-filter-list">
                      {availableFilterOptions.chucVuList.map((item, idx) => (
                        <option key={idx} value={item} />
                      ))}
                    </datalist>
                    {filterChucVu && (
                      <button
                        type="button"
                        onClick={() => setFilterChucVu('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-extrabold text-[10px] w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🟢 KHU VỰC TAB PHÂN CẤP LỒNG KHỐI LIỀN MẠCH (#00539c) CHUẨN SEGMENTTABS */}
          <div className={`w-full transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
            <SegmentTabs
              theme="personnel"
              tabs={personnelTabs}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
              activeSubTab={activeTab === 'info' ? activeSubTabPersonnel : activeSubTabStats}
              onSubChange={(id) => {
                if (activeTab === 'info') setActiveSubTabPersonnel(id as any);
                else if (activeTab === 'stats') setActiveSubTabStats(id as any);
              }}
              layoutId="personnelMainTabSlide"
              subTabsLayoutId="personnelSubTabSlide"
              fullWidth
            />
          </div>
        </div>

        {activeTab === 'info' && (
          <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>

            {selectedPersonnelIds.length > 0 && (
              <div className="mb-3 px-4 py-3 bg-[#f0fdf4] border border-emerald-200 rounded-xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5 text-[12.5px] font-bold text-emerald-800">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                  <span>Đã chọn <span className="underline font-black text-emerald-700">{selectedPersonnelIds.length}</span> nhân sự từ danh sách</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportSelectedExcel}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <FileSpreadsheet size={13} /> Xuất Excel (Full thông tin)
                  </button>
                  <button
                    onClick={() => setSelectedPersonnelIds([])}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-[11px] rounded-lg transition-colors"
                  >
                    Hủy chọn
                  </button>
                </div>
              </div>
            )}

            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 w-full flex-1 min-h-0 overflow-auto custom-scrollbar">
              <table className="w-full min-w-[1100px] table-fixed text-left border-collapse text-[11.5px]">
                <thead className="sticky top-0 bg-[#f8fafc] z-10 text-[11.5px]">
                  <tr className="border-b border-gray-200 font-bold text-gray-600 uppercase tracking-wider text-center">
                    {showSelectCheckboxes && (
                      <th className="py-2.5 px-3 w-[4%] text-center bg-[#f8fafc]">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-[#00539c] rounded border-gray-300 focus:ring-[#00539c] cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-2.5 px-3 w-[6%] whitespace-nowrap bg-[#f8fafc] text-center">Mã NV</th>
                    <th className="py-2.5 px-3 w-[25%] whitespace-nowrap bg-[#f8fafc] text-center">Họ và tên</th>
                    <th className={`py-2.5 px-3 ${showSelectCheckboxes ? 'w-[28%]' : 'w-[28%]'} bg-[#f8fafc] text-center`}>Chức vụ &amp; Bộ phận</th>
                    <th className={`py-2.5 px-3 ${showSelectCheckboxes ? 'w-[15%]' : 'w-[15%]'} bg-[#f8fafc] text-center`}>Đơn Vị</th>
                    <th className="py-2.5 px-3 w-[10%] whitespace-nowrap bg-[#f8fafc] text-center">Điện thoại</th>
                    <th className="py-2.5 px-3 w-[10%] whitespace-nowrap bg-[#f8fafc] text-center">Thâm niên</th>
                    <th className="py-2.5 px-3 text-center w-[10%] whitespace-nowrap bg-[#f8fafc]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedPersonnel.map((item: any) => (
                    <PersonnelDesktopRow key={item.id} item={item} props={{ showSelectCheckboxes, selectedPersonnelIds, handleSelectRow, donViMap, hasRule, handleView, handleDuplicate, openModal, handleOffboardClick, setPersonnelToRehire, setIsRehireModalOpen, setItemToDelete, setIsConfirmOpen, calculateSeniority }} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="block md:hidden flex-1 min-h-0 overflow-y-auto pb-4 space-y-4 custom-scrollbar">
              {paginatedPersonnel.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 italic">Không tìm thấy nhân sự.</div>
              ) : (
                paginatedPersonnel.map((item: any) => (
                  <PersonnelMobileCard key={item.id} item={item} props={{ showSelectCheckboxes, selectedPersonnelIds, handleSelectRow, donViMap, hasRule, handleView, handleDuplicate, openModal, handleOffboardClick, setPersonnelToRehire, setIsRehireModalOpen, setItemToDelete, setIsConfirmOpen, calculateSeniority }} />
                ))
              )}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              totalRows={displayPersonnelList.length}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
              itemName="nhân sự"
            />
          </div>
        )}

        {/* 🟢 PHẦN 4 */}
        {/* 🟢 TAB THỐNG KÊ (DASHBOARD) */}
        {activeTab === 'stats' && activeSubTabStats === 'NHAN_SU' && (() => {
          // 🟢 TÌM GIÁ TRỊ LỚN NHẤT ĐỂ CHIA TỶ LỆ CỘT RÕ RÀNG HƠN
          const maxSeniority = Math.max(0, ...(Object.values(stats.seniority) as number[]));
          const maxAge = Math.max(0, ...(Object.values(stats.ageGroups) as number[]));

          return (
            <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>

              {/* DÒNG 1: 4 CHỈ SỐ KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-blue-500">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200"><Users size={24} /></div>
                  <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Đang làm việc</p><p className="text-3xl font-black text-gray-800 leading-none">{stats.total}</p></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-emerald-500">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-250"><TrendingUp size={24} /></div>
                  <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Nhận việc Tháng {stats.currentMonth + 1}</p><p className="text-3xl font-black text-emerald-600 leading-none">{stats.newThisMonth}</p></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-orange-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-orange-500">
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200"><ShieldCheck size={24} /></div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1" title="Số được đào tạo ATVSLĐ / Tổng số NV">Đã Đào tạo ATVSLĐ / Tổng</p>
                    <p className="text-3xl font-black text-orange-600 leading-none">{stats.atvsldTrained} <span className="text-lg text-gray-400">/ {stats.total}</span></p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-pink-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-pink-500">
                  <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center shrink-0 border border-pink-200"><Cake size={24} /></div>
                  <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Sinh nhật Tháng {stats.currentMonth + 1}</p><p className="text-3xl font-black text-pink-500 leading-none">{stats.birthdays.length}</p></div>
                </div>
              </div>

              {/* 🟢 BẢNG 1: THỐNG KÊ CHI TIẾT (BV/PVHC) (Đã ép CSS table-fixed chống cuộn) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-0.5 text-sm"><FileSpreadsheet size={18} className="text-[#05469B]" /> Bảng Thống kê Bảo vệ ,Đón tiếp & Phục vụ hậu cần</h3>
                    <p className="text-[10px] text-gray-500">Bảng đã được khóa cứng chiều ngang (table-fixed) vừa khít màn hình.</p>
                  </div>
                </div>
                {/* 🟢 Cuộn dọc với max-h và đóng băng thead */}
                <div className="overflow-y-auto overflow-x-hidden max-h-[350px] custom-scrollbar relative">
                  <table className="w-full table-fixed text-center text-[12px] border-collapse">
                    <thead className="sticky top-0 z-30 bg-white shadow-sm">
                      <tr className="bg-[#fff2cc] font-black text-[#002060]">
                        {/* Chia tỷ lệ cột: Cột đầu 24%, 2 khối giữa mỗi khối 30%, Tổng 16% */}
                        <th className="py-2.5 px-2 border border-gray-300 w-[24%] text-[12px]" rowSpan={2}>BỘ PHẬN / PHÂN LOẠI</th>
                        <th className="py-2.5 px-2 border border-gray-300 w-[30%] text-[12px]" colSpan={3}>BV, ĐÓN TIẾP KH</th>
                        <th className="py-2.5 px-2 border border-gray-300 w-[30%] text-[12px]" colSpan={3}>PV HẬU CẦN</th>
                        <th className="py-2.5 px-2 border border-gray-300 w-[16%] text-[12px]" rowSpan={2}>TỔNG<br />CỘNG</th>
                      </tr>
                      <tr className="bg-[#fff2cc] font-black text-[#002060] leading-tight text-[11px]">
                        <th className="py-2 px-1 border border-gray-300 break-words">NV</th>
                        <th className="py-2 px-1 border border-gray-300 break-words">T.Trưởng<br />T.Phó</th>
                        <th className="py-2 px-1 border border-gray-300 text-emerald-700 break-words">Cộng<br />BV</th>
                        <th className="py-2 px-1 border border-gray-300 break-words">NV</th>
                        <th className="py-2 px-1 border border-gray-300 break-words">T.Trưởng<br />T.Phó</th>
                        <th className="py-2 px-1 border border-gray-300 text-blue-700 break-words">Cộng<br />HC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossTabStats.rows && crossTabStats.rows.length > 0 ? (
                        crossTabStats.rows.map((row: any, idx: number) => {
                          const isRegion = row.type === 'region';
                          const isParent = row.type === 'parent';
                          const rowClass = isRegion ? "bg-gray-100 font-bold text-gray-800" : isParent ? "bg-gray-50/50 font-semibold text-gray-700" : "hover:bg-blue-50/30";
                          const nameClass = isRegion ? "text-left font-black" : isParent ? "text-left pl-2 font-bold" : "text-left pl-4 text-gray-600";
                          return (
                            <tr key={idx} className={rowClass}>
                              <td className={`py-2 px-3 border border-gray-300 ${nameClass} leading-tight text-[12px]`}>{row.name}</td>
                              <td className="p-0.5 border border-gray-300">
                                {row.stats.bv_nv > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Bảo vệ - Nhân viên (${row.name})`, list: row.stats.lists.bv_nv })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.bv_nv}
                                  </button>
                                ) : (isRegion ? 0 : '')}
                              </td>
                              <td className="p-0.5 border border-gray-300">
                                {row.stats.bv_tt_tp > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Bảo vệ - Tổ trưởng/Phó (${row.name})`, list: row.stats.lists.bv_tt_tp })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.bv_tt_tp}
                                  </button>
                                ) : (isRegion ? 0 : '')}
                              </td>
                              <td className={`p-0.5 border border-gray-300 ${isRegion ? 'text-emerald-700 bg-emerald-50/50' : 'text-emerald-600 font-semibold'}`}>
                                {row.stats.totalBV > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Tổng Bảo vệ (${row.name})`, list: row.stats.lists.totalBV })} className="w-full h-full py-1 hover:bg-emerald-100 text-emerald-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.totalBV}
                                  </button>
                                ) : 0}
                              </td>
                              <td className="p-0.5 border border-gray-300">
                                {row.stats.pvhc_nv > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `PVHC - Nhân viên (${row.name})`, list: row.stats.lists.pvhc_nv })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.pvhc_nv}
                                  </button>
                                ) : (isRegion ? 0 : '')}
                              </td>
                              <td className="p-0.5 border border-gray-300">
                                {row.stats.pvhc_tt_tp > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `PVHC - Tổ trưởng/Phó (${row.name})`, list: row.stats.lists.pvhc_tt_tp })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.pvhc_tt_tp}
                                  </button>
                                ) : (isRegion ? 0 : '')}
                              </td>
                              <td className={`p-0.5 border border-gray-300 ${isRegion ? 'text-blue-700 bg-blue-50/50' : 'text-blue-600 font-semibold'}`}>
                                {row.stats.totalPVHC > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Tổng PVHC (${row.name})`, list: row.stats.lists.totalPVHC })} className="w-full h-full py-1 hover:bg-blue-100 text-blue-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.totalPVHC}
                                  </button>
                                ) : 0}
                              </td>
                              <td className={`p-0.5 border border-gray-300 ${isRegion ? 'font-black' : 'font-bold text-gray-700'}`}>
                                {row.stats.totalRow > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Tổng cộng (${row.name})`, list: row.stats.lists.totalRow })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                    {row.stats.totalRow}
                                  </button>
                                ) : 0}
                              </td>
                            </tr>
                          );
                        })
                      ) : (<tr><td colSpan={8} className="p-4 text-gray-400 italic text-center">Không có dữ liệu phù hợp</td></tr>)}

                      {/* DÒNG TỔNG CỘNG TOÀN BẢNG 1 */}
                      {crossTabStats.grandTotal && (
                        <tr className="bg-[#fff2cc] font-black text-[#002060]">
                          <td className="p-1 border border-gray-300 text-center text-[9px]">TỔNG CỘNG</td>
                          <td className="p-0.5 border border-gray-300">
                            {crossTabStats.grandTotal.bv_nv > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'Tổng BV - NV', list: crossTabStats.grandTotal.lists.bv_nv })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.bv_nv}
                              </button>
                            ) : 0}
                          </td>
                          <td className="p-0.5 border border-gray-300">
                            {crossTabStats.grandTotal.bv_tt_tp > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'Tổng BV - TT/TP', list: crossTabStats.grandTotal.lists.bv_tt_tp })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.bv_tt_tp}
                              </button>
                            ) : 0}
                          </td>
                          <td className="p-0.5 border border-gray-300 text-emerald-700">
                            {crossTabStats.grandTotal.totalBV > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'TỔNG BẢO VỆ', list: crossTabStats.grandTotal.lists.totalBV })} className="w-full h-full py-1 hover:bg-emerald-100 text-emerald-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.totalBV}
                              </button>
                            ) : 0}
                          </td>
                          <td className="p-0.5 border border-gray-300">
                            {crossTabStats.grandTotal.pvhc_nv > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'Tổng PVHC - NV', list: crossTabStats.grandTotal.lists.pvhc_nv })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.pvhc_nv}
                              </button>
                            ) : 0}
                          </td>
                          <td className="p-0.5 border border-gray-300">
                            {crossTabStats.grandTotal.pvhc_tt_tp > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'Tổng PVHC - TT/TP', list: crossTabStats.grandTotal.lists.pvhc_tt_tp })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.pvhc_tt_tp}
                              </button>
                            ) : 0}
                          </td>
                          <td className="p-0.5 border border-gray-300 text-blue-700">
                            {crossTabStats.grandTotal.totalPVHC > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'TỔNG PVHC', list: crossTabStats.grandTotal.lists.totalPVHC })} className="w-full h-full py-1 hover:bg-blue-100 text-blue-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.totalPVHC}
                              </button>
                            ) : 0}
                          </td>
                          <td className="p-0.5 border border-gray-300 text-red-600 text-[10px]">
                            {crossTabStats.grandTotal.totalRow > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'TỔNG CỘNG HỆ THỐNG', list: crossTabStats.grandTotal.lists.totalRow })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                {crossTabStats.grandTotal.totalRow}
                              </button>
                            ) : 0}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 🟢 BẢNG 2: CƠ CẤU THEO BỘ PHẬN & CẤP BẬC (Đã ép CSS table-fixed chống cuộn tuyệt đối) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-0.5 text-sm"><Briefcase size={18} className="text-[#05469B]" /> Tổng hợp nhân sự theo Bộ phận & Cấp bậc</h3>
                    <p className="text-[10px] text-gray-500">Bảng đã được khóa cứng chiều ngang (table-fixed) vừa khít màn hình.</p>
                  </div>
                </div>
                {/* 🟢 Cuộn dọc với max-h và đóng băng thead */}
                <div className="overflow-y-auto overflow-x-hidden max-h-[500px] custom-scrollbar relative">
                  <table className="w-full table-fixed text-center text-[12px] border-collapse">
                    <thead className="sticky top-0 z-30 bg-white shadow-sm">
                      <tr>
                        {/* Ép cứng cột Bộ phận chiếm 22% và Nâng z-index lên 40 để đè lên các hàng cuộn */}
                        <th className="py-2.5 px-2 border border-gray-200 bg-[#f8fafc] text-left align-bottom font-black text-[#05469B] uppercase sticky left-0 top-0 z-[40] w-[22%] text-[12px]" rowSpan={2}>BỘ PHẬN</th>
                        {deptTabStats.groupedColumns.map((group, idx) => (
                          <th key={idx} colSpan={group.activeRoles.length} className={`py-2 px-1 border font-black uppercase tracking-normal text-[11px] leading-tight ${group.headerColor}`}>
                            {group.label}
                          </th>
                        ))}
                        {/* Ép cứng cột Tổng cộng chiếm 6% */}
                        <th className="py-2.5 px-1 border border-red-200 bg-red-50 text-red-700 align-bottom font-black text-[11px] w-[6%]" rowSpan={2}>TỔNG</th>
                      </tr>
                      <tr>
                        {deptTabStats.groupedColumns.map((group) => (
                          group.activeRoles.map(col => (
                            // Dùng break-words và text-[10px] để bẻ dòng các chức danh dài, ko cho giãn cột
                            <th key={col} className={`py-2 px-1 border border-gray-200 font-bold text-gray-700 leading-tight text-[10px] break-words ${group.color}`}>
                              {col}
                            </th>
                          ))
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deptTabStats.rows.length > 0 ? (
                        deptTabStats.rows.map((row: string, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                            <td className="py-2 px-2.5 border-r border-gray-200 text-left font-bold text-gray-700 bg-white sticky left-0 z-10 leading-tight text-[12px]">
                              {row}
                            </td>

                            {deptTabStats.groupedColumns.map((group) => (
                              group.activeRoles.map(col => {
                                const val = deptTabStats.deptMap[row][col];
                                const list = deptTabStats.deptListMap[row][col];
                                return (
                                  <td key={col} className={`p-1 border-r border-gray-200 text-gray-700 ${group.color} ${val > 0 ? 'font-semibold' : 'text-gray-300'}`}>
                                    {val > 0 ? (
                                      <button onClick={() => setClickStaffListModal({ isOpen: true, title: `${col} - ${row}`, list: list })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                        {val}
                                      </button>
                                    ) : '-'}
                                  </td>
                                );
                              })
                            ))}

                            <td className="p-1.5 border-l border-red-200 font-black text-red-600 bg-red-50/30">
                              {deptTabStats.deptMap[row].total > 0 ? (
                                <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Tổng NV: ${row}`, list: deptTabStats.deptListMap[row].total })} className="w-full h-full py-1 hover:bg-red-100 font-black text-red-600 transition-colors text-center cursor-pointer">
                                  {deptTabStats.deptMap[row].total}
                                </button>
                              ) : 0}
                            </td>
                          </tr>
                        ))
                      ) : (<tr><td colSpan={100} className="p-6 text-gray-400 italic text-center">Chưa có dữ liệu</td></tr>)}

                      {/* DÒNG TỔNG CỘNG CHỐT BẢNG 2 */}
                      {deptTabStats.rows.length > 0 && (
                        <tr className="border-t-2 border-gray-300 bg-gray-100">
                          <td className="p-1.5 border-r border-gray-200 text-center font-black text-[#05469B] uppercase sticky left-0 z-20 bg-gray-100 text-[12px]">TỔNG</td>
                          {deptTabStats.groupedColumns.map((group) => (
                            group.activeRoles.map(col => (
                              <td key={col} className={`p-1 border-r border-gray-200 font-black text-gray-800 ${group.color}`}>
                                {deptTabStats.colTotals[col] > 0 ? (
                                  <button onClick={() => setClickStaffListModal({ isOpen: true, title: `Tổng ${col} toàn bộ`, list: deptTabStats.colLists[col] })} className="w-full h-full py-1 hover:bg-blue-100 text-gray-800 font-bold transition-colors text-center cursor-pointer">
                                    {deptTabStats.colTotals[col]}
                                  </button>
                                ) : 0}
                              </td>
                            ))
                          ))}
                          <td className="p-1.5 border-l border-red-200 text-[12px] font-black text-white bg-red-500 shadow-inner">
                            {deptTabStats.grandTotal > 0 ? (
                              <button onClick={() => setClickStaffListModal({ isOpen: true, title: 'TỔNG NHÂN SỰ TOÀN HỆ THỐNG', list: deptTabStats.grandTotalList })} className="w-full h-full py-1 hover:bg-red-600 text-white font-bold transition-colors text-center cursor-pointer">
                                {deptTabStats.grandTotal}
                              </button>
                            ) : 0}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>



              {/* DÒNG 4: DANH SÁCH SINH NHẬT TRONG THÁNG */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                <div className="p-5 border-b border-gray-100 bg-pink-50/30">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2"><Cake size={18} className="text-pink-500" /> Danh sách Sinh nhật trong tháng {stats.currentMonth + 1}</h3>
                </div>
                <div className="p-0 max-h-64 overflow-y-auto custom-scrollbar">
                  {stats.birthdays.length === 0 ? (
                    <div className="p-8 text-center text-gray-400"><Cake size={32} className="mx-auto mb-2 opacity-30" /> Không có nhân sự nào sinh tháng này.</div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {stats.birthdays.map((p, idx) => (
                          <tr key={idx} className="hover:bg-pink-50/50 transition-colors">
                            <td className="py-3 px-5 w-16"><div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-black text-xs">{new Date(p.nam_sinh).getDate()}</div></td>
                            <td className="py-3 px-4 font-bold text-gray-800">{p.ho_ten}</td>
                            <td className="py-3 px-4 text-gray-500">{p.chuc_vu}</td>
                            <td className="py-3 px-4 font-semibold text-[#05469B]">{donViMap[String(p.id_don_vi)] || p.id_don_vi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        {activeTab === 'stats' && activeSubTabStats === 'DASHBOARD' && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-6 bg-slate-50 p-4 lg:p-6">
            <PersonnelDashboardTab personnelList={filteredPersonnel} />
            <div>
              <PersonnelNgachLuongTab personnelList={filteredPersonnel} />
            </div>
          </div>
        )}

        {activeTab === 'cuoc' && (
          <CuocDiDongTab
            personnel={data}
            donViList={donViList}
            phapNhanList={phapNhanList}
            allowedDonViIds={allowedDonViIds}
            selectedUnitFilter={selectedUnitFilter}
            selectedUnitSubordinates={selectedUnitSubordinates}
          />
        )}

      </div>

      {/* 🟢 TẤT CẢ CÁC MODALS BÊN DƯỚI */}

      {/* 🟢 MODAL COPY EMAIL THEO ĐIỀU KIỆN */}
      {isCopyEmailDropdownOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-4 bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-base">
                <Copy size={18} /> Copy Email Theo Điều Kiện
              </div>
              <button
                onClick={() => { setIsCopyEmailDropdownOpen(false); setSelectedNgach([]); setSelectedDiaDiem([]); }}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung Modal */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col flex-1 gap-4">
              {/* PHẦN 1: COPY CHỨC DANH */}
              <div>
                <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2">1. Theo chức danh (Copy nhanh)</div>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => handleCopyTargetEmails('lanh_dao')} className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 text-[#05469B] font-bold text-xs border border-gray-200 hover:border-blue-300 transition-all flex items-center gap-2">
                    <Briefcase size={15} className="text-orange-500" /> Cấp Lãnh đạo
                  </button>
                  <button onClick={() => handleCopyTargetEmails('pt_qtvp')} className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 text-[#05469B] font-bold text-xs border border-gray-200 hover:border-blue-300 transition-all flex items-center gap-2">
                    <ShieldCheck size={15} className="text-emerald-500" /> Phụ trách QTVP & ASĐS
                  </button>
                  <button onClick={() => handleCopyTargetEmails('pt_ns')} className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 text-[#05469B] font-bold text-xs border border-gray-200 hover:border-blue-300 transition-all flex items-center gap-2">
                    <Users size={15} className="text-purple-500" /> Phụ trách Nhân sự
                  </button>
                </div>
              </div>

              {/* PHẦN 2: LỌC THEO NGẠCH LƯƠNG */}
              {availableNgachLuong.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                    <span>2. Lọc theo Ngạch Lương</span>
                    <button onClick={() => selectedNgach.length === availableNgachLuong.length ? setSelectedNgach([]) : setSelectedNgach([...availableNgachLuong])} className="text-[#05469B] hover:underline text-[11px] font-black">
                      {selectedNgach.length === availableNgachLuong.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {availableNgachLuong.map((ngach, idx) => (
                      <label key={idx} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs font-semibold text-gray-700 transition-colors">
                        <input type="checkbox" checked={selectedNgach.includes(ngach)} onChange={() => toggleNgach(ngach)} className="rounded text-[#05469B] focus:ring-0 w-3.5 h-3.5 cursor-pointer" />
                        <span className="truncate">{ngach}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* PHẦN 3: LỌC THEO ĐỊA ĐIỂM */}
              {availableDiaDiem.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                    <span>3. Lọc theo Địa điểm làm việc</span>
                    <button onClick={() => selectedDiaDiem.length === availableDiaDiem.length ? setSelectedDiaDiem([]) : setSelectedDiaDiem([...availableDiaDiem])} className="text-[#05469B] hover:underline text-[11px] font-black">
                      {selectedDiaDiem.length === availableDiaDiem.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {availableDiaDiem.map((loc, idx) => (
                      <label key={idx} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs font-semibold text-gray-700 transition-colors">
                        <input type="checkbox" checked={selectedDiaDiem.includes(loc)} onChange={() => toggleDiaDiem(loc)} className="rounded text-[#05469B] focus:ring-0 w-3.5 h-3.5 cursor-pointer" />
                        <span className="truncate">{loc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            {(availableNgachLuong.length > 0 || availableDiaDiem.length > 0) && (
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col gap-2 shrink-0">
                <button
                  onClick={handleCopyMultiCriteria}
                  disabled={selectedNgach.length === 0 && selectedDiaDiem.length === 0}
                  className="w-full py-2.5 bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-all disabled:opacity-50 disabled:from-gray-400 disabled:to-gray-500 shadow-md"
                >
                  <Copy size={16} /> Lọc & Copy Danh sách Email
                </button>
                {(selectedNgach.length > 0 || selectedDiaDiem.length > 0) && (
                  <p className="text-center text-[11px] text-gray-500 font-semibold leading-tight">
                    Đang chọn: {selectedNgach.length > 0 ? `${selectedNgach.length} ngạch` : ''}
                    {selectedNgach.length > 0 && selectedDiaDiem.length > 0 ? ' & ' : ''}
                    {selectedDiaDiem.length > 0 ? `${selectedDiaDiem.length} địa điểm` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-black text-emerald-700 flex items-center gap-2"><FileSpreadsheet size={24} /> Xuất Excel Danh bạ</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">Bạn muốn tải xuống danh bạ (Gồm Lãnh đạo & PT QTVP) của khu vực nào?</p>
            <div className="flex flex-col gap-3 mb-6">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'ALL' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'ALL'} onChange={() => setExportRegion('ALL')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800">Toàn quốc (Toàn bộ Hệ thống)</span></label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'NAM' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'NAM'} onChange={() => setExportRegion('NAM')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800">CTTT Phía Nam (Các tỉnh Miền Nam)</span></label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'BAC' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'BAC'} onChange={() => setExportRegion('BAC')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800">CTTT Phía Bắc (Các tỉnh Miền Bắc)</span></label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'SPECIFIC' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'SPECIFIC'} onChange={() => setExportRegion('SPECIFIC')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800 flex-1">Đơn vị đang xem: <span className="text-emerald-600">{selectedUnitName}</span></span></label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
              <button onClick={handleExportExcel} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"><Download size={20} /> Tải File .XLS</button>
            </div>
          </div>
        </div>
      )}

      {isOffboardOpen && personnelToOffboard && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
            <div className={`text-white p-5 flex items-start justify-between transition-colors ${transferType === 'INTERNAL' ? 'bg-[#00539c]' : transferType === 'EXTERNAL' ? 'bg-indigo-600' : 'bg-orange-500'}`}>
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0 border border-white/40">
                  {transferType === 'INTERNAL' || transferType === 'EXTERNAL' ? <Building2 size={24} /> : <LogOut size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-black mb-1">
                    {transferType === 'INTERNAL' ? 'Điều chuyển Nội bộ' : transferType === 'EXTERNAL' ? 'Điều chuyển Ra ngoài' : 'Thủ tục Nghỉ việc'}
                  </h3>
                  <p className="text-white/85 text-sm font-medium">{personnelToOffboard.ho_ten} - {personnelToOffboard.ma_so_nhan_vien}</p>
                </div>
              </div>
              <button onClick={() => setIsOffboardOpen(false)} className="text-white/80 hover:text-white p-1 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="mb-6 flex flex-col sm:flex-row gap-3">
                <label className={`flex-1 border p-3 rounded-xl cursor-pointer font-bold flex flex-col items-center gap-2 transition-all ${transferType === 'INTERNAL' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                  <input type="radio" name="transferType" value="INTERNAL" checked={transferType === 'INTERNAL'} onChange={() => setTransferType('INTERNAL')} className="hidden" />
                  <Building2 size={20} /> Nội bộ
                </label>
                <label className={`flex-1 border p-3 rounded-xl cursor-pointer font-bold flex flex-col items-center gap-2 transition-all ${transferType === 'EXTERNAL' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                  <input type="radio" name="transferType" value="EXTERNAL" checked={transferType === 'EXTERNAL'} onChange={() => setTransferType('EXTERNAL')} className="hidden" />
                  <Building2 size={20} /> Ra ngoài
                </label>
                <label className={`flex-1 border p-3 rounded-xl cursor-pointer font-bold flex flex-col items-center gap-2 transition-all ${transferType === 'OFFBOARD' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                  <input type="radio" name="transferType" value="OFFBOARD" checked={transferType === 'OFFBOARD'} onChange={() => setTransferType('OFFBOARD')} className="hidden" />
                  <LogOut size={20} /> Nghỉ việc
                </label>
              </div>

              {transferType === 'INTERNAL' && (
                <div className="mb-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-200/80 space-y-4 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-900 tracking-wider">
                    <Building2 size={16} className="text-blue-600" /> Thông tin điều chuyển nội bộ mới
                  </div>

                  {/* Dòng 1: Chọn Đơn vị mới | Địa điểm làm việc */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                    <div className="md:col-span-7">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Chọn Đơn vị mới <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={transferInternalUnitId}
                        onChange={e => setTransferInternalUnitId(e.target.value)}
                        className="w-full p-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs font-medium text-xs sm:text-sm text-gray-800"
                        style={{ fontFamily: 'monospace, sans-serif' }}
                      >
                        <option value="">-- Chọn đơn vị đích --</option>
                        {buildHierarchicalOptions(donViList).map(({ unit, prefix }) => {
                          const isCurrent = personnelToOffboard && String(unit.id) === String(personnelToOffboard.id_don_vi);
                          return (
                            <option key={unit.id} value={unit.id} className="font-normal text-gray-700">
                              {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi} {isCurrent ? ' (Đang công tác)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Địa điểm làm việc</label>
                      <input
                        type="text"
                        value={transferDiaDiem}
                        onChange={e => setTransferDiaDiem(e.target.value)}
                        placeholder="VD: Showroom Bình Dương, Xưởng..."
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Dòng 2: Khối trực thuộc | Bộ phận làm việc | Chức danh | Chức vụ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Khối trực thuộc</label>
                      <select
                        value={transferKhoi}
                        onChange={e => setTransferKhoi(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs text-xs sm:text-sm"
                      >
                        <option value="">-- Chọn Khối --</option>
                        {khoiOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Bộ phận làm việc</label>
                      <input
                        type="text"
                        value={transferPhongBan}
                        onChange={e => setTransferPhongBan(e.target.value)}
                        placeholder="VD: Hành chính, Kỹ thuật..."
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Chức danh</label>
                      <input
                        type="text"
                        list="transfer-chuc-danh-suggestions"
                        value={transferChucDanh}
                        onChange={e => setTransferChucDanh(e.target.value)}
                        placeholder="Nhập hoặc chọn chức danh..."
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs text-xs sm:text-sm"
                      />
                      <datalist id="transfer-chuc-danh-suggestions">
                        {chucDanhSuggestions.map(opt => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Chức vụ</label>
                      <input
                        type="text"
                        value={transferChucVu}
                        onChange={e => setTransferChucVu(e.target.value)}
                        placeholder="VD: Nhân viên, KTV..."
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {transferType === 'EXTERNAL' && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tên đơn vị / Công ty ngoài *</label>
                  <input type="text" value={transferExternalUnitName} onChange={e => setTransferExternalUnitName(e.target.value)} placeholder="Nhập tên đơn vị chuyển đến..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm font-medium" />
                </div>
              )}

              {/* 🟢 KHỐI DÀNH RIÊNG CHO ĐIỀU CHUYỂN NỘI BỘ: XỬ LÝ SIM VÀ TRANG THIẾT BỊ */}
              {transferType === 'INTERNAL' ? (
                <div className="space-y-5">
                  {/* 1. XỬ LÝ SIM / SĐT CÔNG TY */}
                  {(personnelToOffboard.sdt_cong_ty || personnelThueBao) && (
                    <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-900 tracking-wider">
                          <Phone size={16} className="text-amber-600 shrink-0" />
                          <span>Phương án SIM & Cước ĐTDĐ Công ty</span>
                        </div>
                        <span className="font-mono font-bold text-xs bg-white text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs w-fit">
                          {formatPhoneNumber(personnelToOffboard.sdt_cong_ty || personnelThueBao?.so_dien_thoai)}
                          {personnelThueBao?.nha_mang ? ` (${personnelThueBao.nha_mang})` : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${transferSimAction === 'TRANSFER'
                          ? 'border-blue-500 bg-white text-blue-900 shadow-xs ring-2 ring-blue-400/20'
                          : 'border-gray-200 bg-white/60 hover:bg-white text-gray-700'
                          }`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="transferSimAction"
                              value="TRANSFER"
                              checked={transferSimAction === 'TRANSFER'}
                              onChange={() => setTransferSimAction('TRANSFER')}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-bold text-xs text-blue-800">🔄 Điều chuyển SIM sang Đơn vị mới</span>
                          </div>
                          <p className="text-[11px] text-gray-500 pl-6 leading-relaxed">
                            SIM đi cùng nhân sự sang đơn vị đích. Pháp nhân đơn vị mới tiếp tục chi trả cước.
                          </p>
                        </label>

                        <label className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${transferSimAction === 'REVOKE'
                          ? 'border-amber-500 bg-white text-amber-900 shadow-xs ring-2 ring-amber-400/20'
                          : 'border-gray-200 bg-white/60 hover:bg-white text-gray-700'
                          }`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="transferSimAction"
                              value="REVOKE"
                              checked={transferSimAction === 'REVOKE'}
                              onChange={() => setTransferSimAction('REVOKE')}
                              className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="font-bold text-xs text-amber-800">📥 Đơn vị cũ thu hồi lại SIM</span>
                          </div>
                          <p className="text-[11px] text-gray-500 pl-6 leading-relaxed">
                            Gỡ số khỏi nhân sự, chuyển về kho của đơn vị hiện tại để cấp cho người khác.
                          </p>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* 2. XỬ LÝ TRANG THIẾT BỊ / TÀI SẢN */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-800 tracking-wider">
                        <Monitor size={16} className="text-[#05469B] shrink-0" />
                        <span>Trang thiết bị đang giữ ({unreturnedAssets.length} thiết bị)</span>
                      </div>
                      {unreturnedAssets.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allTransfer: Record<string, 'TRANSFER' | 'REVOKE'> = {};
                              unreturnedAssets.forEach(a => { allTransfer[a.rawId] = 'TRANSFER'; });
                              setTransferAssetActions(allTransfer);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          >
                            ⚡ Chuyển tất cả sang ĐV mới
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allRevoke: Record<string, 'TRANSFER' | 'REVOKE'> = {};
                              unreturnedAssets.forEach(a => { allRevoke[a.rawId] = 'REVOKE'; });
                              setTransferAssetActions(allRevoke);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                          >
                            ⚡ Thu hồi tất cả về ĐV cũ
                          </button>
                        </div>
                      )}
                    </div>

                    {checkingAssets ? (
                      <div className="flex flex-col items-center justify-center py-8 border border-gray-100 rounded-xl bg-gray-50/50">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                        <p className="text-gray-600 text-xs font-bold">Đang quét hệ thống Tài sản & Thuê bao...</p>
                      </div>
                    ) : unreturnedAssets.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800">
                        <CheckCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold text-emerald-900">An toàn điều chuyển</p>
                          <p className="text-emerald-700 mt-0.5">Nhân sự hiện không giữ thiết bị phần cứng nào thuộc đơn vị cũ.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                            <tr>
                              <th className="p-2.5 border-r border-gray-200">Tên Thiết bị / Mã tài sản</th>
                              <th className="p-2.5 w-32 border-r border-gray-200">Số Seri (S/N)</th>
                              <th className="p-2.5 w-24 border-r border-gray-200 text-center">Ngày nhận</th>
                              <th className="p-2.5 w-60 text-center">Phương án xử lý</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {unreturnedAssets.map((asset, idx) => {
                              const currentAction = transferAssetActions[asset.rawId] || 'TRANSFER';
                              return (
                                <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="p-2.5 border-r border-gray-100">
                                    <p className="font-bold text-gray-800">{asset.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">{asset.id} • {asset.group}</p>
                                  </td>
                                  <td className="p-2.5 font-mono text-xs text-gray-600 border-r border-gray-100">{asset.sn}</td>
                                  <td className="p-2.5 text-center text-gray-500 border-r border-gray-100">{asset.date}</td>
                                  <td className="p-2 text-center">
                                    <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => setTransferAssetActions(prev => ({ ...prev, [asset.rawId]: 'TRANSFER' }))}
                                        className={`py-1 px-2.5 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${currentAction === 'TRANSFER'
                                          ? 'bg-blue-600 text-white shadow-xs'
                                          : 'text-gray-600 hover:text-gray-900'
                                          }`}
                                      >
                                        🔄 Chuyển sang ĐV mới
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setTransferAssetActions(prev => ({ ...prev, [asset.rawId]: 'REVOKE' }))}
                                        className={`py-1 px-2.5 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${currentAction === 'REVOKE'
                                          ? 'bg-amber-600 text-white shadow-xs'
                                          : 'text-gray-600 hover:text-gray-900'
                                          }`}
                                      >
                                        📥 Thu hồi về ĐV cũ
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 🔴 KHỐI DÀNH CHO NGHỈ VIỆC & RA NGOÀI (GIỮ NGUYÊN QUY TRÌNH KIỂM TRA TÀI SẢN & SIM) */
                <div className="space-y-4">
                  {personnelToOffboard.sdt_cong_ty && (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3">
                      <Phone className="text-yellow-600 shrink-0 w-6 h-6" />
                      <div>
                        <h4 className="font-black text-yellow-800 mb-1">CẢNH BÁO: Thu hồi SIM Công ty!</h4>
                        <p className="text-sm text-yellow-700 font-medium">Nhân sự này đang được cấp số điện thoại: <span className="font-black text-yellow-900">{formatPhoneNumber(personnelToOffboard.sdt_cong_ty)}</span>. Hệ thống sẽ tự động chuyển SIM này về trạng thái "Đã thu hồi - Chờ tái cấp" của đơn vị.</p>
                      </div>
                    </div>
                  )}

                  {checkingAssets ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-gray-100 rounded-xl"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" /><p className="text-gray-600 font-bold">Đang quét hệ thống Tài sản & Nhật ký...</p></div>
                  ) : unreturnedAssets.length > 0 ? (
                    <div className="space-y-4">
                      <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3">
                        <AlertTriangle className="text-red-500 shrink-0 w-6 h-6" />
                        <div>
                          <h4 className="font-black text-red-700 mb-1">CẢNH BÁO: Nhân sự đang giữ Tài sản!</h4>
                          <p className="text-sm text-red-600 font-medium mb-3">Hệ thống phát hiện nhân sự này đang là người nhận cuối cùng của các tài sản dưới đây. Vui lòng thu hồi hoặc bàn giao trước khi cho nghỉ.</p>
                          <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-red-50/50"><tr className="text-red-800 font-bold"><th className="p-2 border-b border-red-100">Mã / Tên Tài sản</th><th className="p-2 border-b border-red-100">S/N</th><th className="p-2 border-b border-red-100 text-right">Ngày nhận</th></tr></thead>
                              <tbody className="divide-y divide-red-50">
                                {unreturnedAssets.map((asset, idx) => (
                                  <tr key={idx} className="border-b border-red-50 last:border-0 hover:bg-red-50/30">
                                    <td className="p-2"><p className="font-bold text-gray-800">{asset.name}</p><p className="text-[10px] text-gray-500">{asset.id} • {asset.group}</p></td>
                                    <td className="p-2 font-mono text-xs text-gray-600">{asset.sn}</td>
                                    <td className="p-2 text-right font-medium text-red-600">{asset.date}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                        <input type="checkbox" checked={forceOffboard} onChange={(e) => setForceOffboard(e.target.checked)} className="mt-1 w-5 h-5 rounded text-orange-500 focus:ring-orange-500 border-gray-300" />
                        <span className="text-sm font-semibold text-gray-700">
                          Tôi xác nhận đã thu hồi các tài sản/SIM này ngoài hệ thống và đồng ý ghi log thu hồi lưu kho tự động.
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 bg-emerald-50 rounded-xl border border-emerald-100">
                      <CheckCheck className="w-16 h-16 text-emerald-500 mb-3" />
                      <h4 className="font-black text-emerald-700 text-lg mb-1">An toàn chốt nghỉ việc</h4>
                      <p className="text-emerald-600 font-medium text-sm text-center px-4">Hệ thống không ghi nhận thiết bị phần cứng nào đang được giao cho nhân sự này.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsOffboardOpen(false)} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Hủy bỏ</button>
              <button
                onClick={confirmOffboard}
                disabled={
                  submitting ||
                  (transferType === 'INTERNAL'
                    ? !transferInternalUnitId
                    : (unreturnedAssets.length > 0 && !forceOffboard) ||
                    (transferType === 'EXTERNAL' && !transferExternalUnitName.trim()))
                }
                className={`px-6 py-2.5 text-white rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${transferType === 'INTERNAL'
                  ? 'bg-[#00539c] hover:bg-[#004077]'
                  : transferType === 'EXTERNAL'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                  }`}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : transferType === 'INTERNAL' || transferType === 'EXTERNAL' ? (
                  <Building2 className="w-5 h-5" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
                {transferType === 'INTERNAL' || transferType === 'EXTERNAL' ? 'Xác nhận điều chuyển' : 'Xác nhận nghỉ việc'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 VIEW MODAL (ĐÃ MỞ RỘNG VÀ BỔ SUNG KHỐI, ĐỊA ĐIỂM LV) */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 overflow-hidden mt-auto sm:mt-0">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] rounded-t-3xl sm:rounded-t-2xl text-white shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2"><UserIcon size={20} /> Chi tiết Hồ sơ Nhân sự</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-white hover:text-red-300 hover:bg-white/10 rounded-full p-1.5 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 border-b border-gray-100 pb-6 text-center sm:text-left relative">
                {viewData.trang_thai === 'Đã nghỉ việc' && (<div className="absolute top-0 right-0 bg-red-100 text-red-700 font-black px-3 py-1 rounded border border-red-200 flex items-center gap-1"><LogOut size={16} /> ĐÃ NGHỈ VIỆC</div>)}
                {viewData.trang_thai === 'Đã điều chuyển' && (<div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 font-black px-3 py-1 rounded border border-indigo-200 flex items-center gap-1"><LogOut size={16} /> ĐÃ ĐIỀU CHUYỂN</div>)}
                <div className="w-24 h-24 sm:w-28 sm:h-32 rounded-2xl bg-blue-100 text-[#05469B] flex items-center justify-center text-4xl font-black shrink-0 border-4 border-white shadow-md overflow-hidden relative">
                  {viewData.hinh_anh ? (<img src={getDirectImageLink(viewData.hinh_anh)} alt={viewData.ho_ten} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Lỗi+Ảnh'; }} />) : (viewData.ho_ten?.charAt(0).toUpperCase() || 'U')}
                </div>
                <div className="flex-1 mt-2 sm:mt-0">
                  <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-3 mb-1">
                    <h2 className="text-2xl font-black text-gray-800">{viewData.ho_ten}</h2><span className="px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-bold text-gray-600">ID: {viewData.ma_so_nhan_vien}</span>
                  </div>
                  <p className="text-lg font-bold text-[#05469B] mb-3">{viewData.chuc_vu}</p>
                  <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-sm text-gray-600 font-medium">
                    {viewData.sdt_cong_ty && (<a href={`tel:${String(viewData.sdt_cong_ty).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-800 border border-blue-100 hover:bg-blue-100 transition-colors"><Phone size={16} className="text-blue-500" /> SĐT Cty: <span className="font-bold">{formatPhoneNumber(viewData.sdt_cong_ty)}</span></a>)}
                    {viewData.sdt_ca_nhan && (
                      hasRule('NS_HIDE_SENSITIVE') ? (
                        <span className="flex items-center justify-center sm:justify-start gap-1.5 bg-gray-50 px-2 py-1 rounded text-gray-500 border border-gray-200"><Lock size={16} className="text-gray-400" /> SĐT Cá nhân: <span className="font-bold">***</span></span>
                      ) : (
                        <a href={`tel:${String(viewData.sdt_ca_nhan).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-emerald-50 px-2 py-1 rounded text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"><Phone size={16} className="text-emerald-500" /> SĐT Cá nhân: <span className="font-bold">{formatPhoneNumber(viewData.sdt_ca_nhan)}</span></a>
                      )
                    )}
                    <span className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 sm:mt-0"><Mail size={16} className="text-gray-400" /> {viewData.email || 'Chưa có Email'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><Building2 size={18} className="text-[#05469B]" /> Thông tin Công tác</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Đơn vị</p><p className="font-semibold text-gray-800 break-words">{donViMap[String(viewData.id_don_vi)] || viewData.id_don_vi || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Khối</p><p className="font-semibold text-[#1e2939]">{viewData.khoi || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Tổ chức / Mảng</p><p className="font-semibold text-gray-800">{viewData.to_chuc || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Ban/Phòng</p><p className="font-semibold text-gray-800">{viewData.phong_ban || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Bộ phận</p><p className="font-semibold text-gray-800">{viewData.bo_phan || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Địa điểm LV</p><p className="font-semibold text-[#1e2939]">{viewData.dia_diem_lam_viec || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Chức danh</p><p className="font-semibold text-gray-800">{viewData.chuc_danh || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngày nhận việc</p><p className="font-semibold text-gray-800">{viewData.ngay_nhan_vien ? new Date(viewData.ngay_nhan_vien).toLocaleDateString('vi-VN') : '---'}</p></div>
                  {viewData.trang_thai === 'Đã nghỉ việc' ? (
                    <div>
                      <p className="text-xs text-red-500 uppercase font-bold mb-1">Ngày nghỉ việc</p>
                      <p className="font-semibold text-red-600">{viewData.ngay_nghi_viec ? new Date(viewData.ngay_nghi_viec).toLocaleDateString('vi-VN') : '---'}</p>
                    </div>
                  ) : viewData.trang_thai === 'Đã điều chuyển' ? (
                    <div>
                      <p className="text-xs text-indigo-500 uppercase font-bold mb-1">Ngày điều chuyển</p>
                      <p className="font-semibold text-indigo-600">{viewData.ngay_nghi_viec ? new Date(viewData.ngay_nghi_viec).toLocaleDateString('vi-VN') : '---'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold mb-1">Thâm niên</p>
                      <p className="font-semibold text-emerald-600">{calculateSeniority(viewData.ngay_nhan_vien, viewData.trang_thai || 'Đang làm việc', viewData.ngay_nghi_viec || '')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngạch lương</p>
                    {hasRule('NS_HIDE_SENSITIVE') ? (
                      <p className="font-semibold text-gray-400">***</p>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className={`font-semibold ${showNgachLuong ? 'text-[#05469B]' : 'text-gray-400 tracking-widest mt-1'}`}>
                          {showNgachLuong ? (viewData.ngach_luong || '---') : '••••••'}
                        </p>
                        {(viewData.ngach_luong && viewData.ngach_luong.trim() !== '') && (
                          <button onClick={() => setShowNgachLuong(!showNgachLuong)} className="text-gray-400 hover:text-[#05469B] transition-colors" title={showNgachLuong ? "Ẩn ngạch lương" : "Hiện ngạch lương"}>
                            {showNgachLuong ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Đơn vị chi lương</p>
                    <p className="font-semibold text-[#05469B] break-words">{viewData.dv_chi_luong || '---'}</p>
                  </div>
                  {viewData.ngay_vao_lam_lai && (<div className="col-span-2 md:col-span-1"><p className="text-xs text-blue-500 uppercase font-bold mb-1">Vào làm lại</p><p className="font-semibold text-blue-600">{new Date(viewData.ngay_vao_lam_lai).toLocaleDateString('vi-VN')}</p></div>)}
                  <div className="col-span-2 md:col-span-4 lg:col-span-5 h-px bg-gray-200 my-1"></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Thẻ thang máy</p><p className="font-semibold text-gray-800">{viewData.the_thang === 'Yes' ? 'Có sử dụng' : (viewData.the_thang && viewData.the_thang !== 'No' && viewData.the_thang !== 'Không có' ? viewData.the_thang : 'Không')}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Thẻ gửi xe</p><p className="font-semibold text-gray-800">{(viewData.the_xe && viewData.the_xe !== 'No' && viewData.the_xe !== 'Không có' && String(viewData.the_xe).trim() !== '') ? (viewData.the_xe === 'Yes' ? 'Có sử dụng' : viewData.the_xe) : 'Không'}</p></div>
                  {Boolean(viewData.the_xe && viewData.the_xe !== 'No' && viewData.the_xe !== 'Không có' && String(viewData.the_xe).trim() !== '') && (
                    <>
                      <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Hãng - Loại xe</p><p className="font-semibold text-gray-800">{viewData.hang_loai_xe || '---'}</p></div>
                      <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Biển kiểm soát</p><p className="font-semibold font-mono tracking-wider text-gray-800">{viewData.bks || '---'}</p></div>
                    </>
                  )}
                </div>
              </div>

              {/* 🟢 KHỐI DANH SÁCH VAI TRÒ KIÊM NHIỆM */}
              {viewData.kiem_nhiem_list && viewData.kiem_nhiem_list.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 shadow-2xs">
                  <h4 className="font-bold text-amber-900 mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-600" />
                    Các vị trí kiêm nhiệm ({viewData.kiem_nhiem_list.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {viewData.kiem_nhiem_list.map((kn: any, idx: number) => (
                      <div key={idx} className="bg-white p-3.5 rounded-lg border border-amber-200/70 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-bold text-gray-900 text-sm">{kn.chuc_vu}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Kiêm nhiệm
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Building2 size={13} className="text-gray-400 shrink-0" />
                              <span className="font-medium text-gray-800">{kn.ten_don_vi}</span>
                            </div>
                            {(kn.phong_ban || kn.khoi) && (
                              <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                                {kn.phong_ban && <span>BP: {kn.phong_ban}</span>}
                                {kn.phong_ban && kn.khoi && <span>•</span>}
                                {kn.khoi && <span>Khối: {kn.khoi}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {hasRule('NS_EDIT') && kn.raw && (
                          <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setIsViewModalOpen(false);
                                openModal('update', kn.raw);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Edit size={12} /> Chỉnh sửa vị trí này
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🟢 HÀNG CÁ NHÂN & NGOẠI HÌNH (35%) + BIỂU ĐỒ CƯỚC (65%) */}
              <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Khối Cá nhân & Ngoại hình (35%) */}
                <div className="lg:w-[35%] shrink-0 flex flex-col">
                  <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><UserIcon size={18} className="text-orange-500" /> Cá nhân & Ngoại hình</h4>
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-3 flex-1">
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4">
                      <span className="text-gray-500 text-sm sm:w-20 shrink-0">CCCD:</span>
                      {hasRule('NS_HIDE_SENSITIVE') ? (
                        <span className="font-semibold text-gray-400 text-sm sm:text-right">***</span>
                      ) : (
                        <div className="flex items-center gap-1.5 sm:justify-end flex-1">
                          <span className={`font-semibold ${showCCCD ? 'text-gray-800' : 'text-gray-400 tracking-widest mt-0.5'} text-sm`}>
                            {showCCCD ? (viewData.cccd || '---') : '••••••••••••'}
                          </span>
                          {(viewData.cccd && viewData.cccd.trim() !== '') && (
                            <button onClick={() => setShowCCCD(!showCCCD)} className="text-gray-400 hover:text-orange-500 transition-colors" title={showCCCD ? "Ẩn CCCD" : "Hiện CCCD"}>
                              {showCCCD ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4">
                      <span className="text-gray-500 text-sm sm:w-20 shrink-0">Địa chỉ:</span>
                      <span className="font-semibold text-gray-800 text-sm sm:text-right flex-1 break-words">
                        {viewData.dia_chi || '---'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Giới tính:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.gioi_tinh || '---'}</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Năm sinh:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.nam_sinh ? new Date(viewData.nam_sinh).toLocaleDateString('vi-VN') : '---'} {viewData.tuoi && <span className="ml-2 text-orange-600 font-bold">({viewData.tuoi} tuổi)</span>}</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Trình độ:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.trinh_do_hoc_van || '---'}</span></div>
                    {viewData.sdt_cong_ty && (
                      <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4">
                        <span className="text-gray-500 text-sm sm:w-32 shrink-0">Định mức cước ĐTDĐ:</span>
                        <span className="font-bold text-[#05469B] text-sm sm:text-right">
                          {viewData.dinh_muc_cuoc !== null && viewData.dinh_muc_cuoc !== undefined
                            ? `${formatCurrency(viewData.dinh_muc_cuoc)} VNĐ`
                            : 'Thanh toán thực tế (TT)'}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4">
                      <span className="text-gray-500 text-sm sm:w-20 shrink-0">Thu nhập:</span>
                      <span className="font-semibold text-gray-800 text-sm sm:text-right">
                        {hasRule('NS_HIDE_SENSITIVE') ? '***' : (viewData.thu_nhap ? `${formatCurrency(viewData.thu_nhap)} VNĐ` : '---')}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                      <span className="text-gray-500 text-sm sm:w-20 shrink-0">Ngoại hình:</span>
                      <span className="font-semibold text-gray-800 text-sm sm:text-right whitespace-pre-wrap flex-1">
                        {hasRule('NS_HIDE_SENSITIVE') ? '***' : (viewData.mo_to_ngoai_hinh || '---')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối Biểu đồ Cước (65%) */}
                <div className="lg:w-[65%] flex-1 flex flex-col min-w-0">
                  <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2">
                    <Phone size={18} className="text-[#05469B]" /> TỔNG HỢP CƯỚC ĐTDĐ
                  </h4>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex-1 flex flex-col">
                    <PersonnelDetailCuocChart personnel={viewData} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-500" /> Chứng chỉ / Kỹ năng</h4>
                <div className="flex flex-col gap-3">
                  {viewData.giay_phep_lai_xe && viewData.giay_phep_lai_xe !== 'Không có' && (
                    <div className="flex flex-wrap gap-2 items-center"><span className="text-sm font-bold text-gray-600 mr-1 shrink-0">Bằng lái xe:</span>{viewData.giay_phep_lai_xe.split(',').map((bang: string, idx: number) => (<span key={idx} className="px-2.5 py-1 bg-blue-100 text-[#00539c] font-black rounded-md text-xs border border-blue-200">Hạng {bang.trim()}</span>))}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {CERTIFICATES.filter(cert => viewData[cert.id]).length > 0 ? (CERTIFICATES.filter(cert => viewData[cert.id]).map(cert => { const Icon = cert.icon; return (<div key={cert.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-bold shadow-sm"><Icon size={16} /> {cert.label}</div>) })) : (<p className="text-sm text-gray-400 italic">Chưa cập nhật chứng chỉ khác.</p>)}
                  </div>
                </div>
              </div>

              {/* 🟢 KHỐI HIỂN THỊ ATVSLĐ */}
              {viewData.cc_atvsld && (
                <div className="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm w-full flex flex-col gap-3">
                  <h5 className="font-bold text-emerald-800 text-sm border-b border-emerald-100 pb-2 flex items-center gap-2">
                    <ShieldCheck size={18} /> Thông tin An toàn Vệ sinh Lao động (ATVSLĐ)
                  </h5>
                  <div className="flex flex-col gap-2 text-sm text-gray-700">
                    <p>
                      <span className="text-gray-500 w-36 inline-block font-medium">Loại chứng nhận:</span>
                      <span className="font-bold text-gray-900">{viewData.chung_nhan || '---'}</span>
                      {viewData.nhom_doi_tuong && <span className="text-[#00539c] font-bold ml-1.5">({String(viewData.nhom_doi_tuong).includes('Nhóm') ? viewData.nhom_doi_tuong : `Nhóm ${viewData.nhom_doi_tuong}`})</span>}
                    </p>
                    <p>
                      <span className="text-gray-500 w-36 inline-block font-medium">Khóa huấn luyện:</span>
                      <span className="font-bold text-gray-900">
                        Từ ngày {viewData.huan_luyen_tu ? new Date(viewData.huan_luyen_tu).toLocaleDateString('vi-VN') : '...'} đến ngày {viewData.huan_luyen_den ? new Date(viewData.huan_luyen_den).toLocaleDateString('vi-VN') : '...'}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500 w-36 inline-block font-medium">Giá trị đến:</span>
                      <span className="font-black text-emerald-700 text-base">
                        {viewData.gia_tri_den
                          ? new Date(viewData.gia_tri_den).toLocaleDateString('vi-VN')
                          : viewData.huan_luyen_den
                            ? (() => {
                              const calculated = calcGiaTriDen(viewData.huan_luyen_den, viewData.nhom_doi_tuong || '', chuKyList);
                              return calculated ? new Date(calculated).toLocaleDateString('vi-VN') + " (Tự tính tạm)" : '...';
                            })()
                            : '...'
                        }
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* 🟢 KHỐI TRA CỨU LỊCH SỬ KSK & BNN CÁ NHÂN (NẰM PHÍA TRÊN GHI CHÚ KHÁC) */}
              <div className="mt-2 p-4 bg-lime-50/50 rounded-xl border border-lime-200 shadow-2xs w-full flex flex-col gap-3">
                <h5 className="font-bold text-lime-900 text-sm border-b border-lime-200/80 pb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-lime-600" /> Lịch Sử Khám Sức Khỏe & BNN Qua Các Năm ({kskHistoryView.length})
                </h5>

                {loadingKskHistoryView ? (
                  <div className="text-center py-3 text-xs text-gray-500">Đang tải lịch sử KSK...</div>
                ) : kskHistoryView.length === 0 ? (
                  <div className="text-center py-3 text-xs text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                    Chưa ghi nhận lịch sử KSK/BNN nào cho nhân sự này trong hệ thống.
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-lg border border-lime-100 shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-lime-900 text-white font-semibold text-[11px]">
                          <th className="p-2 border-b border-lime-800 text-center">Năm</th>
                          <th className="p-2 border-b border-lime-800">Gói Khám</th>
                          <th className="p-2 border-b border-lime-800 text-center">Phân Loại SK</th>
                          <th className="p-2 border-b border-lime-800">Kết Luận BNN</th>
                          <th className="p-2 border-b border-lime-800">Ghi Chú Y Tế</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {kskHistoryView.map((kItem, idx) => (
                          <tr key={kItem.id || idx} className="hover:bg-lime-50/30">
                            <td className="p-2 text-center font-bold text-gray-800">{kItem.nam_kham}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded bg-lime-100 text-lime-900 font-semibold text-[11px]">
                                {kItem.ma_goi_kham || 'GK 1'}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${kItem.loai_suc_khoe?.includes('I') && !kItem.loai_suc_khoe?.includes('IV') && !kItem.loai_suc_khoe?.includes('V') ? 'bg-emerald-100 text-emerald-800' :
                                kItem.loai_suc_khoe?.includes('II') ? 'bg-emerald-50 text-emerald-700' :
                                  kItem.loai_suc_khoe?.includes('III') ? 'bg-amber-50 text-amber-800' :
                                    'bg-rose-100 text-rose-800'
                                }`}>
                                {kItem.loai_suc_khoe || 'Loại I'}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`font-semibold ${kItem.ket_luan_bnn?.includes('Mắc') ? 'text-red-600' : kItem.ket_luan_bnn?.includes('Nguy cơ') ? 'text-amber-600' : 'text-gray-700'}`}>
                                {kItem.ket_luan_bnn || 'Bình thường'}
                              </span>
                            </td>
                            <td className="p-2 text-gray-600">{kItem.ghi_chu_suc_khoe || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 🟢 HÀNG GHI CHÚ (Chuyển xuống dưới cùng) */}
              <div className="mt-2">
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><Info size={18} className="text-blue-500" /> Ghi chú khác</h4>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100"><p className="text-sm font-semibold text-gray-700 whitespace-pre-wrap">{viewData.ghi_chu || 'Không có ghi chú.'}</p></div>
              </div>

            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 rounded-b-3xl sm:rounded-b-2xl flex justify-end shrink-0">
              <button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 MODAL THÊM MỚI / CHỈNH SỬA (Đã tách component) */}
      <PersonnelModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        formData={formData}
        submitting={submitting}
        donViList={donViList}
        phapNhanList={phapNhanList}
        chucDanhSuggestions={chucDanhSuggestions}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        onSave={handleSave}
        setFormData={(updater) => setModal(prev => ({ ...prev, formData: updater(prev.formData) }))}
        hideSensitiveFields={hasRule('NS_HIDE_SENSITIVE')}
      />

      {/* CÁC MODAL CÒN LẠI (REHIRE, DELETE, BULK IMPORT) GIỮ NGUYÊN */}
      {isRehireModalOpen && personnelToRehire && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-[#05469B] mb-4 flex items-center gap-2"><RotateCcw size={24} /> Vào làm lại</h3>
            <p className="text-sm text-gray-600 mb-6">Bạn đang thực hiện thủ tục cho nhân sự <span className="font-bold text-gray-800">{personnelToRehire.ho_ten}</span> quay trở lại làm việc.</p>
            <div className="mb-6"><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ngày vào làm lại chính thức</label><input type="date" value={rehireDate} onChange={(e) => setRehireDate(e.target.value)} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]" /></div>
            <div className="flex gap-3">
              <button onClick={() => setIsRehireModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
              <button onClick={handleConfirmRehire} disabled={submitting} className="flex-1 py-3 bg-[#05469B] hover:bg-[#04367a] transition-colors text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck size={20} />} Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xóa vĩnh viễn?</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa nhân sự này vĩnh viễn khỏi cơ sở dữ liệu. Không thể khôi phục.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
              <button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 MODAL CẢNH BÁO TRÙNG MSNV TÙY BIẾN */}
      {dupConfirmModal.isOpen && dupConfirmModal.dupInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-2xl w-full max-w-md animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-amber-100">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-800">Cảnh Báo Trùng MSNV</h3>
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Phát hiện mã số nhân viên đã tồn tại</p>
              </div>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 text-sm text-gray-700 space-y-2 mb-6">
              <p>Mã số nhân viên <span className="font-bold text-gray-900">"{dupConfirmModal.dupInfo.ma_so_nhan_vien}"</span> hiện đã được gán cho một nhân sự khác trong hệ thống:</p>
              <div className="pl-3 border-l-2 border-amber-400 space-y-1 text-xs">
                <p><span className="font-bold text-gray-400 mr-1.5">Họ và tên:</span> <span className="font-bold text-gray-900">{dupConfirmModal.dupInfo.ho_ten}</span></p>
                <p><span className="font-bold text-gray-400 mr-1.5">Đơn vị công tác:</span> <span className="font-bold text-gray-800">{dupConfirmModal.dupInfo.ten_don_vi}</span></p>
              </div>
              <p className="text-xs italic text-gray-500 pt-1">Nếu đây là vị trí kiêm nhiệm (làm song song 2 chức danh/đơn vị), anh/chị có thể tiếp tục tạo mới bản ghi này.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDupConfirmModal({ isOpen: false, dupInfo: null, onConfirm: () => { } })}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Hủy lưu
              </button>
              <button
                onClick={dupConfirmModal.onConfirm}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 transition-all text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <CheckCheck size={18} /> Đồng ý lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkImportOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-indigo-100 bg-indigo-50 rounded-t-2xl">
              <h3 className="text-xl font-black text-indigo-800 flex items-center gap-2"><ClipboardPaste size={24} /> Dán Dữ Liệu Hàng Loạt</h3>
              <button onClick={() => { setIsBulkImportOpen(false); setBulkImportData([]); setBulkImportText(''); setIgnoredUpdates(new Set()); }} className="text-indigo-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar bg-gray-55/30">

              {!reconciliationResult && (
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-800 font-bold">
                    <Info size={15} className="shrink-0 text-indigo-600" />
                    <span>Cấu trúc dán (Quét từ Cột 1 đến 31 theo bảng mẫu, có hay không có Tiêu đề đều được):</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-500 font-medium">1. Stt</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">2. Mã *</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">3. Họ tên *</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">4. Giới tính</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">5. Năm sinh</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">6. CCCD</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">7. Địa chỉ</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">8. SDT CN</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">9. SDT Cty</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">10. Email</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-500 font-medium">11. Đơn vị công tác</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-500 font-medium">12. Showroom</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">13. Đơn vị chi lương</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">14. Ngày nhận việc</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">15. Khối</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">16. Tổ chức</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">17. Ban/Phòng</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">18. Bộ phận</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">19. Chức danh *</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">20. Chức vụ *</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">21. Ngạch</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">22. Địa điểm làm việc</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-500 font-medium">23. Phía</span>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-300 text-indigo-900 font-bold shadow-xs">24. Nhóm ATVSLĐ (1, 2, 3, 4, 6)</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">25. Từ</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">26. Đến</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-gray-700 font-medium">27. Giá trị</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">28. Thẻ thang (True/False)</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">29. Thẻ xe (True/False)</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">30. Hãng-Loại xe</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-bold">31. BKS</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 gap-2">
                    <span className="text-emerald-600 font-black flex items-center gap-1">✓ Hệ thống tự động quét và gán vào các Showroom trực thuộc của: {selectedUnitName}</span>
                    <span className="text-gray-400 italic">Chú ý: Cột 12 (Showroom) trong file Excel cần khớp với tên Showroom/Đơn vị trên hệ thống để tự động gán.</span>
                  </div>
                </div>
              )}

              {!reconciliationResult ? (
                <div className="space-y-4">
                  <textarea
                    value={bulkImportText}
                    onChange={handlePasteBulkData}
                    disabled={isAnalyzingBulk}
                    placeholder="Ctrl+V bảng Excel vào đây..."
                    className="w-full h-44 p-4 text-sm border-2 border-dashed border-indigo-300 rounded-2xl outline-none focus:border-indigo-500 bg-white resize-none shadow-inner"
                  ></textarea>
                  {isAnalyzingBulk && (
                    <div className="text-center py-6 text-indigo-700 font-bold flex items-center justify-center gap-2 animate-pulse">
                      <Loader2 className="animate-spin" /> Đang tiến hành đối chiếu và kiểm tra dữ liệu biến động...
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div
                      onClick={() => { if (reconciliationResult.newItems.length > 0) setActiveReconcileTab('new'); }}
                      className={`p-4 rounded-2xl border transition-all shadow-sm ${reconciliationResult.newItems.length > 0 ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
                        } ${activeReconcileTab === 'new'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-400/20'
                          : 'bg-white border-gray-200 text-gray-500'
                        }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">🟢 Thêm mới</div>
                      <div className="text-3xl font-black mt-2 text-emerald-800">{reconciliationResult.newItems.length}</div>
                      <div className="text-[10px] opacity-75 mt-1">MSNV chưa có trên hệ thống</div>
                    </div>

                    <div
                      onClick={() => { if (reconciliationResult.updateItems.length > 0) setActiveReconcileTab('update'); }}
                      className={`p-4 rounded-2xl border transition-all shadow-sm ${reconciliationResult.updateItems.length > 0 ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
                        } ${activeReconcileTab === 'update'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-400/20'
                          : 'bg-white border-gray-200 text-gray-500'
                        }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1.5">🟡 Thay đổi</div>
                      <div className="text-3xl font-black mt-2 text-amber-800">
                        {reconciliationResult.updateItems.length - ignoredUpdates.size}/{reconciliationResult.updateItems.length}
                      </div>
                      <div className="text-[10px] opacity-75 mt-1">Cập nhật thông tin mới / Tổng số</div>
                    </div>

                    <div
                      onClick={() => { if (reconciliationResult.unchangedItems.length > 0) setActiveReconcileTab('unchanged'); }}
                      className={`p-4 rounded-2xl border transition-all shadow-sm ${reconciliationResult.unchangedItems.length > 0 ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
                        } ${activeReconcileTab === 'unchanged'
                          ? 'bg-slate-100 border-slate-300 text-slate-900 ring-2 ring-slate-400/20'
                          : 'bg-white border-gray-200 text-gray-500'
                        }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">⚪ Giữ nguyên</div>
                      <div className="text-3xl font-black mt-2 text-slate-800">{reconciliationResult.unchangedItems.length}</div>
                      <div className="text-[10px] opacity-75 mt-1">Dữ liệu khớp 100% (Sẽ bỏ qua)</div>
                    </div>

                    <div
                      onClick={() => { if (reconciliationResult.missingItems.length > 0) setActiveReconcileTab('missing'); }}
                      className={`p-4 rounded-2xl border transition-all shadow-sm ${reconciliationResult.missingItems.length > 0 ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
                        } ${activeReconcileTab === 'missing'
                          ? 'bg-red-50 border-red-300 text-red-900 ring-2 ring-red-400/20'
                          : 'bg-white border-gray-200 text-gray-500'
                        }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider text-red-600 flex items-center gap-1.5">🔴 Nhân sự dôi dư</div>
                      <div className="text-3xl font-black mt-2 text-red-800">
                        {pendingOffboards.size}/{reconciliationResult.missingItems.length}
                      </div>
                      <div className="text-[10px] opacity-75 mt-1">Điều chuyển / Nghỉ việc / Tổng số</div>
                    </div>
                  </div>

                  {/* Active Tab Reconciliation Details Table */}
                  {activeReconcileTab === 'new' && (
                    <div className="border border-emerald-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <div className="p-4 bg-emerald-50/50 border-b border-emerald-200 text-xs font-bold text-emerald-800 flex justify-between items-center">
                        <span>Nhân sự mới sẽ được tự động thêm vào đơn vị ({reconciliationResult.newItems.length} người)</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-gray-50 sticky top-0 font-bold border-b border-gray-200 z-10">
                            <tr>
                              <th className="p-3 border-r border-gray-200">Mã số nhân viên</th>
                              <th className="p-3 border-r border-gray-200">Họ và Tên</th>
                              <th className="p-3 border-r border-gray-200">Đơn vị phân bổ</th>
                              <th className="p-3 border-r border-gray-200">Khối</th>
                              <th className="p-3 border-r border-gray-200">Tổ chức</th>
                              <th className="p-3 border-r border-gray-200">Ban/Phòng</th>
                              <th className="p-3 border-r border-gray-200">Bộ phận</th>
                              <th className="p-3 border-r border-gray-200">Chức vụ</th>
                              <th className="p-3">Địa điểm làm việc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reconciliationResult.newItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-emerald-50/10 transition-colors">
                                <td className="p-3 font-bold text-emerald-700 border-r border-gray-200">{item.ma_so_nhan_vien}</td>
                                <td className="p-3 font-semibold text-gray-800 border-r border-gray-200">{item.ho_ten}</td>
                                <td className="p-3 font-medium text-blue-700 border-r border-gray-200">{donViMap[item.id_don_vi] || item.id_don_vi || '---'}</td>
                                <td className="p-3 text-gray-600 border-r border-gray-200">{item.khoi || '---'}</td>
                                <td className="p-3 text-gray-600 border-r border-gray-200">{item.to_chuc || '---'}</td>
                                <td className="p-3 text-gray-600 border-r border-gray-200">{item.phong_ban || '---'}</td>
                                <td className="p-3 text-gray-600 border-r border-gray-200">{item.bo_phan || '---'}</td>
                                <td className="p-3 text-gray-600 border-r border-gray-200">{item.chuc_vu || '---'}</td>
                                <td className="p-3 text-gray-500">{item.dia_diem_lam_viec || '---'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeReconcileTab === 'update' && (
                    <div className="border border-amber-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <div className="p-4 bg-amber-50/50 border-b border-amber-200 text-xs font-bold text-amber-800 flex justify-between items-center">
                        <span>Thông tin khác biệt phát hiện so với cơ sở dữ liệu ({reconciliationResult.updateItems.length} người)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIgnoredUpdates(new Set());
                              setIgnoredFields(new Set());
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 transition-colors font-bold cursor-pointer text-[10px]"
                          >
                            Chọn tất cả cập nhật 🔄
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allMsnvs = new Set(reconciliationResult.updateItems.map(g => g.existing.ma_so_nhan_vien));
                              setIgnoredUpdates(allMsnvs);
                              setIgnoredFields(new Set());
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors font-bold cursor-pointer text-[10px]"
                          >
                            Giữ nguyên toàn bộ cũ 🔒
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[500px] overflow-auto custom-scrollbar border-0">
                        <table className="w-full text-left text-xs border-collapse" style={{ minWidth: `${300 + allChangedFields.length * 200}px` }}>
                          <thead className="bg-gray-50 sticky top-0 font-bold border-b border-gray-200 z-20 shadow-2xs">
                            <tr>
                              <th className="p-3 w-[45px] text-center sticky left-0 bg-gray-50 z-30 border-r border-gray-200">STT</th>
                              <th className="p-3 w-[180px] sticky left-[45px] bg-gray-50 z-30 border-r border-gray-200">Nhân sự</th>
                              {allChangedFields.map(col => (
                                <th key={col.field} className="p-3 border-r border-gray-200 min-w-[200px] text-left">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isColumnChecked(col.field)}
                                      onChange={() => toggleColumnUpdate(col.field)}
                                      className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 cursor-pointer"
                                      title={`Chọn/Bỏ chọn cập nhật hàng loạt cho cột ${col.label}`}
                                    />
                                    <span className="font-bold text-gray-700">{col.label}</span>
                                  </div>
                                </th>
                              ))}
                              <th className="p-3 w-[100px] text-center min-w-[100px]">Cập nhật</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reconciliationResult.updateItems.map((group, idx) => {
                              const isIgnored = ignoredUpdates.has(group.existing.ma_so_nhan_vien);
                              const stickyBgClass = isIgnored
                                ? 'bg-gray-50 text-gray-400 opacity-60'
                                : 'bg-white text-gray-700 group-hover:bg-amber-50/10';

                              return (
                                <tr key={idx} className={`group transition-all duration-150 ${isIgnored ? 'bg-gray-50 opacity-60' : 'hover:bg-amber-50/5'}`}>
                                  {/* Cột STT Sticky */}
                                  <td className={`p-3 text-center sticky left-0 z-10 border-r border-gray-200 font-bold ${stickyBgClass}`}>
                                    {idx + 1}
                                  </td>

                                  {/* Cột Nhân sự Sticky */}
                                  <td className={`p-3 sticky left-[45px] z-10 border-r border-gray-200 ${stickyBgClass}`}>
                                    <div>
                                      <div className={`font-bold text-gray-800 ${isIgnored ? 'line-through text-gray-400' : ''}`}>{group.existing.ho_ten}</div>
                                      <div className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-block mt-1">
                                        {group.existing.ma_so_nhan_vien}
                                      </div>
                                      <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                                        ĐV hiện tại: <span className="font-semibold text-gray-700">{donViMap[group.existing.id_don_vi] || group.existing.id_don_vi || '---'}</span>
                                      </div>
                                      <div className="text-[10px] mt-1 font-semibold">
                                        {isIgnored ? (
                                          <span className="text-gray-500 flex items-center gap-1">🔒 Giữ nguyên cũ</span>
                                        ) : (
                                          <span className="text-amber-700 flex items-center gap-1">🔄 Sẽ cập nhật</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Các cột thay đổi động */}
                                  {allChangedFields.map(col => {
                                    const change = group.changes.find((c: any) => c.field === col.field);
                                    const isFieldIgnored = ignoredFields.has(`${group.existing.ma_so_nhan_vien}:${col.field}`);

                                    if (!change) {
                                      return (
                                        <td key={col.field} className="p-3 border-r border-gray-200 text-center text-gray-300 font-mono select-none">—</td>
                                      );
                                    }

                                    return (
                                      <td key={col.field} className="p-3 border-r border-gray-200">
                                        <label className={`flex items-center gap-2.5 cursor-pointer select-none ${isIgnored || isFieldIgnored ? 'line-through text-gray-400 opacity-60' : 'text-gray-700'}`}>
                                          <input
                                            type="checkbox"
                                            checked={!isIgnored && !isFieldIgnored}
                                            disabled={isIgnored}
                                            onChange={() => {
                                              setIgnoredFields(prev => {
                                                const next = new Set(prev);
                                                const key = `${group.existing.ma_so_nhan_vien}:${col.field}`;
                                                if (next.has(key)) {
                                                  next.delete(key);
                                                } else {
                                                  next.add(key);
                                                }
                                                return next;
                                              });
                                            }}
                                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 cursor-pointer disabled:opacity-50"
                                          />
                                          <div className="flex flex-col text-[10px] gap-1">
                                            <span className="text-red-600 line-through bg-red-50 px-1.5 py-0.5 rounded font-medium w-fit">{String(change.oldValue)}</span>
                                            <span className="text-gray-400 font-bold pl-2 select-none">↓</span>
                                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded w-fit">{String(change.newValue)}</span>
                                          </div>
                                        </label>
                                      </td>
                                    );
                                  })}

                                  {/* Cột Cập nhật dòng */}
                                  <td className="p-3 text-center align-middle">
                                    <input
                                      type="checkbox"
                                      checked={!isIgnored}
                                      onChange={() => {
                                        setIgnoredUpdates(prev => {
                                          const next = new Set(prev);
                                          const key = group.existing.ma_so_nhan_vien;
                                          if (next.has(key)) {
                                            next.delete(key);
                                          } else {
                                            next.add(key);
                                          }
                                          return next;
                                        });
                                      }}
                                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-gray-300 cursor-pointer"
                                      title={isIgnored ? "Cập nhật thông tin mới" : "Bỏ cập nhật (Giữ nguyên cũ)"}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeReconcileTab === 'unchanged' && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                        Thông tin trùng khớp hoàn toàn, hệ thống sẽ bỏ qua không ghi đè ({reconciliationResult.unchangedItems.length} người)
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-gray-50 sticky top-0 font-bold border-b border-gray-200 z-10">
                            <tr>
                              <th className="p-3 border-r border-gray-200">Mã số nhân viên</th>
                              <th className="p-3 border-r border-gray-200">Họ và Tên</th>
                              <th className="p-3 border-r border-gray-200">Chức danh</th>
                              <th className="p-3">Bộ phận</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-gray-400">
                            {reconciliationResult.unchangedItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 font-semibold border-r border-gray-200">{item.ma_so_nhan_vien}</td>
                                <td className="p-3 border-r border-gray-200">{item.ho_ten}</td>
                                <td className="p-3 border-r border-gray-200">{item.chuc_vu || '---'}</td>
                                <td className="p-3">{item.phong_ban || '---'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeReconcileTab === 'missing' && (
                    <div className="border border-red-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <div className="p-4 bg-red-50/50 border-b border-red-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <span className="text-xs font-bold text-red-800">
                          Phát hiện {reconciliationResult.missingItems.length} nhân viên có trên hệ thống của đơn vị nhưng KHÔNG có tên trong Excel mới dán
                        </span>
                        <span className="text-[11px] text-red-600 font-bold bg-white border border-red-200 px-3 py-1.5 rounded-xl shadow-xs">
                          Mặc định: Giữ nguyên hoạt động. Bỏ chọn "Giữ nguyên" để tiến hành Điều chuyển / Nghỉ việc.
                        </span>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-gray-50 sticky top-0 font-bold border-b border-gray-200 z-10">
                            <tr>
                              <th className="p-3 w-[15%] border-r border-gray-200">Mã số nhân viên</th>
                              <th className="p-3 w-[30%] border-r border-gray-200">Họ và Tên</th>
                              <th className="p-3 w-[20%] border-r border-gray-200">Chức danh</th>
                              <th className="p-3 w-[25%] border-r border-gray-200">Bộ phận hiện tại</th>
                              <th className="p-3 w-[10%] text-center">Giữ nguyên</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reconciliationResult.missingItems.map((item, idx) => {
                              const isOffboarded = pendingOffboards.has(item.ma_so_nhan_vien);
                              const offboardInfo = pendingOffboards.get(item.ma_so_nhan_vien);

                              let statusBadge = null;
                              if (isOffboarded && offboardInfo) {
                                if (offboardInfo.transferType === 'OFFBOARD') {
                                  statusBadge = (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                      ⛔ Nghỉ việc
                                    </span>
                                  );
                                } else if (offboardInfo.transferType === 'EXTERNAL') {
                                  statusBadge = (
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1" title={offboardInfo.transferExternalUnitName}>
                                      🏢 Chuyển ngoài
                                    </span>
                                  );
                                } else if (offboardInfo.transferType === 'INTERNAL') {
                                  const targetUnitName = donViMap[offboardInfo.transferInternalUnitId] || offboardInfo.transferInternalUnitId;
                                  statusBadge = (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1" title={`Chuyển đến: ${targetUnitName || 'Đơn vị mới'}`}>
                                      🔄 Chuyển nội bộ{targetUnitName ? `: ${targetUnitName}` : ''}
                                    </span>
                                  );
                                }
                              }

                              return (
                                <tr key={idx} className={`transition-all duration-150 ${isOffboarded ? 'bg-red-50/20 opacity-60' : 'hover:bg-red-50/10'}`}>
                                  <td className={`p-3 font-bold border-r border-gray-200 ${isOffboarded ? 'line-through text-gray-400' : 'text-red-700'}`}>{item.ma_so_nhan_vien}</td>
                                  <td className="p-3 border-r border-gray-200">
                                    <div className={`font-semibold text-gray-800 ${isOffboarded ? 'line-through text-gray-400' : ''}`}>{item.ho_ten}</div>
                                    {statusBadge && (
                                      <div
                                        onClick={() => handleOffboardClick(item)}
                                        className="mt-1 flex items-center cursor-pointer hover:opacity-80 w-fit"
                                        title="Click để điều chỉnh thông tin Điều chuyển / Nghỉ việc"
                                      >
                                        {statusBadge}
                                      </div>
                                    )}
                                  </td>
                                  <td className={`p-3 text-gray-600 border-r border-gray-200 ${isOffboarded ? 'line-through text-gray-400' : ''}`}>{item.chuc_vu || '---'}</td>
                                  <td className={`p-3 text-gray-600 border-r border-gray-200 ${isOffboarded ? 'line-through text-gray-400' : ''}`}>{item.phong_ban || '---'}</td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!isOffboarded}
                                      onChange={() => toggleMissingItemKeep(item)}
                                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                                      title={isOffboarded ? "Khôi phục trạng thái hoạt động" : "Bỏ giữ nguyên để thực hiện Điều chuyển / Nghỉ việc"}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t bg-gray-50 flex justify-between items-center">
              {reconciliationResult ? (
                <button
                  onClick={() => {
                    setBulkImportData([]);
                    setBulkImportText('');
                    setIgnoredUpdates(new Set());
                    setIgnoredFields(new Set());
                    setPendingOffboards(new Map());
                  }}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Quay lại dán Excel
                </button>
              ) : (
                <button
                  onClick={() => { setIsBulkImportOpen(false); setBulkImportData([]); setBulkImportText(''); setIgnoredUpdates(new Set()); setIgnoredFields(new Set()); setPendingOffboards(new Map()); }}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Hủy
                </button>
              )}

              <button
                onClick={confirmBulkSave}
                disabled={submitting || (reconciliationResult ? (
                  reconciliationResult.newItems.length === 0 &&
                  reconciliationResult.updateItems.length === 0 &&
                  pendingOffboards.size === 0
                ) : bulkImportData.length === 0)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-indigo-500/20"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck size={20} />}
                {reconciliationResult ? 'Xác nhận Lưu thay đổi' : 'Xác nhận Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {clickStaffListModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-[#e8f0fe] rounded-t-2xl">
              <h3 className="text-sm font-black text-[#05469B] flex items-center gap-2">
                <Users size={18} /> {clickStaffListModal.title} ({clickStaffListModal.list.length})
              </h3>
              <button
                onClick={() => setClickStaffListModal({ isOpen: false, title: '', list: [] })}
                className="text-gray-400 hover:text-red-500 rounded-full p-1 bg-white shadow-sm border border-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {/* Body */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white">
              <div className="space-y-2">
                {clickStaffListModal.list.map((p, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 hover:bg-blue-50/50 border border-gray-100 rounded-xl flex flex-col gap-1 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{p.ho_ten}</span>
                      <span className="text-[10px] text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded font-mono font-bold">
                        {p.ma_so_nhan_vien || '---'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-700">
                      <span className="font-semibold text-gray-400 mr-1">Chức vụ:</span>
                      <span className="font-medium text-gray-800">{p.chuc_vu || 'Chưa rõ'}</span>
                    </div>
                    <div className="text-xs text-gray-700 leading-normal">
                      <span className="font-semibold text-gray-400 mr-1">Đơn vị:</span>
                      <span className="font-medium text-gray-800">{getFullUnitName(p.id_don_vi)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setClickStaffListModal({ isOpen: false, title: '', list: [] })}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}