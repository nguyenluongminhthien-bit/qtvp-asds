import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardPaste, AlertTriangle, CheckCircle, Loader2, Info } from 'lucide-react';
import { toUnaccented } from '../../utils/formatters';

export interface ColumnMapItem {
  label: string;
  key: string;
  type: 'text' | 'date' | 'number' | 'select';
  required?: boolean;
}

interface PasteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any[]) => Promise<void> | void;
  title: string;
  columnMapping: ColumnMapItem[];
  // Cho phép bên ngoài truyền hàm kiểm tra để trả về lỗi (đỏ) hoặc cảnh báo (vàng)
  onValidateRow?: (row: any) => { errors: Record<string, string>; warnings: Record<string, string> };
}

export default function PasteImportModal({
  isOpen,
  onClose,
  onSave,
  title,
  columnMapping,
  onValidateRow
}: PasteImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [rowStatus, setRowStatus] = useState<{ errors: Record<string, string>; warnings: Record<string, string> }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setParsedData([]);
      setRowStatus([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseExcelText = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentCell += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === '\t') {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\n') {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
        } else if (char === '\r') {
          // Bỏ qua \r
        } else {
          currentCell += char;
        }
      }
    }
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
    }
    return rows;
  };

  const formatExcelDate = (dateStr: string): string => {
    if (!dateStr) return '';
    // Hỗ trợ định dạng dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
    const parts = dateStr.split(/[\/\-.]/);
    if (parts.length === 3) {
      let d = parts[0].padStart(2, '0');
      let m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`; // Trả về định dạng ISO yyyy-mm-dd
    }
    return dateStr;
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    if (!val.trim()) {
      setParsedData([]);
      setRowStatus([]);
      return;
    }

    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const rawRows = parseExcelText(val);
        if (rawRows.length === 0) {
          setParsedData([]);
          setRowStatus([]);
          return;
        }

        // Bỏ qua dòng tiêu đề nếu phát hiện
        let startIndex = 0;
        if (rawRows.length > 0) {
          const firstRowStr = rawRows[0].map(c => toUnaccented(c || '')).join(' ');
          if (
            firstRowStr.includes('stt') ||
            firstRowStr.includes('msnv') ||
            firstRowStr.includes('ho ten') ||
            firstRowStr.includes('cccd') ||
            firstRowStr.includes('nhom')
          ) {
            startIndex = 1;
          }
        }

        const items: any[] = [];
        const statuses: { errors: Record<string, string>; warnings: Record<string, string> }[] = [];

        for (let i = startIndex; i < rawRows.length; i++) {
          const row = rawRows[i];
          // Bỏ qua dòng trống
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;

          const item: Record<string, any> = {};
          columnMapping.forEach((col, colIdx) => {
            const rawVal = row[colIdx] || '';
            if (col.type === 'date') {
              item[col.key] = formatExcelDate(rawVal);
            } else if (col.type === 'number') {
              const numVal = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
              item[col.key] = isNaN(numVal) ? null : numVal;
            } else {
              item[col.key] = rawVal;
            }
          });

          // Thực hiện validate cơ bản (required)
          const errors: Record<string, string> = {};
          const warnings: Record<string, string> = {};

          columnMapping.forEach(col => {
            if (col.required && !item[col.key]) {
              errors[col.key] = `Cột "${col.label}" là bắt buộc.`;
            }
            if (col.type === 'date' && item[col.key]) {
              const d = new Date(item[col.key]);
              if (isNaN(d.getTime())) {
                errors[col.key] = `Định dạng ngày không hợp lệ (cần dd/mm/yyyy).`;
              }
            }
          });

          // Validate tùy biến từ bên ngoài (ví dụ đối chiếu MSNV)
          if (onValidateRow) {
            const customVal = onValidateRow(item);
            Object.assign(errors, customVal.errors);
            Object.assign(warnings, customVal.warnings);
          }

          items.push(item);
          statuses.push({ errors, warnings });
        }

        setParsedData(items);
        setRowStatus(statuses);
      } catch (err) {
        console.error('Lỗi phân tích dữ liệu dán Excel:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 100);
  };

  const totalErrors = rowStatus.reduce((sum, s) => sum + Object.keys(s.errors).length, 0);
  const totalWarnings = rowStatus.reduce((sum, s) => sum + Object.keys(s.warnings).length, 0);
  const hasErrors = totalErrors > 0;

  const handleConfirmSave = async () => {
    if (hasErrors || parsedData.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(parsedData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-lime-50 to-emerald-50 border-b border-lime-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-lime-100 text-lime-700 rounded-xl">
              <ClipboardPaste size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
              <p className="text-xs text-gray-500 font-medium">Sao chép toàn bộ bảng từ Excel (bao gồm cả dòng tiêu đề hoặc không) rồi Ctrl+V dán vào ô bên dưới</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Hướng dẫn cột */}
          <div className="p-4 bg-lime-50/50 rounded-2xl border border-lime-100/50 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600 font-medium shrink-0">
            <span className="text-lime-800 font-bold flex items-center gap-1"><Info size={14} /> Thứ tự các cột dán yêu cầu:</span>
            {columnMapping.map((col, idx) => (
              <span key={col.key} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                <span className="text-gray-400 font-semibold">{idx + 1}.</span>
                <span>{col.label}</span>
                {col.required && <span className="text-red-500">*</span>}
              </span>
            ))}
          </div>

          {/* Vùng dán dữ liệu */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              Vùng dán dữ liệu Excel (Paste area)
            </label>
            <textarea
              value={rawText}
              onChange={handlePasteChange}
              disabled={isAnalyzing || isSaving}
              placeholder="Nhấp vào đây và nhấn Ctrl+V để dán dữ liệu từ file Excel..."
              className="w-full h-32 p-3.5 border-2 border-dashed border-gray-300 rounded-2xl outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-100 bg-gray-50/50 hover:bg-gray-50/80 focus:bg-white transition-all text-sm font-mono"
            />
          </div>

          {/* Trạng thái phân tích */}
          {isAnalyzing && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-500 shrink-0">
              <Loader2 className="animate-spin text-lime-600" size={32} />
              <span className="text-sm font-medium">Đang phân tích cú pháp dữ liệu Excel...</span>
            </div>
          )}

          {/* Bảng Preview */}
          {!isAnalyzing && parsedData.length > 0 && (
            <div className="flex-1 flex flex-col gap-3 min-h-[250px]">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 shrink-0">
                <div className="flex items-center gap-3">
                  <h4 className="font-bold text-gray-800 text-sm">Xem trước dữ liệu ({parsedData.length} dòng)</h4>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="px-2 py-0.5 bg-lime-100 text-lime-800 rounded-lg flex items-center gap-1">
                      <CheckCircle size={12} /> Hợp lệ: {parsedData.length - (hasErrors ? 1 : 0)}
                    </span>
                    {totalErrors > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg flex items-center gap-1">
                        <AlertTriangle size={12} /> Lỗi nghiêm trọng: {totalErrors} ô
                      </span>
                    )}
                    {totalWarnings > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-lg flex items-center gap-1">
                        <AlertTriangle size={12} /> Cảnh báo: {totalWarnings} ô
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="py-1.5 px-2 font-bold text-gray-600 w-10 border-r border-gray-200 text-center">STT</th>
                      {columnMapping.map(col => (
                        <th key={col.key} className="py-1.5 px-2 font-bold text-gray-600 border-r border-gray-200">
                          {col.label} {col.required && <span className="text-red-500">*</span>}
                        </th>
                      ))}
                      <th className="py-1.5 px-2 font-bold text-gray-600">Trạng thái rà soát</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((item, idx) => {
                      const status = rowStatus[idx];
                      const rowHasError = Object.keys(status?.errors || {}).length > 0;
                      const rowHasWarning = Object.keys(status?.warnings || {}).length > 0;

                      let rowClass = 'hover:bg-gray-50';
                      if (rowHasError) rowClass = 'bg-red-50/70 hover:bg-red-50';
                      else if (rowHasWarning) rowClass = 'bg-lime-50/40 hover:bg-lime-50/60';

                      return (
                        <tr key={idx} className={`border-b border-gray-150 transition-colors ${rowClass}`}>
                          <td className="py-1.5 px-2 text-gray-400 font-semibold text-center border-r border-gray-200">{idx + 1}</td>
                          {columnMapping.map(col => {
                            const val = item[col.key];
                            const errorMsg = status?.errors[col.key];
                            const warningMsg = status?.warnings[col.key];

                            let cellClass = 'border-r border-gray-250';
                            if (errorMsg) cellClass += ' bg-red-100 text-red-800 font-medium';
                            else if (warningMsg) cellClass += ' bg-lime-100 text-lime-900';

                            return (
                              <td key={col.key} className={`py-1.5 px-2 ${cellClass}`} title={errorMsg || warningMsg}>
                                {col.type === 'date' && val
                                  ? new Date(val).toLocaleDateString('vi-VN')
                                  : String(val ?? '')}
                              </td>
                            );
                          })}
                          <td className="py-1.5 px-2">
                            {rowHasError && (
                              <span className="text-red-600 font-bold flex items-center gap-1">
                                <AlertTriangle size={14} /> Lỗi dữ liệu
                              </span>
                            )}
                            {!rowHasError && rowHasWarning && (
                              <span className="text-lime-700 font-semibold flex items-center gap-1">
                                <AlertTriangle size={14} /> {Object.values(status.warnings).join(', ')}
                              </span>
                            )}
                            {!rowHasError && !rowHasWarning && (
                              <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle size={14} /> Sẵn sàng nhập
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
          <div className="text-xs text-gray-500 font-medium">
            {parsedData.length > 0 && (
              <>
                Phát hiện <span className="font-bold text-gray-800">{parsedData.length}</span> dòng.
                {hasErrors ? (
                  <span className="text-red-500 font-bold ml-1">Vui lòng sửa các ô bị tô đỏ trong file Excel gốc và dán lại.</span>
                ) : (
                  <span className="text-lime-700 font-bold ml-1">Tất cả các dòng hợp lệ! Sẵn sàng nhập dữ liệu.</span>
                )}
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-white hover:bg-gray-100 border border-gray-300 hover:border-gray-400 text-gray-700 font-bold rounded-2xl transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleConfirmSave}
              disabled={hasErrors || parsedData.length === 0 || isSaving}
              className={`px-6 py-2 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all ${
                hasErrors || parsedData.length === 0 || isSaving
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-lime-600 hover:bg-lime-700 text-white shadow-lime-100'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Xác nhận & Lưu
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
