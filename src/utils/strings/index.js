const isEmptyString = (text) => !text || text.trim() === '';

const isOneOf = (text, items) =>
    !isEmptyString(text) &&
    items.map((s) => s.toLowerCase()).includes(text.toLowerCase());

const isPhoneValid = (text) =>
    !isEmptyString(text) && /^08[1-9][0-9]{7,10}$/.test(text);

const randomVarchar = (length) => {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

module.exports = {
    isEmptyString,
    isOneOf,
    isPhoneValid,
    randomVarchar,
};