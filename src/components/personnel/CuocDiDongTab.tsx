import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save,
  Users, Activity, FileSpreadsheet, Briefcase, Calendar,
  ChevronLeft, ChevronRight, Phone, TrendingUp, CheckCircle2, History, Link2, ExternalLink,
  Pencil, ArrowLeftRight, UserPlus, PauseCircle, PlayCircle, XCircle, Zap, ChevronDown, Sparkles
} from 'lucide-react';
import { apiService } from '../../services/api';
import { Personnel, DonVi, ThueBao, CuocThang, LichSuNSD } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/toast';
import { formatCurrencySpace, formatPhoneNumber } from '../../utils/formatters';
const formatCurrency = formatCurrencySpace;
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, getAllSubordinateIds } from '../../utils/hierarchy';
import Pagination from '../ui/Pagination';
import CustomAutocomplete from '../ui/CustomAutocomplete';
import ThueBaoDetailCuocChart from './ThueBaoDetailCuocChart';
import ThueBaoCuocHistorySection from './ThueBaoCuocHistorySection';

interface Props {
  personnel: Personnel[];
  donViList: DonVi[];
  phapNhanList: any[];
  allowedDonViIds: string[];
  selectedUnitFilter: string | null;
  selectedUnitSubordinates: string[];
}

interface ImportRow {
  msnv?: string;
  sdt: string;
  dinhMucExcel?: number | null;
  cuoc?: number;
  khuyenMai?: number;
  thue?: number;
  dieuChinh?: number;
  no?: number;
  cuocSuDung?: number;
  tongCuoc: number;
  noiMang?: number;
  ngoaiMang?: number;
  cuocData?: number;
  sms?: number;
  khac?: number;
  phutGoi?: number;
  dungLuong?: number;
  matchedTB: ThueBao | null;
  existingCuoc: CuocThang | null;
  status: 'INSERT' | 'UPDATE' | 'SKIP';
  skipReason?: string;
}

const getCurrMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const parsePhoneNumberWithZero = (phoneStr?: string | null): string => {
  if (!phoneStr) return '';
  let clean = String(phoneStr).replace(/[^0-9]/g, '');
  if (clean.length === 9) {
    clean = '0' + clean;
  }
  return clean;
};

const parseDateDDMMYYYY = (dateStr?: string | null): string => {
  if (!dateStr || !String(dateStr).trim()) return new Date().toISOString().split('T')[0];
  const cleanStr = String(dateStr).trim().split(' ')[0];
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return cleanStr;
    }
  }
  return new Date().toISOString().split('T')[0];
};

const parseNum = (s?: string | null): number =>
  parseFloat(String(s || '0').replace(/[^0-9.]/g, '')) || 0;

const parseExcelNum = (s?: string | null): number => {
  if (!s || s === '-' || s.trim() === '-' || s.trim() === '---') return 0;
  return parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
};

