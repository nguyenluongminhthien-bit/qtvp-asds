import React, { useMemo } from 'react';
import { Search, MapPin, PanelLeftClose, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { DonVi } from '../../types';
import { getUnitEmoji, sortDonViByThuTu, groupParentUnits } from '../../utils/hierarchy';

interface UnitFilterSidebarProps {
  donViList: DonVi[];
  selectedUnitFilter: string | null;
  setSelectedUnitFilter: (id: string | null) => void;
  allowedDonViIds: string[];
  unitSearchTerm: string;
  setUnitSearchTerm: (term: string) => void;
  expandedParents: string[];
  setExpandedParents: React.Dispatch<React.SetStateAction<string[]>>;
  isListCollapsed: boolean;
  setIsListCollapsed: (collapsed: boolean) => void;
  themeColor?: 'blue' | 'emerald' | 'red';
  allUnitsLabel?: string;
}

export default function UnitFilterSidebar({
  donViList,
  selectedUnitFilter,
  setSelectedUnitFilter,
  allowedDonViIds,
  unitSearchTerm,
  setUnitSearchTerm,
  expandedParents,
  setExpandedParents,
  isListCollapsed,
  setIsListCollapsed,
  themeColor = 'blue',
  allUnitsLabel = 'Tất cả Đơn vị Toàn quốc'
}: UnitFilterSidebarProps) {
  
  // 🟢 HỆ THỐNG MÀU THEO CHỦ ĐỀ
  const colors = {
    blue: {
      text: 'text-[#05469B]',
      bgActive: 'bg-blue-50 text-[#05469B] border border-blue-100',
      ring: 'focus:ring-[#05469B]',
      iconActive: 'text-[#05469B]',
      hoverText: 'hover:text-[#05469B]'
    },
    emerald: {
      text: 'text-emerald-700',
      bgActive: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      ring: 'focus:ring-emerald-600',
      iconActive: 'text-emerald-700',
      hoverText: 'hover:text-emerald-700'
    },
    red: {
      text: 'text-red-600',
      bgActive: 'bg-red-50 text-red-600 border border-red-100',
      ring: 'focus:ring-red-600',
      iconActive: 'text-red-600',
      hoverText: 'hover:text-red-600'
    }
  }[themeColor];

  const filteredUnits = useMemo(() => {
    let baseUnits = donViList.filter(dv => allowedDonViIds.includes(dv.id));
    if (!unitSearchTerm) return baseUnits;

    const lower = unitSearchTerm.toLowerCase();
    const matchedIds = new Set<string>();

    baseUnits.forEach(u => {
      if (String(u.ten_don_vi || '').toLowerCase().includes(lower) || String(u.id || '').toLowerCase().includes(lower)) {
        matchedIds.add(u.id);
        let parentId = u.cap_quan_ly;
        while (parentId && parentId !== 'HO') {
          matchedIds.add(parentId);
          const parentUnit = baseUnits.find(p => p.id === parentId);
          parentId = parentUnit ? parentUnit.cap_quan_ly : null;
        }
      }
    });

    const addChildren = (parentId: string) => {
      baseUnits.forEach(u => {
        if (u.cap_quan_ly === parentId && !matchedIds.has(u.id)) {
          matchedIds.add(u.id);
          addChildren(u.id);
        }
      });
    };
    
    const initialMatches = Array.from(matchedIds);
    initialMatches.forEach(id => addChildren(id));

    return baseUnits.filter(item => matchedIds.has(item.id));
  }, [donViList, unitSearchTerm, allowedDonViIds]);

  const parentUnits = useMemo(() => filteredUnits.filter(item => item.cap_quan_ly === 'HO' || !item.cap_quan_ly), [filteredUnits]);
  const getChildUnits = (parentId: string) => sortDonViByThuTu(filteredUnits.filter(item => item.cap_quan_ly === parentId));

  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = useMemo(() => {
    return groupParentUnits(parentUnits);
  }, [parentUnits]);

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]);
  };

  const renderUnitTree = (parent: DonVi, level: number = 1) => {
    const children = getChildUnits(parent.id);
    const isExpanded = expandedParents.includes(parent.id) || !!unitSearchTerm;
    const isParentDimmed = parent.trang_thai === 'Đại lý' || parent.trang_thai === 'Đầu tư mới';
    
    return (
      <div key={parent.id} className={level === 1 ? "mb-1" : "mt-1"}>
        <button
          onClick={() => {
            setSelectedUnitFilter(parent.id);
            if (children.length > 0) toggleParent(parent.id);
            if (window.innerWidth < 1024) setIsListCollapsed(true);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            selectedUnitFilter === parent.id ? colors.bgActive : 'text-gray-700 hover:bg-gray-50'
          } ${isParentDimmed ? 'opacity-50' : ''}`}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />
          ) : (
            <div className="w-4 shrink-0" />
          )}
          <span className="shrink-0">{getUnitEmoji(parent.loai_hinh)}</span>
          <span className="truncate text-left">{parent.ten_don_vi}</span>
        </button>
        {isExpanded && children.length > 0 && (
          <div className={`mt-1 border-l-2 border-gray-100 pl-2 space-y-1 ${level === 1 ? 'ml-6' : 'ml-4'}`}>
            {children.map(child => renderUnitTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${
        isListCollapsed ? 'lg:w-80 lg:-ml-80 lg:relative lg:opacity-0' : 'w-80 opacity-100 absolute lg:relative inset-y-0 left-0 z-50 lg:z-10'
      } transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl lg:shadow-sm shrink-0 overflow-hidden ${isListCollapsed ? 'hidden lg:flex' : 'flex'}`}
    >
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-bold ${colors.text} flex items-center gap-2 whitespace-nowrap`}>
            <MapPin size={20} /> Bộ lọc Đơn vị
          </h2>
          <button
            onClick={() => setIsListCollapsed(true)}
            className={`p-1.5 text-gray-400 ${colors.hoverText} hover:bg-blue-50/50 rounded-md transition-colors cursor-pointer`}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Tìm tên showroom..."
            className={`w-full pl-9 pr-4 py-2 bg-[#FFFFF0] border border-gray-200 rounded-lg text-sm ${colors.ring} outline-none focus:ring-2`}
            value={unitSearchTerm}
            onChange={(e) => setUnitSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-w-[319px]">
        <button
          onClick={() => {
            setSelectedUnitFilter(null);
            if (window.innerWidth < 1024) setIsListCollapsed(true);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold mb-4 transition-colors ${
            selectedUnitFilter === null ? colors.bgActive : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Users size={18} className={selectedUnitFilter === null ? colors.iconActive : 'text-gray-400'} />
          {allUnitsLabel}
        </button>
        <hr className="border-gray-100 mb-4 mx-2" />

        {parentUnits.length === 0 ? (
          <div className="text-center p-4 text-sm text-gray-500">Không tìm thấy đơn vị.</div>
        ) : (
          <>
            {vpdhUnits.length > 0 && (
              <div className="mb-6">
                <p className={`px-3 text-[10px] font-black ${colors.text} uppercase tracking-wider mb-2`}>VPĐH</p>
                {vpdhUnits.map(dv => renderUnitTree(dv, 1))}
              </div>
            )}
            {ctttNamUnits.length > 0 && (
              <div className="mb-6">
                <p className={`px-3 text-[10px] font-black ${colors.text} uppercase tracking-wider mb-2`}>CTTT Phía Nam</p>
                {ctttNamUnits.map(dv => renderUnitTree(dv, 1))}
              </div>
            )}
            {ctttBacUnits.length > 0 && (
              <div className="mb-6">
                <p className={`px-3 text-[10px] font-black ${colors.text} uppercase tracking-wider mb-2`}>CTTT Phía Bắc</p>
                {ctttBacUnits.map(dv => renderUnitTree(dv, 1))}
              </div>
            )}
            {otherUnits.length > 0 && (
              <div className="mb-6">
                <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Đơn vị khác</p>
                {otherUnits.map(dv => renderUnitTree(dv, 1))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
