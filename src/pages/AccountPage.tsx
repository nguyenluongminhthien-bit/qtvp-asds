import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, UserCog, Shield, Key, Building2, Mail, CheckSquare, ListChecks, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { apiService } from '../services/api';
import { User, DonVi } from '../types';
import { buildHierarchicalOptions, getUnitEmoji, getAllSubordinateIds } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { stripAccents } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

// 🟢 1. KHO DANH SÁCH MODULE (quyen_truy_cap)
const MODULE_LIST = [
  { id: 'TongQuan', label: 'Tổng quan Dashboard', icon: '📊' },
  { id: 'CongTy', label: 'Thông tin Công ty', icon: '🏢' },
  { id: 'NhanSu', label: 'Thông tin Nhân sự', icon: '👥' },
  { id: 'PCCC', label: 'Phòng cháy chữa cháy', icon: '🔥' },
  { id: 'ATVSLD', label: 'An toàn vệ sinh LĐ', icon: '⛑️' },
  { id: 'Xe', label: 'Thông tin Xe', icon: '🚗' },
  { id: 'ThietBi', label: 'Thông tin TTB VP', icon: '💻' },
  { id: 'ChiPhi', label: 'Quản lý Chi phí', icon: '💰' },
  { id: 'NhaCungCap', label: 'Quản lý Nhà cung cấp', icon: '🤝' },
  { id: 'VanBan', label: 'Văn bản - Thông báo', icon: '📄' },
  { id: 'QuyDinh', label: 'Quy định - Quy trình', icon: '📖' },
  { id: 'BaoCao', label: 'Báo cáo Tổng hợp', icon: '📑' }
];

// 🟢 2. KHO MA TRẬN QUYỀN CHI TIẾT (quyen_chi_tiet)
const ADVANCED_PERMISSIONS = {
  VanBan: [
    { id: 'VB_VIEW_QD', label: 'Quyền xem Quyết định' },
    { id: 'VB_VIEW_TB', label: 'Quyền xem Thông báo' },
    { id: 'VB_VIEW_TB_BDH', label: 'Quyền xem Thông báo BĐH' },
    { id: 'VB_VIEW_TT', label: 'Quyền xem Tờ trình' },
    { id: 'VB_VIEW_CV_DI', label: 'Quyền xem Công văn đi' },
    { id: 'VB_VIEW_CV_DEN', label: 'Quyền xem Công văn đến' },
    { id: 'VB_HIDE_BTN', label: 'Ẩn nút Ban hành' },
  ],
  QuyDinh: [],
  NhanSu: [
    { id: 'NS_HIDE_SENSITIVE', label: 'Ẩn SĐT, Lương, Ngạch' },
    { id: 'NS_NO_DETAIL', label: 'Cấm xem Chi tiết Hồ sơ' },
  ],
  ThietBi: [
    { id: 'TB_HIDE_PRICE', label: 'Ẩn cột Nguyên giá' },
  ],
  Xe: []
};

