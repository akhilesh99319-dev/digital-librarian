/**
 * Fine Calculator Utility
 * Fine rate defaults to ₹5/day and is configurable via FINE_RATE_PER_DAY env var.
 */

function getFineRatePerDay() {
  const envRate = parseFloat(process.env.FINE_RATE_PER_DAY);
  return !isNaN(envRate) && envRate >= 0 ? envRate : 5.0;
}

/**
 * Calculates overdue days and fine amount given a due date and optional return date.
 * If return date is not provided, today's date is used.
 * @param {string|Date} dueDateStr 
 * @param {string|Date|null} returnDateStr 
 * @returns {{ daysOverdue: number, fineAmount: number, fineRate: number }}
 */
function calculateOverdueFine(dueDateStr, returnDateStr = null) {
  const fineRate = getFineRatePerDay();
  
  if (!dueDateStr) {
    return { daysOverdue: 0, fineAmount: 0, fineRate };
  }

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const compareDate = returnDateStr ? new Date(returnDateStr) : new Date();
  compareDate.setHours(0, 0, 0, 0);

  const diffTime = compareDate.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    const fineAmount = diffDays * fineRate;
    return {
      daysOverdue: diffDays,
      fineAmount: parseFloat(fineAmount.toFixed(2)),
      fineRate
    };
  }

  return {
    daysOverdue: 0,
    fineAmount: 0.0,
    fineRate
  };
}

module.exports = {
  getFineRatePerDay,
  calculateOverdueFine
};
