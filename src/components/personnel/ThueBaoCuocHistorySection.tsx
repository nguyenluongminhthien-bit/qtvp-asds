import React, { useState, useEffect, useMemo } from 'react';
import { ThueBao, CuocThang } from '../../types';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { formatCurrencySpace as formatCurrency, formatPhoneNumber } from '../../utils/formatters';
import { Calendar, Save, AlertCircle, Sparkles, CheckCircle2, RefreshCw, History, DollarSign } from 'lucide-react';

interface Props {
  thueBao: ThueBao;
  cuocList: CuocThang[];
  onSaved: () => Promise<void> | void;
}

export default function ThueBaoCuocHistorySection({ thueBao, cuocList, onSaved }: Props) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [monthInputs, setMonthInputs] = useState<Record<number, string>>({});
  const [quickValue, setQuickValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Ngưỡng định mức SIM
  const nguongDinhMuc = useMemo(() => {
    if (thueBao.dinh_muc_cuoc !== null && thueBao.dinh_muc_cuoc !== undefined && Number(thueBao.dinh_muc_cuoc) > 0) {
      return Number(thueBao.dinh_muc_cuoc);
    }
    return 200000;
  }, [thueBao]);

  // Load ban đầu hoặc khi đổi năm / đổi thuê bao
  useEffect(() => {
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
    setQuickValue('');
  }, [thueBao, selectedYear, cuocList]);

  const handleInputChange = (month: number, value: string) => {
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

  const handleUpdateCuoc = async () => {
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
        toast.info('Không có thay đổi nào cần cập nhật!');
        setLoading(false);
        return;
      }

      await Promise.all(promises);
      await onSaved();
      toast.success(`Cập nhật cước thành công! (Thêm mới ${countCreated} tháng, Sửa đổi ${countUpdated} tháng)`);
    } catch (error: any) {
      console.error('Lỗi khi cập nhật cước:', error);
      toast.error('Lỗi cập nhật cước: ' + (error?.message || 'Không xác định'));
    } finally {
      setLoading(false);
    }
  };

  const totalEntered = useMemo(() => {
    return Object.values(monthInputs).reduce((sum, str) => {
      const raw = str.replace(/[^0-9]/g, '');
      return sum + (raw ? Number(raw) : 0);
    }, 0);
  }, [monthInputs]);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-gray-900 flex flex-col">
      {/* Header: Tiêu đề & Chọn năm */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50/40 dark:from-gray-900 dark:to-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#05469B]/10 dark:bg-blue-500/10 text-[#05469B] dark:text-blue-400 rounded-lg">
            <History size={16} />
          </div>
          <div>
            <span className="font-black text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200 block">
              LỊCH SỬ PHÁT SINH CƯỚC THÁNG & CẬP NHẬT CƯỚC
            </span>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
              Nhập hoặc chỉnh sửa trực tiếp cước từng tháng và bấm "Cập Nhật Cước"
            </span>
          </div>
        </div>

        {/* Chọn năm */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Calendar size={14} className="text-[#05469B] dark:text-blue-400" /> Năm ghi nhận:
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            disabled={loading}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-extrabold text-[#05469B] dark:text-blue-400 outline-none focus:ring-2 focus:ring-[#05469B] shadow-2xs cursor-pointer"
          >
            <option value={currentYear + 1}>{currentYear + 1}</option>
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear - 2}>{currentYear - 2}</option>
          </select>
        </div>
      </div>

      {/* Toolbar Điền nhanh */}
      <div className="p-3 bg-gray-50/60 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
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
            type="button"
            onClick={handleQuickApplyEmpty}
            disabled={loading}
            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800 cursor-pointer"
            title="Điền số tiền này cho tất cả các tháng đang trống"
          >
            Điền tháng trống
          </button>
          <button
            type="button"
            onClick={handleQuickApplyAll}
            disabled={loading}
            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-all border border-blue-200 dark:border-blue-800 cursor-pointer"
            title="Điền số tiền này cho toàn bộ 12 tháng"
          >
            Điền cả năm
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="px-2.5 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            title="Khôi phục số liệu gốc ban đầu"
          >
            <RefreshCw size={12} /> Khôi phục
          </button>
        </div>
      </div>

      {/* Grid Lưới nhập liệu 12 tháng */}
      <div className="p-4 bg-white dark:bg-gray-900 overflow-y-auto custom-scrollbar max-h-[420px]">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const val = monthInputs[month] || '';
            const rawNum = Number(val.replace(/[^0-9]/g, '')) || 0;
            const isExceeded = rawNum > nguongDinhMuc;
            const hasData = val.trim() !== '';

            return (
              <div
                key={month}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
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
                    className={`w-full py-1.5 pl-3 pr-7 rounded-lg text-xs font-black font-mono outline-none border transition-all ${
                      hasData
                        ? isExceeded
                          ? 'bg-white dark:bg-gray-900 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 focus:ring-2 focus:ring-red-500'
                          : 'bg-white dark:bg-gray-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#05469B]'
                    }`}
                  />
                  <span className="absolute right-2.5 top-1.5 text-gray-400 font-bold text-xs pointer-events-none">đ</span>
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400 font-medium">
                  <span>Định mức: {formatCurrency(nguongDinhMuc)}đ</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: Tổng cước & Nút Cập nhật */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
          Tổng cước năm {selectedYear}: <span className="text-base font-black text-[#05469B] dark:text-blue-400 font-mono ml-1">{formatCurrency(totalEntered)} VNĐ</span>
        </div>
        <button
          type="button"
          onClick={handleUpdateCuoc}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#05469B] to-indigo-600 hover:from-[#04367a] hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Save size={15} />
          )}
          <span>Cập Nhật Cước</span>
        </button>
      </div>
    </div>
  );
}
