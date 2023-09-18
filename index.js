// -- IMPORT
    // Import Konfigurasi dari file .env
    require('dotenv').config();
    // Import Express Server
    const express = require('express');

    //  Import file service account
    const serviceAccount = require('./smart-rt-a2abb-firebase-adminsdk-gl0xs-77ea75454f.json');
    // Import Firebase Admin SDK
    const firebaseAdmin = require('firebase-admin');
    // Inisialisasi Firebase Admin SDK 
    firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount)
    });

    // Import path
    const path = require('path');
    // Import DB
    const database = require('./src/database');
    // Import Routes
    const routes = require('./src/routes');
    // Import Middleware Auth
    const { auth } = require('./src/middleware/auth');
    // Import Git Webhook
    const { verifyGitHubWebHook, execPullInstall } = require('./src/utils/gitwebhook');
// -- IMPORT


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

// Agar server bisa git pull - npm install, saat ada push di github
server.use('/gitpull', verifyGitHubWebHook, (req, res, next) =>{
    console.log("Pull Command Received");
    execPullInstall(`cd ${__dirname} && git pull && npm install && echo ${process.env.SERVER_PASS} | sudo -S systemctl restart ${process.env.SERVICE_NAME}`, (err, response) => {
        if (!err) {
            console.log({response});
        }
        else {
            console.log({err});
        }
    });
    res.status(200).send("Pull Command Received");
});

// Jalankan express server
server.listen(process.env.PORT, () => {
    // Jika berhasil di jalankan maka akan menampilkan tulisan "Server Jalan di [port]"
    console.log(`Server Jalan di ${process.env.PORT}`);
});