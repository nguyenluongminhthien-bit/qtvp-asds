import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save, 
  MonitorSmartphone, Building2, MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  History, Calendar, Info, Eye, Cpu, Image as ImageIcon, FileText, Link as LinkIcon,
  Sofa, Video, Package, Layers, Camera, QrCode, Printer
} from 'lucide-react';
import { apiService } from '../services/api';
import { DonVi, ThietBi, NhatKyThietBi, Personnel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getAllSubordinateIds } from '../utils/hierarchy';
import { formatCurrency, toUnaccented, stripAccents } from '../utils/formatters';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import ExpiryBadge from '../components/ExpiryBadge';
import ExpiryAlert from '../components/ExpiryAlert';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import CustomAutocomplete from '../components/ui/CustomAutocomplete';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';


// --- DANH SÁCH NHÓM TÀI SẢN CHUẨN ---
const ASSET_GROUPS = [
  "Máy móc CNTT (PC, Laptop, Server...)",
  "Máy móc VP (In, Scan, Photo, Chấm công...)",
  "Nội thất & Tủ kệ",
  "Điện máy & Điện lạnh (Tivi, AC, Tủ lạnh...)",
  "Hệ thống kỹ thuật (Camera, Mạng, PCCC, Điện...)",
  "Phần mềm & Bản quyền",
  "CCDC An ninh & Vệ sinh (Xe đẩy, máy tuần tra...)",
  "Vật dụng Trang trí & Khác"
];

// --- HỆ THỐNG PHÂN LOẠI TÀI SẢN THÔNG MINH ĐỂ BUNG FORM ĐỘNG ---
const isITEquipment = (nhom: string) => {
  if (!nhom) return false;
  const lower = nhom.toLowerCase();
  return ['pc', 'laptop', 'máy tính', 'server', 'máy chủ', 'macbook', 'cntt'].some(kw => lower.includes(kw));
};

const isFurniture = (nhom: string) => {
  if (!nhom) return false;
  const lower = nhom.toLowerCase();
  return ['bàn', 'ghế', 'tủ', 'kệ', 'nội thất', 'sofa', 'giường', 'quầy', 'bảng', 'màn chiếu'].some(kw => lower.includes(kw));
};



