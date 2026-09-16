import { DNTT, DnttChiTiet, DnttPhanBo, DmBoPhan, BoPhanCap1, BoPhanCap2, PhapNhan, DonVi } from '../../types';
import { numberToWordsVN } from '../../utils/numberToWordsVN';
import { THACO_AUTO_LOGO_BASE64 } from '../../assets/thacoAutoLogo';

interface ExportDnttData {
  dntt: DNTT;
  details: DnttChiTiet[];
  allocations: Record<string, DnttPhanBo[]>; // dntt_chi_tiet_id -> DnttPhanBo[]
  phapNhan?: PhapNhan;
  donVi?: DonVi;
  boPhanList?: DmBoPhan[];
  cap1List?: BoPhanCap1[];
  cap2List?: BoPhanCap2[];
}

const formatMoney = (val: number): string => {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return Math.round(val).toLocaleString('vi-VN');
};

/**
 * Xuất Giấy Đề nghị Thanh toán ra file Word (.doc / .docx)
 * Phần trên (thông tin người đề nghị) KHÔNG kẻ khung, chỉ kẻ khung bản thanh toán theo đúng hình mẫu
 */
export function exportDnttToWord(data: ExportDnttData, fileName?: string) {
  const { dntt, details, allocations, phapNhan, donVi, cap1List, cap2List } = data;

  const tenCongTy = phapNhan?.ten_cong_ty || 'CÔNG TY TNHH THACO AUTO ĐỒNG THÁP';
  const diaChiCongTy = phapNhan?.dia_chi || 'Km 1964, QL 1A, ấp Long Bình, xã Châu Thành, tỉnh Đồng Tháp';
  const mstCongTy = phapNhan?.ma_so_thue || '1201657894';
  const tenDonVi = donVi?.ten_don_vi || 'Showroom Mỹ Tho - THACO AUTO Đồng Tháp';
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

  // Địa phương ký (người dùng điền vào, nếu không điền thì để '......')
  const diaDiemKy = (dntt.dia_diem_ky && dntt.dia_diem_ky.trim()) ? dntt.dia_diem_ky.trim() : '......';

  // Map tên Cấp 1 & Cấp 2 hoặc Danh mục Bộ phận (Khối/Nghiệp vụ - Thương hiệu/Phòng/Bộ phận)
  const boPhanMap = new Map((data.boPhanList || []).map(b => [b.id, b]));
  const cap1Map = new Map((cap1List || []).map(c => [c.id, c.ten]));
  const cap2Map = new Map((cap2List || []).map(c => [c.id, c.ten]));

  // Tạo các hàng bảng chi tiết + dòng phân bổ con (tất cả các dòng đều có viền ô lưới kẻ khung)
  let tableRowsHtml = '';

  details.forEach((item, index) => {
    const itemAllocations = (allocations[item.id] || []).sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));

    // 1. DÒNG NỘI DUNG CHA (Có STT, In đậm, có viền 1.0pt, cao 0.5cm, paragraph trước 3pt sau 3pt)
    tableRowsHtml += `
      <tr style="height:0.5cm; mso-height-rule:exactly; mso-yfti-irow:${index * 30};">
        <td style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; text-align:center; font-weight:bold; font-size:11pt; width:1.2cm; vertical-align:middle;">
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:center; font-weight:bold;">${item.stt || (index + 1)}</p>
        </td>
        <td style="border:1.0pt solid black; height:0.5cm; padding:0 6pt; font-weight:bold; font-size:11pt; width:12.0cm; vertical-align:middle;">
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; font-weight:bold;">${item.noi_dung}</p>
        </td>
        <td style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; text-align:right; font-weight:bold; font-size:11pt; width:3.8cm; white-space:nowrap; vertical-align:middle;">
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:right; font-weight:bold;">${formatMoney(Number(item.so_tien) || 0)}</p>
        </td>
      </tr>
    `;

    // 2. CÁC DÒNG PHÂN BỔ CON (Không STT, căn lề phải, in nghiêng, cao 0.5cm, chỉ in khi hien_thi_phan_bo !== false)
    if (dntt.hien_thi_phan_bo !== false) {
      itemAllocations.forEach((alloc, aIdx) => {
        let tenBoPhanHienThi = '';
        if (alloc.id_bo_phan && boPhanMap.has(alloc.id_bo_phan)) {
          const bp = boPhanMap.get(alloc.id_bo_phan)!;
          tenBoPhanHienThi = bp.ten_cap2 ? `${bp.ten_cap1} - ${bp.ten_cap2}` : bp.ten_cap1;
        } else {
          const cap1Ten = cap1Map.get(alloc.id_bo_phan_cap1 || '') || 'Bộ phận';
          const cap2Ten = alloc.id_bo_phan_cap2 ? (cap2Map.get(alloc.id_bo_phan_cap2) || alloc.id_bo_phan_cap2) : '';
          tenBoPhanHienThi = cap2Ten ? `${cap1Ten} ${cap2Ten}` : cap1Ten;
        }

        tableRowsHtml += `
          <tr style="height:0.5cm; mso-height-rule:exactly; mso-yfti-irow:${index * 30 + aIdx + 1};">
            <td style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; text-align:center; font-size:10.5pt; width:1.2cm; vertical-align:middle;">
              <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal;">&nbsp;</p>
            </td>
            <td style="border:1.0pt solid black; height:0.5cm; padding:0 6pt; text-align:right; font-style:italic; font-size:10.5pt; color:#000; width:12.0cm; vertical-align:middle;">
              <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:right; font-style:italic;">${tenBoPhanHienThi}</p>
            </td>
            <td style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; text-align:right; font-size:10.5pt; width:3.8cm; white-space:nowrap; vertical-align:middle;">
              <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:right;">${formatMoney(Number(alloc.so_tien) || 0)}</p>
            </td>
          </tr>
        `;
      });
    }
  });

  // Thông tin chuyển khoản (nếu chọn chuyển khoản) - độ cao 2.5cm
  let bankTransferHtml = '';
  if (dntt.hinh_thuc_thanh_toan === 'Chuyển khoản') {
    bankTransferHtml = `
      <tr style="height:2.5cm; mso-height-rule:exactly;">
        <td style="border:1.0pt solid black; height:2.5cm; padding:4pt 6pt; font-size:10.5pt; vertical-align:top;" colspan="2">
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal;"><u><strong>Thông tin chuyển khoản:</strong></u></p>
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal;">Tên tài khoản: ${dntt.ten_tai_khoan || '[...]'}</p>
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal;">Số tài khoản: ${dntt.so_tai_khoan || '[...]'}</p>
          <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal;">Tại: ${dntt.ten_ngan_hang || '[...]'} - Chi nhánh: ${dntt.chi_nhanh_ngan_hang || '[...]'}</p>
        </td>
        <td style="border:1.0pt solid black; height:2.5cm; width:3.8cm; padding:0;"></td>
      </tr>
    `;
  }

  // Toàn bộ HTML tài liệu Word chuẩn Word ML
  const documentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Giấy Đề Nghị Thanh Toán</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 21.0cm 29.7cm; /* A4 */
          margin-top: 1.5cm;
          margin-bottom: 1.5cm;
          margin-left: 2.5cm;
          margin-right: 1.5cm;
          mso-page-orientation: portrait;
          mso-header-margin: 36.0pt;
          mso-footer-margin: 36.0pt;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.3;
          color: #000;
        }
        p, .MsoNormal {
          margin-top: 3.0pt;
          margin-bottom: 3.0pt;
          margin-left: 0;
          margin-right: 0;
          line-height: normal;
          font-family: 'Times New Roman', Times, serif;
        }
        table {
          border-collapse: collapse;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
          font-family: 'Times New Roman', Times, serif;
        }
        td, th {
          vertical-align: middle;
        }
        .title {
          text-align: center;
          font-size: 15pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 10pt;
          margin-bottom: 10pt;
        }
        .payment-table {
          width: 17.0cm;
          border-collapse: collapse;
          border: 1.0pt solid black;
        }
        .payment-table tr {
          height: 0.5cm;
          mso-height-rule: exactly;
        }
        .payment-table td, .payment-table th {
          height: 0.5cm;
          border: 1.0pt solid black;
          padding: 0 4pt;
          vertical-align: middle;
        }
        .payment-table p {
          margin-top: 2.0pt;
          margin-bottom: 2.0pt;
          margin-left: 0;
          margin-right: 0;
          line-height: normal;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <!-- 1. KHỐI HEADER: LOGO THACO AUTO (DÀI 6CM RỘNG 1CM) + THÔNG TIN PHÁP NHÂN (KHÔNG KẺ KHUNG) -->
        <table style="width:17.0cm; border:none; margin-bottom:4pt;">
          <tr>
            <td style="border:none; padding:0; vertical-align:top;">
              <img src="${THACO_AUTO_LOGO_BASE64}" width="227" height="38" style="width:6.0cm; height:1.0cm; object-fit:contain; display:block; margin-bottom:3pt;" /><br/>
              <div style="font-weight:bold; font-size:11pt; text-transform:uppercase; margin-top:2pt;">${tenCongTy}</div>
              <div style="font-size:10pt; color:#000;">${diaChiCongTy}</div>
              <div style="font-size:10pt; color:#000;">MST: ${mstCongTy}</div>
            </td>
          </tr>
        </table>

        <!-- 2. TIÊU ĐỀ VĂN BẢN -->
        <div class="title">GIẤY ĐỀ NGHỊ THANH TOÁN</div>

        <!-- 3. KHỐI THÔNG TIN ĐỀ NGHỊ THANH TOÁN (KHÔNG KẺ KHUNG - THEO ĐÚNG HÌNH CHỤP THẬT) -->
        <div style="width:17.0cm; margin-bottom:6pt;">
          <!-- Dòng 1: Người đề nghị -->
          <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt;">
            <strong>Người đề nghị:</strong>&nbsp;&nbsp;&nbsp;&nbsp;${nguoiDeNghi}
          </p>

          <!-- Dòng 2: Đơn vị và Bộ phận (cùng dòng) -->
          <table style="width:17.0cm; border:none; border-collapse:collapse; margin:0; padding:0;">
            <tr>
              <td style="border:none; padding:0; vertical-align:baseline;">
                <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt;">
                  <strong>Đơn vị:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${tenDonVi}
                </p>
              </td>
              <td style="border:none; padding:0; width:6.5cm; vertical-align:baseline;">
                <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt;">
                  <strong>Bộ phận:</strong>&nbsp;&nbsp;${boPhan}
                </p>
              </td>
            </tr>
          </table>

          <!-- Dòng 3: Nội dung thanh toán -->
          <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt;">
            <strong>Nội dung thanh toán:</strong>&nbsp;&nbsp;&nbsp;${noiDung}
          </p>

          <!-- Dòng 4: Kính đề nghị Ban lãnh đạo duyệt thanh toán số tiền: rồi đến số tiền cách nhau 1 khoảng trắng -->
          <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt;">
            Kính đề nghị Ban lãnh đạo duyệt thanh toán số tiền: <strong>${formatMoney(tongTien)} VNĐ</strong>
          </p>

          <!-- Dòng 5: Bằng chữ (toàn bộ in nghiêng) -->
          <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt; font-style:italic;">
            <em>Bằng chữ: ${soTienChu}</em>
          </p>

          <!-- Dòng 6: Hình thức thanh toán -->
          <p style="margin-top:3.0pt; margin-bottom:3.0pt; margin-left:0; margin-right:0; line-height:normal; font-size:11pt;">
            <strong>Hình thức thanh toán:</strong>&nbsp;&nbsp;${dntt.hinh_thuc_thanh_toan}
          </p>
        </div>

        <!-- 4. BẢNG CHI TIẾT NỘI DUNG THANH TOÁN (KẺ KHUNG TOÀN BỘ - RỘNG 17CM, CAO MỖI HÀNG 0.5CM, PARAGRAPH TRƯỚC 3PT SAU 3PT) -->
        <table class="payment-table" style="width:17.0cm; border-collapse:collapse; border:1.0pt solid black; margin-bottom:8pt;">
          <thead>
            <tr style="background-color:#fff; height:0.5cm; mso-height-rule:exactly;">
              <th style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; width:1.2cm; text-align:center; font-weight:bold; font-size:11pt; vertical-align:middle;">
                <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:center; font-weight:bold;">STT</p>
              </th>
              <th style="border:1.0pt solid black; height:0.5cm; padding:0 6pt; width:12.0cm; text-align:center; font-weight:bold; font-size:11pt; vertical-align:middle;">
                <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:center; font-weight:bold;">Nội dung thanh toán</p>
              </th>
              <th style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; width:3.8cm; text-align:center; font-weight:bold; font-size:11pt; vertical-align:middle;">
                <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:center; font-weight:bold;">Số tiền</p>
              </th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            ${bankTransferHtml}
            <tr style="height:0.5cm; mso-height-rule:exactly;">
              <td style="border:1.0pt solid black; height:0.5cm; padding:0 6pt; font-weight:bold; font-size:11pt; text-align:center; vertical-align:middle;" colspan="2">
                <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:center; font-weight:bold;">Giá trị phải thanh toán</p>
              </td>
              <td style="border:1.0pt solid black; height:0.5cm; padding:0 4pt; font-weight:bold; font-size:11pt; text-align:right; width:3.8cm; white-space:nowrap; vertical-align:middle;">
                <p style="margin-top:2.0pt; margin-bottom:2.0pt; margin-left:0; margin-right:0; line-height:normal; text-align:right; font-weight:bold;">${formatMoney(tongTien)}</p>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 5. NGÀY THÁNG VÀ 4 CHỮ KÝ HÀNH CHÍNH (KHÔNG KẺ KHUNG - THEO ĐÚNG HÌNH MẪU) -->
        <div style="width:17.0cm; text-align:right; font-style:italic; font-size:10.5pt; margin-top:8pt; margin-bottom:4pt;">
          <em>${diaDiemKy}, ngày ${ngay} tháng ${thang} năm ${nam}</em>
        </div>

        <table style="width:17.0cm; border-collapse:collapse; border:none; text-align:center; margin-top:4pt;">
          <tr>
            <td style="width:25%; border:none; text-align:center; font-weight:bold; font-size:11pt; padding:2pt 0;">${dntt.ky_chuc_danh_1 || 'Phê duyệt'}</td>
            <td style="width:25%; border:none; text-align:center; font-weight:bold; font-size:11pt; padding:2pt 0;">${dntt.ky_chuc_danh_2 || 'Kế toán - Tài chính'}</td>
            <td style="width:25%; border:none; text-align:center; font-weight:bold; font-size:11pt; padding:2pt 0;">${dntt.ky_chuc_danh_3 || 'Trưởng bộ phận'}</td>
            <td style="width:25%; border:none; text-align:center; font-weight:bold; font-size:11pt; padding:2pt 0;">${dntt.ky_chuc_danh_4 || 'Người đề nghị'}</td>
          </tr>
          <tr>
            <td style="height:65pt; border:none;"></td>
            <td style="height:65pt; border:none;"></td>
            <td style="height:65pt; border:none;"></td>
            <td style="height:65pt; border:none;"></td>
          </tr>
          <tr>
            <td style="border:none; text-align:center; font-size:10.5pt; font-weight:bold;">${dntt.ky_ho_ten_1 || '[Gõ họ và tên]'}</td>
            <td style="border:none; text-align:center; font-size:10.5pt; font-weight:bold;">${dntt.ky_ho_ten_2 || '[Gõ họ và tên]'}</td>
            <td style="border:none; text-align:center; font-size:10.5pt; font-weight:bold;">${dntt.ky_ho_ten_3 || '[Gõ họ và tên]'}</td>
            <td style="border:none; text-align:center; font-weight:bold; font-size:11pt;">${dntt.ky_ho_ten_4 || nguoiDeNghi || '[Gõ họ và tên]'}</td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  // Tạo Blob và tải file Word
  const blob = new Blob(['\ufeff', documentHtml], {
    type: 'application/msword'
  });

  const actualFileName = fileName || `Giay_DNTT_${dntt.so_dntt || Date.now()}.doc`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = actualFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
