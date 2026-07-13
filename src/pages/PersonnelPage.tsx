import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  Users, ShieldCheck, Flame, LifeBuoy, Heart, Activity, 
  Dumbbell, Car, Utensils, Coffee, Languages, Monitor, Copy, Eye, EyeOff, User as UserIcon, 
  Building2, Phone, Mail, Info, MapPin, ChevronDown, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen, CheckCheck, Briefcase,
  LogOut, AlertTriangle, Image as ImageIcon, RotateCcw, Download, FileSpreadsheet, ClipboardPaste,
  BarChart3, PieChart as PieChartIcon, TrendingUp, Cake, Filter, Layers, Tag, Sparkles, Wrench, Settings2, UserPlus
} from 'lucide-react';
import { apiService } from '../services/api';
import { Personnel, DonVi, ThietBi } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getAllSubordinateIds } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import { formatPhoneNumber, getDirectImageLink, formatCurrencySpace as formatCurrency, toUnaccented, stripAccents } from '../utils/formatters';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import PersonnelModal from '../components/personnel/PersonnelModal';
import { CERTIFICATES } from '../constants/certificates';

const extractStartDateFromMaNV = (maNV: string) => {
  if (!maNV || maNV.length < 4) return null;
  const yy = maNV.substring(0, 2);
  const mm = maNV.substring(2, 4);
  const monthNum = parseInt(mm, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return null;
  const fullYear = parseInt(yy, 10) > 50 ? `19${yy}` : `20${yy}`; 
  return `${fullYear}-${mm}-01`; 
};

export default function PersonnelPage() {
  const { user } = useAuth();
  const hasRule = (ruleId: string) => {
    if (!user) return false;
    if (String(user.quyen).toUpperCase() === 'ADMIN') return false;
    return String(user.quyen_chi_tiet || '').includes(ruleId);
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
  const [filterPhanLoai, setFilterPhanLoai] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);
  const [isAddNewExpanded, setIsAddNewExpanded] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<'info' | 'stats'>('info');

  const [modal, setModal] = useState<{ isOpen: boolean; mode: 'create' | 'update'; formData: any; }>({ isOpen: false, mode: 'create', formData: {} });
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any | null>(null);
  const [showNgachLuong, setShowNgachLuong] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const phanLoaiSuggestions = useMemo(() => {
    const list = data.map(p => String(p.phan_loai || '').trim()).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [data]);



  const [isOffboardOpen, setIsOffboardOpen] = useState(false);
  const [personnelToOffboard, setPersonnelToOffboard] = useState<any | null>(null);
  const [unreturnedAssets, setUnreturnedAssets] = useState<any[]>([]);
  const [forceOffboard, setForceOffboard] = useState(false);
  const [checkingAssets, setCheckingAssets] = useState(false);

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



  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [nsResult, dvResult] = await Promise.all([apiService.getPersonnel(), apiService.getDonVi()]);
      setData(nsResult); setDonViList(dvResult);
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu.'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[String(dv.id)] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const getFullUnitName = (unitId: string): string => {
    const parts: string[] = [];
    let currentId = unitId;
    let iterations = 0;
    while (currentId && iterations < 10) {
      const dv = donViList.find(item => String(item.id) === String(currentId));
      if (!dv) break;
      parts.push(dv.ten_don_vi);
      currentId = dv.cap_quan_ly;
      iterations++;
    }
    return parts.reverse().join(' ➜ ');
  };

  const allowedDonViIds = useAllowedUnits(donViList);

  const calculateSeniority = (startDate: string, trangThai: string, endDate: string) => {
    if (!startDate) return 'Chưa có';
    const start = new Date(startDate);
    const end = (trangThai === 'Đã nghỉ việc' && endDate) ? new Date(endDate) : new Date();
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years === 0 && months === 0) return 'Mới nhận việc';
    if (years === 0) return `${months} tháng`;
    return `${years} năm ${months} tháng`;
  };

  const filteredUnits = useMemo(() => {
    let baseUnits = donViList.filter(dv => allowedDonViIds.includes(dv.id));
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



  const selectedUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViList]);

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
      (!filterPhanLoai || String(item.phan_loai || '').trim() === filterPhanLoai)
    );
    const listForKhoi = base.filter(item => 
      (!filterPhongBan || String(item.phong_ban || '').trim() === filterPhongBan) &&
      (!filterChucVu || String(item.chuc_vu || '').trim() === filterChucVu) &&
      (!filterPhanLoai || String(item.phan_loai || '').trim() === filterPhanLoai)
    );
    const listForChucVu = base.filter(item => 
      (!filterPhongBan || String(item.phong_ban || '').trim() === filterPhongBan) &&
      (!filterKhoi || String(item.khoi || '').trim() === filterKhoi) &&
      (!filterPhanLoai || String(item.phan_loai || '').trim() === filterPhanLoai)
    );
    const listForPhanLoai = base.filter(item => 
      (!filterPhongBan || String(item.phong_ban || '').trim() === filterPhongBan) &&
      (!filterKhoi || String(item.khoi || '').trim() === filterKhoi) &&
      (!filterChucVu || String(item.chuc_vu || '').trim() === filterChucVu)
    );

    return {
      phongBanList: getUnique('phong_ban', listForPhongBan),
      khoiList: getUnique('khoi', listForKhoi),
      chucVuList: getUnique('chuc_vu', listForChucVu),
      phanLoaiList: getUnique('phan_loai', listForPhanLoai),
    };
  }, [data, allowedDonViIds, selectedUnitFilter, selectedUnitSubordinates, filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai]);

  // LỌC DANH SÁCH NHÂN SỰ CHUNG
  const filteredPersonnel = useMemo(() => {
    let result = data.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) result = result.filter(item => selectedUnitSubordinates.includes(item.id_don_vi));
    
    if (personnelSearchTerm) {
      const cleanSearch = stripAccents(personnelSearchTerm);
      const digitsSearch = personnelSearchTerm.replace(/\D/g, '');
      
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
    if (filterPhanLoai) {
      const cleanVal = stripAccents(filterPhanLoai);
      result = result.filter(item => stripAccents(item.phan_loai || '').includes(cleanVal));
    }

    const phanLoaiOrder: Record<string, number> = {
      'Lãnh đạo': 1, 'Chủ tịch': 2, 'Tổng Giám đốc': 3, 'Phó Tổng Giám đốc': 4,
      'Giám đốc': 5, 'Phó Giám đốc': 6, 'Trưởng phòng': 7, 'Trưởng bộ phận': 8, 'Phó phòng': 9,
      'Trợ lý': 10, 'Trưởng nhóm': 11, 'Tổ trưởng': 12, 'Tổ phó': 13,
      'Chuyên viên': 14, 'PT DVHT KD': 14, 'PT DVHC': 15, 'PT NS': 16,
      'BV, ĐTKH': 17, 'Nhân viên': 18, 'Chưa phân loại': 99
    };

    return result.sort((a, b) => {
      if (a.trang_thai === 'Đã nghỉ việc' && b.trang_thai !== 'Đã nghỉ việc') return 1;
      if (a.trang_thai !== 'Đã nghỉ việc' && b.trang_thai === 'Đã nghỉ việc') return -1;
      const orderA = phanLoaiOrder[a.phan_loai || ''] || 99;
      const orderB = phanLoaiOrder[b.phan_loai || ''] || 99;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB; 
    });
  }, [data, personnelSearchTerm, selectedUnitFilter, allowedDonViIds, donViMap, selectedUnitSubordinates, filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai]);

  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  const showSelectCheckboxes = useMemo(() => {
    return showAdvancedFilters && (
      filterPhongBan !== '' || 
      filterKhoi !== '' || 
      filterChucVu !== '' || 
      filterPhanLoai !== ''
    );
  }, [showAdvancedFilters, filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai]);

  useEffect(() => {
    if (!showSelectCheckboxes) {
      setSelectedPersonnelIds([]);
    }
  }, [showSelectCheckboxes]);

  const isAllSelected = useMemo(() => {
    if (filteredPersonnel.length === 0) return false;
    return filteredPersonnel.every(p => selectedPersonnelIds.includes(p.id));
  }, [filteredPersonnel, selectedPersonnelIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filteredIds = filteredPersonnel.map(p => p.id);
      setSelectedPersonnelIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    } else {
      const filteredIds = filteredPersonnel.map(p => p.id);
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

  // 🟢 LOGIC TÍNH TOÁN CÁC BIỂU ĐỒ & KPI
  // =================================================================================
  // 🟢 THUẬT TOÁN KHỬ TRÙNG LẶP: 1 MÃ NV = 1 HEADCOUNT THỰC TẾ (Ưu tiên vai trò chính)
  // =================================================================================
  const uniqueActiveStaff = useMemo(() => {
    const active = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc');
    const seen = new Set<string>();
    const unique: any[] = [];
    
    // Sắp xếp: Ưu tiên record KHÔNG chứa chữ "Kiêm nhiệm" lên đầu để làm record gốc
    const sortedActive = [...active].sort((a, b) => {
      const aKiem = String(a.chuc_vu || '').includes('Kiêm nhiệm') ? 1 : 0;
      const bKiem = String(b.chuc_vu || '').includes('Kiêm nhiệm') ? 1 : 0;
      return aKiem - bKiem;
    });

    for (const p of sortedActive) {
      const maNV = String(p.ma_so_nhan_vien || '').toLowerCase().trim();
      if (!maNV) {
        unique.push(p); // Nếu vô tình không có mã NV thì vẫn tính
      } else if (!seen.has(maNV)) {
        seen.add(maNV); // Ghi nhớ mã NV này đã được đếm
        unique.push(p);
      }
    }
    return unique;
  }, [filteredPersonnel]);

  // =================================================================================
  // 🟢 LOGIC TÍNH TOÁN CÁC BIỂU ĐỒ & KPI CHO TAB THỐNG KÊ (Dùng List đã khử trùng)
  // =================================================================================
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

  // =================================================================================
  // 🟢 LOGIC TÍNH TOÁN BẢNG CHÉO BẢO VỆ / PVHC (Dùng List đã khử trùng)
  // =================================================================================


  // =================================================================================
  // 🟢 1. LOGIC BẢNG CHÉO BẢO VỆ / PVHC (Đã tích hợp Danh sách Hover)
  // =================================================================================
  const crossTabStats = useMemo(() => {
    const calcStatsForIds = (ids: string[]) => {
      const staff = uniqueActiveStaff.filter(p => ids.includes(p.id_don_vi));
      let bv_nv = 0, bv_tt_tp = 0, pvhc_nv = 0, pvhc_tt_tp = 0;
      let l_bv_nv: any[] = [], l_bv_tt_tp: any[] = [], l_pvhc_nv: any[] = [], l_pvhc_tt_tp: any[] = [];
      
      staff.forEach(p => {
        const bp = String(p.phong_ban || '').toLowerCase();
        const pl = String(p.phan_loai || '').toLowerCase(); 
        
        const isBV = bp.includes('bv') || bp.includes('bảo vệ') || bp.includes('đón tiếp') || pl.includes('bv, đtkh');
        const isPVHC = bp.includes('pvhc') || bp.includes('hành chính') || bp.includes('hcns') || pl.includes('pt dvhc');
        
        if (isBV) {
          if (pl.includes('tổ trưởng') || pl.includes('tổ phó') || pl.includes('trưởng nhóm')) { bv_tt_tp++; l_bv_tt_tp.push(p); } 
          else { bv_nv++; l_bv_nv.push(p); }
        } else if (isPVHC) {
          if (pl.includes('tổ trưởng') || pl.includes('tổ phó') || pl.includes('trưởng nhóm')) { pvhc_tt_tp++; l_pvhc_tt_tp.push(p); } 
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

  // =================================================================================
  // 🟢 2. LOGIC BẢNG CƠ CẤU BỘ PHẬN & CHỨC DANH (Đã tích hợp Danh sách Hover)
  // =================================================================================
  const deptTabStats = useMemo(() => {
    const deptMap: Record<string, Record<string, number>> = {};
    const deptListMap: Record<string, Record<string, any[]>> = {};
    const phanLoaiSet = new Set<string>();

    uniqueActiveStaff.forEach(p => {
      const pb = p.phong_ban?.trim() || 'Chưa phân bổ';
      const pl = p.phan_loai?.trim() || 'Chưa phân loại';
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

//🟢 PHẦN 2: CÁC HÀM XỬ LÝ SỰ KIỆN (Thêm/Sửa/Xóa/Excel)

  // 🟢 LOGIC PHÂN TRANG (PAGINATION)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | string>(100);

  const actualRowsPerPage = typeof rowsPerPage === 'number' && rowsPerPage > 0 ? rowsPerPage : 100;
  const totalPages = Math.ceil(filteredPersonnel.length / actualRowsPerPage) || 1;

  useEffect(() => { setCurrentPage(1); }, [selectedUnitFilter, personnelSearchTerm, filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai]);

  const paginatedPersonnel = useMemo(() => {
    const startIndex = (currentPage - 1) * actualRowsPerPage;
    return filteredPersonnel.slice(startIndex, startIndex + actualRowsPerPage);
  }, [filteredPersonnel, currentPage, actualRowsPerPage]);

  const handleCopyMail = (roleType: 'LD' | 'DVHT' | 'NS') => {
    let emails: string[] = [];
    filteredPersonnel.forEach(p => {
      if (!p.email || p.trang_thai === 'Đã nghỉ việc') return;
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
    if (item) { setModal({ isOpen: true, mode, formData: { ...item } }); } 
    else { setModal({ isOpen: true, mode, formData: { id_don_vi: selectedUnitFilter || '' } }); }
    setError(null);
  };

  const handleView = (item: any) => { 
    if (hasRule('NS_NO_DETAIL')) {
      toast.warning("Bạn không có quyền xem chi tiết hồ sơ nhân sự này!");
      return;
    }
    setViewData(item); 
    setShowNgachLuong(false); 
    setIsViewModalOpen(true); 
  };

  const handleDuplicate = (item: any) => {
    setModal({ isOpen: true, mode: 'create', formData: { ...item, id: '', chuc_vu: item.chuc_vu ? `${item.chuc_vu} (Kiêm nhiệm)` : 'Kiêm nhiệm', trang_thai: 'Đang làm việc', ngay_nghi_viec: '' } });
    setError(null);
  };

  // 🟢 HÀM LƯU DỮ LIỆU BẰNG TAY (THÊM / SỬA)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị công tác!");
    
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

    if (!finalDataToSave.ngay_nhan_vien && finalDataToSave.ma_so_nhan_vien) { finalDataToSave.ngay_nhan_vien = extractStartDateFromMaNV(finalDataToSave.ma_so_nhan_vien); }
    if(!finalDataToSave.nam_sinh) finalDataToSave.nam_sinh = null;
    if(!finalDataToSave.ngay_nhan_vien) finalDataToSave.ngay_nhan_vien = null;
    if(!finalDataToSave.ngay_nghi_viec) finalDataToSave.ngay_nghi_viec = null;
    if(!finalDataToSave.ngay_vao_lam_lai) finalDataToSave.ngay_vao_lam_lai = null;

    // 🟢 TỰ ĐỘNG CHUẨN HOÁ TÊN CHỨNG NHẬN ATVSLĐ TRƯỚC KHI LƯU DB
    if (finalDataToSave.nhom_doi_tuong) {
      const nhom = String(finalDataToSave.nhom_doi_tuong);
      if (nhom === '1' || nhom === '2' || nhom === '6') finalDataToSave.chung_nhan = 'Giấy chứng nhận huấn luyện ATVSLĐ';
      else if (nhom === '3') finalDataToSave.chung_nhan = 'Thẻ An toàn lao động';
      else if (nhom === '4') finalDataToSave.chung_nhan = 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';
      
      finalDataToSave.cc_atvsld = true; // Bắt buộc bật cờ có chứng chỉ
    } else {
      finalDataToSave.chung_nhan = null;
    }

    setSubmitting(true); setError(null);
    try {
      const response = await apiService.save(finalDataToSave, modal.mode, "ns_dich_vu");
      const currentId = response.id || response.newId || finalDataToSave.id || `NS-${Date.now()}`;
      finalDataToSave.id = currentId;

      if (modal.mode === 'update' && finalDataToSave.ma_so_nhan_vien) {
        const kiemNhiemList = data.filter(item => item.ma_so_nhan_vien === finalDataToSave.ma_so_nhan_vien && item.id !== currentId);
        if (kiemNhiemList.length > 0) {
          const fieldsToExclude = ['id', 'id_don_vi', 'phong_ban', 'chuc_vu', 'phan_loai', 'ngach_luong', 'thu_nhap', 'trang_thai', 'ngay_nghi_viec', 'ngay_vao_lam_lai'];
          const syncData: any = {};
          Object.keys(finalDataToSave).forEach(key => { if (!fieldsToExclude.includes(key)) syncData[key] = finalDataToSave[key]; });
          for (const kn of kiemNhiemList) {
            const updatedKN = { ...kn, ...syncData };
            await apiService.save(updatedKN, 'update', "ns_dich_vu");
            setData(prev => prev.map(item => item.id === updatedKN.id ? updatedKN : item));
          }
          toast.success(`Đã tự động đồng bộ thông tin cho ${kiemNhiemList.length} vị trí kiêm nhiệm!`);
        }
      }

      if (modal.mode === 'create') { setData(prev => [...prev, finalDataToSave]); } 
      else { setData(prev => prev.map(item => item.id === finalDataToSave.id ? finalDataToSave : item)); }
      
      setModal(prev => ({ ...prev, isOpen: false }));  
      toast.success(modal.mode === 'create' ? "Thêm mới thành công!" : "Cập nhật thành công!");
    } catch (err: any) { setError(err.message || 'Lỗi lưu dữ liệu.'); toast.error(err.message || "Đã xảy ra lỗi!"); } 
    finally { setSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true); setError(null);
    try {
      await apiService.delete(itemToDelete, "ns_dich_vu");
      setData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsConfirmOpen(false); setItemToDelete(null); toast.success("Xóa thành công!");
    } catch (err: any) { setError(err.message || 'Lỗi xóa dữ liệu.'); toast.error(err.message || "Đã xảy ra lỗi!"); } 
    finally { setSubmitting(false); }
  };

  const handleConfirmRehire = async () => {
    if (!personnelToRehire) return;
    setSubmitting(true);
    try {
      const rehireData = { ...personnelToRehire, trang_thai: 'Đang làm việc', ngay_vao_lam_lai: rehireDate, ngay_nghi_viec: null };
      await apiService.save(rehireData, "update", "ns_dich_vu");
      setData(prev => prev.map(item => item.id === personnelToRehire.id ? rehireData : item));
      setIsRehireModalOpen(false); setPersonnelToRehire(null);
    } catch (err: any) { alert("Lỗi: " + err.message); } finally { setSubmitting(false); }
  };

  const handleOffboardClick = async (item: any) => {
    setPersonnelToOffboard(item); setCheckingAssets(true); setForceOffboard(false); setIsOffboardOpen(true); setUnreturnedAssets([]);
    try {
      const [thietBiRaw, nhatKyRaw] = await Promise.all([apiService.getThietBi(), apiService.getNhatKyThietBi()]);
      const thietBiList: ThietBi[] = thietBiRaw || []; const nhatKyList: any[] = nhatKyRaw || [];
      const latestLogsMap: Record<string, any> = {};
      nhatKyList.forEach(log => {
        const ttbId = log.id_ts_thiet_bi;
        if (!latestLogsMap[ttbId] || new Date(log.ngay_ghi_nhan).getTime() > new Date(latestLogsMap[ttbId].ngay_ghi_nhan).getTime()) {
          latestLogsMap[ttbId] = log;
        }
      });
      const foundAssets: any[] = [];
      Object.values(latestLogsMap).forEach(log => {
        if (log.msnv_nguoi_dung === item.ma_so_nhan_vien && log.loai_nhat_ky !== 'Báo hỏng') {
          const assetInfo = thietBiList.find(tb => tb.id === log.id_ts_thiet_bi);
          if (assetInfo) foundAssets.push({ id: assetInfo.ma_tai_san || assetInfo.id, name: assetInfo.ten_thiet_bi, group: assetInfo.nhom_thiet_bi, sn: assetInfo.so_seri || '-', date: new Date(log.ngay_ghi_nhan).toLocaleDateString('vi-VN') });
        }
      });
      setUnreturnedAssets(foundAssets);
    } catch (err) { alert("Cảnh báo: Không thể kiểm tra CSDL Tài sản."); setIsOffboardOpen(false); } 
    finally { setCheckingAssets(false); }
  };

  const confirmOffboard = async () => {
    if (!personnelToOffboard) return;
    if (unreturnedAssets.length > 0 && !forceOffboard) { alert("Vui lòng xử lý tài sản!"); return; }
    setSubmitting(true);
    try {
      const offboardData = { ...personnelToOffboard, trang_thai: 'Đã nghỉ việc', ngay_nghi_viec: new Date().toISOString().split('T')[0] };
      await apiService.save(offboardData, "update", "ns_dich_vu");
      setData(prev => prev.map(item => item.id === personnelToOffboard.id ? offboardData : item));
      setIsOffboardOpen(false); setPersonnelToOffboard(null);
    } catch (err: any) { alert("Lỗi: " + err.message); } finally { setSubmitting(false); }
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
      const unitStaff = data.filter(p => validIds.includes(p.id_don_vi) && p.trang_thai !== 'Đã nghỉ việc');
      const dvht = unitStaff.find(p => p.phan_loai === 'PT QTVP & ASĐS' || p.phan_loai === 'PT QTVT & ASĐS' || p.phan_loai === 'PT DVHT KD' || String(p.chuc_vu).toLowerCase().includes('dvht') || String(p.chuc_vu).toLowerCase().includes('qtvp')) || {};
      const tgd = unitStaff.find(p => p.phan_loai === 'Lãnh đạo' || String(p.chuc_vu).toLowerCase().includes('tổng giám đốc') || String(p.chuc_vu).toLowerCase().includes('giám đốc')) || {};
      if (!dvht.ho_ten && !tgd.ho_ten && unitStaff.length === 0) return; 
      rowsHTML += `<tr><td class="center">${stt++}</td><td>${phia}</td><td class="bold">${tenDV}</td><td>${dvht.ho_ten || ''}</td><td>${dvht.email || ''}</td><td class="center">${dvht.sdt_cong_ty || dvht.sdt_ca_nhan ? formatPhoneNumber(dvht.sdt_cong_ty || dvht.sdt_ca_nhan) : ''}</td><td>${tgd.ho_ten || ''}</td><td>${tgd.email || ''}</td><td class="center">${tgd.sdt_cong_ty || tgd.sdt_ca_nhan ? formatPhoneNumber(tgd.sdt_cong_ty || tgd.sdt_ca_nhan) : ''}</td></tr>`;
    });
    const tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; font-family: 'Times New Roman', serif; } th, td { border: 1px solid #000000; padding: 6px; vertical-align: middle; } .header { background-color: #fff2cc; color: #002060; font-weight: bold; text-align: center; } .center { text-align: center; } .bold { font-weight: bold; color: #002060; }</style></head><body><table><thead><tr class="header"><th rowspan="2">STT</th><th rowspan="2">Phía</th><th rowspan="2" style="width: 250px;">ĐƠN VỊ</th><th colspan="3">PT DVHT KD</th><th colspan="3">TỔNG GIÁM ĐỐC</th></tr><tr class="header"><th>Họ và tên</th><th>Email</th><th>SĐT</th><th>Họ và tên</th><th>Email</th><th>SĐT</th></tr></thead><tbody>${rowsHTML}</tbody></table></body></html>`;
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `Danh_Ba_Lanh_Dao_DVHT_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    setIsExportModalOpen(false); toast.success("Đã xuất file Danh bạ (Excel) thành công!");
  };
  
  // 🟢 HÀM XỬ LÝ IMPORT EXCEL (ĐÃ CẬP NHẬT CHUẨN HOÁ TÊN CHỨNG NHẬN)
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
            else if (char === '\r') {} else { currentCell += char; }
          }
        }
        if (currentCell !== '' || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
        
        const formatExcelDate = (dateStr: string) => {
          if (!dateStr) return ''; const parts = dateStr.split(/[\/\-.]/); 
          if (parts.length === 3) { let d = parts[0].padStart(2, '0'); let m = parts[1].padStart(2, '0'); let y = parts[2]; if (y.length === 2) y = '20' + y; return `${y}-${m}-${d}`; }
          return dateStr;
        };

        const parsedData = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]; if (row.length < 3) continue; 
          const checkHeader2 = toUnaccented(row[1] || ''); const checkHeader3 = toUnaccented(row[2] || '');
          if (checkHeader2.includes('ma') || checkHeader3.includes('ten')) continue; 
          
          const maNV = row[1]?.trim() || ''; 
          const excelDate = formatExcelDate(row[12]?.trim());
          
          let rawNhom = row[16]?.trim() || '';
          const nhomNum = rawNhom.replace(/\D/g, ''); 
          
          const hlTu = formatExcelDate(row[17]?.trim());
          const hlDen = formatExcelDate(row[18]?.trim());
          let giaTriDen = formatExcelDate(row[19]?.trim());

          // 🟢 BỔ SUNG LẤY DỮ LIỆU CỘT 21 VÀ 22
          const khoiVal = row[20]?.trim() || ''; // Cột 21 (Khối)
          const diaDiemVal = row[21]?.trim() || ''; // Cột 22 (Địa điểm làm việc)

          if (!giaTriDen && hlDen && nhomNum) {
            const denDate = new Date(hlDen);
            if (!isNaN(denDate.getTime())) {
              let yearsToAdd = 0;
              if (nhomNum === '1' || nhomNum === '2') { yearsToAdd = 2; } else if (nhomNum === '3' || nhomNum === '4' || nhomNum === '6') { yearsToAdd = 1; }
              if (yearsToAdd > 0) {
                denDate.setFullYear(denDate.getFullYear() + yearsToAdd);
                const yyyy = denDate.getFullYear(); const mm = String(denDate.getMonth() + 1).padStart(2, '0'); const dd = String(denDate.getDate()).padStart(2, '0');
                giaTriDen = `${yyyy}-${mm}-${dd}`;
              }
            }
          }

          let certName = '';
          if (nhomNum === '1' || nhomNum === '2' || nhomNum === '6') certName = 'Giấy chứng nhận huấn luyện ATVSLĐ';
          else if (nhomNum === '3') certName = 'Thẻ An toàn lao động';
          else if (nhomNum === '4') certName = 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';

          parsedData.push({
            ma_so_nhan_vien: maNV, ho_ten: row[2]?.trim() || '', chuc_vu: row[3]?.trim() || '', phong_ban: row[4]?.trim() || '', 
            phan_loai: row[8]?.trim() || 'Nhân viên', sdt_cong_ty: row[9]?.trim() || '', gioi_tinh: row[10]?.trim() || '', 
            nam_sinh: formatExcelDate(row[11]?.trim()), ngay_nhan_vien: excelDate ? excelDate : extractStartDateFromMaNV(maNV),
            sdt_ca_nhan: row[13]?.trim() || '', email: row[14]?.trim() || '', ngach_luong: row[15]?.trim() || '', id_don_vi: selectedUnitFilter || '',
            nhom_doi_tuong: nhomNum, huan_luyen_tu: hlTu, huan_luyen_den: hlDen, gia_tri_den: giaTriDen,
            chung_nhan: certName, cc_atvsld: (nhomNum || hlTu || giaTriDen) ? true : false,
            // 🟢 TRUYỀN VÀO OBJECT LƯU LÊN SUPABASE
            khoi: khoiVal,
            dia_diem_lam_viec: diaDiemVal
          });
        }
        setBulkImportData(parsedData.filter(d => d.ma_so_nhan_vien && d.ho_ten));
        toast.success(`Đã nhận diện ${parsedData.length} nhân sự!`);
      } catch (err) { toast.error('Lỗi phân tích dữ liệu!'); } finally { setIsAnalyzingBulk(false); }
    }, 100);
  };

  const confirmBulkSave = async () => {
    if (bulkImportData.length === 0) return;
    setSubmitting(true);
    try {
      let updatedState = [...data]; let createCount = 0; let updateCount = 0;
      for (const item of bulkImportData) {
        const existingIndex = updatedState.findIndex(d => String(d.ma_so_nhan_vien).toLowerCase() === String(item.ma_so_nhan_vien).toLowerCase());
        if (existingIndex >= 0) {
          const mergedData: any = { ...updatedState[existingIndex] };
          Object.keys(item).forEach(key => { if (item[key] !== undefined && item[key] !== '') { mergedData[key] = item[key]; } });
          mergedData.trang_thai = 'Đang làm việc'; mergedData.ngay_nghi_viec = null;
          await apiService.save(mergedData, 'update', 'ns_dich_vu');
          updatedState[existingIndex] = mergedData; updateCount++;
        } else {
          const newData = { ...item, id: `NS-${Date.now()}-${Math.floor(Math.random() * 1000)}`, trang_thai: 'Đang làm việc' };
          if (!newData.gioi_tinh) newData.gioi_tinh = 'Nam';
          await apiService.save(newData, 'create', 'ns_dich_vu');
          updatedState.push(newData); createCount++;
        }
      }
      setData(updatedState); toast.success(`Thành công! Tạo mới ${createCount}, Cập nhật ${updateCount}.`);
      setIsBulkImportOpen(false); setBulkImportData([]); setBulkImportText('');
    } catch (err) { toast.error("Lỗi lưu dữ liệu hàng loạt!"); } finally { setSubmitting(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    let value: string | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    if (name === 'thu_nhap') { value = (value as string).replace(/\D/g, ''); }
    setModal(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
  };

  //🟢 PHẦN 3: GIAO DIỆN BỘ LỌC VÀ TAB DANH SÁCH (info)

  // =================================================================================
  // 🟢 LOGIC NÚT COPY EMAIL TỔNG HỢP (Gộp nút Copy, Lọc kết hợp)
  // =================================================================================
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

  // Xử lý Copy các Nút tĩnh (Lãnh đạo, PT NS...)
  const handleCopyTargetEmails = (type: string) => {
    const activeStaff = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc');
    let targetPersonnel: any[] = [];
    
    if (type === 'lanh_dao') {
      targetPersonnel = activeStaff.filter(p => p.phan_loai === 'Lãnh đạo' && String(p.chuc_vu).trim() === 'Tổng Giám đốc');
    } else if (type === 'pt_qtvp') {
      targetPersonnel = activeStaff.filter(p => 
        p.phan_loai === 'PT QTVP & ASĐS' || 
        p.phan_loai === 'PT QTVT & ASĐS' || 
        p.phan_loai === 'PT DVHT KD'
      );
    } else if (type === 'pt_ns') {
      targetPersonnel = activeStaff.filter(p => p.phan_loai === 'PT Nhân sự' || p.phan_loai === 'PT NS');
    }

    const emails = targetPersonnel.map(p => p.email?.trim()).filter(Boolean);
    
    if (emails.length === 0) toast.warning('Không tìm thấy email hợp lệ nào cho nhóm này!');
    else { navigator.clipboard.writeText(emails.join('; ')); toast.success(`Đã copy ${emails.length} email!`); }
    
    setIsCopyEmailDropdownOpen(false); 
    setSelectedNgach([]); 
    setSelectedDiaDiem([]); 
  };

  // 🟢 Hàm mới: Copy kết hợp nhiều tiêu chí (Ngạch VÀ Địa điểm)
  const handleCopyMultiCriteria = () => {
    if (selectedNgach.length === 0 && selectedDiaDiem.length === 0) return;

    const activeStaff = filteredPersonnel.filter(p => p.trang_thai !== 'Đã nghỉ việc');

    // Thuật toán LỌC CHÉO
    const targetPersonnel = activeStaff.filter(p => {
      const loc = (p as any).dia_diem_lam_viec || (p as any).noi_lam_viec || '';
      const ngach = p.ngach_luong || '';

      // Nếu có chọn tiêu chí thì bắt buộc phải khớp, nếu KHÔNG CHỌN thì mặc định coi như Pass (True)
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

  // 🟢 Tính toán giá trị lớn nhất để canh tỷ lệ Biểu đồ cột
  const maxSeniority = Math.max(0, ...(Object.values(stats.seniority) as number[]));
  const maxAge = Math.max(0, ...(Object.values(stats.ageGroups) as number[]));

  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (<button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all" title="Mở bộ lọc đơn vị"><PanelLeftOpen size={20} /></button>)}

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
        allUnitsLabel="Tất cả Nhân sự Toàn quốc"
      />

      {/* 🟢 NỘI DUNG CHÍNH (CỘT PHẢI) */}
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 flex flex-col">
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
              <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Users size={28} /> Quản lý Nhân sự</h2>
              <p className="text-sm font-medium text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredPersonnel.length} nhân sự)</span>
                {filteredPersonnel.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => handleSelectAll(!isAllSelected)}
                    className="text-xs text-[#05469B] hover:text-[#05469B]/80 font-extrabold underline transition-colors"
                  >
                    {isAllSelected ? '✕ Hủy chọn tất cả' : '✓ Chọn tất cả đã lọc'}
                  </button>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full xl:w-auto">
            {/* HÀNG 1: TÌM KIẾM & THAO TÁC */}
            {/* HÀNG 1: TÌM KIẾM & NÚT TÍNH NĂNG */}
            <div className="flex flex-wrap items-center justify-end gap-2 w-full relative z-30">
              {/* Ô Tìm kiếm */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Tìm Mã NV, Họ Tên, Chức vụ..." 
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-[#05469B] outline-none shadow-sm text-[11px] font-medium" 
                  value={personnelSearchTerm} 
                  onChange={(e) => setPersonnelSearchTerm(e.target.value)} 
                />
              </div>

              {/* Nút Xóa bộ lọc nhanh nếu có lọc */}
              {(filterPhongBan || filterKhoi || filterChucVu || filterPhanLoai) && (
                <button
                  onClick={() => {
                    setFilterPhongBan('');
                    setFilterKhoi('');
                    setFilterChucVu('');
                    setFilterPhanLoai('');
                  }}
                  title="Xóa nhanh bộ lọc nâng cao"
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition-all flex items-center gap-1 text-[11px] font-bold shadow-sm"
                >
                  <RotateCcw size={13} /> <span className="hidden sm:inline">Xóa bộ lọc</span>
                  <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                    {[filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai].filter(Boolean).length}
                  </span>
                </button>
              )}

              {/* 🟢 NÚT "TÍNH NĂNG" DROPDOWN GỘP TẤT CẢ */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen);
                    setIsAddNewExpanded(false);
                  }}
                  className={`px-4 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 border transition-all shadow-sm whitespace-nowrap ${
                    isFeaturesDropdownOpen || showAdvancedFilters
                      ? 'bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white border-[#05469B] shadow-md'
                      : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Sparkles size={15} className={isFeaturesDropdownOpen || showAdvancedFilters ? 'text-amber-300 animate-pulse' : 'text-[#05469B]'} />
                  <span>Tính năng</span>
                  {(filterPhongBan || filterKhoi || filterChucVu || filterPhanLoai) && !showAdvancedFilters && (
                    <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                      {[filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai].filter(Boolean).length}
                    </span>
                  )}
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* MENU DROPDOWN TÍNH NĂNG */}
                {isFeaturesDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                    
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[50] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                      
                      {/* 1. Lọc nâng cao */}
                      <button 
                        onClick={() => {
                          setShowAdvancedFilters(!showAdvancedFilters);
                          setIsFeaturesDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
                          showAdvancedFilters ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${showAdvancedFilters ? 'bg-amber-500 text-white' : 'bg-blue-50 text-[#05469B]'}`}>
                            <Filter size={14} />
                          </div>
                          <span>Lọc nâng cao</span>
                        </div>
                        {(filterPhongBan || filterKhoi || filterChucVu || filterPhanLoai) ? (
                          <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {[filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai].filter(Boolean).length}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">{showAdvancedFilters ? 'Đang bật' : 'Đang ẩn'}</span>
                        )}
                      </button>

                      {/* 2. Thêm mới (Chỉ ADMIN) */}
                      {user?.quyen === 'ADMIN' && (
                        <div className="border-t border-gray-100 pt-1 mt-1">
                          <button 
                            onClick={() => setIsAddNewExpanded(!isAddNewExpanded)}
                            className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-50 text-gray-700 flex items-center justify-between transition-all"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Plus size={14} />
                              </div>
                              <span>Thêm mới nhân sự</span>
                            </div>
                            <ChevronRight size={14} className={`text-gray-400 transition-transform duration-200 ${isAddNewExpanded ? 'rotate-90' : ''}`} />
                          </button>

                          {/* Submenu Lựa chọn Thêm mới */}
                          {isAddNewExpanded && (
                            <div className="ml-3 pl-3 border-l-2 border-indigo-100 flex flex-col gap-1 mt-1 py-1 animate-in slide-in-from-top-1 duration-150">
                              <button 
                                onClick={() => {
                                  openModal('create');
                                  setIsFeaturesDropdownOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg font-semibold text-xs hover:bg-indigo-50 text-indigo-700 flex items-center gap-2 transition-all"
                              >
                                <UserPlus size={13} /> Thêm từng đối tượng
                              </button>
                              <button 
                                onClick={() => {
                                  if (!selectedUnitFilter) {
                                    toast.warning("Vui lòng chọn 1 Đơn vị trước khi nhập hàng loạt!");
                                    return;
                                  }
                                  setIsBulkImportOpen(true);
                                  setIsFeaturesDropdownOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg font-semibold text-xs hover:bg-indigo-50 text-indigo-700 flex items-center gap-2 transition-all"
                              >
                                <ClipboardPaste size={13} /> Thêm hàng loạt (Excel)
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. Xuất danh bạ */}
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

                      {/* 4. Copy email theo điều kiện */}
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
        </div>

        {/* 🟢 BỘ LỌC NÂNG CAO (BO PHAN, KHOI, CHUC VU, PHAN LOAI) */}
        {showAdvancedFilters && (
          <div className={`bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-[#05469B] rounded-lg">
                  <Filter size={16} className="shrink-0" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-[#05469B]">Bộ lọc nâng cao</span>
                {(filterPhongBan || filterKhoi || filterChucVu || filterPhanLoai) && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-in fade-in duration-200">
                    Đang lọc ({[filterPhongBan, filterKhoi, filterChucVu, filterPhanLoai].filter(Boolean).length} tiêu chí)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(filterPhongBan || filterKhoi || filterChucVu || filterPhanLoai) && (
                  <button
                    onClick={() => {
                      setFilterPhongBan('');
                      setFilterKhoi('');
                      setFilterChucVu('');
                      setFilterPhanLoai('');
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
              {/* Lọc theo Bộ phận */}
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

              {/* Lọc theo Khối */}
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

              {/* Lọc theo Chức vụ */}
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

              {/* Lọc theo Phân loại */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                  <Tag size={13} className="text-emerald-500" /> Phân loại ({availableFilterOptions.phanLoaiList.length})
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterPhanLoai}
                    onChange={(e) => setFilterPhanLoai(e.target.value)}
                    list="phan-loai-filter-list"
                    placeholder="Gõ hoặc chọn Phân loại..."
                    className="w-full text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl px-3 py-2 pr-7 text-gray-700 focus:bg-white focus:ring-2 focus:ring-[#05469B]/20 focus:border-[#05469B] outline-none transition-all cursor-pointer"
                  />
                  <datalist id="phan-loai-filter-list">
                    {availableFilterOptions.phanLoaiList.map((item, idx) => (
                      <option key={idx} value={item} />
                    ))}
                  </datalist>
                  {filterPhanLoai && (
                    <button 
                      type="button" 
                      onClick={() => setFilterPhanLoai('')} 
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

        {/* 🟢 KHU VỰC CHUYỂN TAB */}
        <div className={`border-b border-gray-200 mb-4 flex gap-6 px-1 transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''} shrink-0`}>
          <button onClick={() => setActiveTab('info')} className={`py-3 text-sm font-black transition-colors relative flex items-center gap-2 ${activeTab === 'info' ? 'text-[#05469B]' : 'text-gray-400 hover:text-gray-700'}`}>
            <Users size={18} /> Danh sách Thông tin
            {activeTab === 'info' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#05469B] rounded-t-md animate-in slide-in-from-left-2 duration-300"></div>}
          </button>
          <button onClick={() => setActiveTab('stats')} className={`py-3 text-sm font-black transition-colors relative flex items-center gap-2 ${activeTab === 'stats' ? 'text-[#05469B]' : 'text-gray-400 hover:text-gray-700'}`}>
            <BarChart3 size={18} /> Thống kê Phân tích
            {activeTab === 'stats' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#05469B] rounded-t-md animate-in slide-in-from-right-2 duration-300"></div>}
          </button>
        </div>

        {/* 🟢 TAB THÔNG TIN */}
        {activeTab === 'info' && (
          <div className={`flex flex-col flex-1 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
            
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

            {/* VIEW TRÊN PC: BẢNG DỮ LIỆU CHÍNH */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[900px] table-fixed text-left border-collapse text-[11.5px]">
                <thead className="sticky top-0 bg-[#f8fafc] z-10 text-[11.5px]">
                  <tr className="border-b border-gray-200 font-bold text-gray-600 uppercase tracking-wider">
                    {showSelectCheckboxes && (
                      <th className="py-2.5 px-3 w-[4%] text-center bg-[#f8fafc]">
                        <input 
                          type="checkbox" 
                          checked={isAllSelected} 
                          onChange={(e) => handleSelectAll(e.target.checked)} 
                          className="w-4 h-4 text-[#05469B] rounded border-gray-300 focus:ring-[#05469B] cursor-pointer" 
                        />
                      </th>
                    )}
                    <th className={`py-2.5 px-3 ${showSelectCheckboxes ? 'w-[8%]' : 'w-[9%]'} whitespace-nowrap bg-[#f8fafc]`}>Mã NV</th>
                    <th className="py-2.5 px-3 w-[18%] whitespace-nowrap bg-[#f8fafc]">Họ Tên / Trạng thái</th>
                    <th className={`py-2.5 px-3 ${showSelectCheckboxes ? 'w-[22%]' : 'w-[24%]'} bg-[#f8fafc]`}>Chức vụ &amp; Bộ phận</th>
                    <th className={`py-2.5 px-3 ${showSelectCheckboxes ? 'w-[12%]' : 'w-[13%]'} bg-[#f8fafc]`}>Đơn Vị</th>
                    <th className="py-2.5 px-3 w-[14%] whitespace-nowrap bg-[#f8fafc]">Điện thoại</th>
                    <th className="py-2.5 px-3 w-[10%] whitespace-nowrap bg-[#f8fafc]">Thâm niên</th>
                    <th className="py-2.5 px-3 text-center w-[12%] whitespace-nowrap bg-[#f8fafc]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedPersonnel.map((item: any) => (
                    <tr key={item.id} className={`hover:bg-blue-50/50 transition-colors group ${item.trang_thai === 'Đã nghỉ việc' ? 'opacity-60 bg-gray-50' : ''}`}>
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
                      <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap text-[11px] align-middle text-left">{item.ma_so_nhan_vien}</td>
                      <td className="py-2.5 px-3 align-middle text-left">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                            {item.hinh_anh ? <img src={getDirectImageLink(item.hinh_anh)} alt="" className="w-full h-full object-cover" /> : <UserIcon size={14} className="text-gray-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#05469B] leading-snug text-[13px] truncate" title={item.ho_ten}>{item.ho_ten}</p>
                            {item.trang_thai === 'Đã nghỉ việc' && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block">Đã nghỉ việc</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-left">
                        <div className="flex flex-col justify-center">
                          <p className="font-bold text-gray-800 text-[12px] leading-snug truncate" title={item.chuc_vu}>{item.chuc_vu || '---'}</p>
                          {((item.phong_ban && item.phong_ban !== '-' && item.phong_ban !== 'Chưa phân bộ' && item.phong_ban !== 'Chưa có') || (item.khoi && item.khoi !== '-' && item.khoi !== 'Chưa có')) && (
                            <div className="flex items-center gap-1 mt-0.5 overflow-hidden whitespace-nowrap">
                              {item.phong_ban && item.phong_ban !== '-' && item.phong_ban !== 'Chưa phân bộ' && item.phong_ban !== 'Chưa có' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs truncate max-w-[140px]" title={`Bộ phận: ${item.phong_ban}`}>
                                  BP: {item.phong_ban}
                                </span>
                              )}
                              {item.khoi && item.khoi !== '-' && item.khoi !== 'Chưa có' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs truncate max-w-[140px]" title={`Khối: ${item.khoi}`}>
                                  {String(item.khoi).startsWith('Khối') ? item.khoi : `Khối: ${item.khoi}`}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11.5px] font-medium text-gray-700 leading-normal align-middle text-left">{donViMap[String(item.id_don_vi)] || item.id_don_vi || '-'}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap align-middle text-left">
                        <div className="flex flex-col gap-1 text-[11px]">
                          {item.sdt_cong_ty && <a href={`tel:${String(item.sdt_cong_ty).replace(/\D/g, '')}`} className="font-bold text-[#05469B] hover:underline flex items-center gap-1 w-fit"><Phone size={11} className="text-blue-400" /> {formatPhoneNumber(item.sdt_cong_ty)}</a>}
                          {item.sdt_ca_nhan && (
                            hasRule('NS_HIDE_SENSITIVE') ? (
                              <span className="text-gray-400 font-medium flex items-center gap-1 w-fit"><Lock size={11} className="text-gray-300"/> ***</span>
                            ) : (
                              <a href={`tel:${String(item.sdt_ca_nhan).replace(/\D/g, '')}`} className="font-bold text-emerald-500 hover:underline flex items-center gap-1 w-fit"><Phone size={11} className="text-emerald-400" /> {formatPhoneNumber(item.sdt_ca_nhan)}</a>
                            )
                          )}
                          {!item.sdt_cong_ty && !item.sdt_ca_nhan && <span className="text-gray-400 font-medium">---</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11.5px] font-medium text-emerald-600 whitespace-nowrap align-middle text-left">
                        <span className={`rounded-md inline-block px-1.5 py-0.5 border ${item.trang_thai === 'Đã nghỉ việc' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50/50 border-emerald-100'}`}>{calculateSeniority(item.ngay_nhan_vien, item.trang_thai || 'Đang làm việc', item.ngay_nghi_viec || '')}</span>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-center">
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleView(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" title="Xem chi tiết"><Eye className="w-3.5 h-3.5" /></button>
                          {item.trang_thai !== 'Đã nghỉ việc' && (
                            <>
                              <button onClick={() => handleDuplicate(item)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Nhân bản (Tạo hồ sơ kiêm nhiệm)"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Sửa"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleOffboardClick(item)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-md transition-colors border border-transparent hover:border-orange-200" title="Chốt nghỉ việc (Thu hồi tài sản)"><LogOut className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          {item.trang_thai === 'Đã nghỉ việc' && (
                            <>
                              <button onClick={() => { setPersonnelToRehire(item); setIsRehireModalOpen(true); }} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Vào làm lại"><RotateCcw className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Xóa vĩnh viễn"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 🟢 VIEW TRÊN MOBILE: THẺ CARD DỌC */}
            <div className="block md:hidden flex-1 overflow-y-auto pb-4 space-y-4 custom-scrollbar">
              {paginatedPersonnel.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 italic">Không tìm thấy nhân sự.</div>
              ) : (
                paginatedPersonnel.map((item: any) => {
                  const seniorityStr = calculateSeniority(item.ngay_nhan_vien, item.trang_thai || 'Đang làm việc', item.ngay_nghi_viec || '');
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative flex flex-col gap-3 transition-all ${item.trang_thai === 'Đã nghỉ việc' ? 'opacity-70 bg-gray-50' : ''}`}
                    >
                      {/* Header Card: Avatar + Name + ID + Status */}
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
                            ) : (
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase">Đang làm việc</span>
                            )}
                          </div>
                          <h4 className="font-extrabold text-[#05469B] text-sm leading-snug truncate mt-0.5">{item.ho_ten}</h4>
                        </div>
                      </div>

                      {/* Body Card: Details */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Chức vụ &amp; Bộ phận</p>
                          <p className="font-bold text-gray-800 leading-normal truncate">{item.chuc_vu || '---'}</p>
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
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Đơn vị quản lý</p>
                          <p className="font-medium text-gray-700 leading-normal truncate">{donViMap[String(item.id_don_vi)] || item.id_don_vi || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Điện thoại</p>
                          <div className="flex flex-col gap-1 mt-1">
                            {item.sdt_cong_ty && <a href={`tel:${String(item.sdt_cong_ty).replace(/\D/g, '')}`} className="font-bold text-[#05469B] hover:underline flex items-center gap-1 text-[11px]"><Phone size={11} className="text-blue-400 shrink-0" /> {formatPhoneNumber(item.sdt_cong_ty)}</a>}
                            {item.sdt_ca_nhan && (
                              hasRule('NS_HIDE_SENSITIVE') ? (
                                <span className="text-gray-400 font-medium flex items-center gap-1 text-[11px]"><Lock size={11} className="text-gray-300 shrink-0"/> ***</span>
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

                      {/* Footer Card: Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-100 mt-1">
                        <button onClick={() => handleView(item)} className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xem chi tiết"><Eye className="w-3.5 h-3.5" /> Xem</button>
                        {item.trang_thai !== 'Đã nghỉ việc' && (
                          <>
                            <button onClick={() => handleDuplicate(item)} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Kiêm nhiệm"><Copy className="w-3.5 h-3.5" /> Kiêm nhiệm</button>
                            <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit className="w-3.5 h-3.5" /> Sửa</button>
                            <button onClick={() => handleOffboardClick(item)} className="p-1.5 text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Nghỉ việc"><LogOut className="w-3.5 h-3.5" /> Nghỉ việc</button>
                          </>
                        )}
                        {item.trang_thai === 'Đã nghỉ việc' && (
                          <>
                            <button onClick={() => { setPersonnelToRehire(item); setIsRehireModalOpen(true); }} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Vào làm lại"><RotateCcw className="w-3.5 h-3.5" /> Làm lại</button>
                            <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa vĩnh viễn"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              totalRows={filteredPersonnel.length}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
              itemName="nhân sự"
            />
          </div>
        )}

        {/* 🟢 PHẦN 4 */}
        {/* 🟢 TAB THỐNG KÊ (DASHBOARD) */}
        {activeTab === 'stats' && (() => {
          // 🟢 TÌM GIÁ TRỊ LỚN NHẤT ĐỂ CHIA TỶ LỆ CỘT RÕ RÀNG HƠN
          const maxSeniority = Math.max(0, ...(Object.values(stats.seniority) as number[]));
          const maxAge = Math.max(0, ...(Object.values(stats.ageGroups) as number[]));

          return (
            <div className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
              
              {/* DÒNG 1: 4 CHỈ SỐ KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Users size={24}/></div>
                  <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Đang làm việc</p><p className="text-3xl font-black text-gray-800 leading-none">{stats.total}</p></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><TrendingUp size={24}/></div>
                  <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Nhận việc Tháng {stats.currentMonth + 1}</p><p className="text-3xl font-black text-emerald-600 leading-none">{stats.newThisMonth}</p></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><ShieldCheck size={24}/></div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1" title="Số được đào tạo ATVSLĐ / Tổng số NV">Đã Đào tạo ATVSLĐ / Tổng</p>
                    <p className="text-3xl font-black text-orange-600 leading-none">{stats.atvsldTrained} <span className="text-lg text-gray-400">/ {stats.total}</span></p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center shrink-0"><Cake size={24}/></div>
                  <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Sinh nhật Tháng {stats.currentMonth + 1}</p><p className="text-3xl font-black text-pink-500 leading-none">{stats.birthdays.length}</p></div>
                </div>
              </div>

              {/* 🟢 BẢNG 1: THỐNG KÊ CHI TIẾT (BV/PVHC) (Đã ép CSS table-fixed chống cuộn) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-0.5 text-sm"><FileSpreadsheet size={18} className="text-[#05469B]"/> Bảng Thống kê BV/Đón tiếp & PVHC</h3>
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
                        <th className="py-2.5 px-2 border border-gray-300 w-[30%] text-[12px]" colSpan={3}>BV / ĐÓN TIẾP KH</th>
                        <th className="py-2.5 px-2 border border-gray-300 w-[30%] text-[12px]" colSpan={3}>PV HÀNH CHÍNH</th>
                        <th className="py-2.5 px-2 border border-gray-300 w-[16%] text-[12px]" rowSpan={2}>TỔNG<br/>CỘNG</th>
                      </tr>
                      <tr className="bg-[#fff2cc] font-black text-[#002060] leading-tight text-[11px]">
                        <th className="py-2 px-1 border border-gray-300 break-words">NV</th>
                        <th className="py-2 px-1 border border-gray-300 break-words">T.Trưởng<br/>T.Phó</th>
                        <th className="py-2 px-1 border border-gray-300 text-emerald-700 break-words">Cộng<br/>BV</th>
                        <th className="py-2 px-1 border border-gray-300 break-words">NV</th>
                        <th className="py-2 px-1 border border-gray-300 break-words">T.Trưởng<br/>T.Phó</th>
                        <th className="py-2 px-1 border border-gray-300 text-blue-700 break-words">Cộng<br/>HC</th>
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
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-0.5 text-sm"><Briefcase size={18} className="text-[#05469B]"/> Cơ cấu Lực lượng theo Bộ phận & Cấp bậc</h3>
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

              {/* DÒNG 3: CÁC BIỂU ĐỒ (Giới tính, Thâm niên, Độ tuổi) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                  <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><PieChartIcon size={18} className="text-[#05469B]"/> Cơ cấu Giới tính</h3>
                  <div>
                    <div className="flex justify-between mb-2 text-sm font-bold">
                      <span className="text-[#05469B] flex items-center gap-1">Nam: {stats.male} ({stats.total > 0 ? Math.round(stats.male/stats.total*100) : 0}%)</span>
                      <span className="text-pink-500 flex items-center gap-1">({stats.total > 0 ? Math.round(stats.female/stats.total*100) : 0}%) {stats.female} :Nữ</span>
                    </div>
                    <div className="w-full h-8 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                      <div className="h-full bg-[#05469B] transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.male/stats.total)*100 : 0}%` }}></div>
                      <div className="h-full bg-pink-400 transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.female/stats.total)*100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><BarChart3 size={18} className="text-[#05469B]"/> Thâm niên công tác</h3>
                  <div className="flex items-end justify-around h-32 pt-4 border-b border-gray-200">
                    {Object.entries(stats.seniority).map(([label, count]: any) => {
                      const heightPercent = maxSeniority > 0 ? Math.max((count / maxSeniority) * 100, count > 0 ? 5 : 0) : 0;
                      return (
                        <div key={label} className="flex flex-col items-center justify-end h-full group w-1/4">
                          <span className="text-xs font-bold text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                          <div className="flex items-end justify-center w-full flex-1 border-b border-gray-200 pb-0">
                            <div className="w-8 sm:w-12 bg-emerald-500 rounded-t-md transition-all duration-1000 group-hover:bg-emerald-400" style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '4px' : '0px' }}></div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-600 mt-2 text-center h-4">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Users size={18} className="text-[#05469B]"/> Phân bổ Độ tuổi</h3>
                  <div className="flex items-end justify-around h-32 pt-4 border-b border-gray-200">
                    {Object.entries(stats.ageGroups).map(([label, count]: any) => {
                      const heightPercent = maxAge > 0 ? Math.max((count / maxAge) * 100, count > 0 ? 5 : 0) : 0;
                      return (
                        <div key={label} className="flex flex-col items-center justify-end h-full group w-1/4">
                          <span className="text-xs font-bold text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                          <div className="flex items-end justify-center w-full flex-1 border-b border-gray-200 pb-0">
                            <div className="w-8 sm:w-12 bg-orange-400 rounded-t-md transition-all duration-1000 group-hover:bg-orange-300" style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '4px' : '0px' }}></div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-600 mt-2 text-center h-4">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* DÒNG 4: DANH SÁCH SINH NHẬT TRONG THÁNG */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                <div className="p-5 border-b border-gray-100 bg-pink-50/30">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2"><Cake size={18} className="text-pink-500"/> Danh sách Sinh nhật trong tháng {stats.currentMonth + 1}</h3>
                </div>
                <div className="p-0 max-h-64 overflow-y-auto custom-scrollbar">
                  {stats.birthdays.length === 0 ? (
                    <div className="p-8 text-center text-gray-400"><Cake size={32} className="mx-auto mb-2 opacity-30"/> Không có nhân sự nào sinh tháng này.</div>
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
                  <Copy size={16}/> Lọc & Copy Danh sách Email
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
              <h3 className="text-xl font-black text-emerald-700 flex items-center gap-2"><FileSpreadsheet size={24}/> Xuất Excel Danh bạ</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">Bạn muốn tải xuống danh bạ (Gồm Lãnh đạo & PT Dịch vụ Hỗ trợ) của khu vực nào?</p>
            <div className="flex flex-col gap-3 mb-6">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'ALL' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'ALL'} onChange={() => setExportRegion('ALL')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800">Toàn quốc (Toàn bộ Hệ thống)</span></label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'NAM' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'NAM'} onChange={() => setExportRegion('NAM')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800">CTTT Phía Nam (Các tỉnh Miền Nam)</span></label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'BAC' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'BAC'} onChange={() => setExportRegion('BAC')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800">CTTT Phía Bắc (Các tỉnh Miền Bắc)</span></label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'SPECIFIC' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}><input type="radio" name="exportRegion" checked={exportRegion === 'SPECIFIC'} onChange={() => setExportRegion('SPECIFIC')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" /><span className="font-bold text-gray-800 flex-1">Đơn vị đang xem: <span className="text-emerald-600">{selectedUnitName}</span></span></label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
              <button onClick={handleExportExcel} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"><Download size={20}/> Tải File .XLS</button>
            </div>
          </div>
        </div>
      )}

      {isOffboardOpen && personnelToOffboard && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
            <div className="bg-orange-500 text-white p-5 flex items-start justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0 border border-white/40"><LogOut size={24}/></div>
                <div><h3 className="text-xl font-black mb-1">Xác nhận Nghỉ việc</h3><p className="text-orange-100 text-sm font-medium">{personnelToOffboard.ho_ten} - {personnelToOffboard.ma_so_nhan_vien}</p></div>
              </div>
              <button onClick={() => setIsOffboardOpen(false)} className="text-orange-100 hover:text-white p-1 rounded-full"><X size={24}/></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {personnelToOffboard.sdt_cong_ty && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 mb-4">
                  <Phone className="text-yellow-600 shrink-0 w-6 h-6"/>
                  <div><h4 className="font-black text-yellow-800 mb-1">CẢNH BÁO: Thu hồi SIM Công ty!</h4><p className="text-sm text-yellow-700 font-medium">Nhân sự này đang được cấp số điện thoại: <span className="font-black text-yellow-900">{formatPhoneNumber(personnelToOffboard.sdt_cong_ty)}</span>. Vui lòng yêu cầu bàn giao lại SIM công ty trước khi hoàn tất thủ tục nghỉ việc.</p></div>
                </div>
              )}
              {checkingAssets ? (
                <div className="flex flex-col items-center justify-center py-12 border border-gray-100 rounded-xl"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" /><p className="text-gray-600 font-bold">Đang quét hệ thống Tài sản & Nhật ký...</p></div>
              ) : unreturnedAssets.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 w-6 h-6"/>
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
                    <span className="text-sm font-semibold text-gray-700">Tôi xác nhận đã thu hồi các tài sản/SIM này ngoài hệ thống, hoặc vẫn muốn chốt nghỉ việc ngay lập tức.</span>
                  </label>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 bg-emerald-50 rounded-xl border border-emerald-100"><CheckCheck className="w-16 h-16 text-emerald-500 mb-3" /><h4 className="font-black text-emerald-700 text-lg mb-1">An toàn chốt nghỉ việc</h4><p className="text-emerald-600 font-medium text-sm text-center px-4">Hệ thống không ghi nhận thiết bị phần cứng nào đang được giao cho nhân sự này.</p></div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsOffboardOpen(false)} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Hủy bỏ</button>
              <button onClick={confirmOffboard} disabled={submitting || (unreturnedAssets.length > 0 && !forceOffboard)} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />} Xác nhận Đã nghỉ việc</button>
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
                {viewData.trang_thai === 'Đã nghỉ việc' && (<div className="absolute top-0 right-0 bg-red-100 text-red-700 font-black px-3 py-1 rounded border border-red-200 flex items-center gap-1"><LogOut size={16}/> ĐÃ NGHỈ VIỆC</div>)}
                <div className="w-24 h-24 sm:w-28 sm:h-32 rounded-2xl bg-blue-100 text-[#05469B] flex items-center justify-center text-4xl font-black shrink-0 border-4 border-white shadow-md overflow-hidden relative">
                  {viewData.hinh_anh ? (<img src={getDirectImageLink(viewData.hinh_anh)} alt={viewData.ho_ten} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Lỗi+Ảnh'; }} />) : (viewData.ho_ten?.charAt(0).toUpperCase() || 'U')}
                </div>
                <div className="flex-1 mt-2 sm:mt-0">
                  <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-3 mb-1">
                    <h2 className="text-2xl font-black text-gray-800">{viewData.ho_ten}</h2><span className="px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-bold text-gray-600">ID: {viewData.ma_so_nhan_vien}</span>
                  </div>
                  <p className="text-lg font-bold text-[#05469B] mb-3">{viewData.chuc_vu}</p>
                  <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-sm text-gray-600 font-medium">
                    {viewData.sdt_cong_ty && (<a href={`tel:${String(viewData.sdt_cong_ty).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-800 border border-blue-100 hover:bg-blue-100 transition-colors"><Phone size={16} className="text-blue-500"/> SĐT Cty: <span className="font-bold">{formatPhoneNumber(viewData.sdt_cong_ty)}</span></a>)}
                    {viewData.sdt_ca_nhan && (
                      hasRule('NS_HIDE_SENSITIVE') ? (
                        <span className="flex items-center justify-center sm:justify-start gap-1.5 bg-gray-50 px-2 py-1 rounded text-gray-500 border border-gray-200"><Lock size={16} className="text-gray-400"/> SĐT Cá nhân: <span className="font-bold">***</span></span>
                      ) : (
                        <a href={`tel:${String(viewData.sdt_ca_nhan).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-emerald-50 px-2 py-1 rounded text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"><Phone size={16} className="text-emerald-500"/> SĐT Cá nhân: <span className="font-bold">{formatPhoneNumber(viewData.sdt_ca_nhan)}</span></a>
                      )
                    )}
                    <span className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 sm:mt-0"><Mail size={16} className="text-gray-400"/> {viewData.email || 'Chưa có Email'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><Building2 size={18} className="text-[#05469B]"/> Thông tin Công tác</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Đơn vị</p><p className="font-semibold text-gray-800 break-words">{donViMap[String(viewData.id_don_vi)] || viewData.id_don_vi || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Bộ phận</p><p className="font-semibold text-gray-800">{viewData.phong_ban || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Khối</p><p className="font-semibold text-[#1e2939]">{viewData.khoi || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Địa điểm LV</p><p className="font-semibold text-[#1e2939]">{viewData.dia_diem_lam_viec || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Phân loại</p><p className="font-semibold text-gray-800">{viewData.phan_loai || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngày nhận việc</p><p className="font-semibold text-gray-800">{viewData.ngay_nhan_vien ? new Date(viewData.ngay_nhan_vien).toLocaleDateString('vi-VN') : '---'}</p></div>
                  {viewData.trang_thai === 'Đã nghỉ việc' ? (<div><p className="text-xs text-red-500 uppercase font-bold mb-1">Ngày nghỉ việc</p><p className="font-semibold text-red-600">{viewData.ngay_nghi_viec ? new Date(viewData.ngay_nghi_viec).toLocaleDateString('vi-VN') : '---'}</p></div>) : (<div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Thâm niên</p><p className="font-semibold text-emerald-600">{calculateSeniority(viewData.ngay_nhan_vien, viewData.trang_thai || 'Đang làm việc', viewData.ngay_nghi_viec || '')}</p></div>)}
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
                  {viewData.ngay_vao_lam_lai && (<div className="col-span-2 md:col-span-1"><p className="text-xs text-blue-500 uppercase font-bold mb-1">Vào làm lại</p><p className="font-semibold text-blue-600">{new Date(viewData.ngay_vao_lam_lai).toLocaleDateString('vi-VN')}</p></div>)}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><UserIcon size={18} className="text-orange-500"/> Cá nhân & Ngoại hình</h4>
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Giới tính:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.gioi_tinh || '---'}</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Năm sinh:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.nam_sinh ? new Date(viewData.nam_sinh).toLocaleDateString('vi-VN') : '---'} {viewData.tuoi && <span className="ml-2 text-orange-600 font-bold">({viewData.tuoi} tuổi)</span>}</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Trình độ:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.trinh_do_hoc_van || '---'}</span></div>
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
                <div className="flex flex-col">
                  <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><Info size={18} className="text-blue-500"/> Ghi chú khác</h4>
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex-1"><p className="text-sm font-semibold text-gray-800 whitespace-pre-wrap">{viewData.ghi_chu || 'Không có ghi chú.'}</p></div>
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-500"/> Chứng chỉ / Kỹ năng</h4>
                <div className="flex flex-col gap-3">
                  {viewData.giay_phep_lai_xe && viewData.giay_phep_lai_xe !== 'Không có' && (
                    <div className="flex flex-wrap gap-2 items-center"><span className="text-sm font-bold text-gray-600 mr-1 shrink-0">Bằng lái xe:</span>{viewData.giay_phep_lai_xe.split(',').map((bang: string, idx: number) => (<span key={idx} className="px-2.5 py-1 bg-blue-100 text-[#05469B] font-black rounded-md text-xs border border-blue-200">Hạng {bang.trim()}</span>))}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {CERTIFICATES.filter(cert => viewData[cert.id]).length > 0 ? (CERTIFICATES.filter(cert => viewData[cert.id]).map(cert => { const Icon = cert.icon; return (<div key={cert.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-bold shadow-sm"><Icon size={16} /> {cert.label}</div>) })) : (<p className="text-sm text-gray-400 italic">Chưa cập nhật chứng chỉ khác.</p>)}
                  </div>
                </div>
              </div>

              {/* 🟢 KHỐI HIỂN THỊ ATVSLĐ Ở CUỐI MODAL */}
              {viewData.cc_atvsld && (
                <div className="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm w-full flex flex-col gap-3">
                  <h5 className="font-bold text-emerald-800 text-sm border-b border-emerald-100 pb-2 flex items-center gap-2">
                    <ShieldCheck size={18}/> Thông tin An toàn Vệ sinh Lao động (ATVSLĐ)
                  </h5>
                  <div className="flex flex-col gap-2 text-sm text-gray-700">
                    <p>
                      <span className="text-gray-500 w-36 inline-block font-medium">Loại chứng nhận:</span> 
                      <span className="font-bold text-gray-900">{viewData.chung_nhan || '---'}</span> 
                      {viewData.nhom_doi_tuong && <span className="text-[#05469B] font-bold ml-1.5">(Nhóm {viewData.nhom_doi_tuong})</span>}
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
                                const d = new Date(viewData.huan_luyen_den);
                                d.setFullYear(d.getFullYear() + (String(viewData.nhom_doi_tuong || '').includes('4') ? 1 : 2));
                                return d.toLocaleDateString('vi-VN') + " (Tự tính tạm)";
                              })()
                            : '...'
                        }
                      </span>
                    </p>
                  </div>
                </div>
              )}

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
        phanLoaiSuggestions={phanLoaiSuggestions}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        onSave={handleSave}
        setFormData={(updater) => setModal(prev => ({ ...prev, formData: updater(prev.formData) }))}
        hideSensitiveFields={hasRule('NS_HIDE_SENSITIVE')}
      />

      {/* CÁC MODAL CÒN LẠI (REHIRE, DELETE, BULK IMPORT) GIỮ NGUYÊN */}
      {isRehireModalOpen && personnelToRehire && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-[#05469B] mb-4 flex items-center gap-2"><RotateCcw size={24}/> Vào làm lại</h3>
            <p className="text-sm text-gray-600 mb-6">Bạn đang thực hiện thủ tục cho nhân sự <span className="font-bold text-gray-800">{personnelToRehire.ho_ten}</span> quay trở lại làm việc.</p>
            <div className="mb-6"><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ngày vào làm lại chính thức</label><input type="date" value={rehireDate} onChange={(e) => setRehireDate(e.target.value)} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]" /></div>
            <div className="flex gap-3">
              <button onClick={() => setIsRehireModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
              <button onClick={handleConfirmRehire} disabled={submitting} className="flex-1 py-3 bg-[#05469B] hover:bg-[#04367a] transition-colors text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck size={20}/>} Xác nhận</button>
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

      {isBulkImportOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-indigo-100 bg-indigo-50 rounded-t-2xl">
              <h3 className="text-xl font-black text-indigo-800 flex items-center gap-2"><ClipboardPaste size={24}/> Dán Dữ Liệu Hàng Loạt</h3>
              <button onClick={() => setIsBulkImportOpen(false)} className="text-indigo-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm">
                <p className="font-bold text-[#05469B] mb-1">Cấu trúc dán (Quét từ Cột 1 đến Cột 22, có hay không có Tiêu đề đều được):</p>
                <p className="text-gray-700 text-[11px] leading-relaxed">
                  Mã NV [Cột 2] | Họ tên [Cột 3] | Chức danh [Cột 4] | Bộ phận [Cột 5] | Chức vụ [Cột 9] | SĐT [Cột 10] | Giới tính [Cột 11] | Năm sinh [Cột 12] | Ngày làm [Cột 13] | SĐT phụ [Cột 14] | Email [Cột 15] | Ngạch [Cột 16] | Nhóm ATVSLĐ [Cột 17] | HL Từ [Cột 18] | HL Đến [Cột 19] | Giá trị đến [Cột 20] <span className="font-bold text-indigo-700">| Khối [Cột 21] | Địa điểm LV [Cột 22]</span>
                </p>
                <p className="mt-2 text-indigo-600 font-bold text-xs">✓ Tự động gán vào: {selectedUnitName} (Bỏ trống sẽ giữ nguyên dữ liệu cũ)</p>
              </div>
              <textarea value={bulkImportText} onChange={handlePasteBulkData} disabled={isAnalyzingBulk} placeholder="Ctrl+V bảng Excel vào đây..." className="w-full h-32 p-3 text-sm border-2 border-dashed border-indigo-300 rounded-xl outline-none focus:border-indigo-500 bg-white resize-none"></textarea>
              {isAnalyzingBulk && <div className="text-center py-4"><Loader2 className="animate-spin inline mr-2" /> Đang xử lý...</div>}
              {bulkImportData.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold mb-2">Xem trước ({bulkImportData.length} người)</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 sticky top-0 font-bold">
                        <tr>
                          <th className="p-3">Mã NV</th>
                          <th className="p-3">Họ Tên</th>
                          <th className="p-3">Bộ phận</th>
                          <th className="p-3">Chức vụ</th>
                          <th className="p-3">Khối</th>
                          <th className="p-3">Địa điểm LV</th>
                          <th className="p-3">Nhóm (AT)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bulkImportData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50">
                            <td className="p-3 font-bold text-[#05469B]">{item.ma_so_nhan_vien}</td>
                            <td className="p-3">{item.ho_ten}</td>
                            <td className="p-3">{item.phong_ban}</td>
                            <td className="p-3">{item.phan_loai}</td>
                            <td className="p-3 font-semibold text-indigo-700">{item.khoi}</td>
                            <td className="p-3 font-semibold text-indigo-700">{item.dia_diem_lam_viec}</td>
                            <td className="p-3 font-semibold text-emerald-600">{item.nhom_doi_tuong}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => { setIsBulkImportOpen(false); setBulkImportData([]); setBulkImportText(''); }} className="px-6 py-2.5 bg-gray-200 rounded-xl font-bold">Hủy</button>
              <button onClick={confirmBulkSave} disabled={submitting || bulkImportData.length === 0} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck size={20} />} Xác nhận Lưu</button>
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