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

const isReligionAvailable = (text) => {
    var txt = text.toLowerCase();
    if (txt == 'islam' 
        || txt == 'kristen'
        || txt == 'katolik'
        || txt == 'hindu'
        || txt == 'budha'
        || txt == 'kong hu cu') {
        return true;
    }
    return false;
}

const isGenderAvailable = (text) => {
    var txt = text.toLowerCase();
    if (txt == 'laki-laki' 
        || txt == 'perempuan') {
        return true;
    }
    return false;
}

const isWeddingStatusAvailable = (text) => {
    var txt = text.toLowerCase();
    if (txt == 'belum kawin' 
        || txt == 'kawin'
        || txt == 'cerai mati'
        || txt == 'cerai hidup') {
        return true;
    }
    return false;
}


module.exports = {
    isEmptyString,
    isOneOf,
    isPhoneValid,
    randomVarchar,
    isReligionAvailable,
    isGenderAvailable,
    isWeddingStatusAvailable,
};