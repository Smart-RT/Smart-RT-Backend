const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..') });

const knex = require('knex')({
    client: 'mysql',
    connection: {
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        timezone: 'utc',
        charset: 'utf8mb4',
    },
});

module.exports = knex;
