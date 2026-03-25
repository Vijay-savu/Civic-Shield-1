function monitor(event, details = {}) {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    event,
    ...details,
  };

  console.log("[monitor]", JSON.stringify(payload));
}

module.exports = {
  monitor,
};
