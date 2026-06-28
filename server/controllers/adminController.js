const db = require('../config/db');

// ============================================================================
// Users Management
// ============================================================================

const listUsers = async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (!['resident', 'authority', 'admin'].includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid role' } });
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } });
    res.json({ message: 'User role updated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Wards Management
// ============================================================================

const listWards = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM wards ORDER BY name');
    res.json({ wards: result.rows });
  } catch (error) {
    next(error);
  }
};

const createWard = async (req, res, next) => {
  try {
    const { name, code, county, constituency, authority_id } = req.body;
    if (!name || !county) return res.status(400).json({ error: { message: 'name and county required' } });

    const result = await db.query(
      `INSERT INTO wards (name, code, county, constituency, authority_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code, county, constituency, authority_id || null]
    );
    res.status(201).json({ ward: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateWard = async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.id);
    const { name, code, county, constituency, authority_id, is_active } = req.body;
    
    const result = await db.query(
      `UPDATE wards 
       SET name = COALESCE($1, name), code = COALESCE($2, code), county = COALESCE($3, county),
           constituency = COALESCE($4, constituency), authority_id = COALESCE($5, authority_id),
           is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [name, code, county, constituency, authority_id, is_active, wardId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Ward not found' } });
    res.json({ ward: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteWard = async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.id);
    const result = await db.query('DELETE FROM wards WHERE id = $1 RETURNING id', [wardId]);
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Ward not found' } });
    res.json({ message: 'Ward deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Categories Management
// ============================================================================

const listCategories = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: { message: 'name required' } });

    const result = await db.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const catId = parseInt(req.params.id);
    const { name, description } = req.body;
    const result = await db.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, catId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Category not found' } });
    res.json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const catId = parseInt(req.params.id);
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [catId]);
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Category not found' } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Authorities Management
// ============================================================================

const listAuthorities = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM authorities ORDER BY name');
    res.json({ authorities: result.rows });
  } catch (error) {
    next(error);
  }
};

const createAuthority = async (req, res, next) => {
  try {
    const { name, type, jurisdiction, contact_email, phone, website } = req.body;
    if (!name || !type) return res.status(400).json({ error: { message: 'name and type required' } });

    const result = await db.query(
      `INSERT INTO authorities (name, type, jurisdiction, contact_email, phone, website)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, jurisdiction, contact_email, phone, website]
    );
    res.status(201).json({ authority: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateAuthority = async (req, res, next) => {
  try {
    const authId = parseInt(req.params.id);
    const { name, type, jurisdiction, contact_email, phone, website, is_active } = req.body;
    
    const result = await db.query(
      `UPDATE authorities 
       SET name = COALESCE($1, name), type = COALESCE($2, type), jurisdiction = COALESCE($3, jurisdiction),
           contact_email = COALESCE($4, contact_email), phone = COALESCE($5, phone), website = COALESCE($6, website),
           is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [name, type, jurisdiction, contact_email, phone, website, is_active, authId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'Authority not found' } });
    res.json({ authority: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Category-Authority Mapping
// ============================================================================

const mapCategoryToAuthority = async (req, res, next) => {
  try {
    const { category_id, authority_id } = req.body;
    if (!category_id || !authority_id) return res.status(400).json({ error: { message: 'category_id and authority_id required' } });

    await db.query(
      'INSERT INTO category_authority_map (category_id, authority_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [category_id, authority_id]
    );
    res.status(201).json({ message: 'Category mapped to Authority successfully' });
  } catch (error) {
    next(error);
  }
};

const unmapCategoryFromAuthority = async (req, res, next) => {
  try {
    const { category_id, authority_id } = req.body;
    if (!category_id || !authority_id) return res.status(400).json({ error: { message: 'category_id and authority_id required' } });

    await db.query(
      'DELETE FROM category_authority_map WHERE category_id = $1 AND authority_id = $2',
      [category_id, authority_id]
    );
    res.json({ message: 'Mapping removed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers, updateUserRole, deleteUser,
  listWards, createWard, updateWard, deleteWard,
  listCategories, createCategory, updateCategory, deleteCategory,
  listAuthorities, createAuthority, updateAuthority,
  mapCategoryToAuthority, unmapCategoryFromAuthority
};
