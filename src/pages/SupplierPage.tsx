import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save,
  Building2, Phone, Mail, Calendar, Eye, Handshake, Filter, Info, CheckCircle2,
  ExternalLink, PanelLeftOpen, FileText, Star, ShieldCheck, MapPin, User, Notebook,
  RotateCcw, Sparkles, ChevronDown, PlusCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { NhaCungCap, DonVi } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import { stripAccents, formatPhoneNumber } from '../utils/formatters';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import { getExpiryStatus } from '../utils/expiryStatus';
import {
  buildHierarchicalOptions,
  getUnitEmoji,
  getAllSubordinateIds,
  getDefaultUnitId
} from '../utils/hierarchy';

const getEffectiveExpiryDate = (
  ngay_het_han_hd: string | null | undefined,
  gia_han_tu_dong: number | null | undefined
): string | null => {
  if (!ngay_het_han_hd) return null;
  if (!gia_han_tu_dong || gia_han_tu_dong <= 0) return ngay_het_han_hd;

  const date = new Date(ngay_het_han_hd);
  date.setMonth(date.getMonth() + gia_han_tu_dong);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const NHOM_DICH_VU_NCC = [
  "Đồng phục", "Nước uống", "Xử lý chất thải & Vệ sinh", "Môi trường, cảnh quan",
  "An ninh - Bảo vệ", "Xăng dầu", "Văn phòng phẩm & Ấn vật phẩm", "Tạp phẩm",
  "Trang trí VP, quầy lễ tân", "Tiếp khách (Phòng chờ KH)", "Công cụ dụng cụ",
  "Sửa chữa, bảo trì", "Thiết bị CNTT & Văn phòng", "Viễn thông",
  "Đào tạo, Chứng nhận & Kiểm định", "Bảo hiểm", "Sức khỏe", "Khác"
];

const TRANG_THAI_LIST = ["Đang hợp tác", "Ngừng hợp tác"];

const getNhomDichVuColor = (nhom: string) => {
  switch (nhom) {
    case "Nước uống": return "bg-blue-50 text-blue-700 border-blue-200";
    case "Xử lý chất thải & Vệ sinh": return "bg-red-50 text-red-700 border-red-200";
    case "Môi trường, cảnh quan": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "An ninh - Bảo vệ": return "bg-stone-150 text-stone-800 border-stone-300";
    case "Xăng dầu": return "bg-amber-50 text-amber-800 border-amber-200";
    case "Văn phòng phẩm & Ấn vật phẩm": return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Tạp phẩm": return "bg-neutral-150 text-neutral-800 border-neutral-300";
    case "Trang trí VP, quầy lễ tân": return "bg-pink-50 text-pink-700 border-pink-200";
    case "Tiếp khách (Phòng chờ KH)": return "bg-purple-50 text-purple-700 border-purple-200";
    case "Công cụ dụng cụ": return "bg-orange-50 text-orange-700 border-orange-200";
    case "Sửa chữa, bảo trì": return "bg-yellow-50 text-yellow-850 border-yellow-250";
    case "Thiết bị CNTT & Văn phòng": return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "Viễn thông": return "bg-sky-50 text-sky-700 border-sky-200";
    case "Kiểm định & Chứng nhận": return "bg-teal-50 text-teal-700 border-teal-200";
    case "Bảo hiểm": return "bg-rose-50 text-rose-700 border-rose-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

const SupplierMobileCard = React.memo(({ item, props }: { item: NhaCungCap; props: any }) => {
  const effectiveExpiry = getEffectiveExpiryDate(item.ngay_het_han_hd, item.gia_han_tu_dong);
  const expStatus = effectiveExpiry ? getExpiryStatus(effectiveExpiry) : null;
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 relative">
      {/* Expiry and status badges */}
      <div className="flex justify-between items-start gap-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${props.getNhomDichVuColor(item.nhom_dich_vu)}`}>
          {item.nhom_dich_vu}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border ${item.trang_thai === 'Ngừng hợp tác'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
            }`}>
            {item.trang_thai || 'Đang hợp tác'}
          </span>
          {expStatus && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${expStatus.colorClass}`}>
              {expStatus.label}
            </span>
          )}
        </div>
      </div>

      {/* Supplier Name */}
      <div>
        <h4 className="font-bold text-gray-800 text-sm leading-snug">{item.ten_cong_ty}</h4>
        {item.ten_goi_tat && (
          <p className="text-xs font-semibold text-indigo-600 mt-0.5">Tên gọi tắt: {item.ten_goi_tat}</p>
        )}
        {item.mst && (
          <p className="text-[11px] text-gray-500 mt-0.5 font-mono">MST: {item.mst}</p>
        )}
      </div>

      {/* Main Contact */}
      <div className="pt-2 border-t border-dashed border-gray-100 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold">
            <User size={13} className="text-gray-400" />
            <span>{item.dau_moi}</span>
            {item.chuc_vu_dau_moi && (
              <span className="text-[9px] text-indigo-500 font-bold">({item.chuc_vu_dau_moi})</span>
            )}
          </div>
          {item.dau_moi_json && item.dau_moi_json.length > 0 && (
            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              +{item.dau_moi_json.length} đầu mối phụ
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Phone size={12} className="text-gray-400" />
          <a
            href={`tel:${String(item.sdt_dau_moi).replace(/\D/g, '')}`}
            className="font-bold text-[#05469B] hover:underline"
          >
            {formatPhoneNumber(item.sdt_dau_moi)}
          </a>
        </div>
      </div>

      {/* Expiry Details */}
      {item.ngay_het_han_hd && (
        <div className="pt-2 border-t border-dashed border-gray-100 text-[11px] text-gray-550 bg-gray-50/50 p-2 rounded flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Thời hạn HĐ gốc:</span>
            <span className="font-medium text-gray-800">{new Date(item.ngay_het_han_hd).toLocaleDateString('vi-VN')}</span>
          </div>
          {item.gia_han_tu_dong && item.gia_han_tu_dong > 0 ? (
            <>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Tự động gia hạn:</span>
                <span>+{item.gia_han_tu_dong >= 12 ? `${item.gia_han_tu_dong / 12} năm` : `${item.gia_han_tu_dong} tháng`}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-gray-200 pt-1 mt-1 font-bold text-gray-700">
                <span>Thời hạn thực tế:</span>
                <span className="text-[#05469B]">{new Date(effectiveExpiry!).toLocaleDateString('vi-VN')}</span>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
        <button
          onClick={() => props.handleView(item)}
          className="p-1.5 text-gray-500 hover:text-[#05469B] rounded hover:bg-gray-100 transition-colors"
          title="Xem chi tiết"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => props.openModal('update', item)}
          className="p-1.5 text-gray-500 hover:text-amber-600 rounded hover:bg-gray-100 transition-colors"
          title="Sửa thông tin"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={() => props.handleDeleteClick(item.id)}
          className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100 transition-colors"
          title="Xóa đối tác"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
});

const renderServiceList = (dichVuText: string | null | undefined, isTooltip: boolean = false) => {
  if (!dichVuText) return null;
  const lines = dichVuText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[-*•]\s*/, ''));

  if (lines.length === 0) return null;

  if (lines.length <= 1) {
    const subParts = dichVuText.split(/[;]/).map(p => p.trim()).filter(p => p.length > 0);
    if (subParts.length > 1) {
      return (
        <ul className={`list-disc pl-4 text-left space-y-0.5 ${isTooltip ? 'text-slate-200' : 'text-gray-600'}`}>
          {subParts.map((part, i) => (
            <li key={i}>{part}</li>
          ))}
        </ul>
      );
    }
    return <p className="text-left">{dichVuText}</p>;
  }

  return (
    <ul className={`list-disc pl-4 text-left space-y-0.5 ${isTooltip ? 'text-slate-200' : 'text-gray-600'}`}>
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
};

export default function SupplierPage() {
  const { user, canCreate, canUpdate, canDelete } = useAuth();
  const [nccData, setNccData] = useState<NhaCungCap[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNhomDichVu, setSelectedNhomDichVu] = useState<string>('');
  const [selectedTrangThai, setSelectedTrangThai] = useState<string>('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [formData, setFormData] = useState<Partial<NhaCungCap>>({});

  // View Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<NhaCungCap | null>(null);

  // Delete Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);

  const allowedDonViIds = useAllowedUnits(donViList);
  const hasInitializedRef = useRef(false);

  const donViLookupMap = useMemo(() => {
    const map = new Map<string, DonVi>();
    donViList.forEach(dv => map.set(String(dv.id), dv));
    return map;
  }, [donViList]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [nccResult, dvResult] = await Promise.all([
        apiService.getNhaCungCap(forceRefresh).catch(() => [] as NhaCungCap[]),
        apiService.getDonVi(forceRefresh).catch(() => [] as DonVi[])
      ]);
      setNccData(nccResult || []);
      setDonViList(dvResult || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu Nhà cung cấp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (viewData) {
      apiService.writeLog(
        'XEM NHÀ CUNG CẤP',
        `Tên công ty: ${viewData.ten_cong_ty || ''} | Tên gọi tắt: ${viewData.ten_goi_tat || ''}`
      );
    }
  }, [viewData]);

  // Initialize default unit filter
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

  const currentSubordinateIds = useMemo(() => {
    if (!selectedUnitFilter) return allowedDonViIds;
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    return Array.from(new Set([selectedUnitFilter, ...subIds])).map(String);
  }, [selectedUnitFilter, donViList, allowedDonViIds]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Tất cả đơn vị';
    const dv = donViLookupMap.get(String(selectedUnitFilter));
    return dv ? dv.ten_don_vi : selectedUnitFilter;
  }, [selectedUnitFilter, donViLookupMap]);

  const filteredSuppliers = useMemo(() => {
    let result = nccData;

    // Filter by unit hierarchy
    if (selectedUnitFilter) {
      result = result.filter(item => {
        const itemUnitId = String(item.id_don_vi || '').trim();
        return currentSubordinateIds.includes(itemUnitId);
      });
    }

    // Filter by nhom_dich_vu
    if (selectedNhomDichVu) {
      result = result.filter(item => item.nhom_dich_vu === selectedNhomDichVu);
    }

    // Filter by trang_thai
    if (selectedTrangThai) {
      result = result.filter(item => item.trang_thai === selectedTrangThai);
    }

    // Filter by search query
    if (searchTerm) {
      const cleanSearch = stripAccents(searchTerm);
      result = result.filter(item =>
        stripAccents(item.ten_cong_ty || '').includes(cleanSearch) ||
        stripAccents(item.ten_goi_tat || '').includes(cleanSearch) ||
        stripAccents(item.mst || '').includes(cleanSearch) ||
        stripAccents(item.dau_moi || '').includes(cleanSearch)
      );
    }

    return result;
  }, [nccData, selectedUnitFilter, currentSubordinateIds, selectedNhomDichVu, selectedTrangThai, searchTerm]);

  const openModal = (mode: 'create' | 'update', item?: NhaCungCap) => {
    if (mode === 'create') {
      if (!canCreate('NhaCungCap', selectedUnitFilter)) {
        toast.warning("Bạn không có quyền thêm mới nhà cung cấp!");
        return;
      }
    } else if (mode === 'update' && item) {
      if (!canUpdate('NhaCungCap', item.id_don_vi)) {
        toast.warning("Bạn không có quyền chỉnh sửa nhà cung cấp này!");
        return;
      }
    }
    setModalMode(mode);
    if (item) {
      setFormData({
        ...item,
        ngay_bat_dau_hd: item.ngay_bat_dau_hd ? item.ngay_bat_dau_hd.split('T')[0] : '',
        ngay_het_han_hd: item.ngay_het_han_hd ? item.ngay_het_han_hd.split('T')[0] : '',
        dau_moi_json: item.dau_moi_json || [],
        gia_han_tu_dong: item.gia_han_tu_dong !== undefined ? Number(item.gia_han_tu_dong) : 0
      });
    } else {
      setFormData({
        id: '',
        ten_cong_ty: '',
        ten_goi_tat: '',
        mst: '',
        dai_dien_phap_luat: '',
        chuc_vu_ddpl: '',
        sdt_ddpl: '',
        dau_moi: '',
        chuc_vu_dau_moi: '',
        sdt_dau_moi: '',
        email_dau_moi: '',
        dia_chi: '',
        nhom_dich_vu: '',
        dich_vu: '',
        id_don_vi: selectedUnitFilter || '',
        ngay_bat_dau_hd: '',
        ngay_het_han_hd: '',
        danh_gia: '',
        trang_thai: 'Đang hợp tác',
        hinh_thuc_tt: '',
        link_ho_so: '',
        ghi_chu: '',
        dau_moi_json: [],
        gia_han_tu_dong: 0
      });
    }
    setIsModalOpen(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ten_cong_ty?.trim()) return toast.warning("Vui lòng nhập Tên công ty!");
    if (!formData.nhom_dich_vu) return toast.warning("Vui lòng chọn Nhóm dịch vụ!");
    if (!formData.dau_moi?.trim()) return toast.warning("Vui lòng nhập Họ tên đầu mối liên hệ!");
    if (!formData.sdt_dau_moi?.trim()) return toast.warning("Vui lòng nhập Số điện thoại đầu mối!");

    // Sanitize secondary contacts
    const rawSecondary = formData.dau_moi_json || [];
    const sanitizedSecondary = rawSecondary.filter(c => c.ho_ten?.trim() || c.sdt?.trim() || c.email?.trim() || c.vai_tro?.trim());

    // Validate secondary contacts
    for (let i = 0; i < sanitizedSecondary.length; i++) {
      const c = sanitizedSecondary[i];
      if (!c.ho_ten?.trim()) {
        return toast.warning(`Vui lòng nhập Họ tên đầu mối phụ #${i + 1}`);
      }
      if (!c.sdt?.trim()) {
        return toast.warning(`Vui lòng nhập Số điện thoại đầu mối phụ #${i + 1}`);
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const dataToSave = {
        ...formData,
        id_don_vi: formData.id_don_vi || null as any,
        dau_moi_json: sanitizedSecondary
      };

      const response = await apiService.save(dataToSave, modalMode, "dm_ncc");

      // Refresh list to sync from local store / cache correctly
      await loadData(true);

      setIsModalOpen(false);
      if (modalMode === 'create') {
        toast.success("Thêm mới nhà cung cấp thành công!");
      } else {
        toast.success("Cập nhật nhà cung cấp thành công!");
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu dữ liệu.');
      toast.error(err.message || "Đã xảy ra lỗi khi lưu!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSecondaryContact = () => {
    const current = formData.dau_moi_json || [];
    setFormData(prev => ({
      ...prev,
      dau_moi_json: [...current, { ho_ten: '', sdt: '', email: '', vai_tro: '' }]
    }));
  };

  const handleRemoveSecondaryContact = (index: number) => {
    const current = formData.dau_moi_json || [];
    setFormData(prev => ({
      ...prev,
      dau_moi_json: current.filter((_, idx) => idx !== index)
    }));
  };

  const handleSecondaryContactChange = (index: number, field: 'ho_ten' | 'sdt' | 'email' | 'vai_tro', value: string) => {
    const current = formData.dau_moi_json || [];
    const updated = current.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          [field]: field === 'sdt' ? formatPhoneNumber(value) : value
        };
      }
      return item;
    });
    setFormData(prev => ({
      ...prev,
      dau_moi_json: updated
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue: any = value;
    if (name === 'ten_cong_ty' || name === 'ten_goi_tat') {
      finalValue = value.toUpperCase();
    } else if (name.includes('sdt') || name.includes('phone')) {
      finalValue = formatPhoneNumber(value);
    } else if (name === 'gia_han_tu_dong') {
      const parsed = parseInt(value, 10);
      finalValue = isNaN(parsed) ? 0 : parsed;
    }
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const target = nccData.find(n => n.id === itemToDelete);
    if (!canDelete('NhaCungCap', target?.id_don_vi)) {
      toast.error("Bạn không có quyền xóa nhà cung cấp này!");
      setIsConfirmOpen(false);
      setItemToDelete(null);
      return;
    }
    setSubmitting(true);
    try {
      await apiService.delete(itemToDelete, "dm_ncc");
      setNccData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsConfirmOpen(false);
      setItemToDelete(null);
      toast.success("Xóa nhà cung cấp thành công!");
    } catch (err: any) {
      setError(err.message || 'Lỗi xóa dữ liệu.');
      toast.error(err.message || "Đã xảy ra lỗi khi xóa!");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && nccData.length === 0) return <PageWithFilterSkeleton rows={8} />;

  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {isListCollapsed && (
        <button
          onClick={() => setIsListCollapsed(false)}
          className="hidden md:block absolute top-6 left-6 z-50 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all"
          title="Mở bộ lọc đơn vị"
        >
          <PanelLeftOpen size={20} />
        </button>
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
        allUnitsLabel="Tất cả Nhà cung cấp"
      />

      <div className="flex-1 min-w-0 max-w-full overflow-hidden p-4 sm:p-6 relative transition-all duration-300 w-full flex flex-col">
        {/* FIXED HEADER */}
        <div className="shrink-0 flex flex-col relative z-30">
          <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            <div className="flex items-center gap-2.5">
              {isListCollapsed && (
                <button
                  onClick={() => setIsListCollapsed(false)}
                  className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-[#05469B] hover:bg-blue-50 transition-all flex items-center justify-center shrink-0"
                  title="Mở bộ lọc đơn vị"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2">
                  <Handshake size={28} /> Quản lý Đối tác & Nhà cung cấp
                </h2>
                <p className="text-sm font-medium text-gray-500 mt-1">
                  Đơn vị: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredSuppliers.length} nhà cung cấp)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap w-full xl:w-auto gap-3 items-center">
              {/* Dropdown Nhóm dịch vụ */}
              <select
                value={selectedNhomDichVu}
                onChange={(e) => setSelectedNhomDichVu(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#05469B] shadow-sm"
              >
                <option value="">Tất cả Nhóm dịch vụ</option>
                {NHOM_DICH_VU_NCC.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Dropdown Trạng thái */}
              <select
                value={selectedTrangThai}
                onChange={(e) => setSelectedTrangThai(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#05469B] shadow-sm"
              >
                <option value="">Tất cả Trạng thái</option>
                {TRANG_THAI_LIST.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Ô tìm kiếm 256 x 32 px */}
              <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Tìm công ty, mã số thuế, đầu mối..."
                  className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Nút Đồng bộ dữ liệu (24 x 24 px) */}
              <button
                onClick={() => {
                  loadData(true);
                  toast.success('Đang đồng bộ dữ liệu Nhà cung cấp mới nhất từ Supabase...');
                }}
                title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                disabled={loading}
                className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white hover:bg-gray-50 text-gray-700 hover:text-[#05469B] rounded-md border border-gray-200 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <RotateCcw size={13} className={loading ? 'animate-spin text-[#05469B]' : ''} />
              </button>

              {/* Nút Tính năng (119 x 32 px) - Màu xanh dương đặc trưng */}
              <div className="relative z-50">
                <button
                  onClick={() => setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen)}
                  className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${
                    isFeaturesDropdownOpen
                      ? 'bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white border-[#05469B] shadow-sm'
                      : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:text-[#05469B]'
                  }`}
                >
                  <Sparkles size={14} className={isFeaturesDropdownOpen ? 'text-amber-300 animate-pulse' : 'text-[#05469B]'} />
                  <span>Tính năng</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFeaturesDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 z-[100] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                      {canCreate('NhaCungCap', selectedUnitFilter) && (
                        <button
                          onClick={() => {
                            setIsFeaturesDropdownOpen(false);
                            openModal('create');
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-blue-50 text-gray-700 hover:text-[#05469B] cursor-pointer"
                        >
                          <div className="p-1.5 rounded-md bg-blue-100 text-[#05469B]">
                            <PlusCircle size={15} />
                          </div>
                          <div>
                            <div className="text-gray-800 font-bold text-xs">Thêm Đối tác</div>
                            <div className="text-[10px] text-gray-500 font-normal">Tạo hồ sơ nhà cung cấp mới</div>
                          </div>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm shrink-0">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* TABLE CONTAINER */}
        <div className={`flex flex-col flex-1 min-h-0 bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>

          {/* Desktop Table View */}
          <div className="hidden md:block w-full flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 bg-[#f8fafc] z-10">
                <tr className="bg-[#f8fafc] border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="p-4 w-72">Nhà cung cấp / Đối tác</th>
                  <th className="p-4 w-52">Nhóm Dịch vụ</th>
                  <th className="p-4 w-60">Liên hệ đầu mối</th>
                  <th className="p-4 w-44 text-center">Thời hạn HĐ</th>
                  <th className="p-4 w-40 text-center">Trạng thái</th>
                  <th className="p-4 text-center w-36">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-gray-500">
                      <Handshake size={48} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium">Không tìm thấy đối tác, nhà cung cấp nào.</p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((item) => {
                    const effectiveExpiry = getEffectiveExpiryDate(item.ngay_het_han_hd, item.gia_han_tu_dong);
                    const expStatus = effectiveExpiry ? getExpiryStatus(effectiveExpiry) : null;
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group text-sm">
                        <td className="p-4">
                          <div className="font-bold text-gray-800 text-[14px] leading-tight mb-1">{item.ten_cong_ty}</div>
                          <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                            {item.ten_goi_tat && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">{item.ten_goi_tat}</span>
                            )}
                            {item.mst && (
                              <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">MST: {item.mst}</span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 relative group/service">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-black border inline-block cursor-help ${getNhomDichVuColor(item.nhom_dich_vu)}`}>
                            {item.nhom_dich_vu}
                          </span>
                          {item.dich_vu && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">{item.dich_vu}</p>
                          )}

                          {/* Tooltip hiển thị dịch vụ chi tiết */}
                          {item.dich_vu && (
                            <div className="absolute left-4 top-full mt-2 hidden group-hover/service:block bg-slate-900 text-white p-3 rounded-lg text-xs z-50 shadow-xl whitespace-normal w-64 pointer-events-none transition-all animate-in fade-in slide-in-from-top-2 duration-150 border border-slate-800">
                              <div className="font-bold text-[9px] text-slate-400 uppercase mb-1 tracking-wider">Chi tiết dịch vụ</div>
                              {renderServiceList(item.dich_vu, true)}
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="font-semibold text-gray-700 flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <User size={13} className="text-gray-400 shrink-0" />
                              {item.dau_moi}
                            </span>
                            {item.dau_moi_json && item.dau_moi_json.length > 0 && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                +{item.dau_moi_json.length} đầu mối
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                            <p className="flex items-center gap-1.5">
                              <Phone size={12} className="text-gray-400 shrink-0" />
                              <a
                                href={`tel:${String(item.sdt_dau_moi).replace(/\D/g, '')}`}
                                className="font-bold text-[#05469B] hover:underline"
                              >
                                {formatPhoneNumber(item.sdt_dau_moi)}
                              </a>
                            </p>
                            {item.email_dau_moi && (
                              <p className="flex items-center gap-1.5">
                                <Mail size={12} className="text-gray-400 shrink-0" />
                                {item.email_dau_moi}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          {item.ngay_het_han_hd ? (
                            <div className="space-y-1">
                              <p className="font-semiblod text-gray-700">{new Date(item.ngay_het_han_hd).toLocaleDateString('vi-VN')}</p>
                              {item.gia_han_tu_dong && item.gia_han_tu_dong > 0 ? (
                                <div className="space-y-0.5">
                                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 block w-max mx-auto uppercase">
                                    TĐGH +{item.gia_han_tu_dong >= 12 ? `${item.gia_han_tu_dong / 12} năm` : `${item.gia_han_tu_dong} tháng`}
                                  </span>
                                  <p className="text-[10px] text-gray-400 font-medium">
                                    ➜ Hạn mới: {new Date(effectiveExpiry!).toLocaleDateString('vi-VN')}
                                  </p>
                                </div>
                              ) : null}
                              {expStatus && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${expStatus.colorClass}`}>
                                  {expStatus.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium italic">Không xác định</span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase border inline-flex items-center justify-center gap-1 w-32 h-6 ${item.trang_thai === 'Ngừng hợp tác'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-green-50 text-green-600 border-green-200'
                            }`}>
                            <CheckCircle2 size={11} className="shrink-0" />
                            <span className="truncate">{item.trang_thai || 'Đang hợp tác'}</span>
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-full max-w-[90px] mx-auto">
                            <button
                              onClick={() => { setViewData(item); setIsViewModalOpen(true); }}
                              className="w-full py-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm"
                            >
                              <Eye size={13} /> Xem
                            </button>

                            {canUpdate('NhaCungCap', item.id_don_vi) && (
                              <button
                                onClick={() => openModal('update', item)}
                                className="w-full py-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-colors"
                              >
                                <Edit size={13} /> Sửa
                              </button>
                            )}

                            {canDelete('NhaCungCap', item.id_don_vi) && (
                              <button
                                onClick={() => { setItemToDelete(item.id); setIsConfirmOpen(true); }}
                                className="w-full py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-colors"
                              >
                                <Trash2 size={13} /> Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden flex-1 min-h-0 overflow-y-auto pb-4 space-y-4 custom-scrollbar">
            {filteredSuppliers.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 italic">
                Không tìm thấy đối tác, nhà cung cấp nào.
              </div>
            ) : (
              filteredSuppliers.map((item) => (
                <SupplierMobileCard
                  key={item.id}
                  item={item}
                  props={{
                    getNhomDichVuColor,
                    handleView: (val) => { setViewData(val); setIsViewModalOpen(true); },
                    openModal,
                    handleDeleteClick: (val) => { setItemToDelete(val); setIsConfirmOpen(true); }
                  }}
                />
              ))
            )}
          </div>

        </div>
      </div>

      {/* VIEW MODAL */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-3xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 overflow-hidden mt-auto sm:mt-0">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-3xl sm:rounded-t-2xl">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Handshake size={24} /> Chi tiết Nhà cung cấp
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-blue-200 hover:text-white rounded-full p-1 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`px-3 py-1 rounded text-xs font-black border uppercase ${getNhomDichVuColor(viewData.nhom_dich_vu)}`}>
                    {viewData.nhom_dich_vu}
                  </span>
                  <span className={`font-bold px-2.5 py-1 rounded text-xs uppercase border flex items-center gap-1 ${viewData.trang_thai === 'Ngừng hợp tác'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-green-100 text-green-700 border-green-200'
                    }`}>
                    <CheckCircle2 size={12} /> {viewData.trang_thai || 'Đang hợp tác'}
                  </span>
                  {viewData.mst && (
                    <span className="bg-gray-100 text-gray-700 font-medium px-2 py-1 rounded text-xs border border-gray-200">
                      MST: {viewData.mst}
                    </span>
                  )}
                  {viewData.ngay_het_han_hd && (() => {
                    const effectiveExpiry = getEffectiveExpiryDate(viewData.ngay_het_han_hd, viewData.gia_han_tu_dong);
                    const viewExpStatus = effectiveExpiry ? getExpiryStatus(effectiveExpiry) : null;
                    return viewExpStatus ? (
                      <span className={`font-bold px-2 py-1 rounded text-xs border flex items-center gap-1 ${viewExpStatus.colorClass}`}>
                        <Calendar size={12} className="shrink-0" /> {viewExpStatus.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                <h2 className="text-2xl font-black text-gray-800 leading-tight mt-3">{viewData.ten_cong_ty}</h2>
                {viewData.ten_goi_tat && (
                  <p className="text-sm font-bold text-indigo-600 mt-1">Tên gọi tắt: {viewData.ten_goi_tat}</p>
                )}
              </div>

              {/* 2-Column Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-100 shadow-inner text-sm text-gray-700">
                {/* DOANH NGHIỆP */}
                <div className="space-y-3">
                  <h4 className="font-black text-gray-800 border-b pb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Building2 size={14} className="text-[#05469B]" /> Doanh nghiệp & Pháp lý
                  </h4>
                  {viewData.dia_chi && (
                    <p className="flex items-start gap-2">
                      <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                      <span><strong>Địa chỉ:</strong> {viewData.dia_chi}</span>
                    </p>
                  )}
                  {viewData.dai_dien_phap_luat && (
                    <p>
                      <strong>Người ĐDPL:</strong> {viewData.dai_dien_phap_luat}
                      {viewData.chuc_vu_ddpl && <span className="text-xs text-gray-500 font-medium"> ({viewData.chuc_vu_ddpl})</span>}
                    </p>
                  )}
                  {viewData.sdt_ddpl && (
                    <p>
                      <strong>SĐT người ĐDPL:</strong>{' '}
                      <a
                        href={`tel:${String(viewData.sdt_ddpl).replace(/\D/g, '')}`}
                        className="font-bold text-[#05469B] hover:underline"
                      >
                        {formatPhoneNumber(viewData.sdt_ddpl)}
                      </a>
                    </p>
                  )}
                  {viewData.id_don_vi && (
                    <p>
                      <strong>Đơn vị áp dụng:</strong> {donViLookupMap.get(viewData.id_don_vi || '')?.ten_don_vi || viewData.id_don_vi}
                    </p>
                  )}
                </div>

                {/* HỢP ĐỒNG & THANH TOÁN */}
                <div className="space-y-3">
                  <h4 className="font-black text-gray-800 border-b pb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <FileText size={14} className="text-[#05469B]" /> Hợp đồng & Thanh toán
                  </h4>
                  <p>
                    <strong>Thời gian hợp đồng gốc:</strong>{' '}
                    {viewData.ngay_bat_dau_hd ? new Date(viewData.ngay_bat_dau_hd).toLocaleDateString('vi-VN') : 'N/A'}{' '}
                    ➜ {viewData.ngay_het_han_hd ? new Date(viewData.ngay_het_han_hd).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                  {viewData.gia_han_tu_dong && viewData.gia_han_tu_dong > 0 ? (
                    <>
                      <p className="flex items-center gap-1.5">
                        <strong>Tự động gia hạn:</strong>{' '}
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-55 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                          +{viewData.gia_han_tu_dong >= 12 ? `${viewData.gia_han_tu_dong / 12} năm` : `${viewData.gia_han_tu_dong} tháng`}
                        </span>
                      </p>
                      <p className="font-bold text-[#05469B]">
                        <strong>Thời hạn thực tế:</strong>{' '}
                        {new Date(getEffectiveExpiryDate(viewData.ngay_het_han_hd, viewData.gia_han_tu_dong)!).toLocaleDateString('vi-VN')}
                      </p>
                    </>
                  ) : null}
                  {viewData.hinh_thuc_tt && (
                    <p><strong>Hình thức TT:</strong> {viewData.hinh_thuc_tt}</p>
                  )}
                  {viewData.dich_vu && (
                    <div className="space-y-1">
                      <p className="font-bold text-gray-700">Chi tiết dịch vụ:</p>
                      {renderServiceList(viewData.dich_vu)}
                    </div>
                  )}
                </div>

                {/* LIÊN HỆ ĐẦU MỐI */}
                <div className="space-y-3 md:col-span-2">
                  <h4 className="font-black text-gray-800 border-b pb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <User size={14} className="text-[#05469B]" /> Danh sách Nhân sự liên hệ
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <p className="font-bold text-gray-800 text-[13px] leading-tight flex items-center gap-1.5 flex-wrap">
                        {viewData.dau_moi}
                        {viewData.chuc_vu_dau_moi && (
                          <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-black">
                            {viewData.chuc_vu_dau_moi}
                          </span>
                        )}
                        <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-black">Chính</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                        <Phone size={12} className="text-gray-400" />{' '}
                        <a
                          href={`tel:${String(viewData.sdt_dau_moi).replace(/\D/g, '')}`}
                          className="font-bold text-[#05469B] hover:underline"
                        >
                          {formatPhoneNumber(viewData.sdt_dau_moi)}
                        </a>
                      </p>
                      {viewData.email_dau_moi && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 font-medium"><Mail size={12} className="text-gray-400" /> {viewData.email_dau_moi}</p>
                      )}
                    </div>
                    {viewData.dau_moi_json && viewData.dau_moi_json.map((c, index) => (
                      <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <p className="font-bold text-gray-800 text-[13px] leading-tight flex items-center gap-1.5 flex-wrap">
                          {c.ho_ten}
                          {c.vai_tro && (
                            <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-black">
                              {c.vai_tro}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                          <Phone size={12} className="text-gray-400" />{' '}
                          <a
                            href={`tel:${String(c.sdt).replace(/\D/g, '')}`}
                            className="font-bold text-[#05469B] hover:underline"
                          >
                            {formatPhoneNumber(c.sdt)}
                          </a>
                        </p>
                        {c.email && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 font-medium"><Mail size={12} className="text-gray-400" /> {c.email}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ĐÁNH GIÁ & GHI CHÚ */}
                <div className="space-y-3">
                  <h4 className="font-black text-gray-800 border-b pb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Notebook size={14} className="text-[#05469B]" /> Đánh giá & Ghi chú
                  </h4>
                  {viewData.danh_gia && (
                    <p className="flex items-start gap-2">
                      <Star size={15} className="text-amber-500 shrink-0 mt-0.5 fill-amber-500" />
                      <span><strong>Đánh giá:</strong> {viewData.danh_gia}</span>
                    </p>
                  )}
                  {viewData.ghi_chu && (
                    <p><strong>Ghi chú:</strong> {viewData.ghi_chu}</p>
                  )}
                </div>
              </div>

              {/* Action Links */}
              <div className="flex flex-col gap-3">
                {viewData.link_ho_so ? (
                  <a
                    href={viewData.link_ho_so}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-[#05469B] hover:bg-[#04367a] text-white rounded-xl font-bold transition-colors shadow-md text-sm"
                  >
                    <ExternalLink size={18} /> Mở Hồ sơ Năng lực / Hợp đồng Trực tuyến
                  </a>
                ) : (
                  <button disabled className="flex items-center justify-center gap-2 py-3 bg-gray-150 text-gray-400 rounded-xl font-semibold cursor-not-allowed text-sm">
                    Không có Link hồ sơ đính kèm
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2">
                <Handshake size={24} /> {modalMode === 'create' ? 'Thêm mới Nhà cung cấp / Đối tác' : 'Cập nhật Thông tin Đối tác'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-white">

                {/* 1. THÔNG TIN DOANH NGHIỆP */}
                <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2">
                    <div className="w-2 h-6 bg-[#05469B] rounded-full"></div> 1. THÔNG TIN DOANH NGHIỆP
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Dòng 1 */}
                    <div className="md:col-span-4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tên công ty *</label>
                      <input
                        type="text"
                        required
                        name="ten_cong_ty"
                        value={formData.ten_cong_ty || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-800"
                        placeholder="Nhập tên đầy đủ của doanh nghiệp (Tự động viết hoa)..."
                      />
                    </div>
                    {/* Dòng 2 */}
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tên gọi tắt</label>
                      <input
                        type="text"
                        name="ten_goi_tat"
                        value={formData.ten_goi_tat || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Ví dụ: THACO, VNPT..."
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mã số thuế</label>
                      <input
                        type="text"
                        name="mst"
                        value={formData.mst || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Mã số thuế doanh nghiệp..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ doanh nghiệp</label>
                      <input
                        type="text"
                        name="dia_chi"
                        value={formData.dia_chi || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Địa chỉ trụ sở / văn phòng chính..."
                      />
                    </div>
                    {/* Dòng 3 */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Họ tên người đại diện pháp luật</label>
                      <input
                        type="text"
                        name="dai_dien_phap_luat"
                        value={formData.dai_dien_phap_luat || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Họ tên người đại diện pháp luật..."
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Chức vụ người ĐDPL</label>
                      <input
                        type="text"
                        name="chuc_vu_ddpl"
                        value={formData.chuc_vu_ddpl || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Ví dụ: Giám đốc, Tổng Giám đốc..."
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">SĐT người ĐDPL</label>
                      <input
                        type="text"
                        name="sdt_ddpl"
                        value={formData.sdt_ddpl || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Số điện thoại người đại diện..."
                      />
                    </div>
                  </div>
                </div>

                {/* 2. DỊCH VỤ & HỢP TÁC */}
                <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
                    <div className="w-2 h-6 bg-emerald-600 rounded-full"></div> 2. DỊCH VỤ & HỢP TÁC
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nhóm dịch vụ *</label>
                      <select
                        required
                        name="nhom_dich_vu"
                        value={formData.nhom_dich_vu || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-700"
                      >
                        <option value="">-- Chọn nhóm dịch vụ --</option>
                        {NHOM_DICH_VU_NCC.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Dịch vụ chi tiết (Mỗi dòng là một dịch vụ)</label>
                      <textarea
                        name="dich_vu"
                        rows={3}
                        value={formData.dich_vu || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-sm custom-scrollbar"
                        placeholder="Ví dụ:&#10;- Dịch vụ giao nước bình 19L&#10;- Cung cấp vỏ bình&#10;- Hỗ trợ đổi trả vỏ miễn phí..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị áp dụng</label>
                      <select
                        name="id_don_vi"
                        value={formData.id_don_vi || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-medium text-gray-700"
                      >
                        <option value="">-- Quản trị toàn quốc (HO) --</option>
                        {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id}>
                            {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái hợp tác</label>
                      <select
                        name="trang_thai"
                        value={formData.trang_thai || 'Đang hợp tác'}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-700"
                      >
                        {TRANG_THAI_LIST.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hình thức thanh toán</label>
                      <input
                        type="text"
                        name="hinh_thuc_tt"
                        value={formData.hinh_thuc_tt || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Ví dụ: Chuyển khoản chậm 30 ngày, Thanh toán 100% khi bàn giao..."
                      />
                    </div>
                  </div>
                </div>

                {/* 3. LIÊN HỆ ĐẦU MỐI */}
                <div className="bg-orange-50/30 p-5 rounded-xl border border-orange-100">
                  <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
                    <div className="w-2 h-6 bg-orange-500 rounded-full"></div> 3. THÔNG TIN LIÊN HỆ (ĐẦU MỐI CHÍNH)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Họ tên đầu mối liên hệ *</label>
                      <input
                        type="text"
                        required
                        name="dau_moi"
                        value={formData.dau_moi || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-semibold text-gray-800"
                        placeholder="Tên người đầu mối liên hệ chính..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Chức vụ đầu mối</label>
                      <input
                        type="text"
                        name="chuc_vu_dau_moi"
                        value={formData.chuc_vu_dau_moi || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Ví dụ: Trưởng phòng, Nhân viên..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại đầu mối *</label>
                      <input
                        type="text"
                        required
                        name="sdt_dau_moi"
                        value={formData.sdt_dau_moi || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-semibold text-gray-800"
                        placeholder="Số điện thoại di động..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Email đầu mối</label>
                      <input
                        type="email"
                        name="email_dau_moi"
                        value={formData.email_dau_moi || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Địa chỉ Email..."
                      />
                    </div>
                  </div>

                  {/* Danh sách đầu mối phụ */}
                  {formData.dau_moi_json && formData.dau_moi_json.map((c, index) => (
                    <div key={index} className="mt-4 p-4 bg-white/60 border border-dashed border-orange-200 rounded-lg relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveSecondaryContact(index)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-150 transition-colors"
                        title="Xóa đầu mối này"
                      >
                        <X size={16} />
                      </button>
                      <h5 className="text-xs font-bold text-orange-700 mb-3 flex items-center gap-1.5">
                        <User size={13} /> Đầu mối liên hệ phụ #{index + 1}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Họ tên *</label>
                          <input
                            type="text"
                            required
                            value={c.ho_ten}
                            onChange={(e) => handleSecondaryContactChange(index, 'ho_ten', e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-[#05469B] text-xs font-semibold text-gray-800"
                            placeholder="Nhập họ tên..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Số điện thoại *</label>
                          <input
                            type="text"
                            required
                            value={c.sdt}
                            onChange={(e) => handleSecondaryContactChange(index, 'sdt', e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-[#05469B] text-xs font-semibold text-gray-800"
                            placeholder="Nhập số điện thoại..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Email</label>
                          <input
                            type="email"
                            value={c.email || ''}
                            onChange={(e) => handleSecondaryContactChange(index, 'email', e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-[#05469B] text-xs text-gray-800"
                            placeholder="Nhập email..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Vai trò / Bộ phận</label>
                          <input
                            type="text"
                            value={c.vai_tro || ''}
                            onChange={(e) => handleSecondaryContactChange(index, 'vai_tro', e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-[#05469B] text-xs text-gray-800"
                            placeholder="Kế toán, Kỹ thuật..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Nút thêm đầu mối phụ */}
                  <button
                    type="button"
                    onClick={handleAddSecondaryContact}
                    className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-[#05469B] hover:text-[#04367a] border border-dashed border-[#05469B]/40 hover:border-[#05469B] px-4 py-2 rounded-lg bg-white transition-all shadow-sm"
                  >
                    <Plus size={14} /> Thêm đầu mối liên hệ phụ
                  </button>
                </div>

                {/* 4. HỢP ĐỒNG & ĐÁNH GIÁ */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-850 mb-4 flex items-center gap-2">
                    <div className="w-2 h-6 bg-gray-400 rounded-full"></div> 4. HỢP ĐỒNG & ĐÁNH GIÁ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ngày bắt đầu HĐ</label>
                      <input
                        type="date"
                        name="ngay_bat_dau_hd"
                        value={formData.ngay_bat_dau_hd || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ngày hết hạn HĐ gốc</label>
                      <input
                        type="date"
                        name="ngay_het_han_hd"
                        value={formData.ngay_het_han_hd || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semi"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tự động gia hạn (số tháng)</label>
                      <input
                        type="number"
                        name="gia_han_tu_dong"
                        value={formData.gia_han_tu_dong || ''}
                        onChange={handleInputChange}
                        min={0}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] font-semibold text-gray-800"
                        placeholder="Nhập số tháng (ví dụ: 12)..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đánh giá chung</label>
                      <input
                        type="text"
                        name="danh_gia"
                        value={formData.danh_gia || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B]"
                        placeholder="Đánh giá nhanh chất lượng dịch vụ (ví dụ: Uy tín, hỗ trợ nhanh...)"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đường dẫn hồ sơ (PDF / Drive)</label>
                      <input
                        type="url"
                        name="link_ho_so"
                        value={formData.link_ho_so || ''}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 font-medium"
                        placeholder="https://drive.google.com/..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú bổ sung</label>
                      <textarea
                        name="ghi_chu"
                        value={formData.ghi_chu || ''}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] resize-none text-sm text-gray-700"
                        placeholder="Nhập các ghi chú thêm nếu có..."
                      ></textarea>
                    </div>
                  </div>
                </div>

              </div>

              {/* FOOTER */}
              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-sm text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors text-sm"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu Đối Tác
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa nhà cung cấp này vĩnh viễn.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors text-sm"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
