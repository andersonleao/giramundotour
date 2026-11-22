// GiraMundoTour - Orçamentos formais (aéreo + hospedagem) para o cliente
// O conteúdo do orçamento (blocos de aéreo, opções de hotel, textos) fica em
// "dados" (JSONB); as colunas soltas servem para listar/filtrar.

const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

const STATUS_VALIDOS = ['aberto', 'enviado', 'aprovado', 'recusado'];

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orcamentos (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                numero         SERIAL,
                "clienteId"    UUID,
                "clienteNome"  VARCHAR(255),
                titulo         VARCHAR(255),
                subtitulo      VARCHAR(255),
                status         VARCHAR(20)   DEFAULT 'aberto',
                "dataCotacao"  DATE          DEFAULT CURRENT_DATE,
                total          NUMERIC(12,2) DEFAULT 0,
                dados          JSONB         DEFAULT '{}',
                "usuarioId"    UUID,
                "createdAt"    TIMESTAMP DEFAULT NOW(),
                "updatedAt"    TIMESTAMP DEFAULT NOW()
            )
        `);
    } catch (err) {
        console.error('[orcamentos] erro ao criar tabela:', err.message);
    }
})();

function valores(b) {
    const status = STATUS_VALIDOS.includes(b.status) ? b.status : 'aberto';
    return [
        b.clienteId || null,
        b.clienteNome || null,
        b.titulo || null,
        b.subtitulo || null,
        status,
        b.dataCotacao || null,
        +b.total || 0,
        JSON.stringify(b.dados && typeof b.dados === 'object' ? b.dados : {}),
    ];
}

// GET /api/orcamentos
router.get('/', async (req, res) => {
    try {
        const { status, clienteId } = req.query;
        const vals = [];
        const where = [];
        if (status)    { vals.push(status);    where.push(`status = $${vals.length}`); }
        if (clienteId) { vals.push(clienteId); where.push(`"clienteId" = $${vals.length}`); }
        const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
        // Lista sem o JSON pesado — o editor busca o orçamento completo pelo id
        const { rows } = await pool.query(
            `SELECT id, numero, "clienteId", "clienteNome", titulo, subtitulo, status,
                    "dataCotacao", total, "createdAt", "updatedAt"
               FROM orcamentos ${wc}
              ORDER BY "createdAt" DESC
              LIMIT 500`,
            vals
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// GET /api/orcamentos/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM orcamentos WHERE id = $1`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: true, message: 'Orçamento não encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/orcamentos
router.post('/', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `INSERT INTO orcamentos
                ("clienteId","clienteNome",titulo,subtitulo,status,"dataCotacao",total,dados,"usuarioId")
             VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8,$9)
             RETURNING *`,
            [...valores(req.body), req.usuario?.id || null]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/orcamentos/:id
router.put('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE orcamentos SET
                "clienteId"=$1, "clienteNome"=$2, titulo=$3, subtitulo=$4, status=$5,
                "dataCotacao"=COALESCE($6::date, "dataCotacao"), total=$7, dados=$8, "updatedAt"=NOW()
             WHERE id=$9 RETURNING *`,
            [...valores(req.body), req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Orçamento não encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PATCH /api/orcamentos/:id/status
router.patch('/:id/status', async (req, res) => {
    try {
        if (!STATUS_VALIDOS.includes(req.body.status)) {
            return res.status(400).json({ error: true, message: 'Status inválido' });
        }
        const { rows } = await pool.query(
            `UPDATE orcamentos SET status=$1, "updatedAt"=NOW() WHERE id=$2 RETURNING id, status`,
            [req.body.status, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Orçamento não encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /api/orcamentos/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query(`DELETE FROM orcamentos WHERE id=$1`, [req.params.id]);
        if (!rowCount) return res.status(404).json({ error: true, message: 'Orçamento não encontrado' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

module.exports = router;