export default function EquipmentPage() {
  const { user } = useAuth();
  const hasRule = (ruleId: string) => {
    if (!user) return false;
    if (String(user.quyen).toUpperCase() === 'ADMIN') return false;
    return String(user.quyen_chi_tiet || '').includes(ruleId);
  };
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [tbData, setTbData] = useState<any[]>([]);
  const [nkData, setNkData] = useState<any[]>([]); 
  const [nhansuData, setNhansuData] = useState<Personnel[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // 🟢 STATE PHÂN TRANG (PAGINATION)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  // 🟢 Reset về trang 1 mỗi khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUnitFilter]);

  // Modals Thiết bị
  const [isTbModalOpen, setIsTbModalOpen] = useState(false);
  const [tbModalMode, setTbModalMode] = useState<'create' | 'update'>('create');
  const [tbFormData, setTbFormData] = useState<any>({});

  // Modals Nhật ký
  const [isNkModalOpen, setIsNkModalOpen] = useState(false);
  const [selectedTbForNk, setSelectedTbForNk] = useState<any | null>(null);
  const [nkFormData, setNkFormData] = useState<any>({});
  const [nkModalMode, setNkModalMode] = useState<'create' | 'update'>('create');
  const [nkFormBp, setNkFormBp] = useState('');
  const [nkFormDv, setNkFormDv] = useState('');

  // Đồng bộ bp_quan_ly_su_dung vào 2 state Bộ phận (nkFormBp) & Đơn vị (nkFormDv)
  useEffect(() => {
    const combined = nkFormData.bp_quan_ly_su_dung || '';
    if (combined.includes(' - ')) {
      const parts = combined.split(' - ');
      setNkFormBp(parts[0] || '');
      setNkFormDv(parts[1] || '');
    } else {
      setNkFormBp(combined);
      setNkFormDv('');
    }
  }, [nkFormData.bp_quan_ly_su_dung, nkFormData.id]);

  // Modal Xem chi tiết
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any | null>(null);

  // Modal Xóa
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'tb' | 'nk'} | null>(null);
  // Trạng thái mở/đóng thanh cảnh báo Hạn bảo hành
  const [isWarningOpen, setIsWarningOpen] = useState(true);
  
  // 🟢 THÊM DÒNG NÀY: Trạng thái ẩn hoàn toàn thông báo
  const [isDismissed, setIsDismissed] = useState(false);

  // 🟢 STATE PHỤC VỤ TÍNH NĂNG QR CODE & IN TEM NHÃN
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedItemsForPrint, setSelectedItemsForPrint] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printItemsList, setPrintItemsList] = useState<any[]>([]);

  // Hàm xử lý khi quét được mã QR thành công
  const handleScannedCode = (code: string) => {
    let assetCode = code.trim();
    
    // Hỗ trợ bóc tách mã tài sản nếu quét ra một đường link URL đầy đủ (HTTP hoặc HTTPS)
    if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const url = new URL(code);
        // Cách 1: Bóc từ query parameter (?qr=...)
        const qrParam = url.searchParams.get('qr');
        if (qrParam) {
          assetCode = qrParam;
        } else {
          // Cách 2: Lấy phần path cuối cùng (/T24ATTS32120025)
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length > 0) {
            assetCode = segments[segments.length - 1];
          }
        }
      } catch (e) {
        console.error("Lỗi phân tích URL mã QR:", e);
      }
    }

    const matchedAsset = tbData.find(tb => String(tb.ma_tai_san).trim().toUpperCase() === assetCode.trim().toUpperCase());
    if (matchedAsset) {
      setViewData(matchedAsset);
      setIsViewModalOpen(true);
      toast.success(`Đã tìm thấy tài sản: ${matchedAsset.ten_thiet_bi}`);
    } else {
      toast.error(`Không tìm thấy tài sản nào có mã "${assetCode}"!`);
    }
  };

  // Tìm người đang sử dụng tài sản gần nhất từ lịch sử nhật ký
  const getLatestUser = (itemId: string) => {
    const logs = nkData.filter(log => log.id_ts_thiet_bi === itemId);
    if (logs.length === 0) return { name: 'Chưa bàn giao', msnv: '---' };
    
    // Sắp xếp các nhật ký mới nhất lên đầu
    const sorted = [...logs].sort((a, b) => String(b.ngay_ghi_nhan || '').localeCompare(String(a.ngay_ghi_nhan || '')));
    
    // Tìm nhật ký gần nhất có ghi nhận người nhận
    const latestUserLog = sorted.find(log => log.ho_ten_nguoi_dung);
    if (latestUserLog) {
      return { 
        name: latestUserLog.ho_ten_nguoi_dung, 
        msnv: latestUserLog.msnv_nguoi_dung || '---' 
      };
    }
    return { name: 'Chưa bàn giao', msnv: '---' };
  };

  // Vòng đời camera quét QR trong ứng dụng (sử dụng Dynamic Import để giảm tải bundle)
  useEffect(() => {
    if (!isScannerOpen) return;
    
    let html5QrCodeInstance: any = null;
    let isMounted = true;

    // Đợi DOM dựng xong thẻ div#reader và tải động thư viện html5-qrcode
    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeInstance = html5QrCode;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            html5QrCode.stop().then(() => {
              setIsScannerOpen(false);
              handleScannedCode(decodedText);
            }).catch((err: any) => {
              console.error("Lỗi dừng camera quét QR:", err);
              setIsScannerOpen(false);
            });
          },
          () => {}
        );
      } catch (err) {
        console.error("Lỗi khởi động camera / tải thư viện QR:", err);
        toast.error("Không thể mở Camera. Vui lòng cấp quyền truy cập camera!");
        setIsScannerOpen(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeInstance && html5QrCodeInstance.isScanning) {
        html5QrCodeInstance.stop().catch((err: any) => console.error("Lỗi clean-up camera:", err));
      }
    };
  }, [isScannerOpen, tbData]);

  // 🟢 DEEP LINK: TỰ ĐỘNG MỞ CHI TIẾT TÀI SẢN KHI TRUY CẬP QUA LINK QR
  useEffect(() => {
    if (tbData.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    if (qrParam) {
      const matchedAsset = tbData.find(tb => String(tb.ma_tai_san).trim().toUpperCase() === qrParam.trim().toUpperCase());
      if (matchedAsset) {
        setViewData(matchedAsset);
        setIsViewModalOpen(true);
        // Xóa tham số qr khỏi URL để tránh tự mở lại khi refresh trang
        const cleanSearch = window.location.search.replace(/[?&]qr=[^&]+/, '').replace(/^&/, '?');
        const newUrl = window.location.origin + window.location.pathname + (cleanSearch === '?' ? '' : cleanSearch);
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [tbData]);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, tbResult, nkResult, nsResult] = await Promise.all([
        apiService.getDonVi(), apiService.getThietBi(), apiService.getNhatKyThietBi(), apiService.getPersonnel().catch(()=>[])
      ]);
      setDonViList(dvResult || []); setTbData(tbResult || []); setNkData(nkResult || []); setNhansuData(nsResult || []);
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu Trang thiết bị.'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[dv.id] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const allowedDonViIds = useAllowedUnits(donViList);

  const filteredTBs = useMemo(() => {
    let result = tbData.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) {
      const validIds = [selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)];
      result = result.filter(item => validIds.includes(item.id_don_vi));
    }
    if (searchTerm) {
      const cleanSearch = stripAccents(searchTerm);
      result = result.filter(item => 
        stripAccents(item.ma_tai_san || '').includes(cleanSearch) || 
        stripAccents(item.ten_thiet_bi || '').includes(cleanSearch) ||
        stripAccents(item.nhom_thiet_bi || '').includes(cleanSearch) ||
        stripAccents(item.vi_tri_bo_tri || '').includes(cleanSearch) ||
        stripAccents(item.tai_san_thuoc || '').includes(cleanSearch)
      );
    }
    return result;
  }, [tbData, searchTerm, selectedUnitFilter, allowedDonViIds, donViList]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Tất cả Đơn vị';
    const unit = donViList.find(d => d.id === selectedUnitFilter);
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViList]);

  // 🟢 LỌC THIẾT BỊ SẮP HẾT HẠN BẢO HÀNH (Cảnh báo trước 30 ngày)
  const expiringEquipments = useMemo(() => {
    const warnings: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredTBs.forEach(tb => {
      if (!tb.han_bao_hanh) return;
      const expDate = new Date(tb.han_bao_hanh);
      if (isNaN(expDate.getTime())) return;
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30 && tb.tinh_trang === 'Đang sử dụng') {
        warnings.push({
          ...tb,
          diffDays,
          dateStr: expDate.toLocaleDateString('vi-VN')
        });
      }
    });
    return warnings.sort((a, b) => a.diffDays - b.diffDays);
  }, [filteredTBs]);



  const { suggestRAM, suggestSSD, suggestHDD, suggestViTri, suggestPhapNhan } = useMemo(() => {
    const getUnique = (arr: any[], field: string) => Array.from(new Set(arr.map(item => item[field]).filter(Boolean))) as string[];
    return {
      suggestRAM: getUnique(tbData, 'ram'),
      suggestSSD: getUnique(tbData, 'ssd'),
      suggestHDD: getUnique(tbData, 'hdd'),
      suggestViTri: getUnique(tbData, 'vi_tri_bo_tri'),
      suggestPhapNhan: getUnique(tbData, 'tai_san_thuoc')
    };
  }, [tbData]);

  // 🟢 LỌC DANH SÁCH NHÂN SỰ THEO ĐƠN VỊ CỦA THIẾT BỊ ĐANG CHỌN
  const suggestHoTen = useMemo(() => {
    if (!selectedTbForNk) return [];
    const unitId = selectedTbForNk.id_don_vi;
    const validIds = [unitId, ...getAllSubordinateIds(unitId, donViList)];
    
    const filteredNs = nhansuData.filter(ns => validIds.includes(ns.id_don_vi));
    return Array.from(new Set(filteredNs.map(item => item.ho_ten).filter(Boolean))) as string[];
  }, [nhansuData, selectedTbForNk, donViList]);

  // Lọc danh sách mã số nhân viên của các nhân sự thuộc đơn vị
  const suggestMsnv = useMemo(() => {
    if (!selectedTbForNk) return [];
    const unitId = selectedTbForNk.id_don_vi;
    const validIds = [unitId, ...getAllSubordinateIds(unitId, donViList)];
    
    const filteredNs = nhansuData.filter(ns => validIds.includes(ns.id_don_vi));
    // Hỗ trợ cả ma_so_nhan_vien hoặc ma_nv
    return Array.from(new Set(filteredNs.map(item => (item as any).ma_so_nhan_vien || (item as any).ma_nv).filter(Boolean))) as string[];
  }, [nhansuData, selectedTbForNk, donViList]);

  const getEquipmentDescription = (item: any) => {
    if (isITEquipment(item.nhom_thiet_bi || '')) {
      const configParts = [item.cpu, item.ram, item.ssd, item.vga, item.man_hinh].filter(Boolean);
      return configParts.length > 0 ? configParts.join(' / ') : (item.mo_ta_dac_diem || '-');
    } else if (isFurniture(item.nhom_thiet_bi || '')) {
      return item.quy_cach_chat_lieu || item.mo_ta_dac_diem || '-';
    } else {
      return item.thong_so_ky_thuat || item.mo_ta_dac_diem || '-';
    }
  };

  // Reset về trang 1 mỗi khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUnitFilter]);

  // TÍNH TOÁN DỮ LIỆU CỦA TRANG HIỆN TẠI (Đã thêm luồng an toàn)
  const totalPages = Math.ceil((filteredTBs?.length || 0) / rowsPerPage);
  
  const currentTableData = useMemo(() => {
    if (!filteredTBs) return [];
    const start = (currentPage - 1) * rowsPerPage;
    return filteredTBs.slice(start, start + rowsPerPage);
  }, [filteredTBs, currentPage, rowsPerPage]);

  // --- XỬ LÝ THIẾT BỊ ---
  const openTbModal = (mode: 'create' | 'update', item?: any) => {
    setTbModalMode(mode);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;

    if (item) { setTbFormData({ ...item }); } 
    else {
      setTbFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), tai_san_thuoc: '', ma_tai_san: '', ten_thiet_bi: '', nhom_thiet_bi: '', 
        so_luong: '1', don_vi_tinh: 'Cái', vi_tri_bo_tri: '', mo_ta_dac_diem: '', quy_cach_chat_lieu: '', thong_so_ky_thuat: '',
        nha_cung_cap: '', ngay_mua: '', gia_mua: '', han_bao_hanh: '', thoi_gian_khau_hao: '', tinh_trang: 'Đang sử dụng', link_hinh_anh: '', link_ho_so: '',
        so_seri: '', cpu: '', ram: '', ssd: '', hdd: '', vga: '', man_hinh: '', phu_kien: ''
      });
    }
    setIsTbModalOpen(true); setError(null);
  };

  // 1. CẬP NHẬT HÀM LƯU TÀI SẢN (THIẾT BỊ)
  const handleTbSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🟢 Thay alert bằng toast.warning
    if (!tbFormData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị quản lý!");
    if (!tbFormData.nhom_thiet_bi) return toast.warning("Vui lòng chọn hoặc nhập Nhóm Thiết bị!");
    
    let finalData = { ...tbFormData };
    if (!isITEquipment(finalData.nhom_thiet_bi)) {
      ['cpu', 'ram', 'ssd', 'hdd', 'vga', 'man_hinh'].forEach(k => finalData[k] = '');
    }
    if (!isFurniture(finalData.nhom_thiet_bi)) finalData.quy_cach_chat_lieu = '';
    
    // 🟢 ĐIỂM FIX: Tự sinh mã ID trước khi ném lên DB nếu là tạo mới
    if (tbModalMode === 'create' && !finalData.id) {
      finalData.id = `TB-${Date.now()}`;
    }

    setSubmitting(true); setError(null);
    try {
      const response = await apiService.save(finalData, tbModalMode, "ts_thiet_bi");
      
      const savedId = response?.id || response?.newId || finalData.id;
      const newTb = { ...finalData, id: savedId };
      
      if (tbModalMode === 'create') setTbData(prev => [newTb, ...prev]);
      else setTbData(prev => prev.map(item => item.id === savedId ? newTb : item));
      
      setIsTbModalOpen(false); 
      // 🟢 Thêm thông báo thành công tại đây (Phân biệt hành động)
      if (tbModalMode === 'create') {
        toast.success("Thêm mới thiết bị thành công!");
      } else {
        toast.success("Cập nhật thông tin thiết bị thành công!");
      }

    } catch (err: any) { 
      setError(err.message); 
      // 🔴 Thêm thông báo lỗi tại đây
      toast.error(err.message || "Đã xảy ra lỗi khi lưu thông tin thiết bị!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleTbChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTbFormData(prev => ({ ...prev, [name]: name === 'gia_mua' ? value.replace(/\D/g, '') : value }));
  };

  const isCustomGroup = tbFormData.nhom_thiet_bi === 'Khác' || (tbFormData.nhom_thiet_bi && !ASSET_GROUPS.includes(tbFormData.nhom_thiet_bi));

  // --- XỬ LÝ NHẬT KÝ ---
  const tbHistory = useMemo(() => {
    if (!selectedTbForNk) return [];
    return nkData.filter(nk => nk.id_ts_thiet_bi === selectedTbForNk.id).sort((a, b) => new Date(b.ngay_ghi_nhan).getTime() - new Date(a.ngay_ghi_nhan).getTime());
  }, [nkData, selectedTbForNk]);

  const viewHistory = useMemo(() => {
    if (!viewData) return [];
    return nkData.filter(nk => nk.id_ts_thiet_bi === viewData.id).sort((a, b) => new Date(b.ngay_ghi_nhan).getTime() - new Date(a.ngay_ghi_nhan).getTime());
  }, [nkData, viewData]);

  const openNkModal = (tb: any) => {
    setSelectedTbForNk(tb); setNkModalMode('create');
    setNkFormData({
      id: '', id_ts_thiet_bi: tb.id, id_don_vi: tb.id_don_vi, ngay_ghi_nhan: new Date().toISOString().split('T')[0], 
      loai_nhat_ky: 'Cấp phát/Thu hồi', chi_phi: '', msnv_nguoi_dung: '', ho_ten_nguoi_dung: '', bp_quan_ly_su_dung: '', 
      tinh_trang_ghi_nhan_thiet_bi: '', hinh_anh_minh_chung: '', ghi_chu_sua_chua_nang_cap: ''
    });
    setIsNkModalOpen(true);
  };

  const editNk = (nk: any) => { setNkModalMode('update'); setNkFormData({ ...nk }); };

  // 2. CẬP NHẬT HÀM LƯU NHẬT KÝ THIẾT BỊ
  const handleNkSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      let finalData = { ...nkFormData };
      if (!['Sửa chữa/Bảo dưỡng', 'Nâng cấp'].includes(finalData.loai_nhat_ky || '')) finalData.chi_phi = '';
      
      // 🟢 ĐIỂM FIX: Tự sinh mã ID trước khi ném lên DB nếu là tạo mới
      if (nkModalMode === 'create' && !finalData.id) {
        finalData.id = `NK-${Date.now()}`;
      }

      const response = await apiService.save(finalData, nkModalMode, "nk_thiet_bi");
      
      const savedId = response?.id || response?.newId || finalData.id;
      const savedLog = { ...finalData, id: savedId };

      if (nkModalMode === 'create') setNkData(prev => [savedLog, ...prev]);
      else setNkData(prev => prev.map(item => item.id === savedId ? savedLog : item));
      
      // Reset form
      setNkModalMode('create');
      setNkFormData({
        id: '', id_ts_thiet_bi: selectedTbForNk?.id || '', id_don_vi: selectedTbForNk?.id_don_vi || '', 
        ngay_ghi_nhan: new Date().toISOString().split('T')[0], loai_nhat_ky: 'Cấp phát/Thu hồi', chi_phi: '', msnv_nguoi_dung: '', ho_ten_nguoi_dung: '', bp_quan_ly_su_dung: '',
        tinh_trang_luu_ghi_nhan_thiet_bi: '', hinh_anh_minh_chung: '', ghi_chu_sua_chua_nang_cap_nang_cap: '', ghi_chu_su_dung: ''
      });
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const handleNkHoTenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    
    const validIds = selectedTbForNk ? [selectedTbForNk.id_don_vi, ...getAllSubordinateIds(selectedTbForNk.id_don_vi, donViList)] : [];
    
    let foundNs = nhansuData.find(ns => ns.ho_ten === name && validIds.includes(ns.id_don_vi));
    
    if (!foundNs) {
      foundNs = nhansuData.find(ns => ns.ho_ten === name);
    }

    if (foundNs) {
      const bp = foundNs.phong_ban || '';
      const dv = donViMap[foundNs.id_don_vi] || '';
      const combined = [bp.trim(), dv.trim()].filter(Boolean).join(' - ');
      setNkFormData((prev: any) => ({ 
        ...prev, 
        ho_ten_nguoi_dung: name, 
        msnv_nguoi_dung: (foundNs as any).ma_so_nhan_vien || (foundNs as any).ma_nv || '', 
        bp_quan_ly_su_dung: combined
      }));
    } else {
      setNkFormData((prev: any) => ({ ...prev, ho_ten_nguoi_dung: name }));
    }
  };

  const handleNkMsnvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const msnv = e.target.value;
    
    // Tìm nhân sự theo msnv (hỗ trợ cả ma_so_nhan_vien hoặc ma_nv)
    let foundNs = nhansuData.find(ns => {
      const code = String((ns as any).ma_so_nhan_vien || (ns as any).ma_nv || '').trim().toUpperCase();
      return code === msnv.trim().toUpperCase();
    });

    if (foundNs) {
      const bp = foundNs.phong_ban || '';
      const dv = donViMap[foundNs.id_don_vi] || '';
      const combined = [bp.trim(), dv.trim()].filter(Boolean).join(' - ');
      setNkFormData((prev: any) => ({ 
        ...prev, 
        msnv_nguoi_dung: msnv, 
        ho_ten_nguoi_dung: foundNs.ho_ten || '', 
        bp_quan_ly_su_dung: combined
      }));
    } else {
      setNkFormData((prev: any) => ({ ...prev, msnv_nguoi_dung: msnv }));
    }
  };

  const handleNkBpChange = (val: string) => {
    setNkFormBp(val);
    const combined = [val.trim(), nkFormDv.trim()].filter(Boolean).join(' - ');
    setNkFormData((prev: any) => ({ ...prev, bp_quan_ly_su_dung: combined }));
  };

  const handleNkDvChange = (val: string) => {
    setNkFormDv(val);
    const combined = [nkFormBp.trim(), val.trim()].filter(Boolean).join(' - ');
    setNkFormData((prev: any) => ({ ...prev, bp_quan_ly_su_dung: combined }));
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return; 
    setSubmitting(true); 
    setError(null);
    
    try {
      if (itemToDelete.type === 'tb') {
        const logsToDelete = nkData.filter(nk => nk.id_ts_thiet_bi === itemToDelete.id);
        if (logsToDelete.length > 0) {
          for (const nk of logsToDelete) {
            if (nk.id) await apiService.delete(nk.id, "nk_thiet_bi");
          }
        }
        await apiService.delete(itemToDelete.id, "ts_thiet_bi");
        setTbData(prev => prev.filter(item => item.id !== itemToDelete.id));
        setNkData(prev => prev.filter(item => item.id_ts_thiet_bi !== itemToDelete.id));
        // 🟢 Thông báo khi xóa Thiết bị thành công
        toast.success("Xóa thiết bị thành công!");
        
      } else {
        await apiService.delete(itemToDelete.id, "nk_thiet_bi");
        setNkData(prev => prev.filter(item => item.id !== itemToDelete.id));
        // 🟢 Thông báo khi xóa Nhật ký bảo dưỡng thành công
        toast.success("Xóa nhật ký bảo dưỡng thành công!");
      }
      
      setIsConfirmOpen(false); 
      setItemToDelete(null); 
      
    } catch (err: any) { 
      setError(err.message); 
      // 🔴 Thông báo lỗi nếu API gặp sự cố
      toast.error(err.message || "Đã xảy ra lỗi khi xóa dữ liệu!");
      
    } finally { 
      setSubmitting(false); 
    }
  };

  if (loading) return <PageWithFilterSkeleton rows={8} />;
  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">
      {/* CỘT TRÁI (BỘ LỌC ĐỒNG BỘ) */}
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
        allUnitsLabel="Tất cả Tài sản / Thiết bị"
      />

      {/* NỘI DUNG CHÍNH */}
      <div className="flex-1 min-w-0 max-w-full overflow-hidden p-4 sm:p-6 relative transition-all duration-300 w-full flex flex-col">
        
        {/* FIXED HEADER & WARNINGS */}
        <div className="shrink-0 flex flex-col z-10">
          <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 ${isListCollapsed ? 'md:pl-10' : ''}`}>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
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
                <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Layers size={28} /> Quản lý Tài sản & Thiết bị</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredTBs.length} khoản mục)</p>
              </div>
            </div>
            <div className="flex flex-wrap w-full sm:w-auto gap-3 justify-end items-center">
              {selectedItemsForPrint.length > 0 && (
                <button 
                  onClick={() => {
                    const items = tbData.filter(tb => selectedItemsForPrint.includes(tb.id));
                    setPrintItemsList(items);
                    setIsPrintModalOpen(true);
                  }} 
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap animate-in fade-in zoom-in duration-200"
                >
                  <Printer className="w-5 h-5" /> In {selectedItemsForPrint.length} nhãn
                </button>
              )}
              <button 
                onClick={() => setIsScannerOpen(true)} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"
                title="Quét mã QR qua Camera"
              >
                <Camera className="w-5 h-5" /> Quét QR
              </button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Tìm Mã, Tên, Pháp nhân, Vị trí..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05469B] outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <button onClick={() => openTbModal('create')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#05469B] hover:bg-[#04367a] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all whitespace-nowrap"><Plus className="w-5 h-5" /> Thêm Tài sản</button>
            </div>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

          {/* 🟢 THANH CẢNH BÁO HẠN BẢO HÀNH (ĐỒNG BỘ VỚI DASHBOARD) */}
          {expiringEquipments.length > 0 && !isDismissed && (
            <div className={`mb-6 transition-all duration-300 ${isListCollapsed ? 'md:ml-10' : ''}`}>
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
                
                {/* HEADER - BẤM ĐỂ MỞ RỘNG/THU GỌN */}
                <div className="flex justify-between items-center p-3 sm:p-4">
                  
                  {/* Khối bấm mở rộng/thu gọn danh sách */}
                  <div 
                    className="flex items-center gap-2 text-red-700 cursor-pointer flex-1"
                    onClick={() => setIsWarningOpen(!isWarningOpen)}
                  >
                    <AlertCircle size={18} className={expiringEquipments.some(i => i.diffDays < 0) ? "animate-pulse shrink-0" : "shrink-0"} />
                    <h3 className="font-bold text-sm">
                      {expiringEquipments.length} thiết bị sắp / đã hết hạn bảo hành
                    </h3>
                  </div>

                  {/* 🟢 KHỐI NÚT THAO TÁC Ở GÓC PHẢI (CHUẨN ĐỒNG BỘ) */}
                  <div className="flex items-center gap-2 text-gray-400 shrink-0">
                    <button 
                      onClick={() => setIsWarningOpen(!isWarningOpen)}
                      className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Xem chi tiết"
                    >
                      {isWarningOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    
                    <div className="w-px h-4 bg-gray-300"></div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDismissed(true);
                      }}
                      className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Đóng cảnh báo"
                    >
                      <X size={16} />
                    </button>
                  </div>

                </div>

                {/* DANH SÁCH CHI TIẾT KHI MỞ RỘNG */}
                {isWarningOpen && (
                  <div className="border-t border-red-100 bg-white">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {expiringEquipments.map((tb, idx) => (
                            <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                              <td className="p-3 w-28">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tb.diffDays < 0 ? 'bg-red-100 text-red-700 border-red-200' : tb.diffDays === 0 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                  {tb.diffDays < 0 ? 'QUÁ HẠN' : tb.diffDays === 0 ? 'HÔM NAY' : 'SẮP HẾT HẠN'}
                                </span>
                              </td>
                              <td className="p-3 font-semibold text-gray-800">
                                <span className="text-[#05469B] font-bold">{tb.name}</span>
                                <span className="text-gray-400 mx-1.5">—</span>
                                <span className="text-xs text-gray-500 font-mono">[{tb.code}]</span>
                              </td>
                              <td className="p-3 text-gray-600 text-xs w-48">
                                {tb.unitName}
                              </td>
                              <td className="p-3 text-right font-bold text-gray-700 text-xs w-32">
                                {tb.dateStr}
                                {tb.diffDays > 0 && <span className="block text-[10px] font-normal text-gray-500 mt-0.5">Còn {tb.diffDays} ngày</span>}
                                {tb.diffDays < 0 && <span className="block text-[10px] font-normal text-red-500 mt-0.5">Trễ {Math.abs(tb.diffDays)} ngày</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BẢNG DỮ LIỆU CHÍNH */}
        <div className={`flex flex-col flex-1 min-h-0 gap-4 transition-all duration-300 ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
          
          {/* BẢNG DỮ LIỆU PC */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 w-full flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 bg-[#f8fafc] z-10">
                <tr className="bg-[#f8fafc] border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={currentTableData.length > 0 && currentTableData.every(item => selectedItemsForPrint.includes(item.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelected = [...selectedItemsForPrint];
                          currentTableData.forEach(item => {
                            if (!newSelected.includes(item.id)) newSelected.push(item.id);
                          });
                          setSelectedItemsForPrint(newSelected);
                        } else {
                          setSelectedItemsForPrint(selectedItemsForPrint.filter(id => !currentTableData.some(item => item.id === id)));
                        }
                      }}
                      className="w-4 h-4 text-[#05469B] border-gray-300 rounded focus:ring-[#05469B] cursor-pointer"
                    />
                  </th>
                  <th className="p-4 w-32">Mã / Nhóm</th>
                  <th className="p-4 w-56">Tên Tài sản / Thiết bị</th>
                  <th className="p-4 w-32">Vị trí &amp; SL</th>
                  <th className="p-4 w-40">Đơn Vị / Pháp Nhân</th>
                  <th className="p-4">Thông số / Mô tả</th>
                  <th className="p-4 w-32">Tình trạng</th>
                  <th className="p-4 text-center w-36">Thao tác</th> 
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (<tr><td colSpan={8} className="p-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#05469B]" />Đang tải...</td></tr>) : filteredTBs.length === 0 ? (<tr><td colSpan={8} className="p-16 text-center text-gray-500"><Package size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-lg font-medium">Không có tài sản nào hiển thị.</p></td></tr>) : (
                  currentTableData.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="p-4 align-top text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedItemsForPrint.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemsForPrint([...selectedItemsForPrint, item.id]);
                            } else {
                              setSelectedItemsForPrint(selectedItemsForPrint.filter(id => id !== item.id));
                            }
                          }}
                          className="w-4 h-4 text-[#05469B] border-gray-300 rounded focus:ring-[#05469B] cursor-pointer mt-1"
                        />
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-black text-[#05469B] text-[13px] whitespace-nowrap mb-1">🏷️ {item.ma_tai_san || 'Chưa cấp mã'}</div>
                        <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100">{item.nhom_thiet_bi || 'Khác'}</span>
                      </td>
                      <td className="p-4 align-top font-bold text-gray-800 text-sm">{item.ten_thiet_bi}</td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="font-bold text-gray-700 flex items-center gap-1"><MapPin size={12} className="text-orange-500"/> {item.vi_tri_bo_tri || 'Chưa rõ'}</span>
                          <span className="text-gray-500 font-medium">SL: <b className="text-[#05469B]">{item.so_luong || 1}</b> {item.don_vi_tinh || 'Cái'}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <p className="text-xs font-bold text-gray-700">{donViMap[item.id_don_vi] || '-'}</p>
                        {item.tai_san_thuoc && <p className="text-[10px] text-gray-500 font-medium mt-1 uppercase" title="Pháp nhân sở hữu">{item.tai_san_thuoc}</p>}
                      </td>
                      <td className="p-4 align-top">
                        <p className="text-[11px] text-gray-600 font-medium line-clamp-3 leading-relaxed" title={getEquipmentDescription(item)}>
                          {getEquipmentDescription(item)}
                        </p>
                      </td>
                      <td className="p-4 align-top">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap border 
                          ${item.tinh_trang === 'Đang sử dụng' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                            item.tinh_trang === 'Lưu kho - Chờ sử dụng' ? 'bg-blue-50 text-blue-600 border-blue-200' : 
                            item.tinh_trang === 'Lưu kho - Chờ thanh lý' ? 'bg-gray-100 text-gray-600 border-gray-300' : 
                            item.tinh_trang === 'Đang sửa chữa' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          {item.tinh_trang || 'Đang sử dụng'}
                        </span>
                      </td>
                      <td className="p-4 align-top w-36">
                        <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-full max-w-[120px] mx-auto">
                          <button onClick={() => openNkModal(item)} className="w-full py-1 bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 rounded text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm"><History size={13} /> Nhật ký</button>
                          <div className="grid grid-cols-4 gap-1">
                            <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="py-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded flex items-center justify-center shadow-sm" title="Xem chi tiết"><Eye size={13} /></button>
                            <button onClick={() => openTbModal('update', item)} className="py-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center shadow-sm" title="Sửa"><Edit size={13} /></button>
                            <button onClick={() => { setPrintItemsList([item]); setIsPrintModalOpen(true); }} className="py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded flex items-center justify-center shadow-sm" title="In nhãn tem QR"><QrCode size={13} /></button>
                            <button onClick={() => { setItemToDelete({id: item.id, type: 'tb'}); setIsConfirmOpen(true); }} className="py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded flex items-center justify-center shadow-sm" title="Xóa"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 🟢 VIEW TRÊN MOBILE: THẺ CARD DỌC */}
          <div className="block md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
            {filteredTBs.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 italic">Không có tài sản nào hiển thị.</div>
            ) : (
              currentTableData.map((item) => (
                <div 
                  key={item.id}
                  className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative flex flex-col gap-3 transition-all"
                >
                  {/* Header: Mã & Nhóm & Tên */}
                  <div className="pb-2.5 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={selectedItemsForPrint.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemsForPrint([...selectedItemsForPrint, item.id]);
                            } else {
                              setSelectedItemsForPrint(selectedItemsForPrint.filter(id => id !== item.id));
                            }
                          }}
                          className="w-4 h-4 text-[#05469B] border-gray-300 rounded focus:ring-[#05469B] cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-400 font-mono">🏷️ {item.ma_tai_san || 'Chưa cấp mã'}</span>
                      </div>
                      <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold border border-indigo-100">{item.nhom_thiet_bi || 'Khác'}</span>
                    </div>
                    <h4 className="font-extrabold text-[#05469B] text-sm leading-snug">{item.ten_thiet_bi}</h4>
                  </div>

                  {/* Body: Details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Vị trí &amp; SL</p>
                      <p className="font-bold text-gray-700 flex items-center gap-1 mt-0.5"><MapPin size={11} className="text-orange-500"/> {item.vi_tri_bo_tri || 'Chưa rõ'}</p>
                      <p className="text-[10px] font-medium text-gray-500 mt-0.5">SL: <b className="text-[#05469B]">{item.so_luong || 1}</b> {item.don_vi_tinh || 'Cái'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Tình trạng</p>
                      <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border 
                        ${item.tinh_trang === 'Đang sử dụng' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                          item.tinh_trang === 'Lưu kho - Chờ sử dụng' ? 'bg-blue-50 text-blue-600 border-blue-200' : 
                          item.tinh_trang === 'Lưu kho - Chờ thanh lý' ? 'bg-gray-100 text-gray-600 border-gray-300' : 
                          item.tinh_trang === 'Đang sửa chữa' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {item.tinh_trang || 'Đang sử dụng'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Đơn vị quản lý</p>
                      <p className="font-bold text-gray-700 mt-0.5 text-xs">{donViMap[item.id_don_vi] || '-'}</p>
                      {item.tai_san_thuoc && <p className="text-[9px] text-gray-400 font-medium uppercase mt-0.5">{item.tai_san_thuoc}</p>}
                    </div>
                    {getEquipmentDescription(item) && (
                      <div className="col-span-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Thông số / Mô tả</p>
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed line-clamp-3">{getEquipmentDescription(item)}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer: Actions */}
                  <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t border-gray-100 mt-1">
                    <button onClick={() => openNkModal(item)} className="py-1.5 px-2 bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs" title="Xem nhật ký lịch sử thiết bị"><History size={13} /> Lịch sử</button>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setViewData(item); setIsViewModalOpen(true); }} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xem chi tiết"><Eye size={13} /> Xem</button>
                      <button onClick={() => openTbModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit size={13} /> Sửa</button>
                      <button onClick={() => { setPrintItemsList([item]); setIsPrintModalOpen(true); }} className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="In nhãn tem QR"><QrCode size={13} /></button>
                      <button onClick={() => { setItemToDelete({id: item.id, type: 'tb'}); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(rows) => {
                setRowsPerPage(rows);
                setCurrentPage(1);
              }}
              totalRows={filteredTBs.length}
              itemName="tài sản"
            />
          </div>

        </div>
      </div>

      {/* --- DATALISTS --- */}
      <datalist id="suggest-ram">{suggestRAM.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-ssd">{suggestSSD.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-hdd">{suggestHDD.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-vitri">{suggestViTri.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-phapnhan">{suggestPhapNhan.map(v => <option key={v} value={v} />)}</datalist>

      {/* --- MODAL QUÉT MÃ QR CAMERA --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-[#05469B] flex items-center gap-2">
                <Camera size={20} /> Quét Mã QR Tài sản
              </h3>
              <button 
                onClick={() => setIsScannerOpen(false)} 
                className="text-gray-400 hover:text-red-500 rounded-full p-1 bg-white border border-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center bg-gray-950 text-white min-h-[320px]">
              <div id="reader" className="w-full max-w-sm overflow-hidden rounded-lg border-2 border-[#05469B] bg-black"></div>
              <p className="text-xs text-gray-400 mt-4 text-center">Vui lòng căn chỉnh mã QR nằm chính giữa khung ngắm của Camera.</p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsScannerOpen(false)} 
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-bold transition-all shadow-xs"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL IN TEM NHÃN TÀI SẢN --- */}
      {isPrintModalOpen && printItemsList.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[90vh] sm:max-w-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-[#05469B] flex items-center gap-2">
                <Printer size={20} /> Xem trước & In Nhãn Tài Sản ({printItemsList.length} cái)
              </h3>
              <button 
                onClick={() => setIsPrintModalOpen(false)} 
                className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white border border-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Preview Area */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-100 flex flex-col items-center gap-6 custom-scrollbar">
              
              <div className="text-center text-xs text-gray-500 max-w-md">
                Mẫu tem nhãn được thiết kế chuẩn kích thước **50mm x 20mm** để in trên giấy nhãn. Nhấp nút **In nhãn** phía dưới để thực hiện in.
              </div>

              {/* Tem nhãn được bọc trong một container để in */}
              <div id="print-area" className="flex flex-col gap-6 items-center w-full">
                {printItemsList.map((item, index) => {
                  const unit = donViList.find(u => u.id === item.id_don_vi);
                  const unitName = unit ? unit.ten_don_vi : 'THACO AUTO';
                  const userDetail = getLatestUser(item.id);
                  const ownerStr = userDetail.msnv !== '---' 
                    ? `${userDetail.msnv} - ${userDetail.name}` 
                    : userDetail.name;
                  
                  // Tạo link URL cho mã QR dạng rút gọn giúp mật độ QR thưa hơn, dễ quét hơn
                  const qrUrl = `${window.location.origin}/${item.ma_tai_san}`;

                  return (
                    <div 
                      key={item.id} 
                      className="relative bg-white border border-gray-300 p-2 select-none shadow-xs rounded flex flex-row items-stretch overflow-hidden box-border print:border-black print:shadow-none"
                      style={{
                        width: '50mm',
                        height: '20mm',
                        minWidth: '50mm',
                        minHeight: '20mm',
                        maxWidth: '50mm',
                        maxHeight: '20mm',
                        pageBreakAfter: index < printItemsList.length - 1 ? 'always' : 'auto'
                      }}
                    >
                      {/* Cột trái: Đơn vị và QR Code */}
                      <div className="w-[38%] flex flex-col items-center justify-between border-r border-dashed border-gray-200 pr-1.5 shrink-0 print:border-black">
                        <span 
                          className="text-[6.5px] font-black text-gray-800 uppercase tracking-tight text-center leading-none truncate w-full"
                          title={unitName}
                        >
                          {unitName}
                        </span>
                        <div className="flex-1 flex items-center justify-center p-0.5 mt-0.5 overflow-hidden">
                          <QRCodeSVG 
                            value={qrUrl}
                            size={46}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#000000"
                            includeMargin={false}
                          />
                        </div>
                      </div>

                      {/* Cột phải: 5 dòng thông tin */}
                      <div className="flex-1 flex flex-col justify-between pl-1.5 min-w-0 py-0.5 text-left font-sans text-black">
                        {/* Dòng 1: Mã tài sản */}
                        <div className="text-[7.5px] font-extrabold truncate leading-tight uppercase text-blue-900 print:text-black">
                          MS: {item.ma_tai_san || 'CHƯA CẤP MÃ'}
                        </div>
                        {/* Dòng 2: Tên tài sản */}
                        <div className="text-[7px] font-bold truncate leading-tight text-gray-900 print:text-black">
                          {item.ten_thiet_bi}
                        </div>
                        {/* Dòng 3: Nhóm */}
                        <div className="text-[6.5px] font-semibold text-gray-500 truncate leading-none mt-0.5 print:text-black">
                          Nhóm: {item.nhom_thiet_bi || 'Khác'}
                        </div>
                        {/* Dòng 4: Số Seri */}
                        <div className="text-[6.5px] font-medium text-gray-500 truncate leading-none mt-0.5 print:text-black">
                          S/N: {item.so_seri || '---'}
                        </div>
                        {/* Dòng 5: MSNV - Tên CB-NV */}
                        <div className="text-[6px] font-bold text-gray-800 truncate leading-none mt-0.5 print:text-black">
                          SD: {ownerStr}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
              <div className="text-xs text-gray-500">
                * Nhấn phím `Ctrl + P` hoặc nút **In nhãn** để in.
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPrintModalOpen(false)} 
                  className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-bold shadow-xs transition-colors"
                >
                  Đóng
                </button>
                <button 
                  onClick={() => {
                    // Tạo một stylesheet in tạm thời
                    const style = document.createElement('style');
                    style.innerHTML = `
                      @media print {
                        body * {
                          visibility: hidden;
                        }
                        #print-area, #print-area * {
                          visibility: visible;
                        }
                        #print-area {
                          position: absolute;
                          left: 0;
                          top: 0;
                          width: 50mm;
                          margin: 0;
                          padding: 0;
                          display: flex !important;
                          flex-direction: column !important;
                          gap: 0 !important;
                        }
                        #print-area > div {
                          margin: 0 !important;
                          border: none !important;
                          box-shadow: none !important;
                        }
                      }
                    `;
                    document.head.appendChild(style);
                    window.print();
                    // Dọn dẹp sau khi in
                    setTimeout(() => {
                      document.head.removeChild(style);
                    }, 1000);
                  }} 
                  className="px-6 py-2.5 bg-[#05469B] hover:bg-[#04367a] text-white rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2"
                >
                  <Printer size={16} /> In Nhãn
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL THÊM/SỬA TÀI SẢN --- */}
      {isTbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2"><Package size={24}/> {tbModalMode === 'create' ? 'Thêm Mới Tài Sản / Thiết Bị' : 'Cập nhật Dữ liệu Tài sản'}</h3>
              <button onClick={() => setIsTbModalOpen(false)} disabled={submitting} className="text-gray-400 hover:text-red-500 rounded-full p-1.5 bg-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleTbSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
              
              {/* KHỐI 1: THÔNG TIN CƠ BẢN (FLEX ROW LAYOUT NÂNG CAO) */}
              <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                <h4 className="font-bold text-[#05469B] mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-[#05469B] rounded-full"></div> 1. Thông tin Chung</h4>
                <div className="flex flex-col gap-4">
                  
                  {/* Dòng 1: Đơn vị (25%) - Pháp nhân (50%) - Mã TS (25%) */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-1/4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị quản lý *</label>
                      <select required name="id_don_vi" value={tbFormData.id_don_vi || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]" style={{ fontFamily: 'monospace, sans-serif' }}>
                        <option value="">-- Chọn đơn vị --</option>
                        {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (<option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>))}
                      </select>
                    </div>
                    <div className="w-full md:w-2/4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tài sản thuộc Pháp nhân (Công ty)</label>
                      <input list="suggest-phapnhan" type="text" name="tai_san_thuoc" value={tbFormData.tai_san_thuoc || ''} onChange={handleTbChange} placeholder="VD: Công ty TNHH MTV..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-[#05469B]" />
                    </div>
                    <div className="w-full md:w-1/4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mã Tài Sản</label>
                      <input type="text" name="ma_tai_san" value={tbFormData.ma_tai_san || ''} onChange={handleTbChange} placeholder="VD: SR-BAN-01" className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold tracking-wider" />
                    </div>
                  </div>

                  {/* Dòng 2: Nhóm TS SMART DROPDOWN - Tên - SL - ĐVT - Tình trạng */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-[20%] relative">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nhóm Thiết bị *</label>
                      {isCustomGroup ? (
                        <div className="relative">
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Nhập tên nhóm..." 
                            name="nhom_thiet_bi" 
                            value={tbFormData.nhom_thiet_bi === 'Khác' ? '' : (tbFormData.nhom_thiet_bi || '')} 
                            onChange={handleTbChange} 
                            className="w-full p-2.5 pr-8 border border-indigo-300 rounded-lg bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-800" 
                          />
                          <button type="button" onClick={() => setTbFormData({...tbFormData, nhom_thiet_bi: ASSET_GROUPS[0]})} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-white rounded-full p-0.5 shadow-sm" title="Hủy nhập tay"><X size={14}/></button>
                        </div>
                      ) : (
                        <select 
                          required 
                          name="nhom_thiet_bi" 
                          value={tbFormData.nhom_thiet_bi || ''} 
                          onChange={(e) => setTbFormData({...tbFormData, nhom_thiet_bi: e.target.value})} 
                          className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-indigo-700"
                        >
                          <option value="" disabled>-- Chọn Nhóm --</option>
                          {ASSET_GROUPS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          <option value="Khác">➕ Khác (Tự nhập...)</option>
                        </select>
                      )}
                    </div>
                    <div className="w-full md:w-[35%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tên Tài sản / Thiết bị *</label>
                      <input type="text" required name="ten_thiet_bi" value={tbFormData.ten_thiet_bi || ''} onChange={handleTbChange} placeholder="VD: Bàn họp lễ tân, Laptop Dell..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-lg" />
                    </div>
                    <div className="w-full md:w-[10%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Số lượng *</label>
                      <input type="number" required min="1" name="so_luong" value={tbFormData.so_luong || '1'} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-center text-xl" />
                    </div>
                    <div className="w-full md:w-[10%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị tính *</label>
                      <input type="text" required name="don_vi_tinh" value={tbFormData.don_vi_tinh || 'Cái'} onChange={handleTbChange} placeholder="Cái, Bộ..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B] text-center" />
                    </div>
                    <div className="w-full md:w-[25%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tình trạng *</label>
                      <select required name="tinh_trang" value={tbFormData.tinh_trang || 'Đang sử dụng'} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold">
                        <option value="Đang sử dụng">Đang sử dụng</option>
                        <option value="Lưu kho - Chờ sử dụng">Lưu kho - Chờ sử dụng</option>
                        <option value="Lưu kho - Chờ thanh lý">Lưu kho - Chờ thanh lý</option>
                        <option value="Đang sửa chữa">Đang sửa chữa</option>
                        <option value="Đã thanh lý / Hỏng hóc">Đã thanh lý / Hỏng hóc</option>
                      </select>
                    </div>
                  </div>

                  {/* Dòng 3: Vị trí (40%) - Mô tả (30%) - Link ảnh (30%) */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-[40%]">
                      <label className="block text-xs font-bold text-orange-600 mb-1">Vị trí bố trí (Phòng ban/Khu vực)</label>
                      <input list="suggest-vitri" type="text" name="vi_tri_bo_tri" value={tbFormData.vi_tri_bo_tri || ''} onChange={handleTbChange} placeholder="VD: Quầy Lễ tân, Sảnh..." className="w-full p-2.5 border border-orange-200 rounded-lg bg-orange-50 outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
                    </div>
                    <div className="w-full md:w-[30%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả đặc điểm / Ghi chú</label>
                      <input type="text" name="mo_ta_dac_diem" value={tbFormData.mo_ta_dac_diem || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B]" placeholder="Màu sắc, tình trạng..."/>
                    </div>
                    <div className="w-full md:w-[30%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Link Ảnh tài sản thực tế</label>
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="url" name="link_hinh_anh" value={tbFormData.link_hinh_anh || ''} onChange={handleTbChange} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 text-sm" placeholder="Dán link Drive..." />
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

              {/* KHỐI 2: CẤU HÌNH ĐỘNG DỰA TRÊN NHÓM TÀI SẢN */}
              {isITEquipment(tbFormData.nhom_thiet_bi || '') ? (
                // 2A. FORM DÀNH CHO THIẾT BỊ IT
                <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 animate-in fade-in zoom-in duration-200">
                  <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Cpu size={18}/> 2. Chi tiết Cấu hình IT</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Số Seri (S/N)</label><input type="text" name="so_seri" value={tbFormData.so_seri || ''} onChange={handleTbChange} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">CPU</label><input type="text" name="cpu" value={tbFormData.cpu || ''} onChange={handleTbChange} placeholder="Core i5, i7..." className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">RAM</label><input list="suggest-ram" type="text" name="ram" value={tbFormData.ram || ''} onChange={handleTbChange} placeholder="8GB, 16GB..." className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Card VGA</label><input type="text" name="vga" value={tbFormData.vga || ''} onChange={handleTbChange} className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Ổ cứng SSD</label><input list="suggest-ssd" type="text" name="ssd" value={tbFormData.ssd || ''} onChange={handleTbChange} placeholder="256GB, 512GB..." className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Ổ cứng HDD</label><input list="suggest-hdd" type="text" name="hdd" value={tbFormData.hdd || ''} onChange={handleTbChange} placeholder="1TB..." className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Màn hình</label><input type="text" name="man_hinh" value={tbFormData.man_hinh || ''} onChange={handleTbChange} placeholder="15.6 inch..." className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Phụ kiện đi kèm</label><input type="text" name="phu_kien" value={tbFormData.phu_kien || ''} onChange={handleTbChange} placeholder="Chuột, sạc..." className="w-full p-2.5 border border-emerald-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  </div>
                </div>
              ) : isFurniture(tbFormData.nhom_thiet_bi || '') ? (
                // 2B. FORM DÀNH CHO NỘI THẤT (BÀN GHẾ TỦ KỆ)
                <div className="bg-amber-50/40 p-5 rounded-xl border border-amber-100 animate-in fade-in zoom-in duration-200">
                  <h4 className="font-bold text-amber-800 mb-4 flex items-center gap-2"><Sofa size={18}/> 2. Thuộc tính Nội thất</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className="block text-xs font-bold text-amber-800 mb-1">Kích thước / Chất liệu (Quy cách)</label><textarea name="quy_cach_chat_lieu" value={tbFormData.quy_cach_chat_lieu || ''} onChange={handleTbChange} rows={2} placeholder="VD: Bàn gỗ MDF 1m2 x 0.6m, chân sắt..." className="w-full p-2.5 border border-amber-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 resize-none font-medium"></textarea></div>
                    <div><label className="block text-xs font-bold text-amber-800 mb-1">Ghi chú bổ sung</label><textarea name="phu_kien" value={tbFormData.phu_kien || ''} onChange={handleTbChange} rows={2} placeholder="VD: Kèm 1 hộc tủ di động..." className="w-full p-2.5 border border-amber-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 resize-none"></textarea></div>
                  </div>
                </div>
              ) : (
                // 2C. FORM DÀNH CHO THIẾT BỊ CHUNG (CAMERA, POS, TIVI...)
                <div className="bg-purple-50/40 p-5 rounded-xl border border-purple-100 animate-in fade-in zoom-in duration-200">
                  <h4 className="font-bold text-purple-800 mb-4 flex items-center gap-2"><Video size={18}/> 2. Thông số Thiết bị khác</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div><label className="block text-xs font-bold text-purple-800 mb-1">Số Seri (Nếu có)</label><input type="text" name="so_seri" value={tbFormData.so_seri || ''} onChange={handleTbChange} className="w-full p-2.5 border border-purple-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 font-bold" /></div>
                    <div className="md:col-span-2"><label className="block text-xs font-bold text-purple-800 mb-1">Thông số kỹ thuật chung</label><textarea name="thong_so_ky_thuat" value={tbFormData.thong_so_ky_thuat || ''} onChange={handleTbChange} rows={2} placeholder="VD: Tivi 55 Inch 4K, Camera góc rộng 120 độ..." className="w-full p-2.5 border border-purple-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 resize-none font-medium"></textarea></div>
                  </div>
                </div>
              )}

              {/* KHỐI 3: KẾ TOÁN & HỒ SƠ (FLEX ROW LAYOUT) */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> 3. Hồ sơ Mua sắm & Kế toán</h4>
                <div className="flex flex-col gap-4">
                  
                  {/* Dòng 1: NCC (50%) - Ngày mua (25%) - Hạn BH (25%) */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-2/4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nhà cung cấp</label>
                      <input type="text" name="nha_cung_cap" value={tbFormData.nha_cung_cap || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div className="w-full md:w-1/4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ngày mua</label>
                      <input type="date" name="ngay_mua" value={tbFormData.ngay_mua || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div className="w-full md:w-1/4">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hạn bảo hành</label>
                      <input type="date" name="han_bao_hanh" value={tbFormData.han_bao_hanh || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                  </div>

                  {/* Dòng 2: Đơn giá (30%) - Khấu hao (20%) - Link hồ sơ (50%) */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-[30%]">
                      <label className="block text-xs font-bold text-red-600 mb-1">Đơn giá (VNĐ)</label>
                      <input 
                        type="text" 
                        name="gia_mua" 
                        value={hasRule('TB_HIDE_PRICE') ? '***' : formatCurrency(tbFormData.gia_mua)} 
                        onChange={(e) => {
                          if (hasRule('TB_HIDE_PRICE')) return;
                          handleTbChange(e);
                        }} 
                        disabled={hasRule('TB_HIDE_PRICE')}
                        className={`w-full p-2.5 border border-red-200 rounded-lg bg-red-50 text-red-700 outline-none focus:ring-2 focus:ring-red-500 font-bold ${hasRule('TB_HIDE_PRICE') ? 'opacity-60 cursor-not-allowed bg-gray-50 text-gray-500 border-gray-200' : ''}`} 
                      />
                    </div>
                    <div className="w-full md:w-[20%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Khấu hao (Tháng)</label>
                      <input type="number" name="thoi_gian_khau_hao" value={tbFormData.thoi_gian_khau_hao || ''} onChange={handleTbChange} placeholder="VD: 36" className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B]" />
                    </div>
                    <div className="w-full md:w-[50%]">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Link Hồ sơ (BB Bàn giao, Phiếu xuất kho, Hợp đồng...)</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="url" name="link_ho_so" value={tbFormData.link_ho_so || ''} onChange={handleTbChange} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] text-blue-600 text-sm" placeholder="Dán link thư mục Drive..." />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              </div>
              
              {/* FOOTER */}
              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
                <button type="button" onClick={() => setIsTbModalOpen(false)} className="px-8 py-3 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-sm">Hủy</button>
                <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-[#05469B] hover:bg-[#04367a] rounded-xl font-bold flex gap-2 shadow-lg transition-colors">
                  {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} Lưu Tài Sản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL NHẬT KÝ (GIAO NHẬN & SỬA CHỮA) --- */}
      {isNkModalOpen && selectedTbForNk && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsNkModalOpen(false)}></div>
          <div className="bg-white shadow-2xl w-full max-w-md md:max-w-xl h-full flex flex-col animate-in slide-in-from-right relative z-10">
            <div className="p-5 border-b bg-purple-600 text-white flex justify-between shrink-0">
              <div><h3 className="text-xl font-black flex items-center gap-2 mb-1"><History size={20}/> Nhật ký Giao nhận & Sửa chữa</h3><p className="text-[11px] font-bold uppercase text-purple-100">{selectedTbForNk.ma_tai_san || 'Chưa cấp mã'} | {selectedTbForNk.ten_thiet_bi}</p></div>
              <button onClick={() => setIsNkModalOpen(false)} className="bg-purple-700/50 p-2 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col custom-scrollbar">
              <form onSubmit={handleNkSave} className="p-5 bg-white border-b shadow-sm space-y-4 z-10 shrink-0">
                <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-gray-800 text-sm uppercase flex items-center gap-1.5"><Calendar size={16} className="text-purple-600"/> Khai báo nhật ký mới</h4>{nkModalMode === 'update' && <button type="button" onClick={() => {setNkModalMode('create'); setNkFormData({id: '', id_ts_thiet_bi: selectedTbForNk.id, id_don_vi: selectedTbForNk.id_don_vi, ngay_ghi_nhan: new Date().toISOString().split('T')[0], loai_nhat_ky: 'Cấp phát/Thu hồi', chi_phi: '', msnv_nguoi_dung: '', ho_ten_nguoi_dung: '', bp_quan_ly_su_dung: '', tinh_trang_ghi_nhan_thiet_bi: '', hinh_anh_minh_chung: '', ghi_chu_sua_chua_nang_cap: ''})}} className="text-xs font-bold text-purple-600 flex items-center"><Plus size={14}/> Thêm mới</button>}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Ngày ghi nhận *</label><input type="date" required name="ngay_ghi_nhan" value={nkFormData.ngay_ghi_nhan || ''} onChange={(e)=>setNkFormData((prev: any)=>({...prev, ngay_ghi_nhan: e.target.value}))} className="w-full p-2 border rounded-lg bg-[#FFFFF0] font-bold text-purple-900" /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Loại sự kiện *</label><select required name="loai_nhat_ky" value={nkFormData.loai_nhat_ky || 'Cấp phát/Thu hồi'} onChange={(e)=>setNkFormData((prev: any)=>({...prev, loai_nhat_ky: e.target.value}))} className="w-full p-2 border rounded-lg bg-[#FFFFF0] font-bold text-indigo-700"><option value="Cấp phát/Thu hồi">Cấp phát / Thu hồi</option><option value="Sửa chữa/Bảo dưỡng">Sửa chữa / Bảo dưỡng</option><option value="Nâng cấp">Nâng cấp</option><option value="Kiểm kê">Kiểm kê</option><option value="Báo hỏng">Báo hỏng / Báo mất</option></select></div>
                  
                  <div className="col-span-2 flex flex-row gap-3">
                    <div className="w-[35%] shrink-0">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Mã số NV *</label>
                      <CustomAutocomplete
                        name="msnv_nguoi_dung"
                        value={nkFormData.msnv_nguoi_dung || ''}
                        onChange={handleNkMsnvChange}
                        suggestions={suggestMsnv}
                        placeholder="Mã số NV..."
                        className="w-full p-2 border border-purple-200 rounded-lg bg-[#FFFFF0] font-mono text-center"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Họ và tên *</label>
                      <input 
                        type="text" 
                        name="ho_ten_nguoi_dung" 
                        value={nkFormData.ho_ten_nguoi_dung || ''} 
                        onChange={(e)=>setNkFormData((prev: any)=>({...prev, ho_ten_nguoi_dung: e.target.value}))} 
                        placeholder="Tên nhân sự..." 
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white font-bold" 
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-row gap-3">
                    <div className="w-1/2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Bộ phận</label>
                      <input 
                        type="text" 
                        value={nkFormBp} 
                        onChange={(e)=>handleNkBpChange(e.target.value)} 
                        placeholder="Bộ phận..." 
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white" 
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Đơn vị</label>
                      <input 
                        type="text" 
                        value={nkFormDv} 
                        onChange={(e)=>handleNkDvChange(e.target.value)} 
                        placeholder="Đơn vị..." 
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white" 
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-2 bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                    <label className="block text-xs font-bold text-orange-800 mb-1">Tình trạng tài sản lúc ghi nhận</label>
                    <input type="text" name="tinh_trang_ghi_nhan_thiet_bi" value={nkFormData.tinh_trang_ghi_nhan_thiet_bi || ''} onChange={(e)=>setNkFormData((prev: any)=>({...prev, tinh_trang_ghi_nhan_thiet_bi: e.target.value}))} className="w-full p-2 border border-orange-200 rounded outline-none focus:border-orange-500 mb-2" placeholder="VD: Mới 100%, Xước mặt bàn..." />
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Link Ảnh minh chứng (Nếu có)</label>
                    <div className="relative"><ImageIcon size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/><input type="url" name="hinh_anh_minh_chung" value={nkFormData.hinh_anh_minh_chung || ''} onChange={(e)=>setNkFormData((prev: any)=>({...prev, hinh_anh_minh_chung: e.target.value}))} className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500" placeholder="Link ảnh..." /></div>
                  </div>

                  {['Sửa chữa/Bảo dưỡng', 'Nâng cấp'].includes(nkFormData.loai_nhat_ky || '') && (
                    <div className="col-span-2 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-xs font-bold text-red-600 mb-1">Chi phí thực hiện (VNĐ)</label>
                      <input type="text" name="chi_phi" value={formatCurrency(nkFormData.chi_phi)} onChange={(e)=>setNkFormData((prev: any)=>({...prev, chi_phi: e.target.value.replace(/\D/g,'')}))} placeholder="Nhập số tiền..." className="w-full p-2 border border-red-200 rounded-lg bg-red-50 focus:bg-white font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  )}
                  
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Ghi chú Hành động (Nâng cấp gì, sửa gì...)</label><textarea name="ghi_chu_sua_chua_nang_cap" value={nkFormData.ghi_chu_sua_chua_nang_cap || ''} onChange={(e)=>setNkFormData((prev: any)=>({...prev, ghi_chu_sua_chua_nang_cap: e.target.value}))} rows={2} className="w-full p-2 border rounded-lg resize-none"></textarea></div>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 transition-colors text-white font-bold rounded-lg flex justify-center gap-2 shadow-md">{submitting ? <Loader2 className="animate-spin" /> : <Save />} Lưu Lịch Sử</button>
              </form>

              {/* TIMELINE LỊCH SỬ */}
              <div className="p-5 flex-1 relative">
                <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-4">Dòng thời gian ({tbHistory.length} Sự kiện)</h4>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-purple-200 before:to-transparent">
                  {tbHistory.map((nk, idx) => {
                    const logId = nk.id || `log-${idx}`;
                    return (
                    <div key={logId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-purple-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10"><Calendar size={16}/></div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${nk.loai_nhat_ky === 'Cấp phát/Thu hồi' ? 'bg-blue-100 text-blue-700' : nk.loai_nhat_ky === 'Báo hỏng' ? 'bg-red-100 text-red-700 animate-pulse' : nk.loai_nhat_ky === 'Sửa chữa/Bảo dưỡng' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{nk.loai_nhat_ky}</span>
                          <span className="text-xs font-bold text-gray-400">{new Date(nk.ngay_ghi_nhan).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 mt-2">{nk.ho_ten_nguoi_dung || 'Không có tên'}</p>
                        <p className="text-[10px] text-gray-500 mb-2">{nk.bp_quan_ly_su_dung || 'Không có bộ phận'}</p>
                        
                        {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-[11px] font-bold text-orange-700 mb-1 border-l-2 border-orange-400 pl-2">Tình trạng: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                        {nk.hinh_anh_minh_chung && <a href={nk.hinh_anh_minh_chung} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mb-2 hover:underline"><ImageIcon size={12}/> Xem ảnh minh chứng</a>}

                        {nk.chi_phi && Number(nk.chi_phi) > 0 && (
                          <p className="text-xs text-red-600 bg-red-50 p-1.5 rounded mb-1 font-bold border border-red-100">Chi phí: {formatCurrency(nk.chi_phi)} VNĐ</p>
                        )}
                        {nk.ghi_chu_sua_chua_nang_cap && <p className="text-xs text-orange-700 bg-orange-50 p-1.5 rounded mb-1 border border-orange-100">Ghi chú: {nk.ghi_chu_sua_chua_nang_cap}</p>}
                        {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">Khác: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                        <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => editNk(nk)} className="text-xs font-bold text-blue-600 hover:underline">Sửa</button>
                          <button onClick={() => {setItemToDelete({id: nk.id, type: 'nk'}); setIsConfirmOpen(true);}} className="text-xs font-bold text-red-600 hover:underline">Xóa</button>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL XEM CHI TIẾT --- */}
      {isViewModalOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 overflow-hidden mt-auto sm:mt-0">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-3xl sm:rounded-t-2xl shrink-0"><h3 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Layers size={24}/> Chi tiết Tài sản / Thiết bị</h3><button onClick={() => setIsViewModalOpen(false)} className="text-blue-200 hover:text-white p-1 rounded-full"><X size={24}/></button></div>
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 border-b border-gray-100 pb-6 mb-6">
                <div className="w-20 h-20 bg-blue-50 text-[#05469B] rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner shrink-0">
                  {isITEquipment(viewData.nhom_thiet_bi||'') ? <MonitorSmartphone size={40}/> : isFurniture(viewData.nhom_thiet_bi||'') ? <Sofa size={40}/> : <Package size={40}/>}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight">{viewData.ma_tai_san || 'Không mã'}</h2>
                  <p className="text-base sm:text-lg font-bold text-[#05469B] mt-1">{viewData.ten_thiet_bi}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">{viewData.nhom_thiet_bi}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${viewData.tinh_trang === 'Đang sử dụng' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{viewData.tinh_trang}</span>
                    <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-bold">SL: {viewData.so_luong||1} {viewData.don_vi_tinh||'Cái'}</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold flex items-center gap-1"><MapPin size={12}/> {viewData.vi_tri_bo_tri || 'Chưa rõ'}</span>
                  </div>
                  
                  {(viewData.link_hinh_anh || viewData.link_ho_so) && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      {viewData.link_hinh_anh && (<a href={viewData.link_hinh_anh} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"><ImageIcon size={14}/> Xem Ảnh Thực tế</a>)}
                      {viewData.link_ho_so && (<a href={viewData.link_ho_so} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors border border-gray-300"><FileText size={14}/> Hồ sơ / Biên bản</a>)}
                    </div>
                  )}
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Đơn vị quản lý</p>
                  <p className="text-lg font-black text-gray-800">{donViMap[viewData.id_don_vi] || '-'}</p>
                  {viewData.tai_san_thuoc && <p className="text-[11px] font-bold text-gray-500 mt-1 uppercase">Pháp nhân: {viewData.tai_san_thuoc}</p>}
                </div>
              </div>
              
              {/* CẤU HÌNH ĐỘNG */}
              {isITEquipment(viewData.nhom_thiet_bi || '') ? (
                <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 mb-6">
                  <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Cpu size={18}/> Thông số Cấu hình IT</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">S/N</p><p className="font-bold text-gray-800">{viewData.so_seri || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">CPU</p><p className="font-bold text-gray-800">{viewData.cpu || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">RAM</p><p className="font-bold text-gray-800">{viewData.ram || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">VGA</p><p className="font-bold text-gray-800">{viewData.vga || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">SSD</p><p className="font-bold text-gray-800">{viewData.ssd || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">HDD</p><p className="font-bold text-gray-800">{viewData.hdd || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">Màn hình</p><p className="font-bold text-gray-800">{viewData.man_hinh || '-'}</p></div>
                    <div><p className="text-xs text-emerald-600 font-bold mb-1">Phụ kiện</p><p className="font-bold text-gray-800">{viewData.phu_kien || '-'}</p></div>
                  </div>
                </div>
              ) : isFurniture(viewData.nhom_thiet_bi || '') ? (
                <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 mb-6">
                  <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Sofa size={18}/> Quy cách Nội thất</h4>
                  <p className="font-medium text-gray-800 whitespace-pre-wrap">{viewData.quy_cach_chat_lieu || 'Chưa cập nhật thông tin.'}</p>
                </div>
              ) : (
                <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 mb-6">
                  <h4 className="font-bold text-purple-800 mb-4 flex items-center gap-2"><Camera size={18}/> Thông số Kỹ thuật & Seri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><p className="text-xs text-purple-600 font-bold mb-1">Số Seri</p><p className="font-bold text-gray-800">{viewData.so_seri || '-'}</p></div>
                    <div className="md:col-span-2"><p className="text-xs text-purple-600 font-bold mb-1">Cấu hình / Thông số</p><p className="font-medium text-gray-800 whitespace-pre-wrap">{viewData.thong_so_ky_thuat || '-'}</p></div>
                  </div>
                </div>
              )}

              {/* LƯU KHO KẾ TOÁN */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6">
                <div><p className="text-xs text-gray-500 font-bold mb-1">Ngày mua</p><p className="font-semibold text-gray-800">{viewData.ngay_mua ? new Date(viewData.ngay_mua).toLocaleDateString('vi-VN') : '-'}</p></div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Hạn bảo hành</p>{viewData.han_bao_hanh ? (<ExpiryBadge dateStr={viewData.han_bao_hanh} label="Hạn BH" warningDays={30} />) : (<p className="font-semibold text-gray-800">-</p>)}</div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">Nguyên giá</p>
                  <p className="font-bold text-red-600">
                    {hasRule('TB_HIDE_PRICE') ? '***' : `${formatCurrency(viewData.gia_mua)} đ`}
                  </p>
                </div>
                <div><p className="text-xs text-gray-500 font-bold mb-1">Nhà cung cấp</p><p className="font-semibold text-gray-800">{viewData.nha_cung_cap || '-'}</p></div>
                <div className="md:col-span-4"><p className="text-xs text-gray-500 font-bold mb-1">Mô tả ngoại hình / Ghi chú</p><p className="font-medium text-gray-700 bg-white p-2 rounded border border-gray-100">{viewData.mo_ta_dac_diem || '-'}</p></div>
              </div>

              {/* TIMELINE */}
              <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 mt-6 relative">
                <h4 className="font-bold text-purple-800 mb-6 flex items-center gap-2"><History size={18}/> Lịch sử Sử dụng & Sửa chữa</h4>
                {viewHistory.length === 0 ? (<p className="text-sm text-gray-500 italic text-center py-4">Chưa có dữ liệu nhật ký nào.</p>) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-purple-200 before:via-purple-200 before:to-transparent">
                    {viewHistory.map((nk, idx) => {
                      const logId = nk.id || `view-${idx}`;
                      return (
                      <div key={logId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-purple-400 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10"><Calendar size={16}/></div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${nk.loai_nhat_ky === 'Cấp phát/Thu hồi' ? 'bg-blue-100 text-blue-700' : nk.loai_nhat_ky === 'Báo hỏng' ? 'bg-red-100 text-red-700 animate-pulse' : nk.loai_nhat_ky === 'Sửa chữa/Bảo dưỡng' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{nk.loai_nhat_ky}</span>
                            <span className="text-xs font-bold text-gray-400">{new Date(nk.ngay_ghi_nhan).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-800 mt-2">{nk.ho_ten_nguoi_dung || 'Không có tên'}</p>
                          <p className="text-[10px] text-gray-500 mb-2">{nk.bp_quan_ly_su_dung || 'Không có bộ phận'}</p>
                          
                          {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-[11px] font-bold text-orange-700 mb-1 border-l-2 border-orange-400 pl-2">Tình trạng: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                          {nk.hinh_anh_minh_chung && <a href={nk.hinh_anh_minh_chung} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mb-2 hover:underline"><ImageIcon size={12}/> Xem ảnh minh chứng</a>}

                          {nk.chi_phi && Number(nk.chi_phi) > 0 && (<p className="text-xs text-red-600 bg-red-50 p-1.5 rounded mb-1 font-bold border border-red-100">Chi phí: {formatCurrency(nk.chi_phi)} VNĐ</p>)}
                          {nk.ghi_chu_sua_chua_nang_cap && <p className="text-xs text-orange-700 bg-orange-50 p-1.5 rounded mb-1 border border-orange-100">Ghi chú: {nk.ghi_chu_sua_chua_nang_cap}</p>}
                          {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">Khác: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 rounded-b-3xl sm:rounded-b-2xl flex justify-end shrink-0"><button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors">Đóng</button></div>
          </div>
        </div>
      )}

      {/* XÁC NHẬN XÓA */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa dữ liệu vĩnh viễn.</p>
            <div className="flex gap-3"><button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button><button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex justify-center gap-2 shadow-md">{submitting ? <Loader2 className="animate-spin" /> : <Trash2 />} Xóa</button></div>
          </div>
        </div>
      )}
    </div>
  );
}