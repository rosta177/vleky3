const knex = require("./knex");

async function createPinsTable() {
  const exists = await knex.schema.hasTable("pins");

  if (!exists) {
    await knex.schema.createTable("pins", (table) => {
      table.increments("id").primary();
      table.string("reservationId").notNullable();
      table.string("deviceId").notNullable();
      table.string("pin").notNullable();
      table.string("pinId"); // není vždy dostupný
      table.string("type").notNullable(); // hourly / daily
      table.datetime("startAt").notNullable();
      table.datetime("endAt").notNullable();

      table.datetime("createdAt").defaultTo(knex.fn.now());
      table.datetime("deletedAt").nullable();
    });

    console.log("🚀 Tabulka 'pins' vytvořena.");
  } else {
    console.log("Tabulka 'pins' už existuje.");
  }

  process.exit(0);
}

createPinsTable();
