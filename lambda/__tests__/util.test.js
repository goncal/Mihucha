const util = require('../util');

describe('Utility Functions', () => {
    describe('validateAmount', () => {
        test('should return valid numbers', () => {
            expect(util.validateAmount('100')).toBe(100);
            expect(util.validateAmount('0')).toBe(0);
            expect(util.validateAmount('999999')).toBe(999999);
        });

        test('should return null for invalid inputs', () => {
            expect(util.validateAmount('')).toBe(null);
            expect(util.validateAmount(null)).toBe(null);
            expect(util.validateAmount(undefined)).toBe(null);
            expect(util.validateAmount('abc')).toBe(null);
            expect(util.validateAmount('-5')).toBe(null);
            expect(util.validateAmount('1000001')).toBe(null);
        });

        test('should handle decimal numbers correctly', () => {
            expect(util.validateAmount('15.50')).toBe(15.5);
            expect(util.validateAmount('0.01')).toBe(0.01);
        });
    });

    describe('getCurrencyForLocale', () => {
        test('should return correct currency for each locale', () => {
            expect(util.getCurrencyForLocale('es-MX')).toBe('pesos');
            expect(util.getCurrencyForLocale('es-US')).toBe('dólares');
            expect(util.getCurrencyForLocale('es-ES')).toBe('euros');
            expect(util.getCurrencyForLocale('unknown')).toBe('euros'); // default
            expect(util.getCurrencyForLocale(undefined)).toBe('euros'); // default
        });
    });

    describe('initializePiggyBank', () => {
        test('should initialize piggy bank with correct structure', () => {
            const result = util.initializePiggyBank('es-ES');
            
            expect(result).toHaveProperty('current_amount', 0);
            expect(result).toHaveProperty('currency', 'euros');
            expect(result).toHaveProperty('timestamp');
            expect(typeof result.timestamp).toBe('number');
            expect(result.timestamp).toBeLessThanOrEqual(Date.now());
        });

        test('should use correct currency for different locales', () => {
            expect(util.initializePiggyBank('es-MX').currency).toBe('pesos');
            expect(util.initializePiggyBank('es-US').currency).toBe('dólares');
            expect(util.initializePiggyBank('es-ES').currency).toBe('euros');
        });
    });
});