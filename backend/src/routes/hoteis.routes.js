/**
 * GiraMundoTour - Rotas de Hotéis
 *
 * GET    /api/hoteis          - Listar reservas de hotel
 * GET    /api/hoteis/:id      - Buscar reserva por ID
 * POST   /api/hoteis          - Criar reserva de hotel
 * PUT    /api/hoteis/:id      - Atualizar reserva
 * DELETE /api/hoteis/:id      - Excluir reserva
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Garante que a tabela existe ao iniciar
async function criarTabelaSeNaoExistir() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS hoteis (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "clienteId"     TEXT,
            "nomeHotel"     VARCHAR(200) NOT NULL,
            cidade          VARCHAR(100),
            pais            VARCHAR(100),
            "enderecoHotel" TEXT,
            checkin         DATE NOT NULL,
            checkout        DATE NOT NULL,
            "numeroDiarias" INT GENERATED ALWAYS AS (checkout::date - checkin::date) STORED,
            "tipoQuarto"    VARCHAR(50) DEFAULT 'standard',
            "regimeAlimentar" VARCHAR(80) DEFAULT 'café da manhã',
            "numeroQuartos" INT DEFAULT 1,
            "numeroPessoas" INT DEFAULT 1,
            "valorDiaria"   NUMERIC(10,2) DEFAULT 0,
            "valorTotal"    NUMERIC(10,2) DEFAULT 0,
            localizador        VARCHAR(100),
            status             VARCHAR(30) DEFAULT 'confirmada',
            observacoes        TEXT,
            "dadosAdicionais"  TEXT,
            "logoHotel"        TEXT,
            "createdAt"        TIMESTAMPTZ DEFAULT NOW(),
            "updatedAt"        TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

criarTabelaSeNaoExistir().catch(err => console.error('[hoteis] erro ao criar tabela:', err));

/**
 * GET /api/hoteis
 */
