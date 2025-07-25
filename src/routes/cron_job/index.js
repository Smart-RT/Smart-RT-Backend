// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');
const cron = require('node-cron');

/**
 * https://www.npmjs.com/package/node-cron
 */

// running a task every day
cron.schedule('0 0 * * *', () => {
    cronTaskDaily();
}, {
    scheduled: true,
    timezone: 'Asia/Jakarta'
});

const cronTaskDaily = async () => {
    publishLotteryClubPeriodDetail();
    lotreLotteryCLubPeriodDetail();
}

const publishLotteryClubPeriodDetail = async () => {
    // ambil semua data Period Detail yang berstatus unPublished
    // Jika date hari ini = h-3 meet date maka status menjadi published

    let listData = await knex('lottery_club_period_details').where('status', '=', 'Unpublished');
    const d = new Date();
    d.setDate(d.getDate() + 3);
    for (let idx = 0; idx < listData.length; idx++) {
        let dateDB = Date.parse(String(listData[idx].meet_date).substring(0, 10));

        let date = String(d.getDate()).padStart(2, '0');
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let year = d.getFullYear();

        let dateNowPlus3 = Date.parse(year + '-' + month + '-' + date);

        if (dateDB == dateNowPlus3) {
            await knex('lottery_club_period_details').update({
                'status': Published,
                'updated_at': moment().toDate(),
            }).where('id', '=', listData[idx].id);
        }
    }
}

