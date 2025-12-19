exports.up = async function (knex) {
  await knex.schema.table("pins", (t) => {
    t.integer("trailerId").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table("pins", (t) => {
    t.dropColumn("trailerId");
  });
};
