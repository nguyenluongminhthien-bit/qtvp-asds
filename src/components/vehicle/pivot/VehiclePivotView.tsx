import React, { useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { TS_Xe, DonVi } from '../../../types';
import {
  VehiclePivotFieldKey,
  VehiclePivotMeasure,
  VehiclePivotLayoutConfig,
  VEHICLE_PIVOT_AVAILABLE_FIELDS,
  VEHICLE_PIVOT_PRESETS,
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

export default function VehiclePivotView({
  cars,
  donViList,
  donViMap,
  nhatKyData = [],
  chiPhiData = []
}: Props) {
  // 1. Preset & Layout State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset_unit_purpose');
  const [layout, setLayout] = useState<VehiclePivotLayoutConfig>(() => {
    const p = VEHICLE_PIVOT_PRESETS[0];
    return JSON.parse(JSON.stringify(p.layout));
  });

  // State mở rộng/thu gọn các node trong cây
  const [collapsedNodeKeys, setCollapsedNodeKeys] = useState<Set<string>>(new Set());

  // Trạng thái Kéo - Thả
  const [draggedItem, setDraggedItem] = useState<DragItemState | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'rows' | 'cols' | 'filters' | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // Trạng thái Popup Bộ lọc
  const [activeFilterField, setActiveFilterField] = useState<VehiclePivotFieldKey | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

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
      badgeBg: 'bg-indigo-50/80 text-indigo-700 border-indigo-200 hover:border-indigo-400',
      fields: VEHICLE_PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Đơn vị & Địa bàn')
    },
    {
      category: 'Đặc tính Xe' as const,
      icon: Car,
      title: 'Đặc tính xe',
      colorIcon: 'text-sky-600',
      badgeBg: 'bg-sky-50/80 text-sky-700 border-sky-200 hover:border-sky-400',
      fields: VEHICLE_PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Đặc tính Xe')
    },
    {
      category: 'Hiện trạng & Pháp lý' as const,
      icon: ShieldCheck,
      title: 'Hiện trạng & Pháp nhân',
      colorIcon: 'text-amber-600',
      badgeBg: 'bg-amber-50/80 text-amber-800 border-amber-200 hover:border-amber-400',
      fields: VEHICLE_PIVOT_AVAILABLE_FIELDS.filter(f => f.category === 'Hiện trạng & Pháp lý')
    }
  ], []);

  // Handler đổi preset
  const handleSelectPreset = (presetId: string) => {
    const preset = VEHICLE_PIVOT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(preset.id);
      setLayout(JSON.parse(JSON.stringify(preset.layout)));
      setCollapsedNodeKeys(new Set());
    }
  };

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
    const currentPreset = VEHICLE_PIVOT_PRESETS.find(p => p.id === selectedPresetId);
    const configName = currentPreset ? currentPreset.name : 'Tùy biến';
    const rowFieldLabels = layout.rowFields.map(f => VEHICLE_PIVOT_AVAILABLE_FIELDS.find(af => af.key === f)?.label || f);
    exportVehiclePivotExcel({
      configName,
      data: pivotData,
      rowFieldLabels,
      valField: layout.valField
    });
  };

  // Reset về mặc định
  const handleReset = () => {
    const p = VEHICLE_PIVOT_PRESETS[0];
    setSelectedPresetId(p.id);
    setLayout(JSON.parse(JSON.stringify(p.layout)));
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

  // Chọn tất cả / Bỏ chọn trong modal
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

  // Đệ quy hiển thị các node của cây (Rows)
  const renderRowNodes = (nodes: VehiclePivotNode[]): React.ReactNode => {
    return nodes.map(node => {
      const isParent = node.children && node.children.length > 0;
      const isCollapsed = collapsedNodeKeys.has(node.key);
      const isBrandRow = node.field === 'hieu_xe';

      return (
        <React.Fragment key={node.key}>
          <tr
            className={`border-b border-gray-100 transition-colors ${
              node.depth === 0
                ? 'bg-sky-50/40 hover:bg-sky-50 font-bold text-gray-900'
                : node.depth === 1
                ? 'bg-white hover:bg-gray-50/80 text-gray-800'
                : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            {/* Cột Tên Phân Cấp Hàng */}
            <td
              className="py-2 px-3 sticky left-0 z-10 bg-inherit border-r border-gray-200"
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
                  className={`py-2 px-3 text-right text-xs align-middle border-r border-gray-100 ${
                    hasVal
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
              className={`py-2 px-3 text-right text-xs align-middle bg-slate-50/50 ${
                node.depth === 0
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
    <div className="space-y-4 flex flex-col h-full">
      {/* ── HEADER & PRESETS ── */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs shrink-0 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#005698] to-[#00386b] text-white shadow-xs">
              <TableProperties size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 tracking-tight">
                Báo cáo Thống kê Đa chiều (Pivot Table)
              </h3>
              <p className="text-xs text-gray-500">
                Xoay lật và phân tích toàn diện dữ liệu {cars.length} phương tiện theo chuẩn Quản trị
              </p>
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

        {/* Danh sách nút Preset mẫu nhanh */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
            Mẫu nhanh:
          </span>
          {VEHICLE_PIVOT_PRESETS.map(preset => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'bg-[#005698] text-white shadow-xs font-black ring-2 ring-[#005698]/30'
                    : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-[#005698] border border-gray-200'
                }`}
                title={preset.description}
              >
                <span>📌 {preset.name}</span>
              </button>
            );
          })}
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
                            className={`group flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing transition-all select-none border ${
                              isUsed
                                ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs font-bold'
                                : `${grp.badgeBg} border`
                            }`}
                            title={`Kéo '${f.label}' vào Hàng, Cột hoặc Bộ lọc`}
                          >
                            <GripVertical size={11} className="text-gray-400 group-hover:text-amber-600 shrink-0 -ml-0.5" />
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
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${
              dragOverZone === 'rows'
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
                      className={`flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border text-xs shadow-2xs font-bold text-gray-800 transition-all cursor-grab active:cursor-grabbing ${
                        isBeingDragged ? 'opacity-40 ring-2 ring-[#005698]' : ''
                      } ${
                        dragOverRowIndex === idx && draggedItem?.fieldKey !== rKey
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
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${
              dragOverZone === 'cols'
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
            className={`p-3 rounded-xl flex flex-col space-y-2 transition-all ${
              dragOverZone === 'filters'
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
                  return (
                    <div
                      key={fKey}
                      onClick={() => setActiveFilterField(fKey as VehiclePivotFieldKey)}
                      className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-purple-200 text-xs shadow-2xs font-bold text-purple-900 cursor-pointer hover:border-purple-400 hover:bg-purple-50/40 transition-colors"
                      title="Nhấp để tùy chỉnh giá trị lọc"
                    >
                      <div className="flex items-center gap-1 truncate">
                        <span className="truncate">{meta?.label || fKey}</span>
                        {selectedValues.length > 0 ? (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold shrink-0">
                            ({selectedValues.length})
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-normal shrink-0">
                            (Tất cả)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveField(fKey, 'filters');
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded cursor-pointer"
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
              <BarChart2 size={14} className="text-amber-500" /> Chỉ số đo lường (Values):
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
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full flex-1 min-h-[400px] overflow-auto custom-scrollbar flex flex-col">
        {pivotData.rootNodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
            <TableProperties size={48} className="text-gray-300 mb-3 animate-pulse" />
            <p className="text-sm font-bold text-gray-600">Không có dữ liệu phù hợp với bộ lọc hiện tại.</p>
            <p className="text-xs text-gray-400 mt-1">Hãy thử chọn mẫu khác hoặc thêm chỉ tiêu phân loại Hàng.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            {/* Table Header */}
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-[#005698] text-white text-[11.5px] font-bold uppercase tracking-wider">
                {/* Cột Chiều phân loại */}
                <th className="py-3 px-3.5 sticky left-0 z-30 bg-[#005698] border-r border-sky-800 min-w-[260px]">
                  {layout.rows.map(r => VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === r)?.label || r).join(' ➔ ') || 'Chỉ tiêu'}
                </th>

                {/* Các Cột ngang */}
                {pivotData.leafColumns.map(col => {
                  const isBrandCol = layout.cols.includes('hieu_xe');
                  return (
                    <th
                      key={col.key}
                      className="py-3 px-3 text-right border-r border-sky-800 min-w-[110px] whitespace-nowrap"
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

                {/* Cột Tổng biên */}
                <th className="py-3 px-3.5 text-right min-w-[130px] bg-[#00386b] whitespace-nowrap">
                  TỔNG CỘNG
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {renderRowNodes(pivotData.rootNodes)}

              {/* Dòng Tổng cộng Biên (Grand Total Row) */}
              <tr className="sticky bottom-0 z-20 bg-sky-100 border-t-2 border-[#005698] text-gray-900 font-black shadow-xs">
                <td className="py-3 px-3.5 sticky left-0 z-30 bg-sky-100 border-r border-blue-200 text-xs uppercase tracking-wide text-[#005698]">
                  TỔNG CỘNG TOÀN BỘ ({pivotData.grandTotalCount} XE)
                </td>

                {pivotData.leafColumns.map(col => {
                  const val = pivotData.grandTotalByCol[col.key];
                  return (
                    <td
                      key={col.key}
                      className="py-3 px-3 text-right text-xs font-black text-[#005698] border-r border-blue-200"
                    >
                      {formatCellValue(val)}
                    </td>
                  );
                })}

                <td className="py-3 px-3.5 text-right text-xs font-black text-rose-700 bg-sky-200/80">
                  {formatTotalValue(pivotData.grandTotalAll)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL POPUP BỘ LỌC ĐA CHIỀU ── */}
      {activeFilterField && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-[#005698]" />
                <h4 className="font-bold text-gray-900 text-sm">
                  Lọc giá trị: {VEHICLE_PIVOT_AVAILABLE_FIELDS.find(f => f.key === activeFilterField)?.label || activeFilterField}
                </h4>
              </div>
              <button
                onClick={() => {
                  setActiveFilterField(null);
                  setFilterSearchTerm('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Ô tìm kiếm */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filterSearchTerm}
                  onChange={(e) => setFilterSearchTerm(e.target.value)}
                  placeholder="Tìm giá trị lọc..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#005698]"
                />
              </div>

              {/* Nút Chọn tất cả / Bỏ chọn */}
              <div className="flex items-center justify-between text-xs px-1">
                <button
                  type="button"
                  onClick={() => handleSelectAllFilter(true)}
                  className="text-[#005698] font-bold hover:underline cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllFilter(false)}
                  className="text-gray-500 hover:text-red-500 font-bold hover:underline cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              {/* Danh sách Checkbox */}
              <div className="max-h-60 overflow-y-auto custom-scrollbar border border-gray-100 rounded-xl divide-y divide-gray-50 p-1">
                {filteredActiveValues.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">Không tìm thấy giá trị phù hợp</p>
                ) : (
                  filteredActiveValues.map(({ key, label, count }) => {
                    const isChecked = (layout.filters?.[activeFilterField] || []).includes(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center justify-between px-3 py-2 hover:bg-sky-50/60 rounded-lg cursor-pointer transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilterValue(key)}
                            className="rounded border-gray-300 text-[#005698] focus:ring-[#005698]"
                          />
                          {activeFilterField === 'hieu_xe' ? (
                            renderBrandBadge(label, 'px-1.5 py-0.5 rounded text-[10px] font-bold')
                          ) : (
                            <span className="text-gray-800 font-medium">{label}</span>
                          )}
                        </div>
                        <span className="text-[10.5px] text-gray-400 font-mono">
                          {count} xe
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveFilterField(null);
                  setFilterSearchTerm('');
                }}
                className="px-4 py-2 bg-[#005698] hover:bg-[#00386b] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
