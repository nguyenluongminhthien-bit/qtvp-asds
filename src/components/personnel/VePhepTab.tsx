import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plane, Search, Plus, Edit, Trash2, FileSpreadsheet, Download, RefreshCw,
  AlertTriangle, CheckCheck, Filter, ChevronLeft, ChevronRight, ArrowUpDown,
  Building2, User, DollarSign, Calendar, Eye, Layers, ArrowRightLeft, Sparkles, AlertCircle,
  ClipboardPaste, X
} from 'lucide-react';
import { Personnel, DonVi, NhaCungCap, VeMayBay } from '../../types';
import { apiService } from '../../services/api';
import { formatCurrencySpace, formatCurrencySpace as formatCurrency, toUnaccented } from '../../utils/formatters';
import { toast } from '../../utils/toast';
import Pagination from '../ui/Pagination';
import VeMayBayModal from './VeMayBayModal';
import VePhepDoiChieuModal from './VePhepDoiChieuModal';

interface Props {
  personnel: Personnel[];
  donViList: DonVi[];
  phapNhanList?: any[];
  allowedDonViIds: string[];
  selectedUnitFilter: string | null;
  selectedUnitSubordinates: string[];
  activeSubTab: 'TONG_HOP' | 'SO_THEO_DOI' | 'DOI_CHIEU_NCC';
  onSubTabChange: (tab: 'TONG_HOP' | 'SO_THEO_DOI' | 'DOI_CHIEU_NCC') => void;
  onEditPersonnel?: (person: Personnel) => void;
}

