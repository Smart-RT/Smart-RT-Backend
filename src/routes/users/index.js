// Import
const router = require('express').Router();
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const knex = require('../../database');
const { stringUtils, tokenUtils } = require('../../utils');
const firebaseAdmin = require('firebase-admin');
const fs = require('fs-extra');
const path = require('path');

const {
    uploadItemImage,
    uploadSignatureImage,
    uploadItemFileLampiran,
} = require('../../middleware/upload');
const { isAuthenticated } = require('../../middleware/auth');
const { randomVarchar } = require('../../utils/strings');

// === REGISTER
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

            let newUserID = await knex('users').insert({
                full_name: namaLengkap,
                gender: jenisKelamin,
                born_date: moment(tanggalLahir, 'YYYY-MM-DD').toDate(),
                phone: noTelp,
                password: hashedPassword,
                created_at: moment().toDate(),
            });
            return res.status(200).json(newUserID[0]);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === LOGIN
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

        let dataSubDistrict = await knex('sub_districts')
            .where('id', '=', user.sub_district_id).first();
        let dataUrbanVillage = await knex({ u: 'urban_villages' })
            .select('u.*', {
                id_kecamatan: 'sd.id',
                nama_kecamatan: 'sd.name',
                wilayah: 'sd.wilayah',
            }).where('u.id', '=', user.urban_village_id)
            .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id');

        dataUrbanVillage = dataUrbanVillage.map((x) => {
            return {
                id: x.id,
                name: x.name,
                kecamatan: {
                    id: x.id_kecamatan,
                    nama_kecamatan: x.nama_kecamatan,
                    wilayah: x.wilayah,
                },
            };
        });
        user.data_sub_district = dataSubDistrict;
        user.data_urban_village = dataUrbanVillage[0];

        let payload = { ...user };

        // let jwtToken = jwt.sign(payload, process.env.JWT_SECRET, {
        //     expiresIn: process.env.JWT_EXPIRE_TIME,
        // });
        let jwtToken = tokenUtils.createJWT(payload);

        let refreshToken = tokenUtils.createRefreshToken(15);

        await knex('users')
            .update({ refresh_token: refreshToken })
            .where('id', '=', user.id);

        // ambil user role request.
        let userRoleReq = await knex('user_role_requests')
            .where('requester_id', '=', user.id)
            .orderBy('id', 'desc');

        for (let idx = 0; idx < userRoleReq.length; idx++) {
            if (userRoleReq[idx].request_role == 7) {
                // Ambil data urban village dari userRoleReq.
                let urbanVillage = await knex('urban_villages')
                    .where('id', '=', userRoleReq[idx].urban_village_id)
                    .first();

                // Ambil data kecamatan (?) dari urbanVillage
                let subDistrict = await knex('sub_districts')
                    .where('id', '=', urbanVillage.kecamatan_id)
                    .first();

                userRoleReq[idx].sub_district_id = subDistrict;
                userRoleReq[idx].urban_village_id = urbanVillage;
                userRoleReq[idx].urban_village_id.kecamatan = {
                    id: urbanVillage.kecamatan_id,
                };
            }
        }

        payload.user_role_requests = userRoleReq;

        if (user.user_role != 0 && user.user_role != 1 && user.user_role != 2) {
            // Ambil data Area
            let dataArea = await knex('areas')
                .where('id', '=', user.area_id)
                .first();

            if (dataArea.lottery_club_id != null) {
                let dataLotteryClub = await knex('lottery_clubs')
                    .where('id', '=', dataArea.lottery_club_id)
                    .first();
                dataArea.lottery_club_id = dataLotteryClub;
            }

            let dataKetuaRT = await knex('users')
                .where('id', '=', dataArea.ketua_id)
                .first();
            delete dataKetuaRT.rt_num;
            delete dataKetuaRT.sub_district_id;
            delete dataKetuaRT.urban_village_id;
            delete dataKetuaRT.rw_num;
            delete dataKetuaRT.born_at;
            delete dataKetuaRT.born_date;
            delete dataKetuaRT.religion;
            delete dataKetuaRT.is_married;
            delete dataKetuaRT.profession;
            delete dataKetuaRT.password;
            delete dataKetuaRT.is_lottery_club_member;
            delete dataKetuaRT.task_rating;
            delete dataKetuaRT.sign_img;
            delete dataKetuaRT.total_serving_as_neighbourhood_head;
            delete dataKetuaRT.refresh_token;
            delete dataKetuaRT.created_at;
            delete dataKetuaRT.created_by;
            dataArea.ketua_id = dataKetuaRT;

            if (dataArea.wakil_ketua_id) {
                let dataWakilKetuaRT = await knex('users')
                    .where('id', '=', dataArea.wakil_ketua_id)
                    .first();
                delete dataWakilKetuaRT.rt_num;
                delete dataWakilKetuaRT.sub_district_id;
                delete dataWakilKetuaRT.urban_village_id;
                delete dataWakilKetuaRT.rw_num;
                delete dataWakilKetuaRT.born_at;
                delete dataWakilKetuaRT.born_date;
                delete dataWakilKetuaRT.religion;
                delete dataWakilKetuaRT.is_married;
                delete dataWakilKetuaRT.profession;
                delete dataWakilKetuaRT.password;
                delete dataWakilKetuaRT.is_lottery_club_member;
                delete dataWakilKetuaRT.task_rating;
                delete dataWakilKetuaRT.sign_img;
                delete dataWakilKetuaRT.total_serving_as_neighbourhood_head;
                delete dataWakilKetuaRT.refresh_token;
                delete dataWakilKetuaRT.created_at;
                delete dataWakilKetuaRT.created_by;
                dataArea.wakil_ketua_id = dataWakilKetuaRT;
            }
            if (dataArea.sekretaris_id) {
                let dataSekretaris = await knex('users')
                    .where('id', '=', dataArea.sekretaris_id)
                    .first();
                delete dataSekretaris.rt_num;
                delete dataSekretaris.sub_district_id;
                delete dataSekretaris.urban_village_id;
                delete dataSekretaris.rw_num;
                delete dataSekretaris.born_at;
                delete dataSekretaris.born_date;
                delete dataSekretaris.religion;
                delete dataSekretaris.is_married;
                delete dataSekretaris.profession;
                delete dataSekretaris.password;
                delete dataSekretaris.is_lottery_club_member;
                delete dataSekretaris.task_rating;
                delete dataSekretaris.sign_img;
                delete dataSekretaris.total_serving_as_neighbourhood_head;
                delete dataSekretaris.refresh_token;
                delete dataSekretaris.created_at;
                delete dataSekretaris.created_by;
                dataArea.sekretaris_id = dataSekretaris;
            }
            if (dataArea.bendahara_id) {
                let dataBendahara = await knex('users')
                    .where('id', '=', dataArea.bendahara_id)
                    .first();
                delete dataBendahara.rt_num;
                delete dataBendahara.sub_district_id;
                delete dataBendahara.urban_village_id;
                delete dataBendahara.rw_num;
                delete dataBendahara.born_at;
                delete dataBendahara.born_date;
                delete dataBendahara.religion;
                delete dataBendahara.is_married;
                delete dataBendahara.profession;
                delete dataBendahara.password;
                delete dataBendahara.is_lottery_club_member;
                delete dataBendahara.task_rating;
                delete dataBendahara.sign_img;
                delete dataBendahara.total_serving_as_neighbourhood_head;
                delete dataBendahara.refresh_token;
                delete dataBendahara.created_at;
                delete dataBendahara.created_by;
                dataArea.bendahara_id = dataBendahara;
            }
            payload.area = dataArea;
        }




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
// === END

