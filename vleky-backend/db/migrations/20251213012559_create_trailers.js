exports.up = async function (knex) {
  const has = await knex.schema.hasTable('trailers');
  if (has) return;

  await knex.schema.createTable('trailers', (table) => {
    table.increments('id').primary();

    // základ
    table.string('name').notNullable();

    // hmotnosti (kg)
    table.integer('total_weight_kg'); // celková hmotnost
    table.integer('payload_kg');      // nosnost

    // rozměry ložné plochy (m)
    table.decimal('bed_width_m', 6, 2);
    table.decimal('bed_length_m', 6, 2);

    // zakrytí (text / enum si doladíme později)
    table.string('cover');

    // lokalita + souřadnice
    table.string('location');
    table.decimal('lat', 10, 6);
    table.decimal('lng', 10, 6);

    // cena
    table.integer('price_per_day_czk');

    // dočasně "majitel" jako text (později nahradíme půjčovnou)
    table.string('owner_name');

    // popis
    table.text('description');

    // fotky – uložíme jako JSON string (pole URL)
    table.text('photos_json');

    // vazba na půjčovnu (už jsme dřív přidávali rental_id do trailers,
    // ale když náhodou neexistuje, tady ho přidáme rovnou)
    table.integer('rental_id').references('id').inTable('rentals');

    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('trailers');
};

