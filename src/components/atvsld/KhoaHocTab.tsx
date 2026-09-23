import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Plus, Search, Edit2, Trash2, Calendar, MapPin,
  Users, CheckCircle2, ChevronLeft, ClipboardPaste, RefreshCw, AlertTriangle,
  ExternalLink, CheckCircle, Info, BookOpen, UserCheck, Eye,
  Building2, FileText, ChevronRight, Activity, Heart, ShieldCheck, Download,
  HelpCircle, CheckCheck
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { useAuth } from '../../contexts/AuthContext';
import { DonVi, Personnel, KhoaHuanLuyen, HocVienKhoaHuanLuyen, ChuKyATVSLD, NhaCungCap } from '../../types';
import PasteImportModal, { ColumnMapItem } from '../ui/PasteImportModal';
import { getChungNhanByNhom, calcGiaTriDen } from '../../utils/atvsld';
import { getAllSubordinateIds, buildHierarchicalOptions, getUnitEmoji } from '../../utils/hierarchy';

interface KhoaHocTabProps {
  onReloadData?: () => void;
  selectedUnitFilter: string | null;
  allowedDonViIds: string[];
  activeSubTab3?: 'khoahoc' | 'canhan';
  setActiveSubTab3?: (tab: 'khoahoc' | 'canhan') => void;
  onTabCountsChange?: (khoaHocCount: number, caNhanCount: number) => void;
}

const getShortHoSo = (hoSoText: string): string => {
  if (!hoSoText) return '';
  const parts = hoSoText.split(/\s+(về việc|v\/v)\s+/i);
  return parts[0].trim();
};

