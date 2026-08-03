const Alexa = require('ask-sdk-core');
const {
    CARD_TITLE,
    CFA,
    HELP_MESSAGE,
    getLocale,
    initializePiggyBank,
    getCurrencyForLocale,
    getLastTransactionDateAndTime,
    sayDate
} = require('./shared');

const StatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StatusIntent';
    },
    async handle(handlerInput) {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const locale = getLocale(handlerInput);
        const { piggy_bank_state } = attributes;
        let speakOutput;
        let textOutput;

        if (piggy_bank_state === undefined) {
            // Piggy bank needs to be initialized.
            const initializedState = initializePiggyBank(attributes, locale);
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `¡Hola! Este skill, "${CARD_TITLE}", te ayuda a controlar y actualizar el contenido de tu hucha. `;
            speakOutput = speakOutput + `Para empezar, asumo que la hucha contiene cero ${initializedState.currency}. `;
            speakOutput = speakOutput + 'Puedes añadir, sacar, o ajustar el contenido de la hucha. También puedes pedir ayuda. ' + CFA + HELP_MESSAGE;
            textOutput = `${CARD_TITLE} te ayuda a controlar el contenido de tu hucha.` + HELP_MESSAGE;
        } else {
            const { current_amount, timestamp } = piggy_bank_state;
            let savedCurrency = piggy_bank_state.currency;
            if (savedCurrency === undefined) {
                // This handles the legacy case of database entries where currency was not properly initialized.
                savedCurrency = getCurrencyForLocale(locale);
            }
            const [userDate, userTime, userWeekDay] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ, locale);
            const dateText = sayDate(userDate, userWeekDay);
            speakOutput = `La hucha contiene ${current_amount} ${savedCurrency} desde ${dateText} a las <say-as interpret-as="time">${userTime}</say-as>. `;
            textOutput = `La hucha contiene ${current_amount} ${savedCurrency} desde ${userDate} a las ${userTime}. `;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput + CFA)
            .reprompt(speakOutput + CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, textOutput)
            .getResponse();
    }
};

module.exports = StatusIntentHandler;
