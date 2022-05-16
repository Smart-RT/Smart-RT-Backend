const express = require('express');
const router = express.Router();
const database = require('../../database');

router.get('/', async(req, res) => {
    let users = await database('users');
    return res.status(200).json(users);
});

router.get('/:id', async(req, res) => {
    let user = await database('users').where('id','=', req.params.id).first();
    return res.status(200).json(user);
});

module.exports = router;
