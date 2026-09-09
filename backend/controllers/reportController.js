const { db } = require('../database/db');
const { jsonToCsv } = require('../utils/csvExporter');
const { calculateOverdueFine, getFineRatePerDay } = require('../utils/fineCalculator');

/**
 * Generate Report Data or CSV Export
 */
async function getReport(req, res) {
  try {
    const { type, format = 'json', start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fineRate = getFineRatePerDay();

    let data = [];
    let filename = `report-${type}-${today}`;

    let defaultHeaders = null;

    switch (type) {
      case 'inventory':
      case 'books':
        defaultHeaders = ["Book Code", "Title", "Author", "Category", "ISBN", "Publisher", "Year", "Total Copies", "Available Copies", "Issued Copies", "Shelf Location"];
        data = await db.prepare(`
          SELECT 
            b.book_code as "Book Code",
            b.title as "Title",
            b.author as "Author",
            c.name as "Category",
            b.isbn as "ISBN",
            b.publisher as "Publisher",
            b.publication_year as "Year",
            b.total_copies as "Total Copies",
            b.available_copies as "Available Copies",
            (b.total_copies - b.available_copies) as "Issued Copies",
            b.shelf_location as "Shelf Location"
          FROM books b
          LEFT JOIN categories c ON b.category_id = c.id
          ORDER BY b.title ASC
        `).all();
        filename = `book-inventory-report-${today}`;
        break;

      case 'members':
        defaultHeaders = ["Member Code", "Full Name", "Email", "Phone", "Address", "Membership Date", "Status", "Active Loans", "Past Loans"];
        data = await db.prepare(`
          SELECT 
            m.member_code as "Member Code",
            m.full_name as "Full Name",
            m.email as "Email",
            m.phone as "Phone",
            m.address as "Address",
            m.membership_date as "Membership Date",
            m.status as "Status",
            COUNT(CASE WHEN l.return_date IS NULL THEN 1 END) as "Active Loans",
            COUNT(CASE WHEN l.return_date IS NOT NULL THEN 1 END) as "Past Loans"
          FROM members m
          LEFT JOIN loans l ON m.id = l.member_id
          GROUP BY m.id, m.member_code, m.full_name, m.email, m.phone, m.address, m.membership_date, m.status
          ORDER BY m.member_code ASC
        `).all();
        filename = `members-report-${today}`;
        break;

      case 'active-loans':
        defaultHeaders = ["Loan Code", "Book Title", "Book Code", "ISBN", "Member Name", "Member Code", "Member Phone", "Issue Date", "Due Date", "Notes", "Days Overdue", "Fine (₹)", "Status"];
        const activeRows = await db.prepare(`
          SELECT 
            l.loan_code as "Loan Code",
            b.title as "Book Title",
            b.book_code as "Book Code",
            b.isbn as "ISBN",
            m.full_name as "Member Name",
            m.member_code as "Member Code",
            m.phone as "Member Phone",
            l.issue_date as "Issue Date",
            l.due_date as "Due Date",
            l.notes as "Notes"
          FROM loans l
          JOIN books b ON l.book_id = b.id
          JOIN members m ON l.member_id = m.id
          WHERE l.return_date IS NULL
          ORDER BY l.due_date ASC
        `).all();

        data = activeRows.map(row => {
          const { daysOverdue, fineAmount } = calculateOverdueFine(row['Due Date']);
          return {
            ...row,
            "Days Overdue": daysOverdue,
            "Fine (₹)": fineAmount,
            "Status": daysOverdue > 0 ? 'Overdue' : 'Issued'
          };
        });
        filename = `active-loans-report-${today}`;
        break;

      case 'returned-books':
      case 'returns':
        defaultHeaders = ["Loan Code", "Book Title", "Book Code", "Member Name", "Member Code", "Issue Date", "Due Date", "Return Date", "Fine Amount (₹)", "Fine Status", "Notes"];
        let returnQuery = `
          SELECT 
            l.loan_code as "Loan Code",
            b.title as "Book Title",
            b.book_code as "Book Code",
            m.full_name as "Member Name",
            m.member_code as "Member Code",
            l.issue_date as "Issue Date",
            l.due_date as "Due Date",
            l.return_date as "Return Date",
            l.fine_amount as "Fine Amount (₹)",
            CASE WHEN l.fine_paid = 1 THEN 'Paid' ELSE 'Unpaid/None' END as "Fine Status",
            l.notes as "Notes"
          FROM loans l
          JOIN books b ON l.book_id = b.id
          JOIN members m ON l.member_id = m.id
          WHERE l.return_date IS NOT NULL
        `;
        const retParams = [];
        if (start_date && end_date) {
          returnQuery += ` AND l.return_date BETWEEN ? AND ?`;
          retParams.push(start_date, end_date);
        }
        returnQuery += ` ORDER BY l.return_date DESC`;
        data = await db.prepare(returnQuery).all(...retParams);
        filename = `returned-books-report-${today}`;
        break;

      case 'overdue':
        defaultHeaders = ["Loan Code", "Book Title", "Book Code", "Shelf", "Member Name", "Member Code", "Member Email", "Member Phone", "Issue Date", "Due Date", "Days Overdue", "Fine Rate / Day (₹)", "Total Fine (₹)", "Status"];
        const overdueRows = await db.prepare(`
          SELECT 
            l.loan_code as "Loan Code",
            b.title as "Book Title",
            b.book_code as "Book Code",
            b.shelf_location as "Shelf",
            m.full_name as "Member Name",
            m.member_code as "Member Code",
            m.email as "Member Email",
            m.phone as "Member Phone",
            l.issue_date as "Issue Date",
            l.due_date as "Due Date"
          FROM loans l
          JOIN books b ON l.book_id = b.id
          JOIN members m ON l.member_id = m.id
          WHERE l.return_date IS NULL AND l.due_date < ?
          ORDER BY l.due_date ASC
        `).all(today);

        data = overdueRows.map(row => {
          const { daysOverdue, fineAmount } = calculateOverdueFine(row['Due Date']);
          return {
            ...row,
            "Days Overdue": daysOverdue,
            "Fine Rate / Day (₹)": fineRate,
            "Total Fine (₹)": fineAmount,
            "Status": "Overdue"
          };
        });
        filename = `overdue-books-report-${today}`;
        break;

      case 'fines':
        defaultHeaders = ["Fine ID", "Loan Code", "Member Name", "Member Code", "Phone", "Days Overdue", "Fine Amount (₹)", "Payment Status", "Payment Date", "Created Date"];
        data = await db.prepare(`
          SELECT 
            f.id as "Fine ID",
            l.loan_code as "Loan Code",
            m.full_name as "Member Name",
            m.member_code as "Member Code",
            m.phone as "Phone",
            f.days_overdue as "Days Overdue",
            f.amount as "Fine Amount (₹)",
            f.status as "Payment Status",
            f.payment_date as "Payment Date",
            f.created_at as "Created Date"
          FROM fines f
          JOIN loans l ON f.loan_id = l.id
          JOIN members m ON f.member_id = m.id
          ORDER BY f.id DESC
        `).all();
        filename = `fines-summary-report-${today}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type. Supported types: inventory, members, active-loans, returned-books, overdue, fines'
        });
    }

    // CSV format export
    if (format.toLowerCase() === 'csv') {
      const csvData = jsonToCsv(data, defaultHeaders);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvData);
    }

    // JSON response
    return res.status(200).json({
      success: true,
      report_type: type,
      total_records: data.length,
      data
    });
  } catch (error) {
    console.error('getReport error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report.'
    });
  }
}

/**
 * Get Report Summary Stats (High level metrics for reports dashboard)
 */
async function getReportSummary(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const inventory = await db.prepare('SELECT COUNT(*) as titles, SUM(total_copies) as total_copies, SUM(available_copies) as available_copies FROM books').get();
    const members = await db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active FROM members").get();
    const activeLoans = await db.prepare('SELECT COUNT(*) as active FROM loans WHERE return_date IS NULL').get();
    const returnedLoans = await db.prepare('SELECT COUNT(*) as returned FROM loans WHERE return_date IS NOT NULL').get();
    const overdueLoans = await db.prepare('SELECT COUNT(*) as overdue FROM loans WHERE return_date IS NULL AND due_date < ?').get(today);
    const fines = await db.prepare("SELECT SUM(amount) as total_fines, SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) as paid_fines, SUM(CASE WHEN status = 'Unpaid' THEN amount ELSE 0 END) as unpaid_fines FROM fines").get();

    return res.status(200).json({
      success: true,
      summary: {
        totalTitles: Number(inventory?.titles || 0),
        totalCopies: Number(inventory?.total_copies || 0),
        availableCopies: Number(inventory?.available_copies || 0),
        totalMembers: Number(members?.total || 0),
        activeMembers: Number(members?.active || 0),
        activeLoansCount: Number(activeLoans?.active || 0),
        returnedLoansCount: Number(returnedLoans?.returned || 0),
        overdueLoansCount: Number(overdueLoans?.overdue || 0),
        totalFinesGenerated: Number(fines?.total_fines || 0),
        totalFinesPaid: Number(fines?.paid_fines || 0),
        totalFinesUnpaid: Number(fines?.unpaid_fines || 0)
      }
    });
  } catch (error) {
    console.error('getReportSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve report summary.'
    });
  }
}

module.exports = {
  getReport,
  getReportSummary
};

