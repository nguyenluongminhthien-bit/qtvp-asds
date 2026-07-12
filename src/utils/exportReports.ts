// src/utils/exportReports.ts
import { ReportTemplate } from '../constants/reportTemplates';

// Helper XML escape
const escapeXML = (str: any) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Chuẩn hóa tên Sheet
const getSanitizeSheetName = () => {
  const usedNames = new Set<string>();
  return (name: string) => {
    let cleanName = name.replace(/[\\\/?*:[\]]/g, '').trim().substring(0, 31);
    if (!cleanName) cleanName = "Sheet";
    let finalName = cleanName;
    let counter = 1;
    while (usedNames.has(finalName.toLowerCase())) {
      const suffix = ` (${counter})`;
      finalName = cleanName.substring(0, 31 - suffix.length) + suffix;
      counter++;
    }
    usedNames.add(finalName.toLowerCase());
    return finalName;
  };
};

// Định dạng dữ liệu
export const formatCell = (val: any, format?: string): string => {
  if (val === null || val === undefined || val === '') return '';
  if (format === 'date') {
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return String(val);
    }
  }
  if (format === 'currency') {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return num.toLocaleString('vi-VN');
  }
  if (format === 'boolean') {
    return val === true || String(val).toLowerCase() === 'true' || val === 1 ? 'Có' : 'Không';
  }
  if (format === 'phone') {
    // Định dạng số điện thoại hiển thị đẹp
    const clean = String(val).replace(/\D/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
    }
    return String(val);
  }
  return String(val);
};

// XML Style cho Báo cáo Excel 2003
const XML_STYLES = `
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" x:CharSet="163" x:Family="Roman" ss:Size="11"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" x:CharSet="163" x:Family="Roman" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#05469B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
  </Style>
  <Style ss:ID="sData">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
   </Borders>
  </Style>
  <Style ss:ID="sBold">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" x:CharSet="163" x:Family="Roman" ss:Bold="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
   </Borders>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" x:CharSet="163" x:Family="Roman" ss:Size="16" ss:Bold="1" ss:Color="#05469B"/>
  </Style>
  <Style ss:ID="sMetaLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" x:CharSet="163" x:Family="Roman" ss:Bold="1" ss:Color="#4B5563"/>
  </Style>
  <Style ss:ID="sMetaValue">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" x:CharSet="163" x:Family="Roman" ss:Color="#1F2937"/>
  </Style>
 </Styles>
`;

