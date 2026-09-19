import React, { useMemo } from 'react';
import { MapPin, X, ChevronRight, Building2, Store } from 'lucide-react';
import { DonVi, VehicleLocationData } from '../../types';
import { sortDonViByThuTu, groupParentUnits, getUnitEmoji } from '../../utils/hierarchy';
import { parseVehicleLocation, stringifyVehicleLocation } from '../../utils/vehicleLocationHelper';

interface VehicleLocationPickerProps {
  value: string | VehicleLocationData | null;
  onChange: (val: string | null) => void;
  donViList: DonVi[];
  disabled?: boolean;
}

export const VehicleLocationPicker: React.FC<VehicleLocationPickerProps> = ({
  value,
  onChange,
  donViList,
  disabled = false
}) => {
  const currentLoc = useMemo(() => parseVehicleLocation(value), [value]);

  // 1. Danh sách Đơn vị Cấp 1 (Đơn vị mẹ / CTTT / VPĐH / Root)
  const cap1Options = useMemo(() => {
    const rawRoots = donViList.filter(
      u => !u.cap_quan_ly || u.cap_quan_ly === 'HO' || u.cap_quan_ly === 'DV_HO'
    );
    const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = groupParentUnits(rawRoots);
    return [...vpdhUnits, ...ctttNamUnits, ...ctttBacUnits, ...otherUnits];
  }, [donViList]);

  // 2. Danh sách Đơn vị Cấp 2 (Trực thuộc Cấp 1 đã chọn)
  const cap2Options = useMemo(() => {
    if (!currentLoc.cap1_id) return [];
    return sortDonViByThuTu(donViList.filter(u => u.cap_quan_ly === currentLoc.cap1_id));
  }, [donViList, currentLoc.cap1_id]);

  // 3. Danh sách Đơn vị Cấp 3 (Trực thuộc Cấp 2 đã chọn)
  const cap3Options = useMemo(() => {
    if (!currentLoc.cap2_id) return [];
    return sortDonViByThuTu(donViList.filter(u => u.cap_quan_ly === currentLoc.cap2_id));
  }, [donViList, currentLoc.cap2_id]);

  // Handler khi thay đổi Cấp 1
  const handleCap1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCap1Id = e.target.value;
    if (!newCap1Id) {
      onChange(null);
      return;
    }
    const unit1 = donViList.find(u => u.id === newCap1Id);
    const cap1Ten = unit1?.ten_don_vi || '';
    const newLoc: VehicleLocationData = {
      cap1_id: newCap1Id,
      cap1_ten: cap1Ten,
      dia_chi_day_du: cap1Ten
    };
    onChange(stringifyVehicleLocation(newLoc));
  };

  // Handler khi thay đổi Cấp 2
  const handleCap2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCap2Id = e.target.value;
    const unit2 = donViList.find(u => u.id === newCap2Id);
    const cap2Ten = unit2?.ten_don_vi || '';

    const newLoc: VehicleLocationData = {
      cap1_id: currentLoc.cap1_id,
      cap1_ten: currentLoc.cap1_ten,
      cap2_id: newCap2Id || undefined,
      cap2_ten: cap2Ten || undefined,
      dia_chi_day_du: [currentLoc.cap1_ten, cap2Ten].filter(Boolean).join(' > ')
    };
    onChange(stringifyVehicleLocation(newLoc));
  };

  // Handler khi thay đổi Cấp 3
  const handleCap3Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCap3Id = e.target.value;
    const unit3 = donViList.find(u => u.id === newCap3Id);
    const cap3Ten = unit3?.ten_don_vi || '';

    const newLoc: VehicleLocationData = {
      cap1_id: currentLoc.cap1_id,
      cap1_ten: currentLoc.cap1_ten,
      cap2_id: currentLoc.cap2_id,
      cap2_ten: currentLoc.cap2_ten,
      cap3_id: newCap3Id || undefined,
      cap3_ten: cap3Ten || undefined,
      dia_chi_day_du: [currentLoc.cap1_ten, currentLoc.cap2_ten, cap3Ten].filter(Boolean).join(' > ')
    };
    onChange(stringifyVehicleLocation(newLoc));
  };

  const handleClear = () => {
    onChange(null);
  };

  const hasSelection = Boolean(currentLoc.cap1_id || currentLoc.dia_chi_day_du);
  const isOldFormat = !currentLoc.cap1_id && Boolean(currentLoc.dia_chi_day_du);

  return (
    <div className="space-y-2">
      {/* Tiêu đề & Nút xóa chọn */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <MapPin size={14} className="text-blue-600" />
          <span>Địa điểm sử dụng (Phân cấp 3 cấp)</span>
        </label>
        {hasSelection && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-50"
            title="Xóa địa điểm đã chọn"
          >
            <X size={12} />
            <span>Xóa chọn</span>
          </button>
        )}
      </div>

      {/* Cụm 3 Dropdown chọn theo cấp */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Cấp 1: Đơn vị Mẹ / CTTT / VPĐH */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
            <Building2 size={11} className="text-gray-400" /> CT Tỉnh thành)
          </label>
          <select
            value={currentLoc.cap1_id || ''}
            onChange={handleCap1Change}
            disabled={disabled}
            className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] disabled:opacity-50 font-medium text-gray-800"
          >
            <option value="">-- Chọn Đơn vị Mẹ --</option>
            {cap1Options.map(u => (
              <option key={u.id} value={u.id}>
                {getUnitEmoji(u.loai_hinh)} {u.ten_don_vi}
              </option>
            ))}
          </select>
        </div>

        {/* Cấp 2: Đơn vị Con / Showroom Quản trị */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
            <Store size={11} className="text-gray-400" /> Showrrom
          </label>
          <select
            value={currentLoc.cap2_id || ''}
            onChange={handleCap2Change}
            disabled={disabled || !currentLoc.cap1_id || cap2Options.length === 0}
            className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] disabled:opacity-40 font-medium text-gray-800"
          >
            <option value="">
              {!currentLoc.cap1_id
                ? '-- Chọn Cấp 1 trước --'
                : cap2Options.length === 0
                ? '-- Không có cấp con --'
                : '-- Chọn Đơn vị con --'}
            </option>
            {cap2Options.map(u => (
              <option key={u.id} value={u.id}>
                {getUnitEmoji(u.loai_hinh)} {u.ten_don_vi}
              </option>
            ))}
          </select>
        </div>

        {/* Cấp 3: Đơn vị Cháu / Showroom Thương hiệu / Điểm KD */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
            <MapPin size={11} className="text-gray-400" /> Showroom/ĐBH
          </label>
          <select
            value={currentLoc.cap3_id || ''}
            onChange={handleCap3Change}
            disabled={disabled || !currentLoc.cap2_id || cap3Options.length === 0}
            className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-[#05469B] disabled:opacity-40 font-medium text-gray-800"
          >
            <option value="">
              {!currentLoc.cap2_id
                ? '-- Chọn Cấp 2 trước --'
                : cap3Options.length === 0
                ? '-- Không có cấp cháu --'
                : '-- Chọn Đơn vị cháu --'}
            </option>
            {cap3Options.map(u => (
              <option key={u.id} value={u.id}>
                {getUnitEmoji(u.loai_hinh)} {u.ten_don_vi}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview đường dẫn phân cấp */}
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/60 rounded-lg border border-blue-100 text-[11px] text-gray-700">
          <span className="font-bold text-[#05469B] shrink-0">Lộ trình:</span>
          {isOldFormat ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
              Văn bản cũ: {currentLoc.dia_chi_day_du} (Hãy chọn 3 cấp ở trên để chuẩn hóa)
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {currentLoc.cap1_ten && (
                <span className="font-bold text-blue-900 bg-white px-2 py-0.5 rounded shadow-2xs border border-blue-200">
                  🏢 {currentLoc.cap1_ten}
                </span>
              )}
              {currentLoc.cap2_ten && (
                <>
                  <ChevronRight size={13} className="text-blue-400 shrink-0" />
                  <span className="font-bold text-indigo-900 bg-white px-2 py-0.5 rounded shadow-2xs border border-indigo-200">
                    🏬 {currentLoc.cap2_ten}
                  </span>
                </>
              )}
              {currentLoc.cap3_ten && (
                <>
                  <ChevronRight size={13} className="text-blue-400 shrink-0" />
                  <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded shadow-2xs border border-emerald-200">
                    📍 {currentLoc.cap3_ten}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