export default function AccountPage() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<User[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [xeList, setXeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [carFilterTerm, setCarFilterTerm] = useState('');

  const yearOptions = useMemo(() => {
    const startYear = 2010;
    const endYear = new Date().getFullYear() + 3; // e.g. 2029
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => String(endYear - i));
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [showPassword, setShowPassword] = useState(false);
  
  // Mở rộng formData để chứa quyen_truy_cap và quyen_chi_tiet
  const [formData, setFormData] = useState<Partial<User & { quyen_truy_cap?: string; quyen_chi_tiet?: string }>>({});

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true); setError(null);
      try {
        const [users, donvis, xes] = await Promise.all([
          apiService.getUsers(), 
          apiService.getDonVi(),
          apiService.getXe()
        ]);
        setData(users || []); 
        setDonViList(donvis || []);
        setXeList(xes || []);
      } catch (err: any) { 
        setError(err.message || 'Lỗi tải dữ liệu tài khoản.'); 
      } finally { 
        setLoading(false); 
      }
    };
    loadData();
  }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    (donViList || []).forEach(dv => { map[String(dv.id || '')] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const carsOfSelectedUnit = useMemo(() => {
    const targetDonViId = formData.id_don_vi || '';
    if (!targetDonViId || targetDonViId === 'ALL' || targetDonViId === 'HO') {
      return xeList;
    }
    const targetIds = targetDonViId.split(',').map(s => s.trim()).filter(Boolean);
    const allowedUnitIds = new Set<string>();
    targetIds.forEach(id => {
      allowedUnitIds.add(id);
      getAllSubordinateIds(id, donViList).forEach(cid => allowedUnitIds.add(cid));
    });
    return xeList.filter(car => allowedUnitIds.has(car.id_don_vi));
  }, [formData.id_don_vi, xeList, donViList]);

  const isHOAdmin = useMemo(() => {
    if (!currentUser) return false;
    const userQuyen = String(currentUser.quyen || (currentUser as any).role || '').trim().toLowerCase();
    const userIdDonVi = String(currentUser.id_don_vi || (currentUser as any).idDonVi || '').trim();
    if (userQuyen !== 'admin') return false;
    if (userIdDonVi === 'ALL' || userIdDonVi === 'HO' || userIdDonVi === 'DV_HO' || !userIdDonVi) return true;
    const uDonVi = (donViList || []).find(dv => String(dv.id || '') === userIdDonVi);
    if (uDonVi) {
      const lh = String(uDonVi.loai_hinh || '').toLowerCase();
      const name = String(uDonVi.ten_don_vi || '').toLowerCase();
      const cap = String(uDonVi.cap_quan_ly || '').toUpperCase();
      if (cap === 'HO' || lh.includes('tổng công ty') || name.includes('toàn quốc')) {
        return true;
      }
    }
    return false;
  }, [currentUser, donViList]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const userQuyen = String(currentUser.quyen || (currentUser as any).role || '').trim().toUpperCase();
    return userQuyen === 'ADMIN';
  }, [currentUser]);

  const myDonViIds = useMemo(() => {
    if (!currentUser) return [];
    return String(currentUser.id_don_vi || (currentUser as any).idDonVi || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [currentUser]);

  const subordinateDonViIds = useMemo(() => {
    if (myDonViIds.length === 0 || isHOAdmin) return (donViList || []).map(dv => String(dv.id || ''));
    const allSubs = new Set<string>();
    myDonViIds.forEach(id => {
      allSubs.add(id);
      getAllSubordinateIds(id, donViList || []).forEach(sid => allSubs.add(sid));
    });
    return Array.from(allSubs);
  }, [myDonViIds, donViList, isHOAdmin]);

  const visibleAccounts = useMemo(() => {
    if (!currentUser) return [];
    if (isHOAdmin) return data || [];
    const myId = String(currentUser.id || '').trim();
    const myUserName = String(currentUser.user_name || '').trim().toLowerCase();
    return (data || []).filter(item => {
      const itemId = String(item.id || '').trim();
      const itemUserName = String(item.user_name || '').trim().toLowerCase();
      if (itemId === myId || (myUserName && itemUserName === myUserName)) return true;
      const itemDvs = String(item.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
      if (itemDvs.some(dv => subordinateDonViIds.includes(dv))) return true;
      return false;
    });
  }, [data, currentUser, isHOAdmin, subordinateDonViIds]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return visibleAccounts;
    const cleanSearch = stripAccents(searchTerm);
    return visibleAccounts.filter(item => 
      stripAccents(item.user_name || '').includes(cleanSearch) || 
      stripAccents(item.ho_ten || '').includes(cleanSearch) ||
      stripAccents(item.id || '').includes(cleanSearch)
    );
  }, [visibleAccounts, searchTerm]);

  const allowedModalDonViList = useMemo(() => {
    if (isHOAdmin) return donViList || [];
    return (donViList || []).filter(dv => subordinateDonViIds.includes(String(dv.id || '')) || myDonViIds.includes(String(dv.id || '')));
  }, [donViList, isHOAdmin, subordinateDonViIds, myDonViIds]);

  const canEditAccount = useCallback((item: any) => {
    if (!currentUser || !item) return false;
    if (isHOAdmin) return true;
    const itemId = String(item.id || '').trim();
    const myId = String(currentUser.id || '').trim();
    if (itemId === myId) return true;
    const itemDvs = String(item.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    return itemDvs.some(dv => subordinateDonViIds.includes(dv));
  }, [currentUser, isHOAdmin, subordinateDonViIds]);

  const canDeleteAccount = useCallback((item: any) => {
    if (!currentUser || !item) return false;
    if (isHOAdmin) return true;
    const itemId = String(item.id || '').trim();
    const myId = String(currentUser.id || '').trim();
    if (itemId === myId) return false; // Không tự xóa chính mình
    const itemDvs = String(item.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    return itemDvs.some(dv => subordinateDonViIds.includes(dv));
  }, [currentUser, isHOAdmin, subordinateDonViIds]);

  // Multi-select dropdown state cho Đơn vị quản lý
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
    };
    if (isUnitDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUnitDropdownOpen]);

  // Danh sách ID đơn vị đang được chọn trong form
  const selectedUnitIds = useMemo(() => {
    if (!formData.id_don_vi) return [];
    if (formData.id_don_vi === 'ALL') return ['ALL'];
    return String(formData.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
  }, [formData.id_don_vi]);

  // Toggle chọn/bỏ chọn đơn vị
  const handleToggleUnit = (unitId: string) => {
    if (!isAdmin) return;
    setFormData(prev => {
      const current = String(prev.id_don_vi || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => Boolean(s) && s !== 'ALL');
      let next: string[];
      if (current.includes(unitId)) {
        next = current.filter(id => id !== unitId);
      } else {
        next = [...current, unitId];
      }
      return {
        ...prev,
        id_don_vi: next.length > 0 ? next.join(',') : null
      };
    });
  };

  // Chọn tất cả đơn vị được phép
  const handleSelectAllUnits = () => {
    if (!isAdmin) return;
    const allIds = allowedModalDonViList.map(u => String(u.id));
    setFormData(prev => ({
      ...prev,
      id_don_vi: allIds.join(',')
    }));
  };

  // Bỏ chọn tất cả đơn vị
  const handleClearAllUnits = () => {
    if (!isAdmin) return;
    setFormData(prev => ({
      ...prev,
      id_don_vi: null
    }));
  };

  // Cây đơn vị phân cấp trong modal theo từ khóa tìm kiếm
  const hierarchicalModalUnitOptions = useMemo(() => {
    return buildHierarchicalOptions(allowedModalDonViList);
  }, [allowedModalDonViList]);

  const displayedModalUnitOptions = useMemo(() => {
    if (!unitSearchQuery.trim()) {
      return hierarchicalModalUnitOptions;
    }
    const q = stripAccents(unitSearchQuery.toLowerCase().trim());
    return hierarchicalModalUnitOptions.filter(({ unit }) =>
      stripAccents(String(unit.ten_don_vi || '').toLowerCase()).includes(q) ||
      stripAccents(String(unit.id || '').toLowerCase()).includes(q) ||
      stripAccents(String(unit.loai_hinh || '').toLowerCase()).includes(q)
    );
  }, [hierarchicalModalUnitOptions, unitSearchQuery]);

  const openModal = (mode: 'create' | 'update', item?: any) => {
    if (item && mode === 'update' && !canEditAccount(item)) {
      toast.error('Bạn không có quyền chỉnh sửa tài khoản này!');
      return;
    }
    setModalMode(mode);
    setShowPassword(false);
    setIsUnitDropdownOpen(false);
    setUnitSearchQuery('');
    const defaultDv = isHOAdmin ? '' : (subordinateDonViIds[0] || (myDonViIds[0] || ''));
    setFormData(item ? { ...item } : { 
      id: '', user_name: '', password: '', ho_ten: '', id_don_vi: defaultDv, 
      quyen: 'USER', quyen_truy_cap: '', quyen_chi_tiet: '' 
    });
    setIsModalOpen(true); setError(null);
  };

  // 🟢 LOGIC XỬ LÝ CLICK CHỌN MODULE
  const handleToggleModule = (moduleId: string) => {
    setFormData((prev) => {
      let currentModules = prev.quyen_truy_cap ? prev.quyen_truy_cap.split(',').map(m => m.trim()).filter(Boolean) : [];
      if (currentModules.includes(moduleId)) {
        currentModules = currentModules.filter(id => id !== moduleId); // Bỏ tick
      } else {
        currentModules.push(moduleId); // Tick
      }
      return { ...prev, quyen_truy_cap: currentModules.join(',') };
    });
  };

  // 🟢 LOGIC XỬ LÝ CLICK CHỌN QUYỀN CHI TIẾT
  const handleToggleAdvancedRule = (ruleId: string) => {
    setFormData((prev) => {
      let currentRules = prev.quyen_chi_tiet ? prev.quyen_chi_tiet.split(',').map(r => r.trim()).filter(Boolean) : [];
      if (currentRules.includes(ruleId)) {
        currentRules = currentRules.filter(id => id !== ruleId);
      } else {
        currentRules.push(ruleId);
      }
      return { ...prev, quyen_chi_tiet: currentRules.join(',') };
    });
  };

  const getYearsFromRule = (ruleString: string | undefined, prefix: string): string[] => {
    if (!ruleString) return [];
    const rules = ruleString.split(',').map(r => r.trim());
    const rule = rules.find(r => r.startsWith(prefix));
    if (!rule) return [];
    return rule.substring(prefix.length).split('|').filter(Boolean);
  };

  const handleToggleYearRule = (prefix: string, year: string) => {
    setFormData(prev => {
      let currentRules = prev.quyen_chi_tiet ? prev.quyen_chi_tiet.split(',').map(r => r.trim()).filter(Boolean) : [];
      const ruleIndex = currentRules.findIndex(r => r.startsWith(prefix));
      
      let activeYears: string[] = [];
      if (ruleIndex !== -1) {
        activeYears = currentRules[ruleIndex].substring(prefix.length).split('|').filter(Boolean);
        currentRules.splice(ruleIndex, 1);
      }
      
      if (activeYears.includes(year)) {
        activeYears = activeYears.filter(y => y !== year);
      } else {
        activeYears.push(year);
      }
      
      if (activeYears.length > 0) {
        currentRules.push(`${prefix}${activeYears.join('|')}`);
      }
      
      return { ...prev, quyen_chi_tiet: currentRules.join(',') };
    });
  };

  const getTypesFromRule = (ruleString: string | undefined, prefix: string): string[] => {
    if (!ruleString) return [];
    const rules = ruleString.split(',').map(r => r.trim());
    const rule = rules.find(r => r.startsWith(prefix));
    if (!rule) return [];
    return rule.substring(prefix.length).split('|').filter(Boolean);
  };

  const handleToggleTypeRule = (prefix: string, type: string) => {
    setFormData(prev => {
      let currentRules = prev.quyen_chi_tiet ? prev.quyen_chi_tiet.split(',').map(r => r.trim()).filter(Boolean) : [];
      const ruleIndex = currentRules.findIndex(r => r.startsWith(prefix));
      
      let activeTypes: string[] = [];
      if (ruleIndex !== -1) {
        activeTypes = currentRules[ruleIndex].substring(prefix.length).split('|').filter(Boolean);
        currentRules.splice(ruleIndex, 1);
      }
      
      if (activeTypes.includes(type)) {
        activeTypes = activeTypes.filter(t => t !== type);
      } else {
        activeTypes.push(type);
      }
      
      if (activeTypes.length > 0) {
        currentRules.push(`${prefix}${activeTypes.join('|')}`);
      }
      
      return { ...prev, quyen_chi_tiet: currentRules.join(',') };
    });
  };

  const getPlatesFromRule = (ruleString: string | undefined, prefix: string): string[] => {
    if (!ruleString) return [];
    const rules = ruleString.split(',').map(r => r.trim());
    const rule = rules.find(r => r.startsWith(prefix));
    if (!rule) return [];
    return rule.substring(prefix.length).split('|').filter(Boolean);
  };

  const handleTogglePlateRule = (prefix: string, plate: string) => {
    setFormData(prev => {
      let currentRules = prev.quyen_chi_tiet ? prev.quyen_chi_tiet.split(',').map(r => r.trim()).filter(Boolean) : [];
      const ruleIndex = currentRules.findIndex(r => r.startsWith(prefix));
      
      let activePlates: string[] = [];
      if (ruleIndex !== -1) {
        activePlates = currentRules[ruleIndex].substring(prefix.length).split('|').filter(Boolean);
        currentRules.splice(ruleIndex, 1);
      }
      
      if (activePlates.includes(plate)) {
        activePlates = activePlates.filter(p => p !== plate);
      } else {
        activePlates.push(plate);
      }
      
      if (activePlates.length > 0) {
        currentRules.push(`${prefix}${activePlates.join('|')}`);
      }
      
      return { ...prev, quyen_chi_tiet: currentRules.join(',') };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      const finalData = { ...formData };
      if (finalData.id_don_vi === '') {
        finalData.id_don_vi = null; 
      }

      const response = await apiService.save(finalData, modalMode, "config_users");
      if (modalMode === 'create') {
        finalData.id = response.id || response.newId || finalData.id; 
        setData(prev => [...prev, finalData as User]);
      } else {
        setData(prev => prev.map(item => item.id === finalData.id ? finalData as User : item));
      }
      setIsModalOpen(false);
      
      if (modalMode === 'create') {
        toast.success("Tạo tài khoản mới thành công!");
      } else {
        toast.success("Cập nhật tài khoản thành công!");
      }
    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu tài khoản.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi lưu tài khoản!");
    } finally { 
      setSubmitting(false); 
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true); 
    setError(null);
    try {
      await apiService.delete(itemToDelete, "config_users");
      setData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsConfirmOpen(false); 
      setItemToDelete(null);
      toast.success("Xóa tài khoản thành công!");
    } catch (err: any) { 
      setError(err.message || 'Lỗi xóa tài khoản.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi xóa tài khoản!");
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-[#05469B] flex items-center gap-2"><UserCog size={28} /> Quản lý Tài khoản</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Cấp quyền truy cập và bảo mật hệ thống</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Tìm tài khoản, họ tên..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {isAdmin && (
            <button onClick={() => openModal('create')} className="flex items-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all"><Plus size={20} /> Cấp tài khoản</button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100"><AlertCircle size={20}/> {error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-[#f8fafc] border-b border-gray-200 sticky top-0 z-10">
              <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-4 w-24">Mã User</th>
                <th className="p-4">Thông tin User</th>
                <th className="p-4">Đơn vị quản lý</th>
                <th className="p-4 w-40">Cấp độ Thao tác</th>
                <th className="p-4 text-center w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (<tr><td colSpan={5} className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#05469B] mb-2"/> Đang tải...</td></tr>) 
              : filteredData.length === 0 ? (<tr><td colSpan={5} className="p-12 text-center text-gray-400"><UserCog size={40} className="mx-auto mb-3 opacity-50"/> Không có dữ liệu tài khoản.</td></tr>) 
              : filteredData.map(user => (
                <tr key={user.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="p-4 font-bold text-gray-700">{user.id}</td>
                  <td className="p-4">
                    <p className="font-bold text-[#05469B] text-base">{user.ho_ten}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{user.user_name}</p>
                    {/* Hiển thị tóm tắt quyền */}
                    <div className="mt-1 flex flex-wrap gap-1">
                       {String((user as any).quyen_truy_cap || '').includes('ALL') ? (
                         <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">ALL MODULES</span>
                       ) : (
                         String((user as any).quyen_truy_cap || '').split(',').map((m, i) => m.trim() && <span key={i} className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{m}</span>)
                       )}
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-gray-700">
                    {(!user.id_don_vi || user.id_don_vi === 'ALL') ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md">
                        <span>🌐</span>
                        <span>TẤT CẢ ĐƠN VỊ (HO)</span>
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {String(user.id_don_vi).split(',').map(s => s.trim()).filter(Boolean).map(uid => (
                          <span
                            key={uid}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 text-[#05469B] border border-blue-100 font-medium"
                            title={donViMap[uid] || uid}
                          >
                            <Building2 size={12} className="text-blue-500 shrink-0" />
                            <span className="truncate max-w-[160px]">{donViMap[uid] || uid}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-black border tracking-wider uppercase
                      ${String(user.quyen).toUpperCase() === 'ADMIN' ? 'bg-red-50 text-red-600 border-red-200' : 
                        String(user.quyen).toLowerCase() === 'viewer_hanche' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                        'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                      {String(user.quyen).toLowerCase() === 'viewer_hanche' ? 'VIEWER' : user.quyen}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {canEditAccount(user) && (
                        <button onClick={() => openModal('update', user)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title={isAdmin ? "Sửa thông tin / Đổi mật khẩu" : "Đổi mật khẩu"}><Edit size={16}/></button>
                      )}
                      {isAdmin && canDeleteAccount(user) && (
                        <button onClick={() => {setItemToDelete(user.id); setIsConfirmOpen(true)}} className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Xóa tài khoản"><Trash2 size={16}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {/* 🟢 MỞ RỘNG MODAL THÀNH max-w-4xl ĐỂ CHỨA CHECKBOX */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[95vh]">
            <div className="flex justify-between items-center p-5 border-b bg-[#05469B] text-white shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2"><UserCog size={24}/> {modalMode === 'create' ? 'Cấp tài khoản mới' : isAdmin ? 'Cập nhật tài khoản' : 'Đổi mật khẩu & Thông tin tài khoản'}</h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6 custom-scrollbar">
              <form id="accountForm" onSubmit={handleSave} className="space-y-6">
                
                {/* THÔNG TIN CƠ BẢN */}
                <div>
                  <h4 className="font-bold text-[#05469B] mb-3 flex items-center gap-2 border-b pb-2"><Shield size={18}/> 1. Thông tin Hành chính & Đăng nhập</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Mã User *</label>
                      <input 
                        type="text" 
                        required 
                        name="id" 
                        value={formData.id || ''} 
                        onChange={e=>setFormData({...formData, id: e.target.value})} 
                        disabled={modalMode==='update' || !isAdmin} 
                        className="w-full h-[40px] px-3.5 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] disabled:opacity-70 font-medium" 
                        placeholder="VD: U01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Họ và Tên *</label>
                      <input 
                        type="text" 
                        required 
                        name="ho_ten" 
                        value={formData.ho_ten || ''} 
                        onChange={e=>setFormData({...formData, ho_ten: e.target.value})} 
                        disabled={!isAdmin && String(formData.id) !== String(currentUser?.id)} 
                        className="w-full h-[40px] px-3.5 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-medium"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Tên đăng nhập (Email) *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                        <input 
                          type="text" 
                          required 
                          name="user_name" 
                          value={formData.user_name || ''} 
                          onChange={e=>setFormData({...formData, user_name: e.target.value})} 
                          disabled={!isAdmin} 
                          className="w-full h-[40px] pl-10 pr-3.5 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Mật khẩu *</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required 
                          name="password" 
                          value={formData.password || ''} 
                          onChange={e=>setFormData({...formData, password: e.target.value})} 
                          className="w-full h-[40px] pl-10 pr-10 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-mono tracking-widest text-indigo-700 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-1"
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Đơn vị quản lý
                        {selectedUnitIds.length > 0 && selectedUnitIds[0] !== 'ALL' && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-[#05469B] font-bold">
                            {selectedUnitIds.length} đã chọn
                          </span>
                        )}
                      </label>

                      <div className="relative" ref={unitDropdownRef}>
                        {/* Trigger button */}
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => {
                            setIsUnitDropdownOpen(!isUnitDropdownOpen);
                            setUnitSearchQuery('');
                          }}
                          className={`w-full h-[40px] flex items-center justify-between pl-10 pr-3 border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] text-left text-sm transition-all cursor-pointer ${
                            isUnitDropdownOpen ? 'ring-2 ring-[#05469B] border-[#05469B]' : ''
                          }`}
                        >
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                          <div className="flex-1 min-w-0 pr-1 truncate">
                            {(!formData.id_don_vi || formData.id_don_vi === 'ALL') ? (
                              <span className="text-indigo-600 font-bold text-sm flex items-center gap-1.5">
                                <span>🌐</span>
                                <span className="truncate">-- Quản trị Toàn quốc (HO) --</span>
                              </span>
                            ) : (
                              <span className="truncate text-gray-700 font-medium block text-sm">
                                {selectedUnitIds.map(uid => donViMap[uid] || uid).join(', ')}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            size={17}
                            className={`text-gray-400 transition-transform duration-200 shrink-0 ${
                              isUnitDropdownOpen ? 'rotate-180 text-[#05469B]' : ''
                            }`}
                          />
                        </button>

                        {/* Popover Dropdown Panel */}
                        {isUnitDropdownOpen && isAdmin && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                            {/* Header có nút Chọn tất cả | Bỏ chọn */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                              <span className="text-[11px] font-bold text-gray-500 uppercase">
                                Đã chọn: <strong className="text-[#05469B]">{selectedUnitIds.length}</strong>
                              </span>
                              <div className="flex items-center gap-2 text-[11px]">
                                <button
                                  type="button"
                                  onClick={handleSelectAllUnits}
                                  className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                                >
                                  Chọn tất cả
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                  type="button"
                                  onClick={handleClearAllUnits}
                                  className="text-gray-500 hover:text-red-600 font-semibold cursor-pointer"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            </div>

                            {/* Option Toàn quốc (HO) dành cho Admin HO */}
                            {isHOAdmin && (
                              <label
                                className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  !formData.id_don_vi || formData.id_don_vi === 'ALL'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                                    : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!formData.id_don_vi || formData.id_don_vi === 'ALL'}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData(p => ({ ...p, id_don_vi: null }));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <span className="text-xs">🌐 Quản trị Toàn quốc (HO)</span>
                              </label>
                            )}

                            {/* Ô tìm kiếm nhanh đơn vị */}
                            {allowedModalDonViList.length > 4 && (
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                                <input
                                  type="text"
                                  placeholder="Tìm đơn vị, showroom..."
                                  value={unitSearchQuery}
                                  onChange={(e) => setUnitSearchQuery(e.target.value)}
                                  className="w-full pl-8 pr-3 h-[28px] text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#05469B]"
                                  autoFocus
                                />
                              </div>
                            )}

                            {/* Cây danh sách đơn vị có checkbox */}
                            <div className="max-h-56 overflow-y-auto p-1 bg-white rounded-lg border border-gray-100 custom-scrollbar space-y-0.5">
                              {displayedModalUnitOptions.length === 0 ? (
                                <div className="text-center py-4 text-xs text-gray-400">
                                  Không tìm thấy đơn vị phù hợp
                                </div>
                              ) : (
                                displayedModalUnitOptions.map(({ unit, prefix }) => {
                                  const isChecked = selectedUnitIds.includes(String(unit.id));
                                  return (
                                    <label
                                      key={unit.id}
                                      className={`flex items-center gap-2 p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                        isChecked
                                          ? 'bg-blue-50 text-blue-900 font-semibold'
                                          : 'hover:bg-gray-50 text-gray-700'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleUnit(String(unit.id))}
                                        className="rounded text-[#05469B] focus:ring-[#05469B] w-3.5 h-3.5 cursor-pointer shrink-0"
                                      />
                                      <span className="font-mono text-[11px] text-gray-400 select-none shrink-0">
                                        {prefix}
                                      </span>
                                      <span className="shrink-0">{getUnitEmoji(unit.loai_hinh)}</span>
                                      <span className="truncate flex-1">{unit.ten_don_vi}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Cấp độ Thao tác (Quyền Cốt lõi) *</label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                        <select 
                          required 
                          name="quyen" 
                          value={formData.quyen || 'USER'} 
                          onChange={e=>setFormData({...formData, quyen: e.target.value})} 
                          disabled={!isAdmin}
                          className="w-full h-[40px] pl-10 pr-3 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                        >
                          <option value="USER">USER (Được quyền Thêm/Sửa/Xóa của mình)</option>
                          <option value="viewer_hanche">VIEWER (Chỉ xem, cấm click chi tiết)</option>
                          {isAdmin && <option value="ADMIN">ADMIN (Quản trị toàn quyền)</option>}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HIỂN THỊ PHẦN 2 VÀ PHẦN 3 CHỈ KHI LÀ ADMIN */}
                {isAdmin && (
                  <>
                    {/* MODULE TRUY CẬP */}
                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                      <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><CheckSquare size={18}/> 2. Phân quyền Truy cập Module (Thanh Menu)</h4>
                      
                      <div className="mb-4 pb-4 border-b border-blue-200">
                        <label className="flex items-center gap-2 cursor-pointer w-max hover:bg-blue-100 p-2 rounded transition-colors">
                          <input 
                            type="checkbox" 
                            checked={formData.quyen_truy_cap === 'ALL'}
                            onChange={(e) => setFormData(prev => ({ ...prev, quyen_truy_cap: e.target.checked ? 'ALL' : '' }))}
                            className="w-5 h-5 text-red-600 border-red-300 focus:ring-red-500 rounded"
                          />
                          <span className="font-black text-red-600 text-sm">ALL (Cấp Đặc quyền Xem toàn bộ Hệ thống)</span>
                        </label>
                      </div>

                      {formData.quyen_truy_cap !== 'ALL' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {MODULE_LIST.map(module => {
                            const isChecked = formData.quyen_truy_cap?.split(',').map(m => m.trim()).includes(module.id);
                            return (
                              <label key={module.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-white border-[#05469B] shadow-sm' : 'bg-white/50 border-gray-200 hover:bg-white'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={() => handleToggleModule(module.id)}
                                  className="w-4 h-4 text-[#05469B] rounded focus:ring-[#05469B]"
                                />
                                <span className={`text-sm font-medium ${isChecked ? 'text-[#05469B]' : 'text-gray-600'}`}>{module.icon} {module.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* MA TRẬN QUYỀN CHI TIẾT */}
                    <div className="bg-orange-50/30 p-5 rounded-xl border border-orange-100">
                      <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><ListChecks size={18}/> 3. Cấu hình Đặc quyền Chi tiết (Ma trận Quyền)</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        {Object.entries(ADVANCED_PERMISSIONS).map(([moduleName, options]) => (
                          <div key={moduleName} className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm h-full flex flex-col">
                            <h5 className="font-bold text-gray-700 mb-3 uppercase text-xs border-b pb-2">
                              {moduleName === 'VanBan' ? '📑 Module Văn bản' 
                               : moduleName === 'QuyDinh' ? '📖 Module Quy định - Quy trình' 
                               : moduleName === 'NhanSu' ? '👥 Module Nhân sự' 
                               : moduleName === 'ThietBi' ? '💻 Module Thiết bị'
                               : '🚗 Module Xe'}
                            </h5>
                            <div className="flex flex-col flex-grow justify-between gap-4">
                              <div className="flex flex-col gap-2">
                                {moduleName !== 'QuyDinh' && moduleName !== 'Xe' && options.map(opt => {
                                  const isChecked = formData.quyen_chi_tiet ? formData.quyen_chi_tiet.split(',').map(r => r.trim()).includes(opt.id) : false;
                                  return (
                                    <label key={opt.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${isChecked ? 'bg-orange-50 text-[#c2410c] font-bold' : 'hover:bg-gray-50 text-gray-600'}`}>
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => handleToggleAdvancedRule(opt.id)}
                                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                      />
                                      <span className="text-xs">{opt.label}</span>
                                    </label>
                                  );
                                })}

                                {moduleName === 'QuyDinh' && (
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 font-black">Cho phép xem Phân loại</label>
                                    <div className="h-48 overflow-y-auto p-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar flex flex-col gap-1">
                                      {['Quy định', 'Quy trình', 'Hướng dẫn', 'Quy chế', 'Quyết định', 'Thông báo', 'Thông báo BĐH', 'Tờ trình', 'Công văn đi', 'Công văn đến'].map(type => {
                                        const activeTypes = getTypesFromRule(formData.quyen_chi_tiet, 'QD_TYPES:');
                                        const isTypeChecked = activeTypes.includes(type);
                                        return (
                                          <label key={type} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${isTypeChecked ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                                            <input
                                              type="checkbox"
                                              checked={isTypeChecked}
                                              onChange={() => handleToggleTypeRule('QD_TYPES:', type)}
                                              className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                                            />
                                            <span>{type}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {moduleName === 'Xe' && (
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 font-black">Giới hạn xe xem được (Bỏ trống = Xem hết)</label>
                                    <input 
                                      type="text" 
                                      placeholder="Tìm biển số..." 
                                      value={carFilterTerm}
                                      onChange={e => setCarFilterTerm(e.target.value)}
                                      className="w-full p-2 text-xs border border-gray-200 rounded-lg mb-2 focus:ring-1 focus:ring-orange-500 outline-none"
                                    />
                                    <div className="h-64 overflow-y-auto p-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar flex flex-col gap-1">
                                      {carsOfSelectedUnit.filter(car => 
                                        !carFilterTerm || 
                                        String(car.bien_so || '').toLowerCase().includes(carFilterTerm.toLowerCase()) ||
                                        String(car.hieu_xe || '').toLowerCase().includes(carFilterTerm.toLowerCase()) ||
                                        String(car.loai_xe || '').toLowerCase().includes(carFilterTerm.toLowerCase())
                                      ).map(car => {
                                        const activePlates = getPlatesFromRule(formData.quyen_chi_tiet, 'XE_LIMIT:');
                                        const isPlateChecked = activePlates.includes(car.bien_so);
                                        return (
                                          <label key={car.id} className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${isPlateChecked ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={isPlateChecked}
                                                onChange={() => handleTogglePlateRule('XE_LIMIT:', car.bien_so)}
                                                className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                                              />
                                              <span className="font-bold">{car.bien_so}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-normal">
                                              {car.hieu_xe} {car.loai_xe}
                                            </span>
                                          </label>
                                        );
                                      })}
                                      {carsOfSelectedUnit.length === 0 && (
                                        <div className="text-center py-4 text-xs text-gray-400">Không có xe thuộc Đơn vị quản lý</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {(moduleName === 'VanBan' || moduleName === 'QuyDinh') && (
                                <div className="pt-3 border-t border-gray-100">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 font-black">Cho phép xem theo Năm</label>
                                  <div className="h-36 overflow-y-auto p-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar flex flex-col gap-1">
                                    {yearOptions.map(year => {
                                      const prefix = moduleName === 'VanBan' ? 'VB_YEARS:' : 'QD_YEARS:';
                                      const activeYears = getYearsFromRule(formData.quyen_chi_tiet, prefix);
                                      const isYearChecked = activeYears.includes(year);
                                      return (
                                        <label key={year} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${isYearChecked ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-bold' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                                          <input
                                            type="checkbox"
                                            checked={isYearChecked}
                                            onChange={() => handleToggleYearRule(prefix, year)}
                                            className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                                          />
                                          <span>Năm {year}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              </form>
            </div>

            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white text-gray-700 font-bold rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors shadow-sm">Hủy</button>
              <button type="submit" form="accountForm" disabled={submitting} className="px-8 py-2.5 bg-[#05469B] hover:bg-[#04367a] text-white font-bold rounded-lg flex items-center gap-2 shadow-md transition-colors">{submitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Lưu Tài Khoản</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl text-center shadow-xl max-w-sm w-full animate-in zoom-in">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle size={32}/></div>
            <h3 className="text-xl font-bold mb-2">Xóa tài khoản?</h3>
            <p className="text-gray-500 text-sm mb-6">Tài khoản này sẽ bị thu hồi quyền truy cập vĩnh viễn.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl">Hủy</button>
              <button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl">{submitting ? <Loader2 className="animate-spin mx-auto"/> : 'Xóa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}