import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  Car, Building2, MapPin, ChevronDown, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen,
  Receipt, Calendar, Info, Eye, BarChart3, Briefcase, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { apiService } from '../services/api';
import { DonVi, TS_Xe, CP_HoatDongXe } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import { formatCurrencySpace as formatCurrency, toUnaccented } from '../utils/formatters';
import { safeEvalMath } from '../utils/mathEvaluator';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';

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



const formatMathInput = (val: string | number | undefined | null) => {
  if (!val) return '';
  const str = String(val);
  if (/[+\-*/()]/.test(str)) return str; 
  return formatCurrency(str); 
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
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // 🟢 STATE CHO THANH CẢNH BÁO XE
  const [isWarningOpen, setIsWarningOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  const [plateError, setPlateError] = useState(false);
  const [selectedCarForCost, setSelectedCarForCost] = useState<TS_Xe | null>(null);

  const [carModal, setCarModal] = useState<{
    isOpen: boolean; mode: 'create' | 'update'; formData: Partial<TS_Xe> & any;
  }>({ isOpen: false, mode: 'create', formData: {} });

  const [costModal, setCostModal] = useState<{
    isOpen: boolean; mode: 'create' | 'update'; formData: any;
  }>({ isOpen: false, mode: 'create', formData: {} });

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<TS_Xe & any | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'xe' | 'chiphi'} | null>(null);

  const isCarModalOpen  = carModal.isOpen;
  const modalMode       = carModal.mode;
  const carFormData     = carModal.formData;
  const setCarFormData  = (d: any) => setCarModal(p => ({ ...p, formData: typeof d === 'function' ? d(p.formData) : d }));

  const isCostModalOpen  = costModal.isOpen;
  const costModalMode    = costModal.mode;
  const costFormData     = costModal.formData;
  const setCostFormData  = (d: any) => setCostModal(p => ({ ...p, formData: typeof d === 'function' ? d(p.formData) : d }));

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, xeResult, cpResult] = await Promise.all([
        apiService.getDonVi(), apiService.getXe(), apiService.getChiPhiXe()
      ]);
      setDonViList(dvResult || []); setXeData(xeResult || []); setChiPhiData(cpResult || []);
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu.'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[dv.id] = dv.ten_don_vi; });
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

  const filteredCars = useMemo(() => {
    let result = xeData.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) {
      const childUnitIds = donViList.filter(item => item.cap_quan_ly === selectedUnitFilter).map(c => c.id);
      const validIds = [selectedUnitFilter, ...childUnitIds];
      result = result.filter(item => validIds.includes(item.id_don_vi));
    }
    if (carSearchTerm) {
      const cleanSearch = toUnaccented(carSearchTerm).toLowerCase();
      result = result.filter(item => 
        toUnaccented(item.bien_so || '').toLowerCase().includes(cleanSearch) || 
        toUnaccented(item.hieu_xe || '').toLowerCase().includes(cleanSearch) || 
        toUnaccented(item.loai_xe || '').toLowerCase().includes(cleanSearch)
      );
    }
    return result;
  }, [xeData, carSearchTerm, selectedUnitFilter, allowedDonViIds, donViList]);

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

  // Tự động quay về trang 1 nếu người dùng tìm kiếm hoặc đổi đơn vị
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedUnitFilter, carSearchTerm]);

  // Lấy danh sách xe của trang hiện tại
  const paginatedCars = useMemo(() => {
    const startIndex = (currentPage - 1) * actualRowsPerPage;
    return filteredCars.slice(startIndex, startIndex + actualRowsPerPage);
  }, [filteredCars, currentPage, actualRowsPerPage]);
  // 🟢 KẾT THÚC: LOGIC PHÂN TRANG

  const openCarModal = (mode: 'create' | 'update', item?: TS_Xe | any) => {
    setCarModal(prev => ({ ...prev, mode })); setPlateError(false);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;
    if (item) { setCarFormData({ ...item }); } 
    else {
      setCarFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), muc_dich_su_dung: 'Xe công', ma_tai_san: '', don_vi_chu_so_huu: '', nguyen_gia: '', cp_thue_khau_hao: '', 
        bien_so: '', loai_phuong_tien: 'Ô tô du lịch', hieu_xe: '', loai_xe: '', phien_ban: '', mau_xe: '', nam_sx: '', nam_dk: '', so_khung: '', so_may: '',
        so_cho: '', loai_nhien_lieu: 'Xăng', dung_tich: '', cong_thuc_banh: '', hinh_thuc_so_huu: 'Sở hữu', gps: 'Có', hien_trang: 'Đang hoạt động', ghi_chu: '',
        // 🟢 CÁC CỘT HẠN NGÀY MỚI
        han_dang_kiem: '', han_bh_tnds: '', han_bh_vc: ''
      });
    }
    setCarModal(prev => ({ ...prev, isOpen: true })); setError(null);
  };

  const handleCarSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carFormData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị quản lý!");
    if (!carFormData.hieu_xe) return toast.warning("Vui lòng chọn Hiệu xe!");
    
    let finalData = { ...carFormData };

    // Xử lý giá trị rỗng thành null
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') finalData[key] = null;
    });

    if (modalMode === 'create' && !finalData.id) {
      finalData.id = `XE-${Date.now()}`;
    }

    setSubmitting(true); setError(null);
    try {
      const response = await apiService.save(finalData, modalMode, "ts_xe");
      const savedId = response?.id || response?.newId || finalData.id;
      const newCar = { ...finalData, id: savedId } as TS_Xe;

      if (modalMode === 'create') setXeData(prev => [newCar, ...prev]);
      else setXeData(prev => prev.map(item => item.id === savedId ? newCar : item));
      
      setCarModal(prev => ({ ...prev, isOpen: false })); 
      if (modalMode === 'create') toast.success("Thêm mới phương tiện thành công!");
      else toast.success("Cập nhật thông tin xe thành công!");

    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu Xe.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin xe!");
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleInputCarChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'bien_so') {
      if (/[\s\-\.]/.test(value)) { setPlateError(true); setTimeout(() => setPlateError(false), 4000); }
      const cleanPlate = value.toUpperCase().replace(/[\s\-\.]/g, '');
      setCarFormData(prev => ({ ...prev, [name]: cleanPlate })); return;
    }
    if (name === 'nguyen_gia' || name === 'cp_thue_khau_hao') {
      setCarFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '') })); return;
    }
    setCarFormData(prev => ({ ...prev, [name]: value }));
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
        <button onClick={() => setIsListCollapsed(false)} className="absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all" title="Mở danh sách đơn vị"><PanelLeftOpen size={20} /></button>
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
        allUnitsLabel="Tất cả Đội xe Toàn quốc"
      />

      {/* --- CỘT PHẢI (DANH SÁCH XE) --- */}
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 w-full flex flex-col">
        <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'pl-10 lg:pl-12' : ''} shrink-0`}>
          <div>
            <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Car size={28} /> Quản lý Đội xe</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredCars.length} xe)</p>
          </div>
          <div className="flex w-full sm:w-auto gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Tìm Biển số, Hiệu xe..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={carSearchTerm} onChange={(e) => setCarSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => openCarModal('create')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><Plus className="w-5 h-5" /> Thêm Xe Mới</button>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm shrink-0"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

        {/* 🟢 THANH CẢNH BÁO HẠN ĐĂNG KIỂM & BẢO HIỂM XE */}
        {expiringCars.length > 0 && !isDismissed && (
          <div className={`mb-6 transition-all duration-300 ${isListCollapsed ? 'pl-10 lg:pl-12' : ''} shrink-0`}>
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

        {/* BẢNG DỮ LIỆU CHÍNH */}
        <div className={`flex flex-col flex-1 gap-4 transition-all duration-300 ${isListCollapsed ? 'ml-10 lg:ml-0' : ''}`}>
          
          {/* BẢNG DỮ LIỆU PC */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full flex-1 overflow-x-auto custom-scrollbar">
            <table className="w-full table-fixed text-left border-collapse min-w-[1100px] text-[12px]">
              <thead className="sticky top-0 bg-[#f8fafc] z-10">
                <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">Biển số xe</th>
                  <th className="py-3 px-3 w-[15%] bg-[#f8fafc]">Hãng - Loại xe</th>
                  <th className="py-3 px-3 w-[8%] bg-[#f8fafc]">Phương tiện</th>
                  <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">Mục đích SD</th>
                  <th className="py-3 px-3 w-[15%] bg-[#f8fafc]">Đơn vị quản lý</th>
                  <th className="py-3 px-3 w-[17%] bg-[#f8fafc]">Chi phí</th>
                  <th className="py-3 px-3 w-[10%] bg-[#f8fafc]">Tình trạng</th>
                  <th className="py-3 px-3 text-center w-[15%] bg-[#f8fafc]">Thao tác</th> 
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
                      <td className="py-3 px-3 font-black text-[#05469B] text-sm whitespace-nowrap align-middle">🚙 {item.bien_so}</td>
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
                      <td className="py-3 px-3 text-indigo-600 font-semibold align-middle truncate" title={item.muc_dich_su_dung}>{item.muc_dich_su_dung || '---'}</td>
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
                        {(() => {
                          const costs = chiPhiData
                            .filter(cp => getCostCarId(cp) === item.id)
                            .sort((a, b) => String(a.thang_nam || '').localeCompare(String(b.thang_nam || '')));
                          
                          if (costs.length === 0) {
                            return <span className="text-gray-400 text-[11px] italic">Chưa phát sinh</span>;
                          }

                          const monthlyTotals = costs.map(cost => {
                            const phikhac = (Number(cost.cp_thue_khau_hao) || 0) + (Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0);
                            const total = (Number(cost.cp_nhien_lieu) || 0) + (Number(cost.cp_cau_duong_ben_bai) || 0) + (Number(cost.cp_rua_xe) || 0) + (Number(cost.cp_bao_duong_sua_chua) || 0) + phikhac;
                            return total;
                          });

                          const sumCost = monthlyTotals.reduce((a, b) => a + b, 0);
                          const maxVal = Math.max(...monthlyTotals, 1);
                          const minVal = Math.min(...monthlyTotals, 0);
                          
                          const n = monthlyTotals.length;
                          let points = '';
                          if (n === 1) {
                            points = '5,14 95,14';
                          } else {
                            points = monthlyTotals.map((val, idx) => {
                              const x = 5 + (idx / (n - 1)) * 90;
                              const y = 24 - ((val - minVal) / (maxVal - minVal || 1)) * 20;
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            }).join(' ');
                          }

                          return (
                            <div className="flex flex-col gap-1 w-full cursor-pointer" onClick={() => openCostModal(item)} title={`Chi phí ${n} tháng: Tổng ${formatCurrency(sumCost)} VNĐ (Nhấn để xem chi tiết)`}>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-gray-500">{n} tháng</span>
                                <span className="font-black text-red-600">{formatCurrency(sumCost)}</span>
                              </div>
                              <div className="w-full h-[26px] bg-slate-50 rounded border border-slate-100 flex items-center justify-center px-1 overflow-hidden hover:border-indigo-200 transition-colors">
                                <svg viewBox="0 0 100 28" className="w-full h-full overflow-visible">
                                  <polyline
                                    fill="none"
                                    stroke="#05469B"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={points}
                                  />
                                  {n > 0 && (() => {
                                    const lastVal = monthlyTotals[n - 1];
                                    const lastX = n === 1 ? 95 : 5 + ((n - 1) / (n - 1)) * 90;
                                    const lastY = 24 - ((lastVal - minVal) / (maxVal - minVal || 1)) * 20;
                                    return <circle cx={lastX} cy={lastY} r="2.5" fill="#ef4444" />;
                                  })()}
                                </svg>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold whitespace-nowrap inline-block ${item.hien_trang === 'Đang hoạt động' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          {item.hien_trang === 'Đang hoạt động' ? '🟢' : '🔴'} {item.hien_trang}
                        </span>
                      </td>
                      <td className="py-2 px-2 align-middle text-center">
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-full max-w-[110px] mx-auto">
                          {/* Dòng 1: Chi phí */}
                          <button onClick={() => openCostModal(item)} className="w-full py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded text-[10.5px] font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs leading-none">
                            <Receipt size={12} /> Chi phí
                          </button>
                          
                          {/* Dòng 2: Xem - Sửa - Xóa */}
                          <div className="grid grid-cols-3 gap-1">
                            <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="py-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Xem chi tiết">
                              <Eye size={12} />
                            </button>
                            <button onClick={() => openCarModal('update', item)} className="py-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Sửa">
                              <Edit size={12} />
                            </button>
                            <button onClick={() => { setItemToDelete({id: item.id, type: 'xe'}); setIsConfirmOpen(true); }} className="py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded flex items-center justify-center shadow-2xs transition-colors" title="Xóa">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 🟢 VIEW TRÊN MOBILE: THẺ CARD DỌC */}
          <div className="block md:hidden space-y-4 custom-scrollbar">
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
                        <span className="font-black text-[#05469B] text-sm">🚙 {item.bien_so}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${item.hien_trang === 'Đang hoạt động' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          {item.hien_trang === 'Đang hoạt động' ? '🟢' : '🔴'} {item.hien_trang}
                        </span>
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
                        <p className="font-semibold text-indigo-600 mt-0.5">{item.muc_dich_su_dung || '---'}</p>
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
                        <button onClick={() => openCarModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit size={13} /> Sửa</button>
                        <button onClick={() => { setItemToDelete({id: item.id, type: 'xe'}); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa"><Trash2 size={13} /> Xóa</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 🟢 GIAO DIỆN PHÂN TRANG (PAGINATION BAR) */}
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
      </div>

      {/* --- MODAL NHẬP THÔNG TIN TÀI SẢN XE --- */}
      {isCarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2"><Car size={24}/> {modalMode === 'create' ? 'Thêm Xe Mới' : 'Cập nhật Thông tin Xe'}</h3>
              <button onClick={() => setCarModal(prev => ({ ...prev, isOpen: false }))} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleCarSave} className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
              
              <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-[#05469B] rounded-full"></div> Hồ sơ Đăng ký & Sở hữu</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Biển Số *</label>
                    <input type="text" required name="bien_so" value={carFormData.bien_so || ''} onChange={handleInputCarChange} placeholder="VD: 51H12345" className={`w-full p-2.5 border rounded-lg outline-none font-bold focus:ring-2 focus:ring-[#05469B] ${plateError ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-[#FFFFF0] text-[#05469B]'}`} />
                    {plateError && <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse">Lỗi: Gõ liền, không dấu cách/-/. !</p>}
                  </div>
                  
                  <div className="md:col-span-2">
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
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mục đích sử dụng</label>
                    <select name="muc_dich_su_dung" value={carFormData.muc_dich_su_dung || 'Xe công'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-[#05469B]">
                      <option value="Xe công">Xe công</option>
                      <option value="Xe lái thử">Xe lái thử</option>
                      <option value="Xe thay thế cho KH">Xe thay thế cho KH</option>
                      <option value="Xe sửa chữa lưu động">Xe sửa chữa lưu động</option>
                    </select>
                  </div>

                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Mã Tài Sản (Kế toán)</label><input type="text" name="ma_tai_san" value={carFormData.ma_tai_san || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị Đứng tên Cà vẹt (Chủ sở hữu)</label><input type="text" name="don_vi_chu_so_huu" value={carFormData.don_vi_chu_so_huu || ''} onChange={handleInputCarChange} placeholder="Tên công ty/cá nhân trên Giấy đăng ký xe" className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nguyên giá (VNĐ)</label>
                    <input type="text" name="nguyen_gia" value={formatCurrency(carFormData.nguyen_gia)} onChange={handleInputCarChange} placeholder="Giá trị mua xe ban đầu..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                  </div>
                  <div className="md:col-span-2">
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
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> Đặc điểm Kỹ thuật</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
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
                      {['KIA', 'MAZDA', 'PEUGEOT', 'BMW', 'BMW MOTORAD', 'JEEP', 'RAM'].map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Loại xe *</label><input type="text" required name="loai_xe" value={carFormData.loai_xe || ''} onChange={handleInputCarChange} placeholder="VD: K3, CX-5..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Phiên bản</label><input type="text" name="phien_ban" value={carFormData.phien_ban || ''} onChange={handleInputCarChange} placeholder="VD: 2.0 Premium..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Năm SX</label><input type="text" name="nam_sx" value={carFormData.nam_sx || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Năm Đăng ký ban đầu</label><input type="text" name="nam_dk" value={carFormData.nam_dk || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Màu xe</label><input type="text" name="mau_xe" value={carFormData.mau_xe || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Số chỗ ngồi</label><input type="number" name="so_cho" value={carFormData.so_cho || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Số Khung</label><input type="text" name="so_khung" value={carFormData.so_khung || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Số Máy</label><input type="text" name="so_may" value={carFormData.so_may || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Loại Nhiên liệu</label><select name="loai_nhien_lieu" value={carFormData.loai_nhien_lieu || 'Xăng'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Xăng">Xăng</option><option value="Dầu Diesel">Dầu Diesel</option><option value="Điện">Điện</option><option value="Khác">Khác</option></select></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Dung tích</label><input type="text" name="dung_tich" value={carFormData.dung_tich || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" /></div>
                  
                  <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Công thức bánh (Xe tải)</label><input type="text" name="cong_thuc_banh" value={carFormData.cong_thuc_banh || ''} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="VD: 4x2..." /></div>
                </div>
              </div>

              <div className="bg-orange-50/40 p-5 rounded-xl border border-orange-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Định vị GPS</label><select name="gps" value={carFormData.gps || 'Có'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Có">Có</option><option value="Không">Không</option></select></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Hiện trạng</label><select name="hien_trang" value={carFormData.hien_trang || 'Đang hoạt động'} onChange={handleInputCarChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] font-bold text-[#05469B] outline-none focus:ring-2 focus:ring-[#05469B]"><option value="Đang hoạt động">Đang hoạt động</option><option value="Sửa chữa">Sửa chữa</option><option value="Ngừng hoạt động">Ngừng hoạt động</option><option value="Đã Thanh lý">Đã Thanh lý</option></select></div>
                  <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú khác</label><textarea name="ghi_chu" value={carFormData.ghi_chu || ''} onChange={handleInputCarChange} rows={2} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] resize-none"></textarea></div>
                </div>
              </div>

              <div className="pt-5 border-t border-gray-100 flex justify-end gap-3 mt-8 shrink-0">
                <button type="button" onClick={() => setCarModal(prev => ({ ...prev, isOpen: false }))} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
                <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Hồ Sơ Xe</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL XEM CHI TIẾT XE VÀ THỐNG KÊ CHI PHÍ --- */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-h-[92vh] md:max-h-[90vh] md:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in duration-200 overflow-hidden mt-auto md:mt-0">
            <div className="flex justify-between p-4 md:p-5 border-b border-gray-100 bg-[#05469B] rounded-t-3xl md:rounded-t-2xl shrink-0">
              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2"><Car size={24}/> Chi tiết Thông tin & Hoạt động Xe</h3>
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
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${viewData.hien_trang === 'Đang hoạt động' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {viewData.hien_trang}
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
                <div><p className="text-xs text-gray-500 font-bold mb-1">Số Chỗ / Tải trọng</p><p className="font-semibold text-gray-800">{viewData.so_cho || '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Nhiên Liệu</p><p className="font-semibold text-gray-800">{viewData.loai_nhien_lieu || '-'}</p></div>
              </div>

              {/* 🟢 Data Grid MỚI: Hạn Ngày Pháp lý */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shrink-0">
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
              </div>

              {/* Chart Section */}
              <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={18} className="text-[#05469B]"/> Thống kê Quãng đường & Chi phí</h4>
                  
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
                    <Receipt className="mx-auto mb-2 opacity-50" size={32}/>
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
        </div>
      )}

      {/* --- MODAL CHI PHÍ HOẠT ĐỘNG --- */}
      {isCostModalOpen && selectedCarForCost && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setCostModal(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="bg-white shadow-2xl w-full max-w-md md:max-w-xl h-full flex flex-col animate-in slide-in-from-right duration-300 relative z-10">
            
            <div className="p-5 border-b border-indigo-100 bg-indigo-600 text-white flex justify-between items-start shrink-0">
              <div className="flex-1 pr-4">
                <h3 className="text-xl font-black flex items-center gap-2 mb-1.5"><Receipt size={20}/> Khai báo Chi phí</h3>
                <p className="text-sm text-indigo-100 font-medium leading-relaxed">
                  <span className="text-white font-bold text-base tracking-wider">{selectedCarForCost.bien_so}</span>
                  <span className="mx-2 opacity-60">|</span>
                  {selectedCarForCost.hieu_xe} {selectedCarForCost.loai_xe}
                  <span className="mx-2 opacity-60">|</span>
                  {getUnitFullName(selectedCarForCost.id_don_vi)}
                </p>
              </div>
              <button onClick={() => setCostModal(prev => ({ ...prev, isOpen: false }))} className="text-indigo-200 hover:text-white bg-indigo-700/50 hover:bg-indigo-700 p-2 rounded-full transition-colors mt-1 shrink-0"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col min-h-0 custom-scrollbar">
              <div className="p-5 bg-white border-b border-gray-200 shadow-sm z-10 shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5"><Calendar size={16} className="text-indigo-600"/> {costModalMode === 'create' ? 'Khai báo tháng mới' : 'Cập nhật tháng'}</h4>
                  {costModalMode === 'update' && (
                    <button onClick={() => {setCostModal(prev => ({ ...prev, mode: 'create' })); setCostFormData({id: '', thang_nam: new Date().toISOString().slice(0, 7), id_ts_xe: selectedCarForCost.id, id_don_vi: selectedCarForCost.id_don_vi, km_hien_tai: '', so_lit_nhien_lieu: '', cp_nhien_lieu: '', cp_cau_duong_ben_bai: '', cp_rua_xe: '', cp_bao_duong_sua_chua: '', cp_thue_khau_hao: '', cp_dang_kiem: '', cp_bh_tnds: '', cp_bh_vc: '', ghi_chu: ''})}} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={14}/> Thêm mới</button>
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
                    <div className="text-center py-6 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300"><Info className="mx-auto w-6 h-6 mb-2 opacity-50"/><p className="text-sm font-medium">Chưa có dữ liệu chi phí nào</p></div>
                  ) : (
                    carCosts.map((cost, idx) => {
                      const tongCP = (Number(cost.cp_nhien_lieu) || 0) + (Number(cost.cp_cau_duong_ben_bai) || 0) + (Number(cost.cp_rua_xe) || 0) + (Number(cost.cp_bao_duong_sua_chua) || 0) + (Number(cost.cp_thue_khau_hao) || 0) + (Number(cost.cp_dang_kiem) || 0) + (Number(cost.cp_bh_tnds) || 0) + (Number(cost.cp_bh_vc) || 0);
                      const costId = getCostId(cost) || `log-${idx}`;
                      return (
                        <div key={costId} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-sm">{formatMonthYear(cost.thang_nam)}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editCost(cost)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={14}/></button>
                              <button onClick={() => {setItemToDelete({id: costId, type: 'chiphi'}); setIsConfirmOpen(true);}} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                            <div className="text-gray-500">Số Km: <span className="font-semibold text-gray-800">{formatCurrency(cost.km_hien_tai)}</span></div>
                            <div className="text-gray-500 text-right">Lít NL: <span className="font-semibold text-gray-800">{cost.so_lit_nhien_lieu} L</span></div>
                            <div className="text-gray-500">Nhiên liệu: <span className="font-semibold text-gray-800">{formatCurrency(cost.cp_nhien_lieu)}</span></div>
                            <div className="text-gray-500 text-right">Bảo dưỡng: <span className="font-semibold text-gray-800">{formatCurrency(cost.cp_bao_duong_sua_chua)}</span></div>
                            <div className="text-gray-500 col-span-2 mt-1 pt-1 border-t border-gray-50">ĐK & Bảo hiểm: <span className="font-semibold text-emerald-600">{formatCurrency((Number(cost.cp_dang_kiem)||0) + (Number(cost.cp_bh_tnds)||0) + (Number(cost.cp_bh_vc)||0))}</span></div>
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
        </div>
      )}

      {/* --- XÁC NHẬN XÓA --- */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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