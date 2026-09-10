// Service kết nối và tìm kiếm tệp tin từ Google Drive API v3
export const GOOGLE_API_KEY = "AIzaSyA4P9hXbuk3Iusk5MWQpIE-1beErC2z8nU";
export const ROOT_FOLDER_ID = "1hdwEa6aTBARJs720LGT7qxfwJFOg6U68";
export const VEHICLE_FOLDER_ID = "1UZ5ZUTPrOZ4-ClAbxCgTQ8pbn8d6CzSa";

// Trích xuất số hiệu dạng số nguyên kèm theo chữ cái hậu tố (ví dụ: "01/2026/TB" -> "01", "541A/2025/TB" -> "541A")
export const extractDocNumber = (soHieu: string): string => {
  if (!soHieu) return "";
  // Tìm cụm chữ số đầu tiên kèm theo chữ cái viết liền kề (ví dụ: 541A hoặc 05 hoặc 5)
  const match = soHieu.match(/(\d+)([A-Za-z]*)/);
  if (match) {
    const digits = match[1];
    const suffix = match[2] || "";
    // Đảm bảo số đơn có số 0 ở trước (ví dụ: "5" -> "05", "5A" -> "05A")
    const paddedDigits = digits.length === 1 ? "0" + digits : digits;
    return paddedDigits + suffix;
  }
  return soHieu.trim();
};


// Ánh xạ Loại văn bản sang tên thư mục con tương ứng
const getFolderSuffix = (phanLoai: string): string => {
  switch (phanLoai) {
    case "Công văn đi":
      return "CV Đi";
    case "Công văn đến":
      return "CV Đến";
    case "Quyết định":
      return "Quyết định";
    case "Thông báo":
      return "Thông báo";
    case "Thông báo BĐH":
      return "Thông báo BĐH";
    case "Tờ trình":
      return "Tờ trình";
    default:
      return phanLoai;
  }
};

// Ánh xạ Loại văn bản sang các tiền tố tên file PDF có thể có (ví dụ: Quyết định có thể viết tắt là QĐ hoặc QD)
const getFilePrefixes = (phanLoai: string): string[] => {
  switch (phanLoai) {
    case "Công văn đi":
      return ["CV"];
    case "Công văn đến":
      return ["CVĐ", "CVD"];
    case "Quyết định":
      return ["QĐ", "QD"];
    case "Thông báo":
    case "Thông báo BĐH":
      return ["TB"];
    case "Tờ trình":
      return ["TTr", "TT"];
    default:
      return ["VB"];
  }
};

