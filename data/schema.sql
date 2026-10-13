CREATE TABLE IF NOT EXISTS app_users (id INT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(32) COLLATE utf8mb4_bin NOT NULL UNIQUE, display_name VARCHAR(80) NOT NULL, password_hash VARCHAR(200) NOT NULL, credentials_migrated TINYINT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_sessions (token_hash CHAR(64) PRIMARY KEY, owner_id INT NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (owner_id), INDEX (expires_at), FOREIGN KEY (owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_tokens (id CHAR(36) PRIMARY KEY, owner_id INT NOT NULL, name VARCHAR(80) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, scope VARCHAR(10) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (owner_id), FOREIGN KEY (owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(64),
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
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_customers_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64),
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
      UNIQUE KEY uk_orders_order_no (owner_id,order_no),
      INDEX idx_orders_customer_dates (customer_id, start_date, end_date),
      INDEX idx_orders_status (status)
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_orders_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dishes (
      id VARCHAR(64),
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
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_dishes_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipes (
      id VARCHAR(64),
      recipe_date DATE NOT NULL,
      meals JSON NOT NULL,
      replacements JSON NULL,
      generated_at VARCHAR(40) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_recipes_date (owner_id,recipe_date)
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_recipes_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_out (
      id VARCHAR(64),
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
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_daily_out_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedbacks (
      id VARCHAR(64),
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
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_feedbacks_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS labels (
      id VARCHAR(64),
      label_date DATE NULL,
      meal VARCHAR(64) NULL,
      customer_id VARCHAR(64) NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_labels_date (label_date),
      INDEX idx_labels_customer (customer_id)
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_labels_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deliveries (
      id VARCHAR(64),
      delivery_date DATE NULL,
      meal VARCHAR(64) NULL,
      customer_id VARCHAR(64) NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deliveries_date (delivery_date),
      INDEX idx_deliveries_customer (customer_id)
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_deliveries_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posters (
      id VARCHAR(64),
      generated_at VARCHAR(40) NULL,
      order_id VARCHAR(64) NULL,
      customer_id VARCHAR(64) NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_posters_date (generated_at),
      INDEX idx_posters_customer (customer_id)
    , owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_posters_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_requests (request_id VARCHAR(100), fingerprint CHAR(64) NOT NULL, actor VARCHAR(30) NOT NULL, evidence TEXT NOT NULL, response JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, owner_id INT NOT NULL, PRIMARY KEY(owner_id,request_id), CONSTRAINT fk_api_requests_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS merchant_integrations (
 provider VARCHAR(40),
 credential TEXT NOT NULL,
 version INT NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
, owner_id INT NOT NULL, PRIMARY KEY(owner_id,provider), CONSTRAINT fk_merchant_integrations_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS merchant_workspace (id INT, revision INT NOT NULL, payload JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, owner_id INT NOT NULL, PRIMARY KEY(owner_id,id), CONSTRAINT fk_merchant_workspace_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;