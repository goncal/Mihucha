const Alexa = require('ask-sdk-core');
const { CARD_TITLE } = require('./shared');

const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `Has intentado activar ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

module.exports = IntentReflectorHandler;
