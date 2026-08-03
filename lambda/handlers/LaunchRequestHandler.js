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

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        // The next line will log all requests (LaunchRequestHandler.canHandle is always executed)
        // console.log(JSON.stringify(handlerInput.requestEnvelope.request));
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const locale = getLocale(handlerInput);
        let speakOutput;
        let textOutput;

        // Get the time zone used in the device and store it in session attributes.
        let userTimeZone;
        try {
            const upsServiceClient = serviceClientFactory.getUpsServiceClient();
            userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
        } catch (error) {
            if (error.name !== 'ServiceError') {
                return handlerInput.responseBuilder.speak('Ha habido un problema conectando con el servicio.').getResponse();
            }
            console.log('error', error.message);
        }
        sessionAttributes.userTZ = userTimeZone;

        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        const { piggy_bank_state } = attributes;

        // Check if we need to initialize the piggy bank.
        if (piggy_bank_state === undefined) {
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
            speakOutput = `La hucha contiene ${current_amount} ${savedCurrency} desde ${dateText} a las <say-as interpret-as="time">${userTime}</say-as>. ` + CFA;
            textOutput = `La hucha contiene ${current_amount} ${savedCurrency} desde ${userDate} a las ${userTime}. ` + CFA + HELP_MESSAGE;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, textOutput)
            .getResponse();
    }
};

module.exports = LaunchRequestHandler;
