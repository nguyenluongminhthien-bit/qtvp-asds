function evaluateFlat(expr: string): number {
  const tokens: (string | number)[] = [];
  let numAcc = '';
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (['+', '-', '*', '/'].includes(char)) {
      if (numAcc) {
        tokens.push(parseFloat(numAcc));
        numAcc = '';
      }
      // Xử lý dấu âm/dương ở đầu hoặc sau một toán tử khác
      if (char === '-' && (tokens.length === 0 || ['+', '-', '*', '/'].includes(tokens[tokens.length - 1] as string))) {
        numAcc = '-';
      } else {
        tokens.push(char);
      }
    } else {
      numAcc += char;
    }
  }
  if (numAcc) {
    tokens.push(parseFloat(numAcc));
  }

  if (tokens.length === 0) return 0;

  // Bước 1: Xử lý Nhân (*) và Chia (/)
  const pass1: (string | number)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '*' || token === '/') {
      const prev = pass1.pop() as number;
      const next = tokens[++i] as number;
      
      if (isNaN(prev) || isNaN(next)) return 0;
      
      if (token === '*') {
        pass1.push(prev * next);
      } else {
        pass1.push(next !== 0 ? prev / next : 0);
      }
    } else {
      pass1.push(token);
    }
  }

  if (pass1.length === 0) return 0;

  // Bước 2: Xử lý Cộng (+) và Trừ (-)
  let result = pass1[0] as number;
  if (isNaN(result)) return 0;

  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i] as string;
    const next = pass1[i + 1] as number;
    if (isNaN(next)) continue;
    
    if (op === '+') {
      result += next;
    } else if (op === '-') {
      result -= next;
    }
  }
  return result;
}

export function safeEvalMath(expr: string): string {
  try {
    let temp = expr.replace(/[^\d+\-*/.()]/g, '');
    if (!temp) return '';

    let hasParen = temp.indexOf('(') !== -1;
    let iterations = 0; // Tránh loop vô tận nếu sai cú pháp dấu ngoặc
    
    while (hasParen && iterations < 50) {
      iterations++;
      const closeParen = temp.indexOf(')');
      if (closeParen === -1) break;
      const openParen = temp.lastIndexOf('(', closeParen);
      if (openParen === -1) break;
      
      const subExpr = temp.substring(openParen + 1, closeParen);
      const subResult = evaluateFlat(subExpr);
      
      temp = temp.substring(0, openParen) + subResult + temp.substring(closeParen + 1);
      hasParen = temp.indexOf('(') !== -1;
    }
    
    const result = evaluateFlat(temp);
    if (!isNaN(result) && isFinite(result)) {
      return Math.round(result).toString();
    }
    return '';
  } catch {
    return '';
  }
}
