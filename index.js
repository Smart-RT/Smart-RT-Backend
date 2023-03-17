// -- IMPORT
    // Import Konfigurasi dari file .env
    require('dotenv').config();
    // Import Express Server
    const express = require('express');
    // Import Firebase Admin SDK
    const firebaseAdmin = require('firebase-admin');
    //  Import file service account
    const serviceAccount = require('./smart-rt-a2abb-firebase-adminsdk-gl0xs-77ea75454f.json');
    // Import path
    const path = require('path');
    // Import DB
    const database = require('./src/database');
    // Import Routes
    const routes = require('./src/routes');
    // Import Middleware Auth
    const { auth } = require('./src/middleware/auth');
// -- IMPORT

// Inisialisasi Firebase Admin SDK 
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount)
});

// Buat Server Express
const server = express();

// Agar Server Express bisa terima body / form dengan format JSON
server.use(express.json());

// Agar Server Express bisa terima body / form dengan format x-www-form-urlencoded
server.use(express.urlencoded({ extended: true }));

// Untuk nyediain file statis di express
server.use('/public', express.static(path.join(__dirname, 'public')));

// Masukkan router yang sudah dibuat, dan dapat diakses pada url /api (contoh localhost:3000/api)
server.use('/api', auth, routes);

// Jalankan express server
server.listen(process.env.PORT, () => {
    // Jika berhasil di jalankan maka akan menampilkan tulisan "Server Jalan di [port]"
    console.log(`Server Jalan di ${process.env.PORT}`);
});