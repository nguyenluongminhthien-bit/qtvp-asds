import React, { useState } from 'react';
import { 
  Lock, Unlock, Copy, Save, Plus, Trash2, Edit2, Download, 
  ChevronDown, Star, Sparkles, AlertCircle, RefreshCw, Check
} from 'lucide-react';
import { ChiPhiPivotConfig } from '../../../types';

interface Props {
  configs: ChiPhiPivotConfig[];
  activeConfigId: string;
  onSelectConfig: (configId: string) => void;
  onCloneConfig: (cloneName: string) => void;
  onSaveConfig: () => void;
  onSaveAsNewConfig: (newName: string) => void;
  onRenameConfig: (newName: string) => void;
  onDeleteConfig: (configId: string) => void;
  onExportExcel: () => void;
  onRefreshData?: () => void;
  loading?: boolean;
  canModifyConfig?: boolean;
  canClonePivot?: boolean;
  isAdmin?: boolean;
}

export default function PivotConfigBar({
  configs,
  activeConfigId,
  onSelectConfig,
  onCloneConfig,
  onSaveConfig,
  onSaveAsNewConfig,
  onRenameConfig,
  onDeleteConfig,
  onExportExcel,
  onRefreshData,
  loading = false,
  canModifyConfig = true,
  canClonePivot = true,
  isAdmin = false
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const currentConfig = configs.find(c => c.id === activeConfigId) || configs[0];

  const handleOpenClone = () => {
    setCloneName(`Báo cáo tuỳ chỉnh từ ${currentConfig?.ten_cau_hinh || 'Báo cáo'}`);
    setCloneModalOpen(true);
  };

  const handleConfirmClone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneName.trim()) return;
    onCloneConfig(cloneName.trim());
    setCloneModalOpen(false);
  };

  const handleOpenSaveAs = () => {
    setSaveAsName(`Bản sao của ${currentConfig?.ten_cau_hinh || 'Báo cáo'}`);
    setSaveAsModalOpen(true);
  };

  const handleConfirmSaveAs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveAsName.trim()) return;
    onSaveAsNewConfig(saveAsName.trim());
    setSaveAsModalOpen(false);
  };

  const handleOpenRename = () => {
    setRenameValue(currentConfig?.ten_cau_hinh || '');
    setRenameModalOpen(true);
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    onRenameConfig(renameValue.trim());
    setRenameModalOpen(false);
  };

  // Tách cấu hình hệ thống và cấu hình đơn vị
  const systemConfigs = configs.filter(c => c.la_mac_dinh || !c.id_don_vi);
  const unitConfigs = configs.filter(c => !c.la_mac_dinh && c.id_don_vi);

  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
      
      {/* 1. KHU VỰC CHỌN CẤU HÌNH (Dropdown Selector) */}
      <div className="flex items-center gap-2 relative">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">
          Cấu hình:
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-bold text-[#D97706] hover:bg-amber-100/60 transition-all cursor-pointer shadow-2xs"
            title="Nhấn để chọn cấu hình báo cáo đã lưu"
          >
            {currentConfig?.la_mac_dinh && <Star size={13} className="fill-amber-500 text-amber-500 shrink-0" />}
            <span className="max-w-[260px] truncate">{currentConfig?.ten_cau_hinh || 'Chọn cấu hình'}</span>
            {currentConfig?.ten_don_vi && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-amber-100 dark:bg-amber-900/60 text-[#b45309] dark:text-amber-300 shrink-0">
                {currentConfig.ten_don_vi}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Menu Dropdown các cấu hình đã lưu */}
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 top-full mt-1.5 w-84 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {/* Nhóm 1: Mẫu chuẩn Hệ thống */}
                  {systemConfigs.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700/60 bg-gray-50/50 dark:bg-slate-850">
                        Cấu hình Chuẩn Hệ thống
                      </div>
                      {systemConfigs.map(cfg => {
                        const isSelected = cfg.id === currentConfig?.id;
                        return (
                          <button
                            key={cfg.id}
                            type="button"
                            onClick={() => {
                              onSelectConfig(cfg.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-amber-50 dark:bg-slate-700 font-bold text-[#D97706]' 
                                : 'hover:bg-gray-50 dark:hover:bg-slate-700/60 text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Star size={12} className="fill-amber-500 text-amber-500 shrink-0" />
                              <span className="truncate">{cfg.ten_cau_hinh}</span>
                            </div>
                            {isSelected && <Check size={14} className="text-[#D97706] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Nhóm 2: Mẫu Đơn vị */}
                  {unitConfigs.length > 0 && (
                    <div className={systemConfigs.length > 0 ? 'mt-2' : ''}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700/60 bg-blue-50/30 dark:bg-slate-850 flex items-center justify-between">
                        <span>Báo cáo Tùy biến Đơn vị</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-normal">
                          {unitConfigs.length} mẫu
                        </span>
                      </div>
                      {unitConfigs.map(cfg => {
                        const isSelected = cfg.id === currentConfig?.id;
                        return (
                          <button
                            key={cfg.id}
                            type="button"
                            onClick={() => {
                              onSelectConfig(cfg.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-amber-50 dark:bg-slate-700 font-bold text-[#D97706]' 
                                : 'hover:bg-gray-50 dark:hover:bg-slate-700/60 text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0" />
                              <span className="truncate">{cfg.ten_cau_hinh}</span>
                              {(cfg.ten_don_vi || cfg.id_don_vi) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 shrink-0 border border-blue-100 dark:border-blue-900/50">
                                  {cfg.ten_don_vi || cfg.id_don_vi}
                                </span>
                              )}
                            </div>
                            {isSelected && <Check size={14} className="text-[#D97706] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. CÁC NÚT THAO TÁC CẤU HÌNH & XUẤT EXCEL */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Nút Refresh nếu có */}
        {onRefreshData && (
          <button
            type="button"
            onClick={onRefreshData}
            disabled={loading}
            className="p-1.5 text-gray-500 hover:text-[#D97706] hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 transition-all cursor-pointer shadow-2xs"
            title="Làm mới dữ liệu từ Supabase"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#D97706]' : ''} />
          </button>
        )}

        {/* Trường hợp 1: Cấu hình ĐÃ KHÓA hoặc Người dùng KHÔNG CÓ QUYỀN SỬA -> Nút Báo cáo tuỳ chỉnh */}
        {currentConfig?.khoa || !canModifyConfig ? (
          canClonePivot ? (
            <button
              type="button"
              onClick={handleOpenClone}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#D97706] to-[#b45309] hover:from-[#b45309] hover:to-[#92400e] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              title="Tạo báo cáo tùy chỉnh có thể tự do kéo-thả và phân tích số liệu"
            >
              <Copy size={13} />
              <span>Báo cáo tuỳ chỉnh</span>
            </button>
          ) : null
        ) : (
          /* Trường hợp 2: Cấu hình TỰ DO và CÓ QUYỀN SỬA (khoa = false && canModifyConfig) -> Nút Lưu, Lưu mới, Đổi tên, Xóa */
          <>
            <button
              type="button"
              onClick={onSaveConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              title="Lưu các thay đổi trên cấu hình hiện tại"
            >
              <Save size={13} />
              <span>Lưu</span>
            </button>

            <button
              type="button"
              onClick={handleOpenSaveAs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:text-[#D97706] rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Lưu thành một cấu hình báo cáo mới"
            >
              <Plus size={13} />
              <span>Lưu thành mới</span>
            </button>

            <button
              type="button"
              onClick={handleOpenRename}
              className="p-1.5 text-gray-500 hover:text-[#D97706] hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
              title="Đổi tên cấu hình này"
            >
              <Edit2 size={13} />
            </button>

            {!currentConfig?.la_mac_dinh && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                title="Xóa cấu hình báo cáo này"
              >
                <Trash2 size={13} />
              </button>
            )}
          </>
        )}

        {/* Nút Xuất Excel */}
        <button
          type="button"
          onClick={onExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#006633] hover:bg-[#004d26] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          title={
            currentConfig?.loai_renderer === 'matrix_thaco'
              ? 'Xuất file Excel đa sheet theo mẫu báo cáo mặc định'
              : 'Xuất file Excel 1 sheet có đóng băng tiêu đề & phân cấp'
          }
        >
          <Download size={13} />
          <span>Xuất Excel</span>
        </button>
      </div>

      {/* Modal Tạo Báo cáo tuỳ chỉnh (Clone) */}
      {cloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Copy className="text-[#D97706]" size={18} />
              <span>Tạo Báo cáo tuỳ chỉnh</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Đặt tên cho báo cáo mới. Bạn sẽ có thể tự do kéo-thả và phân tích số liệu trên báo cáo này:
            </p>

            <form onSubmit={handleConfirmClone} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên báo cáo tuỳ chỉnh
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#D97706] outline-none"
                  placeholder="VD: Phân tích Chi phí theo Showroom & KMP..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCloneModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#D97706] hover:bg-[#b45309] text-white rounded-lg shadow-xs cursor-pointer active:scale-95"
                >
                  Tạo Báo cáo &amp; Bắt đầu sửa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lưu thành mới (Save As) */}
      {saveAsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Plus className="text-[#D97706]" size={18} />
              <span>Lưu thành cấu hình mới</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Đặt tên cho mẫu báo cáo pivot mới để tái sử dụng sau này:
            </p>

            <form onSubmit={handleConfirmSaveAs} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên cấu hình mới
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#D97706] outline-none"
                  placeholder="VD: Phân tích Chi phí theo Showroom & KMP..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveAsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#D97706] hover:bg-[#b45309] text-white rounded-lg shadow-xs cursor-pointer"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi tên (Rename) */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Edit2 className="text-[#D97706]" size={18} />
              <span>Đổi tên cấu hình</span>
            </h3>

            <form onSubmit={handleConfirmRename} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên cấu hình
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#D97706] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#D97706] hover:bg-[#b45309] text-white rounded-lg shadow-xs cursor-pointer"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>Xác nhận xóa cấu hình</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
              Bạn có chắc chắn muốn xóa cấu hình <strong>"{currentConfig?.ten_cau_hinh}"</strong>? Thao tác này không thể hoàn tác.
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteConfig(currentConfig.id);
                  setDeleteConfirmOpen(false);
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
