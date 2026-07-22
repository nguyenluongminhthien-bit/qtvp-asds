import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Wrench, Plus, Search, Edit2, Trash2, Calendar, MapPin, 
  Users, CheckCircle2, ChevronLeft, ClipboardPaste, RefreshCw, AlertTriangle, 
  ExternalLink, CheckCircle, Info, BookOpen, AlertCircle, Save, X, FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { useAuth } from '../../contexts/AuthContext';
import { DonVi, ThietBiNghiemNgat, KiemDinhTBNN } from '../../types';
import PasteImportModal, { ColumnMapItem } from '../ui/PasteImportModal';
import { getExpiryStatus } from '../../utils/expiryStatus';
import { buildHierarchicalOptions, getUnitEmoji, getAllSubordinateIds } from '../../utils/hierarchy';

interface StrictEquipmentTabProps {
  selectedUnitFilter: string | null;
  isListCollapsed: boolean;
  donViList: DonVi[];
  thietBiList: ThietBiNghiemNgat[];
  kiemDinhList: KiemDinhTBNN[];
  onReload: () => void;
}

export default function StrictEquipmentTab({
  selectedUnitFilter,
  isListCollapsed,
  donViList,
  thietBiList = [],
  kiemDinhList = [],
  onReload
}: StrictEquipmentTabProps) {
  const { user } = useAuth();

  const hierarchicalOptions = useMemo(() => {
    return buildHierarchicalOptions(donViList);
  }, [donViList]);

  // States quản lý
  const [selectedThietBiId, setSelectedThietBiId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'WARNING' | 'URGENT' | 'OK'>('ALL');
  
  // Modals & Form States
  const [isEditThietBiOpen, setIsEditThietBiOpen] = useState(false);
  const [editingThietBi, setEditingThietBi] = useState<Partial<ThietBiNghiemNgat> | null>(null);
  const [isEditKiemDinhOpen, setIsEditKiemDinhOpen] = useState(false);
  const [editingKiemDinh, setEditingKiemDinh] = useState<Partial<KiemDinhTBNN> | null>(null);
  
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Confirm Modals
  const [confirmType, setConfirmType] = useState<'THIET_BI' | 'KIEM_DINH' | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Map tên đơn vị
  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(d => {
      map[d.id] = d.ten_don_vi;
    });
    return map;
  }, [donViList]);

  // Đơn vị được chọn và tất cả đơn vị con
  const activeUnitIds = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViList]);

  // Lọc thiết bị thuộc đơn vị đang xem
  const filteredThietBiRaw = useMemo(() => {
    return thietBiList.filter(tb => {
      if (selectedUnitFilter && !activeUnitIds.includes(tb.id_don_vi)) return false;
      return true;
    });
  }, [thietBiList, selectedUnitFilter, activeUnitIds]);

  // Tra cứu lượt kiểm định gần nhất của từng thiết bị
  const currentKiemDinhMap = useMemo(() => {
    const map: Record<string, KiemDinhTBNN> = {};
    
    filteredThietBiRaw.forEach(tb => {
      const inspections = kiemDinhList
        .filter(kd => kd.id_thiet_bi === tb.id)
        .sort((a, b) => new Date(b.ngay_kiem_dinh).getTime() - new Date(a.ngay_kiem_dinh).getTime());
      
      if (inspections.length > 0) {
        map[tb.id] = inspections[0];
      }
    });
    
    return map;
  }, [filteredThietBiRaw, kiemDinhList]);

  // Lọc thiết bị theo tìm kiếm & trạng thái hạn kiểm định
  const processedThietBiList = useMemo(() => {
    return filteredThietBiRaw.filter(tb => {
      // Lọc theo tìm kiếm
      const search = searchTerm.trim().toLowerCase();
      const matchSearch = !search || 
        (tb.ten_thiet_bi || '').toLowerCase().includes(search) ||
        (tb.so_serial || '').toLowerCase().includes(search) ||
        (tb.ma_thiet_bi || '').toLowerCase().includes(search) ||
        (tb.ma_che_tao || '').toLowerCase().includes(search) ||
        (donViMap[tb.id_don_vi] || '').toLowerCase().includes(search);
      
      if (!matchSearch) return false;

      // Lọc theo trạng thái kiểm định
      if (statusFilter === 'ALL') return true;
      
      const lastKd = currentKiemDinhMap[tb.id];
      if (tb.tinh_trang !== 'Đang sử dụng') return false; // Thiết bị ngừng sử dụng không tính cảnh báo hạn

      if (!lastKd) return statusFilter === 'ALL'; // không có kiểm định
      
      const status = getExpiryStatus(lastKd.han_kiem_dinh);
      if (statusFilter === 'EXPIRED' && status.level === 'expired') return true;
      if (statusFilter === 'URGENT' && status.level === 'urgent') return true;
      if (statusFilter === 'WARNING' && status.level === 'warning') return true;
      if (statusFilter === 'OK' && status.level === 'ok') return true;
      
      return false;
    });
  }, [filteredThietBiRaw, searchTerm, statusFilter, currentKiemDinhMap, donViMap]);

  // Thống kê KPI đầu Showroom
  const stats = useMemo(() => {
    let total = 0;
    let expired = 0;
    let urgent = 0;
    let warning = 0;
    let ok = 0;

    filteredThietBiRaw.forEach(tb => {
      if (tb.tinh_trang === 'Đang sử dụng') {
        total++;
        const lastKd = currentKiemDinhMap[tb.id];
        if (lastKd) {
          const status = getExpiryStatus(lastKd.han_kiem_dinh);
          if (status.level === 'expired') expired++;
          else if (status.level === 'urgent') urgent++;
          else if (status.level === 'warning') warning++;
          else if (status.level === 'ok') ok++;
        } else {
          expired++; // Chưa kiểm định lần nào coi như quá hạn kiểm định
        }
      }
    });

    return { total, expired, urgent, warning, ok };
  }, [filteredThietBiRaw, currentKiemDinhMap]);

  // Chi tiết thiết bị được chọn
  const selectedThietBi = useMemo(() => {
    return thietBiList.find(tb => tb.id === selectedThietBiId) || null;
  }, [thietBiList, selectedThietBiId]);

  // Lịch sử kiểm định của thiết bị được chọn
  const selectedHistory = useMemo(() => {
    if (!selectedThietBiId) return [];
    return kiemDinhList
      .filter(kd => kd.id_thiet_bi === selectedThietBiId)
      .sort((a, b) => new Date(b.ngay_kiem_dinh).getTime() - new Date(a.ngay_kiem_dinh).getTime());
  }, [kiemDinhList, selectedThietBiId]);

  // Mở form Thêm/Sửa thiết bị
  const handleOpenEditThietBi = (tb: Partial<ThietBiNghiemNgat> | null = null) => {
    setEditingThietBi(tb || {
      ten_thiet_bi: '',
      id_don_vi: selectedUnitFilter || '',
      so_serial: '',
      ma_thiet_bi: '',
      ma_che_tao: '',
      thong_so_ky_thuat: '',
      dia_diem_lap_dat: '',
      tinh_trang: 'Đang sử dụng'
    });
    setIsEditThietBiOpen(true);
  };

  // Lưu thông tin thiết bị
  const handleSaveThietBi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThietBi?.ten_thiet_bi || !editingThietBi?.id_don_vi || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const isCreate = !editingThietBi.id;
      const dataToSave = { ...editingThietBi };
      
      if (isCreate) {
        dataToSave.id = `TBNN${Date.now()}`;
      }

      await apiService.save(dataToSave, isCreate ? 'create' : 'update', 'ts_thiet_bi_nghiem_ngat');
      toast.success(isCreate ? 'Đã thêm thiết bị nghiêm ngặt mới!' : 'Đã cập nhật thông tin thiết bị!');
      onReload();
      setIsEditThietBiOpen(false);
      if (isCreate && dataToSave.id) {
        setSelectedThietBiId(dataToSave.id);
      }
    } catch (err) {
      toast.error('Lỗi khi lưu thông tin thiết bị.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở form Thêm/Sửa kiểm định
  const handleOpenEditKiemDinh = (kd: Partial<KiemDinhTBNN> | null = null) => {
    if (!selectedThietBiId) return;
    setEditingKiemDinh(kd || {
      id_thiet_bi: selectedThietBiId,
      ngay_kiem_dinh: new Date().toISOString().slice(0, 10),
      hl_kiem_dinh: 'Đột xuất/Đầu tiên',
      han_kiem_dinh: '',
      nguoi_ky: '',
      gia_thanh: 0,
      loai_kiem_dinh: 'Định kỳ',
      bien_ban_kiem_dinh: '',
      cap_ly_lich: 'Chưa cấp',
      nguoi_ho_tro: '',
      tinh_trang_ho_so_luu_tru: 'Đầy đủ',
      ghi_chu: ''
    });
    setIsEditKiemDinhOpen(true);
  };

  // Lưu thông tin kiểm định
  const handleSaveKiemDinh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKiemDinh?.ngay_kiem_dinh || !editingKiemDinh?.han_kiem_dinh || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const isCreate = !editingKiemDinh.id;
      const dataToSave = { ...editingKiemDinh };
      
      if (isCreate) {
        dataToSave.id = `KD${Date.now()}`;
      }

      await apiService.save(dataToSave, isCreate ? 'create' : 'update', 'nk_kiem_dinh_tbnn');
      toast.success(isCreate ? 'Đã thêm nhật ký kiểm định!' : 'Đã sửa nhật ký kiểm định!');
      onReload();
      setIsEditKiemDinhOpen(false);
    } catch (err) {
      toast.error('Lỗi khi lưu nhật ký kiểm định.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa Thiết bị hoặc Nhật ký
  const triggerDelete = (type: 'THIET_BI' | 'KIEM_DINH', id: string) => {
    setDeleteTargetId(id);
    setConfirmType(type);
  };

  const executeDelete = async () => {
    if (!deleteTargetId || !confirmType) return;
    try {
      if (confirmType === 'THIET_BI') {
        await apiService.delete(deleteTargetId, 'ts_thiet_bi_nghiem_ngat');
        toast.success('Đã xóa thiết bị nghiêm ngặt!');
        if (selectedThietBiId === deleteTargetId) {
          setSelectedThietBiId(null);
        }
        onReload();
      } else if (confirmType === 'KIEM_DINH') {
        await apiService.delete(deleteTargetId, 'nk_kiem_dinh_tbnn');
        toast.success('Đã xóa nhật ký kiểm định!');
        onReload();
      }
    } catch (err) {
      toast.error('Lỗi khi xóa dữ liệu.');
    } finally {
      setConfirmType(null);
      setDeleteTargetId(null);
    }
  };

  // Cấu hình mapping dán Excel
  const columnMapping: ColumnMapItem[] = [
    { label: 'Số TT', key: 'stt', type: 'number' },
    { label: 'Số Serial', key: 'so_serial', type: 'text' },
    { label: 'Tên Thiết bị', key: 'ten_thiet_bi', type: 'text', required: true },
    { label: 'Mã Thiết bị', key: 'ma_thiet_bi', type: 'text' },
    { label: 'Mã Chế tạo', key: 'ma_che_tao', type: 'text' },
    { label: 'Thông số KT', key: 'thong_so_ky_thuat', type: 'text' },
    { label: 'Ngày Kiểm định', key: 'ngay_kiem_dinh', type: 'date', required: true },
    { label: 'Hiệu lực KĐ', key: 'hl_kiem_dinh', type: 'text' },
    { label: 'Hạn Kiểm định', key: 'han_kiem_dinh', type: 'date', required: true },
    { label: 'Người Ký', key: 'nguoi_ky', type: 'text' },
    { label: 'Đơn vị', key: 'don_vi_text', type: 'text' },
    { label: 'Giá thành', key: 'gia_thanh', type: 'number' },
    { label: 'Định kì/bất thường', key: 'loai_kiem_dinh', type: 'text' },
    { label: 'Cấp lý lịch', key: 'cap_ly_lich', type: 'text' },
    { label: 'Người hỗ trợ', key: 'nguoi_ho_tro', type: 'text' },
    { label: 'Tình Trạng Hồ Sơ Lưu Trữ', key: 'tinh_trang_ho_so_luu_tru', type: 'text' }
  ];

  const handleValidateExcelRow = (row: any) => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const name = String(row.ten_thiet_bi || '').trim();
    if (!name) {
      errors['ten_thiet_bi'] = 'Tên thiết bị không được để trống.';
    }

    const serial = String(row.so_serial || '').trim();
    const ma = String(row.ma_thiet_bi || '').trim();
    if (!serial && !ma) {
      warnings['so_serial'] = 'Nên có số Serial hoặc Mã thiết bị để đối chiếu chống trùng.';
    }

    // Check đơn vị text
    const dvText = String(row.don_vi_text || '').trim();
    if (dvText) {
      const match = donViList.find(d => d.ten_don_vi.toLowerCase().includes(dvText.toLowerCase()));
      if (!match) {
        warnings['don_vi_text'] = 'Tên đơn vị chưa khớp hoàn toàn với đơn vị trên hệ thống.';
      }
    }

    return { errors, warnings };
  };

  // Lưu đợt import Excel
  const handleSavePastedData = async (rows: any[]) => {
    try {
      toast.info(`Đang xử lý nhập ${rows.length} lượt kiểm định thiết bị...`);
      
      const newDevices: any[] = [];
      const newInspections: any[] = [];

      // Tạo map tra cứu nhanh thiết bị hiện có theo serial hoặc mã thiết bị
      const existingSerialMap = new Map<string, ThietBiNghiemNgat>();
      const existingCodeMap = new Map<string, ThietBiNghiemNgat>();
      thietBiList.forEach(tb => {
        if (tb.so_serial) existingSerialMap.set(tb.so_serial.trim().toLowerCase(), tb);
        if (tb.ma_thiet_bi) existingCodeMap.set(tb.ma_thiet_bi.trim().toLowerCase(), tb);
      });

      // Tạo map tra cứu đơn vị theo tên
      const donViNameMap = new Map<string, string>();
      donViList.forEach(d => {
        donViNameMap.set(d.ten_don_vi.toLowerCase(), d.id);
      });

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const serial = String(row.so_serial || '').trim();
        const code = String(row.ma_thiet_bi || '').trim();
        
        let deviceId = '';
        let matchedDevice: ThietBiNghiemNgat | undefined;

        // Tìm kiếm đối chiếu: Ưu tiên Số Serial. Chỉ dùng Mã thiết bị khi Số Serial trống.
        if (serial) {
          matchedDevice = existingSerialMap.get(serial.toLowerCase());
        } else if (code) {
          matchedDevice = existingCodeMap.get(code.toLowerCase());
        }

        if (matchedDevice) {
          deviceId = matchedDevice.id;
        } else {
          // Tạo thiết bị mới
          deviceId = `TBNN${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
          
          // Map đơn vị id
          const dvText = String(row.don_vi_text || '').trim();
          let idDonVi = selectedUnitFilter || '';
          if (dvText) {
            const foundId = donViNameMap.get(dvText.toLowerCase());
            if (foundId) idDonVi = foundId;
            else {
              // Tìm kiếm mờ gần nhất
              const partialMatch = donViList.find(d => d.ten_don_vi.toLowerCase().includes(dvText.toLowerCase()));
              if (partialMatch) idDonVi = partialMatch.id;
            }
          }

          const newDevice = {
            id: deviceId,
            id_don_vi: idDonVi,
            don_vi_text: dvText || null,
            so_serial: serial || null,
            ten_thiet_bi: row.ten_thiet_bi,
            ma_thiet_bi: code || null,
            ma_che_tao: String(row.ma_che_tao || '').trim() || null,
            thong_so_ky_thuat: String(row.thong_so_ky_thuat || '').trim() || null,
            dia_diem_lap_dat: null,
            tinh_trang: 'Đang sử dụng'
          };
          newDevices.push(newDevice);
          
          // Đưa vào map tạm thời để tránh tạo trùng nếu dòng Excel tiếp theo chứa thiết bị này
          if (serial) existingSerialMap.set(serial.toLowerCase(), newDevice as any);
          if (code) existingCodeMap.set(code.toLowerCase(), newDevice as any);
        }

        // Tạo bản ghi kiểm định
        const newInsp = {
          id: `KD${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          id_thiet_bi: deviceId,
          ngay_kiem_dinh: row.ngay_kiem_dinh,
          hl_kiem_dinh: String(row.hl_kiem_dinh || '').trim() || null,
          han_kiem_dinh: row.han_kiem_dinh,
          nguoi_ky: String(row.nguoi_ky || '').trim() || null,
          gia_thanh: Number(row.gia_thanh) || 0,
          loai_kiem_dinh: String(row.loai_kiem_dinh || '').trim() || 'Định kỳ',
          bien_ban_kiem_dinh: null,
          cap_ly_lich: String(row.cap_ly_lich || '').trim() || 'Chưa cấp',
          nguoi_ho_tro: String(row.nguoi_ho_tro || '').trim() || null,
          tinh_trang_ho_so_luu_tru: String(row.tinh_trang_ho_so_luu_tru || '').trim() || 'Đầy đủ',
          ghi_chu: null
        };
        newInspections.push(newInsp);
      }

      // Lưu thiết bị mới
      if (newDevices.length > 0) {
        await apiService.save(newDevices, 'create', 'ts_thiet_bi_nghiem_ngat');
      }

      // Lưu lịch sử kiểm định mới
      if (newInspections.length > 0) {
        await apiService.save(newInspections, 'create', 'nk_kiem_dinh_tbnn');
      }

      toast.success(`Nhập Excel thành công! Đã thêm mới ${newDevices.length} thiết bị và ${newInspections.length} lượt kiểm định.`);
      onReload();
      setIsPasteModalOpen(false);
    } catch (err) {
      toast.error('Gặp sự cố khi lưu dữ liệu import.');
    }
  };

  return (
    <div className={`transition-all duration-300 w-full flex flex-col gap-6 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
      
      {/* 🔴 KHỐI KPI TỔNG HỢP KIỂM ĐỊNH THIẾT BỊ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3.5 hover:shadow-md ${
            statusFilter === 'ALL' 
              ? 'border-lime-500 bg-lime-50/20 ring-2 ring-lime-400 shadow-md' 
              : 'border-lime-200 bg-white hover:border-lime-500'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-lime-100 text-lime-750 flex items-center justify-center shrink-0 border border-lime-200">
            <Wrench size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Tổng Thiết bị Nghiêm ngặt</p>
            <p className="text-2xl font-black text-lime-700">{stats.total}</p>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('EXPIRED')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3.5 hover:shadow-md ${
            statusFilter === 'EXPIRED' 
              ? 'border-red-500 bg-red-50/20 ring-2 ring-red-400 shadow-md' 
              : 'border-red-200 bg-white hover:border-red-500'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm border border-red-200">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-550 uppercase">Quá Hạn Kiểm Định</p>
            <p className="text-2xl font-black text-red-600">{stats.expired}</p>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('URGENT')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3.5 hover:shadow-md ${
            statusFilter === 'URGENT' 
              ? 'border-orange-500 bg-orange-50/20 ring-2 ring-orange-400 shadow-md' 
              : 'border-orange-200 bg-white hover:border-orange-500'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 border border-orange-200">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Gấp (Dưới 30 ngày)</p>
            <p className="text-2xl font-black text-orange-600">{stats.urgent}</p>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('OK')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3.5 hover:shadow-md ${
            statusFilter === 'OK' 
              ? 'border-green-500 bg-green-50/20 ring-2 ring-green-400 shadow-md' 
              : 'border-green-200 bg-white hover:border-green-500'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0 border border-green-200">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Hạn An Toàn</p>
            <p className="text-2xl font-black text-green-700">{stats.ok}</p>
          </div>
        </div>
      </div>

      {/* 🔴 KHU VỰC THAO TÁC: SEARCH, BUTTONS */}
      <div className="bg-white p-4 rounded-2xl border border-lime-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Tìm kiếm thiết bị nghiêm ngặt theo tên, mã, serial..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-xs font-semibold"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {user?.quyen === 'ADMIN' && (
            <>
              <button 
                onClick={() => handleOpenEditThietBi()}
                className="flex items-center justify-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                <Plus size={16} /> Thêm Thiết bị
              </button>
              <button 
                onClick={() => setIsPasteModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-white border-2 border-lime-500 hover:bg-lime-50 text-lime-750 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <ClipboardPaste size={16} /> Dán Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* 🔴 GIAO DIỆN PHÂN CỘT CHI TIẾT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* CỘT 1 + 2: DANH SÁCH THIẾT BỊ (Bên trái) */}
        <div className="xl:col-span-2 bg-white border border-lime-100 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-gray-150 bg-gray-50/50 flex justify-between items-center shrink-0">
            <h3 className="text-sm font-black text-lime-800 uppercase flex items-center gap-2">
              <Wrench size={18} /> Danh sách thiết bị ({processedThietBiList.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            {processedThietBiList.length === 0 ? (
              <div className="p-16 text-center text-gray-400">
                <Info size={40} className="mx-auto mb-3 text-lime-500" />
                <p className="text-sm font-bold">Không tìm thấy thiết bị nghiêm ngặt nào.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="p-3.5">Mã thiết bị / Serial</th>
                    <th className="p-3.5">Tên Thiết bị</th>
                    <th className="p-3.5">Đơn vị Showroom</th>
                    <th className="p-3.5">Hạn Kiểm định</th>
                    <th className="p-3.5 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {processedThietBiList.map(tb => {
                    const lastKd = currentKiemDinhMap[tb.id];
                    const isSelected = selectedThietBiId === tb.id;
                    const status = lastKd ? getExpiryStatus(lastKd.han_kiem_dinh) : getExpiryStatus(null);
                    
                    return (
                      <tr 
                        key={tb.id} 
                        onClick={() => setSelectedThietBiId(tb.id)}
                        className={`cursor-pointer hover:bg-lime-50/40 transition-colors ${
                          isSelected ? 'bg-lime-50/70 border-l-4 border-lime-600' : ''
                        }`}
                      >
                        <td className="p-3.5">
                          <p className="font-bold text-gray-800">{tb.ma_thiet_bi || '---'}</p>
                          <p className="text-[10px] font-bold text-gray-400">SN: {tb.so_serial || '---'}</p>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-gray-700 block max-w-xs truncate">{tb.ten_thiet_bi}</span>
                          <span className="text-[10px] text-gray-400 font-semibold">{tb.tinh_trang}</span>
                        </td>
                        <td className="p-3.5 font-semibold text-gray-600">
                          {donViMap[tb.id_don_vi] || tb.don_vi_text || '---'}
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-gray-700">
                            {lastKd ? new Date(lastKd.han_kiem_dinh).toLocaleDateString('vi-VN') : 'Chưa có'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            KĐ ngày: {lastKd ? new Date(lastKd.ngay_kiem_dinh).toLocaleDateString('vi-VN') : '---'}
                          </p>
                        </td>
                        <td className="p-3.5 text-center">
                          {tb.tinh_trang === 'Đang sử dụng' ? (
                            <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold shadow-2xs ${status.colorClass}`}>
                              {status.label}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-bold">
                              {tb.tinh_trang}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* CỘT 3: CHI TIẾT & LỊCH SỬ KIỂM ĐỊNH (Bên phải) */}
        <div className="bg-white border border-lime-100 rounded-2xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          <div className="p-4 border-b border-gray-150 bg-gray-50/50 flex justify-between items-center shrink-0">
            <h3 className="text-sm font-black text-lime-800 uppercase flex items-center gap-2">
              <Calendar size={18} /> Nhật ký kiểm định
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {!selectedThietBi ? (
              <div className="h-full flex flex-col justify-center items-center text-gray-400 py-16">
                <BookOpen size={40} className="mb-2 text-lime-500" />
                <p className="text-xs font-bold text-center">Bấm chọn thiết bị nghiêm ngặt ở cột danh sách để xem lịch sử kiểm định chi tiết.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Master Info */}
                <div className="bg-lime-50/40 p-4 rounded-xl border border-lime-100 relative">
                  {user?.quyen === 'ADMIN' && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button 
                        onClick={() => handleOpenEditThietBi(selectedThietBi)}
                        className="p-1.5 text-lime-700 bg-white border border-lime-200 hover:bg-lime-50 rounded-lg transition-colors cursor-pointer"
                        title="Sửa thiết bị"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => triggerDelete('THIET_BI', selectedThietBi.id)}
                        className="p-1.5 text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa thiết bị"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}

                  <h4 className="font-black text-lime-855 uppercase text-xs tracking-wider mb-3 block max-w-[80%]">{selectedThietBi.ten_thiet_bi}</h4>
                  
                  <div className="space-y-2 text-[11px] font-semibold text-gray-600">
                    <p className="flex justify-between"><span className="text-gray-400">Mã / Serial:</span> <span className="font-bold text-gray-800">{selectedThietBi.ma_thiet_bi || '---'} / {selectedThietBi.so_serial || '---'}</span></p>
                    <p className="flex justify-between"><span className="text-gray-400">Mã chế tạo:</span> <span className="font-bold text-gray-800">{selectedThietBi.ma_che_tao || '---'}</span></p>
                    <p className="flex justify-between"><span className="text-gray-400">Showroom:</span> <span className="font-bold text-lime-850">{donViMap[selectedThietBi.id_don_vi] || '---'}</span></p>
                    <p className="flex justify-between"><span className="text-gray-400">Địa điểm lắp:</span> <span className="font-bold text-gray-800">{selectedThietBi.dia_diem_lap_dat || '---'}</span></p>
                    {selectedThietBi.thong_so_ky_thuat && (
                      <div className="pt-2 border-t border-lime-100/50">
                        <span className="text-gray-400 block mb-1">Thông số kỹ thuật:</span>
                        <p className="bg-white p-2 rounded border border-lime-100/50 text-[10px] text-gray-700 whitespace-pre-wrap">{selectedThietBi.thong_so_ky_thuat}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inspections Header */}
                <div className="flex justify-between items-center border-b border-gray-150 pb-2 shrink-0">
                  <span className="text-[11px] font-black text-gray-500 uppercase">Lượt kiểm định ({selectedHistory.length})</span>
                  {user?.quyen === 'ADMIN' && (
                    <button 
                      onClick={() => handleOpenEditKiemDinh()}
                      className="text-[11px] font-bold text-lime-700 bg-lime-50 hover:bg-lime-100 px-3 py-1 rounded-lg border border-lime-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Thêm lượt KĐ
                    </button>
                  )}
                </div>

                {/* Inspection Timeline */}
                {selectedHistory.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 italic py-6">Chưa có nhật ký kiểm định.</p>
                ) : (
                  <div className="relative border-l border-lime-200 pl-4 ml-2 space-y-6">
                    {selectedHistory.map((kd, idx) => {
                      const status = getExpiryStatus(kd.han_kiem_dinh);
                      return (
                        <div key={kd.id} className="relative group">
                          {/* Dot marker */}
                          <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 bg-white ${
                            idx === 0 ? 'border-lime-500 scale-125 ring-2 ring-lime-100' : 'border-gray-300'
                          }`} />
                          
                          <div className="bg-gray-50 hover:bg-lime-50/20 p-3.5 rounded-xl border border-gray-150 relative transition-colors shadow-2xs">
                            {user?.quyen === 'ADMIN' && (
                              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleOpenEditKiemDinh(kd)}
                                  className="p-1 text-lime-700 hover:bg-white rounded border border-transparent hover:border-lime-200 cursor-pointer bg-transparent animate-in"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button 
                                  onClick={() => triggerDelete('KIEM_DINH', kd.id)}
                                  className="p-1 text-red-600 hover:bg-white rounded border border-transparent hover:border-red-200 cursor-pointer bg-transparent animate-in"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-400">
                                {new Date(kd.ngay_kiem_dinh).toLocaleDateString('vi-VN')}
                              </span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${status.colorClass}`}>
                                {status.label}
                              </span>
                              {kd.loai_kiem_dinh && (
                                <span className="text-[8px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-black">
                                  {kd.loai_kiem_dinh}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 text-[10px] font-semibold text-gray-600">
                              <p className="flex justify-between"><span className="text-gray-400">Hạn đến:</span> <span className="font-bold text-red-600">{new Date(kd.han_kiem_dinh).toLocaleDateString('vi-VN')}</span></p>
                              {kd.hl_kiem_dinh && <p className="flex justify-between"><span className="text-gray-400">Hiệu lực:</span> <span className="text-gray-800">{kd.hl_kiem_dinh}</span></p>}
                              {kd.nguoi_ky && <p className="flex justify-between"><span className="text-gray-400">Người ký:</span> <span className="text-gray-800">{kd.nguoi_ky}</span></p>}
                              {(kd.gia_thanh || 0) > 0 && <p className="flex justify-between"><span className="text-gray-400">Giá thành:</span> <span className="text-gray-800">{kd.gia_thanh.toLocaleString('vi-VN')} VNĐ</span></p>}
                              {kd.cap_ly_lich && <p className="flex justify-between"><span className="text-gray-400">Cấp lý lịch:</span> <span className="text-gray-850 font-bold">{kd.cap_ly_lich}</span></p>}
                              {kd.nguoi_ho_tro && <p className="flex justify-between"><span className="text-gray-400">Người hỗ trợ:</span> <span className="text-gray-800">{kd.nguoi_ho_tro}</span></p>}
                              {kd.tinh_trang_ho_so_luu_tru && <p className="flex justify-between"><span className="text-gray-400">Lưu trữ HS:</span> <span className="text-gray-800">{kd.tinh_trang_ho_so_luu_tru}</span></p>}
                              {kd.ghi_chu && <p className="pt-1 text-[9px] text-gray-400 italic whitespace-pre-wrap">{kd.ghi_chu}</p>}
                              
                              {kd.bien_ban_kiem_dinh && (
                                <div className="pt-2 border-t border-dashed border-gray-250 mt-1.5 flex justify-end">
                                  <a 
                                    href={kd.bien_ban_kiem_dinh} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-lime-750 font-bold hover:underline flex items-center gap-1 text-[9px]"
                                  >
                                    <ExternalLink size={10} /> Xem biên bản (PDF)
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 🔴 FORM MODAL 1: THÊM / SỬA THIẾT BỊ */}
      {isEditThietBiOpen && editingThietBi && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-200">
            <div className="flex justify-between p-4 border-b border-lime-100 bg-lime-50 shrink-0">
              <h3 className="text-md font-bold text-lime-800 flex items-center gap-2"><Wrench size={18}/> {editingThietBi.id ? 'Sửa thiết bị nghiêm ngặt' : 'Thêm thiết bị mới'}</h3>
              <button onClick={() => setIsEditThietBiOpen(false)} className="text-lime-400 hover:text-red-500 rounded-full p-1 bg-white shadow-sm transition-colors"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSaveThietBi} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs font-semibold text-gray-700">
                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 font-bold uppercase text-[10px]">Tên thiết bị <span className="text-red-500">*</span></label>
                  <input type="text" value={editingThietBi.ten_thiet_bi || ''} onChange={e => setEditingThietBi({ ...editingThietBi, ten_thiet_bi: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]" placeholder="Nồi hơi, Cầu nâng, Máy nén khí..." required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Đơn vị/Showroom <span className="text-red-500">*</span></label>
                    <select value={editingThietBi.id_don_vi || ''} onChange={e => setEditingThietBi({ ...editingThietBi, id_don_vi: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]" required>
                      <option value="">Chọn Showroom...</option>
                      {hierarchicalOptions.map(({ unit, prefix }) => {
                        const emoji = getUnitEmoji(unit.loai_hinh);
                        return (
                          <option key={unit.id} value={unit.id}>
                            {prefix}{emoji} {unit.ten_don_vi}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Tình trạng sử dụng</label>
                    <select value={editingThietBi.tinh_trang || 'Đang sử dụng'} onChange={e => setEditingThietBi({ ...editingThietBi, tinh_trang: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]">
                      <option value="Đang sử dụng">Đang sử dụng</option>
                      <option value="Ngừng sử dụng">Ngừng sử dụng</option>
                      <option value="Thanh lý">Thanh lý</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Số Serial</label>
                    <input type="text" value={editingThietBi.so_serial || ''} onChange={e => setEditingThietBi({ ...editingThietBi, so_serial: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" placeholder="VD: S198273A..." />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Mã thiết bị</label>
                    <input type="text" value={editingThietBi.ma_thiet_bi || ''} onChange={e => setEditingThietBi({ ...editingThietBi, ma_thiet_bi: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" placeholder="Mã định danh nội bộ..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Mã chế tạo</label>
                    <input type="text" value={editingThietBi.ma_che_tao || ''} onChange={e => setEditingThietBi({ ...editingThietBi, ma_che_tao: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" placeholder="Mã của nhà sản xuất..." />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Địa điểm lắp đặt</label>
                    <input type="text" value={editingThietBi.dia_diem_lap_dat || ''} onChange={e => setEditingThietBi({ ...editingThietBi, dia_diem_lap_dat: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]" placeholder="Khu vực nhà xưởng, trạm điện..." />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 font-bold uppercase text-[10px]">Thông số kỹ thuật</label>
                  <textarea value={editingThietBi.thong_so_ky_thuat || ''} onChange={e => setEditingThietBi({ ...editingThietBi, thong_so_ky_thuat: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 h-16 resize-none" placeholder="Các thông tin kỹ thuật cơ bản..." />
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsEditThietBiOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-700 hover:bg-gray-100 transition-colors">Hủy bỏ</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-lime-650 hover:bg-lime-700 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer">{isSubmitting ? 'Đang lưu...' : 'Lưu thiết bị'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 🔴 FORM MODAL 2: THÊM / SỬA KIỂM ĐỊNH */}
      {isEditKiemDinhOpen && editingKiemDinh && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in duration-200">
            <div className="flex justify-between p-4 border-b border-lime-100 bg-lime-50 shrink-0">
              <h3 className="text-md font-bold text-lime-800 flex items-center gap-2"><Calendar size={18}/> {editingKiemDinh.id ? 'Sửa lượt kiểm định' : 'Thêm lượt kiểm định'}</h3>
              <button onClick={() => setIsEditKiemDinhOpen(false)} className="text-lime-400 hover:text-red-500 rounded-full p-1 bg-white shadow-sm transition-colors"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveKiemDinh} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs font-semibold text-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Ngày kiểm định <span className="text-red-500">*</span></label>
                    <input type="date" value={editingKiemDinh.ngay_kiem_dinh || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, ngay_kiem_dinh: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Hạn kiểm định <span className="text-red-500">*</span></label>
                    <input type="date" value={editingKiemDinh.han_kiem_dinh || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, han_kiem_dinh: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Loại kiểm định</label>
                    <select value={editingKiemDinh.loai_kiem_dinh || 'Định kỳ'} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, loai_kiem_dinh: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500">
                      <option value="Định kỳ">Định kỳ</option>
                      <option value="Bất thường">Bất thường / Đột xuất</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Hiệu lực kiểm định</label>
                    <input type="text" value={editingKiemDinh.hl_kiem_dinh || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, hl_kiem_dinh: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" placeholder="VD: 1 năm, 2 năm..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Người ký quyết định</label>
                    <input type="text" value={editingKiemDinh.nguoi_ky || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, nguoi_ky: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" placeholder="Họ và tên người ký..." />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Giá thành kiểm định (VNĐ)</label>
                    <input type="number" value={editingKiemDinh.gia_thanh || 0} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, gia_thanh: Number(e.target.value) })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Cấp lý lịch</label>
                    <select value={editingKiemDinh.cap_ly_lich || 'Chưa cấp'} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, cap_ly_lich: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]">
                      <option value="Chưa cấp">Chưa cấp</option>
                      <option value="Đã cấp">Đã cấp lý lịch kiểm định</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Tình trạng hồ sơ lưu trữ</label>
                    <select value={editingKiemDinh.tinh_trang_ho_so_luu_tru || 'Đầy đủ'} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, tinh_trang_ho_so_luu_tru: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 bg-[#FFFFF0]">
                      <option value="Đầy đủ">Đầy đủ</option>
                      <option value="Đang thiếu">Đang thiếu / Thất lạc</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Người hỗ trợ kiểm định</label>
                    <input type="text" value={editingKiemDinh.nguoi_ho_tro || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, nguoi_ho_tro: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500" placeholder="Tên đơn vị/người hỗ trợ..." />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-500 font-bold uppercase text-[10px]">Link biên bản kiểm định (PDF)</label>
                    <input type="url" value={editingKiemDinh.bien_ban_kiem_dinh || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, bien_ban_kiem_dinh: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 text-blue-600 bg-[#FFFFF0]" placeholder="https://drive.google.com/..." />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 font-bold uppercase text-[10px]">Ghi chú kiểm định</label>
                  <textarea value={editingKiemDinh.ghi_chu || ''} onChange={e => setEditingKiemDinh({ ...editingKiemDinh, ghi_chu: e.target.value })} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lime-500 h-16 resize-none" placeholder="Nội dung ghi chú thêm..." />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsEditKiemDinhOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-700 hover:bg-gray-100 transition-colors">Hủy bỏ</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-lime-650 hover:bg-lime-700 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer">{isSubmitting ? 'Đang lưu...' : 'Lưu lượt kiểm định'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 🔴 MODAL DÂN EXCEL KIỂM ĐỊNH */}
      <PasteImportModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSave={handleSavePastedData}
        title={`Dán Excel dữ liệu kiểm định cho: ${donViMap[selectedUnitFilter || ''] || 'Tất cả Cơ sở'}`}
        columnMapping={columnMapping}
        onValidateRow={handleValidateExcelRow}
      />

      {/* 🔴 CUSTOM CONFIRM MODAL XÓA */}
      {confirmType !== null && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertTriangle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {confirmType === 'THIET_BI' ? 'Xóa thiết bị?' : 'Xóa nhật ký?'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {confirmType === 'THIET_BI' 
                ? 'Bạn có chắc chắn muốn xóa thiết bị nghiêm ngặt này? Tất cả lịch sử kiểm định đi kèm của thiết bị sẽ bị xóa vĩnh viễn.' 
                : 'Bạn có chắc chắn muốn xóa lượt kiểm định này khỏi nhật ký?'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setConfirmType(null); setDeleteTargetId(null); }} 
                className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={executeDelete} 
                className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
