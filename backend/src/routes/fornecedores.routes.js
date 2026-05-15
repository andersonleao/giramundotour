/**
 * GiraMundoTour - Rotas de Fornecedores
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

/**
 * GET /api/fornecedores
 */
router.get('/', async (req, res) => {
    try {
        const { busca, ativo } = req.query;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (busca) {
            conditions.push(`(nome ILIKE $${idx} OR telegram ILIKE $${idx} OR balcao ILIKE $${idx})`);
            values.push(`%${busca}%`);
            idx++;
        }

        if (ativo !== undefined) {
            conditions.push(`ativo = $${idx++}`);
            values.push(ativo === 'true');
        }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(
            `SELECT f.*, (SELECT COUNT(*) FROM bilhetes b WHERE b."fornecedorId" = f.id) AS "_countBilhetes"
             FROM fornecedores f ${where} ORDER BY nome ASC`,
            values
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro ao listar fornecedores:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/fornecedores/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const [fornecedorRes, bilhetesRes] = await Promise.all([
            pool.query('SELECT * FROM fornecedores WHERE id = $1', [req.params.id]),
            pool.query(
                `SELECT b.*, c.nome AS "clienteNome"
                 FROM bilhetes b
                 LEFT JOIN clientes c ON c.id = b."clienteId"
                 WHERE b."fornecedorId" = $1
                 ORDER BY b."dataEmissao" DESC LIMIT 10`,
                [req.params.id]
            )
        ]);

        if (fornecedorRes.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'Fornecedor não encontrado' });
        }

        const fornecedor = { ...fornecedorRes.rows[0], bilhetes: bilhetesRes.rows };
        res.json({ success: true, data: fornecedor });
    } catch (error) {
        console.error('Erro ao buscar fornecedor:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/fornecedores
 */
router.post('/', [
    body('nome').notEmpty().withMessage('Nome é obrigatório')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, errors: errors.array() });
        }

        const { nome, telegram, balcao, telefone, email, contato, observacoes } = req.body;

        const { rows } = await pool.query(
            `INSERT INTO fornecedores (id, nome, telegram, balcao, telefone, email, contato, observacoes, ativo, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
             RETURNING *`,
            [nome, telegram || null, balcao || null, telefone || null, email || null, contato || null, observacoes || null]
        );

        res.status(201).json({ success: true, message: 'Fornecedor criado', data: rows[0] });
    } catch (error) {
        console.error('Erro ao criar fornecedor:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/fornecedores/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { nome, telegram, balcao, telefone, email, contato, observacoes, ativo } = req.body;

        const sets = [];
        const values = [];
        let idx = 1;

        if (nome !== undefined)        { sets.push(`nome = $${idx++}`);        values.push(nome); }
        if (telegram !== undefined)    { sets.push(`telegram = $${idx++}`);    values.push(telegram || null); }
        if (balcao !== undefined)      { sets.push(`balcao = $${idx++}`);      values.push(balcao || null); }
        if (telefone !== undefined)    { sets.push(`telefone = $${idx++}`);    values.push(telefone || null); }
        if (email !== undefined)       { sets.push(`email = $${idx++}`);       values.push(email || null); }
        if (contato !== undefined)     { sets.push(`contato = $${idx++}`);     values.push(contato || null); }
        if (observacoes !== undefined) { sets.push(`observacoes = $${idx++}`); values.push(observacoes || null); }
        if (typeof ativo === 'boolean') { sets.push(`ativo = $${idx++}`);     values.push(ativo); }

        if (sets.length === 0) return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });

        sets.push(`"updatedAt" = NOW()`);
        values.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE fornecedores SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (rows.length === 0) return res.status(404).json({ error: true, message: 'Fornecedor não encontrado' });

        res.json({ success: true, message: 'Fornecedor atualizado', data: rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar fornecedor:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/fornecedores/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { rows: reservas } = await pool.query(
            'SELECT id FROM reservas WHERE "fornecedorId" = $1 LIMIT 1',
            [req.params.id]
        );
        if (reservas.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível excluir este fornecedor pois existem reservas vinculadas a ele.'
            });
        }

        const { rowCount } = await pool.query(
            'DELETE FROM fornecedores WHERE id = $1',
            [req.params.id]
        );
        if (rowCount === 0) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado' });
        res.json({ success: true, message: 'Fornecedor excluído' });
    } catch (error) {
        console.error('Erro ao excluir fornecedor:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
