// Import Router
const router = require('express').Router();

// Import router lainnya
const routerUser = require('./users');
const routerAddress = require('./addresses');

router.use('/users', routerUser);
router.use('/addresses', routerAddress);
router.get('/', (req, res) => {
    return res.status(200).json('OK!');
});

module.exports = router;
