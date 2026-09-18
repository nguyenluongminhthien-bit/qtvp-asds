import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Edit, Trash2, CheckCircle2, XCircle,
  Tag, Filter, AlertCircle, AlertTriangle, FileSpreadsheet, RefreshCw, Star
} from 'lucide-react';
import { DmKmp } from '../../types';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { getCostGroupStyle } from '../../utils/costGroupColors';

interface Props {
  kmpList: DmKmp[];
  onRefresh: () => Promise<void>;
  loading: boolean;
}

const EMPTY_KMP: Partial<DmKmp> = {
  ma_b7: '',
  ma_b10: '',
  nhom_chi_phi: '',
  dien_giai: '',
  trong_yeu: false,
  thuoc_bao_cao_hanh_chinh: true,
  active: true
};

export default function KmpConfigTab({ kmpList, onRefresh, loading }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [filterTrongYeu, setFilterTrongYeu] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [filterHanhChinh, setFilterHanhChinh] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [filterOnlyDuplicates, setFilterOnlyDuplicates] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  const [formData, setFormData] = useState<Partial<DmKmp>>(EMPTY_KMP);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<DmKmp | null>(null);

  // Kiểm tra trùng lặp Mã B7 và Mã B10 trong toàn bộ danh sách KMP
  const duplicateAnalysis = useMemo(() => {
    const b7Counts = new Map<string, number>();
    const b10Counts = new Map<string, number>();

    kmpList.forEach(item => {
      const b7 = (item.ma_b7 || '').trim().toUpperCase();
      if (b7) {
        b7Counts.set(b7, (b7Counts.get(b7) || 0) + 1);
      }
      const b10 = (item.ma_b10 || '').trim().toUpperCase();
      if (b10) {
        b10Counts.set(b10, (b10Counts.get(b10) || 0) + 1);
      }
    });

    const duplicateB7Set = new Set<string>();
    b7Counts.forEach((count, key) => {
      if (count > 1) duplicateB7Set.add(key);
    });

    const duplicateB10Set = new Set<string>();
    b10Counts.forEach((count, key) => {
      if (count > 1) duplicateB10Set.add(key);
    });

    const duplicateItemIds = new Set<string | number>();
    kmpList.forEach(item => {
      const b7 = (item.ma_b7 || '').trim().toUpperCase();
      const b10 = (item.ma_b10 || '').trim().toUpperCase();
      if ((b7 && duplicateB7Set.has(b7)) || (b10 && duplicateB10Set.has(b10))) {
        duplicateItemIds.add(item.id);
      }
    });

    return {
      duplicateB7Set,
      duplicateB10Set,
      duplicateItemIds,
      totalDuplicates: duplicateItemIds.size
    };
  }, [kmpList]);

  // Kiểm tra trùng lặp thời gian thực trong Modal Thêm / Sửa
  const b7Conflict = useMemo(() => {
    const val = (formData.ma_b7 || '').trim().toUpperCase();
    if (!val) return null;
    return kmpList.find(k =>
      (k.ma_b7 || '').trim().toUpperCase() === val &&
      (modalMode === 'create' || String(k.id) !== String(formData.id))
    );
  }, [formData.ma_b7, formData.id, modalMode, kmpList]);

  const b10Conflict = useMemo(() => {
    const val = (formData.ma_b10 || '').trim().toUpperCase();
    if (!val) return null;
    return kmpList.find(k =>
      (k.ma_b10 || '').trim().toUpperCase() === val &&
      (modalMode === 'create' || String(k.id) !== String(formData.id))
    );
  }, [formData.ma_b10, formData.id, modalMode, kmpList]);

  // Danh sách các nhóm chi phí duy nhất để lọc
  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    kmpList.forEach(k => {
      if (k.nhom_chi_phi && k.nhom_chi_phi.trim()) set.add(k.nhom_chi_phi.trim());
    });
    return Array.from(set).sort();
  }, [kmpList]);

  // Lọc dữ liệu
  const filteredList = useMemo(() => {
    return kmpList.filter(item => {
      if (filterOnlyDuplicates && !duplicateAnalysis.duplicateItemIds.has(item.id)) {
        return false;
      }

      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        String(item.ma_b7 || '').toLowerCase().includes(q) ||
        String(item.ma_b10 || '').toLowerCase().includes(q) ||
        String(item.nhom_chi_phi || '').toLowerCase().includes(q) ||
        String(item.dien_giai || '').toLowerCase().includes(q);

      const matchGroup = filterGroup === 'ALL' || item.nhom_chi_phi === filterGroup;
      const matchTrongYeu = filterTrongYeu === 'ALL' ||
        (filterTrongYeu === 'YES' && item.trong_yeu) ||
        (filterTrongYeu === 'NO' && !item.trong_yeu);
      const matchHanhChinh = filterHanhChinh === 'ALL' ||
        (filterHanhChinh === 'YES' && item.thuoc_bao_cao_hanh_chinh !== false) ||
        (filterHanhChinh === 'NO' && item.thuoc_bao_cao_hanh_chinh === false);

      return matchSearch && matchGroup && matchTrongYeu && matchHanhChinh;
    });
  }, [kmpList, searchTerm, filterGroup, filterTrongYeu, filterHanhChinh, filterOnlyDuplicates, duplicateAnalysis]);

  const handleOpenAdd = () => {
    setModalMode('create');
    setFormData({ ...EMPTY_KMP });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: DmKmp) => {
    setModalMode('update');
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleToggleHanhChinh = async (item: DmKmp) => {
    const newVal = item.thuoc_bao_cao_hanh_chinh === false ? true : false;
    try {
      await apiService.save({ ...item, thuoc_bao_cao_hanh_chinh: newVal }, 'update', 'dm_kmp');
      toast.success(`Đã ${newVal ? 'bật' : 'tắt'} thuộc Báo cáo CPHC cho "${item.ma_b7}"!`);
      await onRefresh();
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật phạm vi CPHC của KMP!');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ma_b7?.trim()) {
      toast.warning('Vui lòng nhập Mã B7!');
      return;
    }
    if (!formData.nhom_chi_phi?.trim()) {
      toast.warning('Vui lòng nhập Nhóm chi phí!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        ma_b7: formData.ma_b7.trim(),
        ma_b10: formData.ma_b10?.trim() || null,
        nhom_chi_phi: formData.nhom_chi_phi.trim(),
        dien_giai: formData.dien_giai?.trim() || null,
        trong_yeu: !!formData.trong_yeu,
        thuoc_bao_cao_hanh_chinh: formData.thuoc_bao_cao_hanh_chinh !== false,
        active: formData.active !== false
      };

      await apiService.save(payload, modalMode, 'dm_kmp');
      toast.success(modalMode === 'create' ? 'Đã thêm Khoản mục phí mới!' : 'Đã cập nhật Khoản mục phí!');
      setIsModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi lưu KMP!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await apiService.delete(deleteTarget.id, 'dm_kmp');
      toast.success('Đã xóa Khoản mục phí thành công!');
      setDeleteTarget(null);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không thể xóa KMP!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Bar: Search, Filters, Add button */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Tìm theo Mã B7, B10, Nhóm, Diễn giải..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50/50 dark:bg-slate-700/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="text-xs sm:text-sm border border-gray-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
            >
              <option value="ALL">Tất cả Nhóm chi phí</option>
              {uniqueGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <select
              value={filterTrongYeu}
              onChange={(e) => setFilterTrongYeu(e.target.value as any)}
              className="text-xs sm:text-sm border border-gray-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
            >
              <option value="ALL">Tất cả Trọng yếu</option>
              <option value="YES">Trọng yếu ⭐</option>
              <option value="NO">Thông thường</option>
            </select>

            <select
              value={filterHanhChinh}
              onChange={(e) => setFilterHanhChinh(e.target.value as any)}
              className="text-xs sm:text-sm border border-gray-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
            >
              <option value="ALL">Tất cả Phạm vi CPHC</option>
              <option value="YES">Thuộc Báo cáo CPHC</option>
              <option value="NO">Ngoài Báo cáo CPHC</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-[#D97706] hover:bg-[#b45309] text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          <span>Thêm KMP</span>
        </button>
      </div>

      {/* Banner Cảnh Báo Trùng Lặp Dữ Liệu (Audit) */}
      {duplicateAnalysis.totalDuplicates > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-medium">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle size={16} className="animate-bounce" />
            </div>
            <span>
              <strong>Kiểm tra dữ liệu KMP:</strong> Phát hiện <strong className="text-red-600 dark:text-red-400 underline">{duplicateAnalysis.totalDuplicates}</strong> khoản mục phí có Mã B7 hoặc Mã B10 bị trùng lặp trên hệ thống!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilterOnlyDuplicates(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
              filterOnlyDuplicates
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-slate-700'
            }`}
          >
            {filterOnlyDuplicates ? '✕ Xem lại toàn bộ' : `🔍 Chỉ xem ${duplicateAnalysis.totalDuplicates} mục trùng`}
          </button>
        </div>
      )}

      {/* Table List */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-700/80 text-gray-600 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="p-3 w-12 text-center">STT</th>
                <th className="p-3 w-28">Mã B7</th>
                <th className="p-3 w-28">Mã B10</th>
                <th className="p-3 w-70">Nhóm chi phí</th>
                <th className="p-3 min-w-[170px]">Diễn giải nội dung chi phí</th>
                <th className="p-3 w-30 text-center">Trọng yếu</th>
                <th className="p-3 w-36 text-center">Báo cáo CPHC</th>
                <th className="p-3 w-28 text-center">Trạng thái</th>
                <th className="p-3 w-24 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Không tìm thấy khoản mục phí nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  const b7Val = (item.ma_b7 || '').trim().toUpperCase();
                  const b10Val = (item.ma_b10 || '').trim().toUpperCase();
                  const isB7Dup = b7Val ? duplicateAnalysis.duplicateB7Set.has(b7Val) : false;
                  const isB10Dup = b10Val ? duplicateAnalysis.duplicateB10Set.has(b10Val) : false;
                  const isRowDup = isB7Dup || isB10Dup;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isRowDup
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-900/30'
                          : 'hover:bg-amber-50/30 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <td className="p-3 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[#D97706]">{item.ma_b7}</span>
                          {isB7Dup && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-800 shrink-0"
                              title={`Mã B7 "${item.ma_b7}" bị trùng lặp trên hệ thống!`}
                            >
                              <AlertTriangle size={10} /> Trùng
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.ma_b10 || '-'}</span>
                          {isB10Dup && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800 shrink-0"
                              title={`Mã B10 "${item.ma_b10}" bị trùng lặp trên hệ thống!`}
                            >
                              <AlertTriangle size={10} /> Trùng
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-medium">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getCostGroupStyle(item.nhom_chi_phi).badge}`}>
                          {item.nhom_chi_phi}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{item.dien_giai || '-'}</td>
                      <td className="p-3 text-center">
                        {item.trong_yeu ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Star size={12} className="fill-amber-500 text-amber-500" />
                            Trọng yếu
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleHanhChinh(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                            item.thuoc_bao_cao_hanh_chinh !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-400 border-gray-200 dark:border-slate-600 hover:text-gray-600'
                          }`}
                          title="Bấm để bật/tắt phạm vi Báo cáo CPHC (được đóng băng khi chốt kỳ)"
                        >
                          {item.thuoc_bao_cao_hanh_chinh !== false ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>Thuộc CPHC</span>
                            </>
                          ) : (
                            <span>Ngoài CPHC</span>
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        {item.active !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 size={14} /> Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                            <XCircle size={14} /> Tắt
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-[#D97706] hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Sửa"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-600 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <span>Tổng số: <strong className="text-[#D97706]">{filteredList.length}</strong> / {kmpList.length} khoản mục</span>
            <span>Trọng yếu: <strong className="text-amber-600">{filteredList.filter(k => k.trong_yeu).length}</strong> mục</span>
          </div>
          {duplicateAnalysis.totalDuplicates > 0 && (
            <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
              <AlertTriangle size={13} />
              Trùng lặp: {duplicateAnalysis.totalDuplicates} khoản mục
            </span>
          )}
        </div>
      </div>

      {/* Modal Thêm / Sửa KMP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-amber-600 flex justify-between items-center bg-gradient-to-r from-[#D97706] to-[#b45309] text-white">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Tag size={18} />
                {modalMode === 'create' ? 'Thêm Khoản mục phí mới' : 'Cập nhật Khoản mục phí'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Mã B7 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: B7.01"
                    value={formData.ma_b7 || ''}
                    onChange={(e) => setFormData(p => ({ ...p, ma_b7: e.target.value }))}
                    className="w-full p-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg font-mono focus:ring-2 focus:ring-[#D97706] dark:bg-slate-700 uppercase"
                  />
                  {b7Conflict && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-start gap-1 font-semibold leading-tight">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>Trùng với: <strong>{b7Conflict.ma_b7} - {b7Conflict.dien_giai || b7Conflict.nhom_chi_phi}</strong></span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Mã B10
                  </label>
                  <input
                    type="text"
                    placeholder="VD: B10.01"
                    value={formData.ma_b10 || ''}
                    onChange={(e) => setFormData(p => ({ ...p, ma_b10: e.target.value }))}
                    className="w-full p-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg font-mono focus:ring-2 focus:ring-[#D97706] dark:bg-slate-700 uppercase"
                  />
                  {b10Conflict && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1 font-semibold leading-tight">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>Trùng với: <strong>{b10Conflict.ma_b10} - {b10Conflict.dien_giai || b10Conflict.nhom_chi_phi}</strong></span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nhóm chi phí <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Chi phí Năng lượng, Chi phí Dịch vụ ngoài..."
                  value={formData.nhom_chi_phi || ''}
                  onChange={(e) => setFormData(p => ({ ...p, nhom_chi_phi: e.target.value }))}
                  className="w-full p-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#D97706] dark:bg-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Diễn giải nội dung chi phí
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả cụ thể khoản mục phí..."
                  value={formData.dien_giai || ''}
                  onChange={(e) => setFormData(p => ({ ...p, dien_giai: e.target.value }))}
                  className="w-full p-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#D97706] dark:bg-slate-700"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200/60 dark:border-slate-600">
                <div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Star size={15} className="text-amber-500 fill-amber-500" />
                    Khoản mục Trọng yếu
                  </div>
                  <p className="text-xs text-gray-500">Đánh dấu để theo dõi ưu tiên trên báo cáo chi phí</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!formData.trong_yeu}
                  onChange={(e) => setFormData(p => ({ ...p, trong_yeu: e.target.checked }))}
                  className="w-5 h-5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200/60 dark:border-slate-600">
                <div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    Thuộc Báo cáo Chi phí Hành chính (CPHC)
                  </div>
                  <p className="text-xs text-gray-500">Đóng băng vào snapshot khi Chốt kỳ để hiển thị trên Báo cáo Quản trị CPHC</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.thuoc_bao_cao_hanh_chinh !== false}
                  onChange={(e) => setFormData(p => ({ ...p, thuoc_bao_cao_hanh_chinh: e.target.checked }))}
                  className="w-5 h-5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200/60 dark:border-slate-600">
                <div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Trạng thái hoạt động
                  </div>
                  <p className="text-xs text-gray-500">Bật để hiển thị khi người dùng chọn phân bổ DNTT</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.active !== false}
                  onChange={(e) => setFormData(p => ({ ...p, active: e.target.checked }))}
                  className="w-5 h-5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm bg-[#D97706] hover:bg-[#b45309] text-white rounded-lg font-semibold shadow-sm transition-all cursor-pointer"
                >
                  {submitting ? 'Đang lưu...' : (modalMode === 'create' ? 'Tạo mới' : 'Lưu thay đổi')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 w-full max-w-md p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                Xác nhận xóa Khoản mục phí?
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Bạn có chắc chắn muốn xóa mã <strong>{deleteTarget.ma_b7}</strong> ({deleteTarget.nhom_chi_phi})? Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-sm cursor-pointer"
              >
                {submitting ? 'Đang xóa...' : 'Xóa khoản mục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