export default function KhoaHocTab({
  onReloadData,
  selectedUnitFilter,
  allowedDonViIds,
  activeSubTab3,
  setActiveSubTab3,
  onTabCountsChange
}: KhoaHocTabProps) {
  const { user } = useAuth();

  // States tải dữ liệu
  const [khoaHocList, setKhoaHocList] = useState<KhoaHuanLuyen[]>([]);
  const [hocVienList, setHocVienList] = useState<HocVienKhoaHuanLuyen[]>([]);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [chuKyList, setChuKyList] = useState<ChuKyATVSLD[]>([]);
  const [nccList, setNccList] = useState<NhaCungCap[]>([]);
  const [loading, setLoading] = useState(true);

  // States quản lý màn hình & bộ lọc
  const [selectedKhoaHoc, setSelectedKhoaHoc] = useState<KhoaHuanLuyen | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hvSearchTerm, setHvSearchTerm] = useState('');

  // States mới cho Matrix & List View cá nhân
  const [localActiveSubTab, setLocalActiveSubTab] = useState<'khoahoc' | 'canhan'>('khoahoc');
  const activeSubTab = activeSubTab3 !== undefined ? activeSubTab3 : localActiveSubTab;
  const setActiveSubTab = setActiveSubTab3 !== undefined ? setActiveSubTab3 : setLocalActiveSubTab;
  const [caNhanViewMode, setCaNhanViewMode] = useState<'matrix' | 'list'>('matrix');
  const [selectedNam, setSelectedNam] = useState<string>('ALL');
  const [statusMatrixFilter, setStatusMatrixFilter] = useState<'ALL' | 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN'>('ALL');
  const [expandedMsnv, setExpandedMsnv] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentKhoaHoc, setCurrentKhoaHoc] = useState<Partial<KhoaHuanLuyen> | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [confirmType, setConfirmType] = useState<'KHOA_HOC' | 'HOC_VIEN' | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Load toàn bộ dữ liệu
  const loadData = async () => {
    setLoading(true);
    try {
      const [khData, hvData, nsData, dvData, ckData, nccData] = await Promise.all([
        apiService.getKhoaHuanLuyen ? apiService.getKhoaHuanLuyen().catch(() => []) : Promise.resolve([]),
        apiService.getHocVienKhoaHuanLuyen ? apiService.getHocVienKhoaHuanLuyen().catch(() => []) : Promise.resolve([]),
        apiService.getPersonnel(),
        apiService.getDonVi(),
        apiService.getChuKyATVSLD ? apiService.getChuKyATVSLD().catch(() => []) : Promise.resolve([]),
        apiService.getNhaCungCap ? apiService.getNhaCungCap().catch(() => []) : Promise.resolve([])
      ]);
      setKhoaHocList(khData || []);
      setHocVienList(hvData || []);
      setPersonnelList(nsData || []);
      setDonViList(dvData || []);
      setChuKyList(ckData || []);
      setNccList(nccData || []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Xác định phạm vi các đơn vị được phép hiển thị/so khớp
  const activeUnitSubordinates = useMemo(() => {
    if (!selectedUnitFilter) return allowedDonViIds;
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);
    return [selectedUnitFilter, ...subIds];
  }, [selectedUnitFilter, donViList, allowedDonViIds]);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(d => { map[d.id] = d.ten_don_vi; });
    return map;
  }, [donViList]);

  // Bộ lọc danh sách khóa học
  const filteredKhoaHoc = useMemo(() => {
    return khoaHocList.filter(kh => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        kh.ten_khoa_hoc.toLowerCase().includes(search) ||
        (kh.don_vi_dao_tao || '').toLowerCase().includes(search) ||
        (kh.dia_diem || '').toLowerCase().includes(search)
      );

      // Bộ lọc theo đơn vị đã chọn (hỗ trợ hiển thị dữ liệu cũ chưa có id_don_vi)
      const matchesUnit = !selectedUnitFilter ||
        !kh.id_don_vi ||
        activeUnitSubordinates.includes(kh.id_don_vi);

      return matchesSearch && matchesUnit;
    });
  }, [khoaHocList, searchTerm, selectedUnitFilter, activeUnitSubordinates]);

  // Học viên thuộc khóa học hiện tại
  const currentHocVienList = useMemo(() => {
    if (!selectedKhoaHoc) return [];
    return hocVienList.filter(hv => hv.id_khoa_hoc === selectedKhoaHoc.id);
  }, [hocVienList, selectedKhoaHoc]);

  // Bộ lọc học viên trong khóa
  const filteredHocVien = useMemo(() => {
    return currentHocVienList.filter(hv => {
      const search = hvSearchTerm.toLowerCase();
      return (
        hv.msnv.toLowerCase().includes(search) ||
        (hv.ho_ten || '').toLowerCase().includes(search) ||
        (hv.chuc_vu || '').toLowerCase().includes(search) ||
        (hv.don_vi_text || '').toLowerCase().includes(search)
      );
    });
  }, [currentHocVienList, hvSearchTerm]);

  // 🟢 BỘ TÍNH TOÁN & LỌC HỌC VIÊN CÁ NHÂN CHO MATRIX & LIST VIEW MỚI
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    khoaHocList.forEach(kh => {
      if (kh.ngay_ket_thuc) {
        const y = new Date(kh.ngay_ket_thuc).getFullYear();
        if (y) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [khoaHocList]);

  const filteredHvList = useMemo(() => {
    const activeMsnvsInTargetUnits = new Set(
      personnelList
        .filter(ns => activeUnitSubordinates.includes(ns.id_don_vi) && ns.trang_thai !== 'Đã nghỉ việc')
        .map(ns => String(ns.ma_so_nhan_vien || '').trim().toLowerCase())
    );

    return hocVienList.filter(item => {
      const kh = khoaHocList.find(k => k.id === item.id_khoa_hoc);
      const year = kh?.ngay_ket_thuc ? new Date(kh.ngay_ket_thuc).getFullYear() : (kh?.ngay_bat_dau ? new Date(kh.ngay_bat_dau).getFullYear() : null);

      if (caNhanViewMode === 'matrix') {
        const itemMsnv = String(item.msnv || '').trim().toLowerCase();
        if (selectedUnitFilter && !activeMsnvsInTargetUnits.has(itemMsnv)) {
          return false;
        }
      } else {
        if (selectedUnitFilter && !activeUnitSubordinates.includes(item.id_don_vi)) {
          return false;
        }
      }

      if (selectedNam !== 'ALL' && year !== Number(selectedNam)) {
        return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = item.ho_ten || '';
        const msnv = item.msnv || '';
        const unitName = donViMap[item.id_don_vi] || '';
        return (
          name.toLowerCase().includes(term) ||
          msnv.toLowerCase().includes(term) ||
          unitName.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [hocVienList, khoaHocList, personnelList, activeUnitSubordinates, selectedUnitFilter, selectedNam, searchTerm, caNhanViewMode, donViMap]);

  const matrixYears = useMemo(() => {
    const yearsSet = new Set<number>();
    filteredHvList.forEach(item => {
      const kh = khoaHocList.find(k => k.id === item.id_khoa_hoc);
      const year = kh?.ngay_ket_thuc ? new Date(kh.ngay_ket_thuc).getFullYear() : (kh?.ngay_bat_dau ? new Date(kh.ngay_bat_dau).getFullYear() : null);
      if (year) yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [filteredHvList, khoaHocList]);

  const groupedHocVienMatrix = useMemo(() => {
    const employeeUnitMap = new Map<string, string>();
    personnelList.forEach(ns => {
      if (ns.ma_so_nhan_vien) {
        employeeUnitMap.set(String(ns.ma_so_nhan_vien).trim().toLowerCase(), ns.id_don_vi);
      }
    });

    const map = new Map<string, {
      msnv: string;
      ho_ten: string;
      id_don_vi: string;
      recordsByYear: Map<number, any>;
      allRecords: any[];
    }>();

    filteredHvList.forEach(item => {
      const key = String(item.msnv || '').trim().toLowerCase();
      if (!key) return;

      const kh = khoaHocList.find(k => k.id === item.id_khoa_hoc);
      const year = kh?.ngay_ket_thuc ? new Date(kh.ngay_ket_thuc).getFullYear() : (kh?.ngay_bat_dau ? new Date(kh.ngay_bat_dau).getFullYear() : new Date().getFullYear());

      const existing = map.get(key) || {
        msnv: item.msnv,
        ho_ten: item.ho_ten,
        id_don_vi: employeeUnitMap.get(key) || item.id_don_vi,
        recordsByYear: new Map<number, any>(),
        allRecords: []
      };

      existing.recordsByYear.set(year, item);
      existing.allRecords.push({ ...item, khInfo: kh });
      map.set(key, existing);
    });

    // Bổ sung nhân sự chưa từng học thuộc đơn vị được chọn
    if (selectedUnitFilter) {
      personnelList.forEach(ns => {
        if (['Đã nghỉ việc', 'Đã thôi việc', 'Đã điều chuyển', 'Nghỉ việc'].includes(ns.trang_thai)) return;
        if (!activeUnitSubordinates.includes(ns.id_don_vi)) return;
        const key = String(ns.ma_so_nhan_vien || '').trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            msnv: ns.ma_so_nhan_vien,
            ho_ten: ns.ho_ten,
            id_don_vi: ns.id_don_vi,
            recordsByYear: new Map<number, any>(),
            allRecords: []
          });
        }
      });
    }

    return Array.from(map.values());
  }, [filteredHvList, personnelList, selectedUnitFilter, activeUnitSubordinates, khoaHocList]);

  useEffect(() => {
    if (onTabCountsChange) {
      onTabCountsChange(khoaHocList.length, groupedHocVienMatrix.length);
    }
  }, [khoaHocList.length, groupedHocVienMatrix.length, onTabCountsChange]);

  useEffect(() => {
    setSelectedKhoaHoc(null);
  }, [activeSubTab]);

  // 🟢 DANH SÁCH NCC ĐÀO TẠO & CHỨNG NHẬN
  const trainingNccList = useMemo(() => {
    return nccList.filter(n => {
      const cat = String(n.nhom_dich_vu || '').toLowerCase();
      return cat.includes('đào tạo') || cat.includes('chứng nhận') || cat.includes('kiểm định');
    });
  }, [nccList]);

  // 🟢 TÍNH TOÁN 4 THẺ CHỈ SỐ KPI THẺ ATVSLĐ
  const safetySummaryCounts = useMemo(() => {
    let chua_hoc = 0, qua_han = 0, sap_het_han = 0, an_toan = 0;
    const targetNsList = personnelList.filter(ns => 
      ns.trang_thai !== 'Đã nghỉ việc' &&
      (!selectedUnitFilter || activeUnitSubordinates.includes(ns.id_don_vi))
    );

    targetNsList.forEach(p => {
      const isCertActive = p.cc_atvsld === true || String(p.cc_atvsld).toLowerCase() === 'true';
      if (!isCertActive || !p.gia_tri_den) {
        chua_hoc++;
      } else {
        const daysLeft = Math.ceil((new Date(p.gia_tri_den).getTime() - Date.now()) / (1000 * 3600 * 24));
        if (daysLeft <= 0) qua_han++;
        else if (daysLeft <= 60) sap_het_han++;
        else an_toan++;
      }
    });

    return { total: targetNsList.length, chua_hoc, qua_han, sap_het_han, an_toan };
  }, [personnelList, selectedUnitFilter, activeUnitSubordinates]);

  // 🟢 LỌC MA TRẬN THEO STATUS THẺ KPI TÍCH HỢP
  const filteredMatrixData = useMemo(() => {
    if (statusMatrixFilter === 'ALL') return groupedHocVienMatrix;

    return groupedHocVienMatrix.filter(emp => {
      const matchedPerson = personnelList.find(p => String(p.ma_so_nhan_vien || '').trim().toLowerCase() === String(emp.msnv || '').trim().toLowerCase());
      const isCertActive = matchedPerson?.cc_atvsld === true || String(matchedPerson?.cc_atvsld).toLowerCase() === 'true';
      let status = 'CHUA_HOC';
      if (isCertActive && matchedPerson?.gia_tri_den) {
        const daysLeft = Math.ceil((new Date(matchedPerson.gia_tri_den).getTime() - Date.now()) / (1000 * 3600 * 24));
        if (daysLeft <= 0) status = 'QUA_HAN';
        else if (daysLeft <= 60) status = 'SAP_HET_HAN';
        else status = 'AN_TOAN';
      }
      return status === statusMatrixFilter;
    });
  }, [groupedHocVienMatrix, statusMatrixFilter, personnelList]);

  // Hàm xuất Excel đợt học tiếp theo chuẩn cấu trúc cột yêu cầu
  const handleExportNextCourse = () => {
    const targetNsList = personnelList.filter(ns => 
      ns.trang_thai !== 'Đã nghỉ việc' &&
      (!selectedUnitFilter || activeUnitSubordinates.includes(ns.id_don_vi))
    );

    const exportData = targetNsList
      .filter(ns => {
        const isCertActive = ns.cc_atvsld === true || String(ns.cc_atvsld).toLowerCase() === 'true';
        if (statusMatrixFilter === 'CHUA_HOC') return !isCertActive || !ns.gia_tri_den;
        if (statusMatrixFilter === 'QUA_HAN') return isCertActive && ns.gia_tri_den && new Date(ns.gia_tri_den) <= new Date();
        if (statusMatrixFilter === 'SAP_HET_HAN') {
          if (!isCertActive || !ns.gia_tri_den) return false;
          const daysLeft = Math.ceil((new Date(ns.gia_tri_den).getTime() - Date.now()) / (1000 * 3600 * 24));
          return daysLeft > 0 && daysLeft <= 60;
        }
        if (statusMatrixFilter === 'AN_TOAN') {
          if (!isCertActive || !ns.gia_tri_den) return false;
          const daysLeft = Math.ceil((new Date(ns.gia_tri_den).getTime() - Date.now()) / (1000 * 3600 * 24));
          return daysLeft > 60;
        }
        // Trạng thái ALL: xuất tất cả nhân sự cần huấn luyện (chưa học, quá hạn hoặc sắp hết hạn < 60 ngày)
        if (!isCertActive || !ns.gia_tri_den) return true;
        const expiryDate = new Date(ns.gia_tri_den);
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + 60);
        return expiryDate <= limitDate;
      });

    if (exportData.length === 0) {
      toast.info('Không tìm thấy nhân sự phù hợp với bộ lọc để xuất Excel!');
      return;
    }

    let rowsHTML = '';
    exportData.forEach((ns, idx) => {
      const status = !ns.cc_atvsld 
        ? 'Chưa huấn luyện ATVSLĐ' 
        : (ns.gia_tri_den && new Date(ns.gia_tri_den) <= new Date() ? `Hết hạn chứng chỉ (${ns.gia_tri_den})` : `Sắp hết hạn chứng chỉ (${ns.gia_tri_den})`);
      
      const tenDV = donViMap[ns.id_don_vi] || ns.id_don_vi || '';

      rowsHTML += `<tr>
        <td class="center">${idx + 1}</td>
        <td class="center font-mono">${ns.ma_so_nhan_vien || ''}</td>
        <td class="bold">${ns.ho_ten || ''}</td>
        <td class="center">${ns.ngay_nhan_vien || ''}</td>
        <td class="center">${ns.nam_sinh || ''}</td>
        <td>Việt Nam</td>
        <td class="center font-mono">${ns.cccd || ''}</td>
        <td class="center">${ns.gioi_tinh || ''}</td>
        <td>${ns.chuc_vu || ''}</td>
        <td>${tenDV}</td>
        <td class="center bold">${ns.nhom_doi_tuong || ''}</td>
        <td></td>
        <td></td>
        <td>${status}</td>
      </tr>`;
    });

    const tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; font-family: 'Times New Roman', serif; } th, td { border: 1px solid #000000; padding: 6px; vertical-align: middle; } .header { background-color: #d9e1f2; color: #0f243e; font-weight: bold; text-align: center; } .center { text-align: center; } .bold { font-weight: bold; } .font-mono { font-family: 'Consolas', monospace; }</style></head><body><table><thead><tr class="header"><th>Stt</th><th>MSNV</th><th>Họ tên</th><th>Ngày vào làm</th><th>Ngày sinh</th><th>Quốc tịch</th><th>Số CCCD</th><th>Giới tính</th><th>Chức vụ</th><th>Đơn vị</th><th>Nhóm</th><th>Thời gian huấn luyện (dự kiến)</th><th>Nội dung huấn luyện</th><th>Ghi chú</th></tr></thead><tbody>${rowsHTML}</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_sach_de_xuat_huan_luyen_ATVSLD_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất thành công ${exportData.length} nhân sự!`);
  };

  // Thống kê đầu Tab
  const stats = useMemo(() => {
    const targetKhoaHocs = khoaHocList.filter(kh =>
      !selectedUnitFilter ||
      !kh.id_don_vi ||
      activeUnitSubordinates.includes(kh.id_don_vi)
    );

    const targetHocViens = hocVienList.filter(hv =>
      !selectedUnitFilter ||
      activeUnitSubordinates.includes(hv.id_don_vi)
    );

    const totalKh = targetKhoaHocs.length;
    const totalHv = targetHocViens.length;
    let datCount = 0;
    let failCount = 0;

    targetHocViens.forEach(hv => {
      // SỬA LỖI: So khớp CHÍNH XÁC và chuẩn hóa NFC để tránh dùng includes() gây nhận nhầm trạng thái "chưa đạt"
      const kq = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
      if (kq === 'đạt' || kq === 'dat') {
        datCount++;
      } else if (kq) {
        failCount++;
      }
    });

    const percentDat = totalHv > 0 ? Math.round((datCount / totalHv) * 100) : 0;
    return { totalKh, totalHv, datCount, failCount, percentDat };
  }, [khoaHocList, hocVienList, selectedUnitFilter, activeUnitSubordinates]);

  // Tạo/Sửa khóa học
  const handleOpenEditModal = (kh: Partial<KhoaHuanLuyen> | null = null) => {
    setCurrentKhoaHoc(kh || {
      ten_khoa_hoc: '',
      don_vi_dao_tao: '',
      ngay_bat_dau: '',
      ngay_ket_thuc: '',
      dia_diem: '',
      si_so_du_kien: 0,
      trang_thai: 'Dự kiến',
      ghi_chu: '',
      ho_so: '',
      link_ho_so: '',
      id_don_vi: selectedUnitFilter || undefined // Tự động gán đơn vị hiện tại khi tạo mới
    });
    setIsEditModalOpen(true);
  };

  const handleSaveKhoaHoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentKhoaHoc?.ten_khoa_hoc || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const isCreate = !currentKhoaHoc.id;
      const dataToSave = { ...currentKhoaHoc };

      const saved = await apiService.save(dataToSave, isCreate ? 'create' : 'update', 'hs_khoa_huan_luyen');

      if (isCreate) {
        setKhoaHocList(prev => [saved, ...prev]);
        toast.success('Đã tạo khóa học mới!');
      } else {
        setKhoaHocList(prev => prev.map(item => item.id === saved.id ? saved : item));
        if (selectedKhoaHoc?.id === saved.id) {
          setSelectedKhoaHoc(saved);
        }
        toast.success('Đã cập nhật thông tin khóa học!');
      }
      setIsEditModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu thông tin khóa học.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKhoaHoc = (id: string) => {
    setDeleteTargetId(id);
    setConfirmType('KHOA_HOC');
  };

  const executeDelete = async () => {
    if (!deleteTargetId || !confirmType) return;
    try {
      if (confirmType === 'KHOA_HOC') {
        const hvInCourse = hocVienList.filter(item => item.id_khoa_hoc === deleteTargetId);
        await apiService.delete(deleteTargetId, 'hs_khoa_huan_luyen');
        setKhoaHocList(prev => prev.filter(item => item.id !== deleteTargetId));
        setHocVienList(prev => prev.filter(item => item.id_khoa_hoc !== deleteTargetId));
        if (selectedKhoaHoc?.id === deleteTargetId) {
          setSelectedKhoaHoc(null);
        }
        if (hvInCourse.length > 0) {
          await recalculateOshForPersonnel(hvInCourse.map(hv => ({ msnv: hv.msnv, id_don_vi: hv.id_don_vi })));
        }
        toast.success('Đã xóa khóa học thành công!');
        onReloadData?.();
      } else if (confirmType === 'HOC_VIEN') {
        const hvToDelete = hocVienList.find(item => item.id === deleteTargetId);
        await apiService.delete(deleteTargetId, 'hs_hoc_vien_khoa_huan_luyen');
        setHocVienList(prev => prev.filter(item => item.id !== deleteTargetId));

        // Giảm sĩ số thực tế
        if (selectedKhoaHoc) {
          const updatedKhoa = {
            ...selectedKhoaHoc,
            si_so_thuc_te: Math.max(0, (selectedKhoaHoc.si_so_thuc_te || 1) - 1)
          };
          await apiService.save(updatedKhoa, 'update', 'hs_khoa_huan_luyen');
          setKhoaHocList(prev => prev.map(k => k.id === updatedKhoa.id ? updatedKhoa : k));
          setSelectedKhoaHoc(updatedKhoa);
        }
        if (hvToDelete) {
          await recalculateOshForPersonnel([{ msnv: hvToDelete.msnv, id_don_vi: hvToDelete.id_don_vi }]);
        }
        toast.success('Đã xóa học viên khỏi khóa học!');
        onReloadData?.();
      }
    } catch (err) {
      toast.error('Lỗi khi xóa dữ liệu.');
    } finally {
      setConfirmType(null);
      setDeleteTargetId(null);
    }
  };

  // Cấu hình cột import Excel
  const columnMapping: ColumnMapItem[] = [
    { label: 'STT', key: 'stt', type: 'number' },
    { label: 'MSNV', key: 'msnv', type: 'text', required: true },
    { label: 'Họ và tên', key: 'ho_ten', type: 'text' },
    { label: 'Ngày sinh', key: 'ngay_sinh', type: 'date' },
    { label: 'Giới tính', key: 'gioi_tinh', type: 'text' },
    { label: 'Số CCCD', key: 'so_cccd', type: 'text' },
    { label: 'Quốc tịch', key: 'quoc_tich', type: 'text' },
    { label: 'Chức vụ', key: 'chuc_vu', type: 'text' },
    { label: 'Đơn vị', key: 'don_vi_text', type: 'text' },
    { label: 'Nhóm', key: 'nhom', type: 'text' },
    { label: 'Nội dung huấn luyện', key: 'noi_dung_huan_luyen', type: 'text' },
    { label: 'Thời gian', key: 'thoi_gian_text', type: 'text' },
    { label: 'Điểm LT', key: 'diem_ly_thuyet', type: 'number' },
    { label: 'Điểm TH', key: 'diem_thuc_hanh', type: 'number' },
    { label: 'Kết quả', key: 'ket_qua', type: 'text', required: true },
    { label: 'Ghi chú', key: 'ghi_chu', type: 'text' }
  ];

  // Hàm validate khi người dùng dán Excel
  const handleValidateRow = (row: any, allRows?: any[]) => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const msnv = String(row.msnv || '').trim();
    if (msnv) {
      // 1. Kiểm tra trùng lặp MSNV ngay trong cùng phiên dán Excel (Lỗi đỏ chặn lưu)
      if (allRows) {
        const duplicates = allRows.filter(r => String(r.msnv || '').trim() === msnv);
        if (duplicates.length > 1) {
          errors['msnv'] = 'Mã nhân viên bị trùng lặp trong danh sách dán.';
        }
      }

      // 2. Cảnh báo cột Nhóm trống hoặc không parse được số (Cảnh báo vàng)
      const nhomDigits = String(row.nhom || '').replace(/\D/g, '');
      if (!nhomDigits) {
        warnings['nhom'] = "Cột Nhóm trống/không hợp lệ, hệ thống sẽ mặc định Nhóm 3 — vui lòng kiểm tra lại.";
      }

      // 3. Cảnh báo cột Điểm Lý Thuyết không phải số (Cảnh báo vàng)
      if (row.diem_ly_thuyet !== undefined && row.diem_ly_thuyet !== null) {
        const ltVal = String(row.diem_ly_thuyet).trim();
        if (ltVal !== '' && isNaN(Number(ltVal))) {
          warnings['diem_ly_thuyet'] = "Giá trị điểm không hợp lệ, đã bỏ trống.";
        }
      }

      // 4. Cảnh báo cột Điểm Thực Hành không phải số (Cảnh báo vàng)
      if (row.diem_thuc_hanh !== undefined && row.diem_thuc_hanh !== null) {
        const thVal = String(row.diem_thuc_hanh).trim();
        if (thVal !== '' && isNaN(Number(thVal))) {
          warnings['diem_thuc_hanh'] = "Giá trị điểm không hợp lệ, đã bỏ trống.";
        }
      }

      // 5. Tìm kiếm nhân sự khớp trên toàn hệ thống (không cảnh báo đơn vị khác nữa)
      const match = personnelList.find(p => p.ma_so_nhan_vien === msnv);
      if (!match) {
        warnings['msnv'] = 'MSNV chưa khớp nhân viên hệ thống.';
      }
    }
    return { errors, warnings };
  };

  // Lưu học viên dán từ Excel & Kích hoạt đồng bộ ngược nền
  const handleSavePastedHocVien = async (pastedRows: any[]) => {
    if (!selectedKhoaHoc) return;
    try {
      const personnelMap = new Map<string, Personnel>();
      personnelList.forEach(p => {
        // Ưu tiên map hồ sơ thuộc đơn vị đang lọc để so khớp chính xác nếu có trùng lặp/kiêm nhiệm,
        // nếu không có thì mới lưu hồ sơ trên toàn hệ thống
        const existing = personnelMap.get(p.ma_so_nhan_vien);
        if (!existing || !activeUnitSubordinates.includes(existing.id_don_vi)) {
          personnelMap.set(p.ma_so_nhan_vien, p);
        }
      });

      // Tạo payload ghi bảng hs_hoc_vien_khoa_huan_luyen
      const updatedHocVienList = pastedRows.map((row, idx) => {
        const msnv = String(row.msnv || '').trim();
        const systemPerson = personnelMap.get(msnv);

        return {
          id: `HV${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          id_khoa_hoc: selectedKhoaHoc.id,
          stt: row.stt || (idx + 1),
          msnv: msnv,
          ho_ten: row.ho_ten || systemPerson?.ho_ten || '',
          ngay_sinh: row.ngay_sinh || systemPerson?.nam_sinh || null,
          gioi_tinh: row.gioi_tinh || systemPerson?.gioi_tinh || '',
          so_cccd: row.so_cccd || '',
          quoc_tich: row.quoc_tich || '',
          chuc_vu: row.chuc_vu || systemPerson?.chuc_vu || '',
          don_vi_text: row.don_vi_text || '',
          id_don_vi: selectedKhoaHoc?.id_don_vi || systemPerson?.id_don_vi || null,
          nhom: row.nhom || '',
          noi_dung_huan_luyen: row.noi_dung_huan_luyen || '',
          thoi_gian_text: row.thoi_gian_text || '',
          diem_ly_thuyet: row.diem_ly_thuyet,
          diem_thuc_hanh: row.diem_thuc_hanh,
          ket_qua: row.ket_qua || 'Chưa đạt',
          ghi_chu: row.ghi_chu || '',
          da_dong_bo_nhan_su: false
        };
      });

      // Lưu đợt học viên mới vào Supabase
      toast.info(`Đang lưu ${updatedHocVienList.length} học viên...`);

      // Xóa học viên cũ của khóa này (nếu dán đè/dán mới) trước khi import mới hoặc update đè.
      // Dựa theo đặc tả D.1: nếu msnv đã có thì UPDATE đè lên, chưa thì tạo mới.
      // Để đơn giản và chính xác, ta so khớp msnv hiện tại trong khóa:
      const existingInKhoa = hocVienList.filter(hv => hv.id_khoa_hoc === selectedKhoaHoc.id);
      const toSaveArray: any[] = [];

      updatedHocVienList.forEach(newItem => {
        const match = existingInKhoa.find(e => e.msnv === newItem.msnv);
        if (match) {
          toSaveArray.push({
            ...match,
            ...newItem,
            id: match.id // giữ nguyên ID để Supabase cập nhật PATCH/POST đè
          });
        } else {
          toSaveArray.push(newItem);
        }
      });

      // Lưu mảng
      await apiService.save(toSaveArray, 'create', 'hs_hoc_vien_khoa_huan_luyen');

      // Tải lại dữ liệu học viên
      const newHvList = await apiService.getHocVienKhoaHuanLuyen();
      setHocVienList(newHvList || []);

      toast.success(`Đã nhập thành công ${toSaveArray.length} học viên! Bắt đầu đồng bộ thông tin nhân sự...`);

      // Cập nhật sĩ số thực tế cho khóa học
      const countReal = newHvList.filter((hv: any) => hv.id_khoa_hoc === selectedKhoaHoc.id).length;
      const updatedKhoa = {
        ...selectedKhoaHoc,
        si_so_thuc_te: countReal
      };
      await apiService.save(updatedKhoa, 'update', 'hs_khoa_huan_luyen');
      setKhoaHocList(prev => prev.map(k => k.id === updatedKhoa.id ? updatedKhoa : k));
      setSelectedKhoaHoc(updatedKhoa);
      onReloadData?.();

      // Kích hoạt tiến trình đồng bộ ngược chạy nền (D.2)
      triggerBackgroundSync(toSaveArray);

      const affectedRecalc: { msnv: string; id_don_vi: string | null }[] = [];
      toSaveArray.forEach(newItem => {
        const oldItem = existingInKhoa.find(e => e.msnv === newItem.msnv);
        if (oldItem) {
          const oldKq = String(oldItem.ket_qua || '').trim().toLowerCase().normalize('NFC');
          const newKq = String(newItem.ket_qua || '').trim().toLowerCase().normalize('NFC');
          const oldIsDat = oldKq === 'đạt' || oldKq === 'dat';
          const newIsDat = newKq === 'đạt' || newKq === 'dat';
          if (
            !newIsDat ||
            (newIsDat && oldIsDat && (
              String(oldItem.nhom || '').trim() !== String(newItem.nhom || '').trim() ||
              String(oldItem.thoi_gian_text || '').trim() !== String(newItem.thoi_gian_text || '').trim()
            ))
          ) {
            affectedRecalc.push({ msnv: newItem.msnv, id_don_vi: newItem.id_don_vi });
          }
        }
      });
      if (affectedRecalc.length > 0) {
        await recalculateOshForPersonnel(affectedRecalc);
      }

    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi nhập danh sách học viên.');
    }
  };

  // Hàm tính toán lại trạng thái ATVSLĐ cho danh sách nhân viên bị ảnh hưởng (xóa học viên, xóa khóa, sửa kết quả)
  const recalculateOshForPersonnel = async (affectedList: { msnv: string; id_don_vi: string | null }[]) => {
    if (affectedList.length === 0) return;

    // Lọc trùng theo msnv + id_don_vi
    const uniqueKeys = new Set<string>();
    const uniqueAffected = affectedList.filter(item => {
      const key = `${item.msnv}_${item.id_don_vi || ''}`;
      if (uniqueKeys.has(key)) return false;
      uniqueKeys.add(key);
      return true;
    });

    try {
      // Load dữ liệu học viên và khóa học mới nhất từ database
      const latestHvList: HocVienKhoaHuanLuyen[] = await apiService.getHocVienKhoaHuanLuyen().catch(() => []);
      const latestKhList: KhoaHuanLuyen[] = await apiService.getKhoaHuanLuyen().catch(() => []);

      const khMap = new Map<string, KhoaHuanLuyen>();
      latestKhList.forEach(kh => khMap.set(kh.id, kh));

      for (const item of uniqueAffected) {
        // Tìm toàn bộ hồ sơ nhân sự khớp (bao gồm cả hồ sơ chính lẫn các hồ sơ kiêm nhiệm ở đơn vị khác)
        const matchedPersons = personnelList.filter(p =>
          String(p.ma_so_nhan_vien || '').trim().toLowerCase() === String(item.msnv || '').trim().toLowerCase()
        );

        if (matchedPersons.length === 0) continue;

        // Tìm tất cả các khóa học "Đạt" khác của học viên này (trên toàn hệ thống)
        const dats = latestHvList.filter(hv => {
          if (String(hv.msnv || '').trim().toLowerCase() !== String(item.msnv || '').trim().toLowerCase()) return false;
          const kqNormalized = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
          return kqNormalized === 'đạt' || kqNormalized === 'dat';
        });

        if (dats.length === 0) {
          // Trường hợp A: không còn khóa học nào Đạt -> Reset trạng thái ATVSLĐ của mọi hồ sơ khớp (chính + kiêm nhiệm) về false/null
          for (const person of matchedPersons) {
            const updatedPerson = {
              ...person,
              cc_atvsld: false,
              nhom_doi_tuong: null,
              huan_luyen_tu: null,
              huan_luyen_den: null,
              gia_tri_den: null,
              chung_nhan: null
            };
            await apiService.save(updatedPerson, 'update', 'ns_dich_vu');
          }
        } else {
          // Trường hợp B: còn khóa học Đạt -> Sắp xếp chọn khóa học Đạt gần nhất theo ngày kết thúc khóa học
          dats.sort((a, b) => {
            const khA = khMap.get(a.id_khoa_hoc);
            const khB = khMap.get(b.id_khoa_hoc);
            const dateA = khA?.ngay_ket_thuc || khA?.ngay_bat_dau || '';
            const dateB = khB?.ngay_ket_thuc || khB?.ngay_bat_dau || '';
            return dateB.localeCompare(dateA); // Ngày kết thúc gần nhất lên đầu
          });

          const latestHv = dats[0];
          const latestKh = khMap.get(latestHv.id_khoa_hoc);

          const nhomDigits = String(latestHv.nhom || '').replace(/\D/g, '');
          const nhom = nhomDigits || '3';
          const huanLuyenDen = extractHuanLuyenDen(latestHv.thoi_gian_text, latestKh?.ngay_ket_thuc || new Date().toISOString().slice(0, 10));
          const giaTriDen = calcGiaTriDen(huanLuyenDen, nhom, chuKyList);
          const chungNhan = getChungNhanByNhom(nhom);

          // Cập nhật đồng bộ cho TẤT CẢ bản ghi (chính + kiêm nhiệm)
          for (const person of matchedPersons) {
            const updatedPerson = {
              ...person,
              cc_atvsld: true,
              nhom_doi_tuong: nhom,
              huan_luyen_tu: latestKh?.ngay_bat_dau || null,
              huan_luyen_den: huanLuyenDen,
              gia_tri_den: giaTriDen,
              chung_nhan: chungNhan
            };
            await apiService.save(updatedPerson, 'update', 'ns_dich_vu');
          }
        }
      }
    } catch (err) {
      console.error('Lỗi tính toán lại trạng thái ATVSLĐ nhân sự:', err);
    }
  };

  // Trích xuất ngày kết thúc từ chuỗi thoi_gian_text hoặc dùng fallback
  const extractHuanLuyenDen = (timeText: string, fallbackDate: string): string => {
    if (!timeText) return fallbackDate;

    // Tìm cụm ngày cuối cùng định dạng dd/mm/yyyy
    const matches = timeText.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g);
    if (matches && matches.length > 0) {
      const lastDateStr = matches[matches.length - 1];
      const parts = lastDateStr.split(/[\/\-.]/);
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return fallbackDate;
  };

  // Logic đồng bộ ngược nền Batch song song (PHẦN D.2) hỗ trợ Nhân sự Kiêm nhiệm
  const triggerBackgroundSync = async (hvToSync: any[]) => {
    // 1. Lọc học viên "Đạt", có MSNV tồn tại trong hệ thống (kiểm tra trên toàn bộ bản ghi chính & kiêm nhiệm)
    const pendingSync = hvToSync.filter(hv => {
      const kqNormalized = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
      const isDat = kqNormalized === 'đạt' || kqNormalized === 'dat';
      const msnvKey = String(hv.msnv || '').trim().toLowerCase();
      
      const matchingPersons = personnelList.filter(p => String(p.ma_so_nhan_vien || '').trim().toLowerCase() === msnvKey);
      if (!isDat || matchingPersons.length === 0) return false;

      const studentCccd = hv.so_cccd ? String(hv.so_cccd).trim() : '';
      const hasStudentCccd = studentCccd && studentCccd.toLowerCase() !== 'null';

      const needsSync = matchingPersons.some(person => {
        if (!person.cc_atvsld) return true;
        const currentCccd = person.cccd ? String(person.cccd).trim() : '';
        const isCccdEmpty = !currentCccd || currentCccd.toLowerCase() === 'null';
        return isCccdEmpty && hasStudentCccd;
      });

      return !hv.da_dong_bo_nhan_su || needsSync;
    });

    if (pendingSync.length === 0) {
      toast.info('Không có nhân sự nào cần đồng bộ thông tin chứng chỉ.');
      return;
    }

    setSyncProgress({ current: 0, total: pendingSync.length });

    // Cắt mảng thành các batch (cỡ lô 15 dòng)
    const BATCH_SIZE = 15;
    const batches: any[][] = [];
    for (let i = 0; i < pendingSync.length; i += BATCH_SIZE) {
      batches.push(pendingSync.slice(i, i + BATCH_SIZE));
    }

    let completed = 0;
    try {
      for (const batch of batches) {
        const promises = batch.map(async (hv) => {
          const msnvKey = String(hv.msnv || '').trim().toLowerCase();
          const matchedPersons = personnelList.filter(p => String(p.ma_so_nhan_vien || '').trim().toLowerCase() === msnvKey);

          if (matchedPersons.length === 0) return;

          // Regex trích xuất số nhóm '1'..'6' từ chuỗi nhom
          const nhomDigits = String(hv.nhom || '').replace(/\D/g, '');
          const nhom = nhomDigits || '3'; // mặc định nhóm 3 nếu thiếu

          // Xác định ngày huấn luyện
          const huanLuyenDen = extractHuanLuyenDen(hv.thoi_gian_text, selectedKhoaHoc?.ngay_ket_thuc || new Date().toISOString().slice(0, 10));
          const giaTriDen = calcGiaTriDen(huanLuyenDen, nhom, chuKyList);
          const chungNhan = getChungNhanByNhom(nhom);

          // Cập nhật thông tin cho TẤT CẢ bản ghi (chức vụ chính + kiêm nhiệm)
          for (const person of matchedPersons) {
            const currentCccd = person.cccd ? String(person.cccd).trim() : '';
            const isCccdEmpty = !currentCccd || currentCccd.toLowerCase() === 'null';
            const studentCccd = hv.so_cccd ? String(hv.so_cccd).trim() : '';
            const hasStudentCccd = studentCccd && studentCccd.toLowerCase() !== 'null';

            const updatedPerson = {
              ...person,
              cc_atvsld: true,
              nhom_doi_tuong: nhom,
              huan_luyen_tu: selectedKhoaHoc?.ngay_bat_dau || null,
              huan_luyen_den: huanLuyenDen,
              gia_tri_den: giaTriDen,
              chung_nhan: chungNhan,
              cccd: (isCccdEmpty && hasStudentCccd) ? studentCccd : person.cccd
            };

            await apiService.save(updatedPerson, 'update', 'ns_dich_vu');
          }

          // Đánh dấu dòng học viên là đã đồng bộ
          const updatedHv = {
            ...hv,
            da_dong_bo_nhan_su: true
          };
          await apiService.save(updatedHv, 'update', 'hs_hoc_vien_khoa_huan_luyen');
        });

        await Promise.all(promises);
        completed += batch.length;
        setSyncProgress({ current: completed, total: pendingSync.length });
      }

      // Invalidate cache 1 lần duy nhất sau khi batch xong
      if (apiService.save) {
        // Tải lại danh sách nhân sự mới sau khi hoàn thành
        const newPers = await apiService.getPersonnel();
        setPersonnelList(newPers || []);

        // Tải lại danh sách học viên
        const newHvList = await apiService.getHocVienKhoaHuanLuyen();
        setHocVienList(newHvList || []);
      }
      onReloadData?.();

      toast.success(`Đồng bộ thành công thông tin ATVSLĐ của ${completed} nhân sự!`);
    } catch (err) {
      console.error(err);
      toast.error('Gặp sự cố khi đồng bộ một số bản ghi nhân sự.');
    } finally {
      setSyncProgress(null);
    }
  };

  const handleManualSyncAll = () => {
    if (!selectedKhoaHoc) return;
    const hvInKhoa = hocVienList.filter(hv => hv.id_khoa_hoc === selectedKhoaHoc.id);
    triggerBackgroundSync(hvInKhoa);
  };

  const handleDeleteHocVien = (id: string) => {
    setDeleteTargetId(id);
    setConfirmType('HOC_VIEN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-lime-700">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="font-bold">Đang tải danh sách khóa huấn luyện...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-[15px] w-full">
      {/* 🔴 TIẾN ĐỘ ĐỒNG BỘ CHẠY NỀN */}
      {syncProgress && (
        <div className="bg-lime-50 border border-lime-200 text-lime-900 p-4 rounded-2xl flex items-center justify-between shadow-md shrink-0 animate-pulse">
          <div className="flex items-center gap-3">
            <RefreshCw className="animate-spin text-lime-600" size={20} />
            <div>
              <span className="font-bold text-sm">Đang đồng bộ ngược dữ liệu sang Nhân sự...</span>
              <p className="text-xs text-gray-500">Hoàn thành {syncProgress.current}/{syncProgress.total} nhân sự Đạt</p>
            </div>
          </div>
          <span className="text-xs font-black text-lime-700 bg-white px-2.5 py-1 rounded-lg border border-lime-100">
            {Math.round((syncProgress.current / syncProgress.total) * 100)}%
          </span>
        </div>
      )}

      {/* 🟢 KHUNG SUB-TAB CẤP 3 VỚI KHUNG BAO NHẠT HƠN 1 TÔNG (KÉO SÁT CHUẨN 15PX) */}
      {!activeSubTab3 && (
        <div className="relative shrink-0 mt-0 mb-0">
          {/* Khung bao bọc nhạt hơn 1 tông so với Cấp 2 */}
          <div className="bg-lime-50/70 p-1.5 rounded-2xl border border-lime-200/80 shadow-2xs flex flex-wrap items-center gap-[15px] w-fit">
            <button
              onClick={() => {
                setActiveSubTab('khoahoc');
                setSelectedKhoaHoc(null);
              }}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeSubTab === 'khoahoc'
                  ? 'bg-lime-700 text-white shadow-sm ring-2 ring-lime-300'
                  : 'text-lime-950 hover:bg-lime-100/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Khóa Đào tạo/Huấn luyện ({khoaHocList.length})
            </button>

            <button
              onClick={() => {
                setActiveSubTab('canhan');
                setSelectedKhoaHoc(null);
              }}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeSubTab === 'canhan'
                  ? 'bg-lime-700 text-white shadow-sm ring-2 ring-lime-300'
                  : 'text-lime-950 hover:bg-lime-100/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Lịch Sử Đào Tạo Cá Nhân ({groupedHocVienMatrix.length} nhân sự)
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'khoahoc' ? (
        <>
          {/* 1. KHỐI THỐNG KÊ KHOA HỌC */}
          {!selectedKhoaHoc && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              <div className="bg-white p-4 rounded-2xl border border-lime-100 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-full bg-lime-50 text-lime-750 flex items-center justify-center shrink-0 border border-lime-150">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Khóa học trong năm</p>
                  <p className="text-2xl font-black text-lime-700">{stats.totalKh}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-lime-100 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-full bg-lime-50 text-lime-750 flex items-center justify-center shrink-0 border border-lime-150">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Lượt học viên tham gia</p>
                  <p className="text-2xl font-black text-lime-700">{stats.totalHv}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-lime-100 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-full bg-lime-50 text-lime-750 flex items-center justify-center shrink-0 border border-lime-150">
                  <UserCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Học viên Đạt yêu cầu</p>
                  <p className="text-2xl font-black text-lime-700">
                    {stats.datCount} <span className="text-xs text-gray-400 font-medium">({stats.percentDat}%)</span>
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-lime-100 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-150">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Học viên Chưa Đạt</p>
                  <p className="text-2xl font-black text-red-600">{stats.failCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. KHU VỰC NỘI DUNG CHÍNH KHÓA HỌC */}
          {!selectedKhoaHoc ? (
            <div className="bg-white rounded-2xl border border-lime-100 shadow-sm overflow-hidden flex flex-col flex-1">
              {/* Action Bar */}
              <div className="p-4 bg-gray-50/50 border-b border-lime-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Tìm tên khóa học, đơn vị đào tạo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl outline-none text-xs font-semibold focus:ring-2 focus:ring-lime-500 bg-white"
                  />
                </div>
                {(user?.quyen === 'ADMIN' || user?.quyen === 'USER') && (
                  <button
                    onClick={() => handleOpenEditModal()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-lime-600 hover:bg-lime-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Plus size={16} />
                    Tạo khóa huấn luyện mới
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-lime-100 font-bold text-gray-600 uppercase">
                    <tr>
                      <th className="p-3 w-10 text-center">STT</th>
                      <th className="p-3 w-75">Tên khóa huấn luyện</th>
                      <th className="p-3">Đơn vị đào tạo</th>
                      <th className="p-3 text-center">Thời gian</th>
                      <th className="p-3">Địa điểm</th>
                      <th className="p-3 w-35 text-center">Sĩ số<br />(Dự kiến/Thực tế)</th>
                      <th className="p-3 text-center">Trạng thái</th>
                      <th className="p-3 font-semibold">Hồ sơ</th>
                      <th className="p-3 text-center w-36">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredKhoaHoc.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-16 text-center text-gray-400 italic">
                          Không tìm thấy khóa huấn luyện nào.
                        </td>
                      </tr>
                    ) : (
                      filteredKhoaHoc.map((kh, idx) => (
                        <tr key={kh.id} className="hover:bg-lime-50/20 transition-colors">
                          <td className="p-3 text-center text-gray-400 font-semibold">{idx + 1}</td>
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedKhoaHoc(kh)}
                              className="font-bold text-lime-800 hover:text-lime-600 hover:underline text-left outline-none"
                            >
                              {kh.ten_khoa_hoc}
                            </button>
                          </td>
                          <td className="p-3 font-semibold text-gray-700">{kh.don_vi_dao_tao || '---'}</td>
                          <td className="p-3 text-center font-medium text-gray-500">
                            {kh.ngay_bat_dau ? new Date(kh.ngay_bat_dau).toLocaleDateString('vi-VN') : '...'} -{' '}
                            {kh.ngay_ket_thuc ? new Date(kh.ngay_ket_thuc).toLocaleDateString('vi-VN') : '...'}
                          </td>
                          <td className="p-3 text-gray-655">{kh.dia_diem || '---'}</td>
                          <td className="p-3 text-center font-semibold text-gray-700">
                            {kh.si_so_du_kien || 0} / <span className="text-lime-700 font-bold">{kh.si_so_thuc_te || 0}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block min-w-[70px] ${kh.trang_thai === 'Hoàn thành'
                                ? 'bg-lime-100 text-lime-800 border-lime-200'
                                : kh.trang_thai === 'Đang diễn ra'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                }`}
                            >
                              {kh.trang_thai}
                            </span>
                          </td>
                          <td className="p-3 max-w-[220px]">
                            {kh.trang_thai === 'Hoàn thành' && kh.ho_so ? (
                              <div className="flex items-center gap-1.5" title={kh.ho_so}>
                                <span className="font-semibold text-gray-700 truncate block flex-1">
                                  {getShortHoSo(kh.ho_so)}
                                </span>
                                {kh.link_ho_so && (
                                  <a
                                    href={kh.link_ho_so}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-lime-700 hover:text-lime-500 shrink-0 p-1 hover:bg-lime-50 rounded-lg transition-colors flex items-center justify-center"
                                    title="Xem file hồ sơ đính kèm"
                                  >
                                    <Eye size={14} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">---</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedKhoaHoc(kh)}
                                className="px-2 py-1 text-xs font-bold text-lime-700 hover:bg-lime-50 border border-lime-250 rounded-lg transition-colors cursor-pointer"
                              >
                                Học viên
                              </button>
                              {(user?.quyen === 'ADMIN' || user?.quyen === 'USER') && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditModal(kh)}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-lime-750 rounded-lg cursor-pointer"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteKhoaHoc(kh.id)}
                                    className="p-1 hover:bg-red-50 text-gray-500 hover:text-red-650 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VIEW CHI TIẾT HỌC VIÊN CỦA KHÓA */
            <div className="flex-1 flex flex-col gap-6">
              {/* Header Chi tiết Khóa */}
              <div className="bg-white rounded-2xl border border-lime-100 p-5 shadow-sm flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center shrink-0">
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedKhoaHoc(null)}
                    className="flex items-center gap-1 text-xs font-bold text-lime-700 hover:text-lime-600 hover:underline outline-none"
                  >
                    <ChevronLeft size={16} /> Quay lại danh sách khóa học
                  </button>
                  <h3 className="text-xl font-black text-lime-800 uppercase flex items-center gap-2">
                    <BookOpen size={22} /> {selectedKhoaHoc.ten_khoa_hoc}
                  </h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500 font-semibold">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {selectedKhoaHoc.ngay_bat_dau ? new Date(selectedKhoaHoc.ngay_bat_dau).toLocaleDateString('vi-VN') : '...'} - {selectedKhoaHoc.ngay_ket_thuc ? new Date(selectedKhoaHoc.ngay_ket_thuc).toLocaleDateString('vi-VN') : '...'}</span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {selectedKhoaHoc.dia_diem || '---'}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> Sĩ số: {selectedKhoaHoc.si_so_du_kien || 0} dự kiến / {selectedKhoaHoc.si_so_thuc_te || 0} thực tế</span>
                    <span className="flex items-center gap-1"><Info size={14} /> Đơn vị đào tạo: {selectedKhoaHoc.don_vi_dao_tao || '---'}</span>
                  </div>
                </div>

                {(user?.quyen === 'ADMIN' || user?.quyen === 'USER') && (
                  <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleManualSyncAll}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-white border border-lime-300 hover:bg-lime-50 text-lime-800 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                      title="Đồng bộ ngược toàn bộ học viên đạt trong khóa sang hồ sơ nhân sự"
                    >
                      <RefreshCw size={15} /> Đồng bộ Nhân sự
                    </button>
                    <button
                      onClick={() => setIsPasteModalOpen(true)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-lime-100 transition-all cursor-pointer"
                    >
                      <ClipboardPaste size={15} /> Dán Excel Học viên
                    </button>
                  </div>
                )}
              </div>

              {/* Bảng Học viên trong khóa */}
              <div className="bg-white rounded-2xl border border-lime-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[350px]">
                {/* Thanh Tìm kiếm Học viên */}
                <div className="p-4 bg-gray-50/50 border-b border-lime-100 flex items-center justify-between shrink-0">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      type="text"
                      placeholder="Tìm học viên theo tên, MSNV, Đơn vị..."
                      value={hvSearchTerm}
                      onChange={e => setHvSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-lime-500 bg-white"
                    />
                  </div>
                  <span className="text-xs text-gray-400 italic">Hiển thị {filteredHocVien.length} học viên</span>
                </div>

                {/* Bảng Học viên */}
                <div className="overflow-auto custom-scrollbar flex-1 max-h-[60vh]">
                  <table className="w-full text-left border-collapse text-xs min-w-[1150px]">
                    <thead className="bg-gray-50 border-b border-lime-100 font-bold text-gray-600 uppercase sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3 w-20">Mã NV</th>
                        <th className="p-3 min-w-[200px] w-56">Họ và tên</th>
                        <th className="p-3 w-60">Nhân sự Đơn vị</th>
                        <th className="p-3">Chức vụ</th>
                        <th className="p-3 text-center">Nhóm</th>
                        <th className="p-3 ">Nội dung / Thời gian</th>
                        <th className="p-3 text-center">Điểm (LT / TH)</th>
                        <th className="p-3 text-center">Kết quả</th>
                        <th className="p-3 text-center w-24">Đồng bộ</th>
                        {(user?.quyen === 'ADMIN' || user?.quyen === 'USER') && <th className="p-3 text-center w-16">Xóa</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredHocVien.length === 0 ? (
                        <tr>
                          <td colSpan={(user?.quyen === 'ADMIN' || user?.quyen === 'USER') ? 11 : 10} className="p-16 text-center text-gray-400 italic">
                            Chưa có dữ liệu học viên trong khóa học này. Bấm nút "Dán Excel Học viên" để nhập danh sách.
                          </td>
                        </tr>
                      ) : (
                        filteredHocVien.map((hv, idx) => {
                          const kqNormalized = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
                          const isDat = kqNormalized === 'đạt' || kqNormalized === 'dat';
                          return (
                            <tr key={hv.id} className="hover:bg-lime-50/20 transition-colors">
                              <td className="p-3 text-center text-gray-450 font-semibold">{hv.stt || (idx + 1)}</td>
                              <td className="p-3 font-bold text-gray-700">{hv.msnv}</td>
                              <td className="p-3 font-bold text-lime-800 whitespace-nowrap">{hv.ho_ten}</td>
                              <td className="p-3">
                                <span className="font-semibold text-gray-700">{hv.don_vi_text || '---'}</span>
                                {hv.id_don_vi && (
                                  <p className="text-[10px] text-lime-650 font-bold flex items-center gap-0.5 mt-0.5">
                                    <CheckCircle size={10} /> Khớp: {donViMap[hv.id_don_vi]}
                                  </p>
                                )}
                                {!hv.id_don_vi && (
                                  <p className="text-[10px] text-yellow-600 font-bold flex items-center gap-0.5 mt-0.5">
                                    <AlertTriangle size={10} /> Chưa khớp mã đơn vị
                                  </p>
                                )}
                              </td>
                              <td className="p-3 text-gray-650">{hv.chuc_vu || '---'}</td>
                              <td className="p-3 text-center font-bold text-lime-800 text-sm">
                                {hv.nhom ? `Nhóm ${hv.nhom}` : '---'}
                              </td>
                              <td className="p-3">
                                <p className="font-semibold text-gray-700 leading-tight">{hv.noi_dung_huan_luyen || '---'}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{hv.thoi_gian_text || '---'}</p>
                              </td>
                              <td className="p-3 text-center font-semibold text-gray-750">
                                {hv.diem_ly_thuyet !== null && hv.diem_ly_thuyet !== undefined ? hv.diem_ly_thuyet : '-'} /{' '}
                                {hv.diem_thuc_hanh !== null && hv.diem_thuc_hanh !== undefined ? hv.diem_thuc_hanh : '-'}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black inline-block ${isDat
                                    ? 'bg-lime-100 text-lime-800 border-lime-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                    }`}
                                >
                                  {hv.ket_qua || 'Chưa đạt'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {hv.da_dong_bo_nhan_su ? (
                                  <span className="text-lime-700 font-bold flex items-center justify-center gap-0.5">
                                    <CheckCircle2 size={14} /> Đã đồng bộ
                                  </span>
                                ) : isDat && hv.id_don_vi ? (
                                  <span className="text-gray-400 font-semibold italic">Chờ đồng bộ</span>
                                ) : (
                                  <span className="text-gray-400 font-medium">Không hỗ trợ</span>
                                )}
                              </td>
                              {(user?.quyen === 'ADMIN' || user?.quyen === 'USER') && (
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleDeleteHocVien(hv.id)}
                                    className="p-1 hover:bg-red-50 text-gray-450 hover:text-red-650 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ==========================================
           🟢 CHẾ ĐỘ XEM LỊCH SỬ ĐÀO TẠO CÁ NHÂN (MATRIX & LIST)
           ========================================== */
        <div className="flex-1 flex flex-col gap-4 w-full">
          
          {/* 🟢 KHỐI 4 THẺ CHỈ SỐ KPI TÌNH TRẠNG THẺ ATVSLĐ (TÍCH HỢP VÀO BẢNG MA TRẬN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <div
              onClick={() => setStatusMatrixFilter(prev => prev === 'CHUA_HOC' ? 'ALL' : 'CHUA_HOC')}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3.5 ${
                statusMatrixFilter === 'CHUA_HOC' 
                  ? 'border-red-500 bg-red-50/40 ring-2 ring-red-300 shadow-md' 
                  : 'border-red-200 bg-white hover:border-red-500 hover:shadow-md'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <HelpCircle size={20} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chưa huấn luyện</p>
                <p className="text-xl font-black text-red-600">{safetySummaryCounts.chua_hoc}</p>
              </div>
            </div>

            <div
              onClick={() => setStatusMatrixFilter(prev => prev === 'QUA_HAN' ? 'ALL' : 'QUA_HAN')}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3.5 ${
                statusMatrixFilter === 'QUA_HAN' 
                  ? 'border-gray-800 bg-gray-100 ring-2 ring-gray-400 shadow-md' 
                  : 'border-gray-300 bg-white hover:border-gray-800 hover:shadow-md'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-800 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Đã quá hạn thẻ</p>
                <p className="text-xl font-black text-gray-900">{safetySummaryCounts.qua_han}</p>
              </div>
            </div>

            <div
              onClick={() => setStatusMatrixFilter(prev => prev === 'SAP_HET_HAN' ? 'ALL' : 'SAP_HET_HAN')}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3.5 ${
                statusMatrixFilter === 'SAP_HET_HAN' 
                  ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-300 shadow-md' 
                  : 'border-orange-200 bg-white hover:border-orange-500 hover:shadow-md'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Sắp hết hạn (&lt;60 ngày)</p>
                <p className="text-xl font-black text-orange-600">{safetySummaryCounts.sap_het_han}</p>
              </div>
            </div>

            <div
              onClick={() => setStatusMatrixFilter(prev => prev === 'AN_TOAN' ? 'ALL' : 'AN_TOAN')}
              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3.5 ${
                statusMatrixFilter === 'AN_TOAN' 
                  ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-300 shadow-md' 
                  : 'border-emerald-200 bg-white hover:border-emerald-500 hover:shadow-md'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCheck size={20} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Thẻ hợp lệ (An toàn)</p>
                <p className="text-xl font-black text-emerald-600">{safetySummaryCounts.an_toan}</p>
              </div>
            </div>
          </div>

          {/* Header & Bộ lọc */}
          <div className="bg-white rounded-2xl border border-lime-100 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between shrink-0">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCaNhanViewMode('matrix')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${caNhanViewMode === 'matrix' ? 'bg-white text-lime-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Bảng Ma Trận
                </button>
                <button
                  type="button"
                  onClick={() => setCaNhanViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${caNhanViewMode === 'list' ? 'bg-white text-lime-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Bảng Chi Tiết
                </button>
              </div>

              {/* Lọc Năm */}
              <select
                value={selectedNam}
                onChange={e => setSelectedNam(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-xs font-bold bg-white text-gray-700"
              >
                <option value="ALL">Tất Cả Các Năm</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>Năm {yr}</option>
                ))}
              </select>
            </div>

            {/* Tìm kiếm & Xuất Excel */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-end">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="Tìm theo tên, MSNV, Đơn vị..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-lime-500 bg-white"
                />
              </div>

              <button
                onClick={handleExportNextCourse}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-emerald-100 transition-all cursor-pointer"
              >
                <Download size={14} />
                Xuất Excel Đợt Học Tiếp Theo
              </button>
            </div>
          </div>

          {caNhanViewMode === 'matrix' ? (
            /* 🟢 MATRIX VIEW HỌC VIÊN CÁ NHÂN */
            <div className="bg-white rounded-2xl border border-lime-100 shadow-sm overflow-hidden flex flex-col flex-1 max-h-[68vh]">
              <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-max min-w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 shadow-xs">
                    <tr className="bg-[#386641] text-white font-bold h-[40px]">
                      <th className="px-3 text-center min-w-[50px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">STT</th>
                      <th className="px-3 min-w-[100px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">MSNV</th>
                      <th className="px-3 min-w-[220px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Họ và Tên</th>
                      <th className="px-3 min-w-[220px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Đơn vị hiện tại</th>
                      <th className="px-3 min-w-[180px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Chức vụ</th>
                      
                      {matrixYears.map(yr => (
                        <th key={yr} className="px-3 text-center min-w-[120px] border-b border-lime-800 border-l border-lime-800 bg-lime-900/60 whitespace-nowrap h-[40px] align-middle">
                          Năm {yr}
                        </th>
                      ))}

                      <th className="px-3 text-center min-w-[160px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Tình trạng hiệu lực</th>
                      <th className="px-3 text-center min-w-[80px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Lịch sử</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredMatrixData.length === 0 ? (
                      <tr>
                        <td colSpan={7 + matrixYears.length} className="p-16 text-center text-gray-400 italic">
                          Không có dữ liệu ma trận đào tạo phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredMatrixData.map((emp, idx) => {
                        const isExpanded = expandedMsnv === emp.msnv;
                        const matchedPerson = personnelList.find(p => p.ma_so_nhan_vien === emp.msnv);
                        
                        let statusColor = 'bg-gray-100 text-gray-700 border-gray-200';
                        let statusText = 'Chưa huấn luyện';
                        const isCertActive = matchedPerson?.cc_atvsld === true || String(matchedPerson?.cc_atvsld).toLowerCase() === 'true';
                        if (isCertActive && matchedPerson?.gia_tri_den) {
                          const isExpired = new Date(matchedPerson.gia_tri_den) <= new Date();
                          statusColor = isExpired ? 'bg-red-100 text-red-850 border-red-200' : 'bg-lime-100 text-lime-800 border-lime-200';
                          statusText = isExpired ? 'Đã hết hạn' : 'Còn hiệu lực';
                        }

                        return (
                          <React.Fragment key={emp.msnv}>
                            <tr className={`hover:bg-lime-50/20 transition-colors h-[40px] ${isExpanded ? 'bg-lime-50/40 font-semibold' : ''}`}>
                              <td className="px-3 text-center text-gray-400 font-bold whitespace-nowrap h-[40px] align-middle">{idx + 1}</td>
                              <td className="px-3 font-mono font-bold text-gray-700 whitespace-nowrap h-[40px] align-middle">{emp.msnv}</td>
                              <td className="px-3 font-bold text-lime-900 whitespace-nowrap h-[40px] align-middle">{emp.ho_ten}</td>
                              <td className="px-3 text-gray-600 whitespace-nowrap h-[40px] align-middle">{donViMap[emp.id_don_vi] || emp.id_don_vi || '---'}</td>
                              <td className="px-3 text-gray-650 whitespace-nowrap h-[40px] align-middle">{matchedPerson?.chuc_vu || '---'}</td>
                              
                              {matrixYears.map(yr => {
                                const rec = emp.recordsByYear.get(yr);
                                if (!rec) return <td key={yr} className="px-3 text-center text-gray-300 border-l border-gray-100 whitespace-nowrap h-[40px] align-middle">—</td>;

                                const isDat = String(rec.ket_qua || '').trim().toLowerCase().normalize('NFC') === 'đạt' || String(rec.ket_qua || '').trim().toLowerCase().normalize('NFC') === 'dat';

                                return (
                                  <td key={yr} className="px-2 border-l border-gray-100 bg-gray-50/30 text-center whitespace-nowrap h-[40px] align-middle">
                                    <div className="inline-flex items-center gap-1">
                                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isDat ? 'bg-lime-100 text-lime-850 border border-lime-200' : 'bg-red-50 text-red-750 border border-red-200'}`}>
                                        {isDat ? 'Đạt' : 'Chưa Đạt'}
                                      </span>
                                      <span className="text-[9px] text-gray-500 font-bold">Nhóm {rec.nhom || '3'}</span>
                                    </div>
                                  </td>
                                );
                              })}

                              <td className="px-3 text-center whitespace-nowrap h-[40px] align-middle">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-black ${statusColor}`}>
                                  {statusText}
                                </span>
                              </td>

                              <td className="px-3 text-center whitespace-nowrap h-[40px] align-middle">
                                <button
                                  onClick={() => setExpandedMsnv(isExpanded ? null : emp.msnv)}
                                  className={`p-1 rounded-lg transition-all cursor-pointer ${isExpanded ? 'bg-lime-600 text-white' : 'text-gray-550 hover:bg-gray-100'}`}
                                >
                                  <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-lime-50/20">
                                <td colSpan={7 + matrixYears.length} className="p-4 border-b border-lime-100">
                                  <div className="bg-white p-4 rounded-xl border border-lime-150 shadow-inner space-y-3">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                      <h4 className="font-bold text-lime-900 text-xs flex items-center gap-1.5">
                                        <Activity className="w-4 h-4 text-lime-650" />
                                        Tiền sử tham gia huấn luyện ATVSLĐ của <span className="font-black text-lime-950">{emp.ho_ten}</span> ({emp.msnv})
                                      </h4>
                                      <span className="text-[10px] text-gray-500">Đã tham gia {emp.allRecords.length} khóa học</span>
                                    </div>

                                    {emp.allRecords.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic text-center py-2">Chưa có lịch sử tham gia khóa học nào trong hệ thống.</p>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {emp.allRecords.map(rec => {
                                          const isDat = String(rec.ket_qua || '').trim().toLowerCase().normalize('NFC') === 'đạt' || String(rec.ket_qua || '').trim().toLowerCase().normalize('NFC') === 'dat';
                                          return (
                                            <div key={rec.id} className="p-3 bg-gray-50 rounded-xl border border-gray-205 space-y-1 relative">
                                              <div className="flex items-center justify-between">
                                                <span className="font-bold text-lime-900 text-[11px] truncate max-w-[160px]" title={rec.khInfo?.ten_khoa_hoc}>
                                                  {rec.khInfo?.ten_khoa_hoc || 'Khóa huấn luyện'}
                                                </span>
                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${isDat ? 'bg-lime-100 text-lime-800 border border-lime-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                  {isDat ? 'Đạt' : 'Chưa Đạt'}
                                                </span>
                                              </div>
                                              <div className="text-[10px] space-y-0.5 text-gray-600">
                                                <p><span className="text-gray-400">Đơn vị lúc học:</span> <span className="font-bold text-gray-700">{donViMap[rec.id_don_vi] || rec.id_don_vi}</span></p>
                                                <p><span className="text-gray-400">Nhóm:</span> <span className="font-bold text-gray-700">Nhóm {rec.nhom || '3'}</span></p>
                                                <p><span className="text-gray-400">Thời gian:</span> <span className="font-medium text-gray-700">{rec.thoi_gian_text || '---'}</span></p>
                                                {rec.diem_ly_thuyet !== null && <p><span className="text-gray-400">Điểm:</span> <span className="font-bold text-gray-700">LT: {rec.diem_ly_thuyet} / TH: {rec.diem_thuc_hanh}</span></p>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* 🟢 LIST VIEW HỌC VIÊN CHI TIẾT */
            <div className="bg-white rounded-2xl border border-lime-100 shadow-sm overflow-hidden flex flex-col flex-1 max-h-[68vh]">
              <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-max min-w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 shadow-xs">
                    <tr className="bg-[#386641] text-white font-bold h-[40px]">
                      <th className="px-3 text-center min-w-[50px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">STT</th>
                      <th className="px-3 min-w-[100px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">MSNV</th>
                      <th className="px-3 min-w-[220px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Họ và Tên</th>
                      <th className="px-3 min-w-[220px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Đơn vị lúc học</th>
                      <th className="px-3 min-w-[280px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Khóa huấn luyện</th>
                      <th className="px-3 text-center min-w-[90px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Nhóm</th>
                      <th className="px-3 min-w-[200px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Thời gian huấn luyện</th>
                      <th className="px-3 text-center min-w-[110px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Điểm (LT/TH)</th>
                      <th className="px-3 text-center min-w-[110px] border-b border-lime-800 whitespace-nowrap h-[40px] align-middle">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredHvList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-16 text-center text-gray-400 italic">
                          Không tìm thấy bản ghi học viên nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredHvList.map((item, idx) => {
                        const kh = khoaHocList.find(k => k.id === item.id_khoa_hoc);
                        const isDat = String(item.ket_qua || '').trim().toLowerCase().normalize('NFC') === 'đạt' || String(item.ket_qua || '').trim().toLowerCase().normalize('NFC') === 'dat';

                        return (
                          <tr key={item.id} className="hover:bg-lime-50/20 transition-colors h-[35px]">
                            <td className="px-3 text-center text-gray-450 font-bold whitespace-nowrap h-[35px] align-middle">{idx + 1}</td>
                            <td className="px-3 font-mono font-bold text-gray-700 whitespace-nowrap h-[35px] align-middle">{item.msnv}</td>
                            <td className="px-3 font-bold text-lime-900 whitespace-nowrap h-[35px] align-middle">{item.ho_ten}</td>
                            <td className="px-3 text-gray-650 whitespace-nowrap h-[35px] align-middle">{donViMap[item.id_don_vi] || item.id_don_vi || '---'}</td>
                            <td className="px-3 font-semibold text-gray-700 whitespace-nowrap h-[35px] align-middle">{kh?.ten_khoa_hoc || '---'}</td>
                            <td className="px-3 text-center font-bold text-lime-800 whitespace-nowrap h-[35px] align-middle">{item.nhom ? `Nhóm ${item.nhom}` : '---'}</td>
                            <td className="px-3 text-gray-600 whitespace-nowrap h-[35px] align-middle">{item.thoi_gian_text || '---'}</td>
                            <td className="px-3 text-center font-semibold whitespace-nowrap h-[35px] align-middle">
                              {item.diem_ly_thuyet !== null ? item.diem_ly_thuyet : '-'} / {item.diem_thuc_hanh !== null ? item.diem_thuc_hanh : '-'}
                            </td>
                            <td className="px-3 text-center whitespace-nowrap h-[35px] align-middle">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-black ${isDat ? 'bg-lime-100 text-lime-850 border-lime-200' : 'bg-red-50 text-red-750 border-red-200'}`}>
                                {item.ket_qua || 'Chưa đạt'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MODAL THÊM / SỬA KHÓA HỌC */}
      {isEditModalOpen && currentKhoaHoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden">
            <form onSubmit={handleSaveKhoaHoc}>
              <div className="px-6 py-4 bg-gradient-to-r from-lime-50 to-emerald-50 border-b border-lime-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-lime-100 text-lime-700 rounded-lg">
                    <GraduationCap size={18} />
                  </div>
                  <h3 className="font-black text-gray-900 text-md uppercase">
                    {currentKhoaHoc.id ? 'Cập nhật khóa huấn luyện' : 'Tạo khóa huấn luyện mới'}
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-gray-600 uppercase">Tên khóa học <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={currentKhoaHoc.ten_khoa_hoc || ''}
                    onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, ten_khoa_hoc: e.target.value })}
                    placeholder="Ví dụ: Huấn luyện ATVSLĐ đợt 1 năm 2026"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-gray-600 uppercase">Đơn vị áp dụng khóa học</label>
                  <select
                    value={currentKhoaHoc.id_don_vi || ''}
                    onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, id_don_vi: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold text-gray-700 bg-white"
                    style={{ fontFamily: 'monospace, sans-serif' }}
                  >
                    <option value="">-- Áp dụng cho tất cả cơ sở --</option>
                    {buildHierarchicalOptions(donViList).map(({ unit, prefix }) => (
                      <option key={unit.id} value={unit.id} className="font-normal text-gray-700">
                        {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-gray-600 uppercase flex items-center justify-between">
                    <span>Đơn vị tổ chức / đào tạo</span>
                    <span className="text-[10px] text-lime-700 font-bold bg-lime-50 px-2 py-0.5 rounded border border-lime-200">Liên kết NCC</span>
                  </label>
                  <input
                    type="text"
                    list="training_ncc_datalist"
                    value={currentKhoaHoc.don_vi_dao_tao || ''}
                    onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, don_vi_dao_tao: e.target.value })}
                    placeholder="Chọn từ danh sách NCC (Đào tạo, Chứng nhận & Kiểm định) hoặc nhập mới..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                  />
                  <datalist id="training_ncc_datalist">
                    {trainingNccList.map(ncc => (
                      <option key={ncc.id} value={ncc.ten_cong_ty}>
                        {ncc.ten_cong_ty} ({ncc.nhom_dich_vu})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-gray-600 uppercase">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={currentKhoaHoc.ngay_bat_dau || ''}
                      onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, ngay_bat_dau: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-gray-600 uppercase">Ngày kết thúc</label>
                    <input
                      type="date"
                      value={currentKhoaHoc.ngay_ket_thuc || ''}
                      onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, ngay_ket_thuc: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-gray-600 uppercase">Địa điểm tổ chức</label>
                    <input
                      type="text"
                      value={currentKhoaHoc.dia_diem || ''}
                      onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, dia_diem: e.target.value })}
                      placeholder="Ví dụ: Phòng họp VPĐH"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-gray-600 uppercase">Sĩ số dự kiến</label>
                    <input
                      type="number"
                      value={currentKhoaHoc.si_so_du_kien || 0}
                      onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, si_so_du_kien: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-gray-600 uppercase">Trạng thái khóa học</label>
                  <select
                    value={currentKhoaHoc.trang_thai || 'Dự kiến'}
                    onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, trang_thai: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold text-gray-700 bg-white"
                  >
                    <option value="Dự kiến">Dự kiến</option>
                    <option value="Đang diễn ra">Đang diễn ra</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                  </select>
                </div>

                {currentKhoaHoc.trang_thai === 'Hoàn thành' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-black text-gray-600 uppercase">Hồ sơ hoàn thành khoá đào tạo</label>
                      <textarea
                        value={currentKhoaHoc.ho_so || ''}
                        onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, ho_so: e.target.value })}
                        placeholder='Ví dụ: Quyết định số 414/2025/QĐ-Tr.CĐ, ngày 25/05/2025 về việc công nhận kết quả huấn luyện...'
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold h-16 resize-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-black text-gray-600 uppercase">Link hồ sơ (Google Drive)</label>
                      <input
                        type="text"
                        value={currentKhoaHoc.link_ho_so || ''}
                        onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, link_ho_so: e.target.value })}
                        placeholder="Dán link Google Drive chia sẻ tài liệu tại đây..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-gray-600 uppercase">Ghi chú</label>
                  <textarea
                    value={currentKhoaHoc.ghi_chu || ''}
                    onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, ghi_chu: e.target.value })}
                    placeholder="Thông tin ghi chú thêm..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold h-20 resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-xs text-gray-700 hover:bg-gray-150 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-lime-600 hover:bg-lime-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL DÁN EXCEL HỌC VIÊN */}
      <PasteImportModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSave={handleSavePastedHocVien}
        title="Dán danh sách kết quả huấn luyện ATVSLĐ"
        columnMapping={columnMapping}
        onValidateRow={handleValidateRow}
      />

      {/* 🟢 CUSTOM CONFIRM MODAL */}
      {confirmType !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-550 flex items-center justify-center mx-auto mb-4 border-4 border-red-100"><AlertTriangle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {confirmType === 'KHOA_HOC' ? 'Xóa khóa học?' : 'Xóa học viên?'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {confirmType === 'KHOA_HOC'
                ? 'Bạn có chắc chắn muốn xóa khóa huấn luyện này? Tất cả học viên và kết quả thuộc khóa sẽ bị xóa vĩnh viễn.'
                : 'Bạn có chắc chắn muốn xóa học viên này khỏi danh sách khóa huấn luyện?'}
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
        </div>
      )}
    </div>
  );
}
