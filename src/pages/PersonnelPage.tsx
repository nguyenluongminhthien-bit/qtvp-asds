import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  Users, ShieldCheck, Flame, LifeBuoy, Heart, Activity, 
  Dumbbell, Car, Utensils, Coffee, Languages, Monitor, Copy, Eye, EyeOff, User as UserIcon, 
  Building2, Phone, Mail, Info, MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, CheckCheck, Briefcase,
  LogOut, AlertTriangle, Image as ImageIcon, RotateCcw, Download, FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/api';
import { Personnel, DonVi, ThietBi } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';

// HÀM FORMAT SỐ ĐIỆN THOẠI 4-3-3
const formatPhoneNumber = (val: string | number | undefined | null) => {
  if (!val) return '';
  const cleaned = val.toString().replace(/\D/g, ''); 
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
};

// HÀM BÓC TÁCH LINK GOOGLE DRIVE THÀNH LINK ẢNH TRỰC TIẾP
const getDirectImageLink = (url: string) => {
  if (!url) return '';
  const match = url.match(/[-\w]{25,}/);
  if (match && match[0]) {
    return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800`;
  }
  return url; 
};

// ĐÃ KHỚP 100% ID CHỨNG CHỈ VỚI BẢNG SUPABASE
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

  const [modal, setModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'update';
    formData: any;
  }>({ isOpen: false, mode: 'create', formData: {} });
  
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

  // --- STATE CHO TÍNH NĂNG VÀO LÀM LẠI ---
  const [isRehireModalOpen, setIsRehireModalOpen] = useState(false);
  const [personnelToRehire, setPersonnelToRehire] = useState<any | null>(null);
  const [rehireDate, setRehireDate] = useState(new Date().toISOString().split('T')[0]);

  // 🟢 STATE CHO TÍNH NĂNG XUẤT EXCEL
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportRegion, setExportRegion] = useState<'ALL' | 'NAM' | 'BAC' | 'SPECIFIC'>('ALL');

  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const formData = modal.formData;

  // 🟢 TỰ ĐỘNG CẬP NHẬT TÊN CHỨNG NHẬN ATVSLĐ DỰA VÀO NHÓM ĐỐI TƯỢNG
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
    if (value === 'Không có') {
      currentArr = isChecked ? ['Không có'] : [];
    } else {
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

  const filteredPersonnel = useMemo(() => {
    let result = data.filter(item => allowedDonViIds.includes(item.id_don_vi));
    
    if (selectedUnitFilter) {
      result = result.filter(item => selectedUnitSubordinates.includes(item.id_don_vi));
    }

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

    // 🟢 BẢNG THỨ TỰ ƯU TIÊN PHÂN LOẠI NHÂN SỰ
    const phanLoaiOrder: Record<string, number> = {
      'Lãnh đạo': 1,
      'Chủ tịch': 2,
      'Tổng Giám đốc': 3,
      'Phó Tổng Giám đốc': 4,
      'Giám đốc': 5,
      'Phó Giám đốc': 6,
      'Trưởng phòng': 7,
      'Phó phòng': 8,
      'Trưởng nhóm': 9,
      'Chuyên viên': 10,
      'PT DVHT KD': 11,
      'PT DVHC': 12,
      'PT NS': 13,
      'BV, ĐTKH': 14
    };

    return result.sort((a, b) => {
      // Ưu tiên 1: Lọc trạng thái (Người "Đã nghỉ việc" luôn nằm dưới cùng)
      if (a.trang_thai === 'Đã nghỉ việc' && b.trang_thai !== 'Đã nghỉ việc') return 1;
      if (a.trang_thai !== 'Đã nghỉ việc' && b.trang_thai === 'Đã nghỉ việc') return -1;
      
      // Ưu tiên 2: Xếp theo Phân loại (Theo đúng thứ tự 1 -> 11 ở bảng trên)
      const orderA = phanLoaiOrder[a.phan_loai || ''] || 99;
      const orderB = phanLoaiOrder[b.phan_loai || ''] || 99;
      if (orderA !== orderB) return orderA - orderB;

      // Ưu tiên 3: Nếu cùng Phân loại -> Xếp theo created_at 
      // (Tạo trước/cũ hơn sẽ hiển thị trước, tạo sau/mới hơn hiển thị sau)
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

  const handleCopyMail = (roleType: 'LD' | 'DVHT' | 'NS') => {
    let emails: string[] = [];
    filteredPersonnel.forEach(p => {
      if (!p.email || p.trang_thai === 'Đã nghỉ việc') return;
      const chucVu = String(p.chuc_vu || '').toLowerCase();
      if (roleType === 'LD' && chucVu.includes('tổng giám đốc')) { emails.push(p.email); } 
      else if (roleType === 'DVHT' && (chucVu.includes('dvht') || chucVu.includes('dịch vụ hỗ trợ'))) { emails.push(p.email); } 
      else if (roleType === 'NS' && chucVu.includes('nhân sự')) { emails.push(p.email); }
    });

    if (emails.length === 0) {
      alert('Không tìm thấy email nào phù hợp với chức vụ này trong danh sách hiện tại!'); return;
    }
    const uniqueEmails = Array.from(new Set(emails)).join('; ');
    navigator.clipboard.writeText(uniqueEmails).then(() => {
      setCopiedRole(roleType);
      setTimeout(() => setCopiedRole(null), 2000);
    });
  };

  const openModal = (mode: 'create' | 'update', item?: any) => {
    if (item) {
      setModal({ isOpen: true, mode, formData: { ...item } });
    } else {
      setModal({ 
        isOpen: true, 
        mode, 
        formData: { 
          id_don_vi: selectedUnitFilter || '' 
        } 
      });
    }
    setError(null);
  };

  const handleView = (item: any) => { 
    setViewData(item); 
    setShowNgachLuong(false); 
    setIsViewModalOpen(true); 
  };

  const handleDuplicate = (item: any) => {
    setModal({ isOpen: true, mode: 'create', formData: { ...item, id: '', chuc_vu: item.chuc_vu ? `${item.chuc_vu} (Kiêm nhiệm)` : 'Kiêm nhiệm', trang_thai: 'Đang làm việc', ngay_nghi_viec: '' } });
    setError(null);
  };

  // 🟢 HÀM LƯU DỮ LIỆU ĐÃ ĐƯỢC NÂNG CẤP: ĐỒNG BỘ TOÀN BỘ TRỪ KHỐI "CÔNG VIỆC/LƯƠNG"
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
      ...formData, 
      tuoi: calculatedTuoi, 
      tham_nien: calculateSeniority(formData.ngay_nhan_vien || '', formData.trang_thai || 'Đang làm việc', formData.ngay_nghi_viec || ''),
      trang_thai: formData.trang_thai || 'Đang làm việc'
    };

    if(!finalDataToSave.nam_sinh) finalDataToSave.nam_sinh = null;
    if(!finalDataToSave.ngay_nhan_vien) finalDataToSave.ngay_nhan_vien = null;
    if(!finalDataToSave.ngay_nghi_viec) finalDataToSave.ngay_nghi_viec = null;
    if(!finalDataToSave.ngay_vao_lam_lai) finalDataToSave.ngay_vao_lam_lai = null;

    setSubmitting(true); setError(null);
    try {
      // 1. Lưu bản ghi hiện tại
      const response = await apiService.save(finalDataToSave, modal.mode, "ns_dich_vu");
      const currentId = response.id || response.newId || finalDataToSave.id || `NS-${Date.now()}`;
      finalDataToSave.id = currentId;

      // 2. 🟢 TỰ ĐỘNG ĐỒNG BỘ KIÊM NHIỆM (Đồng bộ TẤT CẢ trừ các cột trong hình)
      if (modal.mode === 'update' && finalDataToSave.ma_so_nhan_vien) {
        const kiemNhiemList = data.filter(
          item => item.ma_so_nhan_vien === finalDataToSave.ma_so_nhan_vien && item.id !== currentId
        );

        if (kiemNhiemList.length > 0) {
          // Khai báo danh sách các trường "CẤM ĐỤNG VÀO" (Dựa trên hình ảnh yêu cầu)
          const fieldsToExclude = [
            'id',                 // Tuyệt đối không chép đè ID
            'id_don_vi',          // Đơn vị công tác
            'phong_ban',          // Bộ phận
            'chuc_vu',            // Chức vụ
            'phan_loai',          // Phân loại
            'ngach_luong',        // Ngạch lương
            'thu_nhap',           // Mức thu nhập
            'trang_thai',         // Trạng thái làm việc
            'ngay_nghi_viec',     // (Đi kèm trạng thái)
            'ngay_vao_lam_lai',   // (Đi kèm trạng thái)
          ];

          // Tạo Object chỉ chứa những trường ĐƯỢC PHÉP đồng bộ
          const syncData: any = {};
          Object.keys(finalDataToSave).forEach(key => {
            if (!fieldsToExclude.includes(key)) {
              syncData[key] = finalDataToSave[key];
            }
          });

          // Chạy vòng lặp cập nhật âm thầm các bản ghi kiêm nhiệm
          for (const kn of kiemNhiemList) {
            const updatedKN = { ...kn, ...syncData };
            await apiService.save(updatedKN, 'update', "ns_dich_vu");
            
            // Cập nhật luôn State ngoài Frontend để thấy kết quả ngay lập tức
            setData(prev => prev.map(item => item.id === updatedKN.id ? updatedKN : item));
          }
          toast.success(`Đã tự động đồng bộ thông tin cho ${kiemNhiemList.length} vị trí kiêm nhiệm!`);
        }
      }

      // 3. Cập nhật State cho bản ghi chính
      if (modal.mode === 'create') {
        setData(prev => [...prev, finalDataToSave]); 
      } else {
        setData(prev => prev.map(item => item.id === finalDataToSave.id ? finalDataToSave : item));
      }
      
      setModal(prev => ({ ...prev, isOpen: false }));  
      if (modal.mode === 'create') toast.success("Thêm mới nhân sự thành công!");
      else toast.success("Cập nhật thông tin nhân sự thành công!");

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin nhân sự!");
    } finally { 
      setSubmitting(false); 
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true); 
    setError(null);
    try {
      await apiService.delete(itemToDelete, "ns_dich_vu");
      setData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsConfirmOpen(false); 
      setItemToDelete(null); 
      toast.success("Xóa nhân sự thành công!");
    } catch (err: any) { 
      setError(err.message || 'Lỗi xóa dữ liệu.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi xóa nhân sự!");
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleConfirmRehire = async () => {
    if (!personnelToRehire) return;
    setSubmitting(true);
    try {
      const rehireData = {
        ...personnelToRehire,
        trang_thai: 'Đang làm việc',
        ngay_vao_lam_lai: rehireDate,
        ngay_nghi_viec: null, 
      };
      
      await apiService.save(rehireData, "update", "ns_dich_vu");
      setData(prev => prev.map(item => item.id === personnelToRehire.id ? rehireData : item));
      setIsRehireModalOpen(false);
      setPersonnelToRehire(null);
    } catch (err: any) {
      alert("Lỗi khi thực hiện: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOffboardClick = async (item: any) => {
    setPersonnelToOffboard(item);
    setCheckingAssets(true);
    setForceOffboard(false);
    setIsOffboardOpen(true);
    setUnreturnedAssets([]);

    try {
      const [thietBiRaw, nhatKyRaw] = await Promise.all([apiService.getThietBi(), apiService.getNhatKyThietBi()]);
      const thietBiList: ThietBi[] = thietBiRaw || [];
      const nhatKyList: any[] = nhatKyRaw || [];

      const latestLogsMap: Record<string, any> = {};
      nhatKyList.forEach(log => {
        const ttbId = log.id_ts_thiet_bi;
        if (!latestLogsMap[ttbId]) {
          latestLogsMap[ttbId] = log;
        } else {
          const currentLogDate = new Date(log.ngay_ghi_nhan).getTime();
          const savedLogDate = new Date(latestLogsMap[ttbId].ngay_ghi_nhan).getTime();
          if (currentLogDate > savedLogDate) {
            latestLogsMap[ttbId] = log;
          }
        }
      });

      const foundAssets: any[] = [];
      Object.values(latestLogsMap).forEach(log => {
        if (log.msnv_nguoi_dung === item.ma_so_nhan_vien && log.loai_nhat_ky !== 'Báo hỏng') {
          const assetInfo = thietBiList.find(tb => tb.id === log.id_ts_thiet_bi);
          if (assetInfo) {
            foundAssets.push({
              id: assetInfo.ma_tai_san || assetInfo.id,
              name: assetInfo.ten_thiet_bi,
              group: assetInfo.nhom_thiet_bi,
              sn: assetInfo.so_seri || '-',
              date: new Date(log.ngay_ghi_nhan).toLocaleDateString('vi-VN')
            });
          }
        }
      });

      setUnreturnedAssets(foundAssets);
    } catch (err) {
      console.error("Lỗi khi check tài sản:", err);
      alert("Cảnh báo: Không thể kết nối đến cơ sở dữ liệu Tài sản để kiểm tra. Vui lòng thử lại!");
      setIsOffboardOpen(false);
    } finally {
      setCheckingAssets(false);
    }
  };

  const confirmOffboard = async () => {
    if (!personnelToOffboard) return;
    
    if (unreturnedAssets.length > 0 && !forceOffboard) {
      alert("Vui lòng xác nhận đã xử lý xong tài sản trước khi cho nghỉ việc!");
      return;
    }

    setSubmitting(true);
    try {
      const offboardData = {
        ...personnelToOffboard,
        trang_thai: 'Đã nghỉ việc',
        ngay_nghi_viec: new Date().toISOString().split('T')[0]
      };
      
      await apiService.save(offboardData, "update", "ns_dich_vu");
      
      setData(prev => prev.map(item => item.id === personnelToOffboard.id ? offboardData : item));
      setIsOffboardOpen(false);
      setPersonnelToOffboard(null);
    } catch (err: any) {
      alert("Lỗi khi chốt nghỉ việc: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 🟢 HÀM XỬ LÝ XUẤT EXCEL GỘP Ô BẰNG HTML VANILLA (ĐÃ CẬP NHẬT: CHỈ CÔNG TY MẸ & SẮP XẾP THEO THỨ TỰ)
  const handleExportExcel = () => {
    // 1. Xác định Vùng xuất dữ liệu
    let unitsToExport: DonVi[] = [];
    
    const getRegion = (unitId: string): string => {
      const getAncestors = (id: string): string[] => {
         const u = donViList.find(d => d.id === id);
         if (!u || !u.cap_quan_ly || u.cap_quan_ly === 'HO') return [id];
         return [id, ...getAncestors(u.cap_quan_ly)];
      }
      const ancestors = getAncestors(unitId);
      
      const namIds = ctttNamUnits.map(u => u.id);
      const bacIds = ctttBacUnits.map(u => u.id);
      
      if (ancestors.some(id => bacIds.includes(id))) return 'Phía Bắc';
      if (ancestors.some(id => namIds.includes(id))) return 'Phía Nam';
      return 'VPĐH / Khác';
    }

    // 🟢 CHỈ LỌC LẤY CÁC CÔNG TY MẸ (Trực thuộc HO)
    const topLevelUnits = donViList.filter(dv => 
      allowedDonViIds.includes(dv.id) && 
      (dv.cap_quan_ly === 'HO' || !dv.cap_quan_ly)
    );

    if (exportRegion === 'ALL') {
      unitsToExport = topLevelUnits;
    } else if (exportRegion === 'NAM') {
      unitsToExport = topLevelUnits.filter(dv => getRegion(dv.id) === 'Phía Nam');
    } else if (exportRegion === 'BAC') {
      unitsToExport = topLevelUnits.filter(dv => getRegion(dv.id) === 'Phía Bắc');
    } else if (exportRegion === 'SPECIFIC' && selectedUnitFilter) {
      // Nếu đang chọn 1 Showroom con, tự động dò ngược lên tìm Công ty mẹ của nó để xuất
      const getTopLevelParent = (id: string): DonVi | undefined => {
        const u = donViList.find(d => d.id === id);
        if (!u) return undefined;
        if (u.cap_quan_ly === 'HO' || !u.cap_quan_ly) return u;
        return getTopLevelParent(u.cap_quan_ly);
      };
      const topParent = getTopLevelParent(selectedUnitFilter);
      if (topParent && allowedDonViIds.includes(topParent.id)) {
        unitsToExport = [topParent];
      }
    }

    // Lọc bỏ đơn vị ảo (Đại lý)
    unitsToExport = unitsToExport.filter(u => u.trang_thai !== 'Đại lý' && u.trang_thai !== 'Đầu tư mới');
    
    // 🟢 SẮP XẾP THEO CỘT thu_tu TRONG DB (Thay vì xếp theo vần A-Z)
    unitsToExport.sort((a, b) => {
       const thuTuA = Number(a.thu_tu) || 9999;
       const thuTuB = Number(b.thu_tu) || 9999;
       return thuTuA - thuTuB;
    });

    // 2. Tạo nội dung các dòng dữ liệu
    let rowsHTML = '';
    let stt = 1;

    unitsToExport.forEach(dv => {
      const phia = getRegion(dv.id);
      const tenDV = dv.ten_don_vi;

      // 🟢 GOM NHÂN SỰ TOÀN CỤM: Quét cả Công ty mẹ lẫn các Showroom con để không bỏ sót Lãnh đạo
      const subIds = getAllSubordinateIds(dv.id, donViList);
      const validIds = [dv.id, ...subIds];
      const unitStaff = data.filter(p => validIds.includes(p.id_don_vi) && p.trang_thai !== 'Đã nghỉ việc');
      
      // Dò chức vụ tương ứng
      const dvht = unitStaff.find(p => p.phan_loai === 'PT DVHT KD' || String(p.chuc_vu).toLowerCase().includes('dvht')) || {};
      const tgd = unitStaff.find(p => p.phan_loai === 'Lãnh đạo' || String(p.chuc_vu).toLowerCase().includes('tổng giám đốc') || String(p.chuc_vu).toLowerCase().includes('giám đốc')) || {};

      // Nếu công ty này hoàn toàn trống nhân sự (không có cả NV) thì có thể bỏ qua, 
      // Hoặc nếu muốn hiển thị dòng trống thì comment dòng if dưới lại.
      if (!dvht.ho_ten && !tgd.ho_ten && unitStaff.length === 0) return; 

      rowsHTML += `
        <tr>
          <td class="center">${stt++}</td>
          <td>${phia}</td>
          <td class="bold">${tenDV}</td>
          <td>${dvht.ho_ten || ''}</td>
          <td>${dvht.email || ''}</td>
          <td class="center">${dvht.sdt_cong_ty || dvht.sdt_ca_nhan ? formatPhoneNumber(dvht.sdt_cong_ty || dvht.sdt_ca_nhan) : ''}</td>
          <td>${tgd.ho_ten || ''}</td>
          <td>${tgd.email || ''}</td>
          <td class="center">${tgd.sdt_cong_ty || tgd.sdt_ca_nhan ? formatPhoneNumber(tgd.sdt_cong_ty || tgd.sdt_ca_nhan) : ''}</td>
        </tr>
      `;
    });

    // 3. Khung HTML Table với CSS mô phỏng y hệt hình ảnh mẫu
    const tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; font-family: 'Times New Roman', serif; }
          th, td { border: 1px solid #000000; padding: 6px; vertical-align: middle; }
          .header { background-color: #fff2cc; color: #002060; font-weight: bold; text-align: center; }
          .center { text-align: center; }
          .bold { font-weight: bold; color: #002060; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr class="header">
              <th rowspan="2">STT</th>
              <th rowspan="2">Phía</th>
              <th rowspan="2" style="width: 250px;">ĐƠN VỊ</th>
              <th colspan="3">PT DVHT KD</th>
              <th colspan="3">TỔNG GIÁM ĐỐC</th>
            </tr>
            <tr class="header">
              <th>Họ và tên</th>
              <th>Email</th>
              <th>SĐT</th>
              <th>Họ và tên</th>
              <th>Email</th>
              <th>SĐT</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // 4. Tạo Blob và tải file
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_Ba_Lanh_Dao_DVHT_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsExportModalOpen(false);
    toast.success("Đã xuất file Danh bạ (Excel) thành công!");
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
        <button 
          onClick={() => { setSelectedUnitFilter(parent.id); if (children.length > 0) toggleParent(parent.id); }} 
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedUnitFilter === parent.id ? 'bg-blue-50 text-[#05469B]' : 'text-gray-700 hover:bg-gray-50'} ${isParentDimmed ? 'opacity-50' : ''}`}
        >
          {children.length > 0 ? (isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />) : <div className="w-4 shrink-0" />}
          <span className="shrink-0">{getUnitEmoji(parent.loai_hinh)}</span>
          <span className="truncate text-left">{parent.ten_don_vi}</span>
        </button>
        
        {isExpanded && children.length > 0 && (
          <div className={`mt-1 border-l-2 border-gray-100 pl-2 space-y-1 ${level === 1 ? 'ml-6' : 'ml-4'}`}>
            {children.map(child => renderUnitTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all" title="Mở bộ lọc đơn vị">
          <PanelLeftOpen size={20} />
        </button>
      )}

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

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#05469B]" /></div>
          ) : parentUnits.length === 0 ? (
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

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative transition-all duration-300">
        <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'pl-10 lg:pl-12' : ''}`}>
          <div>
            <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Users size={28} /> Quản lý Nhân sự</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredPersonnel.length} nhân sự)</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Tìm Mã NV, Họ Tên, Chức vụ..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={personnelSearchTerm} onChange={(e) => setPersonnelSearchTerm(e.target.value)} />
              </div>
              <button onClick={() => openModal('create')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><Plus className="w-5 h-5" /> Thêm Mới</button>
              
              {/* 🟢 NÚT GỌI MODAL XUẤT BÁO CÁO EXCEL */}
              <button onClick={() => setIsExportModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><FileSpreadsheet className="w-5 h-5" /> Xuất Danh bạ</button>
            </div>
            
            <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto">
              <button onClick={() => handleCopyMail('LD')} className="text-[11px] font-bold px-3 py-1.5 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded flex items-center gap-1.5 transition-colors shadow-sm" title="Copy Mail Tổng Giám đốc">
                {copiedRole === 'LD' ? <CheckCheck size={14} className="text-green-600"/> : <Copy size={14} />} Copy Mail LĐ
              </button>
              <button onClick={() => handleCopyMail('DVHT')} className="text-[11px] font-bold px-3 py-1.5 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded flex items-center gap-1.5 transition-colors shadow-sm" title="Copy Mail PT DVHT">
                {copiedRole === 'DVHT' ? <CheckCheck size={14} className="text-green-600"/> : <Copy size={14} />} Copy Mail PT DVHT
              </button>
              <button onClick={() => handleCopyMail('NS')} className="text-[11px] font-bold px-3 py-1.5 border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded flex items-center gap-1.5 transition-colors shadow-sm" title="Copy Mail PT Nhân sự">
                {copiedRole === 'NS' ? <CheckCheck size={14} className="text-green-600"/> : <Copy size={14} />} Copy Mail PT NS
              </button>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-lg shadow-sm"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${isListCollapsed ? 'ml-10 lg:ml-0' : ''}`}>
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="p-4 w-24 whitespace-nowrap">Mã NV</th>
                  <th className="p-4 whitespace-nowrap">Họ Tên / Trạng thái</th>
                  <th className="p-4 whitespace-nowrap">Đơn Vị</th>
                  <th className="p-4 whitespace-nowrap">Chức vụ</th>
                  <th className="p-4 w-36 whitespace-nowrap">Điện thoại</th>
                  <th className="p-4 w-32 whitespace-nowrap">Thâm niên</th>
                  <th className="p-4 text-center w-48 whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={7} className="p-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />Đang tải dữ liệu...</td></tr>
                ) : filteredPersonnel.length === 0 ? (
                  <tr><td colSpan={7} className="p-16 text-center text-gray-500">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium">Không có nhân sự nào trong danh sách hiển thị.</p>
                  </td></tr>
                ) : (
                  filteredPersonnel.map((item: any) => (
                    <tr key={item.id} className={`hover:bg-blue-50/50 transition-colors group ${item.trang_thai === 'Đã nghỉ việc' ? 'opacity-60 bg-gray-50' : ''}`}>
                      <td className="p-4 font-semibold text-gray-800 whitespace-nowrap">{item.ma_so_nhan_vien}</td>
                      <td className="p-4 whitespace-nowrap flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                          {item.hinh_anh ? (
                            <img src={getDirectImageLink(item.hinh_anh)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={14} className="text-gray-400" />
                          )}
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
                          {item.sdt_cong_ty && (
                            <a href={`tel:${String(item.sdt_cong_ty).replace(/\D/g, '')}`} className="text-sm font-bold text-[#05469B] hover:underline flex items-center gap-1.5 w-fit" title="Gọi SĐT Công ty">
                              <Phone size={13} className="text-blue-400" /> {formatPhoneNumber(item.sdt_cong_ty)}
                            </a>
                          )}
                          {item.sdt_ca_nhan && (
                            <a href={`tel:${String(item.sdt_ca_nhan).replace(/\D/g, '')}`} className="text-sm font-bold text-emerald-500 hover:underline flex items-center gap-1.5 w-fit" title="Gọi SĐT Cá nhân">
                              <Phone size={13} className="text-emerald-400" /> {formatPhoneNumber(item.sdt_ca_nhan)}
                            </a>
                          )}
                          {!item.sdt_cong_ty && !item.sdt_ca_nhan && <span className="text-sm text-gray-400 font-medium">---</span>}
                        </div>
                      </td>

                      <td className="p-4 text-sm font-medium text-emerald-600 whitespace-nowrap">
                        <span className={`rounded-md inline-block px-2 py-1 border ${item.trang_thai === 'Đã nghỉ việc' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
                          {calculateSeniority(item.ngay_nhan_vien, item.trang_thai || 'Đang làm việc', item.ngay_nghi_viec || '')}
                        </span>
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
                              {/* NÚT VÀO LÀM LẠI */}
                              <button onClick={() => { setPersonnelToRehire(item); setIsRehireModalOpen(true); }} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors" title="Vào làm lại"><RotateCcw className="w-4 h-4" /></button>
                              <button onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Xóa vĩnh viễn"><Trash2 className="w-4 h-4" /></button>
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
        </div>
      </div>

      {/* 🟢 MODAL TÙY CHỌN XUẤT EXCEL DANH BẠ LÃNH ĐẠO */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-black text-emerald-700 flex items-center gap-2">
                <FileSpreadsheet size={24}/> Xuất Excel Danh bạ
              </h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              Bạn muốn tải xuống danh bạ (Gồm Lãnh đạo & PT Dịch vụ Hỗ trợ) của khu vực nào?
            </p>
            
            <div className="flex flex-col gap-3 mb-6">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'ALL' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="radio" name="exportRegion" checked={exportRegion === 'ALL'} onChange={() => setExportRegion('ALL')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                <span className="font-bold text-gray-800">Toàn quốc (Toàn bộ Hệ thống)</span>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'NAM' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="radio" name="exportRegion" checked={exportRegion === 'NAM'} onChange={() => setExportRegion('NAM')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                <span className="font-bold text-gray-800">CTTT Phía Nam (Các tỉnh Miền Nam)</span>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'BAC' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="radio" name="exportRegion" checked={exportRegion === 'BAC'} onChange={() => setExportRegion('BAC')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                <span className="font-bold text-gray-800">CTTT Phía Bắc (Các tỉnh Miền Bắc)</span>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${exportRegion === 'SPECIFIC' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <input type="radio" name="exportRegion" checked={exportRegion === 'SPECIFIC'} onChange={() => setExportRegion('SPECIFIC')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                <span className="font-bold text-gray-800 flex-1">
                  Đơn vị đang xem: <span className="text-emerald-600">{selectedUnitName}</span>
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
              <button onClick={handleExportExcel} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg">
                <Download size={20}/> Tải File .XLS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 [MODAL: OFFBOARDING & THU HỒI TÀI SẢN] */}
      {isOffboardOpen && personnelToOffboard && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
            <div className="bg-orange-500 text-white p-5 flex items-start justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0 border border-white/40"><LogOut size={24}/></div>
                <div>
                  <h3 className="text-xl font-black mb-1">Xác nhận Nghỉ việc</h3>
                  <p className="text-orange-100 text-sm font-medium">{personnelToOffboard.ho_ten} - {personnelToOffboard.ma_so_nhan_vien}</p>
                </div>
              </div>
              <button onClick={() => setIsOffboardOpen(false)} className="text-orange-100 hover:text-white p-1 rounded-full"><X size={24}/></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {personnelToOffboard.sdt_cong_ty && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 mb-4">
                  <Phone className="text-yellow-600 shrink-0 w-6 h-6"/>
                  <div>
                    <h4 className="font-black text-yellow-800 mb-1">CẢNH BÁO: Thu hồi SIM Công ty!</h4>
                    <p className="text-sm text-yellow-700 font-medium">
                      Nhân sự này đang được cấp số điện thoại: <span className="font-black text-yellow-900">{formatPhoneNumber(personnelToOffboard.sdt_cong_ty)}</span>. 
                      Vui lòng yêu cầu bàn giao lại SIM công ty trước khi hoàn tất thủ tục nghỉ việc.
                    </p>
                  </div>
                </div>
              )}

              {checkingAssets ? (
                <div className="flex flex-col items-center justify-center py-12 border border-gray-100 rounded-xl">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                  <p className="text-gray-600 font-bold">Đang quét hệ thống Tài sản & Nhật ký...</p>
                </div>
              ) : unreturnedAssets.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 w-6 h-6"/>
                    <div>
                      <h4 className="font-black text-red-700 mb-1">CẢNH BÁO: Nhân sự đang giữ Tài sản!</h4>
                      <p className="text-sm text-red-600 font-medium mb-3">Hệ thống phát hiện nhân sự này đang là người nhận cuối cùng của các tài sản dưới đây. Vui lòng thu hồi hoặc bàn giao trước khi cho nghỉ.</p>
                      
                      <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-red-50/50">
                            <tr className="text-red-800 font-bold">
                              <th className="p-2 border-b border-red-100">Mã / Tên Tài sản</th>
                              <th className="p-2 border-b border-red-100">S/N</th>
                              <th className="p-2 border-b border-red-100 text-right">Ngày nhận</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-50">
                            {unreturnedAssets.map((asset, idx) => (
                              <tr key={idx} className="border-b border-red-50 last:border-0 hover:bg-red-50/30">
                                <td className="p-2">
                                  <p className="font-bold text-gray-800">{asset.name}</p>
                                  <p className="text-[10px] text-gray-500">{asset.id} • {asset.group}</p>
                                </td>
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
                    <input 
                      type="checkbox" 
                      checked={forceOffboard} 
                      onChange={(e) => setForceOffboard(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                    />
                    <span className="text-sm font-semibold text-gray-700">Tôi xác nhận đã thu hồi các tài sản/SIM này ngoài hệ thống, hoặc vẫn muốn chốt nghỉ việc ngay lập tức.</span>
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

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsOffboardOpen(false)} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Hủy bỏ</button>
              <button 
                onClick={confirmOffboard} 
                disabled={submitting || (unreturnedAssets.length > 0 && !forceOffboard)}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />} 
                Xác nhận Đã nghỉ việc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 VIEW MODAL (HIỂN THỊ CHI TIẾT) */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] rounded-t-2xl text-white shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2"><UserIcon size={20} /> Chi tiết Hồ sơ Nhân sự</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-white hover:text-red-300 hover:bg-white/10 rounded-full p-1.5 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 border-b border-gray-100 pb-6 text-center sm:text-left relative">
                {viewData.trang_thai === 'Đã nghỉ việc' && (
                  <div className="absolute top-0 right-0 bg-red-100 text-red-700 font-black px-3 py-1 rounded border border-red-200 flex items-center gap-1"><LogOut size={16}/> ĐÃ NGHỈ VIỆC</div>
                )}

                <div className="w-24 h-24 sm:w-28 sm:h-32 rounded-2xl bg-blue-100 text-[#05469B] flex items-center justify-center text-4xl font-black shrink-0 border-4 border-white shadow-md overflow-hidden relative">
                  {viewData.hinh_anh ? (
                    <img src={getDirectImageLink(viewData.hinh_anh)} alt={viewData.ho_ten} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Lỗi+Ảnh'; }} />
                  ) : (
                    viewData.ho_ten?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>

                <div className="flex-1 mt-2 sm:mt-0">
                  <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-3 mb-1">
                    <h2 className="text-2xl font-black text-gray-800">{viewData.ho_ten}</h2>
                    <span className="px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-bold text-gray-600">ID: {viewData.ma_so_nhan_vien}</span>
                  </div>
                  <p className="text-lg font-bold text-[#05469B] mb-3">{viewData.chuc_vu}</p>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-sm text-gray-600 font-medium">
                    {viewData.sdt_cong_ty && (
                      <a href={`tel:${String(viewData.sdt_cong_ty).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-800 border border-blue-100 hover:bg-blue-100 transition-colors">
                        <Phone size={16} className="text-blue-500"/> SĐT Cty: <span className="font-bold">{formatPhoneNumber(viewData.sdt_cong_ty)}</span>
                      </a>
                    )}
                    {viewData.sdt_ca_nhan && (
                      <a href={`tel:${String(viewData.sdt_ca_nhan).replace(/\D/g, '')}`} className="flex items-center justify-center sm:justify-start gap-1.5 bg-emerald-50 px-2 py-1 rounded text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                        <Phone size={16} className="text-emerald-500"/> SĐT Cá nhân: <span className="font-bold">{formatPhoneNumber(viewData.sdt_ca_nhan)}</span>
                      </a>
                    )}
                    <span className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 sm:mt-0"><Mail size={16} className="text-gray-400"/> {viewData.email || 'Chưa có Email'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><Building2 size={18} className="text-[#05469B]"/> Thông tin Công tác</h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Đơn vị</p><p className="font-semibold text-gray-800 break-words">{donViMap[String(viewData.id_don_vi)] || viewData.id_don_vi || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Bộ phận</p><p className="font-semibold text-gray-800">{viewData.phong_ban || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Phân loại</p><p className="font-semibold text-gray-800">{viewData.phan_loai || '---'}</p></div>
                  <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngày nhận việc</p><p className="font-semibold text-gray-800">{viewData.ngay_nhan_vien ? new Date(viewData.ngay_nhan_vien).toLocaleDateString('vi-VN') : '---'}</p></div>
                  
                  {viewData.trang_thai === 'Đã nghỉ việc' ? (
                    <div><p className="text-xs text-red-500 uppercase font-bold mb-1">Ngày nghỉ việc</p><p className="font-semibold text-red-600">{viewData.ngay_nghi_viec ? new Date(viewData.ngay_nghi_viec).toLocaleDateString('vi-VN') : '---'}</p></div>
                  ) : (
                    <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Thâm niên</p><p className="font-semibold text-emerald-600">{calculateSeniority(viewData.ngay_nhan_vien, viewData.trang_thai || 'Đang làm việc', viewData.ngay_nghi_viec || '')}</p></div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngạch lương</p>
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
                  </div>

                  {viewData.ngay_vao_lam_lai && (
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-xs text-blue-500 uppercase font-bold mb-1">Vào làm lại</p>
                      <p className="font-semibold text-blue-600">
                        {new Date(viewData.ngay_vao_lam_lai).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><UserIcon size={18} className="text-orange-500"/> Cá nhân & Ngoại hình</h4>
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Giới tính:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.gioi_tinh || '---'}</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4">
                      <span className="text-gray-500 text-sm sm:w-20 shrink-0">Năm sinh:</span>
                      <span className="font-semibold text-gray-800 text-sm sm:text-right">
                        {viewData.nam_sinh ? new Date(viewData.nam_sinh).toLocaleDateString('vi-VN') : '---'} 
                        {viewData.tuoi && <span className="ml-2 text-orange-600 font-bold">({viewData.tuoi} tuổi)</span>}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Trình độ:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{viewData.trinh_do_hoc_van || '---'}</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between border-b border-orange-100 pb-2 gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Thu nhập:</span><span className="font-semibold text-gray-800 text-sm sm:text-right">{formatCurrency(viewData.thu_nhap) || '---'} VNĐ</span></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4"><span className="text-gray-500 text-sm sm:w-20 shrink-0">Ngoại hình:</span><span className="font-semibold text-gray-800 text-sm sm:text-right whitespace-pre-wrap flex-1">{viewData.mo_to_ngoai_hinh || '---'}</span></div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><Info size={18} className="text-blue-500"/> Ghi chú khác</h4>
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex-1">
                    <p className="text-sm font-semibold text-gray-800 whitespace-pre-wrap">{viewData.ghi_chu || 'Không có ghi chú.'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 uppercase tracking-wider text-sm flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-500"/> Chứng chỉ / Kỹ năng</h4>
                <div className="flex flex-col gap-3">
                  {viewData.giay_phep_lai_xe && viewData.giay_phep_lai_xe !== 'Không có' && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm font-bold text-gray-600 mr-1 shrink-0">Bằng lái xe:</span>
                      {viewData.giay_phep_lai_xe.split(',').map((bang: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 bg-blue-100 text-[#05469B] font-black rounded-md text-xs border border-blue-200">
                          Hạng {bang.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {CERTIFICATES.filter(cert => viewData[cert.id]).length > 0 ? (
                      CERTIFICATES.filter(cert => viewData[cert.id]).map(cert => {
                        const Icon = cert.icon;
                        return (
                          <div key={cert.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-bold shadow-sm">
                            <Icon size={16} /> {cert.label}
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-400 italic">Chưa cập nhật chứng chỉ khác.</p>
                    )}
                  </div>

                  {/* HIỂN THỊ CHI TIẾT ATVSLĐ GỌN TRONG 1 DÒNG */}
                  {viewData.cc_atvsld && viewData.chung_nhan && (
                    <div className="mt-2 p-3 sm:p-4 bg-emerald-50 rounded-xl border border-emerald-100 w-full flex flex-col gap-2">
                      <p className="font-bold text-emerald-800 text-sm">🏅 {viewData.chung_nhan}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-700 font-medium">
                        {viewData.nhom_doi_tuong && (
                          <>
                            <span className="font-bold text-[#05469B]">Nhóm {viewData.nhom_doi_tuong}</span>
                            <span className="text-gray-300 hidden sm:inline">|</span>
                          </>
                        )}
                        <span>
                          Khoá huấn luyện: <span className="font-bold">
                            {viewData.huan_luyen_tu ? new Date(viewData.huan_luyen_tu).toLocaleDateString('vi-VN') : '---'} - {viewData.huan_luyen_den ? new Date(viewData.huan_luyen_den).toLocaleDateString('vi-VN') : '---'}
                          </span>
                        </span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>
                          Có giá trị đến: <span className="font-black text-emerald-700">
                            {viewData.gia_tri_den ? new Date(viewData.gia_tri_den).toLocaleDateString('vi-VN') : '---'}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

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
                  <div>
                    <label className="block text-xs font-bold text-[#05469B] mb-1">SĐT Công ty (Sim cấp)</label>
                    <input type="tel" name="sdt_cong_ty" value={formData.sdt_cong_ty || ''} onChange={(e) => setModal(prev => ({ ...prev, formData: {...prev.formData, sdt_cong_ty: formatPhoneNumber(e.target.value)} }))} maxLength={13} className="w-full p-2.5 border border-blue-300 rounded-lg bg-blue-50 outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide text-[#05469B]" placeholder="09xx xxx xxx" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">SĐT Cá nhân</label>
                    <input type="tel" name="sdt_ca_nhan" value={formData.sdt_ca_nhan || ''} onChange={(e) => setModal(prev => ({ ...prev, formData: {...prev.formData, sdt_ca_nhan: formatPhoneNumber(e.target.value)} }))} maxLength={13} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wide" placeholder="09xx xxx xxx" />
                  </div>
                  <div className="md:col-span-1"><label className="block text-xs font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Link Ảnh Đại Diện (Google Drive)</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="hinh_anh"
                        value={formData.hinh_anh || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 pl-10 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Dán link chia sẻ ảnh từ Google Drive vào đây..."
                      />
                      <ImageIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 🟢 CÔNG VIỆC CHIA LÀM 3 DÒNG THEO THIẾT KẾ MỚI */}
              <div className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> Công việc</h4>
                <div className="flex flex-col gap-4">
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị công tác *</label>
                      <select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-sm" style={{ fontFamily: 'monospace, sans-serif' }}>
                        <option value="">-- Chọn đơn vị --</option>
                        {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Bộ phận</label>
                      <input type="text" name="phong_ban" value={formData.phong_ban || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="VD: Phòng Kinh Doanh" />
                    </div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Chức vụ *</label><input type="text" required name="chuc_vu" value={formData.chuc_vu || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Phân loại</label>
                      <select name="phan_loai" value={formData.phan_loai || 'Chuyên viên'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="Lãnh đạo">Lãnh đạo</option>
                        <option value="Giám đốc">Giám đốc</option>
                        <option value="Phó Giám đốc">Phó Giám đốc</option>
                        <option value="Trưởng phòng">Trưởng phòng</option>
                        <option value="Phó phòng">Phó phòng</option>
                        <option value="Trưởng nhóm">Trưởng nhóm</option>
                        <option value="Chuyên viên">Chuyên viên</option>
                        <option value="PT DVHT KD">PT DVHT KD</option>
                        <option value="PT DVHC">PT DVHC</option>
                        <option value="PT NS">PT NS</option>
                        <option value="BV, ĐTKH">BV, ĐTKH</option>
                      </select>
                    </div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận việc</label><input type="date" name="ngay_nhan_vien" value={formData.ngay_nhan_vien ? formData.ngay_nhan_vien.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Trình độ học vấn</label>
                      <select name="trinh_do_hoc_van" value={formData.trinh_do_hoc_van || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="">-- Chọn trình độ --</option>
                        <option value="Tiểu học">Tiểu học</option>
                        <option value="Trung học cơ sở">Trung học cơ sở</option>
                        <option value="Trung học phổ thông">Trung học phổ thông</option>
                        <option value="Sơ cấp: Chứng chỉ nghề 3 tháng">Sơ cấp: Chứng chỉ nghề 3 tháng</option>
                        <option value="Sơ cấp: Chứng chỉ nghề 6 tháng">Sơ cấp: Chứng chỉ nghề 6 tháng</option>
                        <option value="Trung cấp nghề">Trung cấp nghề</option>
                        <option value="Trung cấp chuyên nghiệp">Trung cấp chuyên nghiệp</option>
                        <option value="Cao đẳng">Cao đẳng</option>
                        <option value="Đại học">Đại học</option>
                        <option value="Thạc sĩ/Tiến sĩ">Thạc sĩ/Tiến sĩ</option>
                      </select>
                    </div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngạch lương</label><input type="text" name="ngach_luong" value={formData.ngach_luong || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="VD: Bậc 1" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Mức thu nhập (VNĐ)</label><input type="text" name="thu_nhap" value={formatCurrency(formData.thu_nhap)} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái làm việc</label>
                      <select name="trang_thai" value={formData.trang_thai || 'Đang làm việc'} onChange={handleInputChange} className={`w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold ${formData.trang_thai === 'Đã nghỉ việc' ? 'text-red-600' : 'text-emerald-600'}`}>
                        <option value="Đang làm việc">Đang làm việc</option>
                        <option value="Đã nghỉ việc">Đã nghỉ việc</option>
                      </select>
                    </div>
                    {formData.trang_thai === 'Đã nghỉ việc' && (
                      <div><label className="block text-xs font-bold text-red-600 mb-1">Ngày nghỉ việc</label><input type="date" name="ngay_nghi_viec" value={formData.ngay_nghi_viec ? formData.ngay_nghi_viec.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-red-200 rounded-lg bg-red-50 outline-none focus:ring-2 focus:ring-red-500 font-bold" /></div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nhóm (ATVSLĐ)</label>
                      <select name="nhom_doi_tuong" value={formData.nhom_doi_tuong || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]">
                        <option value="">-- Chọn nhóm --</option>
                        <option value="1">Nhóm 1</option>
                        <option value="2">Nhóm 2</option>
                        <option value="3">Nhóm 3</option>
                        <option value="4">Nhóm 4</option>
                        <option value="6">Nhóm 6</option>
                      </select>
                    </div>
                  </div>

                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-2">Giấy phép lái xe (Tick chọn nhiều)</label>
                <div className="bg-[#FFFFF0] border border-gray-200 rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gplxGroups.map((group, groupIdx) => (
                      <div key={groupIdx} className="space-y-2">
                        <h5 className="text-[11px] font-black text-[#05469B] uppercase border-b border-blue-100 pb-1 mb-2">
                          {group.title}
                        </h5>
                        <div className="flex flex-col gap-2">
                          {group.options.map((opt, optIdx) => {
                            const isChecked = currentGPLXList.includes(opt.value);
                            return (
                              <label key={optIdx} className="flex items-start gap-2 cursor-pointer group/cb">
                                <input type="checkbox" checked={isChecked} onChange={(e) => handleGPLXChange(opt.value, e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#05469B] focus:ring-[#05469B] cursor-pointer" />
                                <span className={`text-sm transition-colors ${isChecked ? 'font-bold text-[#05469B]' : 'font-medium text-gray-600 group-hover/cb:text-[#05469B]'}`}>{opt.label}</span>
                              </label>
                            );
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
                    return (
                      <label key={cert.id} className="flex items-center p-2.5 border border-emerald-200 rounded-lg bg-[#FFFFF0] cursor-pointer hover:border-emerald-500 transition-colors shadow-sm">
                        <input type="checkbox" name={cert.id} checked={formData[cert.id] === true || String(formData[cert.id]).toLowerCase() === 'true'} onChange={handleInputChange} className="w-4 h-4 text-emerald-600 rounded border-gray-300 mr-2 focus:ring-emerald-500" />
                        <Icon size={16} className="text-gray-500 mr-1.5 shrink-0" />
                        <span className="text-[11px] sm:text-xs font-bold text-gray-700 leading-tight">{cert.label}</span>
                      </label>
                    );
                  })}
                </div>

                {/* FORM NHẬP NGÀY THÁNG ATVSLĐ */}
                {formData.cc_atvsld && (
                  <div className="mt-5 p-4 sm:p-5 bg-emerald-50 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-top-2">
                    <h5 className="font-bold text-emerald-800 text-sm mb-3 flex items-center gap-2"><ShieldCheck size={16}/> Thông tin chứng nhận ATVSLĐ</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Loại chứng nhận (Tự động theo Nhóm)</label>
                        <input type="text" readOnly value={formData.chung_nhan || 'Vui lòng chọn Nhóm đối tượng ở phần Công việc'} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-emerald-100/50 text-emerald-800 font-bold outline-none cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Huấn luyện từ ngày</label>
                        <input type="date" name="huan_luyen_tu" value={formData.huan_luyen_tu ? formData.huan_luyen_tu.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Đến ngày</label>
                        <input type="date" name="huan_luyen_den" value={formData.huan_luyen_den ? formData.huan_luyen_den.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Có giá trị đến ngày</label>
                        <input type="date" name="gia_tri_den" value={formData.gia_tri_den ? formData.gia_tri_den.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2.5 border border-emerald-300 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-orange-50/40 p-4 sm:p-5 rounded-xl border border-orange-100">
                <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-orange-500 rounded-full"></div> Thông tin Bổ sung</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả ngoại hình</label>
                    <textarea name="mo_to_ngoai_hinh" value={formData.mo_to_ngoai_hinh || ''} onChange={handleInputChange} rows={3} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú khác</label>
                    <textarea name="ghi_chu" value={formData.ghi_chu || ''} onChange={handleInputChange} rows={3} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea>
                  </div>
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

      {/* 🟢 MODAL XÁC NHẬN VÀO LÀM LẠI */}
      {isRehireModalOpen && personnelToRehire && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-[#05469B] mb-4 flex items-center gap-2">
              <RotateCcw size={24}/> Vào làm lại
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Bạn đang thực hiện thủ tục cho nhân sự <span className="font-bold text-gray-800">{personnelToRehire.ho_ten}</span> quay trở lại làm việc.
            </p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ngày vào làm lại chính thức</label>
              <input 
                type="date" 
                value={rehireDate}
                onChange={(e) => setRehireDate(e.target.value)}
                className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setIsRehireModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
              <button onClick={handleConfirmRehire} disabled={submitting} className="flex-1 py-3 bg-[#05469B] hover:bg-[#04367a] transition-colors text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCheck size={20}/>} Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XÓA VĨNH VIỄN */}
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
    </div>
  );
}