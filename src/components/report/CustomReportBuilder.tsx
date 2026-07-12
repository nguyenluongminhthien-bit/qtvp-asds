// src/components/report/CustomReportBuilder.tsx
import React, { useState, useEffect } from 'react';
import { ReportColumn, ReportFilter } from '../../constants/reportTemplates';
import { DonVi } from '../../types';
import ReportFilterBar from './ReportFilterBar';
import ReportPreviewTable from './ReportPreviewTable';
import { exportReportToExcel } from '../../utils/exportReports';
import { apiService } from '../../services/api';
import { 
  SlidersHorizontal, CheckSquare, Square, ArrowUp, ArrowDown, 
  FileSpreadsheet, Eye, RefreshCw, LayoutGrid, Database, Layers
} from 'lucide-react';
import { toast } from '../../utils/toast';

// Định nghĩa cột cho Thiết bị (Vì chưa khai báo trong reportTemplates)
const EQUIPMENT_COLUMNS: ReportColumn[] = [
  { key: 'ma_tai_san', label: 'Mã Tài Sản', width: 140, defaultVisible: true },
  { key: 'ten_thiet_bi', label: 'Tên Thiết Bị / Tài Sản', width: 220, defaultVisible: true },
  { key: 'nhom_thiet_bi', label: 'Nhóm Thiết Bị', width: 130, defaultVisible: true },
  { key: 'mo_ta_dac_diem', label: 'Mô Tả / Đặc Điểm', width: 250, defaultVisible: false },
  { key: 'nha_cung_cap', label: 'Nhà Cung Cấp', width: 150, defaultVisible: false },
  { key: 'ngay_mua', label: 'Ngày Mua', width: 110, format: 'date', defaultVisible: true },
  { key: 'gia_mua', label: 'Nguyên Giá (VND)', width: 130, format: 'currency', defaultVisible: true },
  { key: 'han_bao_hanh', label: 'Hạn Bảo Hành', width: 110, format: 'date', defaultVisible: true },
  { key: 'tinh_trang', label: 'Tình Trạng Sử Dụng', width: 120, defaultVisible: true },
  { key: 'so_seri', label: 'Số Seri', width: 130, defaultVisible: false },
  { key: 'thoi_gian_khau_hao', label: 'Thời Gian Khấu Hao (Tháng)', width: 130, defaultVisible: false }
];

const EQUIPMENT_FILTERS: ReportFilter[] = [
  { key: 'id_don_vi', label: 'Chọn Đơn vị quản lý', type: 'unit' },
  { key: 'nhom_thiet_bi', label: 'Nhóm Thiết bị', type: 'select', options: ['Máy tính', 'Thiết bị văn phòng', 'Mạng - Server', 'Nội thất', 'Khác'] },
  { key: 'tinh_trang', label: 'Tình trạng', type: 'select', options: ['Đang sử dụng', 'Mất', 'Hư hỏng', 'Thanh lý', 'Dự phòng'] }
];

interface CustomReportBuilderProps {
  donViList: DonVi[];
  donViMap: Record<string, string>;
  user: any;
}