export async function exportReportToExcel(
  template: ReportTemplate,
  data: any[],
  visibleColumns: string[],
  filters: Record<string, any>,
  donViMap: Record<string, string>,
  user: any
): Promise<void> {
  const sanitizeSheetName = getSanitizeSheetName();

  let xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${XML_STYLES}`;

  const renderTableXML = (sheetName: string, headers: string[], colsWidth: number[], rows: string[][], titleText?: string) => {
    let sheetXml = ` <Worksheet ss:Name="${escapeXML(sanitizeSheetName(sheetName))}">\n  <Table x:FullColumns="1" x:FullRows="1">\n`;
    colsWidth.forEach(w => {
      sheetXml += `   <Column ss:Width="${w}"/>\n`;
    });

    let currentLine = 1;
    if (titleText) {
      sheetXml += `   <Row ss:Height="40">\n    <Cell ss:MergeAcross="${headers.length - 1}" ss:StyleID="sTitle"><Data ss:Type="String">${escapeXML(titleText)}</Data></Cell>\n   </Row>\n`;
      sheetXml += `   <Row ss:Height="15"><Cell ss:MergeAcross="${headers.length - 1}"></Cell></Row>\n`;
      currentLine += 2;
    }

    // Headers
    sheetXml += `   <Row ss:Height="26">\n`;
    headers.forEach(h => {
      sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXML(h)}</Data></Cell>\n`;
    });
    sheetXml += `   </Row>\n`;

    // Data rows
    rows.forEach(row => {
      sheetXml += `   <Row ss:Height="22" ss:AutoFitHeight="1">\n`;
      row.forEach(cell => {
        sheetXml += `    <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(cell)}</Data></Cell>\n`;
      });
      sheetXml += `   </Row>\n`;
    });

    sheetXml += `  </Table>\n </Worksheet>\n`;
    return sheetXml;
  };

  const cols = template.columns.filter(c => visibleColumns.includes(c.key));
  const headers = cols.map(c => c.label);
  const colsWidth = cols.map(c => c.width || 120);

  // XỬ LÝ ĐẶC BIỆT THEO LOẠI BÁO CÁO (Mỗi loại văn bản là 1 sheet Excel)
  if (template.id === 'document_list_report' || template.id === 'custom_report_documents' || template.module === 'VĂN BẢN') {
    // Hàm xác định loại văn bản/sheet theo phan_loai hoặc mã nhận biết (CVĐ / CV)
    const getDocumentSheetType = (item: any): string => {
      const pl = String(item.phan_loai || '').trim();
      if (pl === 'Quyết định' || pl === 'Thông báo' || pl === 'Tờ trình' || pl === 'Công văn đến' || pl === 'Công văn đi') {
        return pl;
      }
      const soHieu = String(item.so_hieu || '').toUpperCase();
      if (soHieu.includes('CVĐ') || soHieu.includes('/CVĐ') || pl.toLowerCase().includes('đến')) {
        return 'Công văn đến';
      }
      if (soHieu.includes('CV') || soHieu.includes('/CV') || pl.toLowerCase().includes('công văn')) {
        return 'Công văn đi';
      }
      return pl || 'Công văn đi';
    };

    // 1. Phân chia ra các sheet theo loại văn bản (Quyết định, Thông báo, Tờ trình, Công văn đến, Công văn đi...)
    const foundTypes = Array.from(new Set(data.map(item => getDocumentSheetType(item)))).filter(Boolean);
    const standardTypes = ['Quyết định', 'Thông báo', 'Tờ trình', 'Công văn đến', 'Công văn đi'];
    const types = foundTypes.length > 0 ? foundTypes : standardTypes;
    
    types.forEach(type => {
      const typeData = data.filter(item => getDocumentSheetType(item).toLowerCase() === type.toLowerCase());
      const rows = typeData.map(item =>
        cols.map(c => {
          let val = item[c.key];
          if (c.key === 'id_don_vi') val = donViMap[String(val)] || val;
          return formatCell(val, c.format);
        })
      );
      xmlContent += renderTableXML(type, headers, colsWidth, rows, `DANH SÁCH VĂN BẢN - ${type.toUpperCase()}`);
    });

    // 2. Bổ sung Sheet "Thống kê Bộ phận"
    const deptRows: string[][] = [];
    const depts = Array.from(new Set(data.map(item => item.bo_phan_lay_so || 'Không xác định')));
    
    depts.forEach(deptName => {
      const deptData = data.filter(item => (item.bo_phan_lay_so || 'Không xác định') === deptName);
      const qdCount = deptData.filter(item => getDocumentSheetType(item) === 'Quyết định').length;
      const tbCount = deptData.filter(item => getDocumentSheetType(item) === 'Thông báo').length;
      const ttCount = deptData.filter(item => getDocumentSheetType(item) === 'Tờ trình').length;
      const cvdCount = deptData.filter(item => getDocumentSheetType(item) === 'Công văn đến').length;
      const cvDiCount = deptData.filter(item => getDocumentSheetType(item) === 'Công văn đi').length;
      
      deptRows.push([
        deptName,
        String(qdCount),
        String(tbCount),
        String(ttCount),
        String(cvdCount),
        String(cvDiCount),
        String(deptData.length)
      ]);
    });

    const statHeaders = ['Bộ phận lấy số', 'Quyết định', 'Thông báo', 'Tờ trình', 'Công văn đến (CVĐ)', 'Công văn đi (CV)', 'Tổng cộng'];
    const statWidths = [240, 120, 120, 120, 150, 150, 110];
    xmlContent += renderTableXML('Thống kê Bộ phận', statHeaders, statWidths, deptRows, 'THỐNG KÊ SỐ LƯỢNG VĂN BẢN BAN HÀNH THEO BỘ PHẬN LẤY SỐ');

  } else if (template.id === 'system_donvi_structure') {
    // Layout xuất Excel có tiêu đề 2 dòng gộp ô chuyên nghiệp
    let sheetXml = ` <Worksheet ss:Name="${escapeXML(sanitizeSheetName('Tổng hợp liên hệ'))}">\n  <Table x:FullColumns="1" x:FullRows="1">\n`;
    colsWidth.forEach(w => {
      sheetXml += `   <Column ss:Width="${w}"/>\n`;
    });

    // Dòng Tiêu đề báo cáo gộp ô
    sheetXml += `   <Row ss:Height="40">\n    <Cell ss:MergeAcross="13" ss:StyleID="sTitle"><Data ss:Type="String">TỔNG HỢP THÔNG TIN LIÊN HỆ ĐƠN VỊ</Data></Cell>\n   </Row>\n`;
    sheetXml += `   <Row ss:Height="15"><Cell ss:MergeAcross="13"></Cell></Row>\n`;

    // Header Dòng 1
    sheetXml += `   <Row ss:Height="26">\n`;
    sheetXml += `    <Cell ss:MergeDown="1" ss:StyleID="sHeader"><Data ss:Type="String">TT</Data></Cell>\n`;
    sheetXml += `    <Cell ss:MergeDown="1" ss:StyleID="sHeader"><Data ss:Type="String">Tên Đơn vị</Data></Cell>\n`;
    sheetXml += `    <Cell ss:MergeAcross="2" ss:StyleID="sHeader"><Data ss:Type="String">Tổng Giám đốc</Data></Cell>\n`;
    sheetXml += `    <Cell ss:MergeAcross="2" ss:StyleID="sHeader"><Data ss:Type="String">PT QTVP &amp; ASĐS</Data></Cell>\n`;
    sheetXml += `    <Cell ss:MergeAcross="2" ss:StyleID="sHeader"><Data ss:Type="String">PT DVHC</Data></Cell>\n`;
    sheetXml += `    <Cell ss:MergeAcross="2" ss:StyleID="sHeader"><Data ss:Type="String">PT Nhân sự</Data></Cell>\n`;
    sheetXml += `   </Row>\n`;

    // Header Dòng 2
    sheetXml += `   <Row ss:Height="22">\n`;
    sheetXml += `    <Cell ss:Index="3" ss:StyleID="sHeader"><Data ss:Type="String">Họ tên</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Mail</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">SĐT</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Họ tên</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Mail</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">SĐT</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Họ tên</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Mail</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">SĐT</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Họ tên</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Mail</Data></Cell>\n`;
    sheetXml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">SĐT</Data></Cell>\n`;
    sheetXml += `   </Row>\n`;

    // Các dòng dữ liệu
    const rows = data.map(item =>
      cols.map(c => {
        let val = item[c.key];
        if (c.key === 'id_don_vi') val = donViMap[String(val)] || val;
        return formatCell(val, c.format);
      })
    );
    rows.forEach(row => {
      sheetXml += `   <Row ss:Height="22" ss:AutoFitHeight="1">\n`;
      row.forEach(cell => {
        sheetXml += `    <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(cell)}</Data></Cell>\n`;
      });
      sheetXml += `   </Row>\n`;
    });

    sheetXml += `  </Table>\n </Worksheet>\n`;
    xmlContent += sheetXml;

  } else {
    // Các báo cáo còn lại xuất dạng bảng Dữ liệu chuẩn
    const titleSuffix = filters.sub_report_type ? ` - ${filters.sub_report_type}` : '';
    const rows = data.map(item =>
      cols.map(c => {
        let val = item[c.key];
        if (c.key === 'id_don_vi') val = donViMap[String(val)] || val;
        return formatCell(val, c.format);
      })
    );
    xmlContent += renderTableXML('Dữ liệu', headers, colsWidth, rows, (template.title + titleSuffix).toUpperCase());
  }

  // SHEET 3: THÔNG TIN BÁO CÁO (Metadata)
  const metaTitle = template.title + (filters.sub_report_type ? ` - ${filters.sub_report_type}` : '');
  xmlContent += ` <Worksheet ss:Name="Thông tin">
  <Table x:FullColumns="1" x:FullRows="1" ss:DefaultColumnWidth="150">
   <Column ss:Width="200"/>
   <Column ss:Width="300"/>
   <Row ss:Height="25">
    <Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">Tên Báo Cáo</Data></Cell>
    <Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXML(metaTitle)}</Data></Cell>
   </Row>
   <Row ss:Height="25">
    <Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">Phân Hệ</Data></Cell>
    <Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXML(template.module)}</Data></Cell>
   </Row>
   <Row ss:Height="25">
    <Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">Người Xuất Báo Cáo</Data></Cell>
    <Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXML(user?.ho_ten || 'Admin')}</Data></Cell>
   </Row>
   <Row ss:Height="25">
    <Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">Thời Gian Xuất</Data></Cell>
    <Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXML(new Date().toLocaleString('vi-VN'))}</Data></Cell>
   </Row>
   <Row ss:Height="25">
    <Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">Tổng Số Bản Ghi</Data></Cell>
    <Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXML(data.length)}</Data></Cell>
   </Row>
   <Row ss:Height="15"><Cell></Cell><Cell></Cell></Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="sBold"><Data ss:Type="String">BỘ LỌC ĐÃ ÁP DỤNG</Data></Cell>
   </Row>
`;

  Object.entries(filters).forEach(([k, v]) => {
    let cleanVal = String(v);
    if (k === 'id_don_vi') cleanVal = donViMap[String(v)] || String(v);
    const filterField = template.filters.find(f => f.key === k);
    const label = filterField ? filterField.label : k;

    xmlContent += `   <Row ss:Height="22">
    <Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">${escapeXML(label)}</Data></Cell>
    <Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXML(cleanVal || 'Tất cả')}</Data></Cell>
   </Row>\n`;
  });

  xmlContent += `  </Table>\n </Worksheet>\n</Workbook>`;

  const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);

  const subReportSuffix = filters.sub_report_type ? `_${filters.sub_report_type.replace(/\s+/g, '_')}` : '';
  const cleanTitle = template.title.replace(/\s+/g, '_');
  link.setAttribute("download", `BaoCao_${cleanTitle}${subReportSuffix}_${Date.now()}.xls`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
