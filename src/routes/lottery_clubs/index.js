// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');

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

// === MEMBUKA ARISAN WILAYAH
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

        // Mengupdate Area
        await knex('areas')
            .update({ lottery_club_id: newLotteryClubID })
            .where('id', '=', dataArea.id);

        // Mengambil dan mengembalikan data terbaru yang baru saja di insert
        let newLotteryClubData = await knex('lottery_clubs')
            .where('id', '=', newLotteryClubID)
            .first();

        return res.status(200).json(newLotteryClubData);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === MEMBUAT PERIODE ARISAN (HEADER)
/** Catatan :
 * # Ada 2 tipe pembuatan yaitu BUAT BARU dan MULAI DITENGAH
 * # Tipe MULAI DITENGAH hanya bisa dibuat ketika last_period (tabel : lottery_clubs) = 0
 * 
 * 
 * # Tabel : lottery_club_periods
 *   entity...
 *      -> period, didapatkan dari last_period (tabel : lottery_clubs) + 1
 *      -> income_amount, insert pasti 0
 */

/** Langkah :
 * 0. Mengecek total orang di wilayah tersebut (harus > 6)
 * 1. Mengecek role privilage
 * 2. Mengecek area tersebut tidak memiliki periode yang masih aktif
 * 3. Mengecek tipe pembuatan yang dipilih valid
 * 4. Mengecek data yang dikirimkan valid sesuai dengan tipe pembuatan... (lanjutan sesuai tipe)
 * 
 * #  BUAT BARU
 *  4.  Data yang wajib ada yaitu (dengan syaratnya) 
 *      -> area_id, ID terdaftar
 *      -> lottery_club_id, ID terdaftar dan areanya sama
 *      -> period, last_period (tabel : lottery_club) + 1
 *      -> bill_amount, min 10K max 1Jt
 *      -> winner_bill_amount, bill_amount x total_pertemuan
 *      -> year_limit, 0.5 ~ 4 tahun sesuai dengan jumlah total members (hanya kelipatan 12 yang dapat memilih range waktunya)
 *      -> total_members, minimal 6 dan maksimal 48
 *      -> started_at, harus h+7 dari hari saat ini
 *      -> created_at, datetime saat ini
 *      -> created_by, pembuat arisan (ketua RT dari wilayah tersebut)
 *      
 *      -> ID Member wajib merupakan warga area arisan tersebut dan statusnya tidak di blacklist
 * 
 * # MULAI DI TENGAH
 *  4.  Data yang wajib ada yaitu (dengan syaratnya) 
 *      -> area_id, ID terdaftar
 *      -> lottery_club_id, ID terdaftar dan areanya sama
 *      -> period, harus 1 (harus pertama kali membuat arisan)
 *      -> bill_amount, harus lebih besar dari 1000
 *      -> winner_bill_amount, tidak boleh lebih besar dari bill_amount x total_members
 *      -> year_limit, 0.5 ~ 4 tahun sesuai dengan jumlah total members (hanya kelipatan 12 yang dapat memilih range waktunya)
 *      -> total_members, minimal 6 dan maksimal 48
 *      -> started_at, 
 *      -> created_at, datetime saat ini
 *      -> created_by, pembuat arisan (ketua RT dari wilayah tersebut)
 */
router.post('/newPeriod', isAuthenticated, async (req, res) => {
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
            members,
            started_at,
        } = req.body;

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
            parseInt(bill_amount) < 5000 ||
            parseInt(winner_bill_amount) < 5000 ||
            parseInt(winner_bill_amount) >
                parseInt(bill_amount) * members.length ||
            parseInt(year_limit) < 1 ||
            members.length < 1
        ) {
            return res.status(400).json('Data tidak valid');
        }

        let dataLotteryClub = await knex('lottery_clubs')
            .where('id', '=', dataArea.lottery_club_id)
            .first();

        // Insert Header Lottery Club
        let newLotteryClubPeriodID = await knex('lottery_club_periods').insert({
            area_id: user.area_id,
            lottery_club_id: dataArea.lottery_club_id,
            period: dataLotteryClub.last_period + 1,
            bill_amount: parseInt(bill_amount),
            winner_bill_amount: parseInt(winner_bill_amount),
            year_limit: parseInt(year_limit),
            total_members: members.length,
            started_at: moment
                .tz(started_at, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            ended_at: moment(started_at, 'YYYY-MM-DD')
                .add(year_limit, 'years')
                .toDate(),
            created_at: moment().toDate(),
            created_by: user.id,
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
                lottery_club_period_id: newLotteryClubPeriodID,
                debt_amount: 0,
                already_be_a_winner: 0,
                status: 1,
                created_at: moment().toDate(),
                created_by: user.id,
            });
        }

        // Insert Detail Period pertemuan pertama dgn stats unpublished (Nanti dapat di update)
        await knex('lottery_club_period_details').insert({
            lottery_club_period_id: newLotteryClubPeriodID,
            lottery_club_id: dataArea.lottery_club_id,
            status: 'Unpublished',
            is_offline_meet: 0,
            meet_date: moment
                .tz(started_at, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta')
                .format('YYYY-MM-DD HH:mm'),
            created_at: moment().toDate(),
            created_by: user.id,
        });

        // Mengambil dan mengembalikan data terbaru yang baru saja di insert
        let newLotteryClubPeriodData = await knex('lottery_club_periods')
            .where('id', '=', newLotteryClubPeriodID)
            .first();

        return res.status(200).json(newLotteryClubPeriodData);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATE DETAIL PERIOD ARISAN (detail pertemuan)
router.patch('/detailPeriod', isAuthenticated, async (req, res) => {
    // // Mengambil data user yang melakukan request
    // let user = req.authenticatedUser;

    try {
        // Mengambil data detail period yang terakhir dan masih belum di publish
        let dataArea = await knex('areas')
            .where('id', '=', user.area_id)
            .first();

        //     // Mengecek privillage apakah user requester merupakan ketua RT
        //     if (dataArea.ketua_id != user.id) {
        //         return res.status(400).json('Anda tidak memiliki privilage');
        //     }

        //     // Mengecek area belum pernah membuat arisan
        //     if (dataArea.lottery_club_id != null) {
        //         return res
        //             .status(400)
        //             .json('Area sudah pernah membuka fitur arisan');
        //     }

        //     // Insert Header Lottery Club
        //     let newLotteryClubID = await knex('lottery_clubs').insert({
        //         area_id: user.area_id,
        //         last_period: 0,
        //         kas_amount: 0,
        //         created_at: moment().toDate(),
        //         created_by: user.id,
        //     });

        //     // Mengupdate Area
        //     await knex('areas')
        //         .update({ lottery_club_id: newLotteryClubID })
        //         .where('id', '=', dataArea.id);

        //     // Mengambil dan mengembalikan data terbaru yang baru saja di insert
        //     let newLotteryClubData = await knex('lottery_clubs')
        //         .where('id', '=', newLotteryClubID)
        //         .first();

        //     return res.status(200).json(newLotteryClubData);
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
            order_id: 'arisan-jose-2',
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
    console.log(response);
    return res.status(200).json('BERHASIL');
});

module.exports = router;
