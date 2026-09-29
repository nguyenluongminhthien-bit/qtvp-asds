import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2, ShieldCheck, Users, Search, GraduationCap, ChevronDown, ChevronRight,
  Calendar, Layers, Store, Award, ChevronLeft, MapPin, CheckCircle, Clock,
  Info, Sparkles, ChevronsUpDown
} from 'lucide-react';
import { DonVi } from '../../types';
import { getUnitEmoji, getAllSubordinateIds, sortDonViByThuTu, groupParentUnits } from '../../utils/hierarchy';

interface HoSoTabProps {
  filteredData?: any[];
  donViMap: Record<string, string>;
  user: any;
  onOpenModal?: (unitId: string, data?: any) => void;
  onDelete?: (id: string) => void;
  isListCollapsed: boolean;
  khoaHocList: any[];
  hocVienList: any[];
  thietBiList?: any[];
  kiemDinhList?: any[];
  onNavigateToStrictDevices?: () => void;
  donViList?: DonVi[];
  personnelList?: any[];
  selectedUnitFilter?: string | null;
  onNavigateToTraining?: () => void;
  onNavigateToHealth?: () => void;
}

// 🟢 THUẬT TOÁN BÓC TÁCH TÊN ĐỢT HUẤN LUYỆN
export const extractCampaignName = (rawName: string): string => {
  if (!rawName) return 'Khóa học chưa đặt tên';
  const name = rawName.trim();

  // Bắt mẫu: ATVSLĐ_ĐỢT 1, ĐỢT 1, ĐỢT 02, KHOÁ 1, LẦN 1...
  const dotPattern = /^(.*?([ĐD][ƠỢO]T\s*\d+|KHO[ÁA]\s*\d+|L[ẦA]N\s*\d+))/i;
  const match = name.match(dotPattern);
  if (match && match[1]) {
    return match[1].replace(/[_\-\s]+$/, '').trim();
  }

  // Tách theo dấu ngoặc đơn mở '(', ví dụ: "Huấn luyện ATVSLĐ Đợt 1 (Lớp Nhóm 3)" -> "Huấn luyện ATVSLĐ Đợt 1"
  if (name.includes('(')) {
    const prefix = name.split('(')[0].trim().replace(/[-_:]+$/, '').trim();
    if (prefix.length >= 4) return prefix;
  }

  // Tách theo dấu gạch ngang ' - '
  if (name.includes(' - ')) {
    const prefix = name.split(' - ')[0].trim();
    if (prefix.length >= 3) return prefix;
  }

  return name;
};

