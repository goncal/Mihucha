const Alexa = require('ask-sdk-core');
const LaunchRequestHandler = require('./LaunchRequestHandler');
const { CARD_TITLE } = require('./shared');

// Builds a minimal LaunchRequest envelope for the given locale.
const createLaunchEnvelope = (locale = 'es-ES') => ({
    version: '1.0',
    session: {
        new: true,
        sessionId: 'SessionId.test-session',
        application: { applicationId: 'amzn1.ask.skill.test-skill' },
        user: { userId: 'amzn1.ask.account.test-user' },
        attributes: {}
    },
    context: {
        System: {
            application: { applicationId: 'amzn1.ask.skill.test-skill' },
            user: { userId: 'amzn1.ask.account.test-user' },
            device: { deviceId: 'test-device-id' },
            apiEndpoint: 'https://api.amazonalexa.com',
            apiAccessToken: 'test-api-access-token'
        }
    },
    request: {
        type: 'LaunchRequest',
        requestId: 'EdwRequestId.test-request',
        locale,
        timestamp: '2026-08-03T08:00:00Z'
    }
});

// Creates a complete mock handlerInput. Returns the input plus the raw sessionAttributes
// reference so tests can inspect mutations made by the handler.
const createHandlerInput = ({ locale = 'es-ES', persistentAttributes = {}, timeZone = 'Europe/Madrid' } = {}) => {
    const sessionAttributes = {};
    const attributesManager = {
        getSessionAttributes: jest.fn(() => sessionAttributes),
        getPersistentAttributes: jest.fn().mockResolvedValue(persistentAttributes),
        setPersistentAttributes: jest.fn(),
        savePersistentAttributes: jest.fn().mockResolvedValue()
    };
    const handlerInput = {
        requestEnvelope: createLaunchEnvelope(locale),
        attributesManager,
        serviceClientFactory: {
            getUpsServiceClient: () => ({
                getSystemTimeZone: jest.fn().mockResolvedValue(timeZone)
            })
        },
        responseBuilder: Alexa.ResponseFactory.init()
    };
    // Expose the session object so tests can assert on handler mutations.
    handlerInput._sessionAttributes = sessionAttributes;
    return handlerInput;
};