router.get('/', async (req, res) => {
    try {
        const { busca, status, page = 1, limit = 200 } = req.query;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (busca) {
            conditions.push(`(h."nomeHotel" ILIKE $${idx} OR h.cidade ILIKE $${idx} OR h.localizador ILIKE $${idx} OR c.nome ILIKE $${idx})`);
            values.push(`%${busca}%`);
            idx++;
        }

        if (status) {
            conditions.push(`h.status = $${idx++}`);
            values.push(status);
        }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const sql = `
            SELECT h.*,
                   c.nome AS "clienteNome",
                   c.telefone AS "clienteTelefone",
                   c.email AS "clienteEmail",
                   c.cpf AS "clienteCpf",
                   c.cnpj AS "clienteCnpj"
            FROM hoteis h
            LEFT JOIN clientes c ON c.id = h."clienteId"
            ${where}
            ORDER BY h."createdAt" DESC
            LIMIT $${idx} OFFSET $${idx + 1}
        `;

        const countSql = `
            SELECT COUNT(*) FROM hoteis h
            LEFT JOIN clientes c ON c.id = h."clienteId"
            ${where}
        `;

        const [rows, countRes] = await Promise.all([
            pool.query(sql, [...values, parseInt(limit), offset]),
            pool.query(countSql, values)
        ]);

        res.json({
            success: true,
            data: rows.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countRes.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Erro ao listar hotéis:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/hoteis/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT h.*,
                   c.nome AS "clienteNome",
                   c.telefone AS "clienteTelefone",
                   c.email AS "clienteEmail",
                   c.cpf AS "clienteCpf",
                   c.cnpj AS "clienteCnpj"
            FROM hoteis h
            LEFT JOIN clientes c ON c.id = h."clienteId"
            WHERE h.id = $1
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: true, message: 'Reserva não encontrada' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Erro ao buscar hotel:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/hoteis
 */
router.post('/', [
    body('nomeHotel').notEmpty().withMessage('Nome do hotel é obrigatório'),
    body('checkin').notEmpty().withMessage('Data de check-in é obrigatória'),
    body('checkout').notEmpty().withMessage('Data de check-out é obrigatória'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, errors: errors.array() });
        }

        const {
            clienteId, nomeHotel, cidade, pais, enderecoHotel,
            checkin, checkout, tipoQuarto, regimeAlimentar,
            numeroQuartos, numeroPessoas, valorDiaria, valorTotal,
            localizador, status, observacoes, dadosAdicionais, logoHotel
        } = req.body;

        const { rows } = await pool.query(`
            INSERT INTO hoteis (
                "clienteId", "nomeHotel", cidade, pais, "enderecoHotel",
                checkin, checkout, "tipoQuarto", "regimeAlimentar",
                "numeroQuartos", "numeroPessoas", "valorDiaria", "valorTotal",
                localizador, status, observacoes, "dadosAdicionais", "logoHotel"
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, $13,
                $14, $15, $16, $17, $18
            ) RETURNING *
        `, [
            clienteId || null,
            nomeHotel,
            cidade || null,
            pais || null,
            enderecoHotel || null,
            checkin,
            checkout,
            tipoQuarto || 'standard',
            regimeAlimentar || 'café da manhã',
            parseInt(numeroQuartos) || 1,
            parseInt(numeroPessoas) || 1,
            parseFloat(valorDiaria) || 0,
            parseFloat(valorTotal) || 0,
            localizador || null,
            status || 'confirmada',
            observacoes || null,
            dadosAdicionais || null,
            logoHotel || null
        ]);

        res.status(201).json({ success: true, message: 'Reserva de hotel criada', data: rows[0] });
    } catch (error) {
        console.error('Erro ao criar hotel:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/hoteis/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const {
            clienteId, nomeHotel, cidade, pais, enderecoHotel,
            checkin, checkout, tipoQuarto, regimeAlimentar,
            numeroQuartos, numeroPessoas, valorDiaria, valorTotal,
            localizador, status, observacoes, dadosAdicionais, logoHotel
        } = req.body;

        const sets = [];
        const values = [];
        let idx = 1;

        const add = (col, val) => { sets.push(`"${col}" = $${idx++}`); values.push(val); };

        if (clienteId !== undefined)       add('clienteId', clienteId || null);
        if (nomeHotel !== undefined)       add('nomeHotel', nomeHotel);
        if (cidade !== undefined)          add('cidade', cidade || null);
        if (pais !== undefined)            add('pais', pais || null);
        if (enderecoHotel !== undefined)   add('enderecoHotel', enderecoHotel || null);
        if (checkin !== undefined)         add('checkin', checkin);
        if (checkout !== undefined)        add('checkout', checkout);
        if (tipoQuarto !== undefined)      add('tipoQuarto', tipoQuarto);
        if (regimeAlimentar !== undefined) add('regimeAlimentar', regimeAlimentar);
        if (numeroQuartos !== undefined)   add('numeroQuartos', parseInt(numeroQuartos) || 1);
        if (numeroPessoas !== undefined)   add('numeroPessoas', parseInt(numeroPessoas) || 1);
        if (valorDiaria !== undefined)     add('valorDiaria', parseFloat(valorDiaria) || 0);
        if (valorTotal !== undefined)      add('valorTotal', parseFloat(valorTotal) || 0);
        if (localizador !== undefined)     add('localizador', localizador || null);
        if (status !== undefined)          add('status', status);
        if (observacoes !== undefined)     add('observacoes', observacoes || null);
        if (dadosAdicionais !== undefined) add('dadosAdicionais', dadosAdicionais || null);
        if (logoHotel !== undefined)       add('logoHotel', logoHotel || null);

        if (sets.length === 0) {
            return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });
        }

        sets.push(`"updatedAt" = NOW()`);
        values.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE hoteis SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: true, message: 'Reserva não encontrada' });
        }

        res.json({ success: true, message: 'Reserva atualizada', data: rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar hotel:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/hoteis/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM hoteis WHERE id = $1', [req.params.id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: true, message: 'Reserva não encontrada' });
        }
        res.json({ success: true, message: 'Reserva excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir hotel:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
