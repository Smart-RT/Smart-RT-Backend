const cron = require('node-cron');
const knex = require('../../database');
const moment = require('moment-timezone');
const { randomVarchar } = require('../strings');
const { sendNotification } = require('../notification');
moment.tz('Asia/Jakarta');

const cronTaskDaily = async () => {
    publishLotteryClubPeriodDetail();
    lotreLotteryCLubPeriodDetail();
    changeNeighbourhoodHead();
    generateAreaBillRepeatDetails();
}

const publishLotteryClubPeriodDetail = async () => {
    // ambil semua data Period Detail yang berstatus unPublished
    let listData = await knex('lottery_club_period_details').where('status', '=', 'Unpublished');
    let date = moment();
    date.add(3, 'days');
    await Promise.all(
        listData.map(async (period_detail) => {
            let dateDB = moment(period_detail.meet_date);
            // Kalau tanggal hari ini h-3 maka ubah status jadi published.
            if (dateDB.isBefore(date)) {
                await knex('lottery_club_period_details').update({
                    'status': 'Published',
                    'updated_at': moment().toDate(),
                }).where('id', '=', period_detail.id);
                // Mengambil data Lottery Club Period Detail yang ingin di update
                let dataLotteryClubPeriod = await knex('lottery_club_periods')
                    .where('id', '=', period_detail.lottery_club_period_id)
                    .first();
                let listAnggotaPeriode = await knex('lottery_club_period_members')
                    .where('lottery_club_period_id', '=', period_detail.lottery_club_period_id);
                await Promise.all(listAnggotaPeriode.map(async (member) => {
                    await knex('lottery_club_period_detail_absences')
                        .insert({
                            user_id: member.user_id,
                            lottery_club_period_member_id: member.id,
                            lottery_club_period_detail_id: period_detail.id,
                            is_present: 0,
                            created_at: moment().toDate()
                        });

                    await knex('lottery_club_period_detail_bills')
                        .insert({
                            user_id: member.user_id,
                            lottery_club_period_member_id: member.id,
                            lottery_club_period_detail_id: period_detail.id,
                            bill_amount: dataLotteryClubPeriod.bill_amount,
                            status: 0,
                            created_at: moment().toDate()
                        });

                    await knex('lottery_club_period_members').update({
                        debt_amount: member.debt_amount + dataLotteryClubPeriod.bill_amount
                    }).where('id', '=', member.id);
                }));
            }
        })
    );

}

