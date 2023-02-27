// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');

// === GET DISEASE GROUP
router.get('/diseaseGroup', async (req, res) => {
    try {
        let listDiseaseGroup = await knex('disease_groups');
        return res.status(200).json(listDiseaseGroup);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === CREATE REPORT
router.post('/userReporting', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { reported_id_for, area_reported_id, disease_group_id, disease_level, disease_notes } = req.body;
    try {
        if (stringUtils.isEmptyString(reported_id_for)
            || stringUtils.isEmptyString(area_reported_id)
            || stringUtils.isEmptyString(disease_group_id)
            || stringUtils.isEmptyString(disease_level)
            || stringUtils.isEmptyString(disease_notes)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users')
            .where('id','=',user.id)
            .first();

        let dataArea = await knex('areas')
            .where('id','=',dataUser.area_id)
            .first();

        let statusHealth = -1;
        let confirmation_status = -1;

        if (reported_id_for == user.id || user.id == dataArea.ketua_id) {
            statusHealth = 0;
            confirmation_status = 1;
            await knex('user_health_reports')
                .update({ "confirmation_status": 0 })
                .where('reported_id_for', '=', reported_id_for)
                .andWhere('confirmation_status', '=', -1);
        }

        await knex('user_health_reports').insert({
            "reported_id_for": reported_id_for,
            "area_reported_id": area_reported_id,
            "disease_group_id": disease_group_id,
            "disease_level": disease_level,
            "disease_notes": disease_notes,
            "created_by": user.id,
            "created_at": moment().toDate(),
            "confirmation_status": confirmation_status
        });

        await knex('users').update({
            "is_health": statusHealth
        }).where('id', '=', reported_id_for);

        return res.status(200).json("Berhasil Melaporkan !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST RIWAYAT SAKIT
router.get('/userReported', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let listRiwayatSakit = await knex('user_health_reports')
            .where('reported_id_for', '=', user.id)
            .andWhere('confirmation_status', '=', 1);

        for (let idx = 0; idx < listRiwayatSakit.length; idx++) {
            let dataDiseaseGroup = await knex('disease_groups')
                .where('id', '=', listRiwayatSakit[idx].disease_group_id)
                .first();
            listRiwayatSakit[idx].disease_group_id = dataDiseaseGroup;
        }
        return res.status(200).json(listRiwayatSakit);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST RIWAYAT SAKIT (ALL)
router.get('/userReported/all', async (req, res) => {
    try {
        let listRiwayatSakit = await knex('user_health_reports')
            .where('confirmation_status', '=', 1);

        for (let idx = 0; idx < listRiwayatSakit.length; idx++) {
            let dataDiseaseGroup = await knex('disease_groups')
                .where('id', '=', listRiwayatSakit[idx].disease_group_id)
                .first();
            listRiwayatSakit[idx].disease_group_id = dataDiseaseGroup;
            let dataUser = await knex('users')
                .where('id', '=', listRiwayatSakit[idx].reported_id_for)
                .first();
            listRiwayatSakit[idx].reported_data_user = dataUser;
            dataUser = await knex('users')
                .where('id', '=', listRiwayatSakit[idx].created_by)
                .first();
            listRiwayatSakit[idx].created_by_data_user = dataUser;
            dataUser = await knex('users')
                .where('id', '=', listRiwayatSakit[idx].confirmation_by)
                .first();
            listRiwayatSakit[idx].confirmation_by_data_user = dataUser;
        }
        return res.status(200).json(listRiwayatSakit);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATED USER_HEALT_REPORTS (SAYA SUDAH SEHAT)
router.patch('/userReported/sayaSehat', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataUser = await knex('users').where('id', '=', user.id).first();
        if (dataUser.is_health != 0) {
            return res.status(400).json('Anda sudah Sehat!');
        }

        let dataUserHealthReport = await knex('user_health_reports')
            .where('reported_id_for', '=', user.id)
            .andWhere('confirmation_status', '=', 1)
            .whereNull('healed_at').first();

        await knex('user_health_reports')
            .update({
                healed_at: moment().toDate()
            }).where('id', '=', dataUserHealthReport.id);

        await knex('users').update({ "is_health": 1 }).where('id', '=', user.id);
        await knex('health_task_helps').update({
            "status": -2,
            "confirmation_by": dataUser.id,
            "confirmation_at": moment().toDate()
        }).where(function () {
            this.where('status', '=', 0)
                .orWhere('status', '=', 1)
        }).andWhere('user_health_report_id', '=', dataUserHealthReport.id);

        return res.status(200).json("Sekarang anda sehat! Jagalah kesehatan anda!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === CREATE HEALTH_TASK_HELPS
router.post('/healthTaskHelp', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { urgent_level, notes, help_type } = req.body;
    try {
        if (stringUtils.isEmptyString(urgent_level)
            || stringUtils.isEmptyString(notes)
            || stringUtils.isEmptyString(help_type)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users').where('id', '=', user.id).first();
        let dataPenyakit = await knex('user_health_reports')
            .where('reported_id_for', '=', dataUser.id)
            .andWhere('confirmation_status', '=', 1)
            .whereNull('healed_at')
            .first();

        if (dataPenyakit == null || !dataPenyakit) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('health_task_helps').insert({
            "area_id": dataUser.area_id,
            "user_health_report_id": dataPenyakit.id,
            "urgent_level": urgent_level,
            "notes": notes,
            "help_type": help_type,
            "status": 0,
            "created_at": moment().toDate(),
            "created_by": dataUser.id
        });


        return res.status(200).json("Berhasil Meminta Bantuan!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST HEALTH_TASK_HELPS berdasarkan STATUS
router.get('/healthTaskHelp/list/:status/is-all/:isAll', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { status, isAll } = req.params;
    try {
        if (stringUtils.isEmptyString(status) || (isAll != 'yes' && isAll != 'no')) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users').where('id', '=', user.id).first();
        let listHealthTaskHelp;

        if (isAll == 'yes') {
            if (status == 'telahBerlalu') {
                listHealthTaskHelp = await knex('health_task_helps')
                    .where(function () {
                        this.where('status', 2)
                            .orWhere('status', '=', -1)
                            .orWhere('status', '=', -2)
                    }).andWhere('area_id', '=', dataUser.area_id);
            } else {
                listHealthTaskHelp = await knex('health_task_helps')
                    .where('status', '=', status)
                    .andWhere('area_id', '=', dataUser.area_id);
            }
        }else{
            if (status == 'telahBerlalu') {
                listHealthTaskHelp = await knex('health_task_helps')
                    .where(function () {
                        this.where('status', 2)
                            .orWhere('status', '=', -1)
                            .orWhere('status', '=', -2)
                    }).andWhere('created_by', '=', dataUser.id);
            } else {
                listHealthTaskHelp = await knex('health_task_helps')
                    .where('status', '=', status)
                    .andWhere('created_by', '=', dataUser.id);
            }
        }

        

        for (let idx = 0; idx < listHealthTaskHelp.length; idx++) {
            let dataPenyakit = await knex('user_health_reports').where('id', '=', listHealthTaskHelp[idx].user_health_report_id).first();
            let dataDiseaseGroup = await knex('disease_groups').where('id', '=', dataPenyakit.disease_group_id).first();
            dataPenyakit.disease_group_id = dataDiseaseGroup;
            listHealthTaskHelp[idx].user_health_report_id = dataPenyakit;
        }

        return res.status(200).json(listHealthTaskHelp);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET HEALTH_TASK_HELPS (REQ ID)
router.get('/healthTaskHelp/:id', async (req, res) => {
    let { id } = req.params;
    try {
        if (stringUtils.isEmptyString(id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataHealthTaskHelp = await knex('health_task_helps')
            .where('id', '=', id)
            .first();

        if (dataHealthTaskHelp == null || !dataHealthTaskHelp) {
            return res.status(400).json('Data tidak valid');
        }

        let dataPenyakit = await knex('user_health_reports').where('id', '=', dataHealthTaskHelp.user_health_report_id).first();
        let dataDiseaseGroup = await knex('disease_groups').where('id', '=', dataPenyakit.disease_group_id).first();
        dataPenyakit.disease_group_id = dataDiseaseGroup;
        dataHealthTaskHelp.user_health_report_id = dataPenyakit;

        return res.status(200).json(dataHealthTaskHelp);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATE MINTA BANTUAN
router.patch('/healthTaskHelp', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { status, idBantuan } = req.body;
    try {
        if (stringUtils.isEmptyString(status)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users').where('id', '=', user.id).first();
        if (status == -2 || status == 1) {
            await knex('health_task_helps').update({
                "status": status,
                "confirmation_by": dataUser.id,
                "confirmation_at": moment().toDate(),
            }).where('id', '=', idBantuan);
            return res.status(200).json("Berhasil Membatalkan");
        } else if (status == -1) {
            let { alasanPenolakan } = req.body;
            if (stringUtils.isEmptyString(alasanPenolakan)) {
                return res.status(400).json('Data tidak valid');
            }

            await knex('health_task_helps').update({
                "status": status,
                "rejected_reason": alasanPenolakan,
                "confirmation_by": dataUser.id,
                "confirmation_at": moment().toDate(),
            }).where('id', '=', idBantuan);
            return res.status(200).json("Berhasil Menolak!");
        }else if (status == 2) {
            await knex('health_task_helps').update({
                "status": status,
                "solved_by": dataUser.id,
                "solved_at": moment().toDate(),
            }).where('id', '=', idBantuan);
            return res.status(200).json("Berhasil Menyelesaikan!");
        } 

        return res.status(200).json("Berhasil!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

module.exports = router;