const { db } = require('../database/db');

/**
 * Get all books with search, category filtering, and pagination
 */
async function getAllBooks(req, res) {
  try {
    const { search, category_id, available_only, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        b.id,
        b.book_code,
        b.title,
        b.author,
        b.category_id,
        c.name as category_name,
        b.isbn,
        b.publisher,
        b.publication_year,
        b.total_copies,
        b.available_copies,
        b.shelf_location,
        b.cover_image,
        b.created_at
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE 1=1
    `;
    
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.book_code LIKE ? OR b.shelf_location LIKE ? OR c.name LIKE ?)`;
      params.push(s, s, s, s, s, s);
    }

    if (category_id) {
      query += ` AND b.category_id = ?`;
      params.push(category_id);
    }

    if (available_only === 'true' || available_only === '1') {
      query += ` AND b.available_copies > 0`;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countStmt = db.prepare(countQuery);
    const countRow = await countStmt.get(...params);
    const totalCount = countRow ? Number(countRow.total || 0) : 0;

    query += ` ORDER BY b.id DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const books = await db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      data: books,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getAllBooks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve books.'
    });
  }
}

/**
 * Get single book by ID with active loans count
 */
async function getBookById(req, res) {
  try {
    const { id } = req.params;
    const book = await db.prepare(`
      SELECT 
        b.*,
        c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `).get(id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    // Get active loans of this book
    const activeLoans = await db.prepare(`
      SELECT 
        l.id,
        l.loan_code,
        l.issue_date,
        l.due_date,
        l.status,
        m.full_name as member_name,
        m.member_code
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE l.book_id = ? AND l.return_date IS NULL
      ORDER BY l.due_date ASC
    `).all(id);

    return res.status(200).json({
      success: true,
      data: {
        ...book,
        active_loans: activeLoans
      }
    });
  } catch (error) {
    console.error('getBookById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve book details.'
    });
  }
}

/**
 * Create a new book
 */
async function createBook(req, res) {
  try {
    const {
      title,
      author,
      category_id,
      isbn,
      publisher,
      publication_year,
      total_copies,
      shelf_location,
      cover_image
    } = req.body;

    if (!title || !author || !category_id || !isbn) {
      return res.status(400).json({
        success: false,
        message: 'Title, Author, Category, and ISBN are required.'
      });
    }

    const trimmedIsbn = isbn.trim();

    // Check duplicate ISBN
    const existingIsbn = await db.prepare('SELECT id FROM books WHERE LOWER(isbn) = ?').get(trimmedIsbn.toLowerCase());
    if (existingIsbn) {
      return res.status(400).json({
        success: false,
        message: `A book with ISBN "${trimmedIsbn}" already exists in the catalog.`
      });
    }

    // Verify category exists
    const category = await db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Category selected.'
      });
    }

    const totalCopiesNum = parseInt(total_copies) > 0 ? parseInt(total_copies) : 1;
    const availableCopiesNum = totalCopiesNum; // Initially all copies are available

    // Generate unique Book Code (e.g., BK-1050)
    const maxIdRow = await db.prepare('SELECT MAX(id) as max_id FROM books').get();
    const nextCodeId = (maxIdRow?.max_id || 1000) + 1;
    const bookCode = `BK-${nextCodeId}`;

    const insertStmt = db.prepare(`
      INSERT INTO books (
        book_code, title, author, category_id, isbn, publisher,
        publication_year, total_copies, available_copies, shelf_location, cover_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insertStmt.run(
      bookCode,
      title.trim(),
      author.trim(),
      parseInt(category_id),
      trimmedIsbn,
      publisher ? publisher.trim() : null,
      publication_year ? parseInt(publication_year) : null,
      totalCopiesNum,
      availableCopiesNum,
      shelf_location ? shelf_location.trim() : 'General Shelf',
      cover_image ? cover_image.trim() : ''
    );

    const createdBook = await db.prepare(`
      SELECT b.*, c.name as category_name 
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id 
      WHERE b.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Book added successfully to library catalog.',
      data: createdBook
    });
  } catch (error) {
    console.error('createBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add new book.'
    });
  }
}

/**
 * Update existing book
 */
async function updateBook(req, res) {
  try {
    const { id } = req.params;
    const {
      title,
      author,
      category_id,
      isbn,
      publisher,
      publication_year,
      total_copies,
      shelf_location,
      cover_image
    } = req.body;

    const existingBook = await db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    if (!title || !author || !category_id || !isbn) {
      return res.status(400).json({
        success: false,
        message: 'Title, Author, Category, and ISBN are required.'
      });
    }

    const trimmedIsbn = isbn.trim();
    // Check duplicate ISBN on other books
    const dupIsbn = await db.prepare('SELECT id FROM books WHERE LOWER(isbn) = ? AND id != ?').get(trimmedIsbn.toLowerCase(), id);
    if (dupIsbn) {
      return res.status(400).json({
        success: false,
        message: `Another book with ISBN "${trimmedIsbn}" already exists.`
      });
    }

    const newTotalCopies = parseInt(total_copies) > 0 ? parseInt(total_copies) : 1;
    const issuedCopies = existingBook.total_copies - existingBook.available_copies;

    if (newTotalCopies < issuedCopies) {
      return res.status(400).json({
        success: false,
        message: `Total copies cannot be less than currently issued copies (${issuedCopies} copies currently on loan).`
      });
    }

    // Recalculate available copies safely
    const newAvailableCopies = newTotalCopies - issuedCopies;

    await db.prepare(`
      UPDATE books 
      SET 
        title = ?,
        author = ?,
        category_id = ?,
        isbn = ?,
        publisher = ?,
        publication_year = ?,
        total_copies = ?,
        available_copies = ?,
        shelf_location = ?,
        cover_image = ?
      WHERE id = ?
    `).run(
      title.trim(),
      author.trim(),
      parseInt(category_id),
      trimmedIsbn,
      publisher ? publisher.trim() : null,
      publication_year ? parseInt(publication_year) : null,
      newTotalCopies,
      newAvailableCopies,
      shelf_location ? shelf_location.trim() : null,
      cover_image !== undefined ? cover_image : existingBook.cover_image,
      id
    );

    const updatedBook = await db.prepare(`
      SELECT b.*, c.name as category_name 
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id 
      WHERE b.id = ?
    `).get(id);

    return res.status(200).json({
      success: true,
      message: 'Book updated successfully.',
      data: updatedBook
    });
  } catch (error) {
    console.error('updateBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update book.'
    });
  }
}

/**
 * Delete a book
 */
async function deleteBook(req, res) {
  try {
    const { id } = req.params;

    const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    // Check if book has active loans
    const activeLoan = await db.prepare('SELECT id FROM loans WHERE book_id = ? AND return_date IS NULL LIMIT 1').get(id);
    if (activeLoan) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete this book because it currently has active/overdue loans. Please ensure all copies are returned first.'
      });
    }

    // Check if there are past loan records
    const pastLoan = await db.prepare('SELECT id FROM loans WHERE book_id = ? LIMIT 1').get(id);
    if (pastLoan) {
      await db.prepare('DELETE FROM fines WHERE loan_id IN (SELECT id FROM loans WHERE book_id = ?)').run(id);
      await db.prepare('DELETE FROM loans WHERE book_id = ?').run(id);
    }

    await db.prepare('DELETE FROM books WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      message: `Book "${book.title}" was deleted successfully.`
    });
  } catch (error) {
    console.error('deleteBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete book.'
    });
  }
}

module.exports = {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
};

