const { connectDatabase } = require("../../src/config/database");

async function startService({ app, port, serviceName }) {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`${serviceName} listening on port ${port}`);
    });
  } catch (error) {
    console.error(`${serviceName} failed to start:`, error.message);
    process.exit(1);
  }
}

module.exports = { startService };
