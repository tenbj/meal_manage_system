const { createDatabaseIfNeeded, getPool } = require("./db");

const TABLES = [
  "customers",
  "orders",
  "dishes",
  "recipes",
  "daily_out",
  "feedbacks",
  "labels",
  "deliveries",
  "posters",
];

async function setupSchema() {
  await createDatabaseIfNeeded();
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      nickname VARCHAR(80) NULL,
      phone VARCHAR(40) NOT NULL,
      gender VARCHAR(20) NULL,
      age INT NULL,
      height DECIMAL(8,2) NULL,
      current_weight DECIMAL(8,2) NULL,
      target_weight DECIMAL(8,2) NULL,
      activity VARCHAR(40) NULL,
      pace VARCHAR(40) NULL,
      address TEXT NULL,
      restrictions JSON NULL,
      dislikes JSON NULL,
      allergies JSON NULL,
      notes TEXT NULL,
      weight_records JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customers_phone (phone),
      INDEX idx_customers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      order_no VARCHAR(64) NOT NULL,
      customer_id VARCHAR(64) NOT NULL,
      service_type VARCHAR(40) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL,
      paid_status VARCHAR(40) NOT NULL,
      is_repurchase TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      completion_rate INT NOT NULL DEFAULT 0,
      total_meal_credits INT NOT NULL DEFAULT 0,
      pause_rule TEXT NULL,
      weight_records JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_orders_order_no (order_no),
      INDEX idx_orders_customer_dates (customer_id, start_date, end_date),
      INDEX idx_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dishes (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(40) NOT NULL,
      ingredients JSON NULL,
      kcal100 DECIMAL(10,2) NOT NULL DEFAULT 0,
      protein DECIMAL(10,2) NOT NULL DEFAULT 0,
      fat DECIMAL(10,2) NOT NULL DEFAULT 0,
      carbs DECIMAL(10,2) NOT NULL DEFAULT 0,
      source TEXT NULL,
      garlic TINYINT(1) NOT NULL DEFAULT 0,
      conflicts JSON NULL,
      available TINYINT(1) NOT NULL DEFAULT 1,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dishes_category (category),
      INDEX idx_dishes_available (available)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id VARCHAR(64) PRIMARY KEY,
      recipe_date DATE NOT NULL,
      meals JSON NOT NULL,
      replacements JSON NULL,
      generated_at VARCHAR(40) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_recipes_date (recipe_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_out (
      id VARCHAR(64) PRIMARY KEY,
      out_date DATE NOT NULL,
      meal VARCHAR(20) NOT NULL,
      customer_id VARCHAR(64) NOT NULL,
      items JSON NOT NULL,
      paused TINYINT(1) NOT NULL DEFAULT 0,
      pause_policy VARCHAR(40) NULL,
      pause_reason TEXT NULL,
      pause_updated_at VARCHAR(40) NULL,
      extension_order_id VARCHAR(64) NULL,
      replaced TINYINT(1) NOT NULL DEFAULT 0,
      needs_replacement TINYINT(1) NOT NULL DEFAULT 0,
      note TEXT NULL,
      generated_at VARCHAR(40) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_daily_date_meal (out_date, meal),
      INDEX idx_daily_customer_date (customer_id, out_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id VARCHAR(64) PRIMARY KEY,
      feedback_date DATE NOT NULL,
      customer_id VARCHAR(64) NOT NULL,
      weight DECIMAL(8,2) NULL,
      lunch_finished VARCHAR(20) NULL,
      dinner_finished VARCHAR(20) NULL,
      satiety VARCHAR(20) NULL,
      dislike_dish TEXT NULL,
      body_note TEXT NULL,
      admin_note TEXT NULL,
      processed TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_feedbacks_customer_date (customer_id, feedback_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await payloadTable(pool, "labels", "label_date", "meal");
  await payloadTable(pool, "deliveries", "delivery_date", "meal");
  await payloadTable(pool, "posters", "generated_at", "order_id");
}

async function payloadTable(pool, table, dateColumn, secondaryColumn) {
  const dateType = dateColumn === "generated_at" ? "VARCHAR(40)" : "DATE";
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id VARCHAR(64) PRIMARY KEY,
      ${dateColumn} ${dateType} NULL,
      ${secondaryColumn} VARCHAR(64) NULL,
      customer_id VARCHAR(64) NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_${table}_date (${dateColumn}),
      INDEX idx_${table}_customer (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = { setupSchema, TABLES };