describe('LaunchRequestHandler', () => {
    describe('canHandle', () => {
        test('returns true for a LaunchRequest', () => {
            const handlerInput = createHandlerInput();
            expect(LaunchRequestHandler.canHandle(handlerInput)).toBe(true);
        });

        test('returns false for an IntentRequest', () => {
            const handlerInput = createHandlerInput();
            handlerInput.requestEnvelope.request.type = 'IntentRequest';
            handlerInput.requestEnvelope.request.intent = { name: 'SomeIntent' };
            expect(LaunchRequestHandler.canHandle(handlerInput)).toBe(false);
        });
    });

    describe('handle – piggy bank not yet initialized', () => {
        test('initializes state to 0 euros for es-ES and speaks welcome message', async () => {
            const handlerInput = createHandlerInput();

            const response = await LaunchRequestHandler.handle(handlerInput);

            const { attributesManager, _sessionAttributes } = handlerInput;
            expect(attributesManager.serviceClientFactory).toBeUndefined(); // confirm mock was used
            expect(attributesManager.setPersistentAttributes).toHaveBeenCalled();
            expect(attributesManager.savePersistentAttributes).toHaveBeenCalled();
            expect(_sessionAttributes.userTZ).toBe('Europe/Madrid');

            const savedAttrs = attributesManager.setPersistentAttributes.mock.calls[0][0];
            expect(savedAttrs.piggy_bank_state).toMatchObject({ current_amount: 0, currency: 'euros' });
            expect(typeof savedAttrs.piggy_bank_state.timestamp).toBe('number');

            expect(response.outputSpeech.ssml).toContain('Para empezar, asumo que la hucha contiene cero euros.');
            expect(response.card.title).toBe(CARD_TITLE);
        });

        test('initializes with pesos for es-MX locale', async () => {
            const handlerInput = createHandlerInput({ locale: 'es-MX' });

            const response = await LaunchRequestHandler.handle(handlerInput);

            const savedAttrs = handlerInput.attributesManager.setPersistentAttributes.mock.calls[0][0];
            expect(savedAttrs.piggy_bank_state.currency).toBe('pesos');
            expect(response.outputSpeech.ssml).toContain('cero pesos');
        });

        test('initializes with dólares for es-US locale', async () => {
            const handlerInput = createHandlerInput({ locale: 'es-US' });

            const response = await LaunchRequestHandler.handle(handlerInput);

            const savedAttrs = handlerInput.attributesManager.setPersistentAttributes.mock.calls[0][0];
            expect(savedAttrs.piggy_bank_state.currency).toBe('dólares');
            expect(response.outputSpeech.ssml).toContain('cero dólares');
        });
    });

    describe('handle – piggy bank already initialized', () => {
        test('reports current amount and currency without overwriting state', async () => {
            const persistentAttributes = {
                piggy_bank_state: {
                    current_amount: 42,
                    currency: 'euros',
                    timestamp: new Date('2026-01-15T10:30:00Z').getTime()
                }
            };
            const handlerInput = createHandlerInput({ persistentAttributes });

            const response = await LaunchRequestHandler.handle(handlerInput);

            expect(handlerInput.attributesManager.savePersistentAttributes).not.toHaveBeenCalled();
            expect(response.outputSpeech.ssml).toContain('La hucha contiene 42 euros desde');
            expect(response.card.title).toBe(CARD_TITLE);
        });

        test('falls back to locale currency when existing state is missing the currency field (legacy)', async () => {
            const persistentAttributes = {
                piggy_bank_state: {
                    current_amount: 10,
                    // currency intentionally absent to simulate legacy records
                    timestamp: new Date('2026-01-15T10:30:00Z').getTime()
                }
            };
            const handlerInput = createHandlerInput({ persistentAttributes });

            const response = await LaunchRequestHandler.handle(handlerInput);

            expect(response.outputSpeech.ssml).toContain('La hucha contiene 10 euros desde');
        });
    });

    describe('handle – UPS service (timezone) errors', () => {
        test('stores the timezone in session attributes when UPS call succeeds', async () => {
            const handlerInput = createHandlerInput({ timeZone: 'America/Mexico_City', locale: 'es-MX' });

            await LaunchRequestHandler.handle(handlerInput);

            expect(handlerInput._sessionAttributes.userTZ).toBe('America/Mexico_City');
        });

        test('returns an error response immediately when UPS throws a non-ServiceError', async () => {
            const handlerInput = createHandlerInput();
            const networkError = Object.assign(new Error('Network failure'), { name: 'NetworkError' });
            handlerInput.serviceClientFactory = {
                getUpsServiceClient: () => ({ getSystemTimeZone: jest.fn().mockRejectedValue(networkError) })
            };

            const response = await LaunchRequestHandler.handle(handlerInput);

            expect(response.outputSpeech.ssml).toContain('Ha habido un problema conectando con el servicio.');
        });

        test('continues and renders the response when UPS throws a ServiceError', async () => {
            const persistentAttributes = {
                piggy_bank_state: {
                    current_amount: 5,
                    currency: 'euros',
                    timestamp: new Date('2026-01-15T10:30:00Z').getTime()
                }
            };
            const handlerInput = createHandlerInput({ persistentAttributes });
            const serviceError = Object.assign(new Error('Service unavailable'), { name: 'ServiceError' });
            handlerInput.serviceClientFactory = {
                getUpsServiceClient: () => ({ getSystemTimeZone: jest.fn().mockRejectedValue(serviceError) })
            };

            const response = await LaunchRequestHandler.handle(handlerInput);

            // Timezone is undefined but the response is still rendered
            expect(response.outputSpeech.ssml).toContain('La hucha contiene 5 euros desde');
        });
    });
});
