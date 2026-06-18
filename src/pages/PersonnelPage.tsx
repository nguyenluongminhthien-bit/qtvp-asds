import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  Users, ShieldCheck, Flame, LifeBuoy, Heart, Activity, 
  Dumbbell, Car, Utensils, Coffee, Languages, Monitor, Copy, Eye, EyeOff, User as UserIcon, 
  Building2, Phone, Mail, Info, MapPin, ChevronDown, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen, CheckCheck, Briefcase,
  LogOut, AlertTriangle, Image as ImageIcon, RotateCcw, Download, FileSpreadsheet, ClipboardPaste,
  BarChart3, PieChart as PieChartIcon, TrendingUp, Cake
} from 'lucide-react';
import { apiService } from '../services/api';
import { Personnel, DonVi, ThietBi } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';

const formatPhoneNumber = (val: string | number | undefined | null) => {
  if (!val) return '';
  const cleaned = val.toString().replace(/\D/g, ''); 
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
};

const getDirectImageLink = (url: string) => {
  if (!url) return '';
  const match = url.match(/[-\w]{25,}/);
  if (match && match[0]) {
    return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800`;
  }
  return url; 
};

const CERTIFICATES = [
  { id: 'cc_atvsld', label: 'ATVSLĐ', icon: ShieldCheck }, { id: 'cc_anbv', label: 'ANBV', icon: ShieldCheck },
  { id: 'cc_pccc', label: 'PCCC', icon: Flame }, { id: 'cc_cnch', label: 'CNCH', icon: LifeBuoy },
  { id: 'cc_so_cap_cuu', label: 'Sơ cấp cứu', icon: Heart }, { id: 'cc_cpr', label: 'CPR', icon: Activity },
  { id: 'cc_vo_thuat', label: 'Võ thuật', icon: Dumbbell }, { id: 'giay_phep_lai_xe', label: 'GPLX', icon: Car },
  { id: 'cc_attp', label: 'ATTP', icon: Utensils }, { id: 'cc_pha_che', label: 'Pha chế', icon: Coffee },
  { id: 'cc_ngoai_ngu', label: 'Ngoại ngữ', icon: Languages }, { id: 'cc_tin_hoc', label: 'Tin học', icon: Monitor }
];

const formatCurrency = (val: string | number | undefined | null) => {
  if (!val) return '';
  return val.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const toUnaccented = (str: any) => {
  if (!str) return '';
  return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, ""); 
};

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
  const [data, setData] = useState<any[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [personnelSearchTerm, setPersonnelSearchTerm] = useState('');
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
  const formData = modal.formData;

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportData, setBulkImportData] = useState<any[]>([]);
  const [isAnalyzingBulk, setIsAnalyzingBulk] = useState(false);
  
  useEffect(() => {
    if (modal.isOpen && formData.cc_atvsld) {
      const nhom = String(formData.nhom_doi_tuong || '');
      let certName = '';
      if (nhom === '1' || nhom === '2') certName = 'Giấy chứng nhận huấn luyện ATVSLĐ';
      else if (nhom === '3') certName = 'Thẻ An toàn lao động';
      else if (nhom === '4') certName = 'Quyết định Công nhận Kết quả Huấn luyện ATVSLĐ';
      else if (nhom === '6') certName = 'Giấy chứng nhận huấn luyện ATVSLĐ';

      if (formData.chung_nhan !== certName) {
        setModal(prev => ({ ...prev, formData: { ...prev.formData, chung_nhan: certName } }));
      }
    }
  }, [formData.nhom_doi_tuong, formData.cc_atvsld, modal.isOpen]);

  const gplxGroups = [
    { title: 'Tùy chọn chung', options: [{ label: 'Không có', value: 'Không có' }] },
    { title: 'Nhóm xe máy (Mô tô)', options: [{ label: 'Hạng A1 (Đến 125 cm³)', value: 'A1' }, { label: 'Hạng A (Trên 125 cm³)', value: 'A' }, { label: 'Hạng B1 (Ba bánh)', value: 'B1' }] },
    { title: 'Nhóm xe ô tô chở người', options: [{ label: 'Hạng B (Đến 8 chỗ, < 3.5T)', value: 'B' }, { label: 'Hạng D1 (8 - 16 chỗ)', value: 'D1' }, { label: 'Hạng D2 (16 - 29 chỗ)', value: 'D2' }, { label: 'Hạng D (Trên 29 chỗ)', value: 'D' }] },
    { title: 'Nhóm xe tải và chuyên dùng', options: [{ label: 'Hạng C1 (3.5T - 7.5T)', value: 'C1' }, { label: 'Hạng C (Trên 7.5T)', value: 'C' }] },
    { title: 'Nhóm xe kéo rơ moóc (Bằng E)', options: [{ label: 'Hạng BE (B kéo > 750kg)', value: 'BE' }, { label: 'Hạng C1E (C1 kéo > 750kg)', value: 'C1E' }, { label: 'Hạng CE (Đầu kéo, container)', value: 'CE' }, { label: 'Hạng D1E (D1 kéo > 750kg)', value: 'D1E' }, { label: 'Hạng D2E (D2 kéo > 750kg)', value: 'D2E' }, { label: 'Hạng DE (D kéo > 750kg)', value: 'DE' }] }
  ];

  const handleGPLXChange = (value: string, isChecked: boolean) => {
    let currentArr = formData.giay_phep_lai_xe ? formData.giay_phep_lai_xe.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    if (value === 'Không có') { currentArr = isChecked ? ['Không có'] : []; } 
    else {
      currentArr = currentArr.filter((item: string) => item !== 'Không có');
      if (isChecked) { if (!currentArr.includes(value)) currentArr.push(value); } 
      else { currentArr = currentArr.filter((item: string) => item !== value); }
    }
    setModal(prev => ({ ...prev, formData: { ...prev.formData, giay_phep_lai_xe: currentArr.join(', ') } }));
  };

  const currentGPLXList = useMemo(() => {
    return formData.giay_phep_lai_xe ? formData.giay_phep_lai_xe.split(',').map((s: string) => s.trim()) : [];
  }, [formData.giay_phep_lai_xe]);

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

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    const userIdDonVi = user.id_don_vi || (user as any).idDonVi;
    if (userIdDonVi === 'ALL' || String(user.quyen).toLowerCase() === 'admin') return donViList.map(dv => dv.id);
    
    const level1 = [userIdDonVi];
    const level2 = donViList.filter(dv => level1.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const level3 = donViList.filter(dv => level2.includes(dv.cap_quan_ly)).map(dv => dv.id);
    const allAllowed = [...level1, ...level2, ...level3];
    return donViList.filter(dv => allAllowed.includes(dv.id)).map(dv => dv.id);
  }, [user, donViList]);

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

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]);
  };

  const getAllSubordinateIds = (unitId: string, allUnits: DonVi[]): string[] => {
    const subordinates = allUnits.filter(u => u.cap_quan_ly === unitId);
    let ids = subordinates.map(u => u.id);
    subordinates.forEach(sub => { ids = [...ids, ...getAllSubordinateIds(sub.id, allUnits)]; });
    return ids;
  };

  const selectedUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViList]);

  // LỌC DANH SÁCH NHÂN SỰ CHUNG
  const filteredPersonnel = useMemo(() => {
    let result = data.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) result = result.filter(item => selectedUnitSubordinates.includes(item.id_don_vi));
    
    if (personnelSearchTerm) {
      const lower = personnelSearchTerm.toLowerCase();
      result = result.filter(item => 
        String(item.ma_so_nhan_vien || '').toLowerCase().includes(lower) || 
        String(item.ho_ten || '').toLowerCase().includes(lower) || 
        String(donViMap[String(item.id_don_vi)] || '').toLowerCase().includes(lower) ||
        String(item.chuc_vu || '').toLowerCase().includes(lower) ||
        String(item.phong_ban || '').toLowerCase().includes(lower) 
      );
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
  }, [data, personnelSearchTerm, selectedUnitFilter, allowedDonViIds, donViMap, selectedUnitSubordinates]);

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
  // 🟢 COMPONENT CON: POPUP HOVER CHUYÊN DỤNG CHO BẢNG MA TRẬN (Sửa hiển thị dưới con trỏ & Ghim tiêu đề)
  const HoverTablePopover = ({ list, title }: { list: any[], title: string }) => {
    if (!list || list.length === 0) return null;
    return (
      // 1. Đổi 'bottom-full pb-2' thành 'top-full pt-2' để thả XUỐNG ngay dưới con trỏ
      // 2. Nâng z-index lên [999] để đảm bảo luôn nổi lên trên cùng
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-64 z-[999] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 cursor-default">
        
        {/* 3. Dùng flex-col và max-h để tạo bộ khung: Tiêu đề đứng im, Danh sách cuộn mượt */}
        <div className="bg-white border border-gray-300 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] text-left pointer-events-auto flex flex-col max-h-[250px]">
          
          {/* PHẦN TIÊU ĐỀ (Ghim cứng nhờ shrink-0) */}
          <div className="p-2 font-black text-[10px] uppercase border-b border-gray-200 bg-[#e8f0fe] text-[#05469B] rounded-t-xl shrink-0">
            {title} ({list.length})
          </div>

          {/* PHẦN DANH SÁCH (Được phép cuộn nhờ flex-1 và overflow-y-auto) */}
          <div className="overflow-y-auto custom-scrollbar p-1 flex-1">
            <ul className="divide-y divide-gray-50">
              {list.map((p, idx) => (
                <li key={idx} className="p-2 flex flex-col gap-0.5 hover:bg-blue-50 transition-colors">
                  <span className="text-[11px] font-bold text-[#05469B]">{p.ho_ten}</span>
                  <span className="text-[9px] text-gray-500 font-medium leading-tight">{p.chuc_vu}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    );
  };

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

  useEffect(() => { setCurrentPage(1); }, [selectedUnitFilter, personnelSearchTerm]);

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

  const handleView = (item: any) => { setViewData(item); setShowNgachLuong(false); setIsViewModalOpen(true); };

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
      const dvht = unitStaff.find(p => p.phan_loai === 'PT DVHT KD' || String(p.chuc_vu).toLowerCase().includes('dvht')) || {};
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

  const renderUnitTree = (parent: DonVi, level: number = 1) => {
    const children = getChildUnits(parent.id);
    const isExpanded = expandedParents.includes(parent.id) || !!unitSearchTerm;
    const isParentDimmed = parent.trang_thai === 'Đại lý' || parent.trang_thai === 'Đầu tư mới';
    return (
      <div key={parent.id} className={level === 1 ? "mb-1" : "mt-1"}>
        <button onClick={() => { setSelectedUnitFilter(parent.id); if (children.length > 0) toggleParent(parent.id); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedUnitFilter === parent.id ? 'bg-blue-50 text-[#05469B]' : 'text-gray-700 hover:bg-gray-50'} ${isParentDimmed ? 'opacity-50' : ''}`}>
          {children.length > 0 ? (isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />) : <div className="w-4 shrink-0" />}
          <span className="shrink-0">{getUnitEmoji(parent.loai_hinh)}</span><span className="truncate text-left">{parent.ten_don_vi}</span>
        </button>
        {isExpanded && children.length > 0 && (<div className={`mt-1 border-l-2 border-gray-100 pl-2 space-y-1 ${level === 1 ? 'ml-6' : 'ml-4'}`}>{children.map(child => renderUnitTree(child, level + 1))}</div>)}
      </div>
    );
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
      const lanhDaoRoles = ['Lãnh đạo', 'Chủ tịch', 'Tổng Giám đốc', 'Phó Tổng Giám đốc', 'Giám đốc', 'Phó Giám đốc', 'Trưởng phòng', 'Trưởng bộ phận', 'Phó phòng'];
      targetPersonnel = activeStaff.filter(p => lanhDaoRoles.includes(p.phan_loai || ''));
    } else if (type === 'pt_qtvp') {
      targetPersonnel = activeStaff.filter(p => p.phan_loai === 'PT DVHT KD');
    } else if (type === 'pt_ns') {
      targetPersonnel = activeStaff.filter(p => p.phan_loai === 'PT NS');
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
    <div className="flex h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (<button onClick={() => setIsListCollapsed(false)} className="absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all" title="Mở bộ lọc đơn vị"><PanelLeftOpen size={20} /></button>)}

      {/* CỘT TRÁI (BỘ LỌC) */}
      <div className={`${isListCollapsed ? 'w-0 opacity-0 -ml-80 lg:ml-0' : 'w-80 opacity-100 absolute lg:relative inset-y-0 left-0'} transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl lg:shadow-sm z-50 lg:z-10 shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-[#05469B] flex items-center gap-2 whitespace-nowrap"><MapPin size={20} /> Bộ lọc Đơn vị</h2>
            <button onClick={() => setIsListCollapsed(true)} className="p-1.5 text-gray-400 hover:text-[#05469B] hover:bg-blue-50 rounded-md transition-colors"><PanelLeftClose size={18} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Tìm tên showroom..." className="w-full pl-9 pr-4 py-2 bg-[#FFFFF0] border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#05469B] outline-none" value={unitSearchTerm} onChange={(e) => setUnitSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-w-[319px]">
          <button onClick={() => { setSelectedUnitFilter(null); if(window.innerWidth < 1024) setIsListCollapsed(true); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${selectedUnitFilter === null ? 'bg-blue-50 text-[#05469B] border border-blue-100' : 'text-gray-700 hover:bg-gray-50'}`}>
            <Users size={18} className={selectedUnitFilter === null ? 'text-[#05469B]' : 'text-gray-400'} /> Tất cả Nhân sự Toàn quốc
          </button>
          <hr className="border-gray-100 mb-4 mx-2"/>

          {parentUnits.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500">Không tìm thấy đơn vị.</div>
          ) : (
            <>
              {vpdhUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">VPĐH</p>{vpdhUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
              {ctttNamUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">CTTT Phía Nam</p>{ctttNamUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
              {ctttBacUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-[#05469B] uppercase tracking-wider mb-2">CTTT Phía Bắc</p>{ctttBacUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
              {otherUnits.length > 0 && (<div className="mb-6"><p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Đơn vị khác</p>{otherUnits.map(dv => renderUnitTree(dv, 1))}</div>)}
            </>
          )}
        </div>
      </div>

      {/* 🟢 NỘI DUNG CHÍNH (CỘT PHẢI) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 flex flex-col">
        <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'pl-10 lg:pl-12' : ''}`}>
          <div>
            <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Users size={28} /> Quản lý Nhân sự</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredPersonnel.length} nhân sự)</p>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full xl:w-auto">
            {/* HÀNG 1: TÌM KIẾM & THAO TÁC */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input type="text" placeholder="Tìm Mã NV, Họ Tên, Chức vụ..." className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-[#05469B] outline-none shadow-sm text-[11px] font-medium" value={personnelSearchTerm} onChange={(e) => setPersonnelSearchTerm(e.target.value)} />
              </div>
              
              {user?.quyen === 'ADMIN' && (
                <>
                  <button onClick={() => { if (!selectedUnitFilter) { toast.warning("Vui lòng chọn 1 Đơn vị!"); return; } setIsBulkImportOpen(true); }} className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-[11px] font-bold shadow-sm transition-all whitespace-nowrap"><ClipboardPaste size={14} /> Thêm Hàng loạt</button>
                  <button onClick={() => openModal('create')} className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-[#05469B] hover:bg-[#04367a] text-white px-3 py-1.5 rounded text-[11px] font-bold shadow-sm transition-all whitespace-nowrap"><Plus size={14} /> Thêm Mới</button>
                </>
              )}
              <button onClick={() => setIsExportModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-[11px] font-bold shadow-sm transition-all whitespace-nowrap"><FileSpreadsheet size={14} /> Xuất Danh bạ</button>
            </div>
            
            {/* 🟢 HÀNG 2: COPY MAIL (NÚT DROPDOWN GỘP LỆNH COPY CHUNG) */}
            <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto relative z-50">
              <button 
                onClick={() => setIsCopyEmailDropdownOpen(!isCopyEmailDropdownOpen)} 
                className="px-4 py-2 bg-blue-50 text-[#05469B] hover:bg-blue-100 rounded-xl font-bold flex items-center gap-2 border border-blue-200 transition-colors shadow-sm whitespace-nowrap"
              >
                <Copy size={16}/> Copy Email <ChevronDown size={14} className={`transition-transform duration-200 ${isCopyEmailDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCopyEmailDropdownOpen && (
                <>
                  {/* Lớp phủ */}
                  <div className="fixed inset-0 z-[40]" onClick={() => { setIsCopyEmailDropdownOpen(false); setSelectedNgach([]); setSelectedDiaDiem([]); }}></div>
                  
                  {/* Khung Dropdown Chính */}
                  <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white shadow-2xl rounded-xl border border-gray-200 z-[50] w-[280px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                    
                    {/* BỘ KHUNG CUỘN CHỨA CÁC LỰA CHỌN */}
                    <div className="max-h-[55vh] overflow-y-auto custom-scrollbar flex flex-col">
                      
                      {/* --- PHẦN 1: COPY CHỨC DANH --- */}
                      <div className="p-2 font-bold text-[10px] text-gray-500 uppercase bg-gray-50 border-b border-gray-100 shrink-0 sticky top-0 z-20">Theo chức danh (Copy ngay)</div>
                      <ul className="flex flex-col shrink-0">
                        <li><button onClick={() => handleCopyTargetEmails('lanh_dao')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-[#05469B] transition-colors border-b border-gray-50"><Briefcase size={14} className="inline mr-2 text-orange-500" /> Cấp Lãnh đạo</button></li>
                        <li><button onClick={() => handleCopyTargetEmails('pt_qtvp')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-[#05469B] transition-colors border-b border-gray-50"><ShieldCheck size={14} className="inline mr-2 text-emerald-500" /> Phụ trách QTVP & ASĐS</button></li>
                        <li><button onClick={() => handleCopyTargetEmails('pt_ns')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-[#05469B] transition-colors"><Users size={14} className="inline mr-2 text-purple-500" /> Phụ trách Nhân sự</button></li>
                      </ul>
                      
                      {/* --- PHẦN 2: CHỌN THEO NGẠCH LƯƠNG --- */}
                      {availableNgachLuong.length > 0 && (
                        <>
                          <div className="p-2 font-bold text-[10px] text-gray-500 uppercase bg-gray-50 border-y border-gray-200 shrink-0 flex justify-between items-center sticky top-0 z-20 mt-1">
                            <span>Lọc theo Ngạch Lương</span>
                            <button onClick={() => selectedNgach.length === availableNgachLuong.length ? setSelectedNgach([]) : setSelectedNgach([...availableNgachLuong])} className="text-[#05469B] hover:text-blue-700 underline text-[9px] font-black">
                              {selectedNgach.length === availableNgachLuong.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                            </button>
                          </div>
                          <ul className="flex flex-col shrink-0">
                            {availableNgachLuong.map((nl, idx) => (
                              <li key={idx}>
                                <label className="flex items-center px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors group/cb">
                                  <input type="checkbox" checked={selectedNgach.includes(nl)} onChange={() => toggleNgach(nl)} className="w-4 h-4 rounded border-gray-300 text-[#05469B] focus:ring-[#05469B] mr-3 cursor-pointer" />
                                  <span className="text-sm font-semibold text-gray-600 group-hover/cb:text-[#05469B]">Ngạch: <span className="text-[#05469B] font-black">{nl}</span></span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {/* --- PHẦN 3: CHỌN THEO ĐỊA ĐIỂM --- */}
                      {availableDiaDiem.length > 0 && (
                        <>
                          <div className="p-2 font-bold text-[10px] text-gray-500 uppercase bg-gray-50 border-y border-gray-200 shrink-0 flex justify-between items-center sticky top-0 z-20 mt-1">
                            <span>Lọc theo Địa điểm làm việc</span>
                            <button onClick={() => selectedDiaDiem.length === availableDiaDiem.length ? setSelectedDiaDiem([]) : setSelectedDiaDiem([...availableDiaDiem])} className="text-emerald-700 hover:text-emerald-800 underline text-[9px] font-black">
                              {selectedDiaDiem.length === availableDiaDiem.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                            </button>
                          </div>
                          <ul className="flex flex-col shrink-0 pb-2">
                            {availableDiaDiem.map((loc, idx) => (
                              <li key={idx}>
                                <label className="flex items-center px-4 py-2 cursor-pointer hover:bg-emerald-50 transition-colors group/cb">
                                  <input type="checkbox" checked={selectedDiaDiem.includes(loc)} onChange={() => toggleDiaDiem(loc)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 mr-3 cursor-pointer" />
                                  <span className="text-sm font-semibold text-gray-600 group-hover/cb:text-emerald-700"><span className="text-emerald-700 font-bold">{loc}</span></span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>

                    {/* --- PHẦN 4: NÚT COPY TỔNG LUÔN GHIM Ở ĐÁY --- */}
                    {(availableNgachLuong.length > 0 || availableDiaDiem.length > 0) && (
                      <div className="p-3 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-30 shrink-0">
                        <button 
                          onClick={handleCopyMultiCriteria} 
                          disabled={selectedNgach.length === 0 && selectedDiaDiem.length === 0} 
                          className="w-full py-2.5 bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:from-gray-400 disabled:to-gray-500 shadow-md"
                        >
                          <Copy size={16}/> Lọc & Copy Danh sách
                        </button>
                        
                        {(selectedNgach.length > 0 || selectedDiaDiem.length > 0) && (
                          <p className="text-center text-[10px] text-gray-500 font-semibold mt-2 leading-tight">
                            Đang chọn: {selectedNgach.length > 0 ? `${selectedNgach.length} ngạch` : ''} 
                            {selectedNgach.length > 0 && selectedDiaDiem.length > 0 ? ' & ' : ''}
                            {selectedDiaDiem.length > 0 ? `${selectedDiaDiem.length} địa điểm` : ''}
                          </p>
                        )}
                      </div>
                    )}

                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 🟢 KHU VỰC CHUYỂN TAB */}
        <div className={`border-b border-gray-200 mb-4 flex gap-6 px-1 transition-all duration-300 ${isListCollapsed ? 'ml-10 lg:ml-0' : ''} shrink-0`}>
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
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 flex flex-col flex-1 ${isListCollapsed ? 'ml-10 lg:ml-0' : ''}`}>
            <div className="overflow-x-auto w-full custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="sticky top-0 bg-[#f8fafc] z-10">
                  <tr className="border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <th className="p-4 w-24 whitespace-nowrap bg-[#f8fafc]">Mã NV</th>
                    <th className="p-4 whitespace-nowrap bg-[#f8fafc]">Họ Tên / Trạng thái</th>
                    <th className="p-4 whitespace-nowrap bg-[#f8fafc]">Đơn Vị</th>
                    <th className="p-4 whitespace-nowrap bg-[#f8fafc]">Chức vụ</th>
                    <th className="p-4 w-36 whitespace-nowrap bg-[#f8fafc]">Điện thoại</th>
                    <th className="p-4 w-32 whitespace-nowrap bg-[#f8fafc]">Thâm niên</th>
                    <th className="p-4 text-center w-48 whitespace-nowrap bg-[#f8fafc]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedPersonnel.map((item: any) => (
                    <tr key={item.id} className={`hover:bg-blue-50/50 transition-colors group ${item.trang_thai === 'Đã nghỉ việc' ? 'opacity-60 bg-gray-50' : ''}`}>
                      <td className="p-4 font-semibold text-gray-800 whitespace-nowrap">{item.ma_so_nhan_vien}</td>
                      <td className="p-4 whitespace-nowrap flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                          {item.hinh_anh ? <img src={getDirectImageLink(item.hinh_anh)} alt="" className="w-full h-full object-cover" /> : <UserIcon size={14} className="text-gray-400" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#05469B]">{item.ho_ten}</p>
                          {item.trang_thai === 'Đã nghỉ việc' && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block">Đã nghỉ việc</span>}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-700 whitespace-nowrap">{donViMap[String(item.id_don_vi)] || item.id_don_vi || '-'}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{item.chuc_vu}</td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          {item.sdt_cong_ty && <a href={`tel:${String(item.sdt_cong_ty).replace(/\D/g, '')}`} className="text-sm font-bold text-[#05469B] hover:underline flex items-center gap-1.5 w-fit"><Phone size={13} className="text-blue-400" /> {formatPhoneNumber(item.sdt_cong_ty)}</a>}
                          {item.sdt_ca_nhan && <a href={`tel:${String(item.sdt_ca_nhan).replace(/\D/g, '')}`} className="text-sm font-bold text-emerald-500 hover:underline flex items-center gap-1.5 w-fit"><Phone size={13} className="text-emerald-400" /> {formatPhoneNumber(item.sdt_ca_nhan)}</a>}
                          {!item.sdt_cong_ty && !item.sdt_ca_nhan && <span className="text-sm text-gray-400 font-medium">---</span>}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-medium text-emerald-600 whitespace-nowrap">
                        <span className={`rounded-md inline-block px-2 py-1 border ${item.trang_thai === 'Đã nghỉ việc' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50/50 border-emerald-100'}`}>{calculateSeniority(item.ngay_nhan_vien, item.trang_thai || 'Đang làm việc', item.ngay_nghi_viec || '')}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleView(item)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                          {item.trang_thai !== 'Đã nghỉ việc' && (
                            <>
                              <button onClick={() => handleDuplicate(item)} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Nhân bản (Tạo hồ sơ kiêm nhiệm)"><Copy className="w-4 h-4" /></button>
                              <button onClick={() => openModal('update', item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Sửa"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleOffboardClick(item)} className="p-2 text-orange-600 hover:bg-orange-100 rounded-md transition-colors border border-transparent hover:border-orange-200" title="Chốt nghỉ việc (Thu hồi tài sản)"><LogOut className="w-4 h-4" /></button>
                            </>
                          )}
                          {item.trang_thai === 'Đã nghỉ việc' && (
                            <>
                              <button onClick={() => { setPersonnelToRehire(item); setIsRehireModalOpen(true); }} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Vào làm lại"><RotateCcw className="w-4 h-4" /></button>
                              <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Xóa vĩnh viễn"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPersonnel.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 gap-4 shrink-0">
                <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"><ChevronLeft size={16} /></button>
                  <span className="flex items-center gap-2">Trang <input type="number" min={1} max={totalPages} value={currentPage} onChange={(e) => { let val = parseInt(e.target.value); if (!isNaN(val)) { if (val > totalPages) val = totalPages; if (val < 1) val = 1; setCurrentPage(val); } }} className="w-12 text-center border border-gray-300 rounded p-1 outline-none focus:border-[#05469B] focus:ring-1 focus:ring-[#05469B]" /> / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"><ChevronRight size={16} /></button>
                  <div className="flex items-center gap-2 ml-2 sm:ml-4 pl-2 sm:pl-4 border-l border-gray-300"><input type="number" min={1} value={rowsPerPage} onChange={(e) => { const val = e.target.value; setRowsPerPage(val === '' ? '' : parseInt(val)); setCurrentPage(1); }} className="w-16 text-center border border-gray-300 rounded p-1 outline-none focus:border-[#05469B] text-[#05469B] font-bold" /><span>dòng</span></div>
                </div>
                <div className="text-sm text-gray-500 hidden md:block">Hiển thị {(currentPage - 1) * actualRowsPerPage + 1} - {Math.min(currentPage * actualRowsPerPage, filteredPersonnel.length)} trong tổng số <span className="font-bold text-gray-800">{filteredPersonnel.length}</span> nhân sự</div>
              </div>
            )}
          </div>
        )}

        {/* 🟢 PHẦN 4 */}
        {/* 🟢 TAB THỐNG KÊ (DASHBOARD) */}
        {activeTab === 'stats' && (() => {
          // 🟢 TÌM GIÁ TRỊ LỚN NHẤT ĐỂ CHIA TỶ LỆ CỘT RÕ RÀNG HƠN
          const maxSeniority = Math.max(0, ...(Object.values(stats.seniority) as number[]));
          const maxAge = Math.max(0, ...(Object.values(stats.ageGroups) as number[]));

          return (
            <div className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ${isListCollapsed ? 'ml-10 lg:ml-0' : ''}`}>
              
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
                {/* Ẩn hẳn thanh cuộn ngang bằng overflow-x-hidden */}
                <div className="overflow-x-hidden">
                  <table className="w-full table-fixed text-center text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-[#fff2cc] font-black text-[#002060]">
                        {/* Chia tỷ lệ cột: Cột đầu 24%, 2 khối giữa mỗi khối 30%, Tổng 16% */}
                        <th className="p-1 border border-gray-300 w-[24%]" rowSpan={2}>BỘ PHẬN / PHÂN LOẠI</th>
                        <th className="p-1 border border-gray-300 w-[30%]" colSpan={3}>BV / ĐÓN TIẾP KH</th>
                        <th className="p-1 border border-gray-300 w-[30%]" colSpan={3}>PV HÀNH CHÍNH</th>
                        <th className="p-1 border border-gray-300 w-[16%]" rowSpan={2}>TỔNG<br/>CỘNG</th>
                      </tr>
                      <tr className="bg-[#fff2cc] font-black text-[#002060] leading-none text-[9px]">
                        <th className="p-0.5 border border-gray-300 break-words">NV</th>
                        <th className="p-0.5 border border-gray-300 break-words">T.Trưởng<br/>T.Phó</th>
                        <th className="p-0.5 border border-gray-300 text-emerald-700 break-words">Cộng<br/>BV</th>
                        <th className="p-0.5 border border-gray-300 break-words">NV</th>
                        <th className="p-0.5 border border-gray-300 break-words">T.Trưởng<br/>T.Phó</th>
                        <th className="p-0.5 border border-gray-300 text-blue-700 break-words">Cộng<br/>HC</th>
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
                              <td className={`p-1 border border-gray-300 ${nameClass} leading-tight text-[9px]`}>{row.name}</td>
                              <td className="p-0.5 border border-gray-300">{row.stats.bv_nv > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.bv_nv}<HoverTablePopover list={row.stats.lists.bv_nv} title="Bảo vệ - Nhân viên" /></div>) : (isRegion ? 0 : '')}</td>
                              <td className="p-0.5 border border-gray-300">{row.stats.bv_tt_tp > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.bv_tt_tp}<HoverTablePopover list={row.stats.lists.bv_tt_tp} title="Bảo vệ - Tổ trưởng/Phó" /></div>) : (isRegion ? 0 : '')}</td>
                              <td className={`p-0.5 border border-gray-300 ${isRegion ? 'text-emerald-700 bg-emerald-50/50' : 'text-emerald-600 font-semibold'}`}>{row.stats.totalBV > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.totalBV}<HoverTablePopover list={row.stats.lists.totalBV} title="Tổng Bảo vệ" /></div>) : 0}</td>
                              <td className="p-0.5 border border-gray-300">{row.stats.pvhc_nv > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.pvhc_nv}<HoverTablePopover list={row.stats.lists.pvhc_nv} title="PVHC - Nhân viên" /></div>) : (isRegion ? 0 : '')}</td>
                              <td className="p-0.5 border border-gray-300">{row.stats.pvhc_tt_tp > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.pvhc_tt_tp}<HoverTablePopover list={row.stats.lists.pvhc_tt_tp} title="PVHC - Tổ trưởng/Phó" /></div>) : (isRegion ? 0 : '')}</td>
                              <td className={`p-0.5 border border-gray-300 ${isRegion ? 'text-blue-700 bg-blue-50/50' : 'text-blue-600 font-semibold'}`}>{row.stats.totalPVHC > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.totalPVHC}<HoverTablePopover list={row.stats.lists.totalPVHC} title="Tổng PVHC" /></div>) : 0}</td>
                              <td className={`p-0.5 border border-gray-300 ${isRegion ? 'font-black' : 'font-bold text-gray-700'}`}>{row.stats.totalRow > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{row.stats.totalRow}<HoverTablePopover list={row.stats.lists.totalRow} title="Tổng cộng Hàng" /></div>) : 0}</td>
                            </tr>
                          );
                        })
                      ) : (<tr><td colSpan={8} className="p-4 text-gray-400 italic text-center">Không có dữ liệu phù hợp</td></tr>)}

                      {/* DÒNG TỔNG CỘNG TOÀN BẢNG 1 */}
                      {crossTabStats.grandTotal && (
                        <tr className="bg-[#fff2cc] font-black text-[#002060]">
                          <td className="p-1 border border-gray-300 text-center text-[9px]">TỔNG CỘNG</td>
                          <td className="p-0.5 border border-gray-300">{crossTabStats.grandTotal.bv_nv > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.bv_nv}<HoverTablePopover list={crossTabStats.grandTotal.lists.bv_nv} title="Tổng BV - NV" /></div>) : 0}</td>
                          <td className="p-0.5 border border-gray-300">{crossTabStats.grandTotal.bv_tt_tp > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.bv_tt_tp}<HoverTablePopover list={crossTabStats.grandTotal.lists.bv_tt_tp} title="Tổng BV - TT/TP" /></div>) : 0}</td>
                          <td className="p-0.5 border border-gray-300 text-emerald-700">{crossTabStats.grandTotal.totalBV > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.totalBV}<HoverTablePopover list={crossTabStats.grandTotal.lists.totalBV} title="TỔNG BẢO VỆ" /></div>) : 0}</td>
                          <td className="p-0.5 border border-gray-300">{crossTabStats.grandTotal.pvhc_nv > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.pvhc_nv}<HoverTablePopover list={crossTabStats.grandTotal.lists.pvhc_nv} title="Tổng PVHC - NV" /></div>) : 0}</td>
                          <td className="p-0.5 border border-gray-300">{crossTabStats.grandTotal.pvhc_tt_tp > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.pvhc_tt_tp}<HoverTablePopover list={crossTabStats.grandTotal.lists.pvhc_tt_tp} title="Tổng PVHC - TT/TP" /></div>) : 0}</td>
                          <td className="p-0.5 border border-gray-300 text-blue-700">{crossTabStats.grandTotal.totalPVHC > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.totalPVHC}<HoverTablePopover list={crossTabStats.grandTotal.lists.totalPVHC} title="TỔNG PVHC" /></div>) : 0}</td>
                          <td className="p-0.5 border border-gray-300 text-red-600 text-[10px]">{crossTabStats.grandTotal.totalRow > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{crossTabStats.grandTotal.totalRow}<HoverTablePopover list={crossTabStats.grandTotal.lists.totalRow} title="TỔNG CỘNG HỆ THỐNG" /></div>) : 0}</td>
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
                {/* Ẩn hẳn thanh cuộn ngang bằng overflow-x-hidden */}
                <div className="overflow-x-hidden">
                  <table className="w-full table-fixed text-center text-[10px] border-collapse">
                    <thead>
                      <tr>
                        {/* Ép cứng cột Bộ phận chiếm 22% */}
                        <th className="p-1 border border-gray-200 bg-[#f8fafc] text-left align-bottom font-black text-[#05469B] uppercase sticky left-0 z-20 w-[22%]" rowSpan={2}>BỘ PHẬN</th>
                        {deptTabStats.groupedColumns.map((group, idx) => (
                          <th key={idx} colSpan={group.activeRoles.length} className={`p-1 border font-black uppercase tracking-tighter text-[9px] leading-tight ${group.headerColor}`}>
                            {group.label}
                          </th>
                        ))}
                        {/* Ép cứng cột Tổng cộng chiếm 6% */}
                        <th className="p-1 border border-red-200 bg-red-50 text-red-700 align-bottom font-black text-[9px] w-[6%]" rowSpan={2}>TỔNG</th>
                      </tr>
                      <tr>
                        {deptTabStats.groupedColumns.map((group) => (
                          group.activeRoles.map(col => (
                            // Dùng break-words và text-[8px] để bẻ dòng các chức danh dài, ko cho giãn cột
                            <th key={col} className={`p-0.5 border border-gray-200 font-bold text-gray-700 leading-none text-[8px] break-words ${group.color}`}>
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
                            <td className="p-1 border-r border-gray-200 text-left font-bold text-gray-700 bg-white sticky left-0 z-10 leading-tight text-[9px]">
                              {row}
                            </td>
                            
                            {deptTabStats.groupedColumns.map((group) => (
                              group.activeRoles.map(col => {
                                const val = deptTabStats.deptMap[row][col];
                                const list = deptTabStats.deptListMap[row][col];
                                return (
                                  <td key={col} className={`p-0.5 border-r border-gray-200 text-gray-700 ${group.color} ${val > 0 ? 'font-semibold' : 'text-gray-300'}`}>
                                    {val > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{val}<HoverTablePopover list={list} title={`${col} - ${row}`} /></div>) : '-'}
                                  </td>
                                );
                              })
                            ))}

                            <td className="p-1 border-l border-red-200 font-black text-red-600 bg-red-50/30">
                              {deptTabStats.deptMap[row].total > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{deptTabStats.deptMap[row].total}<HoverTablePopover list={deptTabStats.deptListMap[row].total} title={`Tổng NV: ${row}`} /></div>) : 0}
                            </td>
                          </tr>
                        ))
                      ) : (<tr><td colSpan={100} className="p-6 text-gray-400 italic text-center">Chưa có dữ liệu</td></tr>)}

                      {/* DÒNG TỔNG CỘNG CHỐT BẢNG 2 */}
                      {deptTabStats.rows.length > 0 && (
                        <tr className="border-t-2 border-gray-300 bg-gray-100">
                          <td className="p-1.5 border-r border-gray-200 text-center font-black text-[#05469B] uppercase sticky left-0 z-20 bg-gray-100 text-[9px]">TỔNG</td>
                          {deptTabStats.groupedColumns.map((group) => (
                            group.activeRoles.map(col => (
                              <td key={col} className={`p-0.5 border-r border-gray-200 font-black text-gray-800 ${group.color}`}>
                                {deptTabStats.colTotals[col] > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{deptTabStats.colTotals[col]}<HoverTablePopover list={deptTabStats.colLists[col]} title={`Tổng ${col} toàn bộ`} /></div>) : 0}
                              </td>
                            ))
                          ))}
                          <td className="p-1 border-l border-red-200 text-[10px] font-black text-white bg-red-500 shadow-inner">
                            {deptTabStats.grandTotal > 0 ? (<div className="relative group cursor-help w-full h-full flex items-center justify-center">{deptTabStats.grandTotal}<HoverTablePopover list={deptTabStats.grandTotalList} title="TỔNG NHÂN SỰ TOÀN HỆ THỐNG" /></div>) : 0}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] rounded-t-2xl text-white shrink-0">
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
                    {viewData.sdt_ca_nhan && (<a href={`tel:${String(viewData.sdt_ca_nhan).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-emerald-50 px-2 py-1 rounded text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"><Phone size={16} className="text-emerald-500"/> SĐT Cá nhân: <span className="font-bold">{formatPhoneNumber(viewData.sdt_ca_nhan)}</span></a>)}
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
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngạch lương</p><div className="flex items-center gap-1.5"><p className={`font-semibold ${showNgachLuong ? 'text-[#05469B]' : 'text-gray-400 tracking-widest mt-1'}`}>{showNgachLuong ? (viewData.ngach_luong || '---') : '••••••'}</p>{(viewData.ngach_luong && viewData.ngach_luong.trim() !== '') && (<button onClick={() => setShowNgachLuong(!showNgachLuong)} className="text-gray-400 hover:text-[#05469B] transition-colors" title={showNgachLuong ? "Ẩn ngạch lương" : "Hiện ngạch lương"}>{showNgachLuong ? <EyeOff size={14} /> : <Eye size={14} />}</button>)}</div></div>
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
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Thu nhập:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{formatCurrency(viewData.thu_nhap) || '---'} VNĐ</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Ngoại hình:</span><span className="font-semibold text-gray-800 text-sm sm:text-right whitespace-pre-wrap flex-1">{viewData.mo_to_ngoai_hinh || '---'}</span></div>
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
                      <span className="font-black text-emerald-700 text-base">{viewData.gia_tri_den ? new Date(viewData.gia_tri_den).toLocaleDateString('vi-VN') : '...'}</span>
                    </p>
                  </div>
                </div>
              )}

            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end shrink-0">
              <button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 MODAL THÊM MỚI / CHỈNH SỬA */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold text-[#05469B]">{modal.mode === 'create' ? 'Thêm Hồ sơ' : 'Cập nhật Hồ sơ'}</h3>
              <button onClick={() => setModal(prev => ({ ...prev, isOpen: false }))} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="bg-blue-50/40 p-4 sm:p-5 rounded-xl border border-blue-100">
                <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-[#05469B] rounded-full"></div> Thông tin cá nhân</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Mã NV *</label><input type="text" required name="ma_so_nhan_vien" value={formData.ma_so_nhan_vien || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Họ và Tên *</label><input type="text" required name="ho_ten" value={formData.ho_ten || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Giới tính</label><select name="gioi_tinh" value={formData.gioi_tinh || 'Nam'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Năm sinh</label><input type="date" name="nam_sinh" value={formData.nam_sinh ? formData.nam_sinh.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-[#05469B] mb-1">SĐT Công ty (Sim cấp)</label><input type="tel" name="sdt_cong_ty" value={formData.sdt_cong_ty || ''} onChange={(e) => setModal(prev => ({ ...prev, formData: {...prev.formData, sdt_cong_ty: formatPhoneNumber(e.target.value)} }))} maxLength={13} className="w-full p-2.5 border border-blue-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide text-[#05469B]" placeholder="09xx xxx xxx" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">SĐT Cá nhân</label><input type="tel" name="sdt_ca_nhan" value={formData.sdt_ca_nhan || ''} onChange={(e) => setModal(prev => ({ ...prev, formData: {...prev.formData, sdt_ca_nhan: formatPhoneNumber(e.target.value)} }))} maxLength={13} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide" placeholder="09xx xxx xxx" /></div>
                  <div className="md:col-span-1"><label className="block text-xs font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div className="md:col-span-4"><label className="block text-xs font-bold text-gray-700 mb-1">Link Ảnh Đại Diện (Google Drive)</label><div className="relative"><input type="text" name="hinh_anh" value={formData.hinh_anh || ''} onChange={handleInputChange} className="w-full p-2.5 pl-10 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Dán link chia sẻ ảnh từ Google Drive vào đây..." /><ImageIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div></div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> Công việc</h4>
                <div className="flex flex-col gap-4">
                  
                  {/* 🟢 ROW 1: Đơn vị - Bộ phận - Khối - Chức vụ - Phân loại */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1"><label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị công tác *</label><select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-sm" style={{ fontFamily: 'monospace, sans-serif' }}><option value="">-- Chọn đơn vị --</option>{buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (<option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>))}</select></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Bộ phận</label><input type="text" name="phong_ban" value={formData.phong_ban || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="VD: Phòng Kinh Doanh" /></div>
                    <div><label className="block text-xs font-bold text-[#364153] mb-1">Khối</label><input type="text" name="khoi" value={formData.khoi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-indigo-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-indigo-500" placeholder="VD: Khối Kỹ Thuật" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Chức vụ *</label><input type="text" required name="chuc_vu" value={formData.chuc_vu || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Phân loại</label>
                      <select name="phan_loai" value={formData.phan_loai || 'Chuyên viên'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="Lãnh đạo">Lãnh đạo</option>
                        <option value="Chủ tịch">Chủ tịch</option>
                        <option value="Tổng Giám đốc">Tổng Giám đốc</option>
                        <option value="Phó Tổng Giám đốc">Phó Tổng Giám đốc</option>
                        <option value="Giám đốc">Giám đốc</option>
                        <option value="Phó Giám đốc">Phó Giám đốc</option>
                        <option value="Trưởng phòng">Trưởng phòng</option>
                        <option value="Trưởng bộ phận">Trưởng bộ phận</option>
                        <option value="Phó phòng">Phó phòng</option>
                        <option value="Trợ lý">Trợ lý</option>
                        <option value="Trưởng nhóm">Trưởng nhóm</option>
                        <option value="Tổ trưởng">Tổ trưởng</option>
                        <option value="Tổ phó">Tổ phó</option>
                        <option value="Chuyên viên">Chuyên viên</option>
                        <option value="PT DVHT KD">PT DVHT KD</option>
                        <option value="PT DVHC">PT DVHC</option>
                        <option value="PT NS">PT NS</option>
                        <option value="BV, ĐTKH">BV, ĐTKH</option>
                        <option value="Nhân viên">Nhân viên</option>
                        <option value="Chưa phân loại">Chưa phân loại</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 🟢 ROW 2: Ngày nhận việc - Trình độ - Ngạch - Thu nhập - Trạng thái */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận việc</label><input type="date" name="ngay_nhan_vien" value={formData.ngay_nhan_vien ? formData.ngay_nhan_vien.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Trình độ học vấn</label><select name="trinh_do_hoc_van" value={formData.trinh_do_hoc_van || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="">-- Chọn trình độ --</option><option value="Tiểu học">Tiểu học</option><option value="Trung học cơ sở">Trung học cơ sở</option><option value="Trung học phổ thông">Trung học phổ thông</option><option value="Sơ cấp: Chứng chỉ nghề 3 tháng">Sơ cấp: Chứng chỉ nghề 3 tháng</option><option value="Sơ cấp: Chứng chỉ nghề 6 tháng">Sơ cấp: Chứng chỉ nghề 6 tháng</option><option value="Trung cấp nghề">Trung cấp nghề</option><option value="Trung cấp chuyên nghiệp">Trung cấp chuyên nghiệp</option><option value="Cao đẳng">Cao đẳng</option><option value="Đại học">Đại học</option><option value="Thạc sĩ/Tiến sĩ">Thạc sĩ/Tiến sĩ</option></select></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngạch lương</label><input type="text" name="ngach_luong" value={formData.ngach_luong || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="VD: Bậc 1" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Mức thu nhập (VNĐ)</label><input type="text" name="thu_nhap" value={formatCurrency(formData.thu_nhap)} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái làm việc</label><select name="trang_thai" value={formData.trang_thai || 'Đang làm việc'} onChange={handleInputChange} className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold ${formData.trang_thai === 'Đã nghỉ việc' ? 'text-red-600' : 'text-emerald-600'}`}><option value="Đang làm việc">Đang làm việc</option><option value="Đã nghỉ việc">Đã nghỉ việc</option></select></div>
                    
                    {formData.trang_thai === 'Đã nghỉ việc' && (<div><label className="block text-xs font-bold text-red-600 mb-1">Ngày nghỉ việc</label><input type="date" name="ngay_nghi_viec" value={formData.ngay_nghi_viec ? formData.ngay_nghi_viec.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-red-200 rounded-lg bg-red-50 outline-none focus:ring-2 focus:ring-red-500 font-bold" /></div>)}
                  </div>
                  
                  {/* 🟢 ROW 3: Bổ sung ô nhập Địa điểm làm việc cạnh Nhóm ATVSLĐ */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1"><label className="block text-xs font-bold text-[#364153] mb-1">Địa điểm làm việc</label><input type="text" name="dia_diem_lam_viec" value={formData.dia_diem_lam_viec || ''} onChange={handleInputChange} className="w-full p-2.5 border border-indigo-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-indigo-500" placeholder="VD: Hồ Chí Minh" /></div>
                    <div className="md:col-span-1"><label className="block text-xs font-bold text-gray-700 mb-1">Nhóm (ATVSLĐ)</label><select name="nhom_doi_tuong" value={formData.nhom_doi_tuong || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="">-- Chọn nhóm --</option><option value="1">Nhóm 1</option><option value="2">Nhóm 2</option><option value="3">Nhóm 3</option><option value="4">Nhóm 4</option><option value="6">Nhóm 6</option></select></div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-2">Giấy phép lái xe (Tick chọn nhiều)</label>
                <div className="bg-[#FFFFF0] border border-gray-200 rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gplxGroups.map((group, groupIdx) => (
                      <div key={groupIdx} className="space-y-2">
                        <h5 className="text-[11px] font-black text-[#05469B] uppercase border-b border-blue-100 pb-1 mb-2">{group.title}</h5>
                        <div className="flex flex-col gap-2">
                          {group.options.map((opt, optIdx) => {
                            const isChecked = currentGPLXList.includes(opt.value);
                            return (<label key={optIdx} className="flex items-start gap-2 cursor-pointer group/cb"><input type="checkbox" checked={isChecked} onChange={(e) => handleGPLXChange(opt.value, e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#05469B] focus:ring-[#05469B] cursor-pointer" /><span className={`text-sm transition-colors ${isChecked ? 'font-bold text-[#05469B]' : 'font-medium text-gray-600 group-hover/cb:text-[#05469B]'}`}>{opt.label}</span></label>);
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50/40 p-4 sm:p-5 rounded-xl border border-emerald-100">
                <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-emerald-500 rounded-full"></div> Chứng chỉ phụ trợ</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {CERTIFICATES.map(cert => {
                    const Icon = cert.icon;
                    return (<label key={cert.id} className="flex items-center p-2.5 border border-emerald-200 rounded-lg bg-[#FFFFF0] cursor-pointer hover:border-emerald-500 transition-colors shadow-sm"><input type="checkbox" name={cert.id} checked={formData[cert.id] === true || String(formData[cert.id]).toLowerCase() === 'true'} onChange={handleInputChange} className="w-4 h-4 text-emerald-600 rounded border-gray-300 mr-2 focus:ring-emerald-500" /><Icon size={16} className="text-gray-500 mr-1.5 shrink-0" /><span className="text-[11px] sm:text-xs font-bold text-gray-700 leading-tight">{cert.label}</span></label>);
                  })}
                </div>
                {formData.cc_atvsld && (
                  <div className="mt-5 p-4 sm:p-5 bg-emerald-50 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-top-2">
                    <h5 className="font-bold text-emerald-800 text-sm mb-3 flex items-center gap-2"><ShieldCheck size={16}/> Thông tin chứng nhận ATVSLĐ</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-700 mb-1">Loại chứng nhận (Tự động theo Nhóm)</label><input type="text" readOnly value={formData.chung_nhan || 'Vui lòng chọn Nhóm đối tượng ở phần Công việc'} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-emerald-100/50 text-emerald-800 font-bold outline-none cursor-not-allowed" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Huấn luyện từ ngày</label><input type="date" name="huan_luyen_tu" value={formData.huan_luyen_tu ? formData.huan_luyen_tu.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Đến ngày</label><input type="date" name="huan_luyen_den" value={formData.huan_luyen_den ? formData.huan_luyen_den.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Có giá trị đến ngày</label><input type="date" name="gia_tri_den" value={formData.gia_tri_den ? formData.gia_tri_den.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-emerald-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" /></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-orange-50/40 p-4 sm:p-5 rounded-xl border border-orange-100">
                <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-orange-500 rounded-full"></div> Thông tin Bổ sung</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Mô tả ngoại hình</label><textarea name="mo_to_ngoai_hinh" value={formData.mo_to_ngoai_hinh || ''} onChange={handleInputChange} rows={3} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú khác</label><textarea name="ghi_chu" value={formData.ghi_chu || ''} onChange={handleInputChange} rows={3} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea></div>
                </div>
              </div>
              <div className="pt-4 sm:pt-5 border-t border-gray-100 flex justify-end gap-3 mt-6 sm:mt-8">
                <button type="button" onClick={() => setModal(prev => ({ ...prev, isOpen: false }))} className="w-full sm:w-auto px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
                <button type="submit" disabled={submitting} className="w-full sm:w-auto px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Dữ Liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}