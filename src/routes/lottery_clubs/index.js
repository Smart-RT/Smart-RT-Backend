// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');

/** CATATAN dan BATASAN ARISAN
 *  # 1 Wilayah hanya dapat memiliki 1 arisan dan periode arisan yang aktif
 *  # Pertemuan arisan tiap bulan 1x
 *  # 1 pertemuan max 2 pemenang (2 pemenang hanya dapat dipilih di pertemuan-pertemuan akhir)
 *      misal : 14 orang (maka 12 pertemuan)
 *              pertemuan ke -1  : 1 pemenang
 *              pertemuan ke -2  : 1 pemenang
 *              ...
 *              pertemuan ke -10 : 1 pemenang
 *              pertemuan ke -11 : 2 pemenang
 *              pertemuan ke -12 : 2 pemenang
 *      * hal tersebut agar ketika di pertemuan ke-11 maka uang kas arisan cukup untuk memberi uang sejumlah dengan semestinya tanpa utang
 *  # Kas pada arisan berfungsi untuk menyimpan uang yang belum di keluarkan untuk pemenang
 *  # Penerimaan / pengolahan anggota hanya bisa dilakukan ketika
 *      -> arisan wilayah sudah terbuat
 *      -> arisan periode sudah terbuat dan belum melakukan pertemuan sama sekali
 *    * Saat pertemuan sudah berjalan, sudah tidak dapat menambahkan/mengelola anggota!
 *  # Min 6 orang per periode arisan max 48 orang
 *  # Limit year cuma 1/2, 1, 2, 3, atau 4 tahun
 *  # Limit year :
 *      ->  6 ~ 11 orang / periode
 *           = 1/2  tahun   ->  6x pertemuan
 *      -> 12      orang / periode
 *           = 1/2  tahun   ->  6x pertemuan
 *           =   1  tahun   -> 12x pertemuan
 *      -> 13 ~ 23 orang / periode
 *           =   1  tahun   -> 12x pertemuan
 *      -> 24      orang / periode
 *           =   1  tahun   -> 12x pertemuan
 *           =   2  tahun   -> 24x pertemuan
 *      -> 25 ~ 35 orang / periode
 *           =   2  tahun   -> 24x pertemuan
 *      -> 36      orang / periode
 *           =   2  tahun   -> 24x pertemuan
 *           =   3  tahun   -> 36x pertemuan
 *      -> 37 ~ 47 orang / periode
 *           =   3  tahun   -> 36x pertemuan
 *      -> 48      orang / periode
 *           =   3  tahun   -> 36x pertemuan
 *           =   4  tahun   -> 48x pertemuan
 *
 *   !!! Pikirkan cara menghadapi arisan berjalan namun pergantian role / tiba-tiba keluar dari wilayah tersebut (ex. warga pindah rumah) !!!
 *
 */

// === MEMBUKA ARISAN WILAYAH (LOTTERY_CLUBS)
/** Langkah :
 * 1. Cek role privilage
 * 2. Cek area belum pernah membuka arisan
 * 3. Insert ke tabel lottery_clubs
 * 4. Mengupdate data lottery_club_id di tabel areas dengan ID yang di dapat dari insert tersebut.
 */
