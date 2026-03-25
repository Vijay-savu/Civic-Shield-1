const app = require("./app");
const { connectDatabase } = require("./config/database");
const { port } = require("./config/env");

async function startServer() {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  }
}

startServer();
