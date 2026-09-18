{/*🟢 PHẦN 1: TỪ ĐẦU FILE ĐẾN HẾT KHAI BÁO STATE CƠ BẢN*/ }
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  HardHat, Search, Edit, Trash2, AlertCircle, Loader2, ShieldCheck,
  Building2, MapPin, PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown, Plus,
  FileText, Users, Settings, Link as LinkIcon, CheckCircle2, XCircle,
  FileSpreadsheet, Download, AlertTriangle, CheckCheck, HelpCircle, ChevronLeft,
  Wrench, Heart, RotateCcw, Sparkles, PlusCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from '../utils/toast';
import AtvsldModal from '../components/department/AtvsldModal';
import HoSoTab from '../components/atvsld/HoSoTab';
import KeHoachTab from '../components/atvsld/KeHoachTab';
import KhoaHocTab from '../components/atvsld/KhoaHocTab';
import StrictEquipmentTab from '../components/atvsld/StrictEquipmentTab';
import SucKhoeTab from '../components/atvsld/SucKhoeTab';
import { getExpiryStatus } from '../utils/expiryStatus';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { GraduationCap } from 'lucide-react';
import { groupParentUnits, sortDonViByThuTu, getUnitEmoji, getAllSubordinateIds, getDefaultUnitId } from '../utils/hierarchy';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import SegmentTabs from '../components/ui/SegmentTabs';
import { toUnaccented, stripAccents } from '../utils/formatters';
import { motion, AnimatePresence } from 'motion/react';

// Hàm dò tìm Tên Vùng Miền (Dành cho chức năng Xuất Excel)
const getRegionName = (unitId: string, allUnits: DonVi[]): string => {
  const getAncestors = (id: string): string[] => {
    const u = allUnits.find(d => d.id === id);
    if (!u || !u.cap_quan_ly || u.cap_quan_ly === 'HO') return [id];
    return [id, ...getAncestors(u.cap_quan_ly)];
  };
  const ancestors = getAncestors(unitId);
  const isBac = allUnits.filter(item => item.cap_quan_ly === 'HO' && toUnaccented(item.ten_don_vi).includes('bac')).map(u => u.id);
  const isNam = allUnits.filter(item => item.cap_quan_ly === 'HO' && toUnaccented(item.ten_don_vi).includes('nam')).map(u => u.id);

  if (ancestors.some(id => isBac.includes(id))) return 'Phía Bắc';
  if (ancestors.some(id => isNam.includes(id))) return 'Phía Nam';
  return 'VPĐH / Khác';
};



