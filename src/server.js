const { config } = require("./config");
const { setupSchema } = require("./schema");
const { createApp } = require("./app");

async function main() {
  if(process.env.AUTO_MIGRATE!=='false') throw new Error('Run node scripts/migrate.js before startup; set AUTO_MIGRATE=false');
  const app = createApp();
  const server=app.listen(config.port,'0.0.0.0', async () => {
    console.log(`减脂双餐后台已启动：http://localhost:${config.port}`);
  });
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await require('./db').closePool();process.exit(0);}));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
