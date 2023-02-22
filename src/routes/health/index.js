// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');

// === CREATE REPORT
router.post('/userReporting', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {reported_id_for, area_reported_id, disease_level, disease_notes} = req.body;
    try {
        if (stringUtils.isEmptyString(reported_id_for) 
            || stringUtils.isEmptyString(area_reported_id) 
            || stringUtils.isEmptyString(disease_level) 
            || stringUtils.isEmptyString(disease_notes)) {
                return res.status(400).json('Data tidak valid');
        }

        let statusHealth = -1;
        let confirmation_status = 0;

        if (reported_id_for == user.id) {
            statusHealth = 0;
            confirmation_status = 1;
        }

        await knex('user_health_reports').insert({
            "reported_id_for": reported_id_for,
            "area_reported_id": area_reported_id,
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


module.exports = router;