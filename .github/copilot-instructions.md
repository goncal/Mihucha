# AI Agent Instructions for Mihucha Alexa Skill

## Project Overview
**Mihucha** is a Spanish-language Alexa Skill for tracking piggy bank money across three locales (es-ES, es-MX, es-US). The skill uses DynamoDB for persistence and supports multi-currency operations with locale-specific defaults.

## Architecture & Key Components

### Core Structure
- **`lambda/index.js`** - Main skill logic with intent handlers using ask-sdk-core v2.14.0
- **`lambda/util.js`** - Input validation, currency utilities, and S3 presigned URL helpers
- **`skill-package/`** - Alexa skill configuration and interaction models
- **`skill-package/interactionModels/custom/`** - Voice interaction definitions per locale (es-ES.json, es-MX.json, es-US.json)

### Intent Handler Pattern
All handlers follow this structure:
```javascript
const [Intent]Handler = {
    canHandle(handlerInput) { /* intent matching */ },
    async handle(handlerInput) { /* business logic */ }
}
```

### State Management
- **Persistent state**: DynamoDB via `ask-sdk-dynamodb-persistence-adapter`
- **Session state**: Device timezone stored in `sessionAttributes.userTZ`
- **Data structure**: `piggy_bank_state = { current_amount, timestamp, currency }`
- **Legacy migration**: Automatic currency field addition for backward compatibility

## Critical Development Patterns

### Centralized State Management
Use the `getOrInitializePiggyBank()` helper function for consistent state handling:
```javascript
const { piggy_bank_state, attributes, locale } = await getOrInitializePiggyBank(handlerInput);
```

### Input Validation
All slot values MUST be validated using the util functions:
```javascript
const amount = util.validateAmount(slotValue);
if (amount === null) {
    // Handle invalid input with user-friendly error message
}
```

### Locale-Specific Currency Handling
```javascript
const currency = util.getCurrencyForLocale(locale);
// Returns: "pesos" (es-MX), "dólares" (es-US), "euros" (default)
```

### Legacy Data Migration
Handled automatically in `getOrInitializePiggyBank()` for backward compatibility with entries missing `currency` field.

### Request/Response Interceptors
- **RequestInterceptor**: Sets locale in session attributes, logs requests
- **ResponseInterceptor**: Logs all responses for debugging

### SSML for Spanish Speech
Date/time uses SSML tags for proper pronunciation:
```javascript
`<say-as interpret-as="date" format="dmy">${userDate}</say-as>`
`<say-as interpret-as="time">${userTime}</say-as>`
```

## Key Business Rules

1. **Initialization**: Piggy bank auto-initializes to 0 with locale-appropriate currency
2. **Negative protection**: Remove operations clamp to 0, never go negative
3. **Transaction logging**: Every operation updates `timestamp` for "last modified" tracking
4. **Multi-locale support**: Same logic across es-ES/es-MX/es-US with currency variations

## Development Workflow

### Testing
- **Unit Tests**: `npm test` - Comprehensive Jest test suite
- **Coverage**: `npm run test:coverage` - Code coverage reporting  
- **Watch Mode**: `npm run test:watch` - Real-time test execution
- **Linting**: `npm run lint` - ESLint code quality checks

### Local Debugging
Use `lambda/local-debugger.js` for local testing with ASK CLI.

### Deployment
This is an **Alexa Hosted Skill** - deployment happens through Alexa Developer Console, not direct Lambda deployment.
- **Skill ID**: `amzn1.ask.skill.21efbf49-9594-48f9-9e71-a50f446cf1b8`
- **Multi-region**: EU (eu-west-1), NA (us-east-1), FE (us-west-2) Lambda endpoints
- **ASK CLI**: Uses `@ask-cli/hosted-skill-deployer` for infrastructure management

### Dependencies
- **AWS SDK v3**: `@aws-sdk/client-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` v3.600.0
- **ask-sdk-core v2.14.0**: Latest Alexa SDK with enhanced features
- **ask-sdk-dynamodb-persistence-adapter v2.14.0**: DynamoDB persistence layer
- **Jest v29.7.0 + ESLint v8.50.0**: Comprehensive testing and linting setup

## Common Gotchas

1. **Locale handling**: Always check for `undefined` locale and default to `'es-ES'`
2. **Intent slots**: Extract values with `.value` and convert to `Number()` explicitly
3. **Persistence**: Always call `savePersistentAttributes()` after state changes
4. **Response format**: Include both `speak()` and `withSimpleCard()` for accessibility
5. **Error boundary**: `IntentReflectorHandler` must be last in handler chain
6. **Dialog management**: Uses `delegationStrategy: "ALWAYS"` with slot elicitation for amount prompts
7. **Multi-locale assets**: Each locale (es-ES, es-MX, es-US) has separate icon files in `skill-package/assets/images/`

## Adding New Features

When adding intents:
1. Create handler following existing pattern
2. Add to interaction models for all three locales
3. Register in `exports.handler` chain before `IntentReflectorHandler`
4. Handle initialization case for uninitialized piggy banks
5. Update help text in `HelpIntentHandler`