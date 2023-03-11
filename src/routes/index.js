// Import Router
const router = require('express').Router();

// Import router lainnya
const routerUser = require('./users');
const routerAddress = require('./addresses');
const routerLotteryClubs = require('./lottery_clubs');
const routerHealth = require('./health');
const routerPayment = require('./payment');
const routerCronJob = require('./cron_job');
const routerAdministration = require('./administration');

router.use('/users', routerUser);
router.use('/addresses', routerAddress);
router.use('/lotteryClubs', routerLotteryClubs);
router.use('/health', routerHealth);
router.use('/payment', routerPayment);
router.use('/cron', routerCronJob);
router.use('/administration', routerAdministration);
router.get('/', (req, res) => {
    return res.status(200).json('OK!');
});

module.exports = router;
