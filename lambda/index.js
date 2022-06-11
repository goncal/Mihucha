// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const AWS = require('aws-sdk')
const Alexa = require('ask-sdk-core');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter');
//
const CARD_TITLE = "Mi hucha";
const CFA = '¿Qué quieres hacer? '
const HELP_MESSAGE = 'Puedes decir "estado", "añade", "saca", "ajusta", o "para". ';
const NOT_INITIALIZED = 'La hucha no está inicializada. Para iniciar la hucha puedes decir Alexa, abre mi hucha';
const DEFAULT_LOCALE = 'es-ES';
var locale;
var CURRENCY;

const getLastTransactionDateAndTime = (timeStamp, userTZ) => {
    // Return day and hour corresponding to timeStamp in the user's timezone userTZ
    const oneDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const today = now.toLocaleDateString(locale, { timeZone: userTZ });
    const yesterday = new Date(now.getTime() - oneDay).toLocaleDateString(locale, { timeZone: userTZ });
    let userDate = new Date(timeStamp).toLocaleDateString(locale, { timeZone: userTZ });
    const userWeekDay = new Date(timeStamp).toLocaleDateString(locale, { weekday: 'long', timeZone: userTZ });
    // console.log( 'weekday: ', userWeekDay );
    const userTime = new Date(timeStamp).toLocaleTimeString(locale, { timeZone: userTZ, hour: "2-digit", minute: "2-digit" });
    if (userDate === today) {
        userDate = "hoy";
    } else if (userDate === yesterday) {
        userDate = "ayer";
    }
    return [ userDate, userTime, userWeekDay ]
}

const sayDate = (userDate, userWeekDay) => {
    let text;
    if (userDate === "hoy" || userDate === "ayer") {
        text = userDate + " " + userWeekDay;
    } else {
        text = `${userWeekDay} <say-as interpret-as="date" format="dmy">${userDate}</say-as>`;
    }
    return text
}

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
        let speakOutput, textOutput;

        //var location = Alexa.getSessionAttributes
        locale=handlerInput.requestEnvelope.request.locale;
        if (locale === undefined) {
            locale = DEFAULT_LOCALE;
        }
        switch (locale) {
            case 'es-MX': CURRENCY = "pesos";
            break;
            case 'es-US': CURRENCY = "dólares";
            break;
            default: CURRENCY = "euros"
        }
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

        if (piggy_bank_state !== undefined) {
            const { current_amount, timestamp, currency } = piggy_bank_state;
            if (currency === undefined) {
                // This handles the legacy case of database entries where currency was not properly initialized
                currency = CURRENCY;
            }
            let userDate, userTime, userWeekDay;
            [ userDate, userTime, userWeekDay ] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ);
            const dateText = sayDate(userDate, userWeekDay);
            speakOutput = `La hucha contiene ${current_amount} ${currency} desde ${dateText} a las <say-as interpret-as="time">${userTime}</say-as>. ` + CFA;
            textOutput = `La hucha contiene ${current_amount} ${currency} desde ${userDate} a las ${userTime}. ` + CFA + ' Puedes decir "estado", "añade", "saca", "ajusta" o "para".';
        } else {
            speakOutput = `¡Hola! Este skill, "${CARD_TITLE}", te ayuda a controlar y actualizar el contenido de tu hucha. `;
            speakOutput = speakOutput + 'Para empezar, asumo que la hucha contiene cero ' + currency + '. ';
            speakOutput = speakOutput + 'Puedes añadir, sacar, o ajustar el contenido de la hucha. También puedes pedir ayuda. ' + CFA + HELP_MESSAGE;
            textOutput = `${CARD_TITLE} te ayuda a controlar el contenido de tu hucha.` + HELP_MESSAGE;
            let now = new Date();
            const now_TS = now.getTime();
            attributes.piggy_bank_state = {
                'current_amount': 0,
                'timestamp': now_TS,
                'currency': currency
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
        let userDate, userTime, userWeekDay;
        let speakOutput, textOutput;

        if (piggy_bank_state !== undefined) {
            const { current_amount, timestamp, currency } = piggy_bank_state;
            if (currency === undefined) {
                // This handles the legacy case of database entries where currency was not properly initialized
                locale=handlerInput.requestEnvelope.request.locale;
                if (locale === undefined) {
                    locale = DEFAULT_LOCALE;
                }
                switch (locale) {
                    case 'es-MX': currency = "pesos";
                    break;
                    case 'es-US': currency = "dólares";
                    break;
                    default: currency = "euros"
                }
            }
            [ userDate, userTime, userWeekDay ] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ);
            const dateText = sayDate(userDate, userWeekDay);
            speakOutput = `La hucha contiene ${current_amount} ${currency} desde ${dateText} a las <say-as interpret-as="time">${userTime}</say-as>. `;
            textOutput = `La hucha contiene ${current_amount} ${currency} desde ${userDate} a las ${userTime}. `;
        } else {
            speakOutput = NOT_INITIALIZED;
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

        if (piggy_bank_state !== undefined) {
            const { current_amount } = piggy_bank_state;
            let now = new Date();
            const now_TS = now.getTime();
            piggy_bank_state.current_amount = current_amount + AmountToAdd;
            piggy_bank_state.timestamp = now_TS;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `Añadiendo ${AmountToAdd} ${CURRENCY}. La hucha contiene ahora ${piggy_bank_state.current_amount} ${CURRENCY}. `;
        } else {
            speakOutput = `${NOT_INITIALIZED}`;
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

        speakOutput = `Sacando ${AmountToRemove} ${CURRENCY}. `;
        if (piggy_bank_state !== undefined) {
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
            speakOutput = speakOutput + `La hucha contiene ahora ${piggy_bank_state.current_amount} ${CURRENCY}. `;
        } else {
            speakOutput = `${NOT_INITIALIZED}`;
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

        if (piggy_bank_state !== undefined) {
            const { current_amount } = piggy_bank_state;
            let now = new Date();
            const now_TS = now.getTime();
            piggy_bank_state.current_amount = NewAmount;
            piggy_bank_state.timestamp = now_TS;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            speakOutput = `La hucha contenía ${current_amount} ${CURRENCY} y ahora contiene ${piggy_bank_state.current_amount} ${CURRENCY}. `;
        } else {
            speakOutput = `${NOT_INITIALIZED}`;
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