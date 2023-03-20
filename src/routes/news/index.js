// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar, isReligionAvailable, isGenderAvailable, isWeddingStatusAvailable } = require('../../utils/strings');
const e = require('express');
const {
    uploadItemLampiranPengumuman,
} = require('../../middleware/upload');
const path = require('path');
const fs = require('fs-extra');

// === GET LIST PENGUMUMAN
router.get('/get/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataListPengumuman = await knex('news')
            .where('area_id', '=', user.area_id)
            .andWhere('status', '=', 1);

        for (let idx = 0; idx < dataListPengumuman.length; idx++) {
            let dataUser = await knex('users')
                .where('id', '=', user.id)
                .first();
            dataListPengumuman[idx].created_by = dataUser;
        }

        return res.status(200).json(dataListPengumuman);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === ADD PENGUMUMAN
router.post('/add', isAuthenticated,
    uploadItemLampiranPengumuman.fields([
        { name: 'file_img', maxCount: 1 },
    ]), async (req, res) => {

        let user = req.authenticatedUser;
        let {
            title,
            detail,
            is_with_lampiran
        } = req.body;

        try {
            if (stringUtils.isEmptyString(title)
                || stringUtils.isEmptyString(detail)) {
                return res.status(400).json('Data tidak valid');
            }

            if (is_with_lampiran == 'true') {
                let newID = await knex('news').insert({
                    "file_img": req.files.file_img[0].filename,
                    "title": title,
                    "detail":detail,
                    "area_id": user.area_id,
                    "created_at": moment().toDate(),
                    "created_by": user.id,
                });
                let filePath = path.join(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'public',
                    'uploads',
                    'pengumuman',
                    'file_lampiran',
                    `${newID[0]}`
                );
                if (!fs.existsSync(filePath)) {
                    fs.mkdirSync(filePath, { recursive: true });
                }

                fs.moveSync(
                    req.files.file_img[0].path,
                    path.join(filePath, req.files.file_img[0].filename)
                );
            }else{
                await knex('news').insert({
                    "title": title,
                    "detail":detail,
                    "area_id": user.area_id,
                    "created_at": moment().toDate(),
                    "created_by": user.id,
                });
            }

            return res.status(200).json("Berhasil membuat dan menampilkan pengumuman !");
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR');
        }
    });
// === END

// === HAPUS PENGUMUMAN
router.patch('/delete/id-news/:idNews', isAuthenticated, async (req, res) => {
        let user = req.authenticatedUser;
        let {idNews} = req.params;
        try {
            if (stringUtils.isEmptyString(idNews)) {
                return res.status(400).json('Data tidak valid');
            }

            let dataPengumuman = await knex('news')
                .where('id','=',idNews)
                .first();

            if (!dataPengumuman) {
                return res.status(400).json('Data tidak valid');
            }

            await knex('news').update({"status":-1}).where('id','=',idNews);

            return res.status(200).json("Berhasil menghapus pengumuman !");
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR');
        }
    });
// === END

module.exports = router;