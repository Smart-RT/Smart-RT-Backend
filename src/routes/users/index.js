// Import
const router = require('express').Router();
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const knex = require('../../database');
const { stringUtils } = require('../../utils');

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
                born_date: moment(tanggalLahir, 'YYYY/MM/DD').toDate(),
                phone: noTelp,
                password: hashedPassword,
                created_at: moment().toDate()
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
        if (!user) { return res.status(400).json('Nomor Telepon tidak terdaftar'); }

        let passwordSama = bcrypt.compareSync(kataSandi, user.password);
        if (!passwordSama) { return res.status(400).json('Kata Sandi salah'); }

        let payload = {
            id: user.id,
            phone: user.phone,
        }

        let jwtToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE_TIME
        });

        let refreshToken = [...Array(15)].map(i => (~~(Math.random() * 36)).toString(36)).join('');

        await knex('users').update({ refresh_token: refreshToken }).where('id', '=', user.id);

        return res.status(200).json({
            user: payload,
            token: jwtToken,
            refreshToken: refreshToken
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// -- End Login

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
