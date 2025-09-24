const Alexa = require('ask-sdk-core');

// Mock the util module
jest.mock('../util', () => ({
    validateAmount: jest.fn(),
    getCurrencyForLocale: jest.fn(),
    initializePiggyBank: jest.fn()
}));

const util = require('../util');

// Import handlers after mocking
const { handler } = require('../index');

describe('Alexa Skill Handlers', () => {
    let handlerInput;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Setup default mock implementations
        util.validateAmount.mockImplementation((value) => {
            const num = Number(value);
            return (value && !isNaN(num) && num >= 0 && num <= 1000000) ? num : null;
        });
        
        util.getCurrencyForLocale.mockImplementation((locale) => {
            switch (locale) {
                case 'es-MX': return 'pesos';
                case 'es-US': return 'dólares';
                default: return 'euros';
            }
        });
        
        util.initializePiggyBank.mockImplementation((locale) => ({
            current_amount: 0,
            timestamp: Date.now(),
            currency: util.getCurrencyForLocale(locale)
        }));

        // Setup basic handlerInput mock
        handlerInput = {
            requestEnvelope: {
                request: {
                    type: 'LaunchRequest',
                    locale: 'es-ES'
                },
                context: {
                    System: {
                        device: {
                            deviceId: 'test-device-id'
                        }
                    }
                }
            },
            attributesManager: {
                getSessionAttributes: jest.fn().mockReturnValue({ locale: 'es-ES' }),
                setSessionAttributes: jest.fn(),
                getPersistentAttributes: jest.fn().mockResolvedValue({}),
                setPersistentAttributes: jest.fn(),
                savePersistentAttributes: jest.fn().mockResolvedValue()
            },
            serviceClientFactory: {
                getUpsServiceClient: jest.fn().mockReturnValue({
                    getSystemTimeZone: jest.fn().mockResolvedValue('Europe/Madrid')
                })
            },
            responseBuilder: {
                speak: jest.fn().mockReturnThis(),
                reprompt: jest.fn().mockReturnThis(),
                withSimpleCard: jest.fn().mockReturnThis(),
                getResponse: jest.fn().mockReturnValue({ outputSpeech: { ssml: '<speak>Test</speak>' } })
            }
        };
    });

    describe('LaunchRequestHandler', () => {
        test('should handle launch request for new user', async () => {
            // Mock new user (no persistent attributes)
            handlerInput.attributesManager.getPersistentAttributes.mockResolvedValue({});
            
            const response = await handler.handle(handlerInput);
            
            expect(response).toBeDefined();
            expect(handlerInput.responseBuilder.speak).toHaveBeenCalled();
            expect(handlerInput.responseBuilder.withSimpleCard).toHaveBeenCalled();
        });

        test('should handle launch request for returning user', async () => {
            // Mock returning user with existing piggy bank state
            handlerInput.attributesManager.getPersistentAttributes.mockResolvedValue({
                piggy_bank_state: {
                    current_amount: 100,
                    timestamp: Date.now(),
                    currency: 'euros'
                },
                isReturningUser: true
            });
            
            const response = await handler.handle(handlerInput);
            
            expect(response).toBeDefined();
            expect(handlerInput.responseBuilder.speak).toHaveBeenCalled();
        });
    });

    describe('AddMoneyIntentHandler', () => {
        beforeEach(() => {
            handlerInput.requestEnvelope.request = {
                type: 'IntentRequest',
                intent: {
                    name: 'AddMoneyIntent',
                    slots: {
                        AmountOfMoney: {
                            value: '50'
                        }
                    }
                },
                locale: 'es-ES'
            };
        });

        test('should add money successfully', async () => {
            util.validateAmount.mockReturnValue(50);
            handlerInput.attributesManager.getPersistentAttributes.mockResolvedValue({
                piggy_bank_state: {
                    current_amount: 100,
                    timestamp: Date.now(),
                    currency: 'euros'
                }
            });
            
            const response = await handler.handle(handlerInput);
            
            expect(util.validateAmount).toHaveBeenCalledWith('50');
            expect(handlerInput.attributesManager.savePersistentAttributes).toHaveBeenCalled();
            expect(response).toBeDefined();
        });

        test('should handle invalid amount', async () => {
            util.validateAmount.mockReturnValue(null);
            handlerInput.requestEnvelope.request.intent.slots.AmountOfMoney.value = 'invalid';
            
            const response = await handler.handle(handlerInput);
            
            expect(util.validateAmount).toHaveBeenCalledWith('invalid');
            expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
                expect.stringContaining('no entendí la cantidad')
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle errors gracefully', async () => {
            // Force an error by making persistent attributes fail
            handlerInput.attributesManager.getPersistentAttributes.mockRejectedValue(
                new Error('Database connection failed')
            );
            
            const response = await handler.handle(handlerInput);
            
            expect(response).toBeDefined();
            expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
                expect.stringContaining('algo ha fallado')
            );
        });
    });
});