// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');
const cron = require('node-cron');

/**
 * https://www.npmjs.com/package/node-cron
 */

// cron.schedule('*/2 * * * *', () => {
//   console.log('running a task every two minutes');

// });



module.exports = router;