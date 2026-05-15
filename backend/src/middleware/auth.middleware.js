/**
 * GiraMundoTour - Middleware de Autenticação
 */

const { verifyToken } = require('../config/jwt');
const { pool } = require('../config/database');

async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: true, message: 'Token de autenticação não fornecido' });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2) {
            return res.status(401).json({ error: true, message: 'Formato de token inválido' });
        }

        const [scheme, token] = parts;
        if (!/^Bearer$/i.test(scheme)) {
            return res.status(401).json({ error: true, message: 'Token mal formatado' });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: true, message: 'Token inválido ou expirado' });
        }

        const { rows } = await pool.query(
            'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1',
            [decoded.id]
        );

        const usuario = rows[0];
        if (!usuario || !usuario.ativo) {
            return res.status(401).json({ error: true, message: 'Usuário não encontrado ou inativo' });
        }

        req.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
        };

        next();
    } catch (error) {
        console.error('Erro no middleware de autenticação:', error);
        return res.status(500).json({ error: true, message: 'Erro interno de autenticação' });
    }
}

function checkPerfil(...perfis) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: true, message: 'Usuário não autenticado' });
        }
        if (!perfis.includes(req.usuario.perfil)) {
            return res.status(403).json({ error: true, message: 'Acesso negado. Perfil insuficiente.' });
        }
        next();
    };
}

async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return next();

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) return next();

        const decoded = verifyToken(parts[1]);
        if (decoded) {
            const { rows } = await pool.query(
                'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1',
                [decoded.id]
            );
            const usuario = rows[0];
            if (usuario && usuario.ativo) {
                req.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
            }
        }
        next();
    } catch (error) {
        next();
    }
}

module.exports = { authMiddleware, checkPerfil, optionalAuth };
