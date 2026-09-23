import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, Layers, Calendar, Filter, 
  Download, FileSpreadsheet, Eye, EyeOff, Search, Sparkles, AlertTriangle, CheckCircle2, Lock
} from 'lucide-react';
import { 
  ChiPhiThongKe, ChiPhiChotKy, DNTT, DnttPhanBo, DmKmp, 
  DonVi, DmNhomChiPhi, DmBoPhan 
} from '../../types';
import { buildThacoCostMatrix, MatrixRowItem, MonthValue } from '../../utils/thacoCostDataEngine';
import { exportThacoMultiSheetExcel } from '../../utils/exportThacoCostReport';

interface Props {
  year: number;
  onYearChange?: (year: number) => void;
  thongKeList: ChiPhiThongKe[];
  chotKyList: ChiPhiChotKy[];
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  nhomChiPhiList?: DmNhomChiPhi[];
  donViList: DonVi[];
  fullDonViList?: DonVi[];
  boPhanList?: DmBoPhan[];
  selectedUnitFilter: string | null;
  userPermittedUnitIds?: Set<string> | null;
  includeTemporary: boolean;
  onToggleIncludeTemporary: (val: boolean) => void;
  onlyAdministrative: boolean;
  onToggleOnlyAdministrative: (val: boolean) => void;
  onOpenChotKyModal?: () => void;
}

