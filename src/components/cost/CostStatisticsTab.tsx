import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart2, Calendar, Filter, Download, Lock, Unlock, AlertCircle,
  TrendingUp, TrendingDown, CheckCircle2, ChevronDown, ChevronRight, Layers,
  Building, RefreshCw, X, ShieldAlert, Sparkles, PieChart, FileSpreadsheet,
  Search, CheckSquare, Square, Clock, CheckCheck, AlertTriangle, Globe
} from 'lucide-react';
import {
  ChiPhiChotKy, ChiPhiThongKe, DNTT, DnttPhanBo, DmKmp,
  DmBoPhan, BoPhanCap1, BoPhanCap2, DonVi, PhapNhan, DmNhomChiPhi
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/toast';
import { getAllSubordinateIds, getUserPermittedUnitIds, getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../../utils/hierarchy';
import CostMatrixView from './CostMatrixView';
import CostPivotView from './pivot/CostPivotView';
import CostDashboardTab from './CostDashboardTab';

interface Props {
  thongKeList: ChiPhiThongKe[];
  chotKyList: ChiPhiChotKy[];
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  nhomChiPhiList?: DmNhomChiPhi[];
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  donViList: DonVi[];
  fullDonViList?: DonVi[];
  phapNhanList: PhapNhan[];
  selectedUnitFilter: string | null;
  onRefresh: () => Promise<void>;
  loading: boolean;
  activeSubTab?: 'bao_cao' | 'dashboard';
  onSubTabChange?: (sub: 'bao_cao' | 'dashboard') => void;
  chotKyTrigger?: number;
}

type DimensionType =
  | 'phia'
  | 'don_vi'
  | 'loai_hinh'
  | 'showroom'
  | 'khoi_nghiep_vu'
  | 'thuong_hieu_bo_phan'
  | 'phap_nhan';

type PeriodType = 'thang' | 'quy' | '6thang' | 'nam';

const DIMENSION_CONFIG: Array<{ id: DimensionType; label: string; icon: string }> = [
  { id: 'phia', label: 'Phía', icon: '🏢' },
  { id: 'don_vi', label: 'Đơn vị', icon: '🏛️' },
  { id: 'loai_hinh', label: 'Loại hình', icon: '🏷️' },
  { id: 'showroom', label: 'Showroom', icon: '🏬' },
  { id: 'khoi_nghiep_vu', label: 'Khối/Nghiệp vụ', icon: '💼' },
  { id: 'thuong_hieu_bo_phan', label: 'Thương hiệu / Phòng / Bộ phận', icon: '🎯' },
  { id: 'phap_nhan', label: 'Pháp nhân', icon: '📜' }
];

export default function CostStatisticsTab({
  thongKeList,
  chotKyList,
  dnttList,
  phanBoList,
  kmpList,
  nhomChiPhiList = [],
  boPhanList = [],
  cap1List,
  cap2List,
  donViList,
  fullDonViList,
  phapNhanList,
  selectedUnitFilter,
  onRefresh,
  loading,
  activeSubTab,
  onSubTabChange,
  chotKyTrigger
}: Props) {
  const { user, canLockPeriod } = useAuth();
  const isAdmin = useMemo(() => String(user?.quyen || '').toUpperCase() === 'ADMIN', [user]);
  const canLock = useMemo(() => {
    return isAdmin || canLockPeriod(selectedUnitFilter || undefined);
  }, [isAdmin, canLockPeriod, selectedUnitFilter]);

  // 1. STATE SUB-TABS & BỘ LỌC
  const [internalSubTab, setInternalSubTab] = useState<'bao_cao' | 'dashboard'>('bao_cao');
  const currentSubTab = activeSubTab || internalSubTab;
  const setCurrentSubTab = onSubTabChange || setInternalSubTab;

  const [includeTemporary, setIncludeTemporary] = useState<boolean>(false);
  const [onlyAdministrative, setOnlyAdministrative] = useState<boolean>(true);

  const now = new Date();
  const [dimension, setDimension] = useState<DimensionType>('phia');
  const [periodType, setPeriodType] = useState<PeriodType>('thang');
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((now.getMonth() + 1) / 3));
  const [selectedHalf, setSelectedHalf] = useState<1 | 2>(now.getMonth() + 1 <= 6 ? 1 : 2);
  const [selectedKmpId, setSelectedKmpId] = useState<string>('ALL');

  // Bộ lọc độc lập cho từng chiều phân tích (Cascading Multi-select Filters)
  const [dimFilters, setDimFilters] = useState<Partial<Record<DimensionType, Set<string>>>>({});
  const [openDropdownDim, setOpenDropdownDim] = useState<DimensionType | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const dimFilterDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dimFilterDropdownRef.current && !dimFilterDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownDim(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Phạm vi phân quyền đơn vị của người dùng (Đơn vị mẹ + các đơn vị trực thuộc)
  const userPermittedUnitIds = useMemo(() => {
    return getUserPermittedUnitIds(user, fullDonViList || donViList);
  }, [user, fullDonViList, donViList]);

  // Xác định phạm vi áp dụng của thao tác chốt kỳ:
  const currentScopeInfo = useMemo(() => {
    const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;
    if (isAdmin && (!selectedUnitFilter || selectedUnitFilter === 'ALL')) {
      return {
        scopeUnitId: 'ALL',
        scopeUnitName: 'Toàn hệ thống (Toàn quốc)',
        subCount: allUnits.length,
        affectedUnitIds: undefined
      };
    }

    let targetUnitId = selectedUnitFilter && selectedUnitFilter !== 'ALL' ? selectedUnitFilter : user?.id_don_vi;
    if (targetUnitId && String(targetUnitId).includes(',')) {
      targetUnitId = String(targetUnitId).split(',')[0].trim();
    }

    let targetUnit = allUnits.find(d => String(d.id) === String(targetUnitId));
    if (!targetUnit && allUnits.length > 0) targetUnit = allUnits[0];

    // Nếu là Showroom con, tìm đơn vị mẹ CTTT / VPĐH:
    let rootUnit = targetUnit;
    if (rootUnit?.cap_quan_ly && rootUnit.cap_quan_ly !== 'HO' && rootUnit.cap_quan_ly !== 'DV_HO') {
      const parent = allUnits.find(u => String(u.id) === String(rootUnit?.cap_quan_ly));
      if (parent) rootUnit = parent;
    }

    const rootId = rootUnit ? String(rootUnit.id) : '';
    const rootName = rootUnit ? rootUnit.ten_don_vi : 'Đơn vị';
    const subIds = rootId ? getAllSubordinateIds(rootId, allUnits) : [];
    const affectedIds = rootId ? [rootId, ...subIds] : [];

    return {
      scopeUnitId: rootId,
      scopeUnitName: rootName,
      subCount: subIds.length,
      affectedUnitIds: affectedIds
    };
  }, [isAdmin, selectedUnitFilter, user?.id_don_vi, fullDonViList, donViList]);

  // Đơn vị được lọc từ thanh bên ngoài và phân quyền tài khoản
  const allowedUnitIds = useMemo(() => {
    if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      const subIds = new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, fullDonViList || donViList)]);
      if (userPermittedUnitIds) {
        return new Set([...subIds].filter(id => userPermittedUnitIds.has(id)));
      }
      return subIds;
    }
    // Khi chọn "Tất cả Đơn vị trực thuộc" (selectedUnitFilter là null hoặc 'ALL'):
    if (userPermittedUnitIds) {
      return userPermittedUnitIds;
    }
    return null; // Quản trị viên toàn quyền
  }, [selectedUnitFilter, fullDonViList, donViList, userPermittedUnitIds]);

  // Nhóm KMP theo nhóm chi phí
  const groupedKmp = useMemo(() => {
    const map = new Map<string, DmKmp[]>();
    kmpList.forEach(k => {
      const group = k.nhom_chi_phi || 'Khác';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(k);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [kmpList]);

  // Modal Quản lý Chốt kỳ
  const [chotKyModalOpen, setChotKyModalOpen] = useState(false);
  const [chotKySubmitting, setChotKySubmitting] = useState(false);
  const [newChotThang, setNewChotThang] = useState<number>(now.getMonth() + 1);
  const [newChotNam, setNewChotNam] = useState<number>(now.getFullYear());
  const [newChotGhiChu, setNewChotGhiChu] = useState<string>('');
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // Quản lý Mở khóa ngoại lệ theo Đơn vị & Gia hạn thời gian & Đồng bộ Snapshot
  const [unitUnlockModalOpen, setUnitUnlockModalOpen] = useState<ChiPhiChotKy | null>(null);
  const [unlockMode, setUnlockMode] = useState<'CURRENT_FILTER' | 'ALL_SYSTEM' | 'TREE_SELECT'>('CURRENT_FILTER');
  const [selectedUnitsToUnlock, setSelectedUnitsToUnlock] = useState<string[]>([]);
  const [expandedUnitTreeParents, setExpandedUnitTreeParents] = useState<string[]>([]);
  const [unlockHasDeadline, setUnlockHasDeadline] = useState<boolean>(true);
  const [unlockDeadline, setUnlockDeadline] = useState<string>('');
  const [unitSearchKeyword, setUnitSearchKeyword] = useState<string>('');
  const [unitUnlockReason, setUnitUnlockReason] = useState<string>('');
  const [unitUnlockSubmitting, setUnitUnlockSubmitting] = useState(false);
  const [syncingSnapshotId, setSyncingSnapshotId] = useState<string | null>(null);

  // Modal Gia hạn thời gian riêng
  const [extensionModalOpen, setExtensionModalOpen] = useState<ChiPhiChotKy | null>(null);
  const [extensionHasDeadline, setExtensionHasDeadline] = useState<boolean>(true);
  const [extensionDeadline, setExtensionDeadline] = useState<string>('');
  const [extensionReason, setExtensionReason] = useState<string>('');
  const [extensionSubmitting, setExtensionSubmitting] = useState(false);

  // Helpers định dạng thời gian cho input datetime-local
  const formatDateTimeLocalInput = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const getFutureDateAt2359 = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(23, 59, 0, 0);
    return formatDateTimeLocalInput(d);
  };

  const getEndOfWeekDateAt2359 = () => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(23, 59, 0, 0);
    return formatDateTimeLocalInput(d);
  };

  const openUnlockModal = (ck: ChiPhiChotKy) => {
    setUnitUnlockModalOpen(ck);
    setUnlockMode('CURRENT_FILTER');
    setSelectedUnitsToUnlock([]);
    setExpandedUnitTreeParents([]);
    setUnitSearchKeyword('');
    setUnlockHasDeadline(true);
    setUnlockDeadline(getFutureDateAt2359(2)); // Mặc định 2 ngày tới
    setUnitUnlockReason('');
  };

  const openExtensionModal = (ck: ChiPhiChotKy) => {
    setExtensionModalOpen(ck);
    if (ck.han_mo_khoa) {
      setExtensionHasDeadline(true);
      const d = new Date(ck.han_mo_khoa);
      if (!isNaN(d.getTime())) {
        setExtensionDeadline(formatDateTimeLocalInput(d));
      } else {
        setExtensionDeadline(getFutureDateAt2359(2));
      }
    } else {
      setExtensionHasDeadline(true);
      setExtensionDeadline(getFutureDateAt2359(2));
    }
    setExtensionReason(ck.ly_do_mo_khoa || '');
  };

  const formatDeadlineBadge = (deadlineStr?: string | null) => {
    if (!deadlineStr) return null;
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isExpired = now > d;
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    
    if (isExpired) {
      return {
        isExpired: true,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
        label: `Đã hết hạn (${timeStr})`,
        tooltip: `Đã hết hạn lúc ${timeStr}. Hệ thống đang tự động đóng băng an toàn các phiếu DNTT.`
      };
    }
    
    const diffMs = d.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    const remainStr = diffDays > 0 ? `Còn ${diffDays} ngày ${remHours}h` : `Còn ${Math.max(1, diffHours)}h`;

    return {
      isExpired: false,
      badgeClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700",
      label: `Hạn: ${timeStr} (${remainStr})`,
      tooltip: `Đang mở khóa có thời hạn đến ${timeStr} (${remainStr}). Sau thời hạn này hệ thống sẽ tự động đóng băng an toàn.`
    };
  };

  // Mở modal khi nhận trigger từ menu tính năng bên ngoài (Chỉ Admin hoặc người có quyền Chốt kỳ)
  useEffect(() => {
    if (chotKyTrigger && chotKyTrigger > 0 && canLock) {
      setChotKyModalOpen(true);
    }
  }, [chotKyTrigger, canLock]);

  // Cấu trúc Cây Đơn vị Phân cấp chuẩn theo Bộ lọc Đơn vị của Quản lý Chi phí
  const unitTreeData = useMemo(() => {
    const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;
    
    // Lọc theo phân quyền người dùng
    let permitted = userPermittedUnitIds
      ? allUnits.filter(u => userPermittedUnitIds.has(String(u.id)))
      : allUnits;

    // Nếu kỳ chốt có id_don_vi cụ thể (không phải 'ALL'), chỉ lấy các đơn vị trong phạm vi của kỳ đó
    if (unitUnlockModalOpen?.id_don_vi && unitUnlockModalOpen.id_don_vi !== 'ALL') {
      const allowedScopeIds = new Set([
        String(unitUnlockModalOpen.id_don_vi),
        ...getAllSubordinateIds(unitUnlockModalOpen.id_don_vi, allUnits).map(String)
      ]);
      permitted = permitted.filter(u => allowedScopeIds.has(String(u.id)));
    }

    // Tìm kiếm nhanh theo từ khóa
    let searchedUnits = permitted;
    if (unitSearchKeyword.trim()) {
      const lower = unitSearchKeyword.toLowerCase().trim();
      const matchedIds = new Set<string>();
      permitted.forEach(u => {
        if (
          String(u.ten_don_vi || '').toLowerCase().includes(lower) ||
          String(u.ma_don_vi || '').toLowerCase().includes(lower) ||
          String(u.id || '').toLowerCase().includes(lower)
        ) {
          matchedIds.add(String(u.id));
          let pId = u.cap_quan_ly;
          while (pId && pId !== 'HO' && pId !== 'DV_HO') {
            matchedIds.add(String(pId));
            const pUnit = permitted.find(p => String(p.id) === String(pId));
            pId = pUnit ? pUnit.cap_quan_ly : null;
          }
        }
      });
      const addChildren = (parentId: string) => {
        permitted.forEach(u => {
          if (String(u.cap_quan_ly) === parentId && !matchedIds.has(String(u.id))) {
            matchedIds.add(String(u.id));
            addChildren(String(u.id));
          }
        });
      };
      Array.from(matchedIds).forEach(id => addChildren(id));
      searchedUnits = permitted.filter(u => matchedIds.has(String(u.id)));
    }

    const searchedUnitIds = new Set(searchedUnits.map(u => String(u.id)));
    const parents = searchedUnits.filter(u =>
      u.cap_quan_ly === 'HO' || u.cap_quan_ly === 'DV_HO' || !u.cap_quan_ly || !searchedUnitIds.has(String(u.cap_quan_ly))
    );

    const getChildren = (parentId: string) =>
      sortDonViByThuTu(searchedUnits.filter(u => String(u.cap_quan_ly) === String(parentId)));

    const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = groupParentUnits(parents);

    return {
      allUnits: permitted,
      searchedUnits,
      parents,
      getChildren,
      vpdhUnits,
      ctttNamUnits,
      ctttBacUnits,
      otherUnits
    };
  }, [fullDonViList, donViList, userPermittedUnitIds, unitUnlockModalOpen, unitSearchKeyword]);

  // 2. MAPPING DICTIONARIES
  const donViMap = useMemo(() => new Map(donViList.map(d => [String(d.id), d])), [donViList]);
  const phapNhanMap = useMemo(() => new Map(phapNhanList.map(p => [String(p.id), p])), [phapNhanList]);
  const kmpMap = useMemo(() => new Map(kmpList.map(k => [String(k.id), k])), [kmpList]);
  const cap1Map = useMemo(() => new Map(cap1List.map(c => [String(c.id), c])), [cap1List]);
  const cap2Map = useMemo(() => new Map(cap2List.map(c => [String(c.id), c])), [cap2List]);

  // Map MST -> Đại diện Pháp nhân
  const mstRepresentativeMap = useMemo(() => {
    const map = new Map<string, string>();
    phapNhanList.forEach(pn => {
      const mst = (pn.ma_so_thue || '').trim();
      if (mst && !map.has(mst)) {
        map.set(mst, pn.ten_cong_ty || pn.ten_phap_nhan || 'Chưa đặt tên');
      }
    });
    return map;
  }, [phapNhanList]);

  // 3. XÁC ĐỊNH DANH SÁCH THÁNG CHO KỲ NÀY VÀ KỲ TRƯỚC (CÙNG KỲ NĂM TRƯỚC)
  const { currentPeriodMonths, prevPeriodMonths, periodLabel, prevPeriodLabel } = useMemo(() => {
    let currMonths: number[] = [];
    let label = '';
    let prevLabel = '';

    if (periodType === 'thang') {
      currMonths = [selectedMonth];
      label = `Tháng ${selectedMonth}/${selectedYear}`;
      prevLabel = `Tháng ${selectedMonth}/${selectedYear - 1}`;
    } else if (periodType === 'quy') {
      if (selectedQuarter === 1) currMonths = [1, 2, 3];
      else if (selectedQuarter === 2) currMonths = [4, 5, 6];
      else if (selectedQuarter === 3) currMonths = [7, 8, 9];
      else currMonths = [10, 11, 12];
      label = `Quý ${selectedQuarter}/${selectedYear}`;
      prevLabel = `Quý ${selectedQuarter}/${selectedYear - 1}`;
    } else if (periodType === '6thang') {
      currMonths = selectedHalf === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
      label = `6 tháng ${selectedHalf === 1 ? 'đầu năm' : 'cuối năm'} ${selectedYear}`;
      prevLabel = `6 tháng ${selectedHalf === 1 ? 'đầu năm' : 'cuối năm'} ${selectedYear - 1}`;
    } else {
      currMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      label = `Năm ${selectedYear}`;
      prevLabel = `Năm ${selectedYear - 1}`;
    }

    return {
      currentPeriodMonths: currMonths,
      prevPeriodMonths: currMonths,
      periodLabel: label,
      prevPeriodLabel: prevLabel
    };
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, selectedHalf]);

  // Kiểm tra tình trạng chốt kỳ của các tháng trong kỳ này
  const closedMonthsCurrentPeriod = useMemo(() => {
    const closed = new Set<number>();
    currentPeriodMonths.forEach(m => {
      const isClosed = chotKyList.some(ck => ck.nam === selectedYear && ck.thang === m && ck.trang_thai === 'da_chot');
      if (isClosed) closed.add(m);
    });
    return closed;
  }, [currentPeriodMonths, selectedYear, chotKyList]);

  // Danh sách các đơn vị trong phạm vi phân quyền và bộ lọc
  const permittedUnits = useMemo(() => {
    if (!allowedUnitIds) return donViList;
    return donViList.filter(d => allowedUnitIds.has(String(d.id)));
  }, [donViList, allowedUnitIds]);

  // Danh mục Bộ phận có hiệu lực theo đơn vị đang chọn (fallback mẫu chung)
  const effectiveBoPhanList = useMemo(() => {
    if (!boPhanList || boPhanList.length === 0) return [];
    if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      const specific = boPhanList.filter(b => {
        if (b.active === false || !b.id_don_vi) return false;
        const ids = String(b.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
        return ids.includes(String(selectedUnitFilter));
      });
      if (specific.length > 0) return specific;
    } else if (userPermittedUnitIds) {
      // Khi chọn "Tất cả Đơn vị trực thuộc": kiểm tra bộ phận riêng của các đơn vị thuộc quyền
      const specific = boPhanList.filter(b => {
        if (b.active === false || !b.id_don_vi) return false;
        const ids = String(b.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
        return ids.some(id => userPermittedUnitIds.has(id));
      });
      if (specific.length > 0) return specific;
    }
    const common = boPhanList.filter(b => !b.id_don_vi && b.active !== false);
    return common.length > 0 ? common : boPhanList.filter(b => b.active !== false);
  }, [boPhanList, selectedUnitFilter, userPermittedUnitIds]);

  // Danh sách Khối / Nghiệp vụ duy nhất của đơn vị
  const uniqueKhoiList = useMemo(() => {
    const map = new Map<string, string>();
    if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
      effectiveBoPhanList.forEach(b => {
        if (b.ma_cap1 && !map.has(b.ma_cap1)) {
          map.set(b.ma_cap1, b.ten_cap1);
        }
      });
    }
    if (map.size === 0 && cap1List) {
      cap1List.filter(c => c.active !== false).forEach(c => {
        map.set(c.id || c.ma, c.ten);
      });
    }
    return Array.from(map.entries()).map(([ma, ten]) => ({ ma, ten }));
  }, [effectiveBoPhanList, cap1List]);

  // --- A. CÁC HÀM CHUẨN HÓA DỮ LIỆU ĐƠN VỊ ---
  const normalizePhia = (val?: string | null): string => {
    if (!val) return 'Chưa phân loại Phía';
    const p = val.trim();
    if (/^CTTT\s+ph[íi]a\s+nam$/i.test(p)) return 'CTTT Phía Nam';
    if (/^CTTT\s+ph[íi]a\s+b[ắa]c$/i.test(p)) return 'CTTT Phía Bắc';
    if (/^VPĐH$/i.test(p)) return 'VPĐH';
    return p;
  };

  const isShowroomUnit = (dv?: DonVi | null): boolean => {
    if (!dv) return false;
    return (
      dv.loai_hinh === 'Showroom Quản trị' ||
      dv.loai_hinh === 'Showroom' ||
      (Boolean(dv.cap_quan_ly) && dv.cap_quan_ly !== 'HO' && dv.cap_quan_ly !== 'DV_HO')
    );
  };

  const getParentUnitId = (dv?: DonVi | null): string => {
    if (!dv) return 'UNKNOWN';
    if (isShowroomUnit(dv) && dv.cap_quan_ly && dv.cap_quan_ly !== 'HO' && dv.cap_quan_ly !== 'DV_HO') {
      return String(dv.cap_quan_ly);
    }
    return String(dv.id);
  };

  const normalizeLoaiHinh = (dv?: DonVi | null): string => {
    if (!dv) return 'Khác';
    const raw = (dv.loai_hinh || '').trim();
    if (raw === 'Văn phòng' || dv.cap_quan_ly === 'HO') return 'VPĐH';
    if (raw === 'Công ty Tỉnh thành') return 'Công ty Tỉnh thành';
    if (raw === 'Showroom Quản trị' || raw === 'Showroom' || isShowroomUnit(dv)) return 'Showroom';
    if (raw) return raw;
    return 'Khác';
  };

  // --- B. TÍNH TOÁN 7 TẦNG TÙY CHỌN BỘ LỌC PHÂN CẤP (CASCADING OPTIONS) ---

  // 1. Phía Options (VPĐH, CTTT Phía Nam, CTTT Phía Bắc)
  const optionsPhia = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const phiaSet = new Set<string>();
    permittedUnits.forEach(u => {
      phiaSet.add(normalizePhia(u.phia));
    });
    const standard = ['VPĐH', 'CTTT Phía Nam', 'CTTT Phía Bắc'];
    const result: string[] = [];
    standard.forEach(p => {
      if (phiaSet.has(p)) {
        result.push(p);
        phiaSet.delete(p);
      }
    });
    phiaSet.forEach(p => result.push(p));
    if (result.length === 0) return standard.map(p => ({ key: p, label: p }));
    return result.map(p => ({ key: p, label: p }));
  }, [permittedUnits]);

  const selectedPhiaKeys = useMemo(() => {
    const current = dimFilters.phia;
    const allKeys = optionsPhia.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.phia, optionsPhia]);

  // 2. Đơn vị Options (Phụ thuộc giá trị chọn theo Phía)
  const optionsDonVi = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const unitsInPhia = permittedUnits.filter(u => selectedPhiaKeys.has(normalizePhia(u.phia)));
    let list = unitsInPhia.filter(u => !isShowroomUnit(u));
    if (list.length === 0) list = unitsInPhia;
    return list.map(u => ({
      key: String(u.id),
      label: u.ten_don_vi,
      subLabel: normalizeLoaiHinh(u)
    }));
  }, [permittedUnits, selectedPhiaKeys]);

  const selectedDonViKeys = useMemo(() => {
    const current = dimFilters.don_vi;
    const allKeys = optionsDonVi.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.don_vi, optionsDonVi]);

  // 3. Loại hình Options (Phụ thuộc giá trị chọn Đơn vị)
  const optionsLoaiHinh = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const availableTypes = new Set<string>();
    permittedUnits.forEach(u => {
      const parentId = getParentUnitId(u);
      if (selectedDonViKeys.has(String(u.id)) || selectedDonViKeys.has(parentId)) {
        availableTypes.add(normalizeLoaiHinh(u));
      }
    });
    const standard = ['VPĐH', 'Công ty Tỉnh thành', 'Showroom'];
    const res: string[] = [];
    standard.forEach(t => {
      if (availableTypes.has(t)) {
        res.push(t);
        availableTypes.delete(t);
      }
    });
    availableTypes.forEach(t => res.push(t));
    if (res.length === 0) return standard.map(t => ({ key: t, label: t }));
    return res.map(t => ({ key: t, label: t }));
  }, [permittedUnits, selectedDonViKeys]);

  const selectedLoaiHinhKeys = useMemo(() => {
    const current = dimFilters.loai_hinh;
    const allKeys = optionsLoaiHinh.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.loai_hinh, optionsLoaiHinh]);

  // 4. Showroom Options (Phụ thuộc giá trị chọn Đơn vị)
  const optionsShowroom = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const showrooms = permittedUnits.filter(u => {
      if (!isShowroomUnit(u)) return false;
      const parentId = getParentUnitId(u);
      return selectedDonViKeys.has(parentId) || selectedDonViKeys.has(String(u.id));
    });
    return showrooms.map(u => ({
      key: String(u.id),
      label: u.ten_don_vi,
      subLabel: u.cap_quan_ly ? donViMap.get(String(u.cap_quan_ly))?.ten_don_vi : undefined
    }));
  }, [permittedUnits, selectedDonViKeys, donViMap]);

  const selectedShowroomKeys = useMemo(() => {
    const current = dimFilters.showroom;
    const allKeys = optionsShowroom.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.showroom, optionsShowroom]);

  // TẬP HỢP CÁC ID ĐƠN VỊ & SHOWROOM TRONG PHẠM VI LỌC (inScopeUnitIds)
  const inScopeUnitIds = useMemo(() => {
    const set = new Set<string>();
    permittedUnits.forEach(u => {
      const parentId = getParentUnitId(u);
      const isShowroom = isShowroomUnit(u);
      const lh = normalizeLoaiHinh(u);

      if (!selectedLoaiHinhKeys.has(lh)) return;

      if (isShowroom) {
        if (optionsShowroom.length > 0) {
          if (selectedShowroomKeys.has(String(u.id))) set.add(String(u.id));
        } else if (selectedDonViKeys.has(parentId)) {
          set.add(String(u.id));
        }
      } else {
        if (selectedDonViKeys.has(String(u.id))) set.add(String(u.id));
      }
    });
    return set;
  }, [permittedUnits, selectedLoaiHinhKeys, selectedShowroomKeys, selectedDonViKeys, optionsShowroom.length]);

  // Danh mục bộ phận tạo riêng cho các đơn vị đang nằm trong phạm vi lọc (inScopeUnitIds)
  const unitCustomDepts = useMemo(() => {
    if (!boPhanList || boPhanList.length === 0) return [];
    return boPhanList.filter(b => {
      if (b.active === false || !b.id_don_vi) return false;
      const ids = String(b.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
      return ids.some(id => inScopeUnitIds.has(id));
    });
  }, [boPhanList, inScopeUnitIds]);

  // Bộ phận có hiệu lực trong phạm vi: Ưu tiên bộ phận tạo riêng của đơn vị, fallback mẫu dùng chung (!b.id_don_vi)
  const effectiveScopeBoPhanList = useMemo(() => {
    if (unitCustomDepts.length > 0) return unitCustomDepts;
    const common = (boPhanList || []).filter(b => !b.id_don_vi && b.active !== false);
    return common.length > 0 ? common : (boPhanList || []).filter(b => b.active !== false);
  }, [unitCustomDepts, boPhanList]);

  // 5. Khối / Nghiệp vụ Options (Tham chiếu danh mục bộ phận tạo riêng của Đơn vị hoặc fallback mẫu chung)
  const optionsKhoi = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const map = new Map<string, string>();
    if (effectiveScopeBoPhanList && effectiveScopeBoPhanList.length > 0) {
      effectiveScopeBoPhanList.forEach(b => {
        if (b.ma_cap1 && !map.has(b.ma_cap1)) {
          map.set(b.ma_cap1, b.ten_cap1);
        }
      });
    }
    if (map.size === 0 && cap1List) {
      cap1List.filter(c => c.active !== false).forEach(c => {
        map.set(c.id || c.ma, c.ten);
      });
    }
    const opts: Array<{ key: string; label: string; subLabel?: string }> = Array.from(map.entries()).map(([ma, ten]) => ({
      key: ma,
      label: ten
    }));
    opts.push({
      key: 'NO_CAP1',
      label: '(Chưa phân loại Khối)',
      subLabel: 'Phân bổ chưa gán Khối/Nghiệp vụ'
    });
    return opts;
  }, [effectiveScopeBoPhanList, cap1List]);

  const selectedKhoiKeys = useMemo(() => {
    const current = dimFilters.khoi_nghiep_vu;
    const allKeys = optionsKhoi.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.khoi_nghiep_vu, optionsKhoi]);

  // 6. Thương hiệu / Phòng / Bộ phận Options (Tham chiếu danh mục bộ phận tạo riêng của Đơn vị hoặc fallback mẫu chung)
  const optionsBoPhan = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const opts: Array<{ key: string; label: string; subLabel?: string }> = [];
    const seen = new Set<string>();

    if (effectiveScopeBoPhanList && effectiveScopeBoPhanList.length > 0) {
      effectiveScopeBoPhanList.forEach(b => {
        const matchKhoi = b.ma_cap1 && selectedKhoiKeys.has(b.ma_cap1);
        if (matchKhoi) {
          const key = String(b.id);
          if (!seen.has(key)) {
            seen.add(key);
            opts.push({
              key,
              label: `${b.ten_cap2} (${b.ma_cap2})`,
              subLabel: b.ten_cap1
            });
          }
        }
      });
    }

    if (opts.length === 0 && cap2List) {
      cap2List.forEach(c => {
        if (c.active === false) return;
        const key = String(c.id || c.ma);
        if (!seen.has(key)) {
          seen.add(key);
          opts.push({
            key,
            label: c.ten,
            subLabel: c.ma
          });
        }
      });
    }

    opts.push({
      key: 'NO_CAP2',
      label: '(Chưa phân loại Thương hiệu)',
      subLabel: 'Phân bổ chưa gán Thương hiệu/Phòng/Bộ phận'
    });
    return opts;
  }, [effectiveScopeBoPhanList, cap2List, selectedKhoiKeys]);

  const selectedBoPhanKeys = useMemo(() => {
    const current = dimFilters.thuong_hieu_bo_phan;
    const allKeys = optionsBoPhan.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.thuong_hieu_bo_phan, optionsBoPhan]);

  // 7. Pháp nhân Options (Lựa chọn cuối cùng, phụ thuộc pháp nhân có ở Đơn vị và Showroom)
  const optionsPhapNhan = useMemo((): Array<{ key: string; label: string; subLabel?: string }> => {
    const filteredPn = phapNhanList.filter(pn => {
      if (!pn.id_don_vi) return true;
      const ids = String(pn.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
      return ids.some(id => inScopeUnitIds.has(id));
    });
    const opts: Array<{ key: string; label: string; subLabel?: string }> = filteredPn.map(pn => ({
      key: String(pn.id),
      label: pn.ten_cong_ty || pn.ten_phap_nhan || 'Chưa đặt tên',
      subLabel: pn.ma_so_thue ? `MST: ${pn.ma_so_thue}` : undefined
    }));
    opts.push({
      key: 'NO_PN',
      label: '(Chưa gán Pháp nhân)',
      subLabel: 'Phiếu chưa gán pháp nhân'
    });
    return opts;
  }, [phapNhanList, inScopeUnitIds]);

  const selectedPhapNhanKeys = useMemo(() => {
    const current = dimFilters.phap_nhan;
    const allKeys = optionsPhapNhan.map(o => o.key);
    if (!current) return new Set(allKeys);
    const validSet = new Set(allKeys);
    const res = new Set<string>();
    current.forEach(k => {
      if (validSet.has(k)) res.add(k);
    });
    return res;
  }, [dimFilters.phap_nhan, optionsPhapNhan]);

  // --- C. HÀM TIỆN ÍCH TRUY XUẤT THEO CHIỀU PHÂN TÍCH ---
  const getDimensionOptions = (dimId: DimensionType): Array<{ key: string; label: string; subLabel?: string }> => {
    switch (dimId) {
      case 'phia': return optionsPhia;
      case 'don_vi': return optionsDonVi;
      case 'loai_hinh': return optionsLoaiHinh;
      case 'showroom': return optionsShowroom;
      case 'khoi_nghiep_vu': return optionsKhoi;
      case 'thuong_hieu_bo_phan': return optionsBoPhan;
      case 'phap_nhan': return optionsPhapNhan;
      default: return [];
    }
  };

  const getDimensionSelectedKeys = (dimId: DimensionType): Set<string> => {
    switch (dimId) {
      case 'phia': return selectedPhiaKeys;
      case 'don_vi': return selectedDonViKeys;
      case 'loai_hinh': return selectedLoaiHinhKeys;
      case 'showroom': return selectedShowroomKeys;
      case 'khoi_nghiep_vu': return selectedKhoiKeys;
      case 'thuong_hieu_bo_phan': return selectedBoPhanKeys;
      case 'phap_nhan': return selectedPhapNhanKeys;
      default: return new Set<string>();
    }
  };

  const handleToggleDimFilter = (dimId: DimensionType, key: string) => {
    const curSelected = getDimensionSelectedKeys(dimId);
    const next = new Set(curSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDimFilters(prev => ({ ...prev, [dimId]: next }));
  };

  const handleSelectAllDim = (dimId: DimensionType) => {
    const opts = getDimensionOptions(dimId);
    setDimFilters(prev => ({ ...prev, [dimId]: new Set(opts.map(o => o.key)) }));
  };

  const handleClearAllDim = (dimId: DimensionType) => {
    setDimFilters(prev => ({ ...prev, [dimId]: new Set() }));
  };

  const handleDimensionButtonClick = (dimId: DimensionType) => {
    setDimension(dimId);
    if (openDropdownDim === dimId) {
      setOpenDropdownDim(null);
    } else {
      setOpenDropdownDim(dimId);
      setFilterSearchTerm('');
    }
  };

  // --- D. HÀM TRÍCH XUẤT NHÃN CHIỀU PHÂN TÍCH (SINGLE DIMENSION) ---
  const getDimensionKeyAndLabel = (
    donViId?: string,
    phapNhanId?: string,
    maSoThue?: string,
    cap1Id?: string,
    cap2Id?: string,
    idBoPhan?: string
  ): { key: string; label: string } => {
    const dv = donViId ? donViMap.get(String(donViId)) : null;

    if (dimension === 'phia') {
      const phiaVal = normalizePhia(dv?.phia);
      return { key: phiaVal, label: phiaVal };
    }

    if (dimension === 'don_vi') {
      if (!dv) return { key: 'UNKNOWN', label: 'Không xác định đơn vị' };
      const parentId = getParentUnitId(dv);
      const parent = donViMap.get(parentId);
      return { key: parentId, label: parent ? parent.ten_don_vi : dv.ten_don_vi };
    }

    if (dimension === 'loai_hinh') {
      const lh = normalizeLoaiHinh(dv);
      return { key: lh, label: lh };
    }

    if (dimension === 'showroom') {
      if (!dv) return { key: 'UNKNOWN', label: 'Không xác định đơn vị' };
      return { key: String(dv.id), label: dv.ten_don_vi };
    }

    if (dimension === 'khoi_nghiep_vu') {
      let c1Id = cap1Id;
      if (!c1Id && idBoPhan) {
        const bp = boPhanList?.find(b => String(b.id) === String(idBoPhan));
        if (bp?.ma_cap1) c1Id = bp.ma_cap1;
      }
      if (!c1Id) return { key: 'NO_CAP1', label: '(Chưa phân loại Khối)' };
      const c1 = cap1Map.get(String(c1Id));
      const opt = optionsKhoi.find(o => o.key === c1Id);
      return { key: String(c1Id), label: c1 ? c1.ten : (opt ? opt.label : `Khối: ${c1Id}`) };
    }

    if (dimension === 'thuong_hieu_bo_phan') {
      if (idBoPhan) {
        const bp = boPhanList?.find(b => String(b.id) === String(idBoPhan));
        if (bp) return { key: String(bp.id), label: `${bp.ten_cap2} (${bp.ma_cap2})` };
      }
      if (cap2Id) {
        const bp = boPhanList?.find(b => b.ma_cap2 === cap2Id || String(b.id) === String(cap2Id));
        if (bp) return { key: String(bp.id), label: `${bp.ten_cap2} (${bp.ma_cap2})` };
        const c2 = cap2Map.get(String(cap2Id));
        return { key: String(cap2Id), label: c2 ? `${c2.ten} (${c2.ma})` : `Thương hiệu: ${cap2Id}` };
      }
      return { key: 'NO_CAP2', label: '(Chưa phân loại Thương hiệu)' };
    }

    if (dimension === 'phap_nhan') {
      let pn = phapNhanId ? phapNhanMap.get(String(phapNhanId)) : null;
      let mst = (maSoThue || pn?.ma_so_thue || '').trim();
      let repName = pn?.ten_cong_ty || pn?.ten_phap_nhan || '';

      if (!repName && mst) {
        repName = mstRepresentativeMap.get(mst) || '';
      }

      if (!mst && !repName && !pn) return { key: 'NO_PN', label: '(Chưa gán Pháp nhân)' };
      const key = pn ? String(pn.id) : (mst || repName);
      const label = repName && mst ? `${repName} (MST: ${mst})` : (repName || `MST: ${mst}`);
      return { key, label };
    }

    return { key: 'OTHER', label: 'Khác' };
  };

  // --- E. TỔNG HỢP DỮ LIỆU BÁO CÁO (KỲ NÀY & CÙNG KỲ NĂM TRƯỚC) ---
  const reportData = useMemo(() => {
    // Aggregator maps: key -> { label, currentAmount, prevAmount }
    const aggMap = new Map<string, { key: string; label: string; currentAmount: number; prevAmount: number }>();

    const getOrCreate = (key: string, label: string) => {
      let item = aggMap.get(key);
      if (!item) {
        item = { key, label, currentAmount: 0, prevAmount: 0 };
        aggMap.set(key, item);
      }
      return item;
    };

    // DNTT Map để tra cứu thông tin phiếu
    const dnttMap = new Map(dnttList.map(d => [String(d.id), d]));

    // Hàm kiểm tra một phân bổ có thỏa mãn cả 7 chiều lọc hay không
    const matchFilters = (
      unitId?: string,
      phapNhanId?: string,
      boPhanId?: string,
      cap1Id?: string,
      cap2Id?: string
    ): boolean => {
      const dv = unitId ? donViMap.get(String(unitId)) : null;
      const phiaVal = normalizePhia(dv?.phia);
      const parentUnitId = getParentUnitId(dv);
      const loaiHinhVal = normalizeLoaiHinh(dv);
      const isShowroom = isShowroomUnit(dv);

      // 1. Phía
      if (!selectedPhiaKeys.has(phiaVal)) return false;

      // 2. Đơn vị
      if (optionsDonVi.length > 0 && !selectedDonViKeys.has(parentUnitId) && !selectedDonViKeys.has(String(dv?.id))) {
        return false;
      }

      // 3. Loại hình
      if (!selectedLoaiHinhKeys.has(loaiHinhVal)) return false;

      // 4. Showroom
      if (isShowroom && optionsShowroom.length > 0) {
        if (!selectedShowroomKeys.has(String(dv?.id))) return false;
      }

      // 5. Khối/Nghiệp vụ
      const bp = boPhanId ? boPhanList?.find(b => String(b.id) === String(boPhanId)) : null;
      const c1Key = cap1Id || bp?.ma_cap1 || 'NO_CAP1';
      if (!selectedKhoiKeys.has(c1Key)) return false;

      // 6. Thương hiệu / Phòng / Bộ phận
      const bpKey = boPhanId ? String(boPhanId) : (bp?.id ? String(bp.id) : (cap2Id ? String(cap2Id) : 'NO_CAP2'));
      const cap2Key = cap2Id ? String(cap2Id) : undefined;
      const matchBoPhan = selectedBoPhanKeys.has(bpKey) || (cap2Key ? selectedBoPhanKeys.has(cap2Key) : false);
      if (!matchBoPhan) return false;

      // 7. Pháp nhân
      const pnKey = phapNhanId ? String(phapNhanId) : 'NO_PN';
      if (!selectedPhapNhanKeys.has(pnKey)) return false;

      return true;
    };

    // --- 1. KỲ NÀY (selectedYear) ---
    currentPeriodMonths.forEach(m => {
      const activeAllocations = phanBoList.filter(pb => {
        if (Number(pb.nam) !== selectedYear || Number(pb.thang) !== m) return false;
        if (selectedKmpId !== 'ALL' && String(pb.id_kmp) !== String(selectedKmpId)) return false;

        if (onlyAdministrative) {
          const kmp = kmpMap.get(String(pb.id_kmp));
          if (kmp && kmp.thuoc_bao_cao_hanh_chinh === false) return false;
        }

        const dntt = dnttMap.get(String(pb.dntt_id));
        if (!dntt || dntt.trang_thai === 'Từ chối' || dntt.trang_thai === 'Lưu nháp') return false;

        const matchUnitScope = !allowedUnitIds || (dntt.id_don_vi && allowedUnitIds.has(String(dntt.id_don_vi)));
        if (!matchUnitScope) return false;

        return matchFilters(
          dntt.id_don_vi,
          dntt.id_phap_nhan,
          pb.id_bo_phan,
          pb.id_bo_phan_cap1,
          pb.id_bo_phan_cap2
        );
      });

      activeAllocations.forEach(pb => {
        const dntt = dnttMap.get(String(pb.dntt_id));
        const { key, label } = getDimensionKeyAndLabel(
          dntt?.id_don_vi,
          dntt?.id_phap_nhan,
          undefined,
          pb.id_bo_phan_cap1,
          pb.id_bo_phan_cap2,
          pb.id_bo_phan
        );
        const item = getOrCreate(key, label);
        item.currentAmount += Number(pb.so_tien || 0);
      });
    });

    // --- 2. CÙNG KỲ NĂM TRƯỚC (selectedYear - 1) ---
    const prevYear = selectedYear - 1;
    let prevPhanBoFound = false;

    prevPeriodMonths.forEach(m => {
      const activeAllocations = phanBoList.filter(pb => {
        if (Number(pb.nam) !== prevYear || Number(pb.thang) !== m) return false;
        if (selectedKmpId !== 'ALL' && String(pb.id_kmp) !== String(selectedKmpId)) return false;

        if (onlyAdministrative) {
          const kmp = kmpMap.get(String(pb.id_kmp));
          if (kmp && kmp.thuoc_bao_cao_hanh_chinh === false) return false;
        }

        const dntt = dnttMap.get(String(pb.dntt_id));
        if (!dntt || dntt.trang_thai === 'Từ chối' || dntt.trang_thai === 'Lưu nháp') return false;

        const matchUnitScope = !allowedUnitIds || (dntt.id_don_vi && allowedUnitIds.has(String(dntt.id_don_vi)));
        if (!matchUnitScope) return false;

        return matchFilters(
          dntt.id_don_vi,
          dntt.id_phap_nhan,
          pb.id_bo_phan,
          pb.id_bo_phan_cap1,
          pb.id_bo_phan_cap2
        );
      });

      if (activeAllocations.length > 0) {
        prevPhanBoFound = true;
        activeAllocations.forEach(pb => {
          const dntt = dnttMap.get(String(pb.dntt_id));
          const { key, label } = getDimensionKeyAndLabel(
            dntt?.id_don_vi,
            dntt?.id_phap_nhan,
            undefined,
            pb.id_bo_phan_cap1,
            pb.id_bo_phan_cap2,
            pb.id_bo_phan
          );
          const item = getOrCreate(key, label);
          item.prevAmount += Number(pb.so_tien || 0);
        });
      }
    });

    // Fallback nếu năm trước chưa có phiếu trong phanBoList (dữ liệu snapshot cũ)
    if (!prevPhanBoFound && thongKeList.length > 0) {
      prevPeriodMonths.forEach(m => {
        const records = thongKeList.filter(tk => {
          const matchTime = Number(tk.nam) === prevYear && Number(tk.thang) === m;
          const matchKmp = selectedKmpId === 'ALL' || String(tk.id_kmp) === String(selectedKmpId);
          const matchUnitScope = !allowedUnitIds || (tk.id_don_vi && allowedUnitIds.has(String(tk.id_don_vi)));
          if (onlyAdministrative) {
            const kmp = kmpMap.get(String(tk.id_kmp));
            const isCpAdmin = tk.thuoc_bao_cao_hanh_chinh !== false && (kmp ? kmp.thuoc_bao_cao_hanh_chinh !== false : true);
            if (!isCpAdmin) return false;
          }
          if (!matchTime || !matchKmp || !matchUnitScope) return false;

          const bp = tk.id_bo_phan ? boPhanList?.find(b => String(b.id) === String(tk.id_bo_phan)) : null;
          return matchFilters(
            tk.id_don_vi,
            tk.id_phap_nhan,
            tk.id_bo_phan,
            bp?.ma_cap1,
            bp?.ma_cap2
          );
        });

        records.forEach(tk => {
          const bp = tk.id_bo_phan ? boPhanList?.find(b => String(b.id) === String(tk.id_bo_phan)) : null;
          const cap1Id = bp?.ma_cap1;
          const cap2Id = bp?.ma_cap2;

          const { key, label } = getDimensionKeyAndLabel(
            tk.id_don_vi,
            tk.id_phap_nhan,
            tk.ma_so_thue,
            cap1Id,
            cap2Id,
            tk.id_bo_phan
          );
          const item = getOrCreate(key, label);
          item.prevAmount += Number(tk.tong_tien || 0);
        });
      });
    }

    // Chuyển map thành mảng và tính toán chênh lệch, sắp xếp giảm dần theo số tiền kỳ này
    const rows = Array.from(aggMap.values())
      .filter(r => r.currentAmount > 0 || r.prevAmount > 0)
      .map(r => {
        const diff = r.currentAmount - r.prevAmount;
        let percent: number | null = null;
        if (r.prevAmount > 0) {
          percent = (diff / r.prevAmount) * 100;
        } else {
          percent = null;
        }
        return { ...r, diff, percent };
      })
      .sort((a, b) => b.currentAmount - a.currentAmount);

    // Lọc theo đối tượng được tick chọn trong chiều phân tích hiện tại
    const activeSelectedKeys = getDimensionSelectedKeys(dimension);
    const filteredRows = rows.filter(r => activeSelectedKeys.has(r.key));

    const totalCurrent = filteredRows.reduce((s, r) => s + r.currentAmount, 0);
    const totalPrev = filteredRows.reduce((s, r) => s + r.prevAmount, 0);
    const totalDiff = totalCurrent - totalPrev;
    const totalPercent = totalPrev > 0 ? (totalDiff / totalPrev) * 100 : null;

    return {
      rows: filteredRows,
      totalCurrent,
      totalPrev,
      totalDiff,
      totalPercent
    };
  }, [
    currentPeriodMonths,
    prevPeriodMonths,
    selectedYear,
    selectedKmpId,
    closedMonthsCurrentPeriod,
    thongKeList,
    phanBoList,
    dnttList,
    dimension,
    donViMap,
    phapNhanMap,
    mstRepresentativeMap,
    boPhanList,
    cap1Map,
    cap2Map,
    chotKyList,
    includeTemporary,
    onlyAdministrative,
    kmpMap,
    allowedUnitIds,
    selectedPhiaKeys,
    selectedDonViKeys,
    selectedLoaiHinhKeys,
    selectedShowroomKeys,
    selectedKhoiKeys,
    selectedBoPhanKeys,
    selectedPhapNhanKeys,
    optionsDonVi.length,
    optionsShowroom.length
  ]);

  // 6. XỬ LÝ CHỐT KỲ MỚI
  const handleCreateChotKy = async () => {
    if (!newChotThang || !newChotNam) {
      toast.warning('Vui lòng chọn đầy đủ Tháng và Năm cần chốt kỳ!');
      return;
    }

    if (!canLock) {
      toast.error('Bạn không có quyền CHỐT KỲ chi phí!');
      return;
    }

    setChotKySubmitting(true);
    try {
      const res = await apiService.chotKyChiPhi(
        newChotThang,
        newChotNam,
        user?.ho_ten || user?.email || 'Quản trị viên',
        newChotGhiChu,
        currentScopeInfo.scopeUnitId,
        currentScopeInfo.scopeUnitName,
        currentScopeInfo.affectedUnitIds
      );
      toast.success(`Chốt kỳ Tháng ${newChotThang}/${newChotNam} cho "${currentScopeInfo.scopeUnitName}" thành công! Đã snapshot ${res.so_dong_snapshot} dòng thống kê.`);
      setNewChotGhiChu('');
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi chốt kỳ!');
    } finally {
      setChotKySubmitting(false);
    }
  };

  // 7. XỬ LÝ HỦY CHỐT KỲ
  const handleRevokeChotKy = async (chotKyId: string) => {
    if (!canLock) {
      toast.error('Bạn không có quyền HỦY CHỐT KỲ chi phí!');
      return;
    }

    setChotKySubmitting(true);
    try {
      await apiService.huyChotKyChiPhi(chotKyId, user?.ho_ten || user?.email || 'Quản trị viên');
      toast.success('Đã hủy chốt kỳ thành công! Dữ liệu DNTT trong kỳ đã được mở khóa.');
      setRevokeConfirmId(null);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi hủy chốt kỳ!');
    } finally {
      setChotKySubmitting(false);
    }
  };

  // 7.1 XỬ LÝ MỞ KHÓA KỲ CHỐT (THEO BỘ LỌC ĐANG XEM / TOÀN BỘ HỆ THỐNG / CÂY ĐƠN VỊ PHÂN CẤP)
  const handleUnlockSubmit = async () => {
    if (!unitUnlockModalOpen) return;

    if (unlockMode === 'TREE_SELECT' && selectedUnitsToUnlock.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 đơn vị cần mở khóa từ cây đơn vị!');
      return;
    }

    if (unlockHasDeadline && !unlockDeadline) {
      toast.warning('Vui lòng chọn ngày giờ hạn chót gia hạn!');
      return;
    }

    setUnitUnlockSubmitting(true);
    try {
      const deadlineValue = unlockHasDeadline ? new Date(unlockDeadline).toISOString() : null;
      const userName = user?.ho_ten || user?.user_name || 'Admin';

      if (unlockMode === 'ALL_SYSTEM') {
        // Mở khóa toàn quốc
        await apiService.moKhoaToanBoDonViChotKy(
          unitUnlockModalOpen.id,
          userName,
          deadlineValue,
          unitUnlockReason
        );
        toast.success('Đã mở khóa TOÀN BỘ hệ thống cho kỳ chốt này thành công!');
      } else if (unlockMode === 'CURRENT_FILTER') {
        if (currentScopeInfo.scopeUnitId === 'ALL' || !unitUnlockModalOpen.id_don_vi || unitUnlockModalOpen.id_don_vi === 'ALL') {
          // Mở khóa toàn quốc
          await apiService.moKhoaToanBoDonViChotKy(
            unitUnlockModalOpen.id,
            userName,
            deadlineValue,
            unitUnlockReason
          );
          toast.success('Đã mở khóa TOÀN BỘ hệ thống cho kỳ chốt này thành công!');
        } else {
          // Mở khóa các đơn vị thuộc bộ lọc hiện tại
          const unitIds = currentScopeInfo.affectedUnitIds || [];
          await apiService.moKhoaHangLoatDonViChotKy(
            unitUnlockModalOpen.id,
            unitIds,
            userName,
            deadlineValue,
            unitUnlockReason
          );
          toast.success(`Đã mở khóa thành công cho ${unitIds.length} đơn vị thuộc ${currentScopeInfo.scopeUnitName}!`);
        }
      } else {
        // unlockMode === 'TREE_SELECT'
        const allUnits = fullDonViList && fullDonViList.length > 0 ? fullDonViList : donViList;
        if (selectedUnitsToUnlock.length >= allUnits.length) {
          await apiService.moKhoaToanBoDonViChotKy(
            unitUnlockModalOpen.id,
            userName,
            deadlineValue,
            unitUnlockReason
          );
          toast.success('Đã mở khóa TOÀN BỘ hệ thống cho kỳ chốt này thành công!');
        } else {
          await apiService.moKhoaHangLoatDonViChotKy(
            unitUnlockModalOpen.id,
            selectedUnitsToUnlock,
            userName,
            deadlineValue,
            unitUnlockReason
          );
          toast.success(`Đã mở khóa thành công cho ${selectedUnitsToUnlock.length} đơn vị đã chọn!`);
        }
      }

      setUnitUnlockModalOpen(null);
      setSelectedUnitsToUnlock([]);
      setExpandedUnitTreeParents([]);
      setUnitUnlockReason('');
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi mở khóa kỳ chốt');
    } finally {
      setUnitUnlockSubmitting(false);
    }
  };

  // 7.2 KHÓA LẠI ĐƠN VỊ CỤ THỂ VÀ ĐỒNG BỘ SNAPSHOT
  const handleRelockUnitInPeriod = async (chotKyId: string, unitId: string) => {
    setChotKySubmitting(true);
    try {
      await apiService.khoaLaiDonViChotKy(
        chotKyId,
        unitId,
        user?.ho_ten || user?.user_name || 'Admin'
      );
      toast.success('Đã khóa lại đơn vị và đồng bộ snapshot thống kê thành công!');
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khóa lại đơn vị');
    } finally {
      setChotKySubmitting(false);
    }
  };

  // 7.3 KHÓA LẠI TOÀN BỘ VÀ ĐỒNG BỘ SNAPSHOT (1-CLICK RELOCK)
  const handleRelockAllInPeriod = async (chotKyId: string) => {
    setChotKySubmitting(true);
    try {
      const res = await apiService.khoaLaiToanBoChotKy(
        chotKyId,
        user?.ho_ten || user?.user_name || 'Admin'
      );
      toast.success(`Đã khóa lại toàn bộ kỳ chốt và đồng bộ snapshot thành công (${res.so_dong_snapshot} dòng)!`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khóa lại toàn bộ');
    } finally {
      setChotKySubmitting(false);
    }
  };

  // 7.4 LƯU CẬP NHẬT GIA HẠN THỜI GIAN
  const handleSaveExtension = async () => {
    if (!extensionModalOpen) return;
    if (extensionHasDeadline && !extensionDeadline) {
      toast.warning('Vui lòng chọn ngày giờ hạn chót gia hạn!');
      return;
    }

    setExtensionSubmitting(true);
    try {
      const deadlineValue = extensionHasDeadline ? new Date(extensionDeadline).toISOString() : null;
      await apiService.giaHanThoiGianChotKy(
        extensionModalOpen.id,
        deadlineValue,
        user?.ho_ten || user?.user_name || 'Admin',
        extensionReason
      );
      toast.success(deadlineValue ? 'Đã cập nhật thời hạn gia hạn kỳ chốt!' : 'Đã chuyển sang mở khóa vô thời hạn!');
      setExtensionModalOpen(null);
      setExtensionDeadline('');
      setExtensionReason('');
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gia hạn thời gian');
    } finally {
      setExtensionSubmitting(false);
    }
  };

  // 7.3 ĐỒNG BỘ LẠI SNAPSHOT THỐNG KÊ TỪ DNTT
  const handleSyncSnapshot = async (chotKyId: string) => {
    setSyncingSnapshotId(chotKyId);
    try {
      const res = await apiService.dongBoSnapshotChotKy(
        chotKyId,
        user?.ho_ten || user?.user_name || 'Admin'
      );
      toast.success(`Đã cập nhật lại snapshot! Đồng bộ thành công ${res.so_dong_snapshot} dòng số liệu.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đồng bộ snapshot');
    } finally {
      setSyncingSnapshotId(null);
    }
  };

  // 8. XUẤT BÁO CÁO EXCEL CHUẨN ĐỊNH DẠNG XML SPREADSHEET (MỞ TRỰC TIẾP TRÊN EXCEL)
  const handleExportExcel = () => {
    if (reportData.rows.length === 0) {
      toast.warning('Không có dữ liệu báo cáo để xuất file!');
      return;
    }

    const dimensionTitleMap: Record<DimensionType, string> = {
      phia: 'Phía',
      don_vi: 'Đơn vị',
      loai_hinh: 'Loại hình',
      showroom: 'Showroom',
      khoi_nghiep_vu: 'Khối/Nghiệp vụ',
      thuong_hieu_bo_phan: 'Thương hiệu / Phòng / Bộ phận',
      phap_nhan: 'Pháp nhân'
    };

    const dimTitle = dimensionTitleMap[dimension];
    const kmpName = selectedKmpId === 'ALL'
      ? 'Tất cả Khoản mục phí'
      : (() => {
          const k = kmpMap.get(selectedKmpId);
          if (!k) return selectedKmpId;
          const code = (k.ma_b7 || k.ma_b10 || '').trim();
          const name = (k.dien_giai || k.nhom_chi_phi || '').trim();
          return code ? `${code} - ${name}` : name;
        })();

    const escapeXML = (str: any) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const rowsXML = reportData.rows.map((r, idx) => `
      <Row>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
        <Cell ss:StyleID="sText"><Data ss:Type="String">${escapeXML(r.label)}</Data></Cell>
        <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${r.currentAmount}</Data></Cell>
        <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${r.prevAmount}</Data></Cell>
        <Cell ss:StyleID="${r.diff >= 0 ? 'sNumberDiffPos' : 'sNumberDiffNeg'}"><Data ss:Type="Number">${r.diff}</Data></Cell>
        ${r.percent !== null 
          ? `<Cell ss:StyleID="sPercent"><Data ss:Type="Number">${(r.percent / 100).toFixed(4)}</Data></Cell>` 
          : `<Cell ss:StyleID="sCenter"><Data ss:Type="String">—</Data></Cell>`}
      </Row>
    `).join('');

    const totalRowXML = `
      <Row ss:Height="24">
        <Cell ss:StyleID="sTotalCenter"><Data ss:Type="String">TỔNG</Data></Cell>
        <Cell ss:StyleID="sTotalText"><Data ss:Type="String">TỔNG CỘNG TOÀN BỘ</Data></Cell>
        <Cell ss:StyleID="sTotalNumber"><Data ss:Type="Number">${reportData.totalCurrent}</Data></Cell>
        <Cell ss:StyleID="sTotalNumber"><Data ss:Type="Number">${reportData.totalPrev}</Data></Cell>
        <Cell ss:StyleID="sTotalNumber"><Data ss:Type="Number">${reportData.totalDiff}</Data></Cell>
        ${reportData.totalPercent !== null 
          ? `<Cell ss:StyleID="sTotalPercent"><Data ss:Type="Number">${(reportData.totalPercent / 100).toFixed(4)}</Data></Cell>` 
          : `<Cell ss:StyleID="sTotalCenter"><Data ss:Type="String">—</Data></Cell>`}
      </Row>
    `;

    const excelTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#D97706"/>
  </Style>
  <Style ss:ID="sSubTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#4B5563"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#D97706" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
   </Borders>
  </Style>
  <Style ss:ID="sText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumberDiffPos">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:Color="#B45309" ss:Bold="1"/>
   <NumberFormat ss:Format="+#,##0;-#,##0;0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumberDiffNeg">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:Color="#059669" ss:Bold="1"/>
   <NumberFormat ss:Format="+#,##0;-#,##0;0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0%"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <NumberFormat ss:Format="#,##0"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <NumberFormat ss:Format="0.0%"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="ThongKeChiPhi">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="260"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="5" ss:StyleID="sTitle"><Data ss:Type="String">BÁO CÁO THỐNG KÊ VÀ ĐỐI SÁNH CHI PHÍ</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="5" ss:StyleID="sSubTitle"><Data ss:Type="String">Kỳ báo cáo: ${escapeXML(periodLabel)} | So sánh với: ${escapeXML(prevPeriodLabel)} | Tiêu chí: ${escapeXML(dimTitle)} | KMP: ${escapeXML(kmpName)}</Data></Cell>
   </Row>
   <Row ss:Index="4" ss:Height="26">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">TT</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXML(dimTitle)}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Kỳ này (VNĐ)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Cùng kỳ năm trước (VNĐ)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Chênh lệch (VNĐ)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">% Tăng/Giảm</Data></Cell>
   </Row>
   ${rowsXML}
   ${totalRowXML}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Thong_Ke_Chi_Phi_${periodLabel.replace(/[\/\s]/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải file Excel Báo cáo Thống kê thành công!');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {currentSubTab === 'dashboard' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <CostDashboardTab
            dnttList={dnttList}
            phanBoList={phanBoList}
            kmpList={kmpList}
            boPhanList={boPhanList}
            cap1List={cap1List}
            cap2List={cap2List}
            donViList={donViList}
            selectedUnitFilter={selectedUnitFilter}
            onRefresh={onRefresh}
            loading={loading}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <CostPivotView
            year={selectedYear}
            onYearChange={setSelectedYear}
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
            onToggleIncludeTemporary={setIncludeTemporary}
            onlyAdministrative={onlyAdministrative}
            onToggleOnlyAdministrative={setOnlyAdministrative}
            onOpenChotKyModal={canLock ? () => setChotKyModalOpen(true) : undefined}
          />
        </div>
      )}

      {/* 4. MODAL QUẢN LÝ CHỐT KỲ (CHO PHÉP ADMIN HOẶC TÀI KHOẢN ĐƯỢC PHÂN QUYỀN CAN_LOCK_PERIOD) */}
      {chotKyModalOpen && canLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-3xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[#D97706] flex items-center justify-center">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Quản lý Chốt kỳ Chi phí</h3>
                  <p className="text-xs text-gray-500">Đóng băng số liệu báo cáo & Khóa an toàn các phiếu ĐNTT trong kỳ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChotKyModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-1">
              {/* Thông tin phạm vi áp dụng */}
              <div className="p-3 bg-blue-50/80 dark:bg-slate-700/50 rounded-xl border border-blue-200 dark:border-slate-600 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-xs text-[#05469B] dark:text-blue-300">
                  <Building size={14} />
                  <span>Phạm vi áp dụng: <strong>{currentScopeInfo.scopeUnitName}</strong></span>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  {currentScopeInfo.scopeUnitId === 'ALL'
                    ? '🌐 Chốt kỳ sẽ áp dụng trên TOÀN BỘ hệ thống (HO & tất cả Công ty tỉnh thành, Showroom toàn quốc).'
                    : `🏢 Thao tác chốt kỳ này sẽ đóng băng các phiếu ĐNTT của ${currentScopeInfo.scopeUnitName} và ${currentScopeInfo.subCount} đơn vị/showroom trực thuộc. Các Công ty tỉnh thành khác không bị ảnh hưởng và vẫn làm việc bình thường.`}
                </p>
              </div>

              {/* Form Chốt kỳ mới */}
              <div className="p-4 bg-amber-50/60 dark:bg-slate-700/50 rounded-xl border border-amber-200 dark:border-slate-600 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D97706] flex items-center gap-1.5">
                  <ShieldAlert size={15} />
                  <span>Chốt số liệu kỳ kế toán mới</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Tháng</label>
                    <select
                      value={newChotThang}
                      onChange={(e) => setNewChotThang(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Năm</label>
                    <select
                      value={newChotNam}
                      onChange={(e) => setNewChotNam(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                        <option key={y} value={y}>Năm {y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Ghi chú kỳ chốt</label>
                    <input
                      type="text"
                      value={newChotGhiChu}
                      onChange={(e) => setNewChotGhiChu(e.target.value)}
                      placeholder="VD: Chốt số liệu sau kiểm toán T8"
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleCreateChotKy}
                    disabled={chotKySubmitting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Lock size={14} />
                    <span>{chotKySubmitting ? 'Đang thực hiện snapshot...' : 'Chốt số liệu kỳ này'}</span>
                  </button>
                </div>
              </div>

              {/* Danh sách các kỳ đã chốt */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between">
                  <span>Lịch sử các kỳ đã chốt ({chotKyList.filter(c => c.trang_thai === 'da_chot').length} kỳ đang hiệu lực)</span>
                </h4>

                <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-slate-600">
                      <tr>
                        <th className="p-2.5">Kỳ (Tháng/Năm)</th>
                        <th className="p-2.5">Đơn vị áp dụng</th>
                        <th className="p-2.5">Ngoại lệ Mở khóa ĐV</th>
                        <th className="p-2.5">Trạng thái</th>
                        <th className="p-2.5">Người chốt</th>
                        <th className="p-2.5">Thời gian</th>
                        <th className="p-2.5">Ghi chú</th>
                        <th className="p-2.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {chotKyList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-gray-400 text-xs">
                            Chưa có kỳ nào được chốt trong hệ thống.
                          </td>
                        </tr>
                      ) : (
                        chotKyList.map(ck => (
                          <tr key={ck.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                            <td className="p-2.5 font-bold text-[#D97706] font-mono whitespace-nowrap">
                              Tháng {ck.thang}/{ck.nam}
                            </td>
                            <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-200">
                              <span className="inline-flex items-center gap-1">
                                {ck.id_don_vi === 'ALL' || !ck.id_don_vi ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    🌐 Toàn quốc
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    🏢 {ck.ten_don_vi || ck.id_don_vi}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {ck.trang_thai === 'da_chot' ? (
                                <div className="space-y-1.5">
                                  {/* TRƯỜNG HỢP 1: ĐANG MỞ KHÓA TOÀN BỘ */}
                                  {ck.mo_khoa_toan_bo ? (
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-900 border border-emerald-300 dark:from-emerald-950/70 dark:to-teal-950/70 dark:text-emerald-200 dark:border-emerald-700 shadow-xs">
                                          <Unlock size={10} className="text-emerald-600 dark:text-emerald-400" />
                                          <span>MỞ TOÀN BỘ ({ck.ten_don_vi || (ck.id_don_vi === 'ALL' ? 'Toàn quốc' : ck.id_don_vi)})</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => openExtensionModal(ck)}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 cursor-pointer transition-colors"
                                          title="Gia hạn thời hạn mở khóa"
                                        >
                                          <Clock size={9} /> Gia hạn
                                        </button>
                                        <button
                                          type="button"
                                          disabled={chotKySubmitting}
                                          onClick={() => handleRelockAllInPeriod(ck.id)}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer transition-colors"
                                          title="Khóa lại toàn bộ & tự động đồng bộ snapshot"
                                        >
                                          <Lock size={9} /> Khóa lại
                                        </button>
                                      </div>
                                      {/* Deadline status */}
                                      {ck.han_mo_khoa ? (
                                        (() => {
                                          const dl = formatDeadlineBadge(ck.han_mo_khoa);
                                          if (!dl) return null;
                                          return (
                                            <div className="flex items-center gap-1">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${dl.badgeClass}`} title={dl.tooltip}>
                                                <Clock size={9} />
                                                <span>{dl.label}</span>
                                              </span>
                                              {dl.isExpired && (
                                                <span className="text-[9px] font-bold text-rose-600 italic">(Đã tự đóng băng)</span>
                                              )}
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 italic block">
                                          Vô thời hạn (cho đến khi Khóa lại)
                                        </span>
                                      )}
                                      {ck.ly_do_mo_khoa && (
                                        <div className="text-[10px] text-gray-500 italic max-w-[220px] truncate" title={ck.ly_do_mo_khoa}>
                                          Lý do: {ck.ly_do_mo_khoa}
                                        </div>
                                      )}
                                    </div>
                                  ) : ck.danh_sach_don_vi_mo_khoa && ck.danh_sach_don_vi_mo_khoa.length > 0 ? (
                                    /* TRƯỜNG HỢP 2: ĐANG MỞ THEO DANH SÁCH ĐƠN VỊ */
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap gap-1 items-center">
                                        {ck.danh_sach_don_vi_mo_khoa.map(uId => {
                                          const u = (fullDonViList || donViList).find(item => String(item.id) === String(uId));
                                          const uName = u ? u.ten_don_vi : uId;
                                          return (
                                            <span key={uId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700">
                                              <Unlock size={9} className="text-amber-600" />
                                              <span className="max-w-[110px] truncate" title={uName}>{uName}</span>
                                              <button
                                                type="button"
                                                disabled={unitUnlockSubmitting}
                                                onClick={() => handleRelockUnitInPeriod(ck.id, uId)}
                                                className="ml-1 text-amber-700 hover:text-red-600 cursor-pointer font-black text-xs leading-none"
                                                title="Khóa lại đơn vị này & tự động cập nhật snapshot"
                                              >
                                                ×
                                              </button>
                                            </span>
                                          );
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => openUnlockModal(ck)}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors cursor-pointer"
                                          title="Admin: Mở khóa thêm đơn vị"
                                        >
                                          <Unlock size={9} /> + Mở ĐV
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openExtensionModal(ck)}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 cursor-pointer transition-colors"
                                          title="Gia hạn thời hạn mở khóa"
                                        >
                                          <Clock size={9} /> Gia hạn
                                        </button>
                                        <button
                                          type="button"
                                          disabled={chotKySubmitting}
                                          onClick={() => handleRelockAllInPeriod(ck.id)}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer transition-colors"
                                          title="Khóa lại toàn bộ & tự động đồng bộ snapshot"
                                        >
                                          <Lock size={9} /> Khóa lại tất cả
                                        </button>
                                      </div>
                                      {/* Deadline status */}
                                      {ck.han_mo_khoa && (
                                        (() => {
                                          const dl = formatDeadlineBadge(ck.han_mo_khoa);
                                          if (!dl) return null;
                                          return (
                                            <div className="flex items-center gap-1">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${dl.badgeClass}`} title={dl.tooltip}>
                                                <Clock size={9} />
                                                <span>{dl.label}</span>
                                              </span>
                                              {dl.isExpired && (
                                                <span className="text-[9px] font-bold text-rose-600 italic">(Đã tự đóng băng)</span>
                                              )}
                                            </div>
                                          );
                                        })()
                                      )}
                                    </div>
                                  ) : (
                                    /* TRƯỜNG HỢP 3: ĐÓNG BĂNG 100% */
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-gray-400 italic text-[11px]">Đóng băng 100%</span>
                                      <button
                                        type="button"
                                        onClick={() => openUnlockModal(ck)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-slate-700 border border-dashed border-amber-300 transition-colors cursor-pointer"
                                        title="Admin: Mở khóa toàn bộ theo bộ lọc hoặc chọn đơn vị cụ thể, kèm gia hạn"
                                      >
                                        <Unlock size={9} /> Mở khóa / Gia hạn
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              {ck.trang_thai === 'da_chot' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                  <Lock size={10} /> Đang chốt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 whitespace-nowrap">
                                  <Unlock size={10} /> Đã hủy chốt
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{ck.chot_boi || '-'}</td>
                            <td className="p-2.5 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                              {ck.chot_luc ? new Date(ck.chot_luc).toLocaleString('vi-VN') : '-'}
                            </td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-400 max-w-[140px] truncate" title={ck.ghi_chu}>
                              {ck.ghi_chu || '-'}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {ck.trang_thai === 'da_chot' && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={syncingSnapshotId === ck.id || chotKySubmitting}
                                    onClick={() => handleSyncSnapshot(ck.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer text-[11px] font-semibold border border-blue-200 dark:border-blue-800"
                                    title="Cập nhật lại toàn bộ Snapshot từ các phiếu DNTT mới nhất sang Thống kê"
                                  >
                                    <RefreshCw size={11} className={syncingSnapshotId === ck.id ? "animate-spin" : ""} />
                                    <span>{syncingSnapshotId === ck.id ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
                                  </button>
                                  {revokeConfirmId === ck.id ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeChotKy(ck.id)}
                                        disabled={chotKySubmitting}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        Xác nhận
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setRevokeConfirmId(null)}
                                        className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 rounded text-[10px] cursor-pointer"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setRevokeConfirmId(ck.id)}
                                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer text-xs font-semibold"
                                      title="Hủy chốt kỳ này (Xóa toàn bộ snapshot và mở lại tất cả DNTT)"
                                    >
                                      Hủy chốt
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setChotKyModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL MỞ KHÓA KỲ CHỐT & THIẾT LẬP GIA HẠN */}
      {unitUnlockModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center gap-2.5 text-gray-800 dark:text-gray-100 font-bold text-sm">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  <Unlock size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Mở khóa Kỳ chốt & Gia hạn Thời gian</h4>
                  <p className="text-[11px] text-gray-500 font-normal">Cấp quyền chỉnh sửa/phân bổ DNTT cho các đơn vị</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setUnitUnlockModalOpen(null); setSelectedUnitsToUnlock([]); setUnitUnlockReason(''); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto custom-scrollbar flex-1">
              {/* Banner thông tin kỳ chốt */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-500">Kỳ chốt số liệu</div>
                  <div className="font-mono font-bold text-[#D97706] text-sm">
                    Tháng {unitUnlockModalOpen.thang}/{unitUnlockModalOpen.nam}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-gray-500">Phạm vi chốt ban đầu</div>
                  <div className="font-semibold text-gray-800 dark:text-gray-200">
                    {unitUnlockModalOpen.ten_don_vi || (unitUnlockModalOpen.id_don_vi === 'ALL' ? '🌐 Toàn quốc' : unitUnlockModalOpen.id_don_vi)}
                  </div>
                </div>
              </div>

              {/* 1. Chọn phạm vi mở khóa */}
              <div className="space-y-2">
                <label className="block font-bold text-gray-700 dark:text-gray-200">
                  1. Chọn phạm vi mở khóa:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Card 1: Bộ lọc đang xem */}
                  <button
                    type="button"
                    onClick={() => setUnlockMode('CURRENT_FILTER')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      unlockMode === 'CURRENT_FILTER'
                        ? 'border-[#D97706] bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-[#D97706]/30 shadow-xs'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                      <Filter size={15} className={unlockMode === 'CURRENT_FILTER' ? 'text-[#D97706]' : 'text-gray-400'} />
                      <span>Theo Bộ lọc ngoài</span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2" title={currentScopeInfo.scopeUnitName}>
                      {currentScopeInfo.scopeUnitId === 'ALL'
                        ? '🌐 Toàn quốc'
                        : `${currentScopeInfo.scopeUnitName} (${currentScopeInfo.affectedUnitIds?.length || 0} ĐV)`}
                    </div>
                  </button>

                  {/* Card 2: Toàn bộ hệ thống */}
                  <button
                    type="button"
                    onClick={() => setUnlockMode('ALL_SYSTEM')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      unlockMode === 'ALL_SYSTEM'
                        ? 'border-[#D97706] bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-[#D97706]/30 shadow-xs'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                      <Globe size={15} className={unlockMode === 'ALL_SYSTEM' ? 'text-[#D97706]' : 'text-gray-400'} />
                      <span>Toàn bộ Hệ thống</span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      🌐 Toàn quốc (Tất cả đơn vị & Showroom)
                    </div>
                  </button>

                  {/* Card 3: Cây Đơn vị Phân cấp */}
                  <button
                    type="button"
                    onClick={() => setUnlockMode('TREE_SELECT')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      unlockMode === 'TREE_SELECT'
                        ? 'border-[#D97706] bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-[#D97706]/30 shadow-xs'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                      <Building size={15} className={unlockMode === 'TREE_SELECT' ? 'text-[#D97706]' : 'text-gray-400'} />
                      <span>Chọn theo Cây Đơn vị</span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Cây phân cấp VPĐH, CTTT & từng Showroom
                    </div>
                  </button>
                </div>
              </div>

              {/* Cây Đơn vị Phân cấp nếu chọn chế độ TREE_SELECT */}
              {unlockMode === 'TREE_SELECT' && (
                <div className="space-y-2.5 p-3.5 bg-gray-50 dark:bg-slate-700/40 rounded-xl border border-gray-200 dark:border-slate-600">
                  {/* Thanh tìm kiếm & chọn tất cả */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        value={unitSearchKeyword}
                        onChange={(e) => setUnitSearchKeyword(e.target.value)}
                        placeholder="Tìm tên hoặc mã đơn vị / showroom..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-[#D97706]"
                      />
                      {unitSearchKeyword && (
                        <button
                          type="button"
                          onClick={() => setUnitSearchKeyword('')}
                          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allAvailableIds = unitTreeData.searchedUnits.map(u => String(u.id));
                        const isAllSelected = allAvailableIds.length > 0 && allAvailableIds.every(id => selectedUnitsToUnlock.includes(id));
                        if (isAllSelected) {
                          setSelectedUnitsToUnlock([]);
                        } else {
                          setSelectedUnitsToUnlock(allAvailableIds);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      {unitTreeData.searchedUnits.length > 0 && unitTreeData.searchedUnits.every(u => selectedUnitsToUnlock.includes(String(u.id)))
                        ? 'Bỏ chọn hết'
                        : 'Chọn tất cả'}
                    </button>
                  </div>

                  {/* Vùng danh sách cây phân cấp */}
                  <div className="max-h-64 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                    {unitTreeData.searchedUnits.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 italic">
                        Không tìm thấy đơn vị nào phù hợp với từ khóa "{unitSearchKeyword}"
                      </div>
                    ) : (
                      <>
                        {[
                          { title: '🏛️ Văn phòng Điều hành (VPĐH)', units: unitTreeData.vpdhUnits },
                          { title: '🏢 Công ty Tỉnh thành Phía Nam', units: unitTreeData.ctttNamUnits },
                          { title: '🏢 Công ty Tỉnh thành Phía Bắc', units: unitTreeData.ctttBacUnits },
                          { title: '📍 Đơn vị khác', units: unitTreeData.otherUnits }
                        ]
                          .filter(group => group.units.length > 0)
                          .map(group => (
                            <div key={group.title} className="space-y-1">
                              <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100/80 dark:bg-slate-800 px-2 py-1 rounded-md flex items-center justify-between">
                                <span>{group.title}</span>
                                <span className="text-[10px] text-gray-400 font-normal">{group.units.length} đơn vị</span>
                              </div>

                              <div className="space-y-1 pl-1">
                                {group.units.map(parent => {
                                  const parentId = String(parent.id);
                                  const children = unitTreeData.getChildren(parentId);
                                  const hasChildren = children.length > 0;
                                  const branchIds = [parentId, ...children.map(c => String(c.id))];
                                  
                                  const isBranchAllSelected = branchIds.every(id => selectedUnitsToUnlock.includes(id));
                                  const isBranchPartiallySelected = !isBranchAllSelected && branchIds.some(id => selectedUnitsToUnlock.includes(id));
                                  const isExpanded = expandedUnitTreeParents.includes(parentId) || !!unitSearchKeyword.trim();

                                  const toggleParentCascade = () => {
                                    if (isBranchAllSelected) {
                                      setSelectedUnitsToUnlock(prev => prev.filter(id => !branchIds.includes(id)));
                                    } else {
                                      setSelectedUnitsToUnlock(prev => {
                                        const set = new Set(prev);
                                        branchIds.forEach(id => set.add(id));
                                        return Array.from(set);
                                      });
                                    }
                                  };

                                  const toggleExpand = () => {
                                    setExpandedUnitTreeParents(prev =>
                                      prev.includes(parentId)
                                        ? prev.filter(id => id !== parentId)
                                        : [...prev, parentId]
                                    );
                                  };

                                  return (
                                    <div key={parentId} className="rounded-lg bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/80 overflow-hidden shadow-2xs">
                                      {/* Header Đơn vị Cha */}
                                      <div className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50/80 dark:hover:bg-slate-700/50 transition-colors">
                                        {/* Nút mở rộng con */}
                                        {hasChildren ? (
                                          <button
                                            type="button"
                                            onClick={toggleExpand}
                                            className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                                            title={isExpanded ? 'Thu gọn' : 'Xem danh sách showroom con'}
                                          >
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                          </button>
                                        ) : (
                                          <span className="w-4" />
                                        )}

                                        {/* Checkbox Đơn vị Cha */}
                                        <input
                                          type="checkbox"
                                          checked={isBranchAllSelected}
                                          ref={el => {
                                            if (el) el.indeterminate = isBranchPartiallySelected;
                                          }}
                                          onChange={toggleParentCascade}
                                          className="rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                                        />

                                        {/* Tên Đơn vị Cha */}
                                        <div
                                          onClick={hasChildren ? toggleExpand : toggleParentCascade}
                                          className="flex-1 flex items-center justify-between gap-1.5 cursor-pointer select-none"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span>{getUnitEmoji(parent)}</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{parent.ten_don_vi}</span>
                                            {parent.ma_don_vi && (
                                              <span className="text-[10px] text-gray-400 font-mono">({parent.ma_don_vi})</span>
                                            )}
                                          </div>
                                          {hasChildren && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-[#D97706] font-medium border border-amber-200/60">
                                              {children.length} showroom
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Danh sách Showroom con */}
                                      {hasChildren && isExpanded && (
                                        <div className="pl-8 pr-2.5 py-1 space-y-1 bg-gray-50/50 dark:bg-slate-900/30 border-t border-gray-100 dark:border-slate-700/60">
                                          {children.map(child => {
                                            const childId = String(child.id);
                                            const isChildChecked = selectedUnitsToUnlock.includes(childId);
                                            return (
                                              <label
                                                key={childId}
                                                className="flex items-center gap-2 py-1 px-1.5 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer transition-colors text-[11px]"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChildChecked}
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setSelectedUnitsToUnlock(prev => {
                                                        const next = [...prev, childId];
                                                        const allChildrenNowChecked = children.every(c => String(c.id) === childId || prev.includes(String(c.id)));
                                                        if (allChildrenNowChecked && !next.includes(parentId)) {
                                                          next.push(parentId);
                                                        }
                                                        return next;
                                                      });
                                                    } else {
                                                      setSelectedUnitsToUnlock(prev =>
                                                        prev.filter(id => id !== childId && id !== parentId)
                                                      );
                                                    }
                                                  }}
                                                  className="rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                                                />
                                                <span className="text-gray-400">🏪</span>
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{child.ten_don_vi}</span>
                                                {child.ma_don_vi && (
                                                  <span className="text-[10px] text-gray-400 font-mono">({child.ma_don_vi})</span>
                                                )}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </>
                    )}
                  </div>

                  {/* Đếm số lượng đơn vị đã chọn */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium pt-1 border-t border-gray-200 dark:border-slate-600">
                    <span>
                      Đã chọn: <strong className="text-[#D97706] font-bold text-xs">{selectedUnitsToUnlock.length}</strong> / {unitTreeData.allUnits.length} đơn vị
                    </span>
                    {selectedUnitsToUnlock.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedUnitsToUnlock([])}
                        className="text-gray-400 hover:text-red-500 cursor-pointer text-[10px]"
                      >
                        Xóa chọn
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Thiết lập thời hạn gia hạn */}
              <div className="space-y-2 p-3 bg-blue-50/50 dark:bg-slate-700/40 rounded-xl border border-blue-200/70 dark:border-slate-600">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Clock size={14} className="text-[#05469B] dark:text-blue-400" />
                    <span>2. Thời hạn mở khóa (Deadline Extension):</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={unlockHasDeadline}
                      onChange={(e) => setUnlockHasDeadline(e.target.checked)}
                      className="rounded text-[#05469B] focus:ring-[#05469B]"
                    />
                    <span>Đặt hạn chót tự động khóa</span>
                  </label>
                </div>

                {unlockHasDeadline ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="datetime-local"
                      value={unlockDeadline}
                      onChange={(e) => setUnlockDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 font-mono outline-none focus:ring-2 focus:ring-[#05469B]"
                    />
                    {/* Shortcut chips */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-gray-500">Chọn nhanh:</span>
                      <button
                        type="button"
                        onClick={() => setUnlockDeadline(getFutureDateAt2359(1))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:border-[#05469B] text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        +1 ngày (23:59 mai)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlockDeadline(getFutureDateAt2359(2))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:border-[#05469B] text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        +2 ngày (23:59 mốt)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlockDeadline(getFutureDateAt2359(3))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:border-[#05469B] text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        +3 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlockDeadline(getEndOfWeekDateAt2359())}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 hover:border-[#05469B] text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        Hết tuần này (CN)
                      </button>
                    </div>
                    <p className="text-[10px] text-blue-700 dark:text-blue-300 italic">
                      🛡️ Sau mốc thời gian trên, hệ thống sẽ tự động đóng băng an toàn các phiếu DNTT trở lại mà không cần Admin thao tác thủ công.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">
                    Mở khóa vô thời hạn cho đến khi Admin chủ động bấm Khóa lại.
                  </p>
                )}
              </div>

              {/* 3. Lý do mở khóa */}
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-200">
                  3. Lý do mở khóa / gia hạn:
                </label>
                <textarea
                  value={unitUnlockReason}
                  onChange={(e) => setUnitUnlockReason(e.target.value)}
                  placeholder="VD: Gia hạn nhập bổ sung hóa đơn sau kiểm toán, hoàn tất phân bổ chi phí..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#D97706] outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setUnitUnlockModalOpen(null); setSelectedUnitsToUnlock([]); setUnitUnlockReason(''); }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={
                  unitUnlockSubmitting ||
                  (unlockMode === 'TREE_SELECT' && selectedUnitsToUnlock.length === 0) ||
                  (unlockHasDeadline && !unlockDeadline)
                }
                onClick={handleUnlockSubmit}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Unlock size={14} />
                <span>{unitUnlockSubmitting ? 'Đang mở khóa...' : 'Xác nhận Mở khóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL GIA HẠN THỜI GIAN NHANH CHO KỲ ĐÃ MỞ */}
      {extensionModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center gap-2.5 text-gray-800 dark:text-gray-100 font-bold text-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-[#05469B] dark:text-blue-300 flex items-center justify-center">
                  <Clock size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Gia hạn Thời gian Kỳ chốt</h4>
                  <p className="text-[11px] text-gray-500 font-normal">Điều chỉnh hạn chót tự động đóng băng số liệu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setExtensionModalOpen(null); setExtensionDeadline(''); setExtensionReason(''); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50/60 dark:bg-slate-700/40 rounded-xl border border-blue-200 dark:border-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Kỳ chốt:</span>
                  <span className="font-mono font-bold text-[#D97706]">Tháng {extensionModalOpen.thang}/{extensionModalOpen.nam}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tình trạng hiện tại:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {extensionModalOpen.mo_khoa_toan_bo
                      ? '🔓 Đang mở toàn bộ'
                      : `🔓 Đang mở cho ${(extensionModalOpen.danh_sach_don_vi_mo_khoa || []).length} đơn vị`}
                  </span>
                </div>
                {extensionModalOpen.han_mo_khoa && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400 pt-1 border-t border-blue-100 dark:border-slate-600">
                    <span>Hạn hiện tại:</span>
                    <span className="font-mono">{new Date(extensionModalOpen.han_mo_khoa).toLocaleString('vi-VN')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    Thời hạn gia hạn mới:
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={extensionHasDeadline}
                      onChange={(e) => setExtensionHasDeadline(e.target.checked)}
                      className="rounded text-[#05469B] focus:ring-[#05469B]"
                    />
                    <span>Có thời hạn</span>
                  </label>
                </div>

                {extensionHasDeadline ? (
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={extensionDeadline}
                      onChange={(e) => setExtensionDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono outline-none focus:ring-2 focus:ring-[#05469B]"
                    />
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-gray-500">Chọn nhanh:</span>
                      <button
                        type="button"
                        onClick={() => setExtensionDeadline(getFutureDateAt2359(1))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 hover:bg-blue-50 text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        +1 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtensionDeadline(getFutureDateAt2359(2))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 hover:bg-blue-50 text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        +2 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtensionDeadline(getFutureDateAt2359(3))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 hover:bg-blue-50 text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        +3 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtensionDeadline(getEndOfWeekDateAt2359())}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 hover:bg-blue-50 text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        Hết tuần này (CN)
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic p-2 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    Chuyển sang mở khóa vô thời hạn (cho đến khi Admin chủ động bấm Khóa lại).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-gray-700 dark:text-gray-300">
                  Lý do gia hạn (tùy chọn):
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="VD: Gia hạn thêm 2 ngày để hoàn tất đối soát hóa đơn VAT..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#05469B]"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setExtensionModalOpen(null); setExtensionDeadline(''); setExtensionReason(''); }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={extensionSubmitting || (extensionHasDeadline && !extensionDeadline)}
                onClick={handleSaveExtension}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#05469B] hover:bg-[#043675] text-white cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Clock size={14} />
                <span>{extensionSubmitting ? 'Đang lưu...' : 'Lưu Gia hạn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
