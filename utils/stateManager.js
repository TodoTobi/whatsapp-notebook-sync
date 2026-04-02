const fs = require("fs");

const FILE = "state.json";

function getState() {
  if (!fs.existsSync(FILE)) return { lastMessage: null };
  return JSON.parse(fs.readFileSync(FILE));
}

function setState(lastMessage) {
  fs.writeFileSync(FILE, JSON.stringify({ lastMessage }, null, 2));
}

module.exports = { getState, setState };