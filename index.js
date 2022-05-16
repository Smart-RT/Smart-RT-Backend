require('dotenv').config();
const express = require('express');
const path = require('path');
const server = express();
const database = require('./src/database');
const routes = require('./src/routes');

server.use(express.urlencoded({ extended: true }));
server.use('/public', express.static(path.join(__dirname, 'public')));
server.use('/api', routes);

server.listen(process.env.PORT, () => {
    console.log(`Server Jalan di ${process.env.PORT}`);
});