export default function VePhepTab({
  personnel,
  donViList,
  phapNhanList = [],
  allowedDonViIds,
  selectedUnitFilter,
  selectedUnitSubordinates,
  activeSubTab,
  onSubTabChange,
  onEditPersonnel
}: Props) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // State dữ liệu vé & nhà cung cấp
  const [veList, setVeList] = useState<VeMayBay[]>([]);
  const [nccList, setNccList] = useState<NhaCungCap[]>([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedAirline, setSelectedAirline] = useState<string>('ALL');
  const [selectedNcc, setSelectedNcc] = useState<string>('ALL');
  const [selectedReconcileStatus, setSelectedReconcileStatus] = useState<string>('ALL');

  // Phân trang sổ theo dõi vé
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal thêm/sửa vé
  const [ticketModal, setTicketModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    data?: VeMayBay | null;
  }>({ isOpen: false, mode: 'create', data: null });

  // Modal đối chiếu bảng kê NCC
  const [isDoiChieuModalOpen, setIsDoiChieuModalOpen] = useState(false);

  // Modal xóa vé
  const [ticketToDelete, setTicketToDelete] = useState<VeMayBay | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal xem chi tiết vé theo nhân sự trong ma trận tổng hợp
  const [viewStaffHistory, setViewStaffHistory] = useState<{
    staff: Personnel;
    tickets: VeMayBay[];
  } | null>(null);

  // Tải dữ liệu ban đầu
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const [tickets, suppliers] = await Promise.all([
        apiService.getVeMayBay ? apiService.getVeMayBay(forceRefresh).catch((e) => {
          console.warn('Lưu ý: Bảng ns_ve_may_bay chưa sẵn sàng hoặc đang reload schema:', e);
          return [];
        }) : Promise.resolve([]),
        apiService.getNhaCungCap(forceRefresh).catch(() => [])
      ]);
      setVeList(tickets || []);
      setNccList(suppliers || []);
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu vé về phép:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Đơn vị Map
  const donViMap = useMemo(() => {
    const map: Record<string, string> = {};
    donViList.forEach(d => {
      map[String(d.id)] = d.ten_don_vi || d.id;
    });
    return map;
  }, [donViList]);

  // Lọc danh sách nhân sự hưởng chính sách về phép (trong phạm vi đơn vị đang chọn)
  const eligiblePersonnel = useMemo(() => {
    return personnel.filter(p => {
      if (!p.huong_chinh_sach_ve_phep) return false;
      if (p.trang_thai === 'Đã nghỉ việc') return false;

      // Lọc theo cây đơn vị
      if (selectedUnitFilter) {
        const uId = String(p.id_don_vi || '').trim();
        const allowed = [selectedUnitFilter, ...selectedUnitSubordinates];
        if (!allowed.includes(uId)) return false;
      }
      return true;
    });
  }, [personnel, selectedUnitFilter, selectedUnitSubordinates]);

  // Lọc vé theo năm và phạm vi đơn vị
  const scopedTickets = useMemo(() => {
    return veList.filter(v => {
      if (Number(v.nam) !== Number(selectedYear)) return false;
      if (selectedUnitFilter) {
        const uId = String(v.id_don_vi || '').trim();
        const allowed = [selectedUnitFilter, ...selectedUnitSubordinates];
        if (uId && !allowed.includes(uId)) return false;
      }
      return true;
    });
  }, [veList, selectedYear, selectedUnitFilter, selectedUnitSubordinates]);

  // Dữ liệu ma trận tổng hợp theo nhân sự
  const matrixSummary = useMemo(() => {
    return eligiblePersonnel.map(person => {
      const staffTickets = scopedTickets.filter(v => 
        (v.id_nhan_su && v.id_nhan_su === person.id) ||
        (v.ma_so_nhan_vien && String(v.ma_so_nhan_vien).trim().toLowerCase() === String(person.ma_so_nhan_vien).trim().toLowerCase())
      );

      // Đếm số lần theo từng tháng 1 - 12
      const monthCounts: Record<number, number> = {};
      const monthTickets: Record<number, VeMayBay[]> = {};
      for (let m = 1; m <= 12; m++) {
        monthCounts[m] = 0;
        monthTickets[m] = [];
      }

      let totalTrips = 0;
      let totalCompanyCost = 0;
      let latestDate = '';

      staffTickets.forEach(t => {
        const m = Number(t.thang);
        if (m >= 1 && m <= 12) {
          monthCounts[m] = (monthCounts[m] || 0) + 1;
          monthTickets[m].push(t);
        }
        totalTrips += 1;
        totalCompanyCost += Number(t.cty_thanh_toan || t.tong_tien || 0);

        const d = t.ngay_di || '';
        if (d && (!latestDate || d > latestDate)) {
          latestDate = d;
        }
      });

      const quota = Number(person.dinh_muc_ve_phep_nam) || 12;
      const remaining = quota - totalTrips;

      let status: 'NORMAL' | 'WARNING' | 'EXCEEDED' = 'NORMAL';
      if (remaining < 0) status = 'EXCEEDED';
      else if (remaining <= 2) status = 'WARNING';

      return {
        person,
        quota,
        monthCounts,
        monthTickets,
        totalTrips,
        remaining,
        status,
        totalCompanyCost,
        latestDate,
        tickets: staffTickets
      };
    }).filter(row => {
      if (!searchTerm.trim()) return true;
      const kw = searchTerm.toLowerCase();
      return (
        row.person.ho_ten.toLowerCase().includes(kw) ||
        row.person.ma_so_nhan_vien.toLowerCase().includes(kw) ||
        String(row.person.chuc_vu || '').toLowerCase().includes(kw)
      );
    });
  }, [eligiblePersonnel, scopedTickets, searchTerm]);

  // Thống kê nhanh tổng quan
  const overviewStats = useMemo(() => {
    const totalStaff = eligiblePersonnel.length;
    const totalTrips = scopedTickets.length;
    const totalCost = scopedTickets.reduce((acc, t) => acc + Number(t.cty_thanh_toan || t.tong_tien || 0), 0);
    const exceededCount = matrixSummary.filter(m => m.remaining < 0).length;
    return { totalStaff, totalTrips, totalCost, exceededCount };
  }, [eligiblePersonnel, scopedTickets, matrixSummary]);

  // Helper định dạng ngày gần nhất thành dd/mm/yy
  const formatDateShortYY = (val: string | undefined | null): string => {
    if (!val) return '---';
    const s = String(val).trim();
    const match = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match) {
      const dd = match[3].padStart(2, '0');
      const mm = match[2].padStart(2, '0');
      const yy = match[1].slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
    const matchVN = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (matchVN) {
      const dd = matchVN[1].padStart(2, '0');
      const mm = matchVN[2].padStart(2, '0');
      const yy = matchVN[3].slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
    return s || '---';
  };

  // Danh sách NCC trong bộ lọc: chỉ lấy NCC thuộc nhóm Vé máy bay hoặc đã từng được chọn trong các vé
  const availableNccFilterList = useMemo(() => {
    const usedNccIds = new Set<string>();
    const usedNccNames = new Set<string>();
    veList.forEach(v => {
      if (v.id_ncc) usedNccIds.add(String(v.id_ncc).trim());
      if (v.ten_ncc) usedNccNames.add(String(v.ten_ncc).trim().toLowerCase());
    });

    return nccList.filter(ncc => {
      const nhom = toUnaccented(ncc.nhom_dich_vu || '');
      const isFlight = nhom.includes('ve may bay') || nhom.includes('hang khong');
      const isUsed = usedNccIds.has(String(ncc.id)) ||
                     usedNccNames.has(String(ncc.ten_goi_tat || '').toLowerCase()) ||
                     usedNccNames.has(String(ncc.ten_cong_ty || '').toLowerCase());
      return isFlight || isUsed;
    });
  }, [nccList, veList]);

  // Lọc danh sách vé cho Sub-tab Sổ theo dõi vé
  const filteredTickets = useMemo(() => {
    return scopedTickets.filter(ticket => {
      // Lọc tháng
      if (selectedMonth !== 'ALL' && Number(ticket.thang) !== Number(selectedMonth)) {
        return false;
      }
      // Lọc hãng
      if (selectedAirline !== 'ALL' && ticket.hang_van_chuyen !== selectedAirline) {
        return false;
      }
      // Lọc NCC
      if (selectedNcc !== 'ALL' && ticket.id_ncc !== selectedNcc && ticket.ten_ncc !== selectedNcc) {
        return false;
      }
      // Lọc trạng thái đối chiếu
      if (selectedReconcileStatus !== 'ALL') {
        if (selectedReconcileStatus === 'CHUA_DOI_CHIEU' && ticket.trang_thai_doi_chieu !== 'Chưa đối chiếu') return false;
        if (selectedReconcileStatus === 'KHOP' && ticket.trang_thai_doi_chieu !== 'Khớp') return false;
        if (selectedReconcileStatus === 'LECH' && ticket.trang_thai_doi_chieu !== 'Lệch tiền') return false;
      }
      // Lọc từ khóa
      if (searchTerm.trim()) {
        const kw = searchTerm.toLowerCase();
        return (
          ticket.ho_ten.toLowerCase().includes(kw) ||
          ticket.ma_so_nhan_vien.toLowerCase().includes(kw) ||
          String(ticket.code_ve_di || '').toLowerCase().includes(kw) ||
          String(ticket.code_ve_ve || '').toLowerCase().includes(kw) ||
          String(ticket.chuyen_bay_di || '').toLowerCase().includes(kw) ||
          String(ticket.ten_ncc || '').toLowerCase().includes(kw)
        );
      }
      return true;
    }).sort((a, b) => {
      const dateA = a.ngay_di || '';
      const dateB = b.ngay_di || '';
      return dateB.localeCompare(dateA);
    });
  }, [scopedTickets, selectedMonth, selectedAirline, selectedNcc, selectedReconcileStatus, searchTerm]);

  // Phân trang vé
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  // Xử lý lưu vé (Thêm mới / Cập nhật)
  const handleSaveTicket = async (ticketData: Partial<VeMayBay>) => {
    if (ticketModal.mode === 'create') {
      const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
      const newRecord: any = {
        ...ticketData,
        id: newId
      };
      delete newRecord.ID;
      const saved = await apiService.save(newRecord, 'create', 'ns_ve_may_bay');
      const itemToInsert = (saved && saved.id) ? saved : { ...newRecord, id: newId };
      setVeList(prev => [itemToInsert as VeMayBay, ...prev]);
      toast.success('Đã thêm vé về phép mới thành công!');
    } else if (ticketModal.mode === 'edit' && ticketModal.data) {
      const updated = {
        ...ticketModal.data,
        ...ticketData,
        id: ticketModal.data.id
      };
      await apiService.save(updated, 'update', 'ns_ve_may_bay');
      setVeList(prev => prev.map(t => t.id === updated.id ? (updated as VeMayBay) : t));
      toast.success('Đã cập nhật thông tin vé thành công!');
    }
  };

  // Xử lý xóa vé
  const handleConfirmDeleteTicket = async () => {
    if (!ticketToDelete) return;
    setIsDeleting(true);
    try {
      await apiService.delete(ticketToDelete.id, 'ns_ve_may_bay', ticketToDelete);
      setVeList(prev => prev.filter(t => t.id !== ticketToDelete.id));
      toast.success('Đã xóa vé thành công!');
      setTicketToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa vé!');
    } finally {
      setIsDeleting(false);
    }
  };

  // Xử lý áp dụng kết quả đối chiếu
  const handleApplyReconciliation = async (updates: { id: string; trang_thai_doi_chieu: string; tien_ncc_ke: number; ghi_chu_doi_chieu: string }[]) => {
    for (const item of updates) {
      const existing = veList.find(v => v.id === item.id);
      if (existing) {
        const merged = { ...existing, ...item };
        await apiService.save(merged, 'update', 'ns_ve_may_bay');
      }
    }
    await loadData(true);
  };

  // Xuất file Excel sổ theo dõi vé
  const handleExportExcel = () => {
    if (filteredTickets.length === 0) {
      toast.warning('Không có dữ liệu vé để xuất file!');
      return;
    }

    let rowsHTML = '';
    filteredTickets.forEach((t, idx) => {
      rowsHTML += `<tr>
        <td class="center">${idx + 1}</td>
        <td class="center">${t.thang}/${t.nam}</td>
        <td class="center">${t.lan_ve_phep || 1}</td>
        <td>${t.ma_so_nhan_vien}</td>
        <td>${t.ho_ten}</td>
        <td>${donViMap[t.id_don_vi || ''] || ''}</td>
        <td>${t.loai_phuong_tien || 'Vé máy bay'}</td>
        <td>${t.hang_van_chuyen || ''}</td>
        <td>${t.ten_ncc || ''}</td>
        <td class="center">${t.code_ve_di || ''}</td>
        <td class="center">${t.chuyen_bay_di || ''}</td>
        <td class="center">${t.ngay_di || ''}</td>
        <td>${t.chang_di || ''}</td>
        <td class="right">${Number(t.gia_ve_di || 0).toLocaleString('vi-VN')}</td>
        <td class="center">${t.code_ve_ve || ''}</td>
        <td class="center">${t.chuyen_bay_ve || ''}</td>
        <td class="center">${t.ngay_ve || ''}</td>
        <td>${t.chang_ve || ''}</td>
        <td class="right">${Number(t.gia_ve_ve || 0).toLocaleString('vi-VN')}</td>
        <td class="right">${Number(t.phi_doi_ve || 0).toLocaleString('vi-VN')}</td>
        <td class="right">${Number(t.phi_hanh_ly || 0).toLocaleString('vi-VN')}</td>
        <td class="right">${Number(t.nv_tu_tra || 0).toLocaleString('vi-VN')}</td>
        <td class="right font-bold">${Number(t.cty_thanh_toan || t.tong_tien || 0).toLocaleString('vi-VN')}</td>
        <td class="center">${t.trang_thai_doi_chieu || 'Chưa đối chiếu'}</td>
        <td>${t.ghi_chu || ''}</td>
      </tr>`;
    });

    const tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 11pt; }
        th, td { border: 1px solid #000000; padding: 6px; vertical-align: middle; }
        .header { background-color: #05469b; color: #ffffff; font-weight: bold; text-align: center; }
        .center { text-align: center; }
        .right { text-align: right; }
        .font-bold { font-weight: bold; }
      </style></head>
      <body>
        <table>
          <thead>
            <tr class="header">
              <th>STT</th><th>Kỳ (T/N)</th><th>Lần</th><th>Mã NV</th><th>Họ tên</th><th>Đơn vị</th>
              <th>Loại PT</th><th>Hãng</th><th>Nhà cung cấp</th>
              <th>Code vé đi</th><th>Chuyến bay đi</th><th>Ngày đi</th><th>Chặng đi</th><th>Giá vé đi</th>
              <th>Code vé về</th><th>Chuyến bay về</th><th>Ngày về</th><th>Chặng về</th><th>Giá vé về</th>
              <th>Phí đổi vé</th><th>Phí hành lý</th><th>NV tự trả</th><th>Cty chi trả</th>
              <th>Đối chiếu NCC</th><th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </body></html>`;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `So_Theo_Doi_Ve_May_Bay_${selectedYear}_Thang_${selectedMonth}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file Excel sổ theo dõi vé thành công!');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* 🟢 THANH CÔNG CỤ TÁC VỤ TRÊN CÙNG */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        {/* Tiêu đề phân hệ con hiện tại */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-[#05469B] rounded-lg">
            {activeSubTab === 'TONG_HOP' && <Layers size={18} />}
            {activeSubTab === 'SO_THEO_DOI' && <Plane size={18} />}
            {activeSubTab === 'DOI_CHIEU_NCC' && <ArrowRightLeft size={18} />}
          </div>
          <div>
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              {activeSubTab === 'TONG_HOP' && `1. Tổng hợp & Định mức (${matrixSummary.length} nhân sự)`}
              {activeSubTab === 'SO_THEO_DOI' && `2. Sổ theo dõi vé (${filteredTickets.length} vé)`}
              {activeSubTab === 'DOI_CHIEU_NCC' && '3. Đối chiếu công nợ Nhà cung cấp'}
            </h3>
          </div>
        </div>

        {/* Nút tác vụ nhanh */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Chọn năm */}
          <div className="flex items-center gap-1 bg-[#FFFFF0] border border-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-700">
            <Calendar size={13} className="text-[#05469B]" />
            <span>Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none font-black text-[#05469B] cursor-pointer"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            title="Làm mới dữ liệu từ Supabase"
            className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-[#05469B]' : ''} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDoiChieuModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowRightLeft size={14} className="text-indigo-600" />
            <span>Dán Bảng Kê Đối Chiếu</span>
          </button>
        </div>
      </div>

      {/* 🟢 CARD THỐNG KÊ TỔNG QUAN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#05469B] flex items-center justify-center font-bold shrink-0">
            <User size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nhân sự hưởng chính sách</span>
            <span className="text-xl font-black text-gray-900">{overviewStats.totalStaff}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold shrink-0">
            <Plane size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tổng lượt vé {selectedYear}</span>
            <span className="text-xl font-black text-sky-900">{overviewStats.totalTrips}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Công ty đã chi trả</span>
            <span className="text-lg font-black text-emerald-800">{(formatCurrency(overviewStats.totalCost) || '0')} đ</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${overviewStats.exceededCount > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cảnh báo vượt hạn mức</span>
            <span className={`text-xl font-black ${overviewStats.exceededCount > 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {overviewStats.exceededCount} người
            </span>
          </div>
        </div>
      </div>

      {/* 🟢 SUB-TAB 1: MA TRẬN TỔNG HỢP & THEO DÕI ĐỊNH MỨC 12 THÁNG */}
      {activeSubTab === 'TONG_HOP' && (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Header & Tìm kiếm */}
          <div className="p-3 border-b border-gray-100 bg-[#f8fafc] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-xs font-black text-[#05469B] uppercase flex items-center gap-1.5">
                <Layers size={14} /> Ma trận theo dõi số lần về phép 12 tháng (Năm {selectedYear})
              </h3>
              <p className="text-[10px] text-gray-500">
                Hiển thị số lần về phép của CBNV. Bấm vào <strong>Tên nhân sự</strong> để xem toàn bộ lịch sử vé hoặc số lần từng tháng để xem chi tiết.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã NV, họ tên, chức vụ..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#05469B]"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full min-w-[1200px] border-collapse text-[11.5px] text-left">
              <thead className="bg-[#e8f0fe] sticky top-0 z-10 text-gray-800 font-extrabold border-b border-gray-200 text-center">
                <tr>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-10" rowSpan={2}>STT</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 w-56 text-left" rowSpan={2}>Họ và Tên / Đơn vị</th>
                  <th className="py-1 px-1 border-r border-gray-200 w-16 text-center leading-tight whitespace-nowrap" rowSpan={2}>
                    <div>Hạn mức</div>
                    <div className="text-[10px] text-gray-500 font-bold">(Lần)</div>
                  </th>
                  <th className="py-1 px-2 border-b border-gray-200 bg-blue-100/60" colSpan={12}>
                    Các tháng trong năm {selectedYear}
                  </th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-20 bg-emerald-100/40 text-emerald-900" rowSpan={2}>Tổng lần</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-20" rowSpan={2}>Còn lại</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 w-28 text-right bg-blue-100/30" rowSpan={2}>Cty chi trả</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-24" rowSpan={2}>Gần nhất</th>
                  <th className="py-2.5 px-2 w-14 text-center" rowSpan={2}>Thêm</th>
                </tr>
                <tr className="bg-blue-50/70 text-[10.5px]">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <th key={m} className={`py-1 px-1 border-r border-gray-200 w-9 ${m === currentMonth ? 'bg-amber-100 text-amber-900 font-black' : ''}`}>
                      T{m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matrixSummary.length > 0 ? (
                  matrixSummary.map((row, idx) => (
                    <tr key={row.person.id || idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-2 text-center text-gray-400 border-r border-gray-100">{idx + 1}</td>
                      <td className="p-2 border-r border-gray-100">
                        <button
                          type="button"
                          onClick={() => setViewStaffHistory({ staff: row.person, tickets: row.tickets })}
                          className="font-extrabold text-[#05469B] hover:text-[#04367a] hover:underline text-left leading-tight cursor-pointer inline-flex items-center gap-1 group"
                          title="Bấm vào đây để xem chi tiết lịch sử vé của nhân sự này"
                        >
                          <span>{row.person.ho_ten}</span>
                          <Eye size={12} className="text-blue-500 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all shrink-0" />
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                          <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1 py-0.2 rounded">
                            {row.person.ma_so_nhan_vien}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[140px]">{row.person.chuc_vu || '---'}</span>
                        </div>
                      </td>
                      <td className="p-1 text-center font-black text-gray-800 border-r border-gray-100 bg-gray-50/50">
                        <span className="text-xs font-black">{row.quota}</span>
                        {(row.person.ngach_luong || row.person.ngach_ve_phep) && (
                          <span className="block text-[9px] text-[#05469B] font-bold bg-blue-50 px-1 py-0.5 rounded border border-blue-200 mt-0.5 truncate max-w-[54px] mx-auto" title={`Ngạch lương: ${row.person.ngach_luong || row.person.ngach_ve_phep}`}>
                            {row.person.ngach_luong || row.person.ngach_ve_phep}
                          </span>
                        )}
                      </td>

                      {/* 12 Tháng */}
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const count = row.monthCounts[m] || 0;
                        return (
                          <td
                            key={m}
                            className={`p-1 text-center border-r border-gray-100 ${
                              m === currentMonth ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {count > 0 ? (
                              <button
                                type="button"
                                onClick={() => setViewStaffHistory({ staff: row.person, tickets: row.monthTickets[m] })}
                                className="w-6 h-6 rounded-md bg-[#05469B] text-white font-extrabold text-[11px] inline-flex items-center justify-center shadow-2xs hover:bg-[#04367a] transition-transform active:scale-90 cursor-pointer"
                                title={`Xem ${count} vé tháng ${m}`}
                              >
                                {count}
                              </button>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Tổng lần */}
                      <td className="p-2 text-center font-black text-emerald-800 border-r border-gray-100 bg-emerald-50/30">
                        {row.totalTrips}
                      </td>

                      {/* Số lần còn lại */}
                      <td className="p-2 text-center font-black border-r border-gray-100">
                        {row.remaining < 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700">
                            Vượt {Math.abs(row.remaining)}
                          </span>
                        ) : row.remaining <= 2 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800">
                            Còn {row.remaining}
                          </span>
                        ) : (
                          <span className="text-gray-700">Còn {row.remaining}</span>
                        )}
                      </td>

                      {/* Cty chi trả */}
                      <td className="p-2 text-right font-bold text-gray-800 border-r border-gray-100 bg-blue-50/20">
                        {(formatCurrency(row.totalCompanyCost) || '0')} đ
                      </td>

                      {/* Ngày gần nhất */}
                      <td className="p-2 text-center text-[10px] text-gray-600 border-r border-gray-100">
                        {formatDateShortYY(row.latestDate)}
                      </td>

                      {/* Cột Thêm: Chỉ icon Thêm mới vé */}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setTicketModal({
                            isOpen: true,
                            mode: 'create',
                            data: {
                              id_nhan_su: row.person.id,
                              ma_so_nhan_vien: row.person.ma_so_nhan_vien,
                              ho_ten: row.person.ho_ten,
                              id_don_vi: row.person.id_don_vi,
                              loai_phuong_tien: row.person.hinh_thuc_ve_phep || 'Vé máy bay',
                              chang_di: row.person.tuyen_ve_phep || 'SGN - HAN',
                              lan_ve_phep: row.totalTrips + 1
                            } as any
                          })}
                          className="p-1.5 rounded-lg bg-blue-50 text-[#05469B] hover:bg-[#05469B] hover:text-white transition-all shadow-2xs hover:shadow-xs cursor-pointer inline-flex items-center justify-center"
                          title={`Thêm vé về phép mới cho ${row.person.ho_ten}`}
                        >
                          <Plus size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={19} className="p-8 text-center text-gray-400 italic">
                      {loading ? 'Đang tải dữ liệu ma trận về phép...' : 'Không có nhân sự nào thỏa mãn điều kiện lọc.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🟢 SUB-TAB 2: SỔ THEO DÕI VÉ MÁY BAY / TÀU HỎA CHI TIẾT */}
      {activeSubTab === 'SO_THEO_DOI' && (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Thanh lọc & tìm kiếm */}
          <div className="p-3 border-b border-gray-100 bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Lọc tháng */}
              <select
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
                className="p-1.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
              >
                <option value="ALL">-- Tất cả các tháng --</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>

              {/* Lọc Hãng bay */}
              <select
                value={selectedAirline}
                onChange={(e) => { setSelectedAirline(e.target.value); setCurrentPage(1); }}
                className="p-1.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
              >
                <option value="ALL">-- Tất cả hãng bay --</option>
                <option value="Vietjet Air">Vietjet Air (VJ)</option>
                <option value="Vietnam Airlines">Vietnam Airlines (VNA)</option>
                <option value="Bamboo Airways">Bamboo Airways (QH)</option>
                <option value="Vietravel Airlines">Vietravel Airlines (VU)</option>
                <option value="Đường sắt Việt Nam">Đường sắt Việt Nam</option>
              </select>

              {/* Lọc NCC */}
              <select
                value={selectedNcc}
                onChange={(e) => { setSelectedNcc(e.target.value); setCurrentPage(1); }}
                className="p-1.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
              >
                <option value="ALL">-- Tất cả Nhà Cung Cấp ({availableNccFilterList.length}) --</option>
                {availableNccFilterList.map(n => (
                  <option key={n.id} value={n.id}>{n.ten_goi_tat || n.ten_cong_ty}</option>
                ))}
              </select>

              {/* Lọc Trạng thái đối chiếu */}
              <select
                value={selectedReconcileStatus}
                onChange={(e) => { setSelectedReconcileStatus(e.target.value); setCurrentPage(1); }}
                className="p-1.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
              >
                <option value="ALL">-- Trạng thái đối chiếu --</option>
                <option value="CHUA_DOI_CHIEU">Chưa đối chiếu</option>
                <option value="KHOP">✓ Đã khớp NCC</option>
                <option value="LECH">⚠ Lệch tiền</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Tìm mã vé, chuyến bay, nhân viên..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFFF0] border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#05469B]"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full min-w-[1300px] border-collapse text-[11.5px] text-left">
              <thead className="bg-[#e8f0fe] sticky top-0 z-10 text-gray-800 font-extrabold border-b border-gray-200 text-center">
                <tr>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-10">STT</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-14">Kỳ</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-12">Lần</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 w-44 text-left">Nhân viên</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-24">Hãng bay</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-28 text-left">Nhà cung cấp</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 w-52 bg-sky-50 text-sky-900">Chiều đi (Code / Chuyến bay / Ngày)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 w-52 bg-indigo-50 text-indigo-900">Chiều về (Nếu có)</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-24 text-right">Phụ phí</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-24 text-right">NV trả</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 w-28 text-right bg-emerald-50 text-emerald-900 font-black">Cty chi trả</th>
                  <th className="py-2.5 px-2 border-r border-gray-200 w-24">Đối chiếu</th>
                  <th className="py-2.5 px-2 w-20">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedTickets.length > 0 ? (
                  paginatedTickets.map((ticket, idx) => (
                    <tr key={ticket.id || idx} className="hover:bg-blue-50/20 transition-colors">
                      <td className="p-2 text-center text-gray-400 border-r border-gray-100">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-2 text-center font-bold text-gray-700 border-r border-gray-100">
                        {ticket.thang}/{ticket.nam}
                      </td>
                      <td className="p-2 text-center font-bold text-emerald-700 border-r border-gray-100">
                        L.{ticket.lan_ve_phep || 1}
                      </td>
                      <td className="p-2 border-r border-gray-100">
                        <span className="font-extrabold text-[#05469B] block">{ticket.ho_ten}</span>
                        <span className="font-mono text-[10px] text-gray-400">[{ticket.ma_so_nhan_vien}]</span>
                      </td>
                      <td className="p-2 text-center font-semibold text-gray-800 border-r border-gray-100">
                        {ticket.hang_van_chuyen || '---'}
                      </td>
                      <td className="p-2 border-r border-gray-100 truncate max-w-[120px]">
                        <span className="font-medium text-gray-700">{ticket.ten_ncc || '---'}</span>
                      </td>

                      {/* Chiều đi */}
                      <td className="p-2 border-r border-gray-100 bg-sky-50/20">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-black text-sky-900 uppercase">{ticket.code_ve_di || '---'}</span>
                          <span className="font-bold text-gray-700">{ticket.chuyen_bay_di || ''}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-0.5">
                          <span>{ticket.ngay_di || ''} ({ticket.chang_di || ''})</span>
                          <span className="font-bold text-gray-800">{(formatCurrency(ticket.gia_ve_di) || '0')} đ</span>
                        </div>
                      </td>

                      {/* Chiều về */}
                      <td className="p-2 border-r border-gray-100 bg-indigo-50/20">
                        {ticket.code_ve_ve || ticket.chuyen_bay_ve || ticket.gia_ve_ve ? (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-black text-indigo-900 uppercase">{ticket.code_ve_ve || '---'}</span>
                              <span className="font-bold text-gray-700">{ticket.chuyen_bay_ve || ''}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-0.5">
                              <span>{ticket.ngay_ve || ''} ({ticket.chang_ve || ''})</span>
                              <span className="font-bold text-gray-800">{(formatCurrency(ticket.gia_ve_ve) || '0')} đ</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-300 italic text-center block">-</span>
                        )}
                      </td>

                      {/* Phụ phí */}
                      <td className="p-2 text-right font-medium text-gray-700 border-r border-gray-100">
                        {(formatCurrency((Number(ticket.phi_doi_ve) || 0) + (Number(ticket.phi_hanh_ly) || 0)) || '0')} đ
                      </td>

                      {/* NV trả */}
                      <td className="p-2 text-right font-medium text-amber-700 border-r border-gray-100">
                        {ticket.nv_tu_tra ? `${formatCurrency(ticket.nv_tu_tra)} đ` : '0 đ'}
                      </td>

                      {/* Cty chi trả */}
                      <td className="p-2 text-right font-black text-emerald-800 border-r border-gray-100 bg-emerald-50/20">
                        {(formatCurrency(ticket.cty_thanh_toan || ticket.tong_tien) || '0')} đ
                      </td>

                      {/* Đối chiếu */}
                      <td className="p-2 text-center border-r border-gray-100">
                        {ticket.trang_thai_doi_chieu === 'Khớp' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Khớp
                          </span>
                        ) : ticket.trang_thai_doi_chieu === 'Lệch tiền' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title={ticket.ghi_chu_doi_chieu}>
                            ⚠ Lệch
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                            Chưa ĐC
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setTicketModal({ isOpen: true, mode: 'edit', data: ticket })}
                            className="p-1 rounded-md text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Sửa vé"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketToDelete(ticket)}
                            className="p-1 rounded-md text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Xóa vé"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-gray-400 italic">
                      {loading ? 'Đang tải danh sách vé...' : 'Không tìm thấy vé nào phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {filteredTickets.length > pageSize && (
            <div className="p-3 border-t border-gray-100 bg-[#f8fafc]">
              <Pagination
                currentPage={currentPage}
                totalCount={filteredTickets.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      )}

      {/* 🟢 SUB-TAB 3: ĐỐI CHIẾU CÔNG NỢ NHÀ CUNG CẤP (PASTE TOOL) */}
      {activeSubTab === 'DOI_CHIEU_NCC' && (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 space-y-5">
          <div className="bg-indigo-50/60 p-5 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-indigo-950 flex items-center gap-2">
                <ArrowRightLeft className="text-indigo-600" size={20} />
                Công Cụ Đối Chiếu Công Nợ Nhà Cung Cấp Vé (Sao Chép & Dán)
              </h3>
              <p className="text-xs text-indigo-700 mt-1 max-w-2xl leading-relaxed">
                Hỗ trợ đối soát nhanh công nợ với các đại lý vé (Én Việt, Thăng Long, Đường sắt...). 
                Bạn chỉ cần copy trực tiếp từ bảng kê Excel của NCC và dán vào, hệ thống sẽ tự động so khớp theo <strong>Code vé, Chuyến bay, và Số tiền</strong> để chỉ ra dòng nào lệch hoặc thiếu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDoiChieuModalOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 shrink-0 cursor-pointer"
            >
              <ClipboardPaste size={18} />
              <span>Mở Hộp Thoại Dán Bảng Kê</span>
            </button>
          </div>

          {/* Hướng dẫn quy trình 3 bước */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center">1</span>
              <h4 className="font-extrabold text-gray-800 text-xs">Copy từ file Excel của NCC</h4>
              <p className="text-[11px] text-gray-500 leading-normal">
                Quét chọn các cột Code vé, Số hiệu chuyến bay, Giá tiền vé từ file Excel bảng kê mà Nhà cung cấp gửi sang.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center">2</span>
              <h4 className="font-extrabold text-gray-800 text-xs">Dán và rà soát kết quả</h4>
              <p className="text-[11px] text-gray-500 leading-normal">
                Hệ thống tự động phát hiện mã vé, so khớp với vé nội bộ và làm nổi bật các dòng chênh lệch số tiền hoặc chưa có vé.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center">3</span>
              <h4 className="font-extrabold text-gray-800 text-xs">Xác nhận cập nhật</h4>
              <p className="text-[11px] text-gray-500 leading-normal">
                Nhấn "Áp dụng kết quả đối chiếu" để đánh dấu các vé đã khớp hoàn toàn, độc lập không lo ảnh hưởng DNTT.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 MODAL THÊM / SỬA VÉ */}
      <VeMayBayModal
        isOpen={ticketModal.isOpen}
        mode={ticketModal.mode}
        initialData={ticketModal.data}
        personnelList={eligiblePersonnel}
        donViList={donViList}
        nccList={nccList}
        onClose={() => setTicketModal({ isOpen: false, mode: 'create', data: null })}
        onSave={handleSaveTicket}
      />

      {/* 🟢 MODAL ĐỐI CHIẾU DÁN BẢNG KÊ */}
      <VePhepDoiChieuModal
        isOpen={isDoiChieuModalOpen}
        onClose={() => setIsDoiChieuModalOpen(false)}
        nccList={nccList}
        veList={scopedTickets}
        selectedMonth={selectedMonth === 'ALL' ? currentMonth : Number(selectedMonth)}
        selectedYear={selectedYear}
        onApplyReconciliation={handleApplyReconciliation}
      />

      {/* 🟢 MODAL XÁC NHẬN XÓA VÉ */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in zoom-in-95 duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto border-4 border-red-100">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Xác nhận xóa vé?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Vé của nhân sự <strong className="text-gray-800">{ticketToDelete.ho_ten}</strong> (Mã vé: {ticketToDelete.code_ve_di || ticketToDelete.code_ve_ve}) sẽ bị xóa khỏi hệ thống.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTicket}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa Vĩnh Viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 MODAL XEM CHI TIẾT LỊCH SỬ VÉ CỦA NHÂN SỰ TỪ MA TRẬN */}
      {viewStaffHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in zoom-in-95 duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-[#e8f0fe] shrink-0">
              <div className="flex items-center gap-2">
                <Plane size={18} className="text-[#05469B]" />
                <h3 className="text-sm font-extrabold text-[#05469B]">
                  Lịch Sử Vé Về Phép: {viewStaffHistory.staff.ho_ten} ({viewStaffHistory.tickets.length} lượt vé)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewStaffHistory(null)}
                className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-white shadow-2xs transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3 text-xs">
              {viewStaffHistory.tickets.length > 0 ? (
                viewStaffHistory.tickets.map((t, idx) => (
                  <div key={t.id || idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#05469B]">Lần {t.lan_ve_phep || 1} • Tháng {t.thang}/{t.nam}</span>
                        <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.2 rounded">
                          {t.hang_van_chuyen || 'Máy bay'}
                        </span>
                        {t.trang_thai_doi_chieu === 'Khớp' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded">✓ Đã khớp NCC</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-600">
                        <span>Đi: <strong>{t.code_ve_di || '---'}</strong> ({t.chuyen_bay_di || ''}) ngày {t.ngay_di || '---'}</span>
                        {t.code_ve_ve && (
                          <span className="ml-3">Về: <strong>{t.code_ve_ve}</strong> ({t.chuyen_bay_ve || ''}) ngày {t.ngay_ve || '---'}</span>
                        )}
                      </div>
                      {t.ten_ncc && (
                        <div className="text-[10px] text-gray-400">Đại lý vé: {t.ten_ncc}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block font-bold">Cty chi trả</span>
                        <span className="text-sm font-black text-emerald-700">
                          {(formatCurrency(t.cty_thanh_toan || t.tong_tien) || '0')} đ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setViewStaffHistory(null);
                          setTicketModal({ isOpen: true, mode: 'edit', data: t });
                        }}
                        className="p-1.5 rounded-lg bg-blue-50 text-[#05469B] hover:bg-[#05469B] hover:text-white transition-all shadow-2xs cursor-pointer"
                        title="Chỉnh sửa chi tiết vé này"
                      >
                        <Edit size={13} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 italic">
                  Chưa có lượt vé nào được ghi nhận cho nhân sự này trong kỳ được chọn.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewStaffHistory(null)}
                className="px-5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
