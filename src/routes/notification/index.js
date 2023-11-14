// Import
const router = require('express').Router();
const knex = require('../../database');
const { isAuthenticated } = require('../../middleware/auth');
const { sendNotification } = require('../../utils/notification');

router.get('/get/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let notifikasi = await knex('notifications').where('user_id', '=', user.id).orderBy('id','desc');
    let jumlahUnead = notifikasi.filter((n) => n.is_read == 0).length;
    return res.status(200).json({ total_unread: jumlahUnead, notifications: notifikasi });
});

router.patch('/read/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    await knex('notifications').update({ is_read: 1 }).where('user_id', '=', user.id);
    return res.status(200).json("Berhasil read semua notifikasi");
});

router.patch('/read/:id', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { id } = req.params;
    let notifikasi = await knex('notifications')
        .where('user_id', '=', user.id)
        .andWhere('id', '=', id)
        .first();
    if (!notifikasi) {
        return res.status(400).json('Data tidak valid!');
    }
    await knex('notifications').update({ is_read: 1 }).where('id', '=', notifikasi.id);
    return res.status(200).json("Berhasil read notifikasi");
});

module.exports = router;