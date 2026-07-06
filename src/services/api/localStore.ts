import { INITIAL_MOCK_DATA } from './mockData';
import { resolveTable } from './cache';

// Hàm khởi tạo dữ liệu local nếu chưa có
export function initLocalData() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  Object.keys(INITIAL_MOCK_DATA).forEach(tableKey => {
    const localKey = `mock_${tableKey}`;
    if (!localStorage.getItem(localKey)) {
      localStorage.setItem(localKey, JSON.stringify(INITIAL_MOCK_DATA[tableKey]));
    }
  });
}

// Lấy danh sách record từ LocalStorage
export function getLocalRecords(tableName: string): any[] {
  initLocalData();
  const realTableName = resolveTable(tableName);
  const localKey = `mock_${realTableName}`;
  
  try {
    const raw = localStorage.getItem(localKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Lỗi đọc dữ liệu local của bảng ${realTableName}:`, e);
    return [];
  }
}

// Lưu record (Thêm mới hoặc Cập nhật) vào LocalStorage
export function saveLocalRecord(data: any, action: 'create' | 'update', tableName: string): any {
  initLocalData();
  const realTableName = resolveTable(tableName);
  const localKey = `mock_${realTableName}`;
  const records = getLocalRecords(realTableName);

  // Xử lý mảng (lưu nhiều record)
  if (Array.isArray(data)) {
    const cleanArray = data.map(item => {
      const cleaned = { ...item };
      Object.keys(cleaned).forEach(k => { if (cleaned[k] === '') cleaned[k] = null; });
      if (!cleaned.id) {
        const prefix = realTableName.substring(0, 2).toUpperCase();
        cleaned.id = `${prefix}${Date.now()}${Math.floor(Math.random() * 100)}`;
      }
      return cleaned;
    });

    // Thêm các bản ghi mới vào danh sách hiện tại
    const updated = [...records];
    cleanArray.forEach(item => {
      const idx = updated.findIndex(r => String(r.id || r.ID) === String(item.id || item.ID));
      if (idx > -1) {
        updated[idx] = item;
      } else {
        updated.push(item);
      }
    });

    localStorage.setItem(localKey, JSON.stringify(updated));
    return cleanArray;
  }

  // Xử lý object đơn lẻ
  const cleanedData = { ...data };
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === '') cleanedData[key] = null;
  });

  const recordId = cleanedData.id || cleanedData.ID || cleanedData.ID_Xe || cleanedData.ID_User;

  if (action === 'create') {
    if (!recordId) {
      const prefix = realTableName.substring(0, 2).toUpperCase();
      cleanedData.id = `${prefix}${Date.now()}${Math.floor(Math.random() * 100)}`;
    }
    records.push(cleanedData);
  } else {
    // action === 'update'
    const idToFind = String(recordId);
    const index = records.findIndex(r => String(r.id || r.ID || r.ID_Xe || r.ID_User) === idToFind);
    if (index > -1) {
      records[index] = { ...records[index], ...cleanedData };
    } else {
      records.push(cleanedData); // Fallback nếu không tìm thấy
    }
  }

  localStorage.setItem(localKey, JSON.stringify(records));
  return cleanedData;
}

// Xóa record khỏi LocalStorage
export function deleteLocalRecord(id: string, tableName: string): boolean {
  initLocalData();
  const realTableName = resolveTable(tableName);
  const localKey = `mock_${realTableName}`;
  const records = getLocalRecords(realTableName);

  const idToFind = String(id);
  const filtered = records.filter(r => String(r.id || r.ID || r.ID_Xe || r.ID_User) !== idToFind);

  localStorage.setItem(localKey, JSON.stringify(filtered));
  return true;
}
