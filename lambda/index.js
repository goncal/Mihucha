// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const AWS = require('aws-sdk')
const Alexa = require('ask-sdk-core');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter');
//
const CARD_TITLE = "Mi hucha";
const CFA = '¿Qué quieres hacer? '
const HELP_MESSAGE = 'Puedes decir "estado", "añade", "saca", "ajusta", o "para". ';
const LOCALE = 'es-ES';

const getLastTransactionDateAndTime = (timeStamp, userTZ) => {
    // Return day and hour corresponding to timeStamp in the user's timezone userTZ
    const oneDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const today = now.toLocaleDateString(LOCALE, { timeZone: userTZ });
    const yesterday = new Date(now.getTime() - oneDay).toLocaleDateString(LOCALE, { timeZone: userTZ });
    let userDate = new Date(timeStamp).toLocaleDateString(LOCALE, { timeZone: userTZ });
    // BUG: weekday only work on English locales
    //const userWeekDay = new Date(timeStamp).toLocaleDateString(LOCALE, { weekday: 'long', timeZone: userTZ });
    //console.log( 'weekday: ', userWeekDay );
    const userTime = new Date(timeStamp).toLocaleTimeString(LOCALE, { timeZone: userTZ, hour: "2-digit", minute: "2-digit" });
    if (userDate === today) {
        userDate = "hoy";
    } else if (userDate === yesterday) {
        userDate = "ayer";
    }
    return [ userDate, userTime ]
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        // The next line will log all requests (LaunchRequestHandler.canHandle is always executed)
        console.log(JSON.stringify(handlerInput.requestEnvelope.request));
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let speakOutput, textOutput;

        // Get the time zone used in the device and store it in session attributes
        let userTimeZone;
        try {
            const upsServiceClient = serviceClientFactory.getUpsServiceClient();
            userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
        } catch (error) {
            if (error.name !== 'ServiceError') {
                return handlerInput.responseBuilder.speak("Ha habido un problema conectando con el servicio.").getResponse();
            }
            console.log('error', error.message);
        }
        sessionAttributes.userTZ = userTimeZone;

        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        let { piggy_bank_state } = attributes;

        if (typeof piggy_bank_state !== 'undefined') {
            const { current_amount, timestamp } = piggy_bank_state;
            let userDate, userTime;
            [ userDate, userTime ] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ);
            speakOutput = `La hucha contiene ${current_amount} Euros desde <say-as interpret-as="date">${userDate}</say-as> a las <say-as interpret-as="time">${userTime}</say-as>. ` + CFA;
            textOutput = `La hucha contiene ${current_amount} Euros desde ${userDate} a las ${userTime}. ` + CFA + ' Puedes decir "estado", "añade", "saca", "ajusta" o "para".';
        } else {
            speakOutput = `¡Hola! Este skill, "${CARD_TITLE}", te ayuda a controlar y actualizar el contenido de tu hucha. `;
            speakOutput = speakOutput + 'Para empezar, asumo que la hucha contiene cero euros. ';
            speakOutput = speakOutput + 'Puedes añadir, sacar, o ajustar el contenido de la hucha. También puedes pedir ayuda. ' + CFA + HELP_MESSAGE;
            textOutput = `${CARD_TITLE} te ayuda a controlar el contenido de tu hucha.` + HELP_MESSAGE;
            let now = new Date();
            const now_TS = now.getTime();
            attributes.piggy_bank_state = {
                'current_amount': 0,
                'timestamp': now_TS
            }
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, textOutput)
            .getResponse();
    },
};

const StatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StatusIntent';
    },
    async handle(handlerInput) {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let { piggy_bank_state } = attributes;
        let userDate, userTime;
        let speakOutput, textOutput;

        if (typeof piggy_bank_state !== 'undefined') {
            const { current_amount, timestamp } = piggy_bank_state;
            [ userDate, userTime ] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ);
            speakOutput = `La hucha contiene ${current_amount} Euros desde <say-as interpret-as="date">${userDate}</say-as> a las <say-as interpret-as="time">${userTime}</say-as>. `;
            textOutput = `La hucha contiene ${current_amount} Euros desde ${userDate} a las ${userTime}. `;
        } else {
            speakOutput = 'La hucha no está inicializada, y esto no debería pasar.';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput + CFA)
            .reprompt(speakOutput + CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, textOutput)
            .getResponse();
    }
};

const AddMoneyIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddMoneyIntent';
    },
    async handle(handlerInput) {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        let { piggy_bank_state } = attributes;
        let speakOutput, textOutput;
        var AmountToAdd = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        AmountToAdd = Number(AmountToAdd);

        if (typeof piggy_bank_state !== 'undefined') {
            const { current_amount } = piggy_bank_state;
            let now = new Date();
            const now_TS = now.getTime();
            piggy_bank_state.current_amount = current_amount + AmountToAdd;
            piggy_bank_state.timestamp = now_TS;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `Añadiendo ${AmountToAdd} Euros. La hucha contiene ahora ${piggy_bank_state.current_amount} Euros. `;
        } else {
            speakOutput = 'La hucha no está inicializada, y esto no debería pasar.';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput + CFA)
            .reprompt(speakOutput + CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .getResponse();
    }
};

const RemoveMoneyIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RemoveMoneyIntent';
    },
    async handle(handlerInput) {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        let { piggy_bank_state } = attributes;
        let speakOutput, textOutput;
        var AmountToRemove = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        AmountToRemove = Number(AmountToRemove);

        speakOutput = `Sacando ${AmountToRemove} Euros. `;
        if (typeof piggy_bank_state !== 'undefined') {
            const { current_amount } = piggy_bank_state;
            let now = new Date();
            const now_TS = now.getTime();
            piggy_bank_state.current_amount = current_amount - AmountToRemove;
            if (piggy_bank_state.current_amount < 0) {
                piggy_bank_state.current_amount = 0;
                speakOutput = speakOutput + 'Estás sacando más dinero del que hay. '
            }
            piggy_bank_state.timestamp = now_TS;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = speakOutput + `La hucha contiene ahora ${piggy_bank_state.current_amount} Euros. `;
        } else {
            speakOutput = 'La hucha no está inicializada, y esto no debería pasar.';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput + CFA)
            .reprompt(speakOutput + CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .getResponse();
    }
};

const AdjustPiggyBankIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AdjustPiggyBankIntent';
    },
    async handle(handlerInput) {
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        let { piggy_bank_state } = attributes;
        let speakOutput, textOutput;
        var NewAmount = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        NewAmount = Number(NewAmount);

        if (typeof piggy_bank_state !== 'undefined') {
            const { current_amount } = piggy_bank_state;
            let now = new Date();
            const now_TS = now.getTime();
            piggy_bank_state.current_amount = NewAmount;
            piggy_bank_state.timestamp = now_TS;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `La hucha contenía ${current_amount} Euros y ahora contiene ${piggy_bank_state.current_amount} Euros. `;
        } else {
            speakOutput = 'La hucha no está inicializada, y esto no debería pasar.';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput + CFA)
            .reprompt(speakOutput + CFA + HELP_MESSAGE)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = '¿Cómo puedo ayudarte? Para interactuar con tu hucha puedes decir estado, añade, saca o ajusta.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = '¡Adiós!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        if(null!==handlerInput.requestEnvelope.request.error) {
            console.log(JSON.stringify(handlerInput.requestEnvelope.request.error));
        }
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
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

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error: ${error.stack}`);
        const speakOutput = `Lo siento, algo ha fallado. ¿Puedes volver a intentarlo?`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        StatusIntentHandler,
        AddMoneyIntentHandler,
        RemoveMoneyIntentHandler,
        AdjustPiggyBankIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
        )
    .withPersistenceAdapter(
        new ddbAdapter.DynamoDbPersistenceAdapter({
            tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
            createTable: false,
            dynamoDBClient: new AWS.DynamoDB({apiVersion: 'latest', region: process.env.DYNAMODB_PERSISTENCE_REGION})
        })
    )
    .addErrorHandlers(
        ErrorHandler,
        )
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();