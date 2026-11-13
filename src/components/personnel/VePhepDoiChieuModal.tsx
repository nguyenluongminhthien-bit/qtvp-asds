import React, { useState, useMemo } from 'react';
import { X, Loader2, ClipboardPaste, CheckCheck, AlertTriangle, AlertCircle, HelpCircle, ArrowRightLeft, FileSpreadsheet, RotateCcw, ShieldCheck } from 'lucide-react';
import { VeMayBay, NhaCungCap } from '../../types';
import { formatCurrencySpace, formatCurrencySpace as formatCurrency, toUnaccented } from '../../utils/formatters';
import { toast } from '../../utils/toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nccList: NhaCungCap[];
  veList: VeMayBay[];
  selectedMonth: number;
  selectedYear: number;
  onApplyReconciliation: (updates: { id: string; trang_thai_doi_chieu: string; tien_ncc_ke: number; ghi_chu_doi_chieu: string }[]) => Promise<void>;
}

interface ParsedRow {
  rawLine: string;
  codeVe: string;
  chuyenBay?: string;
  soTienNcc: number;
  ngayBay?: string;
  ghiChu?: string;
  matchedVe: VeMayBay | null;
  status: 'MATCHED' | 'PRICE_MISMATCH' | 'NOT_FOUND';
  diffAmount: number;
}

