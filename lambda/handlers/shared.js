const CARD_TITLE = "Mi hucha";
const CFA = '¿Qué quieres hacer? ';
const HELP_MESSAGE = 'Puedes decir "estado", "añade", "saca", "ajusta", "ayuda" o "para". ';
const DEFAULT_LOCALE = 'es-ES';

const getCurrencyForLocale = (locale) => {
    switch (locale) {
        case 'es-MX':
            return 'pesos';
        case 'es-US':
            return 'dólares';
        default:
            return 'euros';
    }
};

const getLocale = (handlerInput) => {
    const requestLocale = handlerInput.requestEnvelope.request.locale;
    if (requestLocale === undefined) {
        return DEFAULT_LOCALE;
    }
    return requestLocale;
};

const initializePiggyBank = (attributes, locale) => {
    const nowTS = new Date().getTime();
    attributes.piggy_bank_state = {
        current_amount: 0,
        timestamp: nowTS,
        currency: getCurrencyForLocale(locale)
    };
    return attributes.piggy_bank_state;
};

const getLastTransactionDateAndTime = (timeStamp, userTZ, locale) => {
    // Return day and hour corresponding to timeStamp in the user's timezone userTZ.
    const oneDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const today = now.toLocaleDateString(locale, { timeZone: userTZ });
    const yesterday = new Date(now.getTime() - oneDay).toLocaleDateString(locale, { timeZone: userTZ });
    let userDate = new Date(timeStamp).toLocaleDateString(locale, { timeZone: userTZ });
    const userWeekDay = new Date(timeStamp).toLocaleDateString(locale, { weekday: 'long', timeZone: userTZ });
    const userTime = new Date(timeStamp).toLocaleTimeString(locale, { timeZone: userTZ, hour: '2-digit', minute: '2-digit' });

    if (userDate === today) {
        userDate = 'hoy';
    } else if (userDate === yesterday) {
        userDate = 'ayer';
    }

    return [userDate, userTime, userWeekDay];
};

const sayDate = (userDate, userWeekDay) => {
    if (userDate === 'hoy' || userDate === 'ayer') {
        return `${userDate} ${userWeekDay}`;
    }
    return `${userWeekDay} <say-as interpret-as="date" format="dmy">${userDate}</say-as>`;
};

module.exports = {
    CARD_TITLE,
    CFA,
    HELP_MESSAGE,
    DEFAULT_LOCALE,
    getCurrencyForLocale,
    getLocale,
    initializePiggyBank,
    getLastTransactionDateAndTime,
    sayDate
};
