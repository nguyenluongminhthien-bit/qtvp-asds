import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, UserCog, Shield, 
  Key, Building2, Mail, CheckSquare, ListChecks, Eye, EyeOff, ChevronDown, 
  Clock, ShieldCheck, RotateCcw, Zap, RefreshCw, Layers, Check, Calendar, 
  Car as CarIcon, ChevronRight, Filter, FileText 
} from 'lucide-react';
import { apiService } from '../services/api';
import { User, DonVi } from '../types';
import { buildHierarchicalOptions, getUnitEmoji, getAllSubordinateIds } from '../utils/hierarchy';
import { toast } from '../utils/toast';
import { stripAccents } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { RecycleBinModal } from '../components/ui';
import { 
  MODULE_MATRIX_CONFIG, 
  ModuleCrudState, 
  getAllModuleCrudMap, 
  updateModuleCrudInRules, 
  syncRulesToFormState 
} from '../constants/permissions';

export default function AccountPage() {
  const { user: currentUser, sessionDays, setSessionDays } = useAuth();
  const [data, setData] = useState<User[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [xeList, setXeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [carFilterTerm, setCarFilterTerm] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const startYear = 2010;
    const endYear = new Date().getFullYear() + 3; // e.g. 2029
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => String(endYear - i));
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update' | 'view'>('create');
  const [showPassword, setShowPassword] = useState(false);
  
  // Mở rộng formData để chứa quyen_truy_cap và quyen_chi_tiet
  const [formData, setFormData] = useState<Partial<User & { quyen_truy_cap?: string; quyen_chi_tiet?: string }>>({});

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    const itemId = String(item.id || '').trim();
    const myId = String(currentUser.id || '').trim();
    // Luôn được sửa tài khoản của chính mình
    if (itemId === myId) return true;

    // Nếu không phải Admin, TUYỆT ĐỐI không được sửa tài khoản người khác
    if (!isAdmin) return false;

    // Quản trị viên cấp cao nhất (HO Admin) được sửa tất cả tài khoản
    if (isHOAdmin) return true;

    // Admin cấp đơn vị: không được sửa tài khoản HO Admin
    const itemQuyen = String(item.quyen || '').toUpperCase();
    if (itemQuyen === 'ADMIN' && (!item.id_don_vi || item.id_don_vi === 'ALL')) {
      return false;
    }

    // Admin cấp đơn vị: chỉ được sửa tài khoản thuộc đơn vị phụ trách
    const itemDvs = String(item.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    return itemDvs.some(dv => subordinateDonViIds.includes(dv));
  }, [currentUser, isAdmin, isHOAdmin, subordinateDonViIds]);

  const canDeleteAccount = useCallback((item: any) => {
    if (!currentUser || !item) return false;
    const itemId = String(item.id || '').trim();
    const myId = String(currentUser.id || '').trim();
    if (itemId === myId) return false; // Không tự xóa chính mình
    if (!isAdmin) return false; // Người dùng thường không được xóa bất kỳ ai
    if (isHOAdmin) return true;

    // Admin cấp đơn vị: không được xóa tài khoản HO Admin
    const itemQuyen = String(item.quyen || '').toUpperCase();
    if (itemQuyen === 'ADMIN' && (!item.id_don_vi || item.id_don_vi === 'ALL')) {
      return false;
    }

    const itemDvs = String(item.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
    return itemDvs.some(dv => subordinateDonViIds.includes(dv));
  }, [currentUser, isAdmin, isHOAdmin, subordinateDonViIds]);

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

  const openModal = (mode: 'create' | 'update' | 'view', item?: any) => {
    if (item && mode === 'update' && !canEditAccount(item)) {
      mode = 'view';
    }
    setModalMode(mode);
    setShowPassword(false);
    setIsUnitDropdownOpen(false);
    setUnitSearchQuery('');
    setMatrixSearch('');
    setExpandedModuleId(null);
    const defaultDv = isHOAdmin ? '' : (subordinateDonViIds[0] || (myDonViIds[0] || ''));
    
    // Đồng bộ cờ can_delete_unit và can_lock_period từ quyen_chi_tiet nếu có
    const itemRules = item?.quyen_chi_tiet || '';
    const hasDelUnit = Boolean(item?.can_delete_unit) || itemRules.includes('CAN_DELETE_UNIT');
    const hasLockPeriod = Boolean(item?.can_lock_period) || itemRules.includes('CAN_LOCK_PERIOD');

    setFormData(item ? { 
      ...item,
      password: mode === 'view' ? '••••••••' : (item.password || ''),
      can_view: item.can_view !== undefined ? Boolean(item.can_view) : true,
      can_create: item.can_create !== undefined ? Boolean(item.can_create) : true,
      can_update: item.can_update !== undefined ? Boolean(item.can_update) : true,
      can_delete: Boolean(item.can_delete),
      can_delete_unit: hasDelUnit,
      can_lock_period: hasLockPeriod,
      quyen_truy_cap: item.quyen_truy_cap || '',
      quyen_chi_tiet: itemRules
    } : { 
      id: '', user_name: '', password: '', ho_ten: '', id_don_vi: defaultDv, 
      quyen: 'USER', quyen_truy_cap: 'ALL', quyen_chi_tiet: '',
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: false,
      can_delete_unit: false,
      can_lock_period: false
    });
    setIsModalOpen(true); setError(null);
  };

  // 🟢 BẢN ĐỒ CRUD HIỆN TẠI CỦA CÁC MODULE TRONG FORM
  const currentCrudMap = useMemo(() => {
    return getAllModuleCrudMap(
      formData.quyen_chi_tiet,
      formData.quyen_truy_cap,
      {
        can_view: formData.can_view,
        can_create: formData.can_create,
        can_update: formData.can_update,
        can_delete: formData.can_delete,
      }
    );
  }, [formData.quyen_chi_tiet, formData.quyen_truy_cap, formData.can_view, formData.can_create, formData.can_update, formData.can_delete]);

  // 🟢 LOGIC XỬ LÝ CLICK Ô CRUD (XEM / THÊM / SỬA / XÓA) TỪNG PHÂN HỆ
  const handleToggleModuleAction = (moduleId: string, action: 'v' | 'c' | 'u' | 'd') => {
    const currentState = currentCrudMap[moduleId] || { v: false, c: false, u: false, d: false };
    const nextState = { ...currentState };

    if (action === 'v') {
      const newV = !currentState.v;
      nextState.v = newV;
      // Nếu tắt Xem thì tự động tắt toàn bộ Thêm, Sửa, Xóa của phân hệ đó
      if (!newV) {
        nextState.c = false;
        nextState.u = false;
        nextState.d = false;
      }
    } else {
      const newActionVal = !currentState[action];
      nextState[action] = newActionVal;
      // Nếu bật Thêm, Sửa hoặc Xóa thì bắt buộc phải bật Xem
      if (newActionVal) {
        nextState.v = true;
      }
    }

    const nextCrudMap = { ...currentCrudMap, [moduleId]: nextState };
    const nextRules = updateModuleCrudInRules(formData.quyen_chi_tiet, moduleId, nextState);
    const syncState = syncRulesToFormState(nextCrudMap, nextRules);

    setFormData(prev => ({
      ...prev,
      ...syncState,
      quyen_chi_tiet: nextRules
    }));
  };

  // 🟢 LOGIC BẬT/TẮT XEM TOÀN BỘ PHÂN HỆ (ALL)
  const handleToggleAllView = (checked: boolean) => {
    const nextCrudMap: Record<string, ModuleCrudState> = {};
    let nextRules = formData.quyen_chi_tiet || '';

    MODULE_MATRIX_CONFIG.forEach(mod => {
      const prev = currentCrudMap[mod.id] || { v: false, c: false, u: false, d: false };
      const nextState: ModuleCrudState = {
        v: checked,
        c: checked ? prev.c : false,
        u: checked ? prev.u : false,
        d: checked ? prev.d : false,
      };
      nextCrudMap[mod.id] = nextState;
      nextRules = updateModuleCrudInRules(nextRules, mod.id, nextState);
    });

    const syncState = syncRulesToFormState(nextCrudMap, nextRules);
    setFormData(prev => ({
      ...prev,
      ...syncState,
      quyen_truy_cap: checked ? 'ALL' : '',
      quyen_chi_tiet: nextRules
    }));
  };

  // 🟢 THAO TÁC NHANH: CẤP TOÀN QUYỀN (FULL ACCESS)
  const handleGrantFullPermissions = () => {
    const nextCrudMap: Record<string, ModuleCrudState> = {};
    let nextRules = formData.quyen_chi_tiet || '';

    MODULE_MATRIX_CONFIG.forEach(mod => {
      const state: ModuleCrudState = {
        v: true,
        c: mod.hasCreate,
        u: mod.hasUpdate,
        d: mod.hasDelete,
      };
      nextCrudMap[mod.id] = state;
      nextRules = updateModuleCrudInRules(nextRules, mod.id, state);
    });

    const rulesList = nextRules.split(',').map(r => r.trim()).filter(Boolean);
    if (!rulesList.includes('CAN_DELETE_UNIT')) rulesList.push('CAN_DELETE_UNIT');
    if (!rulesList.includes('CAN_LOCK_PERIOD')) rulesList.push('CAN_LOCK_PERIOD');
    if (!rulesList.includes('CP_PIVOT_CLONE')) rulesList.push('CP_PIVOT_CLONE');
    if (!rulesList.includes('XE_STATS_PIVOT')) rulesList.push('XE_STATS_PIVOT');
    const finalRules = rulesList.join(',');

    setFormData(prev => ({
      ...prev,
      quyen_truy_cap: 'ALL',
      quyen_chi_tiet: finalRules,
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: true,
      can_delete_unit: true,
      can_lock_period: true,
    }));
    toast.success('⚡ Đã cấp Toàn quyền thao tác cho tất cả phân hệ!');
  };

  // 🟢 THAO TÁC NHANH: CHỈ XEM TẤT CẢ (READ-ONLY)
  const handleGrantReadOnly = () => {
    const nextCrudMap: Record<string, ModuleCrudState> = {};
    let nextRules = formData.quyen_chi_tiet || '';

    MODULE_MATRIX_CONFIG.forEach(mod => {
      const state: ModuleCrudState = { v: true, c: false, u: false, d: false };
      nextCrudMap[mod.id] = state;
      nextRules = updateModuleCrudInRules(nextRules, mod.id, state);
    });

    const rulesList = nextRules.split(',').map(r => r.trim()).filter(r => r !== 'CAN_DELETE_UNIT' && r !== 'CAN_LOCK_PERIOD');
    const finalRules = rulesList.join(',');

    setFormData(prev => ({
      ...prev,
      quyen_truy_cap: 'ALL',
      quyen_chi_tiet: finalRules,
      can_view: true,
      can_create: false,
      can_update: false,
      can_delete: false,
      can_delete_unit: false,
      can_lock_period: false,
    }));
    toast.success('👁️ Đã chuyển sang chế độ Chỉ Xem cho tất cả phân hệ!');
  };

  // 🟢 THAO TÁC NHANH: ĐẶT LẠI MẶC ĐỊNH THEO VAI TRÒ
  const handleResetDefaultByRole = () => {
    const role = String(formData.quyen || 'USER').toUpperCase();
    if (role === 'ADMIN') {
      handleGrantFullPermissions();
      return;
    }
    if (role === 'VIEWER_HANCHE' || role === 'VIEWER') {
      handleGrantReadOnly();
      return;
    }

    const nextCrudMap: Record<string, ModuleCrudState> = {};
    let nextRules = '';

    MODULE_MATRIX_CONFIG.forEach(mod => {
      const state: ModuleCrudState = {
        v: true,
        c: mod.hasCreate,
        u: mod.hasUpdate,
        d: false,
      };
      nextCrudMap[mod.id] = state;
      nextRules = updateModuleCrudInRules(nextRules, mod.id, state);
    });

    setFormData(prev => ({
      ...prev,
      quyen_truy_cap: 'ALL',
      quyen_chi_tiet: nextRules,
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: false,
      can_delete_unit: false,
      can_lock_period: false,
    }));
    toast.success('🔄 Đã đặt lại cấu hình mặc định chuẩn cho người dùng (USER)!');
  };

  // 🟢 BẬT / TẮT ĐẶC QUYỀN XÓA SHOWROOM (CHỐT AN TOÀN)
  const handleToggleSafetyUnitDelete = (checked: boolean) => {
    setFormData(prev => {
      let currentRules = prev.quyen_chi_tiet ? prev.quyen_chi_tiet.split(',').map(r => r.trim()).filter(Boolean) : [];
      if (checked) {
        if (!currentRules.includes('CAN_DELETE_UNIT')) currentRules.push('CAN_DELETE_UNIT');
      } else {
        currentRules = currentRules.filter(r => r !== 'CAN_DELETE_UNIT');
      }
      return {
        ...prev,
        can_delete_unit: checked,
        quyen_chi_tiet: currentRules.join(',')
      };
    });
  };

  // 🟢 BẬT / TẮT ĐẶC QUYỀN CHỐT KỲ CHI PHÍ
  const handleToggleSafetyLockPeriod = (checked: boolean) => {
    setFormData(prev => {
      let currentRules = prev.quyen_chi_tiet ? prev.quyen_chi_tiet.split(',').map(r => r.trim()).filter(Boolean) : [];
      if (checked) {
        if (!currentRules.includes('CAN_LOCK_PERIOD')) currentRules.push('CAN_LOCK_PERIOD');
      } else {
        currentRules = currentRules.filter(r => r !== 'CAN_LOCK_PERIOD');
      }
      return {
        ...prev,
        can_lock_period: checked,
        quyen_chi_tiet: currentRules.join(',')
      };
    });
  };

  // 🟢 LOGIC XỬ LÝ CLICK CHỌN ĐẶC QUYỀN RIÊNG LẺ
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
    e.preventDefault(); 
    if (modalMode === 'view' || (!isAdmin && String(formData.id) !== String(currentUser?.id))) {
      toast.error('Bạn không có quyền can thiệp vào tài khoản này!');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const finalData = { ...formData };
      if (finalData.id_don_vi === '') {
        finalData.id_don_vi = null; 
      }

      // Đồng bộ 2 chiều các cờ boolean với quyen_chi_tiet
      finalData.can_delete_unit = Boolean(finalData.can_delete_unit) || String(finalData.quyen_chi_tiet || '').includes('CAN_DELETE_UNIT');
      finalData.can_lock_period = Boolean(finalData.can_lock_period) || String(finalData.quyen_chi_tiet || '').includes('CAN_LOCK_PERIOD');
      finalData.can_view = finalData.can_view !== false;
      finalData.can_create = finalData.can_create !== false;
      finalData.can_update = finalData.can_update !== false;
      finalData.can_delete = Boolean(finalData.can_delete);

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Tìm tài khoản, họ tên..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          {isAdmin && (
            <>
              {/* Cài đặt thời hạn phiên đăng nhập */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold text-gray-700" title="Cấu hình số ngày tự động duy trì đăng nhập của phiên làm việc">
                <Clock size={16} className="text-[#05469B]" />
                <span className="hidden sm:inline">Hạn phiên:</span>
                <input 
                  type="number" 
                  min={1} 
                  max={365} 
                  value={sessionDays} 
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setSessionDays(val);
                    toast.success(`Đã đổi hạn phiên: ${val} ngày`);
                  }}
                  className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center font-bold text-[#05469B] focus:ring-1 focus:ring-[#05469B] outline-none"
                />
                <span>ngày</span>
              </div>

              {/* Nút mở Thùng rác phục hồi dữ liệu */}
              <button 
                onClick={() => setIsRecycleBinOpen(true)}
                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition-all"
                title="Xem các dữ liệu bị xóa & Khôi phục lại an toàn"
              >
                <RotateCcw size={16} className="text-amber-700" />
                <span className="hidden sm:inline">Thùng rác & Phục hồi</span>
              </button>

              {/* Nút Cấp tài khoản */}
              <button onClick={() => openModal('create')} className="flex items-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">
                <Plus size={18} /> Cấp tài khoản
              </button>
            </>
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
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border tracking-wider uppercase
                        ${String(user.quyen).toUpperCase() === 'ADMIN' ? 'bg-red-50 text-red-600 border-red-200' : 
                          String(user.quyen).toLowerCase() === 'viewer_hanche' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                          'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                        {String(user.quyen).toLowerCase() === 'viewer_hanche' ? 'VIEWER' : user.quyen}
                      </span>
                      {String(user.quyen).toUpperCase() === 'ADMIN' ? (
                        <span className="text-[10px] text-gray-500 font-medium italic">Toàn quyền hệ thống</span>
                      ) : (() => {
                        const crudMap = getAllModuleCrudMap(user.quyen_chi_tiet, user.quyen_truy_cap, {
                          can_view: user.can_view,
                          can_create: user.can_create,
                          can_update: user.can_update,
                          can_delete: user.can_delete,
                        });
                        const activeMods = MODULE_MATRIX_CONFIG.filter(m => crudMap[m.id]?.v);
                        const rules = (user.quyen_chi_tiet || '').split(',').map(r => r.trim());
                        const canDeleteUnit = rules.includes('CAN_DELETE_UNIT') || Boolean(user.can_delete_unit);
                        const canLockPeriod = rules.includes('CAN_LOCK_PERIOD') || Boolean(user.can_lock_period);
                        const canViewXePivot = rules.includes('XE_STATS_PIVOT');

                        return (
                          <div className="flex flex-col gap-1 mt-0.5 max-w-[280px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                user.quyen_truy_cap === 'ALL'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {user.quyen_truy_cap === 'ALL' ? '🌐 12/12 Phân hệ' : `📂 ${activeMods.length}/12 Phân hệ`}
                              </span>
                              {canDeleteUnit && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-black border bg-red-100 text-red-800 border-red-300" title="Chốt an toàn: Được quyền xóa Showroom / Đơn vị">
                                  ⚠️ Xóa ĐV
                                </span>
                              )}
                              {canLockPeriod && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-black border bg-purple-100 text-purple-800 border-purple-300" title="Đặc quyền: Được chốt kỳ chi phí">
                                  🔒 Chốt kỳ
                                </span>
                              )}
                              {canViewXePivot && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-black border bg-teal-100 text-teal-800 border-teal-300" title="Đặc quyền: Được xem Tab Thống kê (con) xe">
                                  📊 TK Xe
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {activeMods.slice(0, 4).map(m => {
                                const c = crudMap[m.id];
                                const actions = [c.v && 'V', c.c && 'C', c.u && 'U', c.d && 'D'].filter(Boolean).join('');
                                return (
                                  <span
                                    key={m.id}
                                    className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 font-medium"
                                    title={`${m.label}: ${[c.v && 'Xem', c.c && 'Thêm', c.u && 'Sửa', c.d && 'Xóa'].filter(Boolean).join(' • ')}`}
                                  >
                                    <span>{m.icon}</span>
                                    <span className="font-mono font-bold text-gray-600">{actions}</span>
                                  </span>
                                );
                              })}
                              {activeMods.length > 4 && (
                                <span className="text-[9px] text-gray-400 font-medium self-center">
                                  +{activeMods.length - 4} khác
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {canEditAccount(user) ? (
                        <button 
                          onClick={() => openModal('update', user)} 
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" 
                          title={isAdmin ? "Sửa thông tin / Đổi mật khẩu" : "Đổi mật khẩu & Thông tin của tôi"}
                        >
                          <Edit size={16}/>
                        </button>
                      ) : (
                        <button 
                          onClick={() => openModal('view', user)} 
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" 
                          title="Xem thông tin tài khoản (Chỉ xem)"
                        >
                          <Eye size={16}/>
                        </button>
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
          {/* 🟢 MỞ RỘNG MODAL THÀNH max-w-5xl ĐỂ CHỨA MA TRẬN PHÂN QUYỀN HỢP NHẤT */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[95vh]">
            <div className="flex justify-between items-center p-5 border-b bg-[#05469B] text-white shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <UserCog size={24}/> 
                {modalMode === 'create' 
                  ? 'Cấp tài khoản mới' 
                  : modalMode === 'view' 
                    ? 'Xem thông tin tài khoản (Chỉ xem)' 
                    : isAdmin 
                      ? 'Cập nhật tài khoản' 
                      : 'Đổi mật khẩu & Thông tin tài khoản'}
              </h3>
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
                        disabled={modalMode==='update' || modalMode==='view' || !isAdmin} 
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
                        disabled={modalMode==='view' || (!isAdmin && String(formData.id) !== String(currentUser?.id))} 
                        className="w-full h-[40px] px-3.5 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-medium disabled:opacity-70"
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
                          disabled={modalMode==='view' || !isAdmin} 
                          className="w-full h-[40px] pl-10 pr-3.5 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-medium disabled:opacity-70"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Mật khẩu *</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17}/>
                        <input 
                          type={modalMode === 'view' ? "password" : (showPassword ? "text" : "password")} 
                          required={modalMode !== 'view'}
                          name="password" 
                          value={modalMode === 'view' ? '••••••••' : (formData.password || '')} 
                          onChange={e=>setFormData({...formData, password: e.target.value})} 
                          disabled={modalMode === 'view'}
                          className="w-full h-[40px] pl-10 pr-10 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-mono tracking-widest text-indigo-700 font-bold disabled:opacity-70"
                        />
                        {modalMode !== 'view' && (
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-1"
                          >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        )}
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
                          disabled={modalMode === 'view' || !isAdmin}
                          onClick={() => {
                            if (modalMode === 'view' || !isAdmin) return;
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
                          disabled={modalMode === 'view' || !isAdmin}
                          className="w-full h-[40px] pl-10 pr-3 text-sm border border-gray-200 rounded-lg bg-[#FFFFF0] disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-[#05469B] font-bold disabled:opacity-70"
                        >
                          <option value="USER">USER (Được quyền Thêm/Sửa/Xóa của mình)</option>
                          <option value="viewer_hanche">VIEWER (Chỉ xem, cấm click chi tiết)</option>
                          {isAdmin && <option value="ADMIN">ADMIN (Quản trị toàn quyền)</option>}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HIỂN THỊ PHẦN 2 MA TRẬN PHÂN QUYỀN CHỈ KHI LÀ ADMIN VÀ KHÔNG PHẢI CHẾ ĐỘ VIEW */}
                {isAdmin && modalMode !== 'view' && (
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                    {/* Header & Quick Action Buttons */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <h4 className="font-extrabold text-[#05469B] text-base flex items-center gap-2">
                          <ShieldCheck size={20} className="text-[#05469B]" /> 
                          2. Ma trận Phân quyền Thao tác theo Phân hệ
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Tích hợp Xem, Thêm, Sửa, Xóa và Đặc quyền chuyên sâu trực tiếp vào từng Phân hệ
                        </p>
                      </div>

                      {/* Các nút thao tác nhanh (Quick Actions) */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGrantFullPermissions}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          title="Cấp toàn quyền Xem, Thêm, Sửa, Xóa và đặc quyền cho mọi phân hệ"
                        >
                          <Zap size={13} className="text-emerald-600" />
                          <span>⚡ Cấp Toàn quyền</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleGrantReadOnly}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          title="Chỉ bật quyền Xem, tắt quyền Thêm, Sửa, Xóa"
                        >
                          <Eye size={13} className="text-blue-600" />
                          <span>👁️ Chỉ Xem Tất cả</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResetDefaultByRole}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          title="Đặt lại cấu hình mặc định chuẩn theo vai trò"
                        >
                          <RefreshCw size={13} className="text-gray-500" />
                          <span>🔄 Mặc định</span>
                        </button>
                      </div>
                    </div>

                    {/* Thanh lọc phân hệ & Checkbox Toàn quyền Xem (ALL) */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.quyen_truy_cap === 'ALL'}
                          onChange={e => handleToggleAllView(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                          <span>🌐</span> Cấp quyền Xem Toàn bộ Phân hệ (ALL Modules)
                        </span>
                      </label>

                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          placeholder="Lọc phân hệ..."
                          value={matrixSearch}
                          onChange={e => setMatrixSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#05469B]"
                        />
                      </div>
                    </div>

                    {/* Bảng Ma trận Phân quyền */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
                      <div className="max-h-[500px] overflow-auto custom-scrollbar relative">
                        <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20 shadow-xs">
                          <tr className="bg-[#f1f5f9] text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                            <th className="p-3 w-64 bg-[#f1f5f9] sticky top-0 z-20 border-b border-gray-200">Phân hệ Nghiệp vụ</th>
                            <th className="p-3 text-center w-16 text-[#05469B] bg-[#f1f5f9] sticky top-0 z-20 border-b border-gray-200">Xem</th>
                            <th className="p-3 text-center w-16 text-emerald-700 bg-[#f1f5f9] sticky top-0 z-20 border-b border-gray-200">Thêm</th>
                            <th className="p-3 text-center w-16 text-amber-700 bg-[#f1f5f9] sticky top-0 z-20 border-b border-gray-200">Sửa</th>
                            <th className="p-3 text-center w-16 text-rose-700 bg-[#f1f5f9] sticky top-0 z-20 border-b border-gray-200">Xóa</th>
                            <th className="p-3 bg-[#f1f5f9] sticky top-0 z-20 border-b border-gray-200">Đặc quyền Nghiệp vụ Tích hợp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                            {MODULE_MATRIX_CONFIG
                              .filter(mod => {
                                if (!matrixSearch.trim()) return true;
                                const q = stripAccents(matrixSearch.toLowerCase().trim());
                                return (
                                  stripAccents(mod.label.toLowerCase()).includes(q) ||
                                  stripAccents(mod.description.toLowerCase()).includes(q) ||
                                  mod.id.toLowerCase().includes(q)
                                );
                              })
                              .map(mod => {
                                const crud = currentCrudMap[mod.id] || { v: false, c: false, u: false, d: false };
                                const isAllView = formData.quyen_truy_cap === 'ALL';
                                const isViewChecked = isAllView || crud.v;

                                return (
                                  <tr 
                                    key={mod.id} 
                                    className={`transition-colors ${isViewChecked ? 'bg-white hover:bg-slate-50/60' : 'bg-gray-50/40 opacity-70 hover:opacity-100'}`}
                                  >
                                    {/* Cột 1: Tên phân hệ */}
                                    <td className="p-3 border-b border-gray-100">
                                      <div className="flex items-start gap-2.5">
                                        <span className="text-xl shrink-0 select-none mt-0.5">{mod.icon}</span>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-gray-800 text-xs sm:text-sm">{mod.label}</span>
                                            {isViewChecked && (
                                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-blue-50 text-[#05469B] border border-blue-200">
                                                Mở
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{mod.description}</p>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Cột 2: Xem (View) */}
                                    <td className="p-3 text-center border-b border-gray-100">
                                      <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded hover:bg-blue-50">
                                        <input
                                          type="checkbox"
                                          checked={isViewChecked}
                                          onChange={() => handleToggleModuleAction(mod.id, 'v')}
                                          className="w-4 h-4 text-[#05469B] rounded focus:ring-[#05469B] cursor-pointer"
                                        />
                                      </label>
                                    </td>

                                    {/* Cột 3: Thêm (Create) */}
                                    <td className="p-3 text-center border-b border-gray-100">
                                      {mod.hasCreate ? (
                                        <label className={`inline-flex items-center justify-center p-1 rounded ${!isViewChecked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-emerald-50'}`}>
                                          <input
                                            type="checkbox"
                                            disabled={!isViewChecked}
                                            checked={isViewChecked && crud.c}
                                            onChange={() => handleToggleModuleAction(mod.id, 'c')}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                          />
                                        </label>
                                      ) : (
                                        <span className="text-gray-300 font-bold select-none">-</span>
                                      )}
                                    </td>

                                    {/* Cột 4: Sửa (Update) */}
                                    <td className="p-3 text-center border-b border-gray-100">
                                      {mod.hasUpdate ? (
                                        <label className={`inline-flex items-center justify-center p-1 rounded ${!isViewChecked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-amber-50'}`}>
                                          <input
                                            type="checkbox"
                                            disabled={!isViewChecked}
                                            checked={isViewChecked && crud.u}
                                            onChange={() => handleToggleModuleAction(mod.id, 'u')}
                                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                                          />
                                        </label>
                                      ) : (
                                        <span className="text-gray-300 font-bold select-none">-</span>
                                      )}
                                    </td>

                                    {/* Cột 5: Xóa (Delete) */}
                                    <td className="p-3 text-center border-b border-gray-100">
                                      {mod.hasDelete ? (
                                        <label className={`inline-flex items-center justify-center p-1 rounded ${!isViewChecked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-rose-50'}`}>
                                          <input
                                            type="checkbox"
                                            disabled={!isViewChecked}
                                            checked={isViewChecked && crud.d}
                                            onChange={() => handleToggleModuleAction(mod.id, 'd')}
                                            className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer disabled:cursor-not-allowed"
                                          />
                                        </label>
                                      ) : (
                                        <span className="text-gray-300 font-bold select-none">-</span>
                                      )}
                                    </td>

                                    {/* Cột 6: Đặc quyền Nghiệp vụ Tích hợp */}
                                    <td className="p-3 border-b border-gray-100">
                                      {/* 1. THÔNG TIN CÔNG TY */}
                                      {mod.id === 'CongTy' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${formData.can_delete_unit ? 'bg-red-50 border-red-300 text-red-700 shadow-2xs' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                            <input
                                              type="checkbox"
                                              checked={Boolean(formData.can_delete_unit)}
                                              onChange={e => handleToggleSafetyUnitDelete(e.target.checked)}
                                              className="w-3.5 h-3.5 text-red-600 rounded focus:ring-red-500"
                                            />
                                            <span>⚠️ Cho phép Xóa Showroom / Phòng ban</span>
                                          </label>
                                        </div>
                                      )}

                                      {/* 2. THÔNG TIN NHÂN SỰ */}
                                      {mod.id === 'NhanSu' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <label className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all cursor-pointer ${String(formData.quyen_chi_tiet || '').includes('NS_HIDE_SENSITIVE') ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                            <input
                                              type="checkbox"
                                              checked={String(formData.quyen_chi_tiet || '').includes('NS_HIDE_SENSITIVE')}
                                              onChange={() => handleToggleAdvancedRule('NS_HIDE_SENSITIVE')}
                                              className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                                            />
                                            <span>Ẩn SĐT, Lương, Ngạch</span>
                                          </label>
                                          <label className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all cursor-pointer ${String(formData.quyen_chi_tiet || '').includes('NS_NO_DETAIL') ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                            <input
                                              type="checkbox"
                                              checked={String(formData.quyen_chi_tiet || '').includes('NS_NO_DETAIL')}
                                              onChange={() => handleToggleAdvancedRule('NS_NO_DETAIL')}
                                              className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                                            />
                                            <span>Cấm xem Chi tiết Hồ sơ</span>
                                          </label>
                                        </div>
                                      )}

                                      {/* 3. THÔNG TIN XE */}
                                      {mod.id === 'Xe' && (() => {
                                        const activePlates = getPlatesFromRule(formData.quyen_chi_tiet, 'XE_LIMIT:');
                                        const isExpanded = expandedModuleId === 'Xe';
                                        const canViewXePivot = String(formData.quyen_chi_tiet || '').includes('XE_STATS_PIVOT');
                                        return (
                                          <div className="flex flex-wrap items-center gap-2">
                                            <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${canViewXePivot ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-2xs' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                              <input
                                                type="checkbox"
                                                checked={canViewXePivot}
                                                onChange={() => handleToggleAdvancedRule('XE_STATS_PIVOT')}
                                                className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500"
                                              />
                                              <span>📊 Tab Thống kê (con)</span>
                                            </label>

                                            <div className="relative">
                                              <button
                                                type="button"
                                                onClick={() => setExpandedModuleId(isExpanded ? null : 'Xe')}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${activePlates.length > 0 ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}
                                              >
                                              <CarIcon size={13} />
                                              <span>{activePlates.length > 0 ? `Giới hạn: ${activePlates.length} xe xem được` : '🔍 Giới hạn Biển số xe (Tất cả xe)'}</span>
                                              <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            
                                            {isExpanded && (
                                              <div className="absolute left-0 top-full mt-1.5 w-80 p-3 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 space-y-2">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                                  <span className="text-[11px] font-bold text-gray-600 uppercase">Chọn xe được phép xem:</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => setExpandedModuleId(null)}
                                                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                                                  >
                                                    <X size={14} />
                                                  </button>
                                                </div>
                                                <input
                                                  type="text"
                                                  placeholder="Tìm biển số hoặc hiệu xe..."
                                                  value={carFilterTerm}
                                                  onChange={e => setCarFilterTerm(e.target.value)}
                                                  className="w-full px-2.5 py-1 text-xs border border-gray-200 rounded-lg mb-1 focus:ring-1 focus:ring-orange-500 outline-none"
                                                  autoFocus
                                                />
                                                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                                  {carsOfSelectedUnit.filter(car => 
                                                    !carFilterTerm || 
                                                    String(car.bien_so || '').toLowerCase().includes(carFilterTerm.toLowerCase()) ||
                                                    String(car.hieu_xe || '').toLowerCase().includes(carFilterTerm.toLowerCase())
                                                  ).map(car => {
                                                    const isPlateChecked = activePlates.includes(car.bien_so);
                                                    return (
                                                      <label key={car.id} className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs transition-colors ${isPlateChecked ? 'bg-orange-50 text-orange-800 font-bold' : 'hover:bg-gray-50 text-gray-700'}`}>
                                                        <div className="flex items-center gap-1.5">
                                                          <input
                                                            type="checkbox"
                                                            checked={isPlateChecked}
                                                            onChange={() => handleTogglePlateRule('XE_LIMIT:', car.bien_so)}
                                                            className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                                                          />
                                                          <span>{car.bien_so}</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400">{car.hieu_xe}</span>
                                                      </label>
                                                    );
                                                  })}
                                                  {carsOfSelectedUnit.length === 0 && (
                                                    <p className="text-center text-xs text-gray-400 py-3">Không có xe thuộc Đơn vị</p>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                      {/* 4. THIẾT BỊ VP */}
                                      {mod.id === 'ThietBi' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${String(formData.quyen_chi_tiet || '').includes('TB_HIDE_PRICE') ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                            <input
                                              type="checkbox"
                                              checked={String(formData.quyen_chi_tiet || '').includes('TB_HIDE_PRICE')}
                                              onChange={() => handleToggleAdvancedRule('TB_HIDE_PRICE')}
                                              className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                                            />
                                            <span>Ẩn cột Nguyên giá tài sản</span>
                                          </label>
                                        </div>
                                      )}

                                      {/* 5. QUẢN LÝ CHI PHÍ */}
                                      {mod.id === 'ChiPhi' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${formData.can_lock_period ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-2xs' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                            <input
                                              type="checkbox"
                                              checked={Boolean(formData.can_lock_period)}
                                              onChange={e => handleToggleSafetyLockPeriod(e.target.checked)}
                                              className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500"
                                            />
                                            <span>🔒 Cho phép Chốt kỳ Chi phí (DNTT)</span>
                                          </label>
                                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${String(formData.quyen_chi_tiet || '').includes('CP_PIVOT_CLONE') ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-2xs' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                            <input
                                              type="checkbox"
                                              checked={String(formData.quyen_chi_tiet || '').includes('CP_PIVOT_CLONE')}
                                              onChange={() => handleToggleAdvancedRule('CP_PIVOT_CLONE')}
                                              className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500"
                                            />
                                            <span>📊 Báo cáo tuỳ chỉnh (Pivot)</span>
                                          </label>
                                        </div>
                                      )}

                                      {/* 6. VĂN BẢN - THÔNG BÁO */}
                                      {mod.id === 'VanBan' && (() => {
                                        const isExpanded = expandedModuleId === 'VanBan';
                                        const vbYears = getYearsFromRule(formData.quyen_chi_tiet, 'VB_YEARS:');
                                        const vbRulesCount = (formData.quyen_chi_tiet || '').split(',').filter(r => r.startsWith('VB_')).length;
                                        return (
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setExpandedModuleId(isExpanded ? null : 'VanBan')}
                                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${vbRulesCount > 0 ? 'bg-blue-50 border-blue-300 text-[#05469B] font-bold' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}
                                            >
                                              <FileText size={13} />
                                              <span>Phân loại & Năm văn bản {vbRulesCount > 0 ? `(${vbRulesCount})` : ''}</span>
                                              <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isExpanded && (
                                              <div className="absolute left-0 top-full mt-1.5 w-80 p-3 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 space-y-3">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                                  <span className="text-[11px] font-bold text-gray-700 uppercase">Quyền xem Văn bản:</span>
                                                  <button type="button" onClick={() => setExpandedModuleId(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14}/></button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                                                  {[
                                                    { id: 'VB_VIEW_QD', label: 'Quyết định' },
                                                    { id: 'VB_VIEW_TB', label: 'Thông báo' },
                                                    { id: 'VB_VIEW_TB_BDH', label: 'TB Ban ĐH' },
                                                    { id: 'VB_VIEW_TT', label: 'Tờ trình' },
                                                    { id: 'VB_VIEW_CV_DI', label: 'Công văn đi' },
                                                    { id: 'VB_VIEW_CV_DEN', label: 'Công văn đến' },
                                                    { id: 'VB_HIDE_BTN', label: 'Ẩn nút Ban hành' },
                                                  ].map(opt => {
                                                    const isChecked = String(formData.quyen_chi_tiet || '').split(',').map(r => r.trim()).includes(opt.id);
                                                    return (
                                                      <label key={opt.id} className={`flex items-center gap-1.5 p-1 rounded text-xs cursor-pointer ${isChecked ? 'bg-blue-50 text-[#05469B] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                                        <input
                                                          type="checkbox"
                                                          checked={isChecked}
                                                          onChange={() => handleToggleAdvancedRule(opt.id)}
                                                          className="w-3.5 h-3.5 text-[#05469B] rounded focus:ring-[#05469B]"
                                                        />
                                                        <span className="truncate">{opt.label}</span>
                                                      </label>
                                                    );
                                                  })}
                                                </div>
                                                <div className="pt-2 border-t border-gray-100">
                                                  <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cho phép xem theo Năm:</span>
                                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                                                    {yearOptions.map(y => {
                                                      const isYearChecked = vbYears.includes(y);
                                                      return (
                                                        <button
                                                          type="button"
                                                          key={y}
                                                          onClick={() => handleToggleYearRule('VB_YEARS:', y)}
                                                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${isYearChecked ? 'bg-[#05469B] text-white border-[#05469B]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                                        >
                                                          {y}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {/* 7. QUY ĐỊNH - QUY TRÌNH */}
                                      {mod.id === 'QuyDinh' && (() => {
                                        const isExpanded = expandedModuleId === 'QuyDinh';
                                        const qdYears = getYearsFromRule(formData.quyen_chi_tiet, 'QD_YEARS:');
                                        const activeTypes = getTypesFromRule(formData.quyen_chi_tiet, 'QD_TYPES:');
                                        const totalActive = activeTypes.length + qdYears.length;
                                        return (
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setExpandedModuleId(isExpanded ? null : 'QuyDinh')}
                                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${totalActive > 0 ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-white'}`}
                                            >
                                              <FileText size={13} />
                                              <span>Phân loại & Năm {totalActive > 0 ? `(${totalActive})` : ''}</span>
                                              <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isExpanded && (
                                              <div className="absolute left-0 top-full mt-1.5 w-80 p-3 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 space-y-3">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                                  <span className="text-[11px] font-bold text-gray-700 uppercase">Phân loại tài liệu xem được:</span>
                                                  <button type="button" onClick={() => setExpandedModuleId(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14}/></button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                                                  {['Quy định', 'Quy trình', 'Hướng dẫn', 'Quy chế', 'Quyết định', 'Thông báo', 'Thông báo BĐH', 'Tờ trình', 'Công văn đi', 'Công văn đến'].map(type => {
                                                    const isTypeChecked = activeTypes.includes(type);
                                                    return (
                                                      <label key={type} className={`flex items-center gap-1.5 p-1 rounded text-xs cursor-pointer ${isTypeChecked ? 'bg-orange-50 text-orange-800 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                                        <input
                                                          type="checkbox"
                                                          checked={isTypeChecked}
                                                          onChange={() => handleToggleTypeRule('QD_TYPES:', type)}
                                                          className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                                                        />
                                                        <span className="truncate">{type}</span>
                                                      </label>
                                                    );
                                                  })}
                                                </div>
                                                <div className="pt-2 border-t border-gray-100">
                                                  <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cho phép xem theo Năm:</span>
                                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                                                    {yearOptions.map(y => {
                                                      const isYearChecked = qdYears.includes(y);
                                                      return (
                                                        <button
                                                          type="button"
                                                          key={y}
                                                          onClick={() => handleToggleYearRule('QD_YEARS:', y)}
                                                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${isYearChecked ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                                        >
                                                          {y}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {/* CÁC PHÂN HỆ CÒN LẠI (PCCC, ATVSLD, Nhà cung cấp, Báo cáo, Tổng quan) */}
                                      {!['CongTy', 'NhanSu', 'Xe', 'ThietBi', 'ChiPhi', 'VanBan', 'QuyDinh'].includes(mod.id) && (
                                        <span className="text-[11px] text-gray-400 italic">
                                          Theo phân quyền CRUD bên trái
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </form>
            </div>

            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2.5 bg-white text-gray-700 font-bold rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors shadow-sm"
              >
                {modalMode === 'view' ? 'Đóng' : 'Hủy'}
              </button>
              {modalMode !== 'view' && (
                <button 
                  type="submit" 
                  form="accountForm" 
                  disabled={submitting} 
                  className="px-8 py-2.5 bg-[#05469B] hover:bg-[#04367a] text-white font-bold rounded-lg flex items-center gap-2 shadow-md transition-colors"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Lưu Tài Khoản
                </button>
              )}
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

      {/* MODAL THÙNG RÁC VÀ PHỤC HỒI DỮ LIỆU */}
      <RecycleBinModal 
        isOpen={isRecycleBinOpen} 
        onClose={() => setIsRecycleBinOpen(false)} 
        onRestored={loadData}
      />
    </div>
  );
}