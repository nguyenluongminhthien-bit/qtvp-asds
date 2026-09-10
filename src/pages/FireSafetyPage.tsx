import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, Eye,
  Flame, ShieldAlert, Building2, MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Calendar, FileText, Link as LinkIcon, Users, Droplets, Phone,
  PlusCircle, AlertTriangle, Sun, Moon, ShieldCheck, CheckCircle2, Siren, PhoneCall,
  HardHat, UserCheck, Briefcase, ClipboardPaste, RotateCcw, Sparkles
} from 'lucide-react';
import { apiService } from '../services/api';
import { DonVi } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getAllSubordinateIds, getDefaultUnitId } from '../utils/hierarchy'; 
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import { formatPhoneNumber, toUnaccented, stripAccents, normalizeDateToISO, safeGet } from '../utils/formatters';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import CustomAutocomplete from '../components/ui/CustomAutocomplete';
import PcccContactPasteModal from '../components/department/PcccContactPasteModal';

const formatToVN = (isoStr: string) => {
  if (!isoStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return `${isoStr.split('-')[2]}/${isoStr.split('-')[1]}/${isoStr.split('-')[0]}`;
  return isoStr; 
};
const getUnitIdSafe = (item: any) => safeGet(item, 'id_don_vi');
const getPcccIdSafe = (item: any) => safeGet(item, 'id') || safeGet(item, 'id_pccc');
const getTsPcccIdSafe = (item: any) => safeGet(item, 'id') || safeGet(item, 'id_tbpccc');

// 🟢 ĐỊNH NGHĨA CHUẨN TÊN 4 HỆ THỐNG THEO SUPABASE
const PCCC_SYSTEMS = [
  { key: 'he_thong_bao_chay_tu_dong', label: 'Báo cháy tự động', Icon: Siren, color: 'text-orange-500' },
  { key: 'he_thong_chua_chay_tu_dong_nuoc', label: 'Chữa cháy tự động', Icon: Droplets, color: 'text-blue-500' },
  { key: 'he_thong_chua_chay_nuoc', label: 'Chữa cháy vách tường', Icon: Droplets, color: 'text-cyan-500' },
  { key: 'dung_cu_pccc', label: 'Dụng cụ CC & CNCH', Icon: Flame, color: 'text-red-500' },
];

const CONTACTS_BAN_NGANH = [
  { key: 'sdt_ca_pccc', nameKey: 'ten_ca_pccc', label: 'Cảnh sát PCCC', def: '', color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'sdt_yte', nameKey: 'ten_yte', label: 'Cấp cứu y tế', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_bv_lien_ket', nameKey: 'ten_bv_lien_ket', label: 'Cơ sở y tế gần nhất (ký HĐ y tế)', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_bv_dan_quan', nameKey: 'ten_bv_dan_quan', label: 'Bảo vệ dân phố / Dân quân tự vệ', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_ca_khu_vuc', nameKey: 'ten_ca_khu_vuc', label: 'Công an khu vực', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_ca_xa_phuong', nameKey: 'ten_ca_xa_phuong', label: 'Công an Xã/Phường', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_pccc_xa_phuong', nameKey: 'ten_pccc_xa_phuong', label: 'PCCC Xã/Phường', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_dien_luc', nameKey: 'ten_dien_luc', label: 'Điện lực khu vực', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_ub', nameKey: 'ten_ub', label: 'Cơ quan ban ngành', def: '', color: 'text-gray-800', bg: 'bg-white' }
];

const CONTACTS_DON_VI = [
  { key: 'sdt_hc_ns', nameKey: 'ten_hc_ns', label: 'PT QTVP (Hành chính)', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_tt_bao_ve', nameKey: 'ten_tt_bao_ve', label: 'PT BV, ĐTKH (Tổ trưởng bảo vệ)', def: '', color: 'text-gray-800', bg: 'bg-white' },
  { key: 'sdt_kho_xe', nameKey: 'ten_kho_xe', label: 'PT Kho xe & Lái xe', def: '', color: 'text-gray-800', bg: 'bg-white' }
];

const EMERGENCY_CONTACTS = [...CONTACTS_BAN_NGANH, ...CONTACTS_DON_VI];



export default function FireSafetyPage() {
  const { user } = useAuth();
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [pcccData, setPcccData] = useState<any[]>([]);
  const [tsPcccData, setTsPcccData] = useState<any[]>([]);
  const [personnelData, setPersonnelData] = useState<any[]>([]); // 🟢 STATE NHÂN SỰ
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  
  // 🟢 STATE PHÂN TRANG (PAGINATION)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // 🟢 Reset về trang 1 khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUnitFilter]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update' | 'view'>('create');
  const [formData, setFormData] = useState<any>({});
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [deletedEqIds, setDeletedEqIds] = useState<string[]>([]);
  const [isPcccPasteModalOpen, setIsPcccPasteModalOpen] = useState(false);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // 🟢 STATE CHO MODAL DANH BẠ
  const [isEmergencyContactOpen, setIsEmergencyContactOpen] = useState(false);
  const [selectedPcccForContact, setSelectedPcccForContact] = useState<any | null>(null);
  // 🟢 STATE CHO THANH CẢNH BÁO PCCC
  const [isWarningOpen, setIsWarningOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, pcResult, tsResult, nsResult] = await Promise.all([
        apiService.getDonVi().catch(()=>[]),
        apiService.getPCCC ? apiService.getPCCC().catch(()=>[]) : Promise.resolve([]),
        apiService.getTsPCCC ? apiService.getTsPCCC().catch(()=>[]) : Promise.resolve([]),
        apiService.getPersonnel ? apiService.getPersonnel().catch(()=>[]) : Promise.resolve([])
      ]);
      setDonViList(dvResult || []); 
      setPersonnelData(nsResult || []); // Lưu dữ liệu nhân sự
      
      setPcccData((pcResult || []).map((item: any) => ({
        ...item,
        ngay_het_han_bh: normalizeDateToISO(safeGet(item, 'ngay_het_han_bh')),
        ngay_dien_tap: normalizeDateToISO(safeGet(item, 'ngay_dien_tap')),
      })));
      setTsPcccData((tsResult || []).map((item: any) => ({
        ...item,
        ngay_bom_sac: normalizeDateToISO(safeGet(item, 'ngay_bom_sac')),
        ngay_het_han: normalizeDateToISO(safeGet(item, 'ngay_het_han')),
      })));
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu.'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[dv.id] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  useEffect(() => {
    if (isEmergencyContactOpen && selectedPcccForContact) {
      apiService.writeLog(
        'XEM DANH BẠ KHẨN CẤP PCCC',
        `Đơn vị: ${donViMap[selectedPcccForContact.id_don_vi] || selectedPcccForContact.id_don_vi || ''}`
      );
    }
  }, [isEmergencyContactOpen, selectedPcccForContact, donViMap]);

  const allowedDonViIds = useAllowedUnits(donViList);

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



  const filteredPCCC = useMemo(() => {
    let result = pcccData.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) {
      const validIds = [selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)];
      result = result.filter(item => validIds.includes(item.id_don_vi));
    }
    if (searchTerm) {
      const cleanSearch = stripAccents(searchTerm);
      result = result.filter(item => 
        stripAccents(safeGet(item, 'giay_phep_pccc')).includes(cleanSearch) || 
        stripAccents(safeGet(item, 'ho_ten_doi_truong')).includes(cleanSearch) ||
        stripAccents(donViMap[item.id_don_vi] || '').includes(cleanSearch)
      );
    }
    return result;
  }, [pcccData, searchTerm, selectedUnitFilter, allowedDonViIds, donViList, donViMap]);

  // 🟢 TỰ ĐỘNG LỌC HẠNG MỤC PCCC SẮP/ĐÃ HẾT HẠN (Trước 30 ngày)
  const expiringPCCC = useMemo(() => {
    const warnings: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Xác định phạm vi đơn vị đang xem
    const validUnitIds = selectedUnitFilter 
      ? [selectedUnitFilter, ...donViList.filter(item => item.cap_quan_ly === selectedUnitFilter).map(c => c.id)]
      : allowedDonViIds;

    // 1. Quét Hạn sạc/Kiểm định Thiết bị PCCC
    tsPcccData.forEach(eq => {
      if (validUnitIds.includes(eq.id_don_vi) && eq.ngay_het_han) {
        const expDate = new Date(eq.ngay_het_han);
        if (!isNaN(expDate.getTime())) {
          expDate.setHours(0,0,0,0);
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
          if (diffDays <= 30) {
            warnings.push({
              type: 'Kiểm định TB',
              name: eq.loai_thiet_bi || 'Thiết bị không tên',
              unitName: donViMap[eq.id_don_vi] || eq.id_don_vi,
              diffDays,
              dateStr: expDate.toLocaleDateString('vi-VN')
            });
          }
        }
      }
    });

    // 2. Quét Hạn Bảo hiểm Cháy nổ trong Hồ sơ
    pcccData.forEach(p => {
      if (validUnitIds.includes(p.id_don_vi) && p.bao_hiem_chay_no === 'Có' && p.ngay_het_han_bh) {
        const expDate = new Date(p.ngay_het_han_bh);
        if (!isNaN(expDate.getTime())) {
          expDate.setHours(0,0,0,0);
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
          if (diffDays <= 30) {
            warnings.push({
              type: 'Bảo hiểm cháy nổ',
              name: 'Hồ sơ pháp lý',
              unitName: donViMap[p.id_don_vi] || p.id_don_vi,
              diffDays,
              dateStr: expDate.toLocaleDateString('vi-VN')
            });
          }
        }
      }
    });

    return warnings.sort((a, b) => a.diffDays - b.diffDays);
  }, [tsPcccData, pcccData, selectedUnitFilter, allowedDonViIds, donViList, donViMap]);

  // 🟢 TÍNH TOÁN PHÂN TRANG CHO DANH SÁCH PCCC
  const totalPages = Math.ceil((filteredPCCC?.length || 0) / rowsPerPage) || 1;
  const currentTableData = useMemo(() => {
    if (!filteredPCCC) return [];
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPCCC.slice(start, start + rowsPerPage);
  }, [filteredPCCC, currentPage, rowsPerPage]);

  const getStatusColor = (dateString: string, type: 'BH' | 'DT' | 'TB') => {
    if (!dateString) return { color: 'bg-gray-100 text-gray-500 border-gray-200', text: 'Chưa có', isDanger: false };
    const dateVN = formatToVN(dateString);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (type === 'BH') {
      if (diffDays < 0) return { color: 'bg-red-50 text-red-700 border-red-200 font-bold animate-pulse', text: `${dateVN} (Quá hạn)`, isDanger: true };
      if (diffDays <= 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200 font-bold', text: `${dateVN} (Sắp hết)`, isDanger: true };
      return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold', text: `${dateVN} (Còn hạn)`, isDanger: false };
    } else if (type === 'DT') {
      const passedDays = -diffDays; 
      if (passedDays > 365) return { color: 'bg-red-50 text-red-700 border-red-200 font-bold animate-pulse', text: `${dateVN} (Quá 1 năm)`, isDanger: true };
      if (passedDays > 335) return { color: 'bg-orange-50 text-orange-700 border-orange-200 font-bold', text: `${dateVN} (Sắp tới hạn)`, isDanger: true };
      return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold', text: `${dateVN} (Đạt YC)`, isDanger: false };
    } else if (type === 'TB') {
      if (diffDays < 0) return { color: 'bg-red-50 text-red-700 border-red-200 font-bold', text: `${dateVN} (Quá hạn)`, isDanger: true };
      if (diffDays <= 15) return { color: 'bg-red-100 text-red-800 border-red-300 font-bold', text: `${dateVN} (Sắp hết)`, isDanger: true }; 
      return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium', text: `${dateVN}`, isDanger: false };
    }
    return { color: '', text: dateVN, isDanger: false };
  };

  const getAvailableEquipmentGroups = (form: any) => {
    let groups = new Set<string>();
    PCCC_SYSTEMS.forEach(sys => {
      const val = form[sys.key] || (sys.key === 'ht_chua_chay_tu_dong_nuoc' ? 'Không' : 'Có');
      if (val === 'Có') {
        groups.add(sys.label);
      }
    });
    return Array.from(groups);
  };

  const suggestDoiTruong = useMemo(() => {
    if (!formData.id_don_vi) return [];
    const validIds = [formData.id_don_vi, ...getAllSubordinateIds(formData.id_don_vi, donViList)];
    const filteredNs = personnelData.filter(ns => validIds.includes(ns.id_don_vi));
    return Array.from(new Set(filteredNs.map(item => item.ho_ten).filter(Boolean))) as string[];
  }, [personnelData, formData.id_don_vi, donViList]);

  const openModal = (mode: 'create' | 'update' | 'view', item?: any) => {
    setModalMode(mode);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;

    if (item) { 
      setFormData({ ...item }); 
      setEquipmentList(tsPcccData.filter(eq => getUnitIdSafe(eq) === item.id_don_vi).map(e => ({...e}))); 
    } else {
      setFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), giay_phep_pccc: 'Nghiệm thu', bao_hiem_chay_no: 'Có', ngay_het_han_bh: '', 
        ho_ten_doi_truong: '', sdt_doi_truong: '', chuc_vu: '', tong_sl_thanh_vien: '', sl_huy_dong_ban_ngay: '', sl_huy_dong_ban_dem: '', 
        ngay_dien_tap: '', link_phuong_an_pccc: '', 
        sdt_ca_pccc: '', ten_ca_pccc: '', sdt_ub: '', ten_ub: '',
        sdt_pccc_xa_phuong: '', ten_pccc_xa_phuong: '', sdt_ca_xa_phuong: '', ten_ca_xa_phuong: '', 
        sdt_dien_luc: '', ten_dien_luc: '', sdt_cap_thoat_nuoc: '', ten_cap_thoat_nuoc: '',
        sdt_yte: '', ten_yte: '', sdt_bv_dan_quan: '', ten_bv_dan_quan: '',
        sdt_ca_khu_vuc: '', ten_ca_khu_vuc: '', sdt_kho_xe: '', ten_kho_xe: '',
        sdt_tt_bao_ve: '', ten_tt_bao_ve: '', sdt_hc_ns: '', ten_hc_ns: '',
        sdt_bv_lien_ket: '', ten_bv_lien_ket: '',
        ten_giam_doc: '', sdt_giam_doc: '',
        ten_ptkd_dvpt: '', sdt_ptkd_dvpt: '',
        ten_ptkd_xe: '', sdt_ptkd_xe: '',
        he_thong_bao_chay_tu_dong: 'Có', he_thong_chua_chay_tu_dong_nuoc: 'Không', 
        he_thong_chua_chay_nuoc: 'Có', dung_cu_pccc: 'Có', khu_vuc_rui_ro_cao: '', loi_ton_tai_chua_khac_phuc: ''
      });
      setEquipmentList([]);
    }
    setDeletedEqIds([]);
    setIsModalOpen(true); setError(null);
  };

  const addEquipmentRow = () => {
    const defaultGroup = getAvailableEquipmentGroups(formData)[0] || '';
    setEquipmentList([...equipmentList, { id: '', id_don_vi: '', nhom_he_thong: defaultGroup, loai_thiet_bi: '', so_luong: '', don_vi_tinh: 'Cái', vi_tri_bo_tri: '', ngay_bom_sac: '', ngay_het_han: '', tinh_trang: 'Hoạt động tốt' }]);
  };

  const handleEquipmentChange = (index: number, field: string, value: string) => { const newList = [...equipmentList]; newList[index][field] = value; setEquipmentList(newList); };
  
  const removeEquipmentRow = (index: number) => { 
    const eq = equipmentList[index]; 
    if (eq.id || eq.ID_TBPCCC) setDeletedEqIds([...deletedEqIds, eq.id || eq.ID_TBPCCC]); 
    setEquipmentList(equipmentList.filter((_, i) => i !== index)); 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.includes('sdt_doi_truong') || name.includes('sdt_doi_truong')) setFormData(prev => ({ ...prev, [name]: formatPhoneNumber(value) }));
    else setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDoiTruongChange = (e: any) => {
    const name = e.target.value;
    const validIds = formData.id_don_vi ? [formData.id_don_vi, ...getAllSubordinateIds(formData.id_don_vi, donViList)] : [];
    let foundNs = personnelData.find(ns => ns.ho_ten === name && validIds.includes(ns.id_don_vi));
    if (!foundNs) {
      foundNs = personnelData.find(ns => ns.ho_ten === name);
    }
    if (foundNs) {
      setFormData(prev => ({
        ...prev,
        ho_ten_doi_truong: name,
        sdt_doi_truong: formatPhoneNumber(foundNs.so_dien_thoai || foundNs.soDienThoai || ''),
        chuc_vu: foundNs.chuc_vu || foundNs.chucVu || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, ho_ten_doi_truong: name }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // 🟢 Thay alert bằng toast.warning
    if (!formData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị!");

    let finalData = { ...formData };
    
    // 🟢 Dọn dẹp dữ liệu rỗng thành null cho Hồ sơ PCCC
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    if (modalMode === 'create' && !finalData.id) {
      finalData.id = `PCCC-${Date.now()}`;
    }

    setSubmitting(true); setError(null);
    try {
      await apiService.save(finalData, modalMode, "hs_pccc");
      
      for (const delId of deletedEqIds) await apiService.delete(delId, "ts_pccc");
      
      if (equipmentList.length > 0) {
        for (const eq of equipmentList) {
          let updatedEq = { ...eq, id_don_vi: formData.id_don_vi };
          
          // 🟢 Dọn dẹp dữ liệu rỗng thành null cho từng Thiết bị PCCC
          Object.keys(updatedEq).forEach(key => {
            if (updatedEq[key] === '' || updatedEq[key] === ' ') {
              updatedEq[key] = null;
            }
          });

          if (!updatedEq.id) {
            updatedEq.id = `TBPCCC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await apiService.save(updatedEq, 'create', 'ts_pccc');
          } else {
            await apiService.save(updatedEq, 'update', 'ts_pccc');
          }
        }
      }
      
      setIsModalOpen(false); 
      loadData(); 
      // 🟢 Thông báo thành công
      if (modalMode === 'create') {
        toast.success("Thêm mới hồ sơ PCCC thành công!");
      } else {
        toast.success("Cập nhật hồ sơ PCCC thành công!");
      }

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu PCCC.'); 
      // 🔴 Thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi lưu hồ sơ PCCC!");
    } finally { 
      setSubmitting(false); 
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true); 
    setError(null);
    
    try {
      const pcccToDelete = pcccData.find(item => getPcccIdSafe(item) === itemToDelete);
      const relatedDonViId = pcccToDelete ? getUnitIdSafe(pcccToDelete) : null;
      
      await apiService.delete(itemToDelete, "hs_pccc");
      setPcccData(prev => prev.filter(item => getPcccIdSafe(item) !== itemToDelete));
      
      if (relatedDonViId) {
        const eqToDelete = tsPcccData.filter(eq => getUnitIdSafe(eq) === relatedDonViId);
        for (const eq of eqToDelete) {
          const eqId = getTsPcccIdSafe(eq);
          if (eqId) await apiService.delete(eqId, "ts_pccc");
        }
        setTsPcccData(prev => prev.filter(eq => getUnitIdSafe(eq) !== relatedDonViId));
      }
      
      setIsConfirmOpen(false); 
      setItemToDelete(null); 
      // 🟢 Thông báo xóa thành công
      toast.success("Xóa hồ sơ và thiết bị PCCC thành công!");

    } catch (err: any) { 
      setError(err.message || 'Lỗi xóa dữ liệu.'); 
      // 🔴 Thông báo lỗi
      toast.error(err.message || "Đã xảy ra lỗi khi xóa hồ sơ PCCC!");
    } finally { 
      setSubmitting(false); 
    }
  };



  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-red-600 hover:bg-red-50 transition-all"><PanelLeftOpen size={20} /></button>
      )}

      {/* CỘT TRÁI BỘ LỌC ĐỒNG BỘ */}
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
        themeColor="red"
        allUnitsLabel="Tất cả Cụm / Chi nhánh"
      />

      {/* CỘT PHẢI CHI TIẾT */}
      <div className="flex-1 min-w-0 max-w-full overflow-hidden p-4 sm:p-6 relative transition-all duration-300 w-full flex flex-col">
        
        {/* FIXED HEADER */}
        <div className="shrink-0 flex flex-col relative z-30">
          <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {isListCollapsed && (
                <button 
                  onClick={() => setIsListCollapsed(false)} 
                  className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-red-600 hover:bg-red-50 transition-all flex items-center justify-center shrink-0"
                  title="Mở bộ lọc đơn vị"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2"><Flame size={28} /> Quản lý Hồ sơ PCCC</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{donViMap[selectedUnitFilter || ''] || 'Tất cả Đơn vị'}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto relative z-30">
              {/* Ô tìm kiếm 256 x 32 px */}
              <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Tìm giấy phép, đội trưởng..."
                  className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Nút Đồng bộ dữ liệu (24 x 24 px) */}
              <button
                onClick={() => {
                  loadData();
                  toast.success('Đang đồng bộ dữ liệu PCCC mới nhất từ Supabase...');
                }}
                title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                disabled={loading}
                className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white hover:bg-gray-50 text-gray-700 hover:text-red-600 rounded-md border border-gray-200 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <RotateCcw size={13} className={loading ? 'animate-spin text-red-600' : ''} />
              </button>

              {/* Nút Tính năng (119 x 32 px) - Màu đỏ đặc trưng */}
              <div className="relative z-50">
                <button
                  onClick={() => setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen)}
                  className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${
                    isFeaturesDropdownOpen
                      ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-600 shadow-sm'
                      : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:text-red-600'
                  }`}
                >
                  <Sparkles size={14} className={isFeaturesDropdownOpen ? 'text-amber-300 animate-pulse' : 'text-red-600'} />
                  <span>Tính năng</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFeaturesDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 z-[100] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                      <button
                        onClick={() => {
                          setIsFeaturesDropdownOpen(false);
                          openModal('create');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-red-50 text-gray-700 hover:text-red-700 cursor-pointer"
                      >
                        <div className="p-1.5 rounded-md bg-red-100 text-red-600">
                          <PlusCircle size={15} />
                        </div>
                        <div>
                          <div className="text-gray-800 font-bold text-xs">Thêm mới Hồ sơ PCCC</div>
                          <div className="text-[10px] text-gray-500 font-normal">Tạo hồ sơ cơ sở PCCC mới</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm shrink-0"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

        {/* 🟢 THANH CẢNH BÁO HẠN PCCC (ĐỒNG BỘ GIAO DIỆN) */}
        {expiringPCCC.length > 0 && !isDismissed && (
          <div className={`mb-6 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
              
              {/* HEADER - BẤM ĐỂ MỞ RỘNG/THU GỌN */}
              <div className="flex justify-between items-center p-3 sm:p-4">
                <div 
                  className="flex items-center gap-2 text-red-700 cursor-pointer flex-1"
                  onClick={() => setIsWarningOpen(!isWarningOpen)}
                >
                  <AlertCircle size={18} className={expiringPCCC.some(i => i.diffDays < 0) ? "animate-pulse shrink-0" : "shrink-0"} />
                  <h3 className="font-bold text-sm">
                    {expiringPCCC.length} hạng mục PCCC sắp / đã quá hạn
                  </h3>
                </div>

                {/* KHỐI NÚT THAO TÁC Ở GÓC PHẢI */}
                <div className="flex items-center gap-2 text-gray-400 shrink-0">
                  <button 
                    onClick={() => setIsWarningOpen(!isWarningOpen)}
                    className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Xem chi tiết"
                  >
                    {isWarningOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDismissed(true);
                    }}
                    className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Đóng cảnh báo"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* DANH SÁCH CHI TIẾT KHI MỞ RỘNG */}
              {isWarningOpen && (
                <div className="border-t border-red-100 bg-white">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {expiringPCCC.map((warn, idx) => (
                          <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                            <td className="p-3 w-28">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${warn.diffDays < 0 ? 'bg-red-100 text-red-700 border-red-200' : warn.diffDays === 0 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                {warn.diffDays < 0 ? 'QUÁ HẠN' : warn.diffDays === 0 ? 'HÔM NAY' : 'SẮP HẾT HẠN'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-gray-800">
                              {warn.type}
                              <span className="text-gray-400 mx-2">—</span>
                              <span className="text-gray-600 font-normal">{warn.name}</span>
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
        
        {/* BẢNG DỮ LIỆU HIỂN THỊ TRONG MÀN HÌNH CHÍNH */}
        <div className={`flex flex-col flex-1 min-h-0 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
          
          {/* BẢNG DỮ LIỆU PC */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 w-full flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 bg-[#f8fafc] z-10">
                <tr className="bg-[#f8fafc] border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="p-4 w-[20%]">Cơ sở / Đơn vị & Pháp lý</th>
                  <th className="p-4 w-[25%]">Đội PCCC & Diễn tập</th>
                  <th className="p-4 w-[20%]">Thiết bị & Cảnh báo</th>
                  <th className="p-4 w-[20%]">Tổng quan Hệ thống</th>
                  <th className="p-4 text-center w-[15%]">Thao tác</th> 
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={5} className="p-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-600" />Đang tải dữ liệu...</td></tr>
                ) : filteredPCCC.length === 0 ? (
                  <tr><td colSpan={5} className="p-16 text-center text-gray-500"><ShieldAlert size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-lg font-medium">Chưa có hồ sơ PCCC nào được khai báo.</p></td></tr>
                ) : (
                  currentTableData.map((item, index) => {
                    const bhStatus = getStatusColor(safeGet(item, 'ngay_het_han_bh'), 'BH');
                    const dtStatus = getStatusColor(safeGet(item, 'ngay_dien_tap'), 'DT');
                    const eqOfUnit = tsPcccData.filter(eq => getUnitIdSafe(eq) === item.id_don_vi);
                    
                    let totalEq = 0;
                    let warningCount = 0;
                    
                    eqOfUnit.forEach(eq => {
                      const sl = Number(safeGet(eq, 'so_luong')) || 1;
                      totalEq += sl;
                      if (getStatusColor(safeGet(eq, 'ngay_het_han'), 'TB').isDanger) { warningCount += sl; }
                    });

                    return (
                      <tr key={`${getPcccIdSafe(item)}-${index}`} className="hover:bg-red-50/30 transition-colors group">
                        <td className="p-4 align-top">
                          <p className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">{donViMap[item.id_don_vi] || item.id_don_vi}</p>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{getPcccIdSafe(item)}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${safeGet(item, 'giay_phep_pccc') === 'Nghiệm thu' ? 'bg-emerald-100 text-emerald-700' : safeGet(item, 'giay_phep_pccc') === 'Đã phê duyệt' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{safeGet(item, 'giay_phep_pccc') || '---'}</span>
                          </div>
                          <div className="space-y-1.5 text-[11px]">
                            {safeGet(item, 'bao_hiem_chay_no') === 'Có' ? (
                              <div className="flex items-center justify-between"><span className="text-gray-500">Hạn BH:</span><span className={`px-1.5 py-0.5 rounded border ${bhStatus.color}`}>{bhStatus.text}</span></div>
                            ) : (
                              <div className="flex items-center justify-between"><span className="text-gray-500">Hạn BH:</span><span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 border border-red-200 rounded">Không có BH</span></div>
                            )}
                            {safeGet(item, 'link_phuong_an_pccc') && (
                              <a href={safeGet(item, 'link_phuong_an_pccc')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#05469B] hover:text-blue-700 hover:underline font-bold mt-1"><LinkIcon size={10}/> File Phương án CC</a>
                            )}
                            <div className="mt-3 border-t border-gray-100 pt-2">
                              {/* 🟢 NÚT BẤM GỌI MODAL DANH BẠ */}
                              <button onClick={() => { setSelectedPcccForContact(item); setIsEmergencyContactOpen(true); }} className="flex items-center gap-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded border border-orange-200 font-bold transition-colors w-full justify-center">
                                <PhoneCall size={12} /> Danh bạ Khẩn cấp
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 align-top">
                          <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 mb-2">
                            {safeGet(item, 'ho_ten_doi_truong') ? (
                              <div className="flex flex-col mb-1.5 pb-1.5 border-b border-gray-200">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[#05469B] flex items-center gap-1.5"><ShieldCheck size={14} className="shrink-0"/> <span className="line-clamp-1">{safeGet(item, 'ho_ten_doi_truong')}</span></span>
                                    <span className="text-[10px] text-gray-500 font-normal pl-5 line-clamp-1">{safeGet(item, 'chuc_vu')}</span>
                                  </div>
                                  
                                  {safeGet(item, 'sdt_doi_truong') && (
                                    <a 
                                      href={`tel:${safeGet(item, 'sdt_doi_truong').replace(/\s/g, '')}`} 
                                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:shadow-md border border-emerald-200 px-2 py-1 rounded-md transition-all shrink-0" 
                                      title="Bấm để gọi ngay"
                                    >
                                      <Phone size={12} className="animate-pulse" />
                                      {safeGet(item, 'sdt_doi_truong')}
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (<div className="text-xs text-gray-400 italic mb-2">Chưa báo cáo Đội trưởng</div>)}
                            <div className="flex justify-between items-center text-[10px] font-medium text-gray-600 bg-white border border-gray-100 rounded p-1.5">
                              <span className="flex items-center gap-1">Tổng: <b className="text-gray-800">{safeGet(item, 'tong_sl_thanh_vien') || 0}</b></span><span className="w-px h-3 bg-gray-200"></span>
                              <span className="flex items-center gap-1"><Sun size={10} className="text-orange-500"/> <b className="text-gray-800">{safeGet(item, 'sl_huy_dong_ban_ngay') || 0}</b></span><span className="w-px h-3 bg-gray-200"></span>
                              <span className="flex items-center gap-1"><Moon size={10} className="text-indigo-500"/> <b className="text-gray-800">{safeGet(item, 'sl_huy_dong_ban_dem') || 0}</b></span>
                            </div>
                          </div>
                          <div className="text-[11px] mt-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-500 font-medium flex items-center gap-1"><Calendar size={12}/> Diễn tập gần nhất:</span>
                              <span className={`px-1.5 py-0.5 rounded border text-center ${dtStatus.color}`}>{dtStatus.text}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 align-top">
                          <div className="flex flex-col gap-2 w-full">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 flex justify-between items-center"><span className="text-[10px] font-bold text-blue-600 uppercase">Tổng Thiết bị / Bình</span><span className="text-base font-black text-[#05469B]">{totalEq}</span></div>
                            {warningCount > 0 ? (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-2 animate-pulse"><AlertTriangle size={16} className="text-red-500 shrink-0"/><div className="text-left flex-1"><span className="block text-[10px] font-bold text-red-700 uppercase">Cảnh báo Hạn sạc</span><span className="text-[11px] font-semibold text-red-600">Có {warningCount} thiết bị cần xử lý!</span></div></div>
                            ) : (<div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-center text-emerald-600 gap-1.5 h-[58px]"><CheckCircle2 size={16}/><span className="text-[11px] font-bold uppercase">Hoạt động tốt</span></div>)}
                          </div>
                        </td>

                        <td className="p-4 align-top">
                          <div className="space-y-2.5 text-[11px]">
                            {PCCC_SYSTEMS.map(sys => {
                              let sysCount = 0;
                              eqOfUnit.forEach(eq => {
                                if (safeGet(eq, 'nhom_he_thong') === sys.label) sysCount += (Number(safeGet(eq, 'so_luong')) || 1);
                              });
                              const isChecked = safeGet(item, sys.key) === 'Có' || (sys.key === 'dung_cu_pccc' && !safeGet(item, 'dung_cu_pccc'));
                              return (
                                <div key={sys.key} className="flex items-center justify-between">
                                  <span className="text-gray-600 font-medium flex items-center gap-1.5"><sys.Icon size={12} className={sys.color}/> {sys.label}</span>
                                  {isChecked ? <span className="font-bold text-emerald-600">Có {sysCount > 0 ? `(${sysCount})` : ''}</span> : <span className="text-gray-400">Không</span>}
                                </div>
                              )
                            })}
                          </div>
                        </td>

                        <td className="p-4 text-center align-middle">
                          <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openModal('view', item)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded bg-white shadow-sm border border-emerald-100 transition-colors" title="Xem chi tiết"><Eye size={16}/></button>
                            <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded bg-white shadow-sm border border-blue-100 transition-colors" title="Sửa"><Edit size={16}/></button>
                            <button onClick={() => { setItemToDelete(getPcccIdSafe(item)); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded bg-white shadow-sm border border-red-100 transition-colors" title="Xóa"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 🟢 VIEW TRÊN MOBILE: THẺ CARD DỌC */}
          <div className="block md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
            {filteredPCCC.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 italic">Chưa có hồ sơ PCCC nào được khai báo.</div>
            ) : (
              currentTableData.map((item, index) => {
                const bhStatus = getStatusColor(safeGet(item, 'ngay_het_han_bh'), 'BH');
                const dtStatus = getStatusColor(safeGet(item, 'ngay_dien_tap'), 'DT');
                const eqOfUnit = tsPcccData.filter(eq => getUnitIdSafe(eq) === item.id_don_vi);
                
                let totalEq = 0;
                let warningCount = 0;
                
                eqOfUnit.forEach(eq => {
                  const sl = Number(safeGet(eq, 'so_luong')) || 1;
                  totalEq += sl;
                  if (getStatusColor(safeGet(eq, 'ngay_het_han'), 'TB').isDanger) { warningCount += sl; }
                });

                return (
                  <div 
                    key={`pccc-card-${getPcccIdSafe(item)}-${index}`}
                    className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative flex flex-col gap-3.5 transition-all"
                  >
                    {/* Header: Cơ sở & Giấy phép */}
                    <div className="pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] text-gray-400 font-mono">ID: {getPcccIdSafe(item)}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase ${safeGet(item, 'giay_phep_pccc') === 'Nghiệm thu' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : safeGet(item, 'giay_phep_pccc') === 'Đã phê duyệt' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{safeGet(item, 'giay_phep_pccc') || '---'}</span>
                      </div>
                      <h4 className="font-extrabold text-red-600 text-sm leading-snug">{donViMap[item.id_don_vi] || item.id_don_vi}</h4>
                    </div>

                    {/* Body: 2 Columns */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
                      {/* Cột 1: Bảo hiểm & Diễn tập */}
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Bảo hiểm</p>
                          {safeGet(item, 'bao_hiem_chay_no') === 'Có' ? (
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border ${bhStatus.color}`}>{bhStatus.text}</span>
                          ) : (
                            <span className="inline-block font-bold text-red-600 bg-red-50 px-1.5 py-0.5 border border-red-200 rounded text-[10px]">Không có BH</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Diễn tập PCCC</p>
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border ${dtStatus.color}`}>{dtStatus.text}</span>
                        </div>
                        {safeGet(item, 'link_phuong_an_pccc') && (
                          <a href={safeGet(item, 'link_phuong_an_pccc')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#05469B] hover:text-blue-700 hover:underline font-bold text-[10px]"><LinkIcon size={10}/> File Phương án CC</a>
                        )}
                      </div>

                      {/* Cột 2: Đội trưởng PCCC */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Đội trưởng PCCC</p>
                        {safeGet(item, 'ho_ten_doi_truong') ? (
                          <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex flex-col gap-1">
                            <span className="font-bold text-[#05469B] flex items-center gap-1"><ShieldCheck size={12} className="shrink-0 text-red-500"/> <span className="line-clamp-1">{safeGet(item, 'ho_ten_doi_truong')}</span></span>
                            {safeGet(item, 'sdt_doi_truong') && (
                              <a href={`tel:${safeGet(item, 'sdt_doi_truong').replace(/\s/g, '')}`} className="font-bold text-emerald-600 hover:underline flex items-center gap-1 text-[10px]"><Phone size={10} className="shrink-0" /> {safeGet(item, 'sdt_doi_truong')}</a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Chưa báo cáo</span>
                        )}
                        <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded p-1">
                          <span>M: {safeGet(item, 'tong_sl_thanh_vien') || 0}</span>
                          <span>N: {safeGet(item, 'sl_huy_dong_ban_ngay') || 0}</span>
                          <span>Đ: {safeGet(item, 'sl_huy_dong_ban_dem') || 0}</span>
                        </div>
                      </div>

                      {/* Cột 1: Thiết bị & Bình */}
                      <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-red-50/50 border border-red-100 rounded-lg p-2 flex justify-between items-center"><span className="text-[9px] font-bold text-red-700 uppercase">Tổng Thiết bị / Bình</span><span className="text-sm font-black text-red-600">{totalEq}</span></div>
                        {warningCount > 0 ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500 shrink-0"/><span className="text-[9px] font-bold text-amber-700">Có {warningCount} thiết bị hết hạn!</span></div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 flex items-center justify-center text-emerald-600 gap-1.5"><CheckCircle2 size={14}/><span className="text-[9px] font-bold uppercase">Hoạt động tốt</span></div>
                        )}
                      </div>

                      {/* Cột 2: Hệ thống PCCC */}
                      <div className="col-span-2 border-t border-gray-100 pt-2.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Tổng quan Hệ thống PCCC</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                          {PCCC_SYSTEMS.map(sys => {
                            let sysCount = 0;
                            eqOfUnit.forEach(eq => {
                              if (safeGet(eq, 'nhom_he_thong') === sys.label) sysCount += (Number(safeGet(eq, 'so_luong')) || 1);
                            });
                            const isChecked = safeGet(item, sys.key) === 'Có' || (sys.key === 'dung_cu_pccc' && !safeGet(item, 'dung_cu_pccc'));
                            return (
                              <div key={sys.key} className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-1"><sys.Icon size={11} className={sys.color}/> {sys.label}</span>
                                {isChecked ? <span className="font-bold text-emerald-600">Có {sysCount > 0 ? `(${sysCount})` : ''}</span> : <span className="text-gray-400">Không</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Actions */}
                    <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-gray-100 mt-1">
                      <button onClick={() => { setSelectedPcccForContact(item); setIsEmergencyContactOpen(true); }} className="p-2 text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1.5 shadow-2xs">
                        <PhoneCall size={12} /> Danh bạ
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openModal('view', item)} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xem chi tiết"><Eye size={14}/> Xem</button>
                        <button onClick={() => openModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit size={14}/> Sửa</button>
                        <button onClick={() => { setItemToDelete(getPcccIdSafe(item)); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa"><Trash2 size={14}/> Xóa</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(rows) => {
                setRowsPerPage(rows);
                setCurrentPage(1);
              }}
              totalRows={filteredPCCC.length}
              itemName="hồ sơ PCCC"
            />
          </div>
        </div>
      </div>

      {/* 🟢 MODAL NHẬP THÔNG TIN PCCC ALL-IN-ONE */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 ${!isListCollapsed ? 'lg:pl-80' : ''}`}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-red-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold text-red-700 flex items-center gap-2"><Flame size={24}/> {modalMode === 'create' ? 'Tạo Hồ sơ PCCC Mới' : modalMode === 'view' ? 'Chi tiết Hồ sơ PCCC' : 'Cập nhật Hồ sơ PCCC'}</h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
                <fieldset disabled={modalMode === 'view'} className="space-y-6 border-0 m-0 p-0">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100 shadow-sm h-full flex flex-col">
                      <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2 border-b border-blue-200 pb-2"><FileText size={18}/> 1. Pháp lý & Bảo hiểm</h4>
                      <div className="space-y-4 flex-1">
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị / Cơ sở *</label><select required name="id_don_vi" value={formData.id_don_vi || ''} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500 font-bold text-[#05469B]"><option value="">-- Chọn đơn vị --</option>{buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }, idx) => (<option key={`${unit.id}-${idx}`} value={unit.id}>{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>))}</select></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giấy phép PCCC</label><select name="giay_phep_pccc" value={formData.giay_phep_pccc || 'Nghiệm thu'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500 font-bold text-emerald-700"><option value="Nghiệm thu">Nghiệm thu</option><option value="Đã phê duyệt">Đã phê duyệt</option><option value="Chưa có">Chưa có</option></select></div>
                          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bảo hiểm Cháy nổ</label><select name="bao_hiem_chay_no" value={formData.bao_hiem_chay_no || 'Có'} onChange={handleInputChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500"><option value="Có">Có</option><option value="Không">Không</option></select></div>
                        </div>
                        {formData.bao_hiem_chay_no === 'Có' && (<div><label className="block text-[10px] font-bold text-red-600 mb-1 uppercase">Ngày hết hạn Bảo Hiểm *</label><input type="date" name="ngay_het_han_bh" value={formData.ngay_het_han_bh ? formData.ngay_het_han_bh.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2 border border-red-300 rounded-lg bg-red-50 outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-700 text-sm" /></div>)}
                        <div><label className="block text-[10px] font-bold text-purple-700 mb-1 uppercase">Link Phương án CC (Drive/PDF)</label><div className="relative"><LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="url" name="link_phuong_an_pccc" value={formData.link_phuong_an_pccc || ''} onChange={handleInputChange} className="w-full pl-7 pr-2 py-2 border border-purple-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 text-blue-600 text-sm" placeholder="Dán link..." /></div></div>
                      </div>
                    </div>
                    <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 shadow-sm h-full flex flex-col">
                      <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200 pb-2"><Users size={18}/> 2. Đội PCCC Cơ sở & Diễn tập</h4>
                      <div className="space-y-4 flex-1">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Đội trưởng PCCC</label>
                            <CustomAutocomplete
                              name="ho_ten_doi_truong"
                              value={formData.ho_ten_doi_truong || ''}
                              onChange={handleDoiTruongChange}
                              suggestions={suggestDoiTruong}
                              placeholder="Họ và tên..."
                              className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-[#05469B]"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Chức vụ</label><input type="text" name="chuc_vu" value={formData.chuc_vu || ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="VD: Trưởng phòng..." /></div>
                          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SĐT Đội trưởng</label><input type="text" name="sdt_doi_truong" value={formData.sdt_doi_truong || ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="xxxx xxx xxx" /></div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 border-t border-emerald-100 pt-4">
                          <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Users size={12} className="text-emerald-600"/> Tổng Thành viên</label><input type="number" name="tong_sl_thanh_vien" value={formData.tong_sl_thanh_vien || ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-800" placeholder="Số lượng..." /></div>
                          <div className="col-span-1"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Sun size={12} className="text-orange-500"/> Ngày</label><input type="number" name="sl_huy_dong_ban_ngay" value={formData.sl_huy_dong_ban_ngay || ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="SL..." /></div>
                          <div className="col-span-1"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Moon size={12} className="text-indigo-500"/> Đêm</label><input type="number" name="sl_huy_dong_ban_dem" value={formData.sl_huy_dong_ban_dem || ''} onChange={handleInputChange} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="SL..." /></div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 border-t border-emerald-100 pt-4"><div><label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Ngày Diễn tập gần nhất</label><input type="date" name="ngay_dien_tap" value={formData.ngay_dien_tap ? formData.ngay_dien_tap.split('T')[0] : ''} onChange={handleInputChange} className="w-full p-2 border border-emerald-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-800 font-bold text-sm" /></div></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50/40 p-5 rounded-xl border border-orange-200 shadow-sm mt-6">
                    <div className="flex justify-between items-center mb-4 border-b border-orange-200 pb-2">
                      <h4 className="font-bold text-orange-800 flex items-center gap-2"><Droplets size={18}/> 3. Hệ thống Cố định & Thiết bị PCCC</h4>
                      {modalMode !== 'view' && (<button type="button" onClick={addEquipmentRow} className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm"><PlusCircle size={16} /> Thêm Thiết bị</button>)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-orange-200">
                      {PCCC_SYSTEMS.map(sys => (
                        <div key={sys.key} className="bg-white p-3 rounded-lg border border-orange-100 flex flex-col justify-between gap-2 h-full">
                          <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5"><sys.Icon size={14} className={sys.color}/> {sys.label}</span>
                          <select name={sys.key} value={formData[sys.key] || (sys.key === 'ht_chua_chay_tu_dong_nuoc' ? 'Không' : 'Có')} onChange={handleInputChange} className="w-full p-2 text-xs font-bold border border-gray-200 rounded outline-none focus:ring-2 focus:ring-orange-500 text-[#05469B] bg-blue-50 mt-auto"><option value="Có">Có</option><option value="Không">Không</option></select>
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-xs italic text-gray-500 mb-3 px-1">Kê khai chi tiết các thiết bị thuộc các hệ thống trên (Tủ điều khiển, Bình chữa cháy, Đầu báo khói...)</p>
                    
                   <div className="w-full border border-gray-200 rounded-xl overflow-hidden overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase leading-tight">
                            <th className="p-2 w-[18%]">Nhóm Hệ Thống</th>
                            <th className="p-2 w-[20%]">Tên/Loại Thiết Bị</th>
                            <th className="p-2 w-[7%] text-center">Số lượng</th>
                            <th className="p-2 w-[7%]">ĐVT</th>
                            <th className="p-2 w-[14%]">Vị trí bố trí</th>
                            <th className="p-2 w-[10%]">Ngày bơm sạc/KT</th>
                            <th className="p-2 w-[10%] text-red-600">Hạn sạc tiếp theo</th>
                            <th className="p-2 w-[10%]">Tình trạng</th>
                            {modalMode !== 'view' && <th className="p-2 w-[4%] text-center">#</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {equipmentList.length === 0 ? (
                            <tr><td colSpan={9} className="p-8 text-center text-gray-400 italic bg-white">Chưa có thiết bị nào. Vui lòng bấm "Thêm Thiết bị"</td></tr>
                          ) : (
                            equipmentList.map((eq, idx) => {
                              const standardOptions = getAvailableEquipmentGroups(formData);
                              const isCustomUI = eq.nhom_he_thong === 'Khác' || (eq.nhom_he_thong !== '' && !standardOptions.includes(eq.nhom_he_thong));

                              return (
                                <tr key={idx} className="hover:bg-orange-50/50 transition-colors bg-white">
                                  <td className="p-1.5">
                                    {isCustomUI ? (
                                      <div className="flex items-center relative w-full">
                                        <input 
                                          type="text" 
                                          value={eq.nhom_he_thong === 'Khác' ? '' : eq.nhom_he_thong} 
                                          onChange={e => handleEquipmentChange(idx, 'nhom_he_thong', e.target.value || 'Khác')} 
                                          className="w-full p-1.5 text-xs border border-blue-300 rounded outline-none focus:border-blue-500 bg-blue-50 pr-6" 
                                          placeholder="Tự nhập tên..." 
                                          autoFocus 
                                        />
                                        <button type="button" onClick={() => handleEquipmentChange(idx, 'nhom_he_thong', standardOptions.length > 0 ? standardOptions[0] : '')} className="absolute right-1 text-gray-400 hover:text-red-500" title="Hủy tự nhập"><X size={14}/></button>
                                      </div>
                                    ) : (
                                      <select value={eq.nhom_he_thong || ''} onChange={e => handleEquipmentChange(idx, 'nhom_he_thong', e.target.value)} className="w-full p-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500 bg-white">
                                        {!eq.nhom_he_thong && <option value="">-- Chọn --</option>}
                                        {standardOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        <option value="Khác">Khác (Tự nhập...)</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="p-1.5"><input type="text" value={eq.loai_thiet_bi || ''} onChange={e => handleEquipmentChange(idx, 'loai_thiet_bi', e.target.value)} placeholder="VD: Bình bột ABC 4kg..." className="w-full p-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500 bg-white font-medium" /></td>
                                  <td className="p-1.5"><input type="number" value={eq.so_luong || ''} onChange={e => handleEquipmentChange(idx, 'so_luong', e.target.value)} className="w-full p-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500 bg-white text-center font-bold" /></td>
                                  <td className="p-1.5"><input type="text" value={eq.don_vi_tinh || ''} onChange={e => handleEquipmentChange(idx, 'don_vi_tinh', e.target.value)} placeholder="Bình/Cái..." className="w-full p-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500 bg-white" /></td>
                                  <td className="p-1.5"><input type="text" value={eq.vi_tri_bo_tri || ''} onChange={e => handleEquipmentChange(idx, 'vi_tri_bo_tri', e.target.value)} placeholder="Khu trưng bày..." className="w-full p-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500 bg-white" /></td>
                                  <td className="p-1.5"><input type="date" value={eq.ngay_bom_sac ? eq.ngay_bom_sac.split('T')[0] : ''} onChange={e => handleEquipmentChange(idx, 'ngay_bom_sac', e.target.value)} className="w-full p-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500 bg-white text-gray-600" /></td>
                                  <td className="p-1.5"><input type="date" value={eq.ngay_het_han ? eq.ngay_het_han.split('T')[0] : ''} onChange={e => handleEquipmentChange(idx, 'ngay_het_han', e.target.value)} className="w-full p-1.5 text-xs border border-red-300 rounded outline-none focus:border-red-500 bg-red-50 font-bold text-red-700" title="Dùng để chạy hệ thống cảnh báo" /></td>
                                  <td className="p-1.5"><select value={eq.tinh_trang || 'Hoạt động tốt'} onChange={e => handleEquipmentChange(idx, 'tinh_trang', e.target.value)} className={`w-full p-1.5 text-xs font-bold border rounded outline-none focus:border-orange-500 ${eq.tinh_trang === 'Hư hỏng' ? 'bg-red-50 text-red-600 border-red-200' : eq.tinh_trang === 'Cần bơm sạc' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}><option value="Hoạt động tốt">Hoạt động tốt</option><option value="Cần bơm sạc">Cần bơm sạc</option><option value="Hư hỏng">Hư hỏng</option></select></td>
                                  {modalMode !== 'view' && (<td className="p-1.5 text-center"><button type="button" onClick={() => removeEquipmentRow(idx)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button></td>)}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-purple-50/40 p-5 rounded-xl border border-purple-100 shadow-sm mt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-200 pb-2 mb-4">
                      <h4 className="font-bold text-purple-800 flex items-center gap-2"><PhoneCall size={18}/> 4. Danh bạ Khẩn cấp & Ghi chú Tồn tại (Mẫu PC01)</h4>
                      {modalMode !== 'view' && (
                        <button
                          type="button"
                          onClick={() => setIsPcccPasteModalOpen(true)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Dán bảng danh bạ từ PowerPoint hoặc Excel"
                        >
                          <ClipboardPaste size={14} /> Dán Bảng Danh bạ (PowerPoint / Excel)
                        </button>
                      )}
                    </div>
                    <div className="space-y-6">
                      {/* Nhóm 1: Cơ quan chức năng & Ban ngành */}
                      <div className="bg-[#fcf8ff]/60 p-5 rounded-xl border border-purple-100 shadow-sm space-y-4">
                        <h5 className="text-xs font-bold text-purple-800 flex items-center gap-1.5 uppercase tracking-wider border-b border-purple-100 pb-2">
                          <Building2 size={15} className="text-purple-600" /> 4.1. Cơ quan chức năng & Ban ngành
                        </h5>
                        
                        {/* Dòng 1: Cảnh sát PCCC - PCCC Xã/phường */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Dòng 1: Cảnh sát PCCC & Xã Phường</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_ca_pccc'),
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_pccc_xa_phuong')
                            ].map(contact => {
                              if (!contact) return null;
                              return (
                                <div key={contact.key} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                                  <label className={`block text-[10px] font-bold uppercase ${contact.color}`}>📞 {contact.label}</label>
                                  <input 
                                    type="text" 
                                    name={contact.nameKey} 
                                    value={formData[contact.nameKey] || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                    placeholder="Tên đơn vị / cá nhân..." 
                                    disabled={modalMode === 'view'}
                                  />
                                  <input 
                                    type="text" 
                                    name={contact.key} 
                                    value={formData[contact.key] || contact.def} 
                                    onChange={handleInputChange} 
                                    className={`w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors ${contact.bg} ${contact.key==='sdt_ca_pccc'?'border-red-300 font-bold text-red-600':''}`} 
                                    placeholder="Số điện thoại..." 
                                    disabled={modalMode === 'view'}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Dòng 2: Công an Khu vực - Công an Xã /Phương - Bảo vệ dân phố */}
                        <div className="space-y-1.5 pt-2 border-t border-dashed border-purple-100">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Dòng 2: Công an khu vực & An ninh địa bàn</span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_ca_khu_vuc'),
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_ca_xa_phuong'),
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_bv_dan_quan')
                            ].map(contact => {
                              if (!contact) return null;
                              return (
                                <div key={contact.key} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                                  <label className={`block text-[10px] font-bold uppercase ${contact.color}`}>📞 {contact.label}</label>
                                  <input 
                                    type="text" 
                                    name={contact.nameKey} 
                                    value={formData[contact.nameKey] || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                    placeholder="Tên đơn vị / cá nhân..." 
                                    disabled={modalMode === 'view'}
                                  />
                                  <input 
                                    type="text" 
                                    name={contact.key} 
                                    value={formData[contact.key] || contact.def} 
                                    onChange={handleInputChange} 
                                    className={`w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors ${contact.bg}`} 
                                    placeholder="Số điện thoại..." 
                                    disabled={modalMode === 'view'}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Dòng 3: Cơ quan ban ngành - Điện lực - Cơ sở y tế - Cấp cứu y tế */}
                        <div className="space-y-1.5 pt-2 border-t border-dashed border-purple-100">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Dòng 3: Ban ngành, Điện nước & Y tế</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_ub'),
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_dien_luc'),
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_bv_lien_ket'),
                              CONTACTS_BAN_NGANH.find(c => c.key === 'sdt_yte')
                            ].map(contact => {
                              if (!contact) return null;
                              return (
                                <div key={contact.key} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                                  <label className={`block text-[10px] font-bold uppercase ${contact.color}`}>📞 {contact.label}</label>
                                  <input 
                                    type="text" 
                                    name={contact.nameKey} 
                                    value={formData[contact.nameKey] || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                    placeholder="Tên đơn vị / cá nhân..." 
                                    disabled={modalMode === 'view'}
                                  />
                                  <input 
                                    type="text" 
                                    name={contact.key} 
                                    value={formData[contact.key] || contact.def} 
                                    onChange={handleInputChange} 
                                    className={`w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors ${contact.bg}`} 
                                    placeholder="Số điện thoại..." 
                                    disabled={modalMode === 'view'}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>

                      {/* Nhóm 2: Nhân sự tại Đơn vị */}
                      <div className="bg-[#f0f9ff]/50 p-5 rounded-xl border border-sky-100 shadow-sm space-y-4">
                        <h5 className="text-xs font-bold text-sky-800 flex items-center gap-1.5 uppercase tracking-wider border-b border-sky-100 pb-2">
                          <Users size={15} className="text-sky-600" /> 4.2. Nhân sự phụ trách tại Đơn vị
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(() => {
                            const unitId = formData.id_don_vi;
                            const currentUnit = donViList.find(d => d.id === unitId);
                            const activeUnitPersonnel = personnelData.filter(ns => ns.id_don_vi === unitId && ns.trang_thai !== 'Đã nghỉ việc');
                            const leader = currentUnit ? activeUnitPersonnel.find(ns => ns.id === currentUnit.id_giam_doc) : null;
                            const kdDvpt = currentUnit ? activeUnitPersonnel.find(ns => ns.id === currentUnit.id_ptkd_dvpt) : null;
                            const kdXe = currentUnit ? activeUnitPersonnel.find(ns => ns.id === currentUnit.id_ptkd_xe) : null;

                            return (
                              <>
                                {/* 1. Giám đốc Showroom */}
                                <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                                  <label className="block text-[10px] font-bold uppercase text-[#05469B]">📞 Lãnh đạo đơn vị (Giám đốc)</label>
                                  <input 
                                    type="text" 
                                    name="ten_giam_doc"
                                    value={formData.ten_giam_doc !== undefined ? formData.ten_giam_doc : (leader?.ho_ten || '')} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                    placeholder={leader?.ho_ten ? `Mục A: ${leader.ho_ten}` : "Tên Giám đốc đơn vị..."} 
                                    disabled={modalMode === 'view'}
                                  />
                                  <input 
                                    type="text" 
                                    name="sdt_giam_doc"
                                    value={formData.sdt_giam_doc !== undefined ? formData.sdt_giam_doc : (leader ? formatPhoneNumber(leader.sdt_ca_nhan || leader.sdt_cong_ty) : '')} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors bg-white text-[#05469B]" 
                                    placeholder={leader ? `Mục A: ${formatPhoneNumber(leader.sdt_ca_nhan || leader.sdt_cong_ty)}` : "Số điện thoại..."} 
                                    disabled={modalMode === 'view'}
                                  />
                                </div>

                                {/* 2. PT KD DVPT */}
                                <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                                  <label className="block text-[10px] font-bold uppercase text-cyan-700">📞 Giám đốc / PT KD DVPT</label>
                                  <input 
                                    type="text" 
                                    name="ten_ptkd_dvpt"
                                    value={formData.ten_ptkd_dvpt !== undefined ? formData.ten_ptkd_dvpt : (kdDvpt?.ho_ten || '')} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                    placeholder={kdDvpt?.ho_ten ? `Mục A: ${kdDvpt.ho_ten}` : "Tên PT KD DVPT..."} 
                                    disabled={modalMode === 'view'}
                                  />
                                  <input 
                                    type="text" 
                                    name="sdt_ptkd_dvpt"
                                    value={formData.sdt_ptkd_dvpt !== undefined ? formData.sdt_ptkd_dvpt : (kdDvpt ? formatPhoneNumber(kdDvpt.sdt_ca_nhan || kdDvpt.sdt_cong_ty) : '')} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors bg-white text-cyan-700" 
                                    placeholder={kdDvpt ? `Mục A: ${formatPhoneNumber(kdDvpt.sdt_ca_nhan || kdDvpt.sdt_cong_ty)}` : "Số điện thoại..."} 
                                    disabled={modalMode === 'view'}
                                  />
                                </div>

                                {/* 3. PT KD Xe */}
                                <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                                  <label className="block text-[10px] font-bold uppercase text-indigo-700">📞 Giám đốc / PT KD Xe</label>
                                  <input 
                                    type="text" 
                                    name="ten_ptkd_xe"
                                    value={formData.ten_ptkd_xe !== undefined ? formData.ten_ptkd_xe : (kdXe?.ho_ten || '')} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                    placeholder={kdXe?.ho_ten ? `Mục A: ${kdXe.ho_ten}` : "Tên PT KD Xe..."} 
                                    disabled={modalMode === 'view'}
                                  />
                                  <input 
                                    type="text" 
                                    name="sdt_ptkd_xe"
                                    value={formData.sdt_ptkd_xe !== undefined ? formData.sdt_ptkd_xe : (kdXe ? formatPhoneNumber(kdXe.sdt_ca_nhan || kdXe.sdt_cong_ty) : '')} 
                                    onChange={handleInputChange} 
                                    className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors bg-white text-indigo-700" 
                                    placeholder={kdXe ? `Mục A: ${formatPhoneNumber(kdXe.sdt_ca_nhan || kdXe.sdt_cong_ty)}` : "Số điện thoại..."} 
                                    disabled={modalMode === 'view'}
                                  />
                                </div>
                              </>
                            );
                          })()}

                          {/* Khung 4, 5, 6: Các nhân sự khác */}
                          {CONTACTS_DON_VI.map(contact => (
                            <div key={contact.key} className="p-3 bg-white rounded-lg border border-gray-200 space-y-2 shadow-sm">
                              <label className={`block text-[10px] font-bold uppercase ${contact.color}`}>📞 {contact.label}</label>
                              <input 
                                type="text" 
                                name={contact.nameKey} 
                                value={formData[contact.nameKey] || ''} 
                                onChange={handleInputChange} 
                                className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium transition-colors" 
                                placeholder="Tên đơn vị / cá nhân..." 
                                disabled={modalMode === 'view'}
                              />
                              <input 
                                type="text" 
                                name={contact.key} 
                                value={formData[contact.key] || contact.def} 
                                onChange={handleInputChange} 
                                className={`w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-semibold transition-colors ${contact.bg}`} 
                                placeholder="Số điện thoại..." 
                                disabled={modalMode === 'view'}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div><label className="block text-[10px] font-bold text-orange-600 mb-1 uppercase">Khu vực rủi ro cháy nổ cao</label><textarea name="khu_vuc_rui_ro_cao" value={formData.khu_vuc_rui_ro_cao || ''} onChange={handleInputChange} rows={2} className="w-full p-2 border border-orange-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none" placeholder="VD: Kho sơn tĩnh điện, Kho xăng dầu..."></textarea></div>
                      <div><label className="block text-[10px] font-bold text-red-600 mb-1 uppercase">Lỗi / Tồn tại chưa khắc phục (CA Yêu cầu)</label><textarea name="loi_ton_tai_chua_khac_phuc" value={formData.loi_ton_tai_chua_khac_phuc || ''} onChange={handleInputChange} rows={2} className="w-full p-2 border border-red-300 rounded-lg bg-red-50 text-red-800 font-medium outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none" placeholder="Ghi nhận các lỗi hệ thống..."></textarea></div>
                    </div>
                  </div>

                </fieldset>
              </div>

              {/* NÚT LƯU */}
              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-2xl">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-xl font-bold transition-colors">Đóng</button>
                {modalMode !== 'view' && (
                  <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Hồ Sơ PCCC
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 MODAL DANH BẠ KHẨN CẤP (GỌI NHANH - THÔNG MINH) */}
      {isEmergencyContactOpen && selectedPcccForContact && (() => {
        const unitId = safeGet(selectedPcccForContact, 'id_don_vi');
        const unit = donViList.find(d => d.id === unitId);
        const activeUnitPersonnel = personnelData.filter(ns => ns.id_don_vi === unitId && ns.trang_thai !== 'Đã nghỉ việc');
        
        // Tự động tìm nhân sự dựa trên liên kết thực tế trong Hồ sơ Đơn vị
        const pcccLeader = unit ? activeUnitPersonnel.find(ns => ns.id === unit.id_giam_doc) : null;
        const pcccKdXe = unit ? activeUnitPersonnel.find(ns => ns.id === unit.id_ptkd_xe) : null;
        const pcccKdDvpt = unit ? activeUnitPersonnel.find(ns => ns.id === unit.id_ptkd_dvpt) : null;
        const pcccDvht = activeUnitPersonnel.find(ns => String(ns.chuc_danh).toLowerCase().includes('pt dvht') || String(ns.chuc_vu).toLowerCase().includes('hỗ trợ kd'));

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in duration-200 overflow-hidden">
              <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                <h3 className="font-bold flex items-center gap-2 text-lg"><Siren size={22}/> Danh bạ Khẩn cấp</h3>
                <button onClick={() => setIsEmergencyContactOpen(false)} className="hover:bg-red-700 p-1.5 rounded-full transition-colors shadow-sm"><X size={20}/></button>
              </div>
              
              <div className="p-0 max-h-[75vh] overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                
                {/* PHẦN 1: GHI CHÚ PCCC */}
                {safeGet(selectedPcccForContact, 'ghi_chu') && (
                  <div className="bg-yellow-50/50 p-4 border-b border-yellow-100">
                    <h4 className="text-[10px] font-black text-yellow-800 uppercase tracking-wider mb-1">Ghi chú Cơ sở</h4>
                    <p className="text-sm text-yellow-900 whitespace-pre-wrap font-medium">{safeGet(selectedPcccForContact, 'ghi_chu')}</p>
                  </div>
                )}

                {/* PHẦN 1: CƠ QUAN CHỨC NĂNG & BAN NGÀNH */}
                {selectedPcccForContact && (
                  <div className="bg-red-50/20">
                    <h4 className="px-4 py-2 text-[10px] font-black text-red-800 uppercase tracking-wider bg-red-100/50 flex items-center gap-1"><Siren size={12}/> Cơ quan chức năng & Ban ngành</h4>
                    {CONTACTS_BAN_NGANH.map(contact => {
                      const phone = safeGet(selectedPcccForContact, contact.key);
                      const nameVal = safeGet(selectedPcccForContact, contact.nameKey);
                      if (!phone) return null;
                      return (
                        <div key={contact.key} className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-red-50/30 last:border-b-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0"><AlertTriangle size={16} /></div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{contact.label}</p>
                              <p className="font-bold text-gray-800 text-sm leading-tight">{nameVal || 'Chưa cập nhật tên'}</p>
                              <p className="text-red-600 font-black text-sm mt-0.5">{formatPhoneNumber(phone)}</p>
                            </div>
                          </div>
                          <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-md"><PhoneCall size={18} /></a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* PHẦN 2: NHÂN SỰ PHỤ TRÁCH TẠI ĐƠN VỊ */}
                <div className="bg-blue-50/20">
                  <h4 className="px-4 py-2 text-[10px] font-black text-blue-800 uppercase tracking-wider bg-blue-100/50 flex items-center gap-1"><Users size={12}/> Nhân sự phụ trách tại Đơn vị</h4>
                  
                  {/* Giám đốc Showroom */}
                  {(() => {
                    const phone = pcccLeader?.sdt_ca_nhan || pcccLeader?.sdt_cong_ty || safeGet(selectedPcccForContact, 'sdt_giam_doc');
                    const name = pcccLeader?.ho_ten || safeGet(selectedPcccForContact, 'ten_giam_doc');
                    if (!phone && !name) return null;
                    return (
                      <div className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-blue-50/30">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><UserCheck size={16}/></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Giám đốc Showroom</p>
                            <p className="font-bold text-gray-800 text-sm leading-tight">{name || 'Chưa cập nhật'}</p>
                            {phone && <p className="text-[#05469B] font-black text-sm mt-0.5">{formatPhoneNumber(phone)}</p>}
                          </div>
                        </div>
                        {phone && <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-md"><PhoneCall size={18}/></a>}
                      </div>
                    );
                  })()}

                  {/* Giám đốc / PT KD DVPT */}
                  {(() => {
                    const phone = pcccKdDvpt?.sdt_ca_nhan || pcccKdDvpt?.sdt_cong_ty || safeGet(selectedPcccForContact, 'sdt_ptkd_dvpt');
                    const name = pcccKdDvpt?.ho_ten || safeGet(selectedPcccForContact, 'ten_ptkd_dvpt');
                    if (!phone && !name) return null;
                    return (
                      <div className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-blue-50/30">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0"><UserCheck size={16}/></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Giám đốc / PT KD DVPT</p>
                            <p className="font-bold text-gray-800 text-sm leading-tight">{name || 'Chưa cập nhật'}</p>
                            {phone && <p className="text-[#05469B] font-black text-sm mt-0.5">{formatPhoneNumber(phone)}</p>}
                          </div>
                        </div>
                        {phone && <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-md"><PhoneCall size={18}/></a>}
                      </div>
                    );
                  })()}

                  {/* Giám đốc / PT KD Xe */}
                  {(() => {
                    const phone = pcccKdXe?.sdt_ca_nhan || pcccKdXe?.sdt_cong_ty || safeGet(selectedPcccForContact, 'sdt_ptkd_xe');
                    const name = pcccKdXe?.ho_ten || safeGet(selectedPcccForContact, 'ten_ptkd_xe');
                    if (!phone && !name) return null;
                    return (
                      <div className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-blue-50/30">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><UserCheck size={16}/></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Giám đốc / PT KD Xe</p>
                            <p className="font-bold text-gray-800 text-sm leading-tight">{name || 'Chưa cập nhật'}</p>
                            {phone && <p className="text-[#05469B] font-black text-sm mt-0.5">{formatPhoneNumber(phone)}</p>}
                          </div>
                        </div>
                        {phone && <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-md"><PhoneCall size={18}/></a>}
                      </div>
                    );
                  })()}

                  {/* Phụ trách QTVP, PT BV, PT Kho xe */}
                  {selectedPcccForContact && CONTACTS_DON_VI.map(contact => {
                    const phone = safeGet(selectedPcccForContact, contact.key);
                    const nameVal = safeGet(selectedPcccForContact, contact.nameKey);
                    if (!phone) return null;
                    return (
                      <div key={contact.key} className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-blue-50/30">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><Users size={16} /></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{contact.label}</p>
                            <p className="font-bold text-gray-800 text-sm leading-tight">{nameVal || 'Chưa cập nhật tên'}</p>
                            <p className="text-[#05469B] font-black text-sm mt-0.5">{formatPhoneNumber(phone)}</p>
                          </div>
                        </div>
                        <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center hover:bg-sky-600 hover:text-white transition-all shadow-md"><PhoneCall size={18} /></a>
                      </div>
                    );
                  })}

                  {/* Phụ trách DV Hỗ trợ KD */}
                  {pcccDvht && (pcccDvht.sdt_ca_nhan || pcccDvht.sdt_cong_ty) && (
                    <div className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-blue-50/30">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><Briefcase size={16}/></div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Phụ trách DV Hỗ trợ KD</p>
                          <p className="font-bold text-gray-800 text-sm leading-tight">{pcccDvht.ho_ten}</p>
                          <p className="text-[#05469B] font-black text-sm mt-0.5">{formatPhoneNumber(pcccDvht.sdt_ca_nhan || pcccDvht.sdt_cong_ty)}</p>
                        </div>
                      </div>
                      <a href={`tel:${String(pcccDvht.sdt_ca_nhan || pcccDvht.sdt_cong_ty).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-md"><PhoneCall size={18}/></a>
                    </div>
                  )}

                  {/* Gọi Đội trưởng PCCC */}
                  {selectedPcccForContact && safeGet(selectedPcccForContact, 'sdt_doi_truong') && (
                    <div className="flex items-center justify-between p-4 hover:bg-white transition-colors border-b border-blue-50/30 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><HardHat size={16}/></div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Đội trưởng PCCC</p>
                          <p className="font-bold text-gray-800 text-sm leading-tight">{safeGet(selectedPcccForContact, 'ho_ten_doi_truong')}</p>
                          <p className="text-[#05469B] font-black text-sm mt-0.5">{formatPhoneNumber(safeGet(selectedPcccForContact, 'sdt_doi_truong'))}</p>
                        </div>
                      </div>
                      <a href={`tel:${String(safeGet(selectedPcccForContact, 'sdt_doi_truong')).replace(/[^\d+]/g, '')}`} className="w-10 h-10 shrink-0 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-md"><PhoneCall size={18}/></a>
                    </div>
                  )}
                </div>
                
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- MODAL DÁN DANH BẠ TỪ POWERPOINT / EXCEL --- */}
      <PcccContactPasteModal
        isOpen={isPcccPasteModalOpen}
        onClose={() => setIsPcccPasteModalOpen(false)}
        onApply={(patch) => {
          setFormData((prev: any) => ({
            ...prev,
            ...patch
          }));
        }}
      />

      {/* --- XÁC NHẬN XÓA --- */}
      {isConfirmOpen && (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 ${!isListCollapsed ? 'lg:pl-80' : ''}`}>
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa dữ liệu vĩnh viễn.</p>
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