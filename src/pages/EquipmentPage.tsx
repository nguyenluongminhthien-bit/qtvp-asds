import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Edit, Trash2, X, AlertCircle, Loader2, Save,
  MonitorSmartphone, Building2, MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  History, Calendar, Info, Eye, Cpu, Image as ImageIcon, FileText, Link as LinkIcon,
  Sofa, Video, Package, Layers, Camera, QrCode, Printer, ClipboardPaste, ShieldCheck, BarChart3,
  RotateCcw, Sparkles, PlusCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { DonVi, ThietBi, NhatKyThietBi, Personnel, NhaCungCap } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { buildHierarchicalOptions, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getAllSubordinateIds, getDefaultUnitId } from '../utils/hierarchy';
import { formatCurrency, toUnaccented, stripAccents, cleanTechnicalString, formatMemorySize } from '../utils/formatters';
import { toast } from '../utils/toast';
import { PageWithFilterSkeleton } from '../components/SkeletonLoader';
import ExpiryBadge from '../components/ExpiryBadge';
import ExpiryAlert from '../components/ExpiryAlert';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import CustomAutocomplete from '../components/ui/CustomAutocomplete';
import SegmentTabs from '../components/ui/SegmentTabs';
import { motion } from 'motion/react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import PasteImportModal, { ColumnMapItem } from '../components/ui/PasteImportModal';


// --- DANH SÁCH NHÓM TÀI SẢN CHUẨN ---
const ASSET_GROUPS = [
  "Thiết bị CNTT",
  "Trang thiết bị VP",
  "Nội thất VP",
  "Điện máy",
  "Hệ thống kỹ thuật",
  "Phần mềm & Bản quyền",
  "Công cụ dụng cụ",
  "Vật dụng khác"
];

const NHOM_THIETBI_INFO: Record<string, { title: string; items: string[] }> = {
  "Thiết bị CNTT": {
    title: "Thiết bị CNTT",
    items: ["PC", "Laptop", "Màn hình máy tính", "Máy chủ (Server)", "Switch/Router mạng", "Ổ cứng di động", "Webcam"]
  },
  "Trang thiết bị VP": {
    title: "Trang thiết bị Văn phòng",
    items: ["Máy in", "Máy photocopy", "Máy scan", "Máy chấm công", "Máy hủy tài liệu", "Máy fax", "Máy đếm tiền"]
  },
  "Nội thất VP": {
    title: "Nội thất Văn phòng",
    items: ["Bàn làm việc", "Ghế văn phòng", "Tủ hồ sơ", "Kệ tài liệu", "Vách ngăn", "Bàn họp", "Ghế sofa tiếp khách"]
  },
  "Điện máy": {
    title: "Điện máy & Điện lạnh",
    items: ["Tivi", "Máy lạnh (điều hòa)", "Tủ lạnh", "Máy nước nóng lạnh", "Quạt", "Lò vi sóng", "Bình đun nước"]
  },
  "Hệ thống kỹ thuật": {
    title: "Hệ thống kỹ thuật hạ tầng",
    items: ["Camera an ninh", "Hệ thống mạng nội bộ", "Hệ thống PCCC", "Hệ thống điện", "Thang máy", "Máy phát điện", "Hệ thống âm thanh"]
  },
  "Phần mềm & Bản quyền": {
    title: "Phần mềm & Bản quyền",
    items: ["Bản quyền Windows/Office", "Phần mềm kế toán", "Phần mềm diệt virus", "License phần mềm thiết kế/quản lý"]
  },
  "Công cụ dụng cụ": {
    title: "Công cụ dụng cụ",
    items: ["Xe đẩy hàng", "Máy tuần tra", "Dụng cụ sửa chữa", "Bộ đồ nghề điện", "Thang", "Máy hút bụi"]
  },
  "Vật dụng khác": {
    title: "Vật dụng khác",
    items: ["Vật dụng trang trí", "Bình chữa cháy mini", "Thảm", "Rèm cửa", "Vật dụng chưa phân loại"]
  }
};

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

const mapNhomThietBiToNhomDichVu = (nhomThietBi: string): string[] => {
  if (!nhomThietBi) return [];
  switch (nhomThietBi) {
    case "Thiết bị CNTT":
      return ["Thiết bị CNTT & Văn phòng", "Viễn thông", "Khác"];
    case "Trang thiết bị VP":
      return ["Thiết bị CNTT & Văn phòng", "Văn phòng phẩm & Ấn vật phẩm", "Tạp phẩm", "Khác"];
    case "Nội thất VP":
      return ["Trang trí VP, quầy lễ tân", "Công cụ dụng cụ", "Sửa chữa, bảo trì", "Khác"];
    case "Điện máy":
      return ["Thiết bị CNTT & Văn phòng", "Công cụ dụng cụ", "Sửa chữa, bảo trì", "Khác"];
    case "Hệ thống kỹ thuật":
      return ["An ninh - Bảo vệ", "Viễn thông", "Thiết bị CNTT & Văn phòng", "Sửa chữa, bảo trì", "Đào tạo, Chứng nhận & Kiểm định", "Khác"];
    case "Phần mềm & Bản quyền":
      return ["Thiết bị CNTT & Văn phòng", "Viễn thông", "Khác"];
    case "Công cụ dụng cụ":
      return ["Công cụ dụng cụ", "Tạp phẩm", "Sửa chữa, bảo trì", "Khác"];
    case "Vật dụng khác":
      return ["Khác", "Văn phòng phẩm & Ấn vật phẩm", "Tạp phẩm", "Trang trí VP, quầy lễ tân", "Tiếp khách (Phòng chờ KH)", "Công cụ dụng cụ", "Sửa chữa, bảo trì"];
    default:
      return ["Khác", "Thiết bị CNTT & Văn phòng", "Công cụ dụng cụ", "Sửa chữa, bảo trì"];
  }
};

const calculateWarrantyExpiry = (ngayMua: string, soThang: number): string => {
  if (!ngayMua) return '';
  const date = new Date(ngayMua);
  if (isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + soThang);
  return date.toISOString().split('T')[0];
};

const calculateWarrantyMonths = (ngayMua: string, hanBh: string): number => {
  if (!ngayMua || !hanBh) return 0;
  const start = new Date(ngayMua);
  const end = new Date(hanBh);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return diffMonths > 0 ? diffMonths : 0;
};

