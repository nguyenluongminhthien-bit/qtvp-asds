// src/components/report/ReportFilterBar.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReportFilter } from '../../constants/reportTemplates';
import { DonVi } from '../../types';
import { buildHierarchicalOptions, getUnitEmoji } from '../../utils/hierarchy';
import { Calendar, Building, ListFilter, SlidersHorizontal } from 'lucide-react';

interface ReportFilterBarProps {
  filters: ReportFilter[];
  values: Record<string, any>;
  onChange: (key: string, val: any) => void;
  donViList: DonVi[];
  dynamicOptions?: Record<string, string[]>;
}

// Helper Component cho Multi-select Dropdown (bấm vào có danh sách xổ xuống)
interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  subjectLabel?: string;
}

function MultiSelectDropdown({ options, selectedValues, onChange, placeholder, subjectLabel }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(v => v !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  const subject = subjectLabel || 'Bộ phận';
  const subjectLower = subject.toLowerCase();

  const getSelectedText = () => {
    if (selectedValues.length === 0) return placeholder || `-- Tất cả ${subject} --`;
    if (isAllSelected) return `Tất cả (${options.length}) ${subject}`;
    return `Đã chọn (${selectedValues.length}) ${subjectLower}`;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-xs font-semibold text-gray-800 bg-[#FFFFF0] flex items-center justify-between min-h-[34px] text-left"
      >
        <span className="truncate">{getSelectedText()}</span>
        <span className="text-gray-400 text-[10px] ml-1 shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-[#FFFFF0] border border-gray-200 rounded-lg shadow-lg z-50 max-h-[220px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {options.length === 0 ? (
            <span className="text-[10px] text-gray-400 italic block p-1 text-center">Không có dữ liệu</span>
          ) : (
            <>
              {/* Mục chọn nhanh Tất cả */}
              <label className="flex items-center gap-2 p-1.5 hover:bg-slate-200/60 rounded text-xs font-bold text-[#05469B] cursor-pointer w-full border-b border-gray-200/50 pb-2 mb-1.5">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  className="rounded text-[#05469B] focus:ring-[#05469B] h-3.5 w-3.5"
                />
                <span>Chọn tất cả ({options.length}) {subject}</span>
              </label>

              {options.map(opt => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-slate-200/60 rounded text-xs font-semibold text-gray-700 cursor-pointer w-full">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                      className="rounded text-[#05469B] focus:ring-[#05469B] h-3.5 w-3.5"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface MultiSelectUnitDropdownProps {
  options: { unit: DonVi; prefix: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

function MultiSelectUnitDropdown({ options, selectedValues, onChange, placeholder }: MultiSelectUnitDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleOption = (optId: string) => {
    if (selectedValues.includes(optId)) {
      onChange(selectedValues.filter(v => v !== optId));
    } else {
      onChange([...selectedValues, optId]);
    }
  };

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  const getSelectedText = () => {
    if (selectedValues.length === 0) return placeholder || "-- Tất cả Đơn vị ban hành --";
    if (isAllSelected) return `Tất cả (${options.length}) Đơn vị`;
    return `Đã chọn (${selectedValues.length}) Đơn vị`;
  };

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(options.map(o => o.unit.id));
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-xs font-semibold text-gray-800 bg-[#FFFFF0] flex items-center justify-between min-h-[34px] text-left"
      >
        <span className="truncate">{getSelectedText()}</span>
        <span className="text-gray-400 text-[10px] ml-1 shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-[#FFFFF0] border border-gray-200 rounded-lg shadow-lg z-50 max-h-[220px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {options.length === 0 ? (
            <span className="text-[10px] text-gray-400 italic block p-1 text-center">Không có dữ liệu</span>
          ) : (
            <>
              <label className="flex items-center gap-2 p-1.5 hover:bg-slate-200/60 rounded text-xs font-bold text-[#05469B] cursor-pointer w-full border-b border-gray-200/50 pb-2 mb-1.5">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  className="rounded text-[#05469B] focus:ring-[#05469B] h-3.5 w-3.5"
                />
                <span>Chọn tất cả ({options.length}) Đơn vị</span>
              </label>
              {options.map(opt => {
                const isChecked = selectedValues.includes(opt.unit.id);
                return (
                  <label key={opt.unit.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-200/60 rounded text-xs font-semibold text-gray-700 cursor-pointer w-full">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.unit.id)}
                      className="rounded text-[#05469B] focus:ring-[#05469B] h-3.5 w-3.5"
                    />
                    <span className="font-mono text-gray-400 shrink-0 select-none">{opt.prefix}</span>
                    <span>{getUnitEmoji(opt.unit.loai_hinh)} {opt.unit.ten_don_vi}</span>
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportFilterBar({
  filters,
  values,
  onChange,
  donViList,
  dynamicOptions
}: ReportFilterBarProps) {
  const cleanDonViList = useMemo(() => {
    return (donViList || []).filter(u => String(u.trang_thai || '').trim() !== 'Đại lý');
  }, [donViList]);

  // Sắp xếp đơn vị theo dạng cây thụt lề
  const unitOptions = buildHierarchicalOptions(cleanDonViList);

  const parentUnitOptions = useMemo(() => {
    const parents = cleanDonViList.filter(u => {
      const lh = String(u.loai_hinh || '').toLowerCase().trim();
      return !lh.includes('showroom') && !lh.includes('kho') && !lh.includes('xưởng') && !lh.includes('điểm bán') && !lh.includes('điểm kinh doanh');
    });
    return buildHierarchicalOptions(parents);
  }, [cleanDonViList]);

  const years = useMemo(() => {
    if (dynamicOptions?.year && dynamicOptions.year.length > 0) {
      return dynamicOptions.year;
    }
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  }, [dynamicOptions]);

  // Xác định xem có phải báo cáo văn bản để áp dụng tỉ lệ 20% - 30% - 20% - 30% trên 1 dòng
  const isDocReport = filters.some(f => f.key === 'bo_phan_lay_so') && filters.length === 4;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <SlidersHorizontal size={16} className="text-[#05469B]" />
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Cấu hình Bộ lọc dữ liệu</h4>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full">
        {filters.map((filter) => {
          const value = values[filter.key] || '';

          // Tính style chiều rộng theo tỉ lệ yêu cầu cho báo cáo Văn bản
          let itemStyle: React.CSSProperties = { flex: '1 1 200px' };
          if (isDocReport) {
            if (filter.key === 'year') itemStyle = { flex: '0 0 calc(20% - 12px)', minWidth: '100px' };
            if (filter.key === 'id_don_vi') itemStyle = { flex: '0 0 calc(30% - 12px)', minWidth: '150px' };
            if (filter.key === 'phan_loai') itemStyle = { flex: '0 0 calc(20% - 12px)', minWidth: '100px' };
            if (filter.key === 'bo_phan_lay_so') itemStyle = { flex: '0 0 calc(30% - 12px)', minWidth: '150px' };
          }

          switch (filter.type) {
            case 'unit':
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Building size={12} className="text-[#05469B]" /> {filter.label}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-xs font-semibold text-gray-800 bg-[#FFFFF0] min-h-[34px]"
                  >
                    <option value="">-- Tất cả Đơn vị / Showroom --</option>
                    {unitOptions.map((opt) => (
                      <option key={opt.unit.id} value={opt.unit.id}>
                        {opt.prefix}{getUnitEmoji(opt.unit.loai_hinh)} {opt.unit.ten_don_vi}
                      </option>
                    ))}
                  </select>
                </div>
              );

            case 'daterange':
              const startDate = values[`${filter.key}_start`] || '';
              const endDate = values[`${filter.key}_end`] || '';
              return (
                <React.Fragment key={filter.key}>
                  <div className="flex flex-col gap-1" style={{ flex: '1 1 150px' }}>
                    <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                      <Calendar size={12} className="text-emerald-500" /> {filter.label} (Từ)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => onChange(`${filter.key}_start`, e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold text-gray-800 bg-[#FFFFF0] min-h-[34px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1" style={{ flex: '1 1 150px' }}>
                    <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                      <Calendar size={12} className="text-rose-500" /> {filter.label} (Đến)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => onChange(`${filter.key}_end`, e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 text-xs font-semibold text-gray-800 bg-[#FFFFF0] min-h-[34px]"
                    />
                  </div>
                </React.Fragment>
              );

            case 'select': {
              const optionsList = dynamicOptions?.[filter.key] || filter.options || [];
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <ListFilter size={12} className="text-blue-500" /> {filter.label}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-xs font-semibold text-gray-800 bg-[#FFFFF0] min-h-[34px]"
                  >
                    {!optionsList.includes('Tất cả') && (
                      <option value="">Tất cả ({filter.label})</option>
                    )}
                    {optionsList.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            case 'year':
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-[#05469B]" /> {filter.label}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-xs font-semibold text-gray-800 bg-[#FFFFF0] min-h-[34px]"
                  >
                    <option value="">Tất cả các năm</option>
                    {years.map((yr) => (
                      <option key={yr} value={yr}>
                        Năm {yr}
                      </option>
                    ))}
                  </select>
                </div>
              );

            case 'year_multi':
              const selectedYearVals = Array.isArray(value) ? value : (value ? [String(value)] : []);
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-[#05469B]" /> {filter.label}
                  </label>
                  <MultiSelectDropdown
                    options={years.map(String)}
                    selectedValues={selectedYearVals}
                    onChange={(vals) => onChange(filter.key, vals)}
                    placeholder="-- Tất cả các năm --"
                    subjectLabel="năm"
                  />
                </div>
              );

            case 'multiselect':
              const opts = dynamicOptions?.[filter.key] || filter.options || [];
              const selectedVals = Array.isArray(value) ? value : (value ? [String(value)] : []);
              const placeholderText = filter.key === 'phan_loai'
                ? '-- Tất cả Loại văn bản --'
                : filter.key === 'loai_hinh'
                ? '-- Tất cả Loại hình --'
                : '-- Chọn bộ phận lấy số --';
              const subjectText = filter.key === 'phan_loai'
                ? 'loại'
                : filter.key === 'loai_hinh'
                ? 'Loại hình'
                : 'Bộ phận';
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <ListFilter size={12} className="text-indigo-500" /> {filter.label}
                  </label>
                  <MultiSelectDropdown
                    options={opts}
                    selectedValues={selectedVals}
                    onChange={(newVals) => onChange(filter.key, newVals)}
                    placeholder={placeholderText}
                    subjectLabel={subjectText}
                  />
                </div>
              );

            case 'text':
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase">
                    {filter.label}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    placeholder={filter.placeholder || "Nhập từ khóa..."}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#05469B] text-xs font-semibold text-gray-800 bg-[#FFFFF0] min-h-[34px]"
                  />
                </div>
              );

            case 'unit_multi':
              const selectedUnitVals = Array.isArray(value) ? value : (value ? [String(value)] : []);
              return (
                <div key={filter.key} className="flex flex-col gap-1" style={itemStyle}>
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Building size={12} className="text-[#05469B]" /> {filter.label}
                  </label>
                  <MultiSelectUnitDropdown
                    options={parentUnitOptions}
                    selectedValues={selectedUnitVals}
                    onChange={(vals) => onChange(filter.key, vals)}
                    placeholder="-- Tất cả Đơn vị --"
                  />
                </div>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
