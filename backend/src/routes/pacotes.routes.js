const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Cria a tabela na primeira execução
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pacotes (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "clienteId"    UUID,
                "clienteNome"  VARCHAR(255),
                "clienteEmail" VARCHAR(255),
                "clienteTelefone" VARCHAR(50),
                destino        VARCHAR(255) NOT NULL,
                "nomeViagem"   VARCHAR(255),
                "dataPartida"  DATE,
                "dataRetorno"  DATE,
                adultos        INT DEFAULT 1,
                criancas       INT DEFAULT 0,
                bebes          INT DEFAULT 0,
                servicos       JSONB DEFAULT '[]',
                subtotal       NUMERIC(10,2) DEFAULT 0,
                markup         NUMERIC(5,2)  DEFAULT 0,
                total          NUMERIC(10,2) DEFAULT 0,
                status         VARCHAR(20)   DEFAULT 'orcamento',
                observacoes    TEXT,
                validade       DATE,
                solicitante    VARCHAR(255),
                "createdAt"    TIMESTAMP DEFAULT NOW(),
                "updatedAt"    TIMESTAMP DEFAULT NOW()
            )
        `);
    } catch (err) {
        console.error('[pacotes] erro ao criar tabela:', err.message);
    }
})();

// GET /api/pacotes
router.get('/', async (req, res) => {
    try {
        const { clienteId, status, page = 1, limit = 50 } = req.query;
        const vals = [];
        const where = [];
        if (clienteId) { vals.push(clienteId); where.push(`"clienteId" = $${vals.length}`); }
        if (status)    { vals.push(status);    where.push(`status = $${vals.length}`); }
        const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const offset = (page - 1) * limit;
        const { rows } = await pool.query(
            `SELECT * FROM pacotes ${wc} ORDER BY "createdAt" DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`,
            [...vals, limit, offset]
        );
        const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM pacotes ${wc}`, vals);
        res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total: +count } });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// GET /api/pacotes/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM pacotes WHERE id=$1`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: true, message: 'Não encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/pacotes
router.post('/', async (req, res) => {
    try {
        const b = req.body;
        const { rows } = await pool.query(`
            INSERT INTO pacotes (
                "clienteId","clienteNome","clienteEmail","clienteTelefone",
                destino,"nomeViagem","dataPartida","dataRetorno",
                adultos,criancas,bebes,servicos,subtotal,markup,total,
                status,observacoes,validade,solicitante
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
            RETURNING *`,
            [
                b.clienteId||null, b.clienteNome||null, b.clienteEmail||null, b.clienteTelefone||null,
                b.destino, b.nomeViagem||null, b.dataPartida||null, b.dataRetorno||null,
                b.adultos||1, b.criancas||0, b.bebes||0,
                JSON.stringify(b.servicos||[]), b.subtotal||0, b.markup||0, b.total||0,
                b.status||'orcamento', b.observacoes||null, b.validade||null, b.solicitante||null
            ]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /api/pacotes/:id
router.put('/:id', async (req, res) => {
    try {
        const b = req.body;
        const { rows } = await pool.query(`
            UPDATE pacotes SET
                "clienteId"=$1,"clienteNome"=$2,"clienteEmail"=$3,"clienteTelefone"=$4,
                destino=$5,"nomeViagem"=$6,"dataPartida"=$7,"dataRetorno"=$8,
                adultos=$9,criancas=$10,bebes=$11,servicos=$12,subtotal=$13,markup=$14,
                total=$15,status=$16,observacoes=$17,validade=$18,solicitante=$19,
                "updatedAt"=NOW()
            WHERE id=$20 RETURNING *`,
            [
                b.clienteId||null, b.clienteNome||null, b.clienteEmail||null, b.clienteTelefone||null,
                b.destino, b.nomeViagem||null, b.dataPartida||null, b.dataRetorno||null,
                b.adultos||1, b.criancas||0, b.bebes||0,
                JSON.stringify(b.servicos||[]), b.subtotal||0, b.markup||0, b.total||0,
                b.status||'orcamento', b.observacoes||null, b.validade||null, b.solicitante||null,
                req.params.id
            ]
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Não encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// PATCH /api/pacotes/:id/status
router.patch('/:id/status', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE pacotes SET status=$1,"updatedAt"=NOW() WHERE id=$2 RETURNING *`,
            [req.body.status, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Não encontrado' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /api/pacotes/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`DELETE FROM pacotes WHERE id=$1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: true, message: 'Não encontrado' });
        res.json({ success: true, message: 'Pacote removido' });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

module.exports = router;
