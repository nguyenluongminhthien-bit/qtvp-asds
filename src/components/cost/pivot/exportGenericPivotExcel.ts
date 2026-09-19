import { PivotTableData, PivotNode } from './pivotTypes';
import { toast } from '../../../utils/toast';

interface ExportPivotOptions {
  configName: string;
  data: PivotTableData;
  rowFieldLabels: string[];
  filterSummary?: string;
}

export function exportGenericPivotExcel(options: ExportPivotOptions) {
  const { configName, data, rowFieldLabels, filterSummary = '' } = options;

  if (!data || data.rootNodes.length === 0) {
    toast.warning('Không có dữ liệu để xuất file Excel!');
    return;
  }

  const escapeXML = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const rowDimensionHeader = rowFieldLabels.length > 0 ? rowFieldLabels.join(' > ') : 'Chỉ tiêu';

  // Chuyển cây phân cấp dòng thành các dòng Excel có thụt lề (Indentation)
  const rowsXML: string[] = [];

  const renderNodeRows = (node: PivotNode, level: number) => {
    const isLeaf = !node.children || node.children.length === 0;
    const isParent = !isLeaf;
    
    // Style ID: Hàng cha đậm, hàng con bình thường
    const labelStyle = isParent ? 'sRowParent' : 'sRowChild';
    const numStyle = isParent ? 'sNumParent' : 'sNumChild';
    const totalNumStyle = isParent ? 'sTotalNumParent' : 'sTotalNumChild';

    // Tạo khoảng trắng thụt lề trực quan cho cấp bậc
    const indentSpaces = '    '.repeat(level);
    const prefixSymbol = isParent ? '📂 ' : '• ';
    const displayLabel = `${indentSpaces}${prefixSymbol}${node.label}`;

    // Cột giá trị theo từng cột ngang
    const valueCells = data.leafColumns.map(col => {
      const val = node.values[col.key] || 0;
      return `<Cell ss:StyleID="${numStyle}"><Data ss:Type="Number">${val}</Data></Cell>`;
    }).join('');

    // Cột tổng cộng dòng
    const totalCell = `<Cell ss:StyleID="${totalNumStyle}"><Data ss:Type="Number">${node.total}</Data></Cell>`;

    rowsXML.push(`
      <Row ss:Height="${isParent ? 22 : 19}">
        <Cell ss:StyleID="${labelStyle}"><Data ss:Type="String">${escapeXML(displayLabel)}</Data></Cell>
        ${valueCells}
        ${totalCell}
      </Row>
    `);

    // Đệ quy hiển thị các con nếu có
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => renderNodeRows(child, level + 1));
    }
  };

  data.rootNodes.forEach(root => renderNodeRows(root, 0));

  // Dòng Tổng Cộng toàn bộ (Grand Total Row)
  const grandTotalCells = data.leafColumns.map(col => {
    const val = data.grandTotalByCol[col.key] || 0;
    return `<Cell ss:StyleID="sGrandTotalNumber"><Data ss:Type="Number">${val}</Data></Cell>`;
  }).join('');
  const grandTotalAllCell = `<Cell ss:StyleID="sGrandTotalNumber"><Data ss:Type="Number">${data.grandTotalAll}</Data></Cell>`;

  const grandTotalRowXML = `
    <Row ss:Height="24">
      <Cell ss:StyleID="sGrandTotalLabel"><Data ss:Type="String">TỔNG CỘNG TOÀN BỘ</Data></Cell>
      ${grandTotalCells}
      ${grandTotalAllCell}
    </Row>
  `;

  // Tổng số cột bảng (Cột tiêu đề + các cột dữ liệu + cột tổng)
  const totalColumnsCount = 1 + data.leafColumns.length + 1;

  const excelTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1F2937"/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#D97706"/>
  </Style>
  <Style ss:ID="sSubTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#6B7280"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#78350F"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D97706"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sRowParent">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
   <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sRowChild">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Color="#374151"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F3F4F6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumParent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
   <NumberFormat ss:Format="#,##0"/>
   <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumChild">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Color="#374151"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F3F4F6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalNumParent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#D97706"/>
   <NumberFormat ss:Format="#,##0"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D97706"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalNumChild">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#B45309"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F3F4F6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sGrandTotalLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#78350F"/>
   <Interior ss:Color="#FDE68A" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#B45309"/>
   </Borders>
  </Style>
  <Style ss:ID="sGrandTotalNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#78350F"/>
   <NumberFormat ss:Format="#,##0"/>
   <Interior ss:Color="#FDE68A" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#B45309"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="BaoCaoThongKe">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="280"/>
   ${data.leafColumns.map(() => '<Column ss:Width="130"/>').join('\n   ')}
   <Column ss:Width="140"/>

   <!-- Tiêu đề báo cáo -->
   <Row ss:Height="26">
    <Cell ss:MergeAcross="${totalColumnsCount - 1}" ss:StyleID="sTitle">
      <Data ss:Type="String">${escapeXML(configName.toUpperCase())}</Data>
    </Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="${totalColumnsCount - 1}" ss:StyleID="sSubTitle">
      <Data ss:Type="String">Xuất ngày: ${dateStr} ${filterSummary ? `| Bộ lọc: ${escapeXML(filterSummary)}` : ''}</Data>
    </Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- Dòng Header cột (Đóng băng tại dòng này) -->
   <Row ss:Height="26">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXML(rowDimensionHeader)}</Data></Cell>
    ${data.leafColumns.map(c => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXML(c.label)} (VNĐ)</Data></Cell>`).join('\n    ')}
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">TỔNG CỘNG (VNĐ)</Data></Cell>
   </Row>

   <!-- Dữ liệu các tầng phân cấp -->
   ${rowsXML.join('\n')}

   <!-- Dòng Tổng cộng toàn bộ -->
   ${grandTotalRowXML}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>4</SplitHorizontal>
   <TopRowBottomPane>4</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const safeFileName = configName.replace(/[\/\\:*?"<>|]/g, '_').trim();
  const fileName = `${safeFileName}_${now.getFullYear()}_T${now.getMonth() + 1}.xls`;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Đã xuất file Excel: ${fileName}`);
}
