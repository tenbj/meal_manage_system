const { config } = require("./config");
const { setupSchema } = require("./schema");
const { createApp } = require("./app");

async function main() {
  await setupSchema();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`减脂双餐后台已启动：http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