// Hàm truy vấn Google Drive API v3
const fetchDriveFiles = async (q: string): Promise<any[]> => {
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&key=${GOOGLE_API_KEY}&fields=files(id,name,webViewLink)`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Lỗi HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.files || [];
};

/**
 * Tìm kiếm link file văn bản trên Google Drive dựa theo cấu trúc:
 * Root ➔ [Năm] ➔ [Năm]. [Loại VB] ➔ Quét tất cả file PDF và dùng Regex so khớp thông minh
 */
export const searchGoogleDriveFile = async (
  year: string,
  phanLoai: string,
  soHieu: string
): Promise<string | null> => {
  if (!year || !phanLoai || !soHieu) return null;

  const docNum = extractDocNumber(soHieu);
  if (!docNum) return null;

  const folderSuffix = phanLoai === "Công văn đi" ? "CV Đi" :
                       phanLoai === "Công văn đến" ? "CV Đến" : phanLoai;
  const typeFolderName = `${year}. ${folderSuffix}`;

  try {
    // 1. Tìm Thư mục Năm (ví dụ: "2026") trong Thư mục Gốc
    const yearFolders = await fetchDriveFiles(
      `'${ROOT_FOLDER_ID}' in parents and name = '${year}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    if (yearFolders.length === 0) return null;
    const yearFolderId = yearFolders[0].id;

    // 2. Tìm Thư mục Loại văn bản (ví dụ: "2026. Quyết định") trong Thư mục Năm
    const typeFolders = await fetchDriveFiles(
      `'${yearFolderId}' in parents and name = '${typeFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    if (typeFolders.length === 0) return null;
    const typeFolderId = typeFolders[0].id;

    // 3. Tải toàn bộ danh sách tệp tin PDF trong thư mục Loại văn bản
    const files = await fetchDriveFiles(
      `'${typeFolderId}' in parents and mimeType = 'application/pdf' and trashed = false`
    );

    if (files.length === 0) return null;

    // Phân tích docNum để lấy phần số và phần chữ suffix (ví dụ: "12B" -> số "12", suffix "B")
    const numMatch = docNum.match(/^0*(\d+)([A-Za-z]*)$/);
    if (!numMatch) return null;
    const numStr = numMatch[1];
    const suffix = numMatch[2] || "";

    const prefixes = getFilePrefixes(phanLoai);
    const prefixPattern = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    
    // Regex khớp: (prefix)(ký tự phân cách như space, dot, gạch ngang không bắt buộc)(các số 0 không bắt buộc)(số hiệu)(chữ cái suffix)(ký tự không phải chữ số/chữ cái ở sau hoặc cuối chuỗi)
    // Ví dụ: /(^|[^a-zA-Z0-9])(QD|QĐ)[\s._]*0*9([^a-zA-Z0-9]|$)/i
    const exactPattern = new RegExp(`(^|[^a-zA-Z0-9])(${prefixPattern})[\\s._]*0*${numStr}${suffix}([^a-zA-Z0-9]|$)`, 'i');

    const exactMatch = files.find(file => {
      const name = file.name || "";
      return exactPattern.test(name);
    });

    return exactMatch ? exactMatch.webViewLink || null : null;
  } catch (error) {
    console.error("Lỗi khi tìm kiếm tệp Google Drive:", error);
    throw error;
  }
};

/**
 * Tìm kiếm link file hồ sơ xe trên Google Drive theo SỐ KHUNG (VIN):
 * Quét trong folder "Hồ sơ Xe" (ID: 1UZ5ZUTPrOZ4-ClAbxCgTQ8pbn8d6CzSa)
 * Tên file được đặt theo Số khung xe (ví dụ: RL4MC123456789.pdf, RL4MC-123456789.pdf, ...)
 */
export interface VehicleDriveMatch {
  link: string;
  name: string;
  isFolder: boolean;
}

/**
 * Tìm kiếm hồ sơ xe trên Google Drive (hỗ trợ cả Tệp tin PDF/RAR/ZIP... lẫn Thư mục mang tên Số khung)
 * @param soKhung Số khung (VIN) của xe
 */
export const searchVehicleDriveFile = async (
  soKhung: string
): Promise<VehicleDriveMatch | null> => {
  if (!soKhung || !soKhung.trim()) return null;
  const cleanChassis = soKhung.toUpperCase().replace(/[\s\-\.]/g, '');
  if (!cleanChassis) return null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `'${VEHICLE_FOLDER_ID}' in parents and trashed = false`
    )}&key=${GOOGLE_API_KEY}&pageSize=1000&fields=files(id,name,mimeType,webViewLink)`;

    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error(
          "Không thể truy cập thư mục Hồ sơ Xe trên Google Drive (Lỗi 404). Vui lòng đảm bảo quyền truy cập chung của thư mục được bật là 'Bất kỳ ai có đường liên kết' -> 'Người xem'!"
        );
      }
      throw new Error(err?.error?.message || `Lỗi Google Drive HTTP ${response.status}`);
    }
    const data = await response.json();
    const files: any[] = data.files || [];
    if (files.length === 0) return null;

    const getCleanName = (name: string) => {
      return (name || '')
        .toUpperCase()
        .replace(/\.(PDF|RAR|ZIP|7Z|DOC|DOCX|XLS|XLSX|JPG|JPEG|PNG)$/i, '')
        .replace(/[\s\-\.]/g, '');
    };

    const matchItem = (items: any[]) => {
      // 1. Tìm khớp chính xác Số khung (áp dụng cho cả File hoặc Folder)
      const exact = items.find(f => getCleanName(f.name) === cleanChassis);
      if (exact) return exact;

      // 2. Tìm khớp chứa Số khung đầy đủ (VD: "Hồ sơ WBS21DM0508G22436.pdf" hoặc folder)
      const partial = items.find(f => getCleanName(f.name).includes(cleanChassis));
      if (partial) return partial;

      // 3. Tìm khớp phần đuôi số khung (nếu số khung dài >= 6 ký tự)
      if (cleanChassis.length >= 6) {
        const suffix6 = cleanChassis.slice(-6);
        const suffixMatch = items.find(f => {
          const clean = getCleanName(f.name);
          return clean.endsWith(suffix6) || clean.includes(suffix6);
        });
        if (suffixMatch) return suffixMatch;
      }

      return null;
    };

    const buildResult = (matched: any): VehicleDriveMatch => {
      const isFolder = matched.mimeType === 'application/vnd.google-apps.folder';
      const link = isFolder
        ? (matched.webViewLink || `https://drive.google.com/drive/folders/${matched.id}`)
        : (matched.webViewLink || `https://drive.google.com/file/d/${matched.id}/view`);
      return {
        link,
        name: matched.name,
        isFolder,
      };
    };

    let matched = matchItem(files);
    if (matched) return buildResult(matched);

    // Nếu chưa tìm thấy ở thư mục gốc, quét tiếp vào các thư mục con cấp 1
    const subFolders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    for (const folder of subFolders) {
      const subUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${folder.id}' in parents and trashed = false`
      )}&key=${GOOGLE_API_KEY}&pageSize=1000&fields=files(id,name,mimeType,webViewLink)`;
      const subRes = await fetch(subUrl);
      if (subRes.ok) {
        const subData = await subRes.json();
        const subFiles = subData.files || [];
        matched = matchItem(subFiles);
        if (matched) return buildResult(matched);
      }
    }

    return null;
  } catch (error) {
    console.error("Lỗi khi tìm kiếm tệp Hồ sơ Xe trên Google Drive:", error);
    throw error;
  }
};


