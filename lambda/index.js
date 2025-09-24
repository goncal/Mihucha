// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const Alexa = require('ask-sdk-core');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter');
const util = require('./util');
//
const CARD_TITLE = "Mi hucha";
const CFA = '¿Qué quieres hacer? '
const HELP_MESSAGE = 'Puedes decir "estado", "añade", "saca", "ajusta", o "para". ';
const NOT_INITIALIZED = 'La hucha no está inicializada. Para iniciar la hucha puedes decir Alexa, abre mi hucha';
const DEFAULT_LOCALE = 'es-ES';

const getLastTransactionDateAndTime = (timeStamp, userTZ, locale) => {
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

// Helper function to get or initialize piggy bank state
async function getOrInitializePiggyBank(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const locale = sessionAttributes.locale || DEFAULT_LOCALE;
    
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    let { piggy_bank_state } = attributes;
    
    if (piggy_bank_state === undefined) {
        piggy_bank_state = util.initializePiggyBank(locale);
        attributes.piggy_bank_state = piggy_bank_state;
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
    }
    
    // Handle legacy data without currency
    if (piggy_bank_state.currency === undefined) {
        piggy_bank_state.currency = util.getCurrencyForLocale(locale);
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
    }
    
    return { piggy_bank_state, attributes, locale };
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
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

        const { piggy_bank_state, attributes, locale } = await getOrInitializePiggyBank(handlerInput);
        
        // Check if this is a first-time initialization
        if (attributes.piggy_bank_state.current_amount === 0 && !attributes.isReturningUser) {
            attributes.isReturningUser = true;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            await handlerInput.attributesManager.savePersistentAttributes();
            
            speakOutput = `¡Hola! Este skill, "${CARD_TITLE}", te ayuda a controlar y actualizar el contenido de tu hucha. `;
            speakOutput = speakOutput + 'Para empezar, asumo que la hucha contiene cero ' + piggy_bank_state.currency + '. ';
            speakOutput = speakOutput + 'Puedes añadir, sacar, o ajustar el contenido de la hucha. También puedes pedir ayuda.' + CFA + HELP_MESSAGE;
            textOutput = `${CARD_TITLE} te ayuda a controlar el contenido de tu hucha.` + HELP_MESSAGE;
        } else {
            const { current_amount, timestamp, currency } = piggy_bank_state;
            let userDate, userTime, userWeekDay;
            [ userDate, userTime, userWeekDay ] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ, locale);
            const dateText = sayDate(userDate, userWeekDay);
            speakOutput = `La hucha contiene ${current_amount} ${currency} desde ${dateText} a las <say-as interpret-as="time">${userTime}</say-as>. ` + CFA;
            textOutput = `La hucha contiene ${current_amount} ${currency} desde ${userDate} a las ${userTime}. ` + CFA + ' Puedes decir "estado", "añade", "saca", "ajusta", "ayuda" o "para".';
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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const { piggy_bank_state, locale } = await getOrInitializePiggyBank(handlerInput);
        
        const { current_amount, timestamp, currency } = piggy_bank_state;
        let userDate, userTime, userWeekDay;
        [ userDate, userTime, userWeekDay ] = getLastTransactionDateAndTime(timestamp, sessionAttributes.userTZ, locale);
        const dateText = sayDate(userDate, userWeekDay);
        
        const speakOutput = `La hucha contiene ${current_amount} ${currency} desde ${dateText} a las <say-as interpret-as="time">${userTime}</say-as>. `;
        const textOutput = `La hucha contiene ${current_amount} ${currency} desde ${userDate} a las ${userTime}. `;

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
        const { piggy_bank_state, attributes } = await getOrInitializePiggyBank(handlerInput);
        
        // Validate the amount input
        const amountSlotValue = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        const amountToAdd = util.validateAmount(amountSlotValue);
        
        if (amountToAdd === null) {
            const speakOutput = 'Lo siento, no entendí la cantidad. Por favor, dime una cantidad válida entre 0 y un millón.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Cuánto dinero quieres añadir a la hucha?')
                .withSimpleCard(CARD_TITLE, speakOutput)
                .getResponse();
        }
        
        // Update piggy bank state
        const { current_amount, currency } = piggy_bank_state;
        piggy_bank_state.current_amount = current_amount + amountToAdd;
        piggy_bank_state.timestamp = new Date().getTime();
        
        // Save to persistent storage
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        
        const speakOutput = `Añadiendo ${amountToAdd} ${currency}. La hucha contiene ahora ${piggy_bank_state.current_amount} ${currency}. `;
        
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
        const { piggy_bank_state, attributes } = await getOrInitializePiggyBank(handlerInput);
        
        // Validate the amount input
        const amountSlotValue = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        const amountToRemove = util.validateAmount(amountSlotValue);
        
        if (amountToRemove === null) {
            const speakOutput = 'Lo siento, no entendí la cantidad. Por favor, dime una cantidad válida entre 0 y un millón.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Cuánto dinero quieres sacar de la hucha?')
                .withSimpleCard(CARD_TITLE, speakOutput)
                .getResponse();
        }
        
        // Update piggy bank state with negative protection
        const { current_amount, currency } = piggy_bank_state;
        piggy_bank_state.current_amount = Math.max(0, current_amount - amountToRemove);
        piggy_bank_state.timestamp = new Date().getTime();
        
        let speakOutput = `Sacando ${amountToRemove} ${currency}. `;
        if (current_amount - amountToRemove < 0) {
            speakOutput += 'Estás sacando más dinero del que hay. ';
        }
        speakOutput += `La hucha contiene ahora ${piggy_bank_state.current_amount} ${currency}. `;
        
        // Save to persistent storage
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        
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
        const { piggy_bank_state, attributes } = await getOrInitializePiggyBank(handlerInput);
        
        // Validate the amount input
        const amountSlotValue = handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value;
        const newAmount = util.validateAmount(amountSlotValue);
        
        if (newAmount === null) {
            const speakOutput = 'Lo siento, no entendí la cantidad. Por favor, dime una cantidad válida entre 0 y un millón.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Cuánto dinero hay en la hucha?')
                .withSimpleCard(CARD_TITLE, speakOutput)
                .getResponse();
        }
        
        // Update piggy bank state
        const previousAmount = piggy_bank_state.current_amount;
        const currency = piggy_bank_state.currency;
        
        piggy_bank_state.current_amount = newAmount;
        piggy_bank_state.timestamp = new Date().getTime();
        
        // Save to persistent storage
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        
        const speakOutput = `La hucha contenía ${previousAmount} ${currency} y ahora contiene ${newAmount} ${currency}. `;
        
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