const lotreLotteryCLubPeriodDetail = async () => {
    // Ambil semua data yang published
    let listData = await knex('lottery_club_period_details').where('status', '=', 'Published');
    let date = moment();
    await Promise.all(
        listData.map(async (period_detail) => {
            let dateDB = moment(period_detail.meet_date);
            // Kalau hari ini sudah melewati tanggal di DB, maka ambil pemenang
            if (dateDB.isBefore(date)) {
                let dataPertemuan = await knex('lottery_club_period_details')
                    .where('id', '=', period_detail.id)
                    .first();
                // Mengambil data LOTTERY_CLUB_PERIODS
                let dataPeriod = await knex('lottery_club_periods')
                    .where('id', '=', dataPertemuan.lottery_club_period_id)
                    .first();

                // Mengambil data Area
                let dataArea = await knex('areas')
                    .where('id', '=', dataPeriod.area_id)
                    .first();

                // Mengecek Butuh Berapa Pemenang
                let ctrWinnerNeeded = Math.floor(dataPeriod.total_already_not_be_a_winner / (dataPeriod.total_meets - (dataPeriod.meet_ctr - 1)));
                console.log('dataPeriod.total_already_not_be_a_winner : ' + dataPeriod.total_already_not_be_a_winner);
                console.log('dataPeriod.total_meets : ' + dataPeriod.total_meets);
                console.log('dataPeriod.meet_ctr : ' + dataPeriod.meet_ctr);
                console.log('ctrWinnerNeeded : ' + ctrWinnerNeeded);

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
                console.log('listMemberBelumMenang.length : ' + listMemberBelumMenang.length);
                // let listMemberBelumMenang = await knex.select({
                //     id: 'members.user_id'
                // }).from({
                //     members: 'lottery_club_period_members',
                //     absences: 'lottery_club_period_detail_absences'
                // }).whereRaw(`
                //     members.lottery_club_period_id = ${dataPeriod.id} AND
                //     members.debt_amount = 0 AND
                //     members.already_be_a_winner = 0 AND
                //     absences.is_present = 1 AND
                //     members.id = absences.lottery_club_period_member_id`
                // );

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
                        id: 'members.user_id'
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
                        id: 'members.user_id'
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

                console.log('idRandomP1 : ' + idRandomP1)
                console.log('idRandomP2 : ' + idRandomP2)

                let dataPemenang = await knex('lottery_club_period_members')
                    .whereRaw(`user_id = ${idRandomP1} or user_id = ${idRandomP2}`)
                    .andWhere('periode', '=', dataPertemuan.period_ke);

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
                            updated_by: user.id,
                            status: 'Done',
                        }).where('id', '=', dataPertemuan.id);
                } else {
                    await knex('lottery_club_period_details')
                        .update({
                            winner_1_id: idRandomP1,
                            winner_2_id: idRandomP2,
                            updated_at: moment().toDate(),
                            updated_by: user.id,
                            status: 'Done',
                        }).where('id', '=', dataPertemuan.id);
                }

                // Update LOTTERY_CLUB_PERIOD_MEMBERS
                if (ctrWinnerNeeded == 1) {
                    await knex('lottery_club_period_members')
                        .update({
                            already_be_a_winner: 1,
                            updated_at: moment().toDate(),
                            updated_by: user.id
                        }).where('user_id', '=', idRandomP1).andWhere('periode', '=', dataPertemuan.period_ke);
                } else {
                    await knex('lottery_club_period_members')
                        .update({
                            already_be_a_winner: 1,
                            updated_at: moment().toDate(),
                            updated_by: user.id
                        }).whereRaw(`user_id = ${idRandomP1} or user_id = ${idRandomP2}`)
                        .andWhere('periode', '=', dataPertemuan.period_ke);
                }

                if (dataPeriod.meet_ctr != dataPeriod.total_meets) {
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
                        pertemuan_ke: dataPeriod.meet_ctr + 1,
                        period_ke: dataPeriod.period,
                        created_at: moment().toDate(),
                        created_by: user.id,
                    });

                    // Update LOTTERY_CLUB_PERIODS
                    await knex('lottery_club_periods').update({
                        meet_ctr: dataPeriod.meet_ctr + 1,
                        total_already_not_be_a_winner: dataPeriod.total_already_not_be_a_winner - ctrWinnerNeeded,
                        default_meet_date: nextDate,
                    }).where('id', '=', dataPeriod.id);
                } else {
                    // Update LOTTERY_CLUB_PERIODS
                    await knex('lottery_club_periods').update({
                        total_already_not_be_a_winner: 0,
                        ended_at: moment().toDate(),
                    }).where('id', '=', dataPeriod.id);

                    await knex('areas').update({
                        is_lottery_club_period_active: 0
                    }).where('id', '=', user.area_id);

                    await knex('users').update({
                        is_lottery_club_member: 0
                    }).where('area_id', '=', user.area_id)
                }
            }
        })
    );
}

