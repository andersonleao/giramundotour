/**
 * GiraMundoTour - Rotas de Usuários
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, checkPerfil } = require('../middleware/auth.middleware');

// Garante que a coluna menusPermitidos existe
(async () => {
    try {
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "menusPermitidos" JSONB`);
    } catch (e) {
        console.error('[usuarios] erro ao garantir coluna menusPermitidos:', e.message);
    }
})();

const PERFIS_VALIDOS = ['admin', 'gerente', 'operador'];
const MENUS_VALIDOS = [
    'busca', 'dashboard', 'cotacao', 'bilhetes', 'reservas',
    'hoteis', 'monitoramento', 'clientes', 'fornecedores', 'usuarios'
];

function sanitizeMenus(arr) {
    if (!Array.isArray(arr)) return null;
    const uniq = Array.from(new Set(arr.filter(m => MENUS_VALIDOS.includes(m))));
    return uniq;
}

router.use(authMiddleware);

/**
 * GET /api/usuarios
 */
router.get('/', checkPerfil('admin'), async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, nome, email, perfil, ativo, avatar, "menusPermitidos", "createdAt", "updatedAt" FROM usuarios ORDER BY nome ASC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/usuarios/menus — lista as chaves de menu disponíveis (admin)
 */
router.get('/menus', checkPerfil('admin'), (req, res) => {
    res.json({ success: true, data: MENUS_VALIDOS });
});

/**
 * GET /api/usuarios/:id
 */
router.get('/:id', checkPerfil('admin'), async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, nome, email, perfil, ativo, avatar, "menusPermitidos", "createdAt" FROM usuarios WHERE id = $1',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: true, message: 'Usuário não encontrado' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/usuarios — admin cria novo usuário
 */
router.post('/', checkPerfil('admin'), [
    body('nome').notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('Email inválido'),
    body('senha').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
    body('perfil').optional().isIn(PERFIS_VALIDOS).withMessage('Perfil inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, message: 'Dados inválidos', errors: errors.array() });
        }

        const { nome, email, senha, perfil = 'operador', ativo = true, menusPermitidos } = req.body;
        const menus = sanitizeMenus(menusPermitidos);

        const { rows: existente } = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1',
            [email.toLowerCase()]
        );
        if (existente.length > 0) {
            return res.status(400).json({ error: true, message: 'Este email já está cadastrado' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const { rows } = await pool.query(
            `INSERT INTO usuarios (id, nome, email, senha, perfil, ativo, "menusPermitidos", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING id, nome, email, perfil, ativo, "menusPermitidos"`,
            [nome, email.toLowerCase(), senhaHash, perfil, ativo, menus ? JSON.stringify(menus) : null]
        );

        res.status(201).json({ success: true, message: 'Usuário criado', data: rows[0] });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/usuarios/:id
 */
router.put('/:id', checkPerfil('admin'), [
    body('nome').optional().notEmpty().withMessage('Nome não pode ser vazio'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('perfil').optional().isIn(PERFIS_VALIDOS).withMessage('Perfil inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, errors: errors.array() });
        }

        const { nome, email, perfil, ativo, senha, menusPermitidos } = req.body;
        const sets = [];
        const values = [];
        let idx = 1;

        if (nome)                   { sets.push(`nome = $${idx++}`);   values.push(nome); }
        if (email)                  { sets.push(`email = $${idx++}`);  values.push(email.toLowerCase()); }
        if (perfil)                 { sets.push(`perfil = $${idx++}`); values.push(perfil); }
        if (typeof ativo === 'boolean') { sets.push(`ativo = $${idx++}`); values.push(ativo); }
        if (senha)                  { sets.push(`senha = $${idx++}`);  values.push(await bcrypt.hash(senha, 10)); }
        if ('menusPermitidos' in req.body) {
            const menus = sanitizeMenus(menusPermitidos);
            sets.push(`"menusPermitidos" = $${idx++}`);
            values.push(menus === null ? null : JSON.stringify(menus));
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });
        }

        sets.push(`"updatedAt" = NOW()`);
        values.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, nome, email, perfil, ativo, "menusPermitidos"`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: true, message: 'Usuário não encontrado' });
        }

        res.json({ success: true, message: 'Usuário atualizado', data: rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/usuarios/:id (soft delete)
 */
router.delete('/:id', checkPerfil('admin'), async (req, res) => {
    try {
        if (req.params.id === req.usuario.id) {
            return res.status(400).json({ error: true, message: 'Você não pode excluir seu próprio usuário' });
        }

        await pool.query(
            'UPDATE usuarios SET ativo = false, "updatedAt" = NOW() WHERE id = $1',
            [req.params.id]
        );

        res.json({ success: true, message: 'Usuário desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
