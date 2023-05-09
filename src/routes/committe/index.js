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
const { takeCoverage } = require('v8');

// === GET MY COMMITTE
router.get('/get/my', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;

    try {
        let dataDate = await knex.select({
            start: knex.raw('date_add(tenure_end_at, INTERVAL -60 day)'),
            end: 'tenure_end_at'
        }).from('areas').where('id','=',user.area_id).first();

        console.log(dataDate);


        let data = await knex('committees')
            .where('user_id','=', user.id)
            .whereBetween('created_at', [dataDate.start, dataDate.end])
            .andWhere('status', '!=', -2)
            .orderBy('id', 'desc')
            .first();
        
        console.log(data);

        if (data) {
            let dataUser = await knex('users').where('id','=', data.user_id).first();
            delete data.user_id;
            data.data_user = dataUser;
            let dataCreatedBy = await knex('users').where('id','=', data.created_by).first();
            data.created_by = dataCreatedBy;
            let dataConfirmationBy = await knex('users').where('id','=', data.confirmation_by).first();
            data.confirmation_by = dataConfirmationBy;
            return res.status(200).json(data);
        }

        return res.status(400).json('Tidak ada data !');

    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET ALL COMMITTE
router.get('/get/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;

    try {
        let dataDate = await knex.select({
            start: knex.raw('date_add(tenure_end_at, INTERVAL -60 day)'),
            end: 'tenure_end_at'
        }).from('areas').where('id','=',user.area_id).first();


        let listData = await knex('committees')
            .whereBetween('created_at', [dataDate.start, dataDate.end])
            .andWhere('status', '!=', -2);

        for (let idx = 0; idx < listData.length; idx++) {
            let dataUser = await knex('users').where('id','=', listData[idx].user_id).first();
            delete listData[idx].user_id;
            listData[idx].data_user = dataUser;
            let dataCreatedBy = await knex('users').where('id','=', listData[idx].created_by).first();
            listData[idx].created_by = dataCreatedBy;
            let dataConfirmationBy = await knex('users').where('id','=', listData[idx].confirmation_by).first();
            listData[idx].confirmation_by = dataConfirmationBy;
        }
        
        return res.status(200).json(listData); 

    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ADD REQ COMMITTE
router.post('/req/add', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;

    try {
        await knex('committees').insert({
            "user_id": user.id,
            "area_id": user.area_id,
            "created_at": moment().toDate(),
            "created_by": user.id,
            "status": 0
        });

        return res.status(200).json("Berhasil mendaftar panitia !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ADD REQ COMMITTE REC
router.post('/req/add/recommendation', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        list_id
    } = req.body;

    try {
        if (Array.isArray(list_id)) {
            for (let i = 0; i < list_id.length; i++) {
                await knex('committees').insert({
                    "user_id": list_id[i],
                    "area_id": user.area_id,
                    "created_at": moment().toDate(),
                    "created_by": user.id,
                    "status": 0
                });
            }
        }else{
            await knex('committees').insert({
                "user_id": list_id,
                "area_id": user.area_id,
                "created_at": moment().toDate(),
                "created_by": user.id,
                "status": 0
            });
        }
        

        return res.status(200).json("Berhasil merekomendasikan panitia !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === CANCEL REQ COMMITTE
router.patch('/req/cancel', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        committe_id,
    } = req.body;

    try {
        if (stringUtils.isEmptyString(committe_id)) {
            return res.status(400).json('Data tidak valid');
        }
        
        await knex('committees').update({
            "status": -2,
            "confirmation_by": user.id,
            "confirmation_at": moment().toDate(),
        }).where('id','=', committe_id);

        return res.status(200).json("Berhasil membatalkan pendaftaran panitia !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ACCEPT REQ COMMITTE
router.patch('/req/accept', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        committe_id,
    } = req.body;

    try {
        if (stringUtils.isEmptyString(committe_id)) {
            return res.status(400).json('Data tidak valid');
        }
        
        await knex('committees').update({
            "status": 1,
            "confirmation_by": user.id,
            "confirmation_at": moment().toDate(),
        }).where('id','=', committe_id);

        let data =  await knex('committees').where('id','=', committe_id).first();
        await knex('users').update({"is_committe": 1}).where('id','=',data.user_id);

        return res.status(200).json("Berhasil menerima pendaftaran panitia !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === REJECT REQ COMMITTE
router.patch('/req/reject', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        committe_id,
        alasan
    } = req.body;

    try {
        if (stringUtils.isEmptyString(committe_id)||stringUtils.isEmptyString(alasan)) {
            return res.status(400).json('Data tidak valid');
        }
        
        await knex('committees').update({
            "status": -1,
            "notes": alasan,
            "confirmation_by": user.id,
            "confirmation_at": moment().toDate(),
        }).where('id','=', committe_id);

        return res.status(200).json("Berhasil menolak pendaftaran panitia !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 



module.exports = router;