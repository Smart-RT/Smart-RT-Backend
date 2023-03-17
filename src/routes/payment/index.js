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
        
    }

    return res.status(200).json("OK");
}),



module.exports = router;