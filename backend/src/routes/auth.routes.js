/**
 * GiraMundoTour - Rotas de Autenticação
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { generateToken } = require('../config/jwt');
const { authMiddleware, checkPerfil } = require('../middleware/auth.middleware');

// Limite de tentativas de login (em memória): após MAX_FALHAS senhas erradas
// do mesmo IP em JANELA_MS, novas tentativas recebem 429 até a janela passar.
const MAX_FALHAS = 10;
const JANELA_MS = 15 * 60 * 1000;
const _falhasLogin = new Map(); // ip → { count, inicio }

function _bloqueado(ip) {
    const reg = _falhasLogin.get(ip);
    if (!reg) return false;
    if (Date.now() - reg.inicio > JANELA_MS) { _falhasLogin.delete(ip); return false; }
    return reg.count >= MAX_FALHAS;
}
function _registrarFalha(ip) {
    const reg = _falhasLogin.get(ip);
    if (!reg || Date.now() - reg.inicio > JANELA_MS) _falhasLogin.set(ip, { count: 1, inicio: Date.now() });
    else reg.count++;
    // Evita crescer sem limite
    if (_falhasLogin.size > 5000) _falhasLogin.clear();
}

/**
 * POST /api/auth/login
 */
router.post('/login', [
    body('email').isEmail().withMessage('Email inválido'),
    body('senha').notEmpty().withMessage('Senha é obrigatória')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, message: 'Dados inválidos', errors: errors.array() });
        }

        const ip = req.ip;
        if (_bloqueado(ip)) {
            return res.status(429).json({ error: true, message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' });
        }

        const { email, senha } = req.body;

        const { rows } = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1',
            [email.toLowerCase()]
        );

        const usuario = rows[0];
        if (!usuario) {
            _registrarFalha(ip);
            return res.status(401).json({ error: true, message: 'Email ou senha incorretos' });
        }

        if (!usuario.ativo) {
            return res.status(401).json({ error: true, message: 'Usuário inativo. Contate o administrador.' });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            _registrarFalha(ip);
            return res.status(401).json({ error: true, message: 'Email ou senha incorretos' });
        }

        _falhasLogin.delete(ip);
        const token = generateToken({ id: usuario.id, email: usuario.email, perfil: usuario.perfil });

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            data: {
                usuario: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: usuario.perfil,
                    avatar: usuario.avatar,
                    menusPermitidos: usuario.menusPermitidos || null
                },
                token
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/auth/register
 * Restrito a administradores logados: antes era público e aceitava
 * perfil 'admin', permitindo que qualquer pessoa criasse uma conta admin.
 */
router.post('/register', authMiddleware, checkPerfil('admin'), [
    body('nome').notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('Email inválido'),
    body('senha').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
    body('perfil').optional().isIn(['admin', 'gerente', 'operador']).withMessage('Perfil inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, message: 'Dados inválidos', errors: errors.array() });
        }

        const { nome, email, senha, perfil = 'operador' } = req.body;

        const { rows: existente } = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existente.length > 0) {
            return res.status(400).json({ error: true, message: 'Este email já está cadastrado' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const { rows } = await pool.query(
            `INSERT INTO usuarios (id, nome, email, senha, perfil, ativo, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
             RETURNING id, nome, email, perfil`,
            [nome, email.toLowerCase(), senhaHash, perfil]
        );

        const usuario = rows[0];
        const token = generateToken({ id: usuario.id, email: usuario.email, perfil: usuario.perfil });

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            data: { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil }, token }
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, nome, email, perfil, avatar, "menusPermitidos", "createdAt" FROM usuarios WHERE id = $1',
            [req.usuario.id]
        );

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/auth/password
 */
router.put('/password', authMiddleware, [
    body('senhaAtual').notEmpty().withMessage('Senha atual é obrigatória'),
    body('novaSenha').isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, message: 'Dados inválidos', errors: errors.array() });
        }

        const { senhaAtual, novaSenha } = req.body;

        const { rows } = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [req.usuario.id]);
        const usuario = rows[0];

        const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);
        if (!senhaCorreta) {
            return res.status(400).json({ error: true, message: 'Senha atual incorreta' });
        }

        const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
        await pool.query(
            'UPDATE usuarios SET senha = $1, "updatedAt" = NOW() WHERE id = $2',
            [novaSenhaHash, req.usuario.id]
        );

        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