export default function CostMatrixView({
  year,
  onYearChange,
  thongKeList,
  chotKyList,
  dnttList,
  phanBoList,
  kmpList,
  nhomChiPhiList = [],
  donViList,
  fullDonViList,
  boPhanList = [],
  selectedUnitFilter,
  userPermittedUnitIds,
  includeTemporary,
  onToggleIncludeTemporary,
  onlyAdministrative,
  onToggleOnlyAdministrative,
  onOpenChotKyModal
}: Props) {
  // Trạng thái bung mở dòng con KMP: Set<kmpId>
  const [expandedKmpIds, setExpandedKmpIds] = useState<Set<string>>(new Set());
  // Từ khóa tìm kiếm KMP trong ma trận
  const [filterQuery, setFilterQuery] = useState('');

  // Tên đơn vị đang xem
  const currentUnitName = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return userPermittedUnitIds ? 'Tất cả Đơn vị trực thuộc' : 'Toàn bộ Công ty';
    }
    const found = donViList.find(d => String(d.id) === String(selectedUnitFilter));
    return found ? found.ten_don_vi : selectedUnitFilter;
  }, [selectedUnitFilter, donViList, userPermittedUnitIds]);

  // Tính toán dữ liệu ma trận
  const matrixResult = useMemo(() => {
    return buildThacoCostMatrix({
      year,
      thongKeList,
      chotKyList,
      dnttList,
      phanBoList,
      kmpList,
      nhomChiPhiList,
      donViList,
      boPhanList,
      selectedUnitFilter,
      userPermittedUnitIds,
      includeTemporary,
      onlyAdministrative
    });
  }, [
    year,
    thongKeList,
    chotKyList,
    dnttList,
    phanBoList,
    kmpList,
    nhomChiPhiList,
    donViList,
    boPhanList,
    selectedUnitFilter,
    userPermittedUnitIds,
    includeTemporary,
    onlyAdministrative
  ]);

  const toggleExpand = (id: string) => {
    setExpandedKmpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    matrixResult.rows.forEach(grp => {
      (grp.children || []).forEach(kmp => {
        if (kmp.children && kmp.children.length > 0) {
          allIds.add(kmp.id);
        }
      });
    });
    setExpandedKmpIds(allIds);
  };

  const collapseAll = () => {
    setExpandedKmpIds(new Set());
  };

  // Format số tiền
  const formatMoney = (val: number | null | undefined): string => {
    if (val === null || val === undefined || val === 0) return '-';
    return Number(val).toLocaleString('vi-VN');
  };

  // Format phần trăm
  const formatPercent = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
  };

  // Render ô tháng
  const renderMonthCell = (monthVal: MonthValue, isHeader = false) => {
    const isZero = monthVal.amount === 0;

    return (
      <td
        className={`p-2 text-right font-mono whitespace-nowrap text-xs transition-colors ${
          isHeader ? 'font-bold' : ''
        } ${
          isZero
            ? 'text-gray-400 dark:text-slate-500'
            : 'text-gray-900 dark:text-gray-100 font-medium'
        }`}
      >
        <span>{formatMoney(monthVal.amount)}</span>
      </td>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* 1. THANH CÔNG CỤ ĐIỀU KHIỂN MA TRẬN */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Bộ lọc trái: Năm & Checkboxes */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Chọn Năm */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-700 dark:text-gray-300">Năm báo cáo:</span>
            <select
              value={year}
              onChange={(e) => onYearChange && onYearChange(Number(e.target.value))}
              className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 font-bold text-xs text-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]"
            >
              {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>


          {/* Checkbox "Chỉ hiển thị Chi phí hành chính" */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 cursor-pointer select-none font-semibold hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={onlyAdministrative}
              onChange={(e) => onToggleOnlyAdministrative(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer accent-[#D97706]"
            />
            <span>Chỉ hiển thị Chi phí hành chính</span>
          </label>
        </div>

        {/* Bộ lọc phải: Tìm kiếm KMP & Bung mở & Xuất Excel */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Ô tìm kiếm KMP */}
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="Lọc KMP theo tên..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D97706]"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
              title="Bung mở tất cả các dòng con phân bổ"
            >
              Mở rộng
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
              title="Thu gọn tất cả dòng con"
            >
              Thu gọn
            </button>
          </div>

          {/* Nút Quản lý Chốt kỳ Chi phí */}
          {onOpenChotKyModal && (
            <button
              type="button"
              onClick={onOpenChotKyModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
              title="Quản lý Chốt kỳ Chi phí (Khóa số liệu & Đóng băng DNTT)"
            >
              <Lock size={14} />
              <span>Chốt kỳ chi phí</span>
            </button>
          )}

          {/* Nút Xuất Excel Đa Sheet */}
          <button
            type="button"
            onClick={() => {
              exportThacoMultiSheetExcel({
                year,
                companyName: currentUnitName,
                thongKeList,
                chotKyList,
                dnttList,
                phanBoList,
                kmpList,
                nhomChiPhiList,
                donViList,
                boPhanList,
                selectedUnitFilter,
                includeTemporary,
                onlyAdministrative
              });
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
            title="Xuất Workbook Excel đa sheet (Tổng công ty + Từng Showroom)"
          >
            <FileSpreadsheet size={15} />
            <span>Xuất Excel đa sheet</span>
          </button>
        </div>
      </div>


      {/* 2. BẢNG MA TRẬN QUẢN TRỊ CHI PHÍ CHUẨN THACO */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col min-h-[480px]">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs table-fixed min-w-[1600px]">
            {/* Table Header */}
            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-slate-700/90 text-gray-700 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-slate-600 shadow-xs">
              <tr>
                <th className="p-2.5 w-12 text-center sticky left-0 z-30 bg-gray-50 dark:bg-slate-700 border-r border-gray-200 dark:border-slate-600">STT</th>
                <th className="p-2.5 w-72 sticky left-12 z-30 bg-gray-50 dark:bg-slate-700 border-r border-gray-200 dark:border-slate-600">Khoản mục chi phí</th>
                <th className="p-2 w-20 text-center border-r border-gray-200 dark:border-slate-600">Mã B7</th>
                <th className="p-2 w-18 text-center border-r border-gray-200 dark:border-slate-600">Tỷ lệ %</th>
                
                {/* 12 Tháng */}
                <th className="p-2 w-24 text-right">T1</th>
                <th className="p-2 w-24 text-right">T2</th>
                <th className="p-2 w-24 text-right">T3</th>
                <th className="p-2 w-28 text-right bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-black border-r border-gray-200 dark:border-slate-600">Quý I</th>

                <th className="p-2 w-24 text-right">T4</th>
                <th className="p-2 w-24 text-right">T5</th>
                <th className="p-2 w-24 text-right">T6</th>
                <th className="p-2 w-28 text-right bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-black border-r border-gray-200 dark:border-slate-600">Quý II</th>

                <th className="p-2 w-24 text-right">T7</th>
                <th className="p-2 w-24 text-right">T8</th>
                <th className="p-2 w-24 text-right">T9</th>
                <th className="p-2 w-28 text-right bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-black border-r border-gray-200 dark:border-slate-600">Quý III</th>

                <th className="p-2 w-24 text-right">T10</th>
                <th className="p-2 w-24 text-right">T11</th>
                <th className="p-2 w-24 text-right">T12</th>
                <th className="p-2 w-28 text-right bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-black border-r border-gray-200 dark:border-slate-600">Quý IV</th>

                {/* Các cột Tổng kết */}
                <th className="p-2.5 w-36 text-right bg-amber-50/60 dark:bg-amber-950/30 text-[#D97706] font-black border-r border-gray-200 dark:border-slate-600">
                  Cả năm {year}
                </th>
                <th className="p-2.5 w-32 text-right bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 font-bold border-r border-gray-200 dark:border-slate-600">
                  Cùng kỳ {year - 1}
                </th>
                <th className="p-2.5 w-32 text-right border-r border-gray-200 dark:border-slate-600">
                  Chênh lệch (+/-)
                </th>
                <th className="p-2.5 w-24 text-center">
                  % Tăng/Giảm
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {matrixResult.rows.map(grp => {
                // Lọc KMP theo từ khóa tìm kiếm nếu có
                const filteredKmps = (grp.children || []).filter(k => {
                  if (!filterQuery) return true;
                  const q = filterQuery.toLowerCase().trim();
                  return (k.name || '').toLowerCase().includes(q) || (k.code || '').toLowerCase().includes(q);
                });

                if (filterQuery && filteredKmps.length === 0) return null;

                return (
                  <React.Fragment key={grp.id}>
                    {/* DÒNG NHÓM LA MÃ (Nền xám nhạt, in đậm, chữ to hơn) */}
                    <tr className="bg-gray-100/80 dark:bg-slate-700/70 font-black text-gray-900 dark:text-gray-100 border-t-2 border-gray-300 dark:border-slate-600">
                      <td className="p-2.5 text-center font-mono sticky left-0 z-10 bg-gray-100 dark:bg-slate-700 border-r border-gray-200 dark:border-slate-600">
                        {grp.stt}
                      </td>
                      <td className="p-2.5 sticky left-12 z-10 bg-gray-100 dark:bg-slate-700 border-r border-gray-200 dark:border-slate-600 tracking-tight uppercase text-[12.5px] text-[#D97706] truncate">
                        {grp.name}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-slate-600 text-center font-mono text-gray-400"></td>
                      <td className="p-2 border-r border-gray-200 dark:border-slate-600 text-center text-gray-400 font-mono"></td>

                      {/* 12 Tháng của Nhóm */}
                      {renderMonthCell(grp.months[1], true)}
                      {renderMonthCell(grp.months[2], true)}
                      {renderMonthCell(grp.months[3], true)}
                      <td className="p-2 text-right font-mono font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-r border-gray-200 dark:border-slate-600">
                        {formatMoney(grp.q1)}
                      </td>

                      {renderMonthCell(grp.months[4], true)}
                      {renderMonthCell(grp.months[5], true)}
                      {renderMonthCell(grp.months[6], true)}
                      <td className="p-2 text-right font-mono font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-r border-gray-200 dark:border-slate-600">
                        {formatMoney(grp.q2)}
                      </td>

                      {renderMonthCell(grp.months[7], true)}
                      {renderMonthCell(grp.months[8], true)}
                      {renderMonthCell(grp.months[9], true)}
                      <td className="p-2 text-right font-mono font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-r border-gray-200 dark:border-slate-600">
                        {formatMoney(grp.q3)}
                      </td>

                      {renderMonthCell(grp.months[10], true)}
                      {renderMonthCell(grp.months[11], true)}
                      {renderMonthCell(grp.months[12], true)}
                      <td className="p-2 text-right font-mono font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-r border-gray-200 dark:border-slate-600">
                        {formatMoney(grp.q4)}
                      </td>

                      {/* Cả năm, Cùng kỳ, Chênh lệch */}
                      <td className="p-2 text-right font-mono font-black bg-amber-50/80 dark:bg-amber-950/40 text-[#D97706] border-r border-gray-200 dark:border-slate-600">
                        {formatMoney(grp.yearTotal)}
                      </td>
                      <td className="p-2 text-right font-mono text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-slate-600">
                        {grp.priorYearTotal > 0 ? formatMoney(grp.priorYearTotal) : '—'}
                      </td>
                      <td className={`p-2 text-right font-mono font-bold border-r border-gray-200 dark:border-slate-600 ${
                        grp.variance > 0 ? 'text-amber-600' : grp.variance < 0 ? 'text-emerald-600' : 'text-gray-500'
                      }`}>
                        {grp.priorYearTotal > 0 ? (grp.variance > 0 ? `+${formatMoney(grp.variance)}` : formatMoney(grp.variance)) : '—'}
                      </td>
                      <td className={`p-2 text-center font-mono font-bold text-xs ${
                        grp.percentChange === null ? 'text-gray-400' : grp.percentChange > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {formatPercent(grp.percentChange)}
                      </td>
                    </tr>

                    {/* CÁC DÒNG KHOẢN MỤC PHÍ TRONG NHÓM */}
                    {filteredKmps.map(kmp => {
                      const isExpanded = expandedKmpIds.has(kmp.id);
                      const hasChildren = kmp.children && kmp.children.length > 0;

                      return (
                        <React.Fragment key={kmp.id}>
                          <tr className="hover:bg-amber-50/30 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="p-2 text-center font-mono text-gray-500 sticky left-0 z-10 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-600">
                              {kmp.stt}
                            </td>
                            <td className="p-2 sticky left-12 z-10 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-600 font-semibold text-gray-800 dark:text-gray-200">
                              <div className="flex items-center gap-1.5 truncate">
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(kmp.id)}
                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 hover:text-[#D97706] cursor-pointer shrink-0"
                                    title={isExpanded ? "Thu gọn dòng con" : "Bung mở xem dòng phân bổ con"}
                                  >
                                    {isExpanded ? <ChevronDown size={14} className="text-[#D97706]" /> : <ChevronRight size={14} />}
                                  </button>
                                ) : (
                                  <span className="w-4 inline-block" />
                                )}
                                <span className="truncate" title={kmp.name}>{kmp.name}</span>
                                {hasChildren && (
                                  <span className="text-[10px] text-gray-400 font-normal shrink-0">
                                    ({kmp.children?.length})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 border-r border-gray-200 dark:border-slate-600 text-center font-mono text-[11px] text-gray-500 font-semibold">
                              {kmp.code || '-'}
                            </td>
                            <td className="p-2 border-r border-gray-200 dark:border-slate-600 text-center text-xs font-mono font-bold text-gray-600 dark:text-gray-300">
                              100%
                            </td>

                            {/* 12 Tháng KMP */}
                            {renderMonthCell(kmp.months[1])}
                            {renderMonthCell(kmp.months[2])}
                            {renderMonthCell(kmp.months[3])}
                            <td className="p-2 text-right font-mono font-bold bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 border-r border-gray-200 dark:border-slate-600">
                              {formatMoney(kmp.q1)}
                            </td>

                            {renderMonthCell(kmp.months[4])}
                            {renderMonthCell(kmp.months[5])}
                            {renderMonthCell(kmp.months[6])}
                            <td className="p-2 text-right font-mono font-bold bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 border-r border-gray-200 dark:border-slate-600">
                              {formatMoney(kmp.q2)}
                            </td>

                            {renderMonthCell(kmp.months[7])}
                            {renderMonthCell(kmp.months[8])}
                            {renderMonthCell(kmp.months[9])}
                            <td className="p-2 text-right font-mono font-bold bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 border-r border-gray-200 dark:border-slate-600">
                              {formatMoney(kmp.q3)}
                            </td>

                            {renderMonthCell(kmp.months[10])}
                            {renderMonthCell(kmp.months[11])}
                            {renderMonthCell(kmp.months[12])}
                            <td className="p-2 text-right font-mono font-bold bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 border-r border-gray-200 dark:border-slate-600">
                              {formatMoney(kmp.q4)}
                            </td>

                            {/* Cả năm, Cùng kỳ, Chênh lệch */}
                            <td className="p-2 text-right font-mono font-bold bg-amber-50/40 dark:bg-amber-950/20 text-[#D97706] border-r border-gray-200 dark:border-slate-600">
                              {formatMoney(kmp.yearTotal)}
                            </td>
                            <td className="p-2 text-right font-mono text-gray-500 border-r border-gray-200 dark:border-slate-600">
                              {kmp.priorYearTotal > 0 ? formatMoney(kmp.priorYearTotal) : '—'}
                            </td>
                            <td className={`p-2 text-right font-mono font-semibold border-r border-gray-200 dark:border-slate-600 ${
                              kmp.variance > 0 ? 'text-amber-600' : kmp.variance < 0 ? 'text-emerald-600' : 'text-gray-400'
                            }`}>
                              {kmp.priorYearTotal > 0 ? (kmp.variance > 0 ? `+${formatMoney(kmp.variance)}` : formatMoney(kmp.variance)) : '—'}
                            </td>
                            <td className={`p-2 text-center font-mono font-semibold text-xs ${
                              kmp.percentChange === null ? 'text-gray-400' : kmp.percentChange > 0 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {formatPercent(kmp.percentChange)}
                            </td>
                          </tr>

                          {/* DÒNG CON PHÂN BỔ BUNG MỞ (Thương hiệu / Showroom con) */}
                          {isExpanded && (kmp.children || []).map(child => (
                            <tr key={child.id} className="bg-slate-50/80 dark:bg-slate-900/60 text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-slate-800 text-[11.5px]">
                              <td className="p-1.5 text-center font-mono text-gray-400 text-[10px] sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700">
                                {child.stt}
                              </td>
                              <td className="p-1.5 pl-8 sticky left-12 z-10 bg-slate-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 truncate font-medium">
                                <span className="text-amber-600 dark:text-amber-400 mr-1.5">↳</span>
                                <span title={child.name}>{child.name}</span>
                              </td>
                              <td className="p-1.5 border-r border-gray-200 dark:border-slate-700 text-center text-gray-400 font-mono text-[10px]">-</td>
                              
                              {/* Tỷ lệ % tính động của dòng con */}
                              <td className="p-1.5 border-r border-gray-200 dark:border-slate-700 text-center font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50/40">
                                {child.allocationPercent !== null && child.allocationPercent !== undefined
                                  ? `${child.allocationPercent.toFixed(1)}%`
                                  : '—'}
                              </td>

                              {/* 12 Tháng dòng con */}
                              {renderMonthCell(child.months[1])}
                              {renderMonthCell(child.months[2])}
                              {renderMonthCell(child.months[3])}
                              <td className="p-1.5 text-right font-mono text-blue-800 dark:text-blue-300 border-r border-gray-200 dark:border-slate-700">
                                {formatMoney(child.q1)}
                              </td>

                              {renderMonthCell(child.months[4])}
                              {renderMonthCell(child.months[5])}
                              {renderMonthCell(child.months[6])}
                              <td className="p-1.5 text-right font-mono text-blue-800 dark:text-blue-300 border-r border-gray-200 dark:border-slate-700">
                                {formatMoney(child.q2)}
                              </td>

                              {renderMonthCell(child.months[7])}
                              {renderMonthCell(child.months[8])}
                              {renderMonthCell(child.months[9])}
                              <td className="p-1.5 text-right font-mono text-blue-800 dark:text-blue-300 border-r border-gray-200 dark:border-slate-700">
                                {formatMoney(child.q3)}
                              </td>

                              {renderMonthCell(child.months[10])}
                              {renderMonthCell(child.months[11])}
                              {renderMonthCell(child.months[12])}
                              <td className="p-1.5 text-right font-mono text-blue-800 dark:text-blue-300 border-r border-gray-200 dark:border-slate-700">
                                {formatMoney(child.q4)}
                              </td>

                              <td className="p-1.5 text-right font-mono font-bold text-amber-800 dark:text-amber-300 border-r border-gray-200 dark:border-slate-700">
                                {formatMoney(child.yearTotal)}
                              </td>
                              <td className="p-1.5 text-right font-mono text-gray-400 border-r border-gray-200 dark:border-slate-700">
                                {child.priorYearTotal > 0 ? formatMoney(child.priorYearTotal) : '—'}
                              </td>
                              <td className="p-1.5 text-right font-mono text-gray-500 border-r border-gray-200 dark:border-slate-700">
                                {child.priorYearTotal > 0 ? (child.variance > 0 ? `+${formatMoney(child.variance)}` : formatMoney(child.variance)) : '—'}
                              </td>
                              <td className="p-1.5 text-center font-mono text-gray-500 text-[10.5px]">
                                {formatPercent(child.percentChange)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Table Footer: TỔNG CỘNG TOÀN BỘ CHI PHÍ */}
            <tfoot className="sticky bottom-0 z-20 bg-amber-100 dark:bg-amber-950 font-black text-gray-900 dark:text-gray-100 border-t-2 border-[#D97706] shadow-lg">
              <tr>
                <td className="p-3 text-center sticky left-0 z-30 bg-amber-100 dark:bg-amber-950 border-r border-amber-200 dark:border-amber-800">
                  TỔNG
                </td>
                <td className="p-3 sticky left-12 z-30 bg-amber-100 dark:bg-amber-950 border-r border-amber-200 dark:border-amber-800 uppercase tracking-tight text-[#D97706]">
                  TỔNG CỘNG CHI PHÍ
                </td>
                <td className="p-2 border-r border-amber-200 dark:border-amber-800 text-center font-mono"></td>
                <td className="p-2 border-r border-amber-200 dark:border-amber-800 text-center font-mono">100%</td>

                {/* 12 Tháng Footer */}
                {renderMonthCell(matrixResult.summary.months[1], true)}
                {renderMonthCell(matrixResult.summary.months[2], true)}
                {renderMonthCell(matrixResult.summary.months[3], true)}
                <td className="p-2 text-right font-mono font-black text-blue-950 dark:text-blue-200 border-r border-amber-200 dark:border-amber-800">
                  {formatMoney(matrixResult.summary.q1)}
                </td>

                {renderMonthCell(matrixResult.summary.months[4], true)}
                {renderMonthCell(matrixResult.summary.months[5], true)}
                {renderMonthCell(matrixResult.summary.months[6], true)}
                <td className="p-2 text-right font-mono font-black text-blue-950 dark:text-blue-200 border-r border-amber-200 dark:border-amber-800">
                  {formatMoney(matrixResult.summary.q2)}
                </td>

                {renderMonthCell(matrixResult.summary.months[7], true)}
                {renderMonthCell(matrixResult.summary.months[8], true)}
                {renderMonthCell(matrixResult.summary.months[9], true)}
                <td className="p-2 text-right font-mono font-black text-blue-950 dark:text-blue-200 border-r border-amber-200 dark:border-amber-800">
                  {formatMoney(matrixResult.summary.q3)}
                </td>

                {renderMonthCell(matrixResult.summary.months[10], true)}
                {renderMonthCell(matrixResult.summary.months[11], true)}
                {renderMonthCell(matrixResult.summary.months[12], true)}
                <td className="p-2 text-right font-mono font-black text-blue-950 dark:text-blue-200 border-r border-amber-200 dark:border-amber-800">
                  {formatMoney(matrixResult.summary.q4)}
                </td>

                {/* Cả năm, Cùng kỳ, Chênh lệch */}
                <td className="p-2 text-right font-mono font-black text-[#D97706] text-sm border-r border-amber-200 dark:border-amber-800">
                  {formatMoney(matrixResult.summary.yearTotal)}
                </td>
                <td className="p-2 text-right font-mono text-gray-700 dark:text-gray-300 border-r border-amber-200 dark:border-amber-800">
                  {matrixResult.summary.priorYearTotal > 0 ? formatMoney(matrixResult.summary.priorYearTotal) : '—'}
                </td>
                <td className={`p-2 text-right font-mono font-black border-r border-amber-200 dark:border-amber-800 ${
                  matrixResult.summary.variance > 0 ? 'text-amber-700' : matrixResult.summary.variance < 0 ? 'text-emerald-700' : 'text-gray-700'
                }`}>
                  {matrixResult.summary.priorYearTotal > 0 ? (matrixResult.summary.variance > 0 ? `+${formatMoney(matrixResult.summary.variance)}` : formatMoney(matrixResult.summary.variance)) : '—'}
                </td>
                <td className={`p-2 text-center font-mono font-black text-xs ${
                  matrixResult.summary.percentChange === null ? 'text-gray-400' : matrixResult.summary.percentChange > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {formatPercent(matrixResult.summary.percentChange)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
