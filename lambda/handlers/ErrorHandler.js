const { CARD_TITLE } = require('./shared');

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error: ${error.stack}`);
        const speakOutput = 'Lo siento, algo ha fallado. ¿Puedes volver a intentarlo?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

module.exports = ErrorHandler;
