const isEmptyString = (text) => !text || text.trim() === '';

const isOneOf = (text, items) =>
    !isEmptyString(text) &&
    items.map((s) => s.toLowerCase()).includes(text.toLowerCase());

const isPhoneValid = (text) =>
    !isEmptyString(text) && /^08[1-9][0-9]{7,10}$/.test(text);

module.exports = {
    isEmptyString,
    isOneOf,
    isPhoneValid,
};