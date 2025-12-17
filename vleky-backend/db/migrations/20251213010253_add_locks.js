exports.up = async function (knex) {
  const hasLocks = await knex.schema.hasTable('locks');
  if (!hasLocks) {
    await knex.schema.createTable('locks', (table) => {
      table.increments('id').primary();

      // vazba na vlek
      table.integer('trailer_id').notNullable()
        .references('id').inTable('trailers')
        .onDelete('CASCADE');

      // poskytovatel zámku (teď igloohome, později klidně palock/abus/...)
      table.string('provider').notNullable().defaultTo('igloohome');

      // iglohome deviceId
      table.string('device_id').notNullable();

      // volitelné info
      table.string('name');              // např. "Zámek č. 1"
      table.boolean('active').notNullable().defaultTo(true);

      table.timestamps(true, true);

      // 1 zámek na 1 vlek (když bys chtěl víc zámků na vlek, zrušíme unique)
      table.unique(['trailer_id']);

      // device_id by měl být unikátní (stejný zámek nepřiřadíš 2 vlečkům)
      table.unique(['provider', 'device_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('locks');
};
