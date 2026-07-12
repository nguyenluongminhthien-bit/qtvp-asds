// src/components/report/ReportPreviewTable.tsx
import React, { useState, useMemo } from 'react';
import { ReportColumn } from '../../constants/reportTemplates';
import { formatCell } from '../../utils/exportReports';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

interface ReportPreviewTableProps {
  data: any[];
  columns: ReportColumn[];
  visibleColumns: string[];
  donViMap: Record<string, string>;
  templateId?: string;
}

export default function ReportPreviewTable({
  data,
  columns,
  visibleColumns,
  donViMap,
  templateId
}: ReportPreviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDocTab, setActiveDocTab] = useState<string>('Tất cả');
  const itemsPerPage = 10;

  const cols = columns.filter(c => visibleColumns.includes(c.key));

  const isDocumentReport = templateId === 'document_list_report' || templateId === 'custom_report_documents';

  // Hàm xác định loại văn bản
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

  // Sắp xếp theo đúng thứ tự thời gian ban hành giảm dần (mới nhất hiển thị trên cùng)
  const sortedData = useMemo(() => {
    if (isDocumentReport) {
      return [...data].sort((a, b) => {
        const dA = a.ngay_ban_hanh ? new Date(a.ngay_ban_hanh).getTime() : 0;
        const dB = b.ngay_ban_hanh ? new Date(b.ngay_ban_hanh).getTime() : 0;
        return dB - dA;
      });
    }
    return data;
  }, [data, isDocumentReport]);

  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sortedData.forEach(item => {
      const type = getDocumentSheetType(item);
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [sortedData]);

  const displayData = useMemo(() => {
    if (!isDocumentReport || activeDocTab === 'Tất cả') {
      return sortedData;
    }
    return sortedData.filter(item => getDocumentSheetType(item) === activeDocTab);
  }, [sortedData, isDocumentReport, activeDocTab]);

  if (data.length === 0) {
    return (
      <div className="bg-white p-12 text-center text-gray-500 rounded-2xl border border-gray-200">
        <Inbox size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="font-semibold text-gray-600">Không có dữ liệu xem trước</p>
        <p className="text-xs text-gray-400 mt-1">Vui lòng thay đổi cấu hình bộ lọc hoặc nguồn dữ liệu và bấm nút xem trước.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(displayData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = displayData.slice(startIndex, startIndex + itemsPerPage);

  const getCellClassName = (key: string, val: any) => {
    let base = "py-3 px-4 text-xs font-semibold text-gray-700 leading-normal align-middle border-b border-gray-100 ";
    
    // Custom highlights
    if (key === 'trang_thai' || key === 'hieu_luc') {
      const vStr = String(val).toLowerCase();
      if (vStr.includes('hết hạn') || vStr.includes('nghỉ việc') || vStr.includes('thôi việc')) {
        return base + "text-rose-600 bg-rose-50/30";
      }
      if (vStr.includes('còn hiệu lực') || vStr.includes('đang làm') || vStr.includes('chính thức')) {
        return base + "text-emerald-600 bg-emerald-50/30";
      }
      if (vStr.includes('sắp hết hạn')) {
        return base + "text-amber-600 bg-amber-50/30";
      }
    }
    if (key === 'cc_atvsld' || key === 'cc_pccc' || key === 'cc_cnch' || key === 'cc_so_cap_cuu') {
      if (val === true || String(val).toLowerCase() === 'true' || val === 1) {
        return base + "text-emerald-600 font-bold bg-emerald-50/20";
      }
      return base + "text-gray-400 font-normal";
    }
    return base;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden space-y-4 p-4">
      <div className="flex flex-col gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">
            Xem trước Bảng dữ liệu ({displayData.length} dòng{isDocumentReport && activeDocTab !== 'Tất cả' ? ` - ${activeDocTab}` : ''})
          </h3>
          <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded border border-blue-100 uppercase">
            Trang {currentPage}/{totalPages}
          </span>
        </div>

        {/* TABS PHÂN LOẠI VĂN BẢN */}
        {isDocumentReport && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { id: 'Tất cả', label: 'Tất cả', count: sortedData.length },
              { id: 'Quyết định', label: 'Quyết định', count: docCounts['Quyết định'] || 0 },
              { id: 'Thông báo', label: 'Thông báo', count: docCounts['Thông báo'] || 0 },
              { id: 'Tờ trình', label: 'Tờ trình', count: docCounts['Tờ trình'] || 0 },
              { id: 'Công văn đến', label: 'Công văn đến (CVĐ)', count: docCounts['Công văn đến'] || 0 },
              { id: 'Công văn đi', label: 'Công văn đi (CV)', count: docCounts['Công văn đi'] || 0 }
            ].map(tab => {
              const isActive = activeDocTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveDocTab(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#05469B] text-white shadow-sm shadow-blue-900/20'
                      : 'bg-gray-100/80 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-700 shadow-2xs'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {templateId === 'system_donvi_structure' ? (
              <>
                <tr className="bg-[#05469B] text-white border-b border-blue-900/40 text-xs font-bold uppercase tracking-wider text-center">
                  <th rowSpan={2} className="py-3 px-4 font-black text-[11px] text-white border-r border-blue-900/40 text-left" style={{ width: 60 }}>TT</th>
                  <th rowSpan={2} className="py-3 px-4 font-black text-[11px] text-white border-r border-blue-900/40 text-left" style={{ width: 250 }}>Tên Đơn vị</th>
                  <th colSpan={3} className="py-2.5 px-4 font-black text-[11px] text-white border-r border-blue-900/40 text-center">Tổng Giám đốc</th>
                  <th colSpan={3} className="py-2.5 px-4 font-black text-[11px] text-white border-r border-blue-900/40 text-center">PT QTVP & ASĐS</th>
                  <th colSpan={3} className="py-2.5 px-4 font-black text-[11px] text-white border-r border-blue-900/40 text-center">PT DVHC</th>
                  <th colSpan={3} className="py-2.5 px-4 font-black text-[11px] text-white text-center">PT Nhân sự</th>
                </tr>
                <tr className="bg-[#05469B] text-white border-b border-blue-900/40 text-xs font-bold uppercase tracking-wider text-center">
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Họ tên</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Mail</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">SĐT</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Họ tên</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Mail</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">SĐT</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Họ tên</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Mail</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">SĐT</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Họ tên</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95 border-r border-blue-900/40">Mail</th>
                  <th className="py-2 px-4 font-black text-[10px] text-white/95">SĐT</th>
                </tr>
              </>
            ) : (
              <tr className="bg-slate-50 border-b border-gray-200/60 text-xs font-bold text-gray-600 uppercase tracking-wider">
                {cols.map((c) => (
                  <th key={c.key} className="py-3 px-4 font-black text-[11px] text-gray-600" style={{ width: c.width }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={cols.length || 10} className="py-10 text-center text-gray-400 italic text-xs">
                  Không có văn bản nào thuộc nhóm "{activeDocTab}"
                </td>
              </tr>
            ) : (
              paginatedData.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  {cols.map((c, cellIdx) => {
                    let cellVal = item[c.key];
                    if (c.key === 'id_don_vi') cellVal = donViMap[String(cellVal)] || cellVal;
                    
                    const isLastCell = cellIdx === cols.length - 1;
                    const borderClass = (templateId === 'system_donvi_structure' && !isLastCell) ? " border-r border-gray-100" : "";
                    
                    return (
                      <td key={c.key} className={getCellClassName(c.key, item[c.key]) + borderClass}>
                        {formatCell(cellVal, c.format)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-gray-500"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg transition-colors ${
                  currentPage === p
                    ? 'bg-[#05469B] text-white shadow-xs'
                    : 'border border-gray-200 hover:bg-gray-100 text-gray-600 bg-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-gray-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
