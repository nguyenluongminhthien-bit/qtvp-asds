import React, { useState, useMemo, useEffect } from 'react';
import { 
  Layers, Columns3, Rows3, Calculator, Filter, X, Plus, 
  ChevronRight, ChevronDown, Lock, HelpCircle, ArrowUpDown, 
  Check, Sparkles, AlertTriangle, GripVertical, Calendar, 
  Building2, Coins, SlidersHorizontal, Search
} from 'lucide-react';
import { PivotLayoutConfig } from '../../../types';
import { 
  PivotFlatRecord, PivotFieldKey, PIVOT_AVAILABLE_FIELDS, 
  computePivotMatrix, getRecordFieldValue, PivotNode 
} from './pivotEngine';

interface Props {
  records: PivotFlatRecord[];
  layout: PivotLayoutConfig;
  onChangeLayout: (newLayout: PivotLayoutConfig) => void;
  isLocked: boolean;
  canClone?: boolean;
}

interface DragItemState {
  fieldKey: PivotFieldKey;
  fromZone: 'available' | 'rows' | 'cols' | 'filters';
  index?: number;
}

export default function CostPivotBuilder({
  records,
  layout,
  onChangeLayout,
  isLocked,
  canClone = true
}: Props) {
  // Trạng thái thu gọn/bung mở các nút cha trên bảng
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  // Trạng thái mở popup bộ lọc cho từng field
  const [activeFilterField, setActiveFilterField] = useState<string | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState<{
    top: number;
    right: number;
    width: number;
    openUpwards?: boolean;
  } | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState<string>('');

  // Tự động đóng dropdown khi cuộn trang ngoài hoặc resize cửa sổ
  useEffect(() => {
    if (!activeFilterField) return;
    const handleScrollOrResize = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.filter-dropdown-container')) return;
      setActiveFilterField(null);
      setFilterDropdownPos(null);
      setFilterSearchTerm('');
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeFilterField]);

  // Trạng thái Kéo - Thả chuyên nghiệp
  const [draggedItem, setDraggedItem] = useState<DragItemState | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'rows' | 'cols' | 'filters' | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  const toggleCollapse = (key: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Tính toán bảng Pivot thời gian thực
  const tableData = useMemo(() => {
    return computePivotMatrix(records, layout);
  }, [records, layout]);

  // Các nhóm trường khả dụng
  const fieldGroups = useMemo(() => [
    {
      category: 'Thời gian' as const,
      icon: Calendar,
      title: 'Thời gian',
      colorIcon: 'text-sky-600 dark:text-sky-400',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
      fields: PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Thời gian')
    },
    {
      category: 'Công ty' as const,
      icon: Building2,
      title: 'Công ty',
      colorIcon: 'text-indigo-600 dark:text-indigo-400',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
      fields: PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Công ty')
    },
    {
      category: 'Chi phí' as const,
      icon: Coins,
      title: 'Chi phí',
      colorIcon: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
      fields: PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Chi phí')
    }
  ], []);

  // Thao tác thêm trường vào Rows / Cols / Filters
  const handleAddField = (fieldKey: PivotFieldKey, zone: 'rows' | 'cols' | 'filters') => {
    if (isLocked) return;
    const clone = { ...layout, rows: [...layout.rows], cols: [...layout.cols], filters: { ...(layout.filters || {}) } };
    if (zone === 'rows') {
      if (!clone.rows.includes(fieldKey)) {
        clone.rows.push(fieldKey);
      }
    } else if (zone === 'cols') {
      if (!clone.cols.includes(fieldKey)) {
        clone.cols.push(fieldKey);
      }
    } else if (zone === 'filters') {
      if (!clone.filters[fieldKey]) {
        clone.filters[fieldKey] = [];
      }
    }
    onChangeLayout(clone);
  };

  // Thao tác xóa trường khỏi Rows / Cols / Filters
  const handleRemoveField = (fieldKey: string, zone: 'rows' | 'cols' | 'filters') => {
    if (isLocked) return;
    const clone = { ...layout, rows: [...layout.rows], cols: [...layout.cols], filters: { ...(layout.filters || {}) } };
    if (zone === 'rows') {
      clone.rows = clone.rows.filter(f => f !== fieldKey);
    } else if (zone === 'cols') {
      clone.cols = clone.cols.filter(f => f !== fieldKey);
    } else if (zone === 'filters') {
      if (activeFilterField === fieldKey) {
        setActiveFilterField(null);
        setFilterDropdownPos(null);
        setFilterSearchTerm('');
      }
      if (clone.filters) {
        delete clone.filters[fieldKey];
      }
    }
    onChangeLayout(clone);
  };

  // Thao tác Thả (Drop) vào từng Zone (Hàng / Cột / Lọc)
  const handleDropToZone = (targetZone: 'rows' | 'cols' | 'filters', targetIndex?: number | null) => {
    if (isLocked || !draggedItem) return;
    const { fieldKey, fromZone, index: sourceIndex } = draggedItem;

    const clone: PivotLayoutConfig = {
      ...layout,
      rows: [...(layout.rows || [])],
      cols: [...(layout.cols || [])],
      filters: { ...(layout.filters || {}) }
    };

    if (targetZone === 'rows') {
      if (fromZone === 'rows') {
        // Kéo sắp xếp lại thứ tự cấp trong Hàng (Rows)
        if (sourceIndex !== undefined && targetIndex !== null && targetIndex !== undefined && sourceIndex !== targetIndex) {
          const [moved] = clone.rows.splice(sourceIndex, 1);
          clone.rows.splice(targetIndex, 0, moved);
        }
      } else {
        // Chuyển từ Cột hoặc Lọc sang Hàng
        if (fromZone === 'cols') {
          clone.cols = clone.cols.filter(f => f !== fieldKey);
        } else if (fromZone === 'filters') {
          delete clone.filters[fieldKey];
        }
        if (!clone.rows.includes(fieldKey)) {
          if (targetIndex !== null && targetIndex !== undefined) {
            clone.rows.splice(targetIndex, 0, fieldKey);
          } else {
            clone.rows.push(fieldKey);
          }
        }
      }
    } else if (targetZone === 'cols') {
      if (fromZone === 'rows') {
        clone.rows = clone.rows.filter(f => f !== fieldKey);
      } else if (fromZone === 'filters') {
        delete clone.filters[fieldKey];
      }
      if (!clone.cols.includes(fieldKey)) {
        clone.cols.push(fieldKey);
      }
    } else if (targetZone === 'filters') {
      if (fromZone === 'rows') {
        clone.rows = clone.rows.filter(f => f !== fieldKey);
      } else if (fromZone === 'cols') {
        clone.cols = clone.cols.filter(f => f !== fieldKey);
      }
      if (!clone.filters[fieldKey]) {
        clone.filters[fieldKey] = [];
      }
    }

    setDraggedItem(null);
    setDragOverZone(null);
    setDragOverRowIndex(null);
    onChangeLayout(clone);
  };

  // Lấy các giá trị duy nhất của một trường để hiển thị trong popup lọc (kèm số lượng dòng dữ liệu và sắp xếp theo bảng chữ cái tiếng Việt)
  const getFieldUniqueOptions = (fieldKey: PivotFieldKey) => {
    const map = new Map<string, { label: string; count: number }>();
    records.forEach(r => {
      const { key, label } = getRecordFieldValue(r, fieldKey);
      if (key) {
        if (!map.has(key)) {
          map.set(key, { label: label || key, count: 1 });
        } else {
          map.get(key)!.count += 1;
        }
      }
    });
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, label: v.label, count: v.count }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  };

  // Chọn tất cả hoặc Bỏ chọn tất cả giá trị lọc
  const handleSelectAllFilter = (fieldKey: string, selectAll: boolean) => {
    if (isLocked) return;
    const allOptions = getFieldUniqueOptions(fieldKey as PivotFieldKey);
    const clone = {
      ...layout,
      filters: {
        ...(layout.filters || {}),
        [fieldKey]: selectAll ? allOptions.map(o => o.key) : []
      }
    };
    onChangeLayout(clone);
  };

  // Bật/tắt menu xổ xuống và tính toán vị trí nổi (floating dropdown không bị cắt xén)
  const handleToggleFilterDropdown = (e: React.MouseEvent<HTMLElement>, fKey: string) => {
    if (activeFilterField === fKey) {
      setActiveFilterField(null);
      setFilterDropdownPos(null);
      setFilterSearchTerm('');
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownWidth = 320;
      let right = window.innerWidth - rect.right;
      if (right < 16) right = 16;
      if (window.innerWidth - right < dropdownWidth) {
        right = Math.max(16, window.innerWidth - dropdownWidth - 16);
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < 320 && rect.top > 320;
      const top = openUpwards ? rect.top : rect.bottom + 6;

      setFilterDropdownPos({
        top,
        right,
        width: dropdownWidth,
        openUpwards
      });
      setActiveFilterField(fKey);
      setFilterSearchTerm('');
    }
  };

  const handleToggleFilterOption = (fieldKey: string, optionKey: string) => {
    if (isLocked) return;
    const current = layout.filters?.[fieldKey] || [];
    const next = current.includes(optionKey)
      ? current.filter(k => k !== optionKey)
      : [...current, optionKey];

    const clone = {
      ...layout,
      filters: {
        ...(layout.filters || {}),
        [fieldKey]: next
      }
    };
    onChangeLayout(clone);
  };

  return (
    <div className="flex flex-col space-y-3.5">
      
      {/* 1. KHU VỰC BẢNG ĐIỀU KHIỂN KÉO-THẢ (PIVOT BUILDER PANEL) */}
      <div className={`bg-white dark:bg-slate-800 rounded-2xl p-4 border shadow-xs transition-all ${
        isLocked 
          ? 'border-amber-200/80 dark:border-amber-800/40 bg-amber-50/20' 
          : 'border-gray-200/80 dark:border-slate-700/80'
      }`}>
        
        {/* Banner hướng dẫn khi cấu hình được bảo vệ (chỉ hiển thị cho người có quyền tùy biến) */}
        {isLocked && canClone && (
          <div className="mb-3.5 p-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#D97706] shrink-0" />
              <span>
                Để tùy biến mẫu báo cáo này, vui lòng nhấn <strong>"Báo cáo tuỳ chỉnh"</strong> ở thanh công cụ phía trên.
              </span>
            </div>
          </div>
        )}

        {/* Cụm 4 ô cấu hình: 40% (Trường khả dụng) | 22% (Hàng) | 22% (Cột) | 16% (Bộ lọc) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[40fr_22fr_22fr_16fr] gap-3.5 items-stretch">
          
          {/* Cột 1: Danh sách trường khả dụng (Chiếm 40% độ rộng) */}
          <div className="p-3 bg-gray-50/90 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-[#D97706]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Trường phân tích khả dụng
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                {PIVOT_AVAILABLE_FIELDS.length} trường
              </span>
            </div>

            {/* Gôm nhóm hiển thị: Thời gian | Công ty | Chi phí */}
            <div className="flex flex-col space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {fieldGroups.map(group => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.category} className="flex flex-col space-y-1.5">
                    {/* Tiêu đề nhóm phân loại */}
                    <div className="flex items-center gap-1.5 px-0.5">
                      <GroupIcon size={12} className={group.colorIcon} />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {group.title}
                      </span>
                      <div className="flex-1 h-px bg-gray-200/70 dark:bg-slate-700/70 ml-1" />
                    </div>

                    {/* Danh sách các trường trong nhóm (Không để nhãn H C L) */}
                    <div className="flex flex-wrap gap-1.5">
                      {group.fields.map(f => {
                        const isUsedInRow = layout.rows?.includes(f.key);
                        const isUsedInCol = layout.cols?.includes(f.key);
                        const isUsedInFilter = Boolean(layout.filters?.[f.key]);
                        const isUsed = isUsedInRow || isUsedInCol || isUsedInFilter;
                        const isBeingDragged = draggedItem?.fieldKey === f.key;

                        return (
                          <div
                            key={f.key}
                            draggable={!isLocked}
                            onDragStart={(e) => {
                              if (isLocked) return;
                              const item: DragItemState = { fieldKey: f.key, fromZone: 'available' };
                              setDraggedItem(item);
                              e.dataTransfer.setData('text/plain', f.key);
                              e.dataTransfer.setData('application/json', JSON.stringify(item));
                              e.dataTransfer.effectAllowed = 'copyMove';
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverZone(null);
                              setDragOverRowIndex(null);
                            }}
                            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs select-none transition-all ${
                              isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:shadow-xs'
                            } ${
                              isBeingDragged
                                ? 'opacity-40 ring-2 ring-[#005698] scale-95'
                                : isUsed
                                ? 'bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 text-amber-900 dark:text-amber-200 shadow-2xs font-semibold'
                                : 'bg-white dark:bg-slate-800 border border-[#005698] text-[#005698] hover:bg-sky-50/60 dark:hover:bg-slate-700/60 hover:border-[#00386b] font-medium'
                            }`}
                            title={isLocked ? f.label : `Kéo '${f.label}' thả vào Hàng, Cột hoặc Bộ lọc`}
                          >
                            {!isLocked && (
                              <GripVertical size={11} className={`text-gray-400 shrink-0 -ml-0.5 transition-colors ${isUsed ? 'group-hover:text-[#D97706]' : 'group-hover:text-[#005698]'}`} />
                            )}
                            <span className="truncate">{f.label}</span>

                            {/* Chỉ báo tinh tế nếu đã chọn trong báo cáo (không hiển thị chữ H C L) */}
                            {isUsed && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" title="Đang được sử dụng trong báo cáo" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cột 2: HÀNG (Rows) (Chiếm 22% độ rộng - Phân cấp dọc) */}
          <div 
            onDragOver={(e) => {
              if (isLocked) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (dragOverZone !== 'rows') setDragOverZone('rows');
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverZone === 'rows') setDragOverZone(null);
              }
            }}
            onDrop={(e) => {
              if (isLocked) return;
              e.preventDefault();
              setDragOverZone(null);
              setDragOverRowIndex(null);
              handleDropToZone('rows');
            }}
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${
              dragOverZone === 'rows'
                ? 'border-2 border-dashed border-[#D97706] bg-amber-100/70 dark:bg-amber-950/60 ring-2 ring-amber-300/50 scale-[1.01]'
                : 'border border-amber-200/80 dark:border-slate-700 bg-amber-50/40 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-amber-200/60 dark:border-slate-700">
              <span className="text-[11px] font-bold text-[#D97706] uppercase tracking-wider flex items-center gap-1.5">
                <Rows3 size={13} />
                <span>Hàng (Rows)</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {layout.rows?.length || 0} cấp
              </span>
            </div>

            {/* Vùng thả chỉ thị */}
            {dragOverZone === 'rows' && (
              <div className="p-1.5 border border-dashed border-[#D97706] bg-amber-200/60 dark:bg-amber-900/50 rounded-lg text-center text-xs font-bold text-amber-900 dark:text-amber-200 animate-pulse flex items-center justify-center gap-1.5">
                <Plus size={13} />
                <span>Thả vào Hàng (Rows)</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-h-[70px] max-h-[290px] overflow-y-auto custom-scrollbar pr-0.5">
              {layout.rows?.length === 0 ? (
                <span className="text-[11px] text-gray-400 italic my-auto text-center">
                  Kéo trường vào đây để phân cấp dòng
                </span>
              ) : (
                layout.rows.map((rKey, idx) => {
                  const meta = PIVOT_AVAILABLE_FIELDS.find(f => f.key === rKey);
                  const isBeingDragged = draggedItem?.fieldKey === rKey;
                  return (
                    <div
                      key={rKey}
                      draggable={!isLocked}
                      onDragStart={(e) => {
                        if (isLocked) return;
                        const item: DragItemState = { fieldKey: rKey as PivotFieldKey, fromZone: 'rows', index: idx };
                        setDraggedItem(item);
                        e.dataTransfer.setData('text/plain', rKey);
                        e.dataTransfer.setData('application/json', JSON.stringify(item));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDragOverZone(null);
                        setDragOverRowIndex(null);
                      }}
                      onDragOver={(e) => {
                        if (isLocked) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverRowIndex(idx);
                      }}
                      onDrop={(e) => {
                        if (isLocked) return;
                        e.preventDefault();
                        e.stopPropagation();
                        handleDropToZone('rows', idx);
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 bg-white dark:bg-slate-800 rounded-lg border text-xs shadow-2xs font-semibold text-gray-800 dark:text-gray-200 transition-all ${
                        isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        isBeingDragged ? 'opacity-40 ring-2 ring-[#D97706]' : ''
                      } ${
                        dragOverRowIndex === idx && draggedItem?.fieldKey !== rKey
                          ? 'border-[#D97706] ring-2 ring-amber-300 scale-[1.02]'
                          : 'border-amber-200 dark:border-slate-600'
                      }`}
                      title={isLocked ? meta?.label || rKey : `Kéo '${meta?.label || rKey}' để đổi vị trí phân cấp`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {!isLocked && (
                          <GripVertical size={11} className="text-gray-400 shrink-0" />
                        )}
                        <span className="w-4 h-4 rounded bg-amber-100 text-[#D97706] text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">{meta?.label || rKey}</span>
                      </span>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(rKey, 'rows')}
                          className="p-0.5 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                          title="Xóa trường khỏi Hàng"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột 3: CỘT (Columns) (Chiếm 22% độ rộng - Dàn ngang) */}
          <div 
            onDragOver={(e) => {
              if (isLocked) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (dragOverZone !== 'cols') setDragOverZone('cols');
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverZone === 'cols') setDragOverZone(null);
              }
            }}
            onDrop={(e) => {
              if (isLocked) return;
              e.preventDefault();
              setDragOverZone(null);
              handleDropToZone('cols');
            }}
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${
              dragOverZone === 'cols'
                ? 'border-2 border-dashed border-blue-500 bg-blue-100/70 dark:bg-blue-950/60 ring-2 ring-blue-300/50 scale-[1.01]'
                : 'border border-blue-200/80 dark:border-slate-700 bg-blue-50/40 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-blue-200/60 dark:border-slate-700">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <Columns3 size={13} />
                <span>Cột (Columns)</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {layout.cols?.length || 0}
              </span>
            </div>

            {/* Vùng thả chỉ thị */}
            {dragOverZone === 'cols' && (
              <div className="p-1.5 border border-dashed border-blue-500 bg-blue-200/60 dark:bg-blue-900/50 rounded-lg text-center text-xs font-bold text-blue-900 dark:text-blue-200 animate-pulse flex items-center justify-center gap-1.5">
                <Plus size={13} />
                <span>Thả vào Cột (Columns)</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-h-[70px] max-h-[290px] overflow-y-auto custom-scrollbar pr-0.5">
              {layout.cols?.length === 0 ? (
                <span className="text-[11px] text-gray-400 italic my-auto text-center">
                  Kéo trường vào đây để chia cột
                </span>
              ) : (
                layout.cols.map((cKey) => {
                  const meta = PIVOT_AVAILABLE_FIELDS.find(f => f.key === cKey);
                  const isBeingDragged = draggedItem?.fieldKey === cKey;
                  return (
                    <div
                      key={cKey}
                      draggable={!isLocked}
                      onDragStart={(e) => {
                        if (isLocked) return;
                        const item: DragItemState = { fieldKey: cKey as PivotFieldKey, fromZone: 'cols' };
                        setDraggedItem(item);
                        e.dataTransfer.setData('text/plain', cKey);
                        e.dataTransfer.setData('application/json', JSON.stringify(item));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDragOverZone(null);
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-slate-600 text-xs shadow-2xs font-semibold text-gray-800 dark:text-gray-200 transition-all ${
                        isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                      } ${isBeingDragged ? 'opacity-40 ring-2 ring-blue-500' : ''}`}
                      title={isLocked ? meta?.label || cKey : `Kéo '${meta?.label || cKey}' sang Hàng hoặc Lọc`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {!isLocked && (
                          <GripVertical size={11} className="text-gray-400 shrink-0" />
                        )}
                        <span className="truncate">{meta?.label || cKey}</span>
                      </span>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(cKey, 'cols')}
                          className="p-0.5 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                          title="Xóa trường khỏi Cột"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột 4: BỘ LỌC (Filters) (Chiếm 16% độ rộng còn lại) */}
          <div 
            onDragOver={(e) => {
              if (isLocked) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (dragOverZone !== 'filters') setDragOverZone('filters');
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverZone === 'filters') setDragOverZone(null);
              }
            }}
            onDrop={(e) => {
              if (isLocked) return;
              e.preventDefault();
              setDragOverZone(null);
              handleDropToZone('filters');
            }}
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${
              dragOverZone === 'filters'
                ? 'border-2 border-dashed border-emerald-500 bg-emerald-100/70 dark:bg-emerald-950/60 ring-2 ring-emerald-300/50 scale-[1.01]'
                : 'border border-emerald-200/80 dark:border-slate-700 bg-emerald-50/40 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60 dark:border-slate-700">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={13} />
                <span>Bộ lọc (Filters)</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {Object.keys(layout.filters || {}).length}
              </span>
            </div>

            {/* Vùng thả chỉ thị */}
            {dragOverZone === 'filters' && (
              <div className="p-1.5 border border-dashed border-emerald-500 bg-emerald-200/60 dark:bg-emerald-900/50 rounded-lg text-center text-xs font-bold text-emerald-900 dark:text-emerald-200 animate-pulse flex items-center justify-center gap-1.5">
                <Plus size={13} />
                <span>Thả vào Bộ lọc (Filters)</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-h-[70px] max-h-[290px] overflow-y-auto custom-scrollbar pr-0.5">
              {Object.keys(layout.filters || {}).length === 0 ? (
                <span className="text-[11px] text-gray-400 italic my-auto text-center">
                  Kéo trường vào đây để lọc dữ liệu
                </span>
              ) : (
                Object.entries(layout.filters || {}).map(([fKey, selected]) => {
                  const meta = PIVOT_AVAILABLE_FIELDS.find(f => f.key === fKey);
                  const isFiltered = selected && selected.length > 0;
                  return (
                    <div
                      key={fKey}
                      className={`flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border text-xs shadow-2xs font-semibold text-gray-800 dark:text-gray-200 transition-all ${
                        activeFilterField === fKey
                          ? 'border-[#D97706] ring-2 ring-amber-200 dark:ring-amber-900/50 bg-amber-50/40'
                          : 'border-emerald-200 dark:border-slate-600 hover:border-emerald-400'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleToggleFilterDropdown(e, fKey)}
                        className="flex items-center gap-1.5 text-left truncate flex-1 cursor-pointer"
                        title={`Bấm để chọn giá trị lọc cho ${meta?.label || fKey}`}
                      >
                        <span className="truncate">{meta?.label || fKey}</span>
                        {isFiltered ? (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">
                            {selected.length}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-normal shrink-0">
                            (Tất cả)
                          </span>
                        )}
                        <ChevronDown 
                          size={12} 
                          className={`text-gray-400 transition-transform shrink-0 ml-auto mr-1 ${
                            activeFilterField === fKey ? 'rotate-180 text-[#D97706]' : ''
                          }`} 
                        />
                      </button>

                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(fKey, 'filters')}
                          className="p-0.5 text-gray-400 hover:text-red-500 rounded cursor-pointer shrink-0 ml-0.5"
                          title="Xóa bộ lọc"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 2. BẢNG HIỂN THỊ PIVOT TABLE THỜI GIAN THỰC */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col">
        
        {/* Header thông tin nhanh */}
        <div className="p-3 px-4 bg-gray-50/80 dark:bg-slate-900/60 border-b border-gray-200/80 dark:border-slate-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 dark:text-gray-100">
              Tổng số tiền phân bổ:
            </span>
            <span className="font-bold font-mono text-base text-[#D97706]">
              {tableData.grandTotalAll.toLocaleString('vi-VN')} <span className="text-xs font-sans text-gray-400">VNĐ</span>
            </span>
          </div>

          <div className="text-[11px] text-gray-500 font-mono">
            {tableData.grandTotalCount} lượt phân bổ • {tableData.leafColumns.length} cột
          </div>
        </div>

        {/* Khung cuộn bảng ma trận Pivot */}
        <div className="overflow-auto max-h-[620px] custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-amber-50 dark:bg-slate-900 text-gray-800 dark:text-gray-100 font-bold border-b border-amber-300 dark:border-slate-700 z-10 shadow-2xs">
              <tr>
                <th className="p-2.5 px-3 min-w-[280px] border-r border-gray-200 dark:border-slate-700">
                  {layout.rows.length > 0 
                    ? layout.rows.map(r => PIVOT_AVAILABLE_FIELDS.find(f => f.key === r)?.label || r).join(' > ')
                    : 'Chỉ tiêu phân tích'}
                </th>
                {tableData.leafColumns.map(col => (
                  <th
                    key={col.key}
                    className="p-2.5 px-3 text-right min-w-[120px] border-r border-gray-200 dark:border-slate-700"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="p-2.5 px-3 text-right min-w-[130px] bg-amber-100/60 dark:bg-amber-950/40 text-[#D97706]">
                  Tổng cộng
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {tableData.rootNodes.length === 0 ? (
                <tr>
                  <td colSpan={tableData.leafColumns.length + 2} className="p-8 text-center text-gray-400">
                    Không có số liệu phù hợp với cấu hình hoặc bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                renderRows(tableData.rootNodes, 0, collapsedKeys, toggleCollapse, tableData.leafColumns)
              )}
            </tbody>

            {/* Dòng Tổng cộng toàn bộ (Grand Total) */}
            <tfoot className="sticky bottom-0 bg-[#FEF3C7] dark:bg-slate-900 border-t-2 border-[#D97706] font-bold text-gray-900 dark:text-gray-100 z-10 shadow-md">
              <tr>
                <td className="p-3 px-4 border-r border-amber-300/60 uppercase tracking-wider text-[#78350F] dark:text-amber-300">
                  TỔNG CỘNG TOÀN BỘ
                </td>
                {tableData.leafColumns.map(col => (
                  <td
                    key={col.key}
                    className="p-3 px-3 text-right font-mono border-r border-amber-300/60 text-[#78350F] dark:text-amber-300"
                  >
                    {(tableData.grandTotalByCol[col.key] || 0).toLocaleString('vi-VN')}
                  </td>
                ))}
                <td className="p-3 px-3 text-right font-mono text-sm text-[#D97706]">
                  {tableData.grandTotalAll.toLocaleString('vi-VN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. MENU DROPDOWN XỔ XUỐNG BỘ LỌC (FLOATING POPOVER KHÔNG BỊ TRÀN / CẮT KHUNG) */}
      {activeFilterField && filterDropdownPos && (() => {
        const meta = PIVOT_AVAILABLE_FIELDS.find(f => f.key === activeFilterField);
        const allOptions = getFieldUniqueOptions(activeFilterField as PivotFieldKey);
        const selectedList = layout.filters?.[activeFilterField] || [];
        const filteredOptions = filterSearchTerm.trim() === ''
          ? allOptions
          : allOptions.filter(o => o.label.toLowerCase().includes(filterSearchTerm.toLowerCase().trim()));

        return (
          <div className="fixed inset-0 z-50 filter-dropdown-container">
            {/* Backdrop đóng khi bấm ra ngoài */}
            <div 
              className="fixed inset-0 bg-black/10 dark:bg-black/30 backdrop-blur-[0.5px]" 
              onClick={() => {
                setActiveFilterField(null);
                setFilterDropdownPos(null);
                setFilterSearchTerm('');
              }} 
            />

            {/* Menu xổ xuống nổi độc lập */}
            <div
              style={{
                position: 'fixed',
                ...(filterDropdownPos.openUpwards 
                  ? { bottom: `${window.innerHeight - filterDropdownPos.top + 6}px` } 
                  : { top: `${filterDropdownPos.top}px` }),
                right: `${filterDropdownPos.right}px`,
                width: `${filterDropdownPos.width}px`
              }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-600 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[420px]"
            >
              {/* Header của menu xổ xuống */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter size={14} className="text-[#D97706] shrink-0" />
                  <span className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                    Lọc: {meta?.label || activeFilterField}
                  </span>
                  {selectedList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0">
                      Đã chọn {selectedList.length}/{allOptions.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilterField(null);
                    setFilterDropdownPos(null);
                    setFilterSearchTerm('');
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                  title="Đóng danh sách"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Ô tìm kiếm nhanh */}
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filterSearchTerm}
                  onChange={(e) => setFilterSearchTerm(e.target.value)}
                  placeholder={`Tìm ${meta?.label || 'giá trị'}...`}
                  className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
                  autoFocus
                />
                {filterSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setFilterSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Hàng nút hành động nhanh: Chọn tất cả / Bỏ chọn tất cả */}
              <div className="flex items-center justify-between text-xs px-1 mb-2 pb-1.5 border-b border-gray-100 dark:border-slate-700/60">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectAllFilter(activeFilterField, true)}
                  className="text-[#D97706] font-bold hover:underline cursor-pointer text-[11px] disabled:opacity-50"
                >
                  Chọn tất cả ({allOptions.length})
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectAllFilter(activeFilterField, false)}
                  className="text-gray-500 hover:text-red-500 font-bold hover:underline cursor-pointer text-[11px] disabled:opacity-50"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              {/* Danh sách các giá trị checkbox cuộn mượt */}
              <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-0.5 divide-y divide-gray-50 dark:divide-slate-700/40">
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400 italic">
                    Không tìm thấy giá trị phù hợp
                  </div>
                ) : (
                  filteredOptions.map(opt => {
                    const isChecked = selectedList.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
                        className={`flex items-center justify-between px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                          isChecked 
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 font-semibold text-amber-900 dark:text-amber-200' 
                            : 'hover:bg-gray-50 dark:hover:bg-slate-700/60 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={isChecked}
                            onChange={() => handleToggleFilterOption(activeFilterField, opt.key)}
                            className="rounded border-gray-300 text-[#D97706] focus:ring-[#D97706] cursor-pointer shrink-0"
                          />
                          <span className="truncate" title={opt.label}>{opt.label}</span>
                        </div>
                        {opt.count !== undefined && (
                          <span className="text-[10px] text-gray-400 font-mono shrink-0">
                            {opt.count}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Nút hoàn tất ở chân menu */}
              <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[10.5px] text-gray-400 italic">
                  {selectedList.length === 0 ? 'Đang hiển thị tất cả' : `Đã lọc ${selectedList.length} mục`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilterField(null);
                    setFilterDropdownPos(null);
                    setFilterSearchTerm('');
                  }}
                  className="px-3 py-1 bg-[#D97706] hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Hàm đệ quy render các tầng phân cấp dòng (Hierarchical Nodes)
 */
function renderRows(
  nodes: PivotNode[],
  depth: number,
  collapsedKeys: Set<string>,
  onToggle: (key: string) => void,
  columns: Array<{ key: string; label: string }>
): React.ReactNode {
  return nodes.map(node => {
    const isLeaf = !node.children || node.children.length === 0;
    const isCollapsed = collapsedKeys.has(node.key);
    const isParent = !isLeaf;

    return (
      <React.Fragment key={node.key}>
        <tr className={`transition-colors ${
          isParent 
            ? 'bg-gray-50/70 dark:bg-slate-800/80 font-bold hover:bg-amber-50/50' 
            : 'hover:bg-blue-50/30 dark:hover:bg-slate-700/30'
        }`}>
          {/* Cột Tên chỉ tiêu có thụt lề cấp bậc & nút đóng/mở */}
          <td 
            className="p-2.5 border-r border-gray-200 dark:border-slate-700"
            style={{ paddingLeft: `${16 + depth * 22}px` }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isParent ? (
                <button
                  type="button"
                  onClick={() => onToggle(node.key)}
                  className="p-0.5 text-gray-400 hover:text-[#D97706] rounded cursor-pointer shrink-0"
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              ) : (
                <span className="w-3.5 h-3.5 flex items-center justify-center text-gray-300 shrink-0 text-xs">
                  •
                </span>
              )}

              <span className={`truncate ${isParent ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                {node.label}
              </span>

              {isParent && (
                <span className="text-[10px] text-gray-400 font-normal shrink-0">
                  ({node.children.length})
                </span>
              )}
            </div>
          </td>

          {/* Các cột giá trị theo trục ngang */}
          {columns.map(col => {
            const val = node.values[col.key] || 0;
            return (
              <td
                key={col.key}
                className={`p-2 px-3 text-right font-mono border-r border-gray-200 dark:border-slate-700 ${
                  isParent ? 'font-bold' : ''
                } ${val === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}
              >
                {val > 0 ? val.toLocaleString('vi-VN') : '—'}
              </td>
            );
          })}

          {/* Cột Tổng cộng dòng */}
          <td className={`p-2 px-3 text-right font-mono bg-amber-50/40 dark:bg-amber-950/20 font-bold ${
            isParent ? 'text-[#D97706]' : 'text-gray-800 dark:text-gray-200'
          }`}>
            {node.total.toLocaleString('vi-VN')}
          </td>
        </tr>

        {/* Render tiếp các nhánh con nếu không bị thu gọn */}
        {isParent && !isCollapsed && renderRows(node.children, depth + 1, collapsedKeys, onToggle, columns)}
      </React.Fragment>
    );
  });
}