const lotreLotteryCLubPeriodDetail = async () => {
    // ambil semua data Period Detail yang berstatus Published
    // Jika date hari ini = h+1 meet date maka status menjadi Done dengan memilih pemenang

    let listData = await knex('lottery_club_period_details').where('status', '=', 'Published');
    const d = new Date();
    d.setDate(d.getDate() - 1);
    for (let idx = 0; idx < listData.length; idx++) {
        let dateDB = Date.parse(String(listData[idx].meet_date).substring(0, 10));

        let date = String(d.getDate()).padStart(2, '0');
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let year = d.getFullYear();

        let dateNowMin1 = Date.parse(year + '-' + month + '-' + date);

        if (dateDB == dateNowMin1) {
            let dataPeriod = await knex('lottery_club_periods')
                .where('id', '=', listData[idx].lottery_club_period_id)
                .first();

            // Mengambil data Area
            let dataArea = await knex('areas')
                .where('id', '=', dataPeriod.area_id)
                .first();

            // Mengecek Butuh Berapa Pemenang
            let ctrWinnerNeeded = Math.floor(dataPeriod.total_already_not_be_a_winner / (dataPeriod.total_meets - (dataPeriod.meet_ctr - 1)));

            // Mengambil data Anggota yang belum pernah menang dan utang = 0 dan hadir di arisan
            let listMemberBelumMenang = await knex.select({
                id: 'members.user_id'
            }).from({
                members: 'lottery_club_period_members',
                absences: 'lottery_club_period_detail_absences'
            }).whereRaw(`
                members.lottery_club_period_id = ${dataPeriod.id} AND
                members.debt_amount = 0 AND
                members.already_be_a_winner = 0 AND
                absences.is_present = 1 AND
                members.id = absences.lottery_club_period_member_id`
            );

            // Pokok diutamakan yang ga bermasalah
            let idxRandomP1, idxRandomP2;
            let idRandomP1 = -1, idRandomP2 = -1;

            if (listMemberBelumMenang.length >= ctrWinnerNeeded) {
                if (ctrWinnerNeeded == 1) {
                    idxRandomP1 = Math.floor(Math.random() * listMemberBelumMenang.length);
                    idRandomP1 = listMemberBelumMenang[idxRandomP1].id;
                } else {
                    do {
                        idxRandomP1 = Math.floor(Math.random() * listMemberBelumMenang.length);
                        idxRandomP2 = Math.floor(Math.random() * listMemberBelumMenang.length);
                    } while (idxRandomP1 == idxRandomP2);
                    idRandomP1 = listMemberBelumMenang[idxRandomP1].id;
                    idRandomP2 = listMemberBelumMenang[idxRandomP2].id;
                }
            } else if (listMemberBelumMenang.length == 1 && ctrWinnerNeeded == 2) {
                // Kalau ada 1 yang ga bermasalah doank tp butuh 2 pemenang
                idxRandomP1 = 0;
                idRandomP1 = listMemberBelumMenang[idxRandomP1].id;

                listMemberBelumMenang = await knex.select({
                    id: 'members.id'
                }).from({
                    members: 'lottery_club_period_members',
                    absences: 'lottery_club_period_detail_absences'
                }).whereRaw(`
                    members.lottery_club_period_id = ${dataPeriod.id} AND
                    members.already_be_a_winner = 0 AND
                    members.id = absences.lottery_club_period_member_id AND
                    members.id != ${idRandomP1}`
                );

                idxRandomP2 = Math.floor(Math.random() * listMemberBelumMenang.length);
                idRandomP2 = listMemberBelumMenang[idxRandomP2].id;

            } else {
                // Pemenang bermasalah kabeh intine XD
                listMemberBelumMenang = await knex.select({
                    id: 'members.id'
                }).from({
                    members: 'lottery_club_period_members',
                    absences: 'lottery_club_period_detail_absences'
                }).whereRaw(`
                    members.lottery_club_period_id = ${dataPeriod.id} AND
                    members.already_be_a_winner = 0 AND
                    members.id = absences.lottery_club_period_member_id`
                );

                do {
                    idxRandomP1 = Math.floor(Math.random() * listMemberBelumMenang.length);
                    idxRandomP2 = Math.floor(Math.random() * listMemberBelumMenang.length);
                } while (idxRandomP1 == idxRandomP2);
                idRandomP1 = listMemberBelumMenang[idxRandomP1].id;
                idRandomP2 = listMemberBelumMenang[idxRandomP2].id;
            }

            let dataPemenang = await knex('lottery_club_period_members')
                .where('id', '=', idRandomP1)
                .orWhere('id', '=', idRandomP2);

            for (let idx = 0; idx < dataPemenang.length; idx++) {
                let dataUser = await knex('users')
                    .where('id', '=', dataPemenang[idx].user_id)
                    .first();
                dataPemenang[idx].user_id = dataUser;
            }

            // // UPDATE LOTTERY_CLUB_PERIOD_DETAILS
            if (ctrWinnerNeeded == 1) {
                await knex('lottery_club_period_details')
                    .update({
                        winner_1_id: idRandomP1,
                        updated_at: moment().toDate(),
                        status: 'Done',
                    }).where('id', '=', listData[idx].lottery_club_period_id);
            } else {
                await knex('lottery_club_period_details')
                    .update({
                        winner_1_id: idRandomP1,
                        winner_2_id: idRandomP2,
                        updated_at: moment().toDate(),
                        status: 'Done',
                    }).where('id', '=', listData[idx].lottery_club_period_id);
            }

            // Update LOTTERY_CLUB_PERIOD_MEMBERS
            if (ctrWinnerNeeded == 1) {
                await knex('lottery_club_period_members')
                    .update({
                        already_be_a_winner: 1,
                        updated_at: moment().toDate(),
                    }).where('id', '=', idRandomP1);
            } else {
                await knex('lottery_club_period_members')
                    .update({
                        already_be_a_winner: 1,
                        updated_at: moment().toDate(),
                    }).where('id', '=', idRandomP1).orWhere('id', '=', idRandomP2);
            }


            let datetimeMeetBefore = moment
                .tz(dataPertemuan.meet_date, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm');
            let nextDate = moment.tz(datetimeMeetBefore, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta').add(1, 'M').format('YYYY-MM-DD HH:mm');

            // Insert Detail Period pertemuan selanjutnya dgn stats unpublished (Nanti dapat di update)
            await knex('lottery_club_period_details').insert({
                lottery_club_period_id: dataPeriod.id,
                lottery_club_id: dataArea.lottery_club_id,
                status: 'Unpublished',
                is_offline_meet: 0,
                meet_date: nextDate,
                created_at: moment().toDate(),
            });

            // Update LOTTERY_CLUB_PERIODS
            await knex('lottery_club_periods').update({
                meet_ctr: dataPeriod.meet_ctr + 1,
                total_already_not_be_a_winner: dataPeriod.total_already_not_be_a_winner - ctrWinnerNeeded,
                default_meet_date: nextDate,
            }).where('id', '=', dataPeriod.id)

        }
    }
}


// CATATAN :
/**
 * o Lottery Club Period Details -> Ubah created_by bisa null
 */


module.exports = router;