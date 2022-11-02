// Import
const router = require('express').Router();
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const knex = require('../../database');
const { stringUtils, tokenUtils } = require('../../utils');
const firebaseAdmin = require('firebase-admin');
const {
    uploadItemImage,
    uploadSignatureImage,
    uploadItemFileLampiran,
} = require('../../middleware/upload');
const { isAuthenticated } = require('../../middleware/auth');

// -- REGISTER
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
// -- End REGISTER

// -- LOGIN
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

        let userRoleReq = await knex('user_role_requests')
            .where('requester_id', '=', user.id)
            .orderBy('id', 'desc');
        payload.user_role_requests = userRoleReq;
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
// -- End LOGIN

// -- UID FIREBASE
router.post('/verifyUID/:uid', async (req, res) => {
    let { uid } = req.params;
    let firebaseAuth = firebaseAdmin.auth();
    let userFirebase = await firebaseAuth.getUser(uid);
    if (!userFirebase.phoneNumber)
        return res.status(400).json('UID tidak valid');
    console.log(userFirebase);
    return res.status(200).json('OK');
});
// -- End UID FIREBASE

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
        return res.status(200).json(req.file.filename);
    }
);
// -- END UPLOAD PROFILE PICTURE

// -- UPDATE PROFILE (Nama, Jenis Kelamin, Tanggal Lahir, Alamat)
router.patch('/updateProfile/:uid', isAuthenticated, async (req, res) => {
    let { uid } = req.params;
    let { full_name, gender, born_date, address } = req.body;
    console.log(born_date);
    try {
        // Cek token dengan user id di URL sama
        if (req.authenticatedUser.id != uid) {
            return res.status(400).json('ID User tidak valid');
        }

        // Cek user ID dan Data Lainnya
        let user = await knex('users').where('id', '=', uid).first();
        if (
            !user ||
            stringUtils.isEmptyString(full_name) ||
            stringUtils.isEmptyString(gender) ||
            stringUtils.isEmptyString(born_date) ||
            stringUtils.isEmptyString(address)
        ) {
            return res
                .status(400)
                .json('ID User tidak valid / ada data kosong');
        }

        await knex('users')
            .update({
                full_name: full_name,
                gender: gender,
                born_date: moment
                    .tz(born_date, 'YYYY-MM-DD', 'Asia/Jakarta')
                    .format('YYYY-MM-DD'),
                address: address,
            })
            .where('id', '=', uid);
        return res.status(200).json('Update Berhasil');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// -- END UPDATE PROFILE (Nama, Jenis Kelamin, Tanggal Lahir, Alamat)

// -- REFRESH TOKEN
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
// -- END REFRESH TOKEN

// -- GET MY PROFILE
router.get('/myprofile', isAuthenticated, async (req, res) => {
    try {
        let id = req.authenticatedUser.id;
        let myUser = await knex('users').where('id', '=', id).first();
        delete myUser.password;
        return res.status(200).json(myUser);
    } catch (error) {
        return res.status(500).json('ERROR');
    }
});
// -- END GET MY PROFILE

// -- UPLOAD SIGNATURE PNG
router.patch(
    '/uploadSignatureImage/:uid',
    isAuthenticated,
    uploadSignatureImage.single('signatureImage'),
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
            .update({ sign_img: req.file.filename })
            .where('id', '=', uid);
        return res.status(200).json(req.file.filename);
    }
);
// -- END UPLOAD SIGNATURE PNG

// -- REQ USER ROLE
router.post(
    '/reqUserRole',
    isAuthenticated,
    uploadItemFileLampiran.single('fileLampiran'),
    async (req, res) => {
        let uid = req.authenticatedUser.id;
        let { request_role, request_code } = req.body;
        console.log(req.file);
        try {
            // Cek user ID
            let user = await knex('users').where('id', '=', uid).first();
            if (!user) {
                return res.status(400).json('ID User tidak valid');
            }

            let userRoleReqActive = await knex('user_role_requests')
                .where('confirmater_id', 'IS', null)
                .first();
            if (userRoleReqActive) {
                return res.status(400).json('Req Role masih ada yang active');
            }

            // Req Jadi Warga
            if (request_role == 3) {
                if (
                    stringUtils.isEmptyString(request_code) ||
                    stringUtils.isEmptyString(request_role)
                ) {
                    return res.status(400).json('Data tidak valid');
                }

                // Cek Kode Wilayah Valid
                let wilayahTujuan = await knex('areas')
                    .where('area_code', '=', request_code)
                    .first();
                if (!wilayahTujuan) {
                    return res.status(400).json('Kode Wilayah tidak valid');
                }

                let confirmater_role_id = 7;
                let area_id = wilayahTujuan.id;
                let newID = await knex('user_role_requests').insert({
                    requester_id: uid,
                    confirmater_role_id: confirmater_role_id,
                    area_id: area_id,
                    request_code: request_code,
                    request_role: request_role,
                    created_at: moment().toDate(),
                });
                let newReq = await knex('user_role_requests')
                    .where('id', '=', newID)
                    .first();
                return res.status(200).json(newReq);
            }
            // Req Bendahara || Sekretaris || Wakil
            else if (
                request_role == 4 ||
                request_role == 5 ||
                request_role == 6
            ) {
                if (
                    stringUtils.isEmptyString(request_code) ||
                    stringUtils.isEmptyString(request_role)
                ) {
                    return res.status(400).json('Data tidak valid');
                }

                let wilayah = await knex('areas')
                    .where('id', '=', user.area_id)
                    .first();
                if (!wilayah) {
                    return res.status(400).json('Kode Wilayah tidak valid');
                }

                if (
                    (request_role == 4 &&
                        request_code != wilayah.bendara_code) ||
                    (request_role == 5 &&
                        request_code != wilayah.sekretaris_code) ||
                    (request_role == 6 &&
                        request_code != wilayah.wakil_ketua_code)
                ) {
                    return res.status(400).json('Kode tidak valid');
                }

                await knex('user_role_requests').insert({
                    requester_id: uid,
                    confirmater_role_id: wilayah.ketua_id,
                    area_id: wilayah.area_id,
                    request_code: request_code,
                    request_role: request_role,
                    created_at: moment().toDate(),
                });
                return res.status(200).json('Berhasil Requests');
            }

            return res.status(400).json('Error');
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR!');
        }
    }
);
// -- END REQ USER ROLE

// -- UPDATE USER ROLE (Konfirmasi Req User Role)
router.patch('/updateUserRoleRequest', isAuthenticated, async (req, res) => {
    let byuid = req.authenticatedUser;
    let { user_role_requests_id, isAccepted } = req.body;

    // Cek data dari req.body tidak kosong
    if (
        stringUtils.isEmptyString(user_role_requests_id) ||
        stringUtils.isEmptyString(isAccepted)
    ) {
        return res.status(400).json('Data tidak valid');
    }

    try {
        let userRoleRequest = await knex('user_role_requests')
            .where('id', '=', user_role_requests_id)
            .first();
        let userConfirmater = await knex('users')
            .where('id', '=', byuid.id)
            .first();

        // Cek data userRoleReq dan userConfirmater valid
        if (!userConfirmater || !userRoleRequest) {
            return res.status(400).json('Data tidak valid');
        }

        if (
            userRoleRequest.confirmater_role_id != byuid.user_role &&
            userRoleRequest.requester_id != byuid.id
        ) {
            return res.status(400).json('Anda tidak memiliki privillage');
        }

        if (eval(isAccepted)) {
            console.log('MASOKKKKKK');
            let wilayah = await knex('areas')
                .where('area_code', '=', userRoleRequest.area_id)
                .first();

            await knex('user_role_requests')
                .update({
                    confirmater_id: byuid.id,
                    accepted_at: moment().toDate(),
                })
                .where('id', '=', user_role_requests_id);

            if (userRoleRequest.request_role == 3) {
                await knex('users')
                    .update({
                        user_role: userRoleRequest.request_role,
                        area_id: userRoleRequest.area_id,
                        rt_num: wilayah.rt_num,
                        rw_num: wilayah.rw_num,
                        sub_district_id: sub_district_id,
                        urban_village_id: urban_village_id,
                    })
                    .where('id', '=', userRoleRequest.requester_id);
            } else if (
                userRoleRequest.request_role == 4 ||
                userRoleRequest.request_role == 5 ||
                userRoleRequest.request_role == 6
            ) {
                await knex('users')
                    .update({
                        user_role: userRoleRequest.request_role,
                    })
                    .where('id', '=', userRoleRequest.requester_id);
            }
        } else {
            await knex('user_role_requests')
                .update({
                    confirmater_id: byuid.id,
                    rejected_at: moment().toDate(),
                })
                .where('id', '=', user_role_requests_id);
        }
        let userRoleReqAfterUpdate = await knex('user_role_requests')
            .where('id', '=', user_role_requests_id)
            .first();
        return res.status(200).json(userRoleReqAfterUpdate);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// -- END UPDATE USER ROLE (Konfirmasi Req User Role)

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
