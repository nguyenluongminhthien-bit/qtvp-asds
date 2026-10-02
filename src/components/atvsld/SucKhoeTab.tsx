import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart, Plus, Search, Filter, Download, Upload, Trash2, Edit3,
  CheckCircle, AlertTriangle, Building2, Calendar, FileText, Activity,
  Users, DollarSign, Stethoscope, ChevronRight, BarChart3, PieChart as PieIcon, RefreshCw, X, ShieldAlert
} from 'lucide-react';
import { DonVi, KhamSucKhoeRecord, KhamSucKhoeCaNhanRecord, DynamicGoiKhamItem } from '../../types';
import { getKhamSucKhoeCampaigns, saveKhamSucKhoeCampaign, deleteKhamSucKhoeCampaign, getKhamSucKhoeCaNhan, saveKhamSucKhoeCaNhanBatch, deleteKhamSucKhoeCaNhan, getPersonnel, getNhaCungCap, save } from '../../services/api/modules';
import { formatCurrency, formatCurrencySpace } from '../../utils/formatters';
import { getAllSubordinateIds, groupParentUnits, getUnitEmoji } from '../../utils/hierarchy';
import { toast } from '../../utils/toast';
import PasteImportModal, { ColumnMapItem } from '../ui/PasteImportModal';
import { EXCEL_TEMPLATES } from '../../utils/excelTemplates';

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
  activeSubTabSuckhoe?: 'tonghop' | 'canhan';
  setActiveSubTabSuckhoe?: (tab: 'tonghop' | 'canhan') => void;
  onTabCountsChange?: (campaignCount: number, caNhanCount: number) => void;
}

const DEFAULT_GOI_KHAM_PRESETS: DynamicGoiKhamItem[] = [
  { code: 'GK_1', label: 'GK 1 (Tiêu chuẩn)' },
  { code: 'GK_2', label: 'GK 2 (Chuyên sâu)' },
  { code: 'GK_3A', label: 'GK 3A (Độc hại Nặng nhọc)' },
  { code: 'GK_3B_1', label: 'GK 3B-1 (Đặc thù hóa chất)' },
  { code: 'GK_3B_2', label: 'GK 3B-2 (Đặc thù tiếng ồn)' },
  { code: 'GK_C', label: 'GK C (Cấp Quản lý)' }
];

