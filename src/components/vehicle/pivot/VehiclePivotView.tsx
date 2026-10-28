import React, { useState, useMemo, useEffect } from 'react';
import {
  TableProperties,
  Download,
  RotateCcw,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  BarChart2,
  Folder,
  FolderOpen,
  GripVertical,
  Building2,
  Car,
  ShieldCheck,
  Filter,
  Columns3,
  Rows3,
  Search,
  Check,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';
import { TS_Xe, DonVi } from '../../../types';
import {
  VehiclePivotFieldKey,
  VehiclePivotMeasure,
  VehiclePivotLayoutConfig,
  VEHICLE_PIVOT_AVAILABLE_FIELDS,
  VehiclePivotNode
} from './vehiclePivotTypes';
import {
  buildVehiclePivotFlatRecords,
  computeVehiclePivotMatrix,
  getVehicleFieldValue
} from './vehiclePivotEngine';
import { exportVehiclePivotExcel } from './exportVehiclePivotExcel';
import { formatCurrencySpace as formatCurrency } from '../../../utils/formatters';
import {
  renderBrandBadge,
  getBrandEmoji
} from '../../../constants/vehicleBrandConfig';

interface Props {
  cars: (TS_Xe & any)[];
  donViList: DonVi[];
  donViMap: Record<string, string>;
  nhatKyData?: any[];
  chiPhiData?: any[];
}

interface DragItemState {
  fieldKey: VehiclePivotFieldKey;
  fromZone: 'available' | 'rows' | 'cols' | 'filters';
  index?: number;
}

const DEFAULT_VEHICLE_PIVOT_LAYOUT: VehiclePivotLayoutConfig = {
  rows: ['don_vi'],
  cols: ['muc_dich_su_dung'],
  valField: 'count',
  filters: {}
};

export default function VehiclePivotView({
  cars,
  donViList,
  donViMap,
  nhatKyData = [],
  chiPhiData = []
}: Props) {
  // 1. Layout State
  const [layout, setLayout] = useState<VehiclePivotLayoutConfig>(() =>
    JSON.parse(JSON.stringify(DEFAULT_VEHICLE_PIVOT_LAYOUT))
  );

  // State mở rộng/thu gọn các node trong cây
  const [collapsedNodeKeys, setCollapsedNodeKeys] = useState<Set<string>>(new Set());

  // Trạng thái Kéo - Thả
  const [draggedItem, setDraggedItem] = useState<DragItemState | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'rows' | 'cols' | 'filters' | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // Trạng thái Popup / Menu xổ xuống Bộ lọc
  const [activeFilterField, setActiveFilterField] = useState<VehiclePivotFieldKey | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState<{
    top: number;
    right: number;
    width: number;
    openUpwards?: boolean;
  } | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

  // Tự động đóng dropdown khi cuộn trang ngoài hoặc resize cửa sổ
  useEffect(() => {
    if (!activeFilterField) return;
    const handleScrollOrResize = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.vehicle-filter-dropdown-container')) return;
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

  // 2. Chuyển đổi dữ liệu sang Flat Records
  const flatRecords = useMemo(() => {
    return buildVehiclePivotFlatRecords({
      cars,
      donViList,
      donViMap,
      nhatKyData,
      chiPhiData
    });
  }, [cars, donViList, donViMap, nhatKyData, chiPhiData]);

  // 3. Tính toán Ma trận Pivot
  const pivotData = useMemo(() => {
    return computeVehiclePivotMatrix(flatRecords, layout);
  }, [flatRecords, layout]);

  // Danh mục 3 Nhóm Trường Khả Dụng
  const fieldGroups = useMemo(() => [
    {
      category: 'Đơn vị & Địa bàn' as const,
      icon: Building2,
      title: 'Đơn vị & Địa bàn',
      colorIcon: 'text-indigo-600',
      fields: VEHICLE_PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Đơn vị & Địa bàn')
    },
    {
      category: 'Đặc tính Xe' as const,
      icon: Car,
      title: 'Đặc tính xe',
      colorIcon: 'text-sky-600',
      fields: VEHICLE_PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Đặc tính Xe')
    },
    {
      category: 'Hiện trạng & Pháp lý' as const,
      icon: ShieldCheck,
      title: 'Hiện trạng & Pháp nhân',
      colorIcon: 'text-amber-600',
      fields: VEHICLE_PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Hiện trạng & Pháp lý')
    }
  ], []);

  // Thêm trường vào zone
  const handleAddField = (fieldKey: VehiclePivotFieldKey, zone: 'rows' | 'cols' | 'filters') => {
    const clone: VehiclePivotLayoutConfig = {
      ...layout,
      rows: [...layout.rows],
      cols: [...layout.cols],
      filters: { ...(layout.filters || {}) }
    };
    if (zone === 'rows') {
      if (!clone.rows.includes(fieldKey)) clone.rows.push(fieldKey);
    } else if (zone === 'cols') {
      if (!clone.cols.includes(fieldKey)) clone.cols.push(fieldKey);
    } else if (zone === 'filters') {
      if (!clone.filters[fieldKey]) clone.filters[fieldKey] = [];
    }
    setLayout(clone);
    setSelectedPresetId('');
  };

  // Xóa trường khỏi zone
  const handleRemoveField = (fieldKey: string, zone: 'rows' | 'cols' | 'filters') => {
    const clone: VehiclePivotLayoutConfig = {
      ...layout,
      rows: [...layout.rows],
      cols: [...layout.cols],
      filters: { ...(layout.filters || {}) }
    };
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
      if (clone.filters) delete clone.filters[fieldKey];
    }
    setLayout(clone);
    setSelectedPresetId('');
  };

  // Kéo thả Drop handler
  const handleDropToZone = (targetZone: 'rows' | 'cols' | 'filters', targetIndex?: number | null) => {
    if (!draggedItem) return;
    const { fieldKey, fromZone, index: sourceIndex } = draggedItem;

    const clone: VehiclePivotLayoutConfig = {
      ...layout,
      rows: [...layout.rows],
      cols: [...layout.cols],
      filters: { ...(layout.filters || {}) }
    };

    if (targetZone === 'rows') {
      if (fromZone === 'rows') {
        if (sourceIndex !== undefined && targetIndex !== undefined && targetIndex !== null && sourceIndex !== targetIndex) {
          const item = clone.rows.splice(sourceIndex, 1)[0];
          clone.rows.splice(targetIndex, 0, item);
        }
      } else {
        if (fromZone === 'cols') clone.cols = clone.cols.filter(f => f !== fieldKey);
        if (!clone.rows.includes(fieldKey)) {
          if (targetIndex !== undefined && targetIndex !== null) {
            clone.rows.splice(targetIndex, 0, fieldKey);
          } else {
            clone.rows.push(fieldKey);
          }
        }
      }
    } else if (targetZone === 'cols') {
      if (fromZone === 'rows') clone.rows = clone.rows.filter(f => f !== fieldKey);
      if (!clone.cols.includes(fieldKey)) clone.cols.push(fieldKey);
    } else if (targetZone === 'filters') {
      if (!clone.filters[fieldKey]) clone.filters[fieldKey] = [];
    }

    setLayout(clone);
    setSelectedPresetId('');
    setDraggedItem(null);
  };

  // Đổi chỉ số đo lường (Measure)
  const handleChangeMeasure = (measure: VehiclePivotMeasure) => {
    setLayout(prev => ({ ...prev, valField: measure }));
    setSelectedPresetId('');
  };

  // Toggle thu gọn/mở rộng Node
  const toggleNodeExpand = (nodeKey: string) => {
    setCollapsedNodeKeys(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  };

  // Mở rộng tất cả các node trong cây
  const handleExpandAllNodes = () => {
    setCollapsedNodeKeys(new Set());
  };

  // Thu gọn tất cả các node trong cây
  const handleCollapseAllNodes = () => {
    const allParentKeys = new Set<string>();
    const collectParentKeys = (nodes: VehiclePivotNode[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allParentKeys.add(n.key);
          collectParentKeys(n.children);
        }
      });
    };
    collectParentKeys(pivotData.rootNodes);
    setCollapsedNodeKeys(allParentKeys);
  };

  // Tên chỉ tiêu đo lường hiện tại
  const currentMeasureLabel = useMemo(() => {
    switch (layout.valField) {
      case 'count': return 'Số lượng xe';
      case 'nguyen_gia': return 'Tổng nguyên giá';
      case 'tong_km': return 'Tổng số Km';
      case 'chi_phi': return 'Tổng chi phí';
      default: return 'Chỉ tiêu';
    }
  }, [layout.valField]);

  // Helper format giá trị số hiển thị theo Measure
  const formatCellValue = (val: number | undefined): string => {
    if (val === undefined || val === null || val === 0) return '-';
    if (layout.valField === 'nguyen_gia' || layout.valField === 'chi_phi') {
      return formatCurrency(val);
    }
    if (layout.valField === 'tong_km') {
      return `${val.toLocaleString('vi-VN')} km`;
    }
    return val.toLocaleString('vi-VN');
  };

  const formatTotalValue = (val: number | undefined): string => {
    if (val === undefined || val === null || val === 0) return '0';
    if (layout.valField === 'nguyen_gia' || layout.valField === 'chi_phi') {
      return formatCurrency(val);
    }
    if (layout.valField === 'tong_km') {
      return `${val.toLocaleString('vi-VN')} km`;
    }
    return val.toLocaleString('vi-VN');
  };

  // Xuất file Excel
  const handleExportExcel = () => {
    const configName = 'Báo cáo thống kê xe';
    const rowFieldLabels = layout.rows.map(f => VEHICLE_PIVOT_AVAILABLE_FIELDS.find(af => af.key === f)?.label || f);
    exportVehiclePivotExcel({
      configName,
      data: pivotData,
      rowFieldLabels,
      valField: layout.valField
    });
  };

  // Reset về mặc định
  const handleReset = () => {
    setLayout(JSON.parse(JSON.stringify(DEFAULT_VEHICLE_PIVOT_LAYOUT)));
    setCollapsedNodeKeys(new Set());
  };

  // Lấy các giá trị duy nhất cho popup bộ lọc
  const activeFieldUniqueValues = useMemo(() => {
    if (!activeFilterField) return [];
    const counts: Record<string, { key: string; label: string; count: number }> = {};
    flatRecords.forEach(r => {
      const { key, label } = getVehicleFieldValue(r, activeFilterField);
      if (!counts[key]) {
        counts[key] = { key, label, count: 0 };
      }
      counts[key].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [activeFilterField, flatRecords]);

  // Lọc giá trị theo search term trong popup
  const filteredActiveValues = useMemo(() => {
    if (!filterSearchTerm.trim()) return activeFieldUniqueValues;
    const term = filterSearchTerm.toLowerCase();
    return activeFieldUniqueValues.filter(v => v.label.toLowerCase().includes(term));
  }, [activeFieldUniqueValues, filterSearchTerm]);

  // Toggle chọn giá trị lọc
  const handleToggleFilterValue = (valKey: string) => {
    if (!activeFilterField) return;
    const currentSelected = layout.filters?.[activeFilterField] || [];
    let nextSelected: string[];
    if (currentSelected.includes(valKey)) {
      nextSelected = currentSelected.filter(k => k !== valKey);
    } else {
      nextSelected = [...currentSelected, valKey];
    }
    setLayout(prev => ({
      ...prev,
      filters: {
        ...(prev.filters || {}),
        [activeFilterField]: nextSelected
      }
    }));
  };

  // Chọn tất cả / Bỏ chọn trong menu xổ xuống
  const handleSelectAllFilter = (selectAll: boolean) => {
    if (!activeFilterField) return;
    setLayout(prev => ({
      ...prev,
      filters: {
        ...(prev.filters || {}),
        [activeFilterField]: selectAll ? activeFieldUniqueValues.map(v => v.key) : []
      }
    }));
  };

  // Bật/tắt menu xổ xuống và tính toán vị trí nổi (floating dropdown không bị cắt xén)
  const handleToggleFilterDropdown = (e: React.MouseEvent<HTMLElement>, fKey: VehiclePivotFieldKey) => {
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

  // Đệ quy hiển thị các node của cây (Rows)
  const renderRowNodes = (nodes: VehiclePivotNode[]): React.ReactNode => {
    return nodes.map(node => {
      const isParent = node.children && node.children.length > 0;
      const isCollapsed = collapsedNodeKeys.has(node.key);
      const isBrandRow = node.field === 'hieu_xe';

      return (
        <React.Fragment key={node.key}>
          <tr
            className={`group border-b border-gray-100 transition-colors ${node.depth === 0
                ? 'bg-sky-50/40 hover:bg-sky-50 font-bold text-gray-900'
                : node.depth === 1
                  ? 'bg-white hover:bg-gray-50/80 text-gray-800'
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
          >
            {/* Cột Tên Phân Cấp Hàng (Cố định bên trái khi cuộn ngang) */}
            <td
              className={`py-2 px-3 sticky left-0 z-10 border-r border-gray-200 shadow-2xs ${node.depth === 0 ? 'bg-[#f0f7fc] group-hover:bg-sky-100/70' : 'bg-white group-hover:bg-gray-50'
                }`}
              style={{ paddingLeft: `${node.depth * 20 + 12}px` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isParent ? (
                  <button
                    type="button"
                    onClick={() => toggleNodeExpand(node.key)}
                    className="p-1 text-gray-400 hover:text-[#005698] rounded cursor-pointer transition-colors"
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className="w-5 shrink-0 inline-block text-gray-300 text-center">•</span>
                )}

                <span className="text-gray-400 shrink-0">
                  {isParent ? (
                    isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} className="text-amber-500" />
                  ) : null}
                </span>

                {/* Hiển thị thương hiệu nếu là nhánh Hãng xe */}
                {isBrandRow ? (
                  renderBrandBadge(node.label, 'px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs')
                ) : (
                  <span
                    className={`text-xs ${isParent ? 'font-black text-gray-900' : 'font-medium text-gray-700'}`}
                    title={node.label}
                  >
                    {node.label}
                  </span>
                )}

                {isParent && (
                  <span className="text-[10px] text-gray-400 font-semibold ml-1 shrink-0">
                    ({node.count} xe)
                  </span>
                )}
              </div>
            </td>

            {/* Các Cột Dữ Liệu */}
            {pivotData.leafColumns.map(col => {
              const val = node.values[col.key];
              const hasVal = val !== undefined && val > 0;
              return (
                <td
                  key={col.key}
                  className={`py-2 px-3 text-right text-xs align-middle border-r border-gray-100 ${hasVal
                      ? node.depth === 0
                        ? 'font-black text-[#005698]'
                        : 'font-semibold text-gray-800'
                      : 'text-gray-300'
                    }`}
                >
                  {formatCellValue(val)}
                </td>
              );
            })}

            {/* Cột Tổng Biên (Row Total) */}
            <td
              className={`py-2 px-3 text-right text-xs align-middle bg-slate-50/50 ${node.depth === 0
                  ? 'font-black text-[#00386b]'
                  : 'font-bold text-gray-900'
                }`}
            >
              {formatTotalValue(node.total)}
            </td>
          </tr>

          {/* Render các nhánh con đệ quy nếu không bị thu gọn */}
          {isParent && !isCollapsed && renderRowNodes(node.children)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-4 flex flex-col flex-1 min-h-0 h-full overflow-y-auto custom-scrollbar pr-1 pb-16">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#005698] to-[#00386b] text-white shadow-xs">
              <TableProperties size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 tracking-tight">
                Báo cáo Thống kê Đa chiều
              </h3>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Đặt lại cấu hình mặc định"
            >
              <RotateCcw size={13} />
              <span>Mặc định</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Xuất file Excel bảng báo cáo đa cấp"
            >
              <Download size={14} />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BỘ ĐIỀU KHIỂN BUILDER 4 VÙNG KÉO THẢ (ĐỒNG BỘ QUẢN LÝ CHI PHÍ) ── */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs shrink-0">
        {/* Cụm 4 ô cấu hình: 40% (Trường khả dụng) | 22% (Hàng) | 22% (Cột) | 16% (Bộ lọc) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[40fr_22fr_22fr_16fr] gap-3.5 items-stretch">
          {/* CỘT 1: TRƯỜNG PHÂN TÍCH KHẢ DỤNG (Chiếm 40% độ rộng) */}
          <div className="p-3 rounded-xl border border-gray-200/90 bg-gray-50/50 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-[#005698]" />
                <span>Trường phân tích khả dụng</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono font-bold">
                {VEHICLE_PIVOT_AVAILABLE_FIELDS.length} trường
              </span>
            </div>

            {/* 3 Nhóm Trường */}
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
              {fieldGroups.map(grp => {
                const Icon = grp.icon;
                return (
                  <div key={grp.category} className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-black text-gray-600">
                      <Icon size={12} className={grp.colorIcon} />
                      <span>{grp.title}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {grp.fields.map(f => {
                        const isInRows = layout.rows.includes(f.key);
                        const isInCols = layout.cols.includes(f.key);
                        const isInFilters = Boolean(layout.filters?.[f.key]);
                        const isUsed = isInRows || isInCols || isInFilters;

                        return (
                          <div
                            key={f.key}
                            draggable
                            onDragStart={(e) => {
                              const item: DragItemState = { fieldKey: f.key, fromZone: 'available' };
                              setDraggedItem(item);
                              e.dataTransfer.setData('text/plain', f.key);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onDragEnd={() => setDraggedItem(null)}
                            onClick={() => {
                              // Click chọn nhanh thêm vào Hàng
                              if (!isInRows) handleAddField(f.key, 'rows');
                            }}
                            className={`group flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing transition-all select-none border ${isUsed
                                ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs font-bold'
                                : 'bg-white border-[#005698] text-[#005698] hover:bg-sky-50/60 hover:border-[#00386b] shadow-2xs'
                              }`}
                            title={`Kéo '${f.label}' vào Hàng, Cột hoặc Bộ lọc`}
                          >
                            <GripVertical size={11} className={`text-gray-400 shrink-0 -ml-0.5 transition-colors ${isUsed ? 'group-hover:text-amber-600' : 'group-hover:text-[#005698]'}`} />
                            <span className="truncate">{f.label}</span>
                            {isUsed && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Đang dùng" />
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

          {/* CỘT 2: HÀNG (ROWS) (22% ~ 3 cols) */}
          <div
            onDragOver={(e) => {
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
              e.preventDefault();
              setDragOverZone(null);
              setDragOverRowIndex(null);
              handleDropToZone('rows');
            }}
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${dragOverZone === 'rows'
                ? 'border-2 border-dashed border-[#005698] bg-sky-50 ring-2 ring-sky-200 scale-[1.01]'
                : 'border border-blue-200/80 bg-blue-50/30'
              }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-blue-200/60">
              <span className="text-[11px] font-black text-[#005698] uppercase tracking-wider flex items-center gap-1.5">
                <Rows3 size={13} />
                <span>Hàng (Rows)</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-gray-500">
                {layout.rows.length} cấp
              </span>
            </div>

            {dragOverZone === 'rows' && (
              <div className="p-1.5 border border-dashed border-[#005698] bg-sky-100 rounded-lg text-center text-xs font-bold text-[#005698] animate-pulse flex items-center justify-center gap-1">
                <Plus size={12} />
                <span>Thả vào Hàng</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-h-[70px] max-h-[250px] overflow-y-auto custom-scrollbar pr-0.5">
              {layout.rows.length === 0 ? (
                <span className="text-[11px] text-gray-400 italic my-auto text-center">
                  Kéo trường vào đây để tạo cấp dòng
                </span>
              ) : (
                layout.rows.map((rKey, idx) => {
                  const meta = VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === rKey);
                  const isBeingDragged = draggedItem?.fieldKey === rKey;
                  return (
                    <div
                      key={rKey}
                      draggable
                      onDragStart={(e) => {
                        const item: DragItemState = { fieldKey: rKey, fromZone: 'rows', index: idx };
                        setDraggedItem(item);
                        e.dataTransfer.setData('text/plain', rKey);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDragOverZone(null);
                        setDragOverRowIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverRowIndex(idx);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDropToZone('rows', idx);
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border text-xs shadow-2xs font-bold text-gray-800 transition-all cursor-grab active:cursor-grabbing ${isBeingDragged ? 'opacity-40 ring-2 ring-[#005698]' : ''
                        } ${dragOverRowIndex === idx && draggedItem?.fieldKey !== rKey
                          ? 'border-[#005698] ring-2 ring-sky-300 scale-[1.02]'
                          : 'border-blue-200'
                        }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <GripVertical size={11} className="text-gray-400 shrink-0" />
                        <span className="w-4 h-4 rounded bg-sky-100 text-[#005698] text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">{meta?.label || rKey}</span>
                      </span>
                      {layout.rows.length > 1 && (
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

          {/* CỘT 3: CỘT (COLUMNS) (22% ~ 2.5 cols) */}
          <div
            onDragOver={(e) => {
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
              e.preventDefault();
              setDragOverZone(null);
              handleDropToZone('cols');
            }}
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${dragOverZone === 'cols'
                ? 'border-2 border-dashed border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 scale-[1.01]'
                : 'border border-emerald-200/80 bg-emerald-50/30'
              }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60">
              <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <Columns3 size={13} />
                <span>Cột (Columns)</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-gray-500">
                {layout.cols.length} cột
              </span>
            </div>

            {dragOverZone === 'cols' && (
              <div className="p-1.5 border border-dashed border-emerald-600 bg-emerald-100 rounded-lg text-center text-xs font-bold text-emerald-800 animate-pulse flex items-center justify-center gap-1">
                <Plus size={12} />
                <span>Thả vào Cột</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-h-[70px] max-h-[250px] overflow-y-auto custom-scrollbar pr-0.5">
              {layout.cols.length === 0 ? (
                <span className="text-[11px] text-gray-400 italic my-auto text-center">
                  (Tổng số toàn bảng)
                </span>
              ) : (
                layout.cols.map((cKey) => {
                  const meta = VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === cKey);
                  return (
                    <div
                      key={cKey}
                      className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-emerald-200 text-xs shadow-2xs font-bold text-emerald-900"
                    >
                      <span className="truncate">{meta?.label || cKey}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(cKey, 'cols')}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                        title="Xóa trường khỏi Cột"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* CỘT 4: BỘ LỌC (FILTERS) (22% ~ 2.5 cols) */}
          <div
            onDragOver={(e) => {
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
              e.preventDefault();
              setDragOverZone(null);
              handleDropToZone('filters');
            }}
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${dragOverZone === 'filters'
                ? 'border-2 border-dashed border-purple-500 bg-purple-50 ring-2 ring-purple-200 scale-[1.01]'
                : 'border border-purple-200/80 bg-purple-50/30'
              }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-purple-200/60">
              <span className="text-[11px] font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={13} />
                <span>Bộ lọc (Filters)</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-gray-500">
                {Object.keys(layout.filters || {}).length} bộ lọc
              </span>
            </div>

            {dragOverZone === 'filters' && (
              <div className="p-1.5 border border-dashed border-purple-600 bg-purple-100 rounded-lg text-center text-xs font-bold text-purple-800 animate-pulse flex items-center justify-center gap-1">
                <Plus size={12} />
                <span>Thả vào Bộ lọc</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-h-[70px] max-h-[250px] overflow-y-auto custom-scrollbar pr-0.5">
              {Object.keys(layout.filters || {}).length === 0 ? (
                <span className="text-[11px] text-gray-400 italic my-auto text-center">
                  Kéo trường vào đây để lọc giá trị
                </span>
              ) : (
                Object.keys(layout.filters || {}).map((fKey) => {
                  const meta = VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === fKey);
                  const selectedValues = layout.filters[fKey] || [];
                  const isOpen = activeFilterField === fKey;
                  return (
                    <div
                      key={fKey}
                      className={`flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border text-xs shadow-2xs font-bold text-gray-800 transition-all ${isOpen
                          ? 'border-[#005698] ring-2 ring-sky-200 bg-sky-50/40 text-[#005698]'
                          : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50/30'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleToggleFilterDropdown(e, fKey as VehiclePivotFieldKey)}
                        className="flex items-center gap-1.5 text-left truncate flex-1 cursor-pointer"
                        title={`Bấm để chọn giá trị lọc cho ${meta?.label || fKey}`}
                      >
                        <span className="truncate">{meta?.label || fKey}</span>
                        {selectedValues.length > 0 ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 font-bold shrink-0">
                            {selectedValues.length}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-normal shrink-0">
                            (Tất cả)
                          </span>
                        )}
                        <ChevronDown
                          size={12}
                          className={`text-gray-400 transition-transform shrink-0 ml-auto mr-1 ${isOpen ? 'rotate-180 text-[#005698]' : ''
                            }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveField(fKey, 'filters');
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded cursor-pointer shrink-0 ml-0.5"
                        title="Xóa bộ lọc này"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* DÒNG CHỌN CHỈ SỐ ĐO LƯỜNG (MEASURE) */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-600 uppercase tracking-wider flex items-center gap-1">
              <BarChart2 size={14} className="text-amber-500" /> Chỉ số đo lường:
            </span>
            <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
              {[
                { id: 'count', label: 'Số lượng xe (Chiếc)' },
                { id: 'nguyen_gia', label: 'Tổng nguyên giá (VNĐ)' },
                { id: 'tong_km', label: 'Tổng số Km (Km)' },
                { id: 'chi_phi', label: 'Tổng chi phí (VNĐ)' }
              ].map(m => {
                const isSelected = layout.valField === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleChangeMeasure(m.id as VehiclePivotMeasure)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                        ? 'bg-white text-[#005698] font-black shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-gray-400 italic">
            Mẹo: Kéo thả các trường để xoay ma trận hoặc sắp xếp lại thứ tự phân cấp Hàng
          </div>
        </div>
      </div>

      {/* ── BẢNG MA TRẬN PIVOT TABLE ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full shrink-0 overflow-hidden flex flex-col">
        {/* THANH ĐIỀU HƯỚNG & CÔNG CỤ NHANH TRÊN ĐẦU BẢNG (CỐ ĐỊNH, KHÔNG BỊ CUỘN THEO DỮ LIỆU) */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 via-sky-50/30 to-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Trái: Tiêu đề & Thông số tóm tắt */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#005698]/10 text-[#005698] flex items-center justify-center font-bold shrink-0">
              <TableProperties size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                  Bảng Thống kê phân tích
                </span>
              </div>
              <div className="text-[11.5px] text-gray-500 flex items-center gap-2 mt-0.5">
                <span>Quy mô: <strong className="text-gray-900 font-bold">{pivotData.grandTotalCount}</strong> xe</span>
                <span className="text-gray-300">•</span>
                <span>{pivotData.leafColumns.length} cột phân loại</span>
                <span className="text-gray-300">•</span>
                <span>
                  {currentMeasureLabel}: <strong className="text-[#005698] font-black">{formatTotalValue(pivotData.grandTotalAll)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Phải: Các nút thao tác mở rộng / thu gọn */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAllNodes}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-sky-50 hover:text-[#005698] hover:border-sky-300 border border-gray-200 rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
              title="Mở rộng tất cả các phân cấp chỉ tiêu"
            >
              <ChevronsUpDown size={14} className="text-[#005698]" />
              <span>Mở rộng tất cả</span>
            </button>

            <button
              type="button"
              onClick={handleCollapseAllNodes}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
              title="Thu gọn các phân cấp chỉ tiêu về nhánh gốc"
            >
              <ChevronsDownUp size={14} className="text-gray-500" />
              <span>Thu gọn tất cả</span>
            </button>
          </div>
        </div>

        {/* KHUNG CUỘN DỌC & NGANG PHÍA TRONG BẢNG (INTERNAL SCROLL CONTAINER CỐ ĐỊNH THEAD VÀ TFOOT) */}
        {pivotData.rootNodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
            <TableProperties size={48} className="text-gray-300 mb-3 animate-pulse" />
            <p className="text-sm font-bold text-gray-600">Không có dữ liệu phù hợp với bộ lọc hiện tại.</p>
            <p className="text-xs text-gray-400 mt-1">Hãy thử chọn mẫu khác hoặc thêm chỉ tiêu phân loại Hàng.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[520px] min-h-[300px] custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[700px]">
              {/* Tiêu đề bảng: Cố định ở đỉnh khi cuộn dọc */}
              <thead className="sticky top-0 z-20 shadow-xs">
                <tr className="bg-[#005698] text-white text-[11.5px] font-bold uppercase tracking-wider">
                  {/* Ô phân cấp hàng: Cố định cả đỉnh và cạnh trái */}
                  <th className="py-3 px-3.5 sticky top-0 left-0 z-30 bg-[#005698] border-r border-sky-800 min-w-[260px] shadow-2xs">
                    {layout.rows.map(r => VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === r)?.label || r).join(' ➔ ') || 'Chỉ tiêu'}
                  </th>

                  {/* Các Cột ngang */}
                  {pivotData.leafColumns.map(col => {
                    const isBrandCol = layout.cols.includes('hieu_xe');
                    return (
                      <th
                        key={col.key}
                        className="py-3 px-3 text-right border-r border-sky-800 min-w-[110px] whitespace-nowrap bg-[#005698]"
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isBrandCol ? (
                            renderBrandBadge(col.label, 'px-2 py-0.5 rounded text-[10px] font-bold shadow-2xs')
                          ) : (
                            <span>{col.label}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}

                  {/* Cột Tổng biên: Cố định ở đỉnh */}
                  <th className="py-3 px-3.5 text-right min-w-[130px] bg-[#00386b] whitespace-nowrap sticky top-0 z-20 border-l border-sky-800">
                    TỔNG CỘNG
                  </th>
                </tr>
              </thead>

              {/* Thân bảng */}
              <tbody className="divide-y divide-gray-100">
                {renderRowNodes(pivotData.rootNodes)}
              </tbody>

              {/* Dòng Tổng cộng Biên (Grand Total Row): Cố định ở đáy khi cuộn */}
              <tfoot className="sticky bottom-0 z-20 bg-sky-100 border-t-2 border-[#005698] text-gray-900 font-black shadow-md">
                <tr>
                  <td className="py-3 px-3.5 sticky bottom-0 left-0 z-30 bg-sky-200 border-r border-blue-200 text-xs uppercase tracking-wide text-[#005698] font-black shadow-2xs">
                    TỔNG CỘNG TOÀN BỘ ({pivotData.grandTotalCount} XE)
                  </td>

                  {pivotData.leafColumns.map(col => {
                    const val = pivotData.grandTotalByCol[col.key];
                    return (
                      <td
                        key={col.key}
                        className="py-3 px-3 text-right text-xs font-black text-[#005698] border-r border-blue-200 bg-sky-100"
                      >
                        {formatCellValue(val)}
                      </td>
                    );
                  })}

                  <td className="py-3 px-3.5 text-right text-xs font-black text-rose-700 bg-sky-200 border-l border-blue-200">
                    {formatTotalValue(pivotData.grandTotalAll)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── MENU DROPDOWN XỔ XUỐNG BỘ LỌC (FLOATING POPOVER NỔI ĐỘC LẬP) ── */}
      {activeFilterField && filterDropdownPos && (
        <div className="fixed inset-0 z-50 vehicle-filter-dropdown-container">
          {/* Backdrop đóng khi bấm ra ngoài */}
          <div
            className="fixed inset-0 bg-black/10 backdrop-blur-[0.5px]"
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
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[420px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5 truncate">
                <Filter size={14} className="text-[#005698] shrink-0" />
                <span className="font-bold text-xs text-gray-900 truncate">
                  Lọc: {VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === activeFilterField)?.label || activeFilterField}
                </span>
                {(layout.filters?.[activeFilterField] || []).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-[#005698] shrink-0">
                    Đã chọn {(layout.filters?.[activeFilterField] || []).length}/{activeFieldUniqueValues.length}
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
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
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
                placeholder={`Tìm ${VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === activeFilterField)?.label || 'giá trị'}...`}
                className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#005698] focus:border-[#005698]"
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

            {/* Hàng nút Chọn tất cả / Bỏ chọn */}
            <div className="flex items-center justify-between text-xs px-1 mb-2 pb-1.5 border-b border-gray-100">
              <button
                type="button"
                onClick={() => handleSelectAllFilter(true)}
                className="text-[#005698] font-bold hover:underline cursor-pointer text-[11px]"
              >
                Chọn tất cả ({activeFieldUniqueValues.length})
              </button>
              <button
                type="button"
                onClick={() => handleSelectAllFilter(false)}
                className="text-gray-500 hover:text-red-500 font-bold hover:underline cursor-pointer text-[11px]"
              >
                Bỏ chọn tất cả
              </button>
            </div>

            {/* Danh sách Checkbox cuộn mượt */}
            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-0.5 divide-y divide-gray-50">
              {filteredActiveValues.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400 italic">
                  Không tìm thấy giá trị phù hợp
                </div>
              ) : (
                filteredActiveValues.map(({ key, label, count }) => {
                  const isChecked = (layout.filters?.[activeFilterField] || []).includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center justify-between px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${isChecked
                          ? 'bg-sky-50 font-semibold text-[#005698]'
                          : 'hover:bg-gray-50 text-gray-700'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFilterValue(key)}
                          className="rounded border-gray-300 text-[#005698] focus:ring-[#005698] cursor-pointer shrink-0"
                        />
                        {activeFilterField === 'hieu_xe' ? (
                          renderBrandBadge(label, 'px-1.5 py-0.5 rounded text-[10px] font-bold')
                        ) : (
                          <span className="truncate" title={label}>{label}</span>
                        )}
                      </div>
                      <span className="text-[10.5px] text-gray-400 font-mono shrink-0">
                        {count} xe
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10.5px] text-gray-400 italic">
                {(layout.filters?.[activeFilterField] || []).length === 0
                  ? 'Đang hiển thị tất cả'
                  : `Đã lọc ${(layout.filters?.[activeFilterField] || []).length} mục`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveFilterField(null);
                  setFilterDropdownPos(null);
                  setFilterSearchTerm('');
                }}
                className="px-3 py-1 bg-[#005698] hover:bg-[#00386b] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