export default function AtvsldPage() {
  const { user } = useAuth();

  const [donViData, setDonViList] = useState<DonVi[]>([]);
  const [atvsldData, setAtvsldData] = useState<any[]>([]);
  const [personnelData, setPersonnelData] = useState<any[]>([]); // 🟢 Lấy Data Nhân sự để check hạn thẻ
  const [khoaHocData, setKhoaHocData] = useState<any[]>([]);
  const [hocVienData, setHocVienData] = useState<any[]>([]);
  const [chuKyData, setChuKyData] = useState<any[]>([]);
  const [thietBiData, setThietBiData] = useState<any[]>([]);
  const [kiemDinhData, setKiemDinhData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

  // 🟢 STATE CHUYỂN TAB CẤP 1 VÀ CẤP 2
  const [activeTab, setActiveTab] = useState<'hoso' | 'daotao' | 'thietbi' | 'khamsuckhoe'>('hoso');
  const [activeSubTab, setActiveSubTab] = useState<'khoahoc' | 'kehoach'>('khoahoc');
  const [activeSubTab3, setActiveSubTab3] = useState<'khoahoc' | 'canhan'>('khoahoc');
  const [level3Counts, setLevel3Counts] = useState({ khoaHocCount: 0, caNhanCount: 0 });
  const [activeSubTabSuckhoe, setActiveSubTabSuckhoe] = useState<'tonghop' | 'canhan'>('tonghop');
  const [suckhoeCounts, setSuckhoeCounts] = useState({ campaignCount: 0, caNhanCount: 0 });

  // Tab Hồ sơ (Cũ)
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentData, setCurrentData] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);

  // Tab Kế hoạch ATVSLĐ (Mới)
  const [safetySearchTerm, setSafetySearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN'>('ALL');
  const [nhomFilter, setNhomFilter] = useState<string>('ALL');
  const [selectedSafetyIds, setSelectedSafetyIds] = useState<string[]>([]);
  const [currentSafetyPage, setCurrentSafetyPage] = useState(1);
  const [rowsPerSafetyPage, setRowsPerSafetyPage] = useState(50);

  // 🟢 KÉO CÙNG LÚC 8 BẢNG DỮ LIỆU (Đã bọc bẫy lỗi an toàn cho từng API)
  const loadData = async () => {
    setLoading(true);
    try {
      const [dvResult, atResult, nsResult, khResult, hvResult, ckResult, tbResult, kdResult] = await Promise.all([
        apiService.getDonVi ? apiService.getDonVi().catch(() => []) : Promise.resolve([]),
        apiService.getATVSLD ? apiService.getATVSLD().catch(() => []) : Promise.resolve([]),
        apiService.getPersonnel ? apiService.getPersonnel().catch(() => []) : Promise.resolve([]),
        apiService.getKhoaHuanLuyen ? apiService.getKhoaHuanLuyen().catch(() => []) : Promise.resolve([]),
        apiService.getHocVienKhoaHuanLuyen ? apiService.getHocVienKhoaHuanLuyen().catch(() => []) : Promise.resolve([]),
        apiService.getChuKyATVSLD ? apiService.getChuKyATVSLD().catch(() => []) : Promise.resolve([]),
        apiService.getThietBiNghiemNgat ? apiService.getThietBiNghiemNgat().catch(() => []) : Promise.resolve([]),
        apiService.getKiemDinhTBNN ? apiService.getKiemDinhTBNN().catch(() => []) : Promise.resolve([])
      ]);
      setDonViList(dvResult || []);
      setAtvsldData(atResult || []);
      setPersonnelData(nsResult || []);
      setKhoaHocData(khResult || []);
      setHocVienData(hvResult || []);
      setChuKyData(ckResult || []);
      setThietBiData(tbResult || []);
      setKiemDinhData(kdResult || []);
    } catch (err) {
      console.error("Lỗi tải dữ liệu ATVSLĐ:", err);
      toast.error('Lỗi tải dữ liệu ATVSLĐ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViData.forEach(dv => { map[String(dv.id)] = dv.ten_don_vi; });
    return map;
  }, [donViData]);

  const allowedDonViIds = useAllowedUnits(donViData);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (donViData.length > 0 && !hasInitializedRef.current) {
      const defId = getDefaultUnitId(user, donViData);
      if (defId && allowedDonViIds.includes(defId)) {
        setSelectedUnitFilter(defId);
      } else if (allowedDonViIds.length > 0) {
        setSelectedUnitFilter(allowedDonViIds[0]);
      }
      hasInitializedRef.current = true;
    }
  }, [donViData, user, allowedDonViIds]);
  const atvsldTabs = useMemo(() => [
    { id: 'hoso', label: 'Hồ sơ Báo cáo', icon: <Building2 size={18} /> },
    { id: 'daotao', label: 'Đào tạo/Huấn luyện', icon: <GraduationCap size={18} /> },
    { id: 'thietbi', label: 'Thiết bị yêu cầu nghiêm ngặt', icon: <Wrench size={18} /> },
    { id: 'khamsuckhoe', label: 'Khám BNN/Sức khoẻ định kỳ', icon: <Heart size={18} /> }
  ], []);



  const selectedUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViData);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViData]);

  {/*🟢 PHẦN 2: LOGIC XỬ LÝ DỮ LIỆU & XUẤT EXCEL KẾ HOẠCH*/ }
  // =======================================================================
  // 🟢 LOGIC TAB 1: QUẢN LÝ HỒ SƠ ATVSLĐ (BÁO CÁO CƠ SỞ)
  // =======================================================================
  const filteredData = useMemo(() => {
    return atvsldData.filter(item => {
      if (!allowedDonViIds.includes(item.id_don_vi)) return false;
      if (selectedUnitFilter && !selectedUnitSubordinates.includes(item.id_don_vi)) return false;
      const dvName = donViMap[item.id_don_vi] || '';
      const searchStr = `${dvName} ${item.nguoi_phu_trach || ''} ${item.id_don_vi}`;
      return stripAccents(searchStr).includes(stripAccents(searchTerm));
    });
  }, [atvsldData, donViMap, searchTerm, selectedUnitFilter, selectedUnitSubordinates, allowedDonViIds]);

  const selectedUnitName = useMemo(() => {
    if (!selectedUnitFilter) return 'Tất cả Đơn vị';
    const unit = donViData.find(d => d.id === selectedUnitFilter);
    return unit ? unit.ten_don_vi : 'Đơn vị không xác định';
  }, [selectedUnitFilter, donViData]);

  const stats = useMemo(() => {
    let totalThietBi = 0, totalLoi = 0, totalTaiNan = 0, totalNhanSuHL = 0;

    const activeUnitIds = new Set(filteredData.map(item => item.id_don_vi));

    // 1. Tính tổng nhân sự huấn luyện đạt
    hocVienData.forEach(hv => {
      if (hv.id_don_vi && activeUnitIds.has(hv.id_don_vi)) {
        // SỬA LỖI: So khớp CHÍNH XÁC và chuẩn hóa NFC để tránh dùng includes() gây nhận nhầm trạng thái "chưa đạt"
        const kqNormalized = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
        const isDat = kqNormalized === 'đạt' || kqNormalized === 'dat';
        if (isDat) {
          totalNhanSuHL++;
        }
      }
    });

    // 2. Tính số lượng thiết bị nghiêm ngặt và quá hạn kiểm định từ database
    thietBiData.forEach(tb => {
      if (activeUnitIds.has(tb.id_don_vi) && tb.tinh_trang === 'Đang sử dụng') {
        totalThietBi++;

        // Tìm lượt kiểm định gần nhất
        const inspections = kiemDinhData
          .filter(kd => kd.id_thiet_bi === tb.id)
          .sort((a, b) => new Date(b.ngay_kiem_dinh).getTime() - new Date(a.ngay_kiem_dinh).getTime());

        if (inspections.length > 0) {
          const status = getExpiryStatus(inspections[0].han_kiem_dinh);
          if (status.level === 'expired') {
            totalLoi++;
          }
        } else {
          totalLoi++; // Chưa kiểm định = Quá hạn
        }
      }
    });

    // 3. Tính số vụ tai nạn lao động
    filteredData.forEach(item => {
      totalTaiNan += Number(item.so_tai_nan_trong_nam) || 0;
    });

    return { totalThietBi, totalLoi, totalTaiNan, totalNhanSuHL };
  }, [filteredData, hocVienData, thietBiData, kiemDinhData]);

  const openModal = (unitId: string, data: any = null) => {
    setSelectedUnitId(unitId);
    setCurrentData(data);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await apiService.delete(deleteTargetId, 'hs_an_toan_lao_dong');
      setAtvsldData(prev => prev.filter(item => item.id !== deleteTargetId));
      toast.success('Đã xóa hồ sơ thành công!');
    } catch (err) {
      toast.error('Lỗi khi xóa hồ sơ.');
    } finally {
      setIsConfirmOpen(false);
      setDeleteTargetId(null);
    }
  };



  // =======================================================================
  // 🟢 LOGIC TAB 2: HOẠCH ĐỊNH KẾ HOẠCH ĐÀO TẠO ATVSLĐ
  // =======================================================================

  // 1. Thuật toán phân loại trạng thái ATVSLĐ & Gom nhóm đơn vị trực thuộc
  const processedSafetyPersonnel = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeFilterIds = selectedUnitFilter ? [selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViData)] : allowedDonViIds;

    return personnelData
      .filter(p => p.trang_thai !== 'Đã nghỉ việc' && activeFilterIds.includes(p.id_don_vi))
      .map(p => {
        let status: 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN' = 'CHUA_HOC';
        let remainingDays = 0;

        if ((p.cc_atvsld === true || String(p.cc_atvsld) === 'true') && p.gia_tri_den) {
          const exprDate = new Date(p.gia_tri_den);
          exprDate.setHours(0, 0, 0, 0);
          const diffTime = exprDate.getTime() - today.getTime();
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (remainingDays < 0) {
            status = 'QUA_HAN';
          } else if (remainingDays <= 60) { // 🔴 KHUNG CẢNH BÁO CHUẨN 60 NGÀY THEO YÊU CẦU
            status = 'SAP_HET_HAN';
          } else {
            status = 'AN_TOAN';
          }
        }

        // Tách biệt tên Đơn vị quản lý cấp tỉnh và Showroom con lẻ
        const currentUnit = donViData.find(d => d.id === p.id_don_vi);
        let donViName = '';
        let showroomName = '';
        if (currentUnit) {
          if (currentUnit.cap_quan_ly === 'HO' || !currentUnit.cap_quan_ly) {
            donViName = currentUnit.ten_don_vi;
            showroomName = 'Văn phòng Công ty';
          } else {
            const parentUnit = donViData.find(d => d.id === currentUnit.cap_quan_ly);
            donViName = parentUnit ? parentUnit.ten_don_vi : currentUnit.ten_don_vi;
            showroomName = currentUnit.ten_don_vi;
          }
        }

        return {
          ...p,
          trainingStatus: status,
          remainingDays,
          donViText: donViName,
          showroomText: showroomName,
          phiaText: getRegionName(p.id_don_vi, donViData)
        };
      });
  }, [personnelData, donViData, selectedUnitFilter, allowedDonViIds]);

  // 2. Bộ lọc tìm kiếm và trạng thái
  const filteredSafetyList = useMemo(() => {
    return processedSafetyPersonnel.filter(p => {
      const cleanSearch = stripAccents(safetySearchTerm);
      const matchSearch = safetySearchTerm === '' ||
        stripAccents(p.ma_so_nhan_vien || '').includes(cleanSearch) ||
        stripAccents(p.ho_ten || '').includes(cleanSearch) ||
        stripAccents(p.chuc_vu || '').includes(cleanSearch);

      const matchStatus = statusFilter === 'ALL' || p.trainingStatus === statusFilter;
      const matchNhom = nhomFilter === 'ALL' || String(p.nhom_doi_tuong) === nhomFilter;

      return matchSearch && matchStatus && matchNhom;
    });
  }, [processedSafetyPersonnel, safetySearchTerm, statusFilter, nhomFilter]);

  // Số liệu tổng hợp nhanh
  const safetySummaryCounts = useMemo(() => {
    const counts = { total: 0, chua_hoc: 0, qua_han: 0, sap_het_han: 0, an_toan: 0 };
    processedSafetyPersonnel.forEach(p => {
      counts.total++;
      if (p.trainingStatus === 'CHUA_HOC') counts.chua_hoc++;
      else if (p.trainingStatus === 'QUA_HAN') counts.qua_han++;
      else if (p.trainingStatus === 'SAP_HET_HAN') counts.sap_het_han++;
      else counts.an_toan++;
    });
    return counts;
  }, [processedSafetyPersonnel]);

  // Phân trang danh sách Kế hoạch
  const paginatedSafetyList = useMemo(() => {
    const startIndex = (currentSafetyPage - 1) * rowsPerSafetyPage;
    return filteredSafetyList.slice(startIndex, startIndex + rowsPerSafetyPage);
  }, [filteredSafetyList, currentSafetyPage]);

  const totalSafetyPages = Math.ceil(filteredSafetyList.length / rowsPerSafetyPage) || 1;

  // Xử lý Checkbox xuất danh sách
  const handleSelectAllSafety = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) { setSelectedSafetyIds(paginatedSafetyList.map(p => p.id)); }
    else { setSelectedSafetyIds([]); }
  };

  const handleSelectSafetyRow = (id: string, checked: boolean) => {
    if (checked) { setSelectedSafetyIds(prev => [...prev, id]); }
    else { setSelectedSafetyIds(prev => prev.filter(item => item !== id)); }
  };

  // 3. 🟢 HÀM XUẤT EXCEL KẾ HOẠCH (ĐÚNG 20 CỘT YÊU CẦU: Stt Mã Họ tên Chức vụ Bộ phận Đơn vị Showroom Phía Chức danh SDT Cty Giới tính Năm sinh Ngày nhận việc SDT CNhan Email Ngạch Nhóm Từ Đến Giá trị)
  const exportSafetyPlanToExcel = () => {
    const itemsToExport = filteredSafetyList.filter(p => selectedSafetyIds.includes(p.id));
    if (itemsToExport.length === 0) {
      alert("Vui lòng tích chọn ít nhất một nhân sự dưới bảng để lập kế hoạch đào tạo!");
      return;
    }

    let rowsHTML = '';
    itemsToExport.forEach((p, idx) => {
      rowsHTML += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="mso-number-format:'\\@'; font-weight: bold;">${p.ma_so_nhan_vien || ''}</td>
          <td>${p.ho_ten || ''}</td>
          <td>${p.chuc_danh || ''}</td>
          <td>${p.chuc_vu || ''}</td>
          <td>${p.phong_ban || ''}</td>
          <td>${p.donViText || ''}</td>
          <td>${p.showroomText || ''}</td>
          <td>${p.phiaText || ''}</td>
          <td style="mso-number-format:'\\@'; text-align: center;">${p.sdt_cong_ty || ''}</td>
          <td style="text-align: center;">${p.gioi_tinh || ''}</td>
          <td style="text-align: center;">${p.nam_sinh ? new Date(p.nam_sinh).toLocaleDateString('vi-VN') : ''}</td>
          <td style="text-align: center;">${p.ngay_nhan_vien ? new Date(p.ngay_nhan_vien).toLocaleDateString('vi-VN') : ''}</td>
          <td style="mso-number-format:'\\@'; text-align: center;">${p.sdt_ca_nhan || ''}</td>
          <td>${p.email || ''}</td>
          <td style="text-align: center;">${p.ngach_luong || ''}</td>
          <td style="text-align: center; font-weight: bold; color: #05469B;">${p.nhom_doi_tuong ? (String(p.nhom_doi_tuong).includes('Nhóm') ? p.nhom_doi_tuong : `Nhóm ${p.nhom_doi_tuong}`) : ''}</td>
          <td style="text-align: center;">${p.huan_luyen_tu ? new Date(p.huan_luyen_tu).toLocaleDateString('vi-VN') : ''}</td>
          <td style="text-align: center;">${p.huan_luyen_den ? new Date(p.huan_luyen_den).toLocaleDateString('vi-VN') : ''}</td>
          <td style="text-align: center; font-weight: bold; color: #b91c1c;">${p.gia_tri_den ? new Date(p.gia_tri_den).toLocaleDateString('vi-VN') : ''}</td>
        </tr>
      `;
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 12px; }
          th { border: 1px solid #000000; padding: 8px; font-weight: bold; text-align: center; background-color: #05469B; color: #ffffff; }
          td { border: 1px solid #000000; padding: 6px; vertical-align: middle; }
          .title { font-size: 16px; font-weight: bold; color: #05469B; text-align: center; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="20" class="title">DANH SÁCH ĐĂNG KÝ HUẤN LUYỆN AN TOÀN VỆ SINH LAO ĐỘNG ĐỢT TIẾP THEO</td></tr>
          <thead>
            <tr>
              <th>Stt</th>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Chức danh</th>
              <th>Chức vụ</th>
              <th>Bộ phận làm việc</th>
              <th>Đơn vị công tác</th>
              <th>Showroom</th>
              <th>Phía</th>
              <th>SDT Cty</th>
              <th>Giới tính</th>
              <th>Năm sinh</th>
              <th>Ngày nhận việc</th>
              <th>SDT CN</th>
              <th>Email</th>
              <th>Ngạch</th>
              <th>Nhóm</th>
              <th>Từ</th>
              <th>Đến</th>
              <th>Giá trị</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ke_Hoach_Dao_Tao_ATVSLD_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  {/*🟢 PHẦN 3: GIAO DIỆN CHUNG & TAB HỒ SƠ ATVSLĐ CƠ SỞ*/ }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const isDaotaoOpen = activeTab === 'daotao';
  const isKhamsuckhoeOpen = activeTab === 'khamsuckhoe';
  const isLevel2Open = isDaotaoOpen || isKhamsuckhoeOpen;
  const isLevel3Open = isDaotaoOpen && activeSubTab === 'khoahoc';

  return (
    <div className="flex w-full max-w-full h-full bg-[#f4f7f9] overflow-hidden relative">


      {/* CỘT TRÁI: BỘ LỌC ĐƠN VỊ ĐỒNG BỘ */}
      <UnitFilterSidebar
        donViList={donViData}
        selectedUnitFilter={selectedUnitFilter}
        setSelectedUnitFilter={setSelectedUnitFilter}
        allowedDonViIds={allowedDonViIds}
        unitSearchTerm={unitSearchTerm}
        setUnitSearchTerm={setUnitSearchTerm}
        expandedParents={expandedParents}
        setExpandedParents={setExpandedParents}
        isListCollapsed={isListCollapsed}
        setIsListCollapsed={setIsListCollapsed}
        themeColor="emerald"
        allUnitsLabel="Tất cả Đơn vị trực thuộc"
      />

      {/* 🟢 CỘT PHẢI: NỘI DUNG CHÍNH */}
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 relative transition-all duration-300 custom-scrollbar flex flex-col">

        {/* 🟢 KHU VỰC TIÊU ĐỀ, TABS & THẺ THỐNG KÊ CỐ ĐỊNH KHI CUỘN (STICKY HEADER) */}
        <div className={`sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 pt-4 sm:pt-6 ${activeTab === 'daotao' ? 'pb-3 mb-[15px]' : 'pb-4 mb-6'} border-b border-gray-200/80 dark:border-gray-800 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''} shrink-0 shadow-2xs`}>

          {/* 1. Header tiêu đề + Tìm kiếm + Nút Thêm */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-5 gap-4">
            <div className="flex items-center gap-2.5">
              {isListCollapsed && (
                <button
                  onClick={() => setIsListCollapsed(false)}
                  className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-emerald-700 hover:bg-emerald-50 transition-all flex items-center justify-center shrink-0"
                  title="Mở bộ lọc đơn vị"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-black text-emerald-700 flex items-center gap-2"><HardHat size={28} /> Quản lý Hồ sơ ATVSLĐ</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-semibold flex-wrap">
                  <span>Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span></span>
                  <span className="text-gray-300">•</span>
                  <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50/80 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px] shadow-2xs">
                    <span>{atvsldTabs.find(t => t.id === activeTab)?.label}</span>
                    {activeTab === 'daotao' && (
                      <>
                        <ChevronRight size={12} className="text-emerald-400" />
                        <span className="text-emerald-800">{activeSubTab === 'khoahoc' ? 'Khóa Đào tạo/Huấn luyện' : 'Kế hoạch Đào tạo/Huấn luyện'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto relative z-30">
              {activeTab === 'hoso' && (
                <div className="relative w-full sm:w-[256px] h-[32px] shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Tìm tên cơ sở, người phụ trách..."
                    className="w-full sm:w-[256px] h-[32px] pl-8 pr-3 bg-[#FFFFF0] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#05469B] focus:border-[#05469B] outline-none shadow-xs text-xs font-medium transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}

              {/* Nút Đồng bộ dữ liệu (24 x 24 px) */}
              <button
                type="button"
                onClick={() => {
                  loadData();
                  toast.success('Đang đồng bộ dữ liệu ATVSLĐ mới nhất từ Supabase...');
                }}
                title="Đồng bộ / Tải lại dữ liệu mới nhất từ Supabase"
                disabled={loading}
                className="w-[24px] h-[24px] min-w-[24px] p-0 bg-white hover:bg-gray-50 text-gray-700 hover:text-emerald-600 rounded-md border border-gray-200 dark:border-gray-700 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <RotateCcw size={13} className={loading ? 'animate-spin text-emerald-600' : ''} />
              </button>

              {/* Nút Tính năng (119 x 32 px) - Màu xanh lá đặc trưng */}
              {(user?.quyen === 'ADMIN' || user?.quyen === 'USER') && activeTab === 'hoso' && (
                <div className="relative z-50">
                  <button
                    type="button"
                    onClick={() => setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen)}
                    className={`w-[119px] h-[32px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 ${
                      isFeaturesDropdownOpen
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 hover:text-emerald-600'
                    }`}
                  >
                    <Sparkles size={14} className={isFeaturesDropdownOpen ? 'text-amber-300 animate-pulse' : 'text-emerald-600'} />
                    <span>Tính năng</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isFeaturesDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setIsFeaturesDropdownOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 z-[100] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                        <button
                          type="button"
                          onClick={() => {
                            setIsFeaturesDropdownOpen(false);
                            openModal(selectedUnitFilter || '');
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 cursor-pointer"
                        >
                          <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-600">
                            <PlusCircle size={15} />
                          </div>
                          <div>
                            <div className="text-gray-800 font-bold text-xs">Thêm Báo cáo Cơ sở</div>
                            <div className="text-[10px] text-gray-500 font-normal">Tạo báo cáo ATVSLĐ mới</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 🟢 KHU VỰC TABS PHÂN CẤP LIỀN KHỐI (LEVEL 1, 2, 3) */}
          <div className="w-full flex flex-col mt-4 select-none shrink-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 transition-all duration-300">
            {/* --- CẤP 1 --- */}
            <div className={`w-full bg-gray-100 dark:bg-slate-800 flex flex-wrap gap-1 pt-1 px-1 items-center transition-all duration-300 ${isLevel2Open ? 'pb-0 border-b-0' : 'pb-1'}`}>
              {atvsldTabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap outline-none border-none bg-transparent ${
                      isActive
                        ? `text-white font-black z-10 ${isLevel2Open ? 'pb-2.5 sm:pb-3' : ''}`
                        : 'text-gray-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-xl'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="atvsldMainTabSlide"
                        className={`absolute inset-0 z-0 shadow-xs ${isLevel2Open ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'}`}
                        style={{ backgroundColor: '#059669' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    {tab.icon && <span className="relative z-10 shrink-0 flex items-center">{tab.icon}</span>}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* --- CẤP 2 (Chỉ mở khi chọn Đào tạo/Huấn luyện hoặc Khám BNN/Sức khỏe định kỳ) --- */}
            <AnimatePresence initial={false}>
              {isLevel2Open && (
                <motion.div
                  key={isDaotaoOpen ? "level2-daotao" : "level2-suckhoe"}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden bg-emerald-600 dark:bg-emerald-700"
                >
                  {isDaotaoOpen ? (
                    <div className={`w-full flex flex-wrap gap-4 px-4 pt-1.5 items-center transition-all duration-300 ${isLevel3Open ? 'pb-0' : 'pb-1.5'}`}>
                      {[
                        { id: 'khoahoc', label: 'Khóa Đào tạo/Huấn luyện', icon: <GraduationCap className="w-4 h-4" /> },
                        { id: 'kehoach', label: 'Kế hoạch Đào tạo/Huấn luyện', icon: <FileSpreadsheet className="w-4 h-4" /> }
                      ].map(st => {
                        const isSubActive = activeSubTab === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveSubTab(st.id as any)}
                            className={`relative py-1.5 px-4 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                              isSubActive
                                ? `text-white font-black ${isLevel3Open && st.id === 'khoahoc' ? 'pb-2.5 rounded-b-none' : ''}`
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="atvsldDaotaoSubTabSlide"
                                className={`absolute inset-0 bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-500/30 z-0 ${isLevel3Open && st.id === 'khoahoc' ? 'rounded-t-lg rounded-b-none' : 'rounded-lg'}`}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                              {st.icon}
                              <span>{st.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full flex flex-wrap gap-4 px-4 py-1.5 items-center transition-all duration-300">
                      {[
                        { id: 'tonghop', label: 'Đợt KSK Tổng hợp cấp đơn vị', icon: <Building2 className="w-4 h-4" />, count: suckhoeCounts.campaignCount },
                        { id: 'canhan', label: 'Lịch sử KSK chi tiết nhân sự', icon: <Users className="w-4 h-4" />, count: suckhoeCounts.caNhanCount }
                      ].map(st => {
                        const isSubActive = activeSubTabSuckhoe === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveSubTabSuckhoe(st.id as any)}
                            className={`relative py-1.5 px-4 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                              isSubActive ? 'text-white font-black' : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="atvsldSuckhoeSubTabSlide"
                                className="absolute inset-0 bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-500/30 rounded-lg z-0"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                              {st.icon}
                              <span>{st.label}</span>
                            </span>
                            <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isSubActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                              {st.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* --- CẤP 3 (Chỉ mở khi chọn Đào tạo/Huấn luyện -> Khóa Đào tạo/Huấn luyện) --- */}
            <AnimatePresence initial={false}>
              {isLevel3Open && (
                <motion.div
                  key="level3"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden bg-emerald-800 dark:bg-emerald-900"
                >
                  <div className="w-full flex flex-wrap gap-4 px-6 py-2 items-center">
                    {[
                      { id: 'khoahoc', label: 'Khóa Đào tạo/Huấn luyện', icon: <Building2 className="w-3.5 h-3.5" />, count: level3Counts.khoaHocCount },
                      { id: 'canhan', label: 'Lịch Sử Đào Tạo Cá Nhân', icon: <Users className="w-3.5 h-3.5" />, count: level3Counts.caNhanCount }
                    ].map(st => {
                      const isSubActive = activeSubTab3 === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setActiveSubTab3(st.id as any)}
                          className={`relative py-1.5 px-3.5 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-transparent ${
                            isSubActive ? 'text-white font-black' : 'text-white/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {isSubActive && (
                            <motion.div
                              layoutId="atvsldLevel3SubTabSlide"
                              className="absolute inset-0 bg-lime-600 text-white shadow-sm ring-1 ring-lime-400 font-black rounded-lg z-0"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1.5">
                            {st.icon}
                            <span>{st.label}</span>
                          </span>
                          <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isSubActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                            {st.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* 3. Thẻ Thống kê Tổng quan (khi ở Tab 1 - Hồ sơ) */}
          {activeTab === 'hoso' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mt-4">
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md hover:border-emerald-500">
                <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100"><Building2 size={20} /></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Cơ sở khai báo</p><p className="text-xl font-black text-emerald-700">{filteredData.length}</p></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md hover:border-emerald-500">
                <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100"><ShieldCheck size={20} /></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Nhân sự Huấn Luyện</p><p className="text-xl font-black text-emerald-700">{stats.totalNhanSuHL}</p></div>
              </div>
              <div className={`p-3.5 rounded-xl border shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md cursor-pointer ${stats.totalLoi > 0 ? 'border-orange-200 bg-orange-50/10 hover:border-orange-500 animate-pulse' : 'border-gray-300 bg-white hover:border-gray-500'}`} onClick={() => setActiveTab('thietbi')}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stats.totalLoi > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}><AlertCircle size={20} /></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalLoi > 0 ? 'text-orange-600' : 'text-gray-500'}`}>TB Nghiêm ngặt (Quá hạn)</p><p className={`text-xl font-black ${stats.totalLoi > 0 ? 'text-orange-700' : 'text-gray-700'}`}>{stats.totalThietBi} <span className="text-xs text-red-500 font-bold">{stats.totalLoi > 0 ? `(${stats.totalLoi} Lỗi)` : ''}</span></p></div>
              </div>
              <div className={`p-3.5 rounded-xl border shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md ${stats.totalTaiNan > 0 ? 'border-red-200 bg-red-50/10 hover:border-red-500' : 'border-gray-300 bg-white hover:border-gray-500'}`}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stats.totalTaiNan > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}><HardHat size={20} /></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalTaiNan > 0 ? 'text-red-600' : 'text-gray-500'}`}>Tai nạn LĐ (Năm)</p><p className={`text-xl font-black ${stats.totalTaiNan > 0 ? 'text-red-700' : 'text-gray-700'}`}>{stats.totalTaiNan} Vụ</p></div>
              </div>
            </div>
          )}

        </div>

        {/* 🟢 TAB CẤP 1 - PHÂN HỆ 1: HỒ SƠ ATVSLĐ (BÁO CÁO CÁC CƠ SỞ) */}
        {activeTab === 'hoso' && (
          <HoSoTab
            filteredData={filteredData}
            donViMap={donViMap}
            user={user}
            onOpenModal={openModal}
            onDelete={handleDelete}
            isListCollapsed={isListCollapsed}
            khoaHocList={khoaHocData}
            hocVienList={hocVienData}
            thietBiList={thietBiData}
            kiemDinhList={kiemDinhData}
            onNavigateToStrictDevices={() => setActiveTab('thietbi')} // truyền callback drill-down
          />
        )}

        {/* 🟢 TAB CẤP 1 - PHÂN HỆ 2: ĐÀO TẠO / HUẤN LUYỆN */}
        {activeTab === 'daotao' && (
          <div className="flex-1 flex flex-col gap-[15px] w-full">
            {activeSubTab === 'khoahoc' ? (
              <KhoaHocTab
                onReloadData={loadData}
                selectedUnitFilter={selectedUnitFilter}
                allowedDonViIds={allowedDonViIds}
                activeSubTab3={activeSubTab3}
                setActiveSubTab3={setActiveSubTab3}
                onTabCountsChange={(khCount, cnCount) => {
                  setLevel3Counts({ khoaHocCount: khCount, caNhanCount: cnCount });
                }}
              />
            ) : (
              <KeHoachTab
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                safetySearchTerm={safetySearchTerm}
                setSafetySearchTerm={setSafetySearchTerm}
                nhomFilter={nhomFilter}
                setNhomFilter={setNhomFilter}
                safetySummaryCounts={safetySummaryCounts}
                paginatedSafetyList={paginatedSafetyList}
                selectedSafetyIds={selectedSafetyIds}
                totalSafetyPages={totalSafetyPages}
                currentSafetyPage={currentSafetyPage}
                setCurrentSafetyPage={setCurrentSafetyPage}
                rowsPerSafetyPage={rowsPerSafetyPage}
                setRowsPerSafetyPage={setRowsPerSafetyPage}
                filteredSafetyList={filteredSafetyList}
                exportSafetyPlanToExcel={exportSafetyPlanToExcel}
                handleSelectAllSafety={handleSelectAllSafety}
                handleSelectSafetyRow={handleSelectSafetyRow}
                isListCollapsed={isListCollapsed}
              />
            )}
          </div>
        )}

        {/* 🟢 TAB CẤP 1 - PHÂN HỆ 3: THIẾT BỊ YÊU CẦU NGHIÊM NGẶT */}
        {activeTab === 'thietbi' && (
          <StrictEquipmentTab
            selectedUnitFilter={selectedUnitFilter}
            isListCollapsed={isListCollapsed}
            donViList={donViData}
            thietBiList={thietBiData}
            kiemDinhList={kiemDinhData}
            onReload={loadData}
          />
        )}

        {/* 🟢 TAB CẤP 1 - PHÂN HỆ 4: KHÁM SỨC KHỎE & BỆNH NGHỀ NGHIỆP */}
        {activeTab === 'khamsuckhoe' && (
          <SucKhoeTab
            selectedUnitFilter={selectedUnitFilter || ''}
            allowedDonViIds={allowedDonViIds}
            donViList={donViData}
            onReloadData={loadData}
            activeSubTabSuckhoe={activeSubTabSuckhoe}
            setActiveSubTabSuckhoe={setActiveSubTabSuckhoe}
            onTabCountsChange={(campCount, caNhanCount) => {
              setSuckhoeCounts({ campaignCount: campCount, caNhanCount });
            }}
          />
        )}

      </div>

      {/* 🟢 MODAL THÊM/SỬA BÁO CÁO CƠ SỞ */}
      <AtvsldModal
        isOpen={isModalOpen}
        currentData={currentData}
        selectedUnitId={selectedUnitId}
        onSaved={(data, isCreate) => {
          if (isCreate) setAtvsldData(prev => [data, ...prev]);
          else setAtvsldData(prev => prev.map(item => item.id === data.id ? data : item));
        }}
        onClose={() => setIsModalOpen(false)}
      />

      {/* 🟢 CUSTOM CONFIRM MODAL XÓA HỒ SƠ */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-lime-50 text-lime-600 flex items-center justify-center mx-auto mb-4 border-4 border-lime-100"><AlertCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa?</h3>
            <p className="text-gray-500 text-sm mb-6">Bạn có chắc chắn muốn xóa hồ sơ báo cáo ATVSLĐ của đơn vị này? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
              <button onClick={confirmDelete} className="flex-1 py-3 text-white bg-lime-600 hover:bg-lime-700 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-colors"><Trash2 className="w-5 h-5" /> Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}