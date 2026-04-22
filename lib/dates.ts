// Japanese holidays for common years (static list + dynamic calculation)
// This covers major Japanese public holidays

const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '元日',
  '02-11': '建国記念の日',
  '02-23': '天皇誕生日',
  '04-29': '昭和の日',
  '05-03': '憲法記念日',
  '05-04': 'みどりの日',
  '05-05': 'こどもの日',
  '08-11': '山の日',
  '11-03': '文化の日',
  '11-23': '勤労感謝の日',
};

function getSpringEquinox(year: number): number {
  if (year >= 2000 && year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return 21;
}

function getAutumnEquinox(year: number): number {
  if (year >= 2000 && year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return 23;
}

// Happy Monday holidays
function getHappyMonday(year: number, month: number, week: number): Date {
  const first = new Date(year, month - 1, 1);
  const firstDay = first.getDay();
  const offset = ((1 - firstDay + 7) % 7) + (week - 1) * 7;
  return new Date(year, month - 1, 1 + offset);
}

export function isHoliday(date: Date): boolean {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const key = `${mm}-${dd}`;
  const year = date.getFullYear();

  // Fixed holidays
  if (FIXED_HOLIDAYS[key]) return true;

  // Spring Equinox
  if (date.getMonth() === 2 && date.getDate() === getSpringEquinox(year)) return true;

  // Autumn Equinox
  if (date.getMonth() === 8 && date.getDate() === getAutumnEquinox(year)) return true;

  // Happy Monday: 成人の日 (1月第2月曜)
  const seijin = getHappyMonday(year, 1, 2);
  if (date.getTime() === seijin.getTime()) return true;

  // 海の日 (7月第3月曜)
  const umi = getHappyMonday(year, 7, 3);
  if (date.getTime() === umi.getTime()) return true;

  // 敬老の日 (9月第3月曜)
  const keiro = getHappyMonday(year, 9, 3);
  if (date.getTime() === keiro.getTime()) return true;

  // スポーツの日 (10月第2月曜)
  const sports = getHappyMonday(year, 10, 2);
  if (date.getTime() === sports.getTime()) return true;

  return false;
}

export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

export function formatDate(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}

export function formatDateFull(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateDateRange(startDate: string, endDate: string): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
