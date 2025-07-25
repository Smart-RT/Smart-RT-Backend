const { tokenUtils } = require('../../utils');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');

const storageItemImage = multer.diskStorage({
    destination: (req, file, callback) => {
        let { uid } = req.params;
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'users',
            uid,
            'profile_picture'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            // if exist remove its content
            fs.emptyDirSync(filePath);
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemImage = multer({
    storage: storageItemImage,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png|webp|gif|tiff/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, png, webp, gif, atau tiff';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageSignatureImage = multer.diskStorage({
    destination: (req, file, callback) => {
        let { uid } = req.params;
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'users',
            uid,
            'signature'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            // if exist remove its content
            fs.emptyDirSync(filePath);
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadSignatureImage = multer({
    storage: storageSignatureImage,
    fileFilter: (req, file, callback) => {
        const fileTypes = /png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageKTPImage = multer.diskStorage({
    destination: (req, file, callback) => {
        let { uid } = req.body;
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'users',
            uid,
            'KTP'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            // if exist remove its content
            fs.emptyDirSync(filePath);
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadKTPImage = multer({
    storage: storageKTPImage,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, atau png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageKKImage = multer.diskStorage({
    destination: (req, file, callback) => {
        let { uid } = req.body;
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'users',
            uid,
            'KK'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            // if exist remove its content
            fs.emptyDirSync(filePath);
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadKKImage = multer({
    storage: storageKKImage,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, atau png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemImageKTP = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'ktp'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            // if exist remove its content
            fs.emptyDirSync(filePath);
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemImageKTP = multer({
    storage: storageItemImageKTP,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, atau png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemImageKTPSelfie = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'ktp_selfie'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            // if exist remove its content
            fs.emptyDirSync(filePath);
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemImageKTPSelfie = multer({
    storage: storageItemImageKTP,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, atau png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemFileLampiran = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'file_lampiran'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        // req.file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemFileLampiran = multer({
    storage: storageItemFileLampiran,
    fileFilter: (req, file, callback) => {
        let fileTypes = /pdf/;
        if (file.fieldname == 'ktp' || file.fieldname == 'ktpSelfie') {
            fileTypes = /jpeg|jpg|png/;
        }

        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'Format File yang dapat diupload tidak sesuai';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemLampiranAdministrasi = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'administrasi',
            'file_lampiran'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }

        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemLampiranAdministrasi = multer({
    storage: storageItemLampiranAdministrasi,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, atau png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemLampiranPengumuman = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'pengumuman',
            'file_lampiran'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }

        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemLampiranPengumuman = multer({
    storage: storageItemLampiranPengumuman,
    fileFilter: (req, file, callback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File gambar yang dapat diupload hanya jpeg, jpg, atau png';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemLampiranJanjiTemu = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'meet',
            'file_lampiran'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }

        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        file.filename = filename;
        callback(null, filename);
    },
});

const uploadItemLampiranJanjiTemu = multer({
    storage: storageItemLampiranJanjiTemu,
    fileFilter: (req, file, callback) => {
        const fileTypes = /pdf/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File yang dapat diupload hanya pdf.';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemFileCarouselHome = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'carousel-home'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        callback(null, filename);
    },
});

const uploadItemFileCarouselHome = multer({
    storage: storageItemFileCarouselHome,
    fileFilter: (req, file, callback) => {    
        fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'Format File yang dapat diupload tidak sesuai';
        req.multerError = error;
        callback(new Error(error));
    },
});

const storageItemFileDocumentationEvent = multer.diskStorage({
    destination: (req, file, callback) => {
        let filePath = path.join(
            __dirname,
            '..',
            '..',
            '..',
            'public',
            'uploads',
            'events'
        );
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }
        callback(null, filePath);
    },
    filename: (req, file, callback) => {
        let randomFileName = tokenUtils.createRefreshToken(15);
        let filename = `${randomFileName}${path.extname(file.originalname)}`;
        callback(null, filename);
    },
});

const uploadItemFileDocumentationEvent = multer({
    storage: storageItemFileDocumentationEvent,
    fileFilter: (req, file, callback) => {
        fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'Format File yang dapat diupload tidak sesuai';
        req.multerError = error;
        callback(new Error(error));
    },
});

module.exports = { 
    uploadItemImage, 
    uploadSignatureImage, 
    uploadKTPImage, 
    uploadKKImage, 
    uploadItemFileLampiran, 
    uploadItemLampiranAdministrasi, 
    uploadItemLampiranPengumuman, 
    uploadItemLampiranJanjiTemu,
    uploadItemFileCarouselHome,
    uploadItemFileDocumentationEvent
};
