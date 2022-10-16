// Import
const router = require('express').Router();
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const knex = require('../../database');
const { stringUtils, tokenUtils } = require('../../utils');
const firebaseAdmin = require('firebase-admin');
const { uploadItemImage } = require('../../middleware/upload');
const { isAuthenticated } = require('../../middleware/auth');

// -- Register
router.post('/register', async (req, res) => {
    let { namaLengkap, jenisKelamin, tanggalLahir, noTelp, kataSandi } =
        req.body;

    try {
        let user = await knex('users').where('phone', '=', noTelp).first();

        if (
            user ||
            stringUtils.isEmptyString(namaLengkap) ||
            stringUtils.isEmptyString(jenisKelamin) ||
            !stringUtils.isOneOf(jenisKelamin, ['perempuan', 'laki-laki']) ||
            stringUtils.isEmptyString(tanggalLahir) ||
            stringUtils.isEmptyString(noTelp) ||
            !stringUtils.isPhoneValid(noTelp) ||
            stringUtils.isEmptyString(kataSandi)
        ) {
            return res.status(400).json('Input tidak valid');
        } else {
            let hashedPassword = bcrypt.hashSync(kataSandi, 10);

            let newUser = await knex('users').insert({
                full_name: namaLengkap,
                gender: jenisKelamin,
                born_date: moment(tanggalLahir, 'YYYY-MM-DD').toDate(),
                phone: noTelp,
                password: hashedPassword,
                created_at: moment().toDate(),
            });
            return res.status(200).json(newUser);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// -- End Register

// -- Login
router.post('/login', async (req, res) => {
    let { noTelp, kataSandi } = req.body;
    try {
        let user = await knex('users').where('phone', '=', noTelp).first();

        if (!user) {
            return res.status(400).json('Nomor Telepon tidak terdaftar');
        }

        let passwordSama = bcrypt.compareSync(kataSandi, user.password);
        if (!passwordSama) {
            return res.status(400).json('Kata Sandi salah');
        }

        delete user.password;

        let payload = { ...user };

        // let jwtToken = jwt.sign(payload, process.env.JWT_SECRET, {
        //     expiresIn: process.env.JWT_EXPIRE_TIME,
        // });
        let jwtToken = tokenUtils.createJWT(payload);

        let refreshToken = tokenUtils.createRefreshToken(15);

        await knex('users')
            .update({ refresh_token: refreshToken })
            .where('id', '=', user.id);

        return res.status(200).json({
            user: payload,
            token: jwtToken,
            refreshToken: refreshToken,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// -- End Login

// -- UID Firebase
router.post('/verifyUID/:uid', async (req, res) => {
    let { uid } = req.params;
    let firebaseAuth = firebaseAdmin.auth();
    let userFirebase = await firebaseAuth.getUser(uid);
    if (!userFirebase.phoneNumber)
        return res.status(400).json('UID tidak valid');
    console.log(userFirebase);
    return res.status(200).json('OK');
});
// -- End UID Firebase

// -- UPLOAD PROFILE PICTURE
router.patch(
    '/uploadProfilePicture/:uid',
    isAuthenticated,
    uploadItemImage.single('profilePicture'),
    async (req, res) => {
        let { uid } = req.params;

        //Cek token dengan user id di URL sama
        if (req.authenticatedUser.id != uid) {
            return res.status(400).json('ID User tidak valid');
        }

        // Cek user ID
        let user = await knex('users').where('id', '=', uid).first();
        if (!user) {
            return res.status(400).json('ID User tidak valid');
        }

        await knex('users')
            .update({ photo_profile_img: req.file.filename })
            .where('id', '=', uid);
        return res.status(200).json('Upload Berhasil');
    }
);
// -- END UPLOAD PROFILE PICTURE


// -- UPDATE PROFILE (Nama, Jenis Kelamin, Tanggal Lahir, Alamat)
router.patch('/updateProfile/:uid', isAuthenticated, async (req, res) => {
    let { uid } = req.params;
    let { full_name, gender, born_date, address } = req.body;

    try {
        // Cek token dengan user id di URL sama
        if (req.authenticatedUser.id != uid) {
            return res.status(400).json('ID User tidak valid');
        }

        // Cek user ID dan Data Lainnya
        let user = await knex('users').where('id', '=', uid).first();
        if (!user || 
            stringUtils.isEmptyString(full_name) ||
            stringUtils.isEmptyString(gender) ||
            stringUtils.isEmptyString(born_date) ||
            stringUtils.isEmptyString(address)) {
            return res.status(400).json('ID User tidak valid');
        } else{
            await knex('users')
            .update({ 
                full_name: full_name, 
                gender: gender,
                born_date:  moment(born_date, 'YYYY-MM-DD').toDate(),
                address: address
            })
            .where('id', '=', uid);
            return res.status(200).json('Upload Berhasil');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }

    

   
})
// -- END UPDATE PROFILE (Nama, Jenis Kelamin, Tanggal Lahir, Alamat)

// -- Refresh Token
router.post('/refreshToken/:id', async (req, res) => {
    let { id } = req.params;
    let { refreshTokenUser } = req.body;
    try {
        let user = await knex('users')
            .where('id', '=', id)
            .where('refresh_token', '=', refreshTokenUser)
            .first();
        if (!user) return res.status(400).json('Refresh Token Tidak Valid');
        delete user.password;
        let payload = { ...user };
        let jwtToken = tokenUtils.createJWT(payload);
        let refreshToken = tokenUtils.createRefreshToken(15);
        await knex('users')
            .update({ refresh_token: refreshToken })
            .where('id', '=', user.id);
        return res.status(200).json({
            user: payload,
            token: jwtToken,
            refreshToken: refreshToken,
        });
    } catch (error) {
        return res.status(500).json('ERROR');
    }
});
// -- End Refresh Token





router.get('/', async (req, res) => {
    let users = await knex('users');
    return res.status(200).json(users);
});

router.get('/:id', async (req, res) => {
    let user = await knex('users').where('id', '=', req.params.id).first();
    return res.status(200).json(user);
});

router.post('/', async (req, res) => {
    console.log(req.body);
    return res.status(200).json('OK');
});

module.exports = router;
