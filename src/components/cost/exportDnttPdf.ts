import { DNTT, DnttChiTiet, DnttPhanBo, DmKmp, DmBoPhan, BoPhanCap1, BoPhanCap2, PhapNhan, DonVi } from '../../types';
import { numberToWordsVN } from '../../utils/numberToWordsVN';
import { THACO_AUTO_LOGO_BASE64 } from '../../assets/thacoAutoLogo';

export interface ExportDnttData {
  dntt: DNTT;
  details: DnttChiTiet[];
  allocations: Record<string, DnttPhanBo[]>; // dntt_chi_tiet_id -> DnttPhanBo[]
  phapNhan?: PhapNhan;
  donVi?: DonVi;
  kmpList?: DmKmp[];
  boPhanList?: DmBoPhan[];
  cap1List?: BoPhanCap1[];
  cap2List?: BoPhanCap2[];
}

declare global {
  interface Window {
    html2pdf?: any;
  }
}

const formatMoney = (val: number): string => {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return Math.round(val).toLocaleString('vi-VN');
};

const formatDateVN = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/**
 * Tải thư viện html2pdf.js động từ CDN nếu chưa có trong window
 */
const loadHtml2Pdf = async (): Promise<any> => {
  if (typeof window !== 'undefined' && window.html2pdf) {
    return window.html2pdf;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => {
      if (window.html2pdf) resolve(window.html2pdf);
      else reject(new Error('html2pdf not ready on window'));
    };
    script.onerror = () => reject(new Error('Không thể tải thư viện html2pdf từ CDN'));
    document.head.appendChild(script);
  });
};

/**
 * Fallback: Mở iframe in/lưu PDF nếu không tải được thư viện CDN (hoạt động offline)
 */
const fallbackPrintPdf = (htmlContent: string, fileName: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  const originalTitle = document.title;
  document.title = fileName.replace('.pdf', '');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${fileName.replace('.pdf', '')}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm 15mm 10mm 18mm; }
          body { margin: 0; padding: 0; background: #fff; }
          @media print {
            thead { display: table-header-group; }
            tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    document.title = originalTitle;
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 300);
};

/**
 * Tạo nội dung HTML cho BẢNG KÊ PHÂN BỔ CHI PHÍ (Trang 2 đính kèm Giấy ĐNTT)
 * Gồm 5 cột tinh gọn: STT | Khối/Nghiệp vụ | Thương hiệu/BP | Tỷ lệ | Số tiền (VNĐ)
 * Mục lớn: Merge 4 cột (STT đến Tỷ lệ) chứa Nội dung — Mã B7 — Mã B10 — Khoản mục; Cột 5 hiển thị tổng tiền mục đó
 * Dòng con: 1.1, 1.2... 2.1, 2.2... N.1, N.2...
 * Chân chữ ký: Bảng viền trong suốt canh giữa, ngày tháng nằm phía trên Người đề nghị
 * Cơ chế thích ứng 3 cấp độ: Tự động co gọn gom 1 trang A4 khi từ 9-16 dòng
 */
