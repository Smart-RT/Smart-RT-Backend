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


// === ADD 
router.post('/add', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { visi, misi, periode } = req.body;

    try {
        await knex('neighbourhood_head_candidates').insert({
            "user_id": user.id,
            "area_id": user.area_id,
            "visi": visi,
            "misi": misi,
            "periode": periode,
            "created_at": moment().toDate(),
            "created_by": user.id
        });

        return res.status(200).json("Berhasil mendaftar calon pengurus RT !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// ===

// === ADD (REKOMENDASI PANITIA)
router.post('/add/recommendation', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { periode, listIdKandidat } = req.body;

    try {
        if (Array.isArray(listIdKandidat)) {
            for (let idx = 0; idx < listIdKandidat.length; idx++) {
                await knex('neighbourhood_head_candidates').insert({
                    "user_id": listIdKandidat[idx],
                    "area_id": user.area_id,
                    "visi": "Belum Diisi !",
                    "misi": "Belum Diisi !",
                    "periode": periode,
                    "created_at": moment().toDate(),
                    "created_by": user.id
                });
            }
        } else {
            await knex('neighbourhood_head_candidates').insert({
                "user_id": listIdKandidat,
                "area_id": user.area_id,
                "visi": "Belum Diisi !",
                "misi": "Belum Diisi !",
                "periode": periode,
                "created_at": moment().toDate(),
                "created_by": user.id
            });
        }

        return res.status(200).json("Berhasil mendaftar calon pengurus RT !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// ===

// === GET MY
router.get('/get/my/period/:periode', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { periode } = req.params;

    try {
        let data = await knex('neighbourhood_head_candidates')
            .where('user_id', '=', user.id)
            .andWhere('periode', '=', periode)
            // .andWhere('status','>=',0)
            .orderBy('id', 'desc')
            .first();

        if (data) {
            let dataArea = await knex('areas').where('id', '=', data.area_id).first();
            delete dataArea.lottery_club_id;
            delete dataArea.ketua_id;
            delete dataArea.wakil_ketua_id;
            delete dataArea.sekretaris_id;
            delete dataArea.bendahara_id;
            data.dataArea = dataArea;
            let dataUser = await knex('users').where('id', '=', data.user_id).first();
            data.dataUser = dataUser;
            let dataCreatedBy = await knex('users').where('id', '=', data.created_by).first();
            data.created_by = dataCreatedBy;
            if (data.discualified_by != null) {
                let dataDiscualifiedBy = await knex('users').where('id', '=', data.discualified_by).first();
                data.discualified_by = dataDiscualifiedBy;

            }
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
router.get('/get/all/period/:periode', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { periode } = req.params;

    try {
        let listData = await knex('neighbourhood_head_candidates')
            .where('area_id', '=', user.area_id)
            .andWhere('periode', '=', periode);

        for (let idx = 0; idx < listData.length; idx++) {
            let dataArea = await knex('areas').where('id', '=', listData[idx].area_id).first();
            delete dataArea.lottery_club_id;
            delete dataArea.ketua_id;
            delete dataArea.wakil_ketua_id;
            delete dataArea.sekretaris_id;
            delete dataArea.bendahara_id;
            listData[idx].dataArea = dataArea;
            let dataUser = await knex('users').where('id', '=', listData[idx].user_id).first();
            listData[idx].dataUser = dataUser;
            let dataCreatedBy = await knex('users').where('id', '=', listData[idx].created_by).first();
            listData[idx].created_by = dataCreatedBy;
            if (listData[idx].discualified_by != null) {
                let dataDiscualifiedBy = await knex('users').where('id', '=', listData[idx].discualified_by).first();
                listData[idx].discualified_by = dataDiscualifiedBy;

            }
        }

        return res.status(200).json(listData);

    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === MENGUNDURKAN DIRI
router.patch('/resign', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idNeighbourhoodHeadCandidate, notes } = req.body;

    try {
        if (stringUtils.isEmptyString(idNeighbourhoodHeadCandidate) ||
            stringUtils.isEmptyString(notes)) {
            return res.status(400).json('Data tidak valid');
        }
        await knex('neighbourhood_head_candidates')
            .update({
                'status': -2,
                'discualified_at': moment().toDate(),
                'discualified_by': user.id,
                'discualified_notes': notes
            })
            .where('id', '=', idNeighbourhoodHeadCandidate);

        return res.status(200).json('Berhasil mengundurkan diri!');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === DISKUALIFIKASI
router.patch('/discualification', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        idNeighbourhoodHeadCandidate,
        alasan
    } = req.body;

    try {
        if (stringUtils.isEmptyString(idNeighbourhoodHeadCandidate)||stringUtils.isEmptyString(alasan)) {
            return res.status(400).json('Data tidak valid');
        }
        
        await knex('neighbourhood_head_candidates').update({
            "status": -1,
            "discualified_notes": alasan,
            "discualified_by": user.id,
            "discualified_at": moment().toDate(),
        }).where('id','=', idNeighbourhoodHeadCandidate);

        return res.status(200).json("Berhasil mendiskualifikasi kandidat !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === UPDATE VISI MISI
router.patch('/update/visi-misi', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        idNeighbourhoodHeadCandidate,
        visi,
        misi
    } = req.body;

    try {
        if (stringUtils.isEmptyString(idNeighbourhoodHeadCandidate)||stringUtils.isEmptyString(visi)||stringUtils.isEmptyString(misi)) {
            return res.status(400).json('Data tidak valid');
        }
        
        await knex('neighbourhood_head_candidates').update({
            "visi": visi,
            "misi": misi
        }).where('id','=', idNeighbourhoodHeadCandidate);

        return res.status(200).json("Berhasil menyimpan visi misi!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 




module.exports = router;