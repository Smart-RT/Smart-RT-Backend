const jwt = require('jsonwebtoken');
const createRefreshToken = (length) => {
    return [...Array(length)]
        .map((i) => (~~(Math.random() * 36)).toString(36))
        .join('');
};

const createJWT = (payload) => {
    return jwt.sign(payload, `${process.env.JWT_SECRET_KEY}`, {
        expiresIn: process.env.JWT_EXPIRE_TIME,
    });
};

module.exports = {
    createRefreshToken,
    createJWT,
};
