{/*🟢 PHẦN 1: TỪ ĐẦU FILE ĐẾN HẾT KHAI BÁO STATE CƠ BẢN*/}
import React, { useState, useEffect, useMemo } from 'react';
import { 
  HardHat, Search, Edit, Trash2, AlertCircle, Loader2, ShieldCheck, 
  Building2, MapPin, PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown, Plus,
  FileText, Users, Settings, Link as LinkIcon, CheckCircle2, XCircle,
  FileSpreadsheet, Download, AlertTriangle, CheckCheck, HelpCircle, ChevronLeft,
  Wrench, Heart
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from '../utils/toast';
import AtvsldModal from '../components/department/AtvsldModal';
import HoSoTab from '../components/atvsld/HoSoTab';
import KeHoachTab from '../components/atvsld/KeHoachTab';
import KhoaHocTab from '../components/atvsld/KhoaHocTab';
import StrictEquipmentTab from '../components/atvsld/StrictEquipmentTab';
import { getExpiryStatus } from '../utils/expiryStatus';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { GraduationCap } from 'lucide-react';
import { groupParentUnits, sortDonViByThuTu, getUnitEmoji, getAllSubordinateIds } from '../utils/hierarchy';
import UnitFilterSidebar from '../components/ui/UnitFilterSidebar';
import Pagination from '../components/ui/Pagination';
import { useAllowedUnits } from '../hooks/useAllowedUnits';
import { toUnaccented, stripAccents } from '../utils/formatters';

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
  const [activeSubTab, setActiveSubTab] = useState<'kehoach' | 'khoahoc'>('kehoach');

  // Tab Hồ sơ (Cũ)
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentData, setCurrentData] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Tab Kế hoạch ATVSLĐ (Mới)
  const [safetySearchTerm, setSafetySearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN'>('ALL');
  const [nhomFilter, setNhomFilter] = useState<string>('ALL');
  const [selectedSafetyIds, setSelectedSafetyIds] = useState<string[]>([]);
  const [currentSafetyPage, setCurrentSafetyPage] = useState(1);
  const [rowsPerSafetyPage, setRowsPerSafetyPage] = useState(50);

  // 🟢 KÉO CÙNG LÚC 8 BẢNG DỮ LIỆU
  const loadData = async () => {
    setLoading(true);
    try {
      const [dvResult, atResult, nsResult, khResult, hvResult, ckResult, tbResult, kdResult] = await Promise.all([
        apiService.getDonVi(),
        apiService.getATVSLD ? apiService.getATVSLD().catch(() => []) : Promise.resolve([]),
        apiService.getPersonnel(),
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



  const selectedUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return [];
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViData);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViData]);

{/*🟢 PHẦN 2: LOGIC XỬ LÝ DỮ LIỆU & XUẤT EXCEL KẾ HOẠCH*/}
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
        const isDat = String(hv.ket_qua || '').trim().toLowerCase().includes('đạt') || String(hv.ket_qua || '').trim().toLowerCase().includes('dat');
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
          <td>${p.phan_loai || ''}</td>
          <td>${p.phong_ban || ''}</td>
          <td>${p.donViText || ''}</td>
          <td>${p.showroomText || ''}</td>
          <td>${p.phiaText || ''}</td>
          <td>${p.chuc_vu || ''}</td>
          <td style="mso-number-format:'\\@'; text-align: center;">${p.sdt_cong_ty || ''}</td>
          <td style="text-align: center;">${p.gioi_tinh || ''}</td>
          <td style="text-align: center;">${p.nam_sinh ? new Date(p.nam_sinh).toLocaleDateString('vi-VN') : ''}</td>
          <td style="text-align: center;">${p.ngay_nhan_vien ? new Date(p.ngay_nhan_vien).toLocaleDateString('vi-VN') : ''}</td>
          <td style="mso-number-format:'\\@'; text-align: center;">${p.sdt_ca_nhan || ''}</td>
          <td>${p.email || ''}</td>
          <td style="text-align: center;">${p.ngach_luong || ''}</td>
          <td style="text-align: center; font-weight: bold; color: #05469B;">${p.nhom_doi_tuong || ''}</td>
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
              <th>Mã NV</th>
              <th>Họ tên</th>
              <th>Chức vụ</th>
              <th>Bộ phận</th>
              <th>Đơn vị</th>
              <th>Showroom</th>
              <th>Phía</th>
              <th>Chức danh</th>
              <th>SDT Cty</th>
              <th>Giới tính</th>
              <th>Năm sinh</th>
              <th>Ngày nhận việc</th>
              <th>SDT CNhan</th>
              <th>Email</th>
              <th>Ngạch</th>
              <th>Nhóm</th>
              <th>Từ</th>
              <th>Đến</th>
              <th>Giá trị đến</th>
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

  {/*🟢 PHẦN 3: GIAO DIỆN CHUNG & TAB HỒ SƠ ATVSLĐ CƠ SỞ*/}

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

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
        allUnitsLabel="Tất cả Cơ sở Toàn quốc"
      />

      {/* 🟢 CỘT PHẢI: NỘI DUNG CHÍNH */}
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 relative transition-all duration-300 custom-scrollbar flex flex-col">
        
        {/* 🟢 KHU VỰC TIÊU ĐỀ, TABS & THẺ THỐNG KÊ CỐ ĐỊNH KHI CUỘN (STICKY HEADER) */}
        <div className={`sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 pt-4 sm:pt-6 pb-4 border-b border-gray-200/80 dark:border-gray-800 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''} shrink-0 mb-6 shadow-2xs`}>
          
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
                <p className="text-sm font-medium text-gray-500 mt-1">Đang xem: <span className="text-emerald-600 font-bold">{selectedUnitName}</span></p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {activeTab === 'hoso' && (
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Tìm tên cơ sở, người phụ trách..." 
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs text-xs font-semibold" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
              )}

              {user?.quyen === 'ADMIN' && activeTab === 'hoso' && (
                <button 
                  type="button"
                  onClick={() => openModal(selectedUnitFilter || '')} 
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Báo cáo Cơ sở</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Khu vực Chuyển Tab Cấp 1 */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-5 flex flex-wrap gap-6 px-1">
            <button onClick={() => setActiveTab('hoso')} className={`py-2.5 text-sm font-black transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'hoso' ? 'text-lime-700 dark:text-lime-400' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              <Building2 size={18} /> Hồ sơ Báo cáo Cơ sở
              {activeTab === 'hoso' && <div className="absolute bottom-0 left-0 w-full h-1 bg-lime-600 rounded-t-md animate-in slide-in-from-left-2 duration-300"></div>}
            </button>
            <button onClick={() => setActiveTab('daotao')} className={`py-2.5 text-sm font-black transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'daotao' ? 'text-lime-700 dark:text-lime-400' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              <GraduationCap size={18} /> Đào tạo ATVSLĐ
              {activeTab === 'daotao' && <div className="absolute bottom-0 left-0 w-full h-1 bg-lime-600 rounded-t-md animate-in slide-in-from-right-2 duration-300"></div>}
            </button>
            <button onClick={() => setActiveTab('thietbi')} className={`py-2.5 text-sm font-black transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'thietbi' ? 'text-lime-700 dark:text-lime-400' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              <Wrench size={18} /> Thiết bị yêu cầu nghiêm ngặt
              {activeTab === 'thietbi' && <div className="absolute bottom-0 left-0 w-full h-1 bg-lime-600 rounded-t-md animate-in slide-in-from-right-2 duration-300"></div>}
            </button>
            <button onClick={() => setActiveTab('khamsuckhoe')} className={`py-2.5 text-sm font-black transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'khamsuckhoe' ? 'text-lime-700 dark:text-lime-400' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              <Heart size={18} /> Khám sức khỏe
              {activeTab === 'khamsuckhoe' && <div className="absolute bottom-0 left-0 w-full h-1 bg-lime-600 rounded-t-md animate-in slide-in-from-right-2 duration-300"></div>}
            </button>
          </div>

          {/* Sub-navigation Cấp 2 (Chỉ xuất hiện khi chọn Tab Đào tạo ATVSLĐ) */}
          {activeTab === 'daotao' && (
            <div className="flex gap-4 mb-5 border-b border-gray-150/50 pb-2 px-1">
              <button 
                onClick={() => setActiveSubTab('kehoach')} 
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'kehoach' 
                    ? 'bg-lime-600 text-white shadow-sm border border-lime-600' 
                    : 'bg-white text-gray-500 border border-gray-250 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                Kế hoạch đào tạo đợt tới
              </button>
              <button 
                onClick={() => setActiveSubTab('khoahoc')} 
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'khoahoc' 
                    ? 'bg-lime-600 text-white shadow-sm border border-lime-600' 
                    : 'bg-white text-gray-500 border border-gray-250 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                Khóa học huấn luyện
              </button>
            </div>
          )}

          {/* 3. Thẻ Thống kê Tổng quan (khi ở Tab 1 - Hồ sơ) */}
          {activeTab === 'hoso' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md hover:border-emerald-500">
                <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100"><Building2 size={20}/></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Cơ sở khai báo</p><p className="text-xl font-black text-emerald-700">{filteredData.length}</p></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md hover:border-emerald-500">
                <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100"><ShieldCheck size={20}/></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Nhân sự Huấn Luyện</p><p className="text-xl font-black text-emerald-700">{stats.totalNhanSuHL}</p></div>
              </div>
              <div className={`p-3.5 rounded-xl border shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md cursor-pointer ${stats.totalLoi > 0 ? 'border-orange-200 bg-orange-50/10 hover:border-orange-500 animate-pulse' : 'border-gray-300 bg-white hover:border-gray-500'}`} onClick={() => setActiveTab('thietbi')}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stats.totalLoi > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}><AlertCircle size={20}/></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalLoi > 0 ? 'text-orange-600' : 'text-gray-500'}`}>TB Nghiêm ngặt (Quá hạn)</p><p className={`text-xl font-black ${stats.totalLoi > 0 ? 'text-orange-700' : 'text-gray-700'}`}>{stats.totalThietBi} <span className="text-xs text-red-500 font-bold">{stats.totalLoi > 0 ? `(${stats.totalLoi} Lỗi)` : ''}</span></p></div>
              </div>
              <div className={`p-3.5 rounded-xl border shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md ${stats.totalTaiNan > 0 ? 'border-red-200 bg-red-50/10 hover:border-red-500' : 'border-gray-300 bg-white hover:border-gray-500'}`}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stats.totalTaiNan > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}><HardHat size={20}/></div>
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

        {/* 🟢 TAB CẤP 1 - PHÂN HỆ 2: ĐÀO TẠO ATVSLĐ (Gồm 2 Sub-tabs) */}
        {activeTab === 'daotao' && activeSubTab === 'kehoach' && (
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

        {activeTab === 'daotao' && activeSubTab === 'khoahoc' && (
          <KhoaHocTab onReloadData={loadData} />
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

        {/* 🟢 TAB CẤP 1 - PHÂN HỆ 4: KHÁM SỨC KHỎE (SẮP CẬP NHẬT) */}
        {activeTab === 'khamsuckhoe' && (
          <div className="bg-white border border-lime-100 p-16 rounded-2xl shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-lime-50 text-lime-600 flex items-center justify-center mx-auto mb-4 border-4 border-lime-100">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-lime-800 mb-2">Phân hệ Khám sức khỏe & Bệnh nghề nghiệp</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">Phân hệ này hiện đang được lên kế hoạch phát triển ở các giai đoạn tiếp theo. Dữ liệu khám sức khỏe định kỳ và quản lý bệnh nghề nghiệp của nhân sự sẽ được tập trung tại đây.</p>
          </div>
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