export function generateBangKePhanBoHtml(data: ExportDnttData): string {
  const { dntt, details, allocations, phapNhan, donVi, kmpList, boPhanList, cap1List, cap2List } = data;

  const tenCongTy = phapNhan?.ten_cong_ty || 'CÔNG TY TNHH THACO AUTO ĐỒNG THÁP';
  const mstCongTy = phapNhan?.ma_so_thue || '1201657894';
  const tenDonVi = dntt.don_vi_hien_thi || donVi?.ten_don_vi || 'Showroom Mỹ Tho - THACO AUTO Đồng Tháp';
  const boPhan = dntt.bo_phan_hien_thi || 'QTPV, AS & MTLV';
  const nguoiDeNghi = dntt.nguoi_de_nghi || '';
  const tongTien = Number(dntt.tong_so_tien) || 0;
  const soTienChu = dntt.so_tien_bang_chu || numberToWordsVN(tongTien);

  // Ngày ký & Địa điểm
  const today = new Date();
  const ngay = dntt.ngay_ky_ngay || (dntt.ngay_ky ? new Date(dntt.ngay_ky).getDate().toString().padStart(2, '0') : (dntt.ngay_lap ? new Date(dntt.ngay_lap).getDate().toString().padStart(2, '0') : today.getDate().toString().padStart(2, '0')));
  const thang = dntt.ngay_ky_thang || (dntt.ngay_ky ? (new Date(dntt.ngay_ky).getMonth() + 1).toString().padStart(2, '0') : (dntt.ngay_lap ? (new Date(dntt.ngay_lap).getMonth() + 1).toString().padStart(2, '0') : (today.getMonth() + 1).toString().padStart(2, '0')));
  const nam = dntt.ngay_ky_nam || (dntt.ngay_ky ? new Date(dntt.ngay_ky).getFullYear().toString() : (dntt.ngay_lap ? new Date(dntt.ngay_lap).getFullYear().toString() : today.getFullYear().toString()));
  const diaDiemKy = (dntt.dia_diem_ky && dntt.dia_diem_ky.trim()) ? dntt.dia_diem_ky.trim() : '......';

  const kmpMap = new Map((kmpList || []).map(k => [k.id, k]));
  const boPhanMap = new Map((boPhanList || []).map(b => [b.id, b]));
  const cap1Map = new Map((cap1List || []).map(c => [c.id, c.ten]));
  const cap2Map = new Map((cap2List || []).map(c => [c.id, c.ten]));

  // Tính tổng số dòng hiển thị để kích hoạt chế độ phân trang thích ứng (Smart Adaptive Layout)
  let totalRowCount = 0;
  details.forEach((item) => {
    const itemAllocations = allocations[item.id] || [];
    // 1 dòng tiêu đề mục lớn + các dòng phân bổ con (tối thiểu 1 dòng con)
    totalRowCount += 1 + (itemAllocations.length > 0 ? itemAllocations.length : 1);
  });

  // Cấp 1: Standard (<= 8 dòng) | Cấp 2: Compact Auto-fit (9 đến 16 dòng) | Cấp 3: Multi-page (> 16 dòng)
  const isCompact = totalRowCount >= 9 && totalRowCount <= 16;
  const cellPadding = isCompact ? '1.5pt 3.5pt' : '2.5pt 5pt';
  const rowHeight = isCompact ? '0.42cm' : '0.55cm';
  const tableFontSize = isCompact ? '9pt' : '10pt';
  const signSpaceHeight = isCompact ? '36pt' : '60pt';
  const headerMargin = isCompact ? '4pt' : '8pt';

  // Duyệt qua từng chi tiết ĐNTT và sinh các hàng bảng
  let rowsHtml = '';
  let totalAllocatedMoney = 0;

  details.forEach((item, itemIdx) => {
    const itemStt = item.stt || (itemIdx + 1);
    const itemAllocations = (allocations[item.id] || []).sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
    const itemAmount = Number(item.so_tien) || 0;

    // Trích xuất thông tin Khoản mục phí từ phân bổ đầu tiên hoặc item
    const firstAlloc = itemAllocations[0];
    const kmpObj = firstAlloc?.id_kmp ? kmpMap.get(firstAlloc.id_kmp) : null;
    const maB7 = kmpObj?.ma_b7 || firstAlloc?.ma_b7 || '-';
    const maB10 = kmpObj?.ma_b10 || '-';
    const tenKmp = kmpObj?.dien_giai || kmpObj?.nhom_chi_phi || firstAlloc?.ten_khoan_muc || '-';

    // 1. DÒNG MỤC LỚN (N): Merge từ STT đến Tỷ lệ (colspan=4), Cột 5 hiển thị Tổng số tiền mục lớn
    rowsHtml += `
      <tr style="background: #f1f5f9; font-weight: bold; height: ${rowHeight};">
        <td colspan="4" style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: left; vertical-align: middle;">
          <strong>${itemStt}. ${item.noi_dung}</strong>
          ${maB7 !== '-' ? ` &nbsp;—&nbsp; Mã B7: <strong>${maB7}</strong>` : ''}
          ${maB10 !== '-' ? ` &nbsp;—&nbsp; Mã B10: <strong>${maB10}</strong>` : ''}
          ${tenKmp !== '-' ? ` &nbsp;—&nbsp; Khoản mục: <strong>${tenKmp}</strong>` : ''}
        </td>
        <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: right; font-weight: bold; white-space: nowrap; vertical-align: middle;">
          ${formatMoney(itemAmount)}
        </td>
      </tr>
    `;

    // 2. CÁC DÒNG PHÂN BỔ CON CHO MỤC N: N.1, N.2...
    if (itemAllocations.length === 0) {
      totalAllocatedMoney += itemAmount;
      rowsHtml += `
        <tr style="height: ${rowHeight};">
          <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: center; vertical-align: middle;">${itemStt}.1</td>
          <td style="border: 1.0pt solid black; padding: ${cellPadding}; vertical-align: middle;">${tenDonVi}</td>
          <td style="border: 1.0pt solid black; padding: ${cellPadding}; vertical-align: middle;">${boPhan}</td>
          <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: center; vertical-align: middle;">100%</td>
          <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: right; font-weight: bold; white-space: nowrap; vertical-align: middle;">${formatMoney(itemAmount)}</td>
        </tr>
      `;
    } else {
      itemAllocations.forEach((alloc, subIdx) => {
        const subStt = `${itemStt}.${subIdx + 1}`;
        const subAmount = Number(alloc.so_tien) || 0;
        totalAllocatedMoney += subAmount;

        // Resolve Khối (Cấp 1) & Thương hiệu / Phòng (Cấp 2)
        let tenKhoi = '';
        let tenThuongHieu = '';
        if (alloc.id_bo_phan && boPhanMap.has(alloc.id_bo_phan)) {
          const bp = boPhanMap.get(alloc.id_bo_phan)!;
          tenKhoi = bp.ten_cap1 || bp.ma_cap1 || '';
          tenThuongHieu = bp.ten_cap2 || bp.ma_cap2 || '';
        } else {
          tenKhoi = cap1Map.get(alloc.id_bo_phan_cap1 || '') || alloc.id_bo_phan_cap1 || '';
          tenThuongHieu = cap2Map.get(alloc.id_bo_phan_cap2 || '') || alloc.id_bo_phan_cap2 || '';
        }

        // Tỷ lệ %
        let tyLeStr = '';
        if (alloc.phan_tram !== undefined && alloc.phan_tram !== null && alloc.phan_tram > 0) {
          tyLeStr = `${alloc.phan_tram}%`;
        } else if (itemAmount > 0) {
          tyLeStr = `${Math.round((subAmount / itemAmount) * 100)}%`;
        } else {
          tyLeStr = '-';
        }

        rowsHtml += `
          <tr style="height: ${rowHeight};">
            <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: center; vertical-align: middle;">${subStt}</td>
            <td style="border: 1.0pt solid black; padding: ${cellPadding}; vertical-align: middle;">${tenKhoi}</td>
            <td style="border: 1.0pt solid black; padding: ${cellPadding}; vertical-align: middle;">${tenThuongHieu}</td>
            <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: center; vertical-align: middle;">${tyLeStr}</td>
            <td style="border: 1.0pt solid black; padding: ${cellPadding}; text-align: right; font-weight: bold; white-space: nowrap; vertical-align: middle;">${formatMoney(subAmount)}</td>
          </tr>
        `;
      });
    }
  });

  return `
    <div style="page-break-before: always; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.35; color: #000; width: 100%; box-sizing: border-box; padding-top: ${isCompact ? '6pt' : '14pt'}; background: #ffffff;">
      <!-- 1. HEADER BẢNG KÊ -->
      <div style="margin-bottom: ${headerMargin};">
        <img src="${THACO_AUTO_LOGO_BASE64}" alt="THACO AUTO" style="width: 200px; height: auto; max-height: 42px; display: block; margin-bottom: 4px;" />
        <div style="font-size: 10pt; font-weight: bold; text-transform: uppercase; line-height: 1.3;">${tenCongTy}</div>
        <div style="font-size: 9pt; color: #333; line-height: 1.3;">MST: ${mstCongTy}</div>
      </div>

      <!-- 2. TIÊU ĐỀ BẢNG KÊ -->
      <div style="text-align: center; margin: ${isCompact ? '6pt 0' : '10pt 0'};">
        <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">BẢNG KÊ PHÂN BỔ CHI PHÍ</div>
        <div style="font-size: 10pt; font-style: italic; margin-top: 2pt;">
          (Đính kèm Giấy đề nghị thanh toán ngày: ${ngay}/${thang}/${nam})
        </div>
      </div>

      <!-- 3. THÔNG TIN ĐƠN VỊ & NGƯỜI ĐỀ NGHỊ TRÊN CÙNG 1 DÒNG DUY NHẤT -->
      <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: ${headerMargin}; font-size: 10pt; line-height: 1.4;">
        <tr>
          <td style="border: none; padding: 2pt 0; text-align: left; width: 30%; white-space: nowrap;">
            <span style="font-weight: bold;">Người đề nghị:</span> ${nguoiDeNghi}
          </td>
          <td style="border: none; padding: 2pt 0; text-align: center; width: 45%; white-space: nowrap;">
            <span style="font-weight: bold;">Đơn vị:</span> ${tenDonVi}
          </td>
          <td style="border: none; padding: 2pt 0; text-align: right; width: 25%; white-space: nowrap;">
            <span style="font-weight: bold;">Bộ phận:</span> ${boPhan}
          </td>
        </tr>
      </table>

      <!-- 4. BẢNG 5 CỘT CHI TIẾT PHÂN BỔ -->
      <table style="width: 100%; border-collapse: collapse; border: 1.0pt solid black; font-size: ${tableFontSize}; margin-bottom: 8pt;">
        <thead>
          <tr style="height: 0.65cm; background: #f5f5f5;">
            <th style="border: 1.0pt solid black; padding: 2pt 3pt; font-weight: bold; width: 1.2cm; text-align: center;">STT</th>
            <th style="border: 1.0pt solid black; padding: 2pt 4pt; font-weight: bold; width: 5.0cm; text-align: center;">Khối / Nghiệp vụ</th>
            <th style="border: 1.0pt solid black; padding: 2pt 4pt; font-weight: bold; width: 5.0cm; text-align: center;">Thương hiệu / BP</th>
            <th style="border: 1.0pt solid black; padding: 2pt 3pt; font-weight: bold; width: 1.8cm; text-align: center;">Tỷ lệ</th>
            <th style="border: 1.0pt solid black; padding: 2pt 5pt; font-weight: bold; width: 3.8cm; text-align: center;">Số tiền (VNĐ)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <!-- DÒNG TỔNG CỘNG: TỔNG CỦA CÁC MỤC LỚN -->
          <tr style="height: 0.6cm; background: #fafafa; font-weight: bold;">
            <td colspan="4" style="border: 1.0pt solid black; padding: ${cellPadding}; font-weight: bold; text-align: center; vertical-align: middle;">
              TỔNG CỘNG GIÁ TRỊ PHÂN BỔ
            </td>
            <td style="border: 1.0pt solid black; padding: ${cellPadding}; font-weight: bold; text-align: right; white-space: nowrap; vertical-align: middle;">
              ${formatMoney(totalAllocatedMoney || tongTien)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- SỐ TIỀN BẰNG CHỮ -->
      <div style="font-size: 10pt; font-style: italic; margin-bottom: ${isCompact ? '6pt' : '10pt'};">
        (Bằng chữ: ${soTienChu})
      </div>

      <!-- 5. NGÀY THÁNG VÀ 2 CHỮ KÝ (BẢNG VIỀN TRONG SUỐT, NGÀY THÁNG NẰM TRÊN NGƯỜI ĐỀ NGHỊ CANH GIỮA) -->
      <div style="page-break-inside: avoid; break-inside: avoid; margin-top: ${isCompact ? '6pt' : '10pt'};">
        <table style="width: 100%; border-collapse: collapse; border: none; text-align: center;">
          <tr>
            <td style="width: 50%; border: none;"></td>
            <td style="width: 50%; border: none; text-align: center; font-style: italic; font-size: 10pt; padding-bottom: 4pt;">
              ${diaDiemKy}, ngày ${ngay} tháng ${thang} năm ${nam}
            </td>
          </tr>
          <tr>
            <td style="width: 50%; border: none; text-align: center; font-weight: bold; font-size: 10.5pt; padding: 1pt 0;">TRƯỞNG BỘ PHẬN</td>
            <td style="width: 50%; border: none; text-align: center; font-weight: bold; font-size: 10.5pt; padding: 1pt 0;">NGƯỜI ĐỀ NGHỊ THANH TOÁN</td>
          </tr>
          <tr>
            <td style="width: 50%; border: none; text-align: center; font-style: italic; font-size: 9.5pt; color: #555;">(Ký và ghi rõ họ tên)</td>
            <td style="width: 50%; border: none; text-align: center; font-style: italic; font-size: 9.5pt; color: #555;">(Ký và ghi rõ họ tên)</td>
          </tr>
          <tr>
            <td style="height: ${signSpaceHeight}; border: none;"></td>
            <td style="height: ${signSpaceHeight}; border: none;"></td>
          </tr>
          <tr>
            <td style="border: none; text-align: center; font-size: 10.5pt; font-weight: bold;">${dntt.ky_ho_ten_3 || ''}</td>
            <td style="border: none; text-align: center; font-size: 10.5pt; font-weight: bold;">${dntt.ky_ho_ten_4 || nguoiDeNghi || ''}</td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

/**
 * Tạo nội dung HTML hoàn chỉnh cho Giấy Đề nghị Thanh toán (Trang 1) kèm Bảng kê Trang 2 (nếu có)
 */
export function generateDnttHtml(data: ExportDnttData): string {
  const { dntt, details, phapNhan, donVi } = data;

  const tenCongTy = phapNhan?.ten_cong_ty || 'CÔNG TY TNHH THACO AUTO ĐỒNG THÁP';
  const diaChiCongTy = phapNhan?.dia_chi || 'Km 1964, QL 1A, ấp Long Bình, xã Châu Thành, tỉnh Đồng Tháp';
  const mstCongTy = phapNhan?.ma_so_thue || '1201657894';
  const tenDonVi = dntt.don_vi_hien_thi || donVi?.ten_don_vi || 'Showroom Mỹ Tho - THACO AUTO Đồng Tháp';
  const boPhan = dntt.bo_phan_hien_thi || 'QTPV, AS & MTLV';
  const nguoiDeNghi = dntt.nguoi_de_nghi || '';
  const noiDung = dntt.noi_dung_thanh_toan || '';
  const tongTien = Number(dntt.tong_so_tien) || 0;
  const soTienChu = dntt.so_tien_bang_chu || numberToWordsVN(tongTien);

  // Ngày ký & Địa điểm
  const today = new Date();
  const ngay = dntt.ngay_ky_ngay || (dntt.ngay_ky ? new Date(dntt.ngay_ky).getDate().toString().padStart(2, '0') : (dntt.ngay_lap ? new Date(dntt.ngay_lap).getDate().toString().padStart(2, '0') : today.getDate().toString().padStart(2, '0')));
  const thang = dntt.ngay_ky_thang || (dntt.ngay_ky ? (new Date(dntt.ngay_ky).getMonth() + 1).toString().padStart(2, '0') : (dntt.ngay_lap ? (new Date(dntt.ngay_lap).getMonth() + 1).toString().padStart(2, '0') : (today.getMonth() + 1).toString().padStart(2, '0')));
  const nam = dntt.ngay_ky_nam || (dntt.ngay_ky ? new Date(dntt.ngay_ky).getFullYear().toString() : (dntt.ngay_lap ? new Date(dntt.ngay_lap).getFullYear().toString() : today.getFullYear().toString()));

  // Địa điểm ký (người dùng điền vào, nếu không điền thì để '......')
  const diaDiemKy = (dntt.dia_diem_ky && dntt.dia_diem_ky.trim()) ? dntt.dia_diem_ky.trim() : '......';

  // 1. Tạo các hàng bảng chi tiết (chỉ hiển thị dòng cha, giữ nguyên vẹn 3 cột chuẩn)
  let tableRowsHtml = '';
  details.forEach((item, index) => {
    tableRowsHtml += `
      <tr style="height: 0.55cm;">
        <td style="border: 1.0pt solid black; height: 0.55cm; padding: 2pt 4pt; text-align: center; font-weight: bold; font-size: 11pt; width: 1.2cm; vertical-align: middle;">
          ${item.stt || (index + 1)}
        </td>
        <td style="border: 1.0pt solid black; height: 0.55cm; padding: 2pt 6pt; font-weight: bold; font-size: 11pt; vertical-align: middle;">
          ${item.noi_dung}
        </td>
        <td style="border: 1.0pt solid black; height: 0.55cm; padding: 2pt 6pt; text-align: right; font-weight: bold; font-size: 11pt; width: 3.8cm; white-space: nowrap; vertical-align: middle;">
          ${formatMoney(Number(item.so_tien) || 0)}
        </td>
      </tr>
    `;
  });

  // 2. Dòng Thông tin hóa đơn (chỉ hiển thị nếu dntt.hien_thi_hoa_don !== false)
  let invoiceRowHtml = '';
  if (dntt.hien_thi_hoa_don !== false) {
    const hasSoHoaDon = Boolean(dntt.so_hoa_don && dntt.so_hoa_don.trim());
    const hasNgayHoaDon = Boolean(dntt.ngay_hoa_don && dntt.ngay_hoa_don.trim());
    const formattedNgayHd = hasNgayHoaDon ? formatDateVN(dntt.ngay_hoa_don) : '.../.../......';
    const formattedSoHd = hasSoHoaDon ? dntt.so_hoa_don : '..................';

    invoiceRowHtml = `
      <tr style="height: 0.65cm;">
        <td style="border: 1.0pt solid black; height: 0.65cm; padding: 3pt 6pt; font-size: 10.5pt; vertical-align: middle;" colspan="2">
          <div style="margin: 0; line-height: 1.4;">
            <u><strong>Thông tin hoá đơn:</strong></u>&nbsp;&nbsp;
            <span>Số hoá đơn: <strong>${formattedSoHd}</strong></span>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <span>Ngày xuất hoá đơn: <strong>${formattedNgayHd}</strong></span>
          </div>
        </td>
        <td style="border: 1.0pt solid black; height: 0.65cm; width: 3.8cm; padding: 0;"></td>
      </tr>
    `;
  }

  // 3. Khối Thông tin chuyển khoản (nếu chọn chuyển khoản)
  let bankTransferHtml = '';
  if (dntt.hinh_thuc_thanh_toan === 'Chuyển khoản') {
    const showTransferMemo = dntt.hien_thi_nd_ck !== false && Boolean(dntt.noi_dung_chuyen_khoan && dntt.noi_dung_chuyen_khoan.trim());

    bankTransferHtml = `
      <tr style="height: ${showTransferMemo ? '2.8cm' : '2.4cm'};">
        <td style="border: 1.0pt solid black; height: ${showTransferMemo ? '2.8cm' : '2.4cm'}; padding: 4pt 6pt; font-size: 10.5pt; vertical-align: top;" colspan="2">
          <p style="margin: 1pt 0 3pt 0; line-height: normal;"><u><strong>Thông tin chuyển khoản:</strong></u></p>
          <p style="margin: 1pt 0; line-height: normal;">Tên tài khoản: ${dntt.ten_tai_khoan || '[...]'}</p>
          <p style="margin: 1pt 0; line-height: normal;">Số tài khoản: ${dntt.so_tai_khoan || '[...]'}</p>
          <p style="margin: 1pt 0; line-height: normal;">Tại: ${dntt.ten_ngan_hang || '[...]'} - Chi nhánh: ${dntt.chi_nhanh_ngan_hang || '[...]'}</p>
          ${showTransferMemo ? `<p style="margin: 2pt 0 0 0; line-height: normal;">Nội dung: ${dntt.noi_dung_chuyen_khoan}</p>` : ''}
        </td>
        <td style="border: 1.0pt solid black; height: ${showTransferMemo ? '2.8cm' : '2.4cm'}; width: 3.8cm; padding: 0;"></td>
      </tr>
    `;
  }

  // 4. Dòng Ghi chú dưới ô chuyển khoản (nếu có và bật hiển thị)
  let noteRowHtml = '';
  if (dntt.hien_thi_ghi_chu !== false && dntt.ghi_chu && dntt.ghi_chu.trim()) {
    noteRowHtml = `
      <tr style="height: 0.65cm;">
        <td style="border: 1.0pt solid black; height: 0.65cm; padding: 3pt 6pt; font-size: 10.5pt; vertical-align: middle;" colspan="2">
          <p style="margin: 0; line-height: normal;"><u><strong>Ghi chú:</strong></u> ${dntt.ghi_chu}</p>
        </td>
        <td style="border: 1.0pt solid black; height: 0.65cm; width: 3.8cm; padding: 0;"></td>
      </tr>
    `;
  }

  const page1Html = `
    <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.35; color: #000; width: 100%; box-sizing: border-box; padding: 0; background: #ffffff;">
      <!-- 1. KHỐI HEADER: LOGO THACO AUTO + THÔNG TIN PHÁP NHÂN -->
      <div style="margin-bottom: 8pt;">
        <img src="${THACO_AUTO_LOGO_BASE64}" alt="THACO AUTO" style="width: 220px; height: auto; max-height: 45px; display: block; margin-bottom: 6px;" />
        <div style="font-size: 10.5pt; font-weight: bold; text-transform: uppercase; line-height: 1.3;">${tenCongTy}</div>
        <div style="font-size: 9.5pt; color: #333; line-height: 1.3;">${diaChiCongTy}</div>
        <div style="font-size: 9.5pt; color: #333; line-height: 1.3;">MST: ${mstCongTy}</div>
      </div>

      <!-- 2. TIÊU ĐỀ VĂN BẢN -->
      <div style="text-align: center; margin: 12pt 0 12pt 0;">
        <div style="font-size: 15pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">GIẤY ĐỀ NGHỊ THANH TOÁN</div>
      </div>

      <!-- 3. KHỐI THÔNG TIN ĐỀ NGHỊ -->
      <div style="margin-bottom: 8pt; font-size: 10.5pt; line-height: 1.45;">
        <div style="display: flex; margin-bottom: 2pt;">
          <span style="font-weight: bold; width: 4.0cm; flex-shrink: 0;">Người đề nghị:</span>
          <span style="font-weight: bold;">${nguoiDeNghi}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2pt;">
          <div style="display: flex; flex: 1;">
            <span style="font-weight: bold; width: 4.0cm; flex-shrink: 0;">Đơn vị:</span>
            <span style="font-weight: bold;">${tenDonVi}</span>
          </div>
          <div style="display: flex; margin-left: 1cm; flex-shrink: 0;">
            <span style="font-weight: bold; margin-right: 6pt;">Bộ phận:</span>
            <span>${boPhan}</span>
          </div>
        </div>
        <div style="display: flex; margin-bottom: 2pt;">
          <span style="font-weight: bold; width: 4.0cm; flex-shrink: 0;">Nội dung thanh toán:</span>
          <span>${noiDung}</span>
        </div>
        <div style="margin-bottom: 2pt;">
          <span>Kính đề nghị Ban lãnh đạo duyệt thanh toán số tiền:</span>&nbsp;
          <span style="font-weight: bold; font-family: 'Times New Roman', serif;">${formatMoney(tongTien)} VNĐ</span>
        </div>
        <div style="margin-bottom: 2pt; font-style: italic;">
          Bằng chữ: ${soTienChu}
        </div>
        <div>
          <span style="width: 4.0cm; display: inline-block;">Hình thức thanh toán:</span>
          <span>${dntt.hinh_thuc_thanh_toan}</span>
        </div>
      </div>

      <!-- 4. BẢNG CHI TIẾT NỘI DUNG THANH TOÁN (3 CỘT CHUẨN) -->
      <table style="width: 100%; border-collapse: collapse; border: 1.0pt solid black; font-size: 10.5pt; margin-bottom: 4pt;">
        <thead>
          <tr style="height: 0.55cm; background: #fafafa;">
            <th style="border: 1.0pt solid black; padding: 2pt 4pt; font-weight: bold; width: 1.2cm; text-align: center;">STT</th>
            <th style="border: 1.0pt solid black; padding: 2pt 6pt; font-weight: bold; text-align: center;">Nội dung thanh toán</th>
            <th style="border: 1.0pt solid black; padding: 2pt 6pt; font-weight: bold; width: 3.8cm; text-align: center;">Số tiền</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${invoiceRowHtml}
          ${noteRowHtml}
          ${bankTransferHtml}
          <tr style="height: 0.55cm;">
            <td style="border: 1.0pt solid black; height: 0.55cm; padding: 2pt 6pt; font-weight: bold; text-align: center; vertical-align: middle;" colspan="2">
              Giá trị phải thanh toán
            </td>
            <td style="border: 1.0pt solid black; height: 0.55cm; padding: 2pt 6pt; font-weight: bold; text-align: right; width: 3.8cm; white-space: nowrap; vertical-align: middle;">
              ${formatMoney(tongTien)}
            </td>
          </tr>
        </tbody>
      </table>

      ${dntt.hien_thi_phan_bo !== false ? `
        <div style="font-size: 9.5pt; font-style: italic; color: #444; margin: 2pt 0 4pt 0;">
          (*) Chi tiết phân bổ khoản mục phí và bộ phận xem tại Bảng kê phân bổ chi phí đính kèm.
        </div>
      ` : ''}

      <!-- 5. NGÀY THÁNG VÀ 4 CHỮ KÝ HÀNH CHÍNH -->
      <div style="text-align: right; font-style: italic; font-size: 10.5pt; margin: 8pt 0 6pt 0;">
        ${diaDiemKy}, ngày ${ngay} tháng ${thang} năm ${nam}
      </div>

      <table style="width: 100%; border-collapse: collapse; border: none; text-align: center; margin-top: 2pt;">
        <tr>
          <td style="width: 25%; border: none; text-align: center; font-weight: bold; font-size: 10.5pt; padding: 1pt 0;">${dntt.ky_chuc_danh_1 || 'Phê duyệt'}</td>
          <td style="width: 25%; border: none; text-align: center; font-weight: bold; font-size: 10.5pt; padding: 1pt 0;">${dntt.ky_chuc_danh_2 || 'Kế toán - Tài chính'}</td>
          <td style="width: 25%; border: none; text-align: center; font-weight: bold; font-size: 10.5pt; padding: 1pt 0;">${dntt.ky_chuc_danh_3 || 'Trưởng bộ phận'}</td>
          <td style="width: 25%; border: none; text-align: center; font-weight: bold; font-size: 10.5pt; padding: 1pt 0;">${dntt.ky_chuc_danh_4 || 'Người đề nghị'}</td>
        </tr>
        <tr>
          <td style="height: 55pt; border: none;"></td>
          <td style="height: 55pt; border: none;"></td>
          <td style="height: 55pt; border: none;"></td>
          <td style="height: 55pt; border: none;"></td>
        </tr>
        <tr>
          <td style="border: none; text-align: center; font-size: 10pt; font-weight: bold;">${dntt.ky_ho_ten_1 || ''}</td>
          <td style="border: none; text-align: center; font-size: 10pt; font-weight: bold;">${dntt.ky_ho_ten_2 || ''}</td>
          <td style="border: none; text-align: center; font-size: 10pt; font-weight: bold;">${dntt.ky_ho_ten_3 || ''}</td>
          <td style="border: none; text-align: center; font-weight: bold; font-size: 10pt;">${dntt.ky_ho_ten_4 || nguoiDeNghi || ''}</td>
        </tr>
      </table>
    </div>
  `;

  // Nếu bật phân bổ chi phí, nối tiếp Trang 2 (Bảng kê phân bổ chi phí đính kèm)
  let page2Html = '';
  if (dntt.hien_thi_phan_bo !== false) {
    page2Html = generateBangKePhanBoHtml(data);
  }

  return page1Html + page2Html;
}

/**
 * Xuất Giấy Đề nghị Thanh toán ra file PDF chuẩn A4 và tải trực tiếp về máy tính
 */
export async function exportDnttToPdf(data: ExportDnttData, fileName?: string): Promise<boolean> {
  const actualFileName = fileName || `Giay_DNTT_${data.dntt.so_dntt ? String(data.dntt.so_dntt).replace(/[\/\\?%*:|"<>]/g, '_') : Date.now()}.pdf`;

  try {
    const html2pdf = await loadHtml2Pdf();

    // 1. Chờ font chữ trình duyệt sẵn sàng
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 2. Pre-load logo THACO AUTO vào bộ nhớ cache trước khi render canvas
    if (THACO_AUTO_LOGO_BASE64) {
      const preloadImg = new Image();
      preloadImg.src = THACO_AUTO_LOGO_BASE64;
      if (!preloadImg.complete) {
        await new Promise((resolve) => {
          preloadImg.onload = resolve;
          preloadImg.onerror = resolve;
        });
      }
    }

    // 3. Tạo element nguồn (không áp position: fixed / negative z-index để html2canvas chụp 100% nội dung)
    const element = document.createElement('div');
    element.innerHTML = generateDnttHtml(data);

    const opt = {
      margin: [10, 10, 10, 10], // mm: [top, left, bottom, right]
      filename: actualFileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // 4. Kích hoạt html2pdf tự động quản lý overlay và xuất tải trực tiếp file PDF
    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (err) {
    console.warn('html2pdf không thể khởi chạy, chuyển sang chế độ in/lưu PDF dự phòng:', err);
    fallbackPrintPdf(generateDnttHtml(data), actualFileName);
    return true;
  }
}

/**
 * Tương thích ngược: Xuất file Word (.doc) nếu người dùng cần
 */
export function exportDnttToWord(data: ExportDnttData, fileName?: string) {
  const documentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Giấy Đề nghị Thanh toán</title>
      <style>
        @page WordSection1 {
          size: 595.3pt 841.9pt; /* A4 */
          margin: 42.5pt 42.5pt 42.5pt 56.7pt; /* Top 1.5cm, Right 1.5cm, Bottom 1.5cm, Left 2.0cm */
          mso-header-margin: 35.4pt;
          mso-footer-margin: 35.4pt;
          mso-paper-source: 0;
        }
        div.WordSection1 { page: WordSection1; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.25; color: #000; }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>
      <div class="WordSection1">
        ${generateDnttHtml(data)}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', documentHtml], {
    type: 'application/msword'
  });

  const actualFileName = fileName || `Giay_DNTT_${data.dntt.so_dntt || Date.now()}.doc`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = actualFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * In trực tiếp Bảng kê phân bổ chi phí qua hộp thoại in của trình duyệt
 */
export function printBangKePhanBo(data: ExportDnttData) {
  const fileName = `Bang_ke_phan_bo_${data.dntt.so_dntt ? String(data.dntt.so_dntt).replace(/[\/\\?%*:|"<>]/g, '_') : Date.now()}`;
  fallbackPrintPdf(generateBangKePhanBoHtml(data), fileName);
}

