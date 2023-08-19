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
const routerNews = require('./news');
const routerMeet = require('./meet');
const routerEvent = require('./event');
const routerCommitte = require('./committe');
const routerNeighbourhoodHead = require('./neighbourhood_head');
const routerVote = require('./vote');
const routerSetting = require('./setting');
const routerSubscribePro = require('./subscribe_pro');
const routerIuran = require('./iuran');

router.use('/users', routerUser);
router.use('/addresses', routerAddress);
router.use('/lotteryClubs', routerLotteryClubs);
router.use('/health', routerHealth);
router.use('/payment', routerPayment);
router.use('/cron', routerCronJob);
router.use('/administration', routerAdministration);
router.use('/news', routerNews);
router.use('/meet', routerMeet);
router.use('/event', routerEvent);
router.use('/committe', routerCommitte);
router.use('/neighbourhood-head', routerNeighbourhoodHead);
router.use('/vote', routerVote);
router.use('/setting', routerSetting);
router.use('/subscribe-pro', routerSubscribePro);
router.use('/iuran', routerIuran);
router.get('/', (req, res) => {
    return res.status(200).json('OK!');
});

module.exports = router;
