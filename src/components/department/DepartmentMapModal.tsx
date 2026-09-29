import React, { useState, useEffect, useMemo, useRef } from 'react';
// @ts-ignore
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Navigation, MapPin, Loader2, RotateCcw, AlertTriangle, HelpCircle, Layers, Compass, Shield, Camera } from 'lucide-react';
import { DonVi, Personnel } from '../../types';
import { buildHierarchicalOptions, getUnitEmoji } from '../../utils/hierarchy';
import { getAnNinh } from '../../services/api/modules';
import { toast } from '../../utils/toast';

// 🟢 Hàm tiện ích kiểm tra xem một loại hình đơn vị dưới DB có được tick chọn trên UI hay không
const isUnitTypeSelected = (loaiHinh: string, selectedTypes: Record<string, boolean>): boolean => {
  const normType = String(loaiHinh || '').trim();
  return !!selectedTypes[normType];
};

// 🟢 Hàm xác định màu nền của Marker theo loại hình đơn vị (Bảng màu Sang trọng & Trực quan)
const getMarkerColorClass = (loaiHinh: string): string => {
  const lower = String(loaiHinh || '').toLowerCase().trim();
  if (lower.includes('văn phòng') || lower.includes('tổng công ty')) return 'bg-[#002D62]'; // Xanh Navy Đậm (Tổng Công ty)
  if (lower.includes('công ty tỉnh thành') || lower.includes('công ty tỉnh thành')) return 'bg-[#702963]'; // Tím Hoàng Gia (Công ty Tỉnh thành)
  if (lower.includes('showroom quản trị')) return 'bg-[#005698]'; // Xanh Dương (Showroom Quản trị)
  if (lower.includes('showroom') || lower.includes('đại lý')) return 'bg-[#E34234]'; // Đỏ San Hô (Showroom)
  if (lower.includes('xưởng dịch vụ')) return 'bg-[#D97706]'; // Vàng Hổ Phách (Xưởng Dịch vụ)
  if (lower.includes('điểm kinh doanh')) return 'bg-[#15803D]'; // Xanh Lá Cây (Điểm Kinh doanh)
  if (lower.includes('kho xe')) return 'bg-[#64748B]'; // Xám Slate (Kho xe)
  return 'bg-red-500'; // Mặc định fallback
};

interface DepartmentMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUnitId: string | null;
  units: DonVi[];
  personnel: Personnel[];
}

