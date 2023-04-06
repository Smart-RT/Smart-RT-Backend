// Import
const router = require('express').Router();
const knex = require('../../database');
const moment = require('moment-timezone');
const { isAuthenticated } = require('../../middleware/auth');
const { stringUtils, tokenUtils } = require('../../utils');
const { read } = require('fs-extra');
const { default: axios } = require('axios');
const { randomVarchar, isReligionAvailable, isGenderAvailable, isWeddingStatusAvailable } = require('../../utils/strings');
const e = require('express');
const {
    uploadItemLampiranJanjiTemu,
} = require('../../middleware/upload');
const path = require('path');
const fs = require('fs-extra');
const { takeCoverage } = require('v8');


// === ADD EVENT
router.post('/add', isAuthenticated, async (req, res) => {
        let user = req.authenticatedUser;
        let {
            title,
            detail,
            datetime_start,
            datetime_end
        } = req.body;

        try {
            if (stringUtils.isEmptyString(title)
                || stringUtils.isEmptyString(detail)
                || stringUtils.isEmptyString(datetime_start)
                || stringUtils.isEmptyString(datetime_end)) {
                return res.status(400).json('Data tidak valid');
            }
            await knex('events').insert({
                "title": title,
                "detail": detail,
                "area_id": user.area_id,
                "event_date_start_at": datetime_start,
                "event_date_end_at": datetime_end,
                "created_at": moment().toDate(),
                "created_by": user.id,
                "status": 0
            });

            return res.status(200).json("Berhasil membuat acara !");
        } catch (error) {
            console.error(error);
            return res.status(500).json('ERROR');
        }
    });
// === 

