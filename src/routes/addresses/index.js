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
            } else if (subDistricts[i].wilayah == 1) {
                data.timur = data.timur + subDistricts[i].total_population
            } else if (subDistricts[i].wilayah == 2) {
                data.barat = data.barat + subDistricts[i].total_population
            } else if (subDistricts[i].wilayah == 3) {
                data.utara = data.utara + subDistricts[i].total_population
            } else if (subDistricts[i].wilayah == 4) {
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

// === GET AREA ALL
router.get('/get/area/all', async (req, res) => {
    try {
        let listArea = await knex('areas')
            .orderBy('sub_district_id')
            .orderBy('urban_village_id')
            .orderBy('rw_num')
            .orderBy('rt_num');

        for (let idx = 0; idx < listArea.length; idx++) {
            let dataKetua = await knex('users').where('id', '=', listArea[idx].ketua_id).first();
            listArea[idx].ketua_id = dataKetua;

            if (listArea[idx].wakil_ketua_id != null) {
                let dataWakilKetua = await knex('users').where('id', '=', listArea[idx].wakil_ketua_id).first();
                listArea[idx].wakil_ketua_id = dataWakilKetua;
            }
            if (listArea[idx].sekretaris_id != null) {
                let dataSekretaris = await knex('users').where('id', '=', listArea[idx].sekretaris_id).first();
                listArea[idx].sekretaris_id = dataSekretaris;
            }
            if (listArea[idx].bendahara_id != null) {
                let dataBendahara = await knex('users').where('id', '=', listArea[idx].bendahara_id).first();
                listArea[idx].bendahara_id = dataBendahara;
            }

            let dataSubDistrict = await knex('sub_districts').where('id', '=', listArea[idx].sub_district_id).first();
            listArea[idx].data_kecamatan = dataSubDistrict;
            let dataUrbanVillage = await knex('urban_villages').where('id', '=', listArea[idx].urban_village_id).first();
            listArea[idx].data_kelurahan = dataUrbanVillage;

            delete listArea[idx].lottery_club_id;
        }


        return res.status(200).json(listArea);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET AREA SUBSCRIBE
router.get('/get/area/subscribe', async (req, res) => {
    try {
        let listArea = await knex('areas')
            .where('is_subscribe_pro', '=', 1)
            .orderBy('sub_district_id')
            .orderBy('urban_village_id')
            .orderBy('rw_num')
            .orderBy('rt_num');

        for (let idx = 0; idx < listArea.length; idx++) {
            let dataSubscribe = await knex('pro_subscribes').where('area_id', '=', listArea[idx].id).first();
            let dataCreatedBy = await knex('users').where('id', '=', dataSubscribe.created_by).first();
            delete dataCreatedBy.created_by;
            delete dataCreatedBy.created_at;
            delete dataCreatedBy.refresh_token;
            delete dataCreatedBy.total_serving_as_neighbourhood_head;
            delete dataCreatedBy.sign_img;
            delete dataCreatedBy.password;
            delete dataCreatedBy.nik;
            delete dataCreatedBy.kk_num;
            delete dataCreatedBy.born_at;
            delete dataCreatedBy.born_date;
            delete dataCreatedBy.religion;
            delete dataCreatedBy.status_perkawinan;
            delete dataCreatedBy.profession;
            delete dataCreatedBy.nationality;
            delete dataCreatedBy.is_lottery_club_member;

            dataSubscribe.created_by = dataCreatedBy;
            listArea[idx].dataSubscribe = dataSubscribe;

            let dataKetua = await knex('users').where('id', '=', listArea[idx].ketua_id).first();
            listArea[idx].ketua_id = dataKetua;

            if (listArea[idx].wakil_ketua_id != null) {
                let dataWakilKetua = await knex('users').where('id', '=', listArea[idx].wakil_ketua_id).first();
                listArea[idx].wakil_ketua_id = dataWakilKetua;
            }
            if (listArea[idx].sekretaris_id != null) {
                let dataSekretaris = await knex('users').where('id', '=', listArea[idx].sekretaris_id).first();
                listArea[idx].sekretaris_id = dataSekretaris;
            }
            if (listArea[idx].bendahara_id != null) {
                let dataBendahara = await knex('users').where('id', '=', listArea[idx].bendahara_id).first();
                listArea[idx].bendahara_id = dataBendahara;
            }

            let dataSubDistrict = await knex('sub_districts').where('id', '=', listArea[idx].sub_district_id).first();
            listArea[idx].data_kecamatan = dataSubDistrict;
            let dataUrbanVillage = await knex('urban_villages').where('id', '=', listArea[idx].urban_village_id).first();
            listArea[idx].data_kelurahan = dataUrbanVillage;

            delete listArea[idx].lottery_club_id;
        }


        return res.status(200).json(listArea);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

module.exports = router;
