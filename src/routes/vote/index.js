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


// === GET LIST KANDIDAT VOTE 
router.get('/pengurus-rt/data/list-kandidat/period/:periode', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { periode } = req.params;

    try {

        let listData = await knex('neighbourhood_head_candidates')
        .where('area_id', '=', user.area_id)
        .andWhere('periode', '=', periode)
        .andWhere('status','=',1);

        for (let idxListData = 0; idxListData < listData.length; idxListData++) {
            let dataArea = await knex('areas').where('id', '=', listData[idxListData].area_id).first();
            delete dataArea.lottery_club_id;
            delete dataArea.ketua_id;
            delete dataArea.wakil_ketua_id;
            delete dataArea.sekretaris_id;
            delete dataArea.bendahara_id;
            listData[idxListData].dataArea = dataArea;

            let dataUser = await knex('users').where('id', '=', listData[idxListData].user_id).first();
            delete dataUser.created_by;
            delete dataUser.created_at;
            delete dataUser.refresh_token;
            delete dataUser.total_serving_as_neighbourhood_head;
            delete dataUser.sign_img;
            delete dataUser.password;
            delete dataUser.nik;
            delete dataUser.kk_num;
            delete dataUser.born_at;
            delete dataUser.born_date;
            delete dataUser.religion;
            delete dataUser.status_perkawinan;
            delete dataUser.profession;
            delete dataUser.nationality;
            delete dataUser.is_lottery_club_member;
            listData[idxListData].dataUser = dataUser;

            let dataCreatedBy = await knex('users').where('id', '=', listData[idxListData].created_by).first();
            delete dataCreatedBy.created_by;
            delete dataCreatedBy.created_at;
            delete dataCreatedBy.refresh_token;
            delete dataCreatedBy.total_serving_as_neighbourhood_head;
            delete dataCreatedBy.sign_img;
            delete dataCreatedBy.password;
            delete dataCreatedBy.nik;
            delete dataCreatedBy.kk_num;
            delete dataCreatedBy.born_at;
            delete dataCreatedBy.born_date;
            delete dataCreatedBy.religion;
            delete dataCreatedBy.status_perkawinan;
            delete dataCreatedBy.profession;
            delete dataCreatedBy.nationality;
            delete dataCreatedBy.is_lottery_club_member;
            listData[idxListData].created_by = dataCreatedBy;

            let dataDate = await knex.select({
                start: knex.raw('date_add(tenure_end_at, INTERVAL -1825 day)'),
                end: 'tenure_end_at'
            }).from('areas').where('id','=',dataArea.id).first();

            let dataListEventTaskDetail = await knex('event_task_details')
                .select({
                    "totalTask": knex.raw('count(id)'),
                    "totalRatingTask": knex.raw('sum(rating_ctr)'),
                    "avgRatingTask": knex.raw('sum(rating_avg)'),
                })
                .whereBetween('created_at', [dataDate.start, dataDate.end])
                .andWhere('user_id', '=', dataUser.id)
                .andWhere('status','=', 1)
                .first();

            listData[idxListData].totalTask = dataListEventTaskDetail['totalTask'];
            listData[idxListData].totalRatingTask = dataListEventTaskDetail['totalRatingTask'];
            listData[idxListData].avgRatingTask = dataListEventTaskDetail['avgRatingTask'];
        }

        return res.status(200).json(listData);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// ===

// === GET MY DATA 
router.get('/data/my/period/:periode', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { periode } = req.params;

    try {
        let data = await knex('votings')
            .where('voter_id', '=', user.id)
            .andWhere('periode', '=', periode)
            .first();

        if (data) {
            let dataKandidat = await knex('neighbourhood_head_candidates')
                .where('id', '=', data.neighbourhood_head_candidate_id)
                .first();

            let dataArea = await knex('areas').where('id', '=', dataKandidat.area_id).first();
                delete dataArea.lottery_club_id;
                delete dataArea.ketua_id;
                delete dataArea.wakil_ketua_id;
                delete dataArea.sekretaris_id;
                delete dataArea.bendahara_id;
            dataKandidat.dataArea = dataArea;

            let dataUser = await knex('users')
                .where('id','=', dataKandidat.user_id)
                .first();
                delete dataUser.created_by;
                delete dataUser.created_at;
                delete dataUser.refresh_token;
                delete dataUser.total_serving_as_neighbourhood_head;
                delete dataUser.sign_img;
                delete dataUser.password;
                delete dataUser.nik;
                delete dataUser.kk_num;
                delete dataUser.born_at;
                delete dataUser.born_date;
                delete dataUser.religion;
                delete dataUser.status_perkawinan;
                delete dataUser.profession;
                delete dataUser.nationality;
                delete dataUser.is_lottery_club_member;
            dataKandidat.dataUser = dataUser;

            let dataCreatedBy = await knex('users').where('id', '=', dataKandidat.created_by).first();
                delete dataCreatedBy.created_by;
                delete dataCreatedBy.created_at;
                delete dataCreatedBy.refresh_token;
                delete dataCreatedBy.total_serving_as_neighbourhood_head;
                delete dataCreatedBy.sign_img;
                delete dataCreatedBy.password;
                delete dataCreatedBy.nik;
                delete dataCreatedBy.kk_num;
                delete dataCreatedBy.born_at;
                delete dataCreatedBy.born_date;
                delete dataCreatedBy.religion;
                delete dataCreatedBy.status_perkawinan;
                delete dataCreatedBy.profession;
                delete dataCreatedBy.nationality;
                delete dataCreatedBy.is_lottery_club_member;
            dataKandidat.created_by = dataCreatedBy;

            data.dataKandidat = dataKandidat;
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// ===

// === ADD VOTE
router.post('/send', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idNeighbourhoodHeadCandidate, periode } = req.body;

    try {
        await knex('votings').insert({
            "voter_id": user.id,
            "neighbourhood_head_candidate_id": idNeighbourhoodHeadCandidate,
            "created_at": moment().toDate(),
            "periode": periode
        });

        let dataKandidat = await knex('neighbourhood_head_candidates').where('id','=',idNeighbourhoodHeadCandidate).first();

        await knex('neighbourhood_head_candidates').update({
            "total_vote_obtained": dataKandidat.total_vote_obtained +1
        }).where('id','=',idNeighbourhoodHeadCandidate);

        return res.status(200).json("Berhasil melakukan voting !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// ===




module.exports = router;