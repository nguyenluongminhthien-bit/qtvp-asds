import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  FileText, Building2, MapPin, ChevronDown, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Link as LinkIcon, Calendar, CheckCircle2, Bookmark, Eye, Lock, Zap, Clock, Send,
  PenTool, Hash, Briefcase, Layers, ExternalLink, Filter
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

// HÀM KIỂM TRA VĂN BẢN MẬT
const isMatDocument = (val: any) => {
  if (val === true || val === 'TRUE' || val === 'true' || val === 'Có' || String(val).trim() === '1') return true;
  return false;
};

// HÀM KIỂM TRA VĂN BẢN MỚI (TRONG VÒNG 7 NGÀY)
const isNewDocument = (dateString: string | null) => {
  if (!dateString) return false;
  const docDate = new Date(dateString).getTime();
  const now = new Date().getTime();
  const diffInDays = (now - docDate) / (1000 * 3600 * 24);
  // Hiển thị nhãn Mới nếu văn bản ban hành từ 0-7 ngày trước (hoặc tính cả ngày hôm nay)
  return diffInDays >= -1 && diffInDays <= 7;
};

// HÀM CHUẨN HÓA TÊN NGƯỜI KÝ (COLLAPSE CÁC BIẾN THỂ TRÙNG LẶP)
const normalizeSignerName = (name: string) => {
  if (!name) return '';
  // Chuẩn hóa Unicode dựng sẵn (NFC) để tránh trùng lặp do bảng mã tiếng Việt khác nhau (tổ hợp vs dựng sẵn)
  let normalized = name.normalize('NFC').trim().replace(/\s+/g, ' '); 
  // Viết hoa chữ cái đầu từng từ
  normalized = normalized.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
  
  // Sửa lỗi chính tả biến thể của tên "Nguyễn Quang Bảo"
  if (normalized === 'Nguyển Quang Bảo' || normalized === 'Nguyen Quang Bao') {
    return 'Nguyễn Quang Bảo';
  }
  return normalized;
};

