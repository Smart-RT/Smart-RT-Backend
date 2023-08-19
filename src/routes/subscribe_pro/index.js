// Import
const router = require('express').Router();
const knex = require('../../database');
const { isAuthenticated } = require('../../middleware/auth');
const moment = require('moment-timezone');
const { default: axios } = require('axios');

// === DAFTAR BERLANGGANAN
router.post('/add', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let proSubscribeID = await knex('pro_subscribes').insert({
            'area_id': user.area_id,
            'created_at': moment().toDate(),
            'created_by': user.id,
            'status': 0
        });

        let dataSubscribeAmount = await knex('app_settings').where('about', '=', 'subscribe_amount').first();

        await knex('pro_subscribe_bills').insert({
            'pro_subscribe_id': proSubscribeID[0],
            'area_id': user.area_id,
            'bill_amount': dataSubscribeAmount.detail,
            'status': 0,
            'created_at': moment().toDate(),
        });

        await knex('areas').update({
            'is_subscribe_pro': 1
        }).where('id','=',user.area_id);


        return res.status(200).json('Berhasil mendaftar!');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET SUBSCRIBE PRO BY AREA
router.get('/get/by/area/:idArea', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idArea } = req.params; 
    try {
        let dataProSubscribe = await knex('pro_subscribes')
            .where('area_id', '=', idArea).first();

        let dataCreatedBy = await knex('users').where('id','=',dataProSubscribe.created_by).first();
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

        dataProSubscribe.created_by = dataCreatedBy;
        
        return res.status(200).json(dataProSubscribe);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST SUBSCRIBE PRO BILLS BY AREA
router.get('/bill/get-list/by/area/:idArea', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idArea } = req.params; 
    try {
        let dataListProSubscribe = await knex('pro_subscribe_bills')
            .where('area_id', '=', idArea);

        for (let idx = 0; idx < dataListProSubscribe.length; idx++) {
            if (dataListProSubscribe[idx].payer_id != null) {
                let dataUserPayer = await knex('users').where('id','=', dataListProSubscribe[idx].payer_id).first();
                delete dataUserPayer.created_by;
                delete dataUserPayer.created_at;
                delete dataUserPayer.refresh_token;
                delete dataUserPayer.total_serving_as_neighbourhood_head;
                delete dataUserPayer.sign_img;
                delete dataUserPayer.password;
                delete dataUserPayer.nik;
                delete dataUserPayer.kk_num;
                delete dataUserPayer.born_at;
                delete dataUserPayer.born_date;
                delete dataUserPayer.religion;
                delete dataUserPayer.status_perkawinan;
                delete dataUserPayer.profession;
                delete dataUserPayer.nationality;
                delete dataUserPayer.is_lottery_club_member;
                dataListProSubscribe[idx].payer_id = dataUserPayer;
            }
            if (dataListProSubscribe[idx].updated_by != null) {
                let dataUpdatedBy = await knex('users').where('id','=', dataListProSubscribe[idx].updated_by).first();
                delete dataUpdatedBy.created_by;
                delete dataUpdatedBy.created_at;
                delete dataUpdatedBy.refresh_token;
                delete dataUpdatedBy.total_serving_as_neighbourhood_head;
                delete dataUpdatedBy.sign_img;
                delete dataUpdatedBy.password;
                delete dataUpdatedBy.nik;
                delete dataUpdatedBy.kk_num;
                delete dataUpdatedBy.born_at;
                delete dataUpdatedBy.born_date;
                delete dataUpdatedBy.religion;
                delete dataUpdatedBy.status_perkawinan;
                delete dataUpdatedBy.profession;
                delete dataUpdatedBy.nationality;
                delete dataUpdatedBy.is_lottery_club_member;
                dataListProSubscribe[idx].updated_by = dataUpdatedBy;
            }
            
        }
        return res.status(200).json(dataListProSubscribe);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST SUBSCRIBE PRO BILLS BY PRO SUB ID
router.get('/bill/get-list/by/pro-subscribe/:idProSubscribe', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idProSubscribe } = req.params; 
    try {
        let dataListProSubscribe = await knex('pro_subscribe_bills')
            .where('pro_subscribe_id', '=', idProSubscribe);

        for (let idx = 0; idx < dataListProSubscribe.length; idx++) {
            if (dataListProSubscribe[idx].payer_id != null) {
                let dataUserPayer = await knex('users').where('id','=', dataListProSubscribe[idx].payer_id).first();
                delete dataUserPayer.created_by;
                delete dataUserPayer.created_at;
                delete dataUserPayer.refresh_token;
                delete dataUserPayer.total_serving_as_neighbourhood_head;
                delete dataUserPayer.sign_img;
                delete dataUserPayer.password;
                delete dataUserPayer.nik;
                delete dataUserPayer.kk_num;
                delete dataUserPayer.born_at;
                delete dataUserPayer.born_date;
                delete dataUserPayer.religion;
                delete dataUserPayer.status_perkawinan;
                delete dataUserPayer.profession;
                delete dataUserPayer.nationality;
                delete dataUserPayer.is_lottery_club_member;
                dataListProSubscribe[idx].payer_id = dataUserPayer;
            }
            if (dataListProSubscribe[idx].updated_by != null) {
                let dataUpdatedBy = await knex('users').where('id','=', dataListProSubscribe[idx].updated_by).first();
                delete dataUpdatedBy.created_by;
                delete dataUpdatedBy.created_at;
                delete dataUpdatedBy.refresh_token;
                delete dataUpdatedBy.total_serving_as_neighbourhood_head;
                delete dataUpdatedBy.sign_img;
                delete dataUpdatedBy.password;
                delete dataUpdatedBy.nik;
                delete dataUpdatedBy.kk_num;
                delete dataUpdatedBy.born_at;
                delete dataUpdatedBy.born_date;
                delete dataUpdatedBy.religion;
                delete dataUpdatedBy.status_perkawinan;
                delete dataUpdatedBy.profession;
                delete dataUpdatedBy.nationality;
                delete dataUpdatedBy.is_lottery_club_member;
                dataListProSubscribe[idx].updated_by = dataUpdatedBy;
            }
            
        }
        return res.status(200).json(dataListProSubscribe);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET SUBSCRIBE PRO BILLS BY ID
router.get('/bill/get/:id', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { id } = req.params; 
    try {
        let dataProSubscribe = await knex('pro_subscribe_bills')
            .where('id', '=', id).first();

        if (dataProSubscribe) {
            if (dataProSubscribe.payer_id != null) {
                let dataUserPayer = await knex('users').where('id','=', dataProSubscribe.payer_id).first();
                delete dataUserPayer.created_by;
                delete dataUserPayer.created_at;
                delete dataUserPayer.refresh_token;
                delete dataUserPayer.total_serving_as_neighbourhood_head;
                delete dataUserPayer.sign_img;
                delete dataUserPayer.password;
                delete dataUserPayer.nik;
                delete dataUserPayer.kk_num;
                delete dataUserPayer.born_at;
                delete dataUserPayer.born_date;
                delete dataUserPayer.religion;
                delete dataUserPayer.status_perkawinan;
                delete dataUserPayer.profession;
                delete dataUserPayer.nationality;
                delete dataUserPayer.is_lottery_club_member;
                dataProSubscribe.payer_id = dataUserPayer;
            }
            if (dataProSubscribe.updated_by != null) {
                let dataUpdatedBy = await knex('users').where('id','=', dataProSubscribe.updated_by).first();
                delete dataUpdatedBy.created_by;
                delete dataUpdatedBy.created_at;
                delete dataUpdatedBy.refresh_token;
                delete dataUpdatedBy.total_serving_as_neighbourhood_head;
                delete dataUpdatedBy.sign_img;
                delete dataUpdatedBy.password;
                delete dataUpdatedBy.nik;
                delete dataUpdatedBy.kk_num;
                delete dataUpdatedBy.born_at;
                delete dataUpdatedBy.born_date;
                delete dataUpdatedBy.religion;
                delete dataUpdatedBy.status_perkawinan;
                delete dataUpdatedBy.profession;
                delete dataUpdatedBy.nationality;
                delete dataUpdatedBy.is_lottery_club_member;
                dataProSubscribe.updated_by = dataUpdatedBy;
            }
        }

        
        return res.status(200).json(dataProSubscribe);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === PICK METHOD PAYMENT
router.patch('/payment/pick-method', async (req, res) => {
    let { paymentType, bank, idProSubscribeBill } = req.body;

    try {
        let dataProSubscribeBill = await knex('pro_subscribe_bills')
            .where('id', '=', idProSubscribeBill).first();

        let data = {
            payment_type: paymentType,
            transaction_details: {
                order_id: 'PS' + moment
                    .tz(moment().toDate(), 'YYYYMMDDHHmmss', 'Asia/Jakarta')
                    .format('YYYYMMDDHHmmss') + dataProSubscribeBill.id,
                gross_amount: dataProSubscribeBill.bill_amount,
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

        await knex('pro_subscribe_bills').update({
            'midtrans_order_id': response.data.order_id,
            'midtrans_transaction_id': response.data.transaction_id,
            'payment_type': response.data.payment_type,
            'acquiring_bank': response.data.va_numbers[0].bank,
            'va_num': response.data.va_numbers[0].va_number,
            'midtrans_transaction_status': response.data.transaction_status,
            'midtrans_created_at': response.data.transaction_time,
            'midtrans_expired_at': response.data.expiry_time,
        }).where('id', '=', idProSubscribeBill);

        let dataBaru = await knex('pro_subscribe_bills')
            .where('id', '=', idProSubscribeBill).first();

            if (dataBaru.payer_id != null) {
                let dataUserPayer = await knex('users').where('id','=', dataBaru.payer_id).first();
                delete dataUserPayer.created_by;
                delete dataUserPayer.created_at;
                delete dataUserPayer.refresh_token;
                delete dataUserPayer.total_serving_as_neighbourhood_head;
                delete dataUserPayer.sign_img;
                delete dataUserPayer.password;
                delete dataUserPayer.nik;
                delete dataUserPayer.kk_num;
                delete dataUserPayer.born_at;
                delete dataUserPayer.born_date;
                delete dataUserPayer.religion;
                delete dataUserPayer.status_perkawinan;
                delete dataUserPayer.profession;
                delete dataUserPayer.nationality;
                delete dataUserPayer.is_lottery_club_member;
                dataBaru.payer_id = dataUserPayer;
            }
            if (dataBaru.updated_by != null) {
                let dataUpdatedBy = await knex('users').where('id','=', dataBaru.updated_by).first();
                delete dataUpdatedBy.created_by;
                delete dataUpdatedBy.created_at;
                delete dataUpdatedBy.refresh_token;
                delete dataUpdatedBy.total_serving_as_neighbourhood_head;
                delete dataUpdatedBy.sign_img;
                delete dataUpdatedBy.password;
                delete dataUpdatedBy.nik;
                delete dataUpdatedBy.kk_num;
                delete dataUpdatedBy.born_at;
                delete dataUpdatedBy.born_date;
                delete dataUpdatedBy.religion;
                delete dataUpdatedBy.status_perkawinan;
                delete dataUpdatedBy.profession;
                delete dataUpdatedBy.nationality;
                delete dataUpdatedBy.is_lottery_club_member;
                dataBaru.updated_by = dataUpdatedBy;
            }
        return res.status(200).json(dataBaru);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }


});
// === END

// === BATALKAN PEMBAYARAN
router.patch('/payment/cancel', async (req, res) => {
    let { idProSubscribeBill } = req.body;

    try {
        let dataBills = await knex('pro_subscribe_bills')
            .where('id', '=', idProSubscribeBill).first();

        if (!dataBills) {
            return res.status(400).json('ID Periode tidak valid');
        }

        await knex('pro_subscribe_bills').update({
            'midtrans_order_id': null,
            'midtrans_transaction_id': null,
            'payment_type': null,
            'acquiring_bank': null,
            'va_num': null,
            'midtrans_transaction_status': null,
            'midtrans_created_at': null,
            'midtrans_expired_at': null,
        }).where('id', '=', idProSubscribeBill);

        let dataBaru = await knex('pro_subscribe_bills')
            .where('id', '=', idProSubscribeBill).first();

            if (dataBaru.payer_id != null) {
                let dataUserPayer = await knex('users').where('id','=', dataBaru.payer_id).first();
                delete dataUserPayer.created_by;
                delete dataUserPayer.created_at;
                delete dataUserPayer.refresh_token;
                delete dataUserPayer.total_serving_as_neighbourhood_head;
                delete dataUserPayer.sign_img;
                delete dataUserPayer.password;
                delete dataUserPayer.nik;
                delete dataUserPayer.kk_num;
                delete dataUserPayer.born_at;
                delete dataUserPayer.born_date;
                delete dataUserPayer.religion;
                delete dataUserPayer.status_perkawinan;
                delete dataUserPayer.profession;
                delete dataUserPayer.nationality;
                delete dataUserPayer.is_lottery_club_member;
                dataBaru.payer_id = dataUserPayer;
            }
            if (dataBaru.updated_by != null) {
                let dataUpdatedBy = await knex('users').where('id','=', dataBaru.updated_by).first();
                delete dataUpdatedBy.created_by;
                delete dataUpdatedBy.created_at;
                delete dataUpdatedBy.refresh_token;
                delete dataUpdatedBy.total_serving_as_neighbourhood_head;
                delete dataUpdatedBy.sign_img;
                delete dataUpdatedBy.password;
                delete dataUpdatedBy.nik;
                delete dataUpdatedBy.kk_num;
                delete dataUpdatedBy.born_at;
                delete dataUpdatedBy.born_date;
                delete dataUpdatedBy.religion;
                delete dataUpdatedBy.status_perkawinan;
                delete dataUpdatedBy.profession;
                delete dataUpdatedBy.nationality;
                delete dataUpdatedBy.is_lottery_club_member;
                dataBaru.updated_by = dataUpdatedBy;
            }
        return res.status(200).json(dataBaru);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END




module.exports = router;
