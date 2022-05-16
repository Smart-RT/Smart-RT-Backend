const express = require('express');
const router = express.Router();

const routerUser = require('./users');

router.use('/users', routerUser);


router.get('/', (req, res) => {
    return res.status(200).json('OK!');
});

module.exports = router;
