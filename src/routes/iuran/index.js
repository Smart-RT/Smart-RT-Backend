// Import
const router = require('express').Router();
const knex = require('../../database');
const { isAuthenticated } = require('../../middleware/auth');
const moment = require('moment-timezone');
const { default: axios } = require('axios');
const { stringUtils, tokenUtils } = require('../../utils');

// Import Firebase Admin, supaya bisa pake firestore dan messaging
let firebaseAdmin = require('firebase-admin');

// inisialisasi Firestore
const firestore = firebaseAdmin.firestore();

// inisialisasi Firebase Cloud messaging
const cloudMessaging = firebaseAdmin.messaging();

// === ADD
router.post('/add', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { name, billAmount, isRepeated } = req.body;
    try {
        let listUserID = await knex('users').select('id').where('area_id', '=', user.area_id);

        let areaBill = await knex('area_bills').insert({
            'name': name,
            'bill_amount': billAmount,
            'is_repeated': isRepeated,
            'status': 1,
            'payer_total': listUserID.length,
            'area_id': user.area_id,
            'created_at': moment().toDate(),
            'created_by': user.id,
        });
        let areaBillRepeatDetail;

        if (isRepeated == 1) {
            let temp = await knex('area_bill_repeat_details').insert({
                'month_year': moment().toDate(),
                'area_bill_id': areaBill[0],
                'bill_amount': billAmount,
                'payer_total': listUserID.length,
            });
            areaBillRepeatDetail = temp[0];
        }

        for (let i = 0; i < listUserID.length; i++) {
            await knex('area_bill_transactions').insert({
                'area_bill_id': areaBill[0],
                'area_bill_repeat_detail_id': areaBillRepeatDetail,
                'user_id': listUserID[i].id,
                'bill_amount': billAmount,
                'status': 0,
                'created_at': moment().toDate()
            });

        }

        return res.status(200).json('Berhasil membuat Iuran!');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST IURAN BY AREA
router.get('/get/all/by-area/:areaID', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { areaID } = req.params;
    try {
        let listAreaBill = await knex('area_bills').where('area_id', '=', areaID).orderBy('created_at', 'desc');
        for (let idx = 0; idx < listAreaBill.length; idx++) {
            if (listAreaBill[idx].created_by != null) {
                let dataCreatedBy = await knex('users').where('id', '=', listAreaBill[idx].created_by).first();
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
                listAreaBill[idx].created_by = dataCreatedBy;
            }

            if (listAreaBill[idx].ended_by != null) {
                let dataEndedBy = await knex('users').where('id', '=', listAreaBill[idx].ended_by).first();
                delete dataEndedBy.created_by;
                delete dataEndedBy.created_at;
                delete dataEndedBy.refresh_token;
                delete dataEndedBy.total_serving_as_neighbourhood_head;
                delete dataEndedBy.sign_img;
                delete dataEndedBy.password;
                delete dataEndedBy.nik;
                delete dataEndedBy.kk_num;
                delete dataEndedBy.born_at;
                delete dataEndedBy.born_date;
                delete dataEndedBy.religion;
                delete dataEndedBy.status_perkawinan;
                delete dataEndedBy.profession;
                delete dataEndedBy.nationality;
                delete dataEndedBy.is_lottery_club_member;
                listAreaBill[idx].ended_by = dataEndedBy;
            }

        }
        return res.status(200).json(listAreaBill);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST IURAN TRANSACTION BY ID AREA BILL
router.post('/transaction/get/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { areaBillID, areaBillRepeatDetailID } = req.body;
    try {
        let listAreaBillTransaction;

        if (stringUtils.isEmptyString(areaBillRepeatDetailID)) {
            listAreaBillTransaction = await knex('area_bill_transactions').where('area_bill_id', '=', areaBillID);

        } else {
            listAreaBillTransaction = await knex('area_bill_transactions').where('area_bill_id', '=', areaBillID).andWhere('area_bill_repeat_detail_id', '=', areaBillRepeatDetailID);
        }

        for (let idx = 0; idx < listAreaBillTransaction.length; idx++) {
            if (listAreaBillTransaction[idx].user_id != null) {
                let dataUser = await knex('users').where('id', '=', listAreaBillTransaction[idx].user_id).first();
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
                listAreaBillTransaction[idx].dataUser = dataUser;

                if (listAreaBillTransaction[idx].updated_by != null) {
                    dataUser = await knex('users').where('id', '=', listAreaBillTransaction[idx].updated_by).first();
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
                    listAreaBillTransaction[idx].updated_by = dataUser;

                }
            }

        }

        return res.status(200).json(listAreaBillTransaction);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST IURAN REPEAT DETAIL BY ID AREA BILL
router.get('/repeat-detail/get/all/by-id/:areaBillID', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { areaBillID } = req.params;
    try {
        let listAreaBillRepeatDetail = await knex('area_bill_repeat_details').where('area_bill_id', '=', areaBillID);

        return res.status(200).json(listAreaBillRepeatDetail);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === BAYAR CASH
router.patch('/transaction/payment/cash', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { areaBillID, areaBillTransactionID, areaBillRepeatDetailID } = req.body;
    try {
        await knex('area_bill_transactions').update({
            'payment_type': 'cash',
            'status': 1,
            'updated_at': moment().toDate(),
            'updated_by': user.id
        }).where('id', '=', areaBillTransactionID);

        if (!stringUtils.isEmptyString(areaBillRepeatDetailID)) {
            let dataAreaBillRepeatDetail = await knex('area_bill_repeat_details').where('id', '=', areaBillRepeatDetailID).first();
            await knex('area_bill_repeat_details').update({
                'payer_count': dataAreaBillRepeatDetail.payer_count + 1,
                'total_paid_amount': dataAreaBillRepeatDetail.total_paid_amount + dataAreaBillRepeatDetail.bill_amount
            }).where('id', '=', areaBillRepeatDetailID);

            const d = new Date();
            if (dataAreaBillRepeatDetail.month_year.substring(0, 7) == d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) {
                dataAreaBillRepeatDetail = await knex('area_bill_repeat_details').where('id', '=', areaBillRepeatDetailID).first();
                await knex('area_bills').update({
                    'payer_count': dataAreaBillRepeatDetail.payer_count,
                    'total_paid_amount': dataAreaBillRepeatDetail.total_paid_amount
                }).where('id', '=', areaBillID);
            }

        } else {
            let dataAreaBill = await knex('area_bills').where('id', '=', areaBillID).first();
            await knex('area_bills').update({
                'payer_count': dataAreaBill.payer_count + 1,
                'total_paid_amount': dataAreaBill.total_paid_amount + dataAreaBill.bill_amount
            }).where('id', '=', areaBillID);
        }

        return res.status(200).json('Berhasil !');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === BAYAR TF
router.patch('/transaction/payment/transfer-bank', async (req, res) => {
    let { payment_type, bank, id_bill } = req.body;

    try {
        if (stringUtils.isEmptyString(payment_type) || stringUtils.isEmptyString(bank) || stringUtils.isEmptyString(id_bill)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataBills = await knex('area_bill_transactions')
            .where('id', '=', id_bill).first();

        if (!dataBills) {
            return res.status(400).json('ID transaksi tidak valid');
        }

        if (payment_type != 'bank_transfer' && (bank != 'bca' || bank != 'bni' || bank != 'bri')) {
            return res.status(400).json('Data tidak valid');
        }

        let data = {
            payment_type: payment_type,
            transaction_details: {
                order_id: 'IU' + moment
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

        await knex('area_bill_transactions').update({
            'midtrans_order_id': response.data.order_id,
            'midtrans_transaction_id': response.data.transaction_id,
            'payment_type': response.data.payment_type,
            'acquiring_bank': response.data.va_numbers[0].bank,
            'va_num': response.data.va_numbers[0].va_number,
            'midtrans_transaction_status': response.data.transaction_status,
            'midtrans_created_at': response.data.transaction_time,
            'midtrans_expired_at': response.data.expiry_time,
        }).where('id', '=', id_bill);


        return res.status(200).json('Berhasil!');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }


});
// === END

// === BATALKAN PEMBAYARAN
router.patch('/transaction/payment/cancel', async (req, res) => {
    let { id_bill } = req.body;

    try {
        if (stringUtils.isEmptyString(id_bill)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataBills = await knex('area_bill_transactions')
            .where('id', '=', id_bill).first();

        if (!dataBills) {
            return res.status(400).json('ID Periode tidak valid');
        }

        await knex('area_bill_transactions').update({
            'midtrans_order_id': null,
            'midtrans_transaction_id': null,
            'payment_type': null,
            'acquiring_bank': null,
            'va_num': null,
            'midtrans_transaction_status': null,
            'midtrans_created_at': null,
            'midtrans_expired_at': null,
        }).where('id', '=', id_bill);

        return res.status(200).json('Berhasil!');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === NONAKTIFKAN IURAN
router.patch('/update/nonaktifkan/:billId', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { billId } = req.params;

    // ambil bill
    let areaBill = await knex('area_bills').where('id', '=', billId)
        .andWhere('status', '=', 1)
        .andWhere('is_repeated', '=', 1)
        .first();
    if (!areaBill)
        return res.status(400).json("Data tidak valid!");

    // check area user dan bill sama atau tidak
    if (areaBill.area_id != user.area_id)
        return res.status(400).json("Data tidak valid!");

    // update status jadi 0
    await knex('area_bills').update({ status: 0 }).where('id', '=', billId);
    return res.status(200).json('Berhasil nonaktifkan iuran');

});
// === END

router.get("/kirimnotif", async (req, res) => {
    // ambil list user yang mau dikirimin notifikasi
    let users = (await firestore
        .collection('FCMTokens')
        .where('userId', '==', 28)
        .get()).docs;

    // console.log("users", users);

    // setelah itu, ambil semua token yang ditemukan
    let tokens = users.map(u => u.data().FCMToken);
    // console.log("tokens", tokens);

    // Buat payload / data dari notifikasi
    let notificationPayload = {
        title: "test notifikasi dari NodeJS1111",
        body: "Ini test body dari NodeJS",
    }

    // Setelah itu, kirim notifikasi ke hapenya
    await cloudMessaging.sendToDevice(tokens, { data: notificationPayload });

    return res.status(200).json("OK");
});


module.exports = router;