export default function VePhepDoiChieuModal({
  isOpen,
  onClose,
  nccList,
  veList,
  selectedMonth,
  selectedYear,
  onApplyReconciliation
}: Props) {
  const [pasteText, setPasteText] = useState('');
  const [selectedNccId, setSelectedNccId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'MATCHED' | 'PRICE_MISMATCH' | 'NOT_FOUND'>('ALL');

  // Lọc danh sách NCC nhóm Vé máy bay
  const flightSuppliers = useMemo(() => {
    const list = nccList.filter(ncc => {
      const nhom = toUnaccented(ncc.nhom_dich_vu || '');
      return nhom.includes('ve may bay') || nhom.includes('hang khong');
    });
    return list.length > 0 ? list : nccList;
  }, [nccList]);

  // Danh sách vé nội bộ theo tháng/năm và NCC (nếu chọn)
  const candidateInternalTickets = useMemo(() => {
    return veList.filter(v => {
      const matchMonth = Number(v.thang) === Number(selectedMonth);
      const matchYear = Number(v.nam) === Number(selectedYear);
      if (!matchMonth || !matchYear) return false;
      if (selectedNccId) {
        return v.id_ncc === selectedNccId || String(v.ten_ncc || '').toLowerCase().includes(
          String(flightSuppliers.find(n => n.id === selectedNccId)?.ten_goi_tat || '').toLowerCase()
        );
      }
      return true;
    });
  }, [veList, selectedMonth, selectedYear, selectedNccId, flightSuppliers]);

  // Phân tích dữ liệu dán
  const parsedRows: ParsedRow[] = useMemo(() => {
    if (!pasteText.trim()) return [];

    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results: ParsedRow[] = [];

    // Tạo Map vé nội bộ theo Code vé (chuỗi viết hoa không dấu cách)
    const ticketMap = new Map<string, VeMayBay[]>();
    candidateInternalTickets.forEach(v => {
      if (v.code_ve_di) {
        const cDi = v.code_ve_di.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cDi) {
          const arr = ticketMap.get(cDi) || [];
          arr.push(v);
          ticketMap.set(cDi, arr);
        }
      }
      if (v.code_ve_ve) {
        const cVe = v.code_ve_ve.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cVe) {
          const arr = ticketMap.get(cVe) || [];
          arr.push(v);
          ticketMap.set(cVe, arr);
        }
      }
    });

    lines.forEach((line) => {
      // Phân tách ô bằng tab (\t) hoặc dấu phẩy hoặc khoảng trắng rộng
      let cells = line.split('\t').map(c => c.trim());
      if (cells.length === 1 && line.includes(';')) {
        cells = line.split(';').map(c => c.trim());
      } else if (cells.length === 1 && line.includes(',')) {
        cells = line.split(',').map(c => c.trim());
      }

      // Bỏ qua dòng tiêu đề nếu chứa chữ "Mã" hoặc "Code" hoặc "Giá"
      if (line.toLowerCase().includes('mã vé') || line.toLowerCase().includes('code vé') || line.toLowerCase().includes('tổng tiền')) {
        return;
      }

      let detectedCode = '';
      let detectedFlight = '';
      let detectedAmount = 0;
      let detectedDate = '';

      // Tự động nhận diện các cột theo đặc thù dữ liệu:
      // - Số tiền: chuỗi chứa các chữ số > 10,000 (loại bỏ . , đ VND)
      // - Code vé: chuỗi 5-10 ký tự chữ & số (thường 6-8 ký tự)
      // - Chuyến bay: chuỗi bắt đầu bằng VJ, VN, QH, VU, SE hoặc chứa số
      cells.forEach(cell => {
        const cleanDigits = cell.replace(/[^0-9]/g, '');
        const numVal = parseInt(cleanDigits, 10);

        // Nhận diện số tiền (thường > 50.000 đ)
        if (!isNaN(numVal) && numVal >= 50000 && !cell.includes('/') && !cell.includes('-')) {
          if (!detectedAmount || numVal > detectedAmount) {
            detectedAmount = numVal;
          }
        }

        // Nhận diện ngày bay (dd/mm/yyyy hoặc yyyy-mm-dd)
        if (cell.includes('/') || (cell.includes('-') && cell.length === 10)) {
          detectedDate = cell;
        }

        // Nhận diện chuyến bay (VJ123, VN246...)
        const flightPattern = /^(VJ|VN|VNA|QH|VU|SE)\s*[0-9]{2,5}$/i;
        if (flightPattern.test(cell.replace(/\s+/g, ''))) {
          detectedFlight = cell.toUpperCase();
        }

        // Nhận diện Code vé (thường 6-10 ký tự alpha/số, không phải chuyến bay)
        const cleanAlnum = cell.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanAlnum.length >= 5 && cleanAlnum.length <= 12 && !flightPattern.test(cleanAlnum) && isNaN(Number(cell))) {
          if (!detectedCode) {
            detectedCode = cleanAlnum;
          }
        }
      });

      // Nếu ô chưa tìm được code bằng chữ, tìm ô chứa mã số đặt chỗ (VD: 54132899)
      if (!detectedCode) {
        cells.forEach(cell => {
          const cleanAlnum = cell.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (cleanAlnum.length >= 6 && cleanAlnum.length <= 10 && Number(cleanAlnum) !== detectedAmount) {
            detectedCode = cleanAlnum;
          }
        });
      }

      // So khớp với dữ liệu nội bộ
      const cleanTargetCode = detectedCode.replace(/[^A-Z0-9]/g, '');
      const matchedCandidates = cleanTargetCode ? ticketMap.get(cleanTargetCode) : null;
      const matched = matchedCandidates ? matchedCandidates[0] : null;

      let status: 'MATCHED' | 'PRICE_MISMATCH' | 'NOT_FOUND' = 'NOT_FOUND';
      let diff = 0;

      if (matched) {
        // So sánh với số tiền công ty thanh toán trong hệ thống
        const internalAmount = Number(matched.cty_thanh_toan || matched.tong_tien || 0);
        diff = detectedAmount - internalAmount;
        if (Math.abs(diff) <= 1000) { // Chấp nhận lệch nhỏ < 1000đ do làm tròn
          status = 'MATCHED';
          diff = 0;
        } else {
          status = 'PRICE_MISMATCH';
        }
      }

      results.push({
        rawLine: line,
        codeVe: detectedCode || cells[0] || '---',
        chuyenBay: detectedFlight,
        soTienNcc: detectedAmount,
        ngayBay: detectedDate,
        matchedVe: matched,
        status,
        diffAmount: diff
      });
    });

    return results;
  }, [pasteText, candidateInternalTickets]);

  // Thống kê nhanh kết quả đối chiếu
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const matched = parsedRows.filter(r => r.status === 'MATCHED').length;
    const priceMismatch = parsedRows.filter(r => r.status === 'PRICE_MISMATCH').length;
    const notFound = parsedRows.filter(r => r.status === 'NOT_FOUND').length;
    return { total, matched, priceMismatch, notFound };
  }, [parsedRows]);

  const filteredDisplayRows = useMemo(() => {
    if (activeFilterTab === 'ALL') return parsedRows;
    return parsedRows.filter(r => r.status === activeFilterTab);
  }, [parsedRows, activeFilterTab]);

  const handleApply = async () => {
    const updates = parsedRows
      .filter(r => r.matchedVe !== null)
      .map(r => ({
        id: r.matchedVe!.id,
        trang_thai_doi_chieu: r.status === 'MATCHED' ? 'Khớp' : 'Lệch tiền',
        tien_ncc_ke: r.soTienNcc,
        ghi_chu_doi_chieu: r.diffAmount !== 0 ? `Lệch: ${formatCurrency(r.diffAmount)} đ (NCC: ${formatCurrency(r.soTienNcc)} đ)` : 'Đã đối chiếu khớp bảng kê NCC'
      }));

    if (updates.length === 0) {
      toast.warning('Không có bản ghi vé nội bộ nào được khớp để cập nhật!');
      return;
    }

    setSubmitting(true);
    try {
      await onApplyReconciliation(updates);
      toast.success(`Đã cập nhật trạng thái đối chiếu cho ${updates.length} vé!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi áp dụng kết quả đối chiếu');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-indigo-100 bg-indigo-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white rounded-xl shadow-2xs text-indigo-700">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-indigo-900">
                Đối Chiếu Công Nợ Nhà Cung Cấp (Sao Chép & Dán Bảng Kê)
              </h3>
              <p className="text-[11px] text-indigo-600 font-medium">
                Kỳ tháng {selectedMonth}/{selectedYear} • Tự động so sánh Code vé, Chuyến bay, và Số tiền
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-full text-indigo-400 hover:text-red-500 hover:bg-white shadow-2xs transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* HÀNG CẤU HÌNH NHÀ CUNG CẤP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Nhà cung cấp đối chiếu:</label>
              <select
                value={selectedNccId}
                onChange={(e) => setSelectedNccId(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Tất cả NCC Vé máy bay --</option>
                {flightSuppliers.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.ten_goi_tat || n.ten_cong_ty} ({n.ten_cong_ty})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Kỳ đối chiếu:</label>
              <div className="p-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-800">
                Tháng {selectedMonth} / Năm {selectedYear}
              </div>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Vé nội bộ trong kỳ:</label>
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg font-black text-indigo-800">
                {candidateInternalTickets.length} vé có trong hệ thống
              </div>
            </div>
          </div>

          {/* Ô DÁN DỮ LIỆU */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-extrabold text-gray-800 flex items-center gap-1.5">
                <ClipboardPaste size={15} className="text-indigo-600" />
                Dán dữ liệu từ file Excel của NCC (Quét các dòng và nhấn Ctrl + V vào đây):
              </label>
              {pasteText && (
                <button
                  type="button"
                  onClick={() => setPasteText('')}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RotateCcw size={12} /> Xóa trắng vùng dán
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Ví dụ dán các dòng bảng kê của Đại lý vé gồm: Code vé (54132899)	Chuyến bay (VJ123)	Ngày bay (15/03/2026)	Giá vé (1.850.000)..."
              className="w-full p-3 font-mono text-xs border-2 border-dashed border-indigo-200 rounded-xl outline-none focus:border-indigo-500 bg-[#FFFFF0] custom-scrollbar shadow-inner"
            ></textarea>
          </div>

          {/* THỐNG KÊ NHANH & BỘ LỌC TRẠNG THÁI */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 animate-in fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('ALL')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${activeFilterTab === 'ALL' ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Tổng dòng đã quét</span>
                  <span className="text-xl font-black text-indigo-900">{stats.total}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('MATCHED')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${activeFilterTab === 'MATCHED' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">🟢 Khớp hoàn toàn</span>
                  <span className="text-xl font-black text-emerald-800">{stats.matched}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('PRICE_MISMATCH')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${activeFilterTab === 'PRICE_MISMATCH' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">🟡 Lệch số tiền</span>
                  <span className="text-xl font-black text-amber-800">{stats.priceMismatch}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('NOT_FOUND')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${activeFilterTab === 'NOT_FOUND' ? 'bg-red-50 border-red-400 ring-2 ring-red-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="text-[10px] font-bold text-red-600 uppercase block">🔴 Không tìm thấy vé</span>
                  <span className="text-xl font-black text-red-800">{stats.notFound}</span>
                </button>
              </div>

              {/* BẢNG KẾT QUẢ ĐỐI SOÁT */}
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#f8fafc] sticky top-0 border-b border-gray-200 text-gray-600 font-bold text-[11px]">
                    <tr>
                      <th className="p-2.5 border-r border-gray-200 text-center w-10">STT</th>
                      <th className="p-2.5 border-r border-gray-200">Code vé NCC</th>
                      <th className="p-2.5 border-r border-gray-200">Chuyến bay</th>
                      <th className="p-2.5 border-r border-gray-200 text-right">Tiền NCC kê</th>
                      <th className="p-2.5 border-r border-gray-200">Nhân sự nội bộ</th>
                      <th className="p-2.5 border-r border-gray-200 text-right">Tiền nội bộ</th>
                      <th className="p-2.5 border-r border-gray-200 text-right">Chênh lệch</th>
                      <th className="p-2.5 text-center">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDisplayRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="p-2 text-center text-gray-400 border-r border-gray-100">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-gray-800 border-r border-gray-100 uppercase">
                          {row.codeVe}
                        </td>
                        <td className="p-2 font-bold text-gray-700 border-r border-gray-100">
                          {row.chuyenBay || '---'}
                        </td>
                        <td className="p-2 text-right font-extrabold text-indigo-950 border-r border-gray-100">
                          {formatCurrency(row.soTienNcc)} đ
                        </td>
                        <td className="p-2 border-r border-gray-100">
                          {row.matchedVe ? (
                            <div>
                              <span className="font-bold text-[#05469B] block">{row.matchedVe.ho_ten}</span>
                              <span className="text-[10px] text-gray-400 font-mono">[{row.matchedVe.ma_so_nhan_vien}]</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Chưa khớp nhân sự</span>
                          )}
                        </td>
                        <td className="p-2 text-right font-bold text-gray-800 border-r border-gray-100">
                          {row.matchedVe ? `${formatCurrency(row.matchedVe.cty_thanh_toan || row.matchedVe.tong_tien || 0)} đ` : '---'}
                        </td>
                        <td className="p-2 text-right font-black border-r border-gray-100">
                          {row.status === 'PRICE_MISMATCH' ? (
                            <span className={row.diffAmount > 0 ? 'text-red-600' : 'text-emerald-600'}>
                              {row.diffAmount > 0 ? `+${formatCurrency(row.diffAmount)}` : formatCurrency(row.diffAmount)} đ
                            </span>
                          ) : row.status === 'MATCHED' ? (
                            <span className="text-gray-400">0 đ</span>
                          ) : (
                            <span className="text-gray-300">---</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {row.status === 'MATCHED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Khớp
                            </span>
                          )}
                          {row.status === 'PRICE_MISMATCH' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              ⚠ Lệch tiền
                            </span>
                          )}
                          {row.status === 'NOT_FOUND' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              ✕ Thiếu vé
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div className="text-xs text-gray-500">
            {stats.matched > 0 && (
              <span>
                Sẵn sàng cập nhật trạng thái khớp cho <strong className="text-emerald-700">{stats.matched}</strong> vé nội bộ.
              </span>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={submitting || parsedRows.length === 0 || stats.matched === 0}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 shadow-md transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
              <span>Áp Dụng Kết Quả Đối Chiếu ({stats.matched + stats.priceMismatch})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