// Enhanced error handling to capture any syntax or routing errors
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
        const intentName = requestType === 'IntentRequest' ? 
            Alexa.getIntentName(handlerInput.requestEnvelope) : 'N/A';
            
        console.log(`~~~~ Error in ${requestType} (${intentName}): ${error.message}`);
        console.log(`~~~~ Error Stack: ${error.stack}`);
        
        let speakOutput;
        
        // Provide different error messages based on error type
        if (error.message.includes('service')) {
            speakOutput = 'Ha habido un problema conectando con el servicio. Por favor, inténtalo de nuevo más tarde.';
        } else if (error.message.includes('permission')) {
            speakOutput = 'No tengo los permisos necesarios para realizar esta acción. Por favor, revisa la configuración de la skill.';
        } else {
            speakOutput = 'Lo siento, algo ha fallado. ¿Puedes volver a intentarlo?';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(CARD_TITLE, speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Request interceptor for logging and locale setting
const RequestInterceptor = {
    process(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        console.log(`REQUEST TYPE: ${Alexa.getRequestType(handlerInput.requestEnvelope)}`);
        
        if (Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest') {
            console.log(`INTENT NAME: ${Alexa.getIntentName(handlerInput.requestEnvelope)}`);
        }
        
        // Set locale in session attributes for consistent access
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.locale = handlerInput.requestEnvelope.request.locale || DEFAULT_LOCALE;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    }
};

// Response interceptor for logging
const ResponseInterceptor = {
    process(handlerInput, response) {
        console.log(`RESPONSE: ${JSON.stringify(response)}`);
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
    .addRequestInterceptors(RequestInterceptor)
    .addResponseInterceptors(ResponseInterceptor)
    .withPersistenceAdapter(
        new ddbAdapter.DynamoDbPersistenceAdapter({
            tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
            createTable: false,
            dynamoDBClient: new DynamoDBClient({
                region: process.env.DYNAMODB_PERSISTENCE_REGION
            })
        })
    )
    .addErrorHandlers(
        ErrorHandler,
        )
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();