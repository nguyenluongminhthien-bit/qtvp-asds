import React, { useState, useMemo } from 'react';
import { ThueBao, CuocThang } from '../../types';
import { TrendingUp, TrendingDown, AlertCircle, Phone, CheckCircle2 } from 'lucide-react';
import { formatCurrencySpace as formatCurrency, formatPhoneNumber } from '../../utils/formatters';

interface Props {
  thueBao: ThueBao;
  cuocList: CuocThang[];
  dinhMuc?: number | null;
}

interface ChartTooltipState {
  visible: boolean;
  x: number;
  y: number;
  month: number;
  currVal: number | null;
  prevVal: number | null;
  diff: number | null;
  status: 'vượt' | 'trong' | 'chưa';
}

export default function ThueBaoDetailCuocChart({ thueBao, cuocList, dinhMuc }: Props) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>({
    visible: false,
    x: 0,
    y: 0,
    month: 1,
    currVal: null,
    prevVal: null,
    diff: null,
    status: 'chưa'
  });

  const currYear = useMemo(() => new Date().getFullYear(), []);
  const prevYear = useMemo(() => currYear - 1, [currYear]);

  // Ngưỡng định mức (Dùng thực tế nếu có, mặc định 200.000 VNĐ nếu không có)
  const nguongDinhMuc = useMemo(() => {
    if (dinhMuc !== null && dinhMuc !== undefined && Number(dinhMuc) > 0) {
      return Number(dinhMuc);
    }
    if (thueBao.dinh_muc_cuoc !== null && thueBao.dinh_muc_cuoc !== undefined && Number(thueBao.dinh_muc_cuoc) > 0) {
      return Number(thueBao.dinh_muc_cuoc);
    }
    return 200000;
  }, [thueBao.dinh_muc_cuoc, dinhMuc]);

  // Tính toán dữ liệu 12 tháng (Từ Tháng 1 đến Tháng 12)
  const chartData = useMemo(() => {
    const idTB = thueBao.id;
    const sdtClean = formatPhoneNumber(thueBao.so_dien_thoai || '');

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const strCurr = `${currYear}-${String(m).padStart(2, '0')}`;
      const strPrev = `${prevYear}-${String(m).padStart(2, '0')}`;

      const matchRecord = (item: CuocThang, mStr: string) => {
        if (item.thang_nam !== mStr) return false;
        if (item.id_thue_bao === idTB) return true;
        if (sdtClean && formatPhoneNumber(item.so_dien_thoai || '') === sdtClean) return true;
        return false;
      };

      const currItems = cuocList.filter(c => matchRecord(c, strCurr));
      const prevItems = cuocList.filter(c => matchRecord(c, strPrev));

      const currVal = currItems.length > 0
        ? currItems.reduce((sum, item) => sum + (Number(item.tong_cuoc) || 0), 0)
        : null;

      const prevVal = prevItems.length > 0
        ? prevItems.reduce((sum, item) => sum + (Number(item.tong_cuoc) || 0), 0)
        : null;

      return {
        month: m,
        label: `T${m}`,
        currVal,
        prevVal
      };
    });
  }, [thueBao, cuocList, currYear, prevYear]);

  // Giá trị lớn nhất của trục Oy để vẽ biểu đồ
  const maxOy = useMemo(() => {
    let max = nguongDinhMuc * 1.35;
    chartData.forEach(d => {
      if (d.currVal !== null && d.currVal > max) max = d.currVal * 1.15;
      if (d.prevVal !== null && d.prevVal > max) max = d.prevVal * 1.15;
    });
    return Math.max(max, 300000);
  }, [chartData, nguongDinhMuc]);

  // Thông số vẽ SVG (Hệ tọa độ)
  const svgWidth = 660;
  const svgHeight = 220;
  const padLeft = 65;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 35;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;
  const slotW = chartW / 12;

  const getY = (val: number) => padTop + chartH - (val / maxOy) * chartH;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, item: typeof chartData[0]) => {
    const container = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!container) return;

    const x = e.clientX - container.left;
    const y = e.clientY - container.top;

    let diff: number | null = null;
    if (item.currVal !== null && item.prevVal !== null) {
      diff = item.currVal - item.prevVal;
    }

    let status: 'vượt' | 'trong' | 'chưa' = 'chưa';
    if (item.currVal !== null) {
      status = item.currVal > nguongDinhMuc ? 'vượt' : 'trong';
    }

    setTooltip({
      visible: true,
      x,
      y,
      month: item.month,
      currVal: item.currVal,
      prevVal: item.prevVal,
      diff,
      status
    });
  };

  return (
    <div className="flex flex-col h-full relative select-none">
      {/* Legend & Định mức Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs">
        <div className="flex items-center gap-2 font-bold text-gray-700 dark:text-gray-200">
          <Phone size={14} className="text-[#05469B] dark:text-blue-400" />
          <span>Biểu đồ so sánh cước 12 tháng của thuê bao</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#D1D5DB] inline-block shadow-2xs"></span>
            <span className="text-gray-600 dark:text-gray-400">Năm trước ({prevYear})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#00529C] inline-block shadow-2xs"></span>
            <span className="text-gray-800 dark:text-gray-200">Năm nay ({currYear})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#EF4444] inline-block"></span>
            <span className="text-red-600 dark:text-red-400">Định mức: {formatCurrency(nguongDinhMuc)}đ</span>
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative flex-1 w-full flex items-center justify-center min-h-[220px]">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
          {/* Lưới ngang chấm mờ & Nhãn trục Oy */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const val = ratio * maxOy;
            const yPos = getY(val);
            return (
              <g key={idx}>
                {ratio > 0 && (
                  <line
                    x1={padLeft}
                    y1={yPos}
                    x2={svgWidth - padRight}
                    y2={yPos}
                    stroke="#E5E7EB"
                    strokeDasharray="3,3"
                    className="dark:stroke-gray-800"
                  />
                )}
                <text
                  x={padLeft - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  className="fill-gray-400 dark:fill-gray-500 font-bold text-[10px]"
                >
                  {val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : `${Math.round(val / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* Trục Ox (dưới cùng) và Trục Oy (bên trái) - Tối giản: Không có viền trên và bên phải */}
          <line x1={padLeft} y1={padTop + chartH} x2={svgWidth - padRight} y2={padTop + chartH} stroke="#D1D5DB" strokeWidth="1.5" className="dark:stroke-gray-700" />
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + chartH} stroke="#D1D5DB" strokeWidth="1.5" className="dark:stroke-gray-700" />

          {/* Đường định mức màu đỏ nét liền cắt ngang */}
          {nguongDinhMuc <= maxOy && (
            <g>
              <line
                x1={padLeft}
                y1={getY(nguongDinhMuc)}
                x2={svgWidth - padRight}
                y2={getY(nguongDinhMuc)}
                stroke="#EF4444"
                strokeWidth="1.5"
              />
              <text
                x={svgWidth - padRight - 4}
                y={getY(nguongDinhMuc) - 4}
                textAnchor="end"
                className="fill-red-500 font-extrabold text-[9px]"
              >
                ĐM {formatCurrency(nguongDinhMuc)}
              </text>
            </g>
          )}

          {/* Vẽ các cột cước từng tháng */}
          {chartData.map((d, idx) => {
            const xCenter = padLeft + idx * slotW + slotW / 2;

            // Cột xám nhạt (năm trước) to hơn, width = slotW * 0.7
            const wPrev = slotW * 0.7;
            const xPrev = xCenter - wPrev / 2;
            const hPrev = d.prevVal !== null ? Math.max((d.prevVal / maxOy) * chartH, 2) : 0;
            const yPrev = padTop + chartH - hPrev;

            // Cột xanh dương (năm hiện tại) mảnh hơn, width = slotW * 0.5
            const wCurr = slotW * 0.5;
            const xCurr = xCenter - wCurr / 2;
            const hCurr = d.currVal !== null ? Math.max((d.currVal / maxOy) * chartH, 2) : 0;
            const yCurr = padTop + chartH - hCurr;

            return (
              <g key={d.month}>
                {/* Nhãn Tháng dưới trục Ox */}
                <text
                  x={xCenter}
                  y={padTop + chartH + 18}
                  textAnchor="middle"
                  className="fill-gray-600 dark:fill-gray-400 font-bold text-[11px]"
                >
                  {d.label}
                </text>

                {/* Cột năm trước (#D1D5DB) */}
                {d.prevVal !== null && (
                  <rect
                    x={xPrev}
                    y={yPrev}
                    width={wPrev}
                    height={hPrev}
                    fill="#D1D5DB"
                    rx="2"
                    className="transition-all duration-300"
                  />
                )}

                {/* Cột năm hiện tại (#00529C) nằm đè chính giữa cột xám */}
                {d.currVal !== null && (
                  <rect
                    x={xCurr}
                    y={yCurr}
                    width={wCurr}
                    height={hCurr}
                    fill="#00529C"
                    rx="2"
                    className="transition-all duration-300 hover:brightness-110"
                  />
                )}

                {/* Vùng bắt sự kiện Hover cho toàn bộ slot tháng */}
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={chartH + padBottom}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseMove={(e) => handleMouseMove(e, d)}
                  onMouseEnter={(e) => handleMouseMove(e, d)}
                  onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip hiện đại, cao cấp */}
        {tooltip.visible && (
          <div
            className="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-3.5 z-50 w-64 text-xs animate-in fade-in zoom-in-95 duration-100 pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 15, svgWidth - 250),
              top: Math.max(tooltip.y - 120, 10)
            }}
          >
            {/* Tiêu đề: SĐT & Người/Bộ phận sử dụng */}
            <div className="border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
              <p className="font-black text-[#05469B] dark:text-blue-400 text-sm font-mono tracking-wide">
                {thueBao.so_dien_thoai}
              </p>
              <p className="font-bold text-gray-700 dark:text-gray-300 text-[11px] truncate mt-0.5">
                {thueBao.ho_ten_nv || thueBao.ten_bo_phan || 'SIM dùng chung'}
              </p>
              <p className="font-bold text-gray-400 text-[10px] uppercase tracking-wider mt-0.5">
                Tháng {String(tooltip.month).padStart(2, '0')}
              </p>
            </div>

            <div className="space-y-1.5 font-medium text-[11.5px]">
              {/* Chi phí năm hiện tại (#00529C) */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Năm hiện tại ({currYear}):</span>
                <span className="font-black text-[#00529C] dark:text-blue-400">
                  {tooltip.currVal !== null ? `${formatCurrency(tooltip.currVal)} VNĐ` : 'Chưa có'}
                </span>
              </div>

              {/* Chi phí năm trước (#808080) */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Năm trước ({prevYear}):</span>
                <span className="font-bold text-[#808080] dark:text-gray-400">
                  {tooltip.prevVal !== null ? `${formatCurrency(tooltip.prevVal)} VNĐ` : 'Chưa có'}
                </span>
              </div>

              {/* Biến động */}
              {tooltip.diff !== null && (
                <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Biến động:</span>
                  <span
                    className={`font-black ${
                      tooltip.diff > 0
                        ? 'text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5'
                        : tooltip.diff < 0
                        ? 'text-red-600 dark:text-red-400 flex items-center gap-0.5'
                        : 'text-gray-500'
                    }`}
                  >
                    {tooltip.diff > 0 && <TrendingUp size={13} className="shrink-0" />}
                    {tooltip.diff < 0 && <TrendingDown size={13} className="shrink-0" />}
                    {tooltip.diff > 0 ? '+' : ''}{formatCurrency(tooltip.diff)} VNĐ
                  </span>
                </div>
              )}

              {/* Trạng thái định mức */}
              <div className="pt-1.5 mt-1 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-gray-500 text-[11px]">Trạng thái ĐM:</span>
                {tooltip.status === 'vượt' && (
                  <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-extrabold rounded-md border border-red-200 dark:border-red-800 text-[10.5px] flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" /> Vượt định mức
                  </span>
                )}
                {tooltip.status === 'trong' && (
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-md border border-emerald-200 dark:border-emerald-800 text-[10.5px] flex items-center gap-1">
                    <CheckCircle2 size={12} className="shrink-0" /> Trong định mức
                  </span>
                )}
                {tooltip.status === 'chưa' && (
                  <span className="text-gray-400 italic text-[11px]">Chưa phát sinh cước</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
