const pool = require('../config/db');

const UserModel = {
  async createUser({ name, email, passwordHash }) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id, name, email, is_admin, created_at`,
      [name, email, passwordHash]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    return rows[0];
  },

  async findById(userId) {
    const { rows } = await pool.query(
      `SELECT user_id, name, email, is_admin, created_at FROM users WHERE user_id = $1`,
      [userId]
    );
    return rows[0];
  },
};

module.exports = UserModel;