const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: process.env.S3_PERSISTENCE_REGION
});

module.exports.getS3PreSignedUrl = async function getS3PreSignedUrl(s3ObjectKey) {
    const bucketName = process.env.S3_PERSISTENCE_BUCKET;
    
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3ObjectKey
    });
    
    try {
        const s3PreSignedUrl = await getSignedUrl(s3Client, command, { 
            expiresIn: 60 // 60 seconds
        });
        console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
        return s3PreSignedUrl;
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        throw error;
    }
}

// Input validation utilities
module.exports.validateAmount = function validateAmount(value) {
    if (!value) return null;
    const amount = Number(value);
    if (isNaN(amount) || amount < 0 || amount > 1000000) {
        return null;
    }
    return amount;
}

// Currency initialization utility
module.exports.getCurrencyForLocale = function getCurrencyForLocale(locale) {
    switch (locale) {
        case 'es-MX': return "pesos";
        case 'es-US': return "dólares";
        default: return "euros"
    }
}

// Initialize piggy bank state
module.exports.initializePiggyBank = function initializePiggyBank(locale) {
    const currency = this.getCurrencyForLocale(locale);
    return {
        current_amount: 0,
        timestamp: new Date().getTime(),
        currency: currency
    };
}