// Import
const router = require('express').Router();
const knex = require('../../database');
const { isAuthenticated } = require('../../middleware/auth');
const moment = require('moment-timezone');
const {
    uploadItemFileCarouselHome
} = require('../../middleware/upload');
const path = require('path');
const fs = require('fs-extra');

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

// === UPDATE CAROUSEL
router.post('/carousel/home/update', isAuthenticated,
uploadItemFileCarouselHome.fields([
        { name: 'Karosel1', maxCount: 1 },
        { name: 'Karosel2', maxCount: 1 },
        { name: 'Karosel3', maxCount: 1 },
    ]),
    async (req, res) => {
        let uid = req.authenticatedUser.id;

        try {
            // Cek user ID terdaftar di db
            let user = await knex('users').where('id', '=', uid).first();
            if (!user) {
                return res.status(400).json('ID User tidak valid');
            }

            // Update Karosel 1
            await knex('app_settings').update({
                detail: req.files.Karosel1[0].filename,
            }).where('about', '=', 'carousel_home_1');

            // Update Karosel 2
            await knex('app_settings').update({
                detail: req.files.Karosel2[0].filename,
            }).where('about', '=', 'carousel_home_2');

            // Update Karosel 3
            await knex('app_settings').update({
                detail: req.files.Karosel3[0].filename,
            }).where('about', '=', 'carousel_home_3');

            let filePath = path.join(
                __dirname,
                '..',
                '..',
                '..',
                'public',
                'uploads',
                'carousel-home'
            );
            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(filePath, { recursive: true });
            }
            console.log(req.files);
            fs.moveSync(
                req.files.Karosel1[0].path,
                path.join(filePath, `Karosel1.${req.files.Karosel1[0].mimetype.split('/')[1]}`),
                {overwrite: true}
            );
            fs.moveSync(
                req.files.Karosel2[0].path,
                path.join(filePath, `Karosel2.${req.files.Karosel1[0].mimetype.split('/')[1]}`),
                {overwrite: true}
            );
            fs.moveSync(
                req.files.Karosel3[0].path,
                path.join(filePath, `Karosel3.${req.files.Karosel1[0].mimetype.split('/')[1]}`),
                {overwrite: true}
            );

            return res.status(200).json("Berhasil Menyimpan Carousel");
        
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR!');
        }
    }
);
// === END


module.exports = router;
