/**
 * Tiện ích đọc số tiền thành chữ Tiếng Việt chuẩn mực cho chứng từ kế toán và đề nghị thanh toán.
 * Ví dụ:
 *   76379844 -> "Bảy mươi sáu triệu ba trăm bảy mươi chín nghìn tám trăm bốn mươi bốn đồng"
 *   1000000 -> "Một triệu đồng"
 *   1505000 -> "Một triệu năm trăm lẻ năm nghìn đồng"
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(threeDigits: number, isHighestGroup: boolean): string {
  const hundreds = Math.floor(threeDigits / 100);
  const tens = Math.floor((threeDigits % 100) / 10);
  const units = threeDigits % 10;

  let result = '';

  // Đọc hàng trăm
  if (!isHighestGroup || hundreds > 0) {
    result += `${DIGITS[hundreds]} trăm `;
  }

  // Đọc hàng chục
  if (tens === 0) {
    if (units > 0) {
      if (!isHighestGroup || hundreds > 0) {
        result += 'lẻ ';
      }
    }
  } else if (tens === 1) {
    result += 'mười ';
  } else {
    result += `${DIGITS[tens]} mươi `;
  }

  // Đọc hàng đơn vị
  if (units === 1) {
    if (tens > 1) {
      result += 'mốt ';
    } else {
      result += 'một ';
    }
  } else if (units === 5) {
    if (tens > 0) {
      result += 'lăm ';
    } else {
      result += 'năm ';
    }
  } else if (units > 0) {
    result += `${DIGITS[units]} `;
  }

  return result.trim();
}

/**
 * Đọc số nguyên dương thành chữ Tiếng Việt
 */
export function numberToWordsVN(amount: number | string): string {
  if (amount === null || amount === undefined || amount === '') return '';

  const num = typeof amount === 'string' ? Math.round(Number(amount.replace(/[^0-9.-]+/g, ''))) : Math.round(amount);

  if (isNaN(num)) return '';
  if (num === 0) return 'Không đồng';

  const isNegative = num < 0;
  let absNum = Math.abs(num);

  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const groups: number[] = [];

  while (absNum > 0) {
    groups.push(absNum % 1000);
    absNum = Math.floor(absNum / 1000);
  }

  const wordsParts: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal > 0) {
      const isHighest = i === groups.length - 1;
      const groupWords = readThreeDigits(groupVal, isHighest);
      const scaleName = scales[i];
      if (scaleName) {
        wordsParts.push(`${groupWords} ${scaleName}`);
      } else {
        wordsParts.push(groupWords);
      }
    }
  }

  let finalWords = wordsParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!finalWords) return 'Không đồng';

  // Viết hoa chữ cái đầu tiên
  finalWords = finalWords.charAt(0).toUpperCase() + finalWords.slice(1);

  return `${isNegative ? 'Âm ' : ''}${finalWords} đồng`;
}
