// Import
const router = require('express').Router();
const knex = require('../../database');

// GET SUB DISTRICTS
router.get('/subDistricts', async (req, res) => {
    try {
        let subDistricts = await knex('sub_districts');
        return res.status(200).json(subDistricts);
        
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
})
// -- END GET SUB DISTRICTS

module.exports = router;