router.post('/', isAuthenticated, async (req, res) => {
    // Mengambil data user yang melakukan request
    let user = req.authenticatedUser;

    try {
        // Mengambil data Area yang ingin dibuat arisan
        let dataArea = await knex('areas')
            .where('id', '=', user.area_id)
            .first();

        // Mengecek privillage apakah user requester merupakan ketua RT
        if (dataArea.ketua_id != user.id) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        // Mengecek area belum pernah membuat arisan
        if (dataArea.lottery_club_id != null) {
            return res
                .status(400)
                .json('Area sudah pernah membuka fitur arisan');
        }

        // Insert Lottery Club
        let newLotteryClubID = await knex('lottery_clubs').insert({
            area_id: user.area_id,
            last_period: 0,
            kas_amount: 0,
            created_at: moment().toDate(),
            created_by: user.id,
        });
        console.log(newLotteryClubID[0]);

        // Mengupdate Area
        await knex('areas')
            .update({ lottery_club_id: newLotteryClubID })
            .where('id', '=', dataArea.id);

        // Mengambil dan mengembalikan data terbaru yang baru saja di insert
        let newLotteryClubData = await knex('lottery_clubs')
            .where('id', '=', newLotteryClubID[0])
            .first();

        return res.status(200).json(newLotteryClubData);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === MEMBUAT PERIODE ARISAN (LOTTERY_CLUB_PERIODS - HEADER) 
/** Langkah :
 * 1. Mengecek role privilage
 * 2. Mengecek area tersebut tidak memiliki periode yang masih aktif
 * 3. Mengecek total orang di wilayah tersebut (harus > 6)
 * 4. Mengecek ID dan data anggota valid
 * 5. Mengecek data lainnya yang dikirimkan valid
 *    Data yang wajib ada yaitu (dengan syaratnya) 
 *      -> area_id, ID terdaftar
 *      -> lottery_club_id, ID terdaftar dan areanya sama
 *      -> period, last_period (tabel : lottery_club) + 1
 *      -> bill_amount, min 10K max 1Jt
 *      -> winner_bill_amount, bill_amount x total_pertemuan
 *      -> year_limit, 0.5 ~ 4 tahun sesuai dengan jumlah total members (hanya kelipatan 12 yang dapat memilih range waktunya)
 *      -> total_meets, sesuai CATATAN dan ATURAN ARISAN
 *      -> total_members, minimal 6 dan maksimal 48
 *      -> started_at, harus h+7 dari hari saat ini
 *      -> created_at, datetime saat ini
 *      -> created_by, pembuat arisan (ketua RT dari wilayah tersebut)
 *      -> ID Member wajib merupakan warga area arisan tersebut dan statusnya tidak di blacklist
 * 6. Insert LOTTERY_CLUB_PERIODS
 * 7. Update field is_lottery_club_period_active di AREAS
 * 8. Insert LOTTERY_CLUB_PERIOD_MEMBERS
 * 9. Insert LOTTERY_CLUB_PERIOD_DETAILS (status unpublish)
 */
router.post('/periode', isAuthenticated, async (req, res) => {
    // Mengambil data user yang melakukan request
    let user = req.authenticatedUser;

    try {
        // Mengambil data Area yang ingin dibuat arisan
        let dataArea = await knex('areas')
            .where('id', '=', user.area_id)
            .first();

        // Mengecek privillage apakah user requester merupakan ketua RT
        if (dataArea.ketua_id != user.id) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        // Mengecek area tidak mempunyai period arisan yang masih aktif
        if (dataArea.is_lottery_club_period_active == 1) {
            return res
                .status(400)
                .json(
                    'Wilayah RT anda masih mempunyai periode arisan yang masih aktif!'
                );
        }

        // Mengambil data dari req.body
        let {
            bill_amount,
            winner_bill_amount,
            year_limit,
            total_meets,
            members,
            started_at,
        } = req.body;

        // Mengecek anggota >=6
        if (members.length < 6 || members.length > 48) {
            return res
                .status(400)
                .json(
                    'Anggota tidak boleh dibawah 6 orang atau diatas 48 orang.'
                );
        }

        // Mengecek data member valid (ID member ada di db)
        for (let idx = 0; idx < members.length; idx++) {
            const userMemberID = members[idx];
            if (stringUtils.isEmptyString(userMemberID)) {
                return res.status(400).json('Data tidak valid 1');
            }
            let checkMembers = await knex('users')
                .where('id', '=', userMemberID)
                .first();
            if (!checkMembers) {
                return res.status(400).json('ID User ada yang tidak valid');
            } else if (checkMembers.area_id != dataArea.id) {
                return res
                    .status(400)
                    .json('User ada yang bukan termasuk wilayah ini');
            }
        }

        // Mengecek data dari req.body valid
        if (
            stringUtils.isEmptyString(bill_amount) ||
            stringUtils.isEmptyString(winner_bill_amount) ||
            stringUtils.isEmptyString(year_limit) ||
            stringUtils.isEmptyString(started_at) ||
            stringUtils.isEmptyString(total_meets) ||
            parseInt(bill_amount) < 5000 ||
            parseInt(winner_bill_amount) < 5000 ||
            members.length < 1
        ) {
            return res.status(400).json('Data tidak valid');
        }

        // Mengecek data total members dengan lama periode dan total pertemuan sesuai dengan CATATAN dan ATURAN ARISAN
        if ((members.length >= 6 && members.length <= 11) && (year_limit != 0.5 || total_meets != 6)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 12 && ((year_limit != 0.5 || total_meets != 6) || (year_limit != 1 || total_meets != 12))) {
            return res.status(400).json('Data tidak valid');
        } else if ((members.length >= 13 && members.length <= 23) && (year_limit != 1 || total_meets != 12)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 24 && ((year_limit != 1 || total_meets != 12) || (year_limit != 2 || total_meets != 24))) {
            return res.status(400).json('Data tidak valid');
        } else if ((members.length >= 25 && members.length <= 35) && (year_limit != 2 || total_meets != 24)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 36 && ((year_limit != 2 || total_meets != 24) || (year_limit != 3 || total_meets != 36))) {
            return res.status(400).json('Data tidak valid');
        } else if ((members.length >= 37 && members.length <= 47) && (year_limit != 3 || total_meets != 36)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 48 && ((year_limit != 3 || total_meets != 36) || (year_limit != 4 || total_meets != 48))) {
            return res.status(400).json('Data tidak valid');
        }

        let dataLotteryClub = await knex('lottery_clubs')
            .where('id', '=', dataArea.lottery_club_id)
            .first();

        // Insert Header Lottery Club
        let newLotteryClubPeriodID = await knex('lottery_club_periods').insert({
            area_id: user.area_id,
            meet_ctr: 1,
            lottery_club_id: dataArea.lottery_club_id,
            period: dataLotteryClub.last_period + 1,
            bill_amount: parseInt(bill_amount),
            winner_bill_amount: parseInt(winner_bill_amount),
            year_limit: parseInt(year_limit),
            total_meets: parseInt(total_meets),
            total_members: members.length,
            started_at: moment
                .tz(started_at, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            created_at: moment().toDate(),
            created_by: user.id,
            total_already_not_be_a_winner: members.length
        });

        // Mengupdate Area
        await knex('areas')
            .update({ is_lottery_club_period_active: 1 })
            .where('id', '=', dataArea.id);

        // Insert member lottery club period
        for (let idx = 0; idx < members.length; idx++) {
            const userMemberID = members[idx];
            await knex('lottery_club_period_members').insert({
                user_id: userMemberID,
                periode: dataLotteryClub.last_period + 1,
                lottery_club_period_id: newLotteryClubPeriodID[0],
                debt_amount: 0,
                already_be_a_winner: 0,
                status: 1,
                created_at: moment().toDate(),
                created_by: user.id,
            });

            await knex('users').update({
                is_lottery_club_member: 1
            }).where('id', '=', userMemberID);
        }

        // Insert Detail Period pertemuan pertama dgn stats unpublished (Nanti dapat di update)
        await knex('lottery_club_period_details').insert({
            lottery_club_period_id: newLotteryClubPeriodID[0],
            lottery_club_id: dataArea.lottery_club_id,
            status: 'Unpublished',
            is_offline_meet: 0,
            meet_date: moment
                .tz(started_at, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            created_at: moment().toDate(),
            created_by: user.id,
            period_ke: dataLotteryClub.last_period + 1,
            pertemuan_ke: 1,
        });

        // // Mengambil dan mengembalikan data terbaru yang baru saja di insert
        // let newLotteryClubPeriodData = await knex('lottery_club_periods')
        //     .where('id', '=', newLotteryClubPeriodID)
        //     .first();
        // return res.status(200).json(newLotteryClubPeriodData);

        return res.status(200).json("SUKSES !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATE PERIODE ARISAN (LOTTERY_CLUB_PERIODS - HEADER) - UPDATE PERIODE NYA AJA
/** Catatan :
 * Update pasti melewati pilih anggota terlebih dahulu !
 */
/** Langkah :
 * 1. Mengecek role privilage (Ketua RT wilayah tersebut)
 * 2. Mengecek total pertemuan dalam periode tersebut hanya ada 1 dan belum di publikasikan
 * 3. Mengecek total orang di wilayah tersebut (harus > 6)
 * 4. Mengecek ID dan data anggota valid
 * 5. Mengecek data lainnya yang dikirimkan valid
 *    Data yang wajib ada yaitu (dengan syaratnya) 
 *      -> area_id, ID terdaftar
 *      -> lottery_club_id, ID terdaftar dan areanya sama
 *      -> period, last_period (tabel : lottery_club) + 1
 *      -> bill_amount, min 10K max 1Jt
 *      -> winner_bill_amount, bill_amount x total_pertemuan
 *      -> year_limit, 0.5 ~ 4 tahun sesuai dengan jumlah total members (hanya kelipatan 12 yang dapat memilih range waktunya)
 *      -> total_meets, sesuai CATATAN dan ATURAN ARISAN
 *      -> total_members, minimal 6 dan maksimal 48
 *      -> started_at, harus h+7 dari hari saat ini
 *      -> created_at, datetime saat ini
 *      -> created_by, pembuat arisan (ketua RT dari wilayah tersebut)
 *      -> ID Member wajib merupakan warga area arisan tersebut dan statusnya tidak di blacklist
 * 6. Update LOTTERY_CLUB_PERIODS
 * 7. Delete LOTTERY_CLUB_PERIOD MEMBERS
 * 8. Insert LOTTERY_CLUB_PERIOD_MEMBERS
 * 9. Update LOTTERY_CLUB_PERIOD_DETAILS (status unpublish)
 */
router.patch('/periode', isAuthenticated, async (req, res) => {
    // Mengambil data user yang melakukan request
    let user = req.authenticatedUser;
    let lottery_club_period_ID = req.body;

    try {
        // Mengambil data Lottery Club Period yang ingin di update
        let dataLotteryClubPeriod = await knex('lottery_club_periods')
            .where('id', '=', lottery_club_period_ID)
            .first();

        // Mengambil data Area yang ingin diupdate
        let dataArea = await knex('areas')
            .where('id', '=', dataLotteryClubPeriod.area_id)
            .first();

        // Mengecek privillage apakah user requester merupakan ketua RT
        if (dataArea.ketua_id != user.id) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        // Mengecek total pertemuan dalam periode itu valid (cuma 1 dan belum di publish)
        let listPertemuan = await knex('lottery_club_period_details')
            .where('lottery_club_period_id', '=', lottery_club_period_ID);

        if (listPertemuan.length != 1) {
            return res.status(400).json('Anda tidak dapat mengupdate periode yang telah berjalan');
        }

        if (listPertemuan[0].status != 'Unpublished') {
            return res.status(400).json('Anda tidak dapat mengupdate periode yang telah dipublikasikan');
        }

        // Mengambil data dari req.body
        let {
            bill_amount,
            winner_bill_amount,
            year_limit,
            total_meets,
            members,
            started_at,
        } = req.body;

        // Mengecek anggota < 6 dan > 48
        if (members.length < 6 || members.length > 48) {
            return res
                .status(400)
                .json(
                    'Anggota tidak boleh dibawah 6 orang atau diatas 48 orang.'
                );
        }

        // Mengecek data member valid (ID member ada di db)
        for (let idx = 0; idx < members.length; idx++) {
            const userMemberID = members[idx];
            if (stringUtils.isEmptyString(userMemberID)) {
                return res.status(400).json('Data tidak valid');
            }
            let checkMembers = await knex('users')
                .where('id', '=', userMemberID)
                .first();
            if (!checkMembers) {
                return res.status(400).json('ID User ada yang tidak valid');
            } else if (checkMembers.area_id != dataArea.id) {
                return res
                    .status(400)
                    .json('User ada yang bukan termasuk wilayah ini');
            }
        }

        // Mengecek data dari req.body valid
        if (
            stringUtils.isEmptyString(bill_amount) ||
            stringUtils.isEmptyString(winner_bill_amount) ||
            stringUtils.isEmptyString(year_limit) ||
            stringUtils.isEmptyString(started_at) ||
            stringUtils.isEmptyString(total_meets) ||
            parseInt(bill_amount) < 5000 ||
            parseInt(winner_bill_amount) < 5000 ||
            parseInt(winner_bill_amount) >
            parseInt(bill_amount) * members.length ||
            parseInt(year_limit) < 1 ||
            members.length < 1
        ) {
            return res.status(400).json('Data tidak valid');
        }

        // Mengecek data total members dengan lama periode dan total pertemuan sesuai dengan CATATAN dan ATURAN ARISAN
        if ((members.length >= 6 && members.length <= 11) && (year_limit != 0.5 || total_meets != 6)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 12 && ((year_limit != 0.5 || total_meets != 6) || (year_limit != 1 || total_meets != 12))) {
            return res.status(400).json('Data tidak valid');
        } else if ((members.length >= 13 && members.length <= 23) && (year_limit != 1 || total_meets != 12)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 24 && ((year_limit != 1 || total_meets != 12) || (year_limit != 2 || total_meets != 24))) {
            return res.status(400).json('Data tidak valid');
        } else if ((members.length >= 25 && members.length <= 35) && (year_limit != 2 || total_meets != 24)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 36 && ((year_limit != 2 || total_meets != 24) || (year_limit != 3 || total_meets != 36))) {
            return res.status(400).json('Data tidak valid');
        } else if ((members.length >= 37 && members.length <= 47) && (year_limit != 3 || total_meets != 36)) {
            return res.status(400).json('Data tidak valid');
        } else if (members.length == 48 && ((year_limit != 3 || total_meets != 36) || (year_limit != 4 || total_meets != 48))) {
            return res.status(400).json('Data tidak valid');
        }

        // Update Header Lottery Club
        await knex('lottery_club_periods').update({
            bill_amount: parseInt(bill_amount),
            winner_bill_amount: parseInt(winner_bill_amount),
            year_limit: parseInt(year_limit),
            total_meets: parseInt(total_meets),
            total_members: members.length,
            started_at: moment
                .tz(started_at, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            updated_at: moment().toDate(),
            updated_by: user.id,
        }).where('id', '=', lottery_club_period_ID);

        // Hapus semua anggota di periode ini
        await knex('lottery_club_period_members').where('lottery_club_period_id', '=', lottery_club_period_ID).del();

        // Insert member lottery club period
        for (let idx = 0; idx < members.length; idx++) {
            const userMemberID = members[idx];
            await knex('lottery_club_period_members').insert({
                user_id: userMemberID,
                lottery_club_period_id: newLotteryClubPeriodID,
                debt_amount: 0,
                already_be_a_winner: 0,
                status: 1,
                created_at: moment().toDate(),
                created_by: user.id,
            });
        }

        // Update Detail Period pertemuan pertama dgn stats unpublished
        await knex('lottery_club_period_details').update({
            meet_date: moment
                .tz(started_at, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            updated_at: moment().toDate(),
            updated_by: user.id,
        }).where('id', '=', listPertemuan[0].id);

        // Mengambil dan mengembalikan data terbaru yang baru saja di update
        let updatedLotteryClubPeriodData = await knex('lottery_club_periods')
            .where('id', '=', lottery_club_period_ID)
            .first();

        return res.status(200).json(updatedLotteryClubPeriodData);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATE PERTEMUAN PERIODE ARISAN (LOTTERY_CLUB_PERIOD_DETAILS - DETAIL) - UNTUK PUBLIKASI / UPDATE BIASA
/** Langkah :
 * 1. Mengecek data yang dikirim valid
 * 2. Mengecek role privilage
 * 3. Mengecek belum di publikasikan
 * 4. Jika Pertemuan Pertama
 *    Update LOTTERY_CLUB_PERIODS field started_at
 * 5. Update LOTTERY_CLUB_PERIOD_DETAILS
 * 6. Jika status dipublikasikan maka 
 *    Insert LOTTERY_CLUB_DETAIL_BILLS
 *    Insert LOTTERY_CLUB_DETAIL_ABSENCES
 */
router.patch('/periode/pertemuan', isAuthenticated, async (req, res) => {
    // Mengambil data user yang melakukan request
    let user = req.authenticatedUser;
    let {
        lottery_club_period_detail_id,
        meet_date,
        meet_at,
        status
    } = req.body;

    try {
        // Mengecek data dari req.body valid
        if (
            stringUtils.isEmptyString(lottery_club_period_detail_id) ||
            stringUtils.isEmptyString(meet_date) ||
            stringUtils.isEmptyString(meet_at) ||
            stringUtils.isEmptyString(status)
        ) {
            return res.status(400).json('Data tidak valid');
        }

        // Mengambil data Lottery Club Period Detail yang ingin di update
        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', lottery_club_period_detail_id)
            .first();

        if (!dataPertemuan) {
            return res.status(400).json('Data tidak valid');
        }

        // Mengambil data Lottery Club Period Detail yang ingin di update
        let dataLotteryClubPeriod = await knex('lottery_club_periods')
            .where('id', '=', dataPertemuan.lottery_club_period_id)
            .first();

        // Mengambil data Area yang ingin update
        let dataArea = await knex('areas')
            .where('id', '=', dataLotteryClubPeriod.area_id)
            .first();

        // Mengecek privillage apakah user requester merupakan ketua RT
        if (dataArea.ketua_id != user.id) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        // Mengecek data pertemuan belum dipublikasikan
        if (dataPertemuan.status != 'Unpublished') {
            return res.status(400).json('Anda tidak dapat merubah pertemuan yang sudah dipublikasikan');
        }

        // Update Detail Period pertemuan dgn stats unpublished
        await knex('lottery_club_period_details').update({
            meet_at: meet_at,
            meet_date: moment
                .tz(meet_date, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            status: status,
            updated_at: moment().toDate(),
            updated_by: user.id,
        }).where('id', '=', lottery_club_period_detail_id);

        // Mengambil listPertemuan Periode tersebut
        let listPertemuan = await knex('lottery_club_period_details')
            .where('lottery_club_period_id', '=', dataPertemuan.lottery_club_period_id);

        // Jika listPertemuan == 1 maka update lottery club period
        if (listPertemuan.length == 1) {
            await knex('lottery_club_periods').update({
                default_meet_location: meet_at,
                default_meet_date: moment
                .tz(meet_date, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
                started_at: moment
                    .tz(meet_date, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                    .format('YYYY-MM-DD HH:mm'),
                updated_at: moment().toDate(),
                updated_by: user.id,
            });
        }

        // Insert BILLS and ABSENCES jika data status yang dikirim published
        if (status == "Published") {
            let listAnggotaPeriode = await knex('lottery_club_period_members')
                .where('lottery_club_period_id', '=', dataLotteryClubPeriod.id);

            for (let idx = 0; idx < listAnggotaPeriode.length; idx++) {
                await knex('lottery_club_period_detail_absences')
                    .insert({
                        user_id: listAnggotaPeriode[idx].user_id,
                        lottery_club_period_member_id: listAnggotaPeriode[idx].id,
                        lottery_club_period_detail_id: dataPertemuan.id,
                        is_present: 0,
                        created_by: user.id,
                        created_at: moment().toDate()
                    });

                await knex('lottery_club_period_detail_bills')
                    .insert({
                        user_id: listAnggotaPeriode[idx].user_id,
                        lottery_club_period_member_id: listAnggotaPeriode[idx].id,
                        lottery_club_period_detail_id: dataPertemuan.id,
                        bill_amount: dataLotteryClubPeriod.bill_amount,
                        status: 0,
                        created_by: user.id,
                        created_at: moment().toDate()
                    });
            }

        }

        // let updatedLotteryClubPeriodData = await knex('lottery_club_periods')
        //     .where('id', '=', dataPertemuan.lottery_club_period_id)
        //     .first();

        return res.status(200).json("BERHASIL !");

    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END 

// === UPDATE ABSENCES
/** Langkah :
 * 1. Mengecek role privilage
 * 2. Update field IS_PRESENT dan PRESENT_DATE di tabel LOTTERY_CLUB_PERIOD_DETAIL_ABSENCES
 * 3. Update field TOTAL_ATTENDANCE di tabel LOTTERY_CLUB_PERIOD_DETAILS
 */
router.patch('/periode/pertemuan/absences', isAuthenticated, async (req, res) => {
    // Mengambil data user yang melakukan request
    let user = req.authenticatedUser;
    let { listIDAbsenAnggotaHadir, idPertemuan } = req.body;

    try {
        if (stringUtils.isEmptyString(idPertemuan)) {
            return res.status(400).json('Data tidak valid');
        }

        // Mengambil data Lottery Club Period Detail
        let dataPeriodDetail = await knex('lottery_club_period_details')
            .where('id', '=', idPertemuan)
            .first();

        // Mengambil data Lottery Club Period Detail - Untuk Ngecek Role Privilage
        let dataPeriod = await knex('lottery_club_periods')
            .where('id', '=', dataPeriodDetail.lottery_club_period_id)
            .first();

        // Mengambil data Area yang ingin update - Untuk Ngecek Role Privilage
        let dataArea = await knex('areas')
            .where('id', '=', dataPeriod.area_id)
            .first();

        // Mengecek privillage apakah user requester merupakan ketua RT
        if (dataArea.ketua_id != user.id) {
            return res.status(400).json('Anda tidak memiliki privilage');
        }

        // Mengambil data Lottery Club Period Detail Absences yang ingin di update
        let listDataAbsensi = await knex('lottery_club_period_detail_absences')
            .where('lottery_club_period_detail_id', '=', idPertemuan);

        let listIDHadir = [];
        for (let idx = 0; idx < listIDAbsenAnggotaHadir.length; idx++) {
            listIDHadir.push(parseInt(listIDAbsenAnggotaHadir[idx]));
        }

        for (let idx = 0; idx < listDataAbsensi.length; idx++) {
            if (listIDHadir.includes(listDataAbsensi[idx].id)) {
                await knex('lottery_club_period_detail_absences').update({
                    is_present: 1,
                    present_date: moment().toDate()
                }).where('id', '=', listDataAbsensi[idx].id);

            } else {
                await knex('lottery_club_period_detail_absences').update({
                    is_present: 0,
                    present_date: null
                }).where('id', '=', listDataAbsensi[idx].id);

            }
        }

        let totalAttendance = await knex('lottery_club_period_detail_absences')
            .where('lottery_club_period_detail_id', '=', idPertemuan).andWhere('is_present', '=', 1);

        await knex('lottery_club_period_details').update({
            total_attendance: totalAttendance.length
        }).where('id', '=', idPertemuan);

        return res.status(200).json("BERHASIL SIMPAN !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === LOTRE ACAK PEMENANG - UPDATE LOTTERY CLUB PERIOD DETAILS
/** Langkah :
 * 1. Mengecek data valid
 * 2. Mengecek role privilage
 * 3. Mengecek butuh berapa pemenang
 * 4. Merandom angka
 * 5. Update LOTTERY_CLUB_PERIOD_DETAILS (winner_1_id, winner_2_id, updated_at, updated_by)
 * 6. Update LOTTERY_CLUB_PERIOD_MEMBERS (already_be_a_winner)
 * 7. Insert LOTTERY_CLUB_PERIOD_DETAILS
 * 8. Update LOTTERY_CLUB_PERIODS (meet_ctr, total_already_not_be_a_winner)
 */
router.patch('/periode/pertemuan/start', isAuthenticated, async (req, res) => {
    // Mengambil data user yang melakukan request
    let user = req.authenticatedUser;
    // Mengambil data yang dikirim
    let {
        lottery_club_period_detail_ID
    } = req.body;
    try {
        // Mengecek data yang dikirim valid
        if (stringUtils.isEmptyString(lottery_club_period_detail_ID)) {
            return res.status(400).json('Data tidak valid 1');
        }

        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', lottery_club_period_detail_ID)
            .first();
        if (!dataPertemuan) {
            return res.status(400).json('Data tidak valid 2');
        }

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
        console.log(ctrWinnerNeeded);
        
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
            }else{
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
            .orWhere('id','=', idRandomP2);

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
                }).where('id', '=', idRandomP1);
        } else {
            await knex('lottery_club_period_members')
                .update({
                    already_be_a_winner: 1,
                    updated_at: moment().toDate(),
                    updated_by: user.id
                }).where('id', '=', idRandomP1).orWhere('id', '=', idRandomP2);
        }

        
        let datetimeMeetBefore = moment
        .tz(dataPertemuan.meet_date, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
        .format('YYYY-MM-DD HH:mm');
        let nextDate = moment.tz(datetimeMeetBefore, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta').add(1,'M').format('YYYY-MM-DD HH:mm');

        // Insert Detail Period pertemuan selanjutnya dgn stats unpublished (Nanti dapat di update)
        await knex('lottery_club_period_details').insert({
            lottery_club_period_id: dataPeriod.id,
            lottery_club_id: dataArea.lottery_club_id,
            status: 'Unpublished',
            is_offline_meet: 0,
            meet_date: nextDate,
            created_at: moment().toDate(),
            created_by: user.id,
        });

        // Update LOTTERY_CLUB_PERIODS
        await knex('lottery_club_periods').update({
            meet_ctr: dataPeriod.meet_ctr + 1,
            total_already_not_be_a_winner: dataPeriod.total_already_not_be_a_winner - ctrWinnerNeeded,
            default_meet_date: nextDate,
        }).where('id', '=', dataPeriod.id)

        return res.status(200).json(dataPemenang);

    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LAST PERIODE ID
router.get('/getLastPeriodeID/:idArisan', async (req, res) => {
    let { idArisan } = req.params;
    try {
        let dataArisan = await knex('lottery_clubs')
            .where('id', '=', idArisan).first();

        if (!dataArisan) {
            return res.status(400).json('ID Periode tidak valid');
        }

        let idPeriodeArisanTerakhir = await knex('lottery_club_periods').select('id')
            .where('lottery_club_id', '=', idArisan).orderBy('id', 'desc').first();

        if (!idPeriodeArisanTerakhir) {
            return res.status(200).json('Belum ada Periode Arisan');
        }

        return res.status(200).json(idPeriodeArisanTerakhir['id']);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET PERIODE (REQ ID)
// router.get('/getPeriode/:id', async (req, res) => {
router.get('/get/period/:id', async (req, res) => {
    let { id } = req.params;
    try {
        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', id).first();

        if (!dataPeriode) {
            return res.status(400).json('ID Periode tidak valid');
        }

        return res.status(200).json(dataPeriode);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET BOOL IS ARISAN PERTEMUAN SUDAH BERJALAN / DIPUBLISH
router.get('/checkPertemuanPeriodeBerjalan/:idPeriode', async (req, res) => {
    let { idPeriode } = req.params;
    try {
        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', idPeriode).first();

        if (!dataPeriode) {
            return res.status(400).json('ID Periode tidak valid');
        }

        let listPertemuan = await knex('lottery_club_period_details')
            .where('lottery_club_period_id', '=', idPeriode).andWhere('status', '=', 'Unpublished');

        if (listPertemuan.length > 0) {
            // Belum Berjalan
            return res.status(200).json("false");
        }

        // Sudah berjalan
        return res.status(200).json("true");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET DATA PERTEMUAN TERAKHIR SESUAI ID 
router.get('/getPeriodDetail/id-pertemuan/:idPertemuan', async (req, res) => {
    let { idPertemuan } = req.params;
    try {

        let dataPeriodeDetails = await knex('lottery_club_period_details')
            .where('id', '=', idPertemuan)
            .first();

        if (!dataPeriodeDetails) {
            return res.status(400).json('Belum ada Periode Arisan');
        }

        dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', dataPeriodeDetails.lottery_club_period_id)
            .first();

        dataPeriodeDetails.lottery_club_period_id = dataPeriode;
        return res.status(200).json(dataPeriodeDetails);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET DATA PERTEMUAN TERAKHIR SESUAI STATUS 
router.get('/getPeriodDetail/status/:status/id-periode/:idPeriode', async (req, res) => {
    let { status, idPeriode } = req.params;
    try {
        console.log(idPeriode);
        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', idPeriode).first();
        console.log(dataPeriode);

        if (!dataPeriode) {
            return res.status(400).json('ID Periode tidak valid');
        }

        if (status != 'Published' && status != 'Unpublished' && status != 'Done') {
            return res.status(400).json('Status tidak valid');
        }

        let dataPeriodeDetails = await knex('lottery_club_period_details')
            .where('lottery_club_period_id', '=', idPeriode)
            .andWhere('status', '=', status)
            .orderBy('id', 'desc')
            .first();

        if (!dataPeriodeDetails) {
            return res.status(400).json('Belum ada Periode Arisan');
        }

        dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', dataPeriodeDetails.lottery_club_period_id)
            .first();

        dataPeriodeDetails.lottery_club_period_id = dataPeriode;
        return res.status(200).json(dataPeriodeDetails);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET DATA TAGIHAN IURAN ARISANKU
router.get('/getDataTagihan/:idPertemuan', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idPertemuan } = req.params;
    try {
        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', idPertemuan).first();

        if (!dataPertemuan) {
            return res.status(400).json('ID Pertemuan tidak valid');
        }

        let dataTagihan = await knex('lottery_club_period_detail_bills')
            .where('lottery_club_period_detail_id', '=', idPertemuan)
            .andWhere('user_id', '=', user.id)
            .first();

        return res.status(200).json(dataTagihan);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET DATA TAGIHAN IURAN ARISAN WILAYAH 
router.get('/getDataTagihanWilayah/:idPertemuan', async (req, res) => {
    let { idPertemuan } = req.params;
    try {
        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', idPertemuan).first();

        if (!dataPertemuan) {
            return res.status(400).json('ID Pertemuan tidak valid');
        }

        let listDataTagihan = await knex('lottery_club_period_detail_bills')
            .where('lottery_club_period_detail_id', '=', idPertemuan);


        let dataTagihanBelumBayarCtr = await knex('lottery_club_period_detail_bills')
            .count('user_id')
            .where('lottery_club_period_detail_id', '=', idPertemuan)
            .andWhere('status', '=', 0).first();

        let dataTagihanBelumBayarTotal = await knex('lottery_club_period_detail_bills')
            .sum('bill_amount')
            .where('lottery_club_period_detail_id', '=', idPertemuan)
            .andWhere('status', '=', 0).first();

        let dataTagihanSudahBayarCtr = await knex('lottery_club_period_detail_bills')
            .count('user_id')
            .where('lottery_club_period_detail_id', '=', idPertemuan)
            .andWhere('status', '=', 1).first();

        let dataTagihanSudahBayarTotal = await knex('lottery_club_period_detail_bills')
            .sum('bill_amount')
            .where('lottery_club_period_detail_id', '=', idPertemuan)
            .andWhere('status', '=', 1).first();

        let dataFinal = {
            "belumBayarCTR": dataTagihanBelumBayarCtr["count(`user_id`)"],
            "belumBayarTotal": dataTagihanBelumBayarTotal["sum(`bill_amount`)"],
            "sudahBayarCTR": dataTagihanSudahBayarCtr["count(`user_id`)"],
            "sudahBayarTotal": dataTagihanSudahBayarTotal["sum(`bill_amount`)"],
            "listTagihan": listDataTagihan,
        };
        console.log(dataFinal);
        return res.status(200).json(dataFinal);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST ABSENSI PERTEMUAN
router.get('/getListAbsensiPertemuan/:idPertemuan', async (req, res) => {
    let { idPertemuan } = req.params;
    try {
        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', idPertemuan).first();

        if (!dataPertemuan) {
            return res.status(400).json('ID Pertemuan tidak valid');
        }

        let listAbsensiPertemuan = await knex('lottery_club_period_detail_absences')
            .where('lottery_club_period_detail_id', '=', idPertemuan);

        for (let idx = 0; idx < listAbsensiPertemuan.length; idx++) {
            let dataAnggota = await knex('users').where('id', '=', listAbsensiPertemuan[idx].user_id).first();
            listAbsensiPertemuan[idx].user_id = dataAnggota;
        }

        return res.status(200).json(listAbsensiPertemuan);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === LOTTERY_CLUB_PERIODS | GET LIST PERIODE ARISAN (REQ AREA_ID) 
// router.get('/getListPeriodeArisan/:idArea', async (req, res) => {
router.get('/get/periods', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let listPeriode;
        if (user.user_role == 7
            || user.user_role == 6
            || user.user_role == 5
            || user.user_role == 4) {
            listPeriode = await knex('lottery_club_periods')
                .where('area_id', '=', user.area_id);
        } else if (user.user_role == 3) {
            listPeriode = await knex.select(
                'period.*'
            ).from({
                period: 'lottery_club_periods',
                pmembers: 'lottery_club_period_members'
            }).whereRaw(`
                period.area_id = '${user.area_id}' AND
                period.id = pmembers.lottery_club_period_id AND
                pmembers.user_id = '${user.id}'
            `);
        }

        return res.status(200).json(listPeriode);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST MEMBER ARISAN (REQ ID PERIODE)
router.get('/getListMemberArisan/:idPeriode', async (req, res) => {
    let { idPeriode } = req.params;
    try {
        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', idPeriode).first();

        if (!dataPeriode) {
            return res.status(400).json('ID Periode tidak valid');
        }

        let listMember = await knex('lottery_club_period_members')
            .where('lottery_club_period_id', '=', idPeriode);


        for (let idx = 0; idx < listMember.length; idx++) {
            let dataAnggota = await knex('users').where('id', '=', listMember[idx].user_id).first();
            listMember[idx].user_id = dataAnggota;
        }

        return res.status(200).json(listMember);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST PERTEMUAN ARISAN (REQ ID PERIODE)
// router.get('/getListPertemuanArisan/:idPeriode', async (req, res) => {
router.get('/get/meets/id-periode/:idPeriode', async (req, res) => {
    let { idPeriode } = req.params;
    try {
        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', idPeriode).first();

        if (!dataPeriode) {
            return res.status(400).json('ID Periode tidak valid');
        }

        let listPertemuan = await knex('lottery_club_period_details')
            .where('lottery_club_period_id', '=', idPeriode);

        for (let idx = 0; idx < listPertemuan.length; idx++) {
            listPertemuan[idx].lottery_club_period_id = dataPeriode;
            if (listPertemuan[idx].winner_1_id != null) {
                let dataUser = await knex('users').where('id', '=', listPertemuan[idx].winner_1_id).first();
                listPertemuan[idx].winner_1_id = dataUser;
            }
            if (listPertemuan[idx].winner_2_id != null) {
                let dataUser = await knex('users').where('id', '=', listPertemuan[idx].winner_2_id).first();
                listPertemuan[idx].winner_2_id = dataUser;
            }

        }

        return res.status(200).json(listPertemuan);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET PERTEMUAN ARISAN (REQ ID)
router.get('/get/meet/id-pertemuan/:idPertemuan', async (req, res) => {
    let { idPertemuan } = req.params;
    try {
        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', idPertemuan).first();

        if (!dataPertemuan) {
            return res.status(400).json('ID Pertemuan tidak valid');
        }

        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', dataPertemuan.lottery_club_period_id).first();

        dataPertemuan.lottery_club_period_id = dataPeriode;

        if (dataPertemuan.winner_1_id != null) {
            let dataUser = await knex('users').where('id', '=', dataPertemuan.winner_1_id).first();
            dataPertemuan.winner_1_id = dataUser;
        }
        if (dataPertemuan.winner_2_id != null) {
            let dataUser = await knex('users').where('id', '=', dataPertemuan.winner_2_id).first();
            dataPertemuan.winner_2_id = dataUser;
        }

        return res.status(200).json(dataPertemuan);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === PAYMENT
router.post('/payment', async (req, res) => {
    let { payment_type, bank, id_bill } = req.body;

    try {
        if (stringUtils.isEmptyString(payment_type) || stringUtils.isEmptyString(bank) || stringUtils.isEmptyString(id_bill)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataBills = await knex('lottery_club_period_detail_bills')
            .where('id', '=', id_bill).first();

        if (!dataBills) {
            return res.status(400).json('ID Periode tidak valid');
        }

        if (payment_type != 'bank_transfer' && (bank != 'bca' || bank != 'bni' || bank != 'bri')) {
            return res.status(400).json('Data tidak valid');
        }

        let data = {
            payment_type: payment_type,
            transaction_details: {
                order_id: 'LC' + moment
                    .tz(moment().toDate(), 'YYYYMMDDHHmmss', 'Asia/Jakarta')
                    .format('YYYYMMDDHHmmss') + dataBills.id,
                gross_amount: dataBills.bill_amount,
            },
            bank_transfer: {
                bank: bank,
            },
        };

        let base64Key =
            'Basic ' +
            Buffer.from(process.env.MIDTRANS_SERVERKEY + ':').toString('base64');

        let response = await axios.post(
            'https://api.sandbox.midtrans.com/v2/charge',
            data,
            {
                headers: {
                    Authorization: base64Key,
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
            }
        );

        await knex('lottery_club_period_detail_bills').update({
            'midtrans_order_id': response.data.order_id,
            'midtrans_transaction_id': response.data.transaction_id,
            'payment_type': response.data.payment_type,
            'acquiring_bank': response.data.va_numbers[0].bank,
            'va_num': response.data.va_numbers[0].va_number,
            'midtrans_transaction_status': response.data.transaction_status,
            'midtrans_created_at': response.data.transaction_time,
            'midtrans_expired_at': response.data.expiry_time,
        }).where('id', '=', id_bill);

        let dataBillsUpdated = await knex('lottery_club_period_detail_bills')
            .where('id', '=', id_bill).first();

        // console.log(response.data);
        return res.status(200).json(dataBillsUpdated);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }


});
// === END

// === BATALKAN PEMBAYARAN
router.patch('/payment/cancel', async (req, res) => {
    let { id_bill } = req.body;

    try {
        if (stringUtils.isEmptyString(id_bill)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataBills = await knex('lottery_club_period_detail_bills')
            .where('id', '=', id_bill).first();

        if (!dataBills) {
            return res.status(400).json('ID Periode tidak valid');
        }

        await knex('lottery_club_period_detail_bills').update({
            'midtrans_order_id': null,
            'midtrans_transaction_id': null,
            'payment_type': null,
            'acquiring_bank': null,
            'va_num': null,
            'midtrans_transaction_status': null,
            'midtrans_created_at': null,
            'midtrans_expired_at': null,
        }).where('id', '=', id_bill);

        let dataBillsUpdated = await knex('lottery_club_period_detail_bills')
            .where('id', '=', id_bill).first();

        return res.status(200).json(dataBillsUpdated);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST PEMBAYARAN ANGGOTA (REQ ID PERTEMUAN)
router.get('/payment/all/:idPertemuan', async (req, res) => {
    let { idPertemuan } = req.params;

    try {
        if (stringUtils.isEmptyString(idPertemuan)) {
            return res.status(400).json('Data tidak valid');
        }

        let listDataBills = await knex('lottery_club_period_detail_bills')
            .where('lottery_club_period_detail_id', '=', idPertemuan);

        for (let idx = 0; idx < listDataBills.length; idx++) {
            let dataUser = await knex('users').where('id', '=', listDataBills[idx].user_id).first();
            listDataBills[idx].data_user = dataUser;

            if (listDataBills[idx].updated_by != null) {
                let dataUserKonfirmasi = await knex('users').where('id', '=', listDataBills[idx].updated_by).first();
                listDataBills[idx].data_user_konfirmasi = dataUserKonfirmasi;
            }
        }

        return res.status(200).json(listDataBills);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET PEMBAYARAN ANGGOTA (REQ ID PAYMENT)
router.get('/payment/idPayment/:idPayment', async (req, res) => {
    let { idPayment } = req.params;

    try {
        if (stringUtils.isEmptyString(idPayment)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataBills = await knex('lottery_club_period_detail_bills')
            .where('id', '=', idPayment).first();

        let dataUser = await knex('users').where('id', '=', dataBills.user_id).first();
        dataBills.data_user = dataUser;

        if (dataBills.updated_by != null) {
            let dataUserKonfirmasi = await knex('users').where('id', '=', dataBills.updated_by).first();
            dataBills.data_user_konfirmasi = dataUserKonfirmasi;
        }


        return res.status(200).json(dataBills);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === PEMBAYARAN OFFLINE
router.patch('/payment/cash', isAuthenticated, async (req, res) => {
    let { id_bill } = req.body;
    let user = req.authenticatedUser;
    try {
        if (stringUtils.isEmptyString(id_bill)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataPembayaran = await knex('lottery_club_period_detail_bills')
            .where('id', '=', id_bill).first();

        if (!dataPembayaran) {
            return res.status(400).json('ID Periode tidak valid');
        }

        await knex('lottery_club_period_detail_bills').update({
            'midtrans_order_id': null,
            'midtrans_transaction_id': null,
            'payment_type': 'Cash',
            'acquiring_bank': null,
            'va_num': null,
            'midtrans_transaction_status': null,
            'midtrans_created_at': null,
            'midtrans_expired_at': null,
            "status": 1,
            "updated_at": moment().toDate(),
            "updated_by": user.id
        }).where('id', '=', id_bill);

        let dataPertemuan = await knex('lottery_club_period_details')
            .where('id', '=', dataPembayaran.lottery_club_period_detail_id)
            .first();

        let dataPeriode = await knex('lottery_club_periods')
            .where('id', '=', dataPertemuan.lottery_club_period_id)
            .first();

        await knex('lottery_club_periods').update({
            "income_amount": dataPeriode.income_amount + dataPembayaran.bill_amount,
            "kas_period_amount": dataPeriode.kas_period_amount + dataPembayaran.bill_amount
        }).where('id', '=', dataPeriode.id);

        return res.status(200).json("Berhasil Pembayaran Cash !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === COBA COBA
router.post('/cobacoba', async (req, res) => {
    let data = {
        payment_type: 'bank_transfer',
        transaction_details: {
            order_id: 'OA00014xxx2',
            gross_amount: 10000,
        },
        bank_transfer: {
            bank: 'bca',
        },
    };
    let base64Key =
        'Basic ' +
        Buffer.from(process.env.MIDTRANS_SERVERKEY + ':').toString('base64');
    let response = await axios.post(
        'https://api.sandbox.midtrans.com/v2/charge',
        data,
        {
            headers: {
                Authorization: base64Key,
                Accept: '*/*',
                'Content-Type': 'application/json',
            },
        }
    );
    console.log('DATA');
    console.log('================================');
    console.log(response.data);
    console.log('================================');
    console.log(response.data.va_numbers[0].va_number);
    console.log('================================');
    console.log(response.data.reference_id);
    console.log('================================');
    console.log(response.data.transaction_id);
    return res.status(200).json('BERHASIL');
});


//https://jsfiddle.net/5amr8cov/6/embedded/result,html/dark
//https://docs.midtrans.com/docs/https-notification-webhooks
module.exports = router;
