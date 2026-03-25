const app = require("./app");

const port = Number(process.env.GATEWAY_PORT || 5000);

app.listen(port, () => {
  console.log(`api-gateway listening on port ${port}`);
});