export default function EquipmentPage() {
  const { user, canCreate, canUpdate, canDelete, hasRule } = useAuth();
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [tbData, setTbData] = useState<any[]>([]);
  const [nkData, setNkData] = useState<any[]>([]);
  const [nhansuData, setNhansuData] = useState<Personnel[]>([]);
  const [nccList, setNccList] = useState<NhaCungCap[]>([]);
  const [phapNhanList, setPhapNhanList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [detailTypeFilter, setDetailTypeFilter] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // 🟢 STATE PHÂN TRANG (PAGINATION)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  // 🟢 Reset về trang 1 mỗi khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUnitFilter, detailTypeFilter]);

  // Modals Thiết bị
  const [isTbModalOpen, setIsTbModalOpen] = useState(false);
  const [tbModalMode, setTbModalMode] = useState<'create' | 'update'>('create');
  const [tbFormData, setTbFormData] = useState<any>({});
  const [showAllNccGroups, setShowAllNccGroups] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [showNhomTBTooltip, setShowNhomTBTooltip] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

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
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'tb' | 'nk' } | null>(null);
  // Trạng thái mở/đóng thanh cảnh báo Hạn bảo hành
  const [isWarningOpen, setIsWarningOpen] = useState(true);

  // 🟢 THÊM DÒNG NÀY: Trạng thái ẩn hoàn toàn thông báo
  const [isDismissed, setIsDismissed] = useState(false);

  // 🟢 STATE CHO DASHBOARD THỐNG KÊ CHI TIẾT
  const [isStatsDashboardOpen, setIsStatsDashboardOpen] = useState(false);
  const [statsActiveTab, setStatsActiveTab] = useState<'type' | 'status' | 'location' | 'supplier' | 'value'>('type');

  // State chuyển đổi Tab chính & Phân tích báo cáo động
  const [activeMainTab, setActiveMainTab] = useState<'list' | 'report'>('list');
  const [reportDimension, setReportDimension] = useState<'location' | 'department' | 'type' | 'supplier'>('location');
  const [drillDownValue, setDrillDownValue] = useState<string | null>(null);



  // 🟢 STATE PHỤC VỤ TÍNH NĂNG QR CODE & IN TEM NHÃN
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedItemsForPrint, setSelectedItemsForPrint] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printItemsList, setPrintItemsList] = useState<any[]>([]);
  const [qrMultipleMatches, setQrMultipleMatches] = useState<any[]>([]);
  const [isQrMatchesModalOpen, setIsQrMatchesModalOpen] = useState(false);
  const [nkReceivingUnit, setNkReceivingUnit] = useState<string>('');
  const [isCrossUnitSearch, setIsCrossUnitSearch] = useState<boolean>(false);

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

    const cleanCode = assetCode.trim().toUpperCase();

    // 1. Tìm theo số seri trước
    const matchedBySeri = tbData.find(tb => tb.so_seri && String(tb.so_seri).trim().toUpperCase() === cleanCode);
    if (matchedBySeri) {
      setViewData(matchedBySeri);
      setIsViewModalOpen(true);
      toast.success(`Đã tìm thấy tài sản theo Số seri: ${matchedBySeri.ten_thiet_bi}`);
    } else {
      // 2. Nếu không khớp Số seri, tìm theo Mã tài sản
      const matchedAssets = tbData.filter(tb => String(tb.ma_tai_san).trim().toUpperCase() === cleanCode);
      if (matchedAssets.length === 1) {
        setViewData(matchedAssets[0]);
        setIsViewModalOpen(true);
        toast.success(`Đã tìm thấy tài sản: ${matchedAssets[0].ten_thiet_bi}`);
      } else if (matchedAssets.length > 1) {
        setQrMultipleMatches(matchedAssets);
        setIsScannerOpen(false); // Đóng camera quét
        setIsQrMatchesModalOpen(true); // Mở modal chọn
        toast.info(`Tìm thấy ${matchedAssets.length} thiết bị dùng chung mã tài sản.`);
      } else {
        toast.error(`Không tìm thấy tài sản nào khớp với mã hoặc số seri "${cleanCode}"!`);
      }
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

  // 🟢 Hàm phụ trợ đầy đủ thông tin bàn giao sử dụng cho gom nhóm phòng ban
  const getLatestUserFull = (itemId: string) => {
    const logs = nkData.filter(log => log.id_ts_thiet_bi === itemId);
    if (logs.length === 0) return { name: 'Chưa bàn giao', msnv: '---', department: 'Chưa bàn giao' };

    const sorted = [...logs].sort((a, b) => String(b.ngay_ghi_nhan || '').localeCompare(String(a.ngay_ghi_nhan || '')));
    const latestUserLog = sorted.find(log => log.ho_ten_nguoi_dung);
    if (latestUserLog) {
      return {
        name: latestUserLog.ho_ten_nguoi_dung,
        msnv: latestUserLog.msnv_nguoi_dung || '---',
        department: latestUserLog.bp_quan_ly_su_dung || 'Chưa rõ'
      };
    }
    return { name: 'Chưa bàn giao', msnv: '---', department: 'Chưa bàn giao' };
  };

  // 🟢 Hàm phân tích chi tiết cấu hình phần cứng IT
  const getITConfigStats = (items: any[]) => {
    const cpuStats: Record<string, number> = {};
    const ramStats: Record<string, number> = {};
    const storageStats: Record<string, number> = {};
    const vgaStats: Record<string, number> = {};

    items.forEach(item => {
      if (!item.cpu && !item.ram && !item.man_hinh && !item.ssd && !item.hdd) return;

      // CPU
      const cpuVal = String(item.cpu || '').trim();
      if (cpuVal) {
        let simplifiedCpu = 'Khác';
        const lowerCpu = cpuVal.toLowerCase();
        if (lowerCpu.includes('i7')) simplifiedCpu = 'Intel Core i7';
        else if (lowerCpu.includes('i5')) simplifiedCpu = 'Intel Core i5';
        else if (lowerCpu.includes('i3')) simplifiedCpu = 'Intel Core i3';
        else if (lowerCpu.includes('i9')) simplifiedCpu = 'Intel Core i9';
        else if (lowerCpu.includes('ryzen 7')) simplifiedCpu = 'AMD Ryzen 7';
        else if (lowerCpu.includes('ryzen 5')) simplifiedCpu = 'AMD Ryzen 5';
        else if (lowerCpu.includes('ryzen 3')) simplifiedCpu = 'AMD Ryzen 3';
        else if (lowerCpu.includes('apple m')) {
          const match = cpuVal.match(/apple m[1234]\s*(pro|max)?/i);
          simplifiedCpu = match ? match[0].toUpperCase() : 'Apple Silicon';
        } else {
          simplifiedCpu = cpuVal;
        }
        cpuStats[simplifiedCpu] = (cpuStats[simplifiedCpu] || 0) + 1;
      }

      // RAM
      const ramVal = String(item.ram || '').trim();
      if (ramVal) {
        const cleanRam = ramVal.toUpperCase().replace(/\s+/g, '');
        ramStats[cleanRam] = (ramStats[cleanRam] || 0) + 1;
      }

      // Storage
      const ssdVal = String(item.ssd || '').trim();
      const hddVal = String(item.hdd || '').trim();
      if (ssdVal) {
        const cleanSsd = 'SSD ' + ssdVal.toUpperCase().replace(/\s+/g, '');
        storageStats[cleanSsd] = (storageStats[cleanSsd] || 0) + 1;
      }
      if (hddVal) {
        const cleanHdd = 'HDD ' + hddVal.toUpperCase().replace(/\s+/g, '');
        storageStats[cleanHdd] = (storageStats[cleanHdd] || 0) + 1;
      }

      // VGA
      const vgaVal = String(item.vga || '').trim();
      if (vgaVal) {
        let simplifiedVga = 'Card rời';
        const lowerVga = vgaVal.toLowerCase();
        if (lowerVga.includes('onboard') || lowerVga.includes('intel hd') || lowerVga.includes('iris') || lowerVga.includes('share') || lowerVga.includes('tích hợp')) {
          simplifiedVga = 'Card tích hợp (Onboard)';
        } else if (lowerVga.includes('nvidia') || lowerVga.includes('rtx') || lowerVga.includes('gtx') || lowerVga.includes('geforce') || lowerVga.includes('amd radeon') || lowerVga.includes('rx ')) {
          simplifiedVga = 'Card rời (NVIDIA/AMD)';
        } else {
          simplifiedVga = vgaVal;
        }
        vgaStats[simplifiedVga] = (vgaStats[simplifiedVga] || 0) + 1;
      }
    });

    return {
      cpu: Object.entries(cpuStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      ram: Object.entries(ramStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      storage: Object.entries(storageStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      vga: Object.entries(vgaStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    };
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
          () => { }
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
      const code = qrParam.trim().toUpperCase();

      // 1. Tìm theo số seri trước
      const matchedBySeri = tbData.find(tb => tb.so_seri && String(tb.so_seri).trim().toUpperCase() === code);
      if (matchedBySeri) {
        setViewData(matchedBySeri);
        setIsViewModalOpen(true);
        toast.success(`Đã tìm thấy tài sản theo Số seri: ${matchedBySeri.ten_thiet_bi}`);
      } else {
        // 2. Nếu không khớp Số seri, tìm theo Mã tài sản
        const matchedAssets = tbData.filter(tb => String(tb.ma_tai_san).trim().toUpperCase() === code);
        if (matchedAssets.length === 1) {
          setViewData(matchedAssets[0]);
          setIsViewModalOpen(true);
          toast.success(`Đã tìm thấy tài sản: ${matchedAssets[0].ten_thiet_bi}`);
        } else if (matchedAssets.length > 1) {
          setQrMultipleMatches(matchedAssets);
          setIsQrMatchesModalOpen(true);
          toast.info(`Tìm thấy ${matchedAssets.length} thiết bị dùng chung mã tài sản.`);
        } else {
          toast.error(`Không tìm thấy tài sản nào khớp với mã hoặc số seri "${qrParam}"!`);
        }
      }

      // Xóa tham số qr khỏi URL để tránh tự mở lại khi refresh trang
      const cleanSearch = window.location.search.replace(/[?&]qr=[^&]+/, '').replace(/^&/, '?');
      const newUrl = window.location.origin + window.location.pathname + (cleanSearch === '?' ? '' : cleanSearch);
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [tbData]);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [dvResult, tbResult, nkResult, nsResult, nccResult, pnResult] = await Promise.all([
        apiService.getDonVi(),
        apiService.getThietBi(),
        apiService.getNhatKyThietBi(),
        apiService.getPersonnel().catch(() => []),
        apiService.getNhaCungCap().catch(() => []),
        apiService.getPhapNhan().catch(() => [])
      ]);
      setDonViList(dvResult || []);
      setTbData(tbResult || []);
      setNkData(nkResult || []);
      setNhansuData(nsResult || []);
      setNccList(nccResult || []);
      setPhapNhanList(pnResult || []);
    } catch (err: any) { setError(err.message || 'Lỗi tải dữ liệu Trang thiết bị.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (viewData) {
      apiService.writeLog(
        'XEM THIẾT BỊ',
        `Tên thiết bị: ${viewData.ten_thiet_bi || ''} | Nhóm: ${viewData.nhom_thiet_bi || ''} | Mã định danh: ${viewData.ma_dinh_danh || ''}`
      );
    }
  }, [viewData]);

  // Lắng nghe click ra ngoài để tự động đóng Dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setIsAddDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(dv => { map[dv.id] = dv.ten_don_vi; });
    return map;
  }, [donViList]);

  const allowedDonViIds = useAllowedUnits(donViList);

  const displayedNccList = useMemo(() => {
    if (showAllNccGroups || !tbFormData.nhom_thiet_bi) return nccList;
    const allowedDichVuGroups = mapNhomThietBiToNhomDichVu(tbFormData.nhom_thiet_bi);
    return nccList.filter(ncc =>
      allowedDichVuGroups.includes(ncc.nhom_dich_vu) ||
      ncc.id === tbFormData.id_ncc
    );
  }, [nccList, showAllNccGroups, tbFormData.nhom_thiet_bi, tbFormData.id_ncc]);

  // 🟢 LỌC DANH SÁCH PHÁP NHÂN GỢI Ý THEO ĐƠN VỊ QUẢN LÝ ĐANG CHỌN (HỖ TRỢ CẢ ĐƠN VỊ CON & ĐƠN VỊ MẸ, HỖ TRỢ PHẨY ID_DON_VI)
  const suggestPhapNhanOptions = useMemo(() => {
    if (!tbFormData.id_don_vi) {
      const allNames = phapNhanList.map(pn => (pn.ten_cong_ty || pn.ten_phap_nhan || '').trim()).filter(Boolean);
      return Array.from(new Set(allNames)) as string[];
    }

    const targetId = String(tbFormData.id_don_vi).trim();
    const subIds = getAllSubordinateIds(targetId, donViList);

    // Lấy thêm các ID đơn vị cấp cha/mẹ để đảm bảo lấy được Pháp nhân được gán ở cấp tổng
    const ancestorIds: string[] = [];
    let currUnit = donViList.find(u => String(u.id).trim() === targetId);
    const visited = new Set<string>();
    while (currUnit && currUnit.cap_quan_ly && !visited.has(currUnit.id)) {
      visited.add(currUnit.id);
      const parentId = String(currUnit.cap_quan_ly).trim();
      if (parentId && parentId !== 'HO') {
        ancestorIds.push(parentId);
        currUnit = donViList.find(u => String(u.id).trim() === parentId);
      } else {
        break;
      }
    }

    const validUnitIds = new Set([targetId, ...subIds, ...ancestorIds]);

    // 1. Lọc dm_phap_nhan thỏa mãn nếu bất kỳ ID nào trong chuỗi phẩy id_don_vi khớp với validUnitIds
    const matchedPns = phapNhanList.filter(pn => {
      const pnUnitIds = String(pn.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
      return pnUnitIds.some(id => validUnitIds.has(id));
    });
    let matchedNames = matchedPns.map(pn => (pn.ten_cong_ty || pn.ten_phap_nhan || '').trim()).filter(Boolean);

    // 2. Dự phòng: Nếu dm_phap_nhan chưa được gán cho đơn vị này, lấy tên Pháp nhân từng dùng trong tbData
    if (matchedNames.length === 0) {
      const existingNames = tbData
        .filter(tb => validUnitIds.has(String(tb.id_don_vi).trim()) && tb.tai_san_thuoc)
        .map(tb => String(tb.tai_san_thuoc).trim());
      matchedNames = Array.from(new Set(existingNames)).filter(Boolean);
    }

    // 3. Dự phòng cấp 2: Nếu vẫn không tìm thấy, trả về toàn bộ Pháp nhân để không bị bỏ trống danh sách chọn
    if (matchedNames.length === 0) {
      matchedNames = phapNhanList.map(pn => (pn.ten_cong_ty || pn.ten_phap_nhan || '').trim()).filter(Boolean);
    }

    return Array.from(new Set(matchedNames)) as string[];
  }, [tbFormData.id_don_vi, phapNhanList, donViList, tbData]);

  // 🟢 TỰ ĐỘNG ĐIỀN HOẶC CẬP NHẬT PHÁP NHÂN KHI ĐỔI ĐƠN VỊ QUẢN LÝ
  useEffect(() => {
    if (!isTbModalOpen || !tbFormData.id_don_vi) return;
    if (suggestPhapNhanOptions.length === 1) {
      if (tbFormData.tai_san_thuoc !== suggestPhapNhanOptions[0]) {
        setTbFormData((prev: any) => ({ ...prev, tai_san_thuoc: suggestPhapNhanOptions[0] }));
      }
    } else if (suggestPhapNhanOptions.length > 1 && tbFormData.tai_san_thuoc) {
      if (!suggestPhapNhanOptions.includes(tbFormData.tai_san_thuoc) && !tbFormData.is_custom_phap_nhan) {
        setTbFormData((prev: any) => ({ ...prev, tai_san_thuoc: suggestPhapNhanOptions[0] || '' }));
      }
    }
  }, [tbFormData.id_don_vi, suggestPhapNhanOptions, isTbModalOpen]);

  const hasInitializedRef = useRef(false);

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

  // Lấy danh sách các Phân loại chi tiết duy nhất trong tập dữ liệu hiện tại để hiển thị ở dropdown lọc
  const uniqueDetailTypes = useMemo(() => {
    let temp = tbData.filter(item => allowedDonViIds.includes(item.id_don_vi));
    if (selectedUnitFilter) {
      const validIds = [selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)];
      temp = temp.filter(item => validIds.includes(item.id_don_vi));
    }
    if (searchTerm) {
      const cleanSearch = stripAccents(searchTerm);
      temp = temp.filter(item =>
        stripAccents(item.ma_tai_san || '').includes(cleanSearch) ||
        stripAccents(item.ten_thiet_bi || '').includes(cleanSearch) ||
        stripAccents(item.nhom_thiet_bi || '').includes(cleanSearch) ||
        stripAccents(item.vi_tri_bo_tri || '').includes(cleanSearch) ||
        stripAccents(item.tai_san_thuoc || '').includes(cleanSearch)
      );
    }
    const types = temp.map(item => item.quy_cach_chat_lieu || 'Chưa phân loại').filter(Boolean);
    return Array.from(new Set(types)).sort() as string[];
  }, [tbData, searchTerm, selectedUnitFilter, allowedDonViIds, donViList]);

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
    if (detailTypeFilter) {
      result = result.filter(item => (item.quy_cach_chat_lieu || 'Chưa phân loại') === detailTypeFilter);
    }
    return result;
  }, [tbData, searchTerm, selectedUnitFilter, detailTypeFilter, allowedDonViIds, donViList]);

  const equipmentTabs = useMemo(() => [
    { id: 'list', label: 'Danh mục TTB/Tài sản', icon: <Package size={18} />, count: filteredTBs.length },
    { id: 'report', label: 'Thống kê', icon: <BarChart3 size={18} /> }
  ], [filteredTBs.length]);

  // 🟢 TÍNH TOÁN THỐNG KÊ CHI TIẾT ĐỘNG THEO DỮ LIỆU ĐÃ LỌC
  const statsSummary = useMemo(() => {
    let totalQty = 0;
    let totalVal = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let minPriceName = '';
    let maxPriceName = '';

    const detailCounts: Record<string, { count: number; value: number }> = {};
    const statusCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};
    const supplierCounts: Record<string, number> = {};

    filteredTBs.forEach(tb => {
      const qty = Number(tb.so_luong) || 1;
      const price = Number(tb.gia_mua) || 0;
      const subtotal = price * qty;

      totalQty += qty;
      totalVal += subtotal;

      if (price > 0) {
        if (price < minPrice) {
          minPrice = price;
          minPriceName = tb.ten_thiet_bi;
        }
        if (price > maxPrice) {
          maxPrice = price;
          maxPriceName = tb.ten_thiet_bi;
        }
      }

      // 1. Theo phân loại chi tiết (được lưu ở quy_cach_chat_lieu)
      const detailType = tb.quy_cach_chat_lieu || 'Chưa phân loại';
      if (!detailCounts[detailType]) {
        detailCounts[detailType] = { count: 0, value: 0 };
      }
      detailCounts[detailType].count += qty;
      detailCounts[detailType].value += subtotal;

      // 2. Theo tình trạng sử dụng
      const status = tb.tinh_trang || 'Chưa rõ';
      statusCounts[status] = (statusCounts[status] || 0) + qty;

      // 3. Theo vị trí
      const loc = tb.vi_tri_bo_tri || 'Chưa rõ';
      locationCounts[loc] = (locationCounts[loc] || 0) + qty;

      // 4. Theo nhà cung cấp
      const ncc = tb.nha_cung_cap || 'Chưa rõ';
      supplierCounts[ncc] = (supplierCounts[ncc] || 0) + qty;
    });

    return {
      totalQty,
      totalVal,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      minPriceName,
      maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
      maxPriceName,
      detailCounts: Object.entries(detailCounts).map(([type, d]) => ({ type, ...d })).sort((a, b) => b.count - a.count),
      statusCounts: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      locationCounts: Object.entries(locationCounts).map(([loc, count]) => ({ loc, count })).sort((a, b) => b.count - a.count),
      supplierCounts: Object.entries(supplierCounts).map(([ncc, count]) => ({ ncc, count })).sort((a, b) => b.count - a.count)
    };
  }, [filteredTBs]);

  // 🟢 TÍNH TOÁN BÁO CÁO PHÂN TÍCH ĐỘNG (Tab 2 Báo cáo Thống kê)
  const reportSummary = useMemo(() => {
    const groups: Record<string, { name: string; count: number; value: number; items: any[] }> = {};

    filteredTBs.forEach(tb => {
      const qty = Number(tb.so_luong) || 1;
      const price = Number(tb.gia_mua) || 0;
      const subtotal = price * qty;

      let key = 'Chưa rõ';
      if (reportDimension === 'location') {
        key = tb.vi_tri_bo_tri || 'Chưa rõ';
      } else if (reportDimension === 'department') {
        key = getLatestUserFull(tb.id).department;
      } else if (reportDimension === 'type') {
        key = tb.quy_cach_chat_lieu || 'Chưa phân loại';
      } else if (reportDimension === 'supplier') {
        key = tb.nha_cung_cap || 'Chưa rõ';
      }

      if (!groups[key]) {
        groups[key] = { name: key, count: 0, value: 0, items: [] };
      }
      groups[key].count += qty;
      groups[key].value += subtotal;
      groups[key].items.push(tb);
    });

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [filteredTBs, reportDimension, nkData]);

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

  // 🟢 LỌC DANH SÁCH NHÂN SỰ THEO ĐƠN VỊ CỦA THIẾT BỊ ĐANG CHỌN (HỖ TRỢ ĐIỀU CHUYỂN & MƯỢN LIÊN ĐƠN VỊ)
  const suggestHoTen = useMemo(() => {
    if (!selectedTbForNk) return [];

    // 1. Nếu là Điều chuyển đơn vị
    if (nkFormData.loai_nhat_ky === 'Điều chuyển đơn vị') {
      if (!nkReceivingUnit) return [];
      const validIds = [nkReceivingUnit, ...getAllSubordinateIds(nkReceivingUnit, donViList)];
      const filteredNs = nhansuData.filter(ns => validIds.includes(ns.id_don_vi));
      return Array.from(new Set(filteredNs.map(item => item.ho_ten).filter(Boolean))) as string[];
    }

    // 2. Nếu là Cấp phát liên đơn vị (Mượn tạm)
    const isAssignEvent = nkFormData.loai_nhat_ky === 'Cấp mới' || nkFormData.loai_nhat_ky === 'Cấp máy đã qua sử dụng';
    if (isAssignEvent && isCrossUnitSearch) {
      // Trả về toàn bộ nhân sự hệ thống
      return Array.from(new Set(nhansuData.map(item => item.ho_ten).filter(Boolean))) as string[];
    }

    // 3. Mặc định: Lọc theo đơn vị hiện tại của thiết bị
    const unitId = selectedTbForNk.id_don_vi;
    const validIds = [unitId, ...getAllSubordinateIds(unitId, donViList)];
    const filteredNs = nhansuData.filter(ns => validIds.includes(ns.id_don_vi));
    return Array.from(new Set(filteredNs.map(item => item.ho_ten).filter(Boolean))) as string[];
  }, [nhansuData, selectedTbForNk, donViList, nkFormData.loai_nhat_ky, nkReceivingUnit, isCrossUnitSearch]);

  // Lọc danh sách mã số nhân viên của các nhân sự thuộc đơn vị
  const suggestMsnv = useMemo(() => {
    if (!selectedTbForNk) return [];

    // 1. Nếu là Điều chuyển đơn vị
    if (nkFormData.loai_nhat_ky === 'Điều chuyển đơn vị') {
      if (!nkReceivingUnit) return [];
      const validIds = [nkReceivingUnit, ...getAllSubordinateIds(nkReceivingUnit, donViList)];
      const filteredNs = nhansuData.filter(ns => validIds.includes(ns.id_don_vi));
      return Array.from(new Set(filteredNs.map(item => (item as any).ma_so_nhan_vien || (item as any).ma_nv).filter(Boolean))) as string[];
    }

    // 2. Nếu là Cấp phát liên đơn vị (Mượn tạm)
    const isAssignEvent = nkFormData.loai_nhat_ky === 'Cấp mới' || nkFormData.loai_nhat_ky === 'Cấp máy đã qua sử dụng';
    if (isAssignEvent && isCrossUnitSearch) {
      // Trả về toàn bộ nhân sự hệ thống
      return Array.from(new Set(nhansuData.map(item => (item as any).ma_so_nhan_vien || (item as any).ma_nv).filter(Boolean))) as string[];
    }

    // 3. Mặc định: Lọc theo đơn vị hiện tại của thiết bị
    const unitId = selectedTbForNk.id_don_vi;
    const validIds = [unitId, ...getAllSubordinateIds(unitId, donViList)];
    const filteredNs = nhansuData.filter(ns => validIds.includes(ns.id_don_vi));
    // Hỗ trợ cả ma_so_nhan_vien hoặc ma_nv
    return Array.from(new Set(filteredNs.map(item => (item as any).ma_so_nhan_vien || (item as any).ma_nv).filter(Boolean))) as string[];
  }, [nhansuData, selectedTbForNk, donViList, nkFormData.loai_nhat_ky, nkReceivingUnit, isCrossUnitSearch]);

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
    if (mode === 'create') {
      const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;
      const targetUnitId = selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : '');
      if (!canCreate('ThietBi', targetUnitId)) {
        toast.warning("Bạn không có quyền thêm mới thiết bị!");
        return;
      }
    } else if (mode === 'update' && item) {
      if (!canUpdate('ThietBi', item.id_don_vi)) {
        toast.warning("Bạn không có quyền chỉnh sửa thiết bị này!");
        return;
      }
    }
    setTbModalMode(mode);
    const defaultDonViId = user?.id_don_vi || (user as any)?.idDonVi;
    setShowAllNccGroups(false); // Reset to show filtered list by default

    if (item) {
      const initialMonths = calculateWarrantyMonths(item.ngay_mua, item.han_bao_hanh);
      let loaiChiTiet = item.quy_cach_chat_lieu || '';
      let isCustomDetail = false;
      const groupInfo = NHOM_THIETBI_INFO[item.nhom_thiet_bi];
      if (loaiChiTiet && groupInfo) {
        const isStandard = groupInfo.items.includes(loaiChiTiet);
        isCustomDetail = !isStandard;
      }

      setTbFormData({
        ...item,
        so_thang_bh: initialMonths > 0 ? initialMonths : '',
        loai_chi_tiet: loaiChiTiet,
        is_custom_detail: isCustomDetail
      });
    } else {
      setTbFormData({
        id: '', id_don_vi: selectedUnitFilter || (defaultDonViId !== 'ALL' ? defaultDonViId : ''), tai_san_thuoc: '', ma_tai_san: '', ten_thiet_bi: '', nhom_thiet_bi: '',
        so_luong: '1', don_vi_tinh: 'Cái', vi_tri_bo_tri: '', mo_ta_dac_diem: '', quy_cach_chat_lieu: '', thong_so_ky_thuat: '',
        nha_cung_cap: '', id_ncc: null, ngay_mua: '', gia_mua: '', han_bao_hanh: '', so_thang_bh: '', thoi_gian_khau_hao: '', tinh_trang: 'Đang sử dụng', link_hinh_anh: '', link_ho_so: '',
        so_seri: '', cpu: '', ram: '', ssd: '', hdd: '', vga: '', man_hinh: '', phu_kien: '',
        loai_chi_tiet: '', is_custom_detail: false
      });
    }
    setIsTbModalOpen(true); setError(null);
  };

  // Cấu hình 27 cột cho Dán Excel danh mục thiết bị
  const pasteColumns: ColumnMapItem[] = [
    { key: 'ma_tai_san', label: 'Mã tài sản', type: 'text', required: true },
    { key: 'ten_thiet_bi', label: 'Tên thiết bị', type: 'text', required: true },
    { key: 'ten_don_vi', label: 'Đơn vị', type: 'text', required: false },
    { key: 'nhom_thiet_bi', label: 'Nhóm thiết bị', type: 'text', required: false },
    { key: 'so_luong', label: 'Số lượng', type: 'text', required: false },
    { key: 'don_vi_tinh', label: 'Đơn vị tính', type: 'text', required: false },
    { key: 'vi_tri_bo_tri', label: 'Vị trí bố trí', type: 'text', required: false },
    { key: 'nha_cung_cap', label: 'Nhà cung cấp', type: 'text', required: false },
    { key: 'ngay_mua', label: 'Ngày mua', type: 'text', required: false },
    { key: 'gia_mua', label: 'Giá mua', type: 'text', required: false },
    { key: 'han_bao_hanh', label: 'Hạn bảo hành', type: 'text', required: false },
    { key: 'thoi_gian_khau_hao', label: 'Thời gian khấu hao', type: 'text', required: false },
    { key: 'tai_san_thuoc', label: 'Tài sản thuộc', type: 'text', required: false },
    { key: 'cpu', label: 'CPU', type: 'text', required: false },
    { key: 'ram', label: 'RAM', type: 'text', required: false },
    { key: 'ssd', label: 'SSD', type: 'text', required: false },
    { key: 'hdd', label: 'HDD', type: 'text', required: false },
    { key: 'vga', label: 'VGA', type: 'text', required: false },
    { key: 'man_hinh', label: 'Màn hình', type: 'text', required: false },
    { key: 'thong_so_ky_thuat', label: 'Thông số kỹ thuật chung', type: 'text', required: false },
    { key: 'tinh_trang', label: 'Tình trạng', type: 'text', required: false },
    { key: 'quy_cach_chat_lieu', label: 'Phân loại chi tiết (Laptop/PC/Bàn...)', type: 'text', required: false },
    { key: 'so_seri', label: 'Số seri', type: 'text', required: false },
    { key: 'phu_kien', label: 'Phụ kiện/Ghi chú thêm', type: 'text', required: false },
    { key: 'mo_ta_dac_diem', label: 'Mô tả đặc điểm', type: 'text', required: false },
    { key: 'link_ho_so', label: 'Link hồ sơ', type: 'text', required: false },
    { key: 'link_hinh_anh', label: 'Link hình ảnh', type: 'text', required: false }
  ];

  const handleValidatePasteRow = (row: any, allRows?: any[]) => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // 0. Làm sạch chuỗi kỹ thuật (xóa khoảng trắng quanh dấu -) & Tự thêm đơn vị GB cho RAM/SSD/HDD
    if (row.cpu) row.cpu = cleanTechnicalString(row.cpu);
    if (row.vga) row.vga = cleanTechnicalString(row.vga);
    if (row.ma_tai_san) row.ma_tai_san = cleanTechnicalString(row.ma_tai_san);
    if (row.so_seri) row.so_seri = cleanTechnicalString(row.so_seri);

    if (row.ram) row.ram = formatMemorySize(row.ram);
    if (row.ssd) row.ssd = formatMemorySize(row.ssd);
    if (row.hdd) row.hdd = formatMemorySize(row.hdd);

    // 1. Validate Mã tài sản (Bỏ kiểm tra trùng Mã tài sản theo yêu cầu để hỗ trợ nhập bộ máy tính chia nhỏ)
    const maTS = String(row.ma_tai_san || '').trim();
    if (!maTS) {
      errors['ma_tai_san'] = 'Mã tài sản là bắt buộc.';
    }

    // 1b. Validate Số seri (Chặn trùng Số seri đối với DB và danh sách dán nếu có nhập)
    const soSeri = String(row.so_seri || '').trim();
    if (soSeri) {
      // Kiểm tra trùng trong DB
      const isSeriDuplicateInDb = tbData.some(existing =>
        existing.so_seri &&
        String(existing.so_seri).trim().toLowerCase() === soSeri.toLowerCase()
      );
      if (isSeriDuplicateInDb) {
        errors['so_seri'] = 'Số seri đã tồn tại trong cơ sở dữ liệu (Không cho phép ghi đè).';
      }

      // Kiểm tra trùng trong cùng phiên dán Excel
      if (allRows) {
        const matches = allRows.filter(r =>
          r.so_seri &&
          String(r.so_seri).trim().toLowerCase() === soSeri.toLowerCase()
        );
        if (matches.length > 1) {
          errors['so_seri'] = 'Số seri bị trùng lặp trong danh sách dán.';
        }
      }
    }

    // 2. Validate Đơn vị
    let dvName = String(row.ten_don_vi || '').trim().toLowerCase();

    // Nếu rỗng, tự động điền đơn vị từ bộ lọc ngoài (nếu có chọn)
    if (!dvName && selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      const activeUnit = donViList.find(dv => String(dv.id) === String(selectedUnitFilter));
      if (activeUnit) {
        row.ten_don_vi = activeUnit.ten_don_vi;
        dvName = activeUnit.ten_don_vi.toLowerCase();
      }
    }

    if (dvName) {
      const matchedDv = donViList.find(dv => String(dv.ten_don_vi).trim().toLowerCase() === dvName);
      if (!matchedDv) {
        errors['ten_don_vi'] = 'Đơn vị không khớp với bất kỳ đơn vị nào trong hệ thống.';
      }
    } else {
      errors['ten_don_vi'] = 'Cột "Đơn vị" là bắt buộc.';
    }

    // 3. Validate Số lượng và Giá mua (cảnh báo nếu chứa ký tự không phải số)
    if (row.so_luong !== undefined && row.so_luong !== null && String(row.so_luong).trim() !== '') {
      const val = String(row.so_luong).trim();
      if (isNaN(Number(val)) || Number(val) <= 0) {
        warnings['so_luong'] = 'Số lượng không hợp lệ, hệ thống sẽ bỏ qua và mặc định là 1.';
      }
    }
    if (row.gia_mua !== undefined && row.gia_mua !== null && String(row.gia_mua).trim() !== '') {
      const val = String(row.gia_mua).trim();
      const cleanVal = val.replace(/[^0-9.-]/g, '');
      if (cleanVal === '' || isNaN(Number(cleanVal))) {
        warnings['gia_mua'] = 'Giá mua không phải số hợp lệ, hệ thống sẽ bỏ trống trường này.';
      }
    }

    // 4. Validate định dạng ngày mua và hạn bảo hành dd/mm/yyyy
    const dateRegex = /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}$/;
    if (row.ngay_mua && String(row.ngay_mua).trim() !== '') {
      const val = String(row.ngay_mua).trim();
      if (!dateRegex.test(val)) {
        warnings['ngay_mua'] = 'Ngày mua không đúng định dạng dd/mm/yyyy, hệ thống sẽ bỏ trống.';
      }
    }
    if (row.han_bao_hanh && String(row.han_bao_hanh).trim() !== '') {
      const val = String(row.han_bao_hanh).trim();
      if (!dateRegex.test(val)) {
        warnings['han_bao_hanh'] = 'Hạn bảo hành không đúng định dạng dd/mm/yyyy, hệ thống sẽ bỏ trống.';
      }
    }

    // 5. Validate Tình trạng
    const validStatuses = [
      'Đang sử dụng',
      'Lưu kho - Chờ sử dụng',
      'Lưu kho - Chờ thanh lý',
      'Đang sửa chữa',
      'Đã thanh lý / Hỏng hóc'
    ];
    if (row.tinh_trang && String(row.tinh_trang).trim() !== '') {
      const statusVal = String(row.tinh_trang).trim();
      const matchedStatus = validStatuses.find(s => s.toLowerCase() === statusVal.toLowerCase());
      if (matchedStatus) {
        row.tinh_trang = matchedStatus;
      } else {
        errors['tinh_trang'] = `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}`;
      }
    } else {
      row.tinh_trang = 'Đang sử dụng';
    }

    return { errors, warnings };
  };

  const handlePasteSave = async (parsedData: any[]) => {
    setSubmitting(true);
    try {
      const itemsToSave = parsedData.map(item => {
        // Ánh xạ tên đơn vị để lấy id_don_vi
        let matchedDv = donViList.find(dv =>
          String(dv.ten_don_vi).trim().toLowerCase() === String(item.ten_don_vi).trim().toLowerCase()
        );

        // Nếu không khớp tên đơn vị mà bộ lọc ngoài đang chọn đơn vị cụ thể, dùng bộ lọc ngoài
        if (!matchedDv && selectedUnitFilter && selectedUnitFilter !== 'ALL') {
          matchedDv = donViList.find(dv => String(dv.id) === String(selectedUnitFilter));
        }

        const id_don_vi = matchedDv ? matchedDv.id : '';

        // Xử lý Số lượng
        let so_luong = 1;
        if (item.so_luong !== undefined && item.so_luong !== null && String(item.so_luong).trim() !== '') {
          const val = Number(String(item.so_luong).replace(/\D/g, ''));
          if (!isNaN(val) && val > 0) {
            so_luong = val;
          }
        }

        // Xử lý Giá mua
        let gia_mua = '';
        if (item.gia_mua !== undefined && item.gia_mua !== null && String(item.gia_mua).trim() !== '') {
          const val = Number(String(item.gia_mua).replace(/[^0-9.-]/g, ''));
          if (!isNaN(val)) {
            gia_mua = String(val);
          }
        }

        // Chuyển đổi định dạng ngày dd/mm/yyyy sang yyyy-mm-dd
        const convertToIsoDate = (dateStr: string): string => {
          if (!dateStr) return '';
          const parts = dateStr.split(/[\/\-.]/);
          if (parts.length === 3) {
            let d = parts[0].padStart(2, '0');
            let m = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            return `${y}-${m}-${d}`;
          }
          return '';
        };

        const ngay_mua = convertToIsoDate(item.ngay_mua);

        let han_bao_hanh = '';
        const rawBh = String(item.han_bao_hanh || '').trim();
        if (rawBh) {
          const monthsVal = Number(rawBh);
          if (!isNaN(monthsVal) && monthsVal > 0 && monthsVal < 120) {
            if (ngay_mua) {
              han_bao_hanh = calculateWarrantyExpiry(ngay_mua, monthsVal);
            }
          } else {
            han_bao_hanh = convertToIsoDate(rawBh);
          }
        }

        // Xử lý Tình trạng (nếu rỗng hoặc sai thì mặc định Đang sử dụng)
        const validStatuses = [
          'Đang sử dụng',
          'Lưu kho - Chờ sử dụng',
          'Lưu kho - Chờ thanh lý',
          'Đang sửa chữa',
          'Đã thanh lý / Hỏng hóc'
        ];
        let tinh_trang = 'Đang sử dụng';
        if (item.tinh_trang && String(item.tinh_trang).trim() !== '') {
          const matchedStatus = validStatuses.find(s => s.toLowerCase() === String(item.tinh_trang).trim().toLowerCase());
          if (matchedStatus) {
            tinh_trang = matchedStatus;
          }
        }

        const nccName = item.nha_cung_cap ? String(item.nha_cung_cap).trim() : '';
        const matchedNcc = nccList.find(n =>
          n.ten_cong_ty.trim().toLowerCase() === nccName.toLowerCase() ||
          (n.ten_goi_tat && n.ten_goi_tat.trim().toLowerCase() === nccName.toLowerCase())
        );

        // Chuẩn hóa dữ liệu thiết bị sạch sẽ
        const cleanItem: any = {
          id_don_vi,
          ma_tai_san: String(item.ma_tai_san || '').trim(),
          ten_thiet_bi: String(item.ten_thiet_bi || '').trim(),
          nhom_thiet_bi: item.nhom_thiet_bi ? String(item.nhom_thiet_bi).trim() : 'Thiết bị văn phòng',
          so_luong,
          don_vi_tinh: item.don_vi_tinh ? String(item.don_vi_tinh).trim() : 'Cái',
          vi_tri_bo_tri: item.vi_tri_bo_tri ? String(item.vi_tri_bo_tri).trim() : '',
          nha_cung_cap: nccName,
          id_ncc: matchedNcc ? matchedNcc.id : null,
          ngay_mua: ngay_mua || null,
          gia_mua: gia_mua || null,
          han_bao_hanh: han_bao_hanh || null,
          thoi_gian_khau_hao: item.thoi_gian_khau_hao ? String(item.thoi_gian_khau_hao).trim() : '',
          tai_san_thuoc: item.tai_san_thuoc ? String(item.tai_san_thuoc).trim() : '',
          cpu: item.cpu ? String(item.cpu).trim() : '',
          ram: item.ram ? String(item.ram).trim() : '',
          ssd: item.ssd ? String(item.ssd).trim() : '',
          hdd: item.hdd ? String(item.hdd).trim() : '',
          vga: item.vga ? String(item.vga).trim() : '',
          man_hinh: item.man_hinh ? String(item.man_hinh).trim() : '',
          thong_so_ky_thuat: item.thong_so_ky_thuat ? String(item.thong_so_ky_thuat).trim() : '',
          quy_cach_chat_lieu: item.quy_cach_chat_lieu ? String(item.quy_cach_chat_lieu).trim() : '',
          so_seri: item.so_seri ? String(item.so_seri).trim() : '',
          phu_kien: item.phu_kien ? String(item.phu_kien).trim() : '',
          mo_ta_dac_diem: item.mo_ta_dac_diem ? String(item.mo_ta_dac_diem).trim() : '',
          link_ho_so: item.link_ho_so ? String(item.link_ho_so).trim() : '',
          link_hinh_anh: item.link_hinh_anh ? String(item.link_hinh_anh).trim() : '',
          tinh_trang
        };

        return cleanItem;
      });

      const savedItems: any[] = [];
      for (const item of itemsToSave) {
        // Tự sinh ID ngẫu nhiên cho bản ghi mới
        item.id = `TB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const response = await apiService.save(item, 'create', 'ts_thiet_bi');
        const savedId = response?.id || response?.newId || item.id;
        savedItems.push({ ...item, id: savedId });
      }

      setTbData(prev => [...savedItems, ...prev]);
      toast.success(`Đã lưu thành công ${savedItems.length} thiết bị mới!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi nhập dữ liệu hàng loạt: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 1. CẬP NHẬT HÀM LƯU TÀI SẢN (THIẾT BỊ)
  const handleTbSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🟢 Thay alert bằng toast.warning
    if (!tbFormData.id_don_vi) return toast.warning("Vui lòng chọn Đơn vị quản lý!");
    if (!tbFormData.nhom_thiet_bi) return toast.warning("Vui lòng chọn hoặc nhập Nhóm Thiết bị!");

    let finalData = { ...tbFormData };
    if (finalData.id_ncc === 'custom') {
      finalData.id_ncc = null;
    }
    delete finalData.so_thang_bh;

    const isCustomDetail = !!finalData.is_custom_detail;
    const loaiChiTietVal = String(finalData.loai_chi_tiet || '').trim();
    delete finalData.loai_chi_tiet;
    delete finalData.is_custom_detail;
    delete finalData.is_custom_phap_nhan;

    finalData.quy_cach_chat_lieu = loaiChiTietVal;

    if (!isITEquipment(finalData.nhom_thiet_bi)) {
      ['cpu', 'ram', 'ssd', 'hdd', 'vga', 'man_hinh'].forEach(k => finalData[k] = '');
    } else {
      if (finalData.cpu) finalData.cpu = cleanTechnicalString(finalData.cpu);
      if (finalData.vga) finalData.vga = cleanTechnicalString(finalData.vga);
      if (finalData.ram) finalData.ram = formatMemorySize(finalData.ram);
      if (finalData.ssd) finalData.ssd = formatMemorySize(finalData.ssd);
      if (finalData.hdd) finalData.hdd = formatMemorySize(finalData.hdd);
    }
    if (finalData.ma_tai_san) finalData.ma_tai_san = cleanTechnicalString(finalData.ma_tai_san);
    if (finalData.so_seri) finalData.so_seri = cleanTechnicalString(finalData.so_seri);

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
    setTbFormData((prev: any) => {
      const updated = { ...prev, [name]: name === 'gia_mua' ? value.replace(/\D/g, '') : value };

      if (name === 'so_thang_bh') {
        const months = parseInt(value, 10);
        if (!isNaN(months) && months > 0) {
          updated.han_bao_hanh = calculateWarrantyExpiry(updated.ngay_mua, months);
        } else {
          updated.han_bao_hanh = '';
        }
      } else if (name === 'han_bao_hanh') {
        updated.so_thang_bh = value ? calculateWarrantyMonths(updated.ngay_mua, value) || '' : '';
      } else if (name === 'ngay_mua') {
        const months = parseInt(updated.so_thang_bh, 10);
        if (!isNaN(months) && months > 0) {
          updated.han_bao_hanh = calculateWarrantyExpiry(value, months);
        } else if (updated.han_bao_hanh) {
          updated.so_thang_bh = calculateWarrantyMonths(value, updated.han_bao_hanh) || '';
        }
      }

      return updated;
    });
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
      loai_nhat_ky: 'Cấp mới', chi_phi: '', msnv_nguoi_dung: '', ho_ten_nguoi_dung: '', bp_quan_ly_su_dung: '',
      tinh_trang_ghi_nhan_thiet_bi: '', hinh_anh_minh_chung: '', ghi_chu_sua_chua_nang_cap: ''
    });
    setNkReceivingUnit('');
    setIsCrossUnitSearch(false);
    setIsNkModalOpen(true);
  };

  const editNk = (nk: any) => {
    setNkModalMode('update');
    setNkFormData({ ...nk });
    if (nk.loai_nhat_ky === 'Điều chuyển đơn vị') {
      // Nếu là edit bản ghi Điều chuyển đơn vị, ta lấy id_don_vi_nhan nếu có hoặc trích xuất từ bp_quan_ly_su_dung
      setNkReceivingUnit(nk.id_don_vi_nhan || '');
    } else {
      setNkReceivingUnit('');
    }
    setIsCrossUnitSearch(false);
  };

  // 2. CẬP NHẬT HÀM LƯU NHẬT KÝ THIẾT BỊ
  const handleNkSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      let finalData = { ...nkFormData };
      if (!['Sửa chữa', 'Bảo dưỡng', 'Nâng cấp', 'Sửa chữa/Bảo dưỡng'].includes(finalData.loai_nhat_ky || '')) finalData.chi_phi = '';

      if (finalData.loai_nhat_ky === 'Điều chuyển đơn vị') {
        if (!nkReceivingUnit) {
          toast.error("Vui lòng chọn Đơn vị nhận điều chuyển!");
          setSubmitting(false);
          return;
        }
        finalData.id_don_vi_nhan = nkReceivingUnit;
      }

      // 🟢 ĐIỂM FIX: Tự sinh mã ID trước khi ném lên DB nếu là tạo mới
      if (nkModalMode === 'create' && !finalData.id) {
        finalData.id = `NK-${Date.now()}`;
      }

      const response = await apiService.save(finalData, nkModalMode, "nk_thiet_bi");

      const savedId = response?.id || response?.newId || finalData.id;
      const savedLog = { ...finalData, id: savedId };

      if (nkModalMode === 'create') setNkData(prev => [savedLog, ...prev]);
      else setNkData(prev => prev.map(item => item.id === savedId ? savedLog : item));

      // Thực hiện đổi đơn vị quản lý sở hữu của thiết bị nếu là sự kiện Điều chuyển đơn vị
      if (finalData.loai_nhat_ky === 'Điều chuyển đơn vị' && selectedTbForNk) {
        const updatedTb = { ...selectedTbForNk, id_don_vi: nkReceivingUnit };
        await apiService.save(updatedTb, 'update', 'ts_thiet_bi');

        setTbData(prev => prev.map(item => item.id === selectedTbForNk.id ? updatedTb : item));
        setSelectedTbForNk(updatedTb);

        toast.success(`Đã điều chuyển thiết bị sang đơn vị mới thành công!`);
      }

      // Reset form
      setNkModalMode('create');
      setNkReceivingUnit('');
      setIsCrossUnitSearch(false);
      setNkFormData({
        id: '', id_ts_thiet_bi: selectedTbForNk?.id || '', id_don_vi: selectedTbForNk?.id_don_vi || '',
        ngay_ghi_nhan: new Date().toISOString().split('T')[0], loai_nhat_ky: 'Cấp mới', chi_phi: '', msnv_nguoi_dung: '', ho_ten_nguoi_dung: '', bp_quan_ly_su_dung: '',
        tinh_trang_ghi_nhan_thiet_bi: '', hinh_anh_minh_chung: '', ghi_chu_sua_chua_nang_cap: ''
      });
      setNkFormBp('');
      setNkFormDv('');
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const handleNkHoTenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;

    let validIds: string[] = [];
    if (nkFormData.loai_nhat_ky === 'Điều chuyển đơn vị' && nkReceivingUnit) {
      validIds = [nkReceivingUnit, ...getAllSubordinateIds(nkReceivingUnit, donViList)];
    } else if (selectedTbForNk) {
      validIds = [selectedTbForNk.id_don_vi, ...getAllSubordinateIds(selectedTbForNk.id_don_vi, donViList)];
    }

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

    if (itemToDelete.type === 'tb') {
      const targetTb = tbData.find(tb => tb.id === itemToDelete.id);
      if (!canDelete('ThietBi', targetTb?.id_don_vi)) {
        toast.error("Bạn không có quyền xóa thiết bị tại đơn vị này!");
        setIsConfirmOpen(false);
        setItemToDelete(null);
        return;
      }
    } else {
      const targetNk = nkData.find(nk => nk.id === itemToDelete.id);
      const targetTb = tbData.find(tb => tb.id === targetNk?.id_ts_thiet_bi);
      const unitId = targetNk?.id_don_vi || targetTb?.id_don_vi || selectedTbForNk?.id_don_vi;
      if (!canDelete('ThietBi', unitId)) {
        toast.error("Bạn không có quyền xóa nhật ký thiết bị này!");
        setIsConfirmOpen(false);
        setItemToDelete(null);
        return;
      }
    }

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
        <div className="shrink-0 flex flex-col z-30">
          <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 ${isListCollapsed ? 'md:pl-10' : ''}`}>
            {/* Bên trái: Tiêu đề & Thông tin Đơn vị */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto">
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
                <h2 className="text-2xl font-bold text-[#05469B] flex items-center gap-2"><Layers size={28} /> Quản lý Trang thiết bị VP/Tài sản</h2>
                <p className="text-sm font-medium text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span> ({filteredTBs.length} khoản mục)</span>
                </p>
              </div>
            </div>

            {/* Bên phải: Nút thêm, Tìm kiếm, Lọc, Quét QR */}
            {activeMainTab === 'list' && (
              <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto relative z-30">
                {selectedItemsForPrint.length > 0 && (
                  <button
                    onClick={() => {
                      const items = tbData.filter(tb => selectedItemsForPrint.includes(tb.id));
                      setPrintItemsList(items);
                      setIsPrintModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 h-[32px] rounded-lg text-xs font-bold shadow-xs transition-all whitespace-nowrap animate-in fade-in zoom-in duration-200 shrink-0 cursor-pointer"
                  >
                    <Printer size={14} /> In {selectedItemsForPrint.length} nhãn
                  </button>
                )}

                {/* Lọc Phân loại chi tiết */}
                <div className="w-full sm:w-40 h-[32px] shrink-0">
                  <select
                    value={detailTypeFilter}
                    onChange={(e) => setDetailTypeFilter(e.target.value)}
                    className="w-full h-[32px] px-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium text-gray-700 dark:text-gray-200 cursor-pointer transition-all"
                  >
                    <option value="">Tất cả loại</option>
                    {uniqueDetailTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* 1. Ô tìm kiếm: 256 x 32 px, nền #FFFFF0, focus viền xanh dương */}
                <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tài sản, số seri..."
                    className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* 2. Nút Đồng bộ dữ liệu (24 x 24 px) */}
                <button
                  type="button"
                  onClick={() => {
                    loadData();
                    toast.success('Đang đồng bộ dữ liệu Trang thiết bị mới nhất từ Supabase...');
                  }}
                  title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                  disabled={loading}
                  className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 hover:text-[#05469B] rounded-md border border-gray-200 dark:border-slate-700 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
                >
                  <RotateCcw size={13} className={loading ? 'animate-spin text-[#05469B]' : ''} />
                </button>

                {/* 3. Nút Tính năng (119 x 32 px) - Màu xanh dương đặc trưng */}
                <div className="relative z-50" ref={addDropdownRef}>
                  <button
                    onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                    className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${
                      isAddDropdownOpen
                        ? 'bg-gradient-to-r from-[#05469B] to-[#0a5bc4] text-white border-[#05469B] shadow-sm'
                        : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:text-[#05469B]'
                    }`}
                  >
                    <Sparkles size={14} className={isAddDropdownOpen ? 'text-amber-300 animate-pulse' : 'text-[#05469B]'} />
                    <span>Tính năng</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isAddDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAddDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setIsAddDropdownOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 z-[100] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                        {/* Mục 1: Quét QR */}
                        <button
                          onClick={() => {
                            setIsAddDropdownOpen(false);
                            setIsScannerOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 cursor-pointer"
                        >
                          <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-600">
                            <Camera size={15} />
                          </div>
                          <div>
                            <div className="text-gray-800 font-bold text-xs">Quét QR</div>
                            <div className="text-[10px] text-gray-500 font-normal">Quét mã QR qua camera</div>
                          </div>
                        </button>

                        {/* Mục 2: Thêm từng thiết bị */}
                        {canCreate('ThietBi', selectedUnitFilter) && (
                          <button
                            onClick={() => {
                              setIsAddDropdownOpen(false);
                              openTbModal('create');
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-blue-50 text-gray-700 hover:text-[#05469B] cursor-pointer"
                          >
                            <div className="p-1.5 rounded-md bg-blue-100 text-[#05469B]">
                              <PlusCircle size={15} />
                            </div>
                            <div>
                              <div className="text-gray-800 font-bold text-xs">Thêm từng thiết bị</div>
                              <div className="text-[10px] text-gray-500 font-normal">Tạo mới một thiết bị</div>
                            </div>
                          </button>
                        )}

                        {/* Mục 3: Thêm hàng loạt */}
                        {canCreate('ThietBi', selectedUnitFilter) && (
                          <button
                            onClick={() => {
                              setIsAddDropdownOpen(false);
                              setIsPasteModalOpen(true);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 cursor-pointer border-t border-gray-100 pt-1.5"
                          >
                            <div className="p-1.5 rounded-md bg-indigo-100 text-indigo-600">
                              <ClipboardPaste size={15} />
                            </div>
                            <div>
                              <div className="text-gray-800 font-bold text-xs">Thêm hàng loạt</div>
                              <div className="text-[10px] text-gray-500 font-normal">Dán dữ liệu Excel nhiều dòng</div>
                            </div>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* HÀNG TAB CHÍNH KÉO DÀI 100% CHIỀU DÀI BẢNG (w-full) VỚI HIỆU ỨNG TRƯỢT FLYONUI */}
          <div className={`w-full transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            <SegmentTabs
              tabs={equipmentTabs}
              activeTab={activeMainTab}
              onChange={(id) => {
                setActiveMainTab(id as any);
                if (id === 'report') setDrillDownValue(null);
              }}
              layoutId="equipmentMainTabsSlide"
              activeBgColor="#05469B"
              fullWidth
            />
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-lg shadow-sm"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p></div>}

          {/* 🟢 THANH CẢNH BÁO HẠN BẢO HÀNH (ĐỒNG BỘ VỚI DASHBOARD) */}
          {/* 🟢 THANH CẢNH BÁO HẠN BẢO HÀNH (ĐỒNG BỘ VỚI DASHBOARD) */}
          {activeMainTab === 'list' && expiringEquipments.length > 0 && !isDismissed && (
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
                                <span className="text-[#05469B] font-bold">{tb.ten_thiet_bi}</span>
                                <span className="text-gray-400 mx-1.5">—</span>
                                <span className="text-xs text-gray-500 font-mono">[{tb.ma_tai_san}]</span>
                              </td>
                              <td className="p-3 text-gray-600 text-xs w-48">
                                {donViMap[tb.id_don_vi] || tb.id_don_vi}
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
        {activeMainTab === 'list' && (
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
                    <th className="p-4 w-50">Đơn Vị / Pháp Nhân</th>
                    <th className="p-4">Thông số / Mô tả</th>
                    <th className="p-4 w-30">Tình trạng</th>
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
                            <span className="font-bold text-gray-700 flex items-center gap-1"><MapPin size={12} className="text-orange-500" /> {item.vi_tri_bo_tri || 'Chưa rõ'}</span>
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
                              {canUpdate('ThietBi', item.id_don_vi) && (
                                <button onClick={() => openTbModal('update', item)} className="py-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center shadow-sm" title="Sửa"><Edit size={13} /></button>
                              )}
                              <button onClick={() => { setPrintItemsList([item]); setIsPrintModalOpen(true); }} className="py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded flex items-center justify-center shadow-sm" title="In nhãn tem QR"><QrCode size={13} /></button>
                              {canDelete('ThietBi', item.id_don_vi) && (
                                <button onClick={() => { setItemToDelete({ id: item.id, type: 'tb' }); setIsConfirmOpen(true); }} className="py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded flex items-center justify-center shadow-sm" title="Xóa"><Trash2 size={13} /></button>
                              )}
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
                        <p className="font-bold text-gray-700 flex items-center gap-1 mt-0.5"><MapPin size={11} className="text-orange-500" /> {item.vi_tri_bo_tri || 'Chưa rõ'}</p>
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
                        {canUpdate('ThietBi', item.id_don_vi) && (
                          <button onClick={() => openTbModal('update', item)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Sửa"><Edit size={13} /> Sửa</button>
                        )}
                        <button onClick={() => { setPrintItemsList([item]); setIsPrintModalOpen(true); }} className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="In nhãn tem QR"><QrCode size={13} /></button>
                        {canDelete('ThietBi', item.id_don_vi) && (
                          <button onClick={() => { setItemToDelete({ id: item.id, type: 'tb' }); setIsConfirmOpen(true); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold shadow-2xs" title="Xóa"><Trash2 size={13} /></button>
                        )}
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
        )}

        {/* 🟢 TAB 2: BÁO CÁO THỐNG KÊ */}
        {activeMainTab === 'report' && (
          <div className="flex-1 min-h-0 flex flex-col gap-5 animate-in fade-in duration-200">
            {/* 1. THẺ CHỈ SỐ TỔNG QUAN Ở TRÊN */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số lượng</p>
                <p className="text-xl sm:text-2xl font-black text-gray-800 mt-1">{statsSummary.totalQty} cái</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Tổng giá trị</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{formatCurrency(statsSummary.totalVal)}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Đơn giá trung bình</p>
                <p className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
                  {statsSummary.totalQty > 0 ? formatCurrency(statsSummary.totalVal / statsSummary.totalQty) : '0đ'}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs min-w-0">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider truncate" title="Đơn giá cao nhất">Giá trị lớn nhất</p>
                <p className="text-xl sm:text-2xl font-black text-purple-700 mt-1 truncate" title={formatCurrency(statsSummary.maxPrice)}>
                  {formatCurrency(statsSummary.maxPrice)}
                </p>
              </div>
            </div>

            {/* 2. CHỌN TIÊU CHÍ THỐNG KÊ */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shrink-0 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-[#05469B] w-5 h-5 shrink-0" />
                <span className="font-bold text-sm text-gray-800">Thống kê động theo:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setReportDimension('location'); setDrillDownValue(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${reportDimension === 'location' ? 'bg-[#05469B] text-white border-[#05469B]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
                >
                  Vị trí / Địa điểm
                </button>
                <button
                  type="button"
                  onClick={() => { setReportDimension('department'); setDrillDownValue(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${reportDimension === 'department' ? 'bg-[#05469B] text-white border-[#05469B]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
                >
                  Phòng ban / Bộ phận
                </button>
                <button
                  type="button"
                  onClick={() => { setReportDimension('type'); setDrillDownValue(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${reportDimension === 'type' ? 'bg-[#05469B] text-white border-[#05469B]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
                >
                  Phân loại chi tiết
                </button>
                <button
                  type="button"
                  onClick={() => { setReportDimension('supplier'); setDrillDownValue(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${reportDimension === 'supplier' ? 'bg-[#05469B] text-white border-[#05469B]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
                >
                  Nhà cung cấp
                </button>
              </div>
            </div>

            {/* 3. SPLIT LAYOUT: TRÁI CHỌN NHÓM - PHẢI DRILL-DOWN */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-10 gap-5">
              {/* Cột trái (35% width on large screens) */}
              <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl shadow-xs flex flex-col overflow-hidden min-h-[300px]">
                <div className="p-3.5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                  <span className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                    {reportDimension === 'location' ? 'Địa điểm' : reportDimension === 'department' ? 'Phòng ban' : reportDimension === 'type' ? 'Phân loại' : 'Nhà cung cấp'}
                  </span>
                  <span className="font-bold text-[11px] text-[#05469B] bg-blue-50 px-2.5 py-0.5 rounded-full">{reportSummary.length} nhóm</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                  {reportSummary.map((grp, idx) => (
                    <div
                      key={idx}
                      onClick={() => setDrillDownValue(grp.name)}
                      className={`p-3.5 flex justify-between items-center cursor-pointer transition-all hover:bg-blue-50/20 ${drillDownValue === grp.name ? 'bg-blue-50/40 border-l-4 border-[#05469B] pl-2.5' : ''}`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className={`text-xs block truncate ${drillDownValue === grp.name ? 'font-bold text-[#05469B]' : 'font-semibold text-gray-800'}`}>
                          {grp.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">{formatCurrency(grp.value)}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold text-[11px] shrink-0">
                        {grp.count} cái
                      </span>
                    </div>
                  ))}
                  {reportSummary.length === 0 && (
                    <div className="text-center py-10 text-xs text-gray-400 font-bold">Chưa có dữ liệu thống kê.</div>
                  )}
                </div>
              </div>

              {/* Cột phải (65% width on large screens) */}
              <div className="lg:col-span-6 bg-white border border-gray-200 rounded-xl shadow-xs flex flex-col overflow-hidden min-h-[300px]">
                {drillDownValue ? (
                  (() => {
                    const selectedGrp = reportSummary.find(g => g.name === drillDownValue);
                    const groupItems = selectedGrp ? selectedGrp.items : [];
                    const itConfig = getITConfigStats(groupItems);
                    const hasItSpecs = itConfig.cpu.length > 0 || itConfig.ram.length > 0 || itConfig.vga.length > 0;

                    return (
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-200">
                        {/* Header của Drill-down */}
                        <div className="p-3.5 border-b border-gray-100 bg-[#05469B] text-white flex justify-between items-center shrink-0">
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Danh sách chi tiết</p>
                            <p className="font-bold text-sm truncate" title={drillDownValue}>{drillDownValue}</p>
                          </div>
                          <span className="px-3 py-0.5 bg-white/20 text-white rounded-full font-black text-xs shrink-0">{groupItems.length} tài sản</span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
                          {/* 🟢 PHÂN TÍCH CẤU HÌNH PHẦN CỨNG IT (Nếu có thông số IT) */}
                          {hasItSpecs && (
                            <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-100 rounded-xl p-4 space-y-4">
                              <h4 className="font-black text-xs text-blue-900 uppercase flex items-center gap-1.5 border-b border-blue-100 pb-2">
                                <Cpu size={14} /> Thống kê Cấu hình phần cứng IT
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* CPU */}
                                <div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Bộ vi xử lý (CPU)</span>
                                  <div className="space-y-1">
                                    {itConfig.cpu.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs bg-white/80 p-1.5 rounded border border-gray-100">
                                        <span className="font-semibold text-gray-700 truncate pr-1">{item.name}</span>
                                        <span className="font-bold text-blue-700 shrink-0 bg-blue-50 px-1.5 py-0.5 rounded">{item.count}</span>
                                      </div>
                                    ))}
                                    {itConfig.cpu.length === 0 && <span className="text-xs text-gray-400">---</span>}
                                  </div>
                                </div>
                                {/* Card màn hình VGA */}
                                <div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Đồ họa (VGA)</span>
                                  <div className="space-y-1">
                                    {itConfig.vga.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs bg-white/80 p-1.5 rounded border border-gray-100">
                                        <span className="font-semibold text-gray-700 truncate pr-1">{item.name}</span>
                                        <span className="font-bold text-blue-700 shrink-0 bg-blue-50 px-1.5 py-0.5 rounded">{item.count}</span>
                                      </div>
                                    ))}
                                    {itConfig.vga.length === 0 && <span className="text-xs text-gray-400">---</span>}
                                  </div>
                                </div>
                                {/* RAM */}
                                <div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Bộ nhớ trong (RAM)</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {itConfig.ram.map((item, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-100 rounded-md text-xs font-bold text-gray-700">
                                        {item.name}: <span className="text-indigo-600 font-extrabold">{item.count} máy</span>
                                      </span>
                                    ))}
                                    {itConfig.ram.length === 0 && <span className="text-xs text-gray-400">---</span>}
                                  </div>
                                </div>
                                {/* Storage */}
                                <div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Ổ cứng lưu trữ</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {itConfig.storage.map((item, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-100 rounded-md text-xs font-bold text-gray-700">
                                        {item.name}: <span className="text-indigo-600 font-extrabold">{item.count} ổ</span>
                                      </span>
                                    ))}
                                    {itConfig.storage.length === 0 && <span className="text-xs text-gray-400">---</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* BẢNG DANH SÁCH CHI TIẾT TẬP TÀI SẢN */}
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shrink-0">
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                    <th className="p-3 w-32">Mã / Seri</th>
                                    <th className="p-3">Tên thiết bị</th>
                                    <th className="p-3 w-36">Người sử dụng</th>
                                    <th className="p-3 w-28 text-center">Tình trạng</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {groupItems.map((tb, idx) => {
                                    const latestUser = getLatestUserFull(tb.id);
                                    return (
                                      <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="p-3 font-mono">
                                          <span className="block font-bold text-gray-800">{tb.ma_tai_san || '---'}</span>
                                          {tb.so_seri && <span className="block text-[9px] text-gray-400 mt-0.5">S/N: {tb.so_seri}</span>}
                                        </td>
                                        <td className="p-3">
                                          <span className="font-bold text-[#05469B] block">{tb.ten_thiet_bi}</span>
                                          <span className="block text-[9px] text-gray-400 mt-0.5">
                                            {tb.quy_cach_chat_lieu || 'Chưa phân loại'}
                                            {tb.vi_tri_bo_tri && ` | ${tb.vi_tri_bo_tri}`}
                                          </span>
                                        </td>
                                        <td className="p-3">
                                          <span className="font-bold text-gray-700 block">{latestUser.name}</span>
                                          <span className="block text-[9px] text-gray-400 mt-0.5 truncate" title={latestUser.department}>{latestUser.department}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tb.tinh_trang === 'Đang sử dụng' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {tb.tinh_trang || 'Chưa rõ'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-8">
                    <BarChart3 className="w-12 h-12 text-gray-300 animate-bounce mb-2" />
                    <p className="font-bold text-sm text-gray-500">Xem phân tích & khoan sâu danh sách</p>
                    <p className="text-xs text-gray-400 max-w-xs mt-1">Chọn một nhóm phân loại ở cột bên trái để xem danh sách tài sản và thống kê cấu hình phần cứng chi tiết của nhóm đó.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- DATALISTS --- */}
      <datalist id="suggest-ram">{suggestRAM.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-ssd">{suggestSSD.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-hdd">{suggestHDD.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-vitri">{suggestViTri.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="suggest-phapnhan">{suggestPhapNhan.map(v => <option key={v} value={v} />)}</datalist>

      {/* --- MODAL QUÉT MÃ QR CAMERA --- */}
      {isScannerOpen && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
        </div>,
        document.body
      )}

      {/* --- MODAL IN TEM NHÃN TÀI SẢN --- */}
      {isPrintModalOpen && printItemsList.length > 0 && createPortal(
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
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
        </div>,
        document.body
      )}

      {/* --- MODAL THÊM/SỬA TÀI SẢN --- */}
      {isTbModalOpen && createPortal(
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[95vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 mt-auto sm:mt-0 overflow-hidden">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 rounded-t-3xl sm:rounded-t-2xl shrink-0">
              <h3 className="text-xl font-bold text-[#05469B] flex items-center gap-2"><Package size={24} /> {tbModalMode === 'create' ? 'Thêm Mới Tài Sản / Thiết Bị' : 'Cập nhật Dữ liệu Tài sản'}</h3>
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
                        <select required name="id_don_vi" value={tbFormData.id_don_vi || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" style={{ fontFamily: 'monospace, sans-serif' }}>
                          <option value="">-- Chọn đơn vị --</option>
                          {buildHierarchicalOptions(donViList.filter(dv => allowedDonViIds.includes(dv.id))).map(({ unit, prefix }) => (<option key={unit.id} value={unit.id} className="font-normal text-gray-700">{prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</option>))}
                        </select>
                      </div>
                      <div className="w-full md:w-2/4">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tài sản thuộc Pháp nhân (Công ty)</label>
                        {tbFormData.is_custom_phap_nhan || (tbFormData.tai_san_thuoc && suggestPhapNhanOptions.length > 0 && !suggestPhapNhanOptions.includes(tbFormData.tai_san_thuoc)) ? (
                          <div className="relative">
                            <input
                              type="text"
                              name="tai_san_thuoc"
                              value={tbFormData.tai_san_thuoc || ''}
                              onChange={handleTbChange}
                              placeholder="Nhập tên pháp nhân tự do..."
                              className="w-full p-2.5 pr-8 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900"
                            />
                            {suggestPhapNhanOptions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setTbFormData({ ...tbFormData, is_custom_phap_nhan: false, tai_san_thuoc: suggestPhapNhanOptions[0] || '' })}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-white rounded-full p-0.5 shadow-sm"
                                title="Quay lại danh sách chọn"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <select
                            name="tai_san_thuoc"
                            value={tbFormData.tai_san_thuoc || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom') {
                                setTbFormData({ ...tbFormData, is_custom_phap_nhan: true, tai_san_thuoc: '' });
                              } else {
                                setTbFormData({ ...tbFormData, tai_san_thuoc: val, is_custom_phap_nhan: false });
                              }
                            }}
                            className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900 cursor-pointer"
                          >
                            <option value="">-- Chọn Pháp nhân ({suggestPhapNhanOptions.length}) --</option>
                            {suggestPhapNhanOptions.map((pnName, idx) => (
                              <option key={idx} value={pnName}>{pnName}</option>
                            ))}
                            <option value="custom" className="text-[#05469B] font-bold">➕ Khác (Tự nhập...)</option>
                          </select>
                        )}
                      </div>
                      <div className="w-full md:w-1/4">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Mã Tài Sản</label>
                        <input type="text" name="ma_tai_san" value={tbFormData.ma_tai_san || ''} onChange={handleTbChange} placeholder="VD: SR-BAN-01" className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900 tracking-wider" />
                      </div>
                    </div>

                    {/* Dòng 2: Nhóm TS SMART DROPDOWN - Tên - SL - ĐVT - Tình trạng */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-[30%] relative" onMouseLeave={() => setShowNhomTBTooltip(false)}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">Nhóm Thiết bị *</label>
                          <button
                            type="button"
                            onClick={() => setShowNhomTBTooltip(!showNhomTBTooltip)}
                            onMouseEnter={() => setShowNhomTBTooltip(true)}
                            className="text-emerald-600 hover:text-emerald-700 flex items-center justify-center w-5 h-5 bg-emerald-50 hover:bg-emerald-100 rounded-full border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                            title="Xem thành phần nhóm thiết bị"
                          >
                            <Info size={13} className="shrink-0" />
                          </button>
                        </div>
                        {isCustomGroup ? (
                          <div className="relative">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nhập tên nhóm..."
                              name="nhom_thiet_bi"
                              value={tbFormData.nhom_thiet_bi === 'Khác' ? '' : (tbFormData.nhom_thiet_bi || '')}
                              onChange={handleTbChange}
                              className="w-full p-2.5 pr-8 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900"
                            />
                            <button type="button" onClick={() => setTbFormData({ ...tbFormData, nhom_thiet_bi: ASSET_GROUPS[0], loai_chi_tiet: NHOM_THIETBI_INFO[ASSET_GROUPS[0]]?.items[0] || '', is_custom_detail: false })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-white rounded-full p-0.5 shadow-sm" title="Hủy nhập tay"><X size={14} /></button>
                          </div>
                        ) : (
                          <select
                            required
                            name="nhom_thiet_bi"
                            value={tbFormData.nhom_thiet_bi || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTbFormData({
                                ...tbFormData,
                                nhom_thiet_bi: val,
                                loai_chi_tiet: NHOM_THIETBI_INFO[val] ? NHOM_THIETBI_INFO[val].items[0] : '',
                                is_custom_detail: false
                              });
                              setShowNhomTBTooltip(true);
                            }}
                            onFocus={() => setShowNhomTBTooltip(true)}
                            className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900 cursor-pointer"
                          >
                            <option value="" disabled>-- Chọn Nhóm --</option>
                            {ASSET_GROUPS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            <option value="Khác">➕ Khác (Tự nhập...)</option>
                          </select>
                        )}

                        {/* TOOLTIP HIỆN ĐẠI CAO CẤP */}
                        {showNhomTBTooltip && NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi] && (
                          <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-start justify-between border-b border-gray-100 pb-2 mb-2.5">
                              <div className="flex items-center gap-1.5 font-black text-emerald-800 text-xs">
                                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                                <span>{NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi].title}</span>
                              </div>
                              <button type="button" onClick={() => setShowNhomTBTooltip(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full p-1 transition-colors"><X size={12} /></button>
                            </div>

                            <div className="space-y-2 overflow-y-auto max-h-48 custom-scrollbar">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Danh mục thiết bị tiêu biểu:</p>
                              <ul className="space-y-1.5 text-xs text-gray-700 font-medium">
                                {NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi].items.map((item, index) => (
                                  <li key={index} className="flex items-start gap-2 pl-2 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-emerald-500 before:rounded-full">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Phân loại chi tiết (Dropdown động) */}
                      <div className="w-full md:w-[30%] relative">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Phân loại chi tiết (Loại thiết bị) *
                        </label>
                        {tbFormData.is_custom_detail || !NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi] ? (
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="Nhập loại thiết bị (Laptop, PC, Bàn...)..."
                              name="loai_chi_tiet"
                              value={tbFormData.loai_chi_tiet || ''}
                              onChange={handleTbChange}
                              className="w-full p-2.5 pr-8 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900"
                            />
                            {NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi] && (
                              <button
                                type="button"
                                onClick={() => setTbFormData({ ...tbFormData, is_custom_detail: false, loai_chi_tiet: NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi].items[0] || '' })}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-white rounded-full p-0.5 shadow-sm"
                                title="Quay lại danh sách chọn"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <select
                            required
                            name="loai_chi_tiet"
                            value={tbFormData.loai_chi_tiet || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom') {
                                setTbFormData({ ...tbFormData, is_custom_detail: true, loai_chi_tiet: '' });
                              } else {
                                setTbFormData({ ...tbFormData, loai_chi_tiet: val });
                              }
                            }}
                            className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900 cursor-pointer"
                          >
                            <option value="" disabled>-- Chọn Loại thiết bị --</option>
                            {NHOM_THIETBI_INFO[tbFormData.nhom_thiet_bi].items.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            <option value="custom">➕ Khác (Tự nhập...)</option>
                          </select>
                        )}
                      </div>

                      <div className="w-full md:w-[40%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tên Tài sản / Thiết bị *</label>
                        <input type="text" required name="ten_thiet_bi" value={tbFormData.ten_thiet_bi || ''} onChange={handleTbChange} placeholder="VD: Bàn họp lễ tân, Laptop Dell..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" />
                      </div>
                    </div>

                    {/* Dòng 3: Số lượng (15%) - Đơn vị tính (15%) - Tình trạng (30%) - Vị trí (40%) */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-[15%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Số lượng *</label>
                        <input type="number" required min="1" name="so_luong" value={tbFormData.so_luong || '1'} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-center text-gray-900" />
                      </div>
                      <div className="w-full md:w-[15%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Đơn vị tính *</label>
                        <input type="text" required name="don_vi_tinh" value={tbFormData.don_vi_tinh || 'Cái'} onChange={handleTbChange} placeholder="Cái, Bộ..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-center text-gray-900" />
                      </div>
                      <div className="w-full md:w-[30%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tình trạng *</label>
                        <select required name="tinh_trang" value={tbFormData.tinh_trang || 'Đang sử dụng'} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900">
                          <option value="Đang sử dụng">Đang sử dụng</option>
                          <option value="Lưu kho - Chờ sử dụng">Lưu kho - Chờ sử dụng</option>
                          <option value="Lưu kho - Chờ thanh lý">Lưu kho - Chờ thanh lý</option>
                          <option value="Đang sửa chữa">Đang sửa chữa</option>
                          <option value="Đã thanh lý / Hỏng hóc">Đã thanh lý / Hỏng hóc</option>
                        </select>
                      </div>
                      <div className="w-full md:w-[40%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Vị trí bố trí (Phòng ban/Khu vực)</label>
                        <input list="suggest-vitri" type="text" name="vi_tri_bo_tri" value={tbFormData.vi_tri_bo_tri || ''} onChange={handleTbChange} placeholder="VD: Quầy Lễ tân, Sảnh..." className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" />
                      </div>
                    </div>

                    {/* Dòng 4: Mô tả (50%) - Link ảnh (50%) */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-[50%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả đặc điểm / Ghi chú</label>
                        <input type="text" name="mo_ta_dac_diem" value={tbFormData.mo_ta_dac_diem || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" placeholder="Màu sắc, tình trạng..." />
                      </div>
                      <div className="w-full md:w-[50%]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Link Ảnh tài sản thực tế</label>
                        <div className="relative">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input type="url" name="link_hinh_anh" value={tbFormData.link_hinh_anh || ''} onChange={handleTbChange} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900 text-sm" placeholder="Dán link Drive..." />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* KHỐI 2: CẤU HÌNH ĐỘNG DỰA TRÊN NHÓM TÀI SẢN */}
                {isITEquipment(tbFormData.nhom_thiet_bi || '') ? (
                  // 2A. FORM DÀNH CHO THIẾT BỊ IT
                  <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 animate-in fade-in zoom-in duration-200">
                    <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Cpu size={18} /> 2. Chi tiết Cấu hình IT</h4>
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
                    <h4 className="font-bold text-amber-800 mb-4 flex items-center gap-2"><Sofa size={18} /> 2. Thuộc tính Nội thất</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div><label className="block text-xs font-bold text-amber-800 mb-1">Kích thước / Chất liệu (Quy cách)</label><textarea name="thong_so_ky_thuat" value={tbFormData.thong_so_ky_thuat || ''} onChange={handleTbChange} rows={2} placeholder="VD: Gỗ công nghiệp MDF 1m2 x 0.6m, chân sắt..." className="w-full p-2.5 border border-amber-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 resize-none font-medium"></textarea></div>
                      <div><label className="block text-xs font-bold text-amber-800 mb-1">Ghi chú bổ sung</label><textarea name="phu_kien" value={tbFormData.phu_kien || ''} onChange={handleTbChange} rows={2} placeholder="VD: Kèm 1 hộc tủ di động..." className="w-full p-2.5 border border-amber-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 resize-none"></textarea></div>
                    </div>
                  </div>
                ) : (
                  // 2C. FORM DÀNH CHO THIẾT BỊ CHUNG (CAMERA, POS, TIVI...)
                  <div className="bg-purple-50/40 p-5 rounded-xl border border-purple-100 animate-in fade-in zoom-in duration-200">
                    <h4 className="font-bold text-purple-800 mb-4 flex items-center gap-2"><Video size={18} /> 2. Thông số Thiết bị khác</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div><label className="block text-xs font-bold text-purple-800 mb-1">Số Seri (Nếu có)</label><input type="text" name="so_seri" value={tbFormData.so_seri || ''} onChange={handleTbChange} className="w-full p-2.5 border border-purple-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 font-bold" /></div>
                      <div className="md:col-span-2"><label className="block text-xs font-bold text-purple-800 mb-1">Thông số kỹ thuật chung</label><textarea name="thong_so_ky_thuat" value={tbFormData.thong_so_ky_thuat || ''} onChange={handleTbChange} rows={2} placeholder="VD: Tivi 55 Inch 4K, Camera góc rộng 120 độ..." className="w-full p-2.5 border border-purple-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-purple-500 resize-none font-medium"></textarea></div>
                    </div>
                  </div>
                )}

                {/* KHỐI 3: KẾ TOÁN & HỒ SƠ */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><div className="w-2 h-6 bg-gray-400 rounded-full"></div> 3. Hồ sơ Mua sắm & Kế toán</h4>
                  <div className="flex flex-col gap-4">

                    {/* Dòng 1: Nhà Cung cấp */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-bold text-gray-700">Nhà cung cấp</label>
                          <label className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold cursor-pointer hover:text-indigo-850 select-none">
                            <input
                              type="checkbox"
                              checked={showAllNccGroups}
                              onChange={(e) => setShowAllNccGroups(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Tất cả NCC</span>
                          </label>
                        </div>
                        {tbFormData.id_ncc === 'custom' ? (
                          <div className="relative">
                            <input
                              type="text"
                              name="nha_cung_cap"
                              value={tbFormData.nha_cung_cap || ''}
                              onChange={handleTbChange}
                              placeholder="Nhập tên nhà cung cấp tự do..."
                              className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] pr-10 font-bold text-gray-900"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setTbFormData(prev => ({ ...prev, id_ncc: null, nha_cung_cap: '' }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#05469B] p-1 rounded-full hover:bg-gray-100 transition-colors"
                              title="Quay lại danh sách chọn"
                            >
                              <History size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <select
                              name="id_ncc"
                              value={tbFormData.id_ncc || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') {
                                  setTbFormData(prev => ({ ...prev, id_ncc: 'custom', nha_cung_cap: '' }));
                                } else {
                                  const selectedNcc = nccList.find(ncc => ncc.id === val);
                                  setTbFormData(prev => ({
                                    ...prev,
                                    id_ncc: val || null,
                                    nha_cung_cap: selectedNcc ? selectedNcc.ten_cong_ty : ''
                                  }));
                                }
                              }}
                              className="flex-1 p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900"
                            >
                              <option value="">-- Chọn Nhà cung cấp --</option>
                              {displayedNccList.map(ncc => (
                                <option key={ncc.id} value={ncc.id}>
                                  {ncc.ten_cong_ty}
                                </option>
                              ))}
                              <option value="custom" className="text-[#05469B] font-bold">+ Khác (Tự nhập)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dòng 2: Ngày mua - Thời hạn BH (Tháng) - Hạn bảo hành - Đơn giá - Khấu hao (Tháng) */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Ngày mua</label>
                        <input type="date" name="ngay_mua" value={tbFormData.ngay_mua || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Thời hạn BH (tháng)</label>
                        <input
                          type="number"
                          name="so_thang_bh"
                          value={tbFormData.so_thang_bh || ''}
                          onChange={handleTbChange}
                          min={0}
                          placeholder="VD: 12"
                          className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Hạn bảo hành</label>
                        <input type="date" name="han_bao_hanh" value={tbFormData.han_bao_hanh || ''} onChange={handleTbChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" />
                      </div>
                      <div>
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
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Khấu hao (Tháng)</label>
                        <input type="number" name="thoi_gian_khau_hao" value={tbFormData.thoi_gian_khau_hao || ''} onChange={handleTbChange} placeholder="VD: 36" className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900" />
                      </div>
                    </div>

                    {/* Dòng 3: Link Hồ sơ */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Link Hồ sơ (BB Bàn giao, Phiếu xuất kho, Hợp đồng...)</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input type="url" name="link_ho_so" value={tbFormData.link_ho_so || ''} onChange={handleTbChange} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] font-bold text-gray-900 text-sm" placeholder="Dán link thư mục Drive..." />
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
        </div>,
        document.body
      )}

      {/* --- MODAL NHẬT KÝ (GIAO NHẬN & SỬA CHỮA) --- */}
      {isNkModalOpen && selectedTbForNk && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsNkModalOpen(false)}></div>
          <div className="bg-white shadow-2xl w-full max-w-md md:max-w-xl h-full flex flex-col animate-in slide-in-from-right relative z-10">
            <div className="p-5 border-b bg-purple-600 text-white flex justify-between shrink-0">
              <div><h3 className="text-xl font-black flex items-center gap-2 mb-1"><History size={20} /> Nhật ký Giao nhận & Sửa chữa</h3><p className="text-[11px] font-bold uppercase text-purple-100">{selectedTbForNk.ma_tai_san || 'Chưa cấp mã'} | {selectedTbForNk.ten_thiet_bi}</p></div>
              <button onClick={() => setIsNkModalOpen(false)} className="bg-purple-700/50 p-2 rounded-full"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col custom-scrollbar">
              <form onSubmit={handleNkSave} className="p-5 bg-white border-b shadow-sm space-y-4 z-10 shrink-0">
                <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-gray-800 text-sm uppercase flex items-center gap-1.5"><Calendar size={16} className="text-purple-600" /> Khai báo nhật ký mới</h4>{nkModalMode === 'update' && <button type="button" onClick={() => { setNkModalMode('create'); setNkFormData({ id: '', id_ts_thiet_bi: selectedTbForNk.id, id_don_vi: selectedTbForNk.id_don_vi, ngay_ghi_nhan: new Date().toISOString().split('T')[0], loai_nhat_ky: 'Cấp mới', chi_phi: '', msnv_nguoi_dung: '', ho_ten_nguoi_dung: '', bp_quan_ly_su_dung: '', tinh_trang_ghi_nhan_thiet_bi: '', hinh_anh_minh_chung: '', ghi_chu_sua_chua_nang_cap: '' }); setNkReceivingUnit(''); setIsCrossUnitSearch(false); }} className="text-xs font-bold text-purple-600 flex items-center"><Plus size={14} /> Thêm mới</button>}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Ngày ghi nhận *</label><input type="date" required name="ngay_ghi_nhan" value={nkFormData.ngay_ghi_nhan || ''} onChange={(e) => setNkFormData((prev: any) => ({ ...prev, ngay_ghi_nhan: e.target.value }))} className="w-full p-2 border rounded-lg bg-[#FFFFF0] font-bold text-purple-900" /></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Loại sự kiện *</label>
                    <select
                      required
                      name="loai_nhat_ky"
                      value={nkFormData.loai_nhat_ky || 'Cấp mới'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNkFormData((prev: any) => ({ ...prev, loai_nhat_ky: val }));
                        if (val !== 'Điều chuyển đơn vị') setNkReceivingUnit('');
                        if (!['Cấp mới', 'Cấp máy đã qua sử dụng'].includes(val)) setIsCrossUnitSearch(false);
                      }}
                      className="w-full p-2 border rounded-lg bg-[#FFFFF0] font-bold text-indigo-700"
                    >
                      <option value="Cấp mới">Cấp mới</option>
                      <option value="Thu hồi lưu kho">Thu hồi lưu kho</option>
                      <option value="Cấp máy đã qua sử dụng">Cấp máy đã qua sử dụng</option>
                      <option value="Sửa chữa">Sửa chữa</option>
                      <option value="Bảo dưỡng">Bảo dưỡng</option>
                      <option value="Báo hỏng">Báo hỏng / Báo mất</option>
                      <option value="Điều chuyển đơn vị">Điều chuyển đơn vị</option>
                    </select>
                  </div>

                  {/* HÀNG PHỤ TRỢ: CHỌN ĐƠN VỊ NHẬN (ĐIỀU CHUYỂN) HOẶC TICK CHỌN MƯỢN LIÊN ĐƠN VỊ (CẤP PHÁT) */}
                  {nkFormData.loai_nhat_ky === 'Điều chuyển đơn vị' && (
                    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-blue-900 mb-1">Đơn vị nhận điều chuyển *</label>
                      <select
                        required
                        value={nkReceivingUnit}
                        onChange={(e) => {
                          setNkReceivingUnit(e.target.value);
                          setNkFormData(prev => ({
                            ...prev,
                            msnv_nguoi_dung: '',
                            ho_ten_nguoi_dung: '',
                            bp_quan_ly_su_dung: ''
                          }));
                          setNkFormBp('');
                          setNkFormDv('');
                        }}
                        className="w-full p-2.5 border border-blue-300 rounded bg-[#FFFFF0] text-blue-800 font-bold outline-none"
                      >
                        <option value="">-- Chọn đơn vị nhận --</option>
                        {buildHierarchicalOptions(donViList).map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id}>
                            {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(nkFormData.loai_nhat_ky === 'Cấp mới' || nkFormData.loai_nhat_ky === 'Cấp máy đã qua sử dụng') && (
                    <div className="col-span-2 flex items-center gap-2 bg-blue-50/50 border border-blue-100/50 rounded-lg p-3 animate-in fade-in duration-200">
                      <input
                        type="checkbox"
                        id="isCrossUnitSearch"
                        checked={isCrossUnitSearch}
                        onChange={(e) => {
                          setIsCrossUnitSearch(e.target.checked);
                          setNkFormData(prev => ({
                            ...prev,
                            msnv_nguoi_dung: '',
                            ho_ten_nguoi_dung: '',
                            bp_quan_ly_su_dung: ''
                          }));
                          setNkFormBp('');
                          setNkFormDv('');
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="isCrossUnitSearch" className="text-xs font-bold text-blue-855 cursor-pointer select-none">
                        Cấp phát cho nhân sự liên đơn vị (Mượn tạm thiết bị)
                      </label>
                    </div>
                  )}

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
                      <CustomAutocomplete
                        name="ho_ten_nguoi_dung"
                        value={nkFormData.ho_ten_nguoi_dung || ''}
                        onChange={handleNkHoTenChange}
                        suggestions={suggestHoTen}
                        placeholder="Tên nhân sự..."
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white font-bold animate-in fade-in duration-200"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-row gap-3">
                    <div className="w-1/2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Bộ phận</label>
                      <input
                        type="text"
                        value={nkFormBp}
                        onChange={(e) => handleNkBpChange(e.target.value)}
                        placeholder="Bộ phận..."
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">Đơn vị</label>
                      <input
                        type="text"
                        value={nkFormDv}
                        onChange={(e) => handleNkDvChange(e.target.value)}
                        placeholder="Đơn vị..."
                        className="w-full p-2 border border-gray-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                    <label className="block text-xs font-bold text-orange-800 mb-1">Tình trạng tài sản lúc ghi nhận</label>
                    <input type="text" name="tinh_trang_ghi_nhan_thiet_bi" value={nkFormData.tinh_trang_ghi_nhan_thiet_bi || ''} onChange={(e) => setNkFormData((prev: any) => ({ ...prev, tinh_trang_ghi_nhan_thiet_bi: e.target.value }))} className="w-full p-2 border border-orange-200 rounded outline-none focus:border-orange-500 mb-2" placeholder="VD: Mới 100%, Xước mặt bàn..." />
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Link Ảnh minh chứng (Nếu có)</label>
                    <div className="relative"><ImageIcon size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" name="hinh_anh_minh_chung" value={nkFormData.hinh_anh_minh_chung || ''} onChange={(e) => setNkFormData((prev: any) => ({ ...prev, hinh_anh_minh_chung: e.target.value }))} className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:border-orange-500" placeholder="Link ảnh..." /></div>
                  </div>

                  {['Sửa chữa/Bảo dưỡng', 'Nâng cấp'].includes(nkFormData.loai_nhat_ky || '') && (
                    <div className="col-span-2 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-xs font-bold text-red-600 mb-1">Chi phí thực hiện (VNĐ)</label>
                      <input type="text" name="chi_phi" value={formatCurrency(nkFormData.chi_phi)} onChange={(e) => setNkFormData((prev: any) => ({ ...prev, chi_phi: e.target.value.replace(/\D/g, '') }))} placeholder="Nhập số tiền..." className="w-full p-2 border border-red-200 rounded-lg bg-red-50 focus:bg-white font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  )}

                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Ghi chú Hành động (Nâng cấp gì, sửa gì...)</label><textarea name="ghi_chu_sua_chua_nang_cap" value={nkFormData.ghi_chu_sua_chua_nang_cap || ''} onChange={(e) => setNkFormData((prev: any) => ({ ...prev, ghi_chu_sua_chua_nang_cap: e.target.value }))} rows={2} className="w-full p-2 border rounded-lg resize-none"></textarea></div>
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
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-purple-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10"><Calendar size={16} /></div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${nk.loai_nhat_ky === 'Cấp phát/Thu hồi' ? 'bg-blue-100 text-blue-700' : nk.loai_nhat_ky === 'Báo hỏng' ? 'bg-red-100 text-red-700 animate-pulse' : nk.loai_nhat_ky === 'Sửa chữa/Bảo dưỡng' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{nk.loai_nhat_ky}</span>
                            <span className="text-xs font-bold text-gray-400">{new Date(nk.ngay_ghi_nhan).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-800 mt-2">{nk.ho_ten_nguoi_dung || 'Không có tên'}</p>
                          <p className="text-[10px] text-gray-500 mb-2">{nk.bp_quan_ly_su_dung || 'Không có bộ phận'}</p>

                          {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-[11px] font-bold text-orange-700 mb-1 border-l-2 border-orange-400 pl-2">Tình trạng: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                          {nk.hinh_anh_minh_chung && <a href={nk.hinh_anh_minh_chung} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mb-2 hover:underline"><ImageIcon size={12} /> Xem ảnh minh chứng</a>}

                          {nk.chi_phi && Number(nk.chi_phi) > 0 && (
                            <p className="text-xs text-red-600 bg-red-50 p-1.5 rounded mb-1 font-bold border border-red-100">Chi phí: {formatCurrency(nk.chi_phi)}</p>
                          )}
                          {nk.ghi_chu_sua_chua_nang_cap && <p className="text-xs text-orange-700 bg-orange-50 p-1.5 rounded mb-1 border border-orange-100">Ghi chú: {nk.ghi_chu_sua_chua_nang_cap}</p>}
                          {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">Khác: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                          <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => editNk(nk)} className="text-xs font-bold text-blue-600 hover:underline">Sửa</button>
                            <button onClick={() => { setItemToDelete({ id: nk.id, type: 'nk' }); setIsConfirmOpen(true); }} className="text-xs font-bold text-red-600 hover:underline">Xóa</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL XEM CHI TIẾT --- */}
      {isViewModalOpen && viewData && createPortal(
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-4xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in duration-200 overflow-hidden mt-auto sm:mt-0">
            <div className="flex justify-between p-4 sm:p-5 border-b border-gray-100 bg-[#05469B] text-white rounded-t-3xl sm:rounded-t-2xl shrink-0"><h3 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Layers size={24} /> Chi tiết Tài sản / Thiết bị</h3><button onClick={() => setIsViewModalOpen(false)} className="text-blue-200 hover:text-white p-1 rounded-full"><X size={24} /></button></div>
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">

              {/* HEADER */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 border-b border-gray-100 pb-6 mb-6">
                <div className="w-20 h-20 bg-blue-50 text-[#05469B] rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner shrink-0">
                  {isITEquipment(viewData.nhom_thiet_bi || '') ? <MonitorSmartphone size={40} /> : isFurniture(viewData.nhom_thiet_bi || '') ? <Sofa size={40} /> : <Package size={40} />}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight">{viewData.ma_tai_san || 'Không mã'}</h2>
                  <p className="text-base sm:text-lg font-bold text-[#05469B] mt-1">{viewData.ten_thiet_bi}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">{viewData.nhom_thiet_bi}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${viewData.tinh_trang === 'Đang sử dụng' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{viewData.tinh_trang}</span>
                    <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-bold">SL: {viewData.so_luong || 1} {viewData.don_vi_tinh || 'Cái'}</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold flex items-center gap-1"><MapPin size={12} /> {viewData.vi_tri_bo_tri || 'Chưa rõ'}</span>
                  </div>

                  {(viewData.link_hinh_anh || viewData.link_ho_so) && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      {viewData.link_hinh_anh && (<a href={viewData.link_hinh_anh} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"><ImageIcon size={14} /> Xem Ảnh Thực tế</a>)}
                      {viewData.link_ho_so && (<a href={viewData.link_ho_so} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors border border-gray-300"><FileText size={14} /> Hồ sơ / Biên bản</a>)}
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
                  <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Cpu size={18} /> Thông số Cấu hình IT</h4>
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
                  <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Sofa size={18} /> Quy cách Nội thất</h4>
                  <p className="font-medium text-gray-800 whitespace-pre-wrap">{viewData.quy_cach_chat_lieu || 'Chưa cập nhật thông tin.'}</p>
                </div>
              ) : (
                <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 mb-6">
                  <h4 className="font-bold text-purple-800 mb-4 flex items-center gap-2"><Camera size={18} /> Thông số Kỹ thuật & Seri</h4>
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
                    {hasRule('TB_HIDE_PRICE') ? '***' : formatCurrency(viewData.gia_mua)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">Nhà cung cấp</p>
                  {(() => {
                    const matchedNcc = nccList.find(n => n.id === viewData.id_ncc);
                    if (matchedNcc) {
                      const displayPhone = matchedNcc.sdt_dau_moi || matchedNcc.sdt_ddpl;
                      return (
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-800 uppercase leading-snug">{matchedNcc.ten_cong_ty}</p>
                          {displayPhone && (
                            <p className="text-xs">
                              📞 <a href={`tel:${String(displayPhone).replace(/\D/g, '')}`} className="text-[#05469B] font-bold hover:underline">{displayPhone}</a>
                            </p>
                          )}
                        </div>
                      );
                    }
                    return <p className="font-semibold text-gray-850">{viewData.nha_cung_cap || '-'}</p>;
                  })()}
                </div>
                <div className="md:col-span-4"><p className="text-xs text-gray-500 font-bold mb-1">Mô tả ngoại hình / Ghi chú</p><p className="font-medium text-gray-700 bg-white p-2 rounded border border-gray-100">{viewData.mo_ta_dac_diem || '-'}</p></div>
              </div>

              {/* TIMELINE */}
              <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 mt-6 relative">
                <h4 className="font-bold text-purple-800 mb-6 flex items-center gap-2"><History size={18} /> Lịch sử Sử dụng & Sửa chữa</h4>
                {viewHistory.length === 0 ? (<p className="text-sm text-gray-500 italic text-center py-4">Chưa có dữ liệu nhật ký nào.</p>) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-purple-200 before:via-purple-200 before:to-transparent">
                    {viewHistory.map((nk, idx) => {
                      const logId = nk.id || `view-${idx}`;
                      return (
                        <div key={logId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-purple-400 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10"><Calendar size={16} /></div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${nk.loai_nhat_ky === 'Cấp phát/Thu hồi' ? 'bg-blue-100 text-blue-700' : nk.loai_nhat_ky === 'Báo hỏng' ? 'bg-red-100 text-red-700 animate-pulse' : nk.loai_nhat_ky === 'Sửa chữa/Bảo dưỡng' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{nk.loai_nhat_ky}</span>
                              <span className="text-xs font-bold text-gray-400">{new Date(nk.ngay_ghi_nhan).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <p className="text-sm font-bold text-gray-800 mt-2">{nk.ho_ten_nguoi_dung || 'Không có tên'}</p>
                            <p className="text-[10px] text-gray-500 mb-2">{nk.bp_quan_ly_su_dung || 'Không có bộ phận'}</p>

                            {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-[11px] font-bold text-orange-700 mb-1 border-l-2 border-orange-400 pl-2">Tình trạng: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                            {nk.hinh_anh_minh_chung && <a href={nk.hinh_anh_minh_chung} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mb-2 hover:underline"><ImageIcon size={12} /> Xem ảnh minh chứng</a>}

                            {nk.chi_phi && Number(nk.chi_phi) > 0 && (<p className="text-xs text-red-600 bg-red-50 p-1.5 rounded mb-1 font-bold border border-red-100">Chi phí: {formatCurrency(nk.chi_phi)}</p>)}
                            {nk.ghi_chu_sua_chua_nang_cap && <p className="text-xs text-orange-700 bg-orange-50 p-1.5 rounded mb-1 border border-orange-100">Ghi chú: {nk.ghi_chu_sua_chua_nang_cap}</p>}
                            {nk.tinh_trang_ghi_nhan_thiet_bi && <p className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">Khác: {nk.tinh_trang_ghi_nhan_thiet_bi}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 rounded-b-3xl sm:rounded-b-2xl flex justify-end shrink-0"><button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors">Đóng</button></div>
          </div>
        </div>,
        document.body
      )}

      {/* XÁC NHẬN XÓA */}
      {isConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-500 text-sm mb-6">Hành động này sẽ xóa dữ liệu vĩnh viễn.</p>
            <div className="flex gap-3"><button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button><button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex justify-center gap-2 shadow-md">{submitting ? <Loader2 className="animate-spin" /> : <Trash2 />} Xóa</button></div>
          </div>
        </div>,
        document.body
      )}

      {/* 🟢 MODAL HIỂN THỊ DANH SÁCH THIẾT BỊ TRÙNG MÃ TÀI SẢN (Bộ máy bàn) */}
      {isQrMatchesModalOpen && qrMultipleMatches.length > 0 && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-in zoom-in duration-200 overflow-hidden max-h-[85vh]">
            <div className="p-4 bg-[#05469B] text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base flex items-center gap-1.5"><QrCode size={20} /> Thiết bị trùng Mã tài sản</h3>
              <button onClick={() => setIsQrMatchesModalOpen(false)} className="text-blue-100 hover:text-white p-1 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-4 bg-blue-50/50 border-b border-blue-100 shrink-0">
              <p className="text-xs font-semibold text-blue-900">
                Tìm thấy <span className="font-black text-blue-700">{qrMultipleMatches.length} thiết bị</span> dùng chung Mã tài sản <span className="font-black text-blue-700">"{qrMultipleMatches[0]?.ma_tai_san}"</span>. Vui lòng chọn linh kiện chi tiết dưới đây để đối chiếu hoặc kiểm kê:
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 divide-y divide-gray-100">
              {qrMultipleMatches.map((item, idx) => {
                const latestUser = getLatestUser(item.id);
                return (
                  <div key={idx} className="py-3 flex justify-between items-start gap-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-[#05469B]">{item.ten_thiet_bi}</p>
                      <p className="text-xs text-gray-400 font-semibold mt-0.5">
                        Phân loại: {item.quy_cach_chat_lieu || 'Chưa phân loại'}
                        {item.so_seri && ` | S/N: ${item.so_seri}`}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Sử dụng: <span className="font-bold text-gray-700">{latestUser.name}</span>
                        {item.vi_tri_bo_tri && ` (${item.vi_tri_bo_tri})`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setViewData(item);
                        setIsQrMatchesModalOpen(false);
                        setIsViewModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-[#05469B] hover:bg-[#04367a] text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-sm"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
              <button
                onClick={() => setIsQrMatchesModalOpen(false)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg transition-colors text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🟢 MODAL DÁN EXCEL NHẬP HÀNG LOẠT THIẾT BỊ */}
      {isPasteModalOpen && (
        <PasteImportModal
          isOpen={isPasteModalOpen}
          onClose={() => setIsPasteModalOpen(false)}
          onSave={handlePasteSave}
          title="Dán Excel Danh Mục Thiết Bị"
          columnMapping={pasteColumns}
          onValidateRow={handleValidatePasteRow}
        />
      )}
    </div>
  );
}