// === ADD EVENT TASK
router.post('/task/add', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        title,
        detail,
        event_id,
        total_worker_needed,
        is_general
    } = req.body;

    try {
        if (stringUtils.isEmptyString(title)
            || stringUtils.isEmptyString(detail)
            || stringUtils.isEmptyString(event_id)
            || stringUtils.isEmptyString(is_general)
            || stringUtils.isEmptyString(total_worker_needed)) {
            return res.status(400).json('Data tidak valid');
        }

        await knex('event_tasks').insert({
            "title": title,
            "detail": detail,
            "event_id": event_id,
            "total_worker_needed": total_worker_needed,
            "total_worker_now": 0,
            "is_general": is_general,
            "created_at": moment().toDate(),
            "created_by": user.id,
            "status": 1
        });

        return res.status(200).json("Berhasil membuat tugas !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ADD EVENT TASK DETAIL (AMBIL TUGAS)
router.post('/task/detail/take-task', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        task_id,
    } = req.body;

    try {
        if (stringUtils.isEmptyString(task_id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataTask = await knex('event_tasks').where('id','=', task_id).first();
        let status = 1;
        if(dataTask.is_general == 0){
            status = 0;
        }
        if(user.user_role == 7 || user.user_role == 6 || user.user_role == 5 ){
            status = 1;
        }

        await knex('event_task_details').insert({
            "user_id": user.id,
            "task_id": task_id,
            "created_at": moment().toDate(),
            "created_by": user.id,
            "status": status
        });

        if (status == 1) {
            await knex('event_tasks').update({
                "total_worker_now": dataTask.total_worker_now + 1,
            }).where('id','=', task_id); 
            return res.status(200).json("Berhasil ambil tugas !");
        }
        
        return res.status(200).json("Berhasil req ambil tugas !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ADD EVENT TASK DETAIL (KONFIRMASI)
router.patch('/task/detail/confirmation', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        task_detail_id,
        status
    } = req.body;

    try {
        await knex('event_task_details').update({
            "status":status
        }).where('id','=', task_detail_id);

        let dataTaskDetail = await knex('event_task_details').where('id','=', task_detail_id).first();
        let dataTask = await knex('event_tasks').where('id','=',dataTaskDetail.task_id).first();
        
        if (status == 1) {
            await knex('event_tasks').update({
                "total_worker_now": dataTask.total_worker_now + 1,
            }).where('id','=', dataTaskDetail.task_id); 
        }

        return res.status(200).json("Berhasil konfirmasi tugas !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ADD EVENT TASK DETAIL (BERI TUGAS)
router.post('/task/detail/give-task', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        list_user_id,
        task_id
    } = req.body;

    try {
        if (stringUtils.isEmptyString(task_id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataTask = await knex('event_tasks').where('id','=', task_id).first();
        for (let idx = 0; idx < list_user_id.length; idx++) {
            await knex('event_task_details').insert({
                "user_id": list_user_id[idx],
                "task_id": task_id,
                "created_at": moment().toDate(),
                "created_by": user.id,
                "status": 1
            });
        }

        await knex('event_tasks').update({
            "total_worker_now": dataTask.total_worker_now + list_user_id.length,
        }).where('id','=', task_id); 
        
        let dataTaskNew = await knex('event_tasks').where('id','=', task_id).first();
        if (dataTaskNew.total_worker_needed == dataTaskNew.total_worker_now) {
            await knex('event_task_details').update({"status": -2 }).where('task_id','=', task_id).andWhere('status','=',0);
        }
        return res.status(200).json("Berhasil memberi tugas !");
        
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === DELETE EVENT TASK DETAIL (KICK OUT)
router.patch('/task/detail/kick-out', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
       task_detail_id,
       alasan
    } = req.body;

    try {
        if (stringUtils.isEmptyString(task_detail_id)) {
            return res.status(400).json('Data tidak valid');
        }
        await knex('event_task_details').update({
            "status": -3,
            "notes": alasan
        }).where('id','=', task_detail_id);
        
        let dataTaskDetail = await knex('event_task_details').where('id','=',task_detail_id).first();
        let dataTask = await knex('event_tasks').where('id','=', dataTaskDetail.task_id).first();

        await knex('event_tasks').update({
            "total_worker_now": dataTask.total_worker_now -1,
        }).where('id','=', dataTask.id); 
        
        return res.status(200).json("Berhasil mengeluarkan petugas !");
        
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === ADD EVENT TASK DETAIL RATING
router.post('/task/detail/rating/add', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        rating,
        review,
        task_detail_id
    } = req.body;

    try {
        if (stringUtils.isEmptyString(rating) || stringUtils.isEmptyString(task_detail_id)) {
            return res.status(400).json('Data tidak valid');
        }

        let dataTaskDetail = await knex('event_task_details').where('id','=', task_detail_id).first();

        if (stringUtils.isEmptyString(review)) {
            await knex('event_task_detail_ratings').insert({
                "rating": rating,
                "rated_for": dataTaskDetail.user_id,
                "event_task_detail_id": task_detail_id,
                "created_at": moment().toDate(),
                "created_by": user.id,
            });
        }else{
            await knex('event_task_detail_ratings').insert({
                "rating": rating,
                "review": review,
                "rated_for": dataTaskDetail.user_id,
                "event_task_detail_id": task_detail_id,
                "created_at": moment().toDate(),
                "created_by": user.id,
            });
        }

        

        let avg = await knex('event_task_detail_ratings')
            .avg({data: 'rating'})
            .where('event_task_detail_id','=', task_detail_id).first();

        await knex('event_task_details').update({
            "rating_avg": avg.data,
            "rating_ctr": dataTaskDetail.rating_ctr + 1 
        }).where('id','=',task_detail_id);
        

        return res.status(200).json("Berhasil memberi rating kepada petugas !"); 
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET LIST EVENT TASK DETAIL RATING
router.get('/task/detail/rating/get/id-event-task-detail/:idEventTaskDetail', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idEventTaskDetail } = req.params;
    try {
        
        let dataListEventTaskDetailRating = await knex('event_task_detail_ratings').where('event_task_detail_id', '=', idEventTaskDetail);

        for (let idx = 0; idx < dataListEventTaskDetailRating.length; idx++) {
            let dataCreatedBy = await knex('users').where('id','=', dataListEventTaskDetailRating[idx].created_by).first();
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
            dataListEventTaskDetailRating[idx].created_by = dataCreatedBy;
        }
        return res.status(200).json(dataListEventTaskDetailRating);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET EVENT TASK DETAIL
router.get('/task/detail/get/id-event-task-detail/:idEventTaskDetail', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let { idEventTaskDetail } = req.params;
    try {
        
        let dataEventTaskDetail = await knex('event_task_details').where('id', '=', idEventTaskDetail).first();

        for (let idx = 0; idx < dataEventTaskDetail.length; idx++) {
            let dataCreatedBy = await knex('users').where('id','=', dataEventTaskDetail[idx].user_id).first();
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
            dataEventTaskDetail[idx].created_by = dataCreatedBy;
        }
        
        return res.status(200).json(dataEventTaskDetail);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET LIST EVENT TASK DETAIL MINE
router.get('/task/detail/list/get/mine', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        let dataListEventTaskDetail = await knex('event_task_details').where('user_id', '=', user.id);

        for (let idx = 0; idx < dataListEventTaskDetail.length; idx++) {
            let dataUser = await knex('users').where('id','=', dataListEventTaskDetail[idx].user_id).first();
            delete dataUser.created_by;
            delete dataUser.created_at;
            delete dataUser.refresh_token;
            delete dataUser.total_serving_as_neighbourhood_head;
            delete dataUser.sign_img;
            delete dataUser.password;
            delete dataUser.nik;
            delete dataUser.kk_num;
            delete dataUser.born_at;
            delete dataUser.born_date;
            delete dataUser.religion;
            delete dataUser.status_perkawinan;
            delete dataUser.profession;
            delete dataUser.nationality;
            delete dataUser.is_lottery_club_member;
            dataListEventTaskDetail[idx].dataUser = dataUser;

            let dataEventTask = await knex('event_tasks').where('id','=', dataListEventTaskDetail[idx].task_id).first();
            let dataEvent = await knex('events').where('id','=', dataEventTask.event_id).first();
            let createdBy = await knex('users').where('id','=',dataEvent.created_by).first();
            delete createdBy.created_by;
            delete createdBy.created_at;
            delete createdBy.refresh_token;
            delete createdBy.total_serving_as_neighbourhood_head;
            delete createdBy.sign_img;
            delete createdBy.password;
            delete createdBy.nik;
            delete createdBy.kk_num;
            delete createdBy.born_at;
            delete createdBy.born_date;
            delete createdBy.religion;
            delete createdBy.status_perkawinan;
            delete createdBy.profession;
            delete createdBy.nationality;
            delete createdBy.is_lottery_club_member;

            dataEvent.created_by = createdBy;
            dataEventTask.dataEvent = dataEvent;
            dataListEventTaskDetail[idx].dataTask = dataEventTask;
        }
        
        return res.status(200).json(dataListEventTaskDetail);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET LIST EVENT
router.get('/get/all', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    try {
        
        let dataListEvent = await knex('events').where('area_id', '=', user.area_id).andWhere('status', '>=', 0);

        for (let idx = 0; idx < dataListEvent.length; idx++) {
            let dataCreatedBy = await knex('users').where('id','=', dataListEvent[idx].created_by).first();
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
            dataListEvent[idx].created_by = dataCreatedBy;

            let dataListTask = await knex('event_tasks').where('event_id','=', dataListEvent[idx].id);
            for (let idx2 = 0; idx2 < dataListTask.length; idx2++) {
                let dataListTaskDetails = await knex('event_task_details').where('task_id','=', dataListTask[idx2].id);
                
                for (let idx3 = 0; idx3 < dataListTaskDetails.length; idx3++) {
                    let dataUser = await knex('users').where('id', '=', dataListTaskDetails[idx3].user_id).first();
                    delete dataUser.created_by;
                    delete dataUser.created_at;
                    delete dataUser.refresh_token;
                    delete dataUser.total_serving_as_neighbourhood_head;
                    delete dataUser.sign_img;
                    delete dataUser.password;
                    delete dataUser.nik;
                    delete dataUser.kk_num;
                    delete dataUser.born_at;
                    delete dataUser.born_date;
                    delete dataUser.religion;
                    delete dataUser.status_perkawinan;
                    delete dataUser.profession;
                    delete dataUser.nationality;
                    delete dataUser.is_lottery_club_member;
                    dataListTaskDetails[idx3].dataUser = dataUser;
                }
                dataListTask[idx2].listPetugas = dataListTaskDetails;
            }
            dataListEvent[idx].tasks = dataListTask;
        }
        
        return res.status(200).json(dataListEvent);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET EVENT
router.get('/get/id-event/:idEvent', isAuthenticated, async (req, res) => {
    let {idEvent} = req.params;
    try {
        
        let dataEvent = await knex('events').where('id', '=', idEvent).first();

        let dataCreatedBy = await knex('users').where('id','=', dataEvent.created_by).first();
        dataEvent.created_by = dataCreatedBy;

        let dataListTask = await knex('event_tasks').where('event_id','=', dataEvent.id);
            for (let idx1 = 0; idx1 < dataListTask.length; idx1++) {
                let dataListTaskDetails = await knex('event_task_details').where('task_id','=', dataListTask[idx1].id);
                
                for (let idx2 = 0; idx2 < dataListTaskDetails.length; idx2++) {
                    let dataUser = await knex('users').where('id', '=', dataListTaskDetails[idx2].user_id).first();
                    delete dataUser.created_by;
                    delete dataUser.created_at;
                    delete dataUser.refresh_token;
                    delete dataUser.total_serving_as_neighbourhood_head;
                    delete dataUser.sign_img;
                    delete dataUser.password;
                    delete dataUser.nik;
                    delete dataUser.kk_num;
                    delete dataUser.born_at;
                    delete dataUser.born_date;
                    delete dataUser.religion;
                    delete dataUser.status_perkawinan;
                    delete dataUser.profession;
                    delete dataUser.nationality;
                    delete dataUser.is_lottery_club_member;
                    dataListTaskDetails[idx2].dataUser = dataUser;
                }
                dataListTask[idx1].listPetugas = dataListTaskDetails;
            }
            dataEvent.tasks = dataListTask;
        
        return res.status(200).json(dataEvent);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === GET EVENT TASK 
router.get('/task/get/id-task/:idTask', isAuthenticated, async (req, res) => {
    let {idTask} = req.params;
    try {
        let dataTask = await knex('event_tasks').where('id','=', idTask).first();

        let dataEventTaskDetail = await knex('event_task_details').where('task_id', '=', idTask);
        for (let idx = 0; idx < dataEventTaskDetail.length; idx++) {
            let dataUser = await knex('users').where('id','=', dataEventTaskDetail[idx].user_id).first();
            delete dataUser.created_by;
            delete dataUser.created_at;
            delete dataUser.refresh_token;
            delete dataUser.total_serving_as_neighbourhood_head;
            delete dataUser.sign_img;
            delete dataUser.password;
            delete dataUser.nik;
            delete dataUser.kk_num;
            delete dataUser.born_at;
            delete dataUser.born_date;
            delete dataUser.religion;
            delete dataUser.status_perkawinan;
            delete dataUser.profession;
            delete dataUser.nationality;
            delete dataUser.is_lottery_club_member;
            dataEventTaskDetail[idx].dataUser = dataUser;
        }
        dataTask.listPetugas = dataEventTaskDetail;

        console.log(dataTask);

        return res.status(200).json(dataTask);
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === DELETE EVENT
router.patch('/delete', isAuthenticated, async (req, res) => {
    let {
        event_id
    } = req.body;

    try {
        await knex('events').update({
            "status": -1
        }).where('id','=',event_id);

        return res.status(200).json("Berhasil menghapus acara !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 

// === UPDATE EVENT
router.patch('/update', isAuthenticated, async (req, res) => {
    let user = req.authenticatedUser;
    let {
        title,
        detail,
        event_id
    } = req.body;

    try {
        if (stringUtils.isEmptyString(title)
            || stringUtils.isEmptyString(detail)
            || stringUtils.isEmptyString(event_id)) {
            return res.status(400).json('Data tidak valid');
        }
        await knex('events').update({
            "title": title,
            "detail": detail,
            "status": 0
        }).where('id','=', event_id);

        return res.status(200).json("Berhasil memperbarui acara !");
    } catch (error) {
        console.error(error);
        return res.status(500).json('ERROR');
    }
});
// === 



// === GET LIST EVENT TASK DETAIL
// router.get('/task/detail/get/id-task/:idTask', isAuthenticated, async (req, res) => {
//     let { idTask } = req.params;
//     try {
//         let dataListTaskDetail = await knex('event_task_details').where('task_id','=', idTask);
//         if (!dataListTaskDetail) {
//             return res.status(400).json('Data tidak valid');
//         }
//         for (let idx = 0; idx < dataListTaskDetail.length; idx++) {
//             let dataUser = await knex('users').where('id', '=', dataListTaskDetail[idx].user_id).first();
//             dataListTaskDetail[idx].dataUser = dataUser;
//         }
//         return res.status(200).json(dataListTaskDetail);
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json('ERROR');
//     }
// });
// === 




module.exports = router;