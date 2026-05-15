/**
 * GiraMundoTour - Rotas de Monitoramento de Preços
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');
const monitoramentoService = require('../services/monitoramento.service');

router.use(authMiddleware);

// GET — lista com histórico curto
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT * FROM monitoramentos ORDER BY "createdAt" DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('[monitoramentos GET]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// GET /:id/historico — histórico de preços
router.get('/:id/historico', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM monitoramento_historico WHERE "monitoramentoId"=$1 ORDER BY "verificadoEm" DESC LIMIT 200`,
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('[monitoramentos GET histórico]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST — cria
router.post('/', async (req, res) => {
    try {
        const b = req.body || {};
        if (!b.origem || !b.destino || !b.dataIdaInicio) {
            return res.status(400).json({ error: true, message: 'origem, destino e dataIdaInicio são obrigatórios' });
        }

        const dataIdaFim     = b.dataIdaFim     || b.dataIdaInicio;
        const tipoViagem     = b.tipoViagem     || 'idaVolta';
        const dataVoltaInicio = tipoViagem === 'idaVolta' ? (b.dataVoltaInicio || null) : null;
        const dataVoltaFim    = tipoViagem === 'idaVolta' ? (b.dataVoltaFim    || dataVoltaInicio) : null;

        const { rows } = await pool.query(
            `INSERT INTO monitoramentos (
                "clienteId", "clienteNome", "clienteEmail", "clienteTelefone",
                origem, destino, "tipoViagem",
                "dataIdaInicio", "dataIdaFim", "dataVoltaInicio", "dataVoltaFim",
                adultos, criancas, bebes, classe,
                "precoAlvo", "emailDestino", ativo, observacoes, solicitante
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
            RETURNING *`,
            [
                b.clienteId || null,
                b.clienteNome || null,
                b.clienteEmail || null,
                b.clienteTelefone || null,
                String(b.origem).toUpperCase(),
                String(b.destino).toUpperCase(),
                tipoViagem,
                b.dataIdaInicio,
                dataIdaFim,
                dataVoltaInicio,
                dataVoltaFim,
                parseInt(b.adultos)  || 1,
                parseInt(b.criancas) || 0,
                parseInt(b.bebes)    || 0,
                b.classe || 'economica',
                b.precoAlvo ? parseFloat(b.precoAlvo) : null,
                b.emailDestino || 'giramundotourag@gmail.com',
                b.ativo !== false,
                b.observacoes || null,
                b.solicitante || null
            ]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[monitoramentos POST]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// PUT /:id — atualiza
router.put('/:id', async (req, res) => {
    try {
        const b = req.body || {};
        const campos = [];
        const valores = [];
        let i = 1;
        const map = {
            clienteId: '"clienteId"', clienteNome: '"clienteNome"', clienteEmail: '"clienteEmail"', clienteTelefone: '"clienteTelefone"',
            origem: 'origem', destino: 'destino', tipoViagem: '"tipoViagem"',
            dataIdaInicio: '"dataIdaInicio"', dataIdaFim: '"dataIdaFim"',
            dataVoltaInicio: '"dataVoltaInicio"', dataVoltaFim: '"dataVoltaFim"',
            adultos: 'adultos', criancas: 'criancas', bebes: 'bebes', classe: 'classe',
            precoAlvo: '"precoAlvo"', emailDestino: '"emailDestino"', ativo: 'ativo', observacoes: 'observacoes',
            solicitante: 'solicitante'
        };
        for (const key of Object.keys(map)) {
            if (key in b) {
                campos.push(`${map[key]}=$${i++}`);
                let val = b[key];
                if (key === 'origem' || key === 'destino') val = String(val).toUpperCase();
                if (key === 'precoAlvo') val = val === '' || val == null ? null : parseFloat(val);
                valores.push(val);
            }
        }
        if (!campos.length) return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });
        campos.push(`"updatedAt"=NOW()`);
        valores.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE monitoramentos SET ${campos.join(', ')} WHERE id=$${i} RETURNING *`,
            valores
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Monitoramento não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[monitoramentos PUT]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// PATCH /:id/ativo — toggle
router.patch('/:id/ativo', async (req, res) => {
    try {
        const { ativo } = req.body;
        const { rows } = await pool.query(
            `UPDATE monitoramentos SET ativo=$1, "updatedAt"=NOW() WHERE id=$2 RETURNING *`,
            [!!ativo, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[monitoramentos PATCH]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /:id/verificar — força verificação agora (só roda se ativo=true)
router.post('/:id/verificar', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM monitoramentos WHERE id=$1`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: true, message: 'Não encontrado' });
        if (!rows[0].ativo) return res.status(400).json({ error: true, message: 'Monitoramento pausado' });
        const resultado = await monitoramentoService.verificarUm(rows[0]);
        const { rows: atual } = await pool.query(`SELECT * FROM monitoramentos WHERE id=$1`, [req.params.id]);
        res.json({ resultado, monitoramento: atual[0] });
    } catch (err) {
        console.error('[monitoramentos verificar]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM monitoramentos WHERE id=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('[monitoramentos DELETE]', err);
        res.status(500).json({ error: true, message: err.message });
    }
});

module.exports = router;
