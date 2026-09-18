import React, { useState, useMemo } from 'react';
import {
  BarChart3, DollarSign, Calendar, Filter, PieChart,
  TrendingUp, Building2, Layers, Search, RefreshCw, FileText,
  Star
} from 'lucide-react';
import { DNTT, DnttPhanBo, DmKmp, DmBoPhan, BoPhanCap1, BoPhanCap2, DonVi } from '../../types';

interface Props {
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  donViList: DonVi[];
  selectedUnitFilter: string | null;
  onRefresh: () => Promise<void>;
  loading: boolean;
}

export default function CostDashboardTab({
  dnttList,
  phanBoList,
  kmpList,
  boPhanList,
  cap1List,
  cap2List,
  donViList,
  selectedUnitFilter,
  onRefresh,
  loading
}: Props) {
  const currentYear = new Date().getFullYear();
  const [filterNam, setFilterNam] = useState<number>(currentYear);
  const [filterThang, setFilterThang] = useState<string>('ALL');
  const [filterKmp, setFilterKmp] = useState<string>('ALL');
  const [filterCap1, setFilterCap1] = useState<string>('ALL');
  const [filterCap2, setFilterCap2] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Map nhanh tên các danh mục (hỗ trợ cả boPhanList lẫn cap1List/cap2List)
  const dnttMap = useMemo(() => new Map(dnttList.map(d => [d.id, d])), [dnttList]);
  const kmpMap = useMemo(() => new Map(kmpList.map(k => [k.id, k])), [kmpList]);
  const boPhanMap = useMemo(() => new Map((boPhanList || []).map(b => [b.id, b])), [boPhanList]);
  const cap1Map = useMemo(() => new Map(cap1List.map(c => [c.id, c.ten])), [cap1List]);
  const cap2Map = useMemo(() => new Map(cap2List.map(c => [c.id, c.ten])), [cap2List]);
  const donViMap = useMemo(() => new Map(donViList.map(d => [d.id, d.ten_don_vi])), [donViList]);

  // Phân nhóm Khoản mục phí theo Nhóm chi phí cho Slicer cây thư mục
  const groupedKmp = useMemo(() => {
    const map = new Map<string, DmKmp[]>();
    kmpList.forEach(k => {
      if (k.active === false) return;
      const grp = k.nhom_chi_phi?.trim() || 'Chi phí khác';
      if (!map.has(grp)) map.set(grp, []);
      map.get(grp)!.push(k);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [kmpList]);

  // Danh sách Khối lọc
  const uniqueKhoiFilter = useMemo(() => {
    if (boPhanList && boPhanList.length > 0) {
      const map = new Map<string, string>();
      boPhanList.filter(b => b.active !== false).forEach(b => {
        if (!map.has(b.ma_cap1)) map.set(b.ma_cap1, b.ten_cap1);
      });
      return Array.from(map.entries()).map(([id, ten]) => ({ id, ten }));
    }
    return cap1List.map(c => ({ id: c.id, ten: c.ten }));
  }, [boPhanList, cap1List]);

  // Danh sách Thương hiệu lọc
  const uniqueThuongHieuFilter = useMemo(() => {
    if (boPhanList && boPhanList.length > 0) {
      return boPhanList.filter(b => b.active !== false).map(b => ({
        id: b.id,
        ten: `${b.ten_cap2} (${b.ten_cap1})`
      }));
    }
    return cap2List.map(c => ({ id: c.id, ten: c.ten }));
  }, [boPhanList, cap2List]);

  // Hàm hiển thị Tên Khối / Nghiệp vụ
  const getCap1Display = (pb: DnttPhanBo) => {
    if (pb.id_bo_phan && boPhanMap.has(pb.id_bo_phan)) {
      return boPhanMap.get(pb.id_bo_phan)!.ten_cap1;
    }
    if (pb.id_bo_phan_cap1) {
      if (boPhanList && boPhanList.length > 0) {
        const found = boPhanList.find(b => b.ma_cap1 === pb.id_bo_phan_cap1 || b.id === pb.id_bo_phan_cap1);
        if (found) return found.ten_cap1;
      }
      return cap1Map.get(pb.id_bo_phan_cap1) || pb.id_bo_phan_cap1;
    }
    return 'Chưa phân loại';
  };

  // Hàm hiển thị Tên Thương hiệu / Phòng ban
  const getCap2Display = (pb: DnttPhanBo) => {
    if (pb.id_bo_phan && boPhanMap.has(pb.id_bo_phan)) {
      return boPhanMap.get(pb.id_bo_phan)!.ten_cap2;
    }
    if (pb.id_bo_phan_cap2) {
      if (boPhanList && boPhanList.length > 0) {
        const found = boPhanList.find(b => b.id === pb.id_bo_phan_cap2 || b.ma_cap2 === pb.id_bo_phan_cap2);
        if (found) return found.ten_cap2;
      }
      return cap2Map.get(pb.id_bo_phan_cap2) || pb.id_bo_phan_cap2;
    }
    return '-';
  };

  // Lọc dữ liệu phân bổ theo các tiêu chí
  const filteredPhanBo = useMemo(() => {
    return phanBoList.filter(pb => {
      const parentDntt = dnttMap.get(pb.dntt_id);
      if (!parentDntt || parentDntt.trang_thai === 'Từ chối' || parentDntt.trang_thai === 'Lưu nháp') return false;

      // 1. Lọc theo Đơn vị (thông qua DNTT cha)
      if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
        if (!parentDntt || parentDntt.id_don_vi !== selectedUnitFilter) return false;
      }

      // 2. Lọc theo Năm
      if (filterNam && pb.nam !== Number(filterNam)) return false;

      // 3. Lọc theo Tháng
      if (filterThang !== 'ALL' && pb.thang !== Number(filterThang)) return false;

      // 4. Lọc theo KMP
      if (filterKmp !== 'ALL' && pb.id_kmp !== filterKmp) return false;

      // 5. Lọc theo Cấp 1
      if (filterCap1 !== 'ALL' && pb.id_bo_phan_cap1 !== filterCap1) return false;

      // 6. Lọc theo Cấp 2
      if (filterCap2 !== 'ALL' && pb.id_bo_phan_cap2 !== filterCap2) return false;

      // 7. Lọc theo từ khóa đa trường (Số ĐNTT, người đề nghị, nội dung, KMP, mã B7, B10, bộ phận, ghi chú)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const kmp = kmpMap.get(pb.id_kmp);
        const kmpText = `${kmp?.ma_b7 || ''} ${kmp?.ma_b10 || ''} ${kmp?.dien_giai || ''} ${kmp?.nhom_chi_phi || ''}`;
        const cap1Text = getCap1Display(pb);
        const cap2Text = getCap2Display(pb);
        const dnttText = `${parentDntt?.so_dntt || ''} ${parentDntt?.nguoi_de_nghi || ''} ${parentDntt?.noi_dung_thanh_toan || ''} ${parentDntt?.don_vi_hien_thi || ''}`;
        const noteText = pb.ghi_chu || '';
        const combined = `${kmpText} ${cap1Text} ${cap2Text} ${dnttText} ${noteText}`.toLowerCase();
        if (!combined.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [phanBoList, dnttMap, selectedUnitFilter, filterNam, filterThang, filterKmp, filterCap1, filterCap2, searchTerm, kmpMap, boPhanList, cap1List, cap2List]);

  // Phân trang & số dòng hiển thị của Bảng kê chi tiết
  const totalRows = filteredPhanBo.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalRows / pageSize);

  const displayedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredPhanBo;
    const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));
    const start = (safePage - 1) * pageSize;
    return filteredPhanBo.slice(start, start + pageSize);
  }, [filteredPhanBo, pageSize, currentPage, totalPages]);

  // Tổng hợp chỉ số KPI
  const kpis = useMemo(() => {
    const totalAmount = filteredPhanBo.reduce((sum, r) => sum + (Number(r.so_tien) || 0), 0);
    const uniqueDnttIds = new Set(filteredPhanBo.map(r => r.dntt_id));
    const uniqueKmpIds = new Set(filteredPhanBo.map(r => r.id_kmp));
    const avgPerDntt = uniqueDnttIds.size > 0 ? Math.round(totalAmount / uniqueDnttIds.size) : 0;

    return {
      totalAmount,
      dnttCount: uniqueDnttIds.size,
      kmpCount: uniqueKmpIds.size,
      avgPerDntt
    };
  }, [filteredPhanBo]);

  // Phân bổ theo Nhóm chi phí KMP
  const groupStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPhanBo.forEach(r => {
      const kmp = kmpMap.get(r.id_kmp);
      const groupName = kmp?.nhom_chi_phi || 'Chi phí khác';
      map[groupName] = (map[groupName] || 0) + Number(r.so_tien || 0);
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      amount: val,
      percent: kpis.totalAmount > 0 ? ((val / kpis.totalAmount) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredPhanBo, kmpMap, kpis.totalAmount]);

  // Phân bổ theo Khối / Nghiệp vụ
  const cap1Stats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPhanBo.forEach(r => {
      const name = getCap1Display(r);
      map[name] = (map[name] || 0) + Number(r.so_tien || 0);
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      amount: val,
      percent: kpis.totalAmount > 0 ? ((val / kpis.totalAmount) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredPhanBo, boPhanList, cap1Map, kpis.totalAmount]);

  // Phân bổ theo Thương hiệu / Phòng / Bộ phận
  const cap2Stats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPhanBo.forEach(r => {
      const name = getCap2Display(r);
      if (name && name !== '-') {
        map[name] = (map[name] || 0) + Number(r.so_tien || 0);
      }
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      amount: val,
      percent: kpis.totalAmount > 0 ? ((val / kpis.totalAmount) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredPhanBo, boPhanList, cap2Map, kpis.totalAmount]);

  return (
    <div className="space-y-4 pr-1 pb-16">
      {/* 1. Bộ lọc Thống kê */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
            <Filter size={15} />
            <span>Kỳ báo cáo:</span>
          </div>

          <select
            value={filterNam}
            onChange={(e) => setFilterNam(Number(e.target.value))}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 text-[#D97706] focus:ring-2 focus:ring-[#D97706]"
          >
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>

          <select
            value={filterThang}
            onChange={(e) => setFilterThang(e.target.value)}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 focus:ring-2 focus:ring-[#D97706]"
          >
            <option value="ALL">Cả năm</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>

          {/* Slicer KMP ứng dụng giao diện cây thư mục phân theo Nhóm chi phí */}
          <select
            value={filterKmp}
            onChange={(e) => setFilterKmp(e.target.value)}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 max-w-[230px] focus:ring-2 focus:ring-[#D97706]"
            title="Chọn Khoản mục phí phân theo nhóm"
          >
            <option value="ALL">📂 Tất cả Khoản mục phí (KMP)</option>
            {groupedKmp.map(([groupName, items]) => (
              <optgroup key={groupName} label={`📂 ${groupName.toUpperCase()}`}>
                {items.map(k => (
                  <option key={k.id} value={k.id}>
                    &nbsp;&nbsp;{k.ma_b7 ? `[${k.ma_b7}] ` : ''}{k.dien_giai || k.nhom_chi_phi}{k.trong_yeu ? ' ⭐' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={filterCap1}
            onChange={(e) => setFilterCap1(e.target.value)}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 max-w-[160px]"
          >
            <option value="ALL">Tất cả Khối / Nghiệp vụ</option>
            {uniqueKhoiFilter.map(c => (
              <option key={c.id} value={c.id}>{c.ten}</option>
            ))}
          </select>

          <select
            value={filterCap2}
            onChange={(e) => setFilterCap2(e.target.value)}
            className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 max-w-[170px]"
          >
            <option value="ALL">Tất cả Thương hiệu / P.Ban</option>
            {uniqueThuongHieuFilter.map(c => (
              <option key={c.id} value={c.id}>{c.ten}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Nhãn Tổng chi phí đã phân bổ - Màu Amber #D97706 */}
        <div className="bg-gradient-to-br from-[#D97706] to-[#b45309] p-4 rounded-2xl text-white shadow-md space-y-1">
          <div className="flex items-center justify-between opacity-90 text-xs font-bold uppercase tracking-wider">
            <span>Tổng chi phí đã phân bổ</span>
            <DollarSign size={18} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">
            {kpis.totalAmount.toLocaleString('vi-VN')} <span className="text-xs font-normal">VNĐ</span>
          </div>
          <div className="text-[11px] text-amber-100">
            {filteredPhanBo.length} lượt phân bổ chi tiết
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
            <span>Số phiếu DNTT</span>
            <FileText size={18} className="text-[#D97706]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">
            {kpis.dnttCount} <span className="text-xs font-normal text-gray-500">phiếu</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Bình quân: {kpis.avgPerDntt.toLocaleString('vi-VN')} VNĐ / phiếu
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
            <span>Khoản mục phí phát sinh</span>
            <Layers size={18} className="text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">
            {kpis.kmpCount} <span className="text-xs font-normal text-gray-500">khoản mục</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Chiếm {((kpis.kmpCount / (kmpList.length || 1)) * 100).toFixed(0)}% danh mục KMP
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
            <span>Showroom áp dụng</span>
            <Building2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">
            {selectedUnitFilter && selectedUnitFilter !== 'ALL'
              ? (donViMap.get(selectedUnitFilter) || '1 showroom')
              : `${donViList.length} showroom`}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            Đang hoạt động ổn định
          </div>
        </div>
      </div>

      {/* 3. Cơ cấu Chi phí (Theo Nhóm & Theo Bộ phận) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Theo Nhóm KMP */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs space-y-3">
          <h4 className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <PieChart size={15} className="text-[#D97706]" />
            <span>Theo Nhóm chi phí KMP</span>
          </h4>
          <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
            {groupStats.map(item => (
              <div key={item.name} className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                  <span className="font-medium truncate max-w-[180px]">{item.name}</span>
                  <span className="font-mono text-[#D97706]">{item.amount.toLocaleString('vi-VN')} ({item.percent}%)</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D97706] rounded-full"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
            {groupStats.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Chưa có dữ liệu</p>}
          </div>
        </div>

        {/* Theo Khối / Nghiệp vụ */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs space-y-3">
          <h4 className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Layers size={15} className="text-emerald-600" />
            <span>Theo Khối / Nghiệp vụ</span>
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {cap1Stats.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-300">
                  <span className="truncate max-w-[170px]">{item.name}</span>
                  <span className="font-mono text-emerald-600">{item.amount.toLocaleString('vi-VN')} ({item.percent}%)</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
            {cap1Stats.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Chưa có dữ liệu</p>}
          </div>
        </div>

        {/* Theo Thương hiệu / Phòng / Bộ phận */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs space-y-3">
          <h4 className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <TrendingUp size={15} className="text-amber-500" />
            <span>Theo Thương hiệu / Phòng / Bộ phận</span>
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {cap2Stats.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-300">
                  <span className="truncate max-w-[170px]">{item.name}</span>
                  <span className="font-mono text-amber-600">{item.amount.toLocaleString('vi-VN')} ({item.percent}%)</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
            {cap2Stats.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Chưa có dữ liệu thương hiệu</p>}
          </div>
        </div>
      </div>

      {/* 4. Bảng kê chi tiết các dòng phân bổ — Cấu trúc 7 cột chuẩn + Thanh cuộn riêng bên trong */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs overflow-hidden flex flex-col">
        {/* Header của Bảng: Tiêu đề + Chọn số dòng hiển thị + Ô tìm kiếm */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 size={18} className="text-[#D97706]" />
              <span>Bảng kê chi tiết các dòng phân bổ</span>
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-[#D97706] border border-amber-200 dark:border-amber-800">
              {totalRows} dòng
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Lựa chọn số dòng hiển thị */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span>Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="p-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs font-bold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#D97706]"
              >
                <option value={10}>10 dòng</option>
                <option value={25}>25 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
                <option value="ALL">Tất cả ({totalRows})</option>
              </select>
            </div>

            {/* Ô tìm kiếm nhanh */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Tìm theo KMP, mã B7, khối, thương hiệu..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              />
            </div>
          </div>
        </div>

        {/* Khung Bảng: Thanh cuộn riêng bên trong (max-h 500px) */}
        <div className="overflow-auto custom-scrollbar w-full max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 dark:bg-slate-700/90 text-gray-700 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-slate-600 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="p-3 w-12 text-center whitespace-nowrap">STT</th>
                <th className="p-3 w-24 text-center whitespace-nowrap">Kỳ (T/N)</th>
                <th className="p-3 w-28 whitespace-nowrap">Mã B7</th>
                <th className="p-3 min-w-[220px]">Khoản mục phí</th>
                <th className="p-3 w-44 whitespace-nowrap">Khối / Nghiệp vụ</th>
                <th className="p-3 w-48 whitespace-nowrap">Thương hiệu / Phòng / Bộ phận</th>
                <th className="p-3 w-36 text-right whitespace-nowrap">Số tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
              {displayedRows.map((pb, idx) => {
                const globalIdx = pageSize === 'ALL' ? idx : (currentPage - 1) * pageSize + idx;
                const kmp = kmpMap.get(pb.id_kmp);
                const cap1 = getCap1Display(pb);
                const cap2 = getCap2Display(pb);

                return (
                  <tr key={pb.id || idx} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="p-3 text-center font-mono text-gray-400 font-medium">
                      {globalIdx + 1}
                    </td>

                    {/* Kỳ phân bổ */}
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                        T{pb.thang}/{pb.nam}
                      </span>
                    </td>

                    {/* Mã B7 / B10 */}
                    <td className="p-3 font-mono">
                      <div className="font-bold text-[#D97706]">{kmp?.ma_b7 || '-'}</div>
                      {kmp?.ma_b10 && (
                        <div className="text-[10.5px] text-gray-400 font-normal">
                          B10: {kmp.ma_b10}
                        </div>
                      )}
                    </td>

                    {/* Khoản mục phí */}
                    <td className="p-3">
                      <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1 flex-wrap">
                        <span>{kmp?.nhom_chi_phi || 'Chi phí khác'}</span>
                        {kmp?.trong_yeu && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded">
                            <Star size={9} className="fill-amber-500 text-amber-500" /> Trọng yếu
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {kmp?.dien_giai || '-'}
                      </div>
                    </td>

                    {/* Khối / Nghiệp vụ */}
                    <td className="p-3 font-medium text-gray-800 dark:text-gray-200">
                      {cap1}
                    </td>

                    {/* Thương hiệu / Phòng ban */}
                    <td className="p-3">
                      {cap2 !== '-' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-[#D97706] border border-amber-200 dark:border-amber-800">
                          {cap2}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* Số tiền phân bổ */}
                    <td className="p-3 text-right font-mono font-bold text-[#D97706] text-[13px] whitespace-nowrap">
                      {Number(pb.so_tien || 0).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                );
              })}

              {filteredPhanBo.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <FileText size={40} className="mx-auto mb-2 opacity-40 text-[#D97706]" />
                    <p className="font-semibold text-gray-600 dark:text-gray-300">Không tìm thấy bản ghi phân bổ nào phù hợp.</p>
                    <p className="text-xs text-gray-400 mt-1">Hãy thử thay đổi điều kiện lọc Năm, Tháng, KMP hoặc từ khóa tìm kiếm.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Tổng kết & Phân trang */}
        <div className="p-3.5 bg-gray-50 dark:bg-slate-700/60 border-t border-gray-200 dark:border-slate-600 text-xs text-gray-600 dark:text-gray-300 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span>Tổng cộng: <strong className="text-gray-900 dark:text-white font-bold">{totalRows}</strong> dòng phân bổ chi tiết</span>
            <span className="text-gray-300 dark:text-slate-500">|</span>
            <span>Từ <strong className="text-gray-900 dark:text-white font-bold">{kpis.dnttCount}</strong> phiếu ĐNTT</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-600 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-600 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Trước
                </button>
                <span className="px-2 font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-600 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-600 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Sau
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Tổng chi phí:</span>
              <strong className="text-[#D97706] font-mono text-base font-black">
                {kpis.totalAmount.toLocaleString('vi-VN')} VNĐ
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
