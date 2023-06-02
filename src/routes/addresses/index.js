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

// === GET TOTAL POPULATION
router.get('/get/total-population', async (req, res) => {
    try {
        let subDistricts = await knex('sub_districts');

        let data = {
            "utara": 0,
            "timur": 0,
            "barat": 0,
            "selatan": 0,
            "pusat": 0,
        };
        for (let i = 0; i < subDistricts.length; i++) {
            if (subDistricts[i].wilayah == 0) {
                data.pusat = data.pusat + subDistricts[i].total_population
            }else if (subDistricts[i].wilayah == 1) {
                data.timur = data.timur + subDistricts[i].total_population
            }else if (subDistricts[i].wilayah == 2) {
                data.barat = data.barat + subDistricts[i].total_population
            }else if (subDistricts[i].wilayah == 3) {
                data.utara = data.utara + subDistricts[i].total_population
            }else if (subDistricts[i].wilayah == 4) {
                data.selatan = data.selatan + subDistricts[i].total_population
            }
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

module.exports = router;
