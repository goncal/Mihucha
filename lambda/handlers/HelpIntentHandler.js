const Alexa = require('ask-sdk-core');
const { CARD_TITLE, HELP_MESSAGE } = require('./shared');

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = '¿Cómo puedo ayudarte?' + HELP_MESSAGE;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

module.exports = HelpIntentHandler;
