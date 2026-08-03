const Alexa = require('ask-sdk-core');
const {
    CARD_TITLE,
    CFA,
    HELP_MESSAGE,
    getLocale,
    initializePiggyBank,
    getCurrencyForLocale
} = require('./shared');

const AddMoneyIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddMoneyIntent';
    },
    async handle(handlerInput) {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        const locale = getLocale(handlerInput);
        const { piggy_bank_state } = attributes;
        let speakOutput;

        let amountToAdd = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        amountToAdd = Number(amountToAdd);

        if (piggy_bank_state === undefined) {
            // Piggy bank needs to be initialized.
            const initializedState = initializePiggyBank(attributes, locale);
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `¡Hola! Este skill, "${CARD_TITLE}", te ayuda a controlar y actualizar el contenido de tu hucha. `;
            speakOutput = speakOutput + `Para empezar, asumo que la hucha contiene cero ${initializedState.currency}. `;
            speakOutput = speakOutput + 'Puedes añadir, sacar, o ajustar el contenido de la hucha. También puedes pedir ayuda. ' + CFA + HELP_MESSAGE;
        } else {
            const { current_amount } = piggy_bank_state;
            const nowTS = new Date().getTime();
            let savedCurrency = piggy_bank_state.currency;
            if (savedCurrency === undefined) {
                // This handles the legacy case of database entries where currency was not properly initialized.
                savedCurrency = getCurrencyForLocale(locale);
                piggy_bank_state.currency = savedCurrency;
            }
            piggy_bank_state.current_amount = current_amount + amountToAdd;
            piggy_bank_state.timestamp = nowTS;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `Añadiendo ${amountToAdd} ${savedCurrency}. La hucha contiene ahora ${piggy_bank_state.current_amount} ${savedCurrency}. `;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput + CFA)
            .reprompt(speakOutput + CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .getResponse();
    }
};

module.exports = AddMoneyIntentHandler;
