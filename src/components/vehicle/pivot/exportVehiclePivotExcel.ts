import { VehiclePivotTableData, VehiclePivotNode, VehiclePivotMeasure } from './vehiclePivotTypes';
import { toast } from '../../../utils/toast';

interface ExportVehiclePivotOptions {
  configName: string;
  data: VehiclePivotTableData;
  rowFieldLabels: string[];
  valField: VehiclePivotMeasure;
  filterSummary?: string;
}

export function exportVehiclePivotExcel(options: ExportVehiclePivotOptions) {
  const { configName, data, rowFieldLabels, valField, filterSummary = '' } = options;

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
  const rowDimensionHeader = rowFieldLabels.length > 0 ? rowFieldLabels.join(' > ') : 'Chỉ tiêu phân loại xe';

  const isCurrency = valField === 'nguyen_gia' || valField === 'chi_phi';
  const numberFormat = isCurrency ? '#,##0 &quot;VNĐ&quot;' : '#,##0';

  // Chuyển cây phân cấp dòng thành các dòng Excel có thụt lề
  const rowsXML: string[] = [];

  const renderNodeRows = (node: VehiclePivotNode, level: number) => {
    const isLeaf = !node.children || node.children.length === 0;
    const isParent = !isLeaf;

    const labelStyle = isParent ? 'sRowParent' : 'sRowChild';
    const numStyle = isParent ? 'sNumParent' : 'sNumChild';
    const totalNumStyle = isParent ? 'sTotalNumParent' : 'sTotalNumChild';

    const indentSpaces = '    '.repeat(level);
    const prefixSymbol = isParent ? '📁 ' : '• ';
    const displayLabel = `${indentSpaces}${prefixSymbol}${node.label}`;

    const valueCells = data.leafColumns.map(col => {
      const val = node.values[col.key] || 0;
      return `<Cell ss:StyleID="${numStyle}"><Data ss:Type="Number">${val}</Data></Cell>`;
    }).join('');

    const totalCell = `<Cell ss:StyleID="${totalNumStyle}"><Data ss:Type="Number">${node.total}</Data></Cell>`;

    rowsXML.push(`
      <Row ss:Height="${isParent ? 22 : 19}">
        <Cell ss:StyleID="${labelStyle}"><Data ss:Type="String">${escapeXML(displayLabel)}</Data></Cell>
        ${valueCells}
        ${totalCell}
      </Row>
    `);

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => renderNodeRows(child, level + 1));
    }
  };

  data.rootNodes.forEach(root => renderNodeRows(root, 0));

  // Dòng Tổng Cộng Toàn Bộ (Grand Total Row)
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
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>

  <!-- Title & Info -->
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#005698"/>
  </Style>
  <Style ss:ID="sSubTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#475569"/>
  </Style>

  <!-- Table Headers -->
  <Style ss:ID="sHeaderCol">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#005698" ss:Pattern="Solid"/>
  </Style>

  <!-- Row Styles -->
  <Style ss:ID="sRowParent">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sRowChild">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#334155"/>
  </Style>

  <!-- Number Cells -->
  <Style ss:ID="sNumParent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="${numberFormat}"/>
  </Style>
  <Style ss:ID="sNumChild">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F1F5F9"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#334155"/>
   <NumberFormat ss:Format="${numberFormat}"/>
  </Style>

  <!-- Row Total Cells -->
  <Style ss:ID="sTotalNumParent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#005698"/>
   <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="${numberFormat}"/>
  </Style>
  <Style ss:ID="sTotalNumChild">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0369A1"/>
   <Interior ss:Color="#F0F9FF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="${numberFormat}"/>
  </Style>

  <!-- Grand Total -->
  <Style ss:ID="sGrandTotalLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#005698"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#005698"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#005698"/>
   <Interior ss:Color="#BAE6FD" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sGrandTotalNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#005698"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#005698"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#005698"/>
   <Interior ss:Color="#BAE6FD" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="${numberFormat}"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Thống Kê Xe">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="260"/>
   ${data.leafColumns.map(() => '<Column ss:Width="130"/>').join('')}
   <Column ss:Width="140"/>

   <!-- Header thông tin -->
   <Row ss:Height="26">
    <Cell ss:MergeAcross="${totalColumnsCount - 1}" ss:StyleID="sTitle">
     <Data ss:Type="String">BÁO CÁO PHÂN TÍCH ĐA CHIỀU QUẢN LÝ XE: ${escapeXML(configName.toUpperCase())}</Data>
    </Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="${totalColumnsCount - 1}" ss:StyleID="sSubTitle">
     <Data ss:Type="String">Hệ thống Quản trị QTVP-ASDS | Ngày xuất: ${dateStr} ${filterSummary ? `| Bộ lọc: ${escapeXML(filterSummary)}` : ''}</Data>
    </Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- Header Bảng Pivot -->
   <Row ss:Height="28">
    <Cell ss:StyleID="sHeaderCol"><Data ss:Type="String">${escapeXML(rowDimensionHeader)}</Data></Cell>
    ${data.leafColumns.map(col => `<Cell ss:StyleID="sHeaderCol"><Data ss:Type="String">${escapeXML(col.label)}</Data></Cell>`).join('')}
    <Cell ss:StyleID="sHeaderCol"><Data ss:Type="String">TỔNG CỘNG</Data></Cell>
   </Row>

   <!-- Dữ liệu -->
   ${rowsXML.join('')}

   <!-- Dòng Tổng Cộng -->
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

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = configName.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '_');
  link.download = `Bao_Cao_Pivot_Xe_${safeName}_${now.toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Đã xuất file Excel Báo cáo Pivot Quản lý Xe thành công!');
}
