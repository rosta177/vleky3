const path = require("path");

const DB_FILE = path.resolve(process.cwd(), "database.sqlite");

module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: DB_FILE,
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(process.cwd(), "src/db/migrations"),
      tableName: "knex_migrations",
    },
  },
};
