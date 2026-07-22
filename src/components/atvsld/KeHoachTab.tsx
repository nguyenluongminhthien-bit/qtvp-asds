import React from 'react';
import { Search, FileSpreadsheet, HelpCircle, AlertTriangle, CheckCheck } from 'lucide-react';
import Pagination from '../ui/Pagination';

interface KeHoachTabProps {
  statusFilter: 'ALL' | 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN';
  setStatusFilter: (status: 'ALL' | 'CHUA_HOC' | 'QUA_HAN' | 'SAP_HET_HAN' | 'AN_TOAN') => void;
  safetySearchTerm: string;
  setSafetySearchTerm: (term: string) => void;
  nhomFilter: string;
  setNhomFilter: (nhom: string) => void;
  safetySummaryCounts: { total: number; chua_hoc: number; qua_han: number; sap_het_han: number; an_toan: number };
  paginatedSafetyList: any[];
  selectedSafetyIds: string[];
  totalSafetyPages: number;
  currentSafetyPage: number;
  setCurrentSafetyPage: (page: number) => void;
  rowsPerSafetyPage: number;
  setRowsPerSafetyPage: (rows: number) => void;
  filteredSafetyList: any[];
  exportSafetyPlanToExcel: () => void;
  handleSelectAllSafety: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectSafetyRow: (id: string, checked: boolean) => void;
  isListCollapsed: boolean;
}

export default function KeHoachTab({
  statusFilter,
  setStatusFilter,
  safetySearchTerm,
  setSafetySearchTerm,
  nhomFilter,
  setNhomFilter,
  safetySummaryCounts,
  paginatedSafetyList,
  selectedSafetyIds,
  totalSafetyPages,
  currentSafetyPage,
  setCurrentSafetyPage,
  rowsPerSafetyPage,
  setRowsPerSafetyPage,
  filteredSafetyList,
  exportSafetyPlanToExcel,
  handleSelectAllSafety,
  handleSelectSafetyRow,
  isListCollapsed
}: KeHoachTabProps) {
  return (
    <div className={`transition-all duration-300 flex flex-col h-full ${isListCollapsed ? 'md:ml-10 lg:ml-0' : ''}`}>
      
      {/* KHỐI 4 THẸ CHỈ SỐ KPI TÌNH TRẠNG THẺ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5 shrink-0">
        <div
          onClick={() => setStatusFilter('CHUA_HOC')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
            statusFilter === 'CHUA_HOC' 
              ? 'border-red-500 bg-red-50/20 ring-2 ring-red-400 shadow-md' 
              : 'border-red-200 bg-white hover:border-red-500 hover:shadow-md'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <HelpCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chưa huấn luyện</p>
            <p className="text-2xl font-black text-red-600">{safetySummaryCounts.chua_hoc}</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('QUA_HAN')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
            statusFilter === 'QUA_HAN' 
              ? 'border-gray-800 bg-gray-100 ring-2 ring-gray-400 shadow-md' 
              : 'border-gray-300 bg-white hover:border-gray-800 hover:shadow-md'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-800 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Đã quá hạn thẻ</p>
            <p className="text-2xl font-black text-gray-900">{safetySummaryCounts.qua_han}</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('SAP_HET_HAN')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
            statusFilter === 'SAP_HET_HAN' 
              ? 'border-orange-500 bg-orange-50/20 ring-2 ring-orange-400 shadow-md' 
              : 'border-orange-200 bg-white hover:border-orange-500 hover:shadow-md'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Sắp hết hạn (&lt;60 ngày)</p>
            <p className="text-2xl font-black text-orange-600">{safetySummaryCounts.sap_het_han}</p>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('AN_TOAN')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
            statusFilter === 'AN_TOAN' 
              ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-400 shadow-md' 
              : 'border-emerald-200 bg-white hover:border-emerald-500 hover:shadow-md'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Thẻ hợp lệ (An toàn)</p>
            <p className="text-2xl font-black text-emerald-600">{safetySummaryCounts.an_toan}</p>
          </div>
        </div>
      </div>

      {/* THANH THAO TÁC, BỘ LỌC VÀ NÚT XUẤT EXCEL */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Tìm Mã NV, Họ tên..."
              value={safetySearchTerm}
              onChange={(e) => setSafetySearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={nhomFilter}
            onChange={(e) => setNhomFilter(e.target.value)}
            className="py-1.5 px-3 border border-gray-200 rounded text-xs text-gray-700 outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">-- Tất cả nhóm --</option>
            <option value="1">Nhóm 1</option>
            <option value="2">Nhóm 2</option>
            <option value="3">Nhóm 3</option>
            <option value="4">Nhóm 4</option>
            <option value="6">Nhóm 6</option>
          </select>

          {statusFilter !== 'ALL' && (
            <button
              onClick={() => setStatusFilter('ALL')}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
            >
              Xóa lọc (Đang xem: {statusFilter})
            </button>
          )}
        </div>

        <button
          onClick={exportSafetyPlanToExcel}
          disabled={selectedSafetyIds.length === 0}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors cursor-pointer"
        >
          <FileSpreadsheet size={16} /> Xuất danh sách huấn luyện đợt tới ({selectedSafetyIds.length})
        </button>
      </div>

      {/* BẢNG SỐ LIỆU CHI TIẾT DANH SÁCH NHÂN SỰ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto w-full flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
            <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
              <tr className="border-b border-gray-200 font-bold text-gray-600 uppercase">
                <th className="p-3 text-center w-12">
                  <input
                    type="checkbox"
                    onChange={handleSelectAllSafety}
                    checked={paginatedSafetyList.length > 0 && paginatedSafetyList.every((p) => selectedSafetyIds.includes(p.id))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
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
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                    Không tìm thấy nhân sự nào thuộc diện cần quét.
                  </td>
                </tr>
              ) : (
                paginatedSafetyList.map((p) => {
                  let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  let badgeText = 'Hợp lệ';
                  if (p.trainingStatus === 'CHUA_HOC') {
                    badgeClass = 'bg-red-100 text-red-700 border-red-200';
                    badgeText = 'Chưa học';
                  } else if (p.trainingStatus === 'QUA_HAN') {
                    badgeClass = 'bg-gray-100 text-gray-700 border-gray-300 font-bold';
                    badgeText = 'Quá hạn';
                  } else if (p.trainingStatus === 'SAP_HET_HAN') {
                    badgeClass = 'bg-orange-100 text-orange-800 border-orange-200 animate-pulse';
                    badgeText = `Còn ${p.remainingDays} ngày`;
                  }

                  return (
                    <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedSafetyIds.includes(p.id)}
                          onChange={(e) => handleSelectSafetyRow(p.id, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold text-gray-700">{p.ma_so_nhan_vien}</td>
                      <td className="p-3 font-bold text-[#05469B]">{p.ho_ten}</td>
                      <td className="p-3">
                        <p className="font-semibold text-gray-800">{p.donViText}</p>
                        <p className="text-[10px] text-gray-400">
                          {p.showroomText} • {p.phiaText}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-gray-700">{p.phong_ban || '---'}</p>
                        <p className="text-[10px] text-gray-500 text-slate-500">
                          {p.chuc_vu} ({p.phan_loai})
                        </p>
                      </td>
                      <td className="p-3 text-center font-bold text-[#05469B] text-sm">{p.nhom_doi_tuong || '---'}</td>
                      <td className="p-3 text-center font-mono font-semibold text-gray-600">
                        {p.gia_tri_den ? new Date(p.gia_tri_den).toLocaleDateString('vi-VN') : '---'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block min-w-[64px] ${badgeClass}`}>
                          {badgeText}
                        </span>
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
  );
}
