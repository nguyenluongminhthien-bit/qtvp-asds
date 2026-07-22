import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, Plus, Search, Edit2, Trash2, Calendar, MapPin, 
  Users, CheckCircle2, ChevronLeft, ClipboardPaste, RefreshCw, AlertTriangle, 
  ExternalLink, CheckCircle, Info, BookOpen, UserCheck
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { useAuth } from '../../contexts/AuthContext';
import { DonVi, Personnel, KhoaHuanLuyen, HocVienKhoaHuanLuyen, ChuKyATVSLD } from '../../types';
import PasteImportModal, { ColumnMapItem } from '../ui/PasteImportModal';
import { getChungNhanByNhom, calcGiaTriDen } from '../../utils/atvsld';

interface KhoaHocTabProps {
  onReloadData?: () => void;
}

export default function KhoaHocTab({ onReloadData }: KhoaHocTabProps) {
  const { user } = useAuth();
  
  // States tải dữ liệu
  const [khoaHocList, setKhoaHocList] = useState<KhoaHuanLuyen[]>([]);
  const [hocVienList, setHocVienList] = useState<HocVienKhoaHuanLuyen[]>([]);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [chuKyList, setChuKyList] = useState<ChuKyATVSLD[]>([]);
  const [loading, setLoading] = useState(true);

  // States quản lý màn hình & bộ lọc
  const [selectedKhoaHoc, setSelectedKhoaHoc] = useState<KhoaHuanLuyen | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hvSearchTerm, setHvSearchTerm] = useState('');
  
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
      const [khData, hvData, nsData, dvData, ckData] = await Promise.all([
        apiService.getKhoaHuanLuyen ? apiService.getKhoaHuanLuyen().catch(() => []) : Promise.resolve([]),
        apiService.getHocVienKhoaHuanLuyen ? apiService.getHocVienKhoaHuanLuyen().catch(() => []) : Promise.resolve([]),
        apiService.getPersonnel(),
        apiService.getDonVi(),
        apiService.getChuKyATVSLD ? apiService.getChuKyATVSLD().catch(() => []) : Promise.resolve([])
      ]);
      setKhoaHocList(khData || []);
      setHocVienList(hvData || []);
      setPersonnelList(nsData || []);
      setDonViList(dvData || []);
      setChuKyList(ckData || []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(d => { map[d.id] = d.ten_don_vi; });
    return map;
  }, [donViList]);

  // Bộ lọc danh sách khóa học
  const filteredKhoaHoc = useMemo(() => {
    return khoaHocList.filter(kh => {
      const search = searchTerm.toLowerCase();
      return (
        kh.ten_khoa_hoc.toLowerCase().includes(search) ||
        (kh.don_vi_dao_tao || '').toLowerCase().includes(search) ||
        (kh.dia_diem || '').toLowerCase().includes(search)
      );
    });
  }, [khoaHocList, searchTerm]);

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

  // Thống kê đầu Tab
  const stats = useMemo(() => {
    const totalKh = khoaHocList.length;
    const totalHv = hocVienList.length;
    let datCount = 0;
    let failCount = 0;
    
    hocVienList.forEach(hv => {
      const kq = String(hv.ket_qua || '').trim().toLowerCase();
      if (kq.includes('đạt') || kq.includes('dat')) {
        datCount++;
      } else if (kq) {
        failCount++;
      }
    });

    const percentDat = totalHv > 0 ? Math.round((datCount / totalHv) * 100) : 0;
    return { totalKh, totalHv, datCount, failCount, percentDat };
  }, [khoaHocList, hocVienList]);

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
      ghi_chu: ''
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
    } catch (err) {
      toast.error('Lỗi lưu thông tin khóa học.');
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
        await apiService.delete(deleteTargetId, 'hs_khoa_huan_luyen');
        setKhoaHocList(prev => prev.filter(item => item.id !== deleteTargetId));
        setHocVienList(prev => prev.filter(item => item.id_khoa_hoc !== deleteTargetId));
        if (selectedKhoaHoc?.id === deleteTargetId) {
          setSelectedKhoaHoc(null);
        }
        toast.success('Đã xóa khóa học thành công!');
        onReloadData?.();
      } else if (confirmType === 'HOC_VIEN') {
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
  const handleValidateRow = (row: any) => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const msnv = String(row.msnv || '').trim();
    if (msnv) {
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
        personnelMap.set(p.ma_so_nhan_vien, p);
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
          id_don_vi: systemPerson?.id_don_vi || null,
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

    } catch (err) {
      toast.error('Lỗi khi nhập danh sách học viên.');
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

  // Logic đồng bộ ngược nền Batch song song (PHẦN D.2)
  const triggerBackgroundSync = async (hvToSync: any[]) => {
    // 1. Chỉ lọc học viên "Đạt", có msnv khớp nhân sự hệ thống và chưa đồng bộ
    const personnelMap = new Map<string, Personnel>();
    personnelList.forEach(p => personnelMap.set(p.ma_so_nhan_vien, p));

    const pendingSync = hvToSync.filter(hv => {
      const isDat = String(hv.ket_qua || '').trim().toLowerCase().includes('đạt') || String(hv.ket_qua || '').trim().toLowerCase().includes('dat');
      const hasSystemPerson = personnelMap.has(hv.msnv);
      return isDat && hasSystemPerson && !hv.da_dong_bo_nhan_su;
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
          const person = personnelMap.get(hv.msnv)!;
          
          // Regex trích xuất số nhóm '1'..'6' từ chuỗi nhom
          const nhomDigits = String(hv.nhom || '').replace(/\D/g, '');
          const nhom = nhomDigits || '3'; // mặc định nhóm 3 nếu thiếu

          // Xác định ngày huấn luyện
          const huanLuyenDen = extractHuanLuyenDen(hv.thoi_gian_text, selectedKhoaHoc?.ngay_ket_thuc || new Date().toISOString().slice(0, 10));
          const giaTriDen = calcGiaTriDen(huanLuyenDen, nhom, chuKyList);
          const chungNhan = getChungNhanByNhom(nhom);

          // Cập nhật thông tin Personnel
          const updatedPerson = {
            ...person,
            cc_atvsld: true,
            nhom_doi_tuong: nhom,
            huan_luyen_tu: selectedKhoaHoc?.ngay_bat_dau || null,
            huan_luyen_den: huanLuyenDen,
            gia_tri_den: giaTriDen,
            chung_nhan: chungNhan
          };

          // Lưu Personnel
          await apiService.save(updatedPerson, 'update', 'ns_dich_vu');

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
    <div className="flex-1 flex flex-col gap-6 w-full">
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

      {/* 2. KHU VỰC NỘI DUNG CHÍNH */}
      {!selectedKhoaHoc ? (
        // ==========================================
        // VIEW DANH SÁCH KHÓA HỌC
        // ==========================================
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
            {user?.quyen === 'ADMIN' && (
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
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Tên khóa huấn luyện</th>
                  <th className="p-3">Đơn vị đào tạo</th>
                  <th className="p-3 text-center">Thời gian</th>
                  <th className="p-3">Địa điểm</th>
                  <th className="p-3 text-center">Sĩ số (Dự kiến/Thực tế)</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center w-36">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredKhoaHoc.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center text-gray-400 italic">
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
                      <td className="p-3 text-gray-650">{kh.dia_diem || '---'}</td>
                      <td className="p-3 text-center font-semibold text-gray-700">
                        {kh.si_so_du_kien || 0} / <span className="text-lime-700 font-bold">{kh.si_so_thuc_te || 0}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block min-w-[70px] ${
                            kh.trang_thai === 'Hoàn thành'
                              ? 'bg-lime-100 text-lime-800 border-lime-200'
                              : kh.trang_thai === 'Đang diễn ra'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          }`}
                        >
                          {kh.trang_thai}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedKhoaHoc(kh)}
                            className="px-2 py-1 text-xs font-bold text-lime-700 hover:bg-lime-50 border border-lime-250 rounded-lg transition-colors cursor-pointer"
                          >
                            Học viên
                          </button>
                          {user?.quyen === 'ADMIN' && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(kh)}
                                className="p-1 hover:bg-gray-100 text-gray-500 hover:text-lime-750 rounded-lg cursor-pointer"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteKhoaHoc(kh.id)}
                                className="p-1 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg cursor-pointer"
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
        // ==========================================
        // VIEW CHI TIẾT HỌC VIÊN CỦA KHÓA HỌC
        // ==========================================
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

            {user?.quyen === 'ADMIN' && (
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
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
                <thead className="bg-gray-50 border-b border-lime-100 font-bold text-gray-600 uppercase">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 w-24">Mã NV</th>
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">Nhân sự Đơn vị (Excel / Thực tế)</th>
                    <th className="p-3">Chức vụ</th>
                    <th className="p-3 text-center">Nhóm</th>
                    <th className="p-3">Nội dung / Thời gian</th>
                    <th className="p-3 text-center">Điểm (LT / TH)</th>
                    <th className="p-3 text-center">Kết quả</th>
                    <th className="p-3 text-center w-24">Đồng bộ</th>
                    {user?.quyen === 'ADMIN' && <th className="p-3 text-center w-16">Xóa</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredHocVien.length === 0 ? (
                    <tr>
                      <td colSpan={user?.quyen === 'ADMIN' ? 11 : 10} className="p-16 text-center text-gray-400 italic">
                        Chưa có dữ liệu học viên trong khóa học này. Bấm nút "Dán Excel Học viên" để nhập danh sách.
                      </td>
                    </tr>
                  ) : (
                    filteredHocVien.map((hv, idx) => {
                      const isDat = String(hv.ket_qua || '').trim().toLowerCase().includes('đạt') || String(hv.ket_qua || '').trim().toLowerCase().includes('dat');
                      return (
                        <tr key={hv.id} className="hover:bg-lime-50/20 transition-colors">
                          <td className="p-3 text-center text-gray-400 font-semibold">{hv.stt || (idx + 1)}</td>
                          <td className="p-3 font-bold text-gray-700">{hv.msnv}</td>
                          <td className="p-3 font-bold text-lime-800">{hv.ho_ten}</td>
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
                              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black inline-block ${
                                isDat
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
                          {user?.quyen === 'ADMIN' && (
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
                  <label className="text-xs font-black text-gray-600 uppercase">Đơn vị tổ chức / đào tạo</label>
                  <input
                    type="text"
                    value={currentKhoaHoc.don_vi_dao_tao || ''}
                    onChange={e => setCurrentKhoaHoc({ ...currentKhoaHoc, don_vi_dao_tao: e.target.value })}
                    placeholder="Ví dụ: Trung tâm Đào tạo An toàn lao động"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-lime-500 text-sm font-semibold"
                  />
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
