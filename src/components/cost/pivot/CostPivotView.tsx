import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {

  ChiPhiPivotConfig, PivotLayoutConfig, ChiPhiThongKe, ChiPhiChotKy,
  DNTT, DnttPhanBo, DmKmp, DonVi, DmNhomChiPhi, DmBoPhan
} from '../../../types';
import { apiService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { getAllSubordinateIds } from '../../../utils/hierarchy';
import { toast } from '../../../utils/toast';
import PivotConfigBar from './PivotConfigBar';
import CostPivotBuilder from './CostPivotBuilder';
import CostMatrixView from '../CostMatrixView';
import {
  buildPivotFlatRecords, computePivotMatrix,
  PIVOT_AVAILABLE_FIELDS, PivotFlatRecord
} from './pivotEngine';
import { exportGenericPivotExcel } from './exportGenericPivotExcel';
import { exportThacoMultiSheetExcel } from '../../../utils/exportThacoCostReport';

const DEFAULT_LAYOUT: PivotLayoutConfig = {
  rows: ['nhom_chi_phi', 'kmp'],
  cols: ['thang'],
  vals: [{ field: 'so_tien', agg: 'sum', label: 'Chi phí sau thuế' }],
  filters: {}
};

const FALLBACK_DEFAULT_CONFIG: ChiPhiPivotConfig = {
  id: 'PVC_DEFAULT_CPHC',
  ten_cau_hinh: 'Báo cáo Chi phí',
  mo_ta: 'Mẫu ma trận Báo cáo Quản trị Chi phí Hành chính hiển thị đa chiều theo các tháng',
  loai_renderer: 'matrix_thaco',
  khoa: true,
  la_mac_dinh: true,
  thu_tu: 1,
  tao_boi: 'Hệ thống',
  id_don_vi: null,
  cau_hinh: DEFAULT_LAYOUT,
  layout: DEFAULT_LAYOUT
};

export interface CostPivotViewProps {
  year: number;
  onYearChange?: (year: number) => void;
  thongKeList: ChiPhiThongKe[];
  chotKyList: ChiPhiChotKy[];
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  nhomChiPhiList?: DmNhomChiPhi[];
  donViList: DonVi[];
  fullDonViList?: DonVi[];
  boPhanList?: DmBoPhan[];
  selectedUnitFilter: string | null;
  userPermittedUnitIds?: Set<string> | null;
  includeTemporary: boolean;
  onToggleIncludeTemporary: (val: boolean) => void;
  onlyAdministrative: boolean;
  onToggleOnlyAdministrative: (val: boolean) => void;
  onOpenChotKyModal?: () => void;
}

export default function CostPivotView({
  year,
  onYearChange,
  thongKeList,
  chotKyList,
  dnttList,
  phanBoList,
  kmpList,
  nhomChiPhiList = [],
  donViList,
  fullDonViList,
  boPhanList = [],
  selectedUnitFilter,
  userPermittedUnitIds,
  includeTemporary,
  onToggleIncludeTemporary,
  onlyAdministrative,
  onToggleOnlyAdministrative,
  onOpenChotKyModal
}: CostPivotViewProps) {
  const { user } = useAuth();

  // Danh sách cấu hình báo cáo
  const [configs, setConfigs] = useState<ChiPhiPivotConfig[]>([FALLBACK_DEFAULT_CONFIG]);
  const [activeConfigId, setActiveConfigId] = useState<string>('PVC_DEFAULT_CPHC');
  const [loadingConfigs, setLoadingConfigs] = useState<boolean>(true);

  // Khóa lưu trữ cục bộ độc lập theo User / Đơn vị (ngăn chặn lộ cấu hình giữa các tài khoản dùng chung máy tính)
  const storageKey = useMemo(() => {
    const uid = user?.id || user?.username || (user?.id_don_vi ? String(user.id_don_vi).split(',')[0].trim() : 'GLOBAL');
    return `CHI_PHI_PIVOT_SAVED_CONFIGS_${uid}`;
  }, [user?.id, user?.username, user?.id_don_vi]);

  // Nạp danh sách cấu hình từ Supabase + LocalStorage (kết hợp đồng bộ)
  const loadConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      let serverConfigs: ChiPhiPivotConfig[] = [];
      if (apiService.getChiPhiPivotConfig) {
        serverConfigs = await apiService.getChiPhiPivotConfig(true);
      }

      // Đọc các cấu hình đã lưu ở LocalStorage theo user/đơn vị
      let localCustomConfigs: ChiPhiPivotConfig[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          localCustomConfigs = JSON.parse(raw);
        }
      } catch (e) {
        console.error('Lỗi đọc local configs', e);
      }

      const sanitizeName = (name: string) => {
        return (name || '').replace(/\s*\(Mặc định\)/gi, '').trim();
      };

      const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;

      // Hợp nhất cấu hình: Server + Local (ưu tiên server, loại trừ trùng ID)
      const mergedMap = new Map<string, ChiPhiPivotConfig>();
      // Đảm bảo cấu hình mặc định luôn có mặt đầu tiên
      mergedMap.set(FALLBACK_DEFAULT_CONFIG.id, FALLBACK_DEFAULT_CONFIG);

      serverConfigs.forEach(c => {
        const foundUnit = allUnits.find(d => String(d.id) === String(c.id_don_vi));
        mergedMap.set(c.id, {
          ...c,
          ten_cau_hinh: c.id === 'PVC_DEFAULT_CPHC' ? 'Báo cáo Chi phí' : sanitizeName(c.ten_cau_hinh),
          ten_don_vi: c.ten_don_vi || foundUnit?.ten_don_vi || '',
          layout: c.layout || c.cau_hinh || DEFAULT_LAYOUT,
          cau_hinh: c.cau_hinh || c.layout || DEFAULT_LAYOUT
        });
      });

      localCustomConfigs.forEach(c => {
        if (!mergedMap.has(c.id)) {
          const foundUnit = allUnits.find(d => String(d.id) === String(c.id_don_vi));
          mergedMap.set(c.id, {
            ...c,
            ten_cau_hinh: c.id === 'PVC_DEFAULT_CPHC' ? 'Báo cáo Chi phí' : sanitizeName(c.ten_cau_hinh),
            ten_don_vi: c.ten_don_vi || foundUnit?.ten_don_vi || '',
            layout: c.layout || c.cau_hinh || DEFAULT_LAYOUT,
            cau_hinh: c.cau_hinh || c.layout || DEFAULT_LAYOUT
          });
        }
      });

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        if (a.la_mac_dinh) return -1;
        if (b.la_mac_dinh) return 1;
        return (a.thu_tu || 99) - (b.thu_tu || 99);
      });

      setConfigs(mergedList);

      // Nếu activeConfigId hiện tại không tồn tại trong danh sách, chọn cấu hình mặc định
      if (!mergedList.some(c => c.id === activeConfigId)) {
        const defaultCfg = mergedList.find(c => c.la_mac_dinh) || mergedList[0];
        if (defaultCfg) setActiveConfigId(defaultCfg.id);
      }
    } catch (err) {
      console.error('Lỗi nạp cấu hình Pivot:', err);
      setConfigs([FALLBACK_DEFAULT_CONFIG]);
    } finally {
      setLoadingConfigs(false);
    }
  }, [activeConfigId, storageKey, fullDonViList, donViList]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Lưu danh sách custom configs vào LocalStorage theo user/đơn vị
  const persistLocalConfigs = (updatedConfigs: ChiPhiPivotConfig[]) => {
    const customOnly = updatedConfigs.filter(c => c.id !== FALLBACK_DEFAULT_CONFIG.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(customOnly));
    } catch (e) {
      console.error('Lỗi ghi local configs', e);
    }
  };

  // Lọc danh sách cấu hình theo phân quyền tài khoản & Đơn vị đang chọn trên thanh bộ lọc
  const filteredConfigs = useMemo(() => {
    const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;

    return configs.filter(c => {
      // 1. Cấu hình mặc định hệ thống: luôn luôn cho phép tất cả mọi người xem
      if (c.la_mac_dinh || c.id === FALLBACK_DEFAULT_CONFIG.id || !c.id_don_vi) {
        return true;
      }

      const cfgUnitId = String(c.id_don_vi).trim();

      // 2. Tài khoản Admin / Toàn quyền (userPermittedUnitIds === null):
      if (!userPermittedUnitIds) {
        // Nếu Admin chọn lọc một Đơn vị cụ thể trên thanh bộ lọc:
        if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
          const subIds = new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, allUnits)]);
          return subIds.has(cfgUnitId);
        }
        // Nếu Admin không chọn lọc đơn vị nào (để "Tất cả đơn vị"): Hiển thị tất cả cấu hình của các đơn vị
        return true;
      }

      // 3. Tài khoản thuộc Đơn vị (userPermittedUnitIds là Set các đơn vị được phép):
      // Tuyệt đối không thấy cấu hình của đơn vị khác ngoài phạm vi cho phép
      if (!userPermittedUnitIds.has(cfgUnitId)) {
        // Ngoại lệ: Nếu do chính tài khoản này tạo thì vẫn cho phép thấy
        if (user?.username && c.tao_boi === user.username) return true;
        if (user?.ho_ten && c.tao_boi === user.ho_ten) return true;
        return false;
      }

      // Nếu người dùng đơn vị đang chọn lọc 1 showroom/đơn vị trực thuộc cụ thể:
      if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
        const subIds = new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, allUnits)]);
        return subIds.has(cfgUnitId) || userPermittedUnitIds.has(cfgUnitId);
      }

      return true;
    });
  }, [configs, userPermittedUnitIds, selectedUnitFilter, fullDonViList, donViList, user]);

  // Đảm bảo activeConfigId luôn trỏ tới một cấu hình hợp lệ trong filteredConfigs
  useEffect(() => {
    if (filteredConfigs.length > 0 && !filteredConfigs.some(c => c.id === activeConfigId)) {
      const defaultCfg = filteredConfigs.find(c => c.la_mac_dinh) || filteredConfigs[0];
      if (defaultCfg) setActiveConfigId(defaultCfg.id);
    }
  }, [filteredConfigs, activeConfigId]);

  // Cấu hình đang chọn
  const currentConfig = useMemo(() => {
    const cfg = filteredConfigs.find(c => c.id === activeConfigId) || filteredConfigs[0] || FALLBACK_DEFAULT_CONFIG;
    return {
      ...cfg,
      layout: cfg.layout || cfg.cau_hinh || DEFAULT_LAYOUT,
      cau_hinh: cfg.cau_hinh || cfg.layout || DEFAULT_LAYOUT
    };
  }, [filteredConfigs, activeConfigId]);

  // Kiểm tra quyền được phép chỉnh sửa / đổi tên / xóa cấu hình hiện tại
  const canModifyConfig = useMemo(() => {
    if (currentConfig.la_mac_dinh || currentConfig.id === FALLBACK_DEFAULT_CONFIG.id) {
      return false; // Cấu hình mặc định hệ thống luôn bị khóa
    }
    // Admin có toàn quyền quản trị
    if (!userPermittedUnitIds) return true;
    // Người dùng có quyền nếu cấu hình thuộc đơn vị trong phạm vi phân quyền của mình
    if (currentConfig.id_don_vi && userPermittedUnitIds.has(String(currentConfig.id_don_vi))) {
      return true;
    }
    // Hoặc do chính người này tạo
    if (user && (currentConfig.tao_boi === user.ho_ten || currentConfig.tao_boi === user.username)) {
      return true;
    }
    return false;
  }, [currentConfig, userPermittedUnitIds, user]);

  // Kiểm tra quyền nhân bản mẫu báo cáo Pivot (CP_PIVOT_CLONE hoặc Admin)
  const canClonePivot = useMemo(() => {
    if (!user) return false;
    // Admin có toàn quyền
    if (user.role === 'ADMIN' || user.role === 'Admin' || (user as any).quyen === 'ADMIN' || !userPermittedUnitIds) {
      return true;
    }
    const rules = String(user.quyen_chi_tiet || '').split(',').map(r => r.trim()).filter(Boolean);
    return rules.includes('CP_PIVOT_CLONE');
  }, [user, userPermittedUnitIds]);

  // Chuẩn hóa dữ liệu phẳng (Flat records) LIVE theo thời gian thực từ DNTT & phân bổ
  const flatRecords: PivotFlatRecord[] = useMemo(() => {
    return buildPivotFlatRecords({
      dnttList,
      phanBoList,
      donViList: fullDonViList || donViList,
      boPhanList,
      kmpList,
      selectedUnitFilter,
      userPermittedUnitIds,
      includeTemporary,
      onlyAdministrative
    });
  }, [
    dnttList,
    phanBoList,
    fullDonViList,
    donViList,
    boPhanList,
    kmpList,
    selectedUnitFilter,
    userPermittedUnitIds,
    includeTemporary,
    onlyAdministrative
  ]);

  // Cập nhật Layout khi người dùng thao tác kéo thả trên CostPivotBuilder
  const handleLayoutChange = (newLayout: PivotLayoutConfig) => {
    if (currentConfig.khoa || !canModifyConfig) {
      if (canClonePivot) {
        toast.warning('Cấu hình này đã bị khóa hoặc bạn không có quyền sửa. Vui lòng bấm "Báo cáo tuỳ chỉnh"!');
      } else {
        toast.warning('Cấu hình này đã bị khóa hoặc bạn không có quyền chỉnh sửa.');
      }
      return;
    }

    setConfigs(prev => prev.map(c => {
      if (c.id === currentConfig.id) {
        return { ...c, layout: newLayout, cau_hinh: newLayout };
      }
      return c;
    }));
  };

  // 1. CHỌN CẤU HÌNH KHÁC
  const handleSelectConfig = (configId: string) => {
    setActiveConfigId(configId);
  };

  // 2. KHÓA / MỞ KHÓA CẤU HÌNH
  const handleToggleLock = async () => {
    if (currentConfig.id === FALLBACK_DEFAULT_CONFIG.id || currentConfig.la_mac_dinh) {
      if (canClonePivot) {
        toast.info('Cấu hình mặc định luôn được khóa để bảo vệ hệ thống. Hãy bấm "Báo cáo tuỳ chỉnh"!');
      } else {
        toast.info('Cấu hình mặc định luôn được khóa để bảo vệ hệ thống.');
      }
      return;
    }
    if (!canModifyConfig) {
      toast.error('Bạn không có quyền thay đổi trạng thái khóa cấu hình này!');
      return;
    }

    const nextLock = !currentConfig.khoa;
    const updatedCfg: ChiPhiPivotConfig = { ...currentConfig, khoa: nextLock };

    setConfigs(prev => prev.map(c => c.id === updatedCfg.id ? updatedCfg : c));
    persistLocalConfigs(configs.map(c => c.id === updatedCfg.id ? updatedCfg : c));

    try {
      if (apiService.save) {
        await apiService.save(updatedCfg, 'update', 'chi_phi_pivot_config');
      }
      toast.success(nextLock ? 'Đã khóa cấu hình báo cáo!' : 'Đã mở khóa cấu hình báo cáo!');
    } catch {
      toast.success(nextLock ? 'Đã khóa cấu hình!' : 'Đã mở khóa cấu hình!');
    }
  };

  // 3. NHÂN BẢN CẤU HÌNH ĐỂ CHỈNH SỬA (CLONE)
  const handleCloneConfig = async (newName: string) => {
    if (!canClonePivot) {
      toast.error('Bạn chưa được cấp quyền nhân bản mẫu báo cáo Pivot. Vui lòng liên hệ Quản trị viên!');
      return;
    }

    const newId = `PVC_${Date.now()}`;
    const clonedLayout: PivotLayoutConfig = JSON.parse(JSON.stringify(currentConfig.layout || DEFAULT_LAYOUT));

    // Xác định đơn vị sở hữu cấu hình mới:
    const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;
    const rawUserUnit = user?.id_don_vi ? String(user.id_don_vi).split(',')[0].trim() : null;
    const targetUnitId = (!userPermittedUnitIds && selectedUnitFilter && selectedUnitFilter !== 'ALL')
      ? selectedUnitFilter
      : (rawUserUnit || (selectedUnitFilter && selectedUnitFilter !== 'ALL' ? selectedUnitFilter : null));

    const unitObj = allUnits.find(d => String(d.id) === String(targetUnitId));
    const targetUnitName = unitObj?.ten_don_vi || '';
    const authorName = user?.ho_ten || user?.username || 'Người dùng';

    const clonedConfig: ChiPhiPivotConfig = {
      ...currentConfig,
      id: newId,
      ten_cau_hinh: newName,
      mo_ta: `Nhân bản từ [${currentConfig.ten_cau_hinh}] bởi ${authorName}${targetUnitName ? ` (${targetUnitName})` : ''}`,
      loai_renderer: 'pivot_generic', // Khi clone sang để sửa thì chuyển thành generic pivot kéo thả
      khoa: false,
      la_mac_dinh: false,
      thu_tu: (configs.length + 1) * 10,
      tao_boi: authorName,
      id_don_vi: targetUnitId,
      ten_don_vi: targetUnitName,
      layout: clonedLayout,
      cau_hinh: clonedLayout
    };

    const nextList = [...configs, clonedConfig];
    setConfigs(nextList);
    setActiveConfigId(newId);
    persistLocalConfigs(nextList);

    try {
      if (apiService.save) {
        await apiService.save(clonedConfig, 'create', 'chi_phi_pivot_config');
      }
      toast.success(`Đã tạo báo cáo tùy chỉnh "${newName}" thành công! Bạn có thể tự do kéo thả phân tích.`);
    } catch {
      toast.success(`Đã tạo báo cáo tùy chỉnh "${newName}" thành công (lưu cục bộ)!`);
    }
  };

  // 4. LƯU CẤU HÌNH HIỆN TẠI
  const handleSaveCurrentConfig = async () => {
    if (currentConfig.khoa) {
      toast.error('Cấu hình đã bị khóa. Vui lòng bấm "Báo cáo tuỳ chỉnh" hoặc "Lưu thành mới"!');
      return;
    }
    if (!canModifyConfig) {
      toast.error('Bạn không có quyền chỉnh sửa cấu hình của đơn vị khác!');
      return;
    }

    persistLocalConfigs(configs);

    try {
      if (apiService.save) {
        await apiService.save(currentConfig, 'update', 'chi_phi_pivot_config');
      }
      toast.success(`Đã lưu cấu hình "${currentConfig.ten_cau_hinh}" thành công!`);
    } catch {
      toast.success(`Đã lưu cấu hình "${currentConfig.ten_cau_hinh}" thành công (lưu cục bộ)!`);
    }
  };

  // 5. LƯU THÀNH MẪU MỚI (SAVE AS)
  const handleSaveAsNew = async (newName: string) => {
    const newId = `PVC_${Date.now()}`;
    const newLayout: PivotLayoutConfig = JSON.parse(JSON.stringify(currentConfig.layout || DEFAULT_LAYOUT));

    const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;
    const rawUserUnit = user?.id_don_vi ? String(user.id_don_vi).split(',')[0].trim() : null;
    const targetUnitId = (!userPermittedUnitIds && selectedUnitFilter && selectedUnitFilter !== 'ALL')
      ? selectedUnitFilter
      : (rawUserUnit || (selectedUnitFilter && selectedUnitFilter !== 'ALL' ? selectedUnitFilter : null));

    const unitObj = allUnits.find(d => String(d.id) === String(targetUnitId));
    const targetUnitName = unitObj?.ten_don_vi || '';
    const authorName = user?.ho_ten || user?.username || 'Người dùng';

    const newCfg: ChiPhiPivotConfig = {
      ...currentConfig,
      id: newId,
      ten_cau_hinh: newName,
      mo_ta: `Lưu mới từ [${currentConfig.ten_cau_hinh}] bởi ${authorName}${targetUnitName ? ` (${targetUnitName})` : ''}`,
      loai_renderer: 'pivot_generic',
      khoa: false,
      la_mac_dinh: false,
      thu_tu: (configs.length + 1) * 10,
      tao_boi: authorName,
      id_don_vi: targetUnitId,
      ten_don_vi: targetUnitName,
      layout: newLayout,
      cau_hinh: newLayout
    };

    const nextList = [...configs, newCfg];
    setConfigs(nextList);
    setActiveConfigId(newId);
    persistLocalConfigs(nextList);

    try {
      if (apiService.save) {
        await apiService.save(newCfg, 'create', 'chi_phi_pivot_config');
      }
      toast.success(`Đã lưu mẫu báo cáo mới "${newName}" thành công!`);
    } catch {
      toast.success(`Đã lưu mẫu báo cáo mới "${newName}" thành công (lưu cục bộ)!`);
    }
  };

  // 6. ĐỔI TÊN CẤU HÌNH
  const handleRename = async (newName: string) => {
    if (currentConfig.khoa) {
      toast.warning('Không thể đổi tên cấu hình đã khóa!');
      return;
    }
    if (!canModifyConfig) {
      toast.error('Bạn không có quyền đổi tên cấu hình của đơn vị khác!');
      return;
    }

    const updatedCfg = { ...currentConfig, ten_cau_hinh: newName };
    const nextList = configs.map(c => c.id === updatedCfg.id ? updatedCfg : c);
    setConfigs(nextList);
    persistLocalConfigs(nextList);

    try {
      if (apiService.save) {
        await apiService.save(updatedCfg, 'update', 'chi_phi_pivot_config');
      }
      toast.success('Đã cập nhật tên cấu hình báo cáo!');
    } catch {
      toast.success('Đã cập nhật tên cấu hình báo cáo!');
    }
  };

  // 7. XÓA CẤU HÌNH
  const handleDelete = async () => {
    if (currentConfig.khoa || currentConfig.la_mac_dinh || currentConfig.id === FALLBACK_DEFAULT_CONFIG.id) {
      toast.error('Không được xóa cấu hình mặc định được bảo vệ!');
      return;
    }
    if (!canModifyConfig) {
      toast.error('Bạn không có quyền xóa cấu hình của đơn vị khác!');
      return;
    }

    const nextList = configs.filter(c => c.id !== currentConfig.id);
    setConfigs(nextList);
    setActiveConfigId(FALLBACK_DEFAULT_CONFIG.id);
    persistLocalConfigs(nextList);

    try {
      if (apiService.deleteRecord) {
        await apiService.deleteRecord(currentConfig.id, 'chi_phi_pivot_config');
      }
      toast.success(`Đã xóa cấu hình "${currentConfig.ten_cau_hinh}"!`);
    } catch {
      toast.success(`Đã xóa cấu hình "${currentConfig.ten_cau_hinh}"!`);
    }
  };

  // 8. TÊN ĐƠN VỊ ĐANG XEM
  const currentUnitName = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return 'Tất cả Đơn vị';
    }
    const found = (fullDonViList || donViList).find(d => String(d.id) === String(selectedUnitFilter));
    return found ? found.ten_don_vi : selectedUnitFilter;
  }, [selectedUnitFilter, fullDonViList, donViList]);

  // 9. XUẤT EXCEL THÔNG MINH THEO CẤU HÌNH
  const handleExportExcel = () => {
    // 9.1. Nếu là Renderer matrix_thaco: Xuất đa sheet theo mẫu báo cáo mặc định
    if (currentConfig.loai_renderer === 'matrix_thaco') {
      exportThacoMultiSheetExcel({
        year,
        companyName: currentUnitName,
        thongKeList,
        chotKyList,
        dnttList,
        phanBoList,
        kmpList,
        nhomChiPhiList,
        donViList,
        boPhanList,
        selectedUnitFilter,
        includeTemporary,
        onlyAdministrative
      });
      return;
    }

    // 9.2. Nếu là Generic Pivot: Tính ma trận và xuất 1 sheet Excel chuyên nghiệp
    try {
      const currentLayout = currentConfig.layout || DEFAULT_LAYOUT;
      const tableData = computePivotMatrix(flatRecords, currentLayout);
      const rowLabels = (currentLayout.rows || []).map(r => {
        const found = PIVOT_AVAILABLE_FIELDS.find(f => f.key === r);
        return found ? found.label : r;
      });

      exportGenericPivotExcel({
        configName: currentConfig.ten_cau_hinh || 'Báo cáo thống kê',
        data: tableData,
        rowFieldLabels: rowLabels,
        filterSummary: `Đơn vị: ${currentUnitName} | Thời gian: Năm ${year}`
      });
    } catch (err) {
      console.error('Lỗi khi xuất Pivot Excel:', err);
      toast.error('Có lỗi xảy ra trong quá trình tạo file Excel!');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* THANH ĐIỀU KHIỂN CẤU HÌNH PIVOT (PIVOT CONFIG BAR) */}
      <PivotConfigBar
        configs={filteredConfigs}
        activeConfigId={activeConfigId}
        onSelectConfig={handleSelectConfig}
        onCloneConfig={handleCloneConfig}
        onSaveConfig={handleSaveCurrentConfig}
        onSaveAsNewConfig={handleSaveAsNew}
        onRenameConfig={handleRename}
        onDeleteConfig={() => handleDelete()}
        onExportExcel={handleExportExcel}
        onRefreshData={loadConfigs}
        loading={loadingConfigs}
        canModifyConfig={canModifyConfig}
        canClonePivot={canClonePivot}
        isAdmin={!userPermittedUnitIds}
      />

      {/* VÙNG NỘI DUNG CHÍNH: CHUYỂN ĐỔI THEO LOẠI RENDERER */}
      <div className="flex-1 min-h-0">
        {currentConfig.loai_renderer === 'matrix_thaco' ? (
          /* MẪU BÁO CÁO MẶC ĐỊNH (COST MATRIX VIEW CŨ ĐƯỢC GIỮ NGUYÊN VẸN LOGIC) */
          <CostMatrixView
            year={year}
            onYearChange={onYearChange}
            thongKeList={thongKeList}
            chotKyList={chotKyList}
            dnttList={dnttList}
            phanBoList={phanBoList}
            kmpList={kmpList}
            nhomChiPhiList={nhomChiPhiList}
            donViList={donViList}
            fullDonViList={fullDonViList}
            boPhanList={boPhanList}
            selectedUnitFilter={selectedUnitFilter}
            userPermittedUnitIds={userPermittedUnitIds}
            includeTemporary={includeTemporary}
            onToggleIncludeTemporary={onToggleIncludeTemporary}
            onlyAdministrative={onlyAdministrative}
            onToggleOnlyAdministrative={onToggleOnlyAdministrative}
            onOpenChotKyModal={onOpenChotKyModal}
          />
        ) : (
          /* MÀN HÌNH PIVOT KÉO THẢ TÙY BIẾN ĐA CHIỀU THỜI GIAN THỰC */
          <CostPivotBuilder
            records={flatRecords}
            layout={currentConfig.layout || DEFAULT_LAYOUT}
            onChangeLayout={handleLayoutChange}
            isLocked={!!currentConfig.khoa}
            canClone={canClonePivot}
          />
        )}
      </div>
    </div>
  );
}
