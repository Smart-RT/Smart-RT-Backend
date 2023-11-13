const knex = require('../../database');
const moment = require('moment');
let firebaseAdmin = require('firebase-admin');
moment.tz('Asia/Jakarta');

const firestore = firebaseAdmin.firestore();
const cloudMessaging = firebaseAdmin.messaging();

const sendNotification = async (userId, type, title, body) => {
    let userFCM = (await firestore.collection('FCMTokens')
        .where('userId', '==', userId)
        .get()).docs;
        
    // masukin ke db notifications
    await knex('notifications').insert({
        title: title,
        body: body,
        type: type,
        user_id: userId,
        created_at: moment().toDate()
    });

    if (userFCM.length <= 0) return;
    let tokens = userFCM.map((user) => user.data().FCMToken);
    cloudMessaging.sendToDevice(tokens, {
        data: {
            title: `${title}`,
            body: `${body}`,
            type: `${type}`,
            userId: `${userId}`
        }
    });
}

module.exports = {
    sendNotification
}