export default function CuocDiDongTab({
  personnel,
  donViList,
  phapNhanList,
  allowedDonViIds,
  selectedUnitFilter,
  selectedUnitSubordinates
}: Props) {
  const { user } = useAuth();
  
  // Data States
  const [thueBaoList, setThueBaoList] = useState<ThueBao[]>([]);
  const [cuocList, setCuocList] = useState<CuocThang[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterThang, setFilterThang] = useState(getCurrMonth());
  const [filterPhapNhan, setFilterPhapNhan] = useState('');
  const [filterLoai, setFilterLoai] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState('Đang hoạt động');
  const [filterVuot, setFilterVuot] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected State (For Left Panel vs Right Panel detail view)
  const [selectedThueBaoId, setSelectedThueBaoId] = useState<string | null>(null);

  // Modals
  const [thueBaoModal, setThueBaoModal] = useState<{
    open: boolean;
    mode: 'create' | 'update';
    data: Partial<ThueBao>;
    changeNVReason: string;
    showReasonInput: boolean;
    originalNhanSuId: string | null;
  }>({
    open: false,
    mode: 'create',
    data: {},
    changeNVReason: '',
    showReasonInput: false,
    originalNhanSuId: null
  });

  const [lichSuModal, setLichSuModal] = useState<{
    open: boolean;
    thueBao: ThueBao | null;
    showAddForm: boolean;
    formData: Partial<LichSuNSD>;
    editingIndex: number | null;
  }>({
    open: false,
    thueBao: null,
    showAddForm: false,
    formData: { ho_ten: '', ma_so_nv: '', tu_ngay: '', den_ngay: '', ly_do: '' },
    editingIndex: null
  });

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    subDescription?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    subDescription: '',
    confirmText: 'Xác nhận',
    cancelText: 'Quay lại',
    variant: 'danger',
    onConfirm: () => {}
  });

  // Modal Thu hồi (nhập lý do)
  const [thuHoiModal, setThuHoiModal] = useState<{
    open: boolean;
    thueBao: ThueBao | null;
    lyDo: string;
  }>({ open: false, thueBao: null, lyDo: '' });

  // Modal Tái cấp (chọn NV mới + ngày + lý do)
  const [taiCapModal, setTaiCapModal] = useState<{
    open: boolean;
    thueBao: ThueBao | null;
    nvMoi: any | null;       // NV được tái cấp
    ngayTaiCap: string;
    lyDo: string;
  }>({ open: false, thueBao: null, nvMoi: null, ngayTaiCap: '', lyDo: '' });

  // Autocomplete helpers for modal
  const [staffSearchText, setStaffSearchText] = useState('');
  const [showStaffSuggestions, setShowStaffSuggestions] = useState(false);
  const staffSuggestionsRef = useRef<HTMLDivElement>(null);

  // Autocomplete helper for History Modal
  const [histSearchText, setHistSearchText] = useState('');
  const [showHistSuggestions, setShowHistSuggestions] = useState(false);
  const histSuggestionsRef = useRef<HTMLDivElement>(null);

  // Autocomplete helper for Tai Cap
  const [taiCapSearchText, setTaiCapSearchText] = useState('');

  // Import Excel States
  const [importModal, setImportModal] = useState(false);
  const [importThang, setImportThang] = useState(getCurrMonth());
  const [importRawText, setImportRawText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);

  // Batch SIM Creation States
  const [showAddSimModal, setShowAddSimModal] = useState(false);
  const [batchSimModal, setBatchSimModal] = useState<{
    open: boolean;
    rawText: string;
    allowOverwrite: boolean;
    previewRows: {
      stt: string;
      msnv: string;
      hoTenExcel: string;
      soDienThoai: string;
      dinhMuc: number | null;
      ngayCap: string;
      nhaMang: string;
      loaiThueBao: string;
      idDonVi: string;
      tenDonVi: string;
      idPhapNhan: string;
      tenPhapNhan: string;
      matchedPersonnel: Personnel | null;
      sdtCtyNote?: string;
      isDuplicate: boolean;
      status: 'VALID' | 'WARNING_NO_NV' | 'UPDATE_EXISTING' | 'ERROR_DUPLICATE' | 'INVALID';
      errorMessage?: string;
    }[];
    isSubmitting: boolean;
  }>({
    open: false,
    rawText: '',
    allowOverwrite: true,
    previewRows: [],
    isSubmitting: false
  });

  // Chart Tooltip state
  const [chartTooltip, setChartTooltip] = useState<{
    x: number;
    y: number;
    thang: string;
    tongCuoc: number;
    dinhMuc: number | null;
    visible: boolean;
  }>({ x: 0, y: 0, thang: '', tongCuoc: 0, dinhMuc: null, visible: false });

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [tbResult, cResult] = await Promise.all([
        apiService.getThueBao(),
        apiService.getCuocThang()
      ]);
      setThueBaoList(tbResult || []);
      setCuocList(cResult || []);
    } catch (e: any) {
      toast.error('Lỗi khi tải dữ liệu cước ĐTDĐ: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close Autocomplete click outside hooks
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (staffSuggestionsRef.current && !staffSuggestionsRef.current.contains(e.target as Node)) {
        setShowStaffSuggestions(false);
      }
      if (histSuggestionsRef.current && !histSuggestionsRef.current.contains(e.target as Node)) {
        setShowHistSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Lọc pháp nhân cho thanh bộ lọc và căn cứ chuẩn theo Đơn vị đang được lựa chọn bên Bộ lọc Đơn vị
  const filteredPhapNhansForFilter = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') return phapNhanList;
    const unitIdsSet = new Set<string>(selectedUnitSubordinates);
    unitIdsSet.add(selectedUnitFilter);
    const filtered = phapNhanList.filter(pn => unitIdsSet.has(pn.id_don_vi) || String(pn.id_don_vi) === String(selectedUnitFilter));
    return filtered.length > 0 ? filtered : phapNhanList;
  }, [selectedUnitFilter, selectedUnitSubordinates, phapNhanList]);

  // Lọc pháp nhân cho form Thêm mới / Cập nhật căn cứ theo Đơn vị đang được lựa chọn bên Bộ lọc Đơn vị
  const modalPhapNhanOptions = useMemo(() => {
    if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      return filteredPhapNhansForFilter;
    }
    const unitId = thueBaoModal.data.id_don_vi;
    if (!unitId || unitId === 'ALL') return phapNhanList;

    const subIds = getAllSubordinateIds(unitId, donViList);
    const unitIdsSet = new Set<string>(subIds);
    unitIdsSet.add(unitId);
    const filtered = phapNhanList.filter(pn => unitIdsSet.has(pn.id_don_vi) || String(pn.id_don_vi) === String(unitId));
    return filtered.length > 0 ? filtered : phapNhanList;
  }, [selectedUnitFilter, filteredPhapNhansForFilter, thueBaoModal.data.id_don_vi, phapNhanList, donViList]);

  // Auto-set id_phap_nhan in modal if there's exactly 1 option
  useEffect(() => {
    if (thueBaoModal.open && thueBaoModal.data.id_don_vi) {
      const options = modalPhapNhanOptions;
      if (options.length === 1 && thueBaoModal.data.id_phap_nhan !== options[0].id) {
        setThueBaoModal(prev => ({
          ...prev,
          data: { ...prev.data, id_phap_nhan: options[0].id }
        }));
      }
    }
  }, [thueBaoModal.data.id_don_vi, modalPhapNhanOptions, thueBaoModal.open]);

  // Reset phap nhan filter when sidebar unit changes
  useEffect(() => {
    setFilterPhapNhan('');
    setCurrentPage(1);
  }, [selectedUnitFilter]);

  // Filter & Join Logic
  const tableRows = useMemo(() => {
    return thueBaoList
      .filter(tb => allowedDonViIds.includes(tb.id_don_vi))
      .map(tb => {
        const cuocThang = cuocList.find(
          c => c.thang_nam === filterThang && (
            (c.id_thue_bao && String(c.id_thue_bao) === String(tb.id)) ||
            (c.so_dien_thoai && parsePhoneNumberWithZero(c.so_dien_thoai) === parsePhoneNumberWithZero(tb.so_dien_thoai))
          )
        );
        const nv = personnel.find(p => p.id === tb.id_nhan_su);
        const rawSimDm = tb.dinh_muc_cuoc !== undefined && tb.dinh_muc_cuoc !== null ? Number(tb.dinh_muc_cuoc) : null;
        const simDinhMuc = (rawSimDm !== null && rawSimDm > 0) ? rawSimDm : null;
        const rawSnapDm = cuocThang?.dinh_muc_snap !== undefined && cuocThang?.dinh_muc_snap !== null ? Number(cuocThang.dinh_muc_snap) : null;
        const snapDinhMuc = (rawSnapDm !== null && rawSnapDm > 0) ? rawSnapDm : null;
        const dinhMuc = simDinhMuc === null ? null : (snapDinhMuc ?? simDinhMuc);
        const tongCuoc = cuocThang?.tong_cuoc ?? null;
        const vuot = dinhMuc !== null && tongCuoc !== null ? tongCuoc - dinhMuc : null;

        return { tb, nv, cuocThang, dinhMuc, tongCuoc, vuot };
      })
      .filter(row => {
        if (selectedUnitFilter && !selectedUnitSubordinates.includes(row.tb.id_don_vi)) return false;
        if (filterPhapNhan && row.tb.id_phap_nhan !== filterPhapNhan) return false;
        if (filterLoai && row.tb.loai_thue_bao !== filterLoai) return false;
        if (filterTrangThai && row.tb.trang_thai !== filterTrangThai) return false;
        
        if (filterVuot === 'vuot') {
          if (row.vuot === null || row.vuot <= 0) return false;
        } else if (filterVuot === 'trong') {
          if (row.tongCuoc === null || (row.vuot !== null && row.vuot > 0)) return false;
        } else if (filterVuot === 'khong_dm') {
          if (row.dinhMuc !== null) return false;
        }

        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchText = [
            row.tb.ho_ten_nv,
            row.tb.ma_so_nv,
            row.tb.so_dien_thoai,
            row.tb.ten_bo_phan,
            row.tb.nha_mang
          ].some(v => v?.toLowerCase().includes(q));
          if (!matchText) return false;
        }
        return true;
      });
  }, [thueBaoList, cuocList, personnel, filterThang, filterPhapNhan, filterLoai, filterTrangThai, filterVuot, searchTerm, allowedDonViIds, selectedUnitFilter, selectedUnitSubordinates]);

  // Pagination Logic
  const totalPages = Math.ceil(tableRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [tableRows, currentPage, pageSize]);

  // Overall Statistics from Filtered Data
  const stats = useMemo(() => {
    const totalSim = tableRows.length;
    const activeSim = tableRows.filter(r => r.tb.trang_thai === 'Đang hoạt động').length;
    const totalCuoc = tableRows.reduce((sum, r) => sum + (r.tongCuoc || 0), 0);
    const vuotCount = tableRows.filter(r => r.vuot !== null && r.vuot > 0).length;
    const trongCount = tableRows.filter(r => r.tongCuoc !== null && r.dinhMuc !== null && r.vuot !== null && r.vuot <= 0).length;
    const noDataCount = tableRows.filter(r => r.tongCuoc === null).length;

    return { totalSim, activeSim, totalCuoc, vuotCount, trongCount, noDataCount };
  }, [tableRows]);

  // Current page sum stats
  const pageSums = useMemo(() => {
    let dinhMuc = 0;
    let cuoc = 0;
    let vuot = 0;
    paginatedRows.forEach(r => {
      dinhMuc += r.dinhMuc || 0;
      cuoc += r.tongCuoc || 0;
      if (r.vuot && r.vuot > 0) {
        vuot += r.vuot;
      }
    });
    return { dinhMuc, cuoc, vuot };
  }, [paginatedRows]);

  // Color & badge mappings
  const getCuocBadge = (tongCuoc: number | null, dinhMuc: number | null) => {
    if (tongCuoc === null) {
      return { label: 'Chưa có DL', cls: 'bg-gray-150 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700' };
    }
    if (dinhMuc === null) {
      return { label: `${formatCurrency(tongCuoc)}đ (TTTT)`, cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800' };
    }
    const vuot = tongCuoc - dinhMuc;
    if (vuot > 0) {
      return { label: `Vượt +${formatCurrency(vuot)}đ`, cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 font-bold' };
    }
    return { label: `Trong ĐM`, cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' };
  };

  const getTrangThaiBadge = (trangThai: string) => {
    switch (trangThai) {
      case 'Đang hoạt động':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700';
      case 'Tạm ngưng':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700';
      case 'Đã thu hồi - Chờ tái cấp':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700';
      case 'Đã huỷ':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600';
    }
  };



  const selectedRowDetails = useMemo(() => {
    if (!selectedThueBaoId) return null;
    const row = tableRows.find(r => r.tb.id === selectedThueBaoId);
    if (!row) return null;

    // Build 12-month data chart
    const current = filterThang;
    const [y, m] = current.split('-').map(Number);
    const months = Array.from({ length: 12 }, (_, i) => {
      let mm = m - (11 - i);
      let yy = y;
      while (mm <= 0) {
        mm += 12;
        yy--;
      }
      return `${yy}-${String(mm).padStart(2, '0')}`;
    });

    const chartPoints = months.map(mStr => {
      const c = cuocList.find(item => item.id_thue_bao === row.tb.id && item.thang_nam === mStr);
      const rawSimDm = row.tb.dinh_muc_cuoc !== undefined && row.tb.dinh_muc_cuoc !== null ? Number(row.tb.dinh_muc_cuoc) : null;
      const simDinhMuc = (rawSimDm !== null && rawSimDm > 0) ? rawSimDm : null;
      const rawSnapDm = c?.dinh_muc_snap !== undefined && c?.dinh_muc_snap !== null ? Number(c.dinh_muc_snap) : null;
      const snapDinhMuc = (rawSnapDm !== null && rawSnapDm > 0) ? rawSnapDm : null;
      const dinhMuc = simDinhMuc === null ? null : (snapDinhMuc ?? simDinhMuc);
      return {
        thang: mStr,
        tongCuoc: c?.tong_cuoc ?? null,
        dinhMuc
      };
    });

    // History data parse
    let hist: LichSuNSD[] = [];
    try {
      hist = typeof row.tb.lich_su_nsd === 'string'
        ? JSON.parse(row.tb.lich_su_nsd)
        : (row.tb.lich_su_nsd || []);
    } catch {
      hist = [];
    }

    // Sort descending by tu_ngay
    hist = [...hist].sort((a, b) => b.tu_ngay.localeCompare(a.tu_ngay));

    return { ...row, chartPoints, historyList: hist };
  }, [selectedThueBaoId, tableRows, cuocList, filterThang]);

  // Form autocomplete filtering
  const filteredPersonnelSuggestions = useMemo(() => {
    if (!staffSearchText) return [];
    const q = staffSearchText.toLowerCase();
    return personnel
      .filter(p => p.ho_ten.toLowerCase().includes(q) || p.ma_so_nhan_vien.toLowerCase().includes(q))
      .slice(0, 5);
  }, [staffSearchText, personnel]);

  const filteredHistPersonnelSuggestions = useMemo(() => {
    if (!histSearchText) return [];
    const q = histSearchText.toLowerCase();
    return personnel
      .filter(p => p.ho_ten.toLowerCase().includes(q) || p.ma_so_nhan_vien.toLowerCase().includes(q))
      .slice(0, 5);
  }, [histSearchText, personnel]);

  // Open Create Modal
  const openCreateModal = () => {
    setThueBaoModal({
      open: true,
      mode: 'create',
      data: {
        loai_thue_bao: 'Cá nhân',
        trang_thai: 'Đang hoạt động',
        nha_mang: 'Viettel',
        dinh_muc_cuoc: null,
        id_don_vi: selectedUnitFilter || ''
      },
      changeNVReason: '',
      showReasonInput: false,
      originalNhanSuId: null
    });
    setStaffSearchText('');
  };

  // Open Update Modal
  const openUpdateModal = (tb: ThueBao) => {
    setThueBaoModal({
      open: true,
      mode: 'update',
      data: { ...tb },
      changeNVReason: '',
      showReasonInput: false,
      originalNhanSuId: tb.id_nhan_su || null
    });
    setStaffSearchText(tb.ho_ten_nv ? `${tb.ho_ten_nv} (${tb.ma_so_nv})` : '');
  };

  // Autocomplete handle select staff
  const selectStaff = (p: Personnel) => {
    setThueBaoModal(prev => {
      const isNVChanged = prev.mode === 'update' && prev.originalNhanSuId !== p.id;
      return {
        ...prev,
        data: {
          ...prev.data,
          id_nhan_su: p.id,
          ma_so_nv: p.ma_so_nhan_vien,
          ho_ten_nv: p.ho_ten,
          id_don_vi: p.id_don_vi,
          ten_bo_phan: p.chuc_vu,
          dinh_muc_cuoc: prev.data.dinh_muc_cuoc !== undefined && prev.data.dinh_muc_cuoc !== null ? prev.data.dinh_muc_cuoc : null
        },
        showReasonInput: isNVChanged
      };
    });
    setStaffSearchText(`${p.ho_ten} (${p.ma_so_nhan_vien})`);
    setShowStaffSuggestions(false);
  };

  // Save Thue Bao
  const handleSaveThueBao = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: formData, mode, originalNhanSuId, changeNVReason } = thueBaoModal;

    if (!formData.so_dien_thoai || !formData.id_phap_nhan) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc (*)');
      return;
    }

    // Clean phone number format
    formData.so_dien_thoai = formatPhoneNumber(formData.so_dien_thoai);

    try {
      let isCreate = mode === 'create';
      let payload = { ...formData };

      // Parse current JSON history list
      let historyList: LichSuNSD[] = [];
      if (!isCreate && payload.lich_su_nsd) {
        try {
          historyList = typeof payload.lich_su_nsd === 'string'
            ? JSON.parse(payload.lich_su_nsd)
            : (payload.lich_su_nsd || []);
        } catch {
          historyList = [];
        }
      }

      // Check transition log trigger
      if (isCreate) {
        // Create initial history entry
        const initEntry: LichSuNSD = {
          ho_ten: formData.ho_ten_nv || formData.ten_bo_phan || 'N/A',
          ma_so_nv: formData.ma_so_nv || '',
          tu_ngay: formData.ngay_cap || new Date().toISOString().split('T')[0],
          den_ngay: '',
          ly_do: 'Cấp mới thuê bao',
          nguoi_ghi: user?.ho_ten || 'Hệ thống'
        };
        payload.lich_su_nsd = [initEntry];
      } else if (originalNhanSuId !== formData.id_nhan_su) {
        // If manager changed, close old entry & add new one
        const today = new Date().toISOString().split('T')[0];
        const openEntry = historyList.find(item => !item.den_ngay);
        if (openEntry) {
          openEntry.den_ngay = today;
        }

        historyList.push({
          ho_ten: formData.ho_ten_nv || formData.ten_bo_phan || 'N/A',
          ma_so_nv: formData.ma_so_nv || '',
          tu_ngay: today,
          den_ngay: '',
          ly_do: changeNVReason || 'Thay đổi nhân sự sử dụng',
          nguoi_ghi: user?.ho_ten || 'Hệ thống'
        });
        payload.lich_su_nsd = historyList;
      }

      // Auto resolve pháp nhân name
      const pnObj = phapNhanList.find(p => p.id === formData.id_phap_nhan);
      if (pnObj) {
        payload.ten_phap_nhan = pnObj.ten_cong_ty || pnObj.ten_phap_nhan;
      }

      await apiService.save(payload, mode, 'dm_thue_bao');

      // 🟢 TỰ ĐỘNG ĐỒNG BỘ SDT CÔNG TY SANG HỒ SƠ NHÂN SỰ
      if (payload.id_nhan_su && payload.so_dien_thoai) {
        await syncPersonnelCompanyPhone(payload.id_nhan_su, payload.so_dien_thoai);
      }

      toast.success(isCreate ? 'Thêm mới thuê bao thành công!' : 'Cập nhật thuê bao thành công!');
      setThueBaoModal(prev => ({ ...prev, open: false }));
      loadData();
    } catch (err: any) {
      toast.error('Lỗi khi lưu dữ liệu thuê bao: ' + err.message);
    }
  };

  // ── Hàm helper: Tự động đồng bộ SDT SIM sang sdt_cong_ty của Nhân sự ──
  const syncPersonnelCompanyPhone = async (idNhanSu: string | null | undefined, newPhone: string | null) => {
    if (!idNhanSu) return;
    const person = personnel.find(p => String(p.id) === String(idNhanSu));
    if (!person) return;

    const currentCtyPhone = parsePhoneNumberWithZero(person.sdt_cong_ty || '');
    const targetPhone = newPhone ? parsePhoneNumberWithZero(newPhone) : '';

    if (currentCtyPhone !== targetPhone) {
      try {
        await apiService.save(
          { ...person, sdt_cong_ty: targetPhone },
          'update',
          'ns_dich_vu'
        );
        person.sdt_cong_ty = targetPhone;
      } catch (err) {
        console.error('Lỗi đồng bộ SĐT Cty cho Nhân sự:', err);
      }
    }
  };

  // ── Hàm helper: cập nhật lich_su_nsd ──────────────────────────────
  const dongLogHienTai = (lichSu: any, lyDo: string): LichSuNSD[] => {
    let list: LichSuNSD[] = [];
    try {
      list = typeof lichSu === 'string' ? JSON.parse(lichSu) : (lichSu || []);
    } catch {
      list = [];
    }
    const copy = JSON.parse(JSON.stringify(list));
    const openEntry = copy.find((e: LichSuNSD) => !e.den_ngay);
    if (openEntry) {
      openEntry.den_ngay = new Date().toISOString().split('T')[0];
      openEntry.ly_do = openEntry.ly_do
        ? openEntry.ly_do + ' — ' + lyDo
        : lyDo;
    }
    return copy;
  };

  const taoLogMoi = (
    lichSu: any,
    nv: { ho_ten: string; ma_so_nv: string },
    lyDo: string
  ): LichSuNSD[] => {
    let list: LichSuNSD[] = [];
    try {
      list = typeof lichSu === 'string' ? JSON.parse(lichSu) : (lichSu || []);
    } catch {
      list = [];
    }
    return [...list, {
      ho_ten: nv.ho_ten,
      ma_so_nv: nv.ma_so_nv,
      tu_ngay: new Date().toISOString().split('T')[0],
      den_ngay: '',
      ly_do: lyDo,
      nguoi_ghi: user?.ho_ten || 'Hệ thống',
    }];
  };

  // ── Thu hồi SIM ────────────────────────────────────────────────────
  const handleThuHoi = (thueBao: ThueBao) => {
    setThuHoiModal({ open: true, thueBao, lyDo: 'Nhân sự thôi việc' });
  };

  const confirmThuHoi = async () => {
    const { thueBao, lyDo } = thuHoiModal;
    if (!thueBao || !lyDo.trim()) {
      toast.warning('Vui lòng nhập lý do thu hồi');
      return;
    }
    try {
      const lichSuMoi = dongLogHienTai(
        thueBao.lich_su_nsd || [],
        lyDo
      );
      await apiService.save({
        ...thueBao,
        trang_thai: 'Đã thu hồi - Chờ tái cấp',
        id_nhan_su: null,
        ma_so_nv: '',
        ho_ten_nv: '',
        lich_su_nsd: lichSuMoi,
        updated_at: new Date().toISOString(),
      }, 'update', 'dm_thue_bao');

      // 🟢 Xóa SĐT Công ty khỏi hồ sơ nhân sự khi thu hồi SIM
      if (thueBao.id_nhan_su) {
        await syncPersonnelCompanyPhone(thueBao.id_nhan_su, '');
      }

      toast.success(`Đã thu hồi SIM ${thueBao.so_dien_thoai}`);
      setThuHoiModal({ open: false, thueBao: null, lyDo: '' });
      setSelectedThueBaoId(null);
      loadData();
    } catch (err: any) {
      toast.error('Lỗi thu hồi: ' + err.message);
    }
  };

  // ── Tái cấp SIM ────────────────────────────────────────────────────
  const handleTaiCap = (thueBao: ThueBao) => {
    setTaiCapSearchText('');
    setTaiCapModal({
      open: true,
      thueBao,
      nvMoi: null,
      ngayTaiCap: new Date().toISOString().split('T')[0],
      lyDo: 'Tái cấp sau thu hồi',
    });
  };

  const confirmTaiCap = async () => {
    const { thueBao, nvMoi, ngayTaiCap, lyDo } = taiCapModal;
    if (!thueBao || !nvMoi) {
      toast.warning('Vui lòng chọn nhân sự nhận SIM');
      return;
    }
    try {
      const lichSuMoi = taoLogMoi(
        thueBao.lich_su_nsd || [],
        { ho_ten: nvMoi.ho_ten, ma_so_nv: nvMoi.ma_so_nhan_vien },
        lyDo
      );
      const lastEntry = lichSuMoi[lichSuMoi.length - 1];
      if (lastEntry) lastEntry.tu_ngay = ngayTaiCap;

      await apiService.save({
        ...thueBao,
        trang_thai: 'Đang hoạt động',
        id_nhan_su: nvMoi.id,
        ma_so_nv: nvMoi.ma_so_nhan_vien,
        ho_ten_nv: nvMoi.ho_ten,
        lich_su_nsd: lichSuMoi,
        updated_at: new Date().toISOString(),
      }, 'update', 'dm_thue_bao');

      // 🟢 Cập nhật SĐT Công ty cho Nhân sự được tái cấp SIM
      if (nvMoi.id) {
        await syncPersonnelCompanyPhone(nvMoi.id, thueBao.so_dien_thoai);
      }

      toast.success(`Đã tái cấp SIM ${thueBao.so_dien_thoai} cho ${nvMoi.ho_ten}`);
      setTaiCapModal({ open: false, thueBao: null, nvMoi: null, ngayTaiCap: '', lyDo: '' });
      setSelectedThueBaoId(null);
      loadData();
    } catch (err: any) {
      toast.error('Lỗi tái cấp: ' + err.message);
    }
  };

  // ── Tạm ngưng ──────────────────────────────────────────────────────
  const handleTamNgung = (thueBao: ThueBao) => {
    setConfirmModal({
      open: true,
      title: `Tạm ngưng SIM ${formatPhoneNumber(thueBao.so_dien_thoai)}?`,
      description: 'SIM sẽ chuyển sang trạng thái Tạm ngưng (Cần báo nhà mạng tạm khóa số).',
      subDescription: 'Bạn có thể kích hoạt lại SIM này bất cứ lúc nào.',
      confirmText: 'Tạm ngưng SIM',
      cancelText: 'Quay lại',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await apiService.save({
            ...thueBao,
            trang_thai: 'Tạm ngưng',
            updated_at: new Date().toISOString(),
          }, 'update', 'dm_thue_bao');
          toast.success(`Đã tạm ngưng SIM ${formatPhoneNumber(thueBao.so_dien_thoai)}`);
          setSelectedThueBaoId(null);
          loadData();
        } catch (err: any) {
          toast.error('Lỗi: ' + err.message);
        }
      }
    });
  };

  // ── Kích hoạt lại ──────────────────────────────────────────────────
  const handleKichHoat = (thueBao: ThueBao) => {
    setConfirmModal({
      open: true,
      title: `Kích hoạt lại SIM ${formatPhoneNumber(thueBao.so_dien_thoai)}?`,
      description: 'SIM sẽ chuyển lại trạng thái Đang hoạt động.',
      confirmText: 'Kích hoạt lại',
      cancelText: 'Quay lại',
      variant: 'info',
      onConfirm: async () => {
        try {
          await apiService.save({
            ...thueBao,
            trang_thai: 'Đang hoạt động',
            updated_at: new Date().toISOString(),
          }, 'update', 'dm_thue_bao');
          toast.success(`Đã kích hoạt lại SIM ${formatPhoneNumber(thueBao.so_dien_thoai)}`);
          setSelectedThueBaoId(null);
          loadData();
        } catch (err: any) {
          toast.error('Lỗi: ' + err.message);
        }
      }
    });
  };

  // ── Huỷ SIM vĩnh viễn ──────────────────────────────────────────────
  const handleHuySIM = (thueBao: ThueBao) => {
    setConfirmModal({
      open: true,
      title: `HUỶ VĨNH VIỄN SIM ${formatPhoneNumber(thueBao.so_dien_thoai)}?`,
      description: 'SIM sẽ bị ẩn khỏi danh sách hoạt động. Dữ liệu lịch sử cước vẫn được giữ để báo cáo.',
      subDescription: 'Thao tác này không thể hoàn tác. Bạn có chắc chắn muốn xác nhận?',
      confirmText: 'Huỷ vĩnh viễn SIM',
      cancelText: 'Quay lại',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const lichSuMoi = dongLogHienTai(
            thueBao.lich_su_nsd || [],
            'Huỷ SIM vĩnh viễn'
          );
          await apiService.save({
            ...thueBao,
            trang_thai: 'Đã huỷ',
            id_nhan_su: null,
            ma_so_nv: '',
            ho_ten_nv: '',
            lich_su_nsd: lichSuMoi,
            updated_at: new Date().toISOString(),
          }, 'update', 'dm_thue_bao');
          toast.success(`Đã huỷ SIM ${formatPhoneNumber(thueBao.so_dien_thoai)}`);
          setSelectedThueBaoId(null);
          loadData();
        } catch (err: any) {
          toast.error('Lỗi: ' + err.message);
        }
      }
    });
  };

  // Open History NSD Dialog
  const openHistoryModal = (tb: ThueBao) => {
    let hist: LichSuNSD[] = [];
    try {
      hist = typeof tb.lich_su_nsd === 'string'
        ? JSON.parse(tb.lich_su_nsd)
        : (tb.lich_su_nsd || []);
    } catch {
      hist = [];
    }
    setLichSuModal({
      open: true,
      thueBao: tb,
      showAddForm: false,
      formData: { ho_ten: '', ma_so_nv: '', tu_ngay: '', den_ngay: '', ly_do: '' },
      editingIndex: null
    });
    setHistSearchText('');
  };

  // Select staff in History Modal autocomplete
  const selectHistStaff = (p: Personnel) => {
    setLichSuModal(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        ho_ten: p.ho_ten,
        ma_so_nv: p.ma_so_nhan_vien
      }
    }));
    setHistSearchText(`${p.ho_ten} (${p.ma_so_nhan_vien})`);
    setShowHistSuggestions(false);
  };

  // Save entry in History Modal list
  const handleSaveHistoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const { thueBao, formData, editingIndex } = lichSuModal;
    if (!thueBao || !formData.ho_ten || !formData.tu_ngay || !formData.ly_do) {
      toast.error('Vui lòng điền đủ thông tin lịch sử (*)');
      return;
    }

    try {
      let currentHist: LichSuNSD[] = [];
      try {
        currentHist = typeof thueBao.lich_su_nsd === 'string'
          ? JSON.parse(thueBao.lich_su_nsd)
          : (thueBao.lich_su_nsd || []);
      } catch {
        currentHist = [];
      }

      const newEntry: LichSuNSD = {
        ho_ten: formData.ho_ten,
        ma_so_nv: formData.ma_so_nv || '',
        tu_ngay: formData.tu_ngay,
        den_ngay: formData.den_ngay || '',
        ly_do: formData.ly_do,
        nguoi_ghi: user?.ho_ten || 'Hệ thống'
      };

      if (editingIndex !== null) {
        currentHist[editingIndex] = newEntry;
      } else {
        currentHist.push(newEntry);
      }

      const payload = {
        ...thueBao,
        lich_su_nsd: currentHist
      };

      await apiService.save(payload, 'update', 'dm_thue_bao');
      toast.success('Cập nhật lịch sử sử dụng thành công!');
      
      setLichSuModal(prev => ({
        ...prev,
        thueBao: { ...prev.thueBao!, lich_su_nsd: currentHist },
        showAddForm: false,
        formData: { ho_ten: '', ma_so_nv: '', tu_ngay: '', den_ngay: '', ly_do: '' },
        editingIndex: null
      }));
      setHistSearchText('');
      loadData();
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật lịch sử: ' + err.message);
    }
  };

  // Delete History Item from timeline list
  const handleDeleteHistoryItem = (idx: number) => {
    const { thueBao } = lichSuModal;
    if (!thueBao) return;
    setConfirmModal({
      open: true,
      title: 'Xóa lịch sử sử dụng?',
      description: 'Hành động này sẽ xóa vĩnh viễn dòng lịch sử bàn giao này. Không thể khôi phục.',
      onConfirm: async () => {
        try {
          let currentHist: LichSuNSD[] = [];
          try {
            currentHist = typeof thueBao.lich_su_nsd === 'string'
              ? JSON.parse(thueBao.lich_su_nsd)
              : (thueBao.lich_su_nsd || []);
          } catch {
            currentHist = [];
          }

          currentHist.splice(idx, 1);

          const payload = {
            ...thueBao,
            lich_su_nsd: currentHist
          };

          await apiService.save(payload, 'update', 'dm_thue_bao');
          toast.success('Đã xóa bản ghi lịch sử.');
          setLichSuModal(prev => ({
            ...prev,
            thueBao: { ...prev.thueBao!, lich_su_nsd: currentHist }
          }));
          loadData();
        } catch (e: any) {
          toast.error('Lỗi khi xóa: ' + e.message);
        }
      }
    });
  };

  // Edit History Item inline
  const editHistoryItem = (item: LichSuNSD, idx: number) => {
    setLichSuModal(prev => ({
      ...prev,
      showAddForm: true,
      editingIndex: idx,
      formData: { ...item }
    }));
    setHistSearchText(item.ho_ten ? `${item.ho_ten} (${item.ma_so_nv})` : '');
  };

  // Excel Paste Parser Logic (Nhập cước hàng tháng 8 cột)
  const handleParseExcel = () => {
    if (!importRawText.trim()) {
      toast.error('Vui lòng dán dữ liệu cước từ Excel vào ô nhập!');
      return;
    }

    const lines = importRawText.split('\n').filter(l => l.trim());
    const rows: ImportRow[] = [];

    lines.forEach(line => {
      const cols = line.split('\t').map(c => c.trim());
      if (cols.length === 0 || !cols[0]) return;

      // Bỏ qua dòng tiêu đề nếu khớp từ khóa cột của bảng cước
      const col0Low = cols[0].toLowerCase();
      if (
        col0Low.includes('số') || col0Low.includes('điện thoại') || col0Low.includes('sđt') ||
        col0Low.includes('sdt') || col0Low.includes('phone') || col0Low.includes('msnv') ||
        (cols[7] && cols[7].toLowerCase().includes('cước sử dụng'))
      ) {
        return;
      }

      // Vùng dán dữ liệu chuẩn 8 cột:
      // Col 0: Số điện thoại (dạng xxxxxxxxx hoặc 0xxxxxxxxx)
      // Col 1: Định mức
      // Col 2: Cước
      // Col 3: Khuyến mãi
      // Col 4: Thuế
      // Col 5: Điều chỉnh
      // Col 6: Nợ
      // Col 7: Cước sử dụng (gắn vào tong_cuoc)
      const rawCol0 = cols[0] || '';
      const cleanPhone = parsePhoneNumberWithZero(rawCol0);
      
      const is8Col = cols.length >= 8;
      const dinhMucStr = cols[1];
      const dinhMucExcel = (is8Col && dinhMucStr && dinhMucStr !== '-' && dinhMucStr.trim() !== '-')
        ? parseExcelNum(dinhMucStr)
        : (is8Col && (dinhMucStr === '-' || dinhMucStr.trim() === '-') ? null : undefined);

      const cuoc = is8Col ? parseExcelNum(cols[2]) : undefined;
      const khuyenMai = is8Col ? parseExcelNum(cols[3]) : undefined;
      const thue = is8Col ? parseExcelNum(cols[4]) : undefined;
      const dieuChinh = is8Col ? parseExcelNum(cols[5]) : undefined;
      const no = is8Col ? parseExcelNum(cols[6]) : undefined;
      const cuocSuDung = is8Col ? parseExcelNum(cols[7]) : parseExcelNum(cols[1]);
      const tongCuoc = cuocSuDung; // Cước sử dụng chính là tổng cước phát sinh

      // Đối chiếu số điện thoại với số điện thoại đã có sẵn (ưu tiên SDT, fallback MSNV nếu ai đó dán theo MSNV)
      const matchedTB = thueBaoList.find(tb => {
        if (!tb.so_dien_thoai && !tb.ma_so_nv) return false;
        if (tb.so_dien_thoai && cleanPhone) {
          const cleanTBPhone = parsePhoneNumberWithZero(tb.so_dien_thoai);
          if (cleanTBPhone && cleanPhone && cleanTBPhone === cleanPhone) return true;
          if (formatPhoneNumber(tb.so_dien_thoai) === formatPhoneNumber(rawCol0)) return true;
        }
        if (tb.ma_so_nv && rawCol0 && tb.ma_so_nv.toLowerCase() === rawCol0.toLowerCase()) return true;
        return false;
      }) || null;

      const existingCuoc = matchedTB
        ? cuocList.find(c => (String(c.id_thue_bao) === String(matchedTB.id) || (c.so_dien_thoai && parsePhoneNumberWithZero(c.so_dien_thoai) === parsePhoneNumberWithZero(matchedTB.so_dien_thoai))) && c.thang_nam === importThang) || null
        : null;

      rows.push({
        msnv: matchedTB?.ma_so_nv || '',
        sdt: cleanPhone || rawCol0,
        dinhMucExcel,
        cuoc,
        khuyenMai,
        thue,
        dieuChinh,
        no,
        cuocSuDung,
        tongCuoc,
        matchedTB,
        existingCuoc,
        status: !matchedTB ? 'SKIP' as const : existingCuoc ? 'UPDATE' as const : 'INSERT' as const,
        skipReason: !matchedTB ? `Không tìm thấy SĐT ${rawCol0} trên hệ thống` : undefined
      });
    });

    if (rows.length === 0) {
      toast.warning('Không tìm thấy dữ liệu hợp lệ trong nội dung dán (hoặc chỉ chứa dòng tiêu đề).');
    } else {
      setImportPreview(rows);
    }
  };

  // Confirm Import save
  const handleConfirmImport = async () => {
    const validRows = importPreview.filter(r => r.status !== 'SKIP');
    if (validRows.length === 0) {
      toast.error('Không có dòng dữ liệu hợp lệ để import!');
      return;
    }
    setImporting(true);
    try {
      for (const row of validRows) {
        const nv = personnel.find(p => p.ma_so_nhan_vien === row.msnv);
        const payload: Partial<CuocThang> = {
          id: row.existingCuoc?.id || `CDD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          id_thue_bao: row.matchedTB!.id,
          so_dien_thoai: row.matchedTB!.so_dien_thoai,
          ma_so_nv: row.msnv || row.matchedTB!.ma_so_nv || '',
          ho_ten_nv: row.matchedTB!.ho_ten_nv,
          id_nhan_su: row.matchedTB!.id_nhan_su,
          id_don_vi: row.matchedTB!.id_don_vi,
          id_phap_nhan: row.matchedTB!.id_phap_nhan,
          thang_nam: importThang,
          tong_cuoc: row.cuocSuDung !== undefined ? row.cuocSuDung : row.tongCuoc,
          cuoc_noi_mang: row.noiMang || 0,
          cuoc_ngoai_mang: row.ngoaiMang || 0,
          cuoc_data: row.cuocData || 0,
          cuoc_sms: row.sms || 0,
          cuoc_khac: row.khac || 0,
          so_phut_goi: row.phutGoi || 0,
          dung_luong_data: row.dungLuong || 0,
          dinh_muc_snap: (row.dinhMucExcel !== undefined && row.dinhMucExcel !== null && row.dinhMucExcel > 0)
            ? row.dinhMucExcel
            : (row.matchedTB?.dinh_muc_cuoc !== undefined && row.matchedTB?.dinh_muc_cuoc !== null ? Number(row.matchedTB.dinh_muc_cuoc) : null),
          // Cập nhật các trường cước chi tiết theo 8 cột
          cuoc_goc: row.cuoc !== undefined ? row.cuoc : row.tongCuoc,
          khuyen_mai: row.khuyenMai || 0,
          thue: row.thue || 0,
          dieu_chinh: row.dieuChinh || 0,
          no_cu: row.no || 0,
          cuoc_su_dung: row.cuocSuDung !== undefined ? row.cuocSuDung : row.tongCuoc,
          nguoi_nhap: user?.ho_ten || 'Hệ thống'
        };
        await apiService.save(payload, row.status === 'UPDATE' ? 'update' : 'create', 'cp_cuoc_thang');
      }
      toast.success(`Đã nhập cước thành công cho ${validRows.length} thuê bao.`);
      setImportModal(false);
      setImportRawText('');
      setImportPreview([]);
      loadData();
    } catch (e: any) {
      toast.error('Lỗi khi lưu cước: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  // ── LOGIC THÊM SIM / THUÊ BAO HÀNG LOẠT (COPY/PASTE EXCEL) ──────────
  const getDefaultUnitAndLegalEntity = (
    unitFilter: string | null,
    donViList: DonVi[],
    phapNhanList: any[]
  ) => {
    let targetUnitId = unitFilter && unitFilter !== 'ALL' ? unitFilter : '';
    if (!targetUnitId && donViList.length > 0) {
      targetUnitId = donViList[0].id;
    }
    const foundUnit = donViList.find(d => String(d.id) === String(targetUnitId));
    const unitName = foundUnit ? foundUnit.ten_don_vi : '';

    let targetPnId = foundUnit?.id_phap_nhan || '';
    let foundPn = filteredPhapNhansForFilter.find(p => String(p.id) === String(targetPnId));
    if (!foundPn && filteredPhapNhansForFilter.length > 0) {
      foundPn = filteredPhapNhansForFilter[0];
      targetPnId = foundPn.id;
    } else if (!foundPn && phapNhanList.length > 0) {
      foundPn = phapNhanList[0];
      targetPnId = foundPn.id;
    }
    const pnName = foundPn ? (foundPn.ten_cong_ty || foundPn.ten_phap_nhan) : '';

    return {
      idDonVi: targetUnitId,
      tenDonVi: unitName,
      idPhapNhan: targetPnId,
      tenPhapNhan: pnName
    };
  };

  const handleParseBatchSIM = () => {
    if (!batchSimModal.rawText.trim()) {
      toast.error('Vui lòng dán dữ liệu danh sách SIM từ Excel vào ô!');
      return;
    }

    const defaultLoc = getDefaultUnitAndLegalEntity(selectedUnitFilter, donViList, phapNhanList);
    const existingPhoneSet = new Set(thueBaoList.map(tb => parsePhoneNumberWithZero(tb.so_dien_thoai)));
    const batchPhoneSet = new Set<string>();

    const lines = batchSimModal.rawText.split('\n').filter(l => l.trim());
    const parsedRows: any[] = [];

    lines.forEach((line) => {
      const cols = line.split('\t').map(c => c.trim());

      // Bỏ qua dòng tiêu đề nếu khớp các tên cột Excel
      if (
        cols.some(c => /^(stt|msnv|họ|tên|chức vụ-bp|số đt|định mức|thời gian cấp)$/i.test(c.toLowerCase()))
      ) {
        return;
      }

      // Đọc các cột theo đúng vị trí của file Excel:
      // Col 0: STT
      // Col 1: MSNV
      // Col 2: Họ
      // Col 3: Tên
      // Col 4: CHỨC VỤ-BP
      // Col 5: SỐ ĐT
      // Col 6: ĐỊNH MỨC
      // Col 7: Thời gian cấp (ví dụ: 31/03/2016 10:46:42)
      const stt = cols[0] || '';
      const msnv = cols[1] || '';
      const ho = cols[2] || '';
      const ten = cols[3] || '';
      const hoTenExcel = `${ho} ${ten}`.trim();
      const rawPhone = cols[5] || '';
      const sdt = parsePhoneNumberWithZero(rawPhone);
      const rawDinhMuc = parseNum(cols[6]);
      const rawDate = cols[7] || '';
      const ngayCap = parseDateDDMMYYYY(rawDate);

      // Khớp nhân sự theo MSNV
      const matchedPersonnel = personnel.find(p =>
        msnv && String(p.ma_so_nhan_vien || '').trim().toLowerCase() === msnv.trim().toLowerCase()
      ) || null;

      const dinhMuc = rawDinhMuc > 0 ? rawDinhMuc : null;

      let existingSimInDB = thueBaoList.find(tb => parsePhoneNumberWithZero(tb.so_dien_thoai) === sdt);
      let isDuplicateInBatch = false;
      let errorMessage = '';

      if (!sdt) {
        errorMessage = 'Thiếu Số Điện thoại';
      } else if (batchPhoneSet.has(sdt)) {
        isDuplicateInBatch = true;
        errorMessage = 'SĐT bị dán trùng 2 lần trong file dán';
      } else {
        batchPhoneSet.add(sdt);
      }

      // Đối chiếu với SDT Cty sẵn có trong Hồ sơ Nhân sự
      let sdtCtyNote = '';
      if (matchedPersonnel) {
        const existingCtyPhone = parsePhoneNumberWithZero(matchedPersonnel.sdt_cong_ty || '');
        if (existingCtyPhone && existingCtyPhone === sdt) {
          sdtCtyNote = 'Đã có sẵn SĐT Cty trong Hồ sơ (Khớp chuẩn)';
        } else if (existingCtyPhone && existingCtyPhone !== sdt) {
          sdtCtyNote = `Đổi SĐT Cty: ${formatPhoneNumber(existingCtyPhone)} ➔ ${formatPhoneNumber(sdt)}`;
        } else {
          sdtCtyNote = 'Tự động cập nhật SĐT Cty mới';
        }
      } else if (sdt) {
        const otherPerson = personnel.find(p => parsePhoneNumberWithZero(p.sdt_cong_ty || '') === sdt);
        if (otherPerson) {
          sdtCtyNote = `Trùng SĐT Cty của NV ${otherPerson.ho_ten} (${otherPerson.ma_so_nhan_vien})`;
        }
      }

      let status: 'VALID' | 'WARNING_NO_NV' | 'UPDATE_EXISTING' | 'ERROR_DUPLICATE' | 'INVALID' = 'VALID';
      if (!sdt) {
        status = 'INVALID';
      } else if (isDuplicateInBatch) {
        status = 'ERROR_DUPLICATE';
      } else if (existingSimInDB) {
        if (batchSimModal.allowOverwrite) {
          status = 'UPDATE_EXISTING';
          errorMessage = 'SIM đã tồn tại ➔ Sẽ cập nhật/ghi đè thông tin mới';
        } else {
          status = 'ERROR_DUPLICATE';
          errorMessage = 'SĐT đã tồn tại trên CSDL';
        }
      } else if (!matchedPersonnel) {
        status = 'WARNING_NO_NV';
        errorMessage = 'Chưa khớp MSNV';
      }

      parsedRows.push({
        stt,
        msnv,
        hoTenExcel,
        soDienThoai: sdt,
        dinhMuc,
        ngayCap,
        nhaMang: 'Mobifone',
        loaiThueBao: 'Cá nhân',
        idDonVi: defaultLoc.idDonVi,
        tenDonVi: defaultLoc.tenDonVi,
        idPhapNhan: defaultLoc.idPhapNhan,
        tenPhapNhan: defaultLoc.tenPhapNhan,
        matchedPersonnel,
        sdtCtyNote,
        isDuplicate: isDuplicateInBatch || (Boolean(existingSimInDB) && !batchSimModal.allowOverwrite),
        status,
        errorMessage
      });
    });

    if (parsedRows.length === 0) {
      toast.error('Không tìm thấy dòng dữ liệu SIM hợp lệ nào từ chuỗi dán!');
      return;
    }

    setBatchSimModal(prev => ({ ...prev, previewRows: parsedRows }));
  };

  const handleConfirmBatchSIM = async () => {
    const validRows = batchSimModal.previewRows.filter(r => r.status !== 'ERROR_DUPLICATE' && r.status !== 'INVALID');
    if (validRows.length === 0) {
      toast.error('Không có dòng SIM hợp lệ để lưu!');
      return;
    }

    setBatchSimModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      for (const row of validRows) {
        const isUpdateMode = row.status === 'UPDATE_EXISTING';
        const existingSim = isUpdateMode ? thueBaoList.find(tb => parsePhoneNumberWithZero(tb.so_dien_thoai) === row.soDienThoai) : null;

        const payload: Partial<ThueBao> = {
          id: existingSim?.id || `DM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          so_dien_thoai: row.soDienThoai,
          loai_thue_bao: row.loaiThueBao || 'Cá nhân',
          nha_mang: row.nhaMang || 'Mobifone',
          id_nhan_su: row.matchedPersonnel?.id || null,
          ma_so_nv: row.matchedPersonnel?.ma_so_nhan_vien || row.msnv || '',
          ho_ten_nv: row.matchedPersonnel?.ho_ten || row.hoTenExcel || '',
          ten_bo_phan: row.matchedPersonnel?.phong_ban || '',
          id_don_vi: row.idDonVi,
          id_phap_nhan: row.idPhapNhan,
          ten_phap_nhan: row.tenPhapNhan,
          ngay_cap: row.ngayCap || new Date().toISOString().split('T')[0],
          trang_thai: 'Đang hoạt động',
          dinh_muc_cuoc: row.dinhMuc,
          lich_su_nsd: existingSim?.lich_su_nsd || [
            {
              ho_ten: row.matchedPersonnel?.ho_ten || row.hoTenExcel || 'Khai báo mới',
              ma_so_nv: row.matchedPersonnel?.ma_so_nhan_vien || row.msnv || '',
              tu_ngay: row.ngayCap || new Date().toISOString().split('T')[0],
              den_ngay: '',
              ly_do: 'Khai báo cấp phát mới hàng loạt',
              nguoi_ghi: user?.ho_ten || 'Hệ thống'
            }
          ]
        };
        await apiService.save(payload, isUpdateMode ? 'update' : 'create', 'dm_thue_bao');

        // 🟢 Đồng bộ SĐT Cty vào Hồ sơ nhân sự khi khai báo SIM mới hàng loạt
        if (row.matchedPersonnel?.id) {
          await syncPersonnelCompanyPhone(row.matchedPersonnel.id, row.soDienThoai);
        }
      }
      toast.success(`Đã thêm mới thành công ${validRows.length} thuê bao!`);
      setBatchSimModal({ open: false, rawText: '', previewRows: [], isSubmitting: false });
      loadData();
    } catch (err: any) {
      toast.error('Lỗi khi lưu danh sách SIM: ' + err.message);
    } finally {
      setBatchSimModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Render SVG Line Chart (Clean custom SVG inline, no dependencies)
  const renderSVGChart = () => {
    if (!selectedRowDetails) return null;
    const { chartPoints, nv } = selectedRowDetails;
    
    const rawSimDm = selectedRowDetails.tb.dinh_muc_cuoc !== undefined && selectedRowDetails.tb.dinh_muc_cuoc !== null ? Number(selectedRowDetails.tb.dinh_muc_cuoc) : null;
    const dinhMuc = (rawSimDm !== null && rawSimDm > 0) ? rawSimDm : null;

    // Filter points with values
    const validDataPoints = chartPoints.map((p, idx) => ({ ...p, idx }));
    const maxVal = Math.max(
      ...chartPoints.map(p => Math.max(p.tongCuoc || 0, p.dinhMuc || 0, 100000)),
      300000
    );

    // Grid details
    const width = 580;
    const height = 200;
    const padLeft = 65;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 45;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Scale helpers
    const getX = (idx: number) => padLeft + (idx / 11) * chartW;
    const getY = (val: number) => padTop + chartH - (val / maxVal) * chartH;

    // Build path points
    const pointsStr = validDataPoints
      .filter(p => p.tongCuoc !== null)
      .map(p => `${getX(p.idx)},${getY(p.tongCuoc!)}`)
      .join(' ');

    return (
      <div className="relative bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="font-bold text-xs text-gray-500 mb-2 dark:text-gray-400">BIỂU ĐỒ DIỄN BIẾN 12 THÁNG GẦN NHẤT</div>
        
        {chartTooltip.visible && (
          <div
            className="absolute z-50 p-2.5 bg-gray-800/95 dark:bg-black/95 text-white rounded-lg shadow-xl text-[10.5px] border border-gray-700 pointer-events-none"
            style={{ left: chartTooltip.x + 10, top: chartTooltip.y - 60 }}
          >
            <div className="font-bold border-b border-gray-700 pb-1 mb-1">Tháng: {chartTooltip.thang}</div>
            <div>Cước: <span className="font-bold text-blue-400">{formatCurrency(chartTooltip.tongCuoc)}đ</span></div>
            {chartTooltip.dinhMuc !== null ? (
              <>
                <div>Định mức: <span className="font-bold text-gray-300">{formatCurrency(chartTooltip.dinhMuc)}đ</span></div>
                {chartTooltip.tongCuoc > chartTooltip.dinhMuc ? (
                  <div className="text-red-400 font-bold mt-0.5">Vượt: +{formatCurrency(chartTooltip.tongCuoc - chartTooltip.dinhMuc)}đ ({Math.round((chartTooltip.tongCuoc / chartTooltip.dinhMuc) * 100)}%)</div>
                ) : (
                  <div className="text-emerald-400 font-medium mt-0.5">Trong định mức ({Math.round((chartTooltip.tongCuoc / chartTooltip.dinhMuc) * 100)}%)</div>
                )}
              </>
            ) : (
              <div className="text-blue-300 italic">Thanh toán thực tế</div>
            )}
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          {/* Y Axis Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const val = ratio * maxVal;
            const y = getY(val);
            return (
              <g key={i}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e5e7eb" strokeDasharray="3,3" className="dark:stroke-gray-800" />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" className="fill-gray-400 dark:fill-gray-600 font-bold text-[9px]">
                  {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {chartPoints.map((p, idx) => {
            const x = getX(idx);
            return (
              <g key={idx} transform={`translate(${x}, ${height - padBottom + 12})`}>
                <text transform="rotate(30)" textAnchor="start" className="fill-gray-500 dark:fill-gray-400 text-[8.5px] font-bold">
                  {p.thang.split('-')[1]}/{p.thang.split('-')[0].substring(2)}
                </text>
              </g>
            );
          })}

          {/* Dinh Muc Constant Line (If exists) */}
          {dinhMuc !== null && (
            <line
              x1={padLeft}
              y1={getY(dinhMuc)}
              x2={width - padRight}
              y2={getY(dinhMuc)}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="6,3"
              opacity="0.8"
            />
          )}

          {/* Area Fill for exceed */}
          {dinhMuc !== null && pointsStr && (
            <path
              d={`M ${padLeft} ${height - padBottom} L ${pointsStr} L ${width - padRight} ${height - padBottom} Z`}
              fill="url(#exceedGradient)"
              className="pointer-events-none opacity-10"
            />
          )}

          {/* Line Path */}
          {pointsStr && (
            <path
              d={`M ${pointsStr}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Circles points */}
          {chartPoints.map((p, idx) => {
            if (p.tongCuoc === null) return null;
            const x = getX(idx);
            const y = getY(p.tongCuoc);
            const isExceeded = p.dinhMuc !== null && p.tongCuoc > p.dinhMuc;

            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="4.5"
                className={`cursor-pointer transition-all duration-150 ${isExceeded ? 'fill-red-500 stroke-red-100 hover:scale-150 dark:stroke-red-950' : 'fill-blue-500 stroke-blue-100 hover:scale-150 dark:stroke-blue-950'}`}
                strokeWidth="2.5"
                onMouseEnter={(e) => {
                  const svgEl = e.currentTarget.ownerSVGElement;
                  if (svgEl) {
                    const rect = svgEl.getBoundingClientRect();
                    setChartTooltip({
                      x: (x / width) * rect.width,
                      y: (y / height) * rect.height,
                      thang: p.thang,
                      tongCuoc: p.tongCuoc!,
                      dinhMuc: p.dinhMuc,
                      visible: true
                    });
                  }
                }}
                onMouseLeave={() => setChartTooltip(prev => ({ ...prev, visible: false }))}
              />
            );
          })}

          {/* Gradients definitions */}
          <defs>
            <linearGradient id="exceedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {dinhMuc === null && (
          <div className="text-center text-[10.5px] font-semibold text-blue-500 italic mt-1 dark:text-blue-400">
            *SIM Thanh toán cước theo thực tế phát sinh (Không có định mức áp đặt).
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      
      {/* TOOLBAR FILTER & ACTIONS: TẤT CẢ TRÊN CÙNG 1 DÒNG */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0 shadow-sm overflow-x-auto custom-scrollbar">
        <div className="flex items-end justify-between gap-2.5 xl:gap-3.5 min-w-max w-full">
          
          {/* 1. KỲ CƯỚC */}
          <div className="shrink-0">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kỳ cước</label>
            <input
              type="month"
              value={filterThang}
              onChange={(e) => { setFilterThang(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-[#FFFFF0] dark:bg-gray-900 font-bold outline-none focus:ring-2 focus:ring-[#05469B] h-8.5"
            />
          </div>

          {/* 2. PHÁP NHÂN */}
          <div className="shrink-0">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pháp nhân</label>
            <select
              value={filterPhapNhan}
              onChange={(e) => { setFilterPhapNhan(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 font-medium outline-none focus:ring-2 focus:ring-[#05469B] max-w-[180px] xl:max-w-[200px] truncate h-8.5"
            >
              <option value="">-- Tất cả Pháp nhân --</option>
              {filteredPhapNhansForFilter.map(pn => (
                <option key={pn.id} value={pn.id}>{pn.ten_cong_ty || pn.ten_phap_nhan}</option>
              ))}
            </select>
          </div>

          {/* 3. LOẠI THUÊ BAO */}
          <div className="shrink-0">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Loại thuê bao</label>
            <select
              value={filterLoai}
              onChange={(e) => { setFilterLoai(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 font-medium outline-none focus:ring-2 focus:ring-[#05469B] h-8.5"
            >
              <option value="">-- Tất cả --</option>
              <option value="Cá nhân">Cá nhân</option>
              <option value="Bộ phận dùng chung">Bộ phận dùng chung</option>
              <option value="Hotline">Hotline</option>
            </select>
          </div>

          {/* 4. TRẠNG THÁI */}
          <div className="shrink-0">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Trạng thái</label>
            <select
              value={filterTrangThai}
              onChange={(e) => { setFilterTrangThai(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 font-medium outline-none focus:ring-2 focus:ring-[#05469B] h-8.5"
            >
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Tạm ngưng">Tạm ngưng</option>
              <option value="Đã thu hồi - Chờ tái cấp">Đã thu hồi</option>
              <option value="Đã huỷ">Đã huỷ</option>
              <option value="">Tất cả trạng thái</option>
            </select>
          </div>

          {/* 5. KIỂM SOÁT ĐỊNH MỨC */}
          <div className="shrink-0">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kiểm soát định mức</label>
            <select
              value={filterVuot}
              onChange={(e) => { setFilterVuot(e.target.value); setCurrentPage(1); }}
              className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 font-medium outline-none focus:ring-2 focus:ring-[#05469B] h-8.5"
            >
              <option value="">-- Kiểm soát ĐM --</option>
              <option value="vuot">SIM Vượt định mức</option>
              <option value="trong">SIM Trong định mức</option>
              <option value="khong_dm">SIM Thanh toán thực tế</option>
            </select>
          </div>

          {/* 6. TÌM KIẾM */}
          <div className="flex-1 min-w-[160px] max-w-[220px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Tìm SĐT, Họ tên, MSNV..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] w-full h-8.5"
              />
            </div>
          </div>

          {/* 7. NÚT THÊM (VÙNG Ô XANH) */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowAddSimModal(true)}
              className="flex items-center gap-1.5 px-4 h-8.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
            >
              <Plus size={16} />
              <span>Thêm Mới SIM</span>
            </button>
          </div>

        </div>
      </div>

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><Phone size={18}/></div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase leading-none mb-1">Tổng Số SIM</p>
            <p className="text-xl font-black text-gray-800 dark:text-gray-100 leading-none">{stats.totalSim}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><CheckCircle2 size={18}/></div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase leading-none mb-1">Đang Hoạt Động</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{stats.activeSim}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><TrendingUp size={18}/></div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase leading-none mb-1">Tổng Cước</p>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{formatCurrency(stats.totalCuoc)}đ</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><AlertCircle size={18}/></div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase leading-none mb-1">Vượt Định Mức</p>
            <p className="text-xl font-black text-red-600 dark:text-red-400 leading-none">{stats.vuotCount} SIM</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:bg-gray-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><CheckCircle2 size={18}/></div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase leading-none mb-1">Trong Định Mức</p>
            <p className="text-xl font-black text-teal-600 dark:text-teal-400 leading-none">{stats.trongCount} SIM</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:bg-gray-800 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0"><Activity size={18}/></div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase leading-none mb-1">Chưa Có Dữ Liệu</p>
            <p className="text-xl font-black text-yellow-600 dark:text-yellow-400 leading-none">{stats.noDataCount} SIM</p>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE GRID */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        
        {/* LEFT PANEL: MAIN TABLE */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden w-full">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 py-20">
                <Loader2 className="animate-spin w-8 h-8" />
                <span className="text-sm font-semibold">Đang tải dữ liệu thuê bao & cước phí...</span>
              </div>
            ) : tableRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                <Phone className="w-12 h-12 mb-2 text-gray-300 dark:text-gray-700" />
                <span className="text-sm font-bold">Không tìm thấy thuê bao điện thoại nào.</span>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse min-w-[1150px]">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 z-10">
                  <tr>
                    <th className="px-2 py-3 text-center w-10 shrink-0">STT</th>
                    <th className="px-2.5 py-3 w-24 shrink-0">Phân Loại</th>
                    <th className="px-2.5 py-3 w-28 shrink-0">Số Điện Thoại</th>
                    <th className="px-3 py-3 min-w-[300px]">Người Quản Lý / Bộ phận</th>
                    <th className="px-3 py-3 min-w-[180px]">Đơn vị</th>
                    <th className="px-3 py-3 min-w-[220px]">Pháp Nhân</th>
                    <th className="px-3 py-3 w-32 text-right shrink-0">Tổng Cước</th>
                    <th className="px-3 py-3 w-36 text-center shrink-0">Tình Trạng Cước</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedRows.map((row, idx) => {
                    const isSelected = row.tb.id === selectedThueBaoId;
                    const badge = getCuocBadge(row.tongCuoc, row.dinhMuc);
                    const orderIndex = (currentPage - 1) * pageSize + idx + 1;

                    return (
                      <tr
                        key={row.tb.id}
                        className={`cursor-pointer hover:bg-blue-50/40 dark:hover:bg-gray-700/30 transition-all ${isSelected ? 'bg-blue-50 dark:bg-gray-800/80 font-medium' : ''}`}
                        onClick={() => setSelectedThueBaoId(isSelected ? null : row.tb.id)}
                      >
                        <td className="px-2 py-2.5 text-center text-xs font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap">{orderIndex}</td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${row.tb.loai_thue_bao === 'Cá nhân' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400' : row.tb.loai_thue_bao === 'Hotline' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'}`}>
                            {row.tb.loai_thue_bao}
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold text-[#05469B] dark:text-blue-400 tabular-nums font-mono whitespace-nowrap">{formatPhoneNumber(row.tb.so_dien_thoai)}</td>
                        <td className="px-3 py-2.5 min-w-[300px]">
                          {row.tb.loai_thue_bao === 'Cá nhân' ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.tb.ho_ten_nv}</span>
                              <span className="text-[10.5px] text-gray-400 dark:text-gray-500 font-bold whitespace-nowrap">{row.tb.ma_so_nv} {row.tb.ten_bo_phan ? `| ${row.tb.ten_bo_phan}` : ''}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.tb.ten_bo_phan || 'Chưa định nghĩa bộ phận'}</span>
                              {row.tb.ho_ten_nv && <span className="text-[10.5px] text-gray-400 dark:text-gray-500 whitespace-nowrap">Phụ trách: {row.tb.ho_ten_nv} ({row.tb.ma_so_nv})</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 font-semibold min-w-[180px]">{donViList.find(d => d.id === row.tb.id_don_vi)?.ten_don_vi || '---'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 font-bold min-w-[220px]">{row.tb.ten_phap_nhan || '---'}</td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap">
                          {row.tongCuoc !== null ? `${formatCurrency(row.tongCuoc)}đ` : <span className="text-gray-300 dark:text-gray-700 font-normal">--</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={`text-[10.5px] font-bold px-2 py-0.8 rounded-lg inline-block ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Fixed Total Sum Row */}
                <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700 z-10">
                  <tr className="font-bold text-xs text-gray-700 dark:text-gray-200 text-left">
                    <td colSpan={5} className="px-3 py-2.5 text-right text-gray-500 uppercase tracking-wider">Tổng trang đang xem:</td>
                    <td className="px-3 py-2.5 text-xs font-normal text-gray-400 tabular-nums">ĐM: {formatCurrency(pageSums.dinhMuc)}đ</td>
                    <td className="px-3 py-2.5 text-right font-black text-indigo-600 dark:text-indigo-400 tabular-nums text-sm">{formatCurrency(pageSums.cuoc)}đ</td>
                    <td className="px-3 py-2.5 text-center font-black text-red-600 dark:text-red-400 tabular-nums">Vượt: +{formatCurrency(pageSums.vuot)}đ</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          {/* Footer Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={pageSize}
            totalRows={tableRows.length}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemName="thuê bao"
          />
        </div>
        {selectedRowDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
              {/* Header Details */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-[#05469B] dark:bg-blue-500 rounded-full"></div>
                  <h4 className="font-black text-[#05469B] dark:text-blue-400 text-sm uppercase">CHI TIẾT THUÊ BAO</h4>
                </div>
                <button
                  onClick={() => setSelectedThueBaoId(null)}
                  className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white dark:bg-gray-800 shadow-xs transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable details content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-white dark:bg-gray-800">
                {/* 1. Phần đầu như hiện tại (Core info box & Action buttons) */}
                <div className="bg-blue-50/30 dark:bg-gray-950/20 rounded-xl p-4 border border-blue-100/50 dark:border-gray-800">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-2xl font-black text-[#05469B] dark:text-blue-400 tracking-wide font-mono">{formatPhoneNumber(selectedRowDetails.tb.so_dien_thoai)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{selectedRowDetails.tb.nha_mang}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${getTrangThaiBadge(selectedRowDetails.tb.trang_thai)}`}>
                      {selectedRowDetails.tb.trang_thai}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs text-gray-600 dark:text-gray-300 font-medium">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-400 font-bold">Người sử dụng hiện tại:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{selectedRowDetails.tb.ho_ten_nv || '---'} {selectedRowDetails.tb.ma_so_nv ? `(${selectedRowDetails.tb.ma_so_nv})` : ''}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-400 font-bold">Đơn vị công tác:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedRowDetails.tb.ten_bo_phan || '---'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-400 font-bold">Định mức cước SIM:</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {selectedRowDetails.tb.dinh_muc_cuoc !== null && selectedRowDetails.tb.dinh_muc_cuoc !== undefined && Number(selectedRowDetails.tb.dinh_muc_cuoc) > 0
                          ? `${formatCurrency(selectedRowDetails.tb.dinh_muc_cuoc)}đ/tháng`
                          : <span className="text-blue-600 dark:text-blue-400 font-bold">TTTT (Thanh toán thực tế)</span>}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-400 font-bold">Định mức áp dụng:</span>
                      <span className="font-bold text-[#05469B] dark:text-blue-400">
                        {selectedRowDetails.dinhMuc !== null && selectedRowDetails.dinhMuc > 0 ? `${formatCurrency(selectedRowDetails.dinhMuc)}đ/tháng` : <span className="text-blue-600 dark:text-blue-400 font-bold">TTTT (Thanh toán thực tế)</span>}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-400 font-bold">Pháp nhân sở hữu:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[240px]">{selectedRowDetails.tb.ten_phap_nhan || '---'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-400 font-bold">Ngày cấp/kích hoạt SIM:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedRowDetails.tb.ngay_cap || '---'}</span>
                    </div>
                  </div>

                  {/* Nút hành động theo trạng thái hiện tại của thuê bao */}
                  {selectedRowDetails.tb && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                      {/* Nút Sửa — luôn hiện */}
                      <button
                        onClick={() => openUpdateModal(selectedRowDetails.tb)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800">
                        <Pencil size={13} /> Sửa thông tin
                      </button>

                      {/* Nút Lịch sử NSD — luôn hiện */}
                      <button
                        onClick={() => openHistoryModal(selectedRowDetails.tb)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors bg-white dark:bg-gray-800">
                        <History size={13} /> Lịch sử NSD
                      </button>

                      {/* Nút Thu hồi — chỉ hiện khi đang hoạt động */}
                      {selectedRowDetails.tb.trang_thai === 'Đang hoạt động' && (
                        <button
                          onClick={() => handleThuHoi(selectedRowDetails.tb)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-orange-300 dark:border-orange-700 text-orange-700 dark:orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors bg-white dark:bg-gray-800">
                          <ArrowLeftRight size={13} /> Thu hồi SIM
                        </button>
                      )}

                      {/* Nút Tái cấp — chỉ hiện khi đã thu hồi */}
                      {selectedRowDetails.tb.trang_thai === 'Đã thu hồi - Chờ tái cấp' && (
                        <button
                          onClick={() => handleTaiCap(selectedRowDetails.tb)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors bg-white dark:bg-gray-800">
                          <UserPlus size={13} /> Tái cấp SIM
                        </button>
                      )}

                      {/* Nút Tạm ngưng — chỉ hiện khi đang hoạt động */}
                      {selectedRowDetails.tb.trang_thai === 'Đang hoạt động' && (
                        <button
                          onClick={() => handleTamNgung(selectedRowDetails.tb)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors bg-white dark:bg-gray-800">
                          <PauseCircle size={13} /> Tạm ngưng
                        </button>
                      )}

                      {/* Nút Kích hoạt lại — chỉ hiện khi đang tạm ngưng */}
                      {selectedRowDetails.tb.trang_thai === 'Tạm ngưng' && (
                        <button
                          onClick={() => handleKichHoat(selectedRowDetails.tb)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors bg-white dark:bg-gray-800">
                          <PlayCircle size={13} /> Kích hoạt lại
                        </button>
                      )}

                      {/* Nút Huỷ SIM — hiện khi đã thu hồi hoặc tạm ngưng */}
                      {(selectedRowDetails.tb.trang_thai === 'Đã thu hồi - Chờ tái cấp' ||
                        selectedRowDetails.tb.trang_thai === 'Tạm ngưng') && (
                        <button
                          onClick={() => handleHuySIM(selectedRowDetails.tb)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors bg-white dark:bg-gray-800">
                          <XCircle size={13} /> Huỷ SIM
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Phần BIỂU ĐỒ DIỄN BIẾN 12 THÁNG GẦN NHẤT thay bằng Biểu đồ so sánh cước 12 tháng */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-2xs">
                  <ThueBaoDetailCuocChart
                    thueBao={selectedRowDetails.tb}
                    cuocList={cuocList}
                    dinhMuc={selectedRowDetails.dinhMuc}
                  />
                </div>

                {/* 3. LỊCH SỬ PHÁT SINH CƯỚC THÁNG & CẬP NHẬT CƯỚC */}
                <ThueBaoCuocHistorySection
                  thueBao={selectedRowDetails.tb}
                  cuocList={cuocList}
                  onSaved={async () => {
                    const fresh = await apiService.getCuocThang();
                    setCuocList(fresh);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL THÊM / SỬA THUÊ BẠO --- */}
      {thueBaoModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-2xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] dark:text-blue-400 flex items-center gap-2">
                <Phone size={22}/>
                {thueBaoModal.mode === 'create' ? 'Khai Báo SIM / Thuê Bao Mới' : 'Cập Nhật SIM / Thuê Bao'}
              </h3>
              <button
                onClick={() => setThueBaoModal(prev => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white dark:bg-gray-800 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveThueBao} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-white dark:bg-gray-800 text-sm">
                
                {/* ROW 1: SỐ ĐIỆN THOẠI + PHÂN LOẠI + NHÀ MẠNG */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Số điện thoại *</label>
                    <input
                      type="tel"
                      required
                      placeholder="VD: 0912345678"
                      value={thueBaoModal.data.so_dien_thoai || ''}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: { ...prev.data, so_dien_thoai: e.target.value }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Phân loại thuê bao *</label>
                    <select
                      required
                      value={thueBaoModal.data.loai_thue_bao || 'Cá nhân'}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: {
                          ...prev.data,
                          loai_thue_bao: e.target.value,
                          // Reset if switch type
                          id_nhan_su: e.target.value !== 'Cá nhân' ? '' : prev.data.id_nhan_su,
                          ma_so_nv: e.target.value !== 'Cá nhân' ? '' : prev.data.ma_so_nv,
                          ho_ten_nv: e.target.value !== 'Cá nhân' ? '' : prev.data.ho_ten_nv,
                          ten_bo_phan: e.target.value !== 'Cá nhân' ? '' : prev.data.ten_bo_phan
                        }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                    >
                      <option value="Cá nhân">Cá nhân sử dụng</option>
                      <option value="Bộ phận dùng chung">Bộ phận dùng chung</option>
                      <option value="Hotline">Hotline</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nhà mạng *</label>
                    <select
                      required
                      value={thueBaoModal.data.nha_mang || 'Viettel'}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: { ...prev.data, nha_mang: e.target.value }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                    >
                      <option value="Viettel">Viettel</option>
                      <option value="Vinaphone">Vinaphone</option>
                      <option value="Mobifone">Mobifone</option>
                      <option value="Vietnamobile">Vietnamobile</option>
                      <option value="Reddi">Reddi</option>
                    </select>
                  </div>
                </div>

                {/* ROW 3: ĐƠN VỊ SỞ HỮU + PHÁP NHÂN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Đơn vị quản lý trực tiếp *</label>
                    <select
                      required
                      value={thueBaoModal.data.id_don_vi || ''}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: { ...prev.data, id_don_vi: e.target.value }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                    >
                      <option value="">-- Chọn Đơn vị --</option>
                      {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (
                        <option key={unit.id} value={unit.id}>{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Pháp nhân sở hữu *</label>
                    <select
                      required
                      value={thueBaoModal.data.id_phap_nhan || ''}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: { ...prev.data, id_phap_nhan: e.target.value }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                    >
                      <option value="">-- Chọn Pháp nhân --</option>
                      {modalPhapNhanOptions.map(pn => (
                        <option key={pn.id} value={pn.id}>{pn.ten_cong_ty || pn.ten_phap_nhan}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* DYNAMIC SECTION BASED ON TYPE */}
                {thueBaoModal.data.loai_thue_bao === 'Cá nhân' ? (
                  <div className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900 relative space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#05469B] dark:text-blue-400 mb-1">Chọn Nhân sự sử dụng SIM *</label>
                      
                      {/* Autocomplete Field */}
                      <div className="relative w-full" ref={staffSuggestionsRef}>
                        <input
                          type="text"
                          placeholder="Tìm theo Tên hoặc Mã số nhân viên..."
                          value={staffSearchText}
                          onChange={(e) => {
                            setStaffSearchText(e.target.value);
                            setShowStaffSuggestions(true);
                          }}
                          onFocus={() => setShowStaffSuggestions(true)}
                          className="w-full p-2.5 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-gray-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          autoComplete="off"
                        />
                        {showStaffSuggestions && filteredPersonnelSuggestions.length > 0 && (
                          <ul className="absolute z-50 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredPersonnelSuggestions.map(p => (
                              <li
                                key={p.id}
                                onClick={() => selectStaff(p)}
                                className="px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-800 cursor-pointer flex justify-between items-center text-xs border-b border-gray-50 dark:border-gray-800 last:border-0"
                              >
                                <span className="font-bold text-gray-800 dark:text-gray-200">{p.ho_ten}</span>
                                <span className="text-[10px] text-gray-400 font-bold">{p.ma_so_nhan_vien} | {p.chuc_vu}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#05469B] dark:text-blue-400 mb-1">Định mức cước (VNĐ)</label>
                      <input
                        type="number"
                        placeholder="Để trống nếu thanh toán thực tế (TT) - Tự động dò theo Nhân sự chọn"
                        value={thueBaoModal.data.dinh_muc_cuoc !== null && thueBaoModal.data.dinh_muc_cuoc !== undefined ? thueBaoModal.data.dinh_muc_cuoc : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          setThueBaoModal(prev => ({
                            ...prev,
                            data: { ...prev.data, dinh_muc_cuoc: val }
                          }));
                        }}
                        className="w-full p-2.5 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">Tên bộ phận / Mục đích sử dụng *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Phòng HCNS, Hotline Bảo vệ..."
                        value={thueBaoModal.data.ten_bo_phan || ''}
                        onChange={(e) => setThueBaoModal(prev => ({
                          ...prev,
                          data: { ...prev.data, ten_bo_phan: e.target.value }
                        }))}
                        className="w-full p-2.5 border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">Nhân sự phụ trách quản lý</label>
                      
                      {/* Autocomplete for Non-Cá nhân SIM Manager */}
                      <div className="relative w-full" ref={staffSuggestionsRef}>
                        <input
                          type="text"
                          placeholder="Tìm người chịu trách nhiệm..."
                          value={staffSearchText}
                          onChange={(e) => {
                            setStaffSearchText(e.target.value);
                            setShowStaffSuggestions(true);
                          }}
                          onFocus={() => setShowStaffSuggestions(true)}
                          className="w-full p-2.5 border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                          autoComplete="off"
                        />
                        {showStaffSuggestions && filteredPersonnelSuggestions.length > 0 && (
                          <ul className="absolute z-50 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredPersonnelSuggestions.map(p => (
                              <li
                                key={p.id}
                                onClick={() => selectStaff(p)}
                                className="px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-gray-800 cursor-pointer flex justify-between items-center text-xs border-b border-gray-50 dark:border-gray-800 last:border-0"
                              >
                                <span className="font-bold text-gray-800 dark:text-gray-200">{p.ho_ten}</span>
                                <span className="text-[10px] text-gray-400 font-bold">{p.ma_so_nhan_vien}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">Định mức cước (VNĐ)</label>
                      <input
                        type="number"
                        placeholder="Để trống nếu thanh toán thực tế (TT)"
                        value={thueBaoModal.data.dinh_muc_cuoc !== null && thueBaoModal.data.dinh_muc_cuoc !== undefined ? thueBaoModal.data.dinh_muc_cuoc : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          setThueBaoModal(prev => ({
                            ...prev,
                            data: { ...prev.data, dinh_muc_cuoc: val }
                          }));
                        }}
                        className="w-full p-2.5 border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* TRANSFER CONFIRM POPUP (inline reason input) */}
                {thueBaoModal.showReasonInput && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl animate-in zoom-in-95 duration-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black text-orange-800 dark:text-orange-400">
                      <AlertCircle size={15}/>
                      XÁC NHẬN CHUYỂN GIAO THUÊ BAO
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Hệ thống phát hiện có sự thay đổi nhân sự quản lý SIM. Lịch sử sử dụng sẽ được cập nhật tự động. Vui lòng nhập lý do:</p>
                    <textarea
                      required
                      rows={2}
                      placeholder="VD: Cựu nhân viên nghỉ việc bàn giao lại SIM, Điều chuyển nội bộ..."
                      value={thueBaoModal.changeNVReason}
                      onChange={(e) => setThueBaoModal(prev => ({ ...prev, changeNVReason: e.target.value }))}
                      className="w-full p-2.5 border border-orange-300 dark:border-orange-800 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-900 text-xs resize-none"
                    ></textarea>
                  </div>
                )}

                {/* ROW 4: NGÀY CẤP + TRẠNG THÁI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ngày cấp phát SIM</label>
                    <input
                      type="date"
                      value={thueBaoModal.data.ngay_cap || ''}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: { ...prev.data, ngay_cap: e.target.value }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Trạng thái SIM *</label>
                    <select
                      required
                      value={thueBaoModal.data.trang_thai || 'Đang hoạt động'}
                      onChange={(e) => setThueBaoModal(prev => ({
                        ...prev,
                        data: { ...prev.data, trang_thai: e.target.value }
                      }))}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] font-bold"
                    >
                      <option value="Đang hoạt động">Đang hoạt động</option>
                      <option value="Tạm ngưng">Tạm ngưng sử dụng</option>
                      <option value="Đã thu hồi - Chờ tái cấp">Đã thu hồi - Chờ tái cấp</option>
                    </select>
                  </div>
                </div>

                {/* ROW 5: GHI CHÚ */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ghi chú khác</label>
                  <textarea
                    rows={2}
                    placeholder="Nhập thông tin ghi chú..."
                    value={thueBaoModal.data.ghi_chu || ''}
                    onChange={(e) => setThueBaoModal(prev => ({
                      ...prev,
                      data: { ...prev.data, ghi_chu: e.target.value }
                    }))}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#FFFFF0] dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#05469B] resize-none"
                  ></textarea>
                </div>

              </div>

              {/* FOOTER FIXED */}
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 shrink-0 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setThueBaoModal(prev => ({ ...prev, open: false }))}
                  className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-bold transition-all shadow-sm text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-xs"
                >
                  <Save size={15} /> Lưu Thuê Bao
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL LỊCH SỬ SỬ DỤNG (lich_su_nsd) --- */}
      {lichSuModal.open && lichSuModal.thueBao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-2xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] dark:text-blue-400 flex items-center gap-2">
                <History size={22}/>
                Lịch Sử Người Sử Dụng: {formatPhoneNumber(lichSuModal.thueBao.so_dien_thoai)}
              </h3>
              <button
                onClick={() => setLichSuModal(prev => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white dark:bg-gray-800 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-gray-800 text-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs text-gray-400 font-bold uppercase">Timeline các đợt chuyển giao</div>
                <button
                  type="button"
                  onClick={() => setLichSuModal(prev => ({
                    ...prev,
                    showAddForm: true,
                    editingIndex: null,
                    formData: { ho_ten: '', ma_so_nv: '', tu_ngay: '', den_ngay: '', ly_do: '' }
                  }))}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-lg text-xs flex items-center gap-1 transition-all border border-gray-200 dark:border-gray-700"
                >
                  <Plus size={13} /> Thêm Thủ Công
                </button>
              </div>

              {/* TIMELINE VIEW */}
              <div className="relative border-l-2 border-blue-100 dark:border-gray-700 ml-3 pl-5 space-y-5 py-2">
                {((): LichSuNSD[] => {
                  let list: LichSuNSD[] = [];
                  try {
                    list = typeof lichSuModal.thueBao.lich_su_nsd === 'string'
                      ? JSON.parse(lichSuModal.thueBao.lich_su_nsd)
                      : (lichSuModal.thueBao.lich_su_nsd || []);
                  } catch {
                    list = [];
                  }
                  return [...list].sort((a, b) => b.tu_ngay.localeCompare(a.tu_ngay));
                })().map((item, idx, arr) => {
                  const isCurrent = !item.den_ngay;
                  const originalIndexInStore = (() => {
                    let list: LichSuNSD[] = [];
                    try {
                      list = typeof lichSuModal.thueBao.lich_su_nsd === 'string'
                        ? JSON.parse(lichSuModal.thueBao.lich_su_nsd)
                        : (lichSuModal.thueBao.lich_su_nsd || []);
                    } catch {
                      list = [];
                    }
                    return list.findIndex(x => x.ma_so_nv === item.ma_so_nv && x.tu_ngay === item.tu_ngay);
                  })();

                  return (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2">
                      {/* Circle indicator */}
                      <span className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-gray-900 dark:text-gray-100">{item.ho_ten}</span>
                            {item.ma_so_nv && <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.2 rounded ml-2 font-bold font-mono">{item.ma_so_nv}</span>}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                            <button onClick={() => editHistoryItem(item, originalIndexInStore)} className="text-[#05469B] hover:text-[#04367a] p-1"><Edit size={12}/></button>
                            <button onClick={() => handleDeleteHistoryItem(originalIndexInStore)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={12}/></button>
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          <span className="font-semibold">Thời gian:</span> {item.tu_ngay} {item.den_ngay ? `đến ${item.den_ngay}` : 'đang sử dụng'}
                        </div>
                        <div className="text-[11.5px] text-gray-700 dark:text-gray-300 mt-1.5 font-medium">
                          <span className="font-bold text-gray-400 text-[10.5px]">Lý do:</span> {item.ly_do}
                        </div>
                        {item.nguoi_ghi && (
                          <div className="text-[10px] text-gray-400 italic text-right mt-1">Ghi nhận: {item.nguoi_ghi}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* INLINE ADD FORM */}
              {lichSuModal.showAddForm && (
                <form onSubmit={handleSaveHistoryItem} className="p-4 bg-blue-50/50 dark:bg-gray-900/50 border border-blue-200 dark:border-gray-800 rounded-xl space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="font-bold text-xs text-[#05469B] dark:text-blue-400 border-b border-blue-150 pb-1 flex justify-between">
                    <span>{lichSuModal.editingIndex !== null ? 'SỬA BẢN GHI LỊCH SỬ' : 'THÊM BẢN GHI LỊCH SỬ'}</span>
                    <button type="button" onClick={() => setLichSuModal(prev => ({ ...prev, showAddForm: false }))} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Chọn / Gõ tên nhân sự *</label>
                      <div className="relative w-full" ref={histSuggestionsRef}>
                        <input
                          type="text"
                          required
                          value={histSearchText}
                          onChange={(e) => {
                            setHistSearchText(e.target.value);
                            setLichSuModal(prev => ({
                              ...prev,
                              formData: { ...prev.formData, ho_ten: e.target.value }
                            }));
                            setShowHistSuggestions(true);
                          }}
                          onFocus={() => setShowHistSuggestions(true)}
                          className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                          placeholder="Nguyễn Văn A..."
                          autoComplete="off"
                        />
                        {showHistSuggestions && filteredHistPersonnelSuggestions.length > 0 && (
                          <ul className="absolute z-50 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl mt-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {filteredHistPersonnelSuggestions.map(p => (
                              <li
                                key={p.id}
                                onClick={() => selectHistStaff(p)}
                                className="px-2 py-2 hover:bg-blue-50 dark:hover:bg-gray-800 cursor-pointer flex justify-between text-xs"
                              >
                                <span className="font-bold text-gray-800 dark:text-gray-200">{p.ho_ten}</span>
                                <span className="text-[10px] text-gray-400">{p.ma_so_nhan_vien}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Mã NV</label>
                      <input
                        type="text"
                        value={lichSuModal.formData.ma_so_nv || ''}
                        onChange={(e) => setLichSuModal(prev => ({
                          ...prev,
                          formData: { ...prev.formData, ma_so_nv: e.target.value }
                        }))}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono font-bold"
                        placeholder="VD: 2401002"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Từ ngày *</label>
                      <input
                        type="date"
                        required
                        value={lichSuModal.formData.tu_ngay || ''}
                        onChange={(e) => setLichSuModal(prev => ({
                          ...prev,
                          formData: { ...prev.formData, tu_ngay: e.target.value }
                        }))}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Đến ngày</label>
                      <input
                        type="date"
                        value={lichSuModal.formData.den_ngay || ''}
                        onChange={(e) => setLichSuModal(prev => ({
                          ...prev,
                          formData: { ...prev.formData, den_ngay: e.target.value }
                        }))}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Lý do bàn giao / nhận SIM *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nhận SIM mới, Bàn giao nhân sự cũ nghỉ việc..."
                      value={lichSuModal.formData.ly_do || ''}
                      onChange={(e) => setLichSuModal(prev => ({
                        ...prev,
                        formData: { ...prev.formData, ly_do: e.target.value }
                      }))}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2.5">
                    <button
                      type="submit"
                      className="px-5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold shadow transition-all"
                    >
                      <Save size={13} className="inline mr-1" /> Lưu Bản Ghi Lịch Sử
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* FOOTER FIXED */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end shrink-0 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setLichSuModal(prev => ({ ...prev, open: false }))}
                className="px-8 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-bold transition-all shadow-sm text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL NHẬP CƯỚC TỪ FILE EXCEL --- */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] dark:text-blue-400 flex items-center gap-2">
                <FileSpreadsheet size={22}/>
                Nhập Cước Điện Thoại Hàng Tháng Từ Excel
              </h3>
              <button
                onClick={() => setImportModal(false)}
                className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white dark:bg-gray-800 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-white dark:bg-gray-800 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tháng cập nhật cước *</label>
                  <input
                    type="month"
                    value={importThang}
                    onChange={(e) => setImportThang(e.target.value)}
                    className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-[#FFFFF0] dark:bg-gray-900 font-bold outline-none"
                  />
                </div>
                <div className="md:col-span-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  <p className="font-extrabold text-[#05469B] dark:text-blue-400 uppercase mb-1.5 flex items-center gap-1.5">
                    💡 Hướng dẫn Copy / Paste dữ liệu cước từ Excel:
                  </p>
                  <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1.5">
                    <p className="text-[12px] text-gray-700 dark:text-gray-200">
                      Vùng dán dữ liệu (paste data) có thứ tự chuẩn <strong>8 cột</strong> từ bảng cước hàng tháng:
                    </p>
                    <div className="font-mono text-[11px] bg-white dark:bg-gray-900 p-2 rounded-lg border border-blue-200 dark:border-gray-700 text-blue-700 dark:text-blue-300 overflow-x-auto font-bold tracking-tight">
                      Số điện thoại | Định mức | Cước | Khuyến mãi | Thuế | Điều chỉnh | Nợ | Cước sử dụng
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                      📌 <strong className="text-gray-800 dark:text-gray-200">Ví dụ dòng dán từ Excel:</strong> <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">901806147 &nbsp; 200,000 &nbsp; 231,518 &nbsp; 34,728 &nbsp; 19,680 &nbsp; - &nbsp; - &nbsp; 216,470</span>
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold pt-0.5">
                      ✓ Hệ thống tự động đối chiếu <strong className="underline">Số điện thoại</strong> (dạng xxxxxxxxx hoặc 0xxxxxxxxx) với danh bạ SIM đã có sẵn trên hệ thống để gắn chính xác <strong>Cước sử dụng</strong> (cột 8) cho từng thuê bao.
                    </p>
                  </div>
                </div>
              </div>

              {/* Paste Raw input area */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Vùng dán dữ liệu (Paste data)</label>
                <textarea
                  rows={6}
                  placeholder={`Dán bảng cước 8 cột từ Excel vào đây (Ctrl + V)...\nVí dụ:\n901806147\t200,000\t231,518\t34,728\t19,680\t-\t-\t216,470\n938903526\t300,000\t310,000\t0\t31,000\t-\t-\t341,000`}
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-[#FFFFF0] dark:bg-gray-900 outline-none font-mono text-xs resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseExcel}
                  className="px-5 py-2.5 bg-[#05469B] hover:bg-[#04367a] text-white font-bold rounded-lg text-xs shadow"
                >
                  Đối chiếu & Preview Dữ liệu
                </button>
              </div>

              {/* PREVIEW CONTAINER */}
              {importPreview.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 font-bold text-xs text-gray-600 dark:text-gray-300 flex justify-between items-center flex-wrap gap-2">
                    <span>PREVIEW KẾT QUẢ ĐỐI CHIẾU CƯỚC THÁNG ({importPreview.length} DÒNG)</span>
                    <div className="flex gap-3 text-[10.5px]">
                      <span className="text-emerald-600 font-extrabold">✅ {importPreview.filter(r => r.status === 'INSERT').length} tạo mới</span>
                      <span className="text-orange-600 font-extrabold">🔄 {importPreview.filter(r => r.status === 'UPDATE').length} ghi đè cước</span>
                      <span className="text-red-500 font-extrabold">⚠️ {importPreview.filter(r => r.status === 'SKIP').length} bỏ qua</span>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-500 z-10">
                        <tr>
                          <th className="p-2 text-center w-10">STT</th>
                          <th className="p-2 w-28">SĐT (Excel)</th>
                          <th className="p-2">Thuê bao khớp CSDL</th>
                          <th className="p-2 text-right">Định mức</th>
                          <th className="p-2 text-right">Cước</th>
                          <th className="p-2 text-right">KM</th>
                          <th className="p-2 text-right">Thuế</th>
                          <th className="p-2 text-right">Điều chỉnh</th>
                          <th className="p-2 text-right">Nợ</th>
                          <th className="p-2 text-right font-black text-indigo-600 dark:text-indigo-400">Cước sử dụng</th>
                          <th className="p-2 text-center">Trạng thái</th>
                          <th className="p-2">Chi tiết lỗi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {importPreview.map((row, idx) => (
                          <tr key={idx} className={row.status === 'SKIP' ? 'bg-red-50/30 dark:bg-red-950/20' : 'hover:bg-blue-50/20'}>
                            <td className="p-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                            <td className="p-2 font-bold font-mono text-[#05469B] dark:text-blue-400">{row.sdt ? formatPhoneNumber(row.sdt) : '---'}</td>
                            <td className="p-2">
                              {row.matchedTB ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-800 dark:text-gray-200">{row.matchedTB.ho_ten_nv || row.matchedTB.ten_bo_phan || 'SIM Bộ phận'}</span>
                                  {row.matchedTB.ma_so_nv && <span className="text-[10px] text-gray-400">MSNV: {row.matchedTB.ma_so_nv}</span>}
                                </div>
                              ) : (
                                <span className="text-red-500 font-semibold italic">Chưa khớp SIM</span>
                              )}
                            </td>
                            <td className="p-2 text-right tabular-nums">{row.dinhMucExcel !== undefined && row.dinhMucExcel !== null ? `${formatCurrency(row.dinhMucExcel)}đ` : (row.matchedTB?.dinh_muc_cuoc ? `${formatCurrency(row.matchedTB.dinh_muc_cuoc)}đ` : '-')}</td>
                            <td className="p-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.cuoc !== undefined ? `${formatCurrency(row.cuoc)}đ` : '-'}</td>
                            <td className="p-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.khuyenMai !== undefined && row.khuyenMai !== 0 ? `${formatCurrency(row.khuyenMai)}đ` : '-'}</td>
                            <td className="p-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.thue !== undefined && row.thue !== 0 ? `${formatCurrency(row.thue)}đ` : '-'}</td>
                            <td className="p-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.dieuChinh !== undefined && row.dieuChinh !== 0 ? `${formatCurrency(row.dieuChinh)}đ` : '-'}</td>
                            <td className="p-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.no !== undefined && row.no !== 0 ? `${formatCurrency(row.no)}đ` : '-'}</td>
                            <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(row.cuocSuDung !== undefined ? row.cuocSuDung : row.tongCuoc)}đ</td>
                            <td className="p-2 text-center">
                              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded ${row.status === 'INSERT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : row.status === 'UPDATE' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                {row.status === 'INSERT' ? 'Tạo mới' : row.status === 'UPDATE' ? 'Cập nhật' : 'Bỏ qua'}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-red-500 font-semibold">{row.skipReason || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* FOOTER FIXED */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setImportModal(false)}
                className="px-8 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-bold transition-all shadow-sm text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || importPreview.filter(r => r.status !== 'SKIP').length === 0}
                className="px-8 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:cursor-not-allowed rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all text-xs"
              >
                {importing ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 size={15}/>}
                Xác Nhận Nhập Cước ({importPreview.filter(r => r.status !== 'SKIP').length} thuê bao)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🟢 MODAL NỔI TRỰC QUAN CHỌN TÍNH NĂNG THÊM SIM */}
      {showAddSimModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-xl w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col gap-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                    Chọn Tính Năng Thêm / Cập Nhật SIM
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                    Vui lòng chọn 1 trong 3 phương thức thao tác bên dưới:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSimModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* 3 Options Grid Cards */}
            <div className="flex flex-col gap-3.5">
              {/* Option 1: Thêm mới thủ công 1 SIM */}
              <button
                type="button"
                onClick={() => {
                  setShowAddSimModal(false);
                  openCreateModal();
                }}
                className="group p-4 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl text-left transition-all duration-200 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md shrink-0 group-hover:scale-110 transition-transform">
                  <Plus size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                      1. Thêm mới thủ công 1 SIM
                    </h4>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                      Thực hiện &rarr;
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                    Khai báo thông tin chi tiết cho 1 số điện thoại mới (Nhà mạng, Pháp nhân, Định mức, Nhân sự sở hữu).
                  </p>
                </div>
              </button>

              {/* Option 2: Thêm mới hàng loạt SIM (Excel) */}
              <button
                type="button"
                onClick={() => {
                  setShowAddSimModal(false);
                  setBatchSimModal({ open: true, rawText: '', allowOverwrite: true, previewRows: [], isSubmitting: false });
                }}
                className="group p-4 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl text-left transition-all duration-200 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shrink-0 group-hover:scale-110 transition-transform">
                  <UserPlus size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-indigo-800 dark:text-indigo-300">
                      2. Thêm mới hàng loạt SIM (Copy/Paste Excel)
                    </h4>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                      Thực hiện &rarr;
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                    Dán nhanh danh sách nhiều SIM từ Excel. Hệ thống tự động kiểm tra đối soát SĐT, MSNV và cập nhật danh bạ.
                  </p>
                </div>
              </button>

              {/* Option 3: Cập nhật cước Excel */}
              <button
                type="button"
                onClick={() => {
                  setShowAddSimModal(false);
                  setImportModal(true);
                }}
                className="group p-4 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl text-left transition-all duration-200 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="p-3 bg-[#05469B] text-white rounded-xl shadow-md shrink-0 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-[#05469B] dark:text-blue-300">
                      3. Cập nhật cước Excel (Nhập cước tháng)
                    </h4>
                    <span className="text-xs font-bold text-[#05469B] dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                      Thực hiện &rarr;
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                    Dán bảng cước 8 cột từ Excel (Số điện thoại - định mức - cước - khuyến mãi - thuế - điều chỉnh - nợ - cước sử dụng). Tự động đối chiếu SĐT để gắn cước sử dụng chính xác.
                  </p>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowAddSimModal(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng Cửa Sổ
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Custom Confirm Modal đồng bộ giao diện ứng dụng */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 shadow-sm ${
              confirmModal.variant === 'warning'
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400'
                : confirmModal.variant === 'info'
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400'
                : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400'
            }`}>
              {confirmModal.variant === 'warning' ? (
                <PauseCircle className="w-8 h-8" />
              ) : confirmModal.variant === 'info' ? (
                <PlayCircle className="w-8 h-8" />
              ) : (
                <AlertCircle className="w-8 h-8" />
              )}
            </div>
            
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-2 leading-tight">
              {confirmModal.title}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 text-xs font-medium mb-1">
              {confirmModal.description}
            </p>
            
            {confirmModal.subDescription && (
              <p className="text-red-500 dark:text-red-400 text-[11px] font-bold mt-2 bg-red-50 dark:bg-red-950/30 p-2 rounded-xl border border-red-100 dark:border-red-900/40">
                {confirmModal.subDescription}
              </p>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                {confirmModal.cancelText || 'Quay lại'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, open: false }));
                }}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer ${
                  confirmModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : confirmModal.variant === 'info'
                    ? 'bg-[#05469B] hover:bg-[#04367a]'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmModal.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thu hồi SIM */}
      {thuHoiModal.open && thuHoiModal.thueBao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
              Thu hồi SIM
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              SĐT: <span className="font-bold text-gray-700 dark:text-gray-200">
                {formatPhoneNumber(thuHoiModal.thueBao.so_dien_thoai)}
              </span>
              {' '}— NV: <span className="font-bold text-gray-700 dark:text-gray-200">
                {thuHoiModal.thueBao.ho_ten_nv || '—'}
              </span>
            </p>

            {/* Lý do */}
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Lý do thu hồi <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {['Nhân sự thôi việc', 'Chuyển công tác', 'Thu hồi theo quyết định', 'Khác'].map(opt => (
                <button key={opt}
                  type="button"
                  onClick={() => setThuHoiModal(p => ({ ...p, lyDo: opt }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    thuHoiModal.lyDo === opt
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-400'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              value={thuHoiModal.lyDo}
              onChange={e => setThuHoiModal(p => ({ ...p, lyDo: e.target.value }))}
              placeholder="Nhập hoặc chỉnh sửa lý do..."
              rows={2}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:ring-2 focus:ring-orange-400 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setThuHoiModal({ open: false, thueBao: null, lyDo: '' })}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmThuHoi}
                className="px-4 py-2 text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Xác nhận Thu hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tái cấp SIM */}
      {taiCapModal.open && taiCapModal.thueBao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
              Tái cấp SIM
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              SĐT: <span className="font-bold text-gray-700 dark:text-gray-200">
                {formatPhoneNumber(taiCapModal.thueBao.so_dien_thoai)}
              </span>
            </p>

            {/* Chọn NV mới */}
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Nhân sự nhận SIM <span className="text-red-500">*</span>
            </label>
            <CustomAutocomplete
              name="taiCapStaff"
              value={taiCapSearchText}
              onChange={(e: any) => {
                const val = e.target.value;
                setTaiCapSearchText(val);
                const matched = personnel.find(
                  (p: Personnel) => `${p.ho_ten} — ${p.ma_so_nhan_vien}` === val
                );
                if (matched) {
                  setTaiCapModal(prev => ({ ...prev, nvMoi: matched }));
                } else if (!val) {
                  setTaiCapModal(prev => ({ ...prev, nvMoi: null }));
                }
              }}
              placeholder="Tìm theo tên hoặc MSNV..."
              suggestions={personnel.map((p: Personnel) => `${p.ho_ten} — ${p.ma_so_nhan_vien}`)}
              className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
            />
            {taiCapModal.nvMoi && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5 text-sm text-green-800 dark:text-green-300 mb-3">
                ✓ {taiCapModal.nvMoi.ho_ten} — {taiCapModal.nvMoi.ma_so_nhan_vien}
                {taiCapModal.nvMoi.dinh_muc_cuoc &&
                  ` — Định mức: ${formatCurrency(taiCapModal.nvMoi.dinh_muc_cuoc)}đ`}
              </div>
            )}

            {/* Ngày tái cấp */}
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Ngày tái cấp
            </label>
            <input type="date"
              value={taiCapModal.ngayTaiCap}
              onChange={e => setTaiCapModal(p => ({ ...p, ngayTaiCap: e.target.value }))}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-green-400 mb-3"
            />

            {/* Lý do */}
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Lý do / Ghi chú
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {['Tái cấp sau thu hồi', 'Nhân sự mới', 'Điều chuyển nội bộ'].map(opt => (
                <button key={opt}
                  type="button"
                  onClick={() => setTaiCapModal(p => ({ ...p, lyDo: opt }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    taiCapModal.lyDo === opt
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-400'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              value={taiCapModal.lyDo}
              onChange={e => setTaiCapModal(p => ({ ...p, lyDo: e.target.value }))}
              placeholder="Nhập lý do..."
              rows={2}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:ring-2 focus:ring-green-400 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaiCapModal({ open: false, thueBao: null, nvMoi: null, ngayTaiCap: '', lyDo: '' })}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmTaiCap}
                disabled={!taiCapModal.nvMoi}
                className="px-4 py-2 text-sm font-bold bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Xác nhận Tái cấp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Khai Báo SIM / Thuê Bao Hàng Loạt (Copy/Paste Excel) */}
      {batchSimModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col animate-in zoom-in duration-200 overflow-hidden border border-gray-200 dark:border-gray-700">
            
            {/* HEADER */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-indigo-700 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Khai Báo SIM / Thuê Bao Hàng Loạt từ Excel</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">Copy & dán trực tiếp dữ liệu theo thứ tự cột: MSNV | Họ | Tên | SỐ ĐT | ĐỊNH MỨC | Thời gian cấp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchSimModal({ open: false, rawText: '', previewRows: [], isSubmitting: false })}
                className="hover:bg-white/20 p-2 rounded-full transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* BODY SCROLLABLE */}
            <div className="overflow-y-auto flex-1 p-6 custom-scrollbar space-y-5">
              
              {/* HUỚNG DẪN & NHẬP CHUỖI DÁN */}
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <FileSpreadsheet size={16} /> 1. Dán dữ liệu từ Excel (Ctrl + V)
                </label>
                <textarea
                  rows={4}
                  value={batchSimModal.rawText}
                  onChange={(e) => setBatchSimModal(prev => ({ ...prev, rawText: e.target.value }))}
                  placeholder={`Dán các dòng từ Excel vào đây...\nVí dụ:\n1\tNV001\tNguyễn\tVăn A\tChuyên viên\t938903526\t200000\t31/03/2016 10:46:42`}
                  className="w-full p-3 font-mono text-xs border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 custom-scrollbar resize-none"
                />
                <div className="mt-3 flex justify-between items-center flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchSimModal.allowOverwrite}
                      onChange={(e) => setBatchSimModal(prev => ({ ...prev, allowOverwrite: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span>Cho phép Cập nhật / Ghi đè thông tin nếu SĐT đã có sẵn trên CSDL</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleParseBatchSIM}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Zap size={14} /> Kiểm tra & Phân tích
                  </button>
                </div>
              </div>

              {/* BẢNG PREVIEW KẾT QUẢ ĐỐI CHIẾU */}
              {batchSimModal.previewRows.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 font-bold text-xs text-gray-700 dark:text-gray-200 flex justify-between items-center flex-wrap gap-2">
                    <span>2. DANH SÁCH THUÊ BAO CHUẨN BỊ THÊM ({batchSimModal.previewRows.length} DÒNG)</span>
                    <div className="flex gap-3 text-[11px] flex-wrap">
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">🟢 {batchSimModal.previewRows.filter(r => r.status === 'VALID').length} Hợp lệ</span>
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold">🟡 {batchSimModal.previewRows.filter(r => r.status === 'WARNING_NO_NV').length} Chưa khớp NV</span>
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">🔄 {batchSimModal.previewRows.filter(r => r.status === 'UPDATE_EXISTING').length} Ghi đè SIM cũ</span>
                      <span className="text-red-600 dark:text-red-400 font-extrabold">🔴 {batchSimModal.previewRows.filter(r => r.status === 'ERROR_DUPLICATE' || r.status === 'INVALID').length} Trùng/Lỗi</span>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 z-10">
                        <tr>
                          <th className="p-2.5 text-center w-10">STT</th>
                          <th className="p-2.5 w-24">MSNV</th>
                          <th className="p-2.5 w-28">SĐT chuẩn</th>
                          <th className="p-2.5">Nhân sự khớp CSDL</th>
                          <th className="p-2.5 w-28 text-right">Định mức</th>
                          <th className="p-2.5 w-28 text-center">Ngày cấp SIM</th>
                          <th className="p-2.5 w-28">Nhà mạng</th>
                          <th className="p-2.5 w-28">Phân loại</th>
                          <th className="p-2.5 w-36">Pháp nhân sở hữu</th>
                          <th className="p-2.5 text-center w-32">Trạng thái đối soát</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {batchSimModal.previewRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-blue-50/30 transition-colors ${
                              row.status === 'ERROR_DUPLICATE' || row.status === 'INVALID'
                                ? 'bg-red-50/40 dark:bg-red-950/30'
                                : row.status === 'WARNING_NO_NV'
                                ? 'bg-amber-50/40 dark:bg-amber-950/30'
                                : row.status === 'UPDATE_EXISTING'
                                ? 'bg-blue-50/40 dark:bg-blue-950/30'
                                : ''
                            }`}
                          >
                            <td className="p-2.5 text-center text-gray-400 font-bold">{idx + 1}</td>
                            <td className="p-2.5 font-bold font-mono text-gray-800 dark:text-gray-200">{row.msnv || '---'}</td>
                            <td className="p-2.5 font-bold font-mono text-indigo-700 dark:text-indigo-400 tabular-nums">
                              {row.soDienThoai ? formatPhoneNumber(row.soDienThoai) : <span className="text-red-500">Trống</span>}
                            </td>
                            <td className="p-2.5">
                              {row.matchedPersonnel ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-800 dark:text-gray-200">{row.matchedPersonnel.ho_ten}</span>
                                  <span className="text-[10px] text-gray-400">{row.matchedPersonnel.phong_ban || '---'}</span>
                                  {row.sdtCtyNote && (
                                    <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                      📱 {row.sdtCtyNote}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-amber-700 dark:text-amber-400 font-semibold italic">
                                    {row.hoTenExcel ? `${row.hoTenExcel} (Không khớp NV)` : 'Chưa có thông tin'}
                                  </span>
                                  {row.sdtCtyNote && (
                                    <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                      📱 {row.sdtCtyNote}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-bold tabular-nums">
                              {row.dinhMuc !== null ? `${formatCurrency(row.dinhMuc)}đ` : <span className="text-gray-400 italic">Thực tế</span>}
                            </td>
                            <td className="p-2.5 text-center font-mono text-gray-600 dark:text-gray-300">
                              {row.ngayCap ? new Date(row.ngayCap).toLocaleDateString('vi-VN') : '---'}
                            </td>
                            <td className="p-2.5">
                              <select
                                value={row.nhaMang}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchSimModal(prev => ({
                                    ...prev,
                                    previewRows: prev.previewRows.map((r, i) => i === idx ? { ...r, nhaMang: val } : r)
                                  }));
                                }}
                                className="p-1 border border-gray-200 dark:border-gray-700 rounded text-[11px] bg-white dark:bg-gray-800 font-semibold"
                              >
                                <option value="Mobifone">Mobifone</option>
                                <option value="Viettel">Viettel</option>
                                <option value="Vinaphone">Vinaphone</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <select
                                value={row.loaiThueBao}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchSimModal(prev => ({
                                    ...prev,
                                    previewRows: prev.previewRows.map((r, i) => i === idx ? { ...r, loaiThueBao: val } : r)
                                  }));
                                }}
                                className="p-1 border border-gray-200 dark:border-gray-700 rounded text-[11px] bg-white dark:bg-gray-800 font-semibold"
                              >
                                <option value="Cá nhân">Cá nhân</option>
                                <option value="Bộ phận dùng chung">Dùng chung</option>
                                <option value="Hotline">Hotline</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <select
                                value={row.idPhapNhan}
                                onChange={(e) => {
                                  const pnId = e.target.value;
                                  const pnObj = filteredPhapNhansForFilter.find(p => String(p.id) === String(pnId)) || phapNhanList.find(p => String(p.id) === String(pnId));
                                  const pnName = pnObj ? (pnObj.ten_cong_ty || pnObj.ten_phap_nhan) : '';
                                  setBatchSimModal(prev => ({
                                    ...prev,
                                    previewRows: prev.previewRows.map((r, i) => i === idx ? { ...r, idPhapNhan: pnId, tenPhapNhan: pnName } : r)
                                  }));
                                }}
                                className="p-1 border border-gray-200 dark:border-gray-700 rounded text-[11px] bg-white dark:bg-gray-800 font-semibold truncate max-w-[140px]"
                              >
                                {filteredPhapNhansForFilter.map(pn => (
                                  <option key={pn.id} value={pn.id}>{pn.ten_cong_ty || pn.ten_phap_nhan}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border ${
                                row.status === 'VALID'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : row.status === 'WARNING_NO_NV'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : row.status === 'UPDATE_EXISTING'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {row.status === 'VALID'
                                  ? '🟢 Hợp lệ'
                                  : row.status === 'WARNING_NO_NV'
                                  ? '🟡 Chưa khớp NV'
                                  : row.status === 'UPDATE_EXISTING'
                                  ? '🔄 Ghi đè SIM cũ'
                                  : `🔴 ${row.errorMessage || 'Lỗi'}`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* FOOTER FIXED */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setBatchSimModal({ open: false, rawText: '', previewRows: [], isSubmitting: false })}
                className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-xl font-bold transition-all shadow-xs text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchSIM}
                disabled={
                  batchSimModal.isSubmitting ||
                  batchSimModal.previewRows.filter(r => r.status !== 'ERROR_DUPLICATE' && r.status !== 'INVALID').length === 0
                }
                className="px-8 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-xs"
              >
                {batchSimModal.isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16}/>}
                Xác Nhận Lưu ({batchSimModal.previewRows.filter(r => r.status !== 'ERROR_DUPLICATE' && r.status !== 'INVALID').length} Thuê Bao)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
