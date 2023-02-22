// Import Router
const router = require('express').Router();

// Import router lainnya
const routerUser = require('./users');
const routerAddress = require('./addresses');
const routerLotteryClubs = require('./lottery_clubs');
const routerHealth = require('./health');

router.use('/users', routerUser);
router.use('/addresses', routerAddress);
router.use('/lotteryClubs', routerLotteryClubs);
router.use('/health', routerHealth);
router.get('/', (req, res) => {
    return res.status(200).json('OK!');
});

module.exports = router;
