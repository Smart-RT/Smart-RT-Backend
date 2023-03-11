// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar, isReligionAvailable, isGenderAvailable, isWeddingStatusAvailable } = require('../../utils/strings');
const e = require('express');
const {
    uploadItemLampiranAdministrasi,
} = require('../../middleware/upload');
const path = require('path');
const fs = require('fs-extra');

// === GET LIST ADMINISTRATION (REQ STATUS)
router.get('/area/:idArea/status/:idStatus', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idArea, idStatus } = req.params;
    try {
        let dataArea = await knex('areas').where('id', '=', idArea).first();
        if (!dataArea) {
            return res.status(400).json('Data tidak valid');
        }

        let dataListAdministration;
        if (user.user_role == 7) {
            dataListAdministration = await knex('administrations')
                .where('area_id', '=', idArea)
                .andWhere('confirmation_status', '=', idStatus);
        } else {
            dataListAdministration = await knex('administrations')
                .where('area_id', '=', idArea)
                .andWhere('confirmation_status', '=', idStatus)
                .andWhere('creator_id', '=', user.id);
        }

        for (let idx = 0; idx < dataListAdministration.length; idx++) {
            let dataAdministrationType = await knex('administration_types')
                .where('id', '=', dataListAdministration[idx].administration_type_id)
                .first();
            dataListAdministration[idx].administration_type = dataAdministrationType;
            let dataUser = await knex('users').where('id', '=', dataListAdministration[idx].creator_id).first();
            dataListAdministration[idx].data_creator = dataUser;
        }

        return res.status(200).json(dataListAdministration);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GET DATA ADMINISTRATION (REQ ID)
router.get('/id/:idAdm', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idAdm } = req.params;
    try {

        let dataAdministration = await knex('administrations')
            .where('id', '=', idAdm)
            .first();

        let dataAdministrationType = await knex('administration_types')
            .where('id', '=', dataAdministration.administration_type_id)
            .first();
        dataAdministration.administration_type = dataAdministrationType;

        let dataUser = await knex('users').where('id', '=', dataAdministration.creator_id).first();
        dataAdministration.data_creator = dataUser;

        return res.status(200).json(dataAdministration);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GET LIST ADMINISTRATION TYPE
router.get('/types', async (req, res) => {
    try {
        let dataListAdministrationType = await knex('administration_types');
        return res.status(200).json(dataListAdministrationType);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === CREATE PERMOHONAN SURAT PENGANTAR
router.post('/add/permohonan-surat-pengantar', isAuthenticated,
    uploadItemLampiranAdministrasi.fields([
        { name: 'creator_ktp_img', maxCount: 1 },
        { name: 'creator_kk_img', maxCount: 1 },
        { name: 'creator_mom_ktp_img', maxCount: 1 },
        { name: 'creator_dad_ktp_img', maxCount: 1 },
    ]),
    async (req, res) => {
        let user = req.authenticatedUser;
        let {
            administration_type_id,
        } = req.body;

        console.log(req.body);

        try {
            if (stringUtils.isEmptyString(administration_type_id)) {
                return res.status(400).json('Data tidak valid 1');
            }

            if (administration_type_id == 6) {
                let {
                    creator_fullname,
                    creator_anak_ke,
                    creator_born_place,
                    creator_born_date,
                    creator_gender,
                    creator_dad_name,
                    creator_dad_bornplace,
                    creator_dad_borndate,
                    creator_dad_job,
                    creator_dad_address,
                    creator_dad_ktp_num,
                    creator_mom_name,
                    creator_mom_bornplace,
                    creator_mom_borndate,
                    creator_mom_job,
                    creator_mom_address,
                    creator_mom_ktp_num,
                } = req.body;

                if (stringUtils.isEmptyString(creator_fullname)
                    || stringUtils.isEmptyString(creator_anak_ke)
                    || stringUtils.isEmptyString(creator_born_place)
                    || stringUtils.isEmptyString(creator_born_date)
                    || stringUtils.isEmptyString(creator_gender)
                    || stringUtils.isEmptyString(creator_dad_name)
                    || stringUtils.isEmptyString(creator_dad_bornplace)
                    || stringUtils.isEmptyString(creator_dad_borndate)
                    || stringUtils.isEmptyString(creator_dad_job)
                    || stringUtils.isEmptyString(creator_dad_address)
                    || stringUtils.isEmptyString(creator_dad_ktp_num)
                    || stringUtils.isEmptyString(creator_mom_name)
                    || stringUtils.isEmptyString(creator_mom_bornplace)
                    || stringUtils.isEmptyString(creator_mom_borndate)
                    || stringUtils.isEmptyString(creator_mom_job)
                    || stringUtils.isEmptyString(creator_mom_address)
                    || stringUtils.isEmptyString(creator_mom_ktp_num)
                ) {
                    return res.status(400).json('Data tidak valid 1');
                }
                
                let dataArea = await knex('areas')
                    .where('id', '=', user.area_id)
                    .first();

                let dataKelurahan = await knex('urban_villages')
                    .where('id', '=', dataArea.urban_village_id)
                    .first();

                let dataKecamatan = await knex('sub_districts')
                    .where('id', '=', dataArea.sub_district_id)
                    .first();

                let newID;

                newID = await knex('administrations').insert({
                    "administration_type_id": administration_type_id,
                    "area_id": user.area_id,
                    "creator_id": user.id,
                    "creator_fullname": creator_fullname,
                    "creator_borndate": creator_born_date,
                    "creator_bornplace": creator_born_place,
                    "creator_gender": creator_gender,
                    "creator_anak_ke": creator_anak_ke,
                    "creator_dad_name": creator_dad_name,
                    "creator_dad_bornplace": creator_dad_bornplace,
                    "creator_dad_borndate": creator_dad_borndate,
                    "creator_dad_job": creator_dad_job,
                    "creator_dad_address": creator_dad_address,
                    "creator_dad_ktp_num": creator_dad_ktp_num,
                    "creator_dad_ktp_img": req.files.creator_dad_ktp_img[0].filename,
                    "creator_mom_name": creator_mom_name,
                    "creator_mom_bornplace": creator_mom_bornplace,
                    "creator_mom_borndate": creator_mom_borndate,
                    "creator_mom_job": creator_mom_job,
                    "creator_mom_address": creator_mom_address,
                    "creator_mom_ktp_num": creator_mom_ktp_num,
                    "creator_mom_ktp_img": req.files.creator_mom_ktp_img[0].filename,
                    "data_rt_num": dataArea.rt_num,
                    "data_rw_num": dataArea.rw_num,
                    "data_kelurahan_id": dataKelurahan.id,
                    "data_kelurahan_name": dataKelurahan.name,
                    "data_kecamatan_id": dataKecamatan.id,
                    "data_kecamatan_name": dataKecamatan.name,
                    "confirmation_status": 0,
                    "created_at": moment().toDate()
                });
                let filePath = path.join(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'public',
                    'uploads',
                    'administrasi',
                    'file_lampiran',
                    `${newID[0]}`
                );
                if (!fs.existsSync(filePath)) {
                    fs.mkdirSync(filePath, { recursive: true });
                }

                fs.moveSync(
                    req.files.creator_mom_ktp_img[0].path,
                    path.join(filePath, req.files.creator_mom_ktp_img[0].filename)
                );
                fs.moveSync(
                    req.files.creator_dad_ktp_img[0].path,
                    path.join(filePath, req.files.creator_dad_ktp_img[0].filename)
                );
            } else {
                let {
                    creator_fullname,
                    creator_address,
                    creator_ktp_num,
                    creator_kk_num,
                    creator_born_place,
                    creator_born_date,
                    creator_gender,
                    creator_religion,
                    creator_wedding_status,
                    creator_job,
                    creator_nationality,
                } = req.body;

                if (stringUtils.isEmptyString(creator_fullname)
                    || stringUtils.isEmptyString(creator_address)
                    || stringUtils.isEmptyString(creator_ktp_num)
                    || stringUtils.isEmptyString(creator_kk_num)
                    || stringUtils.isEmptyString(creator_born_place)
                    || stringUtils.isEmptyString(creator_born_date)
                    || stringUtils.isEmptyString(creator_gender)
                    || stringUtils.isEmptyString(creator_religion)
                    || stringUtils.isEmptyString(creator_wedding_status)
                    || stringUtils.isEmptyString(creator_job)
                    || stringUtils.isEmptyString(creator_nationality)
                    || !isReligionAvailable(creator_religion)
                    || !isGenderAvailable(creator_gender)
                    || !isWeddingStatusAvailable(creator_wedding_status)
                ) {
                    return res.status(400).json('Data tidak valid');
                }

                let dataArea = await knex('areas')
                    .where('id', '=', user.area_id)
                    .first();

                let dataKelurahan = await knex('urban_villages')
                    .where('id', '=', dataArea.urban_village_id)
                    .first();

                let dataKecamatan = await knex('sub_districts')
                    .where('id', '=', dataArea.sub_district_id)
                    .first();

                let newID;

                if (administration_type_id == 5) {
                    let {
                        creator_additional_datetime,
                        creator_age,
                        creator_notes,
                    } = req.body;

                    if (stringUtils.isEmptyString(creator_additional_datetime)
                        || stringUtils.isEmptyString(creator_age)
                        || stringUtils.isEmptyString(creator_notes)
                    ) {
                        return res.status(400).json('Data tidak valid');
                    }
                    newID = await knex('administrations').insert({
                        "administration_type_id": administration_type_id,
                        "area_id": user.area_id,
                        "creator_id": user.id,
                        "creator_fullname": creator_fullname,
                        "creator_borndate": creator_born_date,
                        "creator_bornplace": creator_born_place,
                        "creator_gender": creator_gender,
                        "creator_religion": creator_religion,
                        "creator_wedding_status": creator_wedding_status,
                        "creator_ktp_img": req.files.creator_ktp_img[0].filename,
                        "creator_ktp_num": creator_ktp_num,
                        "creator_kk_img": req.files.creator_kk_img[0].filename,
                        "creator_kk_num": creator_kk_num,
                        "creator_job": creator_job,
                        "creator_nationality": creator_nationality,
                        "creator_address": creator_address,
                        "data_rt_num": dataArea.rt_num,
                        "data_rw_num": dataArea.rw_num,
                        "data_kelurahan_id": dataKelurahan.id,
                        "data_kelurahan_name": dataKelurahan.name,
                        "data_kecamatan_id": dataKecamatan.id,
                        "data_kecamatan_name": dataKecamatan.name,
                        "confirmation_status": 0,
                        "created_at": moment().toDate(),
                        "creator_additional_datetime": creator_additional_datetime,
                        "creator_age": creator_age,
                        "creator_notes": creator_notes
                    });
                } else if (administration_type_id == 8) {
                    let {
                        creator_notes,
                    } = req.body;

                    if (stringUtils.isEmptyString(creator_notes)
                    ) {
                        return res.status(400).json('Data tidak valid');
                    }
                    newID = await knex('administrations').insert({
                        "administration_type_id": administration_type_id,
                        "area_id": user.area_id,
                        "creator_id": user.id,
                        "creator_fullname": creator_fullname,
                        "creator_borndate": creator_born_date,
                        "creator_bornplace": creator_born_place,
                        "creator_gender": creator_gender,
                        "creator_religion": creator_religion,
                        "creator_wedding_status": creator_wedding_status,
                        "creator_ktp_img": req.files.creator_ktp_img[0].filename,
                        "creator_ktp_num": creator_ktp_num,
                        "creator_kk_img": req.files.creator_kk_img[0].filename,
                        "creator_kk_num": creator_kk_num,
                        "creator_job": creator_job,
                        "creator_nationality": creator_nationality,
                        "creator_address": creator_address,
                        "data_rt_num": dataArea.rt_num,
                        "data_rw_num": dataArea.rw_num,
                        "data_kelurahan_id": dataKelurahan.id,
                        "data_kelurahan_name": dataKelurahan.name,
                        "data_kecamatan_id": dataKecamatan.id,
                        "data_kecamatan_name": dataKecamatan.name,
                        "confirmation_status": 0,
                        "created_at": moment().toDate(),
                        "creator_notes": creator_notes
                    });
                }else {
                    newID = await knex('administrations').insert({
                        "administration_type_id": administration_type_id,
                        "area_id": user.area_id,
                        "creator_id": user.id,
                        "creator_fullname": creator_fullname,
                        "creator_borndate": creator_born_date,
                        "creator_bornplace": creator_born_place,
                        "creator_gender": creator_gender,
                        "creator_religion": creator_religion,
                        "creator_wedding_status": creator_wedding_status,
                        "creator_ktp_img": req.files.creator_ktp_img[0].filename,
                        "creator_ktp_num": creator_ktp_num,
                        "creator_kk_img": req.files.creator_kk_img[0].filename,
                        "creator_kk_num": creator_kk_num,
                        "creator_job": creator_job,
                        "creator_nationality": creator_nationality,
                        "creator_address": creator_address,
                        "data_rt_num": dataArea.rt_num,
                        "data_rw_num": dataArea.rw_num,
                        "data_kelurahan_id": dataKelurahan.id,
                        "data_kelurahan_name": dataKelurahan.name,
                        "data_kecamatan_id": dataKecamatan.id,
                        "data_kecamatan_name": dataKecamatan.name,
                        "confirmation_status": 0,
                        "created_at": moment().toDate()
                    });

                }

                let filePath = path.join(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'public',
                    'uploads',
                    'administrasi',
                    'file_lampiran',
                    `${newID[0]}`
                );
                if (!fs.existsSync(filePath)) {
                    fs.mkdirSync(filePath, { recursive: true });
                }

                fs.moveSync(
                    req.files.creator_ktp_img[0].path,
                    path.join(filePath, req.files.creator_ktp_img[0].filename)
                );
                fs.moveSync(
                    req.files.creator_kk_img[0].path,
                    path.join(filePath, req.files.creator_kk_img[0].filename)
                );
            }

            return res.status(200).json("Berhasil membuat permohonan Surat Keterangan !");
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR');
        }
    });
// === END

// === UPDATE PERMOHONAN SURAT PENGANTAR (TERIMA / TOLAK)
router.patch('/update/permohonan-surat-pengantar', isAuthenticated,
    async (req, res) => {
        let user = req.authenticatedUser;
        let {
            administration_id,
            confirmation_status,
        } = req.body;

        console.log(req.body);

        try {
            if (stringUtils.isEmptyString(administration_id)
                || stringUtils.isEmptyString(confirmation_status)
            ) {
                return res.status(400).json('Data tidak valid');
            }

            let dataAdm = await knex('administrations').where('id', '=', administration_id).first();
            if (!dataAdm) {
                return res.status(400).json('Data tidak valid');
            }

            if (confirmation_status == -1) {
                let { confirmation_rejected_reason } = req.body;
                if (stringUtils.isEmptyString(confirmation_rejected_reason)) {
                    return res.status(400).json('Data tidak valid');
                }
                await knex('administrations').update({
                    "confirmater_id": user.id,
                    "confirmater_fullname": user.full_name,
                    "confirmation_status": confirmation_status,
                    "confirmation_rejected_reason": confirmation_rejected_reason,
                    "confirmation_at": moment().toDate(),
                }).where('id', '=', dataAdm.id);
            } else {
                let { data_letter_num } = req.body;
                if (stringUtils.isEmptyString(data_letter_num)) {
                    return res.status(400).json('Data tidak valid');
                }

                let dataUserConfirmater = await knex('users').where('id', '=', user.id).first();

                await knex('administrations').update({
                    "confirmater_id": user.id,
                    "confirmater_fullname": user.full_name,
                    "confirmater_sign_img": dataUserConfirmater.sign_img,
                    "confirmation_status": confirmation_status,
                    "data_letter_num": data_letter_num,
                    "confirmation_at": moment().toDate(),
                }).where('id', '=', dataAdm.id);

                let filePathDestination = path.join(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'public',
                    'uploads',
                    'administrasi',
                    'file_lampiran',
                    `${dataAdm.id}`
                );

                if (!fs.existsSync(filePathDestination)) {
                    fs.mkdirSync(filePathDestination, { recursive: true });
                }

                let filePathSource = path.join(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'public',
                    'uploads',
                    'users',
                    `${dataUserConfirmater.id}`,
                    'signature',
                    `${dataUserConfirmater.sign_img}`
                );

                fs.copyFileSync(
                    filePathSource,
                    path.join(filePathDestination, dataUserConfirmater.sign_img)
                );
            }

            let msg = confirmation_status == -1 ? 'menolak' : 'menerima';

            return res.status(200).json(`Berhasil ${msg} permohonan Surat Keterangan !`);
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR');
        }
    });
// === END

module.exports = router;