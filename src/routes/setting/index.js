// Import
const router = require('express').Router();
const knex = require('../../database');
const { isAuthenticated } = require('../../middleware/auth');
const moment = require('moment-timezone');

// === GET SUBSCRIBE AMOUNT
router.get('/get/subscribe-amount', async (req, res) => {
    try {
        let data = await knex('app_settings').where('about', '=', 'subscribe_amount').first();
        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATE SUBSCRIBE AMOUNT
router.patch('/update/subscribe-amount', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        subscribe_amount
    } = req.body;
    try {
        if (user.user_role != 1) {
            return res.status(400).json('Anda tidak memiliki akses');
        }

        let data = await knex('app_settings').where('about', '=', 'subscribe_amount').first();

        await knex('app_settings').update({
            'detail': subscribe_amount,
        }).where('about', '=', 'subscribe_amount');

        await knex('app_setting_logs').insert({
            'detail_before': data.details,
            'detail_after': subscribe_amount,
            'updated_at': moment().toDate(),
            'updated_by': user.id
        });

        return res.status(200).json('Berhasil merubah biaya langganan!');
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END


module.exports = router;