// 🟢 Custom Marker Icon sử dụng SVG và Tailwind CSS để tránh lỗi vỡ ảnh marker của Leaflet và tạo hiệu ứng ping/nổi bật
const createMarkerIcon = (isSelected: boolean, labelText: string, loaiHinh: string) => {
  const markerColor = getMarkerColorClass(loaiHinh);
  const borderColor = isSelected
    ? 'border-white scale-125 shadow-2xl ring-4 ring-blue-400/30 z-[1000]'
    : 'border-white shadow';
  const pingEffect = isSelected ? '<span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-blue-450 opacity-75"></span>' : '';
  const emoji = getUnitEmoji(loaiHinh);

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="flex flex-col items-center select-none" style="transform: translate(0, 0);">
        <div class="relative flex items-center justify-center">
          ${pingEffect}
          <div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${markerColor} ${borderColor} transition-all text-white text-xs">
            ${emoji}
          </div>
        </div>
        <div class="mt-1 px-1.5 py-0.5 bg-white/95 dark:bg-slate-800/95 text-[10px] font-black rounded shadow border border-gray-200/50 whitespace-nowrap text-gray-800 dark:text-gray-100 max-w-[120px] truncate">
          ${labelText}
        </div>
      </div>
    `,
    iconSize: [32, 48],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// 🟢 Hàm tính khoảng cách Haversine (đường chim bay) giữa hai tọa độ
const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function DepartmentMapModal({
  isOpen,
  onClose,
  initialUnitId,
  units,
  personnel
}: DepartmentMapModalProps) {
  const [activeTab, setActiveTab] = useState<'coverage' | 'distance' | 'route'>('coverage');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // ---- Cột trái: Tab Độ phủ ----
  const [centerUnitId, setCenterUnitId] = useState<string>('');
  const [radius, setRadius] = useState<number>(5);
  const [tempRadius, setTempRadius] = useState<number>(5);
  const [isCoverageActive, setIsCoverageActive] = useState(true); // Bật/tắt vẽ vòng tròn độ phủ
  const allAvailableTypes = useMemo(() => {
    const types = new Set<string>();
    units.forEach(u => {
      const lh = String(u.loai_hinh || '').trim();
      if (lh) types.add(lh);
    });
    
    const PREDEFINED_ORDER = [
      'Tổng Công ty',
      'Công ty Tỉnh thành',
      'Văn phòng Công ty',
      'Văn phòng',
      'VP Công ty',
      'Showroom Quản trị',
      'Showroom',
      'Xưởng Dịch vụ',
      'Điểm Kinh doanh',
      'Điểm bán hàng',
      'Đại lý',
      'Kho',
      'Kho xe'
    ];
    
    return Array.from(types).sort((a, b) => {
      const indexA = PREDEFINED_ORDER.indexOf(a);
      const indexB = PREDEFINED_ORDER.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [units]);

  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({});

  // Cập nhật selectedTypes khi allAvailableTypes thay đổi
  useEffect(() => {
    setSelectedTypes(prev => {
      const newSelected = { ...prev };
      let changed = false;
      allAvailableTypes.forEach(type => {
        if (newSelected[type] === undefined) {
          // Mặc định chọn một số loại hình kinh doanh chính, bỏ qua khối văn phòng
          newSelected[type] = !type.toLowerCase().includes('công ty') && !type.toLowerCase().includes('quản trị') && !type.toLowerCase().includes('văn phòng');
          changed = true;
        }
      });
      return changed ? newSelected : prev;
    });
  }, [allAvailableTypes]);

  // ---- Cột trái: Tab Khoảng cách ----
  const [distancePoints, setDistancePoints] = useState<string[]>([]);

  // ---- Cột trái: Tab Lộ trình tối ưu ----
  const [startUnitId, setStartUnitId] = useState<string>('');
  const [waypointSelections, setWaypointSelections] = useState<Record<string, boolean>>({});
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>([]);

  // ---- Trạng thái tính toán đường đi thực tế ----
  const [isLoadingRoad, setIsLoadingRoad] = useState(false);
  const [calculatedRoadDistance, setCalculatedRoadDistance] = useState<number | null>(null);
  const [calculatedBirdDistance, setCalculatedBirdDistance] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---- Dữ liệu An ninh & Hệ thống Camera ----
  const [anNinhList, setAnNinhList] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      getAnNinh()
        .then(res => setAnNinhList(Array.isArray(res) ? res : []))
        .catch(err => {
          console.error("Lỗi khi tải dữ liệu an ninh:", err);
          setAnNinhList([]);
        });
    }
  }, [isOpen]);

  const anNinhMap = useMemo(() => {
    const map = new Map<string, any>();
    anNinhList.forEach(item => {
      if (item.id_don_vi) {
        map.set(String(item.id_don_vi), item);
      }
    });
    return map;
  }, [anNinhList]);

  // ---- Refs điều khiển Leaflet ----
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const coverageCircleRef = useRef<L.FeatureGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // 🔴 LƯU Ý BẢO MẬT & CHỦ Ý THIẾT KẾ:
  // Trang này hiển thị TOÀN BỘ danh sách Showroom / Đơn vị công ty không lọc allowedDonViIds.
  // Địa chỉ showroom/chi nhánh là thông tin công khai, việc hiển thị đầy đủ đã được thống nhất
  // để hỗ trợ các bộ phận lập sơ đồ độ phủ cũng như tối ưu tuyến đi liên chi nhánh.

  // 1. Phân loại đơn vị có tọa độ hợp lệ (nằm trong phạm vi VN: vĩ độ 8-24, kinh độ 102-110)
  const validUnits = useMemo(() => {
    return units.filter(u => {
      const lat = parseFloat(u.vi_do);
      const lng = parseFloat(u.kinh_do);
      return !isNaN(lat) && !isNaN(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110;
    });
  }, [units]);

  // Danh sách các đơn vị có tọa độ hợp lệ, sắp xếp dạng cây thư mục (hierarchy)
  const hierarchicalOptions = useMemo(() => {
    return buildHierarchicalOptions(validUnits);
  }, [validUnits]);

  // Danh sách các đơn vị thiếu tọa độ hoặc tọa độ không hợp lệ
  const invalidUnits = useMemo(() => {
    return units.filter(u => {
      const lat = parseFloat(u.vi_do);
      const lng = parseFloat(u.kinh_do);
      return isNaN(lat) || isNaN(lng) || lat < 8 || lat > 24 || lng < 102 || lng > 110;
    });
  }, [units]);

  // 2. Lắng nghe phím Esc để đóng Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 3. Khởi tạo Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([16.047079, 108.206230], 6); // default view Việt Nam (Đà Nẵng)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapRef.current);
    }

    // Kích hoạt tính toán lại kích thước khung chứa để tránh lỗi render xám
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        coverageCircleRef.current = null;
        routePolylineRef.current = null;
        markersRef.current = {};
      }
    };
  }, [isOpen]);

  // 4. Đồng bộ selectedUnitId từ initialUnitId khi mở modal
  useEffect(() => {
    if (isOpen) {
      if (initialUnitId && validUnits.some(u => u.id === initialUnitId)) {
        setSelectedUnitId(initialUnitId);
        setCenterUnitId(initialUnitId);
        setStartUnitId(initialUnitId);
      } else if (validUnits.length > 0) {
        setSelectedUnitId(validUnits[0].id);
        setCenterUnitId(validUnits[0].id);
        setStartUnitId(validUnits[0].id);
      }
    }
  }, [isOpen, initialUnitId, validUnits]);

  // 4.5. Đăng ký sự kiện popupopen để lắng nghe click nút bấm thao tác nhanh bên trong Popup HTML
  useEffect(() => {
    if (!mapRef.current) return;

    const handlePopupOpen = (e: any) => {
      const popupNode = e.popup?.getElement();
      if (!popupNode) return;

      const btnAddDistance = popupNode.querySelector('.btn-add-distance');
      if (btnAddDistance) {
        btnAddDistance.onclick = (event: Event) => {
          event.stopPropagation();
          const uId = btnAddDistance.getAttribute('data-unit-id');
          if (uId) {
            setDistancePoints(prev => {
              if (!prev.includes(uId)) {
                const matched = validUnits.find(u => u.id === uId);
                toast.success(`Đã thêm "${matched?.ten_don_vi || ''}" vào chuỗi khoảng cách!`);
                return [...prev, uId];
              } else {
                const matched = validUnits.find(u => u.id === uId);
                toast.info(`"${matched?.ten_don_vi || ''}" đã có trong chuỗi khoảng cách.`);
                return prev;
              }
            });
            setCalculatedRoadDistance(null);
            setErrorMessage(null);
          }
        };
      }

      const btnAddRoute = popupNode.querySelector('.btn-add-route');
      if (btnAddRoute) {
        btnAddRoute.onclick = (event: Event) => {
          event.stopPropagation();
          const uId = btnAddRoute.getAttribute('data-unit-id');
          if (uId) {
            setWaypointSelections(prev => {
              const matched = validUnits.find(u => u.id === uId);
              if (!prev[uId]) {
                toast.success(`Đã chọn "${matched?.ten_don_vi || ''}" làm điểm ghé thăm!`);
                return { ...prev, [uId]: true };
              } else {
                toast.info(`"${matched?.ten_don_vi || ''}" đã được chọn làm điểm ghé thăm.`);
                return prev;
              }
            });
            setCalculatedRoadDistance(null);
            setCalculatedBirdDistance(null);
          }
        };
      }
    };

    mapRef.current.on('popupopen', handlePopupOpen);
    return () => {
      mapRef.current?.off('popupopen', handlePopupOpen);
    };
  }, [validUnits]);

  // 5. Vẽ Markers lên bản đồ (lọc động theo checkbox loại hình ở Tab Độ phủ)
  useEffect(() => {
    if (!mapRef.current || !isOpen) return;

    // Xóa marker cũ
    Object.values(markersRef.current).forEach((marker: any) => marker && marker.remove());
    markersRef.current = {};

    // Chỉ hiển thị các showroom tương ứng với loại hình được tick chọn ở Tab Độ phủ, hoặc showroom làm tâm, hoặc showroom đang xem
    const unitsToDraw = validUnits.filter(u => {
      if (activeTab !== 'coverage') return true;
      return isUnitTypeSelected(u.loai_hinh, selectedTypes) || u.id === centerUnitId || u.id === selectedUnitId;
    });

      unitsToDraw.forEach(u => {
        const lat = parseFloat(u.vi_do);
        const lng = parseFloat(u.kinh_do);
        const isSelected = u.id === selectedUnitId;

        // Lấy thông tin Lãnh đạo & SĐT
        const leaderObj = personnel.find(p => p.id === u.id_giam_doc || (u.id_giam_doc && String(p.ma_so_nhan_vien || '').toLowerCase() === String(u.id_giam_doc).toLowerCase()));
        const leaderName = leaderObj?.ho_ten || u.ten_giam_doc || 'Chưa cập nhật';
        const leaderPhone = leaderObj?.sdt_ca_nhan || leaderObj?.sdt_cong_ty || u.sdt_giam_doc || u.sdt || '---';

        // Lấy Tổng CB-NV theo thông tin tong_nhan_su tại đơn vị trong bảng dm_don_vi
        const totalStaff = u.tong_nhan_su || u.tong_cb_nv || (personnel.filter(p => p.id_don_vi === u.id && p.trang_thai !== 'Đã nghỉ việc').length || '---');

        const quyMoText = u.quy_mo || (u.so_tang ? `${u.so_tang} tầng${u.so_ham ? `, ${u.so_ham} hầm` : ''}` : '---');
        const luotKhachText = u.luot_khach_bq ? `${Number(u.luot_khach_bq).toLocaleString('vi-VN')} lượt/tháng` : (u.luot_khach ? `${u.luot_khach}` : '---');
        const dienTichFormatted = u.dien_tich ? `${Number(u.dien_tich).toLocaleString('vi-VN')} m²` : '---';

        const anData = anNinhMap.get(u.id);
        const actualGuards = anData ? (anData.tong_bv || (Number(anData.bv_noi_bo || 0) + Number(anData.bv_dich_vu || 0))) : 0;

        const popupHtml = `
          <div class="p-2 font-sans text-slate-800 w-[350px] sm:w-[390px] space-y-2">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
              <div class="font-black text-sm text-[#005698] leading-tight pr-1">${u.ten_don_vi}</div>
              <span class="text-[10px] font-black px-2 py-0.5 rounded bg-blue-50 text-[#005698] border border-blue-200/80 shrink-0 select-none">
                ${u.loai_hinh}
              </span>
            </div>

            <!-- KHỐI 1: THÔNG TIN ĐƠN VỊ (Mini-card Slate) -->
            <div class="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-[11px]">
              <div class="font-bold text-[#005698] text-[11.5px] border-b border-slate-200/60 pb-1 flex items-center justify-between">
                <span>🏢 Thông tin đơn vị</span>
                <span class="text-[10px] font-normal text-slate-500 leading-tight text-right max-w-[180px]" title="${u.dia_chi || ''}">📍 ${u.dia_chi || 'Chưa cập nhật'}</span>
              </div>

              <!-- Dòng 1: Lãnh đạo - SĐT -->
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-500 font-medium shrink-0">👤 Lãnh đạo:</span>
                <span class="font-bold text-slate-800 text-right leading-tight">${leaderName} ${leaderPhone !== '---' ? `<span class="text-[#005698] font-semibold text-[10.5px]">(${leaderPhone})</span>` : ''}</span>
              </div>

              <!-- Dòng 2: Diện tích - số cổng -->
              <div class="grid grid-cols-2 gap-2 border-t border-slate-200/40 pt-1 text-[11px]">
                <div class="flex justify-between items-center"><span class="text-slate-500 font-medium">📐 Diện tích:</span> <strong class="text-emerald-700 font-black">${dienTichFormatted}</strong></div>
                <div class="flex justify-between items-center"><span class="text-slate-500 font-medium">🚪 Số cổng:</span> <strong class="text-slate-800 font-bold">${u.so_cong || '---'}</strong></div>
              </div>

              <!-- Dòng 3: Quy mô tầng hầm -->
              <div class="flex items-center justify-between border-t border-slate-200/40 pt-1 text-[11px]">
                <span class="text-slate-500 font-medium shrink-0">🏗️ Quy mô:</span>
                <span class="font-bold text-slate-800 text-right leading-tight">${quyMoText}</span>
              </div>

              <!-- Dòng 4: Lượt khách BQ - Tổng CB-NV -->
              <div class="grid grid-cols-2 gap-2 border-t border-slate-200/40 pt-1 text-[11px]">
                <div class="flex justify-between items-center"><span class="text-slate-500 font-medium">🚗 Khách BQ:</span> <strong class="text-slate-800 font-bold">${luotKhachText}</strong></div>
                <div class="flex justify-between items-center"><span class="text-slate-500 font-medium">👥 CB-NV:</span> <strong class="text-blue-900 font-black">${totalStaff} NS</strong></div>
              </div>
            </div>

            <!-- KHỐI 2: AN-BV & PHƯƠNG ÁN (Mini-card Blue) -->
            <div class="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100/90 text-[11px] space-y-1.5">
              <div class="font-bold text-[#005698] text-[11.5px] border-b border-blue-100 pb-1">
                <span>🛡️ AN-BV & Phương Án Giám Sát</span>
              </div>

              ${anData ? `
                <!-- Dòng 1: AN-BV : 4 Định biên / 4 Hiện hữu - 3 Nội bộ + 1 Dịch vụ & Ca ngày - Ca đêm -->
                <div class="space-y-1 text-[10.5px]">
                  <div class="font-bold text-slate-800 flex items-center justify-between flex-wrap gap-1">
                    <span>AN-BV: <strong class="text-blue-900">${anData.dinh_bien_bv || 0} Định biên / ${actualGuards} Hiện hữu</strong></span>
                    <span class="text-[#005698] bg-white px-2 py-0.5 rounded border border-blue-200 text-[10px] font-bold">${anData.bv_noi_bo || 0} Nội bộ + ${anData.bv_dich_vu || 0} Dịch vụ ${anData.ncc_dich_vu ? `(${anData.ncc_dich_vu})` : ''}</span>
                  </div>
                  <div class="flex items-center justify-between text-[10px] text-slate-700 bg-white/80 px-2 py-1 rounded border border-blue-100/80">
                    <span>☀️ Ca ngày: <strong class="text-slate-900 font-bold">${anData.ngay_co_dinh || 0} Cố định / ${anData.ngay_tuan_tra || 0} Tuần tra</strong></span>
                    <span class="text-slate-300">|</span>
                    <span>🌙 Ca đêm: <strong class="text-slate-900 font-bold">${anData.dem_co_dinh || 0} Cố định / ${anData.dem_tuan_tra || 0} Tuần tra</strong></span>
                  </div>
                </div>

                <!-- Dòng 2: Tiếp giáp địa bàn thể hiện đầy đủ 100% không bị ba chấm -->
                <div class="border-t border-blue-100/80 pt-1 text-[10.5px] space-y-1">
                  <div class="font-bold text-slate-700 flex items-center justify-between">
                    <span>🧭 Tiếp giáp địa bàn:</span>
                  </div>
                  <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] bg-white/80 p-2 rounded-lg border border-blue-100/80 leading-snug">
                    <div class="space-y-0.5"><span class="text-slate-500 font-medium block">• Trước:</span> <strong class="text-slate-800 font-semibold break-words">${anData.tiep_giap_truoc || '---'}</strong></div>
                    <div class="space-y-0.5"><span class="text-slate-500 font-medium block">• Sau:</span> <strong class="text-slate-800 font-semibold break-words">${anData.tiep_giap_sau || '---'}</strong></div>
                    <div class="space-y-0.5"><span class="text-slate-500 font-medium block">• Trái:</span> <strong class="text-slate-800 font-semibold break-words">${anData.tiep_giap_trai || '---'}</strong></div>
                    <div class="space-y-0.5"><span class="text-slate-500 font-medium block">• Phải:</span> <strong class="text-slate-800 font-semibold break-words">${anData.tiep_giap_phai || '---'}</strong></div>
                  </div>
                </div>

                <!-- Dòng 3: Camera: hoạt động/hư hỏng -->
                <div class="border-t border-blue-100/80 pt-1 text-[10.5px] flex items-center justify-between">
                  <span class="text-slate-500 font-medium">📹 Camera (${anData.sl_camera || 0} mắt):</span>
                  <span class="font-bold px-2 py-0.5 rounded text-[10px] ${Number(anData.camera_hu || 0) > 0 ? 'text-amber-800 bg-amber-100 border border-amber-200' : 'text-emerald-800 bg-emerald-100 border border-emerald-200'}">
                    Hoạt động tốt: ${anData.camera_hoat_dong || anData.sl_camera || 0} | Hư hỏng: ${anData.camera_hu || 0}
                  </span>
                </div>

                <!-- Dòng 4: Tình hình an ninh khu vực hiển thị đầy đủ -->
                <div class="border-t border-blue-100/80 pt-1 text-[10.5px] space-y-1">
                  <div class="text-slate-500 font-medium">🔰 Tình hình an ninh địa bàn:</div>
                  <div class="font-bold text-emerald-800 bg-white/90 border border-emerald-200/80 p-1.5 rounded-lg text-[10px] leading-snug break-words">
                    ${anData.tinh_hinh_khu_vuc || 'An ninh tốt'}
                  </div>
                </div>
              ` : `
                <div class="text-[10px] text-slate-400 italic text-center py-1">Chưa cập nhật phương án an ninh & camera</div>
              `}
            </div>

            <!-- Nút Thao tác Nhanh phụ thuộc Tab đang chọn -->
            <div class="pt-1 border-t border-slate-200/80 flex gap-2">
              ${activeTab === 'distance' ? `
                <button data-unit-id="${u.id}" class="btn-add-distance w-full py-1.5 bg-[#005698] hover:bg-blue-800 text-white rounded-lg font-bold text-[10.5px] flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer">
                  + THÊM VÀO CHUỖI KHOẢNG CÁCH
                </button>
              ` : activeTab === 'route' ? `
                <button data-unit-id="${u.id}" class="btn-add-route w-full py-1.5 bg-[#005698] hover:bg-blue-800 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer">
                  + CHỌN LÀM ĐIỂM GHÉ THĂM
                </button>
              ` : `
                <div class="text-[10px] text-slate-400 font-medium text-center w-full">💡 Bấm marker để chọn tuyến đi / điểm dừng chân</div>
              `}
            </div>
          </div>
        `;

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(isSelected, u.ten_don_vi, u.loai_hinh)
      })
        .addTo(mapRef.current!)
        .bindPopup(popupHtml, {
          maxWidth: 480,
          minWidth: 380,
          className: 'custom-showroom-popup'
        });

      // Lắng nghe sự kiện click marker trực tiếp trên bản đồ
      marker.on('click', () => {
        setSelectedUnitId(u.id);

        if (activeTab === 'distance') {
          setDistancePoints(prev => {
            if (!prev.includes(u.id)) {
              toast.success(`Đã thêm "${u.ten_don_vi}" vào chuỗi khoảng cách!`);
              return [...prev, u.id];
            } else {
              toast.info(`"${u.ten_don_vi}" đã có trong chuỗi khoảng cách.`);
              return prev;
            }
          });
          setCalculatedRoadDistance(null);
          setErrorMessage(null);
        } else if (activeTab === 'route') {
          setWaypointSelections(prev => {
            if (!prev[u.id]) {
              toast.success(`Đã chọn "${u.ten_don_vi}" làm điểm ghé thăm!`);
              return { ...prev, [u.id]: true };
            } else {
              toast.info(`"${u.ten_don_vi}" đã được chọn làm điểm ghé thăm.`);
              return prev;
            }
          });
          setCalculatedRoadDistance(null);
          setCalculatedBirdDistance(null);
        }
      });

      markersRef.current[u.id] = marker;
    });
  }, [validUnits, personnel, isOpen, selectedUnitId, activeTab, selectedTypes, centerUnitId, anNinhMap]);

  // 6. Camera bay mượt (flyTo) đến showroom được chọn và mở popup
  useEffect(() => {
    if (!mapRef.current || !selectedUnitId || !isOpen || selectedUnitId === 'ALL') return;

    const unit = validUnits.find(u => u.id === selectedUnitId);
    if (!unit) return;

    const lat = parseFloat(unit.vi_do);
    const lng = parseFloat(unit.kinh_do);

    mapRef.current.flyTo([lat, lng], 13, {
      animate: true,
      duration: 1.2
    });

    const marker = markersRef.current[selectedUnitId];
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 500);
    }
  }, [selectedUnitId, validUnits, isOpen]);

  // ==========================================
  // TAB 1: ĐỘ PHỦ (COVERAGE RANGE)
  // ==========================================

  // Vẽ hình tròn bán kính
  useEffect(() => {
    if (!mapRef.current || !isOpen || activeTab !== 'coverage' || !isCoverageActive) {
      if (coverageCircleRef.current) {
        coverageCircleRef.current.remove();
        coverageCircleRef.current = null;
      }
      return;
    }

    // Khởi tạo FeatureGroup nếu chưa có
    if (!coverageCircleRef.current) {
      coverageCircleRef.current = L.featureGroup().addTo(mapRef.current);
    } else {
      coverageCircleRef.current.clearLayers();
    }

    if (centerUnitId === 'ALL') {
      // Chế độ "Tất cả đơn vị": vẽ vòng tròn độ phủ cho toàn bộ showroom được lọc
      const activeUnits = validUnits.filter(u => isUnitTypeSelected(u.loai_hinh, selectedTypes));
      activeUnits.forEach(u => {
        const lat = parseFloat(u.vi_do);
        const lng = parseFloat(u.kinh_do);
        L.circle([lat, lng], {
          radius: radius * 1000,
          color: '#005698',
          fillColor: '#005698',
          fillOpacity: 0.08, // Mờ hơn để tránh chồng lấn gây tối bản đồ
          weight: 1
        }).addTo(coverageCircleRef.current!);
      });
    } else {
      // Chế độ vẽ một tâm cụ thể
      const centerUnit = validUnits.find(u => u.id === centerUnitId);
      if (centerUnit) {
        const lat = parseFloat(centerUnit.vi_do);
        const lng = parseFloat(centerUnit.kinh_do);
        L.circle([lat, lng], {
          radius: radius * 1000,
          color: '#005698',
          fillColor: '#005698',
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(coverageCircleRef.current!);
      }
    }
  }, [centerUnitId, radius, validUnits, isOpen, activeTab, isCoverageActive, selectedTypes]);

  // Tính các showroom nằm trong bán kính (hoặc danh sách lọc nếu chọn Tất cả đơn vị)
  const unitsInRadius = useMemo(() => {
    if (activeTab !== 'coverage') return [];

    if (centerUnitId === 'ALL') {
      // Chế độ "Tất cả đơn vị": Trả về toàn bộ các showroom đã lọc, hiển thị theo định dạng hierarchy
      return hierarchicalOptions
        .filter(item => isUnitTypeSelected(item.unit.loai_hinh, selectedTypes))
        .map(item => ({ unit: item.unit, distance: -1, prefix: item.prefix }));
    }

    const centerUnit = validUnits.find(u => u.id === centerUnitId);
    if (!centerUnit) return [];

    const latCenter = parseFloat(centerUnit.vi_do);
    const lngCenter = parseFloat(centerUnit.kinh_do);

    return validUnits
      .filter(u => u.id !== centerUnitId && isUnitTypeSelected(u.loai_hinh, selectedTypes)) // Lọc theo bộ lọc loại hình showroom
      .map(u => {
        const d = getHaversineDistance(latCenter, lngCenter, parseFloat(u.vi_do), parseFloat(u.kinh_do));
        return { unit: u, distance: d, prefix: '' };
      })
      .filter(item => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }, [centerUnitId, radius, validUnits, activeTab, selectedTypes, hierarchicalOptions]);

  // Căn chỉnh bản đồ khớp bán kính vòng tròn
  const fitCoverageBounds = () => {
    if (mapRef.current && coverageCircleRef.current && coverageCircleRef.current.getLayers().length > 0) {
      mapRef.current.fitBounds(coverageCircleRef.current.getBounds(), {
        padding: [30, 30],
        maxZoom: centerUnitId === 'ALL' ? 6 : 14
      });
    }
  };

  // Cập nhật bán kính khi dừng kéo slider
  const handleRadiusSliderRelease = () => {
    setRadius(tempRadius);
    setTimeout(() => {
      fitCoverageBounds();
    }, 100);
  };

  // ==========================================
  // TAB 2: KHOẢNG CÁCH CHUỖI ĐIỂM
  // ==========================================

  // Tổng khoảng cách đường chim bay
  const birdDistanceTotal = useMemo(() => {
    if (distancePoints.length < 2 || activeTab !== 'distance') return 0;
    let total = 0;
    for (let i = 0; i < distancePoints.length - 1; i++) {
      const u1 = validUnits.find(u => u.id === distancePoints[i]);
      const u2 = validUnits.find(u => u.id === distancePoints[i + 1]);
      if (u1 && u2) {
        total += getHaversineDistance(
          parseFloat(u1.vi_do), parseFloat(u1.kinh_do),
          parseFloat(u2.vi_do), parseFloat(u2.kinh_do)
        );
      }
    }
    return total;
  }, [distancePoints, validUnits, activeTab]);

  // Vẽ nét đứt đường chim bay nối các điểm
  useEffect(() => {
    if (!mapRef.current || !isOpen || activeTab !== 'distance') {
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      return;
    }

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (distancePoints.length < 2) return;

    const latlngs = distancePoints
      .map(id => validUnits.find(u => u.id === id))
      .filter((u): u is DonVi => !!u)
      .map(u => [parseFloat(u.vi_do), parseFloat(u.kinh_do)] as L.LatLngExpression);

    routePolylineRef.current = L.polyline(latlngs, {
      color: '#3B82F6',
      weight: 3,
      dashArray: '6, 12'
    }).addTo(mapRef.current);

    mapRef.current.fitBounds(routePolylineRef.current.getBounds(), {
      padding: [40, 40]
    });
  }, [distancePoints, validUnits, activeTab, isOpen]);

  // Gọi OSRM API tính khoảng cách đường thực tế cho chuỗi điểm
  const handleCalculateRealDistance = async () => {
    if (distancePoints.length < 2) return;
    setIsLoadingRoad(true);
    setErrorMessage(null);
    setCalculatedRoadDistance(null);

    const coords = distancePoints
      .map(id => validUnits.find(u => u.id === id))
      .filter((u): u is DonVi => !!u)
      .map(u => `${u.kinh_do},${u.vi_do}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5 giây timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Máy chủ định tuyến phản hồi mã lỗi: ${res.status}`);
      }

      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setCalculatedRoadDistance(route.distance / 1000);

        if (routePolylineRef.current) {
          routePolylineRef.current.remove();
        }

        const routeCoords = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression);
        routePolylineRef.current = L.polyline(routeCoords, {
          color: '#10B981',
          weight: 4
        }).addTo(mapRef.current!);

        mapRef.current!.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
      } else {
        throw new Error('OSRM API không tìm thấy tuyến đường bộ thích hợp.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.name === 'AbortError'
          ? 'Hết thời gian kết nối tới máy chủ tính tuyến OSRM.'
          : 'Không thể tính toán khoảng cách thực tế (giới hạn lượt truy cập OSRM). Đang hiển thị khoảng cách chim bay ước tính.'
      );
    } finally {
      setIsLoadingRoad(false);
    }
  };

  // ==========================================
  // TAB 3: LỘ TRÌNH TỐI ƯU (TSP NEAREST NEIGHBOR)
  // ==========================================

  // Lọc các showroom có thể ghé thăm (loại trừ điểm xuất phát)
  const waypointOptions = useMemo(() => {
    return validUnits.filter(u => u.id !== startUnitId);
  }, [validUnits, startUnitId]);

  // Click chọn/bỏ chọn điểm ghé thăm
  const handleToggleWaypoint = (id: string) => {
    setWaypointSelections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Chạy thuật toán "Người láng giềng gần nhất"
  const handleOptimizeRoute = async () => {
    const selectedWaypoints = Object.keys(waypointSelections).filter(id => waypointSelections[id]);
    if (!startUnitId || selectedWaypoints.length === 0) return;

    setIsLoadingRoad(true);
    setErrorMessage(null);
    setCalculatedRoadDistance(null);
    setCalculatedBirdDistance(null);

    const startUnit = validUnits.find(u => u.id === startUnitId);
    if (!startUnit) {
      setIsLoadingRoad(false);
      return;
    }

    // Thuật toán Nearest Neighbor dùng khoảng cách Haversine
    const unvisited = [...selectedWaypoints];
    const routeIds: string[] = [startUnitId];
    let currentLat = parseFloat(startUnit.vi_do);
    let currentLng = parseFloat(startUnit.kinh_do);
    let totalBird = 0;

    while (unvisited.length > 0) {
      let nearestIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const u = validUnits.find(item => item.id === unvisited[i]);
        if (u) {
          const dist = getHaversineDistance(currentLat, currentLng, parseFloat(u.vi_do), parseFloat(u.kinh_do));
          if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = i;
          }
        }
      }

      if (nearestIndex !== -1) {
        const nextId = unvisited[nearestIndex];
        routeIds.push(nextId);
        totalBird += minDistance;

        const nextUnit = validUnits.find(item => item.id === nextId)!;
        currentLat = parseFloat(nextUnit.vi_do);
        currentLng = parseFloat(nextUnit.kinh_do);

        unvisited.splice(nearestIndex, 1);
      } else {
        break;
      }
    }

    setOptimizedOrder(routeIds);
    setCalculatedBirdDistance(totalBird);

    // Vẽ nét đứt tạm thời
    if (routePolylineRef.current) routePolylineRef.current.remove();
    const latlngs = routeIds
      .map(id => validUnits.find(u => u.id === id))
      .filter((u): u is DonVi => !!u)
      .map(u => [parseFloat(u.vi_do), parseFloat(u.kinh_do)] as L.LatLngExpression);

    routePolylineRef.current = L.polyline(latlngs, {
      color: '#8B5CF6',
      weight: 3,
      dashArray: '6, 12'
    }).addTo(mapRef.current!);
    mapRef.current!.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });

    // Gọi OSRM định tuyến thực tế cho lộ trình đã sắp xếp
    const coords = routeIds
      .map(id => validUnits.find(u => u.id === id))
      .filter((u): u is DonVi => !!u)
      .map(u => `${u.kinh_do},${u.vi_do}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`OSRM lỗi: ${res.status}`);

      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setCalculatedRoadDistance(route.distance / 1000);

        if (routePolylineRef.current) {
          routePolylineRef.current.remove();
        }

        const routeCoords = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression);
        routePolylineRef.current = L.polyline(routeCoords, {
          color: '#8B5CF6',
          weight: 4
        }).addTo(mapRef.current!);

        mapRef.current!.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
      } else {
        throw new Error('OSRM API trả kết quả trống.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Không thể tải tuyến đường bộ thực tế (OSRM giới hạn). Lộ trình đề xuất hiện dựa trên đường chim bay.');
    } finally {
      setIsLoadingRoad(false);
    }
  };

  const handleResetRouteTab = () => {
    setWaypointSelections({});
    setOptimizedOrder([]);
    setCalculatedRoadDistance(null);
    setCalculatedBirdDistance(null);
    setErrorMessage(null);
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
  };

  // ==========================================
  // DỌN DẸP KHI CHUYỂN TAB
  // ==========================================
  const handleTabChange = (tab: 'coverage' | 'distance' | 'route') => {
    setActiveTab(tab);
    setErrorMessage(null);
    setCalculatedRoadDistance(null);
    setCalculatedBirdDistance(null);

    // Xóa polyline hoặc circle hiện có để bản đồ sạch
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (coverageCircleRef.current) {
      coverageCircleRef.current.remove();
      coverageCircleRef.current = null;
    }

    if (tab === 'distance') {
      setDistancePoints(selectedUnitId ? [selectedUnitId] : []);
    } else if (tab === 'route') {
      if (selectedUnitId) {
        setStartUnitId(selectedUnitId);
      }
      setWaypointSelections({});
      setOptimizedOrder([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* CSS tùy chỉnh Popup Leaflet bọc vừa khít với bảng nội dung */}
      <style>{`
        .custom-showroom-popup .leaflet-popup-content-wrapper {
          padding: 4px !important;
          border-radius: 18px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          background: #ffffff !important;
          border: 1px solid rgba(226, 232, 240, 0.9) !important;
        }
        .custom-showroom-popup .leaflet-popup-content {
          margin: 6px 8px !important;
          width: auto !important;
          max-width: 400px !important;
        }
        .custom-showroom-popup a.leaflet-popup-close-button {
          top: 10px !important;
          right: 10px !important;
          padding: 4px !important;
          color: #64748b !important;
          font-size: 16px !important;
        }
        .custom-showroom-popup .leaflet-popup-tip-container {
          margin-top: -1px !important;
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full h-full max-w-7xl flex flex-col overflow-hidden relative">

        {/* Nút đóng modal */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow hover:bg-slate-50 transition-all cursor-pointer"
          title="Đóng bản đồ (Esc)"
        >
          <X size={18} />
        </button>

        {/* Tiêu đề & Thông tin cơ bản */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-[#05469B]/10 rounded-lg text-[#05469B]">
            <Navigation size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sơ đồ mạng lưới & Lộ trình Showroom</h2>
            <p className="text-[11px] text-slate-500 font-medium">Phân tích mật độ bán kính, tính toán chuỗi khoảng cách và sắp xếp lộ trình tối ưu</p>
          </div>
        </div>

        {/* Khung nội dung 2 cột */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* CỘT TRÁI: BẢNG ĐIỀU KHIỂN */}
          <div className="w-full md:w-[400px] border-r border-slate-100 flex flex-col bg-slate-50 overflow-y-auto">

            {/* Header Tabs theo phong cách FlyonUI với active background indicator trượt mượt mà */}
            <div className="p-2 bg-white sticky top-0 z-10 shrink-0 border-b border-slate-200">
              <div className="relative flex bg-slate-100 rounded-xl p-1 w-full border border-slate-200/60 select-none">
                {/* Active Indicator trượt mượt mà */}
                <div
                  className="absolute top-1 bottom-1 left-1 bg-[#005698] rounded-lg transition-all duration-300 ease-in-out shadow-sm"
                  style={{
                    width: 'calc(33.333% - 2.66px)',
                    transform: `translateX(${activeTab === 'coverage' ? '0%' : activeTab === 'distance' ? '100.5%' : '201%'
                      })`
                  }}
                />

                <button
                  type="button"
                  onClick={() => handleTabChange('coverage')}
                  className={`relative z-10 flex-1 py-2 text-xs font-black uppercase flex items-center justify-center gap-1.5 rounded-lg transition-colors duration-300 cursor-pointer ${activeTab === 'coverage' ? 'text-white' : 'text-slate-500 hover:text-[#005698] hover:bg-transparent'
                    }`}
                >
                  <Layers size={13} />
                  Độ phủ
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('distance')}
                  className={`relative z-10 flex-1 py-2 text-xs font-black uppercase flex items-center justify-center gap-1.5 rounded-lg transition-colors duration-300 cursor-pointer ${activeTab === 'distance' ? 'text-white' : 'text-slate-500 hover:text-[#005698] hover:bg-transparent'
                    }`}
                >
                  <Compass size={13} />
                  Khoảng cách
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('route')}
                  className={`relative z-10 flex-1 py-2 text-xs font-black uppercase flex items-center justify-center gap-1.5 rounded-lg transition-colors duration-300 cursor-pointer ${activeTab === 'route' ? 'text-white' : 'text-slate-500 hover:text-[#005698] hover:bg-transparent'
                    }`}
                >
                  <Navigation size={13} />
                  Tuyến tối ưu
                </button>
              </div>
            </div>

            {/* Nội dung cụ thể từng Tab */}
            <div className="p-4 flex-1 space-y-4">

              {/* ==================== TAB 1: ĐỘ PHỦ ==================== */}
              {activeTab === 'coverage' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                    <label className="block text-xs font-black uppercase text-slate-500">Chọn tâm đo độ phủ:</label>
                    <select
                      value={centerUnitId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCenterUnitId(val);
                        setSelectedUnitId(val);
                        if (val === 'ALL') {
                          setTimeout(() => {
                            fitCoverageBounds();
                          }, 200);
                        }
                      }}
                      className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-200 bg-[#FFFFF0] text-gray-700 focus:outline-none focus:border-[#005698] focus:ring-1 focus:ring-[#005698]"
                    >
                      <option value="ALL">🌐 Tất cả đơn vị</option>
                      {hierarchicalOptions.map(({ unit, prefix }) => (
                        <option key={unit.id} value={unit.id}>
                          {prefix.replace(/\s/g, '\u00A0')}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Switch toggle bật/tắt vẽ vòng tròn độ phủ */}
                  <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                    <span className="text-xs font-bold text-slate-700">Hiển thị độ phủ bán kính:</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isCoverageActive}
                        onChange={(e) => setIsCoverageActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005698]"></div>
                    </label>
                  </div>

                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase text-slate-500">Bán kính quét:</label>
                      <span className="text-sm font-black text-white bg-[#005698] px-2 py-0.5 rounded-md shadow-sm">{tempRadius} km</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={tempRadius}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setTempRadius(val);
                        if (coverageCircleRef.current) {
                          coverageCircleRef.current.setRadius(val * 1000);
                        }
                      }}
                      onMouseUp={handleRadiusSliderRelease}
                      onTouchEnd={handleRadiusSliderRelease}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#005698]"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>1 km</span>
                      <span>15 km</span>
                      <span>30 km</span>
                    </div>
                  </div>

                  {/* Bộ lọc loại hình đơn vị tự động */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm space-y-2.5">
                    <label className="block text-xs font-black uppercase text-slate-500">Lọc loại hình showroom:</label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold text-slate-700">
                      {/* Cột 1 */}
                      <div className="flex flex-col gap-2.5">
                        {[
                          ['Tổng Công ty'], 
                          ['Công ty Tỉnh thành'], 
                          ['Văn phòng Công ty', 'Văn phòng', 'VP Công ty'], 
                          ['Showroom Quản trị'], 
                          ['Showroom']
                        ]
                          .map(aliases => aliases.map(k => allAvailableTypes.find(t => t.toLowerCase() === k.toLowerCase())).find(Boolean))
                          .filter((t): t is string => !!t)
                          .map(type => (
                            <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!selectedTypes[type]}
                                onChange={(e) => setSelectedTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                                className="w-3.5 h-3.5 accent-[#005698] cursor-pointer rounded"
                              />
                              <span className="truncate">{getUnitEmoji(type)} {type}</span>
                            </label>
                          ))}
                      </div>
                      {/* Cột 2 */}
                      <div className="flex flex-col gap-2.5">
                        {(() => {
                          const col1Aliases = ['Tổng Công ty', 'Công ty Tỉnh thành', 'Văn phòng Công ty', 'Văn phòng', 'VP Công ty', 'Showroom Quản trị', 'Showroom'];
                          const col2Groups = [
                            ['Xưởng Dịch vụ'], 
                            ['Điểm bán hàng', 'Điểm Kinh doanh'], 
                            ['Đại lý'], 
                            ['Kho', 'Kho xe']
                          ];
                          
                          const col2Found = col2Groups
                            .map(aliases => aliases.map(k => allAvailableTypes.find(t => t.toLowerCase() === k.toLowerCase())).find(Boolean))
                            .filter((t): t is string => !!t);
                            
                          const col2Aliases = col2Groups.flat();
                          
                          const otherTypes = allAvailableTypes.filter(t => 
                            !col1Aliases.some(k => t.toLowerCase() === k.toLowerCase()) && 
                            !col2Aliases.some(k => t.toLowerCase() === k.toLowerCase())
                          );
                          
                          return [...col2Found, ...otherTypes].map(type => (
                            <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!selectedTypes[type]}
                                onChange={(e) => setSelectedTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                                className="w-3.5 h-3.5 accent-[#005698] cursor-pointer rounded"
                              />
                              <span className="truncate">{getUnitEmoji(type)} {type}</span>
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Danh sách đơn vị nằm trong bán kính */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-600 flex items-center gap-1.5">
                      {centerUnitId === 'ALL'
                        ? `Danh sách đơn vị lọc được (${isCoverageActive ? unitsInRadius.length : 0})`
                        : `Đơn vị lân cận (${isCoverageActive ? unitsInRadius.length : 0})`
                      }
                    </h4>

                    {!isCoverageActive ? (
                      <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                        Độ phủ bán kính đang tắt. Bật switch ở trên để xem.
                      </div>
                    ) : unitsInRadius.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                        {centerUnitId === 'ALL'
                          ? "Không có showroom nào thuộc loại hình được lọc"
                          : `Không có showroom nào khác trong bán kính ${radius}km`
                        }
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                        {unitsInRadius.map(item => (
                          <div
                            key={item.unit.id}
                            onClick={() => setSelectedUnitId(item.unit.id)}
                            className="bg-white hover:bg-slate-100 border border-slate-200/60 p-2.5 rounded-lg flex justify-between items-center cursor-pointer shadow-sm transition-all"
                          >
                            <div className="min-w-0 pr-2 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {item.prefix && (
                                  <span className="text-xs font-mono text-slate-300 whitespace-pre select-none shrink-0">
                                    {item.prefix.replace(/\s/g, '\u00A0')}
                                  </span>
                                )}
                                <span className="text-xs shrink-0">{getUnitEmoji(item.unit.loai_hinh)}</span>
                                <p className="text-xs font-black text-slate-800 truncate flex-1">{item.unit.ten_don_vi}</p>
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-[#005698] border border-blue-100/60 shrink-0 select-none">
                                  {item.unit.loai_hinh}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate mt-1">{item.unit.dia_chi}</p>
                            </div>
                            {item.distance >= 0 && (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-md shrink-0">
                                {item.distance.toFixed(1)} km
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== TAB 2: KHOẢNG CÁCH CHUỖI ĐIỂM ==================== */}
              {activeTab === 'distance' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-500">Chuỗi showroom tuyến đi ({distancePoints.length}):</h4>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {distancePoints.map((pointId, index) => {
                        const unit = validUnits.find(u => u.id === pointId);
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-black text-slate-600 flex items-center justify-center border border-slate-200 shrink-0">
                              {index + 1}
                            </span>
                            <select
                              value={pointId}
                              onChange={(e) => {
                                const newPoints = [...distancePoints];
                                newPoints[index] = e.target.value;
                                setDistancePoints(newPoints);
                              }}
                              className="flex-1 text-xs font-bold p-2 border border-slate-200 bg-[#FFFFF0] text-gray-700 rounded-lg focus:outline-none focus:border-[#005698]"
                            >
                              {hierarchicalOptions.map(({ unit, prefix }) => (
                                <option key={unit.id} value={unit.id}>
                                  {prefix.replace(/\s/g, '\u00A0')}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                                </option>
                              ))}
                            </select>
                            {distancePoints.length > 1 && (
                              <button
                                onClick={() => {
                                  const newPoints = distancePoints.filter((_, idx) => idx !== index);
                                  setDistancePoints(newPoints);
                                  setCalculatedRoadDistance(null);
                                  setErrorMessage(null);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                title="Xóa điểm này"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        if (validUnits.length > 0) {
                          setDistancePoints([...distancePoints, validUnits[0].id]);
                          setCalculatedRoadDistance(null);
                        }
                      }}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-[#005698] text-xs font-bold rounded-lg border border-dashed border-[#005698]/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      + THÊM ĐIỂM DỪNG CHÂN
                    </button>
                  </div>

                  {distancePoints.length >= 2 && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm space-y-3.5">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>Khoảng cách chim bay:</span>
                          <span className="font-bold text-slate-800">{birdDistanceTotal.toFixed(1)} km</span>
                        </div>
                        {calculatedRoadDistance !== null && (
                          <div className="flex justify-between text-xs font-semibold text-slate-500 border-t border-slate-50 pt-1.5">
                            <span>Khoảng cách thực tế (OSRM):</span>
                            <span className="font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                              {calculatedRoadDistance.toFixed(1)} km
                            </span>
                          </div>
                        )}
                      </div>

                      {errorMessage && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700 font-semibold flex gap-1.5">
                          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                          <p>{errorMessage}</p>
                        </div>
                      )}

                      <button
                        onClick={handleCalculateRealDistance}
                        disabled={isLoadingRoad}
                        className="w-full py-2.5 bg-[#005698] text-white hover:bg-blue-850 font-bold text-xs rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isLoadingRoad ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            ĐANG TÍNH ĐƯỜNG ĐI...
                          </>
                        ) : (
                          'TÍNH KHOẢNG CÁCH THỰC TẾ'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== TAB 3: LỘ TRÌNH TỐI ƯU ==================== */}
              {activeTab === 'route' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Điểm xuất phát:</label>
                      <select
                        value={startUnitId}
                        onChange={(e) => {
                          setStartUnitId(e.target.value);
                          handleResetRouteTab();
                        }}
                        className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-200 bg-[#FFFFF0] text-gray-700 focus:outline-none focus:border-[#005698]"
                      >
                        {hierarchicalOptions.map(({ unit, prefix }) => (
                          <option key={unit.id} value={unit.id}>
                            {prefix.replace(/\s/g, '\u00A0')}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-black uppercase text-slate-500">Các điểm ghé thăm:</label>
                        <button
                          onClick={handleResetRouteTab}
                          className="text-[10px] text-slate-400 hover:text-red-500 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <RotateCcw size={10} /> Đặt lại
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-lg max-h-[180px] overflow-y-auto p-2 bg-slate-50 space-y-1.5">
                        {hierarchicalOptions
                          .filter(({ unit }) => unit.id !== startUnitId)
                          .map(({ unit, prefix }) => (
                            <label key={unit.id} className="flex items-start gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer select-none whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={!!waypointSelections[unit.id]}
                                onChange={() => handleToggleWaypoint(unit.id)}
                                className="mt-0.5 accent-[#005698] cursor-pointer"
                              />
                              <span className="font-mono text-slate-400">{prefix.replace(/\s/g, '\u00A0')}</span>
                              <span>{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}</span>
                            </label>
                          ))}
                      </div>
                    </div>

                    <button
                      onClick={handleOptimizeRoute}
                      disabled={isLoadingRoad || Object.values(waypointSelections).filter(Boolean).length === 0}
                      className="w-full py-2.5 bg-[#005698] text-white hover:bg-blue-850 font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingRoad ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          ĐANG TỐI ƯU...
                        </>
                      ) : (
                        'TÌM LỘ TRÌNH TỐI ƯU CHUNG'
                      )}
                    </button>
                  </div>

                  {optimizedOrder.length > 0 && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm space-y-3 animate-in slide-in-from-bottom duration-300">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-slate-700 uppercase">Thứ tự ghé khuyên dùng:</span>
                        <div className="text-right">
                          {calculatedRoadDistance !== null ? (
                            <p className="text-xs font-black text-emerald-600">Thực tế: {calculatedRoadDistance.toFixed(1)} km</p>
                          ) : (
                            calculatedBirdDistance !== null && (
                              <p className="text-xs font-black text-[#005698]">Ước tính: {calculatedBirdDistance.toFixed(1)} km</p>
                            )
                          )}
                        </div>
                      </div>

                      {errorMessage && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[9px] text-amber-700 font-semibold leading-relaxed">
                          {errorMessage}
                        </div>
                      )}

                      <div className="relative pl-4 space-y-3.5 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                        {optimizedOrder.map((id, index) => {
                          const unit = validUnits.find(u => u.id === id);
                          if (!unit) return null;
                          return (
                            <div key={id} className="relative flex items-center justify-between gap-2">
                              <span className={`absolute -left-[14px] w-[12px] h-[12px] rounded-full border-2 ${index === 0 ? 'bg-red-500 border-red-200' : 'bg-purple-600 border-purple-200'
                                }`} />
                              <div className="min-w-0 flex-1 pl-2">
                                <p className="text-[11px] font-black text-slate-800 truncate leading-none">{unit.ten_don_vi}</p>
                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5 truncate">{unit.dia_chi}</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-1 py-0.5 rounded">
                                {index === 0 ? 'Xuất phát' : `Ghé ${index}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== ĐƠN VỊ THIẾU TỌA ĐỘ ==================== */}
              {invalidUnits.length > 0 && (
                <div className="mt-4 border-t border-slate-200/80 pt-4">
                  <details className="group">
                    <summary className="flex items-center justify-between text-xs font-black uppercase text-amber-600 bg-amber-50/50 hover:bg-amber-50 p-2.5 rounded-lg border border-amber-200/50 cursor-pointer select-none">
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={14} className="text-amber-500" />
                        Đơn vị thiếu tọa độ ({invalidUnits.length})
                      </span>
                      <span className="transition-transform group-open:rotate-180">▼</span>
                    </summary>
                    <div className="mt-2 space-y-1 bg-white p-2 rounded-lg border border-slate-100 max-h-[140px] overflow-y-auto">
                      {invalidUnits.map(u => (
                        <div key={u.id} className="p-1.5 hover:bg-slate-50 rounded flex justify-between items-start gap-1">
                          <span className="text-[10px] font-black text-slate-700 leading-tight">{u.ten_don_vi}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-400 font-bold uppercase py-0.5 px-1 rounded shrink-0">Chưa map</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Footer chú thích */}
            <div className="p-3.5 border-t border-slate-200 bg-white text-[10px] text-slate-400 font-bold flex gap-1.5 items-start">
              <HelpCircle size={14} className="shrink-0 text-slate-300 mt-0.5" />
              <p>Mẹo: Bạn có thể bấm thẳng vào các chấm đỏ/xanh trên bản đồ để xem thông tin chi tiết từng địa điểm.</p>
            </div>

          </div>

          {/* CỘT PHẢI: BẢN ĐỒ LEAFLET */}
          <div className="flex-1 relative bg-slate-100">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
          </div>

        </div>

      </div>
    </div>
  );
}
