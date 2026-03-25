const mongoose = require("mongoose");
const { mongodbUri } = require("./env");

async function connectDatabase() {
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not configured. Add it to your .env file.");
  }

  await mongoose.connect(mongodbUri);
  console.log("Database connected");
}

module.exports = { connectDatabase };
