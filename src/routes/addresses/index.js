// Import
const router = require('express').Router();
const knex = require('../../database');

// === GET SUB DISTRICTS
router.get('/subDistricts', async (req, res) => {
    try {
        let subDistricts = await knex('sub_districts').orderBy('name');
        return res.status(200).json(subDistricts);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET URBAN VILLAGE
router.get('/urbanVillages', async (req, res) => {
    try {
        let urbanVillages = await knex({ u: 'urban_villages' })
            .select('u.*', {
                id_kecamatan: 'sd.id',
                nama_kecamatan: 'sd.name',
                wilayah: 'sd.wilayah',
            })
            .join({ sd: 'sub_districts' }, 'sd.id', 'u.kecamatan_id');

        urbanVillages = urbanVillages.map((x) => {
            return {
                id: x.id,
                name: x.name,
                kecamatan: {
                    id: x.id_kecamatan,
                    nama_kecamatan: x.nama_kecamatan,
                    wilayah: x.wilayah,
                },
            };
        });

        return res.status(200).json(urbanVillages);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

module.exports = router;
