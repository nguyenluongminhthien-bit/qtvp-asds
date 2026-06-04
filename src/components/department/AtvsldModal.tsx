import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, HardHat, Users, Shield, Settings, AlertCircle, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from "../../utils/toast";

const EMPTY_FORM = {
  id: '', id_don_vi: '', nguoi_phu_trach: '', so_luong_mang_luoi: '', link_ho_so_quy_dinh: '',
  khoa_huan_luyen_tu: '', khoa_huan_luyen_den: '', can_cu_quyet_dinh: '', thong_ke_hl: null,
  ty_le_hoan_thanh_hl: '', ngay_ksk: '', ngay_kham_bnn: '',
  so_luong_thiet_bi_nghiem_ngat: '', so_luong_thiet_bi_qua_han_kt: '0', ngay_quan_trac_mt: '',
  ty_le_cap_bhld: 'Đầy đủ', ngay_tu_kiem_tra: '', cac_loi_hien_truong: '',
  so_tai_nan_trong_nam: '0', link_bien_ban_kiem_tra: '', ghi_chu: ''
};

interface Props {
  isOpen: boolean;
  currentData: any | null;
  selectedUnitId: string | null;
  onSaved: (data: any, isCreate: boolean) => void;
  onClose: () => void;
}

export default function AtvsldModal({ isOpen, currentData, selectedUnitId, onSaved, onClose }: Props) {
  // 🟢 TẤT CẢ HOOKS PHẢI ĐẶT Ở TRÊN CÙNG
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pastedText, setPastedText] = useState(''); // <-- Đã được di chuyển lên vị trí an toàn

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPastedText(''); // Reset lại ô text mỗi khi mở modal
      
      // 🟢 BẢO VỆ DỮ LIỆU: Tự động Parse JSON nếu dữ liệu gốc là String
      let safeData = currentData ? { ...currentData } : null;
      if (safeData && typeof safeData.thong_ke_hl === 'string') {
        try {
          safeData.thong_ke_hl = JSON.parse(safeData.thong_ke_hl);
        } catch (e) {
          safeData.thong_ke_hl = null;
        }
      }

      setFormData(safeData
        ? { ...safeData, id: safeData.id || '' }
        : { ...EMPTY_FORM, id: `AT${Date.now()}`, id_don_vi: selectedUnitId || '' }
      );
    }
  }, [isOpen, currentData, selectedUnitId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const parseTrainingDates = (timeString: string) => {
    if (!timeString) return { tu: '', den: '' };
    try {
      const parts = timeString.split('-').map(s => s.trim());
      if (parts.length === 2) {
        let endStr = parts[1];
        const yearMatch = endStr.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

        let startStr = parts[0]; 
        if (!startStr.includes(year)) startStr += `/${year}`;

        const formatToISO = (str: string) => {
          const p = str.split('/');
          if (p.length !== 3) return '';
          let y = p[2];
          if (y.length < 4) y = year; 
          return `${y}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        };

        return { tu: formatToISO(startStr), den: formatToISO(endStr) };
      }
      return { tu: '', den: '' };
    } catch (e) {
      return { tu: '', den: '' };
    }
  };

  const toUnaccented = (str: any) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]/g, ""); 
  };

  // 🟢 HÀM PHÂN TÍCH DỮ LIỆU COPY-PASTE TỪ EXCEL (TSV FORMAT) CHUẨN XÁC 100%
  const handlePasteData = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawText = e.target.value;
    setPastedText(rawText);

    if (!rawText.trim()) return;

    setIsAnalyzing(true);
    
    // Sử dụng setTimeout để UI không bị đơ khi người dùng dán hàng ngàn dòng
    setTimeout(() => {
      try {
        // 1. THUẬT TOÁN PARSE DỮ LIỆU EXCEL DÁN (Xử lý hoàn hảo các ô có dấu Alt+Enter)
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < rawText.length; i++) {
          const char = rawText[i];
          
          if (inQuotes) {
            if (char === '"') {
              if (i + 1 < rawText.length && rawText[i + 1] === '"') {
                currentCell += '"';
                i++; // Bỏ qua dấu nháy kép escape của Excel
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
              // Bỏ qua ký tự \r của Windows
            } else {
              currentCell += char;
            }
          }
        }
        if (currentCell !== '' || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
        }

        // 2. XÁC ĐỊNH VỊ TRÍ CỘT CỐ ĐỊNH (Dựa vào thiết kế Bảng của anh Thiện)
        let colNhom = 9;      // Cột số 10 trong Excel (Nhóm)
        let colThoiGian = 11; // Cột số 12 trong Excel (Thời gian)
        let colKetQua = 14;   // Cột số 15 trong Excel (Kết quả)

        // (Fallback) Nếu người dùng có lỡ quét cả dòng tiêu đề, hệ thống sẽ tự động bỏ qua dòng đó
        if (rows.length > 0 && rows[0].length >= 10) {
          const checkHeader = rows[0].map(c => toUnaccented(c));
          if (checkHeader.includes('stt') || checkHeader.includes('msnv') || checkHeader.includes('hoten')) {
            rows.shift(); // Cắt bỏ dòng tiêu đề
          }
        }

        const stats: Record<string, { total: number, dat: number, khong_dat: number }> = {
          '1': { total: 0, dat: 0, khong_dat: 0 },
          '2': { total: 0, dat: 0, khong_dat: 0 },
          '3': { total: 0, dat: 0, khong_dat: 0 },
          '4': { total: 0, dat: 0, khong_dat: 0 },
          '6': { total: 0, dat: 0, khong_dat: 0 },
        };

        let foundDateTu = '';
        let foundDateDen = '';
        let totalNV = 0;
        let totalDat = 0;

        let lastNhom = '';
        let lastThoiGian = '';

        // 3. DUYỆT VÀ ĐẾM DỮ LIỆU
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          
          // Bỏ qua nếu dòng bị ngắn, thiếu cột
          if (!row || row.length < Math.max(colNhom, colKetQua)) continue; 

          // 🟢 BỔ SUNG: LOGIC NHẬN DIỆN VÀ BỎ QUA DÒNG TIÊU ĐỀ THÔNG MINH
          const checkHeader1 = toUnaccented(row[0] || ''); // Cột STT
          const checkHeader2 = toUnaccented(row[1] || ''); // Cột Mã NV hoặc Họ tên
          const checkHeader3 = toUnaccented(row[2] || ''); // Cột Họ tên
          
          if (checkHeader1.includes('stt') || checkHeader2.includes('ma') || checkHeader2.includes('msnv') || checkHeader2.includes('ten') || checkHeader3.includes('ten')) {
            continue; // Phát hiện tiêu đề -> Bỏ qua, đi đếm người tiếp theo
          }

          let nhomRaw = String(row[colNhom] || '').trim();
          let thoiGianRaw = String(row[colThoiGian] || '').trim();

          // Xử lý Merge Cell (Nếu ô Nhóm bị trống, tự động lấy giá trị của người bên trên)
          if (nhomRaw === '' && lastNhom !== '') nhomRaw = lastNhom;
          else lastNhom = nhomRaw;

          if (thoiGianRaw === '' && lastThoiGian !== '') thoiGianRaw = lastThoiGian;
          else lastThoiGian = thoiGianRaw;

          const nhom = nhomRaw.replace(/\D/g, ''); 
          const ketQua = String(row[colKetQua] || '').toLowerCase();

          if (stats[nhom] !== undefined && nhom !== '') {
            if (ketQua.replace(/\s/g, '') === '') continue; // Không có chữ Đạt/Rớt thì bỏ qua

            stats[nhom].total += 1;
            totalNV++;
            
            if (ketQua.includes('đạt') && !ketQua.includes('không')) {
              stats[nhom].dat += 1;
              totalDat++;
            } else {
              stats[nhom].khong_dat += 1;
            }
          }

          if (thoiGianRaw && (!foundDateTu || !foundDateDen)) {
            const parsed = parseTrainingDates(thoiGianRaw);
            if (parsed.tu && parsed.den) {
              foundDateTu = parsed.tu;
              foundDateDen = parsed.den;
            }
          }
        }

        if (totalNV === 0) {
          toast.warning('Dán thành công nhưng không đếm được người nào (Sai vị trí cột hoặc thiếu kết quả).');
          setIsAnalyzing(false);
          return;
        }

        const tyLeTong = Math.round((totalDat / totalNV) * 100);

        // 4. LƯU VÀO FORM
        setFormData((prev: any) => ({
          ...prev,
          khoa_huan_luyen_tu: foundDateTu || prev.khoa_huan_luyen_tu,
          khoa_huan_luyen_den: foundDateDen || prev.khoa_huan_luyen_den,
          ty_le_hoan_thanh_hl: `${tyLeTong}%`,
          thong_ke_hl: stats
        }));

        toast.success(`Đã nhận diện & phân tích xong ${totalNV} nhân sự!`);
        setPastedText(''); 
      } catch (err) {
        console.error(err);
        toast.error('Lỗi phân tích dữ liệu Copy. Vui lòng thử lại.');
      } finally {
        setIsAnalyzing(false);
      }
    }, 100); 
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSubmitting(true); 
    setError(null);
    
    let finalData: any = { ...formData };

    Object.keys(finalData).forEach(key => {
      if (finalData[key] === '' || finalData[key] === ' ') {
        finalData[key] = null;
      }
    });

    const isCreate = !currentData;
    const mode = isCreate ? 'create' : 'update';
    
    if (isCreate && (!finalData.id || finalData.id === '')) {
      finalData.id = `AT${Date.now()}`;
    }
    
    try {
      await apiService.save(finalData, mode, 'hs_an_toan_lao_dong');
      onSaved(finalData, isCreate);
      onClose();
      if (isCreate) {
        toast.success("Thêm mới hồ sơ An toàn lao động thành công!");
      } else {
        toast.success("Cập nhật hồ sơ An toàn lao động thành công!");
      }
    } catch (err: any) { 
      setError(err.message || 'Lỗi lưu dữ liệu ATVSLĐ.'); 
      toast.error(err.message || "Đã xảy ra lỗi khi lưu hồ sơ ATVSLĐ!");
    } finally { 
      setSubmitting(false); 
    }
  };

  // 🟢 THÊM ĐÚNG 1 DÒNG NÀY ĐỂ BẢO VỆ MODAL (Ẩn đi khi isOpen = false)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between p-5 border-b border-emerald-100 bg-emerald-50 rounded-t-2xl shrink-0">
          <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2"><HardHat size={24}/> {formData.id && currentData ? 'Cập nhật Hồ sơ ATVSLĐ' : 'Tạo Hồ sơ ATVSLĐ'}</h3>
          <button onClick={onClose} disabled={submitting} className="text-emerald-400 hover:text-red-500 rounded-full p-1.5 bg-white shadow-sm transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>}
        
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* CỘT 1 */}
            <div className="space-y-6">
              <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-100 shadow-sm">
                <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2 border-b border-blue-200 pb-2"><Users size={18}/> 1. Tổ chức & Nhân sự</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Người phụ trách ATVSLĐ</label><input type="text" name="nguoi_phu_trach" value={formData.nguoi_phu_trach || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500" placeholder="Họ và tên..." /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Mạng lưới ATVS Viên (Người)</label><input type="number" name="so_luong_mang_luoi" value={formData.so_luong_mang_luoi || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Tỷ lệ Cấp phát BHLĐ</label><select name="ty_le_cap_bhld" value={formData.ty_le_cap_bhld || 'Đầy đủ'} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500"><option value="Đầy đủ">Đầy đủ</option><option value="Đang thiếu">Đang thiếu / Chờ cấp</option></select></div>
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Link Kế hoạch / Hồ sơ gốc</label><input type="url" name="link_ho_so_quy_dinh" value={formData.link_ho_so_quy_dinh || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-blue-500 text-blue-600" placeholder="https://drive.google.com/..." /></div>
                </div>
              </div>

              <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 shadow-sm">
                <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200 pb-2"><Shield size={18}/> 2. Sức khỏe & Huấn luyện</h4>
                
                {/* 🟢 KHU VỰC COPY/PASTE EXCEL TRỰC TIẾP */}
                <div className="mb-5 bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Dán dữ liệu Huấn luyện từ Excel</p>
                      <p className="text-[10px] font-medium text-emerald-600/70">Bôi đen bảng Excel, copy và dán vào ô bên dưới, có hay không có tiêu đề đều được.</p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <textarea 
                      value={pastedText}
                      onChange={handlePasteData}
                      disabled={isAnalyzing}
                      placeholder="Click vào đây và nhấn Ctrl+V (Hoặc Cmd+V) để dán bảng dữ liệu Excel..."
                      className="w-full h-24 p-3 text-sm border-2 border-dashed border-emerald-300 rounded-lg outline-none focus:border-emerald-500 focus:bg-white bg-white/50 resize-none font-medium text-gray-600 transition-colors"
                    ></textarea>
                    
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center border border-emerald-200">
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-1" />
                        <p className="text-xs font-bold text-emerald-700">Đang quét dữ liệu...</p>
                      </div>
                    )}
                  </div>
                  
                  {formData.thong_ke_hl && !pastedText && !isAnalyzing && (
                    <div className="mt-2 text-right">
                      <span className="inline-block text-[10px] bg-emerald-500 text-white font-bold px-3 py-1 rounded-md shadow-sm">
                        ✓ Đã phân tích và lưu số liệu thành công
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Căn cứ Quyết định</label>
                    <input type="text" name="can_cu_quyet_dinh" value={formData.can_cu_quyet_dinh || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500" placeholder="VD: Quyết định số 176/2026/QĐ-Tr.CĐ..." />
                  </div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Huấn luyện Từ ngày</label><input type="date" name="khoa_huan_luyen_tu" value={formData.khoa_huan_luyen_tu ? formData.khoa_huan_luyen_tu.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" /></div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Đến ngày</label><input type="date" name="khoa_huan_luyen_den" value={formData.khoa_huan_luyen_den ? formData.khoa_huan_luyen_den.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700" /></div>
                  
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Tỷ lệ hoàn thành HL Chung</label><input type="text" name="ty_le_hoan_thanh_hl" value={formData.ty_le_hoan_thanh_hl || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="VD: 100%" /></div>
                  
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Ngày Khám SK Định kỳ</label><input type="date" name="ngay_ksk" value={formData.ngay_ksk ? formData.ngay_ksk.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-emerald-500 font-bold" /></div>
                  <div><label className="block text-[10px] font-bold text-orange-600 mb-1 uppercase">Ngày Khám Bệnh Nghề nghiệp</label><input type="date" name="ngay_kham_bnn" value={formData.ngay_kham_bnn ? formData.ngay_kham_bnn.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-orange-200 rounded-lg bg-orange-50 outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-700" title="Dành cho LĐ Nặng nhọc/Độc hại" /></div>
                </div>
              </div>
            </div>

            {/* CỘT 2 */}
            <div className="space-y-6">
              <div className="bg-orange-50/40 p-5 rounded-xl border border-orange-100 shadow-sm">
                <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2 border-b border-orange-200 pb-2"><Settings size={18}/> 3. Máy móc & Môi trường</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Tổng Thiết bị Nghiêm ngặt</label><input type="number" name="so_luong_thiet_bi_nghiem_ngat" value={formData.so_luong_thiet_bi_nghiem_ngat || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500" placeholder="Thang nâng, máy nén..." /></div>
                  <div><label className="block text-xs font-bold text-red-600 mb-1">Thiết bị Quá hạn Kiểm định</label><input type="number" name="so_luong_thiet_bi_qua_han_kt" value={formData.so_luong_thiet_bi_qua_han_kt || '0'} onChange={handleChange} className="w-full p-2.5 border border-red-300 rounded-lg bg-red-50 outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-700" /></div>
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Ngày Đo kiểm Môi trường LĐ gần nhất</label><input type="date" name="ngay_quan_trac_mt" value={formData.ngay_quan_trac_mt ? formData.ngay_quan_trac_mt.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-[#FFFFF0] outline-none focus:ring-2 focus:ring-orange-500 font-bold text-gray-700" /></div>
                </div>
              </div>

              <div className="bg-red-50/40 p-5 rounded-xl border border-red-200 shadow-sm">
                <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2 border-b border-red-200 pb-2"><AlertCircle size={18}/> 4. Hiện trường & Sự cố</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Ngày Tự KT / Checklist</label><input type="date" name="ngay_tu_kiem_tra" value={formData.ngay_tu_kiem_tra ? formData.ngay_tu_kiem_tra.split('T')[0] : ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500" /></div>
                    <div><label className="block text-[10px] font-bold text-red-600 mb-1 uppercase">Số vụ Tai nạn LĐ (Năm)</label><input type="number" name="so_tai_nan_trong_nam" value={formData.so_tai_nan_trong_nam || '0'} onChange={handleChange} className="w-full p-2.5 border border-red-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-700" /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-red-700 mb-1">Các rủi ro / Lỗi hiện trường cần khắc phục</label>
                    <textarea name="cac_loi_hien_truong" value={formData.cac_loi_hien_truong || ''} onChange={handleChange} rows={2} className="w-full p-2.5 border border-red-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 resize-none font-medium text-red-800" placeholder="VD: Sàn xưởng trơn trượt, chưa đeo dây đai an toàn..."></textarea>
                  </div>
                  <div><label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Link Biên bản tuần tra (Checklist PDF)</label><input type="url" name="link_bien_ban_kiem_tra" value={formData.link_bien_ban_kiem_tra || ''} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 text-blue-600" /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-100 flex justify-end gap-3 mt-8 shrink-0">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">Hủy</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Lưu ATVSLĐ</button>
          </div>
        </form>
      </div>
    </div>
  );
}