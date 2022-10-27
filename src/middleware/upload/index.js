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
        const fileTypes = /pdf/;
        const extName = fileTypes.test(
            path.extname(file.originalname.toLowerCase())
        );
        const mimeType = fileTypes.test(file.mimetype);
        if (extName && mimeType) return callback(null, true);
        const error =
            'File yang dapat diupload hanya pdf';
        req.multerError = error;
        callback(new Error(error));
    },
});

module.exports = { uploadItemImage, uploadSignatureImage, uploadItemFileLampiran};
