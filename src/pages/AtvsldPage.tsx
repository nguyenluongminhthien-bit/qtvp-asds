{/*🟢 PHẦN 1: TỪ ĐẦU FILE ĐẾN HẾT KHAI BÁO STATE CƠ BẢN*/}
import React, { useState, useEffect, useMemo } from 'react';
import { 
  HardHat, Search, Edit, Trash2, AlertCircle, Loader2, ShieldCheck, 
  Building2, MapPin, PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown, Plus,
  FileText, Users, Settings, Link as LinkIcon, CheckCircle2, XCircle,
  FileSpreadsheet, Download, AlertTriangle, CheckCheck, HelpCircle, ChevronLeft
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from '../utils/toast';
import AtvsldModal from '../components/department/AtvsldModal';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
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
  const [loading, setLoading] = useState(true);
  
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  
  // 🟢 STATE CHUYỂN TAB
  const [activeTab, setActiveTab] = useState<'hoso' | 'kehoach'>('hoso');

  // Tab Hồ sơ (Cũ)
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentData, setCurrentData] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Tab Kế hoạch ATVSLĐ (Mới)
  const [safetySearchTerm, setSafetySearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN'>('ALL');
  const [nhomFilter, setNhomFilter] = useState<string>('ALL');
  const [selectedSafetyIds, setSelectedSafetyIds] = useState<string[]>([]);
  const [currentSafetyPage, setCurrentSafetyPage] = useState(1);
  const [rowsPerSafetyPage, setRowsPerSafetyPage] = useState(50);

  // 🟢 KÉO CÙNG LÚC 3 BẢNG DỮ LIỆU
  const loadData = async () => {
    setLoading(true);
    try {
      const [dvResult, atResult, nsResult] = await Promise.all([
        apiService.getDonVi(),
        apiService.getATVSLD ? apiService.getATVSLD().catch(() => []) : Promise.resolve([]),
        apiService.getPersonnel()
      ]);
      setDonViList(dvResult || []);
      setAtvsldData(atResult || []);
      setPersonnelData(nsResult || []);
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
    filteredData.forEach(item => {
      totalThietBi += Number(item.so_luong_thiet_bi_nghiem_ngat) || 0;
      totalLoi += Number(item.so_luong_thiet_bi_qua_han_kt) || 0;
      totalTaiNan += Number(item.so_tai_nan_trong_nam) || 0;
      if (item.thong_ke_hl) {
        let hlStats = item.thong_ke_hl;
        if (typeof hlStats === 'string') {
          try { hlStats = JSON.parse(hlStats); } catch (e) { hlStats = null; }
        }
        if (hlStats) {
          ['1', '2', '3', '4', '6'].forEach(nhom => {
            if (hlStats[nhom]) totalNhanSuHL += (hlStats[nhom].total || 0);
          });
        }
      }
    });
    return { totalThietBi, totalLoi, totalTaiNan, totalNhanSuHL };
  }, [filteredData]);

  const openModal = (unitId: string, data: any = null) => {
    setSelectedUnitId(unitId);
    setCurrentData(data);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ này?')) return;
    try {
      await apiService.delete(id, 'hs_an_toan_lao_dong');
      setAtvsldData(prev => prev.filter(item => item.id !== id));
      toast.success('Đã xóa hồ sơ!');
    } catch (err) {
      toast.error('Lỗi khi xóa hồ sơ.');
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
      
      {/* NÚT MỞ SIDEBAR NẾU ĐANG ẨN */}
      {isListCollapsed && (
        <button onClick={() => setIsListCollapsed(false)} className="hidden md:block absolute top-6 left-6 z-20 bg-white p-2.5 rounded-lg shadow-md border border-gray-200 text-emerald-700 hover:bg-emerald-50 transition-all" title="Mở bộ lọc đơn vị">
          <PanelLeftOpen size={20} />
        </button>
      )}

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
      <div className="flex-1 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 relative transition-all duration-300 custom-scrollbar flex flex-col">
        
        {/* 🟢 KHU VỰC TIÊU ĐỀ, TABS & THẺ THỐNG KÊ CỐ ĐỊNH KHI CUỘN (STICKY HEADER) */}
        <div className={`sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 pt-1 pb-4 border-b border-gray-200/80 dark:border-gray-800 transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''} shrink-0 mb-6 shadow-2xs`}>
          
          {/* 1. Header tiêu đề + Tìm kiếm + Nút Thêm */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-5 gap-4">
            <div className="flex items-center gap-2.5">
              {isListCollapsed && (
                <button 
                  onClick={() => setIsListCollapsed(false)} 
                  className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-emerald-700 hover:bg-emerald-50 transition-all flex items-center justify-center shrink-0"
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

          {/* 2. Khu vực Chuyển Tab */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-5 flex gap-6 px-1">
            <button onClick={() => setActiveTab('hoso')} className={`py-2.5 text-sm font-black transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'hoso' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              <Building2 size={18} /> Hồ sơ Báo cáo Cơ sở
              {activeTab === 'hoso' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-600 rounded-t-md animate-in slide-in-from-left-2 duration-300"></div>}
            </button>
            <button onClick={() => setActiveTab('kehoach')} className={`py-2.5 text-sm font-black transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'kehoach' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              <ShieldCheck size={18} /> Kế hoạch Đào tạo đợt tới
              {activeTab === 'kehoach' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-600 rounded-t-md animate-in slide-in-from-right-2 duration-300"></div>}
            </button>
          </div>

          {/* 3. Thẻ Thống kê Tổng quan (khi ở Tab 1 - Hồ sơ) */}
          {activeTab === 'hoso' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1400px]">
              <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md">
                <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Building2 size={20}/></div>
                <div><p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Cơ sở khai báo</p><p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{filteredData.length}</p></div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md">
                <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><ShieldCheck size={20}/></div>
                <div><p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Nhân sự Huấn Luyện</p><p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{stats.totalNhanSuHL}</p></div>
              </div>
              <div className={`bg-white dark:bg-gray-800 p-3.5 rounded-xl border shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md ${stats.totalLoi > 0 ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stats.totalLoi > 0 ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}><AlertCircle size={20}/></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalLoi > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>TB Nghiêm ngặt (Quá hạn)</p><p className={`text-xl font-black ${stats.totalLoi > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'}`}>{stats.totalThietBi} <span className="text-xs text-red-500 font-bold">{stats.totalLoi > 0 ? `(${stats.totalLoi} Lỗi)` : ''}</span></p></div>
              </div>
              <div className={`bg-white dark:bg-gray-800 p-3.5 rounded-xl border shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md ${stats.totalTaiNan > 0 ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stats.totalTaiNan > 0 ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}><HardHat size={20}/></div>
                <div><p className={`text-[10px] font-bold uppercase ${stats.totalTaiNan > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Tai nạn LĐ (Năm)</p><p className={`text-xl font-black ${stats.totalTaiNan > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>{stats.totalTaiNan} Vụ</p></div>
              </div>
            </div>
          )}

        </div>

        {/* 🟢 TAB 1: HỒ SƠ ATVSLĐ (BÁO CÁO CÁC CƠ SỞ) */}
        {activeTab === 'hoso' && (
          <div className={`transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''}`}>
            <div className="max-w-[1400px] mx-auto space-y-6">

              {/* DANH SÁCH CHI TIẾT DẠNG THẺ (CARD LAYOUT) */}
              {filteredData.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
                  <Search size={48} className="mx-auto mb-4 text-gray-300"/>
                  <p className="text-lg font-medium text-gray-500">Không tìm thấy hồ sơ an toàn lao động.</p>
                  {user?.quyen === 'ADMIN' && <p className="text-sm mt-1">Bấm nút "Thêm Báo cáo Cơ sở" để tạo mới.</p>}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredData.map(item => {
                    let hlStats: Record<string, {total: number, dat: number, khong_dat: number}> | null = null;
                    if (item.thong_ke_hl) {
                      try { hlStats = typeof item.thong_ke_hl === 'string' ? JSON.parse(item.thong_ke_hl) : item.thong_ke_hl; } 
                      catch (e) {}
                    }

                    let sumTotal = 0, sumDat = 0, sumKhongDat = 0;
                    const activeGroups: any[] = [];
                    ['1', '2', '3', '4', '6'].forEach(g => {
                      if (hlStats && hlStats[g] && hlStats[g].total > 0) {
                        sumTotal += hlStats[g].total;
                        sumDat += hlStats[g].dat;
                        sumKhongDat += hlStats[g].khong_dat;
                        activeGroups.push({ nhom: `Nhóm ${g}`, ...hlStats[g] });
                      }
                    });

                    return (
                      <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden hover:shadow-md transition-shadow">
                        
                        {/* Card Header */}
                        <div className="bg-emerald-50/70 border-b border-emerald-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0 border border-emerald-200">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-emerald-800 tracking-wide uppercase">{donViMap[String(item.id_don_vi)] || item.id_don_vi}</h3>
                              <p className="text-[11px] font-bold text-emerald-600/70 uppercase">MÃ HỒ SƠ: {item.id}</p>
                            </div>
                          </div>
                          
                          {user?.quyen === 'ADMIN' && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openModal(item.id_don_vi, item)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"><Edit size={14}/> Sửa</button>
                              <button onClick={() => handleDelete(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"><Trash2 size={14}/> Xóa</button>
                            </div>
                          )}
                        </div>

                        <div className="p-5 sm:p-6 space-y-6">
                          {/* SECTION 1: HUẤN LUYỆN */}
                          <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-white border-b border-gray-100">
                              <p className="text-sm font-bold text-gray-800 mb-1 leading-relaxed">
                                {item.can_cu_quyet_dinh || 'Chưa cập nhật Quyết định Huấn luyện'}
                              </p>
                              <p className="text-[13px] font-semibold text-emerald-600 flex items-center gap-1.5">
                                <ShieldCheck size={16}/> Khoá huấn luyện: {item.khoa_huan_luyen_tu ? new Date(item.khoa_huan_luyen_tu).toLocaleDateString('vi-VN') : '---'} - {item.khoa_huan_luyen_den ? new Date(item.khoa_huan_luyen_den).toLocaleDateString('vi-VN') : '---'}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-gray-100 bg-gray-50/50">
                              <div className="p-4 text-center border-b md:border-b-0 md:border-r border-gray-100">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TỔNG SỐ NGƯỜI</p>
                                <p className="text-3xl font-black text-blue-700">{sumTotal}</p>
                              </div>
                              <div className="p-4 text-center border-b md:border-b-0 md:border-r border-gray-100">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">ĐẠT YÊU CẦU</p>
                                <p className="text-3xl font-black text-emerald-600">{sumDat}</p>
                              </div>
                              <div className="p-4 text-center">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">KHÔNG ĐẠT</p>
                                <p className={`text-3xl font-black ${sumKhongDat > 0 ? 'text-red-600' : 'text-gray-400'}`}>{sumKhongDat}</p>
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-center text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nhóm</th>
                                    <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số lượng</th>
                                    <th className="p-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tỉ lệ (%)</th>
                                    <th className="p-3 text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Đạt (SL & %)</th>
                                    <th className="p-3 text-[11px] font-bold text-red-500 uppercase tracking-wider">Không đạt (SL & %)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {activeGroups.map((g, idx) => {
                                    const pctNhom = sumTotal > 0 ? ((g.total / sumTotal) * 100).toFixed(2) : 0;
                                    const pctDat = g.total > 0 ? ((g.dat / g.total) * 100).toFixed(0) : 0;
                                    const pctKhongDat = g.total > 0 ? ((g.khong_dat / g.total) * 100).toFixed(0) : 0;
                                    return (
                                      <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="p-3 font-bold text-[#05469B]">{g.nhom}</td>
                                        <td className="p-3 font-semibold text-gray-700">{g.total}</td>
                                        <td className="p-3 font-semibold text-gray-700">{pctNhom}%</td>
                                        <td className="p-3 font-bold text-emerald-600">{g.dat} <span className="text-xs text-gray-400 font-medium">({pctDat}%)</span></td>
                                        <td className={`p-3 font-bold ${g.khong_dat > 0 ? 'text-red-500' : 'text-gray-400'}`}>{g.khong_dat} <span className="text-xs text-gray-300 font-medium">({pctKhongDat}%)</span></td>
                                      </tr>
                                    );
                                  })}
                                  {activeGroups.length > 0 && (
                                    <tr className="bg-gray-50/80 border-t-2 border-gray-200">
                                      <td className="p-3 font-black text-gray-800 uppercase">TỔNG CỘNG</td>
                                      <td className="p-3 font-black text-blue-700">{sumTotal}</td>
                                      <td className="p-3 font-black text-blue-700">{sumTotal > 0 ? '100' : '0'}%</td>
                                      <td className="p-3 font-black text-emerald-600">{sumDat} <span className="text-xs text-gray-500">({sumTotal > 0 ? Math.round((sumDat/sumTotal)*100) : 0}%)</span></td>
                                      <td className={`p-3 font-black ${sumKhongDat > 0 ? 'text-red-500' : 'text-gray-500'}`}>{sumKhongDat} <span className="text-xs text-gray-400">({sumTotal > 0 ? Math.round((sumKhongDat/sumTotal)*100) : 0}%)</span></td>
                                    </tr>
                                  )}
                                  {activeGroups.length === 0 && (
                                    <tr><td colSpan={5} className="p-6 text-gray-400 italic">Chưa có số liệu huấn luyện</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <p className="text-[13px] font-semibold text-gray-600 flex items-center gap-2">
                                Tỷ lệ hoàn thành HL Chung: <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-black rounded-md">{item.ty_le_hoan_thanh_hl || '0%'}</span>
                              </p>
                              {item.link_ho_so_quy_dinh ? (
                                <a href={item.link_ho_so_quy_dinh} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-[#05469B] flex items-center gap-1.5 hover:underline">
                                  <LinkIcon size={14}/> Xem Hồ sơ gốc
                                </a>
                              ) : (
                                <span className="text-[12px] text-gray-400 italic flex items-center gap-1"><LinkIcon size={12}/> Chưa có Link Hồ sơ gốc</span>
                              )}
                            </div>
                          </div>

                          {/* SECTION 2 & 3: GRID 2 CỘT */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* 2. Tổ chức & Y tế */}
                            <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm">
                              <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-blue-100 pb-2">
                                <Users size={18} className="text-blue-500"/> 2. Tổ chức & Y tế
                              </h4>
                              <div className="space-y-3 text-[13px]">
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <span className="text-gray-500 font-medium">Phụ trách ATVSLĐ:</span>
                                  <span className="font-bold text-[#05469B]">{item.nguoi_phu_trach || '---'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <span className="text-gray-500 font-medium">Mạng lưới ATVS Viên:</span>
                                  <span className="font-bold text-gray-800">{item.so_luong_mang_luoi || '0'} Người</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <span className="text-gray-500 font-medium">Khám SK / Bệnh nghề nghiệp:</span>
                                  <span className="font-bold text-gray-800">
                                    {item.ngay_ksk ? new Date(item.ngay_ksk).toLocaleDateString('vi-VN') : '---'} / {item.ngay_kham_bnn ? new Date(item.ngay_kham_bnn).toLocaleDateString('vi-VN') : '---'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500 font-medium">Cấp phát BHLĐ:</span>
                                  <span className={`font-bold ${item.ty_le_cap_bhld === 'Đầy đủ' ? 'text-emerald-600' : 'text-orange-500'}`}>{item.ty_le_cap_bhld || '---'}</span>
                                </div>
                              </div>
                            </div>

                            {/* 3. Máy móc & Hiện trường */}
                            <div className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
                              <h4 className="font-bold text-red-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-red-100 pb-2">
                                <Settings size={18} className="text-red-500"/> 3. Máy móc & Hiện trường
                              </h4>
                              <div className="space-y-3 text-[13px]">
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <span className="text-gray-500 font-medium">Đo kiểm Môi trường:</span>
                                  <span className="font-bold text-gray-800">{item.ngay_quan_trac_mt ? new Date(item.ngay_quan_trac_mt).toLocaleDateString('vi-VN') : 'Chưa đo'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <span className="text-gray-500 font-medium">TB Nghiêm ngặt (Tổng / Quá hạn):</span>
                                  <span className="font-black text-gray-800">
                                    {item.so_luong_thiet_bi_nghiem_ngat || '0'} / <span className={Number(item.so_luong_thiet_bi_qua_han_kt) > 0 ? 'text-red-600' : 'text-emerald-600'}>{item.so_luong_thiet_bi_qua_han_kt || '0'}</span>
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-gray-500 font-medium">Số vụ Tai nạn (Năm):</span>
                                  <span className={`font-black ${Number(item.so_tai_nan_trong_nam) > 0 ? 'text-red-600' : 'text-gray-800'}`}>{item.so_tai_nan_trong_nam || '0'} Vụ</span>
                                </div>
                                
                                <div className="pt-2">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">TUẦN TRA & LỖI HIỆN TRƯỜNG:</span>
                                  {item.cac_loi_hien_truong ? (
                                    <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-medium flex items-start gap-2">
                                      <XCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                                      <span className="leading-relaxed">{item.cac_loi_hien_truong}</span>
                                    </div>
                                  ) : (
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                      <CheckCircle2 size={14} className="text-emerald-500"/> 
                                      Không có lỗi / Đã xử lý (Kiểm tra: {item.ngay_tu_kiem_tra ? new Date(item.ngay_tu_kiem_tra).toLocaleDateString('vi-VN') : '---'})
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

{/*PHẦN 4: TAB KẾ HOẠCH ĐÀO TẠO ATVSLĐ VÀ MODALS*/}
        {/* 🟢 TAB 2: KẾ HOẠCH ĐÀO TẠO ATVSLĐ (TÍNH NĂNG MỚI) */}
        {activeTab === 'kehoach' && (
          <div className={`transition-all duration-300 flex flex-col h-full ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
            
            {/* KHỐI 4 THẺ CHỈ SỐ KPI TÌNH TRẠNG THẺ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5 shrink-0">
              <div onClick={() => setStatusFilter('CHUA_HOC')} className={`p-4 bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all flex items-center gap-4 ${statusFilter === 'CHUA_HOC' ? 'border-red-500 bg-red-50/20' : 'border-gray-200 hover:border-red-300'}`}>
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0"><HelpCircle size={20}/></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chưa huấn luyện</p><p className="text-2xl font-black text-red-600">{safetySummaryCounts.chua_hoc}</p></div>
              </div>
              <div onClick={() => setStatusFilter('QUA_HAN')} className={`p-4 bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all flex items-center gap-4 ${statusFilter === 'QUA_HAN' ? 'border-gray-800 bg-gray-100' : 'border-gray-200 hover:border-gray-400'}`}>
                <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-800 flex items-center justify-center shrink-0"><AlertTriangle size={20}/></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Đã quá hạn thẻ</p><p className="text-2xl font-black text-gray-900">{safetySummaryCounts.qua_han}</p></div>
              </div>
              <div onClick={() => setStatusFilter('SAP_HET_HAN')} className={`p-4 bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all flex items-center gap-4 ${statusFilter === 'SAP_HET_HAN' ? 'border-orange-500 bg-orange-50/20' : 'border-gray-200 hover:border-orange-300'}`}>
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><AlertTriangle size={20}/></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Sắp hết hạn (&lt;60 ngày)</p><p className="text-2xl font-black text-orange-600">{safetySummaryCounts.sap_het_han}</p></div>
              </div>
              <div onClick={() => setStatusFilter('AN_TOAN')} className={`p-4 bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all flex items-center gap-4 ${statusFilter === 'AN_TOAN' ? 'border-emerald-500 bg-emerald-50/20' : 'border-gray-200 hover:border-emerald-300'}`}>
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><CheckCheck size={20}/></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Thẻ hợp lệ (An toàn)</p><p className="text-2xl font-black text-emerald-600">{safetySummaryCounts.an_toan}</p></div>
              </div>
            </div>

            {/* THANH THAO TÁC, BỘ LỌC VÀ NÚT XUẤT EXCEL */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="text" placeholder="Tìm Mã NV, Họ tên..." value={safetySearchTerm} onChange={(e) => setSafetySearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                
                <select value={nhomFilter} onChange={(e) => setNhomFilter(e.target.value)} className="py-1.5 px-3 border border-gray-200 rounded text-xs text-gray-700 outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="ALL">-- Tất cả nhóm --</option>
                  <option value="1">Nhóm 1</option>
                  <option value="2">Nhóm 2</option>
                  <option value="3">Nhóm 3</option>
                  <option value="4">Nhóm 4</option>
                  <option value="6">Nhóm 6</option>
                </select>

                {statusFilter !== 'ALL' && (
                  <button onClick={() => setStatusFilter('ALL')} className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded hover:bg-emerald-100 border border-emerald-200">
                    Xóa lọc (Đang xem: {statusFilter})
                  </button>
                )}
              </div>

              <button 
                onClick={exportSafetyPlanToExcel} 
                disabled={selectedSafetyIds.length === 0}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors"
              >
                <FileSpreadsheet size={16}/> Xuất danh sách huấn luyện đợt tới ({selectedSafetyIds.length})
              </button>
            </div>

            {/* BẢNG SỐ LIỆU CHI TIẾT DANH SÁCH NHÂN SỰ */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
              <div className="overflow-x-auto w-full flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
                  <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
                    <tr className="border-b border-gray-200 font-bold text-gray-600 uppercase">
                      <th className="p-3 text-center w-12"><input type="checkbox" onChange={handleSelectAllSafety} checked={paginatedSafetyList.length > 0 && paginatedSafetyList.every(p => selectedSafetyIds.includes(p.id))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"/></th>
                      <th className="p-3 w-24">Mã NV</th>
                      <th className="p-3">Họ và Tên</th>
                      <th className="p-3">Đơn vị / Showroom</th>
                      <th className="p-3">Bộ phận / Chức danh</th>
                      <th className="p-3 text-center w-16">Nhóm</th>
                      <th className="p-3 text-center w-28">Hạn Thẻ</th>
                      <th className="p-3 text-center w-28">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedSafetyList.length === 0 ? (
                      <tr><td colSpan={8} className="p-12 text-center text-gray-400 italic">Không tìm thấy nhân sự nào thuộc diện cần quét.</td></tr>
                    ) : (
                      paginatedSafetyList.map(p => {
                        let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                        let badgeText = "Hợp lệ";
                        if (p.trainingStatus === 'CHUA_HOC') { badgeClass = "bg-red-100 text-red-700 border-red-200"; badgeText = "Chưa học"; }
                        else if (p.trainingStatus === 'QUA_HAN') { badgeClass = "bg-gray-100 text-gray-700 border-gray-300 font-bold"; badgeText = "Quá hạn"; }
                        else if (p.trainingStatus === 'SAP_HET_HAN') { badgeClass = "bg-orange-100 text-orange-800 border-orange-200 animate-pulse"; badgeText = `Còn ${p.remainingDays} ngày`; }

                        return (
                          <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="p-3 text-center">
                              <input type="checkbox" checked={selectedSafetyIds.includes(p.id)} onChange={(e) => handleSelectSafetyRow(p.id, e.target.checked)} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded cursor-pointer"/>
                            </td>
                            <td className="p-3 font-bold text-gray-700">{p.ma_so_nhan_vien}</td>
                            <td className="p-3 font-bold text-[#05469B]">{p.ho_ten}</td>
                            <td className="p-3">
                              <p className="font-semibold text-gray-800">{p.donViText}</p>
                              <p className="text-[10px] text-gray-400">{p.showroomText} • {p.phiaText}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-gray-700">{p.phong_ban || '---'}</p>
                              <p className="text-[10px] text-gray-500">{p.chuc_vu} ({p.phan_loai})</p>
                            </td>
                            <td className="p-3 text-center font-bold text-[#05469B] text-sm">{p.nhom_doi_tuong || '---'}</td>
                            <td className="p-3 text-center font-mono font-semibold text-gray-600">
                              {p.gia_tri_den ? new Date(p.gia_tri_den).toLocaleDateString('vi-VN') : '---'}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block min-w-16 ${badgeClass}`}>{badgeText}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={currentSafetyPage}
                totalPages={totalSafetyPages}
                onPageChange={setCurrentSafetyPage}
                rowsPerPage={rowsPerSafetyPage}
                onRowsPerPageChange={(rows) => {
                  setRowsPerSafetyPage(rows);
                  setCurrentSafetyPage(1);
                }}
                totalRows={filteredSafetyList.length}
                itemName="nhân sự"
              />
            </div>
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
    </div>
  );
}