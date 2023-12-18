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
    uploadItemLampiranJanjiTemu,
} = require('../../middleware/upload');
const path = require('path');
const fs = require('fs-extra');
const { sendNotification } = require('../../utils/notification');

// === GET LIST MEET
router.get('/get/status/:status', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { status } = req.params;
    try {
        if (status != 'terjadwalkan'
            && status != 'permohonan'
            && status != 'status-negative'
            && status != 'telah-berlalu') {
            return res.status(400).json('Data tidak valid');
        }

        let listData;
        if (status == 'terjadwalkan') {
            let dateTimeNow = moment().toDate();
            if (user.user_role == 7 || user.user_role == 5 || user.user_role == 6) {
                listData = await knex('meetings')
                    .where('status', '=', '1')
                    .andWhere('meet_datetime', '>=', dateTimeNow)
                    .whereRaw(`(area_id = ${user.area_id} || created_by = ${user.id})`)
                    .orderBy('meet_datetime')
                    ;
            }
            // else if (user.user_role == 5 || user.user_role == 6) {
            //     listData = await knex('meetings')
            //         .where('status', '=', '1')
            //         .andWhere('meet_datetime', '>=', dateTimeNow)
            //         .whereRaw(`((area_id = ${user.area_id} && new_respondent_by = ${user.id}) || created_by = ${user.id})`);
            // } 
            else {
                listData = await knex('meetings')
                    .where('status', '=', '1')
                    .andWhere('meet_datetime', '>=', dateTimeNow)
                    .andWhere('created_by', '=', user.id)
                    .orderBy('meet_datetime');
            }
        } else if (status == 'permohonan') {
            let dateTimeNow = moment().toDate();
            if (user.user_role == 7 || user.user_role == 5 || user.user_role == 6) {
                listData = await knex('meetings')
                    .where('status', '=', '0')
                    .andWhere('meet_datetime', '>=', dateTimeNow)
                    .whereRaw(`(area_id = ${user.area_id} || created_by = ${user.id})`)
                    .orderBy('meet_datetime');
            }
            // else if (user.user_role == 5 || user.user_role == 6) {
            //     listData = await knex('meetings')
            //         .where('status', '=', '0')
            //         .whereRaw(`((area_id = ${user.area_id} && new_respondent_by = ${user.id}) || created_by = ${user.id})`);
            // } 
            else {
                listData = await knex('meetings')
                    .where('status', '=', '0')
                    .andWhere('meet_datetime', '>=', dateTimeNow)
                    .andWhere('created_by', '=', user.id)
                    .orderBy('meet_datetime');
            }
        } else if (status == 'telah-berlalu') {
            let dateTimeNow = moment().toDate();
            if (user.user_role == 7 || user.user_role == 5 || user.user_role == 6) {
                listData = await knex('meetings')
                    .where('status', '>=', '0')
                    .andWhere('meet_datetime', '<', dateTimeNow)
                    .whereRaw(`(area_id = ${user.area_id} || created_by = ${user.id})`)
                    .orderBy('created_at', 'desc');
            }
            // else if (user.user_role == 5 || user.user_role == 6) {
            //     listData = await knex('meetings')
            //         .where('status', '=', '1')
            //         .andWhere('meet_datetime', '<', dateTimeNow)
            //         .whereRaw(`((area_id = ${user.area_id} && new_respondent_by = ${user.id}) || created_by = ${user.id})`);
            // } 
            else {
                listData = await knex('meetings')
                    .where('status', '>=', '0')
                    .andWhere('meet_datetime', '<', dateTimeNow)
                    .andWhere('created_by', '=', user.id)
                    .orderBy('created_at', 'desc');
            }
        } else if (status == 'status-negative') {
            if (user.user_role == 7 || user.user_role == 5 || user.user_role == 6) {
                listData = await knex('meetings')
                    .where('status', '<', '0')
                    .whereRaw(`(area_id = ${user.area_id} || created_by = ${user.id})`)
                    .orderBy('created_at', 'desc');
            }
            // else if (user.user_role == 5 || user.user_role == 6) {
            //     listData = await knex('meetings')
            //         .where('status', '<', '0')
            //         .whereRaw(`((area_id = ${user.area_id} && new_respondent_by = ${user.id}) || created_by = ${user.id})`);
            // } 
            else {
                listData = await knex('meetings')
                    .where('status', '<', '0')
                    .andWhere('created_by', '=', user.id)
                    .orderBy('created_at', 'desc');
            }
        }

        for (let idx = 0; idx < listData.length; idx++) {
            if (listData[idx].confirmated_by != null) {
                let dataUserConfirmated = await knex('users').where('id', '=', listData[idx].confirmated_by).first();
                if (dataUserConfirmated.area_id != null && dataUserConfirmated.area_id != '') {
                    let dataArea = await knex('areas').where('id', '=', dataUserConfirmated.area_id).first();

                    let dataUrbanVillage = await knex({ u: 'urban_villages' })
                        .select({
                            id: 'u.id',
                            name: 'u.name',
                            idKecamatan: 'sd.id',
                        })
                        .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                        .where('u.id', '=', dataArea.urban_village_id)
                        .first();

                    let dataSubDistrict = await knex('sub_districts')
                        .where('id', '=', dataArea.sub_district_id)
                        .first();

                    dataArea.data_kecamatan = dataSubDistrict;
                    dataArea.data_kelurahan = dataUrbanVillage;
                    delete dataArea.lottery_club_id;
                    delete dataArea.ketua_id;
                    delete dataArea.wakil_ketua_id;
                    delete dataArea.sekretaris_id;
                    delete dataArea.bendahara_id;
                    dataUserConfirmated.area = dataArea;
                }
                listData[idx].confirmated_by = dataUserConfirmated;
            }
            if (listData[idx].new_respondent_by != null) {
                let dataUserNewRespondent = await knex('users').where('id', '=', listData[idx].new_respondent_by).first();
                if (dataUserNewRespondent.area_id != null && dataUserNewRespondent.area_id != '') {
                    let dataArea = await knex('areas').where('id', '=', dataUserNewRespondent.area_id).first();

                    let dataUrbanVillage = await knex({ u: 'urban_villages' })
                        .select({
                            id: 'u.id',
                            name: 'u.name',
                            idKecamatan: 'sd.id',
                        })
                        .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                        .where('u.id', '=', dataArea.urban_village_id)
                        .first();

                    let dataSubDistrict = await knex('sub_districts')
                        .where('id', '=', dataArea.sub_district_id)
                        .first();

                    dataArea.data_kecamatan = dataSubDistrict;
                    dataArea.data_kelurahan = dataUrbanVillage;
                    delete dataArea.lottery_club_id;
                    delete dataArea.ketua_id;
                    delete dataArea.wakil_ketua_id;
                    delete dataArea.sekretaris_id;
                    delete dataArea.bendahara_id;
                    dataUserNewRespondent.area = dataArea;
                }
                listData[idx].new_respondent_by = dataUserNewRespondent;
            }

            if (listData[idx].meet_datetime_negotiated_by != null) {
                let dataUserDateTimeNegotiatedBy = await knex('users').where('id', '=', listData[idx].meet_datetime_negotiated_by).first();
                if (dataUserDateTimeNegotiatedBy.area_id != null && dataUserDateTimeNegotiatedBy.area_id != '') {
                    let dataArea = await knex('areas').where('id', '=', dataUserDateTimeNegotiatedBy.area_id).first();

                    let dataUrbanVillage = await knex({ u: 'urban_villages' })
                        .select({
                            id: 'u.id',
                            name: 'u.name',
                            idKecamatan: 'sd.id',
                        })
                        .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                        .where('u.id', '=', dataArea.urban_village_id)
                        .first();

                    let dataSubDistrict = await knex('sub_districts')
                        .where('id', '=', dataArea.sub_district_id)
                        .first();

                    dataArea.data_kecamatan = dataSubDistrict;
                    dataArea.data_kelurahan = dataUrbanVillage;
                    delete dataArea.lottery_club_id;
                    delete dataArea.ketua_id;
                    delete dataArea.wakil_ketua_id;
                    delete dataArea.sekretaris_id;
                    delete dataArea.bendahara_id;
                    dataUserDateTimeNegotiatedBy.area = dataArea;
                }
                listData[idx].meet_datetime_negotiated_by = dataUserDateTimeNegotiatedBy;
            }

            let dataUserCreatedBy = await knex('users').where('id', '=', listData[idx].created_by).first();
            if (dataUserCreatedBy.area_id != null && dataUserCreatedBy.area_id != '') {
                let dataArea = await knex('areas').where('id', '=', dataUserCreatedBy.area_id).first();

                let dataUrbanVillage = await knex({ u: 'urban_villages' })
                    .select({
                        id: 'u.id',
                        name: 'u.name',
                        idKecamatan: 'sd.id',
                    })
                    .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                    .where('u.id', '=', dataArea.urban_village_id)
                    .first();

                let dataSubDistrict = await knex('sub_districts')
                    .where('id', '=', dataArea.sub_district_id)
                    .first();

                dataArea.data_kecamatan = dataSubDistrict;
                dataArea.data_kelurahan = dataUrbanVillage;
                delete dataArea.lottery_club_id;
                delete dataArea.ketua_id;
                delete dataArea.wakil_ketua_id;
                delete dataArea.sekretaris_id;
                delete dataArea.bendahara_id;
                dataUserCreatedBy.area = dataArea;
            }
            listData[idx].created_by = dataUserCreatedBy;

            let dataUserOriginRespondentBy = await knex('users').where('id', '=', listData[idx].origin_respondent_by).first();
            if (dataUserOriginRespondentBy.area_id != null && dataUserOriginRespondentBy.area_id != '') {
                let dataArea = await knex('areas').where('id', '=', dataUserOriginRespondentBy.area_id).first();

                let dataUrbanVillage = await knex({ u: 'urban_villages' })
                    .select({
                        id: 'u.id',
                        name: 'u.name',
                        idKecamatan: 'sd.id',
                    })
                    .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                    .where('u.id', '=', dataArea.urban_village_id)
                    .first();

                let dataSubDistrict = await knex('sub_districts')
                    .where('id', '=', dataArea.sub_district_id)
                    .first();

                dataArea.data_kecamatan = dataSubDistrict;
                dataArea.data_kelurahan = dataUrbanVillage;
                delete dataArea.lottery_club_id;
                delete dataArea.ketua_id;
                delete dataArea.wakil_ketua_id;
                delete dataArea.sekretaris_id;
                delete dataArea.bendahara_id;
                dataUserOriginRespondentBy.area = dataArea;
            }
            listData[idx].origin_respondent_by = dataUserOriginRespondentBy;

        }


        return res.status(200).json(listData);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GET MEET BY ID
router.get('/get/id-meet/:idMeet', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idMeet } = req.params;
    try {
        if (stringUtils.isEmptyString(idMeet)) {
            return res.status(400).json('Data tidak valid');
        }
        let dataJanjiTemu = await knex('meetings').where('id', '=', idMeet).first();
        if (!dataJanjiTemu) {
            return res.status(400).json('Data tidak valid');
        }


        if (dataJanjiTemu.confirmated_by != null) {
            let dataUserConfirmated = await knex('users').where('id', '=', dataJanjiTemu.confirmated_by).first();
            dataJanjiTemu.confirmated_by = dataUserConfirmated;
        }
        if (dataJanjiTemu.new_respondent_by != null) {
            let dataUserNewRespondent = await knex('users').where('id', '=', dataJanjiTemu.new_respondent_by).first();
            dataJanjiTemu.new_respondent_by = dataUserNewRespondent;
        }

        if (dataJanjiTemu.meet_datetime_negotiated_by != null) {
            let dataUserNewRespondent = await knex('users').where('id', '=', dataJanjiTemu.meet_datetime_negotiated_by).first();
            if (dataUserNewRespondent.area_id != null && dataUserNewRespondent.area_id != '') {
                let dataArea = await knex('areas').where('id', '=', dataUserNewRespondent.area_id).first();

                let dataUrbanVillage = await knex({ u: 'urban_villages' })
                    .select({
                        id: 'u.id',
                        name: 'u.name',
                        idKecamatan: 'sd.id',
                    })
                    .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                    .where('u.id', '=', dataArea.urban_village_id)
                    .first();

                let dataSubDistrict = await knex('sub_districts')
                    .where('id', '=', dataArea.sub_district_id)
                    .first();

                dataArea.data_kecamatan = dataSubDistrict;
                dataArea.data_kelurahan = dataUrbanVillage;
                delete dataArea.lottery_club_id;
                delete dataArea.ketua_id;
                delete dataArea.wakil_ketua_id;
                delete dataArea.sekretaris_id;
                delete dataArea.bendahara_id;
                dataUserNewRespondent.area = dataArea;
            }
            dataJanjiTemu.meet_datetime_negotiated_by = dataUserNewRespondent;
        }

        let dataUserCreatedBy = await knex('users').where('id', '=', dataJanjiTemu.created_by).first();
        if (dataUserCreatedBy.area_id != null && dataUserCreatedBy.area_id != '') {
            let dataArea = await knex('areas').where('id', '=', dataUserCreatedBy.area_id).first();

            let dataUrbanVillage = await knex({ u: 'urban_villages' })
                .select({
                    id: 'u.id',
                    name: 'u.name',
                    idKecamatan: 'sd.id',
                })
                .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                .where('u.id', '=', dataArea.urban_village_id)
                .first();

            let dataSubDistrict = await knex('sub_districts')
                .where('id', '=', dataArea.sub_district_id)
                .first();

            dataArea.data_kecamatan = dataSubDistrict;
            dataArea.data_kelurahan = dataUrbanVillage;
            delete dataArea.lottery_club_id;
            delete dataArea.ketua_id;
            delete dataArea.wakil_ketua_id;
            delete dataArea.sekretaris_id;
            delete dataArea.bendahara_id;
            dataUserCreatedBy.area = dataArea;
        }
        dataJanjiTemu.created_by = dataUserCreatedBy;

        let dataUserOriginRespondentBy = await knex('users').where('id', '=', dataJanjiTemu.origin_respondent_by).first();
        if (dataUserOriginRespondentBy.area_id != null && dataUserOriginRespondentBy.area_id != '') {
            let dataArea = await knex('areas').where('id', '=', dataUserOriginRespondentBy.area_id).first();

            let dataUrbanVillage = await knex({ u: 'urban_villages' })
                .select({
                    id: 'u.id',
                    name: 'u.name',
                    idKecamatan: 'sd.id',
                })
                .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                .where('u.id', '=', dataArea.urban_village_id)
                .first();

            let dataSubDistrict = await knex('sub_districts')
                .where('id', '=', dataArea.sub_district_id)
                .first();

            dataArea.data_kecamatan = dataSubDistrict;
            dataArea.data_kelurahan = dataUrbanVillage;
            delete dataArea.lottery_club_id;
            delete dataArea.ketua_id;
            delete dataArea.wakil_ketua_id;
            delete dataArea.sekretaris_id;
            delete dataArea.bendahara_id;
            dataUserOriginRespondentBy.area = dataArea;
        }
        dataJanjiTemu.origin_respondent_by = dataUserOriginRespondentBy;


        return res.status(200).json(dataJanjiTemu);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === ADD MEET
router.post('/add', isAuthenticated,
    uploadItemLampiranJanjiTemu.fields([
        { name: 'file_lampiran', maxCount: 1 },
    ]), async (req, res) => {
        let user = req.authenticatedUser;
        let {
            title,
            detail,
            meet_datetime,
            area_id
        } = req.body;

        console.log(req.body)

        try {
            if (stringUtils.isEmptyString(title)
                || stringUtils.isEmptyString(detail)
                || stringUtils.isEmptyString(meet_datetime)
                || stringUtils.isEmptyString(area_id)) {
                return res.status(400).json('Data tidak valid');
            }
            let dataArea = await knex('areas').where('id', '=', area_id).first();

            let newID = await knex('meetings').insert({
                "file_lampiran": req.files.file_lampiran[0].filename,
                "title": title,
                "detail": detail,
                "area_id": area_id,
                "meet_datetime": meet_datetime,
                "meet_datetime_negotiated_by": user.id,
                "origin_respondent_by": dataArea.ketua_id,
                "created_at": moment().toDate(),
                "created_by": user.id,
                "status": 0
            });

            // kirim notifikasi ke ketua
            await sendNotification(dataArea.ketua_id, 'janji_temu', 'Janji Temu Baru', `Terdapat janji temu baru yang dibuat oleh ${user.full_name} dengan judul ${title}`);

            let filePath = path.join(
                __dirname,
                '..',
                '..',
                '..',
                'public',
                'uploads',
                'meet',
                'file_lampiran',
                `${newID[0]}`
            );
            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(filePath, { recursive: true });
            }

            fs.moveSync(
                req.files.file_lampiran[0].path,
                path.join(filePath, req.files.file_lampiran[0].filename)
            );

            return res.status(200).json("Berhasil membuat permohonan janji temu !");
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR');
        }
    });
// === END

// === GET LIST AREA
router.get('/get/areas', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataListArea;
        if (user.user_role == 7 || user.user_role == 6 || user.user_role == 5) {
            dataListArea = await knex('areas').where('id', '!=', user.area_id);
        } else {
            dataListArea = await knex('areas');
        }


        for (let idx = 0; idx < dataListArea.length; idx++) {
            let dataUrbanVillage = await knex({ u: 'urban_villages' })
                .select({
                    id: 'u.id',
                    name: 'u.name',
                    idKecamatan: 'sd.id',
                })
                .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id')
                .where('u.id', '=', dataListArea[idx].urban_village_id)
                .first();

            let dataSubDistrict = await knex('sub_districts')
                .where('id', '=', dataListArea[idx].sub_district_id)
                .first();

            dataListArea[idx].data_kecamatan = dataSubDistrict;
            dataListArea[idx].data_kelurahan = dataUrbanVillage;
            delete dataListArea[idx].lottery_club_id;
            delete dataListArea[idx].ketua_id;
            delete dataListArea[idx].wakil_ketua_id;
            delete dataListArea[idx].sekretaris_id;
            delete dataListArea[idx].bendahara_id;

        }

        return res.status(200).json(dataListArea);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === BATALKAN
router.patch('/cancel', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { meet_id, confirmation_notes } = req.body;
    try {
        if (stringUtils.isEmptyString(meet_id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataJanjiTemu = await knex('meetings')
            .where('id', '=', meet_id)
            .first();

        if (!dataJanjiTemu) {
            return res.status(400).json('Data tidak valid');
        }

        let dataArea = await knex('areas').where('id', '=', dataJanjiTemu.area_id).first();

        if (stringUtils.isEmptyString(confirmation_notes)) {
            await knex('meetings').update({
                "status": -2,
                "confirmated_by": user.id,
                "confirmated_at": moment().toDate(),
            }).where('id', '=', meet_id);
            await sendNotification(dataArea.ketua_id, 'janji_temu',
                'Janji Temu Dibatalkan', `Janji temu anda yang dengan judul ${dataJanjiTemu.title} dibatalkan oleh ${user.full_name} (Pemohon)`);
        } else {
            await knex('meetings').update({
                "status": -2,
                "confirmated_by": user.id,
                "confirmated_at": moment().toDate(),
                "confirmation_notes": confirmation_notes,
            }).where('id', '=', meet_id);
            await sendNotification(dataArea.ketua_id, 'janji_temu',
                'Janji Temu Dibatalkan', `Janji temu anda yang dengan judul ${dataJanjiTemu.title} dibatalkan oleh ${user.full_name} (Pemohon) dengan alasan ${confirmation_notes}`);
        }

        return res.status(200).json("Berhasil membatalkan janji temu !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === MENOLAK
router.patch('/decline', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { meet_id, confirmation_notes } = req.body;
    try {
        if (stringUtils.isEmptyString(meet_id) || stringUtils.isEmptyString(confirmation_notes)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataJanjiTemu = await knex('meetings')
            .where('id', '=', meet_id)
            .first();

        if (!dataJanjiTemu) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('meetings').update({
            "status": -1,
            "confirmated_by": user.id,
            "confirmated_at": moment().toDate(),
            "confirmated_notes": confirmation_notes,
        }).where('id', '=', meet_id);

        // kirim notifikasi ke ketua
        await sendNotification(dataJanjiTemu.created_by, 'janji_temu', 'Janji Temu Ditolak', `Janji temu anda yang dengan judul ${dataJanjiTemu.title} ditolak oleh ${user.full_name}`);

        return res.status(200).json("Berhasil menolak janji temu !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === MENERIMA
router.patch('/accept', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { meet_id } = req.body;
    try {
        if (stringUtils.isEmptyString(meet_id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataJanjiTemu = await knex('meetings')
            .where('id', '=', meet_id)
            .first();

        if (!dataJanjiTemu) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('meetings').update({
            "status": 1,
            "confirmated_by": user.id,
            "confirmated_at": moment().toDate(),
        }).where('id', '=', meet_id);

        await sendNotification(dataJanjiTemu.created_by, 'janji_temu', 'Janji Temu Diterima', `Janji temu anda yang dengan judul ${dataJanjiTemu.title} diterima oleh ${user.full_name}`);
        return res.status(200).json("Berhasil menerima janji temu !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GANTI TANGGAL
router.patch('/change-date', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { meet_id, new_date } = req.body;
    try {
        if (stringUtils.isEmptyString(meet_id) || stringUtils.isEmptyString(new_date)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataJanjiTemu = await knex('meetings')
            .where('id', '=', meet_id)
            .first();

        if (!dataJanjiTemu) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('meetings').update({
            "meet_datetime": new_date,
            "meet_datetime_negotiated_by": user.id
        }).where('id', '=', meet_id);

        await sendNotification(dataJanjiTemu.created_by, 'janji_temu', 'Perubahan Jadwal Janji Temu', `Terdapat permohonan perubahan jadwal janji temu anda dengan judul: ${dataJanjiTemu.title}`);

        return res.status(200).json("Berhasil mengajukan pergantian jadwal !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GANTI RESPONDEN
router.patch('/change-respondent', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { meet_id, new_respondent_id } = req.body;
    try {
        if (stringUtils.isEmptyString(meet_id) || stringUtils.isEmptyString(new_respondent_id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataJanjiTemu = await knex('meetings')
            .where('id', '=', meet_id)
            .first();

        if (!dataJanjiTemu) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users').where('id', '=', new_respondent_id).first();
        if (!dataUser) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('meetings').update({
            "new_respondent_by": dataUser.id,
            "new_respondent_role": dataUser.user_role,
            "change_respondent_at": moment().toDate()
        }).where('id', '=', meet_id);

        await sendNotification(dataJanjiTemu.created_by, 'janji_temu', 'Perubahan Responden Janji Temu', `Terdapat perubahan responden pada janji temu anda dengan judul ${dataJanjiTemu.title}`);

        return res.status(200).json("Berhasil mengganti responden !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

module.exports = router;