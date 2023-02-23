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

        let statusHealth = -1;
        let confirmation_status = -1;

        if (reported_id_for == user.id) {
            statusHealth = 0;
            confirmation_status = 1;
            await knex('user_health_reports')
                .update({"confirmation_status": 0})
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

// === UPDATED USER_HEALT_REPORTS (SAYA SUDAH SEHAT)
router.patch('/userReported/sayaSehat', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataUser = await knex('users').where('id', '=', user.id).first();
        if (dataUser.is_health != 0) {
            return res.status(400).json('Anda sudah Sehat!');
        }

        await knex('user_health_reports')
            .update({
                healed_at: moment().toDate()
            }).where('reported_id_for', '=', user.id)
              .andWhere('confirmation_status', '=', 1)
              .whereNull('healed_at');

        await knex('users').update({"is_health": 1}).where('id', '=', user.id);

        return res.status(200).json("Sekarang anda sehat! Jagalah kesehatan anda!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

module.exports = router;