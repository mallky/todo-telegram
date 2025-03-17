const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  authPlugins: {
    mysql_native_password: () => () =>
      Buffer.from(process.env.DB_PASSWORD + "\0"),
  },
});

const Task = {
  async create({ userId, text, priority, dueDate }) {
    const [result] = await pool.execute(
      "INSERT INTO tasks (user_id, text, priority, due_date) VALUES (?, ?, ?, ?)",
      [userId, text, priority, dueDate]
    );
    return result.insertId;
  },

  async findByUserId(userId) {
    const [rows] = await pool.execute(
      "SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date",
      [userId]
    );
    return rows;
  },

  async findTodayTasks(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [rows] = await pool.execute(
      "SELECT * FROM tasks WHERE user_id = ? AND due_date >= ? AND due_date < ?",
      [userId, today, tomorrow]
    );
    return rows;
  },

  async findTomorrowTasks(userId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const [rows] = await pool.execute(
      "SELECT * FROM tasks WHERE user_id = ? AND due_date >= ? AND due_date < ?",
      [userId, tomorrow, dayAfterTomorrow]
    );
    return rows;
  },

  async findMonthTasks(userId) {
    const firstDay = new Date();
    firstDay.setDate(1);
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(
      firstDay.getFullYear(),
      firstDay.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const [rows] = await pool.execute(
      "SELECT * FROM tasks WHERE user_id = ? AND due_date >= ? AND due_date <= ? ORDER BY due_date",
      [userId, firstDay, lastDay]
    );
    return rows;
  },

  async markAsDone(taskId, userId) {
    const [result] = await pool.execute(
      "UPDATE tasks SET completed = true WHERE id = ? AND user_id = ?",
      [taskId, userId]
    );
    return result.affectedRows > 0;
  },

  async delete(taskId, userId) {
    const [result] = await pool.execute(
      "DELETE FROM tasks WHERE id = ? AND user_id = ?",
      [taskId, userId]
    );
    return result.affectedRows > 0;
  },

  // Initialize database table
  async initTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        due_date DATETIME NOT NULL,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tasks table initialized");
  },
};

module.exports = { Task, pool };
