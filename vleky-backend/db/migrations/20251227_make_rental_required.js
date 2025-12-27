exports.up = async function (knex) {
  // 1) zajistit, že existuje aspoň jedna půjčovna
  const rental = await knex("rentals").first("id");

  let rentalId;
  if (!rental) {
    const ids = await knex("rentals").insert({
  first_name: "Výchozí",
  last_name: "Správce",
  name: "Výchozí půjčovna",
  slug: "vychozi-pujcovna",
  email: "admin@vleky.local",
  phone: "+420000000000",
  created_at: knex.fn.now(),
  updated_at: knex.fn.now(),
});



    rentalId = Array.isArray(ids) ? ids[0] : ids;
  } else {
    rentalId = rental.id;
  }

  // 2) doplnit rental_id všem trailerům, kde je NULL
  await knex("trailers").whereNull("rental_id").update({ rental_id: rentalId });

  // 3) SQLite: přestavba tabulky s NOT NULL
  await knex.schema.raw(`
    CREATE TABLE trailers_new (
      id INTEGER PRIMARY KEY,
      name varchar(255) NOT NULL,
      total_weight_kg integer,
      payload_kg integer,
      bed_width_m float,
      bed_length_m float,
      cover varchar(255),
      location varchar(255),
      lat float,
      lng float,
      price_per_day_czk integer,
      owner_name varchar(255),
      description text,
      photos_json text,
      rental_id integer NOT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await knex.schema.raw(`
    INSERT INTO trailers_new
    SELECT
      id, name, total_weight_kg, payload_kg,
      bed_width_m, bed_length_m, cover, location,
      lat, lng, price_per_day_czk, owner_name,
      description, photos_json, rental_id,
      created_at, updated_at
    FROM trailers;
  `);

  await knex.schema.raw(`DROP TABLE trailers;`);
  await knex.schema.raw(`ALTER TABLE trailers_new RENAME TO trailers;`);
};

exports.down = async function (knex) {
  // rollback neděláme
};
