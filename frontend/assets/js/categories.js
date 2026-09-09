/**
 * Categories Management: List, Add, Edit, Delete
 */

let deleteCandidateCatId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  setupEventListeners();
});

function setupEventListeners() {
  const addBtn = document.getElementById('addCategoryBtn');
  const form = document.getElementById('categoryForm');
  const confirmDeleteBtn = document.getElementById('confirmDeleteCatBtn');

  if (addBtn) {
    addBtn.addEventListener('click', openAddCategoryModal);
  }

  if (form) {
    form.addEventListener('submit', handleCategoryFormSubmit);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', executeDeleteCategory);
  }
}

async function loadCategories() {
  const tbody = document.getElementById('categoriesTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="loading-state"><div class="spinner"></div><p>Loading categories...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/categories');
    if (res.success && res.data) {
      renderCategoriesTable(res.data);
    } else {
      throw new Error(res.message || 'Failed to load categories');
    }
  } catch (err) {
    console.error('loadCategories error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="error-state"><p class="error-msg">${err.message}</p><button class="btn btn-sm btn-secondary" onclick="loadCategories()">Retry</button></div></td></tr>`;
    }
  }
}

function renderCategoriesTable(categories) {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;

  if (categories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <h4>No Categories Created</h4>
            <p>Add your first category to start organizing books.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = categories.map(cat => `
    <tr>
      <td><strong style="color:#fff;font-size:14px;">${escapeHtml(cat.name)}</strong></td>
      <td><span style="color:#94a3b8;">${escapeHtml(cat.description || '—')}</span></td>
      <td><span class="badge badge-info">${cat.book_count} Titles</span></td>
      <td><span class="badge badge-success">${cat.available_copies} / ${cat.total_copies} Available</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" title="Edit Category" onclick="openEditCategoryModal(${cat.id}, '${escapeHtml(cat.name)}', '${escapeHtml(cat.description || '')}')">
            ✏️
          </button>
          <button class="btn btn-sm btn-danger" title="Delete Category" onclick="promptDeleteCategory(${cat.id}, '${escapeHtml(cat.name)}')">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddCategoryModal() {
  const form = document.getElementById('categoryForm');
  if (form) form.reset();
  document.getElementById('catModalId').value = '';
  document.getElementById('catModalTitle').textContent = 'Create New Category';
  document.getElementById('catSubmitBtnText').textContent = 'Create Category';
  openModal('categoryModal');
}

function openEditCategoryModal(id, name, desc) {
  document.getElementById('catModalId').value = id;
  document.getElementById('catName').value = name;
  document.getElementById('catDescription').value = desc || '';
  document.getElementById('catModalTitle').textContent = `Edit Category: ${name}`;
  document.getElementById('catSubmitBtnText').textContent = 'Save Changes';
  openModal('categoryModal');
}

async function handleCategoryFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('catModalId').value;
  const isEditing = !!id;

  const payload = {
    name: document.getElementById('catName').value.trim(),
    description: document.getElementById('catDescription').value.trim()
  };

  if (!payload.name) {
    showToast('Category name is required.', 'warning');
    return;
  }

  const btn = document.getElementById('catSubmitBtn');
  if (btn) btn.disabled = true;

  try {
    if (isEditing) {
      const res = await api.put(`/categories/${id}`, payload);
      showToast(res.message || 'Category updated!', 'success');
    } else {
      const res = await api.post('/categories', payload);
      showToast(res.message || 'Category created!', 'success');
    }

    closeModal('categoryModal');
    loadCategories();
  } catch (err) {
    showToast(err.message || 'Failed to save category', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function promptDeleteCategory(id, name) {
  deleteCandidateCatId = id;
  const nameEl = document.getElementById('deleteCatName');
  if (nameEl) nameEl.textContent = name;
  openModal('deleteCatModal');
}

async function executeDeleteCategory() {
  if (!deleteCandidateCatId) return;

  const btn = document.getElementById('confirmDeleteCatBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await api.delete(`/categories/${deleteCandidateCatId}`);
    showToast(res.message || 'Category deleted.', 'success');
    closeModal('deleteCatModal');
    loadCategories();
  } catch (err) {
    showToast(err.message || 'Failed to delete category.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    deleteCandidateCatId = null;
  }
}
