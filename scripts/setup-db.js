const { setupSchema } = require("../src/schema");
const { countRows } = require("../src/repository");
const { closePool } = require("../src/db");
const { config } = require("../src/config");

async function main() {
  await setupSchema();
  const tables = await countRows();
  console.log(`数据库已准备好：${config.db.database}`);
  console.log(JSON.stringify(tables, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
