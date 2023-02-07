const jwt = require('jsonwebtoken');
const createRefreshToken = (length) => {
    return [...Array(length)]
        .map((i) => (~~(Math.random() * 36)).toString(36))
        .join('');
};

const createJWT = (payload) => {
    return jwt.sign(payload, `${process.env.JWT_SECRET}`, {
        expiresIn: process.env.JWT_EXPIRED_TIME,
    });
};

module.exports = {
    createRefreshToken,
    createJWT,
};
