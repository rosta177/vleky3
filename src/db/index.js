const knexConfig = require("./knex");

const env = process.env.NODE_ENV || "development";
const knex = require("knex")(knexConfig[env]);

module.exports = { knex };
