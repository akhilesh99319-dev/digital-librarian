const { db } = require('../database/db');

/**
 * Get all categories with book counts
 */
function getAllCategories(req, res) {
  try {
    const categories = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.created_at,
        COUNT(b.id) as book_count,
        COALESCE(SUM(b.total_copies), 0) as total_copies,
        COALESCE(SUM(b.available_copies), 0) as available_copies
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      GROUP BY c.id, c.name, c.description, c.created_at
      ORDER BY c.name ASC
    `).all();

    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('getAllCategories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories.'
    });
  }
}

/**
 * Get Category by ID
 */
function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    const books = db.prepare('SELECT * FROM books WHERE category_id = ? ORDER BY title ASC').all(id);

    return res.status(200).json({
      success: true,
      data: {
        ...category,
        books
      }
    });
  } catch (error) {
    console.error('getCategoryById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve category details.'
    });
  }
}

/**
 * Create a new Category
 */
function createCategory(req, res) {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = ?').get(trimmedName.toLowerCase());
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Category "${trimmedName}" already exists.`
      });
    }

    const result = db.prepare(`
      INSERT INTO categories (name, description)
      VALUES (?, ?)
    `).run(trimmedName, description ? description.trim() : null);

    const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: newCategory
    });
  } catch (error) {
    console.error('createCategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create category.'
    });
  }
}

/**
 * Update Category
 */
function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const trimmedName = name.trim();

    // Check duplicate name
    const dup = db.prepare('SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?').get(trimmedName.toLowerCase(), id);
    if (dup) {
      return res.status(400).json({
        success: false,
        message: `Another category named "${trimmedName}" already exists.`
      });
    }

    db.prepare(`
      UPDATE categories
      SET name = ?, description = ?
      WHERE id = ?
    `).run(trimmedName, description ? description.trim() : null, id);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('updateCategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update category.'
    });
  }
}

/**
 * Delete Category
 */
function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    // Check if books are assigned to this category
    const bookCount = db.prepare('SELECT COUNT(*) as count FROM books WHERE category_id = ?').get(id).count;
    if (bookCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}" because it contains ${bookCount} book(s). Please reassign or delete these books first.`
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      message: `Category "${category.name}" was deleted successfully.`
    });
  } catch (error) {
    console.error('deleteCategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category.'
    });
  }
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
