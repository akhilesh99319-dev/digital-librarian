const { db } = require('../database/db');
const { calculateOverdueFine } = require('../utils/fineCalculator');

/**
 * Get Real-Time Dashboard Statistics
 */
function getDashboardStats(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Total unique book titles and copy counts
    const booksStat = db.prepare(`
      SELECT 
        COUNT(*) as unique_titles,
        COALESCE(SUM(total_copies), 0) as total_copies,
        COALESCE(SUM(available_copies), 0) as available_copies
      FROM books
    `).get();

    // 2. Total members
    const membersStat = db.prepare(`
      SELECT 
        COUNT(*) as total_members,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_members
      FROM members
    `).get();

    // 3. Active loans (Issued or currently Overdue)
    const loansStat = db.prepare(`
      SELECT 
        COUNT(*) as active_loans
      FROM loans
      WHERE return_date IS NULL
    `).get();

    // 4. Overdue loans calculation (dynamically check loans that have passed due date)
    const overdueStat = db.prepare(`
      SELECT 
        COUNT(*) as overdue_count,
        COALESCE(SUM(fine_amount), 0) as existing_fines
      FROM loans
      WHERE return_date IS NULL AND due_date < ?
    `).get(today);

    // 5. Total pending fines from fines table + calculated unrecorded overdue fines
    const finesStat = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as unpaid_fines
      FROM fines
      WHERE status = 'Unpaid'
    `).get();

    // 6. Books by Category for Chart.js
    const categoryDistribution = db.prepare(`
      SELECT 
        c.name as category_name,
        COUNT(b.id) as book_count,
        COALESCE(SUM(b.total_copies), 0) as total_copies,
        COALESCE(SUM(b.available_copies), 0) as available_copies
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      GROUP BY c.id, c.name
      ORDER BY total_copies DESC
    `).all();

    // 7. Monthly Activity (last 6 months issue & return trends)
    // We compute monthly issue counts and return counts
    const monthlyIssues = db.prepare(`
      SELECT 
        strftime('%Y-%m', issue_date) as month,
        COUNT(*) as count
      FROM loans
      WHERE issue_date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `).all();

    const monthlyReturns = db.prepare(`
      SELECT 
        strftime('%Y-%m', return_date) as month,
        COUNT(*) as count
      FROM loans
      WHERE return_date IS NOT NULL AND return_date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `).all();

    // Merge monthly trends for continuous chart series
    const monthsSet = new Set([
      ...monthlyIssues.map(m => m.month),
      ...monthlyReturns.map(m => m.month)
    ]);
    
    // Ensure we have last 6 months even if empty
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = d.toISOString().slice(0, 7);
      monthsSet.add(mStr);
    }

    const sortedMonths = Array.from(monthsSet).sort();
    const issueMap = Object.fromEntries(monthlyIssues.map(r => [r.month, r.count]));
    const returnMap = Object.fromEntries(monthlyReturns.map(r => [r.month, r.count]));

    const monthlyActivity = sortedMonths.map(month => ({
      month,
      monthLabel: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      issues: issueMap[month] || 0,
      returns: returnMap[month] || 0
    }));

    // 8. Recent 6 loans
    const recentLoans = db.prepare(`
      SELECT 
        l.id,
        l.loan_code,
        l.issue_date,
        l.due_date,
        l.return_date,
        l.status,
        l.fine_amount,
        b.title as book_title,
        b.book_code,
        m.full_name as member_name,
        m.member_code
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
      ORDER BY l.id DESC
      LIMIT 6
    `).all();

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalBooks: booksStat.total_copies,
          uniqueBookTitles: booksStat.unique_titles,
          totalAvailableCopies: booksStat.available_copies,
          totalMembers: membersStat.total_members,
          activeMembers: membersStat.active_members,
          activeLoans: loansStat.active_loans,
          overdueBooks: overdueStat.overdue_count,
          pendingFines: finesStat.unpaid_fines
        },
        charts: {
          categories: categoryDistribution,
          monthlyActivity
        },
        recentLoans
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard analytics.'
    });
  }
}

module.exports = {
  getDashboardStats
};
