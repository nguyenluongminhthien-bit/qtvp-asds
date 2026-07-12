// src/components/report/ReportConfigPanel.tsx
import React from 'react';
import { ReportTemplate } from '../../constants/reportTemplates';
import { DonVi } from '../../types';
import ReportFilterBar from './ReportFilterBar';
import { FileSpreadsheet, Eye, ArrowLeft, RefreshCw } from 'lucide-react';

interface ReportConfigPanelProps {
  template: ReportTemplate;
  filters: Record<string, any>;
  onFilterChange: (key: string, val: any) => void;
  onResetFilters: () => void;
  onPreview: () => void;
  onExport: () => void;
  onBack: () => void;
  donViList: DonVi[];
  loading: boolean;
  previewReady: boolean;
  dynamicOptions?: Record<string, string[]>;
}

export default function ReportConfigPanel({
  template,
  filters,
  onFilterChange,
  onResetFilters,
  onPreview,
  onExport,
  onBack,
  donViList,
  loading,
  previewReady,
  dynamicOptions
}: ReportConfigPanelProps) {
  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-gray-200/60 shadow-xs space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 text-gray-500 hover:text-gray-800 rounded-xl transition-colors border border-gray-200/60 bg-white"
            title="Quay lại danh sách"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 text-[9px] font-black tracking-widest bg-blue-100 text-blue-700 rounded-md uppercase border border-blue-200/50">{template.module}</span>
              <h2 className="text-base font-black text-gray-800">{template.title}</h2>
            </div>
            <p className="text-xs text-gray-500 font-bold leading-relaxed">{template.description}</p>
          </div>
        </div>

        <button
          onClick={onResetFilters}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-200 text-xs font-bold text-gray-600 transition-colors bg-white shrink-0 self-start sm:self-center"
        >
          <RefreshCw size={12} /> Thiết lập lại bộ lọc
        </button>
      </div>

      {/* Render Dynamic Filter Bar */}
      <ReportFilterBar
        filters={template.filters}
        values={filters}
        onChange={onFilterChange}
        donViList={donViList}
        dynamicOptions={dynamicOptions}
      />

      {/* Buttons Action */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onPreview}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 text-xs"
        >
          <Eye size={14} className="text-[#05469B]" /> 
          {loading ? 'Đang truy vấn...' : 'Xem trước Báo cáo'}
        </button>

        <button
          onClick={onExport}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 bg-[#05469B] hover:bg-[#04367a] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 text-xs"
        >
          <FileSpreadsheet size={14} /> Xuất Báo cáo Excel
        </button>
      </div>
    </div>
  );
}
