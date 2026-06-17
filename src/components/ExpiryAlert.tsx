// Component banner cảnh báo hết hạn — hiển thị ở đầu trang khi có hạng mục quá hạn
// Tích hợp vào DashboardPage để người dùng thấy ngay khi đăng nhập
import React, { useState, useEffect } from 'react';
import { AlertCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { apiService } from '../services/api';
import { parseDateStrict } from '../utils/formatters';

// 🟢 1. THÊM HÀM TÍNH NGÀY THÔNG MINH (ĐỒNG BỘ VỚI DASHBOARD)
const extractDateAndAddDuration = (durationRaw: any, startDateRaw: any): Date | null => {
  const baseDate = parseDateStrict(startDateRaw);
  if (!baseDate) return null;
  
  let monthsToAdd = 0;
  const s = String(durationRaw).toLowerCase().trim();
  
  if (/^\d+$/.test(s)) {
    monthsToAdd = parseInt(s, 10);
  } else {
    const monthMatch = s.match(/(\d+)\s*tháng/);
    const yearMatch = s.match(/(\d+)\s*năm/);
    if (monthMatch) monthsToAdd = parseInt(monthMatch[1], 10);
    else if (yearMatch) monthsToAdd = parseInt(yearMatch[1], 10) * 12;
  }
  
  if (monthsToAdd > 0) {
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
  }
  return baseDate;
};

interface ExpiryItem {
  label: string;
  unitName: string;
  expDate: Date;
  daysLeft: number;
  type: 'expired' | 'warning';
}

interface Props {
  selectedUnitId?: string | null;
  donViMap: Record<string, string>;
}

export default function ExpiryAlert({ selectedUnitId, donViMap }: Props) {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pcccData, anNinhData, atvsldData] = await Promise.all([
          apiService.getPCCC().catch(() => []),
          apiService.getAnNinh().catch(() => []),
          apiService.getATVSLD().catch(() => []),
        ]);

        const found: ExpiryItem[] = [];
        const today = new Date(); 
        today.setHours(0, 0, 0, 0);
        const WARNING_DAYS = 30;

        // 🟢 2. CẬP NHẬT HÀM CHECK ĐỂ NHẬN TRỰC TIẾP DATE OBJECT
        const checkDateObj = (d: Date | null, label: string, unitId: string) => {
          if (!d) return;
          d.setHours(0, 0, 0, 0); // Đảm bảo đồng bộ giờ để tính toán chính xác
          
          const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
          if (diff <= WARNING_DAYS) {
            found.push({
              label,
              unitName: donViMap[unitId] || unitId,
              expDate: d,
              daysLeft: diff,
              type: diff < 0 ? 'expired' : 'warning',
            });
          }
        };

        const checkStr = (dateStr: any, label: string, unitId: string) => {
          checkDateObj(parseDateStrict(dateStr), label, unitId);
        };

        pcccData.forEach((p: any) => {
          if (selectedUnitId && p.id_don_vi !== selectedUnitId) return;
          checkStr(p.ngay_het_han_bh, 'Bảo hiểm cháy nổ', p.id_don_vi);
          checkStr(p.ngay_dien_tap, 'Diễn tập PCCC', p.id_don_vi);
        });

        // 🟢 3. ĐỒNG BỘ LOGIC TÍNH NGÀY HỢP ĐỒNG BẢO VỆ TỪ DASHBOARD SANG
        anNinhData.forEach((a: any) => {
          if (selectedUnitId && a.id_don_vi !== selectedUnitId) return;
          
          let expDate = null;
          const directExpRaw = a.ngay_het_han || a.ngay_het_han_hd || a.ngay_ket_thuc || a.ngay_kt;
          
          if (directExpRaw) {
             expDate = parseDateStrict(directExpRaw);
          }

          if (!expDate) {
             const durationRaw = a.han_hop_dong || a.han_hd || a.thoi_han_hd || a.thoi_gian_hd || a.thoi_han || a.thoi_gian_luu || ''; 
             const startRaw = a.ngay_ky_hd || a.ngay_cd || a.ngay_ky || a.ngay_bat_dau || '';
             expDate = extractDateAndAddDuration(durationRaw, startRaw);
          }

          const giaHanThem = Number(a.gia_han_them) || 0;
          if (expDate && giaHanThem > 0) {
            expDate.setMonth(expDate.getMonth() + giaHanThem);
          }

          checkDateObj(expDate, 'Hợp đồng BV', a.id_don_vi);
        });

        atvsldData.forEach((at: any) => {
          if (selectedUnitId && at.id_don_vi !== selectedUnitId) return;
          checkStr(at.ngay_huan_luyen_gan_nhat, 'Huấn luyện ATVSLĐ', at.id_don_vi);
          checkStr(at.ngay_ksk, 'Khám sức khỏe', at.id_don_vi);
        });

        // Chỉ lấy những cái đã Quá hạn để hiển thị (Bạn có thể bỏ .filter nếu muốn hiện cả Sắp hết hạn)
        const expiredItems = found.filter(i => i.type === 'expired');
        expiredItems.sort((a, b) => a.daysLeft - b.daysLeft);
        
        setItems(expiredItems);
      } catch { 
        setItems([]); 
      }
    })();
  }, [selectedUnitId, donViMap]);

  // 🟢 NẾU KHÔNG CÓ CẢNH BÁO QUÁ HẠN HOẶC ĐÃ BỊ TẮT THÌ ẨN ĐI
  if (items.length === 0 || isDismissed) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm mb-6">
      {/* HEADER - BẤM ĐỂ MỞ RỘNG/THU GỌN */}
      <div className="flex justify-between items-center p-3 sm:p-4">
        
        {/* Khối bấm mở rộng/thu gọn danh sách */}
        <div 
          className="flex items-center gap-2 text-red-700 cursor-pointer flex-1"
          onClick={() => setIsOpen(!isOpen)}
        >
          <AlertCircle size={18} className="animate-pulse shrink-0" />
          <h3 className="font-bold text-sm">
            {items.length} hạng mục đã quá hạn
          </h3>
        </div>

        {/* KHỐI NÚT THAO TÁC Ở GÓC PHẢI */}
        <div className="flex items-center gap-2 text-gray-400 shrink-0">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Xem chi tiết"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          <div className="w-px h-4 bg-gray-300"></div> {/* Thanh phân cách nhỏ */}
          
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài
              setIsDismissed(true);
            }}
            className="p-1 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Đóng cảnh báo"
          >
            <X size={16} />
          </button>
        </div>

      </div>

      {/* DANH SÁCH CHI TIẾT KHI MỞ RỘNG */}
      {isOpen && (
        <div className="border-t border-red-100 bg-white">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                {items.map((warn, idx) => (
                  <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                    <td className="p-3 w-28">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded border border-red-200 text-[10px] uppercase whitespace-nowrap">
                        Quá hạn
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-800">
                      {warn.label}
                      <span className="text-gray-400 mx-2">—</span>
                      <span className="text-gray-600 font-normal">{warn.unitName}</span>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-500 text-xs w-24">
                      {warn.expDate.toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}