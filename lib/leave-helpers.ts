export function countWeekdays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function calculateProrate(joinDate: Date, year: number, defaultQuota: number): number {
  const joinYear = joinDate.getFullYear();
  if (joinYear < year) return defaultQuota;
  if (joinYear > year) return 0;
  const joinMonth = joinDate.getMonth() + 1;
  const remainingMonths = 12 - joinMonth + 1;
  return Math.ceil((remainingMonths / 12) * defaultQuota);
}

export function getAvailableBalance(balance: {
  totalDays: number;
  usedDays: number;
  carryOverDays: number;
  adjustmentDays: number;
}): number {
  return balance.totalDays + balance.carryOverDays + balance.adjustmentDays - balance.usedDays;
}

export function getWeekdaysBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
