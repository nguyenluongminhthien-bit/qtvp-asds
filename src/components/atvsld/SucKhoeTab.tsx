import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Heart, Plus, Search, Filter, Download, Upload, Trash2, Edit3,
  CheckCircle, AlertTriangle, Building2, Calendar, FileText, Activity,
  Users, DollarSign, Stethoscope, ChevronRight, BarChart3, PieChart as PieIcon, RefreshCw, X, ShieldAlert,
  Settings, ShieldCheck, FileSpreadsheet, Copy, RotateCcw, Check, ExternalLink, Layers, Sparkles, AlertCircle
} from 'lucide-react';
import { DonVi, KhamSucKhoeRecord, KhamSucKhoeCaNhanRecord, DynamicGoiKhamItem, ConfigKhamSucKhoeRecord, AnhXaGoiTapDoanItem } from '../../types';
import { getKhamSucKhoeCampaigns, saveKhamSucKhoeCampaign, deleteKhamSucKhoeCampaign, getKhamSucKhoeCaNhan, saveKhamSucKhoeCaNhanBatch, deleteKhamSucKhoeCaNhan, getPersonnel, getNhaCungCap, save, getConfigKhamSucKhoe, saveConfigKhamSucKhoe, deleteConfigKhamSucKhoe } from '../../services/api/modules';
import { formatCurrency, formatCurrencySpace } from '../../utils/formatters';
import { getAllSubordinateIds, groupParentUnits, getUnitEmoji } from '../../utils/hierarchy';
import { toast } from '../../utils/toast';
import PasteImportModal, { ColumnMapItem } from '../ui/PasteImportModal';
import { EXCEL_TEMPLATES } from '../../utils/excelTemplates';
import { useAuth } from '../../contexts/AuthContext';

const capitalizeName = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface SucKhoeTabProps {
  selectedUnitFilter: string;
  allowedDonViIds: string[];
  donViList: DonVi[];
  onReloadData?: () => void;
  activeSubTabSuckhoe?: 'tonghop' | 'canhan' | 'baocao';
  setActiveSubTabSuckhoe?: (tab: 'tonghop' | 'canhan' | 'baocao') => void;
  onTabCountsChange?: (campaignCount: number, caNhanCount: number) => void;
}

const DEFAULT_GOI_KHAM_PRESETS: DynamicGoiKhamItem[] = [
  { code: 'GK_1', label: 'GK 1 (Ngạch A6-A8)', mo_ta: 'Gói tiêu chuẩn Quản lý & Chuyên viên', price: 1200000, price_nam: 1200000, price_nu_dt: 1500000, price_nu_cgd: 1800000, max_price: 1200000, max_price_nam: 1200000, max_price_nu_dt: 1500000, max_price_nu_cgd: 1800000, ma_goi_tap_doan: 'GK3' },
  { code: 'GK_2', label: 'GK 2 (Ngạch B1-B3)', mo_ta: 'Gói tiêu chuẩn Nhân viên nghiệp vụ', price: 1000000, price_nam: 1000000, price_nu_dt: 1200000, price_nu_cgd: 1500000, max_price: 1000000, max_price_nam: 1000000, max_price_nu_dt: 1200000, max_price_nu_cgd: 1500000, ma_goi_tap_doan: 'GK4' },
  { code: 'GK_3A', label: 'GK 3A (Kho xe, Lái xe, Bảo vệ, Đón tiếp)', mo_ta: 'Gói đặc thù nhóm vận hành và an ninh', price: 1100000, price_nam: 1100000, price_nu_dt: 1300000, price_nu_cgd: 1600000, max_price: 1100000, max_price_nam: 1100000, max_price_nu_dt: 1300000, max_price_nu_cgd: 1600000, ma_goi_tap_doan: 'GK4A' },
  { code: 'GK_3B', label: 'GK 3B (Thợ, Kỹ thuật viên Xưởng)', mo_ta: 'Gói đặc thù xưởng dịch vụ', price: 1300000, price_nam: 1300000, price_nu_dt: 1500000, price_nu_cgd: 1800000, max_price: 1300000, max_price_nam: 1300000, max_price_nu_dt: 1500000, max_price_nu_cgd: 1800000, ma_goi_tap_doan: 'GK4B' },
  { code: 'GK_3C', label: 'GK 3C (Tạp vụ, Rửa xe, Phục vụ)', mo_ta: 'Gói lao động phổ thông hỗ trợ', price: 900000, price_nam: 900000, price_nu_dt: 1100000, price_nu_cgd: 1400000, max_price: 900000, max_price_nam: 900000, max_price_nu_dt: 1100000, max_price_nu_cgd: 1400000, ma_goi_tap_doan: 'GK4C' }
];

const DEFAULT_THACO_MAPPING: AnhXaGoiTapDoanItem[] = [
  { id: 'MAP_1', ma_goi_tap_doan: 'GK1', ten_goi_tap_doan: 'Gói Khám Lãnh đạo cấp cao', ngach_tap_doan: 'Ngạch A1-A3', ma_goi_don_vi: '', ten_goi_don_vi: '(Không có đối ứng tại Đơn vị)', ngach_don_vi: '' },
  { id: 'MAP_2', ma_goi_tap_doan: 'GK2', ten_goi_tap_doan: 'Gói Khám Lãnh đạo/Quản lý cấp trung', ngach_tap_doan: 'Ngạch A4-A5', ma_goi_don_vi: '', ten_goi_don_vi: '(Không có đối ứng tại Đơn vị)', ngach_don_vi: '' },
  { id: 'MAP_3', ma_goi_tap_doan: 'GK3', ten_goi_tap_doan: 'Gói Khám Quản lý / Chuyên viên cấp cao', ngach_tap_doan: 'Ngạch A6-A7', ma_goi_don_vi: 'GK_1', ten_goi_don_vi: 'GK 1 (Tiêu chuẩn Quản lý/Chuyên viên)', ngach_don_vi: 'Ngạch A6-A8' },
  { id: 'MAP_4', ma_goi_tap_doan: 'GK4', ten_goi_tap_doan: 'Gói Khám Nhân viên nghiệp vụ', ngach_tap_doan: 'Ngạch B1-B3', ma_goi_don_vi: 'GK_2', ten_goi_don_vi: 'GK 2 (Nhân viên nghiệp vụ)', ngach_don_vi: 'Ngạch B1-B3' },
  { id: 'MAP_5', ma_goi_tap_doan: 'GK4A', ten_goi_tap_doan: 'Gói Khám Nhân viên lái xe, Bảo vệ, Cây xanh', ngach_tap_doan: 'NV Lái xe, Bảo vệ, Cây xanh', ma_goi_don_vi: 'GK_3A', ten_goi_don_vi: 'GK 3A (Kho xe, Lái xe, Bảo vệ, Đón tiếp)', ngach_don_vi: 'NV Kho xe & Lái xe, Bảo vệ, Đón tiếp KH' },
  { id: 'MAP_6', ma_goi_tap_doan: 'GK4B', ten_goi_tap_doan: 'Gói Khám Thợ, Kỹ thuật viên Xưởng', ngach_tap_doan: 'Thợ, Xưởng,...', ma_goi_don_vi: 'GK_3B', ten_goi_don_vi: 'GK 3B (Thợ, Kỹ thuật viên Xưởng)', ngach_don_vi: 'Thợ, Kỹ thuật viên Xưởng Dịch vụ,...' },
  { id: 'MAP_7', ma_goi_tap_doan: 'GK4C', ten_goi_tap_doan: 'Gói Khám Tạp vụ, Phục vụ, Rửa xe', ngach_tap_doan: 'Tạp vụ, Lao động phổ thông', ma_goi_don_vi: 'GK_3C', ten_goi_don_vi: 'GK 3C (Tạp vụ, Rửa xe, Phục vụ)', ngach_don_vi: 'Tạp vụ, Phục vụ, Rửa xe' }
];

// Helper đảm bảo dữ liệu dạng mảng JSON an toàn, chống crash khi dữ liệu từ Supabase là chuỗi hoặc object
const ensureArray = <T,>(val: any, fallback: T[] = []): T[] => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch { }
  }
  return fallback;
};

// Helper format ngày thành dd/mm/yyyy an toàn, hỗ trợ dải ngày "Từ đến Đến"
export const formatDateVN = (dateInput?: string | null): string => {
  if (!dateInput) return '—';
  const trimmed = String(dateInput).trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return '—';

  // Hỗ trợ trường hợp dải ngày: "2026-08-15 đến 2026-08-20", "2026-08-15 - 2026-08-20", "2026-08-15 → 2026-08-20"
  if (trimmed.includes(' đến ') || trimmed.includes(' - ') || trimmed.includes(' → ')) {
    const separator = trimmed.includes(' đến ') ? ' đến ' : trimmed.includes(' - ') ? ' - ' : ' → ';
    const parts = trimmed.split(separator);
    const start = parts[0]?.trim();
    const end = parts[1]?.trim();

    const formattedStart = start ? formatDateVN(start) : '';
    const formattedEnd = end ? formatDateVN(end) : '';

    if (formattedStart && formattedEnd && formattedStart !== '—' && formattedEnd !== '—') {
      if (formattedStart === formattedEnd) return formattedStart;
      return `${formattedStart} - ${formattedEnd}`;
    }
    if (formattedStart && formattedStart !== '—') return formattedStart;
    if (formattedEnd && formattedEnd !== '—') return formattedEnd;
    return '—';
  }

  // Khớp định dạng YYYY-MM-DD hoặc YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(-2)}`;
  }

  // Khớp nếu đã là DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(-2)}`;
  }

  // Thử parse qua Date object nếu có thời gian ISO
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return trimmed;
};

// Helper format ngày rút gọn thành dd/mm hoặc dd/mm - dd/mm
export const formatDateShort = (dateInput?: string | null): string => {
  if (!dateInput) return '—';
  const trimmed = String(dateInput).trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return '—';

  // Hỗ trợ trường hợp dải ngày: "2026-08-15 đến 2026-08-20", "2026-08-15 - 2026-08-20", "2026-08-15 → 2026-08-20"
  if (trimmed.includes(' đến ') || trimmed.includes(' - ') || trimmed.includes(' → ')) {
    const separator = trimmed.includes(' đến ') ? ' đến ' : trimmed.includes(' - ') ? ' - ' : ' → ';
    const parts = trimmed.split(separator);
    const start = parts[0]?.trim();
    const end = parts[1]?.trim();

    const formattedStart = start ? formatDateShort(start) : '';
    const formattedEnd = end ? formatDateShort(end) : '';

    if (formattedStart && formattedEnd && formattedStart !== '—' && formattedEnd !== '—') {
      if (formattedStart === formattedEnd) return formattedStart;
      return `${formattedStart} - ${formattedEnd}`;
    }
    if (formattedStart && formattedStart !== '—') return formattedStart;
    if (formattedEnd && formattedEnd !== '—') return formattedEnd;
    return '—';
  }

  // Khớp định dạng YYYY-MM-DD hoặc YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const [, , month, day] = ymdMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
  }

  // Khớp nếu đã là DD/MM hoặc DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?/);
  if (dmyMatch) {
    const [, day, month] = dmyMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
  }

  // Thử parse qua Date object nếu có thời gian ISO
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  return trimmed;
};

