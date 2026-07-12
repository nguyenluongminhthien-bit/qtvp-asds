// src/pages/ReportPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DonVi, Personnel } from '../types';
import { REPORT_TEMPLATES, ReportTemplate } from '../constants/reportTemplates';
import ReportList from '../components/report/ReportList';
import ReportConfigPanel from '../components/report/ReportConfigPanel';
import ReportPreviewTable from '../components/report/ReportPreviewTable';
import CustomReportBuilder from '../components/report/CustomReportBuilder';
import { exportReportToExcel } from '../utils/exportReports';
import { exportSecurityReport } from '../utils/exportExcel';
import { getAllSubordinateIds } from '../utils/hierarchy';
import { 
  FileBarChart, FileSpreadsheet, SlidersHorizontal, Info, ShieldAlert,
  Loader2, RefreshCw
} from 'lucide-react';
import { toast } from '../utils/toast';
import { useAllowedUnits } from '../hooks/useAllowedUnits';

export default function ReportPage() {
  const { user, checkPermission } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'fixed' | 'custom'>('fixed');

  // Dữ liệu chung
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const allowedDonViIds = useAllowedUnits(donViList);

  const isHOAdmin = useMemo(() => {
    if (!user) return false;
    const userIdDonVi = String(user.id_don_vi || (user as any).idDonVi || '').trim();
    if (!userIdDonVi || userIdDonVi === 'ALL' || userIdDonVi === 'HO' || userIdDonVi === 'DV_HO') return true;
    return false;
  }, [user]);

  const allowedDonViList = useMemo(() => {
    if (isHOAdmin) return donViList;
    return (donViList || []).filter(dv => (allowedDonViIds || []).includes(String(dv.id || '')));
  }, [donViList, isHOAdmin, allowedDonViIds]);

  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [vanBanList, setVanBanList] = useState<any[]>([]);
  const [anNinhList, setAnNinhList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mẫu đang chọn và các bộ lọc cho mẫu đó
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  
  // Dữ liệu xem trước
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  // Load danh sách đơn vị và nhân sự để làm dữ liệu nền
  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [units, staff, docs, anNinh] = await Promise.all([
        apiService.getDonVi(),
        apiService.getPersonnel(),
        apiService.getVanBan(),
        apiService.getAnNinh()
      ]);
      setDonViList(units);
      setPersonnelList(staff);
      setVanBanList(docs);
      setAnNinhList(anNinh || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  // Tự động khởi tạo giá trị bộ lọc mặc định khi chọn mẫu báo cáo
  useEffect(() => {
    if (selectedTemplate) {
      const initialFilters: Record<string, any> = {};
      selectedTemplate.filters.forEach(f => {
        if (f.type === 'select' && f.options && f.options.length > 0) {
          initialFilters[f.key] = f.options[0];
        }
      });
      setFilterValues(initialFilters);
      setPreviewReady(false);
      setPreviewData([]);
    } else {
      setFilterValues({});
      setPreviewReady(false);
      setPreviewData([]);
    }
  }, [selectedTemplate]);

  // Map ID Đơn vị sang Tên Đơn vị
  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(u => {
      map[u.id] = u.ten_don_vi;
    });
    return map;
  }, [donViList]);

  // Hàm phân loại văn bản chuẩn
  const getDocumentSheetType = (item: any): string => {
    const pl = String(item.phan_loai || '').trim();
    if (pl === 'Quyết định' || pl === 'Thông báo' || pl === 'Tờ trình' || pl === 'Công văn đến' || pl === 'Công văn đi') {
      return pl;
    }
    const soHieu = String(item.so_hieu || '').toUpperCase();
    if (soHieu.includes('CVĐ') || soHieu.includes('/CVĐ') || pl.toLowerCase().includes('đến')) {
      return 'Công văn đến';
    }
    if (soHieu.includes('CV') || soHieu.includes('/CV') || pl.toLowerCase().includes('công văn')) {
      return 'Công văn đi';
    }
    return pl || 'Công văn đi';
  };

  // Lấy danh sách Bộ phận lấy số động theo Loại Văn bản (phan_loai) và Năm (year) đang chọn
  const boPhanOptions = useMemo(() => {
    const selectedYear = filterValues.year;
    const selectedPhanLoai = filterValues.phan_loai;
    let docs = vanBanList;

    if (selectedYear && (Array.isArray(selectedYear) ? selectedYear.length > 0 : String(selectedYear) !== '')) {
      const selectedYears = (Array.isArray(selectedYear) ? selectedYear : [selectedYear]).map(Number);
      docs = docs.filter(item => {
        const dStr = item.ngay_ban_hanh;
        if (!dStr) return false;
        return selectedYears.includes(new Date(dStr).getFullYear());
      });
    }

    if (selectedPhanLoai && (Array.isArray(selectedPhanLoai) ? selectedPhanLoai.length > 0 : String(selectedPhanLoai) !== '')) {
      const selectedTypes = (Array.isArray(selectedPhanLoai) ? selectedPhanLoai : [selectedPhanLoai])
        .map(s => String(s).trim().toLowerCase());
      if (!selectedTypes.includes('tất cả')) {
        docs = docs.filter(item => selectedTypes.includes(getDocumentSheetType(item).toLowerCase()));
      }
    }

    const depts = Array.from(new Set(docs.map(item => item.bo_phan_lay_so).filter(Boolean)));
    return depts.sort();
  }, [vanBanList, filterValues.year, filterValues.phan_loai]);

  // Lấy danh sách Năm thực tế có trong dữ liệu văn bản
  const yearOptions = useMemo(() => {
    const yearsSet = new Set<number>();
    vanBanList.forEach(item => {
      const dStr = item.ngay_ban_hanh;
      if (dStr) {
        const y = new Date(dStr).getFullYear();
        if (!isNaN(y) && y >= 1990 && y <= 2100) {
          yearsSet.add(y);
        }
      }
    });
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear());
    }
    return Array.from(yearsSet).sort((a, b) => b - a).map(String);
  }, [vanBanList]);

  // Lấy danh sách Loại hình thực tế có trong dm_don_vi, chỉ hiển thị: Văn phòng, Công ty tỉnh thành, Showroom
  const loaiHinhOptions = useMemo(() => {
    const list = Array.from(new Set(
      allowedDonViList.map(u => String(u.loai_hinh || '').trim()).filter(lh => {
        if (!lh) return false;
        const lower = lh.toLowerCase();
        return lower.includes('văn phòng') || lower.includes('công ty tỉnh') || lower.includes('showroom') || lower.includes('tổng công ty') || lower === 'công ty';
      })
    ));
    if (list.length === 0) {
      return ['Văn phòng', 'Công ty Tỉnh thành', 'Showroom'];
    }
    return list.sort();
  }, [allowedDonViList]);

  const dynamicOptions = useMemo(() => ({
    bo_phan_lay_so: boPhanOptions,
    year: yearOptions,
    loai_hinh: loaiHinhOptions
  }), [boPhanOptions, yearOptions, loaiHinhOptions]);

  const templateWithDynamicColumns = selectedTemplate;

  // Bộ lọc thay đổi
  const handleFilterChange = (key: string, val: any) => {
    setFilterValues(prev => {
      const next = { ...prev, [key]: val };
      // Nếu đổi Loại văn bản (phan_loai) hoặc Năm, reset lại lựa chọn bộ phận lấy số để khớp với danh sách mới
      if (key === 'phan_loai' || key === 'year') {
        next.bo_phan_lay_so = [];
      }
      return next;
    });
    setPreviewReady(false);
    setPreviewData([]);
  };

  // Reset bộ lọc
  const handleResetFilters = () => {
    const initialFilters: Record<string, any> = {};
    if (selectedTemplate) {
      selectedTemplate.filters.forEach(f => {
        if (f.type === 'select' && f.options && f.options.length > 0) {
          initialFilters[f.key] = f.options[0];
        }
      });
    }
    setFilterValues(initialFilters);
    setPreviewReady(false);
    setPreviewData([]);
  };

  // Đệ quy lấy tất cả đơn vị con
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

  // Xử lý truy vấn dữ liệu theo mẫu và bộ lọc
  const handlePreview = async () => {
    if (!selectedTemplate) return;
    setQueryLoading(true);
    try {
      let rawData: any[] = [];
      
      // Gọi đúng hàm API trong module
      if (selectedTemplate.id === 'system_donvi_structure') {
        const nonAgentDonViList = allowedDonViList.filter(u => String(u.trang_thai || '').trim() !== 'Đại lý');
        let targetUnits = [...nonAgentDonViList];
        const isMultiSelected = Array.isArray(filterValues.id_don_vi) && filterValues.id_don_vi.length > 0;
        
        if (isMultiSelected) {
          const selectedIds = filterValues.id_don_vi as string[];
          const subUnitIds = selectedIds.flatMap(id => getSubUnitsRecursive(id));
          targetUnits = targetUnits.filter(u => subUnitIds.includes(u.id));
        }

        if (Array.isArray(filterValues.loai_hinh) && filterValues.loai_hinh.length > 0) {
          const selectedLHList = filterValues.loai_hinh.map((item: string) => String(item).trim().toLowerCase());
          targetUnits = targetUnits.filter(u => selectedLHList.includes(String(u.loai_hinh || '').trim().toLowerCase()));
        } else if (typeof filterValues.loai_hinh === 'string' && filterValues.loai_hinh && filterValues.loai_hinh !== 'Tất cả') {
          const selectedLH = filterValues.loai_hinh.trim().toLowerCase();
          targetUnits = targetUnits.filter(u => String(u.loai_hinh || '').trim().toLowerCase() === selectedLH);
        }

        rawData = targetUnits.map((unit, idx) => {
          const ceo = personnelList.find(p => p.id === unit.id_giam_doc || p.ma_so_nhan_vien === unit.id_giam_doc);
          const qtvp = personnelList.find(p => p.id === unit.id_pt_dvht1 || p.ma_so_nhan_vien === unit.id_pt_dvht1);
          const dvhc = personnelList.find(p => p.id === unit.id_pt_dvht2 || p.ma_so_nhan_vien === unit.id_pt_dvht2);
          const ns = personnelList.find(p => p.id === unit.id_pt_nhan_su || p.ma_so_nhan_vien === unit.id_pt_nhan_su);
          
          return {
            ...unit,
            index: idx + 1,
            ten_giam_doc: ceo ? ceo.ho_ten : (unit.id_giam_doc || 'Chưa phân công'),
            email_giam_doc: ceo ? ceo.email : '',
            sdt_giam_doc: ceo ? (ceo.sdt_cong_ty || ceo.sdt_ca_nhan) : '',
            
            ten_pt_nhan_su: qtvp ? qtvp.ho_ten : (unit.id_pt_dvht1 || 'Chưa phân công'),
            email_pt_nhan_su: qtvp ? qtvp.email : '',
            sdt_pt_nhan_su: qtvp ? (qtvp.sdt_cong_ty || qtvp.sdt_ca_nhan) : '',
            
            ten_pt_dvhc: dvhc ? dvhc.ho_ten : (unit.id_pt_dvht2 || 'Chưa phân công'),
            email_pt_dvhc: dvhc ? dvhc.email : '',
            sdt_pt_dvhc: dvhc ? (dvhc.sdt_cong_ty || dvhc.sdt_ca_nhan) : '',
            
            ten_pt_ns: ns ? ns.ho_ten : (unit.id_pt_nhan_su || 'Chưa phân công'),
            email_pt_ns: ns ? ns.email : '',
            sdt_pt_ns: ns ? (ns.sdt_cong_ty || ns.sdt_ca_nhan) : ''
          };
        });
      }
      else if (selectedTemplate.id === 'system_donvi_billing') {
        const pnList = await apiService.getPhapNhan();
        const nonAgentDonViList = donViList.filter(u => String(u.trang_thai || '').trim() !== 'Đại lý');
        const nonAgentIds = nonAgentDonViList.map(u => u.id);
        
        let targetPn = pnList.filter(pn => {
          const ids = String(pn.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
          return ids.some(id => nonAgentIds.includes(id));
        });
        
        const isMultiSelected = Array.isArray(filterValues.id_don_vi) && filterValues.id_don_vi.length > 0;
        
        if (isMultiSelected) {
          const selectedIds = filterValues.id_don_vi as string[];
          const subUnitIds = selectedIds.flatMap(id => [id, ...getSubUnitsRecursive(id)]);
          targetPn = targetPn.filter(pn => {
            const ids = String(pn.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
            return ids.some(id => subUnitIds.includes(id));
          });
        }
        
        rawData = targetPn.map((pn, index) => {
          const showroomIds = String(pn.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
          const showroomNames = showroomIds.map(id => donViMap[id] || id).join(', ');
          
          let parentName = '---';
          if (showroomIds.length > 0) {
            const firstShowroom = donViList.find(u => u.id === showroomIds[0]);
            if (firstShowroom && firstShowroom.cap_quan_ly) {
              parentName = donViMap[firstShowroom.cap_quan_ly] || firstShowroom.cap_quan_ly;
            }
          }

          return {
            ...pn,
            index: index + 1,
            ten_don_vi_quan_ly: parentName,
            ten_don_vi: showroomNames || '---'
          };
        });
      } else if (selectedTemplate.id === 'system_security_report') {
        let targetUnits = allowedDonViList.filter(u => String(u.trang_thai || '').trim() !== 'Đại lý');

        if (filterValues.id_don_vi && (Array.isArray(filterValues.id_don_vi) ? filterValues.id_don_vi.length > 0 : filterValues.id_don_vi !== '')) {
          const selectedUnitVals = Array.isArray(filterValues.id_don_vi) ? filterValues.id_don_vi : [String(filterValues.id_don_vi)];
          let subUnitIds: string[] = [...selectedUnitVals];
          selectedUnitVals.forEach(id => {
            subUnitIds = [...subUnitIds, ...getAllSubordinateIds(id, donViList)];
          });
          targetUnits = targetUnits.filter(u => subUnitIds.includes(u.id));
        }

        rawData = targetUnits.map((unit, idx) => {
          const sec = anNinhList.find(a => String(a.id_don_vi || a.id || '').trim() === String(unit.id).trim()) || {};
          const soTang = unit.so_tang || 0;
          const soHam = unit.so_ham || 0;
          const quyMoStr = `${soTang} tầng, ${soHam} hầm`;
          const dienTichStr = unit.dien_tich ? `${Number(unit.dien_tich).toLocaleString('vi-VN')} m²` : '---';
          const soCongStr = `${unit.so_cong || 0}/${unit.so_cong || 0}`;

          return {
            ...unit,
            index: idx + 1,
            ten_don_vi: unit.ten_don_vi || '---',
            dia_chi: unit.dia_chi || '---',
            quy_mo: quyMoStr,
            dien_tich_str: dienTichStr,
            so_cong_str: soCongStr,
            sl_camera: sec.sl_camera || 0,
            thoi_gian_luu: sec.thoi_gian_luu ? `${sec.thoi_gian_luu} ngày` : '---',
            vi_tri_gs_camera: sec.vi_tri_gs_camera || '---',
            tinh_hinh_khu_vuc: sec.tinh_hinh_khu_vuc || 'Ổn định'
          };
        });
      } else if (selectedTemplate.dataSource === 'getDonVi') {
        rawData = [...donViList];
      } else if (selectedTemplate.dataSource === 'getPersonnel') {
        rawData = [...personnelList];
      } else if (selectedTemplate.dataSource === 'getVanBan') {
        rawData = await apiService.getVanBan();
      }

      // XỬ LÝ LỌC TRÊN CLIENT SIDE
      let filtered = [...rawData];

      // 2. Lọc theo bộ lọc tùy chọn
      for (const filter of selectedTemplate.filters) {
        const key = filter.key;
        const val = filterValues[key];
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) continue;

        if (key === 'id_don_vi') {
          // Bỏ qua bộ lọc id_don_vi cho 3 báo cáo hệ thống vì đã được lọc sẵn ở tầng truy vấn phía trên
          if (selectedTemplate.id === 'system_donvi_structure' || selectedTemplate.id === 'system_donvi_billing' || selectedTemplate.id === 'system_security_report') {
            continue;
          }
          // Lọc đệ quy theo cây đơn vị cho các báo cáo khác (hỗ trợ cả chọn đơn hoặc chọn nhiều mảng id)
          const selectedUnitIds = Array.isArray(val) ? val : [val];
          if (selectedUnitIds.length > 0) {
            const subUnitIds = selectedUnitIds.flatMap(id => getSubUnitsRecursive(String(id)));
            filtered = filtered.filter(item => subUnitIds.includes(String(item.id_don_vi || item.id || '')));
          }
        } else if (key === 'bo_phan_lay_so') {
          if (Array.isArray(val) && val.length > 0) {
            filtered = filtered.filter(item => val.includes(item.bo_phan_lay_so));
          }
        } else if (key === 'year') {
          const selectedYears = (Array.isArray(val) ? val : [val]).map(Number);
          if (selectedYears.length > 0) {
            filtered = filtered.filter(item => {
              const dateStr = item.ngay_ban_hanh || item.ngay_mua;
              if (!dateStr) return false;
              return selectedYears.includes(new Date(dateStr).getFullYear());
            });
          }
        } else if (key === 'certificate_type') {
          // Lọc theo loại chứng chỉ
          if (val === 'Chứng chỉ ATVSLĐ') {
            filtered = filtered.filter(item => item.cc_atvsld === true || String(item.cc_atvsld).toLowerCase() === 'true');
          } else if (val === 'Chứng chỉ PCCC') {
            filtered = filtered.filter(item => item.cc_pccc === true || String(item.cc_pccc).toLowerCase() === 'true');
          } else if (val === 'Chứng chỉ CNCH') {
            filtered = filtered.filter(item => item.cc_cnch === true || String(item.cc_cnch).toLowerCase() === 'true');
          } else if (val === 'Giấy phép Lái xe') {
            filtered = filtered.filter(item => item.giay_phep_lai_xe && String(item.giay_phep_lai_xe).trim() !== '' && String(item.giay_phep_lai_xe) !== 'Không có');
          }
        } else if (key === 'expiry_status') {
          // Lọc theo trạng thái hiệu lực ATVSLĐ
          const today = new Date();
          filtered = filtered.filter(item => {
            if (!item.gia_tri_den) return val === 'Chưa có';
            const expDate = new Date(item.gia_tri_den);
            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (val === 'Còn hiệu lực') return diffDays > 30;
            if (val === 'Sắp hết hạn (30 ngày)') return diffDays <= 30 && diffDays > 0;
            if (val === 'Đã hết hạn') return diffDays <= 0;
            return true;
          });
        } else if (key === 'daterange_start') {
          filtered = filtered.filter(item => {
            const dateStr = item.ngay_nhan_vien || item.ngay_ban_hanh || item.ngay_nghi_viec;
            if (!dateStr) return false;
            return new Date(dateStr) >= new Date(val as string);
          });
        } else if (key === 'daterange_end') {
          filtered = filtered.filter(item => {
            const dateStr = item.ngay_nhan_vien || item.ngay_ban_hanh || item.ngay_nghi_viec;
            if (!dateStr) return false;
            return new Date(dateStr) <= new Date(val as string);
          });
        } else if (key === 'phan_loai') {
          const selectedTypes = (Array.isArray(val) ? val : [val]).map(s => String(s).trim().toLowerCase());
          if (selectedTypes.length > 0 && !selectedTypes.includes('tất cả')) {
            filtered = filtered.filter(item => selectedTypes.includes(getDocumentSheetType(item).toLowerCase()));
          }
        } else {
          filtered = filtered.filter(item => String(item[key] || '').toLowerCase() === String(val).toLowerCase());
        }
      }

      // Sắp xếp văn bản theo thời gian ban hành giảm dần (mới nhất hiển thị trên cùng)
      if (selectedTemplate.id === 'document_list_report' || selectedTemplate.module === 'VĂN BẢN') {
        filtered.sort((a, b) => {
          const dA = a.ngay_ban_hanh ? new Date(a.ngay_ban_hanh).getTime() : 0;
          const dB = b.ngay_ban_hanh ? new Date(b.ngay_ban_hanh).getTime() : 0;
          return dB - dA;
        });
      }

      // Xử lý cấu trúc dữ liệu cho Báo cáo Biến động nhân sự (Fixed stats)
      if (selectedTemplate.id === 'personnel_turnover_stats') {
        filtered = generateTurnoverStats(filtered, filterValues);
      }

      if (!isHOAdmin && (allowedDonViIds || []).length > 0 && selectedTemplate.id !== 'personnel_turnover_stats') {
        filtered = filtered.filter(item => {
          const itemDv = String(item.id_don_vi || item.id || '').trim();
          return (allowedDonViIds || []).includes(itemDv);
        });
      }

      setPreviewData(filtered);
      setPreviewReady(true);
      return filtered;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setQueryLoading(false);
    }
  };

  // Tạo số liệu tuyển dụng/thôi việc theo tháng
  const generateTurnoverStats = (staffList: Personnel[], filters: Record<string, any>): any[] => {
    // Xác định thời gian lọc
    let start = filters.daterange_start ? new Date(filters.daterange_start) : new Date(new Date().getFullYear(), 0, 1);
    let end = filters.daterange_end ? new Date(filters.daterange_end) : new Date();

    const monthlyStats: Record<string, { period: string; recruited_count: number; resigned_count: number; net_change: number }> = {};

    let iter = new Date(start.getFullYear(), start.getMonth(), 1);
    while (iter <= end) {
      const key = `${iter.getMonth() + 1}/${iter.getFullYear()}`;
      monthlyStats[key] = {
        period: `Tháng ${key}`,
        recruited_count: 0,
        resigned_count: 0,
        net_change: 0
      };
      iter.setMonth(iter.getMonth() + 1);
    }

    staffList.forEach(p => {
      // Đếm tuyển mới
      if (p.ngay_nhan_vien) {
        const d = new Date(p.ngay_nhan_vien);
        const k = `${d.getMonth() + 1}/${d.getFullYear()}`;
        if (monthlyStats[k]) monthlyStats[k].recruited_count++;
      }
      // Đếm thôi việc
      if (p.ngay_nghi_viec) {
        const d = new Date(p.ngay_nghi_viec);
        const k = `${d.getMonth() + 1}/${d.getFullYear()}`;
        if (monthlyStats[k]) monthlyStats[k].resigned_count++;
      }
    });

    return Object.values(monthlyStats).map(item => {
      item.net_change = item.recruited_count - item.resigned_count;
      return item;
    });
  };

  // Thực hiện xuất Excel
  const handleExport = async () => {
    if (!templateWithDynamicColumns) return;
    
    // Tải và chuẩn bị dữ liệu mới nhất
    const latestFilteredData = await handlePreview() || previewData;

    if (selectedTemplate?.id === 'system_security_report') {
      const unitsToExport = latestFilteredData;
      if (!unitsToExport || unitsToExport.length === 0) {
        toast.error('Không có đơn vị nào để xuất báo cáo');
        return;
      }
      const selectedUnit = unitsToExport[0];
      const getUnitIdSafe = (item: any) => String(item.id_don_vi || item.id || '').trim();
      exportSecurityReport(
        selectedUnit,
        unitsToExport,
        anNinhList,
        true,
        getUnitIdSafe
      );
      toast.success('Đã xuất Báo cáo Khảo sát An ninh Bảo vệ thành công!');
      return;
    }

    const defaultVisibleCols = templateWithDynamicColumns.columns.map(c => c.key);
    
    await exportReportToExcel(
      templateWithDynamicColumns,
      latestFilteredData,
      defaultVisibleCols,
      filterValues,
      donViMap,
      user
    );
  };

  const fetchFreshDataDirectly = async (): Promise<any[]> => {
    if (!selectedTemplate) return [];
    let rawData: any[] = [];
    if (selectedTemplate.dataSource === 'getDonVi') {
      rawData = [...donViList];
    } else if (selectedTemplate.dataSource === 'getPersonnel') {
      rawData = [...personnelList];
    } else if (selectedTemplate.dataSource === 'getVanBan') {
      rawData = await apiService.getVanBan();
    }
    return rawData;
  };

  // Kiểm tra phân quyền truy cập trang Báo cáo
  const isAuthorized = checkPermission('BaoCao') || String(user?.quyen).toUpperCase() === 'ADMIN';

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-20 bg-white border border-red-200 rounded-3xl text-center shadow-md space-y-4">
        <ShieldAlert size={48} className="text-red-500 mx-auto" />
        <h2 className="text-lg font-black text-red-700">TRUY CẬP BỊ TỪ CHỐI</h2>
        <p className="text-xs text-gray-500 font-medium leading-relaxed">
          Tính năng Báo cáo chỉ dành cho quản trị viên hệ thống (Admin HO) và quản trị viên đơn vị. Tài khoản của bạn không được phân quyền thực hiện tác vụ này.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f4f7f9]">
      {/* HEADER TRANG */}
      <header className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-blue-50 text-[#05469B] rounded-2xl shadow-2xs border border-blue-100">
            <FileBarChart size={24} />
          </span>
          <div>
            <h1 className="text-lg font-black text-gray-800 tracking-wide uppercase">Trung tâm Báo cáo Hệ thống</h1>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">Xuất các báo cáo tổng hợp hành chính văn phòng &amp; an sinh nhân sự</p>
          </div>
        </div>

        {/* Chuyển đổi TAB */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-center">
          <button
            onClick={() => {
              setActiveSubTab('fixed');
              setSelectedTemplate(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'fixed'
                ? 'bg-white text-[#05469B] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Mẫu cố định
          </button>
          
          <button
            onClick={() => setActiveSubTab('custom')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'custom'
                ? 'bg-white text-[#05469B] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Tùy biến cột
          </button>
        </div>
      </header>

      {/* NỘI DUNG CHÍNH */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-[#05469B] mb-4" />
            <p className="font-bold text-sm">Đang tải dữ liệu nền...</p>
          </div>
        ) : (
          <>
            {activeSubTab === 'fixed' ? (
              // PHÂN HỆ MẪU BÁO CÁO CỐ ĐỊNH
              !selectedTemplate ? (
                <div className="animate-in fade-in duration-200">
                  <ReportList
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={setSelectedTemplate}
                  />
                </div>
              ) : (
                templateWithDynamicColumns && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <ReportConfigPanel
                      template={templateWithDynamicColumns}
                      filters={filterValues}
                      onFilterChange={handleFilterChange}
                      onResetFilters={handleResetFilters}
                      onPreview={handlePreview}
                      onExport={handleExport}
                      onBack={() => setSelectedTemplate(null)}
                      donViList={allowedDonViList}
                      loading={queryLoading}
                      previewReady={previewReady}
                      dynamicOptions={dynamicOptions}
                    />

                    {previewReady && (
                      <ReportPreviewTable
                        data={previewData}
                        columns={templateWithDynamicColumns.columns}
                        visibleColumns={templateWithDynamicColumns.columns.map(c => c.key)}
                        donViMap={donViMap}
                        templateId={templateWithDynamicColumns.id}
                      />
                    )}
                  </div>
                )
              )
            ) : (
              // PHÂN HỆ BÁO CÁO TÙY BIẾN CỘT
              <div className="animate-in fade-in duration-200">
                <CustomReportBuilder
                  donViList={allowedDonViList}
                  donViMap={donViMap}
                  user={user}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