export default function CustomReportBuilder({
  donViList,
  donViMap,
  user
}: CustomReportBuilderProps) {
  const [source, setSource] = useState<'personnel' | 'documents' | 'equipments'>('personnel');
  
  // State quản lý cột (bao gồm hiển thị và thứ tự)
  const [cols, setCols] = useState<ReportColumn[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  
  // State quản lý bộ lọc
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  
  // State dữ liệu kết quả & trạng thái
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  // Load danh sách cột ban đầu khi đổi nguồn dữ liệu
  useEffect(() => {
    let initialCols: ReportColumn[] = [];
    if (source === 'personnel') {
      const tpl = requireTemplates('personnel_by_unit');
      initialCols = tpl.columns as ReportColumn[];
    } else if (source === 'documents') {
      const tpl = requireTemplates('document_list_report');
      initialCols = tpl.columns as ReportColumn[];
    } else if (source === 'equipments') {
      initialCols = [...EQUIPMENT_COLUMNS];
    }
    setCols(initialCols);
    setVisibleKeys(initialCols.filter(c => c.defaultVisible).map(c => c.key));
    setFilterValues({});
    setPreviewData([]);
    setHasPreviewed(false);
  }, [source]);

  // Hàm phụ trợ để mock require templates
  const requireTemplates = (tplId: string) => {
    if (tplId === 'personnel_by_unit') {
      return {
        columns: [
          { key: 'ma_so_nhan_vien', label: 'Mã Số Nhân Viên', width: 130, defaultVisible: true },
          { key: 'ho_ten', label: 'Họ và Tên', width: 180, defaultVisible: true },
          { key: 'chuc_vu', label: 'Chức Vụ', width: 150, defaultVisible: true },
          { key: 'phong_ban', label: 'Phòng Ban / Bộ phận', width: 150, defaultVisible: true },
          { key: 'ten_don_vi', label: 'Đơn Vị Quản Lý', width: 220, defaultVisible: true },
          { key: 'sdt_ca_nhan', label: 'Số Điện Thoại Cá Nhân', width: 130, format: 'phone', defaultVisible: true },
          { key: 'sdt_cong_ty', label: 'Số Điện Thoại Công Ty', width: 130, format: 'phone', defaultVisible: true },
          { key: 'email', label: 'Email', width: 180, defaultVisible: true },
          { key: 'gioi_tinh', label: 'Giới Tính', width: 80, defaultVisible: true },
          { key: 'nam_sinh', label: 'Năm Sinh', width: 100, format: 'date', defaultVisible: false },
          { key: 'ngay_nhan_vien', label: 'Ngày Nhận Việc', width: 110, format: 'date', defaultVisible: true },
          { key: 'phan_loai', label: 'Phân Loại Nhân Sự', width: 130, defaultVisible: true },
          { key: 'trinh_do_hoc_van', label: 'Trình Độ Học Vấn', width: 120, defaultVisible: false },
          { key: 'ngach_luong', label: 'Ngạch Lương', width: 120, defaultVisible: false },
          { key: 'thu_nhap', label: 'Mức Thu Nhập (Lương đóng BH)', width: 160, format: 'currency', defaultVisible: false },
          { key: 'trang_thai', label: 'Trạng Thái', width: 110, format: 'status_nv', defaultVisible: true },
          { key: 'ngay_nghi_viec', label: 'Ngày Nghỉ Việc', width: 110, format: 'date', defaultVisible: false }
        ]
      };
    }
    // document_list_report
    return {
      columns: [
        { key: 'so_hieu', label: 'Số Hiệu Văn Bản', width: 150, defaultVisible: true },
        { key: 'ngay_ban_hanh', label: 'Ngày Ban Hành', width: 110, format: 'date', defaultVisible: true },
        { key: 'tieu_de', label: 'Tiêu Đề', width: 280, defaultVisible: true },
        { key: 'nguoi_ky', label: 'Người Ký', width: 150, defaultVisible: true },
        { key: 'chuc_vu', label: 'Chức Vụ Người Ký', width: 150, defaultVisible: true },
        { key: 'nguoi_lay_so', label: 'Người Lấy Số', width: 150, defaultVisible: true },
        { key: 'bo_phan_lay_so', label: 'Bộ Phận Lấy Số', width: 150, defaultVisible: true },
        { key: 'hieu_luc', label: 'Tình Trạng Hiệu Lực', width: 120, defaultVisible: true },
        { key: 'vb_thay_the', label: 'Văn Bản Thay Thế', width: 150, defaultVisible: true },
        { key: 'phan_loai', label: 'Phân Loại Văn Bản', width: 120, defaultVisible: true },
        { key: 'nghiep_vu', label: 'Phân loại Nghiệp vụ', width: 150, defaultVisible: false }
      ]
    };
  };

  const getFilters = (): ReportFilter[] => {
    if (source === 'personnel') {
      return [
        { key: 'id_don_vi', label: 'Chọn Đơn vị', type: 'unit' },
        { key: 'phan_loai', label: 'Phân loại Nhân sự', type: 'select', options: ['Chính thức', 'Thử việc', 'Cộng tác viên', 'Kiêm nhiệm', 'Học việc'] },
        { key: 'trang_thai', label: 'Trạng thái Làm việc', type: 'select', options: ['Đang làm việc', 'Đã nghỉ việc'] }
      ];
    }
    if (source === 'documents') {
      return [
        { key: 'id_don_vi', label: 'Chọn Đơn vị ban hành', type: 'unit' },
        { key: 'phan_loai', label: 'Loại Văn bản', type: 'select', options: ['Thông báo', 'Quyết định', 'Tờ trình', 'Văn bản khác'] },
        { key: 'year', label: 'Năm Ban Hành', type: 'year' }
      ];
    }
    return EQUIPMENT_FILTERS;
  };

  const handleFilterChange = (key: string, val: any) => {
    setFilterValues(prev => ({ ...prev, [key]: val }));
  };

  const toggleColumnVisibility = (key: string) => {
    setVisibleKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Di chuyển cột lên trên trong danh sách thứ tự
  const moveColumnUp = (index: number) => {
    if (index === 0) return;
    const newCols = [...cols];
    const temp = newCols[index];
    newCols[index] = newCols[index - 1];
    newCols[index - 1] = temp;
    setCols(newCols);
  };

  // Di chuyển cột xuống dưới
  const moveColumnDown = (index: number) => {
    if (index === cols.length - 1) return;
    const newCols = [...cols];
    const temp = newCols[index];
    newCols[index] = newCols[index + 1];
    newCols[index + 1] = temp;
    setCols(newCols);
  };

  // Truy vấn và lọc dữ liệu động ở Client
  const fetchFilteredData = async (): Promise<any[]> => {
    setLoading(true);
    try {
      let rawData: any[] = [];
      if (source === 'personnel') {
        rawData = await apiService.getPersonnel();
      } else if (source === 'documents') {
        rawData = await apiService.getVanBan();
      } else if (source === 'equipments') {
        rawData = await apiService.getThietBi();
      }

      // Thực hiện lọc dữ liệu
      let filtered = [...rawData];

      Object.entries(filterValues).forEach(([key, val]) => {
        if (!val || val === '') return;

        if (key === 'id_don_vi') {
          // Lọc đệ quy theo cây đơn vị
          const subUnitIds = getSubUnitsRecursive(val as string);
          filtered = filtered.filter(item => subUnitIds.includes(String(item.id_don_vi)));
        } else if (key === 'year') {
          filtered = filtered.filter(item => {
            const dateStr = item.ngay_ban_hanh || item.ngay_mua;
            if (!dateStr) return false;
            return new Date(dateStr).getFullYear() === Number(val);
          });
        } else {
          filtered = filtered.filter(item => String(item[key] || '').toLowerCase() === String(val).toLowerCase());
        }
      });

      return filtered;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getSubUnitsRecursive = (rootId: string): string[] => {
    const list = [rootId];
    const collect = (id: string) => {
      donViList.forEach(u => {
        if (u.cap_quan_ly === id) {
          list.push(u.id);
          collect(u.id);
        }
      });
    };
    collect(rootId);
    return list;
  };

  const handlePreview = async () => {
    if (visibleKeys.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một cột dữ liệu!");
      return;
    }
    const result = await fetchFilteredData();
    setPreviewData(result);
    setHasPreviewed(true);
  };

  const handleExportExcel = async () => {
    if (visibleKeys.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một cột dữ liệu!");
      return;
    }
    const result = await fetchFilteredData();

    const mockTemplate = {
      id: `custom_report_${source}`,
      module: (source === 'personnel' ? 'NHÂN SỰ' : source === 'documents' ? 'VĂN BẢN' : 'HỆ THỐNG') as any,
      title: `Báo cáo Tùy biến ${source === 'personnel' ? 'Nhân sự' : source === 'documents' ? 'Văn bản' : 'Thiết bị'}`,
      icon: 'FileSpreadsheet',
      description: 'Báo cáo được thiết kế tùy biến cột và bộ lọc',
      dataSource: (source === 'personnel' ? 'getPersonnel' : source === 'documents' ? 'getVanBan' : 'getDonVi') as any,
      columns: cols,
      filters: getFilters(),
      customizable: true
    };

    await exportReportToExcel(
      mockTemplate,
      result,
      visibleKeys,
      filterValues,
      donViMap,
      user
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. CHỌN NGUỒN DỮ LIỆU */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <Database size={16} className="text-[#05469B]" />
          <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">1. Chọn Nguồn dữ liệu Báo cáo</h4>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => setSource('personnel')}
            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              source === 'personnel'
                ? 'bg-blue-50/50 border-[#05469B] text-[#05469B] font-black'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-slate-50'
            }`}
          >
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><LayoutGrid size={16} /></span>
            <div className="text-left"><p className="text-xs text-gray-400 font-bold uppercase">Nguồn</p><p className="text-sm">Thông tin Nhân sự</p></div>
          </button>
          
          <button
            onClick={() => setSource('documents')}
            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              source === 'documents'
                ? 'bg-blue-50/50 border-[#05469B] text-[#05469B] font-black'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-slate-50'
            }`}
          >
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><LayoutGrid size={16} /></span>
            <div className="text-left"><p className="text-xs text-gray-400 font-bold uppercase">Nguồn</p><p className="text-sm">Văn bản - Thông báo</p></div>
          </button>
          
          <button
            onClick={() => setSource('equipments')}
            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              source === 'equipments'
                ? 'bg-blue-50/50 border-[#05469B] text-[#05469B] font-black'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-slate-50'
            }`}
          >
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600"><LayoutGrid size={16} /></span>
            <div className="text-left"><p className="text-xs text-gray-400 font-bold uppercase">Nguồn</p><p className="text-sm">Trang thiết bị văn phòng</p></div>
          </button>
        </div>
      </div>

      {/* 2. CHỌN VÀ SẮP XẾP CỘT */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100 justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-emerald-500" />
            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">2. Tùy chọn hiển thị &amp; Thứ tự Cột</h4>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded border border-emerald-100">Đã chọn {visibleKeys.length}/{cols.length} cột</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
          {cols.map((col, index) => {
            const isVisible = visibleKeys.includes(col.key);
            return (
              <div
                key={col.key}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isVisible ? 'bg-emerald-50/10 border-emerald-200' : 'bg-white border-gray-100 opacity-60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleColumnVisibility(col.key)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <span className="text-emerald-500 shrink-0">
                    {isVisible ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-300" />}
                  </span>
                  <div>
                    <p className="text-[12.5px] font-bold text-gray-800 leading-snug">{col.label}</p>
                    <p className="text-[10px] font-mono text-gray-400">field: {col.key}</p>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 border-l border-gray-200/60 pl-3">
                  <button
                    onClick={() => moveColumnUp(index)}
                    disabled={index === 0}
                    className="p-1 hover:bg-slate-100 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Đẩy lên trước"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => moveColumnDown(index)}
                    disabled={index === cols.length - 1}
                    className="p-1 hover:bg-slate-100 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Đẩy xuống sau"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. BỘ LỌC CẤU HÌNH DỮ LIỆU */}
      <ReportFilterBar
        filters={getFilters()}
        values={filterValues}
        onChange={handleFilterChange}
        donViList={donViList}
      />

      {/* Nút bấm hành động */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={() => {
            setFilterValues({});
            setVisibleKeys(cols.filter(c => c.defaultVisible).map(c => c.key));
            setPreviewData([]);
            setHasPreviewed(false);
          }}
          className="px-5 py-2.5 border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors text-xs"
        >
          <RefreshCw size={12} /> Cài đặt lại thiết kế
        </button>

        <button
          onClick={handlePreview}
          disabled={loading}
          className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 text-xs"
        >
          <Eye size={14} className="text-[#05469B]" /> 
          {loading ? 'Đang tải...' : 'Xem trước bảng'}
        </button>

        <button
          onClick={handleExportExcel}
          disabled={loading}
          className="px-6 py-2.5 bg-[#05469B] hover:bg-[#04367a] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 text-xs"
        >
          <FileSpreadsheet size={14} /> Xuất Excel Tùy biến
        </button>
      </div>

      {/* 4. HIỂN THỊ BẢNG PREVIEW KẾT QUẢ */}
      {hasPreviewed && (
        <ReportPreviewTable
          data={previewData}
          columns={cols}
          visibleColumns={visibleKeys}
          donViMap={donViMap}
        />
      )}
    </div>
  );
}