const changeNeighbourhoodHead = async () => {
    let today = moment();

    let areasTenureEnded = await knex({ a: 'areas' })
        .select('id', 'area_code', 'tenure_end_at', 'periode', 'ketua_id',
            'wakil_ketua_id', 'wakil_ketua_code', 'sekretaris_id',
            'sekretaris_code', 'bendahara_id', 'bendahara_code', 'tenure_end_at',
            knex({ nhc: 'neighbourhood_head_candidates' })
                .select('user_id')
                .where('nhc.area_id', '=', knex.ref('a.id'))
                .andWhere('nhc.periode', '=', knex.ref('a.periode'))
                .andWhere('nhc.total_vote_obtained', '=', (sub) => {
                    sub.max('nhc2.total_vote_obtained')
                        .from({ nhc2: 'neighbourhood_head_candidates' })
                        .where('nhc.area_id', '=', knex.ref('a.id'))
                        .andWhere('nhc.periode', '=', knex.ref('a.periode'))
                })
                .first()
                .as("winner_id")
        )
        .where('tenure_end_at', "<", today.format('yyyy-MM-DD'));
    // Ambil data yang ada pemenangnya saja
    areasTenureEnded = areasTenureEnded.filter(a => a.winner_id);

    // Loop untuk setiap area yang sudah ada pemenangnya
    areasTenureEnded.forEach(async (area) => {
        let { id, ketua_id, wakil_ketua_id, sekretaris_id, bendahara_id, winner_id, tenure_end_at } = area;
        let resetIdUser = [ketua_id, wakil_ketua_id, sekretaris_id, bendahara_id].filter(id => id);

        // reset user role ke warga
        await knex('users').update({ 'user_role': 2 }).whereIn('id', resetIdUser);

        // update ketua_id di area menjadi user winner.
        // bikin kode unik lagi untuk kode sekre, bendahara, wakil
        let wakilKetuaCode = randomVarchar(10);
        let sekretarisCode = randomVarchar(10);
        let bendaharaCode = randomVarchar(10);
        // set tenure end 4 thun lagi
        let newTenure = moment(tenure_end_at).add(4, 'years');
        await knex('areas')
            .update({
                ketua_id: winner_id, periode: knex.raw('periode + 1'),
                wakil_ketua_code: wakilKetuaCode,
                sekretaris_code: sekretarisCode,
                bendahara_code: bendaharaCode,
                wakil_ketua_id: null,
                sekretaris_id: null,
                bendahara_id: null,
                tenure_end_at: newTenure.format('yyyy-MM-DD')
            })
            .where('id', '=', id);

        // update role user menjadi ketua 
        await knex('users').update({
            user_role: 7,
            total_serving_as_neighbourhood_head: knex.raw('total_serving_as_neighbourhood_head + 1')
        })
            .where('id', '=', winner_id);
    });
}

const generateAreaBillRepeatDetails = async () => {
    let today = moment();

    // Cronjob iuran repeat
    let iuranRepeats = await knex('area_bills')
        .where('status', '=', 1)
        .andWhere('is_repeated', '=', 1);
    // Untuk setiap iurannya, lakukan pengecekan apakah sudah ada taguhihan bulan ini?
    iuranRepeats.forEach(async (iuran) => {
        let lastIuranDetail = await knex('area_bill_repeat_details')
            .where('area_bill_id', '=', iuran.id)
            .orderBy('month_year', 'desc')
            .first();
        let lastIuranDate = moment(lastIuranDetail.month_year);
        // Check kalau sudah wayahnya
        if (lastIuranDate.format('yyyy-MM-DD') != today.format('yyyy-MM-DD') && lastIuranDate.format('DD') == today.format('DD')) {
            // ambil data user di area...
            let usersInArea = await knex('users').where('area_id', '=', iuran.area_id);
            // Masukin area_bill_repeat_details baru
            let areaBillRepeatId = await knex('area_bill_repeat_details').insert({
                month_year: today.format('yyyy-MM-DD'),
                area_bill_id: iuran.id,
                bill_amount: iuran.bill_amount,
                payer_total: usersInArea.length,
                payer_count: 0,
                total_paid_amount: 0,
            });
            areaBillRepeatId = areaBillRepeatId[0];
            //  Masukin area_bill_transactions baru untuk setiap user.
            usersInArea.forEach(async (user) => {
                await knex('area_bill_transactions').insert({
                    area_bill_id: iuran.id,
                    area_bill_repeat_detail_id: areaBillRepeatId,
                    user_id: user.id,
                    bill_amount: iuran.bill_amount,
                    status: 0,
                    created_at: moment().toDate()
                });
                await sendNotification(user.id, 'iuran', 'Tagihan Iuran', `Terdapat tagihan iuran baru dengan nominal ${iuran.bill_amount}`);
            });
        }
    });
}

const runCrons = async () => {
    console.log('Menjalankan cronjobs..');

    // Jalankan setiap hari
    cron.schedule('0 0 * * *', () => {
        // apapun yang ada disini, akan dijalankan setiap hari.
        cronTaskDaily();
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });
}

const stopCrons = async () => {
    console.log("Mematikan semua cronjobs..");
    // ambil semua cron job, lalu jalankan method stop pada setiap task nya.
    await Promise.all(cron.getTasks().map(c => c.stop()));
}

module.exports = { runCrons, stopCrons };