import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ThueBao, CuocThang } from '../../types';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { formatCurrencySpace as formatCurrency, formatPhoneNumber } from '../../utils/formatters';
import { Zap, Calendar, Save, X, AlertCircle, Sparkles, CheckCircle2, DollarSign, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  thueBao: ThueBao | null;
  cuocList: CuocThang[];
  onSaved: () => Promise<void> | void;
}

export default function BatchCostEntryModal({ open, onClose, thueBao, cuocList, onSaved }: Props) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [monthInputs, setMonthInputs] = useState<Record<number, string>>({});
  const [quickValue, setQuickValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Ngưỡng định mức SIM
  const nguongDinhMuc = useMemo(() => {
    if (!thueBao) return 200000;
    if (thueBao.dinh_muc_cuoc !== null && thueBao.dinh_muc_cuoc !== undefined && Number(thueBao.dinh_muc_cuoc) > 0) {
      return Number(thueBao.dinh_muc_cuoc);
    }
    return 200000;
  }, [thueBao]);

  // Load ban đầu hoặc khi đổi năm / đổi thuê bao
  useEffect(() => {
    if (!open || !thueBao) return;

    const idTB = thueBao.id;
    const sdtClean = formatPhoneNumber(thueBao.so_dien_thoai || '');
    const inputs: Record<number, string> = {};

    for (let m = 1; m <= 12; m++) {
      const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const existing = cuocList.find(c => {
        if (c.thang_nam !== mStr) return false;
        if (c.id_thue_bao === idTB) return true;
        if (sdtClean && formatPhoneNumber(c.so_dien_thoai || '') === sdtClean) return true;
        return false;
      });

      if (existing && existing.tong_cuoc !== null && existing.tong_cuoc !== undefined) {
        inputs[m] = formatCurrency(existing.tong_cuoc);
      } else {
        inputs[m] = '';
      }
    }

    setMonthInputs(inputs);
    setQuickValue('');
  }, [open, thueBao, selectedYear, cuocList]);

  const handleInputChange = (month: number, value: string) => {
    // Chỉ giữ số
    const raw = value.replace(/[^0-9]/g, '');
    if (!raw) {
      setMonthInputs(prev => ({ ...prev, [month]: '' }));
    } else {
      setMonthInputs(prev => ({ ...prev, [month]: formatCurrency(Number(raw)) }));
    }
  };

  const handleQuickApplyEmpty = () => {
    const rawQuick = quickValue.replace(/[^0-9]/g, '');
    if (!rawQuick) {
      toast.error('Vui lòng nhập số tiền cần điền nhanh!');
      return;
    }
    const formatted = formatCurrency(Number(rawQuick));
    setMonthInputs(prev => {
      const next = { ...prev };
      for (let m = 1; m <= 12; m++) {
        if (!next[m] || next[m].trim() === '') {
          next[m] = formatted;
        }
      }
      return next;
    });
    toast.success('Đã áp dụng cước cho các tháng trống!');
  };

  const handleQuickApplyAll = () => {
    const rawQuick = quickValue.replace(/[^0-9]/g, '');
    if (!rawQuick) {
      toast.error('Vui lòng nhập số tiền cần điền nhanh!');
      return;
    }
    const formatted = formatCurrency(Number(rawQuick));
    const next: Record<number, string> = {};
    for (let m = 1; m <= 12; m++) {
      next[m] = formatted;
    }
    setMonthInputs(next);
    toast.success('Đã áp dụng cước cho toàn bộ 12 tháng!');
  };

  const handleReset = () => {
    if (!thueBao) return;
    const idTB = thueBao.id;
    const sdtClean = formatPhoneNumber(thueBao.so_dien_thoai || '');
    const inputs: Record<number, string> = {};

    for (let m = 1; m <= 12; m++) {
      const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const existing = cuocList.find(c => {
        if (c.thang_nam !== mStr) return false;
        if (c.id_thue_bao === idTB) return true;
        if (sdtClean && formatPhoneNumber(c.so_dien_thoai || '') === sdtClean) return true;
        return false;
      });

      if (existing && existing.tong_cuoc !== null && existing.tong_cuoc !== undefined) {
        inputs[m] = formatCurrency(existing.tong_cuoc);
      } else {
        inputs[m] = '';
      }
    }
    setMonthInputs(inputs);
    toast.info('Đã khôi phục số liệu về gốc!');
  };

  const handleSaveBatch = async () => {
    if (!thueBao) return;
    try {
      setLoading(true);
      const idTB = thueBao.id;
      const sdtClean = formatPhoneNumber(thueBao.so_dien_thoai || '');
      const promises: Promise<any>[] = [];
      let countCreated = 0;
      let countUpdated = 0;

      for (let m = 1; m <= 12; m++) {
        const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
        const valStr = (monthInputs[m] || '').replace(/[^0-9]/g, '');
        const newVal = valStr === '' ? null : Number(valStr);

        const existing = cuocList.find(c => {
          if (c.thang_nam !== mStr) return false;
          if (c.id_thue_bao === idTB) return true;
          if (sdtClean && formatPhoneNumber(c.so_dien_thoai || '') === sdtClean) return true;
          return false;
        });

        if (existing) {
          if (newVal !== existing.tong_cuoc) {
            if (newVal === null) {
              // Nếu người dùng xóa trắng -> Xóa bản ghi cước của tháng đó hoặc về 0
              promises.push(apiService.deleteRecord(existing.id, 'cp_cuoc_thang'));
              countUpdated++;
            } else {
              promises.push(apiService.save({
                id: existing.id,
                tong_cuoc: newVal,
                dinh_muc_snap: existing.dinh_muc_snap ?? nguongDinhMuc
              }, 'update', 'cp_cuoc_thang'));
              countUpdated++;
            }
          }
        } else {
          if (newVal !== null && newVal > 0) {
            promises.push(apiService.save({
              id_thue_bao: thueBao.id,
              so_dien_thoai: thueBao.so_dien_thoai,
              id_nhan_su: thueBao.id_nhan_su || null,
              thang_nam: mStr,
              tong_cuoc: newVal,
              dinh_muc_snap: nguongDinhMuc
            }, 'create', 'cp_cuoc_thang'));
            countCreated++;
          }
        }
      }

      if (promises.length === 0) {
        toast.info('Không có thay đổi nào cần lưu!');
        setLoading(false);
        return;
      }

      await Promise.all(promises);
      await onSaved();
      toast.success(`Đã lưu thành công! (Thêm mới ${countCreated} tháng, Cập nhật ${countUpdated} tháng)`);
      onClose();
    } catch (error: any) {
      console.error('Lỗi khi ghi nhận cước hàng loạt:', error);
      toast.error('Lỗi ghi nhận cước: ' + (error?.message || 'Không xác định'));
    } finally {
      setLoading(false);
    }
  };

  // Tính tổng cước đang nhập
  const totalEntered = useMemo(() => {
    return Object.values(monthInputs).reduce((sum, str) => {
      const raw = str.replace(/[^0-9]/g, '');
      return sum + (raw ? Number(raw) : 0);
    }, 0);
  }, [monthInputs]);

  if (!open || !thueBao) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-[#05469B] to-indigo-700 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <span>Ghi nhận Cước Hàng loạt Theo tháng</span>
              </h3>
              <p className="text-[11px] text-blue-100 font-medium">
                Thuê bao: <strong className="font-mono text-yellow-200 font-extrabold">{thueBao.so_dien_thoai}</strong> | {thueBao.ho_ten_nv || thueBao.ten_bo_phan || 'SIM dùng chung'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Chọn năm & Điền nhanh */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4 shrink-0">
          
          {/* Chọn năm */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar size={14} className="text-[#05469B] dark:text-blue-400" /> Năm ghi nhận:
            </span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={loading}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-extrabold text-[#05469B] dark:text-blue-400 outline-none focus:ring-2 focus:ring-[#05469B] shadow-2xs"
            >
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear - 2}>{currentYear - 2}</option>
            </select>
          </div>

          {/* Công cụ điền nhanh */}
          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 pl-2 flex items-center gap-1">
              <Sparkles size={13} /> Điền nhanh:
            </span>
            <input
              type="text"
              placeholder="VD: 350.000"
              value={quickValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setQuickValue(raw ? formatCurrency(Number(raw)) : '');
              }}
              disabled={loading}
              className="w-28 px-2.5 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold font-mono text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 bg-[#FFFFF0] dark:bg-gray-900"
            />
            <button
              onClick={handleQuickApplyEmpty}
              disabled={loading}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800"
              title="Điền số tiền này cho tất cả các tháng đang trống"
            >
              Điền tháng trống
            </button>
            <button
              onClick={handleQuickApplyAll}
              disabled={loading}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-all border border-blue-200 dark:border-blue-800"
              title="Điền số tiền này cho toàn bộ 12 tháng"
            >
              Điền cả năm
            </button>
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-2.5 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              title="Khôi phục số liệu gốc ban đầu"
            >
              <RefreshCw size={12} /> Khôi phục
            </button>
          </div>

        </div>

        {/* Grid Lưới nhập liệu 12 tháng */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white dark:bg-gray-800">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
              const mStr = `${selectedYear}-${String(month).padStart(2, '0')}`;
              const val = monthInputs[month] || '';
              const rawNum = Number(val.replace(/[^0-9]/g, '')) || 0;
              const isExceeded = rawNum > nguongDinhMuc;
              const hasData = val.trim() !== '';

              return (
                <div
                  key={month}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    hasData
                      ? isExceeded
                        ? 'bg-red-50/40 dark:bg-red-950/10 border-red-200 dark:border-red-900/50 shadow-2xs'
                        : 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50 shadow-2xs'
                      : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1">
                      <span>Tháng {String(month).padStart(2, '0')}/{selectedYear}</span>
                    </span>
                    {hasData ? (
                      <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
                        isExceeded ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {isExceeded ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                        {isExceeded ? 'Vượt ĐM' : 'Trong ĐM'}
                      </span>
                    ) : (
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold">
                        Chưa nhập
                      </span>
                    )}
                  </div>

                  <div className="relative mt-1">
                    <input
                      type="text"
                      placeholder="0 đ"
                      value={val}
                      onChange={(e) => handleInputChange(month, e.target.value)}
                      disabled={loading}
                      className={`w-full py-2 pl-3 pr-7 rounded-lg text-xs font-black font-mono outline-none border transition-all ${
                        hasData
                          ? isExceeded
                            ? 'bg-white dark:bg-gray-900 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 focus:ring-2 focus:ring-red-500'
                            : 'bg-white dark:bg-gray-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#05469B]'
                      }`}
                    />
                    <span className="absolute right-2.5 top-2 text-gray-400 font-bold text-xs pointer-events-none">đ</span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400 font-medium">
                    <span>Định mức: {formatCurrency(nguongDinhMuc)}đ</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
            Tổng cước năm {selectedYear}: <span className="text-base font-black text-[#05469B] dark:text-blue-400 font-mono ml-1">{formatCurrency(totalEntered)} VNĐ</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSaveBatch}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#05469B] to-indigo-600 hover:from-[#04367a] hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Save size={15} />
              )}
              <span>Lưu Cước Hàng Loạt</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
