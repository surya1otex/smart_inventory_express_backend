const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

const loadEnv = () => {
  if (loaded) return;

  // Optional project root .env (local overrides)
  dotenv.config();

  // Canonical app settings — wins over root .env so JWT_SECRET in config/.env is never shadowed by an empty root var
  dotenv.config({
    path: path.join(__dirname, '..', 'config', '.env'),
    override: true,
  });

  loaded = true;
};

module.exports = {
  loadEnv
};
