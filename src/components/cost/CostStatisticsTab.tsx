import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart2, Calendar, Filter, Download, Lock, Unlock, AlertCircle,
  TrendingUp, TrendingDown, CheckCircle2, ChevronDown, Layers,
  Building, RefreshCw, X, ShieldAlert, Sparkles, PieChart, FileSpreadsheet,
  Search, CheckSquare, Square
} from 'lucide-react';
import {
  ChiPhiChotKy, ChiPhiThongKe, DNTT, DnttPhanBo, DmKmp,
  DmBoPhan, BoPhanCap1, BoPhanCap2, DonVi, PhapNhan, DmNhomChiPhi
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/toast';
import { getAllSubordinateIds, getUserPermittedUnitIds } from '../../utils/hierarchy';
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
  onSubTabChange
}: Props) {
  const { user } = useAuth();

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

    setChotKySubmitting(true);
    try {
      const res = await apiService.chotKyChiPhi(
        newChotThang,
        newChotNam,
        user?.ho_ten || user?.email || 'Quản trị viên',
        newChotGhiChu
      );
      toast.success(`Chốt kỳ Tháng ${newChotThang}/${newChotNam} thành công! Đã snapshot ${res.so_dong_snapshot} dòng thống kê.`);
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
            onOpenChotKyModal={() => setChotKyModalOpen(true)}
          />
        </div>
      )}

      {/* 4. MODAL QUẢN LÝ CHỐT KỲ */}
      {chotKyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                      placeholder="VD: Chốt sau kiểm toán T8"
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
                          <td colSpan={6} className="p-4 text-center text-gray-400 text-xs">
                            Chưa có kỳ nào được chốt trong hệ thống.
                          </td>
                        </tr>
                      ) : (
                        chotKyList.map(ck => (
                          <tr key={ck.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                            <td className="p-2.5 font-bold text-[#D97706] font-mono">
                              Tháng {ck.thang}/{ck.nam}
                            </td>
                            <td className="p-2.5">
                              {ck.trang_thai === 'da_chot' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Lock size={10} /> Đang chốt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                                  <Unlock size={10} /> Đã hủy chốt
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-medium text-gray-800 dark:text-gray-200">{ck.chot_boi || '-'}</td>
                            <td className="p-2.5 font-mono text-gray-500 text-[11px]">
                              {ck.chot_luc ? new Date(ck.chot_luc).toLocaleString('vi-VN') : '-'}
                            </td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-400 max-w-[140px] truncate" title={ck.ghi_chu}>
                              {ck.ghi_chu || '-'}
                            </td>
                            <td className="p-2.5 text-center">
                              {ck.trang_thai === 'da_chot' && (
                                revokeConfirmId === ck.id ? (
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
                                    title="Hủy chốt kỳ này"
                                  >
                                    Hủy chốt
                                  </button>
                                )
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
    </div>
  );
}
