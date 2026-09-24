import * as XLSX from 'xlsx';
import { 
  ChiPhiThongKe, ChiPhiChotKy, DNTT, DnttPhanBo, DmKmp, 
  DonVi, DmNhomChiPhi, DmBoPhan 
} from '../types';
import { buildThacoCostMatrix, MatrixRowItem } from './thacoCostDataEngine';
import { isCostManagementUnit } from './hierarchy';
import { toast } from './toast';

export interface ThacoExportParams {
  year: number;
  companyName: string;
  thongKeList: ChiPhiThongKe[];
  chotKyList: ChiPhiChotKy[];
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  nhomChiPhiList?: DmNhomChiPhi[];
  donViList: DonVi[];
  boPhanList?: DmBoPhan[];
  selectedUnitFilter?: string | null;
  includeTemporary?: boolean;
  onlyAdministrative?: boolean;
}

/**
 * Xuất Báo cáo Quản trị CPHC đa sheet (.xlsx) chuẩn THACO AUTO
 */
export async function exportThacoMultiSheetExcel(params: ThacoExportParams) {
  try {
    toast.info('Đang khởi tạo Workbook Excel đa sheet chuẩn THACO AUTO...');

    const {
      year,
      companyName,
      thongKeList,
      chotKyList,
      dnttList,
      phanBoList,
      kmpList,
      nhomChiPhiList = [],
      donViList,
      boPhanList = [],
      selectedUnitFilter,
      includeTemporary = false,
      onlyAdministrative = true
    } = params;

    const wb = XLSX.utils.book_new();

    // 1. TÍNH TOÁN MA TRẬN TOÀN CÔNG TY
    const companyMatrix = buildThacoCostMatrix({
      year,
      thongKeList,
      chotKyList,
      dnttList,
      phanBoList,
      kmpList,
      nhomChiPhiList,
      donViList,
      boPhanList,
      selectedUnitFilter: selectedUnitFilter || null,
      includeTemporary,
      onlyAdministrative
    });

    const formatPercent = (val: number | null | undefined): string => {
      if (val === null || val === undefined || isNaN(val)) return '—';
      return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
    };

    // Helper tạo mảng 2 chiều cho 1 bảng ma trận
    const buildSheetData = (
      title: string,
      unitSubTitle: string,
      rows: MatrixRowItem[],
      summary: any,
      showChildRows: boolean
    ): any[][] => {
      const aoa: any[][] = [];

      // Dòng 1: Tiêu đề báo cáo
      aoa.push([title]);
      // Dòng 2: Tên đơn vị
      aoa.push([unitSubTitle]);
      // Dòng 3: Ghi chú
      aoa.push([
        `Năm: ${year} | Đơn vị tính: VNĐ | ${includeTemporary ? 'Bao gồm số liệu tạm tính' : 'Chỉ số liệu đã chốt kỳ'}`
      ]);
      aoa.push([]); // Dòng trống

      // Dòng 5: Header bảng
      const headerRow = [
        'STT',
        'Khoản mục chi phí',
        'Mã B7',
        showChildRows ? 'Tỷ lệ %' : '',
        'Tháng 1',
        'Tháng 2',
        'Tháng 3',
        'Quý I',
        'Tháng 4',
        'Tháng 5',
        'Tháng 6',
        'Quý II',
        'Tháng 7',
        'Tháng 8',
        'Tháng 9',
        'Quý III',
        'Tháng 10',
        'Tháng 11',
        'Tháng 12',
        'Quý IV',
        `Cả năm ${year}`,
        `Cùng kỳ ${year - 1}`,
        'Chênh lệch (+/-)',
        '% Tăng/Giảm'
      ].filter((_, idx) => showChildRows || idx !== 3);

      aoa.push(headerRow);

      // Thân bảng
      rows.forEach(grp => {
        // Hàng Nhóm La Mã
        const grpRow = [
          grp.stt,
          grp.name,
          '',
          showChildRows ? '' : undefined,
          grp.months[1].amount,
          grp.months[2].amount,
          grp.months[3].amount,
          grp.q1,
          grp.months[4].amount,
          grp.months[5].amount,
          grp.months[6].amount,
          grp.q2,
          grp.months[7].amount,
          grp.months[8].amount,
          grp.months[9].amount,
          grp.q3,
          grp.months[10].amount,
          grp.months[11].amount,
          grp.months[12].amount,
          grp.q4,
          grp.yearTotal,
          grp.priorYearTotal,
          grp.variance,
          formatPercent(grp.percentChange)
        ].filter(v => v !== undefined);

        aoa.push(grpRow);

        // Hàng KMP
        (grp.children || []).forEach(kmp => {
          const kmpRow = [
            kmp.stt,
            kmp.name,
            kmp.code || '',
            showChildRows ? '100%' : undefined,
            kmp.months[1].amount,
            kmp.months[2].amount,
            kmp.months[3].amount,
            kmp.q1,
            kmp.months[4].amount,
            kmp.months[5].amount,
            kmp.months[6].amount,
            kmp.q2,
            kmp.months[7].amount,
            kmp.months[8].amount,
            kmp.months[9].amount,
            kmp.q3,
            kmp.months[10].amount,
            kmp.months[11].amount,
            kmp.months[12].amount,
            kmp.q4,
            kmp.yearTotal,
            kmp.priorYearTotal,
            kmp.variance,
            formatPercent(kmp.percentChange)
          ].filter(v => v !== undefined);

          aoa.push(kmpRow);

          // Hàng con phân bổ nếu showChildRows = true
          if (showChildRows && kmp.children && kmp.children.length > 0) {
            kmp.children.forEach(child => {
              const childRow = [
                child.stt,
                `    ↳ ${child.name}`,
                '',
                child.allocationPercent !== null && child.allocationPercent !== undefined
                  ? `${child.allocationPercent.toFixed(1)}%`
                  : '—',
                child.months[1].amount,
                child.months[2].amount,
                child.months[3].amount,
                child.q1,
                child.months[4].amount,
                child.months[5].amount,
                child.months[6].amount,
                child.q2,
                child.months[7].amount,
                child.months[8].amount,
                child.months[9].amount,
                child.q3,
                child.months[10].amount,
                child.months[11].amount,
                child.months[12].amount,
                child.q4,
                child.yearTotal,
                child.priorYearTotal,
                child.variance,
                formatPercent(child.percentChange)
              ];
              aoa.push(childRow);
            });
          }
        });
      });

      // Hàng Tổng Cộng
      const totalRow = [
        'TỔNG',
        'TỔNG CỘNG CHI PHÍ',
        '',
        showChildRows ? '' : undefined,
        summary.months[1].amount,
        summary.months[2].amount,
        summary.months[3].amount,
        summary.q1,
        summary.months[4].amount,
        summary.months[5].amount,
        summary.months[6].amount,
        summary.q2,
        summary.months[7].amount,
        summary.months[8].amount,
        summary.months[9].amount,
        summary.q3,
        summary.months[10].amount,
        summary.months[11].amount,
        summary.months[12].amount,
        summary.q4,
        summary.yearTotal,
        summary.priorYearTotal,
        summary.variance,
        formatPercent(summary.percentChange)
      ].filter(v => v !== undefined);

      aoa.push(totalRow);

      return aoa;
    };

    // SHEET 1: Tong [Nam] (Tổng hợp toàn công ty theo Nhóm & KMP)
    const sheet1Data = buildSheetData(
      `BÁO CÁO QUẢN TRỊ CHI PHÍ HÀNH CHÍNH NĂM ${year}`,
      `Đơn vị: ${companyName}`,
      companyMatrix.rows,
      companyMatrix.summary,
      false
    );
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, `Tong ${year}`);

    // SHEET 2: Tong [Nam] KMP (Chi tiết KMP bung mở theo Showroom/Thương hiệu)
    const sheet2Data = buildSheetData(
      `BÁO CÁO CHI TIẾT PHÂN BỔ KHOẢN MỤC CHI PHÍ NĂM ${year}`,
      `Đơn vị: ${companyName}`,
      companyMatrix.rows,
      companyMatrix.summary,
      true
    );
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, `Tong ${year} KMP`);

    // SHEET 3..N: Từng Sheet cho từng Đơn vị / Showroom Quản trị trực thuộc
    const showrooms = donViList.filter(d => {
      if (!isCostManagementUnit(d)) return false;
      const lh = (d.loai_hinh || '').toLowerCase();
      // Văn phòng Điều hành (VPĐH/HO) đã là đại diện của sheet Tổng hợp, không tạo sheet trùng lặp (không loại trừ VP Công ty)
      const isVpdh = (lh === 'văn phòng' || lh === 'vpđh' || lh.includes('tổng công ty')) && !lh.includes('công ty');
      if (isVpdh) {
        if (selectedUnitFilter && String(selectedUnitFilter) === String(d.id)) return true;
        return false;
      }
      if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
        const subIds = new Set([String(selectedUnitFilter), ...buildSubIds(selectedUnitFilter, donViList)]);
        return subIds.has(String(d.id));
      }
      return true;
    });

    for (const sr of showrooms) {
      const srMatrix = buildThacoCostMatrix({
        year,
        thongKeList,
        chotKyList,
        dnttList,
        phanBoList,
        kmpList,
        nhomChiPhiList,
        donViList,
        boPhanList,
        selectedUnitFilter: String(sr.id),
        includeTemporary,
        onlyAdministrative
      });

      // Tên sheet Excel tối đa 31 ký tự, không chứa ký tự đặc biệt
      let cleanSheetName = `QTCP ${sr.ten_don_vi.replace(/Showroom|SR|THACO AUTO/gi, '').trim()}`;
      cleanSheetName = cleanSheetName.replace(/[:\\/?*\[\]]/g, '').substring(0, 30).trim();

      const srSheetData = buildSheetData(
        `BÁO CÁO QUẢN TRỊ CHI PHÍ HÀNH CHÍNH - NĂM ${year}`,
        `Đơn vị: ${sr.ten_don_vi}`,
        srMatrix.rows,
        srMatrix.summary,
        false
      );

      const wsSr = XLSX.utils.aoa_to_sheet(srSheetData);
      XLSX.utils.book_append_sheet(wb, wsSr, cleanSheetName);
    }

    // Xuất file .xlsx
    const fileName = `BC_Quan_Tri_Chi_Phi_THACO_${year}_${companyName.replace(/[\/\s]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Đã xuất file Excel đa sheet "${fileName}" thành công!`);
  } catch (err: any) {
    console.error('Lỗi khi xuất file Excel đa sheet THACO:', err);
    toast.error(err?.message || 'Có lỗi xảy ra khi tạo file Excel đa sheet!');
  }
}

function buildSubIds(parentId: string, donViList: DonVi[]): string[] {
  const res: string[] = [];
  const queue = [String(parentId)];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    donViList.forEach(d => {
      if (String(d.cap_quan_ly) === curr && !res.includes(String(d.id))) {
        res.push(String(d.id));
        queue.push(String(d.id));
      }
    });
  }
  return res;
}
