const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
    let bearerHeader = req.headers.authorization ?? '';
    let token = bearerHeader.split(' ')[1];
    if (!token) return next();
    try {
        let payload = jwt.verify(token, `${process.env.JWT_SECRET_KEY}`);
        req.authenticatedUser = payload;
        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError')
            return res.status(401).json('Token Expired');
        return res.status(403).json('Forbidden');
    }
};

const isAuthenticated = (req, res, next) => {
    if(!req.authenticatedUser) return res.status(403).json('Forbidden');
    return next();
};

const isAdmin = (req,res,next) =>{
    if(req.authenticatedUser.user_role == 1) {
        return next();
    }
    return res.status(403).json('Forbidden');
}

module.exports = {
    auth,
    isAuthenticated,
    isAdmin
}
