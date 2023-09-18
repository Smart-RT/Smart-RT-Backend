const crypto = require('crypto');
const exec = require('child_process').exec;
const execPullInstall = (command, cb) => {
    let child = exec(command, (err, stdout, stderr) => {
        if (err != null) {
            return cb(new Error(err), null);
        }
        else if (typeof (stderr) != "string") {
            return cb(new Error(stderr), null);
        }
        else {
            return cb(null, stdout);
        }
    })
}

// Middleware Check GHUB WebHook
const verifyGitHubWebHook = async (req, res, next) => {
    const sigHeaderName = 'X-Hub-Signature-256'
    const sigHashAlg = 'sha256'

    const sig = Buffer.from(req.get(sigHeaderName) || '', 'utf8');
    const hmac = crypto.createHmac(sigHashAlg, process.env.GITHUB_SECRET);
    const digest = Buffer.from(`${sigHashAlg}=${hmac.update(req.rawBody).digest('hex')}`, 'utf8');

    if (sig.length !== digest.length || !crypto.timingSafeEqual(sig, digest)) {
        return res.status(401).json(`Unauthorized`);
    }
    
    return next();
}

module.exports = {
    verifyGitHubWebHook,
    execPullInstall
}