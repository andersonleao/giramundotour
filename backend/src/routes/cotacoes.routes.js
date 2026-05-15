/**
 * GiraMundoTour - Rotas de Cotações
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

/**
 * GET /api/cotacoes
 */
router.get('/', async (req, res) => {
    try {
        const { clienteId, status, page = 1, limit = 50 } = req.query;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (clienteId) { conditions.push(`co."clienteId" = $${idx++}`); values.push(clienteId); }
        if (status)    { conditions.push(`co.status = $${idx++}`);       values.push(status); }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [cotacoesRes, countRes] = await Promise.all([
            pool.query(
                `SELECT co.*, c.id AS "clienteId_rel", c.nome AS "clienteNome", c.email AS "clienteEmail"
                 FROM cotacoes co
                 LEFT JOIN clientes c ON c.id = co."clienteId"
                 ${where} ORDER BY co."createdAt" DESC LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, parseInt(limit), offset]
            ),
            pool.query(`SELECT COUNT(*) FROM cotacoes co ${where}`, values)
        ]);

        const total = parseInt(countRes.rows[0].count);

        const cotacoes = cotacoesRes.rows.map(r => {
            const co = { ...r };
            co.cliente = r.clienteNome ? { id: r['clienteId_rel'], nome: r.clienteNome, email: r.clienteEmail } : null;
            delete co.clienteNome; delete co.clienteEmail; delete co['clienteId_rel'];
            return co;
        });

        res.json({
            success: true,
            data: cotacoes,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        console.error('Erro ao listar cotações:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/cotacoes/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT co.*, c.id AS "clienteId_rel", c.nome AS "clienteNome", c.email AS "clienteEmail"
             FROM cotacoes co
             LEFT JOIN clientes c ON c.id = co."clienteId"
             WHERE co.id = $1`,
            [req.params.id]
        );

        if (rows.length === 0) return res.status(404).json({ error: true, message: 'Cotação não encontrada' });

        const r = rows[0];
        const cotacao = { ...r };
        cotacao.cliente = r.clienteNome ? { id: r['clienteId_rel'], nome: r.clienteNome, email: r.clienteEmail } : null;
        cotacao.voos = JSON.parse(cotacao.voos || '[]');
        cotacao.passageiros = JSON.parse(cotacao.passageiros || '{}');
        delete cotacao.clienteNome; delete cotacao.clienteEmail; delete cotacao['clienteId_rel'];

        res.json({ success: true, data: cotacao });
    } catch (error) {
        console.error('Erro ao buscar cotação:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/cotacoes
 */
router.post('/', [
    body('voos').isArray().withMessage('Voos deve ser um array'),
    body('total').isFloat({ min: 0 }).withMessage('Total inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, errors: errors.array() });
        }

        const { clienteId, voos, passageiros, subtotal, taxas, total, validade, observacoes } = req.body;
        const dataValidade = validade ? new Date(validade) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        const { rows } = await pool.query(
            `INSERT INTO cotacoes (id, "clienteId", voos, passageiros, subtotal, taxas, total, validade, status, observacoes, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'pendente', $8, NOW(), NOW())
             RETURNING *`,
            [clienteId, JSON.stringify(voos), JSON.stringify(passageiros || {}),
             parseFloat(subtotal) || 0, parseFloat(taxas) || 0, parseFloat(total),
             dataValidade, observacoes || null]
        );

        const cotacaoCompleta = await _getCotacaoComRelacoes(rows[0].id);
        res.status(201).json({ success: true, message: 'Cotação criada', data: cotacaoCompleta });
    } catch (error) {
        console.error('Erro ao criar cotação:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/cotacoes/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { clienteId, voos, passageiros, subtotal, taxas, total, validade, status, observacoes } = req.body;

        const sets = [];
        const values = [];
        let idx = 1;

        if (clienteId)                  { sets.push(`"clienteId" = $${idx++}`);   values.push(clienteId); }
        if (voos)                       { sets.push(`voos = $${idx++}`);          values.push(JSON.stringify(voos)); }
        if (passageiros)                { sets.push(`passageiros = $${idx++}`);   values.push(JSON.stringify(passageiros)); }
        if (subtotal !== undefined)     { sets.push(`subtotal = $${idx++}`);      values.push(parseFloat(subtotal)); }
        if (taxas !== undefined)        { sets.push(`taxas = $${idx++}`);         values.push(parseFloat(taxas)); }
        if (total !== undefined)        { sets.push(`total = $${idx++}`);         values.push(parseFloat(total)); }
        if (validade)                   { sets.push(`validade = $${idx++}`);      values.push(new Date(validade)); }
        if (status)                     { sets.push(`status = $${idx++}`);        values.push(status); }
        if (observacoes !== undefined)  { sets.push(`observacoes = $${idx++}`);   values.push(observacoes || null); }

        if (sets.length === 0) return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });

        sets.push(`"updatedAt" = NOW()`);
        values.push(req.params.id);

        await pool.query(`UPDATE cotacoes SET ${sets.join(', ')} WHERE id = $${idx}`, values);

        const cotacaoCompleta = await _getCotacaoComRelacoes(req.params.id);
        res.json({ success: true, message: 'Cotação atualizada', data: cotacaoCompleta });
    } catch (error) {
        console.error('Erro ao atualizar cotação:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/cotacoes/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM cotacoes WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Cotação excluída' });
    } catch (error) {
        console.error('Erro ao excluir cotação:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

async function _getCotacaoComRelacoes(id) {
    const { rows } = await pool.query(
        `SELECT co.*, c.id AS "clienteId_rel", c.nome AS "clienteNome", c.email AS "clienteEmail"
         FROM cotacoes co LEFT JOIN clientes c ON c.id = co."clienteId" WHERE co.id = $1`,
        [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    const co = { ...r };
    co.cliente = r.clienteNome ? { id: r['clienteId_rel'], nome: r.clienteNome, email: r.clienteEmail } : null;
    delete co.clienteNome; delete co.clienteEmail; delete co['clienteId_rel'];
    return co;
}

module.exports = router;
