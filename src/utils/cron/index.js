const cron = require('node-cron');

const checkArisan = async () => {
    console.log('Checking ARisan');
}

const checkPemilihan = async () => {
    console.log("Checking Pemilihan ketua RT")
}

const runCrons = async () => {
    console.log('Menjalankan cronjobs..');

    // Jalankan setiap hari
    cron.schedule('0 0 * * *', () => {
        // apapun yang ada disini, akan dijalankan setiap hari.
        checkArisan();
        checkPemilihan();
    }, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    });

}

const stopCrons = async () => {
    console.log("Mematikan semua cronjobs..");
    // ambil semua cron job, lalu jalankan method stop pada setiap task nya.
    await Promise.all(cron.getTasks().map(c => c.stop()));
}

module.exports = { runCrons, stopCrons };