// Import Router
const router = require('express').Router();

// Import router lainnya
const routerUser = require('./users');

router.use('/users', routerUser);
router.get('/', (req, res) => {
    return res.status(200).json('OK!');
});

module.exports = router;
