// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');

router.post('/notification', async (req,res)=>{
    // console.log(req.body);

    let data = req.body;
    console.log('=== MASOK === /payment/notification')
    
    if (data.order_id.substring(0,2) == 'LC' &&  data.transaction_status == 'settlement') {
        console.log('=== MASOK === /payment/notification -> ADA SETTLEMENT')

        await knex('lottery_club_period_detail_bills')
            .update({
                "midtrans_transaction_status": data.transaction_status,
                "updated_at": data.transaction_time,
                "status":1,
            })
            .where('midtrans_transaction_id', '=', data.transaction_id);

        let dataLotteryClubPeriodDetailBill =  await knex('lottery_club_period_detail_bills')
                                                    .where('midtrans_transaction_id', '=', data.transaction_id)
                                                    .first();
        let dataPertemuan = await knex('lottery_club_period_details')
                                .where('id', '=', dataLotteryClubPeriodDetailBill.lottery_club_period_detail_id)
                                .first();

        
        let dataUserMember = await knex('lottery_club_period_members')
                                .where('user_id', '=', dataLotteryClubPeriodDetailBill.user_id)
                                .andWhere('lottery_club_period_id', '=', dataPertemuan.lottery_club_period_id)
                                .first();
        await knex('lottery_club_period_members').update({
            debt_amount: dataUserMember.debt_amount - dataLotteryClubPeriodDetailBill.bill_amount
        }).where('id','=',dataUserMember.id);
        
    }else if (data.order_id.substring(0,2) == 'PS' &&  data.transaction_status == 'settlement') {
        console.log('=== MASOK === /payment/notification -> ADA SETTLEMENT')

        await knex('pro_subscribe_bills')
            .update({
                "midtrans_transaction_status": data.transaction_status,
                "updated_at": data.transaction_time,
                "status":1,
            })
            .where('midtrans_transaction_id', '=', data.transaction_id);

        let dataSubscribeBill = await knex('pro_subscribe_bills').where('midtrans_transaction_id', '=', data.transaction_id).first();
        await knex('pro_subscribes')
            .update({
                "latest_payment_at": moment().toDate(),
                "status": 1,
            })
        .where('id', '=', dataSubscribeBill.pro_subscribe_id);

        
    }else if (data.order_id.substring(0,2) == 'IU' &&  data.transaction_status == 'settlement') {
        console.log('=== MASOK === /payment/notification -> ADA SETTLEMENT')

        await knex('area_bill_transactions')
            .update({
                "midtrans_transaction_status": data.transaction_status,
                "updated_at": data.transaction_time,
                "status":1,
            })
            .where('midtrans_transaction_id', '=', data.transaction_id);

        let dataAreaBillTransaction = await knex('area_bill_transactions').where('midtrans_transaction_id', '=', data.transaction_id).first();
        let dataAreaBill = await knex('area_bills').where('id', '=', dataAreaBillTransaction.area_bill_id).first();
        
        if (dataAreaBill.is_repeated == 0) {
            await knex('area_bills')
            .update({
                "payer_count": dataAreaBill.payer_count +1,
                "total_paid_amount": dataAreaBill.total_paid_amount + dataAreaBill.bill_amount,
            })
        .where('id', '=', dataAreaBillTransaction.area_bill_id);
        }else{
            let dataAreaBillRepeatDetail = await knex('area_bill_repeat_details').where('id', '=', dataAreaBillTransaction.area_bill_repeat_detail_id).first();
            await knex('area_bill_repeat_details').update({
                'payer_count': dataAreaBillRepeatDetail.payer_count + 1,
                'total_paid_amount': dataAreaBillRepeatDetail.total_paid_amount + dataAreaBillRepeatDetail.bill_amount
            }).where('id', '=', dataAreaBillRepeatDetail.id);

            const d = new Date();
           if (dataAreaBillRepeatDetail.month_year.substring(0,7) == d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) {
                dataAreaBillRepeatDetail = await knex('area_bill_repeat_details').where('id', '=', dataAreaBillRepeatDetail.id).first();
                    await knex('area_bills').update({
                        'payer_count': dataAreaBillRepeatDetail.payer_count,
                        'total_paid_amount': dataAreaBillRepeatDetail.total_paid_amount
                    }).where('id', '=', dataAreaBillTransaction.area_bill_id);
            }
        }
       

        
    }

    return res.status(200).json("OK");
}),



module.exports = router;