export default function SucKhoeTab({
  selectedUnitFilter,
  allowedDonViIds,
  donViList,
  onReloadData,
  activeSubTabSuckhoe,
  setActiveSubTabSuckhoe,
  onTabCountsChange
}: SucKhoeTabProps) {
  // State chính
  const [loading, setLoading] = useState<boolean>(true);
  const [campaigns, setCampaigns] = useState<KhamSucKhoeRecord[]>([]);
  const [caNhanList, setCaNhanList] = useState<KhamSucKhoeCaNhanRecord[]>([]);
  const [nhanSuList, setNhanSuList] = useState<any[]>([]);
  const [nccList, setNccList] = useState<any[]>([]);

  // State bộ lọc & tìm kiếm
  const [selectedNam, setSelectedNam] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [localActiveSubTab, setLocalActiveSubTab] = useState<'tonghop' | 'canhan'>('tonghop');
  const activeSubTab = activeSubTabSuckhoe !== undefined ? activeSubTabSuckhoe : localActiveSubTab;
  const setActiveSubTab = setActiveSubTabSuckhoe !== undefined ? setActiveSubTabSuckhoe : setLocalActiveSubTab;

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
        const [cData, cnData, nccData, nsData] = await Promise.all([
          getKhamSucKhoeCampaigns().catch(() => []),
          getKhamSucKhoeCaNhan().catch(() => []),
          getNhaCungCap().catch(() => []),
          getPersonnel().catch(() => [])
        ]);

        setCampaigns(Array.isArray(cData) ? cData : []);
        setCaNhanList(Array.isArray(cnData) ? cnData : []);
        setNccList(Array.isArray(nccData) ? nccData : []);
        setNhanSuList(Array.isArray(nsData) ? nsData : []);
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

  useEffect(() => {
    if (onTabCountsChange) {
      onTabCountsChange(filteredCampaigns.length, filteredCaNhanList.length);
    }
  }, [filteredCampaigns.length, filteredCaNhanList.length, onTabCountsChange]);

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

  // Mở Modal Thêm/Sửa đợt khám tổng hợp
  const handleOpenCampaignModal = (item?: KhamSucKhoeRecord) => {
    if (item) {
      setEditingCampaign({ ...item });
      setFormGoiKhamSchema(item.goi_kham_schema && item.goi_kham_schema.length > 0 ? item.goi_kham_schema : DEFAULT_GOI_KHAM_PRESETS);
      setFormGoiKhamBnnSchema(item.goi_kham_bnn_schema && item.goi_kham_bnn_schema.length > 0 ? item.goi_kham_bnn_schema : []);
    } else {
      const defaultUnit = selectedUnitFilter !== 'ALL' && selectedUnitFilter !== 'HO' ? selectedUnitFilter : (allowedDonViIds[0] || donViList[0]?.id || '');
      setEditingCampaign({
        id: '',
        id_don_vi: defaultUnit,
        nam_kham: new Date().getFullYear(),
        ten_dot_kham: `Khám sức khỏe định kỳ năm ${new Date().getFullYear()}`,
        hinh_thuc_kham: 'NOI_VIEN',
        dia_diem_kham: '',
        ngay_lay_mau: '',
        ngay_kham_lam_sang: '',
        sl_dang_ky: 0,
        sl_thuc_te: 0,
        sl_khong_kham: 0,
        ly_do_khong_kham: '',
        tong_chi_phi: 0,
        goi_kham_schema: DEFAULT_GOI_KHAM_PRESETS,
        goi_kham_values: {},
        goi_kham_bnn_schema: [],
        goi_kham_bnn_values: {},
        ket_qua_ksk_json: { loai_1: 0, loai_2: 0, loai_3: 0, loai_4: 0, loai_5: 0, khong_phan_loai: 0 },
        bnn_lan_1_json: { sl_kham: 0, sl_mac_bnn: 0, sl_nguy_co: 0 },
        bnn_lan_2_json: { sl_kham: 0, sl_mac_bnn: 0, sl_nguy_co: 0 },
        danh_gia_ncc: 'DAT',
        ly_do_ncc_khong_dat: '',
        ghi_chu: ''
      });
      setFormGoiKhamSchema(DEFAULT_GOI_KHAM_PRESETS);
      setFormGoiKhamBnnSchema([]);
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
    
    // Tìm các hồ sơ cá nhân thuộc đợt khám này
    const campaignRecords = caNhanList.filter(r => r.id_dot_ksk === editingCampaign.id);

    if (campaignRecords.length === 0) {
      toast.info("Chưa có danh sách (từ Excel). Tính theo Giá chung nhân với Số lượng.");
      
      // Tính chi phí KSK (Dựa trên số lượng nhập & giá chung)
      if (editingCampaign.ten_dot_kham?.includes('Khám sức khỏe định kỳ')) {
        formGoiKhamSchema.forEach(gk => {
          const qty = editingCampaign.goi_kham_values?.[gk.code] || 0;
          const price = gk.price || gk.price_nam || 0;
          totalCost += (qty * price);
        });
      }

      // Tính chi phí BNN
      if (editingCampaign.ten_dot_kham?.includes('Khám Bệnh nghề nghiệp')) {
        formGoiKhamBnnSchema.forEach(gk => {
          const qty = editingCampaign.goi_kham_bnn_values?.[gk.code] || 0;
          const price = gk.price || gk.price_nam || 0;
          totalCost += (qty * price);
        });
      }
    } else {
      // Đã có danh sách Excel -> Quét và áp giá chính xác theo Giới tính/Hôn nhân
      campaignRecords.forEach(r => {
        const isNam = r.gioi_tinh?.toLowerCase() === 'nam';
        const honNhan = r.hon_nhan?.toLowerCase() || '';
        const isNuDt = !isNam && (honNhan.includes('độc thân') || honNhan.includes('chưa'));
        const isNuCgd = !isNam && !isNuDt;

        if (editingCampaign.ten_dot_kham?.includes('Khám sức khỏe định kỳ') && r.ma_goi_kham) {
          const gk = formGoiKhamSchema.find(g => g.code === r.ma_goi_kham);
          if (gk) {
            if (isNam) totalCost += (gk.price_nam || gk.price || 0);
            else if (isNuDt) totalCost += (gk.price_nu_dt || gk.price || 0);
            else totalCost += (gk.price_nu_cgd || gk.price || 0);
          }
        }
      });

      // BNN thì không thường phân biệt nam nữ, nhưng nếu có vẫn quét chung (Ở đây quét fallback)
      if (editingCampaign.ten_dot_kham?.includes('Khám Bệnh nghề nghiệp')) {
        formGoiKhamBnnSchema.forEach(gk => {
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

    setSavingCampaign(true);
    try {
      const payload: KhamSucKhoeRecord = {
        ...editingCampaign,
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

          <div className="flex flex-wrap items-center gap-3">
            {/* Chọn Năm */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">Năm KSK:</span>
              <select
                value={selectedNam}
                onChange={e => setSelectedNam(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map(y => (
                  <option key={y} value={String(y)}>Năm {y}</option>
                ))}
              </select>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên đợt, nhân sự, NCC..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 w-48"
              />
            </div>

            {/* Nút Thêm Đợt Khám Tổng Hợp */}
            <button
              onClick={() => handleOpenCampaignModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
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
                { label: 'Loại I', val: kpiStats.totalLoai1, color: 'text-emerald-700', bg: 'bg-emerald-100' },
                { label: 'Loại II', val: kpiStats.totalLoai2, color: 'text-green-700', bg: 'bg-green-100' },
                { label: 'Loại III', val: kpiStats.totalLoai3, color: 'text-blue-700', bg: 'bg-blue-100' },
                { label: 'Loại IV', val: kpiStats.totalLoai4, color: 'text-amber-700', bg: 'bg-amber-100' },
                { label: 'Loại V', val: kpiStats.totalLoai5, color: 'text-red-700', bg: 'bg-red-100' }
              ].map(t => {
                const pct = kpiStats.totalThucTe > 0 ? ((t.val / kpiStats.totalThucTe) * 100).toFixed(1) : '0';
                return (
                  <div key={t.label} className="flex-1 text-center bg-white/50 rounded-lg p-1.5 shadow-xs border border-white/60">
                    <div className={`text-[10px] font-bold ${t.color} ${t.bg} py-0.5 rounded mx-0.5 mb-1`}>{t.label}</div>
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

      {/* 🟢 TAB CHUYỂN ĐỔI CHẾ ĐỘ XEM: ĐỢT KHÁM TỔNG HỢP VS CHI TIẾT NHÂN SỰ */}
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
                  <tr className="bg-[#386641] text-white font-bold">
                    <th className="p-3 border-b border-lime-800 text-center w-12">STT</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Đơn Vị</th>
                    <th className="p-3 border-b border-lime-800 min-w-[200px]">Đợt Khám & NCC</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[140px]">Mốc Thời Gian</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[130px]">SL Đăng Ký / Thực Tế</th>
                    <th className="p-3 border-b border-lime-800 min-w-[150px]">Các Gói Khám</th>
                    <th className="p-3 border-b border-lime-800 min-w-[160px]">Phân Loại Sức khoẻ</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[130px]">Bệnh Nghề nghiệp</th>
                    <th className="p-3 border-b border-lime-800 text-right min-w-[120px]">Tổng Chi Phí</th>
                    <th className="p-3 border-b border-lime-800 text-center min-w-[110px]">Đánh Giá NCC</th>
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
                        <td className="p-3 font-bold text-gray-800">
                          {uObj?.ten_don_vi || '—'}
                          <div className="text-[10px] text-gray-400 font-normal">Năm KSK: {item.nam_kham}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-lime-950">{item.ten_dot_kham || 'KSK Định Kỳ'}</div>
                          <div className="text-[11px] text-gray-700 flex items-center gap-1 mt-0.5">
                            <span className="font-semibold text-lime-900">KSK: {item.ten_ncc || 'Chưa chọn'}</span>
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
                          <div className="text-[11px]">
                            <span className="text-gray-500">Lấy máu:</span> <strong className="text-gray-800">{item.ngay_lay_mau || '—'}</strong>
                          </div>
                          <div className="text-[11px]">
                            <span className="text-gray-500">Khám LS:</span> <strong className="text-lime-700">{item.ngay_kham_lam_sang || '—'}</strong>
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
                            L1 {item.ngay_kham_bnn_lan_1 ? `(${item.ngay_kham_bnn_lan_1})` : ''}: <strong className="text-gray-700">{bnn1.sl_kham || 0}</strong> | Mắc: <strong className="text-red-600">{bnn1.sl_mac_bnn || 0}</strong>
                          </div>
                          <div className="text-[11px]">
                            L2 {item.ngay_kham_bnn_lan_2 ? `(${item.ngay_kham_bnn_lan_2})` : ''}: <strong className="text-gray-700">{bnn2.sl_kham || 0}</strong> | Mắc: <strong className="text-red-600">{bnn2.sl_mac_bnn || 0}</strong>
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">SL Khám Thực Tế *</label>
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
                    {formGoiKhamSchema.map(gk => {
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
                              <span className="text-[9px] text-gray-500 w-8">Chung:</span>
                              <input
                                type="text"
                                value={gk.price ? formatCurrencySpace(gk.price) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-gray-300 rounded-md bg-white text-right font-mono text-lime-800"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8">Nam:</span>
                              <input
                                type="text"
                                value={gk.price_nam ? formatCurrencySpace(gk.price_nam) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nam: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-gray-300 rounded-md bg-white text-right font-mono text-lime-800"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8">Nữ ĐT:</span>
                              <input
                                type="text"
                                value={gk.price_nu_dt ? formatCurrencySpace(gk.price_nu_dt) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nu_dt: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-gray-300 rounded-md bg-white text-right font-mono text-lime-800"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-8">Nữ CGĐ:</span>
                              <input
                                type="text"
                                value={gk.price_nu_cgd ? formatCurrencySpace(gk.price_nu_cgd) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price_nu_cgd: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-gray-300 rounded-md bg-white text-right font-mono text-lime-800"
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
                    {formGoiKhamBnnSchema.map(gk => {
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
                              <span className="text-[9px] text-gray-500 w-8">Chung:</span>
                              <input
                                type="text"
                                value={gk.price ? formatCurrencySpace(gk.price) : ''}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(/\D/g, ''));
                                  setFormGoiKhamBnnSchema(prev => prev.map(p => p.code === gk.code ? { ...p, price: val } : p));
                                }}
                                placeholder="VNĐ"
                                className="w-full p-1 text-[10px] border border-emerald-300 rounded-md bg-white text-right font-mono text-emerald-800"
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
                  disabled={savingCampaign}
                  className="px-5 py-2 bg-lime-600 text-white rounded-xl text-xs font-bold hover:bg-lime-700 transition-all shadow-sm flex items-center gap-1.5"
                >
                  {savingCampaign ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  {editingCampaign.id ? 'Cập Nhật Đợt Khám' : 'Lưu Đợt Khám Mới'}
                </button>
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
