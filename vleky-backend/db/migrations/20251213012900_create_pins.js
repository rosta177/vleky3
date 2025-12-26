exports.up = function (knex) {
  return knex.schema.createTable("pins", (table) => {
    table.increments("id").primary();

    // vazby / identifikace
    table.integer("lockId").notNullable();

    // samotný PIN a platnost
    table.string("pin", 32).notNullable();
    table.datetime("validFrom").notNullable();
    table.datetime("validTo").notNullable();

    // audit
    table.datetime("createdAt").notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("pins");
};
