exports.up = async function (knex) {

  // 1) Adresy
  const hasAddresses = await knex.schema.hasTable('addresses');
  if (!hasAddresses) {
    await knex.schema.createTable('addresses', table => {
      table.increments('id').primary();
      table.string('line1').notNullable();
      table.string('line2');
      table.string('city').notNullable();
      table.string('zip').notNullable();
      table.string('country', 2).notNullable().defaultTo('CZ');
      table.timestamps(true, true);
    });
  }

  // 2) Půjčovna = majitel
  const hasRentals = await knex.schema.hasTable('rentals');
  if (!hasRentals) {
    await knex.schema.createTable('rentals', table => {
      table.increments('id').primary();

      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('email').notNullable();
      table.string('phone').notNullable();
      table.string('ico');
      table.string('dic');

      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.boolean('is_active').notNullable().defaultTo(true);

      table.integer('billing_address_id').references('id').inTable('addresses');
      table.integer('pickup_address_id').references('id').inTable('addresses');

      table.string('payout_account_iban');
      table.string('payout_account_local');
      table.string('payout_account_name');

      table.string('stripe_account_id');

      table.timestamps(true, true);
    });
  }

  // 3) Napojení vleku na půjčovnu
  const hasTrailers = await knex.schema.hasTable('trailers');
  if (hasTrailers) {
    const hasColumn = await knex.schema.hasColumn('trailers', 'rental_id');
    if (!hasColumn) {
      await knex.schema.table('trailers', table => {
        table.integer('rental_id').references('id').inTable('rentals');
      });
    }
  }
};

exports.down = async function (knex) {
  // rollback opatrně (trailers může existovat a mít data)
  const hasTrailers = await knex.schema.hasTable('trailers');
  if (hasTrailers) {
    const hasColumn = await knex.schema.hasColumn('trailers', 'rental_id');
    if (hasColumn) {
      await knex.schema.table('trailers', table => {
        table.dropColumn('rental_id');
      });
    }
  }

  await knex.schema.dropTableIfExists('rentals');
  await knex.schema.dropTableIfExists('addresses');
};