export default function SucKhoeTab({
  selectedUnitFilter,
  allowedDonViIds,
  donViList,
  onReloadData,
  activeSubTabSuckhoe,
  setActiveSubTabSuckhoe,
  onTabCountsChange
}: SucKhoeTabProps) {
  const { user } = useAuth();
  const isAdmin = useMemo(() => String(user?.quyen || '').toUpperCase() === 'ADMIN', [user]);

  // State chính
  const [loading, setLoading] = useState<boolean>(true);
  const [campaigns, setCampaigns] = useState<KhamSucKhoeRecord[]>([]);
  const [caNhanList, setCaNhanList] = useState<KhamSucKhoeCaNhanRecord[]>([]);
  const [nhanSuList, setNhanSuList] = useState<any[]>([]);
  const [nccList, setNccList] = useState<any[]>([]);

  // State Cấu hình Thông báo & Định mức Gói khám (Admin)
  const [configs, setConfigs] = useState<ConfigKhamSucKhoeRecord[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [editingConfig, setEditingConfig] = useState<ConfigKhamSucKhoeRecord | null>(null);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [selectedConfigForCampaign, setSelectedConfigForCampaign] = useState<ConfigKhamSucKhoeRecord | null>(null);

  // State chế độ gói Tập đoàn mẹ riêng cho VPĐH / Phân phối (chỉ dành cho Admin)
  const [isCorporatePackageMode, setIsCorporatePackageMode] = useState<boolean>(false);

  // State bộ lọc & tìm kiếm
  const [selectedNam, setSelectedNam] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [localActiveSubTab, setLocalActiveSubTab] = useState<'tonghop' | 'canhan' | 'baocao'>('tonghop');
  const activeSubTab = activeSubTabSuckhoe !== undefined ? activeSubTabSuckhoe : localActiveSubTab;
  const setActiveSubTab = setActiveSubTabSuckhoe !== undefined ? setActiveSubTabSuckhoe : setLocalActiveSubTab;

  // State cho Tab Báo cáo tổng hợp
  const [baocaoNam, setBaocaoNam] = useState<string>(String(new Date().getFullYear()));
  const [baocaoViewMode, setBaocaoViewMode] = useState<'quydoi_tapdoan' | 'matran_donvi'>('quydoi_tapdoan');
  const [baocaoScope, setBaocaoScope] = useState<string>('ALL');

  // State modal đợt khám tổng hợp
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false);
  const [editingCampaign, setEditingCampaign] = useState<KhamSucKhoeRecord | null>(null);
  const [savingCampaign, setSavingCampaign] = useState<boolean>(false);

  // State dynamic gói khám trong form modal đợt khám
  const [formGoiKhamSchema, setFormGoiKhamSchema] = useState<DynamicGoiKhamItem[]>(DEFAULT_GOI_KHAM_PRESETS);
  const [formGoiKhamBnnSchema, setFormGoiKhamBnnSchema] = useState<DynamicGoiKhamItem[]>([]);
  const [newPackageCode, setNewPackageCode] = useState<string>('');
  const [newPackageLabel, setNewPackageLabel] = useState<string>('');
  const [newBnnPackageCode, setNewBnnPackageCode] = useState<string>('');
  const [newBnnPackageLabel, setNewBnnPackageLabel] = useState<string>('');

  // State modal Dán Excel cá nhân
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [targetCampaignForPaste, setTargetCampaignForPaste] = useState<KhamSucKhoeRecord | null>(null);

  // State modal Thêm mới NCC Nhanh
  const [isQuickAddNccOpen, setIsQuickAddNccOpen] = useState<boolean>(false);
  const [quickNccTarget, setQuickNccTarget] = useState<'ksk' | 'bnn'>('ksk');
  const [savingQuickNcc, setSavingQuickNcc] = useState<boolean>(false);
  const [newNccForm, setNewNccForm] = useState({
    ten_cong_ty: '',
    dau_moi: '',
    sdt_dau_moi: '',
    dia_chi: '',
    nhom_dich_vu: 'Sức khỏe'
  });

  // State chế độ xem KSK cá nhân: 'matrix' (Ma trận nằm ngang 1 dòng/NV) hoặc 'list' (Chi tiết từng dòng)
  const [caNhanViewMode, setCaNhanViewMode] = useState<'matrix' | 'list'>('matrix');
  const [expandedMsnv, setExpandedMsnv] = useState<string | null>(null);

  // State confirm modal xóa đợt khám & cá nhân đồng bộ UI
  const [confirmDeleteType, setConfirmDeleteType] = useState<'CAMPAIGN' | 'CA_NHAN' | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleSaveQuickNcc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNccForm.ten_cong_ty.trim()) {
      toast.error("Vui lòng nhập Tên bệnh viện / Nhà cung cấp");
      return;
    }

    setSavingQuickNcc(true);
    try {
      const payload = {
        ...newNccForm,
        trang_thai: 'Đang hợp tác',
        id_don_vi: editingCampaign?.id_don_vi || selectedUnitFilter
      };

      const savedNcc = await save(payload, 'create', 'dm_ncc');
      setNccList(prev => [savedNcc, ...prev]);

      if (editingCampaign) {
        if (quickNccTarget === 'bnn') {
          setEditingCampaign({
            ...editingCampaign,
            id_ncc_bnn: savedNcc.id,
            ten_ncc_bnn: savedNcc.ten_cong_ty
          });
        } else {
          setEditingCampaign({
            ...editingCampaign,
            id_ncc: savedNcc.id,
            ten_ncc: savedNcc.ten_cong_ty
          });
        }
      }

      toast.success("Đã thêm mới Nhà cung cấp thành công!");
      setIsQuickAddNccOpen(false);
      setNewNccForm({
        ten_cong_ty: '',
        dau_moi: '',
        sdt_dau_moi: '',
        dia_chi: '',
        nhom_dich_vu: 'Sức khỏe'
      });
    } catch (err: any) {
      toast.error(`Lỗi thêm NCC: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setSavingQuickNcc(false);
    }
  };

  // Map tra cứu đơn vị
  const donViMap = useMemo(() => {
    const map = new Map<string, DonVi>();
    donViList.forEach(u => map.set(u.id, u));
    return map;
  }, [donViList]);

  // Danh sách Nhà cung cấp lọc tự động theo Nhóm dịch vụ "Sức khỏe"
  const healthNccList = useMemo(() => {
    const healthSuppliers = nccList.filter(n => {
      const g = String(n.nhom_dich_vu || '').toLowerCase();
      return g.includes('sức khỏe') || g.includes('suc khoe') || g.includes('y tế') || g.includes('y te');
    });
    return healthSuppliers.length > 0 ? healthSuppliers : nccList;
  }, [nccList]);

  // Thuật toán Lọc Đơn Vị chính xác đệ quy (targetUnitIds)
  const targetUnitIds = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL' || selectedUnitFilter === 'HO') {
      return allowedDonViIds.length > 0 ? allowedDonViIds : [];
    }
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    const set = new Set([selectedUnitFilter, ...subIds]);
    if (allowedDonViIds.length > 0) {
      return Array.from(set).filter(id => allowedDonViIds.includes(id));
    }
    return Array.from(set);
  }, [selectedUnitFilter, allowedDonViIds, donViList]);

  // Tải dữ liệu ban đầu tối ưu tốc độ (Tải thêm danh sách Nhân sự để phục vụ đối chiếu lịch sử)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cData, cnData, nccData, nsData, cfgData] = await Promise.all([
          getKhamSucKhoeCampaigns().catch(() => []),
          getKhamSucKhoeCaNhan().catch(() => []),
          getNhaCungCap().catch(() => []),
          getPersonnel().catch(() => []),
          getConfigKhamSucKhoe().catch(() => [])
        ]);

        setCampaigns(Array.isArray(cData) ? cData : []);
        setCaNhanList(Array.isArray(cnData) ? cnData : []);
        setNccList(Array.isArray(nccData) ? nccData : []);
        setNhanSuList(Array.isArray(nsData) ? nsData : []);
        setConfigs(Array.isArray(cfgData) ? cfgData : []);
      } catch (err: any) {
        console.error("🔴 Lỗi tải dữ liệu KSK:", err);
        toast.error("Không thể tải dữ liệu Khám sức khỏe");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Danh sách các Năm có dữ liệu
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    campaigns.forEach(c => { if (c.nam_kham) years.add(Number(c.nam_kham)); });
    caNhanList.forEach(cn => { if (cn.nam_kham) years.add(Number(cn.nam_kham)); });
    return Array.from(years).sort((a, b) => b - a);
  }, [campaigns, caNhanList]);

  // Lọc dữ liệu Đợt khám tổng hợp theo Đơn vị và Năm
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(item => {
      // Lọc đơn vị đệ quy chuẩn xác
      if (targetUnitIds.length > 0 && !targetUnitIds.includes(item.id_don_vi)) {
        return false;
      }

      // Lọc năm
      if (selectedNam !== 'ALL' && Number(item.nam_kham) !== Number(selectedNam)) {
        return false;
      }

      // Lọc từ khóa
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const unitName = donViMap.get(item.id_don_vi)?.ten_don_vi || '';
        const nccName = item.ten_ncc || '';
        const nccBnnName = item.ten_ncc_bnn || '';
        const title = item.ten_dot_kham || '';
        return (
          unitName.toLowerCase().includes(term) ||
          nccName.toLowerCase().includes(term) ||
          nccBnnName.toLowerCase().includes(term) ||
          title.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [campaigns, targetUnitIds, selectedNam, searchTerm, donViMap]);

  // Lọc dữ liệu KSK Cá nhân Nhân sự theo Đơn vị và Năm (Tách biệt logic lọc theo Matrix View và List View)
  const filteredCaNhanList = useMemo(() => {
    // Tạo tập hợp MSNV của nhân sự thuộc đơn vị hiện tại (bao gồm các đơn vị con trực thuộc)
    const activeMsnvsInTargetUnits = new Set(
      nhanSuList
        .filter(ns => targetUnitIds.includes(ns.id_don_vi) && ns.trang_thai !== 'Đã nghỉ việc')
        .map(ns => String(ns.ma_so_nhan_vien || '').trim().toLowerCase())
    );

    return caNhanList.filter(item => {
      if (caNhanViewMode === 'matrix') {
        // 1. Chế độ Ma Trận: Lọc theo Đơn vị hiện tại của nhân sự
        const itemMsnv = String(item.ma_so_nhan_vien || '').trim().toLowerCase();
        if (targetUnitIds.length > 0 && !activeMsnvsInTargetUnits.has(itemMsnv)) {
          return false;
        }
      } else {
        // 2. Chế độ Bảng Chi Tiết (List View): Lọc theo Đơn vị lúc khám thực tế trên bản ghi KSK
        if (targetUnitIds.length > 0 && !targetUnitIds.includes(item.id_don_vi)) {
          return false;
        }
      }

      // Lọc năm
      if (selectedNam !== 'ALL' && Number(item.nam_kham) !== Number(selectedNam)) {
        return false;
      }

      // Lọc từ khóa (Họ tên, MSNV, Đơn vị cũ lúc khám)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = item.ho_ten || '';
        const msnv = item.ma_so_nhan_vien || '';
        const unitName = donViMap.get(item.id_don_vi)?.ten_don_vi || '';
        return (
          name.toLowerCase().includes(term) ||
          msnv.toLowerCase().includes(term) ||
          unitName.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [caNhanList, nhanSuList, targetUnitIds, selectedNam, searchTerm, donViMap, caNhanViewMode]);

  const onTabCountsChangeRef = useRef(onTabCountsChange);
  useEffect(() => {
    onTabCountsChangeRef.current = onTabCountsChange;
  });

  useEffect(() => {
    if (onTabCountsChangeRef.current) {
      onTabCountsChangeRef.current(filteredCampaigns.length, filteredCaNhanList.length);
    }
  }, [filteredCampaigns.length, filteredCaNhanList.length]);

  // Các Năm xuất hiện trong dữ liệu phục vụ dựng Cột Ma Trận
  const matrixYears = useMemo(() => {
    const yearsSet = new Set<number>();
    filteredCaNhanList.forEach(r => {
      if (r.nam_kham) yearsSet.add(Number(r.nam_kham));
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [filteredCaNhanList]);

  // Gộp dữ liệu KSK Cá nhân theo từng Nhân sự (Ma trận 1 Dòng / CB-NV)
  const groupedEmployeeMatrix = useMemo(() => {
    // Map nhanh để tra cứu đơn vị hiện tại của nhân sự
    const employeeUnitMap = new Map<string, string>();
    nhanSuList.forEach(ns => {
      if (ns.ma_so_nhan_vien) {
        employeeUnitMap.set(String(ns.ma_so_nhan_vien).trim().toLowerCase(), ns.id_don_vi);
      }
    });

    const map = new Map<string, {
      msnv: string;
      ho_ten: string;
      id_don_vi: string;
      recordsByYear: Map<number, KhamSucKhoeCaNhanRecord>;
      allRecords: KhamSucKhoeCaNhanRecord[];
    }>();

    filteredCaNhanList.forEach(item => {
      const key = String(item.ma_so_nhan_vien || '').trim().toLowerCase();
      if (!key) return;

      const existing = map.get(key) || {
        msnv: item.ma_so_nhan_vien,
        ho_ten: item.ho_ten,
        id_don_vi: employeeUnitMap.get(key) || item.id_don_vi, // Ưu tiên đơn vị hiện tại
        recordsByYear: new Map<number, KhamSucKhoeCaNhanRecord>(),
        allRecords: []
      };

      const nam = Number(item.nam_kham);
      existing.recordsByYear.set(nam, item);
      existing.allRecords.push(item);
      map.set(key, existing);
    });

    return Array.from(map.values());
  }, [filteredCaNhanList, nhanSuList]);

  // Tổng hợp chỉ số KPI
  const kpiStats = useMemo(() => {
    let totalDangKy = 0;
    let totalThucTe = 0;
    let totalKhongKham = 0;
    let totalChiPhi = 0;
    let totalLoai1 = 0;
    let totalLoai2 = 0;
    let totalLoai3 = 0;
    let totalLoai4 = 0;
    let totalLoai5 = 0;
    let totalBnnKham = 0;
    let totalBnnMac = 0;
    let totalBnnNguyCo = 0;

    filteredCampaigns.forEach(c => {
      totalDangKy += Number(c.sl_dang_ky || 0);
      totalThucTe += Number(c.sl_thuc_te || 0);
      totalKhongKham += Number(c.sl_khong_kham || 0);
      totalChiPhi += Number(c.tong_chi_phi || 0);

      const kq = c.ket_qua_ksk_json || {};
      totalLoai1 += Number(kq.loai_1 || 0);
      totalLoai2 += Number(kq.loai_2 || 0);
      totalLoai3 += Number(kq.loai_3 || 0);
      totalLoai4 += Number(kq.loai_4 || 0);
      totalLoai5 += Number(kq.loai_5 || 0);

      const bnn1 = c.bnn_lan_1_json || {};
      const bnn2 = c.bnn_lan_2_json || {};
      totalBnnKham += Number(bnn1.sl_kham || 0) + Number(bnn2.sl_kham || 0);
      totalBnnMac += Number(bnn1.sl_mac_bnn || 0) + Number(bnn2.sl_mac_bnn || 0);
      totalBnnNguyCo += Number(bnn1.sl_nguy_co || 0) + Number(bnn2.sl_nguy_co || 0);
    });

    const completionRate = totalDangKy > 0 ? ((totalThucTe / totalDangKy) * 100).toFixed(1) : '0';
    const goodHealthRate = totalThucTe > 0 ? (((totalLoai1 + totalLoai2) / totalThucTe) * 100).toFixed(1) : '0';
    const weakHealthRate = totalThucTe > 0 ? (((totalLoai4 + totalLoai5) / totalThucTe) * 100).toFixed(1) : '0';

    return {
      totalDangKy,
      totalThucTe,
      totalKhongKham,
      totalChiPhi,
      completionRate,
      goodHealthRate,
      weakHealthRate,
      totalLoai1,
      totalLoai2,
      totalLoai3,
      totalLoai4,
      totalLoai5,
      totalBnnKham,
      totalBnnMac,
      totalBnnNguyCo
    };
  }, [filteredCampaigns]);

  // Dữ liệu Biểu đồ So sánh Các Đơn vị (Cross-Unit Comparison Data)
  const unitComparisonData = useMemo(() => {
    const map = new Map<string, {
      unitName: string;
      dangKy: number;
      thucTe: number;
      loai12: number;
      loai3: number;
      loai45: number;
      bnn: number;
    }>();

    filteredCampaigns.forEach(c => {
      const uId = c.id_don_vi;
      const uName = donViMap.get(uId)?.ten_don_vi || 'Đơn vị khác';
      const existing = map.get(uId) || {
        unitName: uName,
        dangKy: 0,
        thucTe: 0,
        loai12: 0,
        loai3: 0,
        loai45: 0,
        bnn: 0
      };

      existing.dangKy += Number(c.sl_dang_ky || 0);
      existing.thucTe += Number(c.sl_thuc_te || 0);

      const kq = c.ket_qua_ksk_json || {};
      existing.loai12 += Number(kq.loai_1 || 0) + Number(kq.loai_2 || 0);
      existing.loai3 += Number(kq.loai_3 || 0);
      existing.loai45 += Number(kq.loai_4 || 0) + Number(kq.loai_5 || 0);

      const bnn1 = c.bnn_lan_1_json || {};
      const bnn2 = c.bnn_lan_2_json || {};
      existing.bnn += Number(bnn1.sl_mac_bnn || 0) + Number(bnn2.sl_mac_bnn || 0) + Number(bnn1.sl_nguy_co || 0) + Number(bnn2.sl_nguy_co || 0);

      map.set(uId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.thucTe - a.thucTe);
  }, [filteredCampaigns, donViMap]);

  // 🟢 KIỂM TRA ĐƠN GIÁ VƯỢT ĐỊNH MỨC THÔNG BÁO (CEILING ENFORCEMENT)
  const ceilingViolations = useMemo(() => {
    // Nếu là Admin và bật chế độ gói Tập đoàn riêng cho VPĐH / Phân phối thì không bị ràng buộc bởi định mức đơn vị
    if (isAdmin && isCorporatePackageMode) return [];

    const violations: { code: string; label: string; field: string; price: number; maxPrice: number }[] = [];

    ensureArray(formGoiKhamSchema).forEach(gk => {
      if (gk.max_price && gk.price && gk.price > gk.max_price) {
        violations.push({ code: gk.code, label: gk.label, field: 'Chung', price: gk.price, maxPrice: gk.max_price });
      }
      if (gk.max_price_nam && gk.price_nam && gk.price_nam > gk.max_price_nam) {
        violations.push({ code: gk.code, label: gk.label, field: 'Nam', price: gk.price_nam, maxPrice: gk.max_price_nam });
      }
      if (gk.max_price_nu_dt && gk.price_nu_dt && gk.price_nu_dt > gk.max_price_nu_dt) {
        violations.push({ code: gk.code, label: gk.label, field: 'Nữ Độc thân', price: gk.price_nu_dt, maxPrice: gk.max_price_nu_dt });
      }
      if (gk.max_price_nu_cgd && gk.price_nu_cgd && gk.price_nu_cgd > gk.max_price_nu_cgd) {
        violations.push({ code: gk.code, label: gk.label, field: 'Nữ Có gia đình', price: gk.price_nu_cgd, maxPrice: gk.max_price_nu_cgd });
      }
    });

    ensureArray(formGoiKhamBnnSchema).forEach(gk => {
      if (gk.max_price && gk.price && gk.price > gk.max_price) {
        violations.push({ code: gk.code, label: gk.label, field: 'BNN', price: gk.price, maxPrice: gk.max_price });
      }
    });

    return violations;
  }, [formGoiKhamSchema, formGoiKhamBnnSchema, isAdmin, isCorporatePackageMode]);

  // Tiện ích: Đặt lại giá theo Định mức Thông báo
  const handleResetPricesToCeiling = () => {
    setFormGoiKhamSchema(prev => ensureArray(prev).map(gk => ({
      ...gk,
      price: gk.max_price || gk.price,
      price_nam: gk.max_price_nam || gk.price_nam,
      price_nu_dt: gk.max_price_nu_dt || gk.price_nu_dt,
      price_nu_cgd: gk.max_price_nu_cgd || gk.price_nu_cgd
    })));
    setFormGoiKhamBnnSchema(prev => ensureArray(prev).map(gk => ({
      ...gk,
      price: gk.max_price || gk.price
    })));
    toast.success("Đã đồng bộ đơn giá về đúng Định mức Thông báo!");
  };

  // Tiện ích: Quét nhanh số lượng nhân sự thực tế của Đơn vị từ CSDL ns_dich_vu
  const handleQuickScanUnitPersonnel = () => {
    if (!editingCampaign) return;
    const unitId = editingCampaign.id_don_vi;
    if (!unitId) {
      toast.warning("Vui lòng chọn Đơn vị thực hiện trước khi quét số lượng");
      return;
    }

    const subIds = getAllSubordinateIds(unitId, donViList);
    const unitAllIds = [unitId, ...subIds];
    const unitEmps = nhanSuList.filter(ns => unitAllIds.includes(ns.id_don_vi) && ns.trang_thai !== 'Đã nghỉ việc');

    let countNam = 0;
    let countNuDt = 0;
    let countNuCgd = 0;

    unitEmps.forEach(emp => {
      const isNam = String(emp.gioi_tinh || '').toLowerCase() === 'nam';
      const honNhan = String(emp.hon_nhan || '').toLowerCase();
      const isNuDt = !isNam && (honNhan.includes('độc thân') || honNhan.includes('chưa'));
      if (isNam) countNam++;
      else if (isNuDt) countNuDt++;
      else countNuCgd++;
    });

    const totalEmps = countNam + countNuDt + countNuCgd;
    const newValues: Record<string, number> = { ...(editingCampaign.goi_kham_values || {}) };

    if (formGoiKhamSchema.length > 0) {
      const firstCode = formGoiKhamSchema[0].code;
      if (!newValues[firstCode] || newValues[firstCode] === 0) {
        newValues[firstCode] = totalEmps;
      }
    }

    setEditingCampaign({
      ...editingCampaign,
      sl_dang_ky: totalEmps,
      sl_thuc_te: totalEmps,
      goi_kham_values: newValues
    });

    toast.success(`Đã quét ${totalEmps} nhân sự từ CSDL (Nam: ${countNam}, Nữ ĐT: ${countNuDt}, Nữ CGĐ: ${countNuCgd})! Bạn hãy xem lại theo thực tế.`);
  };

  // 🟢 QUẢN LÝ CẤU HÌNH THÔNG BÁO & ĐỊNH MỨC DÀNH CHO ADMIN
  const handleOpenConfigModal = (cfg?: ConfigKhamSucKhoeRecord) => {
    const rawCfg = cfg || (configs.length > 0 ? (configs.find(c => c.trang_thai === 'DANG_AP_DUNG') || configs[0]) : null);
    if (rawCfg) {
      const cloned = JSON.parse(JSON.stringify(rawCfg));
      setEditingConfig({
        ...cloned,
        goi_kham_schema: ensureArray(cloned.goi_kham_schema, DEFAULT_GOI_KHAM_PRESETS),
        goi_kham_bnn_schema: ensureArray(cloned.goi_kham_bnn_schema, []),
        bang_anh_xa_tap_doan: ensureArray(cloned.bang_anh_xa_tap_doan, DEFAULT_THACO_MAPPING)
      });
    } else {
      // Nếu CSDL chưa có thông báo nào, tự động chuyển sang form tạo mới tinh
      handleCreateNewConfig();
      return;
    }
    setIsConfigModalOpen(true);
  };

  // Tạo mới một cấu hình thông báo trắng (không dính mã mẫu)
  const handleCreateNewConfig = () => {
    const curYear = new Date().getFullYear();
    setEditingConfig({
      id: '',
      nam: curYear,
      loai_dot_kham: 'KSK_VA_BNN',
      so_hieu_thong_bao: '',
      tieu_de_thong_bao: `Thông báo về việc triển khai khám sức khỏe định kỳ & Bệnh nghề nghiệp năm ${curYear}`,
      ngay_ban_hanh: new Date().toISOString().split('T')[0],
      trang_thai: 'DANG_AP_DUNG',
      goi_kham_schema: JSON.parse(JSON.stringify(DEFAULT_GOI_KHAM_PRESETS)),
      goi_kham_bnn_schema: [
        { code: 'BNN_BUI', label: 'Khám BNN Bụi phổi (Chụp X-Quang chuẩn ILO)', price: 350000, max_price: 350000 },
        { code: 'BNN_ON', label: 'Khám BNN Điếc nghề nghiệp (Đo thính lực dải tần)', price: 250000, max_price: 250000 },
        { code: 'BNN_HOA_CHAT', label: 'Khám BNN Nhiễm độc dung môi / Hóa chất sơn xưởng', price: 450000, max_price: 450000 }
      ],
      bang_anh_xa_tap_doan: JSON.parse(JSON.stringify(DEFAULT_THACO_MAPPING)),
      ghi_chu: ''
    });
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    if (!editingConfig.so_hieu_thong_bao.trim()) {
      toast.error("Vui lòng nhập Số hiệu thông báo");
      return;
    }

    setSavingConfig(true);
    try {
      // Xóa cache trình duyệt để chống dữ liệu cũ còn tồn đọng
      try {
        localStorage.removeItem('SMART_CACHE_config_kham_suc_khoe');
        localStorage.removeItem('mock_config_kham_suc_khoe');
      } catch (e) { }

      // Chuẩn hóa và làm sạch toàn bộ dữ liệu cấu hình trước khi gửi lên Supabase
      const curYear = Number(editingConfig.nam) || new Date().getFullYear();
      const payloadToSave: ConfigKhamSucKhoeRecord = {
        ...editingConfig,
        id: editingConfig.id || `CFG_KSK_${Date.now()}`,
        nam: curYear,
        so_hieu_thong_bao: editingConfig.so_hieu_thong_bao.trim(),
        tieu_de_thong_bao: editingConfig.tieu_de_thong_bao?.trim() || `Thông báo về việc triển khai khám sức khỏe định kỳ & BNN năm ${curYear}`,
        ngay_ban_hanh: editingConfig.ngay_ban_hanh || new Date().toISOString().split('T')[0],
        trang_thai: editingConfig.trang_thai || 'DANG_AP_DUNG',
        goi_kham_schema: (editingConfig.goi_kham_schema || []).map(g => ({
          ...g,
          code: (g.code || '').trim().toUpperCase(),
          label: (g.label || '').trim(),
          price: Number(g.price) || 0,
          price_nam: Number(g.price_nam) || Number(g.price) || 0,
          price_nu_dt: Number(g.price_nu_dt) || Number(g.price) || 0,
          price_nu_cgd: Number(g.price_nu_cgd) || Number(g.price) || 0,
          max_price: Number(g.max_price) || Number(g.price) || 0,
          max_price_nam: Number(g.max_price_nam) || Number(g.max_price) || 0,
          max_price_nu_dt: Number(g.max_price_nu_dt) || Number(g.max_price) || 0,
          max_price_nu_cgd: Number(g.max_price_nu_cgd) || Number(g.max_price) || 0,
        })),
        goi_kham_bnn_schema: (editingConfig.goi_kham_bnn_schema || []).map(g => ({
          ...g,
          code: (g.code || '').trim().toUpperCase(),
          label: (g.label || '').trim(),
          price: Number(g.price) || 0,
          max_price: Number(g.max_price) || Number(g.price) || 0,
        })),
        bang_anh_xa_tap_doan: (editingConfig.bang_anh_xa_tap_doan || []).map((r, i) => ({
          id: r.id || `MAP_${Date.now()}_${i}`,
          ma_goi_tap_doan: (r.ma_goi_tap_doan || '').trim().toUpperCase(),
          ten_goi_tap_doan: (r.ten_goi_tap_doan || '').trim(),
          ngach_tap_doan: (r.ngach_tap_doan || '').trim(),
          ma_goi_don_vi: (r.ma_goi_don_vi || '').trim(),
          ten_goi_don_vi: (r.ten_goi_don_vi || '').trim(),
          ngach_don_vi: (r.ngach_don_vi || '').trim(),
        }))
      };

      // Xác định action: Nếu ID tồn tại trong danh sách configs hiện tại thì update, ngược lại create
      const existsInConfigs = configs.some(c => c.id === payloadToSave.id);
      const isUpdate = Boolean(editingConfig.id && existsInConfigs);

      const saved = await saveConfigKhamSucKhoe(payloadToSave, isUpdate ? 'update' : 'create');

      // Tải lại danh sách mới nhất từ Supabase (forceRefresh = true)
      const freshConfigs = await getConfigKhamSucKhoe(true).catch(() => []);
      if (Array.isArray(freshConfigs) && freshConfigs.length > 0) {
        setConfigs(freshConfigs);
        const savedId = saved?.id || payloadToSave.id;
        const savedItem = freshConfigs.find(c => c.id === savedId) || freshConfigs[0];
        setEditingConfig(JSON.parse(JSON.stringify(savedItem)));
      } else {
        const itemToKeep = saved || payloadToSave;
        if (isUpdate) {
          setConfigs(prev => prev.map(c => c.id === itemToKeep.id ? itemToKeep : c));
        } else {
          setConfigs(prev => [itemToKeep, ...prev]);
        }
        setEditingConfig(JSON.parse(JSON.stringify(itemToKeep)));
      }

      toast.success(isUpdate ? "Đã cập nhật Cấu hình Thông báo!" : "Đã thêm mới Cấu hình Thông báo!");
    } catch (err: any) {
      console.error("🔴 Lỗi lưu cấu hình KSK:", err);
      toast.error(`Lỗi lưu cấu hình: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa Cấu hình Thông báo này?")) return;
    try {
      try {
        localStorage.removeItem('SMART_CACHE_config_kham_suc_khoe');
        localStorage.removeItem('mock_config_kham_suc_khoe');
      } catch (e) { }

      await deleteConfigKhamSucKhoe(id);
      const remaining = configs.filter(c => c.id !== id);
      setConfigs(remaining);

      if (remaining.length > 0) {
        setEditingConfig(JSON.parse(JSON.stringify(remaining[0])));
      } else {
        setEditingConfig(null);
        setIsConfigModalOpen(false);
      }

      toast.success("Đã xóa Cấu hình Thông báo!");
    } catch (err: any) {
      toast.error("Không thể xóa Cấu hình Thông báo");
    }
  };

  // 🟢 ĐỒNG BỘ GÓI KHÁM & ĐỊNH MỨC THEO THÔNG BÁO ĐƯỢC CHỌN (BẢO TOÀN SỐ LƯỢNG ĐÃ NHẬP)
  const handleSyncPackagesFromSelectedConfig = (targetConfig?: ConfigKhamSucKhoeRecord) => {
    const cfg = targetConfig || selectedConfigForCampaign;
    if (!cfg) {
      toast.warning("Chưa có Cấu hình Thông báo nào để đồng bộ!");
      return;
    }
    if (!editingCampaign) return;

    // 1. Lấy danh sách gói KSK định kỳ từ thông báo được chọn
    const newGoiKham = ensureArray(cfg.goi_kham_schema, DEFAULT_GOI_KHAM_PRESETS).map(g => ({ ...g }));
    setFormGoiKhamSchema(newGoiKham);

    // 2. Lấy danh sách gói BNN từ thông báo được chọn
    const newGoiKhamBnn = ensureArray(cfg.goi_kham_bnn_schema, []).map(g => ({ ...g }));
    setFormGoiKhamBnnSchema(newGoiKhamBnn);

    // 3. Cập nhật đợt khám với ID và Số hiệu thông báo mới, giữ nguyên số lượng thực tế đã nhập (goi_kham_values)
    setEditingCampaign({
      ...editingCampaign,
      id_config_thong_bao: cfg.id,
      so_hieu_thong_bao: cfg.so_hieu_thong_bao,
      goi_kham_schema: newGoiKham,
      goi_kham_bnn_schema: newGoiKhamBnn
    });
    setSelectedConfigForCampaign(cfg);

    toast.success(`Đã đồng bộ gói khám & định mức theo Thông báo ${cfg.so_hieu_thong_bao}! Số lượng thực tế đã nhập được bảo toàn.`);
  };

  const handleApplyDefaultThacoMapping = () => {
    setEditingConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        bang_anh_xa_tap_doan: JSON.parse(JSON.stringify(DEFAULT_THACO_MAPPING))
      };
    });
    toast.success("Đã nạp lại Bảng Ma trận Ánh xạ chuẩn THACO AUTO!");
  };

  const handleAddMappingRow = () => {
    setEditingConfig(prev => {
      if (!prev) return null;
      const newRow: AnhXaGoiTapDoanItem = {
        id: `MAP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ma_goi_tap_doan: '',
        ten_goi_tap_doan: '',
        ngach_tap_doan: '',
        ma_goi_don_vi: '',
        ten_goi_don_vi: '',
        ngach_don_vi: ''
      };
      return {
        ...prev,
        bang_anh_xa_tap_doan: [...(prev.bang_anh_xa_tap_doan || []), newRow]
      };
    });
  };

  const handleRemoveMappingRow = (rowIdx: number) => {
    setEditingConfig(prev => {
      if (!prev) return null;
      const list = (prev.bang_anh_xa_tap_doan || []).filter((_, i) => i !== rowIdx);
      return {
        ...prev,
        bang_anh_xa_tap_doan: list
      };
    });
  };

  const handleUpdateMappingRow = (rowIdx: number, updates: Partial<AnhXaGoiTapDoanItem>) => {
    setEditingConfig(prev => {
      if (!prev) return null;
      const list = [...(prev.bang_anh_xa_tap_doan || [])];
      if (list[rowIdx]) {
        list[rowIdx] = {
          ...list[rowIdx],
          ...updates
        };
      }
      return {
        ...prev,
        bang_anh_xa_tap_doan: list
      };
    });
  };

  // Mở Modal Thêm/Sửa đợt khám tổng hợp
  const handleOpenCampaignModal = (item?: KhamSucKhoeRecord) => {
    if (item) {
      setEditingCampaign({ ...item });
      setFormGoiKhamSchema(ensureArray(item.goi_kham_schema, DEFAULT_GOI_KHAM_PRESETS));
      setFormGoiKhamBnnSchema(ensureArray(item.goi_kham_bnn_schema, []));
      setIsCorporatePackageMode(!!item.ap_dung_goi_tap_doan);
      const matchedConfig = configs.find(c => c.id === item.id_config_thong_bao) || configs.find(c => Number(c.nam) === Number(item.nam_kham)) || null;
      setSelectedConfigForCampaign(matchedConfig);
    } else {
      const defaultUnit = selectedUnitFilter !== 'ALL' && selectedUnitFilter !== 'HO' ? selectedUnitFilter : (allowedDonViIds[0] || donViList[0]?.id || '');
      const curYear = new Date().getFullYear();

      // Tìm cấu hình Thông báo đang áp dụng của năm này (hoặc mới nhất)
      const matchedConfig = configs.find(c => Number(c.nam) === curYear && c.trang_thai === 'DANG_AP_DUNG') || configs[0] || null;
      setSelectedConfigForCampaign(matchedConfig);
      setIsCorporatePackageMode(false);

      const defaultGoiKham = matchedConfig && ensureArray(matchedConfig.goi_kham_schema).length > 0
        ? ensureArray(matchedConfig.goi_kham_schema).map(g => ({ ...g }))
        : DEFAULT_GOI_KHAM_PRESETS;

      const defaultGoiKhamBnn = matchedConfig && ensureArray(matchedConfig.goi_kham_bnn_schema).length > 0
        ? ensureArray(matchedConfig.goi_kham_bnn_schema).map(g => ({ ...g }))
        : [];

      setEditingCampaign({
        id: '',
        id_don_vi: defaultUnit,
        nam_kham: curYear,
        ten_dot_kham: matchedConfig ? matchedConfig.tieu_de_thong_bao : `Khám sức khỏe định kỳ năm ${curYear}`,
        id_config_thong_bao: matchedConfig?.id || '',
        so_hieu_thong_bao: matchedConfig?.so_hieu_thong_bao || '',
        ap_dung_goi_tap_doan: false,
        hinh_thuc_kham: 'NOI_VIEN',
        dia_diem_kham: '',
        ngay_lay_mau: '',
        ngay_kham_lam_sang: '',
        sl_dang_ky: 0,
        sl_thuc_te: 0,
        sl_khong_kham: 0,
        ly_do_khong_kham: '',
        tong_chi_phi: 0,
        goi_kham_schema: defaultGoiKham,
        goi_kham_values: {},
        goi_kham_bnn_schema: defaultGoiKhamBnn,
        goi_kham_bnn_values: {},
        ket_qua_ksk_json: { loai_1: 0, loai_2: 0, loai_3: 0, loai_4: 0, loai_5: 0, khong_phan_loai: 0 },
        bnn_lan_1_json: { sl_kham: 0, sl_mac_bnn: 0, sl_nguy_co: 0 },
        bnn_lan_2_json: { sl_kham: 0, sl_mac_bnn: 0, sl_nguy_co: 0 },
        danh_gia_ncc: 'DAT',
        ly_do_ncc_khong_dat: '',
        ghi_chu: ''
      });
      setFormGoiKhamSchema(defaultGoiKham);
      setFormGoiKhamBnnSchema(defaultGoiKhamBnn);
    }
    setIsCampaignModalOpen(true);
  };

  // Thêm Gói khám động trong Modal
  const handleAddDynamicPackage = () => {
    if (!newPackageCode.trim() || !newPackageLabel.trim()) {
      toast.error("Vui lòng nhập đầy đủ Mã gói và Tên gói khám");
      return;
    }
    const cleanCode = newPackageCode.trim().toUpperCase().replace(/\s+/g, '_');
    if (formGoiKhamSchema.some(p => p.code === cleanCode)) {
      toast.error("Mã gói khám này đã tồn tại");
      return;
    }

    const updated = [...formGoiKhamSchema, { code: cleanCode, label: newPackageLabel.trim() }];
    setFormGoiKhamSchema(updated);
    setNewPackageCode('');
    setNewPackageLabel('');
  };

  const handleAddBnnDynamicPackage = () => {
    if (!newBnnPackageCode.trim() || !newBnnPackageLabel.trim()) {
      toast.error("Vui lòng nhập đầy đủ Mã gói và Tên gói khám BNN");
      return;
    }
    const cleanCode = newBnnPackageCode.trim().toUpperCase().replace(/\s+/g, '_');
    if (formGoiKhamBnnSchema.some(p => p.code === cleanCode)) {
      toast.error("Mã gói khám BNN này đã tồn tại");
      return;
    }

    const updated = [...formGoiKhamBnnSchema, { code: cleanCode, label: newBnnPackageLabel.trim() }];
    setFormGoiKhamBnnSchema(updated);
    setNewBnnPackageCode('');
    setNewBnnPackageLabel('');
  };

  // Xóa Gói khám động trong Modal
  const handleRemoveDynamicPackage = (code: string) => {
    setFormGoiKhamSchema(prev => prev.filter(p => p.code !== code));
    if (editingCampaign) {
      const newVals = { ...editingCampaign.goi_kham_values };
      delete newVals[code];
      setEditingCampaign({ ...editingCampaign, goi_kham_values: newVals });
    }
  };

  const handleRemoveBnnDynamicPackage = (code: string) => {
    setFormGoiKhamBnnSchema(prev => prev.filter(p => p.code !== code));
    if (editingCampaign) {
      const newVals = { ...editingCampaign.goi_kham_bnn_values };
      delete newVals[code];
      setEditingCampaign({ ...editingCampaign, goi_kham_bnn_values: newVals });
    }
  };

  const handleAutoCalculateCost = () => {
    if (!editingCampaign) return;
    let totalCost = 0;

    const campaignRecords = caNhanList.filter(r => r.id_dot_ksk === editingCampaign.id);

    if (campaignRecords.length === 0) {
      toast.info("Chưa có danh sách (từ Excel). Tính theo Giá chung nhân với Số lượng.");

      if (editingCampaign.ten_dot_kham?.includes('Khám sức khỏe định kỳ')) {
        ensureArray(formGoiKhamSchema).forEach(gk => {
          const qty = editingCampaign.goi_kham_values?.[gk.code] || 0;
          const price = gk.price || gk.price_nam || 0;
          totalCost += (qty * price);
        });
      }

      if (editingCampaign.ten_dot_kham?.includes('Khám Bệnh nghề nghiệp')) {
        ensureArray(formGoiKhamBnnSchema).forEach(gk => {
          const qty = editingCampaign.goi_kham_bnn_values?.[gk.code] || 0;
          const price = gk.price || gk.price_nam || 0;
          totalCost += (qty * price);
        });
      }
    } else {
      campaignRecords.forEach(r => {
        const isNam = r.gioi_tinh?.toLowerCase() === 'nam';
        const honNhan = r.hon_nhan?.toLowerCase() || '';
        const isNuDt = !isNam && (honNhan.includes('độc thân') || honNhan.includes('chưa'));

        if (editingCampaign.ten_dot_kham?.includes('Khám sức khỏe định kỳ') && r.ma_goi_kham) {
          const gk = ensureArray(formGoiKhamSchema).find(g => g.code === r.ma_goi_kham);
          if (gk) {
            if (isNam) totalCost += (gk.price_nam || gk.price || 0);
            else if (isNuDt) totalCost += (gk.price_nu_dt || gk.price || 0);
            else totalCost += (gk.price_nu_cgd || gk.price || 0);
          }
        }
      });

      if (editingCampaign.ten_dot_kham?.includes('Khám Bệnh nghề nghiệp')) {
        ensureArray(formGoiKhamBnnSchema).forEach(gk => {
          const qty = editingCampaign.goi_kham_bnn_values?.[gk.code] || 0;
          const price = gk.price || gk.price_nam || 0;
          totalCost += (qty * price);
        });
      }
    }

    setEditingCampaign({ ...editingCampaign, tong_chi_phi: totalCost });
    toast.success("Đã tự động tính Tổng chi phí!");
  };

  // Lưu Đợt khám tổng hợp
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    if (!editingCampaign.id_don_vi) {
      toast.error("Vui lòng chọn Đơn vị thực hiện KSK");
      return;
    }

    // 🟢 KIỂM SOÁT ĐỊNH MỨC CHI PHÍ THEO THÔNG BÁO
    if (ceilingViolations.length > 0) {
      toast.error(`Không thể lưu! Có ${ceilingViolations.length} đơn giá vượt định mức Thông báo: ${ceilingViolations[0].label} (${ceilingViolations[0].field}) = ${formatCurrency(ceilingViolations[0].price)} > Định mức ${formatCurrency(ceilingViolations[0].maxPrice)}`);
      return;
    }

    setSavingCampaign(true);
    try {
      const payload: KhamSucKhoeRecord = {
        ...editingCampaign,
        ap_dung_goi_tap_doan: isCorporatePackageMode,
        goi_kham_schema: formGoiKhamSchema,
        goi_kham_bnn_schema: formGoiKhamBnnSchema,
        sl_khong_kham: Math.max(0, Number(editingCampaign.sl_dang_ky || 0) - Number(editingCampaign.sl_thuc_te || 0))
      };

      const isUpdate = !!editingCampaign.id;
      const savedData = await saveKhamSucKhoeCampaign(payload, isUpdate ? 'update' : 'create');

      if (isUpdate) {
        setCampaigns(prev => prev.map(item => item.id === savedData.id ? savedData : item));
      } else {
        setCampaigns(prev => [savedData, ...prev]);
      }

      toast.success(isUpdate ? "Đã cập nhật đợt KSK!" : "Đã thêm mới đợt KSK!");
      setIsCampaignModalOpen(false);
      setEditingCampaign(null);
    } catch (err: any) {
      console.error("🔴 Lỗi lưu đợt KSK:", err);
      toast.error(`Lưu thất bại: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setSavingCampaign(false);
    }
  };

  // Xóa Đợt khám tổng hợp
  const promptDeleteCampaign = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setConfirmDeleteType('CAMPAIGN');
  };

  // Xóa KSK cá nhân
  const promptDeleteCaNhan = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setConfirmDeleteType('CA_NHAN');
  };

  const executeDelete = async () => {
    if (!deleteTargetId || !confirmDeleteType) return;
    setIsDeleting(true);
    try {
      if (confirmDeleteType === 'CAMPAIGN') {
        await deleteKhamSucKhoeCampaign(deleteTargetId);
        setCampaigns(prev => prev.filter(c => c.id !== deleteTargetId));
        toast.success("Đã xóa đợt KSK thành công!");
      } else if (confirmDeleteType === 'CA_NHAN') {
        await deleteKhamSucKhoeCaNhan(deleteTargetId);
        setCaNhanList(prev => prev.filter(cn => cn.id !== deleteTargetId));
        toast.success("Đã xóa lịch sử KSK cá nhân thành công!");
      }
    } catch (err: any) {
      toast.error("Lỗi khi xóa dữ liệu!");
    } finally {
      setIsDeleting(false);
      setConfirmDeleteType(null);
      setDeleteTargetId(null);
      setDeleteTargetName('');
    }
  };

  // 🟢 DỮ LIỆU LỌC CHO SUB-TAB BÁO CÁO TỔNG HỢP
  const reportCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (baocaoNam !== 'ALL' && String(c.nam_kham) !== baocaoNam) return false;
      if (baocaoScope === 'HO') return c.id_don_vi === 'HO';
      if (baocaoScope === 'NAM') {
        const u = donViMap.get(c.id_don_vi);
        return u?.phia === 'Nam' && c.id_don_vi !== 'HO';
      }
      if (baocaoScope === 'BAC') {
        const u = donViMap.get(c.id_don_vi);
        return u?.phia === 'Bắc' && c.id_don_vi !== 'HO';
      }
      return true;
    });
  }, [campaigns, baocaoNam, baocaoScope, donViMap]);

  // Cấu hình Thông báo áp dụng cho năm báo cáo
  const activeReportConfig = useMemo(() => {
    return configs.find(c => String(c.nam) === baocaoNam && c.trang_thai === 'DANG_AP_DUNG') ||
      configs.find(c => String(c.nam) === baocaoNam) ||
      configs[0] ||
      null;
  }, [configs, baocaoNam]);

  // Bảng ánh xạ đối ứng áp dụng cho năm báo cáo
  const activeReportMapping = useMemo(() => {
    if (activeReportConfig?.bang_anh_xa_tap_doan && activeReportConfig.bang_anh_xa_tap_doan.length > 0) {
      return activeReportConfig.bang_anh_xa_tap_doan;
    }
    return DEFAULT_THACO_MAPPING;
  }, [activeReportConfig]);

  // Xuất file Excel Báo Cáo
  const exportReportToExcel = () => {
    if (baocaoViewMode === 'quydoi_tapdoan') {
      let csv = '\uFEFF';
      csv += `"BÁO CÁO QUY ĐỔI SỐ LƯỢNG KHÁM SỨC KHỎE THEO CHUẨN TẬP ĐOÀN THACO AUTO - NĂM ${baocaoNam}"\n`;
      csv += `"Số hiệu thông báo áp dụng:","${activeReportConfig?.so_hieu_thong_bao || 'N/A'}"\n\n`;
      csv += `"STT","Mã gói Tập đoàn","Tên gói khám Tập đoàn","Ngạch / Đối tượng Tập đoàn","Mã gói Đơn vị đối ứng","Ngạch / Đối tượng Đơn vị","SL VPĐH / Phân phối","SL Đơn vị Tỉnh thành","Tổng SL Toàn hệ thống","Ước tính Chi phí (VNĐ)"\n`;

      let totalVpdh = 0;
      let totalDonVi = 0;
      let totalAll = 0;
      let totalCost = 0;

      activeReportMapping.forEach((m, idx) => {
        let slVpdh = 0;
        let slDonVi = 0;
        let lineCost = 0;

        reportCampaigns.forEach(camp => {
          const isVpdhOrCorp = camp.id_don_vi === 'HO' || camp.ap_dung_goi_tap_doan;
          if (isVpdhOrCorp) {
            const count = camp.goi_kham_values?.[m.ma_goi_tap_doan] || 0;
            slVpdh += count;
          } else if (m.ma_goi_don_vi) {
            const count = camp.goi_kham_values?.[m.ma_goi_don_vi] || 0;
            slDonVi += count;
            const gkObj = (camp.goi_kham_schema || []).find(g => g.code === m.ma_goi_don_vi);
            const price = gkObj?.price || gkObj?.price_nam || 0;
            lineCost += (count * price);
          }
        });

        const lineTotal = slVpdh + slDonVi;
        totalVpdh += slVpdh;
        totalDonVi += slDonVi;
        totalAll += lineTotal;
        totalCost += lineCost;

        csv += `"${idx + 1}","${m.ma_goi_tap_doan}","${m.ten_goi_tap_doan}","${m.ngach_tap_doan}","${m.ma_goi_don_vi || '-'}","${m.ngach_don_vi || '-'}","${slVpdh}","${slDonVi}","${lineTotal}","${lineCost}"\n`;
      });

      csv += `"","TỔNG CỘNG","","","","","${totalVpdh}","${totalDonVi}","${totalAll}","${totalCost}"\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Bao_Cao_KSK_Quy_Doi_Tap_Doan_Nam_${baocaoNam}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Đã xuất Báo cáo Tập đoàn thành công!");
    } else {
      let csv = '\uFEFF';
      csv += `"BÁO CÁO MA TRẬN KHÁM SỨC KHỎE CÁC ĐƠN VỊ - NĂM ${baocaoNam}"\n\n`;
      csv += `"STT","Mã Đơn vị","Tên Đơn vị","Đợt khám","GK 1","GK 2","GK 3A","GK 3B","GK 3C","BNN","Tổng thực tế","Tổng Chi phí (VNĐ)"\n`;

      reportCampaigns.forEach((camp, idx) => {
        const u = donViMap.get(camp.id_don_vi);
        const gk1 = camp.goi_kham_values?.['GK_1'] || 0;
        const gk2 = camp.goi_kham_values?.['GK_2'] || 0;
        const gk3a = camp.goi_kham_values?.['GK_3A'] || 0;
        const gk3b = camp.goi_kham_values?.['GK_3B'] || 0;
        const gk3c = camp.goi_kham_values?.['GK_3C'] || 0;
        const bnnTotal = Object.values(camp.goi_kham_bnn_values || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

        csv += `"${idx + 1}","${camp.id_don_vi}","${u?.ten_don_vi || 'N/A'}","${camp.ten_dot_kham || ''}","${gk1}","${gk2}","${gk3a}","${gk3b}","${gk3c}","${bnnTotal}","${camp.sl_thuc_te}","${camp.tong_chi_phi || 0}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Bao_Cao_Ma_Tran_KSK_Don_Vi_Nam_${baocaoNam}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Đã xuất Báo cáo Ma trận Đơn vị thành công!");
    }
  };

  // Cấu hình Cột dán Excel cho KSK Cá nhân Nhân sự
  const excelColumnMapping: ColumnMapItem[] = [
    { label: 'Số TT', key: 'stt', type: 'number' },
    { label: 'MSNV *', key: 'msnv', type: 'text', required: true },
    { label: 'Họ và tên *', key: 'ho_ten', type: 'text', required: true },
    { label: 'Năm sinh', key: 'nam_sinh', type: 'number' },
    { label: 'Giới tính', key: 'gioi_tinh', type: 'text' },
    { label: 'Tình trạng hôn nhân', key: 'hon_nhan', type: 'text' },
    { label: 'Chiều cao', key: 'chieu_cao', type: 'number' },
    { label: 'Cân nặng', key: 'can_nang', type: 'number' },
    { label: 'Năm KSK *', key: 'nam_kham', type: 'number', required: true },
    { label: 'Mã Gói khám', key: 'ma_goi_kham', type: 'text' },
    { label: 'Phân loại SK', key: 'loai_suc_khoe', type: 'select' },
    { label: 'Kết luận BNN', key: 'ket_luan_bnn', type: 'select' },
    { label: 'Tên bệnh nghề nghiệp', key: 'ten_benh_nghe_nghiep', type: 'text' },
    { label: 'Ghi chú sức khỏe', key: 'ghi_chu_suc_khoe', type: 'text' }
  ];

  // Xử lý Lưu dữ liệu dán từ Excel
  const handleSavePasteExcel = async (rows: any[]) => {
    if (!rows || rows.length === 0) return;

    try {
      let personnelList = nhanSuList;
      if (!personnelList || personnelList.length === 0) {
        personnelList = await getPersonnel().catch(() => []);
        setNhanSuList(personnelList);
      }

      const recordsToSave: any[] = [];
      const nsMap = new Map<string, any>();
      personnelList.forEach(ns => nsMap.set(String(ns.ma_so_nhan_vien || '').trim().toLowerCase(), ns));

      const personnelUpdates: Promise<any>[] = [];

      rows.forEach(r => {
        const msnvClean = String(r.msnv || '').trim();
        if (!msnvClean) return;

        const matchedNs = nsMap.get(msnvClean.toLowerCase());

        if (matchedNs) {
          const excelHoTen = String(r.ho_ten || '').trim();
          const nsHoTen = String(matchedNs.ho_ten || '').trim();
          const excelNamSinh = String(r.nam_sinh || '').trim();
          const nsYear = String(matchedNs.nam_sinh || '').split('-')[0];
          const newHonNhan = String(r.hon_nhan || '').trim();

          // Xác nhận đúng người: Khớp MSNV (đã kiểm tra qua nsMap), Họ tên và Năm sinh
          // Bỏ qua khoảng trắng và không phân biệt hoa thường khi so sánh Họ tên
          const isMatchHoTen = !excelHoTen || excelHoTen.toLowerCase() === nsHoTen.toLowerCase();
          const isMatchNamSinh = !excelNamSinh || excelNamSinh === nsYear;

          if (!isMatchHoTen || !isMatchNamSinh) {
            toast.warning(`MSNV ${msnvClean} có Họ tên hoặc Năm sinh không khớp hồ sơ gốc.`);
          }

          // CHỈ cập nhật vào ns_dich_vu nếu CÓ khớp Họ tên và Năm sinh
          if (isMatchHoTen && isMatchNamSinh) {
            const updateFields: any = {};

            if (newHonNhan) {
              const currentHonNhan = String(matchedNs.hon_nhan || '').trim();
              if (currentHonNhan !== newHonNhan) {
                updateFields.hon_nhan = newHonNhan;
              }
            }

            const excelChieuCao = String(r.chieu_cao || '').trim();
            const excelCanNang = String(r.can_nang || '').trim();

            if (excelChieuCao || excelCanNang) {
              let bmiStr = '';
              const h = Number(excelChieuCao);
              const w = Number(excelCanNang);
              if (h > 0 && w > 0) {
                const h_m = h / 100;
                const bmi = (w / (h_m * h_m)).toFixed(1);
                bmiStr = ` - BMI: ${bmi}`;
              }
              const newNgoaiHinh = `Chiều cao: ${excelChieuCao || '---'} cm - Cân nặng: ${excelCanNang || '---'} kg${bmiStr}`;
              const currentNgoaiHinh = String(matchedNs.mo_to_ngoai_hinh || '').trim();

              if (currentNgoaiHinh !== newNgoaiHinh) {
                updateFields.mo_to_ngoai_hinh = newNgoaiHinh;
                // Chuyển nội dung ngoại hình cũ sang ghi_chu nếu nó không phải là định dạng chiều cao cân nặng
                if (currentNgoaiHinh && !currentNgoaiHinh.startsWith('Chiều cao:')) {
                  const currentGhiChu = String(matchedNs.ghi_chu || '').trim();
                  updateFields.ghi_chu = currentGhiChu ? `${currentGhiChu}\n${currentNgoaiHinh}` : currentNgoaiHinh;
                }
              }
            }

            if (Object.keys(updateFields).length > 0) {
              Object.assign(matchedNs, updateFields); // Cập nhật local để UI render
              updateFields.id = matchedNs.id;

              personnelUpdates.push(
                save(updateFields, 'update', 'ns_dich_vu').catch((e: any) => {
                  console.error(`Lỗi cập nhật hồ sơ cho ${msnvClean}:`, e);
                  toast.error(`Lỗi cập nhật hồ sơ cho ${msnvClean}: ${e.message}`);
                })
              );
            }
          }
        }

        let namKhamExcel = Number(r.nam_kham) || new Date().getFullYear();
        let uId = (selectedUnitFilter && selectedUnitFilter !== 'ALL' && selectedUnitFilter !== 'HO')
          ? selectedUnitFilter
          : (matchedNs?.id_don_vi || allowedDonViIds[0] || 'HO');

        // Nếu người dùng chọn Dán Excel trực tiếp cho một Đợt Khám cụ thể, ép buộc sử dụng Năm và Đơn vị của đợt khám đó
        if (targetCampaignForPaste) {
          namKhamExcel = Number(targetCampaignForPaste.nam_kham);
          uId = targetCampaignForPaste.id_don_vi;
        }

        // Ngăn chặn tạo trùng lặp: Nếu NV đã có kết quả khám của năm này rồi thì ghi đè (Cập nhật)
        const existingCaNhanRecord = caNhanList.find(c =>
          String(c.ma_so_nhan_vien).toLowerCase() === msnvClean.toLowerCase() &&
          Number(c.nam_kham) === namKhamExcel
        );

        recordsToSave.push({
          id: existingCaNhanRecord ? existingCaNhanRecord.id : undefined,
          ma_so_nhan_vien: msnvClean,
          ho_ten: capitalizeName(r.ho_ten || matchedNs?.ho_ten || 'CB-NV'),
          nam_sinh: Number(r.nam_sinh) || null,
          gioi_tinh: String(r.gioi_tinh || '').trim(),
          hon_nhan: String(r.hon_nhan || '').trim(),
          chieu_cao: r.chieu_cao ? Number(r.chieu_cao) : null,
          can_nang: r.can_nang ? Number(r.can_nang) : null,
          id_don_vi: uId,
          nam_kham: namKhamExcel,
          id_dot_ksk: targetCampaignForPaste ? targetCampaignForPaste.id : undefined,
          ma_goi_kham: r.ma_goi_kham || 'GK 1',
          ten_goi_kham: r.ma_goi_kham || 'Gói KSK',
          loai_suc_khoe: r.loai_suc_khoe || 'Loại I',
          ket_luan_bnn: r.ket_luan_bnn || 'Bình thường',
          ten_benh_nghe_nghiep: r.ten_benh_nghe_nghiep || '',
          ghi_chu_suc_khoe: r.ghi_chu_suc_khoe || ''
        });
      });

      if (personnelUpdates.length > 0) {
        Promise.allSettled(personnelUpdates).catch(err => console.error("Lỗi cập nhật nhân sự:", err));
      }

      if (recordsToSave.length === 0) {
        toast.error("Không có bản ghi hợp lệ để lưu");
        return;
      }

      // 🟢 TỰ ĐỘNG TÍNH TOÁN, TỔNG HỢP VÀ LẤY ID ĐỢT KSK TRƯỚC KHI LƯU CÁ NHÂN
      // Tất cả hồ sơ paste vào sẽ được quy về Đợt khám của Đơn vị đang được chọn (mặc định là HO)
      const campaignUnitId = (selectedUnitFilter && selectedUnitFilter !== 'ALL') ? selectedUnitFilter : 'HO';

      const unitYearKeys = new Set<string>();
      recordsToSave.forEach(r => {
        if (r.nam_kham) {
          unitYearKeys.add(`${campaignUnitId}_${r.nam_kham}`);
        }
      });

      const campaignsToUpdate: KhamSucKhoeRecord[] = [];

      for (const key of unitYearKeys) {
        const [unitId, yearStr] = key.split('_');
        const year = Number(yearStr);

        // Kiểm tra xem đã có đợt khám tổng hợp chưa
        const existingCampaign = campaigns.find(
          c => c.id_don_vi === unitId && Number(c.nam_kham) === year
        );

        // Merge dữ liệu cũ và mới để thống kê chính xác
        // Dữ liệu cũ: là những hồ sơ ĐÃ thuộc về đợt khám này
        const oldRecords = existingCampaign
          ? caNhanList.filter(r => r.id_dot_ksk === existingCampaign.id)
          : [];

        // Dữ liệu mới: là toàn bộ hồ sơ đang paste vào cho năm này
        const newRecords = recordsToSave.filter(r => Number(r.nam_kham) === year);

        const mergedRecordsForStats = [...oldRecords];
        newRecords.forEach(s => {
          const idx = mergedRecordsForStats.findIndex(x => x.id && x.id === s.id);
          if (idx !== -1) mergedRecordsForStats[idx] = s;
          else mergedRecordsForStats.push(s);
        });

        const unitYearRecords = mergedRecordsForStats;



        // Tính toán các chỉ số
        const sl_thuc_te = unitYearRecords.length;
        const sl_dang_ky = existingCampaign ? Number(existingCampaign.sl_dang_ky || 0) : sl_thuc_te;
        const sl_khong_kham = Math.max(0, sl_dang_ky - sl_thuc_te);

        // Đếm phân loại sức khỏe
        const loai_1 = unitYearRecords.filter(r => {
          const val = String(r.loai_suc_khoe || '').trim().toLowerCase();
          return val === 'loại i' || val === 'loại 1' || val === 'i' || val === '1';
        }).length;
        const loai_2 = unitYearRecords.filter(r => {
          const val = String(r.loai_suc_khoe || '').trim().toLowerCase();
          return val === 'loại ii' || val === 'loại 2' || val === 'ii' || val === '2';
        }).length;
        const loai_3 = unitYearRecords.filter(r => {
          const val = String(r.loai_suc_khoe || '').trim().toLowerCase();
          return val === 'loại iii' || val === 'loại 3' || val === 'iii' || val === '3';
        }).length;
        const loai_4 = unitYearRecords.filter(r => {
          const val = String(r.loai_suc_khoe || '').trim().toLowerCase();
          return val === 'loại iv' || val === 'loại 4' || val === 'iv' || val === '4';
        }).length;
        const loai_5 = unitYearRecords.filter(r => {
          const val = String(r.loai_suc_khoe || '').trim().toLowerCase();
          return val === 'loại v' || val === 'loại 5' || val === 'v' || val === '5';
        }).length;
        const khong_phan_loai = unitYearRecords.length - (loai_1 + loai_2 + loai_3 + loai_4 + loai_5);

        // Đếm gói khám
        const goiKhamVals: Record<string, number> = {};
        unitYearRecords.forEach(r => {
          if (r.ma_goi_kham) {
            const code = String(r.ma_goi_kham).trim().toUpperCase();
            goiKhamVals[code] = (goiKhamVals[code] || 0) + 1;
          }
        });

        // Tổng hợp BNN
        const bnnExaminedRecords = unitYearRecords.filter(r => r.ket_luan_bnn && String(r.ket_luan_bnn).trim() !== '');
        const sl_kham = bnnExaminedRecords.length;
        const sl_mac_bnn = bnnExaminedRecords.filter(r => String(r.ket_luan_bnn || '').toLowerCase().includes('mắc')).length;
        const sl_nguy_co = bnnExaminedRecords.filter(r => String(r.ket_luan_bnn || '').toLowerCase().includes('nguy cơ')).length;

        // Chuẩn bị payload đợt khám
        const baseCampaign = targetCampaignForPaste || existingCampaign;
        const campaignPayload: any = baseCampaign ? { ...baseCampaign } : {
          id: '',
          id_don_vi: unitId,
          nam_kham: year,
          ten_dot_kham: `Khám sức khỏe định kỳ năm ${year}`,
          hinh_thuc_kham: 'NOI_VIEN',
          dia_diem_kham: '',
          ngay_lay_mau: '',
          ngay_kham_lam_sang: '',
          tong_chi_phi: 0,
          danh_gia_ncc: 'DAT',
          ly_do_ncc_khong_dat: '',
          ghi_chu: ''
        };

        campaignPayload.sl_dang_ky = sl_dang_ky;
        campaignPayload.sl_thuc_te = sl_thuc_te;
        campaignPayload.sl_khong_kham = sl_khong_kham;
        campaignPayload.goi_kham_values = goiKhamVals;
        campaignPayload.ket_qua_ksk_json = {
          loai_1, loai_2, loai_3, loai_4, loai_5, khong_phan_loai
        };
        campaignPayload.bnn_lan_1_json = {
          sl_kham, sl_mac_bnn, sl_nguy_co
        };

        // Bổ sung gói khám mới vào schema nếu chưa tồn tại
        const currentSchemaCodes = new Set((campaignPayload.goi_kham_schema || []).map((s: any) => s.code));
        const newSchema = [...(campaignPayload.goi_kham_schema || [])];
        Object.keys(goiKhamVals).forEach(code => {
          if (!currentSchemaCodes.has(code)) {
            newSchema.push({ code, label: `Gói khám ${code}` });
          }
        });
        campaignPayload.goi_kham_schema = newSchema;

        // Gọi API lưu đợt khám tổng hợp để sinh ID
        const savedCampaign = await saveKhamSucKhoeCampaign(campaignPayload, baseCampaign?.id ? 'update' : 'create');
        campaignsToUpdate.push(savedCampaign);

        // Gắn id_dot_ksk vào danh sách hồ sơ cá nhân sẽ lưu
        recordsToSave.forEach(r => {
          if (Number(r.nam_kham) === year) {
            r.id_dot_ksk = savedCampaign.id;
          }
        });
      }

      // 🟢 SAU KHI ĐÃ GẮN id_dot_ksk, TIẾN HÀNH LƯU CÁ NHÂN
      const saved = await saveKhamSucKhoeCaNhanBatch(recordsToSave);

      const updatedCaNhanList = [...caNhanList];
      saved.forEach(s => {
        const idx = updatedCaNhanList.findIndex(x => x.id === s.id);
        if (idx !== -1) updatedCaNhanList[idx] = s;
        else updatedCaNhanList.push(s);
      });

      setCaNhanList(updatedCaNhanList);
      toast.success(`Đã lưu thành công ${saved.length} hồ sơ KSK cá nhân!`);

      // Cập nhật state campaigns để giao diện cập nhật ngay lập tức
      setCampaigns(prev => {
        let updated = [...prev];
        campaignsToUpdate.forEach(sc => {
          const idx = updated.findIndex(c => c.id === sc.id);
          if (idx !== -1) {
            updated[idx] = sc;
          } else {
            updated.push(sc);
          }
        });
        return updated;
      });

      setIsPasteModalOpen(false);
      setTargetCampaignForPaste(null);
    } catch (err: any) {
      console.error("🔴 Lỗi lưu dán Excel:", err);
      toast.error(`Lỗi lưu dữ liệu: ${err.message || 'Hệ thống gián đoạn'}`);
      setTargetCampaignForPaste(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-lime-100 p-12 rounded-2xl shadow-sm text-center">
        <RefreshCw className="w-8 h-8 text-lime-600 animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Đang tải dữ liệu Khám sức khỏe định kỳ & BNN...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 🟢 KHỐI HEADER BỘ LỌC VÀ CHỈ SỐ KPI TỔNG QUAN */}
      <div className="bg-white p-5 rounded-2xl border border-lime-100 shadow-sm space-y-5">

        {/* Hàng 1: Tiêu đề + Bộ lọc Năm + Nút thao tác */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-lime-50 text-lime-600 flex items-center justify-center border border-lime-200 shadow-sm">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Quản Lý Khám Sức Khỏe & Bệnh Nghề Nghiệp</h2>
              <p className="text-xs text-gray-500 mt-0.5">Theo dõi lịch sử khám định kỳ, gói khám linh hoạt và bệnh nghề nghiệp qua các năm</p>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-2.5">
            {/* Chọn Năm */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 shrink-0">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Năm KSK:</span>
              <select
                value={selectedNam}
                onChange={e => {
                  setSelectedNam(e.target.value);
                  if (e.target.value !== 'ALL') {
                    setBaocaoNam(e.target.value);
                  }
                }}
                className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map(y => (
                  <option key={y} value={String(y)}>Năm {y}</option>
                ))}
              </select>
            </div>

            {/* Ô tìm kiếm: Ẩn khi đang xem tab Báo cáo Tổng hợp để hiển thị đúng thứ tự Năm KSK | Cấu hình định mức | Thêm đợt khám */}
            {activeSubTab !== 'baocao' && (
              <div className="relative shrink-0">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm tên đợt, nhân sự, NCC..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 w-48"
                />
              </div>
            )}

            {/* Nút Cấu hình Thông báo & Gói khám (Dành riêng cho Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenConfigModal()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold shadow-xs transition-all whitespace-nowrap cursor-pointer shrink-0"
                title="Cài đặt Thông báo, Gói khám, Định mức chi phí và Ánh xạ Tập đoàn THACO AUTO"
              >
                <Settings className="w-4 h-4 text-emerald-600" />
                Cấu Hình Định Mức
              </button>
            )}

            {/* Nút Thêm Đợt Khám Tổng Hợp */}
            <button
              onClick={() => handleOpenCampaignModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Thêm Đợt Khám
            </button>
          </div>
        </div>

        {/* Hàng 2: Grid Thẻ Thống kê KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-gray-100">

          {/* Card 1: Tỷ lệ khám (col-span-1) */}
          <div className="bg-gradient-to-br from-lime-50 to-emerald-50/50 p-4 rounded-xl border border-lime-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-lime-800">Tham gia Khám</span>
              <Users className="w-4 h-4 text-lime-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-lime-900">{kpiStats.completionRate}%</span>
              <span className="text-[10px] text-lime-700 font-medium">({kpiStats.totalThucTe}/{kpiStats.totalDangKy})</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Số vắng: <strong className="text-amber-600">{kpiStats.totalKhongKham}</strong> nhân sự</p>
          </div>

          {/* Card 2: Phân loại SK (col-span-2) */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-100 md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-800">Phân loại Sức khỏe</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-center justify-between gap-1 mt-3">
              {[
                { label: 'Loại I', sub: 'Rất khoẻ', val: kpiStats.totalLoai1, color: 'text-emerald-700', bg: 'bg-emerald-100' },
                { label: 'Loại II', sub: 'Khoẻ', val: kpiStats.totalLoai2, color: 'text-green-700', bg: 'bg-green-100' },
                { label: 'Loại III', sub: 'Trung bình', val: kpiStats.totalLoai3, color: 'text-blue-700', bg: 'bg-blue-100' },
                { label: 'Loại IV', sub: 'Yếu', val: kpiStats.totalLoai4, color: 'text-amber-700', bg: 'bg-amber-100' },
                { label: 'Loại V', sub: 'Rất yếu', val: kpiStats.totalLoai5, color: 'text-red-700', bg: 'bg-red-100' }
              ].map(t => {
                const pct = kpiStats.totalThucTe > 0 ? ((t.val / kpiStats.totalThucTe) * 100).toFixed(1) : '0';
                return (
                  <div key={t.label} className="flex-1 text-center bg-white/50 rounded-lg p-1.5 shadow-xs border border-white/60 flex flex-col justify-between">
                    {/* Khối hiển thị Nhãn (Căn giữa, ép rớt dòng) */}
                    <div className={`text-[10px] font-bold ${t.color} ${t.bg} py-1 rounded mx-0.5 mb-1 flex flex-col items-center justify-center leading-none gap-0.5 min-h-[32px]`}>
                      <span>{t.label}</span>
                      <span className="text-[8px] font-medium opacity-90">{t.sub}</span>
                    </div>

                    <div className="text-lg font-black text-gray-800 leading-tight">{t.val}</div>
                    <div className="text-[9px] text-gray-500">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Bệnh Nghề Nghiệp (col-span-1) */}
          <div className="bg-gradient-to-br from-rose-50 to-orange-50/50 p-4 rounded-xl border border-rose-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-rose-800">Bệnh Nghề Nghiệp</span>
              <Stethoscope className="w-4 h-4 text-rose-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-900">{kpiStats.totalBnnMac}</span>
              <span className="text-[10px] text-rose-700 font-medium">ca mắc</span>
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-rose-100 text-[10px]">
              <span className="text-gray-600">Đã khám BNN: <strong className="text-gray-800">{kpiStats.totalBnnKham}</strong></span>
              {kpiStats.totalBnnKham > 0 && (
                <span className="text-rose-600 font-bold">({((kpiStats.totalBnnMac / kpiStats.totalBnnKham) * 100).toFixed(1)}%)</span>
              )}
            </div>
            <p className="text-[10px] text-amber-600 mt-1">Nguy cơ cao: <strong>{kpiStats.totalBnnNguyCo}</strong> ca</p>
          </div>

          {/* Card 4: Chi Phí (col-span-1) */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-800">Tổng Chi Phí</span>
              <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">VNĐ</span>
            </div>
            <div className="text-xl font-black text-blue-900 truncate" title={Number(kpiStats.totalChiPhi || 0).toLocaleString('vi-VN')}>
              {Number(kpiStats.totalChiPhi || 0).toLocaleString('vi-VN')}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              BQ: <strong className="text-blue-700">{kpiStats.totalThucTe > 0 ? Number(Math.round(kpiStats.totalChiPhi / kpiStats.totalThucTe)).toLocaleString('vi-VN') : '0'}</strong>
            </p>
          </div>

        </div>

      </div>

      {/* 🟢 BIỂU ĐỒ THỐNG KÊ ĐA ĐƠN VỊ (HỂN THỊ KHI CHỌN TOÀN QUỐC HOẶC HQ) */}
      {unitComparisonData.length > 1 && (
        <div className="bg-white p-5 rounded-2xl border border-lime-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-lime-600" />
              <h3 className="text-base font-bold text-gray-800">So Sánh Tình Hình KSK & Cơ Cấu Sức Khỏe Giữa Các Công Ty Tỉnh Thành</h3>
            </div>
            <span className="text-xs text-gray-500">{unitComparisonData.length} Đơn vị có số liệu</span>
          </div>

          {/* Biểu đồ thanh so sánh đơn vị */}
          <div className="space-y-3 pt-2">
            {unitComparisonData.map((item, idx) => {
              const total = item.thucTe || 1;
              const pct12 = Math.round((item.loai12 / total) * 100);
              const pct3 = Math.round((item.loai3 / total) * 100);
              const pct45 = Math.round((item.loai45 / total) * 100);

              return (
                <div key={idx} className="space-y-1 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-lime-100 text-lime-800 text-[10px] flex items-center justify-center font-black">{idx + 1}</span>
                      {item.unitName}
                    </span>
                    <div className="flex items-center gap-4 text-gray-600">
                      <span>Đăng ký: <strong>{item.dangKy}</strong></span>
                      <span>Thực tế: <strong className="text-lime-700">{item.thucTe}</strong></span>
                      {item.bnn > 0 && <span className="text-red-600 font-bold">BNN: {item.bnn} ca</span>}
                    </div>
                  </div>

                  {/* Thanh phần trăm sắc màu */}
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden flex shadow-inner">
                    <div style={{ width: `${pct12}%` }} className="bg-emerald-500 h-full" title={`Loại I-II: ${item.loai12} NS (${pct12}%)`} />
                    <div style={{ width: `${pct3}%` }} className="bg-amber-400 h-full" title={`Loại III: ${item.loai3} NS (${pct3}%)`} />
                    <div style={{ width: `${pct45}%` }} className="bg-rose-500 h-full" title={`Loại IV-V: ${item.loai45} NS (${pct45}%)`} />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                    <span className="text-emerald-700">Tốt (I-II): {item.loai12} ({pct12}%)</span>
                    <span className="text-amber-700">TB (III): {item.loai3} ({pct3}%)</span>
                    <span className="text-rose-700 font-semibold">Yếu (IV-V): {item.loai45} ({pct45}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🟢 TAB CHUYỂN ĐỔI CHẾ ĐỘ XEM: ĐỢT KHÁM TỔNG HỢP VS CHI TIẾT NHÂN SỰ VS BÁO CÁO TỔNG HỢP */}
      {!activeSubTabSuckhoe && (
        <div className="bg-white p-2 rounded-xl border border-lime-100 shadow-sm flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('tonghop')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'tonghop' ? 'bg-lime-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Building2 className="w-4 h-4" />
            Đợt Khám ({filteredCampaigns.length})
          </button>
          <button
            onClick={() => setActiveSubTab('canhan')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'canhan' ? 'bg-lime-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Users className="w-4 h-4" />
            Lịch Sử Khám ({filteredCaNhanList.length})
          </button>
          <button
            onClick={() => setActiveSubTab('baocao')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'baocao' ? 'bg-lime-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Báo Cáo Tổng Hợp & Đối Chiếu Tập Đoàn
          </button>
        </div>
      )}

      {/* 🟢 CHẾ ĐỘ 1: BẢNG ĐỢT KHÁM TỔNG HỢP CẤP ĐƠN VỊ */}
      {activeSubTab === 'tonghop' && (
        <div className="bg-white rounded-2xl border border-lime-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-lime-600" />
              Danh Sách Đợt Khám Sức Khỏe Tổng Hợp ({filteredCampaigns.length})
            </h3>
            <span className="text-xs text-gray-500">Mỗi bản ghi quản lý 2 mốc thời gian, gói khám động và số liệu BNN 2 đợt</span>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-30 text-lime-600" />
              <p className="text-sm font-semibold">Chưa có dữ liệu đợt KSK nào phù hợp với bộ lọc</p>
              <button
                onClick={() => handleOpenCampaignModal()}
                className="mt-3 px-4 py-2 bg-lime-600 text-white text-xs font-bold rounded-xl hover:bg-lime-700 shadow-sm transition-all"
              >
                + Khởi tạo Đợt Khám Mới
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#386641] text-white font-bold text-[xs]">
                    <th className="p-3 border-b border-lime-800 text-center w-12">STT</th>
                    <th className="p-3 border-b border-lime-800 min-w-[200px]">Đợt Khám & NCC</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[140px]">Mốc Thời Gian</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[120px]">SL Đăng Ký / Thực Tế</th>
                    <th className="p-3 border-b border-lime-800 min-w-[150px]">Các Gói Khám</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Phân Loại Sức khoẻ</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[130px]">Bệnh Nghề nghiệp</th>
                    <th className="p-3 border-b border-lime-800 text-right min-w-[120px]">Tổng Chi Phí</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[100px]">Đánh Giá NCC</th>
                    <th className="p-3 border-b border-lime-800 text-center w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampaigns.map((item, index) => {
                    const uObj = donViMap.get(item.id_don_vi);
                    const kq = item.ket_qua_ksk_json || {};
                    const bnn1 = item.bnn_lan_1_json || {};
                    const bnn2 = item.bnn_lan_2_json || {};
                    const goiVals = item.goi_kham_values || {};
                    const schema = item.goi_kham_schema || DEFAULT_GOI_KHAM_PRESETS;

                    return (
                      <tr key={item.id} className="hover:bg-lime-50/30 transition-colors">
                        <td className="p-3 text-center font-bold text-gray-500">{index + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-lime-950">
                            {item.ten_dot_kham || 'Khám sức khỏe định kỳ'}{item.nam_kham && !String(item.ten_dot_kham || '').includes(String(item.nam_kham)) ? ` ${item.nam_kham}` : ''}
                          </div>
                          <div className="text-[11px] text-gray-700 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-semibold text-lime-900">
                              {item.ten_ncc_bnn ? `KSK: ${item.ten_ncc || 'Chưa chọn'}` : (item.ten_ncc || 'Chưa chọn')}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600">
                              {item.hinh_thuc_kham === 'NOI_VIEN' ? 'Nội viện' : 'Ngoại viện'}
                            </span>
                          </div>
                          {item.ten_ncc_bnn && (
                            <div className="text-[11px] text-emerald-800 flex items-center gap-1 mt-0.5 font-medium">
                              <span className="font-semibold text-emerald-800">BNN: {item.ten_ncc_bnn}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                            <div>
                              <div className="text-[10px] text-gray-500 font-medium">Lấy máu:</div>
                              <div className="text-[11px] font-bold text-gray-800">{formatDateShort(item.ngay_lay_mau)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 font-medium">Khám & Đọc KQ:</div>
                              <div className="text-[11px] font-bold text-lime-700">{formatDateShort(item.ngay_kham_lam_sang)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-black text-gray-800 text-sm">{item.sl_thuc_te} / {item.sl_dang_ky}</div>
                          {Number(item.sl_khong_kham) > 0 && (
                            <div className="text-[10px] text-amber-600 font-medium" title={item.ly_do_khong_kham}>
                              Vắng: {item.sl_khong_kham} NS
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {schema.map(gk => {
                              const val = goiVals[gk.code] || 0;
                              if (!val) return null;
                              return (
                                <span key={gk.code} className="px-1.5 py-0.5 rounded bg-lime-50 border border-lime-200 text-[10px] font-semibold text-lime-800">
                                  {gk.code}: {val}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {kq.loai_1 ? <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">Loại I: {kq.loai_1}</span> : null}
                            {kq.loai_2 ? <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">Loại II: {kq.loai_2}</span> : null}
                            {kq.loai_3 ? <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[10px]">Loại III: {kq.loai_3}</span> : null}
                            {kq.loai_4 ? <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold text-[10px]">Loại IV: {kq.loai_4}</span> : null}
                            {kq.loai_5 ? <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">Loại V: {kq.loai_5}</span> : null}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="text-[11px]">
                            L1 {item.ngay_kham_bnn_lan_1 ? `(${formatDateVN(item.ngay_kham_bnn_lan_1)})` : ''}: <strong className="text-gray-700">{bnn1.sl_kham || 0}</strong> | Mắc: <strong className="text-red-600">{bnn1.sl_mac_bnn || 0}</strong>
                          </div>
                          <div className="text-[11px]">
                            L2 {item.ngay_kham_bnn_lan_2 ? `(${formatDateVN(item.ngay_kham_bnn_lan_2)})` : ''}: <strong className="text-gray-700">{bnn2.sl_kham || 0}</strong> | Mắc: <strong className="text-red-600">{bnn2.sl_mac_bnn || 0}</strong>
                          </div>
                        </td>
                        <td className="p-3 text-right font-black text-blue-900">
                          {formatCurrency(item.tong_chi_phi)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.danh_gia_ncc === 'DAT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                            {item.danh_gia_ncc === 'DAT' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setTargetCampaignForPaste(item);
                                setIsPasteModalOpen(true);
                              }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center flex-col"
                              title="Dán Danh Sách Khám"
                            >
                              <Upload className="w-4 h-4" />
                              <span className="text-[9px] font-bold mt-0.5 leading-none">DS Khám</span>
                            </button>
                            <button
                              onClick={() => handleOpenCampaignModal(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Sửa đợt khám"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => promptDeleteCampaign(item.id, item.ten_dot_kham || '')}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa đợt khám"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🟢 CHẾ ĐỘ 2: BẢNG KSK CHI TIẾT CÁ NHÂN NHÂN SỰ */}
      {activeSubTab === 'canhan' && (
        <div className="bg-white rounded-2xl border border-lime-100 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-lime-600" />
                Lịch Sử Khám Sức Khỏe Cá Nhân Nhân Sự ({groupedEmployeeMatrix.length} Nhân sự | {filteredCaNhanList.length} lượt khám)
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {caNhanViewMode === 'matrix' ? 'Chế độ Ma trận Đa Năm: Mỗi CB-NV xếp trên 01 dòng duy nhất nằm ngang theo các năm' : 'Chế độ Bảng danh sách chi tiết từng bản ghi'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Nút chuyển đổi chế độ xem */}
              <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg border border-gray-300 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCaNhanViewMode('matrix')}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${caNhanViewMode === 'matrix' ? 'bg-white text-lime-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Ma Trận Đa Năm (1 Dòng/NV)
                </button>
                <button
                  type="button"
                  onClick={() => setCaNhanViewMode('list')}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${caNhanViewMode === 'list' ? 'bg-white text-lime-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Bảng Chi Tiết
                </button>
              </div>

              <button
                onClick={() => setIsPasteModalOpen(true)}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                + Thêm Danh sách Khám
              </button>
            </div>
          </div>

          {filteredCaNhanList.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-lime-600" />
              <p className="text-sm font-semibold">Chưa có lịch sử KSK cá nhân nào phù hợp với bộ lọc</p>
              <button
                onClick={() => setIsPasteModalOpen(true)}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-sm transition-all"
              >
                + Danh sách Khám
              </button>
            </div>
          ) : caNhanViewMode === 'matrix' ? (
            /* 🟢 BẢNG MA TRẬN 1 DÒNG / NHÂN SỰ (PIVOT MATRIX VIEW) */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#386641] text-white font-bold">
                    <th className="p-3 border-b border-lime-800 text-center w-12">STT</th>
                    <th className="p-3 border-b border-lime-800 min-w-[110px]">MSNV</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Họ và Tên CB-NV</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Đơn Vị Quản Lý</th>

                    {/* Cột Động Theo Các Năm */}
                    {matrixYears.map(yr => (
                      <th key={yr} className="p-3 border-b border-lime-800 text-center min-w-[110px] bg-lime-900/60 border-l border-lime-800">
                        Năm {yr}
                      </th>
                    ))}

                    <th className="p-3 border-b border-lime-800 text-center min-w-[120px]">Diễn Tiến SK</th>
                    <th className="p-3 border-b border-lime-800 text-center w-16">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedEmployeeMatrix.map((emp, idx) => {
                    const uObj = donViMap.get(emp.id_don_vi);
                    const isExpanded = expandedMsnv === emp.msnv;

                    // Tính toán xu hướng sức khỏe từ quá khứ -> hiện tại
                    const sortedYearsDesc = Array.from(emp.recordsByYear.keys()).sort((a, b) => Number(b) - Number(a));
                    const latestRec = sortedYearsDesc.length > 0 ? emp.recordsByYear.get(sortedYearsDesc[0]) : null;
                    const prevRec = sortedYearsDesc.length > 1 ? emp.recordsByYear.get(sortedYearsDesc[1]) : null;

                    let hasBnn = emp.allRecords.some(r => r.ket_luan_bnn && r.ket_luan_bnn !== 'Bình thường');

                    return (
                      <React.Fragment key={emp.msnv}>
                        <tr className={`hover:bg-lime-50/40 transition-colors ${isExpanded ? 'bg-lime-50/60' : ''}`}>
                          <td className="p-3 text-center font-bold text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-gray-800">{emp.msnv}</td>
                          <td className="p-3 font-bold text-lime-950">{emp.ho_ten}</td>
                          <td className="p-3 text-gray-700">{uObj?.ten_don_vi || '—'}</td>

                          {/* Ô Dữ Liệu Từng Năm */}
                          {matrixYears.map(yr => {
                            const rec = emp.recordsByYear.get(yr);
                            if (!rec) {
                              return (
                                <td key={yr} className="p-3 text-center text-gray-300 font-mono border-l border-gray-100">
                                  —
                                </td>
                              );
                            }

                            const isGood = rec.loai_suc_khoe?.includes('I') && !rec.loai_suc_khoe?.includes('IV') && !rec.loai_suc_khoe?.includes('V');
                            const isWeak = rec.loai_suc_khoe?.includes('IV') || rec.loai_suc_khoe?.includes('V');

                            return (
                              <td key={yr} className="p-2.5 text-center border-l border-gray-100 bg-gray-50/30">
                                <div className="space-y-0.5">
                                  <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${isGood ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                    rec.loai_suc_khoe?.includes('II') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      rec.loai_suc_khoe?.includes('III') ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                        'bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}>
                                    {rec.loai_suc_khoe || 'Loại I'}
                                  </span>
                                  <div className="text-[10px] text-gray-500 font-semibold">{rec.ma_goi_kham || 'GK 1'}</div>
                                  {rec.ket_luan_bnn && rec.ket_luan_bnn !== 'Bình thường' && (
                                    <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold bg-rose-100 text-rose-800 rounded border border-rose-300" title={rec.ten_benh_nghe_nghiep || rec.ket_luan_bnn}>
                                      ⚠️ BNN
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Xu Hướng Sức Khỏe */}
                          <td className="p-3 text-center">
                            {hasBnn ? (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold border border-red-300">
                                🚨 Có BNN
                              </span>
                            ) : latestRec?.loai_suc_khoe?.includes('I') || latestRec?.loai_suc_khoe?.includes('II') ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                🟢 Khỏe mạnh
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                🟡 Cần theo dõi
                              </span>
                            )}
                          </td>

                          {/* Nút Mở Rộng Chi Tiết Tiền Sử */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setExpandedMsnv(isExpanded ? null : emp.msnv)}
                              className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-lime-600 text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100'}`}
                              title={isExpanded ? "Thu gọn chi tiết" : "Xem chi tiết tiền sử KSK qua các năm"}
                            >
                              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                          </td>
                        </tr>

                        {/* HÀNG MỞ RỘNG CHI TIẾT (EXPANDED ROW TIMELINE) */}
                        {isExpanded && (
                          <tr className="bg-lime-50/50">
                            <td colSpan={5 + matrixYears.length} className="p-4 border-b border-lime-200">
                              <div className="bg-white p-4 rounded-xl border border-lime-200 shadow-inner space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <h4 className="font-bold text-lime-900 text-xs flex items-center gap-1.5">
                                    <Activity className="w-4 h-4 text-lime-600" />
                                    Lịch Sử Chi Tiết Khám Sức Khỏe & Tiền Sử Bệnh Lý: <span className="text-lime-950 font-black">{emp.ho_ten}</span> ({emp.msnv})
                                  </h4>
                                  <span className="text-[11px] text-gray-500">Đã tham gia {emp.allRecords.length} kỳ KSK</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {emp.allRecords.sort((a, b) => Number(b.nam_kham) - Number(a.nam_kham)).map(rec => (
                                    <div key={rec.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 relative">
                                      <button
                                        onClick={() => promptDeleteCaNhan(rec.id, rec.ho_ten)}
                                        className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 text-xs font-bold"
                                        title="Xóa kỳ KSK này"
                                      >
                                        ✕
                                      </button>

                                      <div className="flex items-center justify-between pr-5">
                                        <span className="font-bold text-lime-900 text-xs">Kỳ KSK Năm {rec.nam_kham}</span>
                                        <span className="px-1.5 py-0.5 bg-lime-100 text-lime-800 text-[10px] font-bold rounded">
                                          {rec.ma_goi_kham || 'GK 1'}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] pt-1">
                                        <span className="text-gray-500">Phân loại SK:</span>
                                        <strong className="text-gray-800">{rec.loai_suc_khoe || 'Loại I'}</strong>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-gray-500">Bệnh nghề nghiệp:</span>
                                        <strong className={rec.ket_luan_bnn?.includes('Mắc') ? 'text-red-600' : 'text-gray-700'}>
                                          {rec.ket_luan_bnn || 'Bình thường'}
                                        </strong>
                                      </div>

                                      {rec.ten_benh_nghe_nghiep && (
                                        <div className="text-[10px] text-red-600 bg-red-50 p-1 rounded font-medium">
                                          Bệnh: {rec.ten_benh_nghe_nghiep}
                                        </div>
                                      )}

                                      {rec.ghi_chu_suc_khoe && (
                                        <div className="text-[11px] text-gray-600 pt-1 border-t border-gray-200 italic">
                                          "{rec.ghi_chu_suc_khoe}"
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* 🟢 BẢNG DANH SÁCH CHI TIẾT TỪNG BẢN GHI (LIST VIEW) */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#386641] text-white font-bold">
                    <th className="p-3 border-b border-lime-800 text-center w-12">STT</th>
                    <th className="p-3 border-b border-lime-800 min-w-[120px]">MSNV</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Họ và Tên CB-NV</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Đơn Vị Quản Lý</th>
                    <th className="p-3 border-b border-lime-800 text-center w-24">Năm KSK</th>
                    <th className="p-3 border-b border-lime-800 min-w-[110px]">Mã Gói Khám</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[130px]">Phân Loại SK</th>
                    <th className="p-3 border-b border-lime-800 min-w-[150px]">Kết Luận BNN</th>
                    <th className="p-3 border-b border-lime-800 min-w-[180px]">Ghi Chú Sức Khỏe</th>
                    <th className="p-3 border-b border-lime-800 text-center w-16">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCaNhanList.map((item, idx) => {
                    const uObj = donViMap.get(item.id_don_vi);
                    return (
                      <tr key={item.id} className="hover:bg-lime-50/30 transition-colors">
                        <td className="p-3 text-center font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-gray-800">{item.ma_so_nhan_vien}</td>
                        <td className="p-3 font-bold text-lime-950">{item.ho_ten}</td>
                        <td className="p-3 text-gray-700">{uObj?.ten_don_vi || '—'}</td>
                        <td className="p-3 text-center font-bold text-gray-800">{item.nam_kham}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-lime-100 text-lime-900 font-semibold text-[11px]">
                            {item.ma_goi_kham || 'GK 1'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${item.loai_suc_khoe?.includes('I') && !item.loai_suc_khoe?.includes('IV') && !item.loai_suc_khoe?.includes('V') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            item.loai_suc_khoe?.includes('II') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              item.loai_suc_khoe?.includes('III') ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                            {item.loai_suc_khoe || 'Loại I'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`font-semibold ${item.ket_luan_bnn?.includes('Mắc') ? 'text-red-600' : item.ket_luan_bnn?.includes('Nguy cơ') ? 'text-amber-600' : 'text-gray-700'}`}>
                            {item.ket_luan_bnn || 'Bình thường'}
                          </span>
                          {item.ten_benh_nghe_nghiep && (
                            <div className="text-[10px] text-red-500 font-medium">({item.ten_benh_nghe_nghiep})</div>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">{item.ghi_chu_suc_khoe || '—'}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => promptDeleteCaNhan(item.id, item.ho_ten)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Xóa lịch sử KSK cá nhân"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🟢 SUB-TAB 3: BÁO CÁO TỔNG HỢP & ĐỐI CHIẾU TẬP ĐOÀN */}
      {activeSubTab === 'baocao' && (
        <div className="space-y-6">
          {/* Header Báo cáo & Bộ lọc */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-lime-600" />
                <h3 className="text-base font-bold text-gray-800">
                  Báo Cáo Tổng Hợp & Đối Chiếu Gói Khám Tập Đoàn THACO AUTO
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tổng hợp số liệu khám sức khỏe toàn hệ thống và đối ứng quy đổi giữa các đơn vị cơ sở với gói khám Tập đoàn
              </p>
            </div>

            {/* Khối các nhãn điều khiển được bố trí chuẩn 2 dòng */}
            <div className="flex flex-col gap-2.5 items-start lg:items-end w-full lg:w-auto">
              {/* DÒNG 1: BỘ LỌC NĂM | HỆ THỐNG */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Chọn năm */}
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Năm:</span>
                  <select
                    value={baocaoNam}
                    onChange={e => setBaocaoNam(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Chọn phạm vi hệ thống */}
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                  <Building2 className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Hệ thống:</span>
                  <select
                    value={baocaoScope}
                    onChange={e => setBaocaoScope(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Toàn Hệ Thống</option>
                    <option value="VPDH">Chỉ VPĐH & Phân phối</option>
                    <option value="DON_VI">Chỉ Các Đơn vị Trực thuộc</option>
                  </select>
                </div>
              </div>

              {/* DÒNG 2: QUY ĐỔI TẬP ĐOÀN | MA TRẬN ĐƠN VỊ | MA TRẬN ÁNH XẠ | XUẤT EXCEL */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Chế độ xem: Quy đổi tập đoàn */}
                <button
                  type="button"
                  onClick={() => setBaocaoViewMode('quydoi_tapdoan')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${baocaoViewMode === 'quydoi_tapdoan'
                    ? 'bg-lime-700 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  📊 Quy Đổi Tập Đoàn
                </button>

                {/* Chế độ xem: Ma trận đơn vị */}
                <button
                  type="button"
                  onClick={() => setBaocaoViewMode('matran_donvi')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${baocaoViewMode === 'matran_donvi'
                    ? 'bg-lime-700 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  🏢 Ma Trận Đơn Vị
                </button>

                {/* Ma Trận Ánh Xạ */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleOpenConfigModal(activeReportConfig || undefined)}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                    title="Chỉnh sửa Ma trận phân loại gói khám & thông báo của năm này"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Ma Trận Ánh Xạ
                  </button>
                )}

                {/* Xuất Excel */}
                <button
                  type="button"
                  onClick={exportReportToExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Xuất Excel
                </button>
              </div>
            </div>
          </div>

          {/* Cards tóm tắt KPI báo cáo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Đợt Khám Đơn Vị</div>
              <div className="text-2xl font-black text-gray-800 mt-1">{reportCampaigns.length}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Số đợt khám trong năm {baocaoNam}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">SL Khám Thực Tế</div>
              <div className="text-2xl font-black text-lime-700 mt-1">
                {reportCampaigns.reduce((s, c) => s + Number(c.sl_thuc_te || 0), 0).toLocaleString('vi-VN')}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Đăng ký: {reportCampaigns.reduce((s, c) => s + Number(c.sl_dang_ky || 0), 0).toLocaleString('vi-VN')} CB-NV
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tổng Chi Phí KSK</div>
              <div className="text-2xl font-black text-blue-700 mt-1">
                {formatCurrency(reportCampaigns.reduce((s, c) => s + Number(c.tong_chi_phi || 0), 0))}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">Theo số liệu nghiệm thu thực tế</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lượt Khám BNN</div>
              <div className="text-2xl font-black text-purple-700 mt-1">
                {reportCampaigns.reduce((s, c) => {
                  const bnn1 = c.bnn_lan_1_json?.sl_kham || 0;
                  const bnn2 = c.bnn_lan_2_json?.sl_kham || 0;
                  return s + Number(bnn1) + Number(bnn2);
                }, 0).toLocaleString('vi-VN')}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">Khám bệnh nghề nghiệp 2 đợt</div>
            </div>
          </div>

          {/* VIEW 1: BẢNG QUY ĐỔI ĐỐI ỨNG GÓI TẬP ĐOÀN THACO AUTO */}
          {baocaoViewMode === 'quydoi_tapdoan' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-lime-900 to-lime-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-lime-400" />
                    Bảng Đối Chiếu Quy Đổi Gói Khám Sang Hệ Thống Gói Khám THACO (Năm {baocaoNam})
                  </h4>
                  <p className="text-[9px] text-lime-200 mt-0.5">
                    Ánh xạ số lượng khám thực tế của các đơn vị cơ sở về các nhóm gói GK1..GK4C của THACO AUTO
                  </p>
                </div>
                {activeReportConfig?.so_hieu_thong_bao && (
                  <span className="text-xs bg-lime-700/80 px-2.5 py-1 rounded-lg border border-lime-500/40 text-lime-100 whitespace-nowrap">
                    Áp dụng Ma trận theo TB: <strong>{activeReportConfig.so_hieu_thong_bao}</strong>
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left whitespace-nowrap">
                  <thead className="bg-[#FFFFF0] border-b border-gray-200 text-gray-700 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3 w-12 text-center whitespace-nowrap">STT</th>
                      <th className="p-3 w-28 whitespace-nowrap">Mã Gói TĐ</th>
                      <th className="p-3 whitespace-nowrap">Tên Gói Khám Tập Đoàn</th>
                      <th className="p-3 whitespace-nowrap">Đối Tượng / Ngạch (Tập Đoàn)</th>
                      <th className="p-3 whitespace-nowrap">🔁 Gói Đối Ứng Tại Đơn Vị</th>
                      <th className="p-3 whitespace-nowrap">Ngạch Đối Ứng (Đơn Vị)</th>
                      <th className="p-3 text-right whitespace-nowrap">SL VPĐH / PP</th>
                      <th className="p-3 text-right whitespace-nowrap">SL Đơn Vị Quy Đổi</th>
                      <th className="p-3 text-right font-black text-lime-900 whitespace-nowrap">Tổng Hợp Nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeReportMapping.map((mapRow, idx) => {
                      let slVpdh = 0;
                      let slDonVi = 0;

                      reportCampaigns.forEach(camp => {
                        const isVpdhOrCorp = camp.id_don_vi === 'HO' || camp.ap_dung_goi_tap_doan;
                        if (isVpdhOrCorp) {
                          const count = camp.goi_kham_values?.[mapRow.ma_goi_tap_doan] || 0;
                          slVpdh += count;
                        } else if (mapRow.ma_goi_don_vi) {
                          const count = camp.goi_kham_values?.[mapRow.ma_goi_don_vi] || 0;
                          slDonVi += count;
                        }
                      });

                      const totalRow = slVpdh + slDonVi;

                      return (
                        <tr key={mapRow.id || idx} className="hover:bg-lime-50/30 text-[11px] transition-colors">
                          <td className="p-3 text-center text-gray-500 font-medium whitespace-nowrap">{idx + 1}</td>
                          <td className="p-3 font-bold text-lime-800 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-lime-100 text-lime-900 rounded-md font-mono">
                              {mapRow.ma_goi_tap_doan}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-gray-800 whitespace-nowrap">{mapRow.ten_goi_tap_doan}</td>
                          <td className="p-3 text-gray-600 font-medium whitespace-nowrap">{mapRow.ngach_tap_doan || '—'}</td>
                          <td className="p-3 whitespace-nowrap">
                            {mapRow.ma_goi_don_vi ? (
                              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {mapRow.ma_goi_don_vi} {mapRow.ten_goi_don_vi ? `(${mapRow.ten_goi_don_vi})` : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">(Không có gói đối ứng cơ sở)</span>
                            )}
                          </td>
                          <td className="p-3 text-gray-500 whitespace-nowrap">{mapRow.ngach_don_vi || '—'}</td>
                          <td className="p-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                            {slVpdh.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {slDonVi.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-gray-900 bg-lime-50/50 whitespace-nowrap">
                            {totalRow.toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-lime-50 font-bold border-t-2 border-lime-300 text-gray-900">
                    {(() => {
                      let grandVpdh = 0;
                      let grandDonVi = 0;
                      activeReportMapping.forEach(mapRow => {
                        reportCampaigns.forEach(camp => {
                          const isVpdhOrCorp = camp.id_don_vi === 'HO' || camp.ap_dung_goi_tap_doan;
                          if (isVpdhOrCorp) {
                            grandVpdh += camp.goi_kham_values?.[mapRow.ma_goi_tap_doan] || 0;
                          } else if (mapRow.ma_goi_don_vi) {
                            grandDonVi += camp.goi_kham_values?.[mapRow.ma_goi_don_vi] || 0;
                          }
                        });
                      });
                      return (
                        <tr>
                          <td colSpan={6} className="p-3 text-right uppercase tracking-wider font-black whitespace-nowrap">
                            TỔNG CỘNG QUY ĐỔI HỆ THỐNG:
                          </td>
                          <td className="p-3 text-right font-mono font-black text-blue-800 whitespace-nowrap">
                            {grandVpdh.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                            {grandDonVi.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-lime-950 text-sm whitespace-nowrap">
                            {(grandVpdh + grandDonVi).toLocaleString('vi-VN')} CB-NV
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: MA TRẬN KHÁM SỨC KHỎE THEO TỪNG ĐƠN VỊ */}
          {baocaoViewMode === 'matran_donvi' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Ma Trận Chi Tiết Số Lượng Gói Khám Từng Đơn Vị (Năm {baocaoNam})
                  </h4>
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    Bao gồm các gói tiêu chuẩn cơ sở (GK 1, GK 2, GK 3A, GK 3B, GK 3C), gói BNN và tổng chi phí thực hiện
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#FFFFF0] border-b border-gray-200 text-gray-700 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 min-w-[200px]">Đơn Vị Thực Hiện</th>
                      <th className="p-3">Chế Độ Gói</th>
                      <th className="p-3 text-right">Đăng Ký</th>
                      <th className="p-3 text-right">Thực Tế</th>
                      <th className="p-3 text-right bg-lime-50/50">GK 1</th>
                      <th className="p-3 text-right bg-lime-50/50">GK 2</th>
                      <th className="p-3 text-right bg-lime-50/50">GK 3A</th>
                      <th className="p-3 text-right bg-lime-50/50">GK 3B</th>
                      <th className="p-3 text-right bg-lime-50/50">GK 3C</th>
                      <th className="p-3 text-right bg-purple-50/50">BNN</th>
                      <th className="p-3 text-right">Tổng Chi Phí (VNĐ)</th>
                      <th className="p-3 text-center">Đánh Giá NCC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportCampaigns.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="p-8 text-center text-gray-400 italic">
                          Chưa có dữ liệu đợt khám nào trong năm {baocaoNam} phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      reportCampaigns.map((camp, idx) => {
                        const unitObj = donViMap.get(camp.id_don_vi);
                        const isCorp = camp.ap_dung_goi_tap_doan || camp.id_don_vi === 'HO';
                        const vals = camp.goi_kham_values || {};
                        const bnnVals = camp.goi_kham_bnn_values || {};
                        const bnnCount = Object.values(bnnVals).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

                        return (
                          <tr key={camp.id || idx} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 text-center text-gray-500 font-medium">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-bold text-gray-900">
                                {unitObj ? `${getUnitEmoji(unitObj.loai_hinh)} ${unitObj.ten_don_vi}` : (camp.id_don_vi === 'HO' ? '🏢 Toàn hệ thống' : 'Đơn vị khác')}
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{camp.ten_dot_kham}</div>
                            </td>
                            <td className="p-3">
                              {isCorp ? (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-semibold text-[10px]">
                                  Gói Tập Đoàn
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-semibold text-[10px]">
                                  Gói Cơ Sở
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-gray-600">
                              {Number(camp.sl_dang_ky || 0).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-lime-800">
                              {Number(camp.sl_thuc_te || 0).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 text-right font-mono bg-lime-50/50">{Number(vals['GK_1'] || 0).toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-mono bg-lime-50/50">{Number(vals['GK_2'] || 0).toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-mono bg-lime-50/50">{Number(vals['GK_3A'] || 0).toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-mono bg-lime-50/50">{Number(vals['GK_3B'] || 0).toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-mono bg-lime-50/50">{Number(vals['GK_3C'] || 0).toLocaleString('vi-VN')}</td>
                            <td className="p-3 text-right font-mono font-bold text-purple-700 bg-purple-50/50">
                              {Number(bnnCount).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-blue-900">
                              {formatCurrency(Number(camp.tong_chi_phi || 0))}
                            </td>
                            <td className="p-3 text-center">
                              {camp.danh_gia_ncc === 'DAT' ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">Đạt</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Không đạt</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {reportCampaigns.length > 0 && (
                    <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 text-gray-900">
                      <tr>
                        <td colSpan={3} className="p-3 text-right uppercase tracking-wider font-black">
                          TỔNG HỢP TOÀN BỘ ĐƠN VỊ:
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {reportCampaigns.reduce((s, c) => s + Number(c.sl_dang_ky || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-lime-900">
                          {reportCampaigns.reduce((s, c) => s + Number(c.sl_thuc_te || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-right font-mono">{reportCampaigns.reduce((s, c) => s + (c.goi_kham_values?.['GK_1'] || 0), 0).toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right font-mono">{reportCampaigns.reduce((s, c) => s + (c.goi_kham_values?.['GK_2'] || 0), 0).toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right font-mono">{reportCampaigns.reduce((s, c) => s + (c.goi_kham_values?.['GK_3A'] || 0), 0).toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right font-mono">{reportCampaigns.reduce((s, c) => s + (c.goi_kham_values?.['GK_3B'] || 0), 0).toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right font-mono">{reportCampaigns.reduce((s, c) => s + (c.goi_kham_values?.['GK_3C'] || 0), 0).toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right font-mono font-bold text-purple-800">
                          {reportCampaigns.reduce((s, c) => s + Object.values(c.goi_kham_bnn_values || {}).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-blue-900">
                          {formatCurrency(reportCampaigns.reduce((s, c) => s + Number(c.tong_chi_phi || 0), 0))}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🟢 MODAL THÊM / SỬA ĐỢT KHÁM TỔNG HỢP CẤP ĐƠN VỊ */}
      {isCampaignModalOpen && editingCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-lime-100 my-8">
            <div className="bg-gradient-to-r from-lime-950 to-lime-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-lime-400" />
                <h3 className="text-base font-bold">
                  {editingCampaign.id ? 'Chỉnh Sửa Đợt Khám Sức Khỏe' : 'Tạo Đợt Khám Sức Khỏe Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsCampaignModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

              {/* Banner Thông báo Đợt khám được áp dụng & Chọn Thông báo */}
              <div className="bg-gradient-to-r from-lime-50 to-emerald-50 border border-lime-200 rounded-xl p-3.5 space-y-3 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-lime-500/10 text-lime-700 rounded-lg mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-lime-600 text-white rounded-md">
                          {selectedConfigForCampaign ? `Thông báo ${selectedConfigForCampaign.so_hieu_thong_bao}` : 'Áp dụng Định mức Thông báo'}
                        </span>
                        {selectedConfigForCampaign?.ngay_ban_hanh && (
                          <span className="text-[11px] text-gray-500">
                            Ngày ban hành: {selectedConfigForCampaign.ngay_ban_hanh}
                          </span>
                        )}
                        {selectedConfigForCampaign?.trang_thai === 'DANG_AP_DUNG' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                            🟢 Đang áp dụng
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-gray-800 mt-1">
                        {selectedConfigForCampaign?.tieu_de_thong_bao || `Định mức Gói khám Sức khỏe & BNN theo quy định`}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        💡 Đơn giá các gói được kiểm soát theo trần định mức của thông báo. Đơn vị có thể thương thảo giảm đơn giá nhưng <strong>không được vượt quá định mức</strong>.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={handleResetPricesToCeiling}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-lime-800 bg-white hover:bg-lime-100 border border-lime-300 rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                      title="Khôi phục tất cả đơn giá về mức trần ban đầu của Thông báo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Khôi phục giá trần
                    </button>
                    {(selectedConfigForCampaign?.file_dinh_kem_url || selectedConfigForCampaign?.link_thong_bao) && (
                      <a
                        href={selectedConfigForCampaign.file_dinh_kem_url || selectedConfigForCampaign.link_thong_bao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Xem file TB
                      </a>
                    )}
                  </div>
                </div>

                {/* Bộ chuyển đổi Thông báo áp dụng & Nút đồng bộ */}
                {configs.length > 0 && (
                  <div className="pt-2 border-t border-lime-200/60 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white/70 p-2.5 rounded-lg border border-lime-100">
                    <div className="flex items-center gap-2 flex-1 min-w-0 w-full md:w-auto">
                      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                        Áp dụng theo Thông báo:
                      </span>
                      <select
                        value={selectedConfigForCampaign?.id || editingCampaign.id_config_thong_bao || ''}
                        onChange={e => {
                          const chosenId = e.target.value;
                          const found = configs.find(c => c.id === chosenId);
                          if (found) {
                            handleSyncPackagesFromSelectedConfig(found);
                          }
                        }}
                        className="p-1.5 text-xs font-bold border border-lime-300 rounded-lg bg-white text-lime-900 focus:ring-2 focus:ring-lime-500 flex-1 min-w-0 cursor-pointer truncate"
                      >
                        {configs.map(cfg => (
                          <option key={cfg.id} value={cfg.id}>
                            {cfg.trang_thai === 'DANG_AP_DUNG' ? '🟢' : '⚪'} TB {cfg.so_hieu_thong_bao} (Năm {cfg.nam}) - {cfg.tieu_de_thong_bao}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSyncPackagesFromSelectedConfig()}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap w-full md:w-auto"
                      title="Nạp lại danh mục gói khám và định mức trần mới nhất từ Thông báo đã chọn (bảo toàn số lượng nhân sự đã nhập)"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      Đồng bộ theo Thông báo mới
                    </button>
                  </div>
                )}
              </div>

              {/* Chế độ đặc thù cho Admin: Gói Tập đoàn THACO AUTO */}
              {isAdmin && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cb-corporate-pkg"
                      checked={isCorporatePackageMode}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsCorporatePackageMode(checked);
                        setEditingCampaign({ ...editingCampaign, ap_dung_goi_tap_doan: checked });
                      }}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="cb-corporate-pkg" className="text-xs font-bold text-amber-900 cursor-pointer">
                      Áp dụng Gói khám Tập đoàn mẹ (Dành riêng cho THACO AUTO / Phân phối THACO AUTO)
                    </label>
                  </div>
                  <span className="text-[11px] text-amber-700">
                    {isCorporatePackageMode ? '✓ Tự do điều chỉnh gói & đơn giá khám theo gói Tập đoàn (không khóa trần định mức đơn vị)' : 'Đang áp dụng định mức cơ sở chuẩn'}
                  </span>
                </div>
              )}

              {/* Phần 1: Thông tin Đơn vị & Năm & Tên Đợt */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị thực hiện *</label>
                  <select
                    value={editingCampaign.id_don_vi}
                    onChange={e => setEditingCampaign({ ...editingCampaign, id_don_vi: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    required
                  >
                    <option value="" disabled>-- Chọn Đơn vị thực hiện --</option>
                    <option value="HO">🏢 Công ty / Toàn hệ thống</option>
                    {(() => {
                      const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = groupParentUnits(donViList);

                      const renderGroup = (label: string, items: any[]) => {
                        if (!items || items.length === 0) return null;
                        return (
                          <optgroup label={label} key={label}>
                            {items.map(u => (
                              <option key={u.id} value={u.id}>
                                {getUnitEmoji(u.loai_hinh)} {u.ten_don_vi}
                              </option>
                            ))}
                          </optgroup>
                        );
                      };

                      return (
                        <>
                          {renderGroup("🏢 VPĐH & TỔNG CÔNG TY", vpdhUnits)}
                          {renderGroup("🏬 CÔNG TY TỈNH THÀNH (NAM)", ctttNamUnits)}
                          {renderGroup("🏬 CÔNG TY TỈNH THÀNH (BẮC)", ctttBacUnits)}
                          {renderGroup("📌 ĐƠN VỊ KHÁC", otherUnits)}
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Năm Khám *</label>
                  <input
                    type="number"
                    value={editingCampaign.nam_kham}
                    onChange={e => setEditingCampaign({ ...editingCampaign, nam_kham: Number(e.target.value) })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Đợt Khám *</label>
                  <select
                    value={editingCampaign.ten_dot_kham || ''}
                    onChange={e => setEditingCampaign({ ...editingCampaign, ten_dot_kham: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    required
                  >
                    <option value="" disabled>-- Chọn Đợt Khám --</option>
                    <option value="Khám sức khỏe định kỳ">Khám sức khỏe định kỳ</option>
                    <option value="Khám Bệnh nghề nghiệp">Khám Bệnh nghề nghiệp</option>
                    <option value="Khám sức khỏe định kỳ, Khám Bệnh nghề nghiệp">Cả 2 (KSK định kỳ & Bệnh nghề nghiệp)</option>
                  </select>
                </div>
              </div>

              {/* Phần 2: Hình thức khám, Địa điểm khám */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Hình thức khám</label>
                  <select
                    value={editingCampaign.hinh_thuc_kham}
                    onChange={e => setEditingCampaign({ ...editingCampaign, hinh_thuc_kham: e.target.value as any })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  >
                    <option value="NOI_VIEN">Nội viện (Đến BV)</option>
                    <option value="NGOAI_VIEN">Ngoại viện (Tại đơn vị)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Địa điểm khám</label>
                  <input
                    type="text"
                    placeholder="VD: Tại TTYT Huyện ABC..."
                    value={editingCampaign.dia_diem_kham || ''}
                    onChange={e => setEditingCampaign({ ...editingCampaign, dia_diem_kham: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  />
                </div>
              </div>

              {/* Phần 3: Ngày lấy mẫu/XN, Ngày khám lâm sàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ngày lấy mẫu/XN (Từ - Đến)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={editingCampaign.ngay_lay_mau?.split(' đến ')[0] || ''}
                      onChange={e => {
                        const den = editingCampaign.ngay_lay_mau?.split(' đến ')[1] || '';
                        setEditingCampaign({ ...editingCampaign, ngay_lay_mau: `${e.target.value} đến ${den}` });
                      }}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="date"
                      value={editingCampaign.ngay_lay_mau?.split(' đến ')[1] || ''}
                      onChange={e => {
                        const tu = editingCampaign.ngay_lay_mau?.split(' đến ')[0] || '';
                        setEditingCampaign({ ...editingCampaign, ngay_lay_mau: `${tu} đến ${e.target.value}` });
                      }}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ngày khám lâm sàng (Từ - Đến)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={editingCampaign.ngay_kham_lam_sang?.split(' đến ')[0] || ''}
                      onChange={e => {
                        const den = editingCampaign.ngay_kham_lam_sang?.split(' đến ')[1] || '';
                        setEditingCampaign({ ...editingCampaign, ngay_kham_lam_sang: `${e.target.value} đến ${den}` });
                      }}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="date"
                      value={editingCampaign.ngay_kham_lam_sang?.split(' đến ')[1] || ''}
                      onChange={e => {
                        const tu = editingCampaign.ngay_kham_lam_sang?.split(' đến ')[0] || '';
                        setEditingCampaign({ ...editingCampaign, ngay_kham_lam_sang: `${tu} đến ${e.target.value}` });
                      }}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    />
                  </div>
                </div>
              </div>

              {/* Phần Nhà Cung Cấp */}
              <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-gray-100">
                {editingCampaign.ten_dot_kham?.includes('Khám sức khỏe định kỳ') && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">Đơn vị Khám sức khỏe</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickNccTarget('ksk');
                          setIsQuickAddNccOpen(true);
                        }}
                        className="text-[11px] font-bold text-lime-700 hover:text-lime-900 underline flex items-center gap-0.5"
                      >
                        + Thêm NCC
                      </button>
                    </div>
                    <select
                      value={editingCampaign.id_ncc || ''}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const matchedNcc = nccList.find(n => n.id === selectedId);
                        setEditingCampaign({
                          ...editingCampaign,
                          id_ncc: selectedId,
                          ten_ncc: matchedNcc ? (matchedNcc.ten_cong_ty || matchedNcc.ten_goi_tat) : e.target.value
                        });
                      }}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    >
                      <option value="">-- Chọn Đơn vị Khám sức khỏe --</option>
                      {healthNccList.map(ncc => (
                        <option key={ncc.id} value={ncc.id}>
                          {ncc.ten_cong_ty || ncc.ten_goi_tat} ({ncc.nhom_dich_vu || 'Sức khỏe'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingCampaign.ten_dot_kham?.includes('Khám Bệnh nghề nghiệp') && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">Đơn vị Khám Bệnh nghề nghiệp</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickNccTarget('bnn');
                          setIsQuickAddNccOpen(true);
                        }}
                        className="text-[11px] font-bold text-lime-700 hover:text-lime-900 underline flex items-center gap-0.5"
                      >
                        + Thêm NCC
                      </button>
                    </div>
                    <select
                      value={editingCampaign.id_ncc_bnn || ''}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const matchedNcc = nccList.find(n => n.id === selectedId);
                        setEditingCampaign({
                          ...editingCampaign,
                          id_ncc_bnn: selectedId,
                          ten_ncc_bnn: matchedNcc ? (matchedNcc.ten_cong_ty || matchedNcc.ten_goi_tat) : e.target.value
                        });
                      }}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    >
                      <option value="">-- Chọn Đơn vị Khám BNN --</option>
                      {healthNccList.map(ncc => (
                        <option key={ncc.id} value={ncc.id}>
                          {ncc.ten_cong_ty || ncc.ten_goi_tat} ({ncc.nhom_dich_vu || 'Sức khỏe'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Phần 3: Số lượng & Chi phí */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">SL Đăng Ký Khám *</label>
                  <input
                    type="number"
                    value={editingCampaign.sl_dang_ky}
                    onChange={e => setEditingCampaign({ ...editingCampaign, sl_dang_ky: Number(e.target.value) })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">SL Khám Thực Tế *</label>
                    <button
                      type="button"
                      onClick={handleQuickScanUnitPersonnel}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-0.5"
                      title="Quét số lượng nhân sự thực tế từ danh sách nhân sự đơn vị"
                    >
                      ⚡ Quét CSDL
                    </button>
                  </div>
                  <input
                    type="number"
                    value={editingCampaign.sl_thuc_te}
                    onChange={e => setEditingCampaign({ ...editingCampaign, sl_thuc_te: Number(e.target.value) })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Lý Do Không Khám (Vắng)</label>
                  <input
                    type="text"
                    placeholder="Thai sản, nghỉ việc..."
                    value={editingCampaign.ly_do_khong_kham || ''}
                    onChange={e => setEditingCampaign({ ...editingCampaign, ly_do_khong_kham: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">Tổng Chi Phí (VNĐ)</label>
                    <button
                      type="button"
                      onClick={handleAutoCalculateCost}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                      title="Tính tự động = Số lượng x Đơn giá"
                    >
                      🧮 Tính tự động
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editingCampaign.tong_chi_phi ? formatCurrencySpace(editingCampaign.tong_chi_phi) : ''}
                    onChange={e => {
                      const rawNum = Number(e.target.value.replace(/\D/g, ''));
                      setEditingCampaign({ ...editingCampaign, tong_chi_phi: rawNum });
                    }}
                    placeholder="VD: 150 000 000"
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0] font-mono font-bold text-blue-900"
                  />
                </div>
              </div>

              {/* Phần 4: Cấu hình Gói khám ĐỘNG Linh Hoạt theo Năm */}
              {/* Phần 4 & 5: Cấu hình Gói khám */}
              {editingCampaign.ten_dot_kham?.includes('Khám sức khỏe định kỳ') && (
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-lime-600" />
                      Cấu Hình Gói Khám Sức Khỏe & Số Lượng Khám Thực Tế
                    </span>
                  </div>

                  {/* Form thêm gói mới */}
                  <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <input
                      type="text"
                      placeholder="Mã gói (VD: GK_4A)"
                      value={newPackageCode}
                      onChange={e => setNewPackageCode(e.target.value)}
                      className="p-1.5 text-xs border border-gray-300 rounded-lg bg-white w-36"
                    />
                    <input
                      type="text"
                      placeholder="Tên mô tả gói khám..."
                      value={newPackageLabel}
                      onChange={e => setNewPackageLabel(e.target.value)}
                      className="p-1.5 text-xs border border-gray-300 rounded-lg bg-white flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddDynamicPackage}
                      className="px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      + Thêm Gói
                    </button>
                  </div>

                  {/* Grid nhập số lượng từng gói */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {ensureArray(formGoiKhamSchema).map(gk => {
                      const currentVal = editingCampaign.goi_kham_values?.[gk.code] || 0;
                      return (
                        <div key={gk.code} className="bg-lime-50/50 p-2.5 rounded-xl border border-lime-200 space-y-1 relative group">
                          <button
                            type="button"
                            onClick={() => handleRemoveDynamicPackage(gk.code)}
                            className="absolute top-1 right-1 text-gray-400 hover:text-rose-600 text-xs hidden group-hover:block"
                            title="Xóa gói khám này"
                          >
                            ✕
                          </button>
                          <span className="block text-[11px] font-bold text-lime-900 truncate" title={gk.label}>
                            {gk.code}
                          </span>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-gray-500 w-8">SL:</span>
                            <input
                              type="number"
                              value={currentVal}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setEditingCampaign({
                                  ...editingCampaign,
                                  goi_kham_values: {
                                    ...(editingCampaign.goi_kham_values || {}),
                                    [gk.code]: val
                                  }
                                });
                              }}
                              className="w-full p-1 text-xs border border-gray-300 rounded-lg bg-white font-bold text-center"
                            />
                          </div>
                          <div className="space-y-1 pt-1 border-t border-lime-200/50">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8" title={gk.max_price ? `Định mức trần: ${formatCurrencySpace(gk.max_price)}` : undefined}>
                                Chung:
                              </span>
                              <input
                                type="text"
                                value={gk.price ? formatCurrencySpace(gk.price) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price: val } : p));
                                }}
                                placeholder="VNĐ"
                                className={`w-full p-1 text-[10px] border rounded-md text-right font-mono transition-colors ${!isCorporatePackageMode && gk.max_price && gk.price && gk.price > gk.max_price
                                  ? 'border-rose-500 text-rose-700 bg-rose-50 font-bold ring-1 ring-rose-400'
                                  : 'border-gray-300 bg-white text-lime-800'
                                  }`}
                                title={!isCorporatePackageMode && gk.max_price && gk.price && gk.price > gk.max_price ? `Vượt định mức trần (${formatCurrency(gk.max_price)})!` : undefined}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8" title={gk.max_price_nam ? `Định mức trần: ${formatCurrencySpace(gk.max_price_nam)}` : undefined}>
                                Nam:
                              </span>
                              <input
                                type="text"
                                value={gk.price_nam ? formatCurrencySpace(gk.price_nam) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nam: val } : p));
                                }}
                                placeholder="VNĐ"
                                className={`w-full p-1 text-[10px] border rounded-md text-right font-mono transition-colors ${!isCorporatePackageMode && gk.max_price_nam && gk.price_nam && gk.price_nam > gk.max_price_nam
                                  ? 'border-rose-500 text-rose-700 bg-rose-50 font-bold ring-1 ring-rose-400'
                                  : 'border-gray-300 bg-white text-lime-800'
                                  }`}
                                title={!isCorporatePackageMode && gk.max_price_nam && gk.price_nam && gk.price_nam > gk.max_price_nam ? `Vượt định mức trần (${formatCurrency(gk.max_price_nam)})!` : undefined}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8" title={gk.max_price_nu_dt ? `Định mức trần: ${formatCurrencySpace(gk.max_price_nu_dt)}` : undefined}>
                                Nữ ĐT:
                              </span>
                              <input
                                type="text"
                                value={gk.price_nu_dt ? formatCurrencySpace(gk.price_nu_dt) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nu_dt: val } : p));
                                }}
                                placeholder="VNĐ"
                                className={`w-full p-1 text-[10px] border rounded-md text-right font-mono transition-colors ${!isCorporatePackageMode && gk.max_price_nu_dt && gk.price_nu_dt && gk.price_nu_dt > gk.max_price_nu_dt
                                  ? 'border-rose-500 text-rose-700 bg-rose-50 font-bold ring-1 ring-rose-400'
                                  : 'border-gray-300 bg-white text-lime-800'
                                  }`}
                                title={!isCorporatePackageMode && gk.max_price_nu_dt && gk.price_nu_dt && gk.price_nu_dt > gk.max_price_nu_dt ? `Vượt định mức trần (${formatCurrency(gk.max_price_nu_dt)})!` : undefined}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8" title={gk.max_price_nu_cgd ? `Định mức trần: ${formatCurrencySpace(gk.max_price_nu_cgd)}` : undefined}>
                                Nữ CGĐ:
                              </span>
                              <input
                                type="text"
                                value={gk.price_nu_cgd ? formatCurrencySpace(gk.price_nu_cgd) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nu_cgd: val } : p));
                                }}
                                placeholder="VNĐ"
                                className={`w-full p-1 text-[10px] border rounded-md text-right font-mono transition-colors ${!isCorporatePackageMode && gk.max_price_nu_cgd && gk.price_nu_cgd && gk.price_nu_cgd > gk.max_price_nu_cgd
                                  ? 'border-rose-500 text-rose-700 bg-rose-50 font-bold ring-1 ring-rose-400'
                                  : 'border-gray-300 bg-white text-lime-800'
                                  }`}
                                title={!isCorporatePackageMode && gk.max_price_nu_cgd && gk.price_nu_cgd && gk.price_nu_cgd > gk.max_price_nu_cgd ? `Vượt định mức trần (${formatCurrency(gk.max_price_nu_cgd)})!` : undefined}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const totalGoi = Object.values(editingCampaign.goi_kham_values || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
                    return (
                      <div className="pt-1">
                        <span className="text-[11px] font-bold text-lime-800 bg-lime-50 px-2.5 py-1 rounded-lg border border-lime-200 inline-block">
                          = Tổng số lượng các gói KSK: <strong className="text-lime-950 font-black">{totalGoi}</strong> nhân sự
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {editingCampaign.ten_dot_kham?.includes('Khám Bệnh nghề nghiệp') && (
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-emerald-600" />
                      Cấu Hình Gói Khám Bệnh Nghề Nghiệp & Số Lượng Khám Thực Tế
                    </span>
                  </div>

                  {/* Form thêm gói mới BNN */}
                  <div className="flex items-center gap-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <input
                      type="text"
                      placeholder="Mã gói (VD: BNN_1)"
                      value={newBnnPackageCode}
                      onChange={e => setNewBnnPackageCode(e.target.value)}
                      className="p-1.5 text-xs border border-emerald-300 rounded-lg bg-white w-36 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="Tên mô tả gói khám BNN..."
                      value={newBnnPackageLabel}
                      onChange={e => setNewBnnPackageLabel(e.target.value)}
                      className="p-1.5 text-xs border border-emerald-300 rounded-lg bg-white flex-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddBnnDynamicPackage}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      + Thêm Gói BNN
                    </button>
                  </div>

                  {/* Grid nhập số lượng từng gói BNN */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {ensureArray(formGoiKhamBnnSchema).map(gk => {
                      const currentVal = editingCampaign.goi_kham_bnn_values?.[gk.code] || 0;
                      return (
                        <div key={gk.code} className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200 space-y-1 relative group">
                          <button
                            type="button"
                            onClick={() => handleRemoveBnnDynamicPackage(gk.code)}
                            className="absolute top-1 right-1 text-gray-400 hover:text-rose-600 text-xs hidden group-hover:block"
                            title="Xóa gói khám BNN này"
                          >
                            ✕
                          </button>
                          <span className="block text-[11px] font-bold text-emerald-900 truncate" title={gk.label}>
                            {gk.code}
                          </span>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-gray-500 w-8">SL:</span>
                            <input
                              type="number"
                              value={currentVal}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setEditingCampaign({
                                  ...editingCampaign,
                                  goi_kham_bnn_values: {
                                    ...(editingCampaign.goi_kham_bnn_values || {}),
                                    [gk.code]: val
                                  }
                                });
                              }}
                              className="w-full p-1 text-xs border border-emerald-300 rounded-lg bg-white font-bold text-center"
                            />
                          </div>
                          <div className="space-y-1 pt-1 border-t border-emerald-200/50">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8" title={gk.max_price ? `Định mức trần: ${formatCurrencySpace(gk.max_price)}` : undefined}>
                                Chung:
                              </span>
                              <input
                                type="text"
                                value={gk.price ? formatCurrencySpace(gk.price) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamBnnSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price: val } : p));
                                }}
                                placeholder="VNĐ"
                                className={`w-full p-1 text-[10px] border rounded-md text-right font-mono transition-colors ${!isCorporatePackageMode && gk.max_price && gk.price && gk.price > gk.max_price
                                  ? 'border-rose-500 text-rose-700 bg-rose-50 font-bold ring-1 ring-rose-400'
                                  : 'border-emerald-300 bg-white text-emerald-800'
                                  }`}
                                title={!isCorporatePackageMode && gk.max_price && gk.price && gk.price > gk.max_price ? `Vượt định mức trần (${formatCurrency(gk.max_price)})!` : undefined}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8">Nam:</span>
                              <input
                                type="text"
                                value={gk.price_nam ? formatCurrencySpace(gk.price_nam) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamBnnSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nam: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-emerald-300 rounded-md bg-white text-right font-mono text-emerald-800"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8">Nữ ĐT:</span>
                              <input
                                type="text"
                                value={gk.price_nu_dt ? formatCurrencySpace(gk.price_nu_dt) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamBnnSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nu_dt: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-emerald-300 rounded-md bg-white text-right font-mono text-emerald-800"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8">Nữ CGĐ:</span>
                              <input
                                type="text"
                                value={gk.price_nu_cgd ? formatCurrencySpace(gk.price_nu_cgd) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamBnnSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nu_cgd: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-emerald-300 rounded-md bg-white text-right font-mono text-emerald-800"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const totalGoi = Object.values(editingCampaign.goi_kham_bnn_values || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
                    return (
                      <div className="pt-1">
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                          = Tổng số lượng các gói BNN: <strong className="text-emerald-950 font-black">{totalGoi}</strong> nhân sự
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Phần 7: Đánh giá NCC KSK */}
              <div className="pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Đánh giá Chất lượng NCC KSK</label>
                  <select
                    value={editingCampaign.danh_gia_ncc || 'DAT'}
                    onChange={e => setEditingCampaign({ ...editingCampaign, danh_gia_ncc: e.target.value as any })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  >
                    <option value="DAT">ĐẠT (Đáp ứng chất lượng & tiến độ)</option>
                    <option value="KHONG_DAT">KHÔNG ĐẠT (Chậm tiến độ / chưa hài lòng)</option>
                  </select>
                </div>

                {editingCampaign.danh_gia_ncc === 'KHONG_DAT' && (
                  <div>
                    <label className="block text-xs font-bold text-rose-700 mb-1">Lý Do NCC Không Đạt *</label>
                    <input
                      type="text"
                      placeholder="Trả kết quả chậm, ùn tắc..."
                      value={editingCampaign.ly_do_ncc_khong_dat || ''}
                      onChange={e => setEditingCampaign({ ...editingCampaign, ly_do_ncc_khong_dat: e.target.value })}
                      className="w-full p-2 text-xs border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-[#FFFFF0]"
                    />
                  </div>
                )}
              </div>

              {/* Cảnh báo vi phạm trần định mức */}
              {ceilingViolations.length > 0 && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start gap-2.5 text-rose-800">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="font-bold">Đơn giá vượt Định mức Thông báo:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                      {ceilingViolations.map((v, idx) => (
                        <li key={idx}>
                          Gói <span className="font-semibold">{v.code}</span> ({v.field}): đơn giá {formatCurrency(v.price)} vượt mức trần quy định {formatCurrency(v.maxPrice)}.
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetPricesToCeiling}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                      >
                        Đồng bộ về giá trần ngay
                      </button>
                      <span className="text-[11px] text-rose-600">
                        Vui lòng giảm đơn giá về bằng hoặc thấp hơn định mức để có thể Lưu đợt khám.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Modal Buttons */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingCampaign || ceilingViolations.length > 0}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${ceilingViolations.length > 0
                    ? 'bg-gray-400 cursor-not-allowed opacity-70'
                    : 'bg-lime-600 hover:bg-lime-700'
                    }`}
                  title={ceilingViolations.length > 0 ? 'Không thể lưu do có đơn giá vượt định mức thông báo' : ''}
                >
                  {savingCampaign ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  {editingCampaign.id ? 'Cập Nhật Đợt Khám' : 'Lưu Đợt Khám Mới'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🟢 MODAL QUẢN LÝ CẤU HÌNH THÔNG BÁO, ĐỊNH MỨC & MA TRẬN ÁNH XẠ (DÀNH CHO ADMIN) */}
      {isConfigModalOpen && editingConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden border border-lime-100 my-8">
            <div className="bg-gradient-to-r from-lime-950 to-lime-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-lime-400" />
                <h3 className="text-base font-bold">
                  {editingConfig.id ? `Cấu Hình Thông Báo & Định Mức Khám Năm ${editingConfig.nam}` : 'Tạo Mới Cấu Hình Thông Báo & Định Mức Gói Khám'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
              {/* THANH CHUYỂN ĐỔI NHANH CÁC THÔNG BÁO ĐÃ LƯU & NÚT TẠO MỚI */}
              <div className="bg-lime-900/5 p-3 rounded-xl border border-lime-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-gray-700 mr-1 flex items-center gap-1">
                    <FileText className="w-4 h-4 text-lime-700" /> Danh sách Thông báo ({configs.length}):
                  </span>
                  {configs.map(c => {
                    const isSelected = editingConfig?.id === c.id;
                    return (
                      <button
                        key={c.id || c.so_hieu_thong_bao}
                        type="button"
                        onClick={() => setEditingConfig(JSON.parse(JSON.stringify(c)))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isSelected
                          ? 'bg-lime-700 text-white shadow-xs ring-2 ring-lime-400'
                          : 'bg-white hover:bg-lime-50 text-gray-700 border border-gray-300'
                          }`}
                      >
                        <span>{c.trang_thai === 'DANG_AP_DUNG' ? '🟢' : '⚪'}</span>
                        <span>TB {c.so_hieu_thong_bao} ({c.nam})</span>
                      </button>
                    );
                  })}
                  {configs.length === 0 && (
                    <span className="text-xs text-gray-500 italic">Chưa có thông báo nào trong CSDL. Vui lòng tạo mới bên cạnh.</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCreateNewConfig}
                  className="px-3.5 py-1.5 bg-lime-600 hover:bg-lime-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Tạo Thông Báo Mới
                </button>
              </div>

              {/* PHẦN 1: THÔNG TIN THÔNG BÁO BAN HÀNH */}
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <FileText className="w-4 h-4 text-lime-700" />
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    1. Thông Tin Thông Báo Ban Hành
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Số Hiệu Thông Báo *</label>
                    <input
                      type="text"
                      placeholder="VD: 88/TB-QTVP-ATVSLD"
                      value={editingConfig.so_hieu_thong_bao}
                      onChange={e => setEditingConfig({ ...editingConfig, so_hieu_thong_bao: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Năm Áp Dụng *</label>
                    <input
                      type="number"
                      value={editingConfig.nam}
                      onChange={e => setEditingConfig({ ...editingConfig, nam: Number(e.target.value) })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày Ban Hành</label>
                    <input
                      type="date"
                      value={editingConfig.ngay_ban_hanh || ''}
                      onChange={e => setEditingConfig({ ...editingConfig, ngay_ban_hanh: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Trạng Thái Áp Dụng</label>
                    <select
                      value={editingConfig.trang_thai}
                      onChange={e => setEditingConfig({ ...editingConfig, trang_thai: e.target.value as any })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500 font-bold text-lime-800"
                    >
                      <option value="DANG_AP_DUNG">🟢 Đang áp dụng (Mặc định nạp)</option>
                      <option value="HET_HIEU_LUC">⚪ Hết hiệu lực</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tiêu Đề Thông Báo *</label>
                    <input
                      type="text"
                      placeholder="VD: Thông báo về việc triển khai khám sức khỏe định kỳ & BNN năm 2026..."
                      value={editingConfig.tieu_de_thong_bao}
                      onChange={e => setEditingConfig({ ...editingConfig, tieu_de_thong_bao: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Loại Đợt Khám Ban Hành</label>
                    <select
                      value={editingConfig.loai_dot_kham}
                      onChange={e => setEditingConfig({ ...editingConfig, loai_dot_kham: e.target.value as any })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500 font-semibold"
                    >
                      <option value="KSK_VA_BNN">Cả 2 (KSK định kỳ & Bệnh nghề nghiệp)</option>
                      <option value="KSK_DINH_KY">Chỉ Khám Sức Khỏe Định Kỳ</option>
                      <option value="PHAT_HIEN_BNN">Chỉ Khám Bệnh Nghề Nghiệp</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Link File Đính Kèm (PDF Thông báo)</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... hoặc link văn bản nội bộ"
                    value={editingConfig.file_dinh_kem_url || editingConfig.link_thong_bao || ''}
                    onChange={e => setEditingConfig({ ...editingConfig, file_dinh_kem_url: e.target.value, link_thong_bao: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-lime-500 font-mono"
                  />
                </div>
              </div>

              {/* PHẦN 2: CẤU HÌNH GÓI KHÁM KSK & ĐỊNH MỨC TRẦN */}
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-lime-700" />
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        2. Cấu Hình Gói Khám KSK & Định Mức Chi Phí (Nam, Nữ ĐT, Nữ CGĐ)
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Đơn vị chỉ có thể thương thảo đơn giá bằng hoặc thấp hơn định mức trần dưới đây.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cur = editingConfig.goi_kham_schema || [];
                      const newCode = `GK_${cur.length + 1}`;
                      const newPkg: DynamicGoiKhamItem = {
                        code: newCode,
                        label: `Gói Khám Mới (${newCode})`,
                        mo_ta: '',
                        price: 1000000,
                        price_nam: 1000000,
                        price_nu_dt: 1200000,
                        price_nu_cgd: 1500000,
                        max_price: 1000000,
                        max_price_nam: 1000000,
                        max_price_nu_dt: 1200000,
                        max_price_nu_cgd: 1500000,
                        ma_goi_tap_doan: 'GK4'
                      };
                      setEditingConfig({ ...editingConfig, goi_kham_schema: [...cur, newPkg] });
                    }}
                    className="px-3 py-1.5 bg-lime-700 hover:bg-lime-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm Gói KSK
                  </button>
                </div>

                <div className="space-y-3">
                  {ensureArray(editingConfig.goi_kham_schema).map((gk, idx) => (
                    <div key={gk.code || idx} className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2 relative group shadow-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingConfig({
                            ...editingConfig,
                            goi_kham_schema: (editingConfig.goi_kham_schema || []).filter((_, i) => i !== idx)
                          });
                        }}
                        className="absolute top-2 right-2 text-gray-400 hover:text-rose-600 transition-colors p-1"
                        title="Xóa gói khám này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Mã Gói</label>
                          <input
                            type="text"
                            value={gk.code}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, code: val } : p)
                              });
                            }}
                            className="w-full p-1.5 text-xs border border-gray-300 rounded-lg font-bold text-lime-900 bg-lime-50/50"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Tên Mô Tả Gói Khám</label>
                          <input
                            type="text"
                            value={gk.label}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, label: val } : p)
                              });
                            }}
                            className="w-full p-1.5 text-xs border border-gray-300 rounded-lg font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Ánh Xạ Gói Tập Đoàn Mẹ</label>
                          <input
                            type="text"
                            placeholder="VD: GK3, GK4, GK4A..."
                            value={gk.ma_goi_tap_doan || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, ma_goi_tap_doan: val } : p)
                              });
                            }}
                            className="w-full p-1.5 text-xs border border-gray-300 rounded-lg font-mono font-bold text-blue-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600">Trần Định Mức Chung (VNĐ)</label>
                          <input
                            type="text"
                            value={gk.max_price ? formatCurrencySpace(gk.max_price) : ''}
                            onChange={e => {
                              const num = Number(e.target.value.replace(/\D/g, ''));
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, max_price: num, price: num } : p)
                              });
                            }}
                            placeholder="0"
                            className="w-full p-1.5 text-xs border border-gray-300 rounded-lg text-right font-mono font-bold text-gray-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-blue-700">Trần Nam (VNĐ) *</label>
                          <input
                            type="text"
                            value={gk.max_price_nam ? formatCurrencySpace(gk.max_price_nam) : ''}
                            onChange={e => {
                              const num = Number(e.target.value.replace(/\D/g, ''));
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, max_price_nam: num, price_nam: num } : p)
                              });
                            }}
                            placeholder="0"
                            className="w-full p-1.5 text-xs border border-blue-200 bg-blue-50/30 rounded-lg text-right font-mono font-bold text-blue-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-purple-700">Trần Nữ Độc Thân (VNĐ) *</label>
                          <input
                            type="text"
                            value={gk.max_price_nu_dt ? formatCurrencySpace(gk.max_price_nu_dt) : ''}
                            onChange={e => {
                              const num = Number(e.target.value.replace(/\D/g, ''));
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, max_price_nu_dt: num, price_nu_dt: num } : p)
                              });
                            }}
                            placeholder="0"
                            className="w-full p-1.5 text-xs border border-purple-200 bg-purple-50/30 rounded-lg text-right font-mono font-bold text-purple-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-rose-700">Trần Nữ Có Gia Đình (VNĐ) *</label>
                          <input
                            type="text"
                            value={gk.max_price_nu_cgd ? formatCurrencySpace(gk.max_price_nu_cgd) : ''}
                            onChange={e => {
                              const num = Number(e.target.value.replace(/\D/g, ''));
                              setEditingConfig({
                                ...editingConfig,
                                goi_kham_schema: (editingConfig.goi_kham_schema || []).map((p, i) => i === idx ? { ...p, max_price_nu_cgd: num, price_nu_cgd: num } : p)
                              });
                            }}
                            placeholder="0"
                            className="w-full p-1.5 text-xs border border-rose-200 bg-rose-50/30 rounded-lg text-right font-mono font-bold text-rose-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHẦN 3: CẤU HÌNH GÓI KHÁM BỆNH NGHỀ NGHIỆP (BNN) */}
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        3. Cấu Hình Gói Khám Bệnh Nghề Nghiệp & Định Mức Trần
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cur = editingConfig.goi_kham_bnn_schema || [];
                      const newCode = `BNN_${cur.length + 1}`;
                      const newPkg: DynamicGoiKhamItem = {
                        code: newCode,
                        label: `Khám BNN Mới (${newCode})`,
                        price: 350000,
                        max_price: 350000
                      };
                      setEditingConfig({ ...editingConfig, goi_kham_bnn_schema: [...cur, newPkg] });
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm Gói BNN
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ensureArray(editingConfig.goi_kham_bnn_schema).map((gk, idx) => (
                    <div key={gk.code || idx} className="bg-white p-3 rounded-xl border border-gray-200 space-y-2 relative group shadow-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingConfig({
                            ...editingConfig,
                            goi_kham_bnn_schema: (editingConfig.goi_kham_bnn_schema || []).filter((_, i) => i !== idx)
                          });
                        }}
                        className="absolute top-2 right-2 text-gray-400 hover:text-rose-600 transition-colors p-1"
                        title="Xóa gói BNN này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={gk.code}
                          onChange={e => {
                            const val = e.target.value;
                            setEditingConfig({
                              ...editingConfig,
                              goi_kham_bnn_schema: (editingConfig.goi_kham_bnn_schema || []).map((p, i) => i === idx ? { ...p, code: val } : p)
                            });
                          }}
                          className="w-28 p-1.5 text-xs border border-gray-300 rounded-lg font-bold text-emerald-900 bg-emerald-50/50"
                        />
                        <input
                          type="text"
                          value={gk.label}
                          onChange={e => {
                            const val = e.target.value;
                            setEditingConfig({
                              ...editingConfig,
                              goi_kham_bnn_schema: (editingConfig.goi_kham_bnn_schema || []).map((p, i) => i === idx ? { ...p, label: val } : p)
                            });
                          }}
                          className="flex-1 p-1.5 text-xs border border-gray-300 rounded-lg font-semibold"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <span className="text-[10px] font-bold text-gray-600 w-32">Trần Chi Phí (VNĐ):</span>
                        <input
                          type="text"
                          value={gk.max_price ? formatCurrencySpace(gk.max_price) : ''}
                          onChange={e => {
                            const num = Number(e.target.value.replace(/\D/g, ''));
                            setEditingConfig({
                              ...editingConfig,
                              goi_kham_bnn_schema: (editingConfig.goi_kham_bnn_schema || []).map((p, i) => i === idx ? { ...p, max_price: num, price: num } : p)
                            });
                          }}
                          placeholder="0"
                          className="flex-1 p-1.5 text-xs border border-gray-300 rounded-lg text-right font-mono font-bold text-emerald-900 bg-emerald-50/30"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PHẦN 4: 🔄 BẢNG MA TRẬN ÁNH XẠ ĐỐI ỨNG GÓI TẬP ĐOÀN THACO AUTO (CHỈNH SỬA THEO NĂM) */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-800" />
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                        4. Ma Trận Ánh Xạ Đối Ứng Gói Tập Đoàn THACO AUTO (Năm {editingConfig.nam})
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Bảng này cho phép Ban Lãnh đạo tùy biến phân loại gói khám & chức danh tương ứng cho từng năm/kỳ khám.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleApplyDefaultThacoMapping}
                      className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      title="Nạp lại bảng ánh xạ mẫu chuẩn 7 nhóm của THACO AUTO"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Mẫu Chuẩn THACO
                    </button>
                    <button
                      type="button"
                      onClick={handleAddMappingRow}
                      className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm Dòng Ánh Xạ
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl border border-amber-200 shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FFFFF0] border-b border-amber-200 text-amber-950 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5 w-10 text-center">STT</th>
                        <th className="p-2.5 w-24">Mã Gói TĐ</th>
                        <th className="p-2.5">Tên Gói Tập Đoàn</th>
                        <th className="p-2.5">Ngạch CBNV Tập Đoàn</th>
                        <th className="p-2.5 w-36">🔁 Gói Đơn Vị</th>
                        <th className="p-2.5">Tên Gói Đơn Vị</th>
                        <th className="p-2.5">Ngạch CBNV Đơn Vị</th>
                        <th className="p-2.5 w-12 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {ensureArray(editingConfig.bang_anh_xa_tap_doan).map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-2 text-center text-gray-500 font-medium">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.ma_goi_tap_doan}
                              onChange={e => handleUpdateMappingRow(idx, { ma_goi_tap_doan: e.target.value.toUpperCase() })}
                              placeholder="VD: GK1"
                              className="w-full p-1 text-xs border border-gray-300 rounded font-mono font-bold text-amber-950 uppercase"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.ten_goi_tap_doan}
                              onChange={e => handleUpdateMappingRow(idx, { ten_goi_tap_doan: e.target.value })}
                              placeholder="Tên gói tập đoàn..."
                              className="w-full p-1 text-xs border border-gray-300 rounded font-semibold text-gray-800"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.ngach_tap_doan}
                              onChange={e => handleUpdateMappingRow(idx, { ngach_tap_doan: e.target.value })}
                              placeholder="VD: Ngạch A1-A3..."
                              className="w-full p-1 text-xs border border-gray-300 rounded text-gray-700"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.ma_goi_don_vi || ''}
                              onChange={e => {
                                const selectedCode = e.target.value;
                                const matchedGk = (editingConfig.goi_kham_schema || []).find(g => g.code === selectedCode);
                                handleUpdateMappingRow(idx, {
                                  ma_goi_don_vi: selectedCode,
                                  ten_goi_don_vi: matchedGk ? matchedGk.label : (selectedCode ? selectedCode : '(Không có đối ứng tại Đơn vị)')
                                });
                              }}
                              className="w-full p-1 text-xs border border-emerald-300 rounded bg-emerald-50/50 font-bold text-emerald-900 cursor-pointer focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">(Không có đối ứng)</option>
                              {(editingConfig.goi_kham_schema || []).map(g => (
                                <option key={g.code} value={g.code}>
                                  {g.code} - {g.label}
                                </option>
                              ))}
                              {row.ma_goi_don_vi && !(editingConfig.goi_kham_schema || []).some(g => g.code === row.ma_goi_don_vi) && (
                                <option value={row.ma_goi_don_vi}>
                                  {row.ma_goi_don_vi} {row.ten_goi_don_vi ? `(${row.ten_goi_don_vi})` : ''}
                                </option>
                              )}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.ten_goi_don_vi || ''}
                              onChange={e => handleUpdateMappingRow(idx, { ten_goi_don_vi: e.target.value })}
                              placeholder="Tên gói đơn vị..."
                              className="w-full p-1 text-xs border border-gray-300 rounded text-gray-800"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.ngach_don_vi || ''}
                              onChange={e => handleUpdateMappingRow(idx, { ngach_don_vi: e.target.value })}
                              placeholder="VD: Ngạch A6-A8..."
                              className="w-full p-1 text-xs border border-gray-300 rounded text-gray-700"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveMappingRow(idx)}
                              className="p-1 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Xóa dòng ánh xạ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FOOTER MODAL */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <div>
                  {editingConfig.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteConfig(editingConfig.id)}
                      className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Xóa Cấu Hình Này
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-all cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-5 py-2 bg-lime-600 text-white rounded-xl text-xs font-bold hover:bg-lime-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                    {editingConfig.id ? 'Cập Nhật Cấu Hình' : 'Lưu & Kích Hoạt Cấu Hình'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 MODAL DÁN EXCEL HÀNG LOẠT (PASTE IMPORT) */}
      <PasteImportModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSave={handleSavePasteExcel}
        title="Dán Excel Kết Quả Khám Sức Khỏe Nhân Sự"
        columnMapping={excelColumnMapping}
      />

      {/* 🟢 MODAL THÊM MỚI NHÀ CUNG CẤP KSK NHANH */}
      {isQuickAddNccOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-lime-100 animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-lime-950 to-lime-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-lime-400" />
                <h3 className="text-sm font-bold">Thêm Mới Bệnh Viện / Nhà Cung Cấp KSK</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddNccOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickNcc} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tên Bệnh Viện / Phòng Khám *</label>
                <input
                  type="text"
                  placeholder="VD: Bệnh viện Đa khoa Quốc tế Vinmec"
                  value={newNccForm.ten_cong_ty}
                  onChange={e => setNewNccForm({ ...newNccForm, ten_cong_ty: e.target.value })}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tên Đầu Mối Liên Hệ</label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn A (Phòng Dịch vụ KSK)"
                  value={newNccForm.dau_moi}
                  onChange={e => setNewNccForm({ ...newNccForm, dau_moi: e.target.value })}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Số Điện Thoại DLM</label>
                  <input
                    type="text"
                    placeholder="VD: 0901234567"
                    value={newNccForm.sdt_dau_moi}
                    onChange={e => setNewNccForm({ ...newNccForm, sdt_dau_moi: e.target.value })}
                    className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nhóm Dịch Vụ</label>
                  <input
                    type="text"
                    value={newNccForm.nhom_dich_vu}
                    onChange={e => setNewNccForm({ ...newNccForm, nhom_dich_vu: e.target.value })}
                    className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Địa Chỉ Bệnh Viện / Phòng Khám</label>
                <input
                  type="text"
                  placeholder="VD: 208 Nguyễn Hữu Cảnh, P. 22, Q. Bình Thạnh..."
                  value={newNccForm.dia_chi}
                  onChange={e => setNewNccForm({ ...newNccForm, dia_chi: e.target.value })}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsQuickAddNccOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingQuickNcc}
                  className="px-5 py-2 bg-lime-600 text-white rounded-xl text-xs font-bold hover:bg-lime-700 transition-all shadow-sm flex items-center gap-1.5"
                >
                  {savingQuickNcc ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Tạo & Chọn NCC Này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 CUSTOM CONFIRM MODAL ĐỒNG BỘ PHONG CÁCH UI ỨNG DỤNG */}
      {confirmDeleteType !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border-4 border-red-100 shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {confirmDeleteType === 'CAMPAIGN' ? 'Xóa đợt khám?' : 'Xóa lịch sử KSK cá nhân?'}
            </h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              {confirmDeleteType === 'CAMPAIGN' ? (
                <>
                  Bạn có chắc chắn muốn xóa Đợt khám <span className="font-bold text-gray-800">"{deleteTargetName}"</span> không? Hành động này không thể hoàn tác.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa lịch sử KSK cá nhân của nhân sự <span className="font-bold text-gray-800">"{deleteTargetName}"</span> không?
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setConfirmDeleteType(null); setDeleteTargetId(null); setDeleteTargetName(''); }}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
