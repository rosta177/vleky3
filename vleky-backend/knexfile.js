require("dotenv").config();

module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: "./db/database.sqlite",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./db/migrations",
    },
  },
};
