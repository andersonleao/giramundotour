/**
 * GiraMundoTour - Configuração JWT
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'giramundotour_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Gera um token JWT para o usuário
 * @param {Object} payload - Dados do usuário
 * @returns {string} Token JWT
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Verifica e decodifica um token JWT
 * @param {string} token - Token JWT
 * @returns {Object|null} Payload decodificado ou null se inválido
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Decodifica um token sem verificar a assinatura
 * @param {string} token - Token JWT
 * @returns {Object|null} Payload decodificado
 */
function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
}

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN,
    generateToken,
    verifyToken,
    decodeToken
};