// === GET
router.post('/get', async (req, res) => {
    let { id } = req.body;
    try {
        let user = await knex('users').where('id', '=', id).first();

        if (!user) {
            return res.status(400).json('Data tidak valid!');
        }

        delete user.password;

        let dataSubDistrict = await knex('sub_districts')
            .where('id', '=', user.sub_district_id).first();
        let dataUrbanVillage = await knex({ u: 'urban_villages' })
            .select('u.*', {
                id_kecamatan: 'sd.id',
                nama_kecamatan: 'sd.name',
                wilayah: 'sd.wilayah',
            }).where('u.id', '=', user.urban_village_id)
            .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id');

        dataUrbanVillage = dataUrbanVillage.map((x) => {
            return {
                id: x.id,
                name: x.name,
                kecamatan: {
                    id: x.id_kecamatan,
                    nama_kecamatan: x.nama_kecamatan,
                    wilayah: x.wilayah,
                },
            };
        });
        user.data_sub_district = dataSubDistrict;
        user.data_urban_village = dataUrbanVillage[0];

        let payload = { ...user };

        // let jwtToken = jwt.sign(payload, process.env.JWT_SECRET, {
        //     expiresIn: process.env.JWT_EXPIRE_TIME,
        // });
        let jwtToken = tokenUtils.createJWT(payload);

        // ambil user role request.
        let userRoleReq = await knex('user_role_requests')
            .where('requester_id', '=', user.id)
            .orderBy('id', 'desc');

        for (let idx = 0; idx < userRoleReq.length; idx++) {
            if (userRoleReq[idx].request_role == 7) {
                // Ambil data urban village dari userRoleReq.
                let urbanVillage = await knex('urban_villages')
                    .where('id', '=', userRoleReq[idx].urban_village_id)
                    .first();

                // Ambil data kecamatan (?) dari urbanVillage
                let subDistrict = await knex('sub_districts')
                    .where('id', '=', urbanVillage.kecamatan_id)
                    .first();

                userRoleReq[idx].sub_district_id = subDistrict;
                userRoleReq[idx].urban_village_id = urbanVillage;
                userRoleReq[idx].urban_village_id.kecamatan = {
                    id: urbanVillage.kecamatan_id,
                };
            }
        }

        payload.user_role_requests = userRoleReq;

        if (user.user_role != 0 && user.user_role != 1 && user.user_role != 2) {
            // Ambil data Area
            let dataArea = await knex('areas')
                .where('id', '=', user.area_id)
                .first();

            if (dataArea.lottery_club_id != null) {
                let dataLotteryClub = await knex('lottery_clubs')
                    .where('id', '=', dataArea.lottery_club_id)
                    .first();
                dataArea.lottery_club_id = dataLotteryClub;
            }

            let dataKetuaRT = await knex('users')
                .where('id', '=', dataArea.ketua_id)
                .first();
            delete dataKetuaRT.rt_num;
            delete dataKetuaRT.sub_district_id;
            delete dataKetuaRT.urban_village_id;
            delete dataKetuaRT.rw_num;
            delete dataKetuaRT.born_at;
            delete dataKetuaRT.born_date;
            delete dataKetuaRT.religion;
            delete dataKetuaRT.is_married;
            delete dataKetuaRT.profession;
            delete dataKetuaRT.password;
            delete dataKetuaRT.is_lottery_club_member;
            delete dataKetuaRT.task_rating;
            delete dataKetuaRT.sign_img;
            delete dataKetuaRT.total_serving_as_neighbourhood_head;
            delete dataKetuaRT.refresh_token;
            delete dataKetuaRT.created_at;
            delete dataKetuaRT.created_by;
            dataArea.ketua_id = dataKetuaRT;

            if (dataArea.wakil_ketua_id) {
                let dataWakilKetuaRT = await knex('users')
                    .where('id', '=', dataArea.wakil_ketua_id)
                    .first();
                delete dataWakilKetuaRT.rt_num;
                delete dataWakilKetuaRT.sub_district_id;
                delete dataWakilKetuaRT.urban_village_id;
                delete dataWakilKetuaRT.rw_num;
                delete dataWakilKetuaRT.born_at;
                delete dataWakilKetuaRT.born_date;
                delete dataWakilKetuaRT.religion;
                delete dataWakilKetuaRT.is_married;
                delete dataWakilKetuaRT.profession;
                delete dataWakilKetuaRT.password;
                delete dataWakilKetuaRT.is_lottery_club_member;
                delete dataWakilKetuaRT.task_rating;
                delete dataWakilKetuaRT.sign_img;
                delete dataWakilKetuaRT.total_serving_as_neighbourhood_head;
                delete dataWakilKetuaRT.refresh_token;
                delete dataWakilKetuaRT.created_at;
                delete dataWakilKetuaRT.created_by;
                dataArea.wakil_ketua_id = dataWakilKetuaRT;
            }
            if (dataArea.sekretaris_id) {
                let dataSekretaris = await knex('users')
                    .where('id', '=', dataArea.sekretaris_id)
                    .first();
                delete dataSekretaris.rt_num;
                delete dataSekretaris.sub_district_id;
                delete dataSekretaris.urban_village_id;
                delete dataSekretaris.rw_num;
                delete dataSekretaris.born_at;
                delete dataSekretaris.born_date;
                delete dataSekretaris.religion;
                delete dataSekretaris.is_married;
                delete dataSekretaris.profession;
                delete dataSekretaris.password;
                delete dataSekretaris.is_lottery_club_member;
                delete dataSekretaris.task_rating;
                delete dataSekretaris.sign_img;
                delete dataSekretaris.total_serving_as_neighbourhood_head;
                delete dataSekretaris.refresh_token;
                delete dataSekretaris.created_at;
                delete dataSekretaris.created_by;
                dataArea.sekretaris_id = dataSekretaris;
            }
            if (dataArea.bendahara_id) {
                let dataBendahara = await knex('users')
                    .where('id', '=', dataArea.bendahara_id)
                    .first();
                delete dataBendahara.rt_num;
                delete dataBendahara.sub_district_id;
                delete dataBendahara.urban_village_id;
                delete dataBendahara.rw_num;
                delete dataBendahara.born_at;
                delete dataBendahara.born_date;
                delete dataBendahara.religion;
                delete dataBendahara.is_married;
                delete dataBendahara.profession;
                delete dataBendahara.password;
                delete dataBendahara.is_lottery_club_member;
                delete dataBendahara.task_rating;
                delete dataBendahara.sign_img;
                delete dataBendahara.total_serving_as_neighbourhood_head;
                delete dataBendahara.refresh_token;
                delete dataBendahara.created_at;
                delete dataBendahara.created_by;
                dataArea.bendahara_id = dataBendahara;
            }
            payload.area = dataArea;
        }




        return res.status(200).json({
            user: payload,
            token: jwtToken,
            refreshToken: user.refresh_token,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UID FIREBASE
router.post('/verifyUID/:uid', async (req, res) => {
    let { uid } = req.params;
    let firebaseAuth = firebaseAdmin.auth();
    let userFirebase = await firebaseAuth.getUser(uid);
    if (!userFirebase.phoneNumber)
        return res.status(400).json('UID tidak valid');

    return res.status(200).json('OK');
});
// === END

// === UPLOAD PROFILE PICTURE
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
// === END 

// === UPDATE PROFILE (Nama, Jenis Kelamin, Tanggal Lahir, Alamat)
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
// === END 

// === REFRESH TOKEN
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
// === END 

// === GET MY PROFILE
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
// === END

// === UPLOAD SIGNATURE PNG
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
// === END 

// === REQ USER ROLE
router.post('/reqUserRole', isAuthenticated,
    uploadItemFileLampiran.fields([
        { name: 'ktp', maxCount: 1 },
        { name: 'ktpSelfie', maxCount: 1 },
        { name: 'fileLampiran', maxCount: 1 },
    ]),
    async (req, res) => {
        let uid = req.authenticatedUser.id;
        let { request_role, request_code } = req.body;

        try {
            // Mengecek var request_role tidak kosong
            if (stringUtils.isEmptyString(request_role)) {
                return res.status(400).json('Data tidak valid');
            }

            // Cek user ID terdaftar di db
            let user = await knex('users').where('id', '=', uid).first();
            if (!user) {
                return res.status(400).json('ID User tidak valid');
            }

            // Mengecek apakah ada req role lain yang masih aktif pada user tersebut
            let userRoleReqActive = await knex('user_role_requests')
                .where('confirmater_id', 'IS', null)
                .andWhere('requester_id', '=', user.id)
                .first();
            if (userRoleReqActive) {
                return res.status(400).json('Req Role masih ada yang active');
            }

            // Req Jadi Warga
            if (request_role == 3) {
                // Mengecek request_code tidak kosong
                if (stringUtils.isEmptyString(request_code)) {
                    return res.status(400).json('Data tidak valid');
                }

                // Cek request_code valid dengan suatu wilayah
                let wilayahTujuan = await knex('areas')
                    .where('area_code', '=', request_code)
                    .first();
                if (!wilayahTujuan) {
                    return res.status(400).json('Kode Wilayah tidak valid');
                }

                // Yang dapat mengkonfirmasi pasti hanya Ketua RT (role : 7)
                let confirmater_role_id = 7;
                let area_id = wilayahTujuan.id;
                // Insert ke tabel user role requests
                let newID = await knex('user_role_requests').insert({
                    requester_id: uid,
                    confirmater_role_id: confirmater_role_id,
                    area_id: area_id,
                    request_code: request_code,
                    request_role: request_role,
                    created_at: moment().toDate(),
                });

                // Mengambil dan mengembalikan data terbaru yang baru saja di insert
                let newReq = await knex('user_role_requests')
                    .where('id', '=', newID[0])
                    .first();
                return res.status(200).json(newReq);
            }
            // Req Bendahara || Sekretaris || Wakil
            else if (
                request_role == 4 ||
                request_role == 5 ||
                request_role == 6
            ) {
                // Mengecek request_code tidak kosong
                if (stringUtils.isEmptyString(request_code)) {
                    return res.status(400).json('Data tidak valid');
                }

                // Cek request_code valid dengan suatu wilayah

                let wilayah = await knex('areas')
                    .where('id', '=', user.area_id)
                    .first();
                if (!wilayah) {
                    return res.status(400).json('Kode Wilayah tidak valid');
                }

                // Mengecek role yang dipilih serta kode nya match
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

                // Insert ke tabel user role requests
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
            // Req jadi Ketua RT
            else if (request_role == 7) {
                // Mengecek data tidak kosong
                let {
                    rt_num,
                    rw_num,
                    urban_village_id,
                    sub_district_id,
                    namaLengkap,
                    address,
                } = req.body;
                if (
                    stringUtils.isEmptyString(namaLengkap) ||
                    stringUtils.isEmptyString(address) ||
                    stringUtils.isEmptyString(rt_num) ||
                    stringUtils.isEmptyString(rw_num) ||
                    stringUtils.isEmptyString(sub_district_id) ||
                    stringUtils.isEmptyString(urban_village_id)
                ) {
                    return res.status(400).json('Data tidak valid');
                }

                // Mengecek wilayah tersebut sudah ada atau belum (RTnum RWnum Kec Kel)
                let area = await knex('areas')
                    .where('rt_num', '=', rt_num)
                    .andWhere('rw_num', '=', rw_num)
                    .andWhere('sub_district_id', '=', sub_district_id)
                    .andWhere('urban_village_id', '=', urban_village_id)
                    .first();
                if (area) {
                    return res.status(400).json('Wilayah sudah terdaftar');
                }

                // Insert
                let idRoleRequest = await knex('user_role_requests').insert({
                    requester_id: uid,
                    confirmater_role_id: 1,
                    request_role: request_role,
                    ktp_img: req.files.ktp[0].filename,
                    selfie_ktp_img: req.files.ktpSelfie[0].filename,
                    file_lampiran: req.files.fileLampiran[0].filename,
                    rt_num: rt_num,
                    rw_num: rw_num,
                    sub_district_id: sub_district_id,
                    urban_village_id: urban_village_id,
                    created_at: moment().toDate(),
                });

                idRoleRequest = idRoleRequest[0];

                let filePath = path.join(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'public',
                    'uploads',
                    'file_lampiran',
                    `${idRoleRequest}`
                );
                if (!fs.existsSync(filePath)) {
                    fs.mkdirSync(filePath, { recursive: true });
                }

                // pindahin file ktp
                fs.moveSync(
                    req.files.ktp[0].path,
                    path.join(filePath, req.files.ktp[0].filename)
                );
                fs.moveSync(
                    req.files.ktpSelfie[0].path,
                    path.join(filePath, req.files.ktpSelfie[0].filename)
                );
                fs.moveSync(
                    req.files.fileLampiran[0].path,
                    path.join(filePath, req.files.fileLampiran[0].filename)
                );

                await knex('users')
                    .update({
                        full_name: namaLengkap,
                        address: address,
                    })
                    .where('id', '=', uid);

                let userRoleReqAfterInsert = await knex('user_role_requests')
                    .where('id', '=', idRoleRequest)
                    .first();

                // Ambil data urban village dari userRoleReq.
                let urbanVillage = await knex('urban_villages')
                    .where('id', '=', userRoleReqAfterInsert.urban_village_id)
                    .first();

                // Ambil data kecamatan (?) dari urbanVillage
                let subDistrict = await knex('sub_districts')
                    .where('id', '=', urbanVillage.kecamatan_id)
                    .first();

                userRoleReqAfterInsert.sub_district_id = subDistrict;
                userRoleReqAfterInsert.urban_village_id = urbanVillage;
                userRoleReqAfterInsert.urban_village_id.kecamatan = {
                    id: urbanVillage.kecamatan_id,
                };

                return res.status(200).json(userRoleReqAfterInsert);
            }

            return res.status(400).json('Error');
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR!');
        }
    }
);
// === END 

// === UPDATE USER ROLE (Konfirmasi Req User Role)
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

        // cek privillage
        if (
            userRoleRequest.confirmater_role_id != byuid.user_role &&
            userRoleRequest.requester_id != byuid.id
        ) {
            return res.status(400).json('Anda tidak memiliki privillage');
        }

        if (eval(isAccepted)) {
            await knex('user_role_requests')
                .update({
                    confirmater_id: byuid.id,
                    accepted_at: moment().toDate(),
                })
                .where('id', '=', user_role_requests_id);

            // Kalau jadi warga maka ubah data user nya agar menjadi warga
            if (userRoleRequest.request_role == 3) {
                const wilayah = await knex('areas')
                    .where('area_code', '=', userRoleRequest.area_id)
                    .first();

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
            } else if (userRoleRequest.request_role == 7) {
                // Mengecek kode tidak kembar
                let areaCode,
                    wakilCode,
                    bendaharaCode,
                    sekretarisCode,
                    isKembarAreaCode,
                    isKembarBendaharaCode,
                    isKembarSekretarisCode,
                    isKembarWakilCode;
                do {
                    areaCode = randomVarchar(10);
                    isKembarAreaCode = await knex('areas')
                        .where('area_code', '=', areaCode)
                        .first();
                } while (isKembarAreaCode);

                do {
                    wakilCode = randomVarchar(10);
                    isKembarWakilCode = await knex('areas')
                        .where('wakil_ketua_code', '=', wakilCode)
                        .first();
                } while (isKembarWakilCode);

                do {
                    sekretarisCode = randomVarchar(10);
                    isKembarSekretarisCode = await knex('areas')
                        .where('wakil_ketua_code', '=', sekretarisCode)
                        .first();
                } while (isKembarSekretarisCode);

                do {
                    bendaharaCode = randomVarchar(10);
                    isKembarBendaharaCode = await knex('areas')
                        .where('wakil_ketua_code', '=', bendaharaCode)
                        .first();
                } while (isKembarBendaharaCode);

                // Menginsert area baru sesuai req ketua
                await knex('areas').insert({
                    area_code: areaCode,
                    rt_num: userRoleRequest.rt_num,
                    rw_num: userRoleRequest.rw_num,
                    sub_district_id: userRoleRequest.sub_district_id,
                    urban_village_id: userRoleRequest.urban_village_id,
                    is_lottery_club_period_active: 0,
                    ketua_id: userRoleRequest.requester_id,
                    wakil_ketua_code: wakilCode,
                    sekretaris_code: sekretarisCode,
                    bendara_code: bendaharaCode,
                    created_at: moment().toDate(),
                });

                // Mengupdate data user dengan area tersebut
                let areaBaru = await knex('areas')
                    .where('area_code', '=', areaCode)
                    .first();

                await knex('users')
                    .update({
                        user_role: userRoleRequest.request_role,
                        area_id: areaBaru.id,
                        rt_num: areaBaru.rt_num,
                        rw_num: areaBaru.rw_num,
                        sub_district_id: areaBaru.sub_district_id,
                        urban_village_id: areaBaru.urban_village_id,
                    })
                    .where('id', '=', userRoleRequest.requester_id);

                // Menolak semua req menjadi ketua RT di wilayah tersebut
                await knex('user_role_requests')
                    .update({
                        confirmater_id: -99,
                        rejected_at: moment().toDate(),
                    })
                    .where('rt_num', '=', areaBaru.rt_num)
                    .andWhere('rw_num', '=', areaBaru.rw_num)
                    .andWhere('sub_district_id', '=', areaBaru.sub_district_id)
                    .andWhere(
                        'urban_village_id',
                        '=',
                        areaBaru.urban_village_id
                    )
                    .andWhere('request_role', '=', 7);
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

        if (userRoleRequest.request_role == 7) {
            // Ambil data urban village dari userRoleReq.
            let urbanVillage = await knex('urban_villages')
                .where('id', '=', userRoleReqAfterUpdate.urban_village_id)
                .first();

            // Ambil data kecamatan (?) dari urbanVillage
            let subDistrict = await knex('sub_districts')
                .where('id', '=', urbanVillage.kecamatan_id)
                .first();

            userRoleReqAfterUpdate.sub_district_id = subDistrict;
            userRoleReqAfterUpdate.urban_village_id = urbanVillage;
            userRoleReqAfterUpdate.urban_village_id.kecamatan = {
                id: urbanVillage.kecamatan_id,
            };
        }

        return res.status(200).json(userRoleReqAfterUpdate);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END 

// === LIST USER WILAYAH
router.post('/listUserWilayah', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        if (user.area_id == '' || user.area_id == null) {
            return res.status(400).json('Data tidak valid');
        }

        let listUserWilayah = await knex('users')
            .where('area_id', '=', user.area_id)
            .orderBy([
                { column: 'user_role', order: 'desc' }, 
                { column: 'full_name', order: 'asc' }
            ]);

        if (listUserWilayah) {
            for (let idx = 0; idx < listUserWilayah.length; idx++) {
                delete listUserWilayah[idx].rt_num;
                delete listUserWilayah[idx].sub_district_id;
                delete listUserWilayah[idx].urban_village_id;
                delete listUserWilayah[idx].rw_num;
                delete listUserWilayah[idx].password;
                delete listUserWilayah[idx].sign_img;
                delete listUserWilayah[idx].refresh_token;
                delete listUserWilayah[idx].created_at;
                delete listUserWilayah[idx].created_by;
            }
        }

        return res.status(200).json(listUserWilayah);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === LIST USER WILAYAH
router.get('/listUserWilayah/:areaID', isAuthenticated, async (req, res) => {
    let { areaID } = req.params;
    try {

        let listUserWilayah = await knex('users')
            .where('area_id', '=', areaID)
            .orderBy([
                { column: 'user_role', order: 'desc' }, 
                { column: 'full_name', order: 'asc' }
            ]);

        if (listUserWilayah) {
            for (let idx = 0; idx < listUserWilayah.length; idx++) {
                delete listUserWilayah[idx].rt_num;
                delete listUserWilayah[idx].sub_district_id;
                delete listUserWilayah[idx].urban_village_id;
                delete listUserWilayah[idx].rw_num;
                delete listUserWilayah[idx].password;
                delete listUserWilayah[idx].sign_img;
                delete listUserWilayah[idx].refresh_token;
                delete listUserWilayah[idx].created_at;
                delete listUserWilayah[idx].created_by;
            }
        }

        return res.status(200).json(listUserWilayah);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GET USER ROLE REQ JADI WARGA
router.get('/getRoleRequest/typeReqRole/warga/isConfirmation/:isConfirm', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { isConfirm } = req.params;
    try {
        if (user.user_role != 7) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        let listDataUserReqRole;

        if (isConfirm == 'yes') {
            listDataUserReqRole = await knex('user_role_requests')
                .whereRaw('confirmater_id != requester_id')
                .andWhere('confirmater_id', 'IS NOT', null)
                .andWhere('area_id', '=', user.area_id)
                .andWhere('request_role', '=', 3);

            for (let idx = 0; idx < listDataUserReqRole.length; idx++) {
                let dataUserRequester = await knex('users').where('id', '=', listDataUserReqRole[idx].requester_id).first();
                listDataUserReqRole[idx].data_user_requester = dataUserRequester;
                let dataUserConfirmater = await knex('users').where('id', '=', listDataUserReqRole[idx].confirmater_id).first();
                listDataUserReqRole[idx].data_user_confirmater = dataUserConfirmater;
            }
        } else {
            listDataUserReqRole = await knex('user_role_requests')
                .whereNull('confirmater_id')
                .andWhere('area_id', '=', user.area_id)
                .andWhere('request_role', '=', 3);

            for (let idx = 0; idx < listDataUserReqRole.length; idx++) {
                let dataUser = await knex('users').where('id', '=', listDataUserReqRole[idx].requester_id).first();
                listDataUserReqRole[idx].data_user_requester = dataUser;
            }
        }

        return res.status(200).json(listDataUserReqRole);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END

// === GET USER ROLE REQ JADI WARGA
router.get('/getRoleRequest/typeReqRole/ketua-rt', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;

    try {
        if (user.user_role != 1) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        let listDataUserReqRole = await knex('user_role_requests')
            .whereRaw(`
                (confirmater_id != requester_id OR confirmater_id is null)`)
            .andWhere('confirmater_role_id','=', 1)
            .andWhere('request_role', '=', 7);

        for (let idx = 0; idx < listDataUserReqRole.length; idx++) {
            let dataUserRequester = await knex('users').where('id', '=', listDataUserReqRole[idx].requester_id).first();
            listDataUserReqRole[idx].data_user_requester = dataUserRequester;
 
            if (listDataUserReqRole[idx].urban_village_id != null) {
                let dataUrbanVillage = await knex('urban_villages').where('id','=', listDataUserReqRole[idx].urban_village_id).first();
                listDataUserReqRole[idx].urban_village_id = dataUrbanVillage;
            }
            
            if (listDataUserReqRole[idx].sub_district_id != null) {
                let dataSubDistrict = await knex('sub_districts').where('id','=', listDataUserReqRole[idx].sub_district_id).first();
                listDataUserReqRole[idx].sub_district_id = dataSubDistrict;
            }
            
            if (listDataUserReqRole[idx].confirmater_id != null) {
                let dataUserConfirmater = await knex('users').where('id', '=', listDataUserReqRole[idx].confirmater_id).first();
                listDataUserReqRole[idx].data_user_confirmater = dataUserConfirmater;
            }
        }


        return res.status(200).json(listDataUserReqRole);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END

// === KONFIRMASI REQ JADI WARGA
router.patch('/update/roleReq/warga', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idRoleReq, typeConfirmation } = req.body;
    try {
        if (user.user_role != 7) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        if (typeConfirmation != 'terima' && typeConfirmation != 'tolak') {
            return res.status(400).json('Data tidak valid');
        }

        if (stringUtils.isEmptyString(idRoleReq)) {
            return res.status(400).json('Data tidak valid');
        }


        if (typeConfirmation == 'terima') {
            await knex('user_role_requests').update({
                "confirmater_id": user.id,
                "accepted_at": moment().toDate()
            }).where('id', '=', idRoleReq);

            let dataReq = await knex('user_role_requests').where('id', '=', idRoleReq).first();

            await knex('users').update({
                "sub_district_id": user.sub_district_id,
                "urban_village_id": user.urban_village_id,
                "rw_num": user.rw_num,
                "rt_num": user.rt_num,
                "area_id": user.area_id,
                "user_role": 3
            }).where('id', '=', dataReq.requester_id);


            let dataArea = await knex('areas').where('id','=',user.area_id).first();
            await knex('areas').update({
                'total_population': dataArea.total_population + 1
            }).where('id','=',user.area_id);
            return res.status(200).json("Berhasil menerima !");
        } else {
            await knex('user_role_requests').update({
                "confirmater_id": user.id,
                "rejected_at": moment().toDate()
            }).where('id', '=', idRoleReq);
            return res.status(200).json("Berhasil menolak !");
        }



    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END

// === KONFIRMASI REQ JADI KETUA
router.patch('/update/roleReq/ketua', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idRoleReq, isAccepted, tenure_end_at, notes } = req.body;
    try {
        if (user.user_role != 1) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        if (stringUtils.isEmptyString(idRoleReq) || stringUtils.isEmptyString(isAccepted) || stringUtils.isEmptyString(tenure_end_at)) {
            return res.status(400).json('Data tidak valid');
        }

        if (isAccepted == 'true') {
            let dataReq = await knex('user_role_requests').where('id', '=', idRoleReq).first();

            let dataKembar, area_code, wakil_ketua_code, sekretaris_code, bendahara_code;
            do {
                area_code = stringUtils.randomVarchar(10);
                wakil_ketua_code = stringUtils.randomVarchar(10);
                sekretaris_code = stringUtils.randomVarchar(10);
                bendahara_code = stringUtils.randomVarchar(10);

                dataKembar = await knex('areas')
                    .where('area_code', '=', area_code)
                    .orWhere('area_code', '=', wakil_ketua_code)
                    .orWhere('area_code', '=', sekretaris_code)
                    .orWhere('area_code', '=', bendahara_code)
                    .orWhere('wakil_ketua_code', '=', area_code)
                    .orWhere('wakil_ketua_code', '=', wakil_ketua_code)
                    .orWhere('wakil_ketua_code', '=', sekretaris_code)
                    .orWhere('wakil_ketua_code', '=', bendahara_code)
                    .orWhere('sekretaris_code', '=', area_code)
                    .orWhere('sekretaris_code', '=', wakil_ketua_code)
                    .orWhere('sekretaris_code', '=', sekretaris_code)
                    .orWhere('sekretaris_code', '=', bendahara_code)
                    .orWhere('bendahara_code', '=', area_code)
                    .orWhere('bendahara_code', '=', wakil_ketua_code)
                    .orWhere('bendahara_code', '=', sekretaris_code)
                    .orWhere('bendahara_code', '=', bendahara_code)
                    .first();
                
            } while (
                dataKembar || 
                (area_code == wakil_ketua_code) || 
                (area_code == sekretaris_code) || 
                (area_code == bendahara_code) ||
                (wakil_ketua_code == sekretaris_code) ||
                (wakil_ketua_code == bendahara_code) ||
                (sekretaris_code == bendahara_code)
            );

            let idArea = await knex('areas').insert({
                'area_code': area_code,
                'rt_num': dataReq.rt_num,
                'rw_num': dataReq.rw_num,
                'sub_district_id': dataReq.sub_district_id,
                'urban_village_id': dataReq.urban_village_id,
                'is_lottery_club_period_active': 0,
                'ketua_id': dataReq.requester_id,
                'wakil_ketua_code': wakil_ketua_code,
                'sekretaris_code': sekretaris_code,
                'bendahara_code': bendahara_code,
                'tenure_end_at': tenure_end_at,
                'periode': 1,
            });

            await knex('user_role_requests').update({
                "confirmater_id": user.id,
                "accepted_at": moment().toDate()
            }).where('id', '=', idRoleReq);

            await knex('users').update({
                "sub_district_id": dataReq.sub_district_id,
                "urban_village_id": dataReq.urban_village_id,
                "rw_num": dataReq.rw_num,
                "rt_num": dataReq.rt_num,
                "area_id": idArea[0],
                "user_role": 7
            }).where('id', '=', dataReq.requester_id);

            await knex('user_role_requests').update({
                "confirmater_id": user.id,
                "rejected_at": moment().toDate()
            }).where('rt_num','=', dataReq.rt_num)
            .andWhere('rw_num','=', dataReq.rw_num)
            .andWhere('urban_village_id','=', dataReq.urban_village_id)
            .andWhere('sub_district_id','=', dataReq.sub_district_id)
            .whereNull('accepted_at')
            .whereNull('rejected_at');

            let dataUrbanVillage = await knex('urban_villages').where('id','=', dataReq.urban_village_id).first();
            let dataSubDistrict = await knex('sub_districts').where('id','=', dataReq.sub_district_id).first();

            await knex('urban_villages').update({
                'total_population': dataUrbanVillage.total_population + 1
            }).where('id','=', dataReq.urban_village_id);

            await knex('sub_districts').update({
                'total_population': dataSubDistrict.total_population + 1
            }).where('id','=', dataReq.sub_district_id);

            await knex('user_role_logs').insert({
                'user_id': dataReq.requester_id,
                'before_user_role_id': 2,
                'after_user_role_id': 7,
                'created_at': moment().toDate()
            });

            return res.status(200).json("Berhasil menerima !");
        } else {
            let dataReq = await knex('user_role_requests').where('id', '=', idRoleReq).first();
            // Tetap jadi guest, soo tetap 2 rolenya
            await knex('user_role_logs').insert({
                'user_id': dataReq.requester_id,
                'before_user_role_id': 2,
                'after_user_role_id': 2,
                'created_at': moment().toDate(),
                'notes': notes
            });

            await knex('user_role_requests').update({
                "confirmater_id": user.id,
                "rejected_at": moment().toDate()
            }).where('id', '=', idRoleReq);
            return res.status(200).json("Berhasil menolak !");
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END

// === GET USER ROLE REQ 
router.get('/getRoleRequest/id/:idReqRole', async (req, res) => {
    let { idReqRole } = req.params;
    try {
        let dataReqRole = await knex('user_role_requests').where('id', '=', idReqRole).first();

        if (!dataReqRole || dataReqRole == null) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUserRequester = await knex('users').where('id', '=', dataReqRole.requester_id).first();
        dataReqRole.data_user_requester = dataUserRequester;
        let dataUserConfirmater = await knex('users').where('id', '=', dataReqRole.confirmater_id).first();
        dataReqRole.data_user_confirmater = dataUserConfirmater;

        return res.status(200).json(dataReqRole);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END

// === GET TOTAL ANGGOTA WILAYAH (REQ AREA_ID)
router.get('/getCountAnggota/wilayah/:idWilayah', async (req, res) => {
    let { idWilayah } = req.params;
    try {
        let dataTotalAnggota = await knex('users')
            .count('id')
            .where('area_id', '=', idWilayah).first();

        return res.status(200).json(dataTotalAnggota["count(`id`)"]);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END

// === ADD USER ROLE LOG
router.post('/role/log/add', async (req, res) => {
    let {   user_id, 
            before_user_role_id, 
            after_user_role_id, 
            notes } = req.body;

    try {
        await knex('user_role_logs')
            .insert({
                "user_id": user_id,
                "before_user_role_id": before_user_role_id,
                "after_user_role_id": after_user_role_id,
                "notes": notes,
                "created_at": moment().toDate()
            });

        return res.status(200).json("Berhasil mencatat log!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
})
// === END



router.get('/', async (req, res) => {
    let users = await knex('users');
    return res.status(200).json(users);
});

router.get('/:id', async (req, res) => {
    let user = await knex('users').where('id', '=', req.params.id).first();
    return res.status(200).json(user);
});

router.post('/', async (req, res) => {
    return res.status(200).json('OK');
});

module.exports = router;