// HÀM LẤY NHÃN HIỂN THỊ ĐỘNG CHO NƠI GỬI/NHẬN
const getNoiGuiNhanLabel = (phanLoai: string) => {
  switch(phanLoai) {
    case 'Công văn đến': return 'Cơ quan / Đơn vị gửi đến';
    case 'Công văn đi': return 'Nơi nhận (Kính gửi / Đồng kính gửi)';
    case 'Quyết định': return 'Đơn vị / Cá nhân nhận Quyết định';
    case 'Tờ trình': return 'Kính gửi (Nơi nhận Tờ trình)';
    case 'Thông báo': return 'Nơi nhận Thông báo';
    default: return 'Nơi nhận / Gửi';
  }
};

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

  const filtered = suggestions.filter((s: string) => s.toLowerCase().includes((value || '').toLowerCase()));

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
                onChange({ target: { name, value: item } });
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

  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [vbData, setVbData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const allowedDonViIds = useAllowedUnits(donViList);

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

  const filteredDocs = useMemo(() => {
    let result = [...visibleDocuments];
    
    if (isViewerHanChe) {
      result = result.filter(item => 
        item.phan_loai === 'Thông báo' || item.phan_loai === 'Quyết định'
      );
    }

    if (advancedRules.includes('VB_ONLY_TB') && !advancedRules.includes('VB_ONLY_QD')) {
      result = result.filter(item => item.phan_loai === 'Thông báo');
    } else if (advancedRules.includes('VB_ONLY_QD') && !advancedRules.includes('VB_ONLY_TB')) {
      result = result.filter(item => item.phan_loai === 'Quyết định');
    } else if (advancedRules.includes('VB_ONLY_TB') && advancedRules.includes('VB_ONLY_QD')) {
      result = result.filter(item => item.phan_loai === 'Thông báo' || item.phan_loai === 'Quyết định');
    }

    if (selectedUnitFilter) result = result.filter(item => String(item.id_don_vi) === String(selectedUnitFilter) || String(item.pham_vi_ap_dung) === String(selectedUnitFilter));
    if (selectedPhanLoai) result = result.filter(item => item.phan_loai === selectedPhanLoai);
    if (selectedYear !== 'all') {
      result = result.filter(item => item.ngay_ban_hanh && new Date(item.ngay_ban_hanh).getFullYear().toString() === selectedYear);
    }
    if (selectedSigner !== 'all') {
      result = result.filter(item => item.nguoi_ky && normalizeSignerName(item.nguoi_ky) === selectedSigner);
    }
    if (selectedStatus !== 'all') {
      result = result.filter(item => item.hieu_luc === selectedStatus);
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
    visibleDocuments, searchTerm, selectedUnitFilter, selectedPhanLoai, selectedYear,
    selectedSigner, selectedStatus, selectedDateFrom, selectedDateTo, isViewerHanChe, advancedRules
  ]);

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
      setFormData({ 
        ...item, 
        ngay_ban_hanh: item.ngay_ban_hanh ? item.ngay_ban_hanh.split('T')[0] : '', 
        ngay_nhan: item.ngay_nhan ? item.ngay_nhan.split('T')[0] : '', 
        han_xu_ly: item.han_xu_ly ? item.han_xu_ly.split('T')[0] : '', 
        mat: isMatDocument(item.mat),
        msnv_lay_so: item.msnv_lay_so || ''
      }); 
    } else {
      setFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), 
        phan_loai: 'Thông báo', muc_do_khan: 'Bình thường', so_hieu: '', ngay_ban_hanh: new Date().toISOString().split('T')[0], 
        tieu_de: '', noi_dung: '', link_vb: '', noi_goi_nhan: '', so_den: '', ngay_nhan: '', 
        bo_phan_xu_ly: '', han_xu_ly: '', trang_thai_xu_ly: 'Chờ xử lý',
        nguoi_ky: '', chuc_vu: '', nguoi_lay_so: '', bo_phan_lay_so: '', pham_vi_ap_dung: selectedUnitFilter || 'Toàn hệ thống', 
        hieu_luc: 'Còn hiệu lực', nghiep_vu: '', van_ban_thay_the: '', mat: false,
        msnv_lay_so: ''
      });
    }
    setIsModalOpen(true); setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị ban hành/lưu trữ!");
    if (formData.hieu_luc === 'Thay thế VB khác' && !formData.van_ban_thay_the) return toast.warning("Vui lòng dán Link văn bản bị thay thế!");
    
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'hieu_luc' && value !== 'Thay thế VB khác') {
      setFormData((prev: any) => ({ ...prev, [name]: value, van_ban_thay_the: '' }));
    } else if (name === 'msnv_lay_so') {
      const cleanVal = String(value || '').trim().toLowerCase();
      const matchedPerson = personnelList.find(
        (p) => String(p.ma_so_nhan_vien || '').trim().toLowerCase() === cleanVal
      );
      if (matchedPerson) {
        setFormData((prev: any) => ({
          ...prev,
          msnv_lay_so: value,
          nguoi_lay_so: matchedPerson.ho_ten || '',
          bo_phan_lay_so: matchedPerson.phong_ban || '',
        }));
      } else {
        setFormData((prev: any) => ({ ...prev, msnv_lay_so: value }));
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
    
    // Yêu cầu mở modal nếu chọn "Thay thế VB khác" để nhập link
    if (newStatus === 'Thay thế VB khác') {
      toast.warning("Vui lòng chọn nút 'Sửa' để cập nhật Link văn bản thay thế!");
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
            if(window.innerWidth < 768) setIsListCollapsed(true);
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
              <Bookmark size={20} /> Lọc & Phân loại
            </h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-[#05469B] bg-gray-100 md:bg-transparent md:hover:bg-blue-50 rounded-md transition-colors">
              <X size={18} className="md:hidden" />
              <PanelLeftClose size={18} className="hidden md:block" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg mb-4">
            <button 
              onClick={() => { setSelectedPhanLoai('Thông báo'); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
              className={`py-2 md:py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Thông báo' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}
            >
              T.Báo
            </button>
            <button 
              onClick={() => { setSelectedPhanLoai('Quyết định'); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
              className={`py-2 md:py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Quyết định' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}
            >
              Q.Định
            </button>
            
            {!isViewerHanChe && (
              <>
                <button 
                  onClick={() => { setSelectedPhanLoai('Công văn đến'); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
                  className={`py-2 md:py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Công văn đến' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}
                >
                  CV Đến
                </button>
                <button 
                  onClick={() => { setSelectedPhanLoai('Công văn đi'); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
                  className={`py-2 md:py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Công văn đi' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}
                >
                  CV Đi
                </button>
                <button 
                  onClick={() => { setSelectedPhanLoai('Tờ trình'); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
                  className={`py-2 md:py-1.5 text-xs font-bold rounded-md transition-all ${selectedPhanLoai === 'Tờ trình' ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}
                >
                  T.Trình
                </button>
              </>
            )}
            
            <button 
              onClick={() => { setSelectedPhanLoai(null); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
              className={`py-2 md:py-1.5 text-xs font-bold rounded-md transition-all ${!selectedPhanLoai ? 'bg-white text-[#05469B] shadow-sm' : 'text-gray-500 hover:text-[#05469B]'}`}
            >
              Tất cả
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
            onClick={() => { setSelectedUnitFilter(null); if(window.innerWidth < 768) setIsListCollapsed(true); }} 
            className={`w-full flex items-center gap-2 px-3 py-3 md:py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${selectedUnitFilter === null ? 'bg-blue-50 text-[#05469B] border border-blue-100' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <Building2 size={18} className={selectedUnitFilter === null ? 'text-[#05469B]' : 'text-gray-400'} /> Toàn Hệ Thống
          </button>
          <hr className="border-gray-100 mb-4 mx-2"/>

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
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:ml-10' : ''} shrink-0`}>
          <div className="w-full flex justify-between items-center">
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
                  <FileText className="w-6 h-6 md:w-7 md:h-7" /> Quản lý Văn bản
                </h2>
                <p className="text-sm font-medium text-gray-500 mt-1 hidden md:block">
                  Lọc: <span className="text-emerald-600 font-bold">{selectedPhanLoai || 'Tất cả'}</span> • Khu vực: <span className="text-emerald-600 font-bold">{selectedUnitName}</span>
                </p>
              </div>
            </div>

            {/* 🟢 Nút mở bộ lọc nhanh trên Mobile */}
            <button 
              onClick={() => setIsListCollapsed(false)} 
              className="md:hidden p-2.5 bg-blue-50 text-[#05469B] rounded-lg border border-blue-100 flex items-center gap-2 shadow-sm"
            >
              <Filter size={18}/> <span className="text-sm font-bold hidden sm:inline">Bộ lọc</span>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 items-stretch sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Tìm số hiệu, tiêu đề, nghiệp vụ..." 
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setIsFilterPopoverOpen(prev => !prev)}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold shadow-sm transition-all whitespace-nowrap
                  ${activeFiltersCount > 0 
                    ? 'bg-blue-50 text-[#05469B] border-blue-200' 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" />
                <span>Bộ lọc nâng cao</span>
                {activeFiltersCount > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 text-[10px] font-black text-white bg-red-500 rounded-full animate-pulse">
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
                      <h3 className="font-bold text-[#05469B] text-sm flex items-center gap-1.5"><Filter size={16}/> Lọc nâng cao</h3>
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
                          <option value="Thay thế VB khác">Thay thế VB khác</option>
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
            
            {/* 🟢 ẨN NÚT BAN HÀNH THEO MA TRẬN QUYỀN MỚI VÀ QUYỀN HẠN CHẾ */}
            {!isViewerHanChe && !advancedRules.includes('VB_HIDE_BTN') && (
              <button 
                onClick={() => openModal('create')} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5" /> 
                <span className="md:hidden">Ban hành văn bản mới</span>
                <span className="hidden md:inline">Ban hành</span>
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

        <div className={`bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 overflow-hidden transition-all duration-300 flex flex-col flex-1 ${isListCollapsed ? 'md:ml-10' : ''}`}>
          
          {/* 🟢 VIEW TRÊN PC: BẢNG EXCEL (Ẩn trên Mobile) */}
          <div className="hidden md:block overflow-x-auto w-full custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
                <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-3 w-36 bg-[#f8fafc]">Số hiệu / Phân loại</th>
                  <th className="py-3 px-3 w-[125px] bg-[#f8fafc]">Ngày Ban hành</th>
                  <th className="py-3 px-3 min-w-[250px] bg-[#f8fafc]">Tiêu đề & Nội dung</th>
                  <th className="py-3 px-3 w-44 bg-[#f8fafc]">Phạm vi áp dụng</th>
                  <th className="py-3 px-3 w-40 bg-[#f8fafc]">Người ký - Chức vụ</th>
                  <th className="py-3 px-3 w-28 bg-[#f8fafc]">Hiệu lực</th>
                  <th className="py-3 px-3 text-center w-28 bg-[#f8fafc]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
  {loading ? (
    <tr>
      <td colSpan={7} className="p-12 text-center text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />
        Đang tải dữ liệu...
      </td>
    </tr>
  ) : filteredDocs.length === 0 ? (
    <tr>
      <td colSpan={7} className="p-16 text-center text-gray-500">
        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-lg font-medium">Không tìm thấy văn bản phù hợp.</p>
      </td>
    </tr>
  ) : (
    paginatedDocs.map((item) => (
      <tr 
        key={item.id} 
        className={`transition-all duration-200 group ${item.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-50/80 opacity-60 hover:opacity-100 hover:bg-gray-100 grayscale-[20%]' : 'bg-white hover:bg-blue-50/50'}`}
      >
        {/* 1. Số hiệu / Phân loại (Đã có nhãn MỚI VÀ NGHIỆP VỤ) */}
        <td className="py-2.5 px-3">
          <div className="flex items-center flex-wrap gap-1 mb-1">
            <span className="font-black text-[#05469B] bg-blue-50 px-1.5 py-0.5 rounded text-[13px] leading-[15px] whitespace-nowrap border border-blue-100">{item.so_hieu}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">{item.phan_loai}</span>
            {isNewDocument(item.ngay_ban_hanh) && (
              <span className="text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded animate-pulse uppercase tracking-wider shrink-0">Mới</span>
            )}
          </div>
          {item.nghiep_vu && item.nghiep_vu.trim() !== '' && !/Chưa phân loại|Chưa PL|Trống/i.test(item.nghiep_vu.trim()) && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">{item.nghiep_vu}</span>
            </div>
          )}
        </td>

        {/* 2. Ngày ban hành */}
        <td className="py-2.5 px-3 text-xs font-medium text-gray-700">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-400 shrink-0"/> 
            {item.ngay_ban_hanh ? new Date(item.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}
          </div>
        </td>

        {/* 3. Tiêu đề & Nội dung */}
        <td className="py-2.5 px-3">
          <p className={`font-bold text-sm leading-tight ${isMatDocument(item.mat) ? 'text-red-700' : 'text-gray-800'}`}>{item.tieu_de}</p>
          <p className="text-[11px] text-gray-500 line-clamp-1 mb-1.5">{item.noi_dung}</p>
          {item.link_vb && (
            <a href={item.link_vb} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              <LinkIcon size={10}/> File đính kèm
            </a>
          )}
        </td>

        {/* 4. Phạm vi áp dụng (Khôi phục các khối màu) */}
        <td className="py-2.5 px-3">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                {item.pham_vi_ap_dung === 'Toàn hệ thống' && <span>🌍</span>}
                {donViMap[String(item.pham_vi_ap_dung)] || item.pham_vi_ap_dung}
             </div>
             <p className="text-[9px] text-gray-400 uppercase font-bold truncate">Từ: {donViMap[String(item.id_don_vi)] || item.id_don_vi}</p>
          </div>
        </td>

        {/* 5. Người ký - Chức vụ */}
        <td className="py-2.5 px-3">
          <div className="font-bold text-xs text-gray-800">{item.nguoi_ky ? normalizeSignerName(item.nguoi_ky) : '-'}</div>
          <div className="text-[10px] text-gray-500 font-semibold mt-0.5">{item.chuc_vu || '-'}</div>
        </td>

        {/* 6. Hiệu lực (Dropdown màu) */}
        <td className="py-2.5 px-3">
          <div className="relative group w-full max-w-[120px]">
            <select
              value={item.hieu_luc}
              disabled={!canEditOrDeleteDocument(item)}
              onChange={(e) => handleQuickUpdateStatus(item, e.target.value)}
              className={`w-full appearance-none pl-2 pr-5 py-1 rounded-md text-[10px] font-bold text-center border shadow-sm
                ${!canEditOrDeleteDocument(item) ? 'cursor-not-allowed opacity-80 ' : 'cursor-pointer '}
                ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border-green-200' : 
                  item.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-yellow-50 text-yellow-700 border-yellow-300'}`}
            >
              <option value="Còn hiệu lực">Còn hiệu lực</option>
              <option value="Hết hiệu lực">Hết hiệu lực</option>
              <option value="Thay thế VB khác">Thay thế VB khác</option>
            </select>
          </div>
        </td>

        {/* 7. Thao tác */}
        <td className="py-2.5 px-3 text-center">
          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="p-1.5 text-emerald-600" title="Xem chi tiết"><Eye size={14} /></button>
            {canEditOrDeleteDocument(item) && (
              <>
                <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600" title="Sửa văn bản"><Edit size={14} /></button>
                <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-red-600" title="Xóa văn bản"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        </td>
      </tr>
    ))
  )}
</tbody>
            </table>
          </div>

          {/* 🟢 VIEW TRÊN MOBILE: THẺ CARD DỌC (Ẩn trên PC) */}
          <div className="block md:hidden flex-1 overflow-y-auto pb-20 space-y-4">
            {loading ? (
              <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#05469B] mb-2" /> Đang tải...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-10 text-center text-gray-500"><FileText size={48} className="mx-auto text-gray-300 mb-4" /> Không tìm thấy văn bản.</div>
            ) : (
              paginatedDocs.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-4 rounded-2xl relative overflow-hidden active:scale-[0.98] transition-all duration-200
                    ${item.hieu_luc === 'Hết hiệu lực'
                      ? 'bg-gray-50 border border-gray-200 opacity-60 grayscale-[20%]'
                      : 'bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100'
                    }`}
                >
                  
                  {/* Đường kẻ màu bên trái thể hiện hiệu lực */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-emerald-500' : item.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-400' : 'bg-yellow-400'}`}></div>
                  
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="font-black text-[#05469B] bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100">{item.so_hieu}</span>
                      <span className="text-[9px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{item.phan_loai}</span>
                      {isMatDocument(item.mat) && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-red-200"><Lock size={10}/> MẬT</span>}
                      {item.nghiep_vu && item.nghiep_vu.trim() !== '' && !/Chưa phân loại|Chưa PL|Trống/i.test(item.nghiep_vu.trim()) && (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded uppercase border border-indigo-100">{item.nghiep_vu}</span>
                      )}
                    </div>
                  </div>

                  <div className="pl-2 mb-3">
                    <h3 className={`font-bold text-sm leading-snug mb-1.5 ${isMatDocument(item.mat) ? 'text-red-700' : 'text-gray-800'}`}>{item.tieu_de}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">{item.noi_dung}</p>
                    {(item.nguoi_ky || item.chuc_vu) && (
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold bg-gray-50/50 p-1.5 rounded-lg border border-gray-100 w-max">
                        <span className="text-gray-700">{item.nguoi_ky ? normalizeSignerName(item.nguoi_ky) : '-'}</span>
                        {item.chuc_vu && <span className="text-gray-400">({item.chuc_vu})</span>}
                      </div>
                    )}
                  </div>

                  <div className="pl-2 flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-100 pt-3">
                    <span className="flex items-center gap-1 font-bold bg-gray-50 px-2 py-1 rounded">
                      <Calendar size={12}/> 
                      {item.ngay_ban_hanh ? new Date(item.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}
                    </span>
                    <span className="truncate max-w-[50%] font-semibold text-right text-[#05469B]">
                      {donViMap[String(item.id_don_vi)] || item.id_don_vi}
                    </span>
                  </div>

                  {/* Nút thao tác trên Mobile */}
                  <div className="pl-2 flex gap-2 mt-3 pt-3 border-t border-gray-100 items-center">
                    {!canEditOrDeleteDocument(item) ? (
                      <div className="flex w-full items-center gap-2">
                        <span className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold border text-center truncate
                          ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border-green-200' :
                            item.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-yellow-50 text-yellow-700 border-yellow-300'}`}>
                          {item.hieu_luc || 'Còn hiệu lực'} (Chỉ xem)
                        </span>
                        <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg flex justify-center items-center border border-emerald-200"><Eye size={14}/></button>
                      </div>
                    ) : (
                      <>
                        <select
                          value={item.hieu_luc}
                          onChange={(e) => handleQuickUpdateStatus(item, e.target.value)}
                          className={`flex-1 py-2 px-1 rounded-lg text-[11px] font-bold border text-center outline-none cursor-pointer truncate
                            ${item.hieu_luc === 'Còn hiệu lực' ? 'bg-green-50 text-green-700 border-green-200' :
                              item.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-yellow-50 text-yellow-700 border-yellow-300'}`}
                        >
                          <option value="Còn hiệu lực">Còn hiệu lực</option>
                          <option value="Hết hiệu lực">Hết hiệu lực</option>
                          <option value="Thay thế VB khác">Thay thế...</option>
                        </select>
                        <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg flex justify-center items-center border border-emerald-200" title="Xem"><Eye size={14}/></button>
                        <button onClick={() => openModal('update', item)} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg flex justify-center items-center border border-blue-200" title="Sửa"><Edit size={14}/></button>
                        <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg flex justify-center items-center border border-red-200" title="Xóa"><Trash2 size={14}/></button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

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
                <FileText className="shrink-0" size={24}/> 
                <span className="truncate">{modalMode === 'create' ? 'Ban hành Văn bản / Thông báo Mới' : 'Cập nhật Văn bản'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors shrink-0">
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            
            {/* Form */}
            <form id="docForm" onSubmit={handleSave} className="p-4 md:p-6 overflow-y-auto overflow-x-hidden space-y-6 md:space-8 flex-1 custom-scrollbar w-full bg-white">
              
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
                      <option value="Thông báo">Thông báo</option>
                      <option value="Quyết định">Quyết định</option>
                      <option value="Tờ trình">Tờ trình</option>
                      <option value="Công văn đến">Công văn đến</option>
                      <option value="Công văn đi">Công văn đi</option>
                    </select>
                  </div>
                  <div className="md:col-span-1 min-w-0">
                    <label className="block text-[11px] font-bold text-red-600 mb-1">Độ khẩn *</label>
                    <select name="muc_do_khan" value={formData.muc_do_khan || 'Bình thường'} onChange={handleInputChange} className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500 font-bold ${formData.muc_do_khan === 'Hỏa tốc' ? 'text-red-700' : formData.muc_do_khan === 'Khẩn' ? 'text-orange-600' : 'text-gray-700'}`}>
                      <option value="Bình thường">Bình thường</option><option value="Khẩn">Khẩn</option><option value="Hỏa tốc">Hỏa tốc</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 min-w-0">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Số hiệu *</label>
                    <input type="text" required name="so_hieu" value={formData.so_hieu || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-black text-gray-800 tracking-wider" placeholder="VD: 123/TB-THaco..." />
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
              {formData.phan_loai !== 'Thông báo' && (
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
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Link File đính kèm (PDF / Drive)</label>
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
                        <label className="block text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1"><Zap size={14}/> Đơn vị / Người xử lý</label>
                        <CustomAutocomplete name="bo_phan_xu_ly" value={formData.bo_phan_xu_ly} onChange={handleInputChange} placeholder="Giao cho..." suggestions={suggestDonViXuLy} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1"><Clock size={14}/> Hạn xử lý (Deadline)</label>
                        <input type="date" name="han_xu_ly" value={formData.han_xu_ly || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[11px] font-bold text-orange-700 mb-1 flex items-center gap-1"><Send size={14}/> Trạng thái Xử lý</label>
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
                      <CustomAutocomplete name="msnv_lay_so" value={formData.msnv_lay_so || ''} onChange={handleInputChange} placeholder="VD: NV001..." suggestions={suggestMsnv} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div className="md:col-span-4 min-w-0">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Người lấy số</label>
                      <CustomAutocomplete name="nguoi_lay_so" value={formData.nguoi_lay_so} onChange={handleInputChange} placeholder="Nhân viên..." suggestions={suggestNguoilayso} onRemove={handleRemoveSuggestion} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
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
                      <select required name="hieu_luc" value={formData.hieu_luc || 'Còn hiệu lực'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]">
                        <option value="Còn hiệu lực">Còn hiệu lực</option>
                        <option value="Hết hiệu lực">Hết hiệu lực</option>
                        <option value="Thay thế VB khác">Thay thế VB khác</option>
                      </select>
                    </div>

                    {formData.hieu_luc === 'Thay thế VB khác' && (
                      <div className="md:col-span-10 bg-orange-50 p-4 rounded-lg border border-orange-300 mt-2 min-w-0 animate-in fade-in zoom-in duration-200">
                        <label className="block text-[11px] font-bold text-orange-800 mb-1">Link Văn bản bị thay thế (Dán link vào đây) *</label>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" size={16} />
                          <input type="url" required name="van_ban_thay_the" value={formData.van_ban_thay_the || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2.5 border border-orange-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500 text-blue-600 text-sm font-medium break-all" placeholder="Dán link Google Drive của văn bản cũ..." />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </form>
            
            <div className="p-4 md:p-5 border-t border-gray-100 flex flex-col-reverse md:flex-row justify-end gap-3 mt-auto shrink-0 bg-white pb-8 md:pb-5">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="w-full md:w-auto px-8 py-3.5 md:py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm"
              >
                Hủy
              </button>
              <button 
                type="submit" 
                form="docForm" 
                disabled={submitting} 
                className="w-full md:w-auto px-8 py-3.5 md:py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Văn Bản
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🟢 MODAL XEM CHI TIẾT (ĐÃ XỬ LÝ KHUNG TRÀN BỀ NGANG / BỀ DỌC TRÊN MOBILE) */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-h-[92vh] md:max-h-[90vh] md:h-auto md:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in duration-200 overflow-hidden mt-auto md:mt-0">
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-3xl md:rounded-t-2xl shrink-0">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 truncate pr-2">
                <FileText className="shrink-0" size={24}/> 
                <span className="truncate">Chi tiết Văn bản</span>
              </h3>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {viewData.link_vb && (
                  <a href={viewData.link_vb} target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors border border-white/20">
                    <ExternalLink size={16}/> Mở file
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
                  
                  <span className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border ${viewData.hieu_luc === 'Còn hiệu lực' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : viewData.hieu_luc === 'Hết hiệu lực' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                    {viewData.hieu_luc}
                  </span>
                </div>
                <h2 className={`text-lg md:text-3xl font-black leading-tight mt-3 md:mt-4 break-words ${isMatDocument(viewData.mat) ? 'text-red-700' : 'text-gray-800'}`}>{viewData.tieu_de}</h2>
                <p className="text-xs md:text-sm text-gray-500 mt-3 flex items-center gap-2">
                  <Calendar size={14} className="md:w-4 md:h-4"/> Ban hành: <span className="font-bold text-gray-700">{viewData.ngay_ban_hanh ? new Date(viewData.ngay_ban_hanh).toLocaleDateString('vi-VN') : '-'}</span>
                </p>
              </div>

              <div className="mb-6 md:mb-8">
                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FileText size={18}/> Trích yếu nội dung:</h4>
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

              {viewData.phan_loai !== 'Thông báo' && (
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
                     <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-1.5"><PenTool size={14} className="text-blue-500 shrink-0"/> Người ký</span>
                     <p className="font-black text-gray-800 text-sm md:text-base truncate">{viewData.nguoi_ky || '---'}</p>
                     <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-bold truncate">{viewData.chuc_vu || '---'}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-3 md:p-4 rounded-xl border border-emerald-100/50 flex flex-col justify-center min-w-0">
                     <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-1.5"><Hash size={14} className="text-emerald-500 shrink-0"/> Lấy số bởi</span>
                     <p className="font-black text-gray-800 text-sm md:text-base truncate">{viewData.nguoi_lay_so || '---'}</p>
                     <p className="text-[10px] text-gray-500 uppercase mt-0.5 font-bold truncate">{viewData.bo_phan_lay_so || '---'}</p>
                  </div>
                  <div className="bg-orange-50/50 p-3 md:p-4 rounded-xl border border-orange-100/50 flex flex-col justify-center items-start min-w-0">
                     <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 uppercase mb-2"><Layers size={14} className="text-orange-500 shrink-0"/> Phân loại Nghiệp vụ</span>
                     <span className="font-black text-[#05469B] text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 bg-white rounded border border-[#05469B]/20 shadow-sm truncate max-w-full">{viewData.nghiep_vu || '---'}</span>
                  </div>
                </div>
              </div>

              {(viewData.phan_loai === 'Công văn đến' || viewData.phan_loai === 'Tờ trình') && (
                <div className="mb-6 p-4 md:p-5 rounded-xl md:rounded-2xl border border-orange-200 bg-orange-50/50 shadow-sm flex flex-col">
                  <h4 className="text-xs md:text-sm font-bold text-orange-800 mb-3 md:mb-4 flex items-center gap-2 uppercase tracking-wider"><Clock size={16} className="md:w-5 md:h-5"/> Theo dõi Xử lý</h4>
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
                    <ExternalLink size={18} className="md:w-5 md:h-5"/> Mở File Văn Bản
                  </a>
                )}
                {viewData.hieu_luc === 'Thay thế VB khác' && viewData.van_ban_thay_the && (
                  <a href={viewData.van_ban_thay_the} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3.5 md:py-4 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base">
                    <ExternalLink size={18} className="md:w-5 md:h-5"/> Xem Văn bản bị thay thế
                  </a>
                )}
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