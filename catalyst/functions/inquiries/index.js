// Catalyst entry point (Advanced I/O, Node.js). Wires the tested handler to Catalyst's SDK.
// Package names and calls follow Catalyst's JavaScript SDK docs:
//   https://docs.catalyst.zoho.com/en/sdk/javascript/v1/auth-config/node-consideration/
//   https://docs.catalyst.zoho.com/en/sdk/javascript/v1/cloudscale/datastore/insert-rows/
// If `catalyst functions:add` generates a different entry-point shape, keep its shape and call `handle`
// the same way.

const { zcAuth } = require("@zcatalyst/auth");
const { Datastore } = require("@zcatalyst/datastore");
const { handle } = require("./handler");

module.exports = async (req, res) => {
  await handle(req, res, {
    expectedKey: process.env.INQUIRY_KEY,
    insert: async (row) => {
      await zcAuth.init(req); // runs inside your Catalyst project with its own access; no stored passwords
      return new Datastore().table("Inquiries").insertRow(row);
    },
  });
};
