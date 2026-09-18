import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getDefaultUnitId } from '../utils/hierarchy';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save,
  FileText, Building2, MapPin, ChevronDown, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Link as LinkIcon, Calendar, CheckCircle2, Bookmark, Eye, Lock, Zap, Clock, Send,
  PenTool, Hash, Briefcase, Layers, ExternalLink, Filter, Copy, Megaphone, Inbox,
  RotateCcw
} from 'lucide-react';
import { apiService } from '../services/api';
import { DonVi, VB_TB, Personnel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import { toUnaccented, stripAccents } from '../utils/formatters';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import { searchGoogleDriveFile } from '../services/googleDrive';
import SegmentTabs from '../components/ui/SegmentTabs';

import {
  isMatDocument, isNewDocument, normalizeSignerName, isReplacedStatus, isExpiredOrReplaced, getNoiGuiNhanLabel
} from '../utils/documentHelpers';
import { AllDocTable } from '../components/document/AllDocTable';
import { ThongBaoTable } from '../components/document/ThongBaoTable';
import { QuyetDinhTable } from '../components/document/QuyetDinhTable';
import { CongVanDenTable } from '../components/document/CongVanDenTable';
import { CongVanDiTable } from '../components/document/CongVanDiTable';
import { ToTrinhTable } from '../components/document/ToTrinhTable';

// COMPONENT AUTOCOMPLETE TÙY CHỈNH
const CustomAutocomplete = ({ name, value, onChange, placeholder, suggestions, onRemove, className }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const lastQuery = useMemo(() => {
    if (!value) return '';
    const parts = value.split(';');
    return parts[parts.length - 1].trim();
  }, [value]);

  const filtered = suggestions.filter((s: string) => s.toLowerCase().includes(lastQuery.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={(e) => { onChange(e); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.map((item: string) => (
            <li
              key={item}
              className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center group text-sm text-gray-700 border-b border-gray-50 last:border-0"
              onClick={() => {
                let newValue = item;
                if (value && value.includes(';')) {
                  const parts = value.split(';');
                  parts[parts.length - 1] = ' ' + item;
                  newValue = parts.join(';');
                }
                onChange({ target: { name, value: newValue } });
                setIsOpen(false);
              }}
            >
              <span className="truncate pr-2">{item}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Xóa khỏi danh sách gợi ý"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// COMPONENT CHỌN VĂN BẢN THAY THẾ TÙY CHỈNH
const DocumentSelectAutocomplete = ({ value, onChange, documents, placeholder, currentDocId }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDocs = (documents || []).filter((doc: any) => {
    if (currentDocId && String(doc.id) === String(currentDocId)) return false;
    const docText = `${doc.so_hieu || ''} ${doc.tieu_de || ''}`.toLowerCase();
    return docText.includes(search.toLowerCase());
  });

  const selectedDoc = (documents || []).find((doc: any) => String(doc.id) === String(value));
  const displayText = selectedDoc ? `${selectedDoc.so_hieu} - ${selectedDoc.tieu_de}` : '';

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={isOpen ? search : displayText}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => { setIsOpen(true); setSearch(''); }}
        className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-gray-800 text-sm font-semibold"
        autoComplete="off"
      />
      {isOpen && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto custom-scrollbar">
          {filteredDocs.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-gray-400 italic">Không tìm thấy văn bản nào</li>
          ) : (
            filteredDocs.map((doc: any) => (
              <li
                key={doc.id}
                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer text-xs text-gray-700 border-b border-gray-50 last:border-0"
                onClick={() => {
                  onChange(doc.id);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <div className="font-bold text-[#05469B]">{doc.so_hieu}</div>
                <div className="text-gray-500 truncate text-[11px]">{doc.tieu_de}</div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

// 🟢 1. Hàm viết tắt tên đơn vị ban hành
const getUnitAbbreviation = (tenDonVi: string): string => {
  if (!tenDonVi) return '';
  let cleaned = tenDonVi.trim();
  // Loại bỏ các tiền tố thông dụng nếu có
  const prefixes = [
    /^(Cổ\s+phần\s+|Công\s+ty\s+cổ\s+phần\s+)/i,
    /^(TNHH\s+|Công\s+ty\s+TNHH\s+)/i,
    /^Chi\s+nhánh\s+/i,
    /^Showroom\s+/i,
    /^SR\s+/i,
    /^Văn\s+phòng\s+điều\s+hành\s+/i,
    /^Văn\s+phòng\s+/i,
    /^Điểm\s+bán\s+hàng\s+/i,
    /^Điểm\s+kinh\s+doanh\s+/i
  ];
  for (const p of prefixes) {
    cleaned = cleaned.replace(p, '');
  }
  // Loại bỏ hậu tố (HO), (P,BMW) v.v. nếu có
  cleaned = cleaned.replace(/\s*\(.*\)\s*$/, '');

  return cleaned.trim().toUpperCase() || tenDonVi.trim().toUpperCase();
};

// 🟢 2. Hàm viết tắt chức vụ người ký
const getJobTitleAbbr = (chucVu: string): string => {
  if (!chucVu) return 'TGĐ';
  const cvLower = chucVu.trim().toLowerCase();
  if (cvLower.includes('tổng giám đốc')) return 'TGĐ';
  if (cvLower.includes('phó tổng giám đốc')) return 'PTGĐ';
  if (cvLower.includes('giám đốc')) return 'GĐ';
  if (cvLower.includes('phó giám đốc')) return 'PGĐ';
  if (cvLower.includes('trưởng phòng')) return 'TP';
  if (cvLower.includes('phó phòng')) return 'PP';
  if (cvLower.includes('trưởng bộ phận')) return 'TBP';

  const words = cvLower.split(/\s+/);
  const abbr = words.map(w => toUnaccented(w).charAt(0).toUpperCase()).join('');
  return abbr || 'TGĐ';
};

// 🟢 3. Hàm lấy số thứ tự liên tiếp tiếp theo
const getNextConsecutiveNumber = (
  phanLoai: string,
  idDonVi: string,
  ngayBanHanh: string,
  documents: any[]
): string => {
  const year = ngayBanHanh ? new Date(ngayBanHanh).getFullYear() : new Date().getFullYear();

  const matchingDocs = documents.filter(doc => {
    const sameType = String(doc.phan_loai || '').trim().toLowerCase() === phanLoai.trim().toLowerCase();
    const sameUnit = String(doc.id_don_vi || '').trim() === idDonVi.trim();
    const docYear = doc.ngay_ban_hanh ? new Date(doc.ngay_ban_hanh).getFullYear() : null;
    const sameYear = docYear === year;
    return sameType && sameUnit && sameYear;
  });

  let maxNum = 0;
  matchingDocs.forEach(doc => {
    const soHieu = String(doc.so_hieu || '');
    const match = soHieu.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
};

// 🟢 4. Hàm sinh số hiệu tự động tổng hợp
const generateAutoSoHieu = (
  phanLoai: string,
  idDonVi: string,
  ngayBanHanh: string,
  chucVuNguoiKy: string,
  donViList: DonVi[],
  documents: any[]
): string => {
  if (!idDonVi) return '';

  const unit = donViList.find(d => String(d.id) === String(idDonVi));
  const unitAbbr = unit ? getUnitAbbreviation(unit.ten_don_vi) : '';
  const year = ngayBanHanh ? new Date(ngayBanHanh).getFullYear() : new Date().getFullYear();
  const nextNum = getNextConsecutiveNumber(phanLoai, idDonVi, ngayBanHanh, documents);
  const cleanChucVu = getJobTitleAbbr(chucVuNguoiKy);

  switch (phanLoai) {
    case 'Thông báo':
      return `${nextNum}/${year}/TB-${unitAbbr}`;
    case 'Thông báo BĐH':
      return `${nextNum}/${year}/TB-THACO INDUSTRIES&AUTO`;
    case 'Công văn đi':
      return `${nextNum}/${year}/CV-${unitAbbr}`;
    case 'Công văn đến':
      return unitAbbr ? `${nextNum}/${year}/CVĐ-${unitAbbr}` : `${nextNum}/${year}/CVĐ`;
    case 'Tờ trình':
      return `${nextNum}/${year}/TTr-${unitAbbr}`;
    case 'Quyết định':
      return `${nextNum}/${year}/QĐ-${cleanChucVu}/${unitAbbr}`;
    default:
      return `${nextNum}/${year}/${unitAbbr}`;
  }
};

export default function DocumentPage() {
  const { user } = useAuth();

  const isViewerHanChe = useMemo(() => {
    if (!user) return false;
    const roles = [
      String(user.quyen || ''),
      String((user as any).role || ''),
      String((user as any).quyen_truy_cap || ''),
      String((user as any).user_metadata?.quyen || ''),
      String((user as any).chuc_danh || '')
    ].map(s => s.trim().toLowerCase());
    return roles.some(r => r.includes('viewer_hanche'));
  }, [user]);

  const advancedRules = String((user as any)?.quyen_chi_tiet || '');

  const canViewType = useCallback((type: string) => {
    const rulesList = advancedRules.split(',').map(r => r.trim());
    const activeViewRules = rulesList.filter(r => [
      'VB_VIEW_QD', 'VB_VIEW_TB', 'VB_VIEW_TB_BDH', 'VB_VIEW_TT', 'VB_VIEW_CV_DI', 'VB_VIEW_CV_DEN'
    ].includes(r));
    
    // 1. Nếu có cấu hình các quyền xem chi tiết mới
    if (activeViewRules.length > 0) {
      switch (type) {
        case 'Quyết định': return activeViewRules.includes('VB_VIEW_QD');
        case 'Thông báo': return activeViewRules.includes('VB_VIEW_TB');
        case 'Thông báo BĐH': return activeViewRules.includes('VB_VIEW_TB_BDH');
        case 'Tờ trình': return activeViewRules.includes('VB_VIEW_TT');
        case 'Công văn đi': return activeViewRules.includes('VB_VIEW_CV_DI');
        case 'Công văn đến': return activeViewRules.includes('VB_VIEW_CV_DEN');
        default: return true;
      }
    }
    
    // 2. Tương thích ngược với các rule cũ (VB_ONLY_TB, VB_ONLY_QD)
    const hasOnlyTb = rulesList.includes('VB_ONLY_TB');
    const hasOnlyQd = rulesList.includes('VB_ONLY_QD');
    if (hasOnlyTb && !hasOnlyQd) {
      return type === 'Thông báo' || type === 'Thông báo BĐH';
    }
    if (hasOnlyQd && !hasOnlyTb) {
      return type === 'Quyết định';
    }
    if (hasOnlyTb && hasOnlyQd) {
      return type === 'Thông báo' || type === 'Thông báo BĐH' || type === 'Quyết định';
    }

    // 3. Quyền Viewer Hạn Chế mặc định
    if (isViewerHanChe) {
      return type === 'Quyết định' || type === 'Thông báo' || type === 'Thông báo BĐH';
    }
    
    return true;
  }, [advancedRules, isViewerHanChe]);

  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [vbData, setVbData] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanningDrive, setScanningDrive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(window.innerWidth < 768);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [selectedPhanLoai, setSelectedPhanLoai] = useState<string | null>('Thông báo');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedSigner, setSelectedSigner] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>('');
  const [selectedDateTo, setSelectedDateTo] = useState<string>('');
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState<boolean>(false);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [isAutoNumber, setIsAutoNumber] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [blacklist, setBlacklist] = useState<string[]>(() => {
    const saved = localStorage.getItem('doc_suggestions_blacklist');
    return saved ? JSON.parse(saved) : ['Phạm Đăng Châu', 'Đàm Đình Thông', 'Nguyễn Thiện Mỹ'];
  });

  const handleRemoveSuggestion = (item: string) => {
    if (window.confirm(`Bạn có chắc muốn ẩn "${item}" khỏi danh sách gợi ý vĩnh viễn?`)) {
      const next = [...blacklist, item];
      setBlacklist(next);
      localStorage.setItem('doc_suggestions_blacklist', JSON.stringify(next));
    }
  };

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, vbResult, nsResult] = await Promise.all([
        apiService.getDonVi(),
        apiService.getVanBan(),
        apiService.getPersonnel()
      ]);
      setDonViList(dvResult || []);
      setVbData(vbResult || []);
      setPersonnelList(nsResult || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu Văn bản.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (viewData) {
      apiService.writeLog(
        'XEM VĂN BẢN',
        `Loại: ${viewData.phan_loai || 'Không xác định'} | Số hiệu: ${viewData.so_hieu || 'Chưa có'} | Tiêu đề: ${viewData.tieu_de || ''}`
      );
    }
  }, [viewData]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsListCollapsed(false);
      } else {
        setIsListCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[String(dv.id)] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const isHOAdmin = useMemo(() => {
    if (!user) return false;
    const userQuyen = String(user.quyen || (user as any).role || '').trim().toLowerCase();
    const userIdDonVi = String(user.id_don_vi || (user as any).idDonVi || '').trim();
    if (userQuyen !== 'admin') return false;
    if (userIdDonVi === 'ALL' || userIdDonVi === 'HO' || userIdDonVi === 'DV_HO' || !userIdDonVi) return true;
    const uDonVi = donViList.find(dv => String(dv.id || '') === userIdDonVi);
    if (uDonVi) {
      const lh = String(uDonVi.loai_hinh || '').toLowerCase();
      const name = String(uDonVi.ten_don_vi || '').toLowerCase();
      const cap = String(uDonVi.cap_quan_ly || '').toUpperCase();
      if (cap === 'HO' || lh.includes('tổng công ty') || name.includes('toàn quốc')) {
        return true;
      }
    }
    return false;
  }, [user, donViList]);

  const canEditOrDeleteDocument = useCallback((item: any) => {
    if (!user || !item) return false;
    if (isViewerHanChe) return false;
    if (isHOAdmin) return true;

    // Nếu không phải HO Admin:
    // 1. Nếu văn bản ban hành Toàn hệ thống (*) hoặc ALL -> CHỈ XEM, không được sửa/xóa
    const scope = String(item.pham_vi_ap_dung || '').trim();
    if (scope === 'Toàn hệ thống' || scope === '*' || scope === 'ALL' || scope.toLowerCase() === 'toàn hệ thống') {
      return false;
    }

    // 2. Chỉ được sửa/xóa nếu văn bản thuộc Đơn vị của mình (hoặc cấp dưới trực thuộc của mình)
    const userIdDonVi = String(user.id_don_vi || (user as any).idDonVi || '').trim();
    if (!userIdDonVi) return false;

    const level1 = [userIdDonVi];
    const level2 = donViList.filter(dv => level1.includes(String(dv.cap_quan_ly || ''))).map(dv => String(dv.id || ''));
    const level3 = donViList.filter(dv => level2.includes(String(dv.cap_quan_ly || ''))).map(dv => String(dv.id || ''));
    const myUnits = [...level1, ...level2, ...level3];

    return myUnits.includes(String(item.id_don_vi || '').trim());
  }, [user, isViewerHanChe, isHOAdmin, donViList]);

  const visibleDocuments = useMemo(() => {
    if (!user) return [];
    if (isHOAdmin) return vbData;

    const userIdDonVi = String(user.id_don_vi || (user as any).idDonVi || '').trim();
    if (!userIdDonVi || userIdDonVi === 'ALL') return vbData;

    const level1 = [userIdDonVi];
    const level2 = donViList.filter(dv => level1.includes(String(dv.cap_quan_ly || ''))).map(dv => String(dv.id || ''));
    const level3 = donViList.filter(dv => level2.includes(String(dv.cap_quan_ly || ''))).map(dv => String(dv.id || ''));
    const myUnits = [...level1, ...level2, ...level3];

    return vbData.filter(vb => {
      if (!vb) return false;
      const scope = String(vb.pham_vi_ap_dung || '').trim();
      const vbDonVi = String(vb.id_don_vi || '').trim();
      return myUnits.includes(vbDonVi) ||
        myUnits.includes(scope) ||
        scope === 'Toàn hệ thống' ||
        scope === '*' ||
        scope === 'ALL' ||
        scope.toLowerCase() === 'toàn hệ thống';
    });
  }, [vbData, user, donViList, isHOAdmin]);

  const { suggestNguoiky, suggestChucvu, suggestNguoilayso, suggestBPlayso, suggestNghiepvu, suggestDonViXuLy } = useMemo(() => {
    const getUnique = (field: string) => {
      if (field === 'nghiep_vu') {
        const list: string[] = [];
        vbData.forEach(item => {
          const val = item[field];
          if (val) {
            val.split(';').forEach((p: string) => {
              const trimmed = p.trim();
              if (trimmed && !blacklist.includes(trimmed)) {
                list.push(trimmed);
              }
            });
          }
        });
        return Array.from(new Set(list));
      }
      const allValues = vbData.map(item => item[field]).filter(Boolean);
      const uniqueValues = Array.from(new Set(allValues)) as string[];
      return uniqueValues.filter(val => !blacklist.includes(val.trim()));
    };

    return {
      suggestNguoiky: getUnique('nguoi_ky'),
      suggestChucvu: getUnique('chuc_vu'),
      suggestNguoilayso: getUnique('nguoi_lay_so'),
      suggestBPlayso: getUnique('bo_phan_lay_so'),
      suggestNghiepvu: getUnique('nghiep_vu'),
      suggestDonViXuLy: getUnique('bo_phan_xu_ly')
    };
  }, [vbData, blacklist]);

  const suggestMsnv = useMemo(() => {
    return Array.from(new Set(personnelList.map(p => p.ma_so_nhan_vien).filter(Boolean)));
  }, [personnelList]);

  const suggestHoTen = useMemo(() => {
    return Array.from(new Set(personnelList.map(p => p.ho_ten).filter(Boolean)));
  }, [personnelList]);

  const allowedDonViIds = useAllowedUnits(donViList);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (donViList && donViList.length > 0 && !hasInitializedRef.current) {
      const defId = getDefaultUnitId(user, donViList);
      if (defId && allowedDonViIds.includes(defId)) {
        setSelectedUnitFilter(defId);
      } else if (allowedDonViIds.length > 0) {
        setSelectedUnitFilter(allowedDonViIds[0]);
      }
      hasInitializedRef.current = true;
    }
  }, [donViList, user, allowedDonViIds]);

  // 🟢 Effect tự động tính toán số hiệu văn bản khi bật chế độ số tự động
  useEffect(() => {
    if (isAutoNumber) {
      const autoNum = generateAutoSoHieu(
        formData.phan_loai || 'Thông báo',
        formData.id_don_vi || '',
        formData.ngay_ban_hanh || '',
        formData.chuc_vu || '',
        donViList,
        vbData
      );
      setFormData((prev: any) => {
        if (prev.so_hieu !== autoNum) {
          return { ...prev, so_hieu: autoNum };
        }
        return prev;
      });
    }
  }, [isAutoNumber, formData.id_don_vi, formData.phan_loai, formData.ngay_ban_hanh, formData.chuc_vu, donViList, vbData]);

  const filteredUnits = useMemo(() => {
    const list = donViList || [];
    let baseUnits = list.filter(dv => allowedDonViIds.includes(String(dv.id || '')));
    if (!unitSearchTerm) return baseUnits;

    const lower = unitSearchTerm.toLowerCase();
    const matchedIds = new Set<string>();

    baseUnits.forEach(u => {
      const uId = String(u.id || '');
      if (String(u.ten_don_vi || '').toLowerCase().includes(lower) || uId.toLowerCase().includes(lower)) {
        matchedIds.add(uId);

        let parentId = String(u.cap_quan_ly || '').trim();
        const visitedParents = new Set<string>([uId]);
        while (parentId && parentId !== 'HO' && !visitedParents.has(parentId)) {
          visitedParents.add(parentId);
          matchedIds.add(parentId);
          const parentUnit = baseUnits.find(p => String(p.id || '') === parentId);
          parentId = parentUnit ? String(parentUnit.cap_quan_ly || '').trim() : '';
        }
      }
    });

    const addChildren = (parentId: string, visited = new Set<string>()) => {
      if (visited.has(parentId)) return;
      visited.add(parentId);
      baseUnits.forEach(u => {
        const uId = String(u.id || '');
        if (String(u.cap_quan_ly || '') === parentId && !matchedIds.has(uId) && !visited.has(uId)) {
          matchedIds.add(uId);
          addChildren(uId, visited);
        }
      });
    };

    const initialMatches = Array.from(matchedIds);
    initialMatches.forEach(id => addChildren(id));

    return baseUnits.filter(item => matchedIds.has(String(item.id || '')));
  }, [donViList, unitSearchTerm, allowedDonViIds]);

  const parentUnits = useMemo(() => {
    const unitIds = new Set((filteredUnits || []).map(item => String(item.id || '')));
    return sortDonViByThuTu((filteredUnits || []).filter(item => {
      const cap = String(item.cap_quan_ly || '').trim();
      return !cap || cap === 'HO' || !unitIds.has(cap);
    }));
  }, [filteredUnits]);

  const getChildUnits = (parentId: string) => sortDonViByThuTu((filteredUnits || []).filter(item => String(item.cap_quan_ly || '') === String(parentId || '') && String(item.id) !== String(parentId || '')));
  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => groupParentUnits(parentUnits || []), [parentUnits]);

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]);
  };

  const availableYears = useMemo(() => {
    let docs = visibleDocuments;
    if (selectedPhanLoai) {
      docs = docs.filter(item => item.phan_loai === selectedPhanLoai);
    }
    const years = new Set(
      docs.map(item => {
        if (!item.ngay_ban_hanh) return null;
        return new Date(item.ngay_ban_hanh).getFullYear().toString();
      }).filter(Boolean) as string[]
    );
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [visibleDocuments, selectedPhanLoai]);

  const availableSigners = useMemo(() => {
    let docs = visibleDocuments;
    if (selectedPhanLoai) {
      docs = docs.filter(item => item.phan_loai === selectedPhanLoai);
    }
    const signers = new Set<string>(
      docs.map(item => item.nguoi_ky ? normalizeSignerName(item.nguoi_ky) : '').filter(Boolean)
    );
    return Array.from(signers).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [visibleDocuments, selectedPhanLoai]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedYear !== 'all') count++;
    if (selectedSigner !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedDateFrom) count++;
    if (selectedDateTo) count++;
    return count;
  }, [selectedYear, selectedSigner, selectedStatus, selectedDateFrom, selectedDateTo]);

  const filteredDocsWithoutPhanLoai = useMemo(() => {
    let result = [...visibleDocuments];

    result = result.filter(item => canViewType(item.phan_loai));

    // Giới hạn theo Năm nếu được cấu hình trong Ma trận Quyền
    const vbYearsRule = advancedRules.split(',').map(r => r.trim()).find(r => r.startsWith('VB_YEARS:'));
    if (vbYearsRule) {
      const allowedYears = vbYearsRule.substring('VB_YEARS:'.length).split('|').filter(Boolean);
      if (allowedYears.length > 0) {
        result = result.filter(item => {
          if (!item.ngay_ban_hanh) return false;
          const year = item.ngay_ban_hanh.substring(0, 4);
          return allowedYears.includes(year);
        });
      }
    }

    if (selectedUnitFilter) result = result.filter(item => String(item.id_don_vi) === String(selectedUnitFilter) || String(item.pham_vi_ap_dung) === String(selectedUnitFilter));
    if (selectedYear !== 'all') {
      result = result.filter(item => item.ngay_ban_hanh && item.ngay_ban_hanh.substring(0, 4) === selectedYear);
    }
    if (selectedSigner !== 'all') {
      result = result.filter(item => item.nguoi_ky && normalizeSignerName(item.nguoi_ky) === selectedSigner);
    }
    if (selectedStatus !== 'all') {
      if (isReplacedStatus(selectedStatus)) {
        result = result.filter(item => isReplacedStatus(item.hieu_luc));
      } else {
        result = result.filter(item => item.hieu_luc === selectedStatus);
      }
    }
    if (selectedDateFrom) {
      result = result.filter(item => item.ngay_ban_hanh && item.ngay_ban_hanh >= selectedDateFrom);
    }
    if (selectedDateTo) {
      result = result.filter(item => item.ngay_ban_hanh && item.ngay_ban_hanh <= selectedDateTo);
    }
    if (searchTerm) {
      const cleanSearch = stripAccents(searchTerm);
      result = result.filter(item =>
        stripAccents(item.so_hieu || '').includes(cleanSearch) ||
        stripAccents(item.tieu_de || '').includes(cleanSearch) ||
        stripAccents(item.nghiep_vu || '').includes(cleanSearch)
      );
    }

    result.sort((a, b) => {
      const dateA = a.ngay_ban_hanh ? new Date(a.ngay_ban_hanh).getTime() : 0;
      const dateB = b.ngay_ban_hanh ? new Date(b.ngay_ban_hanh).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;

      const numA = parseInt(String(a.so_hieu || '').match(/^\d+/)?.[0] || '0', 10);
      const numB = parseInt(String(b.so_hieu || '').match(/^\d+/)?.[0] || '0', 10);
      return numB - numA;
    });

    return result;
  }, [
    visibleDocuments, searchTerm, selectedUnitFilter, selectedYear,
    selectedSigner, selectedStatus, selectedDateFrom, selectedDateTo, isViewerHanChe, advancedRules
  ]);

  const tabCounts = useMemo(() => {
    const counts = {
      all: filteredDocsWithoutPhanLoai.length,
      thongBao: 0,
      thongBaoBdh: 0,
      quyetDinh: 0,
      cvDen: 0,
      cvDi: 0,
      toTrinh: 0
    };
    filteredDocsWithoutPhanLoai.forEach(doc => {
      const type = String(doc.phan_loai || '').trim();
      if (type === 'Thông báo') counts.thongBao++;
      else if (type === 'Thông báo BĐH') counts.thongBaoBdh++;
      else if (type === 'Quyết định') counts.quyetDinh++;
      else if (type === 'Công văn đến') counts.cvDen++;
      else if (type === 'Công văn đi') counts.cvDi++;
      else if (type === 'Tờ trình') counts.toTrinh++;
    });
    return counts;
  }, [filteredDocsWithoutPhanLoai]);

  const filteredDocs = useMemo(() => {
    if (!selectedPhanLoai) return filteredDocsWithoutPhanLoai;
    return filteredDocsWithoutPhanLoai.filter(item => item.phan_loai === selectedPhanLoai);
  }, [filteredDocsWithoutPhanLoai, selectedPhanLoai]);

  const docTabs = useMemo(() => {
    const list: { id: string; label: string; count: number; icon: React.ReactNode }[] = [
      { id: 'all', label: 'Tất cả', count: tabCounts.all, icon: <Layers size={16} /> }
    ];

    if (canViewType('Quyết định')) {
      list.push({ id: 'Quyết định', label: 'Quyết định', count: tabCounts.quyetDinh, icon: <FileText size={16} /> });
    }
    if (canViewType('Thông báo')) {
      list.push({ id: 'Thông báo', label: 'Thông báo', count: tabCounts.thongBao, icon: <Megaphone size={16} /> });
    }
    if (canViewType('Thông báo BĐH')) {
      list.push({ id: 'Thông báo BĐH', label: 'Ban điều hành TB', count: tabCounts.thongBaoBdh, icon: <Briefcase size={16} /> });
    }
    if (canViewType('Tờ trình')) {
      list.push({ id: 'Tờ trình', label: 'Tờ trình', count: tabCounts.toTrinh, icon: <Bookmark size={16} /> });
    }
    if (canViewType('Công văn đi')) {
      list.push({ id: 'Công văn đi', label: 'Công văn đi', count: tabCounts.cvDi, icon: <Send size={16} /> });
    }
    if (canViewType('Công văn đến')) {
      list.push({ id: 'Công văn đến', label: 'Công văn đến', count: tabCounts.cvDen, icon: <Inbox size={16} /> });
    }

    return list;
  }, [tabCounts, canViewType]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Toàn hệ thống';
    const unit = donViList.find(d => String(d.id) === String(selectedUnitFilter));
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViList]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | string>(100);

  const actualRowsPerPage = typeof rowsPerPage === 'number' && rowsPerPage > 0 ? rowsPerPage : 100;
  const totalPages = Math.ceil(filteredDocs.length / actualRowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedUnitFilter, selectedPhanLoai, selectedYear, searchTerm,
    selectedSigner, selectedStatus, selectedDateFrom, selectedDateTo
  ]);

  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * actualRowsPerPage;
    return filteredDocs.slice(startIndex, startIndex + actualRowsPerPage);
  }, [filteredDocs, currentPage, actualRowsPerPage]);

  const openModal = (mode: 'create' | 'update', item?: any) => {
    if (mode === 'update' && item && !canEditOrDeleteDocument(item)) {
      toast.warning("Bạn chỉ có quyền xem văn bản này, không có quyền chỉnh sửa!");
      return;
    }
    setModalMode(mode);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;

    if (item) {
      let foundReplacedId = '';
      if (item.van_ban_thay_the || item.vb_thay_the) {
        const refStr = String(item.van_ban_thay_the || item.vb_thay_the).trim();
        const matched = vbData.find(doc =>
          String(doc.id) === refStr ||
          String(doc.so_hieu).trim() === refStr ||
          (doc.link_vb && String(doc.link_vb).trim() === refStr)
        );
        if (matched) foundReplacedId = matched.id;
      }

      setFormData({
        ...item,
        ngay_ban_hanh: item.ngay_ban_hanh ? item.ngay_ban_hanh.split('T')[0] : '',
        ngay_nhan: item.ngay_nhan ? item.ngay_nhan.split('T')[0] : '',
        han_xu_ly: item.han_xu_ly ? item.han_xu_ly.split('T')[0] : '',
        mat: isMatDocument(item.mat),
        msnv_nguoi_lay_so: item.msnv_nguoi_lay_so || item.msnv_lay_so || '',
        replaced_doc_id: foundReplacedId,
        initial_replaced_doc_id: foundReplacedId,
        is_replacing: !!foundReplacedId
      });
      setIsAutoNumber(false);
    } else {
      setFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''),
        phan_loai: (selectedPhanLoai && selectedPhanLoai !== 'all') ? selectedPhanLoai : 'Thông báo', muc_do_khan: 'Bình thường', so_hieu: '', ngay_ban_hanh: new Date().toISOString().split('T')[0],
        tieu_de: '', noi_dung: '', link_vb: '', noi_goi_nhan: '', so_den: '', ngay_nhan: '',
        bo_phan_xu_ly: '', han_xu_ly: '', trang_thai_xu_ly: 'Chờ xử lý',
        nguoi_ky: '', chuc_vu: '', nguoi_lay_so: '', bo_phan_lay_so: '', pham_vi_ap_dung: selectedUnitFilter || 'Toàn hệ thống',
        hieu_luc: 'Còn hiệu lực', nghiep_vu: '', van_ban_thay_the: '', mat: false,
        msnv_nguoi_lay_so: '', replaced_doc_id: '', initial_replaced_doc_id: '', is_replacing: false
      });
      setIsAutoNumber(false);
    }
    setIsModalOpen(true); setError(null);
  };

  const handleCopyFeedback = () => {
    if (!viewData) return;

    let phanLoaiAbbr = viewData.phan_loai || '';
    if (phanLoaiAbbr === 'Thông báo') phanLoaiAbbr = 'TB';
    else if (phanLoaiAbbr === 'Thông báo BĐH') phanLoaiAbbr = 'TB-BĐH';
    else if (phanLoaiAbbr === 'Quyết định') phanLoaiAbbr = 'QĐ';
    else if (phanLoaiAbbr === 'Tờ trình') phanLoaiAbbr = 'TTr';
    else if (phanLoaiAbbr === 'Công văn đi') phanLoaiAbbr = 'CV';
    else if (phanLoaiAbbr === 'Công văn đến') phanLoaiAbbr = 'CVĐ';

    const ngayFormat = viewData.ngay_ban_hanh ? new Date(viewData.ngay_ban_hanh).toLocaleDateString('vi-VN') : '';

    const text =
      `- Số hiệu: ${viewData.so_hieu || ''}
- Nội dung ${phanLoaiAbbr}: ${viewData.tieu_de || ''}
- Ngày ban hành: ${ngayFormat}
- Phê duyệt: ${viewData.nguoi_ky || ''}
- Nhân sự - Bộ phận trình: ${viewData.nguoi_lay_so || ''} - ${viewData.bo_phan_lay_so || ''}
Anh/chị vui lòng gửi file scan đầy đủ chữ ký và mộc để phục vụ lưu trữ. Xin cảm ơn!`;

    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success('Đã copy thông tin phản hồi!');
      })
      .catch((err) => {
        console.error('Lỗi khi copy:', err);
        toast.error('Không thể tự động copy, vui lòng thử lại.');
      });
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị ban hành/lưu trữ!");
    if (isReplacedStatus(formData.hieu_luc) && !formData.van_ban_thay_the) return toast.warning("Vui lòng dán Link hoặc nhập thông tin Văn bản mới thay thế!");

    let finalData = { ...formData };

    if (finalData.phan_loai !== 'Công văn đến') {
      finalData.so_den = null;
      finalData.ngay_nhan = null;
    }
    if (finalData.phan_loai !== 'Công văn đến' && finalData.phan_loai !== 'Tờ trình') {
      finalData.bo_phan_xu_ly = null;
      finalData.han_xu_ly = null;
      finalData.trang_thai_xu_ly = null;
    }

    // Trích xuất replaced_doc_id, initial_replaced_doc_id và xóa khỏi payload gửi lên database
    const isReplacing = finalData.is_replacing;
    const replacedDocId = isReplacing ? finalData.replaced_doc_id : '';
    const initialReplacedDocId = finalData.initial_replaced_doc_id || '';
    delete finalData.replaced_doc_id;
    delete finalData.initial_replaced_doc_id;
    delete finalData.is_replacing;

    if (replacedDocId) {
      const replacedDoc = vbData.find(d => String(d.id) === String(replacedDocId));
      if (replacedDoc) {
        finalData.van_ban_thay_the = replacedDoc.so_hieu;
      }
    } else {
      finalData.van_ban_thay_the = null;
    }

    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    finalData.mat = !!finalData.mat;

    if (modalMode === 'create' && !finalData.id) {
      finalData.id = `VB-${Date.now()}`;
    }

    setSubmitting(true); setError(null);
    try {
      const response = await apiService.save(finalData, modalMode, "vb_tb");

      if (modalMode === 'create') {
        finalData.id = response.id || response.newId || finalData.id;
        setVbData(prev => [finalData, ...prev]);
      } else {
        setVbData(prev => prev.map(item => String(item.id) === String(finalData.id) ? finalData : item));
      }

      // 1. Khôi phục văn bản cũ nếu người dùng thay đổi hoặc hủy liên kết thay thế
      if (initialReplacedDocId && initialReplacedDocId !== replacedDocId) {
        const oldLinkedDoc = vbData.find(d => String(d.id) === String(initialReplacedDocId));
        if (oldLinkedDoc) {
          const restoredDoc = {
            ...oldLinkedDoc,
            hieu_luc: 'Còn hiệu lực', // Khôi phục trạng thái hiệu lực
            van_ban_thay_the: null     // Xóa liên kết
          };
          await apiService.save(restoredDoc, 'update', "vb_tb");
          setVbData(prev => prev.map(item => String(item.id) === String(oldLinkedDoc.id) ? restoredDoc : item));
        }
      }

      // 2. Tự động cập nhật trạng thái văn bản cũ mới bị thay thế sang Hết hiệu lực
      if (replacedDocId && replacedDocId !== initialReplacedDocId) {
        const replacedDoc = vbData.find(d => String(d.id) === String(replacedDocId));
        if (replacedDoc) {
          const newDocRef = finalData.link_vb || finalData.so_hieu;
          const updatedReplaced = {
            ...replacedDoc,
            hieu_luc: 'Hết hiệu lực', // Theo yêu cầu của user
            van_ban_thay_the: newDocRef
          };
          await apiService.save(updatedReplaced, 'update', "vb_tb");
          setVbData(prev => prev.map(item => String(item.id) === String(replacedDoc.id) ? updatedReplaced : item));
        }
      }

      setIsModalOpen(false);

      if (modalMode === 'create') {
        toast.success("Ban hành văn bản thành công!");
      } else {
        toast.success("Cập nhật văn bản thành công!");
      }

    } catch (err: any) {
      setError(err.message || 'Lỗi lưu dữ liệu Văn bản.');
      toast.error(err.message || "Đã xảy ra lỗi khi lưu văn bản!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoScanDrive = async () => {
    const { phan_loai, ngay_ban_hanh, so_hieu } = formData;
    if (!phan_loai) {
      toast.error("Vui lòng chọn Loại văn bản trước!");
      return;
    }
    if (!ngay_ban_hanh) {
      toast.error("Vui lòng chọn Ngày ban hành trước!");
      return;
    }
    if (!so_hieu) {
      toast.error("Vui lòng nhập Số hiệu trước!");
      return;
    }

    const year = ngay_ban_hanh.substring(0, 4);
    setScanningDrive(true);
    try {
      const link = await searchGoogleDriveFile(year, phan_loai, so_hieu);
      if (link) {
        setFormData((prev: any) => ({ ...prev, link_vb: link }));
        toast.success("Đã tìm thấy và điền link file từ Drive thành công!");
      } else {
        toast.error("Không tìm thấy tệp tin phù hợp trên Drive. Vui lòng dán liên kết thủ công!");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi quét liên kết Google Drive!");
    } finally {
      setScanningDrive(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'hieu_luc' && !isReplacedStatus(value)) {
      setFormData((prev: any) => ({ ...prev, [name]: value, van_ban_thay_the: '' }));
    } else if (name === 'msnv_nguoi_lay_so') {
      const cleanVal = String(value || '').trim().toLowerCase();
      const matchedPerson = personnelList.find(
        (p) => String(p.ma_so_nhan_vien || '').trim().toLowerCase() === cleanVal
      );
      if (matchedPerson) {
        setFormData((prev: any) => ({
          ...prev,
          msnv_nguoi_lay_so: value,
          nguoi_lay_so: matchedPerson.ho_ten || '',
          bo_phan_lay_so: matchedPerson.phong_ban || '',
        }));
      } else {
        setFormData((prev: any) => ({ ...prev, msnv_nguoi_lay_so: value }));
      }
    } else if (name === 'nguoi_lay_so') {
      const cleanVal = String(value || '').trim().toLowerCase();
      const matchedPerson = personnelList.find(
        (p) => String(p.ho_ten || '').trim().toLowerCase() === cleanVal
      );
      if (matchedPerson) {
        setFormData((prev: any) => ({
          ...prev,
          nguoi_lay_so: value,
          msnv_nguoi_lay_so: matchedPerson.ma_so_nhan_vien || '',
          bo_phan_lay_so: matchedPerson.phong_ban || '',
        }));
      } else {
        setFormData((prev: any) => ({ ...prev, nguoi_lay_so: value }));
      }
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  // HÀM CẬP NHẬT NHANH TRẠNG THÁI HIỆU LỰC
  const handleQuickUpdateStatus = async (item: any, newStatus: string) => {
    if (!canEditOrDeleteDocument(item)) {
      toast.warning("Bạn chỉ có quyền xem văn bản này, không có quyền chỉnh sửa!");
      return;
    }
    if (item.hieu_luc === newStatus) return;

    // Yêu cầu mở modal nếu chọn trạng thái bị thay thế để nhập link
    if (isReplacedStatus(newStatus)) {
      toast.warning("Vui lòng chọn nút 'Sửa' để cập nhật Link/Mã văn bản mới thay thế!");
      return;
    }

    const originalStatus = item.hieu_luc;
    // Cập nhật giao diện ngay lập tức
    setVbData(prev => prev.map(vb => String(vb.id) === String(item.id) ? { ...vb, hieu_luc: newStatus } : vb));

    try {
      const updatedItem = { ...item, hieu_luc: newStatus };
      await apiService.save(updatedItem, 'update', "vb_tb");
      toast.success("Cập nhật trạng thái thành công!");
    } catch (err: any) {
      setVbData(prev => prev.map(vb => String(vb.id) === String(item.id) ? { ...vb, hieu_luc: originalStatus } : vb));
      toast.error(err.message || "Lỗi cập nhật trạng thái!");
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setSubmitting(true);
    try {
      await apiService.delete(itemToDelete, "vb_tb");
      setVbData(prev => prev.filter(item => String(item.id) !== String(itemToDelete)));
      setIsConfirmOpen(false);
      setItemToDelete(null);
      toast.success("Xóa văn bản thành công!");
    } catch (err: any) {
      setError(err.message || 'Lỗi xóa dữ liệu.');
      toast.error(err.message || "Đã xảy ra lỗi khi xóa!");
    } finally {
      setSubmitting(false);
    }
  };

  const renderUnitTree = (parent: DonVi, level: number = 1, visited = new Set<string>()) => {
    if (!parent) return null;
    const pId = String(parent.id || '');
    if (level > 15 || visited.has(pId)) return null;
    const nextVisited = new Set(visited).add(pId);

    const children = getChildUnits(pId);
    const isExpanded = expandedParents.includes(pId) || !!unitSearchTerm;
    const isParentDimmed = parent.trang_thai === 'Đại lý' || parent.trang_thai === 'Đầu tư mới';

    return (
      <div key={pId} className={level === 1 ? "mb-1" : "mt-1"}>
        <button
          onClick={() => {
            setSelectedUnitFilter(pId);
            if (children.length > 0) toggleParent(pId);
            if (window.innerWidth < 768) setIsListCollapsed(true);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${selectedUnitFilter === pId ? 'bg-blue-50 text-[#05469B]' : 'text-gray-700 hover:bg-gray-50'} ${isParentDimmed ? 'opacity-50' : ''}`}
        >
          {children.length > 0 ? (isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />) : <div className="w-4 shrink-0" />}
          <span className="shrink-0">{getUnitEmoji(parent.loai_hinh)}</span>
          <span className="truncate text-left">{parent.ten_don_vi}</span>
        </button>

        {isExpanded && children.length > 0 && (
          <div className={`ml-${level === 1 ? '6' : '4'} mt-1 border-l-2 border-gray-100 pl-2 space-y-1`}>
            {children.map(child => renderUnitTree(child, level + 1, nextVisited))}
          </div>
        )}
      </div>
    );
  };

  const getLinkedDocument = useCallback((refStr: string) => {
    if (!refStr) return null;
    const cleanRef = refStr.trim();
    return vbData.find(d =>
      String(d.id) === cleanRef ||
      String(d.so_hieu).trim() === cleanRef ||
      (d.link_vb && String(d.link_vb).trim() === cleanRef)
    );
  }, [vbData]);

  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">

      {/* 🟢 NÚT MỞ BỘ LỌC TRÊN PC */}
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all">
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* 🟢 LỚP PHỦ BACKDROP CHO MOBILE KHI MỞ BỘ LỌC */}
      {!isListCollapsed && (
        <div
          className="md:hidden absolute inset-0 bg-black/50 z-[60] transition-opacity"
          onClick={() => setIsListCollapsed(true)}
        ></div>
      )}

      {/* CỘT TRÁI: BỘ LỌC ĐƠN VỊ VÀ PHÂN LOẠI */}
      <div className={`${isListCollapsed ? '-translate-x-full md:translate-x-0 md:w-0 opacity-0' : 'translate-x-0 w-[85%] max-w-[320px] md:w-80 opacity-100'} absolute md:relative inset-y-0 left-0 transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl md:shadow-sm z-[70] md:z-10 shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-[#05469B] flex items-center gap-2 whitespace-nowrap">
              <Bookmark size={20} /> Bộ lọc Đơn vị
            </h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-[#05469B] bg-gray-100 md:bg-transparent md:hover:bg-blue-50 rounded-md transition-colors">
              <X size={18} className="md:hidden" />
              <PanelLeftClose size={18} className="hidden md:block" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Tìm đơn vị áp dụng..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#05469B] outline-none"
              value={unitSearchTerm}
              onChange={(e) => setUnitSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-w-[319px] custom-scrollbar pb-20 md:pb-2">
          <button
            onClick={() => { setSelectedUnitFilter(null); if (window.innerWidth < 768) setIsListCollapsed(true); }}
            className={`w-full flex items-center gap-2 px-3 py-3 md:py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${selectedUnitFilter === null ? 'bg-blue-50 text-[#05469B] border border-blue-100' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <Building2 size={18} className={selectedUnitFilter === null ? 'text-[#05469B]' : 'text-gray-400'} /> Toàn Hệ Thống
          </button>
          <hr className="border-gray-100 mb-4 mx-2" />

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#05469B]" /></div>
          ) : parentUnits.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500">Không tìm thấy đơn vị.</div>
          ) : (
            <>
              {vpdhUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">VPĐH</p>{vpdhUnits.map(dv => renderUnitTree(dv))}</div>)}
              {ctttNamUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">CTTT Phía Nam</p>{ctttNamUnits.map(dv => renderUnitTree(dv))}</div>)}
              {ctttBacUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">CTTT Phía Bắc</p>{ctttBacUnits.map(dv => renderUnitTree(dv))}</div>)}
              {otherUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Đơn vị khác</p>{otherUnits.map(dv => renderUnitTree(dv))}</div>)}
            </>
          )}
        </div>

        {/* Nút Xem Kết quả to bự trên Mobile */}
        <div className="md:hidden absolute bottom-0 left-0 w-full p-4 border-t border-gray-200 bg-white">
          <button onClick={() => setIsListCollapsed(true)} className="w-full py-3 bg-[#05469B] text-white rounded-xl font-bold shadow-md">Hiển thị kết quả</button>
        </div>
      </div>

      {/* CỘT PHẢI: BẢNG DỮ LIỆU CHÍNH */}
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 flex flex-col w-full">

        {/* TOP BAR HIỂN THỊ RESPONSIVE */}
        <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 sm:mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:ml-10' : ''} shrink-0`}>
          <div className="flex items-center justify-between w-full xl:w-auto">
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
                <h2 className="text-xl md:text-2xl font-bold text-[#05469B] flex items-center gap-2">
                  <FileText className="w-6 h-6 md:w-7 md:h-7" /> Quản lý văn thư lưu trữ
                </h2>
                <p className="text-sm font-medium text-gray-500 mt-1 hidden md:block">
                  Lọc: <span className="text-emerald-600 font-bold">{selectedPhanLoai || 'Tất cả'}</span> • Khu vực: <span className="text-emerald-600 font-bold">{selectedUnitName}</span>
                </p>
              </div>
            </div>

            {/* 🟢 Nút mở bộ lọc nhanh trên Mobile */}
            <button
              onClick={() => setIsListCollapsed(false)}
              className="md:hidden p-2 bg-blue-50 text-[#05469B] rounded-lg border border-blue-100 flex items-center gap-2 shadow-sm shrink-0"
            >
              <Filter size={18} /> <span className="text-sm font-bold hidden sm:inline">Bộ lọc</span>
            </button>
          </div>

          <div className="flex flex-nowrap items-center justify-end gap-2 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0 relative z-30">
            {/* 1. Ô tìm kiếm 256 x 32 px */}
            <div className="relative w-[256px] h-[32px] shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Tìm số hiệu, tiêu đề, nghiệp vụ..."
                className="w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 2. Nút Đồng bộ dữ liệu (24 x 24 px) */}
            <button
              onClick={() => {
                loadData();
                toast.success('Đang đồng bộ dữ liệu Văn thư Lưu trữ mới nhất từ Supabase...');
              }}
              title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
              disabled={loading}
              className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white hover:bg-gray-50 text-gray-700 hover:text-[#05469B] rounded-md border border-gray-200 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              <RotateCcw size={13} className={loading ? 'animate-spin text-[#05469B]' : ''} />
            </button>

            {/* 3. Bộ lọc nâng cao */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsFilterPopoverOpen(prev => !prev)}
                className={`h-[32px] flex items-center justify-center gap-1.5 px-3 rounded-lg border text-xs font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer shrink-0
                  ${activeFiltersCount > 0
                    ? 'bg-blue-50 text-[#05469B] border-blue-200'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Bộ lọc nâng cao</span>
                {activeFiltersCount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 text-[9px] font-black text-white bg-red-500 rounded-full animate-pulse">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* 🟢 FLOATING FILTER PANEL (POPOVER) */}
              {isFilterPopoverOpen && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-45 bg-transparent" onClick={() => setIsFilterPopoverOpen(false)}></div>

                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 mb-3">
                      <h3 className="font-bold text-[#05469B] text-sm flex items-center gap-1.5"><Filter size={16} /> Lọc nâng cao</h3>
                      <button
                        onClick={() => {
                          setSelectedYear('all');
                          setSelectedSigner('all');
                          setSelectedStatus('all');
                          setSelectedDateFrom('');
                          setSelectedDateTo('');
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                      >
                        Đặt lại
                      </button>
                    </div>

                    <div className="space-y-3 block">
                      {/* Tiêu chí 1: Năm ban hành */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Năm ban hành</label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#05469B] outline-none"
                        >
                          <option value="all">Tất cả các năm</option>
                          {availableYears.map(year => (
                            <option key={year} value={year}>Năm {year}</option>
                          ))}
                        </select>
                      </div>

                      {/* Tiêu chí 2: Người ký */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Người ký</label>
                        <select
                          value={selectedSigner}
                          onChange={(e) => setSelectedSigner(e.target.value)}
                          className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#05469B] outline-none"
                        >
                          <option value="all">Tất cả người ký</option>
                          {availableSigners.map(signer => (
                            <option key={signer} value={signer}>{signer}</option>
                          ))}
                        </select>
                      </div>

                      {/* Tiêu chí 3: Hiệu lực */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Trạng thái hiệu lực</label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#05469B] outline-none"
                        >
                          <option value="all">Tất cả trạng thái</option>
                          <option value="Còn hiệu lực">Còn hiệu lực</option>
                          <option value="Hết hiệu lực">Hết hiệu lực</option>
                          <option value="Được thay thế bằng VB">Được thay thế bằng VB</option>
                        </select>
                      </div>

                      {/* Tiêu chí 4: Khoảng ngày ban hành */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Khoảng ngày ban hành</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-gray-400 block mb-0.5">Từ ngày</span>
                            <input
                              type="date"
                              value={selectedDateFrom}
                              onChange={(e) => setSelectedDateFrom(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#05469B] outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-400 block mb-0.5">Đến ngày</span>
                            <input
                              type="date"
                              value={selectedDateTo}
                              onChange={(e) => setSelectedDateTo(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#05469B] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={() => setIsFilterPopoverOpen(false)}
                        className="w-full py-2 bg-[#05469B] text-white rounded-lg text-xs font-bold hover:bg-[#04367a] shadow-sm transition-all"
                      >
                        Áp dụng ({filteredDocs.length} văn bản)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 4. 🟢 Nút ban hành (độ cao 27 px) */}
            {!isViewerHanChe && !advancedRules.includes('VB_HIDE_BTN') && (
              <button
                onClick={() => openModal('create')}
                className="h-[27px] px-3 flex items-center justify-center gap-1.5 bg-[#05469B] hover:bg-[#04367a] text-white rounded-lg text-xs font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Ban hành</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* 🟢 THANH TAB NGANG CHUYỂN ĐỔI PHÂN LOẠI VĂN BẢN (NẰM NGOÀI BOX ĐỂ THOÁT MẮT) */}
        <div className={`mb-4 shrink-0 transition-all duration-300 ${isListCollapsed ? 'md:ml-10' : ''}`}>
          <SegmentTabs
            tabs={docTabs}
            activeTab={selectedPhanLoai === null ? 'all' : selectedPhanLoai}
            onChange={(id) => {
              setSelectedPhanLoai(id === 'all' ? null : id);
              setCurrentPage(1);
            }}
            layoutId="docActiveTabBackground"
            activeBgColor="#05469B"
            fullWidth
          />
        </div>

        <div className={`bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 overflow-hidden transition-all duration-300 flex flex-col flex-1 ${isListCollapsed ? 'md:ml-10' : ''}`}>

          {/* 🟢 DANH SÁCH BẢNG HIỂN THỊ ĐỘNG THEO TAB */}
          {selectedPhanLoai === null && (
            <AllDocTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
            />
          )}

          {selectedPhanLoai === 'Thông báo' && (
            <ThongBaoTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
              phanLoai="Thông báo"
            />
          )}

          {selectedPhanLoai === 'Thông báo BĐH' && (
            <ThongBaoTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
              phanLoai="Thông báo BĐH"
            />
          )}

          {selectedPhanLoai === 'Quyết định' && (
            <QuyetDinhTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
            />
          )}

          {selectedPhanLoai === 'Công văn đến' && (
            <CongVanDenTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
            />
          )}

          {selectedPhanLoai === 'Công văn đi' && (
            <CongVanDiTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
            />
          )}

          {selectedPhanLoai === 'Tờ trình' && (
            <ToTrinhTable
              loading={loading}
              paginatedDocs={paginatedDocs}
              filteredDocsCount={filteredDocs.length}
              donViMap={donViMap}
              isViewerHanChe={isViewerHanChe}
              canEditOrDeleteDocument={canEditOrDeleteDocument}
              handleQuickUpdateStatus={handleQuickUpdateStatus}
              openModal={openModal}
              handleDeleteClick={handleDeleteClick}
              setViewData={setViewData}
              setIsViewModalOpen={setIsViewModalOpen}
            />
          )}

          {/* GIAO DIỆN PHÂN TRANG (TỐI ƯU MOBILE) */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            totalRows={filteredDocs.length}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
            itemName="văn bản"
          />

        </div>
      </div>

      {/* 🟢 MODAL THÊM / SỬA VĂN BẢN (KHÔI PHỤC BỐ CỤC PHẲNG - CHUẨN RESPONSIVE) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-h-[95vh] md:max-h-[90vh] md:h-auto md:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in duration-200 mt-auto md:mt-0 overflow-hidden">

            {/* Header */}
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-[#05469B] text-white shrink-0">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 truncate pr-2">
                <FileText className="shrink-0" size={24} />
                <span className="truncate">{modalMode === 'create' ? 'Ban hành Văn bản / Thông báo Mới' : 'Cập nhật Văn bản'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors shrink-0">
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-6 md:space-8 custom-scrollbar w-full bg-white">

                {/* KHỐI 1: THÔNG TIN HÀNH CHÍNH (XANH DƯƠNG) */}
                <div className="bg-white p-5 rounded-2xl border border-blue-200">
                  <h4 className="font-bold text-[#05469B] mb-5 flex items-center gap-2 text-sm uppercase">
                    <div className="w-1.5 md:w-2 h-5 md:h-6 bg-[#05469B] rounded-full"></div> 1. Thông Tin Chung
                  </h4>
                  {/* Dùng md:grid-cols-4 để điện thoại luôn là 1 cột dọc */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
                    <div className="md:col-span-2 min-w-0">
                      <label className="block text-[11px] font-bold text-[#05469B] mb-1">Đơn vị ban hành (Lưu trữ) *</label>
                      <select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                        <option value="">-- Chọn đơn vị --</option>
                        {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-1 min-w-0">
                      <label className="block text-[11px] font-bold text-[#05469B] mb-1">Phân loại *</label>
                      <select required name="phan_loai" value={formData.phan_loai || 'Thông báo'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-800">
                        {canViewType('Thông báo') && <option value="Thông báo">Thông báo</option>}
                        {canViewType('Thông báo BĐH') && <option value="Thông báo BĐH">Thông báo BĐH</option>}
                        {canViewType('Quyết định') && <option value="Quyết định">Quyết định</option>}
                        {canViewType('Tờ trình') && <option value="Tờ trình">Tờ trình</option>}
                        {canViewType('Công văn đến') && <option value="Công văn đến">Công văn đến</option>}
                        {canViewType('Công văn đi') && <option value="Công văn đi">Công văn đi</option>}
                      </select>
                    </div>
                    <div className="md:col-span-1 min-w-0">
                      <label className="block text-[11px] font-bold text-red-600 mb-1">Độ khẩn *</label>
                      <select name="muc_do_khan" value={formData.muc_do_khan || 'Bình thường'} onChange={handleInputChange} className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500 font-bold ${formData.muc_do_khan === 'Hỏa tốc' ? 'text-red-700' : formData.muc_do_khan === 'Khẩn' ? 'text-orange-600' : 'text-gray-700'}`}>
                        <option value="Bình thường">Bình thường</option><option value="Khẩn">Khẩn</option><option value="Hỏa tốc">Hỏa tốc</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-gray-700">Số hiệu *</label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-[#05469B]">
                          <input type="checkbox" checked={isAutoNumber} onChange={(e) => setIsAutoNumber(e.target.checked)} className="w-3.5 h-3.5 text-[#05469B] border-gray-300 rounded focus:ring-[#05469B]" />
                          Số tự động
                        </label>
                      </div>
                      <input type="text" required name="so_hieu" value={formData.so_hieu || ''} onChange={handleInputChange} className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-black tracking-wider ${isAutoNumber ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300' : 'bg-[#FFFFF0] text-gray-800'}`} placeholder={isAutoNumber ? "Hệ thống tự động cấp..." : "VD: 123/202../TB-THACO AUTO"} readOnly={isAutoNumber} />
                    </div>
                    <div className="md:col-span-2 min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Ngày ban hành *</label>
                      <input type="date" required name="ngay_ban_hanh" value={formData.ngay_ban_hanh || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold" />
                    </div>

                    <div className="md:col-span-4 min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Phạm vi áp dụng (Hiển thị cho) *</label>
                      <select required name="pham_vi_ap_dung" value={formData.pham_vi_ap_dung || 'Toàn hệ thống'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                        <option value="Toàn hệ thống">🌍 Áp dụng Toàn hệ thống</option>
                        <optgroup label="Hoặc Chỉ định Đơn vị cụ thể:">
                          {buildHierarchicalOptions(donViList).map(({ unit, prefix }) => (
                            <option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="md:col-span-4 min-w-0 mt-1">
                      <label className="inline-flex items-center p-2.5 md:p-3 border border-red-200 rounded-lg bg-red-50/30 cursor-pointer hover:bg-red-50 transition-colors shadow-sm w-full md:w-max">
                        <input type="checkbox" name="mat" checked={!!formData.mat} onChange={(e) => setFormData((prev: any) => ({ ...prev, mat: e.target.checked }))} className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 shrink-0" />
                        <Lock size={14} className="text-red-500 mx-2 shrink-0" />
                        <span className="text-[11px] md:text-xs font-bold text-red-600">Đánh dấu là Văn bản MẬT (Cảnh báo thị giác)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* KHỐI 2: THÔNG TIN LUÂN CHUYỂN (CHÀM) */}
                {formData.phan_loai !== 'Thông báo' && formData.phan_loai !== 'Thông báo BĐH' && (
                  <div className="bg-white p-5 rounded-2xl border border-indigo-200 animate-in fade-in zoom-in duration-200">
                    <h4 className="font-bold text-indigo-800 mb-5 flex items-center gap-2 text-sm uppercase">
                      <div className="w-1.5 md:w-2 h-5 md:h-6 bg-indigo-600 rounded-full"></div> 2. Thông tin Luân chuyển
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
                      <div className={`min-w-0 ${formData.phan_loai === 'Công văn đến' ? 'md:col-span-2' : 'md:col-span-4'}`}>
                        <label className="block text-[11px] font-bold text-indigo-800 mb-1 uppercase">{getNoiGuiNhanLabel(formData.phan_loai)} *</label>
                        <input type="text" required name="noi_goi_nhan" value={formData.noi_goi_nhan || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tên cơ quan, đơn vị, cá nhân..." />
                      </div>
                      {formData.phan_loai === 'Công văn đến' && (
                        <>
                          <div className="md:col-span-1 min-w-0">
                            <label className="block text-[11px] font-bold text-indigo-800 mb-1 uppercase">Số đến nội bộ *</label>
                            <input type="text" required name="so_den" value={formData.so_den || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="VD: 01/Đ..." />
                          </div>
                          <div className="md:col-span-1 min-w-0">
                            <label className="block text-[11px] font-bold text-indigo-800 mb-1 uppercase">Ngày nhận *</label>
                            <input type="date" required name="ngay_nhan" value={formData.ngay_nhan || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* KHỐI 3: NỘI DUNG CHÍNH (XÁM) */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200">
                  <h4 className="font-bold text-gray-700 mb-5 flex items-center gap-2 text-sm uppercase">
                    <div className="w-1.5 md:w-2 h-5 md:h-6 bg-gray-400 rounded-full"></div> 3. Nội dung Văn bản
                  </h4>
                  <div className="space-y-4 md:space-y-5">
                    <div className="min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Tiêu đề *</label>
                      <input type="text" required name="tieu_de" value={formData.tieu_de || ''} onChange={handleInputChange} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold md:text-lg break-words" placeholder="Nhập tiêu đề văn bản..." />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Trích yếu nội dung</label>
                      <textarea name="noi_dung" value={formData.noi_dung || ''} onChange={handleInputChange} rows={3} className="w-full p-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none break-words" placeholder="Tóm tắt ngắn gọn nội dung..."></textarea>
                    </div>
                    <div className="min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-gray-700">Link File đính kèm (PDF / Drive)</label>
                        <button
                          type="button"
                          onClick={handleAutoScanDrive}
                          disabled={scanningDrive}
                          className="text-[10px] text-[#05469B] hover:text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded border border-blue-100 hover:bg-blue-100 disabled:opacity-50 transition-all cursor-pointer shadow-sm shrink-0"
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
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="url" name="link_vb" value={formData.link_vb || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 font-medium break-all" placeholder="Dán link Google Drive hoặc file PDF vào đây..." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* KHỐI 4: THEO DÕI XỬ LÝ & PHỤ TRỢ (CAM) */}
                <div className="bg-white p-5 rounded-2xl border border-orange-200">
                  <h4 className="font-bold text-orange-800 mb-5 flex items-center gap-2 text-sm uppercase">
                    <div className="w-1.5 md:w-2 h-5 md:h-6 bg-orange-500 rounded-full"></div> 4. Theo dõi Xử lý & Thông tin Phụ trợ
                  </h4>

                  <div className="space-y-6">
                    {/* Khu vực Xử lý */}
                    {(formData.phan_loai === 'Công văn đến' || formData.phan_loai === 'Tờ trình') && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 pb-6 border-b border-orange-100 animate-in fade-in zoom-in">
                        <div className="min-w-0">
                          <label className="block text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1"><Zap size={14} /> Đơn vị / Người xử lý</label>
                          <CustomAutocomplete name="bo_phan_xu_ly" value={formData.bo_phan_xu_ly} onChange={handleInputChange} placeholder="Giao cho..." suggestions={suggestDonViXuLy} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1"><Clock size={14} /> Hạn xử lý (Deadline)</label>
                          <input type="date" name="han_xu_ly" value={formData.han_xu_ly || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[11px] font-bold text-orange-700 mb-1 flex items-center gap-1"><Send size={14} /> Trạng thái Xử lý</label>
                          <select name="trang_thai_xu_ly" value={formData.trang_thai_xu_ly || 'Chờ xử lý'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-800">
                            <option value="Chờ xử lý">Chờ xử lý</option>
                            <option value="Đang xử lý">Đang xử lý</option>
                            <option value="Đã hoàn thành">Đã hoàn thành</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-10 gap-4 md:gap-5">
                      {/* Dòng 1: Người ký - Chức vụ người ký (50 - 50) */}
                      <div className="md:col-span-5 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Người ký</label>
                        <CustomAutocomplete name="nguoi_ky" value={formData.nguoi_ky} onChange={handleInputChange} placeholder="Họ tên người ký..." suggestions={suggestNguoiky} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      </div>
                      <div className="md:col-span-5 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Chức vụ người ký</label>
                        <CustomAutocomplete name="chuc_vu" value={formData.chuc_vu} onChange={handleInputChange} placeholder="VD: Giám đốc..." suggestions={suggestChucvu} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      </div>

                      {/* Dòng 2: MSNV - Người lấy số - Bộ phận lấy số (20 - 40 - 40) */}
                      <div className="md:col-span-2 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">MSNV người lấy số</label>
                        <CustomAutocomplete name="msnv_nguoi_lay_so" value={formData.msnv_nguoi_lay_so || ''} onChange={handleInputChange} placeholder="VD: NV001..." suggestions={suggestMsnv} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      </div>
                      <div className="md:col-span-4 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Người lấy số</label>
                        <CustomAutocomplete name="nguoi_lay_so" value={formData.nguoi_lay_so} onChange={handleInputChange} placeholder="Nhân viên..." suggestions={suggestHoTen} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      </div>
                      <div className="md:col-span-4 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Bộ phận lấy số</label>
                        <CustomAutocomplete name="bo_phan_lay_so" value={formData.bo_phan_lay_so} onChange={handleInputChange} placeholder="Phòng HCNS..." suggestions={suggestBPlayso} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      </div>

                      {/* Dòng 3: Phân loại Nghiệp vụ - Tình trạng Hiệu lực (50 - 50) */}
                      <div className="md:col-span-5 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Phân loại Nghiệp vụ</label>
                        <CustomAutocomplete name="nghiep_vu" value={formData.nghiep_vu} onChange={handleInputChange} placeholder="Kinh doanh, Nhân sự, Dịch vụ..." suggestions={suggestNghiepvu} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                      </div>
                      <div className="md:col-span-5 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Tình trạng Hiệu lực *</label>
                        <select required name="hieu_luc" value={isReplacedStatus(formData.hieu_luc) ? 'Được thay thế bằng VB' : (formData.hieu_luc || 'Còn hiệu lực')} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                          <option value="Còn hiệu lực">Còn hiệu lực</option>
                          <option value="Hết hiệu lực">Hết hiệu lực</option>
                          <option value="Được thay thế bằng VB">Được thay thế bằng VB</option>
                        </select>
                      </div>

                      {isReplacedStatus(formData.hieu_luc) && (
                        <div className="md:col-span-10 bg-orange-50 p-4 rounded-lg border border-orange-300 mt-2 min-w-0 animate-in fade-in zoom-in duration-200">
                          <label className="block text-[11px] font-bold text-orange-800 mb-1">Link/Mã Văn bản mới thay thế (Dán link vào đây) *</label>
                          <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" size={16} />
                            <input type="text" required name="van_ban_thay_the" value={formData.van_ban_thay_the || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2.5 border border-orange-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500 text-blue-600 text-sm font-medium break-all" placeholder="Dán link Google Drive hoặc mã số của văn bản mới thay thế..." />
                          </div>
                        </div>
                      )}

                      {/* Checkbox kích hoạt Thay thế văn bản */}
                      <div className="md:col-span-10 min-w-0 mt-1">
                        <label className="inline-flex items-center p-2.5 md:p-3 border border-blue-200 rounded-lg bg-blue-50/30 cursor-pointer hover:bg-blue-50 transition-colors shadow-sm w-full md:w-max">
                          <input
                            type="checkbox"
                            name="is_replacing"
                            checked={!!formData.is_replacing}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData((prev: any) => ({
                                ...prev,
                                is_replacing: checked,
                                replaced_doc_id: checked ? prev.replaced_doc_id : '' // Xóa lựa chọn nếu bỏ chọn
                              }));
                            }}
                            className="w-4 h-4 text-[#05469B] border-gray-300 rounded focus:ring-[#05469B] shrink-0"
                          />
                          <FileText size={14} className="text-[#05469B] mx-2 shrink-0" />
                          <span className="text-[11px] md:text-xs font-bold text-[#05469B]">Văn bản này thay thế cho văn bản khác</span>
                        </label>
                      </div>

                      {/* Chọn văn bản bị thay thế bởi văn bản hiện tại (chỉ hiển thị khi check) */}
                      {formData.is_replacing && (
                        <div className="md:col-span-10 bg-blue-50/40 p-4 rounded-xl border border-blue-100 mt-2 min-w-0 animate-in fade-in zoom-in duration-200">
                          <label className="block text-[11px] font-bold text-[#05469B] mb-1.5 uppercase flex items-center gap-1.5">
                            <FileText size={14} /> Chọn văn bản bị thay thế bởi văn bản hiện tại *
                          </label>
                          <DocumentSelectAutocomplete
                            value={formData.replaced_doc_id || ''}
                            onChange={(docId: string) => {
                              setFormData((prev: any) => ({ ...prev, replaced_doc_id: docId }));
                            }}
                            documents={vbData}
                            placeholder="Tìm số hiệu hoặc tiêu đề văn bản bị thay thế..."
                            currentDocId={formData.id}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* FOOTER */}
              <div className="p-4 md:p-5 border-t border-gray-100 flex flex-col-reverse md:flex-row justify-end gap-3 mt-auto shrink-0 bg-white pb-8 md:pb-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full md:w-auto px-8 py-3.5 md:py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm">Hủy</button>
                <button type="submit" disabled={submitting} className="w-full md:w-auto px-8 py-3.5 md:py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Văn Bản
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 🟢 MODAL XEM CHI TIẾT (ĐÃ XỬ LÝ KHUNG TRÀN BỀ NGANG / BỀ DỌC TRÊN MOBILE) */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-h-[92vh] md:max-h-[90vh] md:h-auto md:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in duration-200 overflow-hidden mt-auto md:mt-0">
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-3xl md:rounded-t-2xl shrink-0">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 truncate pr-2">
                <FileText className="shrink-0" size={24} />
                <span className="truncate">Chi tiết Văn bản</span>
              </h3>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {viewData.link_vb && (
                  <a href={viewData.link_vb} target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors border border-white/20">
                    <ExternalLink size={16} /> Mở file
                  </a>
                )}
                <button onClick={() => setIsViewModalOpen(false)} className="text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* VÙNG CUỘN (Tự động giấu thanh ngang, bẻ chữ nếu quá dài) */}
            <div className="p-4 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 bg-white w-full">

              {isMatDocument(viewData.mat) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0"><Lock size={20} md:size={24} /></div>
                  <div>
                    <p className="text-sm md:text-base font-black text-red-700 uppercase">Tài liệu Mật</p>
                    <p className="text-xs md:text-sm font-medium text-red-600 mt-0.5">Đề nghị không sao chép, chụp ảnh hay phát tán dưới mọi hình thức.</p>
                  </div>
                </div>
              )}

              <div className="mb-6 md:mb-8 border-b border-gray-100 pb-4 md:pb-6">
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                  <span className="bg-blue-100 text-[#05469B] font-black px-3 py-1.5 rounded-lg text-sm md:text-lg border border-blue-200 shadow-sm break-all">{viewData.so_hieu}</span>
                  <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1.5 rounded-lg text-[10px] md:text-xs uppercase">{viewData.phan_loai}</span>

                  {viewData.muc_do_khan && viewData.muc_do_khan !== 'Bình thường' && (
                    <span className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-black border uppercase ${viewData.muc_do_khan === 'Hỏa tốc' ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' : 'bg-orange-100 text-orange-700 border-orange-300'}`}>
                      {viewData.muc_do_khan}
                    </span>
                  )}

                  <span className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border ${viewData.hieu_luc === 'Còn hiệu lực' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isReplacedStatus(viewData.hieu_luc) ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {isReplacedStatus(viewData.hieu_luc) ? 'Được thay thế bằng VB' : viewData.hieu_luc}
                  </span>
                </div>
                <h2 className={`text-lg md:text-3xl font-black leading-tight mt-3 md:mt-4 break-words ${isMatDocument(viewData.mat) ? 'text-red-700' : 'text-gray-800'}`}>{viewData.tieu_de}</h2>
                <div className="flex items-center justify-between mt-3 text-xs md:text-sm text-gray-500 w-full">
                  <p className="flex items-center gap-2">
                    <Calendar size={14} className="md:w-4 md:h-4" /> Ban hành: <span className="font-bold text-gray-700">{viewData.ngay_ban_hanh ? new Date(viewData.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}</span>
                  </p>
                  <button onClick={handleCopyFeedback} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#05469B] font-bold rounded-lg transition-colors border border-blue-200 cursor-pointer shadow-sm text-xs">
                    <Copy size={13} /> Thông tin phản hồi
                  </button>
                </div>
              </div>

              <div className="mb-6 md:mb-8">
                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FileText size={18} /> Trích yếu nội dung:</h4>
                <div className="bg-gray-50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-gray-100 text-sm md:text-base text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner break-words">
                  {viewData.noi_dung || <span className="italic text-gray-400">Không có trích yếu nội dung.</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 mb-6 md:mb-8 bg-blue-50/50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-blue-100">
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-gray-500 uppercase font-bold mb-1">Nơi ban hành (Lưu trữ)</p>
                  <p className="font-semibold text-[#05469B] text-sm md:text-base break-words">{donViMap[String(viewData.id_don_vi)] || viewData.id_don_vi}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-gray-500 uppercase font-bold mb-1">Phạm vi áp dụng</p>
                  <p className="font-semibold text-[#05469B] text-sm md:text-base break-words">{viewData.pham_vi_ap_dung === 'Toàn hệ thống' ? '🌍 Toàn hệ thống' : donViMap[String(viewData.pham_vi_ap_dung)] || viewData.pham_vi_ap_dung}</p>
                </div>
              </div>

              {viewData.phan_loai !== 'Thông báo' && viewData.phan_loai !== 'Thông báo BĐH' && (
                <div className="mb-6 md:mb-8 p-4 md:p-5 rounded-xl md:rounded-2xl border border-indigo-100 bg-indigo-50/50 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`min-w-0 ${viewData.phan_loai === 'Công văn đến' ? 'md:col-span-2' : ''}`}>
                      <p className="text-[10px] md:text-xs text-indigo-500 uppercase font-bold mb-1">{getNoiGuiNhanLabel(viewData.phan_loai)}</p>
                      <p className="font-bold text-indigo-900 text-sm md:text-base break-words">{viewData.noi_goi_nhan || '-'}</p>
                    </div>
                    {viewData.phan_loai === 'Công văn đến' && (
                      <>
                        <div className="min-w-0"><p className="text-[10px] md:text-xs text-indigo-500 uppercase font-bold mb-1">Số đến nội bộ</p><p className="font-black text-[#05469B] text-sm md:text-base break-all">{viewData.so_den || '-'}</p></div>
                        <div className="min-w-0"><p className="text-[10px] md:text-xs text-indigo-500 uppercase font-bold mb-1">Ngày nhận CV</p><p className="font-semibold text-gray-800 text-sm md:text-base">{viewData.ngay_nhan ? new Date(viewData.ngay_nhan).toLocaleDateString('vi-VN') : '-'}</p></div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-blue-100 shadow-sm mb-6 md:mb-8">
                <h4 className="text-xs md:text-sm font-bold text-[#05469B] mb-3 md:mb-4 flex items-center gap-2 uppercase tracking-wider"><Briefcase size={16} className="md:w-5 md:h-5" /> Phân công & Nghiệp vụ</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-blue-50/50 p-3 md:p-4 rounded-xl border border-blue-100/50 flex flex-col justify-center min-w-0">
                    <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-1.5"><PenTool size={14} className="text-blue-500 shrink-0" /> Người ký</span>
                    <p className="font-black text-gray-800 text-sm md:text-base truncate">{viewData.nguoi_ky || '---'}</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-bold truncate">{viewData.chuc_vu || '---'}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-3 md:p-4 rounded-xl border border-emerald-100/50 flex flex-col justify-center min-w-0">
                    <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-1.5"><Hash size={14} className="text-emerald-500 shrink-0" /> Lấy số bởi</span>
                    <p className="font-black text-gray-800 text-sm md:text-base truncate">{viewData.nguoi_lay_so || '---'}</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-bold truncate">{viewData.bo_phan_lay_so || '---'}</p>
                  </div>
                  <div className="bg-orange-50/50 p-3 md:p-4 rounded-xl border border-orange-100/50 flex flex-col justify-center items-start min-w-0">
                    <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-2"><Layers size={14} className="text-orange-500 shrink-0" /> Phân loại Nghiệp vụ</span>
                    <div className="flex flex-wrap gap-1.5 max-w-full">
                      {viewData.nghiep_vu ? (
                        viewData.nghiep_vu.split(';').map(p => p.trim()).filter(Boolean).map((nv, idx) => (
                          <span key={idx} className="font-black text-[#05469B] text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 bg-white rounded border border-[#05469B]/20 shadow-sm truncate">{nv}</span>
                        ))
                      ) : (
                        <span className="font-black text-[#05469B] text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 bg-white rounded border border-[#05469B]/20 shadow-sm truncate">---</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {(viewData.phan_loai === 'Công văn đến' || viewData.phan_loai === 'Tờ trình') && (
                <div className="mb-6 p-4 md:p-5 rounded-xl md:rounded-2xl border border-orange-200 bg-orange-50/50 shadow-sm flex flex-col">
                  <h4 className="text-xs md:text-sm font-bold text-orange-800 mb-3 md:mb-4 flex items-center gap-2 uppercase tracking-wider"><Clock size={16} className="md:w-5 md:h-5" /> Theo dõi Xử lý</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="min-w-0"><p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Người xử lý</p><p className="font-semibold text-gray-800 text-sm md:text-base truncate">{viewData.bo_phan_xu_ly || 'Chưa giao'}</p></div>
                    <div className="min-w-0"><p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Hạn xử lý</p><p className="font-bold text-red-600 text-sm md:text-base">{viewData.han_xu_ly ? new Date(viewData.han_xu_ly).toLocaleDateString('vi-VN') : '-'}</p></div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">Trạng thái</p>
                      <span className={`inline-block font-black px-3 py-1.5 rounded border text-xs md:text-sm ${viewData.trang_thai_xu_ly === 'Đã hoàn thành' ? 'bg-green-100 text-green-700 border-green-200' : viewData.trang_thai_xu_ly === 'Đang xử lý' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                        {viewData.trang_thai_xu_ly || 'Chờ xử lý'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-8 pb-8 md:pb-0">
                {viewData.link_vb && (
                  <a href={viewData.link_vb} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3.5 md:py-4 bg-[#05469B] hover:bg-[#04367a] text-white rounded-xl font-bold transition-colors shadow-md text-sm md:text-base">
                    <ExternalLink size={18} className="md:w-5 md:h-5" /> Mở File Văn Bản
                  </a>
                )}
                {/* Hiển thị liên kết thay thế văn bản hai chiều */}
                {viewData.van_ban_thay_the && (() => {
                  const linkedDoc = getLinkedDocument(viewData.van_ban_thay_the);

                  // Trường hợp 1: Văn bản hiện tại đã "Hết hiệu lực" (là văn bản cũ) -> Dẫn tới văn bản mới thay thế
                  if (viewData.hieu_luc === 'Hết hiệu lực' || isReplacedStatus(viewData.hieu_luc)) {
                    if (linkedDoc) {
                      return (
                        <button
                          type="button"
                          onClick={() => setViewData(linkedDoc)}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 md:py-4 bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base cursor-pointer"
                        >
                          <ExternalLink size={18} className="md:w-5 md:h-5" /> Xem Văn bản mới thay thế: {linkedDoc.so_hieu}
                        </button>
                      );
                    } else if (String(viewData.van_ban_thay_the).startsWith('http')) {
                      return (
                        <a
                          href={viewData.van_ban_thay_the}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 md:py-4 bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base"
                        >
                          <ExternalLink size={18} className="md:w-5 md:h-5" /> Xem Văn bản mới thay thế (Link ngoài)
                        </a>
                      );
                    } else {
                      return (
                        <div className="flex-1 py-3 px-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-xs md:text-sm font-semibold text-center flex items-center justify-center">
                          Được thay thế bởi văn bản: <span className="font-bold ml-1">{viewData.van_ban_thay_the}</span>
                        </div>
                      );
                    }
                  }

                  // Trường hợp 2: Văn bản hiện tại đang "Còn hiệu lực" (là văn bản mới) -> Dẫn ngược về văn bản cũ bị thay thế
                  if (viewData.hieu_luc === 'Còn hiệu lực') {
                    if (linkedDoc) {
                      return (
                        <button
                          type="button"
                          onClick={() => setViewData(linkedDoc)}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 md:py-4 bg-blue-50 border border-blue-200 text-[#05469B] hover:bg-blue-100 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base cursor-pointer"
                        >
                          <ExternalLink size={18} className="md:w-5 md:h-5" /> Thay thế cho văn bản cũ: {linkedDoc.so_hieu}
                        </button>
                      );
                    } else {
                      return (
                        <div className="flex-1 py-3 px-4 bg-blue-50 border border-blue-200 text-[#05469B] rounded-xl text-xs md:text-sm font-semibold text-center flex items-center justify-center">
                          Thay thế cho văn bản trước đó: <span className="font-bold ml-1">{viewData.van_ban_thay_the}</span>
                        </div>
                      );
                    }
                  }

                  return null;
                })()}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* XÁC NHẬN XÓA */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa văn bản này vĩnh viễn.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-3.5 md:py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="flex-1 py-3.5 md:py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}