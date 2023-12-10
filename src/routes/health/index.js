// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar } = require('../../utils/strings');
const { sendNotification } = require('../../utils/notification');

// === GET DISEASE GROUP
router.get('/diseaseGroup', async (req, res) => {
    try {
        let listDiseaseGroup = await knex('disease_groups');
        return res.status(200).json(listDiseaseGroup);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === CREATE REPORT
router.post('/userReporting', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { reported_id_for, area_reported_id, disease_group_id, disease_level, disease_notes } = req.body;
    try {
        if (stringUtils.isEmptyString(reported_id_for)
            || stringUtils.isEmptyString(area_reported_id)
            || stringUtils.isEmptyString(disease_group_id)
            || stringUtils.isEmptyString(disease_level)
            || stringUtils.isEmptyString(disease_notes)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users')
            .where('id', '=', user.id)
            .first();

        let dataArea = await knex('areas')
            .where('id', '=', dataUser.area_id)
            .first();

        let statusHealth = -1;
        let confirmation_status = -1;

        if (reported_id_for == user.id || user.id == dataArea.ketua_id) {
            statusHealth = 0;
            confirmation_status = 1;
            await knex('user_health_reports')
                .update({ "confirmation_status": 0 })
                .where('reported_id_for', '=', reported_id_for)
                .andWhere('confirmation_status', '=', -1);
        }

        await knex('user_health_reports').insert({
            "reported_id_for": reported_id_for,
            "area_reported_id": area_reported_id,
            "disease_group_id": disease_group_id,
            "disease_level": disease_level,
            "disease_notes": disease_notes,
            "created_by": user.id,
            "created_at": moment().toDate(),
            "confirmation_status": confirmation_status
        });

        if (confirmation_status == -1) {
            let userReported = await knex('users').select('full_name').where('id', '=', reported_id_for).first()
            await sendNotification(dataArea.ketua_id, 'kesehatan', 'Laporan Kesehatan Baru', `Terdapat laporan kesehatan baru yang dilaporkan oleh ${user.full_name} terhadap ${userReported.full_name}`);
        }

        await knex('users').update({
            "is_health": statusHealth
        }).where('id', '=', reported_id_for);

        return res.status(200).json("Berhasil Melaporkan !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST RIWAYAT SAKIT
router.get('/userReported', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let listRiwayatSakit = await knex('user_health_reports')
            .where('reported_id_for', '=', user.id)
            .andWhere('confirmation_status', '=', 1);

        for (let idx = 0; idx < listRiwayatSakit.length; idx++) {
            let dataDiseaseGroup = await knex('disease_groups')
                .where('id', '=', listRiwayatSakit[idx].disease_group_id)
                .first();
            listRiwayatSakit[idx].disease_group_id = dataDiseaseGroup;
        }
        return res.status(200).json(listRiwayatSakit);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST RIWAYAT SAKIT
router.get('/userReported/id/:idReported', async (req, res) => {
    let { idReported } = req.params;
    try {
        let dataReport = await knex('user_health_reports')
            .where('id', '=', idReported).first();

        let dataDiseaseGroup = await knex('disease_groups')
            .where('id', '=', dataReport.disease_group_id)
            .first();
        dataReport.disease_group_id = dataDiseaseGroup;
        let dataUser = await knex('users')
            .where('id', '=', dataReport.reported_id_for)
            .first();
        dataReport.reported_data_user = dataUser;
        dataUser = await knex('users')
            .where('id', '=', dataReport.created_by)
            .first();
        dataReport.created_by_data_user = dataUser;
        dataUser = await knex('users')
            .where('id', '=', dataReport.confirmation_by)
            .first();
        dataReport.confirmation_by_data_user = dataUser;

        return res.status(200).json(dataReport);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST RIWAYAT SAKIT (ALL)
router.get('/userReported/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataUser = await knex('users')
            .where('id', '=', user.id)
            .first();

        let listRiwayatSakit = await knex('user_health_reports')
            .where('confirmation_status', '=', 1)
            .andWhere('area_reported_id', '=', dataUser.area_id);

        for (let idx = 0; idx < listRiwayatSakit.length; idx++) {
            let dataDiseaseGroup = await knex('disease_groups')
                .where('id', '=', listRiwayatSakit[idx].disease_group_id)
                .first();
            listRiwayatSakit[idx].disease_group_id = dataDiseaseGroup;
            let dataUser = await knex('users')
                .where('id', '=', listRiwayatSakit[idx].reported_id_for)
                .first();
            listRiwayatSakit[idx].reported_data_user = dataUser;
            dataUser = await knex('users')
                .where('id', '=', listRiwayatSakit[idx].created_by)
                .first();
            listRiwayatSakit[idx].created_by_data_user = dataUser;
            dataUser = await knex('users')
                .where('id', '=', listRiwayatSakit[idx].confirmation_by)
                .first();
            listRiwayatSakit[idx].confirmation_by_data_user = dataUser;
        }
        return res.status(200).json(listRiwayatSakit);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST LAPORAN SAKIT BUTUH KONFIRMASI (COUNT)
router.get('/userReported/needConfirmation/count', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataUser = await knex('users')
            .where('id', '=', user.id)
            .first();

        let listRiwayatSakit = await knex('user_health_reports')
            .where('confirmation_status', '=', -1)
            .andWhere('area_reported_id', '=', dataUser.area_id)
            .count('id').first();

        return res.status(200).json(listRiwayatSakit["count(`id`)"]);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST LAPORAN SAKIT DARI WARGA BERDASARKAN STATUS
router.get('/userReported/all/status', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataUser = await knex('users').where('id', '=', user.id).first();
        let laporanSakit = await knex('user_health_reports')
            .where('area_reported_id', '=', dataUser.area_id)
            .andWhere('reported_id_for', '!=', knex.ref('created_by'));
        // ambil detail data untuk setiap laporan sakit
        laporanSakit = await Promise.all(laporanSakit.map(async (ls) => {
            let diseaseGroup = await knex('disease_groups')
                .where('id', '=', ls.disease_group_id).first();
            let dataUserSakit = await knex('users')
                .where('id', '=', ls.reported_id_for).first();
            let laporanCreatedBy = await knex('users')
                .where('id', '=', ls.created_by).first();
            let laporanConfirmedBy = await knex('users')
                .where('id', '=', ls.confirmation_by).first();
            return {
                ...ls, disease_group_id: diseaseGroup, reported_data_user: dataUserSakit,
                created_by_data_user: laporanCreatedBy, confirmation_by_data_user: laporanConfirmedBy
            };
        }));

        return res.status(200).json(laporanSakit);

    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATED USER_HEALT_REPORTS (KONFIRMASI)
router.patch('/userReported/confirmationAction/:status', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { status } = req.params;
    let { idReport } = req.body;
    try {
        if (status != "terima" && status != "tolak") {
            return res.status(400).json('Data tidak valid');
        }

        let dataUserHealthReport = await knex('user_health_reports')
            .where('id', '=', idReport).first();

        if (!dataUserHealthReport) {
            return res.status(400).json('Data tidak valid');
        }

        let dataStatus = 1;
        let msg = "Berhasil Menolak Laporan!";
        if (status == 'tolak') {
            dataStatus = 0;
            await knex('users').update({
                'is_health': 1,
            }).where('id', '=', dataUserHealthReport.reported_id_for);
        } else {
            msg = "Berhasil Menerima Laporan!";
            await knex('users').update({
                'is_health': 0,
            }).where('id', '=', dataUserHealthReport.reported_id_for);
        }

        await knex('user_health_reports')
            .update({
                "confirmation_status": dataStatus,
                "confirmation_by": user.id,
                "confirmation_at": moment().toDate()
            }).where('id', '=', idReport);

        return res.status(200).json(msg);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATED USER_HEALT_REPORTS (SAYA SUDAH SEHAT)
router.patch('/userReported/sayaSehat', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataUser = await knex('users').where('id', '=', user.id).first();
        if (dataUser.is_health != 0) {
            return res.status(400).json('Anda sudah Sehat!');
        }

        let dataUserHealthReport = await knex('user_health_reports')
            .where('reported_id_for', '=', user.id)
            .andWhere('confirmation_status', '=', 1)
            .whereNull('healed_at').first();

        await knex('user_health_reports')
            .update({
                healed_at: moment().toDate()
            }).where('id', '=', dataUserHealthReport.id);

        await knex('users').update({ "is_health": 1 }).where('id', '=', user.id);
        await knex('health_task_helps').update({
            "status": -2,
            "confirmation_by": dataUser.id,
            "confirmation_at": moment().toDate()
        }).where(function () {
            this.where('status', '=', 0)
                .orWhere('status', '=', 1)
        }).andWhere('user_health_report_id', '=', dataUserHealthReport.id);

        return res.status(200).json("Sekarang anda sehat! Jagalah kesehatan anda!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATED health_task_helps (BERI RATING)
router.patch('/userReported/rating', isAuthenticated, async (req, res) => {
    let { idTaskHelp, rating, review } = req.body;
    try {
        if (stringUtils.isEmptyString(idTaskHelp)
            || stringUtils.isEmptyString(rating)
            || stringUtils.isEmptyString(review)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUserHealthReport = await knex('health_task_helps')
            .where('id', '=', idTaskHelp)
            .first();

        if (!dataUserHealthReport) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('health_task_helps').update({
            "rating": rating,
            "review": review
        }).where('id', '=', idTaskHelp);

        return res.status(200).json("Berhasil Memberi Penilaian !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === CREATE HEALTH_TASK_HELPS
router.post('/healthTaskHelp', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { urgent_level, notes, help_type } = req.body;
    try {
        if (stringUtils.isEmptyString(urgent_level)
            || stringUtils.isEmptyString(notes)
            || stringUtils.isEmptyString(help_type)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users').where('id', '=', user.id).first();
        let dataPenyakit = await knex('user_health_reports')
            .where('reported_id_for', '=', dataUser.id)
            .andWhere('confirmation_status', '=', 1)
            .whereNull('healed_at')
            .first();

        if (dataPenyakit == null || !dataPenyakit) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('health_task_helps').insert({
            "area_id": dataUser.area_id,
            "user_health_report_id": dataPenyakit.id,
            "urgent_level": urgent_level,
            "notes": notes,
            "help_type": help_type,
            "status": 0,
            "created_at": moment().toDate(),
            "created_by": dataUser.id
        });

        let dataArea = await knex('areas').where('id', '=', dataUser.area_id).first();
        await sendNotification(dataArea.ketua_id, 'kesehatan', 'Request Bantuan Baru', `Terdapat request bantuan baru yang direquest oleh ${dataUser.full_name}`);

        return res.status(200).json("Berhasil Meminta Bantuan!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET LIST HEALTH_TASK_HELPS berdasarkan STATUS 
router.get('/healthTaskHelp/list/is-all/:isAll', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { isAll } = req.params;
    if (isAll != 'yes' && isAll != 'no') {
        return res.status(400).json('Data tidak valid!');
    }

    let dataUser = await knex('users').where('id', '=', user.id).first();
    let listHealthTaskHelp = [];
    if (isAll == 'yes') {
        listHealthTaskHelp = await knex('health_task_helps')
            .where('area_id', '=', dataUser.area_id);
    }
    else {
        listHealthTaskHelp = await knex('health_task_helps').
            where('created_by', '=', dataUser.id);
    }

    // ambil detail dari setiap help
    listHealthTaskHelp = await Promise.all(listHealthTaskHelp.map(async (hth) => {
        let dataPenyakit = await knex('user_health_reports').where('id', '=', hth.user_health_report_id).first();
        let dataDiseaseGroup = await knex('disease_groups').where('id', '=', dataPenyakit.disease_group_id).first();
        dataPenyakit.disease_group_id = dataDiseaseGroup;
        return { ...hth, user_health_report_id: dataPenyakit };
    }));
    return res.status(200).json(listHealthTaskHelp);
});

// === GET HEALTH_TASK_HELPS (REQ ID)
router.get('/healthTaskHelp/:id', async (req, res) => {
    let { id } = req.params;
    try {
        if (stringUtils.isEmptyString(id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataHealthTaskHelp = await knex('health_task_helps')
            .where('id', '=', id)
            .first();

        if (dataHealthTaskHelp == null || !dataHealthTaskHelp) {
            return res.status(400).json('Data tidak valid');
        }

        let dataPenyakit = await knex('user_health_reports').where('id', '=', dataHealthTaskHelp.user_health_report_id).first();
        let dataDiseaseGroup = await knex('disease_groups').where('id', '=', dataPenyakit.disease_group_id).first();
        dataPenyakit.disease_group_id = dataDiseaseGroup;
        dataHealthTaskHelp.user_health_report_id = dataPenyakit;

        return res.status(200).json(dataHealthTaskHelp);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === UPDATE MINTA BANTUAN
router.patch('/healthTaskHelp', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { status, idBantuan } = req.body;
    try {
        if (stringUtils.isEmptyString(status)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataUser = await knex('users').where('id', '=', user.id).first();
        let dataBantuan = await knex('health_task_helps').where('id', '=', idBantuan).first();
        if (!dataBantuan) return res.status(400).json('Data tidak valid!');

        if (status == -2 || status == 1) {
            await knex('health_task_helps').update({
                "status": status,
                "confirmation_by": dataUser.id,
                "confirmation_at": moment().toDate(),
            }).where('id', '=', idBantuan);

            if (status == 1) {
                await sendNotification(dataBantuan.created_by, 'kesehatan', 'Request Bantuan Diterima', `Request bantuan anda diterima oleh ${dataUser.full_name}`);
            }

            return res.status(200).json("Berhasil Membatalkan");
        } else if (status == -1) {
            let { alasanPenolakan } = req.body;
            if (stringUtils.isEmptyString(alasanPenolakan)) {
                return res.status(400).json('Data tidak valid');
            }

            await knex('health_task_helps').update({
                "status": status,
                "rejected_reason": alasanPenolakan,
                "confirmation_by": dataUser.id,
                "confirmation_at": moment().toDate(),
            }).where('id', '=', idBantuan);
            await sendNotification(dataBantuan.created_by, 'kesehatan', 'Request Bantuan Ditolak', `Request bantuan anda ditolak oleh ${dataUser.full_name}`);
            return res.status(200).json("Berhasil Menolak!");
        } else if (status == 2) {
            await knex('health_task_helps').update({
                "status": status,
                "solved_by": dataUser.id,
                "solved_at": moment().toDate(),
            }).where('id', '=', idBantuan);
            await sendNotification(dataBantuan.created_by, 'kesehatan', 'Request Bantuan Selesai', `Request bantuan anda diselesaikan oleh ${dataUser.full_name}`);
            return res.status(200).json("Berhasil Menyelesaikan!");
        }

        return res.status(200).json("Berhasil!");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR!');
    }
});
// === END

// === GET DATA PATIENT GROUPING BY DISEASE GROUP (REQ ID AREA)
router.get('/getDataPatientGroupingByDiseaseGroup/area/:idArea/monthYear/:monthYear', async (req, res) => {
    let { idArea, monthYear } = req.params;
    try {
        let dateNow = moment().format('YYYY-MM');
        let dataTotalAnggota = await knex.select({
            disease_group: "dg.name",
            total_patient: (sub) => {
                sub.count("uh.disease_group_id")
                    .from({ uh: 'user_health_reports' })
                    .where('uh.disease_group_id', '=', knex.ref('dg.id'))
                    .whereRaw(`
                        (
                            DATE_FORMAT(uh.created_at,"%Y-%m") = '${monthYear}' 
                            OR DATE_FORMAT(uh.healed_at, "%Y-%m") = '${monthYear}'
                            OR (
                                uh.healed_at IS NULL 
                                AND '${dateNow}' = '${monthYear}'

                            )
                        )`)
                    .andWhere('uh.area_reported_id', '=', idArea)
                    .andWhere('uh.confirmation_status', '=', 1);
            }
        }).from({ dg: 'disease_groups' }).orderBy('dg.id');
        return res.status(200).json(dataTotalAnggota);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === END

// === GET DATA LAPORAN ADMIN
router.get('/healthreport/:monthYear', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { monthYear } = req.params;
    // if not admin
    if (user.user_role != 1) return res.status(400).json('Anda tidak memiliki privilage');
    if (!moment(monthYear, 'MM-YYYY').isValid()) return res.status(400).json('Format tanggal tidak sesuai');

    let data = knex.select(
        { id: 'uhr.id' },
        'uhr.area_reported_id',
        { disease_id: 'dg.id' },
        { disease_name: 'dg.name' },
        'uhr.disease_notes',
        'uhr.confirmation_status',
        { area_id: 'a.id' },
        { sub_district_name: 'sd.name' },
        'sd.wilayah',
        'uhr.created_at'
    )
        .from({ uhr: 'user_health_reports' })
        .join({ dg: 'disease_groups' }, 'dg.id', 'uhr.disease_group_id')
        .join({ a: 'areas' }, 'a.id', 'uhr.area_reported_id')
        .join({ sd: 'sub_districts' }, 'sd.id', 'a.sub_district_id')
        .where('uhr.confirmation_status', '=', 1)
        .whereRaw(`DATE_FORMAT(uhr.created_at, '%m-%Y') = '${monthYear}'`);
    data = await data;

    let wilayahSurabaya = ['Surabaya Pusat', 'Surabaya Timur', 'Surabaya Barat', 'Surabaya Utara', 'Surabaya Selatan'];
    data = data.map((d) => {
        return { ...d, wilayah: wilayahSurabaya[d.wilayah] }
    });

    let penyakits = await knex('disease_groups');
    let dataPenyakit = penyakits.map(p => {
        return {
            nama: p.name,
            jumlah: data.filter(f => f.disease_id == p.id).length
        }
    });

    let dataWilayah = wilayahSurabaya.map((w) => {
        return {
            nama: w,
            jumlah: data.filter(f => f.wilayah == w).length
        };
    });

    let dataPenyakitPerWilayah = wilayahSurabaya.map((w) => {
        let dataSakit = penyakits.map((p) => {
            return {
                nama: p.name,
                jumlah: data.filter((f) => f.disease_id == p.id && f.wilayah == w).length
            };
        });
        return { wilayah: w, dataJumlahPenyakit: dataSakit };
    });

    let dataLaporan = {
        dataJumlahWilayah: dataWilayah,
        dataJumlahPenyakit: dataPenyakit,
        dataPenyakitPerWilayah,
    }

    return res.status(200).json(dataLaporan);
});
// === END

module.exports = router;