export default function HoSoTab({
  donViMap,
  user,
  isListCollapsed,
  khoaHocList = [],
  hocVienList = [],
  donViList = [],
  personnelList = [],
  selectedUnitFilter
}: HoSoTabProps) {
  const isAdmin = user?.quyen === 'ADMIN';

  // 🟢 Xác định đơn vị của tài khoản người dùng (hoặc đơn vị được lọc)
  const currentTargetUnitId = useMemo(() => {
    if (!isAdmin) return user?.id_don_vi || null;
    return selectedUnitFilter || user?.id_don_vi || null;
  }, [isAdmin, user?.id_don_vi, selectedUnitFilter]);

  const targetUnitFamilyIds = useMemo(() => {
    if (!currentTargetUnitId || !donViList) return [];
    const subIds = getAllSubordinateIds(currentTargetUnitId, donViList);
    return [currentTargetUnitId, ...subIds];
  }, [currentTargetUnitId, donViList]);

  // Kiểm tra 1 lớp học có thuộc đơn vị của tài khoản người dùng hay không
  const isClassOfUserUnit = useMemo(() => {
    return (cls: any) => {
      if (!targetUnitFamilyIds || targetUnitFamilyIds.length === 0) return false;
      // 1. Lớp học có id_don_vi thuộc đơn vị hoặc showroom trực thuộc
      if (cls.id_don_vi && targetUnitFamilyIds.includes(cls.id_don_vi)) return true;
      // 2. Học viên trong lớp có người thuộc đơn vị của user
      if (hocVienList && hocVienList.length > 0) {
        return hocVienList.some(hv => hv.id_khoa_hoc === cls.id && hv.id_don_vi && targetUnitFamilyIds.includes(hv.id_don_vi));
      }
      return false;
    };
  }, [targetUnitFamilyIds, hocVienList]);

  // Helper kiểm tra 1 ngày có nằm trong thời gian diễn ra của lớp học hay không
  const isDateInClass = (dateStr: string, cls: any): boolean => {
    if (!cls.ngay_bat_dau && !cls.ngay_ket_thuc) return false;
    const rawStart = cls.ngay_bat_dau || cls.ngay_ket_thuc;
    const rawEnd = cls.ngay_ket_thuc || cls.ngay_bat_dau;
    const start = String(rawStart).substring(0, 10);
    const end = String(rawEnd).substring(0, 10);
    return dateStr >= start && dateStr <= end;
  };

  // 🟢 1. GOM NHÓM CÁC ĐỢT HUẤN LUYỆN (Hiển thị đầy đủ cho mọi loại tài khoản)
  const campaignGroups = useMemo(() => {
    const groups: Record<string, {
      campaignName: string;
      classes: any[];
      totalClasses: number;
      totalDuKien: number;
      totalThucTe: number;
      totalHocVien: number;
      totalDat: number;
      totalKhongDat: number;
      minDate: string | null;
      maxDate: string | null;
      trangThai: string;
      donViDaoTaoList: string[];
    }> = {};

    khoaHocList.forEach(kh => {
      const cName = extractCampaignName(kh.ten_khoa_hoc || '');
      if (!groups[cName]) {
        groups[cName] = {
          campaignName: cName,
          classes: [],
          totalClasses: 0,
          totalDuKien: 0,
          totalThucTe: 0,
          totalHocVien: 0,
          totalDat: 0,
          totalKhongDat: 0,
          minDate: null,
          maxDate: null,
          trangThai: 'Hoàn thành',
          donViDaoTaoList: []
        };
      }

      const g = groups[cName];
      g.classes.push(kh);
      g.totalClasses += 1;
      g.totalDuKien += Number(kh.si_so_du_kien) || 0;
      g.totalThucTe += Number(kh.si_so_thuc_te) || 0;

      if (kh.don_vi_dao_tao && !g.donViDaoTaoList.includes(kh.don_vi_dao_tao)) {
        g.donViDaoTaoList.push(kh.don_vi_dao_tao);
      }

      if (kh.ngay_bat_dau) {
        if (!g.minDate || kh.ngay_bat_dau < g.minDate) g.minDate = kh.ngay_bat_dau;
      }
      if (kh.ngay_ket_thuc) {
        if (!g.maxDate || kh.ngay_ket_thuc > g.maxDate) g.maxDate = kh.ngay_ket_thuc;
      }

      if (kh.trang_thai === 'Đang diễn ra') g.trangThai = 'Đang diễn ra';
      else if (kh.trang_thai === 'Kế hoạch' && g.trangThai !== 'Đang diễn ra') g.trangThai = 'Kế hoạch';
    });

    Object.values(groups).forEach(g => {
      const courseIds = new Set(g.classes.map(c => c.id));
      const studentsInCampaign = hocVienList.filter(hv => courseIds.has(hv.id_khoa_hoc));
      g.totalHocVien = studentsInCampaign.length;

      let datCount = 0;
      studentsInCampaign.forEach(hv => {
        const kq = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
        if (kq === 'đạt' || kq === 'dat') datCount++;
      });
      g.totalDat = datCount;
      g.totalKhongDat = Math.max(0, g.totalHocVien - datCount);
    });

    return Object.values(groups).sort((a, b) => {
      const dateA = a.maxDate || a.minDate || '';
      const dateB = b.maxDate || b.minDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [khoaHocList, hocVienList]);

  // Đợt đang chọn để hiển thị trên Calendar & Gantt timeline
  const [selectedCampaignName, setSelectedCampaignName] = useState<string>('');

  // Khởi tạo chọn đợt đầu tiên
  useEffect(() => {
    if (campaignGroups.length > 0 && !selectedCampaignName) {
      setSelectedCampaignName(campaignGroups[0].campaignName);
    }
  }, [campaignGroups, selectedCampaignName]);

  const activeCampaign = useMemo(() => {
    return campaignGroups.find(g => g.campaignName === selectedCampaignName) || campaignGroups[0] || null;
  }, [campaignGroups, selectedCampaignName]);

  // 🟢 2. QUẢN LÝ CALENDAR THÁNG (RANGE HIGHLIGHT THANH LỊCH)
  const [calCurrentDate, setCalCurrentDate] = useState<Date>(new Date());

  // Khi bấm chọn Đợt $\rightarrow$ Calendar tự động nhảy theo ngày bắt đầu của đợt đó
  useEffect(() => {
    if (activeCampaign && (activeCampaign.minDate || activeCampaign.maxDate)) {
      const dateStr = activeCampaign.minDate || activeCampaign.maxDate;
      const targetDate = new Date(dateStr!);
      if (!isNaN(targetDate.getTime())) {
        setCalCurrentDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
      }
    }
  }, [selectedCampaignName]);

  const calMonthYearLabel = useMemo(() => {
    const month = String(calCurrentDate.getMonth() + 1).padStart(2, '0');
    return `Tháng ${month}/${calCurrentDate.getFullYear()}`;
  }, [calCurrentDate]);

  const handleCalPrevMonth = () => {
    setCalCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleCalNextMonth = () => {
    setCalCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCalResetToday = () => {
    setCalCurrentDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  };

  // Tính ma trận các ngày trong tháng cho Calendar với Range Highlight
  const calendarDaysMatrix = useMemo(() => {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Chuyển T2 = 0 ... CN = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const campaignMin = activeCampaign?.minDate || null;
    const campaignMax = activeCampaign?.maxDate || activeCampaign?.minDate || null;

    const days: ({
      dayNumber: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isRangeStart: boolean;
      isRangeEnd: boolean;
      isInRange: boolean;
      isActiveCourse: boolean;
      isUserUnitClass: boolean;
      userUnitClassTitle: string;
    } | null)[] = [];

    // Ô trống đầu tháng
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Các ngày trong tháng
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const isRangeStart = campaignMin ? dateStr === campaignMin : false;
      const isRangeEnd = campaignMax ? dateStr === campaignMax : false;
      const isInRange = (campaignMin && campaignMax) ? (dateStr >= campaignMin && dateStr <= campaignMax) : false;

      let isActiveCourse = false;
      if (activeCampaign) {
        isActiveCourse = activeCampaign.classes.some(cls => {
          if (!cls.ngay_bat_dau && !cls.ngay_ket_thuc) return false;
          const start = String(cls.ngay_bat_dau || cls.ngay_ket_thuc).substring(0, 10);
          const end = String(cls.ngay_ket_thuc || cls.ngay_bat_dau).substring(0, 10);
          return dateStr >= start && dateStr <= end;
        });
      }

      // 🟢 Kiểm tra ngày đơn vị của người dùng có tổ chức lớp học
      let matchingClassesForUnit = activeCampaign?.classes.filter(cls => isClassOfUserUnit(cls) && isDateInClass(dateStr, cls)) || [];
      if (matchingClassesForUnit.length === 0) {
        matchingClassesForUnit = khoaHocList.filter(cls => isClassOfUserUnit(cls) && isDateInClass(dateStr, cls));
      }

      const isUserUnitClass = matchingClassesForUnit.length > 0;
      const userUnitClassTitle = isUserUnitClass
        ? `Lớp của đơn vị bạn: ${matchingClassesForUnit.map(c => c.ten_khoa_hoc).join(', ')}`
        : '';

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
        isRangeStart,
        isRangeEnd,
        isInRange,
        isActiveCourse,
        isUserUnitClass,
        userUnitClassTitle
      });
    }

    return days;
  }, [calCurrentDate, activeCampaign, khoaHocList, isClassOfUserUnit]);

  // 🟢 3. TÍNH TOÁN DẢI 4 THẺ KPI CHUẨN
  const kpiStats = useMemo(() => {
    const totalCampaigns = campaignGroups.length;
    const totalClasses = khoaHocList.length;
    const totalDuKien = khoaHocList.reduce((acc, k) => acc + (Number(k.si_so_du_kien) || 0), 0);
    const totalThucTe = khoaHocList.reduce((acc, k) => acc + (Number(k.si_so_thuc_te) || 0), 0);
    const fillRate = totalDuKien > 0 ? Math.round((totalThucTe / totalDuKien) * 100) : 0;

    let nhom1 = 0, nhom2 = 0, nhom3 = 0, nhom4 = 0, nhom6 = 0;
    let totalDat = 0;

    hocVienList.forEach(hv => {
      const g = String(hv.nhom || '').replace(/\D/g, '');
      if (g === '1') nhom1++;
      else if (g === '2') nhom2++;
      else if (g === '3') nhom3++;
      else if (g === '4') nhom4++;
      else if (g === '6') nhom6++;

      const kq = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
      if (kq === 'đạt' || kq === 'dat') totalDat++;
    });

    const totalStudents = hocVienList.length;
    const passRate = totalStudents > 0 ? Math.round((totalDat / totalStudents) * 100) : 0;

    return {
      totalCampaigns,
      totalClasses,
      totalDuKien,
      totalThucTe,
      fillRate,
      nhomCounts: { nhom1, nhom2, nhom3, nhom4, nhom6, total: totalStudents },
      totalDat,
      totalStudents,
      passRate
    };
  }, [campaignGroups, khoaHocList, hocVienList]);

  // 🟢 4. BẢNG THỐNG KÊ TUÂN THỦ THEO CÂY ĐƠN VỊ CỦA ỨNG DỤNG
  const [expandedParentUnits, setExpandedParentUnits] = useState<Record<string, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);
  const [unitSearch, setUnitSearch] = useState('');

  // Helper tính toán số liệu tuân thủ chi tiết 5 nhóm cho 1 đơn vị
  const calcUnitCompliance = useMemo(() => {
    return (unitId: string, unitName: string, loaiHinh?: string) => {
      const hvInUnit = hocVienList.filter(hv => hv.id_don_vi === unitId);
      const tongThamDu = hvInUnit.length;
      
      let n1 = 0, n2 = 0, n3 = 0, n4 = 0, n6 = 0, totalDat = 0;
      hvInUnit.forEach(hv => {
        const g = String(hv.nhom || '').replace(/\D/g, '');
        const kq = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
        const isDat = kq === 'đạt' || kq === 'dat';

        if (isDat) {
          totalDat++;
          if (g === '1') n1++;
          else if (g === '2') n2++;
          else if (g === '3') n3++;
          else if (g === '4') n4++;
          else if (g === '6') n6++;
        }
      });

      // Tỉ lệ hoàn thành: số lượng làm bài kiểm tra kết quả Đạt / tổng số tham dự
      const completionRate = tongThamDu > 0
        ? Math.round((totalDat / tongThamDu) * 100)
        : 0;

      const status = completionRate >= 90 ? 'DAT' : (completionRate >= 70 ? 'CAN_BO_SUNG' : 'RUI_RO');

      return {
        unitId,
        unitName,
        loaiHinh,
        tongThamDu,
        n1, n2, n3, n4, n6,
        totalDat,
        completionRate,
        status
      };
    };
  }, [hocVienList]);

  // Cấu trúc phân nhóm theo cây đơn vị chuẩn ứng dụng
  const complianceTree = useMemo(() => {
    if (!donViList || donViList.length === 0) return [];

    const allUnitIds = new Set(donViList.map(u => u.id));

    // Xác định các Đơn vị Mẹ (Level 1) có kiểm tra phân quyền bảo mật
    let baseParentUnits: DonVi[] = [];

    if (!isAdmin) {
      // 🔒 TÀI KHOẢN THƯỜNG: Lấy đơn vị của user (hoặc đơn vị mẹ quản lý user)
      const myUnit = donViList.find(u => u.id === user?.id_don_vi);
      if (myUnit) {
        if (!myUnit.cap_quan_ly || myUnit.cap_quan_ly === 'HO' || !allUnitIds.has(myUnit.cap_quan_ly)) {
          baseParentUnits = [myUnit];
        } else {
          const parent = donViList.find(u => u.id === myUnit.cap_quan_ly);
          baseParentUnits = parent ? [parent] : [myUnit];
        }
      }
    } else {
      // 🔑 ADMIN: Xem toàn bộ hoặc theo bộ lọc
      if (selectedUnitFilter) {
        const selectedUnit = donViList.find(u => u.id === selectedUnitFilter);
        const children = donViList.filter(u => u.cap_quan_ly === selectedUnitFilter && u.id !== selectedUnitFilter);
        if (children.length > 0) {
          baseParentUnits = selectedUnit ? [selectedUnit] : [];
        } else {
          const parent = donViList.find(u => u.id === selectedUnit?.cap_quan_ly);
          baseParentUnits = parent ? [parent] : (selectedUnit ? [selectedUnit] : []);
        }
      } else {
        baseParentUnits = donViList.filter(u => !u.cap_quan_ly || u.cap_quan_ly === 'HO' || !allUnitIds.has(u.cap_quan_ly));
        if (baseParentUnits.length === 0) {
          const parentIdsWithChildren = new Set(donViList.map(u => u.cap_quan_ly).filter(Boolean));
          baseParentUnits = donViList.filter(u => parentIdsWithChildren.has(u.id));
        }
      }
    }

    // Nhóm theo chuẩn ứng dụng (VPĐH, CTTT Phía Nam, CTTT Phía Bắc, Đơn vị khác)
    const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = groupParentUnits(baseParentUnits);

    const buildParentData = (parentUnit: DonVi) => {
      const childShowrooms = sortDonViByThuTu(
        donViList.filter(u => u.cap_quan_ly === parentUnit.id && u.id !== parentUnit.id)
      );
      const familyIds = [parentUnit.id, ...childShowrooms.map(c => c.id)];

      // Showroom con
      const showroomDetails = childShowrooms.map(s => calcUnitCompliance(s.id, s.ten_don_vi, s.loai_hinh));

      // Lớp 1 (Tổng hợp toàn công ty: Văn phòng mẹ + các showroom con)
      const parentHv = hocVienList.filter(hv => familyIds.includes(hv.id_don_vi));
      const parentTongThamDu = parentHv.length;
      
      let pN1 = 0, pN2 = 0, pN3 = 0, pN4 = 0, pN6 = 0, pTotalDat = 0;
      parentHv.forEach(hv => {
        const g = String(hv.nhom || '').replace(/\D/g, '');
        const kq = String(hv.ket_qua || '').trim().toLowerCase().normalize('NFC');
        const isDat = kq === 'đạt' || kq === 'dat';

        if (isDat) {
          pTotalDat++;
          if (g === '1') pN1++;
          else if (g === '2') pN2++;
          else if (g === '3') pN3++;
          else if (g === '4') pN4++;
          else if (g === '6') pN6++;
        }
      });

      // Tỉ lệ hoàn thành đơn vị mẹ: số lượng làm bài kiểm tra kết quả Đạt / tổng số tham dự
      const parentCompletionRate = parentTongThamDu > 0
        ? Math.round((pTotalDat / parentTongThamDu) * 100)
        : 0;

      const parentStatus = parentCompletionRate >= 90 ? 'DAT' : (parentCompletionRate >= 70 ? 'CAN_BO_SUNG' : 'RUI_RO');

      return {
        parent: {
          unitId: parentUnit.id,
          unitName: parentUnit.ten_don_vi,
          loaiHinh: parentUnit.loai_hinh,
          tongThamDu: parentTongThamDu,
          n1: pN1, n2: pN2, n3: pN3, n4: pN4, n6: pN6,
          totalDat: pTotalDat,
          completionRate: parentCompletionRate,
          status: parentStatus,
          childCount: childShowrooms.length
        },
        showrooms: showroomDetails
      };
    };

    const sections = [
      {
        id: 'vpdh',
        title: 'Văn Phòng Điều Hành (VPĐH)',
        icon: '🏢',
        units: vpdhUnits.map(buildParentData)
      },
      {
        id: 'ctttNam',
        title: 'Công Ty Tỉnh Thành - Phía Nam',
        icon: '🏬',
        units: ctttNamUnits.map(buildParentData)
      },
      {
        id: 'ctttBac',
        title: 'Công Ty Tỉnh Thành - Phía Bắc',
        icon: '🏬',
        units: ctttBacUnits.map(buildParentData)
      },
      {
        id: 'other',
        title: 'Đơn Vị Khác',
        icon: '📍',
        units: otherUnits.map(buildParentData)
      }
    ].filter(sec => sec.units.length > 0);

    return sections;
  }, [donViList, isAdmin, user?.id_don_vi, selectedUnitFilter, calcUnitCompliance, personnelList, hocVienList]);

  // Bộ lọc tìm kiếm
  const filteredTree = useMemo(() => {
    if (!unitSearch.trim()) return complianceTree;
    const term = unitSearch.toLowerCase().trim();

    return complianceTree.map(sec => {
      const matchedUnits = sec.units.filter(u => {
        const matchParent = u.parent.unitName.toLowerCase().includes(term);
        const matchChild = u.showrooms.some(s => s.unitName.toLowerCase().includes(term));
        return matchParent || matchChild;
      });
      return { ...sec, units: matchedUnits };
    }).filter(sec => sec.units.length > 0);
  }, [complianceTree, unitSearch]);

  const toggleParentExpand = (unitId: string) => {
    setExpandedParentUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedParentUnits({});
      setIsAllExpanded(false);
    } else {
      const all: Record<string, boolean> = {};
      complianceTree.forEach(sec => {
        sec.units.forEach(u => {
          all[u.parent.unitId] = true;
        });
      });
      setExpandedParentUnits(all);
      setIsAllExpanded(true);
    }
  };

  const totalParents = useMemo(() => {
    return complianceTree.reduce((acc, sec) => acc + sec.units.length, 0);
  }, [complianceTree]);

  const totalShowrooms = useMemo(() => {
    return complianceTree.reduce((acc, sec) => {
      return acc + sec.units.reduce((sAcc, u) => sAcc + u.showrooms.length, 0);
    }, 0);
  }, [complianceTree]);

  return (
    <div className={`transition-all duration-300 ${isListCollapsed ? 'md:pl-10 lg:pl-0' : ''} space-y-6 w-full`}>
      
      {/* 🟢 KHỐI 1: DẢI 4 THẺ KPI CHUẨN (ĐỢT | SĨ SỐ | NHÓM ĐÀO TẠO | KẾT QUẢ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Đợt huấn luyện */}
        <div className="bg-white p-4 rounded-2xl border border-lime-200 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Đợt Huấn Luyện</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-lime-800">{kpiStats.totalCampaigns}</span>
              <span className="text-xs font-bold text-gray-500">Đợt</span>
            </div>
            <p className="text-[10px] text-lime-700 font-semibold flex items-center gap-1">
              <Sparkles size={11} /> Tổng cộng {kpiStats.totalClasses} Lớp học
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-lime-100 text-lime-700 flex items-center justify-center shrink-0 border border-lime-200">
            <GraduationCap size={24} />
          </div>
        </div>

        {/* 2. Sĩ số học viên */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sĩ Số Học Viên</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-700">{kpiStats.totalThucTe}</span>
              <span className="text-xs font-bold text-gray-400">/ {kpiStats.totalDuKien}</span>
            </div>
            <p className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md inline-block">
              {kpiStats.fillRate}% Lấp đầy lớp
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
            <Users size={22} />
          </div>
        </div>

        {/* 3. Nhóm đào tạo (Thống kê 5 nhóm N1, N2, N3, N4, N6) */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nhóm Đào Tạo</p>
            <span className="text-xs font-black text-emerald-700">{kpiStats.nhomCounts.total} HV</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" title="Nhóm 1: Quản lý">
              N1: {kpiStats.nhomCounts.nhom1}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" title="Nhóm 2: Cán bộ an toàn">
              N2: {kpiStats.nhomCounts.nhom2}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" title="Nhóm 3: Công việc có yêu cầu nghiêm ngặt">
              N3: {kpiStats.nhomCounts.nhom3}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" title="Nhóm 4: Phổ thông">
              N4: {kpiStats.nhomCounts.nhom4}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700" title="Nhóm 6: ATVS viên">
              N6: {kpiStats.nhomCounts.nhom6}
            </span>
          </div>
          <p className="text-[9.5px] text-gray-400 italic">Theo quy định NĐ 44/2016/NĐ-CP</p>
        </div>

        {/* 4. Kết quả đào tạo */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Kết Quả Đào Tạo</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700">{kpiStats.passRate}%</span>
              <span className="text-xs font-bold text-emerald-600">Đạt</span>
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <Award size={11} /> {kpiStats.totalDat} / {kpiStats.totalStudents} Đạt chứng nhận
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* 🟢 KHỐI 2: HOÁN ĐỔI VỊ TRÍ - DANH SÁCH ĐỢT BÊN TRÁI & CALENDAR + LỘ TRÌNH LỚP BÊN PHẢI (50/50 CHUẨN XÁC) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        
        {/* 📋 CỘT BÊN TRÁI (50%): DANH SÁCH CÁC ĐỢT HUẤN LUYỆN TINH GỌN */}
        <div className="w-full min-w-0 bg-white rounded-2xl border border-lime-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 bg-lime-50/60 border-b border-lime-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap size={18} className="text-lime-700" />
              <h3 className="text-xs font-black text-lime-900 uppercase">
                Danh Sách Các Đợt Huấn Luyện ({campaignGroups.length} Đợt)
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 italic">Click chọn đợt</span>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[480px] custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 border-b border-lime-100 font-bold text-gray-600 uppercase text-[10.5px]">
                <tr>
                  <th className="p-3">Đợt Huấn Luyện</th>
                  <th className="p-3 text-center w-24">Sĩ Số (TT/DK)</th>
                  <th className="p-3 text-center w-24">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaignGroups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-400 italic">
                      Chưa có dữ liệu đợt huấn luyện nào.
                    </td>
                  </tr>
                ) : (
                  campaignGroups.map(campaign => {
                    const isSelected = campaign.campaignName === selectedCampaignName;
                    const fillPct = campaign.totalDuKien > 0 ? Math.round((campaign.totalThucTe / campaign.totalDuKien) * 100) : 0;
                    const passPct = campaign.totalHocVien > 0 ? Math.round((campaign.totalDat / campaign.totalHocVien) * 100) : 0;

                    return (
                      <tr
                        key={campaign.campaignName}
                        onClick={() => setSelectedCampaignName(campaign.campaignName)}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-lime-100/70 border-l-4 border-lime-600 shadow-2xs font-semibold'
                            : 'hover:bg-lime-50/30'
                        }`}
                      >
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-black text-xs uppercase ${isSelected ? 'text-lime-950 font-black' : 'text-gray-800'}`}>
                                {campaign.campaignName}
                              </span>
                              <span className="text-[9.5px] font-bold text-lime-800 bg-lime-100 px-1.5 py-0.2 rounded border border-lime-200">
                                {campaign.totalClasses} Lớp
                              </span>
                              <span className={`text-[9.5px] font-black px-1.5 py-0.2 rounded ${
                                campaign.trangThai === 'Hoàn thành' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {campaign.trangThai}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Calendar size={11} className="text-gray-400" />
                              {campaign.minDate ? new Date(campaign.minDate).toLocaleDateString('vi-VN') : '---'} →{' '}
                              {campaign.maxDate ? new Date(campaign.maxDate).toLocaleDateString('vi-VN') : '---'}
                            </p>
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-800 text-[11px]">
                              <span className="text-lime-700 font-black">{campaign.totalThucTe}</span> / {campaign.totalDuKien}
                            </span>
                            <span className="text-[9.5px] text-gray-400 block font-medium">({fillPct}%)</span>
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <div className="space-y-0.5">
                            <span className="font-black text-emerald-700 text-[11px]">{campaign.totalDat} Đạt</span>
                            <span className="text-[9.5px] text-emerald-600 block font-bold">({passPct}%)</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 📅 CỘT BÊN PHẢI (50%): CALENDAR THANH LỊCH & TIẾN ĐỘ DÒNG THỜI GIAN (X LỚP) */}
        <div className="w-full min-w-0 bg-white rounded-2xl border border-lime-200 shadow-xs p-4 flex flex-col gap-4">
          
          {/* Header Lịch & Điều hướng tháng */}
          <div className="flex items-center justify-between border-b border-lime-100 pb-2">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-lime-700" />
              <span className="text-xs font-black text-lime-900 uppercase">{calMonthYearLabel}</span>
              {activeCampaign && (
                <span className="text-[11px] text-gray-500 font-semibold ml-2">
                  (Lộ trình: <span className="text-lime-800 font-bold">{activeCampaign.campaignName}</span>)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCalPrevMonth}
                className="p-1 rounded-lg hover:bg-lime-50 text-lime-800 transition-colors cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleCalResetToday}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-lime-50 hover:bg-lime-100 text-lime-800 transition-colors cursor-pointer"
              >
                Hiện tại
              </button>
              <button
                onClick={handleCalNextMonth}
                className="p-1 rounded-lg hover:bg-lime-50 text-lime-800 transition-colors cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Mini Calendar Grid với Dải Highlight Thanh Lịch (Start - Range - End) */}
          <div className="space-y-1">
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 uppercase pb-1">
              <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
            </div>
            <div className="grid grid-cols-7 text-center text-xs">
              {calendarDaysMatrix.map((item, idx) => {
                if (!item) {
                  return <div key={`empty-${idx}`} className="h-7" />;
                }

                // Xây dựng class dải highlight thanh lịch:
                let rangeClass = 'text-gray-700 hover:bg-lime-50 rounded-lg';
                if (item.isRangeStart && item.isRangeEnd) {
                  rangeClass = 'bg-lime-700 text-white font-black rounded-lg shadow-xs ring-2 ring-lime-400 z-10';
                } else if (item.isRangeStart) {
                  rangeClass = 'bg-lime-700 text-white font-black rounded-l-lg shadow-xs ring-2 ring-lime-400 z-10';
                } else if (item.isRangeEnd) {
                  rangeClass = 'bg-lime-700 text-white font-black rounded-r-lg shadow-xs ring-2 ring-lime-400 z-10';
                } else if (item.isInRange) {
                  rangeClass = 'bg-lime-100 text-lime-900 font-bold rounded-none';
                }

                const tooltip = item.userUnitClassTitle
                  ? item.userUnitClassTitle
                  : (item.isInRange ? `Lộ trình ${activeCampaign?.campaignName}` : '');

                return (
                  <div
                    key={item.dateStr}
                    className={`h-7 flex items-center justify-center text-[11px] transition-all relative ${rangeClass}`}
                    title={tooltip}
                  >
                    {item.isUserUnitClass ? (
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black transition-all transform hover:scale-110 z-20 ${
                          item.isRangeStart || item.isRangeEnd
                            ? 'border-2 border-white bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                            : item.isInRange
                            ? 'border-2 border-blue-600 bg-white text-blue-900 shadow-xs ring-2 ring-blue-200'
                            : 'border-2 border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                        }`}
                      >
                        {item.dayNumber}
                      </span>
                    ) : (
                      item.dayNumber
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chú thích Lịch */}
            <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1.5 px-0.5 border-t border-lime-100 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-lime-700 inline-block"></span>
                  <span>Bắt đầu / Kết thúc đợt</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-lime-100 border border-lime-300 inline-block"></span>
                  <span>Thời gian đợt</span>
                </span>
              </div>
            </div>
          </div>

          {/* 🟢 TIẾN ĐỘ DÒNG THỜI GIAN (X LỚP) - CẤU TRÚC 2 DÒNG ĐÚNG CHUẨN */}
          {activeCampaign && (
            <div className="border-t border-lime-100 pt-3 space-y-2.5 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-lime-900 uppercase flex items-center gap-1.5">
                  <Layers size={14} className="text-lime-700" />
                  Tiến Độ Dòng Thời Gian ({activeCampaign.classes.length} Lớp):
                </span>
                <span className="text-[10px] text-gray-400 italic">Chi tiết từng lớp học</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {activeCampaign.classes.map(cls => {
                  const fillPct = cls.si_so_du_kien > 0 ? Math.round(((cls.si_so_thuc_te || 0) / cls.si_so_du_kien) * 100) : 0;
                  
                  // 1. Đơn vị áp dụng khóa học
                  const appliedUnit = donViList.find(d => d.id === cls.id_don_vi);
                  let appliedUnitName = appliedUnit ? appliedUnit.ten_don_vi : (donViMap[cls.id_don_vi] || 'Tất cả cơ sở');

                  // 2. Đơn vị mẹ của đơn vị áp dụng khóa học
                  let parentUnitName = '';
                  if (appliedUnit) {
                    if (appliedUnit.cap_quan_ly && appliedUnit.cap_quan_ly !== 'HO') {
                      const parent = donViList.find(d => d.id === appliedUnit.cap_quan_ly);
                      if (parent) {
                        parentUnitName = parent.ten_don_vi;
                      }
                    }
                    if (!parentUnitName) {
                      parentUnitName = appliedUnit.ten_don_vi;
                      appliedUnitName = 'Toàn đơn vị';
                    }
                  } else {
                    parentUnitName = 'Toàn hệ thống';
                    appliedUnitName = 'Tất cả cơ sở';
                  }

                  return (
                    <div
                      key={cls.id}
                      className="p-3 rounded-xl border border-lime-100 bg-white hover:border-lime-300 transition-all shadow-2xs space-y-1.5"
                    >
                      {/* 🏷️ DÒNG 1: Nhãn Đơn vị (mẹ của ĐV áp dụng), Nhãn Đơn vị áp dụng khóa học, Thời gian, Trạng thái */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Nhãn 1: Đơn vị (là đơn vị mẹ của Đơn vị áp dụng khóa học) */}
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs"
                            title={`Đơn vị mẹ: ${parentUnitName}`}
                          >
                            <Building2 size={11} className="text-blue-700 shrink-0" />
                            {parentUnitName}
                          </span>

                          {/* Nhãn 2: Đơn vị áp dụng khóa học */}
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs"
                            title={`Đơn vị áp dụng khóa học: ${appliedUnitName}`}
                          >
                            <Store size={11} className="text-teal-700 shrink-0" />
                            {appliedUnitName}
                          </span>

                          {/* Thời gian */}
                          <span className="text-xs font-bold text-gray-700 flex items-center gap-1 ml-1">
                            <Calendar size={12} className="text-gray-400 shrink-0" />
                            {cls.ngay_bat_dau ? new Date(cls.ngay_bat_dau).toLocaleDateString('vi-VN') : '---'} →{' '}
                            {cls.ngay_ket_thuc ? new Date(cls.ngay_ket_thuc).toLocaleDateString('vi-VN') : '---'}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                          cls.trang_thai === 'Hoàn thành'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {cls.trang_thai || 'Hoàn thành'}
                        </span>
                      </div>

                      {/* 🏷️ DÒNG 2: Đơn vị đào tạo - Sĩ số: dự kiến/thực tế - Tỉ lệ:...% */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-gray-500 pt-1 border-t border-gray-50">
                        <span className="flex items-center gap-1 font-medium text-gray-600 truncate max-w-[260px]">
                          <Building2 size={12} className="text-gray-400 shrink-0" />
                          {cls.don_vi_dao_tao || '---'}
                        </span>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="font-semibold text-gray-700">
                            Sĩ số: <span className="text-gray-500 font-normal">{cls.si_so_du_kien || 0} DK</span> / <span className="text-lime-700 font-bold">{cls.si_so_thuc_te || 0} TT</span>
                          </span>
                          <span className="font-bold text-lime-800 bg-lime-50 border border-lime-200 px-1.5 py-0.2 rounded text-[11px]">
                            Tỉ lệ: {fillPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🟢 KHỐI 3: BẢNG "THỐNG KÊ TUÂN THỦ" THEO CÂY ĐƠN VỊ CỦA ỨNG DỤNG */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Header bảng Thống kê tuân thủ */}
        <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
              <Store size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                  Thống Kê Tuân Thủ Theo Cây Đơn Vị
                </h3>
                <span className="text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-2xs">
                  {totalParents} Đơn vị • {totalShowrooms} Showroom
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {isAdmin
                  ? 'Phân cấp 2 lớp chuẩn: Đơn vị (Lớp 1) & Showroom trực thuộc (Lớp 2)'
                  : `Phân quyền theo đơn vị của bạn: ${donViMap[user?.id_don_vi] || 'Cơ sở hiện tại'}`}
              </p>
            </div>
          </div>

          {/* Ô tìm kiếm + Nút Mở rộng/Thu gọn */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm Đơn vị, Showroom..."
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            <button
              onClick={toggleExpandAll}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
              title={isAllExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả Showroom'}
            >
              <ChevronsUpDown size={14} className="text-gray-500" />
              <span>{isAllExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
            </button>
          </div>
        </div>

        {/* Bảng Thống Kê Tuân Thủ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase text-[10.5px]">
              <tr>
                <th className="p-3 w-14 text-center">STT</th>
                <th className="p-3 min-w-[260px]">Đơn Vị / Showroom Trực Thuộc</th>
                <th className="p-3 text-center w-16" title="Nhóm 1: Người làm công tác quản lý">Nhóm 1</th>
                <th className="p-3 text-center w-16" title="Nhóm 2: Người làm công tác an toàn">Nhóm 2</th>
                <th className="p-3 text-center w-16" title="Nhóm 3: Công việc có yêu cầu nghiêm ngặt">Nhóm 3</th>
                <th className="p-3 text-center w-16" title="Nhóm 4: Người lao động phổ thông">Nhóm 4</th>
                <th className="p-3 text-center w-16" title="Nhóm 6: An toàn vệ sinh viên">Nhóm 6</th>
                <th className="p-3 text-center w-28" title="Số lượng bài kiểm tra Đạt / Tổng số tham dự">Đạt / Tham Dự</th>
                <th className="p-3 min-w-[120px]">Hoàn Thành (%)</th>
                <th className="p-3 text-center w-24">Đánh Giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTree.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-400 italic">
                    Không tìm thấy dữ liệu đơn vị phù hợp.
                  </td>
                </tr>
              ) : (
                filteredTree.map(section => (
                  <React.Fragment key={section.id}>
                    {/* 🏢 HEADER NHÓM CÂY ĐƠN VỊ (VPĐH, CTTT PHÍA NAM, PHÍA BẮC) */}
                    <tr className="bg-slate-100/90 border-y border-slate-200">
                      <td colSpan={10} className="py-2 px-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
                            <span className="text-sm">{section.icon}</span>
                            <span>{section.title}</span>
                            <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.2 rounded-full">
                              {section.units.length} Đơn vị
                            </span>
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* DANH SÁCH ĐƠN VỊ TRONG NHÓM */}
                    {section.units.map((group, pIdx) => {
                      const isExpanded = !!expandedParentUnits[group.parent.unitId] || isAllExpanded || !!unitSearch.trim();
                      const parent = group.parent;

                      return (
                        <React.Fragment key={parent.unitId}>
                          {/* DÒNG LỚP 1: CẤP ĐƠN VỊ / CÔNG TY TỈNH THÀNH */}
                          <tr className="bg-white hover:bg-slate-50/80 font-semibold transition-colors border-b border-gray-100">
                            <td className="p-3 text-center font-bold text-gray-500">{pIdx + 1}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {group.showrooms.length > 0 ? (
                                  <button
                                    onClick={() => toggleParentExpand(parent.unitId)}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors cursor-pointer"
                                    title={isExpanded ? 'Thu gọn Showroom' : 'Xem Showroom'}
                                  >
                                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                  </button>
                                ) : (
                                  <div className="w-5" />
                                )}
                                <span className="text-base">{getUnitEmoji(parent.loaiHinh)}</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-gray-900 uppercase tracking-wide text-xs">
                                    {parent.unitName}
                                  </span>
                                  {parent.childCount > 0 && (
                                    <span className="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded font-medium">
                                      {parent.childCount} Showroom
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-3 text-center text-gray-700 font-semibold">{parent.n1}</td>
                            <td className="p-3 text-center text-gray-700 font-semibold">{parent.n2}</td>
                            <td className="p-3 text-center text-gray-700 font-semibold">{parent.n3}</td>
                            <td className="p-3 text-center text-gray-700 font-semibold">{parent.n4}</td>
                            <td className="p-3 text-center text-gray-700 font-semibold">{parent.n6}</td>

                            <td className="p-3 text-center">
                              <span className="font-black text-emerald-700 text-xs">{parent.totalDat}</span>
                              <span className="text-gray-400 font-semibold text-[11px]"> / {parent.tongThamDu}</span>
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-gray-700">{parent.completionRate}%</span>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      parent.completionRate >= 90
                                        ? 'bg-emerald-500'
                                        : parent.completionRate >= 70
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${parent.completionRate}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                parent.status === 'DAT'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : parent.status === 'CAN_BO_SUNG'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {parent.status === 'DAT' ? 'Đạt chuẩn' : parent.status === 'CAN_BO_SUNG' ? 'Bổ sung' : 'Chưa đạt'}
                              </span>
                            </td>
                          </tr>

                          {/* DÒNG LỚP 2: CÁC SHOWROOM CON TRỰC THUỘC */}
                          {isExpanded && group.showrooms.length > 0 && (
                            group.showrooms.map((sr, sIdx) => {
                              const isLastChild = sIdx === group.showrooms.length - 1;
                              return (
                                <tr key={sr.unitId} className="bg-slate-50/60 hover:bg-slate-100/70 text-gray-700 border-b border-gray-100/60 transition-colors">
                                  <td className="p-2 text-center text-gray-400 font-mono text-[10px]">
                                    {pIdx + 1}.{sIdx + 1}
                                  </td>
                                  <td className="p-2 pl-9">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-300 font-mono text-xs">{isLastChild ? '└──' : '├──'}</span>
                                      <span className="text-sm">{getUnitEmoji(sr.loaiHinh)}</span>
                                      <span className="font-medium text-gray-800 text-xs">{sr.unitName}</span>
                                    </div>
                                  </td>

                                  <td className="p-2 text-center font-medium text-gray-600">{sr.n1}</td>
                                  <td className="p-2 text-center font-medium text-gray-600">{sr.n2}</td>
                                  <td className="p-2 text-center font-medium text-gray-600">{sr.n3}</td>
                                  <td className="p-2 text-center font-medium text-gray-600">{sr.n4}</td>
                                  <td className="p-2 text-center font-medium text-gray-600">{sr.n6}</td>

                                  <td className="p-2 text-center">
                                    <span className="font-bold text-emerald-700 text-xs">{sr.totalDat}</span>
                                    <span className="text-gray-400 font-medium text-[11px]"> / {sr.tongThamDu}</span>
                                  </td>
                                  <td className="p-2">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-semibold">{sr.completionRate}%</span>
                                      <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                        <div
                                          className={`h-1 rounded-full ${
                                            sr.completionRate >= 90
                                              ? 'bg-emerald-500'
                                              : sr.completionRate >= 70
                                              ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${sr.completionRate}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                      sr.status === 'DAT'
                                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                        : sr.status === 'CAN_BO_SUNG'
                                        ? 'text-amber-700 bg-amber-50 border border-amber-200'
                                        : 'text-rose-700 bg-rose-50 border border-rose-200'
                                    }`}>
                                      {sr.status === 'DAT' ? 'Đạt' : sr.status === 'CAN_BO_SUNG' ? 'Bổ sung' : 'Chưa đạt'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
