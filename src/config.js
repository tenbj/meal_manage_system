const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const config = {
  port: Number(process.env.PORT || 3200),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "meal_manage_system_v2",
    charset: process.env.DB_CHARSET || "utf8mb4",
  },
};

function assertConfig() {
  const missing = [];
  if (!config.db.host) missing.push("DB_HOST");
  if (!config.db.user) missing.push("DB_USER");
  if (!config.db.password) missing.push("DB_PASSWORD");
  if (!config.db.database) missing.push("DB_NAME");
  if (missing.length) {
    throw new Error(`缺少环境变量：${missing.join(", ")}`);
  }
}

module.exports = { config, assertConfig };
