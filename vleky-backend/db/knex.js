const path = require('path');

const DB_FILE = path.resolve(__dirname, 'database.sqlite');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: DB_FILE,
    },
    useNullAsDefault: true,

    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      tableName: 'knex_migrations',
    },
  },
};
